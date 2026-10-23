/* globals getCurrentUser, getIssueDetails, getTimeEntryActivities, findTimeEntries, logTimeEntry, updateTimeEntry, deleteTimeEntry */

/**
 * Feature: Automated Time Logging from Report Issues.
 *
 * This module contains the core logic for parsing a Redmine "Report" issue,
 * identifying tasks assigned to the current user, and automatically logging
 * a total of 8 hours spread across those tasks.
 */

/**
 * Main function to automate logging time based on a daily report issue.
 * It performs the following steps:
 * 1. Fetches settings and the current user's login name from Redmine.
 * 2. Fetches the content (description) of the specified report issue.
 * 3. Parses the description to find the "Today's Tasks" section.
 * 4. Finds the row corresponding to the user's login name.
 * 5. Extracts all task IDs (#12345) from that user's row.
 * 6. Calculates the time to log per task (dividing 8 hours equally).
 * 7. Calls the Redmine API to create a time entry for each task.
 *
 * @param {string} reportIssueId The ID of the issue with the "Report" tracker.
 * @param {boolean} [isBatchOperation=false] - If true, suppresses alerts and returns log details.
 * @param {string|null} [spentOn=null] - Date to log time for in YYYY-MM-DD format.
 * @param {boolean} [previewOnly=false] - Read task and time-entry data without writing.
 * @param {object|null} [expectedPreview=null] - Preview to verify before a monthly write.
 * @returns {Promise<object|void>} A promise that resolves with log details if in batch mode, otherwise void.
 * @throws {Error} Throws an error if any step fails, with a user-friendly message.
 */
async function logTimeFromReport(...args) {
  if (args[3] === true) return executeReportTimeSync(...args);
  return navigator.locks.request("b2r-report-time-write", { ifAvailable: true }, (lock) => {
    if (!lock) {
      throw new Error("Another Log Time operation is running. Try again after it finishes.");
    }
    return executeReportTimeSync(...args);
  });
}

