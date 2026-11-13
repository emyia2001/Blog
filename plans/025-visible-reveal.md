# 025 — 圆形揭示改为全程可见 + 慢等待加载条

- **Status**: TODO（用户反馈：感觉不到效果——慢放截图证实 expo-out 让 300ms 扩散在感知上等于瞬间硬切）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 缓动修正
- **Estimated scope**: 2 文件（src/styles/editorial.css、src/layouts/BaseLayout.astro）

## Problem

024 的圆形揭示机制在工作（CDP 慢放截图证实），但缓动选错：`--ease-ed`（expo-out，cubic-bezier(0.16,1,0.3,1)）在 30% 时间点已完成 ~85% 的扩张——300ms 的扩散在感知上等于瞬间硬切，用户「感觉不到效果」。

另外，导航取页等待期（dev 冷编译/线上网络）旧页原地冻结无反馈——021 删掉的加载条需要以「仅真等待出现」的形态回归。

## Target

### A. 圆形扩散缓动与时长（editorial.css）

尺寸/clip 生长类动画按 AUDIT 决策序属「on-screen movement → ease-in-out」。换用 AUDIT 的强 ease-in-out 曲线，时长 400ms——起手慢（看得见开始）、中段加速、收尾缓，全程可见：

```css
/* target — 替换 ::view-transition-new(root) 规则与 vt-reveal keyframes（old 的 animation: none 保留） */
::view-transition-new(root) {
  animation: vt-reveal 400ms cubic-bezier(0.77, 0, 0.175, 1) both;
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

### B. 慢等待加载条回归（仅真等待出现）

**markup（BaseLayout.astro，`.ed-progress` span 旁，020 时删掉的位置）**：

```astro
<!-- 换页等待指示：取页超过 300ms 才出现（CSS 延迟门），慢网/dev 冷编译时的全局反馈 -->
<div class="ed-loading" aria-hidden="true"><span class="ed-loading__bar"></span></div>
```

**JS（BaseLayout.astro，nav-fast 的 `astro:after-swap` 监听旁）**：

```ts
// 换页等待指示：取页阶段挂 nav-loading，300ms 内完成的换页（预取命中）不会闪条
document.addEventListener("astro:before-preparation", () => {
  document.documentElement.classList.add("nav-loading");
});
document.addEventListener("astro:after-swap", () => {
  document.documentElement.classList.remove("nav-loading");
});
```

（`astro:page-load` 回调开头同样 `classList.remove("nav-loading")` 兜底复位。）

**CSS（editorial.css，`.ed-progress` 区域之后）**：

```css
/* target */
/* --- 换页等待指示：仅当取页超过 300ms 才出现（慢网/dev 冷编译的全局反馈） --- */
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
  /* 300ms 显示延迟门：预取命中的快速换页不闪条 */
  transition:
    opacity 120ms linear 300ms,
    visibility 0s linear 300ms;
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
    animation: ed-loading-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes ed-loading-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}
```

（与 020 的差异仅在延迟门：150ms → **300ms**，进一步降低本地快路径闪条概率。）

### 保留不动

nav-fast 全套、预取、错峰封顶、首访编排、016 进度条、点击坐标捕获（024 的 C 段）、旧页快照 animation: none。

## Repo conventions to follow

- AUDIT ease-in-out 强曲线：`cubic-bezier(0.77, 0, 0.175, 1)`（AUDIT.md 指定值，勿用近似）。
- 加载条范式：020 曾实现的 `.ed-loading`（本计划同款，改延迟门）。

## Steps

1. editorial.css：替换 `::view-transition-new(root)` 动画声明与 `vt-reveal` keyframes（A）。
2. BaseLayout.astro：加 markup 与 before-preparation/after-swap 钩子 + page-load 兜底（B）。
3. editorial.css：插入 `.ed-loading` 样式块（B，`.ed-progress` 区域之后）。
4. 自检：`grep -n "0.77, 0, 0.175, 1" src/styles/editorial.css` 命中；`grep -n "nav-loading" src/layouts/BaseLayout.astro` 命中 ≥2；`grep -n "300ms" src/styles/editorial.css | grep -i loading` 命中延迟门。

## Boundaries

- 不动 nav-fast/预取/错峰封顶/首访编排/点击坐标捕获/旧页快照静止规则。
- keyframes 的 from/to 圆心与半径表达式不改（只改 easing 与时长）。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-4 grep。
- **Feel check**（preview）:
  - 点击导航：圆形扩散**全程肉眼可见**——起手慢、中段快、收尾缓，从点击位置长出来盖过旧页，~400ms。
  - 本地快路径（预取命中）：加载条不闪现；DevTools Slow 3G 下：出现扫描条直到 swap。
  - Rendering 面板 reduced-motion：换页即时、加载条整条呼吸。
- **Done when**: 扩散全程可见（用 DevTools Animations 面板 10% 速度目检：圆形从 0 匀感长到全屏）。
