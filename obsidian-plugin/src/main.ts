import { MarkdownView, Menu, Notice, Plugin, TFile } from "obsidian";
import { GitHubClient } from "./github";
import { PublishContext, buildStatusLine } from "./publish";
import { DEFAULT_SETTINGS, SnarkSettings, SnarkSettingTab } from "./settings";
import { FriendsModal } from "./modals/FriendsModal";
import { ManagerModal } from "./modals/ManagerModal";
import { PublishModal } from "./modals/PublishModal";
import { SyncModal } from "./modals/SyncModal";
import { errorNotice } from "./utils";

export default class SnarkBlogCmsPlugin extends Plugin {
  settings: SnarkSettings = { ...DEFAULT_SETTINGS };
  client: GitHubClient = new GitHubClient({ token: "", owner: "", repo: "", branch: "main" });

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.updateClient();
    this.addSettingTab(new SnarkSettingTab(this.app, this));

    // 唯一的 ribbon 入口：左键 = 发布当前笔记；右键 = 其余操作菜单
    const ribbon = this.addRibbonIcon("send", "Snark Blog CMS（右键：同步 / 管理 / 友链）", () => this.publishCurrent());
    ribbon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => item.setTitle("同步博客内容（拉取远端）").setIcon("refresh-cw").onClick(() => this.openSync()));
      menu.addItem((item) => item.setTitle("管理已发布内容").setIcon("list").onClick(() => this.openManager()));
      menu.addItem((item) => item.setTitle("管理友链").setIcon("link").onClick(() => this.openFriends()));
      menu.addItem((item) => item.setTitle("查看最近构建").setIcon("activity").onClick(() => void this.checkBuild()));
      menu.showAtMouseEvent(e);
    });

    this.addCommand({ id: "publish-current", name: "发布当前笔记", callback: () => this.publishCurrent() });
    this.addCommand({ id: "manage-published", name: "管理已发布内容", callback: () => this.openManager() });
    this.addCommand({ id: "sync-content", name: "同步博客内容（拉取远端）", callback: () => this.openSync() });
    this.addCommand({ id: "manage-friends", name: "管理友链", callback: () => this.openFriends() });
    this.addCommand({ id: "check-build", name: "查看最近构建", callback: () => void this.checkBuild() });
  }

  saveSettings(): Promise<void> {
    return this.saveData(this.settings);
  }

  updateClient(): void {
    this.client = new GitHubClient({
      token: this.settings.token,
      owner: this.settings.owner,
      repo: this.settings.repo,
      branch: this.settings.branch,
    });
  }

  ctx(): PublishContext {
    return { app: this.app, settings: this.settings, client: this.client };
  }

  /** 设置页「测试连接」的结果提示 */
  showTransientStatus(msg: string, isError = false): void {
    if (isError) errorNotice(msg);
    else new Notice(`✓ ${msg}`, 8000);
  }

  private configured(): boolean {
    if (!this.settings.token || !this.settings.owner || !this.settings.repo) {
      errorNotice("先在设置里填 GitHub token 与仓库信息");
      const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
      setting?.open();
      setting?.openTabById(this.manifest.id);
      return false;
    }
    return true;
  }

  private activeFile(): TFile | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
  }

  private publishCurrent(): void {
    if (!this.configured()) return;
    const file = this.activeFile();
    if (!file) {
      errorNotice("先打开一篇笔记再发布");
      return;
    }
    new PublishModal(this.app, this.ctx(), file).open();
  }

  private openManager(): void {
    if (!this.configured()) return;
    new ManagerModal(this.app, this.ctx()).open();
  }

  private openSync(): void {
    if (!this.configured()) return;
    new SyncModal(this.app, this.ctx()).open();
  }

  private openFriends(): void {
    if (!this.configured()) return;
    new FriendsModal(this.app, this.ctx()).open();
  }

  private async checkBuild(): Promise<void> {
    if (!this.configured()) return;
    try {
      const run = await this.client.latestRun();
      const frag = document.createDocumentFragment();
      const line = document.createElement("span");
      line.textContent = `${buildStatusLine(run)}`;
      if (run) {
        line.appendText(`（${new Date(run.createdAt).toLocaleString()}）`);
        const a = document.createElement("a");
        a.textContent = " Actions";
        a.href = run.url;
        a.target = "_blank";
        a.rel = "noopener";
        line.appendChild(a);
      }
      frag.appendChild(line);
      new Notice(frag, 10000);
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
  }
}
