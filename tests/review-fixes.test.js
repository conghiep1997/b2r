const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const { webcrypto } = require("node:crypto");

test("operation locks serialize one issue while unrelated work can finish", async () => {
  const context = vm.createContext({
    URL,
    crypto: webcrypto,
    TextEncoder,
    normalizeBacklogOrigin: (value) => value,
  });
  vm.runInContext(fs.readFileSync("src/modules/services/sync-state.js", "utf8"), context);
  const settings = {
    backlogDomain: "https://demo.backlog.com",
    redmineDomain: "https://redmine.example",
  };
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const events = [];
  const first = context.TB_SYNC_STATE.run(
    async () => {
      events.push("first");
      await wait;
    },
    settings,
    "migration",
    "DEMO-1"
  );
  const second = context.TB_SYNC_STATE.run(
    () => {
      events.push("second");
    },
    settings,
    "migration",
    "DEMO-1"
  );
  await context.TB_SYNC_STATE.run(
    () => {
      events.push("glossary");
    },
    settings,
    "glossary",
    "DEMO"
  );
  assert.deepEqual(events, ["first", "glossary"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first", "glossary", "second"]);
});

test("workspace-prefixed records skip decryption of other workspaces and read legacy keys", async () => {
  const storage = {};
  let decrypted = 0;
  const context = vm.createContext({
    URL,
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    normalizeBacklogOrigin: (value) => value,
    encryptData: async (text) => text,
    decryptData: async (text) => {
      decrypted++;
      return text;
    },
    chrome: {
      storage: {
        local: {
          get: async (key) => (key === null ? { ...storage } : { [key]: storage[key] }),
          set: async (items) => Object.assign(storage, items),
          remove: async (key) => {
            delete storage[key];
          },
        },
      },
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/sync-state.js", "utf8"), context);
  const settings = {
    backlogDomain: "https://demo.backlog.com",
    redmineDomain: "https://redmine.example",
  };
  await context.TB_SYNC_STATE.write(settings, "mapping", "DEMO-1", { issueId: 1 });
  await context.TB_SYNC_STATE.write(
    { ...settings, redmineDomain: "https://other.example" },
    "mapping",
    "DEMO-1",
    { issueId: 2 }
  );
  const records = await context.TB_SYNC_STATE.list(settings);
  assert.equal(records.length, 1);
  assert.equal(decrypted, 1);
  const input = JSON.stringify([context.TB_SYNC_STATE.scope(settings), "mapping", "DEMO-2"]);
  const hash = Buffer.from(
    await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  ).toString("hex");
  storage[`b2r_sync_${hash}`] = JSON.stringify({
    scope: context.TB_SYNC_STATE.scope(settings),
    kind: "mapping",
    identity: "DEMO-2",
    issueId: 3,
    updatedAt: "2026-10-02",
  });
  assert.equal((await context.TB_SYNC_STATE.read(settings, "mapping", "DEMO-2")).issueId, 3);
  const originalSet = context.chrome.storage.local.set;
  context.chrome.storage.local.set = async () => {
    throw new Error("Storage offline");
  };
  await assert.rejects(
    context.TB_SYNC_STATE.write(settings, "mapping", "DEMO-2", { issueId: 4 }),
    /Storage offline/
  );
  assert.ok(storage[`b2r_sync_${hash}`]);
  context.chrome.storage.local.set = originalSet;
  await context.TB_SYNC_STATE.write(settings, "mapping", "DEMO-2", { issueId: 4 });
  assert.equal(storage[`b2r_sync_${hash}`], undefined);
  assert.equal((await context.TB_SYNC_STATE.read(settings, "mapping", "DEMO-2")).issueId, 4);
  await context.TB_SYNC_STATE.remove(settings, "mapping", "DEMO-2");
  assert.equal(await context.TB_SYNC_STATE.read(settings, "mapping", "DEMO-2"), null);
});

test("failed domain registration restores domain and credentials as one settings snapshot", async () => {
  const storage = {
    redmineDomain: "https://old.example",
    redmineApiKey: "encrypted-old",
    backlogApiKey: "encrypted-backlog-old",
  };
  const context = vm.createContext({
    console,
    TB: { REDMINE_DOMAIN: "https://old.example" },
    TB_REDMINE_DOMAIN: {
      isDefault: (value) => value === "https://old.example",
      toMatchPattern: (value) => value + "/*",
      CUSTOM_SCRIPT_ID: "custom",
      CONTENT_SCRIPTS: [],
    },
    chrome: {
      storage: {
        local: {
          get: async () => ({ ...storage }),
          set: async (items) => Object.assign(storage, items),
          remove: async (keys) => {
            for (const key of keys) delete storage[key];
          },
        },
      },
      scripting: {
        unregisterContentScripts: async () => {},
        registerContentScripts: async () => {
          throw new Error("Registration failed");
        },
      },
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/ui/options-domain.js", "utf8"), context);
  const domain = context.TB_OPTIONS_DOMAIN.create({ om: (key) => key });
  await assert.rejects(
    domain.saveSettings(
      {
        redmineDomain: "https://new.example",
        redmineApiKey: "encrypted-new",
        backlogApiKey: "encrypted-backlog-new",
        syncRules: {},
      },
      { currentDomain: "https://new.example", previousDomain: "https://old.example" }
    ),
    /Registration failed/
  );
  assert.deepEqual(storage, {
    redmineDomain: "https://old.example",
    redmineApiKey: "encrypted-old",
    backlogApiKey: "encrypted-backlog-old",
  });
});

test("migration upload names distinguish same-name files while keeping source download names", async () => {
  const downloaded = [];
  const uploaded = [];
  const context = vm.createContext({
    console,
    downloadBacklogFile: async (_domain, id, filename) => {
      downloaded.push([id, filename]);
      return { type: "text/plain" };
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/migration.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/modules/services/redmine.js", "utf8"), context);
  context.uploadToRedmine = async (_domain, _key, _blob, filename) => {
    uploaded.push(filename);
    return "token";
  };
  const result = await context.processNotesAttachments(
    "[[TB_FILE:1:report.txt]] [[TB_FILE:2:report.txt]]",
    "https://demo.backlog.com",
    { attachmentIdentityPrefix: "migration-one" },
    "DEMO-1",
    new Map(),
    true
  );
  assert.deepEqual(downloaded, [
    ["1", "report.txt"],
    ["2", "report.txt"],
  ]);
  assert.deepEqual(uploaded, [
    "report__b2r_migration-one_1.txt",
    "report__b2r_migration-one_2.txt",
  ]);
  assert.equal(result.uploads.length, 2);
});
