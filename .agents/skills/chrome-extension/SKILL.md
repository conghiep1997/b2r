---
name: chrome-extension
description: Manifest V3 extension guidance for Backlog2Redmine lifecycle, content scripts, messaging, storage,
  permissions, and packaged files.
---

# chrome-extension

## When to use
- Editing `manifest.json`.
- Changing `src/background.js`, content script entrypoints, `chrome.*` APIs, alarms, notifications, or extension messaging.
- Adding/removing permissions, host permissions, OAuth scopes, or web accessible resources.
- Debugging extension load, service worker, or content script ordering issues.

## Rules
- Preserve Manifest V3 service worker behavior; keep background dependencies compatible with `importScripts`.
- Keep `manifest.json` content script order aligned with global symbols used by entrypoints.
- Minimize `permissions`, `host_permissions`, OAuth scopes, and `web_accessible_resources`.
- Use `chrome.runtime.sendMessage`/background handlers for privileged API work.
- Validate message payloads and allowlist privileged background fetch endpoints.
- Keep secrets out of page DOM, logs, URLs where avoidable, and committed files.
- Use `chrome.storage.local` through existing encrypted settings patterns.
- Keep versions in `manifest.json` and `package.json` synchronized.
- Do not edit `dist/`; update source and rebuild when needed.

## Validation
- `manifest_version` remains `3`.
- Service worker loads all required globals before handlers run.
- Content scripts match only the intended Backlog and Redmine URLs declared in `manifest.json`.
- Message handlers return async responses correctly.
- Permission changes are necessary and documented by code usage.
- `npm run check:version-sync` passes after version edits.
