# 011 — 去掉标签 chip 的装饰性倾斜

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 1 用途与频率
- **Estimated scope**: 1 文件（src/styles/editorial.css），1 行

## Problem

tag-chip 是高频悬停件（首页右栏 + 全部标签页），hover 的 `rotate(-1deg)` 是纯装饰性倾斜（「看起来好玩」不是用途）：

```css
/* src/styles/editorial.css:384-389 — current */
.tag-chip:hover {
  color: var(--color-ed-accent);
  background: rgba(166, 58, 43, 0.1);
  border-color: rgba(166, 58, 43, 0.25);
  transform: translateY(-1px) rotate(-1deg);
}
```

## Target

```css
/* target */
.tag-chip:hover {
  color: var(--color-ed-accent);
  background: rgba(166, 58, 43, 0.1);
  border-color: rgba(166, 58, 43, 0.25);
  transform: translateY(-1px);
}
```

保留 1px 上浮（与 `.entry-row`、`.home-post-row` 的编辑风悬停语言一致），只去掉倾斜。

## Repo conventions to follow

- 同语言的悬停上浮：`src/styles/editorial.css:284-288`（entry-row translateY(-2px)）。chip 更小，1px 合适。

## Steps

1. `src/styles/editorial.css:388`：`transform: translateY(-1px) rotate(-1deg);` → `transform: translateY(-1px);`

## Boundaries

- 只改这一行。不动 `.tag-chip b` 的 scale(1.08) 计数微反馈（003 计划负责它的 hover 门）、不动 `:active`。

## Verification

- **Mechanical**: `npx astro check` 通过。
- **Feel check**: 首页右栏与 /tags/ 悬停 chip：仍有轻抬与着色，不再歪头。
- **Done when**: 倾斜移除。
