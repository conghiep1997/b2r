/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling between content scripts and external APIs.
 */

/* global TB_LOGGER, TB_SYNC_ACTIVITY, TB_SYNC_STATE, TB_COMMENT_SYNC, TB_MIGRATION, TB_PROJECT_PROFILES, TB_GLOSSARY, TB_SYNC_RULES, TB_LOG_TIME_RULES, TB_CUSTOM_FIELDS, getUserStorageId, getBacklogIssueInfo, getBacklogUsers, testModelAvailability, deleteTimeEntry, updateTimeEntry */

importScripts(
  "modules/utils/version.js",
  "modules/utils/settings-view.js",
  "modules/utils/message-validation.js",
  "modules/utils/request-deduper.js",
  "modules/utils/sync-activity.js",
  "modules/utils/sync-rules.js",
  "modules/utils/custom-fields.js",
  "modules/utils/redmine-domain.js",
  "modules/constants/models.js",
  "modules/constants/icons.js",
  "modules/constants/prompts.js",
  "constants.js",
  "modules/utils/helpers.js",
  "modules/utils/crypto.js",
  "modules/services/sync-state.js",
  "modules/utils/project-profiles.js",
  "modules/utils/logger.js",
  "modules/utils/markdown.js",
  "modules/services/ai.js",
  "modules/services/redmine.js",
  "modules/services/backlog.js",
  "modules/services/migration.js",
  "modules/services/comment-sync.js",
  "modules/services/glossary.js"
);

const DEBUG_PREFIX = "[TB-BG]";
const UPDATE_NOTIFICATION_ID = "b2r-update-available";
const CHECK_INTERVAL_HOURS = 24;

// ============================================================================
// Extension Lifecycle & Update Checks
// ============================================================================

/**
 * Opens the options page when the user clicks on the extension icon.
 */
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

/**
 * Handles extension installation or update.
 * Opens options page on first install and checks for updates.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await TB_LOGGER.sanitizeStoredLogs();
  try {
    await syncCustomRedmineRegistration();
  } catch (error) {
    await TB_LOGGER.logError("Background", error, {
      operation: "syncCustomRedmineRegistration",
    });
  }
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
  // Always check for updates on install/update and set a recurring alarm.
  await checkForUpdates();
  chrome.alarms.create("checkForUpdates", { periodInMinutes: CHECK_INTERVAL_HOURS * 60 });
});

/**
 * Handles extension startup.
 * Checks for updates if it hasn't been done recently.
 */
chrome.runtime.onStartup.addListener(async () => {
  await TB_LOGGER.sanitizeStoredLogs();
  try {
    await syncCustomRedmineRegistration();
  } catch (error) {
    await TB_LOGGER.logError("Background", error, {
      operation: "syncCustomRedmineRegistration",
    });
  }
  console.log(`${DEBUG_PREFIX} Extension started, checking for updates...`);
  const shouldCheck = await shouldCheckForUpdates();
  if (shouldCheck) {
    await checkForUpdates();
  }
});

/**
 * Handles the recurring alarm for update checks.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkForUpdates") {
    await checkForUpdates();
  }
});

/**
 * Handles notification clicks to direct users to the download page.
 */
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;

  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ url: "https://hipppo.vercel.app/" });
});

/**
 * Handles notification button clicks.
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;

  chrome.notifications.clear(notificationId);
  if (buttonIndex === 0) {
    // "Download ngay" button
    chrome.tabs.create({ url: "https://hipppo.vercel.app/" });
  }
});

/**
 * Checks if an update check should be performed.
 * @returns {Promise<boolean>} True if the last check was more than CHECK_INTERVAL_HOURS ago.
 */
