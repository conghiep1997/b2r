const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const helpersSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
  "utf8"
);
const aiSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "ai.js"),
  "utf8"
);
const promptsSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "constants", "prompts.js"),
  "utf8"
);

function loadEnvironment() {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    crypto: globalThis.crypto,
  });
  vm.runInContext(helpersSource, context);
  vm.runInContext(promptsSource, context);
  context.TB = {
    PROMPTS: context.TB_PROMPTS,
    PROVIDERS: { GEMINI: "gemini", GROQ: "groq", NONE: "none" },
    MESSAGES: { TOAST: { RATE_LIMIT_FAILED: "Unavailable" } },
  };
  vm.runInContext(
    `${aiSource}
this.stripSyncMarkers = stripSyncMarkers;
this.normalizeTranslationOutput = normalizeTranslationOutput;
this.translateText = translateText;`,
    context
  );
  return context;
}

test("stripSyncMarkers removes plain B2R_SYNC token and cleans trailing whitespace", () => {
  const { stripSyncMarkers } = loadEnvironment();
  const input = "コメントの内容です。\n\nB2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9";
  assert.equal(stripSyncMarkers(input), "コメントの内容です。");
});

test("stripSyncMarkers removes token with invisible separators (\\u2063)", () => {
  const { stripSyncMarkers } = loadEnvironment();
  const input = "Nội dung phản hồi.\n\n\u2063B2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9\u2063";
  assert.equal(stripSyncMarkers(input), "Nội dung phản hồi.");
});

test("stripSyncMarkers removes B2R_MIGRATION tokens", () => {
  const { stripSyncMarkers } = loadEnvironment();
  const input1 =
    "Mô tả công việc.\n\n\u2063B2R_MIGRATION_c1234567-89ab-cdef-0123-456789abcdef_issue\u2063";
  assert.equal(stripSyncMarkers(input1), "Mô tả công việc.");

  const input2 = "Comment 1.\n\nB2R_MIGRATION_c1234567-89ab-cdef-0123-456789abcdef_0";
  assert.equal(stripSyncMarkers(input2), "Comment 1.");
});

test("stripSyncMarkers removes legacy HTML comment markers", () => {
  const { stripSyncMarkers } = loadEnvironment();
  const input1 = "Legacy comment.\n\n<!-- b2r:d2206b81-1465-403a-9699-5e26a63bf5e9:1 -->";
  assert.equal(stripSyncMarkers(input1), "Legacy comment.");

  const input2 =
    "Escaped comment.\n\n&lt;!-- b2r:d2206b81-1465-403a-9699-5e26a63bf5e9:issue --&gt;";
  assert.equal(stripSyncMarkers(input2), "Escaped comment.");

  const input3 =
    "Decimal escaped.\n\n&#60;!-- b2r:d2206b81-1465-403a-9699-5e26a63bf5e9:issue --&#62;";
  assert.equal(stripSyncMarkers(input3), "Decimal escaped.");
});

test("stripSyncMarkers handles markers in middle of text and preserves surrounding content", () => {
  const { stripSyncMarkers } = loadEnvironment();
  const input = "Dòng trên.\n\nB2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9\n\nDòng dưới.";
  assert.equal(stripSyncMarkers(input), "Dòng trên.\n\nDòng dưới.");
});

test("stripSyncMarkers returns empty string when text only contains marker", () => {
  const { stripSyncMarkers } = loadEnvironment();
  assert.equal(stripSyncMarkers("B2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9"), "");
  assert.equal(stripSyncMarkers("\u2063B2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9\u2063"), "");
  assert.equal(stripSyncMarkers(""), "");
  assert.equal(stripSyncMarkers(null), "");
});

test("normalizeTranslationOutput cleans any leaked sync marker from AI output", () => {
  const { normalizeTranslationOutput } = loadEnvironment();
  const raw = "Đây là kết quả dịch.\n\nB2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9";
  assert.equal(normalizeTranslationOutput(raw), "Đây là kết quả dịch.");
});

test("translateText with original reverse mode strips sync markers", async () => {
  const { translateText } = loadEnvironment();
  const result = await translateText(
    "日本語のテキスト\n\n\u2063B2R_SYNC_d2206b81-1465-403a-9699-5e26a63bf5e9\u2063",
    {
      isReverseTranslation: true,
      translationRules: { reverseMode: "original" },
    }
  );
  assert.equal(result, "日本語のテキスト");
});
