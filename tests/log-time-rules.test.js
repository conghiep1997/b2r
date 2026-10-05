const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function setup() {
  const writes = [];
  let rules = {
    dailyHours: 7.5,
    allocation: "equal",
    activityMode: "default",
    defaultActivityId: "42",
  };
  const context = vm.createContext({
    console: { error() {}, log() {} },
    TB_GET_MESSAGE: (key) => key,
    getSettings: async () => ({
      redmineDomain: "https://redmine.example",
      hasRedmineApiKey: true,
      logTimeRules: rules,
    }),
    getCurrentUser: async () => ({ id: 1, login: "user" }),
    getIssueDetails: async (_domain, _key, id) =>
      id === "99"
        ? { description: "fixture", subject: "Report" }
        : { id, subject: "Coding", estimated_hours: id === "1" ? 1 : 3 },
    getTimeEntryActivities: async () => [{ id: 42, name: "Development" }],
    findTimeEntries: async () => [],
    logTimeEntry: async (...args) => writes.push(args),
  });
  vm.runInContext(fs.readFileSync("src/modules/utils/sync-rules.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/modules/services/report-log-time.js", "utf8"), context);
  context.extractTaskIdsForUser = () => ["1", "2"];
  return {
    context,
    writes,
    setRules: (value) => {
      rules = { ...rules, ...value };
    },
  };
}

test("log allocation conserves quarter-hours, applies estimates and refuses zero-hour tasks", () => {
  const { context } = setup();
  const rules = context.TB_LOG_TIME_RULES;
  assert.deepEqual([...rules.allocate(8, [1, 3])], [2, 6]);
  assert.deepEqual([...rules.allocate(7.5, [1, 1])], [3.75, 3.75]);
  const skewed = [...rules.allocate(1, [100, 1, 1])];
  assert.equal(
    skewed.reduce((a, b) => a + b, 0),
    1
  );
  assert.ok(skewed.every((hours) => hours >= 0.25));
  assert.throws(() => rules.allocate(0.25, [1, 1]), /Not enough hours/);
  for (const dailyHours of [0, 25, 7.3, NaN])
    assert.throws(() => rules.normalize({ dailyHours }), /Daily hours/);
});

test("report preview and writes use configured hours and API-backed activities", async () => {
  const { context, writes } = setup();
  const preview = await context.logTimeFromReport("99", true, "2026-10-02", true);
  assert.equal(writes.length, 0);
  assert.equal(preview.totalHours, 7.5);
  assert.equal(preview.tasks[0].activityId, 42);
  await context.logTimeFromReport("99", true, "2026-10-02", false, preview);
  assert.equal(writes.length, 2);
  assert.equal(
    writes.reduce((sum, entry) => sum + entry[3], 0),
    7.5
  );
  assert.ok(writes.every((entry) => entry[6] === 42));
});

test("changed hours, estimates or activities invalidate the approved preview before writes", async () => {
  for (const update of [
    { dailyHours: 8 },
    { allocation: "estimate" },
    { defaultActivityId: "9" },
  ]) {
    const { context, writes, setRules } = setup();
    const preview = await context.logTimeFromReport("99", true, "2026-10-02", true);
    setRules(update);
    await assert.rejects(context.logTimeFromReport("99", true, "2026-10-02", false, preview));
    assert.equal(writes.length, 0);
  }
});

test("legacy activity lookup never falls back to project-specific IDs", () => {
  const { context } = setup();
  assert.throws(
    () =>
      context.resolveTimeEntryActivityId({ subject: "Coding" }, {}, [{ id: 10, name: "Other" }]),
    /Configure activities/
  );
  assert.equal(
    context.resolveTimeEntryActivityId({ subject: "Coding" }, {}, [{ id: 55, name: "03_Coding" }]),
    55
  );
  assert.throws(
    () =>
      context.resolveTimeEntryActivityId(
        {},
        {},
        [{ id: 42, name: "Inactive", active: false }],
        context.TB_LOG_TIME_RULES.normalize({ activityMode: "default", defaultActivityId: "42" })
      ),
    /unavailable/
  );
});
