---
name: ai-integration
description: Guidance for Backlog2Redmine AI translation providers, model selection, prompts, retries, cooldowns,
  and encrypted provider settings.
---

# ai-integration

## When to use
- Editing `src/modules/services/ai.js`.
- Changing provider constants, model lists, or prompts in `src/modules/constants/` or `src/constants.js`.
- Updating options UI for Gemini, Groq, Cerebras, OpenRouter, primary/fallback providers, keys, or models.
- Debugging translation, model listing, provider fallback, or rate-limit behavior.

## Rules
- Preserve provider IDs from `TB.PROVIDERS` and existing storage key names.
- Keep primary/fallback provider flow deterministic except where existing random key/model selection is intentional.
- Use existing `timeoutFetch`, `safeReadJson`, `readErrorMessage`, and `sanitizeErrorMessage` helpers.
- Store API keys and selected model lists encrypted before writing to `chrome.storage.local`.
- Do not log raw API keys, prompts containing secrets, or full provider error payloads with credentials.
- Keep prompt changes in `src/modules/constants/prompts.js` unless a caller-specific override already exists.
- Keep model availability checks lightweight and provider-specific.

## Validation
- Existing providers still list/test models through background messaging.
- Translation fallback triggers only for retryable provider failures.
- Options page masking and encrypted persistence still work.
- New provider endpoints are covered by manifest host permissions if needed.
- User-facing errors are sanitized and actionable.
