import { App, Modal, Notice, TFile } from "obsidian";
import { MOMENT_TYPES, MomentType, readNoteProps, stripFrontmatter } from "../frontmatter";
import { PublishContext, PublishForm, PublishOutcome, publishNote } from "../publish";
import { SLUG_RE, firstParagraph, successNotice, todayISO } from "../utils";
import { confirmAsync } from "./ConfirmModal";

/** 发布当前笔记：选集合、补 slug/摘要/类型，校验后单文件提交 */
export class PublishModal extends Modal {
  private form: PublishForm;
  private statusEl!: HTMLElement;
  private linkRow!: HTMLElement;
  private publishBtn!: HTMLButtonElement;
  private actionsRow!: HTMLElement;

  private slugInput!: HTMLInputElement;
  private excerptArea!: HTMLTextAreaElement;
  private typeSelect!: HTMLSelectElement;
  private draftToggle!: HTMLInputElement;

  private postsFields: HTMLElement[] = [];
  private momentFields: HTMLElement[] = [];

  constructor(app: App, private ctx: PublishContext, private file: TFile) {
    super(app);
    const props = readNoteProps(app.metadataCache.getFileCache(file)?.frontmatter);
    this.form = {
      kind: props.type ? "moments" : "posts",
      title: props.title ?? file.basename,
      date: props.date ?? todayISO(),
      excerpt: props.excerpt ?? "",
      slug: props.slug ?? "",
      type: props.type ?? "event",
      draft: props.draft ?? false,
      tags: props.tags,
      heroImage: props.heroImage ?? "",
      featured: props.featured ?? false,
      dropCap: props.dropCap !== false,
      bgmSrc: props.bgmSrc ?? "",
      bgmTitle: props.bgmTitle ?? "",
      lockQuestion: props.lockQuestion ?? "",
      lockAnswer: props.lockAnswer ?? "",
      graphName: props.graphName ?? "",
      graphAvatar: props.graphAvatar ?? "",
      graphEnabled: props.graphEnabled !== false,
      graphLinks: props.graphLinks,
    };
  }

  onOpen(): void {
    this.modalEl.addClass("snark-cms-modal");
    const { contentEl } = this;

    // 集合切换（文章 / 纪事）
    const seg = contentEl.createDiv({ cls: "snark-cms-field" });
    const segWrap = seg.createDiv({ cls: "snark-cms-segment" });
    const btnPosts = segWrap.createEl("button", { text: "文章" });
    const btnMoments = segWrap.createEl("button", { text: "纪事" });
    const paintSeg = () => {
      btnPosts.toggleClass("mod-cta", this.form.kind === "posts");
      btnMoments.toggleClass("mod-cta", this.form.kind === "moments");
    };
    btnPosts.addEventListener("click", () => {
      this.form.kind = "posts";
      paintSeg();
      this.refreshKindFields();
    });
    btnMoments.addEventListener("click", () => {
      this.form.kind = "moments";
      paintSeg();
      this.refreshKindFields();
    });
    paintSeg();

    this.textField(contentEl, "标题", this.form.title, (v) => (this.form.title = v));
    this.textField(contentEl, "日期", this.form.date, (v) => (this.form.date = v), "date");

    const slugField = this.textField(
      contentEl,
      "slug（英文短名，决定 /blog/<slug>）",
      this.form.slug,
      (v) => (this.form.slug = v),
    );
    this.slugInput = slugField.querySelector("input") as HTMLInputElement;
    this.postsFields.push(slugField);

    const excerptField = contentEl.createDiv({ cls: "snark-cms-field" });
    excerptField.createEl("label", { text: "摘要 excerpt" });
    this.excerptArea = excerptField.createEl("textarea", { text: this.form.excerpt });
    this.excerptArea.addEventListener("input", () => (this.form.excerpt = this.excerptArea.value));
    this.postsFields.push(excerptField);

    const typeField = contentEl.createDiv({ cls: "snark-cms-field" });
    typeField.createEl("label", { text: "类型" });
    this.typeSelect = typeField.createEl("select");
    for (const t of MOMENT_TYPES) {
      const opt = this.typeSelect.createEl("option", { text: t.label });
      opt.value = t.value;
    }
    this.typeSelect.value = this.form.type;
    this.typeSelect.addEventListener("change", () => (this.form.type = this.typeSelect.value as MomentType));
    this.momentFields.push(typeField);

    const draftField = contentEl.createDiv({ cls: "snark-cms-field" });
    const draftLabel = draftField.createEl("label");
    this.draftToggle = draftLabel.createEl("input", { type: "checkbox" });
    this.draftToggle.checked = this.form.draft;
    this.draftToggle.addEventListener("change", () => (this.form.draft = this.draftToggle.checked));
    draftLabel.createSpan({ text: " 草稿（保存到仓库但不出现在站点）" });

    // 全部属性（可折叠区；有值时默认展开）
    const hasSecondary =
      this.form.tags.length > 0 ||
      !!this.form.heroImage ||
      this.form.featured ||
      !this.form.dropCap ||
      !!this.form.bgmSrc ||
      !!this.form.bgmTitle ||
      !!this.form.lockQuestion ||
      !!this.form.lockAnswer ||
      !!this.form.graphName ||
      !!this.form.graphAvatar ||
      !this.form.graphEnabled ||
      this.form.graphLinks.length > 0;
    const details = contentEl.createEl("details", { cls: "snark-cms-more" });
    details.createEl("summary", { text: "全部属性" });
    const grid = details.createDiv({ cls: "snark-cms-more-body" });

    this.textField(grid, "标签（逗号分隔）", this.form.tags.join(", "), (v) => {
      this.form.tags = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    });
    this.textField(grid, "封面图 URL（分享卡与图谱头像用）", this.form.heroImage, (v) => (this.form.heroImage = v));
    this.textField(grid, "BGM 链接", this.form.bgmSrc, (v) => (this.form.bgmSrc = v));
    this.textField(grid, "BGM 名称", this.form.bgmTitle, (v) => (this.form.bgmTitle = v));
    this.momentFields.push(
      this.textField(grid, "lock 谜面（公开显示）", this.form.lockQuestion, (v) => (this.form.lockQuestion = v)),
      this.textField(grid, "lock 答案（即密码，须长且唯一）", this.form.lockAnswer, (v) => (this.form.lockAnswer = v)),
    );
    this.textField(grid, "图谱节点名", this.form.graphName, (v) => (this.form.graphName = v));
    this.textField(grid, "图谱头像 URL", this.form.graphAvatar, (v) => (this.form.graphAvatar = v));
    this.textField(grid, "图谱关联（文章 slug，逗号分隔）", this.form.graphLinks.join(", "), (v) => {
      this.form.graphLinks = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    });

    const toggles = grid.createDiv({ cls: "snark-cms-field snark-cms-toggles" });
    this.check(toggles, "置顶 featured", this.form.featured, (v) => (this.form.featured = v));
    this.check(toggles, "首字下沉", this.form.dropCap, (v) => (this.form.dropCap = v));
    this.check(toggles, "进图谱", this.form.graphEnabled, (v) => (this.form.graphEnabled = v));

    if (hasSecondary) details.open = true;

    this.statusEl = contentEl.createDiv({ cls: "snark-cms-status" });
    this.linkRow = contentEl.createDiv({ cls: "snark-cms-links" });
    this.linkRow.hide();

    const actions = contentEl.createDiv({ cls: "snark-cms-modal-actions" });
    this.actionsRow = actions;
    this.publishBtn = actions.createEl("button", { text: "发布", cls: "mod-cta" });
    this.publishBtn.addEventListener("click", () => void this.doPublish());

    this.refreshKindFields();

    // 摘要为空时预填正文首段
    void this.ctx.app.vault.read(this.file).then((text) => {
      if (!this.excerptArea.value.trim()) {
        this.excerptArea.value = firstParagraph(stripFrontmatter(text));
        this.form.excerpt = this.excerptArea.value;
      }
    });
  }

