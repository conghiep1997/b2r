/**
 * Styles module for Backlog2Redmine Extension.
 */

function syncInjectedTheme() {
  try {
    const apply = (pref) => {
      const theme = pref || "system";
      const resolved =
        theme === "system"
          ? typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      document.documentElement.dataset.tbTheme = resolved;
    };
    if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
      chrome.storage.local.get("themePreference", (res) => {
        apply(res?.themePreference);
      });
      if (!globalThis.__tbThemeListenerAttached && chrome.storage?.onChanged?.addListener) {
        globalThis.__tbThemeListenerAttached = true;
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === "local" && changes.themePreference) {
            apply(changes.themePreference.newValue);
          }
        });
        if (typeof matchMedia === "function") {
          matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            chrome.storage.local.get("themePreference", (res) => {
              if (!res?.themePreference || res.themePreference === "system") {
                apply("system");
              }
            });
          });
        }
      }
    } else {
      apply("system");
    }
  } catch (_err) {
    // Ignore theme sync errors in restricted contexts.
  }
}

function injectStyles() {
  syncInjectedTheme();
  if (document.getElementById("tb-injected-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "tb-injected-styles";
  style.textContent = `
    .tb-redmine-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 8px;
      padding: 0 12px;
      height: 30px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
      overflow: hidden;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      user-select: none;
    }
    .tb-redmine-btn:hover {
      border-color: #3e5ba3;
      color: #3e5ba3;
      background: #eef2f9;
    }
    .tb-redmine-btn:active {
      background: #e2e8f0;
    }
    .tb-redmine-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .tb-redmine-btn svg { width: 15px; height: 15px; flex-shrink: 0; }

    :root[data-tb-theme="dark"] .tb-redmine-btn {
      background: #1e293b;
      color: #f8fafc;
      border-color: #334155;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    :root[data-tb-theme="dark"] .tb-redmine-btn:hover {
      background: #27354a;
      border-color: #9bb4f5;
      color: #9bb4f5;
    }

    .tb-backlog-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 10px !important;
      color: #3e5ba3 !important;
      font-weight: bold;
      vertical-align: middle;
      cursor: pointer;
      text-decoration: none !important;
    }
    .tb-backlog-btn:hover { color: #324b88 !important; text-decoration: underline !important; }
    .tb-backlog-btn svg { width: 14px; height: 14px; fill: currentColor; }

    /* Modal Overlay */
    .tb-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 2147483640;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    /* Modal Container */
    .tb-modal-container {
      width: 100%;
      max-width: 950px;
      max-height: calc(100vh - 40px);
      max-height: calc(100dvh - 40px);
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.18), 0 8px 10px -6px rgba(15, 23, 42, 0.1);
      border: 1px solid #e2e8f0;
      overflow: hidden;
      animation: tb-modal-in 0.25s cubic-bezier(0.2, 0, 0, 1);
    }
    .tb-modal-content {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .tb-modal-body {
      flex: 1 1 auto;
    }

    @keyframes tb-modal-in {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Modal Header */
    .tb-modal-header {
      padding: 10px 24px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
    }

    .tb-modal-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .tb-modal-close {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      border: none !important;
      border-radius: 6px;
      box-shadow: none !important;
      font-size: 24px;
      color: #64748b !important;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: background 0.2s, color 0.2s;
    }
    .tb-modal-close svg,
    .tb-monthly-log-close svg {
      width: 18px;
      height: 18px;
      display: block;
      fill: currentColor;
    }
    .tb-user-icon,
    .tb-total-icon,
    .tb-bulk-activity-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      vertical-align: middle;
      flex-shrink: 0;
    }
    .tb-user-icon svg,
    .tb-total-icon svg,
    .tb-bulk-activity-icon svg {
      width: 14px;
      height: 14px;
      display: block;
      fill: currentColor;
      flex-shrink: 0;
    }
    .tb-modal-close:hover {
      background: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .tb-modal-close:focus {
      outline: none;
    }
    .tb-modal-close:focus-visible {
      outline: 2px solid #3e5ba3;
      outline-offset: -1px;
    }

    /* Modal Body */
    .tb-modal-body { min-height: 0; padding: 8px 18px; overflow-y: auto; }
    .tb-modal-subtitle { font-size: 12px; color: #64748b; margin-top: -6px; margin-bottom: 8px; }
    .tb-modal-subtitle[hidden],
    .tb-modal-container [hidden],
    .tb-monthly-log-dialog [hidden],
    .tb-monthly-total-summary[hidden],
    .tb-bulk-activity-toolbar[hidden] { display: none !important; }

    /* Fields */
    .tb-field-group { margin-bottom: 6px; }
    .tb-field-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 6px; }
    .tb-field-group label { display: block; font-size: 11.5px; font-weight: 600; color: #334155; margin-bottom: 3px; }
    .tb-field-group input, .tb-field-group select, .tb-field-group textarea {
      width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; color: #1e293b; transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .tb-field-group input:focus, .tb-field-group select:focus, .tb-field-group textarea:focus {
      outline: none; border-color: #3e5ba3; box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.18);
    }
    .tb-field-group input[readonly], .tb-field-group textarea[readonly] { background: #f1f5f9; color: #64748b; }
    .tb-multiline-input { resize: none; overflow-y: auto; line-height: 1.4; min-height: 48px; }
    .tb-preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; }
    .tb-preview-header label { margin-bottom: 0; display: inline-flex; align-items: center; line-height: 1; }
    .tb-preview-toggle {
      background: #eef2f9; border: 1px solid #cbd5e1; border-radius: 6px;
      min-width: 90px; height: 28px; padding: 0 12px;
      cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1;
      color: #3e5ba3;
      display: inline-flex; align-items: center; justify-content: center;
      text-align: center; box-sizing: border-box; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .tb-preview-toggle:hover { background: #e2e8f0; border-color: #3e5ba3; color: #324b88; }
    .tb-preview-toggle:active { background: #cbd5e1; }
    .tb-preview-container { position: relative; }
    .tb-preview-container textarea, .tb-preview-container .tb-preview-html { width: 100%; min-height: 180px; font-family: inherit; line-height: 1.55; font-size: 13px; box-sizing: border-box; }
    .tb-preview-html { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; overflow-y: auto; display: none; color: #1e293b; word-break: break-word; }
    .tb-preview-html > :first-child { margin-top: 0; }
    .tb-preview-html > :last-child { margin-bottom: 0; }
    .tb-preview-html p { margin: 0 0 10px; }
    .tb-preview-html h1 { font-size: 1.5em; margin: 0.75em 0 0.45em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em; }
    .tb-preview-html h2 { font-size: 1.3em; margin: 0.7em 0 0.4em; }
    .tb-preview-html h3 { font-size: 1.1em; margin: 0.65em 0 0.35em; }
    .tb-preview-html strong { font-weight: 700; }
    .tb-preview-html em { font-style: italic; }
    .tb-preview-html del { color: #64748b; }
    .tb-preview-html code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.95em; }
    .tb-preview-html pre { margin: 10px 0; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; white-space: pre-wrap; word-break: break-word; }
    .tb-preview-html pre code { background: transparent; color: inherit; padding: 0; border-radius: 0; }
    .tb-preview-html ul, .tb-preview-html ol { margin: 8px 0 10px; padding-left: 24px; }
    .tb-preview-html ul li { list-style: disc; }
    .tb-preview-html ol li { list-style: decimal; }
    .tb-preview-html li { margin: 3px 0; padding-left: 2px; }
    .tb-preview-html .tb-task-list { padding-left: 0; }
    .tb-preview-html .tb-task-list-item { display: flex; align-items: flex-start; gap: 7px; margin-left: 0; list-style: none; }
    .tb-preview-html .tb-task-list-item input { width: 14px; height: 14px; margin: 3px 0 0; flex: 0 0 auto; }
    .tb-preview-html blockquote { margin: 10px 0; border-left: 3px solid #3e5ba3; padding: 6px 0 6px 12px; color: #475569; background: #f8fafc; }
    .tb-preview-html a { color: #3e5ba3; text-decoration: underline; text-underline-offset: 2px; }
    .tb-preview-html .tb-redmine-collapse { margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; overflow: hidden; }
    .tb-preview-html .tb-redmine-collapse > summary { cursor: pointer; list-style: none; padding: 8px 10px; background: #f8fafc; color: #0f172a; font-weight: 600; font-size: 12px; }
    .tb-preview-html .tb-redmine-collapse > summary::-webkit-details-marker { display: none; }
    .tb-preview-html .tb-redmine-collapse-body { padding: 10px 12px; }
    .tb-preview-html .tb-redmine-attachment { display: inline-block; padding: 1px 6px; border-radius: 4px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.92em; }
    .tb-preview-html hr { border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0; }
    .tb-preview-table-wrap { margin: 10px 0; overflow-x: auto; }
    .tb-preview-html table { width: 100%; border-collapse: collapse; font-size: 12px; background: #ffffff; }
    .tb-preview-html th, .tb-preview-html td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    .tb-preview-html th { background: #f1f5f9; font-weight: 700; color: #334155; }
    #tb-redmine-preview { min-height: 180px; }
    .tb-note-list-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .tb-note-list-label { margin: 0; }
    .tb-note-list { display: grid; gap: 6px; min-height: 180px; align-content: start; }
    .tb-note-list--single { min-height: 240px; }
    .tb-note-list--single .tb-note-card-textarea, .tb-note-list--single .tb-note-card-preview { min-height: 240px; }
    .tb-note-list--scrollable { max-height: min(58vh, 520px); overflow-y: auto; padding-right: 4px; scrollbar-gutter: stable; }
    .tb-note-list-empty { margin: 0; padding: 8px 10px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 12px; }
    .tb-note-card { border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; overflow: hidden; }
    .tb-note-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .tb-note-card-title { margin: 0; font-size: 12px; color: #0f172a; line-height: 1.2; display: inline-flex; align-items: center; }
    .tb-note-card-actions { display: inline-flex; align-items: center; gap: 8px; }
    .tb-note-preview-toggle {
      min-width: 84px; min-height: 28px; padding: 4px 10px;
      border: 1px solid #cbd5e1; border-radius: 7px; background: #ffffff;
      color: #3e5ba3; cursor: pointer; font-size: 12px; font-weight: 700;
      line-height: 1; letter-spacing: 0.01em;
      display: inline-flex; align-items: center; justify-content: center;
      text-align: center; box-sizing: border-box;
    }
    .tb-note-preview-toggle:hover { background: #eef2f9; border-color: #3e5ba3; }
    .tb-note-card-meta { font-size: 11px; color: #64748b; white-space: nowrap; line-height: 1; display: inline-flex; align-items: center; }
    .tb-note-card-textarea { width: 100%; min-height: 132px; border: none; border-radius: 0; resize: vertical; background: #ffffff; box-shadow: none; line-height: 1.35; padding: 8px 10px; }
    .tb-note-card-textarea:focus { box-shadow: inset 0 0 0 1px #3e5ba3; }
    .tb-note-card-preview { min-height: 132px; padding: 8px 10px; background: #ffffff; color: #1e293b; font-size: 13px; line-height: 1.45; overflow-y: auto; word-break: break-word; }
    .tb-note-card-preview > :first-child { margin-top: 0; }
    .tb-note-card-preview > :last-child { margin-bottom: 0; }
    .tb-note-card-preview p { margin: 0 0 8px; }
    .tb-note-card-preview ul, .tb-note-card-preview ol { margin: 6px 0 8px; padding-left: 22px; }
    .tb-note-card-preview pre { margin: 8px 0; padding: 10px; border-radius: 6px; background: #1e293b; color: #e2e8f0; overflow-x: auto; white-space: pre-wrap; }
    .tb-note-card-preview code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; font-family: monospace; }
    .tb-note-card-preview pre code { background: transparent; color: inherit; padding: 0; }
    .tb-note-card-preview blockquote { margin: 8px 0; border-left: 3px solid #3e5ba3; padding-left: 10px; color: #475569; background: #f8fafc; }
    .tb-note-card-preview .tb-redmine-collapse { margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff; overflow: hidden; }
    .tb-note-card-preview .tb-redmine-collapse > summary { cursor: pointer; list-style: none; padding: 6px 8px; background: #f8fafc; color: #0f172a; font-weight: 600; font-size: 11px; }
    .tb-note-card-preview .tb-redmine-collapse > summary::-webkit-details-marker { display: none; }
    .tb-note-card-preview .tb-redmine-collapse-body { padding: 8px 10px; }
    .tb-note-card-preview .tb-redmine-attachment { display: inline-block; padding: 1px 6px; border-radius: 4px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.92em; }

    /* Footer */
    .tb-modal-footer { padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }

    /* Buttons */
    .tb-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
      font-family: inherit;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
      border: 1px solid transparent;
      box-sizing: border-box;
      white-space: nowrap;
      user-select: none;
    }
    .tb-btn:focus {
      outline: none !important;
    }
    .tb-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: 1px !important;
    }
    .tb-btn-primary {
      background: #3e5ba3 !important;
      color: #ffffff !important;
      border: 1px solid #3e5ba3 !important;
      box-shadow: 0 1px 2px rgba(62, 91, 163, 0.2) !important;
    }
    .tb-btn-primary:hover:not(:disabled) {
      background: #324b88 !important;
      border-color: #324b88 !important;
    }
    .tb-btn-primary:active:not(:disabled) {
      background: #273c6f !important;
      border-color: #273c6f !important;
    }
    .tb-btn-primary:disabled {
      background: #e2e8f0 !important;
      color: #94a3b8 !important;
      border-color: #cbd5e1 !important;
      box-shadow: none !important;
      cursor: not-allowed !important;
    }
    .tb-btn-secondary {
      background: #ffffff !important;
      color: #334155 !important;
      border: 1px solid #cbd5e1 !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
    }
    .tb-btn-secondary:hover:not(:disabled) {
      background: #f1f5f9 !important;
      border-color: #94a3b8 !important;
      color: #0f172a !important;
    }
    .tb-btn-secondary:active:not(:disabled) {
      background: #e2e8f0 !important;
    }
    .tb-btn-secondary:disabled {
      background: #f8fafc !important;
      color: #94a3b8 !important;
      border-color: #e2e8f0 !important;
      box-shadow: none !important;
      cursor: not-allowed !important;
    }
    #tb-monthly-log-preview {
      background: #eef2f9 !important;
      color: #3e5ba3 !important;
      border: 1px solid #cbd5e1 !important;
      box-shadow: 0 1px 2px rgba(62, 91, 163, 0.06) !important;
    }
    #tb-monthly-log-preview:hover:not(:disabled) {
      background: #e2e8f0 !important;
      border-color: #3e5ba3 !important;
      color: #324b88 !important;
    }
    #tb-monthly-log-preview:active:not(:disabled) {
      background: #cbd5e1 !important;
    }
    #tb-monthly-log-preview:disabled {
      background: #f8fafc !important;
      color: #94a3b8 !important;
      border-color: #e2e8f0 !important;
      box-shadow: none !important;
    }
    .tb-btn-danger {
      background: #dc2626 !important;
      color: #ffffff !important;
      border: 1px solid #dc2626 !important;
      box-shadow: 0 1px 2px rgba(220, 38, 38, 0.16) !important;
    }
    .tb-btn-danger:hover:not(:disabled) {
      background: #b91c1c !important;
      color: #ffffff !important;
      border-color: #b91c1c !important;
    }
    .tb-btn-danger:active:not(:disabled) {
      background: #991b1b !important;
    }
    .tb-btn-danger:disabled {
      background: #f8fafc !important;
      color: #94a3b8 !important;
      border-color: #e2e8f0 !important;
      box-shadow: none !important;
      cursor: not-allowed !important;
    }
    .tb-success-link-container { margin-top: 8px; }
    .tb-success-link { color: #3e5ba3 !important; text-decoration: underline; word-break: break-all; }
    .tb-success-link:visited { color: #324b88 !important; }
    .tb-success-link:hover { color: #273c6f !important; }
    .tb-success-hide-option { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 12px; color: #475569; cursor: pointer; text-transform: none; font-weight: 600; }
    .tb-success-hide-option input { width: auto; height: auto; margin: 0; }

    /* Toast */
    .tb-toast {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-16px);
      z-index: 2147483647; max-width: 480px; padding: 14px 18px; border-radius: 12px;
      color: #fff; background: rgba(17, 24, 39, 0.96); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      opacity: 0; transition: all 0.2s ease; font-size: 14px; font-weight: 500; text-align: center;
    }
    .tb-toast[data-type="success"] { background: rgba(22, 163, 74, 0.95); }
    .tb-toast[data-type="error"] { background: rgba(220, 38, 38, 0.95); }
    .tb-toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }

    .tb-batch-pill { display: none; padding: 4px 12px; background: #eef2f9; color: #3e5ba3; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
    .tb-modal-hint { font-size: 12px; color: #475569; font-style: italic; margin-top: 8px; display: block; opacity: 0.9; }

    /* Custom Fields Grid */
    .tb-field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0; }
    .tb-field-grid .tb-field-group { margin-bottom: 0; }
    .tb-field-grid input[type="checkbox"] { width: auto; height: auto; margin: 4px 8px 0 0; float: left; }
    .tb-field-grid select.tb-cf-input, .tb-field-grid input.tb-cf-input { margin-top: 2px; }

    .tb-batch-option { margin-top: 6px; margin-bottom: 3px; padding: 6px 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; }
    .tb-batch-option label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #3e5ba3; cursor: pointer; font-weight: 600; }
    .tb-batch-option input { margin: 0; }
    .tb-required { color: #dc2626; margin-left: 2px; font-weight: bold; }

    /* User Suggestions */
    .tb-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      margin-top: 4px;
      display: none;
    }
    .tb-suggestions:not(:empty) { display: block; }
    .tb-suggestion-item {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      color: #1e293b;
      transition: background 0.2s;
    }
    .tb-suggestion-item:hover {
      background: #f1f5f9;
    }
    .tb-suggestion-item:not(:last-child) {
      border-bottom: 1px solid #f1f5f9;
    }

    /* Modal Loading Overlay */
    .tb-modal-loading {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(2px);
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-radius: 20px;
    }
    .tb-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top: 4px solid #3e5ba3;
      border-radius: 50%;
      animation: tb-spin 1s linear infinite;
    }
    @keyframes tb-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .tb-loading-text {
      color: #3e5ba3;
      font-weight: 700;
      font-size: 14px;
    }
    .tb-modal-container { position: relative; }

    .tb-monthly-log-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.58);
      backdrop-filter: blur(3px);
    }
    .tb-monthly-log-dialog {
      width: min(1340px, 96vw);
      height: 86vh;
      min-height: 580px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.18), 0 8px 10px -6px rgba(15, 23, 42, 0.1);
      color: #0f172a;
    }
    .tb-monthly-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .tb-monthly-log-header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex: 1;
      min-width: 0;
      flex-wrap: wrap;
    }
    .tb-monthly-log-title-area {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .tb-monthly-log-kicker-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .tb-monthly-log-kicker {
      margin: 0;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: none;
    }
    .tb-monthly-log-meta-area {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tb-monthly-log-user-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 600;
      color: #475569;
      line-height: 1.4;
      transition: all 0.2s ease;
    }
    .tb-monthly-log-user-badge--loaded {
      background: #eef2f9;
      border-color: #cbd5e1;
      color: #3e5ba3;
    }
    .tb-user-icon {
      font-size: 12px;
      line-height: 1;
    }
    .tb-user-name {
      white-space: nowrap;
    }
    .tb-monthly-log-header h2 {
      margin: 0;
      color: #0f172a;
      font-size: 16.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .tb-monthly-log-status {
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #64748b !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
    }
    .tb-monthly-log-close {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      border: none !important;
      border-radius: 6px;
      box-shadow: none !important;
      font-size: 24px;
      color: #64748b !important;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: background 0.2s, color 0.2s;
    }
    .tb-monthly-log-close:hover {
      background: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .tb-monthly-log-close:focus {
      outline: none;
    }
    .tb-monthly-log-close:focus-visible {
      outline: 2px solid #3e5ba3;
      outline-offset: -1px;
    }
    .tb-monthly-log-close:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .tb-monthly-log-body {
      flex: 1;
      min-height: 0;
      padding: 16px 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tb-monthly-log-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .tb-monthly-log-stats div {
      min-height: 64px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .tb-monthly-log-stats span {
      display: block;
      color: #0f172a;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.1;
    }
    .tb-monthly-log-stats small {
      display: block;
      margin-top: 4px;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
    }
    .tb-monthly-log-grid {
      display: grid;
      grid-template-columns: 290px 1fr;
      gap: 14px;
      flex: 1;
      min-height: 0;
      height: 100%;
    }
    .tb-monthly-log-panel {
      min-width: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .tb-monthly-log-panel-title {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 14px;
      min-height: 42px;
      box-sizing: border-box;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 12.5px;
      font-weight: 600;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .tb-preview-title-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      min-width: 0;
      flex-shrink: 1;
    }
    .tb-preview-title-wrap > span,
    .tb-preview-title-text {
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tb-monthly-total-summary {
      display: inline-flex !important;
      align-items: center !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      gap: 5px !important;
      padding: 2px 8px !important;
      background: #eef2f9 !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px !important;
      font-size: 11.5px !important;
      color: #3e5ba3 !important;
      font-weight: 500 !important;
      text-transform: none !important;
      letter-spacing: normal !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      line-height: 1.4 !important;
      vertical-align: middle !important;
    }
    .tb-monthly-total-summary span,
    .tb-monthly-total-summary strong {
      display: inline-flex !important;
      align-items: center !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      line-height: 1.2 !important;
      margin: 0 !important;
    }
    .tb-monthly-total-summary .tb-total-icon {
      font-size: 13px !important;
      line-height: 1 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #3e5ba3 !important;
      flex-shrink: 0 !important;
    }
    .tb-monthly-total-summary .tb-total-icon svg {
      width: 14px !important;
      height: 14px !important;
      display: block !important;
      fill: currentColor !important;
      flex-shrink: 0 !important;
    }
    .tb-monthly-total-summary .tb-total-label {
      color: #3e5ba3 !important;
      font-weight: 600 !important;
    }
    .tb-monthly-total-summary .tb-total-hours-val {
      color: #3e5ba3 !important;
      font-weight: 700 !important;
      font-size: 12px !important;
    }
    .tb-monthly-total-summary .tb-total-days-val {
      color: #64748b !important;
      font-size: 11px !important;
      font-weight: 500 !important;
    }
    .tb-bulk-activity-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-transform: none;
      font-weight: 400;
      background: #ffffff;
      padding: 3px 4px 3px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tb-bulk-activity-label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 26px;
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      line-height: 1;
    }
    .tb-bulk-activity-icon {
      font-size: 13px;
      line-height: 1;
      color: #3e5ba3;
      display: inline-flex;
      align-items: center;
    }
    .tb-bulk-activity-select {
      height: 26px;
      box-sizing: border-box;
      padding: 0 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
      background: #f8fafc;
      cursor: pointer;
      max-width: 170px;
      line-height: 24px;
      transition: all 0.15s ease;
    }
    .tb-bulk-activity-select:hover {
      border-color: #94a3b8;
      background: #ffffff;
    }
    .tb-bulk-activity-select:focus {
      outline: none;
      border-color: #3e5ba3;
      box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.2);
      background: #ffffff;
    }
    .tb-bulk-activity-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      height: 26px !important;
      box-sizing: border-box !important;
      padding: 0 10px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      border-radius: 4px !important;
      background: #3e5ba3 !important;
      color: #ffffff !important;
      border: 1px solid #3e5ba3 !important;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(62, 91, 163, 0.2) !important;
      transition: all 0.15s ease;
      line-height: 24px !important;
    }
    .tb-bulk-activity-btn:hover:not(:disabled) {
      background: #324b88 !important;
      border-color: #324b88 !important;
      box-shadow: 0 2px 4px rgba(62, 91, 163, 0.3) !important;
    }
    .tb-bulk-activity-btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    .tb-bulk-activity-btn:disabled {
      opacity: 0.55 !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
    }
    .tb-bulk-activity-btn.tb-btn-success {
      background: #16a34a !important;
      border-color: #16a34a !important;
      color: #ffffff !important;
      box-shadow: 0 1px 2px rgba(22, 163, 74, 0.2) !important;
    }
    .tb-monthly-log-progress {
      flex: 1;
      min-height: 0;
      height: 100%;
      margin: 0;
      padding: 12px 14px;
      overflow-y: auto;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.5;
      background: #f8fafc;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tb-monthly-log-progress-empty {
      padding: 32px 12px;
      color: #64748b;
      font-size: 12px;
      text-align: center;
      line-height: 1.6;
    }
    .tb-monthly-log-progress-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      padding: 4px 6px;
      border-radius: 4px;
      border: none;
      font-size: 12px;
      line-height: 1.45;
      color: #334155;
      word-break: break-word;
    }
    .tb-monthly-log-progress-item::before {
      content: "";
      width: 5px;
      height: 5px;
      border-radius: 50%;
      margin-top: 6px;
      flex-shrink: 0;
      background: #94a3b8;
    }
    .tb-monthly-log-progress-item--info {
      color: #334155;
      background: transparent;
      font-family: inherit;
    }
    .tb-monthly-log-progress-item--info::before {
      background: #3e5ba3;
    }
    .tb-monthly-log-progress-item--date {
      margin-top: 6px;
      padding: 5px 8px;
      color: #0f172a;
      background: #eef2f9;
      border-radius: 5px;
      font-weight: 600;
    }
    .tb-monthly-log-progress-item--date::before {
      background: #3e5ba3;
    }
    .tb-monthly-log-progress-item--success,
    .tb-monthly-log-progress-item--skip,
    .tb-monthly-log-progress-item--error {
      padding-left: 10px;
      font-size: 12px;
    }
    .tb-monthly-log-progress-item--success {
      color: #15803d;
      background: rgba(22, 163, 74, 0.08);
    }
    .tb-monthly-log-progress-item--success::before {
      background: #16a34a;
    }
    .tb-monthly-log-progress-item--skip {
      color: #475569;
      background: transparent;
    }
    .tb-monthly-log-progress-item--skip::before {
      background: #94a3b8;
    }
    .tb-monthly-log-progress-item--error {
      color: #b91c1c;
      background: rgba(220, 38, 38, 0.08);
    }
    .tb-monthly-log-progress-item--error::before {
      background: #dc2626;
    }
    .tb-monthly-log-table-wrap {
      flex: 1;
      min-height: 0;
      height: 100%;
      overflow-y: auto;
    }
    .tb-monthly-log-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
    .tb-monthly-log-table col.col-date   { width: 118px; }
    .tb-monthly-log-table col.col-report { width: 230px; }
    .tb-monthly-log-table col.col-tasks  { width: auto; }
    .tb-monthly-log-table col.col-status { width: 104px; }
    .tb-monthly-log-table th, .tb-monthly-log-table td {
      padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top;
    }
    .tb-monthly-log-table th:last-child,
    .tb-monthly-log-table td:last-child {
      text-align: center;
    }
    .tb-monthly-log-table th {
      position: sticky; top: 0; background: #f8fafc; color: #475569; font-weight: 700; z-index: 1;
    }
    .tb-monthly-log-table tfoot td {
      position: sticky;
      bottom: 0;
      background: #f1f5f9;
      border-top: 2px solid #cbd5e1;
      font-size: 12px;
      font-weight: 700;
      z-index: 2;
      color: #1e293b;
      padding: 8px 10px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .tb-cell-total-label {
      text-align: right !important;
      padding-right: 14px !important;
      color: #334155;
      white-space: nowrap;
    }
    .tb-cell-total-hours {
      white-space: nowrap;
    }
    .tb-cell-total-hours .tb-hours-total {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      background: #eef2f9;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      color: #3e5ba3;
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
    }
    .tb-cell-total-days {
      text-align: center !important;
      color: #64748b;
      font-weight: 600;
      font-size: 11.5px;
      white-space: nowrap;
    }
    .tb-monthly-log-table td:nth-child(2) {
      word-break: keep-all;
      overflow-wrap: break-word;
      line-height: 1.45;
    }
    .tb-report-link {
      white-space: nowrap;
      margin-right: 4px;
    }
    .tb-report-subject {
      display: inline;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
    /* Weekend rows */
    .tb-row-weekend td {
      background: #f8fafc;
    }
    .tb-cell-weekend {
      color: #94a3b8;
      font-weight: 500;
    }
    /* Task list & cards */
    .tb-task-list { display: flex; flex-direction: column; gap: 5px; }
    .tb-task-card {
      padding: 6px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tb-task-name {
      font-size: 11.5px;
      font-weight: 500;
      color: #0f172a;
      word-break: break-word;
      line-height: 1.45;
    }
    .tb-task-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 2px;
    }
    .tb-activity-select {
      flex: 1;
      max-width: 220px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 11px;
      color: #3e5ba3;
      background: #eef2f9;
      cursor: pointer;
    }
    .tb-activity-select:focus { outline: 2px solid #3e5ba3; outline-offset: 1px; }
    .tb-task-list-summary {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      padding: 3px 6px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      margin-top: 2px;
      white-space: nowrap;
    }
    .tb-task-summary-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }
    /* Hours badges & inputs */
    .tb-hours-input-wrapper {
      display: inline-flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 5px 0 6px;
      height: 26px;
      box-sizing: border-box;
      gap: 2px;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      flex-shrink: 0;
    }
    .tb-hours-input-wrapper:hover {
      border-color: #94a3b8;
    }
    .tb-hours-input-wrapper:focus-within {
      border-color: #3e5ba3;
      background: #ffffff;
      box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.2);
    }
    .tb-hours-input {
      width: 38px;
      height: 22px;
      border: none;
      outline: none;
      background: transparent;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-align: right;
      padding: 0;
      margin: 0;
      -moz-appearance: textfield;
      font-family: inherit;
    }
    .tb-hours-input::-webkit-outer-spin-button,
    .tb-hours-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .tb-hours-unit {
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      user-select: none;
      line-height: 1;
      padding-bottom: 1px;
    }
    .tb-hours-badge {
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      min-width: 42px; height: 26px;
      font-size: 12px; font-weight: 700; color: #0f172a;
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 2px 6px; text-align: center; white-space: nowrap;
    }
    .tb-hours-total {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 2px 7px; border-radius: 5px; font-size: 11.5px; font-weight: 700;
      background: #eef2f9; color: #3e5ba3; border: 1px solid #cbd5e1;
      white-space: nowrap;
    }
    /* Status badges */
    .tb-status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.3;
      white-space: nowrap;
      text-align: center;
      max-width: 100%;
      box-sizing: border-box;
      cursor: default;
    }
    .tb-status-badge--ready,
    .tb-status-badge--success {
      background: #dcfce7;
      color: #16a34a;
      border: 1px solid #86efac;
    }
    .tb-status-badge--warning {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }
    .tb-status-badge--full {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .tb-status-badge--empty {
      background: #f8fafc;
      color: #94a3b8;
      border: 1px solid #e2e8f0;
    }
    .tb-status-badge--error {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fca5a5;
    }
    /* Warning row overrides */
    .tb-monthly-log-row-warning td { color: #78350f; background: #fef3c7; }
    .tb-monthly-log-row-warning .tb-task-card { background: #fffbeb; border-color: #fde68a; }
    .tb-monthly-log-row-warning .tb-activity-select { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
    .tb-monthly-log-row-warning .tb-hours-badge { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
    .tb-monthly-log-row-warning .tb-hours-total { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
    .tb-monthly-log-row-warning .tb-task-list-summary { background: #fffbeb; border-color: #fde68a; }
    /* Result row styling (after Start runs) */
    .tb-result-row-success td { background: #dcfce7; color: #16a34a; }
    .tb-result-row-partial td { background: #fef3c7; color: #78350f; }
    .tb-monthly-log-table tbody tr:nth-child(even):not(.tb-monthly-log-row-warning):not(.tb-result-row-success):not(.tb-result-row-partial) { background: #f8fafc; }
    /* Clickable issue links */
    .tb-issue-link {
      color: #3e5ba3;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.15s;
    }
    .tb-issue-link:hover {
      color: #324b88;
      text-decoration: underline;
    }
    .tb-monthly-log-row-warning .tb-issue-link {
      color: #3e5ba3;
    }
    .tb-monthly-log-row-warning .tb-issue-link:hover {
      color: #324b88;
    }
    /* Empty state */
    .tb-table-empty-state {
      text-align: center !important;
      padding: 40px 20px !important;
      color: #64748b;
      font-size: 13px;
    }
    .tb-table-empty-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 24px 0;
      color: #94a3b8;
      user-select: none;
    }
    .tb-table-empty-icon svg {
      width: 32px;
      height: 32px;
      display: block;
      fill: currentColor;
      opacity: 0.45;
      margin: auto;
    }
    .tb-table-empty-title {
      margin: 0;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
    }
    .tb-monthly-log-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .tb-monthly-log-footer .tb-btn-danger {
      margin-right: auto;
      background: transparent !important;
      color: #dc2626 !important;
      border: 1px solid rgba(220, 38, 38, 0.35) !important;
      box-shadow: none !important;
      font-weight: 500 !important;
    }
    .tb-monthly-log-footer .tb-btn-danger:hover:not(:disabled) {
      background: rgba(220, 38, 38, 0.08) !important;
      border-color: #dc2626 !important;
      color: #b91c1c !important;
    }
    .tb-monthly-log-footer .tb-btn-danger:disabled {
      background: transparent !important;
      color: #94a3b8 !important;
      border-color: #e2e8f0 !important;
    }
    .tb-preview-notice {
      margin: 0 0 12px;
      color: #64748b;
      font-size: 12px;
    }
    .tb-dry-run-result {
      margin: 0 18px 12px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 13px;
    }
    .tb-migration-selection {
      margin: 8px 0 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 12px;
      color: #334155;
    }
    .tb-migration-selection-summary {
      margin: 0 0 6px;
      font-weight: 600;
      color: #1e293b;
    }
    .tb-migration-file-list {
      max-height: 132px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 4px 12px;
      padding-top: 4px;
      border-top: 1px dashed #cbd5e1;
    }
    .tb-migration-file-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #334155;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tb-suggestions--inline {
      display: block;
      position: relative;
      z-index: 9999;
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      margin-top: 8px;
    }
    .tb-suggestion-item--muted {
      color: #94a3b8 !important;
      cursor: default !important;
    }
    .tb-monthly-log-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .tb-month-picker-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      background: #f8fafc;
      padding: 2px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      gap: 3px;
      vertical-align: middle;
    }
    .tb-month-display-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      height: 28px !important;
      line-height: 26px !important;
      margin: 0 !important;
      padding: 0 10px !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-size: 12.5px !important;
      font-weight: 600 !important;
      font-family: inherit !important;
      cursor: pointer !important;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      box-shadow: none !important;
      user-select: none !important;
    }
    .tb-month-display-btn:hover:not(:disabled) {
      border-color: #3e5ba3 !important;
      background: #f8fafc !important;
      color: #3e5ba3 !important;
    }
    .tb-month-display-btn:focus { outline: none !important; }
    .tb-month-display-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    .tb-month-display-btn:disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
    }
    .tb-month-display-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #3e5ba3;
      line-height: 1;
      flex-shrink: 0;
    }
    .tb-month-display-icon svg {
      width: 14px;
      height: 14px;
      display: block;
      fill: currentColor;
      flex-shrink: 0;
    }
    .tb-month-display-text {
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .tb-month-display-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      line-height: 1;
      margin-left: 2px;
      transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
      flex-shrink: 0;
    }
    .tb-month-display-arrow svg {
      width: 14px;
      height: 14px;
      display: block;
      fill: currentColor;
      flex-shrink: 0;
    }
    .tb-month-display-btn[aria-expanded="true"] .tb-month-display-arrow {
      transform: rotate(180deg);
      color: #3e5ba3;
    }
    .tb-month-popover {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 1000;
      width: 264px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.14), 0 4px 10px -4px rgba(15, 23, 42, 0.06);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      user-select: none;
      box-sizing: border-box;
      animation: tbPopoverFadeIn 0.14s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tb-month-popover[hidden] {
      display: none !important;
    }
    .tb-popover-year-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2px 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tb-popover-year-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      min-width: 28px !important;
      max-width: 28px !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 1px solid transparent !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: #475569 !important;
      box-shadow: none !important;
      cursor: pointer !important;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      line-height: 1 !important;
    }
    .tb-popover-year-btn:hover {
      background: #f1f5f9 !important;
      border-color: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .tb-popover-year-btn:focus {
      outline: none !important;
    }
    .tb-popover-year-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    .tb-popover-year-btn svg {
      width: 18px !important;
      height: 18px !important;
      display: block !important;
      margin: auto !important;
      fill: currentColor !important;
      flex-shrink: 0 !important;
      pointer-events: none !important;
    }
    .tb-popover-year-text {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.01em;
    }
    .tb-popover-month-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 2px 0;
    }
    .tb-popover-month-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      height: 32px !important;
      padding: 0 6px !important;
      margin: 0 !important;
      font-size: 12.5px !important;
      font-weight: 500 !important;
      font-family: inherit !important;
      color: #334155 !important;
      background: transparent !important;
      border: 1px solid transparent !important;
      border-radius: 6px !important;
      box-shadow: none !important;
      cursor: pointer !important;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
      box-sizing: border-box !important;
      line-height: 1.2 !important;
      white-space: nowrap !important;
    }
    .tb-popover-month-btn:hover:not(.tb-popover-month-btn--active) {
      background: #f1f5f9 !important;
      color: #0f172a !important;
      border-color: transparent !important;
    }
    .tb-popover-month-btn:focus {
      outline: none !important;
    }
    .tb-popover-month-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    .tb-popover-month-btn--current {
      border-color: #cbd5e1 !important;
      color: #3e5ba3 !important;
      font-weight: 600 !important;
      background: #f8fafc !important;
    }
    .tb-popover-month-btn--active {
      background: #3e5ba3 !important;
      border-color: #3e5ba3 !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      box-shadow: 0 1px 2px rgba(62, 91, 163, 0.25) !important;
    }
    .tb-popover-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      gap: 6px;
    }
    .tb-popover-quick-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      height: 26px !important;
      padding: 0 8px !important;
      margin: 0 !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      font-family: inherit !important;
      color: #3e5ba3 !important;
      background: transparent !important;
      border: 1px solid transparent !important;
      border-radius: 5px !important;
      box-shadow: none !important;
      cursor: pointer !important;
      transition: background 0.15s ease, color 0.15s ease !important;
    }
    .tb-popover-quick-btn:hover {
      background: #eef2f9 !important;
      color: #324b88 !important;
    }
    .tb-popover-quick-btn:focus {
      outline: none !important;
    }
    .tb-popover-quick-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    #tb-popover-close-btn {
      color: #64748b !important;
      font-weight: 500 !important;
    }
    #tb-popover-close-btn:hover {
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }
    @keyframes tbPopoverFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .tb-month-nav-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      min-width: 28px !important;
      max-width: 28px !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 1px solid #cbd5e1 !important;
      background: #ffffff !important;
      color: #334155 !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      line-height: 1 !important;
      vertical-align: middle !important;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
      flex-shrink: 0 !important;
    }
    .tb-month-nav-btn svg {
      display: block !important;
      width: 18px !important;
      height: 18px !important;
      margin: auto !important;
      pointer-events: none !important;
      flex-shrink: 0 !important;
      fill: currentColor !important;
    }
    .tb-month-nav-btn:hover:not(:disabled) {
      background: #eef2f9 !important;
      border-color: #3e5ba3 !important;
      color: #3e5ba3 !important;
    }
    .tb-month-nav-btn:focus { outline: none !important; }
    .tb-month-nav-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    .tb-month-nav-btn:disabled {
      opacity: 0.4 !important;
      cursor: not-allowed !important;
    }
    .tb-month-today-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      padding: 0 10px !important;
      height: 28px !important;
      line-height: 26px !important;
      border: 1px solid #cbd5e1 !important;
      background: #ffffff !important;
      color: #3e5ba3 !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      font-family: inherit !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
      box-shadow: none !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      flex-shrink: 0 !important;
    }
    .tb-month-today-btn:hover:not(:disabled) {
      background: #eef2f9 !important;
      border-color: #3e5ba3 !important;
      color: #324b88 !important;
    }
    .tb-month-today-btn:focus { outline: none !important; }
    .tb-month-today-btn:focus-visible {
      outline: 2px solid #3e5ba3 !important;
      outline-offset: -1px !important;
    }
    .tb-month-today-btn:disabled {
      opacity: 0.4 !important;
      cursor: not-allowed !important;
    }
    .tb-monthly-log-month-input {
      display: inline-flex;
      align-items: center;
      height: 28px;
      line-height: 26px;
      margin: 0;
      padding: 0 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
      vertical-align: middle;
      color-scheme: light;
    }
    .tb-monthly-log-month-input::-webkit-clear-button {
      display: none !important;
      -webkit-appearance: none !important;
    }
    .tb-monthly-log-month-input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.15s ease;
    }
    .tb-monthly-log-month-input::-webkit-calendar-picker-indicator:hover {
      opacity: 1;
    }
    .tb-monthly-log-month-input:focus {
      outline: none;
      border-color: #3e5ba3;
      box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.2);
    }
    .tb-settings-error-banner {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483645;
      padding: 14px 18px;
      background-color: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.14);
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 13px;
    }
    .tb-settings-error-text {
      color: #b45309;
      font-weight: 500;
    }
    .tb-settings-error-link {
      color: #3e5ba3 !important;
      text-decoration: underline !important;
      font-weight: 700;
      white-space: nowrap;
    }
    .tb-settings-error-close {
      background: none !important;
      border: none !important;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      color: #b45309 !important;
      padding: 0 4px;
    }
    .tb-toast {
      cursor: pointer;
    }

    .tb-top-menu-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      text-decoration: none !important;
    }
    .tb-top-menu-btn .tb-top-menu-icon {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }
    .tb-top-menu-btn .tb-top-menu-icon svg {
      width: 13px;
      height: 13px;
      fill: currentColor;
    }
    .tb-report-project-select {
      width: 100%;
      padding: 9px 12px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .tb-report-project-select:focus {
      border-color: #3e5ba3;
      box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.2);
    }
    .tb-report-sync-dialog {
      background: #ffffff;
      color: #0f172a;
    }
    .tb-report-sync-choices {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      background: #f8fafc;
      font-size: 13px;
    }
    .tb-report-sync-choices legend {
      font-weight: 600;
      color: #334155;
      padding: 0 6px;
      font-size: 12px;
    }
    .tb-report-sync-operations {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      color: #334155;
      max-height: 160px;
      overflow-y: auto;
    }

    /* Dark Mode Overrides for Injected UI */
    :root[data-tb-theme="dark"] .tb-modal-container,
    :root[data-tb-theme="dark"] .tb-monthly-log-dialog,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-dialog {
      background: #0f172a;
      color: #f1f5f9;
      border-color: #334155;
      color-scheme: dark;
    }
    :root[data-tb-theme="dark"] .tb-modal-header,
    :root[data-tb-theme="dark"] .tb-modal-footer,
    :root[data-tb-theme="dark"] .tb-monthly-log-header,
    :root[data-tb-theme="dark"] .tb-monthly-log-footer,
    :root[data-tb-theme="dark"] .tb-monthly-log-panel-title {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
    }
    :root[data-tb-theme="dark"] .tb-monthly-total-summary,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-total-summary {
      background: rgba(62, 91, 163, 0.25) !important;
      border-color: rgba(155, 180, 245, 0.3) !important;
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-icon,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-icon,
    :root[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-label,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-label,
    :root[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-hours-val,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-hours-val {
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-days-val,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-total-summary .tb-total-days-val {
      color: #94a3b8 !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-table tfoot td {
      background: #0f172a;
      border-top-color: #334155;
      color: #f1f5f9;
    }
    :root[data-tb-theme="dark"] .tb-cell-total-label {
      color: #cbd5e1;
    }
    :root[data-tb-theme="dark"] .tb-cell-total-hours .tb-hours-total {
      background: rgba(62, 91, 163, 0.25);
      border-color: rgba(155, 180, 245, 0.3);
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-cell-total-days {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-hours-input-wrapper {
      background: #0f172a;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-hours-input-wrapper:hover {
      border-color: #475569;
    }
    :root[data-tb-theme="dark"] .tb-hours-input-wrapper:focus-within {
      border-color: #3e5ba3;
      background: #0f172a;
      box-shadow: 0 0 0 2px rgba(62, 91, 163, 0.3);
    }
    :root[data-tb-theme="dark"] .tb-hours-input {
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-hours-unit {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-modal-title,
    :root[data-tb-theme="dark"] .tb-monthly-log-header h2,
    :root[data-tb-theme="dark"] .tb-task-name {
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-modal-subtitle,
    :root[data-tb-theme="dark"] .tb-preview-notice,
    :root[data-tb-theme="dark"] .tb-monthly-log-status,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-status,
    :root[data-tb-theme="dark"] .tb-monthly-log-kicker,
    :root[data-tb-theme="dark"] .tb-field-group label,
    :root[data-tb-theme="dark"] .tb-note-card-meta,
    :root[data-tb-theme="dark"] .tb-success-hide-option {
      color: #94a3b8 !important;
    }
    :root[data-tb-theme="dark"] .tb-modal-close:hover,
    :root[data-tb-theme="dark"] .tb-monthly-log-close:hover {
      background: #334155 !important;
      color: #f8fafc !important;
    }
    :root[data-tb-theme="dark"] .tb-field-group input,
    :root[data-tb-theme="dark"] .tb-field-group select,
    :root[data-tb-theme="dark"] .tb-field-group textarea,
    :root[data-tb-theme="dark"] .tb-monthly-log-month-input,
    :root[data-tb-theme="dark"] .tb-bulk-activity-select {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
    }
    :root[data-tb-theme="dark"] .tb-month-picker-wrapper,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-picker-wrapper {
      background: #0f172a;
      border-color: #334155;
      box-shadow: none;
    }
    :root[data-tb-theme="dark"] .tb-month-nav-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-nav-btn {
      background: #1e293b !important;
      border-color: #334155 !important;
      color: #f1f5f9 !important;
      box-shadow: none !important;
    }
    :root[data-tb-theme="dark"] .tb-month-nav-btn:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-nav-btn:hover:not(:disabled) {
      background: #334155 !important;
      border-color: #9bb4f5 !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] .tb-month-nav-btn:focus,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-nav-btn:focus {
      outline: none !important;
    }
    :root[data-tb-theme="dark"] .tb-month-nav-btn:focus-visible,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-nav-btn:focus-visible {
      outline: 2px solid #9bb4f5 !important;
      outline-offset: -1px !important;
    }
    :root[data-tb-theme="dark"] .tb-month-today-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-today-btn {
      background: #1e293b !important;
      border-color: #334155 !important;
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-month-today-btn:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-today-btn:hover:not(:disabled) {
      background: #27354a !important;
      border-color: #9bb4f5 !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] .tb-month-today-btn:focus,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-today-btn:focus {
      outline: none !important;
    }
    :root[data-tb-theme="dark"] .tb-month-today-btn:focus-visible,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-today-btn:focus-visible {
      outline: 2px solid #9bb4f5 !important;
      outline-offset: -1px !important;
    }
    :root[data-tb-theme="dark"] .tb-month-display-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-display-btn {
      background: #1e293b !important;
      border-color: #334155 !important;
      color: #f8fafc !important;
    }
    :root[data-tb-theme="dark"] .tb-month-display-btn:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-display-btn:hover:not(:disabled) {
      background: #27354a !important;
      border-color: #9bb4f5 !important;
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-month-display-icon,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-display-icon {
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-month-display-arrow,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-display-arrow {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-month-popover,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-month-popover {
      background: #1e293b;
      border-color: #334155;
      box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04);
    }
    :root[data-tb-theme="dark"] .tb-popover-year-row,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-year-row,
    :root[data-tb-theme="dark"] .tb-popover-footer,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-footer {
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-popover-year-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-year-btn {
      background: transparent !important;
      border-color: transparent !important;
      color: #cbd5e1 !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-year-btn:hover,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-year-btn:hover {
      background: #334155 !important;
      border-color: #475569 !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-year-text,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-year-text {
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-popover-month-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-month-btn {
      background: transparent !important;
      border-color: transparent !important;
      color: #cbd5e1 !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-month-btn:hover:not(.tb-popover-month-btn--active),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-month-btn:hover:not(.tb-popover-month-btn--active) {
      background: #334155 !important;
      border-color: transparent !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-month-btn--current,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-month-btn--current {
      border-color: #475569 !important;
      color: #9bb4f5 !important;
      font-weight: 600 !important;
      background: rgba(155, 180, 245, 0.08) !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-month-btn--active,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-month-btn--active {
      background: #3e5ba3 !important;
      border-color: #3e5ba3 !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-quick-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-quick-btn {
      color: #9bb4f5 !important;
      background: transparent !important;
      border-color: transparent !important;
    }
    :root[data-tb-theme="dark"] .tb-popover-quick-btn:hover,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-popover-quick-btn:hover {
      background: rgba(62, 91, 163, 0.25) !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] #tb-popover-close-btn,
    .tb-monthly-log-overlay[data-tb-theme="dark"] #tb-popover-close-btn {
      color: #94a3b8 !important;
      background: transparent !important;
      border-color: transparent !important;
    }
    :root[data-tb-theme="dark"] #tb-popover-close-btn:hover,
    .tb-monthly-log-overlay[data-tb-theme="dark"] #tb-popover-close-btn:hover {
      background: #334155 !important;
      color: #f8fafc !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-month-input,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-month-input {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
      color-scheme: dark;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-month-input:focus,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-month-input:focus {
      outline: none;
      border-color: #9bb4f5;
      box-shadow: 0 0 0 2px rgba(155, 180, 245, 0.25);
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-month-input::-webkit-calendar-picker-indicator,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-month-input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.85;
      transition: opacity 0.15s ease;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-month-input::-webkit-calendar-picker-indicator:hover,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-month-input::-webkit-calendar-picker-indicator:hover {
      opacity: 1;
    }
    :root[data-tb-theme="dark"] .tb-field-group input[readonly],
    :root[data-tb-theme="dark"] .tb-field-group textarea[readonly] {
      background: #0f172a;
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-preview-html,
    :root[data-tb-theme="dark"] .tb-note-card-textarea,
    :root[data-tb-theme="dark"] .tb-note-card-preview,
    :root[data-tb-theme="dark"] .tb-monthly-log-panel,
    :root[data-tb-theme="dark"] .tb-monthly-log-progress {
      background: #0f172a;
      border-color: #334155;
      color: #e2e8f0;
    }
    :root[data-tb-theme="dark"] .tb-note-card,
    :root[data-tb-theme="dark"] .tb-migration-selection,
    :root[data-tb-theme="dark"] .tb-task-card,
    :root[data-tb-theme="dark"] .tb-task-list-summary {
      background: #1e293b;
      border-color: #334155;
      color: #e2e8f0;
    }
    :root[data-tb-theme="dark"] .tb-migration-selection-summary,
    :root[data-tb-theme="dark"] .tb-migration-file-item {
      color: #e2e8f0;
    }
    :root[data-tb-theme="dark"] .tb-note-card-header {
      background: #27354a;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-note-card-title {
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-batch-option,
    :root[data-tb-theme="dark"] .tb-dry-run-result {
      background: #1e293b;
      border-color: #334155;
      color: #cbd5e1;
    }
    :root[data-tb-theme="dark"] .tb-batch-option label {
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-btn:focus-visible,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-btn:focus-visible {
      outline: 2px solid #9bb4f5 !important;
      outline-offset: 1px !important;
    }
    :root[data-tb-theme="dark"] .tb-btn-primary:disabled,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-btn-primary:disabled {
      background: #1e293b !important;
      color: #64748b !important;
      border-color: #334155 !important;
      box-shadow: none !important;
    }
    :root[data-tb-theme="dark"] .tb-btn-secondary,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-btn-secondary {
      background: #1e293b !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
    }
    :root[data-tb-theme="dark"] .tb-btn-secondary:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-btn-secondary:hover:not(:disabled) {
      background: #334155 !important;
      border-color: #475569 !important;
      color: #f8fafc !important;
    }
    :root[data-tb-theme="dark"] .tb-btn-secondary:disabled,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-btn-secondary:disabled {
      background: #0f172a !important;
      color: #475569 !important;
      border-color: #1e293b !important;
      box-shadow: none !important;
    }
    :root[data-tb-theme="dark"] #tb-monthly-log-preview,
    .tb-monthly-log-overlay[data-tb-theme="dark"] #tb-monthly-log-preview {
      background: rgba(62, 91, 163, 0.22) !important;
      color: #9bb4f5 !important;
      border-color: rgba(155, 180, 245, 0.35) !important;
    }
    :root[data-tb-theme="dark"] #tb-monthly-log-preview:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] #tb-monthly-log-preview:hover:not(:disabled) {
      background: #3e5ba3 !important;
      border-color: #9bb4f5 !important;
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] #tb-monthly-log-preview:disabled,
    .tb-monthly-log-overlay[data-tb-theme="dark"] #tb-monthly-log-preview:disabled {
      background: #0f172a !important;
      color: #475569 !important;
      border-color: #1e293b !important;
    }
    :root[data-tb-theme="dark"] .tb-suggestions,
    :root[data-tb-theme="dark"] .tb-suggestions--inline {
      background: #1e293b;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-suggestion-item {
      color: #e2e8f0;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-suggestion-item:hover {
      background: #334155;
    }
    :root[data-tb-theme="dark"] .tb-modal-loading {
      background: rgba(15, 23, 42, 0.78);
    }
    :root[data-tb-theme="dark"] .tb-loading-text {
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-table th {
      background: #1e293b;
      color: #cbd5e1;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-table td {
      border-color: #1e293b;
      color: #e2e8f0;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-table tbody tr:nth-child(even):not(.tb-monthly-log-row-warning):not(.tb-result-row-success):not(.tb-result-row-partial) {
      background: rgba(255, 255, 255, 0.02);
    }
    :root[data-tb-theme="dark"] .tb-bulk-activity-toolbar {
      background: #0f172a;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-bulk-activity-label {
      color: #cbd5e1;
    }
    :root[data-tb-theme="dark"] .tb-settings-error-banner {
      background-color: rgba(251, 191, 36, 0.15);
      border-color: #eab308;
    }
    :root[data-tb-theme="dark"] .tb-settings-error-text,
    :root[data-tb-theme="dark"] .tb-settings-error-close {
      color: #fbbf24 !important;
    }
    :root[data-tb-theme="dark"] .tb-settings-error-link {
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-user-badge {
      background: #1e293b;
      border-color: #334155;
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-user-badge--loaded {
      background: rgba(62, 91, 163, 0.25);
      border-color: rgba(155, 180, 245, 0.3);
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-issue-link {
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-issue-link:hover {
      color: #ffffff;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-row-warning .tb-issue-link {
      color: #fcd34d;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-row-warning .tb-issue-link:hover {
      color: #fde68a;
    }
    :root[data-tb-theme="dark"] .tb-status-badge--ready,
    :root[data-tb-theme="dark"] .tb-status-badge--success {
      background: rgba(74, 222, 128, 0.15);
      color: #4ade80;
      border-color: #22c55e;
    }
    :root[data-tb-theme="dark"] .tb-status-badge--warning {
      background: rgba(251, 191, 36, 0.15);
      color: #fbbf24;
      border-color: #eab308;
    }
    :root[data-tb-theme="dark"] .tb-status-badge--full {
      background: #1e293b;
      color: #cbd5e1;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-status-badge--empty {
      background: #0f172a;
      color: #64748b;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-status-badge--error {
      background: rgba(248, 113, 113, 0.15);
      color: #f87171;
      border-color: #dc2626;
    }
    :root[data-tb-theme="dark"] .tb-activity-select {
      background: #0f172a;
      border-color: #334155;
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-hours-badge,
    :root[data-tb-theme="dark"] .tb-hours-total {
      background: rgba(62, 91, 163, 0.25);
      color: #9bb4f5;
      border-color: rgba(155, 180, 245, 0.3);
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-row-warning td {
      background: rgba(251, 191, 36, 0.12);
      color: #fbbf24;
      font-weight: 600;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-row-warning .tb-task-card {
      background: #1e293b;
      border-color: #eab308;
    }
    :root[data-tb-theme="dark"] .tb-result-row-success td {
      background: rgba(74, 222, 128, 0.15);
      color: #4ade80;
    }
    :root[data-tb-theme="dark"] .tb-result-row-partial td {
      background: rgba(251, 191, 36, 0.12);
      color: #fbbf24;
      font-weight: 600;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress {
      background: #0f172a !important;
      color: #e2e8f0 !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-empty,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-empty {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--info,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--info {
      background: transparent;
      color: #e2e8f0;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--info::before,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--info::before {
      background: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--date,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--date {
      background: rgba(62, 91, 163, 0.22);
      color: #f8fafc;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--date::before,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--date::before {
      background: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--success,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--success {
      background: rgba(34, 197, 94, 0.12);
      color: #4ade80;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--success::before,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--success::before {
      background: #4ade80;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--skip,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--skip {
      background: transparent;
      color: #cbd5e1;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--skip::before,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--skip::before {
      background: #64748b;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--error,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--error {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-progress-item--error::before,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-progress-item--error::before {
      background: #f87171;
    }
    :root[data-tb-theme="dark"] .tb-table-empty-wrap,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-table-empty-wrap {
      color: #64748b;
    }
    :root[data-tb-theme="dark"] .tb-table-empty-title,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-table-empty-title {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-footer,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-footer {
      background: #1e293b;
      border-top-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-footer .tb-btn-danger,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-footer .tb-btn-danger {
      color: #f87171 !important;
      border-color: rgba(248, 113, 113, 0.35) !important;
      background: transparent !important;
    }
    :root[data-tb-theme="dark"] .tb-monthly-log-footer .tb-btn-danger:hover:not(:disabled),
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-monthly-log-footer .tb-btn-danger:hover:not(:disabled) {
      background: rgba(248, 113, 113, 0.15) !important;
      color: #fca5a5 !important;
    }
    :root[data-tb-theme="dark"] .tb-redmine-btn {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    :root[data-tb-theme="dark"] .tb-redmine-btn:hover {
      background: #27354a;
      border-color: #9bb4f5;
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-backlog-btn {
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-backlog-btn:hover {
      color: #ffffff !important;
    }
    :root[data-tb-theme="dark"] .tb-preview-toggle {
      background: rgba(62, 91, 163, 0.25);
      border-color: rgba(155, 180, 245, 0.3);
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-preview-toggle:hover {
      background: #3e5ba3;
      border-color: #9bb4f5;
      color: #ffffff;
    }
    :root[data-tb-theme="dark"] .tb-preview-html code {
      background: #1e293b;
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-preview-html h1,
    :root[data-tb-theme="dark"] .tb-preview-html h2,
    :root[data-tb-theme="dark"] .tb-preview-html h3 {
      color: #f8fafc;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-batch-pill {
      background: rgba(62, 91, 163, 0.25);
      color: #9bb4f5;
      border: 1px solid rgba(155, 180, 245, 0.3);
    }
    :root[data-tb-theme="dark"] .tb-modal-hint {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-success-link {
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-success-link:hover {
      color: #9bb4f5 !important;
    }
    :root[data-tb-theme="dark"] .tb-row-weekend td {
      background: #0f172a;
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-cell-weekend {
      color: #64748b;
    }
    :root[data-tb-theme="dark"] .tb-table-empty-state,
    .tb-monthly-log-overlay[data-tb-theme="dark"] .tb-table-empty-state {
      color: #94a3b8;
    }
    :root[data-tb-theme="dark"] .tb-report-project-select {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
    }
    :root[data-tb-theme="dark"] .tb-report-sync-dialog {
      background: #0f172a;
      color: #f1f5f9;
      border-color: #334155;
    }
    :root[data-tb-theme="dark"] .tb-report-sync-choices {
      border-color: #334155;
      background: #1e293b;
      color: #cbd5e1;
    }
    :root[data-tb-theme="dark"] .tb-report-sync-choices legend {
      color: #9bb4f5;
    }
    :root[data-tb-theme="dark"] .tb-report-sync-operations {
      background: #0f172a;
      border-color: #334155;
      color: #94a3b8;
    }
    @media (max-width: 760px) {
      .tb-modal-overlay {
        padding: 10px;
      }
      .tb-modal-container {
        max-height: calc(100vh - 20px);
        max-height: calc(100dvh - 20px);
      }
      .tb-field-row {
        grid-template-columns: minmax(0, 1fr);
      }
      .tb-modal-header,
      .tb-modal-footer {
        padding-left: 14px;
        padding-right: 14px;
      }
      .tb-modal-footer,
      .tb-monthly-log-footer {
        flex-wrap: wrap;
      }
      .tb-monthly-log-overlay {
        padding: 10px;
      }
      .tb-monthly-log-header,
      .tb-monthly-log-body,
      .tb-monthly-log-footer {
        padding-left: 14px;
        padding-right: 14px;
      }
      .tb-monthly-log-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .tb-monthly-log-grid {
        grid-template-columns: 1fr;
      }
      .tb-monthly-log-footer > button {
        flex: 1 1 42%;
      }
    }
  `;
  document.head.appendChild(style);
}
