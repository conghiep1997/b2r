/* globals getTrackers, findIssues, findTimeEntries, deleteTimeEntry, getCurrentUser, logTimeFromReport, planReportSync */

globalThis.__B2R_REDMINE_LOADED__ = true;

/**
 * Redmine Content Script Entry Point for Backlog2Redmine Extension.
 * Handles extracting Japanese content, syncing to Backlog, and logging time from reports.
 */

const BUTTON_CLASS = "tb-backlog-btn";
const BACKLOG_ICON = TB?.ICONS?.BACKLOG;
let reportMessages = null;
const reportMessage = (key, values = {}) => {
  const template = reportMessages?.[key]?.message || chrome.i18n.getMessage(key) || key;
  return template.replace(/\$([a-z0-9_]+)\$/gi, (token, name) => String(values[name] ?? token));
};

let journalObserver = null;

// ====================
// INITIALIZATION
// ====================
initializeRedmineContent();

async function initializeRedmineContent() {
  try {
    const { languagePreference } = await chrome.storage.local.get("languagePreference");
    const language = languagePreference || "en";
    const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
    if (response.ok) {
      reportMessages = await response.json();
      globalThis.TB_SET_LOCALE_MESSAGES(reportMessages);
    }
  } catch (_error) {
    // Chrome's built-in locale remains the fallback.
  }
  injectStyles();
  scanAndInjectButtons();
  observeJournalActions();
  injectLogTimeButton(); // For single report issue
  injectMonthlyLogButton(); // For logging the entire month
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (journalObserver) journalObserver.disconnect();
});

// ====================
// GLOBAL HELPER FUNCTIONS
// ====================

/**
 * Retrieves the settings required by Redmine reporting through the background service worker.
 */
async function getSettings() {
  const response = await sendRuntimeMessage({ type: "GET_REPORT_SETTINGS" });
  return response.data || {};
}

// ====================
// MONTHLY LOGGING FEATURE
// ====================

/**
 * Injects the 'Log Time Tháng' button into the top menu.
 */
function injectMonthlyLogButton() {
  const topMenu = document.querySelector("#top-menu ul");
  if (!topMenu || document.querySelector("#tb-monthly-log-btn")) {
    return;
  }

  const listItem = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#";
  link.id = "tb-monthly-log-btn";
  link.className = "icon icon-time-add";
  link.textContent = reportMessage("report_log_month");
  link.onclick = (e) => {
    e.preventDefault();
    logTimeForMonth();
  };

  listItem.appendChild(link);
  topMenu.appendChild(listItem);
}

/**
 * Main logic for logging time for the entire month.
 */
