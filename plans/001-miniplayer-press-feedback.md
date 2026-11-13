# 001 — MiniPlayer 按压反馈修复：去掉过度挤压与重放脉冲

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: HIGH
- **Category**: 1 用途与频率 / 3 物理感 / 4 可中断性
- **Estimated scope**: 1 文件（src/components/MiniPlayer.astro）

## Problem

播放/暂停键是全站被最快连续点击的控件，但它的按压反馈过深且不可中断：

```css
/* src/components/MiniPlayer.astro:62-65 — current */
#mp-btn:active,
#mp-play:active {
  transform: scale(0.85);
}
/* src/components/MiniPlayer.astro:66-79 — current */
.mp-pulse {
  animation: mp-pulse 0.28s ease;
}
@keyframes mp-pulse {
  0% { transform: scale(1); }
  40% { transform: scale(0.78); }
  100% { transform: scale(1); }
}
```

问题：
1. `scale(0.85)` 与释放脉冲 `scale(0.78)` 远超全站按压区间（0.94–0.997：nav-link 0.97、tag-chip 0.97、back-to-top 0.96、toc-toggle 0.96）。
2. `.mp-pulse` 是固定时长 keyframe，每次点击用 reflow 强行重放（见 JS），连点时从零重启动画，并与 `:active` 的 transform 互相覆盖。
3. 过渡里 `transform 0.12s ease` 用了 `s` 单位 + 裸 `ease`，全站惯例是 ms + 命名曲线。

JS 侧（约 466-479 行）：

```ts
// src/components/MiniPlayer.astro（<script> 内）— current
// 点击脉冲反馈：重新触发 CSS 动画
pulse() {
  const el = this.playBtn || this.btn;
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.remove("mp-pulse");
  void el.offsetWidth; // 强制 reflow，重启动画
  el.classList.add("mp-pulse");
  // 动画结束后移除 class，保持 DOM 整洁
  el.addEventListener(
    "animationend",
    () => el.classList.remove("mp-pulse"),
    { once: true }
  );
}
```

## Target

```css
/* target */
#mp-btn,
#mp-play {
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 120ms var(--ease-ed),
    opacity 120ms var(--ease-ed);
}
#mp-btn:active,
#mp-play:active {
  transform: scale(0.96);
}
```

- 删除 `.mp-pulse` 类、`@keyframes mp-pulse`、JS `pulse()` 方法及其全部调用点。
- 按压反馈完全交给 `:active` + transition（可中断、可重定向）。

## Repo conventions to follow

- 缓动 token：`--ease-ed: cubic-bezier(0.16, 1, 0.3, 1)`（src/styles/editorial.css:28）。
- 按压区间 0.94–0.997 的范例：`src/styles/editorial.css:400-401`（`.tag-chip:active { transform: translateY(0) scale(0.97); }`）、`src/components/BackToTop.astro:97-101`（非对称 90ms 按下 / 280ms 回弹）。
- 单位惯例：ms + 命名曲线（如 `opacity 120ms var(--ease-ed)`）。

## Steps

1. `src/components/MiniPlayer.astro` 样式块（约 55-79 行）：把 transition 改为 `transform 120ms var(--ease-ed), opacity 120ms var(--ease-ed)`；`:active` 改为 `scale(0.96)`；整段删除 `.mp-pulse` 规则与 `@keyframes mp-pulse`。
2. 同文件约 142-143 行的注释「用 transition 而非 animation，避免和 .mp-pulse 抢同一个 animation 简写。」改为「图标切换（▶/■）：120ms opacity 过渡，避免字形硬切。」（.mp-pulse 已不存在）。
3. 同文件约 148-151 行 reduced-motion 块：删除 `.mp-pulse { animation: none; }`。
4. `<script>` 内（约 466-479 行）：整段删除 `pulse()` 方法；用 `grep -n "pulse()" src/components/MiniPlayer.astro` 找到全部调用点（如 `this.pulse()`），逐个删除该调用行。若删除后某处留下空行/孤立的注释（「点击脉冲反馈：重新触发 CSS 动画」），一并清理。
5. 确认删除后文件内不再出现字符串 `mp-pulse` 与 `pulse(`（`grep -n "mp-pulse\|pulse(" src/components/MiniPlayer.astro` 应无结果）。

## Boundaries

- 只改 `src/components/MiniPlayer.astro`。
- 不要动 `#mp-bar` 入场过渡、均衡器 `.mp-eq`、音量淡入淡出逻辑。
- 不要改任何 HTML 结构；不要新增依赖。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "mp-pulse\|pulse(" src/components/MiniPlayer.astro` 无结果。
- **Feel check**（`npm run dev` 后）：
  - 快速连点播放/暂停：按钮不出现「从零重放的深蹲」，只有轻微软缩回弹。
  - DevTools Animations 面板放慢 10%：按下时缩到 0.96，松开回到 1，无 0.78 深点。
  - 播放条入场、图标切换、均衡器动画不受影响。
- **Done when**: 播放键按压为单一可中断 transition，mp-pulse 全部清除。
