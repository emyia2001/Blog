# 012 — 图谱全屏展开/还原：FLIP 位移动画 + 遮罩淡入淡出 + 图标旋转切换

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: MEDIUM
- **Category**: 8 错失的机会（空间连贯性）
- **Estimated scope**: 1 文件（src/components/GraphView.astro）

## Problem

图谱全屏展开是把布局元素 reparent 到 `document.body` 并切 `.is-expanded`（fixed 定位）——**元素瞬移**；唯一的入场动效是整层 240ms 淡入；**退出完全没有动画**（硬切回内联）；展开/还原图标是 `<path d>` 直接替换（硬切）。

```css
/* src/components/GraphView.astro:422-443 — current */
.graph-layout.is-expanded {
  position: fixed;
  inset: 1rem;
  z-index: 100;
  display: flex;
  align-items: stretch;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgba(28, 28, 28, 0.55);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  /* 展开不再瞬跳：整层（遮罩 + 画布）240ms 淡入，画布自身的 box-shadow 走 .graph-canvas 的 300ms */
  animation: graph-expand-in 240ms var(--ease-ed) both;
}
@keyframes graph-expand-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

```ts
// src/components/GraphView.astro:1781-1798 — current（reparent）
function setExpanded(on: boolean) {
  if (!layoutEl) return;
  if (on && layoutEl.parentElement !== document.body) {
    layoutOrigin = { parent: layoutEl.parentNode as Node, next: layoutEl.nextSibling };
    document.body.appendChild(layoutEl);
  } else if (!on && layoutOrigin) {
    const { parent, next } = layoutOrigin;
    if (next && next.parentNode === parent) parent.insertBefore(layoutEl, next);
    else parent.appendChild(layoutEl);
    layoutOrigin = null;
  }
  layoutEl.classList.toggle("is-expanded", on);
  …
}
```

```ts
// src/components/GraphView.astro:1806-1816 — current（图标硬切）
const icon = document.getElementById("graph-expand-icon");
if (icon) {
  const p = icon.querySelector("path");
  if (p) {
    p.setAttribute("d", on ? "M6 6l12 12M18 6L6 18" : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7");
  }
}
```

## Target

1. **遮罩与画布分层**：`.is-expanded` 的背景/backdrop-filter/box-shadow 移到 `.graph-layout::before`（absolute inset 0、z-index 在画布之下），用 animation 淡入；画布本体不再整层淡入，改走 FLIP。
2. **FLIP 展开**：先记录内联矩形 → reparent + `.is-expanded` → 记录全屏矩形 → 施加反向 transform（origin top left）→ 双 rAF 后过渡到 none（320ms `var(--ease-ed)`）。
3. **FLIP 还原**：记录全屏矩形 → reparent 回原位 + 去类 → 记录内联矩形 → 反向 transform 起跳 → 过渡到 none（260ms）；同时 `.is-closing` 让遮罩淡出。
4. **图标**：保留 d 替换，但给 svg 加 200ms 旋转过渡，toggle 时同时转 90°，读作形变而非硬切。
5. **reduced-motion**：跳过 FLIP，直接切换 + 遮罩 150ms linear 淡入淡出。

## Repo conventions to follow

- token：`--ease-ed`（editorial.css:28）。FLIP 范式 exemplar：`src/components/ImageLightbox.astro`（从缩略图原位 FLIP 到灯箱）。
- reduced-motion 分支范例：`GraphView.astro:1478-1482`（缩放动画的即时分支）。

## Steps

1. **CSS 分层**。`.graph-layout.is-expanded` 保留 `position/flex/padding/border-radius` 等布局属性，把 `background / box-shadow / backdrop-filter` 移到新伪元素；删除整层 `animation: graph-expand-in` 与该 keyframes：

```css
/* target */
.graph-layout.is-expanded { position: fixed; inset: 1rem; z-index: 100; display: flex; align-items: stretch; padding: 1rem; border-radius: 0.5rem; }
.graph-layout.is-expanded::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: rgba(28, 28, 28, 0.55);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  animation: graph-scrim-in 320ms var(--ease-ed) both;
  pointer-events: none;
}
.graph-layout.is-expanded.is-closing::before {
  animation: graph-scrim-out 200ms var(--ease-ed) both;
}
@keyframes graph-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes graph-scrim-out { from { opacity: 1; } to { opacity: 0; } }
```

   确认画布/工具条等现有子元素在 ::before 之上（必要时给它们补 `position: relative; z-index: 1;`；`.graph-layout.is-expanded .graph-canvas { flex: 1; … }` 原有规则不动）。

2. **JS：setExpanded 重写为三段**。替换现函数体（保持签名与两处调用点/Esc 处理兼容），加入重入保护与 reduced-motion 分支：

```ts
let expanding = false;
function setExpanded(on: boolean) {
  if (!layoutEl || expanding) return;
  expanding = true;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // aria/title/图标/body overflow 与现状一致（见原实现）
  if (on) {
    if (layoutEl.parentElement === document.body) { expanding = false; return; }
    layoutOrigin = { parent: layoutEl.parentNode as Node, next: layoutEl.nextSibling };
    if (reduced) {
      document.body.appendChild(layoutEl);
      layoutEl.classList.add("is-expanded");
      finishExpandToggle(on);
      expanding = false;
      return;
    }
    const first = layoutEl.getBoundingClientRect();
    document.body.appendChild(layoutEl);
    layoutEl.classList.add("is-expanded");
    const last = layoutEl.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(1, last.width);
    const sy = first.height / Math.max(1, last.height);
    layoutEl.style.transformOrigin = "top left";
    layoutEl.style.transition = "none";
    layoutEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void layoutEl.getBoundingClientRect(); // 起始值生效
    layoutEl.style.transition = "transform 320ms var(--ease-ed)";
    layoutEl.style.transform = "";
    window.setTimeout(() => {
      layoutEl.style.transition = "";
      layoutEl.style.transformOrigin = "";
      expanding = false;
    }, 340);
  } else {
    if (!layoutOrigin) { expanding = false; return; }
    if (reduced) {
      const { parent, next } = layoutOrigin;
      if (next && next.parentNode === parent) parent.insertBefore(layoutEl, next);
      else parent.appendChild(layoutEl);
      layoutOrigin = null;
      layoutEl.classList.remove("is-expanded");
      finishExpandToggle(on);
      expanding = false;
      return;
    }
    const first = layoutEl.getBoundingClientRect(); // 全屏矩形
    layoutEl.classList.add("is-closing");
    const { parent, next } = layoutOrigin;
    if (next && next.parentNode === parent) parent.insertBefore(layoutEl, next);
    else parent.appendChild(layoutEl);
    layoutOrigin = null;
    layoutEl.classList.remove("is-expanded");
    const last = layoutEl.getBoundingClientRect(); // 内联矩形
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(1, last.width);
    const sy = first.height / Math.max(1, last.height);
    layoutEl.style.transformOrigin = "top left";
    layoutEl.style.transition = "none";
    layoutEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void layoutEl.getBoundingClientRect();
    layoutEl.style.transition = "transform 260ms var(--ease-ed)";
    layoutEl.style.transform = "";
    window.setTimeout(() => {
      layoutEl.style.transition = "";
      layoutEl.style.transformOrigin = "";
      layoutEl.classList.remove("is-closing");
      expanding = false;
    }, 280);
  }
}
```

   - `finishExpandToggle(on)` = 原函数尾部的 aria-label / title / 图标切换 / `document.body.style.overflow` 逻辑；expand 分支在 FLIP 起跳前调用，collapse 分支在 remove class 前调用（overflow 保持 hidden 到还原结束：collapse 的 finish 里才清 overflow）。
   - 现有 `astro:before-swap` / `pagehide` 清理（若有对 layoutEl 的处理）保持不变；若清理路径直接 remove 类，补一行 style 内联清空。

3. **图标旋转**。找到展开按钮的选择器（expandBtn 渲染处，约 1800 行附近向上找 markup）：给它加：

```css
/* target */
#graph-expand svg, .graph-expand-btn svg {  /* 以实际按钮选择器为准 */
  transition: transform 200ms var(--ease-ed);
}
#graph-expand.is-expanded svg { transform: rotate(90deg); }
```

   JS 在 toggle 时给按钮加/去 `is-expanded` 类（与 aria 更新同处），`<path d>` 替换逻辑保留。

4. **回归面检查**：`grep -n "setExpanded\|is-expanded" src/components/GraphView.astro`，确认所有触发点（工具条按钮、Esc 监听、节点点击后状态）都仍走 setExpanded；MiniGraph 侧栏实例复用同一脚本，行为一致。

## Boundaries

- 不动 d3-force 布局、缩放/拖拽、zoom tween（1470-1525）、详情抽屉。
- 不改 `.graph-layout` 的内联态布局样式（仅动 `.is-expanded` 相关）。
- 图标两个 path 的 d 值不变。
- 若 reparent 过程中 d3 simulation/zoom 出现异常（画布内容错位），STOP 并报告，不要自行改 simulation 代码。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -n "graph-expand-in" src/components/GraphView.astro` 无结果。
- **Feel check**（归档页 + 文章页侧栏迷你图谱各试一遍）:
  - 点展开：画布从内联位置**飞**到全屏（无整层淡入感），遮罩同步压暗；320ms 落定。
  - 点还原/Esc：画布飞回内联原位，遮罩淡出；还原后页面滚动位置不变、图谱可继续拖拽缩放。
  - 快速连点展开/还原：无卡死、无错位（重入保护生效）。
  - DevTools Animations 放慢 10%：确认画布是位移+缩放，而非透明度变化。
  - Rendering 面板开 reduced-motion：展开/还原瞬时完成，遮罩快速淡入淡出。
- **Done when**: 展开/还原都有空间出处与归处，无硬切。
