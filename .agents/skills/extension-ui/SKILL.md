---
name: extension-ui
description: Guidance for Backlog2Redmine popup and Options UI, injected Backlog/Redmine controls, shared modal/toast
  styling, themes, i18n, and end-user bug reports.
---

# extension-ui

## When to use
- Editing `src/options.html`, `src/options.js`, content-script UI, or `src/modules/ui/*`.
- Changing the popup, Options page, injected Backlog buttons, modals, toasts, or Redmine controls.
- Updating i18n messages or UI text surfaced through `TB.MESSAGES`.

## Rules
- Keep DOM injection scoped to matched pages and stable selectors.
- Use existing UI helpers in `src/modules/ui/` before adding new patterns.
- Keep options UI settings aligned with encrypted storage keys and background `getSettings`.
- Avoid API/user/page data in `innerHTML`; sanitize, use `textContent`, `new Option`, or DOM nodes.
- Keep markdown preview links limited to safe protocols.
- `showRedmineSuccessModal` applies to comment-sync success only; migrate uses `forceShow` and always shows the Redmine link modal.
- Migrate modal should default-enable “move all comments” when comments exist (`initialBatchNotes` / `migrateCommentsByDefault`).
- Preserve SPA navigation handling and observer cleanup in content scripts.
- Keep Vietnamese/i18n fallbacks consistent with `_locales/` and `src/constants.js`.
- Keep the user-selected `languagePreference` and `themePreference` in `chrome.storage.local`; support `system` theme through `prefers-color-scheme`.
- Keep bug reports local-first: redact logs, bound screenshot type/size, and make external issue creation explicit.
- Do not move privileged API calls into page-facing UI code.

## Validation
- Options save/load still masks saved API keys.
- UI controls do not duplicate on repeated scans or SPA navigation.
- Toasts/modals report success and failure states clearly.
- Added UI text has matching message keys or intentional fallback.
- API-provided labels and names are escaped before rendering.
- Layout changes are checked in the relevant extension page/context.
