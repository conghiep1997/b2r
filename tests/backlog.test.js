const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBacklog(fetch) {
  const settings = {
    backlogDomain: "https://demo.backlog.com",
    backlogApiKey: "demo-backlog-key",
    redmineDomain: "https://redmine.example.test",
    redmineApiKey: "demo-redmine-key",
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    FormData,
    console,
    fetch,
    getSettings: async () => settings,
    TB: { MESSAGES: { TOAST: { SEND_BACKLOG_SUCCESS: "Sent" } } },
    sanitizeErrorMessage: (message, status) => `${status}: ${message}`,
  });
  for (const file of ["utils/helpers.js", "services/backlog.js"]) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", "src", "modules", file), "utf8"),
      context
    );
  }
  return { context, settings };
}

test("reverse-sync uploads a relative Redmine attachment before posting its Backlog comment", async () => {
  const calls = [];
  const { context } = loadBacklog(async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1)
      return new Response("file bytes", { headers: { "Content-Type": "text/plain" } });
    if (calls.length === 2) return Response.json({ id: 42 });
    return Response.json({ id: 123 });
  });
  const result = await context.handleSendToBacklog({
    backlogIssueKey: "DEMO-1",
    content: "Comment",
    attachments: [{ url: "/attachments/download/5/demo.txt", filename: "demo.txt" }],
  });
  assert.equal(calls[0].url, "https://redmine.example.test/attachments/download/5/demo.txt");
  assert.equal(calls[0].init.headers["X-Redmine-API-Key"], "demo-redmine-key");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(new URL(calls[1].url).pathname, "/api/v2/space/attachment");
  assert.equal(calls[1].init.body.get("file").name, "demo.txt");
  assert.equal(new URL(calls[2].url).pathname, "/api/v2/issues/DEMO-1/comments");
  assert.deepEqual(new URLSearchParams(calls[2].init.body).getAll("attachmentId[]"), ["42"]);
  assert.equal(result.backlogUrl, "https://demo.backlog.com/view/DEMO-1#comment-123");
});

test("attachment upload failures prevent posting a comment", async () => {
  const calls = [];
  const { context } = loadBacklog(async (url) => {
    calls.push(url);
    return calls.length === 1
      ? new Response("file bytes")
      : new Response("upload failed", { status: 400 });
  });
  await assert.rejects(
    context.handleSendToBacklog({
      backlogIssueKey: "DEMO-1",
      content: "Comment",
      attachments: [{ url: "/attachments/download/5/demo.txt", filename: "demo.txt" }],
    }),
    /attachment upload failed/
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => !url.includes("/comments")));
});

test("attachment downloads reject foreign origins and login pages", async () => {
  let requests = 0;
  const { context, settings } = loadBacklog(async () => {
    requests++;
    return new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } });
  });
  await assert.rejects(
    context.downloadRedmineAttachment(
      "https://foreign.example.test/attachments/download/5/demo.txt",
      settings
    ),
    /configured origin/
  );
  assert.equal(requests, 0);
  await assert.rejects(
    context.downloadRedmineAttachment("/attachments/download/5/demo.txt", settings),
    /login page/
  );
});
