/**
 * 笔记正文 → 站点 MDX 正文转换与风险检测（纯函数，不碰 app）。
 *
 * 规则（与仓库约定一致）：
 * - `[[笔记名]]` / `[[笔记名|别名]]`：目标在 linkMap 里 → 转成站内链接 `/blog/<slug>/`（正好喂图谱连线）；
 *   匹配不到 → 原样保留并警告（站点会把方括号文字原样显示）。
 * - `![[附件]]`：阻断发布（图片只走外链图床），报行号。
 * - `%%…%%` Obsidian 注释：移除并提示。
 * - 正文裸 HTML `<tag>`：启发式警告（MDX 对非标准 JSX 的 HTML 敏感，可能构建失败）。
 * - markdown 图片指向本地路径：警告（仓库不上传图片，须用图床外链）。
 * - 代码块（``` / ~~~）内的一律不处理。
 */

export type LinkMap = Map<string, string>; // 小写别名/标题/slug → 目标文章 slug

export interface ConvertResult {
  text: string;
  warnings: string[];
  errors: string[];
}

interface Chunk {
  startLine: number; // 0 起
  startOffset: number; // 在全文中的字符偏移
  text: string;
}

function lineOffsets(body: string): number[] {
  const offs: number[] = [];
  let pos = 0;
  for (const _ of body.split(/\r?\n/)) {
    offs.push(pos);
    const nl = body.indexOf("\n", pos);
    pos = nl === -1 ? body.length : nl + 1;
  }
  return offs;
}

/** 把不在围栏代码块里的文本段拆出来，带全文行号与字符偏移 */
function outsideFenceChunks(body: string): Chunk[] {
  const lines = body.split(/\r?\n/);
  const offs = lineOffsets(body);
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let bufStartLine = 0;
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) {
        if (buf.length) chunks.push({ startLine: bufStartLine, startOffset: offs[bufStartLine], text: buf.join("\n") });
        buf = [];
        fence = fenceMatch[1];
        continue;
      }
      if (line.trim().startsWith(fence)) {
        fence = null;
        continue;
      }
    }
    if (fence) continue;
    if (!buf.length) bufStartLine = i;
    buf.push(line);
  }
  if (buf.length) chunks.push({ startLine: bufStartLine, startOffset: offs[bufStartLine], text: buf.join("\n") });
  return chunks;
}

export function convertBody(body: string, linkMap: LinkMap): ConvertResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  type Edit = { from: number; to: number; replacement: string };
  const edits: Edit[] = [];
  const commentRanges: { from: number; to: number }[] = [];
  const chunks = outsideFenceChunks(body);

  // 行内代码 `…` 内的一切都不处理（与围栏同等对待）
  const codeRanges: { from: number; to: number }[] = [];
  for (const chunk of chunks) {
    const lines = chunk.text.split("\n");
    let lineOffset = 0;
    for (const line of lines) {
      const re = /`[^`\n]*`/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const from = chunk.startOffset + lineOffset + m.index;
        codeRanges.push({ from, to: from + m[0].length });
      }
      lineOffset += line.length + 1;
    }
  }
  const isProtected = (from: number): boolean =>
    commentRanges.some((r) => from >= r.from && from < r.to) ||
    codeRanges.some((r) => from >= r.from && from < r.to);

  // 1. 移除 %%注释%%
  for (const chunk of chunks) {
    const re = /%%[\s\S]*?%%/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk.text))) {
      const from = chunk.startOffset + m.index;
      if (isProtected(from)) continue;
      commentRanges.push({ from, to: from + m[0].length });
      const line = chunk.startLine + chunk.text.slice(0, m.index).split("\n").length;
      if (!warnings.some((w) => w.includes("注释"))) {
        warnings.push(`已移除 Obsidian 注释 %%…%%（第 ${line} 行起）`);
      }
    }
  }
  edits.push(...commentRanges.map((r) => ({ from: r.from, to: r.to, replacement: "" })));

  // 2. wiki 语法：![[嵌入]] 报错；[[链接]] 转换或警告
  for (const chunk of chunks) {
    const re = /(!?)\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk.text))) {
      const from = chunk.startOffset + m.index;
      if (isProtected(from)) continue;
      const line = chunk.startLine + chunk.text.slice(0, m.index).split("\n").length;
      const isEmbed = m[1] === "!";
      if (isEmbed) {
        errors.push(`第 ${line} 行：![[${m[2].trim()}]] 是本地附件嵌入，本站图片需用图床外链（如 ![描述](https://img.snarkm.com/…)）`);
        continue;
      }
      const rawTarget = m[2].trim();
      const base = rawTarget.split("#")[0].trim();
      const alias = (m[3] ?? "").trim() || base;
      if (!base) continue;
      const slug = linkMap.get(base.toLowerCase());
      if (slug) {
        const label = alias.replace(/[\[\]]/g, "");
        edits.push({ from, to: from + m[0].length, replacement: `[${label}](/blog/${slug}/)` });
      } else if (!rawTarget.includes("#")) {
        warnings.push(`第 ${line} 行：[[${base}]] 匹配不到已发布文章，将原样显示方括号文字（在笔记属性补 slug 后可自动转为站内链接）`);
      }
    }
  }

  // 3. markdown 图片的本地路径警告
  for (const chunk of chunks) {
    const re = /!\[[^\]]*\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk.text))) {
      const from = chunk.startOffset + m.index;
      if (isProtected(from)) continue;
      const src = m[1].trim();
      if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) continue;
      const line = chunk.startLine + chunk.text.slice(0, m.index).split("\n").length;
      warnings.push(`第 ${line} 行：图片 ${src} 不是外链，仓库不会上传它——请先传图床再改用 https 外链`);
    }
  }

  // 4. 裸 HTML 启发式警告（剥掉行内代码后检测 <字母）
  const htmlLines: number[] = [];
  for (const chunk of chunks) {
    const lines = chunk.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const absFrom = chunk.startOffset + lines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
      if (isProtected(absFrom)) continue;
      const stripped = lines[i].replace(/`[^`]*`/g, "");
      if (/^<(https?:|mailto:)/i.test(stripped.trim())) continue;
      if (/<[a-zA-Z][a-zA-Z0-9]*(\s|>)/.test(stripped)) {
        htmlLines.push(chunk.startLine + i + 1);
      }
    }
  }
  if (htmlLines.length) {
    warnings.push(
      `正文包含裸 HTML 标签（第 ${htmlLines.slice(0, 5).join("、")}${htmlLines.length > 5 ? "…" : ""} 行）：MDX 对其敏感，可能构建失败，建议改用 Markdown 语法`,
    );
  }

  // 应用替换（按位置倒序，避免偏移失效）
  edits.sort((a, b) => b.from - a.from);
  let text = body;
  for (const e of edits) {
    text = text.slice(0, e.from) + e.replacement + text.slice(e.to);
  }

  return { text, warnings, errors };
}

/** 收集一篇笔记的 [[别名]] → slug 映射项（publish.ts 负责从 vault 汇总后调用） */
export function addToLinkMap(
  map: LinkMap,
  entries: { aliases: string[]; slug?: string },
): void {
  const slug = entries.slug;
  if (!slug) return;
  for (const alias of entries.aliases) {
    const key = alias.toLowerCase().trim();
    if (key && !map.has(key)) map.set(key, slug);
  }
  if (!map.has(slug.toLowerCase())) map.set(slug.toLowerCase(), slug);
}
