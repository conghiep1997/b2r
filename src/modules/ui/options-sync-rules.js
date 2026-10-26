/* global TB_SYNC_RULES */
/** Advanced controls use the existing Options save button. */
let optionsRuleMessages = {};
const ruleMessage = (key) =>
  optionsRuleMessages[key]?.message || chrome.i18n.getMessage(key) || key;
globalThis.TB_OPTIONS_SYNC_RULES = Object.freeze({
  localize() {
    for (const field of ["source", "target", "reverseSource", "reverseTarget"]) {
      document
        .getElementById(`translation_${field}`)
        .querySelectorAll("option")
        .forEach((option) => {
          option.textContent = ruleMessage(`options_content_language_${option.value}`);
        });
    }
    for (const field of ["defaultActivityId", "testingActivityId"]) {
      const empty = document.getElementById(`logTime_${field}`).querySelector("option[value='']");
      if (empty) empty.textContent = ruleMessage("options_activity_unselected");
    }
  },
  updateVisibility() {
    const mode = document.getElementById("translation_reverseMode").value;
    const inherited =
      document.getElementById("policyProfile").value !== "global" &&
      document.getElementById("profileInherit").checked;
    const reverseSource = document.getElementById("translation_reverseSource");
    const reverseTarget = document.getElementById("translation_reverseTarget");
    reverseSource.closest(".field").hidden = mode !== "translate";
    reverseSource.disabled = inherited || mode !== "translate";
    reverseTarget.closest(".field").hidden = mode === "original";
    reverseTarget.disabled = inherited || mode === "original";
    document.getElementById("logTime_testingActivityId").closest(".field").hidden =
      document.getElementById("logTime_activityMode").value !== "legacy";
  },
  loadLogTime(value) {
    const rules = globalThis.TB_LOG_TIME_RULES.normalize(value);
    for (const [field, setting] of Object.entries(rules)) {
      const input = document.getElementById(`logTime_${field}`);
      if (field.endsWith("ActivityId")) {
        input.replaceChildren(new Option(ruleMessage("options_activity_unselected"), ""));
        if (setting) input.add(new Option(`#${setting}`, setting));
      }
      input.value = String(setting);
    }
    this.updateVisibility();
  },
  readLogTime() {
    return globalThis.TB_LOG_TIME_RULES.normalize({
      dailyHours: Number(document.getElementById("logTime_dailyHours").value),
      allocation: document.getElementById("logTime_allocation").value,
      activityMode: document.getElementById("logTime_activityMode").value,
      defaultActivityId: document.getElementById("logTime_defaultActivityId").value,
      testingActivityId: document.getElementById("logTime_testingActivityId").value,
    });
  },
  loadTranslation(value) {
    const rules = TB.PROMPTS.TRANSLATION.normalize(value);
    for (const field of ["source", "target", "reverseSource", "reverseTarget"]) {
      const select = document.getElementById(`translation_${field}`);
      select.replaceChildren();
      for (const code of Object.keys(TB.PROMPTS.TRANSLATION.languages)) {
        if (
          (code === "auto" && field.endsWith("Target")) ||
          (code === "auto" && field === "target")
        ) {
          continue;
        }
        const option = document.createElement("option");
        option.value = code;
        option.textContent = ruleMessage(`options_content_language_${code}`);
        select.append(option);
      }
      select.value = rules[field];
    }
    document.getElementById("translation_reverseMode").value = rules.reverseMode;
    this.updateVisibility();
  },
  readTranslation() {
    const defaults = TB.PROMPTS.TRANSLATION.defaults;
    const supported = TB.PROMPTS.TRANSLATION.languages;
    const values = Object.fromEntries(
      Object.keys(defaults).map((field) => {
        const control = document.getElementById(`translation_${field}`);
        const value = control?.value;
        const valid = Object.hasOwn(supported, value) && (field === "source" || value !== "auto");
        return [field, valid ? value : defaults[field]];
      })
    );
    return TB.PROMPTS.TRANSLATION.normalize(values);
  },
  load(value) {
    const rules = TB_SYNC_RULES.normalize(value);
    document.getElementById("syncSubjectTemplate").value = rules.subjectTemplate;
    document.getElementById("syncTitleDelimiter").value = rules.titleDelimiter;
    document.getElementById("syncSearchMode").value = rules.searchMode;
    document.getElementById("syncRestrictProject").checked = rules.restrictToProject;
    document.getElementById("syncTrackerAliases").value = JSON.stringify(
      rules.trackerAliases,
      null,
      2
    );
    globalThis.TB_OPTIONS_POLICY_EDITORS.loadAliases(rules.trackerAliases);
    globalThis.TB_OPTIONS_POLICY_EDITORS.loadDates(rules.dueDateRules);
  },
  read(forceProjectRestriction = false, inheritedRules) {
    const subjectTemplate = document.getElementById("syncSubjectTemplate").value;
    const titleDelimiter = document.getElementById("syncTitleDelimiter").value;
    const searchMode = document.getElementById("syncSearchMode").value;
    return TB_SYNC_RULES.normalize({
      subjectTemplate: subjectTemplate || inheritedRules?.subjectTemplate,
      titleDelimiter: titleDelimiter || inheritedRules?.titleDelimiter,
      searchMode: searchMode || inheritedRules?.searchMode,
      restrictToProject:
        forceProjectRestriction || document.getElementById("syncRestrictProject").checked,
      trackerAliases: globalThis.TB_OPTIONS_POLICY_EDITORS.readAliases(),
      dueDateRules: globalThis.TB_OPTIONS_POLICY_EDITORS.readDates(),
    });
  },
});

