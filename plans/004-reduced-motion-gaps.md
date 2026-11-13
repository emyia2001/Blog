# 004 — reduced-motion 缺口补全 + 误杀反馈的 reduce 块修复

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 6 可访问性
- **Estimated scope**: 约 9 文件（src/pages/timeline.astro、src/components/GraphView.astro、Nav.astro、ContributionHeatmap.astro、SearchModal.astro、BackToTop.astro、Sidebar.astro、FriendTreeDialog.astro、src/pages/collection.astro、src/styles/editorial.css）

## Problem

两方向的问题：

**A. 位移动画缺 reduced-motion 覆盖**（reduce 用户仍看到运动）：

| 位置 | 现状 |
|---|---|
| `src/pages/timeline.astro:411-414` `.timeline-point` | `opacity: 0` + `tl-point-in 0.5s`（translateY(8px) 上浮）+ 最长 0.63s 的 stagger delay；reduce 块（674-692 行）只覆盖 lock-* 元素 |
| `src/pages/timeline.astro:438-441` `.tl-seg` | `scaleY(0)` 起步的 `tl-seg-grow 0.5s`；无 reduce 覆盖 |
| `src/pages/timeline.astro:476-480` `.tl-simple__dot` hover scale(1.25) / `495-499` `.tl-simple__body` hover translateX(4px) | 无 reduce 覆盖 |
| `src/components/GraphView.astro:741-762` reduce 块 | 设了 `.graph-node/.graph-link/.graph-label` 的 transition none，**漏掉** `.graph-node-shape/.graph-node-halo`（transform 0.28s + hover scale(1.12)，约 466-478 行） |
| `src/pages/collection.astro:813-822` reduce 块 | 漏掉 `.col-bank[data-mode="album"] .vol__cover`（260ms + hover scale(1.14)）、`.col-wallcard:hover` translateY(-4px)（约 500-505 行）、`.col-dialog__score-fill` |
| `src/components/Nav.astro` reduce 块（约 213-224、337-349 行） | 漏掉 `.nav-drawer-link:hover` 的 translateX(3px)（约 298-302 行） |
| `src/styles/editorial.css` reduce 块（约 1539-1544 行） | 对 `.search-result:hover` 只杀了 transition，位移仍瞬跳生效 |

**B. reduce 块「一刀切 transition: none」，把透明度反馈也杀了**（规范：reduce 是更少更缓，不是归零——保留助理解的透明度过渡、去掉位移）：

| 位置 | 现状 |
|---|---|
| `src/components/SearchModal.astro:147-153` | `.search-modal, .search-panel … { transition: none; }` — 开关变成硬切 |
| `src/components/BackToTop.astro:111-115` | `.back-to-top, .back-to-top svg { transition: none; }` |
| `src/components/Nav.astro:213-220` | `#nav-drawer, #nav-backdrop … { transition: none; }` |
| `src/layouts/Sidebar.astro:512-518` | `#toc-panel, #toc-backdrop … { transition: none; }` |
| `src/components/GraphView.astro:741-749` | `.graph-detail … { transition: none; }` |
| `src/components/FriendTreeDialog.astro:525-533`、`src/pages/collection.astro:819-822` | 面板 `animation: none`（002 计划若已执行，这里已是 transition 型——同步改成 opacity-only） |

## Target

原则（照 AUDIT 与站内范例 MiniPlayer.astro:152-156「入场只留 opacity，不做位移」）：

```css
/* A 类：位移归零 + 保留 opacity 型入场 */
@media (prefers-reduced-motion: reduce) {
  /* timeline.astro 追加进现有 reduce 块 */
  .timeline-point {
    opacity: 1;
    animation: tl-fade 160ms linear both;
    animation-delay: 0s;
  }
  .tl-seg { animation: none; transform: none; }
  .timeline-point:hover .tl-simple__dot { transform: none; }
  .timeline-point:hover .tl-simple__body,
  .timeline-point.is-active .tl-simple__body { transform: none; }
}
@keyframes tl-fade { from { opacity: 0; } to { opacity: 1; } }  /* 与其他 keyframes 放一起 */

/* GraphView.astro reduce 块追加 */
:global(.graph-node-shape),
:global(.graph-node-halo) { transition: none; }
:global(.graph-node.is-hover .graph-node-shape),
:global(.graph-node.is-hover .graph-node-halo) { transform: none; }
:global(.graph-node:active .graph-node-shape) { transform: none; }  /* 007 之后存在则覆盖 */

/* collection.astro reduce 块追加 */
.col-bank[data-mode="album"] .vol__cover { transition: none; }
.col-bank[data-mode="album"] .vol:hover .vol__cover { transform: none; }
.col-wallcard { transition: none; }
.col-wallcard:hover { transform: none; }
.col-dialog__score-fill { transition: none; }

/* Nav.astro reduce 块追加 */
.nav-drawer-link:hover { transform: none; }

/* editorial.css reduce 块追加 */
.search-result:hover { transform: none; }
```

```css
/* B 类：transition: none → opacity-only（逐块替换） */
/* 例：SearchModal.astro */
.search-modal,
.search-panel {
  transition: opacity 150ms linear;
}
```

各 B 类位置的位移相关规则（transform/translate）在 reduce 下置 none，transition 只留 opacity 150ms linear。FriendTreeDialog/collection 的面板按 002 的新结构改：

```css
/* target（002 已执行后的形态） */
.fta__panel,
.col-dialog__panel {
  transform: none;
  transition: opacity 150ms linear;
}
```

若 002 未执行（仍是 keyframe 型），保留 `animation: none` 面板规则，仅给面板补 `{ opacity: 1; transform: none; transition: opacity 150ms linear; }`，并把 backdrop 的 animation:none 保留。

## Steps

1. timeline.astro：reduce 块（约 674-692 行）追加 A 类 timeline 规则；`@keyframes tl-fade` 加在文件其他 @keyframes 附近。
2. GraphView.astro reduce 块追加 shape/halo 规则；确认覆盖 `:active`（若 007 已加）。
3. collection.astro reduce 块追加 vol__cover / wallcard / score-fill 规则。
4. Nav.astro reduce 块追加 drawer-link 规则（两个 reduce 块任选其一，放移动端相关的那块）。
5. editorial.css reduce 块追加 `.search-result:hover { transform: none; }`。
6. B 类六处：逐个把 `transition: none` 改为 opacity-only 过渡，位移终态置 none；确保打开/关闭仍能完成（display/visibility 的瞬时切换允许保留——`visibility 0s` 类规则可留）。
7. 自检：`grep -rn --include="*.astro" --include="*.css" -A6 "prefers-reduced-motion" src/`，对照本计划 A/B 两张表逐条确认覆盖。

## Boundaries

- reduce 下保留：透明度/颜色过渡、状态瞬时切换、SearchModal 即时结果刷新。
- reduce 下移除：一切 translate/scale 位移与 stagger delay。
- 不动 lock-* 元素既有 reduce 规则（已正确）。

## Verification

- **Mechanical**: `npx astro check` 通过。
- **Feel check**（Rendering 面板勾选 prefers-reduced-motion: reduce）：
  - 时间轴页：点/线不位移，快速淡入；hover 无位移但着色保留。
  - 图谱：节点 hover 不缩放；详情面板开关有淡入淡出。
  - 拾集：封面 hover 不缩放；对话框/搜索/抽屉/目录面板开关均为快速淡入淡出（非硬切）。
  - 回到正常模式确认无回归。
- **Done when**: A 表全部有 reduce 覆盖、B 表全部保留 opacity 反馈。
