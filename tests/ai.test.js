const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "ai.js"),
  "utf8"
);
const promptsSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "constants", "prompts.js"),
  "utf8"
);

test("translation defaults to Japanese to Vietnamese and accepts a selected language pair", () => {
  const context = vm.createContext({});
  vm.runInContext(promptsSource, context);
  const prompts = context.TB_PROMPTS;
  assert.deepEqual(JSON.parse(JSON.stringify(prompts.resolveLanguagePair())), {
    source: "ja",
    target: "vi",
  });
  assert.match(prompts.USER("原文"), /sang tiếng Việt/);
  assert.match(
    prompts.USER("Bonjour", {
      translationSourceLanguage: "fr",
      translationTargetLanguage: "en",
    }),
    /Ngôn ngữ nguồn chính: tiếng Pháp/
  );
  assert.match(
    prompts.SIMPLE_TRANSLATE("Bonjour", {
      translationSourceLanguage: "auto",
      translationTargetLanguage: "en",
    }),
    /Tự nhận diện ngôn ngữ nguồn/
  );
  assert.notEqual(prompts.SIMPLE_TRANSLATE, prompts.USER);
  assert.equal(prompts.resolveLanguagePair({ translationTargetLanguage: "unknown" }).target, "vi");
});

test("translation service passes the selected pair and labels the translated section", async () => {
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(promptsSource, context);
  context.TB = {
    PROMPTS: context.TB_PROMPTS,
    DEFAULT_PRIMARY_PROVIDER: "gemini",
    DEFAULT_PRIMARY_MODEL: "demo-model",
    DEFAULT_FALLBACK_PROVIDER: "none",
    DEFAULT_FALLBACK_MODEL: "",
    PROVIDERS: { NONE: "none" },
  };
  vm.runInContext(source, context);
  vm.runInContext(
    `callAIsByProvider = async (_provider, _model, _settings, input, _url, promptFn) => {
      globalThis.capturedPrompt = promptFn(input);
      globalThis.capturedTarget = promptFn.targetLanguage;
      globalThis.capturedFullTranslation = promptFn.includeOriginal;
      return "translated";
    };
    this.formatResult = formatTranslation;`,
    context
  );
  await context.translateText("Bonjour", {
    translationSourceLanguage: "fr",
    translationTargetLanguage: "en",
    fallbackProvider: "none",
  });
  assert.match(context.capturedPrompt, /sang tiếng Anh/);
  assert.equal(context.capturedTarget, "en");
  assert.equal(context.capturedFullTranslation, true);
  await context.translateText(
    "Bonjour",
    { translationSourceLanguage: "fr", translationTargetLanguage: "en" },
    null,
    context.TB_PROMPTS.SIMPLE_TRANSLATE
  );
  assert.equal(context.capturedFullTranslation, false);
  assert.match(context.formatResult("Bonjour", "Hello", null, "en"), /\{\{collapse\(EN\)/);
  assert.match(context.formatResult("原文", "Bản dịch"), /\{\{collapse\(VN\)/);
});

function createNormalizer() {
  const helpersSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
    "utf8"
  );
  const context = vm.createContext({
    console,
    globalThis: {},
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(helpersSource, context);
  vm.runInContext(
    `${source}\nthis.normalizeTranslationOutput = normalizeTranslationOutput;`,
    context
  );
  return context.normalizeTranslationOutput;
}

test("fallback still runs when every primary combination is already cooling down", async () => {
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(promptsSource, context);
  context.TB = {
    PROMPTS: context.TB_PROMPTS,
    PROVIDERS: { GEMINI: "gemini", GROQ: "groq", NONE: "none" },
    MESSAGES: { TOAST: { RATE_LIMIT_FAILED: "Unavailable" } },
  };
  vm.runInContext(source, context);
  let primaryCalls = 0;
  let fallbackCalls = 0;
  context.callGeminiAPI = async () => {
    primaryCalls++;
    throw new Error("429 rate limit");
  };
  context.callGroqAPI = async () => {
    fallbackCalls++;
    return "translated";
  };
  const settings = {
    primaryProvider: "gemini",
    primaryModel: "demo",
    fallbackProvider: "groq",
    fallbackModel: "demo",
    geminiApiKeys: ["demo-primary"],
    fallbackGroqApiKeys: ["demo-fallback"],
  };
  assert.equal(await context.translateText("source", settings), "translated");
  assert.equal(await context.translateText("source", settings), "translated");
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 2);
});

test("parallel non-Gemini translations reserve separate model-key slots", async () => {
  const context = vm.createContext({
    console,
    TB: { PROVIDERS: { GEMINI: "gemini", GROQ: "groq" } },
  });
  vm.runInContext(source, context);
  const keys = [];
  const releases = [];
  context.callGroqAPI = (key) => {
    keys.push(key);
    return new Promise((resolve) => releases.push(resolve));
  };
  const settings = { groqModels: ["demo"], groqApiKeys: ["first", "second"] };
  const first = context.callAIsByProvider("groq", "demo", settings, "source", null, () => "prompt");
  const second = context.callAIsByProvider(
    "groq",
    "demo",
    settings,
    "source",
    null,
    () => "prompt"
  );
  assert.deepEqual(keys, ["first", "second"]);
  releases.forEach((resolve) => resolve("translated"));
  await Promise.all([first, second]);
});

test("structured provider errors stay readable and redact credential values", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const message = context.sanitizeErrorMessage(
    JSON.stringify({ error: { code: "invalid", token: "demo-secret" } }),
    400
  );
  assert.match(message, /Error 400/);
  assert.doesNotMatch(message, /demo-secret/);
});

test("providers reject truncated translations instead of returning partial notes", async () => {
  for (const provider of ["Gemini", "Cerebras", "Groq", "OpenRouter"]) {
    const context = vm.createContext({
      console,
      TB: { PROMPTS: { SYSTEM: "Translate", USER: () => "Translate" } },
      timeoutFetch: async () => ({ ok: true }),
      safeReadJson: async () => ({
        candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "partial" }] } }],
        choices: [{ finish_reason: "length", message: { content: "partial" } }],
      }),
    });
    vm.runInContext(source, context);
    await assert.rejects(
      context[`call${provider}API`]("demo-key", "long source", "demo-model"),
      /cut off/
    );
  }
});