async function shouldCheckForUpdates() {
  const result = await chrome.storage.local.get(["lastUpdateCheck"]);
  const lastCheck = result.lastUpdateCheck;
  if (!lastCheck) return true;

  const hoursSinceLastCheck = (Date.now() - new Date(lastCheck).getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCheck >= CHECK_INTERVAL_HOURS;
}

/**
 * Fetches the latest version from the backend and updates the extension badge and notifications.
 */
async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;

  try {
    const data = await TB_VERSION.fetchLatest();
    const latestVersion = data.version_number;
    if (!TB_VERSION.isValid(latestVersion)) {
      console.warn(`${DEBUG_PREFIX} Backend returned an invalid version.`);
      return;
    }

    const comparison = TB_VERSION.compare(currentVersion, latestVersion);

    if (comparison < 0) {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
      await chrome.notifications.create(UPDATE_NOTIFICATION_ID, {
        type: "basic",
        iconUrl: "assets/icons/icon-48.png",
        title: "🚀 Cập nhật mới sẵn sàng!",
        message: `Phiên bản ${latestVersion} đã ra mắt. Click để xem chi tiết!`,
        priority: 2,
        buttons: [{ title: "Download ngay" }, { title: "Để sau" }],
      });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }

    await chrome.storage.local.set({ lastUpdateCheck: new Date().toISOString() });
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Update check failed:`, error.message);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Main message listener for requests from content scripts and options page.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    TB_MESSAGE_VALIDATION.assertInternalSender(sender, chrome.runtime.id);
    TB_MESSAGE_VALIDATION.assertMessage(message);
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
    return false;
  }

  const handlers = {
    OPEN_OPTIONS_PAGE: () => chrome.runtime.openOptionsPage(),
    GET_UI_SETTINGS: async (msg) => {
      const settings = await getSettings();
      assertTrustedExtensionPageSender(sender, settings);
      const scoped = msg.issueKey
        ? TB_PROJECT_PROFILES.forBacklog(settings, msg.issueKey)
        : settings;
      return TB_SETTINGS_VIEW.forUi(scoped);
    },
    GET_REPORT_SETTINGS: async (msg) => {
      const settings = await getSettings();
      assertTrustedRedmineSender(sender, settings.redmineDomain);
      const reportProjectId = msg.reportProjectId || settings.reportProjectId || "";
      if (!msg.reportProjectId && !msg.profileKey && !msg.globalProfile) {
        return TB_SETTINGS_VIEW.forReport(settings);
      }
      const profiles = TB_PROJECT_PROFILES.current(settings).filter(
        (profile) =>
          String(profile.reportProjectId || profile.redmineProjectId) === String(reportProjectId)
      );
      const selectedProfile = msg.profileKey
        ? profiles.find((profile) => profile.backlogProjectKey === msg.profileKey)
        : null;
      if (msg.profileKey && !selectedProfile) {
        throw new Error("Selected report project profile is no longer available.");
      }
      if (!msg.profileKey && !msg.globalProfile && profiles.length > 1) {
        const policies = new Set(
          profiles.map((profile) =>
            JSON.stringify(profile.overrides.logTimeRules || settings.logTimeRules)
          )
        );
        if (policies.size > 1) {
          throw new Error("Select a report profile before loading its settings.");
        }
      }
      const profile = selectedProfile || profiles[0] || null;
      const scoped =
        !msg.globalProfile && profile
          ? TB_PROJECT_PROFILES.forBacklog(settings, `${profile.backlogProjectKey}-1`)
          : settings;
      return TB_SETTINGS_VIEW.forReport({
        ...scoped,
        reportProjectId,
      });
    },
    GET_PROJECT_GLOSSARY: async ({ projectKey }) => {
      assertOptionsSender(sender);
      return TB_GLOSSARY.get(await getSettings(), projectKey);
    },
    SAVE_PROJECT_GLOSSARY: async ({ projectKey, entries }) => {
      assertOptionsSender(sender);
      return TB_GLOSSARY.save(await getSettings(), projectKey, entries);
    },
    GET_CRYPTO_STORAGE_ID: async () => {
      assertOptionsSender(sender);
      return getUserStorageId();
    },
    LOG_ERROR: ({ log }) => TB_LOGGER?.saveLogToStorage(log),
    RECORD_SYNC_ACTIVITY: ({ entry }) => TB_SYNC_ACTIVITY.record(entry),
    CLEAR_SYNC_ACTIVITY: async () => {
      assertOptionsSender(sender);
      await TB_SYNC_ACTIVITY.clear();
    },
    LIST_SYNC_RECOVERY: async () => {
      assertOptionsSender(sender);
      const settings = await getSettings();
      return (await TB_SYNC_STATE.list(settings)).map((record) => ({
        kind: record.kind,
        recordId: record.identity,
        issueKey: record.kind === "comment" ? record.request?.backlogIssueKey : record.identity,
        issueId: record.issueId || record.request?.redmineIssueId || "",
        state: record.state || "complete",
        completed: record.completed?.length || 0,
        total: record.total ?? record.comments?.length ?? 0,
        uncertain:
          record.state === "sending" ||
          (record.pendingComment !== null && record.pendingComment !== undefined),
      }));
    },
    RESUME_COMMENT_SYNC: async ({ recordId }) => {
      assertOptionsSender(sender);
      return TB_COMMENT_SYNC.resume(await getSettings(), recordId);
    },
    RESOLVE_COMMENT_SYNC: async ({ recordId }) => {
      assertOptionsSender(sender);
      return TB_COMMENT_SYNC.resolve(await getSettings(), recordId);
    },
    RESUME_MIGRATION: async ({ issueKey }) => {
      assertOptionsSender(sender);
      return TB_MIGRATION.resume(await getSettings(), issueKey);
    },
    RESOLVE_MIGRATION: async ({ issueKey, action, redmineIssueId }) => {
      assertOptionsSender(sender);
      return TB_MIGRATION.resolve(await getSettings(), issueKey, action, redmineIssueId);
    },
    SAVE_ISSUE_MAPPING: async ({ issueKey, redmineIssueId }) => {
      assertOptionsSender(sender);
      if (!/^[A-Z0-9_]+-\d+$/.test(issueKey || "") || !/^[1-9]\d*$/.test(redmineIssueId || "")) {
        throw new TypeError("Invalid issue mapping.");
      }
      const settings = await getSettings();
      const issue = await TB_MIGRATION.remoteIssue(settings, redmineIssueId);
      await TB_SYNC_STATE.write(settings, "mapping", issueKey, {
        issueId: issue.id,
        projectId: issue.project?.id,
      });
    },
    REMOVE_ISSUE_MAPPING: async ({ issueKey }) => {
      assertOptionsSender(sender);
      await TB_SYNC_STATE.remove(await getSettings(), "mapping", issueKey);
    },
    GET_DEFAULT_PROJECT_SUMMARY: async () => {
      const allowedUrls = [
        chrome.runtime.getURL("src/popup.html"),
        chrome.runtime.getURL("src/options.html"),
      ];
      if (!allowedUrls.includes(sender?.url)) {
        throw new Error("This operation is only available from an extension page.");
      }
      const settings = await getSettings();
      if (!settings.defaultProjectId || !settings.redmineApiKey) return null;
      return fetchRedmineProjectById(
        settings.redmineDomain,
        settings.redmineApiKey,
        settings.defaultProjectId
      );
    },

    TEST_MODEL_WITH_KEY: ({ provider, modelId, apiKey }) => {
      assertOptionsSender(sender);
      return testModelAvailability(provider, modelId, createProviderTestSettings(provider, apiKey));
    },
    TEST_BACKLOG_CONNECTION: async ({ domain, apiKey }) => {
      assertOptionsSender(sender);
      const origin = getTrustedBacklogApiOrigin(domain);
      const endpoint = new URL("api/v2/users/myself", `${origin}/`);
      endpoint.searchParams.set("apiKey", apiKey);
      const response = await timeoutFetch(
        endpoint.toString(),
        { method: "GET", redirect: "error" },
        15000
      );
      if (!response.ok) {
        const errorText = await readErrorMessage(response);
        throw new Error(
          sanitizeErrorMessage(errorText || `HTTP ${response.status}`, response.status)
        );
      }
      const user = await safeReadJson(response);
      return { userName: user?.name || "" };
    },
    LOOKUP_AND_TRANSLATE_COMMENT: async (msg) => {
      const baseSettings = await getSettings();
      assertTrustedBacklogSender(sender, baseSettings.backlogDomain);
      const settings = settingsForBacklog(baseSettings, msg.issueKey);
      if (!settings.defaultProjectId) {
        throw new Error(
          chrome.i18n.getMessage("options_translation_project_required") ||
            "Select a Redmine project to activate translation to Redmine."
        );
      }
      assertSettings(settings, ["redmineApiKey", "ai"]);
      const redmineIssue = await findRedmineIssueWithCache(
        settings.redmineDomain,
        settings.redmineApiKey,
        msg.issueKey,
        msg.issueSummary,
        msg.backlogIssueType || "",
        settings.syncRules,
        settings.defaultProjectId
      );
      const translated = await translateText(
        msg.commentText,
        settings,
        msg.commentUrl,
        TB.PROMPTS.USER,
        createAIStatusReporter(sender)
      );
      const finalPreview = msg.userInfo ? `${msg.userInfo}\n${translated}` : translated;
      return {
        redmineIssueId: redmineIssue?.id || "",
        issueTitle: redmineIssue?.title || msg.issueSummary,
        previewText: finalPreview,
      };
    },
    SEND_TO_REDMINE: (msg) => {
      return getSettings().then((settings) => {
        assertTrustedBacklogSender(sender, settings.backlogDomain);
        return TB_REQUEST_DEDUPER.run(
          TB_REQUEST_DEDUPER.createKey(msg.type, msg, getSenderScope(sender)),
          () => TB_COMMENT_SYNC.send(settings, msg, sender)
        );
      });
    },
    SEND_TO_BACKLOG: (msg) => {
      return getSettings().then((settings) => {
        assertTrustedRedmineSender(sender, settings.redmineDomain);
        return TB_REQUEST_DEDUPER.run(
          TB_REQUEST_DEDUPER.createKey(msg.type, msg, getSenderScope(sender)),
          () => TB_COMMENT_SYNC.send(settings, msg, sender)
        );
      });
    },
    GET_BACKLOG_ISSUE_INFO: async (msg) => {
      const settings = await getSettings();
      assertTrustedBacklogOrRedmineSender(sender, settings);
      assertSettings(settings, ["backlogApiKey"]);
      return getBacklogIssueInfo(msg.issueKey);
    },
    GET_BACKLOG_USERS: async (msg) => {
      const settings = await getSettings();
      assertTrustedBacklogOrRedmineSender(sender, settings);
      assertSettings(settings, ["backlogApiKey"]);
      return getBacklogUsers(msg.projectKey);
    },
    FETCH_REDMINE_METADATA: async (msg) => {
      const settings = await getSettings();
      assertTrustedBacklogSender(sender, settings.backlogDomain);
      return handleFetchMetadata(msg.endpoint);
    },
    FETCH_REDMINE_PROJECTS_WITH_KEY: ({ domain, apiKey }) => {
      assertOptionsSender(sender);
      return handleFetchProjectsWithCredentials(domain, apiKey);
    },
    FETCH_REDMINE_ACTIVITIES_WITH_KEY: ({ domain, apiKey }) => {
      assertOptionsSender(sender);
      return handleFetchActivitiesWithCredentials(domain, apiKey);
    },
    CREATE_REDMINE_ISSUE: async (msg) => {
      const baseSettings = await getSettings();
      assertTrustedBacklogSender(sender, baseSettings.backlogDomain);
      const settings = settingsForBacklog(
        baseSettings,
        msg.issueData?.backlogIssueKey || msg.issueData?.key || msg.issueKey
      );
      assertSettings(settings, ["redmineApiKey", "ai"]);
      return TB_MIGRATION.migrate(settings, msg);
    },
    REDMINE_AUTHORIZED_FETCH: async (msg) => {
      const settings = await getSettings();
      assertTrustedRedmineSender(sender, settings.redmineDomain);
      assertSettings(settings, ["redmineApiKey"]);
      return handleRedmineAuthorizedFetch(settings, msg);
    },
    EXTRACT_JAPANESE_CONTENT: async (msg) => {
      const baseSettings = await getSettings();
      assertTrustedRedmineSender(sender, baseSettings.redmineDomain);
      const settings = settingsForBacklog(baseSettings, msg.backlogIssueKey);
      const rules = TB.PROMPTS.TRANSLATION.normalize(settings.translationRules);
      if (rules.reverseMode === "original") return { previewText: msg.commentText };
      assertSettings(settings, ["ai"]);
      settings.isReverseTranslation = true;
      return {
        previewText: await translateText(
          msg.commentText,
          settings,
          null,
          TB.PROMPTS.USER,
          createAIStatusReporter(sender)
        ),
      };
    },
    TRANSLATE_TEXT_SIMPLE: async (msg) => {
      const baseSettings = await getSettings();
      assertTrustedBacklogSender(sender, baseSettings.backlogDomain);
      const settings = settingsForBacklog(baseSettings, msg.issueKey);
      if (!settings.defaultProjectId) {
        throw new Error(
          chrome.i18n.getMessage("options_translation_project_required") ||
            "Select a Redmine project to activate translation to Redmine."
        );
      }
      assertSettings(settings, ["ai"]);
      return {
        translatedText: await translateText(
          msg.text,
          settings,
          null,
          TB.PROMPTS.SIMPLE_TRANSLATE,
          createAIStatusReporter(sender)
        ),
      };
    },
    TRANSLATE_COMMENT_FULL: async (msg) => {
      const baseSettings = await getSettings();
      assertTrustedBacklogOrRedmineSender(sender, baseSettings);
      const settings = msg.issueKey ? settingsForBacklog(baseSettings, msg.issueKey) : baseSettings;
      try {
        settings.isReverseTranslation =
          new URL(sender.url).origin === new URL(settings.redmineDomain).origin;
      } catch (_error) {
        settings.isReverseTranslation = false;
      }
      if (!settings.isReverseTranslation && !settings.defaultProjectId) {
        throw new Error(
          chrome.i18n.getMessage("options_translation_project_required") ||
            "Select a Redmine project to activate translation to Redmine."
        );
      }
      assertSettings(settings, ["ai"]);
      return {
        translatedText: await translateText(
          msg.commentText,
          settings,
          msg.commentUrl || null,
          TB.PROMPTS.USER,
          createAIStatusReporter(sender)
        ),
      };
    },
  };

  const handler = handlers[message.type];
  if (handler) {
    Promise.resolve()
      .then(() => handler(message))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        const errorString = err instanceof Error ? err.message : String(err || "Unknown error");
        const isSettingsError = /api key|setting|cấu hình/i.test(errorString);
        console.error(`${DEBUG_PREFIX} Message handler error for '${message.type}':`, err);
        TB_LOGGER?.logError("Background", err, { messageType: message.type });
        sendResponse({ ok: false, error: errorString, isSettingsError });
      });
    return true; // Keep channel open for async response
  }
});

// ============================================================================
// Settings Management
// ============================================================================

let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 15000; // 15 seconds
const issueLookupCache = new Map();
const LOOKUP_CACHE_TTL = 60000; // 1 minute

function settingsForBacklog(settings, issueKey) {
  const scoped = TB_PROJECT_PROFILES.forBacklog(settings, issueKey || "");
  return {
    ...scoped,
    currentProjectKey: String(issueKey || "").replace(/-\d+$/, ""),
  };
}

/**
 * Loads, decrypts, and caches extension settings.
 * @returns {Promise<object>} Decrypted settings object.
 */
async function getSettings() {
  const now = Date.now();
  if (settingsCache && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }

  const keys = [
    "redmineApiKey",
    "redmineDomain",
    "backlogDomain",
    "backlogApiKey",
    "geminiApiKey",
    "geminiApiKeys",
    "geminiModels",
    "cerebrasApiKey",
    "cerebrasApiKeys",
    "cerebrasModels",
    "groqApiKey",
    "groqApiKeys",
    "groqModels",
    "openrouterApiKey",
    "openrouterApiKeys",
    "openrouterModels",
    "fallbackGeminiApiKeys",
    "fallbackGeminiModels",
    "fallbackCerebrasApiKey",
    "fallbackCerebrasApiKeys",
    "fallbackCerebrasModels",
    "fallbackGroqApiKey",
    "fallbackGroqApiKeys",
    "fallbackGroqModels",
    "fallbackOpenrouterApiKey",
    "fallbackOpenrouterApiKeys",
    "fallbackOpenrouterModels",
    "primaryProvider",
    "primaryModel",
    "fallbackProvider",
    "fallbackModel",
    "translationSourceLanguage",
    "translationTargetLanguage",
    "translationRules",
    "syncRules",
    "logTimeRules",
    "customFields",
    "projectProfiles",
    "defaultProjectId",
    "reportProjectId",
    "manualFields",
    "showRedmineSuccessModal",
  ];
  const items = await chrome.storage.local.get(keys);

  const geminiApiKeysStr = items.geminiApiKeys ? await decryptData(items.geminiApiKeys) : "";
  const geminiModelsStr = items.geminiModels ? await decryptData(items.geminiModels) : "";
  const cerebrasApiKeysStr = items.cerebrasApiKeys ? await decryptData(items.cerebrasApiKeys) : "";
  const cerebrasModelsStr = items.cerebrasModels ? await decryptData(items.cerebrasModels) : "";
  const groqApiKeysStr = items.groqApiKeys ? await decryptData(items.groqApiKeys) : "";
  const groqModelsStr = items.groqModels ? await decryptData(items.groqModels) : "";
  const openrouterApiKeysStr = items.openrouterApiKeys
    ? await decryptData(items.openrouterApiKeys)
    : "";
  const openrouterModelsStr = items.openrouterModels
    ? await decryptData(items.openrouterModels)
    : "";
  const fallbackCerebrasApiKeysStr = items.fallbackCerebrasApiKeys
    ? await decryptData(items.fallbackCerebrasApiKeys)
    : "";
  const fallbackCerebrasModelsStr = items.fallbackCerebrasModels
    ? await decryptData(items.fallbackCerebrasModels)
    : "";
  const fallbackGeminiApiKeysStr = items.fallbackGeminiApiKeys
    ? await decryptData(items.fallbackGeminiApiKeys)
    : "";
  const fallbackGeminiModelsStr = items.fallbackGeminiModels
    ? await decryptData(items.fallbackGeminiModels)
    : "";
  const fallbackGroqApiKeysStr = items.fallbackGroqApiKeys
    ? await decryptData(items.fallbackGroqApiKeys)
    : "";
  const fallbackGroqModelsStr = items.fallbackGroqModels
    ? await decryptData(items.fallbackGroqModels)
    : "";
  const fallbackOpenrouterApiKeysStr = items.fallbackOpenrouterApiKeys
    ? await decryptData(items.fallbackOpenrouterApiKeys)
    : "";
  const fallbackOpenrouterModelsStr = items.fallbackOpenrouterModels
    ? await decryptData(items.fallbackOpenrouterModels)
    : "";

  const translationLanguages = TB.PROMPTS.resolveLanguagePair(items);
  let projectProfiles = [];
  if (items.projectProfiles) {
    try {
      projectProfiles = JSON.parse(await decryptData(items.projectProfiles));
    } catch (error) {
      console.warn(`${DEBUG_PREFIX} Ignoring invalid encrypted project profiles.`, error);
    }
  }
  const decryptedSettings = {
    redmineDomain: items.redmineDomain || TB.REDMINE_DOMAIN,
    redmineApiKey: await decryptData(items.redmineApiKey ?? ""),
    backlogDomain: items.backlogDomain || TB.BACKLOG_DOMAIN,
    backlogApiKey: await decryptData(items.backlogApiKey ?? ""),
    primaryProvider: items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER,
    primaryModel: items.primaryModel ?? TB.DEFAULT_PRIMARY_MODEL,
    fallbackProvider: items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER,
    fallbackModel: items.fallbackModel ?? TB.DEFAULT_FALLBACK_MODEL,
    translationSourceLanguage: translationLanguages.source,
    translationTargetLanguage: translationLanguages.target,
    translationRules: TB.PROMPTS.TRANSLATION.safeNormalize(
      items.translationRules,
      translationLanguages.source,
      translationLanguages.target
    ),
    syncRules: TB_SYNC_RULES.normalize(items.syncRules),
    logTimeRules: TB_LOG_TIME_RULES.normalize(items.logTimeRules),
    customFields: TB_CUSTOM_FIELDS.normalize(items.customFields),
    projectProfiles: TB_PROJECT_PROFILES.normalize(projectProfiles, {
      backlogDomain: items.backlogDomain || TB.BACKLOG_DOMAIN,
      redmineDomain: items.redmineDomain || TB.REDMINE_DOMAIN,
    }),
    geminiApiKey: await decryptData(items.geminiApiKey ?? ""), // Legacy fallback
    geminiApiKeys: geminiApiKeysStr.split("\n").filter(Boolean),
    geminiModels: geminiModelsStr.split("\n").filter(Boolean),
    cerebrasApiKey: await decryptData(items.cerebrasApiKey ?? ""),
    cerebrasApiKeys: cerebrasApiKeysStr.split("\n").filter(Boolean),
    cerebrasModels: cerebrasModelsStr.split("\n").filter(Boolean),
    groqApiKey: await decryptData(items.groqApiKey ?? ""),
    groqApiKeys: groqApiKeysStr.split("\n").filter(Boolean),
    groqModels: groqModelsStr.split("\n").filter(Boolean),
    openrouterApiKey: await decryptData(items.openrouterApiKey ?? ""),
    openrouterApiKeys: openrouterApiKeysStr.split("\n").filter(Boolean),
    openrouterModels: openrouterModelsStr.split("\n").filter(Boolean),
    fallbackCerebrasApiKey: await decryptData(items.fallbackCerebrasApiKey ?? ""),
    fallbackGeminiApiKeys: fallbackGeminiApiKeysStr.split("\n").filter(Boolean),
    fallbackGeminiModels: fallbackGeminiModelsStr.split("\n").filter(Boolean),
    fallbackCerebrasApiKeys: fallbackCerebrasApiKeysStr.split("\n").filter(Boolean),
    fallbackCerebrasModels: fallbackCerebrasModelsStr.split("\n").filter(Boolean),
    fallbackGroqApiKey: await decryptData(items.fallbackGroqApiKey ?? ""),
    fallbackGroqApiKeys: fallbackGroqApiKeysStr.split("\n").filter(Boolean),
    fallbackGroqModels: fallbackGroqModelsStr.split("\n").filter(Boolean),
    fallbackOpenrouterApiKey: await decryptData(items.fallbackOpenrouterApiKey ?? ""),
    fallbackOpenrouterApiKeys: fallbackOpenrouterApiKeysStr.split("\n").filter(Boolean),
    fallbackOpenrouterModels: fallbackOpenrouterModelsStr.split("\n").filter(Boolean),
    defaultProjectId: items.defaultProjectId || "",
    reportProjectId: items.reportProjectId || "",
    manualFields: items.manualFields || "",
    showRedmineSuccessModal: items.showRedmineSuccessModal !== false,
  };

  settingsCache = decryptedSettings;
  settingsCacheTime = Date.now();
  return decryptedSettings;
}

/**
 * Clears the settings cache when storage is changed.
 */
chrome.storage.onChanged.addListener(() => {
  settingsCache = null;
  settingsCacheTime = 0;
  issueLookupCache.clear();
});

/**
 * Validates that essential settings are configured.
 * @param {object} settings - The settings object.
 * @param {Array<string>} required - A list of contexts to check ('redmineApiKey', 'ai', 'backlogApiKey').
 * @throws {Error} If a required setting is missing.
 */
function assertSettings(settings, required = []) {
  if (required.includes("redmineApiKey") && !settings.redmineApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  }
  if (required.includes("backlogApiKey") && !settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }
  if (required.includes("ai")) {
    const provider = settings.primaryProvider;
    if (
      provider === TB.PROVIDERS.GEMINI &&
      !settings.geminiApiKey &&
      settings.geminiApiKeys.length === 0
    ) {
      throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
    }
    if (
      provider === TB.PROVIDERS.GROQ &&
      !settings.groqApiKey &&
      settings.groqApiKeys.length === 0
    ) {
      throw new Error("Missing Groq API Key.");
    }
    if (
      provider === TB.PROVIDERS.CEREBRAS &&
      !settings.cerebrasApiKey &&
      settings.cerebrasApiKeys.length === 0
    ) {
      throw new Error("Missing Cerebras API Key.");
    }
    if (
      provider === TB.PROVIDERS.OPENROUTER &&
      !settings.openrouterApiKey &&
      settings.openrouterApiKeys.length === 0
    ) {
      throw new Error("Missing OpenRouter API Key.");
    }
  }
}

// ============================================================================
// Caching & Utility Functions
// ============================================================================

async function findRedmineIssueWithCache(
  domain,
  apiKey,
  issueKey,
  summary,
  backlogIssueType = "",
  syncRules = {},
  projectId = ""
) {
  const cacheKey = JSON.stringify([
    domain,
    issueKey,
    summary,
    backlogIssueType || "",
    syncRules,
    projectId,
  ]);
  const now = Date.now();
  const cached = issueLookupCache.get(cacheKey);

  if (cached && now - cached.time < LOOKUP_CACHE_TTL) {
    return cached.data;
  }

  const result = await findRedmineIssue(
    domain,
    apiKey,
    issueKey,
    summary,
    backlogIssueType,
    syncRules,
    projectId
  );
  issueLookupCache.set(cacheKey, { data: result, time: now });
  return result;
}

async function handleFetchMetadata(endpoint) {
  const settings = await getSettings();
  assertSettings(settings, ["redmineApiKey"]);
  assertAllowedRedmineMetadataEndpoint(endpoint);
  const url = buildRedmineUrl(settings.redmineDomain, endpoint);
  const response = await timeoutFetch(
    url,
    {
      redirect: "error",
      headers: { "X-Redmine-API-Key": settings.redmineApiKey, Accept: "application/json" },
    },
    10000
  );

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.API_REQUEST_FAILED} (${response.status}) for ${endpoint}`
    );
  }
  return await response.json();
}

