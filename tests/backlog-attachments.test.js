const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

test("attachment downloads reject unrelated origins and paths before any network access", async () => {
  let calls = 0;
  const context = vm.createContext({
    URL,
    timeoutFetch: async (_url, options) => {
      calls++;
      assert.equal(options.redirect, "error");
      return { ok: true, blob: async () => new Blob(["file"]) };
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/backlog.js", "utf8"), context);
  for (const url of [
    "https://other.example/attachments/download/1/file.txt",
    "https://redmine.example/login",
    "https://redmine.example/attachments/download/not-an-id",
    "https://user@redmine.example/attachments/download/1/file.txt",
  ]) {
    await assert.rejects(
      context.downloadRedmineAttachment(url, "https://redmine.example/"),
      /outside/
    );
  }
  assert.equal(calls, 0);
  await context.downloadRedmineAttachment(
    "https://redmine.example/redmine/attachments/download/1/file.txt",
    "https://redmine.example/redmine/"
  );
  assert.equal(calls, 1);
});

test("reverse sync reports failed files without losing the successful comment", async () => {
  const calls = [];
  const context = vm.createContext({
    URL,
    URLSearchParams,
    Blob,
    FormData,
    console,
    TB: { MESSAGES: { TOAST: { SEND_BACKLOG_SUCCESS: "sent" } } },
    getSettings: async () => ({
      backlogApiKey: "test-key",
      backlogDomain: "https://demo.backlog.com/",
      redmineDomain: "https://redmine.example/",
    }),
    getTrustedBacklogApiOrigin: (domain) => domain,
    sanitizeErrorMessage: (message) => message,
    timeoutFetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/space/attachment?")) return { ok: false, status: 503 };
      if (url.includes("/comments?")) return { ok: true, json: async () => ({ id: 42 }) };
      return { ok: true, blob: async () => new Blob(["file"]) };
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/backlog.js", "utf8"), context);
  const result = await context.handleSendToBacklog({
    backlogIssueKey: "DEMO-1",
    content: "note",
    attachments: [
      { url: "https://redmine.example/attachments/download/1/demo.txt", filename: "demo.txt" },
    ],
  });
  assert.equal(result.commentId, 42);
  assert.equal(result.partial, true);
  assert.equal(result.attachmentResults[0].ok, false);
  assert.equal(result.attachmentResults[0].error, "HTTP 503");
  assert.equal(calls.filter(({ url }) => url.includes("/comments?")).length, 1);
});

test("Backlog uploads files before creating the comment and binds upload IDs", async () => {
  const calls = [];
  const context = vm.createContext({
    URL,
    URLSearchParams,
    Blob,
    FormData,
    console,
    TB: { MESSAGES: { TOAST: { SEND_BACKLOG_SUCCESS: "sent" } } },
    getSettings: async () => ({
      backlogApiKey: "test-key",
      backlogDomain: "https://demo.backlog.com/",
      redmineDomain: "https://redmine.example/",
    }),
    getTrustedBacklogApiOrigin: (domain) => domain,
    sanitizeErrorMessage: (message) => message,
    timeoutFetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/space/attachment?")) return { ok: true, json: async () => ({ id: 7 }) };
      if (url.includes("/comments?")) return { ok: true, json: async () => ({ id: 42 }) };
      return { ok: true, blob: async () => new Blob(["file"]) };
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/backlog.js", "utf8"), context);
  const result = await context.handleSendToBacklog({
    backlogIssueKey: "DEMO-1",
    content: "note",
    attachments: [
      { url: "https://redmine.example/attachments/download/1/demo.txt", filename: "demo.txt" },
    ],
  });
  assert.equal(result.partial, false);
  assert.equal(calls[1].url.includes("/space/attachment?"), true);
  assert.equal(new URLSearchParams(calls[2].options.body).get("attachmentId[]"), "7");
});
