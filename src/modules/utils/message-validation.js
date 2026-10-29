/**
 * Validates messages before privileged background handlers process them.
 */
(function (global) {
  const MAX_PAYLOAD_LENGTH = 1000000;
  const FIELD_LIMITS = Object.freeze({
    apiKey: 10000,
    backlogIssueKey: 100,
    content: 100000,
    notes: 200000,
    commentText: 100000,
    commentUrl: 2000,
    domain: 2000,
    endpoint: 500,
    issueKey: 100,
    issueSummary: 1000,
    backlogIssueType: 50,
    recordId: 64,
    redmineIssueId: 30,
    action: 30,
    modelId: 300,
    path: 2000,
    method: 10,
    projectKey: 100,
    provider: 50,
    text: 100000,
    userInfo: 1000,
  });
  const ALLOWED_TYPES = new Set([
    "CLEAR_SYNC_ACTIVITY",
    "CLEAR_RETRY_QUEUE",
    "CREATE_REDMINE_ISSUE",
    "ENQUEUE_RETRY_ITEM",
    "EXTRACT_JAPANESE_CONTENT",
    "FETCH_REDMINE_METADATA",
    "FETCH_REDMINE_ACTIVITIES_WITH_KEY",
    "FETCH_REDMINE_PROJECTS_WITH_KEY",
    "GET_BACKLOG_ISSUE_INFO",
    "GET_BACKLOG_USERS",
    "GET_CRYPTO_STORAGE_ID",
    "GET_DEFAULT_PROJECT_SUMMARY",
    "GET_PROJECT_GLOSSARY",
    "GET_REPORT_SETTINGS",
    "GET_RETRY_QUEUE",
    "GET_UI_SETTINGS",
    "LIST_SYNC_RECOVERY",
    "LOG_ERROR",
    "LOOKUP_AND_TRANSLATE_COMMENT",
    "OPEN_OPTIONS_PAGE",
    "PROCESS_RETRY_ALL",
    "PROCESS_RETRY_ITEM",
    "REDMINE_AUTHORIZED_FETCH",
    "RECORD_SYNC_ACTIVITY",
    "REMOVE_ISSUE_MAPPING",
    "REMOVE_RETRY_ITEM",
    "RESOLVE_COMMENT_SYNC",
    "RESOLVE_MIGRATION",
    "RESUME_COMMENT_SYNC",
    "RESUME_MIGRATION",
    "SAVE_ISSUE_MAPPING",
    "SAVE_PROJECT_GLOSSARY",
    "SEND_TO_BACKLOG",
    "SEND_TO_REDMINE",
    "TEST_MODEL_WITH_KEY",
    "TEST_BACKLOG_CONNECTION",
    "TRANSLATE_COMMENT_FULL",
    "TRANSLATE_TEXT_SIMPLE",
  ]);
  const REQUIRED_FIELDS = Object.freeze({
    FETCH_REDMINE_PROJECTS_WITH_KEY: ["domain", "apiKey"],
    FETCH_REDMINE_ACTIVITIES_WITH_KEY: ["domain", "apiKey"],
    REDMINE_AUTHORIZED_FETCH: ["path"],
    TEST_MODEL_WITH_KEY: ["provider", "modelId", "apiKey"],
    TEST_BACKLOG_CONNECTION: ["domain", "apiKey"],
    GET_BACKLOG_ISSUE_INFO: ["issueKey"],
    GET_BACKLOG_USERS: ["projectKey"],
    GET_REPORT_SETTINGS: [],
    SEND_TO_BACKLOG: ["backlogIssueKey", "content"],
    SEND_TO_REDMINE: ["notes"],
    RESOLVE_COMMENT_SYNC: ["recordId"],
    RESUME_COMMENT_SYNC: ["recordId"],
    RESOLVE_MIGRATION: ["issueKey", "action"],
    RESUME_MIGRATION: ["issueKey"],
    SAVE_ISSUE_MAPPING: ["issueKey", "redmineIssueId"],
    REMOVE_ISSUE_MAPPING: ["issueKey"],
    GET_PROJECT_GLOSSARY: ["projectKey"],
    SAVE_PROJECT_GLOSSARY: ["projectKey", "entries"],
    ENQUEUE_RETRY_ITEM: ["item"],
    REMOVE_RETRY_ITEM: ["itemId"],
    PROCESS_RETRY_ITEM: ["itemId"],
    GET_RETRY_QUEUE: [],
    PROCESS_RETRY_ALL: [],
    CLEAR_RETRY_QUEUE: [],
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
    if (
      ["GET_PROJECT_GLOSSARY", "SAVE_PROJECT_GLOSSARY"].includes(message.type) &&
      (typeof message.projectKey !== "string" || message.projectKey.length > 100)
    ) {
      throw new TypeError("Invalid glossary project key.");
    }
    if (
      message.type === "GET_REPORT_SETTINGS" &&
      message.reportProjectId !== undefined &&
      !/^[1-9]\d*$/.test(message.reportProjectId)
    ) {
      throw new TypeError("Invalid report project ID.");
    }
    if (
      message.type === "GET_REPORT_SETTINGS" &&
      message.profileKey !== undefined &&
      !/^[A-Z0-9_]{1,100}$/.test(message.profileKey)
    ) {
      throw new TypeError("Invalid report profile key.");
    }
    if (
      message.type === "GET_REPORT_SETTINGS" &&
      message.globalProfile !== undefined &&
      typeof message.globalProfile !== "boolean"
    ) {
      throw new TypeError("Invalid global report profile selection.");
    }
    if (message.type === "SAVE_PROJECT_GLOSSARY" && !Array.isArray(message.entries)) {
      throw new TypeError("Glossary entries must be a list.");
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
      message.type === "SEND_TO_REDMINE" &&
      !/^[1-9]\d*$/.test(String(message.redmineIssueId ?? ""))
    ) {
      throw new TypeError("Invalid Redmine issue ID.");
    }
    if (
      (message.type === "SEND_TO_BACKLOG" && !/^[A-Z0-9_]+-\d+$/.test(message.backlogIssueKey)) ||
      (message.type === "GET_BACKLOG_ISSUE_INFO" && !/^[A-Z0-9_]+-\d+$/.test(message.issueKey)) ||
      (message.type === "GET_BACKLOG_USERS" && !/^[A-Z0-9_]+(?:-\d+)?$/.test(message.projectKey)) ||
      ([
        "RESUME_MIGRATION",
        "RESOLVE_MIGRATION",
        "SAVE_ISSUE_MAPPING",
        "REMOVE_ISSUE_MAPPING",
      ].includes(message.type) &&
        !/^[A-Z0-9_]+-\d+$/.test(message.issueKey || ""))
    ) {
      throw new TypeError("Invalid Backlog issue or project key.");
    }
    if (
      ["RESUME_COMMENT_SYNC", "RESOLVE_COMMENT_SYNC"].includes(message.type) &&
      !/^[a-f0-9]{64}$/.test(message.recordId || "")
    ) {
      throw new TypeError("Invalid comment recovery ID.");
    }
    if (
      message.type === "RESOLVE_MIGRATION" &&
      (!["adopt", "confirm-not-sent"].includes(message.action) ||
        (message.action === "adopt" && !/^[1-9]\d*$/.test(message.redmineIssueId || "")))
    ) {
      throw new TypeError("Invalid migration recovery action.");
    }
    if (message.type === "SAVE_ISSUE_MAPPING" && !/^[1-9]\d*$/.test(message.redmineIssueId || "")) {
      throw new TypeError("Invalid Redmine issue ID.");
    }
    if (message.type === "SEND_TO_BACKLOG") {
      const attachments = message.attachments ?? [];
      if (
        !Array.isArray(attachments) ||
        attachments.length > 100 ||
        attachments.some(
          (attachment) =>
            !attachment ||
            typeof attachment.url !== "string" ||
            !attachment.url ||
            attachment.url.length > 2000 ||
            typeof attachment.filename !== "string" ||
            !attachment.filename ||
            attachment.filename.length > 255
        )
      ) {
        throw new TypeError("Invalid Backlog attachments.");
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
