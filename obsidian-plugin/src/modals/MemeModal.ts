import { App, FuzzySuggestModal, Modal, setIcon, TFile } from "obsidian";
import { r2Config, listAllR2Objects, deleteR2Object, uploadImageToR2, type R2ObjectInfo } from "../r2";
import type { PublishContext } from "../publish";
import { appendMemeUrls } from "../memesRepo";
import { errorNotice, successNotice } from "../utils";
import { confirmAsync } from "./ConfirmModal";

/** meme 对象统一放在桶的 meme/ 前缀下（与博客图单约定一致） */
const MEME_PREFIX = "meme";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

/** vault 内选一张图片（模糊搜索），Esc 取消 */
class ImagePickerModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onPick: (file: TFile | null) => void) {
    super(app);
    this.setPlaceholder("选择要上传的 meme 图");
  }

  getItems(): TFile[] {
    return this.app.vault
      .getFiles()
      .filter((f) => IMAGE_EXTS.has(f.extension.toLowerCase()) && !f.path.startsWith(".trash/"));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file);
  }

  onClose(): void {
    this.onPick(null);
  }
}

/**
 * Meme 图床：上传 vault 图片到 R2 meme/ 前缀，URL 自动追加进远端 src/data/memes.ts
 * （页脚彩蛋图单），成功后本地原图移入回收站。列表可复制单条 URL 或整份清单。
 */
export class MemeModal extends Modal {
  private ctx: PublishContext;
  private objects: R2ObjectInfo[] = [];
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private filterInput!: HTMLInputElement;
  private busy = false; // 上传进行中，防重入

