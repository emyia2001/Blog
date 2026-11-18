import { BLOG_PATH_PROP, normalizeDate } from "./utils";

/** 纪事类型，与 content.config.ts 的枚举一致 */
export type MomentType = "person" | "event" | "diary";

export const MOMENT_TYPES: { value: MomentType; label: string }[] = [
  { value: "person", label: "人物" },
  { value: "event", label: "事件" },
  { value: "diary", label: "日记" },
];

/** 从 Obsidian 笔记属性归一化出的全部可映射字段 */
export interface NoteProps {
  title?: string;
  date?: string; // YYYY-MM-DD
  excerpt?: string;
  slug?: string;
  tags: string[];
  heroImage?: string;
  draft?: boolean;
  featured?: boolean;
  dropCap?: boolean; // undefined = 属性未设置（站点默认 true）
  type?: MomentType;
  bgmSrc?: string;
  bgmTitle?: string;
  lockQuestion?: string;
  lockAnswer?: string;
  graphName?: string;
  graphAvatar?: string;
  graphEnabled?: boolean; // undefined = 未设置（站点默认 true）
  graphLinks: string[];
  blogPath?: string; // 插件写回的仓库路径
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const s = v.trim();
    return s || undefined;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** Obsidian 列表属性是 string[]；也兜底逗号分隔字符串 */
function list(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "string" ? x.trim() : String(x).trim())).filter(Boolean);
  }
  if (typeof v === "string") {
    return v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Obsidian frontmatter（metadataCache 缓存值）→ NoteProps */
export function readNoteProps(raw: Record<string, unknown> | undefined | null): NoteProps {
  const fm = raw ?? {};
  const type = str(fm.type);
  return {
    title: str(fm.title),
    date: normalizeDate(fm.date) ?? undefined,
    excerpt: str(fm.excerpt),
    slug: str(fm.slug),
    tags: list(fm.tags),
    heroImage: str(fm.heroImage),
    draft: bool(fm.draft),
    featured: bool(fm.featured),
    dropCap: bool(fm.dropCap),
    type: type === "person" || type === "event" || type === "diary" ? type : undefined,
    bgmSrc: str(fm["bgm-src"]),
    bgmTitle: str(fm["bgm-title"]),
    lockQuestion: str(fm["lock-question"]),
    lockAnswer: str(fm["lock-answer"]),
    graphName: str(fm["graph-name"]),
    graphAvatar: str(fm["graph-avatar"]),
    graphEnabled: bool(fm["graph-enabled"]),
    graphLinks: list(fm["graph-links"]),
    blogPath: str(fm[BLOG_PATH_PROP]),
  };
}

// ---------- YAML 序列化（面向本仓库 schema 的受控子集） ----------

function yamlStr(s: string): string {
  return `"${s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n")
    .replace(/\t/g, "\\t")}"`;
}

interface Entry {
  key: string;
  lines: string[];
}

function scalar(key: string, value: string | number | boolean, raw = false): Entry {
  const v = raw ? String(value) : typeof value === "string" ? yamlStr(value) : String(value);
  return { key, lines: [`${key}: ${v}`] };
}

function blockList(key: string, items: string[]): Entry {
  const lines = [`${key}:`];
  for (const it of items) lines.push(`  - ${yamlStr(it)}`);
  return { key, lines };
}

/**
 * 生成符合 content.config.ts schema 的 frontmatter（含首尾 ---）。
 * 与站点默认值一致的字段不写（featured/dropCap 默认 true、graph.enabled 默认 true），
 * draft 恒写，方便撤回时原地翻转。
 */
export function buildFrontmatter(kind: "posts" | "moments", p: NoteProps): string {
  const tags = p.tags ?? [];
  const graphLinks = p.graphLinks ?? [];
  const entries: Entry[] = [];

  if (kind === "posts") {
    entries.push(scalar("title", p.title ?? ""));
  } else if (p.title) {
    entries.push(scalar("title", p.title));
  }
  entries.push(scalar("date", p.date ?? "", true)); // YAML 裸 ISO 日期 → z.date()
  if (kind === "moments") entries.push(scalar("type", p.type ?? "event"));
  // excerpt 仅 posts（纪事 schema 已去掉摘要字段）
  if (kind === "posts") entries.push(scalar("excerpt", p.excerpt ?? ""));
  if (kind === "posts") entries.push(scalar("slug", p.slug ?? ""));
  // tags 两集合通用（纪事的自由标签展示在 feed 右上角；posts 为文章标签）
  if (tags.length) entries.push(blockList("tags", tags));
  if (p.heroImage) entries.push(scalar("heroImage", p.heroImage));
  entries.push(scalar("draft", p.draft ?? false));
  if (p.featured === true) entries.push(scalar("featured", true));
  if (p.dropCap === false) entries.push(scalar("dropCap", false));
  if (p.bgmSrc) {
    entries.push({
      key: "bgm",
      lines: [
        `bgm:`,
        `  src: ${yamlStr(p.bgmSrc)}`,
        ...(p.bgmTitle ? [`  title: ${yamlStr(p.bgmTitle)}`] : []),
      ],
    });
  }
  if (p.lockQuestion && p.lockAnswer) {
    entries.push({
      key: "lock",
      lines: [`lock:`, `  question: ${yamlStr(p.lockQuestion)}`, `  answer: ${yamlStr(p.lockAnswer)}`],
    });
  }
  const hasGraph = p.graphName || p.graphAvatar || p.graphEnabled === false || graphLinks.length > 0;
  if (hasGraph) {
    entries.push({
      key: "graph",
      lines: [
        `graph:`,
        ...(p.graphName ? [`  name: ${yamlStr(p.graphName)}`] : []),
        ...(p.graphAvatar ? [`  avatar: ${yamlStr(p.graphAvatar)}`] : []),
        ...(p.graphEnabled === false ? [`  enabled: false`] : []),
        ...(graphLinks.length ? [`  links:`, ...graphLinks.map((l) => `    - ${yamlStr(l)}`)] : []),
      ],
    });
  }

  const flat = entries.flatMap((e) => e.lines).join("\n");
  return `---\n${flat}\n---\n`;
}

/**
 * 远端文件正文 draft 翻转（撤回/恢复草稿用，不做完整 YAML 解析）：
 * 有顶层 draft 行则替换，否则插入到 frontmatter 开头。
 */
export function flipDraft(fileText: string, to: boolean): string {
  const m = fileText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return fileText; // 无 frontmatter（理论上不会发生），原样返回
  const block = m[1];
  const next = to ? "true" : "false";
  let updated = block.replace(/^draft:\s*(?:true|false)\s*$/m, `draft: ${next}`);
  if (updated === block && !/^draft:/m.test(block)) {
    updated = `draft: ${next}\n${block}`;
  }
  return fileText.replace(m[0], `---\n${updated}\n---`);
}

/** 直接读文件全文时剥掉 frontmatter，取正文（属性一律走 metadataCache） */
export function stripFrontmatter(text: string): string {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return m ? text.slice(m[0].length).replace(/^\r?\n+/, "") : text;
}

// ---------- 远端文件 → 笔记：受控子集的 YAML 解析与逆向展平 ----------

function yamlUnquote(s: string): string {
  const inner = s.slice(1, -1);
  if (s.startsWith("'")) return inner.replace(/''/g, "'");
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => String(parseScalar(x)))
      .filter((x) => x !== "");
  }
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return yamlUnquote(s);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function leadingSpaces(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/** 解析从 lines[i] 开始、固定缩进 indent 的块（对象或列表）；返回值与下一行索引 */
function parseBlock(lines: string[], i: number, indent: number): { value: unknown; i: number } {
  if (/^\s*-\s/.test(lines[i] ?? "")) {
    const items: unknown[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      if (leadingSpaces(line) !== indent || !/^\s*-\s/.test(line)) break;
      items.push(parseScalar(line.replace(/^(\s*-\s)+/, "")));
      i++;
    }
    return { value: items, i };
  }
  const obj: Record<string, unknown> = {};
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const ind = leadingSpaces(line);
    if (ind !== indent) break;
    const m = line.trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (rest === "") {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && leadingSpaces(next) > ind) {
        const sub = parseBlock(lines, i + 1, leadingSpaces(next));
        obj[key] = sub.value;
        i = sub.i;
      } else {
        obj[key] = "";
        i++;
      }
    } else {
      obj[key] = parseScalar(rest);
      i++;
    }
  }
  return { value: obj, i };
}

