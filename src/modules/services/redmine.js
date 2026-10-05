/* global downloadBacklogFile, TB_LOGGER, markdownToTextile */
/**
 * Redmine API Service for Backlog2Redmine Extension.
 * Handles operations with Redmine API: finding issues, sending notes, and uploading files.
 */

/**
 * Finds Redmine issue using complete, paginated API results.
 * @param {string} redmineDomain - Redmine domain
 * @param {string} apiKey - Redmine API key
 * @param {string} issueKey - Issue key (e.g., CP-123)
 * @param {string} issueSummary - Issue summary/title
 * @param {string} backlogIssueType - Backlog issue type (e.g., QA, Task)
 * @returns {Promise<{id: string, title: string}>} Matched issue info
 */
async function findRedmineIssue(
  redmineDomain,
  apiKey,
  issueKey,
  issueSummary = "",
  backlogIssueType = "",
  rules = {},
  projectId = ""
) {
  if (globalThis.TB_SYNC_RULES) rules = globalThis.TB_SYNC_RULES.normalize(rules);
  if (rules.restrictToProject && !projectId) {
    throw new Error("Select a default Redmine project before restricting issue search.");
  }
  // Only the paginated API can establish uniqueness across all search results.
  const preferredTrackers = getPreferredRedmineTrackerNames(backlogIssueType, rules);
  return findRedmineIssueViaApi(
    redmineDomain,
    apiKey,
    issueKey,
    issueSummary,
    preferredTrackers,
    rules,
    projectId
  );
}

/**
 * Finds issues based on a set of criteria.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {object} params - An object of query parameters (e.g., { project_id, tracker_id, subject }).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of issue objects.
 */
async function findIssues(redmineDomain, apiKey, params) {
  const query = new URLSearchParams(params).toString();
  const path = `/issues.json?${query}`;
  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, path, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to find issues: ${errorMsg}`);
  }

  const data = await response.json();
  return data.issues || [];
}

/**
 * Finds time entries based on a set of criteria.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {object} params - Query parameters such as issue_id, spent_on, user_id.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of time entry objects.
 */
async function findTimeEntries(redmineDomain, apiKey, params) {
  const query = new URLSearchParams(params).toString();
  const path = `/time_entries.json?${query}`;
  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, path, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to find time entries: ${errorMsg}`);
  }

  const data = await response.json();
  return data.time_entries || [];
}

/**
 * Finds issue via Redmine REST API.
 * Fallback method when HTML search is unsuccessful.
 */
async function findRedmineIssueViaApi(
  redmineDomain,
  apiKey,
  issueKey,
  issueSummary = "",
  preferredTrackers = [],
  rules = {},
  projectId = ""
) {
  const normalizedIssueKey = rules.searchMode === "title" ? "" : normalizeLoose(issueKey);
  const normalizedIssueSummary =
    rules.searchMode === "key" ? "" : normalizeLoose(extractJapaneseTitlePart(issueSummary, rules));
  const subjectQueries = globalThis.TB_SYNC_RULES
    ? globalThis.TB_SYNC_RULES.queries(issueKey, issueSummary, rules)
    : [issueKey, extractJapaneseTitlePart(issueSummary, rules)].filter(Boolean);
  const seenIds = new Set();
  const issues = [];

  for (const subjectQuery of subjectQueries) {
    const batch = await fetchIssuesBySubjectQuery(
      redmineDomain,
      apiKey,
      subjectQuery,
      rules.restrictToProject ? projectId : ""
    );
    for (const issue of batch) {
      if (!seenIds.has(issue.id)) {
        seenIds.add(issue.id);
        issues.push(issue);
      }
    }
    if (
      issues.some((issue) =>
        hasStrongRedmineTextMatch(issue.subject, normalizedIssueKey, normalizedIssueSummary, rules)
      )
    ) {
      break;
    }
  }

  if (issues.length === 0) {
    return null;
  }

  const bestMatch = pickBestRedmineSearchResult(
    issues.map((i) => ({
      id: i.id,
      subject: i.subject,
      tracker: i.tracker?.name || "",
    })),
    normalizedIssueKey,
    normalizedIssueSummary,
    preferredTrackers,
    rules
  );

  if (!bestMatch) {
    return null;
  }
  return { id: String(bestMatch.id), title: bestMatch.subject };
}

