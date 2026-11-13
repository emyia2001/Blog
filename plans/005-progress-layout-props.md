# 005 — 进度条/评分条：布局属性动画改 transform

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 5 性能
- **Estimated scope**: 2 文件（src/styles/editorial.css、src/pages/collection.astro）

## Problem

两处动画触发布局（layout → paint → composite，非合成器友好）：

**A. 阅读进度条过渡 `top`**（导航收起时重新贴顶，每次滚动方向变化都触发）：

```css
/* src/styles/editorial.css:769-779 — current */
/* 有正文（文章页）时显示；由 JS 在首帧计算后可见 */
body:has(.prose) .ed-progress {
  visibility: visible;
}
/* 导航收起后进度条贴到视口顶部 */
.ed-progress {
  transition: top 320ms var(--ease-ed);
}
html.nav-hidden .ed-progress {
  top: 0;
}
```

JS 侧在首帧计算导航高度后写入 `top`（在 `src/layouts/BaseLayout.astro` 的脚本里，`grep -n "ed-progress\|edProgress" src/layouts/BaseLayout.astro` 定位）。

**B. 评分条 JS 写 `width` 动画 480ms**（打开对话框时触发）：

```css
/* src/pages/collection.astro:722-723 — current */
.col-dialog__score-bar { grid-area: bar; position: relative; height: 2px; background: var(--color-ed-hairline); overflow: hidden; }
.col-dialog__score-fill { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--color-ed-accent); transition: width 480ms var(--ease-ed); }
```

```ts
// src/pages/collection.astro 约 1205 行 — current
scoreFill.style.width = `${Math.max(4, Math.min(100, rating * 10))}%`;
```

## Target

**A**：`top` 只作为静态基准（JS 一次性写入不变值），动画走 `transform: translateY()`：

```css
/* target */
.ed-progress {
  top: 0;
  transform: translateY(var(--ed-progress-offset, 0px));
  transition: transform 320ms var(--ease-ed);
}
html.nav-hidden .ed-progress {
  transform: translateY(0);
}
```

JS：把写入 `style.top = …px` 的那一行改为 `el.style.setProperty("--ed-progress-offset", h + "px")`（h 为原计算值，语义不变：正常态在导航下方，`nav-hidden` 时回顶）。若 CSS 里 `.ed-progress` 基础规则已有静态 `top` 声明，删除之（统一由 target 的 `top: 0` 承担）。

**B**：填充条固定满宽、用 `scaleX` 表达比例（条高 2px 无圆角，scaleX 不变形）：

```css
/* target */
.col-dialog__score-fill {
  position: absolute; inset: 0; width: 100%;
  background: var(--color-ed-accent);
  transform: scaleX(0); transform-origin: 0 50%;
  transition: transform 480ms var(--ease-ed);
}
```

JS：

```ts
// target
scoreFill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, rating * 10 / 100))})`;
```

（原 `Math.max(4, …)%` 的最小 4% 视觉下限换算为 0.04。）若附近有「重开时先归零再填充」的复位逻辑（写 width 的其他行），同步改为重置 `transform: scaleX(0)`；用 `grep -n "scoreFill\|score-fill" src/pages/collection.astro` 找全。

## Repo conventions to follow

- 全站动画只动 transform/opacity（editorial.css:415-418 的工艺约束）。
- scaleX 填充范例：`src/components/SearchModal.astro:123-133`（`.search-loading__bar` 用 `scaleX` + `transform-origin: left center`）。

## Steps

1. editorial.css 769-779 行区域按 Target A 重写；`grep -n "style.top\|\.top =" src/layouts/BaseLayout.astro` 找到 ed-progress 的 top 写入行，改为 `setProperty("--ed-progress-offset", …)`。
2. collection.astro 723 行按 Target B 重写；约 1205 行 JS 改写 transform；同文件内其他写 scoreFill.width 的行一并改。
3. reduced-motion：检查 collection.astro 约 813-822 的 reduce 块是否已覆盖 `.col-dialog__score-fill`；没有就补 `{ transition: none; }`（填充瞬时到位，属状态指示，允许瞬变）。

## Boundaries

- 不动进度条的宽度/颜色计算逻辑（value 来自滚动进度）、评分条数值显示。
- 不改 BaseLayout 其他滚动逻辑（Nav 的 rAF 化由 010 计划负责）。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "transition: top" src/styles/editorial.css` 无结果；`grep -n "scoreFill.style.width" src/pages/collection.astro` 无结果。
- **Feel check**:
  - 文章页上下滚动让导航收起/展开：进度条平滑贴顶/回落（320ms 节奏不变），DevTools Performance 录制确认无 layout（紫条）抖动。
  - 打开拾集详情：评分条从 0 平滑填充到评分比例（480ms 节奏不变）；不同评分的书重复打开，比例正确、无残影。
  - Rendering 面板开 reduced-motion：评分条瞬时到位。
- **Done when**: 两处均为合成器友好动画。
