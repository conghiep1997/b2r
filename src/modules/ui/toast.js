/**
 * Toast management for Backlog2Redmine Extension.
 */

// Local state for toast element (avoid conflict with modal.js global)
let toastElement = null;

function showToast(message, type = "info") {
  ensureToastShell();
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  toastElement.textContent =
    characters.length > 220 ? `${characters.slice(0, 217).join("")}…` : text;
  toastElement.dataset.type = type;
  toastElement.hidden = false;
  requestAnimationFrame(() => toastElement.classList.add("tb-toast--visible"));

  window.clearTimeout(toastElement._tbTimer);
  toastElement._tbTimer = window.setTimeout(() => {
    toastElement.classList.remove("tb-toast--visible");
    window.setTimeout(() => {
      toastElement.hidden = true;
    }, 200);
  }, 3000);
}

function ensureToastShell() {
  if (toastElement) {
    return;
  }

  toastElement = document.createElement("div");
  toastElement.className = "tb-toast";
  toastElement.hidden = true;
  document.body.appendChild(toastElement);
}