/** 解析本仓库格式的 frontmatter（含 Pages CMS / 手写变体）；正文一并返回 */
export function parseFrontmatter(text: string): { fm: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { fm: {}, body: text };
  const block = parseBlock(m[1].split(/\r?\n/), 0, 0);
  return { fm: (block.value as Record<string, unknown>) ?? {}, body: text.slice(m[0].length) };
}

/** 远端嵌套 frontmatter → Obsidian 扁平属性（bgm/lock/graph 展开成 bgm-src 等） */
export function remoteToNoteProperties(fm: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const copy = (key: string) => {
    if (fm[key] !== undefined && fm[key] !== null && fm[key] !== "") out[key] = fm[key];
  };
  copy("title");
  copy("date");
  copy("type");
  copy("excerpt");
  copy("slug");
  if (Array.isArray(fm.tags) && fm.tags.length) out.tags = fm.tags;
  copy("heroImage");
  out.draft = typeof fm.draft === "boolean" ? fm.draft : false;
  if (fm.featured === true) out.featured = true;
  if (fm.dropCap === false) out.dropCap = false;
  const bgm = fm.bgm;
  if (bgm && typeof bgm === "object") {
    const b = bgm as Record<string, unknown>;
    if (b.src) out["bgm-src"] = String(b.src);
    if (b.title) out["bgm-title"] = String(b.title);
  }
  const lock = fm.lock;
  if (lock && typeof lock === "object") {
    const l = lock as Record<string, unknown>;
    if (l.question) out["lock-question"] = String(l.question);
    if (l.answer) out["lock-answer"] = String(l.answer);
  }
  const graph = fm.graph;
  if (graph && typeof graph === "object") {
    const g = graph as Record<string, unknown>;
    if (g.name) out["graph-name"] = String(g.name);
    if (g.avatar) out["graph-avatar"] = String(g.avatar);
    if (g.enabled === false) out["graph-enabled"] = false;
    if (Array.isArray(g.links) && g.links.length) out["graph-links"] = g.links.map(String);
  }
  return out;
}

const NOTE_PROP_ORDER = [
  "title",
  "date",
  "type",
  "excerpt",
  "slug",
  "tags",
  "heroImage",
  "draft",
  "featured",
  "dropCap",
  "bgm-src",
  "bgm-title",
  "lock-question",
  "lock-answer",
  "graph-name",
  "graph-avatar",
  "graph-enabled",
  "graph-links",
];

/** 扁平属性 → 笔记文件的 frontmatter 文本（属性面板友好） */
export function noteFrontmatterFromFlat(props: Record<string, unknown>): string {
  const keys = [
    ...NOTE_PROP_ORDER.filter((k) => k in props),
    ...Object.keys(props).filter((k) => !NOTE_PROP_ORDER.includes(k)),
  ];
  const lines: string[] = [];
  for (const k of keys) {
    const v = props[k];
    if (Array.isArray(v)) {
      if (!v.length) continue;
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlStr(String(item))}`);
    } else if (typeof v === "boolean" || typeof v === "number") {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${yamlStr(String(v))}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n`;
}
