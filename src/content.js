/**
 * Content Script Entry Point for Backlog2Redmine Extension.
 * Handles DOM injection, observers, and main event coordination.
 */

// Markdown conversion function is loaded from modules/utils/markdown.js via manifest.json
// extractBacklogContent() is available globally after markdown.js loads

const BUTTON_CLASS = "tb-redmine-btn";
const TRANSLATE_BATCH_SIZE = 2;
const REDMINE_ICON =
  TB?.ICONS?.REDMINE ||
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><path d="M 4 2 C 2.894531 2 2 2.894531 2 4 L 2 13 C 2 14.105469 2.894531 15 4 15 L 5 15 L 5 17 L 7 19 L 9 19 L 9 20 C 9 21.105469 9.894531 22 11 22 L 20 22 C 21.105469 22 22 21.105469 22 20 L 22 11 C 22 9.894531 21.105469 9 20 9 L 15 9 L 15 4 C 15 2.894531 14.105469 2 13 2 Z M 4 4 L 13 4 L 13 9 L 11 9 C 10.339844 9 9.769531 9.320313 9.40625 9.8125 C 9.246094 9.703125 9.109375 9.574219 8.96875 9.46875 C 9.601563 8.804688 10.234375 8 10.75 7 L 12 7 L 12 6 L 9 6 L 9 5 L 8 5 L 8 6 L 5 6 L 5 7 L 6.125 7 C 6.003906 7.136719 5.96875 7.328125 6.03125 7.5 C 6.03125 7.5 6.199219 8.007813 6.71875 8.6875 C 6.90625 8.933594 7.167969 9.207031 7.46875 9.5 C 6.324219 10.472656 5.34375 10.90625 5.34375 10.90625 C 5.085938 11.011719 4.957031 11.304688 5.0625 11.5625 C 5.167969 11.820313 5.460938 11.949219 5.71875 11.84375 C 5.71875 11.84375 6.914063 11.355469 8.25 10.1875 C 8.484375 10.367188 8.75 10.535156 9.03125 10.71875 C 9.019531 10.8125 9 10.902344 9 11 L 9 13 L 4 13 Z M 6.875 7 L 9.5625 7 C 9.136719 7.722656 8.671875 8.34375 8.1875 8.84375 C 7.902344 8.574219 7.667969 8.3125 7.5 8.09375 C 7.0625 7.523438 7 7.21875 7 7.21875 C 6.976563 7.136719 6.933594 7.0625 6.875 7 Z M 14.84375 12 L 16.15625 12 L 19 20 L 17.84375 20 L 17.09375 17.8125 L 13.84375 17.8125 L 13.125 20 L 12 20 Z M 15.4375 12.90625 C 15.3125 13.382813 14.15625 17 14.15625 17 L 16.8125 17 C 16.8125 17 15.59375 13.371094 15.46875 12.90625 Z M 7 15 L 9 15 L 9 17 L 7 17 Z"/></svg>';

let commentObserver = null;
let pathCheckInterval = null;

initializeBacklogContent();

async function initializeBacklogContent() {
  try {
    const { languagePreference } = await chrome.storage.local.get("languagePreference");
    const language = languagePreference || "en";
    const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
    if (response.ok) globalThis.TB_SET_LOCALE_MESSAGES(await response.json());
  } catch (error) {
    console.warn("[TB-Content] Locale catalog unavailable; using English fallback:", error);
  }

  try {
    injectStyles();
    scanAndInjectButtons();
    observeCommentActions();

    let lastPath = window.location.pathname;
    pathCheckInterval = setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        scanAndInjectButtons();
      }
    }, 1000);

    window.addEventListener("beforeunload", () => {
      if (pathCheckInterval) clearInterval(pathCheckInterval);
      if (commentObserver) commentObserver.disconnect();
    });
  } catch (err) {
    console.error("[TB-Content] Initialization failed:", err);
  }
}

function isIssuePage() {
  return /\/view\/[A-Z0-9_]+-[0-9]+/.test(window.location.pathname);
}

