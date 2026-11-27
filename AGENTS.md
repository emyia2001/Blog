# AGENTS.md — Snark 博客仓库执行守则

> 本文件由 dsh / Claude Code 等 agent 自动加载，作为本仓库（`/root/blog`）的执行基准。
> 它是对系统提示、开发者指令与用户直接指令的补充，不覆盖它们；更具体的指令优先于更宽泛的指令。

## 1. 项目速览

- **项目**：Snark —— 基于 **Astro 5** 的个人博客（编辑风 Editorial 排版），产物 `dist/` 部署到 `snarkm.com`（**Cloudflare Workers**）：`wrangler.jsonc` 的 `main` 指向 `src/worker.ts`（API Worker）+ `assets`（静态资源，直接命中的资源不计 Worker 请求）。Worker 现有三个端点：`/api/bark`（友链申请 Bark 推送，secret `BARK_KEY`，`BARK_LIMIT` KV 做每日限次）、`/api/likes`（纪事点赞聚合，KV 复用 `BARK_LIMIT` 命名空间，`likes:counts` 单键计数 + `like:*` 去重；IP 只存 SHA-256 哈希）与 `/api/weather`（首页票面天气：`request.cf` 按 IP 定位访客城市 → **Worker 侧**请求 open-meteo；天气 API 国内常不可达所以不经前端外网；无 cf/上游失败返回 `{ok:false}` 前端只显示日期）。改 Worker 后可用 `npx wrangler deploy --dry-run` 验证打包。
- **线上地址**：`https://snarkm.com`（`astro.config.mjs` 的 `site` 从 `src/consts.ts` 的 `SITE_URL` 导入，唯一真源；不要再硬编码域名）。
- **技术栈**：Astro 5（`output: static`）+ MDX + Tailwind CSS v4（`@tailwindcss/vite`）+ Pagefind（全文搜索，构建后生成索引）+ astro-icon + d3-force（关系图谱）+ Giscus（评论）。
- **Git 远程仓库**：`emyia2001/Blog`（GitHub）。部署由 `.github/workflows/deploy-worker.yml` 负责：
  `push main` / 每日 UTC 21:30（北京时间 05:30，用于刷新构建期数据如贡献热力图）/ 手动 `workflow_dispatch`
  → `npm ci` → `npm run build` → `npx wrangler deploy`（wrangler 在 devDependencies，版本随 lockfile 锁定）。
  需要的仓库 secrets：`CLOUDFLARE_API_TOKEN`（Workers 脚本:编辑 + Workers 路由:编辑 + 区域:读取）、`CLOUDFLARE_ACCOUNT_ID`，
  以及 `CONTRIB_TOKEN`（GitHub classic PAT，`read:user`；构建时注入为环境变量 `GITHUB_CONTRIB_TOKEN`。
  **secret 名不能以 `GITHUB_` 开头**——GitHub 保留前缀，所以仓库里叫 `CONTRIB_TOKEN`，代码里读的是 `GITHUB_CONTRIB_TOKEN`）。


## 2. 常用命令

```bash
npm run dev       # 开发服务器 http://localhost:4321（server.host=true，局域网可访问）
npm run build     # 构建到 dist/，并在 postbuild 生成 Pagefind 索引
npm run preview   # 预览构建产物（含搜索索引）
npm run check     # astro check：内容集合类型 + 组件内客户端脚本类型（0 错误是提交门槛）
```

- **postbuild 会裁剪 Pagefind 的官方 UI 资产**（`scripts/prune-pagefind.mjs`，约 400KB 用不到的文件）；
  站点搜索弹窗只用 Pagefind 的 `init/search` API，删掉 UI 包不影响搜索。

- **搜索索引只在 `npm run build` 后存在**：dev 模式下搜索弹窗提示「索引尚未生成」属正常现象。
- 提交前若改动影响构建，先 `npm run build` 验证通过（必要时 `npm run preview` 抽验关键页面）。

