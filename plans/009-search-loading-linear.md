# 009 — 搜索冷加载进度条循环曲线改 linear

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 2 缓动与时长
- **Estimated scope**: 1 文件（src/components/SearchModal.astro），1 行

## Problem

无限循环的「恒定运动」用了 expo-out 曲线。循环里每次迭代都以最快速度开始、以贴零速度结束，产生「减速锯齿」，读起来像卡顿：

```css
/* src/components/SearchModal.astro:123-129 — current */
:global(.search-loading__bar) {
  display: block;
  height: 100%;
  background: var(--color-ed-accent);
  transform-origin: left center;
  animation: search-loading-sweep 1100ms var(--ease-ed) infinite;
}
```

## Target

```css
/* target */
animation: search-loading-sweep 1100ms linear infinite;
```

（恒定运动 → linear，AUDIT 规则。）keyframes 本身不动。

## Repo conventions to follow

- 全站唯一的另一处循环动画 `giscus-load` 用 `ease-in-out infinite`，那是「呼吸」型振荡，不是恒定运动——不要顺手改它。

## Steps

1. `src/components/SearchModal.astro:128`：把 `var(--ease-ed)` 替换为 `linear`，其余不动。

## Boundaries

- 只改这一行。不要动搜索面板开关过渡、结果淡入、防抖逻辑。

## Verification

- **Mechanical**: `npx astro check` 通过。
- **Feel check**: 清空 pagefind 缓存或首次打开搜索（索引冷加载时）观察 1px 进度条：匀速往返，无「每轮开头猛冲、结尾停顿」。
- **Done when**: 循环曲线为 linear。
