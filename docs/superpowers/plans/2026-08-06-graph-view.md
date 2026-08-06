# 关系图谱视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/timeline/` 页面新增「图谱」视图——Obsidian 风格双向连接关系图（D3-force 力导向，可拖拽缩放），与时间线视图自由切换，点击节点在详情区展开全文。

**Architecture:** 构建时从 MDX body 提取 `[[wiki-link]]` 生成图谱 JSON（nodes+links）；页面内一个隐藏的全文模板集合（posts+moments 统一预渲染）供两个视图共用详情区。图谱用 `d3-force` 力导向布局，渲染/拖拽/缩放用原生 SVG + Pointer Events。视图切换用 localStorage 记忆。

**Tech Stack:** Astro 5、TypeScript、Tailwind v4、d3-force（唯一新增依赖）。

**Spec:** `docs/superpowers/specs/2026-08-06-graph-view-design.md`

**现有文件结构（关键）:**
- `src/pages/timeline.astro`（290 行）— 时间线视图 + `moment-templates` 模板 + 详情区 + 交互 script
- `src/components/MiniPlayer.astro` — 参考：`define:vars` 脚本不转译 TS 语法（不要在新脚本里用 `define:vars`）
- `src/content.config.ts` — posts / moments 集合 schema（本次**不改**）
- 颜色变量（`src/styles/editorial.css`）：`--color-ed-bg:#F9F8F6`、`--color-ed-fg:#1C1C1C`、`--color-ed-muted:rgba(28,28,28,.6)`、`--color-ed-subtle:rgba(28,28,28,.4)`、`--color-ed-faint:rgba(28,28,28,.1)`

**类型约定（全计划统一，勿改名）:**
```ts
interface GraphNode {
  id: string;              // 内容 id（如 "urban-solitude"、"first-meetup"）
  kind: "post" | "person" | "event";
  title: string;
  url: string;             // post 的文章链接，moment 为空串
  contentIndex: number;    // 索引到 renderedAll（全文模板数组）
}
interface GraphLink { source: string; target: string; }  // 内容 id
```

---

## Task 1: 安装 d3-force

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

Run: `npm i d3-force`
Expected: `package.json` 的 `dependencies` 出现 `"d3-force": "^3.x"`，`package-lock.json` 更新

- [ ] **Step 2: 验证 ESM 导入可用**

Run: `node -e "import('d3-force').then(m => console.log(Object.keys(m).join(',')))"`
Expected: 输出含 `forceSimulation,forceLink,forceManyBody,forceCenter,forceCollide`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add d3-force for graph layout"
```

---

## Task 2: timeline.astro — 统一全文模板机制

把现有"仅 moments 预渲染"（`renderedMoments` + `moment-templates` + `moment-body`）重构为 **posts + moments 全部预渲染**，供时间线/图谱两个视图共用详情区。时间线视图行为不变：post 点仍跳转文章页，moment 点展开；仅模板数据源与索引语义变化。

**Files:**
- Modify: `src/pages/timeline.astro`

- [ ] **Step 1: 替换 frontmatter 中的渲染与数据层**

将 `renderedMoments` 声明（当前约第 18-24 行）与 `TimelineEntry` 接口及 entries 构造替换为：

```ts
// 所有内容统一预渲染全文（posts + moments）
interface RenderedAll {
  id: string;
  kind: "post" | "person" | "event";
  entry: CollectionEntry<"posts"> | CollectionEntry<"moments">;
  Content: Awaited<ReturnType<typeof import("astro:content").getCollection>>;
}

const renderedAll = await Promise.all([
  ...publishedPosts.map(async (p) => ({
    id: p.id,
    kind: "post" as const,
    entry: p,
    Content: (await p.render()).Content,
  })),
  ...publishedMoments.map(async (m) => ({
    id: m.id,
    kind: m.data.type as "person" | "event",
    entry: m,
    Content: (await m.render()).Content,
  })),
]);

const contentIndex = new Map(renderedAll.map((c, i) => [c.id, i]));

interface TimelineEntry {
  date: Date;
  kind: "post" | "person" | "event";
  title: string;
  excerpt: string;
  url: string;
  contentIndex: number; // 索引到 renderedAll，文章跳转用
}

