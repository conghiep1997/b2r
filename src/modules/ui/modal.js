/**
 * Modal UI management for Backlog2Redmine Extension.
 * Uses escapeHtml / renderRedmineNotePreview from render-markdown.js (loaded via manifest).
 */

/* global escapeHtml, renderMarkdownHtml, renderRedmineNotePreview */

let modalElements = null;
let modalPreviousFocus = null;
let customFieldsMetadata = [];
let redmineSettings = null;
let modalMetadataRequestId = 0;

globalThis.TB_RENDER_AI_STATUS = (status, fallbackElement) => {
  if (!status) return;
  const template = globalThis.TB_GET_MESSAGE(`options_ai_status_${status.phase}`);
  const values = {
    provider: status.provider || "AI",
    fallback: status.fallback || "AI",
    model: status.model || "",
    seconds: String(status.seconds || ""),
    attempt: String(status.attempt || ""),
    error: status.error || "",
  };
  const message = template.replace(
    /\$(provider|fallback|model|seconds|attempt|error)\$/g,
    (_, name) => values[name]
  );
  const modalLoading = document.getElementById("tb-modal-loading");
  const modalStatus = document.getElementById("tb-modal-loading-text");
  if (modalLoading?.getClientRects().length && modalStatus) modalStatus.textContent = message;
  else if (fallbackElement?.isConnected) fallbackElement.textContent = message;
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "TB_AI_STATUS") return;
  globalThis.TB_RENDER_AI_STATUS(message.status, globalThis.TB_ACTIVE_AI_STATUS_TARGET);
});

const NOTE_SEPARATOR_REGEX = /^--- Note \d+ ---\s*\n/gm;
const NOTE_LIST_SCROLL_THRESHOLD = 4;

function setModalSubtitle(el, text) {
  if (!el) return;
  const value = String(text || "").trim();
  el.textContent = value;
  el.hidden = !value;
}

function formatCharCount(length) {
  if (typeof TB?.MESSAGES?.MODAL?.CHAR_COUNT === "function") {
    return TB.MESSAGES.MODAL.CHAR_COUNT(length);
  }
  return `${length} ký tự`;
}

