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
          if (message?.type === "GET_BACKLOG_ISSUE_KEY") {
            response = { ok: true, data: { issueKey: window.__mockMappedBacklogKey || "" } };
          } else if (message?.type === "FETCH_REDMINE_ACTIVITIES_WITH_KEY") {
            response = {
              ok: true,
              data: [
                { id: 42, name: "Development" },
                { id: 55, name: "Testing" },
              ],
            };
          } else if (message?.type === "GET_PROJECT_GLOSSARY") {
            const glossaries = JSON.parse(localStorage.getItem("b2rMockGlossaries") || "{}");
            response = { ok: true, data: glossaries[message.projectKey] || [] };
          } else if (message?.type === "SAVE_PROJECT_GLOSSARY") {
            const glossaries = JSON.parse(localStorage.getItem("b2rMockGlossaries") || "{}");
            glossaries[message.projectKey] = message.entries;
            localStorage.setItem("b2rMockGlossaries", JSON.stringify(glossaries));
            response = { ok: true };
          } else if (message?.type === "LIST_SYNC_RECOVERY") {
            response = { ok: true, data: window.__mockRecoveryRecords || [] };
          } else if (message?.type === "SAVE_ISSUE_MAPPING") {
            window.__mockRecoveryRecords = [
              ...(window.__mockRecoveryRecords || []),
              {
                kind: "mapping",
                issueKey: message.issueKey,
                issueId: message.redmineIssueId,
                state: "mapped",
              },
            ];
            response = { ok: true };
          } else if (message?.type === "REMOVE_ISSUE_MAPPING") {
            window.__mockRecoveryRecords = (window.__mockRecoveryRecords || []).filter(
              (record) => record.issueKey !== message.issueKey || record.kind !== "mapping"
            );
            response = { ok: true };
          } else if (message?.type === "RESUME_MIGRATION") {
            window.__mockRecoveryRecords = (window.__mockRecoveryRecords || []).map((record) =>
              record.issueKey === message.issueKey
                ? { ...record, state: "complete", completed: record.total }
                : record
            );
            response = { ok: true, data: { failedCommentCount: 0 } };
          } else if (message?.type === "GET_CRYPTO_STORAGE_ID") {
            const stored = read("tb_storage_id");
            const id = stored.tb_storage_id || "e2e-installation";
            chrome.storage.local.set({ tb_storage_id: id });
            response = { ok: true, data: id };
          } else if (message?.type === "TEST_BACKLOG_CONNECTION") {
            response = { ok: true, data: { userName: "Demo User" } };
          } else if (message?.type === "TEST_MODEL_WITH_KEY") {
            response = { ok: true, data: { ok: true, message: "Model is responsive." } };
          } else if (message?.type === "FETCH_REDMINE_PROJECTS_WITH_KEY") {
            response = { ok: true, data: [{ id: 1, name: `Project ${message.apiKey}` }] };
          } else if (message?.type === "GET_UI_SETTINGS") {
            response = {
              ok: true,
              data: {
                defaultProjectId: "1",
                showRedmineSuccessModal: true,
                ...read(["syncRules", "manualFields", "customFields"]),
              },
            };
          } else if (message?.type === "FETCH_REDMINE_METADATA") {
            const endpoint = message.endpoint || "";
            const data = endpoint.includes("projects.json")
              ? { projects: [{ id: 1, name: "Demo Project" }] }
              : endpoint.includes("trackers.json")
                ? { trackers: window.__mockTrackers || [{ id: 2, name: "Task" }] }
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
                previewText: window.__mockMigrationPreview || "Translated demo comment",
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
              : {
                  ok: true,
                  data: {
                    backlogUrl: "https://demo.backlog.com/view/DEMO-1",
                    partial: window.__mockAttachmentPartial === true,
                    attachmentResults: window.__mockAttachmentPartial
                      ? [{ filename: "report.txt", ok: false, error: "HTTP 503" }]
                      : [],
                  },
                };
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

test("Models default to all selected and preserve a saved subset", async () => {
  const page = await openPage("src/options.html");
  const models = page.locator("#geminiModelsList button[data-model-id]");
  await expect(models.first()).toHaveClass("selected");
  expect(await page.locator("#geminiModelsList button.selected").count()).toBe(
    await models.count()
  );
  await page.locator("#geminiModelsList").evaluate((list) => list.querySelector("button").click());
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(JSON.parse(localStorage.getItem("b2rTestStorage")).geminiModels))
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator("#geminiModelsList button").first()).not.toHaveClass("selected");
  expect(await page.locator("#geminiModelsList button.selected").count()).toBe(
    (await models.count()) - 1
  );
  await page
    .locator("#geminiModelsList")
    .evaluate((list) =>
      list.querySelectorAll("button.selected").forEach((button) => button.click())
    );
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("b2rTestStorage")).geminiModels)
    )
    .toBe("");
  await page.reload();
  await expect(page.locator("#geminiModelsList button.selected")).toHaveCount(0);
  await page.close();
});

