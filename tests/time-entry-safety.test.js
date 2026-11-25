const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "redmine.js"),
  "utf8"
);

function setup({ changed = false, backupFails = false, ownershipRecords = {} } = {}) {
  const calls = [];
  const original = {
    id: 15,
    user: { id: 7 },
    issue: { id: 90 },
    spent_on: "2026-09-28",
    hours: 3,
    comments: "Existing note",
    activity: { id: 10 },
    updated_on: "2026-09-28T08:00:00Z",
  };
  const context = vm.createContext({
    URL,
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: ownershipRecords }),
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
    calls.push([method, endpoint, options]);
    if (method === "GET" && endpoint.startsWith("/issues/"))
      return { ok: true, json: async () => ({ issue: { subject: "2026年9月28日 Report" } }) };
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
    allowLegacy: true,
    source: "legacy-selected",
    targetIssueId: "90",
  };
  return { context, calls, approval };
}

test("PUT refuses a time entry changed since preview", async () => {
  const { context, calls, approval } = setup({ changed: true });
  await assert.rejects(
    context.updateTimeEntry(approval.domain, "key", 15, "90", 2, "", approval.date, 10, approval),
    /changed/
  );
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET", "GET"]
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
            "",
            approval.date,
            10,
            approval
          )
        : context.deleteTimeEntry(approval.domain, "key", 15, approval);
    await assert.rejects(task, /Storage full/);
    assert.deepEqual(
      calls.map(([method]) => method),
      ["GET", "GET", "backup"]
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
    "",
    approval.date,
    10,
    approval
  );
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET", "GET", "backup", "PUT"]
  );
  assert.equal(calls[2][1][`b2r_time_backup:${approval.domain}:15`].entry.hours, 3);
  assert.equal("comments" in JSON.parse(calls[3][2].body).time_entry, false);
});

test("entry mutations use the approved snapshot without adding comments", async () => {
  const { context, approval } = setup();
  approval.reportId = "auto-2026-09-28";
  approval.entry.comments = "Existing note";
  await context.updateTimeEntry(
    approval.domain,
    "key",
    15,
    "90",
    2,
    "",
    approval.date,
    10,
    approval
  );
  await assert.rejects(
    context.updateTimeEntry(approval.domain, "key", 15, "90", 2, "", approval.date, 10, {
      ...approval,
      date: "2026-09-29",
    })
  );
});

test("DELETE accepts only the unchanged preview snapshot, regardless of its comment text", async () => {
  const { context, calls, approval } = setup();
  approval.entry.comments = "User's own note";
  await context.deleteTimeEntry(approval.domain, "key", 15, approval);
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET", "GET", "backup", "DELETE"]
  );
});

test("report approval IDs allow only numeric or matching auto-date values", () => {
  const { context, approval } = setup();
  assert.equal(context.isAllowedReportIdForDate("50", approval.date), true);
  assert.equal(context.isAllowedReportIdForDate(`auto-${approval.date}`, approval.date), true);
  assert.equal(context.isAllowedReportIdForDate("auto-2026-09-29", approval.date), false);
  assert.equal(context.isAllowedReportIdForDate("auto-2026-02-31", "2026-02-31"), false);
  assert.equal(context.isAllowedReportIdForDate("report-50", approval.date), false);
  assert.equal(context.isAllowedTimeEntrySource("50", "daily-report"), true);
  assert.equal(context.isAllowedTimeEntrySource("50", "fallback-all"), false);
  assert.equal(context.isAllowedTimeEntrySource(`auto-${approval.date}`, "fallback-project"), true);
});

test("DELETE accepts B2R metadata only when domain, user, date, issue, report and source match", async () => {
  const { context, calls, approval } = setup({
    ownershipRecords: {
      "https://redmine.example.test:15": {
        domain: "https://redmine.example.test",
        userId: "7",
        date: "2026-09-28",
        issueId: "90",
        entryId: "15",
        reportId: "auto-2026-09-28",
        source: "fallback-project",
      },
    },
  });
  approval.reportId = "auto-2026-09-28";
  approval.source = "fallback-project";
  approval.allowLegacy = false;
  await context.deleteTimeEntry(approval.domain, "key", 15, approval);
  assert.deepEqual(
    calls.map(([method]) => method),
    ["GET", "backup", "DELETE"]
  );
});

test("DELETE rejects metadata belonging to a different report without legacy selection", async () => {
  const { context, calls, approval } = setup({
    ownershipRecords: {
      "https://redmine.example.test:15": {
        domain: "https://redmine.example.test",
        userId: "7",
        date: "2026-09-28",
        issueId: "90",
        entryId: "15",
        reportId: "auto-2026-09-29",
        source: "fallback-project",
      },
    },
  });
  approval.reportId = "auto-2026-09-28";
  approval.source = "fallback-project";
  approval.allowLegacy = false;
  await assert.rejects(context.deleteTimeEntry(approval.domain, "key", 15, approval), /blocked/);
  assert.equal(calls.length, 0);
});

test("entry mutation approvals expire after five minutes", async () => {
  const { context, calls, approval } = setup();
  approval.confirmedAt = Date.now() - 300001;
  await assert.rejects(context.deleteTimeEntry(approval.domain, "key", 15, approval), /blocked/);
  assert.equal(calls.length, 0);
});

test("new time entries omit the comments field when logging without a comment", async () => {
  const { context } = setup();
  let request;
  context.redmineAuthorizedFetch = async (_domain, _key, _endpoint, options) => {
    request = options;
    return { ok: true, json: async () => ({ time_entry: { id: 20 } }) };
  };
  await context.logTimeEntry("https://redmine.example.test", "key", 90, 2, "", "2026-09-28", 10);
  assert.equal("comments" in JSON.parse(request.body).time_entry, false);
});