async function logTimeForMonth() {
  const settings = await getSettings();
  const { redmineDomain, reportProjectId, hasRedmineApiKey } = settings;

  if (!redmineDomain || !hasRedmineApiKey || !reportProjectId) {
    alert(reportMessage("report_settings_required"));
    return;
  }

  // API key stays in the service worker; pass empty key so redmine.js proxies requests.
  const redmineApiKey = "";

  const currentMonthLabel = `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
  openMonthlyLogModal({
    monthLabel: currentMonthLabel,
    redmineDomain,
    onPreview: async (modalInstance) => {
      const {
        previewButton,
        startButton,
        deleteButton,
        closeButton,
        progressList,
        resultBody,
        statusText,
        copyButton,
      } = modalInstance;
      previewButton.disabled = true;
      startButton.disabled = true;
      startButton.textContent = reportMessage("report_confirm_logging");
      deleteButton.disabled = true;
      closeButton.disabled = true;
      previewButton.textContent = reportMessage("report_scanning");
      resultBody.replaceChildren();
      progressList.replaceChildren();
      copyButton.disabled = true;
      modalInstance.previewIssues = [];
      modalInstance.hasUnsafeReplacement = false;

      const updateProgress = (message, type = "info") => {
        const item = document.createElement("div");
        item.className = `tb-monthly-log-progress-item tb-monthly-log-progress-item--${type}`;
        item.textContent = message;
        progressList.appendChild(item);
      };

      try {
        statusText.textContent = reportMessage("report_scanning");
        updateProgress(reportMessage("report_searching"));
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const trackers = await getTrackers(redmineDomain, redmineApiKey);
        const reportTracker = trackers.find((tracker) => tracker.name.toLowerCase() === "report");
        if (!reportTracker) throw new Error(reportMessage("report_missing_tracker"));

        const issues = await findMonthlyReportIssues(redmineDomain, redmineApiKey, {
          projectId: reportProjectId,
          trackerId: reportTracker.id,
          year,
          month,
          updateProgress,
        });
        const previews = [];
        for (const issue of issues) {
          const date = extractJapaneseReportDate(issue.subject);
          if (!date) continue;
          try {
            const initialPreview = await logTimeFromReport(issue.id, true, date, true);
            const preview = await confirmReportSync(initialPreview, [], true);
            if (!preview) throw new Error(reportMessage("report_sync_cancelled"));
            previews.push({ ...preview, reportSubject: issue.subject });
          } catch (error) {
            previews.push({
              date,
              reportIssueId: String(issue.id),
              reportSubject: issue.subject,
              tasks: [],
              error: error.message,
            });
          }
        }

        modalInstance.previewIssues = previews;
        modalInstance.hasUnsafeReplacement = previews.some(
          (preview) => preview.willReplaceDailyEntries
        );
        for (const preview of previews) {
          const row = document.createElement("tr");
          row.className = preview.willReplaceDailyEntries ? "tb-monthly-log-row-warning" : "";
          const dateCell = document.createElement("td");
          const reportCell = document.createElement("td");
          const taskCell = document.createElement("td");
          const hoursCell = document.createElement("td");
          const statusCell = document.createElement("td");
          dateCell.textContent = preview.date;
          reportCell.textContent = `#${preview.reportIssueId} ${preview.reportSubject}`;
          taskCell.textContent = preview.error
            ? "—"
            : preview.tasks.map((task) => `#${task.id} ${task.subject}`).join("\n");
          hoursCell.textContent = preview.tasks.map((task) => `${task.hours}h`).join(" + ");
          statusCell.textContent = preview.error
            ? reportMessage("report_preview_failed", { error: preview.error })
            : preview.willReplaceDailyEntries
              ? reportMessage("report_preview_replace_warning", {
                  hours: preview.existingDailyHours,
                })
              : preview.dayAlreadyFull
                ? reportMessage("report_day_full", { hours: preview.existingDailyHours })
                : preview.tasks.some((task) => task.alreadyLogged)
                  ? reportMessage("report_preview_duplicate")
                  : reportSyncSummary(preview);
          row.append(dateCell, reportCell, taskCell, hoursCell, statusCell);
          resultBody.appendChild(row);
        }

        if (previews.length === 0) {
          statusText.textContent = reportMessage("report_not_found");
          updateProgress(reportMessage("report_no_matching_issue"), "skip");
        } else {
          statusText.textContent = reportMessage("report_preview_complete", {
            count: previews.length,
          });
          const blocked = previews.some(
            (preview) => preview.willReplaceDailyEntries || preview.error
          );
          startButton.disabled = blocked;
          updateProgress(
            blocked
              ? reportMessage("report_preview_review_warning")
              : reportMessage("report_preview_confirm_hint"),
            blocked ? "skip" : "success"
          );
        }
      } catch (error) {
        statusText.textContent = reportMessage("report_error");
        updateProgress(reportMessage("report_fatal_error", { error: error.message }), "error");
      } finally {
        previewButton.disabled = false;
        previewButton.textContent = reportMessage("report_check_tasks");
        deleteButton.disabled = false;
        closeButton.disabled = false;
      }
    },
    onDelete: async (modalInstance) => {
      if (!confirm(reportMessage("report_confirm_delete"))) {
        return;
      }

      const { startButton, previewButton, deleteButton, closeButton, progressList, statusText } =
        modalInstance;
      startButton.disabled = true;
      previewButton.disabled = true;
      deleteButton.disabled = true;
      closeButton.disabled = true;
      statusText.textContent = reportMessage("report_deleting");

      const updateProgress = (message, type = "info") => {
        const item = document.createElement("div");
        item.className = `tb-monthly-log-progress-item tb-monthly-log-progress-item--${type}`;
        item.textContent = message;
        progressList.appendChild(item);
        progressList.scrollTop = progressList.scrollHeight;
      };

      try {
        const deletedCount = await deleteCurrentMonthSpentTime(
          redmineDomain,
          redmineApiKey,
          updateProgress
        );
        statusText.textContent = reportMessage("report_deleted");
        updateProgress(reportMessage("report_deleted_count", { count: deletedCount }), "success");
      } catch (error) {
        statusText.textContent = reportMessage("report_delete_failed");
        updateProgress(`${reportMessage("report_delete_error")}: ${error.message}`, "error");
      } finally {
        modalInstance.previewIssues = [];
        modalInstance.hasUnsafeReplacement = false;
        startButton.disabled = true;
        previewButton.disabled = false;
        deleteButton.disabled = false;
        closeButton.disabled = false;
      }
    },
    onStart: async (modalInstance) => {
      if (modalInstance.hasUnsafeReplacement) {
        alert(reportMessage("report_preview_review_warning"));
        return;
      }
      const { startButton, closeButton, progressList, resultBody, copyButton, statusText } =
        modalInstance;
      startButton.disabled = true;
      modalInstance.previewButton.disabled = true;
      modalInstance.deleteButton.disabled = true;
      closeButton.disabled = true;
      resultBody.replaceChildren();
      copyButton.disabled = true;

      const updateProgress = (message, type = "info") => {
        const item = document.createElement("div");
        item.className = `tb-monthly-log-progress-item tb-monthly-log-progress-item--${type}`;
        item.textContent = message;
        progressList.appendChild(item);
        progressList.scrollTop = progressList.scrollHeight;
      };

      const renderResultRow = (result) => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        const reportCell = document.createElement("td");
        const tasksCell = document.createElement("td");
        const hoursCell = document.createElement("td");
        const statusCell = document.createElement("td");

        dateCell.textContent = result.date;
        reportCell.textContent = result.report || "";
        tasksCell.textContent = result.tasks;
        hoursCell.textContent = result.hours || "";
        statusCell.textContent = result.status;

        row.append(dateCell, reportCell, tasksCell, hoursCell, statusCell);
        resultBody.appendChild(row);
      };

      try {
        statusText.textContent = reportMessage("report_starting_logging");
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const copyRowsByDate = createMonthlyCopyRows(year, month);
        const issues = modalInstance.previewIssues || [];

        if (issues.length === 0) {
          statusText.textContent = reportMessage("report_not_found");
          updateProgress(reportMessage("report_no_matching_issue"));
          startButton.disabled = true;
          closeButton.disabled = false;
          return;
        }

        statusText.textContent = reportMessage("report_logging_now");
        updateProgress(reportMessage("report_found_issues", { count: issues.length }));

        const resultsForSheet = [];
        let failedReportCount = 0;
        for (const issue of issues) {
          if (issue.error || issue.willReplaceDailyEntries || issue.dayAlreadyFull) {
            continue;
          }
          if (issue.tasks.length === 0) {
            updateProgress(`${issue.date}: ${reportMessage("report_no_tasks")}`, "skip");
            continue;
          }
          const dateLabel = issue.date || `issue #${issue.reportIssueId}`;
          try {
            updateProgress(dateLabel, "date");
            const fresh = await logTimeFromReport(issue.reportIssueId, true, dateLabel, true);
            const currentPlan = planReportSync(fresh, issue.selectedEntryIds);
            if (
              fresh.existingEntriesSnapshot !== issue.existingEntriesSnapshot ||
              JSON.stringify(currentPlan.operations) !== JSON.stringify(issue.operations)
            ) {
              throw new Error(reportMessage("report_preview_stale"));
            }
            const deletions = currentPlan.operations.filter((op) => op.type === "delete");
            if (
              deletions.length &&
              !confirmTimeEntryDeletion(
                deletions.length,
                deletions
                  .map((op) => `log #${op.entryId} / #${op.taskId} / ${op.oldHours}h`)
                  .join("\n")
              )
            ) {
              updateProgress(`${dateLabel}: ${reportMessage("report_sync_cancelled")}`, "skip");
              continue;
            }
            const approvedPlan = { ...issue, confirmedAt: Date.now() };
            const logResult = await logTimeFromReport(
              issue.reportIssueId,
              true,
              dateLabel,
              false,
              approvedPlan
            );

            if (logResult.taskIds.length > 0) {
              const taskById = new Map((issue.tasks || []).map((task) => [String(task.id), task]));
              const status = getLogResultStatusText(logResult);
              resultsForSheet.push({
                date: dateLabel,
                report: `#${issue.reportIssueId} ${issue.reportSubject}`,
                tasks: logResult.taskIds
                  .map((taskId) => `#${taskId} ${taskById.get(String(taskId))?.subject || ""}`)
                  .join("\n"),
                hours: issue.tasks.map((task) => `${task.hours}h`).join(" + "),
                status,
              });
              copyRowsByDate.set(dateLabel, logResult.taskIds.map((t) => `#${t}`).join(","));
              renderResultRow(resultsForSheet[resultsForSheet.length - 1]);
              if (logResult.dayUpserted) {
                updateProgress(
                  reportMessage("report_updated_spent_time", {
                    hours: logResult.existingDailyHours,
                  }),
                  "success"
                );
              } else if (logResult.dayAlreadyFull) {
                updateProgress(
                  reportMessage("report_day_full", { hours: logResult.existingDailyHours }),
                  "skip"
                );
              } else {
                updateProgress(
                  reportMessage("report_logged_tasks", {
                    logged: logResult.loggedTaskIds.length,
                    skipped: logResult.skippedTaskIds.length,
                  }),
                  "success"
                );
              }
            } else {
              updateProgress(reportMessage("report_no_tasks"), "skip");
            }
          } catch (error) {
            failedReportCount += 1;
            const partialResult = error.logResult;
            if (partialResult?.taskIds?.length > 0) {
              resultsForSheet.push({
                date: dateLabel,
                report: `#${issue.reportIssueId} ${issue.reportSubject}`,
                tasks: partialResult.taskIds.map((t) => `#${t}`).join(","),
                hours: issue.tasks.map((task) => `${task.hours}h`).join(" + "),
                status: `Partial: logged ${partialResult.loggedTaskIds.length}, failed ${partialResult.failedTasks.length}`,
              });
              copyRowsByDate.set(dateLabel, partialResult.taskIds.map((t) => `#${t}`).join(","));
              renderResultRow(resultsForSheet[resultsForSheet.length - 1]);
              updateProgress(
                reportMessage("report_partial_error", {
                  logged: partialResult.loggedTaskIds.length,
                  skipped: partialResult.skippedTaskIds.length,
                  failed: partialResult.failedTasks.length,
                  error: error.message,
                }),
                "error"
              );
            } else {
              updateProgress(
                reportMessage("report_error_detail", { error: error.message }),
                "error"
              );
            }
          }
        }

        statusText.textContent = failedReportCount
          ? reportMessage("report_logging_partial", { count: failedReportCount })
          : resultsForSheet.length
            ? reportMessage("report_logging_complete")
            : reportMessage("report_no_tasks");
        if (resultsForSheet.length) {
          updateProgress(reportMessage("report_complete_timesheet"));
        }

        copyButton.disabled = resultsForSheet.length === 0;
        copyButton.onclick = () => {
          const copyText = [...copyRowsByDate.values()].join("\n");
          navigator.clipboard
            .writeText(copyText)
            .then(() => {
              alert(reportMessage("report_copied_tasks"));
            })
            .catch(() => {
              copyTextWithSelectionFallback(copyText);
              alert(reportMessage("report_copied_tasks"));
            });
        };

        startButton.disabled = true;
        startButton.textContent = reportMessage("report_logged_button");
        closeButton.disabled = false;
      } catch (error) {
        statusText.textContent = reportMessage("report_error");
        updateProgress(reportMessage("report_fatal_error", { error: error.message }));
        startButton.disabled = true;
        closeButton.disabled = false;
      } finally {
        startButton.textContent = reportMessage("report_logged_button");
        modalInstance.previewButton.disabled = false;
        modalInstance.deleteButton.disabled = false;
      }
    },
  });
}

