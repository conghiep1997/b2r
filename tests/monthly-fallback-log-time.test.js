const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "report-log-time.js"),
  "utf8"
);

function load(overrides = {}) {
  const rules = {
    normalize: () => ({ dailyHours: 8, allocation: "equal" }),
    allocate: (hours, weights) => weights.map(() => hours / weights.length),
  };
  const context = vm.createContext({
    Date,
    URL,
    Set,
    Map,
    Promise,
    String,
    Number,
    JSON,
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
    ...overrides,
    globalThis: { TB_LOG_TIME_RULES: rules, TB_GET_MESSAGE: () => "stale" },
  });
  vm.runInContext(source, context);
  return context;
}

test("missing working dates include every remaining weekday in the selected month", () => {
  const context = load();
  assert.deepEqual(
    Array.from(
      context.getMissingWorkingDates(2026, 11, ["2026-11-02"], new Date("2026-11-04T12:00:00Z"))
    ),
    [
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-30",
    ]
  );
});

test("issue date matching enforces assignee, report tracker exclusion, and date range", () => {
  const context = load();
  const issue = {
    assigned_to: { id: 7 },
    tracker: { id: 2 },
    start_date: "2026-11-01",
    due_date: "2026-11-05",
  };
  assert.equal(context.isIssueMatchingDateForUser(issue, "2026-11-03", 7, 9), true);
  assert.equal(context.isIssueMatchingDateForUser(issue, "2026-11-06", 7, 9), false);
  assert.equal(
    context.isIssueMatchingDateForUser({ ...issue, tracker: { id: 9 } }, "2026-11-03", 7, 9),
    false
  );
});

test("issue date matching supports start-only, due-only, and start through closed dates", () => {
  const context = load();
  const base = { assigned_to: { id: 7 }, tracker: { id: 2 } };
  assert.equal(
    context.isIssueMatchingDateForUser({ ...base, start_date: "2026-11-03" }, "2026-11-03", 7, 9),
    true
  );
  assert.equal(
    context.isIssueMatchingDateForUser({ ...base, due_date: "2026-11-03" }, "2026-11-03", 7, 9),
    true
  );
  assert.equal(
    context.isIssueMatchingDateForUser(
      { ...base, start_date: "2026-11-01", closed_on: "2026-11-04T12:00:00Z" },
      "2026-11-03",
      7,
      9
    ),
    true
  );
});

test("issue date matching handles range boundaries, missing tracker metadata, and wrong assignees", () => {
  const context = load();
  const base = { assigned_to: { id: 7 }, tracker: { id: 2 } };
  const ranged = { ...base, start_date: "2026-11-02", due_date: "2026-11-04" };
  assert.equal(context.isIssueMatchingDateForUser(ranged, "2026-11-02", 7, 9), true);
  assert.equal(context.isIssueMatchingDateForUser(ranged, "2026-11-04", 7, 9), true);
  assert.equal(
    context.isIssueMatchingDateForUser({ ...ranged, assigned_to: { id: 8 } }, "2026-11-03", 7, 9),
    false
  );
  assert.equal(
    context.isIssueMatchingDateForUser({ ...ranged, tracker: undefined }, "2026-11-03", 7),
    true
  );
  assert.equal(
    context.isIssueMatchingDateForUser({ ...ranged, tracker: undefined }, "2026-11-03", 7, 9),
    false
  );
});

test("report candidate date range includes future dates through the selected month end", () => {
  const context = load();
  const today = new Date("2026-11-25T12:00:00Z");
  assert.equal(context.isMonthlyReportDateInScanRange("2026-11-25", 2026, 11, today), true);
  assert.equal(context.isMonthlyReportDateInScanRange("2026-11-26", 2026, 11, today), true);
  assert.equal(context.isMonthlyReportDateInScanRange("2026-10-31", 2026, 11, today), false);
  assert.equal(context.isMonthlyReportDateInScanRange("2026-10-31", 2026, 10, today), true);
  assert.equal(context.isMonthlyReportDateInScanRange("2026-11-31", 2026, 11, today), false);
});

