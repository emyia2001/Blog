# 016 — 阅读进度条：初始化不播滑落动画 + 导航收起时淡出隐藏

- **Status**: TODO
- **Commit**: f53cba8（计划基于执行后工作树；以代码内容为准）
- **Severity**: MEDIUM（回归修复：005 计划改动后引入的行为）
- **Category**: 用户反馈修正
- **Estimated scope**: 2 文件（src/styles/editorial.css、src/layouts/BaseLayout.astro）

## Problem

**A. 页面初始化时红线从视口顶滑到导航下沿。** 进度条的垂直偏移由 CSS 变量驱动，JS 在首帧才写入导航高度；过渡在这一写上被触发：

```css
/* src/styles/editorial.css:810-835 — current */
.ed-progress {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  z-index: 90;
  background: var(--color-ed-accent);
  transform-origin: 0 50%;
  transform: scaleX(0);
  /* 正常态整体下移到导航下沿（JS 把导航高度写入 --ed-progress-offset）；
     导航收起时归零贴顶。用独立 translate 属性而非 transform：transform
     由 JS 逐帧写 scaleX 表达进度，两者互不覆盖，过渡也只作用于贴顶/回落 */
  translate: 0 var(--ed-progress-offset, 0px);
  transition: translate 320ms var(--ease-ed);
  visibility: hidden;
  will-change: transform;
}
/* 有正文（文章页）时显示；由 JS 在首帧计算后可见 */
body:has(.prose) .ed-progress {
  visibility: visible;
}
/* 导航收起后进度条贴到视口顶部 */
html.nav-hidden .ed-progress {
  translate: 0 0;
}
```

```ts
// src/layouts/BaseLayout.astro:299-306 — current
// 停在导航栏下沿（导航自带 2px 砖红顶线，放顶部会与之重叠不可见）：
// 高度写入 --ed-progress-offset，.ed-progress 用 translate 消费（top 恒为 0）
const nav = document.querySelector("nav[aria-label='站点导航']");
if (nav)
  document.documentElement.style.setProperty(
    "--ed-progress-offset",
    `${nav.getBoundingClientRect().height}px`
  );
```

首帧前 `--ed-progress-offset` 未定义 → `translate` 为 0（视口顶）；JS 写入约 66px 后，`transition: translate 320ms` 把这条位移播成了「从上到下」的滑落动画。

**B. 导航收起时红线滑到视口顶常驻。** `html.nav-hidden` 的规则是 `translate: 0 0`——导航滑出视口后，这条砖红细线留在视口最顶端。用户要求：导航收起时这条线应隐藏（随导航一起消失），而不是贴顶停留。

## Target

```css
/* target */
.ed-progress {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  z-index: 90;
  background: var(--color-ed-accent);
  transform-origin: 0 50%;
  transform: scaleX(0);
  /* 正常态整体下移到导航下沿（JS 把导航高度写入 --ed-progress-offset）。
     用独立 translate 属性而非 transform：transform 由 JS 逐帧写 scaleX
     表达进度，两者互不覆盖 */
  translate: 0 var(--ed-progress-offset, 0px);
  visibility: hidden;
  will-change: transform;
}
/* 过渡在首帧 JS 写入 offset 之后才启用（html.ed-ready，见 BaseLayout）：
   初始化不播「从视口顶滑到导航下沿」的动画 */
html.ed-ready .ed-progress {
  transition:
    translate 320ms var(--ease-ed),
    opacity 200ms var(--ease-ed);
}
/* 有正文（文章页）时显示；由 JS 在首帧计算后可见 */
body:has(.prose) .ed-progress {
  visibility: visible;
}
/* 导航收起：进度条随导航一起淡出（200ms），不再滑到视口顶停留 */
html.nav-hidden .ed-progress {
  opacity: 0;
}
```

reduced-motion 块（约 982-984 行）中现存的：

```css
/* current */
.ed-progress {
  transition: none;
}
```

改为保留透明度过渡（reduce 原则：位移归零、透明度保留；`translate` 的变化在 reduce 下本来就无过渡需求，因为导航收起不再动 translate）：

```css
/* target */
.ed-progress {
  transition: opacity 150ms linear;
}
```

JS（BaseLayout 约 301-306 行）：写入 offset 的同一帧给 `<html>` 挂 `ed-ready` 类（同一帧内样式一次计算，translate 变更发生在 `transition: none` 生效期，不会播动画；之后导航收起/展开正常过渡）：

```ts
// target
const nav = document.querySelector("nav[aria-label='站点导航']");
if (nav) {
  document.documentElement.style.setProperty(
    "--ed-progress-offset",
    `${nav.getBoundingClientRect().height}px`
  );
  // 首帧写入后再启用过渡（html.ed-ready）：初始化不播「从视口顶滑下」的动画
  document.documentElement.classList.add("ed-ready");
}
```

同时把上方那行注释里的「（导航自带 2px 砖红顶线，放顶部会与之重叠不可见）」保留，无需改动语义。

## Repo conventions to follow

- 状态门控类的范式：`SearchModal.astro` 的 `[data-open]`、Nav 的 `.is-hidden`。
- reduce 块保留 opacity 过渡的范式：`MiniPlayer.astro:152-156`。

## Steps

1. `src/styles/editorial.css`：按 Target 重写 `.ed-progress` 区域（810-835 行）——基规则去掉 `transition`；新增 `html.ed-ready .ed-progress` 过渡规则（translate 320ms + opacity 200ms，均 `var(--ease-ed)`）；`html.nav-hidden .ed-progress` 由 `translate: 0 0` 改为 `opacity: 0`；两条对应注释按 Target 更新。
2. 同文件 reduced-motion 块（约 982-984 行）：`.ed-progress { transition: none; }` → `transition: opacity 150ms linear;`。
3. `src/layouts/BaseLayout.astro`（约 301-306 行）：把 `if (nav) document…setProperty(...)` 改为 Target 的块（加 `ed-ready` 类与注释）。注意保持该函数其余逻辑（scaleX 进度计算、无 .prose 早退）不动。

## Boundaries

- 不动 scaleX 进度计算、导航收起判定（Nav.astro 的 scrollAcc 阈值）、`body:has(.prose)` 显示门控。
- 不改 `--ed-progress-offset` 的写入时机（仍在首帧函数内）。
- 不动其他计划产出的规则。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "translate: 0 0" src/styles/editorial.css` 无结果；`grep -n "ed-ready" src/styles/editorial.css src/layouts/BaseLayout.astro` 各有命中。
- **Feel check**:
  - 打开任意文章页：红线直接出现在导航下沿，**无**从上往下的滑落动画。
  - 向下滚动让导航收起：红线 200ms 淡出，视口顶部无线条残留；向上滚导航回来，红线在导航下沿淡入。
  - 阅读进度本身（红线从左到右增长）不受影响。
  - Rendering 面板开 reduced-motion：导航收起/展开时红线快速淡入淡出（150ms），无位移。
- **Done when**: 初始化无滑落动画；导航收起时红线隐藏。