async function executeReportTimeSync(
  reportIssueId,
  isBatchOperation = false,
  spentOn = null,
  previewOnly = false,
  expectedPreview = null,
  scopedReportSettings = null
) {
  try {
    const settings = scopedReportSettings || (await getSettings());
    const logTimeRules = globalThis.TB_LOG_TIME_RULES.normalize(settings.logTimeRules);
    const { redmineDomain, hasRedmineApiKey } = settings;
    if (!redmineDomain || !hasRedmineApiKey) {
      throw new Error("Redmine domain or API key is not configured.");
    }
    // Key stays in service worker; empty apiKey triggers authorized fetch proxy.
    const redmineApiKey = "";

    const currentUser = await getCurrentUser(redmineDomain, redmineApiKey);
    const userLogin = currentUser.login;

    // 2. Get the report issue details
    const reportIssue = await getIssueDetails(redmineDomain, redmineApiKey, reportIssueId);
    const description = reportIssue.description;
    const effectiveSpentOn = spentOn || extractReportDate(reportIssue.subject);

    if (
      !effectiveSpentOn ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveSpentOn) ||
      new Date(`${effectiveSpentOn}T00:00:00Z`).toISOString().slice(0, 10) !== effectiveSpentOn ||
      extractReportDate(reportIssue.subject) !== effectiveSpentOn
    ) {
      throw new Error("The report needs a date before time can be logged.");
    }

    if (!description) {
      throw new Error(`Report issue #${reportIssueId} has no description.`);
    }

    const taskIds = extractTaskIdsForUser(description, userLogin);
    if (
      expectedPreview &&
      (String(expectedPreview.userId) !== String(currentUser.id) ||
        expectedPreview.date !== effectiveSpentOn ||
        JSON.stringify(expectedPreview.tasks.map((task) => String(task.id))) !==
          JSON.stringify(taskIds))
    ) {
      throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
    }

    const taskIssueDetails = await Promise.all(
      taskIds.map((taskId) => getIssueDetails(redmineDomain, redmineApiKey, taskId))
    );
    const activities = await getTimeEntryActivities(redmineDomain, redmineApiKey);
    const tasks = taskIds.map((taskId, index) => ({
      id: taskId,
      subject: taskIssueDetails[index]?.subject || "",
      estimatedHours: Number(taskIssueDetails[index]?.estimated_hours) || 0,
      activityId: resolveTimeEntryActivityId(
        taskIssueDetails[index],
        currentUser,
        activities,
        logTimeRules
      ),
    }));

    const existingDailyEntries = await findTimeEntries(redmineDomain, redmineApiKey, {
      spent_on: effectiveSpentOn,
      user_id: currentUser.id,
      limit: 100,
    });
    if (
      existingDailyEntries.some(
        (entry) => !isSafeDailyUserTimeEntry(entry, currentUser, effectiveSpentOn)
      )
    ) {
      throw new Error("Redmine returned time entries outside the current user and report date.");
    }
    const preview = planReportSync(
      {
        date: effectiveSpentOn,
        redmineDomain,
        reportIssueId: String(reportIssueId),
        userId: String(currentUser.id),
        tasks,
        entries: existingDailyEntries,
        existingEntriesSnapshot: snapshotTimeEntries(existingDailyEntries),
      },
      expectedPreview?.selectedEntryIds || [],
      logTimeRules
    );
    if (previewOnly) return preview;
    if (
      !expectedPreview ||
      !Number.isFinite(expectedPreview.confirmedAt) ||
      Date.now() - expectedPreview.confirmedAt > 300000 ||
      expectedPreview.confirmedAt > Date.now() ||
      expectedPreview.redmineDomain !== redmineDomain ||
      expectedPreview.reportIssueId !== String(reportIssueId) ||
      expectedPreview.existingEntriesSnapshot !== preview.existingEntriesSnapshot ||
      JSON.stringify(expectedPreview.operations) !== JSON.stringify(preview.operations)
    ) {
      throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
    }
    if (!taskIds.length) throw new Error(globalThis.TB_GET_MESSAGE("report_no_tasks"));
    const desiredEntries = await buildDesiredTimeEntries(
      redmineDomain,
      redmineApiKey,
      taskIds,
      preview.tasks.map((task) => task.hours),
      currentUser,
      activities,
      logTimeRules
    );
    const loggedTaskIds = [];
    // Reductions precede increases. Stop on the first failure; a fresh preview
    // reads actual server state before retrying any partially completed plan.
    for (const operation of preview.operations) {
      try {
        if (operation.type === "delete") {
          await deleteTimeEntry(redmineDomain, redmineApiKey, operation.entryId, {
            entry: existingDailyEntries.find((entry) => entry.id === operation.entryId),
            reportId: String(reportIssueId),
            date: effectiveSpentOn,
            domain: redmineDomain,
            confirmedAt: expectedPreview.confirmedAt,
            allowLegacy: expectedPreview.selectedEntryIds.includes(String(operation.entryId)),
          });
        } else {
          const originalEntry = existingDailyEntries.find(
            (entry) => entry.id === operation.entryId
          );
          const activity =
            operation.activityId || desiredEntries[taskIds.indexOf(operation.taskId)]?.activityId;
          if (operation.type === "update") {
            await updateTimeEntry(
              redmineDomain,
              redmineApiKey,
              operation.entryId,
              operation.taskId,
              operation.hours,
              preview.marker,
              effectiveSpentOn,
              activity,
              {
                entry: originalEntry,
                reportId: String(reportIssueId),
                date: effectiveSpentOn,
                domain: redmineDomain,
                confirmedAt: expectedPreview.confirmedAt,
                allowLegacy: expectedPreview.selectedEntryIds.includes(String(operation.entryId)),
                targetIssueId: operation.taskId,
              }
            );
          } else {
            await logTimeEntry(
              redmineDomain,
              redmineApiKey,
              operation.taskId,
              operation.hours,
              preview.marker,
              effectiveSpentOn,
              activity
            );
          }
          loggedTaskIds.push(operation.taskId);
        }
      } catch (error) {
        error.logResult = createLogResult(
          taskIds,
          loggedTaskIds,
          [],
          [{ taskId: operation.taskId, message: error.message }]
        );
        throw error;
      }
    }
    return createLogResult(
      taskIds,
      [...new Set(loggedTaskIds)],
      taskIds.filter((id) => !loggedTaskIds.includes(id)),
      [],
      {
        existingDailyHours: preview.preservedHours,
        synchronized: true,
        operations: preview.operations,
        preservedHours: preview.preservedHours,
      }
    );
  } catch (error) {
    console.error("Error during 'Log Time From Report' process:", error);
    if (!isBatchOperation) {
      alert(`An error occurred: ${error.message}`); // Show error to the user
    }
    throw error; // Re-throw to allow for more handling
  }
}

