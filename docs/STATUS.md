# Current status

## Confirmed relationship amendments — 2026-11-14 KST

Implemented **Documents & relationships → Confirmed relationships → Edit or replace**. Edit the exact evidence or either endpoint, provide a reason and confirm. One transaction supersedes the original edge, creates a new confirmed edge/evidence and records the retry receipt. Relationship history exposes both generations, timestamps, reasons and original quotes. Saved item changes, path snapshots, review decisions and review events remain unchanged.

- `npm run verify`: **27/27 passed**; formatting, strict types, pinned skill integrity, official Relate context and production build passed.
- `npm run doctor`: passed. Both checkpoint and WAL restart tests now preserve replacement links, original evidence, historical reviews and idempotent replacement receipts.
- New native/API coverage: evidence-only edits, both endpoint replacements, manual confirmed candidates, chains, cycle termination, new versus historical impacts, repeated Unicode/CRLF quotes, no-op rejection, duplicate/proposed pairs, stale relation/endpoint revisions, request reuse, missing IDs, strict input/origin validation, history-inclusive cap and injected failure after all writes before the receipt (complete rollback).
- Browser production QA on **http://127.0.0.1:4319**, separate `relations-qa-*` store under `%LOCALAPPDATA%/Ripple`; original live store untouched. Applied A1 and saved a T1 review, replaced D1→A1 with D1→T3, selected repeated quote occurrence 2, then amended evidence to occurrence 1. Current A1 impact became D2/T2; saved A1 change retained D1/D2/T1/T2, original source and T1 review history. Reload and production-owner restart restored them. Desktop/390px editor, graph selection, panel navigation, prior/replacement source dialogs and deliberate network failure/draft retention/retry verified. No horizontal document overflow at 390px. Final reload console showed no warnings/errors. See [QA](QA.md).
- Browser feedback initially sat above the scrolled editor; feedback now scrolls into view and receives focus. Final production no-op rejection confirmed this behavior. Browser selector deadlines were resolved by inspecting current state and using accessible roles; those failed attempts are not passing checks.
- Initial focused test run: 4/5 passed, one fixture incorrectly included unknown fields in strict candidate input. Corrected the fixture; final gate above passed. The initial npm-exec invocation emitted flag warnings; final checks used repository scripts.
- `npm run ci:status`: committed HEAD `adf18e5` passed [its existing CI](https://github.com/piecemakerz/Ripple/actions/runs/43564667302), with **workingTreeDirty: true**. That run does not cover these uncommitted amendments. No commit or publication performed in this task.

Run with `npm run dev`, or `npm run build` then `npm start` after stopping any process owning the same DB/port. The QA production app remains available on port 4319. Limits: 200 dependency records including superseded history; no deletion/retirement without replacement; unsaved drafts do not survive reload; replacement confirmation immediately affects future impact queries and does not create an item-change review. Broader history filtering and real-document evaluation remain next work.

## Manual M2 slice — 2026-11-14 KST

Implemented document paste/UTF-8 Markdown or text upload → immutable source versions → evidenced manual items → proposed dependency → confirm/reject → generic change proposal → existing impact, apply and review flow.

- `npm run verify`: **21/21 tests**, format, strict types, pinned skills, official Relate preflight and production build passed. New tests cover source version conflicts/idempotency, exact Unicode/CRLF/repeated evidence, candidates versus confirmed impact, rejection/stale decisions, full imported-item change/review flow, rollback after evidence/item writes, additive schema migration, HTTP validation and ingestion limits.
- `npm run doctor`: passed; checkpoint and WAL restart regression tests now also preserve imported source versions, candidate decisions and mutation receipts.
- Browser: real production app on **http://127.0.0.1:4318** using a separate disposable `m2-qa-*` store under `%LOCALAPPDATA%/Ripple`. Original live `demo-v1` was not opened or modified. Paste, upload, repeated multiline quote choice, version-2 save with version-1 retained, candidate confirmation, 4→5 impacts, apply, review save/reload, production process restart and 390px panels verified. Deliberate network failures preserved both document and review input; retries passed. Temporary overrides removed. See [QA](QA.md).
- Browser inspection exposed overlapping graph cards after adding a third direct dependency. Dense levels now scroll horizontally; card titles have space for two lines and paths wrap. Stored paths and the affected-item list remain complete.
- Schema 2 adds idempotency receipts via an explicit additive migration; imported text/evidence remain immutable. No new dependencies or paid API calls.
- Published M2 implementation commit `5406668` to `main` on 2026-11-14 with a normal fast-forward push. [M2 Windows CI](https://github.com/piecemakerz/Ripple/actions/runs/43564558780) passed clean `npm ci`, `npm run verify` and `npm run doctor`; the connected GitHub plugin independently confirmed every job step succeeded. The initial exact-commit status query returned pending/no run; the repository runs API subsequently returned this successful push run with the matching full SHA. No live databases, credentials, machine-specific paths or build outputs were staged.
- Developer checks initially used an incorrect npm-exec formatter argument shape (printed formatted text instead of writing); corrected by `npm run format`. A browser navigation before server startup returned connection-refused, then succeeded after startup. These attempts are not counted as passing checks.

At the M2 handoff, next work included real-document evaluation, optional AI extraction, relationship amendments and fuller history UX. The amendments are now implemented above. Limits recorded at that handoff: no AI extraction, no hosted demo, no offline drafts, no confirmed-edge editor, ingestion caps (50 source versions / 100 items / 200 dependency records / 100 proposals), and dense-graph traversal runtime is not strictly bounded. Submission assets remain separate M4 work.

## Historical M0/M1 handoff

**2026-11-13 KST · M0/M1 published to GitHub; local and remote verification passed.**

## What exists

- Independent Ripple Git repository, connected to [piecemakerz/Ripple](https://github.com/piecemakerz/Ripple). The existing public repository's MIT license, initial commit and `relate-hackathon` topic are preserved. The original unrelated workspace is untouched.
- React 19.3.1 + TypeScript 7.0.2 + Vite 8.3.8, Express 5.3.0, native Relate 1.0.1. Exact dependencies and package-lock.json retained.
- Host: Windows x64, Node 22.17.1, npm 11.10.0, Git 2.53.0, Codex CLI 0.106.0.
- Real graph data, sources, evidence, changes, path snapshots, reviews and history stored in Relate.
- A1 returns D1/D2 directly and T1/T2 indirectly; T3 excluded. Each dependency exposes exact source evidence.
- Changes are atomic, revision-checked and idempotent. Review outcomes are per change and do not mark implementation complete.
- Three-panel UI, mobile panel tabs, source dialog/highlight, review history, error/retry and input preservation.
- Fonts/icons bundled locally; no paid AI calls or API keys.

## Run state at handoff

- Production server started with `npm start` on **http://127.0.0.1:4317** after a successful build. The local tab was retained for the user.
- Live DB: `%LOCALAPPDATA%\Ripple\demo-v1` (outside OneDrive). One backend owns it.
- Browser QA applied the sample once: A1 revision 2; four reviews; T1 = revise and T2 = defer, with reasons; D1/D2 remain pending. This is intentional persisted synthetic demo data.
- Development: `npm run dev` (refresh after client edits; restart after server edits). Stop the existing server before another uses the same DB/port.
- For a clean demo, use the new DB path recipe in README; preserve existing live data.

## Verification

- `npm run verify`: format, strict types, pinned skill integrity, version-matched Relate development preflight, **13/13 native DB/API/restart tests**, production build.
- `npm run doctor`: separate write/read processes restore graph, change, review history and rollback result.
- `npm run reproduce`: temporary source copy, clean npm ci, checks and doctor passed. Does not open the live DB.
- Browser: desktop, 390px mobile navigation, source quotes, apply, review save, refresh, deliberate request failure/input preservation/retry, production restart persistence. See `docs/QA.md` and `docs/evidence/`.
- GitHub Actions workflow runs install, verify and doctor on Windows for pushes and pull requests. [First published implementation run](https://github.com/piecemakerz/Ripple/actions/runs/43309102774) passed on commit `248d2f2`.

## Astra setup and its verified boundary

- `.codex/config.toml`: `gpt-6-astra`, high reasoning for this trusted project.
- `npm run ai`: explicit model/effort flags and context-loading prompt; no global settings or auth modified.
- `npm run ai:check` passed: official Relate package context/native read, Codex CLI 0.106.0, logged in using ChatGPT.
- A new Astra inference was **not** invoked in this setup. Configuring a file does not switch this existing desktop chat. Select Astra in the desktop model selector for subsequent work or use the launcher. Account/model access was not tested beyond the login check.
- `AGENTS.md`, `docs/AI_WORKFLOW.md`, `docs/PLAN.md` and `docs/ARCHITECTURE.md` carry context and acceptance gates.

## Resolved setup issues

1. Initially guessed `@relate/relate-win32-x64-msvc` returned npm 404. The official package is `@relate/relate-win32-x64`; it installed and ran.
2. npm generated an incomplete optional Linux lock entry without a version. Dependency editing raised `Invalid Version`. Removed that single invalid entry, regenerated the lock, and verified fresh `npm ci`.
3. Node 22.17.1 `fs.cpSync` on a directory in this OneDrive workspace caused native exit `0xC0000005`. The reproducibility helper now walks source directories and uses `copyFileSync`; clean-copy checks passed.
4. Narrow-screen aspect-ratio/min-height initially expanded the graph beyond its panel. Explicit canvas width and matching SVG scaling fixed clipping; inspected at 390px.

## Next task

### Hackathon audit — 2026-11-12

Official Devpost overview, updated Rules, schedule and Neo4j announcement were compared with the code and live API. Result: technically aligned M0/M1; submission readiness is incomplete. `npm run verify` (13/13) and `npm run doctor` passed again. See [the full audit](HACKATHON_AUDIT.md) and `docs/evidence/hackathon-*.txt`.

At the time of the audit, public source publication, inspectable submitted persistent store, demo/video, AI/tool disclosure, distribution notices and Devpost verification were outstanding. The overview's scoring weights differ from Rules' equal weighting; do not treat the earlier weighted rubric as settled. No application code/data, public hosting, account settings or submissions changed during that audit.

### GitHub setup — 2026-11-13

- User authorized publication to `https://github.com/piecemakerz/Ripple.git`. Read access and the existing credential's push/admin permissions were verified without printing credentials.
- Repository was already public, with `relate-hackathon` and MIT. Local source is based on its initial commit; no history replacement is needed.
- Added English setup, graph/storage explanation, screenshots, [AI disclosure](AI_DISCLOSURE.md) and [dependency inventory](../THIRD_PARTY.md). Actual Astra inference remains unverified.
- Personal PC paths were removed from the public handoff and two evidence logs. Original files are retained locally under ignored `.runtime/private-publish-backup/`; verification outcomes were not altered.
- Published implementation commit `248d2f2` to `main` with a normal fast-forward push. Repository remains public with `relate-hackathon`; its existing MIT license is unchanged. Added a concise About description.
- `npm run verify` passed locally (13/13 tests and production build). The first GitHub Actions run passed clean installation, verification and the separate-process persistence doctor. Documentation links resolve; the committed-file scan found no personal PC paths or common credential patterns. Active databases, credentials, dependencies and build outputs are excluded.
- Remaining submission work: inspectable separate sample store, demo/video, final distribution notice bundle if distributing built assets, and Devpost registration/submission. GitHub setup does not publish the running application or submit the hackathon entry.

### Official resource alignment — 2026-11-13

- Read all four organizer-linked resources: Relate website, installation guide, source repository and Relate Ideas. Compared the installed Node skill/types and version-tagged API specification with the existing implementation. See [the comparison and decisions](RELATE_RESOURCES.md).
- Confirmed `@relate/relate` and the latest published release were 1.0.1 at review time; retained the tested pin despite newer examples on upstream `main`.
- Added `npm run relate:context` to verify package version, bundled official Node skill, TypeScript definitions and a native parameterized in-memory read. AGENTS instructions and the Astra launcher explicitly load those references. No global/CLI skill installation, persistent DB access or model invocation was performed.
- `npm run relate:context`, `npm run ai:check` and `npm run verify` passed locally; all 13 database/API/restart tests passed. The same preflight now runs inside GitHub Actions through `verify`; per-commit results are available in [Actions](https://github.com/piecemakerz/Ripple/actions/workflows/verify.yml).
- Application behavior, UI and live data were unchanged; browser interaction checks were not repeated for this development-tooling/documentation change.

M0/M1's authorized implementation is complete. Next product slice: **M2: paste/upload Markdown or text → immutable SourceVersion → manual candidate/evidence validation**. Add AI extraction after provider/budget decisions; proposed relationships must remain separate from confirmed ones.

### AI skills and tooling — 2026-11-13

- Installed four project-scoped skills: `relate`, `vercel-react-best-practices`, `web-design-guidelines`, `ripple-verify`. Upstream snapshots are pinned and checked by `.agents/skills-lock.json`; no global skill/config or model selection was changed. See [AI_TOOLING.md](AI_TOOLING.md).
- Codex CLI 0.106.0 app-server `skills/list` discovered all four with `scope: repo`, `enabled: true`, and zero loader errors. Only initialization and skill listing were invoked; no chat, inference or extra agent was started.
- All four skills passed the bundled skill validator. The first Relate validation hit Windows' cp949 decoding default; rerunning with `python -X utf8` passed. Its installed content matches the npm package after line-ending normalization.
- `npm run ai:doctor`, `npm run ai:check`, `npm run verify` and `npm run reproduce` passed. The clean temporary checkout installed dependencies, verified the skill snapshots, passed 13 tests/build and the separate-process DB doctor.
- Added `npm run ci:status` for the exact committed HEAD. Confirmed green-run reporting with dirty-worktree disclosure, and pending/no-run reporting for an unpublished commit. [Tooling commit CI](https://github.com/piecemakerz/Ripple/actions/runs/43314504326) passed clean installation, verify and doctor on `e6040c1`; the plugin independently confirmed all job steps.
- GitHub plugin installation and account connection completed during setup. Its tools confirmed the `piecemakerz` identity, access to Ripple and successful CI inspection. Existing Git publication/public CI fallback also work. The already available browser tools and OpenAI Docs skill were retained.
- Application behavior/UI and live data were unchanged. No browser regression or new Astra inference is claimed for this tooling setup.

At the M0/M1 handoff, generic ingestion was still outside implementation; the manual M2 slice above now supplies it. Confirmed relationship amendments are now implemented above. AI extraction, collaboration, large graph layout, public sample DB export, hosted demo and submission assets remain outside implementation. No benchmark claims on real customer data.
