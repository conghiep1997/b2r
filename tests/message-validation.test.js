const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "message-validation.js"),
  "utf8"
);
const context = vm.createContext({});
vm.runInContext(source, context);

test("accepts known messages from the current extension", () => {
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertMessage({
      type: "TRANSLATE_TEXT_SIMPLE",
      text: "hello",
    })
  );
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertInternalSender({ id: "extension-id" }, "extension-id")
  );
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertMessage({
      type: "FETCH_REDMINE_PROJECTS_WITH_KEY",
      domain: "https://redmine.example.com",
      apiKey: "key",
    })
  );
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertMessage({ type: "GET_DEFAULT_PROJECT_SUMMARY" })
  );
});

test("rejects unknown, oversized, and malformed messages", () => {
  assert.throws(
    () => context.TB_MESSAGE_VALIDATION.assertMessage({ type: "UNKNOWN" }),
    /Unsupported/
  );
  assert.throws(
    () =>
      context.TB_MESSAGE_VALIDATION.assertMessage({
        type: "TRANSLATE_TEXT_SIMPLE",
        text: "x".repeat(100001),
      }),
    /too long/
  );
  assert.throws(
    () =>
      context.TB_MESSAGE_VALIDATION.assertMessage({
        type: "TRANSLATE_TEXT_SIMPLE",
        text: 123,
      }),
    /must be a string/
  );
  assert.throws(
    () => context.TB_MESSAGE_VALIDATION.assertInternalSender({ id: "other" }, "extension-id"),
    /Untrusted/
  );
  assert.throws(
    () =>
      context.TB_MESSAGE_VALIDATION.assertMessage({
        type: "TEST_MODEL_WITH_KEY",
        provider: "gemini",
        modelId: "gemini-test",
      }),
    /apiKey.*required/
  );
  assert.throws(
    () => context.TB_MESSAGE_VALIDATION.assertMessage({ type: "TEST_MODEL" }),
    /Unsupported/
  );
});

test("sync message validation rejects malformed destinations and attachment lists", () => {
  for (const message of [
    { type: "SEND_TO_REDMINE", redmineIssueId: "../users", notes: "demo" },
    { type: "SEND_TO_BACKLOG", backlogIssueKey: "../other", content: "demo" },
    { type: "GET_BACKLOG_USERS", projectKey: "DEMO/../other" },
    { type: "SEND_TO_BACKLOG", backlogIssueKey: "DEMO-1", content: "demo", attachments: {} },
    {
      type: "SEND_TO_BACKLOG",
      backlogIssueKey: "DEMO-1",
      content: "demo",
      attachments: [{ url: "/attachments/download/5/demo.txt" }],
    },
  ]) {
    assert.throws(() => context.TB_MESSAGE_VALIDATION.assertMessage(message), /Invalid/);
  }
});
