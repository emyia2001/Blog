import type { APIRoute } from 'astro';
import themeCss from '../styles/giscus-theme.css?raw';

/**
 * giscus 从 giscus.app iframe 内以 <link crossorigin="anonymous"> (CORS 模式)
 * 加载自定义主题 CSS。public/ 静态文件由底层服务器直接提供、不经过 Astro
 * middleware，因此改为 endpoint 动态返回并显式放行 CORS，否则样式会被
 * 浏览器拦截（link 存在于 DOM 但不生效）。
 */
export const GET: APIRoute = () =>
  new Response(themeCss, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