test("Options changes language without losing settings, glossary or bug-report drafts", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#geminiModelsList button[data-model-id]").first()).toBeVisible();
  await page.locator("#backlogApiKey").fill("draft-backlog-key");
  await page.locator("#geminiApiKeys").fill("draft-ai-key");
  await page.locator("#geminiApiKeys").press("Enter");
  const model = page.locator("#geminiModelsList button[data-model-id]").first();
  await model.click();
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#syncSubjectTemplate").fill("Draft {issueKey} {summary}");
  await page.locator("#projectGlossary > summary").click();
  await page.locator("#glossaryProjectKey").fill("DEMO");
  await page.locator("#loadProjectGlossary").click();
  await page.locator("#addGlossaryTerm").click();
  await page.locator(".glossary-source").fill("Unsaved term");
  await page.locator(".glossary-target").fill("Unsaved translation");
  await page.locator(".bug-report-card summary").click();
  await page.locator("#bugTitle").fill("Draft bug report");
  await page.evaluate(() => {
    window.__draftPageMarker = true;
  });
  await page.locator("#languagePreference").selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator("#backlogApiKey")).toHaveValue("draft-backlog-key");
  await expect(page.locator("#syncSubjectTemplate")).toHaveValue("Draft {issueKey} {summary}");
  await expect(page.locator(".glossary-source")).toHaveValue("Unsaved term");
  await expect(page.locator(".glossary-target")).toHaveValue("Unsaved translation");
  await expect(page.locator("#bugTitle")).toHaveValue("Draft bug report");
  await expect(model).not.toHaveClass("selected");
  await expect(page.locator("#geminiKeysList button")).toHaveCount(1);
  await expect(page.locator("#translation_source option[value='auto']")).toHaveText("Tự nhận diện");
  await expect(page.locator("#translation_target option[value='pt']")).toHaveText(
    "Tiếng Bồ Đào Nha"
  );
  await expect(page.locator("#geminiModelsList .model-test").first()).toHaveAttribute(
    "aria-label",
    /Kiểm tra mô hình/
  );
  expect(await page.evaluate(() => window.__draftPageMarker)).toBe(true);
  await page.locator("#languagePreference").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#backlogSettings")).not.toContainText("Lấy tại");
  await expect(page.locator(".glossary-target")).toHaveValue("Unsaved translation");
  await page.close();
});

test("Options masks API keys, preserves rejected inputs and supports keyboard model tests", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#geminiModelsList button[data-model-id]").first()).toBeVisible();
  const keyInput = page.locator("#geminiApiKeys");
  for (let index = 0; index < 10; index++) {
    await keyInput.fill(`secret-api-key-${index}-abcd`);
    await keyInput.press("Enter");
  }
  await keyInput.fill("secret-eleventh-key");
  await keyInput.press("Enter");
  await expect(keyInput).toHaveValue("secret-eleventh-key");
  await expect(page.locator("#status")).toContainText("up to 10");
  const keyButtons = page.locator("#geminiKeysList button");
  await expect(keyButtons).toHaveCount(10);
  expect(await keyButtons.first().evaluate((button) => button.outerHTML)).not.toContain(
    "secret-api-key"
  );
  await expect(keyButtons.first()).toHaveAttribute("title", "Remove API key");
  await keyInput.fill("");
  const selection = page.locator("#geminiModelsList button[data-model-id]").first();
  const testButton = page.locator("#geminiModelsList .model-test").first();
  const selected = await selection.getAttribute("aria-pressed");
  await testButton.focus();
  await testButton.press("Enter");
  await expect(testButton.locator(".test-icon")).toHaveText("✅");
  await expect(selection).toHaveAttribute("aria-pressed", selected);
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#status")).toContainText("saved successfully");
  await page.reload();
  await expect(keyButtons).toHaveCount(10);
  await expect(keyButtons.first()).toHaveAttribute("title", "Remove API key");
  await page.close();
});

test("Options connection badges describe unsaved and changed inputs and updates start idle", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText("Not configured");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingStatus")).toContainText("Enter a Backlog API key");
  await page.locator("#backlogApiKey").fill("demo-backlog-key");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText(
    "Connected — save settings to apply"
  );
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText("Connected and saved");
  await page.locator("#backlogApiKey").fill("different-key");
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText("Not checked");
  await expect(page.locator("#updateStatus")).toContainText("Current version");
  await expect(page.locator("#updateStatus")).not.toContainText("Checking");
  await page.close();
});

test("Options reports missing AI keys and downloads without claiming an absent screenshot", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#testPrimaryAiBtn")).toBeVisible();
  await page.locator("#testPrimaryAiBtn").click();
  await expect(page.locator("#onboardingStatus")).toHaveText(
    "Add an API key for the selected AI provider, then test again."
  );
  await page.locator(".bug-report-card summary").click();
  await expect(page.locator("#bugScreenshotHelp")).toContainText("WebP");
  const downloaded = page.waitForEvent("download");
  await page.locator("#downloadBugReportBtn").click();
  await downloaded;
  await expect(page.locator("#bugReportStatus")).toHaveText("Report downloaded.");
  await page.locator("#languagePreference").selectOption("vi");
  await expect(page.locator("#bugReportStatus")).toHaveText("Đã tải báo cáo.");
  await expect(page.locator("#onboardingStatus")).toHaveText(
    "Thêm khóa API cho nhà cung cấp AI đã chọn rồi kiểm tra lại."
  );
  await page.close();
});

