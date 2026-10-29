const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function setup() {
  const context = vm.createContext({
    URL,
    Blob: class MockBlob {
      constructor(content, options) {
        this.content = content;
        this.options = options;
      }
    },
    setTimeout: (fn) => fn(),
  });

  const files = [
    "utils/sync-rules.js",
    "constants/prompts.js",
    "utils/custom-fields.js",
    "utils/project-profiles.js",
    "utils/config-transfer.js",
  ];

  for (const file of files) {
    vm.runInContext(fs.readFileSync(`src/modules/${file}`, "utf8"), context);
  }

  return {
    transfer: context.TB_CONFIG_TRANSFER,
    profiles: context.TB_PROJECT_PROFILES,
    syncRules: context.TB_SYNC_RULES,
  };
}

test("config transfer strips sensitive credentials at all levels during export and sanitize", () => {
  const { transfer } = setup();

  const dirtyPayload = {
    redmineApiKey: "super-secret-key",
    backlogApiKey: "another-secret",
    nested: {
      geminiApiKey: "ai-secret",
      token: "secret-token",
      userPassword: "password123",
      safeSetting: "allowed-value",
    },
    profiles: [
      {
        name: "Test",
        apiKey: "bad-key",
        backlogProjectKey: "KEY",
      },
    ],
  };

  const cleaned = transfer.sanitize(dirtyPayload);
  assert.equal(cleaned.redmineApiKey, undefined);
  assert.equal(cleaned.backlogApiKey, undefined);
  assert.equal(cleaned.nested.geminiApiKey, undefined);
  assert.equal(cleaned.nested.token, undefined);
  assert.equal(cleaned.nested.userPassword, undefined);
  assert.equal(cleaned.nested.safeSetting, "allowed-value");
  assert.equal(cleaned.profiles[0].apiKey, undefined);
  assert.equal(cleaned.profiles[0].backlogProjectKey, "KEY");
});

test("buildExportPayload formats standard Backlog2Redmine-Config envelope with sanitized data", () => {
  const { transfer } = setup();

  const sampleProfiles = [
    {
      name: "Project Alpha",
      backlogProjectKey: "ALPHA",
      redmineProjectId: "101",
      backlogOrigin: "https://demo.backlog.com",
      redmineOrigin: "https://redmine.example.com",
      secretKey: "should-be-stripped",
    },
  ];

  const samplePolicy = {
    syncRules: {
      subjectTemplate: "[{issueKey}] {summary}",
      titleDelimiter: " - ",
      searchMode: "key-title",
      restrictToProject: false,
    },
    secretToken: "should-be-stripped",
  };

  const payload = transfer.buildExportPayload({
    profiles: sampleProfiles,
    globalPolicy: samplePolicy,
    metadata: {
      backlogDomain: "https://demo.backlog.com",
      redmineDomain: "https://redmine.example.com",
    },
  });

  assert.equal(payload.format, "Backlog2Redmine-Config");
  assert.equal(payload.version, 1);
  assert.equal(payload.metadata.backlogDomain, "https://demo.backlog.com");
  assert.equal(payload.projectProfiles.length, 1);
  assert.equal(payload.projectProfiles[0].secretKey, undefined);
  assert.equal(payload.projectProfiles[0].name, "Project Alpha");
  assert.equal(payload.globalPolicy.secretToken, undefined);
  assert.equal(payload.globalPolicy.syncRules.subjectTemplate, "[{issueKey}] {summary}");
});

