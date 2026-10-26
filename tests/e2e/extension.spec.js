const { test, expect, chromium } = require("@playwright/test");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const extensionPath = path.join(__dirname, "..", "..", "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));
let server;
let baseUrl;
let browser;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, baseUrl || "http://127.0.0.1").pathname;
    if (pathname === "/view/DEMO-1") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(`<!doctype html><html><body>
        <h1><span data-testid="issueKey">DEMO-1</span><span data-testid="issueSummary">Demo issue</span></h1>
        <div class="title-group__edit-actions"></div>
        <section class="comments"><article class="comment-item">
          <div class="comment-item__content">Sample comment</div>
          <div class="comment-item__actions"></div>
        </article><article class="comment-item">
          <div class="comment-item__content">Second sample comment</div>
          <div class="comment-item__actions"></div>
        </article></section>
      </body></html>`);
      return;
    }
    if (pathname === "/issues/123") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(`<!doctype html><html><body><div id="content"><h2>DEMO-1 - Demo issue</h2>
        <div id="history"><div class="journal"><div class="wiki">Sample Redmine note</div>
        <div class="contextual"><a class="icon-comment" href="#">Quote</a></div></div></div>
        </div></body></html>`);
      return;
    }

    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
    const filePath = path.join(extensionPath, relativePath || "src/popup.html");
    if (!filePath.startsWith(extensionPath)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, contents) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      const extension = path.extname(filePath);
      const contentType =
        extension === ".html"
          ? "text/html"
          : extension === ".js"
            ? "text/javascript"
            : extension === ".json"
              ? "application/json"
              : extension === ".css"
                ? "text/css"
                : "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType });
      response.end(contents);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function openPage(pathname) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    if (!localStorage.getItem("b2rTestStorage")) localStorage.setItem("b2rTestStorage", "{}");
    const read = (keys) => {
      const all = JSON.parse(localStorage.getItem("b2rTestStorage") || "{}");
      if (keys == null) return all;
      if (typeof keys === "string") return { [keys]: all[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, all[key]]));
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [key, all[key] ?? fallback])
      );
    };
    const onChanged = new Set();
    const runtimeListeners = new Set();
    window.__mockRequests = [];
    window.__mockSendCount = 0;
    window.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = read(keys);
            if (callback) queueMicrotask(() => callback(result));
            return Promise.resolve(result);
          },
          set(items, callback) {
            if (window.__mockActivityStorageFailure && items.syncActivity) {
              return Promise.reject(new Error("Demo activity storage failure"));
            }
            const all = read(null);
            const changes = Object.fromEntries(
              Object.entries(items).map(([key, newValue]) => [
                key,
                { oldValue: all[key], newValue },
              ])
            );
            Object.assign(all, items);
            localStorage.setItem("b2rTestStorage", JSON.stringify(all));
            onChanged.forEach((listener) => listener(changes, "local"));
            if (callback) queueMicrotask(callback);
            return Promise.resolve();
          },
          remove(keys, callback) {
            const all = read(null);
            const changes = {};
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              changes[key] = { oldValue: all[key] };
              delete all[key];
            }
            localStorage.setItem("b2rTestStorage", JSON.stringify(all));
            onChanged.forEach((listener) => listener(changes, "local"));
            if (callback) queueMicrotask(callback);
            return Promise.resolve();
          },
        },
        onChanged: { addListener: (listener) => onChanged.add(listener) },
      },
      runtime: {
        id: "e2e-mock-extension",
        lastError: null,
        onMessage: { addListener: (listener) => runtimeListeners.add(listener) },
        __emit(message) {
          runtimeListeners.forEach((listener) => listener(message, {}, () => {}));
        },
        getManifest: () => ({ version: "1.8.16" }),
        getURL: (path) => `${location.origin}/${path}`,
        openOptionsPage() {},
        sendMessage(message, callback) {
          window.__mockRequests.push(message);
          if (["RECORD_SYNC_ACTIVITY", "CLEAR_SYNC_ACTIVITY"].includes(message?.type)) {
            const operation =
              message.type === "RECORD_SYNC_ACTIVITY"
                ? globalThis.TB_SYNC_ACTIVITY.record(message.entry)
                : globalThis.TB_SYNC_ACTIVITY.clear();
            const response = operation.then(
              () => ({ ok: true }),
              (error) => ({ ok: false, error: error.message })
            );
            if (callback) response.then(callback);
            return response;
          }
          let response = { ok: false, error: "No mocked response." };
          if (message?.type === "TEST_BACKLOG_CONNECTION") {
            response = { ok: true, data: { userName: "Demo User" } };
          } else if (message?.type === "TEST_MODEL_WITH_KEY") {
            response = { ok: true, data: { ok: true, message: "Model is responsive." } };
          } else if (message?.type === "FETCH_REDMINE_PROJECTS_WITH_KEY") {
            response = { ok: true, data: [{ id: 1, name: `Project ${message.apiKey}` }] };
          } else if (message?.type === "GET_UI_SETTINGS") {
            response = { ok: true, data: { defaultProjectId: "1", showRedmineSuccessModal: true } };
          } else if (message?.type === "FETCH_REDMINE_METADATA") {
            const endpoint = message.endpoint || "";
            const data = endpoint.includes("projects.json")
              ? { projects: [{ id: 1, name: "Demo Project" }] }
              : endpoint.includes("trackers.json")
                ? { trackers: [{ id: 2, name: "Task" }] }
                : endpoint.includes("issue_priorities.json")
                  ? { issue_priorities: [{ id: 2, name: "Normal", is_default: true }] }
                  : endpoint.includes("/issues/")
                    ? { issue: { subject: "Demo issue" } }
                    : { versions: [] };
            response = { ok: true, data };
          } else if (message?.type === "LOOKUP_AND_TRANSLATE_COMMENT") {
            response = {
              ok: true,
              data: {
                redmineIssueId: "123",
                issueTitle: "Demo issue",
                previewText: "Translated demo comment",
              },
            };
          } else if (message?.type === "TRANSLATE_COMMENT_FULL") {
            response = { ok: true, data: { translatedText: "Second translated comment" } };
          } else if (message?.type === "TRANSLATE_TEXT_SIMPLE") {
            response = { ok: true, data: { translatedText: "Translated title" } };
          } else if (message?.type === "CREATE_REDMINE_ISSUE") {
            response = {
              ok: true,
              data: {
                redmineUrl: "https://redmine.example.invalid/issues/456",
                migratedCommentCount: 1,
                failedCommentCount: 1,
                failedComments: [{ index: 2, message: "Demo send failure" }],
              },
            };
          } else if (message?.type === "SEND_TO_REDMINE") {
            window.__mockSendCount++;
            response =
              (window.__mockFailSecondSend && window.__mockSendCount === 2) ||
              (window.__mockFailSendNumbers || []).includes(window.__mockSendCount)
                ? { ok: false, error: "Demo send failure" }
                : {
                    ok: true,
                    data: {
                      redmineUrl: `https://redmine.example.invalid/issues/${message.redmineIssueId}`,
                    },
                  };
          } else if (message?.type === "EXTRACT_JAPANESE_CONTENT") {
            response = { ok: true, data: { previewText: "Extracted demo content" } };
          } else if (message?.type === "GET_BACKLOG_ISSUE_INFO") {
            response = { ok: true, data: { summary: "Demo issue" } };
          } else if (message?.type === "SEND_TO_BACKLOG") {
            response = window.__mockFailBacklogSend
              ? { ok: false, error: "Demo Backlog failure" }
              : { ok: true, data: { backlogUrl: "https://demo.backlog.com/view/DEMO-1" } };
          }
          if (callback) queueMicrotask(() => callback(response));
          return Promise.resolve(response);
        },
      },
      i18n: { getMessage: () => "" },
      tabs: { create() {}, query: async () => [] },
      permissions: { request: async () => true, remove: async () => true },
      scripting: {
        registerContentScripts: async () => {},
        unregisterContentScripts: async () => {},
        executeScript: async () => [],
      },
    };
  });
  await page.goto(`${baseUrl}/${pathname}`);
  await page.addScriptTag({ url: `${baseUrl}/src/modules/utils/sync-activity.js` });
  return page;
}