function observeCommentActions() {
  const targetContainer =
    document.querySelector(".comments") ||
    document.querySelector(".comment-list") ||
    document.querySelector('[data-testid="commentsContainer"]') ||
    document.body;

  commentObserver = new MutationObserver((mutations) => {
    let shouldScanHeaders = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("div.comment-item__actions")) {
            injectButtonIfNeeded(node);
          } else {
            node.querySelectorAll?.("div.comment-item__actions").forEach(injectButtonIfNeeded);
          }

          if (node.matches?.(".title-group__edit-actions")) {
            injectHeaderButton();
          } else if (node.querySelector?.(".title-group__edit-actions")) {
            shouldScanHeaders = true;
          }
        }
      }
    }
    if (shouldScanHeaders) {
      injectHeaderButton();
    }
  });

  commentObserver.observe(targetContainer, { childList: true, subtree: true });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.comment-item__actions").forEach(injectButtonIfNeeded);
  injectHeaderButton();
}

/**
 * Creates a modern, high-end button with the 'Cyan-Flow' theme.
 */
function createModernButton(text, onClick, options = {}) {
  const { height = "32px", fontSize = "12px", margin = "0" } = options;

  const button = document.createElement("button");
  button.className = "tb-modern-btn";

  // Outer shell (Gradient border)
  Object.assign(button.style, {
    margin: margin,
    padding: "2px",
    height: height,
    display: "inline-flex",
    alignItems: "center",
    background: "#3e5ba3",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 2px 6px rgba(62, 91, 163, 0.18)",
    overflow: "hidden",
  });

  // Inner wrapper (Glassy background)
  const innerWrap = document.createElement("div");
  Object.assign(innerWrap.style, {
    backgroundColor: "#ffffff",
    height: "100%",
    width: "100%",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    transition: "background-color 0.25s ease",
  });

  innerWrap.innerHTML = `
    <span style="display:flex; align-items:center;">${REDMINE_ICON}</span>
    <span class="tb-btn-text" style="margin-left:8px; font-weight:700; color:#3e5ba3; white-space:nowrap; font-size:${fontSize}; letter-spacing:0.2px;">${text}</span>
  `;

  button.appendChild(innerWrap);
  const textSpan = innerWrap.querySelector(".tb-btn-text");

  button.onmouseover = () => {
    button.style.transform = "translateY(-1px)";
    button.style.boxShadow = "0 4px 12px rgba(62, 91, 163, 0.28)";
    innerWrap.style.backgroundColor = "transparent";
    textSpan.style.color = "#ffffff";
  };

  button.onmouseout = () => {
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 2px 6px rgba(62, 91, 163, 0.18)";
    innerWrap.style.backgroundColor = "#ffffff";
    textSpan.style.color = "#3e5ba3";
  };

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(button);
  };

  return button;
}

function injectHeaderButton() {
  if (!isIssuePage()) return;
  const container = document.querySelector(".title-group__edit-actions");
  if (!container || container.querySelector(".tb-header-migrate-btn")) {
    return;
  }

  const button = createModernButton(
    TB.MESSAGES.MIGRATE_BUTTON_TEXT,
    (btn) => handleIssueMigration(btn),
    { margin: "0 0 0 20px", height: "30px", fontSize: "12.5px" }
  );
  button.classList.add("tb-header-migrate-btn");

  container.appendChild(button);
}

function injectButtonIfNeeded(actionsEl) {
  if (!isIssuePage()) return;
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") {
    return;
  }

  const button = createModernButton(
    TB.MESSAGES.BUTTON_TEXT,
    (btn) => handleTranslateAndOpenModal(actionsEl, btn),
    { margin: "0 0 0 12px", height: "30px", fontSize: "12.5px" }
  );
  button.classList.add(BUTTON_CLASS);

  const quoteBtn = actionsEl.querySelector("a.icon-comment");
  if (quoteBtn) {
    quoteBtn.before(button);
  } else {
    actionsEl.appendChild(button);
  }
  actionsEl.dataset.tbInjected = "1";
}

