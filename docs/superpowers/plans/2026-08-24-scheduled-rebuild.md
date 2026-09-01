# 每日定时重建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 GitHub Actions 每天调用 Cloudflare Deploy Hook，触发重建以刷新热力图等构建时数据。

**Architecture:** 新增单个 GitHub Actions workflow 文件；cron 定时（UTC 21:30）POST 到存于仓库 Secret 的 Deploy Hook URL，复用现有 Cloudflare Pages Git 集成构建流程。

**Tech Stack:** GitHub Actions、curl、Cloudflare Pages Deploy Hooks。

设计文档：`docs/superpowers/specs/2026-08-24-scheduled-rebuild-design.md`

---

### Task 1: 创建 workflow 文件

**Files:**
- Create: `.github/workflows/scheduled-rebuild.yml`

- [ ] **Step 1: 写入 workflow 内容**

创建 `.github/workflows/scheduled-rebuild.yml`：

```yaml
name: Scheduled rebuild

on:
  schedule:
    # 每天 UTC 21:30（北京时间约 05:30）；非整点避开 Actions 调度拥堵
    - cron: "30 21 * * *"
  workflow_dispatch:

jobs:
  redeploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cloudflare Deploy Hook
        env:
          CF_DEPLOY_HOOK_URL: ${{ secrets.CF_DEPLOY_HOOK_URL }}
        run: |
          if [ -z "$CF_DEPLOY_HOOK_URL" ]; then
            echo "::error::Secret CF_DEPLOY_HOOK_URL 未配置"
            exit 1
          fi
          status=$(curl -f -sS -o /dev/null -w "%{http_code}" --retry 3 --retry-delay 5 -X POST "$CF_DEPLOY_HOOK_URL")
          echo "Cloudflare deploy hook responded with HTTP ${status}"
```

- [ ] **Step 2: 校验 YAML 语法**

Run: `ruby -ryaml -e 'YAML.load_file(".github/workflows/scheduled-rebuild.yml"); puts "YAML OK"'`
Expected: 输出 `YAML OK`，无报错

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/scheduled-rebuild.yml
git commit -m "ci: 每日定时触发 Cloudflare 重建以刷新构建时数据"
```

### Task 2: 用户一次性配置（手动）

- [ ] **Step 1: 创建 Cloudflare Deploy Hook**

Cloudflare 后台 → Workers & Pages → 博客项目 → Settings → Build → Deploy hooks →
Create hook：名称随意（如 `daily-rebuild`），分支选 `main`，复制生成的 URL。

- [ ] **Step 2: 配置 GitHub Secret**

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：
Name 为 `CF_DEPLOY_HOOK_URL`，Value 粘贴上一步的 URL。

### Task 3: 推送与验证

- [ ] **Step 1: 推送到远端**

Run: `git push`
Expected: 推送成功

- [ ] **Step 2: 手动触发一次验证**

Run: `gh workflow run "Scheduled rebuild" && sleep 30 && gh run list --workflow="Scheduled rebuild" --limit 1`
Expected: run 状态为 completed success；若未装 gh，则在仓库 Actions 页手动 Run workflow

- [ ] **Step 3: 确认 Cloudflare 出现新构建并抽查热力图**

在 Cloudflare 项目部署列表确认有一条 Deploy Hook 触发的新构建；
构建日志含 `[heatmap] GraphQL ok`；访问 `/about` 热力图为最新数据。

- [ ] **Step 4: 次日复查定时触发**

Run: `gh run list --workflow="Scheduled rebuild" --limit 2`
Expected: 存在一条由 schedule 触发且 success 的运行
