# 026 — 换页过渡改「磨砂对焦」：点击即失焦，swap 后对焦呈现

- **Status**: TODO（用户反馈：点击后反馈感不强、无法确定是否点击；要求点击后马上衔接过渡动画）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

024/025 的圆形揭示从 swap 才开始，且 ease-in-out 起手慢——点击后前 ~100ms 屏幕毫无变化，「无法确定是否点击」。需要**点击瞬间即生效**的过渡：反馈不能等取页、不能等缓动起步。

**选型：磨砂对焦（frost transition）**——点击瞬间，全页磨砂玻璃层 100ms 压上（`backdrop-filter: blur` 把当前页实时糊掉，磨砂量随透明度渐增，第一帧即有肉眼可见变化）；新页在磨砂之下 swap；随后磨砂层 260ms 退散，新页从模糊「对焦」清晰呈现。即时反馈（失焦）、优雅收尾（对焦）、无色块（磨砂透出页面本身），慢网时磨砂态持续=明确的加载状态。

## Target

### A. 磨砂层 markup（BaseLayout.astro，`.ed-progress` span 旁；025 的 `.ed-loading` div **保留**）

```astro
<!-- 全局换页磨砂层：点击即失焦，swap 后对焦呈现（见 editorial.css .ed-veil） -->
<div class="ed-veil" aria-hidden="true"></div>
```

### B. 状态 JS（BaseLayout.astro；024 的点击坐标捕获监听**整段删除**——圆形揭示不再使用；025 的 nav-loading 钩子**保留**）

```ts
// 全局换页磨砂层：点击（路由拦截取页）即挂 nav-frost——当帧开始失焦；
// swap 后移除，260ms 对焦呈现。慢网时磨砂态持续=明确加载状态。
document.addEventListener("astro:before-preparation", () => {
  document.documentElement.classList.add("nav-frost");
});
```

并在现有 `astro:after-swap` 监听里加 `document.documentElement.classList.remove("nav-frost");`；在现有 `astro:page-load` 回调开头加同样一行（兜底复位）。

### C. 磨砂层样式（editorial.css，`.ed-loading` 区块之前）

```css
/* target */
/* --- 全局换页磨砂层：点击当帧整页失焦（120ms ease-out 快起），
   swap 后 260ms 对焦呈现新页。磨砂量随透明度渐增，非色块遮盖。
   非对称：失焦快（反馈即时）、对焦从容（呈现清晰） --- */
.ed-veil {
  position: fixed;
  inset: 0;
  z-index: 999;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  background: color-mix(in srgb, var(--color-ed-bg) 45%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  /* 对焦：移除 nav-frost 后走这段（260ms 从容变清晰） */
  transition:
    opacity 260ms var(--ease-ed),
    visibility 0s linear 260ms;
}
html.nav-frost .ed-veil {
  visibility: visible;
  opacity: 1;
  /* 失焦：100ms 快起，点击当帧即有变化 */
  transition:
    opacity 100ms ease-out,
    visibility 0s;
}
```

要点：
- 磨砂 = `backdrop-filter: blur(10px)` + 45% 纸色调——透出页面本身，「失焦/对焦」而非色块遮盖；`opacity` 渐变时模糊量随之渐增，单属性动画即有完整效果。
- 失焦 100ms ease-out（快起=即时反馈），对焦 260ms expo-out（从容清晰）。
- `pointer-events: none`，不拦截交互；两个 `backdrop-filter` 前缀都要（Safari）。
- 慢网时磨砂态持续期间，025 的扫描条在顶部同步指示进度（两者互补不冲突）。

### D. 移除圆形揭示 VT（editorial.css）

swap 在磨砂之下进行，VT 扩散不再可见也不需要。把 `::view-transition-old/new(root)` 的 vt-reveal 规则与 `@keyframes vt-reveal` 替换回零动画：

```css
/* target */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
```

reduce 块中的 `::view-transition-new(root) { animation: none; }`（024 加的）一并删除（冗余）。site-nav 四条 none 规则**保留**。

### 保留不动

025 加载条（markup/JS/CSS 全套）、nav-fast、预取、错峰封顶、首访编排、016 进度条。

## Repo conventions to follow

- token：`--ease-ed`、`--color-ed-bg`；`color-mix` 与 `backdrop-filter` 站内已有先例（`site-nav` 的 `backdrop-filter: blur(12px)`、`.col-dialog::backdrop` 的 `color-mix`）。
- `html.*` 状态类范式。

## Steps

1. BaseLayout.astro：删点击坐标捕获 → 加磨砂 markup（A）与 nav-frost 钩子（B）。
2. editorial.css：插磨砂样式（C，`.ed-loading` 之前）；root VT 换回 none + 删 keyframes + 删 reduce 冗余（D）。
3. 自检：`grep -rn "vt-reveal\|--vt-x\|nav-veil" src/` 无结果；`grep -n "nav-frost" src/layouts/BaseLayout.astro src/styles/editorial.css` 各命中；`grep -n "backdrop-filter" src/styles/editorial.css | grep -i veil` 命中。

## Boundaries

- 不动 025 加载条、nav-fast、预取、错峰封顶、首访编排、016 进度条、导航收起。
- 磨砂层不加文字/logo；不改 backdrop-filter blur 值（10px）与色调比例（45%）。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-3 自检 grep。
- **Feel check**（preview）:
  - 点击导航：**当帧整页开始失焦**（100ms 内明确变模糊）——不可能怀疑是否点到了；随后 ~260ms 对焦清晰呈现新页。
  - 本地快路径：失焦+对焦一个短促柔和的「呼吸」，总感知 ~300ms，无色块无白屏。
  - Slow 3G：磨砂态持续 + 顶部扫描条指示进度，新页对焦呈现。
  - Rendering 面板 reduced-motion：磨砂淡入淡出照常（纯 opacity 过渡）。
  - 首访硬刷新：无磨砂，完整编排不变。
- **Done when**: 点击当帧有明确视觉反馈（失焦），swap 后对焦呈现新页。
