// view-counter · 文章阅读量计数 API
//
// 端点（均返回 { slug, views }）：
//   POST /views?slug=<slug>   阅读量 +1 并返回新值（用于文章页打开时上报）
//   GET  /views?slug=<slug>   只读当前值，不计数（调试 / 其他展示位用）
//
// 计数存在 Workers KV：每个 slug 一个 key。KV 写入最终一致（同一瞬间多次 +1
// 可能少算一两次），对博客阅读量足够；写入上限免费版 1000 次/天 —— 站点规模
// 远达不到，不构成问题。

export interface Env {
  VIEW_KV: KVNamespace;
}

const ALLOWED_ORIGINS = new Set([
  "https://snarkm.com",
  "http://localhost:4321",
]);

const slugPattern = /^[a-z0-9-]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    };
    if (!ALLOWED_ORIGINS.has(origin)) delete corsHeaders["Access-Control-Allow-Origin"];

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname !== "/views") {
      return new Response("not found", { status: 404, headers: corsHeaders });
    }

    const slug = url.searchParams.get("slug") || "";
    if (!slugPattern.test(slug)) {
      return new Response(JSON.stringify({ error: "invalid slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = `views:${slug}`;
    let views = parseInt((await env.VIEW_KV.get(key)) || "0", 10);
    if (request.method === "POST") {
      views += 1;
      await env.VIEW_KV.put(key, String(views));
    }

    return new Response(JSON.stringify({ slug, views }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
