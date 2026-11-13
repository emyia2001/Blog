# 019 — 导航换页零动画（用户决策：不要任何切换延迟相关的设置）

- **Status**: TODO（v2：比「极速 80/140ms」更彻底——VT 完全禁用 + 入场编排跳过 + 选中线落定重播移除；018 预取保留）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准；上一版 80/140ms 方案作废且未落地）
- **Severity**: HIGH
- **Category**: 性能 / 用户反馈
- **Estimated scope**: 4 文件（src/styles/editorial.css、src/layouts/BaseLayout.astro、src/components/Nav.astro、src/pages/timeline.astro + archive.astro 条件性）

## Problem

预取消除了网络等待，但换页仍有三层动画延迟：VT 160/320ms + 收焦模糊、内容入场编排（reveal 560ms / title-rise 900ms / mask-reveal 900ms / ed-in 620ms / 时间轴生长）、导航选中线落定重播 280ms+40ms。用户决策：**导航换页零动画**——swap 即呈现，首访（硬刷新/直达）保留完整编排。

## Target

### A. VT 全部禁用（editorial.css）

```css
/* target — 替换 ::view-transition-old(root)/::view-transition-new(root) 两条规则、
   保留 site-nav 四条（具名快照不做默认交叉淡化）：
   换页零动画（用户决策）：root 快照不做任何过渡，swap 即呈现。
   注意：不显式写 animation:none 的话，浏览器默认会给 VT 组做 ~250ms 交叉淡化。 */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
```

**删除**（全部死代码）：
- tokens：`--dur-page-out: 160ms; --dur-page-in: 320ms;`（约 30-32 行，含「换页过渡」注释行）
- `::view-transition-old(root) { animation: page-out … }` / `::view-transition-new(root) { animation: page-in … }`（约 412-419 行）——由上面的 none 规则取代
- `@keyframes page-out` / `page-in`（含 blur(2px)，约 436-465 行）
- `@keyframes page-out-fade` / `page-in-fade` 及 reduced-motion 块中启用它们的规则（grep `page-out-fade\|page-in-fade` 全部清除）
- 工艺约束注释（约 408-414 行）整段替换为上面的简短注释；「导航栏在换页时保持静止…选中态下划线的位置变化也借此平滑切换」注释更新为「导航快照同样不做默认交叉淡化（换页零动画）。」

**全仓自检**：`grep -rn "view-transition-name" src/` ——若除 Nav 的 `site-nav` 外还有其他具名快照，必须把它们加入 none 规则或移除该属性（任何具名组默认都会 250ms 交叉淡化）。

### B. 导航换页跳过入场编排（html.nav-fast）——与上一版相同

**JS（BaseLayout.astro）**：

```ts
// 极速换页：首访保留完整入场编排；此后每次导航换页（astro:after-swap）
// 给 <html> 打 nav-fast——swap 后、绘制前生效，内容首帧即终态
let firstPageLoaded = false;
document.addEventListener("astro:after-swap", () => {
  if (firstPageLoaded) document.documentElement.classList.add("nav-fast");
});
```

并在现有 `astro:page-load` 回调（`splitTitleChars(); updateProgress();` 处）开头加 `firstPageLoaded = true;`。

**CSS（editorial.css，`/* --- Reduce motion --- */` 块之前插入）**：

```css
/* target */
/* --- 极速换页：导航触发的换页（html.nav-fast，见 BaseLayout）跳过入场编排，
   内容首帧即终态；首访（无此类）保留完整编排 --- */
html.nav-fast .js .reveal {
  opacity: 1;
  transform: none;
  transition: none;
}
html.nav-fast .js .char-reveal {
  animation: none;
  transform: none;
}
html.nav-fast .ed-in {
  animation: none;
  opacity: 1;
  transform: none;
}
html.nav-fast .home-masthead__topline {
  animation: none;
}
html.nav-fast .js .mask-reveal::after {
  transition: none;
  transform: scaleX(1);
}
html.nav-fast .js .mask-reveal > * {
  opacity: 1;
  transform: none;
  transition: none;
}
```

（覆盖基态而不只是杀过渡——`.reveal`/`.mask-reveal > *` 基态 opacity:0，只杀过渡会闪一帧不可见内容。）

**C. 时间轴页（timeline.astro 本地样式，插在入场规则约 440 行后）**：

```css
/* target */
/* 极速换页：导航进入时点/线直接呈现，不做生长编排 */
:global(html.nav-fast) .timeline-point {
  opacity: 1;
  animation: none;
  animation-delay: 0s;
}
:global(html.nav-fast) .tl-seg {
  animation: none;
  transform: none;
}
```

**D. 归档页年份线（条件性）**：检查 `src/pages/archive.astro` 约 170-180 行年份横线（`transform 900ms … 120ms`）的驱动方式——元素带 `.reveal` 则已被 B 覆盖；若由独立类驱动，加同构 `:global(html.nav-fast)` 覆盖（置终态 + transition: none）。

### E. 移除导航选中线「落定」重播（Nav.astro）

换页后的 280ms+40ms 下划线重播也属「切换延迟相关」，移除；选中线静态存在：

- 删除 CSS：`.nav-link.nav-settle-armed::after`、`.nav-link.nav-settle::after`、`@keyframes nav-underline-settle`，以及 reduced-motion 块中对 `.nav-settle`/`.nav-settle-armed` 的两条覆盖规则（约 356-363 行）。
- 删除 JS：`replayUnderlineSettle()` 函数及其全部调用点、`nav-settle-armed` 的初始武装逻辑（grep `nav-settle` 清零）。
- 保持 `.nav-link` 下划线的默认显示逻辑不变（is-active 静态 scaleX(1)）。

## Repo conventions to follow

- reduce 块终态范式：`editorial.css:931-948`。
- Astro：`astro:after-swap` 在 swap 后、绘制前触发；Astro swap 会替换 `<html>` 属性，运行时类需在 after-swap 重打。

## Steps

1. editorial.css：按 Target A 删除/替换（tokens、root VT 规则、四组 keyframes、reduce 块的 VT 规则、注释）。
2. editorial.css：插入 nav-fast 覆盖小节（Target B CSS）。
3. BaseLayout.astro：after-swap 监听 + firstPageLoaded 标记（Target B JS）。
4. timeline.astro：Target C 两条规则。
5. archive.astro：Target D 检查并条件处理。
6. Nav.astro：Target E 移除落定重播（CSS + JS 全链）。
7. 自检：`grep -rn "page-out\|page-in\|dur-page\|nav-settle\|blur(2px)" src/` 无结果（`astro:page-load` 等不含这些串）；`grep -rn "view-transition-name" src/` 仅剩 site-nav 且在 none 规则覆盖内。

## Boundaries

- 不动 018 预取、错峰封顶；不动首访编排的时长与延迟。
- 不动导航收起/露出（scroll 行为）、`.ed-progress`、MiniPlayer 等非换页动画。
- 不删 `<ClientRouter />`（SPA 式 swap 本身就是最快的换页方式，删了会退化成整页刷新）。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build && npm run preview` 构建成功；step-7 自检 grep 清零。
- **Feel check**（preview，非 dev）:
  - 导航点击（第 2 次起）：内容**瞬间**呈现（无淡入淡出、无模糊、无逐条入场、无下划线重播），预取命中时感知为零延迟。
  - 首访（硬刷新）：完整入场编排不变。
  - 浏览器后退/前进：同样瞬间。
  - Rendering 面板 reduced-motion：行为与正常模式一致（换页本来就是零动画）。
- **Done when**: 换页链路上不存在任何动画/延迟设置；首访编排保留。
