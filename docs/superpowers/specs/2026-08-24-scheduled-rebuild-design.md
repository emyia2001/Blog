# 设计：每日定时重建（保持构建时数据新鲜）

日期：2026-08-24

## 背景与目标

博客是 Astro 静态站，部署在 Cloudflare Pages（Git 集成自动构建）。关于页的 GitHub
贡献热力图等数据是**构建时**抓取并烤进 HTML 的，只有触发新构建才会更新。目前仅在
push 代码时重建，线上热力图会随时间过期。

目标：每天自动触发一次 Cloudflare 重建，使热力图等构建时数据保持最新。

## 方案（已选定）

GitHub Actions 定时任务调用 Cloudflare Deploy Hook。

```
GitHub Actions (cron 每天 UTC 21:30 ≈ 北京 05:30)
  └─> curl -f --retry 3 POST $CF_DEPLOY_HOOK_URL
        └─> Cloudflare Deploy Hook
              └─> 现有 Git 集成流程拉取 main 重新构建部署
```

### 否决的备选方案

- **Actions 定时推空提交**：污染提交历史；需要额外的推送权限配置。
- **Cloudflare Worker Cron Trigger**：完全在 CF 生态内，但多一个需长期维护的组件。

## 组件

新增唯一文件 `.github/workflows/scheduled-rebuild.yml`：

- 触发器：
  - `schedule: cron "30 21 * * *"`（非整点，避开 GitHub Actions 整点拥堵）
  - `workflow_dispatch`（手动触发按钮，用于验证）
- 步骤：单步 `curl -f --retry 3 -sS -o /dev/null -w "%{http_code}" -X POST`
  `$CF_DEPLOY_HOOK_URL`
  - `-f`：HTTP >= 400 时命令失败
  - `--retry 3`：瞬时失败自动重试
  - 输出 HTTP 状态码便于日志排查

无其他代码改动。

## 配置（一次性，用户操作）

1. Cloudflare 后台 → Workers & Pages → 博客项目 → Settings → Build → Deploy hooks
   → 创建 hook（名称随意，分支选 `main`），复制生成的 URL。
2. GitHub 仓库 → Settings → Secrets and variables → Actions → 新建仓库 secret：
   名称 `CF_DEPLOY_HOOK_URL`，值为上述 URL。

## 错误处理与可观测性

- hook URL 存放在 GitHub Secret 中，日志里 GitHub 会自动打码。
- curl 最终失败（含重试后）→ workflow 运行标红 → GitHub 默认失败邮件通知用户。
- 成功判定：HTTP 2xx；可在 Actions 日志中看到状态码输出。

## 测试与验收

1. 合入后手动 `workflow_dispatch` 触发一次，确认 workflow 绿色且日志输出 2xx。
2. Cloudflare 项目部署列表出现一条由 Deploy Hook 触发的新构建，完成后访问
   `/about` 验证热力图总数为最新值（GraphQL 路径日志 `[heatmap] GraphQL ok`）。
3. 次日确认 cron 自动触发过一次。
