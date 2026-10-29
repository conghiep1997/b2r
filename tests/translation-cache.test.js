const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const cacheSource = fs.readFileSync("src/modules/services/translation-cache.js", "utf8");
const aiSource = fs.readFileSync("src/modules/services/ai.js", "utf8");

test("translation cache stores and retrieves cached values", async () => {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
      },
    },
  });
  vm.runInContext(cacheSource, context);
  const cache = context.TB_TRANSLATION_CACHE;

  assert.equal(await cache.get("Xin chào", "vi", "ja", "PROJ", false), null);

  await cache.set("Xin chào", "vi", "ja", "PROJ", false, "こんにちは");
  assert.equal(await cache.get("Xin chào", "vi", "ja", "PROJ", false), "こんにちは");

  // Differentiates languages
  assert.equal(await cache.get("Xin chào", "vi", "en", "PROJ", false), null);

  // Differentiates projects
  assert.equal(await cache.get("Xin chào", "vi", "ja", "OTHER_PROJ", false), null);

  // Differentiates reverse flag
  assert.equal(await cache.get("Xin chào", "vi", "ja", "PROJ", true), null);
});

test("translation cache evicts oldest entry when reaching capacity", async () => {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
      },
    },
  });
  vm.runInContext(cacheSource, context);
  const cache = context.TB_TRANSLATION_CACHE;

  // Insert 100 entries
  for (let i = 0; i < 100; i++) {
    await cache.set(`text-${i}`, "ja", "vi", "", false, `dich-${i}`);
  }
  assert.equal(cache.size(), 100);
  assert.equal(await cache.get("text-0", "ja", "vi", "", false), "dich-0");

  // Insert 101st entry
  await cache.set("text-100", "ja", "vi", "", false, "dich-100");
  assert.equal(cache.size(), 100);

  // Oldest unaccessed entry (text-1) should have been evicted (since text-0 was accessed above)
  assert.equal(await cache.get("text-1", "ja", "vi", "", false), null);
  assert.equal(await cache.get("text-0", "ja", "vi", "", false), "dich-0");
  assert.equal(await cache.get("text-100", "ja", "vi", "", false), "dich-100");
});

test("translation cache clear empties all entries", async () => {
  let storageRemoved = false;
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {
            storageRemoved = true;
          },
        },
      },
    },
  });
  vm.runInContext(cacheSource, context);
  const cache = context.TB_TRANSLATION_CACHE;

  await cache.set("hello", "en", "vi", "", false, "xin chào");
  assert.equal(cache.size(), 1);

  await cache.clear();
  assert.equal(cache.size(), 0);
  assert.equal(await cache.get("hello", "en", "vi", "", false), null);
  assert.equal(storageRemoved, true);
});

test("translateText uses cached translation to respond in 0ms without provider call", async () => {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    TB: {
      PROVIDERS: { GEMINI: "gemini", GROQ: "groq" },
      PROMPTS: {
        USER: (text) => text,
        SIMPLE_TRANSLATE: (text) => text,
        TRANSLATION: {
          normalize: (rules) => rules,
          prompt: () => (text) => text,
        },
        resolveLanguagePair: () => ({ source: "ja", target: "vi" }),
      },
      DEFAULT_PRIMARY_PROVIDER: "gemini",
      DEFAULT_PRIMARY_MODEL: "gemini-2.0-flash",
      DEFAULT_FALLBACK_PROVIDER: "groq",
      DEFAULT_FALLBACK_MODEL: "llama3",
    },
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
      },
    },
  });
  vm.runInContext(cacheSource, context);
  vm.runInContext(aiSource, context);

  let providerCalls = 0;
  context.callAIsByProvider = async () => {
    providerCalls++;
    return "bản dịch từ AI";
  };

  const statuses = [];
  const onStatus = (status) => statuses.push(status);
  const settings = {
    primaryProvider: "gemini",
    primaryModel: "gemini-2.0-flash",
    translationSourceLanguage: "ja",
    translationTargetLanguage: "vi",
  };

  // First call - should call provider
  const result1 = await context.translateText("Konnichiwa", settings, null, undefined, onStatus);
  assert.equal(result1, "bản dịch từ AI");
  assert.equal(providerCalls, 1);

  // Second call with same text - should hit cache
  statuses.length = 0;
  const result2 = await context.translateText("Konnichiwa", settings, null, undefined, onStatus);
  assert.equal(result2, "bản dịch từ AI");
  assert.equal(providerCalls, 1); // Not incremented!
  assert.equal(statuses[0]?.cached, true);
  assert.equal(statuses[0]?.provider, "cache");

  // Third call with bypassCache: true - should call provider again
  const result3 = await context.translateText(
    "Konnichiwa",
    { ...settings, bypassCache: true },
    null,
    undefined,
    onStatus
  );
  assert.equal(result3, "bản dịch từ AI");
  assert.equal(providerCalls, 2);
});
