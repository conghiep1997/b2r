# Review implementation tracker

## Sandbox and dynamic rules follow-up

Prepared `sandbox/redmine/compose.yaml`, an idempotent local secret generator,
and Vietnamese setup/live-test instructions for the user-provided HIPE_B2R
project. Docker Compose validates without starting containers or pulling images.
Generated secret files are ignored by Git. Runtime/live API tests remain pending
until the user runs the sandbox and supplies workspace URL and test boundaries.

Advanced Options now offers migration title templates, literal bilingual title
separators, key/title search modes, destination project restrictions and tracker
aliases. Existing issue mappings remain the first choice. Custom Fields moved
into the collapsed advanced section immediately before Save settings. Saved
explicit field IDs are preserved; instance-specific fallback IDs are no longer
injected into a new Redmine configuration. Lookup no longer accepts unrelated
results based solely on tracker preference.

Follow-up validation: 105 unit tests and 15 Playwright tests pass; build includes
lint, format and version synchronization at the existing user version 1.8.18.
`Backlog2Redmine-v1.8.18.zip` was generated locally. Docker runtime and real
Backlog/Redmine writes have not been exercised or started in this follow-up.

The checklist and verification below describe the preceding implementation at
version 1.8.17; the follow-up counts above supersede its totals.

Scope: implement all fixes, architecture improvements, validation improvements,
and four proposed features from the source review. This checklist remains open
until each requirement has implementation and verification evidence.

## Reliability fixes

- [x] Serialize installation ID creation in the background and coalesce key derivation.
  Regression tests cover concurrent first saves, separate Options contexts,
  restart, existing installation IDs, and unique IVs.
- [x] Return per-file reverse-sync outcomes, record partial success, and warn users
  without encouraging duplicate comment submission.
- [x] Catch synchronous message handler exceptions; regression test added.
- [x] Use timeoutFetch for Backlog and Redmine service requests.
- [x] Fix reported Prettier failures. Full build passed after these changes.
- [x] Verify timeout behavior, including stalled response bodies and attachment budgets.
- [x] Verify attachment warnings in the browser and extend partial-failure coverage.

## Recovery and synchronization

- [x] Persist encrypted migration checkpoints with destination issue IDs,
  completed comments and attachment state.
- [x] Resume failed/interrupted work without creating another destination issue.
- [x] Handle ambiguous remote write outcomes through reconciliation rather than
  blind retries; test interruption after remote success and before local persistence.
- [x] Persist workspace-scoped Backlog/Redmine mappings and expose management UI.
- [x] Persist comment synchronization records to prevent duplicates after reload.
- [x] Validate mapping targets and isolate records across configured workspaces.

## Migration preview

- [x] Allow selecting individual comments and files before migration.
- [x] Show translated content, destination fields, counts and file selections.
- [x] Carry selections into actual requests and preserve them during recovery.

## Project glossary

- [x] Configure per-project terminology and phrases that must remain unchanged.
- [x] Store glossary using existing encrypted settings flows.
- [x] Apply it consistently to description, subject and comment translation.
- [x] Validate terminology input and test project isolation and prompt construction.

## Architecture and validation

- [x] Extract Options provider controls, settings persistence, domain registration
  and onboarding into focused modules with existing behavior preserved.
- [x] Document encryption's storage-compromise limitations in user-facing help
  in both English and Vietnamese.
- [x] Add a real unpacked-extension smoke test for worker messaging, permissions
  and content script registration, alongside existing mocked UI tests.
- [x] Run unit, mocked E2E, real-extension smoke, lint, format, version-sync,
  full build and ZIP checks after all changes.
- [x] Review final changes for credential exposure, compatibility and localization.

## Final verification

All checklist items are implemented.

- 99 unit tests pass, including protected glossary terms, prompt boundaries,
  project/workspace isolation, AI fallback, attachment URL restrictions,
  durable reconciliation, encryption races and request cancellation.
- 14 Playwright tests pass: 13 mocked UI cases plus a real unpacked MV3
  extension smoke. The real worker confirms encrypted glossary persistence,
  project isolation, permissions, messaging and dynamic registration.
- npm run lint, format:check, check:version-sync and build pass.
- npm run build:zip passes; Backlog2Redmine-v1.8.17.zip contains 63 entries
  with required modules and both locale catalogs; no tests or dependencies.
- git diff --check passes. Versions remain synchronized at 1.8.17.

