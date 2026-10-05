/** Configurable, literal issue matching rules. No user-supplied regular expressions. */
(function (global) {
  const defaults = Object.freeze({
    subjectTemplate: "{issueKey} {summary} ({translatedSummary})",
    titleDelimiter: "",
    searchMode: "key-title",
    restrictToProject: false,
    trackerAliases: {},
    dueDateRules: {
      Bug: { required: true, workingDays: 3 },
      Task: { required: true, workingDays: 0 },
    },
  });
  function normalize(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Invalid sync rules.");
    }
    const rules = { ...defaults, ...value };
    if (
      typeof rules.subjectTemplate !== "string" ||
      !rules.subjectTemplate.trim() ||
      rules.subjectTemplate.length > 500 ||
      !/\{(?:issueKey|summary)\}/.test(rules.subjectTemplate) ||
      /\{(?!issueKey\}|summary\}|translatedSummary\})[^}]*\}/.test(rules.subjectTemplate)
    ) {
      throw new TypeError(
        "Title template needs {issueKey} or {summary}; supported placeholders: {issueKey}, {summary}, {translatedSummary}."
      );
    }
    if (
      typeof rules.titleDelimiter !== "string" ||
      rules.titleDelimiter.length > 80 ||
      /[\r\n]/.test(rules.titleDelimiter)
    ) {
      throw new TypeError("Title separator must be a single line, up to 80 characters.");
    }
    if (
      !["key-title", "key", "title"].includes(rules.searchMode) ||
      typeof rules.restrictToProject !== "boolean"
    ) {
      throw new TypeError("Invalid search mode or project restriction.");
    }
    if (
      !rules.trackerAliases ||
      typeof rules.trackerAliases !== "object" ||
      Array.isArray(rules.trackerAliases) ||
      Object.keys(rules.trackerAliases).length > 100
    ) {
      throw new TypeError("Tracker aliases must be a JSON object with up to 100 issue types.");
    }
    const aliases = Object.create(null);
    for (const [type, names] of Object.entries(rules.trackerAliases)) {
      if (
        !type.trim() ||
        type.length > 100 ||
        !Array.isArray(names) ||
        names.length > 20 ||
        names.some((name) => typeof name !== "string" || !name.trim() || name.length > 100)
      ) {
        throw new TypeError("Each issue type must map to a list of tracker names.");
      }
      aliases[type.trim().toLowerCase()] = names.map((name) => name.trim());
    }
    if (
      !rules.dueDateRules ||
      typeof rules.dueDateRules !== "object" ||
      Array.isArray(rules.dueDateRules) ||
      Object.keys(rules.dueDateRules).length > 100
    ) {
      throw new TypeError("Invalid due-date rules.");
    }
    const dates = Object.create(null);
    const dateTrackers = new Set();
    for (const [tracker, rule] of Object.entries(rules.dueDateRules)) {
      if (
        !tracker.trim() ||
        tracker.length > 100 ||
        !rule ||
        typeof rule.required !== "boolean" ||
        !Number.isInteger(rule.workingDays) ||
        rule.workingDays < 0 ||
        rule.workingDays > 60
      ) {
        throw new TypeError("Due-date rules need a tracker, required flag and 0–60 working days.");
      }
      const name = tracker.trim();
      if (dateTrackers.has(name.toLowerCase())) {
        throw new TypeError("Due-date trackers must be unique.");
      }
      dateTrackers.add(name.toLowerCase());
      dates[name] = { required: rule.required, workingDays: rule.workingDays };
    }
    return {
      subjectTemplate: rules.subjectTemplate.trim(),
      titleDelimiter: rules.titleDelimiter,
      searchMode: rules.searchMode,
      restrictToProject: rules.restrictToProject,
      trackerAliases: aliases,
      dueDateRules: dates,
    };
  }
  function title(issueTitle, rules = defaults) {
    const value = String(issueTitle || "")
      .replace(/^.+?\s+#\d+\s*\([^)]*\):\s*/u, "")
      .trim();
    if (rules.titleDelimiter) return value.split(rules.titleDelimiter)[0].trim();
    return value.split(/\s\/\s+(?=[([])/u)[0].trim();
  }
  function queries(issueKey, summary, rules = defaults) {
    return [
      ...new Set(
        [
          ...(rules.searchMode !== "title" ? [issueKey] : []),
          ...(rules.searchMode !== "key" ? [title(summary, rules)] : []),
        ].filter(Boolean)
      ),
    ];
  }
  function subject(values, rules = defaults) {
    return rules.subjectTemplate
      .replace(/\{(issueKey|summary|translatedSummary)\}/g, (_match, field) =>
        String(values[field] || "")
      )
      .trim();
  }
  global.TB_SYNC_RULES = Object.freeze({ defaults, normalize, title, queries, subject });
})(globalThis);

/** Validated log-time policy, shared by Options, worker and Redmine content. */
(function (global) {
  function normalize(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Invalid log-time settings.");
    }
    const rules = {
      dailyHours: 8,
      allocation: "equal",
      activityMode: "legacy",
      defaultActivityId: "",
      testingActivityId: "",
      ...value,
    };
    if (
      typeof rules.dailyHours !== "number" ||
      !Number.isFinite(rules.dailyHours) ||
      rules.dailyHours < 0.25 ||
      rules.dailyHours > 24 ||
      !Number.isInteger(rules.dailyHours * 4)
    ) {
      throw new TypeError("Daily hours must be 0.25–24 in quarter-hour increments.");
    }
    if (
      !["equal", "estimate"].includes(rules.allocation) ||
      !["default", "legacy"].includes(rules.activityMode)
    ) {
      throw new TypeError("Invalid time allocation or activity mode.");
    }
    for (const field of ["defaultActivityId", "testingActivityId"]) {
      if (typeof rules[field] !== "string" || (rules[field] && !/^[1-9]\d*$/.test(rules[field]))) {
        throw new TypeError("Invalid time-entry activity.");
      }
    }
    return Object.fromEntries(
      ["dailyHours", "allocation", "activityMode", "defaultActivityId", "testingActivityId"].map(
        (key) => [key, rules[key]]
      )
    );
  }
  function allocate(totalHours, weights) {
    const units = Math.round(totalHours * 4);
    if (!weights.length) return [];
    if (units < weights.length) {
      throw new Error("Not enough hours to allocate at least 0.25h to each task.");
    }
    const effective = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 1));
    const sum = effective.reduce((a, b) => a + b, 0);
    const shares = effective.map((weight) => (units * weight) / sum);
    const counts = shares.map((share) => Math.max(1, Math.floor(share)));
    let remainder = units - counts.reduce((a, b) => a + b, 0);
    while (remainder !== 0) {
      const adding = remainder > 0;
      const candidates = counts
        .map((count, index) => ({
          index,
          count,
          gap: adding ? shares[index] - count : count - shares[index],
        }))
        .filter((item) => adding || item.count > 1)
        .sort((a, b) => b.gap - a.gap || a.index - b.index);
      counts[candidates[0].index] += adding ? 1 : -1;
      remainder += adding ? -1 : 1;
    }
    return counts.map((count) => count / 4);
  }
  global.TB_LOG_TIME_RULES = Object.freeze({ normalize, allocate });
})(globalThis);
