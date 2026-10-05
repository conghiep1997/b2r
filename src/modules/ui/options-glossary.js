/** Project glossary editor; encrypted persistence is owned by the worker. */
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("projectGlossary");
  if (!panel) return;
  const project = document.getElementById("glossaryProjectKey");
  const terms = document.getElementById("glossaryTerms");
  const status = document.getElementById("glossaryStatus");
  let messages = {};
  document.addEventListener("options-localized", (event) => {
    messages = event.detail;
  });
  const t = (key) => messages[key]?.message || key;
  let loadedProject = "";
  let dirty = false;
  let loadedCount = 0;
  let busy = false;

  function controls() {
    project.disabled = busy;
    document.getElementById("loadProjectGlossary").disabled = busy;
    for (const id of ["saveProjectGlossary", "addGlossaryTerm"]) {
      document.getElementById(id).disabled =
        busy || loadedProject !== project.value.trim() || !loadedProject;
    }
    terms.querySelectorAll("input, button").forEach((element) => {
      element.disabled =
        busy ||
        (element.classList.contains("glossary-target") &&
          element.closest("section").querySelector(".glossary-keep").checked);
    });
  }

  function add(entry = { source: "", target: "", keep: false }) {
    const row = document.createElement("section");
    row.className = "note glossary-term";
    for (const field of ["source", "target"]) {
      const label = document.createElement("label");
      const caption = document.createElement("span");
      caption.dataset.i18n = `glossary_${field}`;
      caption.textContent = t(caption.dataset.i18n);
      const input = document.createElement("input");
      input.className = `glossary-${field}`;
      input.maxLength = 300;
      input.value = entry[field];
      label.append(caption, input);
      row.append(label);
    }
    const label = document.createElement("label");
    const keep = document.createElement("input");
    keep.type = "checkbox";
    keep.className = "glossary-keep";
    keep.checked = entry.keep;
    const caption = document.createElement("span");
    caption.dataset.i18n = "glossary_keep";
    caption.textContent = t("glossary_keep");
    label.append(keep, caption);
    const target = row.querySelector(".glossary-target");
    target.disabled = keep.checked;
    keep.addEventListener("change", () => {
      target.disabled = keep.checked;
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.dataset.i18n = "glossary_remove";
    remove.textContent = t("glossary_remove");
    remove.addEventListener("click", () => {
      row.remove();
      dirty = true;
    });
    row.append(label, remove);
    terms.append(row);
    row.addEventListener("input", () => {
      dirty = true;
    });
  }

  async function request(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || t("glossary_error"));
    return result.data;
  }
  function action(id, operation) {
    const button = document.getElementById(id);
    button.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      controls();
      button.disabled = true;
      const previousStatus = status.textContent;
      status.textContent = t("glossary_working");
      try {
        if ((await operation()) === false) status.textContent = previousStatus;
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
        controls();
      }
    });
  }
  action("loadProjectGlossary", async () => {
    if (dirty && !window.confirm(t("glossary_discard_confirm"))) return false;
    const projectKey = project.value.trim();
    const entries = await request({ type: "GET_PROJECT_GLOSSARY", projectKey });
    if (project.value.trim() !== projectKey) return;
    terms.replaceChildren();
    entries.forEach(add);
    loadedProject = projectKey;
    loadedCount = entries.length;
    dirty = false;
    status.textContent = t("glossary_loaded");
  });
  document.getElementById("addGlossaryTerm").addEventListener("click", () => {
    add();
    dirty = true;
  });
  action("saveProjectGlossary", async () => {
    if (!loadedProject || loadedProject !== project.value.trim()) {
      throw new Error(t("glossary_load_required"));
    }
    if (loadedCount > 0 && !terms.children.length && !window.confirm(t("glossary_clear_confirm"))) {
      return false;
    }
    const entries = Array.from(terms.children, (row) => ({
      source: row.querySelector(".glossary-source").value,
      target: row.querySelector(".glossary-target").value,
      keep: row.querySelector(".glossary-keep").checked,
    }));
    const projectKey = project.value.trim();
    await request({ type: "SAVE_PROJECT_GLOSSARY", projectKey, entries });
    dirty = false;
    loadedCount = entries.length;
    if (project.value.trim() === projectKey) status.textContent = t("glossary_saved");
  });
  project.addEventListener("input", () => {
    if (dirty && !window.confirm(t("glossary_discard_confirm"))) {
      project.value = loadedProject;
      return;
    }
    loadedProject = "";
    dirty = false;
    terms.replaceChildren();
    status.textContent = "";
    controls();
  });
  async function localize(selectedLanguage) {
    const { languagePreference = "en" } = await chrome.storage.local.get("languagePreference");
    const language = selectedLanguage || languagePreference;
    messages = await (
      await fetch(
        chrome.runtime.getURL(`_locales/${language === "en" ? "en" : "vi"}/messages.json`)
      )
    ).json();
    panel.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.languagePreference) {
      void localize(changes.languagePreference.newValue);
    }
  });
  document
    .getElementById("languagePreference")
    .addEventListener("change", (event) => void localize(event.target.value));
  void localize();
  controls();
});
