# Changelog - Backlog2Redmine

All notable changes to the Backlog2Redmine (B2R) extension will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).
(Vietnamese version: [CHANGELOG.vi.md](./CHANGELOG.vi.md))

## [1.8.22] - 2026-10-28
- **✨ Added**: Offline and Retry Queue (`retryQueue` / `tb_retry_queue`) with auto-enqueuing of failed comments and migrations on network drops, reactive reconnection listener (`online`) to auto-retry queued operations, and full queue management UI in Options under Advanced settings (view queue, retry, and clear).
- **✨ Added**: Connection checks for Backlog and the primary AI provider directly in their Options sections, with inline verification results and automatic verification when saving credentials; floating sticky Save bar with micro-interactions and `Ctrl+S` / `Cmd+S` keyboard shortcut to save settings.
- **✨ Added**: Persistent translation cache (`translationCache`) with 0ms in-memory LRU lookups, local storage persistence, toggle switch, and clear cache control in Options.
- **✨ Added**: Safe Export / Import project configuration JSON (`configTransfer`) with zero API key leakage and support for both Merge and Replace modes.
- **✨ Added**: Configurable translation tone and style (`technical` [default], `formal`, `concise`) injected into translation prompts.
- **✨ Added**: Quick Settings Search Filter (`#optionsSearchInput`) in Options page with real-time section matching, auto-expanding `<details>`, tab switching, and keyboard shortcuts (`/` to focus, `Esc` to clear).
- **🔧 Fixed**: Made the setup guide toggleable from the top bar and kept its expanded state accessible and persisted; improved save and button feedback for pending, successful, and disabled states.
- **🔧 Fixed**: Added `tb_retry_queue` to transient storage prefixes in the background service worker to prevent invalidating decrypted settings cache on queue operations; registered retry queue message contracts in message validator.
- **📝 Docs**: Updated English and Vietnamese labels for setup guide, translation cache, configuration transfer, translation tone, settings search, save progress/success states, and retry queue; added comprehensive unit tests covering translation caching, configuration transfer, translation rules, and retry queue (182 unit tests passing).


## [1.8.21] - 2026-10-27
- **✨ Added**: Month picker (`YYYY-MM`) in the Redmine Monthly Log Time modal to preview, log, and delete spent time for any past or current month, plus `#b2r-monthly-log` deep-linking from the extension popup.
- **✨ Added**: Dark-theme synchronization (`data-tb-theme="dark"`) for all injected Backlog/Redmine modals, tables, cards, and banners following `themePreference`.
- **✨ Added**: Keyboard shortcuts (`Escape` to close, `Ctrl+Enter` / `Cmd+Enter` to confirm), debounced Redmine Issue ID lookup, styled migration file-selection cards, and interactive toasts (hover-to-pause, click-to-dismiss, ARIA live regions).
- **✨ Added**: In-place language switching on the Options page without reloading the page or losing unsaved inputs, and Unicode/multi-word Backlog `@mention` autocomplete.
- **🔧 Fixed**: Hardened `normalizeTranslationOutput` to preserve markdown numbered lists and inline `Result:` text, strip B2R sync markers upfront, and pass explicit fallback retry flags.
- **🔧 Fixed**: Chunked `encryptData` base64 encoding to prevent call-stack overflow on large settings payloads and deduplicated concurrent `getUserStorageId` initialization.
- **🔧 Fixed**: Tagged single-report time entries with `[B2R report:<id>]` so monthly deletion accurately cleans them up, and localized all report status badges and summary labels.
- **🔧 Fixed**: Eliminated prefix collisions in Redmine issue-key search (`PROJ-1` vs `PROJ-10`) and migration markers (`_1` vs `_10`), escaped `$` replacement patterns in Redmine attachment markup, and ignored empty/deleted comments during sync dedup.
- **🔧 Fixed**: Validated actual stored AI provider API keys in popup readiness checks, hidden unconfigured donation methods, isolated `baseSettings` in full-comment translation, and kept background settings cache valid across transient storage writes.
- **📝 Docs**: Added unit test suites covering translation output normalization, large-payload encryption, sync marker stripping, Redmine attachment markup, comment sync deduplication, and migration marker matching.


