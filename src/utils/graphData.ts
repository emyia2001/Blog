import type { CollectionEntry } from "astro:content";
import { SITE_AVATAR } from "../consts";

export interface GraphNode {
  id: string;
  kind: "post" | "person" | "event" | "self";
  title: string;
  url: string;
  contentIndex: number;
  avatar?: string;
  excerpt?: string;
  heroImage?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// 关联锚点：正文里 [[锚点]] → 目标节点（graph.name 优先，title 回退）
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

type PostEntry = CollectionEntry<"posts">;
type MomentEntry = CollectionEntry<"moments">;

/**
 * 由 posts + moments 聚合关系图谱数据（节点 + 连线）。
 * - 非 draft 且 graph.enabled !== false 的内容各成一个节点 + 固定的「我」self 节点
 * - 所有内容节点都连向 self；正文 [[锚点]] 额外产生节点间连线（跳过自连/重复）
 * - 节点显示名 = graph.name ?? title
 */
export function buildGraphData(
  posts: PostEntry[],
  moments: MomentEntry[]
): GraphData {
  const publishedPosts = posts.filter((p) => !p.data.draft);
  const publishedMoments = moments.filter((m) => !m.data.draft);

  type AnyEntry = PostEntry | MomentEntry;

  const selfNode: GraphNode = {
    id: "self",
    kind: "self",
    title: "我",
    url: "",
    contentIndex: -1,
    avatar: SITE_AVATAR,
  };

  const graphContent: { id: string; entry: AnyEntry }[] = [
    ...publishedPosts.map((p) => ({ id: p.id, entry: p as AnyEntry })),
    ...publishedMoments.map((m) => ({ id: m.id, entry: m as AnyEntry })),
  ].filter((c) => c.entry.data.graph?.enabled !== false);

  const kindOf = (e: AnyEntry): GraphNode["kind"] =>
    e.collection === "posts"
      ? "post"
      : (e.data.type as "person" | "event");

  const urlOf = (id: string, e: AnyEntry): string =>
    e.collection === "posts" ? `/blog/${id.replace(/\.mdx$/, "")}` : "";

  const nodes: GraphNode[] = [
    selfNode,
    ...graphContent.map(({ id, entry }) => ({
      id,
      kind: kindOf(entry),
      title: entry.data.graph?.name ?? entry.data.title,
      url: urlOf(id, entry),
      contentIndex: -1,
      avatar: entry.data.graph?.avatar,
      excerpt: entry.data.excerpt,
      heroImage: entry.data.heroImage,
    })),
  ];

  // 标题 → 节点（graph.name 优先，title 回退，保留旧链接可匹配）
  const titleToNode = new Map<string, GraphNode>();
  for (const n of nodes) titleToNode.set(n.title, n);
  for (const c of graphContent) {
    const t = c.entry.data.title;
    if (!titleToNode.has(t)) {
      const node = nodes.find((n) => n.id === c.id);
      if (node) titleToNode.set(t, node);
    }
  }

  const links: GraphLink[] = [];
  const seenLinks = new Set<string>();

  for (const n of nodes) {
    if (n.id === "self") continue;
    const key = ["self", n.id].sort().join("|");
    seenLinks.add(key);
    links.push({ source: "self", target: n.id });
  }

  for (const c of graphContent) {
    const body = String(c.entry.body ?? "");
    const refs = Array.from(body.matchAll(WIKI_LINK_RE), (m) => m[1]);
    for (const refTitle of refs) {
      const target = titleToNode.get(refTitle);
      if (!target) continue;
      if (target.id === c.id) continue;
      const key = [c.id, target.id].sort().join("|");
      if (seenLinks.has(key)) continue;
      seenLinks.add(key);
      links.push({ source: c.id, target: target.id });
    }
  }

  return { nodes, links };
}
