const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function loader(fetch) {
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync("src/modules/utils/helpers.js", "utf8"), context);
  return context.timeoutFetch;
}

test("request deadline aborts stalled response headers", async () => {
  let signal;
  const fetch = loader((url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  });
  await assert.rejects(fetch("https://test.example", {}, 15), /timeout after 15ms/);
  assert.equal(signal.aborted, true);
});

test("response body readers share the request deadline and abort a stalled body", async () => {
  let signal;
  const fetch = loader(async (url, options) => {
    signal = options.signal;
    return { status: 200, json: () => new Promise(() => {}) };
  });
  const response = await fetch("https://test.example", {}, 15);
  assert.equal(response.status, 200);
  await assert.rejects(response.json(), /timeout after 15ms/);
  assert.equal(signal.aborted, true);
});

test("external cancellation is preserved while waiting for a response body", async () => {
  const external = new AbortController();
  const fetch = loader(async () => ({ text: () => new Promise(() => {}) }));
  const response = await fetch("https://test.example", { signal: external.signal }, 1000);
  const reading = response.text();
  external.abort();
  await assert.rejects(reading, (error) => error.name === "AbortError");
});

test("pre-cancelled requests do not start the network operation", async () => {
  let called = false;
  const external = new AbortController();
  external.abort();
  const fetch = loader(async () => {
    called = true;
  });
  await assert.rejects(
    fetch("https://test.example", { signal: external.signal }, 1000),
    (error) => error.name === "AbortError"
  );
  assert.equal(called, false);
});
