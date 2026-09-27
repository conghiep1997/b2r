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
    const redmineHelp = document.querySelector("#redmineApiKey")?.parentElement?.querySelector("p");
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
        option.textContent = om("options_save_api_first", option.textContent);
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
  const translationSourceSelect = document.getElementById("translationSourceLanguage");
  const translationTargetSelect = document.getElementById("translationTargetLanguage");
  const showRedmineSuccessModalInput = document.getElementById("showRedmineSuccessModal");
  const statusEl = document.getElementById("status");
  chrome.storage.local.get(["languagePreference", "themePreference"], (settings) => {
    const storedLanguage = settings.languagePreference;
    const storedTheme = settings.themePreference;
    languagePreference.value = storedLanguage || "en";
    themePreference.value = storedTheme || "system";
    applyTheme(themePreference.value);
  });
  languagePreference.addEventListener("change", () => {
    chrome.storage.local.set({ languagePreference: languagePreference.value });
    window.location.reload();
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

  if (
    !form ||
    !primaryProviderSelect ||
    !fallbackProviderSelect ||
    !translationSourceSelect ||
    !translationTargetSelect ||
    !statusEl
  ) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  initProviderMultiControls();
  loadOptions();

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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const domainChange = await prepareRedmineDomain(
        document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN
      );
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
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_SUCCESS);
      updateOnboardingStatuses();
      setTimeout(loadOptions, 200);
    } catch (error) {
      console.error("[OPTIONS] Save failed:", error);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR(error.message));
    }
  });

  async function gatherSettings() {
    commitPendingKeyInputs();

    if (translationSourceSelect.value === translationTargetSelect.value) {
      throw new Error(
        om("options_translation_same_language", "Choose different source and target languages.")
      );
    }

    const primaryModels = getSelectedModelsForProvider("primary", primaryProviderSelect.value);
    const fallbackModels = getSelectedModelsForProvider("fallback", fallbackProviderSelect.value);
    const settings = {
      redmineDomain: document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN,
      backlogDomain: document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      primaryProvider: primaryProviderSelect.value,
      primaryModel: primaryModels[0] || getDefaultModel(primaryProviderSelect.value),
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: fallbackModels[0] || getDefaultModel(fallbackProviderSelect.value),
      translationSourceLanguage: translationSourceSelect.value,
      translationTargetLanguage: translationTargetSelect.value,
      defaultProjectId: document.getElementById("defaultProjectId").value,
      defaultProjectName: (() => {
        const projectSelect = document.getElementById("defaultProjectId");
        return projectSelect.value
          ? projectSelect.selectedOptions[0]?.textContent?.trim() || ""
          : "";
      })(),
      reportProjectId: document.getElementById("reportProjectId").value,
      manualFields: document.getElementById("manualFields").value.trim(),
      showRedmineSuccessModal: showRedmineSuccessModalInput?.checked !== false,
    };

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
      settings.fallbackGeminiApiKeys = "";
    }

    for (const config of PRIMARY_PROVIDER_CONFIGS) {
      const selectedModels = getSelectedProviderModels("primary", config.provider);
      settings[config.modelsStorage] =
        selectedModels.length > 0 ? await encryptData(selectedModels.join("\n")) : "";

      const selectedKeys = getProviderKeys("primary", config.provider, config.keyInput);
      if (selectedKeys.length > 0) {
        settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
        settings[`${config.provider}ApiKey`] = await encryptData(selectedKeys[0]);
      } else if (!config.keyInput?.value.trim() || config.keyInput.value.trim() === "**********") {
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
      } else if (!config.keyInput?.value.trim() || config.keyInput.value.trim() === "**********") {
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
      settings.geminiApiKeys = "";
      settings.geminiApiKey = "";
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
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        throw new Error(om("options_redmine_permission_required"));
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
    } else if (value !== "**********") {
      settings[keyName] = await encryptData(value);
    }
    // If value is "**********", don't modify settings[keyName] - keep existing value
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
      "defaultProjectId",
      "reportProjectId",
      "manualFields",
      "showRedmineSuccessModal",
    ];

    chrome.storage.local.get(keys, async (items) => {
      const languagePair = TB.PROMPTS.resolveLanguagePair(items);
      translationSourceSelect.value = languagePair.source;
      translationTargetSelect.value = languagePair.target;
      document.getElementById("redmineDomain").value = items.redmineDomain || TB.REDMINE_DOMAIN;
      document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
      document.getElementById("manualFields").value = normalizeManualFields(items.manualFields);
      if (showRedmineSuccessModalInput) {
        showRedmineSuccessModalInput.checked = items.showRedmineSuccessModal !== false;
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
            fetchProjects(decryptedKey, items.defaultProjectId, items.reportProjectId);
          } else {
            console.warn("[OPTIONS] Failed to decrypt redmineApiKey");
          }
        } catch (e) {
          console.error("[OPTIONS] Error decrypting redmineApiKey:", e);
        }
      }

      if (items.geminiModels) {
        try {
          const modelsStr = await decryptData(items.geminiModels);
          renderGeminiModelsTags(modelsStr ? modelsStr.split("\n").filter(Boolean) : []);
        } catch (e) {
          console.error("[OPTIONS] Error decrypting geminiModels:", e);
          renderGeminiModelsTags([]);
        }
      } else {
        renderGeminiModelsTags([]);
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
        <p style="margin: 0 0 6px; font-size: 11px; color: #166534; font-weight: 500">${om("options_keys_help", "Keys (enter then Save, press Enter to add quickly, click to remove)")}</p>
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

  async function fetchProjects(apiKey, selectedId = "", selectedReportId = "") {
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
      cachedProjectsFingerprint === fingerprint &&
      now - cacheTimestamp < CACHE_DURATION
    ) {
      renderProjectOptions(cachedProjects, selectedId, selectedReportId);
      await chrome.storage.local.set({ redmineConnectionVerified: fingerprint });
      updateOnboardingStatuses();
      return true;
    }
    const syncBtn = document.getElementById("syncProjectsBtn");
    const defaultProjectSelect = document.getElementById("defaultProjectId");
    const reportProjectSelect = document.getElementById("reportProjectId");
    try {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = `⌛ ${om("options_loading", "Đang tải...")}`;
      }
      defaultProjectSelect.innerHTML = `<option value="">${om("options_loading", "Đang tải...")}</option>`;
      reportProjectSelect.innerHTML = `<option value="">${om("options_loading", "Đang tải...")}</option>`;
      const projects = await sendBackgroundRequest({
        type: "FETCH_REDMINE_PROJECTS_WITH_KEY",
        domain: redmineDomain,
        apiKey,
      });
      cachedProjects = projects;
      cachedProjectsFingerprint = fingerprint;
      cacheTimestamp = now;
      renderProjectOptions(projects, selectedId, selectedReportId);
      await chrome.storage.local.set({ redmineConnectionVerified: fingerprint });
      updateOnboardingStatuses();
      return true;
    } catch (_e) {
      defaultProjectSelect.innerHTML = `<option value="">${om("options_load_error", "Lỗi tải (Kiểm tra Key)")}</option>`;
      reportProjectSelect.innerHTML = `<option value="">${om("options_load_error", "Lỗi tải (Kiểm tra Key)")}</option>`;
      await chrome.storage.local.remove("redmineConnectionVerified");
      updateOnboardingStatuses();
      return false;
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = om("options_sync_projects", "🔄 Đồng bộ Project");
      }
    }
  }

  async function handleBacklogConnectionTest() {
    const button = document.getElementById("testBacklogConnectionBtn");
    const inputKey = backlogApiKeyInput.value.trim();
    button.disabled = true;
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
      document.getElementById("onboardingStatus").textContent = om(
        "options_test_backlog_success",
        "Backlog connection successful."
      );
      if (result.userName) {
        document.getElementById("onboardingStatus").textContent += ` (${result.userName})`;
      }
    } catch (error) {
      await chrome.storage.local.remove("backlogConnectionVerified");
      document.getElementById("onboardingStatus").textContent = om(
        "options_test_backlog_failed",
        "Backlog connection failed: $error$"
      ).replace("$error$", error.message);
    } finally {
      button.disabled = false;
      updateOnboardingStatuses();
    }
  }

  async function handlePrimaryAiTest() {
    const button = document.getElementById("testPrimaryAiBtn");
    const provider = primaryProviderSelect.value;
    const models = getSelectedModelsForProvider("primary", provider);
    const apiKey =
      provider === "gemini" ? getFirstGeminiKey() : getProviderKeys("primary", provider)[0];
    const modelId = models[0] || getDefaultModel(provider);
    button.disabled = true;
    try {
      if (!apiKey) throw new Error(om("options_keys_help", "Add an API key first."));
      const result =
        provider === "gemini"
          ? await testGeminiKeysForModel(modelId)
          : await sendBackgroundRequest({
              type: "TEST_MODEL_WITH_KEY",
              provider,
              modelId,
              apiKey,
            });
      if (!result.ok) throw new Error(result.message || "Model test failed.");
      await chrome.storage.local.set({
        aiConnectionVerified: await verificationFingerprint([
          provider,
          modelId,
          provider === "gemini" ? getGeminiKeys() : apiKey,
        ]),
      });
      document.getElementById("onboardingStatus").textContent = result.message;
    } catch (error) {
      await chrome.storage.local.remove("aiConnectionVerified");
      document.getElementById("onboardingStatus").textContent = error.message;
    } finally {
      button.disabled = false;
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

  function renderProjectOptions(projects, selectedId, selectedReportId) {
    const defaultSelect = document.getElementById("defaultProjectId");
    const reportSelect = document.getElementById("reportProjectId");
    defaultSelect.innerHTML = `<option value="">${om("options_choose_project", "-- Chọn project --")}</option>`;
    reportSelect.innerHTML = `<option value="">${om("options_choose_project", "-- Chọn project --")}</option>`;
    projects.forEach((p) => {
      const opt = new Option(p.name, p.id);
      defaultSelect.add(opt);
      reportSelect.add(opt.cloneNode(true));
    });
    if (selectedId) defaultSelect.value = selectedId;
    if (selectedReportId) reportSelect.value = selectedReportId;
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
      if (el) el.style.display = provider === key ? "block" : "none";
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

  function setModelButtonContent(button, label) {
    const icon = document.createElement("span");
    icon.className = "test-icon";
    icon.textContent = "🧪";
    Object.assign(icon.style, {
      marginLeft: "6px",
      opacity: "0.6",
      cursor: "pointer",
    });
    button.replaceChildren(document.createTextNode(`${label} `), icon);
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
      setModelButtonContent(btn, model.label);
      btn.onclick = (e) => {
        if (e.target.classList.contains("test-icon")) {
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

      Object.assign(btn.style, {
        background: btn.classList.contains("selected") ? "#10b981" : "#dbeafe",
        color: btn.classList.contains("selected") ? "#fff" : "#1e40af",
        border: `1px solid ${btn.classList.contains("selected") ? "#059669" : "#bfdbfe"}`,
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
      });

      btn.onclick = (e) => {
        if (e.target.classList.contains("test-icon")) {
          e.stopPropagation();
          handleTestProviderModel(scope, provider, model.value, model.label, btn);
        } else {
          btn.classList.toggle("selected");
          const isSelected = btn.classList.contains("selected");
          btn.style.background = isSelected ? "#10b981" : "#dbeafe";
          btn.style.color = isSelected ? "#fff" : "#1e40af";
          btn.style.borderColor = isSelected ? "#059669" : "#bfdbfe";
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
    const originalIcon = icon.textContent;
    icon.textContent = "⏳";
    icon.style.display = "inline-block";
    icon.style.animation = "spin 1s linear infinite";
    setStatus(`${om("options_testing_model")}: ${provider} / ${modelLabel}...`);

    try {
      const result = await sendBackgroundRequest({
        type: "TEST_MODEL_WITH_KEY",
        provider,
        modelId,
        apiKey,
      });
      if (result.ok) {
        icon.textContent = "✅";
        icon.style.animation = "";
        setStatus(`✅ ${om("options_model_ok")}: ${modelLabel} (${provider})`);
      } else {
        throw new Error(result.message || "Model test failed.");
      }
    } catch (e) {
      icon.textContent = "❌";
      icon.style.animation = "";
      setStatus(`❌ ${e.message}`, true);
    } finally {
      setTimeout(() => {
        if (icon.textContent !== "🧪") {
          // Giữ icon kết quả một lúc rồi có thể reset hoặc để nguyên
        }
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
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
      Object.assign(btn.style, {
        background: "#dbeafe",
        color: "#1e40af",
        border: "1px solid #bfdbfe",
        borderRadius: "8px",
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
      background: isSelected ? "#10b981" : "#dbeafe",
      color: isSelected ? "#fff" : "#1e40af",
      border: `1px solid ${isSelected ? "#059669" : "#bfdbfe"}`,
      borderRadius: "8px",
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
    }
    input.value = "";
  }

  function getProviderKeys(scope, provider, inputElement = null) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const keys = Array.from(document.querySelectorAll(`#${idPrefix}KeysList button`)).map(
      (button) => button.title
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
    icon.textContent = "⏳";
    icon.style.animation = "spin 1s linear infinite";
    setStatus(`${om("options_testing_model")}: ${modelLabel}...`);
    try {
      const result = await testGeminiKeysForModel(modelId);
      if (result.ok) {
        icon.textContent = "✅";
        icon.style.animation = "";
        setStatus(`✅ ${modelLabel}: ${result.message}`);
      } else {
        icon.textContent = "❌";
        icon.style.animation = "";
        setStatus(`❌ ${result.message || om("options_unknown_error")}`, true);
      }
    } catch (e) {
      icon.textContent = "❌";
      icon.style.animation = "";
      setStatus(`❌ ${om("options_model_test_failed")}: ${e.message}`, true);
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
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
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
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
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
      (button) => button.title
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
      !Array.from(listEl.children).some((b) => b.title === key)
    ) {
      renderGeminiKeysButtons([...Array.from(listEl.children).map((b) => b.title), key]);
      input.value = "";
    }
  }

  function getGeminiKeys() {
    return Array.from(document.querySelectorAll("#geminiKeysList button")).map((b) => b.title);
  }

  function getFallbackGeminiKeys() {
    return Array.from(document.querySelectorAll("#fallbackGeminiKeysList button")).map(
      (button) => button.title
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
      const defaultId = document.getElementById("defaultProjectId").value;
      const reportId = document.getElementById("reportProjectId").value;
      setTimeout(() => fetchProjects(key, defaultId, reportId), 500);
    }
  }

  async function handleSyncProjects() {
    const stored = await chrome.storage.local.get("redmineApiKey");
    const key = stored.redmineApiKey ? await decryptData(stored.redmineApiKey) : null;
    if (key) {
      fetchProjects(
        key,
        document.getElementById("defaultProjectId").value,
        document.getElementById("reportProjectId").value
      );
    } else {
      alert(om("options_save_redmine_key_first"));
    }
  }
});
