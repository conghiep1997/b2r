/* global TB_GLOSSARY */
/**
 * AI Translation Service using Gemini and Cerebras.
 */

// Reserve each request's starting slot before awaiting the provider response.
let lastUsedGeminiIndex = 0;
const geminiCooldownUntilByCombination = new Map();
const geminiCooldownUntilByKey = new Map();
const lastUsedProviderIndexByProvider = {};
const providerCooldownUntilByCombination = new Map();
const GEMINI_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const GEMINI_OVERLOAD_COOLDOWN_MS = 30 * 1000;
const GEMINI_UNAVAILABLE_COOLDOWN_MS = 5 * 60 * 1000;
const RETIRED_GEMINI_MODELS = new Set(["gemini-2.0-flash", "gemini-2.0-flash-lite"]);
const AI_TRANSLATION_TIMEOUT_MS = 15 * 1000;

function getProviderSystemPrompt(promptFn) {
  return promptFn.system ? `${TB.PROMPTS.SYSTEM}\n\n${promptFn.system}` : TB.PROMPTS.SYSTEM;
}

function emitAIStatus(status, onStatus) {
  try {
    onStatus?.(status);
  } catch (_error) {
    // Status feedback must not interrupt translation.
  }
}

/**
 * Fetches the list of available models from a provider.
 * @param {string} provider - The AI provider (e.g., 'gemini', 'groq').
 * @param {string} apiKey - The API key for the provider.
 * @returns {Promise<Array<{value: string, label: string}>>} A list of models.
 */
async function listProviderModels(provider, apiKey) {
  switch (provider) {
    case TB.PROVIDERS.GEMINI:
      return _listGeminiModels(apiKey);
    case TB.PROVIDERS.GROQ:
      return _listGroqModels(apiKey);
    case TB.PROVIDERS.CEREBRAS:
      // Cerebras does not have a public model listing API, return hardcoded list.
      return Promise.resolve(TB.CEREBRAS_MODELS);
    case TB.PROVIDERS.OPENROUTER:
      return _listOpenRouterModels(apiKey);
    default:
      return Promise.resolve([]);
  }
}

