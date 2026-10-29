const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function setup() {
  const store = {};
  const context = vm.createContext({
    chrome: {
      storage: {
        local: {
          get: async (key) => {
            if (typeof key === "string") return { [key]: store[key] };
            return { ...store };
          },
          set: async (items) => {
            Object.assign(store, items);
          },
          remove: async (key) => {
            if (Array.isArray(key)) key.forEach((k) => delete store[k]);
            else delete store[key];
          },
        },
      },
    },
    console: { warn() {}, error() {}, log() {} },
  });

  vm.runInContext(fs.readFileSync("src/modules/services/retry-queue.js", "utf8"), context);

  return { queue: context.TB_RETRY_QUEUE, store };
}

test("retry queue stores, retrieves, and lists queued items", async () => {
  const { queue } = setup();

  const item = await queue.enqueue({
    type: "SEND_TO_REDMINE",
    payload: { issueKey: "PROJ-1", notes: "Test notes" },
    label: "PROJ-1 → Redmine",
    error: "Failed to fetch",
  });

  assert.ok(item.id.startsWith("rq_"));
  assert.equal(item.status, "pending");
  assert.equal(item.retryCount, 0);

  const list = await queue.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "PROJ-1 → Redmine");

  const retrieved = await queue.get(item.id);
  assert.equal(retrieved.id, item.id);
  assert.equal(retrieved.payload.issueKey, "PROJ-1");
});

test("retry queue deduplicates identical pending operations", async () => {
  const { queue } = setup();

  const payload = { issueKey: "PROJ-10", notes: "Sync message" };
  await queue.enqueue({
    type: "SEND_TO_REDMINE",
    payload,
    label: "First attempt",
    error: "Connection timeout",
  });

  await queue.enqueue({
    type: "SEND_TO_REDMINE",
    payload,
    label: "Second attempt",
    error: "Offline",
  });

  const list = await queue.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].error, "Offline");
});

test("retry queue marks status, updates retry count, removes and clears", async () => {
  const { queue } = setup();

  const item1 = await queue.enqueue({
    type: "SEND_TO_REDMINE",
    payload: { id: 1 },
    label: "Task 1",
  });
  const item2 = await queue.enqueue({
    type: "SEND_TO_BACKLOG",
    payload: { id: 2 },
    label: "Task 2",
  });

  assert.equal(await queue.count(), 2);

  await queue.markStatus(item1.id, "retrying");
  let current = await queue.get(item1.id);
  assert.equal(current.status, "retrying");
  assert.equal(current.retryCount, 1);

  await queue.markStatus(item1.id, "failed", "Server 500 error");
  current = await queue.get(item1.id);
  assert.equal(current.status, "failed");
  assert.equal(current.retryCount, 2);
  assert.equal(current.error, "Server 500 error");

  await queue.remove(item1.id);
  assert.equal(await queue.count(), 1);
  assert.equal((await queue.list())[0].id, item2.id);

  await queue.clear();
  assert.equal(await queue.count(), 0);
});

test("retry queue limits capacity to 50 items", async () => {
  const { queue } = setup();

  for (let i = 0; i < 55; i++) {
    await queue.enqueue({
      type: "SEND_TO_REDMINE",
      payload: { index: i },
      label: `Task ${i}`,
    });
  }

  const list = await queue.list();
  assert.equal(list.length, 50);
  assert.equal(list[0].label, "Task 54"); // newest
});