for (const scope of ["primary", "fallback"]) {
  for (const provider of ["groq", "cerebras", "openrouter"]) {
    test(`Options deletes both saved ${scope} ${provider} credentials`, async () => {
      const page = await openPage("src/options.html");
      await expect(page.locator("#geminiModelsList button.selected").first()).toBeVisible();
      const name = provider[0].toUpperCase() + provider.slice(1);
      const singleKey = scope === "primary" ? `${provider}ApiKey` : `fallback${name}ApiKey`;
      const listKey = `${singleKey}s`;
      await page.evaluate(
        async ({ scope, provider, singleKey, listKey }) => {
          await chrome.storage.local.set({
            primaryProvider: scope === "primary" ? provider : "gemini",
            fallbackProvider: scope === "fallback" ? provider : "none",
            [singleKey]: await encryptData("test-credential-first"),
            [listKey]: await encryptData("test-credential-first\ntest-credential-second"),
          });
        },
        { scope, provider, singleKey, listKey }
      );
      await page.reload();
      if (scope === "fallback") await page.locator("#fallbackAiSettings > summary").click();
      const keys = page.locator(`#${scope}${name}KeysList button`);
      await expect(keys).toHaveCount(2);
      await keys.first().click();
      await page.locator("#optionsForm button[type='submit']").click();
      await expect(page.locator("#status")).toContainText("saved successfully");
      expect(
        await page.evaluate(async (singleKey) => {
          const saved = await chrome.storage.local.get(singleKey);
          return decryptData(saved[singleKey]);
        }, singleKey)
      ).toBe("test-credential-second");
      await page.reload();
      if (scope === "fallback") await page.locator("#fallbackAiSettings > summary").click();
      await expect(keys).toHaveCount(1);
      await keys.first().click();
      await page.locator("#optionsForm button[type='submit']").click();
      await expect(page.locator("#status")).toContainText("saved successfully");
      expect(
        await page.evaluate(
          async ({ singleKey, listKey }) => {
            const saved = await chrome.storage.local.get([singleKey, listKey]);
            return [saved[singleKey], saved[listKey]];
          },
          { singleKey, listKey }
        )
      ).toEqual(["", ""]);
      await page.reload();
      await expect(keys).toHaveCount(0);
      await expect(page.locator(`#${singleKey}`)).toHaveValue("");
      await page.close();
    });
  }
}

test("Options preserves legacy provider credentials until the user removes them", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#geminiModelsList button.selected").first()).toBeVisible();
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      primaryProvider: "groq",
      fallbackProvider: "cerebras",
      groqApiKey: await encryptData("legacy-primary-key"),
      fallbackCerebrasApiKey: await encryptData("legacy-fallback-key"),
    });
  });
  await page.reload();
  await expect(page.locator("#primaryGroqKeysList button")).toHaveCount(1);
  await expect(page.locator("#fallbackCerebrasKeysList button")).toHaveCount(1);
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#status")).toContainText("saved successfully");
  expect(
    await page.evaluate(async () => {
      const saved = await chrome.storage.local.get([
        "groqApiKey",
        "groqApiKeys",
        "fallbackCerebrasApiKey",
        "fallbackCerebrasApiKeys",
      ]);
      return Promise.all(Object.values(saved).map((value) => decryptData(value)));
    })
  ).toEqual([
    "legacy-primary-key",
    "legacy-primary-key",
    "legacy-fallback-key",
    "legacy-fallback-key",
  ]);
  await page.close();
});

test("Options rejects a cleared Backlog key instead of testing stored credentials", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#backlogApiKey").fill("test-backlog-key");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#status")).toContainText("saved successfully");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText("Connected and saved");
  const requestCount = await page.evaluate(
    () =>
      window.__mockRequests.filter((request) => request.type === "TEST_BACKLOG_CONNECTION").length
  );
  await page.locator("#backlogApiKey").fill("");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingStatus")).toContainText("Enter a Backlog API key");
  await expect(page.locator("#onboardingBacklogStatus")).toHaveText("Not configured");
  expect(
    await page.evaluate(
      () =>
        window.__mockRequests.filter((request) => request.type === "TEST_BACKLOG_CONNECTION").length
    )
  ).toBe(requestCount);
  await page.close();
});

test("Options only verifies the Gemini keys captured when the test started", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#geminiApiKeys").fill("test-key-A");
  await page.locator("#geminiApiKeys").press("Enter");
  await page.evaluate(() => {
    const original = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = (message, callback) => {
      if (message.type === "TEST_MODEL_WITH_KEY") {
        window.__testedKeys = [...(window.__testedKeys || []), message.apiKey];
        window.__finishAi = () => callback({ ok: true, data: { ok: true, message: "ok" } });
        return;
      }
      return original(message, callback);
    };
  });
  await page.locator("#testPrimaryAiBtn").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__finishAi))).toBe(true);
  await page.locator("#geminiApiKeys").fill("test-key-B");
  await page.locator("#geminiApiKeys").press("Enter");
  await page.evaluate(() => window.__finishAi());
  await expect(page.locator("#testPrimaryAiBtn")).toBeEnabled();
  await expect(page.locator("#onboardingAiStatus")).toHaveText("Not checked");
  expect(await page.evaluate(() => window.__testedKeys)).toEqual(["test-key-A"]);
  // Removing the untested key restores the exact set that was verified.
  await page.locator("#geminiKeysList button").last().click();
  await expect(page.locator("#onboardingAiStatus")).toContainText("Connected");
  await page.close();
});

