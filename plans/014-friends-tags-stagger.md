# 014 — 友链页与标签云补上入场错峰（对齐全站 reveal 语言）

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 7 一致性 / 8 错失的机会
- **Estimated scope**: 3 文件（src/pages/friends.astro、src/components/TagCloud.astro、src/pages/tags/index.astro）

## Problem

全站每个列表页都有 30–80ms 的组入场错峰（首页 60ms、标签聚合页 50ms、归档 60ms、拾集 60ms），唯独两处「全部同时出现」：

1. 友链页卡片栅格没有任何入场：`src/pages/friends.astro:49-85` 渲染 `<li class="friend-item">` 无 reveal 类、无延迟（全文件搜不到 "reveal"）。
2. 标签云整块瞬现：`src/pages/tags/index.astro:20` 直接 `<TagCloud />`，`src/components/TagCloud.astro` 的 chip 无入场。

## Target

全部复用站内现成的 `.reveal` 机制（transition 型、不阻塞交互），不发明新 keyframes：

- 友链卡片：`<li class="friend-item reveal" style={`--reveal-delay: ${Math.min(i * 60, 420)}ms`}>`
- 标签 chip：`<a … class="tag-chip reveal" style={`--reveal-delay: ${Math.min(i * 40, 560)}ms`}>`
- 标签云在多个页面复用（首页右栏/标签页），统一给 chip 加 reveal 是有意的——让所有用到的页面都获得与站点一致的组入场。

## Repo conventions to follow

- `.reveal` 系统：`src/styles/editorial.css:795-810`（`.js .reveal { opacity: 0; transform: translateY(10px); transition: opacity var(--dur-enter) var(--ease-ed), …; transition-delay: var(--reveal-delay, 0ms); }`，IntersectionObserver 加 `.is-visible`，观察器在 BaseLayout 全局生效）。
- 延迟 exemplar：`src/pages/index.astro:92-95`：

```astro
class="home-post-row reveal"
style={`--reveal-delay: ${i * 60}ms`}
```

## Steps

1. `src/pages/friends.astro`：FRIENDS.map 的回调把 `<li class="friend-item">`（约 53 行）改为 `<li class="friend-item reveal" style={`--reveal-delay: ${Math.min(i * 60, 420)}ms`}>`。确认 map 回调参数里有索引 `i`（没有就加上）。
2. `src/components/TagCloud.astro`：`sortedTags.map(([tag, count]) =>` 加索引：`sortedTags.map(([tag, count], i) =>`；把 `<a href={tagPath(tag)} class="tag-chip">`（约 27 行）改为 `<a href={tagPath(tag)} class="tag-chip reveal" style={`--reveal-delay: ${Math.min(i * 40, 560)}ms`}>`。
3. 检查 TagCloud 的其他使用点（`grep -rn "TagCloud" src/pages src/components`）：确认不会与宿主页面的入场冲突（宿主页面若给容器加了别的入场，chip 级 reveal 依然成立，无需改动宿主）。
4. 确认 `.reveal` 在 reduced-motion 下已有处理：`grep -n -A8 "prefers-reduced-motion" src/styles/editorial.css | grep -B2 -A8 "reveal"`。若**没有**针对 `.reveal` 的规则，在 editorial.css 的 reduced-motion 块中补一条（保持透明度淡入、去掉位移）：

```css
/* target（仅当缺失时添加） */
@media (prefers-reduced-motion: reduce) {
  .js .reveal {
    transform: none;
    transition: opacity 200ms linear;
  }
}
```

   若已有等效规则则跳过。

## Boundaries

- 不改 `.friend-grid` 布局、friend-card 的交互 JS、TagCloud 的排序逻辑。
- 不给友链页 page-head 加动画（范围外）。
- 不要发明新的入场 keyframes；只复用 `.reveal`。

## Verification

- **Mechanical**: `npx astro check` 通过；打开 /friends/ 与 /tags/ 页面源码可见 `reveal` 类与 `--reveal-delay`。
- **Feel check**:
  - 友链页加载：卡片按 60ms 逐个上浮淡入（capped 420ms），键盘 Tab 立即可聚焦（错峰不阻塞交互）。
  - 标签页加载：chip 按 40ms 波浪式入场（capped 560ms）。
  - 首页若有标签云：同样波浪入场，与右栏其他元素节奏协调。
  - Rendering 面板切 prefers-reduced-motion：位移消失，仍有快速淡入。
- **Done when**: 两个页面与其他列表页的组入场语言一致。
