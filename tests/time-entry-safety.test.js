const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "redmine.js"),
  "utf8"
);

function setup({ changed = false, backupFails = false } = {}) {
  const calls = [];
  const original = {
    id: 15,
    user: { id: 7 },
    issue: { id: 90 },
    spent_on: "2026-09-28",
    hours: 3,
    comments: "[B2R report:50]",
    activity: { id: 10 },
    updated_on: "2026-09-28T08:00:00Z",
  };
  const context = vm.createContext({
    URL,
    chrome: {
      storage: {
        local: {
          set: async (record) => {
            calls.push(["backup", record]);
            if (backupFails) throw new Error("Storage full");
          },
        },
      },
    },
  });
  vm.runInContext(source, context);
  context.getCurrentUser = async () => ({ id: 7 });
  context.redmineAuthorizedFetch = async (_domain, _key, endpoint, options = {}) => {
    const method = options.method || "GET";
    calls.push([method, endpoint]);
    if (method === "GET")
      return {
        ok: true,
        json: async () => ({
          time_entry: changed ? { ...original, hours: 4 } : original,
        }),
      };
    return { ok: true };
  };
  const approval = {
    entry: original,
    reportId: "50",
    date: "2026-09-28",
    domain: "https://redmine.example.test",
    confirmedAt: Date.now(),
    allowLegacy: false,
    targetIssueId: "90",
  };
  return { context, calls, approval };
}

test("PUT refuses a time entry changed since preview", async () => {
  const { context, calls, approval } = setup({ changed: true });
  await assert.rejects(
    context.updateTimeEntry(
      approval.domain,
      "key",
      15,
      "90",
      2,
      "[B2R report:50]",
      approval.date,
      10,
      approval
    ),
    /changed/
  );
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET"]
  );
});

test("PUT and DELETE stop if the recovery copy cannot be saved", async () => {
  for (const action of ["update", "delete"]) {
    const { context, calls, approval } = setup({ backupFails: true });
    const task =
      action === "update"
        ? context.updateTimeEntry(
            approval.domain,
            "key",
            15,
            "90",
            2,
            "[B2R report:50]",
            approval.date,
            10,
            approval
          )
        : context.deleteTimeEntry(approval.domain, "key", 15, approval);
    await assert.rejects(task, /Storage full/);
    assert.deepEqual(
      calls.map(([method]) => method),
      ["GET", "backup"]
    );
  }
});

test("verified PUT saves its recovery copy before sending the change", async () => {
  const { context, calls, approval } = setup();
  await context.updateTimeEntry(
    approval.domain,
    "key",
    15,
    "90",
    2,
    "[B2R report:50]",
    approval.date,
    10,
    approval
  );
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET", "backup", "PUT"]
  );
  assert.equal(calls[1][1][`b2r_time_backup:${approval.domain}:15`].entry.hours, 3);
});
