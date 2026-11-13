# 017 — 删除四周装饰边框（body::before）

- **Status**: TODO（改版：原「顶线随导航淡出」方案作废，用户决定整圈删除；上一版的部分改动已在工作树中，本计划一并清理）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: MEDIUM（用户反馈修正）
- **Category**: 视觉修正
- **Estimated scope**: 1 文件（src/styles/editorial.css）

## Problem

`body::before` 是 ≥1024px 视口的四周装饰边框（fixed，z-35，顶边砖红）。导航收起后顶边红线暴露在视口顶部（此前 017 第一版已改为「顶线随导航淡出」，但用户决定**整圈删除**装饰边框）。

当前工作树状态（editorial.css 约 55-72 行）：

```css
/* current */
@media (min-width: 1024px) {
  body::before {
    content: '';
    position: fixed;
    inset: 0.875rem;
    z-index: 35;
    pointer-events: none;
    border: 1px solid var(--color-ed-rule);
    border-top-color: rgba(166, 58, 43, 0.6);
    border-bottom: none;
    /* 顶线视觉上归属导航：导航收起时随之淡出，避免红线残留在视口顶 */
    transition: border-top-color 200ms var(--ease-ed);
    /* 换页时单独命名，避免这圈固定装饰边框随正文一起位移 */
    view-transition-name: ed-frame;
  }
  html.nav-hidden body::before {
    border-top-color: transparent;
  }
}
```

另有两处关联引用：

```css
/* editorial.css 约 428-433 行 — current（工艺约束注释） */
/* 换页像「翻过一页纸」：旧页轻快上浮淡出，新页从下方托入并轻微收焦。
   工艺约束（据 improve-animations 动效审计）：
   - 只动 transform / opacity，外加收尾 ≤2px 的轻模糊遮住交叉叠影，不触发布局；
   - 缓动沿用全站 expo-out 令牌；退出快、进入慢（非对称节奏）；
   - 导航栏与四周装饰边框不参与位移，保持稳定。 */

/* editorial.css 约 441-455 行 — current */
/* 导航栏与四周装饰边框在换页时保持静止（不参与 root 位移），只有内容过渡。
   同名元素会做快照交叉淡化：选中态下划线的位置变化也借此平滑切换。 */
::view-transition-group(site-nav),
::view-transition-image-pair(site-nav),
::view-transition-old(site-nav),
::view-transition-new(site-nav),
::view-transition-group(ed-frame),
::view-transition-image-pair(ed-frame),
::view-transition-old(ed-frame),
::view-transition-new(ed-frame) {
  animation: none;
  mix-blend-mode: normal;
}
```

## Target

装饰边框整体删除；View Transitions 的 ed-frame 静止规则一并清掉（元素没了，规则就是死代码）；site-nav 的静止规则保留。`body::after`（左侧竖排 SNARK 刊名装饰）**不是边框，保留**。

```css
/* target — @media (min-width: 1024px) 中的 body::before 整块删除，不留空壳 */

/* target — 工艺约束注释（最后一行更新） */
/* 换页像「翻过一页纸」：旧页轻快上浮淡出，新页从下方托入并轻微收焦。
   工艺约束（据 improve-animations 动效审计）：
   - 只动 transform / opacity，外加收尾 ≤2px 的轻模糊遮住交叉叠影，不触发布局；
   - 缓动沿用全站 expo-out 令牌；退出快、进入慢（非对称节奏）；
   - 导航栏不参与位移，保持稳定。 */

/* target — VT 静止规则（ed-frame 四个选择器移除，注释更新） */
/* 导航栏在换页时保持静止（不参与 root 位移），只有内容过渡。
   同名元素会做快照交叉淡化：选中态下划线的位置变化也借此平滑切换。 */
::view-transition-group(site-nav),
::view-transition-image-pair(site-nav),
::view-transition-old(site-nav),
::view-transition-new(site-nav) {
  animation: none;
  mix-blend-mode: normal;
}
```

## Repo conventions to follow

- 注释风格：中文短注释，随代码同步更新（参照 editorial.css 现有工艺约束注释的维护方式）。

## Steps

1. 删除 `@media (min-width: 1024px) { body::before { … } html.nav-hidden body::before { … } }` 整块（约 55-72 行，含 017 第一版加入的 transition 与 nav-hidden 规则）。**不要动**紧随其后的 `@media (min-width: 1280px) { body::after { 'SNARK' … } }` 块。
2. 工艺约束注释（约 432 行）：`- 导航栏与四周装饰边框不参与位移，保持稳定。` → `- 导航栏不参与位移，保持稳定。`
3. VT 静止规则（约 441-455 行）：删除四个 `ed-frame` 选择器行，注释 `导航栏与四周装饰边框在换页时保持静止…` → `导航栏在换页时保持静止…`。
4. 全局自检：`grep -rn "ed-frame\|body::before" src/` 应无结果（body::after 不在匹配内）；`grep -rn "装饰边框" src/` 应无结果。

## Boundaries

- 不动 `body::after`（SNARK 竖排刊名）、`.ed-progress`、导航及其余一切样式。
- 不改 View Transitions 的 page-out/page-in 动画本体。

## Verification

- **Mechanical**: `npx astro check` 通过；`grep -rn "ed-frame\|body::before\|装饰边框" src/` 无结果。
- **Feel check**:
  - ≥1024px 视口打开首页/文章页：视口四周不再有装饰边框线；左侧竖排 SNARK 装饰仍在。
  - 滚动让导航收起：视口顶无任何线条残留（016 的进度条淡出逻辑独立工作）。
  - View Transitions 换页：换页动画正常，导航保持静止。
- **Done when**: 装饰边框及其全部引用清除干净。
