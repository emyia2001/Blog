# 拾集数据与封面方案（精简版）

> 状态：设计稿（未改代码）
> 日期：2026-11-02（替代同日早期版本，已按「只保留封面」收窄范围）
> 涉及文件：`src/pages/collection.astro`、`src/data/collection.ts`、新增 `scripts/sync-*.mjs`、`src/data/collection-assets.json`

## 0. 实施记录（P1 音乐，2026-11-02）

- 歌单：`blog`（id `18553197483`，47 首）→ 按专辑去重后 **38 张专辑**。
- 数据落点：`src/data/music.generated.ts`（TS 模块，比 JSON 好做类型检查；`collection-assets.json` 留到豆瓣/短篇阶段再引入）。
- 同步命令：`npm run sync:music`（也可 `node scripts/sync-netease.mjs <歌单ID>` 或 `NETEASE_PLAYLIST_ID=...`）。
- 交互：点击专辑封面**直接新标签打开网易云歌曲页**（歌单里首次出现的那首歌），不再走详情弹层。
- 封面：暂用网易云 CDN `?param=600y600` 直链（实测可直连）；R2 镜像等凭证到位后由脚本补上传步骤。
- 验证：`npm run check` 0 错误；`npm run build` 通过；产物音乐区 = 38 个 `vol`、38 张封面、38 个 `data-link`。

### 书籍封面（2026-11-02）

- 已为 6 本抓取封面并落库到 `public/images/covers/books/`（豆瓣封面 `l` 尺寸，或 MangaDex 官方封面）。
- 新增条目：朝花夕拾、白夜行、恶意、蓦然回首；补封面：我与地坛、链锯人。
- 弹窗展示评分（豆瓣 5 本 + Bangumi 1 本）、出版社/年月/页数；定价按需求不展示。
- 豆瓣封面不能直链（403/418），下载需带 `Referer: https://book.douban.com/`；条目元数据可用 `https://book.douban.com/j/subject_suggest?q=书名` 与 `https://m.douban.com/rexxar/api/v2/book/<id>` 取得（含评分/版本）。
- 链锯人豆瓣无第 1 卷条目，封面取自 MangaDex 官方日版第 1 卷。


## 1. 目标与范围

| 分类 | 数据来源 | 展示 |
|---|---|---|
| 音乐 | 网易云**公开歌单**，按专辑去重 | 1:1 专辑封面墙；点击跳网易云播放 |
| 电影 / 电视剧 | 豆瓣条目 ID 抓海报（封面） | 3:4 或 2:3 海报墙；点击开详情 |
| 书籍 / 漫画 | 仅封面（自己上传 R2 或手填 URL） | 立体书架不变 |
| 短篇插画 / 漫画 | 本地图片序列上传 R2 | 封面卡 + 灯箱画廊 |

明确**不做**：站内阅读器、完整书籍/漫画文件托管、下载入口、私有桶签名、账号体系。

## 2. 现状

- 数据：`src/data/collection.ts` 的 `COLLECTION`，字段 `title / creator / year / hue / note / cover?`。
- 渲染：`src/pages/collection.astro`
  - `books` → 立体书架（`cover` 生效）
  - `music` → 1:1 专辑墙（`cover` 生效）
  - `movies` / `tv` → **纯文字封面墙**，`cover` 完全不渲染，卡片也没有 `data-image`（弹层拿不到大图）
  - 分类形态靠 `SHELF_KINDS` + `id === "music"` 隐式判断
- 基础设施：`https://img.snarkm.com` 已是 R2 独立域名（`BaseLayout.astro` 已 preconnect，文章图在用）；部署为 push `main` → Actions `npm run build`。
- 约束：纯静态站，构建必须离线可重复；抓取只能发生在同步脚本或构建期（且不进 CI）。

## 3. 数据结构

```ts
// src/data/collection.ts
export interface CollectionItem {
  title: string;
  creator: string;
  year: number;
  note: string;
  cover?: string;        // 展示封面（所有分类通用）
  link?: string;         // 外链：网易云专辑 / 豆瓣条目
  douban?: string;       // 豆瓣条目 ID（电影/剧，供同步脚本抓海报）
  albumId?: number;      // 网易云专辑 ID（音乐，由脚本写入）
  gallery?: string[];    // 短篇图片序列，顺序即浏览顺序
  hue?: number;          // 历史字段，未使用，保留兼容
}

export interface CollectionCategory {
  id: string;
  label: string;
  en: string;
  mode?: "shelf" | "albums" | "wall" | "gallery"; // 显式声明形态
  items: CollectionItem[];
}
```

## 4. 生成型资产：`src/data/collection-assets.json`

抓取/上传的结果集中放一个生成文件，手写文案仍在 `collection.ts`：