async function fetchIssuesBySubjectQuery(redmineDomain, apiKey, subjectQuery, projectId = "") {
  const issues = [];
  const seen = new Set();
  for (let offset = 0; ; ) {
    // Use contains (~) and all statuses — same pattern as report-log-time lookup.
    const url = buildRedmineUrl(
      redmineDomain,
      `/issues.json?${new URLSearchParams({
        subject: `~${subjectQuery}`,
        ...(projectId ? { project_id: projectId } : {}),
        status_id: "*",
        limit: "25",
        offset: String(offset),
      }).toString()}`
    );
    const response = await timeoutFetch(url, {
      headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`${TB.MESSAGES.REDMINE.LOOKUP_FAILED}: ${response.status}`);
    }

    const data = await safeReadJson(response);
    if (!Array.isArray(data?.issues)) throw new Error("Invalid Redmine search response.");
    const batch = data.issues;
    if (!batch.length) break;
    const fresh = batch.filter((issue) => !seen.has(issue.id));
    if (!fresh.length) throw new Error("Redmine search pagination did not advance.");
    for (const issue of fresh) {
      seen.add(issue.id);
      issues.push(issue);
    }
    offset += batch.length;
    if (Number.isSafeInteger(data.total_count)) {
      if (offset >= data.total_count) break;
    } else if (batch.length < 25) break;
  }
  return issues;
}

async function handleSendToRedmine(
  {
    redmineIssueId,
    notes,
    backlogIssueKey,
    processedAttachments = null,
    syncMarker = "",
    settingsOverride = null,
    strictAttachments = false,
    onBeforeSubmit = null,
  },
  sender
) {
  // Send note to Redmine issue, including image processing
  const settings = settingsOverride || (await getSettings());
  const backlogDomain = sender?.tab?.url ? new URL(sender.tab.url).hostname : null;
  // Process attachments: download from Backlog, upload to Redmine
  const { updatedNotes, uploads } = await processNotesAttachments(
    notes,
    backlogDomain,
    settings,
    backlogIssueKey,
    processedAttachments,
    strictAttachments
  );

  // Modal edits/preview use Markdown; Redmine notes use Textile.
  const textileNotes =
    typeof markdownToTextile === "function" ? markdownToTextile(updatedNotes) : updatedNotes;

  const endpoint = buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}.json`);
  const payload = {
    issue: {
      notes: `${textileNotes}${syncMarker ? `\n\n${syncMarker}` : ""}`,
      uploads: uploads.length > 0 ? uploads : undefined,
    },
  };

  await onBeforeSubmit?.();
  const response = await timeoutFetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": settings.redmineApiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    if (typeof TB_LOGGER !== "undefined") {
      TB_LOGGER.logError("RedmineService", `API Error during comment submission: ${errorMsg}`, {
        requestPayload: payload,
        redmineResponse: errorMsg,
      });
    }
    const error = new Error(
      `${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
    error.status = response.status;
    throw error;
  }

  const responseData = await safeReadJson(response);
  const journalId = responseData?.journal?.id;
  return {
    message: TB.MESSAGES.TOAST.SEND_SUCCESS,
    redmineUrl: buildRedmineUrl(
      settings.redmineDomain,
      `/issues/${redmineIssueId}${journalId ? `#note-${journalId}` : ""}`
    ),
  };
}

