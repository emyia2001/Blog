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
    slug: z.string().optional(),
    heroImage: z.string().optional(),
    articleLayout: z
      .enum(["sidebar"])
      .default("sidebar"),
    tags: z.array(z.string()).optional().default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    pullQuote: z.string().optional(),
    dropCap: z.boolean().optional().default(true),
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
    bgm: z
      .object({
        src: z.string(),
        title: z.string().optional(),
      })
      .optional(),
    graph: graphConfig,
  }),
});

// 日记：轻量独立的每日流水，与 moments 混排在纪事页时间线。不进图谱/RSS/搜索，仅作个人记录；
// 若将来迁移到 Ech0 可整体退役此集合。date 为"记录当天"的真实日期，必填。
const diary = defineCollection({
  type: "content",
  schema: z.object({
    date: z.date(),
    title: z.string().optional(), // 缺省用日期作展示标题
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, moments, diary };
