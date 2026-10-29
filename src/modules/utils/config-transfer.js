/**
 * Configuration import/export utility for Backlog2Redmine.
 * Allows safe sharing of project profiles, sync rules, translation rules,
 * log-time policies, and custom fields across teams.
 * Sensitive keys (API keys, passwords, tokens) are NEVER exported.
 */
(function (global) {
  const FORMAT_IDENTIFIER = "Backlog2Redmine-Config";
  const SCHEMA_VERSION = 1;
  const SENSITIVE_KEY_REGEX = /api[_-]?key|secret|token|password|credential|auth/i;

  function clone(val) {
    if (val === undefined || val === null) return val;
    return JSON.parse(JSON.stringify(val));
  }

  /**
   * Recursively strips sensitive keys from objects and arrays.
   */
  function sanitize(data) {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) {
      return data.map((item) => sanitize(item));
    }
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        continue;
      }
      clean[key] = sanitize(value);
    }
    return clean;
  }

  /**
   * Builds an export payload containing sanitized profiles and global policy.
   */
  function buildExportPayload({ profiles = [], globalPolicy = {}, metadata = {} } = {}) {
    const cleanProfiles = sanitize(clone(profiles)) || [];
    const cleanPolicy = sanitize(clone(globalPolicy)) || {};

    return {
      format: FORMAT_IDENTIFIER,
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      metadata: {
        appVersion: metadata.appVersion || "1.8.22",
        backlogDomain: metadata.backlogDomain || "",
        redmineDomain: metadata.redmineDomain || "",
        description:
          metadata.description || "Backlog2Redmine Project Profiles & Sync Configuration",
      },
      globalPolicy: {
        syncRules: cleanPolicy.syncRules || null,
        translationRules: cleanPolicy.translationRules || null,
        logTimeRules: cleanPolicy.logTimeRules || null,
        customFields: cleanPolicy.customFields || null,
        manualFields: cleanPolicy.manualFields || "{}",
      },
      projectProfiles: Array.isArray(cleanProfiles) ? cleanProfiles : [],
    };
  }

  /**
   * Triggers download of configuration object as a JSON file.
   */
  function downloadAsJson(payload, filename) {
    const name =
      filename ||
      `b2r-project-config-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Parses and validates imported JSON data.
   * Strips all credentials, normalizes profiles and policies.
   */
  function parseAndValidate(jsonString, context = {}) {
    if (!jsonString || typeof jsonString !== "string") {
      throw new TypeError("Dữ liệu cấu hình không hợp lệ hoặc rỗng.");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (_e) {
      throw new TypeError("File không đúng định dạng JSON hợp lệ.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new TypeError("Cấu trúc file cấu hình không hợp lệ.");
    }

    // Sanitize completely to guarantee zero credentials leak into local state
    const clean = sanitize(parsed);

    let rawProfiles = [];
    let rawPolicy = null;
    let metadata = {};

    if (Array.isArray(clean)) {
      rawProfiles = clean;
    } else if (clean.projectProfiles || clean.globalPolicy || clean.format === FORMAT_IDENTIFIER) {
      rawProfiles = Array.isArray(clean.projectProfiles) ? clean.projectProfiles : [];
      rawPolicy =
        clean.globalPolicy && typeof clean.globalPolicy === "object" ? clean.globalPolicy : null;
      metadata = clean.metadata || {};
    } else {
      throw new TypeError("File không chứa cấu hình hoặc danh sách profile của Backlog2Redmine.");
    }

    // Normalize profiles if TB_PROJECT_PROFILES is available
    let validatedProfiles = rawProfiles;
    if (global.TB_PROJECT_PROFILES?.normalize) {
      const fallbackSettings = {
        backlogDomain:
          metadata.backlogDomain || context.backlogDomain || "https://example.backlog.com",
        redmineDomain:
          metadata.redmineDomain || context.redmineDomain || "https://example.redmine.com",
      };
      validatedProfiles = global.TB_PROJECT_PROFILES.normalize(rawProfiles, fallbackSettings);
    }

    // Validate globalPolicy if provided
    let validatedPolicy = null;
    if (rawPolicy) {
      validatedPolicy = {
        syncRules:
          global.TB_SYNC_RULES?.normalize && rawPolicy.syncRules
            ? global.TB_SYNC_RULES.normalize(rawPolicy.syncRules)
            : rawPolicy.syncRules || null,
        translationRules:
          global.TB_PROMPTS?.TRANSLATION?.normalize && rawPolicy.translationRules
            ? global.TB_PROMPTS.TRANSLATION.normalize(rawPolicy.translationRules)
            : rawPolicy.translationRules || null,
        logTimeRules:
          global.TB_LOG_TIME_RULES?.normalize && rawPolicy.logTimeRules
            ? global.TB_LOG_TIME_RULES.normalize(rawPolicy.logTimeRules)
            : rawPolicy.logTimeRules || null,
        customFields:
          global.TB_CUSTOM_FIELDS?.normalize && rawPolicy.customFields
            ? global.TB_CUSTOM_FIELDS.normalize(rawPolicy.customFields)
            : rawPolicy.customFields || null,
        manualFields: typeof rawPolicy.manualFields === "string" ? rawPolicy.manualFields : "{}",
      };
    }

    return {
      valid: true,
      payload: {
        projectProfiles: validatedProfiles,
        globalPolicy: validatedPolicy,
        metadata,
      },
      summary: {
        profileCount: validatedProfiles.length,
        hasGlobalPolicy: Boolean(validatedPolicy),
        customFieldsCount: Array.isArray(validatedPolicy?.customFields)
          ? validatedPolicy.customFields.length
          : 0,
      },
    };
  }

  /**
   * Merges imported profiles with current profiles.
   * mode: "merge" (update existing, append new) | "replace" (overwrite all)
   */
  function mergeProfiles(currentProfiles = [], incomingProfiles = [], mode = "merge") {
    if (mode === "replace") {
      return clone(incomingProfiles);
    }

    const merged = clone(currentProfiles);
    const keyOf = (p) =>
      JSON.stringify([
        String(p.backlogOrigin || "").trim(),
        String(p.redmineOrigin || "").trim(),
        String(p.backlogProjectKey || "").trim(),
      ]);

    const existingMap = new Map();
    merged.forEach((profile, index) => {
      existingMap.set(keyOf(profile), index);
    });

    for (const incoming of incomingProfiles) {
      const key = keyOf(incoming);
      if (existingMap.has(key)) {
        const existingIdx = existingMap.get(key);
        merged[existingIdx] = clone(incoming);
      } else {
        merged.push(clone(incoming));
        existingMap.set(key, merged.length - 1);
      }
    }

    if (merged.length > 100) {
      throw new TypeError("Danh sách cấu hình dự án vượt quá giới hạn 100 dự án.");
    }

    return merged;
  }

  /**
   * Merges incoming global policy into current global policy.
   */
  function mergeGlobalPolicy(currentPolicy = {}, incomingPolicy = {}) {
    if (!incomingPolicy) return clone(currentPolicy);
    const result = clone(currentPolicy) || {};

    if (incomingPolicy.syncRules) {
      result.syncRules = { ...(result.syncRules || {}), ...incomingPolicy.syncRules };
    }
    if (incomingPolicy.translationRules) {
      result.translationRules = {
        ...(result.translationRules || {}),
        ...incomingPolicy.translationRules,
      };
    }
    if (incomingPolicy.logTimeRules) {
      result.logTimeRules = { ...(result.logTimeRules || {}), ...incomingPolicy.logTimeRules };
    }
    if (Array.isArray(incomingPolicy.customFields)) {
      const fieldMap = new Map();
      (result.customFields || []).forEach((f) => fieldMap.set(Number(f.id), f));
      incomingPolicy.customFields.forEach((f) => fieldMap.set(Number(f.id), f));
      result.customFields = Array.from(fieldMap.values());
    }
    if (incomingPolicy.manualFields) {
      result.manualFields = incomingPolicy.manualFields;
    }

    return result;
  }

  global.TB_CONFIG_TRANSFER = Object.freeze({
    FORMAT_IDENTIFIER,
    SCHEMA_VERSION,
    sanitize,
    buildExportPayload,
    downloadAsJson,
    parseAndValidate,
    mergeProfiles,
    mergeGlobalPolicy,
  });
})(typeof window !== "undefined" ? window : globalThis);
