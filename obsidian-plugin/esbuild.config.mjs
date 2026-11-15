import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const mode = process.argv[2] ?? "build"; // build | watch
const prod = process.argv.includes("--prod") || process.env.NODE_ENV === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // Obsidian 运行环境自带这些模块，绝不打包进去
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2018",
  charset: "utf8",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  outfile: "dist/main.js",
});

mkdirSync("dist", { recursive: true });
copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("styles.css", "dist/styles.css");

if (mode === "watch") {
  await context.watch();
  console.log("watching… （Ctrl+C 退出）");
} else {
  await context.rebuild();
  await context.dispose();
  console.log("build done → dist/{main.js,manifest.json,styles.css}");
}