function escapeUiHtml(value) {
  if (typeof escapeHtml === "function") {
    return escapeHtml(String(value ?? ""));
  }
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setPreviewMode(previewTextarea, previewHtmlEl, previewToggleBtn, isHtmlMode) {
  if (!previewToggleBtn || !previewHtmlEl || !previewTextarea) return;

  if (isHtmlMode) {
    const renderPreview =
      typeof renderRedmineNotePreview === "function"
        ? renderRedmineNotePreview
        : renderMarkdownHtml;
    previewHtmlEl.innerHTML = renderPreview(previewTextarea.value);
    previewTextarea.style.display = "none";
    previewHtmlEl.style.display = "block";
    previewToggleBtn.textContent = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_REDMINE;
    previewToggleBtn.title = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_REDMINE_TITLE;
    return;
  }

  previewTextarea.style.display = "block";
  previewHtmlEl.style.display = "none";
  previewToggleBtn.textContent = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW;
  previewToggleBtn.title = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW_TITLE;
}

function renderStructuredNoteEditors(listEl, notes, options = {}) {
  if (!listEl) return;

  const { titlePrefix = "Note", startIndex = 1, helperText = "", onChange } = options;

  listEl.classList.toggle("tb-note-list--scrollable", notes.length >= NOTE_LIST_SCROLL_THRESHOLD);
  listEl.classList.toggle("tb-note-list--single", notes.length === 1);
  listEl.replaceChildren();

  if (!notes.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "tb-note-list-empty";
    emptyState.textContent = helperText || TB.MESSAGES.MODAL.WAITING_TRANSLATION;
    listEl.appendChild(emptyState);
    return;
  }

  notes.forEach((note, index) => {
    const card = document.createElement("section");
    card.className = "tb-note-card";

    const header = document.createElement("div");
    header.className = "tb-note-card-header";

    const title = document.createElement("h4");
    title.className = "tb-note-card-title";
    title.textContent = titlePrefix + " " + (startIndex + index);

    const meta = document.createElement("span");
    meta.className = "tb-note-card-meta";
    meta.textContent = formatCharCount(note.trim().length);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "tb-note-preview-toggle";
    toggleBtn.textContent = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW;
    toggleBtn.title = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW_TITLE;

    const headerActions = document.createElement("div");
    headerActions.className = "tb-note-card-actions";
    headerActions.append(meta, toggleBtn);

    const textarea = document.createElement("textarea");
    textarea.className = "tb-note-card-textarea";
    textarea.rows = 6;
    textarea.value = note;

    const previewEl = document.createElement("div");
    previewEl.className = "tb-note-card-preview";
    previewEl.style.display = "none";

    let isPreviewMode = false;
    const syncPreview = () => {
      const renderPreview =
        typeof renderRedmineNotePreview === "function"
          ? renderRedmineNotePreview
          : renderMarkdownHtml;
      previewEl.innerHTML = renderPreview(textarea.value);
    };
    toggleBtn.addEventListener("click", () => {
      isPreviewMode = !isPreviewMode;
      if (isPreviewMode) {
        syncPreview();
        textarea.style.display = "none";
        previewEl.style.display = "block";
        toggleBtn.textContent = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_REDMINE;
        toggleBtn.title = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_REDMINE_TITLE;
        return;
      }
      textarea.style.display = "block";
      previewEl.style.display = "none";
      toggleBtn.textContent = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW;
      toggleBtn.title = TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW_TITLE;
    });

    textarea.addEventListener("input", () => {
      meta.textContent = formatCharCount(textarea.value.trim().length);
      if (isPreviewMode) {
        syncPreview();
      }
      onChange?.(index, textarea.value);
    });

    header.append(title, headerActions);
    card.append(header, textarea, previewEl);
    listEl.appendChild(card);
  });
}

function setCombinedNotesTextareaValue(textarea, notes, startIndex = 1) {
  if (!textarea) return;
  textarea.value = notes
    .map((text, index) => "--- Note " + (startIndex + index) + " ---\n" + text)
    .join("\n\n");
}

function renderStructuredBatchNotes(listEl, notes, options = {}) {
  const {
    titlePrefix = "Note",
    startIndex = 1,
    helperText = "",
    targetTextarea,
    onNotesChange,
  } = options;

  renderStructuredNoteEditors(listEl, notes, {
    titlePrefix,
    startIndex,
    helperText,
    onChange: (index, value) => {
      notes[index] = value;
      setCombinedNotesTextareaValue(targetTextarea, notes, startIndex);
      onNotesChange?.(notes);
    },
  });
}

function renderBacklogUserSuggestion(user) {
  const id = escapeUiHtml(user.id);
  const userId = escapeUiHtml(user.userId || "");
  const name = escapeUiHtml(user.name);
  const suffix = user.userId ? ` (@${userId})` : "";
  return `<div class="tb-suggestion-item" data-user-id="${id}" data-login-id="${userId}" data-username="${name}">${name}${suffix}</div>`;
}

function replaceSelectOptions(select, items, getLabel, getValue, isSelected = () => false) {
  select.replaceChildren();
  items.forEach((item) => {
    const option = new Option(getLabel(item), String(getValue(item)));
    option.selected = isSelected(item);
    select.add(option);
  });
}

function ensureModalShell() {
  let overlay = document.getElementById("tb-redmine-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tb-redmine-overlay";
    overlay.className = "tb-modal-overlay";
    overlay.style.display = "none";
    document.body.appendChild(overlay);
    document.addEventListener("keydown", (event) => {
      if (!overlay || overlay.style.display === "none") return;
      if (event.key === "Escape") {
        const successModal = overlay.querySelector("#tb-success-modal");
        const isSuccessVisible =
          successModal && !successModal.hidden && successModal.style.display !== "none";
        if (isSuccessVisible) {
          overlay.querySelector("#tb-success-close-btn")?.click();
        } else {
          overlay.querySelector("#tb-modal-close")?.click();
        }
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        event.target?.closest?.("#tb-confirm-modal")
      ) {
        const confirmBtn = overlay.querySelector("#tb-modal-confirm");
        if (confirmBtn && !confirmBtn.disabled) {
          event.preventDefault();
          confirmBtn.click();
        }
      }
    });
  }

  overlay.innerHTML = `
    <div class="tb-modal-container">
      <!-- Loading Overlay -->
      <div id="tb-modal-loading" class="tb-modal-loading" style="display: none;">
        <div class="tb-spinner"></div>
        <div id="tb-modal-loading-text" class="tb-loading-text" role="status" aria-live="polite">${TB.MESSAGES.PROCESSING}</div>
      </div>
      <!-- Confirm Modal -->
      <div id="tb-confirm-modal" class="tb-modal-content" role="dialog" aria-modal="true" aria-labelledby="tb-modal-title">
        <div class="tb-modal-header">
          <h2 id="tb-modal-title" class="tb-modal-title">${TB.MESSAGES.MODAL.TITLE}</h2>
          <button id="tb-modal-close" class="tb-modal-close" aria-label="${TB.MESSAGES.MODAL.CLOSE_ARIA}">${globalThis.TB_ICONS?.CLOSE || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'}</button>
        </div>
        <div class="tb-modal-body">
          <p id="tb-modal-subtitle" class="tb-modal-subtitle" hidden></p>
          <p class="tb-preview-notice">${globalThis.TB_GET_MESSAGE("options_preview_notice")}</p>
          <div id="tb-standard-fields">
            <div class="tb-field-group">
              <label for="tb-redmine-issue-id">${TB.MESSAGES.MODAL.ISSUE_ID_LABEL}</label>
              <input type="text" id="tb-redmine-issue-id" placeholder="${TB.MESSAGES.MODAL.ISSUE_ID_PLACEHOLDER}">
            </div>
            <div class="tb-field-group">
              <label id="tb-issue-title-label" for="tb-redmine-issue-title">${TB.MESSAGES.MODAL.ISSUE_TITLE_LABEL}</label>
              <textarea id="tb-redmine-issue-title" class="tb-multiline-input" readonly rows="2"></textarea>
            </div>
          </div>
          <div id="tb-migration-fields" hidden>
            <div class="tb-field-group">
              <label for="tb-migrate-project">${TB.MESSAGES.MODAL.PROJECT_LABEL}<span class="tb-required">*</span></label>
              <select id="tb-migrate-project">
                <option value="">${TB.MESSAGES.MODAL.LOADING_METADATA}</option>
              </select>
            </div>
            <div class="tb-field-group">
              <label for="tb-migrate-subject">${TB.MESSAGES.MODAL.SUBJECT_LABEL}<span class="tb-required">*</span></label>
              <input type="text" id="tb-migrate-subject">
            </div>
            <div class="tb-field-row">
              <div class="tb-field-group">
                <label for="tb-migrate-version">${TB.MESSAGES.MODAL.VERSION_LABEL}</label>
                <select id="tb-migrate-version"><option value="">${TB.MESSAGES.MODAL.VERSION_LOADING}</option></select>
              </div>
              <div id="tb-migrate-due-date-group" class="tb-field-group">
                <label id="tb-migrate-due-date-label" for="tb-migrate-due-date">${TB.MESSAGES.MODAL.DUE_DATE_LABEL}</label>
                <input type="date" id="tb-migrate-due-date">
              </div>
            </div>
            <div class="tb-field-row">
              <div class="tb-field-group">
                <label for="tb-migrate-tracker">${TB.MESSAGES.MODAL.TRACKER_LABEL}<span class="tb-required">*</span></label>
                <select id="tb-migrate-tracker"><option value="">${TB.MESSAGES.MODAL.VERSION_LOADING}</option></select>
              </div>
              <div class="tb-field-group">
                <label for="tb-migrate-priority">${TB.MESSAGES.MODAL.PRIORITY_LABEL}<span class="tb-required">*</span></label>
                <select id="tb-migrate-priority"><option value="">${TB.MESSAGES.MODAL.VERSION_LOADING}</option></select>
              </div>
            </div>
            <!-- Dynamic Custom Fields Container -->
            <div id="tb-dynamic-fields" class="tb-field-grid"></div>
          </div>
          <div class="tb-field-group">
            <div class="tb-preview-header">
              <label id="tb-preview-label" for="tb-redmine-preview">${TB.MESSAGES.MODAL.PREVIEW_LABEL}</label>
              <button type="button" id="tb-preview-toggle" class="tb-preview-toggle" title="${TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW_TITLE}">${TB.MESSAGES.MODAL.PREVIEW_TOGGLE_SHOW}</button>
            </div>
            <div class="tb-preview-container">
              <textarea id="tb-redmine-preview" rows="10"></textarea>
              <div id="tb-redmine-preview-html" class="tb-preview-html" style="display: none;"></div>
            </div>
          </div>
          <div id="tb-comments-preview-group" class="tb-field-group" style="display: none;">
            <div class="tb-note-list-header">
              <label class="tb-note-list-label" for="tb-redmine-comments-preview">${TB.MESSAGES.MODAL.PREVIEW_COMMENTS}</label>
            </div>
            <div id="tb-comments-note-list" class="tb-note-list"></div>
            <textarea id="tb-redmine-comments-preview" rows="8" hidden></textarea>
          </div>
          <div id="tb-batch-info" class="tb-batch-pill" hidden></div>
          <div id="tb-batch-option" class="tb-batch-option" hidden>
            <label><input type="checkbox" id="tb-batch-checkbox"> <span id="tb-batch-text"></span></label>
          </div>

           <!-- Backlog Specific Field -->
           <div id="tb-backlog-fields">
             <div class="tb-field-group">
               <div id="tb-backlog-suggestions" class="tb-suggestions"></div>
             </div>
           </div>
        </div>
        <div id="tb-dry-run-result" class="tb-dry-run-result" role="status" aria-live="polite" hidden></div>
        <div class="tb-modal-footer">
          <button id="tb-modal-cancel" class="tb-btn tb-btn-secondary">${TB.MESSAGES.MODAL.CANCEL}</button>
          <button id="tb-dry-run" type="button" class="tb-btn tb-btn-secondary">${globalThis.TB_GET_MESSAGE("modal_dry_run_button")}</button>
          <button id="tb-modal-confirm" class="tb-btn tb-btn-primary">${TB.MESSAGES.MODAL.CONFIRM}</button>
        </div>
      </div>
      <!-- Success Modal -->
      <div id="tb-success-modal" class="tb-modal-content" role="dialog" aria-modal="true" aria-labelledby="tb-success-title" hidden>
        <div class="tb-modal-header">
          <h2 id="tb-success-title" class="tb-modal-title">${TB.MESSAGES.MODAL.SUCCESS_TITLE}</h2>
        </div>
        <div class="tb-modal-body">
          <p id="tb-success-subtitle" class="tb-modal-subtitle">${TB.MESSAGES.MODAL.SUCCESS_SUBTITLE}</p>
          <div class="tb-success-link-container"><a id="tb-success-link" href="#" target="_blank" class="tb-success-link"></a></div>
          <label id="tb-success-hide-label" class="tb-success-hide-option">
            <input type="checkbox" id="tb-success-hide-checkbox">
            <span>${TB.MESSAGES.MODAL.SUCCESS_HIDE_AGAIN_LABEL}</span>
          </label>
        </div>
        <div class="tb-modal-footer">
          <button id="tb-success-view-btn" class="tb-btn tb-btn-primary">${TB.MESSAGES.MODAL.SUCCESS_VIEW_BUTTON}</button>
          <button id="tb-success-close-btn" class="tb-btn tb-btn-secondary">${TB.MESSAGES.MODAL.SUCCESS_CLOSE_BUTTON}</button>
        </div>
      </div>
    </div>
  `;

  modalElements = {
    overlay,
    confirmModal: overlay.querySelector("#tb-confirm-modal"),
    titleEl: overlay.querySelector("#tb-modal-title"),
    subtitleEl: overlay.querySelector("#tb-modal-subtitle"),
    issueIdInput: overlay.querySelector("#tb-redmine-issue-id"),
    issueTitleInput: overlay.querySelector("#tb-redmine-issue-title"),
    issueTitleLabel: overlay.querySelector("#tb-issue-title-label"),
    previewTextarea: overlay.querySelector("#tb-redmine-preview"),
    closeButton: overlay.querySelector("#tb-modal-close"),
    cancelButton: overlay.querySelector("#tb-modal-cancel"),
    confirmButton: overlay.querySelector("#tb-modal-confirm"),
    dryRunButton: overlay.querySelector("#tb-dry-run"),
    dryRunResult: overlay.querySelector("#tb-dry-run-result"),
    batchInfoEl: overlay.querySelector("#tb-batch-info"),
    batchOptionEl: overlay.querySelector("#tb-batch-option"),
    batchOptionCheckbox: overlay.querySelector("#tb-batch-checkbox"),
    batchOptionText: overlay.querySelector("#tb-batch-text"),
    successModal: overlay.querySelector("#tb-success-modal"),
    successTitleEl: overlay.querySelector("#tb-success-title"),
    successSubtitleEl: overlay.querySelector("#tb-success-subtitle"),
    successLinkEl: overlay.querySelector("#tb-success-link"),
    successHideLabel: overlay.querySelector("#tb-success-hide-label"),
    successHideCheckbox: overlay.querySelector("#tb-success-hide-checkbox"),
    successViewButton: overlay.querySelector("#tb-success-view-btn"),
    successCloseButton: overlay.querySelector("#tb-success-close-btn"),
    standardFields: overlay.querySelector("#tb-standard-fields"),
    migrationFields: overlay.querySelector("#tb-migration-fields"),
    projectSelect: overlay.querySelector("#tb-migrate-project"),
    trackerSelect: overlay.querySelector("#tb-migrate-tracker"),
    prioritySelect: overlay.querySelector("#tb-migrate-priority"),
    versionSelect: overlay.querySelector("#tb-migrate-version"),
    migrateSubjectInput: overlay.querySelector("#tb-migrate-subject"),
    migrateDueDateInput: overlay.querySelector("#tb-migrate-due-date"),
    migrateDueDateLabel: overlay.querySelector("#tb-migrate-due-date-label"),
    migrateDueDateGroup: overlay.querySelector("#tb-migrate-due-date-group"),
    commentsPreviewGroup: overlay.querySelector("#tb-comments-preview-group"),
    commentsPreviewList: overlay.querySelector("#tb-comments-note-list"),
    commentsPreviewTextarea: overlay.querySelector("#tb-redmine-comments-preview"),
    previewLabel: overlay.querySelector("#tb-preview-label"),
    dynamicFieldsContainer: overlay.querySelector("#tb-dynamic-fields"),
    backlogFields: overlay.querySelector("#tb-backlog-fields"),
    backlogSuggestionsEl: overlay.querySelector("#tb-backlog-suggestions"),
    issueIdLabel: overlay.querySelector("label[for='tb-redmine-issue-id']"),
    loadingOverlay: overlay.querySelector("#tb-modal-loading"),
    loadingText: overlay.querySelector("#tb-modal-loading-text"),
  };
  const clearDryRun = () => {
    modalElements.dryRunResult.hidden = true;
  };
  modalElements.confirmModal.addEventListener("input", clearDryRun);
  modalElements.confirmModal.addEventListener("change", clearDryRun);
}

function setModalLoading(isLoading, customText = null) {
  if (!modalElements || !modalElements.loadingOverlay) return;
  modalElements.loadingOverlay.style.display = isLoading ? "flex" : "none";
  if (isLoading && customText) {
    modalElements.loadingText.textContent = customText;
  } else if (isLoading) {
    modalElements.loadingText.textContent = TB.MESSAGES.PROCESSING;
  }
}

function closeModal() {
  const overlay = document.getElementById("tb-redmine-overlay");
  if (overlay) {
    overlay.style.display = "none";
    document.body.classList.remove("tb-modal-open");
  }
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
  modalPreviousFocus = null;
}

function showDryRunResult({ action, target, count, skipped = 0, warning = "" }) {
  const panel = modalElements.dryRunResult;
  const lines = [
    globalThis.TB_GET_MESSAGE("modal_dry_run_no_changes"),
    globalThis
      .TB_GET_MESSAGE("modal_dry_run_summary")
      .replace("$action$", action)
      .replace("$target$", target || "—")
      .replace("$count$", String(count)),
  ];
  if (skipped) {
    lines.push(
      globalThis.TB_GET_MESSAGE("modal_dry_run_skipped").replace("$count$", String(skipped))
    );
  }
  if (warning) lines.push(warning);
  panel.replaceChildren(
    ...lines.map((line) => {
      const paragraph = document.createElement("p");
      paragraph.style.margin = "0 0 4px";
      paragraph.textContent = line;
      return paragraph;
    })
  );
  panel.hidden = false;
}

/* global TB_MIGRATION_SELECTION */
function openConfirmModal(options) {
  modalPreviousFocus = document.activeElement;
  const {
    redmineIssueId = "",
    issueTitle = "",
    previewText = "",
    remainingComments = [],
    hasBatchOption = false,
    isMigration = false,
    commentsCount = 0,
    initialBatchNotes = null,
    migrateCommentsByDefault = false,
    onCancel,
    onConfirm,
    translateBatch,
    backlogIssueType = "",
    backlogMilestone = "",
    sourceIssueKey = "",
  } = options;
  ensureModalShell();
  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdInput,
    issueTitleInput,
    issueTitleLabel,
    previewTextarea,
    closeButton,
    cancelButton,
    confirmButton,
    dryRunButton,
    dryRunResult,
    batchOptionEl,
    batchOptionCheckbox,
    batchOptionText,
    standardFields,
    migrationFields,
    projectSelect,
    trackerSelect,
    prioritySelect,
    versionSelect,
    migrateSubjectInput,
    migrateDueDateInput,
    commentsPreviewGroup,
    commentsPreviewList,
    commentsPreviewTextarea,
    backlogFields,
    previewLabel,
    batchHintEl,
  } = modalElements;
  dryRunResult.hidden = true;
  if (backlogFields) backlogFields.hidden = true;
  const previewHtmlEl = overlay.querySelector("#tb-redmine-preview-html");
  const previewToggleBtn = overlay.querySelector("#tb-preview-toggle");
  const previewFieldGroup = previewTextarea.closest(".tb-field-group");

  function setCommentsPreviewVisible(isVisible) {
    commentsPreviewGroup.hidden = !isVisible;
    commentsPreviewGroup.style.display = isVisible ? "" : "none";
  }

  let currentMode = false;
  let currentNotesList = [previewText];
  let memoizedBatchNotes = Array.isArray(initialBatchNotes) ? initialBatchNotes.slice() : null;
  let pendingBatchNotes = null;
  const excludedComments = new Set();
  const excludedFiles = new Set();
  let migrationDescriptionInitialized = false;
  const selectionPanel = document.createElement("div");
  selectionPanel.id = "tb-migration-selection";
  selectionPanel.className = "tb-migration-selection";
  selectionPanel.hidden = !isMigration;
  migrationFields.after(selectionPanel);

  function migrationPlan() {
    return TB_MIGRATION_SELECTION.plan(
      previewTextarea.value.trim(),
      batchOptionCheckbox.checked ? memoizedBatchNotes || [] : [],
      excludedComments,
      excludedFiles
    );
  }

  function refreshMigrationSelection() {
    if (!isMigration) return;
    const notes = batchOptionCheckbox.checked ? memoizedBatchNotes || [] : [];
    commentsPreviewList.querySelectorAll(".tb-note-card").forEach((card, index) => {
      if (card.querySelector(".tb-note-selected")) return;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "tb-note-selected";
      input.checked = !excludedComments.has(index);
      input.setAttribute(
        "aria-label",
        globalThis.TB_GET_MESSAGE("migration_include_comment").replace("$count$", index + 1)
      );
      input.addEventListener("change", () => {
        input.checked ? excludedComments.delete(index) : excludedComments.add(index);
        dryRunResult.hidden = true;
        refreshMigrationSelection();
      });
      card.querySelector(".tb-note-card-header").prepend(input);
    });
    const summary = document.createElement("p");
    summary.className = "tb-migration-selection-summary";
    const planned = migrationPlan();
    summary.textContent = globalThis
      .TB_GET_MESSAGE("migration_selection_count")
      .replace("$comments$", planned.comments.length)
      .replace("$files$", planned.files.length);
    selectionPanel.replaceChildren(summary);
    const candidateNotes = notes.filter((_, index) => !excludedComments.has(index));
    const files = TB_MIGRATION_SELECTION.files([previewTextarea.value, ...candidateNotes]);
    if (files.length > 0) {
      const fileList = document.createElement("div");
      fileList.className = "tb-migration-file-list";
      for (const file of files) {
        const label = document.createElement("label");
        label.className = "tb-migration-file-item";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "tb-file-selected";
        input.dataset.fileId = file.id;
        input.checked = !excludedFiles.has(file.id);
        input.addEventListener("change", () => {
          input.checked ? excludedFiles.delete(file.id) : excludedFiles.add(file.id);
          dryRunResult.hidden = true;
          refreshMigrationSelection();
        });
        label.append(input, document.createTextNode(` ${file.filename}`));
        fileList.append(label);
      }
      selectionPanel.append(fileList);
    }
  }

  let migrationMetadataReady = false;
  const validateMigrationForm = () => {
    if (!isMigration) return;
    const isProjectLoaded = projectSelect.options.length > 0 && projectSelect.value;
    const isSubjectValid = migrateSubjectInput.value.trim().length > 0;
    const isTranslationDone = !batchOptionCheckbox.checked || !!memoizedBatchNotes;

    const selectedTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;
    const isDueDateRequired = Boolean(getMigrationDueDateRule(selectedTracker)?.required);
    const isDueDateFilled = !isDueDateRequired || migrateDueDateInput.value;

    const dynamicFields = modalElements.dynamicFieldsContainer.querySelectorAll(".tb-cf-input");
    let allRequiredFilled = true;
    dynamicFields.forEach((input) => {
      if (input.dataset.required !== "false" && !input.value.trim()) {
        allRequiredFilled = false;
      }
    });

    confirmButton.disabled = !(
      migrationMetadataReady &&
      trackerSelect.value &&
      isProjectLoaded &&
      isSubjectValid &&
      isTranslationDone &&
      allRequiredFilled &&
      isDueDateFilled
    );
  };

  let isHtmlMode = false;

  function mergeTranslatedBatchNotes(baseNotes, translatedNotes) {
    if (!Array.isArray(translatedNotes) || translatedNotes.length === 0) {
      return [];
    }

    // memoizedBatchNotes / return value are comment-only (no primary/description).
    const liveCommentNotes = isMigration
      ? Array.isArray(memoizedBatchNotes)
        ? memoizedBatchNotes
        : []
      : Array.isArray(currentNotesList)
        ? currentNotesList.slice(1)
        : [];
    const baselineNotes = Array.isArray(baseNotes) ? baseNotes : [];
    const baselineComments =
      baselineNotes.length === translatedNotes.length ? baselineNotes : baselineNotes.slice(1);

    return translatedNotes.map((translatedNote, index) => {
      const liveNote = liveCommentNotes[index];
      const baselineNote = baselineComments[index];
      const hasUserEdit =
        typeof liveNote === "string" &&
        typeof baselineNote === "string" &&
        liveNote !== baselineNote;

      return hasUserEdit ? liveNote : translatedNote;
    });
  }

  const updatePreviewMode = () => {
    setPreviewMode(previewTextarea, previewHtmlEl, previewToggleBtn, isHtmlMode);
  };

  // Internal state management for the modal
  function updateModalState() {
    if (isMigration) {
      titleEl.textContent = TB.MESSAGES.MODAL.MIGRATE_TITLE;
      setModalSubtitle(subtitleEl, TB.MESSAGES.MODAL.MIGRATE_SUBTITLE(commentsCount));
      previewFieldGroup.hidden = false;
      if (previewLabel) previewLabel.textContent = TB.MESSAGES.MODAL.PREVIEW_DESCRIPTION;
      standardFields.hidden = true;
      migrationFields.hidden = false;

      batchOptionEl.hidden = commentsCount === 0;
      batchOptionText.textContent = TB.MESSAGES.MODAL.MIGRATE_COMMENTS_TEXT(commentsCount);

      migrateSubjectInput.value = migrateSubjectInput.value || issueTitle;
      if (!migrationDescriptionInitialized) {
        previewTextarea.value = previewText;
        migrationDescriptionInitialized = true;
      }
      confirmButton.textContent = TB.MESSAGES.MODAL.MIGRATE_CONFIRM;

      if (batchOptionCheckbox.checked) {
        setCommentsPreviewVisible(true);
        const commentNotes = memoizedBatchNotes || [];
        setCombinedNotesTextareaValue(commentsPreviewTextarea, commentNotes);
        renderStructuredBatchNotes(commentsPreviewList, commentNotes, {
          titlePrefix: TB.MESSAGES.MODAL.NOTE_PREFIX,
          startIndex: 1,
          helperText: TB.MESSAGES.MODAL.WAITING_TRANSLATION,
          targetTextarea: commentsPreviewTextarea,
          onNotesChange: (nextNotes) => {
            memoizedBatchNotes = nextNotes;
            refreshMigrationSelection();
          },
        });
      } else {
        setCommentsPreviewVisible(false);
      }
      validateMigrationForm();
      refreshMigrationSelection();
    } else {
      previewFieldGroup.hidden = true;
      titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
      setModalSubtitle(
        subtitleEl,
        currentMode
          ? TB.MESSAGES.MODAL.BATCH_SUBTITLE_PREPARING(remainingComments.length + 1)
          : TB.MESSAGES.MODAL.SUBTITLE
      );
      standardFields.hidden = false;
      migrationFields.hidden = true;
      setCommentsPreviewVisible(true);
      if (issueTitleLabel) issueTitleLabel.textContent = TB.MESSAGES.MODAL.ISSUE_TITLE_LABEL;

      const primaryNote = currentNotesList[0] || previewText;
      previewTextarea.value = primaryNote;

      if (currentMode) {
        previewTextarea.readOnly = true;
        if (memoizedBatchNotes) {
          const batchNotes = [primaryNote, ...memoizedBatchNotes];
          currentNotesList = batchNotes;
          renderStructuredBatchNotes(commentsPreviewList, batchNotes, {
            titlePrefix: TB.MESSAGES.MODAL.NOTE_PREFIX,
            startIndex: 1,
            targetTextarea: commentsPreviewTextarea,
            onNotesChange: (nextNotes) => {
              currentNotesList = nextNotes;
              memoizedBatchNotes = nextNotes.slice(1);
              setCombinedNotesTextareaValue(commentsPreviewTextarea, memoizedBatchNotes);
            },
          });
        } else {
          const placeholderNotes = [
            primaryNote,
            ...remainingComments.map(() => TB.MESSAGES.MODAL.WAITING_TRANSLATION),
          ];
          pendingBatchNotes = placeholderNotes.slice();
          currentNotesList = placeholderNotes.slice();
          renderStructuredBatchNotes(commentsPreviewList, placeholderNotes, {
            titlePrefix: TB.MESSAGES.MODAL.NOTE_PREFIX,
            startIndex: 1,
            targetTextarea: commentsPreviewTextarea,
            onNotesChange: (nextNotes) => {
              currentNotesList = nextNotes;
            },
          });
        }
      } else {
        previewTextarea.readOnly = false;
        currentNotesList = [primaryNote];
        renderStructuredBatchNotes(commentsPreviewList, currentNotesList, {
          titlePrefix: TB.MESSAGES.MODAL.NOTE_PREFIX,
          startIndex: 1,
          targetTextarea: commentsPreviewTextarea,
          onNotesChange: (nextNotes) => {
            currentNotesList = nextNotes.length ? nextNotes : [""];
            previewTextarea.value = currentNotesList[0] || "";
          },
        });
      }
      confirmButton.textContent = currentMode
        ? TB.MESSAGES.MODAL.BATCH_CONFIRM(remainingComments.length + 1)
        : TB.MESSAGES.MODAL.CONFIRM;
    }
    updatePreviewMode();
  }
  trackerSelect.onchange = () => {
    const selectedTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;
    configureMigrationDueDate(selectedTracker);

    renderTrackerFields(selectedTracker, validateMigrationForm);
    validateMigrationForm();
  };

  migrateDueDateInput.onchange = validateMigrationForm;

  fetchRedmineMetadataForModal(backlogIssueType, backlogMilestone, sourceIssueKey).then(
    (loaded) => {
      if (!loaded) return;
      migrationMetadataReady = true;
      const initialTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;

      configureMigrationDueDate(initialTracker);

      renderTrackerFields(initialTracker, validateMigrationForm);
      validateMigrationForm();
    }
  );

  projectSelect.onchange = (e) => {
    const newProjectId = e.target.value;
    if (newProjectId) {
      updateVersionsDropdown(newProjectId, backlogMilestone);
    }
    validateMigrationForm();
  };
  migrateSubjectInput.oninput = validateMigrationForm;

  if (previewToggleBtn && previewHtmlEl) {
    previewToggleBtn.onclick = () => {
      isHtmlMode = !isHtmlMode;
      updatePreviewMode();
    };

    previewTextarea.oninput = () => {
      refreshMigrationSelection();
      if (isHtmlMode) {
        updatePreviewMode();
      }
      if (!isMigration && !currentMode) {
        currentNotesList = [previewTextarea.value];
      }
    };

    updatePreviewMode();
  }

  /**
   * Update currentNotesList (and memoizedBatchNotes if in batch mode) based on previewTextarea value.
   * This ensures user edits to the preview are reflected when sending to Redmine.
   */
  function updateCurrentNotesFromTextarea() {
    if (isMigration) {
      // In migration mode, previewTextarea is the description; notesList for comments is handled separately.
      return;
    }
    if (!currentNotesList.length) {
      currentNotesList = [previewTextarea.value.trim()];
    }
  }

  if (hasBatchOption || (isMigration && commentsCount > 0)) {
    batchOptionEl.hidden = false;
    batchOptionText.textContent = isMigration
      ? TB.MESSAGES.MODAL.MIGRATE_COMMENTS_TEXT(commentsCount)
      : TB.MESSAGES.MODAL.BATCH_TEXT(remainingComments.length + 1);

    // Migrate: include comments/notes by default when present.
    const shouldEnableComments =
      (isMigration && migrateCommentsByDefault && commentsCount > 0) ||
      (isMigration && Array.isArray(initialBatchNotes) && initialBatchNotes.length > 0);
    batchOptionCheckbox.checked = shouldEnableComments;
    currentMode = shouldEnableComments;

    batchOptionCheckbox.onchange = async (e) => {
      currentMode = e.target.checked;
      updateModalState();

      if (currentMode && !memoizedBatchNotes) {
        confirmButton.disabled = true;
        try {
          const translatedBatchNotes = await translateBatch(remainingComments);
          memoizedBatchNotes = mergeTranslatedBatchNotes(
            pendingBatchNotes || currentNotesList,
            translatedBatchNotes
          );
          pendingBatchNotes = null;
        } catch (err) {
          console.error("[TB-Modal] Batch translation failed:", err);
          const errorMsg = err.error || err.message || TB.MESSAGES.TOAST.TRANSLATION_FAILED;
          showToast(
            globalThis
              .TB_GET_MESSAGE("options_batch_translation_error")
              .replace("$error$", errorMsg),
            "error"
          );
          batchOptionCheckbox.checked = false;
          currentMode = false;
          pendingBatchNotes = null;
        } finally {
          confirmButton.disabled = false;
          updateModalState();
          if (isMigration) validateMigrationForm();
        }
      } else {
        updateModalState();
        if (isMigration) validateMigrationForm();
      }
    };
  } else {
    batchOptionEl.hidden = true;
  }

  issueIdInput.value = redmineIssueId;
  issueTitleInput.value = issueTitle;

  let lastCheckedId = "";
  let issueIdDebounceTimer = null;

  const loadRedmineTitle = async (id) => {
    id = id.trim();
    if (!id || id === lastCheckedId) return;

    lastCheckedId = id;

    if (!/^\d+$/.test(id)) {
      issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NUMERIC_ID;
      confirmButton.disabled = true;
      return;
    }

    confirmButton.disabled = false;
    issueTitleInput.value = TB.MESSAGES.MODAL.LOADING_TITLE;

    try {
      const res = await sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: `/issues/${id}.json`,
      });
      if (issueIdInput.value.trim() !== id) return;
      if (res?.data?.issue?.subject) {
        issueTitleInput.value = res.data.issue.subject;
        confirmButton.disabled = false;
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      if (issueIdInput.value.trim() !== id) return;
      issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NOT_FOUND;
      confirmButton.disabled = true;
    }
  };

  issueIdInput.oninput = (e) => {
    clearTimeout(issueIdDebounceTimer);
    const val = e.target.value;
    const trimmed = val.trim();
    if (!trimmed) {
      lastCheckedId = "";
      issueTitleInput.value = "";
      confirmButton.disabled = false;
      return;
    }
    if (/^\d+$/.test(trimmed)) {
      confirmButton.disabled = false;
    }
    issueIdDebounceTimer = setTimeout(() => loadRedmineTitle(val), 350);
  };
  issueIdInput.onblur = (e) => {
    clearTimeout(issueIdDebounceTimer);
    loadRedmineTitle(e.target.value);
  };

  const safeClose = () => {
    if (confirmButton.disabled && modalElements.loadingOverlay?.style.display === "flex") return;
    clearTimeout(issueIdDebounceTimer);
    closeModal();
    onCancel?.();
  };
  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;
  overlay.onclick = (e) => {
    if (e.target === overlay) safeClose();
  };

  dryRunButton.onclick = () => {
    if (isMigration) {
      const plannedComments = migrationPlan().comments;
      const nonempty = plannedComments.filter((note) => String(note || "").trim());
      const project = projectSelect.selectedOptions[0]?.textContent?.trim() || "";
      const warning = confirmButton.disabled
        ? globalThis.TB_GET_MESSAGE("modal_dry_run_missing_fields")
        : !batchOptionCheckbox.checked && commentsCount > 0
          ? globalThis
              .TB_GET_MESSAGE("modal_dry_run_comments_excluded")
              .replace("$count$", String(commentsCount))
          : "";
      showDryRunResult({
        action: globalThis.TB_GET_MESSAGE("modal_dry_run_create_issue"),
        target: project,
        count: 1 + nonempty.length,
        skipped: plannedComments.length - nonempty.length,
        warning,
      });
      return;
    }
    updateCurrentNotesFromTextarea();
    const notes = currentNotesList.filter((note) => String(note || "").trim());
    showDryRunResult({
      action: globalThis.TB_GET_MESSAGE("modal_dry_run_send_comments"),
      target: issueIdInput.value.trim(),
      count: notes.length,
      skipped: currentNotesList.length - notes.length,
      warning:
        !issueIdInput.value.trim() || !notes.length
          ? globalThis.TB_GET_MESSAGE("modal_dry_run_missing_fields")
          : "",
    });
  };

  confirmButton.onclick = async () => {
    setModalLoading(true);
    confirmButton.disabled = true;
    try {
      if (isMigration) {
        const custom_fields = [];
        const dynamicInputs = modalElements.dynamicFieldsContainer.querySelectorAll(".tb-cf-input");
        dynamicInputs.forEach((input) => {
          const value = input.tagName === "SELECT" ? input.value : input.value.trim();
          if (value || input.dataset.required !== "false") {
            custom_fields.push({ id: Number(input.dataset.cfId), value });
          }
        });

        const issueData = {
          project_id: projectSelect.value,
          tracker_id: trackerSelect.value,
          priority_id: prioritySelect.value,
          fixed_version_id: versionSelect.value, // Added Target Version
          subject: migrateSubjectInput.value.trim(),
          description: migrationPlan().description,
          due_date: migrateDueDateInput.value,
          custom_fields,
        };
        if (!issueData.project_id) {
          showToast(TB.MESSAGES.MODAL.ERROR_SELECT_PROJECT, "error");
          confirmButton.disabled = false;
          setModalLoading(false);
          return;
        }
        // When migrate comments is enabled, require translated notes before create.
        let comments = [];
        if (batchOptionCheckbox.checked) {
          comments = migrationPlan().comments;
          if (commentsCount > 0 && !memoizedBatchNotes) {
            showToast(TB.MESSAGES.TOAST.EMPTY_COMMENT, "error");
            confirmButton.disabled = false;
            setModalLoading(false);
            return;
          }
        }
        await onConfirm({
          issueData,
          comments,
          selection: migrationPlan().selection,
        });
      } else {
        const id = issueIdInput.value.trim();
        if (!id) {
          showToast(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID, "error");
          confirmButton.disabled = false;
          setModalLoading(false);
          return;
        }
        updateCurrentNotesFromTextarea();
        const noteIndexes = currentNotesList
          .map((note, index) => (String(note || "").trim() ? index : -1))
          .filter((index) => index >= 0);
        const notesList = noteIndexes.map((index) => currentNotesList[index]);
        if (!notesList.length) {
          showToast(TB.MESSAGES.TOAST.EMPTY_COMMENT, "error");
          confirmButton.disabled = false;
          setModalLoading(false);
          return;
        }
        await onConfirm({ redmineIssueId: id, notesList, noteIndexes });
      }
      // openSuccessModal (from onConfirm) owns overlay visibility — do not closeModal here.
      setModalLoading(false);
    } catch (err) {
      console.error("[TB-Modal] Confirm failed:", err);
      showToast(err?.error || err?.message || TB.MESSAGES.TOAST.SEND_FAILED, "error");
      confirmButton.disabled = false;
      setModalLoading(false);
    }
  };

  updateModalState();
  modalElements.confirmModal.style.display = "flex";
  modalElements.successModal.style.display = "none";
  overlay.style.display = "flex";
  document.body.classList.add("tb-modal-open");
  closeButton.focus();
}