function createMonthlyCopyRows(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = new Map();

  for (let day = 1; day <= daysInMonth; day++) {
    rows.set(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "");
  }

  return rows;
}

function copyTextWithSelectionFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } catch (error) {
    console.warn("Copy fallback failed:", error);
  } finally {
    textarea.remove();
  }
}

function getLogResultStatusText(logResult) {
  if (logResult.synchronized) return reportSyncSummary(logResult);
  if (logResult.dayUpserted) {
    return `Updated: replaced existing ${logResult.existingDailyHours}h`;
  }

  if (logResult.dayAlreadyFull) {
    return `Skipped: already ${logResult.existingDailyHours}h`;
  }

  return `Logged ${logResult.loggedTaskIds.length}, skipped ${logResult.skippedTaskIds.length}`;
}

async function deleteCurrentMonthSpentTime(redmineDomain, redmineApiKey, updateProgress) {
  return navigator.locks.request("b2r-report-time-write", { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error(reportMessage("report_delete_busy"));
    return executeMonthlyTimeDelete(redmineDomain, redmineApiKey, updateProgress);
  });
}

async function executeMonthlyTimeDelete(redmineDomain, redmineApiKey, updateProgress) {
  const currentUser = await getCurrentUser(redmineDomain, redmineApiKey);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dates = [...createMonthlyCopyRows(year, month).keys()];
  const entriesToDelete = [];

  updateProgress(
    `${reportMessage("report_checking_spent_time")} ${year}-${String(month).padStart(2, "0")}...`
  );

  for (const spentOn of dates) {
    const entries = await findTimeEntries(redmineDomain, redmineApiKey, {
      spent_on: spentOn,
      user_id: currentUser.id,
      limit: 100,
    });

    for (const entry of entries) {
      if (!isSafeMonthlyDeleteEntry(entry, currentUser, spentOn)) {
        throw new Error(
          `${reportMessage("report_entry_not_verified")} #${entry?.id || "unknown"} (${spentOn}).`
        );
      }
      if (/^\[B2R report:\d+\]$/.test(entry.comments || "")) entriesToDelete.push(entry);
    }
  }

  updateProgress(`${reportMessage("report_entries_to_delete")} ${entriesToDelete.length}.`);
  if (!entriesToDelete.length) return 0;
  const detail = entriesToDelete
    .map(
      (entry) =>
        `${entry.spent_on}: log #${entry.id} / #${entry.issue?.id ?? entry.issue_id} / ${entry.hours}h`
    )
    .join("\n");
  if (!confirmTimeEntryDeletion(entriesToDelete.length, detail)) {
    throw new Error(reportMessage("report_sync_cancelled"));
  }
  const confirmedAt = Date.now();
  let deleted = 0;

  for (const entry of entriesToDelete) {
    await deleteTimeEntry(redmineDomain, redmineApiKey, entry.id, {
      entry,
      domain: redmineDomain,
      date: entry.spent_on,
      reportId: entry.comments.match(/^\[B2R report:(\d+)\]$/)[1],
      confirmedAt,
      allowLegacy: false,
    });
    deleted += 1;
    updateProgress(
      `${reportMessage("report_deleted_count", { count: deleted })} / ${entriesToDelete.length}`
    );
  }

  return entriesToDelete.length;
}

