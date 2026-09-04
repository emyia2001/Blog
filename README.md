# Snark

一个基于 **Astro 5** 的个人博客，编辑风（Editorial）排版，主打「期刊 / 杂志」式的阅读体验。支持全文搜索、文章关系图谱、背景音乐、评论，以及通过 Pages CMS 在手机上发文。

> 写给多年后的自己，也写给现在的自己——关于写作、技术，以及缝隙之间的反思。

---

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | [Astro](https://astro.build) 5（`output: static`，纯静态） |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`，主题令牌见 `editorial.css` 的 `@theme`） |
| 内容 | Content Collections + MDX（`@astrojs/mdx`） |
| 搜索 | [Pagefind](https://pagefind.app)（构建后生成索引） |
| 图标 | [astro-icon](https://github.com/withastro/astro-icon) + `@iconify-json/mdi` |
| 关系图谱 | `d3-force`（动态导入，客户端渲染 SVG） |
| 评论 | [Giscus](https://giscus.app)（GitHub Discussions 驱动） |
| 部署 | Cloudflare Pages（`git push` 即自动构建） |

---

## 主题特色

这是一个**编辑风 / 期刊风**主题，整体气质像一本排版讲究的纸质杂志：

- **字体与色彩**：标题用衬线 `Playfair Display` + `Noto Serif SC`，正文用 `Source Sans 3`；纸张底色 `#F9F8F6`、墨色 `#1C1C1C`、点缀色砖红 `#A63A2B`。
- **固定装饰框**：大屏下页面四周有一圈细线边框，顶部为砖红强调线；左侧竖排写着 `SNARK · EDITORIAL JOURNAL`。
- **首页报头头条 + 双栏版面**：最新一篇以「本期头条」大字呈现（附 Vol 刊号与坚持天数），右侧独立栏承载关于卡（个人信息 + GitHub 贡献热力图）、纪事、标签——全程不依赖封面图维护。
- **首字下沉 + 引语（drop-cap / pull-quote）**：文章正文首段首字下沉，可选引语块独立呈现。
- **阅读时长**：`readingTime` 工具对中英混排做智能估算（中文 ~300 字/分，英文 ~200 词/分）。
- **右侧目录（TOC）**：文章页右侧 sticky 目录，带滚动高亮（scroll-spy）；移动端变为右侧抽屉。
- **滚动入场动画**：`.reveal`（淡入）与 `.mask-reveal`（擦除）在元素进入视口时触发。
- **客户端视图过渡**：基于 Astro `ViewTransitions`，站内跳转无刷新。
- **背景音乐（MiniPlayer）**：右下角迷你播放器，支持单曲循环、淡入淡出、切后台自动暂停、回前台恢复。
- **关系图谱**：独立 `/graph` 页用 `d3-force` 力导向图呈现文章/人物/事件的关联，支持拖拽、滚轮缩放、点击查看详情、放大全屏；正文里的 `[[维基链接]]` 会自动连边。
- **全文搜索**：`Cmd/Ctrl + K` 唤起搜索弹窗，由 Pagefind 提供（需先构建出索引）。
- **GitHub 贡献热力图**：首页关于卡内展示，构建期拉取（GraphQL/公开抓取双路径）。

---

## 目录结构

```
src/
├── consts.ts                站点常量：站名、头像、URL、创站日、默认 BGM
├── content.config.ts        三个内容集合的 Zod schema（posts / moments / notes）
├── content/                MDX 内容（详见下方「内容模型」）
│   ├── posts/              文章
│   ├── moments/            时间线节点（人物 / 事件）
│   └── notes/              随感（短想法）
├── layouts/
│   ├── BaseLayout.astro    HTML 骨架：<head> SEO/OG/RSS、导航、搜索、页脚、
│   │                        ViewTransitions、无障碍「跳至主内容」
│   └── Sidebar.astro       文章页布局：正文 + 右侧目录 / 相关文章 / 评论 / 上下篇
├── components/
│   ├── Nav.astro          顶部导航（桌面 + 移动端抽屉，抽屉裁剪在视口内防溢出）
│   ├── Footer.astro        页脚
│   ├── GraphView.astro     关系图谱（d3-force，可拖拽缩放，详情面板）
│   ├── ContributionHeatmap.astro GitHub 贡献热力图渲染
│   ├── MiniPlayer.astro    背景音乐播放器（Web Component）
│   ├── SearchModal.astro   搜索弹窗（Pagefind，Cmd/Ctrl+K）
│   ├── Giscus.astro        评论区（主题 CSS 按 commit hash 自动走 jsDelivr）
│   ├── TagCloud.astro      标签云（可复用，按计数排序）
│   ├── PrevNext.astro      文章上下篇导航
│   └── BackToTop.astro     回到顶部
├── pages/
│   ├── index.astro         首页：报头头条 + 双栏（近期笔墨 | 关于/纪事/标签卡）
│   ├── timeline.astro      纪事：时间线（moments 流，右侧固定轴）
│   ├── graph.astro         关系图谱（独立页，整页宽）
│   ├── archive.astro       归档（标签云 + 按年文章列表，已合并原 /tags）
│   ├── notes.astro         随感列表（段末来源渲染为右对齐破折号标识）
│   ├── blog/[slug].astro   文章详情（调用 Sidebar 布局）
│   ├── tags/[tag].astro    标签筛选页
│   ├── 404.astro           自定义 404
│   ├── rss.xml.ts          RSS 订阅源
│   ├── robots.txt.ts       robots 协议
│   └── giscus-theme.css.ts Giscus 主题 CSS 的构建期 hash 直链
├── styles/
│   ├── editorial.css       设计令牌（@theme）+ 全局/排版/Prose 样式
│   ├── fonts.css           字体 @font-face（本地 woff2）
│   └── giscus-theme.css    Giscus 暗/亮主题变量
└── utils/
    ├── readingTime.ts      中英混排阅读时长估算
    ├── graphData.ts        关系图谱节点/连线聚合（posts + moments）
    └── contributions.ts    GitHub 贡献热力图取数（GraphQL/公开抓取）

public/
├── fonts/                 本地字体（Playfair Display / Source Sans 3 的 woff2）
└── images/                banner / graph 图标 / 头像（touxiang.webp）

.pages.yml                 Pages CMS 配置（posts + notes 两个集合）
```

---

## 内容模型

内容以 MDX 文件存放在 `src/content/`，由 `content.config.ts` 定义字段。

### `posts`（文章）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 标题 |
| `date` | date | 发布日期 |
| `excerpt` | string | 摘要 |
| `slug` | string? | 链接短名，决定 `/blog/<slug>`（CMS 发文时填写） |
| `heroImage` | string? | 图 URL（可选；已不渲染为文章封面，仅用于分享卡 `og:image` 与图谱节点头像） |
| `articleLayout` | `"sidebar"` | 目前仅 sidebar 一种版式 |
| `tags` | string[] | 标签 |
| `draft` | boolean | 草稿（`true` 不发布） |
| `featured` | boolean | 置顶 |
| `pullQuote` | string? | 引语 |
| `bgm` | `{ src, title }?` | 该文专属背景音乐 |
| `graph` | `{ name?, avatar?, enabled? }?` | 关系图谱配置（`enabled:false` 可把该文排除出图谱） |

### `moments`（时间线节点）
`type` 为 `person`（人物）或 `event`（事件），可选 `graph` 配置，用于「纪事」与关系图谱。可选 `bgm: { src, title }`：在纪事点开本节点时，右下角迷你播放器会播放该节点专属曲目（与文章一致）。

### `notes`（随感）
极简短想法，只含 `date?`（可选）与 `draft` 两个字段，无需标题与摘要。`date` 可留空——页面展示与排序**默认取该文件的 git 提交时间（精确到分钟）**，因此用 CMS 发文时无需手填日期。正文段落末尾写 `—— 来源` 会被自动渲染为右对齐的破折号来源标识，段首空两格。

### 三者区别（一句话）
- **posts** = 完整可独立访问的长文章：有自己的 URL（`/blog/<slug>`）、标签、侧边栏目录、相关文章与评论。
- **moments** = 时间线上的短节点（`person` 人物 / `event` 事件）：没有独立页面，只能在「纪事」时间线（点开内联展开正文）与关系图谱（/graph）里看，更轻量、偏碎片记录。
- **notes** = 更短的一句话随感，独立成区 `/notes`，连标题/摘要都不要。

| 维度 | posts | moments | notes |
| --- | --- | --- | --- |
| 独立页面 | ✅ `/blog/<slug>` | ❌ 仅纪事/图谱 | ✅ `/notes` 列表 |
| 首页形态 | 头条 + 目录 | 「浮光」胶片条 | 不出现 |
| 纪事页 | 已移除（现仅 moments） | 点开内联展开正文 | 不出现 |
| 关键字段 | `slug` / `tags` / `pullQuote` / `articleLayout` / `featured` | `type`（person/event） | 仅 `date?` / `draft` |
| 排版形态 | 长文 + 侧栏目录 + 评论 | 短节点正文 | 极短段落 |
| 关系图谱 | 节点跳 `/blog` | 节点无外链 | 不出现 |
| 标签页 / RSS | ✅ | ❌ | ❌ |

---

## 本地开发

```bash
npm install
npm run dev      # 开发模式 http://localhost:4321
npm run build    # 构建 + 生成 Pagefind 搜索索引（输出到 dist/）
npm run preview  # 预览构建结果（含搜索索引）
```

搜索功能依赖 `npm run build` 阶段生成的 Pagefind 索引，因此本地 `dev` 模式下搜索弹窗会提示「索引尚未生成」，属正常现象。

---

## 用 CMS 在手机上发文（Pages CMS）

本仓库已内置 `.pages.yml`，可直接用 [Pages CMS](https://pagescms.org) 在浏览器（含手机）里编辑内容：

1. 打开 https://pagescms.org ，用 GitHub 登录，绑定本仓库 `emyia2001/Blog`。
2. 左侧出现「文章」「随感」两个集合，即可新建 / 编辑，保存会自动提交到仓库并触发 Cloudflare 重新构建。
3. 新建文章时填写「链接 slug」（英文短名，决定 `/blog/<slug>`）；随感文件名自动按时间戳生成。

> 注意：`.pages.yml` 与 `content.config.ts` 是**双份 schema**，需保持一致——改了 `content.config.ts` 的字段（尤其是类型 / 枚举），记得同步 `.pages.yml`，否则 CMS 新建的文章可能与 Zod 校验不符导致构建失败。

---

## 自定义要点

- **站点信息**：`src/consts.ts` 里改 `SITE_NAME` / `SITE_DESCRIPTION` / `SITE_URL` / `SITE_AVATAR`（首页关于卡与图谱中心节点头像）/ `SITE_CREATED`（创站天数起点）/ `SITE_BGM`（默认背景音乐）。
- **设计令牌**：`src/styles/editorial.css` 顶部的 `@theme` 集中定义了配色（`--color-ed-*`）与字体（`--font-serif` / `--font-sans`），改这里即可换肤。
- **导航 / 社交**：导航项在 `src/components/Nav.astro`（首页/纪事/图谱/随感/归档，无「关于」——个人信息并入首页右栏）；社交图标在首页右栏关于卡（`astro-icon` + mdi，见 `SITE_SOCIAL`）。
- **评论**：`Giscus.astro` 默认指向 `emyia2001/comment` 仓库，换成自己的仓库需同步 `data-repo` / `data-repo-id` / `data-category-id`。

---

© Snark — 随笔 · 技术 · 生活


