/* global TB_OPTIONS_DOMAIN, TB_OPTIONS_PROVIDERS, TB_OPTIONS_ONBOARDING, TB_OPTIONS_SETTINGS */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof TB === "undefined") {
    console.error("[OPTIONS] TB is not defined! constants.js may not have loaded.");
    return;
  }

  let optionsMessages = {};
  await localizeOptions();

  async function localizeOptions() {
    const { languagePreference } = await chrome.storage.local.get("languagePreference");
    const language = languagePreference === "vi" ? "vi" : "en";
    try {
      const response = await fetch(`../_locales/${language}/messages.json`);
      if (!response.ok) return;
      const messages = await response.json();
      const statusTranslations = Object.entries(optionsMessages).filter(
        ([key, entry]) =>
          messages[key]?.message && entry.message && /^(options_|glossary_|recovery_)/.test(key)
      );
      const translateStatus = (text, depth = 0) => {
        for (const [key, entry] of statusTranslations) {
          if (text === entry.message) return messages[key].message;
        }
        for (const [key, entry] of statusTranslations) {
          const tokens = [...entry.message.matchAll(/\$([a-zA-Z][\w]*)\$/g)];
          if (!tokens.length) continue;
          const pattern = entry.message
            .split(/\$[a-zA-Z][\w]*\$/g)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("([\\s\\S]*?)");
          const match = text.match(new RegExp(`^${pattern}$`));
          if (!match) continue;
          const values = Object.fromEntries(
            tokens.map((token, index) => [
              token[1],
              token[1] === "error" && depth < 2
                ? translateStatus(match[index + 1], depth + 1)
                : match[index + 1],
            ])
          );
          return messages[key].message.replace(
            /\$([a-zA-Z][\w]*)\$/g,
            (token, name) => values[name] ?? token
          );
        }
        // Some statuses append an account name or server-provided details.
        for (const [key, entry] of statusTranslations) {
          if (!entry.message.includes("$") && text.startsWith(entry.message)) {
            return messages[key].message + text.slice(entry.message.length);
          }
        }
        return text;
      };
      document
        .querySelectorAll("[role='status'], #bugReportStatus, #updateStatus p")
        .forEach((element) => {
          const translated = translateStatus(element.textContent);
          if (translated !== element.textContent) element.textContent = translated;
        });
      optionsMessages = messages;
      document.documentElement.lang = language;
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

  function setFirstTextNode(element, key, fallback = "") {
    if (!element) return;
    const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = om(key, fallback);
  }

  function localizeOptionsDetails() {
    document.title = om("options_document_title", document.title);
    const heroSubtitle = document.querySelector(".hero > p");
    if (heroSubtitle) heroSubtitle.textContent = om("options_subtitle", heroSubtitle.textContent);
    const placeholders = {
      redmineApiKey: "options_api_key_placeholder",
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
    const redmineHelp = document
      .querySelector("#redmineApiKey")
      ?.parentElement?.querySelector("p:not([data-i18n])");
    setFirstTextNode(redmineHelp, "options_api_account_help", "🔑 Get the API key from:");
    if (redmineHelp?.lastChild?.nodeType === Node.TEXT_NODE) {
      redmineHelp.lastChild.nodeValue = ` ${om("options_redmine_account_hint", "(See your API access key.)")}`;
    }
    setFirstTextNode(
      document.querySelector("#defaultProjectId")?.parentElement?.querySelector("label"),
      "options_default_project",
      "Project mặc định (Dùng cho Migrate)"
    );
    ["defaultProjectId", "reportProjectId"].forEach((id) => {
      const element = document.getElementById(id);
      const option = element?.querySelector("option[value='']");
      if (option) {
        option.textContent = om(
          option.dataset.i18n || "options_save_api_first",
          option.textContent
        );
      }
    });
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
      syncProjectsBtn: "options_sync_projects",
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
    const updateStatus = document.querySelector("#updateStatus p[data-i18n]");
    if (updateStatus) {
      updateStatus.textContent = om("options_update_idle").replace(
        "$version$",
        chrome.runtime.getManifest().version
      );
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
  const customFieldsSection = document.getElementById("manualFields")?.closest("details");
  if (customFieldsSection) {
    document.getElementById("advancedCustomFields").append(customFieldsSection);
  }

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
  let statusTimeout = null;
  chrome.storage.local.get(["languagePreference", "themePreference"], (settings) => {
    const storedLanguage = settings.languagePreference;
    const storedTheme = settings.themePreference;
    languagePreference.value = storedLanguage || "en";
    themePreference.value = storedTheme || "system";
    applyTheme(themePreference.value);
  });
  themePreference.addEventListener("change", () => {
    chrome.storage.local.set({ themePreference: themePreference.value });
    applyTheme(themePreference.value);
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

  const {
    prepareRedmineDomain,
    applyRedmineRegistration,
    injectIntoOpenRedmineTabs,
    unregisterCustomRedmineScript,
    removePreviousRedminePermission,
    saveSettings,
  } = TB_OPTIONS_DOMAIN.create({ om });

  const {
    initProviderMultiControls,
    handleProviderChange,
    updateProviderKeyVisibility,
    updateFallbackKeyVisibility,
    getDefaultModel,
    getProviderModels,
    updateFallbackOptions,
    setModelButtonContent,
    renderGeminiModelsTags,
    renderProviderModelsTags,
    handleTestProviderModel,
    getSelectedProviderModels,
    getSelectedModelsForProvider,
    renderProviderKeysButtons,
    getProviderChipStyle,
    handleProviderKeyInput,
    commitPendingKeyInputs,
    commitProviderKeyInput,
    getProviderKeys,
    decryptStoredList,
    capitalize,
    handleTestSingleModel,
    testGeminiKeysForModel,
    renderGeminiKeysButtons,
    renderFallbackGeminiModelsTags,
    renderFallbackGeminiKeysButtons,
    handleFallbackGeminiKeyInput,
    commitFallbackGeminiKeyInput,
    handleGeminiKeyInput,
    commitGeminiKeyInput,
    getGeminiKeys,
    getFallbackGeminiKeys,
    getFirstGeminiKey,
    refreshProviderLabels,
  } = TB_OPTIONS_PROVIDERS.create({
    PRIMARY_PROVIDER_CONFIGS,
    FALLBACK_PROVIDER_CONFIGS,
    om,
    primaryProviderSelect,
    fallbackProviderSelect,
    setStatus,
    sendBackgroundRequest,
    fallbackGeminiApiKeysInput,
  });

  const {
    fetchProjects,
    handleBacklogConnectionTest,
    handlePrimaryAiTest,
    verificationFingerprint,
    updateOnboardingStatuses,
    renderProjectOptions,
  } = TB_OPTIONS_ONBOARDING.create({
    om,
    sendBackgroundRequest,
    backlogApiKeyInput,
    primaryProviderSelect,
    getSelectedModelsForProvider,
    getFirstGeminiKey,
    getProviderKeys,
    getDefaultModel,
    testGeminiKeysForModel,
    getGeminiKeys,
    decryptStoredList,
    commitProviderKeyInput,
  });

  const { gatherSettings, normalizeManualFields, handleApiKeyUpdate, loadOptions } =
    TB_OPTIONS_SETTINGS.create({
      commitPendingKeyInputs,
      getSelectedModelsForProvider,
      primaryProviderSelect,
      fallbackProviderSelect,
      getDefaultModel,
      showRedmineSuccessModalInput,
      redmineApiKeyInput,
      backlogApiKeyInput,
      groqApiKeyInput,
      cerebrasApiKeyInput,
      openrouterApiKeyInput,
      fallbackGroqApiKeyInput,
      fallbackCerebrasApiKeyInput,
      fallbackOpenrouterApiKeyInput,
      getFallbackGeminiKeys,
      PRIMARY_PROVIDER_CONFIGS,
      getSelectedProviderModels,
      getProviderKeys,
      FALLBACK_PROVIDER_CONFIGS,
      capitalize,
      getGeminiKeys,
      handleProviderChange,
      updateFallbackOptions,
      renderFallbackGeminiModelsTags,
      decryptStoredList,
      renderFallbackGeminiKeysButtons,
      renderProviderModelsTags,
      renderProviderKeysButtons,
      fetchProjects,
      renderGeminiModelsTags,
      renderGeminiKeysButtons,
    });

  languagePreference.addEventListener("change", async () => {
    await chrome.storage.local.set({ languagePreference: languagePreference.value });
    await localizeOptions();
    localizeOptionsDetails();
    refreshProviderLabels();
    document.dispatchEvent(new CustomEvent("options-localized", { detail: optionsMessages }));
    const { syncActivity = [] } = await chrome.storage.local.get("syncActivity");
    renderSyncActivity(syncActivity);
    await updateOnboardingStatuses();
  });

  initProviderMultiControls();
  loadOptions();
  document.addEventListener("options-loaded", () => {
    document.dispatchEvent(new CustomEvent("options-localized", { detail: optionsMessages }));
    updateOnboardingStatuses();
  });
  let onboardingTimer;
  form.addEventListener("input", () => {
    clearTimeout(onboardingTimer);
    onboardingTimer = setTimeout(updateOnboardingStatuses, 150);
  });
  form.addEventListener("change", () => updateOnboardingStatuses());

  if (location.hash === "#reportProjectId") {
    requestAnimationFrame(() => {
      const reportProject = document.getElementById("reportProjectId");
      reportProject?.scrollIntoView({ behavior: "smooth", block: "center" });
      reportProject?.focus({ preventScroll: true });
    });
  }

  primaryProviderSelect.addEventListener("change", () =>
    handleProviderChange(primaryProviderSelect)
  );
  fallbackProviderSelect.addEventListener("change", () =>
    handleProviderChange(fallbackProviderSelect)
  );
  redmineApiKeyInput.addEventListener("blur", handleRedmineKeyBlur);
  document.getElementById("syncProjectsBtn")?.addEventListener("click", handleSyncProjects);
  document
    .getElementById("testBacklogConnectionBtn")
    ?.addEventListener("click", handleBacklogConnectionTest);
  document.getElementById("testPrimaryAiBtn")?.addEventListener("click", handlePrimaryAiTest);
  document.getElementById("clearSyncActivityBtn")?.addEventListener("click", async () => {
    try {
      await sendBackgroundRequest({ type: "CLEAR_SYNC_ACTIVITY" });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  document.querySelectorAll("#onboardingCard a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      const section = document.querySelector(link.getAttribute("href"));
      if (section instanceof HTMLDetailsElement) section.open = true;
    });
  });
  updateOnboardingStatuses();

  document.getElementById("geminiApiKeys")?.addEventListener("keydown", handleGeminiKeyInput);
  fallbackGeminiApiKeysInput?.addEventListener("keydown", handleFallbackGeminiKeyInput);
  document.getElementById("checkUpdateBtn")?.addEventListener("click", handleManualUpdateCheck);
  document
    .getElementById("goToDashboardBtn")
    ?.addEventListener("click", () => chrome.tabs.create({ url: "https://hipppo.vercel.app/" }));
  document.getElementById("exportLogsBtn")?.addEventListener("click", handleExportLogs);
  document.getElementById("clearLogsBtn")?.addEventListener("click", handleClearLogs);
  setupBugReport();

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
      logs: logs.slice(-50),
      screenshot: file ? { name: file.name, type: file.type, size: file.size } : null,
    };
  }

  async function downloadBugReport() {
    const report = await buildBugReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `b2r-bug-report-${Date.now()}.json`);
    const file = document.getElementById("bugScreenshot")?.files?.[0];
    if (file) downloadBlob(file, `b2r-bug-screenshot-${Date.now()}-${file.name}`);
    setBugReportStatus(om(file ? "options_bug_downloaded" : "options_bug_report_downloaded"));
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
          <p style="margin: 0; color: #f59e0b; font-weight: 600;">
            ${om("options_new_version", "🚀 Có phiên bản mới:")} <span style="color: #d97706">v${latestVersion}</span>
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
          ❌ ${om("options_update_failed", "Lỗi kiểm tra:")} ${error.message}
        </p>
      `;
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  form.addEventListener(
    "invalid",
    (event) => {
      for (let section = event.target.parentElement; section; section = section.parentElement) {
        if (section instanceof HTMLDetailsElement) section.open = true;
      }
    },
    true
  );

  let savingSettings = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (savingSettings) return;
    savingSettings = true;
    const saveButton = form.querySelector("button[type='submit']");
    saveButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    try {
      const domainChange = await prepareRedmineDomain(
        document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN
      );
      const settings = await gatherSettings();
      settings.redmineDomain = domainChange.currentDomain;
      const credentialInputs = [redmineApiKeyInput, backlogApiKeyInput];
      const savedInputValues = credentialInputs.map((input) => input.value);
      await saveSettings(settings, domainChange);
      credentialInputs.forEach((input, index) => {
        if (input.value && input.value === savedInputValues[index]) input.value = "**********";
      });
      setStatus(om("options_save_success"));
      updateOnboardingStatuses();
    } catch (error) {
      console.error("[OPTIONS] Save failed:", error);
      setStatus(om("options_save_error").replace("$error$", error.message), true);
    } finally {
      savingSettings = false;
      saveButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });

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

  function setStatus(message, isError = false) {
    clearTimeout(statusTimeout);
    statusEl.textContent = message;
    statusEl.className = isError ? "status status-error" : "status status-success";
    if (isError) return;
    statusTimeout = setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 3000);
  }

  async function handleRedmineKeyBlur() {
    const key = redmineApiKeyInput.value.trim();
    if (key && key !== "**********") {
      const defaultId = document.getElementById("defaultProjectId").value;
      const reportId = document.getElementById("reportProjectId").value;
      setTimeout(() => fetchProjects(key, defaultId, reportId), 500);
    }
  }

  async function handleSyncProjects() {
    const stored = await chrome.storage.local.get("redmineApiKey");
    const input = redmineApiKeyInput.value.trim();
    const key =
      input && input !== "**********"
        ? input
        : stored.redmineApiKey
          ? await decryptData(stored.redmineApiKey)
          : null;
    if (key) {
      await fetchProjects(
        key,
        document.getElementById("defaultProjectId").value,
        document.getElementById("reportProjectId").value,
        true
      );
    } else {
      setStatus(om("options_redmine_key_missing"), true);
    }
  }
});