function isSafeMonthlyDeleteEntry(entry, currentUser, spentOn) {
  const entryUserId = entry?.user?.id ?? entry?.user_id;
  return (
    !!entry?.id &&
    !!entryUserId &&
    !!currentUser?.id &&
    entry.spent_on === spentOn &&
    Number(entryUserId) === Number(currentUser.id)
  );
}

function openMonthlyLogModal({ monthLabel, redmineDomain, onPreview, onStart, onDelete }) {
  const overlay = document.createElement("div");
  overlay.className = "tb-monthly-log-overlay";
  overlay.innerHTML = `
    <section class="tb-monthly-log-dialog" role="dialog" aria-modal="true" aria-labelledby="tb-monthly-log-title">
      <header class="tb-monthly-log-header">
        <div>
        <p class="tb-monthly-log-kicker">${reportMessage("report_spent_time")}</p>
          <h2 id="tb-monthly-log-title">${reportMessage("report_log_time_month")} ${monthLabel}</h2>
          <p id="tb-monthly-log-status" class="tb-monthly-log-status">${reportMessage("report_ready_to_scan")}</p>
        </div>
        <button type="button" class="tb-monthly-log-close" aria-label="${reportMessage("modal_close_aria")}">&times;</button>
      </header>
      <div class="tb-monthly-log-body">
        <div class="tb-monthly-log-grid">
          <section class="tb-monthly-log-panel">
            <div class="tb-monthly-log-panel-title">${reportMessage("report_progress")}</div>
            <div id="tb-monthly-log-progress" class="tb-monthly-log-progress"></div>
          </section>
          <section class="tb-monthly-log-panel">
            <div class="tb-monthly-log-panel-title">${reportMessage("report_preview_title")}</div>
            <div class="tb-monthly-log-table-wrap">
              <table id="timesheet-results-table" class="tb-monthly-log-table">
                <thead>
                  <tr><th>${reportMessage("report_date")}</th><th>${reportMessage("report_issue")}</th><th>${reportMessage("report_tasks")}</th><th>${reportMessage("report_hours")}</th><th>${reportMessage("report_status")}</th></tr>
                </thead>
                <tbody id="tb-monthly-log-results"></tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <footer class="tb-monthly-log-footer">
        <button type="button" id="tb-time-backups" class="tb-btn tb-btn-secondary">${reportMessage("report_export_backups")}</button>
        <button type="button" id="tb-monthly-log-delete" class="tb-btn tb-btn-danger">${reportMessage("report_delete_spent_time")}</button>
        <button type="button" id="tb-monthly-log-copy" class="tb-btn tb-btn-secondary" disabled>${reportMessage("report_copy_table")}</button>
        <button type="button" id="tb-monthly-log-preview" class="tb-btn tb-btn-secondary">${reportMessage("report_check_tasks")}</button>
        <button type="button" id="tb-monthly-log-start" class="tb-btn tb-btn-primary" disabled>${reportMessage("report_confirm_logging")}</button>
      </footer>
    </section>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#tb-time-backups").onclick = async () => {
    try {
      const stored = await chrome.storage.local.get(null);
      const backups = Object.entries(stored)
        .filter(
          ([key, value]) =>
            key.startsWith("b2r_time_backup:") &&
            value?.domain &&
            new URL(value.domain).origin === new URL(redmineDomain).origin
        )
        .map(([, value]) => value);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backups, null, 2)], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "b2r-time-entry-backups.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      alert(error.message);
    }
  };
  document.body.classList.add("tb-modal-open");

  const closeButton = overlay.querySelector(".tb-monthly-log-close");
  const previewButton = overlay.querySelector("#tb-monthly-log-preview");
  const startButton = overlay.querySelector("#tb-monthly-log-start");
  const modalInstance = {
    overlay,
    previewButton,
    startButton,
    closeButton,
    deleteButton: overlay.querySelector("#tb-monthly-log-delete"),
    copyButton: overlay.querySelector("#tb-monthly-log-copy"),
    statusText: overlay.querySelector("#tb-monthly-log-status"),
    progressList: overlay.querySelector("#tb-monthly-log-progress"),
    resultBody: overlay.querySelector("#tb-monthly-log-results"),
    table: overlay.querySelector("#timesheet-results-table"),
  };

  const close = () => {
    overlay.remove();
    document.body.classList.remove("tb-modal-open");
  };
  closeButton.onclick = close;
  overlay.onclick = (event) => {
    if (event.target === overlay && !closeButton.disabled) close();
  };
  previewButton.onclick = () => onPreview(modalInstance);
  startButton.onclick = () => onStart(modalInstance);
  modalInstance.deleteButton.onclick = () => onDelete(modalInstance);

  return modalInstance;
}

async function findMonthlyReportIssues(
  redmineDomain,
  redmineApiKey,
  { projectId, trackerId, year, month, updateProgress }
) {
  const searchTerms = [`${year}年${month}月`, `${year}年${String(month).padStart(2, "0")}月`];
  const uniqueTerms = [...new Set(searchTerms)];
  const issuesById = new Map();

  for (const subjectQuery of uniqueTerms) {
    updateProgress(`${reportMessage("report_search_subject")} "${subjectQuery}"`);
    const issues = await findIssues(redmineDomain, redmineApiKey, {
      project_id: projectId,
      tracker_id: trackerId,
      subject: `~${subjectQuery}`,
      status_id: "*",
      limit: 100,
    });

    for (const issue of issues) {
      issuesById.set(String(issue.id), issue);
    }
  }

  const issuesByDate = new Map();
  for (const issue of issuesById.values()) {
    const reportDate = extractJapaneseReportDate(issue.subject);
    if (!reportDate || !isDateInMonth(reportDate, year, month)) {
      continue;
    }

    if (!issuesByDate.has(reportDate)) {
      issuesByDate.set(reportDate, issue);
    }
  }

  return [...issuesByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([, issue]) => issue);
}

function extractJapaneseReportDate(subject = "") {
  const dateMatch = subject.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isDateInMonth(dateText, year, month) {
  return dateText.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}

// ====================
// SINGLE REPORT LOGGING
// ====================

async function injectLogTimeButton() {
  const issuePageMatch = window.location.pathname.match(/\/issues\/(\d+)/);
  if (!issuePageMatch) return;

  const issueId = issuePageMatch[1];

  const isReport =
    document.querySelector("#attributes td.tracker")?.innerText.trim().toLowerCase() === "report";
  if (isReport) {
    const container = document.querySelector("div.contextual");
    if (!container || container.querySelector("#tb-log-time-btn")) return;

    const button = document.createElement("a");
    button.href = "#";
    button.id = "tb-log-time-btn";
    button.className = "icon icon-time-add";
    button.innerText = reportMessage("report_log_8h");

    button.onclick = async (e) => {
      e.preventDefault();
      if (button.classList.contains("disabled")) return;
      button.innerText = reportMessage("report_processing");
      button.classList.add("disabled");
      try {
        const initialPreview = await logTimeFromReport(issueId, true, null, true);
        const preview = await confirmReportSync(initialPreview);
        if (!preview) {
          button.innerText = reportMessage("report_log_8h");
          return;
        }
        await logTimeFromReport(issueId, false, preview.date, false, preview);
        button.innerText = reportMessage("report_success");
      } catch (error) {
        button.innerText = reportMessage("report_error_check_console");
        console.error("Failed to log time from report:", error);
      } finally {
        button.classList.remove("disabled");
      }
    };

    Object.assign(button.style, { marginRight: "8px", fontWeight: "bold" });
    container.prepend(button);
  }
}

function reportSyncSummary(preview) {
  return reportMessage("report_sync_summary", {
    preserved: preview.preservedHours,
    create: preview.operations.filter((op) => op.type === "create").length,
    update: preview.operations.filter((op) => op.type === "update").length,
    delete: preview.operations.filter((op) => op.type === "delete").length,
  });
}

function confirmReportSync(
  initialPreview,
  initialSelectedIds = [],
  deferDeletionConfirmation = false
) {
  if (!initialPreview.tasks.length) return Promise.resolve(initialPreview);
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    Object.assign(dialog.style, {
      maxWidth: "680px",
      width: "85vw",
      maxHeight: "85vh",
      overflow: "auto",
      padding: "24px",
    });
    const heading = document.createElement("h2");
    heading.id = "tb-report-sync-title";
    heading.textContent = `${reportMessage("report_sync_title")} #${initialPreview.reportIssueId} — ${initialPreview.date}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    const hint = document.createElement("p");
    hint.textContent = reportMessage("report_sync_hint");
    const choices = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = reportMessage("report_sync_legacy");
    choices.append(legend);
    const selected = new Set(initialSelectedIds.map(String));
    let preview = initialPreview;
    const summary = document.createElement("p");
    summary.setAttribute("aria-live", "polite");
    const operations = document.createElement("pre");
    operations.style.whiteSpace = "pre-wrap";
    const render = () => {
      preview = planReportSync(initialPreview, [...selected]);
      summary.textContent = reportSyncSummary(preview);
      operations.textContent =
        preview.operations
          .map(
            (op) =>
              `${reportMessage(`report_sync_${op.type}`)} ${op.entryId ? `log #${op.entryId} / ` : ""}#${op.taskId}: ${op.oldHours}h → ${op.hours}h`
          )
          .join("\n") || reportMessage("report_sync_no_changes");
    };
    for (const entry of initialPreview.candidates) {
      const label = document.createElement("label");
      label.style.display = "block";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(String(entry.id));
      checkbox.onchange = () => {
        if (checkbox.checked) selected.add(String(entry.id));
        else selected.delete(String(entry.id));
        render();
      };
      label.append(
        checkbox,
        document.createTextNode(
          ` log #${entry.id} / #${entry.issue?.id ?? entry.issue_id ?? "—"}: ${entry.hours}h — ${entry.comments || ""}`
        )
      );
      choices.append(label);
    }
    choices.hidden = !initialPreview.candidates.length;
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = reportMessage("report_sync_accept");
    accept.disabled = !initialPreview.tasks.length;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = reportMessage("report_sync_cancel");
    const finish = (value) => {
      dialog.close();
      dialog.remove();
      previousFocus?.focus();
      resolve(value);
    };
    accept.onclick = () => {
      const deletions = preview.operations.filter((op) => op.type === "delete");
      if (
        !deferDeletionConfirmation &&
        deletions.length &&
        !confirmTimeEntryDeletion(
          deletions.length,
          deletions.map((op) => `log #${op.entryId} / #${op.taskId} / ${op.oldHours}h`).join("\n")
        )
      ) {
        return;
      }
      finish({ ...preview, confirmedAt: Date.now() });
    };
    cancel.onclick = () => finish(null);
    dialog.oncancel = (event) => {
      event.preventDefault();
      finish(null);
    };
    dialog.append(heading, hint, choices, summary, operations, cancel, accept);
    document.body.append(dialog);
    render();
    dialog.showModal();
    cancel.focus();
  });
}