function extractTaskIdsForUser(description, userLogin) {
  const htmlTaskIds = extractTaskIdsFromHtmlForUser(description, userLogin);
  if (htmlTaskIds.length > 0) {
    return htmlTaskIds;
  }

  const todaysTasksSection = extractTodaysTasksSection(description);
  const tasksCell = todaysTasksSection
    ? extractTasksCellForUser(todaysTasksSection, userLogin)
    : extractTasksCellForUser(description, userLogin);
  const taskIdsRegex = /#(\d+)/g;
  return [...new Set([...tasksCell.matchAll(taskIdsRegex)].map((m) => m[1]))];
}

function extractTodaysTasksSection(description) {
  if (description.includes("<")) {
    const htmlSection = extractTodaysTasksSectionFromHtml(description);
    if (htmlSection) {
      return htmlSection;
    }
  }

  const lines = description.split(/\r?\n/);
  const startIndex = lines.findIndex(isTodaysTasksHeading);

  if (startIndex === -1) {
    return "";
  }

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index++) {
    if (isNextReportHeading(lines[index])) {
      break;
    }
    sectionLines.push(lines[index]);
  }

  return sectionLines.join("\n").trim();
}

function extractTodaysTasksSectionFromHtml(description) {
  const documentFragment = new DOMParser().parseFromString(description, "text/html");
  const headingElements = Array.from(
    documentFragment.body.querySelectorAll("strong, h1, h2, h3, h4, h5, h6")
  );
  const startHeading = headingElements.find((element) => isTodaysTasksHeading(element.textContent));

  if (!startHeading) {
    return "";
  }

  const todaysTable = findFirstTableBeforeNextHeading(startHeading);
  if (todaysTable) {
    return todaysTable.outerHTML;
  }

  const sectionParts = [];
  let currentNode = startHeading.nextSibling;

  while (currentNode) {
    if (isHtmlReportHeadingNode(currentNode)) {
      break;
    }

    if (currentNode.outerHTML) {
      sectionParts.push(currentNode.outerHTML);
    } else if (currentNode.textContent?.trim()) {
      sectionParts.push(currentNode.textContent);
    }

    currentNode = currentNode.nextSibling;
  }

  return sectionParts.join("\n").trim();
}

function findFirstTableBeforeNextHeading(startHeading) {
  let currentElement = startHeading.nextElementSibling;

  while (currentElement) {
    if (isHtmlReportHeadingNode(currentElement)) {
      return null;
    }

    if (currentElement.tagName?.toLowerCase() === "table") {
      return currentElement;
    }

    const nestedTable = currentElement.querySelector?.("table");
    if (nestedTable) {
      return nestedTable;
    }

    currentElement = currentElement.nextElementSibling;
  }

  return null;
}

function extractReportDate(subject = "") {
  const dateMatch = subject.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : null;
}

function extractTasksCellForUser(section, userLogin) {
  if (!section) {
    return "";
  }

  const normalizedUserLogin = userLogin.trim();
  const rows = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  const matchingCells = [];

  for (const row of rows) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const userCellIndex = cells.findIndex((cell) => isSameReportUser(cell, normalizedUserLogin));

    if (userCellIndex !== -1) {
      matchingCells.push(cells.slice(userCellIndex + 1).join(" "));
    }
  }

  return matchingCells.join(" ");
}