## [1.8.20] - 2026-10-26
- **✨ Added**: Project-scoped glossaries, saved issue mappings, migration preview with comment/file selection, and resumable migration checkpoints.
- **✨ Added**: Configurable translation and reverse-sync modes, project-pair profiles, migration title/search rules, tracker aliases, and custom-field policies.
- **✨ Added**: Monthly log-time rules and project selection, plus a local Redmine sandbox for validation.
- **🔧 Fixed**: Prevent duplicate syncs and migration issues after interrupted requests; preserve completed work and reconcile ambiguous results before retrying.
- **🔧 Fixed**: Validate Redmine destinations, attachments, time-entry plans, and settings before writes; isolate workspace/project data and protect encrypted credentials.
- **📝 Docs**: Expanded setup, Options, migration, recovery, and sandbox guidance; refreshed screenshots and skill documentation.
- **📝 Docs**: Added implementation review and validation notes in `IMPLEMENTATION.md`.


## [1.8.19] - 2026-10-22
- **✨ Added**: One Redmine project selector for issue migration and monthly reports.
- **🔧 Fixed**: Popup setup status now reflects the required API key and AI provider for each sync direction; overall setup accepts either Redmine or Backlog key when an AI provider is selected.
- **🔧 Fixed**: Apply project-specific issue lookup mode, title delimiter, tracker aliases, and Redmine project restriction; avoid selecting unrelated search results.
- **🔧 Fixed**: Use the selected log-time rules consistently in previews, confirmations, and pre-write checks.
- **📝 Docs**: Simplified Options guidance and removed redundant API key and workspace-domain explanations.


## [1.8.18] - 2026-10-02

### Added
- Configure independent source/target languages for Backlog → Redmine and extraction, translation, or original-content modes for Redmine → Backlog.
- Configure daily log-time hours, equal or estimate-based allocation in quarter-hour increments, and API-backed default/testing activities.
- Select workspace-scoped profile Report projects in the monthly log-time dialog.

### Fixed
- Resolve Redmine destinations using complete, paginated API results instead of first-page HTML hits; match complete Backlog keys and reject ambiguous matches.
- Preserve explicitly empty model selections.
- Distinguish migration attachments by source ID.
- Accept corrected payloads after confirmed failures while preserving completed work and manually corrected issue mappings.
- Restore credentials together with domains when content-script registration fails.
- Remove legacy checkpoints only after successfully storing their replacements.
- Discard monthly report previews when the selected project changes and block log-time writes if the hours/activity plan changes before confirmation.
- Remove fixed time-entry activity-ID fallbacks.

### Improved
- Keep the chosen translation language across provider fallback and glossary prompts; use the target language for translated comment collapse labels while preserving existing default directions.
- Support issue titles without Backlog keys through saved mappings.
- Compact completed checkpoints and scope operation locks and record decryption to the current workspace.
- Require loading a glossary before saving, protect unsaved edits and explicit clearing, and disable editing during requests.

### Verification
- 134 unit tests and 24 browser tests passed, including a real unpacked MV3 extension smoke test.
- Lint, formatting, version synchronization, and build passed.
- Live Backlog/Redmine writes were not exercised.


## [1.8.17] - 2026-09-24

- **Added**: First-run onboarding, sync activity history, preview-only dry run, and clearer AI retry/provider status. Expanded automated coverage for Popup, Options, Backlog, and Redmine flows.
- **Monthly Log Time**: Add a popup shortcut to the Redmine monthly log. Show the tasks, planned hours, and existing entries before logging; require a fresh preview and block unsafe replacement when data has changed.
- **Improved Gemini rotation**: Reserve a model/key slot before each request so concurrent translations start on different slots. Cool down a Gemini key across selected models after a rate-limit response, while keeping model-specific failures scoped to their model/key pair; honor `Retry-After` when provided.
- **Gemini configuration**: Test every configured Gemini key for a selected model and show which key positions fail. Continue to load older settings containing a single Gemini key.
- **Models**: Add Gemini 3.5 Flash Lite, remove Gemini 2.0 models from the selection list, and use the default model when saved selections contain only retired models.
- **Popup**: Restore the localized Monthly Log Time button label and place it above the Redmine and Backlog quick links for clearer navigation.
- **Fixed**: Record failed and partially completed syncs; avoid reposting completed comments on a same-target retry in the same modal; keep successful sends successful when activity storage fails. Require a trusted HTTPS Backlog workspace before sending an API key. Scope AI status to the requesting tab/frame, and tie project caching and connection verification to the current settings.
- **Localization and UI**: Localize remaining Redmine progress and Options text, including dynamic labels, placeholders, alt text, and accessibility labels. Clarify form guidance and monthly log feedback; keep English and Vietnamese message catalogs aligned.
- **Docs**: Refreshed seven English demo screenshots under `output/playwright/` using illustrative data, without real credentials.
- **Verification**: Build, lint, formatting, 56 unit tests, and 9 mocked-browser E2E tests passed. Live Backlog/Redmine accounts were not exercised.


