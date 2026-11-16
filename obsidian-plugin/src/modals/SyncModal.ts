import { App, Modal, TFile, setIcon } from "obsidian";
import { PublishContext } from "../publish";
import { SyncEntry, SyncStatus, buildSyncList, clearMapping, pullIntoVault } from "../sync";
import { errorNotice, successNotice } from "../utils";
import { confirmAsync } from "./ConfirmModal";
import { FriendsModal } from "./FriendsModal";

const STATUS_LABEL: Record<SyncStatus, string> = {
  "remote-only": "仅远端",
  synced: "已同步",
  "remote-changed": "远端有更新",
  "remote-deleted": "远端已删除",
};

function needsPull(entry: SyncEntry): boolean {
  return entry.status === "remote-only" || entry.status === "remote-changed";
}

/** 远端内容同步：抓取 posts/moments 到 vault（含覆盖更新与映射清理），友链走编辑器 */
export class SyncModal extends Modal {
  private entries: SyncEntry[] = [];
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private allBtn!: HTMLButtonElement;

  constructor(app: App, private ctx: PublishContext) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    const { contentEl } = this;
    this.statusEl = contentEl.createDiv({ cls: "snark-cms-status" });

    const header = contentEl.createDiv({ cls: "snark-cms-modal-actions" });
    this.allBtn = header.createEl("button", { text: "全部更新", cls: "mod-cta" });
    this.allBtn.addEventListener("click", () => void this.pullAll());
    this.allBtn.hide();
    const friendsBtn = header.createEl("button", { text: "编辑友链" });
    friendsBtn.addEventListener("click", () => new FriendsModal(this.app, this.ctx).open());

    this.listEl = contentEl.createDiv();
    void this.refresh();
  }

  private setStatus(msg: string, isError = false): void {
    this.statusEl.setText(msg);
    this.statusEl.show();
    this.statusEl.toggleClass("is-error", isError);
  }

  private async refresh(): Promise<void> {
    this.setStatus("读取远端…");
    try {
      this.entries = await buildSyncList(this.ctx, (done, total) => this.setStatus(`拉取 ${done}/${total}…`));
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
      return;
    }
    this.statusEl.hide();
    this.allBtn.toggle(this.entries.some(needsPull));
    this.renderList();
  }

  private renderList(): void {
    this.listEl.empty();
    if (!this.entries.length) {
      this.listEl.createEl("p", { text: "远端还没有文章或纪事" });
      return;
    }
    this.listEl.appendChild(this.renderSection("文章", this.entries.filter((e) => e.kind === "posts")));
    this.listEl.appendChild(this.renderSection("纪事", this.entries.filter((e) => e.kind === "moments")));
  }

  private renderSection(title: string, entries: SyncEntry[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    if (!entries.length) return frag;
    const heading = document.createElement("div");
    heading.className = "snark-cms-section-title";
    heading.textContent = `${title}（${entries.length}）`;
    frag.appendChild(heading);
    const list = document.createElement("ul");
    list.className = "snark-cms-list";
    for (const entry of entries) this.buildRow(list, entry);
    frag.appendChild(list);
    return frag;
  }

  private buildRow(list: HTMLElement, entry: SyncEntry): void {
    const li = list.createEl("li");
    li.createDiv({
      cls: `snark-cms-badge${entry.status === "remote-deleted" ? " is-draft" : ""}`,
      text: STATUS_LABEL[entry.status],
    });

    const main = li.createDiv({ cls: "snark-cms-item-main" });
    main.createDiv({ cls: "snark-cms-item-title", text: entry.title });
    main.createDiv({ cls: "snark-cms-item-path", text: entry.path });
    if (entry.local) {
      main.addEventListener("click", () => this.openLocal(entry.local as TFile));
    }

    const actions = li.createDiv({ cls: "snark-cms-item-actions" });
    if (needsPull(entry)) {
      this.iconBtn(actions, "download", entry.local ? "下载并覆盖本地笔记" : "下载为笔记", () => void this.pull(entry));
    }
    if (entry.status === "remote-deleted") {
      this.iconBtn(actions, "unlink", "清除 blog-path 映射（保留笔记内容）", () =>
        void this.withReload(clearMapping(this.ctx, entry.local as TFile)),
      );
    }
  }

  private iconBtn(parent: HTMLElement, icon: string, title: string, onClick: () => void): void {
    const btn = parent.createEl("button", { cls: "clickable-icon" });
    setIcon(btn, icon);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
  }

  private openLocal(file: TFile): void {
    this.close();
    void this.app.workspace.getLeaf("tab").openFile(file);
  }

  /** 单条下载；远端有更新且本地存在时先确认覆盖 */
  private async pull(entry: SyncEntry): Promise<void> {
    if (entry.status === "remote-changed" && entry.local) {
      const ok = await confirmAsync(
        this.app,
        `下载将覆盖本地笔记《${entry.title}》（你对它的本地修改会丢失）。继续？`,
      );
      if (!ok) return;
    }
    try {
      entry.local = await pullIntoVault(this.ctx, entry);
      entry.status = "synced";
      successNotice(`已下载 ${entry.path}`);
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
    this.allBtn.toggle(this.entries.some(needsPull));
    this.renderList();
  }

  /** 全部更新：一次确认后批量下载 */
  private async pullAll(): Promise<void> {
    const targets = this.entries.filter(needsPull);
    if (!targets.length) return;
    const overwrites = targets.filter((e) => e.local).length;
    const ok = await confirmAsync(
      this.app,
      overwrites
        ? `将下载 ${targets.length} 个文件，其中 ${overwrites} 个会覆盖本地笔记（本地修改丢失）。继续？`
        : `将下载 ${targets.length} 个文件到 vault。继续？`,
    );
    if (!ok) return;
    this.allBtn.disabled = true;
    let done = 0;
    for (const entry of targets) {
      try {
        entry.local = await pullIntoVault(this.ctx, entry);
        entry.status = "synced";
      } catch (e) {
        errorNotice(String((e as Error).message ?? e));
      }
      this.setStatus(`同步 ${++done}/${targets.length}…`);
    }
    this.allBtn.disabled = false;
    successNotice(`已同步 ${done} 个文件`);
    this.statusEl.hide();
    this.allBtn.toggle(this.entries.some(needsPull));
    this.renderList();
  }

  private async withReload(task: Promise<void>): Promise<void> {
    try {
      await task;
      successNotice("已清除映射（笔记内容保留）");
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
    await this.refresh();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
