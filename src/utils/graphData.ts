import type { CollectionEntry } from "astro:content";
import { SITE_AVATAR } from "../consts";
import { postPath } from "./urls";

export interface GraphNode {
  id: string;
  kind: "post" | "person" | "event" | "year" | "self";
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
 * - 层级连线：self → 年 → 内容节点；没有内容的年份不生成节点
 * - 正文 [[锚点]] 额外产生内容节点间连线（跳过自连与重复）
 * - 节点显示名 = graph.name ?? title
 */
export function buildGraphData(
  posts: PostEntry[],
  moments: MomentEntry[]
): GraphData {
  const publishedPosts = posts.filter((p) => !p.data.draft);
  // 图谱只收「回顾型节点」person / event；diary（日记流水）不入图
  const publishedMoments = moments.filter(
    (m) => !m.data.draft && m.data.type !== "diary"
  );

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
      : ((e.data.type as string) === "person" ? "person" : "event");

  const urlOf = (_id: string, e: AnyEntry): string =>
    e.collection === "posts" ? postPath(e as PostEntry) : "";

  const contentNodes: GraphNode[] = graphContent.map(({ id, entry }) => ({
    id,
    kind: kindOf(entry),
    title:
      entry.data.graph?.name ??
      entry.data.title ??
      (entry.collection === "posts"
        ? entry.data.title
        : String(entry.data.date ?? "")), // person/event 无标题时用日期兜底（极少见）
    url: urlOf(id, entry),
    contentIndex: -1,
    avatar: entry.data.graph?.avatar,
    excerpt: entry.data.excerpt,
    heroImage: entry.data.heroImage,
  }));

  // 年 / 月节点：只给真实有内容的月份建节点（时间层级 self → 年 → 月 → 内容）
  const dateOf = (c: { entry: AnyEntry }): Date =>
    c.entry.collection === "posts"
      ? (c.entry as PostEntry).data.date
      : (c.entry as MomentEntry).data.date;

  const yearIds = new Set<string>();
  const yearOfContent = new Map<string, string>(); // contentId -> yearId
  for (const c of graphContent) {
    const d = dateOf(c);
    const yearId = `year-${d.getFullYear()}`;
    yearIds.add(yearId);
    yearOfContent.set(c.id, yearId);
  }

  const timeNodes: GraphNode[] = [...yearIds].sort().map((yearId) => ({
    id: yearId,
    kind: "year" as const,
    title: yearId.replace("year-", ""),
    url: "",
    contentIndex: -1,
  }));

  const nodes: GraphNode[] = [selfNode, ...timeNodes, ...contentNodes];

  // 标题 → 节点（graph.name 优先，title 回退，保留旧链接可匹配）
  const titleToNode = new Map<string, GraphNode>();
  for (const n of nodes) titleToNode.set(n.title, n);
  for (const c of graphContent) {
    const t = c.entry.data.title;
    // diary 等无 title 的内容不参与「按名匹配」，否则会把 undefined 塞进 Map
    if (!t) continue;
    if (!titleToNode.has(t)) {
      const node = nodes.find((n) => n.id === c.id);
      if (node) titleToNode.set(t, node);
    }
  }

  const links: GraphLink[] = [];
  const seenLinks = new Set<string>();

  const addLink = (source: string, target: string) => {
    const key = [source, target].sort().join("|");
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    links.push({ source, target });
  };

  // 层级连线：self → 年 → 内容
  for (const yearId of yearIds) addLink("self", yearId);
  for (const c of graphContent) {
    const yearId = yearOfContent.get(c.id);
    if (yearId) addLink(yearId, c.id);
  }

  for (const c of graphContent) {
    // 代码块与行内代码里的 [[...]] 不是关联声明，先剥离再匹配
    const body = String(c.entry.body ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`\n]*`/g, " ");
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
