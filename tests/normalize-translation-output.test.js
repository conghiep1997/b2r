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
    `${read("modules", "services", "ai.js")}\nthis.normalizeTranslationOutput = normalizeTranslationOutput;\nthis.fixMangledMarkers = fixMangledMarkers;\nthis.isolateImageMarkers = isolateImageMarkers;\nthis.recoverMissingImageMarkers = recoverMissingImageMarkers;`,
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

test("isolateImageMarkers places image and file markers on their own line blocks", () => {
  const { isolateImageMarkers } = load();
  const input =
    "Bước 1: Mở màn hình [[TB_IMG:12345]] sau đó tiếp tục [[TB_FILE:67890:data.csv]] ở bước 2.";
  const expected =
    "Bước 1: Mở màn hình\n\n[[TB_IMG:12345]]\n\nSau đó tiếp tục\n\n[[TB_FILE:67890:data.csv]]\n\nỞ bước 2.";
  assert.equal(isolateImageMarkers(input).toLowerCase(), expected.toLowerCase());
});

test("fixMangledMarkers repairs mangled marker and isolates it on its own line", () => {
  const { fixMangledMarkers } = load();
  const input = "Mô tả ![image]([[TB_IMG:123]]) kết thúc";
  const expected = "Mô tả\n\n[[TB_IMG:123]]\n\nKết thúc";
  assert.equal(fixMangledMarkers(input).toLowerCase(), expected.toLowerCase());
});

test("recoverMissingImageMarkers appends dropped markers to prevent asset loss", () => {
  const { recoverMissingImageMarkers } = load();
  const original = "Đoạn 1\n\n[[TB_IMG:111]]\n\nĐoạn 2\n\n[[TB_IMG:222]]";
  const translated = "Đoạn 1 đã dịch\n\n[[TB_IMG:111]]\n\nĐoạn 2 đã dịch";
  const recovered = recoverMissingImageMarkers(original, translated);
  assert.match(recovered, /\[\[TB_IMG:222\]\]/);
});
