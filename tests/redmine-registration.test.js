const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const optionsSource = fs.readFileSync(
  path.join(root, "src", "modules", "ui", "options-domain.js"),
  "utf8"
);
const backgroundSource = fs.readFileSync(path.join(root, "src", "background.js"), "utf8");
const redmineContentSource = fs.readFileSync(path.join(root, "src", "redmine_content.js"), "utf8");

test("dynamic Redmine registration preserves static content-script load order", () => {
  const staticRegistration = manifest.content_scripts.find((entry) =>
    entry.matches.some((match) => match.includes("redmine"))
  );
  const domainSource = fs.readFileSync(
    path.join(root, "src", "modules", "utils", "redmine-domain.js"),
    "utf8"
  );
  const block = domainSource.match(/const CONTENT_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(block, "CONTENT_SCRIPTS must exist");
  const dynamicScripts = [...block[1].matchAll(/"([^"]+\.js)"/g)].map((match) => match[1]);
  assert.deepEqual(dynamicScripts, staticRegistration.js);
});

test("manifest declares scripting and optional custom Redmine hosts", () => {
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.optional_host_permissions.includes("http://*/*"));
  assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
});
test("open-tab injection probes the isolated-world load marker", () => {
  assert.match(redmineContentSource, /__B2R_REDMINE_LOADED__ = true/);
  assert.match(optionsSource, /Boolean\(globalThis\.__B2R_REDMINE_LOADED__\)/);
  assert.match(optionsSource, /files: TB_REDMINE_DOMAIN\.CONTENT_SCRIPTS/);
  assert.match(backgroundSource, /injectIntoOpenCustomRedmineTabs\(originPattern\)/);
  assert.match(backgroundSource, /files: TB_REDMINE_DOMAIN\.CONTENT_SCRIPTS/);
});
