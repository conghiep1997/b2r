/**
 * Toast management for Backlog2Redmine Extension.
 */

// Local state for toast element (avoid conflict with modal.js global)
let toastElement = null;

function hideToast() {
  if (!toastElement) return;
  window.clearTimeout(toastElement._tbTimer);
  toastElement.classList.remove("tb-toast--visible");
  window.setTimeout(() => {
    if (toastElement) toastElement.hidden = true;
  }, 200);
}

function scheduleToastHide(durationMs) {
  if (!toastElement) return;
  window.clearTimeout(toastElement._tbTimer);
  toastElement._tbDuration = durationMs;
  toastElement._tbTimer = window.setTimeout(hideToast, durationMs);
}

function showToast(message, type = "info") {
  ensureToastShell();
  const text = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  toastElement.textContent =
    characters.length > 220 ? `${characters.slice(0, 217).join("")}…` : text;
  toastElement.dataset.type = type;
  toastElement.hidden = false;
  requestAnimationFrame(() => toastElement.classList.add("tb-toast--visible"));

  const duration = type === "error" ? 5000 : 3000;
  scheduleToastHide(duration);
}

function ensureToastShell() {
  if (toastElement) {
    return;
  }

  toastElement = document.createElement("div");
  toastElement.className = "tb-toast";
  toastElement.setAttribute("role", "status");
  toastElement.setAttribute("aria-live", "polite");
  toastElement.hidden = true;
  toastElement.addEventListener("mouseenter", () => {
    window.clearTimeout(toastElement._tbTimer);
  });
  toastElement.addEventListener("mouseleave", () => {
    scheduleToastHide(toastElement._tbDuration || 3000);
  });
  toastElement.addEventListener("click", hideToast);
  document.body.appendChild(toastElement);
}