test("Options localizes formatted statuses and recovery rows while preserving recovery drafts", async () => {
  const page = await openPage("src/options.html");
  const catalogs = Object.fromEntries(
    ["en", "vi"].map((locale) => [
      locale,
      JSON.parse(
        fs.readFileSync(path.join(extensionPath, "_locales", locale, "messages.json"), "utf8")
      ),
    ])
  );
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingStatus")).toContainText("Backlog connection failed:");
  await page.evaluate(() => {
    window.__mockRecoveryRecords = [
      {
        kind: "migration",
        issueKey: "DEMO-1",
        state: "partial",
        completed: 0,
        total: 3,
        uncertain: true,
      },
    ];
  });
  await page.locator("#syncRecovery > summary").click();
  await page.locator("#refreshSyncRecovery").click();
  await expect(page.locator("#syncRecoveryList")).toContainText("Incomplete");
  await page.locator("#syncRecoveryList input[type='checkbox']").check();
  await page.locator("#syncRecoveryList input[type='number']").fill("321");
  await page.evaluate(
    (message) => {
      document.getElementById("syncRecoveryStatus").textContent = message;
    },
    catalogs.en.recovery_partial.message.replace("$count$", "3")
  );
  for (const locale of ["vi", "en"]) {
    await page.locator("#languagePreference").selectOption(locale);
    const messages = catalogs[locale];
    await expect(page.locator("#onboardingStatus")).toHaveText(
      messages.options_test_backlog_failed.message.replace(
        "$error$",
        messages.options_backlog_key_missing.message
      )
    );
    await expect(page.locator("#syncRecoveryList [data-i18n='recovery_state_partial']")).toHaveText(
      messages.recovery_state_partial.message
    );
    await expect(page.locator("#syncRecoveryStatus")).toHaveText(
      messages.recovery_partial.message.replace("$count$", "3")
    );
    await expect(page.locator("#syncRecoveryList input[type='checkbox']")).toBeChecked();
    await expect(page.locator("#syncRecoveryList input[type='number']")).toHaveValue("321");
  }
  // API errors are opaque data; preserve their text while translating the surrounding message.
  await page.evaluate(() => {
    const original = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = (message, callback) => {
      if (message.type === "TEST_BACKLOG_CONNECTION") {
        callback({ ok: false, error: "HTTP 403: access denied ($server$)" });
        return;
      }
      return original(message, callback);
    };
  });
  await page.locator("#backlogApiKey").fill("test-key");
  await page.locator("#testBacklogConnectionBtn").click();
  await page.locator("#languagePreference").selectOption("vi");
  await expect(page.locator("#onboardingStatus")).toHaveText(
    catalogs.vi.options_test_backlog_failed.message.replace(
      "$error$",
      "HTTP 403: access denied ($server$)"
    )
  );
  await page.close();
});

test("Monthly reports use the selected profile project and invalidate old previews", async () => {
  const page = await openPage("issues/123");
  const registration = manifest.content_scripts.find((entry) =>
    entry.js.includes("src/redmine_content.js")
  );
  await injectContentScriptFiles(page, registration);
  await page.evaluate(async () => {
    window.getSettings = async () => ({
      redmineDomain: "https://redmine.example",
      hasRedmineApiKey: true,
      reportProjectId: "",
      reportProjects: [
        { id: "100", name: "Alpha" },
        { id: "200", name: "Beta" },
      ],
    });
    window.getTrackers = async () => [{ id: 1, name: "Report" }];
    window.findMonthlyReportIssues = async (_domain, _key, options) => {
      window.__scannedProject = options.projectId;
      return [];
    };
    await window.logTimeForMonth();
  });
  await page.locator("#tb-monthly-report-project").selectOption("200");
  await page.locator("#tb-monthly-log-preview").click();
  await expect.poll(() => page.evaluate(() => window.__scannedProject)).toBe("200");
  await expect(page.locator("#tb-monthly-report-project")).toBeEnabled();
  await page.locator("#tb-monthly-report-project").selectOption("100");
  await expect(page.locator("#tb-monthly-log-start")).toBeDisabled();
  await expect(page.locator("#tb-monthly-log-results")).toBeEmpty();
  await page.close();
});

