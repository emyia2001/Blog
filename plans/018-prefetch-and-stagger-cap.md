# 018 — 导航切换提速：预取 + 错峰封顶

- **Status**: TODO
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH（用户指定的性能目标：做到最快的切换）
- **Category**: 性能 / 用户反馈
- **Estimated scope**: 6 文件（astro.config.mjs、src/components/Nav.astro、src/pages/index.astro、src/components/TagCloud.astro、src/pages/friends.astro、src/pages/collection.astro、src/pages/timeline.astro）

## Problem

导航点击后的感知时序 = **网络等待（无预取）** + View Transition 320ms + 内容入场编排。三个可压缩点：

**A. 无预取**：`astro.config.mjs` 没有 `prefetch` 配置，Nav 链接也没有 `data-astro-prefetch`（grep 全仓只有 `dns-prefetch`）。每次点击导航都要等完整 HTML 拉取后 View Transition 才开始——这是点击后「先没反应再换页」的最大原因。

**B. 导航目标没有最高优先级预取**：顶部导航的 5 个目标页是每次换页最常去的页面，应常驻预取（viewport 策略，页面加载后立即预取），做到「点的时候已经在缓存里」。

**C. 入场错峰尾巴过长**（网络消除后，尾巴就成了新的感知慢点）：

| 位置 | 现状 | 问题 |
|---|---|---|
| `src/pages/index.astro:95` | `--reveal-delay: ${i * 60}ms` | **未封顶**：第 10 条 540ms 才开始入场 |
| `src/pages/collection.astro:59` | `--reveal-delay:${ci * 60}ms` | **未封顶**：分类多时同样拖尾 |
| `src/components/TagCloud.astro:27` | `Math.min(i * 40, 560)` | 封顶 560ms，偏长 |
| `src/pages/friends.astro:51` | `Math.min(i * 60, 420)` | 封顶 420ms，偏长 |
| `src/pages/timeline.astro:414、441` | `min(var(--tl-i, 0), 12) * 0.04s` | 封顶 12 条 = 480ms，加 0.15s 基础延迟 → 630ms 才开始 |
| `src/pages/archive.astro:114` | `Math.min(i, 5) * 60` | max 300ms ✓ 不动 |
| `src/pages/tags/[tag].astro:49` | `Math.min(i, 5) * 50` | max 250ms ✓ 不动 |

## Target

**统一约定：组入场错峰封顶 300ms**（视口内可见的前几条保持波浪节奏，尾巴不拖沓；`.reveal` 是 IntersectionObserver 驱动，折叠下方的元素本就滚动到才入场，封顶只影响首屏可见部分）。

```js
// astro.config.mjs — target（export default defineConfig({ 内，output 之后））
  output: "static",
  // 静态站点全量预取：hover 时拉取目标页，导航点击近乎即时换页（配合 <ClientRouter />）
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
```

```astro
<!-- Nav.astro — target：桌面 5 个导航链接与移动端抽屉链接加 viewport 级预取（每次页面加载后即预取，点击时必然命中缓存） -->
<a href={ROUTES.home} data-astro-prefetch="viewport" class={...}>首页</a>
<!-- 其余 4 个 nav-link 同样处理；nav-drawer-link 的 5 个 <a> 同样处理 -->
```

```astro
<!-- 错峰封顶 300ms： -->
src/pages/index.astro:95        style={`--reveal-delay: ${Math.min(i * 60, 300)}ms`}
src/components/TagCloud.astro:27  style={`--reveal-delay: ${Math.min(i * 40, 300)}ms`}
src/pages/friends.astro:51        style={`--reveal-delay: ${Math.min(i * 60, 300)}ms`}
src/pages/collection.astro:59     style={`--reveal-delay:${Math.min(ci * 60, 300)}ms`}
src/pages/timeline.astro:414、441  animation-delay: calc(0.15s + min(var(--tl-i, 0), 7) * 0.04s);
```

（timeline 封顶 7 条 = 280ms + 0.15s 基础 = 430ms 开始入场，其余同理两行都改。）

## Repo conventions to follow

- Astro 官方：`prefetch` 顶层配置 + `data-astro-prefetch` 属性，与 `<ClientRouter />` 完全兼容。
- 注释风格：中文短注释说明「为什么」。

## Steps

1. `astro.config.mjs`：`output: "static",` 之后按 Target 加 `prefetch` 块。
2. `src/components/Nav.astro`：桌面导航 `<ul>` 里 5 个 `<a>`（nav-link）与移动抽屉里 5 个 `<a>`（nav-drawer-link）各加 `data-astro-prefetch="viewport"`。开往（外链 travellings）**不加**（外站不预取）。
3. 错峰封顶五处按 Target 修改（index / TagCloud / friends / collection / timeline×2 行）。
4. 自检：`grep -rn "reveal-delay\|tl-i" src/pages src/components | grep -v "300\|min(i, 5)\|min(var(--tl-i, 0), 7)\|80ms\|60ms\""` 逐条确认无未封顶的动态表达式。

## Boundaries

- 不动 View Transition 时长（page-out 160 / page-in 320 是站点人格，网络消除后它们是地板不是瓶颈）。
- 不动 `title-rise`/`ed-rise` 等单元素入场时长与延迟。
- 不动图片懒加载策略（`loading="lazy"`，数据成本考量；如需进一步提速另立计划）。
- 不给外链、rss.xml 等非页面链接加预取。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build && npm run preview` 后浏览器 DevTools Network 面板：页面加载完成后 hover 导航链接应出现对应 HTML 的预取请求；点击导航无「等待拉取」的空窗。
- **Feel check**（preview 生产构建，非 dev）:
  - 点击顶部导航：近乎即时换页（预取命中时 <100ms 完成 swap）。
  - 首页/拾集/友链/标签云/时间轴入场：波浪节奏保留，但最后一条在 ~900ms 内完成入场（300ms 封顶 + 560ms 过渡），不再拖到 1.1s+。
  - 移动端抽屉点击换页同样即时。
- **Done when**: 预取生效 + 全站错峰封顶 300ms。