document.addEventListener("DOMContentLoaded", () => {
  for (const id of ["translation_reverseMode", "logTime_activityMode"]) {
    document
      .getElementById(id)
      .addEventListener("change", () => globalThis.TB_OPTIONS_SYNC_RULES.updateVisibility());
  }
  document.addEventListener("options-localized", (event) => {
    optionsRuleMessages = event.detail;
    globalThis.TB_OPTIONS_SYNC_RULES.localize();
  });
  const button = document.getElementById("loadLogTimeActivities");
  if (!button) return;
  button.addEventListener("click", async () => {
    const status = document.getElementById("logTimeStatus");
    button.disabled = true;
    const policy = document.getElementById("policyProfile")?.value;
    try {
      const domain = TB_REDMINE_DOMAIN.normalize(document.getElementById("redmineDomain").value);
      if (!TB_REDMINE_DOMAIN.isDefault(domain, TB.REDMINE_DOMAIN)) {
        const granted = await chrome.permissions.request({
          origins: [TB_REDMINE_DOMAIN.toMatchPattern(domain)],
        });
        if (!granted) throw new Error(ruleMessage("options_redmine_permission_required"));
      }
      const input = document.getElementById("redmineApiKey").value.trim();
      const saved = await chrome.storage.local.get("redmineApiKey");
      const apiKey =
        input && input !== "**********" ? input : await decryptData(saved.redmineApiKey || "");
      const response = await chrome.runtime.sendMessage({
        type: "FETCH_REDMINE_ACTIVITIES_WITH_KEY",
        domain,
        apiKey,
      });
      if (!response?.ok) {
        throw new Error(response?.error || ruleMessage("options_activities_failed"));
      }
      if (
        document.getElementById("policyProfile")?.value !== policy ||
        TB_REDMINE_DOMAIN.normalize(document.getElementById("redmineDomain").value) !== domain
      ) {
        return;
      }
      for (const field of ["defaultActivityId", "testingActivityId"]) {
        const select = document.getElementById(`logTime_${field}`);
        const previous = select.value;
        select.replaceChildren(new Option(ruleMessage("options_activity_unselected"), ""));
        for (const activity of response.data.filter((item) => item.active !== false)) {
          select.add(new Option(activity.name, String(activity.id)));
        }
        select.value = previous;
        if (!select.value) select.value = "";
      }
      status.textContent = "";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = Boolean(
        document.getElementById("profileInherit")?.checked &&
        document.getElementById("policyProfile")?.value !== "global"
      );
    }
  });
});