const entries: TimelineEntry[] = [
  ...publishedPosts.map((p) => ({
    date: p.data.date,
    kind: "post" as const,
    title: p.data.title,
    excerpt: p.data.excerpt,
    url: `/blog/${p.id.replace(/\.mdx$/, "")}`,
    contentIndex: contentIndex.get(p.id)!,
  })),
  ...publishedMoments.map((m) => ({
    date: m.data.date,
    kind: m.data.type as "person" | "event",
    title: m.data.title,
    excerpt: m.data.excerpt,
    url: "",
    contentIndex: contentIndex.get(m.id)!,
  })),
].sort((a, b) => b.date.getTime() - a.date.getTime());
```

注意：需要 `import type { CollectionEntry } from "astro:content";`（文件顶部目前没有，需添加）。`Content` 字段类型直接写 `Content: Awaited<ReturnType<typeof p.render>>["Content"]` 更精确，但为简化可用 `any`——**不允许 `any`**，改用具名接口：

```ts
interface RenderedAll {
  id: string;
  kind: "post" | "person" | "event";
  entry: CollectionEntry<"posts"> | CollectionEntry<"moments">;
  Content: (await import("astro:content")).CollectionEntry<"posts"> extends never ? never : Awaited<ReturnType<CollectionEntry<"posts">["render"]>>["Content"];
}
```

如果上面类型表达式过于繁琐导致类型错误，退一步用最小可行方案：定义 `type RenderedContent = Awaited<ReturnType<CollectionEntry<"posts">["render"]>>["Content"];` 用于 posts，`CollectionEntry<"moments">` 的 render 返回结构相同，统一用前者类型标注即可（MDX render 返回的 Content 组件结构一致）。

- [ ] **Step 2: 替换默认展开计算**

将 `defaultIndex` / `defaultRendered`（当前约第 58-62 行）改为：

```ts
const defaultIndex = entries.findIndex((e) => e.kind !== "post");
const defaultRendered =
  defaultIndex >= 0 ? renderedAll[entries[defaultIndex].contentIndex] : null;
