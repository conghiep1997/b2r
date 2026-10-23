const { test, expect, chromium } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("unpacked MV3 worker handles messages, permissions and dynamic registration", async () => {
  const extensionPath = path.resolve(__dirname, "../../dist");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "b2r-smoke-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: ["--enable-unsafe-extension-debugging"],
    });
    const session = await context.browser().newBrowserCDPSession();
    const { id: extensionId } = await session.send("Extensions.loadUnpacked", {
      path: extensionPath,
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options.html`);
    await expect(page.locator("#onboardingCard")).toBeVisible();
    const response = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "GET_CRYPTO_STORAGE_ID" })
    );
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    expect(response.ok).toBe(true);
    expect(response.data).toMatch(/^[0-9a-f-]{36}$/);
    const id = await worker.evaluate(() => chrome.storage.local.get("tb_storage_id"));
    expect(id.tb_storage_id).toBe(response.data);

    const translation = await worker.evaluate(async () => {
      await chrome.storage.local.set({
        translationRules: { target: "en", reverseMode: "original" },
      });
      const settings = await getSettings();
      const text = "Original <id> [[TB_FILE:1:file.txt]]";
      return {
        rules: settings.translationRules,
        original: await translateText(
          text,
          settings,
          null,
          TB.PROMPTS.TRANSLATION.prompt(settings.translationRules, true)
        ),
      };
    });
    expect(translation.rules.target).toBe("en");
    expect(translation.rules.reverseTarget).toBe("ja");
    expect(translation.original).toBe("Original <id> [[TB_FILE:1:file.txt]]");

    await worker.evaluate(async () => {
      const settings = await getSettings();
      const profiles = TB_PROJECT_PROFILES.normalize(
        [
          {
            backlogProjectKey: "ALPHA",
            redmineProjectId: "42",
            overrides: {
              translationRules: { target: "fr" },
              logTimeRules: { dailyHours: 7.5 },
              manualFields: { Category: 7 },
            },
          },
        ],
        settings
      );
      await chrome.storage.local.set({
        projectProfiles: await encryptData(JSON.stringify(profiles)),
      });
    });
    const profileView = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "GET_UI_SETTINGS", issueKey: "ALPHA-1" })
    );
    expect(profileView.ok).toBe(true);
    expect(profileView.data.defaultProjectId).toBe("42");
    expect(profileView.data.manualFields).toBe('{"Category":7}');
    expect(profileView.data.syncRules.restrictToProject).toBe(true);
    expect(profileView.data).not.toHaveProperty("redmineApiKey");
    const profilePolicies = await worker.evaluate(async () => {
      const settings = await getSettings();
      const selected = settingsForBacklog(settings, { issueKey: "ALPHA-1" });
      return {
        target: selected.translationRules.target,
        hours: TB_PROJECT_PROFILES.forRedmine(settings, "42").logTimeRules.dailyHours,
      };
    });
    expect(profilePolicies).toEqual({ target: "fr", hours: 7.5 });

    const activities = await worker.evaluate(async () => {
      const originalFetch = timeoutFetch;
      timeoutFetch = async (_url, init) => ({
        ok: true,
        json: async () => ({
          time_entry_activities: [{ id: 42, name: "Development" }],
          redirectPolicy: init.redirect,
        }),
      });
      try {
        return await getTimeEntryActivities("https://redmine.example", "fixture-key");
      } finally {
        timeoutFetch = originalFetch;
      }
    });
    expect(activities).toEqual([{ id: 42, name: "Development" }]);

    const glossary = await page.evaluate(async () => {
      const saved = await chrome.runtime.sendMessage({
        type: "SAVE_PROJECT_GLOSSARY",
        projectKey: "SMOKE",
        entries: [{ source: "Protected Product", target: "", keep: true }],
      });
      const loaded = await chrome.runtime.sendMessage({
        type: "GET_PROJECT_GLOSSARY",
        projectKey: "SMOKE",
      });
      const other = await chrome.runtime.sendMessage({
        type: "GET_PROJECT_GLOSSARY",
        projectKey: "OTHER",
      });
      const records = await chrome.storage.local.get(null);
      return {
        saved,
        loaded,
        other,
        encrypted: Object.entries(records)
          .filter(([key]) => key.startsWith("b2r_sync_"))
          .map(([, value]) => value),
      };
    });
    expect(glossary.saved.ok).toBe(true);
    expect(glossary.loaded.data).toEqual([
      { source: "Protected Product", target: "Protected Product", keep: true },
    ]);
    expect(glossary.other.data).toEqual([]);
    expect(glossary.encrypted).toHaveLength(1);
    expect(glossary.encrypted[0]).not.toContain("Protected Product");

    const permissions = await worker.evaluate(() => chrome.permissions.getAll());
    expect(permissions.permissions).toContain("scripting");
    const forbidden = await worker.evaluate(() =>
      chrome.permissions.contains({ origins: ["https://ungranted.example/*"] })
    );
    expect(forbidden).toBe(false);

    // This fixture origin is already covered by the extension's Backlog host permission.
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ redmineDomain: "https://smoke.backlog.com" });
      await syncCustomRedmineRegistration();
    });
    const scripts = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    expect(scripts).toHaveLength(1);
    expect(scripts[0].matches).toEqual(["https://smoke.backlog.com/*"]);
    expect(scripts[0].js.at(-1)).toBe("src/redmine_content.js");
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ redmineDomain: TB.REDMINE_DOMAIN });
      await syncCustomRedmineRegistration();
    });
    expect(await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts())).toEqual([]);

    await context.route("https://smoke.backlog.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<h1><span data-testid="issueKey">SMOKE-1</span><span data-testid="issueSummary">Smoke</span></h1><div class="title-group__edit-actions"></div><section class="comments"><div class="comment-item__actions"></div></section>',
      })
    );
    await page.goto("https://smoke.backlog.com/view/SMOKE-1");
    await expect(page.locator("button.tb-redmine-btn")).toBeVisible();
    await expect(page.locator("button.tb-header-migrate-btn")).toBeVisible();
  } finally {
    await context?.close();
    const resolved = path.resolve(profile);
    if (
      !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith("b2r-smoke-")
    )
      throw new Error("Unexpected smoke profile path.");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
