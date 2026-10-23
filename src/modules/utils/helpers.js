/**
 * Shared helper functions for Backlog2Redmine Extension.
 */

/**
 * Debounce function to limit execution rate.
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Throttle function to limit execution rate.
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Normalizes a string by removing whitespace and converting to lowercase.
 * Used for loose matching of issue keys and summaries.
 */
function normalizeLoose(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Decodes HTML entities in a string.
 */
function decodeHtmlText(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

/**
 * Decode &lt;/&gt;/&amp; outside fenced/inline code so AI or copy-paste
 * HTML escaping does not become visible entities on Redmine (double-escape).
 */
function decodeHtmlEntitiesOutsideCode(value) {
  const protections = [];
  const protect = (chunk) => {
    const token = `§§TBENT${protections.length}§§`;
    protections.push(chunk);
    return token;
  };

  let text = String(value ?? "");
  text = text.replace(/```[\s\S]*?```/g, (m) => protect(m));
  text = text.replace(/`[^`\n]+`/g, (m) => protect(m));
  text = decodeHtmlText(text);

  for (let i = protections.length - 1; i >= 0; i--) {
    text = text.split(`§§TBENT${i}§§`).join(protections[i]);
  }
  return text;
}

/**
 * Strips HTML tags from a string.
 */
function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ");
}

/**
 * Builds a Redmine URL from a base URL and path.
 */
function buildRedmineUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const base = new URL(normalizedBase);
  const url = new URL(path.replace(/^\//, ""), base);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    url.origin !== base.origin ||
    url.username ||
    url.password
  ) {
    throw new Error("Redmine URL must use the configured origin.");
  }
  return url.toString();
}

/**
 * Normalizes a Backlog domain or URL to an origin (https://host).
 * Accepts hostname (`space.backlog.com`) or full URL (`https://space.backlog.com/`).
 */
function normalizeBacklogOrigin(domainOrUrl) {
  const raw = String(domainOrUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch (_error) {
    return "";
  }
}

function getTrustedBacklogApiOrigin(domain) {
  const raw = String(domain || "").trim();
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.backlog\.(?:com|jp)$/i.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Enter a secure Backlog workspace URL (https://*.backlog.com or .jp).");
  }
  return url.origin;
}

async function recordSyncActivity(entry) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "RECORD_SYNC_ACTIVITY",
      entry,
    });
    return response?.ok === true;
  } catch (error) {
    console.warn("[TB-Sync] Could not save activity:", error);
    return false;
  }
}

/**
 * Builds Redmine upload endpoint with required filename query param.
 * Without filename, Redmine may reject the upload when extension filters are enabled.
 */
function buildRedmineUploadUrl(baseUrl, filename) {
  const url = new URL(buildRedmineUrl(baseUrl, "/uploads.json"));
  if (filename) {
    url.searchParams.set("filename", filename);
  }
  return url.toString();
}

/**
 * Safely parses the JSON response body.
 * Returns null if the response is empty or if parsing fails.
 */
async function safeReadJson(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("[TB-Helper] JSON_PARSE_FAILED", {
      status: response.status,
      statusText: response.statusText,
      error: error.message,
    });
    return null;
  }
}

/**
 * Reads the error message from a response.
 */
async function readErrorMessage(response) {
  try {
    const text = await response.text();
    return text ? text.slice(0, 500) : response.statusText;
  } catch (error) {
    return response.statusText;
  }
}

/**
 * Low-level message sender for chrome.runtime.
 */
function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();
    if (!runtime?.sendMessage) {
      const unavailable =
        typeof TB !== "undefined" && TB.MESSAGES?.SETTINGS?.RUNTIME_UNAVAILABLE
          ? TB.MESSAGES.SETTINGS.RUNTIME_UNAVAILABLE
          : "Runtime extension không khả dụng. Vui lòng tải lại trang.";
      reject(new Error(unavailable));
      return;
    }

    runtime.sendMessage(payload, (response) => {
      const lastError = runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Lỗi không xác định từ background."));
        return;
      }
      resolve(response);
    });
  });
}

function getChromeRuntime() {
  if (typeof chrome === "undefined") {
    return null;
  }
  return chrome.runtime || null;
}

/**
 * Fetch with timeout support.
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>} Fetch response
 */
async function timeoutFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  const externalSignal = options.signal;

  async function bounded(operation) {
    let timeoutId;
    let externalAbort;
    const failure = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => {
          controller.abort();
          reject(new Error(`Request timeout after ${timeoutMs}ms.`));
        },
        Math.max(0, deadline - Date.now())
      );
      externalAbort = () => {
        controller.abort();
        const error = new Error("Request cancelled.");
        error.name = "AbortError";
        reject(error);
      };
      if (externalSignal?.aborted) externalAbort();
      else externalSignal?.addEventListener("abort", externalAbort, { once: true });
    });
    try {
      if (externalSignal?.aborted) return await failure;
      if (Date.now() >= deadline) {
        controller.abort();
        throw new Error(`Request timeout after ${timeoutMs}ms.`);
      }
      return await Promise.race([operation(), failure]);
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted && Date.now() >= deadline) {
        throw new Error(`Request timeout after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", externalAbort);
    }
  }

  const response = await bounded(() => fetch(url, { ...options, signal: controller.signal }));
  const readers = new Set(["text", "json", "blob", "arrayBuffer", "formData", "bytes"]);
  return new Proxy(response, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (readers.has(property) && typeof value === "function") {
        return (...args) => bounded(() => value.apply(target, args));
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
