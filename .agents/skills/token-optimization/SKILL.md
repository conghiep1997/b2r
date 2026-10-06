---
name: token-optimization
description: Focused context-management guidance for working efficiently in this repository without loading unnecessary
  files or generated outputs.
---

# token-optimization

## When to use
- At the start of broad analysis, reviews, refactors, or unfamiliar tasks.
- Before opening multiple large files or scanning the whole repository.
- When the user asks to optimize agent context or project guidance.

## Rules
- Search before opening files; prefer `rg` and targeted globs.
- Open only files directly relevant to the current task.
- Do not load all skills; read `AGENTS.md`, then only routed skill files.
- Prefer changed-file analysis with `git status --short` and diffs.
- Avoid reading generated/heavy outputs: `node_modules/`, `dist/`, `Backlog2Redmine-v*.zip`.
- Summarize findings before broad edits.
- Expand scope only when a dependency, caller, or validation path requires it.

## Validation
- The task started from targeted search or changed-file inspection.
- Only relevant skill files were loaded.
- Generated/build outputs were skipped unless explicitly needed.
- Broad repo scans were justified by a concrete risk or unknown.
- Findings were summarized before large changes.
