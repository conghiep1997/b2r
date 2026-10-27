const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "src");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

function load() {
  const context = vm.createContext({ URL, URLSearchParams, console, setTimeout, clearTimeout });
  vm.runInContext(read("modules", "utils", "helpers.js"), context);
  vm.runInContext(read("modules", "constants", "prompts.js"), context);
  context.TB = {
    PROMPTS: context.TB_PROMPTS,
    PROVIDERS: {},
    MESSAGES: { TOAST: {} },
  };
  vm.runInContext(
    `${read("modules", "services", "ai.js")}\nthis.normalizeTranslationOutput = normalizeTranslationOutput;`,
    context
  );
  return context;
}

test("translation containing the word 'result:' is not truncated", () => {
  const { normalizeTranslationOutput } = load();
  const text = "Mô tả lỗi.\nKết quả mong đợi: Expected result: OK";
  assert.equal(normalizeTranslationOutput(text), text);
});

test("leading 'Result:' prefix is still removed", () => {
  const { normalizeTranslationOutput } = load();
  assert.equal(normalizeTranslationOutput("Result: Xin chào"), "Xin chào");
});

test("numbered list translation is preserved", () => {
  const { normalizeTranslationOutput } = load();
  const text = "1. Mở ứng dụng\n2. Nhấn nút Login\nHoàn tất";
  assert.equal(normalizeTranslationOutput(text), text);
});

test("all-caps numbered rule echo is still removed", () => {
  const { normalizeTranslationOutput } = load();
  assert.equal(normalizeTranslationOutput("1. COMPLY RULES\nXin chào"), "Xin chào");
});