async function injectContentScriptFiles(page, registration) {
  for (const script of registration.js) {
    await page.addScriptTag({ url: `${baseUrl}/${script}` });
  }
}

test("Popup and Options render the selected locale and onboarding", async () => {
  const popup = await openPage("src/popup.html");
  await expect(popup.getByText("Open full settings")).toBeVisible();

  const options = await openPage("src/options.html");
  await expect(options.locator("#onboardingCard")).toBeVisible();
  await expect(options.locator("label[for='languagePreference']")).toHaveText("Language");
  await expect(options.locator("#translationSourceLanguage")).toHaveValue("ja");
  await expect(options.locator("#translationTargetLanguage")).toHaveValue("vi");
  await options.locator("#translationSourceLanguage").selectOption("fr");
  await options.locator("#translationTargetLanguage").selectOption("en");
  await options.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      options.evaluate(async () => {
        const settings = await chrome.storage.local.get([
          "translationSourceLanguage",
          "translationTargetLanguage",
        ]);
        return [settings.translationSourceLanguage, settings.translationTargetLanguage];
      })
    )
    .toEqual(["fr", "en"]);
  await options.reload();
  await expect(options.locator("#translationSourceLanguage")).toHaveValue("fr");
  await expect(options.locator("#translationTargetLanguage")).toHaveValue("en");
  await expect(options.locator("#testBacklogConnectionBtn")).toBeVisible();
  if (!(await options.locator("#backlogSettings").evaluate((details) => details.open))) {
    await options.locator("#backlogSettings > summary").click();
  }
  await options.locator("#backlogApiKey").fill("demo-backlog-key");
  await options.locator("#testBacklogConnectionBtn").click();
  await expect(options.locator("#onboardingStatus")).toContainText("Backlog connection successful");
  await options.evaluate(() =>
    chrome.storage.local.set({
      syncActivity: [
        {
          timestamp: "2026-09-24T00:00:00.000Z",
          operation: "translate",
          issue: "DEMO-1",
          count: 2,
          ok: true,
          url: "https://redmine.example/issues/1",
        },
      ],
    })
  );
  await expect(options.locator("#syncActivityList")).toContainText("DEMO-1");

  await options.locator("#languagePreference").selectOption("vi");
  await expect(options.locator("label[for='languagePreference']")).toHaveText("Ngôn ngữ");
  await expect(options.locator("#testBacklogConnectionBtn")).toHaveText("Kiểm tra kết nối Backlog");
  await popup.close();
  await options.close();
});