```

- [ ] **Step 3: 替换详情模板块**

将 `<template id="moment-templates">` 整块替换为：

```astro
          <template id="content-templates">
            {renderedAll.map((c, idx) => (
              <div class="content-body" data-content-index={idx}>
                <article class="border-t border-[var(--color-ed-faint)] pt-8 pb-4">
                  <h2 class="font-serif text-2xl text-[var(--color-ed-fg)]">
                    {c.entry.data.title}
                  </h2>
                  <p class="mt-2 text-xs text-[var(--color-ed-subtle)] tabular-nums">
                    {formatDate(c.entry.data.date, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  {c.kind === "post" && (
                    <a
                      href={`/blog/${c.id.replace(/\.mdx$/, "")}`}
                      class="mt-2 inline-block text-xs text-[var(--color-ed-fg)] hover-underline"
                    >
                      阅读全文
                    </a>
                  )}
                  {c.kind === "person" && (
                    <span class="mt-3 inline-block border border-[var(--color-ed-faint)] px-2 py-0.5 text-[10px] tracking-[0.05em] text-[var(--color-ed-muted)]">
                      人物
                    </span>
                  )}
                  <div class="prose mt-6">
                    <c.Content />
                  </div>
                </article>
              </div>
            ))}
          </template>
```

- [ ] **Step 4: 更新详情区默认内容**

详情区 `#timeline-detail`（含 `data-default-index`）内部的服务端预渲染块中，把 `defaultRendered.entry.data.type === "person"` 的判断保留，并补充 post 时显示「阅读全文」链接（结构同 Step 3 的模板）。将 `data-default-index={defaultIndex}` 保留。

- [ ] **Step 5: 更新 JS：模板与索引标识**

在 `<script>` 中：
- `document.getElementById("moment-templates")` → `"content-templates"`
- 常量 `momentBodies`（`template.content.querySelectorAll<HTMLElement>(".moment-body")`）→ 改名 `contentBodies`，选择器 `.content-body`
- `data-moment-index` → `data-content-index`（模板元素、selectPoint 中 `el.dataset.momentIndex`、`b.dataset.momentIndex` 全部同步）
- `selectPoint` 中 moment 分支注释同步，逻辑不变（post 分支仍跳转 `window.location.href`）

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功，无 TS 类型错误；时间线页默认展开第一个 moment 全文

- [ ] **Step 7: Commit**

```bash
git add src/pages/timeline.astro
git commit -m "refactor: unify full-text templates for posts and moments"
```

---

## Task 3: timeline.astro — 图谱数据生成

构建时提取 `[[wiki-link]]`，生成 `graphNodes` / `graphLinks`，供 GraphView 使用。

**Files:**
- Modify: `src/pages/timeline.astro`

- [ ] **Step 1: frontmatter 增加图谱数据生成**

在 `formatDate` 定义之后、frontmatter 结束之前追加：

```ts
// --- Graph data: extract [[wiki-links]] from content bodies ---
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

interface GraphNode {
  id: string;
  kind: "post" | "person" | "event";
  title: string;
  url: string;
  contentIndex: number;
}

interface GraphLink {
  source: string;
  target: string;
}

const graphNodes: GraphNode[] = renderedAll.map((c) => ({
  id: c.id,
  kind: c.kind,
  title: c.entry.data.title,
  url: c.kind === "post" ? `/blog/${c.id.replace(/\.mdx$/, "")}` : "",
  contentIndex: contentIndex.get(c.id)!,
}));

const titleToNode = new Map(graphNodes.map((n) => [n.title, n]));

const graphLinks: GraphLink[] = [];
const seenLinks = new Set<string>();
for (const c of renderedAll) {
  const body = String(c.entry.body ?? "");
  const refs = Array.from(body.matchAll(WIKI_LINK_RE), (m) => m[1]);
  for (const refTitle of refs) {
    const target = titleToNode.get(refTitle);
    if (!target) {
      console.warn(`[graph] unresolved wiki-link "${refTitle}" in "${c.id}"`);
      continue;
    }
    if (target.id === c.id) continue;
    const key = [c.id, target.id].sort().join("|");
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    graphLinks.push({ source: c.id, target: target.id });
  }
}
```

- [ ] **Step 2: 构建验证（临时验证解析）**

在 Step 3 接入组件前，先用临时脚本验证提取逻辑。Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const files = [...fs.readdirSync('src/content/posts'), ...fs.readdirSync('src/content/moments')].map(f => path.join(f.includes('.') ? (f.startsWith('src') ? '' : '') : '', ''));
" 2>/dev/null; echo "skip - resolved in build instead"
```

此步无需单独验证命令，直接依赖 Step 3 构建后 `npm run build` 输出的 `[graph] unresolved wiki-link ...` 警告与最终图谱验证（Task 6）。

- [ ] **Step 3: Commit**

```bash
git add src/pages/timeline.astro
git commit -m "feat: extract wiki-link graph data at build time"
```

---

## Task 4: GraphView.astro — 图谱渲染与交互

新建组件：SVG + d3-force 力导向 + 拖拽 + 缩放 + 点击高亮邻居 + 详情联动 + 键盘可达。SVG 用固定 `viewBox="0 0 800 500"`，初始化不依赖容器可见尺寸（容器隐藏时也能正常布局）。

**Files:**
- Create: `src/components/GraphView.astro`

- [ ] **Step 1: 创建组件骨架（模板 + 数据注入）**

```astro
---
interface GraphNode {
  id: string;
  kind: "post" | "person" | "event";
  title: string;
  url: string;
  contentIndex: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
}

const { nodes, links } = Astro.props;
const graphData = JSON.stringify({ nodes, links }).replace(/</g, "\\u003c");
---

<figure id="graph-view" aria-label="关系图谱">
  <svg
    id="graph-svg"
    viewBox="0 0 800 500"
    class="h-[70vh] w-full cursor-grab touch-none select-none active:cursor-grabbing"
    role="img"
    aria-label="内容关系图谱，支持拖拽缩放"
  >
    <g id="graph-zoom">
      <g id="graph-links" stroke="var(--color-ed-faint)" stroke-width="1.2"></g>
      <g id="graph-nodes"></g>
    </g>
  </svg>
  <script type="application/json" id="graph-data" set:html={graphData}></script>
</figure>
```

- [ ] **Step 2: 添加脚本 — 布局与渲染**

在文件末尾追加 `<script>`（普通 script，走 Vite 转译，可用 TS）：

```ts
const svg = document.getElementById("graph-svg") as SVGSVGElement;
const zoomG = document.getElementById("graph-zoom") as SVGGElement;
const linksG = document.getElementById("graph-links") as SVGGElement;
const nodesG = document.getElementById("graph-nodes") as SVGGElement;
const data = JSON.parse(
  (document.getElementById("graph-data") as HTMLScriptElement).textContent ?? "{}"
) as { nodes: GraphNode[]; links: GraphLink[] };

const {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} = await import("d3-force");

const W = 800;
const H = 500;
const nodes = data.nodes.map((n) => ({ ...n })) as Array<GraphNode & { x?: number; y?: number; fx?: number | null; fy?: number | null }>;
const links = data.links.map((l) => ({ ...l }));
const nodeById = new Map(nodes.map((n) => [n.id, n]));

nodes.forEach((n, i) => {
  const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
  n.x = W / 2 + Math.cos(angle) * 120;
  n.y = H / 2 + Math.sin(angle) * 120;
});

const NS = "http://www.w3.org/2000/svg";

const linkEls = links.map((l) => {
  const line = document.createElementNS(NS, "line");
  linksG.appendChild(line);
  return line;
});

const nodeEls = nodes.map((n) => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "graph-node");
  g.dataset.id = n.id;
  g.dataset.kind = n.kind;
  g.dataset.contentIndex = String(n.contentIndex);
  g.dataset.url = n.url;
  g.setAttribute("role", "button");
  g.setAttribute("tabindex", "0");
  g.setAttribute("aria-label", n.title);
  g.style.cursor = "pointer";

  const isEvent = n.kind === "event";
  const shape = document.createElementNS(NS, isEvent ? "rect" : "circle");
  if (isEvent) {
    shape.setAttribute("width", "16");
    shape.setAttribute("height", "16");
    shape.setAttribute("x", "-8");
    shape.setAttribute("y", "-8");
    shape.setAttribute("rx", "3");
    shape.setAttribute("fill", "none");
    shape.setAttribute("stroke", "var(--color-ed-muted)");
    shape.setAttribute("stroke-width", "1.5");
  } else {
    shape.setAttribute("r", "7");
    if (n.kind === "post") {
      shape.setAttribute("fill", "var(--color-ed-fg)");
    } else {
      shape.setAttribute("fill", "var(--color-ed-bg)");
      shape.setAttribute("stroke", "var(--color-ed-muted)");
      shape.setAttribute("stroke-width", "1.5");
    }
  }
  g.appendChild(shape);

  const label = document.createElementNS(NS, "text");
  label.setAttribute("class", "graph-label");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("y", "26");
  label.setAttribute(
    "style",
    "font-family: 'Source Sans 3', sans-serif; font-size: 12px; fill: var(--color-ed-muted);"
  );
  label.textContent = n.title;
  g.appendChild(label);

  nodesG.appendChild(g);
  return g;
});

