import { App, Modal, setIcon } from "obsidian";
import { PublishContext } from "../publish";
import { errorNotice, successNotice } from "../utils";
import { confirmAsync } from "./ConfirmModal";

interface FriendLink {
  name: string;
  url: string;
  desc?: string;
  avatar?: string;
  mutual?: boolean;
  rss?: string;
}

/** 友链可视化管理：读取 src/data/friends.json，增删改后整体回写 */
export class FriendsModal extends Modal {
  private friends: FriendLink[] = [];
  private rowsEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private saveBtn!: HTMLButtonElement;

  constructor(app: App, private ctx: PublishContext) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    this.modalEl.addClass("snark-friends-modal");
    const { contentEl } = this;

    this.statusEl = contentEl.createDiv({ cls: "snark-cms-status", text: "加载中…" });
    this.rowsEl = contentEl.createDiv({ cls: "snark-cms-scroll" });
    const actions = contentEl.createDiv({ cls: "snark-cms-modal-actions" });
    actions.createEl("button", { text: "新增友链" }).addEventListener("click", () => {
      this.friends.push({ name: "", url: "https://" });
      this.renderRows();
    });
    this.saveBtn = actions.createEl("button", { text: "保存", cls: "mod-cta" });
    this.saveBtn.addEventListener("click", () => void this.save());

    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const remote = await this.ctx.client.getContent(this.ctx.settings.friendsPath);
      if (!remote) throw new Error(`远端不存在 ${this.ctx.settings.friendsPath}`);
      const parsed = JSON.parse(remote.text);
      if (!Array.isArray(parsed)) throw new Error("friends.json 不是数组");
      this.friends = parsed.map((f) => ({
        name: String(f?.name ?? ""),
        url: String(f?.url ?? ""),
        desc: f?.desc == null ? undefined : String(f.desc),
        avatar: f?.avatar == null ? undefined : String(f.avatar),
        mutual: Boolean(f?.mutual),
        rss: f?.rss == null ? undefined : String(f.rss),
      }));
      this.statusEl.hide();
      this.renderRows();
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
    }
  }

  private renderRows(): void {
    this.rowsEl.empty();
    this.friends.forEach((f, i) => {
      const row = this.rowsEl.createDiv({ cls: "snark-friend-row" });
      const head = row.createDiv({ cls: "snark-friend-row-head" });
      head.createSpan({ cls: "snark-friend-row-index", text: String(i + 1) });

      const mutualLabel = head.createEl("label", { cls: "snark-friend-check" });
      const mutual = mutualLabel.createEl("input", { type: "checkbox" });
      mutual.checked = f.mutual ?? false;
      mutual.addEventListener("change", () => (f.mutual = mutual.checked ? true : undefined));
      mutualLabel.createSpan({ text: "双向（对方也链接了本站）" });

      const removeBtn = head.createEl("button", { cls: "clickable-icon snark-friend-row-remove" });
      setIcon(removeBtn, "trash-2");
      removeBtn.title = "移除此友链";
      removeBtn.setAttribute("aria-label", "移除此友链");
      removeBtn.addEventListener("click", () => {
        this.friends.splice(i, 1);
        this.renderRows();
      });

      this.rowInput(row, "站点名", f.name, (v) => (f.name = v));
      this.rowInput(row, "URL", f.url, (v) => (f.url = v));
      this.rowInput(row, "简介（可空）", f.desc ?? "", (v) => (f.desc = v || undefined));
      this.rowInput(row, "头像外链（可空）", f.avatar ?? "", (v) => (f.avatar = v || undefined));
      this.rowInput(row, "RSS/Atom（可空）", f.rss ?? "", (v) => (f.rss = v || undefined));
    });
  }

  private rowInput(parent: HTMLElement, placeholder: string, value: string, onChange: (v: string) => void): void {
    const input = parent.createEl("input", { type: "text", value });
    input.placeholder = placeholder;
    input.addEventListener("input", () => onChange(input.value));
  }

  private setStatus(msg: string, isError = false): void {
    this.statusEl.setText(msg);
    this.statusEl.show();
    this.statusEl.toggleClass("is-error", isError);
  }

  private async save(): Promise<void> {
    const items = this.friends.filter((f) => f.name.trim() || f.url.trim());
    const bad = items.filter((f) => !f.name.trim() || !/^https?:\/\//.test(f.url.trim()));
    if (bad.length) {
      this.setStatus(`有 ${bad.length} 条友链缺站点名或 URL 不合法（需以 http(s):// 开头）`, true);
      return;
    }
    this.saveBtn.disabled = true;
    this.setStatus("保存中…");
    try {
      const text = `${JSON.stringify(items, null, 2)}\n`;
      await this.ctx.client.putFile(
        this.ctx.settings.friendsPath,
        text,
        "chore: 更新友链（via Snark Blog CMS）",
        (msg) => confirmAsync(this.app, msg),
      );
      this.friends = items;
      this.renderRows();
      this.setStatus("已保存，构建后生效");
      successNotice("友链已更新");
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
      errorNotice(String((e as Error).message ?? e));
    } finally {
      this.saveBtn.disabled = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