Options now delegates provider controls, settings persistence, domain registration
and onboarding to four explicit factories. Existing browser tests exercise saved
keys, project cache invalidation, verification state, locales and recovery UI.
Glossary configuration is encrypted using the same installation codec, scoped
to the configured workspace and project, and applied to subjects, descriptions
and comments, including provider fallback. Keep-unchanged phrases are protected
with temporary tokens and checked before displaying translation success.

Final review preserved MV3 permissions and script order, private Options-only
endpoints, encrypted credentials/checkpoints, safe DOM rendering and credential
redaction. Redmine attachment downloads now restrict origin/path and reject
redirects before sending authenticated requests.

Validation uses fixtures and mocked APIs. No real Backlog/Redmine writes,
commits, releases or publishing were performed. AI terminology quality depends
on the provider; protected phrases have deterministic restoration checks.

## Review fixes — 1.8.18

## Generalization stages

1. Translation languages and independent reverse modes: implemented. Defaults remain
   auto-detect → Vietnamese and Japanese extraction. Reverse original mode does not
   require an AI call. All providers and glossary wrappers retain the selected system
   instruction and attribution label. Options persists the choices independently of UI locale.
   Review found and fixed the legacy Vietnamese system instruction and VN collapse label
   overriding non-Vietnamese requests. Unit tests cover every provider, validation,
   glossary behavior and original mode; browser tests cover persistence and worker loading.
2. Configurable log-time hours, allocation and API-backed activities: implemented.
   Daily hours default to 8, with equal or estimate-based quarter-hour allocation.
   Activities are fetched from Redmine and validated before writes; missing legacy
   activity names stop the operation instead of falling back to fixed IDs. Preview
   stores the plan and rejects changed hours, allocation or activities before writing.
   Review removed stale 8h UI wording and duplicate task fetching. Tests cover allocation,
   preview/write totals, stale plans, invalid activities, Options persistence and MV3 loading.
3. Profiles per Backlog/Redmine project pair: implemented and reviewed. Encrypted
   profiles are scoped to both origins and resolved by Backlog project key for translation,
   lookup and migration UI. Reverse/report flows resolve the issue's project or explicit
   mapping; only relevant conflicting policies block the operation. Duplicate source
   profiles and credential overrides are rejected. Searches stay in the profile destination.
   Gate passed: 129 unit tests, 19 browser tests, lint and full build.
4. Friendly mapping editor and configuration validation: implemented. Row editors support
   arbitrary trackers, custom fields and due-date rules. Profiles inherit global defaults
   or retain independent overrides, including a separate report project. Validation runs
   before saving; migration metadata ignores stale responses and custom-field payloads
   use numeric IDs with exact select values.

Stages 1–2 gate passed: 126 unit tests, 18 browser tests (including unpacked MV3),
lint without warnings, formatting, version synchronization, build, ZIP and diff checks.
The overall generalization task remains active; stages 3–4 have not been implemented.

Stage gate: finish implementation, review runtime paths, run meaningful tests and
resolve findings before starting the next stage. Live provider quality and live
Backlog/Redmine writes remain outside the automated fixture checks.

## Review fixes detail — 1.8.18

- Exact source-key matching rejects prefix collisions and ambiguous destinations.
- Source-specific attachment names preserve distinct files with identical original names.
- Confirmed failures accept corrected pending payloads; completed work remains immutable.
- Saved mappings support reverse sync and recovery for keyless destination titles.
- Glossary loading, editing and clearing guard against accidental replacement.
- Domain registration failure restores the complete encrypted settings snapshot.
- Per-operation locks allow unrelated work to proceed; completed checkpoints are compacted
  and workspace-prefixed storage avoids decrypting unrelated new records.
- Follow-up fixes preserve manual mappings, paginate API search results, and migrate
  legacy storage keys without deleting data before a successful replacement write.
- Validation: 118 unit tests, 17 browser tests, lint, formatting, version synchronization
  and build pass. Browser coverage includes glossary cancellation, keyless reverse mapping
  and an unpacked MV3 smoke. No live API writes or Docker services were started.

## Options polish

- Sandbox defaults to localhost port 13001 without requiring an env file.
- Unsaved model lists default to all selected; saved subsets remain unchanged.
- Glossary and recovery use shared cards, summaries and button styles.
- Project refresh and unpacked-extension update controls remain available.
