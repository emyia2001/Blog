# 007 — 补齐缺失的按压反馈（图谱/书架/对话框/上下篇）

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 3 物理感与初始点
- **Estimated scope**: 3 文件（src/components/GraphView.astro、src/pages/collection.astro、src/components/PrevNext.astro）

## Problem

全站有一致的按压语言（`:active` 缩放 0.94–0.997 + 快速 transition），但以下主交互件完全缺失，悬停态与按下态之间「手感断档」：

| 位置 | 现状 |
|---|---|
| `src/components/GraphView.astro` 主模式节点（hover 有 `scale(1.12)`，约 475-478 行；点击打开详情抽屉，约 1600-1619 行） | 无 `:active`。裸模式已有范例：约 211-213 行 `:global(.graph-node:active .graph-node-shape) { transform: scale(0.96); … }` |
| `src/pages/collection.astro` 书架左右箭头 `.col-bank__nav`（约 407-418 行，transition 仅 background-color/border-color 180ms ease） | 无 `:active` |
| `src/pages/collection.astro` 对话框关闭 `.col-dialog__close`（约 603-614 行） | 无 `:active` |
| `src/pages/collection.astro` 书本 `.vol`（cursor: pointer，约 319-325 行；悬停态在约 426-436 行 `.vol__cover` scale(1.14)） | 无 `:active` |
| `src/components/GraphView.astro` 详情关闭 `.graph-detail-close`（约 594-611 行）与相关文章 chip `.graph-rel-chip`（约 674-689 行） | 无 `:active` |
| `src/components/PrevNext.astro:54-56` `.pn-link:active { transform: scale(0.99); }` | 有但弱到不可感知（大块两栏链接，1% 缩量） |

## Target

```css
/* GraphView.astro — 主模式节点（插在 .is-hover 规则之后） */
:global(.graph-node:active .graph-node-shape),
:global(.graph-node:active .graph-node-halo) {
  transform: scale(0.96);
}

/* collection.astro — 书架箭头：transition 追加 transform 项，新增 ：active */
.col-bank__nav {
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    transform 120ms var(--ease-ed);
}
.col-bank__nav:active { transform: scale(0.94); }

/* collection.astro — 对话框关闭钮：同样处理 */
.col-dialog__close {
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    transform 120ms var(--ease-ed);
}
.col-dialog__close:active { transform: scale(0.94); }

/* collection.astro — 书本：专辑模式按压封面缩回；书架模式用亮度（书脊有 matrix 基础 transform，不叠加 scale） */
.col-bank[data-mode="album"] .vol:active .vol__cover { transform: scale(0.98); }
.vol { transition: filter 120ms ease; }  /* 若 .vol 已有 transition 声明则合并，不要覆盖书架拖拽用的 transition: none 机制（.col-bank.is-drag .vol 的规则必须保持更高优先级） */
.vol:active { filter: brightness(0.94); }

/* GraphView.astro — 详情关闭钮与 chip */
:global(.graph-detail-close) {
  transition:
    color 180ms ease,
    border-color 180ms ease,
    transform 120ms var(--ease-ed);
}
:global(.graph-detail-close:active) { transform: scale(0.94); }

:global(.graph-rel-chip) {
  transition:
    color 180ms ease,
    border-color 180ms ease,
    transform 120ms var(--ease-ed);
}
:global(.graph-rel-chip:active) { transform: scale(0.97); }

/* PrevNext.astro — 按压加量到可感知区间 */
.pn-link:active { transform: scale(0.98); }
```

## Repo conventions to follow

- 按压范例：`src/styles/editorial.css:400-401`（`.tag-chip:active` 0.97）、`src/components/BackToTop.astro:97-101`（0.96 + 非对称时长）、GraphView 裸模式节点 211-213（0.96）。
- token：`--ease-ed`（editorial.css:28）。按钮类 0.94，小型 chip 类 0.97。

## Steps

1. GraphView.astro：在 `:global(.graph-node.is-hover …)` 规则（约 475-478 行）之后插入主模式 `:active` 规则；确认它与约 741-762 行 reduced-motion 块的关系——该块会设 `transition: none`，`004` 计划稍后补 reduced-motion 下禁用 hover/active 缩放，这里只管主规则。给 `.graph-detail-close`、`.graph-rel-chip` 的 transition 追加 `transform 120ms var(--ease-ed)` 并新增 `:active` 规则。
2. collection.astro：`.col-bank__nav`、`.col-dialog__close` 按 Target 追加 transition 项与 `:active`；`.vol` 的 filter 按压与专辑模式封面对比缩放按 Target 添加。**关键**：确认 `.col-bank.is-drag .vol { transition: none; }`（约 398 行）仍在——拖拽态不得被新 transition 破坏；若 `:active` 的 filter 在拖拽中误触发，给 `.col-bank.is-drag .vol:active { filter: none; }` 补一条。
3. PrevNext.astro：`.pn-link:active` 的 `scale(0.99)` → `scale(0.98)`；确认 `.pn-link` 的 transition 列表含 `transform 120ms var(--ease-ed)`（没有就追加）。
4. 所有新增 `:active` 均不放入 `@media (hover: hover)` 门内（`:active` 触屏同样成立，正是要覆盖触屏）。

## Boundaries

- 不动图谱 d3 物理/缩放/拖拽、书架 drag/settle 逻辑、对话框开关（002 计划负责）。
- 不改 markup。

## Verification

- **Mechanical**: `npx astro check` 通过。
- **Feel check**:
  - 归档页图谱：按下节点（未松开）有轻微收缩；侧栏迷你图谱同样。
  - 拾集页：拖拽书架时按压效果不干扰拖拽（is-drag 态无 filter 闪动）；专辑封面按下从 1.14 收到 0.98。
  - 对话框关闭钮、书架箭头、相关文章 chip、上下篇：按下均有即时轻缩，120ms 内回弹。
- **Done when**: 上表所有件均有可感知、不破坏既有交互的按压反馈。
