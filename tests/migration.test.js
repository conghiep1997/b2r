const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const test = require("node:test");

const settings = {
  backlogDomain: "https://demo.backlog.com",
  redmineDomain: "https://redmine.example",
  redmineApiKey: "test-key",
};
const request = {
  issueData: {
    backlogIssueKey: "DEMO-1",
    project_id: 1,
    subject: "DEMO-1 example",
    description: "description",
  },
  comments: ["first", "second"],
};

function harness(storage = {}, remote = { issue: null, creates: 0, sends: [] }, failure = {}) {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
    URL,
    console,
    chrome: {
      runtime: {},
      storage: {
        local: {
          get(key, callback) {
            const result =
              key === null
                ? { ...storage }
                : {
                    [key === "tb_storage_id" || Array.isArray(key) ? "tb_storage_id" : key]:
                      storage[
                        key === "tb_storage_id" || Array.isArray(key) ? "tb_storage_id" : key
                      ],
                  };
            if (callback) setImmediate(() => callback(result));
            return Promise.resolve(result);
          },
          set(items, callback) {
            if (failure.storageOffline) return Promise.reject(new Error("Storage offline"));
            Object.assign(storage, items);
            if (callback) setImmediate(callback);
            return Promise.resolve();
          },
          remove(key) {
            delete storage[key];
            return Promise.resolve();
          },
        },
      },
    },
    TB: { BACKLOG_DOMAIN: settings.backlogDomain },
    normalizeBacklogOrigin: (domain) => domain,
    buildRedmineUrl: (domain, path) => new URL(path, domain).href,
    sanitizeErrorMessage: (text) => text,
    timeoutFetch: async (url) => ({
      ok: true,
      json: async () =>
        url.includes("/issues.json?")
          ? { issues: remote.issue ? [remote.issue] : [], total_count: remote.issue ? 1 : 0 }
          : { issue: remote.issue },
    }),
    handleCreateRedmineIssue: async (message) => {
      remote.creates++;
      remote.issue = {
        id: 42,
        project: { id: 1 },
        subject: message.issueData.subject,
        description: message.issueData.description + message.migrationMarker,
        journals: [],
        attachments: [],
      };
      if (failure.createUncertain) {
        failure.createUncertain = false;
        throw new Error("Lost create response");
      }
      return { issueId: 42 };
    },
    handleSendToRedmine: async (message) => {
      if (failure.rejectSecond && message.notes === "second") {
        failure.rejectSecond = false;
        const error = new Error("Rejected");
        error.status = 422;
        throw error;
      }
      if (failure.noRemoteWrite) {
        failure.noRemoteWrite = false;
        throw new Error("Disconnected");
      }
      remote.sends.push(message.notes);
      remote.issue.journals.push({ notes: message.notes + message.syncMarker });
      if (failure.offlineAfterNote) {
        failure.storageOffline = true;
      }
      if (failure.noteUncertain) {
        failure.noteUncertain = false;
        throw new Error("Lost note response");
      }
    },
  });
  for (const file of ["utils/crypto.js", "services/sync-state.js", "services/migration.js"]) {
    vm.runInContext(fs.readFileSync(`src/modules/${file}`, "utf8"), context);
  }
  return {
    context,
    storage,
    remote,
    migrate: (configuration = settings) => context.TB_MIGRATION.migrate(configuration, request),
  };
}

test("completed migration preserves a manually corrected mapping and repairs a missing mapping", async () => {
  const first = harness();
  await first.migrate();
  await first.context.TB_SYNC_STATE.write(settings, "mapping", "DEMO-1", {
    issueId: 99,
    projectId: 1,
  });
  await first.migrate();
  assert.equal((await first.context.TB_SYNC_STATE.read(settings, "mapping", "DEMO-1")).issueId, 99);
  await first.context.TB_SYNC_STATE.remove(settings, "mapping", "DEMO-1");
  await first.migrate();
  assert.equal((await first.context.TB_SYNC_STATE.read(settings, "mapping", "DEMO-1")).issueId, 42);
  assert.equal(first.remote.creates, 1);
});

test("migration retries corrected create fields after a definite rejection", async () => {
  const first = harness();
  const original = first.context.handleCreateRedmineIssue;
  first.context.handleCreateRedmineIssue = async () => {
    throw Object.assign(new Error("Invalid fields"), { status: 422 });
  };
  await assert.rejects(first.migrate(), /Invalid fields/);
  first.context.handleCreateRedmineIssue = original;
  await first.context.TB_MIGRATION.migrate(settings, {
    ...request,
    issueData: { ...request.issueData, subject: "Corrected title" },
  });
  assert.equal(first.remote.issue.subject, "Corrected title");
});

test("failed migration comments accept corrected notes without altering completed notes", async () => {
  const first = harness({}, undefined, { rejectSecond: true });
  await first.migrate();
  await first.context.TB_MIGRATION.migrate(settings, {
    ...request,
    comments: ["first", "corrected second"],
  });
  assert.deepEqual(first.remote.sends, ["first", "corrected second"]);
  const record = await first.context.TB_SYNC_STATE.read(settings, "migration", "DEMO-1");
  assert.equal(record.comments.length, 0);
  assert.equal(record.total, 2);
  assert.equal(record.issueData.description, undefined);
});