async function _listGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await timeoutFetch(url, { method: "GET" }, 5000);
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `Failed to fetch Gemini models: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }
  const data = await safeReadJson(response);
  return data.models
    .filter((model) => model.supportedGenerationMethods.includes("generateContent"))
    .map((model) => ({
      value: model.name.replace("models/", ""),
      label: model.displayName || model.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort for better UX
}

async function _listGroqModels(apiKey) {
  const url = "https://api.groq.com/openai/v1/models";
  const response = await timeoutFetch(
    url,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    5000
  );
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `Failed to fetch Groq models: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }
  const data = await safeReadJson(response);
  return data.data
    .map((model) => ({
      value: model.id,
      label: model.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function _listOpenRouterModels(apiKey) {
  const response = await timeoutFetch(
    "https://openrouter.ai/api/v1/models",
    {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    },
    5000
  );
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `Failed to fetch OpenRouter models: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }
  const data = await safeReadJson(response);
  return (data.data || [])
    .map((model) => ({
      value: model.id,
      label: model.name || model.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Tests the availability of a specific model by sending a minimal request.
 * @param {string} provider The AI provider.
 * @param {string} modelId The ID of the model to test.
 * @param {object} settings The extension settings.
 * @returns {Promise<{ok: boolean, message: string}>} Test result.
 */
async function testModelAvailability(provider, modelId, settings) {
  const testText = "Hello";
  try {
    switch (provider) {
      case TB.PROVIDERS.GEMINI: {
        // Find any valid Gemini key to use for testing
        const apiKey = settings.geminiApiKeys?.[0] || settings.geminiApiKey;
        if (!apiKey) throw new Error("No Gemini API key found for testing.");
        await callGeminiAPI(apiKey, testText, modelId, () => 'Just say "ok"');
        break;
      }
      case TB.PROVIDERS.GROQ:
        if (!settings.groqApiKey) throw new Error("No Groq API key found for testing.");
        await callGroqAPI(settings.groqApiKey, testText, modelId, () => 'Just say "ok"');
        break;
      case TB.PROVIDERS.CEREBRAS:
        if (!settings.cerebrasApiKey) throw new Error("No Cerebras API key found for testing.");
        await callCerebrasAPI(settings.cerebrasApiKey, testText, modelId, () => 'Just say "ok"');
        break;
      case TB.PROVIDERS.OPENROUTER:
        if (!settings.openrouterApiKey) throw new Error("No OpenRouter API key found for testing.");
        await callOpenRouterAPI(
          settings.openrouterApiKey,
          testText,
          modelId,
          () => 'Just say "ok"'
        );
        break;
      default:
        throw new Error(`Unsupported provider for testing: ${provider}`);
    }
    return { ok: true, message: "Model is responsive." };
  } catch (error) {
    console.warn(`[TB-AI] Model test failed for ${modelId}:`, error);
    return { ok: false, message: error.message };
  }
}

/**
 * Main translation function with fallback support.
 * @param {string} commentText - Text to translate
 * @param {object} settings - Extension settings
 * @param {string|null} commentUrl - Optional comment URL for attribution
 * @param {function} promptFn - Prompt builder function
 * @returns {Promise<string>} Translated text
 */
async function translateText(
  commentText,
  settings,
  commentUrl = null,
  promptFn = TB.PROMPTS.USER,
  onStatus
) {
  const cleanInputText =
    typeof stripSyncMarkers === "function"
      ? stripSyncMarkers(commentText)
      : String(commentText || "").trim();
  const rules = settings.translationRules
    ? TB.PROMPTS.TRANSLATION.normalize(settings.translationRules)
    : TB.PROMPTS.TRANSLATION.normalize({
        source: settings.translationSourceLanguage || "ja",
        target: settings.translationTargetLanguage || "vi",
      });
  const reverse = Boolean(settings.isReverseTranslation);
  if ((reverse && rules.reverseMode === "original") || promptFn.reverseMode === "original") {
    return cleanInputText;
  }
  const selectedPrompt =
    promptFn === TB.PROMPTS.USER || promptFn === TB.PROMPTS.SIMPLE_TRANSLATE
      ? TB.PROMPTS.TRANSLATION.prompt(rules, reverse, Boolean(commentUrl))
      : promptFn;
  const languagePair = TB.PROMPTS.resolveLanguagePair(settings);
  let promptBuilder = selectedPrompt;
  const configuredPrompt = (text) => promptBuilder(text, settings);
  configuredPrompt.system = selectedPrompt.system;
  configuredPrompt.attribution = selectedPrompt.attribution;
  configuredPrompt.extract = selectedPrompt.extract;
  configuredPrompt.translationLabel =
    selectedPrompt.translationLabel || languagePair.target.toUpperCase();
  configuredPrompt.includeOriginal = promptFn === TB.PROMPTS.USER;
  configuredPrompt.targetLanguage = selectedPrompt.translationLabel || languagePair.target;
  let sourceText = cleanInputText;
  let restoreGlossary = (output) => output;
  if (globalThis.TB_GLOSSARY?.prepare && settings.currentProjectKey && !selectedPrompt.extract) {
    const prepared = await TB_GLOSSARY.prepare(
      settings,
      settings.currentProjectKey,
      sourceText,
      selectedPrompt
    );
    sourceText = prepared.text;
    restoreGlossary = prepared.restore;
    promptBuilder = prepared.prompt;
    Object.assign(configuredPrompt, {
      system: prepared.prompt.system,
      attribution: prepared.prompt.attribution,
      translationLabel: prepared.prompt.translationLabel,
      extract: prepared.prompt.extract,
      wrapped: prepared.prompt,
    });
  }
  const primaryProvider = settings.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
  const primaryModel = settings.primaryModel || TB.DEFAULT_PRIMARY_MODEL;
  const fallbackProvider = settings.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
  const fallbackModel = settings.fallbackModel || TB.DEFAULT_FALLBACK_MODEL;
  emitAIStatus({ phase: "start", provider: primaryProvider, model: primaryModel }, onStatus);

  try {
    const translated = await callAIsByProvider(
      primaryProvider,
      primaryModel,
      settings,
      sourceText,
      commentUrl,
      configuredPrompt,
      onStatus,
      false
    );
    emitAIStatus({ phase: "success", provider: primaryProvider, model: primaryModel }, onStatus);
    return restoreGlossary(translated);
  } catch (error) {
    // Fallback on rate limit and temporary provider overloads such as Gemini 503 high demand.
    const isRetryableProviderFailure = isRetryableProviderError(error);
    const hasFallback = fallbackProvider && fallbackProvider !== TB.PROVIDERS.NONE;

    if (isRetryableProviderFailure && hasFallback) {
      emitAIStatus(
        { phase: "fallback", provider: primaryProvider, fallback: fallbackProvider },
        onStatus
      );
      console.warn(
        `[TB-AI] Primary (${primaryProvider}) temporarily unavailable. Falling back to ${fallbackProvider}...`
      );
      try {
        const translated = await callAIsByProvider(
          fallbackProvider,
          fallbackModel,
          settings,
          sourceText,
          commentUrl,
          configuredPrompt,
          onStatus,
          true
        );
        emitAIStatus(
          { phase: "success", provider: fallbackProvider, model: fallbackModel },
          onStatus
        );
        return restoreGlossary(translated);
      } catch (fallbackError) {
        emitAIStatus({ phase: "error", error: fallbackError.message }, onStatus);
        throw new Error(
          `${TB.MESSAGES.TOAST.RATE_LIMIT_FAILED} Primary: ${error.message} | Fallback: ${fallbackError.message}`
        );
      }
    }
    emitAIStatus({ phase: "error", error: error.message }, onStatus);
    throw error;
  }
}

/**
 * Helper to route call to the correct provider function.
 * @param {string} provider - Provider name (gemini|cerebras)
 * @param {string} model - Model identifier
 * @param {object} settings - Extension settings
 * @param {string} text - Text to translate
 * @param {string|null} url - Optional comment URL
 * @param {function} promptFn - Prompt builder function
 * @returns {Promise<string>} Translated text
 */
function getRandomGeminiKey(apiKeys) {
  if (!apiKeys || apiKeys.length === 0) return null;
  const idx = Math.floor(Math.random() * apiKeys.length);
  return apiKeys[idx].trim();
}

function getRandomGeminiModel(models) {
  if (!models || models.length === 0) return null;
  const idx = Math.floor(Math.random() * models.length);
  return models[idx].trim();
}

async function callAIsByProvider(
  provider,
  model,
  settings,
  text,
  url,
  promptFn,
  onStatus,
  isFallbackCall = false
) {
  // Fallback for legacy "gem" provider
  if (provider === "gem") {
    console.warn("[TB-AI] Legacy provider 'gem' detected, falling back to 'gemini'");
    provider = TB.PROVIDERS.GEMINI;
  }

  if (provider === TB.PROVIDERS.GEMINI) {
    let selectedModels = [];
    if (isFallbackCall && settings.fallbackGeminiModels?.length > 0) {
      selectedModels = settings.fallbackGeminiModels;
    } else if (settings.geminiModels?.length > 0) {
      selectedModels = settings.geminiModels;
    }
    const models = [...new Set(selectedModels.map((item) => item.trim()).filter(Boolean))].filter(
      (item) => !RETIRED_GEMINI_MODELS.has(item)
    );
    if (models.length === 0) {
      models.push(
        RETIRED_GEMINI_MODELS.has(model)
          ? TB.DEFAULT_PRIMARY_MODEL
          : model || TB.DEFAULT_PRIMARY_MODEL
      );
    }

    const apiKeys = [
      ...new Set(
        (isFallbackCall && settings.fallbackGeminiApiKeys?.length > 0
          ? settings.fallbackGeminiApiKeys
          : settings.geminiApiKeys?.length > 0
            ? settings.geminiApiKeys
            : [settings.geminiApiKey]
        )
          .map((key) => key?.trim())
          .filter(Boolean)
      ),
    ];

    // Create a flat list of all [model, key] combinations
    const combinations = [];
    for (const m of models) {
      for (const key of apiKeys) {
        combinations.push({ model: m, key });
      }
    }

    if (combinations.length === 0) {
      throw new Error("No Gemini models or API keys are configured.");
    }

    let lastError = null;
    let skippedCooldowns = 0;
    let nextCooldownReadyAt = Infinity;
    const startIndex = lastUsedGeminiIndex % combinations.length;
    lastUsedGeminiIndex = (startIndex + 1) % combinations.length;

    // Iterate through combinations in a round-robin fashion for failover
    for (let i = 0; i < combinations.length; i++) {
      const currentIndex = (startIndex + i) % combinations.length;
      const { model: currentModel, key: currentKey } = combinations[currentIndex];
      const combinationId = getGeminiCombinationId(currentModel, currentKey);
      const cooldownUntil = Math.max(
        geminiCooldownUntilByCombination.get(combinationId) || 0,
        geminiCooldownUntilByKey.get(currentKey) || 0
      );

      if (cooldownUntil > Date.now()) {
        skippedCooldowns++;
        nextCooldownReadyAt = Math.min(nextCooldownReadyAt, cooldownUntil);
        console.warn(
          `[TB-AI] Skipping Gemini ${currentModel} (${maskApiKey(currentKey)}), cooling down for ${Math.ceil(
            (cooldownUntil - Date.now()) / 1000
          )}s`
        );
        continue;
      }
      geminiCooldownUntilByCombination.delete(combinationId);
      geminiCooldownUntilByKey.delete(currentKey);

      try {
        console.log(
          `[TB-AI] Attempting Gemini call with model: ${currentModel}, key: ${maskApiKey(
            currentKey
          )} (Round-Robin)`
        );
        const result = await callGeminiAPI(currentKey, text, currentModel, promptFn, url);

        return result;
      } catch (error) {
        const isRetryable = isRetryableProviderError(error);
        const canTryAnotherCombination = isRetryable || isGeminiCombinationUnavailable(error);

        if (!canTryAnotherCombination) {
          throw error;
        }
        lastError = error;
        const cooldownMs = isRetryable
          ? getGeminiCooldownDuration(error)
          : GEMINI_UNAVAILABLE_COOLDOWN_MS;
        const retryAt = Date.now() + cooldownMs;
        if (isGeminiKeyUnavailable(error) || isGeminiKeyRateLimited(error)) {
          geminiCooldownUntilByKey.set(currentKey, retryAt);
        } else {
          geminiCooldownUntilByCombination.set(combinationId, retryAt);
        }
        emitAIStatus(
          {
            phase: "retry",
            provider: "Gemini",
            model: currentModel,
            attempt: i + 2,
            seconds: Math.ceil(cooldownMs / 1000),
          },
          onStatus
        );
        console.warn(
          `[TB-AI] Gemini ${currentModel} (${maskApiKey(
            currentKey
          )}) failed with ${error.message}. Cooling down ${Math.ceil(cooldownMs / 1000)}s, trying next...`
        );
      }
    }

    if (skippedCooldowns === combinations.length && Number.isFinite(nextCooldownReadyAt)) {
      const waitSeconds = Math.max(1, Math.ceil((nextCooldownReadyAt - Date.now()) / 1000));
      throw new Error(
        `All Gemini model/key combinations are cooling down. Try again in ${waitSeconds}s.`
      );
    }

    // If all combinations were exhausted, throw the last captured error.
    throw lastError || new Error("All Gemini model/key combinations failed.");
  } else if (
    provider === TB.PROVIDERS.CEREBRAS ||
    provider === TB.PROVIDERS.GROQ ||
    provider === TB.PROVIDERS.OPENROUTER
  ) {
    return await callProviderWithFailover(
      provider,
      model,
      settings,
      text,
      url,
      promptFn,
      onStatus,
      isFallbackCall
    );
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callProviderWithFailover(
  provider,
  model,
  settings,
  text,
  url,
  promptFn,
  onStatus,
  isFallbackCall = false
) {
  const models = getProviderModelsForCall(settings, provider, model, isFallbackCall);
  const apiKeys = getProviderApiKeysForCall(settings, provider, isFallbackCall);
  const combinations = [];
  for (const currentModel of models) {
    for (const key of apiKeys) {
      combinations.push({ model: currentModel, key });
    }
  }

  if (combinations.length === 0) {
    throw new Error(`No ${provider} models or API keys are configured.`);
  }

  let lastError = null;
  let skippedCooldowns = 0;
  let nextCooldownReadyAt = Infinity;
  const startIndex = (lastUsedProviderIndexByProvider[provider] || 0) % combinations.length;
  lastUsedProviderIndexByProvider[provider] = (startIndex + 1) % combinations.length;

  for (let i = 0; i < combinations.length; i++) {
    const currentIndex = (startIndex + i) % combinations.length;
    const { model: currentModel, key: currentKey } = combinations[currentIndex];
    const combinationId = `${provider}\u0000${currentModel}\u0000${currentKey}`;
    const cooldownUntil = providerCooldownUntilByCombination.get(combinationId) || 0;

    if (cooldownUntil > Date.now()) {
      skippedCooldowns++;
      nextCooldownReadyAt = Math.min(nextCooldownReadyAt, cooldownUntil);
      continue;
    }
    providerCooldownUntilByCombination.delete(combinationId);

    try {
      const result = await callProviderAPI(provider, currentKey, text, currentModel, promptFn, url);
      return result;
    } catch (error) {
      if (!isRetryableProviderError(error)) {
        throw error;
      }
      lastError = error;
      const cooldownMs = getGeminiCooldownDuration(error);
      providerCooldownUntilByCombination.set(combinationId, Date.now() + cooldownMs);
      emitAIStatus(
        {
          phase: "retry",
          provider,
          model: currentModel,
          attempt: i + 2,
          seconds: Math.ceil(cooldownMs / 1000),
        },
        onStatus
      );
      console.warn(
        `[TB-AI] ${provider} ${currentModel} (${maskApiKey(
          currentKey
        )}) failed with ${error.message}. Cooling down ${Math.ceil(cooldownMs / 1000)}s, trying next...`
      );
    }
  }

  if (skippedCooldowns === combinations.length && Number.isFinite(nextCooldownReadyAt)) {
    const waitSeconds = Math.max(1, Math.ceil((nextCooldownReadyAt - Date.now()) / 1000));
    throw new Error(
      `All ${provider} model/key combinations are cooling down. Try again in ${waitSeconds}s.`
    );
  }

  throw lastError || new Error(`All ${provider} model/key combinations failed.`);
}

function getProviderModelsForCall(settings, provider, selectedModel, isFallbackCall = false) {
  if (isFallbackCall) {
    const fallbackModels = settings[`fallback${capitalize(provider)}Models`] || [];
    if (fallbackModels.length > 0) {
      return fallbackModels;
    }
  }
  const selectedModels = settings[`${provider}Models`] || [];
  if (selectedModels.length > 0) {
    return selectedModels;
  }
  if (selectedModel) {
    return [selectedModel];
  }
  const key = `${provider.toUpperCase()}_MODELS`;
  const defaultModels = TB[key] || [];
  return defaultModels.map((item) => item.value).filter(Boolean);
}

function getProviderApiKeysForCall(settings, provider, isFallbackCall = false) {
  if (isFallbackCall) {
    const fallbackKeys = settings[`fallback${capitalize(provider)}ApiKeys`] || [];
    if (fallbackKeys.length > 0) return fallbackKeys;
    const fallbackKey = settings[`fallback${capitalize(provider)}ApiKey`];
    if (fallbackKey) return [fallbackKey];
  }
  const apiKeys = settings[`${provider}ApiKeys`] || [];
  const legacyKey = settings[`${provider}ApiKey`];
  return (apiKeys.length > 0 ? apiKeys : [legacyKey]).filter(Boolean);
}

function callProviderAPI(provider, apiKey, text, model, promptFn, url) {
  if (provider === TB.PROVIDERS.CEREBRAS) {
    return callCerebrasAPI(apiKey, text, model, promptFn, url);
  }
  if (provider === TB.PROVIDERS.GROQ) {
    return callGroqAPI(apiKey, text, model, promptFn, url);
  }
  if (provider === TB.PROVIDERS.OPENROUTER) {
    return callOpenRouterAPI(apiKey, text, model, promptFn, url);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function isRetryableProviderError(error) {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.status === 429 ||
    error?.status === 503 ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("cooling down") ||
    message.includes("high demand") ||
    message.includes("try again later") ||
    message.includes("only safety metadata")
  );
}

function isGeminiKeyUnavailable(error) {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.status === 401 ||
    (error?.status === 400 && /api.?key.*(invalid|expired|not valid)/i.test(message))
  );
}

function isGeminiCombinationUnavailable(error) {
  return isGeminiKeyUnavailable(error) || error?.status === 403 || error?.status === 404;
}

function isGeminiKeyRateLimited(error) {
  const message = (error?.message || "").toLowerCase();
  return error?.status === 429 || message.includes("429") || message.includes("rate limit");
}

function getGeminiCooldownDuration(error) {
  const baseDuration = isGeminiKeyRateLimited(error)
    ? GEMINI_RATE_LIMIT_COOLDOWN_MS
    : GEMINI_OVERLOAD_COOLDOWN_MS;
  return Math.max(baseDuration, error?.retryAfterMs || 0);
}

function getGeminiCombinationId(model, apiKey) {
  return `${model}\u0000${apiKey}`;
}

function maskApiKey(apiKey) {
  if (!apiKey) return "(empty key)";
  return `...${apiKey.slice(-6)}`;
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
}

async function callGeminiAPI(
  apiKey,
  commentText,
  model,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Gemini API with timeout to avoid hanging connections
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const isGemma = model.toLowerCase().includes("gemma");
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: isGemma
              ? `${getProviderSystemPrompt(promptFn)}\n\n${promptFn(commentText)}`
              : promptFn(commentText),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  };

  // Only Gemini models support system_instruction parameter
  if (!isGemma) {
    payload.system_instruction = {
      parts: [{ text: getProviderSystemPrompt(promptFn) }],
    };
  }

  const response = await timeoutFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    AI_TRANSLATION_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    const error = new Error(
      `Gemini (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
    error.status = response.status;
    const retryAfter = response.headers?.get("Retry-After");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(delay) && delay > 0) error.retryAfterMs = delay;
    }
    throw error;
  }

  const data = await safeReadJson(response);
  const rawText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? "")
    .join("")
    .trim();

  assertCompleteTranslation(data?.candidates?.[0]?.finishReason);

  if (!rawText) {
    throw new Error(TB.MESSAGES.GEMINI.EMPTY_TRANSLATION);
  }

  const cleaned = extractCleanedTranslation(rawText);
  if (promptFn.includeOriginal) {
    return formatTranslation(commentText, cleaned, commentUrl, promptFn.targetLanguage);
  }
  return cleaned;
}

