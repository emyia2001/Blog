# 015 — 代码块复制按钮：标签文字交叉淡化

- **Status**: TODO
- **Commit**: f53cba8
- **Severity**: LOW
- **Category**: 8 错失的机会（成功时刻的反馈完整性）
- **Estimated scope**: 3 文件（src/utils/rehype-code-block.ts、src/styles/editorial.css、src/layouts/BaseLayout.astro）

## Problem

复制成功时按钮整体在播 420ms 脉冲（`copy-success`），但标签文字是 `textContent` 硬切——成功时刻里唯一不动的部分：

```ts
// src/utils/rehype-code-block.ts:56-70 — current（生成的标记）
children: [
  {
    type: "element",
    tagName: "span",
    properties: { className: ["code-block__copy-label"] },
    children: [{ type: "text", value: "复制" }],
  },
],
```

```ts
// src/layouts/BaseLayout.astro:212-219 — current
const label = btn.querySelector(".code-block__copy-label");
const original = label?.textContent ?? "复制";
btn.classList.add("is-copied");
if (label) label.textContent = "已复制";
window.setTimeout(() => {
  btn.classList.remove("is-copied");
  if (label) label.textContent = original;
}, 1600);
```

## Target

标记改为双层标签（默认/已复制），`.is-copied` 类驱动 3px 升降交叉淡化；JS 只切类，不再改文字。

## Repo conventions to follow

- token：`--ease-ed`（editorial.css:28）；按钮样式在 `src/styles/editorial.css:633-682`（`.code-block__copy`、`.is-copied`、`@keyframes copy-success`）。
- 注释风格：中文短注释（参照 editorial.css:413-418 的写法）。

## Steps

1. `src/utils/rehype-code-block.ts`（56-70 行）：`children` 改为两个 span：

```ts
children: [
  {
    type: "element",
    tagName: "span",
    properties: { className: ["code-block__copy-label", "code-block__copy-label--default"] },
    children: [{ type: "text", value: "复制" }],
  },
  {
    type: "element",
    tagName: "span",
    properties: { className: ["code-block__copy-label", "code-block__copy-label--done"], "aria-hidden": "true" },
    children: [{ type: "text", value: "已复制" }],
  },
],
```

2. `src/styles/editorial.css`：在 `.code-block__copy` 样式附近（`@keyframes copy-success` 之后）追加：

```css
/* 复制标签交叉淡化：默认字上浮退出，「已复制」从下方 3px 升入（跟随按钮 420ms 成功脉冲） */
.code-block__copy { position: relative; }
.code-block__copy-label {
  display: inline-block;
  transition:
    opacity 120ms var(--ease-ed),
    transform 120ms var(--ease-ed),
    visibility 0s linear 120ms;
}
.code-block__copy-label--done {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(3px);
  visibility: hidden;
  transition:
    opacity 120ms var(--ease-ed),
    transform 120ms var(--ease-ed);
}
.code-block__copy.is-copied .code-block__copy-label--default {
  opacity: 0;
  transform: translateY(-3px);
  visibility: hidden;
}
.code-block__copy.is-copied .code-block__copy-label--done {
  opacity: 1;
  transform: none;
  visibility: visible;
}
@media (prefers-reduced-motion: reduce) {
  .code-block__copy-label,
  .code-block__copy-label--done {
    transform: none;
    transition: opacity 120ms linear;
  }
}
```

   注意：`.code-block__copy` 若已有 `position` 声明则不要重复；确认按钮现有 `border-radius: 999px` 与 padding 不会被 absolute 子元素撑破（flex 居中 + inset 0 即可）。

3. `src/layouts/BaseLayout.astro`（212-219 行）：简化为只切类：

```ts
btn.classList.add("is-copied");
window.setTimeout(() => {
  btn.classList.remove("is-copied");
}, 1600);
```

   删除 `label`/`original` 相关行。若上方还有兼容 execCommand 的分支，保持不动。

## Boundaries

- 不动 `copy-success` 按钮脉冲、hover/active 反馈、剪贴板逻辑。
- 不改 `.code-block` 容器布局。

## Verification

- **Mechanical**: `npm run build` 前先 `npx astro check` 通过；构建后任一文章页代码块 DOM 里有 `code-block__copy-label--default/--done` 两个 span。
- **Feel check**:
  - 点复制：按钮脉冲的同时「复制」上浮淡出、「已复制」从下方升入，1.6s 后反向回切。
  - Rendering 面板开 reduced-motion：无位移，仅透明度切换。
  - 屏幕阅读器/右键检查：复制态下默认字 visibility hidden，不会读出「复制 已复制」。
- **Done when**: 文字切换成为成功反馈的一部分而非硬切。
