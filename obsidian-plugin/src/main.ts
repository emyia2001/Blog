import { MarkdownView, Menu, Notice, Plugin } from "obsidian";
import { GitHubClient } from "./github";
import { PublishContext, buildStatusLine } from "./publish";
import { DEFAULT_SETTINGS, SnarkSettings, SnarkSettingTab } from "./settings";
import { FriendsModal } from "./modals/FriendsModal";
import { ManagerModal } from "./modals/ManagerModal";
import { R2ImagesModal } from "./modals/R2ImagesModal";
import { SyncModal } from "./modals/SyncModal";
import { PublishView, VIEW_TYPE_SNARK_BLOG } from "./panel";
import { errorNotice } from "./utils";

export default class SnarkBlogCmsPlugin extends Plugin {
  settings: SnarkSettings = { ...DEFAULT_SETTINGS };
  client: GitHubClient = new GitHubClient({ token: "", owner: "", repo: "", branch: "main" });

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.updateClient();
    this.addSettingTab(new SnarkSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_SNARK_BLOG, (leaf) => new PublishView(leaf, this));

    // 唯一的 ribbon 入口：点击弹菜单，菜单里选发布 / 同步 / 管理 / 友链 / 构建
    const ribbon = this.addRibbonIcon("send", "Snark Blog CMS", (e) => this.showRibbonMenu(e));
    ribbon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showRibbonMenu(e);
    });

    this.addCommand({ id: "publish-current", name: "打开发布面板", callback: () => this.openPublishPanel() });
    this.addCommand({ id: "manage-published", name: "管理已发布内容", callback: () => this.openManager() });
    this.addCommand({ id: "sync-content", name: "同步博客内容（拉取远端）", callback: () => this.openSync() });
    this.addCommand({ id: "manage-friends", name: "管理友链", callback: () => this.openFriends() });
    this.addCommand({ id: "manage-images", name: "图床图片管理", callback: () => this.openR2Images() });
    this.addCommand({ id: "check-build", name: "查看最近构建", callback: () => void this.checkBuild() });
  }

  private showRibbonMenu(e: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("打开发布面板").setIcon("send").onClick(() => this.openPublishPanel()));
    menu.addItem((item) => item.setTitle("同步博客内容（拉取远端）").setIcon("refresh-cw").onClick(() => this.openSync()));
    menu.addItem((item) => item.setTitle("管理已发布内容").setIcon("list").onClick(() => this.openManager()));
    menu.addItem((item) => item.setTitle("管理友链").setIcon("link").onClick(() => this.openFriends()));
    menu.addItem((item) => item.setTitle("图床图片管理").setIcon("image").onClick(() => this.openR2Images()));
    menu.addItem((item) => item.setTitle("查看最近构建").setIcon("activity").onClick(() => void this.checkBuild()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("插件设置").setIcon("settings").onClick(() => this.openSettings()));
    menu.showAtMouseEvent(e);
  }

  /** 打开本插件设置页（ribbon 菜单与缺配置提示共用） */
  private openSettings(): void {
    const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
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
      this.openSettings();
      return false;
    }
    return true;
  }

  private async activatePublishView(): Promise<void> {
    const { workspace } = this.app;
    // 激活面板会抢走焦点，先把当前笔记记下来再开面板
    const targetFile = workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_SNARK_BLOG)[0];
    if (existing) {
      (existing.view as PublishView).setTarget(targetFile);
      workspace.revealLeaf(existing);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_SNARK_BLOG, active: true });
    (leaf.view as PublishView | null)?.setTarget(targetFile);
    workspace.revealLeaf(leaf);
  }

  private openPublishPanel(): void {
    if (!this.configured()) return;
    void this.activatePublishView();
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

  private openR2Images(): void {
    if (!this.configured()) return;
    new R2ImagesModal(this.app, this.ctx()).open();
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