```jsonc
{
  "generatedAt": "2026-11-02T...",
  "netease": {
    "playlist": { "id": 123456, "name": "拾集", "url": "https://music.163.com/#/playlist?id=123456" },
    "albums": [
      { "albumId": 407156985, "title": "…", "artist": "…", "year": 2026,
        "cover": "https://img.snarkm.com/collection/music/407156985.jpg",
        "url": "https://music.163.com/#/album?id=407156985" }
    ]
  },
  "douban": {
    "1292052": { "title": "肖申克的救赎", "year": 1994,
      "poster": "https://img.snarkm.com/collection/douban/1292052.jpg" }
  },
  "stories": {
    "rain-cat": { "images": ["https://img.snarkm.com/collection/stories/rain-cat/01.webp"] }
  }
}
```

- 生成文件**提交进仓库**，`npm run build` 只读不联网。
- 缺 key 时回退手写字段，脚本没跑过也能构建。

## 5. 链路 A：网易云歌单 → 专辑

### 5.1 接口实测（2026-11-02，本机）

| 请求 | 结果 |
|---|---|
| `GET music.163.com/api/v6/playlist/detail?id=<歌单ID>`（UA + `Referer: https://music.163.com/`） | 200；返回歌单名、`coverImgUrl`、全量 `trackIds`；**`tracks` 未登录只有前 10 首** |
| `GET music.163.com/api/song/detail?ids=%5B<id1>,<id2>%5D`（方括号需 URL 编码） | 200；每首歌带 `album`：`id / name / picUrl / publishTime / artists` |
| `GET music.163.com/api/v1/album/<albumId>` | 200（备用） |
| `GET music.163.com/api/album/<albumId>` | `-462`（需登录绑定手机，不用） |
| 封面 `p*.music.126.net`（https，无 Referer） | 200，可下载（仍镜像到 R2） |

### 5.2 同步脚本 `scripts/sync-netease.mjs`

1. 读 `NETEASE_PLAYLIST_ID`（`.env.local` 或 CLI 参数）。
2. `playlist/detail` → `trackIds`（顺序 = 歌单顺序）。
3. 每 100 个 ID 一批 `song/detail`；对返回的 `album` **按 `album.id` 去重、保留首次出现顺序** → 专辑列表。
4. 字段映射：`title = album.name`、`artist = album.artists[].name.join(" / ")`、`year = publishTime 的年份`、`url = https://music.163.com/#/album?id=<albumId>`。
5. 下载封面 → 压缩 600×600 webp → 上传 R2 `collection/music/<albumId>.jpg`。
6. 写 `collection-assets.json` 的 `netease` 段。

细节：请求间隔 300–500ms、失败重试 2 次、下架歌曲跳过不中断；先比对旧 JSON，未变化的专辑不重复下载；结束时打印新增/删除/改名摘要。

### 5.3 页面行为

- `music.items` 保留手写 `note`（按 `albumId` 或标题匹配），其余字段由生成数据覆盖；未匹配的专辑按歌单顺序追加，`note` 留空。
- 卡片 1:1 封面 + 专辑名 + 歌手，`loading="lazy"`；弹层有「在网易云打开」。

### 5.4 失败降级

脚本失败不动 JSON（保留上一版）；接口变更只改脚本；页面不感知。仅支持公开歌单。

## 6. 链路 B：豆瓣条目 ID → 电影/电视剧海报

### 6.1 实测结论：不能直链，必须镜像

| 方式 | 结果 |
|---|---|
| 页面 `<img>` 引豆瓣图（`Referer: https://snarkm.com/`） | **403** |
| 无 Referer 引 | **418** |
| 服务端下载（`Referer: https://movie.douban.com/`） | **200** ✅ |
| 桌面条目页 `movie.douban.com/subject/<id>/` | **302 → sec.douban.com 验证页** |
| 搜索建议 `/j/subject_suggest?q=<片名>` | **200** ✅ 返回 `id / title / year / img` |
| 移动页 `m.douban.com/movie/subject/<id>/` | 200，`og:image` 为签名临时 URL（需立即下载） |

### 6.2 脚本 `scripts/sync-douban.mjs`

1. 收集 `COLLECTION` 中带 `douban` 的条目。
2. 取海报：优先 `subject_suggest?q=<title>` 按 id 精确匹配（URL 无签名）；兜底移动页 `og:image`（签名，立刻下载）。
3. 下载：桌面 UA + `Referer: https://movie.douban.com/`；超时 15s、重试 2 次、间隔 1.5–2s。
4. 压缩到 400×600 webp（豆瓣海报 2:3）→ 上传 R2 `collection/douban/<id>.jpg`。
5. 写 `douban` 段；已有 `cover` 的条目不覆盖（人工优先）。

> 脚本只在本地跑，不进 CI（豆瓣反爬）。

## 7. 书籍 / 漫画：只保留封面