## 3. 目录结构速查

```
src/
├── consts.ts              站点常量（站名/URL/头像/创站日/默认BGM/社交链接/GitHub仓库）
├── content.config.ts      二集合 Zod schema（posts/moments）——内容字段的权威定义
├── content/
│   ├── posts/             文章（长文，独立 URL /blog/<slug>）
│   └── moments/           纪事：person/event/diary 三类（无独立页面）
├── layouts/
│   ├── BaseLayout.astro   HTML 骨架（head/SEO/导航/搜索/页脚/ViewTransitions）
│   └── Sidebar.astro      文章页布局（正文 + 右侧目录/相关文章/评论/上下篇）
├── components/            Nav / Footer / MiniGraph（文章页侧栏迷你图谱，复用 GraphView）/
│                          ContributionHeatmap / MiniPlayer / SearchModal / Giscus /
│                          TagCloud / Toc / PrevNext / BackToTop / FriendTreeDialog / ImageLightbox
├── pages/                 路由实际目录结构：index.astro（车票封面（滚动撕票，每次进首页都从票根开始）+
│                          报头头条 + 双栏：left 近期笔墨 / right 关于·纪事卡）/
│                          about.astro（关于页：关于区 + 左侧 macOS dock（动态/拾集两项）+
│                          动态区 + 拾集区——原 timeline/collection 两页整体迁入，
│                          /timeline 与 /collection 均重定向到对应 /about/#锚点）/
│                          tree.astro（链接生成二维码树）/
│                          archive.astro / friends.astro（友链，数据在 src/data/friends.ts）/
│                          tags/index.astro + tags/[tag].astro / blog/[slug].astro / 404.astro /
│                          rss.xml.ts / robots.txt.ts / giscus-theme.css.ts
│                          注：无 graph.astro —— 独立图谱页已在 8b6d906 删除
├── styles/                editorial.css（@theme 设计令牌 + 全局/Prose 样式）、fonts.css、giscus-theme.css
├── types/                 第三方无类型模块的本地声明（d3-force）
└── utils/                 urls.ts（站内 URL 统一出口）/ readingTime.ts / graphData.ts（图谱聚合）
│                          / contributions.ts（GitHub 热力图取数）/ graphSnake.ts（归档页书虫彩蛋）
│                          / editorialShikiTheme.ts
│                          / rehype-code-block.ts / rehype-image-attrs.ts
├── worker.ts              API Worker（/api/bark 友链申请推送、/api/likes 点赞聚合；其余透传 ASSETS）
public/                    fonts/（本地 woff2）、images/（头像/OG 图）、_headers（响应头，Workers 静态资源同样读取）
scripts/                   materialize-noto-serif-sc.mjs（字体物化）、prune-pagefind.mjs（产物裁剪）
.pages.yml                 Pages CMS 配置（posts + moments 集合）
```

## 4. 内容模型与写作约定（改动内容时的重点）

- 两个集合的**字段权威定义在 `src/content.config.ts`（Zod schema）**。写新内容或改字段前先对照它，确保 frontmatter 合法，否则构建失败。
- **双份 schema 警告**：`.pages.yml` 与 `content.config.ts` 必须保持一致。若改了 content schema 的字段/类型/枚举，**必须同步 `.pages.yml`**，否则 CMS 新建的内容可能通不过 Zod 校验。

