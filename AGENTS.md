# AGENTS.md — Snark 博客仓库执行守则

> 本文件由 dsh / Claude Code 等 agent 自动加载，作为本仓库（`/root/blog`）的执行基准。
> 它是对系统提示、开发者指令与用户直接指令的补充，不覆盖它们；更具体的指令优先于更宽泛的指令。

## 1. 项目速览

- **项目**：Snark —— 基于 **Astro 5** 的个人博客（编辑风 Editorial 排版），纯静态站点，部署于 Cloudflare Pages（`git push` 自动构建）。
- **线上地址**：`https://blog.snark.casa`（构建配置里 `site` 目前写的是 `https://example.com`，注意不要误以为是真实站点）。
- **技术栈**：Astro 5（`output: static`）+ MDX + Tailwind CSS v4（`@tailwindcss/vite`）+ Pagefind（全文搜索，构建后生成索引）+ astro-icon + d3-force（关系图谱）+ Giscus（评论）。
- **Git 远程仓库**：`emyia2001/Blog`（GitHub）。**GitHub Actions 每日定时触发 Cloudflare 重建**，用于刷新构建期数据（如提交数）。

## 2. 常用命令

```bash
npm run dev       # 开发服务器 http://localhost:4321（server.host=true，局域网可访问）
npm run build     # 构建到 dist/，并在 postbuild 生成 Pagefind 索引
npm run preview   # 预览构建产物（含搜索索引）
```

- **搜索索引只在 `npm run build` 后存在**：dev 模式下搜索弹窗提示「索引尚未生成」属正常现象。
- 提交前若改动影响构建，先 `npm run build` 验证通过（必要时 `npm run preview` 抽验关键页面）。

## 3. 目录结构速查

```
src/
├── consts.ts              站点常量（站名/URL/头像/创站日/默认BGM/社交链接/GitHub仓库）
├── content.config.ts      三集合 Zod schema（posts/moments/notes）——内容字段的权威定义
├── content/
│   ├── posts/             文章（长文，独立 URL /blog/<slug>）
│   ├── moments/           时间线节点（person/event，无独立页面）
│   └── notes/             一句话随感（/notes，只有 date? 与 draft）
├── layouts/
│   ├── BaseLayout.astro   HTML 骨架（head/SEO/导航/搜索/页脚/ViewTransitions）
│   └── Sidebar.astro      文章页布局（正文 + 右侧目录/相关文章/评论/上下篇）
├── components/            Nav / Footer / BannerPlate / CoverPlate / GraphView /
│                          MiniPlayer / SearchModal / Giscus / PersonalCard /
│                          TagCloud / Toc / PrevNext / BackToTop
├── pages/                 路由实际目录结构：index.astro / about.astro（含关系图谱与
│                          GitHub 热力图）/ timeline / archive / notes /
│                          blog/[slug].astro / tags/[tag].astro /
│                          404.astro / rss.xml.ts / robots.txt.ts / giscus-theme.css.ts
├── styles/                editorial.css（@theme 设计令牌 + 全局/Prose 样式）、fonts.css、giscus-theme.css
└── utils/                 readingTime.ts / coverVariant.ts / editorialShikiTheme.ts / rehype-code-block.ts
public/                    fonts/（本地 woff2）、images/（banner/头像等）
.pages.yml                 Pages CMS 配置（posts + notes 集合）
```

## 4. 内容模型与写作约定（改动内容时的重点）

- 三个集合的**字段权威定义在 `src/content.config.ts`（Zod schema）**。写新内容或改字段前先对照它，确保 frontmatter 合法，否则构建失败。
- **双份 schema 警告**：`.pages.yml` 与 `content.config.ts` 必须保持一致。若改了 content schema 的字段/类型/枚举，**必须同步 `.pages.yml`**，否则 CMS 新建的内容可能通不过 Zod 校验。

### posts（文章）
- 必备字段：`title`、`date`、`excerpt`。常用可选：`slug`（决定 `/blog/<slug>`，英文短名）、`tags`、`heroImage`、`articleLayout: sidebar`（目前唯一）、`draft`、`featured`、`pullQuote`、`dropCap`、`bgm`、`graph`。
- 排版约定（来自 `src/content/posts/example-post.mdx`）：正文标题从 `##` 起（`#` 留给页面标题），可到 `####`，都会进右侧目录；文章以 800~1500 字为宜；首段自动下沉首字（除非 `dropCap: false`）。
- **关系图谱**：正文用 wiki-link `[[锚点]]` 声明关联，锚点 = 目标节点在图谱中的 `graph.name`（默认取文章 `title`）。注意目前 `[[...]]` 只生成图谱连线，正文会原样显示方括号文字——**不要为了做内链而用 `[[...]]`**。
- 示例模板：`src/content/posts/example-post.mdx`（复制改字段即可）。

