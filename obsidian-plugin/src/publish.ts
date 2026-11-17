import { App, TFile } from "obsidian";
import { GitHubClient } from "./github";
import type { SnarkSettings } from "./settings";
import { MomentType, NoteProps, buildFrontmatter, flipDraft, readNoteProps, stripFrontmatter } from "./frontmatter";
import { LinkMap, addToLinkMap, convertBody } from "./converter";
import { r2Config, R2Config, deleteR2Object, uploadImageToR2 } from "./r2";
import { BLOG_HASH_PROP, BLOG_IMAGES_PROP, BLOG_PATH_PROP, SLUG_RE, hhmm, sha256Hex, errorNotice, successNotice } from "./utils";

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
): Promise<{
  body: string;
  count: number;
  /** 本次新上传的对象 key（写回 blog-images 属性，供单篇清理） */
  keys: string[];
  /** 设置开启时已移入回收站的本地图片数 */
  deleted: number;
  /** 仍被其他笔记引用而保留的图片数 */
  keptByRef: number;
  warns: string[];
}> {
  const embedRe = /!\[\[([^\[\]]+)\]\]/g;
  const targets = new Map<string, string>(); // 附件链接路径 → 上传后的公网 URL
  const fileMap = new Map<string, TFile>(); // 附件链接路径 → vault 内文件（删除用）
  const keys: string[] = []; // 本次上传的对象 key（写回 blog-images 属性）
  for (const m of body.matchAll(embedRe)) {
    const base = m[1].split("|")[0].trim(); // 去掉 |宽高 提示
    if (!base || targets.has(base)) continue;
    const dest = ctx.app.metadataCache.getFirstLinkpathDest(base, file.path);
    if (!dest) throw new Error(`附件「${base}」在 vault 中不存在，无法上传 R2（请先确认文件还在）`);
    const bytes = new Uint8Array(await ctx.app.vault.readBinary(dest));
    const ext = dest.extension.toLowerCase().replace("jpeg", "jpg");
    const url = await uploadImageToR2(bytes, ext, cfg);
    targets.set(base, url);
    keys.push(url.slice(cfg.publicPrefix.length + 1));
    fileMap.set(base, dest);
  }
  if (!targets.size) return { body, count: 0, keys: [], deleted: 0, keptByRef: 0, warns: [] };

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

  // 可选：上传成功并回填外链后，把本地附件移入 Obsidian 回收站（.trash，可恢复）。
  // 保护规则：仍被其他笔记引用的附件保留本地（避免删掉别人的图）；
  // 本篇笔记刚回填完外链、已不再引用它们，故排除自身。
  const warns: string[] = [];
  let deleted = 0;
  let keptByRef = 0;
  if (ctx.settings.r2DeleteLocal) {
    const resolved = ctx.app.metadataCache.resolvedLinks;
    for (const [base, dest] of fileMap) {
      const usedElsewhere = Object.entries(resolved).some(
        ([src, links]) =>
          src !== file.path && !!links && dest.path in (links as Record<string, number>),
      );
      if (usedElsewhere) {
        keptByRef++;
        continue;
      }
      try {
        await ctx.app.vault.trash(dest, false);
        deleted++;
      } catch (err) {
        warns.push(`本地图片「${base}」移入回收站失败：${String((err as Error).message ?? err)}`);
      }
    }
  }
  return { body: newBody, count: targets.size, keys, deleted, keptByRef, warns };
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
  let upKeys: string[] = [];
  let body = stripFrontmatter(noteText);
  if (r2cfg) {
    const up = await uploadNoteEmbeds(ctx, r2cfg, file, body);
    body = up.body;
    upKeys = up.keys;
    if (up.count) uploadWarns.push(`已上传 ${up.count} 张图片到 R2 并回填外链到笔记`);
    if (up.deleted) uploadWarns.push(`已把 ${up.deleted} 张本地图片移入 Obsidian 回收站`);
    if (up.keptByRef) uploadWarns.push(`${up.keptByRef} 张本地图片仍被其他笔记引用，未删除`);
    uploadWarns.push(...up.warns);
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
    // 记录本篇曾上传到 R2 的对象 key（单篇清理未引用图片的依据；去重合并）
    if (upKeys.length) {
      const prev = Array.isArray(fm[BLOG_IMAGES_PROP])
        ? (fm[BLOG_IMAGES_PROP] as unknown[]).map(String)
        : [];
      fm[BLOG_IMAGES_PROP] = [...new Set([...prev, ...upKeys])];
    }
  });

  const warnings = [...uploadWarns, ...conv.warnings];
  return {
    path,
    created: result.created,
    commitUrl: result.commitUrl,
    warnings: renamed ? [...warnings, "已因 slug 更名删除旧文件"] : warnings,
  };
}

