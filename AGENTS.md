# Ripple — persistent project instructions

## Goal and context

Build a local single-user change-impact workbench using real Relate. Speak Korean with the user; keep product UI English. Read `docs/STATUS.md`, `docs/PLAN.md`, and `docs/ARCHITECTURE.md` at the start of substantive work. The original requirements are in `docs/RIPPLE_HANDOFF.md`.

## AI-driven development

- The requested development model is GPT-6 Astra (`gpt-6-astra`), high reasoning. The project config and `npm run ai` launcher express that choice. Do not claim a running chat changed models because a file changed. Do not substitute another model silently.
- Own an end-to-end vertical slice: inspect → implement → run relevant checks → inspect the actual screen → update evidence and next steps. Setup alone is not completion.
- Continue routine, reversible work within the user's scope without repeated permission questions. Ask only for material missing product decisions or external/destructive actions not already authorized.
- Keep a short execution plan in `docs/PLAN.md`; maintain decisions and known limits in `docs/ARCHITECTURE.md`, and verified commands/results/next task in `docs/STATUS.md`. Record failures honestly; never turn an attempted check into a passed check.
- Do not launch additional agents or paid AI API calls unless requested. The app's sample mode needs no model API key.

## Invariants

- `downstream -[:DEPENDS_ON]-> upstream`. Query confirmed relations in Relate to calculate impacts. Never replace the database with a JSON/mock implementation.
- Preserve immutable source versions and exact evidence quotes. Character offsets use JavaScript UTF-16 code units, end-exclusive.
- Snapshot paths before changing an item. Change, reviews and revision update commit atomically. Requests are idempotent and revision-checked.
- Deduplicate impacted items, terminate cycles, exclude the changed item, and explicitly disclose traversal/result limits.
- Reviews are per change. Keep/revise/defer records a decision, not completion of implementation. Preserve review history.
- One backend process owns a database; mutations are serialized. Never open the user's live DB from a second process. Use temporary databases in tests.
- Preserve unrelated files. No secrets, active databases, generated artifacts or machine-specific paths in Git. Use `%LOCALAPPDATA%/Ripple` for the live DB by default, outside OneDrive.

## Implementation and acceptance

- TypeScript strict mode; React + Vite client; small Node API; parameterized Relate adapter. Keep domain/API/UI responsibilities separate.
- Pin dependencies and retain package-lock.json. Validate all write input on the server. Bind only to loopback for this local MVP.
- `npm run verify` is the completion gate (types, real-DB integration tests, production build). Add tests for changed behavior and consequential edge cases, not implementation mirrors.
- UI work additionally needs a browser check of change preview/apply, impact selection, evidence, review persistence and a narrow viewport. Record any unavailable checks.
- M0: real database write/query/transaction rollback/reopen in a separate process. M1: exactly D1/D2/T1/T2 impacted by A1; exclude T3; show paths and original evidence.
- Report what works, how to run it, actual verification, and remaining limitations. Keep README commands executable.
