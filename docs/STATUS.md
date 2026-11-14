# Current status

## Bounded change loading — 2026-11-14 KST

Implemented a 25-entry saved-change selector with Older/Newer/Refresh navigation and on-demand historical detail. Workspace bootstrap and the new `GET /api/changes` endpoint project scalar metadata from native Relate instead of transferring every saved snapshot. Selection, original evidence, per-change review history and unsaved review input survive list navigation; local retry and detail Reload preserve the intended change. No database schema, historical records, dependencies or model calls changed.

- `npm run verify`: **34/34 tests passed**, formatting, strict types, pinned skills, official native Relate preflight and production build passed. Three new native/API tests cover 55 real snapshots, bounded metadata response, snapshot-decoding isolation, old detail/evidence/reviews, equal-timestamp pagination, newer insert stability, empty pages, malformed/repeated query parameters and cursor/page bounds. Existing tests and process-worker assertions now use the summary contract.
- `npm run doctor`: **passed**. Both checkpoint and WAL process tests also restore the bootstrap summary and load its full historical change/reviews separately. All automated DB checks use temporary stores.
- Production browser acceptance: **http://127.0.0.1:4321**, separate `change-pages-qa-*` store under `%LOCALAPPDATA%/Ripple`; original live store untouched. Applied A1 through the UI, inspected four impacts and exact evidence, saved T1 review, then added 54 synthetic changes through the QA owner's HTTP API. Pages held 25 + 25 + 5 records. Old revision 2 remained selectable after page changes and History navigation. Deliberate list-read, detail-read and review-save failures retained selection/input and retried successfully.
- Final production-owner restart and browser reload restored all 55 changes, original four impacts and T1's two decisions. Actual 1440px desktop and 390×844 mobile selector/panels/graph/source dialog inspected; document width stayed within the viewport. Final console warnings/errors were empty; temporary network blocks and viewport override removed. The QA app and tab remain available. See [QA](QA.md) and [desktop](evidence/change-pages-desktop.jpg) / [mobile](evidence/change-pages-mobile.jpg) captures.
- Controlled 55-change payload measurement: workspace **6,950 bytes**, equivalent old all-snapshot workspace **459,491 bytes** (98.5% reduction); first 25 summaries **3,605 bytes**. Browser network trace showed one workspace and one selected-change detail request on reload. This is a synthetic bootstrap-size measurement, not a latency or real-user benchmark.
- Initial full gate stopped on a formatter mismatch after a final JSX text edit. Formatted that file; the repeated full gate passed above. No failed check is counted as passing.
- Published implementation commit `599b715` to `main` on 2026-11-14 with a normal fast-forward push. Its [Windows CI](https://github.com/piecemakerz/Ripple/actions/runs/43571382799) passed clean `npm ci`, `npm run verify` and `npm run doctor`. The connected GitHub plugin confirmed every job step succeeded; `npm run ci:status` matched the full implementation SHA and reported `workingTreeDirty: false`. Source, tests, documentation and two browser captures were included; active stores, credentials and build outputs were excluded. Staged-file personal-path/credential-pattern scan, formatting and diff checks passed.
- At the local handoff, only prior HEAD `44699f6` had passing CI with a dirty worktree; that result was not used to validate this implementation. The new implementation run was initially pending, then passed above. Application code was unchanged during publication, so the existing 34-test local gate and desktop/390px browser evidence remain applicable.

Run with `npm run dev`, or stop the same DB/port owner before `npm run build` and `npm start`. Client and server must be updated together because workspace now returns `changePage` instead of `changes`. Limits: browser reload resets selection/pages; a selected change still includes its full snapshot and review history; engine scan/sort and dense traversal costs are not bounded by the page size. Next: real-document evaluation, then separately scoped scalability work based on measured need.

## Searchable item history — 2026-11-14 KST

Implemented **History** with item, event type, historical review decision, text and inclusive local-date filters. Applied changes, every saved review event and relationship replacement generations share a newest-first timeline with 25-event pages. Item chips and the review panel's **View item history** shortcut narrow the scope. Cards expose before/after changes, preserved source evidence, replacement endpoints/reasons and navigation to the correct saved change/review. Read-only queries use the existing native Relate owner; schema and saved records are unchanged.

- `npm run verify`: **31/31 passed**, including formatting, strict types, pinned skills, official native Relate context and production build. Four new native/API tests cover zero-impact changes, original impact membership after replacement, historical versus current decisions, no-op review deduplication, both replacement generations/endpoints, Unicode/literal search, unknown items, half-open date bounds, equal-timestamp keyset pagination, newer insert stability, malformed filters/cursors and page limits. Existing checkpoint/WAL process tests now also query restored history.
- `npm run doctor`: passed separate-process write/read restoration, including filtered change/review/replacement history. Tests use temporary stores.
- Production browser QA: **http://127.0.0.1:4320**, separate `history-qa-*` store under `%LOCALAPPDATA%/Ripple`. Original live store untouched. Applied A1, saved T1 revise then defer, replaced D1→A1 with D1→T3, and opened both exact evidence quotes. Queried old/new endpoint membership, past Revise + uppercase text, item chips, same-day/excluding-day filters and no-result/reset states. 28 real events paged as 25 + 3 with previous navigation. Deliberate history-read and review-save network failures preserved filters/reason and retried successfully. Returning from a past decision opened the correct saved change/T1, latest decision and four original impacts.
- Final production-owner restart and reload restored all 28 events, T1's 26 decisions, replacement and original snapshots. Current A1 preview still returned D2/T2; saved change still returned D1/D2/T1/T2. Actual 1440px desktop and 390×844 layouts, narrow source dialog, mobile panel navigation and impact selection inspected; document width stayed within the viewport. Final fresh-load console: no warnings/errors. Network blocks and viewport override removed. Captures and detailed record: [QA](QA.md).
- Initial new native tests passed 3/3, but typecheck found a missing JSX closing button tag; corrected before the full gate. Final code review added full displayed event-ID search (including its prefix) and impacted-item title search, covered by native regression assertions and another full gate. Browser selector deadlines and date-fill tool limitations were resolved from fresh DOM/AX state using accessible roles and native date-field input. Early zoom-scaled captures were not counted as 390px evidence; final dimensions were explicitly checked.
- Final API restart smoke: 28 events restored; full displayed record-ID and impacted-title searches each returned the expected single event. UI bundle remained the browser-verified version. See QA for the scoped restart recovery after a combined command was rejected by tool policy.
- Published implementation commit `b3b024a` to `main` on 2026-11-14 with a normal fast-forward push. Its [Windows CI](https://github.com/piecemakerz/Ripple/actions/runs/43569990838) passed clean `npm ci`, `npm run verify` and `npm run doctor`. The connected GitHub plugin confirmed all job steps succeeded; `npm run ci:status` matched the full implementation SHA and reported `workingTreeDirty: false`. Source, tests, documentation and three browser captures were included; active databases, credentials and build artifacts were excluded. The staged-file personal-path/credential-pattern scan and final formatter/diff checks passed.
- At the earlier local handoff, only prior HEAD `9625202` had green CI with a dirty worktree. That earlier result was not used as proof for this implementation. The first new-commit status was pending, then completed successfully above. The plugin rejected its workflow-list URL; the exact-SHA repository status command identified the run, and the plugin's supported job/step tools confirmed it. No application code changed during publication, so the 31-test local gate and desktop/390px browser evidence remain applicable.

Run with `npm run dev`, or stop the owner of the same DB/port before `npm run build` and `npm start`. The separate QA app remains on port 4320. Limits: filters reset on reload; no source-content search, export or pending-review queue; engine scan time and the existing workspace's full change-snapshot bootstrap remain unbounded by the history page size. Next: real-document evaluation and a separate scalability slice if needed.

## Confirmed relationship amendments — 2026-11-14 KST

Implemented **Documents & relationships → Confirmed relationships → Edit or replace**. Edit the exact evidence or either endpoint, provide a reason and confirm. One transaction supersedes the original edge, creates a new confirmed edge/evidence and records the retry receipt. Relationship history exposes both generations, timestamps, reasons and original quotes. Saved item changes, path snapshots, review decisions and review events remain unchanged.

- `npm run verify`: **27/27 passed**; formatting, strict types, pinned skill integrity, official Relate context and production build passed.
- `npm run doctor`: passed. Both checkpoint and WAL restart tests now preserve replacement links, original evidence, historical reviews and idempotent replacement receipts.
- New native/API coverage: evidence-only edits, both endpoint replacements, manual confirmed candidates, chains, cycle termination, new versus historical impacts, repeated Unicode/CRLF quotes, no-op rejection, duplicate/proposed pairs, stale relation/endpoint revisions, request reuse, missing IDs, strict input/origin validation, history-inclusive cap and injected failure after all writes before the receipt (complete rollback).
- Browser production QA on **http://127.0.0.1:4319**, separate `relations-qa-*` store under `%LOCALAPPDATA%/Ripple`; original live store untouched. Applied A1 and saved a T1 review, replaced D1→A1 with D1→T3, selected repeated quote occurrence 2, then amended evidence to occurrence 1. Current A1 impact became D2/T2; saved A1 change retained D1/D2/T1/T2, original source and T1 review history. Reload and production-owner restart restored them. Desktop/390px editor, graph selection, panel navigation, prior/replacement source dialogs and deliberate network failure/draft retention/retry verified. No horizontal document overflow at 390px. Final reload console showed no warnings/errors. See [QA](QA.md).
- Browser feedback initially sat above the scrolled editor; feedback now scrolls into view and receives focus. Final production no-op rejection confirmed this behavior. Browser selector deadlines were resolved by inspecting current state and using accessible roles; those failed attempts are not passing checks.
- Initial focused test run: 4/5 passed, one fixture incorrectly included unknown fields in strict candidate input. Corrected the fixture; final gate above passed. The initial npm-exec invocation emitted flag warnings; final checks used repository scripts.
- Published implementation commit `5884ce1` to `main` on 2026-11-14 with a normal fast-forward push. [Windows CI](https://github.com/piecemakerz/Ripple/actions/runs/43567611564) passed clean `npm ci`, `npm run verify` and `npm run doctor`; the connected GitHub plugin confirmed every job step succeeded. `npm run ci:status` matched the full implementation SHA and reported `workingTreeDirty: false`. Local verify (27 tests/build) and doctor passed again before publication. Source, tests, documentation and browser captures were included; live databases, build artifacts and credentials were excluded.

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
