// Pagefind 产物裁剪：删掉站点用不到的整套 UI 资源。
//
// 背景：`pagefind --site dist` 会同时生成「索引」和「官方 UI 组件」。
// 本站搜索弹窗是自写的（src/components/SearchModal.astro），只 import `/pagefind/pagefind.js`
// 的 init/search API，因此 pagefind-ui.js / pagefind-component-ui.js 等约 400KB
// 永远不会被请求，白白占据部署产物。
//
// 此脚本在 postbuild 里紧跟 pagefind 执行；只删已知的 UI 资产，索引文件
// （pagefind.js、pagefind-entry.json、fragment/、index/、*.pf_meta、wasm、worker）保留。

import { existsSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagefindDir = join(root, "dist/pagefind");

const UI_ASSETS = [
  "pagefind-ui.js",
  "pagefind-ui.css",
  "pagefind-component-ui.js",
  "pagefind-component-ui.css",
  "pagefind-modular-ui.js",
  "pagefind-modular-ui.css",
  "pagefind-highlight.js",
];

if (!existsSync(pagefindDir)) {
  console.error("[prune-pagefind] 找不到 dist/pagefind，先跑 pagefind 生成索引");
  process.exit(1);
}

let removed = 0;
let bytes = 0;
for (const name of UI_ASSETS) {
  const file = join(pagefindDir, name);
  if (!existsSync(file)) continue;
  try {
    bytes += statSync(file).size;
    rmSync(file);
    removed += 1;
  } catch (err) {
    console.warn(`[prune-pagefind] 跳过 ${name}: ${err}`);
  }
}

console.log(
  `[prune-pagefind] 删除 ${removed} 个未使用的 UI 资产，省下 ${(bytes / 1024).toFixed(0)}KB`
);
