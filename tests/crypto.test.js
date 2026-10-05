const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const test = require("node:test");

const source = fs.readFileSync("src/modules/utils/crypto.js", "utf8");

function worker(storage) {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
    console,
    chrome: {
      runtime: {},
      storage: {
        local: {
          get(keys, callback) {
            const snapshot = { ...storage };
            setImmediate(() => callback(snapshot));
          },
          set(items, callback) {
            Object.assign(storage, items);
            setImmediate(callback);
          },
        },
      },
    },
  });
  vm.runInContext(source, context);
  return context;
}

test("concurrent first-save keys survive worker restart and have unique IVs", async () => {
  const storage = {};
  const first = worker(storage);
  const values = ["redmine-test", "backlog-test", "provider-test"];
  const encrypted = await Promise.all(values.map((value) => first.encryptData(value)));
  const restarted = worker(storage);
  assert.deepEqual(
    await Promise.all(encrypted.map((value) => restarted.decryptData(value))),
    values
  );
  assert.notEqual(await first.encryptData("same"), await first.encryptData("same"));
});

test("two options contexts obtain their installation ID from the same background", async () => {
  const storage = {};
  const background = worker(storage);
  const options = () => {
    const context = worker(storage);
    context.window = {};
    context.chrome.runtime.sendMessage = async (message) => {
      assert.equal(message.type, "GET_CRYPTO_STORAGE_ID");
      return { ok: true, data: await background.getUserStorageId() };
    };
    return context;
  };
  const encrypted = await Promise.all([options().encryptData("one"), options().encryptData("two")]);
  const restarted = worker(storage);
  assert.deepEqual(await Promise.all(encrypted.map((value) => restarted.decryptData(value))), [
    "one",
    "two",
  ]);
});

test("existing encrypted settings retain their storage ID", async () => {
  const storage = { tb_storage_id: "existing-installation" };
  const context = worker(storage);
  const value = await context.encryptData("legacy-key");
  assert.equal(storage.tb_storage_id, "existing-installation");
  assert.equal(await worker(storage).decryptData(value), "legacy-key");
});
