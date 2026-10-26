const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const src = path.join(__dirname, "..", "src");
const sender = (tabId = 1) => ({
  id: "test-extension",
  url: "https://demo.backlog.com/view/DEMO-1",
  tab: { id: tabId },
});
const entry = (issue) => ({ operation: "translate", issue, count: 1, ok: true });

function backgroundHarness(initial = {}) {
  let state = structuredClone(initial);
  let listener;
  let failNextWrite = false;
  const event = { addListener() {} };
  const context = vm.createContext({
    URL,
    console: { error() {}, warn() {} },
    TB_LOGGER: { logError() {} },
    chrome: {
      action: { onClicked: event },
      alarms: { onAlarm: event },
      notifications: { onClicked: event, onButtonClicked: event },
      runtime: {
        id: "test-extension",
        getURL: (resource) => `chrome-extension://test-extension/${resource}`,
        onInstalled: event,
        onStartup: event,
        onMessage: {
          addListener(callback) {
            listener = callback;
          },
        },
      },
      storage: {
        onChanged: event,
        local: {
          async get() {
            const snapshot = structuredClone(state);
            await new Promise((resolve) => setImmediate(resolve));
            return snapshot;
          },
          async set(items) {
            if (failNextWrite) {
              failNextWrite = false;
              throw new Error("Storage unavailable");
            }
            await new Promise((resolve) => setImmediate(resolve));
            Object.assign(state, structuredClone(items));
          },
          async remove(key) {
            delete state[key];
          },
        },
      },
    },
  });
  // Load the real router and the modules exercised by these requests.
  context.importScripts = (...files) => {
    for (const file of files) {
      if (/\/(message-validation|sync-activity|helpers)\.js$/.test(file)) {
        vm.runInContext(fs.readFileSync(path.join(src, file), "utf8"), context);
      }
    }
  };
  vm.runInContext(fs.readFileSync(path.join(src, "background.js"), "utf8"), context);
  return {
    context,
    dispatch: (message, from = sender()) =>
      new Promise((resolve) => listener(message, from, resolve)),
    state: () => state,
    failNextWrite: () => {
      failNextWrite = true;
    },
  };
}

test("concurrent activity messages from different tabs retain every entry", async () => {
  const harness = backgroundHarness();
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      harness.dispatch(
        { type: "RECORD_SYNC_ACTIVITY", entry: entry(`DEMO-${index}`) },
        sender(index)
      )
    )
  );
  assert.ok(results.every((result) => result.ok));
  assert.equal(harness.state().syncActivity.length, 30);
  assert.equal(new Set(harness.state().syncActivity.map((item) => item.issue)).size, 30);
});

test("clearing activity is ordered between pending writes", async () => {
  const harness = backgroundHarness();
  const results = await Promise.all([
    harness.dispatch({ type: "RECORD_SYNC_ACTIVITY", entry: entry("BEFORE") }),
    harness.dispatch(
      { type: "CLEAR_SYNC_ACTIVITY" },
      {
        id: "test-extension",
        url: "chrome-extension://test-extension/src/options.html",
      }
    ),
    harness.dispatch({ type: "RECORD_SYNC_ACTIVITY", entry: entry("AFTER") }),
  ]);
  assert.ok(results.every((result) => result.ok));
  assert.deepEqual(
    harness.state().syncActivity.map((item) => item.issue),
    ["AFTER"]
  );
});

test("a failed activity write does not poison the queue", async () => {
  const harness = backgroundHarness();
  harness.failNextWrite();
  const [failed, recovered] = await Promise.all([
    harness.dispatch({ type: "RECORD_SYNC_ACTIVITY", entry: entry("FAILED") }),
    harness.dispatch({ type: "RECORD_SYNC_ACTIVITY", entry: entry("RECOVERED") }),
  ]);
  assert.equal(failed.ok, false);
  assert.equal(recovered.ok, true);
  assert.deepEqual(
    harness.state().syncActivity.map((item) => item.issue),
    ["RECOVERED"]
  );
});