async function handleCreateRedmineIssue({
  issueData,
  comments,
  migrationMarker = "",
  processedAttachments = new Map(),
  settingsOverride = null,
  strictAttachments = false,
}) {
  const settings = settingsOverride || (await getSettings());

  const { updatedNotes: updatedDescription, uploads: descUploads } = await processNotesAttachments(
    issueData.description || "",
    null, // Pass null, let the function grab from settings
    settings,
    issueData.backlogIssueKey,
    processedAttachments,
    strictAttachments
  );

  const textileDescription =
    typeof markdownToTextile === "function"
      ? markdownToTextile(updatedDescription)
      : updatedDescription;

  const createUrl = buildRedmineUrl(settings.redmineDomain, "/issues.json");
  const payload = {
    issue: {
      project_id: issueData.project_id,
      tracker_id: issueData.tracker_id,
      priority_id: issueData.priority_id,
      fixed_version_id: issueData.fixed_version_id || undefined,
      subject: issueData.subject,
      description: `${textileDescription}${migrationMarker ? `\n\n${migrationMarker}` : ""}`,
      due_date: issueData.due_date || undefined,
      category_id: issueData.category_id || undefined,
      uploads: descUploads.length > 0 ? descUploads : undefined,
      custom_fields: issueData.custom_fields || [],
    },
  };

  try {
    const response = await timeoutFetch(createUrl, {
      method: "POST",
      headers: {
        "X-Redmine-API-Key": settings.redmineApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMsg = await readErrorMessage(response);
      const createError = new Error(errorMsg);
      createError.status = response.status;
      throw createError;
    }

    const result = await response.json();
    const newIssueId = result.issue.id;

    let migratedCommentCount = 0;
    const failedComments = [];
    if (Array.isArray(comments) && comments.length > 0) {
      for (let index = 0; index < comments.length; index++) {
        const commentText = comments[index];
        try {
          await handleSendToRedmine(
            {
              redmineIssueId: newIssueId,
              notes: commentText,
              backlogIssueKey: issueData.backlogIssueKey,
              processedAttachments, // Reuse map to avoid re-uploading
            },
            null // Sender is null, so backlogDomain will be correctly sourced from settings
          );
          migratedCommentCount += 1;
        } catch (e) {
          console.error("Comment migration failed", e);
          failedComments.push({
            index: index + 1,
            message: e?.message || String(e),
          });
          if (typeof TB_LOGGER !== "undefined") {
            TB_LOGGER.logError("RedmineService", `Failed to migrate comment: ${e.message}`, {
              commentIndex: index + 1,
            });
          }
        }
      }
    }

    return {
      issueId: newIssueId,
      redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${newIssueId}`),
      migratedCommentCount,
      failedCommentCount: failedComments.length,
      failedComments,
    };
  } catch (error) {
    if (typeof TB_LOGGER !== "undefined") {
      TB_LOGGER.logError("RedmineService", `API Error during issue creation: ${error.message}`, {
        requestPayload: {
          project_id: payload?.issue?.project_id,
          tracker_id: payload?.issue?.tracker_id,
          subject: payload?.issue?.subject,
        },
        redmineResponse: error.message,
      });
    }
    // Rethrow a user-friendly error
    const friendlyError = new Error(
      `${TB.MESSAGES.REDMINE.API_REQUEST_FAILED}: ${sanitizeErrorMessage(
        error.message,
        error.status || 500
      )}`
    );
    friendlyError.status = error.status;
    throw friendlyError;
  }
}

// ============================================================================\
// HELPERS FOR SEARCHING AND PROCESSING\
// ============================================================================\

/**
 * Fetch Redmine search page HTML.
 */
async function fetchRedmineSearchHtml(searchUrl) {
  const response = await timeoutFetch(searchUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR} ${response.status}`);
  }
  const html = await response.text();
  if (!html || html.length < 100) {
    throw new Error(TB.MESSAGES.REDMINE.SEARCH_EMPTY_HTML);
  }
  return html;
}

/**
 * Map Backlog issue type to preferred Redmine tracker name aliases.
 * QA → Q/A; Bug/CR/Task when known; 要望* → Task; empty/unknown → no preference.
 */
function getPreferredRedmineTrackerNames(backlogIssueType = "", rules = {}) {
  const type = String(backlogIssueType || "")
    .trim()
    .toLowerCase();
  if (Object.prototype.hasOwnProperty.call(rules.trackerAliases || {}, type)) {
    return rules.trackerAliases[type];
  }
  if (!type) {
    return [];
  }
  if (type === "qa" || type === "q/a" || type === "q&a") {
    return ["q/a", "q&a", "qa"];
  }
  if (type === "bug" || type === "バグ" || type === "不具合") {
    return ["bug"];
  }
  if (type === "cr") {
    return ["cr"];
  }
  // Task + Japanese request types (要望 / 要望（実装） / …) prefer Task, not Q/A
  if (type === "task" || type === "タスク" || type === "課題" || type.startsWith("要望")) {
    return ["task"];
  }
  // Unknown Backlog types: no tracker preference
  return [];
}

/**
 * Extract tracker name from Redmine search link text like "Q/A #123 (New): Title".
 */
function extractTrackerFromSearchSubject(subject = "") {
  const match = String(subject)
    .trim()
    .match(/^(.+?)\s+#\d+\b/);
  return match ? match[1].trim() : "";
}

/**
 * Extract search results from Redmine HTML.
 */
function extractRedmineSearchResults(html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href="([^"]*\/issues\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const subject = decodeHtmlText(stripHtml(match[3])).replace(/\s+/g, " ").trim();
    results.push({
      id: match[2],
      href: decodeHtmlText(match[1]),
      subject,
      tracker: extractTrackerFromSearchSubject(subject),
    });
  }
  return results;
}

const STRONG_SUMMARY_MIN_LENGTH = 12;

function hasExactBacklogKey(subject, issueKey) {
  if (!issueKey) return false;
  const keys =
    String(subject || "")
      .normalize("NFKC")
      .match(/[a-z0-9_]+-\d+/gi) || [];
  return keys.some((key) => key.toLowerCase() === issueKey.toLowerCase());
}

/**
 * Strip Redmine search link prefix like "Task #123 (New): ".
 */
function stripRedmineSearchSubjectPrefix(subject = "") {
  return String(subject || "")
    .replace(/^.+?\s+#\d+\s*\([^)]*\):\s*/u, "")
    .trim();
}

/**
 * Prefer the Japanese title segment for matching.
 * Common Redmine subject shapes:
 * - "【調査】... / ([Điều tra] ...)"  → JP before " / ("
 * - "COUIX_PJ-1 【調査】... (VN)"     → full title still compared via includes()
 */
function extractJapaneseTitlePart(subject = "", rules = {}) {
  if (globalThis.TB_SYNC_RULES) return globalThis.TB_SYNC_RULES.title(subject, rules);
  const title = stripRedmineSearchSubjectPrefix(subject);
  if (!title) {
    return "";
  }
  const bilingualSplit = title.split(/\s\/\s+(?=[([])/u);
  if (bilingualSplit.length > 1) {
    return bilingualSplit[0].trim();
  }
  return title.trim();
}

function hasStrongRedmineTextMatch(
  subject,
  normalizedIssueKey,
  normalizedIssueSummary,
  rules = {}
) {
  const normalizedSubject = normalizeLoose(subject);
  const normalizedComparable = normalizeLoose(extractJapaneseTitlePart(subject, rules));
  if (!normalizedSubject && !normalizedComparable) {
    return false;
  }
  if (normalizedIssueKey && hasExactBacklogKey(subject, normalizedIssueKey)) {
    return true;
  }
  if (!normalizedIssueSummary || normalizedIssueSummary.length < STRONG_SUMMARY_MIN_LENGTH) {
    return false;
  }
  // Compare JP segments; ignore VN translation differences after " / (...)".
  return (
    normalizedComparable === normalizedIssueSummary ||
    normalizedComparable.includes(normalizedIssueSummary) ||
    normalizedSubject.includes(normalizedIssueSummary)
  );
}

/**
 * Pick best match from search results based on scoring.
 * Selects best result based on score (issue key + summary + tracker match).
 * When preferred trackers are set and candidates expose tracker info, never return a mismatched tracker.
 */
function pickBestRedmineSearchResult(
  results,
  normalizedIssueKey,
  normalizedIssueSummary,
  preferredTrackers = [],
  rules = {}
) {
  if (!results?.length) {
    return null;
  }
  const preferred = (preferredTrackers || []).map((name) => normalizeLoose(name)).filter(Boolean);
  const scored = results
    .map((item) => {
      const normalizedSubject = normalizeLoose(item.subject);
      const normalizedComparable = normalizeLoose(extractJapaneseTitlePart(item.subject, rules));
      const trackerName = normalizeLoose(
        item.tracker || extractTrackerFromSearchSubject(item.subject)
      );
      let score = 0;
      const referencedKeys =
        String(item.subject || "")
          .normalize("NFKC")
          .match(/[a-z0-9_]+-\d+/gi) || [];
      if (
        normalizedIssueKey &&
        referencedKeys.length &&
        !hasExactBacklogKey(item.subject, normalizedIssueKey)
      ) {
        return { item, score, trackerName, subject: item.subject };
      }
      if (normalizedIssueKey && hasExactBacklogKey(item.subject, normalizedIssueKey)) {
        score += 10;
      }
      if (
        normalizedIssueSummary &&
        (normalizedComparable === normalizedIssueSummary ||
          normalizedComparable.includes(normalizedIssueSummary) ||
          normalizedSubject.includes(normalizedIssueSummary))
      ) {
        score += 5;
      }
      if (score === 0) return { item, score, trackerName, subject: item.subject };
      if (preferred.length > 0 && trackerName) {
        if (preferred.includes(trackerName)) {
          score += 8;
        } else {
          score -= 4;
        }
      }
      return { item, score, trackerName, subject: item.subject };
    })
    .sort((a, b) => b.score - a.score);

  if (preferred.length > 0) {
    const preferredHit = scored.find(
      (entry) => entry.score > 0 && preferred.includes(entry.trackerName)
    );
    if (
      preferredHit &&
      scored.filter(
        (entry) => entry.score === preferredHit.score && preferred.includes(entry.trackerName)
      ).length > 1
    ) {
      return null;
    }
    if (preferredHit) {
      return preferredHit.item;
    }
    const strongest = scored[0];
    if (strongest && scored.filter((entry) => entry.score === strongest.score).length > 1) {
      return null;
    }
    if (
      strongest &&
      hasStrongRedmineTextMatch(
        strongest.subject,
        normalizedIssueKey,
        normalizedIssueSummary,
        rules
      )
    ) {
      return strongest.item;
    }
    const anyTracked = scored.some((entry) => entry.trackerName);
    // Candidates have tracker metadata but none match preference → do not guess wrong tracker.
    // If the best textual hit is weak, keep searching instead of returning a risky mismatch.
    if (anyTracked) {
      return null;
    }
  }

  return scored[0]?.score > 0 &&
    scored.filter((entry) => entry.score === scored[0].score).length === 1
    ? scored[0].item
    : null;
}

/**
 * Process attachments in notes: download from Backlog, upload to Redmine.
 * Replaces [[TB_IMG:id]] and [[TB_FILE:id:filename]] markers with appropriate Redmine markup.
 * This function is optimized to prevent duplicate uploads of the same attachment ID.
 *
 * @param {string} notes - The text containing attachment markers.
 * @param {string | null} backlogDomain - The Backlog domain. If null, it will be sourced from settings.
 * @param {object} settings - The extension's settings.
 * @param {string} backlogIssueKey - The Backlog issue key.
 * @param {Map|null} processedAttachments - (Optional) Persistent map of [attachmentId -> markup] to reuse across calls.
 * @returns {Promise<{updatedNotes: string, uploads: Array}>}
 */
async function processNotesAttachments(
  notes,
  backlogDomain,
  settings,
  backlogIssueKey,
  processedAttachments = null,
  strictAttachments = false
) {
  if (!notes) {
    return { updatedNotes: "", uploads: [] };
  }

  // ✅ FIX: Ensure we have a valid Backlog domain, sourcing from settings if needed.
  const effectiveBacklogDomain = backlogDomain || settings.backlogDomain;
  if (!effectiveBacklogDomain) {
    throw new Error("Backlog domain is not configured. Cannot download attachments.");
  }

  const uploads = [];
  const failures = [];
  const attachmentRegistry = new Map();
  const imagePattern = /\[\[TB_IMG:\s*(\d+)\s*\]\]/g;
  const filePattern = /\[\[TB_FILE:\s*(\d+)\s*:\s*([^\]]+?)\s*\]\]/g;

  for (const match of notes.matchAll(imagePattern)) {
    const attachmentId = match[1];
    if (!attachmentRegistry.has(attachmentId)) {
      attachmentRegistry.set(attachmentId, {
        filename: `image_${attachmentId}.png`,
        isImageOnly: true,
      });
    }
  }

  for (const match of notes.matchAll(filePattern)) {
    const attachmentId = match[1];
    const filename = match[2].trim();
    if (!attachmentRegistry.has(attachmentId)) {
      attachmentRegistry.set(attachmentId, { filename, isImageOnly: false });
    }
  }

  for (const [attachmentId, info] of attachmentRegistry.entries()) {
    try {
      if (processedAttachments && processedAttachments.has(attachmentId)) {
        info.markup = processedAttachments.get(attachmentId);
        continue;
      }

      const sourceFilename = info.filename;
      const filename = settings.attachmentIdentityPrefix
        ? globalThis.TB_MIGRATION.attachmentFilename(
            sourceFilename,
            settings.attachmentIdentityPrefix,
            attachmentId
          )
        : sourceFilename;

      const blob = await downloadBacklogFile(
        effectiveBacklogDomain, // Use the validated domain
        attachmentId,
        sourceFilename,
        backlogIssueKey
      );

      const token = await uploadToRedmine(
        settings.redmineDomain,
        settings.redmineApiKey,
        blob,
        filename
      );

      if (token) {
        uploads.push({
          token,
          filename,
          content_type: blob.type || "application/octet-stream",
        });

        const ext = filename.split(".").pop().toLowerCase();
        const videoExts = ["mp4", "mov", "webm", "m4v"];
        const imageExts = ["jpg", "jpeg", "png", "gif", "webp"];

        if (videoExts.includes(ext)) {
          info.markup = `{{video(${filename})}}`;
        } else if (imageExts.includes(ext) || info.isImageOnly) {
          info.markup = `!${filename}!`;
        } else {
          info.markup = `attachment:${filename}`;
        }

        if (processedAttachments) {
          processedAttachments.set(attachmentId, info.markup);
        }
      } else {
        throw new Error("Upload token was not received.");
      }
    } catch (e) {
      failures.push(info.filename);
      console.error(`[TB] Attachment processing failed for ID ${attachmentId}:`, e.message);
      const reason = String(e?.message || "unknown error")
        .replace(/https?:\/\/[^\s]+/gi, "[URL]")
        .slice(0, 120);
      info.markup = `[Attachment Error: ${info.filename} — ${reason}]`;
    }
  }

  if (strictAttachments && failures.length) {
    const error = new Error(
      `Attachments were not transferred: ${failures.join(", ")}. Resume to retry the files.`
    );
    error.definitelyNotSent = true;
    throw error;
  }

  let finalNotes = notes;
  for (const [attachmentId, info] of attachmentRegistry.entries()) {
    if (info.markup) {
      const imageMarkerPattern = new RegExp(`\\[\\[TB_IMG:\\s*${attachmentId}\\s*\\]\\]`, "gi");
      const fileMarkerPattern = new RegExp(
        `\\[\\[TB_FILE:\\s*${attachmentId}\\s*:\\s*[^\\]]+\\s*\\]\\]`,
        "gi"
      );

      finalNotes = finalNotes.replace(imageMarkerPattern, info.markup);
      finalNotes = finalNotes.replace(fileMarkerPattern, info.markup);
    }
  }

  return { updatedNotes: finalNotes, uploads };
}

/**
 * Upload file to Redmine and get token.
 * Redmine requires ?filename= so extension allowlists / content detection work.
 */
async function uploadToRedmine(domain, apiKey, blob, filename) {
  if (!blob || blob.size <= 0) {
    throw new Error("Cannot upload empty attachment.");
  }

  const url = buildRedmineUploadUrl(domain, filename);
  const response = await timeoutFetch(
    url,
    {
      method: "POST",
      headers: { "X-Redmine-API-Key": apiKey, "Content-Type": "application/octet-stream" },
      body: blob,
    },
    60000
  );
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    const shortMsg = String(errorMsg)
      .replace(/https?:\/\/[^\s]+/gi, "[URL]")
      .slice(0, 180);
    throw new Error(`Redmine upload failed: ${response.status} ${shortMsg}`.trim());
  }
  const data = await response.json();
  return data?.upload?.token;
}

// ============================================================================\
// NEW FUNCTIONS FOR SPENT TIME LOGGING (ADDITION)
// ============================================================================\

/**
 * Fetches details for a single Redmine issue.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {string} issueId - The ID of the issue to fetch.
 * @returns {Promise<object>} The issue object from the API.
 */
async function getIssueDetails(redmineDomain, apiKey, issueId) {
  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, `/issues/${issueId}.json`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch issue details for #${issueId}: ${errorMsg}`);
  }

  const data = await response.json();
  return data.issue;
}

/**
 * Logs a time entry (spent time) for a specific issue.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {string} issueId - The ID of the issue to log time against.
 * @param {number} hours - The number of hours to log.
 * @param {string} [comments=""] - Optional comments for the time entry.
 * @returns {Promise<object>} The created time entry object from the API.
 */
async function logTimeEntry(
  redmineDomain,
  apiKey,
  issueId,
  hours,
  comments = "",
  spentOn = null,
  activityId = null
) {
  const payload = {
    time_entry: {
      issue_id: issueId,
      hours: hours,
      comments: comments,
      spent_on: spentOn || undefined,
      activity_id: activityId || undefined,
    },
  };

  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, "/time_entries.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to log time for issue #${issueId}: ${errorMsg}`);
  }

  const data = await response.json();
  return data.time_entry;
}

