const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const test = require("node:test");

const settings = {
  backlogDomain: "https://demo.backlog.com",
  redmineDomain: "https://redmine.example",
  backlogApiKey: "test-key",
};
const request = {
  type: "SEND_TO_REDMINE",
  redmineIssueId: "42",
  backlogIssueKey: "DEMO-1",
  notes: "translation",
  sourceCommentUrl: "https://demo.backlog.com/view/DEMO-1#comment-1",
  sourceCommentText: "original",
};

function harness(storage = {}, remote = { notes: [], comments: [], writes: 0 }, failures = {}) {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
    URL,
    console,
    TB: { BACKLOG_DOMAIN: settings.backlogDomain },
    normalizeBacklogOrigin: (domain) => domain,
    getTrustedBacklogApiOrigin: (domain) => domain,
    buildRedmineUrl: (domain, path) => new URL(path, domain).href,
    chrome: {
      runtime: {},
      storage: {
        local: {
          get(key, callback) {
            const result =
              key === null
                ? { ...storage }
                : Array.isArray(key)
                  ? { tb_storage_id: storage.tb_storage_id }
                  : { [key]: storage[key] };
            if (callback) setImmediate(() => callback(result));
            return Promise.resolve(result);
          },
          set(items, callback) {
            if (failures.storageOffline) return Promise.reject(new Error("Storage offline"));
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
    TB_MIGRATION: { remoteIssue: async () => ({ id: 42, journals: remote.notes }) },
    timeoutFetch: async () => ({ ok: true, json: async () => remote.comments }),
  });
  const submit = async (message, reverse) => {
    await message.onBeforeSubmit();
    if (failures.absent) {
      failures.absent = false;
      throw new Error("Disconnected");
    }
    remote.writes++;
    if (reverse) remote.comments.push({ id: 7, content: message.content + message.syncMarker });
    else remote.notes.push({ notes: message.notes + message.syncMarker });
    if (failures.lostResponse) {
      failures.lostResponse = false;
      throw new Error("Lost response");
    }
    if (failures.offlineAfterWrite) failures.storageOffline = true;
    return reverse
      ? {
          commentId: 7,
          backlogUrl: "https://demo.backlog.com/view/DEMO-1#comment-7",
          partial: false,
        }
      : { redmineUrl: "https://redmine.example/issues/42" };
  };
  context.handleSendToRedmine = (message) => submit(message, false);
  context.handleSendToBacklog = (message) => submit(message, true);
  for (const file of ["utils/crypto.js", "services/sync-state.js", "services/comment-sync.js"])
    vm.runInContext(fs.readFileSync(`src/modules/${file}`, "utf8"), context);
  return {
    context,
    storage,
    remote,
    send: (message = request, configuration = settings) =>
      context.TB_COMMENT_SYNC.send(configuration, message, null),
  };
}

test("comments retry corrected preview after a definite rejection and compact completed payloads", async () => {
  const first = harness();
  const original = first.context.handleSendToRedmine;
  first.context.handleSendToRedmine = async () => {
    throw Object.assign(new Error("Rejected"), { status: 422 });
  };
  await assert.rejects(first.send(), /Rejected/);
  first.context.handleSendToRedmine = original;
  await first.send({ ...request, notes: "corrected" });
  assert.ok(first.remote.notes[0].notes.startsWith("corrected"));
  const record = await first.context.TB_SYNC_STATE.read(
    settings,
    "comment",
    await first.context.TB_COMMENT_SYNC.identity(request)
  );
  assert.equal(record.request.sourceCommentText, undefined);
  assert.equal(record.request.notes, undefined);
  assert.equal(
    (await first.context.TB_COMMENT_SYNC.resume(settings, record.identity)).deduplicated,
    true
  );
});

test("ordinary comments remain deduplicated after restart and a changed AI translation", async () => {
  const first = harness();
  await first.send();
  const restarted = harness(first.storage, first.remote);
  assert.equal(
    (await restarted.send({ ...request, notes: "different translation" })).deduplicated,
    true
  );
  assert.equal(first.remote.writes, 1);
  assert.equal(JSON.stringify(first.storage).includes("original"), false);
  await restarted.send({ ...request, sourceCommentText: "edited original" });
  assert.equal(first.remote.writes, 2);
});

test("both directions reconcile lost responses instead of creating duplicate comments", async () => {
  for (const reverse of [false, true]) {
    const message = reverse
      ? { ...request, type: "SEND_TO_BACKLOG", content: "extracted", notes: undefined }
      : request;
    const first = harness({}, undefined, { lostResponse: true });
    await assert.rejects(first.send(message), /Lost response/);
    const result = await harness(first.storage, first.remote).send(message);
    assert.equal(result.deduplicated, true);
    assert.equal(first.remote.writes, 1);
  }
});

test("comments survive remote success followed by local checkpoint failure", async () => {
  const first = harness({}, undefined, { offlineAfterWrite: true });
  await assert.rejects(first.send(), /Storage offline/);
  await harness(first.storage, first.remote).send();
  assert.equal(first.remote.writes, 1);
});

test("absent uncertain comments require explicit resolution before retry", async () => {
  const first = harness({}, undefined, { absent: true });
  await assert.rejects(first.send(), /Disconnected/);
  const restarted = harness(first.storage, first.remote);
  await assert.rejects(restarted.send(), /uncertain result/);
  const id = await restarted.context.TB_COMMENT_SYNC.identity(request);
  await restarted.context.TB_COMMENT_SYNC.resolve(settings, id);
  await restarted.send();
  assert.equal(first.remote.writes, 1);
});

test("concurrent sends and workspace scopes keep separate durable identities", async () => {
  const first = harness();
  await Promise.all([first.send(), first.send()]);
  assert.equal(first.remote.writes, 1);
  await first.send(request, { ...settings, redmineDomain: "https://other.example" });
  assert.equal(first.remote.writes, 2);
  await first.send({
    ...request,
    sourceCommentUrl: "https://demo.backlog.com/view/DEMO-1#comment-2",
  });
  assert.equal(first.remote.writes, 3);
});
