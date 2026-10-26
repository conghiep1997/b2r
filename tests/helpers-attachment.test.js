const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
  "utf8"
);

function loadHelpers() {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(
    `${source}
this.normalizeBacklogOrigin = normalizeBacklogOrigin;
this.getTrustedBacklogApiOrigin = getTrustedBacklogApiOrigin;
this.buildRedmineUploadUrl = buildRedmineUploadUrl;
this.buildRedmineUrl = buildRedmineUrl;`,
    context
  );
  return context;
}

test("normalizeBacklogOrigin accepts hostname and full URL", () => {
  const { normalizeBacklogOrigin } = loadHelpers();
  assert.equal(normalizeBacklogOrigin("space.backlog.com"), "https://space.backlog.com");
  assert.equal(normalizeBacklogOrigin("https://space.backlog.com/"), "https://space.backlog.com");
  assert.equal(
    normalizeBacklogOrigin("https://space.backlog.jp/view/PROJ-1"),
    "https://space.backlog.jp"
  );
  assert.equal(normalizeBacklogOrigin(""), "");
});

test("Backlog connection checks require a secure workspace origin", () => {
  const { getTrustedBacklogApiOrigin } = loadHelpers();
  assert.equal(getTrustedBacklogApiOrigin("https://team.backlog.com/"), "https://team.backlog.com");
  assert.equal(getTrustedBacklogApiOrigin("team.backlog.com"), "https://team.backlog.com");
  assert.equal(getTrustedBacklogApiOrigin("https://team.backlog.jp"), "https://team.backlog.jp");
  for (const domain of [
    "http://team.backlog.com",
    "https://backlog.com",
    "https://team.backlog.com.evil.test",
    "https://team.backlog.com/path",
    "https://user:pass@team.backlog.com",
  ]) {
    assert.throws(() => getTrustedBacklogApiOrigin(domain));
  }
});

test("buildRedmineUploadUrl includes encoded filename query param", () => {
  const { buildRedmineUploadUrl } = loadHelpers();
  const url = buildRedmineUploadUrl("https://redmine.example.com", "3653_API呼び出しあり.mp4");
  const parsed = new URL(url);
  assert.equal(parsed.pathname.endsWith("/uploads.json"), true);
  assert.equal(parsed.searchParams.get("filename"), "3653_API呼び出しあり.mp4");
});

test("Redmine URLs preserve same-origin paths and reject credential leaks", () => {
  const { buildRedmineUrl } = loadHelpers();
  assert.equal(
    buildRedmineUrl("https://redmine.example.test", "/issues/1.json"),
    "https://redmine.example.test/issues/1.json"
  );
  for (const target of [
    "https://foreign.example.test/issues.json",
    "///foreign.example.test/issues.json",
    "\\\\foreign.example.test/issues.json",
    "https://user:pass@redmine.example.test/issues.json",
    "javascript:alert(1)",
  ]) {
    assert.throws(
      () => buildRedmineUrl("https://redmine.example.test", target),
      /configured origin/
    );
  }
});
