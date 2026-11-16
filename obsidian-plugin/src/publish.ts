import { App, TFile } from "obsidian";
import { GitHubClient } from "./github";
import type { SnarkSettings } from "./settings";
import { MomentType, NoteProps, buildFrontmatter, flipDraft, readNoteProps, stripFrontmatter } from "./frontmatter";
import { LinkMap, addToLinkMap, convertBody } from "./converter";
import { r2Config, R2Config, deleteR2Object, uploadImageToR2 } from "./r2";
import { BLOG_HASH_PROP, BLOG_PATH_PROP, SLUG_RE, hhmm, sha256Hex, errorNotice, successNotice } from "./utils";

export interface PublishContext {
  app: App;
  settings: SnarkSettings;
  client: GitHubClient;
}

/** 模态框里用户确认的最终发布值（全部属性都在面板上可见、可编辑） */
export interface PublishForm {
  kind: "posts" | "moments";
  title: string;
  date: string; // YYYY-MM-DD
  excerpt: string; // posts 必填
  slug: string; // posts 必填
  type: MomentType; // moments 有效
  draft: boolean;
  // 以下为笔记属性的完整映射（面板里可直接查看/修改）
  tags: string[];
  heroImage: string;
  featured: boolean;
  dropCap: boolean; // 站点默认 true；false 时才写入/显示开关关
  bgmSrc: string;
  bgmTitle: string;
  lockQuestion: string; // 仅 moments
  lockAnswer: string; // 仅 moments
  graphName: string;
  graphAvatar: string;
  graphEnabled: boolean; // 站点默认 true
  graphLinks: string[];
}

export interface PublishOutcome {
  path: string;
  created: boolean;
  commitUrl: string | null;
  warnings: string[];
}

export type ConfirmFn = (msg: string) => Promise<boolean>;

function displayTitle(form: PublishForm): string {
  return form.title || (form.kind === "moments" && form.type === "diary" ? form.date : "未命名");
}

/** 汇总 vault 里可被 [[…]] 引用的文章：别名/标题/slug → slug */
export function buildLinkMap(ctx: PublishContext): LinkMap {
  const map: LinkMap = new Map();
  for (const f of ctx.app.vault.getMarkdownFiles()) {
    const cache = ctx.app.metadataCache.getFileCache(f);
    const props = readNoteProps(cache?.frontmatter);
    const publishedInPosts = (props.blogPath ?? "").startsWith(`${ctx.settings.postsDir}/`);
    if (!props.slug && !publishedInPosts) continue;
    const rawAliases = cache?.frontmatter?.["aliases"];
    const aliasList = Array.isArray(rawAliases)
      ? rawAliases.map(String)
      : typeof rawAliases === "string"
        ? rawAliases.split(/,/).map((s) => s.trim())
        : [];
    const aliases = [f.basename, props.title ?? "", ...aliasList].filter(Boolean);
    addToLinkMap(map, { aliases, slug: props.slug });
  }
  return map;
}

/**
 * 发布前把笔记里的 ![[附件]] 上传 R2 并改写为外链：
 * 仓库与笔记本体都会拿到 https:// 外链（笔记回填后，下次发布不会重复上传）。
 * 附件在 vault 中找不到时直接报错，不做半成品提交。
 */