## [1.8.16] - 2026-09-21

### Added
- Include the latest error logs in downloaded, copied, and GitHub bug reports.

### Fixed
- Changed the extension default locale to English.
- Improved the Options page Language and Theme controls with clearer borders and placement.
- Improved dark-mode contrast across settings sections and form controls.
- Localized the Redmine personal account link.
- Fixed screenshot preview handling and added an error state when an image cannot be previewed.
- Preserved `<flow_guide_id>` style placeholders when translating and syncing notes to Redmine.
- Decoded AI HTML-escaped `<>` brackets before posting to Redmine while preserving entities inside code fences and inline code.
- Prevented Textile from double-escaping placeholders outside the allowlist.
- Preserved Backlog custom tags like `<flow_guide_id>` during content extraction instead of dropping them.

### Improved
- Updated translation prompt to preserve `<id>` and `<flow_guide_id>` placeholders intact.
- Added utility helpers `decodeHtmlEntitiesOutsideCode`, `buildRedmineUploadUrl`, and `normalizeBacklogOrigin`.
- Added unit tests for decoding angle brackets, Textile placeholders, and extracting custom tags.

### Docs
- Documented the Options page, screenshot preview, localization, and error-log report improvements.
- Updated `CHANGELOG.md` for version 1.8.16.


## [1.8.15] - 2026-09-20

### Added
- Added internationalization (i18n) for popup, Options, and Redmine Log Time flows supporting Vietnamese and English.
- Added manual language selection and Light / Dark / System theme preferences with local persistence.
- Added end-user bug report workflow: description, reproduction steps, URL, environment, recent logs, and optional screenshots.
- Enabled downloading JSON bug reports with images, copying report text, or opening pre-filled GitHub issues.
- Created shared skill `extension-ui` for design tokens, themes, accessibility, i18n, and bug-report privacy.
- Completed synchronized English and Vietnamese locale message catalogs across popup, Options, and injected modal/report UI.

### Improved
- Converted popup into a status dashboard with localized message keys and fallback locale support.
- Localized Redmine Log Time status, modals, result tables, and error messages.
- Added support card, image preview, and data privacy warnings before submitting bug reports in Options.

### Security / Privacy
- Bug reports do not automatically upload user data; reports require explicit user action to download or open GitHub.
- Restricted screenshot attachments to 5 MB and supported PNG/JPEG/WebP formats.
- Excluded API keys from popup displays and report metadata.

### Verification
- Lint and version-sync checks passed.
- Validated locale JSON files and manifest.


## [1.8.14] - 2026-09-19

### Added
- Added extension popup on icon click displaying configuration status and active Redmine project summary.
- Added coffee donation modal with Bank Transfer, MoMo, and PayPal tabs.
- Added new extension icons and intuitive visual action icons in popup.

### Fixed
- Synchronized button sizes, popup layout, and donation modal to prevent text clipping and overflow.
- Clarified active `Backlog → Redmine` flow and marked `Redmine → Backlog` as not yet ready.
- Populated Redmine project names in popup via background service instead of displaying raw IDs.
- Added message validation for `GET_DEFAULT_PROJECT_SUMMARY` and URL validation before opening tabs.
- Reduced duplicate information between status card and project card.

### Improved
- Redesigned popup with flat modern styling, harmonious colors, clear icons, and scannable visual hierarchy.
- Kept API keys hidden from popup; restricted project retrieval requests to internal extension pages.

### Docs
- Updated changelog for popup dashboard, project summary, donation options, and new icons.


## [1.8.13] - 2026-09-18

> Fix Backlog to Redmine attachment sync (especially `.mp4` video files and Japanese filenames).