### moments（时间线节点）
- 字段：`title`、`date`、`excerpt`、`type: person|event`、可选 `heroImage`、`draft`、`bgm`、`graph`。
- 无独立页面，只出现在「纪事」时间线（点开内联展开）与关系图谱。

### notes（随感）
- 只有 `date?`（可留空）与 `draft`。**`date` 留空时，页面展示/排序默认取文件的 git 提交时间（精确到分钟）**——所以用 CMS 发文不用手填日期。
- 正文格式：段落末尾写 `—— 来源` 会渲染为右对齐破折号来源标识；段首空两格。

### 内容新增/修改后的提交要求
- `notes` 排序依赖 git 提交时间，**新增/编辑 notes 后应尽快提交**，否则展示时间滞后。

### about 页：关系图谱与贡献热力图（构建期实现要点）
- **图谱渲染位置**：只有 `/about`（`src/pages/about.astro`）渲染 `<GraphView>`。节点/连线在 about.astro 的 frontmatter 里用 Content API 聚合好后以 props 传入；交互脚本在 `GraphView.astro` 自带的 `<script>` 中（无 `client:` 指令，Astro 打包后随页面执行）：d3-force 力导布局 + 原生 SVG 渲染，支持拖拽/缩放/节点详情，并监听 `astro:before-swap` / `pagehide` 做清理（ViewTransitions 兼容）。
- **节点聚合规则**：posts + moments 中「非 draft 且 `graph.enabled !== false`（默认 true）」的内容各成一个节点，另加固定的「我」(self) 节点。节点显示名 = `graph.name ?? title`；post 节点可跳 `/blog/<id去掉.mdx>`，moment 无落地页。
- **连边来源**：所有内容节点都连向 self；正文里 `[[锚点]]`（对原始 body 做正则匹配）按 `graph.name` 优先、`title` 回退找目标节点（保留旧链接可用），跳过自连与重复边。
- **改动图谱前必读**：见上方 posts 的「关系图谱」条目——`[[...]]` 目前只产生连线、正文原样显示方括号，**别拿它当正文内链**。
- **贡献热力图**：about 页在构建期请求 GitHub 贡献数据并烤进 HTML。有 `GITHUB_CONTRIB_TOKEN` 时走 GraphQL（含「公开显示的私有仓库」贡献），否则或失败时回退公开抓取，再失败则热力图留空（构建日志 console.warn 可见）。令牌读取：`import.meta.env.GITHUB_CONTRIB_TOKEN ?? process.env.GITHUB_CONTRIB_TOKEN`（Astro 构建与 Vite dev 都会读 `.env.local`）。这正是 §1 里 GitHub Actions 每日重建要刷新的「构建期数据」。

## 5. Git 提交规范（本仓库有强制钩子）

- **Commit message 用中文，遵循 Conventional Commits**：`feat:` / `fix:` / `chore:` / `docs:` / `test:` / `ci:` 等前缀 + 简要描述（看 `git log` 保持一致，例如 `fix: 修复 View Transitions 站内跳转后…`）。
- **不要添加 `Co-Authored-By` 尾注**：`.githooks/commit-msg`（已通过 `core.hooksPath` 启用）会在提交时**自动剥离所有 Co-Authored-By 行**，因为 GitHub 会把能匹配到账号的邮箱计入仓库 Contributors 列表，导致 AI 账号出现在贡献者名单。若确有需要保留，用 `git commit --no-verify` 绕过（默认不要这么做）。
- 改动内容（尤其 notes / moments）后记得提交，让 git 时间成为排序依据。

## 6. 设计与样式约定

- **设计令牌集中在 `src/styles/editorial.css` 顶部 `@theme`**：纸张底 `--color-ed-bg: #F9F8F6`、墨色 `--color-ed-fg: #1C1C1C`、砖红点缀 `--color-ed-accent: #A63A2B`，另有 `--color-ed-muted/subtle/faint`。字体：标题衬线 `--font-serif`（Playfair Display + Noto Serif SC），正文无衬线 `--font-sans`（Source Sans 3）。
- 视觉基调是**期刊/杂志编辑风**：大屏四周边框 + 顶部砖红强调线 + 左侧竖排刊名；改外观优先动 `@theme` 令牌，而不是散落各处硬编码颜色。
- 站点信息改 `src/consts.ts`（站名/描述/URL/头像/创站日/社交链接/GitHub 仓库）；导航在 `Nav.astro`，社交图标在 `PersonalCard.astro`，Giscus 指向 `emyia2001/comment`（换仓库需同步 `data-repo` 等）。
- 客户端动画/交互注意：`.reveal` 淡入、`.mask-reveal` 擦除、ViewTransitions 站内无刷新、MiniPlayer 是 Web Component。**改动涉及 ViewTransitions / 移动端抽屉 / 搜索交互时，务必手动验证跳转后行为**（历史上修过「站内跳转后移动端菜单/目录/搜索点击无反应」这类回归）。

## 7. 改动验证与回归清单（升级/重构/大改动必读）