function parseNotePreviewText(value) {
  const text = (value || "").trim();
  if (!text) return [];
  NOTE_SEPARATOR_REGEX.lastIndex = 0;
  if (!NOTE_SEPARATOR_REGEX.test(text)) {
    return [text];
  }
  NOTE_SEPARATOR_REGEX.lastIndex = 0;
  return text
    .split(NOTE_SEPARATOR_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);
}

function openBacklogModal({
  backlogIssueKey = "",
  previewText = "",
  attachments = [],
  onCancel,
  onConfirm,
}) {
  modalPreviousFocus = document.activeElement;
  ensureModalShell();
  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdInput,
    issueIdLabel,
    issueTitleInput,
    issueTitleLabel,
    previewTextarea,
    confirmButton,
    dryRunButton,
    dryRunResult,
    backlogSuggestionsEl,
    previewLabel,
  } = modalElements;
  dryRunResult.hidden = true;
  const previewHtmlEl = overlay.querySelector("#tb-redmine-preview-html");
  const previewToggleBtn = overlay.querySelector("#tb-preview-toggle");

  let isHtmlMode = false;

  const updatePreviewMode = () => {
    setPreviewMode(previewTextarea, previewHtmlEl, previewToggleBtn, isHtmlMode);
  };

  titleEl.textContent = TB.MESSAGES.MODAL.BACKLOG_TITLE;
  setModalSubtitle(subtitleEl, TB.MESSAGES.MODAL.BACKLOG_SUBTITLE);
  issueIdLabel.textContent = TB.MESSAGES.MODAL.BACKLOG_ISSUE_KEY_LABEL;
  if (issueTitleLabel) issueTitleLabel.textContent = TB.MESSAGES.MODAL.BACKLOG_ISSUE_TITLE_LABEL;
  if (previewLabel) previewLabel.textContent = TB.MESSAGES.MODAL.PREVIEW_LABEL;
  issueIdInput.value = backlogIssueKey;
  issueTitleInput.value = "";
  issueTitleInput.readOnly = false;
  previewTextarea.value = previewText;

  if (attachments.length > 0) {
    const attachmentText = attachments
      .map((attachment) => `[${attachment.filename}](${attachment.url})`)
      .join("\n");
    previewTextarea.value = `${previewText}\n\n${attachmentText}`.trim();
  }

  let backlogUsers = [];
  let mentionTimeout = null;
  let autoNotifyUserIds = [];
  const selectedUserIds = []; // Track users selected from suggestion dropdown

  function findMentionsInText(text) {
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({ username: match[1], position: match.index });
    }
    return mentions;
  }

  // Redmine displays a user's full name in a mention, while Backlog resolves
  // mentions by the project's userId. Normalize known names before posting so
  // Backlog can render the mention as a profile link and notify the user.
  function normalizeBacklogMentions(text) {
    let normalized = String(text || "");
    const users = backlogUsers
      .filter((user) => user?.userId && user?.name)
      .sort((a, b) => String(b.name).length - String(a.name).length);

    users.forEach((user) => {
      const userId = String(user.userId).trim();
      const name = String(user.name).trim();
      if (!userId || !name || name.toLowerCase() === userId.toLowerCase()) return;
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      normalized = normalized.replace(
        new RegExp(`(^|\\s)@${escapedName}(?=\\s|$|[.,!?])`, "gi"),
        `$1@${userId}`
      );
    });
    return normalized;
  }

  function updateAutoNotify() {
    const normalizedText = normalizeBacklogMentions(previewTextarea.value);
    if (normalizedText !== previewTextarea.value) {
      previewTextarea.value = normalizedText;
    }
    autoNotifyUserIds = [];
    const mentions = findMentionsInText(previewTextarea.value);

    mentions.forEach((mention) => {
      const matchedUser = backlogUsers.find(
        (user) =>
          user &&
          user.name &&
          (user.userId || user.id) &&
          ((user.userId && user.userId.toLowerCase() === mention.username.toLowerCase()) ||
            user.name.toLowerCase().includes(mention.username.toLowerCase()))
      );
      if (
        matchedUser &&
        matchedUser.id !== null &&
        matchedUser.id !== "" &&
        !autoNotifyUserIds.includes(String(matchedUser.id))
      ) {
        autoNotifyUserIds.push(String(matchedUser.id));
      }
    });

    if (autoNotifyUserIds.length > 0) {
      backlogSuggestionsEl.innerHTML = autoNotifyUserIds
        .map((id) => {
          const user = backlogUsers.find((item) => String(item.id) === id);
          return user ? renderBacklogUserSuggestion(user) : "";
        })
        .join("");
      return;
    }

    if (backlogUsers.length > 0) {
      backlogSuggestionsEl.replaceChildren();
      const hint = document.createElement("div");
      hint.className = "tb-suggestion-item tb-suggestion-item--muted";
      hint.textContent = globalThis.TB_GET_MESSAGE("modal_no_mention_found");
      backlogSuggestionsEl.appendChild(hint);
    }
  }

  async function loadBacklogUsers(projectKey) {
    try {
      const res = await sendRuntimeMessage({
        type: "GET_BACKLOG_USERS",
        projectKey,
      });
      if (issueIdInput.value.trim() !== projectKey) return;
      backlogUsers = res.data || [];
    } catch (err) {
      console.warn("[TB-MODAL] Failed to load Backlog users:", err);
      if (issueIdInput.value.trim() === projectKey) backlogUsers = [];
    }
  }

  function parseMentionsFromPreview() {
    updateAutoNotify();
  }

  function showUserSuggestions(query) {
    if (backlogUsers.length === 0) {
      backlogSuggestionsEl.replaceChildren();
      const hint = document.createElement("div");
      hint.className = "tb-suggestion-item";
      hint.style.color = "#999";
      hint.textContent = globalThis.TB_GET_MESSAGE("modal_no_users_loaded");
      backlogSuggestionsEl.appendChild(hint);
      return;
    }

    const matchedUsers = query
      ? backlogUsers
          .filter(
            (user) =>
              user &&
              user.name &&
              (user.userId || user.id) &&
              ((user.userId && user.userId.toLowerCase().includes(query.toLowerCase())) ||
                user.name.toLowerCase().includes(query.toLowerCase()))
          )
          .slice(0, 10)
      : backlogUsers.filter((user) => user && user.name && (user.userId || user.id)).slice(0, 10);

    if (matchedUsers.length === 0) {
      if (/\s/.test(query)) {
        parseMentionsFromPreview();
        return;
      }
      backlogSuggestionsEl.replaceChildren();
      const hint = document.createElement("div");
      hint.className = "tb-suggestion-item tb-suggestion-item--muted";
      hint.textContent = globalThis.TB_GET_MESSAGE("modal_no_user_found");
      backlogSuggestionsEl.appendChild(hint);
      return;
    }

    backlogSuggestionsEl.innerHTML = matchedUsers.map(renderBacklogUserSuggestion).join("");

    backlogSuggestionsEl.querySelectorAll(".tb-suggestion-item[data-username]").forEach((item) => {
      item.onclick = () => {
        const username = item.dataset.username;
        const userId = item.dataset.userId; // This is the numeric id
        const loginId = item.dataset.loginId; // This is the login ID for mentions
        const cursorPos = previewTextarea.selectionStart;
        const textBeforeCursor = previewTextarea.value.slice(0, cursorPos);
        const textAfterCursor = previewTextarea.value.slice(cursorPos);
        let mentionText = "";
        if (loginId && loginId.trim() !== "") {
          mentionText = `@${loginId}`;
        } else {
          mentionText = username; // just the name when loginId is not available
        }
        const nextValue = textBeforeCursor.replace(/(^|\s)@([^\n\r@]{0,30})$/, `$1${mentionText} `);
        previewTextarea.value = `${nextValue}${textAfterCursor}`;
        previewTextarea.focus();
        const newCursorPos = nextValue.length;
        previewTextarea.setSelectionRange(newCursorPos, newCursorPos);
        backlogSuggestionsEl.innerHTML = "";

        // Track the selected user ID for notification (always use numeric id)
        if (userId && !selectedUserIds.includes(userId)) {
          selectedUserIds.push(userId);
        }

        parseMentionsFromPreview();
      };
    });
  }

  // Load users when the Backlog issue ID field changes and looks like a valid key
  const loadUsersForIssueKey = (issueKey) => {
    const key = issueKey.trim();
    selectedUserIds.length = 0;
    backlogUsers = [];
    updateAutoNotify();
    // Only attempt to load users if the key looks like a valid project key (contains a dash)
    if (!/^[A-Z0-9_]+-\d+$/.test(key)) {
      // Clear user list but don't show hint - let @ typing trigger suggestions
      backlogUsers = [];
      backlogSuggestionsEl.innerHTML = "";
      updateAutoNotify();
      return;
    }

    loadBacklogUsers(key).then(() => {
      updateAutoNotify();
    });
  };

  // Load users when the issue ID field changes
  issueIdInput.oninput = () => {
    loadUsersForIssueKey(issueIdInput.value);
  };

  backlogSuggestionsEl.innerHTML = "";
  loadUsersForIssueKey(backlogIssueKey);

  updateAutoNotify();

  if (previewToggleBtn && previewHtmlEl) {
    previewToggleBtn.onclick = () => {
      isHtmlMode = !isHtmlMode;
      updatePreviewMode();
    };
    previewTextarea.oninput = () => {
      if (isHtmlMode) {
        updatePreviewMode();
      }
      clearTimeout(mentionTimeout);
      const cursorPos = previewTextarea.selectionStart;
      const textBeforeCursor = previewTextarea.value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/(^|\s)@([^\n\r@]{0,30})$/);
      if (atMatch) {
        mentionTimeout = setTimeout(() => showUserSuggestions(atMatch[2] || ""), 150);
      } else {
        parseMentionsFromPreview();
      }
    };
  }
  isHtmlMode = false;
  updatePreviewMode();

  const loadBacklogIssueInfo = async (key) => {
    key = key.trim();
    if (!key) return;
    try {
      issueTitleInput.value = TB.MESSAGES.MODAL.LOADING_TITLE;
      const res = await sendRuntimeMessage({
        type: "GET_BACKLOG_ISSUE_INFO",
        issueKey: key,
      });
      if (issueIdInput.value.trim() !== key) return;
      if (res?.data?.summary) {
        issueTitleInput.value = `${key} ${res.data.summary}`;
      } else {
        issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NOT_FOUND;
      }
    } catch (err) {
      if (issueIdInput.value.trim() === key) {
        issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NOT_FOUND;
      }
      console.warn("[TB-MODAL] Failed to load Backlog issue info:", err);
    }
  };

  if (backlogIssueKey) {
    loadBacklogIssueInfo(backlogIssueKey);
  }

  issueIdInput.onblur = (e) => loadBacklogIssueInfo(e.target.value);

  const safeClose = () => {
    if (confirmButton.disabled) return;
    clearTimeout(mentionTimeout);
    closeModal();
    onCancel?.();
  };
  modalElements.closeButton.onclick = safeClose;
  modalElements.cancelButton.onclick = safeClose;
  overlay.onclick = (event) => {
    if (event.target === overlay) safeClose();
  };

  modalElements.standardFields.hidden = false;
  modalElements.migrationFields.hidden = true;
  modalElements.backlogFields.hidden = false;
  modalElements.commentsPreviewGroup.hidden = true;
  modalElements.commentsPreviewGroup.style.display = "none";
  modalElements.batchOptionEl.hidden = true;
  confirmButton.disabled = false;

  backlogSuggestionsEl.classList.add("tb-suggestions--inline");
  backlogSuggestionsEl.removeAttribute("style");

  confirmButton.onclick = async () => {
    const key = issueIdInput.value.trim();
    if (!key) {
      showToast(TB.MESSAGES.MODAL.BACKLOG_EMPTY_KEY, "error");
      return;
    }
    setModalLoading(true);
    confirmButton.disabled = true;
    try {
      // Merge auto-detected mentions and manually selected users
      const allNotifyUserIds = [...new Set([...autoNotifyUserIds, ...selectedUserIds])];

      await onConfirm({
        backlogIssueKey: key,
        content: previewTextarea.value,
        notifiedUserId: allNotifyUserIds,
        attachments,
      });
    } catch (err) {
      setModalLoading(false);
      confirmButton.disabled = false;
      showToast(err.message, "error");
    }
  };

  dryRunButton.onclick = () => {
    const content = previewTextarea.value.trim();
    showDryRunResult({
      action: globalThis.TB_GET_MESSAGE("modal_dry_run_send_comments"),
      target: issueIdInput.value.trim(),
      count: content ? 1 : 0,
      warning:
        !issueIdInput.value.trim() || !content
          ? globalThis.TB_GET_MESSAGE("modal_dry_run_missing_fields")
          : attachments.length
            ? globalThis
                .TB_GET_MESSAGE("modal_dry_run_attachments")
                .replace("$count$", String(attachments.length))
            : "",
    });
  };

  modalElements.confirmModal.style.display = "flex";
  modalElements.successModal.style.display = "none";
  overlay.style.display = "flex";
  document.body.classList.add("tb-modal-open");
  modalElements.closeButton.focus();
}

