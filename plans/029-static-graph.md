# 029 — 图谱改确定性静态布局：移除节点拖拽、无力导定时器、默认位即最终位

- **Status**: TODO（用户反馈：不需要拖动节点效果，默认初始化位置即最终位置，线条尽量不交叉重复）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: MEDIUM（用户对图谱交互/形态的决策）
- **Category**: 交互简化 / 图谱
- **Estimated scope**: 1 文件（src/components/GraphView.astro）

## Problem

当前图谱是「活」的力导系统：初始化后定时器持续运行、节点可拖拽（拖拽时 alphaTarget 保持 0.3）、松手后回弹漂移。用户决策：**不需要节点拖拽**，初始化位置就是最终位置（确定性静态布局），线条尽量不交叉重复。

保留：画布空白处平移、滚轮/双指缩放、点击节点开详情、悬停高亮、入场淡入 stagger、友链环形布局、027 的离线预跑。

## Target

### A. fitViewBox 尾部：离线松弛后停止（不重启定时器）

```ts
/* target — 替换尾部（约 1558-1564 行） */
    // 确定性静态布局：离线松弛 90 tick 后即定格——默认初始化位置就是最终位置，
    // 不再有力导定时器/漂移；resize/展开时走同一条重排路径
    simulation.alpha(1);
    for (let i = 0; i < 90; i++) simulation.tick();
    ticked();
    simulation.stop();
  }
```

（替换现存的 `simulation.alpha(1); for…tick(); ticked(); simulation.alpha(0.13).restart();`——注释与结尾一并换。）

### B. scheduleGraphResize：去掉重启（约 1965-1974 行）

```ts
/* target */
  // 容器尺寸变化后：viewBox 跟随新尺寸，并按新画布重排（离线松弛后定格，
  // 保持 zoom 不动，不做自动铺满）
  function scheduleGraphResize() {
    requestAnimationFrame(
      requestAnimationFrame(() => {
        fitViewBox();
      })
    );
  }
```

（删除 `simulation.alpha(0.5).restart();` 与旧注释；注意保留双层 rAF 的 requestAnimationFrame 嵌套写法。）

### C. 移除节点拖拽（保留画布平移/捏合缩放/点击详情）

**C1. 状态变量（约 1730-1737 行）**：删除 `dragActive` 与 `dragOffset` 两个声明，其余保留：

```ts
/* target */
  // --- Node press & canvas pan (click vs move distinguished by movement threshold) ---
  let pointerId: string | null = null;
  let dragged = false;
  let downOnNode = false;
  let downX = 0;
  let downY = 0;
```

**C2. pointerdown 的节点分支（约 1838-1846 行）**：删除 dragOffset 计算，保留 pointerId 记录与 focus：

```ts
/* target */
      pointerId = target.dataset.id ?? null;
      if (pointerId) {
        target.focus();
      }
```

**C3. pointermove（约 1885-1901 行）**：整段删除节点拖拽分支（`if (!pointerId) return;` 到 `n.fy = …`），保留其前的 pinch 缩放与画布平移两个分支。

**C4. endPointer（约 1903-1922 行）**：删除 fx/fy 释放与 alphaTarget 复位，保留点击激活：

```ts
/* target */
  function endPointer(e: PointerEvent | undefined, cancelled = false) {
    if (e) pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    panState = null;
    if (!cancelled && downOnNode && !dragged && pointerId) {
      activateNode(pointerId);
    }
    pointerId = null;
    downOnNode = false;
    dragged = false;
  }
```

**C5. 提示文案**（约 119 行与 896 行）：

```ts
/* target — 119 行 */
        <span aria-hidden="true">缩放 · 点击查看详情</span>
/* target — 896 行 */
    if (hintText) hintText.textContent = "缩放 · 悬停查看名称";
```

**C6. forceHubSlots 注释微调**（约 1144-1145 行）：「弹簧式，拖拽后回位」→「弹簧式，resize 重排后回位」。

## 交叉说明（如实）

直线连接下，跨扇区的锚点关联边（content—content「强关联」短边）在几何上必然跨过部分径向连线——已通过：① 环带分层（self→中枢→内容同心不穿插）、② 友链环形子图（虚线自成一圈）、③ 90 tick 离线松弛（charge/collide/link 距离把同带节点推散）将交叉降到该布局的几何下限附近；**重叠**（多条线贴同一路径）则由 collide 与环带间距消除。若仍嫌个别锚点边碍眼，后续可改曲线绘制（另行立项）。

## Repo conventions to follow

- GraphView 注释风格（中文、讲机制）；`cleanupController.signal` 统一挂载监听。

## Steps

1. fitViewBox 尾部替换（A）。
2. scheduleGraphResize 替换（B）。
3. 拖拽移除五处（C1-C5）+ forceHubSlots 注释（C6）。
4. 自检：`grep -n "alphaTarget\|dragOffset\|restart()" src/components/GraphView.astro` 无结果；`grep -n "simulation.alpha(0.13)" src/components/GraphView.astro` 无结果；`grep -cn "simulation.stop()" src/components/GraphView.astro` ≥2（fitViewBox + cleanup）；`grep -n "拖拽" src/components/GraphView.astro` 仅剩 264 行注释（横向拖拽由图谱接管——那是 /tree 页无关注释？核对语境，若属 GraphView 自身交互注释则更新）。

## Boundaries

- 不动画布平移、捏合/滚轮缩放、点击详情（activateNode）、悬停高亮、入场 stagger、友链环形布局（028）、016 进度条。
- 不删 `simulation` 对象本身（离线松弛仍用它）；不删 `ticked`/`edgePoints`。
- 不改 stopZoomAnim/展开 FLIP。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-4 grep 清零。
- **Feel check**（preview 归档页）:
  - 初始化：图谱首帧即最终形态，之后**完全静止**（无漂移、无回弹）。
  - 按住节点拖动：无反应（节点不可拖）；点击节点：详情抽屉正常打开/关闭。
  - 拖动空白处：画布平移正常；滚轮/双指缩放正常。
  - 展开全屏、缩放窗口：布局按新画布重排后定格。
  - 线条：径向线与环形虚线基本无重叠；跨扇区锚点边残留少量几何交叉（直线布局的极限）。
- **Done when**: 图谱为静态确定性布局，节点不可拖，交互（平移/缩放/点击）完好。