const simulation = forceSimulation(nodes as never)
  .force(
    "link",
    forceLink(links as never)
      .id((d) => (d as GraphNode).id)
      .distance(110)
  )
  .force("charge", forceManyBody().strength(-300))
  .force("center", forceCenter(W / 2, H / 2))
  .force("collide", forceCollide().radius(34))
  .on("tick", ticked);

function ticked() {
  linkEls.forEach((line, i) => {
    const l = links[i];
    const s = nodeById.get(l.source);
    const t = nodeById.get(l.target);
    if (!s || !t) return;
    line.setAttribute("x1", String(s.x));
    line.setAttribute("y1", String(s.y));
    line.setAttribute("x2", String(t.x));
    line.setAttribute("y2", String(t.y));
  });
  nodeEls.forEach((g, i) => {
    const n = nodes[i];
    g.setAttribute("transform", `translate(${n.x},${n.y})`);
  });
}
```

- [ ] **Step 3: 添加脚本 — 缩放与拖拽**

在 Step 2 脚本中继续追加（同一 script 内）：

```ts
// --- Pan & zoom ---
let zoom = { k: 1, tx: 0, ty: 0 };
function applyZoom() {
  zoomG.setAttribute("transform", `translate(${zoom.tx},${zoom.ty}) scale(${zoom.k})`);
}
applyZoom();

function svgPoint(e: PointerEvent | WheelEvent | Touch) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const p = svgPoint(e);
  const factor = Math.exp(-e.deltaY * 0.001);
  const newK = Math.min(4, Math.max(0.4, zoom.k * factor));
  zoom.tx = p.x - ((p.x - zoom.tx) / zoom.k) * newK;
  zoom.ty = p.y - ((p.y - zoom.ty) / zoom.k) * newK;
  zoom.k = newK;
  applyZoom();
}, { passive: false });

// --- Drag nodes ---
let dragId: string | null = null;
let dragOffset = { x: 0, y: 0 };

