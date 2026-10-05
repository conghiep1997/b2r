/** Profiles edit the same policy controls while keeping global defaults separate. */
(function (global) {
  let profiles = [];
  let defaults = null;
  let selected = "global";
  let messages = {};
  document.addEventListener("options-localized", (event) => {
    messages = event.detail;
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const el = (id) => document.getElementById(id);
  const t = (key) => messages[key]?.message || chrome.i18n.getMessage(key) || key;
  function readPolicy() {
    const customFields = global.TB_OPTIONS_POLICY_EDITORS.readFields();
    return {
      syncRules: global.TB_OPTIONS_SYNC_RULES.read(),
      translationRules: global.TB_OPTIONS_SYNC_RULES.readTranslation(),
      logTimeRules: global.TB_OPTIONS_SYNC_RULES.readLogTime(),
      customFields,
      manualFields: JSON.stringify(
        Object.fromEntries(customFields.map((field) => [field.name, field.id]))
      ),
    };
  }
  function loadPolicy(policy) {
    global.TB_OPTIONS_SYNC_RULES.load(policy.syncRules);
    global.TB_OPTIONS_SYNC_RULES.loadTranslation(policy.translationRules);
    global.TB_OPTIONS_SYNC_RULES.loadLogTime(policy.logTimeRules);
    global.TB_OPTIONS_POLICY_EDITORS.loadFields(policy.customFields, policy.manualFields);
    el("manualFields").value = policy.manualFields || "{}";
  }
  function capture() {
    if (!defaults) return;
    if (selected === "global") defaults = readPolicy();
    else profiles[Number(selected)].overrides = el("profileInherit").checked ? {} : readPolicy();
  }
  function controls() {
    const inherited = selected !== "global" && el("profileInherit").checked;
    el("profileInheritRow").hidden = selected === "global";
    for (const id of [
      "translationSettings",
      "logTimeSettings",
      "trackerAliasesPanel",
      "dueDateRulesPanel",
      "customFieldsPanel",
    ]) {
      el(id)
        .querySelectorAll("input, select, textarea, button")
        .forEach((input) => {
          input.disabled = inherited;
        });
    }
    for (const id of [
      "syncSubjectTemplate",
      "syncTitleDelimiter",
      "syncSearchMode",
      "syncRestrictProject",
    ]) {
      el(id).disabled = inherited;
    }
    const restrictionLabel = document.querySelector("label[for='syncRestrictProject']");
    restrictionLabel.dataset.i18n =
      selected === "global" ? "options_restrict_project" : "options_restrict_profile_project";
    restrictionLabel.textContent = t(restrictionLabel.dataset.i18n);
    if (selected !== "global") el("syncRestrictProject").checked = true;
    el("syncRestrictProject").disabled = inherited || selected !== "global";
  }
  function showPolicy() {
    const profile = selected === "global" ? null : profiles[Number(selected)];
    el("profileInherit").checked = profile ? !Object.keys(profile.overrides).length : false;
    const policy = profile ? { ...defaults, ...profile.overrides } : defaults;
    if (
      profile?.overrides.manualFields !== undefined &&
      profile.overrides.customFields === undefined
    ) {
      policy.customFields = null;
    }
    loadPolicy(policy);
    controls();
  }
  function names() {
    const selector = el("policyProfile");
    selector.replaceChildren(new Option(t("options_profiles_global"), "global"));
    profiles.forEach((profile, index) =>
      selector.add(
        new Option(
          `${profile.name || profile.backlogProjectKey || "…"} → #${profile.redmineProjectId || "?"}`,
          String(index)
        )
      )
    );
    selector.value = selected;
  }
  function render() {
    const container = el("projectProfilesEditor");
    container.replaceChildren();
    profiles.forEach((profile, index) => {
      const section = document.createElement("section");
      section.className = "note profile-row";
      const scope = document.createElement("p");
      scope.textContent = `${profile.backlogOrigin} → ${profile.redmineOrigin}`;
      section.append(scope);
      for (const [field, key] of [
        ["name", "options_profiles_name"],
        ["backlogProjectKey", "options_profiles_source"],
        ["redmineProjectId", "options_profiles_destination"],
        ["reportProjectId", "options_profiles_report_project"],
      ]) {
        const label = document.createElement("label");
        const span = document.createElement("span");
        span.dataset.i18n = key;
        span.textContent = t(key);
        const input = document.createElement("input");
        input.dataset.field = field;
        input.value = profile[field] || "";
        input.maxLength = 150;
        if (field === "redmineProjectId" || field === "reportProjectId") {
          input.inputMode = "numeric";
          input.setAttribute("list", "profileProjects");
        }
        input.oninput = () => {
          profile[field] = input.value.trim();
          names();
        };
        label.append(span, input);
        section.append(label);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.i18n = "options_mapping_remove";
      remove.textContent = t("options_mapping_remove");
      remove.onclick = () => {
        if (selected !== String(index)) capture();
        profiles.splice(index, 1);
        if (selected !== "global") {
          selected =
            Number(selected) === index
              ? "global"
              : String(Number(selected) > index ? Number(selected) - 1 : Number(selected));
        }
        render();
        showPolicy();
      };
      section.append(remove);
      container.append(section);
    });
    names();
  }
  function load(value, policy) {
    profiles = global.TB_PROJECT_PROFILES.normalize(value);
    defaults = clone(policy);
    selected = "global";
    render();
    showPolicy();
  }
  function readGlobal() {
    capture();
    const policy = defaults || readPolicy();
    if (policy.syncRules.restrictToProject && !el("defaultProjectId").value) {
      throw new Error(t("options_configuration_project_required"));
    }
    if (policy.logTimeRules.activityMode === "default" && !policy.logTimeRules.defaultActivityId) {
      throw new Error(t("options_configuration_activity_required"));
    }
    return clone(defaults || readPolicy());
  }
  function readProfiles() {
    capture();
    for (const profile of profiles) {
      const rules = profile.overrides.logTimeRules || defaults.logTimeRules;
      if (rules.activityMode === "default" && !rules.defaultActivityId) {
        throw new Error(t("options_configuration_activity_required"));
      }
    }
    return global.TB_PROJECT_PROFILES.normalize(profiles, {
      backlogDomain: el("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      redmineDomain: el("redmineDomain").value.trim() || TB.REDMINE_DOMAIN,
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    async function localize() {
      const { languagePreference = "en" } = await chrome.storage.local.get("languagePreference");
      messages = await (
        await fetch(
          chrome.runtime.getURL(
            `_locales/${languagePreference === "vi" ? "vi" : "en"}/messages.json`
          )
        )
      ).json();
      el("projectProfilesSettings")
        .querySelectorAll("[data-i18n]")
        .forEach((element) => {
          element.textContent = t(element.dataset.i18n);
        });
      names();
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.languagePreference) void localize();
    });
    void localize();
    el("policyProfile").onchange = (event) => {
      try {
        capture();
        selected = event.target.value;
        showPolicy();
        el("configurationStatus").textContent = "";
      } catch (error) {
        event.target.value = selected;
        el("configurationStatus").textContent = error.message;
      }
    };
    el("profileInherit").onchange = () => {
      const profile = profiles[Number(selected)];
      if (el("profileInherit").checked) {
        profile.overrides = {};
        loadPolicy(defaults);
      }
      controls();
    };
    el("addProjectProfile").onclick = () => {
      try {
        capture();
        profiles.push({
          name: "",
          backlogProjectKey: "",
          redmineProjectId: "",
          backlogOrigin: new URL(el("backlogDomain").value || TB.BACKLOG_DOMAIN).origin,
          redmineOrigin: new URL(el("redmineDomain").value || TB.REDMINE_DOMAIN).origin,
          overrides: {},
        });
        render();
      } catch (error) {
        el("configurationStatus").textContent = error.message;
      }
    };
    el("validateConfiguration").onclick = () => {
      try {
        readGlobal();
        readProfiles();
        el("configurationStatus").textContent = t("options_configuration_valid");
      } catch (error) {
        el("configurationStatus").textContent = error.message;
      }
    };
    el("profileProjects").replaceChildren();
    el("projectProfilesEditor").addEventListener("focusin", () => {
      el("profileProjects").replaceChildren(
        ...Array.from(el("defaultProjectId").options)
          .filter((option) => option.value)
          .map((option) => new Option(option.textContent, option.value))
      );
    });
  });
  global.TB_OPTIONS_PROJECT_PROFILES = Object.freeze({ load, readGlobal, readProfiles });
})(globalThis);
