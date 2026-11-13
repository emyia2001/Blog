# 003 — 悬停位移统一收进 hover-gate（触屏不再卡悬停态）

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 6 可访问性
- **Estimated scope**: 约 10 文件（src/styles/editorial.css、src/components/Nav.astro、ContributionHeatmap.astro、BackToTop.astro、PrevNext.astro、src/pages/timeline.astro、collection.astro、tree.astro、archive.astro、tags/index.astro、tags/[tag].astro）

## Problem

全站 `:hover` 里的 transform/box-shadow 位移都没有 `@media (hover: hover) and (pointer: fine)` 门。触屏点按会先命中悬停态并**卡住**（sticky hover）——位移留在元素上直到下次点别处。GraphView 的悬停已在 JS 里按指针类型门控，无需处理。

统一改法（只搬 transform/box-shadow，颜色/背景/边框留在门外）：

```css
/* before */
.x:hover { color: …; transform: translateY(-2px); }
/* after */
.x:hover { color: …; }
@media (hover: hover) and (pointer: fine) {
  .x:hover { transform: translateY(-2px); }
}
```

**关键**：若原选择器是 `:hover, :focus-visible` 共享一条规则，拆分时 `:focus-visible` 必须**留在门外**（键盘用户的反馈不能丢）。

## Target（逐位置清单）

> 每处先读当前代码；行号在前面计划执行后可能漂移，以代码内容为准。只搬动 transform/box-shadow 声明。

| 文件 | 位置/选择器 | 处理 |
|---|---|---|
| src/styles/editorial.css | `.entry-row:hover, .entry-row:focus-visible`（现约 284-295 行，translateY(-2px) + box-shadow） | 拆：`:focus-visible` 留门外原样；`:hover` 的位移+阴影进 gate |
| src/styles/editorial.css | `.tag-chip:hover b { transform: scale(1.08); }`（现约 397-399 行） | transform 进 gate |
| src/styles/editorial.css | `.home-post-row:hover, :focus-visible`（现约 1192-1196 行，translateY(-2px)+阴影） | 同 entry-row 拆法 |
| src/styles/editorial.css | `.home-about-avatar:hover { transform: scale(1.05); }`（现约 1288-1290 行） | transform 进 gate |
| src/styles/editorial.css | `.home-soc:hover { … translateY(-2px) scale(1.08); }`（现约 1345-1349 行） | transform 进 gate（若含 color/背景留门外） |
| src/styles/editorial.css | `.code-block__copy:hover { … transform: translateY(-1px); }`（现约 656-662 行） | transform 进 gate（color/border 留门外） |
| src/styles/editorial.css | `.search-result:hover { … transform: translateX(3px); }`（现约 1488-1496 行） | transform 进 gate（背景/着色留门外） |
| src/components/Nav.astro | `.nav-drawer-link:hover { color…; background…; transform: translateX(3px); }`（现约 298-302 行；抽屉是纯触屏面） | transform 进 gate（等于触屏上该位移直接消失） |
| src/components/ContributionHeatmap.astro | `.heat-cell:hover, :focus-visible, .is-hot { transform: scale(1.15); … }`（现约 203-208 行） | 拆：`:focus-visible` 与 `.is-hot`（状态、非悬停）留门外；仅 `:hover` 的 scale 进 gate |
| src/pages/timeline.astro | `.timeline-point:hover .tl-simple__dot { transform: scale(1.25); }`（现约 476-480 行） | transform 进 gate |
| src/pages/timeline.astro | `.timeline-point:hover .tl-simple__body, .is-active { transform: translateX(4px); }`（现约 495-499 行） | 拆：`.is-active`（状态）留门外；仅 `:hover` 进 gate |
| src/pages/collection.astro | `.col-bank[data-mode="album"] .vol:hover .vol__cover { transform: scale(1.14); … }`（现约 426-436 行） | transform 部分进 gate（同规则的 box-shadow/filter 一并进 gate） |
| src/pages/collection.astro | `.col-wallcard:hover { … translateY(-4px); }`（现约 500-505 行） | transform 进 gate |
| src/components/BackToTop.astro | hover 规则（现约 108-110 行） | 含 transform 就进 gate |
| src/components/PrevNext.astro | `.pn-arrow` / `.aside-arrow` hover 位移（现约 63-68 行） | transform 进 gate |
| src/pages/tree.astro | 按钮 hover 位移（现约 228-231 行） | transform 进 gate |
| src/pages/archive.astro | `.aside-arrow` hover（现约 191-194 行） | transform 进 gate |
| src/pages/tags/index.astro、tags/[tag].astro | `.aside-arrow` hover（现约 31-35 / 79-83 行） | transform 进 gate |

各文件把 gate 块放在对应样式块末尾（同文件可合并多个选择器进一个 gate 块，减少碎片）。

## Repo conventions to follow

- 站内已有的指针门控思想：`src/components/GraphView.astro` JS 里 hover 已按鼠标事件门控（约 2035 行）——本计划把同样纪律补到 CSS 层。
- media query 写法照 AUDIT：`@media (hover: hover) and (pointer: fine) { … }`。

## Steps

1. 逐文件按上表处理。每处：先把原规则读全，拆出「颜色/背景/边框/描边」类声明留在原位，「transform/box-shadow」类搬进 gate。
2. 同一文件的所有 gate 目标合并成一个 `@media (hover: hover) and (pointer: fine) { … }` 块（放在该样式块末尾），用完整选择器书写。
3. 完成后全局自检：`grep -rn --include="*.astro" --include="*.css" ":hover" src/ | grep -v "hover: hover"` 逐条核对剩余 `:hover` 规则，确认不再有裸露的 transform/box-shadow 悬停位移（颜色类悬停保留在门外是**有意**的）。

## Boundaries

- 不动 `:focus-visible`、`.is-hot`、`.is-active` 等状态态的任何表现。
- 不动 GraphView（JS 门控已就位）、不动 `:active` 按压（007 计划）。
- 不合并/重排既有规则顺序（除拆分所需的搬移）。

## Verification

- **Mechanical**: `npx astro check` 通过；上述 18 处中每处 `:hover` 的 transform 均已位于 hover-gate 块内。
- **Feel check**（Chrome DevTools 设备模拟触屏）：
  - 点一条文章行/标签 chip：无残留上浮/阴影；松手后元素回原位。
  - 打开移动端抽屉点链接：无 3px 位移残留。
  - 桌面鼠标：所有悬停位移与改动前一致。
  - 键盘 Tab 导航：:focus-visible 反馈全部保留。
- **Done when**: 触屏不再产生粘滞悬停位移，鼠标行为不变，键盘反馈不变。
