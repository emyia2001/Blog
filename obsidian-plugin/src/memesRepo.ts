import type { GitHubClient } from "./github";

/** 博客仓库里 meme 图单文件的路径（页脚彩蛋读这份清单） */
export const MEMES_TS_PATH = "src/data/memes.ts";

export interface AppendMemesResult {
  added: number;
  commitUrl: string | null;
}

/** 远端没有 memes.ts 时创建的最小图单文件（与博客仓库本地的格式一致） */
function initialMemesTs(urls: string[]): string {
  const lines = urls.map((u) => `  "${u}",`).join("\n");
  return `/**
 * Meme 彩蛋图单 —— 页脚小图标点击后随机展示。
 * 加一张图：先传到 R2 桶（建议单独放 meme/ 前缀，如 https://img.snarkm.com/meme/<名>.webp），
 * 再在数组里补一行 URL 即可，无需改任何代码。
 * 数组为空时页脚按钮不渲染（避免死按钮）。
 */
export const MEMES: string[] = [
${lines}
];
`;
}

/** 把图单重写成多行数组形式：头注释原样保留，URL 逐行带缩进 */
function rewriteMemesTs(text: string, urls: string[]): string {
  const decl = text.match(/MEMES\s*:\s*string\[\]\s*=\s*\[/);
  if (!decl || decl.index === undefined) throw new Error(`远端 ${MEMES_TS_PATH} 里找不到 MEMES 图单声明`);
  const close = text.indexOf("];", decl.index);
  if (close < 0) throw new Error(`远端 ${MEMES_TS_PATH} 的 MEMES 数组没有闭合（];）`);
  const head = text.slice(0, decl.index);
  const tail = text.slice(close + 1); // "]" 之后（";" 与结尾换行）
  const body = urls.map((u) => `  "${u}",`).join("\n");
  return `${head}MEMES: string[] = [\n${body}\n]${tail}`;
}

/** 从 MEMES 数组体里提取已有 URL（引号包裹的 http(s) 或站内路径） */
function extractUrls(inner: string): string[] {
  const out: string[] = [];
  for (const m of inner.matchAll(/(["'`])((?:https?:\/\/|\/)[^"'`\n]+)\1/g)) {
    out.push(m[2]);
  }
  return out;
}

/**
 * 把一批 meme URL 追加进远端 src/data/memes.ts 并单文件提交（Actions 自动部署）。
 * 与远端已有 URL 去重；没有新增时不提交，直接返回 added: 0。
 */
export async function appendMemeUrls(
  client: GitHubClient,
  urls: string[],
  onConflict?: (msg: string) => Promise<boolean>,
): Promise<AppendMemesResult> {
  const batch = [...new Set(urls)];
  if (batch.length === 0) return { added: 0, commitUrl: null };

  const remote = await client.getContent(MEMES_TS_PATH);
  let existing: string[] = [];
  let nextText: string;
  if (remote) {
    const decl = remote.text.match(/MEMES\s*:\s*string\[\]\s*=\s*\[/);
    if (!decl || decl.index === undefined) throw new Error(`远端 ${MEMES_TS_PATH} 里找不到 MEMES 图单声明`);
    const close = remote.text.indexOf("];", decl.index);
    if (close < 0) throw new Error(`远端 ${MEMES_TS_PATH} 的 MEMES 数组没有闭合（];）`);
    existing = extractUrls(remote.text.slice(decl.index + decl[0].length, close));
    const known = new Set(existing);
    const added = batch.filter((u) => !known.has(u));
    if (added.length === 0) return { added: 0, commitUrl: null };
    nextText = rewriteMemesTs(remote.text, [...existing, ...added]);
    const res = await client.putFile(
      MEMES_TS_PATH,
      nextText,
      `feat: meme 图单新增 ${added.length} 张（Obsidian 插件）`,
      onConflict,
    );
    return { added: added.length, commitUrl: res.commitUrl };
  }

  // 远端还没有 memes.ts：创建初始文件（本批 URL 全算新增）
  const res = await client.putFile(
    MEMES_TS_PATH,
    initialMemesTs(batch),
    `feat: meme 图单新增 ${batch.length} 张（Obsidian 插件）`,
    onConflict,
  );
  return { added: batch.length, commitUrl: res.commitUrl };
}
