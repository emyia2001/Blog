---
name: blog-writer
description: Use when asked to write or publish an article for this Astro blog — takes user's content direction and creates a ready-to-publish MDX file in src/content/posts/ with correct frontmatter and formatting.
---

# Blog Writer

Write and publish articles for this Astro blog. The user controls all content and style — this skill handles the mechanics.

## File Naming

Use kebab-case English slugs: `my-article-slug.mdx` → URL `/blog/my-article-slug`.

## Frontmatter

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 标题 |
| `date` | ✅ | 日期，格式 `YYYY-MM-DD`，使用 Asia/Shanghai 时区当天日期 |
| `excerpt` | ✅ | 一句话摘要，30 字以内 |
| `articleLayout` | ✅ | 固定 `sidebar`，不要改 |
| `tags` | 可选 | 标签数组，用英文小写，尽量复用已有标签 |
| `featured` | 可选 | `true` 置顶到首页 hero 大图位 |
| `pullQuote` | 可选 | 居中引语，显示在正文上方 |
| `draft` | 可选 | `true` 时不发布，不在任何列表中出现 |
| `heroImage` | 可选 | 头图路径，如 `/images/photo.jpg`，图片放在 `public/images/` |
| `bgm` | 可选 | 背景音乐，`src` 路径 + `title` 曲名 |

完整示例：

```yaml
---
title: "文章标题"
date: 2026-08-05
excerpt: "一句话摘要。"
articleLayout: sidebar
tags: ["tag1", "tag2"]
featured: false
pullQuote: "引语"
heroImage: "/images/photo.jpg"
bgm:
  src: "/music/track.mp3"
  title: "曲名"
---
```

## Body Format

- Use `## 二级标题` for sections — each appears in the right sidebar TOC
- Paragraphs separated by blank lines
- First paragraph auto-renders with a drop cap, subsequent paragraphs auto-indent — no manual styling needed
- Standard Markdown: `*emphasis*`, `**bold**`, `> blockquote`

## File Creation

Create at `src/content/posts/{slug}.mdx`. No other files need changing.

## After Writing

Run `npm run build` in the project root. Zero errors = ready to deploy.
