const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
function harness(fetch) {
  const context = vm.createContext({
    console: { warn() {} },
    URL,
    URLSearchParams,
    timeoutFetch: fetch,
    TB: { MESSAGES: { REDMINE: { LOOKUP_FAILED: "Lookup failed" } } },
  });
  vm.runInContext(fs.readFileSync("src/modules/utils/helpers.js", "utf8"), context);
  context.timeoutFetch = fetch;
  vm.runInContext(fs.readFileSync("src/modules/utils/sync-rules.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/modules/services/redmine.js", "utf8"), context);
  return context;
}
test("literal title rules preserve defaults and support custom formats without recursive substitution", () => {
  const { TB_SYNC_RULES: rules } = harness();
  assert.equal(
    rules.subject({
      issueKey: "HIPE_B2R-1",
      summary: "Original",
      translatedSummary: "Translation",
    }),
    "HIPE_B2R-1 Original (Translation)"
  );
  const custom = rules.normalize({
    subjectTemplate: "[{issueKey}] {summary} | {translatedSummary}",
    titleDelimiter: " | ",
  });
  assert.equal(
    rules.subject(
      { issueKey: "HIPE_B2R-1", summary: "{issueKey}", translatedSummary: "Text" },
      custom
    ),
    "[HIPE_B2R-1] {issueKey} | Text"
  );
  assert.equal(rules.title("Task #123 (New): Original | Translation", custom), "Original");
  assert.deepEqual(Array.from(rules.queries("HIPE_B2R-1", "Original | Translation", custom)), [
    "HIPE_B2R-1",
    "Original",
  ]);
  assert.deepEqual(
    Array.from(rules.queries("HIPE_B2R-1", "Original", rules.normalize({ searchMode: "title" }))),
    ["Original"]
  );
  assert.deepEqual(
    Array.from(rules.queries("HIPE_B2R-1", "Original", rules.normalize({ searchMode: "key" }))),
    ["HIPE_B2R-1"]
  );
});
test("rules validate placeholders, alias shape and bounds", () => {
  const { TB_SYNC_RULES: rules } = harness();
  for (const invalid of [
    { subjectTemplate: "{unknown}" },
    { searchMode: "regex" },
    { titleDelimiter: "\n" },
    { trackerAliases: { Bug: "Task" } },
    { trackerAliases: { Bug: [""] } },
  ])
    assert.throws(() => rules.normalize(invalid));
  const custom = rules.normalize({ trackerAliases: { QA: ["Question"], Bug: [] } });
  const context = harness();
  assert.deepEqual(Array.from(context.getPreferredRedmineTrackerNames("QA", custom)), ["Question"]);
  assert.deepEqual(Array.from(context.getPreferredRedmineTrackerNames("Bug", custom)), []);
});
test("API lookup honors custom delimiter, title-only mode and destination project", async () => {
  const urls = [];
  const context = harness(async (url) => {
    urls.push(new URL(url));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          issues: [
            {
              id: 42,
              subject: "A sufficiently long original | Vietnamese",
              tracker: { name: "Question" },
            },
          ],
        }),
    };
  });
  const rules = context.TB_SYNC_RULES.normalize({
    titleDelimiter: " | ",
    searchMode: "title",
    restrictToProject: true,
  });
  const result = await context.findRedmineIssueViaApi(
    "http://127.0.0.1:3001",
    "fixture-key",
    "HIPE_B2R-1",
    "A sufficiently long original | Different translation",
    [],
    rules,
    "12"
  );
  assert.equal(result.id, "42");
  assert.equal(urls[0].searchParams.get("subject"), "~A sufficiently long original");
  assert.equal(urls[0].searchParams.get("project_id"), "12");
  assert.equal(urls[0].searchParams.get("status_id"), "*");
});
test("issue lookup restricts API results to the selected project", async () => {
  const urls = [];
  const context = harness(async (url) => {
    urls.push(new URL(url));
    return {
      ok: true,
      json: async () => ({ issues: [{ id: 42, subject: "HIPE_B2R-1 Original" }], total_count: 1 }),
      text: async () =>
        JSON.stringify({ issues: [{ id: 42, subject: "HIPE_B2R-1 Original" }], total_count: 1 }),
    };
  });
  const result = await context.findRedmineIssue(
    "http://127.0.0.1:3001",
    "fixture-key",
    "HIPE_B2R-1",
    "Original",
    "",
    { restrictToProject: true },
    "12"
  );
  assert.equal(result.id, "42");
  assert.equal(urls[0].pathname, "/issues.json");
  assert.equal(urls[0].searchParams.get("project_id"), "12");
  await assert.rejects(
    context.findRedmineIssue("http://127.0.0.1:3001", "fixture-key", "HIPE_B2R-1", "Original", "", {
      restrictToProject: true,
    }),
    /Select a default/
  );
});

test("lookup never accepts an unrelated result solely because search returned it", () => {
  const context = harness();
  assert.equal(
    context.pickBestRedmineSearchResult(
      [{ id: 3, subject: "Unrelated", tracker: "" }],
      "hipe_b2r-1",
      "original"
    ),
    null
  );
});
test("Options preserves explicit custom field mappings without injecting instance IDs", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync("src/modules/ui/options-settings.js", "utf8"), context);
  const settings = context.TB_OPTIONS_SETTINGS.create({});
  assert.equal(settings.normalizeManualFields(), "{}");
  assert.deepEqual(JSON.parse(settings.normalizeManualFields('{"Severity":12}')), { Severity: 12 });
  assert.equal(settings.normalizeManualFields("{}"), "{}");
});
