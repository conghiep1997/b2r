/* global TB_SYNC_STATE, TB_MIGRATION */
/** Durable comment submissions with reconciliation after ambiguous network results. */
(function (global) {
  async function identity(request) {
    const revision = request.sourceCommentText || request.notes || request.content;
    const value = JSON.stringify([
      request.type,
      request.redmineIssueId || "",
      request.backlogIssueKey,
      request.sourceCommentUrl || "",
      revision,
    ]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  function markerIsPresent(text, marker) {
    const notes = String(text || "");
    if (notes.includes(marker)) return true;
    // Older records used HTML comments, which markdownToTextile escaped before
    // Redmine stored them. Keep those in-flight records recoverable.
    const escaped = marker.replace(/</g, "&#60;").replace(/>/g, "&#62;");
    const namedEscaped = marker.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return notes.includes(escaped) || notes.includes(namedEscaped);
  }

  async function reconcile(settings, record) {
    const request = record.request;
    if (request.type === "SEND_TO_REDMINE") {
      const issue = await TB_MIGRATION.remoteIssue(settings, request.redmineIssueId);
      if ((issue.journals || []).some((journal) => markerIsPresent(journal.notes, record.marker))) {
        return {
          redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${issue.id}`),
          deduplicated: true,
        };
      }
      return null;
    }
    const origin = getTrustedBacklogApiOrigin(settings.backlogDomain || TB.BACKLOG_DOMAIN);
    let maxId = null;
    for (;;) {
      const url = new URL(`api/v2/issues/${request.backlogIssueKey}/comments`, origin);
      url.searchParams.set("apiKey", settings.backlogApiKey);
      url.searchParams.set("count", "100");
      url.searchParams.set("order", "desc");
      if (maxId !== null) url.searchParams.set("maxId", String(maxId));
      const response = await timeoutFetch(url.toString(), { redirect: "error" }, 30000);
      if (!response.ok) {
        const error = new Error(`Unable to reconcile Backlog comments (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
      }
      const comments = await response.json();
      if (!Array.isArray(comments)) throw new Error("Invalid Backlog comment response.");
      const hit = comments.find((comment) => String(comment.content || "").includes(record.marker));
      if (hit) {
        return {
          commentId: hit.id,
          backlogUrl: new URL(`view/${request.backlogIssueKey}#comment-${hit.id}`, origin).href,
          deduplicated: true,
          partial: (request.attachments || []).length > 0,
          attachmentResults: (request.attachments || []).map((file) => ({
            filename: file.filename,
            ok: false,
            error: "Verify the destination attachments after the interrupted response.",
          })),
        };
      }
      if (comments.length < 100) return null;
      const next = Math.min(...comments.map((comment) => Number(comment.id))) - 1;
      if (!Number.isSafeInteger(next) || (maxId !== null && next >= maxId)) {
        throw new Error("Backlog comment pagination did not advance.");
      }
      maxId = next;
    }
  }

  async function send(settings, request, sender) {
    const recordId = await identity(request);
    return TB_SYNC_STATE.run(
      async () => {
        let record = await TB_SYNC_STATE.read(settings, "comment", recordId);
        if (!record) {
          record = { id: crypto.randomUUID(), request, state: "ready" };
          // Keep the idempotency token plain text so Markdown/Textile conversion
          // cannot escape it before it is persisted by Redmine.
          // Invisible separators keep the idempotency token out of rendered comments.
          record.marker = `\u2063B2R_SYNC_${record.id}\u2063`;
          await TB_SYNC_STATE.write(settings, "comment", recordId, record);
        }
        if (record.state === "ready") {
          record.request = request;
          await TB_SYNC_STATE.write(settings, "comment", recordId, record);
        }
        const save = () =>
          TB_SYNC_STATE.write(
            settings,
            "comment",
            recordId,
            record.state === "complete"
              ? {
                  ...record,
                  request: {
                    type: record.request.type,
                    backlogIssueKey: record.request.backlogIssueKey,
                    redmineIssueId: record.request.redmineIssueId,
                  },
                }
              : record
          );
        if (record.state === "complete") {
          let destinationGone = false;
          try {
            const exists = await reconcile(settings, record);
            if (!exists) destinationGone = true;
          } catch (error) {
            destinationGone = error.status === 404 || error.status === 410;
          }
          if (destinationGone) {
            record = {
              id: crypto.randomUUID(),
              request,
              state: "ready",
            };
            record.marker = `\u2063B2R_SYNC_${record.id}\u2063`;
            await TB_SYNC_STATE.write(settings, "comment", recordId, record);
          } else {
            return { ...record.result, deduplicated: true };
          }
        }
        if (record.state === "sending") {
          const result = await reconcile(settings, record);
          if (!result) {
            throw new Error(
              "The last comment has an uncertain result. Recheck or resolve the saved comment in Options before retrying."
            );
          }
          record.result = result;
          record.state = "complete";
          await save();
          return result;
        }
        const message = {
          ...record.request,
          settingsOverride: settings,
          syncMarker: record.marker,
          strictAttachments: true,
          onBeforeSubmit: async () => {
            record.state = "sending";
            await save();
          },
        };
        try {
          const result =
            request.type === "SEND_TO_REDMINE"
              ? await handleSendToRedmine(message, sender)
              : await handleSendToBacklog(message);
          record.result = result;
          record.state = "complete";
          await save();
          return result;
        } catch (error) {
          if (error.definitelyNotSent || (error.status >= 400 && error.status < 500)) {
            record.state = "ready";
            await save();
          }
          throw error;
        }
      },
      settings,
      "comment",
      recordId
    );
  }

  async function resume(settings, recordId) {
    const record = await TB_SYNC_STATE.read(settings, "comment", recordId);
    if (!record) throw new Error("Saved comment was not found in this workspace.");
    if (record.state === "complete") return { ...record.result, deduplicated: true };
    return send(settings, record.request, null);
  }

  async function resolve(settings, recordId) {
    return TB_SYNC_STATE.run(
      async () => {
        const record = await TB_SYNC_STATE.read(settings, "comment", recordId);
        if (!record || record.state !== "sending") {
          throw new Error("This comment has no uncertain submission to resolve.");
        }
        const result = await reconcile(settings, record);
        record.state = result ? "complete" : "ready";
        if (result) record.result = result;
        await TB_SYNC_STATE.write(
          settings,
          "comment",
          recordId,
          record.state === "complete"
            ? {
                ...record,
                request: {
                  type: record.request.type,
                  backlogIssueKey: record.request.backlogIssueKey,
                  redmineIssueId: record.request.redmineIssueId,
                },
              }
            : record
        );
      },
      settings,
      "comment",
      recordId
    );
  }

  global.TB_COMMENT_SYNC = Object.freeze({ send, resume, resolve, identity });
})(globalThis);
