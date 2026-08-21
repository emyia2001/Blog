// Rehype plugin: wraps fenced code blocks (`<pre><code>`) in a `.code-block`
// container with a header bar (language label + copy button), so articles get a
// one-click copy affordance without any client-side DOM surgery.
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

interface Target {
  node: Element;
  parent: Element;
  index: number;
}

export function rehypeCodeBlock() {
  return (tree: Root) => {
    const targets: Target[] = [];

    visit(tree, "element", (node, index, parent) => {
      if (
        node.tagName === "pre" &&
        parent &&
        typeof index === "number" &&
        node.children.some(
          (c) => c.type === "element" && (c as Element).tagName === "code"
        )
      ) {
        targets.push({ node: node as Element, parent: parent as Element, index });
      }
    });

    for (const { node, parent, index } of targets) {
      const codeEl = node.children.find(
        (c) => c.type === "element" && (c as Element).tagName === "code"
      ) as Element | undefined;
      const classNames: string[] = (codeEl?.properties?.className as string[]) || [];
      const langClass = classNames.find((c) => c.startsWith("language-"));
      const lang = langClass ? langClass.replace("language-", "") : "";

      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["code-block__bar"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["code-block__lang"] },
                children: [{ type: "text", value: lang }],
              },
              {
                type: "element",
                tagName: "button",
                properties: {
                  type: "button",
                  className: ["code-block__copy"],
                  "data-copy": "",
                  "aria-label": "复制代码",
                },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    properties: { className: ["code-block__copy-label"] },
                    children: [{ type: "text", value: "复制" }],
                  },
                ],
              },
            ],
          },
          node,
        ],
      };

      parent.children.splice(index, 1, wrapper);
    }
  };
}