async function handleFetchProjectsWithCredentials(domain, apiKey) {
  await assertRedmineHostPermission(domain);
  if (!apiKey) {
    throw new Error("Missing Redmine API key.");
  }
  const projects = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const url = new URL("/projects.json", domain);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const response = await timeoutFetch(
      url.toString(),
      {
        redirect: "error",
        headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
      },
      10000
    );
    if (!response.ok) {
      throw new Error(`Redmine projects request failed (${response.status}).`);
    }
    const data = await safeReadJson(response);
    const page = data?.projects;
    if (!Array.isArray(page)) throw new Error("Redmine returned an invalid projects list.");
    projects.push(...page);
    const total = Number(data.total_count);
    if (
      page.length === 0 ||
      page.length < limit ||
      (Number.isFinite(total) && projects.length >= total)
    ) {
      break;
    }
  }
  return projects;
}

async function handleFetchActivitiesWithCredentials(domain, apiKey) {
  await assertRedmineHostPermission(domain);
  if (!apiKey) throw new Error("Missing Redmine API key.");
  const response = await timeoutFetch(
    new URL("/enumerations/time_entry_activities.json", domain).toString(),
    {
      redirect: "error",
      headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
    },
    10000
  );
  if (!response.ok) {
    throw new Error(`Redmine activities request failed (${response.status}).`);
  }
  const data = await safeReadJson(response);
  return data?.time_entry_activities || [];
}