async function updateTimeEntry(
  redmineDomain,
  apiKey,
  timeEntryId,
  issueId,
  hours,
  comments = "",
  spentOn = null,
  activityId = null
) {
  const payload = {
    time_entry: {
      issue_id: issueId,
      hours: hours,
      comments: comments,
      spent_on: spentOn || undefined,
      activity_id: activityId || undefined,
    },
  };

  const response = await redmineAuthorizedFetch(
    redmineDomain,
    apiKey,
    `/time_entries/${timeEntryId}.json`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to update time entry #${timeEntryId}: ${errorMsg}`);
  }

  return payload.time_entry;
}

async function deleteTimeEntry(redmineDomain, apiKey, timeEntryId) {
  const response = await redmineAuthorizedFetch(
    redmineDomain,
    apiKey,
    `/time_entries/${timeEntryId}.json`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to delete time entry #${timeEntryId}: ${errorMsg}`);
  }
}

/**
 * Fetches Redmine spent time activities.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of time entry activities.
 */
async function getTimeEntryActivities(redmineDomain, apiKey) {
  const response = await redmineAuthorizedFetch(
    redmineDomain,
    apiKey,
    "/enumerations/time_entry_activities.json",
    { headers: { "Content-Type": "application/json" } }
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch time entry activities: ${errorMsg}`);
  }

  const data = await response.json();
  return data.time_entry_activities || [];
}

/**
 * Fetches the current user's account information from Redmine.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @returns {Promise<object>} The user object from the API.
 */
async function getCurrentUser(redmineDomain, apiKey) {
  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, "/my/account.json", {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch current user: ${errorMsg}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Fetches all available trackers from Redmine.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of tracker objects.
 */
async function getTrackers(redmineDomain, apiKey) {
  const response = await redmineAuthorizedFetch(redmineDomain, apiKey, "/trackers.json", {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch trackers: ${errorMsg}`);
  }
  const data = await response.json();
  return data.trackers || [];
}