  constructor(app: App, ctx: PublishContext) {
    super(app);
    this.ctx = ctx;
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    this.modalEl.addClass("snark-friends-modal");
    const { contentEl } = this;
    this.statusEl = contentEl.createDiv({ cls: "snark-cms-status", text: "读取 meme 对象…" });

    // 工具行：上传 + 复制清单（SVG 图标 + 文字，不用 emoji）
    const tools = contentEl.createDiv({ cls: "snark-cms-tools-row" });
    const uploadBtn = tools.createEl("button", { cls: "snark-cms-cleanup-btn" });
    setIcon(uploadBtn, "image-plus");
    uploadBtn.createSpan({ text: "上传 meme 图" });
    uploadBtn.title = "从 vault 选图上传到 R2 meme/ 目录，URL 自动进 memes.ts 图单，成功后本地图移入回收站";
    uploadBtn.addEventListener("click", () => void this.uploadOne());

    const copyBtn = tools.createEl("button", { cls: "snark-cms-cleanup-btn" });
    setIcon(copyBtn, "clipboard-list");
    copyBtn.createSpan({ text: "复制全部清单" });
    copyBtn.title = "把当前 meme 全部 URL 复制为 TS 数组片段（可直接贴进 memes.ts）";
    copyBtn.addEventListener("click", () => this.copyAll());

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
      const all = await listAllR2Objects(cfg, `${MEME_PREFIX}/`);
      all.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
      this.objects = all;
      this.setStatus(`meme/ 下共 ${all.length} 张`, false);
      this.renderList();
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
    }
  }

  private renderList(): void {
    this.listEl.empty();
    const cfg = r2Config(this.ctx.settings);
    if (!cfg || !this.objects) return;

    const needle = this.filterInput.value.trim().toLowerCase();
    const name = (o: R2ObjectInfo) => o.key.replace(`${MEME_PREFIX}/`, "");
    const objects = this.objects.filter((o) =>
      needle ? name(o).toLowerCase().includes(needle) : true,
    );
    if (!objects.length) {
      this.listEl.createEl("p", {
        text: needle ? "没有匹配项" : "meme/ 还是空的，点上方按钮上传第一张",
      });
      return;
    }

    const list = this.listEl.createEl("ul", { cls: "snark-cms-list" });
    for (const obj of objects) {
      const li = list.createEl("li");
      const main = li.createDiv({ cls: "snark-cms-item-main" });
      main.createDiv({ cls: "snark-cms-item-title", text: name(obj) });
      main.createDiv({
        cls: "snark-cms-item-path",
        text: `${obj.size >= 1024 ? `${(obj.size / 1024).toFixed(1)} KB` : `${obj.size} B`} · ${obj.lastModified.slice(0, 10)}`,
      });
      const actions = li.createDiv({ cls: "snark-cms-item-actions" });
      this.iconBtn(actions, "copy", "复制公网链接", () => {
        void navigator.clipboard.writeText(`${cfg.publicPrefix}/${obj.key}`);
        successNotice("已复制公网链接");
      });
      this.iconBtn(actions, "trash-2", "从 R2 删除（不可恢复）", () => void this.deleteOne(obj));
    }
  }

  /** 单张上传流程；成功后自动重新打开选择器，Esc 结束批量 */
  private async uploadOne(): Promise<void> {
    if (this.busy) return;
    const cfg = r2Config(this.ctx.settings);
    if (!cfg) {
      errorNotice("先在设置里填齐 R2 各项");
      return;
    }
    this.busy = true;
    try {
      // 连续上传：每张完成后重新弹出选择器，Esc 停止
      for (;;) {
        const file = await new Promise<TFile | null>((resolve) => {
          new ImagePickerModal(this.app, resolve).open();
        });
        if (!file) return;

        this.setStatus(`上传 ${file.name}…`, false);
        let url: string;
        try {
          const bytes = new Uint8Array(await this.ctx.app.vault.readBinary(file));
          url = await uploadImageToR2(bytes, file.extension.toLowerCase(), cfg, MEME_PREFIX);
        } catch (e) {
          errorNotice(String((e as Error).message ?? e));
          return; // R2 失败保留本地图，停止本轮
        }

        if (!this.ctx.settings.memeAppendRemote) {
          await navigator.clipboard.writeText(url);
          successNotice("已上传，URL 已复制（未改动远端图单）");
          await this.refresh();
          continue;
        }

        try {
          const res = await appendMemeUrls(this.ctx.client, [url], (msg) =>
            confirmAsync(this.app, msg),
          );
          // 图单提交成功才删本地图（URL 已落在远端，回收站可恢复）
          await this.ctx.app.vault.trash(file, false);
          successNotice(
            res.added > 0
              ? `已上传并加入图单${res.commitUrl ? "，已提交" : ""}`
              : "已上传（URL 已在图单中）",
          );
        } catch (e) {
          // 图单提交失败：本地图保留，URL 进剪贴板防丢
          await navigator.clipboard.writeText(url);
          errorNotice(`图单更新失败（${String((e as Error).message ?? e)}）；URL 已复制，本地图未删`);
          return;
        }
        await this.refresh();
      }
    } finally {
      this.busy = false;
    }
  }

  private copyAll(): void {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg || !this.objects.length) {
      errorNotice("meme/ 还是空的，没有可复制的清单");
      return;
    }
    const snippet = this.objects.map((o) => `  "${cfg.publicPrefix}/${o.key}",`).join("\n");
    void navigator.clipboard.writeText(snippet);
    successNotice(`已复制 ${this.objects.length} 条 URL 清单`);
  }

  private async deleteOne(obj: R2ObjectInfo): Promise<void> {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg) return;
    const ok = await confirmAsync(
      this.app,
      `从 R2 删除 ${obj.key}？删除后不可恢复；memes.ts 图单里可能仍保留这条 URL，页脚彩蛋会暂时报 404。`,
    );
    if (!ok) return;
    try {
      await deleteR2Object(cfg, obj.key);
      successNotice(`已删除 ${obj.key}`);
      await this.refresh();
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
  }

  private iconBtn(parent: HTMLElement, icon: string, title: string, onClick: () => void): void {
    const btn = parent.createEl("button", { cls: "clickable-icon" });
    setIcon(btn, icon);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
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
