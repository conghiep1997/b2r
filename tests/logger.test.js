const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "logger.js"),
  "utf8"
);
const context = vm.createContext({ console });
vm.runInContext(source, context);

test("sanitizes secrets from log fields and context", () => {
  const sanitized = context.TB_LOGGER.sanitizeLogEntry({
    timestamp: "now",
    source: "Background",
    message: "timeout https://example.test?key=secret-value&model=x",
    stack: "Authorization: Bearer secret-token",
    context: {
      apiKey: "secret-value",
      nested: { token: "secret-token", safe: "visible" },
    },
  });

  assert.equal(sanitized.message.includes("secret-value"), false);
  assert.equal(sanitized.stack.includes("secret-token"), false);
  assert.equal(sanitized.context.apiKey, "[REDACTED]");
  assert.equal(sanitized.context.nested.token, "[REDACTED]");
  assert.equal(sanitized.context.nested.safe, "visible");
});

test("limits oversized log fields", () => {
  const sanitized = context.TB_LOGGER.sanitizeLogEntry({ message: "x".repeat(20000) });
  assert.equal(sanitized.message.length, 10000);
});
test("sanitizes existing log collections", () => {
  const logs = context.TB_LOGGER.sanitizeLogEntries([
    { message: "https://example.test?apiKey=old-secret" },
  ]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].message.includes("old-secret"), false);
});

test("worker logs persist locally and concurrent writes do not lose entries", async () => {
  let storage = {};
  const worker = vm.createContext({
    console,
    chrome: {
      runtime: {
        sendMessage() {
          throw new Error("Worker must not message itself");
        },
      },
      storage: {
        local: {
          async get() {
            return structuredClone(storage);
          },
          async set(values) {
            storage = structuredClone(values);
          },
          async remove() {
            storage = {};
          },
        },
      },
    },
  });
  vm.runInContext(source, worker);
  await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      worker.TB_LOGGER.logError("Background", `failure ${index}`)
    )
  );
  assert.equal(storage.errorLogs.length, 10);
  assert.equal(new Set(storage.errorLogs.map((entry) => entry.message)).size, 10);
  await worker.TB_LOGGER.clearLogs();
  assert.equal((await worker.TB_LOGGER.getLogs()).length, 0);
});
