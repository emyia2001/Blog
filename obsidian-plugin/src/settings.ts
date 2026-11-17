import { App, PluginSettingTab, Setting } from "obsidian";
import type SnarkBlogCmsPlugin from "./main";
import { r2Config, verifyR2 } from "./r2";

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
  /** R2 直传（S3 兼容）：粘贴/拖入图片自动上传并回填外链；任一项为空即停用 */
  r2AccessKey: string;
  r2SecretKey: string;
  r2AccountId: string;
  r2Bucket: string;
  r2PublicPrefix: string;
  r2KeyPrefix: string;
  /** 上传成功并回填外链后，把本地附件移入 Obsidian 回收站（仍被其他笔记引用的不删） */
  r2DeleteLocal: boolean;
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
  r2AccessKey: "",
  r2SecretKey: "",
  r2AccountId: "",
  r2Bucket: "",
  r2PublicPrefix: "https://img.snarkm.com",
  r2KeyPrefix: "blog",
  r2DeleteLocal: false,
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
      .setDesc("「同步博客内容」抓取的根文件夹（空 = 根目录）；其下自动分为 文章/ 与 纪事/ 两个子文件夹")
      .addText((t) => t.setValue(s.syncFolder).onChange((v) => { s.syncFolder = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));

    // ---- 图片直传 R2 ----
    containerEl.createEl("h4", { text: "图片直传 R2（粘贴/拖入即上传）" });
    const r2Desc = document.createDocumentFragment();
    r2Desc.append(
      "Cloudflare → R2 → 管理 R2 API 令牌 → 创建令牌（对象读和写）。填齐后，发布时会把笔记里的 ![[图片附件]] 自动上传 R2 并把笔记本体回填为 img.snarkm.com 外链（下次发布不再重复上传）；粘贴/拖入图片仍按 Obsidian 默认存为本地附件。留空任一项则发布时要求使用图床外链。",
    );
    new Setting(containerEl)
      .setName("R2 说明")
      .setDesc(r2Desc)
      .addExtraButton((btn) =>
        btn
          .setIcon("zap")
          .setTooltip("验证连接：上传/读取/清理一个测试文件")
          .onClick(async () => {
            const cfg = r2Config(this.plugin.settings);
            if (!cfg) {
              this.plugin.showTransientStatus("先填齐 R2 各项再验证", true);
              return;
            }
            btn.setDisabled(true);
            try {
              const msg = await verifyR2(cfg);
              this.plugin.showTransientStatus(msg);
            } catch (e) {
              this.plugin.showTransientStatus(String((e as Error).message ?? e), true);
            } finally {
              btn.setDisabled(false);
            }
          }),
      );
    new Setting(containerEl)
      .setName("R2 Access Key ID")
      .addText((t) => t.setValue(s.r2AccessKey).onChange((v) => { s.r2AccessKey = v.trim(); save(); }));
    new Setting(containerEl)
      .setName("R2 Secret Access Key")
      .addText((t) => { t.inputEl.type = "password"; return t.setValue(s.r2SecretKey).onChange((v) => { s.r2SecretKey = v.trim(); save(); }); });
    new Setting(containerEl)
      .setName("R2 账户 ID")
      .setDesc("账户 ID 填数字 ID（r2.cloudflarestorage.com 前缀用）")
      .addText((t) => t.setValue(s.r2AccountId).onChange((v) => { s.r2AccountId = v.trim(); save(); }));
    new Setting(containerEl)
      .setName("R2 桶名")
      .addText((t) => t.setValue(s.r2Bucket).onChange((v) => { s.r2Bucket = v.trim(); save(); }));
    new Setting(containerEl)
      .setName("公网前缀")
      .setDesc("图床对外 URL 前缀")
      .addText((t) => t.setValue(s.r2PublicPrefix).onChange((v) => { s.r2PublicPrefix = v.trim().replace(/\/+$/, ""); save(); }));
    new Setting(containerEl)
      .setName("对象键前缀")
      .setDesc("上传对象的前缀，如 blog（按 年/月/日 归档）")
      .addText((t) => t.setValue(s.r2KeyPrefix).onChange((v) => { s.r2KeyPrefix = v.trim().replace(/^\/+|\/+$/g, ""); save(); }));
    new Setting(containerEl)
      .setName("上传后删除本地图片")
      .setDesc("发布时图片上传 R2 并回填外链后，把对应本地附件移入 Obsidian 回收站（.trash），可恢复；仍被其他笔记引用的图片会保留并提示。默认关闭。")
      .addToggle((t) => t.setValue(s.r2DeleteLocal).onChange((v) => { s.r2DeleteLocal = v; save(); }));
  }
}
