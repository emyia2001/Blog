// Rehype plugin: 给 Markdown 图片补上加载属性。
//
// 为什么需要：文章里的图大多是 R2 上的截图（每张几十到几百 KB），
// 原样输出会全部即刻请求、并全部参与首屏带宽竞争；同时缺 loading/decoding
// 提示会让浏览器错过延迟加载的机会。这里统一：
//   - loading="lazy"    视口外的图片不抢首屏
//   - decoding="async"  解码不阻塞渲染
//   - alt=""            Markdown 未写 alt 时补空值（装饰性），避免读屏念文件名
//
// 注意：不在这里强行塞 width/height —— 远程图片的真实尺寸在构建期拿不到，
// 猜测宽高反而会引入错位。CLS 由「懒加载 + 正文图不参与首屏」来规避。
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";

export function rehypeImageAttrs() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") return;
      const props = (node.properties ??= {});
      if (props.loading == null) props.loading = "lazy";
      if (props.decoding == null) props.decoding = "async";
      if (props.alt == null) props.alt = "";
    });
  };
}
