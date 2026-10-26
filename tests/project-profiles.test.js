const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function setup() {
  const context = vm.createContext({ URL });
  for (const file of [
    "utils/sync-rules.js",
    "constants/prompts.js",
    "utils/custom-fields.js",
    "utils/project-profiles.js",
  ])
    vm.runInContext(fs.readFileSync(`src/modules/${file}`, "utf8"), context);
  const settings = {
    backlogDomain: "https://demo.backlog.com",
    redmineDomain: "https://redmine.example",
    defaultProjectId: "1",
    syncRules: context.TB_SYNC_RULES.normalize(),
    translationRules: context.TB_PROMPTS.TRANSLATION.normalize(),
    logTimeRules: context.TB_LOG_TIME_RULES.normalize(),
  };
  return { profiles: context.TB_PROJECT_PROFILES, settings };
}

test("profiles independently resolve project, title, translation, fields and log-time policies", () => {
  const { profiles, settings } = setup();
  settings.projectProfiles = profiles.normalize(
    [
      {
        backlogProjectKey: "ALPHA",
        redmineProjectId: "42",
        overrides: {
          syncRules: { subjectTemplate: "[{issueKey}] {summary}" },
          translationRules: { target: "en" },
          manualFields: { Category: 7 },
          logTimeRules: { dailyHours: 7.5 },
        },
      },
      {
        backlogProjectKey: "BETA",
        redmineProjectId: "55",
        overrides: { translationRules: { target: "fr" } },
      },
    ],
    settings
  );
  const alpha = profiles.forBacklog(settings, "ALPHA-1");
  assert.equal(alpha.defaultProjectId, "42");
  assert.equal(alpha.translationRules.target, "en");
  assert.equal(alpha.syncRules.subjectTemplate, "[{issueKey}] {summary}");
  assert.equal(alpha.syncRules.restrictToProject, true);
  assert.equal(alpha.logTimeRules.dailyHours, 7.5);
  assert.equal(alpha.manualFields, '{"Category":7}');
  assert.equal(alpha.customFields[0].id, 7);
  assert.equal(profiles.forBacklog(settings, "BETA-2").translationRules.target, "fr");
  assert.equal(profiles.forBacklog(settings, "OTHER-3"), settings);
  assert.equal(settings.defaultProjectId, "1");
  assert.equal(profiles.forRedmine(settings, "42").logTimeRules.dailyHours, 7.5);
});

test("profile validation rejects duplicate destinations for one source and credential overrides", () => {
  const { profiles, settings } = setup();
  const row = { backlogProjectKey: "ALPHA", redmineProjectId: "42" };
  assert.throws(
    () => profiles.normalize([row, { ...row, redmineProjectId: "55" }], settings),
    /one active profile/
  );
  assert.throws(
    () => profiles.normalize([{ ...row, overrides: { redmineApiKey: "secret" } }], settings),
    /Unsupported/
  );
  assert.throws(
    () => profiles.normalize([{ ...row, overrides: { manualFields: { Severity: 0 } } }], settings),
    /positive IDs/
  );
  assert.throws(
    () => profiles.normalize([{ ...row, redmineProjectId: "NaN" }], settings),
    /numeric/
  );
});

test("report policies can belong to a separate report project without affecting reverse sync", () => {
  const { profiles, settings } = setup();
  settings.projectProfiles = profiles.normalize(
    [
      {
        backlogProjectKey: "ALPHA",
        redmineProjectId: "42",
        reportProjectId: "100",
        overrides: { logTimeRules: { dailyHours: 7.5 } },
      },
    ],
    settings
  );
  assert.equal(profiles.forRedmine(settings, "100", "report").logTimeRules.dailyHours, 7.5);
  assert.equal(profiles.forRedmine(settings, "42", "report"), settings);
  assert.equal(profiles.forRedmine(settings, "42").defaultProjectId, "42");
  assert.throws(
    () =>
      profiles.normalize(
        [{ backlogProjectKey: "ALPHA", redmineProjectId: "42", reportProjectId: "invalid" }],
        settings
      ),
    /report project ID/
  );
});

test("profiles remain isolated across both origins and ambiguous reverse policies are blocked", () => {
  const { profiles, settings } = setup();
  settings.projectProfiles = profiles.normalize(
    [
      {
        backlogProjectKey: "ALPHA",
        redmineProjectId: "42",
        overrides: { translationRules: { reverseTarget: "en" } },
      },
      {
        backlogProjectKey: "BETA",
        redmineProjectId: "42",
        overrides: { translationRules: { reverseTarget: "ja" } },
      },
    ],
    settings
  );
  assert.throws(() => profiles.forRedmine(settings, "42"), /Multiple project profiles/);
  assert.equal(profiles.forRedmine(settings, "42", "report").logTimeRules.dailyHours, 8);
  const other = { ...settings, redmineDomain: "https://other.example" };
  assert.equal(profiles.forBacklog(other, "ALPHA-1"), other);
  const otherBacklog = { ...settings, backlogDomain: "https://other.backlog.com" };
  assert.equal(profiles.forBacklog(otherBacklog, "ALPHA-1"), otherBacklog);
});
