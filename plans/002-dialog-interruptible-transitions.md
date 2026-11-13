# 002 — 两个对话框：退场曲线归位 + 开关改可中断 transition

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 2 缓动与时长 / 4 可中断性
- **Estimated scope**: 2 文件（src/components/FriendTreeDialog.astro、src/pages/collection.astro）

## Problem

友链树对话框（`.fta`）与拾集详情对话框（`.col-dialog`）各有两个问题：

**A. 退场曲线错误**——`ease-in` / material 加速曲线用在 UI 退场上（规则：退场 → ease-out；"ease-in on UI is always a finding"），与全站 expo-out token 相悖：

```css
/* src/components/FriendTreeDialog.astro:364-372 — current */
.fta.is-closing::backdrop { animation: fta-backdrop-out 200ms ease-in both; }
@keyframes fta-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
.fta.is-closing .fta__panel { animation: fta-out 200ms cubic-bezier(0.4, 0, 1, 1) both; }

/* src/pages/collection.astro:578-586 — current */
.col-dialog.is-closing::backdrop { animation: col-dialog-backdrop-out 220ms ease-in both; }
@keyframes col-dialog-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
.col-dialog.is-closing .col-dialog__panel { animation: col-dialog-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
```

**B. 开关不可中断**——入场/退场都是 keyframe 互换：入场播到一半按 Esc，`.is-closing` 把动画换成 exit keyframe，面板从「keyframe 的 from 态（opacity:1, transform:none）」重新起跳，产生可见弹跳。keyframe 不能像 transition 一样从当前值重定向。

入场（现状，仅作参照）：

```css
/* src/components/FriendTreeDialog.astro:357-363 — current */
.fta[open] .fta__panel { animation: fta-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes fta-in { from { opacity: 0; transform: translateY(14px) scale(0.978); } to { opacity: 1; transform: none; } }

/* src/pages/collection.astro:560-576 — current */
.col-dialog[open] .col-dialog__panel { animation: col-dialog-in 340ms cubic-bezier(0.22, 1, 0.36, 1) both; will-change: opacity, transform; }
@keyframes col-dialog-in { from { opacity: 0; transform: translateY(18px) scale(0.962); } to { opacity: 1; transform: none; } }
.col-dialog[open] .col-dialog__cover { animation: col-dialog-cover-in 460ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both; }
```

## Target

面板开/关全部改为 **transition 型状态切换**（可用 `@starting-style` 处理 `<dialog>` 从 display:none 打开的起始帧），退场曲线统一 token `--ease-ed`；backdrop 保留 animation（它不存在中途重定向问题），仅把曲线从 `ease-in` 换成 `var(--ease-ed)`。

`friendTreeDialog` 面板 target：

```css
/* target */
.fta__panel {
  opacity: 0;
  transform: translateY(14px) scale(0.978);
  transition:
    opacity 320ms var(--ease-ed),
    transform 320ms var(--ease-ed);
}
.fta[open] .fta__panel { opacity: 1; transform: none; }
@starting-style {
  .fta[open] .fta__panel { opacity: 0; transform: translateY(14px) scale(0.978); }
}
.fta.is-closing .fta__panel {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
  transition:
    opacity 200ms var(--ease-ed),
    transform 200ms var(--ease-ed);
}
```

`col-dialog` 面板 target（同构，时长取原值）：

```css
/* target */
.col-dialog__panel {
  opacity: 0;
  transform: translateY(18px) scale(0.962);
  transition:
    opacity 340ms var(--ease-ed),
    transform 340ms var(--ease-ed);
  will-change: opacity, transform;
}
.col-dialog[open] .col-dialog__panel { opacity: 1; transform: none; }
@starting-style {
  .col-dialog[open] .col-dialog__panel { opacity: 0; transform: translateY(18px) scale(0.962); }
}
.col-dialog.is-closing .col-dialog__panel {
  opacity: 0;
  transform: translateY(12px) scale(0.978);
  transition:
    opacity 220ms var(--ease-ed),
    transform 220ms var(--ease-ed);
}
```

封面入场 `.col-dialog__cover` 的 `col-dialog-cover-in` keyframe **保留**（它是「晚一拍」的编排层，不参与中途关闭问题），但曲线 `cubic-bezier(0.22, 1, 0.36, 1)` 换成 `var(--ease-ed)`。`.col-dialog.is-closing .col-dialog__cover { animation: none; }` 保留。

