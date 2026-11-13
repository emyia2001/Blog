# 006 — ImageLightbox 蒙层入场改为 transition（修复快速关闭卡住）

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 4 可中断性
- **Estimated scope**: 1 文件（src/components/ImageLightbox.astro）

## Problem

蒙层的入场是 CSS animation，退场却是内联 transition。正在运行的 CSS animation 优先级高于内联 style，所以打开后 320ms 内快速关闭（误触/Esc 反射）时，蒙层会卡在动画帧的透明度上，直到入场动画播完才开始淡出：

```css
/* src/components/ImageLightbox.astro:230-241 — current */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 20, 0.92);
  cursor: zoom-out;
  /* 与图片入场 FLIP 同节奏：320ms 的 dim，避免蒙层先落定、图还在飞 */
  animation: lightbox-fade 320ms var(--ease-ed);
}
/* src/components/ImageLightbox.astro:255-262 — current */
@keyframes lightbox-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

退场（close 函数内，约 84-90 行）：

```ts
// src/components/ImageLightbox.astro — current（close() 内）
s.overlay.style.transition = `opacity ${CLOSE_MS}ms ${EASE_ED}`;
s.overlay.style.opacity = "0";
```

## Target

- 删除 `.lightbox-overlay` 上的 `animation: lightbox-fade …`，删除 `@keyframes lightbox-fade`。
- 入场改由 JS 驱动的 transition：创建 overlay 后先置 `opacity: 0` 并挂上 `transition: opacity 320ms var(--ease-ed)`，下一帧置 `opacity: 1`。
- 退场维持现有内联 transition 不变——入场退场都是 transition 后，中途关闭可平滑重定向。

## Repo conventions to follow

- JS 内联过渡 + 双 rAF 起帧的做法在本文件图片 FLIP 里已有（open() 内对 `s.img.style` 的写法），模仿它。
- `EASE_ED` 常量 = `"cubic-bezier(0.16, 1, 0.3, 1)"`（本文件约 24 行），与全站 token `--ease-ed` 一致，直接复用。

## Steps

1. 样式块 `.lightbox-overlay`（约 230-241 行）：删除 `animation: lightbox-fade 320ms var(--ease-ed);` 一行及其上方那行注释（「与图片入场 FLIP 同节奏…」），保留其余属性。
2. 删除 `@keyframes lightbox-fade`（约 255-262 行）。
3. `open()` 函数（约 92 行起）：在 overlay 元素 `document.body.appendChild(overlay)`（或等效挂载点）之后、图片 FLIP 起帧的同一节奏处，加入：

```ts
// 蒙层入场：transition 而非 keyframe，中途关闭可平滑重定向（与图片 FLIP 同节奏 320ms）
overlay.style.opacity = "0";
overlay.style.transition = `opacity ${OPEN_MS}ms ${EASE_ED}`;
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
  });
});
```

   - 若文件里没有 `OPEN_MS` 常量，按文件中图片入场时长使用的常量/字面量对齐（蒙层注释原写明「与图片入场 FLIP 同节奏：320ms」）；没有就用字面量 `320`。
   - 注意 `open()` 开头有 `if (state) close(true)` 的重建路径，确保每次 open 都重新设置这三个内联样式（元素是新建的，天然满足）。

## Boundaries

- 只改 `src/components/ImageLightbox.astro`。
- 不要动图片 FLIP 的 transform 计算、CLOSE_MS/关闭逻辑、滚轮缩放、拖拽平移。
- 不要改 HTML 结构；不要新增依赖。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "lightbox-fade" src/components/ImageLightbox.astro` 无结果。
- **Feel check**：
  - 打开灯箱：蒙层 320ms 淡入与图片 FLIP 同步落定。
  - 打开后立即（<320ms）点击关闭：蒙层从当前透明度平滑淡出，无卡顿/跳变。
  - Esc 关闭、点蒙层关闭、放大后再关，均正常。
- **Done when**: 蒙层开/关全部走 transition，快速开关不再卡住。