async function fetchRedmineProjectById(domain, apiKey, projectId) {
  await assertRedmineHostPermission(domain);
  if (!apiKey || !projectId) return null;
  const safeProjectId = encodeURIComponent(String(projectId));
  const response = await timeoutFetch(
    new URL(`/projects/${safeProjectId}.json`, domain).toString(),
    { redirect: "error", headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" } },
    10000
  );
  if (!response.ok) throw new Error(`Redmine project request failed (${response.status}).`);
  const data = await safeReadJson(response);
  const project = data?.project;
  return project ? { id: project.id, name: project.name } : null;
}

async function assertRedmineHostPermission(domain) {
  const normalizedDomain = TB_REDMINE_DOMAIN.normalize(domain);
  if (TB_REDMINE_DOMAIN.isDefault(normalizedDomain, TB.REDMINE_DOMAIN)) return;

  const granted = await chrome.permissions.contains({
    origins: [TB_REDMINE_DOMAIN.toMatchPattern(normalizedDomain)],
  });
  if (!granted) {
    throw new Error("Redmine host permission has not been granted.");
  }
}

function createProviderTestSettings(provider, apiKey) {
  if (!apiKey) throw new Error("Missing provider API key.");
  return {
    geminiApiKey: provider === TB.PROVIDERS.GEMINI ? apiKey : "",
    geminiApiKeys: provider === TB.PROVIDERS.GEMINI ? [apiKey] : [],
    groqApiKey: provider === TB.PROVIDERS.GROQ ? apiKey : "",
    cerebrasApiKey: provider === TB.PROVIDERS.CEREBRAS ? apiKey : "",
    openrouterApiKey: provider === TB.PROVIDERS.OPENROUTER ? apiKey : "",
  };
}

function assertAllowedRedmineMetadataEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
    throw new Error("Unsupported Redmine metadata endpoint.");
  }

  const parsedEndpoint = new URL(endpoint, "https://redmine.local");
  const pathname = parsedEndpoint.pathname;
  const allowedPatterns = [
    /^\/projects\.json$/,
    /^\/issues\/\d+\.json$/,
    /^\/trackers\.json$/,
    /^\/enumerations\/issue_priorities\.json$/,
    /^\/projects\/\d+\/versions\.json$/,
  ];

  if (!allowedPatterns.some((pattern) => pattern.test(pathname))) {
    throw new Error("Unsupported Redmine metadata endpoint.");
  }

  if (pathname === "/projects.json") {
    const limit = parsedEndpoint.searchParams.get("limit");
    if (limit && !/^\d+$/.test(limit)) {
      throw new Error("Unsupported Redmine metadata query.");
    }
    return;
  }

  if (parsedEndpoint.search) {
    throw new Error("Unsupported Redmine metadata query.");
  }
}

