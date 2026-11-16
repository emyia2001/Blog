# Snark 博客（Obsidian 插件）

在 Obsidian 里写作并直接发布到 [snarkm.com](https://snarkm.com)：插件把当前笔记按 `content.config.ts` 的 schema 转成 MDX，单文件提交到 `emyia2001/Blog` 的 main 分支，push 触发 GitHub Actions 构建、Cloudflare Workers 静态资源上线。全程不需要离开编辑器，也不需要额外的服务器。

与 [Pages CMS](https://pagescms.org)（`.pages.yml`）并存不冲突，两者都只是往仓库提交文件。

## 安装

1. 构建产物在 `dist/`（`main.js` + `manifest.json` + `styles.css`，仓库已构建好；改动源码后需重新 `npm run build`）。
2. 把 `dist/` 里三个文件复制到你 vault 的 `.obsidian/plugins/snark-blog-cms/`（目录名随意，需与 manifest 的 `id` 不冲突即可）：

   ```bash
   mkdir -p <你的vault>/.obsidian/plugins/snark-blog-cms
   cp dist/* <你的vault>/.obsidian/plugins/snark-blog-cms/
   ```

3. Obsidian 设置 → 第三方插件 → 启用 **Snark 博客**。

## 配置 token

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token；
2. Repository access 只勾 `emyia2001/Blog`；权限 **Contents: Read and write**（其余可不给）；
3. 把 token 填进插件设置。token 只保存在本机 Obsidian 配置里。

设置里其余项（owner/repo/branch、三个路径、站点 URL）已按本仓库默认填好，一般不用动；可用「测试连接」按钮验证。

### 图片直传 R2（可选，推荐配置）

设置 → Snark 博客 → 「图片直传 R2」，填齐以下项后，**发布时会自动把笔记里的 `![[图片附件]]` 上传 R2，并把笔记本体回填为 `img.snarkm.com` 外链**（回填发生在笔记本身，下次发布不会重复上传；粘贴/拖入图片仍按 Obsidian 默认存为本地附件，不联网）：

| 设置项 | 取值 |
| --- | --- |
| R2 Access Key ID / Secret | Cloudflare → R2 → 管理 R2 API 令牌 → 创建（权限：对象读和写） |
| R2 账户 ID | Cloudflare 账户 ID |
| R2 桶名 | 图床对应的桶 |
| 公网前缀 | `https://img.snarkm.com`（对外 URL 前缀） |
| 对象键前缀 | `blog`（对象按 `blog/年/月/日-随机.扩展名` 归档） |

留空任一项则停用直传（发布时 `![[…]]` 会被拦下，要求改用图床外链）。上传用的是 R2 的 S3 兼容 API + SigV4 签名（无额外依赖），密钥只存本机；可用「R2 说明」行右侧的 ⚡ 按钮做上传/读取/清理三步验证。

## 使用

左侧 ribbon 只有**一个发送图标**：点击弹出菜单。其中「**打开发布面板**」会在 **Obsidian 右侧栏打开常驻发布面板**（不再弹窗）：面板跟随当前笔记（切换笔记自动刷新表单），编辑完点「发布」即可；面板可随右侧栏折叠收纳，Obsidian 会记住它的开关状态。其余入口（同步 / 管理已发布内容 / 管理友链 / 查看最近构建）在菜单与命令面板（`⌘P`）里：

| 命令 | 作用 |
| --- | --- |
| **打开发布面板** | 右侧栏常驻面板：选「文章 / 纪事」、补 slug / 摘要 / 纪事类型 → 发布 |
| **管理已发布内容** | 列出本 vault 已发布的笔记：跳转、GitHub、线上页面、转草稿 / 取消草稿、删除远端 |
| **同步博客内容** | 抓取远端文章/纪事到 vault：仅远端→下载为笔记；远端有更新→下载覆盖；远端已删→清除映射 |
| **管理友链** | 可视化增删改 `friends.json`，保存即回写 |
| **图床图片管理** | 列举 R2 桶内对象：复制公网链接、单个删除（需先配置 R2） |
| **查看最近构建** | 最近一次 Actions 运行状态 |

发布面板含**全部属性**（「全部属性」折叠区：标签、封面图、BGM、lock 问答、图谱配置、置顶/首字下沉/进图谱开关），面板里改完发布时会随提交写回笔记属性；清空某字段等于删除该属性。

## 编辑已发布内容（双向闭环）

发布过的笔记都带着 `blog-path`（仓库路径）与 `blog-hash`（上次提交的内容指纹）：

1. **在别的端改过**（Pages CMS / 网页）→ 「同步博客内容」会把对应笔记标为「远端有更新」，下载覆盖（会确认）；
2. **在 Obsidian 里改** → 直接改笔记正文/属性 → 「发布当前笔记」即为更新提交；
3. 远端文件被删 → 同步面板提示「远端已删除」，可一键清除映射（笔记保留）；
4. **删除远端文章时联动清理图床**：检测到仅被该文引用的 R2 图片会弹确认一并删除（跨笔记引用与其它端创建的内容不会误删/无法检测，均会提示）。

抓取下载会把远端嵌套 YAML 逆向展平成 Obsidian 属性（`bgm`→`bgm-src` 等），按分类放进「同步文件夹」（默认 `博客/`）下的 **`文章/`** 与 **`纪事/`** 子文件夹。

发布成功后笔记会带上 **`blog-path` 属性**（仓库路径），这是「更新 / 撤回 / 删除」的锚点——发布过的笔记请继续用插件更新它，不要手工改这个属性。

### 笔记属性 → 站点字段映射

文章（必填：`title`、`date`、`excerpt`、`slug`，面板里可补）：

| Obsidian 属性 | 站点字段 |
| --- | --- |
| `title` / `date` / `excerpt` / `slug` / `tags` / `heroImage` / `draft` / `featured` / `dropCap` | 同名 |
| `bgm-src` + `bgm-title` | `bgm: { src, title }` |
| `graph-name` / `graph-avatar` / `graph-enabled` / `graph-links` | `graph: { … }`（`graph-links` 是列表，喂关系图谱连线） |

纪事另有 `type`（person / event / diary，默认 event）与 `lock-question` + `lock-answer`（问答加密，须成对填写；answer 请用长且唯一的句子）。

## 语法约定（与仓库一致）

- **图片**：配置 R2 直传后粘贴/拖入即上传回填外链；未配置时只认外链——`![描述](https://img.snarkm.com/…)`，`![[附件]]` 会**阻止发布**并报行号。
- **`[[笔记名]]` 自动转站内链接**：目标笔记已发布（或已设 `slug`）时会转成 `[别名](/blog/<slug>/)`，正好生成图谱连线；匹配不到则原样保留并警告。
- `%%注释%%` 发布时移除；Callout（`> [!note]`）、`==高亮==` 等 Obsidian 特有语法**不转换**，正文请用标准 Markdown。
- 正文含裸 HTML（`<div>` 这类）会警告——MDX 对非标准 JSX 的 HTML 敏感，可能构建失败。

## 提交与冲突

- 提交信息为中文 Conventional Commits（`docs: 发布文章《…》`、`chore: 更新友链`），**从不添加 Co-Authored-By**。
- 远端文件被其他端（Pages CMS / 网页）改过时会弹确认，**不会静默覆盖**。
- 文章 slug 更名会提交新文件并删除旧文件，各一次提交。

## 开发

```bash
npm install
npm run dev      # watch 模式，dist/ 实时更新
npm run build    # tsc --noEmit + esbuild → dist/
```

源码结构：`src/main.ts`（入口/命令）、`settings.ts`、`github.ts`（Contents API + 文件树 + Actions）、`frontmatter.ts`（属性映射、YAML 序列化与解析）、`converter.ts`（正文转换与风险检测）、`publish.ts`（发布编排）、`sync.ts`（远端抓取与比对）、`modals/`（发布 / 管理 / 同步 / 友链 / 确认）。

## 已知边界

- 拾集（`collection.ts`）暂不可管理。
- 同步以 `blog-hash` 指纹识别远端变化；早期版本发布的笔记没有指纹，第一次同步会显示「远端有更新」，覆盖下载一次即自动补齐。
- 构建失败需到 Actions 看日志；插件会在「查看最近构建」里给出入口。
