import { App, Modal, setIcon } from "obsidian";
import { r2Config, R2ObjectInfo, R2Listing, listR2Objects, deleteR2Object } from "../r2";
import { PublishContext } from "../publish";
import { errorNotice, successNotice } from "../utils";
import { confirmAsync } from "./ConfirmModal";
import { R2CleanupModal } from "./R2CleanupModal";

/** 图床图片管理：逐层浏览 R2 桶（文件夹可进入），可复制公网链接或删除对象 */
export class R2ImagesModal extends Modal {
  private ctx: PublishContext;
  private prefix = ""; // 当前层前缀；"" = 桶根目录
  private listing: R2Listing | null = null;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private filterInput!: HTMLInputElement;

  constructor(app: App, ctx: PublishContext) {
    super(app);
    this.ctx = ctx;
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    this.modalEl.addClass("snark-friends-modal");
    const { contentEl } = this;
    this.statusEl = contentEl.createDiv({ cls: "snark-cms-status", text: "读取桶内对象…" });

    // 工具行：孤儿图清理入口（右对齐；SVG 图标 + 文字，不用 emoji）
    const tools = contentEl.createDiv({ cls: "snark-cms-tools-row" });
    const cleanupBtn = tools.createEl("button", { cls: "snark-cms-cleanup-btn" });
    setIcon(cleanupBtn, "eraser");
    cleanupBtn.createSpan({ text: "清理未引用图片" });
    cleanupBtn.title = "拉取全桶对象，与仓库已发布内容比对，列出没有出现的对象供批量删除";
    cleanupBtn.addEventListener("click", () => new R2CleanupModal(this.app, this.ctx).open());

    const filterField = contentEl.createDiv({ cls: "snark-cms-field" });
    filterField.createEl("label", { text: "筛选（名称包含）" });
    this.filterInput = filterField.createEl("input", { type: "text" });
    this.filterInput.addEventListener("input", () => this.renderList());

    this.listEl = contentEl.createDiv({ cls: "snark-cms-scroll" });
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg) {
      this.setStatus("未配置 R2（先在设置里填齐）", true);
      return;
    }
    try {
      this.listing = await listR2Objects(cfg, this.prefix);
      this.statusEl.hide();
      this.renderList();
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
    }
  }

  private renderList(): void {
    this.listEl.empty();
    const cfg = r2Config(this.ctx.settings);
    if (!this.listing) return;

    // 位置 + 返回上级
    const nav = this.listEl.createDiv({ cls: "snark-cms-target" });
    nav.setText(`位置：${this.prefix || "（桶根目录）"}`);
    if (this.prefix) {
      const up = this.listEl.createDiv({ cls: "snark-cms-field" });
      const upBtn = up.createEl("button", { text: "返回上级" });
      upBtn.addEventListener("click", () => {
        this.prefix = this.prefix.replace(/[^/]+\/$/, "");
        void this.refresh();
      });
    }
    if (this.listing.truncated) {
      this.listEl.createDiv({
        cls: "snark-cms-status",
        text: "该层超过 1000 项，仅显示前 1000 项（可用筛选缩小范围）",
      });
    }

    const needle = this.filterInput.value.trim().toLowerCase();
    const matchName = (name: string): boolean => (needle ? name.toLowerCase().includes(needle) : true);
    const folders = this.listing.folders.filter((f) => matchName(f.replace(this.prefix, "")));
    const objects = this.listing.objects.filter((o) => matchName(o.key.replace(this.prefix, "")));
    if (!folders.length && !objects.length) {
      this.listEl.createEl("p", { text: needle ? "没有匹配项" : "这一层是空的" });
      return;
    }

    const list = this.listEl.createEl("ul", { cls: "snark-cms-list" });
    for (const folder of folders) {
      const li = list.createEl("li");
      const main = li.createDiv({ cls: "snark-cms-item-main" });
      main.createDiv({ cls: "snark-cms-item-title", text: folder.replace(this.prefix, "") + " /" });
      main.createDiv({ cls: "snark-cms-item-path", text: "文件夹，点击进入" });
      main.addEventListener("click", () => {
        this.prefix = folder;
        void this.refresh();
      });
      const actions = li.createDiv({ cls: "snark-cms-item-actions" });
      this.iconBtn(actions, "folder-open", "进入该文件夹", () => {
        this.prefix = folder;
        void this.refresh();
      });
    }
    for (const obj of objects) {
      const li = list.createEl("li");
      const main = li.createDiv({ cls: "snark-cms-item-main" });
      main.createDiv({ cls: "snark-cms-item-title", text: obj.key.replace(this.prefix, "") });
      main.createDiv({
        cls: "snark-cms-item-path",
        text: `${obj.size >= 1024 ? `${(obj.size / 1024).toFixed(1)} KB` : `${obj.size} B`} · ${obj.lastModified.slice(0, 10)}`,
      });
      const actions = li.createDiv({ cls: "snark-cms-item-actions" });
      this.iconBtn(actions, "copy", "复制公网链接", () => {
        void navigator.clipboard.writeText(`${cfg!.publicPrefix}/${obj.key}`);
        successNotice("已复制公网链接");
      });
      this.iconBtn(actions, "trash-2", "从 R2 删除（不可恢复）", () => void this.deleteOne(obj));
    }
  }

  private iconBtn(parent: HTMLElement, icon: string, title: string, onClick: () => void): void {
    const btn = parent.createEl("button", { cls: "clickable-icon" });
    setIcon(btn, icon);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
  }

  private async deleteOne(obj: R2ObjectInfo): Promise<void> {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg) return;
    const outsideBlog = cfg.keyPrefix ? !obj.key.startsWith(`${cfg.keyPrefix}/`) : false;
    const warn = outsideBlog
      ? "注意：它不在博客上传目录（blog/）下，站点其他地方（如 BGM、封面）可能正在引用它，删除前请确认！"
      : "删除后不可恢复。";
    const ok = await confirmAsync(this.app, `从 R2 删除 ${obj.key}？${warn}`);
    if (!ok) return;
    try {
      await deleteR2Object(cfg, obj.key);
      successNotice(`已删除 ${obj.key}`);
      await this.refresh();
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
  }

  private setStatus(msg: string, isError = false): void {
    this.statusEl.setText(msg);
    this.statusEl.show();
    this.statusEl.toggleClass("is-error", isError);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