svg.addEventListener("pointerdown", (e) => {
  const target = (e.target as Element).closest?.(".graph-node") as SVGGElement | null;
  if (!target) {
    clearActive();
    return;
  }
  const p = svgPoint(e);
  dragId = target.dataset.id ?? null;
  if (dragId) {
    const n = nodeById.get(dragId)!;
    dragOffset.x = p.x / zoom.k - zoom.tx / zoom.k - (n.x ?? 0);
    dragOffset.y = p.y / zoom.k - zoom.ty / zoom.k - (n.y ?? 0);
    target.focus();
    selectNode(dragId);
  }
});

window.addEventListener("pointermove", (e) => {
  if (!dragId) return;
  const p = svgPoint(e);
  const n = nodeById.get(dragId);
  if (!n) return;
  const cx = (p.x - zoom.tx) / zoom.k;
  const cy = (p.y - zoom.ty) / zoom.k;
  n.fx = cx - dragOffset.x;
  n.fy = cy - dragOffset.y;
});

window.addEventListener("pointerup", () => {
  if (dragId) {
    const n = nodeById.get(dragId);
    if (n) {
      n.fx = null;
      n.fy = null;
    }
    dragId = null;
  }
});
```

注意：坐标换算依赖 `(p.x - zoom.tx) / zoom.k`，与 `svgPoint` 返回的 viewBox 坐标配合。拖拽节点需用 viewBox 坐标（已含 SVG 缩放），再减 zoom 平移/缩放得到布局坐标。

- [ ] **Step 4: 添加脚本 — 高亮、详情联动、键盘**

```ts
// --- Active / highlight ---
let activeId: string | null = null;

function neighborsOf(id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const l of links) {
    if (l.source === id) out.add(l.target);
    if (l.target === id) out.add(l.source);
  }
  return out;
}

function clearActive() {
  activeId = null;
  nodeEls.forEach((g) => {
    g.style.opacity = "1";
    g.classList.remove("is-active");
  });
  linkEls.forEach((line) => {
    line.setAttribute("opacity", "1");
  });
  const detail = document.getElementById("timeline-detail");
  if (detail) detail.innerHTML = "";
}

function showDetail(contentIndex: number) {
  const template = document.getElementById("content-templates") as HTMLTemplateElement | null;
  const detail = document.getElementById("timeline-detail");
  if (!template || !detail) return;
  const bodies = template.content.querySelectorAll<HTMLElement>(".content-body");
  const body = Array.from(bodies).find(
    (b) => b.dataset.contentIndex === String(contentIndex)
  );
  if (body) {
    detail.innerHTML = "";
    detail.appendChild(body.cloneNode(true) as HTMLElement);
  }
}

function selectNode(id: string) {
  const n = nodeById.get(id);
  if (!n) return;
  const nb = neighborsOf(id);
  activeId = id;
  nodeEls.forEach((g) => {
    const on = nb.has(g.dataset.id ?? "");
    g.style.opacity = on ? "1" : "0.25";
    g.classList.toggle("is-active", g.dataset.id === id);
  });
  linkEls.forEach((line, i) => {
    const l = links[i];
    const on = nb.has(l.source) && nb.has(l.target);
    line.setAttribute("opacity", on ? "1" : "0.1");
  });
  showDetail(n.contentIndex);
  window.dispatchEvent(new CustomEvent("graph:select"));
}

// toggle active on re-click
svg.addEventListener("pointerup", () => {
  // re-click handled via click event on node
});

nodeEls.forEach((g) => {
  g.addEventListener("click", () => {
    const id = g.dataset.id;
    if (!id) return;
    if (activeId === id) {
      clearActive();
    } else {
      selectNode(id);
    }
  });
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const id = g.dataset.id;
      if (!id) return;
      if (activeId === id) clearActive();
      else selectNode(id);
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") clearActive();
});

// timeline selected something -> clear graph highlight
window.addEventListener("timeline:select", clearActive);
```

- [ ] **Step 5: 添加脚本 — 窄屏隐藏标签**

在 script 末尾追加 CSS（同文件 `<style>` 或直接用 Astro style）：

```astro
<style>
  @media (max-width: 767px) {
    .graph-label { display: none; }
  }
</style>
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功，无类型错误（若 d3-force 泛型报错，参考 Task 4 Step 2 的 `as never` 用法调整）

- [ ] **Step 7: Commit**