async function openSuccessModal({
  redmineUrl,
  commentCount = 1,
  onClose,
  isBacklog = false,
  forceShow = false,
}) {
  ensureModalShell();
  const {
    overlay,
    successTitleEl,
    successSubtitleEl,
    successLinkEl,
    successHideLabel,
    successHideCheckbox,
    successViewButton,
    successCloseButton,
  } = modalElements;
  // Preference only applies to comment sync; migrate always shows the Redmine link modal.
  if (!isBacklog && !forceShow) {
    try {
      const settingsResponse = await sendRuntimeMessage({ type: "GET_UI_SETTINGS" });
      const settings = settingsResponse.data || settingsResponse;
      if (settings.showRedmineSuccessModal === false) {
        closeModal();
        setModalLoading(false);
        onClose?.();
        const message =
          commentCount > 1
            ? TB.MESSAGES.MODAL.BATCH_TITLE_MULTIPLE(commentCount)
            : TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
        showToast(message, "success");
        return;
      }
    } catch (error) {
      console.warn("[TB-MODAL] Failed to load success modal preference:", error);
    }
  }
  successTitleEl.textContent =
    commentCount > 1
      ? TB.MESSAGES.MODAL.BATCH_TITLE_MULTIPLE(commentCount)
      : isBacklog
        ? TB.MESSAGES.MODAL.BACKLOG_SUCCESS_TITLE
        : TB.MESSAGES.MODAL.SUCCESS_TITLE;
  successSubtitleEl.textContent =
    commentCount > 1
      ? TB.MESSAGES.MODAL.BATCH_SUBTITLE_MULTIPLE
      : isBacklog
        ? TB.MESSAGES.MODAL.BACKLOG_SUCCESS_SUBTITLE
        : TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
  successLinkEl.textContent = redmineUrl;
  successLinkEl.href = redmineUrl;
  if (successHideLabel && successHideCheckbox) {
    successHideCheckbox.checked = false;
    // Hide preference toggle on migrate / Backlog flows — setting is comment-sync only.
    successHideLabel.hidden = isBacklog || forceShow;
    successHideCheckbox.onchange = async () => {
      if (!successHideCheckbox.checked) return;
      try {
        await chrome.storage.local.set({ showRedmineSuccessModal: false });
      } catch (error) {
        console.warn("[TB-MODAL] Failed to save success modal preference:", error);
      }
    };
  }
  successViewButton.textContent = isBacklog
    ? TB.MESSAGES.MODAL.BACKLOG_SUCCESS_VIEW_BUTTON
    : TB.MESSAGES.MODAL.SUCCESS_VIEW_BUTTON;
  successViewButton.onclick = () => {
    window.open(redmineUrl, "_blank");
    closeModal();
  };
  successCloseButton.onclick = () => {
    closeModal();
    onClose?.();
  };
  modalElements.confirmModal.style.display = "none";
  modalElements.successModal.style.display = "flex";
  overlay.style.display = "flex";
  setModalLoading(false);
  document.body.classList.add("tb-modal-open");
  successCloseButton.focus();
}

