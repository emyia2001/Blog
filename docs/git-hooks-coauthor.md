# Git 钩子：自动剥离 Co-Authored-By 尾注

日期：2026-09-02

## 背景：为什么需要这个钩子

GitHub 的仓库 Contributors（贡献者）列表会把**提交信息中 `Co-Authored-By:`
尾注里能匹配到账号的邮箱**计入贡献者。

AI 编码工具（OpenCode、Claude Code、GitHub Copilot、Cursor、Sisyphus 等）常常
默认在提交信息末尾自动追加这类尾注，例如：

```
feat: xxx

Co-Authored-By: opencode <opencode@users.noreply.github.com>
Co-authored-by: Claude <noreply@anthropic.com>
```

结果就是：**AI 账号以"贡献者"身份出现在博客仓库页面上**（曾出现
`@OpenCode`、`@sisyphus-dev-ai` 两个 AI 账号，经历史重写 + 本钩子解决）。

博客是个人项目，希望 Contributors 列表只保留真实的自己，因此**任何提交都
不允许携带 Co-Authored-By 尾注**。

## 机制与覆盖范围

- 钩子类型：`commit-msg`，在提交信息写入 git 之前执行，删除其中所有
  `Co-Authored-By:` 行（大小写不敏感）。
- 生效路径：`core.hooksPath` 指向 `.githooks/`（钩子脚本随仓库版本控制）。
- 覆盖所有提交方式：普通 `commit`、`--amend`、`merge`、`rebase`、`squash`
  均会触发 `commit-msg` 钩子。

## 安装（新机器 / 新克隆）

克隆仓库后执行一次即可：

```bash
git config core.hooksPath .githooks
```

若钩子脚本本身还不是可执行文件，先 `chmod +x .githooks/commit-msg`。

## 验证是否生效

```bash
git commit -m "test: 验证钩子

Co-Authored-By: opencode <opencode@users.noreply.github.com>"
git log -1 --format=%B    # 应看不到 Co-Authored-By 行
```

## 例外

若确需保留真实人类的 co-author 署名（合作开发场景），可显式绕过钩子：

```bash
git commit --no-verify -m "..."
```

> ⚠️ 绕过会让 AI 账号有机会再次进入贡献者列表，仅在确有必要时使用。

## 相关历史

- 2026-09-02 重写仓库历史（`git filter-branch`），清除 4 个旧提交中的
  `Co-Authored-By: opencode` / `Co-authored-by: Sisyphus` 尾注后
  `force push`。
- GitHub 贡献者统计有缓存，重写历史后最多需 24 小时刷新；若仍未刷新，
  联系 [GitHub Support](https://support.github.com) 请求重建统计。
