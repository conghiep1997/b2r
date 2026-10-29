/**
 * Translation Cache for Backlog2Redmine.
 * Stores recent translations in memory with persistence in chrome.storage.local.
 * Provides instant 0ms responses for repeated comments and saves AI quota.
 */
(function (global) {
  const MAX_CACHE_ENTRIES = 100;
  const CACHE_STORAGE_KEY = "tb_translation_cache";
  const memoryCache = new Map();
  let storageLoaded = false;

  function makeKey(text, sourceLang = "ja", targetLang = "vi", projectKey = "", reverse = false) {
    const cleanText = String(text || "").trim();
    return `${sourceLang}->${targetLang}|rev:${Boolean(reverse)}|proj:${projectKey || ""}|${cleanText}`;
  }

  async function loadStorage() {
    if (storageLoaded) return;
    try {
      if (global.chrome?.storage?.local) {
        const stored = await global.chrome.storage.local.get(CACHE_STORAGE_KEY);
        const entries = stored[CACHE_STORAGE_KEY];
        if (Array.isArray(entries)) {
          entries.forEach(([k, v]) => {
            if (k && typeof v === "string") memoryCache.set(k, v);
          });
        }
      }
    } catch (_e) {
      // Ignore storage errors in test or sandbox environments
    } finally {
      storageLoaded = true;
    }
  }

  async function get(text, sourceLang, targetLang, projectKey, reverse) {
    await loadStorage();
    const key = makeKey(text, sourceLang, targetLang, projectKey, reverse);
    const value = memoryCache.get(key);
    if (value) {
      // Refresh recency for LRU
      memoryCache.delete(key);
      memoryCache.set(key, value);
      return value;
    }
    return null;
  }

  async function set(text, sourceLang, targetLang, projectKey, reverse, translatedText) {
    if (!text || !translatedText) return;
    await loadStorage();
    const key = makeKey(text, sourceLang, targetLang, projectKey, reverse);
    if (memoryCache.has(key)) {
      memoryCache.delete(key);
    } else if (memoryCache.size >= MAX_CACHE_ENTRIES) {
      // Evict oldest entry
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, translatedText);
    persist();
  }

  async function clear() {
    memoryCache.clear();
    try {
      if (global.chrome?.storage?.local) {
        await global.chrome.storage.local.remove(CACHE_STORAGE_KEY);
      }
    } catch (_e) {
      // Storage access error in sandbox or disabled environments
    }
  }

  function size() {
    return memoryCache.size;
  }

  let persistTimer = null;
  function persist() {
    if (!global.chrome?.storage?.local) return;
    const clearTimer = global.clearTimeout || clearTimeout;
    const setTimer = global.setTimeout || setTimeout;
    if (typeof clearTimer === "function") clearTimer(persistTimer);
    if (typeof setTimer === "function") {
      persistTimer = setTimer(async () => {
        try {
          const entries = Array.from(memoryCache.entries()).slice(-MAX_CACHE_ENTRIES);
          await global.chrome.storage.local.set({ [CACHE_STORAGE_KEY]: entries });
        } catch (_e) {
          // Persistence failure ignored
        }
      }, 500);
    }
  }

  global.TB_TRANSLATION_CACHE = Object.freeze({
    makeKey,
    get,
    set,
    clear,
    size,
    MAX_CACHE_ENTRIES,
  });
})(globalThis);
