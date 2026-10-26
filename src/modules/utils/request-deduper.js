/**
 * Coalesces identical sync requests while the first request is still running.
 */
(function (global) {
  const inFlightRequests = new Map();

  function createKey(type, message, senderScope = "") {
    if (type === "SEND_TO_REDMINE") {
      return JSON.stringify([
        type,
        senderScope,
        message.redmineIssueId,
        message.backlogIssueKey,
        message.notes,
      ]);
    }
    if (type === "SEND_TO_BACKLOG") {
      return JSON.stringify([
        type,
        senderScope,
        message.backlogIssueKey,
        message.content,
        message.notifiedUserId || [],
        (message.attachments || []).map((attachment) => [
          attachment.id || "",
          attachment.filename || "",
          attachment.url || "",
        ]),
      ]);
    }
    throw new TypeError("Unsupported dedupe request type.");
  }

  function run(key, operation) {
    const existing = inFlightRequests.get(key);
    if (existing) return existing;

    const request = Promise.resolve().then(operation);
    inFlightRequests.set(key, request);
    const cleanup = () => {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key);
      }
    };
    request.then(cleanup, cleanup);
    return request;
  }

  global.TB_REQUEST_DEDUPER = Object.freeze({ createKey, run });
})(globalThis);
