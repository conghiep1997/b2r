const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("encryptData round-trips payloads larger than the call-stack spread limit", async () => {
  const store = {};
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    crypto: globalThis.crypto,
    btoa,
    atob,
    console: { ...console, error() {} },
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => cb({ tb_storage_id: "test-id" }),
          set: (values, cb) => cb?.(Object.assign(store, values)),
        },
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "src", "modules", "utils", "crypto.js"), "utf8") +
      "\nthis.encryptData = encryptData; this.decryptData = decryptData;",
    context
  );
  const plaintext = "あ".repeat(150000);
  const encrypted = await context.encryptData(plaintext);
  assert.equal(await context.decryptData(encrypted), plaintext);
});
