# 013 — 热力图 tooltip 在格子间滑动（不再瞬移）

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 8 错失的机会（缺失动画）
- **Estimated scope**: 1 文件（src/components/ContributionHeatmap.astro），1 行

## Problem

tooltip 跟随格子定位（JS 改 CSS 变量 `--tx/--ty`），但 transition 只挂了 opacity——指针扫过一行时位置瞬移，只有淡入淡出在过渡：

```css
/* src/components/ContributionHeatmap.astro:211-229 — current（关键两行） */
.heat-tip {
  /* … */
  transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) translate(-50%, -100%);
  transition: opacity 120ms var(--ease-ed);
}
```

## Target

```css
/* target */
transition:
  opacity 120ms var(--ease-ed),
  transform 120ms var(--ease-ed);
```

CSS 变量变化会重算 transform，挂上 transform 过渡后，tooltip 会在格子间以 120ms 滑行；显隐仍由 opacity 过渡。

## Repo conventions to follow

- token：`--ease-ed: cubic-bezier(0.16, 1, 0.3, 1)`（src/styles/editorial.css:28）。

## Steps

1. `src/components/ContributionHeatmap.astro` 约 228 行：把 `transition: opacity 120ms var(--ease-ed);` 替换为上面 Target 的两行式 transition。

## Boundaries

- 只改这一处 transition。不要动 tooltip 的定位 JS、`--tx/--ty` 计算格式的 reduced-motion 逻辑（若有）。

## Verification

- **Mechanical**: `npx astro check` 通过。
- **Feel check**: 指针沿一行连续扫过多个格子：tooltip 平滑跟手滑行、无跳格；快速甩动时也无滞后感（120ms 足够短）。
- **Done when**: tooltip 位置变化有过渡。
