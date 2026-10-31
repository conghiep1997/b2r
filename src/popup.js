const DONATION_METHODS = [
  {
    id: "bank",
    labelKey: "popup_donate_bank",
    titleKey: "popup_donate_bank_title",
    descriptionKey: "popup_donate_bank_description",
    qrImage: "../assets/donate/tpbank.png",
  },
  {
    id: "momo",
    labelKey: "popup_donate_momo",
    titleKey: "popup_donate_momo_title",
    descriptionKey: "popup_donate_momo_description",
    qrImage: "../assets/donate/momo.png",
  },
  {
    id: "paypal",
    labelKey: "popup_donate_paypal",
    titleKey: "popup_donate_paypal_title",
    descriptionKey: "popup_donate_paypal_description",
    url: "",
  },
].filter((method) => Boolean(method.qrImage || method.url));

const PROVIDER_LABELS = {
  gemini: "Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
};

let messages = null;
let storedSettings = {};
const t = (key, substitutions) =>
  messages?.[key]?.message || chrome.i18n.getMessage(key, substitutions) || key;

async function loadMessages() {
  const { languagePreference } = storedSettings;
  const language = languagePreference || "en";
  try {
    const response = await fetch(`../_locales/${language}/messages.json`);
    if (response.ok) messages = await response.json();
  } catch (_error) {
    // Fall back to Chrome's built-in locale lookup.
  }
}

async function applyTheme() {
  const { themePreference } = storedSettings;
  const theme = themePreference || "system";
  const resolved =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

function localizePopup() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  });
  document.documentElement.lang = storedSettings.languagePreference || "en";
}

document.addEventListener("DOMContentLoaded", async () => {
  const manifest = chrome.runtime.getManifest();
  storedSettings = await chrome.storage.local.get(["languagePreference", "themePreference"]);
  await loadMessages();
  await applyTheme();
  localizePopup();
  document.getElementById("version").textContent = `v${manifest.version}`;
  await renderStatus();
  setupActions();
  setupDonate();
});