function assertTrustedRedmineSender(sender, redmineDomain) {
  if (TB_SETTINGS_VIEW.hasSameOrigin(sender?.url || sender?.tab?.url, redmineDomain)) return;

  throw new Error("Redmine report settings are unavailable for this page.");
}

function assertTrustedBacklogSender(sender, backlogDomain = "") {
  const senderUrl = sender?.url || sender?.tab?.url || "";
  try {
    const configured = getTrustedBacklogApiOrigin(backlogDomain || TB.BACKLOG_DOMAIN);
    if (new URL(senderUrl).origin === configured) {
      return;
    }
  } catch (_error) {
    // fall through
  }
  throw new Error("This operation requires the Backlog workspace configured in settings.");
}

function assertTrustedBacklogOrRedmineSender(sender, settings) {
  try {
    assertTrustedBacklogSender(sender, settings.backlogDomain);
    return;
  } catch (_backlogError) {
    assertTrustedRedmineSender(sender, settings.redmineDomain);
  }
}

function assertTrustedExtensionPageSender(sender, settings) {
  try {
    assertOptionsSender(sender);
    return;
  } catch (_optionsError) {
    assertTrustedBacklogOrRedmineSender(sender, settings);
  }
}

function assertOptionsSender(sender) {
  if (sender?.url !== chrome.runtime.getURL("src/options.html")) {
    throw new Error("This operation is only available from the options page.");
  }
}

