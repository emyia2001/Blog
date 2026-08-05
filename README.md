# Snark

一个基于 Astro 的个人博客，编辑风排版，支持全文搜索和文章目录。

## 技术栈

- [Astro](https://astro.build) + MDX
- Tailwind CSS v4
- [Pagefind](https://pagefind.app) 全文搜索

## 本地运行

```bash
npm install
npm run dev      # 开发模式 http://localhost:4321
npm run build    # 构建 + 生成搜索索引
npm run preview  # 预览构建结果
```

## 写文章

在 `src/content/posts/` 下新建 `.mdx` 文件：

```yaml
---
title: "文章标题"
date: YYYY-MM-DD
excerpt: "摘要"
articleLayout: sidebar
tags: ["tag1"]
featured: false
---
```

`## 二级标题` 自动出现在右侧目录，首段自动下沉首字，其余段落缩进两字。

也可以让 Hermes 代劳——项目内置了 [blog-writer skill](.opencode/skills/blog-writer/SKILL.md)，描述文章内容即可自动生成并发布。