> 原则：改动**影响构建或渲染**时，先 `npm run build` 确认通过；纯静态站没有运行时测试，**关键交互靠手动抽验**。下面按「每次构建必查」→「按改动范围加查」分层。

### 7.1 每次构建后必查（基础门禁）
- [ ] `npm run build` 零报错（内容 frontmatter 不合法、Zod 校验失败会直接 fail；Pagefind 索引在 postbuild 生成，失败要看日志尾部）
- [ ] `npm run preview` 后首页 `/` 正常渲染，无 Astro 报错白屏
- [ ] 关键静态页可达：`/about`、`/archive`、`/timeline`、`/notes`、`/tags`、一篇 `/blog/<slug>`、`/404`
- [ ] RSS/robots/sitemap 端点：`/rss.xml`、`/robots.txt`、`/sitemap-index.xml` 返回正常

### 7.2 按改动范围加查

**改内容（posts/moments/notes）**
- [ ] frontmatter 对照 `src/content.config.ts` 合法（新字段同时核对 `.pages.yml` 双份一致）
- [ ] 新增/编辑 **notes** 后已提交（排序/展示时间依赖 git 提交时间）
- [ ] 用了 `[[锚点]]` 的正文：确认目标节点存在（`graph.name`/`title` 匹配），否则该连线静默丢失
- [ ] 改文章日期/新增文章后：首页列表、`/archive`、`/tags`、侧边相关文章顺序符合预期

**改布局/组件/交互（Nav、Sidebar、搜索、图谱、移动端、ViewTransitions、MiniPlayer）**
- [ ] **桌面 + 移动端**都过一遍：菜单抽屉 / 目录 / 搜索弹窗在**站内跳转后**仍可点开（历史回归点）
- [ ] 搜索：`npm run build` 后（Pagefind 索引存在）在 `/` 上搜到新增内容；dev 下提示「索引尚未生成」属正常
- [ ] 图谱（/about）：节点/连线随新增内容变化；点节点右侧详情可开、拖拽/缩放正常；改过 `graph.enabled/name` 的条目已复查
- [ ] 评论 Giscus、MiniPlayer BGM、`.reveal`/`.mask-reveal` 动画在目标页面仍工作
- [ ] 换过 `src/consts.ts` 站点信息后：站名/URL/社交链接在各处一致（无残留旧值）

**升级依赖 / 重构 / 改构建配置（astro.config、package.json、Vite/Tailwind/Pagefind 版本）**
- [ ] `npm run build` 通过，且产物体积/`dist/pagefind` 无异常
- [ ] 全站路由与上一版对比无缺页（sitemap 数量/路径）
- [ ] 重点回归 ViewTransitions 站内跳转、搜索索引、代码高亮（`rehype-code-block` 与自定义 Shiki 主题）、字体/图标加载
- [ ] 确认 `site` 仍是 `https://example.com` 或按需改动（别误当成真实线上地址）

### 7.3 提交前自查
- [ ] `git diff` 复核：无调试残留、无无关文件
- [ ] 遵循 §5 Git 规范（中文 Conventional Commits、不加 Co-Authored-By）
- [ ] 影响构建的改动已按 7.1/7.2 验证

## 8. 任务执行协议（所有任务通用）

1. **先复述，后动手**：动手前先用一句话复述目标、产出物与范围；任务含糊、缺信息或有多种解读时，**先提澄清问题再开始**。
2. **对照关键字段自查**：目标 / 背景 / 范围与约束 / 验收标准 / 涉及文件。缺项就补问。
3. **勘察优先**：改代码前先 read / grep 现有实现与约定（README、content.config.ts、editorial.css、相关组件），基于事实下结论。
4. **最小改动、及时验证**：小步修改；改完运行相关检查（内容改动至少验证 frontmatter 合法 + `npm run build` 通过；组件/布局改动需确认 dev 或 build 无报错）。
5. **如实报告**：结束说明做了什么、验证了什么、没做什么、遗留风险；失败或阻塞要明说。
6. **不擅自扩大范围**：任务外的新想法记下来提给用户，不顺手实现。
7. **涉及本仓库用户的内容创作时**：尊重既有文风（期刊/随笔/反思），中文正文，不擅自替用户改写标题或文字风格；若任务含「润色/改写」以外的创作判断，先确认再动。

## 9. 汇报格式建议

任务结束时用简短结构汇报：

```markdown
做了什么：<改动清单 / 涉及文件>
如何验证：<执行的命令与结果>
未完成 / 遗留：<明确的缺口、风险或待确认项>
下一步建议（可选）：<你认为值得继续做的事>
```

## 10. 任务分发模板（供人类用户复制使用）

```markdown
目标：<要交付什么，尽量可验收>
背景：<为什么做，相关上下文/链接>
约束与边界：<改哪里、不许碰哪里、技术或兼容性限制>
验收标准：<怎样算完成，可列出具体检查点>
涉及文件/路径：<已知的相关文件或目录>
```
