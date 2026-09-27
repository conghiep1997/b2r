const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground() {
  let listener;
  const event = { addListener() {} };
  const calls = [];
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
    importScripts() {},
    TB_LOGGER: { logError: async () => {} },
    chrome: {
      runtime: {
        id: "demo-extension",
        getURL: (file) => `chrome-extension://demo-extension/${file}`,
        onMessage: { addListener: (handler) => (listener = handler) },
        onInstalled: event,
        onStartup: event,
      },
      action: { onClicked: event },
      alarms: { onAlarm: event },
      notifications: { onClicked: event, onButtonClicked: event },
      storage: { onChanged: event },
    },
    getBacklogUsers: async (key) => {
      calls.push(key);
      return [{ id: 1, userId: "demo" }];
    },
    getBacklogIssueInfo: async (key) => ({ key, summary: "Demo" }),
    fetch: async (url) => {
      calls.push(url);
      throw new Error("Unexpected network request");
    },
  });
  for (const file of [
    "modules/utils/message-validation.js",
    "modules/utils/settings-view.js",
    "modules/utils/helpers.js",
    "background.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"), context);
  }
  vm.runInContext(
    `getSettings = async () => ({
      redmineDomain: "https://redmine.example.test", redmineApiKey: "demo-redmine-key",
      backlogDomain: "https://space.backlog.com", backlogApiKey: "demo-backlog-key"
    });`,
    context
  );
  const send = (message, url) =>
    new Promise((resolve, reject) => {
      try {
        listener(message, { id: "demo-extension", url, tab: { url } }, resolve);
      } catch (error) {
        reject(error);
      }
    });
  return { context, send, calls };
}

test("synchronous handler failures return an error response", async () => {
  const { send } = loadBackground();
  const result = await send(
    { type: "TEST_MODEL_WITH_KEY", provider: "gemini", modelId: "demo", apiKey: "demo" },
    "https://space.backlog.com/view/DEMO-1"
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /options page/);
});

test("reverse-sync can load Backlog users and issue details only from trusted pages", async () => {
  const { send, calls } = loadBackground();
  for (const message of [
    { type: "GET_BACKLOG_USERS", projectKey: "DEMO-1" },
    { type: "GET_BACKLOG_ISSUE_INFO", issueKey: "DEMO-1" },
  ]) {
    assert.equal((await send(message, "https://redmine.example.test/issues/1")).ok, true);
    assert.equal((await send(message, "https://untrusted.example.test/issues/1")).ok, false);
    assert.equal((await send(message, "https://other.backlog.com/view/DEMO-1")).ok, false);
  }
  assert.deepEqual(calls, ["DEMO-1"]);
});

test("Redmine proxy rejects an allowlisted API path on another origin before fetching", async () => {
  const { send, calls } = loadBackground();
  const result = await send(
    { type: "REDMINE_AUTHORIZED_FETCH", path: "https://other.example.test/issues.json" },
    "https://redmine.example.test/issues/1"
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /configured origin/);
  assert.deepEqual(calls, []);
});

test("Redmine proxy rejects unapproved time-entry PUT before a network request", async () => {
  const { send, calls } = loadBackground();
  const result = await send(
    {
      type: "REDMINE_AUTHORIZED_FETCH",
      path: "/time_entries/15.json",
      method: "PUT",
      body: JSON.stringify({ time_entry: { issue_id: 90, hours: 2 } }),
    },
    "https://redmine.example.test/issues/50"
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /approved plan/);
  assert.deepEqual(calls, []);
});