test("Advanced rules stay collapsed, persist and shape the actual migration title", async () => {
  const page = await openPage("src/options.html");
  await expect(page.locator("#advancedSettings")).not.toHaveAttribute("open", "");
  await expect(page.locator("#advancedSettings #manualFields")).toHaveCount(1);
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#translation_target").selectOption("en");
  await page.locator("#translation_reverseMode").selectOption("translate");
  await page.locator("#translation_reverseSource").selectOption("vi");
  await page.locator("#translation_reverseTarget").selectOption("ja");
  await page.locator("#syncSubjectTemplate").fill("[{issueKey}] {summary} | {translatedSummary}");
  await page.locator("#syncTitleDelimiter").fill(" | ");
  await page.locator("#trackerAliasesPanel > summary").click();
  await page.locator("#addTrackerAlias").click();
  await page.locator("#trackerAliasesEditor [data-field='type']").fill("QA");
  await page.locator("#trackerAliasesEditor [data-field='names']").fill("Question");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("b2rTestStorage")).syncRules?.titleDelimiter
      )
    )
    .toBe(" | ");
  await page.reload();
  await expect(page.locator("#translation_target")).toHaveValue("en");
  await expect(page.locator("#translation_reverseMode")).toHaveValue("translate");
  await expect(page.locator("#translation_reverseSource")).toHaveValue("vi");
  await expect(page.locator("#translation_reverseTarget")).toHaveValue("ja");
  await expect(page.locator("#syncSubjectTemplate")).toHaveValue(
    "[{issueKey}] {summary} | {translatedSummary}"
  );
  await page.goto(`${baseUrl}/view/DEMO-1`);
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.locator("button.tb-header-migrate-btn").click();
  await expect(page.locator("#tb-migrate-subject")).toHaveValue(
    "[DEMO-1] Demo issue | Translated title"
  );
  await expect(page.locator(".tb-cf-input")).toHaveCount(0);
  await page.close();
});

test("Options encrypts project profiles and reloads their policies", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#addProjectProfile").click();
  await page.locator(".profile-row [data-field='name']").fill("Alpha profile");
  await page.locator(".profile-row [data-field='backlogProjectKey']").fill("ALPHA");
  await page.locator(".profile-row [data-field='redmineProjectId']").fill("42");
  await page.locator("#policyProfile").selectOption("0");
  await page.locator("#profileInherit").uncheck();
  await page.locator("#translation_target").selectOption("fr");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(JSON.parse(localStorage.getItem("b2rTestStorage")).projectProfiles)
      )
    )
    .toBe(true);
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("b2rTestStorage")).projectProfiles
  );
  expect(stored).not.toContain("ALPHA");
  await page.reload();
  await expect(page.locator(".profile-row [data-field='backlogProjectKey']")).toHaveValue("ALPHA");
  await expect(page.locator("#translation_target")).toHaveValue("vi");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#policyProfile").selectOption("0");
  await expect(page.locator("#translation_target")).toHaveValue("fr");
  await page.locator("#policyProfile").selectOption("global");
  await expect(page.locator("#translation_target")).toHaveValue("vi");
  await page.screenshot({
    path: "output/playwright/options-profiles-review.png",
    fullPage: true,
    style: ".save-bar { position: static !important; }",
  });
  await page.close();
});

