# 030 — 图谱跨换页重初始化：修复「第二次客户端换页到达后图谱死亡」的老 bug

- **Status**: TODO（VT 客户端换页复现：第 1 次到达归档 20 links/20 nodes ✓，第 2/3 次 0/0 + 静态 viewBox——git HEAD 原版即无重初始化机制，属预先存在的 bug）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH（换页后图谱空白）
- **Category**: 功能修复 / 图谱
- **Estimated scope**: 1 文件（src/components/GraphView.astro）

## Problem

GraphView 的脚本是打包后的外部模块——**每个浏览器会话只求值一次**（Astro 按哈希去重）。`initGraph()` 只在模块求值时执行一次，把元素/监听/力导建进「当次换页的 DOM」。用户从首页点导航第二次到达归档页时，DOM 已被 ClientRouter 换成新实例，但没有任何代码重新初始化图谱 → 新页面的 `#graph-svg` 保持空壳（viewBox 停留在标记里的静态 `0 0 800 500`）。

现行架构本身是为此设计的：`cleanup()` 挂在 `astro:before-swap`（离开时回收旧实例），SearchModal 的注释也写明「绑定在 document 上（天然跨 VT 存活），元素引用每次 astro:page-load 重新获取」——唯独 GraphView 缺少 `astro:page-load` 的重初始化挂钩。

现尾部（约 2100-2116 行）：

```ts
/* current */
  // lazy 模式：等首屏空闲（或最长 2s 兜底）再初始化，d3-force 的动态
  // import 也随之推迟；非 lazy 保持原来的立即执行。
  const LAZY_INIT =
    document.getElementById("graph-view")?.dataset.lazy === "1";
  if (LAZY_INIT) {
    const mount = document.getElementById("graph-view");
    if (mount && mount.dataset.inited !== "1") {
      mount.dataset.inited = "1";
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => void initGraph(), { timeout: 2000 });
      } else {
        window.setTimeout(() => void initGraph(), 1200);
      }
    }
  } else {
    void initGraph();
  }
```

## Target

```ts
/* target — 替换整个尾部 */
  // 模块每次会话只求值一次，但 VT 客户端换页会替换 DOM——旧实例由
  // astro:before-swap 的 cleanup 回收。这里在每次 astro:page-load（含首访）
  // 检查当前 DOM 是否有图谱挂载点：有则按 lazy 策略初始化新实例。
  // mount.dataset.inited 防止同一 DOM 实例被重复初始化（bfcache 恢复/重复事件）。
  const armGraph = () => {
    const mount = document.getElementById("graph-view");
    if (!mount || mount.dataset.inited === "1") return;
    mount.dataset.inited = "1";
    if (mount.dataset.lazy === "1") {
      // lazy 模式：等首屏空闲（或最长 2s 兜底）再初始化，d3-force 的动态
      // import 也随之推迟
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => void initGraph(), { timeout: 2000 });
      } else {
        window.setTimeout(() => void initGraph(), 1200);
      }
    } else {
      void initGraph();
    }
  };
  document.addEventListener("astro:page-load", armGraph);
  armGraph();
```

要点：
- `astro:page-load` 在首访与每次客户端换页完成时都会触发；`mount.dataset.inited` 挂在 DOM 元素上——换页后的新挂载点没有该标记 → 初始化；bfcache 恢复时旧 DOM 带标记 → 跳过（旧实例仍存活）。
- 旧实例回收链路不变：`initGraph` 内部的 `astro:before-swap`（once）+ `pagehide` cleanup。
- `parentOf`/`friendRingByHub`（028 的模块级 Map）在每次 layoutRadial 中按当前页面数据重填，跨实例无残留。
- 直达/刷新：模块求值时 DOM 已就绪，`armGraph()` 直呼立即初始化；随后 `astro:page-load` 再触发一次 → 被 inited 标记拦截，不会双重初始化。

## Repo conventions to follow

- 同款模式先例：SearchModal 脚本头注释「绑定在 document 上（天然跨 VT 存活），modal 内的元素引用在每次 astro:page-load 时重新获取」；Nav 内联脚本的 `astro:page-load` 重置逻辑。
- AGENTS.md 的回归检查单明确要求「重点回归 ViewTransitions 站内跳转」——本修复正是补齐图谱在该路径下的缺失。

## Steps

1. 按 Target 替换脚本尾部整个 LAZY_INIT 块。
2. 自检：`grep -n "astro:page-load" src/components/GraphView.astro` 命中 ≥1；`grep -n "armGraph" src/components/GraphView.astro` 命中 ≥3；`grep -n "const LAZY_INIT" src/components/GraphView.astro` 无结果。

## Boundaries

- 不动 initGraph 内部任何逻辑（027-029 的形态/静态化保持）。
- 不动 cleanup 机制、lazy 语义（rIC + 2s 兜底）。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功。
- **Feel check**（preview，连续换页）:
  - 首页 → 归档（第 1 次）：图谱渲染。
  - 归档 → 首页 → 归档（第 2 次）：图谱**再次完整渲染**（这是修复点）。
  - 反复横跳多个来回：每次都渲染，无双重初始化（节点数稳定 20/20，无叠加）。
  - 文章页侧栏 MiniGraph（lazy）：进文章页后 1-2s 内出现。
  - 浏览器后退/前进、bfcache：不重复初始化、图谱存活。
- **Done when**: 任意次数的客户端换页到达归档页，图谱都完整初始化。
