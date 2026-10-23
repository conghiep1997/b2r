const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync("src/modules/utils/migration-selection.js", "utf8"), context);
const selection = context.TB_MIGRATION_SELECTION;

test("selection omits individual comments and all occurrences of excluded files", () => {
  const result = selection.plan(
    "Description [[TB_FILE:7:report.txt]]",
    ["first [[TB_IMG:8]]", "second [[TB_FILE:7:report.txt]]"],
    new Set([0]),
    new Set([7 + ""])
  );
  assert.equal(result.description, "Description ");
  assert.deepEqual(Array.from(result.comments), ["second "]);
  assert.deepEqual(Array.from(result.selection.commentIndexes), [1]);
  assert.equal(result.files.length, 0);
});

test("file inventory deduplicates shared attachments and keeps safe literal names", () => {
  const files = selection.files([
    "[[TB_IMG:8]]",
    "[[TB_FILE:8:image.png]] [[TB_FILE:7:<script>.txt]]",
  ]);
  assert.equal(files.length, 2);
  assert.equal(files[0].filename, "image.png");
  assert.equal(files[1].filename, "<script>.txt");
});

test("users may choose zero comments while keeping description attachments", () => {
  const result = selection.plan("Description [[TB_IMG:8]]", ["first"], new Set([0]));
  assert.equal(result.comments.length, 0);
  assert.deepEqual(Array.from(result.selection.fileIds), ["8"]);
});