/**
 * Authenticated Redmine fetch.
 * With apiKey (service worker): call Redmine directly.
 * Without apiKey (content script): proxy via background so the key never leaves SW.
 */
async function redmineAuthorizedFetch(redmineDomain, apiKey, pathWithQuery, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const headers = { ...(init.headers || {}) };

  if (apiKey) {
    const url = /^https?:\/\//i.test(pathWithQuery)
      ? pathWithQuery
      : buildRedmineUrl(redmineDomain, pathWithQuery);
    return timeoutFetch(url, {
      ...init,
      method,
      redirect: "error",
      headers: {
        ...headers,
        "X-Redmine-API-Key": apiKey,
      },
    });
  }

  let relativePath = pathWithQuery;
  if (/^https?:\/\//i.test(pathWithQuery)) {
    const parsed = new URL(pathWithQuery);
    relativePath = `${parsed.pathname}${parsed.search}`;
  }

  const response = await sendRuntimeMessage({
    type: "REDMINE_AUTHORIZED_FETCH",
    path: relativePath,
    method,
    body: typeof init.body === "string" ? init.body : null,
    accept: headers.Accept || headers.accept || "application/json",
    contentType: headers["Content-Type"] || headers["content-type"] || null,
  });

  return {
    ok: true,
    status: response.data?.status || 200,
    async json() {
      return response.data?.payload;
    },
    async text() {
      return response.data?.text || "";
    },
  };
}
