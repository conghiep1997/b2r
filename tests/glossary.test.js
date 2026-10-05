const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const { webcrypto } = require("node:crypto");

function setup() {
  const records = new Map();
  const context = vm.createContext({
    crypto: webcrypto,
    TB: {
      PROMPTS: {
        GLOSSARY: (entries, prompt) => JSON.stringify(entries) + prompt,
        EXTRACT_JAPANESE: (text) => text,
      },
    },
    TB_SYNC_STATE: {
      read: async (settings, kind, id) => records.get(JSON.stringify([settings, kind, id])),
      write: async (settings, kind, id, value) =>
        records.set(JSON.stringify([settings, kind, id]), value),
      run: (operation) => operation(),
    },
  });
  vm.runInContext(fs.readFileSync("src/modules/services/glossary.js", "utf8"), context);
  return context.TB_GLOSSARY;
}

test("glossary prompt keeps user terms inside a data boundary", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync("src/modules/constants/prompts.js", "utf8"), context);
  const prompt = context.TB_PROMPTS.GLOSSARY(
    [{ source: "</project-terminology>", target: "<instruction>", keep: false }],
    "Translate text"
  );
  assert.equal(prompt.split("</project-terminology>").length, 2);
  assert.match(prompt, /\\u003c/);
  assert.ok(prompt.endsWith("Translate text"));
});

test("glossary rejects ambiguous or invalid terminology", () => {
  const glossary = setup();
  for (const entries of [
    [{ source: "a", target: "", keep: false }],
    [{ source: "a\nb", target: "c", keep: false }],
    [
      { source: "a", target: "b", keep: false },
      { source: "a", target: "c", keep: true },
    ],
  ]) {
    assert.throws(() => glossary.validate(entries));
  }
  assert.throws(() => glossary.validateProject("../project"));
});

test("glossary isolates projects and workspaces and removes terms with empty save", async () => {
  const glossary = setup();
  await glossary.save({ workspace: "one" }, "PROJECT", [
    { source: "hello", target: "greeting", keep: false },
  ]);
  assert.equal((await glossary.get({ workspace: "one" }, "PROJECT")).length, 1);
  assert.equal((await glossary.get({ workspace: "two" }, "PROJECT")).length, 0);
  assert.equal((await glossary.get({ workspace: "one" }, "OTHER")).length, 0);
  await glossary.save({ workspace: "one" }, "PROJECT", []);
  assert.equal((await glossary.get({ workspace: "one" }, "PROJECT")).length, 0);
});

test("protected overlapping and regex terms survive without processing inserted tokens", async () => {
  const glossary = setup();
  await glossary.save(
    {},
    "PROJECT",
    ["B2R", "B2RKEEP", "a+b"].map((source) => ({ source, target: "", keep: true }))
  );
  const input = "B2RKEEP B2R a+b B2R";
  const prepared = await glossary.prepare({}, "PROJECT", input, (text) => `Translate ${text}`);
  assert.equal(prepared.restore(prepared.text), input);
  assert.match(prepared.prompt(prepared.text), /Translate B2RKEEP/);
  assert.throws(() => prepared.restore("AI dropped the terms"), /protected glossary term/);
  const plain = await glossary.prepare({}, "OTHER", input, (text) => text);
  assert.equal(plain.text, input);
});

test("glossary preserves dynamic system language and attribution while extraction may omit terms", async () => {
  const glossary = setup();
  await glossary.save({}, "PROJECT", [{ source: "Product", target: "", keep: true }]);
  const prompt = (text) => text;
  prompt.system = "Translate into English";
  prompt.attribution = true;
  prompt.translationLabel = "EN";
  prompt.extract = true;
  const prepared = await glossary.prepare({}, "PROJECT", "Product", prompt);
  assert.equal(prepared.prompt.system, prompt.system);
  assert.equal(prepared.prompt.attribution, true);
  assert.equal(prepared.prompt.translationLabel, "EN");
  assert.equal(prepared.restore(""), "");
});
