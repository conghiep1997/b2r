const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

test("migration attachment failure prevents issue creation and is safe to retry", async () => {
  let writes = 0;
  let downloads = 0;
  const settings = {
    backlogDomain: "https://demo.backlog.com",
    redmineDomain: "https://redmine.example",
    redmineApiKey: "test-key",
  };
  const context = vm.createContext({
    console: { error() {} },
    getSettings: async () => settings,
    downloadBacklogFile: async () => {
      downloads++;
      throw new Error("Download failed");
    },
    timeoutFetch: async () => {
      writes++;
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/redmine.js", "utf8"), context);
  const request = {
    issueData: { backlogIssueKey: "DEMO-1", description: "[[TB_FILE:7:demo.txt]]" },
    comments: [],
    strictAttachments: true,
  };
  await assert.rejects(
    context.handleCreateRedmineIssue(request),
    (error) => error.definitelyNotSent === true
  );
  await assert.rejects(
    context.handleCreateRedmineIssue(request),
    /Attachments were not transferred/
  );
  assert.equal(writes, 0);
  assert.equal(downloads, 2);
});

test("migration comment attachment failure prevents note submission", async () => {
  let writes = 0;
  const context = vm.createContext({
    console: { error() {} },
    getSettings: async () => ({ backlogDomain: "https://demo.backlog.com" }),
    downloadBacklogFile: async () => {
      throw new Error("Download failed");
    },
    timeoutFetch: async () => {
      writes++;
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/redmine.js", "utf8"), context);
  await assert.rejects(
    context.handleSendToRedmine(
      {
        redmineIssueId: 42,
        notes: "[[TB_IMG:7]]",
        backlogIssueKey: "DEMO-1",
        strictAttachments: true,
      },
      null
    ),
    (error) => error.definitelyNotSent === true
  );
  assert.equal(writes, 0);
});