### Fixed
- Appended `?filename=` parameter to Redmine `/uploads.json` requests to prevent HTTP 422 errors when extension filtering is enabled, with support for Japanese filenames (e.g. `3653_API呼び出しあり.mp4`).
- Normalized Backlog origin during web download fallback to eliminate invalid `https://https://...` URL concatenation.
- Rejected invalid download blobs (HTML login pages, error JSON, empty blobs) prior to uploading to Redmine.
- Scraped `downloadAttachment/` and `ViewAttachmentVideo` links in comments and descriptions.
- Added concise `[Attachment Error: …]` notifications with failure reasons (HTTP status / upload failure) for easier debugging (e.g. exceeding max file size on Redmine).

### Improved
- Added `normalizeBacklogOrigin` and `buildRedmineUploadUrl` helpers; added unit tests for upload URLs and origin normalization.

### Docs
- Updated `CHANGELOG.md` for version 1.8.13.


## [1.8.12] - 2026-09-15

> Match Redmine issues by Japanese title (ignoring Vietnamese translations), migrate comments by default, and preserve Backlog links when syncing to Redmine.

### Added
- Extracted Japanese title preceding ` / (…)` during Redmine lookup to ensure matches even when Vietnamese translations differ.
- Queried issue key and Japanese title independently (OR logic rather than strict AND); used `subject=~` and `status_id=*` for API search.
- Pre-translated Issue Migration with automatic inclusion of all existing comments/notes enabled by default.
- Always displayed success modal with Redmine link (`forceShow`) upon issue migration, regardless of modal suppression settings.
- Converted relative Backlog links (`/view/KEY`) to absolute URLs and formatted as Textile `"label":url` when posting to Redmine.
- Added unit tests for matching bilingual Japanese/Vietnamese subjects, relative Backlog links, and dropping unsafe `javascript:` links.

### Fixed
- Prevented missing Redmine issues when subjects like `【調査】… / ([Điều tra] …)` do not contain a Backlog key.
- Fixed issue links inside comments disappearing or rendering as raw Markdown `[KEY](/view/KEY)` in Redmine.
- Prevented a single failed comment translation from blocking the entire issue migration (falling back to original text).
- Treated only `/user/` on the Backlog host as profile links; emitted Textile links only for `http`/`https`.

### Improved
- Clarified Options wording for "Show success modal..." to specify it only applies to comment translation/sync; Issue Migration always shows modal and link.
- Added note to "Do not show again" checkbox on success modal indicating it only affects comment translations.

### Docs
- Updated `CHANGELOG.md`, `README.md` (migration and options), and skills for `cross-platform-sync` and `extension-ui`.


## [1.8.11] - 2026-08-27

> Prioritize tracker during Redmine lookup, preserve Markdown format, and apply P0 fixes for migration, batching, and security.

### Added
- Prioritized Redmine issue search by tracker based on Backlog issue type (e.g. `QA` → `Q/A` or `Q&A`).
- Converted underline, text/background color (`&color`/`<mark>`), and task list checkboxes from Backlog to Markdown.
- Added unit tests for `extractBacklogContent` covering code fences, special inline code, underline/color, and task lists.
- Proxied `REDMINE_AUTHORIZED_FETCH` so Redmine content scripts call APIs via the service worker without receiving plaintext API keys.
- Standardized UI copy across modals and content scripts while keeping proper names (Redmine, Backlog, Issue).