async function renderStatus() {
  const items = await chrome.storage.local.get([
    "redmineApiKey",
    "redmineConnectionVerified",
    "defaultProjectId",
    "defaultProjectName",
    "backlogApiKey",
    "backlogConnectionVerified",
    "primaryProvider",
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

  const redmineConfigured = Boolean(items.redmineApiKey);
  const redmineProjectConfigured = Boolean(items.defaultProjectId);
  const redmineVerified = Boolean(redmineConfigured && redmineProjectConfigured && items.redmineConnectionVerified);

  const backlogConfigured = Boolean(items.backlogApiKey);
  const backlogVerified = Boolean(backlogConfigured && items.backlogConnectionVerified);

  const activeProvider = items.primaryProvider || "gemini";
  const providerKeyReadyMap = {
    gemini: Boolean(items.geminiApiKeys || items.geminiApiKey),
    groq: Boolean(items.groqApiKeys || items.groqApiKey),
    cerebras: Boolean(items.cerebrasApiKeys || items.cerebrasApiKey),
    openrouter: Boolean(items.openrouterApiKeys || items.openrouterApiKey),
  };
  const aiConfigured = Boolean(items.primaryProvider && providerKeyReadyMap[activeProvider]);
  const aiVerified = Boolean(aiConfigured && items.aiConnectionVerified);

  const providerLabel = PROVIDER_LABELS[activeProvider] || activeProvider;
  const pendingLabel = t("options_onboarding_status_pending") || "Chưa kiểm tra";

  // Forward Flow: Backlog -> Redmine (Needs Redmine + Project + AI)
  let forwardState = "ok";
  let forwardText = t("popup_active");
  if (!redmineConfigured) {
    forwardState = "missing";
    forwardText = t("popup_missing_redmine_key");
  } else if (!redmineProjectConfigured) {
    forwardState = "warning";
    forwardText = t("popup_not_selected");
  } else if (!aiConfigured) {
    forwardState = "missing";
    forwardText = t("popup_missing_ai_provider");
  } else if (!redmineVerified || !aiVerified) {
    forwardState = "warning";
    forwardText = pendingLabel;
  }
  setState("forwardStatus", forwardState, forwardText);

  // Reverse Flow: Redmine -> Backlog (Needs Backlog + AI)
  let reverseState = "ok";
  let reverseText = t("popup_active");
  if (!backlogConfigured) {
    reverseState = "missing";
    reverseText = t("popup_missing_backlog_key");
  } else if (!aiConfigured) {
    reverseState = "missing";
    reverseText = t("popup_missing_ai_provider");
  } else if (!backlogVerified || !aiVerified) {
    reverseState = "warning";
    reverseText = pendingLabel;
  }
  setState("reverseStatus", reverseState, reverseText);

  // AI Provider Status
  let providerState = "ok";
  let providerText = providerLabel;
  if (!aiConfigured) {
    providerState = "missing";
    providerText = t("popup_not_selected");
  } else if (!aiVerified) {
    providerState = "warning";
    providerText = `${providerLabel} (${pendingLabel})`;
  }
  setState("providerStatus", providerState, providerText);

  // Overall Status Badge & Description
  const allVerified = redmineVerified && backlogVerified && aiVerified;
  const anyMissing = !redmineConfigured || !backlogConfigured || !aiConfigured || !redmineProjectConfigured;
  const anyUnverified = (redmineConfigured && !redmineVerified) || (backlogConfigured && !backlogVerified) || (aiConfigured && !aiVerified);

  const badgeElement = document.getElementById("statusBadge");
  badgeElement.classList.remove("ready", "warning", "error");

  if (allVerified) {
    badgeElement.textContent = t("popup_ready");
    badgeElement.classList.add("ready");
    document.getElementById("overallStatus").textContent = t("popup_configured");
  } else if (anyMissing) {
    badgeElement.textContent = t("popup_needs_setup");
    badgeElement.classList.add("error");
    const missingSetup = [];
    if (!redmineConfigured && !backlogConfigured) missingSetup.push(t("popup_missing_both_keys"));
    else if (!redmineConfigured) missingSetup.push(t("popup_missing_redmine_key"));
    else if (!backlogConfigured) missingSetup.push(t("popup_missing_backlog_key"));
    if (!redmineProjectConfigured) missingSetup.push(t("popup_default_project"));
    if (!aiConfigured) missingSetup.push(t("popup_missing_ai_provider"));
    document.getElementById("overallStatus").textContent = missingSetup.join(" · ");
  } else if (anyUnverified) {
    badgeElement.textContent = pendingLabel.toUpperCase();
    badgeElement.classList.add("warning");
    document.getElementById("overallStatus").textContent = t("popup_setup_required");
  } else {
    badgeElement.textContent = t("popup_ready");
    badgeElement.classList.add("ready");
    document.getElementById("overallStatus").textContent = t("popup_configured");
  }

  document.getElementById("defaultProjectValue").textContent =
    items.defaultProjectName || items.defaultProjectId || t("popup_not_selected");
  if (!items.defaultProjectName && items.defaultProjectId) {
    document.getElementById("defaultProjectValue").textContent = t("popup_loading_project");
  }
  if (items.defaultProjectId && !items.defaultProjectName) loadDefaultProjectName();
  const summaryEl = document.getElementById("projectSummary");
  if (summaryEl) {summaryEl.textContent = items.defaultProjectName
    ? t("popup_project_summary")
    : t("popup_project_summary_empty");}
}

async function loadDefaultProjectName() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_PROJECT_SUMMARY" });
    if (response?.ok && response.data?.name) {
      document.getElementById("defaultProjectValue").textContent = response.data.name;
      await chrome.storage.local.set({ defaultProjectName: response.data.name });
    } else if (!response?.ok) {
      document.getElementById("defaultProjectValue").textContent = t("popup_project_load_failed");
    }
  } catch (_error) {
    document.getElementById("defaultProjectValue").textContent = t("popup_project_load_failed");
  }
}

function formatDomain(value) {
  if (!value) return t("popup_not_configured");
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function setState(id, statusType, text) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.toggle("ok", statusType === "ok" || statusType === true);
  element.classList.toggle("warning", statusType === "warning");
  element.classList.toggle("missing", statusType === "missing" || statusType === false);
}

