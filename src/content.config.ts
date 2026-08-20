import { defineCollection, z } from "astro:content";

const graphConfig = z
  .object({
    name: z.string().optional(),
    avatar: z.string().optional(),
    enabled: z.boolean().optional().default(true),
  })
  .optional();

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    heroImage: z.string().optional(),
    articleLayout: z
      .enum(["sidebar"])
      .default("sidebar"),
    tags: z.array(z.string()).optional().default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    pullQuote: z.string().optional(),
    bgm: z
      .object({
        src: z.string(),
        title: z.string().optional(),
      })
      .optional(),
    graph: graphConfig,
  }),
});

const moments = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    type: z.enum(["person", "event"]).default("event"),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    graph: graphConfig,
  }),
});

// 随感：只写一段话的短想法，独立于时间线与首页，单独成区（/notes）
const notes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().optional(),
    date: z.date(),
    draft: z.boolean().default(false),
    excerpt: z.string().optional(),
  }),
});

export const collections = { posts, moments, notes };
