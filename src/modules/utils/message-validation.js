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
    "CREATE_REDMINE_ISSUE",
    "EXTRACT_JAPANESE_CONTENT",
    "FETCH_REDMINE_METADATA",
    "FETCH_REDMINE_PROJECTS_WITH_KEY",
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
    FETCH_REDMINE_PROJECTS_WITH_KEY: ["domain", "apiKey"],
    REDMINE_AUTHORIZED_FETCH: ["path"],
    TEST_MODEL_WITH_KEY: ["provider", "modelId", "apiKey"],
    TEST_BACKLOG_CONNECTION: ["domain", "apiKey"],
    GET_BACKLOG_ISSUE_INFO: ["issueKey"],
    GET_BACKLOG_USERS: ["projectKey"],
    SEND_TO_BACKLOG: ["backlogIssueKey", "content"],
    SEND_TO_REDMINE: ["notes"],
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
      message.type === "SEND_TO_REDMINE" &&
      !/^[1-9]\d*$/.test(String(message.redmineIssueId ?? ""))
    ) {
      throw new TypeError("Invalid Redmine issue ID.");
    }
    if (
      (message.type === "SEND_TO_BACKLOG" && !/^[A-Z0-9_]+-\d+$/.test(message.backlogIssueKey)) ||
      (message.type === "GET_BACKLOG_ISSUE_INFO" && !/^[A-Z0-9_]+-\d+$/.test(message.issueKey)) ||
      (message.type === "GET_BACKLOG_USERS" && !/^[A-Z0-9_]+(?:-\d+)?$/.test(message.projectKey))
    ) {
      throw new TypeError("Invalid Backlog issue or project key.");
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