async function callCerebrasAPI(
  apiKey,
  commentText,
  model,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Cerebras API with timeout
  const response = await timeoutFetch(
    "https://api.cerebras.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: getProviderSystemPrompt(promptFn) },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    AI_TRANSLATION_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Cerebras (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  assertCompleteTranslation(data?.choices?.[0]?.finish_reason);
  if (!rawText) {
    throw new Error("AI returned no content.");
  }

  const cleaned = extractCleanedTranslation(rawText);
  if (promptFn.includeOriginal) {
    return formatTranslation(commentText, cleaned, commentUrl, promptFn.targetLanguage);
  }
  return cleaned;
}

async function callGroqAPI(
  apiKey,
  commentText,
  model,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Groq API with timeout
  const response = await timeoutFetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: getProviderSystemPrompt(promptFn) },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    AI_TRANSLATION_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Groq (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  assertCompleteTranslation(data?.choices?.[0]?.finish_reason);
  if (!rawText) {
    throw new Error("AI returned no content.");
  }

  const cleaned = extractCleanedTranslation(rawText);
  if (promptFn.includeOriginal) {
    return formatTranslation(commentText, cleaned, commentUrl, promptFn.targetLanguage);
  }
  return cleaned;
}

async function callOpenRouterAPI(
  apiKey,
  commentText,
  model,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  const response = await timeoutFetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: getProviderSystemPrompt(promptFn) },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    AI_TRANSLATION_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`OpenRouter (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  assertCompleteTranslation(data?.choices?.[0]?.finish_reason);
  if (!rawText) {
    throw new Error("AI returned no content.");
  }

  const cleaned = extractCleanedTranslation(rawText);
  if (promptFn.includeOriginal) {
    return formatTranslation(commentText, cleaned, commentUrl, promptFn.targetLanguage);
  }
  return cleaned;
}

function assertCompleteTranslation(finishReason) {
  if (finishReason === "MAX_TOKENS" || finishReason === "length") {
    throw new Error(
      "AI translation was cut off by the output limit. Split the text into smaller parts before retrying."
    );
  }
}

function extractCleanedTranslation(rawText) {
  const cleaned = normalizeTranslationOutput(rawText);
  if (!cleaned || isSafetyOnlyOutput(cleaned)) {
    throw new Error("AI returned only safety metadata.");
  }
  return cleaned;
}

function isPromptBoundaryMarkerLine(line) {
  const trimmed = String(line || "").trim();
  return (
    /^\[(?:BẮT ĐẦU|KẾT THÚC)(?:\s+NỘI DUNG)?\]$/iu.test(trimmed) ||
    /^\[TB_(?:START|END)\]$/i.test(trimmed)
  );
}

function stripPromptBoundaryMarkers(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => !isPromptBoundaryMarkerLine(line))
    .join("\n")
    .trim();
}

function normalizeTranslationOutput(rawText) {
  // Normalize output from AI: remove unnecessary markers and tags
  if (typeof stripSyncMarkers === "function") {
    rawText = stripSyncMarkers(rawText);
  }
  let cleaned = rawText.trim();
  const resultPatterns = [
    /<result>([\s\S]*?)<\/result>/i,
    /\[result\]([\s\S]*?)\[\/result\]/i,
    /^\s*result:([\s\S]*)/i,
  ];

  let foundContent = "";
  for (const pattern of resultPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      foundContent = match[1].trim();
      break;
    }
  }

  if (foundContent) {
    cleaned = foundContent;
  } else {
    cleaned = cleaned
      .replace(/^```[\w-]*\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();
    const noiseMarkers = [
      "COMPLY RULES:",
      "MANDATORY RULES:",
      "BẢN DỊCH:",
      "DIỄN GIẢI:",
      "BẮT ĐẦU NỘI DUNG",
      "KẾT THÚC NỘI DUNG",
      "TRANSLATION:",
      "TASK:",
      "[TB_START]",
      "[TB_END]",
    ];
    const lines = cleaned.split("\n");
    let firstValidLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      const isNoise =
        isPromptBoundaryMarkerLine(line) ||
        noiseMarkers.some((marker) => line.toUpperCase().includes(marker.toUpperCase()));
      if (isNoise || isSafetyMetadataLine(line) || /^\d+\.\s+[A-Z][A-Z\s]*$/.test(line)) {
        firstValidLineIndex = i + 1;
        continue;
      }
      break;
    }
    cleaned = lines.slice(firstValidLineIndex).join("\n").trim();
  }

  // --- Start Added Logic ---
  // Fix mangled markers that AI often generates instead of keeping standard [[TB_IMG:id]]
  cleaned = fixMangledMarkers(cleaned);
  // --- End Added Logic ---

  cleaned = cleaned
    .replace(/\[KẾT THÚC(?:\s+NỘI DUNG)?\]\s*$/giu, "")
    .replace(/\[BẮT ĐẦU(?:\s+NỘI DUNG)?\]\s*$/giu, "")
    .replace(/^\[BẮT ĐẦU(?:\s+NỘI DUNG)?\]\s*\r?\n?/giu, "")
    .replace(/\r?\n\[KẾT THÚC(?:\s+NỘI DUNG)?\]\s*$/giu, "")
    .replace(/\[TB_END\]\s*$/g, "")
    .replace(/\[TB_START\]\s*$/g, "")
    .replace(/\[\/?result\]/gi, "")
    .replace(/<\/?result>/gi, "")
    .trim();
  cleaned = stripPromptBoundaryMarkers(cleaned);
  if (typeof stripSyncMarkers === "function") {
    cleaned = stripSyncMarkers(cleaned);
  }
  if (!cleaned || cleaned.length < 2) {
    cleaned = rawText.trim();
  }

  // AI đôi khi HTML-escape <> (vd. <flow_guide_id> → &lt;...&gt;); decode trước khi gửi Redmine.
  if (typeof decodeHtmlEntitiesOutsideCode === "function") {
    cleaned = decodeHtmlEntitiesOutsideCode(cleaned);
  } else if (typeof decodeHtmlText === "function") {
    cleaned = decodeHtmlText(cleaned);
  }

  return cleaned;
}

