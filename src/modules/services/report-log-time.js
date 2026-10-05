/* globals getCurrentUser, getIssueDetails, getTimeEntryActivities, findTimeEntries, logTimeEntry, updateTimeEntry, deleteTimeEntry */

/**
 * Feature: Automated Time Logging from Report Issues.
 *
 * This module contains the core logic for parsing a Redmine "Report" issue,
 * identifying tasks assigned to the current user, and automatically logging
 * the configured daily hours spread across those tasks.
 */

/**
 * Main function to automate logging time based on a daily report issue.
 * It performs the following steps:
 * 1. Fetches settings and the current user's login name from Redmine.
 * 2. Fetches the content (description) of the specified report issue.
 * 3. Parses the description to find the "Today's Tasks" section.
 * 4. Finds the row corresponding to the user's login name.
 * 5. Extracts all task IDs (#12345) from that user's row.
 * 6. Allocates configured hours by equal shares or task estimates.
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
async function logTimeFromReport(
  reportIssueId,
  isBatchOperation = false,
  spentOn = null,
  previewOnly = false,
  expectedPreview = null
) {
  try {
    const settings = await getSettings(reportIssueId);
    const rules = globalThis.TB_LOG_TIME_RULES.normalize(settings.logTimeRules);
    const totalHours = rules.dailyHours;
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

    if (taskIds.length === 0) {
      if (previewOnly) {
        return {
          date: effectiveSpentOn,
          reportIssueId: String(reportIssueId),
          tasks: [],
          existingDailyHours: 0,
          willReplaceDailyEntries: false,
          dayAlreadyFull: false,
        };
      }
      if (!isBatchOperation) {
        throw new Error(`No task IDs found for user '${userLogin}'.`);
      }
      return createLogResult([], [], [], []); // Return empty result in batch mode for days off etc.
    }

    const taskIssueDetails = await Promise.all(
      taskIds.map((taskId) => getIssueDetails(redmineDomain, redmineApiKey, taskId))
    );
    const activities = await getTimeEntryActivities(redmineDomain, redmineApiKey);
    const hoursByTask = globalThis.TB_LOG_TIME_RULES.allocate(
      totalHours,
      taskIssueDetails.map((issue) =>
        rules.allocation === "estimate" ? Number(issue.estimated_hours) : 1
      )
    );
    const desiredEntries = taskIssueDetails.map((issue, index) => ({
      taskId: taskIds[index],
      hours: hoursByTask[index],
      activityId: resolveTimeEntryActivityId(issue, currentUser, activities, rules),
    }));
    const planSnapshot = JSON.stringify([rules, desiredEntries]);
    if (expectedPreview && expectedPreview.planSnapshot !== planSnapshot) {
      throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
    }
    const tasks = taskIds.map((taskId, index) => ({
      id: taskId,
      subject: taskIssueDetails[index]?.subject || "",
    }));

    if (previewOnly) {
      const existingEntries = effectiveSpentOn
        ? await findTimeEntries(redmineDomain, redmineApiKey, {
            spent_on: effectiveSpentOn,
            user_id: currentUser.id,
            limit: 100,
          })
        : [];
      const existingDailyHours = sumTimeEntryHours(existingEntries);
      const sameIssueSet = isSameIssueSet(existingEntries, taskIds);
      return {
        planSnapshot,
        totalHours,
        date: effectiveSpentOn,
        reportIssueId: String(reportIssueId),
        tasks: tasks.map((task, index) => ({
          ...task,
          hours: hoursByTask[index],
          activityId: desiredEntries[index].activityId,
          alreadyLogged: existingEntries.some(
            (entry) => String(getTimeEntryIssueId(entry)) === String(task.id)
          ),
        })),
        userId: String(currentUser.id),
        existingEntriesSnapshot: snapshotTimeEntries(existingEntries),
        existingDailyHours,
        willReplaceDailyEntries: existingDailyHours >= totalHours && !sameIssueSet,
        dayAlreadyFull: existingDailyHours >= totalHours && sameIssueSet,
      };
    }

    // 6. Calculate hours and log time for each task
    const timeEntryComment = "";
    const loggedTaskIds = [];
    const skippedTaskIds = [];
    const failedTasks = [];

    if (effectiveSpentOn) {
      const existingDailyEntries = await findTimeEntries(redmineDomain, redmineApiKey, {
        spent_on: effectiveSpentOn,
        user_id: currentUser.id,
        limit: 100,
      });
      const existingDailyHours = sumTimeEntryHours(existingDailyEntries);

      if (
        expectedPreview &&
        expectedPreview.existingEntriesSnapshot !== snapshotTimeEntries(existingDailyEntries)
      ) {
        throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
      }

      // Monthly confirmation must never replace entries that were outside the approved preview.
      if (
        expectedPreview &&
        existingDailyHours >= totalHours &&
        !isSameIssueSet(existingDailyEntries, taskIds)
      ) {
        throw new Error(globalThis.TB_GET_MESSAGE("report_preview_stale"));
      }

      if (existingDailyHours >= totalHours) {
        if (isSameIssueSet(existingDailyEntries, taskIds)) {
          return createLogResult(taskIds, [], taskIds, [], {
            dayAlreadyFull: true,
            existingDailyHours,
          });
        }

        await upsertDailyTimeEntries(
          redmineDomain,
          redmineApiKey,
          existingDailyEntries,
          desiredEntries,
          effectiveSpentOn,
          timeEntryComment,
          currentUser
        );

        return createLogResult(taskIds, taskIds, [], [], {
          dayUpserted: true,
          existingDailyHours,
        });
      }
    }

    for (const [index, taskId] of taskIds.entries()) {
      try {
        let existingEntries = [];
        if (effectiveSpentOn) {
          existingEntries = await findTimeEntries(redmineDomain, redmineApiKey, {
            issue_id: taskId,
            spent_on: effectiveSpentOn,
            user_id: currentUser.id,
            limit: 100,
          });
        }

        const alreadyLogged = existingEntries.length > 0;

        if (alreadyLogged) {
          skippedTaskIds.push(taskId);
          continue;
        }

        const desiredEntry = desiredEntries[index];

        await logTimeEntry(
          redmineDomain,
          redmineApiKey,
          taskId,
          hoursByTask[index],
          timeEntryComment,
          effectiveSpentOn,
          desiredEntry.activityId
        );
        loggedTaskIds.push(taskId);
      } catch (error) {
        failedTasks.push({ taskId, message: error.message });
      }
    }

    if (failedTasks.length > 0) {
      const error = new Error(
        `Failed to log ${failedTasks.length}/${taskIds.length} task(s): ${failedTasks
          .map((task) => `#${task.taskId} (${task.message})`)
          .join(", ")}`
      );
      error.logResult = createLogResult(taskIds, loggedTaskIds, skippedTaskIds, failedTasks);
      throw error;
    }

    // 7. Return task IDs for batch mode or show alert for single mode
    if (isBatchOperation) {
      return createLogResult(taskIds, loggedTaskIds, skippedTaskIds, failedTasks);
    } else {
      const successMessage = `Successfully logged a total of ${totalHours} hours across ${taskIds.length} tasks: #${taskIds.join(", #")}.`;
      console.log(successMessage);
      alert(successMessage); // Simple feedback for single mode
    }
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

async function upsertDailyTimeEntries(
  redmineDomain,
  redmineApiKey,
  existingEntries,
  desiredEntries,
  spentOn,
  comments,
  currentUser
) {
  const safeExistingEntries = existingEntries.filter((entry) =>
    isSafeDailyUserTimeEntry(entry, currentUser, spentOn)
  );
  const skippedUnsafeEntries = existingEntries.length - safeExistingEntries.length;

  if (skippedUnsafeEntries > 0) {
    throw new Error(
      `Refused to upsert daily time entries because ${skippedUnsafeEntries} existing entr${skippedUnsafeEntries === 1 ? "y is" : "ies are"} not confirmed for the current user/date.`
    );
  }

  const sortedExistingEntries = [...safeExistingEntries].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );

  for (const [index, desiredEntry] of desiredEntries.entries()) {
    const existingEntry = sortedExistingEntries[index];

    if (existingEntry) {
      await updateTimeEntry(
        redmineDomain,
        redmineApiKey,
        existingEntry.id,
        desiredEntry.taskId,
        desiredEntry.hours,
        comments,
        spentOn,
        desiredEntry.activityId
      );
    } else {
      await logTimeEntry(
        redmineDomain,
        redmineApiKey,
        desiredEntry.taskId,
        desiredEntry.hours,
        comments,
        spentOn,
        desiredEntry.activityId
      );
    }
  }

  const extraEntries = sortedExistingEntries.slice(desiredEntries.length);
  for (const extraEntry of extraEntries) {
    await deleteTimeEntry(redmineDomain, redmineApiKey, extraEntry.id);
  }
}

function isSameIssueSet(existingEntries, taskIds) {
  const existingIssueIds = new Set(existingEntries.map(getTimeEntryIssueId).filter(Boolean));
  const reportIssueIds = new Set(taskIds.map(String));

  if (existingIssueIds.size !== reportIssueIds.size) {
    return false;
  }

  return [...reportIssueIds].every((issueId) => existingIssueIds.has(issueId));
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

function resolveTimeEntryActivityId(
  taskIssue,
  currentUser,
  activities,
  rules = globalThis.TB_LOG_TIME_RULES.normalize()
) {
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

  const testing = activityName === "04_Unit Test";
  const selectedId =
    rules.activityMode === "default"
      ? rules.defaultActivityId
      : testing
        ? rules.testingActivityId
        : rules.defaultActivityId;
  if (selectedId) {
    const activity = activities.find(
      (item) => String(item.id) === selectedId && item.active !== false
    );
    if (!activity) {
      throw new Error(
        "Configured time-entry activity is unavailable. Reload activities in Options."
      );
    }
    return activity.id;
  }
  if (rules.activityMode === "default") {
    throw new Error("Select a default time-entry activity in Options.");
  }
  return getActivityIdByName(activities, activityName);
}

function getActivityIdByName(activities, activityName) {
  const activity = activities.find((item) => item.name === activityName && item.active !== false);

  if (!activity?.id) {
    throw new Error(
      "Report activity names do not match this Redmine. Configure activities in Options."
    );
  }

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
