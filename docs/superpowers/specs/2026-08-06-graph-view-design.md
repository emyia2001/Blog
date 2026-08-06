# 时间线页面关系图谱视图设计

日期：2026-08-06

## 目标

在 `/timeline/` 页面新增「图谱」视图：以 Obsidian 风格的双向连接关系图，展示全部内容节点（文章 / 人物 / 事件）。图谱视图与时间线视图是**同一内容的不同展示方式**，通过顶部按钮自由切换。

## 需求确认（已与用户敲定）

| 决策点 | 结论 |
|---|---|
| 关系来源 | 正文 `[[wiki-link]]` 语法，构建时自动解析 |
| 页面关系 | 同页切换视图（时间线 / 图谱），不新建页面 |
| 节点范围 | 内容节点（文章、人物、事件），不含标签节点 |
| 点击节点 | 高亮邻居 + 详情区展示内容，**post 与 moment 均展开全文** |
| 布局 | 力导向布局（D3-force），支持拖拽 + 缩放 |
| 视觉方向 | C：浅色 editorial 同款，节点常显标题标签 |
| 正文链接渲染 | 本次不做，`[[...]]` 仅作为图谱数据源 |
| 导航直达 | 不做 URL hash，视图选择用 localStorage 记忆，首次默认时间线 |

## 架构

### 数据层：wiki-link 解析（构建时）

- 从每篇内容（posts + moments）的 `body`（MDX 源码）用正则 `\[\[([^\]]+)\]\]` 提取引用标题
- 标题精确匹配到目标内容（posts + moments 的 title 全集）→ 生成**无向边**：A 引用 B 时，图谱中 A↔B 双向连线
- 引用不存在的标题 → 忽略该引用，构建期 `console.warn` 提示
- 产出图谱 JSON 数据结构：

```ts
interface GraphNode {
  id: string;              // 内容 id（posts/moments）
  kind: "post" | "person" | "event";
  title: string;
  url: string;             // post 的文章链接，moment 为空
  momentIndex: number;     // 详情模板索引（全文模板数组下标）
}

interface GraphLink {
  source: string;          // 节点 id
  target: string;          // 节点 id
}
```

- 图谱 JSON 在服务端生成后注入页面（`define:vars`），前端拿到后喂给 force simulation

### 详情区：全文模板统一机制

- 现有时间线已有 moments 全文预渲染（`moment-templates` + `moment-body` 克隆机制）
- 扩展为 **posts + moments 全部预渲染**进同一模板集合，`momentIndex` 对所有节点有效
- post 模板结构：标题 + 日期 + 正文全文 + 「阅读全文」链接（跳到文章页）
- moment 模板：保持现有结构（标题 + 日期 + 类型标签 + 全文）
- 时间线视图默认展开逻辑与图谱视图共用这套模板

### 视图切换

- 时间线区域与图谱区域两个容器，切换时显示/隐藏
- 顶部按钮组「时间线 / 图谱」，当前项高亮
- 选择记忆在 `localStorage`（如 `snark-timeline-view`），首次访问默认时间线
- 图谱 SVG 初始化时机：页面加载即初始化（无论当前视图），切换仅控制显隐，避免切换时白屏重算

### 图谱渲染

- 依赖仅新增 `d3-force`（布局引擎：`forceLink` / `forceManyBody` / `forceCenter` / `forceCollide`）
- 渲染用原生 SVG + Pointer Events（不引入 d3-selection / d3-drag / d3-zoom）
- 节点样式（方向 C，浅色 editorial 同款）：

| 类型 | 形状 | 颜色 |
|---|---|---|
| post | 实心圆点 | `--color-ed-fg` |
| person | 空心圆环 | `--color-ed-muted` |
| event | 圆角方块 | `--color-ed-muted` |

- 节点下方常显标题标签（小字号、`--color-ed-subtle` 风格，与时间线卡片标签一致）
- 连线：细线 `--color-ed-faint`

### 交互

- **拖拽**：节点 pointerdown/move/up，拖拽期间固定节点坐标（fx/fy），释放后恢复力导向
- **缩放**：图谱容器滚轮 + 触摸捏合（`touch-action: none`），transform 作用于容器内 `<g>`
- **点击节点**：高亮该节点及其直接邻居（其余节点与连线降低透明度），详情区展示该节点全文；再次点击当前激活节点或点击空白处 / ESC → 清除高亮、清空详情
- **键盘可达**：节点 `role="button"`、`tabindex`，Enter 触发选择，ESC 清除
- 窄屏（<md）：标签收起（节点可拖拽不冲突），点击节点后详情区显示完整信息

### 边界情况

- 无引用关系的孤立节点：正常展示为散点，无线
- 全部内容均无引用：图谱仅展示散点，切换功能不受影响
- 引用标题重复（重名内容）：取第一篇匹配（构建期 warn）

## 组件结构

- `src/pages/timeline.astro`：扩展——图谱数据生成、视图切换、图谱容器、详情模板扩展为全内容
- `src/components/GraphView.astro`（新）：图谱渲染 + 交互逻辑（接收图谱 JSON 与详情模板句柄）
- 详情区模板与克隆逻辑保持在 timeline.astro 现有 `moment-templates` 机制中扩展

## 数据流

```
构建时：MDX body → 正则提取 [[标题]] → 标题→内容映射 → 无向边
      → 图谱 JSON（nodes + links）→ define:vars 注入页面

运行时：d3-force forceSimulation(graphJson) → SVG 节点/连线渲染
      → 拖拽/缩放 → 点击节点 → 高亮邻居 + clone 全文模板进详情区
```

## 错误处理

- 未匹配引用：忽略 + 构建期 warn（不阻塞构建）
- 空图谱（无任何内容）：显示「暂无内容」占位，与时间线一致
- force simulation 失败/空数据：图谱容器显示空态提示，不影响时间线视图

## 验证

1. `npm run build` 通过
2. 手动验证清单：
   - 时间线 / 图谱切换正常，刷新后记忆视图选择
   - 图谱节点按类型正确着色、标签常显
   - 节点可拖拽、图谱可缩放
   - 点击节点高亮邻居，post 与 moment 均在详情区展开全文
   - 再次点击 / 空白 / ESC 清除高亮
   - 键盘 Tab + Enter 可选择节点
   - 窄屏下标签收起、节点可触控
