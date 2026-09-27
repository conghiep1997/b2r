---
name: cross-platform-sync
description: Maintain Backlog and Redmine issue, comment, attachment and report-time synchronization.
---

# name
cross-platform-sync

# description
Guidance for Backlog and Redmine API flows used to sync comments, issues, attachments, logs, and report time.

# when to use
- Editing `src/modules/services/backlog.js`, `redmine.js`, or `report-log-time.js`.
- Changing sync logic in `src/background.js`, `src/content.js`, or `src/redmine_content.js`.
- Debugging issue lookup, comment posting, attachment transfer, metadata loading, or project/user sync.

# concise rules
- Use Backlog API keys as `apiKey` query parameters where existing service methods do.
- Use Redmine `X-Redmine-API-Key` headers for Redmine REST calls.
- Never log raw URLs or error payloads that may include `apiKey` or authorization tokens.
- Build external URLs with `URL`, `URLSearchParams`, or existing helpers.
- Preserve Backlog issue-key parsing and Redmine matching heuristics unless intentionally changing behavior.
- Redmine issue lookup: prefer JP title segment (strip ` / (VN…)`), search key and JP title separately, API `subject=~` + `status_id=*`.
- Migrate issue should collect/translate comments by default and post them as Redmine notes after create.
- Absolutize Backlog-relative links (`/view/…`) before Markdown→Textile; only emit `http/https` Textile links.
- Keep attachment download/upload paths explicit about source credentials and target API requirements.
- Sanitize API error messages before showing users or storing logs.
- Keep service code separate from DOM rendering; route UI work through content/options modules.

# validation checklist
- Decrypted settings are used only inside privileged/background or service flows.
- Backlog and Redmine host permissions cover any new endpoint.
- Comment markdown and attachment links remain usable after sync.
- Success/error toasts or modal states still fire for user actions.
- Network failures produce clear errors without exposing credentials.
- Backlog and Redmine credentials are sent only to their matching APIs.

## Review invariants

- Upload Backlog files through `/api/v2/space/attachment`, then pass returned IDs as `attachmentId[]` when creating the comment. Finish uploads before posting.
- Commit an attachment cache only after the destination write succeeds; failed transfers must remain retryable.
- Authenticated Redmine requests and attachment downloads must stay on the configured origin and reject redirects.
- Fetch every time-entry page before planning writes. Reject incomplete pages and entries outside the requested user/date.
- Report synchronization manages only entries with the exact report marker or legacy entries explicitly selected in the preview. Preserve all other entries and deduct their hours from the 8-hour budget. Require an approved operation plan and fresh user/date/origin/entry snapshot before writing. Apply reductions before increases, stop at the first failure, and never delete entries for an empty report. Client-side checks cannot make concurrent clients atomic.
