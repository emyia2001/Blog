# 021 — 全局换页遮罩（veil）：盖屏→swap→揭开

- **Status**: TODO（用户决策：要全页遮罩层样式的过渡；替代 020 的顶部加载条 + 交叉淡化方案）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

020 的两个不足：① 纯 opacity 交叉淡化（100/200ms）在两张相似页面间几乎不可感知——实测 VT 有触发但用户「没有过渡动画」；② 顶部加载条与换页动画是两套语言，重叠。用户要的是**全屏遮罩层**：换页时遮罩盖住整页、新页就绪后揭开——连贯、明确、有「翻页」仪式感。

设计（非对称节奏）：
- **盖屏 180ms**（expo-out，响应快）→ 保证至少盖满 180ms 再揭开（预取命中的 ~50ms 换页也会被遮罩完整覆盖，节奏恒定不闪断）
- **swap 在遮罩下完成**（root VT animation: none，019 规则恢复）
- **揭开 240ms**（expo-out，从容）露出新页
- 遮罩用纸色 `var(--color-ed-bg)`——「翻过一页纸」的编辑风隐喻；nav-fast 保留（新页内容首帧即终态，揭开的就是终态）
- 真实等待（线上网络/dev 冷编译）时遮罩持续盖着——等待本身就是反馈

## Target

### A. 遮罩 markup（BaseLayout.astro，`.ed-progress` span 旁；**同时删除 020 的 `.ed-loading` div 及其注释**）

```astro
<!-- 全局换页遮罩：导航时盖屏、swap 后揭开（见 editorial.css .ed-veil） -->
<div class="ed-veil" aria-hidden="true"></div>
```

### B. 遮罩状态机 JS（BaseLayout.astro；**删除 020 的 nav-loading 三处钩子**，替换为）

```ts
// 全局换页遮罩：导航时纸色遮罩盖屏（至少 VEIL_COVER_MS，保证节奏恒定），
// swap 完成且盖满后揭开——换页连贯，预取命中的快速换页也不会闪一下就撤
let veilShownAt = 0;
const VEIL_COVER_MS = 180;
document.addEventListener("astro:before-preparation", () => {
  veilShownAt = performance.now();
  document.documentElement.classList.add("nav-veil-cover");
});
document.addEventListener("astro:after-swap", () => {
  const wait = Math.max(0, VEIL_COVER_MS - (performance.now() - veilShownAt));
  window.setTimeout(() => document.documentElement.classList.remove("nav-veil-cover"), wait);
});
```

并在现有 `astro:page-load` 回调开头加兜底复位：`document.documentElement.classList.remove("nav-veil-cover");`（换页中断/回退时复位；page-load 晚于揭开的 setTimeout，正常路径它是 no-op）。

### C. 遮罩样式（editorial.css；**整段删除 020 的 `.ed-loading` 区块**（含 keyframes 与 reduce 块），插回 `.ed-progress` 区域之后）

```css
/* target */
/* --- 全局换页遮罩：导航时纸色盖屏（180ms），swap 后揭开（240ms）。
   盖屏节奏由 BaseLayout 的 nav-veil-cover 状态机保证（≥180ms）。
   非对称：盖屏快、揭开从容；纯 opacity，不触发布局 --- */
.ed-veil {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--color-ed-bg);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  /* 揭开：移除 nav-veil-cover 后走这段（240ms 从容淡出） */
  transition:
    opacity 240ms var(--ease-ed),
    visibility 0s linear 240ms;
}
html.nav-veil-cover .ed-veil {
  opacity: 1;
  visibility: visible;
  /* 盖屏：180ms 快速压上 */
  transition:
    opacity 180ms var(--ease-ed),
    visibility 0s;
}
```

（无单独 reduce 分支——纯 opacity 过渡对 reduced-motion 天然合规。）

### D. root VT 恢复零动画（editorial.css）

swap 发生在遮罩之下，交叉淡化是多余的。把 020 的交叉淡化规则与 keyframes 换回 none 规则，并删除 `--dur-page-out/--dur-page-in` tokens（020 加回的）：

```css
/* target — 替换 ::view-transition-old/new(root) 两条规则与 page-out/page-in keyframes */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
```

site-nav 四条 none 规则保留；`:root` 注释更新为「换页在遮罩下 swap，root 快照零动画」。

### 保留不动

nav-fast 全套、018 预取、错峰封顶、首访完整编排、016 进度条、导航收起等全部既有系统。

## Repo conventions to follow

- `html.*` 状态类范式（`nav-fast`/`ed-ready`）；token `--ease-ed`（editorial.css:28）。
- 非对称节奏注释风格参照 editorial.css 既有工艺约束注释。

## Steps

1. BaseLayout.astro：删 `.ed-loading` markup 与 nav-loading 三处钩子 → 加 `.ed-veil` markup 与 Target B 状态机。
2. editorial.css：删 `.ed-loading` 整段（样式 + `ed-loading-sweep`/`ed-loading-pulse` keyframes + reduce 块）→ 插入 Target C 遮罩样式（同一位置）。
3. editorial.css：删 `--dur-page-out/--dur-page-in` tokens（含注释行）；root VT 交叉淡化规则 + `page-out`/`page-in` keyframes 替换为 none 规则；site-nav 规则与注释不动。
4. 自检：`grep -rn "nav-loading\|ed-loading" src/` 无结果；`grep -rn "nav-veil-cover" src/layouts/BaseLayout.astro src/styles/editorial.css` 各命中；`grep -n "dur-page\|page-out\|page-in" src/styles/editorial.css` 无结果；`grep -rn "view-transition-name" src/` 仅 site-nav 且在 none 规则内。

## Boundaries

- 不动 nav-fast/预取/错峰封顶/首访编排/016 进度条。
- 遮罩 `pointer-events: none`（不拦截交互）；不加 logo/文字等装饰（保持纯遮罩）。
- 不给其他元素加 view-transition-name。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-4 自检 grep 清零。
- **Feel check**（preview）:
  - 点击导航：纸色遮罩 ~180ms 盖屏 → 揭开露出新页，节奏恒定、无闪断；预取命中与慢速取页的节奏一致（前者遮罩多盖 ~100ms）。
  - 遮罩之下新页内容完整（无逐条入场）——揭开即终态。
  - 连续快速点击多个导航：遮罩不复位错乱，最终停在最后目标页。
  - Rendering 面板 reduced-motion：遮罩淡入淡出（纯 opacity）照常。
  - 首访硬刷新：无遮罩，完整编排不变。
- **Done when**: 每次导航都有恒定节奏的全页遮罩过渡，等待被遮罩自然吸收。
