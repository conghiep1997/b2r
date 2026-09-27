const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "crypto.js"),
  "utf8"
);

test("concurrent first-save credentials decrypt after the extension reloads", async () => {
  const storage = {};
  let storageIdWrites = 0;
  const createContext = () => {
    const context = vm.createContext({
      crypto: webcrypto,
      TextEncoder,
      TextDecoder,
      btoa,
      atob,
      console,
      chrome: {
        storage: {
          local: {
            get(_keys, callback) {
              const snapshot = { ...storage };
              setImmediate(() => callback(snapshot));
            },
            set(values, callback) {
              storageIdWrites++;
              Object.assign(storage, values);
              setImmediate(callback);
            },
          },
        },
      },
    });
    vm.runInContext(source, context);
    return context;
  };
  const first = createContext();
  const values = ["demo-redmine-key", "demo-backlog-key", "demo-ai-key"];
  const encrypted = await Promise.all(values.map((value) => first.encryptData(value)));
  assert.equal(storageIdWrites, 1);
  const reloaded = createContext();
  const decrypted = await Promise.all(encrypted.map((value) => reloaded.decryptData(value)));
  assert.deepEqual(decrypted, values);
});