```bash
git add src/components/GraphView.astro
git commit -m "feat: add GraphView component with d3-force layout"
```

---

## Task 5: timeline.astro — 视图切换

顶部「时间线 / 图谱」切换按钮 + localStorage 记忆 + 图谱容器接入 GraphView。

**Files:**
- Modify: `src/pages/timeline.astro`
- Modify: `src/components/GraphView.astro`（如需微调）

- [ ] **Step 1: 引入 GraphView 并包裹现有时间线内容**

frontmatter 顶部 import 区追加：
```ts
import GraphView from "../components/GraphView.astro";
```

在 `<section>` 内、`entries.length > 0` 分支的 `<div>` 最外层（`<h1>时间线</h1>` 之后）插入切换按钮组，并把现有时间线轴内容包进 `#view-timeline`、图谱包进 `#view-graph`：

```astro
      <div class="mb-10 flex items-center gap-1" role="tablist" aria-label="视图切换">
        <button data-view-toggle="timeline" type="button" class="rounded-full border px-4 py-1.5 text-sm transition-colors" style="border-color: var(--color-ed-faint); color: var(--color-ed-muted); background: transparent;">
          时间线
        </button>
        <button data-view-toggle="graph" type="button" class="rounded-full border px-4 py-1.5 text-sm transition-colors" style="border-color: var(--color-ed-faint); color: var(--color-ed-muted); background: transparent;">
          图谱
        </button>
      </div>

      <div id="view-timeline">
        <!-- 现有时间线轴 + 详情区 + 模板（原样保留，仅移到此处） -->
      </div>

      <div id="view-graph" hidden>
        <GraphView nodes={graphNodes} links={graphLinks} />
      </div>
```

注意：`#timeline-detail` 与 `#content-templates` 保留在 `#view-timeline` 内（详情区两个视图共用，图谱的 `showDetail` 通过 `document.getElementById` 全局访问，无需移动）。图谱激活时 `#view-timeline` 隐藏，但 `#timeline-detail` 仍被图谱填充——把详情区与模板移出 `#view-timeline` 放到外层（与 toggle 同级，始终可见），避免隐藏容器问题。**最终结构：**

```astro
      <div class="mb-10 ..."> toggle 按钮组 </div>

      <div id="view-timeline">
        <!-- 现有时间线轴（仅轴，不含详情区） -->
      </div>

      <div id="view-graph" hidden>
        <GraphView nodes={graphNodes} links={graphLinks} />
      </div>

      <!-- 共享详情区与模板：两个视图共用，始终可见 -->
      <div id="timeline-detail" class="mt-16 min-h-40" aria-live="polite" data-default-index={defaultIndex}>
        {defaultRendered && (...现有默认渲染...)}
      </div>

      <template id="content-templates"> ... </template>
```

- [ ] **Step 2: 视图切换 JS**

在 `<script>` 中（`points` 声明之前或之后均可）追加：

```ts
const VIEW_KEY = "snark-timeline-view";
const viewTimeline = document.getElementById("view-timeline");
const viewGraph = document.getElementById("view-graph");
const viewToggles = Array.from(document.querySelectorAll("[data-view-toggle]"));

function setView(view: "timeline" | "graph") {
  if (viewTimeline) viewTimeline.hidden = view !== "timeline";
  if (viewGraph) viewGraph.hidden = view !== "graph";
  viewToggles.forEach((b) => {
    const on = b.getAttribute("data-view-toggle") === view;
    b.classList.toggle("is-active", on);
    b.style.color = on ? "var(--color-ed-fg)" : "var(--color-ed-muted)";
    b.style.borderColor = on ? "var(--color-ed-fg)" : "var(--color-ed-faint)";
  });
  localStorage.setItem(VIEW_KEY, view);
}

const savedView = localStorage.getItem(VIEW_KEY);
setView(savedView === "graph" ? "graph" : "timeline");

viewToggles.forEach((b) => {
  b.addEventListener("click", () => {
    const v = b.getAttribute("data-view-toggle") as "timeline" | "graph";
    setView(v);
  });
});
```

- [ ] **Step 3: 时间线选中时通知图谱清除高亮**

在现有 `selectPoint` 函数末尾追加：

```ts
    window.dispatchEvent(new CustomEvent("timeline:select"));
```

（放在 `selectPoint` 内 post 跳转分支之前，确保 moment 展开与 post 跳转都触发通知；图谱 script 监听该事件执行 `clearActive`。）

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功；图谱数据正常注入；页面无 JS 报错

