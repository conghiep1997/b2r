const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "settings-view.js"),
  "utf8"
);
const context = vm.createContext({ URL });
vm.runInContext(source, context);

const settings = {
  ai: { provider: "gemini" },
  backlogApiKey: "backlog-secret",
  defaultProjectId: "12",
  manualFields: "{}",
  redmineApiKey: "redmine-secret",
  redmineDomain: "https://redmine.example.com",
  reportProjectId: "34",
  showRedmineSuccessModal: true,
};

test("UI settings exclude credentials", () => {
  assert.deepEqual(
    { ...context.TB_SETTINGS_VIEW.forUi(settings) },
    {
      defaultProjectId: "12",
      manualFields: "{}",
      showRedmineSuccessModal: true,
      syncRules: undefined,
      customFields: undefined,
    }
  );
});

test("report settings expose Redmine fields without API key", () => {
  assert.deepEqual(
    {
      ...context.TB_SETTINGS_VIEW.forReport(settings),
      reportProjects: Array.from(
        context.TB_SETTINGS_VIEW.forReport(settings).reportProjects,
        (project) => ({ ...project })
      ),
    },
    {
      hasRedmineApiKey: true,
      redmineDomain: "https://redmine.example.com",
      reportProjectId: "34",
      logTimeRules: undefined,
      reportProjects: [{ id: "34", name: "#34", globalProfile: true }],
    }
  );
});
test("report projects include scoped profiles without exposing overrides", () => {
  const result = context.TB_SETTINGS_VIEW.forReport({
    ...settings,
    backlogDomain: "https://backlog.example",
    reportProjectId: "",
    projectProfiles: [
      {
        name: "Alpha",
        backlogOrigin: "https://backlog.example",
        redmineOrigin: settings.redmineDomain,
        redmineProjectId: "12",
        reportProjectId: "100",
        overrides: { apiKey: "never expose" },
      },
      {
        name: "Other",
        backlogOrigin: "https://other.example",
        redmineOrigin: settings.redmineDomain,
        redmineProjectId: "13",
      },
    ],
  });
  assert.equal(
    JSON.stringify(result.reportProjects),
    JSON.stringify([{ id: "100", name: "Alpha (#100)" }])
  );
});
test("origin checks accept only the configured Redmine origin", () => {
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin(
      "https://redmine.example.com/issues/1",
      "https://redmine.example.com"
    ),
    true
  );
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin(
      "https://attacker.example.com",
      "https://redmine.example.com"
    ),
    false
  );
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin("not-a-url", "https://redmine.example.com"),
    false
  );
});