function extractTasksCellFromHtmlForUser(section, userLogin) {
  if (!section || !section.includes("<")) {
    return "";
  }

  const documentFragment = new DOMParser().parseFromString(section, "text/html");
  const normalizedUserLogin = normalizeTextForCompare(userLogin);
  const rows = documentFragment.querySelectorAll("tr");

  const matchingCells = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) {
      continue;
    }

    const userCell = normalizeTextForCompare(cells[0].textContent);
    if (!isSameReportUser(userCell, normalizedUserLogin)) {
      continue;
    }

    matchingCells.push(
      cells
        .slice(1)
        .map((cell) => cell.textContent.trim())
        .join(" ")
    );
  }

  return matchingCells.join(" ");
}

function extractTaskIdsFromHtmlForUser(description, userLogin) {
  if (!description || !description.includes("<")) {
    return [];
  }

  const documentFragment = new DOMParser().parseFromString(description, "text/html");
  const todaysTasksTable = findTodaysTasksTable(documentFragment);

  if (!todaysTasksTable) {
    return [];
  }

  const normalizedUserLogin = normalizeTextForCompare(userLogin);
  const taskIds = [];
  const rows = todaysTasksTable.querySelectorAll("tr");

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) {
      continue;
    }

    const userCell = normalizeTextForCompare(cells[0].textContent);
    if (!isSameReportUser(userCell, normalizedUserLogin)) {
      continue;
    }

    const taskCell = cells[1];
    taskCell.querySelectorAll("a.issue").forEach((link) => {
      const taskId =
        link.getAttribute("href")?.match(/\/issues\/(\d+)/)?.[1] ||
        link.textContent?.match(/#(\d+)/)?.[1];
      if (taskId) {
        taskIds.push(taskId);
      }
    });
  }

  return [...new Set(taskIds)];
}

function findTodaysTasksTable(documentFragment) {
  const headingElements = Array.from(
    documentFragment.body.querySelectorAll("strong, h1, h2, h3, h4, h5, h6")
  );
  const startHeading = headingElements.find((element) => isTodaysTasksHeading(element.textContent));

  if (!startHeading) {
    return null;
  }

  return findFirstTableBeforeNextHeading(startHeading);
}

function isTodaysTasksHeading(line) {
  const normalizedLine = normalizeReportHeading(line);
  return (
    /本日.*(タスク|作業|実績)/.test(normalizedLine) ||
    /今日.*(タスク|作業|実績)/.test(normalizedLine)
  );
}

function isNextReportHeading(line) {
  const normalizedLine = normalizeReportHeading(line);
  return (
    /^(?:\d+|[０-９]+)[.)．、]\s*/.test(normalizedLine) ||
    /^(?:次|明日|問題)/.test(normalizedLine) ||
    /^(次|明日).*(プラン|予定|タスク)/.test(normalizedLine)
  );
}

function isHtmlReportHeadingNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const tagName = node.tagName?.toLowerCase();
  const isHeadingLike =
    ["strong", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName) ||
    ["p", "div"].includes(tagName);

  if (!isHeadingLike) {
    return false;
  }

  return isNextReportHeading(node.textContent || "");
}

function normalizeReportHeading(line) {
  return line
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/^[-*_\s]+/, "")
    .replace(/[-*_\s]+$/, "")
    .replace(/^#+\s*/, "")
    .replace(/^h\d+\.\s*/i, "")
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
    .replace(/．/g, ".")
    .replace(/^[-*_\s]+/, "")
    .replace(/[-*_\s]+$/, "")
    .replace(/\s+/g, " ");
}