async function uploadNoteEmbeds(
  ctx: PublishContext,
  cfg: R2Config,
  file: TFile,
  body: string,
): Promise<{ body: string; count: number }> {
  const embedRe = /!\[\[([^\[\]]+)\]\]/g;
  const targets = new Map<string, string>(); // 附件链接路径 → 上传后的公网 URL
  for (const m of body.matchAll(embedRe)) {
    const base = m[1].split("|")[0].trim(); // 去掉 |宽高 提示
    if (!base || targets.has(base)) continue;
    const dest = ctx.app.metadataCache.getFirstLinkpathDest(base, file.path);
    if (!dest) throw new Error(`附件「${base}」在 vault 中不存在，无法上传 R2（请先确认文件还在）`);
    const bytes = new Uint8Array(await ctx.app.vault.readBinary(dest));
    const ext = dest.extension.toLowerCase().replace("jpeg", "jpg");
    targets.set(base, await uploadImageToR2(bytes, ext, cfg));
  }
  if (!targets.size) return { body, count: 0 };

  const rewrite = (text: string): string =>
    text.replace(embedRe, (_whole: string, inner: string) => {
      const base = inner.split("|")[0].trim();
      const url = targets.get(base);
      if (!url) return _whole;
      const name = base.replace(/^.*\//, "").replace(/\.[^.]+$/, "") || "image";
      return `![${name}](${url})`;
    });
  const newBody = rewrite(body);
  // 回填到笔记本体（frontmatter 不受影响），保持笔记与仓库一致
  if (newBody !== body) await ctx.app.vault.process(file, (data: string) => rewrite(data));
  return { body: newBody, count: targets.size };
}

/**
 * 发布 / 更新一篇笔记：
 * 校验 → （R2 已配置时）上传正文附件 → 正文转换 → 组装 mdx → 单文件 commit
 * （冲突需确认，不静默覆盖）→ 写回 blog-path 等属性。
 * 抛错时 Error.message 是可直接展示给用户的中文说明。
 */
export async function publishNote(
  ctx: PublishContext,
  file: TFile,
  form: PublishForm,
  confirm: ConfirmFn,
): Promise<PublishOutcome> {
  const s = ctx.settings;
  const props = readNoteProps(ctx.app.metadataCache.getFileCache(file)?.frontmatter);

  // 1. 校验
  const issues: string[] = [];
  if (form.kind === "posts") {
    if (!form.title.trim()) issues.push("缺少标题");
    if (!form.slug) issues.push("缺少 slug（英文短名）");
    else if (!SLUG_RE.test(form.slug)) issues.push(`slug「${form.slug}」不合法，只能用英文小写、数字和连字符`);
    if (!form.excerpt.trim()) issues.push("缺少摘要 excerpt（用于列表、分享卡与相关文章）");
  }
  if (!form.date) issues.push("缺少日期");
  const hasLockQ = !!form.lockQuestion.trim();
  const hasLockA = !!form.lockAnswer.trim();
  if (form.kind === "moments" && hasLockQ !== hasLockA) {
    issues.push("lock-question 与 lock-answer 必须成对填写（问答加密）");
  }
  if (issues.length) throw new Error(issues.join("；"));

  // 2. 正文转换（R2 已配置时，先把 ![[附件]] 上传并回填外链）
  const noteText = await ctx.app.vault.read(file);
  const r2cfg = r2Config(ctx.settings);
  const uploadWarns: string[] = [];
  let body = stripFrontmatter(noteText);
  if (r2cfg) {
    const up = await uploadNoteEmbeds(ctx, r2cfg, file, body);
    body = up.body;
    if (up.count) uploadWarns.push(`已上传 ${up.count} 张图片到 R2 并回填外链到笔记`);
  }
  const conv = convertBody(body, buildLinkMap(ctx));
  if (conv.errors.length) throw new Error(conv.errors.join("\n"));

  // 3. 计算仓库路径
  const oldPath = props.blogPath;
  let path: string;
  if (form.kind === "posts") {
    path = `${s.postsDir}/${form.slug}.mdx`;
  } else if (oldPath && oldPath.startsWith(`${s.momentsDir}/`)) {
    path = oldPath;
  } else {
    const prefix = form.type === "diary" ? "diary" : "moment";
    const base = `${s.momentsDir}/${prefix}-${form.date}`;
    path = `${base}.mdx`;
    if ((await ctx.client.getSha(path)) !== null) path = `${base}-${hhmm()}.mdx`;
  }

  // 更换路径（slug 更名 / 集合切换）时，若远端已有同路径文件则需确认
  if (oldPath && oldPath !== path && (await ctx.client.getSha(path)) !== null) {
    const ok = await confirm(
      `远端已存在 ${path}。若这是同一篇换了个 slug，继续会覆盖它；若属于别的文章，请换个 slug。覆盖？`,
    );
    if (!ok) throw new Error("已取消：不覆盖远端已有文件");
  }

  // 4. 组装 mdx（全部字段以面板确认值为准）
  const fmProps: NoteProps = {
    title: form.title.trim() || undefined,
    date: form.date,
    excerpt: form.excerpt.trim() || undefined,
    slug: form.kind === "posts" ? form.slug : undefined,
    type: form.kind === "moments" ? form.type : undefined,
    draft: form.draft,
    tags: form.tags,
    heroImage: form.heroImage.trim() || undefined,
    featured: form.featured || undefined,
    dropCap: form.dropCap ? undefined : false,
    bgmSrc: form.bgmSrc.trim() || undefined,
    bgmTitle: form.bgmTitle.trim() || undefined,
    lockQuestion: form.kind === "moments" && form.lockQuestion.trim() ? form.lockQuestion.trim() : undefined,
    lockAnswer: form.kind === "moments" && form.lockAnswer.trim() ? form.lockAnswer.trim() : undefined,
    graphName: form.graphName.trim() || undefined,
    graphAvatar: form.graphAvatar.trim() || undefined,
    graphEnabled: form.graphEnabled ? undefined : false,
    graphLinks: form.graphLinks,
  };
  const title = displayTitle(form);
  const label = form.kind === "posts" ? "文章" : "纪事";
  const isUpdate = oldPath === path;
  const message = `docs: ${isUpdate ? "更新" : "发布"}${label}《${title}》（via Snark Blog CMS）`;
  const content = `${buildFrontmatter(form.kind, fmProps)}\n${conv.text.replace(/^\n+/, "")}\n`;

  // 5. 提交
  const result = await ctx.client.putFile(path, content, message, confirm);

  // 旧路径文件删除（slug 更名或集合切换）
  let renamed = false;
  if (oldPath && oldPath !== path) {
    await ctx.client.deleteFile(
      oldPath,
      `docs: ${label}《${title}》路径变更，移除旧文件（via Snark Blog CMS）`,
      confirm,
    );
    renamed = true;
  }

  // 6. 写回笔记属性（笔记永远是源头：面板里改过的值与清空的字段都回写）
  const committedHash = await sha256Hex(content);
  await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm[BLOG_PATH_PROP] = path;
    fm[BLOG_HASH_PROP] = committedHash;
    fm.draft = form.draft;
    if (form.kind === "moments") fm.type = form.type;
    if (form.title.trim()) fm.title = form.title.trim();
    if (form.kind === "posts" && form.slug) fm.slug = form.slug;
    if (form.kind === "posts" && form.excerpt.trim()) fm.excerpt = form.excerpt.trim();
    fm.date = form.date;
    const setOrDel = (key: string, v: string | undefined) => {
      if (v) fm[key] = v;
      else delete fm[key];
    };
    setOrDel("heroImage", form.heroImage.trim() || undefined);
    setOrDel("bgm-src", form.bgmSrc.trim() || undefined);
    setOrDel("bgm-title", form.bgmTitle.trim() || undefined);
    setOrDel("graph-name", form.graphName.trim() || undefined);
    setOrDel("graph-avatar", form.graphAvatar.trim() || undefined);
    // lock 仅 moments 有意义；集合切回 posts 时清掉
    setOrDel("lock-question", form.kind === "moments" && form.lockQuestion.trim() ? form.lockQuestion.trim() : undefined);
    setOrDel("lock-answer", form.kind === "moments" && form.lockAnswer.trim() ? form.lockAnswer.trim() : undefined);
    if (form.tags.length) fm.tags = form.tags;
    else delete fm.tags;
    if (form.graphLinks.length) fm["graph-links"] = form.graphLinks;
    else delete fm["graph-links"];
    if (form.featured) fm.featured = true;
    else delete fm.featured;
    if (form.dropCap) delete fm.dropCap;
    else fm.dropCap = false;
    if (form.graphEnabled) delete fm["graph-enabled"];
    else fm["graph-enabled"] = false;
  });

  const warnings = [...uploadWarns, ...conv.warnings];
  return {
    path,
    created: result.created,
    commitUrl: result.commitUrl,
    warnings: renamed ? [...warnings, "已因 slug 更名删除旧文件"] : warnings,
  };
}