async function handleTranslateAndOpenModal(actionsEl, button) {
  const commentItem = actionsEl
    ? actionsEl.closest(".comment-item") || actionsEl.parentElement
    : null;
  const { issueKey, issueSummary, backlogIssueType } = getBacklogHeaderInfo();
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  const allItems = Array.from(document.querySelectorAll(".comment-item"));
  const idx = allItems.findIndex((item) => item === commentItem);

  // Get content and userInfo from the clicked comment
  const { text: clickedCommentText, userInfo: clickedUserInfo } = getCommentFullText(commentItem);

  const remainingItems = allItems
    .slice(idx + 1)
    .map((i) => {
      const { text, userInfo } = getCommentFullText(i);
      return {
        text,
        userInfo,
        url: getCommentUrl(i),
      };
    })
    .filter((c) => c.text);

  setButtonLoading(button, true);
  try {
    // Translate the clicked comment from Backlog to Vietnamese
    const result = await sendRuntimeMessageWithResponse({
      type: "LOOKUP_AND_TRANSLATE_COMMENT",
      issueKey,
      issueSummary,
      backlogIssueType: backlogIssueType || "",
      commentText: clickedCommentText,
      userInfo: clickedUserInfo,
      commentUrl: getCommentUrl(commentItem),
    });

    const progressByIssue = new Map();
    openConfirmModal({
      sourceIssueKey: issueKey,
      redmineIssueId: result.data.redmineIssueId,
      issueTitle: result.data.issueTitle,
      previewText: result.data.previewText || "",
      remainingComments: remainingItems,
      hasBatchOption: remainingItems.length > 0,
      backlogIssueType,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({
        redmineIssueId,
        notesList,
        noteIndexes = notesList.map((_, index) => index),
      }) => {
        const targetId = String(redmineIssueId).trim();
        if (!progressByIssue.has(targetId)) {
          progressByIssue.set(targetId, { completedNotes: [], lastSendResult: null });
        }
        const progress = progressByIssue.get(targetId);
        const { completedNotes } = progress;
        try {
          for (const [index, notes] of notesList.entries()) {
            if (completedNotes[index] === notes) continue;
            const sendRes = await sendRuntimeMessageWithResponse({
              type: "SEND_TO_REDMINE",
              redmineIssueId,
              notes,
              backlogIssueKey: issueKey,
              sourceCommentUrl:
                noteIndexes[index] === 0
                  ? getCommentUrl(commentItem) || ""
                  : remainingItems[noteIndexes[index] - 1]?.url || "",
              sourceCommentText:
                noteIndexes[index] === 0
                  ? clickedCommentText
                  : remainingItems[noteIndexes[index] - 1]?.text || "",
            });
            completedNotes[index] = notes;
            progress.lastSendResult = sendRes.data;
          }
        } catch (error) {
          const sentCount = completedNotes.filter(Boolean).length;
          await recordSyncActivity({
            operation: "translate",
            issue: issueKey,
            count: sentCount,
            partial: sentCount > 0,
            ok: false,
            detail: error?.error || error?.message || "Unknown error",
            url: progress.lastSendResult?.redmineUrl || window.location.href,
          });
          if (sentCount > 0) {
            throw new Error(
              globalThis
                .TB_GET_MESSAGE("options_sync_retry_remaining")
                .replace("$sent$", String(sentCount))
                .replace("$total$", String(notesList.length))
            );
          }
          throw error;
        }
        await recordSyncActivity({
          operation: "translate",
          issue: issueKey,
          count: notesList.length,
          ok: true,
          url: progress.lastSendResult.redmineUrl,
        });
        await openSuccessModal({
          redmineUrl: progress.lastSendResult.redmineUrl,
          commentCount: notesList.length,
          onClose: () => setButtonLoading(button, false),
        });
      },
      translateBatch: async (comments) => translateCommentBatch(comments),
    });
    setButtonLoading(button, false);
  } catch (err) {
    await recordSyncActivity({
      operation: "translate",
      issue: issueKey,
      count: 1,
      ok: false,
      detail: err?.error || err?.message || "Unknown error",
      url: window.location.href,
    });
    setButtonLoading(button, false);
    if (err.isSettingsError) {
      showSettingsErrorLink(err.error);
    } else if (isNetworkError(err)) {
      showToast("📶 Mất kết nối mạng. Đã lưu tác vụ vào hàng đợi để gửi lại khi có mạng.", "error");
    } else {
      showToast(err.error || err.message, "error");
    }
  }
}

async function translateCommentBatch(commentsList) {
  const results = [];
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < commentsList.length; i += TRANSLATE_BATCH_SIZE) {
    if (i > 0) {
      // Nhẹ nhàng giãn cách nhịp gọi giữa các batch để tránh burst rate limit (429)
      await delay(250);
    }
    const batch = commentsList.slice(i, i + TRANSLATE_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        try {
          const r = await sendRuntimeMessageWithResponse({
            type: "TRANSLATE_COMMENT_FULL",
            commentText: c.text,
            commentUrl: c.url,
            issueKey: getBacklogHeaderInfo().issueKey,
          });
          return c.userInfo ? `${c.userInfo}\n${r.data.translatedText}` : r.data.translatedText;
        } catch (err) {
          console.warn("[TB-Content] Comment translation failed, using original text:", err);
          // Keep migrate usable even if one comment translation fails.
          return c.userInfo ? `${c.userInfo}\n${c.text}` : c.text;
        }
      })
    );
    results.push(...batchResults);
  }
  return results;
}

