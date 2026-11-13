# 023 — 遮罩改横向幕布擦除：纸色 + 砖红前缘线（左→右）

- **Status**: TODO（用户反馈：不要墨色、不要纵向动画，要符合站点主题；选型自成熟编辑风幕布过渡模式）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

022 的墨色纵向擦拭与站点主题不符（用户要求符合整体网站主题、不要从下往上）。站点是纸面/墨字/砖红 hairline 的编辑风——选型为编辑类站点的经典 **Curtain wipe**：纸色幕布沿阅读方向横向擦除，面板前缘带砖红细线（呼应导航砖红顶线与全站 hairline 语言，「书签丝带」隐喻）。

## Target

### A. 幕布样式（editorial.css，替换 `.ed-veil` 整块）

```css
/* target */
/* --- 全局换页幕布：纸色面板沿阅读方向左→右擦除。
   盖屏 160ms、扫出 200ms，单方向连续运动无静止停留；
   左右边缘各带 2px 砖红细线——盖屏时前缘引路，揭开时标出揭示线
   （呼应导航砖红顶线与全站 hairline 语言，书签丝带隐喻）。
   swap 在幕布盖住位之下完成（root VT 零动画） --- */
.ed-veil {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--color-ed-bg);
  transform: translateX(-101%);
  visibility: hidden;
  pointer-events: none;
  /* 复位态：扫出完成后 invisibly 归位左侧（visibility 延迟确保扫出可见） */
  transition:
    transform 200ms var(--ease-ed),
    visibility 0s linear 200ms;
}
.ed-veil::before,
.ed-veil::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-ed-accent);
}
.ed-veil::before {
  right: -2px; /* 前缘线：随幕布右移引路 */
}
.ed-veil::after {
  left: -2px; /* 揭示线：随幕布右移揭开新页 */
}
html.nav-veil-cover .ed-veil {
  visibility: visible;
  transform: translateX(0);
  /* 盖屏：160ms 快速扫入 */
  transition:
    transform 160ms var(--ease-ed),
    visibility 0s;
}
html.nav-veil-exit .ed-veil {
  visibility: visible;
  transform: translateX(101%);
  /* 扫出：继续向右 200ms，左缘红线揭开新页 */
  transition:
    transform 200ms var(--ease-ed),
    visibility 0s linear 200ms;
}
```

要点：
- 颜色回纸面 `var(--color-ed-bg)`，方向改横向（左→右）——替换 022 的墨色纵向三态。
- 两根 2px 砖红边缘线（`::before` 右缘 / `::after` 左缘）随面板同动，是站点 hairline 语言的全页版。
- 总周期 ~360ms（160 + 200），连续单方向运动、无静止停留。

### B. 状态机 JS（BaseLayout.astro，仅改一个常量）

```ts
// 盖屏最短时长与 160ms 扫入对齐
const VEIL_COVER_MS = 160;
```

（022 状态机的类流转逻辑不变：before-preparation 加 `nav-veil-cover`；after-swap 等待 ≥VEIL_COVER_MS 后 `cover → exit`；exit 220ms 后自清；page-load 兜底双清。）注释里的「墨色滑动擦除…120ms/180ms」描述同步改为横向幕布描述。

### C. 保持不动

root VT `animation: none` 规则、site-nav 四条规则、nav-fast 全套、018 预取、首访编排、016 进度条、导航收起。

## Repo conventions to follow

- token：`--ease-ed`（expo-out）、`--color-ed-bg`、`--color-ed-accent`（editorial.css:5-28）。
- 2px 砖红细线的既有先例：Nav.astro 内部顶线（`h-0.5 bg-[var(--color-ed-accent)]`）。

## Steps

1. editorial.css：按 Target A 替换 `.ed-veil` 整块（含新增 ::before/::after）。
2. BaseLayout.astro：`VEIL_COVER_MS` 120 → 160，更新状态机注释为横向幕布描述。
3. 自检：`grep -n "translateY" src/styles/editorial.css | grep -i veil` 无结果（方向已改横向）；`grep -n "color-ed-fg" src/styles/editorial.css | grep -i veil` 无结果；`grep -n "ed-veil::" src/styles/editorial.css` 命中两条。

## Boundaries

- 不动 nav-fast/预取/错峰封顶/首访编排/016 进度条/导航收起。
- 遮罩纯 transform/visibility；不加文字/logo 装饰。
- 不改 root VT 与 site-nav 的 none 规则。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-3 自检 grep。
- **Feel check**（preview）:
  - 点击导航：纸色幕布自左向右扫入（右缘砖红线引路）→ swap → 继续右扫揭开（左缘红线标出揭示线），一次连续横向翻页，总 ~360ms，无静止色块。
  - 慢网（Slow 3G）：幕布盖住后短暂停留（纸色 + 双红线框住视口）再扫出。
  - 连续快速点击：擦除顺滑重启，最终停在最后目标页。
  - 首访硬刷新：无幕布，完整编排不变。
- **Done when**: 幕布为纸色横向擦除 + 砖红前缘线，与站点主题一致。
