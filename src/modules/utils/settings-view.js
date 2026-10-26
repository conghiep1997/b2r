/**
 * Builds least-privilege settings views for extension content scripts.
 */
(function (global) {
  function pick(settings, fields) {
    return Object.fromEntries(fields.map((field) => [field, settings[field]]));
  }

  const UI_FIELDS = [
    "showRedmineSuccessModal",
    "defaultProjectId",
    "manualFields",
    "syncRules",
    "customFields",
  ];
  const REPORT_FIELDS = ["redmineDomain", "reportProjectId", "logTimeRules"];

  function hasSameOrigin(firstUrl, secondUrl) {
    try {
      return new URL(firstUrl).origin === new URL(secondUrl).origin;
    } catch {
      return false;
    }
  }

  global.TB_SETTINGS_VIEW = Object.freeze({
    forReport: (settings) => ({
      ...pick(settings, REPORT_FIELDS),
      hasRedmineApiKey: Boolean(settings.redmineApiKey),
      reportProjects: Array.from(
        new Map([
          ...(settings.reportProjectId
            ? [
                [
                  String(settings.reportProjectId),
                  {
                    id: String(settings.reportProjectId),
                    name: `#${settings.reportProjectId}`,
                    globalProfile: true,
                  },
                ],
              ]
            : []),
          ...(settings.projectProfiles || [])
            .filter(
              (profile) =>
                hasSameOrigin(profile.redmineOrigin, settings.redmineDomain) &&
                hasSameOrigin(
                  profile.backlogOrigin,
                  settings.backlogDomain || global.TB?.BACKLOG_DOMAIN
                )
            )
            .map((profile) => {
              const id = profile.reportProjectId || profile.redmineProjectId;
              return [
                `${id}:${profile.backlogProjectKey}`,
                {
                  id: String(id),
                  profileKey: profile.backlogProjectKey,
                  name: `${profile.name} (#${id})`,
                },
              ];
            }),
        ]).values()
      ),
    }),
    forUi: (settings) => pick(settings, UI_FIELDS),
    hasSameOrigin,
  });
})(globalThis);
