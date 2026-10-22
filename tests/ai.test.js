const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "ai.js"),
  "utf8"
);

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

test("translation applies project terminology to both providers and restores before success", async () => {
  const calls = [];
  const statuses = [];
  const context = vm.createContext({
    console: { warn() {} },
    TB: {
      PROVIDERS: { NONE: "none" },
      PROMPTS: { USER: (text) => text },
      MESSAGES: { TOAST: { RATE_LIMIT_FAILED: "failed" } },
    },
    TB_GLOSSARY: {
      async prepare(_settings, project, text, prompt) {
        assert.equal(project, "DEMO");
        assert.equal(text, "original");
        return {
          text: "protected",
          prompt: (value) => `Glossary: ${prompt(value)}`,
          restore: (output) => output.replace("protected", "original"),
        };
      },
    },
    record: (provider, text, prompt) => {
      calls.push({ provider, text, prompt });
      if (calls.length === 1) throw Object.assign(new Error("rate limit"), { status: 429 });
      return text;
    },
  });
  vm.runInContext(
    source +
      "\ncallAIsByProvider = async (provider, _model, _settings, text, _url, prompt) => record(provider, text, prompt(text)); isRetryableProviderError = () => true;",
    context
  );
  const output = await context.translateText(
    "original",
    {
      primaryProvider: "groq",
      primaryModel: "primary",
      fallbackProvider: "cerebras",
      fallbackModel: "fallback",
    },
    null,
    (text) => `Translate ${text}`,
    (status) => statuses.push(status),
    "DEMO"
  );
  assert.equal(output, "original");
  assert.deepEqual(
    calls.map(({ text, prompt }) => [text, prompt]),
    [
      ["protected", "Glossary: Translate protected"],
      ["protected", "Glossary: Translate protected"],
    ]
  );
  assert.equal(statuses.at(-1).phase, "success");
  assert.equal(statuses.at(-1).provider, "cerebras");
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

test("Gemini 429 cools down only the model/key combination and reuses the successful slot", async () => {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    TB: { PROVIDERS: { GEMINI: "gemini" }, GEMINI_MODELS: [] },
    Math,
  });
  vm.runInContext(source, context);
  vm.runInContext(
    `const demoCalls = [];
    callGeminiAPI = async (_key, _text, model) => {
      demoCalls.push(model);
      if (model === "limited") throw Object.assign(new Error("429 rate limit"), { status: 429 });
      return "translated";
    };
    this.runDemo = () => callAIsByProvider(
      "gemini", "limited",
      { geminiModels: ["limited", "healthy"], geminiApiKeys: ["one"] },
      "source", null, () => "prompt"
    );
    this.demoCalls = demoCalls;`,
    context
  );
  assert.equal(await context.runDemo(), "translated");
  assert.equal(await context.runDemo(), "translated");
  assert.deepEqual(Array.from(context.demoCalls), ["limited", "healthy", "healthy"]);
});

test("provider failover advances only after success and retries model-specific failures", async () => {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    TB: { PROVIDERS: { GROQ: "groq" }, GROQ_MODELS: [] },
  });
  vm.runInContext(source, context);
  vm.runInContext(
    `const demoCalls = [];
    callGroqAPI = async (_key, _text, model) => {
      demoCalls.push(model);
      if (model === "bad") throw Object.assign(new Error("model not found"), { status: 404 });
      return "translated";
    };
    this.runDemo = () => callAIsByProvider(
      "groq", "bad",
      { groqModels: ["bad", "good"], groqApiKeys: ["one"] },
      "source", null, () => "prompt"
    );
    this.demoCalls = demoCalls;`,
    context
  );
  assert.equal(await context.runDemo(), "translated");
  assert.deepEqual(Array.from(context.demoCalls), ["bad", "good"]);
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