async function fetchRedmineMetadataForModal(
  backlogIssueType,
  backlogMilestone,
  sourceIssueKey = ""
) {
  const requestId = ++modalMetadataRequestId;
  const { projectSelect, trackerSelect, prioritySelect, versionSelect } = modalElements;
  try {
    const [settings, projectsRes, trackersRes, prioritiesRes] = await Promise.all([
      sendRuntimeMessage({ type: "GET_UI_SETTINGS", issueKey: sourceIssueKey }),
      sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: "/projects.json?limit=100",
      }).catch((e) => ({ error: e.message, data: { projects: [] } })),
      sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: "/trackers.json" }).catch(
        (e) => ({ error: e.message, data: { trackers: [] } })
      ),
      sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: "/enumerations/issue_priorities.json",
      }).catch(() => ({ data: { issue_priorities: [] } })),
    ]);

    if (requestId !== modalMetadataRequestId) return false;
    redmineSettings = settings.data || settings;
    customFieldsMetadata = [];

    replaceSelectOptions(
      projectSelect,
      projectsRes.data?.projects || [],
      (project) => project.name,
      (project) => project.id
    );
    if (redmineSettings?.defaultProjectId) projectSelect.value = redmineSettings.defaultProjectId;

    // Load versions for the default project
    if (projectSelect.value) {
      updateVersionsDropdown(projectSelect.value, backlogMilestone);
    }

    replaceSelectOptions(
      trackerSelect,
      trackersRes.data?.trackers || [],
      (tracker) => tracker.name,
      (tracker) => tracker.id
    );

    // Detect tracker from backlogIssueType
    const aliases =
      redmineSettings?.syncRules?.trackerAliases?.[String(backlogIssueType || "").toLowerCase()];
    const mappedTracker = aliases
      ? aliases.find((name) =>
          Array.from(trackerSelect.options).some(
            (option) => option.text.toLowerCase() === name.toLowerCase()
          )
        ) || ""
      : getMappedTrackerName(backlogIssueType || "");
    const matchedOption = Array.from(trackerSelect.options).find(
      (opt) => opt.text.toLowerCase() === mappedTracker.toLowerCase()
    );
    const qaFallbackOption =
      !matchedOption && ["Q/A", "Q&A"].includes(mappedTracker)
        ? Array.from(trackerSelect.options).find((opt) =>
            ["q/a", "q&a", "qa"].includes(opt.text.toLowerCase())
          )
        : null;

    if (matchedOption) {
      trackerSelect.value = matchedOption.value;
    } else if (qaFallbackOption) {
      trackerSelect.value = qaFallbackOption.value;
    } else {
      // Fallback to Task
      const taskOption = Array.from(trackerSelect.options).find((opt) => opt.text === "Task");
      if (taskOption) {
        trackerSelect.value = taskOption.value;
      }
    }

    replaceSelectOptions(
      prioritySelect,
      prioritiesRes.data?.issue_priorities || [],
      (priority) => priority.name,
      (priority) => priority.id,
      (priority) => priority.is_default
    );
    return true;
  } catch (error) {
    showToast(`${TB.MESSAGES.MODAL.ERROR_METADATA}: ${error.message}`, "error");
    return false;
  }
}