### Fixed
- Prevented breaking code fences ` ``` ` during Markdown cleanup (previously ``+/g stripped code block formatting on Redmine).
- Preserved special characters inside code (`--`, `/*`, `;`, `0x...`) during HTML conversion and AI translation.
- Mapped migration tracker `QA` to `Q/A` (with fallback to `Q&A`) instead of only matching `Q&A`.
- Used `memoizedBatchNotes` during comment migration (previously `currentNotesList.slice(1)` was always empty).
- Prevented duplicate first notes in batch comments caused by `mergeTranslatedBatchNotes` contract mismatch.
- Sent `fixed_version_id` when creating Redmine issues.
- Prevented lookup API from falling back to `issues[0]` when tracker does not match preferences.
- Added clear error reporting when individual comments fail during migration.
- Added origin allowlist for privileged handlers (Backlog, Redmine, Options).

### Improved
- Passed `backlogIssueType` into lookup and cache to distinguish between Task and Q/A issues with identical titles.
- Shortened system prompt to reduce fixed token overhead and added protection for `[[TB_FILE]]` markers.
- Handled empty or unknown Backlog issue types without enforcing tracker preference.
- Mapped Backlog issue types `要望`, `要望（実装）`, and `タスク` to Redmine `Task`.
- Converted Markdown to Textile when posting notes and descriptions to Redmine.
- Added Markdown and Redmine Textile preview tabs in migration modal.
- Prevented calling `closeModal()` after confirmation to avoid masking the success modal.
- Updated prompt to prohibit wrapping `@mentions` with links and to apply light editing if text is already translated.
- Preserved HTTP status codes when sanitizing issue creation errors.
- Added toast notification for partial migrations showing failed comment indices and initial error reasons.


## [1.8.10] - 2026-07-07

### Fixed
- Restore update checks when the backend version routes return 404 by falling back to GitHub Releases.
- Keep GitHub release publishing successful when optional backend version registration is unavailable.
- Let Options save API keys that are still typed in the input without requiring Enter first.
- Render markdown preview paragraphs, lists, task lists, tables, strikethrough, and fenced code blocks reliably.

### Improved
- Restore the full default Custom Fields mapping for migrate and merge missing defaults into saved JSON.
- Polish markdown preview spacing and styles for lists, tables, blockquotes, and code blocks.
- Extend format checks to scripts, tests, manifest, and package metadata.


## [1.8.09] - 2026-07-05

> Enhanced security, stability, and connectivity for custom Redmine domains.

### Added
- Added support for custom Redmine domains via optional host permissions and dynamic content script registration.

### Fixed
- Re-injected custom Redmine content scripts into open tabs after extension updates.
- Isolated tab query and script injection errors to prevent service worker lifecycle interruptions.
- Injected custom Redmine content scripts into active tabs immediately after granting host permissions.
- Used isolated-world markers to prevent duplicate script injection and global variable redeclaration errors.
- Scoped request deduplication by sender origin to prevent cross-workspace request grouping.
- Rolled back domain and script registration when custom Redmine updates fail.
- Automatically synchronized dynamic content scripts when the extension is installed or updated.
- Normalized Redmine domains to origin format and revoked old permissions/scripts upon domain changes.
- Automatically sanitized legacy error logs on extension startup and update.
- Blocked invalid messages, non-extension senders, and oversized payloads before reaching privileged handlers.
- Prevented API keys and tokens from appearing in timeout errors and persistent error logs.
- Added host permissions for Groq and OpenRouter.
- Eliminated HTML injection vulnerabilities from model labels and settings error messages.
- Granted proper host permission for version check API requests.
- Filtered notification click events to handle only B2R update notifications and discarded invalid version responses.
- Prevented using stale Redmine issue cache when domain, summary, or settings change.

### Improved
- Deduplicated identical concurrent comment submission requests to prevent double-posting.
- Allowed normal re-submissions immediately after preceding requests complete.
- Removed obsolete privileged handlers `LIST_MODELS` and `TEST_MODEL`.
- Enforced required domain, API key, provider, and model validation before processing Options API messages.
- Moved Redmine project synchronization and AI model testing from the Options page to privileged background handlers.
- Restricted handlers accepting unsaved API keys strictly to extension Options senders.
- Shared version checking logic between the service worker and Options page.
- Added unit tests for version comparison and removed non-existent web-accessible resources.
- Restricted settings returned to content scripts strictly to required fields and verified origin before returning Redmine credentials.

### Docs
- Removed outdated references to Google Sheet Testcase Converter from repository documentation.
- Aligned Prettier and ESLint formatting configurations to eliminate build warning noise.


## [1.8.07] - 2026-05-20

### Added
- Integrated Google Sheet Testcase Converter to transform testcase formats.
- Added standalone page and floating sidebar button directly within Google Sheets.
- Enabled custom column mapping (A, B, C, D...) for flexible conversion.
- Added setup guide for OAuth2 Client ID creation and dynamic manifest snippet injection.

### Fixed
- Resolved ESLint warnings and whitelisted Google Sheets API and Testcase Converter global variables.


## [1.8.06] - 2026-05-11

### Added
- Added regular expressions to split notes in modal, improving parsing for batch notes.
- Added multi-select support for fallback models and keys in Options.
- Added management functions for provider models and encrypted API keys.

### Changed
- Updated options.html: replaced legacy model dropdown with new Gemini fallback configuration.
- Improved UX with dynamic UI updates based on selected providers and models.

### Refactored
- Refactored note handling logic in `openConfirmModal` to use the new parsing function.
- Enhanced options.js to support multi-select and render selected models and keys.


## [1.8.05] - 2026-05-08

### Removed
- Removed "Sync all comments to Backlog" feature due to display issues and obsolescence.


## [1.8.04] - 2024-05-24

### Added
- Added support for custom Generative Enhanced Models (GEM).
- Added dedicated configuration section for Custom GEM allowing custom endpoints and API keys.

### Fixed
- Fixed critical attachment handling bug in Issue Migration.
- Improved error logging for migration with full payload details.
- Fixed API key persistence preventing masked `******` values from being saved.

### Refactored
- Cleaned up and restructured background.js to eliminate redundant logic.

### Chore
- Resolved all ESLint errors and warnings.


## [1.8.03] - 2024-04-26

### Added
- Added Redmine → Backlog reverse sync flow.
- Added automatic attachment extraction and upload handling.
- Added batch comment sync with progress tracking.
- Added smart `@mentions` with user suggestion dropdown when typing `@`.
- Loaded project-specific users from `/api/v2/projects/{key}/users`.
- Lazy-loaded users only after a valid issue key is entered.

### Fixed
- Fixed `userId: null` issue that prevented tagging users.
- Fixed modal not rendering user suggestions when typing `@`.
- Fixed automatic user loading on incorrect project keys.
- Added null checks for user data.

### Changed
- Stopped automatic user loading when opening modal.
- Displayed clear hints when issue key is missing.
- Improved UX: only display dropdown when valid user data is present.

### Docs
- Updated README.md with guidance for Redmine → Backlog flow.


## [1.8.02] - 2024-04-23

### Improved
- Optimized `translateBatch` using `Promise.all` in batches of 5.
- Added cleanup handlers to prevent memory leaks.
- Restricted `MutationObserver` scope to target container.
- Added 5-minute project caching and 500ms debouncing.
- Added shared debounce and throttle utility functions.

### Fixed
- Fixed `reportProjectId` dropdown failing to populate data.
- Fixed status message disappearing after saving configuration.

### Changed
- Standardized code style from single quotes to double quotes.


## [1.8.01] - 2024-04-23

### Added
- Deployed robust AI model roster (Gemma 3/4, Gemini 3.1).
- Added load balancing mechanism with randomized model and key rotation.
- Added automatic Gemma detection to resolve HTTP 400 errors.

### Fixed
- Restored stable Redmine issue search logic.
- Fixed phantom model display bug and improved model selection UI.
- Fixed HTML syntax error on Options page.


## [1.8.00] - 2024-04-23

### Added
- Enhanced Options page with collapsible sections.
- Multiple clickable Gemini model buttons.
- Grouped multiple Gemini keys with models.
- Defaulted to first 5 models when no configuration is present.

### Changed
- Removed legacy model dropdown.
- Set fallback provider default to `none`.
- Removed Gemma 12B from model list.

### Improved
- Optimized margins and padding.
- Relocated Custom Fields into the Redmine section.
- Improved AI performance with caching layer.
- Optimized batch translation.
- Enhanced Redmine formatting in preview.
- Refactored AI service for Gemma models.
- Stabilized core AI model roster.

### Fixed
- Fixed default model loading logic when unconfigured.
- Cleaned up obsolete code.


## [1.7.02] - 2024-04-22

### Added
- Added `npm run bump` command to increment patch version automatically.
- Automatically created stub entry in CHANGELOG.md during bump.
- Added `check:version-sync` script to verify version synchronization.
- Added multiple Gemini models in Options.
- Updated Gemini model list to 2.5 series.
- Improved AI fallback handling for HTTP 503 errors.

### Changed
- Switched UI theme from red to cyan for Cyan-Flow design consistency.
- Fixed primary AI provider to Gemini.

### Fixed
- Prevented CI/CD risks from using stale version numbers.
- Added fail-fast checks in workflow.

### Docs
- Removed hardcoded versions from README.md.
- Updated `.skills/agent_workflow.md` and `DEVELOPMENT.md`.


## [1.7.01] - 2024-04-22

### Added
- Added `qwen/qwen3-32b` to Groq model list.

### Changed
- Curated Groq and Cerebras model rosters.
- Removed 8B models from dropdown.

### Fixed
- Corrected Cerebras Qwen model ID to `qwen-3-235b-a22b-instruct-2507`.


## [1.7.00] - 2024-04-22

### Added
- Added Groq as an option for both primary and fallback AI.
- Added multiple Gemini keys in Options page.
- Added preview toggle in modal.
- Added Groq API key inputs for primary and fallback providers.
- Added quick "+ Add Key" button for Gemini keys.

### Changed
- Adjusted migration form layout.
- Finalized Groq model dropdown.
- Updated Cerebras model list per latest documentation.

### Fixed
- Expanded configuration validation and settings loading flow.
- Improved attachment scanning logic.
- Relaxed normalization limit to 2 consecutive blank lines.


## [1.6.01] - 2024-04-21

### Added
- Added creator name and timestamp to comment records.
- Integrated Target Version field into Migration Modal.
- Added look-ahead media file bundling mechanism.
- Automatically discovered and aggregated attachments.

### Changed
- Designated Gemini as primary AI and Cerebras as fallback.
- Updated default models: Gemini 3.1 Flash Lite, Cerebras GPT OSS 120B.
- Defaulted Due Date to 3 business days ahead.
- Enabled automatic recognition of original Japanese text formats.

### Fixed
- Fixed missing "Saved" indicator when entering Cerebras API key.
- Fixed loss of blank lines in comments.
- Fixed ordered lists and blockquotes formatting.
- Ensured link paths are clickable.
- Resolved linting and parsing errors.
- Optimized global variable declarations.


## [1.6.00] - 2024-04-20

### Added
- Added blur backdrop and loading spinner during migration.
- Added Sync Projects button to refresh project list.

### Changed
- Automatically closed modal after clicking "View on Redmine".
- Localized and polished Logs section.
- Added attachment caching and deduplication.

### Fixed
- Fixed AI image formatting corruption.
- Improved flexibility of marker recognition.
- Fixed Due Date text overflow.


## [1.5.01] - 2024-04-19

### Fixed
- Fixed source code technical issues for cleaner codebase.


## [1.5.00] - 2024-04-19

### Added
- Clear configuration error notices with direct links to Options.
- Clicking extension icon opens Options page directly.

### Changed
- Renamed extension to B2R.


## [1.4.07] - 2024-04-19

### Added
- Automatic API key synchronization between providers.

### Changed
- Unified Redmine configuration section into a cohesive interface.
- Optimized display logic for Migrate Issue button.


## [1.4.06] - 2024-04-18

### Improved
- Migrated to OAuth2 Refresh Tokens to resolve Service Account quota limits.


## [1.4.05] - 2024-04-18

### Added
- Added support for video attachments (`.mp4`, `.mov`, `.webm`) and various file formats.
- Embedded video playback player.

### Changed
- Upgraded automated attachment scanning system.
- Restored and expanded API key acquisition guides.

### Fixed
- Fixed all linting errors.


## [1.4.04] - 2024-04-18

### Fixed
- Aligned build directory structure with Manifest specification.


## [1.4.03] - 2024-04-18

### Added
- Added Qwen 3 235B and GPT OSS 120B to Cerebras model list.

### Changed
- Set primary model default to Llama 3.1 8B.


## [1.4.02] - 2024-04-18

### Changed
- Switched default primary model to Llama 3.1 70B.
- Added AI rules to protect image tags and code blocks.

### Fixed
- Expanded access permissions and included session cookies.


## [1.4.01] - 2024-04-18

### Changed
- Set Llama 3.1 70B as primary model and Gemma 3 27B IT as fallback.
- Upgraded prompt and logic to preserve code blocks.

### Docs
- Rewrote concise changelog and updated README.


## [1.4.00] - 2024-04-18

### Added
- Added quick button to create Redmine issues directly from Backlog header.
- Independent primary and fallback AI provider selection with failover.

### Changed
- Modern Cyan-Flow interface.
- Service-based architecture refactoring.


## [1.3.00] - 2024-04-18

### Added
- Migrated all comments simultaneously.
- Automatically fetched Projects, Trackers, and Priorities from Redmine.


## [1.2.00] - 2024-04-17

### Added
- Established AI Agent skill system.

### Fixed
- Fixed blockquote display and username tag formatting.
- Resolved UI hover and modal styling issues.


## [1.1.00] - 2024-04-16

### Added
- Added model selector and improved Redmine issue search.

### Security
- Encrypted API keys in local storage.


## [1.0.01] - 2024-04-15

### Added
- Initial release: Japanese-to-Vietnamese translation and Backlog → Redmine synchronization.