function createAIStatusReporter(sender) {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) return () => {};
  const options = Number.isInteger(sender.frameId) ? { frameId: sender.frameId } : undefined;
  return (status) => {
    chrome.tabs.sendMessage(tabId, { type: "TB_AI_STATUS", status }, options).catch(() => {});
  };
}

async function handleRedmineAuthorizedFetch(settings, msg) {
  assertAllowedRedmineAuthorizedPath(msg.path);
  const method = String(msg.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
    throw new Error("Unsupported Redmine method.");
  }
  if (method === "DELETE") {
    const match = /^\/time_entries\/(\d+)\.json$/.exec(msg.path);
    if (!match) throw new Error("Deletion is only allowed for an approved time entry.");
    await deleteTimeEntry(
      settings.redmineDomain,
      settings.redmineApiKey,
      match[1],
      msg.deletionApproval
    );
    return { status: 204, payload: null, text: "" };
  }
  if (method === "PUT" && /^\/time_entries\/\d+\.json$/.test(msg.path)) {
    const body = JSON.parse(msg.body || "null")?.time_entry;
    const approval = msg.mutationApproval;
    if (
      !body ||
      !approval ||
      String(body.issue_id) !== String(approval.targetIssueId) ||
      body.spent_on !== approval.date ||
      body.comments !== `[B2R report:${approval.reportId}]` ||
      !Number.isFinite(Number(body.hours)) ||
      Number(body.hours) < 0
    ) {
      throw new Error("Time-entry update does not match the approved plan.");
    }
    await updateTimeEntry(
      settings.redmineDomain,
      settings.redmineApiKey,
      msg.path.match(/\d+/)[0],
      body.issue_id,
      body.hours,
      body.comments,
      body.spent_on,
      body.activity_id,
      approval
    );
    return { status: 204, payload: null, text: "" };
  }

  const url = buildRedmineUrl(settings.redmineDomain, msg.path);
  const headers = {
    "X-Redmine-API-Key": settings.redmineApiKey,
    Accept: msg.accept || "application/json",
  };
  if (msg.contentType) {
    headers["Content-Type"] = msg.contentType;
  }

  const response = await timeoutFetch(
    url,
    {
      method,
      redirect: "error",
      headers,
      body: msg.body || undefined,
    },
    30000
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(text || `HTTP ${response.status}`, response.status));
  }

  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = null;
    }
  }

  return {
    status: response.status,
    payload,
    text,
  };
}