test("Options model chips and policy controls fit desktop and narrow screens", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#fallbackAiSettings > summary").click();
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const provider of ["gemini", "groq", "cerebras", "openrouter"]) {
      await page.locator("#primaryProvider").selectOption(provider);
      const listId =
        provider === "gemini"
          ? "geminiModelsList"
          : `primary${provider[0].toUpperCase()}${provider.slice(1)}ModelsList`;
      const list = page.locator(`#${listId}`);
      await expect(list.locator("button").first()).toBeVisible();
      const problems = await list.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const buttons = [...element.querySelectorAll("button")];
        const errors = [];
        buttons.forEach((button, index) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) {
            errors.push(`chip ${index} overflows`);
          }
          if (button.scrollWidth > button.clientWidth + 1) errors.push(`chip ${index} clips text`);
          if (style.transform !== "none" || style.boxShadow !== "none") {
            errors.push(`chip ${index} paints outside its bounds`);
          }
          for (const other of buttons.slice(index + 1)) {
            const next = other.getBoundingClientRect();
            if (
              Math.min(rect.right, next.right) - Math.max(rect.left, next.left) > 0 &&
              Math.min(rect.bottom, next.bottom) - Math.max(rect.top, next.top) > 0
            ) {
              errors.push(`chip ${index} overlaps another chip`);
            }
          }
        });
        return errors;
      });
      expect(problems).toEqual([]);
      const button = list.locator("button").first();
      const wasSelected = await button.evaluate((element) =>
        element.classList.contains("selected")
      );
      await button.locator(".model-label").click();
      expect(await button.evaluate((element) => element.classList.contains("selected"))).toBe(
        !wasSelected
      );
    }
    await page.locator("#primaryProvider").selectOption("groq");
    await page.locator("#fallbackProvider").selectOption("gemini");
    await expect(page.locator("#fallbackGeminiModelsList button").first()).toBeVisible();
    const searchSelect = await page.locator("#syncSearchMode").boundingBox();
    expect(searchSelect.height).toBeGreaterThanOrEqual(42);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  }
  await page.locator("#themePreference").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#primaryAiSettings").screenshot({
    path: "output/playwright/options-models-mobile-detail.png",
  });
  await page.screenshot({
    path: "output/playwright/options-models-mobile-dark.png",
    fullPage: true,
    style: ".save-bar { position: static !important; }",
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator("#primaryProvider").selectOption("gemini");
  await page.locator("#themePreference").selectOption("light");
  await page.locator("#primaryAiSettings").screenshot({
    path: "output/playwright/options-models-detail.png",
  });
  await page.screenshot({
    path: "output/playwright/options-models-review.png",
    fullPage: true,
    style: ".save-bar { position: static !important; }",
  });
  await page.locator("#languagePreference").selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.screenshot({
    path: "output/playwright/options-ui-vi-desktop.png",
    fullPage: true,
    style: ".save-bar { position: static !important; }",
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.locator("#themePreference").selectOption("dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false
  );
  await page.locator("#primaryAiSettings").screenshot({
    path: "output/playwright/options-ui-vi-mobile.png",
  });
  await page.close();
});

test("Options shows relevant policy fields and reveals invalid collapsed settings", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  const source = page.locator("#translation_reverseSource");
  const target = page.locator("#translation_reverseTarget");
  await expect(source).toBeHidden();
  await expect(target).toBeVisible();
  await page.locator("#translation_reverseMode").selectOption("translate");
  await expect(source).toBeVisible();
  await source.selectOption("vi");
  await page.locator("#translation_reverseMode").selectOption("original");
  await expect(source).toBeHidden();
  await expect(target).toBeHidden();
  await page.locator("#translation_reverseMode").selectOption("translate");
  await expect(source).toHaveValue("vi");
  await expect(target).toBeVisible();
  await page.locator("#logTime_activityMode").selectOption("default");
  await expect(page.locator("#logTime_testingActivityId")).toBeHidden();
  await page.locator("#logTime_activityMode").selectOption("legacy");
  await expect(page.locator("#logTime_testingActivityId")).toBeVisible();
  await page.locator("#logTime_dailyHours").fill("0");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#advancedSettings")).toHaveAttribute("open", "");
  await expect(page.locator("#logTime_dailyHours")).toBeFocused();
  const workspaceBeforeSupport = await page.evaluate(() => {
    const glossary = document.getElementById("projectGlossary");
    const recovery = document.getElementById("syncRecovery");
    const support = document.querySelector(".bug-report-card");
    return [glossary, recovery].every(
      (element) => element.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(workspaceBeforeSupport).toBe(true);
  await page.close();
});

test("Mapping editor validates and migration supports arbitrary trackers and custom fields", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#advancedCustomFields details > summary").click();
  await page.locator("#addCustomField").click();
  const field = page.locator("#customFieldsEditor .policy-row");
  await field.locator("[data-field='name']").fill("Customer priority");
  await field.locator("[data-field='id']").fill("77");
  await field.locator("[data-field='type']").selectOption("select");
  await field.locator("[data-field='options']").fill("High \nLow");
  await field.locator("[data-field='trackers']").fill("Support");
  await field.locator("[data-field='required']").check();
  await page.locator("#dueDateRulesPanel > summary").click();
  await page.locator("#addDueDateRule").click();
  const date = page.locator("#dueDateRulesEditor .policy-row").last();
  await date.locator("[data-field='tracker']").fill("support");
  await date.locator("[data-field='required']").check();
  await page.locator("#validateConfiguration").click();
  await expect(page.locator("#configurationStatus")).toContainText("Rules and mappings are valid");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("b2rTestStorage")).customFields?.[0]?.id)
    )
    .toBe(77);
  await page.goto(`${baseUrl}/view/DEMO-1`);
  await page.evaluate(() => {
    window.__mockTrackers = [{ id: 9, name: "Support" }];
  });
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.locator("button.tb-header-migrate-btn").click();
  await expect(page.locator("#tb-migrate-tracker")).toHaveValue("9");
  await expect(page.locator(".tb-cf-input[data-cf-id='77']")).toBeVisible();
  await expect(page.locator("#tb-modal-confirm")).toBeDisabled();
  await page.locator(".tb-cf-input[data-cf-id='77']").selectOption("High ");
  await page.locator("#tb-migrate-due-date").fill("2026-10-05");
  await expect(page.locator("#tb-modal-confirm")).toBeEnabled();
  await page.locator("#tb-modal-confirm").click();
  const payload = await page.evaluate(
    () => window.__mockRequests.find((request) => request.type === "CREATE_REDMINE_ISSUE").issueData
  );
  expect(payload.tracker_id).toBe("9");
  expect(payload.custom_fields).toEqual([{ id: 77, value: "High " }]);
  await page.close();
});

test("Configuration validation blocks duplicate mappings and missing default activities", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#trackerAliasesPanel > summary").click();
  for (const type of ["Bug", "bug"]) {
    await page.locator("#addTrackerAlias").click();
    await page
      .locator("#trackerAliasesEditor .policy-row")
      .last()
      .locator("[data-field='type']")
      .fill(type);
  }
  await page.locator("#validateConfiguration").click();
  await expect(page.locator("#configurationStatus")).toContainText("unique Backlog issue type");
  await page.locator("#trackerAliasesEditor .policy-row").last().locator("button").click();
  await page.locator("#logTime_activityMode").selectOption("default");
  await page.locator("#validateConfiguration").click();
  await expect(page.locator("#configurationStatus")).toContainText("Choose a default activity");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#status")).toHaveClass("status status-error");
  await expect(page.locator("#optionsForm button[type='submit']")).toBeEnabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("b2rTestStorage")).syncRules)
  ).toBeUndefined();
  await page.close();
});

