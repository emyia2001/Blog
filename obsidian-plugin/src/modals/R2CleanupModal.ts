import { App, Modal } from "obsidian";
import { r2Config, R2ObjectInfo, listAllR2Objects, deleteR2Object } from "../r2";
import { PublishContext } from "../publish";
import { errorNotice } from "../utils";
import { confirmAsync } from "./ConfirmModal";

/**
 * R2 清理：拉全桶对象 ↔ 扫仓库已发布内容里的引用，列出「没被任何内容引用」的
 * 对象（孤儿图）供勾选批量删除。
 * 引用源 = 仓库 src/ 下的文本文件（posts/moments 正文与 frontmatter、src/data、
 * consts/组件里的默认图等），比对方式 = 内容文本是否包含对象 key（key 带
 * 随机后缀，全局唯一，子串匹配即足够）。keyPrefix 之外的对象（BGM 等）
 * 一律只提示、不纳入删除范围。
 */
export class R2CleanupModal extends Modal {
  private ctx: PublishContext;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private footerEl!: HTMLElement;
  private unused: R2ObjectInfo[] = [];
  private outsideCount = 0;
  private selected = new Set<string>();

  constructor(app: App, ctx: PublishContext) {
    super(app);
    this.ctx = ctx;
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    this.modalEl.addClass("snark-friends-modal");
    this.statusEl = this.contentEl.createDiv({
      cls: "snark-cms-status",
      text: "正在扫描：列举桶内对象 ↔ 拉取仓库内容比对引用…",
    });
    this.listEl = this.contentEl.createDiv({ cls: "snark-cms-scroll" });
    this.footerEl = this.contentEl.createDiv({ cls: "snark-cms-field" });
    void this.scan();
  }

  private async scan(): Promise<void> {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg) {
      this.setStatus("未配置 R2（先在设置里填齐）", true);
      return;
    }
    const s = this.ctx.settings;
    try {
      // 1. 仓库引用集：src/ 下所有文本文件（posts/moments/data/consts/组件全覆盖）
      const files = await this.ctx.client.listTree(["src"], ["md", "mdx", "ts", "tsx", "json", "mjs", "astro"]);
      let refText = "";
      for (let i = 0; i < files.length; i++) {
        this.setStatus(`读取仓库内容 ${i + 1}/${files.length}：${files[i]}`);
        const c = await this.ctx.client.getContent(files[i]);
        if (c) refText += `${c.text}\n`;
      }

      // 2. 全桶对象
      this.setStatus("列举 R2 桶内对象…");
      const objects = await listAllR2Objects(cfg);

      // 3. 分类：被引用 → 保留；未引用且在 keyPrefix 下 → 可删候选；
      //    keyPrefix 之外（BGM 等站点资源）→ 只提示不纳入
      this.unused = [];
      this.outsideCount = 0;
      for (const o of objects) {
        if (refText.includes(o.key)) continue;
        const inBlog = !cfg.keyPrefix || o.key.startsWith(`${cfg.keyPrefix}/`);
        if (inBlog) this.unused.push(o);
        else this.outsideCount++;
      }
      this.selected = new Set(this.unused.map((o) => o.key));
      this.setStatus(
        this.unused.length === 0 && this.outsideCount === 0
          ? `桶内共 ${objects.length} 个对象，全部被内容引用，没有可清理的孤儿图。`
          : `桶内共 ${objects.length} 个对象：未引用 ${this.unused.length} 个` +
              (this.outsideCount ? `（另有 ${this.outsideCount} 个不在博客上传目录，未纳入）` : ""),
        false,
      );
      this.renderList();
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
    }
  }

  private renderList(): void {
    this.listEl.empty();
    this.footerEl.empty();

    if (this.unused.length === 0) {
      this.listEl.createEl("p", { text: "没有未引用的孤儿图，桶很干净。" });
      return;
    }

    // 全选 / 全不选
    const toggleRow = this.listEl.createDiv({ cls: "snark-cms-field" });
    const toggleBtn = toggleRow.createEl("button", { text: `全不选（已选 ${this.selected.size}/${this.unused.length}）` });
    toggleBtn.addEventListener("click", () => {
      if (this.selected.size === this.unused.length) this.selected.clear();
      else this.selected = new Set(this.unused.map((o) => o.key));
      this.renderList();
    });

    const list = this.listEl.createEl("ul", { cls: "snark-cms-list" });
    for (const o of this.unused) {
      const li = list.createEl("li");
      const label = li.createDiv({ cls: "snark-cms-item-main" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(o.key);
      cb.addEventListener("change", () => {
        if (cb.checked) this.selected.add(o.key);
        else this.selected.delete(o.key);
        toggleBtn.setText(`全不选（已选 ${this.selected.size}/${this.unused.length}）`);
      });
      const text = label.createSpan();
      text.className = "snark-cms-item-title";
      text.setText(o.key);
      label.createDiv({
        cls: "snark-cms-item-path",
        text: `${o.size >= 1024 ? `${(o.size / 1024).toFixed(1)} KB` : `${o.size} B`} · ${o.lastModified.slice(0, 10)}`,
      });
    }

    // 底部删除按钮
    const delBtn = this.footerEl.createEl("button", {
      text: `删除所选（${this.selected.size}）`,
    });
    delBtn.disabled = this.selected.size === 0;
    delBtn.addEventListener("click", () => void this.deleteSelected());
  }

  private async deleteSelected(): Promise<void> {
    const cfg = r2Config(this.ctx.settings);
    if (!cfg || this.selected.size === 0) return;
    const keys = [...this.selected];
    const ok = await confirmAsync(
      this.app,
      `从 R2 删除 ${keys.length} 个未引用对象？删除后不可恢复（它们没有出现在任何已发布内容里，但请再确认一眼）。`,
    );
    if (!ok) return;
    let done = 0;
    const failedKeys: string[] = [];
    for (const key of keys) {
      try {
        await deleteR2Object(cfg, key);
        done++;
      } catch (e) {
        failedKeys.push(key);
        errorNotice(`${key}：${String((e as Error).message ?? e)}`);
      }
    }
    this.selected.clear();
    // 列表里只保留删除失败的（成功的不复现）
    this.unused = this.unused.filter((o) => failedKeys.includes(o.key));
    this.setStatus(`清理完成：已删 ${done}，失败 ${failedKeys.length}。`);
    this.renderList();
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