- 封面存 R2：`collection/books/<slug>/cover.webp`，数据里写绝对 URL；也可直接手填外链。
- 不做文件托管、不做下载、不做阅读器。
- 需要新增封面时：把图放到约定目录 → 跑 `scripts/sync-covers.mjs`（扫描上传）或直接在 R2 控制台上传后填 URL。

## 8. 短篇插画 / 漫画：灯箱画廊（已确认）

### 8.1 交互

- 卡片：封面（`gallery[0]` 或单独 `cover`）+ 标题 + 张数（如「12 张」）。
- 点开：全屏黑底画廊
  - 顶部：标题 + `3 / 12` 计数 + 关闭
  - 左右按钮、`←/→` 键、移动端横滑
  - 预加载下一张，首张 eager 其余 lazy
  - `prefers-reduced-motion` 下取消过渡
- 不提供纵向连续滚动，避免变成阅读器。

### 8.2 数据结构

```ts
{
  title: "雨天的猫", creator: "自绘", year: 2026, note: "四页小故事",
  mode: "gallery",
  cover: "https://img.snarkm.com/collection/stories/rain-cat/01.webp",
  gallery: ["https://img.snarkm.com/collection/stories/rain-cat/01.webp", "…"],
}
```

### 8.3 上传

`scripts/sync-stories.mjs`：扫描 `~/collection/stories/<slug>/01.jpg…`，按文件名排序，长边压到 ≤1600px webp，上传 `collection/stories/<slug>/NN.webp`，回写 `stories` 段。

### 8.4 组件

新增 `src/components/CollectionGallery.astro`，复用 `ImageLightbox.astro` 的 FLIP/缩放/拖拽逻辑，增加 next/prev 模式。

## 9. R2 目录规范

```
collection/music/<albumId>.jpg      专辑封面 1:1，600×600
collection/douban/<subjectId>.jpg   电影/剧海报 2:3，400×600
collection/books/<slug>/cover.webp  书籍封面
collection/stories/<slug>/NN.webp   短篇图片，长边 ≤1600
```

`.env.local`（不进 git）：

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=blog-media
R2_PUBLIC_BASE=https://img.snarkm.com
NETEASE_PLAYLIST_ID=
```

上传实现：首选 `aws4fetch`（S3 PutObject，批量快）；备选 `npx wrangler r2 object put`（零新依赖，每文件一进程）。

## 10. 页面渲染改动清单（`collection.astro`）

1. 分类支持 `mode`，渲染分支用 `mode` 判断（保留 id 推断兜底）。
2. 墙卡片：`cover` 存在时渲染 `<img>`（`object-fit: cover`）+ 底部文字遮罩；补 `data-image`，弹层才能显示大图。
3. 电影/剧的 `--ar` 改 `2 / 3`（贴合豆瓣海报）。
4. 弹层：支持 `data-image`、外链按钮（`link`）、画廊入口（`gallery`）。
5. 音乐分区：手写 note 与生成专辑数据按 `albumId` 合并。
6. 新增 `CollectionGallery.astro`。
7. 渐进增强：JS 失败时卡片仍能打开文字详情。

## 11. 构建与同步策略

- `npm run build` 不联网，数据全部来自仓库内 JSON。
- npm scripts：`sync:music` / `sync:douban` / `sync:covers` / `sync:stories` / `sync:all`。
- 同步后人工看 `git diff` 再提交；生成文件带 `generatedAt`。
- 豆瓣不建议进 CI；网易云可选每周 Actions 跑并开 PR。

## 12. 风险与限制

| 风险 | 对策 |
|---|---|
| 豆瓣反爬（403/418/302） | 仅本地、限速、失败手填 `cover` |
| 豆瓣 ToS / 版权 | 个人展示、数量控制在几十条 |
| 网易云非官方接口变更 | 脚本隔离、旧 JSON 保留、构建不依赖 |
| 歌单非公开 | 只支持公开歌单 |
| 图片体积 | 统一 webp + 限尺寸 + lazy |

## 13. 分阶段

| 阶段 | 内容 | 验收 |
|---|---|---|
| P1 | 资产 JSON + 网易云同步 + 音乐分区读取 | 专辑按歌单顺序、1:1 封面、点击跳网易云；断网 `npm run build` 通过 |
| P2 | 豆瓣海报同步 + 墙渲染 + 弹层大图/外链 | 电影/剧显示海报，缺图回退文字卡 |
| P3 | 短篇画廊（`gallery` + 全屏组件 + 上传脚本） | 键鼠/滑动翻页、计数、预加载、reduced-motion 正常 |

每阶段跑 `npm run check` + `npm run build`，并手动验 `/collection/` 桌面与移动端。

## 14. 待确认

1. 网易云歌单 ID（需公开）。
2. 电影/电视剧的豆瓣条目 ID 清单；书籍封面自己传 R2 还是也走豆瓣读书条目？
3. R2 桶名与是否已有 S3 API token（决定 `aws4fetch` 或 `wrangler`）。
