// 将 @fontsource/noto-serif-sc 的 CJK 分片字体物化到 public/fonts/noto-serif-sc/。
//
// 背景：Noto Serif SC 全量字重约 86MB / 816 个 woff2 分片（按 unicode-range 切块，
// 浏览器只按需下载命中块）。fontsource 的 CSS 默认用相对 ./files/ 引用字体，
// 且单文件 chinese-simplified-*.css 是 1.5MB 整包——这里改用官方分片 CSS（400/700.css），
// 并把 url 改写成站内绝对路径，配合 fonts.css 里 @import 本地 CSS 使用。
//
// 为什么不直接 import 'node_modules/...' 让 Vite 打包：Vite 会把分片 CSS 内联成约
// 200 个 @font-face 并重写为 hashed 资源路径，开发/构建均可用；但本地 @import 与
// 现有 fonts.css 模式更一致，且字体文件走 public/ 直接拷贝，dist 体积可控。
//
// 字体文件不进 git（见 .gitignore 的 /public/fonts/noto-serif-sc/），
// 由 predev / prebuild 在本地物化；CI 构建（Cloudflare Pages）同样会先跑 prebuild。
// 若 node_modules 缺失（如安装时用了 --omit=dev），脚本会给出清晰报错而非静默缺字。

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@fontsource/noto-serif-sc");
const destRoot = join(root, "public/fonts/noto-serif-sc");
const weights = ["400", "700"];

if (!existsSync(join(src, "package.json"))) {
  console.error(
    "[materialize-noto-serif-sc] 找不到 @fontsource/noto-serif-sc，请先 npm install"
  );
  process.exit(1);
}

mkdirSync(join(destRoot, "files"), { recursive: true });

// 1) 拷贝字重分片 CSS，并把 ./files/ 相对路径改写为站内绝对路径
for (const weight of weights) {
  const cssPath = join(src, `${weight}.css`);
  let css = readFileSync(cssPath, "utf8");
  css = css.replaceAll("url(./files/", "url(/fonts/noto-serif-sc/files/");
  writeFileSync(join(destRoot, `${weight}.css`), css);
}

// 2) 只拷贝 400/700 两个字重实际用到的分片（CSS 里出现过的 woff2）
const referenced = new Set();
for (const weight of weights) {
  const css = readFileSync(join(src, `${weight}.css`), "utf8");
  for (const m of css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)) {
    referenced.add(m[1]);
  }
}
for (const file of referenced) {
  cpSync(join(src, "files", file), join(destRoot, "files", file));
}

const count = referenced.size;
console.log(
  `[materialize-noto-serif-sc] 已物化 ${count} 个 woff2 分片与 ${weights.length} 个 CSS 到 public/fonts/noto-serif-sc/`
);