  private textField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
  ): HTMLDivElement {
    const field = parent.createDiv({ cls: "snark-cms-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { type, value });
    input.addEventListener("input", () => onChange(input.value));
    return field;
  }

  private check(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
    const l = parent.createEl("label", { cls: "snark-cms-check" });
    const input = l.createEl("input", { type: "checkbox" });
    input.checked = value;
    input.addEventListener("change", () => onChange(input.checked));
    l.createSpan({ text: ` ${label}` });
  }

  private refreshKindFields(): void {
    const posts = this.form.kind === "posts";
    for (const el of this.postsFields) el.toggle(posts);
    for (const el of this.momentFields) el.toggle(!posts);
  }

  private setStatus(msg: string, isError = false): void {
    this.statusEl.setText(msg);
    this.statusEl.toggleClass("is-error", isError);
  }

  private validate(): string[] {
    const issues: string[] = [];
    if (this.form.kind === "posts") {
      if (!this.form.title.trim()) issues.push("缺少标题");
      if (!this.form.slug) issues.push("缺少 slug");
      else if (!SLUG_RE.test(this.form.slug)) issues.push("slug 只能用英文小写、数字和连字符");
      if (!this.form.excerpt.trim()) issues.push("缺少摘要");
    }
    if (!this.form.date.trim()) issues.push("缺少日期");
    return issues;
  }

  private async doPublish(): Promise<void> {
    const issues = this.validate();
    if (issues.length) {
      this.setStatus(issues.join("；"), true);
      return;
    }
    this.publishBtn.disabled = true;
    this.linkRow.empty();
    this.linkRow.hide();
    this.setStatus("提交中…");
    try {
      const outcome: PublishOutcome = await publishNote(this.ctx, this.file, this.form, (msg) =>
        confirmAsync(this.app, msg),
      );
      for (const w of outcome.warnings) new Notice(w, 8000);
      const warnNote = outcome.warnings.length ? `，${outcome.warnings.length} 条正文警告见通知` : "";
      this.setStatus(`${outcome.created ? "已新建" : "已更新"}，Actions 构建中${warnNote}`, false);
      successNotice(`《${this.form.title || this.form.date}》已提交 GitHub`);
      this.actionsRow.hide(); // 发布完成，收起「发布」按钮，下方只留结果链接
      this.linkRow.empty();
      this.linkRow.show();
      const actions = this.linkRow;
      if (this.form.kind === "posts") {
        actions.createEl("button", { text: "线上页面" }).addEventListener("click", () => {
          window.open(`${this.ctx.settings.siteUrl}/blog/${this.form.slug}/`, "_blank");
        });
      } else {
        actions.createEl("button", { text: "纪事页" }).addEventListener("click", () => {
          window.open(`${this.ctx.settings.siteUrl}/timeline/`, "_blank");
        });
      }
      actions
        .createEl("button", { text: outcome.commitUrl ? "本次提交" : "Actions" })
        .addEventListener("click", () =>
          window.open(outcome.commitUrl ?? `https://github.com/${this.ctx.settings.owner}/${this.ctx.settings.repo}/actions`, "_blank"),
        );
      if (this.form.slug) this.slugInput.value = this.form.slug;
    } catch (e) {
      this.setStatus(String((e as Error).message ?? e), true);
    } finally {
      this.publishBtn.disabled = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
