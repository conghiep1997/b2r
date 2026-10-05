/** Accessible table-like policy editors; configuration values are always rendered as text. */
(function (global) {
  let messages = {};
  document.addEventListener("options-localized", (event) => {
    messages = event.detail;
  });
  const t = (key) => messages[key]?.message || chrome.i18n.getMessage(key) || key;
  function caption(key) {
    const span = document.createElement("span");
    span.dataset.i18n = key;
    span.textContent = t(key);
    return span;
  }
  function row(container, fields, value) {
    const section = document.createElement("section");
    section.className = "note policy-row";
    for (const [field, key, type = "text", choices] of fields) {
      const label = document.createElement("label");
      const input = document.createElement(
        choices ? "select" : type === "textarea" ? "textarea" : "input"
      );
      input.dataset.field = field;
      if (choices) {
        choices.forEach(([optionValue, optionKey]) => {
          const option = new Option(t(optionKey), optionValue);
          option.dataset.i18n = optionKey;
          input.add(option);
        });
      } else if (type !== "textarea") input.type = type;
      if (type === "checkbox") input.checked = Boolean(value[field]);
      else input.value = String(value[field] ?? "");
      if (type === "number") {
        input.min = "0";
        input.step = "1";
      }
      label.append(caption(key), input);
      section.append(label);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.append(caption("options_mapping_remove"));
    remove.onclick = () => section.remove();
    section.append(remove);
    container.append(section);
  }
  const aliasFields = [
    ["type", "options_mapping_source_type"],
    ["names", "options_mapping_tracker_names"],
  ];
  const dateFields = [
    ["tracker", "options_mapping_tracker"],
    ["required", "options_mapping_required", "checkbox"],
    ["workingDays", "options_mapping_working_days", "number"],
  ];
  const customFields = [
    ["name", "options_mapping_field_name"],
    ["id", "options_mapping_field_id", "number"],
    [
      "type",
      "options_mapping_field_type",
      "text",
      [
        ["text", "options_mapping_text"],
        ["select", "options_mapping_select"],
      ],
    ],
    ["options", "options_mapping_field_options", "textarea"],
    ["trackers", "options_mapping_field_trackers"],
    ["defaultValue", "options_mapping_default_value"],
    ["required", "options_mapping_required", "checkbox"],
  ];
  const values = (id) =>
    Array.from(document.getElementById(id).children, (section) =>
      Object.fromEntries(
        Array.from(section.querySelectorAll("[data-field]"), (input) => [
          input.dataset.field,
          input.type === "checkbox" ? input.checked : input.value,
        ])
      )
    );
  const csv = (value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  function loadAliases(aliases) {
    const container = document.getElementById("trackerAliasesEditor");
    container.replaceChildren();
    Object.entries(aliases).forEach(([type, names]) =>
      row(container, aliasFields, { type, names: names.join(", ") })
    );
  }
  function readAliases() {
    const result = Object.create(null);
    for (const item of values("trackerAliasesEditor")) {
      const type = item.type.trim().toLowerCase();
      if (!type || Object.hasOwn(result, type)) {
        throw new Error(t("options_mapping_duplicate_type"));
      }
      result[type] = csv(item.names);
    }
    return result;
  }
  function loadDates(dates) {
    const container = document.getElementById("dueDateRulesEditor");
    container.replaceChildren();
    Object.entries(dates).forEach(([tracker, rule]) =>
      row(container, dateFields, { tracker, ...rule })
    );
  }
  function readDates() {
    const result = Object.create(null);
    for (const item of values("dueDateRulesEditor")) {
      const tracker = item.tracker.trim();
      if (!tracker || Object.hasOwn(result, tracker)) {
        throw new Error(t("options_mapping_duplicate_tracker"));
      }
      result[tracker] = { required: item.required, workingDays: Number(item.workingDays) };
    }
    return result;
  }
  function loadFields(fields, legacy) {
    const container = document.getElementById("customFieldsEditor");
    container.replaceChildren();
    (global.TB_CUSTOM_FIELDS.normalize(fields) || global.TB_CUSTOM_FIELDS.legacy(legacy)).forEach(
      (field) =>
        row(container, customFields, {
          ...field,
          options: field.options.join("\n"),
          trackers: field.trackers.join(", "),
        })
    );
  }
  function readFields() {
    return global.TB_CUSTOM_FIELDS.normalize(
      values("customFieldsEditor").map((field) => ({
        ...field,
        id: Number(field.id),
        trackers: csv(field.trackers),
        options: field.options.split("\n").filter((value) => value.trim()),
      }))
    );
  }
  async function localize() {
    const { languagePreference = "en" } = await chrome.storage.local.get("languagePreference");
    messages = await (
      await fetch(
        chrome.runtime.getURL(`_locales/${languagePreference === "vi" ? "vi" : "en"}/messages.json`)
      )
    ).json();
    for (const root of document.querySelectorAll(".policy-editor")) {
      root.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
      });
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    for (const [button, container, fields, defaults] of [
      ["addTrackerAlias", "trackerAliasesEditor", aliasFields, {}],
      ["addDueDateRule", "dueDateRulesEditor", dateFields, { required: false, workingDays: 0 }],
      ["addCustomField", "customFieldsEditor", customFields, { type: "text", required: false }],
    ]) {
      document.getElementById(button).onclick = () =>
        row(document.getElementById(container), fields, defaults);
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.languagePreference) void localize();
    });
    void localize();
  });
  global.TB_OPTIONS_POLICY_EDITORS = Object.freeze({
    loadAliases,
    readAliases,
    loadDates,
    readDates,
    loadFields,
    readFields,
  });
})(globalThis);
