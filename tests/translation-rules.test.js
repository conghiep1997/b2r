const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function setup() {
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync("src/modules/constants/prompts.js", "utf8"), context);
  context.TB = { PROMPTS: context.TB_PROMPTS, PROVIDERS: { NONE: "none" } };
  vm.runInContext(fs.readFileSync("src/modules/services/ai.js", "utf8"), context);
  return context;
}

test("translation defaults preserve Vietnamese translation and Japanese reverse extraction", () => {
  const context = setup();
  const rules = context.TB_PROMPTS.TRANSLATION;
  assert.match(rules.prompt().system, /into Vietnamese/);
  assert.match(rules.prompt(undefined, true).system, /original Japanese passages/);
  assert.throws(() => rules.normalize({ target: "auto" }), /language/);
  assert.throws(() => rules.normalize({ reverseTarget: "unknown" }), /language/);
  assert.throws(() => rules.normalize({ reverseMode: "invalid" }), /mode/);
});

test("each provider receives the selected language instruction and comment attribution", async () => {
  const context = setup();
  const rules = {
    source: "ja",
    target: "en",
    reverseMode: "translate",
    reverseSource: "vi",
    reverseTarget: "ja",
  };
  const prompt = context.TB_PROMPTS.TRANSLATION.prompt(rules, false, true);
  context.extractCleanedTranslation = (text) => text;
  context.formatTranslation = (_original, text, url) => `${url}:${text}`;
  context.safeReadJson = (response) => response.json();
  const payloads = [];
  context.timeoutFetch = async (_url, options) => {
    payloads.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "translated" }] } }],
        choices: [{ message: { content: "translated" } }],
      }),
    };
  };
  for (const [provider, model] of [
    ["Gemini", "gemini"],
    ["Gemini", "gemma"],
    ["Groq", "model"],
    ["Cerebras", "model"],
    ["OpenRouter", "model"],
  ]) {
    const result = await context[`call${provider}API`](
      "fixture",
      "source",
      model,
      prompt,
      "source-url"
    );
    assert.equal(result, "translated");
    const payload = payloads.at(-1);
    const system =
      payload.system_instruction?.parts[0].text ||
      payload.messages?.[0].content ||
      payload.contents[0].parts[0].text;
    assert.match(system, /from Japanese into English/);
    assert.doesNotMatch(system, /into Vietnamese/);
  }
  assert.match(
    context.TB_PROMPTS.TRANSLATION.prompt(rules, true).system,
    /from Vietnamese into Japanese/
  );
});

test("original reverse mode preserves all text and makes no AI or glossary requests", async () => {
  const context = setup();
  context.TB_GLOSSARY = {
    prepare() {
      throw new Error("Unexpected glossary request");
    },
  };
  context.callAIsByProvider = () => {
    throw new Error("Unexpected AI request");
  };
  const text = "Original <id> [[TB_FILE:1:file.txt]]";
  assert.equal(
    await context.translateText(
      text,
      {},
      null,
      context.TB_PROMPTS.TRANSLATION.prompt({ reverseMode: "original" }, true)
    ),
    text
  );
});