test("fallback resolution prioritizes project issues and queries all projects only for leftovers", async () => {
  const context = load();
  const calls = [];
  context.findAllIssues = async (_domain, _key, params) => {
    calls.push(params);
    return params.project_id
      ? [
          {
            id: 11,
            assigned_to: { id: 7 },
            tracker: { id: 2 },
            start_date: "2026-11-02",
            due_date: "2026-11-02",
          },
        ]
      : [
          {
            id: 22,
            assigned_to: { id: 7 },
            tracker: { id: 2 },
            start_date: "2026-11-03",
            due_date: "2026-11-03",
          },
        ];
  };
  const result = await context.resolveFallbackTasksByDate(
    "https://redmine.test",
    "",
    ["2026-11-02", "2026-11-03"],
    { id: 7 },
    5,
    9
  );
  assert.equal(result.get("2026-11-02").issue.id, 11);
  assert.equal(result.get("2026-11-02").source, "project");
  assert.equal(result.get("2026-11-03").issue.id, 22);
  assert.equal(result.get("2026-11-03").source, "all");
  assert.equal(calls.length, 2);
});

test("monthly plan requires explicit preview selection to manage an existing entry", () => {
  const context = load();
  const preview = {
    date: "2026-11-03",
    userId: "7",
    tasks: [{ id: "42", activityId: 3 }],
    entries: [
      {
        id: 1,
        issue: { id: 42 },
        spent_on: "2026-11-03",
        hours: 8,
        comments: "[B2R auto:2026-11-03]",
        activity: { id: 3 },
      },
    ],
  };
  const planned = context.planReportSync(preview);
  assert.equal(planned.operations.length, 0);
  assert.equal(planned.tasks[0].hours, 0);
  assert.equal(planned.preservedHours, 8);
});

test("monthly plan preserves unmarked hours even when they use the fallback task", () => {
  const context = load();
  const preview = {
    date: "2026-11-03",
    reportIssueId: "auto-2026-11-03",
    userId: "7",
    tasks: [{ id: "42", activityId: 3 }],
    entries: [
      {
        id: 8,
        issue: { id: 42 },
        spent_on: "2026-11-03",
        hours: 4,
        comments: "Manual work",
        activity: { id: 3 },
      },
    ],
  };
  const planned = context.planReportSync(preview);
  assert.equal(planned.preservedHours, 4);
  assert.equal(planned.tasks[0].hours, 4);
  assert.equal(planned.operations.length, 1);
  assert.equal(planned.operations[0].type, "create");
});

test("monthly plan manages only metadata for this report or entries explicitly selected", () => {
  const context = load();
  const preview = {
    date: "2026-11-03",
    reportIssueId: "50",
    userId: "7",
    tasks: [{ id: "42", activityId: 3 }],
    entries: [
      {
        id: 1,
        user: { id: 7 },
        issue: { id: 42 },
        spent_on: "2026-11-03",
        hours: 8,
        b2rOwnership: {
          reportId: "50",
          userId: "7",
          issueId: "42",
          date: "2026-11-03",
          source: "daily-report",
        },
      },
      {
        id: 2,
        user: { id: 7 },
        issue: { id: 42 },
        spent_on: "2026-11-03",
        hours: 1,
        b2rOwnership: {
          reportId: "51",
          userId: "7",
          issueId: "42",
          date: "2026-11-03",
          source: "daily-report",
        },
      },
    ],
  };
  const planned = context.planReportSync(preview);
  assert.equal(planned.operations[0].type, "update");
  assert.equal(planned.operations[0].entryId, 1);
  assert.equal(planned.preservedHours, 1);

  const selectedLegacy = context.planReportSync(preview, ["2"]);
  assert.ok(selectedLegacy.operations.some((operation) => operation.entryId === 2));
});