test("Backlog issue page injects localized sync controls", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await expect(page.locator("button.tb-redmine-btn")).toHaveCount(2);
  await expect(page.locator("button.tb-redmine-btn").first()).toHaveText("Redmine");
  await expect(page.locator("button.tb-header-migrate-btn")).toHaveText("Migrate Issue");
  await page.close();
});

test("Redmine issue page loads its report workflow content script", async () => {
  const page = await openPage("issues/123");
  await injectContentScriptFiles(page, manifest.content_scripts[1]);
  await expect
    .poll(() => page.evaluate(() => globalThis.__B2R_REDMINE_LOADED__ === true))
    .toBe(true);
  await page.close();
});

test("Backlog dry run sends nothing and partial retry only sends remaining notes", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.evaluate(() => {
    window.__mockFailSecondSend = true;
  });
  await page.locator("button.tb-redmine-btn").first().click();
  await expect(page.locator("#tb-modal-title")).toHaveText("Send Comment to Redmine");
  await page.locator("#tb-batch-checkbox").check();
  await expect(page.locator("#tb-comments-note-list .tb-note-card")).toHaveCount(2);
  await page.locator("#tb-dry-run").click();
  await expect(page.locator("#tb-dry-run-result")).toContainText("2 item(s) planned");
  expect(await page.evaluate(() => window.__mockSendCount)).toBe(0);
  await page
    .locator("#tb-comments-note-list .tb-note-card-textarea")
    .first()
    .fill("Edited first note");
  await expect(page.locator("#tb-dry-run-result")).toBeHidden();
  await page.locator("#tb-dry-run").click();

  await page.locator("#tb-modal-confirm").click();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await chrome.storage.local.get("syncActivity")).syncActivity?.[0]?.partial
      )
    )
    .toBe(true);
  expect(await page.evaluate(() => window.__mockSendCount)).toBe(2);
  await page.locator("#tb-modal-confirm").click();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await chrome.storage.local.get("syncActivity")).syncActivity?.[0]?.ok
      )
    )
    .toBe(true);
  expect(await page.evaluate(() => window.__mockSendCount)).toBe(3);
  await page.close();
});

