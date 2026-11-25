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
  const context = vm.createContext({
    Date,
    Set,
    Map,
    Promise,
    String,
    Number,
    JSON,
    ...overrides,
    globalThis: { TB_GET_MESSAGE: () => "stale" },
  });
  vm.runInContext(source, context);
  return context;
}

test("filterDatesWithoutSpentTime ignores entry comments", () => {
  const context = load();
  const dates = ["2024-02-01", "2024-02-02", "2024-02-03"];
  const entries = [
    { spent_on: "2024-02-01", hours: 1, comments: "Manual work" },
    { spent_on: "2024-02-03", hours: 8, comments: "User note" },
  ];

  assert.deepEqual(Array.from(context.filterDatesWithoutSpentTime(dates, entries)), ["2024-02-02"]);
});

test("filterDatesWithoutSpentTime preserves candidate order", () => {
  const context = load();
  const dates = ["2024-02-04", "2024-02-02", "2024-02-03"];

  assert.deepEqual(
    Array.from(context.filterDatesWithoutSpentTime(dates, [{ spent_on: "2024-02-02", hours: 1 }])),
    ["2024-02-04", "2024-02-03"]
  );
});

test("filterMonthlyScanDates keeps every candidate when the option is disabled", () => {
  const context = load();
  const dates = ["2024-02-01", "2024-02-02"];

  assert.deepEqual(
    Array.from(context.filterMonthlyScanDates(dates, [{ spent_on: "2024-02-01" }], false)),
    dates
  );
});

test("filterMonthlyScanDates removes logged dates from report and fallback candidates when enabled", () => {
  const context = load();
  const entries = [
    { spent_on: "2024-02-01", hours: 1, comments: "Manual work" },
    { spent_on: "2024-02-03", hours: 8, comments: "User note" },
  ];

  const reportDates = context.filterMonthlyScanDates(["2024-02-01", "2024-02-02"], entries, true);
  const fallbackDates = context.filterMonthlyScanDates(["2024-02-03", "2024-02-04"], entries, true);

  assert.deepEqual(Array.from(reportDates), ["2024-02-02"]);
  assert.deepEqual(Array.from(fallbackDates), ["2024-02-04"]);
});

test("only positive spent hours exclude a date, including partial and full days", () => {
  const context = load();
  const dates = ["2024-02-01", "2024-02-02", "2024-02-03"];
  const entries = [
    { spent_on: dates[0], hours: 0 },
    { spent_on: dates[1], hours: 2 },
    { spent_on: dates[2], hours: 8 },
  ];
  assert.deepEqual(Array.from(context.filterDatesWithoutSpentTime(dates, entries)), [dates[0]]);
});

test("getMonthlySpentTimeEntries queries the selected user and complete month", async () => {
  const calls = [];
  const context = load({
    findTimeEntries: async (_domain, _key, params) => {
      calls.push(params);
      return [{ spent_on: "2024-02-14", user: { id: 7 }, hours: 0 }];
    },
  });

  await context.getMonthlySpentTimeEntries("https://redmine.test", "", 7, 2024, 2);

  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    user_id: 7,
    from: "2024-02-01",
    to: "2024-02-29",
  });
});

test("getMonthlySpentTimeEntries rejects entries outside the requested user or month", async () => {
  for (const entry of [
    { spent_on: "2024-02-14", user: { id: 8 }, hours: 2 },
    { spent_on: "2024-03-01", user: { id: 7 }, hours: 2 },
  ]) {
    const context = load({ findTimeEntries: async () => [entry] });
    await assert.rejects(
      context.getMonthlySpentTimeEntries("https://redmine.test", "", 7, 2024, 2),
      /outside|invalid|verify/i
    );
  }
});

test("getMonthlySpentTimeEntries propagates read failures", async () => {
  const context = load({
    findTimeEntries: async () => {
      throw new Error("Redmine read failed");
    },
  });

  await assert.rejects(
    context.getMonthlySpentTimeEntries("https://redmine.test", "", 7, 2024, 2),
    /Redmine read failed/
  );
});