async function updateVersionsDropdown(projectId, backlogMilestone) {
  const { versionSelect } = modalElements;
  versionSelect.innerHTML = `<option value="">${TB.MESSAGES.MODAL.VERSION_LOADING}</option>`;
  try {
    const versionsRes = await sendRuntimeMessage({
      type: "FETCH_REDMINE_METADATA",
      endpoint: `/projects/${projectId}/versions.json`,
    });
    const versions = versionsRes.data?.versions || [];
    if (modalElements.projectSelect.value !== String(projectId)) return;
    versionSelect.innerHTML = `<option value="">${TB.MESSAGES.MODAL.VERSION_EMPTY}</option>`;
    versions.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      // Auto-select if version name matches Backlog milestone
      if (backlogMilestone && v.name.toLowerCase().includes(backlogMilestone.toLowerCase())) {
        opt.selected = true;
      }
      versionSelect.appendChild(opt);
    });
  } catch (err) {
    versionSelect.innerHTML = `<option value="">${TB.MESSAGES.MODAL.VERSION_ERROR}</option>`;
  }
}

function renderTrackerFields(trackerName, validateCallback) {
  const container = modalElements.dynamicFieldsContainer;
  container.replaceChildren();
  const configured =
    globalThis.TB_CUSTOM_FIELDS.normalize(redmineSettings?.customFields) ||
    globalThis.TB_CUSTOM_FIELDS.legacy(redmineSettings?.manualFields);
  const fields = configured.filter(
    (field) =>
      !field.trackers.length ||
      field.trackers.some((name) => name.toLowerCase() === String(trackerName || "").toLowerCase())
  );
  container.style.display = fields.length ? "grid" : "none";
  container.className = "tb-field-grid";
  for (const field of fields) {
    const group = document.createElement("div");
    group.className = "tb-field-group";
    const label = document.createElement("label");
    label.textContent = field.name;
    if (field.required) {
      const star = document.createElement("span");
      star.className = "tb-required";
      star.textContent = "*";
      label.append(star);
    }
    const input = document.createElement(field.type === "select" ? "select" : "input");
    input.className = "tb-cf-input";
    input.dataset.cfId = field.id;
    input.dataset.required = String(field.required);
    if (field.type === "select") {
      input.add(new Option("--", ""));
      field.options.forEach((value) => input.add(new Option(value, value)));
    }
    input.value = field.defaultValue;
    input.addEventListener(field.type === "select" ? "change" : "input", validateCallback);
    label.append(input);
    group.append(label);
    container.append(group);
  }
}