function isSafetyMetadataLine(line) {
  return /^(user|content|response|assistant|model)?\s*safety\s*:\s*(safe|unsafe|blocked|allowed|disallowed)$/i.test(
    line
  );
}

function isSafetyOnlyOutput(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every(isSafetyMetadataLine);
}

/**
 * Fixes common mangled marker formats that AI hallucinations produce.
 * @param {string} text - The translated text to repair.
 * @returns {string} Repaired text.
 */
function fixMangledMarkers(text) {
  if (!text) return "";

  let result = text;

  // 1. Nested mangling: ![image]([[TB_IMG:12345]])
  result = result.replace(/!\[[^\]]*\]\(\[\[TB_IMG:\s*(\d+)\s*\]\]\)/gi, "[[TB_IMG:$1]]");

  // 2. Standard Markdown mangling: ![12345](image) OR ![image](12345)
  result = result.replace(/!\[(\d+)\]\(image\)/gi, "[[TB_IMG:$1]]");
  result = result.replace(/!\[image\]\((\d+)\)/gi, "[[TB_IMG:$1]]");

  // 3. Descriptive mangling: ![Backlog Image](12345)
  result = result.replace(/!\[[^\]]*\]\((\d+)\)/gi, "[[TB_IMG:$1]]");

  // 4. Extra space mangling: [[TB_IMG: 12345]]
  result = result.replace(/\[\[TB_IMG:\s*(\d+)\s*\]\]/gi, "[[TB_IMG:$1]]");

  // 5. Double bracket mangling: [[TB_IMG:[12345]]]
  result = result.replace(/\[\[TB_IMG:\[(\d+)\]\]\]/gi, "[[TB_IMG:$1]]");

  // 6. Inline link mangling: [image_12345.png]([[TB_IMG:12345]])
  result = result.replace(
    /\[[^\]]+\.(png|jpg|jpeg|gif)\]\(\[\[TB_IMG:\s*(\d+)\s*\]\]\)/gi,
    "[[TB_IMG:$2]]"
  );

  // 7. File marker spacing / nesting
  result = result.replace(/\[\[TB_FILE:\s*(\d+)\s*:\s*([^\]]+?)\s*\]\]/gi, "[[TB_FILE:$1:$2]]");
  result = result.replace(
    /\[[^\]]+\]\(\[\[TB_FILE:\s*(\d+)\s*:\s*([^\]]+?)\s*\]\]\)/gi,
    "[[TB_FILE:$1:$2]]"
  );

  return result;
}

function formatTranslation(originalText, cleanedText, commentUrl = null, targetLanguage = "vi") {
  // Format output: add comment URL (if exists) and translation
  const prefix = commentUrl ? `${commentUrl}\n\n` : "";
  const label = targetLanguage === "vi" ? "VN" : targetLanguage.toUpperCase();
  return `${prefix}${originalText.trim()}\n\n---\n\n{{collapse(${label})\n\n${cleanedText}\n}}`;
}

function sanitizeErrorMessage(message, status) {
  let displayMessage = String(message ?? "Unknown error");
  try {
    const errorJson = JSON.parse(message);
    displayMessage = errorJson.error?.message || errorJson.error || errorJson.message || message;
  } catch (e) {
    // Ignore parsing error if message is not JSON
  }
  if (typeof displayMessage !== "string") displayMessage = JSON.stringify(displayMessage);
  return `Error ${status}: ${displayMessage
    .replace(/https?:\/\/[^\s]+/g, "[URL]")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/((?:api.?key|access_token|token)["']?\s*[:=]\s*["']?)[^\s,}"']+/gi, "$1[REDACTED]")
    .slice(0, 200)}`;
}
