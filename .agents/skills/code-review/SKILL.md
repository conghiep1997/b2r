---
name: code-review
description: Focused review guidance for Backlog2Redmine changes, emphasizing changed files, extension architecture,
  security, and project rules.
---

# code-review

## When to use
- Use for requested code/guidance reviews or when a substantive change needs a focused review; do not force this workflow for every small edit.
- Reviewing a PR, diff, refactor, or generated change.
- Validating edits against `AGENTS.md`, relevant skills, source patterns, and security constraints.

## Rules
- Start with `git status --short`; include staged and unstaged diffs (`git diff HEAD`) and relevant untracked files unless the user supplied a different review base.
- Load `AGENTS.md` and only the skill files relevant to changed areas.
- If `.rules/` exists, load only relevant rule files.
- Avoid full repo scans unless changed files reveal a cross-cutting risk.
- Report bugs, regressions, architecture violations, forbidden patterns, and missing validation first.
- Do not rewrite unrelated files during review.
- Check for plaintext secrets, unsafe logging, widened permissions, and insecure DOM injection.
- Validate against module boundaries: background for privileged work, content scripts for DOM, services for APIs, utils for shared helpers.

## Validation
- Changed files follow existing naming, globals, formatting, and module patterns.
- Manifest load order and permissions still match code needs.
- Storage schema changes remain backward compatible or clearly migrated.
- API keys and credentials remain encrypted/masked and are not logged.
- Existing npm validation commands relevant to the change are identified or run.
- Findings include file/line references when reporting issues.
