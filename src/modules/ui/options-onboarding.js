/** Options onboarding behavior. Dependencies are supplied by the page coordinator. */
globalThis.TB_OPTIONS_ONBOARDING = Object.freeze({
  create({
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
  }) {
    let statusRevision = 0;
    let cachedProjects = null;
    let cachedProjectsFingerprint = "";
    let cacheTimestamp = 0;
    const CACHE_DURATION = 5 * 60 * 1000;
    async function fetchProjects(apiKey, selectedId = "", selectedReportId = "", force = false) {
      if (!apiKey) return false;
      const redmineDomain =
        document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN;
      const fingerprint = await verificationFingerprint([
        TB_REDMINE_DOMAIN.normalize(redmineDomain),
        apiKey,
      ]);
      const now = Date.now();
      if (
        !force &&
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
        setProjectPlaceholder(defaultProjectSelect, "options_loading");
        setProjectPlaceholder(reportProjectSelect, "options_loading");
        const projects = await sendBackgroundRequest({
          type: "FETCH_REDMINE_PROJECTS_WITH_KEY",
          domain: redmineDomain,
          apiKey,
        });
        if (!projects.length) {
          document.getElementById("onboardingStatus").textContent = om("options_projects_empty");
        }
        cachedProjects = projects;
        cachedProjectsFingerprint = fingerprint;
        cacheTimestamp = now;
        renderProjectOptions(projects, selectedId, selectedReportId);
        await chrome.storage.local.set({ redmineConnectionVerified: fingerprint });
        updateOnboardingStatuses();
        return true;
      } catch (error) {
        document.getElementById("onboardingStatus").textContent =
          `${om("options_projects_failed")} ${error.message}`;
        setProjectPlaceholder(defaultProjectSelect, "options_load_error");
        setProjectPlaceholder(reportProjectSelect, "options_load_error");
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
          inputKey === "**********" ? await decryptData(stored.backlogApiKey || "") : inputKey;
        if (!apiKey) throw new Error(om("options_backlog_key_missing"));
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
      if (
        provider !== "gemini" &&
        commitProviderKeyInput(
          "primary",
          provider,
          document.getElementById(`${provider}ApiKey`)
        ) === false
      ) {
        return;
      }
      const models = getSelectedModelsForProvider("primary", provider);
      const apiKey =
        provider === "gemini" ? getFirstGeminiKey() : getProviderKeys("primary", provider)[0];
      const modelId = models[0] || getDefaultModel(provider);
      // Verify exactly the credentials used by this request, even if the form changes.
      const testedKeys = provider === "gemini" ? getGeminiKeys() : apiKey;
      button.disabled = true;
      try {
        if (!apiKey) throw new Error(om("options_ai_key_missing"));
        const result =
          provider === "gemini"
            ? await testGeminiKeysForModel(modelId, testedKeys)
            : await sendBackgroundRequest({
                type: "TEST_MODEL_WITH_KEY",
                provider,
                modelId,
                apiKey,
              });
        if (!result.ok) throw new Error(result.message || "Model test failed.");
        await chrome.storage.local.set({
          aiConnectionVerified: await verificationFingerprint([provider, modelId, testedKeys]),
        });
        document.getElementById("onboardingStatus").textContent = om(
          "options_test_ai_success"
        ).replace("$model$", modelId);
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
      const revision = ++statusRevision;
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
        "groqApiKeys",
        "cerebrasApiKey",
        "cerebrasApiKeys",
        "openrouterApiKey",
        "openrouterApiKeys",
        "aiConnectionVerified",
      ]);
      const readKey = async (id, stored) => {
        const value = document.getElementById(id).value.trim();
        return value === "**********" ? await decryptData(stored || "") : value;
      };
      const redmineKey = await readKey("redmineApiKey", items.redmineApiKey);
      const backlogKey = await readKey("backlogApiKey", items.backlogApiKey);
      const provider = primaryProviderSelect.value;
      const model =
        getSelectedModelsForProvider("primary", provider)[0] || getDefaultModel(provider);
      const keys = provider === "gemini" ? getGeminiKeys() : getProviderKeys("primary", provider);
      const pendingKey = document
        .getElementById(provider === "gemini" ? "geminiApiKeys" : `${provider}ApiKey`)
        .value.trim();
      const aiKeys =
        pendingKey && pendingKey !== "**********" && !keys.includes(pendingKey)
          ? [...keys, pendingKey]
          : keys;
      const redmineDomain =
        document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN;
      const backlogDomain =
        document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN;
      const fingerprints = await Promise.all([
        redmineKey
          ? verificationFingerprint([TB_REDMINE_DOMAIN.normalize(redmineDomain), redmineKey])
          : "",
        backlogKey ? verificationFingerprint([backlogDomain, backlogKey]) : "",
        aiKeys.length
          ? verificationFingerprint([provider, model, provider === "gemini" ? aiKeys : aiKeys[0]])
          : "",
      ]);
      const savedRedmineKey = await decryptData(items.redmineApiKey || "");
      const savedBacklogKey = await decryptData(items.backlogApiKey || "");
      const savedProvider = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
      const savedAiKey = await decryptData(items[`${savedProvider}ApiKey`] || "");
      const savedAiKeys = items[`${savedProvider}ApiKeys`]
        ? await decryptStoredList(items[`${savedProvider}ApiKeys`])
        : savedAiKey
          ? [savedAiKey]
          : [];
      const savedFingerprints = await Promise.all([
        savedRedmineKey
          ? verificationFingerprint([
              TB_REDMINE_DOMAIN.normalize(items.redmineDomain || TB.REDMINE_DOMAIN),
              savedRedmineKey,
            ])
          : "",
        savedBacklogKey
          ? verificationFingerprint([items.backlogDomain || TB.BACKLOG_DOMAIN, savedBacklogKey])
          : "",
        savedAiKeys.length
          ? verificationFingerprint([
              savedProvider,
              items.primaryModel || getDefaultModel(savedProvider),
              savedProvider === "gemini" ? savedAiKeys : savedAiKeys[0],
            ])
          : "",
      ]);
      if (revision !== statusRevision) return;
      const states = [
        [
          "onboardingRedmineStatus",
          items.redmineConnectionVerified,
          document.getElementById("defaultProjectId").value,
        ],
        ["onboardingBacklogStatus", items.backlogConnectionVerified, true],
        ["onboardingAiStatus", items.aiConnectionVerified, true],
      ];
      states.forEach(([id, verified, project], index) => {
        const configured = Boolean(fingerprints[index]);
        const connected = configured && verified === fingerprints[index];
        const unsaved =
          connected &&
          (fingerprints[index] !== savedFingerprints[index] ||
            (index === 0 && project !== (items.defaultProjectId || "")) ||
            (index === 2 && JSON.stringify(aiKeys) !== JSON.stringify(savedAiKeys)));
        const key = !configured
          ? "options_onboarding_not_configured"
          : !connected
            ? "options_onboarding_status_pending"
            : !project
              ? "options_onboarding_choose_project"
              : unsaved
                ? "options_onboarding_unsaved"
                : "options_onboarding_status_done";
        const element = document.getElementById(id);
        element.textContent = om(key);
        element.classList.toggle("status-success", connected && Boolean(project) && !unsaved);
      });
    }

    function setProjectPlaceholder(select, key) {
      const option = new Option(om(key), "");
      option.dataset.i18n = key;
      select.replaceChildren(option);
    }

    function renderProjectOptions(projects, selectedId, selectedReportId) {
      const defaultSelect = document.getElementById("defaultProjectId");
      const reportSelect = document.getElementById("reportProjectId");
      const placeholder = projects.length
        ? "options_choose_project"
        : "options_projects_empty_select";
      setProjectPlaceholder(defaultSelect, placeholder);
      setProjectPlaceholder(reportSelect, placeholder);
      projects.forEach((p) => {
        const opt = new Option(p.name, p.id);
        defaultSelect.add(opt);
        reportSelect.add(opt.cloneNode(true));
      });
      if (selectedId) defaultSelect.value = selectedId;
      if (selectedReportId) reportSelect.value = selectedReportId;
    }
    return {
      fetchProjects,
      handleBacklogConnectionTest,
      handlePrimaryAiTest,
      verificationFingerprint,
      updateOnboardingStatuses,
      renderProjectOptions,
    };
  },
});