/** 撤回 / 恢复草稿：远端翻转 draft 字段并同步本地属性 */
export async function setDraft(
  ctx: PublishContext,
  file: TFile,
  draft: boolean,
  confirm: ConfirmFn,
): Promise<void> {
  const path = readNoteProps(ctx.app.metadataCache.getFileCache(file)?.frontmatter).blogPath;
  if (!path) throw new Error("该笔记尚未通过插件发布（缺 blog-path 属性）");
  const remote = await ctx.client.getContent(path);
  if (!remote) throw new Error(`远端不存在 ${path}（可能已被删除），请改用「删除远端」`);
  const title = readNoteProps(ctx.app.metadataCache.getFileCache(file)?.frontmatter).title ?? file.basename;
  const nextText = flipDraft(remote.text, draft);
  await ctx.client.putFile(
    path,
    nextText,
    `docs: ${title}${draft ? "转草稿" : "取消草稿"}（via Snark Blog CMS）`,
    confirm,
  );
  const nextHash = await sha256Hex(nextText);
  await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm.draft = draft;
    fm[BLOG_HASH_PROP] = nextHash;
  });
  successNotice(draft ? `《${title}》已转草稿` : `《${title}》已取消草稿`);
}

/** 收集文本中指向本图床桶的外链 URL（去重） */
function collectBucketUrls(text: string, cfg: R2Config): string[] {
  const escaped = cfg.publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}/[^\\s)\\]"'<>]+`, "g");
  return Array.from(new Set(text.match(re) ?? []));
}