- [ ] **Step 5: Commit**

```bash
git add src/pages/timeline.astro
git commit -m "feat: add timeline/graph view toggle with localStorage"
```

---

## Task 6: 构建 + Playwright 验证

**Files:**
- 验证用（无源码改动，除非发现问题）

- [ ] **Step 1: 全量构建**

Run: `npm run build`
Expected: 构建成功，pagefind 索引生成。查看是否有 `[graph] unresolved wiki-link` 警告（预期：示例 moments 未引用任何标题，无警告或警告列出未解析引用属正常）

- [ ] **Step 2: 重启 preview 并验证页面**

Run:
```bash
lsof -ti:4321 | xargs kill 2>/dev/null; sleep 1; nohup npm run preview > /dev/null 2>&1 & sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/timeline/
```
Expected: `200`

- [ ] **Step 3: Playwright 验证图谱视图**

用 Playwright MCP 执行以下检查（一次性脚本）：
1. 打开 `http://localhost:4321/timeline/`，点击「图谱」按钮 → `#view-graph` 可见、`#view-timeline` 隐藏
2. 图谱 SVG 存在节点：`document.querySelectorAll('#graph-nodes .graph-node').length` 应等于 4（1 文章 + 2 人物 + 1 事件，若示例未变）；连线数量为 0（示例内容无 wiki-link）——预期 0 连线属正常
3. 点击某个节点 → 详情区 `#timeline-detail` 出现 `.content-body` 且含标题；再次点击同一节点 → 详情清空
4. 点击图谱节点后，非邻居节点 opacity 为 0.25（当前无连线时全部为 1，跳过 opacity 断言，仅验证详情填充/清空）
5. 刷新页面 → localStorage 记住「图谱」视图，`#view-graph` 仍可见
6. 时间线视图点击 moment 点 → 详情展开正常（回归）
7. 控制台零 JS 错误

- [ ] **Step 4: 修复发现的问题并复验**

若 Playwright 发现任何问题，修复后重新 `npm run build` + 重跑 Step 3 相关检查。全部通过后进入 Task 7。

---

## Task 7: 最终提交

**Files:**
- 无源码改动

- [ ] **Step 1: 确认工作区状态并提交全部改动**

Run:
```bash
git status --short
git add -A
git commit -m "feat: add graph view to timeline page"
```

Expected: 提交包含 `src/pages/timeline.astro`、`src/components/GraphView.astro`（若 Task 5 已分别提交，此步仅剩未提交的散改动；每个 Task 已独立 commit，此步可为空——若为空，说明无需提交）

- [ ] **Step 2: 汇总验证结果**

向用户报告：图谱视图完成，列出验证清单结果与预览 URL（`http://localhost:4321/timeline/`）。待用户确认后推送（`git push`，走 7890 代理已配置）。

---

## Self-Review 记录

**Spec 覆盖检查：**
- wiki-link 解析 → Task 3 ✓
- 双向无向边 → Task 3（seenLinks 去重 + 无向）✓
- 未解析引用忽略 + warn → Task 3 ✓
- 内容节点（不含标签）→ Task 3（renderedAll 全部）✓
- 详情区全文（post + moment）→ Task 2（统一模板）+ Task 4（showDetail）✓
- 同页切换 + localStorage + 首次默认时间线 → Task 5 ✓
- 无 URL hash → 设计如此，未实现 ✓
- 力导向 d3-force + 拖拽 + 缩放 → Task 4 ✓
- 视觉方向 C（常显标签、浅色 editorial）→ Task 4（label text + SVG 形状颜色）✓
- 点击高亮邻居 → Task 4 selectNode ✓
- 键盘可达 + ESC → Task 4 ✓
- 窄屏标签收起 → Task 4 Step 5 ✓
- 孤立节点展示 → 默认渲染所有节点（无连线仅散点）✓
- 正文不渲染链接 → 设计如此，本次不改 MDX 渲染 ✓

**Placeholder 扫描：** 无 TBD/TODO；Task 3 Step 2 的临时验证命令已标注"跳过，由构建验证代替"（不阻塞）。

**类型一致性：** `GraphNode`/`GraphLink`/`RenderedAll`/`contentIndex` 命名在 Task 2-5 间保持一致；`data-content-index`（DOM）与 `contentIndex`（TS）对应；模板 id 统一为 `content-templates`、类名 `content-body`。
