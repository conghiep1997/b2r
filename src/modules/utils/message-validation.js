/**
 * Validates messages before privileged background handlers process them.
 */
(function (global) {
  const MAX_PAYLOAD_LENGTH = 1000000;
  const FIELD_LIMITS = Object.freeze({
    recordId: 64,
    sourceCommentUrl: 2000,
    sourceCommentText: 100000,
    notes: 100000,
    content: 100000,
    backlogIssueKey: 100,
    action: 30,
    redmineIssueId: 30,
    apiKey: 10000,
    commentText: 100000,
    commentUrl: 2000,
    domain: 2000,
    endpoint: 500,
    issueKey: 100,
    issueSummary: 1000,
    backlogIssueType: 50,
    modelId: 300,
    path: 2000,
    method: 10,
    projectKey: 108,
    provider: 50,
    text: 100000,
    userInfo: 1000,
  });
  const ALLOWED_TYPES = new Set([
    "GET_BACKLOG_ISSUE_KEY",
    "GET_PROJECT_GLOSSARY",
    "SAVE_PROJECT_GLOSSARY",
    "RESUME_COMMENT_SYNC",
    "RESOLVE_COMMENT_SYNC",
    "LIST_SYNC_RECOVERY",
    "RESUME_MIGRATION",
    "RESOLVE_MIGRATION",
    "SAVE_ISSUE_MAPPING",
    "REMOVE_ISSUE_MAPPING",
    "GET_CRYPTO_STORAGE_ID",
    "CLEAR_SYNC_ACTIVITY",
    "CREATE_REDMINE_ISSUE",
    "EXTRACT_JAPANESE_CONTENT",
    "FETCH_REDMINE_METADATA",
    "FETCH_REDMINE_PROJECTS_WITH_KEY",
    "FETCH_REDMINE_ACTIVITIES_WITH_KEY",
    "GET_BACKLOG_ISSUE_INFO",
    "GET_BACKLOG_USERS",
    "GET_DEFAULT_PROJECT_SUMMARY",
    "GET_REPORT_SETTINGS",
    "GET_UI_SETTINGS",
    "LOG_ERROR",
    "LOOKUP_AND_TRANSLATE_COMMENT",
    "OPEN_OPTIONS_PAGE",
    "REDMINE_AUTHORIZED_FETCH",
    "RECORD_SYNC_ACTIVITY",
    "SEND_TO_BACKLOG",
    "SEND_TO_REDMINE",
    "TEST_MODEL_WITH_KEY",
    "TEST_BACKLOG_CONNECTION",
    "TRANSLATE_COMMENT_FULL",
    "TRANSLATE_TEXT_SIMPLE",
  ]);
  const REQUIRED_FIELDS = Object.freeze({
    GET_BACKLOG_ISSUE_KEY: ["redmineIssueId"],
    GET_PROJECT_GLOSSARY: ["projectKey"],
    SAVE_PROJECT_GLOSSARY: ["projectKey"],
    RESUME_COMMENT_SYNC: ["recordId"],
    RESOLVE_COMMENT_SYNC: ["recordId"],
    SEND_TO_REDMINE: ["redmineIssueId", "notes", "backlogIssueKey"],
    SEND_TO_BACKLOG: ["content", "backlogIssueKey"],
    RESUME_MIGRATION: ["issueKey"],
    RESOLVE_MIGRATION: ["issueKey", "action"],
    SAVE_ISSUE_MAPPING: ["issueKey", "redmineIssueId"],
    REMOVE_ISSUE_MAPPING: ["issueKey"],
    FETCH_REDMINE_PROJECTS_WITH_KEY: ["domain", "apiKey"],
    FETCH_REDMINE_ACTIVITIES_WITH_KEY: ["domain", "apiKey"],
    REDMINE_AUTHORIZED_FETCH: ["path"],
    TEST_MODEL_WITH_KEY: ["provider", "modelId", "apiKey"],
    TEST_BACKLOG_CONNECTION: ["domain", "apiKey"],
  });

  function assertMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new TypeError("Invalid extension message.");
    }
    if (typeof message.type !== "string" || !ALLOWED_TYPES.has(message.type)) {
      throw new TypeError("Unsupported extension message type.");
    }

    let serialized;
    try {
      serialized = JSON.stringify(message);
    } catch {
      throw new TypeError("Extension message must be serializable.");
    }
    if (serialized.length > MAX_PAYLOAD_LENGTH) {
      throw new RangeError("Extension message payload is too large.");
    }

    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (message[field] !== undefined && typeof message[field] !== "string") {
        throw new TypeError(`Message field '${field}' must be a string.`);
      }
      if (message[field]?.length > limit) {
        throw new RangeError(`Message field '${field}' is too long.`);
      }
    }

    for (const field of REQUIRED_FIELDS[message.type] || []) {
      if (!message[field]) {
        throw new TypeError(`Message field '${field}' is required.`);
      }
    }
    if (
      ["RESUME_COMMENT_SYNC", "RESOLVE_COMMENT_SYNC"].includes(message.type) &&
      !/^[a-f0-9]{64}$/.test(message.recordId)
    ) {
      throw new TypeError("Invalid comment recovery ID.");
    }
    if (["SEND_TO_REDMINE", "SEND_TO_BACKLOG"].includes(message.type)) {
      if (
        !/^[A-Z0-9_]+-\d+$/.test(message.backlogIssueKey || "") ||
        (message.type === "SEND_TO_REDMINE" && !/^\d+$/.test(message.redmineIssueId || ""))
      ) {
        throw new TypeError("Invalid comment destination.");
      }
      if (
        message.attachments !== undefined &&
        (!Array.isArray(message.attachments) ||
          message.attachments.length > 100 ||
          message.attachments.some(
            (file) =>
              !file ||
              typeof file.url !== "string" ||
              file.url.length > 2000 ||
              typeof file.filename !== "string" ||
              file.filename.length > 300
          ))
      ) {
        throw new TypeError("Invalid comment attachments.");
      }
    }
    if (message.type === "CREATE_REDMINE_ISSUE") {
      const issue = message.issueData;
      if (
        !issue ||
        typeof issue !== "object" ||
        Array.isArray(issue) ||
        !/^[A-Z0-9_]+-\d+$/.test(issue.backlogIssueKey || "") ||
        typeof issue.subject !== "string" ||
        !issue.subject.trim() ||
        issue.subject.length > 1000 ||
        typeof issue.description !== "string" ||
        issue.description.length > 500000 ||
        !/^\d+$/.test(String(issue.project_id || "")) ||
        (message.comments !== undefined &&
          (!Array.isArray(message.comments) ||
            message.comments.some((note) => typeof note !== "string" || note.length > 100000)))
      ) {
        throw new TypeError("Invalid migration request.");
      }
    }
    if (message.type === "RECORD_SYNC_ACTIVITY") {
      const entry = message.entry;
      if (
        !entry ||
        !["translate", "migration", "reverse-sync"].includes(entry.operation) ||
        typeof entry.issue !== "string" ||
        entry.issue.length > 100 ||
        !Number.isSafeInteger(entry.count) ||
        entry.count < 0 ||
        typeof entry.ok !== "boolean" ||
        (entry.partial !== undefined && typeof entry.partial !== "boolean")
      ) {
        throw new TypeError("Invalid sync activity entry.");
      }
      for (const [field, limit] of [
        ["detail", 10000],
        ["url", 2000],
      ]) {
        if (
          entry[field] !== undefined &&
          (typeof entry[field] !== "string" || entry[field].length > limit)
        ) {
          throw new TypeError(`Invalid sync activity ${field}.`);
        }
      }
      if (entry.url && !/^https?:\/\//i.test(entry.url)) {
        throw new TypeError("Invalid sync activity URL.");
      }
    }
  }

  function assertInternalSender(sender, runtimeId) {
    if (!runtimeId || sender?.id !== runtimeId) {
      throw new Error("Untrusted extension message sender.");
    }
  }

  global.TB_MESSAGE_VALIDATION = Object.freeze({
    assertInternalSender,
    assertMessage,
  });
})(globalThis);