test("fallback preview builds a user/date snapshot and includes the project name", async () => {
  const context = load();
  context.getSettings = async () => ({ redmineDomain: "https://redmine.test", logTimeRules: {} });
  context.getCurrentUser = async () => ({ id: 7, login: "alice" });
  context.getTimeEntryActivities = async () => [{ id: 3, name: "Development", active: true }];
  context.getIssueDetails = async () => ({
    id: 42,
    subject: "Task",
    project: { name: "Project Alpha" },
  });
  context.findTimeEntries = async () => [];
  context.resolveTimeEntryActivityId = () => 3;
  context.isSafeDailyUserTimeEntry = () => true;
  const preview = await context.logTimeFromFallbackTasks(
    "2026-11-03",
    { id: "42", subject: "Task" },
    "project",
    true,
    { tasks: [{ activityId: 99 }] },
    { redmineDomain: "https://redmine.test", logTimeRules: {} }
  );
  assert.equal(preview.reportIssueId, "auto-2026-11-03");
  assert.equal(preview.tasks[0].projectName, "Project Alpha");
  assert.equal(preview.source, "project");
  assert.equal(preview.userId, "7");
  assert.equal(preview.tasks[0].activityId, 99);
});

test("fallback writes return the same result shape used by monthly confirmation", async () => {
  const calls = [];
  const records = {};
  const settings = { redmineDomain: "https://redmine.test", logTimeRules: {} };
  const context = load({
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: records[key] }),
          set: async (values) => Object.assign(records, values),
        },
      },
    },
    navigator: { locks: { request: async (_name, _options, callback) => callback({}) } },
    getSettings: async () => settings,
    getCurrentUser: async () => ({ id: 7, login: "alice" }),
    getTimeEntryActivities: async () => [{ id: 3, name: "Development", active: true }],
    getIssueDetails: async () => ({ id: 42, subject: "Task", project: { name: "Project Alpha" } }),
    findTimeEntries: async () => [],
    resolveTimeEntryActivityId: () => 3,
    isSafeDailyUserTimeEntry: () => true,
    logTimeEntry: async (...args) => {
      calls.push(args);
      return { id: 123, issue: { id: 42 } };
    },
  });
  const task = { id: "42", subject: "Task", activityId: 3 };
  const preview = await context.logTimeFromFallbackTasks(
    "2026-11-03",
    task,
    "project",
    true,
    { tasks: [{ activityId: 3 }] },
    settings
  );
  const result = await context.logTimeFromFallbackTasks(
    "2026-11-03",
    task,
    "project",
    false,
    { ...preview, confirmedAt: Date.now() },
    settings
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(result.taskIds), ["42"]);
  assert.deepEqual(Array.from(result.loggedTaskIds), ["42"]);
  assert.deepEqual(Array.from(result.skippedTaskIds), []);
  assert.deepEqual(Array.from(result.failedTasks), []);
  assert.deepEqual(
    JSON.parse(JSON.stringify(records.b2r_time_entry_ownership_v1["https://redmine.test:123"])),
    {
      domain: "https://redmine.test",
      userId: "7",
      date: "2026-11-03",
      issueId: "42",
      entryId: "123",
      reportId: "auto-2026-11-03",
      source: "fallback-project",
    }
  );
});

