---
name: ripple-verify
description: 'Validate a Ripple feature or bug fix with the real database, relevant browser checks, and CI evidence. Use before handing off consequential code changes or when diagnosing a failed check.'
---

# Ripple verification

Work from the repository root. Read `AGENTS.md` and `docs/STATUS.md`; use `docs/QA.md` for the existing acceptance flow. This skill does not authorize a new milestone, model call, deployment or external message.

## Choose evidence for the change

- Run `npm run verify` for consequential code changes. It includes skill integrity, native Relate context, strict types, real-DB tests and a production build. For a documentation-only edit, use the formatter and check affected links; do not add unrelated tests.
- For storage, transaction or engine changes, run `npm run doctor` as well. Use disposable databases. A failed write must preserve item revision, change/review records and evidence together; a successful restart must preserve them together.
- For UI changes, use the available browser tool and the desktop/390px flow in `docs/QA.md`. A fresh demo uses a new database path outside OneDrive and a separate free loopback port. Never start a second owner for the live DB. Inspect the actual screen, not just the DOM: the mobile graph once overflowed its panel despite no document overflow.
- Review decisions are scoped to a change. Check failed-save input preservation and reload persistence when editing that flow. Keep/revise/defer describes a decision, not completed implementation.

## Published changes and failures

`npm run ci:status` reads GitHub Actions for the exact local HEAD without a token. It returns 0 for successful Verify Ripple, 2 for pending/no run, and 1 for failure or a request error. A dirty working tree is reported separately: an older green commit does not validate uncommitted edits. Recheck a pending run in this chat without creating an automation.

Prefer the connected GitHub plugin for deeper CI or PR inspection when available; otherwise use the existing Git/API access. Inspect the failed step and relevant logs before editing. Routine fixes within the authorized task can proceed without asking for the same approval again. Publishing, PR comments and external messages still require authorization in the user's task; this skill grants none by itself.

Record the commands and observed results in `docs/STATUS.md`, update the short plan and relevant design decisions, and report remaining limits. Do not describe an unavailable browser/plugin/model check as passed. Reuse passing evidence until a new change or unresolved concern justifies another run.
