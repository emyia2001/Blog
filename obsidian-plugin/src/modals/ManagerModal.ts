import { App, Modal, TFile, setIcon } from "obsidian";
import { readNoteProps } from "../frontmatter";
import { PublishContext, deleteRemote, setDraft } from "../publish";
import { errorNotice } from "../utils";
import { ConfirmModal, confirmAsync } from "./ConfirmModal";

/** 列出 vault 里已发布（带 blog-path）的笔记，提供跳转 / 草稿切换 / 远端删除 */
export class ManagerModal extends Modal {
  constructor(app: App, private ctx: PublishContext) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const items = this.publishedFiles();
    if (!items.length) {
      contentEl.createEl("p", { text: "还没有通过插件发布的笔记（发布后笔记会带上 blog-path 属性）" });
      return;
    }

    const list = contentEl.createEl("ul", { cls: "snark-cms-list" });
    for (const item of items) {
      const li = list.createEl("li");
      const props = readNoteProps(this.app.metadataCache.getFileCache(item.file)?.frontmatter);

      const main = li.createDiv({ cls: "snark-cms-item-main" });
      main.createDiv({ cls: "snark-cms-item-title", text: props.title ?? item.file.basename });
      main.createDiv({ cls: "snark-cms-item-path", text: item.path });
      main.addEventListener("click", () => {
        this.close();
        void this.app.workspace.getLeaf("tab").openFile(item.file);
      });

      if (item.draft) li.createDiv({ cls: "snark-cms-badge is-draft", text: "草稿" });

      const actions = li.createDiv({ cls: "snark-cms-item-actions" });
      this.iconBtn(actions, "file-code", "在 GitHub 打开", () =>
        window.open(`https://github.com/${this.ctx.settings.owner}/${this.ctx.settings.repo}/blob/${this.ctx.settings.branch}/${item.path}`, "_blank"),
      );
      this.iconBtn(actions, "globe", "打开线上页面", () => window.open(item.url, "_blank"));
      this.iconBtn(
        actions,
        item.draft ? "eye" : "eye-off",
        item.draft ? "取消草稿" : "转为草稿（全站下架）",
        () =>
          this.withReload(
            setDraft(this.ctx, item.file, !item.draft, (msg) => confirmAsync(this.app, msg)),
          ),
      );
      this.iconBtn(actions, "trash-2", "删除远端文件（本地笔记保留）", () => {
        new ConfirmModal(this.app, `删除远端 ${item.path}？本地笔记会保留。`, (ok) => {
          if (ok) void this.withReload(deleteRemote(this.ctx, item.file, (msg) => confirmAsync(this.app, msg)));
        }).open();
      });
    }
  }

  private iconBtn(parent: HTMLElement, icon: string, title: string, onClick: () => void): void {
    const btn = parent.createEl("button", { cls: "clickable-icon" });
    setIcon(btn, icon);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
  }

  private async withReload(task: Promise<void>): Promise<void> {
    try {
      await task;
    } catch (e) {
      errorNotice(String((e as Error).message ?? e));
    }
    this.render();
  }

  private publishedFiles(): { file: TFile; path: string; draft: boolean; url: string }[] {
    const s = this.ctx.settings;
    const out: { file: TFile; path: string; draft: boolean; url: string }[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const props = readNoteProps(this.app.metadataCache.getFileCache(file)?.frontmatter);
      if (!props.blogPath) continue;
      const isPost = props.blogPath.startsWith(`${s.postsDir}/`);
      const url = isPost
        ? `${s.siteUrl}/blog/${props.slug ?? props.blogPath.replace(/^.*\//, "").replace(/\.mdx?$/, "")}/`
        : `${s.siteUrl}/timeline/`;
      out.push({ file, path: props.blogPath, draft: props.draft ?? false, url });
    }
    return out.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