退场 backdrop 曲线：`fta-backdrop-out 200ms ease-in` → `200ms var(--ease-ed)`；`col-dialog-backdrop-out 220ms ease-in` → `220ms var(--ease-ed)`。

## Repo conventions to follow

- 范例（站点自己的正确实现）：`src/components/SearchModal.astro:58-86`——`data-open` 驱动、transition 取目标态值、开 180ms / 关 140ms 非对称。
- token：`--ease-ed: cubic-bezier(0.16, 1, 0.3, 1)`（editorial.css:28）。
- `@starting-style` 现代浏览器均支持；不支持的环境降级为「打开时瞬现」——可接受。

## Steps

1. **FriendTreeDialog.astro**：按上面 Target 重写 `.fta__panel` 相关规则：
   - 删除 `animation: fta-in …` 与 `@keyframes fta-in`、`animation: fta-out …` 与 `@keyframes fta-out`；
   - `.fta__panel` 基础态设为隐藏态（opacity 0 + 初始 transform + 320ms transition）；
   - `.fta[open] .fta__panel` 设为可见态；补 `@starting-style`；
   - `.fta.is-closing .fta__panel` 覆盖为退场态 + 200ms transition；
   - `.fta.is-closing::backdrop` 的 `fta-backdrop-out` 曲线 `ease-in` → `var(--ease-ed)`（keyframes 保留）。
2. **FriendTreeDialog.astro JS**：找到关闭路径（`grep -n "is-closing\|close(" src/components/FriendTreeDialog.astro`）。若有 `animationend` 监听等待退场结束再真正 `close()`，改为 `transitionend`（或已有的 setTimeout 计时器与 200ms 对齐即可，不必强改）。确认 Esc/遮罩点击路径都走同一个 `.is-closing` 流程。
3. **collection.astro**：按上面 Target 重写 `.col-dialog__panel` 规则（删除 `col-dialog-in/out` keyframes，基础态/`[open]` 态/`@starting-style`/`.is-closing` 态四件套）；`.col-dialog__cover` 的 `col-dialog-cover-in` 曲线换 `var(--ease-ed)`；`.col-dialog.is-closing::backdrop` 曲线 `ease-in` → `var(--ease-ed)`。
4. **collection.astro JS**：`grep -n "closeDetail\|is-closing" src/pages/collection.astro` 找关闭函数。注释原文是「退场：220ms 收回…动画结束再真正 close()（见 closeDetail）」。若它监听 `animationend`，改 `transitionend`；若是 setTimeout(220ms) 保持不变。更新该行注释为「退场：220ms 收回（transition 型，Esc 中途关闭可平滑重定向）」。
5. **两个文件的 reduced-motion 块**（FriendTreeDialog.astro 约 525-533；collection.astro 约 813-822）：原来的 `animation: none` 类规则改为「保留透明度、去掉位移」：

```css
/* target（reduced-motion） */
.fta__panel,
.col-dialog__panel {
  transform: none;
  transition: opacity 150ms linear;
}
```

   backdrop 的 `animation: none` 规则保留；把 backdrop 的 opacity 保持为 1/0 的终值规则不动（参照 MiniPlayer.astro:152-156 的「入场只留 opacity」范例）。若块里已有对 panel 的旧 keyframe 禁用规则，替换之。

## Boundaries

- 只改上述两个文件。
- 不要动 `.fta` 树渲染逻辑、d3/画布、`.col-dialog` 内的评分条（005 计划负责）、书架拖拽。
- 不要把 `<dialog>` 改成非 dialog 方案。

## Verification

- **Mechanical**: `npx astro check` 通过；两个文件里 `grep -n "fta-out\|col-dialog-out\|cubic-bezier(0.4, 0, 1, 1)\|ease-in both"` 无结果。
- **Feel check**:
  - 打开对话框：面板从下方 14px/18px 上浮进入，backdrop 同步压暗。
  - **入场播到一半按 Esc**：面板从当前位置平滑收走（不跳回原位重放）——这是本次修复的核心验收点。
  - 关闭后立即重开：无残留中间态。
  - Rendering 面板开 reduced-motion：开关只有快速淡入淡出、无位移。
- **Done when**: 两个对话框的开关均为可中断 transition，退场曲线为 token。
