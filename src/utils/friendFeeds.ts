import { XMLParser } from "fast-xml-parser";
import type { FriendLink } from "../data/friends";

// 友链 RSS/Atom 取数（构建时执行，烤进友链页「友链文章」板块）。
// 与 contributions.ts 同一套纪律：带超时、逐级回退、任何失败只 warn 不挂构建——
// 友链站点挂了或没 feed，顶多这个站不展示，页面照常出。

/** 每个友链站点最多展示的文章数：列表是给人扫一眼的，堆太多反而糊 */
const POST_LIMIT = 5;
/** 构建期单次请求超时（feed 站点偶发挂起，别把构建拖死） */
const REQUEST_TIMEOUT_MS = 5_000;
/** 摘要截断长度 */
const EXCERPT_MAX = 140;
/** feed 地址留空时的常见路径探测（按序尝试，第一个解析成功的胜出） */
const PROBE_PATHS = ["rss.xml", "feed.xml", "atom.xml", "feed/", "index.xml"];

export interface FriendFeedPost {
  title: string;
  url: string;
  /** ISO 日期，解析不出就留空（排序时沉底） */
  date?: string;
  excerpt?: string;
}

export interface FriendFeed {
  /** 图谱节点 id（friend-<host>，稳定可复现） */
  id: string;
  /** 站点名（取 friends.ts 里的 name，不信任 feed 标题） */
  name: string;
  /** 站点主页 */
  url: string;
  avatar?: string;
  /** 命中的 feed 地址（调试用，不进页面 JSON） */
  feedUrl: string;
  /** 最新文章，按日期降序，最多 POST_LIMIT 篇 */
  posts: FriendFeedPost[];
}

// dev 模式下归档页每请求都重新构建，模块级缓存 10 分钟免得反复抓；
// 生产构建进程短命，这个缓存等价于「整个构建只抓一轮」
let cache: { at: number; feeds: FriendFeed[] } | null = null;
const CACHE_TTL_MS = 10 * 60_000;

export async function fetchFriendFeeds(
  friends: FriendLink[]
): Promise<FriendFeed[]> {
  if (friends.length === 0) return [];
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.feeds;

  const settled = await Promise.allSettled(friends.map(fetchFriendFeed));
  const feeds: FriendFeed[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value) feeds.push(r.value);
    } else {
      console.warn(`[friend-feeds] 「${friends[i].name}」取数失败：`, r.reason);
    }
  });

  cache = { at: Date.now(), feeds };
  return feeds;
}

/** 单个友链：发现 feed → 解析 → 出结果。彻底失败返回 null（不入图）。 */
async function fetchFriendFeed(friend: FriendLink): Promise<FriendFeed | null> {
  const feedUrl = await discoverFeed(friend);
  if (!feedUrl) {
    console.warn(`[friend-feeds] 「${friend.name}」没找到可用 feed，不入图`);
    return null;
  }

  const xml = await fetchText(feedUrl);
  if (!xml) return null;

  const parsed = parseFeed(xml);
  if (parsed.posts.length === 0) {
    console.warn(`[friend-feeds] 「${friend.name}」feed(${feedUrl}) 没解析出文章`);
    return null;
  }

  const host = new URL(friend.url).hostname;
  return {
    id: `friend-${host.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`,
    name: friend.name,
    url: friend.url,
    avatar: friend.avatar,
    feedUrl,
    posts: parsed.posts.slice(0, POST_LIMIT),
  };
}

/** feed 地址发现：显式 rss 优先；否则抓主页读 <link rel="alternate">，再退常见路径 */
async function discoverFeed(friend: FriendLink): Promise<string | null> {
  if (friend.rss) return friend.rss;

  const base = friend.url.endsWith("/") ? friend.url : `${friend.url}/`;
  const candidates: string[] = [];

  // 主页 HTML 自动发现（一次请求，命中对方真实 feed 地址，比猜路径可靠）
  try {
    const html = await fetchText(base);
    if (html) {
      for (const m of html.matchAll(
        /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi
      )) {
        const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
        if (href) candidates.push(new URL(href, base).toString());
      }
    }
  } catch {
    // 主页挂了不致命，还能试路径探测
  }

  for (const p of PROBE_PATHS) candidates.push(new URL(p, base).toString());

  for (const url of candidates) {
    const xml = await fetchText(url);
    if (!xml) continue;
    const parsed = parseFeed(xml);
    if (parsed.posts.length > 0) return url;
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ---- XML 解析（RSS 2.0 + Atom 双格式） ----

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // 同名标签可能只有一条（item/link 都可能），统一收成数组再取
});

/** 解析 feed，返回站名与全部文章（调用方自行截断） */
function parseFeed(xml: string): { posts: FriendFeedPost[] } {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return { posts: [] };
  }

  if (doc?.rss?.channel) {
    return { posts: rssPosts(asArray(doc.rss.channel.item)) };
  }
  if (doc?.feed) {
    return { posts: atomPosts(asArray(doc.feed.entry)) };
  }
  return { posts: [] };
}

function rssPosts(items: any[]): FriendFeedPost[] {
  const posts: FriendFeedPost[] = [];
  for (const it of items) {
    const title = plainText(it.title);
    // link 缺失时退 guid（isPermaLink="true" 时它就是文章地址）
    const url = plainText(it.link) || plainText(it.guid);
    if (!title || !url) continue;
    posts.push({
      title,
      url,
      date: toIso(it.pubDate ?? it["dc:date"]),
      excerpt: excerptOf(it.description ?? it["content:encoded"]),
    });
  }
  return dedupe(posts);
}

function atomPosts(entries: any[]): FriendFeedPost[] {
  const posts: FriendFeedPost[] = [];
  for (const en of entries) {
    const title = plainText(en.title);
    const url = atomLink(en.link);
    if (!title || !url) continue;
    posts.push({
      title,
      url,
      date: toIso(en.published ?? en.updated),
      excerpt: excerptOf(en.summary ?? en.content),
    });
  }
  return dedupe(posts);
}

/** Atom 的 link 可能是多条（self/alternate…），挑 alternate 或第一条 */
function atomLink(link: unknown): string {
  const arr = asArray(link);
  if (arr.length === 0) return "";
  const alt = arr.find((l) => l?.["@_rel"] === "alternate");
  return String(alt?.["@_href"] ?? arr[0]?.["@_href"] ?? "");
}

// ---- 杂项工具 ----

function asArray(v: unknown): any[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** 取出标量文本：fast-xml-parser 对 CDATA/实体已处理好，剩嵌套对象取 #text */
function plainText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as any)) {
    return String((v as any)["#text"]).trim();
  }
  return "";
}

function toIso(raw: unknown): string | undefined {
  const s = plainText(raw);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 摘要：剥 HTML 标签、解常见实体、压空白、截断 */
function excerptOf(raw: unknown): string | undefined {
  const s = plainText(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  return s.length > EXCERPT_MAX ? `${s.slice(0, EXCERPT_MAX - 1)}…` : s;
}

/** 按 url 去重 + 日期降序（无日期沉底） */
function dedupe(posts: FriendFeedPost[]): FriendFeedPost[] {
  const seen = new Set<string>();
  const unique = posts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
  return unique.sort(
    (a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? "")
  );
}
