import { App, PluginSettingTab, Setting } from "obsidian";
import type SnarkBlogCmsPlugin from "./main";

export interface SnarkSettings {
  /** fine-grained PAT：仅本仓库、Contents: Read and write */
  token: string;
  owner: string;
  repo: string;
  branch: string;
  postsDir: string;
  momentsDir: string;
  friendsPath: string;
  siteUrl: string;
  /** 「同步博客内容」抓取远端文件放进 vault 的文件夹（空 = vault 根目录） */
  syncFolder: string;
}

export const DEFAULT_SETTINGS: SnarkSettings = {
  token: "",
  owner: "emyia2001",
  repo: "Blog",
  branch: "main",
  postsDir: "src/content/posts",
  momentsDir: "src/content/moments",
  friendsPath: "src/data/friends.json",
  siteUrl: "https://snarkm.com",
  syncFolder: "博客",
};

export class SnarkSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SnarkBlogCmsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = () => void this.plugin.saveSettings();

    const tokenDesc = document.createDocumentFragment();
    tokenDesc.append(
      "GitHub fine-grained PAT：Settings → Developer settings → Fine-grained tokens，仅勾选本仓库、权限 Contents: Read and write。token 只保存在本机。",
    );
    const tokenSetting = new Setting(containerEl)
      .setName("GitHub token")
      .setDesc(tokenDesc)
      .addText((text) =>
        text
          .setPlaceholder("github_pat_…")
          .setValue(s.token)
          .onChange((v) => {
            s.token = v.trim();
            this.plugin.updateClient();
            save();
          }),
      );
    tokenSetting.addExtraButton((btn) =>
      btn
        .setIcon("plug")
        .setTooltip("测试连接")
        .onClick(async () => {
          this.plugin.updateClient();
          try {
            const msg = await this.plugin.client.ping();
            this.plugin.showTransientStatus(msg);
          } catch (e) {
            this.plugin.showTransientStatus(String((e as Error).message ?? e), true);
          }
        }),
    );

    new Setting(containerEl)
      .setName("仓库 owner / repo")
      .setDesc("默认 emyia2001 / Blog")
      .addText((t) => t.setValue(s.owner).onChange((v) => { s.owner = v.trim(); this.plugin.updateClient(); save(); }))
      .addText((t) => t.setValue(s.repo).onChange((v) => { s.repo = v.trim(); this.plugin.updateClient(); save(); }));

    new Setting(containerEl)
      .setName("分支")
      .setDesc("push 到该分支即触发 Actions 构建")
      .addText((t) => t.setValue(s.branch).onChange((v) => { s.branch = v.trim(); this.plugin.updateClient(); save(); }));

    new Setting(containerEl)
      .setName("文章目录")
      .setDesc("posts 集合在仓库里的路径")
      .addText((t) => t.setValue(s.postsDir).onChange((v) => { s.postsDir = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));

    new Setting(containerEl)
      .setName("纪事目录")
      .setDesc("moments 集合在仓库里的路径")
      .addText((t) => t.setValue(s.momentsDir).onChange((v) => { s.momentsDir = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));

    new Setting(containerEl)
      .setName("友链数据文件")
      .setDesc("friends.json 的仓库路径")
      .addText((t) => t.setValue(s.friendsPath).onChange((v) => { s.friendsPath = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));

    new Setting(containerEl)
      .setName("线上站点 URL")
      .setDesc("用于「线上页面」跳转")
      .addText((t) => t.setValue(s.siteUrl).onChange((v) => { s.siteUrl = v.trim().replace(/\/+$/, ""); save(); }));

    new Setting(containerEl)
      .setName("同步文件夹")
      .setDesc("「同步博客内容」把远端文章/纪事抓进 vault 的文件夹（空 = 根目录）")
      .addText((t) => t.setValue(s.syncFolder).onChange((v) => { s.syncFolder = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));
  }
}
