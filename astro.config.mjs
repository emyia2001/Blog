import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
  output: "static",
  integrations: [mdx(), sitemap()],
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