test("source-specific attachment names do not merge different source IDs", async () => {
  const first = harness();
  const original = first.context.handleCreateRedmineIssue;
  first.context.handleCreateRedmineIssue = async (message) => {
    const result = await original(message);
    first.remote.issue.attachments = [
      {
        filename: first.context.TB_MIGRATION.attachmentFilename(
          "report.txt",
          message.settingsOverride.attachmentIdentityPrefix,
          "1"
        ),
      },
    ];
    return result;
  };
  let skipped = false;
  first.context.handleSendToRedmine = async (message) => {
    skipped = message.processedAttachments.has("2");
  };
  await first.context.TB_MIGRATION.migrate(settings, {
    ...request,
    issueData: { ...request.issueData, description: "[[TB_FILE:1:report.txt]]" },
    comments: ["[[TB_FILE:2:report.txt]]"],
  });
  assert.equal(skipped, false);
});

test("keyless titles can adopt a matching issue in the configured project", async () => {
  const first = harness({}, undefined, { createUncertain: true });
  await assert.rejects(
    first.context.TB_MIGRATION.migrate(settings, {
      ...request,
      issueData: { ...request.issueData, subject: "Original title without issue key" },
    }),
    /Lost create response/
  );
  await first.context.TB_MIGRATION.resolve(settings, "DEMO-1", "adopt", "42");
  await first.context.TB_MIGRATION.resume(settings, "DEMO-1");
  assert.equal(first.remote.creates, 1);
});

test("migration resumes only failed comments after worker restart, with encrypted state", async () => {
  const first = harness({}, undefined, { rejectSecond: true });
  const partial = await first.migrate();
  assert.equal(partial.failedCommentCount, 1);
  assert.equal(JSON.stringify(first.storage).includes("description"), false);
  const restarted = harness(first.storage, first.remote);
  const complete = await restarted.migrate();
  assert.equal(complete.failedCommentCount, 0);
  assert.deepEqual(first.remote.sends, ["first", "second"]);
  assert.equal(first.remote.creates, 1);
  await restarted.migrate();
  assert.equal(first.remote.sends.length, 2);
});

test("lost creation response is reconciled from the destination marker", async () => {
  const first = harness({}, undefined, { createUncertain: true });
  await assert.rejects(first.migrate(), /Lost create response/);
  const complete = await harness(first.storage, first.remote).migrate();
  assert.equal(complete.issueId, 42);
  assert.equal(first.remote.creates, 1);
});

test("lost comment response is reconciled without sending a duplicate", async () => {
  const first = harness({}, undefined, { noteUncertain: true });
  assert.equal((await first.migrate()).failedCommentCount, 2);
  await harness(first.storage, first.remote).migrate();
  assert.deepEqual(first.remote.sends, ["first", "second"]);
});

test("uncertain missing writes require explicit resolution before another send", async () => {
  const first = harness({}, undefined, { noRemoteWrite: true });
  await first.migrate();
  const restarted = harness(first.storage, first.remote);
  await assert.rejects(restarted.migrate(), /uncertain result/);
  assert.equal(first.remote.sends.length, 0);
  await restarted.context.TB_MIGRATION.resolve(settings, "DEMO-1", "confirm-not-sent");
  await restarted.migrate();
  assert.deepEqual(first.remote.sends, ["first", "second"]);
});

test("concurrent migrations create a single issue and workspace records are isolated", async () => {
  const first = harness();
  await Promise.all([first.migrate(), first.migrate()]);
  assert.equal(first.remote.creates, 1);
  assert.equal(first.remote.sends.length, 2);
  const records = await first.context.TB_SYNC_STATE.list(settings);
  assert.equal(records.length, 2);
  const other = { ...settings, backlogDomain: "https://other.backlog.com" };
  assert.equal(await first.context.TB_SYNC_STATE.read(other, "migration", "DEMO-1"), null);
  assert.equal((await first.context.TB_SYNC_STATE.list(other)).length, 0);
});

test("remote success before a checkpoint storage failure is recovered without duplicate notes", async () => {
  const first = harness({}, undefined, { offlineAfterNote: true });
  await assert.rejects(first.migrate(), /Storage offline/);
  assert.deepEqual(first.remote.sends, ["first"]);
  await harness(first.storage, first.remote).migrate();
  assert.deepEqual(first.remote.sends, ["first", "second"]);
});

test("migration checkpoints preserve the submitted selections during recovery", async () => {
  const first = harness({}, undefined, { rejectSecond: true });
  const selected = { ...request, selection: { commentIndexes: [1, 3], fileIds: ["7"] } };
  await first.context.TB_MIGRATION.migrate(settings, selected);
  const restarted = harness(first.storage, first.remote);
  const record = await restarted.context.TB_SYNC_STATE.read(settings, "migration", "DEMO-1");
  assert.deepEqual(JSON.parse(JSON.stringify(record.selection)), selected.selection);
  await restarted.context.TB_MIGRATION.resume(settings, "DEMO-1");
  assert.deepEqual(first.remote.sends, ["first", "second"]);
});

test("bare migration marker for comment 1 does not falsely match comment 10", async () => {
  const first = harness({}, undefined, { noRemoteWrite: true });
  await first.migrate();
  const record = await first.context.TB_SYNC_STATE.read(settings, "migration", "DEMO-1");
  record.pendingComment = 1;
  await first.context.TB_SYNC_STATE.write(settings, "migration", "DEMO-1", record);
  // Remote journal has bare marker for index 10, not index 1
  first.remote.issue.journals.push({ notes: `tenth\n\nB2R_MIGRATION_${record.id}_10` });
  const restarted = harness(first.storage, first.remote);
  await assert.rejects(restarted.migrate(), /uncertain result/);
});
