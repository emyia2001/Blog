import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { editorialLight } from "./src/utils/editorialShikiTheme";
import { rehypeCodeBlock } from "./src/utils/rehype-code-block";
import { SITE_URL } from "./src/consts";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: "static",
  server: {
    // 固定监听所有网卡:局域网内可直接通过本机 IP 访问开发服务器
    host: true,
  },
  integrations: [mdx(), sitemap(), icon()],
  markdown: {
    shikiConfig: {
      theme: editorialLight,
    },
    rehypePlugins: [rehypeCodeBlock],
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        // pagefind.js 是构建后生成在 dist/pagefind/ 的运行时文件，
        // 必须保持为运行时动态导入，不能被 rollup 静态解析
        external: ["/pagefind/pagefind.js"],
      },
    },
  },
});