test("Late migration metadata cannot replace the current project's fields", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.evaluate(() => {
    const original = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = (message, callback) => {
      if (message.type !== "GET_UI_SETTINGS") return original(message, callback);
      const response = {
        ok: true,
        data: {
          defaultProjectId: "1",
          customFields: [
            {
              id: 77,
              name: message.issueKey,
              type: "text",
              required: false,
              options: [],
              trackers: [],
              defaultValue: "",
            },
          ],
        },
      };
      const result =
        message.issueKey === "ALPHA-1"
          ? new Promise((resolve) => {
              window.__resolveAlphaMetadata = () => resolve(response);
            })
          : Promise.resolve(response);
      if (callback) result.then(callback);
      return result;
    };
    TB_MODAL.openConfirmModal({
      sourceIssueKey: "ALPHA-1",
      issueTitle: "Alpha",
      isMigration: true,
    });
    TB_MODAL.openConfirmModal({ sourceIssueKey: "BETA-1", issueTitle: "Beta", isMigration: true });
  });
  await expect(page.locator("#tb-dynamic-fields")).toContainText("BETA-1");
  await page.evaluate(() => window.__resolveAlphaMetadata());
  await expect(page.locator("#tb-dynamic-fields")).not.toContainText("ALPHA-1");
  await page.close();
});

test("Options loads API activities and persists configured log-time policy", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#advancedSettings > summary").click();
  await page.locator("#redmineApiKey").fill("fixture-key");
  await page.locator("#loadLogTimeActivities").click();
  await expect(page.locator("#logTime_defaultActivityId option[value='42']")).toHaveText(
    "Development"
  );
  await page.locator("#logTime_dailyHours").fill("7.5");
  await page.locator("#logTime_allocation").selectOption("estimate");
  await page.locator("#logTime_activityMode").selectOption("default");
  await page.locator("#logTime_defaultActivityId").selectOption("42");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("b2rTestStorage")).logTimeRules?.dailyHours
      )
    )
    .toBe(7.5);
  await page.reload();
  await expect(page.locator("#logTime_dailyHours")).toHaveValue("7.5");
  await expect(page.locator("#logTime_allocation")).toHaveValue("estimate");
  await expect(page.locator("#logTime_defaultActivityId")).toHaveValue("42");
  await page.close();
});

test("Options glossary edits project terms, reloads saved terms after localization and isolates projects", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#projectGlossary > summary").click();
  await page.locator("#glossaryProjectKey").fill("DEMO");
  await expect(page.locator("#saveProjectGlossary")).toBeDisabled();
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator("#glossaryStatus")).toHaveText("Glossary loaded.");
  await page.locator("#addGlossaryTerm").click();
  await page.locator(".glossary-source").fill("Product Name");
  await page.locator(".glossary-keep").check();
  await expect(page.locator(".glossary-target")).toBeDisabled();
  await page.locator("#saveProjectGlossary").click();
  await expect(page.locator("#glossaryStatus")).toHaveText("Glossary saved.");
  await page.locator("#languagePreference").selectOption("vi");
  await expect(page.locator("#saveProjectGlossary")).toHaveText("Lưu thuật ngữ");
  await expect(page.locator("#projectGlossary")).toHaveAttribute("open", "");
  await page.locator("#glossaryProjectKey").fill("DEMO");
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator(".glossary-source")).toHaveValue("Product Name");
  await page.locator("#saveProjectGlossary").click();
  await expect(page.locator("#glossaryStatus")).toHaveText("Đã lưu thuật ngữ.");
  await page.locator("#glossaryProjectKey").fill("OTHER");
  await expect(page.locator(".glossary-term")).toHaveCount(0);
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator("#glossaryStatus")).toHaveText("Đã tải thuật ngữ.");
  await expect(page.locator(".glossary-term")).toHaveCount(0);
  await page.locator("#glossaryProjectKey").fill("DEMO");
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator(".glossary-source")).toHaveValue("Product Name");
  await expect(page.locator(".glossary-keep")).toBeChecked();
  await page.close();
});

test("Glossary preserves unsaved edits and saved terms when discard or clear is cancelled", async () => {
  const page = await openPage("src/options.html");
  await page.evaluate(() => {
    localStorage.setItem(
      "b2rMockGlossaries",
      JSON.stringify({ DEMO: [{ source: "Original", target: "Translation", keep: false }] })
    );
  });
  await page.locator("#projectGlossary > summary").click();
  await page.locator("#glossaryProjectKey").fill("DEMO");
  await expect(page.locator("#saveProjectGlossary")).toBeDisabled();
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator(".glossary-source")).toHaveValue("Original");
  await page.locator(".glossary-source").fill("Unsaved");
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.locator("#loadProjectGlossary").click();
  await expect(page.locator(".glossary-source")).toHaveValue("Unsaved");
  await expect(page.locator("#glossaryStatus")).toHaveText("Glossary loaded.");
  await page.locator(".glossary-term button").click();
  await page.locator("#saveProjectGlossary").click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("b2rMockGlossaries")).DEMO)
  ).toEqual([{ source: "Original", target: "Translation", keep: false }]);
  await expect(page.locator("#glossaryStatus")).toHaveText("Glossary loaded.");
  await page.close();
});

