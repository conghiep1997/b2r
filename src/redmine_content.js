/* globals getTrackers, findIssues, findTimeEntries, deleteTimeEntry, getCurrentUser, getIssueDetails, logTimeFromReport, planReportSync */

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
  return template.replace(/\$([a-z0-9_]+)\$/gi, (token, name) => {
    const val = values[name] ?? values[name.toLowerCase()] ?? values[name.toUpperCase()];
    return val !== undefined ? String(val) : token;
  });
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

async function getReportSettingsForProject(reportProjectId, selection = {}) {
  const response = await sendRuntimeMessage({
    type: "GET_REPORT_SETTINGS",
    reportProjectId: String(reportProjectId),
    ...(selection.profileKey ? { profileKey: selection.profileKey } : {}),
    ...(selection.globalProfile ? { globalProfile: true } : {}),
  });
  if (!response?.ok) throw new Error(response?.error || reportMessage("report_settings_required"));
  return response.data;
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
    logTimeForMonth().catch((error) => {
      console.error("[B2R] Log Time Tháng error:", error);
      alert(error?.message || String(error));
    });
  };

  listItem.appendChild(link);
  topMenu.appendChild(listItem);
}

/**
 * Main logic for logging time for the entire month.
 */
async function logTimeForMonth() {
  const baseSettings = await getSettings();
  const { redmineDomain, reportProjects = [], hasRedmineApiKey } = baseSettings;
  const configuredReportId = baseSettings.reportProjectId;
  if (!redmineDomain || !hasRedmineApiKey || (!reportProjects.length && !configuredReportId)) {
    alert(reportMessage("report_settings_required"));
    return;
  }

  let selectedReportProject = null;
  const preferred = reportProjects.find(
    (p) => String(p.id) === String(configuredReportId) && p.globalProfile
  );
  if (preferred) {
    selectedReportProject = preferred;
  } else if (reportProjects.length === 1) {
    selectedReportProject = reportProjects[0];
  } else if (reportProjects.length > 1) {
    selectedReportProject = await chooseReportProject(reportProjects, configuredReportId);
  } else if (configuredReportId) {
    selectedReportProject = { id: configuredReportId, globalProfile: true };
  }
  if (!selectedReportProject) return;
  const { id: reportProjectId, profileKey, globalProfile } = selectedReportProject;
  let settings;
  try {
    settings = await getReportSettingsForProject(reportProjectId, { profileKey, globalProfile });
  } catch (error) {
    alert(error.message);
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
        bulkActivityToolbar,
        bulkActivitySelect,
        bulkActivityApply,
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
      if (bulkActivityToolbar) bulkActivityToolbar.hidden = true;
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
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const monthLabel = `${String(month).padStart(2, "0")}/${year}`;
        updateProgress(reportMessage("report_searching", { month: monthLabel }));
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
            const initialPreview = await logTimeFromReport(
              issue.id,
              true,
              date,
              true,
              null,
              settings
            );
            const preview = planReportSync(initialPreview, [], settings.logTimeRules);
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
          const statusCell = document.createElement("td");

          dateCell.textContent = preview.date;

          if (preview.reportIssueId) {
            const reportLink = document.createElement("a");
            reportLink.className = "tb-issue-link";
            reportLink.href = `/issues/${preview.reportIssueId}`;
            reportLink.target = "_blank";
            reportLink.rel = "noopener noreferrer";
            reportLink.textContent = `#${preview.reportIssueId}`;
            reportCell.replaceChildren(
              reportLink,
              document.createTextNode(` ${preview.reportSubject || ""}`)
            );
          } else {
            reportCell.textContent = preview.reportSubject || "—";
          }

          if (preview.error || preview.tasks.length === 0) {
            taskCell.textContent = "—";
          } else {
            const activities = preview.availableActivities || [];
            const taskList = document.createElement("div");
            taskList.className = "tb-task-list";

            for (const task of preview.tasks) {
              // Task card
              const card = document.createElement("div");
              card.className = "tb-task-card";

              // Row 1: Full-width task title
              const nameEl = document.createElement("div");
              nameEl.className = "tb-task-name";
              if (task.id) {
                const taskLink = document.createElement("a");
                taskLink.className = "tb-issue-link";
                taskLink.href = `/issues/${task.id}`;
                taskLink.target = "_blank";
                taskLink.rel = "noopener noreferrer";
                taskLink.textContent = `#${task.id}`;
                nameEl.replaceChildren(taskLink, document.createTextNode(` ${task.subject || ""}`));
              } else {
                nameEl.textContent = task.subject || "—";
              }

              // Row 2: Activity select (left) + Hours badge (right)
              const metaRow = document.createElement("div");
              metaRow.className = "tb-task-meta-row";

              const actSelect = document.createElement("select");
              actSelect.className = "tb-activity-select";
              activities.forEach((a) => {
                const opt = new Option(a.name, a.id);
                if (Number(a.id) === Number(task.activityId)) opt.selected = true;
                actSelect.appendChild(opt);
              });
              if (!activities.length) {
                actSelect.disabled = true;
                actSelect.appendChild(new Option(task.activityName || "—", task.activityId || ""));
              }
              actSelect.addEventListener("change", () => {
                task.activityId = Number(actSelect.value);
                task.activityName = actSelect.options[actSelect.selectedIndex]?.text || "";
                // Recompute operations so Start remains consistent
                const updated = planReportSync(
                  preview,
                  preview.selectedEntryIds || [],
                  settings.logTimeRules
                );
                preview.operations = updated.operations;
              });

              const badge = document.createElement("div");
              badge.className = "tb-hours-badge";
              badge.textContent =
                task.hours !== null && task.hours !== undefined
                  ? `${Number.isInteger(task.hours) ? task.hours : task.hours.toFixed(1)}h`
                  : "—";

              metaRow.append(actSelect, badge);
              card.append(nameEl, metaRow);
              taskList.appendChild(card);
            }

            // For multi-task days, show summary total row at the end of task list
            if (preview.tasks.length > 1) {
              const total = preview.tasks.reduce((s, t) => s + (t.hours || 0), 0);
              const summaryRow = document.createElement("div");
              summaryRow.className = "tb-task-list-summary";
              const label = document.createElement("span");
              label.className = "tb-task-summary-label";
              label.textContent = "Tổng:";
              const totalEl = document.createElement("span");
              totalEl.className = "tb-hours-total";
              totalEl.textContent = `∑ ${Number.isInteger(total) ? total : total.toFixed(1)}h`;
              summaryRow.append(label, totalEl);
              taskList.appendChild(summaryRow);
            }

            taskCell.appendChild(taskList);
          }

          statusCell.replaceChildren();
          const statusBadge = document.createElement("span");
          statusBadge.className = "tb-status-badge";

          if (preview.error) {
            statusBadge.classList.add("tb-status-badge--error");
            statusBadge.textContent = "❌ Lỗi";
            statusBadge.title = reportMessage("report_preview_failed", { error: preview.error });
          } else if (preview.willReplaceDailyEntries) {
            statusBadge.classList.add("tb-status-badge--warning");
            statusBadge.textContent = `⚠️ Trùng (${preview.existingDailyHours}h)`;
            statusBadge.title = reportMessage("report_preview_replace_warning", {
              hours: preview.existingDailyHours,
            });
          } else if (preview.dayAlreadyFull) {
            statusBadge.classList.add("tb-status-badge--full");
            statusBadge.textContent = `Đã đủ ${preview.existingDailyHours}h`;
            statusBadge.title = reportMessage("report_day_full", {
              hours: preview.existingDailyHours,
            });
          } else if (preview.tasks.length === 0) {
            statusBadge.classList.add("tb-status-badge--empty");
            statusBadge.textContent = "Không có task";
            statusBadge.title = reportMessage("report_no_tasks");
          } else if (preview.tasks.some((task) => task.alreadyLogged)) {
            statusBadge.classList.add("tb-status-badge--warning");
            statusBadge.textContent = "⚠️ Đã ghi 1 phần";
            statusBadge.title = reportMessage("report_preview_duplicate");
          } else {
            statusBadge.classList.add("tb-status-badge--ready");
            statusBadge.textContent = "Sẵn sàng";
            statusBadge.title = reportMessage("report_preview_ready");
          }
          statusCell.appendChild(statusBadge);

          row.append(dateCell, reportCell, taskCell, statusCell);
          resultBody.appendChild(row);
        }

        if (previews.length === 0) {
          statusText.textContent = reportMessage("report_not_found");
          updateProgress(reportMessage("report_no_matching_issue"), "skip");
          const emptyRow = document.createElement("tr");
          const emptyCell = document.createElement("td");
          emptyCell.colSpan = 4;
          emptyCell.className = "tb-table-empty-state";
          emptyCell.textContent = reportMessage("report_no_matching_issue");
          emptyRow.appendChild(emptyCell);
          resultBody.appendChild(emptyRow);
        } else {
          statusText.textContent = reportMessage("report_preview_complete", {
            count: previews.length,
          });
          const blocked = previews.every(
            (preview) => preview.error || preview.dayAlreadyFull || !preview.tasks.length
          );
          startButton.disabled = blocked;
          updateProgress(
            reportMessage("report_preview_confirm_hint"),
            blocked ? "skip" : "success"
          );

          // Populate bulk activity toolbar if activities exist
          const allActivities =
            previews.find((p) => p.availableActivities?.length)?.availableActivities || [];

          if (
            bulkActivityToolbar &&
            bulkActivitySelect &&
            allActivities.length &&
            previews.some((p) => p.tasks?.length)
          ) {
            bulkActivitySelect.replaceChildren();
            allActivities.forEach((act) => {
              bulkActivitySelect.appendChild(new Option(act.name, act.id));
            });

            // Check if user previously saved a preferred activity
            chrome.storage.local
              .get("b2r_preferred_activity")
              .then(({ b2r_preferred_activity }) => {
                if (
                  b2r_preferred_activity &&
                  allActivities.some((a) => Number(a.id) === Number(b2r_preferred_activity))
                ) {
                  bulkActivitySelect.value = String(b2r_preferred_activity);
                } else {
                  // Default to Coding if exists
                  const coding = allActivities.find((a) => /coding/i.test(a.name));
                  if (coding) bulkActivitySelect.value = String(coding.id);
                }
              })
              .catch(() => {});

            bulkActivityToolbar.hidden = false;

            if (bulkActivityApply) {
              bulkActivityApply.onclick = () => {
                const selectedId = Number(bulkActivitySelect.value);
                const selectedName =
                  bulkActivitySelect.options[bulkActivitySelect.selectedIndex]?.text || "";
                if (!selectedId) return;

                // Remember user preference for future months
                chrome.storage.local.set({ b2r_preferred_activity: selectedId }).catch(() => {});

                // 1. Update all preview task objects and recalculate plans
                for (const preview of previews) {
                  if (preview.tasks && preview.tasks.length) {
                    for (const task of preview.tasks) {
                      task.activityId = selectedId;
                      task.activityName = selectedName;
                    }
                    const updated = planReportSync(
                      preview,
                      preview.selectedEntryIds || [],
                      settings.logTimeRules
                    );
                    preview.operations = updated.operations;
                  }
                }

                // 2. Update all activity dropdowns in the table DOM
                const selects = resultBody.querySelectorAll(".tb-activity-select");
                selects.forEach((sel) => {
                  sel.value = String(selectedId);
                });

                // 3. Visual feedback on button
                const originalText = bulkActivityApply.textContent;
                bulkActivityApply.textContent = reportMessage("report_bulk_activity_applied");
                bulkActivityApply.classList.add("tb-btn-success");
                setTimeout(() => {
                  bulkActivityApply.textContent = originalText;
                  bulkActivityApply.classList.remove("tb-btn-success");
                }, 1200);
              };
            }
          }
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
        if (!confirm(reportMessage("report_preview_review_warning"))) {
          return;
        }
      }
      const {
        startButton,
        closeButton,
        progressList,
        resultBody,
        copyButton,
        statusText,
        bulkActivityToolbar,
      } = modalInstance;
      if (bulkActivityToolbar) bulkActivityToolbar.hidden = true;
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
        const statusCell = document.createElement("td");

        dateCell.textContent = result.date;

        if (result.report) {
          const match = result.report.match(/^#(\d+)\s*(.*)$/);
          if (match) {
            const reportLink = document.createElement("a");
            reportLink.className = "tb-issue-link";
            reportLink.href = `/issues/${match[1]}`;
            reportLink.target = "_blank";
            reportLink.rel = "noopener noreferrer";
            reportLink.textContent = `#${match[1]}`;
            reportCell.replaceChildren(reportLink, document.createTextNode(` ${match[2]}`));
          } else {
            reportCell.textContent = result.report;
          }
        } else {
          reportCell.textContent = "";
        }

        // Render multi-task list with line breaks and clickable links
        const taskLines = (result.tasks || "").split("\n").filter(Boolean);
        if (taskLines.length > 0) {
          tasksCell.replaceChildren();
          taskLines.forEach((line, i) => {
            if (i > 0) tasksCell.appendChild(document.createElement("br"));
            const match = line.match(/^#(\d+)\s*(.*)$/);
            if (match) {
              const taskLink = document.createElement("a");
              taskLink.className = "tb-issue-link";
              taskLink.href = `/issues/${match[1]}`;
              taskLink.target = "_blank";
              taskLink.rel = "noopener noreferrer";
              taskLink.textContent = `#${match[1]}`;
              tasksCell.append(taskLink, document.createTextNode(` ${match[2]}`));
            } else {
              tasksCell.appendChild(document.createTextNode(line));
            }
          });

          // Show total hours summary row if available and multiple tasks
          if (result.hours && taskLines.length > 1) {
            const summaryRow = document.createElement("div");
            summaryRow.className = "tb-task-list-summary";
            const label = document.createElement("span");
            label.className = "tb-task-summary-label";
            label.textContent = "Tổng:";
            const totalEl = document.createElement("span");
            totalEl.className = "tb-hours-total";
            totalEl.textContent = `∑ ${result.hours}`;
            summaryRow.append(label, totalEl);
            tasksCell.appendChild(summaryRow);
          }
        } else {
          tasksCell.textContent = result.tasks || "";
        }

        // Apply row styling and badge based on result status
        const statusLower = (result.status || "").toLowerCase();
        const badge = document.createElement("span");
        badge.className = "tb-status-badge";
        if (statusLower.includes("partial") || statusLower.includes("failed")) {
          row.classList.add("tb-result-row-partial");
          badge.classList.add("tb-status-badge--warning");
          badge.textContent = "Một phần";
          badge.title = result.status;
        } else if (statusLower.startsWith("logged") || statusLower.includes("success")) {
          row.classList.add("tb-result-row-success");
          badge.classList.add("tb-status-badge--success");
          badge.textContent = "Đã log";
          badge.title = result.status;
        } else {
          badge.classList.add("tb-status-badge--ready");
          badge.textContent = result.status || "OK";
        }
        statusCell.replaceChildren(badge);

        row.append(dateCell, reportCell, tasksCell, statusCell);
        resultBody.appendChild(row);
      };

      try {
        statusText.textContent = reportMessage("report_starting_logging");
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const copyRowsByDate = createMonthlyCopyRows(year, month);
        let issues = modalInstance.previewIssues || [];

        if (issues.length === 0) {
          issues = await scanCurrentMonthReports({
            redmineDomain,
            redmineApiKey,
            reportProjectId,
            settings,
            updateProgress,
          });
          modalInstance.previewIssues = issues;
        }

        if (issues.length === 0) {
          statusText.textContent = reportMessage("report_not_found");
          updateProgress(reportMessage("report_no_matching_issue"));
          startButton.disabled = true;
          closeButton.disabled = false;
          return;
        }

        statusText.textContent = reportMessage("report_logging_now");
        updateProgress(reportMessage("report_found_issues", { count: issues.length }));

        const replacementDays = issues.filter((issue) =>
          issue.operations?.some((op) => op.type === "delete" || op.type === "update")
        );
        const replacementOperations = replacementDays.flatMap((issue) => issue.operations || []);
        const replacementCount = replacementOperations.filter((op) => op.type === "delete").length;
        if (
          replacementDays.length &&
          !confirmTimeEntryDeletion(
            replacementCount || replacementDays.length,
            replacementDays.map((issue) => `${issue.date}: ${reportSyncSummary(issue)}`).join("\n")
          )
        ) {
          updateProgress(reportMessage("report_sync_cancelled"), "skip");
          startButton.disabled = false;
          closeButton.disabled = false;
          return;
        }

        const resultsForSheet = [];
        let failedReportCount = 0;
        for (const issue of issues) {
          if (issue.error || issue.dayAlreadyFull) {
            continue;
          }
          if (issue.tasks.length === 0) {
            updateProgress(`${issue.date}: ${reportMessage("report_no_tasks")}`, "skip");
            continue;
          }
          const dateLabel = issue.date || `issue #${issue.reportIssueId}`;
          try {
            updateProgress(dateLabel, "date");
            const fresh = await logTimeFromReport(
              issue.reportIssueId,
              true,
              dateLabel,
              true,
              null,
              settings
            );
            const currentPlan = planReportSync(
              fresh,
              issue.selectedEntryIds || [],
              settings.logTimeRules
            );
            if (
              fresh.existingEntriesSnapshot !== issue.existingEntriesSnapshot ||
              JSON.stringify(currentPlan.operations) !== JSON.stringify(issue.operations)
            ) {
              throw new Error(reportMessage("report_preview_stale"));
            }
            const hasReplacement = replacementDays.some(
              (day) => day.reportIssueId === issue.reportIssueId
            );
            if (
              currentPlan.operations.some((op) => op.type === "delete" || op.type === "update") &&
              !hasReplacement
            ) {
              throw new Error(reportMessage("report_preview_stale"));
            }
            const approvedPlan = { ...currentPlan, confirmedAt: Date.now() };
            const logResult = await logTimeFromReport(
              issue.reportIssueId,
              true,
              dateLabel,
              false,
              approvedPlan,
              settings
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

async function scanCurrentMonthReports({
  redmineDomain,
  redmineApiKey,
  reportProjectId,
  settings,
  updateProgress = () => {},
}) {
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
      const initial = await logTimeFromReport(issue.id, true, date, true, null, settings);
      previews.push({
        ...planReportSync(initial, [], settings.logTimeRules),
        reportSubject: issue.subject,
      });
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
  return previews;
}

function chooseReportProject(projects, preferredId = "") {
  if (projects.length === 1) return Promise.resolve(projects[0]);
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "tb-modal-overlay";
    overlay.style.display = "flex";
    const dialog = document.createElement("section");
    dialog.className = "tb-modal-container";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.textContent = reportMessage("report_choose_project");
    const select = document.createElement("select");
    select.className = "tb-report-project-select";
    for (const project of projects) {
      const key = project.profileKey
        ? `${project.id}:${project.profileKey}`
        : project.globalProfile
          ? `${project.id}:global`
          : String(project.id);
      select.add(new Option(project.name || `#${project.id}`, key));
    }
    const preferred = projects.find(
      (project) => String(project.id) === String(preferredId) && project.globalProfile
    );
    if (preferred) {
      select.value = preferred.profileKey
        ? `${preferred.id}:${preferred.profileKey}`
        : String(preferred.id);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = reportMessage("report_cancel");
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "primary";
    confirm.textContent = reportMessage("report_continue");
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(""));
    confirm.addEventListener("click", () => {
      const [id, selection] = select.value.split(":", 2);
      finish({
        id,
        ...(selection && selection !== "global" ? { profileKey: selection } : {}),
        ...(selection === "global" ? { globalProfile: true } : {}),
      });
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish("");
    });
    dialog.append(title, select, cancel, confirm);
    overlay.append(dialog);
    document.body.append(overlay);
    select.focus();
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
      entriesToDelete.push(entry);
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
    const reportId = String(
      entry.issue?.id ??
        entry.issue_id ??
        entry.comments?.match(/^\[B2R report:(\d+)\]$/)?.[1] ??
        ""
    );
    if (!/^\d+$/.test(reportId)) {
      throw new Error(
        `${reportMessage("report_entry_not_verified")} #${entry.id} (${entry.spent_on}).`
      );
    }
    await deleteTimeEntry(redmineDomain, redmineApiKey, entry.id, {
      entry,
      domain: redmineDomain,
      date: entry.spent_on,
      reportId,
      confirmedAt,
      allowLegacy: !String(entry.comments || "").startsWith("[B2R report:"),
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
            <div id="tb-monthly-log-progress" class="tb-monthly-log-progress">
              <div class="tb-monthly-log-progress-item tb-monthly-log-progress-item--info">
                ${reportMessage("report_ready_to_scan")}
              </div>
            </div>
          </section>
          <section class="tb-monthly-log-panel">
            <div class="tb-monthly-log-panel-title">
              <span>${reportMessage("report_preview_title")}</span>
              <div id="tb-bulk-activity-toolbar" class="tb-bulk-activity-toolbar" hidden>
                <label for="tb-bulk-activity-select" class="tb-bulk-activity-label">
                  <span class="tb-bulk-activity-icon">⚡</span>
                  <span>${reportMessage("report_bulk_activity_label")}</span>
                </label>
                <select id="tb-bulk-activity-select" class="tb-bulk-activity-select"></select>
                <button type="button" id="tb-bulk-activity-apply" class="tb-btn tb-bulk-activity-btn">${reportMessage("report_bulk_activity_apply")}</button>
              </div>
            </div>
            <div class="tb-monthly-log-table-wrap">
              <table id="timesheet-results-table" class="tb-monthly-log-table">
                <colgroup>
                  <col class="col-date">
                  <col class="col-report">
                  <col class="col-tasks">
                  <col class="col-status">
                </colgroup>
                <thead>
                  <tr><th>${reportMessage("report_date")}</th><th>${reportMessage("report_issue")}</th><th>${reportMessage("report_tasks")}</th><th>${reportMessage("report_status")}</th></tr>
                </thead>
                <tbody id="tb-monthly-log-results">
                  <tr>
                    <td colspan="4" class="tb-table-empty-state">
                      ${reportMessage("report_ready_to_scan")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <footer class="tb-monthly-log-footer">
        <button type="button" id="tb-time-backups" class="tb-btn tb-btn-secondary" hidden>${reportMessage("report_export_backups")}</button>
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
    bulkActivityToolbar: overlay.querySelector("#tb-bulk-activity-toolbar"),
    bulkActivitySelect: overlay.querySelector("#tb-bulk-activity-select"),
    bulkActivityApply: overlay.querySelector("#tb-bulk-activity-apply"),
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
        const baseSettings = await getSettings();
        const reportIssue = await getIssueDetails(baseSettings.redmineDomain, "", issueId);
        const projectId = String(reportIssue.project?.id || "");
        const candidates = baseSettings.reportProjects.filter(
          (project) => String(project.id) === projectId
        );
        const selection = await chooseReportProject(
          candidates.length
            ? candidates
            : [{ id: projectId, name: `#${projectId}`, globalProfile: true }],
          baseSettings.reportProjectId
        );
        if (!selection) {
          button.innerText = reportMessage("report_log_8h");
          return;
        }
        const reportSettings = await getReportSettingsForProject(selection.id, selection);
        const initialPreview = await logTimeFromReport(
          issueId,
          true,
          null,
          true,
          null,
          reportSettings
        );
        const preview = await confirmReportSync(
          initialPreview,
          [],
          false,
          reportSettings.logTimeRules
        );
        if (!preview) {
          button.innerText = reportMessage("report_log_8h");
          return;
        }
        await logTimeFromReport(issueId, false, preview.date, false, preview, reportSettings);
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
  deferDeletionConfirmation = false,
  logTimeRules = {}
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
      preview = planReportSync(initialPreview, [...selected], logTimeRules);
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
  const message = `${reportMessage("report_confirm_delete")}\n\n${details}`;
  return confirm(message);
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
      backlogIssueKey,
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
