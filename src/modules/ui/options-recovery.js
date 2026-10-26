/** Options recovery controls. Sensitive checkpoints remain in the background. */
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("syncRecovery");
  if (!panel) return;
  const status = document.getElementById("syncRecoveryStatus");
  const list = document.getElementById("syncRecoveryList");
  let messages = {};
  const t = (key) => messages[key]?.message || key;

  async function request(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || t("recovery_request_failed"));
    return result.data;
  }

  function button(key, operation) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "secondary";
    element.dataset.i18n = key;
    element.textContent = t(key);
    element.addEventListener("click", async () => {
      element.disabled = true;
      status.textContent = t("recovery_working");
      try {
        await operation();
        await refresh();
        status.textContent = t("recovery_updated");
      } catch (error) {
        status.textContent = error.message;
      } finally {
        element.disabled = false;
      }
    });
    return element;
  }

  async function refresh() {
    const records = await request({ type: "LIST_SYNC_RECOVERY" });
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.dataset.i18n = "recovery_empty";
      empty.textContent = t("recovery_empty");
      list.append(empty);
      return;
    }
    for (const record of records) {
      const row = document.createElement("section");
      row.className = "note";
      const title = document.createElement("p");
      const state = document.createElement("span");
      state.dataset.i18n = `recovery_state_${record.state}`;
      state.textContent = t(state.dataset.i18n);
      title.append(
        `${record.issueKey} → #${record.issueId || "?"} · `,
        state,
        record.kind === "migration" ? ` · ${record.completed}/${record.total}` : ""
      );
      row.append(title);
      if (record.kind === "mapping") {
        row.append(
          button("recovery_remove_mapping", () =>
            request({ type: "REMOVE_ISSUE_MAPPING", issueKey: record.issueKey })
          )
        );
      } else if (record.state !== "complete") {
        row.append(
          button("recovery_resume", async () => {
            const result = await request(
              record.kind === "comment"
                ? { type: "RESUME_COMMENT_SYNC", recordId: record.recordId }
                : { type: "RESUME_MIGRATION", issueKey: record.issueKey }
            );
            if (result.failedCommentCount) {
              throw new Error(t("recovery_partial").replace("$count$", result.failedCommentCount));
            }
          })
        );
        if (record.uncertain) {
          const warning = document.createElement("p");
          warning.dataset.i18n = "recovery_uncertain_help";
          warning.textContent = t("recovery_uncertain_help");
          const label = document.createElement("label");
          const checked = document.createElement("input");
          checked.type = "checkbox";
          const caption = document.createElement("span");
          caption.dataset.i18n = "recovery_confirm_absent";
          caption.textContent = t("recovery_confirm_absent");
          label.append(checked, caption);
          row.append(
            warning,
            label,
            button("recovery_resolve", async () => {
              if (!checked.checked) throw new Error(t("recovery_confirmation_required"));
              await request(
                record.kind === "comment"
                  ? { type: "RESOLVE_COMMENT_SYNC", recordId: record.recordId }
                  : {
                      type: "RESOLVE_MIGRATION",
                      issueKey: record.issueKey,
                      action: "confirm-not-sent",
                    }
              );
            })
          );
          if (!record.issueId && record.kind === "migration") {
            const input = document.createElement("input");
            input.type = "number";
            input.min = "1";
            input.dataset.i18nAriaLabel = "recovery_destination";
            input.setAttribute("aria-label", t("recovery_destination"));
            row.append(
              input,
              button("recovery_adopt", () =>
                request({
                  type: "RESOLVE_MIGRATION",
                  issueKey: record.issueKey,
                  action: "adopt",
                  redmineIssueId: input.value,
                })
              )
            );
          }
        }
      }
      list.append(row);
    }
  }

  async function initialize() {
    const { languagePreference = "en" } = await chrome.storage.local.get("languagePreference");
    const response = await fetch(`../_locales/${languagePreference}/messages.json`);
    if (!response.ok) throw new Error("Locale catalog unavailable.");
    messages = await response.json();
    panel.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    await refresh();
  }
  document.getElementById("saveIssueMapping").addEventListener("click", async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    try {
      await request({
        type: "SAVE_ISSUE_MAPPING",
        issueKey: document.getElementById("mappingSource").value.trim(),
        redmineIssueId: document.getElementById("mappingDestination").value.trim(),
      });
      await refresh();
      status.textContent = t("recovery_updated");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      control.disabled = false;
    }
  });
  document.getElementById("refreshSyncRecovery").addEventListener("click", () =>
    initialize().catch((error) => {
      status.textContent = error.message;
    })
  );
  document.addEventListener("options-localized", (event) => {
    messages = event.detail;
  });
  initialize().catch((error) => {
    status.textContent = error.message;
  });
});
