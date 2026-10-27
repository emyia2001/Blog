# view-counter · 文章阅读量

> 每篇文章标题下方「N 次阅读」的后端。Cloudflare Worker + KV,一个接口两件事:
> 文章页打开时 `POST /views?slug=<slug>` 计数并返回最新值;同一浏览器 24 小时内
> 重复打开同一篇只 `GET` 不计数(去重在博客前端用 localStorage 实现)。

## 工作方式

```text
文章页加载 ──▶ fetch POST /views?slug=xxx ──▶ Worker ── KV: views:<slug> = N+1
                (24h 内重复打开改 GET,不加数)        └─ 返回 { slug, views } 渲染到 meta 行
```

- 前端在 `src/layouts/Sidebar.astro`(搜 `VIEW_API`),Worker 不可达时静默隐藏该展示位。
- 来源白名单只放行 `snarkm.com` 与本地 dev;slug 只接受 `[a-z0-9-]+`。
- KV 最终一致,并发写入偶尔少计一两次,对阅读量无伤大雅。

## 部署(一次性,约 5 分钟)

```bash
cd workers/view-counter
npm install
npx wrangler login
npx wrangler kv namespace create VIEW_KV     # 输出的 id 填进 wrangler.jsonc
npx wrangler deploy
```

若想绑定自定义域名(如 `views.snarkm.com`),在 Cloudflare Dashboard 给这个
Worker 加 Custom Domain,然后同步改 `Sidebar.astro` 里的 `VIEW_API`。

## 数据查看

```bash
npx wrangler kv key list --binding VIEW_KV     # 列出所有文章
npx wrangler kv key get --binding VIEW_KV "views:<slug>"
```
