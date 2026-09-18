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
    title: z.string().optional(), // 可选：person/event 通常有；diary 常缺省，展示用日期兜底
    date: z.date(),
    excerpt: z.string().optional(),
    type: z.enum(["person", "event", "diary"]).default("event"),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    // 内容加密（构建时 AES-GCM 加密正文，浏览器端用答案解密）：
    //   question —— 谜面/提示（必填）
    //   answer   —— 答案即密码（必填；建议长且唯一，勿用单词/生日/姓名等弱答案）
    // 注：纯静态站加密上限——密文与谜面都在页面里，懂技术者仍可离线破解。
    lock: z
      .object({
        question: z.string(),
        answer: z.string(),
      })
      .optional(),
    bgm: z
      .object({
        src: z.string(),
        title: z.string().optional(),
      })
      .optional(),
    graph: graphConfig,
  }),
});

export const collections = { posts, moments };
