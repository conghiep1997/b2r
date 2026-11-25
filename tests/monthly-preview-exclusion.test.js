const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "report-log-time.js"),
  "utf8"
);
const context = vm.createContext({ Date, Set, Map, Promise, String, Number, JSON, globalThis: {} });
vm.runInContext(source, context);

test("monthly preview exclusion preserves order and preview identity", () => {
  const first = { date: "2024-02-01" };
  const removed = { date: "2024-02-02" };
  const last = { date: "2024-02-03" };
  const previews = [first, removed, last];

  const result = context.filterMonthlyPreviewsByExcludedDates(previews, new Set([removed.date]));

  assert.equal(result.length, 2);
  assert.equal(result[0], first);
  assert.equal(result[1], last);
});

test("monthly preview exclusion retains every preview for an empty exclusion set", () => {
  const previews = [{ date: "2024-02-01" }, { date: "2024-02-02" }];
  assert.deepEqual(
    Array.from(context.filterMonthlyPreviewsByExcludedDates(previews, new Set())),
    previews
  );
});

test("monthly preview exclusion can remove every date", () => {
  const previews = [{ date: "2024-02-01" }, { date: "2024-02-02" }];
  assert.deepEqual(
    Array.from(
      context.filterMonthlyPreviewsByExcludedDates(
        previews,
        new Set(previews.map((preview) => preview.date))
      )
    ),
    []
  );
});

test("monthly copy rows exclude dates without mutating the input map", () => {
  const copyRows = new Map([
    ["2024-02-01", "#1"],
    ["2024-02-02", "#2"],
    ["2024-02-03", "#3"],
  ]);
  const result = context.filterMonthlyCopyRowsByExcludedDates(copyRows, new Set(["2024-02-02"]));

  assert.deepEqual(Array.from(result), [
    ["2024-02-01", "#1"],
    ["2024-02-03", "#3"],
  ]);
  assert.equal(copyRows.size, 3);
});