function collectBacklogCommentsForMigrate() {
  // Prefer visible comment list; skip dummy/editor stubs from Backlog UI.
  const nodes = Array.from(
    document.querySelectorAll(
      ".comment-item:not(.-dammy):not(.-dummy), [data-testid='commentItem']:not(.-dammy):not(.-dummy)"
    )
  );
  const seen = new Set();
  const comments = [];

  for (const node of nodes) {
    if (seen.has(node)) continue;
    seen.add(node);
    // Skip reply/editor shells that are not real posted comments.
    if (node.querySelector("textarea, [contenteditable='true']")) continue;

    const { text, userInfo } = getCommentFullText(node);
    if (!text?.trim()) continue;
    comments.push({
      text,
      userInfo,
      url: getCommentUrl(node),
    });
  }
  return comments;
}

async function handleIssueMigration(button) {
  const { issueKey, issueSummary, backlogIssueType, backlogMilestone } = getBacklogHeaderInfo();
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  // Collect all comments/notes under the issue to migrate together.
  const comments = collectBacklogCommentsForMigrate();

  setButtonLoading(button, true);
  try {
    // Translate the issue description
    const descriptionEl =
      document.querySelector("#issueDescription .markdown-body") ||
      document.querySelector(".issue-description .markdown-body") ||
      document.querySelector(".description .markdown-body");
    let descriptionText = descriptionEl ? extractBacklogContent(descriptionEl) : "";
    if (typeof stripSyncMarkers === "function") {
      descriptionText = stripSyncMarkers(descriptionText);
    }
    // Scrape attachments for description (it has its own attachment list in Modern UI)
    let fullDescription = descriptionText;
    const descAttachments = document.querySelectorAll(
      '.issue-attachments .upload-item-list li a[href*="attachmentId="], ' +
        '.issue-attachments .upload-item-list li a[href*="downloadAttachment/"], ' +
        '.issue-attachments a[href*="ViewAttachmentVideo.action"]'
    );
    descAttachments.forEach((link) => {
      const href = link.getAttribute("href") || "";
      const match = href.match(/attachmentId=(\d+)/) || href.match(/downloadAttachment\/(\d+)/);
      if (match) {
        const id = match[1];
        const filename = link.textContent.trim();
        if (
          filename.toLowerCase() !== "download" &&
          !fullDescription.includes(`[[TB_FILE:${id}:`)
        ) {
          fullDescription += `\n\n**Attachment**: [[TB_FILE:${id}:${filename}]]`;
        }
      }
    });

    // Translate description, subject, and all comments up-front so migrate includes notes by default.
    const [descRes, subRes, initialBatchNotes] = await Promise.all([
      sendRuntimeMessageWithResponse({
        type: "LOOKUP_AND_TRANSLATE_COMMENT",
        issueKey,
        issueSummary,
        backlogIssueType: backlogIssueType || "",
        commentText: fullDescription,
        userInfo: "", // No userInfo for main description
        commentUrl: window.location.href,
      }),
      sendRuntimeMessageWithResponse({
        type: "TRANSLATE_TEXT_SIMPLE",
        text: issueSummary,
        issueKey,
      }),
      comments.length > 0 ? translateCommentBatch(comments) : Promise.resolve([]),
    ]);

    const uiSettings = await sendRuntimeMessageWithResponse({ type: "GET_UI_SETTINGS", issueKey });
    openConfirmModal({
      sourceIssueKey: issueKey,
      isMigration: true,
      issueTitle: globalThis.TB_SYNC_RULES.subject(
        { issueKey, summary: issueSummary, translatedSummary: subRes.data.translatedText },
        globalThis.TB_SYNC_RULES.normalize(uiSettings.data.syncRules)
      ),
      previewText: descRes.data.previewText,
      remainingComments: comments,
      commentsCount: comments.length,
      initialBatchNotes,
      migrateCommentsByDefault: comments.length > 0,
      backlogIssueType,
      backlogMilestone,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ issueData, comments: translatedComments, selection }) => {
        const issueDataToSend = {
          ...issueData,
          backlogIssueKey: issueKey,
        };
        let result;
        try {
          result = await sendRuntimeMessageWithResponse({
            type: "CREATE_REDMINE_ISSUE",
            issueData: issueDataToSend,
            comments: translatedComments, // Translated comments/notes migrated with the issue
            selection,
          });
        } catch (error) {
          await recordSyncActivity({
            operation: "migration",
            issue: issueKey,
            count: 0,
            ok: false,
            detail: error?.error || error?.message || "Unknown error",
            url: window.location.href,
          });
          throw error;
        }
        const failedCommentCount = result.data?.failedCommentCount || 0;
        const failedComments = result.data?.failedComments || [];
        await recordSyncActivity({
          operation: "migration",
          issue: issueKey,
          count: (result.data?.migratedCommentCount || 0) + 1,
          partial: failedCommentCount > 0,
          ok: failedCommentCount === 0,
          detail: failedComments[0]?.message
            ? `${failedCommentCount} of ${translatedComments?.length || 0} comments failed: ${failedComments[0].message}`
            : "",
          url: result.data.redmineUrl,
        });
        if (failedCommentCount > 0) {
          const totalComments = translatedComments?.length || 0;
          const failedIndexes = failedComments
            .map((item) => `#${item.index}`)
            .filter(Boolean)
            .join(", ");
          const firstError = failedComments[0]?.message
            ? String(failedComments[0].message).slice(0, 120)
            : "";
          const message = globalThis
            .TB_GET_MESSAGE("options_migration_partial_failure")
            .replace("$failed$", String(failedCommentCount))
            .replace("$total$", String(totalComments))
            .replace("$indexes$", failedIndexes ? ` (${failedIndexes})` : "")
            .replace("$reason$", firstError ? ` ${firstError}` : "");
          showToast(message, "error");
        }
        await openSuccessModal({
          redmineUrl: result.data.redmineUrl,
          commentCount: (result.data?.migratedCommentCount || 0) + 1,
          forceShow: true,
          onClose: () => setButtonLoading(button, false),
        });
      },
      translateBatch: translateCommentBatch,
    });
    setButtonLoading(button, false);
  } catch (err) {
    await recordSyncActivity({
      operation: "migration",
      issue: issueKey,
      count: comments.length,
      ok: false,
      detail: err?.error || err?.message || "Unknown error",
      url: window.location.href,
    });
    setButtonLoading(button, false);
    if (err.isSettingsError) {
      showSettingsErrorLink(err.error);
    } else if (isNetworkError(err)) {
      showToast("📶 Mất kết nối mạng. Đã lưu tác vụ vào hàng đợi để gửi lại khi có mạng.", "error");
    } else {
      showToast(err.error || err.message, "error");
    }
  }
}