/**
 * 单篇清理：删除「本篇曾上传到 R2、但现在本地笔记与远端正文都不再引用」的图片。
 * 依据是笔记属性 blog-images（发布时记录的上传 key 列表）；引用比对取
 * 本地笔记全文 + 远端已发布正文两份（本地可能还没重新发布）。
 * 返回可直接展示的中文结果说明。
 */
export async function cleanupNoteImages(
  ctx: PublishContext,
  file: TFile,
  confirm: ConfirmFn,
): Promise<string> {
  const cfg = r2Config(ctx.settings);
  if (!cfg) throw new Error("未配置 R2，无需清理");

  const cache = ctx.app.metadataCache.getFileCache(file);
  const fmRaw = (cache?.frontmatter ?? {}) as Record<string, unknown>;
  const keys = Array.isArray(fmRaw[BLOG_IMAGES_PROP])
    ? (fmRaw[BLOG_IMAGES_PROP] as unknown[]).map(String)
    : [];
  if (!keys.length) {
    throw new Error(
      "本文没有 R2 上传记录（blog-images 属性为空——1.4.0 之前发布的笔记没有这个属性）。请改用图床图片管理弹窗里的「清理未引用图片」做全桶清理。",
    );
  }

  // 引用比对：本地全文 + 远端已发布正文，二者任一包含 key 即视为在用
  const localText = await ctx.app.vault.read(file);
  const props = readNoteProps(cache?.frontmatter);
  let remoteText = "";
  if (props.blogPath) {
    const remote = await ctx.client.getContent(props.blogPath);
    if (remote) remoteText = remote.text;
  }
  const unused = keys.filter(
    (key) => !localText.includes(key) && !remoteText.includes(key),
  );
  if (!unused.length) {
    return "本文上传过的图片全部仍被引用，没有可清理的。";
  }

  const ok = await confirm(
    `删除 ${unused.length} 张本文不再引用的图片？\n${unused.join("\n")}\n\n删除后不可恢复（本地与远端正文均已不引用它们）。`,
  );
  if (!ok) return "已取消：未删除任何图片";

  let done = 0;
  const failed: string[] = [];
  for (const key of unused) {
    try {
      await deleteR2Object(cfg, key);
      done++;
    } catch (e) {
      failed.push(`${key}：${String((e as Error).message ?? e)}`);
    }
  }

  // 成功删除的从 blog-images 里移除；失败的保留以便下次重试
  const failedSet = new Set(failedKeys(unused, failed));
  await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    const prev = Array.isArray(fm[BLOG_IMAGES_PROP])
      ? (fm[BLOG_IMAGES_PROP] as unknown[]).map(String)
      : keys;
    const next = prev.filter((k) => !unused.includes(k) || failedSet.has(k));
    if (next.length) fm[BLOG_IMAGES_PROP] = next;
    else delete fm[BLOG_IMAGES_PROP];
  });

  if (failed.length) {
    throw new Error(`已删 ${done} 张，失败 ${failed.length} 张：\n${failed.join("\n")}`);
  }
  return `已清理 ${done} 张本文不再引用的图片`;
}

/** 从失败信息行里还原失败的 key（failed 每行以「key：原因」开头） */
function failedKeys(all: string[], failedLines: string[]): string[] {
  const lines = new Set(failedLines);
  return all.filter((k) => [...lines].some((l) => l.startsWith(`${k}：`)));
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
