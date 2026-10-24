import type { CollectionEntry } from "astro:content";

/**
 * 站内 URL 的统一出口。
 *
 * 为什么要有这些函数：
 * 1) 构建产物是目录格式（dist/blog/post-1/index.html），Cloudflare Pages 对
 *    `/blog/post-1` 会返回 307 跳到 `/blog/post-1/`。站内链接若不带尾斜杠，
 *    每次点击/预取都要多一次往返，且 canonical 与实际 URL 形式不一致。
 * 2) 标签 slug 规则原先在 6 个文件里各写一遍，改一处忘一处就会 404。
 * 3) 文章 URL 原先只看文件名，frontmatter 的 `slug` 形同虚设；这里统一改为
 *    「slug 优先，文件名回退」。
 */

/** 补尾斜杠，保证与 canonical / sitemap / 目录产物一致 */
export function withSlash(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

/** 固定路由（改路径只需改这里） */
export const ROUTES = {
  home: "/",
  archive: "/archive/",
  timeline: "/timeline/",
  graph: "/graph/",
  friends: "/friends/",
  rss: "/rss.xml",
} as const;

/** 标签 → URL 片段（全站唯一实现） */
export function tagSlug(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, "-");
}

/** 标签页路径（带尾斜杠） */
export function tagPath(tag: string): string {
  return `/tags/${tagSlug(tag)}/`;
}

type PostEntry = CollectionEntry<"posts">;
// Astro 会把 frontmatter 的 `slug` 作为条目自身的 slug，并从 data 里剥掉
// （所以 post.data.slug 恒为 undefined）；这里显式接住条目级 slug。
type PostLike = Pick<PostEntry, "id" | "data"> & { slug?: string };

/** 文章 slug：frontmatter `slug` 优先（可在 CMS 里改），否则用文件名 */
export function postSlug(post: PostLike): string {
  const custom = (post.slug ?? post.data.slug)?.trim().replace(/^\/+|\/+$/g, "");
  return custom && custom.length > 0 ? custom : post.id.replace(/\.mdx?$/, "");
}

/** 文章路径（带尾斜杠） */
export function postPath(post: PostLike): string {
  return `/blog/${postSlug(post)}/`;
}
