# Current status

**2026-11-13 KST · M0/M1 implemented and verified; GitHub publication in progress.**

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

- `npm run verify`: format, strict types, **13/13 native DB/API/restart tests**, production build.
- `npm run doctor`: separate write/read processes restore graph, change, review history and rollback result.
- `npm run reproduce`: temporary source copy, clean npm ci, checks and doctor passed. Does not open the live DB.
- Browser: desktop, 390px mobile navigation, source quotes, apply, review save, refresh, deliberate request failure/input preservation/retry, production restart persistence. See `docs/QA.md` and `docs/evidence/`.
- GitHub Actions workflow runs install, verify and doctor on Windows for pushes and pull requests. First remote run is pending publication.

## Astra setup and its verified boundary

- `.codex/config.toml`: `gpt-6-astra`, high reasoning for this trusted project.
- `npm run ai`: explicit model/effort flags and context-loading prompt; no global settings or auth modified.
- `npm run ai:check` passed: Codex CLI 0.106.0, logged in using ChatGPT.
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
- Publication and the first remote CI result are pending. Active databases, credentials, dependencies and build outputs are excluded from the commit.
- Remaining submission work: inspectable separate sample store, demo/video, final distribution notice bundle if distributing built assets, and Devpost registration/submission. GitHub setup does not publish the running application or submit the hackathon entry.

M0/M1's authorized implementation is complete. Next product slice: **M2: paste/upload Markdown or text → immutable SourceVersion → manual candidate/evidence validation**. Add AI extraction after provider/budget decisions; proposed relationships must remain separate from confirmed ones.

Still outside this implementation: generic ingestion, AI extraction, relationship editor, collaboration, large graph layout, public sample DB export, hosted demo and submission assets. No benchmark claims on real customer data.
