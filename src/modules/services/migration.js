/* global TB_SYNC_STATE */
/** Persisted migration: completed work is skipped, uncertain writes are reconciled. */
(function (global) {
  function marker(id, index = "issue") {
    return `<!-- b2r:${id}:${index} -->`;
  }

  function attachmentFilename(filename, prefix, sourceId) {
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const extension = dot > 0 ? filename.slice(dot) : "";
    return `${stem}__b2r_${prefix}_${sourceId}${extension}`;
  }

  async function remoteIssue(settings, issueId) {
    const response = await timeoutFetch(
      buildRedmineUrl(
        settings.redmineDomain,
        `/issues/${issueId}.json?include=journals,attachments`
      ),
      {
        headers: { "X-Redmine-API-Key": settings.redmineApiKey, Accept: "application/json" },
        redirect: "error",
      },
      30000
    );
    if (!response.ok) {
      throw new Error(`Unable to reconcile destination issue (HTTP ${response.status}).`);
    }
    return (await response.json()).issue;
  }

  async function reconcileCreate(settings, record) {
    for (let offset = 0; ; offset += 100) {
      const path = `/issues.json?project_id=${encodeURIComponent(record.issueData.project_id)}&subject=${encodeURIComponent("~" + record.issueData.subject)}&status_id=*&limit=100&offset=${offset}`;
      const response = await timeoutFetch(
        buildRedmineUrl(settings.redmineDomain, path),
        {
          headers: { "X-Redmine-API-Key": settings.redmineApiKey, Accept: "application/json" },
          redirect: "error",
        },
        30000
      );
      if (!response.ok) {
        throw new Error("Unable to check whether the destination issue was created.");
      }
      const payload = await response.json();
      const hits = (payload.issues || []).filter((issue) =>
        String(issue.description || "").includes(marker(record.id))
      );
      if (hits.length > 1) {
        throw new Error(
          "Multiple destination issues have the migration reference. Select the correct issue in recovery settings."
        );
      }
      if (hits.length === 1) return hits[0].id;
      if (offset + (payload.issues || []).length >= (payload.total_count || 0)) return null;
    }
  }

  async function migrate(settings, request) {
    const identity = request.issueData.backlogIssueKey;
    if (!/^[A-Z0-9_]+-\d+$/.test(identity || "")) throw new Error("Invalid source issue key.");
    return TB_SYNC_STATE.run(
      async () => {
        let record = await TB_SYNC_STATE.read(settings, "migration", identity);
        if (!record) {
          record = {
            id: crypto.randomUUID(),
            attachmentPrefix: crypto.randomUUID(),
            issueData: request.issueData,
            comments: request.comments || [],
            selection: request.selection || null,
            completed: [],
            pendingComment: null,
            attachments: [],
            state: "ready",
            issueId: null,
          };
          await TB_SYNC_STATE.write(settings, "migration", identity, record);
        }
        if (record.state !== "complete" && !record.attachmentPrefix) {
          record.attachmentPrefix = crypto.randomUUID();
          await TB_SYNC_STATE.write(settings, "migration", identity, record);
        }
        if (!record.issueId && record.state === "ready") {
          record.issueData = request.issueData;
          record.comments = request.comments || [];
          record.selection = request.selection ?? record.selection;
          record.attachments = [];
          await TB_SYNC_STATE.write(settings, "migration", identity, record);
        }
        const save = () =>
          TB_SYNC_STATE.write(
            settings,
            "migration",
            identity,
            record.state === "complete"
              ? {
                  ...record,
                  total: record.total ?? record.comments.length,
                  issueData: {
                    backlogIssueKey: identity,
                    project_id: record.issueData.project_id,
                    subject: record.issueData.subject,
                  },
                  comments: [],
                  completed: [],
                  attachments: [],
                }
              : record
          );
        if (record.state === "complete") {
          const result = record.result || {
            issueId: record.issueId,
            redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${record.issueId}`),
            migratedCommentCount: record.total ?? record.comments.length,
            failedCommentCount: 0,
            failedComments: [],
            resumed: true,
            migrationId: record.id,
          };
          record.result = result;
          await save();
          // Repair a missing mapping without replacing a manually corrected destination.
          if (!(await TB_SYNC_STATE.read(settings, "mapping", identity))) {
            await TB_SYNC_STATE.write(settings, "mapping", identity, {
              issueId: record.issueId,
              projectId: record.issueData.project_id,
            });
          }
          return { ...result, resumed: true };
        }
        if (record.issueId && record.state === "partial" && record.pendingComment === null) {
          const comments = request.comments || [];
          if (
            comments.length !== record.comments.length ||
            record.completed.some((index) => comments[index] !== record.comments[index])
          ) {
            throw new Error(
              "Keep completed comments and their order unchanged when retrying a migration."
            );
          }
          if (JSON.stringify(request.issueData) !== JSON.stringify(record.issueData)) {
            throw new Error(
              "The destination issue already exists. Edit its fields in Redmine and resume the saved migration."
            );
          }
          record.comments = comments;
          await save();
        }
        if (!record.issueId && record.state === "creating") {
          record.issueId = await reconcileCreate(settings, record);
          if (!record.issueId) {
            throw new Error(
              "Issue creation has an uncertain result. Recheck recovery settings or link the destination issue; a duplicate will not be created automatically."
            );
          }
          await save();
        }
        const attachments = new Map(record.attachments);
        if (!record.issueId) {
          record.state = "creating";
          await save();
          try {
            const created = await handleCreateRedmineIssue({
              issueData: record.issueData,
              comments: [],
              migrationMarker: marker(record.id),
              processedAttachments: attachments,
              settingsOverride: { ...settings, attachmentIdentityPrefix: record.attachmentPrefix },
              strictAttachments: true,
            });
            record.issueId = created.issueId;
            record.attachments = [...attachments];
            await save();
          } catch (error) {
            if (error.definitelyNotSent || (error.status >= 400 && error.status < 500)) {
              record.state = "ready";
              await save();
            }
            throw error;
          }
        }
        const destination = await remoteIssue(settings, record.issueId);
        if (String(destination.project?.id) !== String(record.issueData.project_id)) {
          throw new Error("Destination project does not match this migration.");
        }
        // A filename is not a source identity. Reuse only explicitly saved source mappings.
        if (record.attachmentPrefix) {
          for (const text of [record.issueData.description || "", ...record.comments]) {
            for (const match of text.matchAll(
              /\[\[TB_(IMG|FILE):\s*(\d+)(?::\s*([^\]]+))?\s*\]\]/g
            )) {
              const filename = attachmentFilename(
                match[3]?.trim() || `image_${match[2]}.png`,
                record.attachmentPrefix,
                match[2]
              );
              if ((destination.attachments || []).some((file) => file.filename === filename)) {
                attachments.set(
                  match[2],
                  /\.(png|jpg|jpeg|gif|webp)$/i.test(filename)
                    ? `!${filename}!`
                    : /\.(mp4|mov|webm|m4v)$/i.test(filename)
                      ? `{{video(${filename})}}`
                      : `attachment:${filename}`
                );
              }
            }
          }
        }
        if (record.pendingComment !== null) {
          const index = record.pendingComment;
          if (
            (destination.journals || []).some((journal) =>
              String(journal.notes || "").includes(marker(record.id, index))
            )
          ) {
            if (!record.completed.includes(index)) record.completed.push(index);
            record.pendingComment = null;
            await save();
          } else {
            throw new Error(
              "A comment has an uncertain result. Recheck recovery settings before retrying; completed comments will not be sent again."
            );
          }
        }
        const failedComments = [];
        record.state = "sending";
        for (let index = 0; index < record.comments.length; index++) {
          if (record.completed.includes(index)) continue;
          record.pendingComment = index;
          await save();
          try {
            await handleSendToRedmine(
              {
                redmineIssueId: record.issueId,
                notes: record.comments[index],
                backlogIssueKey: identity,
                processedAttachments: attachments,
                syncMarker: marker(record.id, index),
                settingsOverride: {
                  ...settings,
                  attachmentIdentityPrefix: record.attachmentPrefix,
                },
                strictAttachments: true,
              },
              null
            );
            record.completed.push(index);
            record.pendingComment = null;
            record.attachments = [...attachments];
            await save();
          } catch (error) {
            if (error.definitelyNotSent || (error.status >= 400 && error.status < 500)) {
              record.pendingComment = null;
              await save();
            }
            failedComments.push({ index: index + 1, message: sanitizeErrorMessage(error.message) });
            break;
          }
        }
        record.state = record.completed.length === record.comments.length ? "complete" : "partial";
        await save();
        await TB_SYNC_STATE.write(settings, "mapping", identity, {
          issueId: record.issueId,
          projectId: record.issueData.project_id,
        });
        record.result = {
          issueId: record.issueId,
          redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${record.issueId}`),
          migratedCommentCount: record.completed.length,
          failedCommentCount: record.comments.length - record.completed.length,
          failedComments,
          resumed: Boolean(record.completed.length),
          migrationId: record.id,
        };
        await save();
        return record.result;
      },
      settings,
      "migration",
      identity
    );
  }

  async function resume(settings, issueKey) {
    const record = await TB_SYNC_STATE.read(settings, "migration", issueKey);
    if (!record) throw new Error("Migration checkpoint was not found in this workspace.");
    return migrate(settings, { issueData: record.issueData, comments: record.comments });
  }

  async function resolve(settings, issueKey, action, issueId) {
    return TB_SYNC_STATE.run(
      async () => {
        const record = await TB_SYNC_STATE.read(settings, "migration", issueKey);
        if (!record) throw new Error("Migration checkpoint was not found.");
        if (action === "adopt") {
          if (!Number.isSafeInteger(Number(issueId)) || Number(issueId) <= 0) {
            throw new Error("Invalid destination issue ID.");
          }
          const issue = await remoteIssue(settings, issueId);
          if (
            String(issue.project?.id) !== String(record.issueData.project_id) ||
            (!String(issue.description || "").includes(marker(record.id)) &&
              String(issue.subject || "").trim() !== String(record.issueData.subject || "").trim())
          ) {
            throw new Error("Destination issue does not match the source issue and project.");
          }
          record.issueId = issue.id;
          record.state = "partial";
        } else if (action === "confirm-not-sent") {
          if (record.pendingComment !== null) {
            const issue = await remoteIssue(settings, record.issueId);
            if (
              (issue.journals || []).some((journal) =>
                String(journal.notes || "").includes(marker(record.id, record.pendingComment))
              )
            ) {
              record.completed.push(record.pendingComment);
            }
            record.pendingComment = null;
          } else if (!record.issueId && record.state === "creating") {
            record.issueId = await reconcileCreate(settings, record);
            record.state = record.issueId ? "partial" : "ready";
          } else throw new Error("This migration has no uncertain operation to resolve.");
        } else throw new Error("Unsupported recovery action.");
        await TB_SYNC_STATE.write(settings, "migration", issueKey, record);
      },
      settings,
      "migration",
      issueKey
    );
  }

  global.TB_MIGRATION = Object.freeze({
    migrate,
    remoteIssue,
    reconcileCreate,
    resume,
    resolve,
    attachmentFilename,
  });
})(globalThis);