function confirmTimeEntryDeletion(count, details) {
  const phrase = `DELETE ${count}`;
  return (
    prompt(reportMessage("report_delete_typed", { count, phrase }) + "\n\n" + details) === phrase
  );
}

// ====================
// BACKLOG SYNCING FEATURE (Existing logic)
// ====================

function observeJournalActions() {
  const targetContainer =
    document.querySelector("#history") || document.querySelector(".journals") || document.body;

  journalObserver = new MutationObserver((mutations) => {
    let shouldRescan = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("div.journal div.contextual")) {
            injectButtonIfNeeded(node);
          } else {
            node.querySelectorAll?.("div.journal div.contextual").forEach(injectButtonIfNeeded);
            shouldRescan = true;
          }
        }
      }
    }
    if (shouldRescan) {
      scanAndInjectButtons();
    }
  });
  journalObserver.observe(targetContainer, { childList: true, subtree: true });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.journal div.contextual").forEach(injectButtonIfNeeded);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") return;

  const button = document.createElement("a");
  button.href = "#";
  button.className = `${BUTTON_CLASS} icon icon-share`;
  button.title = TB.MESSAGES.BUTTON_TITLE_BACKLOG;
  button.innerHTML = `<span class="tb-backlog-btn__icon">${BACKLOG_ICON}</span><span class="tb-backlog-btn__text">Backlog</span>`;
  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleExtractAndOpenModal(actionsEl, button);
  };

  const quoteBtn = actionsEl.querySelector("a.icon-comment");
  quoteBtn ? quoteBtn.before(button) : actionsEl.appendChild(button);
  actionsEl.dataset.tbInjected = "1";
}