// Helpers

function isNetworkError(err) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(err?.error || err?.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("offline") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch")
  );
}

window.addEventListener("online", async () => {
  try {
    const queue = await chrome.runtime.sendMessage({ type: "GET_RETRY_QUEUE" });
    if (queue && queue.length > 0) {
      showToast(`📶 Mạng đã khôi phục. Đang thử lại ${queue.length} tác vụ...`, "info");
      const res = await chrome.runtime.sendMessage({ type: "PROCESS_RETRY_ALL" });
      if (res && res.succeeded > 0) {
        showToast(`✓ Đã gửi lại thành công ${res.succeeded} tác vụ!`, "success");
      }
    }
  } catch (_e) {
    // Ignore error
  }
});

function showSettingsErrorLink(message) {
  let container = document.getElementById("tb-settings-error");
  if (!container) {
    container = document.createElement("div");
    container.id = "tb-settings-error";
    container.className = "tb-settings-error-banner";
    container.setAttribute("role", "alert");
    document.body.appendChild(container);
  }

  const messageEl = document.createElement("span");
  messageEl.className = "tb-settings-error-text";
  messageEl.textContent = String(message || TB.MESSAGES.SETTINGS.INCOMPLETE);

  const settingsLink = document.createElement("a");
  settingsLink.href = "#";
  settingsLink.id = "tb-open-settings-link";
  settingsLink.className = "tb-settings-error-link";
  settingsLink.textContent = TB.MESSAGES.SETTINGS.OPEN_LINK;

  const closeButton = document.createElement("button");
  closeButton.id = "tb-close-error-link";
  closeButton.type = "button";
  closeButton.className = "tb-settings-error-close";
  closeButton.setAttribute("aria-label", TB.MESSAGES.MODAL.CLOSE_ARIA);
  closeButton.textContent = "×";

  container.replaceChildren(messageEl, settingsLink, closeButton);

  document.getElementById("tb-open-settings-link").onclick = (e) => {
    e.preventDefault();
    const runtime = getContentRuntime();
    if (runtime?.sendMessage) {
      runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
    } else {
      showToast(TB.MESSAGES.SETTINGS.RUNTIME_UNAVAILABLE, "error");
    }
    container.remove();
  };

  document.getElementById("tb-close-error-link").onclick = (e) => {
    e.preventDefault();
    container.remove();
  };
}