/** 图床 URL → 对象键（构造键时是按段编码的，按段解码还原） */
function urlToKey(url: string, cfg: R2Config): string {
  const raw = url.slice(cfg.publicPrefix.length + 1);
  try {
    return raw.split("/").map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return raw;
  }
}

/** 删除远端文件（本地笔记保留，仅清掉 blog-path）；图床孤儿图片联动清理 */
export async function deleteRemote(ctx: PublishContext, file: TFile, confirm: ConfirmFn): Promise<void> {
  const props = readNoteProps(ctx.app.metadataCache.getFileCache(file)?.frontmatter);
  if (!props.blogPath) throw new Error("该笔记尚未通过插件发布（缺 blog-path 属性）");
  const title = props.title ?? file.basename;
  const label = props.blogPath.startsWith(`${ctx.settings.postsDir}/`) ? "文章" : "纪事";
  await ctx.client.deleteFile(props.blogPath, `docs: 移除${label}《${title}》（via Snark Blog CMS）`, confirm);
  await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    delete fm[BLOG_PATH_PROP];
  });
  successNotice(`已删除远端 ${props.blogPath}（本地笔记保留）`);

  // 联动清理图床：本文引用的图片 URL 中，剔除仍被其他笔记引用的，剩余的经确认后删除
  const cfg = r2Config(ctx.settings);
  if (!cfg) return;
  const noteText = await ctx.app.vault.read(file);
  const urls = collectBucketUrls(noteText, cfg);
  if (!urls.length) return;
  const referencedElsewhere = new Set<string>();
  for (const other of ctx.app.vault.getMarkdownFiles()) {
    if (other.path === file.path) continue;
    const text = await ctx.app.vault.read(other);
    for (const u of collectBucketUrls(text, cfg)) referencedElsewhere.add(u);
  }
  const orphans = urls.filter((u) => !referencedElsewhere.has(u));
  if (!orphans.length) return;
  const preview = orphans.slice(0, 3).map((u) => u.slice(cfg.publicPrefix.length + 1)).join("、");
  const ok = await confirm(
    `检测到 ${orphans.length} 张仅这篇文章引用的图床图片，也一并从 R2 删除？删除后不可恢复（其他端创建的内容无法检测引用）。\n${preview}${orphans.length > 3 ? "…" : ""}`,
  );
  if (!ok) return;
  let cleaned = 0;
  for (const url of orphans) {
    try {
      await deleteR2Object(cfg, urlToKey(url, cfg));
      cleaned++;
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
  }
  if (cleaned) successNotice(`已清理 ${cleaned}/${orphans.length} 张图床图片`);
}

/** 最近一次构建状态的一行说明 */
export function buildStatusLine(run: { status: string; conclusion: string | null } | null): string {
  if (!run) return "尚无构建记录";
  if (run.status === "queued" || run.status === "in_progress") return "构建进行中…";
  switch (run.conclusion) {
    case "success":
      return "构建成功 ✓";
    case "failure":
      return "构建失败 ✗";
    case "cancelled":
      return "已取消";
    case "skipped":
      return "已跳过";
    default:
      return `状态：${run.conclusion ?? run.status}`;
  }
}