### posts（文章）
- 必备字段：`title`、`date`、`excerpt`。常用可选：`slug`（**决定** `/blog/<slug>`，英文短名；不填则用文件名——URL 统一由 `src/utils/urls.ts` 的 `postPath()` 生成）、`tags`、`heroImage`、`articleLayout: sidebar`（目前唯一）、`draft`、`featured`、`dropCap`、`bgm`、`graph`。
- `featured: true` 会让该文成为首页头条（多篇置顶时取最新；都没有则取最新一篇）。
- 排版约定（来自 `src/content/posts/example-post.mdx`）：正文标题从 `##` 起（`#` 留给页面标题），可到 `####`，都会进右侧目录；文章以 800~1500 字为宜；首段自动下沉首字（除非 `dropCap: false`）。
- **关系图谱**：连线只来自真实关联——frontmatter `graph.links`（slug 列表，权威来源；指向不存在的 slug 构建期 warn）与正文里的站内 md 链接（`/blog/<slug>/` 形式，隐式补充）。**不要用 wiki-link `[[锚点]]` 做关联声明**——`[[...]]` 不产生连线，正文会原样显示方括号文字。
- 示例模板：`src/content/posts/example-post.mdx`（复制改字段即可）。

### moments（纪事）
- 字段：`type: person|event|diary`（默认 event，**内部行为开关**——图谱节点/日记不入图/归档过滤，feed 不再展示）、`date`（必填，记录当天）、`title?`（可选，日记常缺省，展示用日期兜底）、`tags?`（自由标签，展示在纪事右上角，类似文章标签）、可选 `heroImage`、`draft`、`bgm`、`graph`、`lock?`。**纪事无 `excerpt`**（摘要是 posts 专属；归档图谱节点悬停预览对纪事只出标题/头像）。
- **长文入口卡**：正文 >800 字（`about.astro` 的 `LONG_BODY_LIMIT`，构建期判定）的条目在关于页动态区不直出全文，以入口卡呈现（引文=正文前两段合并，CSS 两行 clamp + 底部渐隐——「未完」信号不依赖省略号；无「阅读全文」按钮，整卡即链接）。阈值可调。详情页源码 `src/pages/chronicle/[id].astro`；**详情页支持 BGM**：悬浮 MiniPlayer（文章页模式，首次交互起播）。动态流长文卡不显示曲目行，互动行「点赞」左侧有 ♪ 音乐标记（被动提示，与时间轴标记同款；短条目的提示是曲目行本身）。详情页**暂无 lock 支持**（首个带锁长文发布前需补）。
- **person/event**（人物/事件）：回顾型人生节点，有 `title` 通常也带 `excerpt` 与 `graph`——进归档页关系图谱与归档列表（/archive）。归档列表里**无标题纪事用正文首行兜底做行标题**（否则整排只剩日期、看不出是什么动态），行链接直达 `/about/#<锚点>`（动态视图内定位该条目），不再是笼统的 `/about/#feed`。
- **diary**（日记）：日常流水，`title`/`excerpt` 可留空——**不进图谱 / 归档 / RSS / 搜索**，只在关于页动态区时间线展示（轴上为方点、标签「日记」）。
- 页面结构：**「动态」区**（关于页 `about.astro` 内 `<section id="feed">`；`/timeline` 经 astro.config `redirects` 重定向到 `/about/#feed`）= 碎碎念连续信息流（全部条目服务端直出、**按月分组**：`.tl-month` 月标题「2026年11月」+ 英文小字（参考 flowersink /life）；**内嵌时间线 + 阅读进度动效**：`.timeline-feed::before` 基线为**浅色发丝线**（左凹槽，桌面 44px / 移动 30px），`::after` 为 2px 墨色**进度线**（高度 = `--tl-progress` × 全程，滚动时滚到哪条数据线就加深加粗到哪，脚本在页面尾部独立 `<script>`），`.tl-entry::before` 空心节点对齐 byline、`.is-current` 实心砖红点亮，`.tl-month::before` 为月起点实心节点；右侧文字轴不保留；feed 单列 47rem 居中；`#锚点` 深链接可用），diary 在流中无标题、占位更紧。**长文条目（正文 >800 字）只显示入口卡**（标题 + 首段引文 + 「阅读全文」，整卡是跳转链接），点击进入**独立详情页 `/chronicle/<锚点>/` 沉浸阅读**（大标题排版 + 返回动态（回 `/about/#<锚点>`）+ 点赞 + giscus 评论——specific 映射 term=锚点，与动态流条目评论共用同一讨论串；图片走 lightbox）。动态流入口卡展开正文的历史方案已废。**纪事长文集合页暂未建**（入口刻意低调，用户后议）。
- **lock 内容加密（三类都可用）**：`{ question, answer }`——构建期用 `src/utils/lockContent.ts` 把**正文** AES-GCM 加密成密文写入产物（**明文绝不进源码**），浏览器端输对 `answer` 经 PBKDF2(120000, SHA-256) 派生密钥解密，解密结果会话记忆。**安全边界**：密文+谜面都在页面里，懂技术且耐心者可离线破解，故 `answer` 必须长且唯一（勿用单词/生日/姓名）。解密后为 markdown 原文、以纯文本分段展示（不重新编译 MDX 排版）。客户端逻辑在 `about.astro` 的 `<script>` 中（`tryUnlock`/`decryptBlock`），事件委托处理各条目常驻的 `.lock-box`。**BGM 与锁联动**：同一条目既配 `bgm` 又配 `lock` 时，`MiniPlayer` 会收到 `gated`——播放器先隐藏、不自动播放、也不注册「首次交互即播放」，解锁成功后由 `fillLocked()` 调 `player.unlockPlay()` 才显示并播放（会话记忆恢复走同一路径）。

