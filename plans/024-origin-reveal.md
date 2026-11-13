# 024 — 换页过渡改「原点圆形揭示」：删除遮罩系统，VT clip-path 从点击处扩散

- **Status**: TODO（用户反馈：幕布效果很差，换型；选型 Material container-transform / Chrome VT 官方演示的 origin reveal 模式）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

021-023 的遮罩方案（纸色盖屏/墨色上滑/幕布横扫）本质都是「色布盖页」，观感廉价且与主题隔膜。用户要求换用优秀的过渡模式并符合站点主题。

**选型：原点圆形揭示**——不使用任何遮罩；换页时新页快照以 `clip-path: circle()` 从**点击的导航项位置**圆形扩散覆盖旧页（旧页快照静止垫底，无交叉淡化无闪烁）。这是 Chrome View Transitions 官方演示与 Material container-transform 的招牌模式：过渡从触发器发起、有空间叙事，且由页面内容自身完成——天然符合纸面主题。

## Target

### A. 删除幕布系统

- **BaseLayout.astro**：删除 `<div class="ed-veil" aria-hidden="true"></div>` markup 及其注释；删除遮罩状态机 JS（`veilShownAt`、`VEIL_COVER_MS`、`astro:before-preparation` 监听、`astro:after-swap` 里的 setTimeout 揭开逻辑——**保留**该监听里的 `nav-fast` 加类逻辑）。`astro:page-load` 回调开头的兜底复位行删除（`nav-veil-cover`/`nav-veil-exit` 已不存在）。
- **editorial.css**：删除 `.ed-veil` 整块（含 `::before`/`::after` 与三个状态规则）。

### B. 原点圆形揭示 CSS（editorial.css，替换 root VT 规则；site-nav 四条 none 规则保留）

```css
/* target — 替换 ::view-transition-old/new(root) 两条规则与注释 */
/* 换页过渡：原点圆形揭示——新页快照从点击的导航位置 clip-path 扩散盖过旧页
   （坐标由 BaseLayout 的 click 捕获写入 --vt-x/--vt-y；键盘导航回落导航带高度）。
   旧页快照静止垫底（无交叉淡化），扩散 300ms expo-out 一气呵成。 */
::view-transition-old(root) {
  animation: none;
}
::view-transition-new(root) {
  animation: vt-reveal 300ms var(--ease-ed) both;
}
@keyframes vt-reveal {
  from {
    clip-path: circle(0% at var(--vt-x, 50%) var(--vt-y, 8%));
  }
  to {
    clip-path: circle(100% at var(--vt-x, 50%) var(--vt-y, 8%));
  }
}
```

reduced-motion：在 editorial.css 既有 reduce 块中追加一条（reduce 用户即时切换）：

```css
/* target（reduce 块内） */
  ::view-transition-new(root) {
    animation: none;
  }
```

### C. 点击坐标捕获（BaseLayout.astro，加在脚本中 nav-fast 监听附近）

```ts
// 记录导航点击位置：VT 圆形揭示从点击处扩散（capture 先于路由拦截）。
// 键盘触发的 click（detail === 0）无坐标语义，回落 CSS 默认值（导航带高度居中）。
document.addEventListener(
  "click",
  (e) => {
    if (e.detail === 0) return;
    const link = (e.target as HTMLElement | null)?.closest?.("a");
    if (!link) return;
    document.documentElement.style.setProperty("--vt-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--vt-y", `${e.clientY}px`);
  },
  true
);
```

要点：
- `--vt-x/--vt-y` 写在 `<html>` 上并跨换页保持（Astro swap 替换 html 属性后，坐标由下一次 click 重新写入；未点击坐标时用 keyframes 默认值 `50% 8%`——导航带高度附近居中）。
- `circle(100%)` 按规范解析为视口对角半径，任意原点都能盖满全屏。
- 旧页快照 `animation: none` 静止垫底：无交叉淡化、无双影；圆形扫过即露出新页终态（配合 nav-fast）。
- clip-path 动画在 Chrome 走合成器；纯视觉属性，不触发布局。

### 保留不动

nav-fast 全套、018 预取、错峰封顶、首访完整编排、016 进度条、导航收起、site-nav VT none 规则。

## Repo conventions to follow

- token：`--ease-ed`（editorial.css:28）。
- `html.*` 状态类与内联 CSS 变量写入范式（BaseLayout 已有 `--ed-progress-offset` 的 setProperty 先例）。

## Steps

1. BaseLayout.astro：按 Target A 删除幕布系统（markup + 状态机 JS，保留 nav-fast）；加 Target C 点击捕获。
2. editorial.css：删 `.ed-veil` 整块；root VT 规则替换为 Target B（keyframes + reduce 追加）。
3. 自检：`grep -rn "ed-veil\|nav-veil" src/` 无结果；`grep -n "vt-reveal\|--vt-x" src/styles/editorial.css src/layouts/BaseLayout.astro` 各命中；`grep -n "animation: none" src/styles/editorial.css` 中 site-nav 与 reduce 的 VT 规则在位。

## Boundaries

- 不动 nav-fast/预取/错峰封顶/首访编排/016 进度条/导航收起。
- 不加任何遮罩/色块元素；不加文字/logo 装饰。
- 不改 site-nav 具名快照规则。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-3 自检 grep。
- **Feel check**（preview，Chrome）:
  - 点击「归档」：新页从「归档」二字位置圆形扩散盖过旧页，~300ms；点不同导航项，扩散原点跟随点击位置。
  - 扩散圈外是静止的旧页（无白屏、无色块、无双影），扫过即新页终态。
  - 键盘 Tab 到导航项按 Enter：从导航带居中位置扩散。
  - Rendering 面板 reduced-motion：换页即时切换（无扩散）。
  - 首访硬刷新：无 VT，完整编排不变。
- **Done when**: 过渡为点击原点圆形揭示，无任何遮罩色块，~300ms。