test("normalizeTranslationOutput removes prompt boundary markers from AI output", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = ["[BẮT ĐẦU]", "Nội dung dịch tiếng Việt", "[KẾT THÚC]"].join("\n");

  assert.equal(normalizeTranslationOutput(raw), "Nội dung dịch tiếng Việt");
});

test("normalizeTranslationOutput keeps Vietnamese sentences that contain start/end words", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = "Chúng ta bắt đầu kiểm tra và kết thúc sau khi deploy.";

  assert.equal(normalizeTranslationOutput(raw), raw);
});

test("normalizeTranslationOutput removes prompt boundary markers in the middle of content", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = ["Dòng đầu", "[BẮT ĐẦU]", "Dòng giữa", "[KẾT THÚC]", "Dòng cuối"].join("\n");

  assert.equal(normalizeTranslationOutput(raw), "Dòng đầu\nDòng giữa\nDòng cuối");
});

test("normalizeTranslationOutput decodes HTML-escaped angle brackets outside code", () => {
  const normalizeTranslationOutput = createNormalizer();
  assert.equal(
    normalizeTranslationOutput("flow_guide/display/&lt;flow_guide_id&gt;"),
    "flow_guide/display/<flow_guide_id>"
  );
  assert.equal(
    normalizeTranslationOutput("keep `&lt;code&gt;` literal"),
    "keep `&lt;code&gt;` literal"
  );
});

test("Gemini retry reports status through the current request callback", async () => {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    TB: { PROVIDERS: { GEMINI: "gemini" }, GEMINI_MODELS: [] },
  });
  vm.runInContext(source, context);
  vm.runInContext(
    `let demoCalls = 0;
    callGeminiAPI = async () => {
      if (demoCalls++ === 0) throw new Error("429 rate limit");
      return "translated";
    };
    this.runDemoRetry = (onStatus) => callAIsByProvider(
      "gemini", "demo-model",
      { geminiModels: ["demo-model"], geminiApiKeys: ["first", "second"] },
      "source", null, () => "prompt", onStatus
    );`,
    context
  );
  const phases = [];
  const result = await context.runDemoRetry((status) => phases.push(status.phase));
  assert.equal(result, "translated");
  assert.deepEqual(phases, ["retry"]);
});

test("AI status reporter targets only the requesting tab and frame", async () => {
  const background = fs.readFileSync(path.join(__dirname, "..", "src", "background.js"), "utf8");
  const start = background.indexOf("function createAIStatusReporter(sender)");
  const end = background.indexOf("async function handleRedmineAuthorizedFetch", start);
  assert.ok(start >= 0 && end > start);
  const sent = [];
  const context = vm.createContext({
    chrome: {
      tabs: {
        sendMessage(tabId, message, options) {
          sent.push({ tabId, message, options });
          return Promise.resolve();
        },
      },
    },
  });
  vm.runInContext(
    `${background.slice(start, end)}\nthis.createReporter = createAIStatusReporter;`,
    context
  );
  context.createReporter({ tab: { id: 12 }, frameId: 0 })({ phase: "retry" });
  context.createReporter({ tab: { id: 25 }, frameId: 3 })({ phase: "success" });
  assert.deepEqual(
    sent.map((item) => [item.tabId, item.options.frameId, item.message.status.phase]),
    [
      [12, 0, "retry"],
      [25, 3, "success"],
    ]
  );
});