test("Redmine reverse sync uses the saved mapping with a keyless title", async () => {
  const page = await openPage("issues/123");
  await page.evaluate(() => {
    document.querySelector("h2").textContent = "Translated title without a source key";
    window.__mockMappedBacklogKey = "HIPE_B2R-1";
  });
  await injectContentScriptFiles(page, manifest.content_scripts[1]);
  await page.locator("a.tb-backlog-btn").click();
  await expect(page.locator("#tb-modal-title")).toHaveText("Send comment to Backlog");
  expect(
    await page.evaluate(
      () =>
        window.__mockRequests.find((request) => request.type === "EXTRACT_JAPANESE_CONTENT")
          .issueKey
    )
  ).toBe("HIPE_B2R-1");
  await page.close();
});

test("Popup and Options render the selected locale and onboarding", async () => {
  const popup = await openPage("src/popup.html");
  await expect(popup.getByText("Open full settings")).toBeVisible();

  const options = await openPage("src/options.html");
  await expect(options.locator("#onboardingCard")).toBeVisible();
  await expect(options.locator("label[for='languagePreference']")).toHaveText("Language");
  await expect(options.locator("#testBacklogConnectionBtn")).toBeVisible();
  if (!(await options.locator("#backlogSettings").evaluate((section) => section.open))) {
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
  if (!(await page.locator("#backlogSettings").evaluate((section) => section.open))) {
    await page.locator("#backlogSettings > summary").click();
  }
  await page.locator("#backlogApiKey").fill("demo-key-one");
  await page.locator("#testBacklogConnectionBtn").click();
  await expect(page.locator("#onboardingStatus")).toContainText("Backlog connection successful");
  await page.locator("#optionsForm button[type='submit']").click();
  await expect(page.locator("#onboardingBacklogStatus")).toContainText("Connected and saved");
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

test("Options manages mappings and resumes saved migrations", async () => {
  const page = await openPage("src/options.html");
  await page.locator("#syncRecovery > summary").click();
  await page.locator("#mappingSource").fill("DEMO-1");
  await page.locator("#mappingDestination").fill("42");
  await page.locator("#saveIssueMapping").click();
  await expect(page.locator("#syncRecoveryList")).toContainText("DEMO-1 → #42");
  await page.getByRole("button", { name: "Remove mapping", exact: true }).click();
  await expect(page.locator("#syncRecoveryList")).toContainText("No saved migrations");
  await page.evaluate(() => {
    window.__mockRecoveryRecords = [
      {
        kind: "migration",
        issueKey: "DEMO-2",
        issueId: 43,
        state: "partial",
        completed: 1,
        total: 2,
      },
    ];
  });
  await page.locator("#refreshSyncRecovery").click();
  await expect(page.locator("#syncRecoveryList")).toContainText("1/2");
  await page.getByRole("button", { name: "Resume / recheck", exact: true }).click();
  await expect(page.locator("#syncRecoveryList")).toContainText("Complete · 2/2");
  await page.close();
});

test("Migration preview sends only selected comments and files", async () => {
  const page = await openPage("view/DEMO-1");
  await injectContentScriptFiles(page, manifest.content_scripts[0]);
  await page.evaluate(() => {
    window.__mockMigrationPreview = "Description [[TB_FILE:7:report.txt]]";
  });
  await page.locator("button.tb-header-migrate-btn").click();
  await expect(page.locator(".tb-note-selected")).toHaveCount(2);
  await page.locator(".tb-note-selected").first().uncheck();
  await page.locator('.tb-file-selected[data-file-id="7"]').uncheck();
  await expect(page.locator("#tb-migration-selection")).toContainText("1 comments and 0 files");
  await page.locator("#tb-migrate-due-date").fill("2026-10-31");
  for (const field of await page.locator(".tb-cf-input").all()) {
    if (await field.evaluate((element) => element.tagName === "SELECT")) {
      await field.selectOption({ index: 1 });
    } else await field.fill("1");
  }
  await page.locator("#tb-modal-confirm").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__mockRequests.filter((request) => request.type === "CREATE_REDMINE_ISSUE").length
      )
    )
    .toBe(1);
  const request = await page.evaluate(() =>
    window.__mockRequests.find((request) => request.type === "CREATE_REDMINE_ISSUE")
  );
  expect(request.comments).toHaveLength(1);
  expect(request.issueData.description).not.toContain("[[TB_FILE:7");
  expect(request.selection.commentIndexes).toEqual([1]);
  expect(request.selection.fileIds).toEqual([]);
  await page.close();
});

test("reverse sync displays failed attachment warning and records partial success", async () => {
  const page = await openPage("issues/123");
  await injectContentScriptFiles(page, manifest.content_scripts[1]);
  await page.evaluate(() => {
    window.__mockAttachmentPartial = true;
  });
  await page.locator("a.tb-backlog-btn").click();
  await page.locator("#tb-modal-confirm").click();
  await expect(page.locator(".tb-toast").filter({ hasText: "report.txt" })).toBeVisible();
  const entry = await page.evaluate(
    () => JSON.parse(localStorage.getItem("b2rTestStorage")).syncActivity[0]
  );
  expect(entry.partial).toBe(true);
  expect(entry.ok).toBe(false);
  expect(entry.count).toBe(1);
  expect(entry.detail).toContain("report.txt");
  await page.close();
});