test("parseAndValidate validates structure, strips injected keys, and normalizes profiles", () => {
  const { transfer } = setup();

  const validJson = JSON.stringify({
    format: "Backlog2Redmine-Config",
    version: 1,
    metadata: {
      backlogDomain: "https://demo.backlog.com",
      redmineDomain: "https://redmine.example.com",
    },
    projectProfiles: [
      {
        name: "Project Beta",
        backlogProjectKey: "BETA",
        redmineProjectId: "202",
        backlogOrigin: "https://demo.backlog.com",
        redmineOrigin: "https://redmine.example.com",
        apiKey: "injected-secret-key",
      },
    ],
    globalPolicy: {
      syncRules: {
        subjectTemplate: "{issueKey}: {summary}",
      },
    },
  });

  const result = transfer.parseAndValidate(validJson);
  assert.equal(result.valid, true);
  assert.equal(result.summary.profileCount, 1);
  assert.equal(result.summary.hasGlobalPolicy, true);
  assert.equal(result.payload.projectProfiles[0].name, "Project Beta");
  assert.equal(result.payload.projectProfiles[0].apiKey, undefined);

  // Invalid JSON rejection
  assert.throws(() => transfer.parseAndValidate("invalid json {{{"), /JSON/);

  // Unrecognized format rejection
  assert.throws(
    () => transfer.parseAndValidate(JSON.stringify({ someRandomField: 123 })),
    /không chứa cấu hình/
  );
});

test("mergeProfiles correctly handles merge vs replace modes", () => {
  const { transfer } = setup();

  const currentProfiles = [
    {
      name: "Existing Alpha",
      backlogProjectKey: "ALPHA",
      redmineProjectId: "101",
      backlogOrigin: "https://demo.backlog.com",
      redmineOrigin: "https://redmine.example.com",
    },
    {
      name: "Existing Beta",
      backlogProjectKey: "BETA",
      redmineProjectId: "102",
      backlogOrigin: "https://demo.backlog.com",
      redmineOrigin: "https://redmine.example.com",
    },
  ];

  const incomingProfiles = [
    {
      name: "Updated Alpha",
      backlogProjectKey: "ALPHA",
      redmineProjectId: "999",
      backlogOrigin: "https://demo.backlog.com",
      redmineOrigin: "https://redmine.example.com",
    },
    {
      name: "New Gamma",
      backlogProjectKey: "GAMMA",
      redmineProjectId: "103",
      backlogOrigin: "https://demo.backlog.com",
      redmineOrigin: "https://redmine.example.com",
    },
  ];

  // Test mode: replace
  const replaced = transfer.mergeProfiles(currentProfiles, incomingProfiles, "replace");
  assert.equal(replaced.length, 2);
  assert.equal(replaced[0].name, "Updated Alpha");
  assert.equal(replaced[1].name, "New Gamma");

  // Test mode: merge
  const merged = transfer.mergeProfiles(currentProfiles, incomingProfiles, "merge");
  assert.equal(merged.length, 3);
  // ALPHA was updated
  const alpha = merged.find((p) => p.backlogProjectKey === "ALPHA");
  assert.equal(alpha.name, "Updated Alpha");
  assert.equal(alpha.redmineProjectId, "999");
  // BETA was preserved
  const beta = merged.find((p) => p.backlogProjectKey === "BETA");
  assert.equal(beta.name, "Existing Beta");
  // GAMMA was added
  const gamma = merged.find((p) => p.backlogProjectKey === "GAMMA");
  assert.equal(gamma.name, "New Gamma");
});

test("mergeGlobalPolicy cleanly updates rules and merges custom fields by id", () => {
  const { transfer } = setup();

  const currentPolicy = {
    syncRules: {
      subjectTemplate: "{issueKey} {summary}",
      searchMode: "key-title",
    },
    customFields: [{ id: 1, name: "Severity", type: "select", required: true, options: ["Major"] }],
  };

  const incomingPolicy = {
    syncRules: {
      subjectTemplate: "[{issueKey}] {summary}",
    },
    customFields: [
      { id: 1, name: "Severity Updated", type: "select", required: true, options: ["Critical"] },
      { id: 2, name: "Category", type: "text", required: false },
    ],
  };

  const merged = transfer.mergeGlobalPolicy(currentPolicy, incomingPolicy);
  assert.equal(merged.syncRules.subjectTemplate, "[{issueKey}] {summary}");
  assert.equal(merged.syncRules.searchMode, "key-title");
  assert.equal(merged.customFields.length, 2);
  assert.equal(merged.customFields[0].name, "Severity Updated");
  assert.equal(merged.customFields[1].name, "Category");
});
