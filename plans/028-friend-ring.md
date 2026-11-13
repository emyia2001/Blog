# 028 — 友链文章节点环绕友链站点显示（环形布局 + 环绕力）

- **Status**: TODO
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: MEDIUM（用户对图谱形态的要求）
- **Category**: 视觉修正 / 图谱
- **Estimated scope**: 1 文件（src/components/GraphView.astro）

## Problem

友链文章（`friendPost`，虚线小空心点）目前与内容节点一起铺在外椭圆带、按中枢角度的扇区分布——每个友链站点的子节点呈「一侧扇形」甩出。用户要求：友链文章**环绕各自的友链站点节点**显示（小圆环均分），不再上外带。

涉及四处联动：初始布局、环带力豁免、新增环绕力、连线距离。

## Target

### A. `parentOf` 提升到脚本层 + 环半径工具（layoutRadial 之前，约 935 行注释处）

layoutRadial 内的 `const parentOf = new Map<string, string>();`（约 941 行）删除，改为在其函数定义之前声明（供环绕力复用）：

```ts
/* target — 插在 layoutRadial 函数注释（约 933 行「// 极坐标分层布局…」）之前 */
// 节点父映射：友链文章 → 友链站点（layoutRadial 填充；环绕力按父查）
const parentOf = new Map<string, string>();
const friendRingByHub = new Map<string, number>();
```

### B. layoutRadial：友链文章改环绕布局

1. 分组循环（约 967-970 行）排除友链文章：

```ts
/* target */
    const groups = new Map<string, typeof nodes>();
    nodes
      .filter(
        (n) => n.kind !== "self" && n.kind !== "year" && n.kind !== "friendPost"
      )
      .forEach((n) => {
        const yid = parentOf.get(n.id) ?? "";
        if (!groups.has(yid)) groups.set(yid, []);
        groups.get(yid)!.push(n);
      });
```

2. 在外带 groups 循环之后（约 988 行 `}` 后）追加环绕布局：

```ts
/* target */
    // 友链文章：环绕各自的友链站点节点（小圆环均分，起始角随中枢角度），
    // 不再上外带扇形——虚线子图「围着自己的站点转」；环半径按子节点数写入
    // friendRingByHub 供环绕力与连线距离使用
    const friendChildren = new Map<string, typeof nodes>();
    nodes
      .filter((n) => n.kind === "friendPost")
      .forEach((n) => {
        const fid = parentOf.get(n.id) ?? "";
        if (!friendChildren.has(fid)) friendChildren.set(fid, []);
        friendChildren.get(fid)!.push(n);
      });
    for (const [fid, group] of friendChildren) {
      const slot = hubSlots.get(fid);
      if (!slot) continue;
      const ringR = friendRingR(group.length);
      friendRingByHub.set(fid, ringR);
      group.forEach((n, i) => {
        const a = (yearAngle.get(fid) ?? 0) + (i / group.length) * Math.PI * 2;
        n.x = slot.x + Math.cos(a) * ringR;
        n.y = slot.y + Math.sin(a) * ringR;
      });
    }
```

### C. 环半径工具（syncBands 调用之后，约 1005 行；引用 bandR 闭包，resize 自动生效）

```ts
/* target — 插在 syncBands(svg.clientWidth || W, svg.clientHeight || H); 之后 */
// 友链文章环绕半径：随内带缩放（画布越大环越大），节点多时环稍大
const friendRingR = (count: number) =>
  Math.max(52, Math.min(44 + count * 14, bandR.ix * 0.6));
```

### D. 环带力豁免友链文章（forceBandEllipse，约 1013-1015 行）

```ts
/* target */
  function forceBandEllipse(alpha: number) {
    for (const n of nodes) {
      // self 居中不拉；友链文章由环绕力接管（forceFriendRing），不上外带
      if (n.kind === "self" || n.kind === "friendPost") continue;
```

### E. 新增环绕力（forceBandEllipse 之后，并在 simulation 链注册）

