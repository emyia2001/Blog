# 027 — 关系图谱初始化：预跑收敛（首帧即分散形态）+ 友链头像与自我头像同大 + 环带放宽

- **Status**: TODO
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: MEDIUM（用户对归档页图谱的形态要求）
- **Category**: 视觉修正 / 图谱
- **Estimated scope**: 1 文件（src/components/GraphView.astro）

## Problem

归档页关系图谱（GraphView）的三个形态问题：

1. **初始化不分散**：`layoutRadial` 给出环带初始位后，d3 力导从 `alpha = 1` 开跑（forceSimulation 默认），前几秒力（charge -160 / link 距离 / collide / 环带拉力）互相拉扯，节点从初始位置漂移、聚拢再散开，要等 alpha 衰减收敛后才是用户想要的分散形态（见用户截图）。
2. **友链头像节点偏小**：半径表（约 907 行）里 `avatarSelf: 12 * nodeScale`（自我头像）而 `avatar: 9.5 * nodeScale`（友链头像）——用户要求友链头像与自我头像一样大。
3. **环带铺开偏保守**：`syncBands`（约 995-1004 行）的半径上限留白较多（ox 上限 `w/2 - 76`、oy 上限 `h/2 - 36`），外带节点离画布边缘还有明显空隙；用户截图期望更铺满。

## Target

### A. 初始化预跑收敛（首帧即分散形态，之后力导低强度继续）

> **执行修正（v2，初版方案经执行核实不可行）**：d3 的手动 `simulation.tick()` 只推进数据不派发渲染事件（`ticked()` 不会执行）；且 `fitViewBox()` 每次成功后都会 `layoutRadial(w,h)` 重摆 + `alpha(0.5).restart()`，把预跑状态冲掉。因此预跑移入 `fitViewBox` 重排尾部，并手动调用 `ticked()` 渲染一次，以低 alpha 重启。初版加在 simulation 创建后的预跑块**删除**（恢复原注释）。

**A1.** 删除初版插入的预跑块（`.on("tick", ticked);` 之后，约 1338-1342 行的注释两行 + `simulation.stop();` + `for` 循环），恢复原注释 `// 力导自动开跑：layoutRadial 提供的初始位置 + radial 环带约束收敛`。

**A2.** `fitViewBox()` 尾部（约 1500-1503 行）：

```ts
/* current */
    linkForce?.distance(bandLinkDistance);
    simulation.alpha(0.5).restart();
  }
```

改为：

```ts
/* target */
    linkForce?.distance(bandLinkDistance);
    // 重排后离线预跑收敛（alpha 1 → ~0.126，90 tick）并手动渲染一次，
    // 再以低 alpha 重启定时器：首帧/resize 后都直接呈现环带就位的分散形态，
    // 不再有「聚拢再散开」的漂移；之后力导低强度微调，保留活性
    simulation.alpha(1);
    for (let i = 0; i < 90; i++) simulation.tick();
    ticked();
    simulation.alpha(0.13).restart();
  }
```

要点：
- 手动 `tick()` 只推进数据，必须紧跟 `ticked()` 手动渲染（文件 1299 行注释早已预留此调用约定：ticked 声明在后但函数提升可调）。
- alpha 先置 1 预跑 90 tick（力在满强度下收敛到环带均衡位），再降到 0.13 重启——之后仅低强度微调至自然停止，活性保留。
- fitViewBox 在初始化/resize/load/fonts.ready 都会触发：每次重排后首帧即收敛形态。
- 入场 stagger（`graph-in` opacity 渐显）照常在收敛形态上播放。

### B. 友链头像与自我头像同大（半径表，约 907 行）

```ts
/* target */
  const R = {
    self: 6 * nodeScale, // 与文章点等大（相关文章图谱里中心与环绕一致）
    avatarSelf: 12 * nodeScale,
    avatar: 12 * nodeScale, // 友链头像：与自我头像同大（用户要求）
    year: 9.5 * nodeScale, // 年
    node: 6 * nodeScale, // 文章
    person: 7 * nodeScale,
    event: 8 * nodeScale,
    friendPost: 5 * nodeScale, // 友链文章：小一号的空心点，视觉弱于自家内容
    hit: 20 * nodeScale,
    collide: 34 * nodeScale,
  };
```

只改 `avatar` 一行；`radiusOf`（`if (n.avatar) return n.kind === "self" ? R.avatarSelf : R.avatar;`）与光晕（`r + 6`）自动跟随，无需改动。collide 34 > 12+6，碰撞安全。

### C. 环带放宽（syncBands，约 997-1003 行）

```ts
/* target */
  const syncBands = (w: number, h: number) => {
    bandR = {
      ix: Math.max(48, Math.min(w * 0.14, w * 0.22)),
      iy: Math.max(34, Math.min(h * 0.18, h / 2 - 64)),
      ox: Math.max(80, Math.min(w * 0.4, w / 2 - 60)),
      oy: Math.max(78, Math.min(h * 0.42, h / 2 - 30)),
    };
    bandCenter.x = w / 2;
    bandCenter.y = h / 2;
  };
```

（对照旧值：ix `w*0.12/w*0.17` → `w*0.14/w*0.22`；iy `h*0.15/h/2-72` → `h*0.18/h/2-64`；ox `w*0.34/w/2-76` → `w*0.40/w/2-60`；oy `h*0.36/h/2-36` → `h*0.42/h/2-30`。外带节点更靠近画布边缘，与用户截图期望的铺满程度一致；上下边距仍给标签留出空间。）

## Repo conventions to follow

- GraphView 内注释风格：中文，讲「为什么」与机制（如「力导在带内自由排布，形态自然但层级分明」）。
- 节点碰撞/光晕等派生尺寸均由 `radiusOf`/`R` 派生，不单独手调。

## Steps

1. 半径表 `avatar` 一行改为 `12 * nodeScale` 并更新行内注释（Target B）。
2. `syncBands` 四个半径公式按 Target C 替换。
3. simulation 创建链尾部（`.on("tick", ticked);` 之后）插入 Target A 的预跑两行与注释。

## Boundaries

- 不动布局算法（layoutRadial/forceBandEllipse/forceHubSlots）、边距逻辑（edgePoints/bandLinkDistance）、入场 stagger（graph-in 的 delay 与时长）。
- 不动展开/收起（FLIP）、详情抽屉、拖拽缩放。
- 不改 nodeScale 收敛公式。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；`grep -n "avatar: 12" src/components/GraphView.astro` 命中。
- **Feel check**（preview 归档页）:
  - 打开归档页：图谱**第一帧**即为分散形态（节点在环带上、无聚拢再散开的过程），入场为原位淡入 stagger。
  - 友链头像节点（有头像的友链站点）与中心自我头像**一样大**。
  - 外带节点更靠近画布左右/上下边缘，标签不被裁剪。
  - 拖拽节点、悬停、展开全屏、MiniGraph（文章页侧栏）均正常。
- **Done when**: 初始化首帧即分散形态 + 友链头像与自我头像同大。
