const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "version.js"),
  "utf8"
);

function createVersionContext(fetch) {
  const context = vm.createContext(fetch ? { fetch } : {});
  vm.runInContext(source, context);
  return context;
}

const { TB_VERSION } = createVersionContext();

test("compares versions with different segment lengths", () => {
  assert.equal(TB_VERSION.compare("1.8.08", "1.8.8"), 0);
  assert.equal(TB_VERSION.compare("1.8.8", "1.9.0"), -1);
  assert.equal(TB_VERSION.compare("2.0", "1.99.99"), 1);
});

test("rejects invalid version values", () => {
  assert.equal(TB_VERSION.isValid("1.8.08"), true);
  assert.equal(TB_VERSION.isValid("1.8.beta"), false);
  assert.equal(TB_VERSION.isValid(undefined), false);
  assert.throws(() => TB_VERSION.compare("1.8", "latest"), /numeric dot-separated/);
});

test("fetches latest version from GitHub releases when backend routes are unavailable", async () => {
  const calls = [];
  const { TB_VERSION: versionHelpers } = createVersionContext(async (url) => {
    calls.push(url);

    if (url.endsWith("/versions/latest") || url.endsWith("/versions")) {
      return { ok: false, status: 404 };
    }

    return {
      ok: true,
      json: async () => ({
        tag_name: "v1.8.10",
        name: "Backlog2Redmine v1.8.10",
        body: "Release notes",
        html_url: "https://github.com/conghiep1997/b2r/releases/tag/v1.8.10",
        published_at: "2026-07-07T00:00:00.000Z",
        assets: [
          {
            name: "Backlog2Redmine-v1.8.10.zip",
            browser_download_url:
              "https://github.com/conghiep1997/b2r/releases/download/v1.8.10/Backlog2Redmine-v1.8.10.zip",
          },
        ],
      }),
    };
  });

  const latest = await versionHelpers.fetchLatest();

  assert.deepEqual(calls, [
    "https://dev-tool-platform-api.onrender.com/api/versions/latest",
    "https://dev-tool-platform-api.onrender.com/api/versions",
    "https://api.github.com/repos/conghiep1997/b2r/releases/latest",
  ]);
  assert.equal(latest.version_number, "1.8.10");
  assert.match(latest.download_url, /Backlog2Redmine-v1\.8\.10\.zip$/);
});

test("uses newest valid backend version when latest route is unavailable", async () => {
  const { TB_VERSION: versionHelpers } = createVersionContext(async (url) => {
    if (url.endsWith("/versions/latest")) {
      return { ok: false, status: 404 };
    }

    return {
      ok: true,
      json: async () => ({
        versions: [
          { version_number: "1.8.09" },
          { version_number: "1.8.10" },
          { version_number: "draft" },
        ],
      }),
    };
  });

  const latest = await versionHelpers.fetchLatest();

  assert.equal(latest.version_number, "1.8.10");
});

test("invalid or malformed successful backend responses do not suppress GitHub fallback", async () => {
  for (const malformedJson of [false, true]) {
    const { TB_VERSION: helpers } = createVersionContext(async (url) => {
      if (url.includes("api.github.com")) {
        return { ok: true, json: async () => ({ tag_name: "v1.9.0" }) };
      }
      return {
        ok: true,
        json: async () => {
          if (malformedJson) throw new SyntaxError("Invalid JSON");
          return url.endsWith("/latest")
            ? { version_number: "draft" }
            : [{ is_latest: true, version_number: "draft" }];
        },
      };
    });
    assert.equal((await helpers.fetchLatest()).version_number, "1.9.0");
  }
});