test("monthly POST timeout is reconciled from its saved pre-POST snapshot on retry", async () => {
  const records = {};
  const remoteEntries = [];
  let postCalls = 0;
  const context = load({
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: records[key] }),
          set: async (values) => Object.assign(records, values),
        },
      },
      runtime: { sendMessage: async () => ({ ok: true }) },
    },
    logTimeEntry: async (_domain, _key, issueId, hours, _comments, date, activityId) => {
      postCalls += 1;
      const created = {
        id: 123,
        user: { id: 7 },
        issue: { id: issueId },
        spent_on: date,
        hours,
        activity: { id: activityId },
        comments: "",
      };
      remoteEntries.push(created);
      throw new Error("Request timed out after Redmine accepted the POST.");
    },
  });
  const request = {
    redmineDomain: "https://redmine.test",
    redmineApiKey: "",
    issueId: "42",
    hours: 8,
    date: "2026-11-03",
    activityId: 3,
    currentUser: { id: 7 },
    reportId: "auto-2026-11-03",
    source: "fallback-project",
    confirmedAt: Date.now(),
    entries: [],
  };
  await assert.rejects(context.createApprovedTimeEntry(request), /timed out/);
  const reconciled = await context.readTimeEntryOwnership(
    request.redmineDomain,
    "7",
    request.date,
    request.reportId,
    remoteEntries
  );
  assert.ok(reconciled[0].b2rOwnership);
  const retryPlan = context.planReportSync({
    date: request.date,
    reportIssueId: request.reportId,
    userId: "7",
    tasks: [{ id: "42", activityId: 3 }],
    entries: reconciled,
  });
  assert.equal(retryPlan.operations.length, 0);
  assert.equal(postCalls, 1);
});

test("monthly retry reconciles a created entry when ownership storage failed after POST", async () => {
  const records = {};
  const remoteEntries = [];
  let failOwnershipOnce = true;
  let postCalls = 0;
  const ownershipKey = "b2r_time_entry_ownership_v1";
  const context = load({
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: records[key] }),
          set: async (values) => {
            if (ownershipKey in values && failOwnershipOnce) {
              failOwnershipOnce = false;
              throw new Error("Storage full");
            }
            Object.assign(records, values);
          },
        },
      },
    },
    logTimeEntry: async (_domain, _key, issueId, hours, _comments, date, activityId) => {
      postCalls += 1;
      const created = {
        id: 124,
        user: { id: 7 },
        issue: { id: issueId },
        spent_on: date,
        hours,
        activity: { id: activityId },
        comments: "",
      };
      remoteEntries.push(created);
      return created;
    },
  });
  const request = {
    redmineDomain: "https://redmine.test",
    issueId: "42",
    hours: 8,
    date: "2026-11-03",
    activityId: 3,
    currentUser: { id: 7 },
    reportId: "auto-2026-11-03",
    source: "fallback-project",
    confirmedAt: Date.now(),
    entries: [],
  };
  await assert.rejects(context.createApprovedTimeEntry(request), /Storage full/);
  const reconciled = await context.readTimeEntryOwnership(
    request.redmineDomain,
    "7",
    request.date,
    request.reportId,
    remoteEntries
  );
  assert.ok(reconciled[0].b2rOwnership);
  const retryPlan = context.planReportSync({
    date: request.date,
    reportIssueId: request.reportId,
    userId: "7",
    tasks: [{ id: "42", activityId: 3 }],
    entries: reconciled,
  });
  assert.equal(retryPlan.operations.length, 0);
  assert.equal(postCalls, 1);
});

test("pending POST recovery never adopts a matching legacy entry from its baseline snapshot", async () => {
  const records = {};
  const context = load({
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: records[key] }),
          set: async (values) => Object.assign(records, values),
        },
      },
    },
    logTimeEntry: async () => {
      throw new Error("Request timed out.");
    },
  });
  const legacyEntry = {
    id: 77,
    user: { id: 7 },
    issue: { id: "42" },
    spent_on: "2026-11-03",
    hours: 2,
    activity: { id: 3 },
    comments: "Manual entry",
  };
  await assert.rejects(
    context.createApprovedTimeEntry({
      redmineDomain: "https://redmine.test",
      issueId: "42",
      hours: 2,
      date: "2026-11-03",
      activityId: 3,
      currentUser: { id: 7 },
      reportId: "auto-2026-11-03",
      source: "fallback-project",
      confirmedAt: Date.now(),
      entries: [legacyEntry],
    }),
    /timed out/
  );
  await assert.rejects(
    context.readTimeEntryOwnership("https://redmine.test", "7", "2026-11-03", "auto-2026-11-03", [
      legacyEntry,
    ]),
    /could not be verified/
  );
  assert.equal(records.b2r_time_entry_ownership_v1, undefined);
});