async function handleExtractAndOpenModal(actionsEl, button) {
  const commentContentEl = actionsEl.closest(".journal")?.querySelector("div.wiki");
  const rawText = commentContentEl?.innerText?.trim() || "";
  if (!rawText) {
    showToast(TB.MESSAGES.TOAST.NO_COMMENT_CONTENT, "error");
    return;
  }

  const backlogIssueKey = findBacklogKeyInPage();
  setButtonLoading(button, true);

  try {
    const attachments = extractRedmineAttachments(commentContentEl);
    const result = await sendRuntimeMessage({
      type: "EXTRACT_JAPANESE_CONTENT",
      commentText: rawText,
    });
    openBacklogModal({
      backlogIssueKey,
      previewText: result.data.previewText,
      attachments,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({
        backlogIssueKey: confirmedKey,
        content,
        notifiedUserId,
        attachments: confirmedAttachments,
      }) => {
        let sendResult;
        try {
          sendResult = await sendRuntimeMessage({
            type: "SEND_TO_BACKLOG",
            backlogIssueKey: confirmedKey,
            content,
            notifiedUserId,
            attachments: confirmedAttachments,
          });
        } catch (error) {
          await recordSyncActivity({
            operation: "reverse-sync",
            issue: confirmedKey,
            count: 0,
            ok: false,
            detail: error?.message || "Unknown error",
            url: window.location.href,
          });
          throw error;
        }
        await recordSyncActivity({
          operation: "reverse-sync",
          issue: confirmedKey,
          count: 1,
          ok: true,
          url: sendResult.data.backlogUrl,
        });
        await openSuccessModal({
          redmineUrl: sendResult.data.backlogUrl,
          onClose: () => setButtonLoading(button, false),
          isBacklog: true,
        });
      },
    });
    setButtonLoading(button, false);
  } catch (err) {
    await recordSyncActivity({
      operation: "reverse-sync",
      issue: backlogIssueKey || "",
      count: 0,
      ok: false,
      detail: err?.message || "Unknown error",
      url: window.location.href,
    });
    setButtonLoading(button, false);
    showToast(err.message, "error");
  }
}

