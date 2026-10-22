import type { APIRoute } from 'astro';
import themeCss from '../styles/giscus-theme.css?raw';

/**
 * giscus 从 giscus.app iframe 内以 <link crossorigin="anonymous"> (CORS 模式)
 * 加载自定义主题 CSS，因此响应必须带 Access-Control-Allow-Origin。
 *
 * 但本站是 output: static：Astro 只会把这个 endpoint 的响应体写成
 * dist/giscus-theme.css，下面的 Response 头（含 ACAO）会被丢掉。
 * 线上真正生效的 CORS 头来自 public/_headers 里的 /giscus-theme.css 规则——
 * 改这里时不要以为 header 在线上也算数，否则主题被拦截、评论回退白底。
 * 开发服务器（npm run dev）走动态 endpoint，这里的头仍然生效。
 */
export const GET: APIRoute = () =>
  new Response(themeCss, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
