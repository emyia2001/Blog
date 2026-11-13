# 010 — 性能杂项：进度线 scaleX、will-change 清理、Nav 滚动 rAF、qrtree 空闲停帧

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 5 性能
- **Estimated scope**: 4 文件（src/components/MiniPlayer.astro、src/pages/timeline.astro、src/components/Nav.astro、src/scripts/qrtree/app.js）

## Problem

四个互相独立的小性能问题：

**A. 播放进度线每 4Hz 写 `width`**（布局属性）：

```ts
// src/components/MiniPlayer.astro 约 303-311 行 — current
this.audio.addEventListener("timeupdate", () => {
  if (!this.audio) return;
  const { audio, progress } = this;
  if (audio.duration && progress) {
    const pct = (audio.currentTime / audio.duration) * 100;
    progress.style.width = `${pct}%`;
  }
});
```

进度线 markup（约 43-49 行）：容器 `w-24 h-px`，内部 `#mp-progress` 初始 `style="background: var(--color-ed-fg); width: 0%;"`。

**B. 时间轴每行常驻 `will-change: transform`**（只为 4px 悬停位移，每行一个合成层）：

```css
/* src/pages/timeline.astro:488-495 — current */
.tl-simple__body {
  flex: 1;
  min-width: 0;
  padding-bottom: 0.25rem;
  transform-origin: left center;
  transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
```

**C. Nav 滚动监听未做 rAF 合帧**（每个 scroll 事件直接做 querySelector + class 切换；BaseLayout/BackToTop 都已是 rAF + passive 范式）：

```ts
// src/components/Nav.astro:498-522 — current
let lastScrollY = window.scrollY;
let scrollAcc = 0;
function setNavHidden(hidden: boolean) {
  document.querySelector(".site-nav")?.classList.toggle("is-hidden", hidden);
  document.documentElement.classList.toggle("nav-hidden", hidden);
}
window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    const dy = y - lastScrollY;
    lastScrollY = y;
    if (y < 80) { scrollAcc = 0; setNavHidden(false); return; }
    if (dy * scrollAcc < 0) scrollAcc = 0;
    scrollAcc += dy;
    if (scrollAcc > 24 && document.body.style.overflow !== "hidden") setNavHidden(true);
    else if (scrollAcc < -12) setNavHidden(false);
  },
  { passive: true }
);
```

**D. /tree 页 WebGL 在 reduced-motion 下仍每帧全速重绘**（场景静止时不停循环）：

```js
// src/scripts/qrtree/app.js:181-207 — current（frame 循环尾部）
renderer.render(state);
raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
```

## Target

**A**：进度线固定满宽 + `scaleX`；timeupdate 写 transform；加 250ms linear 过渡让 4Hz 跳变之间平滑滑行。

```html
<!-- target markup -->
<div
  id="mp-progress"
  class="h-px"
  style="background: var(--color-ed-fg); width: 100%; transform: scaleX(0); transform-origin: 0 50%;"
></div>
```

```ts
// target JS
if (audio.duration && progress) {
  const pct = audio.currentTime / audio.duration;
  progress.style.transform = `scaleX(${pct})`;
}
```

```css
/* target CSS（#mp-progress 现有规则约 134-140 行，追加 transform 过渡） */
#mp-progress {
  transition:
    opacity 200ms var(--ease-ed),
    transform 250ms linear;
}
```

**B**：删除 `.tl-simple__body` 的 `will-change: transform;` 一行（transition 保留，010 之后 008 会把曲线换 token——互不影响）。

**C**：滚动逻辑包进 rAF（把读 y 和累加判断放到帧回调里）：

```ts
// target
let lastScrollY = window.scrollY;
let scrollAcc = 0;
let pendingY: number | null = null;
let navTick = false;
function setNavHidden(hidden: boolean) {
  document.querySelector(".site-nav")?.classList.toggle("is-hidden", hidden);
  document.documentElement.classList.toggle("nav-hidden", hidden);
}
function applyScroll() {
  navTick = false;
  const y = pendingY ?? window.scrollY;
  const dy = y - lastScrollY;
  lastScrollY = y;
  if (y < 80) { scrollAcc = 0; setNavHidden(false); return; }
  if (dy * scrollAcc < 0) scrollAcc = 0;
  scrollAcc += dy;
  if (scrollAcc > 24 && document.body.style.overflow !== "hidden") setNavHidden(true);
  else if (scrollAcc < -12) setNavHidden(false);
}
window.addEventListener(
  "scroll",
  () => {
    pendingY = window.scrollY;
    if (!navTick) {
      navTick = true;
      requestAnimationFrame(applyScroll);
    }
  },
  { passive: true }
);
```

（`astro:page-load` 重置逻辑与 focusin 逻辑不动。）

**D**：reduced-motion 下场景「落定」即停止 rAF；任何改变状态的操作重新拉起帧循环：

```js
// target（app.js）
function kickFrame() {
  if (raf === 0 && !paused) raf = requestAnimationFrame(frame);
}

// frame() 尾部改为：
renderer.render(state);
if (!reduced) {
  raf = requestAnimationFrame(frame);
} else {
  const settled =
    Math.abs(state.flatCur - (state.isFlat ? 1 : 0)) < 0.001 &&
    Math.abs(rainCur - (state.season === 2 ? 1 : 0)) < 0.001 &&
    (burst < 0 || state.time - burst > 1.2);
  raf = settled ? 0 : requestAnimationFrame(frame);
}
```

然后 `grep -n "addEventListener\|burst =\|season =\|isFlat" src/scripts/qrtree/app.js` 找出所有用户交互/状态变更入口（指针拖拽、点击爆发 burst、季节切换、压平切换、resize 等），在它们修改状态后调用 `kickFrame()`。**原则：宁可多调一次 kickFrame，也不允许场景停在过渡中间。**

## Repo conventions to follow

- rAF + passive 范式：`src/layouts/BaseLayout.astro:321-330`、`src/components/BackToTop.astro:45-50`。
- scaleX 填充范例：`src/components/SearchModal.astro:123-133`。

## Steps

1. MiniPlayer.astro：按 Target A 改 markup 内联样式、timeupdate JS、`#mp-progress` CSS 过渡。检查播放/暂停时有没有其他写 progress.width 的行（`grep -n "progress.style" src/components/MiniPlayer.astro`）一并改。
2. timeline.astro：删 `will-change: transform;` 一行。
3. Nav.astro：按 Target C 重写 scroll 监听（保持 setNavHidden、focusin、astro:page-load 原样）。
4. qrtree/app.js：按 Target D 加 kickFrame 与落定判断；给全部状态变更入口补 kickFrame()。

## Boundaries

- 不动 MiniPlayer 音量淡入淡出、均衡器；不动 Nav 的显示判定阈值（24/-12/80）；不动 qrtree 渲染器与着色器。
- qrtree 若找不到某个交互入口，宁可保持它常驻循环（现状），并在报告中说明，不要猜测乱挂钩子。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "progress.style.width" src/components/MiniPlayer.astro` 无结果；`grep -n "will-change" src/pages/timeline.astro` 无结果。
- **Feel check**:
  - 播放音乐：进度线连续滑行（无 4Hz 抽动）；暂停/恢复正常。
  - 长页面快速滚动：导航收起/露出行为与改动前一致（累计阈值判断逻辑未变）。
  - /tree 页 reduced-motion 开启、等场景静止：DevTools Performance 录制 5s，无持续 rAF 帧活动；切季节/点击树，动画仍能播放并再次停住。
- **Done when**: 四项全部落地且行为无回归。
