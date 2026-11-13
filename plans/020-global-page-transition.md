# 020 — 全局换页过渡：顶部加载条 + 极短交叉淡化

- **Status**: TODO
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH（用户决策：换页要有全局过渡加载动画，避免不连贯/卡顿感；019 的零动画方案由本计划替代，但 nav-fast 跳过入场编排**保留**）
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

019 之后导航换页是硬切：取页期间零反馈（线上网络/dev 冷编译时点一下要白等 ~1s，观感「卡住」），swap 又是瞬间跳变（观感「不连贯」）。用户要求：全站统一的换页过渡加载动画。

## Target

**两层设计**：
1. **顶部加载条**：取页阶段（`astro:before-preparation` → `astro:after-swap`）视口顶部出现 2px 砖红扫描线。**带 150ms 显示延迟**——预取命中的瞬时换页不闪条，真实等待才出现反馈。
2. **极短交叉淡化**：swap 时旧页 100ms 淡出、新页 200ms 淡入（纯 opacity，无位移无模糊），衔接连贯且依然快。nav-fast（跳过内容入场编排）保留——新页内容首帧即终态，淡化只作用于整页快照。

### A. 加载条 markup（BaseLayout.astro，加在 `.ed-progress` span 旁，约 166-167 行）

```astro
<!-- 全局换页加载条：取页阶段顶部细线扫描（见 editorial.css .ed-loading） -->
<div class="ed-loading" aria-hidden="true"><span class="ed-loading__bar"></span></div>
```

### B. 加载条状态 JS（BaseLayout.astro 脚本，加在 nav-fast 的 `astro:after-swap` 监听处；可与现有监听合并）

```ts
// 全局换页加载条：取页阶段出现，swap 后消失。
// CSS 带 150ms 显示延迟，预取命中的瞬时换页不会闪条。
document.addEventListener("astro:before-preparation", () => {
  document.documentElement.classList.add("nav-loading");
});
```

并在现有 `astro:after-swap` 监听里加 `document.documentElement.classList.remove("nav-loading");`；在现有 `astro:page-load` 回调开头同样加一行（兜底：换页中断/回退时复位）。

### C. 加载条样式（editorial.css，插在 `.ed-progress` 区域之后）

```css
/* target */
/* --- 全局换页加载条：取页期间顶部细线扫描，给真实等待以反馈 --- */
.ed-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 999;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 120ms linear,
    visibility 0s linear 120ms;
}
.ed-loading__bar {
  display: block;
  width: 40%;
  height: 100%;
  background: var(--color-ed-accent);
  opacity: 0.85;
}
html.nav-loading .ed-loading {
  opacity: 1;
  visibility: visible;
  /* 150ms 显示延迟：预取命中的瞬时换页不闪条 */
  transition:
    opacity 120ms linear 150ms,
    visibility 0s linear 150ms;
}
html.nav-loading .ed-loading__bar {
  animation: ed-loading-sweep 900ms linear infinite;
}
@keyframes ed-loading-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  html.nav-loading .ed-loading__bar {
    width: 100%;
    /* reduce 下不做扫描，改为整条透明度缓动 */
    animation: ed-loading-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes ed-loading-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}
```

（循环扫描用 `linear`——恒定运动规范；transform/opacity only，不触发布局。）

### D. 恢复极短交叉淡化 VT（editorial.css）

tokens（`:root` 内，019 删除处）：

```css
/* target */
  /* 换页过渡：极短纯透明度交叉淡化，衔接 swap（用户决策 2026-11-12：全局过渡保连贯） */
  --dur-page-out: 100ms;
  --dur-page-in: 200ms;
```

VT 规则（019 的 none 规则处替换；site-nav 四条 none 规则**保留不动**）：

```css
/* target */
/* Page transitions: 极短纯透明度交叉淡化（无位移/模糊）——内容经 nav-fast 首帧即终态，
   淡化只作用于整页快照，衔接连贯且不拖慢换页。纯 opacity 对 reduced-motion 天然友好。 */
::view-transition-old(root) {
  animation: page-out var(--dur-page-out) var(--ease-ed) both;
}
::view-transition-new(root) {
  animation: page-in var(--dur-page-in) var(--ease-ed) both;
}
@keyframes page-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes page-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 保留不动

- nav-fast 全套（跳过入场编排）、018 预取、错峰封顶、首访完整编排。
- 016 进度条、导航收起、MiniPlayer 等其他系统。
- `.prose img` 载入淡入。

## Repo conventions to follow

- `--color-ed-accent`、`--ease-ed` token（editorial.css:28）；`.search-loading__bar` 的扫描线范式（SearchModal.astro:116-135）；giscus-load 的透明度脉冲范式（Giscus.astro:40）。
- 状态类挂 `<html>`（`html.nav-loading`），与 `html.nav-fast`/`html.ed-ready` 同款。

## Steps

1. BaseLayout.astro：加 markup（A）与三处 JS（B）。
2. editorial.css：插加载条样式（C，放 `.ed-progress` 区域之后）。
3. editorial.css：`:root` 加回两个 token（D）；替换 019 的 root none 规则为交叉淡化 + keyframes；site-nav none 规则与注释不动。
4. 自检：`grep -n "nav-loading" src/layouts/BaseLayout.astro src/styles/editorial.css` 各命中；`grep -n "ed-loading-sweep\|ed-loading-pulse" src/styles/editorial.css` 命中；`grep -n "animation: none" src/styles/editorial.css` 仅剩 site-nav 四条。

## Boundaries

- 不动 nav-fast/预取/首访编排/错峰封顶。
- 加载条不出现在首访（事件只由换页触发）。
- 不动 site-nav 具名快照规则；不给其他元素加 view-transition-name。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-4 自检 grep。
- **Feel check**（preview）:
  - 本地快速切换（预取命中）：换页为 ~200ms 内的轻交叉淡化，加载条**不闪现**（150ms 延迟门）。
  - DevTools Network 面板设 throttling（Slow 3G）再切换：点击后顶部立即出现砖红扫描线，swap 后消失——等待有反馈、不卡住。
  - Rendering 面板 reduced-motion：加载条整条缓动呼吸、无扫描；换页淡化不变（纯 opacity）。
  - 首访硬刷新：完整编排不变，无加载条。
- **Done when**: 换页有连贯过渡 + 真实等待有全局反馈，快路径无闪条。
