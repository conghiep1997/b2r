/** Project policies never contain credentials and are scoped to both server origins. */
(function (global) {
  function origin(value) {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new TypeError("Invalid profile origin.");
    }
    return url.origin;
  }
  function normalize(value = [], settings = {}) {
    if (JSON.stringify(value).length > 1000000) {
      throw new TypeError("Project profiles are too large.");
    }
    if (!Array.isArray(value) || value.length > 100) {
      throw new TypeError("Profiles must be a list of at most 100 projects.");
    }
    const seen = new Set();
    return value.map((profile) => {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        throw new TypeError("Invalid project profile.");
      }
      const backlogOrigin = origin(profile.backlogOrigin || settings.backlogDomain);
      const redmineOrigin = origin(profile.redmineOrigin || settings.redmineDomain);
      const backlogProjectKey = String(profile.backlogProjectKey || "").trim();
      const redmineProjectId = String(profile.redmineProjectId || "");
      const reportProjectId = String(profile.reportProjectId || "");
      if (
        reportProjectId &&
        (!/^[1-9]\d*$/.test(reportProjectId) || !Number.isSafeInteger(Number(reportProjectId)))
      ) {
        throw new TypeError("Invalid report project ID.");
      }
      if (
        !/^[A-Z0-9_]+$/.test(backlogProjectKey) ||
        backlogProjectKey.length > 100 ||
        !/^[1-9]\d*$/.test(redmineProjectId) ||
        !Number.isSafeInteger(Number(redmineProjectId))
      ) {
        throw new TypeError(
          "Profile needs a Backlog project key and a numeric Redmine project ID."
        );
      }
      const key = JSON.stringify([backlogOrigin, redmineOrigin, backlogProjectKey]);
      if (seen.has(key)) {
        throw new TypeError(
          "Only one active profile is allowed for each Backlog project in a workspace."
        );
      }
      seen.add(key);
      const name = String(profile.name || backlogProjectKey).trim();
      if (!name || name.length > 150) throw new TypeError("Invalid profile name.");
      const overrides = profile.overrides || {};
      if (typeof overrides !== "object" || Array.isArray(overrides)) {
        throw new TypeError("Invalid profile overrides.");
      }
      const result = {};
      for (const field of Object.keys(overrides)) {
        if (
          ![
            "syncRules",
            "translationRules",
            "logTimeRules",
            "manualFields",
            "customFields",
          ].includes(field)
        ) {
          throw new TypeError("Unsupported profile override.");
        }
      }
      if (overrides.syncRules !== undefined) {
        result.syncRules = global.TB_SYNC_RULES.normalize(overrides.syncRules);
      }
      if (overrides.translationRules !== undefined) {
        result.translationRules = global.TB_PROMPTS.TRANSLATION.normalize(
          overrides.translationRules
        );
      }
      if (overrides.logTimeRules !== undefined) {
        result.logTimeRules = global.TB_LOG_TIME_RULES.normalize(overrides.logTimeRules);
      }
      if (overrides.manualFields !== undefined) {
        // The legacy ID map remains supported alongside explicit field definitions.
        const fields =
          typeof overrides.manualFields === "string"
            ? JSON.parse(overrides.manualFields)
            : overrides.manualFields;
        if (
          !fields ||
          typeof fields !== "object" ||
          Array.isArray(fields) ||
          Object.keys(fields).length > 100 ||
          Object.entries(fields).some(
            ([fieldName, id]) =>
              !fieldName.trim() ||
              fieldName.length > 150 ||
              !Number.isSafeInteger(Number(id)) ||
              Number(id) <= 0
          )
        ) {
          throw new TypeError("Custom fields must map field names to positive IDs.");
        }
        result.manualFields = JSON.stringify(fields);
      }
      if (overrides.customFields !== undefined) {
        result.customFields = global.TB_CUSTOM_FIELDS.normalize(overrides.customFields);
      }
      return {
        name,
        backlogOrigin,
        redmineOrigin,
        backlogProjectKey,
        redmineProjectId,
        reportProjectId,
        overrides: result,
      };
    });
  }
  function current(settings) {
    return (settings.projectProfiles || []).filter(
      (profile) =>
        profile.backlogOrigin === origin(settings.backlogDomain || global.TB.BACKLOG_DOMAIN) &&
        profile.redmineOrigin === origin(settings.redmineDomain)
    );
  }
  function apply(settings, profile) {
    if (!profile) return settings;
    return {
      ...settings,
      ...profile.overrides,
      defaultProjectId: profile.redmineProjectId,
      defaultProjectName: profile.name,
      syncRules: {
        ...(profile.overrides.syncRules || settings.syncRules),
        restrictToProject: true,
      },
      profileName: profile.name,
      customFields:
        profile.overrides.customFields !== undefined
          ? profile.overrides.customFields
          : profile.overrides.manualFields !== undefined
            ? global.TB_CUSTOM_FIELDS.legacy(profile.overrides.manualFields)
            : settings.customFields,
    };
  }
  function forBacklog(settings, issueKey = "") {
    const key = String(issueKey).replace(/-\d+$/, "");
    return apply(
      settings,
      current(settings).find((profile) => profile.backlogProjectKey === key)
    );
  }
  function forRedmine(settings, projectId, purpose = "reverse") {
    const profiles = current(settings).filter(
      (profile) =>
        (purpose === "report"
          ? profile.reportProjectId || profile.redmineProjectId
          : profile.redmineProjectId) === String(projectId)
    );
    if (profiles.length > 1) {
      const policies = new Set(
        profiles.map((profile) => {
          const translation = profile.overrides.translationRules || settings.translationRules;
          return JSON.stringify(
            purpose === "report"
              ? profile.overrides.logTimeRules || settings.logTimeRules
              : [translation.reverseMode, translation.reverseSource, translation.reverseTarget]
          );
        })
      );
      if (policies.size > 1) {
        throw new Error(
          "Multiple project profiles have different policies. Map this Redmine issue to a Backlog issue before reverse sync, or use a separate report project."
        );
      }
    }
    return apply(settings, profiles[0]);
  }
  global.TB_PROJECT_PROFILES = Object.freeze({ normalize, current, forBacklog, forRedmine });
})(globalThis);
