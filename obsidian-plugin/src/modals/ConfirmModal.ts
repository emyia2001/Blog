import { App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
  private chose = false;

  constructor(app: App, private message: string, private onChoose: (ok: boolean) => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });
    const actions = contentEl.createDiv({ cls: "snark-cms-modal-actions" });
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.choose(false));
    actions.createEl("button", { text: "确定", cls: "mod-warning" }).addEventListener("click", () => this.choose(true));
  }

  private choose(ok: boolean): void {
    if (this.chose) return;
    this.chose = true;
    this.onChoose(ok);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    // Esc 关闭视为取消，保证 Promise 一定 resolve
    if (!this.chose) {
      this.chose = true;
      this.onChoose(false);
    }
  }
}

/** Promise 化的确认框（GitHub 冲突覆盖等场景） */
export function confirmAsync(app: App, msg: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    new ConfirmModal(app, msg, (ok) => resolve(ok)).open();
  });
}
