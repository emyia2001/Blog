// 为 public/images/covers/ 下的本地封面生成贴近显示尺寸的 WebP 派生图。
//
// 为什么要有它：1080px 原图直接塞进 ~150px 的卡片，Chrome 对 lazy 大图
// 走低分辨率解码路径，在分数缩放屏（125%/150%）上封面明显发糊；
// 换成接近显示尺寸的派生图后解码接近 1:1，任何 DSF 都清晰，顺带省 ~85% 流量。
//
// 产物写在各目录的 gen/ 子目录（gitignore），dev/build 前自动再生成（package.json
// 的 predev / prebuild）。已有且比源图新则跳过，增量可控。
import { readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COVERS = join(ROOT, "public", "images", "covers");
const WIDTHS = [480, 960];

function* walkImages(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "gen") continue; // 派生目录不递归
      yield* walkImages(p);
    } else if (/\.(jpe?g|png)$/i.test(name)) {
      yield p;
    }
  }
}

let made = 0;
let skipped = 0;
for (const src of walkImages(COVERS)) {
  const outDir = join(dirname(src), "gen");
  mkdirSync(outDir, { recursive: true });
  const base = basename(src, extname(src));
  for (const w of WIDTHS) {
    const out = join(outDir, `${base}-${w}w.webp`);
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
      skipped += 1;
      continue;
    }
    await sharp(src)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);
    made += 1;
  }
}
console.log(`[cover-variants] 生成 ${made} 个，跳过（已最新）${skipped} 个`);
