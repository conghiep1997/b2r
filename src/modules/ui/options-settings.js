/* global TB_OPTIONS_SYNC_RULES */
/** Options settings behavior. Dependencies are supplied by the page coordinator. */
globalThis.TB_OPTIONS_SETTINGS = Object.freeze({
  create({
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
  }) {
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
        defaultProjectId: document.getElementById("defaultProjectId").value,
        defaultProjectName: (() => {
          const projectSelect = document.getElementById("defaultProjectId");
          return projectSelect.value
            ? projectSelect.selectedOptions[0]?.textContent?.trim() || ""
            : "";
        })(),
        reportProjectId: document.getElementById("reportProjectId").value,
        ...globalThis.TB_OPTIONS_PROJECT_PROFILES.readGlobal(),
        projectProfiles: await encryptData(
          JSON.stringify(globalThis.TB_OPTIONS_PROJECT_PROFILES.readProfiles())
        ),
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
      settings.fallbackGeminiModels = await encryptData(selectedFallbackGeminiModels.join("\n"));

      const selectedFallbackGeminiKeys = getFallbackGeminiKeys();
      if (selectedFallbackGeminiKeys.length > 0) {
        settings.fallbackGeminiApiKeys = await encryptData(selectedFallbackGeminiKeys.join("\n"));
      } else {
        settings.fallbackGeminiApiKeys = "";
      }

      for (const config of PRIMARY_PROVIDER_CONFIGS) {
        const selectedModels = getSelectedProviderModels("primary", config.provider);
        settings[config.modelsStorage] = await encryptData(selectedModels.join("\n"));

        const selectedKeys = getProviderKeys("primary", config.provider, config.keyInput);
        if (selectedKeys.length > 0) {
          settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
          settings[`${config.provider}ApiKey`] = await encryptData(selectedKeys[0]);
        } else if (
          !config.keyInput?.value.trim() ||
          config.keyInput.value.trim() === "**********"
        ) {
          settings[config.keysStorage] = "";
          settings[`${config.provider}ApiKey`] = "";
        }
      }

      for (const config of FALLBACK_PROVIDER_CONFIGS) {
        const selectedModels = getSelectedProviderModels("fallback", config.provider);
        settings[config.modelsStorage] = await encryptData(selectedModels.join("\n"));

        const selectedKeys = getProviderKeys("fallback", config.provider, config.keyInput);
        const legacyKeyName = `fallback${capitalize(config.provider)}ApiKey`;
        if (selectedKeys.length > 0) {
          settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
          settings[legacyKeyName] = await encryptData(selectedKeys[0]);
        } else if (
          !config.keyInput?.value.trim() ||
          config.keyInput.value.trim() === "**********"
        ) {
          settings[config.keysStorage] = "";
          settings[legacyKeyName] = "";
        }
      }

      const selectedGeminiModels = Array.from(
        document.querySelectorAll("#geminiModelsList button.selected")
      ).map((b) => b.dataset.modelId);
      if (selectedGeminiModels.length > 0) {
        settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
      } else {
        settings.geminiModels = await encryptData("");
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
        return "{}";
      }

      try {
        const parsed = JSON.parse(storedValue);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return storedValue;
        }
        return JSON.stringify(parsed, null, 2);
      } catch (_error) {
        return storedValue;
      }
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
        "defaultProjectId",
        "reportProjectId",
        "manualFields",
        "syncRules",
        "translationRules",
        "logTimeRules",
        "projectProfiles",
        "customFields",
        "showRedmineSuccessModal",
      ];

      chrome.storage.local.get(keys, async (items) => {
        document.getElementById("redmineDomain").value = items.redmineDomain || TB.REDMINE_DOMAIN;
        document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
        document.getElementById("manualFields").value = normalizeManualFields(items.manualFields);
        TB_OPTIONS_SYNC_RULES.load(items.syncRules);
        TB_OPTIONS_SYNC_RULES.loadTranslation(items.translationRules);
        TB_OPTIONS_SYNC_RULES.loadLogTime(items.logTimeRules);
        globalThis.TB_OPTIONS_PROJECT_PROFILES.load(
          items.projectProfiles ? JSON.parse(await decryptData(items.projectProfiles)) : [],
          {
            syncRules: globalThis.TB_SYNC_RULES.normalize(items.syncRules),
            translationRules: TB.PROMPTS.TRANSLATION.normalize(items.translationRules),
            logTimeRules: globalThis.TB_LOG_TIME_RULES.normalize(items.logTimeRules),
            manualFields: normalizeManualFields(items.manualFields),
            customFields: globalThis.TB_CUSTOM_FIELDS.normalize(items.customFields),
          }
        );
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
        renderFallbackGeminiModelsTags(
          items.fallbackGeminiModels !== undefined
            ? await decryptStoredList(items.fallbackGeminiModels)
            : undefined
        );
        renderFallbackGeminiKeysButtons(await decryptStoredList(items.fallbackGeminiApiKeys));

        for (const config of PRIMARY_PROVIDER_CONFIGS) {
          const models =
            items[config.modelsStorage] !== undefined
              ? await decryptStoredList(items[config.modelsStorage])
              : undefined;
          const providerKeys = await decryptStoredList(
            items[config.keysStorage] ?? items[`${config.provider}ApiKey`]
          );
          renderProviderModelsTags("primary", config.provider, models);
          renderProviderKeysButtons("primary", config.provider, providerKeys);
        }

        for (const config of FALLBACK_PROVIDER_CONFIGS) {
          const models =
            items[config.modelsStorage] !== undefined
              ? await decryptStoredList(items[config.modelsStorage])
              : undefined;
          const providerKeys = await decryptStoredList(
            items[config.keysStorage] ?? items[`fallback${capitalize(config.provider)}ApiKey`]
          );
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

        if (items.geminiModels !== undefined) {
          try {
            const modelsStr = await decryptData(items.geminiModels);
            renderGeminiModelsTags(modelsStr ? modelsStr.split("\n").filter(Boolean) : []);
          } catch (e) {
            console.error("[OPTIONS] Error decrypting geminiModels:", e);
            renderGeminiModelsTags([]);
          }
        } else {
          renderGeminiModelsTags();
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
        document.dispatchEvent(new Event("options-loaded"));
      });
    }
    return { gatherSettings, normalizeManualFields, handleApiKeyUpdate, loadOptions };
  },
});
