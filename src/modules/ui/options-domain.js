/** Options domain behavior. Dependencies are supplied by the page coordinator. */
globalThis.TB_OPTIONS_DOMAIN = Object.freeze({
  create({ om }) {
    async function prepareRedmineDomain(domain) {
      const normalizedDomain = TB_REDMINE_DOMAIN.normalize(domain);

      if (!TB_REDMINE_DOMAIN.isDefault(normalizedDomain, TB.REDMINE_DOMAIN)) {
        const originPattern = TB_REDMINE_DOMAIN.toMatchPattern(normalizedDomain);
        const granted = await chrome.permissions.request({ origins: [originPattern] });
        if (!granted) {
          throw new Error(om("options_redmine_permission_required"));
        }
      }

      const previous = await chrome.storage.local.get("redmineDomain");
      return {
        currentDomain: normalizedDomain,
        previousDomain: previous.redmineDomain,
      };
    }

    async function applyRedmineRegistration(domain) {
      await unregisterCustomRedmineScript();
      if (TB_REDMINE_DOMAIN.isDefault(domain, TB.REDMINE_DOMAIN)) return;

      const originPattern = TB_REDMINE_DOMAIN.toMatchPattern(domain);
      await chrome.scripting.registerContentScripts([
        {
          id: TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID,
          matches: [originPattern],
          js: TB_REDMINE_DOMAIN.CONTENT_SCRIPTS,
          runAt: "document_idle",
          persistAcrossSessions: true,
        },
      ]);
      await injectIntoOpenRedmineTabs(originPattern);
    }

    async function injectIntoOpenRedmineTabs(originPattern) {
      let tabs;
      try {
        tabs = await chrome.tabs.query({ url: [originPattern] });
      } catch (error) {
        console.warn("[OPTIONS] Could not query open Redmine tabs:", error);
        return;
      }
      await Promise.all(
        tabs
          .filter((tab) => Number.isInteger(tab.id))
          .map(async (tab) => {
            try {
              const probe = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => Boolean(globalThis.__B2R_REDMINE_LOADED__),
              });
              if (probe[0]?.result) return;
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: TB_REDMINE_DOMAIN.CONTENT_SCRIPTS,
              });
            } catch (error) {
              console.warn(`[OPTIONS] Could not inject Redmine tab ${tab.id}:`, error);
            }
          })
      );
    }

    async function unregisterCustomRedmineScript() {
      try {
        await chrome.scripting.unregisterContentScripts({
          ids: [TB_REDMINE_DOMAIN.CUSTOM_SCRIPT_ID],
        });
      } catch (_error) {
        // The script has not been registered yet.
      }
    }

    async function removePreviousRedminePermission(previousDomain, currentDomain) {
      if (
        !previousDomain ||
        TB_REDMINE_DOMAIN.isDefault(previousDomain, TB.REDMINE_DOMAIN) ||
        TB_REDMINE_DOMAIN.toMatchPattern(previousDomain) ===
          TB_REDMINE_DOMAIN.toMatchPattern(currentDomain)
      ) {
        return;
      }
      await chrome.permissions.remove({
        origins: [TB_REDMINE_DOMAIN.toMatchPattern(previousDomain)],
      });
    }
    async function saveSettings(settings, domainChange) {
      const keys = Object.keys(settings);
      const previous = await chrome.storage.local.get(keys);
      await chrome.storage.local.set(settings);
      try {
        await applyRedmineRegistration(domainChange.currentDomain);
      } catch (error) {
        const missing = keys.filter((key) => previous[key] === undefined);
        if (missing.length) await chrome.storage.local.remove(missing);
        await chrome.storage.local.set(
          Object.fromEntries(Object.entries(previous).filter(([, value]) => value !== undefined))
        );
        await applyRedmineRegistration(previous.redmineDomain || TB.REDMINE_DOMAIN);
        throw error;
      }
      await removePreviousRedminePermission(
        domainChange.previousDomain,
        domainChange.currentDomain
      );
    }
    return {
      prepareRedmineDomain,
      applyRedmineRegistration,
      injectIntoOpenRedmineTabs,
      unregisterCustomRedmineScript,
      removePreviousRedminePermission,
      saveSettings,
    };
  },
});