function normalizeTextForCompare(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function isSameReportUser(reportUser, currentUserLogin) {
  const reportUserName = normalizeTextForCompare(reportUser).toLowerCase();
  const currentLogin = normalizeTextForCompare(currentUserLogin).toLowerCase();

  if (!reportUserName || !currentLogin) {
    return false;
  }

  return (
    reportUserName === currentLogin ||
    reportUserName.endsWith(`.${currentLogin}`) ||
    currentLogin.endsWith(`.${reportUserName}`)
  );
}

function distributeHours(totalHours, taskCount) {
  if (!taskCount) return [];
  const unit = Number.isInteger(totalHours * 2) && totalHours * 2 >= taskCount ? 0.5 : 0.01;
  const totalUnits = Math.floor(totalHours / unit + 1e-8);
  const baseUnits = Math.floor(totalUnits / taskCount);
  let remainingUnits = totalUnits;

  return Array.from({ length: taskCount }, (_, index) => {
    const units = index === taskCount - 1 ? remainingUnits : Math.min(baseUnits, remainingUnits);
    remainingUnits -= units;
    return Math.round(units * unit * 100) / 100;
  });
}

function planReportSync(preview, selectedEntryIds = [], rules = {}) {
  const logTimeRules = globalThis.TB_LOG_TIME_RULES.normalize(rules);
  const marker = `[B2R report:${preview.reportIssueId}]`;
  const selected = new Set(selectedEntryIds.map(String));
  const entries = preview.entries;
  if (entries.some((entry) => !Number.isFinite(Number(entry.hours)) || Number(entry.hours) < 0)) {
    throw new Error("Redmine returned invalid logged hours.");
  }
  const candidates = entries.filter(
    (entry) => !String(entry.comments || "").startsWith("[B2R report:")
  );
  if ([...selected].some((id) => !candidates.some((entry) => String(entry.id) === id))) {
    throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
  }
  const managed = entries.filter(
    (entry) => entry.comments === marker || selected.has(String(entry.id))
  );
  const preservedHours = sumTimeEntryHours(entries.filter((entry) => !managed.includes(entry)));
  const budget =
    Math.floor(Math.max(0, logTimeRules.dailyHours - preservedHours) * 100 + 1e-8) / 100;
  const weights =
    logTimeRules.allocation === "estimate"
      ? preview.tasks.map((task) => task.estimatedHours)
      : preview.tasks.map(() => 1);
  const hours = preview.tasks.length ? globalThis.TB_LOG_TIME_RULES.allocate(budget, weights) : [];
  const available = [...managed];
  const operations = [];
  const tasks = preview.tasks.map((task, index) => {
    const match = available.findIndex((entry) => getTimeEntryIssueId(entry) === String(task.id));
    const entry = match < 0 ? null : available.splice(match, 1)[0];
    const existingActivityId = entry?.activity?.id ?? entry?.activity_id;
    if (hours[index] > 0) {
      if (
        !entry ||
        Number(entry.hours) !== hours[index] ||
        entry.comments !== marker ||
        Number(existingActivityId) !== Number(task.activityId)
      ) {
        operations.push({
          type: entry ? "update" : "create",
          entryId: entry?.id || null,
          taskId: String(task.id),
          hours: hours[index],
          oldHours: Number(entry?.hours || 0),
          activityId: task.activityId,
        });
      }
    } else if (entry) available.push(entry);
    return { ...task, hours: hours[index], alreadyLogged: false };
  });
  // An empty/unparsed report must never erase a day's entries.
  if (tasks.length) {
    for (const entry of available) {
      operations.push({
        type: "delete",
        entryId: entry.id,
        taskId: getTimeEntryIssueId(entry),
        hours: 0,
        oldHours: Number(entry.hours),
      });
    }
  }
  operations.sort((a, b) => a.hours - a.oldHours - (b.hours - b.oldHours));
  return {
    ...preview,
    tasks,
    marker,
    candidates,
    selectedEntryIds: [...selected],
    operations,
    totalHours: hours.reduce((total, value) => total + value, 0),
    preservedHours,
    existingDailyHours: sumTimeEntryHours(entries),
    willReplaceDailyEntries: false,
    dayAlreadyFull: preservedHours >= logTimeRules.dailyHours,
    dailyHours: logTimeRules.dailyHours,
  };
}

async function buildDesiredTimeEntries(
  redmineDomain,
  redmineApiKey,
  taskIds,
  hoursByTask,
  currentUser,
  activities,
  rules = {}
) {
  const logTimeRules = globalThis.TB_LOG_TIME_RULES.normalize(rules);
  const entries = [];

  for (const [index, taskId] of taskIds.entries()) {
    if (hoursByTask[index] <= 0) {
      entries.push(null);
      continue;
    }
    const taskIssue = await getIssueDetails(redmineDomain, redmineApiKey, taskId);
    entries.push({
      taskId,
      hours: hoursByTask[index],
      activityId: resolveTimeEntryActivityId(taskIssue, currentUser, activities, logTimeRules),
    });
  }

  return entries;
}

function isSafeDailyUserTimeEntry(entry, currentUser, spentOn) {
  const entryUserId = entry?.user?.id ?? entry?.user_id;
  const entrySpentOn = entry?.spent_on;

  if (!entry?.id || !entryUserId || !currentUser?.id || !entrySpentOn || !spentOn) {
    return false;
  }

  return Number(entryUserId) === Number(currentUser.id) && entrySpentOn === spentOn;
}

function getTimeEntryIssueId(entry) {
  return String(entry?.issue?.id || entry?.issue_id || "");
}

function resolveTimeEntryActivityId(taskIssue, currentUser, activities, rules = {}) {
  const logTimeRules = globalThis.TB_LOG_TIME_RULES.normalize(rules);
  if (logTimeRules.activityMode === "default") {
    const isTesting =
      /bug/i.test(taskIssue?.tracker?.name || "") && isIssueAuthor(taskIssue, currentUser);
    const configuredId = isTesting
      ? logTimeRules.testingActivityId || logTimeRules.defaultActivityId
      : logTimeRules.defaultActivityId;
    if (!configuredId) throw new Error("Configure a default time-entry activity.");
    const activity = activities.find(
      (item) => Number(item.id) === Number(configuredId) && item.active !== false
    );
    if (!activity) throw new Error("Configured time-entry activity is unavailable.");
    return Number(configuredId);
  }
  const subject = taskIssue?.subject || "";
  const trackerName = taskIssue?.tracker?.name || "";
  let activityName = "03_Coding";

  if (/executing/i.test(subject)) {
    activityName = "04_Unit Test";
  } else if (/coding/i.test(subject)) {
    activityName = "03_Coding";
  } else if (/bug/i.test(trackerName) && isIssueAuthor(taskIssue, currentUser)) {
    activityName = "04_Unit Test";
  }

  return getActivityIdByName(activities, activityName);
}

function getActivityIdByName(activities, activityName) {
  const activity = activities.find((item) => item.name === activityName && item.active !== false);
  if (!activity?.id) throw new Error(`Configure activities: ${activityName} is unavailable.`);
  return activity.id;
}

function isIssueAuthor(taskIssue, currentUser) {
  if (taskIssue?.author?.id && currentUser?.id) {
    return Number(taskIssue.author.id) === Number(currentUser.id);
  }

  return isSameReportUser(taskIssue?.author?.name || "", currentUser?.login || "");
}

function sumTimeEntryHours(entries) {
  return entries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
}

function snapshotTimeEntries(entries) {
  return JSON.stringify(
    entries
      .map((entry) => ({
        id: String(entry.id),
        issueId: getTimeEntryIssueId(entry),
        userId: String(entry.user?.id ?? entry.user_id ?? ""),
        hours: String(entry.hours),
        activityId: String(entry.activity?.id ?? entry.activity_id ?? ""),
        updatedOn: entry.updated_on || "",
        comments: entry.comments || "",
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function createLogResult(taskIds, loggedTaskIds, skippedTaskIds, failedTasks, meta = {}) {
  return {
    taskIds,
    loggedTaskIds,
    skippedTaskIds,
    failedTasks,
    ...meta,
  };
}