function setupActions() {
  document
    .getElementById("openSettings")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("openRedmine").addEventListener("click", async () => {
    const { redmineDomain } = await chrome.storage.local.get("redmineDomain");
    openTab(redmineDomain || "https://redmine.splus-software.com");
  });
  document.getElementById("openMonthlyLog").addEventListener("click", async () => {
    const settings = await chrome.storage.local.get([
      "redmineDomain",
      "defaultProjectId",
      "reportProjectId",
    ]);
    if (!settings.defaultProjectId && !settings.reportProjectId) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html#defaultProjectId") });
      return;
    }
    const baseDomain = settings.redmineDomain || "https://redmine.splus-software.com";
    try {
      const targetUrl = new URL(baseDomain);
      targetUrl.hash = "b2r-monthly-log";
      openTab(targetUrl.href);
    } catch {
      openTab(baseDomain);
    }
  });
  document.getElementById("openBacklog").addEventListener("click", async () => {
    const { backlogDomain } = await chrome.storage.local.get("backlogDomain");
    const domain = backlogDomain || "https://backlog.com";
    openTab(domain.includes("://") ? domain : `https://${domain}`);
  });
}

function openTab(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    chrome.tabs.create({ url: parsed.href });
  } catch {
    // Ignore malformed or unsupported URLs from stored settings.
  }
}

function setupDonate() {
  const modal = document.getElementById("donateModal");
  const tabs = document.getElementById("donateTabs");
  const closeButton = document.getElementById("closeDonate");
  const content = document.getElementById("donateContent");
  let previousFocus;
  content.setAttribute("role", "tabpanel");
  DONATION_METHODS.forEach((method, index) => {
    const tab = document.createElement("button");
    tab.className = "donate-tab";
    tab.type = "button";
    tab.id = `donate-tab-${method.id}`;
    tab.dataset.methodId = method.id;
    tab.textContent = t(method.labelKey);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "donateContent");
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener("click", () => selectDonation(method.id));
    tabs.appendChild(tab);
  });
  document.getElementById("donateButton").addEventListener("click", () => {
    previousFocus = document.activeElement;
    modal.hidden = false;
    selectDonation(DONATION_METHODS[0].id);
    closeButton.focus();
  });
  const closeModal = () => {
    modal.hidden = true;
    previousFocus?.focus();
  };
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    } else if (
      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) &&
      event.target.closest("[role=tab]")
    ) {
      event.preventDefault();
      const currentIndex = DONATION_METHODS.findIndex(
        (method) => method.id === event.target.dataset.methodId
      );
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? DONATION_METHODS.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + DONATION_METHODS.length) %
              DONATION_METHODS.length;
      const nextTab = tabs.children[nextIndex];
      selectDonation(nextTab.dataset.methodId);
      nextTab.focus();
    } else if (event.key === "Tab") {
      const focusable = [...modal.querySelectorAll("button, a[href]")].filter(
        (element) => element.tabIndex >= 0
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

function selectDonation(id) {
  const method = DONATION_METHODS.find((item) => item.id === id);
  if (!method) return;
  document.querySelectorAll(".donate-tab").forEach((tab) => {
    const active = tab.dataset.methodId === id;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const content = document.getElementById("donateContent");
  content.setAttribute("aria-labelledby", `donate-tab-${id}`);
  content.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = t(method.titleKey);
  content.appendChild(title);
  const description = document.createElement("p");
  description.textContent = t(method.descriptionKey);
  content.appendChild(description);
  if (method.qrImage) {
    const image = document.createElement("img");
    image.className = "qr-image";
    image.src = method.qrImage;
    image.alt = `${t(method.labelKey)} QR`;
    content.appendChild(image);
  } else if (method.url) {
    const link = document.createElement("a");
    link.className = "donate-link";
    link.href = method.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = t("popup_open_paypal");
    content.appendChild(link);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "qr-placeholder";
    placeholder.textContent = t("popup_qr_pending");
    content.appendChild(placeholder);
  }
}