function sendRuntimeMessageWithResponse(message) {
  return new Promise((resolve, reject) => {
    const runtime = getContentRuntime();
    if (!runtime?.sendMessage) {
      reject({ error: TB.MESSAGES.SETTINGS.RUNTIME_UNAVAILABLE });
      return;
    }

    runtime.sendMessage(message, (response) => {
      const lastError = runtime.lastError;
      if (lastError) {
        reject({ error: lastError.message });
        return;
      }
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(response || { error: "An unknown error occurred." });
      }
    });
  });
}

function getContentRuntime() {
  if (typeof chrome === "undefined") {
    return null;
  }
  return chrome.runtime || null;
}

function getCommentFullText(itemEl) {
  if (!itemEl) return { text: "", userInfo: "" };

  // --- Extract User & Time Information ---
  let userInfo = "";
  const userEl = itemEl.querySelector(".user-icon-set__name");
  const timeEl = itemEl.querySelector(".user-icon-set__sub-line-anchor");
  if (userEl && timeEl) {
    userInfo = `**${userEl.textContent.trim()}**\n${timeEl.textContent.trim()}\n\n`;
  }

  // Extract content
  const contentEl =
    itemEl.querySelector(".markdown-body") ||
    itemEl.querySelector(".comment-item__content") ||
    itemEl.querySelector(".comment-item__body") ||
    itemEl.querySelector(".comment-content") ||
    itemEl.querySelector(".item-body");

  let text = contentEl ? extractBacklogContent(contentEl) : itemEl.innerText || "";
  if (typeof stripSyncMarkers === "function") {
    text = stripSyncMarkers(text);
  }

  // 1. Get current attachments
  const currentAttachments = scrapeAttachments(itemEl);

  // 2. Look-ahead for "Media-only" subsequent comments
  const nextComment = itemEl.nextElementSibling;
  if (nextComment && nextComment.classList.contains("comment-item")) {
    const nextContentEl =
      nextComment.querySelector(".markdown-body") ||
      nextComment.querySelector(".comment-item__content") ||
      nextComment.querySelector(".comment-item__body") ||
      nextComment.querySelector(".comment-content") ||
      nextComment.querySelector(".item-body");

    const nextText = nextContentEl ? extractBacklogContent(nextContentEl).trim() : "";
    const nextAttachments = scrapeAttachments(nextComment);

    // Case A: Next comment is strictly for media (no meaningful text)
    if (!nextText || nextText.length < 10) {
      // Threshold for "Lưu ý: nội dung ngắn hoặc trống"
      nextAttachments.forEach((id, filename) => {
        currentAttachments.set(filename, id);
      });
    } else {
      // Case B: Next comment has text, but current text mentions a file that is in the next comment
      const words = text.split(/\s+/);
      for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]$/, ""); // Remove trailing punctuation
        if (nextAttachments.has(cleanWord)) {
          const id = nextAttachments.get(cleanWord);
          currentAttachments.set(cleanWord, id);
        }
      }
    }
  }

  // Build attachment markers into text
  let attachmentText = "";
  currentAttachments.forEach((id, filename) => {
    if (!text.includes(`[[TB_FILE:${id}:`)) {
      attachmentText += `\n\n**Attachment**: [[TB_FILE:${id}:${filename}]]`;
    }
  });
  text += attachmentText;

  return { text: text.trim(), userInfo };
}

