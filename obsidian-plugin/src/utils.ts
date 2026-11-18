import { Notice } from "obsidian";

/** 与仓库 .pages.yml 的 slug 校验规则保持一致 */
export const SLUG_RE = /^[a-z0-9-]+$/;

/** 笔记属性里记录仓库路径的属性名（发布后写回，作为更新/撤回的锚点） */
export const BLOG_PATH_PROP = "blog-path";

/** 笔记属性里记录上次同步/发布内容指纹的属性名（同步时识别远端是否被其他端改过） */
export const BLOG_HASH_PROP = "blog-hash";

/** 笔记属性里记录本篇曾上传到 R2 的对象 key 列表（单篇清理未引用图片的依据） */
export const BLOG_IMAGES_PROP = "blog-images";

/** vault 内同步目录的固定分层名（与 sync.ts 的目录拼装保持一致） */
export const POSTS_DIR_NAME = "文章";
export const MOMENTS_DIR_NAME = "纪事";

/**
 * 按笔记在 vault 里的位置推断集合：syncFolder/文章/ → posts，syncFolder/纪事/ → moments。
 * 不在这两个目录下（如根目录散笔记）返回 null，由调用方决定默认值。
 */
export function kindFromVaultPath(
  path: string,
  syncFolder: string,
): "posts" | "moments" | null {
  const base = syncFolder.trim().replace(/^\/+|\/+$/g, "");
  const p = path.replace(/\\/g, "/");
  const under = (seg: string) =>
    p.includes(`/${seg}/`) && (!base || p.includes(`/${base}/${seg}/`));
  if (under(POSTS_DIR_NAME)) return "posts";
  if (under(MOMENTS_DIR_NAME)) return "moments";
  return null;
}

/** SHA-256 hex（crypto.subtle 在 Obsidian 渲染进程可用） */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 归一化各种可能的日期输入（字符串/时间戳）为 YYYY-MM-DD；无法解析返回 null */
export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) return fmtDate(value);
  if (typeof value === "number" && isFinite(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : fmtDate(d);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    // 纯 YYYY-MM-DD 直接放行（含日期时间截断）
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : fmtDate(d);
  }
  return null;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 供 moment-YYYY-MM-DD-HHmm 这类文件名用 */
export function hhmm(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** UTF-8 安全的 base64（GitHub Contents API 要求） */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function notice(msg: string, timeout = 6000): void {
  new Notice(msg, timeout);
}

export function errorNotice(msg: string, timeout = 10000): void {
  new Notice(`✗ ${msg}`, timeout);
}

export function successNotice(msg: string, timeout = 8000): void {
  new Notice(`✓ ${msg}`, timeout);
}

/** 取正文第一个非空段落作为摘要预填（剥掉 markdown 记号后截断） */
export function firstParagraph(body: string, max = 90): string {
  const lines = body.split(/\r?\n/);
  let buf: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (buf.length) break;
      continue;
    }
    if (/^#/.test(t) || /^>/.test(t) || /^[-*+]\s/.test(t) || /^```/.test(t)) {
      if (buf.length) break;
      continue;
    }
    buf.push(t);
  }
  const text = buf.join(" ").replace(/[*_`~[\]]/g, "").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 简单的模态框按钮生成 */
export function htmlTag<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