test("Redmine send failure is recorded from the confirmation modal", async () => {
  const page = await openPage("issues/123");
  await injectContentScriptFiles(page, manifest.content_scripts[1]);
  await page.evaluate(() => {
    window.__mockFailBacklogSend = true;
  });
  await page.locator("a.tb-backlog-btn").click();
  await expect(page.locator("#tb-modal-title")).toHaveText("Send comment to Backlog");
  await page.locator("#tb-modal-confirm").click();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await chrome.storage.local.get("syncActivity")).syncActivity?.[0]?.operation
      )
    )
    .toBe("reverse-sync");
  const activity = await page.evaluate(
    async () => (await chrome.storage.local.get("syncActivity")).syncActivity[0]
  );
  expect(activity.ok).toBe(false);
  expect(activity.detail).toContain("Demo Backlog failure");
  await page.close();
});

test("AI status uses the active button when the modal shell is hidden", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.locator("button.tb-redmine-btn").first().waitFor();
  await page.evaluate(() => {
    ensureModalShell();
    const button = document.querySelector("button.tb-redmine-btn");
    setButtonLoading(button, true);
    chrome.runtime.__emit({
      type: "TB_AI_STATUS",
      status: { phase: "retry", provider: "Gemini", model: "demo-model", seconds: 30, attempt: 2 },
    });
  });
  await expect(page.locator("button.tb-redmine-btn").first()).toContainText("Gemini");
  await page.close();
});

test("Redmine project cache follows the entered key", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#redmineApiKey").fill("demo-key-one");
  await page.locator("#redmineApiKey").blur();
  await expect(page.locator("#defaultProjectId")).toContainText("Project demo-key-one");
  await page.locator("#redmineApiKey").fill("demo-key-two");
  await page.locator("#redmineApiKey").blur();
  await expect(page.locator("#defaultProjectId")).toContainText("Project demo-key-two");
  expect(
    await page.evaluate(
      () =>
        window.__mockRequests.filter(
          (request) => request.type === "FETCH_REDMINE_PROJECTS_WITH_KEY"
        ).length
    )
  ).toBe(2);
  await page.close();
});

test("Saving a verified Backlog key retains verification until the key changes", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#backlogSettings > summary").click();
  await page.locator("#backlogApiKey").fill("demo-key-one");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingStatus")).toContainText("Backlog connection successful");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#onboardingBacklogStatus")).toContainText("Complete");
  await page.locator("#backlogApiKey").fill("demo-key-two");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#onboardingBacklogStatus")).toContainText("Not checked");
  await page.close();
});

test("Activity storage failure does not turn a successful send into a failed send", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.evaluate(() => {
    window.__mockActivityStorageFailure = true;
  });
  await page.locator("button.tb-redmine-btn").first().click();
  await expect(page.locator("#tb-modal-title")).toHaveText("Send Comment to Redmine");
  await page.locator("#tb-modal-confirm").click();
  await expect(page.locator("#tb-success-modal")).toBeVisible();
  expect(await page.evaluate(() => window.__mockSendCount)).toBe(1);
  await page.close();
});