function getMigrationDueDateRule(tracker) {
  const rules =
    redmineSettings?.syncRules?.dueDateRules ||
    globalThis.TB_SYNC_RULES?.defaults.dueDateRules ||
    {};
  return Object.entries(rules).find(
    ([name]) => name.toLowerCase() === String(tracker || "").toLowerCase()
  )?.[1];
}

function configureMigrationDueDate(tracker) {
  const rule = getMigrationDueDateRule(tracker);
  const { migrateDueDateInput, migrateDueDateLabel, migrateDueDateGroup } = modalElements;
  migrateDueDateInput.value = rule?.workingDays ? getPlus3WorkingDays(rule.workingDays) : "";
  migrateDueDateLabel.textContent = TB.MESSAGES.MODAL.DUE_DATE_LABEL;
  if (rule?.required) {
    const star = document.createElement("span");
    star.className = "tb-required";
    star.textContent = "*";
    migrateDueDateLabel.append(star);
  }
  migrateDueDateGroup.style.display = "block";
}

function getPlus3WorkingDays(days = 3) {
  const d = new Date();
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  // Use local ISO format YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Global for scripts loaded via manifest
globalThis.TB_MODAL = { openConfirmModal, openBacklogModal, openSuccessModal };

function getMappedTrackerName(backlogType) {
  if (!backlogType) return "";
  const type = backlogType.toLowerCase().trim();
  if (type === "qa" || type === "q/a" || type === "q&a") return "Q/A";
  if (type === "bug" || type === "バグ" || type === "不具合") return "Bug";
  if (type === "cr") return "CR";
  if (
    type === "task" ||
    type === "タスク" ||
    type === "課題" ||
    type.startsWith("要望") ||
    type.includes("実装")
  ) {
    return "Task";
  }
  return backlogType;
}
