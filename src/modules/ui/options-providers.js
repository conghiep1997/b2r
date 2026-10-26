/** Options providers behavior. Dependencies are supplied by the page coordinator. */
globalThis.TB_OPTIONS_PROVIDERS = Object.freeze({
  create({
    PRIMARY_PROVIDER_CONFIGS,
    FALLBACK_PROVIDER_CONFIGS,
    om,
    primaryProviderSelect,
    fallbackProviderSelect,
    setStatus,
    sendBackgroundRequest,
    fallbackGeminiApiKeysInput,
  }) {
    const keyValues = new WeakMap();

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
        <p style="margin: 0 0 6px; font-size: 13px; color: var(--muted); font-weight: 500"><span data-i18n="options_models_help">${om("options_models_help", "Models (click to select/deselect, uses round-robin)")}</span></p>
        <div id="${scope}${capitalize(provider)}ModelsList" class="provider-models-list"></div>
        <p style="margin: 4px 0 0; font-size: 13px; color: var(--muted)"><span data-i18n="options_selected">${om("options_selected", "Selected:")}</span> <span id="${scope}${capitalize(provider)}SelectedModelCount">0</span></p>
      `;
        configEl.prepend(modelsBlock);

        const keysBlock = document.createElement("div");
        keysBlock.style.margin = "8px 0 0";
        keysBlock.innerHTML = `
        <p style="margin: 0 0 6px; font-size: 13px; color: var(--muted); font-weight: 500"><span data-i18n="options_keys_help">${om("options_keys_help", "Keys (enter then Save, press Enter to add quickly, click to remove)")}</span></p>
        <div id="${scope}${capitalize(provider)}KeysList" class="provider-keys-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px"></div>
        <p style="margin: 4px 0 0; font-size: 13px; color: var(--muted)"><span data-i18n="options_added">${om("options_added", "Added:")}</span> <span id="${scope}${capitalize(provider)}SelectedKeyCount">0</span>/10</p>
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

    function setModelButtonContent(button, label) {
      const text = document.createElement("span");
      text.className = "model-label";
      text.textContent = label.split(" (")[0];
      button.title = text.textContent;
      button.replaceChildren(text);
      button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
    }

    function appendModelChoice(list, button, label, test) {
      const choice = document.createElement("div");
      choice.className = "model-choice";
      const testButton = document.createElement("button");
      testButton.type = "button";
      testButton.className = "model-test";
      testButton.dataset.modelLabel = label.split(" (")[0];
      testButton.setAttribute(
        "aria-label",
        om("options_test_model_label").replace("$model$", testButton.dataset.modelLabel)
      );
      testButton.title = testButton.getAttribute("aria-label");
      const icon = document.createElement("span");
      icon.className = "test-icon";
      icon.textContent = "🧪";
      icon.setAttribute("aria-hidden", "true");
      testButton.append(icon);
      testButton.onclick = async () => {
        testButton.disabled = true;
        try {
          await test(testButton);
        } finally {
          testButton.disabled = false;
        }
      };
      choice.append(button, testButton);
      list.append(choice);
    }

    function refreshProviderLabels() {
      updateFallbackOptions();
      document.querySelectorAll(".model-test").forEach((button) => {
        const label = om("options_test_model_label").replace("$model$", button.dataset.modelLabel);
        button.title = label;
        button.setAttribute("aria-label", label);
      });
      document
        .querySelectorAll(".provider-keys-list button, #geminiKeysList button")
        .forEach((button) => {
          button.title = om("options_remove_key");
          button.setAttribute("aria-label", `${om("options_remove_key")}: ${button.textContent}`);
        });
      for (const config of [...PRIMARY_PROVIDER_CONFIGS, ...FALLBACK_PROVIDER_CONFIGS]) {
        config.keyInput.placeholder = om("options_key_quick_add");
      }
    }

    function renderKeyButtons(list, count, keys) {
      list.replaceChildren();
      keys.forEach((key, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.title = om("options_remove_key");
        button.textContent = `${index + 1} ••••${key.slice(-4)} ×`;
        button.setAttribute(
          "aria-label",
          `${om("options_remove_key")}: ${index + 1} ••••${key.slice(-4)}`
        );
        keyValues.set(button, key);
        button.onclick = () => {
          button.remove();
          count.textContent = list.children.length;
          list.dispatchEvent(new Event("input", { bubbles: true }));
        };
        list.append(button);
      });
      count.textContent = keys.length;
    }

    function addKey(input, keys, render) {
      const key = input?.value?.trim();
      if (!key || key === "**********") return true;
      if (keys.includes(key) || keys.length >= 10) {
        setStatus(om(keys.includes(key) ? "options_key_duplicate" : "options_key_limit"), true);
        return false;
      }
      render([...keys, key]);
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    function renderGeminiModelsTags(
      selectedModels = (TB.GEMINI_MODELS || []).map((model) => model.value)
    ) {
      const listEl = document.getElementById("geminiModelsList");
      listEl.innerHTML = "";
      (TB.GEMINI_MODELS || []).forEach((model) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.modelId = model.value;
        btn.dataset.modelLabel = model.label;
        btn.className = selectedModels.includes(model.value) ? "selected" : "";
        setModelButtonContent(btn, model.label);
        btn.onclick = () => {
          btn.classList.toggle("selected");
          btn.setAttribute("aria-pressed", String(btn.classList.contains("selected")));
          document.getElementById("selectedModelCount").textContent =
            listEl.querySelectorAll(".selected").length;
          btn.dispatchEvent(new Event("input", { bubbles: true }));
        };
        appendModelChoice(listEl, btn, model.label, (testButton) =>
          handleTestSingleModel(model.value, model.label, testButton)
        );
      });
      document.getElementById("selectedModelCount").textContent =
        listEl.querySelectorAll(".selected").length;
    }

    function renderProviderModelsTags(
      scope,
      provider,
      selectedModels = getProviderModels(provider).map((model) => model.value)
    ) {
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

        btn.onclick = () => {
          btn.classList.toggle("selected");
          btn.setAttribute("aria-pressed", String(btn.classList.contains("selected")));
          countEl.textContent = listEl.querySelectorAll(".selected").length;
          btn.dispatchEvent(new Event("input", { bubbles: true }));
        };
        appendModelChoice(listEl, btn, model.label, (testButton) =>
          handleTestProviderModel(scope, provider, model.value, model.label, testButton)
        );
      });
      countEl.textContent = listEl.querySelectorAll(".selected").length;
    }

    async function handleTestProviderModel(scope, provider, modelId, modelLabel, btn) {
      const input = document.getElementById(
        `${scope === "fallback" ? "fallback" : ""}${scope === "fallback" ? capitalize(provider) : provider}ApiKey`
      );
      if (commitProviderKeyInput(scope, provider, input) === false) return;
      const keys = getProviderKeys(scope, provider);
      if (keys.length === 0) return setStatus(om("options_enter_provider_key"), true);

      const apiKey = keys[0];
      const icon = btn.querySelector(".test-icon");
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
      renderKeyButtons(listEl, countEl, keys);
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
      if (
        commitGeminiKeyInput(document.getElementById("geminiApiKeys")) === false ||
        commitFallbackGeminiKeyInput(fallbackGeminiApiKeysInput) === false
      ) {
        throw new Error(om("options_pending_key_failed"));
      }

      [...PRIMARY_PROVIDER_CONFIGS, ...FALLBACK_PROVIDER_CONFIGS].forEach((config) => {
        const scope = config.keysStorage.startsWith("fallback") ? "fallback" : "primary";
        if (commitProviderKeyInput(scope, config.provider, config.keyInput) === false) {
          throw new Error(om("options_pending_key_failed"));
        }
      });
    }

    function commitProviderKeyInput(scope, provider, input) {
      return addKey(input, getProviderKeys(scope, provider), (keys) =>
        renderProviderKeysButtons(scope, provider, keys)
      );
    }

    function getProviderKeys(scope, provider, inputElement = null) {
      const idPrefix = `${scope}${capitalize(provider)}`;
      const keys = Array.from(document.querySelectorAll(`#${idPrefix}KeysList button`)).map(
        (button) => keyValues.get(button)
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

    async function testGeminiKeysForModel(modelId, keys = getGeminiKeys()) {
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
      renderKeyButtons(
        document.getElementById("geminiKeysList"),
        document.getElementById("selectedKeyCount"),
        keys
      );
    }

    function renderFallbackGeminiModelsTags(
      selectedModels = (TB.GEMINI_MODELS || []).map((model) => model.value)
    ) {
      const listEl = document.getElementById("fallbackGeminiModelsList");
      const countEl = document.getElementById("fallbackGeminiSelectedModelCount");
      if (!listEl || !countEl) return;
      listEl.innerHTML = "";
      (TB.GEMINI_MODELS || []).forEach((model) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.modelId = model.value;
        btn.className = selectedModels.includes(model.value) ? "selected" : "";
        setModelButtonContent(btn, model.label);
        btn.onclick = () => {
          btn.classList.toggle("selected");
          btn.setAttribute("aria-pressed", String(btn.classList.contains("selected")));
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
      renderKeyButtons(listEl, countEl, keys);
    }

    function handleFallbackGeminiKeyInput(event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitFallbackGeminiKeyInput(event.target);
    }

    function commitFallbackGeminiKeyInput(input) {
      return addKey(input, getFallbackGeminiKeys(), renderFallbackGeminiKeysButtons);
    }

    function handleGeminiKeyInput(e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      commitGeminiKeyInput(e.target);
    }

    function commitGeminiKeyInput(input) {
      return addKey(input, getGeminiKeys(), renderGeminiKeysButtons);
    }

    function getGeminiKeys() {
      return Array.from(document.querySelectorAll("#geminiKeysList button")).map((b) =>
        keyValues.get(b)
      );
    }

    function getFallbackGeminiKeys() {
      return Array.from(document.querySelectorAll("#fallbackGeminiKeysList button")).map((button) =>
        keyValues.get(button)
      );
    }

    function getFirstGeminiKey() {
      if (commitGeminiKeyInput(document.getElementById("geminiApiKeys")) === false) return "";
      const keys = getGeminiKeys();
      return keys[0] || "";
    }
    return {
      refreshProviderLabels,
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
    };
  },
});
