# 008 — 缓动 token 收敛：手打贝塞尔曲线归位

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 7 一致性与 token
- **Estimated scope**: 2 文件实际改动（src/pages/timeline.astro、src/components/ImageLightbox.astro）+ 若 002 未先行则含另 2 文件

## Problem

`cubic-bezier(0.22, 1, 0.36, 1)` 是全站 token `--ease-ed`（`cubic-bezier(0.16, 1, 0.3, 1)`）的视觉近似克隆，被手打了六处；另有三处 JS 字面量复制曲线值。token 一旦微调，这些位置会静默分叉：

- `src/pages/timeline.astro:413` — `animation: tl-point-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;`
- `src/pages/timeline.astro:440` — `animation: tl-seg-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;`
- `src/pages/timeline.astro:493` — `transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);`
- `src/pages/collection.astro:563` — `col-dialog-in 340ms cubic-bezier(0.22, 1, 0.36, 1) both;`（002 计划若已执行，此处已被重写消掉）
- `src/pages/collection.astro:571` — `col-dialog-cover-in 460ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both;`（002 计划把曲线换 token，但 keyframe 保留）
- `src/components/FriendTreeDialog.astro:358` — `fta-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;`（同上）

JS 字面量：

- `src/components/ImageLightbox.astro:24` — `const EASE_ED = "cubic-bezier(0.16, 1, 0.3, 1)";`
- `src/components/GraphView.astro:1441-1468` — 用硬编码系数重新推导 bezier 采样函数
- `src/pages/timeline.astro:947` — `{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }`

## Target

- CSS：六处 `cubic-bezier(0.22, 1, 0.36, 1)` → `var(--ease-ed)`。
- JS：不改逻辑，只在每处加一行注释锚定 token 来源（index.astro 的 `easeFromToken()` 方案见 `src/pages/index.astro:197-228`，但为这三个点引入运行时读取不值得——它们各自独立成组件，字面量 + 注释即可）。

## Repo conventions to follow

- token 定义：`src/styles/editorial.css:26-33`。
- 正确范式 exemplar：`src/pages/index.astro:196` 注释「复用全站动效令牌 --ease-ed（cubic-bezier），而不是另起一条曲线」。

## Steps

1. `src/pages/timeline.astro` 413、440、493 行：`cubic-bezier(0.22, 1, 0.36, 1)` → `var(--ease-ed)`；493 行同时把 `0.16s` → `160ms`（单位惯例）。
2. `src/pages/collection.astro` 与 `src/components/FriendTreeDialog.astro`：`grep -n "0.22, 1, 0.36, 1" src/pages/collection.astro src/components/FriendTreeDialog.astro`，把仍在的替换为 `var(--ease-ed)`（002 已执行的话只剩 cover keyframe 一处）。
3. `src/components/ImageLightbox.astro:24`：在 `EASE_ED` 常量上方加注释：`// 与全站动效令牌 --ease-ed（src/styles/editorial.css）保持一致，改一处需同步`。
4. `src/pages/timeline.astro:947`：同上，WAAPI options 行加注释 `// easing 与全站令牌 --ease-ed 一致`。
5. `src/components/GraphView.astro:1441` 附近：在 bezier 推导函数的注释前加一行 `// 系数为全站令牌 --ease-ed 的四个分量（editorial.css），用于 rAF 采样`。

## Boundaries

- 纯文本替换 + 注释，**不改任何时长、不改逻辑**。
- 不动 index.astro 的 easeFromToken 实现。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -rn "0.22, 1, 0.36, 1" src/` 无结果（时间轴节点入场改用 token 后视觉差异肉眼不可辨，属预期）。
- **Feel check**: 时间轴页入场、节点 hover、拾集对话框开合——节奏与改动前一致（曲线本就几乎相同）。
- **Done when**: 仓库内曲线字面量只剩 token 定义一处 + 三个带注释的 JS 锚点。
