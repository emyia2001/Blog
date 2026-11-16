import { requestUrl } from "obsidian";
import { fromBase64, toBase64 } from "./utils";

export interface RepoConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface RemoteFile {
  sha: string;
  text: string;
}

export interface PutResult {
  created: boolean;
  commitUrl: string | null;
}

type ConflictConfirm = (msg: string) => Promise<boolean>;

const API_ROOT = "https://api.github.com";

export class GitHubClient {
  constructor(private cfg: RepoConfig) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private contentsUrl(path: string, query = ""): string {
    const clean = path.replace(/^\/+/, "");
    return `${API_ROOT}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${clean}?ref=${encodeURIComponent(this.cfg.branch)}${query}`;
  }

  private async raw(
    method: "GET" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ status: number; json: any }> {
    // GET 幂等，可安全重试；国内直连 api.github.com 常被重置，多试几次
    const attempts = method === "GET" ? 3 : 1;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await requestUrl({
          url,
          method,
          headers: { ...this.headers(), "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          throw: false,
        });
        let json: any = null;
        try {
          json = res.json;
        } catch {
          json = null;
        }
        return { status: res.status, json };
      } catch (e) {
        lastErr = e;
        if (attempt < attempts - 1) {
          await new Promise((r) => window.setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
    throw new Error(this.networkError(lastErr));
  }

  private networkError(e: unknown): string {
    const msg = String((e as Error)?.message ?? e);
    if (/CONNECTION_CLOSED|CONNECTION_RESET|ECONNRESET|ERR_NETWORK|ERR_INTERNET|fetch failed|socket/i.test(msg)) {
      return `连接 GitHub 失败（${msg}）。api.github.com 直连不稳定，建议开启代理后重试`;
    }
    return `网络请求失败：${msg}`;
  }

  private friendlyError(status: number, message: string): string {
    switch (status) {
      case 401:
        return `GitHub token 无效或已过期（${message}）`;
      case 403:
        return `GitHub 拒绝访问：token 权限不足（需要该仓库 Contents 读写）或触发限流（${message}）`;
      case 404:
        return `仓库 / 分支 / 文件不存在，检查 owner、repo、branch 设置（${message}）`;
      case 409:
        return `远端提交状态冲突（${message}）`;
      case 422:
        return `GitHub 校验失败（${message}）`;
      default:
        return `GitHub API ${status}：${message}`;
    }
  }

  /** 读远端文件；不存在返回 null（区分 404 与其它错误） */
  async getContent(path: string): Promise<RemoteFile | null> {
    const { status, json } = await this.raw("GET", this.contentsUrl(path));
    if (status === 404) return null;
    if (status >= 300) {
      throw new Error(this.friendlyError(status, json?.message ?? "读取失败"));
    }
    const content: string | undefined = json?.content;
    if (typeof content !== "string") {
      throw new Error(`远端 ${path} 不是文件（可能是目录）`);
    }
    return { sha: json.sha as string, text: fromBase64(content.replace(/\n/g, "")) };
  }

  async getSha(path: string): Promise<string | null> {
    const { status, json } = await this.raw("GET", this.contentsUrl(path));
    if (status === 404) return null;
    if (status >= 300) {
      throw new Error(this.friendlyError(status, json?.message ?? "读取失败"));
    }
    return (json?.sha as string) ?? null;
  }

  /**
   * 新建或更新文件。
   * onConflict：当远端 sha 与我们基于的不一致（409/422）或新建时文件已存在，
   * 会调用它让 UI 弹确认；返回 false 则中止，绝不静默覆盖。
   */
  async putFile(
    path: string,
    text: string,
    message: string,
    onConflict?: ConflictConfirm,
  ): Promise<PutResult> {
    const initialSha = await this.getSha(path);
    const existedBefore = initialSha !== null;
    let sha = initialSha;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { status, json } = await this.raw("PUT", this.contentsUrl(path), {
        message,
        content: toBase64(text),
        branch: this.cfg.branch,
        ...(sha ? { sha } : {}),
      });
      if (status < 300) {
        return {
          created: !existedBefore,
          commitUrl: json?.commit?.html_url ?? null,
        };
      }
      // sha 过期：远端被其它端（Pages CMS / 网页）改过，或新建时文件已存在
      if (status === 409 || status === 422 || status === 404) {
        const fresh = await this.getSha(path);
        if (fresh && fresh !== sha) {
          if (onConflict) {
            const ok = await onConflict(
              `远端 ${path} 已被其他端修改（可能来自 Pages CMS 或网页端），覆盖？`,
            );
            if (!ok) throw new Error("已取消：不覆盖远端修改");
          }
          sha = fresh;
        } else if (!fresh) {
          sha = null;
        } else {
          throw new Error(this.friendlyError(status, json?.message ?? "提交失败"));
        }
        continue;
      }
      throw new Error(this.friendlyError(status, json?.message ?? "提交失败"));
    }
    throw new Error(`提交失败：多次重试后仍冲突（${path}）`);
  }

  async deleteFile(
    path: string,
    message: string,
    onConflict?: ConflictConfirm,
  ): Promise<void> {
    let sha = await this.getSha(path);
    if (!sha) return; // 远端已不存在，视为成功
    for (let attempt = 0; attempt < 2; attempt++) {
      const { status, json } = await this.raw("DELETE", this.contentsUrl(path), {
        message,
        branch: this.cfg.branch,
        sha,
      });
      if (status < 300) return;
      if (status === 409 || status === 422) {
        sha = await this.getSha(path);
        if (!sha) return;
        if (onConflict) {
          const ok = await onConflict(
            `远端 ${path} 已被其他端修改，仍要删除？`,
          );
          if (!ok) throw new Error("已取消：不覆盖远端修改");
        }
        continue;
      }
      if (status === 404) return;
      throw new Error(this.friendlyError(status, json?.message ?? "删除失败"));
    }
    throw new Error(`删除失败：多次重试后仍冲突（${path}）`);
  }

  /** 递归列出仓库文件树中指定前缀目录下的 mdx 文件路径（单次请求） */
  async listTree(prefixes: string[]): Promise<string[]> {
    const url = `${API_ROOT}/repos/${this.cfg.owner}/${this.cfg.repo}/git/trees/${encodeURIComponent(this.cfg.branch)}?recursive=1`;
    const { status, json } = await this.raw("GET", url);
    if (status >= 300) {
      throw new Error(this.friendlyError(status, json?.message ?? "读取文件树失败"));
    }
    const tree: { path: string; type: string }[] = json?.tree ?? [];
    return tree
      .filter(
        (t) =>
          t.type === "blob" &&
          /\.mdx?$/.test(t.path) &&
          prefixes.some((p) => t.path.startsWith(`${p}/`)),
      )
      .map((t) => t.path);
  }

  /** 最近一次 Actions 运行（用于构建状态提示） */
  async latestRun(): Promise<{
    status: string;
    conclusion: string | null;
    url: string;
    createdAt: string;
  } | null> {
    const url = `${API_ROOT}/repos/${this.cfg.owner}/${this.cfg.repo}/actions/runs?per_page=1`;
    const { status, json } = await this.raw("GET", url);
    if (status >= 300) {
      throw new Error(this.friendlyError(status, json?.message ?? "查询失败"));
    }
    const run = json?.workflow_runs?.[0];
    if (!run) return null;
    return {
      status: run.status as string,
      conclusion: (run.conclusion as string | null) ?? null,
      url: run.html_url as string,
      createdAt: run.created_at as string,
    };
  }

  /** 检查 token 与仓库可达性（设置页「测试连接」用） */
  async ping(): Promise<string> {
    const { status, json } = await this.raw(
      "GET",
      `${API_ROOT}/repos/${this.cfg.owner}/${this.cfg.repo}`,
    );
    if (status >= 300) {
      throw new Error(this.friendlyError(status, json?.message ?? "连接失败"));
    }
    return `已连接 ${json.full_name}（默认分支 ${json.default_branch}）`;
  }
}
