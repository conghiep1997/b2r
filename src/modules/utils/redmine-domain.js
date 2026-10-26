/**
 * Normalizes Redmine origins and converts them to Chrome match patterns.
 */
(function (global) {
  const CUSTOM_SCRIPT_ID = "b2r-redmine-custom";
  const CONTENT_SCRIPTS = Object.freeze([
    "src/modules/constants/models.js",
    "src/modules/constants/icons.js",
    "src/modules/constants/prompts.js",
    "src/constants.js",
    "src/modules/utils/helpers.js",
    "src/modules/utils/logger.js",
    "src/modules/utils/markdown.js",
    "src/modules/utils/render-markdown.js",
    "src/modules/ui/styles.js",
    "src/modules/ui/toast.js",
    "src/modules/ui/modal.js",
    "src/modules/services/redmine.js",
    "src/modules/services/report-log-time.js",
    "src/modules/utils/custom-fields.js",
    "src/modules/utils/sync-rules.js",
    "src/redmine_content.js",
  ]);

  function normalize(domain) {
    const url = new URL(String(domain || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new TypeError("Redmine domain must use HTTP or HTTPS.");
    }
    return url.origin;
  }

  function toMatchPattern(domain) {
    const url = new URL(normalize(domain));
    return `${url.protocol}//${url.hostname}/*`;
  }

  function isDefault(domain, defaultDomain) {
    return toMatchPattern(domain) === toMatchPattern(defaultDomain);
  }

  global.TB_REDMINE_DOMAIN = Object.freeze({
    CUSTOM_SCRIPT_ID,
    CONTENT_SCRIPTS,
    isDefault,
    normalize,
    toMatchPattern,
  });
})(globalThis);