function extractRedmineAttachments(contentEl) {
  const attachments = [];
  if (!contentEl) return attachments;

  const attachmentLinks = contentEl.querySelectorAll("a[href*='/attachments/download']");
  attachmentLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const text = link.innerText.trim();
    if (href && text) {
      const attachmentId = href.match(/\/attachments\/download\/(\d+)/)?.[1];
      if (attachmentId) {
        attachments.push({
          id: attachmentId,
          filename: text,
          url: href,
        });
      }
    }
  });

  const images = contentEl.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.includes("/attachments/download")) {
      const attachmentId = src.match(/\/attachments\/download\/(\d+)/)?.[1];
      const filename = img.getAttribute("alt") || `image_${attachmentId}`;
      if (attachmentId && !attachments.find((a) => a.id === attachmentId)) {
        attachments.push({
          id: attachmentId,
          filename,
          url: src,
          isImage: true,
        });
      }
    }
  });

  return attachments;
}

function findBacklogKeyInPage() {
  const patterns = [/([A-Z0-9_]+-[0-9]+)/];
  const title = document.querySelector("#content h2")?.innerText || "";
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1];
  }
  const desc = document.querySelector("div.description div.wiki")?.innerText || "";
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[1];
  }
  return "";
}

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.5" : "1";
  btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
  btn.innerHTML = isLoading
    ? `<span class="tb-loading">${TB.MESSAGES.PROCESSING}</span>`
    : btn.dataset.originalHtml;
  globalThis.TB_ACTIVE_AI_STATUS_TARGET = isLoading ? btn.querySelector(".tb-loading") : null;
}
