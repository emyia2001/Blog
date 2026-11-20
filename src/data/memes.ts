/**
 * Meme 彩蛋图单 —— 页脚小图标点击后随机展示。
 * 加一张图：先传到 R2 桶（建议单独放 meme/ 前缀，如 https://img.snarkm.com/meme/<名>.webp），
 * 再在数组里补一行 URL 即可，无需改任何代码。
 * 数组为空时页脚按钮不渲染（避免死按钮）。
 */
export const MEMES: string[] = [];