function scrapeAttachments(itemEl) {
  const attachments = new Map();
  const links = itemEl.querySelectorAll(
    ".comment-changelog__item a[href*='attachmentId='], " +
      ".comment-changelog__item a[href*='downloadAttachment/'], " +
      ".upload-item-list li a[href*='attachmentId='], " +
      ".upload-item-list li a[href*='downloadAttachment/'], " +
      ".comment-attachments a[href*='attachmentId='], " +
      ".comment-attachments a[href*='downloadAttachment/'], " +
      "a.attachment-file[href*='attachmentId='], " +
      "a.attachment-file[href*='downloadAttachment/'], " +
      "a[href*='ViewAttachmentVideo.action']"
  );
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const match = href.match(/attachmentId=(\d+)/) || href.match(/downloadAttachment\/(\d+)/);
    if (match) {
      const id = match[1];
      const filename = link.textContent.trim();
      if (filename && filename.toLowerCase() !== "download") {
        attachments.set(filename, id);
      }
    }
  });
  return attachments;
}

function getBacklogHeaderInfo() {
  // Try data-testid first (Modern UI)
  let issueKey = document.querySelector('[data-testid="issueKey"]')?.textContent?.trim();
  let issueSummary = document.querySelector('[data-testid="issueSummary"]')?.textContent?.trim();
  let backlogMilestone = document
    .querySelector('[data-testid="issueMilestone"]')
    ?.textContent?.trim();

  // Try legacy/alternative selectors
  if (!issueKey) {
    issueKey =
      document.querySelector(".ticket__key")?.textContent?.trim() ||
      document.querySelector(".issue-key")?.textContent?.trim();
  }
  if (!issueSummary) {
    issueSummary =
      document.querySelector(".ticket__summary")?.textContent?.trim() ||
      document.querySelector(".title-group__title-text")?.textContent?.trim();
  }
  if (!backlogMilestone) {
    backlogMilestone = document
      .querySelector(".ticket__properties-item.-milestones .ticket__properties-value")
      ?.textContent?.trim();
  }

  // LAST RESORT: Extract Issue Key from URL
  if (!issueKey) {
    const urlMatch = window.location.pathname.match(/\/view\/([A-Z0-9_]+-[0-9]+)/);
    if (urlMatch) {
      issueKey = urlMatch[1];
    }
  }

  // FALLBACK SUMMARY: Use page title if summary not found
  if (!issueSummary) {
    issueSummary = document.title.split("]")[1]?.split("-")[0]?.trim() || document.title;
  }

  // Detect Issue Type (Modern UI)
  const backlogIssueType = document.querySelector('[data-testid="issueType"]')?.textContent?.trim();

  return {
    issueKey: issueKey || "",
    issueSummary: issueSummary || "",
    backlogIssueType: backlogIssueType || "",
    backlogMilestone: backlogMilestone || "",
  };
}

function getCommentUrl(item) {
  let id = item?.getAttribute("id");
  if (!id) {
    return null;
  }
  if (id.startsWith("comment-item-")) {
    id = id.replace("comment-item-", "comment-");
  }
  return `${window.location.origin}${window.location.pathname}#${id}`;
}

function setButtonLoading(btn, isLoading) {
  if (!btn) {
    return;
  }
  btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;

  if (isLoading) {
    btn.innerHTML = `<span class="tb-loading">${TB.MESSAGES.PROCESSING}</span>`;
    globalThis.TB_ACTIVE_AI_STATUS_TARGET = btn.querySelector(".tb-loading");
  } else {
    if (globalThis.TB_ACTIVE_AI_STATUS_TARGET?.parentElement === btn) {
      globalThis.TB_ACTIVE_AI_STATUS_TARGET = null;
    }
    btn.innerHTML = btn.dataset.originalHtml;
    // Reset visual styles to non-hover state (Modern Button fix)
    const innerWrap = btn.querySelector("div");
    const textSpan = btn.querySelector(".tb-btn-text");
    if (innerWrap && btn.style.transform === "translateY(-1px)") {
      // a few more checks here for safety
    }
    // Re-apply standard styles
    const innerWrapEl = btn.querySelector("div");
    const textSpanEl = btn.querySelector(".tb-btn-text");
    if (innerWrapEl && textSpanEl) {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 2px 6px rgba(62, 91, 163, 0.18)";
      innerWrapEl.style.backgroundColor = "#ffffff";
      textSpanEl.style.color = "#3e5ba3";
    }
  }
}