test("activity keeps 50 entries and redacts credentials in details and URLs", async () => {
  const harness = backgroundHarness({
    syncActivity: Array.from({ length: 50 }, (_, index) => entry(`OLD-${index}`)),
  });
  await harness.dispatch({
    type: "RECORD_SYNC_ACTIVITY",
    entry: {
      ...entry("NEW"),
      ok: false,
      partial: true,
      detail: "Request ?apiKey=demo-secret failed: Bearer demo-token",
      url: "https://demo.backlog.com/view/DEMO-1?token=demo-secret",
    },
  });
  const activity = harness.state().syncActivity;
  assert.equal(activity.length, 50);
  assert.equal(activity[0].partial, true);
  assert.equal(activity[0].count, 1);
  assert.ok(!JSON.stringify(activity[0]).includes("demo-secret"));
  assert.ok(!JSON.stringify(activity[0]).includes("demo-token"));
  assert.ok(Number.isFinite(Date.parse(activity[0].timestamp)));
});

test("activity router rejects malformed messages, foreign senders, and content-script clearing", async () => {
  const harness = backgroundHarness();
  for (const invalid of [
    undefined,
    { ...entry("X"), count: -1 },
    { ...entry("X"), ok: "true" },
    { ...entry("X"), partial: "true" },
    { ...entry("X"), url: "javascript:alert(1)" },
    { ...entry("X"), detail: {} },
  ]) {
    assert.equal(
      (await harness.dispatch({ type: "RECORD_SYNC_ACTIVITY", entry: invalid })).ok,
      false
    );
  }
  assert.equal(
    (
      await harness.dispatch(
        { type: "RECORD_SYNC_ACTIVITY", entry: entry("X") },
        { ...sender(), id: "foreign" }
      )
    ).ok,
    false
  );
  assert.equal((await harness.dispatch({ type: "CLEAR_SYNC_ACTIVITY" })).ok, false);
  assert.equal(harness.state().syncActivity, undefined);
});

test("activity client tolerates rejected and disconnected background messages", async () => {
  const harness = backgroundHarness();
  harness.context.chrome.runtime.sendMessage = async () => ({
    ok: false,
    error: "Storage unavailable",
  });
  assert.equal(await harness.context.recordSyncActivity(entry("X")), false);
  harness.context.chrome.runtime.sendMessage = async () => {
    throw new Error("Disconnected");
  };
  assert.equal(await harness.context.recordSyncActivity(entry("X")), false);
});

test("router responds to synchronous authorization errors", async () => {
  const harness = backgroundHarness();
  const result = await harness.dispatch({
    type: "TEST_MODEL_WITH_KEY",
    provider: "gemini",
    modelId: "test-model",
    apiKey: "test-key",
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /options page/);
});

test("recovery and mapping operations reject content-script callers", async () => {
  const harness = backgroundHarness();
  for (const type of [
    "RESUME_COMMENT_SYNC",
    "RESOLVE_COMMENT_SYNC",
    "LIST_SYNC_RECOVERY",
    "RESUME_MIGRATION",
    "RESOLVE_MIGRATION",
    "SAVE_ISSUE_MAPPING",
    "REMOVE_ISSUE_MAPPING",
  ]) {
    const result = await harness.dispatch({
      type,
      issueKey: "DEMO-1",
      action: "adopt",
      redmineIssueId: "42",
      recordId: "a".repeat(64),
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /options page/);
  }
});

test("Backlog sender validation isolates the configured workspace and frame", () => {
  const harness = backgroundHarness();
  const validate = harness.context.assertTrustedBacklogSender;
  assert.doesNotThrow(() =>
    validate({ url: "https://demo.backlog.com/view/DEMO-1" }, "https://demo.backlog.com")
  );
  assert.throws(() =>
    validate({ url: "https://other.backlog.com/view/DEMO-1" }, "https://demo.backlog.com")
  );
  assert.throws(() =>
    validate(
      {
        url: "https://other.backlog.com/frame",
        tab: { url: "https://demo.backlog.com/view/DEMO-1" },
      },
      "https://demo.backlog.com"
    )
  );
  assert.throws(() =>
    validate({ url: "http://demo.backlog.com/view/DEMO-1" }, "https://demo.backlog.com")
  );
});
