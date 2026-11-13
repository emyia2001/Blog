# 022 — 遮罩改墨色滑动擦除：连续运动、总时长 ~300ms、无静止等待

- **Status**: TODO（用户反馈：021 遮罩白屏（纸色像页面白掉）且节奏太久；改为墨色滑动擦除）
- **Commit**: f53cba8（基于当前工作树，以代码内容为准）
- **Severity**: HIGH
- **Category**: 用户反馈 / 换页体验
- **Estimated scope**: 2 文件（src/layouts/BaseLayout.astro、src/styles/editorial.css）

## Problem

021 遮罩的两个问题：
1. **白屏感**：遮罩背景用了 `var(--color-ed-bg)`（纸色，接近白）——盖屏阶段整屏静止纸色，看起来像页面白掉/卡住，而不是过渡动画。
2. **太久**：「至少盖满 180ms + 揭开 240ms」的最短周期 ~420ms，且盖屏后遮罩静止等待——静止色块 + 偏长节奏 = 观感迟滞。

## Target

**连续运动的全页擦除**：墨色遮罩从视口底部滑上来盖住（120ms），swap 后继续向上滑出揭开新页（180ms），全程单一方向连续运动、无静止停留。总周期 ~300ms；慢速取页时遮罩在盖住位短暂停留（墨色读作「翻页中」，不再有白屏感）。

### A. 状态机 JS（BaseLayout.astro，替换 021 的 nav-veil-cover 三处钩子）

```ts
// 全局换页遮罩（墨色滑动擦除）：从底部滑上盖屏（120ms），swap 后继续向上
// 滑出揭开（180ms）——连续单方向运动，无静止等待；慢速取页时在盖住位停留
let veilShownAt = 0;
const VEIL_COVER_MS = 120;
document.addEventListener("astro:before-preparation", () => {
  veilShownAt = performance.now();
  document.documentElement.classList.remove("nav-veil-exit");
  document.documentElement.classList.add("nav-veil-cover");
});
document.addEventListener("astro:after-swap", () => {
  const wait = Math.max(0, VEIL_COVER_MS - (performance.now() - veilShownAt));
  window.setTimeout(() => {
    document.documentElement.classList.remove("nav-veil-cover");
    document.documentElement.classList.add("nav-veil-exit");
    window.setTimeout(() => document.documentElement.classList.remove("nav-veil-exit"), 220);
  }, wait);
});
```

（`astro:page-load` 回调开头的兜底复位保留，并把 `nav-veil-exit` 一并移除：`document.documentElement.classList.remove("nav-veil-cover", "nav-veil-exit");`——中断/回退复位；正常路径 no-op。）

### B. 遮罩样式（editorial.css，替换 `.ed-veil` 整块）

```css
/* target */
/* --- 全局换页遮罩：墨色滑动擦除。盖屏：底部滑上 120ms；揭开：继续上滑 180ms。
   单方向连续运动、无静止色块；swap 在盖住位之下完成（root VT 零动画） --- */
.ed-veil {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--color-ed-fg);
  transform: translateY(101%);
  visibility: hidden;
  pointer-events: none;
  /* 复位态：退出完成后 invisibly 归位底部（visibility 延迟确保滑出可见） */
  transition:
    transform 180ms var(--ease-ed),
    visibility 0s linear 180ms;
}
html.nav-veil-cover .ed-veil {
  visibility: visible;
  transform: translateY(0);
  /* 盖屏：120ms 快速滑上 */
  transition:
    transform 120ms var(--ease-ed),
    visibility 0s;
}
html.nav-veil-exit .ed-veil {
  visibility: visible;
  transform: translateY(-101%);
  /* 揭开：继续向上滑出，180ms */
  transition:
    transform 180ms var(--ease-ed),
    visibility 0s linear 180ms;
}
```

要点：
- 遮罩颜色 `var(--color-ed-fg)`（墨色 #1C1C1C）——替代 021 的纸色，消除白屏感。
- 三个状态全靠 transform 滑动（合成器友好）：复位态在 `translateY(101%)`（视口下方）、盖住位 `0`、退出位 `-101%`（视口上方）。
- 揭开方向与盖屏**同向**（继续向上）——「一页翻过去」的连续感，而非来回弹。
- 退出完成后由 JS 的 220ms setTimeout 移除 `nav-veil-exit`，元素带 `visibility` 延迟切回隐藏复位态，不可见地归位底部。

### C. root VT 零动画保持（editorial.css）

021 已恢复的 `::view-transition-old/new(root) { animation: none; }` 规则与 site-nav 四条规则**原样保留**（swap 在盖住位之下完成）。`:root` 里「换页在遮罩下 swap，root 快照零动画」注释保留。

### 保留不动

nav-fast 全套、018 预取、错峰封顶、首访完整编排、016 进度条、导航收起等全部既有系统。

## Repo conventions to follow

- token：`--ease-ed`（expo-out）、`--color-ed-fg`（墨色，editorial.css:21 附近）。
- `html.*` 状态类范式；滑动擦除的位移语言与抽屉（`translateX/Y` 滑入滑出）一致。

## Steps

1. BaseLayout.astro：按 Target A 替换遮罩状态机（保留 page-load 兜底复位并扩展为同时移除两个类）。
2. editorial.css：按 Target B 替换 `.ed-veil` 整块。
3. 确认 Target C 的两条 none 规则原样在位。
4. 自检：`grep -rn "nav-veil-cover\|nav-veil-exit" src/layouts/BaseLayout.astro src/styles/editorial.css` 命中；`grep -n "color-ed-bg" src/styles/editorial.css | grep -i veil` 无结果（遮罩不再用纸色）；`grep -n "ed-loading\|nav-loading" src/` 无结果。

## Boundaries

- 不动 nav-fast/预取/错峰封顶/首访编排/016 进度条/导航收起。
- 遮罩纯 transform/visibility，不加透明度、不加装饰元素。
- 不改 root VT 与 site-nav 的 none 规则。

## Verification

- **Mechanical**: `npx astro check` 通过；`npm run build` 成功；step-4 自检 grep。
- **Feel check**（preview）:
  - 点击导航：墨色从底部快速滑上盖住（120ms），随即继续上滑揭开新页（180ms）——一次连续向上「擦拭」，无静止白屏/墨屏停留（预取命中时），总 ~300ms。
  - 慢网（Slow 3G）：墨色盖住后短暂停留（等待取页）再上滑揭开——停留是深色「翻页中」而非白屏。
  - 连续快速点击：擦拭动作顺滑重启，最终停在最后目标页。
  - 首访硬刷新：无遮罩，完整编排不变。
- **Done when**: 遮罩为墨色连续滑动擦除，总周期 ~300ms，无静止等待与白屏感。