function assertAllowedRedmineAuthorizedPath(path) {
  let pathname;
  try {
    pathname = new URL(path, "https://redmine.local").pathname;
  } catch (_error) {
    throw new Error("Unsupported Redmine path.");
  }

  const allowed = [
    /^\/my\/account\.json$/,
    /^\/users\/current\.json$/,
    /^\/issues\.json$/,
    /^\/issues\/\d+\.json$/,
    /^\/trackers\.json$/,
    /^\/time_entries\.json$/,
    /^\/time_entries\/\d+\.json$/,
    /^\/enumerations\/time_entry_activities\.json$/,
  ];

  if (!allowed.some((pattern) => pattern.test(pathname))) {
    throw new Error("Unsupported Redmine path.");
  }
}
function getSenderScope(sender) {
  const senderUrl = sender?.tab?.url || sender?.url || "";
  try {
    return new URL(senderUrl).origin;
  } catch {
    return senderUrl;
  }
}

async function syncCustomRedmineRegistration() {
  const { redmineDomain = TB.REDMINE_DOMAIN } = await chrome.storage.local.get("redmineDomain");
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID],
    });
  } catch (_error) {
    // No custom registration exists yet.
  }

  if (TB_REDMINE_DOMAIN.isDefault(redmineDomain, TB.REDMINE_DOMAIN)) return;
  const originPattern = TB_REDMINE_DOMAIN.toMatchPattern(redmineDomain);
  const granted = await chrome.permissions.contains({ origins: [originPattern] });
  if (!granted) return;

  await chrome.scripting.registerContentScripts([
    {
      id: TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID,
      matches: [originPattern],
      js: TB_REDMINE_DOMAIN.CONTENT_SCRIPTS,
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
  await injectIntoOpenCustomRedmineTabs(originPattern);
}

async function injectIntoOpenCustomRedmineTabs(originPattern) {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: [originPattern] });
  } catch (error) {
    await TB_LOGGER.logError("Background", error, {
      operation: "queryOpenCustomRedmineTabs",
    });
    return;
  }

  await Promise.all(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map(async (tab) => {
        try {
          const probe = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => Boolean(globalThis.__B2R_REDMINE_LOADED__),
          });
          if (probe[0]?.result) return;
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: TB_REDMINE_DOMAIN.CONTENT_SCRIPTS,
          });
        } catch (error) {
          await TB_LOGGER.logError("Background", error, {
            operation: "injectOpenCustomRedmineTab",
            tabId: tab.id,
          });
        }
      })
  );
}
