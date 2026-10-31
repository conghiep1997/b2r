/* global TB_SYNC_RULES, TB_LOG_TIME_RULES, TB_CUSTOM_FIELDS, TB_OPTIONS_PROJECT_PROFILES */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof TB === "undefined") {
    console.error("[OPTIONS] TB is not defined! constants.js may not have loaded.");
    return;
  }

  let cachedProjects = null;
  let cachedProjectsFingerprint = "";
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5 * 60 * 1000;
  const DEFAULT_MANUAL_FIELDS = {
    Severity: 46,
    "Reproduction Rate": 0,
    Role: 11,
    "QC Activity": 8,
    "Q&A Category": 58,
  };

  let optionsMessages = {};
  await localizeOptions();
  const vBadge = document.getElementById("optionsVersionBadge");
  if (vBadge) {
    try {
      const manifest = chrome.runtime.getManifest?.();
      if (manifest?.version) {
        vBadge.textContent = `v${manifest.version}`;
      }
    } catch {
      // ignore
    }
  }

  async function localizeOptions() {
    const { languagePreference } = await chrome.storage.local.get("languagePreference");
    const language = languagePreference || "en";
    try {
      const response = await fetch(`../_locales/${language}/messages.json`);
      if (!response.ok) return;
      const messages = await response.json();
      optionsMessages = messages;
      document.querySelectorAll("[data-i18n]").forEach((element) => {
        const message = messages[element.dataset.i18n]?.message;
        if (message) element.textContent = message;
      });
    } catch (_error) {
      // Keep the default Vietnamese labels when the catalog is unavailable.
    }
  }

  function om(key, fallback = key) {
    return optionsMessages[key]?.message || fallback;
  }

  function escapeHtml(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
  }

  function localizeOptionsDetails() {
    document.title = om("options_document_title", document.title);
    const heroSubtitle = document.querySelector(".hero p");
    if (heroSubtitle) heroSubtitle.textContent = om("options_subtitle", heroSubtitle.textContent);
    const placeholders = {
      redmineApiKey: "options_redmine_key_placeholder",
      backlogApiKey: "options_backlog_key_placeholder",
      bugTitle: "options_bug_subject_placeholder",
      bugDescription: "options_bug_description_placeholder",
      bugSteps: "options_bug_steps_placeholder",
      bugPageUrl: "options_bug_url_placeholder",
      backlogDomain: "options_backlog_domain_placeholder",
    };
    Object.entries(placeholders).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) element.placeholder = om(key, element.placeholder);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = om(element.dataset.i18nPlaceholder, element.placeholder);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.alt = om(element.dataset.i18nAlt, element.alt);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute(
        "aria-label",
        om(element.dataset.i18nAriaLabel, element.getAttribute("aria-label"))
      );
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = om(element.dataset.i18nTitle, element.title);
    });
    const defaultProjectOption = document.querySelector("#defaultProjectId option[value='']");
    if (defaultProjectOption) {
      defaultProjectOption.textContent = om(
        "options_save_api_first",
        defaultProjectOption.textContent
      );
    }
    const primaryFallback = document.querySelector("#fallbackProvider option[value='none']");
    if (primaryFallback) {
      primaryFallback.textContent = om("options_no_fallback", primaryFallback.textContent);
    }

    const providerOptions = {
      "#primaryProvider option[value='gemini']": "options_gemini_provider",
      "#primaryProvider option[value='groq']": "options_groq_provider",
      "#primaryProvider option[value='cerebras']": "options_cerebras_provider",
      "#primaryProvider option[value='openrouter']": "options_openrouter_provider",
      "#fallbackProvider option[value='gemini']": "options_gemini_fallback",
      "#fallbackProvider option[value='groq']": "options_groq_fallback",
      "#fallbackProvider option[value='cerebras']": "options_cerebras_fallback",
      "#fallbackProvider option[value='openrouter']": "options_openrouter_fallback",
    };
    Object.entries(providerOptions).forEach(([selector, key]) => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = om(key, element.textContent);
      }
    });
    const providerLinkLabels = {
      "#primaryGroqConfig a, #fallbackGroqConfig a": "options_groq_get_key",
      "#primaryCerebrasConfig a, #fallbackCerebrasConfig a": "options_cerebras_get_key",
      "#primaryOpenrouterConfig a, #fallbackOpenrouterConfig a": "options_openrouter_get_key",
    };
    Object.entries(providerLinkLabels).forEach(([selector, key]) => {
      document.querySelectorAll(selector).forEach((link) => {
        link.textContent = om(key, link.textContent);
      });
    });
    const successHelp = document
      .getElementById("showRedmineSuccessModal")
      ?.parentElement?.querySelector("p");
    if (successHelp) {
      successHelp.textContent = om("options_success_modal_help", successHelp.textContent);
    }

    const bugSection = document.getElementById("bugTitle")?.closest("section");
    const bugDescription = bugSection?.querySelector("p");
    if (bugDescription) {
      bugDescription.textContent = om("options_bug_description", bugDescription.textContent);
    }
    const actionText = {
      downloadBugReportBtn: "options_download_report",
      copyBugReportBtn: "options_copy_report",
      openGithubIssueBtn: "options_open_github",
      exportLogsBtn: "options_export_logs",
      clearLogsBtn: "options_clear_logs",
      checkUpdateBtn: "options_check_update",
      goToDashboardBtn: "options_download_page",
    };
    Object.entries(actionText).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = om(key, element.textContent);
      }
    });

    const logHeading = document
      .getElementById("exportLogsBtn")
      ?.closest("div[style]")
      ?.querySelector("h3");
    if (logHeading) {
      logHeading.textContent = om("options_logs_title", logHeading.textContent);
    }
    const updateStatus = document.querySelector("#updateStatus p");
    if (updateStatus) {
      updateStatus.textContent = om("options_update_checking", updateStatus.textContent);
    }
    const logsDescription = document
      .getElementById("exportLogsBtn")
      ?.closest("div")?.previousElementSibling;
    if (logsDescription?.tagName === "P") {
      logsDescription.textContent = om("options_logs_description", logsDescription.textContent);
    }
    const supportNote = document.getElementById("supportNote");
    if (supportNote) supportNote.textContent = om("options_support_note", supportNote.textContent);
    const disclaimer = document.querySelector(".disclaimer");
    if (disclaimer) disclaimer.textContent = om("options_disclaimer", disclaimer.textContent);
  }

  localizeOptionsDetails();
  document.dispatchEvent(new CustomEvent("options-localized", { detail: optionsMessages }));

  chrome.storage.local.get("syncActivity").then(({ syncActivity = [] }) => {
    renderSyncActivity(syncActivity);
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.syncActivity) {
      renderSyncActivity(changes.syncActivity.newValue || []);
    }
  });

  function sendBackgroundRequest(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Unknown background error."));
          return;
        }
        resolve(response.data);
      });
    });
  }

  const form = document.getElementById("optionsForm");
  const languagePreference = document.getElementById("languagePreference");
  const themePreference = document.getElementById("themePreference");
  const themeToggleBtns = document.querySelectorAll(".theme-toggle-btn");
  const redmineApiKeyInput = document.getElementById("redmineApiKey");
  const backlogApiKeyInput = document.getElementById("backlogApiKey");
  const groqApiKeyInput = document.getElementById("groqApiKey");
  const cerebrasApiKeyInput = document.getElementById("cerebrasApiKey");
  const openrouterApiKeyInput = document.getElementById("openrouterApiKey");
  const fallbackGroqApiKeyInput = document.getElementById("fallbackGroqApiKey");
  const fallbackCerebrasApiKeyInput = document.getElementById("fallbackCerebrasApiKey");
  const fallbackOpenrouterApiKeyInput = document.getElementById("fallbackOpenrouterApiKey");
  const fallbackGeminiApiKeysInput = document.getElementById("fallbackGeminiApiKeys");
  const primaryProviderSelect = document.getElementById("primaryProvider");
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const showRedmineSuccessModalInput = document.getElementById("showRedmineSuccessModal");
  const statusEl = document.getElementById("status");

  const SCIENCE_ICON_SVG =
    globalThis.TB_ICONS?.SCIENCE ||
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M19 19H5v-1l4-5V5h-1V3h8v2h-1v8l4 5v1zm-7-7.2L8.5 17h7L12 11.8zM11 5v4.8L9.2 12h5.6L13 9.8V5h-2z"/></svg>';
  const SPINNER_ICON_SVG =
    globalThis.TB_ICONS?.SPINNER ||
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" class="is-spinning" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>';
  const CHECK_ICON_SVG =
    globalThis.TB_ICONS?.CHECK ||
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  const CLOSE_ICON_SVG =
    globalThis.TB_ICONS?.CLOSE ||
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function syncThemeToggleUI(theme) {
    themeToggleBtns.forEach((btn) => {
      const isActive = btn.dataset.themeVal === theme;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }

  chrome.storage.local.get(["languagePreference", "themePreference"], (settings) => {
    const storedLanguage = settings.languagePreference;
    const storedTheme = settings.themePreference;
    languagePreference.value = storedLanguage || "en";
    const initialTheme = storedTheme || "system";
    themePreference.value = initialTheme;
    syncThemeToggleUI(initialTheme);
    applyTheme(initialTheme);
  });
  languagePreference.addEventListener("change", async () => {
    await chrome.storage.local.set({ languagePreference: languagePreference.value });
    await localizeOptions();
    localizeOptionsDetails();
    document.dispatchEvent(new CustomEvent("options-localized", { detail: optionsMessages }));
    updateOnboardingStatuses();
    const { syncActivity = [] } = await chrome.storage.local.get("syncActivity");
    renderSyncActivity(syncActivity);
  });
  themePreference.addEventListener("change", () => {
    syncThemeToggleUI(themePreference.value);
    chrome.storage.local.set({ themePreference: themePreference.value });
    applyTheme(themePreference.value);
  });
  themeToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.themeVal;
      if (!selected || themePreference.value === selected) return;
      themePreference.value = selected;
      syncThemeToggleUI(selected);
      chrome.storage.local.set({ themePreference: selected });
      applyTheme(selected);
    });
  });

  function applyTheme(theme) {
    const resolved =
      theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.dataset.theme = resolved;
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themePreference.value === "system") applyTheme("system");
  });
  const PRIMARY_PROVIDER_CONFIGS = [
    {
      provider: "groq",
      keyInput: groqApiKeyInput,
      keysStorage: "groqApiKeys",
      modelsStorage: "groqModels",
    },
    {
      provider: "cerebras",
      keyInput: cerebrasApiKeyInput,
      keysStorage: "cerebrasApiKeys",
      modelsStorage: "cerebrasModels",
    },
    {
      provider: "openrouter",
      keyInput: openrouterApiKeyInput,
      keysStorage: "openrouterApiKeys",
      modelsStorage: "openrouterModels",
    },
  ];
  const FALLBACK_PROVIDER_CONFIGS = [
    {
      provider: "groq",
      keyInput: fallbackGroqApiKeyInput,
      keysStorage: "fallbackGroqApiKeys",
      modelsStorage: "fallbackGroqModels",
    },
    {
      provider: "cerebras",
      keyInput: fallbackCerebrasApiKeyInput,
      keysStorage: "fallbackCerebrasApiKeys",
      modelsStorage: "fallbackCerebrasModels",
    },
    {
      provider: "openrouter",
      keyInput: fallbackOpenrouterApiKeyInput,
      keysStorage: "fallbackOpenrouterApiKeys",
      modelsStorage: "fallbackOpenrouterModels",
    },
  ];

  if (!form || !primaryProviderSelect || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  initProviderMultiControls();
  renderGeminiModelsTags(
    (TB.GEMINI_MODELS || []).filter((model) => model.default).map((model) => model.value)
  );
  loadOptions();

  if (location.hash === "#reportProjectId") {
    requestAnimationFrame(() => {
      const project = document.getElementById("defaultProjectId");
      project?.scrollIntoView({ behavior: "smooth", block: "center" });
      project?.focus({ preventScroll: true });
    });
  }

  primaryProviderSelect.addEventListener("change", () =>
    handleProviderChange(primaryProviderSelect)
  );
  fallbackProviderSelect.addEventListener("change", () =>
    handleProviderChange(fallbackProviderSelect)
  );
  redmineApiKeyInput.addEventListener("blur", handleRedmineKeyBlur);
  // --- Automatic Verification on Input / Configuration Change ---
  let backlogAutoCheckTimer = null;
  function scheduleAutoCheckBacklog() {
    clearTimeout(backlogAutoCheckTimer);
    backlogAutoCheckTimer = setTimeout(() => {
      const key = backlogApiKeyInput.value.trim();
      if (key && key !== "**********" && key.length >= 16) {
        handleBacklogConnectionTest();
      }
    }, 700);
  }

  let aiAutoCheckTimer = null;
  function scheduleAutoCheckPrimaryAi() {
    clearTimeout(aiAutoCheckTimer);
    aiAutoCheckTimer = setTimeout(() => {
      const provider = primaryProviderSelect.value;
      const key = provider === "gemini" ? getFirstGeminiKey() : getProviderKeys("primary", provider)[0];
      if (key && key !== "**********") {
        handlePrimaryAiTest();
      }
    }, 700);
  }

  backlogApiKeyInput.addEventListener("blur", () => {
    const key = backlogApiKeyInput.value.trim();
    if (key && key !== "**********" && key.length >= 16) {
      handleBacklogConnectionTest();
    }
  });
  backlogApiKeyInput.addEventListener("input", scheduleAutoCheckBacklog);

  document.getElementById("geminiApiKeys")?.addEventListener("blur", scheduleAutoCheckPrimaryAi);
  groqApiKeyInput?.addEventListener("blur", scheduleAutoCheckPrimaryAi);
  cerebrasApiKeyInput?.addEventListener("blur", scheduleAutoCheckPrimaryAi);
  openrouterApiKeyInput?.addEventListener("blur", scheduleAutoCheckPrimaryAi);

  document.getElementById("defaultProjectId")?.addEventListener("change", async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      const stored = await chrome.storage.local.get(["redmineApiKey", "redmineDomain"]);
      if (stored.redmineApiKey) {
        const key = await decryptData(stored.redmineApiKey);
        const domain = stored.redmineDomain || TB.REDMINE_DOMAIN;
        const fp = await verificationFingerprint([TB_REDMINE_DOMAIN.normalize(domain), key]);
        await chrome.storage.local.set({ defaultProjectId: selectedId, redmineConnectionVerified: fp });
        updateOnboardingStatuses();
      }
    }
  });
  document.getElementById("syncProjectsBtn")?.addEventListener("click", handleSyncProjects);
  document
    .getElementById("testBacklogConnectionBtn")
    ?.addEventListener("click", () => handleBacklogConnectionTest());
  document
    .getElementById("testBacklogTabBtn")
    ?.addEventListener("click", () => handleBacklogConnectionTest());
  document
    .getElementById("testPrimaryAiBtn")
    ?.addEventListener("click", () => handlePrimaryAiTest());
  document
    .getElementById("testPrimaryAiTabBtn")
    ?.addEventListener("click", () => handlePrimaryAiTest());
  document.getElementById("clearSyncActivityBtn")?.addEventListener("click", async () => {
    try {
      await sendBackgroundRequest({ type: "CLEAR_SYNC_ACTIVITY" });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  document.getElementById("clearTranslationCacheBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const tabStatus = document.getElementById("primaryAiTabStatus");
    try {
      await sendBackgroundRequest({ type: "CLEAR_TRANSLATION_CACHE" });
      const msg = om("options_translation_cache_cleared", "Đã xóa bộ nhớ đệm bản dịch!");
      setStatus(msg);
      if (tabStatus) {
        tabStatus.textContent = `✓ ${msg}`;
        tabStatus.className = "status status-success";
      }
      btn.textContent = "✓";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = om("options_clear_translation_cache", "Xóa bộ nhớ đệm dịch");
      }, 1200);
    } catch (err) {
      setStatus(err.message, true);
      if (tabStatus) {
        tabStatus.textContent = `❌ ${err.message}`;
        tabStatus.className = "status status-error";
      }
      btn.disabled = false;
    }
  });
  function switchTab(panelId) {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");
    const stickyBar = document.querySelector(".form-sticky-bar");

    tabButtons.forEach((btn) => {
      const isSelected = btn.getAttribute("data-panel") === panelId;
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    tabPanels.forEach((panel) => {
      panel.hidden = panel.id !== `tab-panel-${panelId}`;
    });

    if (stickyBar) {
      stickyBar.hidden = panelId === "advanced";
    }

    chrome.storage.local.set({ b2r_active_tab: panelId }).catch(() => {});
  }

  document.querySelectorAll(".tab-btn[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-panel"));
    });
  });

  // Restore last active tab
  chrome.storage.local.get("b2r_active_tab", (result) => {
    switchTab(result.b2r_active_tab || "redmine");
  });

  // Onboarding card persistence & toggle
  chrome.storage.local.get("b2r_onboarding_dismissed", (result) => {
    const card = document.getElementById("onboardingCard");
    const helpBtn = document.getElementById("topBarHelpBtn");
    if (card && result.b2r_onboarding_dismissed) {
      card.hidden = true;
      if (helpBtn) helpBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("dismissOnboardingBtn")?.addEventListener("click", () => {
    const card = document.getElementById("onboardingCard");
    const helpBtn = document.getElementById("topBarHelpBtn");
    if (card) {
      card.hidden = true;
    }
    if (helpBtn) helpBtn.setAttribute("aria-expanded", "false");
    chrome.storage.local.set({ b2r_onboarding_dismissed: true });
  });

  function showOnboardingGuide(toggle = false) {
    const card = document.getElementById("onboardingCard");
    const helpBtn = document.getElementById("topBarHelpBtn");
    if (!card) return;

    if (toggle && !card.hidden) {
      card.hidden = true;
      if (helpBtn) helpBtn.setAttribute("aria-expanded", "false");
      chrome.storage.local.set({ b2r_onboarding_dismissed: true });
      return;
    }

    card.hidden = false;
    if (helpBtn) helpBtn.setAttribute("aria-expanded", "true");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.remove("highlight-target");
    void card.offsetWidth;
    card.classList.add("highlight-target");
    setTimeout(() => card.classList.remove("highlight-target"), 1200);
    chrome.storage.local.set({ b2r_onboarding_dismissed: false });
  }

  document
    .getElementById("topBarHelpBtn")
    ?.addEventListener("click", () => showOnboardingGuide(true));
  document
    .getElementById("reopenOnboardingBtn")
    ?.addEventListener("click", () => showOnboardingGuide(false));

  document.querySelectorAll("#onboardingCard a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      const targetId = link.getAttribute("href").slice(1);
      const sectionToTab = {
        redmineSettings: "redmine",
        backlogSettings: "backlog",
        primaryAiSettings: "ai",
        fallbackAiSettings: "ai",
        uiSettings: "ui",
        projectProfilesSettings: "profiles",
        advancedSettings: "advanced",
      };
      const tabId = sectionToTab[targetId];
      if (tabId) {
        switchTab(tabId);
      }
      const section = document.getElementById(targetId);
      if (section instanceof HTMLDetailsElement) {
        section.open = true;
      }
    });
  });
  document.getElementById("swapTranslationLanguages")?.addEventListener("click", () => {
    const sourceSelect = document.getElementById("translation_source");
    const targetSelect = document.getElementById("translation_target");
    if (!sourceSelect || !targetSelect) return;
    const temp = sourceSelect.value;
    sourceSelect.value = targetSelect.value;
    targetSelect.value = temp;
    sourceSelect.dispatchEvent(new Event("change"));
    targetSelect.dispatchEvent(new Event("change"));
  });

  document.getElementById("geminiApiKeys")?.addEventListener("keydown", handleGeminiKeyInput);
  fallbackGeminiApiKeysInput?.addEventListener("keydown", handleFallbackGeminiKeyInput);
  document.getElementById("checkUpdateBtn")?.addEventListener("click", handleManualUpdateCheck);
  document
    .getElementById("goToDashboardBtn")
    ?.addEventListener("click", () => chrome.tabs.create({ url: "https://hipppo.vercel.app/" }));
  document.getElementById("exportLogsBtn")?.addEventListener("click", handleExportLogs);
  document.getElementById("clearLogsBtn")?.addEventListener("click", handleClearLogs);
  document.getElementById("exportConfigBtn")?.addEventListener("click", handleExportConfig);
  document.getElementById("importConfigBtn")?.addEventListener("click", () => {
    document.getElementById("importConfigFileInput")?.click();
  });
  document.getElementById("importConfigFileInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportConfig(file);
    }
    event.target.value = "";
  });
  setupBugReport();
  setupRetryQueueUI();

  function setupBugReport() {
    const fileInput = document.getElementById("bugScreenshot");
    const preview = document.getElementById("bugScreenshotPreview");
    let previewUrl = null;
    preview?.addEventListener("error", () => {
      preview.hidden = true;
      setBugReportStatus(
        om("options_screenshot_preview_failed", "Unable to preview this image."),
        true
      );
    });
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        preview.hidden = true;
        preview.removeAttribute("src");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        fileInput.value = "";
        setBugReportStatus(om("options_screenshot_too_large"), true);
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      preview.hidden = true;
      preview.onload = () => {
        preview.hidden = false;
      };
      preview.src = previewUrl;
    });
    document.getElementById("downloadBugReportBtn")?.addEventListener("click", downloadBugReport);
    document.getElementById("copyBugReportBtn")?.addEventListener("click", copyBugReport);
    document.getElementById("openGithubIssueBtn")?.addEventListener("click", openGithubIssue);
  }

  function setupRetryQueueUI() {
    const listContainer = document.getElementById("retryQueueList");
    const emptyNotice = document.getElementById("retryQueueEmpty");
    const statusElem = document.getElementById("retryQueueStatus");
    const retryAllBtn = document.getElementById("retryAllQueueBtn");
    const clearBtn = document.getElementById("clearRetryQueueBtn");
    const refreshBtn = document.getElementById("refreshRetryQueueBtn");
    if (!listContainer) return;

    function setQueueStatus(msg, isError = false) {
      if (statusElem) {
        statusElem.textContent = msg;
        statusElem.style.color = isError ? "#ef4444" : "#10b981";
        if (msg) {
          setTimeout(() => {
            if (statusElem.textContent === msg) statusElem.textContent = "";
          }, 4000);
        }
      }
    }

    async function refreshQueue() {
      try {
        const queue = (await chrome.runtime.sendMessage({ type: "GET_RETRY_QUEUE" })) || [];
        listContainer.replaceChildren();

        if (emptyNotice) {
          emptyNotice.hidden = queue.length > 0;
        }
        if (retryAllBtn) {
          retryAllBtn.disabled = queue.length === 0;
        }

        queue.forEach((item) => {
          const row = document.createElement("div");
          row.className = "retry-queue-item";

          const info = document.createElement("div");
          info.className = "retry-queue-item__info";

          const title = document.createElement("div");
          title.className = "retry-queue-item__title";
          title.textContent = item.label || item.type;

          const meta = document.createElement("div");
          meta.className = "retry-queue-item__meta";
          const dateStr = new Date(item.timestamp).toLocaleString();
          meta.textContent = `${dateStr} · Loại: ${item.type} · Đã thử lại: ${item.retryCount || 0}/${item.maxRetries || 3}`;

          info.append(title, meta);

          if (item.error) {
            const errDiv = document.createElement("div");
            errDiv.className = "retry-queue-item__error";
            errDiv.textContent = `❌ ${item.error}`;
            info.append(errDiv);
          }

          const actions = document.createElement("div");
          actions.className = "retry-queue-item__actions";

          const retryBtn = document.createElement("button");
          retryBtn.type = "button";
          retryBtn.className = "secondary";
          retryBtn.textContent = om("options_retry_item", "Thử lại");
          retryBtn.addEventListener("click", async () => {
            retryBtn.disabled = true;
            retryBtn.textContent = "⏳...";
            try {
              await chrome.runtime.sendMessage({ type: "PROCESS_RETRY_ITEM", itemId: item.id });
              setQueueStatus(`✓ Đã gửi lại thành công: ${item.label}`);
              await refreshQueue();
            } catch (err) {
              setQueueStatus(`❌ Lỗi gửi lại: ${err.message}`, true);
              await refreshQueue();
            }
          });

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "secondary";
          removeBtn.textContent = om("options_remove_item", "Xóa");
          removeBtn.addEventListener("click", async () => {
            await chrome.runtime.sendMessage({ type: "REMOVE_RETRY_ITEM", itemId: item.id });
            await refreshQueue();
          });

          actions.append(retryBtn, removeBtn);
          row.append(info, actions);
          listContainer.append(row);
        });
      } catch (err) {
        console.warn("[OPTIONS] Refresh retry queue error:", err);
      }
    }

    retryAllBtn?.addEventListener("click", async () => {
      retryAllBtn.disabled = true;
      const originalText = retryAllBtn.textContent;
      retryAllBtn.textContent = "⏳ Đang gửi lại…";
      try {
        const result = await chrome.runtime.sendMessage({ type: "PROCESS_RETRY_ALL" });
        const resText = om(
          "options_retry_all_result",
          "Đã xử lý hàng đợi: $success$ thành công, $failed$ thất bại."
        )
          .replace("$success$", String(result?.succeeded || 0))
          .replace("$failed$", String(result?.failed || 0));
        setQueueStatus(resText, Boolean(result?.failed));
        await refreshQueue();
      } catch (err) {
        setQueueStatus(`❌ ${err.message}`, true);
      } finally {
        retryAllBtn.disabled = false;
        retryAllBtn.textContent = originalText;
      }
    });

    clearBtn?.addEventListener("click", async () => {
      if (!confirm(om("options_confirm_clear_queue", "Xóa toàn bộ hàng đợi thử lại?"))) return;
      await chrome.runtime.sendMessage({ type: "CLEAR_RETRY_QUEUE" });
      setQueueStatus("Đã xóa sạch hàng đợi thử lại.");
      await refreshQueue();
    });

    refreshBtn?.addEventListener("click", () => {
      refreshQueue();
    });

    window.addEventListener("online", () => {
      refreshQueue();
    });

    refreshQueue();
  }

  async function buildBugReport() {
    const manifest = chrome.runtime.getManifest();
    const logs = (await globalThis.TB_LOGGER?.getLogs?.()) || [];
    const file = document.getElementById("bugScreenshot")?.files?.[0];
    return {
      title: document.getElementById("bugTitle")?.value.trim() || "B2R bug report",
      description: document.getElementById("bugDescription")?.value.trim() || "",
      steps: document.getElementById("bugSteps")?.value.trim() || "",
      pageUrl: document.getElementById("bugPageUrl")?.value.trim() || "",
      environment: {
        extensionVersion: manifest.version,
        browser: navigator.userAgent,
        language: navigator.language,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      },
      logs: logs.slice(0, 50),
      screenshot: file ? { name: file.name, type: file.type, size: file.size } : null,
    };
  }

  async function downloadBugReport() {
    const report = await buildBugReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `b2r-bug-report-${Date.now()}.json`);
    const file = document.getElementById("bugScreenshot")?.files?.[0];
    if (file) downloadBlob(file, `b2r-bug-screenshot-${Date.now()}-${file.name}`);
    setBugReportStatus(om("options_bug_downloaded", "Đã tải báo cáo và ảnh đính kèm."));
  }

  async function copyBugReport() {
    try {
      const report = await buildBugReport();
      await navigator.clipboard.writeText(formatBugReport(report));
      setBugReportStatus(om("options_bug_copied", "Đã sao chép nội dung báo cáo."));
    } catch (_error) {
      setBugReportStatus(
        om("options_bug_copy_failed", "Không thể sao chép tự động. Hãy dùng nút Tải báo cáo."),
        true
      );
    }
  }

  async function openGithubIssue() {
    const report = await buildBugReport();
    const url = `https://github.com/conghiep1997/b2r/issues/new?title=${encodeURIComponent(report.title)}&body=${encodeURIComponent(formatBugReport(report) + "\n\n" + om("options_attach_screenshot_note"))}`;
    chrome.tabs.create({ url });
  }

  function formatBugReport(report) {
    return `## ${om("options_bug_description_label")}\n${report.description || om("options_not_provided")}\n\n## ${om("options_bug_steps")}\n${report.steps || om("options_not_provided")}\n\n## URL\n${report.pageUrl || om("options_not_provided")}\n\n## ${om("options_environment")}\n- Extension: ${report.environment.extensionVersion}\n- Browser: ${report.environment.browser}\n- Language: ${report.environment.language}\n- Viewport: ${report.environment.viewport}\n- Time: ${report.environment.timestamp}\n\n## ${om("options_recent_logs")}\n\`\`\`json\n${JSON.stringify(report.logs, null, 2)}\n\`\`\``;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setBugReportStatus(message, isError = false) {
    const element = document.getElementById("bugReportStatus");
    if (!element) return;
    element.textContent = message;
    element.className = `status ${isError ? "status-error" : "status-success"}`;
  }

  async function handleExportLogs() {
    if (!globalThis.TB_LOGGER?.getLogs) {
      setStatus(om("options_logs_unavailable", "Không thể đọc log lỗi."), true);
      return;
    }

    const logs = await globalThis.TB_LOGGER.getLogs();
    if (logs.length === 0) {
      setStatus(om("options_no_logs", "Không có log lỗi để xuất."));
      return;
    }

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `b2r-error-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(om("options_logs_exported", "Đã xuất file log lỗi."));
  }

  async function handleClearLogs() {
    if (!globalThis.TB_LOGGER?.clearLogs) {
      setStatus(om("options_logs_unavailable", "Không thể xóa log lỗi."), true);
      return;
    }

    const confirmed = confirm(om("options_confirm_clear_logs", "Xóa toàn bộ lịch sử log lỗi?"));
    if (!confirmed) return;

    await globalThis.TB_LOGGER.clearLogs();
    setStatus(om("options_logs_deleted", "Đã xóa lịch sử log lỗi."));
  }

  async function handleExportConfig() {
    if (!globalThis.TB_CONFIG_TRANSFER) {
      setStatus("Config transfer utility not available.", true);
      return;
    }
    try {
      const profiles = TB_OPTIONS_PROJECT_PROFILES.readProfiles();
      const globalPolicy = TB_OPTIONS_PROJECT_PROFILES.readGlobal();
      const backlogDomain =
        document.getElementById("backlogDomain")?.value?.trim() || TB.BACKLOG_DOMAIN;
      const redmineDomain =
        document.getElementById("redmineDomain")?.value?.trim() || TB.REDMINE_DOMAIN;

      const payload = globalThis.TB_CONFIG_TRANSFER.buildExportPayload({
        profiles,
        globalPolicy,
        metadata: {
          backlogDomain,
          redmineDomain,
        },
      });

      globalThis.TB_CONFIG_TRANSFER.downloadAsJson(payload);
      setStatus(
        om("options_export_success", "Đã xuất cấu hình thành công ($count$ dự án)!").replace(
          "$count$",
          String(profiles.length)
        )
      );
    } catch (error) {
      console.error("[OPTIONS] Export config failed:", error);
      setStatus(error.message, true);
    }
  }

  async function handleImportConfig(file) {
    if (!file || !globalThis.TB_CONFIG_TRANSFER) return;
    try {
      setStatus(om("options_import_reading_file", "Đang đọc file cấu hình…"));
      const text = await file.text();
      const backlogDomain =
        document.getElementById("backlogDomain")?.value?.trim() || TB.BACKLOG_DOMAIN;
      const redmineDomain =
        document.getElementById("redmineDomain")?.value?.trim() || TB.REDMINE_DOMAIN;

      const validation = globalThis.TB_CONFIG_TRANSFER.parseAndValidate(text, {
        backlogDomain,
        redmineDomain,
      });

      const currentProfiles = TB_OPTIONS_PROJECT_PROFILES.readProfiles();
      const currentGlobalPolicy = TB_OPTIONS_PROJECT_PROFILES.readGlobal();

      let mode = "merge";
      if (currentProfiles.length > 0) {
        const replace = confirm(
          om(
            "options_import_choice",
            "Bạn có muốn GHI ĐÈ toàn bộ cấu hình dự án hiện tại không?\n\n- Nhấn OK: Ghi đè toàn bộ (Replace all)\n- Nhấn Cancel: Gộp thêm cấu hình mới (Merge)"
          )
        );
        mode = replace ? "replace" : "merge";
      }

      const mergedProfiles = globalThis.TB_CONFIG_TRANSFER.mergeProfiles(
        currentProfiles,
        validation.payload.projectProfiles,
        mode
      );

      const mergedPolicy = validation.payload.globalPolicy
        ? globalThis.TB_CONFIG_TRANSFER.mergeGlobalPolicy(
            currentGlobalPolicy,
            validation.payload.globalPolicy
          )
        : currentGlobalPolicy;

      TB_OPTIONS_PROJECT_PROFILES.load(mergedProfiles, mergedPolicy);
      TB_OPTIONS_PROJECT_PROFILES.markDirty();

      setStatus(
        om("options_import_success", "Đã nhập $count$ cấu hình dự án thành công!").replace(
          "$count$",
          String(validation.summary.profileCount)
        )
      );

      if (typeof form?.requestSubmit === "function") {
        form.requestSubmit();
      }
    } catch (error) {
      console.error("[OPTIONS] Import config failed:", error);
      setStatus(
        `${om("options_import_invalid_file", "File JSON không hợp lệ:")} ${error.message}`,
        true
      );
    }
  }

  async function handleManualUpdateCheck() {
    const btn = document.getElementById("checkUpdateBtn");
    const statusDiv = document.getElementById("updateStatus");
    if (!btn || !statusDiv) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = `⏳ ${om("options_checking_server", "Đang kiểm tra...")}`;
    statusDiv.innerHTML = `<p style='margin: 0; color: #64748b;'>${om("options_checking_server", "Đang kết nối đến server...")}</p>`;

    try {
      const manifest = chrome.runtime.getManifest();
      const currentVersion = manifest.version;

      const data = await TB_VERSION.fetchLatest();
      const latestVersion = data.version_number;
      if (!TB_VERSION.isValid(latestVersion)) {
        throw new Error(om("options_invalid_server_version"));
      }

      const isNewer = TB_VERSION.compare(currentVersion, latestVersion) < 0;

      if (isNewer) {
        statusDiv.innerHTML = `
          <p style="margin: 0; color: var(--primary); font-weight: 700;">
            ${om("options_new_version", "🚀 Có phiên bản mới:")} <span>v${latestVersion}</span>
          </p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
            ${om("options_current_version_label", "Phiên bản hiện tại:")} v${currentVersion}.
          </p>
        `;
      } else {
        statusDiv.innerHTML = `
          <p style="margin: 0; color: #10b981; font-weight: 600;">
            ✅ ${om("options_current_version", "Bạn đang sử dụng phiên bản mới nhất")} (v${currentVersion})
          </p>
        `;
      }
    } catch (error) {
      console.error("[OPTIONS] Update check failed:", error);
      statusDiv.innerHTML = `
        <p style="margin: 0; color: #ef4444; font-weight: 600;">
          ❌ ${om("options_update_failed", "Lỗi kiểm tra:")} ${escapeHtml(error.message)}
        </p>
      `;
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn =
      document.getElementById("saveOptionsBtn") || form.querySelector("button[type='submit']");
    const saveIcon = saveBtn?.querySelector(".btn-icon");
    const saveText = saveBtn?.querySelector(".btn-text");
    if (saveBtn?.disabled) return;
    if (saveBtn) saveBtn.disabled = true;
    if (saveIcon) saveIcon.textContent = "⏳";
    if (saveText) saveText.textContent = om("options_saving", "Đang lưu…");
    try {
      let domainChange;
      try {
        domainChange = await prepareRedmineDomain(
          document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN
        );
      } catch (error) {
        throw new Error(
          `${om("options_redmine_permission_required", "Redmine host permission required")}: ${error.message}`
        );
      }
      const settings = await gatherSettings();
      settings.redmineDomain = domainChange.currentDomain;
      await chrome.storage.local.set(settings);
      try {
        await applyRedmineRegistration(domainChange.currentDomain);
      } catch (registrationError) {
        const rollbackDomain = domainChange.previousDomain || TB.REDMINE_DOMAIN;
        await chrome.storage.local.set({ redmineDomain: rollbackDomain });
        await applyRedmineRegistration(rollbackDomain);
        throw registrationError;
      }
      await removePreviousRedminePermission(
        domainChange.previousDomain,
        domainChange.currentDomain
      );

      // Auto-verify Backlog & Primary AI if configured and unverified
      const autoTestTasks = [];
      const testWarnings = [];

      const backlogKey =
        backlogApiKeyInput.value.trim() && backlogApiKeyInput.value.trim() !== "**********"
          ? backlogApiKeyInput.value.trim()
          : await decryptData(settings.backlogApiKey || "");
      const backlogDomain =
        document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN;
      if (backlogKey) {
        const backlogFp = await verificationFingerprint([backlogDomain, backlogKey]);
        const stored = await chrome.storage.local.get(["backlogConnectionVerified"]);
        if (stored.backlogConnectionVerified !== backlogFp) {
          autoTestTasks.push(
            handleBacklogConnectionTest().then((res) => {
              if (res && !res.ok) testWarnings.push(`Backlog: ${res.error || "Failed"}`);
            })
          );
        }
      }

      const provider = primaryProviderSelect.value;
      const primaryKey =
        provider === "gemini" ? getFirstGeminiKey() : getProviderKeys("primary", provider)[0];
      const modelId =
        getSelectedModelsForProvider("primary", provider)[0] || getDefaultModel(provider);
      const aiKeys = provider === "gemini" ? getGeminiKeys() : primaryKey;
      if (primaryKey) {
        const aiFp = await verificationFingerprint([provider, modelId, aiKeys]);
        const storedAi = await chrome.storage.local.get(["aiConnectionVerified"]);
        if (storedAi.aiConnectionVerified !== aiFp) {
          autoTestTasks.push(
            handlePrimaryAiTest().then((res) => {
              if (res && !res.ok) testWarnings.push(`AI: ${res.error || "Failed"}`);
            })
          );
        }
      }

      if (autoTestTasks.length > 0) {
        await Promise.all(autoTestTasks);
      }

      if (testWarnings.length > 0) {
        setStatus(
          `${om("options_save_success", "✅ Đã lưu cấu hình thành công!")} (${testWarnings.join("; ")})`,
          true
        );
      } else {
        setStatus(om("options_save_success", "✅ Đã lưu cấu hình thành công!"));
      }
      const defaultSaveIconSvg =
        '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>';
      if (saveIcon) saveIcon.textContent = "✓";
      if (saveText) saveText.textContent = om("options_saved_badge", "Đã lưu!");
      setTimeout(() => {
        if (saveIcon) saveIcon.innerHTML = defaultSaveIconSvg;
        if (saveText) saveText.textContent = om("options_save", "Lưu cấu hình");
        if (saveBtn) saveBtn.disabled = false;
      }, 1500);
      updateOnboardingStatuses();
      setTimeout(loadOptions, 200);
    } catch (error) {
      const defaultSaveIconSvg =
        '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>';
      if (saveIcon) saveIcon.innerHTML = defaultSaveIconSvg;
      if (saveText) saveText.textContent = om("options_save", "Lưu cấu hình");
      if (saveBtn) saveBtn.disabled = false;
      console.error("[OPTIONS] Save failed:", error);
      const message = error?.message || String(error) || "Unknown error";
      const errorTemplate = om("options_save_error", "❌ Lỗi khi lưu: $error$");
      setStatus(errorTemplate.replace("$error$", message), true);
    }
  });

  // Keyboard shortcut: Ctrl+S (Cmd+S) to save settings
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      const saveBtn =
        document.getElementById("saveOptionsBtn") || form.querySelector("button[type='submit']");
      if (saveBtn && !saveBtn.disabled) {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
    }
  });

  async function gatherSettings() {
    commitPendingKeyInputs();

    const primaryModels = getSelectedModelsForProvider("primary", primaryProviderSelect.value);
    const fallbackModels = getSelectedModelsForProvider("fallback", fallbackProviderSelect.value);
    const settings = {
      redmineDomain: document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN,
      backlogDomain: document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      primaryProvider: primaryProviderSelect.value,
      primaryModel: primaryModels[0] || getDefaultModel(primaryProviderSelect.value),
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: fallbackModels[0] || getDefaultModel(fallbackProviderSelect.value),
      defaultProjectId: document.getElementById("defaultProjectId")?.value || "",
      defaultProjectName: (() => {
        const projectSelect = document.getElementById("defaultProjectId");
        return projectSelect?.value
          ? projectSelect.selectedOptions[0]?.textContent?.trim() || ""
          : "";
      })(),
      reportProjectId: document.getElementById("defaultProjectId")?.value || "",
      manualFields: document.getElementById("manualFields")?.value?.trim() || "",
      showRedmineSuccessModal: showRedmineSuccessModalInput?.checked !== false,
      enableTranslationCache: document.getElementById("enableTranslationCache")?.checked !== false,
    };
    const globalPolicy = TB_OPTIONS_PROJECT_PROFILES.readGlobal();
    const projectProfiles = TB_OPTIONS_PROJECT_PROFILES.readProfiles();
    settings.syncRules = globalPolicy.syncRules;
    settings.translationRules = globalPolicy.translationRules;
    settings.translationSourceLanguage = globalPolicy.translationRules.source;
    settings.translationTargetLanguage = globalPolicy.translationRules.target;
    settings.logTimeRules = globalPolicy.logTimeRules;
    settings.customFields = globalPolicy.customFields;
    settings.manualFields = globalPolicy.manualFields;
    settings.projectProfiles = await encryptData(JSON.stringify(projectProfiles));

    try {
      const validatedGlobalPolicy = TB_OPTIONS_PROJECT_PROFILES.readGlobal();
      if (validatedGlobalPolicy) {
        if (validatedGlobalPolicy.syncRules) {
          settings.syncRules = validatedGlobalPolicy.syncRules;
        }
        if (validatedGlobalPolicy.translationRules) {
          settings.translationRules = validatedGlobalPolicy.translationRules;
          settings.translationSourceLanguage = validatedGlobalPolicy.translationRules.source;
          settings.translationTargetLanguage = validatedGlobalPolicy.translationRules.target;
        }
        if (validatedGlobalPolicy.logTimeRules) {
          settings.logTimeRules = validatedGlobalPolicy.logTimeRules;
        }
        if (validatedGlobalPolicy.customFields) {
          settings.customFields = validatedGlobalPolicy.customFields;
        }
        if (validatedGlobalPolicy.manualFields) {
          settings.manualFields = validatedGlobalPolicy.manualFields;
        }
      }
    } catch (policyError) {
      console.warn("[OPTIONS] Error reading global policy:", policyError);
    }

    try {
      const validatedProjectProfiles = TB_OPTIONS_PROJECT_PROFILES.readProfiles();
      if (validatedProjectProfiles) {
        settings.projectProfiles = await encryptData(JSON.stringify(validatedProjectProfiles));
      }
    } catch (profileError) {
      console.warn("[OPTIONS] Error reading project profiles:", profileError);
    }

    await Promise.all([
      handleApiKeyUpdate(settings, "redmineApiKey", redmineApiKeyInput),
      handleApiKeyUpdate(settings, "backlogApiKey", backlogApiKeyInput),
      handleApiKeyUpdate(settings, "groqApiKey", groqApiKeyInput),
      handleApiKeyUpdate(settings, "cerebrasApiKey", cerebrasApiKeyInput),
      handleApiKeyUpdate(settings, "openrouterApiKey", openrouterApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackGroqApiKey", fallbackGroqApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackCerebrasApiKey", fallbackCerebrasApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackOpenrouterApiKey", fallbackOpenrouterApiKeyInput),
    ]);

    const selectedFallbackGeminiModels = Array.from(
      document.querySelectorAll("#fallbackGeminiModelsList button.selected")
    ).map((button) => button.dataset.modelId);
    settings.fallbackGeminiModels =
      selectedFallbackGeminiModels.length > 0
        ? await encryptData(selectedFallbackGeminiModels.join("\n"))
        : "";

    const selectedFallbackGeminiKeys = getFallbackGeminiKeys();
    if (selectedFallbackGeminiKeys.length > 0) {
      settings.fallbackGeminiApiKeys = await encryptData(selectedFallbackGeminiKeys.join("\n"));
    } else {
      // Preserve stored fallback Gemini keys if list hasn't rendered yet
      const storedFbGemini = await chrome.storage.local.get(["fallbackGeminiApiKeys"]);
      settings.fallbackGeminiApiKeys = storedFbGemini.fallbackGeminiApiKeys || "";
    }

    for (const config of PRIMARY_PROVIDER_CONFIGS) {
      const selectedModels = getSelectedProviderModels("primary", config.provider);
      settings[config.modelsStorage] =
        selectedModels.length > 0 ? await encryptData(selectedModels.join("\n")) : "";

      const selectedKeys = getProviderKeys("primary", config.provider, config.keyInput);
      if (selectedKeys.length > 0) {
        settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
        settings[`${config.provider}ApiKey`] = await encryptData(selectedKeys[0]);
      } else if (config.keyInput?.value?.trim() === "**********") {
        // Key unchanged — preserve existing encrypted value from storage
        const stored = await chrome.storage.local.get([config.keysStorage]);
        if (stored[config.keysStorage]) settings[config.keysStorage] = stored[config.keysStorage];
      } else {
        // Input is empty — intentionally cleared
        settings[config.keysStorage] = "";
      }
    }

    for (const config of FALLBACK_PROVIDER_CONFIGS) {
      const selectedModels = getSelectedProviderModels("fallback", config.provider);
      settings[config.modelsStorage] =
        selectedModels.length > 0 ? await encryptData(selectedModels.join("\n")) : "";

      const selectedKeys = getProviderKeys("fallback", config.provider, config.keyInput);
      const legacyKeyName = `fallback${capitalize(config.provider)}ApiKey`;
      if (selectedKeys.length > 0) {
        settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
        settings[legacyKeyName] = await encryptData(selectedKeys[0]);
      } else if (config.keyInput?.value?.trim() === "**********") {
        // Key unchanged — preserve existing encrypted value from storage
        const stored = await chrome.storage.local.get([config.keysStorage]);
        if (stored[config.keysStorage]) settings[config.keysStorage] = stored[config.keysStorage];
      } else {
        // Input is empty — intentionally cleared
        settings[config.keysStorage] = "";
      }
    }

    const selectedGeminiModels = Array.from(
      document.querySelectorAll("#geminiModelsList button.selected")
    ).map((b) => b.dataset.modelId);
    if (selectedGeminiModels.length > 0) {
      settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
    } else {
      settings.geminiModels = "";
    }

    const selectedGeminiKeys = getGeminiKeys();
    if (selectedGeminiKeys.length > 0) {
      settings.geminiApiKeys = await encryptData(selectedGeminiKeys.join("\n"));
      settings.geminiApiKey = await encryptData(selectedGeminiKeys[0]);
    } else {
      // Preserve stored Gemini keys if list hasn't rendered yet
      const storedGemini = await chrome.storage.local.get(["geminiApiKeys", "geminiApiKey"]);
      settings.geminiApiKeys = storedGemini.geminiApiKeys || "";
      settings.geminiApiKey = storedGemini.geminiApiKey || "";
    }

    return settings;
  }

  function normalizeManualFields(storedValue) {
    if (!storedValue) {
      return JSON.stringify(DEFAULT_MANUAL_FIELDS, null, 2);
    }

    try {
      const parsed = JSON.parse(storedValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return storedValue;
      }
      return JSON.stringify({ ...DEFAULT_MANUAL_FIELDS, ...parsed }, null, 2);
    } catch (_error) {
      return storedValue;
    }
  }
  async function prepareRedmineDomain(domain) {
    const normalizedDomain = TB_REDMINE_DOMAIN.normalize(domain);

    if (!TB_REDMINE_DOMAIN.isDefault(normalizedDomain, TB.REDMINE_DOMAIN)) {
      const originPattern = TB_REDMINE_DOMAIN.toMatchPattern(normalizedDomain);
      const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
      if (!alreadyGranted) {
        const granted = await chrome.permissions.request({ origins: [originPattern] });
        if (!granted) {
          throw new Error(om("options_redmine_permission_required"));
        }
      }
    }

    const previous = await chrome.storage.local.get("redmineDomain");
    return {
      currentDomain: normalizedDomain,
      previousDomain: previous.redmineDomain,
    };
  }

  async function applyRedmineRegistration(domain) {
    await unregisterCustomRedmineScript();
    if (TB_REDMINE_DOMAIN.isDefault(domain, TB.REDMINE_DOMAIN)) return;

    const originPattern = TB_REDMINE_DOMAIN.toMatchPattern(domain);
    await chrome.scripting.registerContentScripts([
      {
        id: TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID,
        matches: [originPattern],
        js: TB_REDMINE_DOMAIN.CONTENT_SCRIPTS,
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
    await injectIntoOpenRedmineTabs(originPattern);
  }

  async function injectIntoOpenRedmineTabs(originPattern) {
    let tabs;
    try {
      tabs = await chrome.tabs.query({ url: [originPattern] });
    } catch (error) {
      console.warn("[OPTIONS] Could not query open Redmine tabs:", error);
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
            console.warn(`[OPTIONS] Could not inject Redmine tab ${tab.id}:`, error);
          }
        })
    );
  }

  async function unregisterCustomRedmineScript() {
    try {
      await chrome.scripting.unregisterContentScripts({
        ids: [TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID],
      });
    } catch (_error) {
      // The script has not been registered yet.
    }
  }

  async function removePreviousRedminePermission(previousDomain, currentDomain) {
    if (
      !previousDomain ||
      TB_REDMINE_DOMAIN.isDefault(previousDomain, TB.REDMINE_DOMAIN) ||
      TB_REDMINE_DOMAIN.toMatchPattern(previousDomain) ===
        TB_REDMINE_DOMAIN.toMatchPattern(currentDomain)
    ) {
      return;
    }
    await chrome.permissions.remove({
      origins: [TB_REDMINE_DOMAIN.toMatchPattern(previousDomain)],
    });
  }

  async function handleApiKeyUpdate(settings, keyName, inputElement) {
    if (!inputElement) return;
    const value = inputElement.value.trim();
    if (value === "") {
      settings[keyName] = "";
    } else if (value === "**********") {
      // Key unchanged — read existing encrypted value from storage to include it explicitly
      const stored = await chrome.storage.local.get(keyName);
      if (stored[keyName]) settings[keyName] = stored[keyName];
    } else {
      settings[keyName] = await encryptData(value);
    }
  }

  function loadOptions() {
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
      "fallbackCerebrasApiKey",
      "fallbackGeminiApiKeys",
      "fallbackGeminiModels",
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
      "syncRules",
      "translationRules",
      "logTimeRules",
      "customFields",
      "projectProfiles",
      "defaultProjectId",
      "reportProjectId",
      "manualFields",
      "showRedmineSuccessModal",
      "enableTranslationCache",
    ];

    chrome.storage.local.get(keys, async (items) => {
      const languagePair = TB.PROMPTS.resolveLanguagePair(items);
      const translationRules = TB.PROMPTS.TRANSLATION.normalize(
        items.translationRules || { source: languagePair.source, target: languagePair.target }
      );
      document.getElementById("redmineDomain").value = items.redmineDomain || TB.REDMINE_DOMAIN;
      document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
      document.getElementById("manualFields").value = normalizeManualFields(items.manualFields);
      const policy = {
        syncRules: TB_SYNC_RULES.normalize(items.syncRules),
        translationRules,
        logTimeRules: TB_LOG_TIME_RULES.normalize(items.logTimeRules),
        manualFields: normalizeManualFields(items.manualFields),
        customFields: TB_CUSTOM_FIELDS.normalize(items.customFields),
      };
      let projectProfiles = [];
      if (items.projectProfiles) {
        try {
          projectProfiles = JSON.parse(await decryptData(items.projectProfiles));
        } catch (error) {
          console.warn("[OPTIONS] Saved project profiles could not be loaded:", error.message);
        }
      }
      TB_OPTIONS_PROJECT_PROFILES.load(projectProfiles, policy);
      if (showRedmineSuccessModalInput) {
        showRedmineSuccessModalInput.checked = items.showRedmineSuccessModal !== false;
      }
      const cacheInput = document.getElementById("enableTranslationCache");
      if (cacheInput) {
        cacheInput.checked = items.enableTranslationCache !== false;
      }

      redmineApiKeyInput.value = items.redmineApiKey ? "**********" : "";
      backlogApiKeyInput.value = items.backlogApiKey ? "**********" : "";
      groqApiKeyInput.value = items.groqApiKey ? "**********" : "";
      cerebrasApiKeyInput.value = items.cerebrasApiKey ? "**********" : "";
      openrouterApiKeyInput.value = items.openrouterApiKey ? "**********" : "";
      fallbackGroqApiKeyInput.value = items.fallbackGroqApiKey ? "**********" : "";
      fallbackCerebrasApiKeyInput.value = items.fallbackCerebrasApiKey ? "**********" : "";
      fallbackOpenrouterApiKeyInput.value = items.fallbackOpenrouterApiKey ? "**********" : "";

      const primaryProvider = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
      primaryProviderSelect.value = primaryProvider;
      handleProviderChange(primaryProviderSelect, items.primaryModel);

      fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
      updateFallbackOptions();
      renderFallbackGeminiModelsTags(await decryptStoredList(items.fallbackGeminiModels));
      renderFallbackGeminiKeysButtons(await decryptStoredList(items.fallbackGeminiApiKeys));

      for (const config of PRIMARY_PROVIDER_CONFIGS) {
        const models = await decryptStoredList(items[config.modelsStorage]);
        const providerKeys = await decryptStoredList(items[config.keysStorage]);
        renderProviderModelsTags("primary", config.provider, models);
        renderProviderKeysButtons("primary", config.provider, providerKeys);
      }

      for (const config of FALLBACK_PROVIDER_CONFIGS) {
        const models = await decryptStoredList(items[config.modelsStorage]);
        const providerKeys = await decryptStoredList(items[config.keysStorage]);
        renderProviderModelsTags("fallback", config.provider, models);
        renderProviderKeysButtons("fallback", config.provider, providerKeys);
      }

      if (items.redmineApiKey) {
        try {
          const decryptedKey = await decryptData(items.redmineApiKey);
          if (decryptedKey) {
            fetchProjects(decryptedKey, items.defaultProjectId || items.reportProjectId || "");
          } else {
            console.warn("[OPTIONS] Failed to decrypt redmineApiKey");
          }
        } catch (e) {
          console.error("[OPTIONS] Error decrypting redmineApiKey:", e);
        }
      }

      const validGeminiModelValues = new Set((TB.GEMINI_MODELS || []).map((model) => model.value));
      const defaultGeminiModels = (TB.GEMINI_MODELS || [])
        .filter((model) => model.default)
        .map((model) => model.value);
      if (items.geminiModels) {
        try {
          const modelsStr = await decryptData(items.geminiModels);
          const rawModelsList = modelsStr ? modelsStr.split("\n").filter(Boolean) : [];
          const modelsList = rawModelsList.filter((m) => validGeminiModelValues.has(m));
          renderGeminiModelsTags(modelsList.length > 0 ? modelsList : defaultGeminiModels);
        } catch (e) {
          console.error("[OPTIONS] Error decrypting geminiModels:", e);
          renderGeminiModelsTags(defaultGeminiModels);
        }
      } else {
        renderGeminiModelsTags(defaultGeminiModels);
      }

      if (items.geminiApiKeys) {
        try {
          const keysStr = await decryptData(items.geminiApiKeys);
          renderGeminiKeysButtons(keysStr ? keysStr.split("\n").filter(Boolean) : []);
        } catch (e) {
          console.error("[OPTIONS] Error decrypting geminiApiKeys:", e);
          renderGeminiKeysButtons([]);
        }
      } else if (items.geminiApiKey) {
        const legacyKey = await decryptData(items.geminiApiKey);
        renderGeminiKeysButtons(legacyKey ? [legacyKey] : []);
      }
      updateOnboardingStatuses();

      // Quiet auto-verify for already stored credentials on first load if not verified yet
      if (items.backlogApiKey && !items.backlogConnectionVerified) {
        setTimeout(handleBacklogConnectionTest, 800);
      }
      if ((items.geminiApiKeys || items.geminiApiKey || items.groqApiKey || items.cerebrasApiKey || items.openrouterApiKey) && !items.aiConnectionVerified) {
        setTimeout(handlePrimaryAiTest, 1200);
      }
    });
  }

  function initProviderMultiControls() {
    [...PRIMARY_PROVIDER_CONFIGS, ...FALLBACK_PROVIDER_CONFIGS].forEach((config) => {
      const isFallback = config.keysStorage.startsWith("fallback");
      const scope = isFallback ? "fallback" : "primary";
      const { provider, keyInput } = config;
      const configEl = document.getElementById(`${scope}${capitalize(provider)}Config`);
      if (!configEl || configEl.dataset.multiReady === "1") return;

      const modelsBlock = document.createElement("div");
      modelsBlock.style.margin = "0 0 12px";
      modelsBlock.innerHTML = `
        <p style="margin: 0 0 6px; font-size: 11px; color: #166534; font-weight: 500">${om("options_models_help", "Models (click to select/deselect, uses round-robin)")}</p>
        <div id="${scope}${capitalize(provider)}ModelsList" class="provider-models-list" style="display: flex; flex-wrap: wrap; gap: 6px"></div>
        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted)">${om("options_selected", "Selected:")} <span id="${scope}${capitalize(provider)}SelectedModelCount">0</span></p>
      `;
      configEl.prepend(modelsBlock);

      const keysBlock = document.createElement("div");
      keysBlock.style.margin = "8px 0 0";
      keysBlock.innerHTML = `
        <div id="${scope}${capitalize(provider)}KeysList" class="provider-keys-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px"></div>
        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted)">${om("options_added", "Added:")} <span id="${scope}${capitalize(provider)}SelectedKeyCount">0</span>/10</p>
      `;
      configEl.appendChild(keysBlock);

      if (keyInput) {
        keyInput.placeholder = om(
          "options_key_quick_add",
          "Nhập key rồi Lưu hoặc Enter để thêm nhanh"
        );
        keyInput.addEventListener("keydown", (event) =>
          handleProviderKeyInput(event, scope, provider)
        );
      }
      renderProviderModelsTags(scope, provider, []);
      renderProviderKeysButtons(scope, provider, []);
      configEl.dataset.multiReady = "1";
    });
  }

  async function fetchProjects(apiKey, selectedId = "", forceRefresh = false) {
    if (typeof selectedId === "boolean") {
      forceRefresh = selectedId;
      selectedId = "";
    }
    if (!apiKey) return false;
    const redmineDomain =
      document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN;
    const fingerprint = await verificationFingerprint([
      TB_REDMINE_DOMAIN.normalize(redmineDomain),
      apiKey,
    ]);
    const now = Date.now();
    if (
      cachedProjects &&
      !forceRefresh &&
      cachedProjectsFingerprint === fingerprint &&
      now - cacheTimestamp < CACHE_DURATION
    ) {
      renderProjectOptions(cachedProjects, selectedId);
      TB_OPTIONS_PROJECT_PROFILES.refresh();
      await chrome.storage.local.set({ redmineConnectionVerified: fingerprint });
      updateOnboardingStatuses();
      return true;
    }
    const syncBtn = document.getElementById("syncProjectsBtn");
    const defaultProjectSelect = document.getElementById("defaultProjectId");
    try {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.classList.add("is-loading");
        syncBtn.setAttribute("aria-busy", "true");
      }
      if (defaultProjectSelect) {
        defaultProjectSelect.innerHTML = `<option value="">${om("options_loading", "Đang tải...")}</option>`;
      }
      const projects = await sendBackgroundRequest({
        type: "FETCH_REDMINE_PROJECTS_WITH_KEY",
        domain: redmineDomain,
        apiKey,
      });
      cachedProjects = projects;
      cachedProjectsFingerprint = fingerprint;
      cacheTimestamp = now;
      renderProjectOptions(projects, selectedId);
      TB_OPTIONS_PROJECT_PROFILES.refresh();
      await chrome.storage.local.set({ redmineConnectionVerified: fingerprint });
      updateOnboardingStatuses();
      return true;
    } catch (error) {
      if (defaultProjectSelect) {
        defaultProjectSelect.innerHTML = `<option value="">${om("options_load_error", "Không tải được project")}</option>`;
      }
      await chrome.storage.local.remove("redmineConnectionVerified");
      const status = document.getElementById("onboardingStatus");
      if (status) {
        status.textContent = `${om("options_load_error", "Không tải được project")}: ${error.message}`;
      }
      updateOnboardingStatuses();
      return false;
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.classList.remove("is-loading");
        syncBtn.removeAttribute("aria-busy");
      }
    }
  }

  async function handleBacklogConnectionTest() {
    const buttons = [
      document.getElementById("testBacklogConnectionBtn"),
      document.getElementById("testBacklogTabBtn"),
    ].filter(Boolean);
    const inputKey = backlogApiKeyInput.value.trim();
    buttons.forEach((b) => (b.disabled = true));
    const tabStatus = document.getElementById("backlogTabStatus");
    if (tabStatus) {
      tabStatus.textContent = om("popup_checking", "Đang kiểm tra…");
      tabStatus.className = "status";
    }
    try {
      const stored = await chrome.storage.local.get(["backlogApiKey", "backlogDomain"]);
      const apiKey =
        inputKey && inputKey !== "**********"
          ? inputKey
          : await decryptData(stored.backlogApiKey || "");
      if (!apiKey) throw new Error(om("options_backlog_api_key", "Backlog API key is required."));
      const domain = document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN;
      const result = await sendBackgroundRequest({
        type: "TEST_BACKLOG_CONNECTION",
        domain,
        apiKey,
      });
      await chrome.storage.local.set({
        backlogConnectionVerified: await verificationFingerprint([domain, apiKey]),
      });
      const successMsg =
        om("options_test_backlog_success", "Backlog connection successful.") +
        (result.userName ? ` (${result.userName})` : "");
      document.getElementById("onboardingStatus").textContent = successMsg;
      if (tabStatus) {
        tabStatus.textContent = `✓ ${successMsg}`;
        tabStatus.className = "status status-success";
      }
      return { ok: true, message: successMsg };
    } catch (error) {
      await chrome.storage.local.remove("backlogConnectionVerified");
      const errorMsg = om(
        "options_test_backlog_failed",
        "Backlog connection failed: $error$"
      ).replace("$error$", error.message);
      document.getElementById("onboardingStatus").textContent = errorMsg;
      if (tabStatus) {
        tabStatus.textContent = `❌ ${errorMsg}`;
        tabStatus.className = "status status-error";
      }
      return { ok: false, error: errorMsg };
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      updateOnboardingStatuses();
    }
  }

  async function handlePrimaryAiTest() {
    const buttons = [
      document.getElementById("testPrimaryAiBtn"),
      document.getElementById("testPrimaryAiTabBtn"),
    ].filter(Boolean);
    commitPendingKeyInputs();
    const provider = primaryProviderSelect.value;
    const models = getSelectedModelsForProvider("primary", provider);
    const apiKey =
      provider === "gemini" ? getFirstGeminiKey() : getProviderKeys("primary", provider)[0];
    const modelId = models[0] || getDefaultModel(provider);
    buttons.forEach((b) => (b.disabled = true));
    const tabStatus = document.getElementById("primaryAiTabStatus");
    if (tabStatus) {
      tabStatus.textContent = om("popup_checking", "Đang kiểm tra…");
      tabStatus.className = "status";
    }
    try {
      if (!apiKey) throw new Error(om("options_keys_help", "Add an API key first."));
      let result;
      if (provider === "gemini") {
        const keys = getGeminiKeys();
        if (keys.length === 0) {
          throw new Error(om("options_enter_gemini_key", "Add an API key first."));
        }
        const modelList = models.length > 0 ? models : [getDefaultModel(provider)];
        const failedModels = [];
        const successModels = [];
        const listEl = document.getElementById("geminiModelsList");

        for (const mId of modelList) {
          const btn = listEl?.querySelector(`button[data-model-id="${mId}"]`);
          const icon = btn?.querySelector(".test-icon");
          if (icon) {
            icon.innerHTML = SPINNER_ICON_SVG;
            icon.style.color = "";
          }
          const res = await testGeminiKeysForModel(mId);
          if (res.ok) {
            successModels.push(mId);
            if (icon) {
              icon.innerHTML = CHECK_ICON_SVG;
              icon.style.color = "var(--success)";
            }
          } else {
            failedModels.push(mId);
            if (icon) {
              icon.innerHTML = CLOSE_ICON_SVG;
              icon.style.color = "var(--danger)";
            }
            btn?.classList.remove("selected");
          }
          setTimeout(() => {
            if (icon) {
              icon.innerHTML = SCIENCE_ICON_SVG;
              icon.style.color = "";
            }
          }, 3000);
        }

        if (listEl) {
          document.getElementById("selectedModelCount").textContent =
            listEl.querySelectorAll(".selected").length;
        }

        if (successModels.length === 0) {
          throw new Error(
            om("options_model_test_failed", "Tất cả mô hình đã kiểm tra đều không phản hồi.")
          );
        }

        let summaryMsg = om("options_gemini_keys_test_ok").replace("$count$", String(keys.length));
        if (failedModels.length > 0) {
          summaryMsg += ` (Đã tự động loại bỏ ${failedModels.length} mô hình lỗi)`;
        }
        result = { ok: true, message: summaryMsg };
      } else {
        result = await sendBackgroundRequest({
          type: "TEST_MODEL_WITH_KEY",
          provider,
          modelId,
          apiKey,
        });
      }
      if (!result.ok) throw new Error(result.message || "Model test failed.");
      await chrome.storage.local.set({
        aiConnectionVerified: await verificationFingerprint([
          provider,
          modelId,
          provider === "gemini" ? getGeminiKeys() : apiKey,
        ]),
      });
      document.getElementById("onboardingStatus").textContent = result.message;
      if (tabStatus) {
        tabStatus.textContent = `✓ ${result.message}`;
        tabStatus.className = "status status-success";
      }
      return { ok: true, message: result.message };
    } catch (error) {
      await chrome.storage.local.remove("aiConnectionVerified");
      document.getElementById("onboardingStatus").textContent = error.message;
      if (tabStatus) {
        tabStatus.textContent = `❌ ${error.message}`;
        tabStatus.className = "status status-error";
      }
      return { ok: false, error: error.message };
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      updateOnboardingStatuses();
    }
  }

  async function verificationFingerprint(parts) {
    const bytes = new TextEncoder().encode(JSON.stringify(parts));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  async function updateOnboardingStatuses() {
    const items = await chrome.storage.local.get([
      "redmineApiKey",
      "redmineDomain",
      "defaultProjectId",
      "redmineConnectionVerified",
      "backlogApiKey",
      "backlogDomain",
      "backlogConnectionVerified",
      "primaryProvider",
      "primaryModel",
      "geminiApiKey",
      "geminiApiKeys",
      "groqApiKey",
      "cerebrasApiKey",
      "openrouterApiKey",
      "aiConnectionVerified",
    ]);
    const redmineKey = await decryptData(items.redmineApiKey || "");
    const backlogKey = await decryptData(items.backlogApiKey || "");
    const provider = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
    const model = items.primaryModel || getDefaultModel(provider);
    const aiKey = await decryptData(items[`${provider}ApiKey`] || "");
    const redmineFingerprint = redmineKey
      ? await verificationFingerprint([
          TB_REDMINE_DOMAIN.normalize(items.redmineDomain || TB.REDMINE_DOMAIN),
          redmineKey,
        ])
      : "";
    const backlogFingerprint = backlogKey
      ? await verificationFingerprint([items.backlogDomain || TB.BACKLOG_DOMAIN, backlogKey])
      : "";
    const geminiKeys =
      provider === "gemini"
        ? items.geminiApiKeys
          ? await decryptStoredList(items.geminiApiKeys)
          : aiKey
            ? [aiKey]
            : []
        : [];
    const aiFingerprint =
      provider === "gemini"
        ? geminiKeys.length
          ? await verificationFingerprint([provider, model, geminiKeys])
          : ""
        : aiKey
          ? await verificationFingerprint([provider, model, aiKey])
          : "";
    const states = {
      onboardingRedmineStatus: Boolean(
        items.defaultProjectId &&
        redmineFingerprint &&
        items.redmineConnectionVerified === redmineFingerprint
      ),
      onboardingBacklogStatus: Boolean(
        backlogFingerprint && items.backlogConnectionVerified === backlogFingerprint
      ),
      onboardingAiStatus: Boolean(aiFingerprint && items.aiConnectionVerified === aiFingerprint),
    };
    Object.entries(states).forEach(([id, complete]) => {
      const element = document.getElementById(id);
      element.textContent = complete
        ? `✓ ${om("options_onboarding_status_done", "Complete")}`
        : om("options_onboarding_status_pending", "Not checked");
      element.classList.toggle("status-success", complete);
    });
    const allComplete = Object.values(states).every(Boolean);
    if (allComplete) {
      document.getElementById("onboardingStatus").textContent = om(
        "options_onboarding_done",
        "Setup complete."
      );
    }
  }

  function renderSyncActivity(entries) {
    const target = document.getElementById("syncActivityList");
    const emptyState = document.getElementById("syncActivityEmpty");
    if (!target || !emptyState) return;
    const rows = Array.isArray(entries) ? entries.slice(0, 10) : [];
    target.replaceChildren();
    emptyState.hidden = rows.length > 0;
    rows.forEach((entry) => {
      const row = document.createElement("li");
      const operationKey =
        {
          migration: "options_sync_activity_migrate",
          "reverse-sync": "options_sync_activity_reverse",
          translate: "options_sync_activity_translate",
        }[entry.operation] || "options_sync_activity_translate";
      const operation = om(operationKey, "Comment sync");
      const template = om(
        entry.partial
          ? "options_sync_history_partial"
          : entry.ok
            ? "options_sync_history_success"
            : "options_sync_history_failed",
        "$operation$ completed for $issue$ ($count$ item(s))."
      );
      row.textContent = template
        .replace("$operation$", operation)
        .replace("$issue$", entry.issue || "")
        .replace("$count$", String(entry.count || 0));
      if (entry.detail) {
        const detail = document.createElement("small");
        detail.textContent = ` — ${entry.detail}`;
        row.append(detail);
      }
      if (entry.url) {
        const link = document.createElement("a");
        link.href = entry.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = entry.issue || entry.url;
        row.append(" ", link);
      }
      const timestamp = document.createElement("time");
      timestamp.dateTime = entry.timestamp;
      timestamp.textContent = new Date(entry.timestamp).toLocaleString();
      row.append(" — ", timestamp);
      target.appendChild(row);
    });
  }

  function renderProjectOptions(projects, selectedId) {
    const defaultSelect = document.getElementById("defaultProjectId");
    if (defaultSelect) {
      defaultSelect.innerHTML = `<option value="">${om("options_choose_project", "-- Chọn project --")}</option>`;
      projects.forEach((p) => {
        defaultSelect.add(new Option(p.name, p.id));
      });
      if (selectedId) defaultSelect.value = selectedId;
    }
  }

  function handleProviderChange(selectElement, selectedModel = null) {
    const isPrimary = selectElement.id === "primaryProvider";
    const provider = selectElement.value;

    if (isPrimary) {
      updateProviderKeyVisibility(provider);
      updateFallbackOptions();
    } else {
      updateFallbackKeyVisibility(provider);
    }
  }

  function updateProviderKeyVisibility(provider) {
    const sections = {
      gemini: document.getElementById("primaryGeminiConfig"),
      groq: document.getElementById("primaryGroqConfig"),
      cerebras: document.getElementById("primaryCerebrasConfig"),
      openrouter: document.getElementById("primaryOpenrouterConfig"),
    };
    Object.entries(sections).forEach(([key, el]) => {
      if (el) {
        const visible = provider === key;
        el.hidden = !visible;
        el.style.display = visible ? (key === "gemini" ? "block" : "") : "none";
      }
    });
  }

  function updateFallbackKeyVisibility(provider) {
    const sections = {
      gemini: document.getElementById("fallbackGeminiConfig"),
      groq: document.getElementById("fallbackGroqConfig"),
      cerebras: document.getElementById("fallbackCerebrasConfig"),
      openrouter: document.getElementById("fallbackOpenrouterConfig"),
    };
    Object.entries(sections).forEach(([key, el]) => {
      if (el) el.style.display = provider === key ? "block" : "none";
    });
    const geminiHelp = document.getElementById("fallbackGeminiHelp");
    if (geminiHelp) geminiHelp.style.display = provider === "gemini" ? "block" : "none";
  }

  function getDefaultModel(provider) {
    const key = `${provider.toUpperCase()}_MODELS`;
    const models = TB[key] || globalThis.TB_MODELS?.[key] || [];
    return models.find((model) => model.default)?.value || models[0]?.value || "";
  }

  function getProviderModels(provider) {
    const key = `${provider.toUpperCase()}_MODELS`;
    return TB[key] || globalThis.TB_MODELS?.[key] || [];
  }

  function updateFallbackOptions() {
    const primary = primaryProviderSelect.value;
    const currentFallback = fallbackProviderSelect.value;
    const options = [
      { value: "none", label: om("options_no_fallback", "Không dùng dự phòng") },
      { value: "gemini", label: om("options_gemini_fallback", "Google Gemini AI Studio") },
      { value: "groq", label: om("options_groq_fallback", "Groq Cloud") },
      { value: "cerebras", label: om("options_cerebras_fallback", "Cerebras") },
      { value: "openrouter", label: om("options_openrouter_fallback", "OpenRouter") },
    ].filter((opt) => opt.value === "none" || opt.value !== primary);

    fallbackProviderSelect.innerHTML = "";
    options.forEach((opt) => fallbackProviderSelect.add(new Option(opt.label, opt.value)));
    fallbackProviderSelect.value = options.some((opt) => opt.value === currentFallback)
      ? currentFallback
      : "none";
    handleProviderChange(fallbackProviderSelect);
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status status-error" : "status status-success";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 3000);
  }

  function setModelButtonContent(button, label, badge) {
    const icon = document.createElement("span");
    icon.className = "test-icon";
    icon.title = (om("options_test_model_label", "Kiểm tra mô hình $model$") || "").replace("$model$", label);
    icon.innerHTML = SCIENCE_ICON_SVG;
    const labelSpan = document.createElement("span");
    labelSpan.className = "model-label";
    labelSpan.textContent = label;
    button.replaceChildren(labelSpan);
    if (badge) {
      const badgeSpan = document.createElement("span");
      badgeSpan.className = "model-quota-badge";
      badgeSpan.textContent = badge;
      Object.assign(badgeSpan.style, {
        marginLeft: "6px",
        fontSize: "10px",
        fontWeight: "600",
        opacity: "0.85",
        padding: "1px 5px",
        borderRadius: "4px",
        background: "rgba(0, 0, 0, 0.25)",
      });
      button.appendChild(badgeSpan);
    }
    button.appendChild(icon);
  }

  function renderGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("geminiModelsList");
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.modelId = model.value;
      btn.dataset.modelLabel = model.label;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      setModelButtonContent(btn, model.label, model.badge);
      btn.onclick = (e) => {
        if (e.target.closest(".test-icon")) {
          e.stopPropagation();
          handleTestSingleModel(model.value, model.label, btn);
        } else {
          btn.classList.toggle("selected");
          document.getElementById("selectedModelCount").textContent =
            listEl.querySelectorAll(".selected").length;
        }
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedModelCount").textContent =
      listEl.querySelectorAll(".selected").length;
  }

  function renderProviderModelsTags(scope, provider, selectedModels = []) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const listEl = document.getElementById(`${idPrefix}ModelsList`);
    const countEl = document.getElementById(`${idPrefix}SelectedModelCount`);
    if (!listEl || !countEl) return;

    const models = getProviderModels(provider);
    listEl.innerHTML = "";
    models.forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.provider = provider;
      btn.dataset.modelId = model.value;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      setModelButtonContent(btn, model.label);

      btn.onclick = (e) => {
        if (e.target.closest(".test-icon")) {
          e.stopPropagation();
          handleTestProviderModel(scope, provider, model.value, model.label, btn);
        } else {
          btn.classList.toggle("selected");
          countEl.textContent = listEl.querySelectorAll(".selected").length;
        }
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = listEl.querySelectorAll(".selected").length;
  }

  async function handleTestProviderModel(scope, provider, modelId, modelLabel, btn) {
    const keys = getProviderKeys(scope, provider);
    if (keys.length === 0) return setStatus(om("options_enter_provider_key"), true);

    const apiKey = keys[0];
    const icon = btn.querySelector(".test-icon");
    icon.innerHTML = SPINNER_ICON_SVG;
    icon.style.color = "";
    setStatus(`${om("options_testing_model")}: ${provider} / ${modelLabel}...`);

    try {
      const result = await sendBackgroundRequest({
        type: "TEST_MODEL_WITH_KEY",
        provider,
        modelId,
        apiKey,
      });
      if (result.ok) {
        icon.innerHTML = CHECK_ICON_SVG;
        icon.style.color = "var(--success)";
        setStatus(`✓ ${om("options_model_ok")}: ${modelLabel} (${provider})`);
      } else {
        throw new Error(result.message || "Model test failed.");
      }
    } catch (e) {
      icon.innerHTML = CLOSE_ICON_SVG;
      icon.style.color = "var(--danger)";
      setStatus(`❌ ${e.message}`, true);
    } finally {
      setTimeout(() => {
        icon.innerHTML = SCIENCE_ICON_SVG;
        icon.style.color = "";
      }, 3000);
    }
  }

  function getSelectedProviderModels(scope, provider) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    return Array.from(document.querySelectorAll(`#${idPrefix}ModelsList button.selected`)).map(
      (button) => button.dataset.modelId
    );
  }

  function getSelectedModelsForProvider(scope, provider) {
    if (provider === TB.PROVIDERS.GEMINI) {
      if (scope === "fallback") {
        return Array.from(
          document.querySelectorAll("#fallbackGeminiModelsList button.selected")
        ).map((button) => button.dataset.modelId);
      }
      return Array.from(document.querySelectorAll("#geminiModelsList button.selected")).map(
        (button) => button.dataset.modelId
      );
    }
    return getSelectedProviderModels(scope, provider);
  }

  function renderProviderKeysButtons(scope, provider, keys = []) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const listEl = document.getElementById(`${idPrefix}KeysList`);
    const countEl = document.getElementById(`${idPrefix}SelectedKeyCount`);
    if (!listEl || !countEl) return;

    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.apiKey = key;
      btn.title = om("options_remove_key", "Remove API key");
      btn.setAttribute("aria-label", btn.title);
      btn.textContent = `${key.slice(0, 8)}... ×`;
      Object.assign(btn.style, {
        background: "var(--primary-surface)",
        color: "var(--primary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "6px 12px",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: "12px",
      });
      btn.onclick = () => {
        btn.remove();
        countEl.textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = keys.length;
  }

  function getProviderChipStyle(isSelected) {
    return {
      background: isSelected ? "#10b981" : "var(--primary-surface)",
      color: isSelected ? "#fff" : "var(--primary)",
      border: `1px solid ${isSelected ? "#059669" : "var(--border)"}`,
      borderRadius: "var(--radius-sm)",
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "12px",
    };
  }

  function handleProviderKeyInput(event, scope, provider) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitProviderKeyInput(scope, provider, event.target);
  }

  function commitPendingKeyInputs() {
    commitGeminiKeyInput(document.getElementById("geminiApiKeys"));
    commitFallbackGeminiKeyInput(fallbackGeminiApiKeysInput);

    [...PRIMARY_PROVIDER_CONFIGS, ...FALLBACK_PROVIDER_CONFIGS].forEach((config) => {
      const scope = config.keysStorage.startsWith("fallback") ? "fallback" : "primary";
      commitProviderKeyInput(scope, config.provider, config.keyInput);
    });
  }

  function commitProviderKeyInput(scope, provider, input) {
    const key = input?.value?.trim();
    if (!key || key === "**********") return;

    const currentKeys = getProviderKeys(scope, provider);
    if (currentKeys.length < 10 && !currentKeys.includes(key)) {
      renderProviderKeysButtons(scope, provider, [...currentKeys, key]);
      if (scope === "primary") scheduleAutoCheckPrimaryAi();
    }
    input.value = "";
  }

  function getProviderKeys(scope, provider, inputElement = null) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const keys = Array.from(document.querySelectorAll(`#${idPrefix}KeysList button`)).map(
      (button) => button.dataset.apiKey
    );
    const inputValue = inputElement?.value?.trim();
    if (inputValue && inputValue !== "**********" && !keys.includes(inputValue)) {
      keys.push(inputValue);
    }
    return keys;
  }

  async function decryptStoredList(value) {
    if (!value) return [];
    try {
      const listStr = await decryptData(value);
      return listStr ? listStr.split("\n").filter(Boolean) : [];
    } catch (error) {
      console.error("[OPTIONS] Error decrypting list:", error);
      return [];
    }
  }

  function capitalize(value) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
  }

  async function handleTestSingleModel(modelId, modelLabel, btn) {
    getFirstGeminiKey();
    if (getGeminiKeys().length === 0) return setStatus(om("options_enter_gemini_key"), true);
    const icon = btn.querySelector(".test-icon");
    icon.innerHTML = SPINNER_ICON_SVG;
    icon.style.color = "";
    setStatus(`${om("options_testing_model")}: ${modelLabel}...`);
    try {
      const result = await testGeminiKeysForModel(modelId);
      if (result.ok) {
        icon.innerHTML = CHECK_ICON_SVG;
        icon.style.color = "var(--success)";
        setStatus(`✓ ${modelLabel}: ${result.message}`);
      } else {
        icon.innerHTML = CLOSE_ICON_SVG;
        icon.style.color = "var(--danger)";
        btn.classList.remove("selected");
        const listEl = document.getElementById("geminiModelsList");
        if (listEl) {
          document.getElementById("selectedModelCount").textContent =
            listEl.querySelectorAll(".selected").length;
        }
        setStatus(
          `❌ ${modelLabel}: ${result.message || om("options_unknown_error")} (Đã tự động bỏ chọn)`,
          true
        );
      }
    } catch (e) {
      icon.innerHTML = CLOSE_ICON_SVG;
      icon.style.color = "var(--danger)";
      btn.classList.remove("selected");
      const listEl = document.getElementById("geminiModelsList");
      if (listEl) {
        document.getElementById("selectedModelCount").textContent =
          listEl.querySelectorAll(".selected").length;
      }
      setStatus(`❌ ${modelLabel}: ${e.message} (Đã tự động bỏ chọn)`, true);
    } finally {
      setTimeout(() => {
        icon.innerHTML = SCIENCE_ICON_SVG;
        icon.style.color = "";
      }, 3000);
    }
  }

  async function testGeminiKeysForModel(modelId) {
    const keys = getGeminiKeys();
    const failedIndices = [];
    for (const [index, apiKey] of keys.entries()) {
      try {
        const result = await sendBackgroundRequest({
          type: "TEST_MODEL_WITH_KEY",
          provider: TB.PROVIDERS.GEMINI,
          modelId,
          apiKey,
        });
        if (!result.ok) failedIndices.push(index + 1);
      } catch (_error) {
        failedIndices.push(index + 1);
      }
    }
    return failedIndices.length
      ? {
          ok: false,
          message: om("options_gemini_keys_test_failed")
            .replace("$count$", String(failedIndices.length))
            .replace("$total$", String(keys.length))
            .replace("$indexes$", failedIndices.join(", ")),
        }
      : {
          ok: true,
          message: om("options_gemini_keys_test_ok").replace("$count$", String(keys.length)),
        };
  }

  function renderGeminiKeysButtons(keys = []) {
    const listEl = document.getElementById("geminiKeysList");
    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.apiKey = key;
      btn.title = om("options_remove_key", "Remove API key");
      btn.setAttribute("aria-label", btn.title);
      btn.textContent = `${key.slice(0, 8)}... ×`;
      btn.onclick = () => {
        btn.remove();
        document.getElementById("selectedKeyCount").textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedKeyCount").textContent = keys.length;
  }

  function renderFallbackGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("fallbackGeminiModelsList");
    const countEl = document.getElementById("fallbackGeminiSelectedModelCount");
    if (!listEl || !countEl) return;
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.modelId = model.value;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      btn.textContent = model.label;
      Object.assign(btn.style, getProviderChipStyle(btn.classList.contains("selected")));
      btn.onclick = () => {
        btn.classList.toggle("selected");
        Object.assign(btn.style, getProviderChipStyle(btn.classList.contains("selected")));
        countEl.textContent = listEl.querySelectorAll(".selected").length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = selectedModels.length;
  }

  function renderFallbackGeminiKeysButtons(keys = []) {
    const listEl = document.getElementById("fallbackGeminiKeysList");
    const countEl = document.getElementById("fallbackGeminiSelectedKeyCount");
    if (!listEl || !countEl) return;
    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.apiKey = key;
      btn.title = om("options_remove_key", "Remove API key");
      btn.setAttribute("aria-label", btn.title);
      btn.textContent = `${key.slice(0, 8)}... ×`;
      Object.assign(btn.style, getProviderChipStyle(false), { fontFamily: "monospace" });
      btn.onclick = () => {
        btn.remove();
        countEl.textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = keys.length;
  }

  function handleFallbackGeminiKeyInput(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitFallbackGeminiKeyInput(event.target);
  }

  function commitFallbackGeminiKeyInput(input) {
    const key = input?.value?.trim();
    if (!key || key === "**********") return;
    const currentKeys = Array.from(document.querySelectorAll("#fallbackGeminiKeysList button")).map(
      (button) => button.dataset.apiKey
    );
    if (currentKeys.length < 10 && !currentKeys.includes(key)) {
      renderFallbackGeminiKeysButtons([...currentKeys, key]);
    }
    input.value = "";
  }

  function handleGeminiKeyInput(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    commitGeminiKeyInput(e.target);
  }

  function commitGeminiKeyInput(input) {
    const key = input?.value?.trim();
    const listEl = document.getElementById("geminiKeysList");
    if (
      key &&
      key !== "**********" &&
      listEl.children.length < 10 &&
      !Array.from(listEl.children).some((button) => button.dataset.apiKey === key)
    ) {
      renderGeminiKeysButtons([
        ...Array.from(listEl.children).map((button) => button.dataset.apiKey),
        key,
      ]);
      input.value = "";
      scheduleAutoCheckPrimaryAi();
    }
  }

  function getGeminiKeys() {
    return Array.from(document.querySelectorAll("#geminiKeysList button")).map(
      (button) => button.dataset.apiKey
    );
  }

  function getFallbackGeminiKeys() {
    return Array.from(document.querySelectorAll("#fallbackGeminiKeysList button")).map(
      (button) => button.dataset.apiKey
    );
  }

  function getFirstGeminiKey() {
    commitGeminiKeyInput(document.getElementById("geminiApiKeys"));
    const keys = getGeminiKeys();
    return keys[0] || "";
  }

  async function handleRedmineKeyBlur() {
    const key = redmineApiKeyInput.value.trim();
    if (key && key !== "**********") {
      const defaultId = document.getElementById("defaultProjectId")?.value;
      setTimeout(() => fetchProjects(key, defaultId), 500);
    }
  }

  async function handleSyncProjects() {
    const button = document.getElementById("syncProjectsBtn");
    const stored = await chrome.storage.local.get("redmineApiKey");
    const key = stored.redmineApiKey ? await decryptData(stored.redmineApiKey) : null;
    if (key) {
      const defaultId = document.getElementById("defaultProjectId")?.value;
      const loaded = await fetchProjects(key, defaultId, true);
      showProjectReloadResult(button, loaded);
    } else {
      setStatus(om("options_save_redmine_key_first"), true);
      showProjectReloadResult(button, false);
    }
  }

  function showProjectReloadResult(button, success) {
    if (!button) return;
    const icon = button.querySelector("svg");
    if (!icon) return;
    clearTimeout(Number(button.dataset.resultTimer));
    button.classList.remove("is-success", "is-error");
    button.classList.add(success ? "is-success" : "is-error");
    const message = om(
      success ? "options_projects_reloaded" : "options_projects_reload_failed",
      success ? "Projects reloaded" : "Could not reload projects"
    );
    button.title = message;
    button.setAttribute("aria-label", message);
    icon.innerHTML = success
      ? '<path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />'
      : '<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" />';
    button.dataset.resultTimer = String(
      setTimeout(() => {
        button.classList.remove("is-success", "is-error");
        button.title = om("options_sync_projects", "Reload projects");
        button.setAttribute("aria-label", button.title);
        icon.innerHTML =
          '<path d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20" fill="currentColor" />';
        delete button.dataset.resultTimer;
      }, 1600)
    );
  }
});
