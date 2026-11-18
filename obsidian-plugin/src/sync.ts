import { App, TFile } from "obsidian";
import { noteFrontmatterFromFlat, parseFrontmatter, readNoteProps, remoteToNoteProperties } from "./frontmatter";
import { PublishContext } from "./publish";
import { BLOG_HASH_PROP, BLOG_PATH_PROP, sha256Hex } from "./utils";

export type SyncStatus = "remote-only" | "synced" | "remote-changed" | "remote-deleted";

export interface SyncEntry {
  path: string; // 仓库路径（remote-deleted 时是本地笔记记录的旧路径）
  kind: "posts" | "moments";
  title: string; // 展示名：优先远端/本地属性 title，退回文件名
  text: string; // 远端内容（remote-deleted 为空）
  local: TFile | null;
  status: SyncStatus;
}

export function kindOfPath(ctx: PublishContext, path: string): "posts" | "moments" {
  return path.startsWith(`${ctx.settings.postsDir}/`) ? "posts" : "moments";
}

function pathBase(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.mdx?$/, "");
}

/** 远端 posts/moments 全部文件路径 */
export function listRemoteContent(ctx: PublishContext): Promise<string[]> {
  return ctx.client.listTree([ctx.settings.postsDir, ctx.settings.momentsDir]);
}

/**
 * 构建同步清单：远端每个文件与本地（按 blog-path 关联）比对内容指纹，分四态。
 * onProgress(i, total) 用于进度提示。
 */
export async function buildSyncList(
  ctx: PublishContext,
  onProgress?: (done: number, total: number) => void,
): Promise<SyncEntry[]> {
  const remotePaths = await listRemoteContent(ctx);
  const localByPath = new Map<string, { file: TFile; hash: string | undefined; title: string }>();
  for (const file of ctx.app.vault.getMarkdownFiles()) {
    const cache = ctx.app.metadataCache.getFileCache(file);
    const raw = cache?.frontmatter as Record<string, unknown> | undefined;
    const blogPath = typeof raw?.[BLOG_PATH_PROP] === "string" ? (raw[BLOG_PATH_PROP] as string) : null;
    if (!blogPath) continue;
    localByPath.set(blogPath, {
      file,
      hash: typeof raw?.[BLOG_HASH_PROP] === "string" ? (raw[BLOG_HASH_PROP] as string) : undefined,
      title: readNoteProps(raw).title ?? file.basename,
    });
  }

  const entries: SyncEntry[] = [];
  const remoteSet = new Set<string>();
  let done = 0;
  for (const path of remotePaths) {
    remoteSet.add(path);
    const local = localByPath.get(path);
    let text = "";
    try {
      const remote = await ctx.client.getContent(path);
      text = remote?.text ?? "";
    } catch {
      text = "";
    }
    onProgress?.(++done, remotePaths.length);
    const kind = kindOfPath(ctx, path);
    if (!local) {
      const { fm } = text ? parseFrontmatter(text) : { fm: {} as Record<string, unknown> };
      entries.push({ path, kind, title: String(fm.title ?? "") || pathBase(path), text, local: null, status: "remote-only" });
      continue;
    }
    // 指纹比对：本地没有 blog-hash（旧版本发布的笔记）一律视为远端有更新，覆盖一次即补写指纹
    const remoteHash = text ? await sha256Hex(text) : null;
    const synced = local.hash !== undefined && remoteHash !== null && remoteHash === local.hash;
    entries.push({
      path,
      kind,
      title: local.title,
      text,
      local: local.file,
      status: synced ? "synced" : "remote-changed",
    });
  }

  // 远端已删除但本地仍挂着映射的笔记
  for (const [path, local] of localByPath) {
    if (!remoteSet.has(path)) {
      entries.push({ path, kind: kindOfPath(ctx, path), title: local.title, text: "", local: local.file, status: "remote-deleted" });
    }
  }

  entries.sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === "posts" ? -1 : 1));
  return entries;
}

function folderPath(syncFolder: string): string {
  return syncFolder.trim().replace(/^\/+|\/+$/g, "");
}

/** 找一个不冲突的笔记路径：同名文件若已挂在本路径映射上则直接复用，否则加 -2、-3… */
async function availableNotePath(app: App, dir: string, name: string, repoPath: string): Promise<string> {
  const prefix = dir ? `${dir}/` : "";
  let candidate = `${prefix}${name}.md`;
  for (let n = 2; ; n++) {
    const existing = app.vault.getAbstractFileByPath(candidate);
    if (!existing) return candidate;
    if (existing instanceof TFile) {
      const raw = app.metadataCache.getFileCache(existing)?.frontmatter as Record<string, unknown> | undefined;
      if (raw?.[BLOG_PATH_PROP] === repoPath) return candidate; // 就是它的旧映射，覆盖
    }
    candidate = `${prefix}${name}-${n}.md`;
  }
}

/**
 * 把远端文件下载为 vault 笔记（或覆盖已有笔记）：
 * 嵌套 YAML 逆向展平成 Obsidian 属性，记录 blog-path 与 blog-hash，正文原样保留。
 */
export async function pullIntoVault(ctx: PublishContext, entry: SyncEntry): Promise<TFile> {
  const text = entry.text || (await ctx.client.getContent(entry.path))?.text || "";
  if (!text) throw new Error(`远端内容为空：${entry.path}`);
  const { fm, body } = parseFrontmatter(text);
  const props = remoteToNoteProperties(fm);
  props[BLOG_PATH_PROP] = entry.path;
  props[BLOG_HASH_PROP] = await sha256Hex(text);
  const noteText = `${noteFrontmatterFromFlat(props)}\n${body.replace(/^\r?\n+/, "")}\n`;

  if (entry.local) {
    await ctx.app.vault.process(entry.local, () => noteText);
    return entry.local;
  }

  const base = folderPath(ctx.settings.syncFolder);
  // 文章与纪事分开放（博客/文章、博客/纪事），并按笔记日期细分为月份子文件夹：
  // 博客/文章/2026-11/xxx.md（无日期的回退平铺，不加月份）
  const kindDir = entry.kind === "posts" ? "文章" : "纪事";
  const noteDate = typeof props.date === "string" ? props.date : undefined;
  const month = noteDate?.match(/^(\d{4}-\d{2})/)?.[1];
  const dir = [base, kindDir, month].filter(Boolean).join("/");
  if (!ctx.app.vault.getAbstractFileByPath(dir)) {
    try {
      await ctx.app.vault.createFolder(dir);
    } catch {
      // 已存在（并发/缓存），忽略
    }
  }
  const fullPath = await availableNotePath(ctx.app, dir, pathBase(entry.path), entry.path);
  const file = await ctx.app.vault.create(fullPath, noteText);
  return file;
}

/** 远端已删除的文件：清掉本地笔记的 blog-path / blog-hash 映射（笔记内容保留） */
export async function clearMapping(ctx: PublishContext, file: TFile): Promise<void> {
  await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    delete fm[BLOG_PATH_PROP];
    delete fm[BLOG_HASH_PROP];
  });
}