### 内容新增/修改后的提交要求
- `moments` 排序依赖 frontmatter `date`，**新增/编辑后记得提交**。

### 首页/纪事/文章侧栏：个人信息与迷你关系图谱（构建期实现要点）
- **个人信息（关于页「关于」视图，2026-11-27 重设计 + 双栏）**：`.about-about-grid` 双栏（约 62rem 居中，桌面端在页头与页脚之间上下居中 `min-height: calc(100svh - 22rem)`，内容短时空白上下均分）——主列 = 身份带（头像 84px 圆形、无边框 + 名字 + 简介 + 社交）+ 自述区（`SITE_STORY`，consts.ts 里 2–4 行，衬线、pre-line、留空隐藏）；右窄栏 = **站点档案**（`dl` 竖排键值：创站/运行/文章/动态/收藏，小标题「站点档案」）。移动端收单列（档案在自述之后）。GitHub 热力图仍在首页右栏关于卡，不在关于页重复。**左侧 dock 菜单**（macOS 风格，`.about-dock`，**视图切换器：关于（人形图标）/ 动态（双波纹）/ 拾集（书架）三项**）：`position: fixed` 贴视口最左侧（`left: 14px`）、**垂直居中**（浮在页面留白上，栅格首列保留为 clearance）；磨砂悬浮面板（backdrop-filter）+ 指针邻近放大（脚本按距离写 `--dock-scale`，1→1.3 二次衰减，多项目逐项独立）+ 悬停提示条（面板右侧深色 tooltip）+ 点击弹跳（`translate` 属性动画，不覆盖 scale）。**点击 = 切视图**（`.about-layout[data-view]` 控制三个 `.about-view` 的显隐，一次只显示一个区；hash 跟随 `#feed`/`#collection`/空，`history.replaceState`）；首屏视图由 aside 后的内联脚本按 hash 预置（保证 /timeline、/collection 重定向与 `#moment-xxx` 条目深链接在模块脚本执行前就位）；切换后抛一次 `resize` 让拾集书架按可见宽度重排；移动端（<768px）无 dock，三块 `.about-view` 依次堆叠展示（连续阅读）。**运行指示圆点已删除（2026-11-27）**，当前视图的 dock 项以砖红高亮（`.is-active`）。**2026-11-27 起页头 H1 随视图切换**（`[data-view-title]`：关于/动态/拾集；移动端三块堆叠固定「关于」），拾集计数显示在 `page-head__aside`（仅拾集视图）；动态/拾集的内层区块标题已删除——一页一个标题，标题由 page-head 承担。热力图数据经 `src/utils/contributions.ts` 构建时拉取，渲染用 `ContributionHeatmap.astro` 组件（仅首页使用，SVG 为 w-full 自适应）。
- **拾集区（关于页 `<section id="collection">`）**：原 `collection.astro` 整体迁入 `about.astro`（2026-11-27）——筛选 chips（role=tablist）+ 立体书架/专辑墙 + 详情 `<dialog>`（`showModal`，字体/档案样式全随迁）；数据在 `src/data/collection.ts`；`/collection` 经 astro.config `redirects` 重定向到 `/about/#collection`，导航「拾集」项已移除，定位交给 dock 第二项（书架图标）；脚本沿用原页面的 VT 安全模式（document 委托 + `astro:page-load` 重初始化）；封面派生图（gen/*-480w/960w.webp）机制不变。
- **首页车票封面**：`index.astro` 顶部 `.ticket-runway`（高 100vh+70vh 撕票行程）内嵌 sticky `.ticket-cover`（overflow:hidden 裁掉飞出的半块）；主票/存根是两个锯齿 clip-path 互补的半块。滚动进度由脚本写入 `--tear`（0→1），在 `.ticket` 上重映射为分阶段变量——拉扯 0–0.10（存根微颤）/ 撕裂 0.10–0.55（裂缝沿打孔圆点线自上而下生长，打孔线只保留裂缝下方未撕段）/ 票根飞离 0.55–0.81 / 主票飞离 0.66–0.96（飞出视口，**不渐隐**）；回滚自然复原。票面家具（2026-11-27）：名称左侧证件照（圆角方图，与标题同高并排成 logo 锁定）+ 名字/简介/发行·里程字段行；SNARK·ADMIT ONE 小标与砖红检票章已删除；存根自上而下 = **日期 + 星期**（访客本地 JS 生成，**与正文同款无衬线**，用户点名要求）→ **天气**（同源 `/api/weather`，失败隐藏，本地 dev 无 Worker 不显示）→ 虚线分隔 → **运行天数 / 票号**（站点统计保留）→ **一维码**（由票号派生的确定性装饰条纹，SVG rect）。`WEATHER_FALLBACK`（北京）在 consts.ts。**2026-11-27 起取消「会话内只出现一次」**：无 sessionStorage/ticket-gone 跳过逻辑，首页默认永远从票根开始（用户要求）。
- **图谱渲染位置**：**没有独立图谱页**。完整图谱在**归档页顶部**（`archive.astro`），默认是一条可点缩略条（MiniGraph 同规格高度，chrome 隐藏、整条覆盖按钮）——点击经 `graph:expand` CustomEvent 全屏展开（FLIP），全屏还原时广播 `graph:collapsed` 落回缩略条；大尺寸跳变时节点重摆种子 + 离线定格；**展开/还原都会复位平移缩放**（否则全屏里缩放过再收回，残留 zoom 变换会把小图内容推出画布，看起来像没节点）。文章页侧栏是「相关文章迷你图谱」（`Sidebar.astro` 里的 `<MiniGraph>`，内部复用 `GraphView.astro`，`bare` 模式，懒初始化：浏览器空闲时才拉 d3-force chunk 渲染）。节点/连线由 `src/utils/graphData.ts` 的 `buildGraphData(posts, moments)` 聚合（不需 render 全文，节点详情只用自带字段）；交互脚本在 `GraphView.astro` 自带 `<script>` 中（无 `client:` 指令，Astro 打包后随页面执行）：Obsidian 式在线力导 + 原生 SVG 渲染，支持连线淡化/悬停点亮关联线、节点物理拖拽（fx/fy + 重热）、放大全屏（展开/还原复位平移缩放）；**事件/动态节点 = 四角小星 ✦**（低透明度 0.68、`R.event` 4.5，比文章实心点/人物空环更细碎不起眼；图例同款），并监听 `astro:before-swap` / `pagehide` 做清理（ViewTransitions 兼容）。
- **节点聚合规则**：posts + moments 中「非 draft 且 `graph.enabled !== false`（默认 true）」的内容各成一个节点（无 self 中心、无年份中枢）；**moments 中 `type: diary` 的日记不入图**。节点显示名 = `graph.name ?? title`；post 节点可跳 `/blog/<id去掉.mdx>`，moment 无落地页。
- **连边来源**：只有真实关联——frontmatter `graph.links`（slug 列表）与正文站内 md 链接，跳过自连与重复边；没有关联的内容就是孤点，漂在图外圈。
- **书虫彩蛋**：`src/utils/graphSnake.ts`——归档图谱里一只墨色书虫漫游、吞节点（节点隐身 + 连线沉底 + collide 半径归零）、按 `RESPAWN_MS` 吐回原位、避光标（静止光标胆子变大）、可抓取丢弃。参数全在该文件顶部；`prefers-reduced-motion` / bare 迷你图 / 节点 <3 时不初始化。
- **改动图谱前必读**：见上方 posts 的「关系图谱」条目——关联只认 `graph.links` 与站内 md 链接，**别拿 `[[...]]` 当连线或内链**。
- **贡献热力图**：首页关于卡在构建期请求 GitHub 贡献数据并烤进 HTML（`contributions.ts`）。有 `GITHUB_CONTRIB_TOKEN` 时走 GraphQL（含「公开显示的私有仓库」贡献），否则或失败时回退公开抓取，再失败则热力图留空（构建日志 console.warn 可见）。令牌读取：`import.meta.env.GITHUB_CONTRIB_TOKEN ?? process.env.GITHUB_CONTRIB_TOKEN`（Astro 构建与 Vite dev 都会读 `.env.local`）。这正是 §1 里 GitHub Actions 每日重建要刷新的「构建期数据」。

## 5. Git 提交规范（本仓库有强制钩子）

- **Commit message 用中文，遵循 Conventional Commits**：`feat:` / `fix:` / `chore:` / `docs:` / `test:` / `ci:` 等前缀 + 简要描述（看 `git log` 保持一致，例如 `fix: 修复 View Transitions 站内跳转后…`）。
- **不要添加 `Co-Authored-By` 尾注**：`.githooks/commit-msg`（已通过 `core.hooksPath` 启用）会在提交时**自动剥离所有 Co-Authored-By 行**，因为 GitHub 会把能匹配到账号的邮箱计入仓库 Contributors 列表，导致 AI 账号出现在贡献者名单。若确有需要保留，用 `git commit --no-verify` 绕过（默认不要这么做）。
- 改动内容（尤其 moments）后记得提交。

## 6. 设计与样式约定

### 6.1 文案减法原则（默认删，不默认加）

- **默认删多余的标语、说明文字和次要标签**：新增或修改界面时，先假设这些字都是不必要的——重复页头/导航已有信息的副标题、解释「这是什么」的旁白小字、装饰性 kicker/eyebrow、双语重复标签、读者不看的辅助元信息（时间戳外的统计、免责/占位文案等）。能删就删，不要「留着更保险」。
- **判定标准是删完能不能看懂**，不是「有没有说明」：删掉后用户仍一眼看懂「这是什么、能做什么、下一步点哪里」，即为正确。
- **如果删完看不懂，说明设计本身有问题，应当重新设计**（改信息层级、布局、命名、视觉分组），**而不是把这句说明再加回来**。补说明文字只能掩盖结构缺陷，是本仓库明确的返工信号——不要用文案给设计打补丁。
- 不在删除范围内的：品牌与身份（刊名、站名、页脚署名）、功能必需（导航、按钮、表单标签、空状态/错误提示），以及无障碍文本（`aria-label`、`alt`、`title`）——这些删了才是缺陷。
- 落地检查见 §7.2「改布局/组件/交互」中的减法自查项。

- **设计令牌集中在 `src/styles/editorial.css` 顶部 `@theme`**：纸张底 `--color-ed-bg: #F9F8F6`、墨色 `--color-ed-fg: #1C1C1C`、砖红点缀 `--color-ed-accent: #A63A2B`，另有 `--color-ed-muted/subtle/faint`。字体：标题衬线 `--font-serif`（Playfair Display + Noto Serif SC），正文无衬线 `--font-sans`（Source Sans 3）。
- 视觉基调是**期刊/杂志编辑风**：大屏四周边框 + 顶部砖红强调线 + 左侧竖排刊名；改外观优先动 `@theme` 令牌，而不是散落各处硬编码颜色。
- 站点信息改 `src/consts.ts`（站名/描述/自述 SITE_STORY/URL/头像/创站日/社交链接/GitHub 仓库）；首页右栏三卡 = 关于（头像/统计/热力图/社交）+ 动态（**无标题条目用正文首行兜底，行链接直达 `/about/#<锚点>`**）+ **标签云卡（复用 `TagCloud.astro`）**；导航在 `Nav.astro`（首页/归档/友链/关于——「关于」置末；「动态」2026-11-26、「拾集」2026-11-27 先后并入关于页，导航项移除，定位交给左侧 dock），社交图标在首页右栏与关于页关于区（`astro-icon` + mdi，见 `SITE_SOCIAL`）；Giscus 指向 `emyia2001/comment`（仓库名在 `src/consts.ts` 的 `GISCUS_REPO`，换仓库还要同步 `data-repo-id`/`category-id`）；评论主题 CSS 由同源 endpoint `/giscus-theme.css` 输出（`src/pages/giscus-theme.css.ts`），**不要改回 jsDelivr**——国内线路实测连不上 cdn.jsdelivr.net，评论会掉回默认主题；**CORS 头必须由 `public/_headers` 的 `/giscus-theme.css` 规则提供**（`output: static` 会丢掉 endpoint 的 Response 头，缺 ACAO 时 giscus 回退默认 light 主题、评论区整块发白）；评论区默认只渲染「加载评论」按钮，**点击后才拉 giscus**（giscus.app 在国内首屏开销大，不点不请求）。
- 客户端动画/交互注意：`.reveal` 淡入、`.mask-reveal` 擦除、首页车票封面（滚动驱动 `--tear`）、ViewTransitions 站内无刷新、MiniPlayer 是 Web Component。**改动涉及 ViewTransitions / 移动端抽屉 / 搜索交互时，务必手动验证跳转后行为**（历史上修过「站内跳转后移动端菜单/目录/搜索点击无反应」这类回归）。

## 7. 改动验证与回归清单（升级/重构/大改动必读）

> 原则：改动**影响构建或渲染**时，先 `npm run build` 确认通过；纯静态站没有运行时测试，**关键交互靠手动抽验**。下面按「每次构建必查」→「按改动范围加查」分层。

### 7.1 每次构建后必查（基础门禁）
- [ ] `npm run check` 零错误（内容集合类型 + 组件脚本；`src/env.d.ts` 里那条 reference 不能删，否则内容类型会退化成 any）
- [ ] `npm run build` 零报错（内容 frontmatter 不合法、Zod 校验失败会直接 fail；Pagefind 索引在 postbuild 生成，失败要看日志尾部）
- [ ] `npm run preview` 后首页 `/` 正常渲染，无 Astro 报错白屏
- [ ] 关键静态页可达：`/archive`、`/about`（关于区 + 动态区 + 拾集区 + dock；`/timeline`→`/about/#feed`、`/collection`→`/about/#collection` 重定向正常）、`/tree`、`/friends`、`/tags`（标签总览）、`/tags/<tag>`、一篇 `/blog/<slug>`、`/404`
- [ ] RSS/robots/sitemap 端点：`/rss.xml`、`/robots.txt`、`/sitemap-index.xml` 返回正常

### 7.2 按改动范围加查

**改内容（posts/moments）**
- [ ] frontmatter 对照 `src/content.config.ts` 合法（新字段同时核对 `.pages.yml` 双份一致）
- [ ] 用了 `[[锚点]]` 的正文：确认目标节点存在（`graph.name`/`title` 匹配），否则该连线静默丢失
- [ ] 改文章日期/新增文章后：首页列表、`/archive`、`/tags`、侧边相关文章顺序符合预期

**改布局/组件/交互（Nav、Sidebar、搜索、图谱、移动端、ViewTransitions、MiniPlayer、车票封面）**
- [ ] 文案减法（§6.1）：本页新加和既有的标语/说明小字/次要标签是否都试删过；删后仍一眼看懂才算过。若靠说明文字才看懂，别补文案，回去改信息层级
- [ ] **桌面 + 移动端**都过一遍：菜单抽屉 / 目录 / 搜索弹窗在**站内跳转后**仍可点开（历史回归点）
- [ ] 车票封面（动过 index.astro 封面时）：滚动驱动撕开且回滚复原；每次进首页都从票根开始（无会话跳过）；`prefers-reduced-motion` 下退化为渐隐
- [ ] 搜索：`npm run build` 后（Pagefind 索引存在）在 `/` 上搜到新增内容；**纪事（person/event）正文也要能搜到**（索引来自 `/about` 动态区可见的连续流区块 `data-pagefind-body`，日记条目 `data-pagefind-ignore` 不入索引）；dev 下提示「索引尚未生成」属正常
- [ ] 迷你图谱（文章页侧栏「相关文章」）：节点/连线随新增内容变化；拖拽/缩放/放大全屏正常（依赖 d3-force chunk 懒加载，首屏不应被它阻塞）；改过 `graph.enabled/name` 的条目已复查
- [ ] 评论 Giscus、MiniPlayer BGM、`.reveal`/`.mask-reveal` 动画在目标页面仍工作
- [ ] 换过 `src/consts.ts` 站点信息后：站名/URL/社交链接在各处一致（无残留旧值）
- [ ] 站内链接一律带尾斜杠（统一走 `src/utils/urls.ts`；`href="/blog/x"` 会被 Cloudflare 307 到 `/blog/x/`，多一次往返）
- [ ] 改过 `public/_headers` 后：线上 `curl -sI` 能看到 HSTS / nosniff / Referrer-Policy，且 `/_astro/*` 为 `immutable` 长缓存
- [ ] 改过票面天气（`/api/weather`、index.astro 看板脚本）后：本地只验证日期与「无 Worker 时隐藏天气」；部署后用 `curl -s 'https://snarkm.com/api/weather?lat=39.9&lon=116.4&city=北京'` 抽验返回 `{ok:true,...}`，并看首页存根是否显示「城市 · 天气 温度」
- [ ] 改过 `src/worker.ts`、`.github/workflows/*` 或 `wrangler.jsonc` 后：push 后 *Deploy worker* 跑绿（部署在 Actions 里看，注解会带 wrangler 报错末几行），且线上 `curl -sI https://snarkm.com/` 返回 200；动过 `/api/*` 端点时用 curl 抽验该端点（如 `GET /api/likes`）
- [ ] 改过字体加载方式后：首屏渲染不被 Noto 分片 CSS 阻塞（Network 里 `/fonts/noto-serif-sc/*.css` 出现在主 CSS 之后）

**升级依赖 / 重构 / 改构建配置（astro.config、package.json、Vite/Tailwind/Pagefind 版本）**
- [ ] `npm run build` 通过，且产物体积/`dist/pagefind` 无异常
- [ ] 全站路由与上一版对比无缺页（sitemap 数量/路径）
- [ ] 重点回归 ViewTransitions 站内跳转、搜索索引、代码高亮（`rehype-code-block` 与自定义 Shiki 主题）、字体/图标加载
- [ ] 确认 `site` 来自 `src/consts.ts` 的 `SITE_URL`（`astro.config.mjs` 已从 consts 导入，勿硬编码域名）

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