```ts
/* target */
  // 友链文章环绕力：沿「站点→文章」方向把友链文章拉到各自站点节点的圆环上
  // （半径由 layoutRadial 按子节点数写入 friendRingByHub，resize 随画布重算）。
  // 只约束半径不约束角度，角度由 collide/charge 自然均分
  function forceFriendRing(alpha: number) {
    for (const n of nodes) {
      if (n.kind !== "friendPost") continue;
      const hub = nodeById.get(parentOf.get(n.id) ?? "");
      if (!hub) continue;
      const ringR = friendRingByHub.get(hub.id);
      if (!ringR) continue;
      const dx = n.x - hub.x;
      const dy = n.y - hub.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const pull = (ringR - d) * 0.5 * alpha;
      n.vx = (n.vx ?? 0) + ux * pull;
      n.vy = (n.vy ?? 0) + uy * pull;
    }
  }
```

注册（simulation 链，`.force("band", forceBandEllipse)` 之后）：

```ts
/* target */
    .force("friendRing", forceFriendRing)
```

### F. 连线距离：站点→其文章 = 环半径（bandLinkDistance else 分支，约 1057-1073 行）

```ts
/* target — else { … } 整体替换 */
    } else {
      const sHub = sid.startsWith("year-") || sid.startsWith("friend-");
      const tHub = tid.startsWith("year-") || tid.startsWith("friend-");
      if (sHub || tHub) {
        const so = s as SimNode;
        const to = t as SimNode;
        // 友链站点→其文章：环绕半径（其余中枢→内容仍是外带间距）
        const hubN =
          so.kind === "friend" ? so : to.kind === "friend" ? to : null;
        const childN = hubN ? (hubN === so ? to : so) : null;
        if (hubN && childN && childN.kind === "friendPost") {
          ret = friendRingByHub.get(hubN.id) ?? 100;
        } else {
          const dx = to.x - so.x;
          const dy = to.y - so.y;
          const d = Math.hypot(dx, dy) || 1;
          ret =
            bandRadiusAt(dx / d, dy / d, "outer") -
            bandRadiusAt(dx / d, dy / d, "inner");
        }
      } else {
        ret = 90; // 内容之间的锚点关联边：短，表达「强关联」
      }
    }
```

## Repo conventions to follow

- GraphView 力函数范式：`function forceXxx(alpha: number)` 沿单位方向施加径向速度（参照 forceBandEllipse 的 `pull = (target - d) * k * alpha`）。
- 注释风格：中文，讲机制与「为什么」。

## Steps

1. 按 A 提升 parentOf/friendRingByHub（删 layoutRadial 内的局部声明）。
2. 按 B 改 layoutRadial（分组排除 + 追加环绕布局）。
3. 按 C 加 friendRingR。
4. 按 D 改 forceBandEllipse 豁免。
5. 按 E 加 forceFriendRing 并在 simulation 链注册（`.force("band", …)` 之后一行）。
6. 按 F 替换 bandLinkDistance else 分支。
7. 自检：`grep -n "forceFriendRing\|friendRingByHub\|friendRingR" src/components/GraphView.astro` 各命中；`grep -n "friendPost" src/components/GraphView.astro` 中 forceBandEllipse 行含豁免。

## Boundaries

- 不动年份/内容的外带扇形布局、edgePoints/ticked 渲染、入场 stagger、拖拽缩放、FLIP 展开、详情抽屉。
- 不动 collide（34）与 nodeScale 公式——环半径已按 12+6 光晕留量校准。
- MiniGraph（无友链）路径不受影响。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-7 grep。
- **Feel check**（preview 归档页）:
  - 每个友链站点节点的虚线子节点**环绕站点四周**均分（环状），不再单侧扇形甩出。
  - 拖拽友链站点：子节点随动且保持环绕（环绕力回位）。
  - 展开全屏 / 缩放窗口：环随画布重算，形态保持。
  - 年份扇区、自我中心、图例、悬停抽屉不受影响；MiniGraph 正常。
- **Done when**: 友链文章环绕各自站点呈环状分布。
