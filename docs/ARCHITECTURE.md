# Architecture and decisions

2026-11-14 KST · M0/M1 + manual M2 ingestion + confirmed relationship amendments

## Boundaries

`React UI → same-origin Express API → synchronous domain/store service → native Relate → WAL + Parquet`.

- `src/`: interaction state and rendering. Impact targets are never hardcoded in the client.
- `shared/types.ts`: response types, graph/evidence/change/review contracts.
- `server/app.ts`: HTTP validation, local Host/Origin checks, errors.
- `server/store.ts`: parameterized Cypher, graph traversal, atomic changes, immutable snapshots, reviews.
- `server/ingestion.ts`: validated source versions, evidenced items, dependency candidates, confirmation and generic proposals; all mutations share the store's serialized transaction owner.
- `server/sample.ts`: clearly synthetic source versions and expected seed graph; not runtime AI output.
- `scripts/doctor.ts` and `tests/`: disposable DB verification, never a second owner for the live DB.

## Decisions

1. **Current workspace wins over the old handoff path.** Ripple was initialized in its own empty workspace. The older unrelated repository remains untouched. The public handoff preserves the original requirements with personal PC paths anonymized; the untouched original remains local.
2. **Native Node binding, pinned 1.0.1.** The official npm package and `@relate/relate-win32-x64` ran successfully on this Windows x64 host. No Python fallback, fake DB, external Neo4j service or Rust build was needed.
3. **Single synchronous owner.** Each HTTP handler completes all database calls without `await`. A transaction cannot overlap another handler. An asynchronous store implementation must add an explicit queue covering reads as well as the entire write transaction. Scaling beyond local single-user is not supported.
4. **Data outside OneDrive.** Default storage is LocalAppData/Ripple/demo-v1. Source may remain in OneDrive; the active DB should not. Path override is server-only.
5. **Bounded Cypher paths.** `MATCH p=(dependent)-[:DEPENDS_ON*1..8]->(target)` filters every relationship to confirmed and every path to unique nodes. It excludes the target itself. Native DB paths are grouped by dependent item; all returned paths are retained. A 501st row detects the 500-path cap. A path at depth 8 conservatively indicates possible truncation. Incomplete/missing-evidence previews cannot be applied.
6. **Immutable evidence contract.** SourceVersion is identified by ID/version and SHA-256 of UTF-8 text. Evidence offsets are UTF-16 code units, start-inclusive/end-exclusive; exact slice and hash are checked. The public API has no source-mutation endpoint. Fault-injection tests intentionally corrupt DB data to verify detection. Items and dependencies have distinct evidence links/IDs.
7. **Changes are atomic and idempotent.** UUID requestId + payload fingerprint detects reuse. Within one explicit transaction, lookup prior request, check revision, validate evidence, query the old graph, save Change and Review snapshots, then update body/revision. A failure rolls the whole write back. No automatic retry on a conflicting revision.
8. **Historical context stays readable.** Change stores the pre-change ImpactResult (including immutable source text) as a JSON-serialized Relate property. Review stores its path snapshot plus current status. ReviewEvent nodes preserve each distinct decision update; identical repeated saves do not create events. Keep/revise/defer never deletes dependencies or marks implementation complete.
9. **Small graph visualization without a graph-editing dependency.** SVG edges and accessible node buttons render the returned graph. A separate path list exposes every evidence link, including multiple paths. The sample contains only five connected nodes. Layout for crowded/deep graphs is future work.
10. **Local server and assets.** API and UI share one loopback origin. Host and Origin checks reject cross-site writes; JSON schema/body limits reject malformed input. No auth or multi-user deployment. Fonts are packaged through Fontsource, with no runtime Google Fonts request. Production uses the same API and compiled static assets.
11. **Astra development configuration, separate from product AI.** The project default is `gpt-6-astra`/high and the launcher passes explicit flags. No secret API key or extra AI service is introduced. Running chat selection is outside config-file control. CLI login checked; no new Astra model invocation was made as part of setup.
12. **Engine lifecycle.** Relate 1.0.1's Node API offers checkpoint but no explicit close method. Shutdown checkpoints and exits. Process-restart tests, not two simultaneous handles, prove reopening. WAL tests exit without an explicit final checkpoint. These are not power-loss/hardware-failure tests.
13. **Public source, local runtime.** The user selected `piecemakerz/Ripple`, an existing public GitHub repository with an MIT license. Preserve its history and license. Commit source, dependency locks and sanitized verification evidence; keep live databases, local backups, credentials and build outputs outside Git. Source publication does not turn the loopback-only server into a hosted demo.
14. **Version-matched official development context.** Use the Node/TypeScript skill and types shipped with the pinned Relate npm package. The launcher and verification gate check their presence and execute a parameterized in-memory read before development. This is separate from the optional upstream CLI skill/agent-context and never opens the live store. The four organizer-linked resources and idea comparisons are recorded in `docs/RELATE_RESOURCES.md`.
15. **Small project skill set.** Three reviewed upstream text snapshots and one Ripple verification skill live under `.agents/skills`. Pin provenance and normalized tree hashes, keep upstream instructions intact, load only relevant references, and adapt React guidance to Vite/Express. `ai:doctor` is part of the completion gate and launcher. CI status uses a token-free public read for the exact committed SHA; optional plugin connection does not block local development. No new agent, model API, global permission policy or hosting service is introduced.

## Data and API

Nodes: Item, Person, SourceVersion, Evidence, Proposal, Change, Review, ReviewEvent, RippleMeta, Mutation. Stable node IDs have unique constraints. Current schema version: 2. Opening a version-1 store performs one explicit transaction to add the Mutation ID constraint and advance metadata; all existing graph, source and review records remain intact. Unknown versions and non-empty unrecognized stores are refused.

## Manual M2 ingestion

- Sources are append-only. New documents get a server UUID and integer version 1; subsequent versions require the current version number. Sample documents with decimal versions cannot be used as import targets. Original text (including uploaded BOM/CRLF), SHA-256 and evidence slices remain immutable.
- The UI accepts UTF-8 `.md`, `.markdown`, `.txt` files up to 80 KB or pasted text. Server validation caps each source at 20,000 UTF-16 code units, 50 source versions, 100 items, 200 dependency records and 100 proposals per workspace. JSON bodies are limited to 256 KB. Limits include sample data and rejected candidates. There is no deletion/reset UI in this slice.
- Users create evidenced items, then proposed `DEPENDS_ON` edges. Candidate revision and both endpoint item revisions are recorded; confirmation revalidates those revisions and the evidence. Rejection remains possible for an outdated candidate. Candidate decisions are terminal. Proposed corrections require rejecting and recreating; confirmed corrections use the replacement operation below. The graph query still follows confirmed edges only.
- Duplicate proposed/confirmed directed pairs and self-dependencies are refused. Cycles across different items remain supported by the existing bounded traversal. These limits do not guarantee bounded query runtime for dense graphs.
- Each ingestion mutation validates input, checks a UUID request receipt and payload fingerprint, and atomically saves data/evidence plus a Mutation receipt. Identical retries return the original response; reuse with different input conflicts. Receipts preserve the manual candidate decision record. All Cypher values are bound.
- Generic proposals preserve the item's expected revision and evidence. They open the existing change/impact/review UI. Applying still recomputes and snapshots current confirmed paths atomically. A stale proposal must be recreated; it cannot silently update a newer item.
- Evidence selection maps textarea-normalized line endings back to the exact original UTF-16 slice. Repeated quotes require explicit occurrence selection (first 100 shown; a longer quote narrows the list). Text/Markdown is rendered as plain text, never executable HTML.
- Dense levels use a horizontally scrollable graph; the complete path list remains available. This is a small-workspace layout, not a large-graph layout engine.
- No AI extraction, external provider, paid call or collaboration was added. Manual confirmation asserts the user's semantic judgment; the server checks quote integrity, not whether the text logically proves the dependency.

Relationships: DEPENDS_ON, OWNED_BY, EVIDENCED_BY, FROM_SOURCE, CHANGES, FOR_CHANGE, FOR_ITEM, FOR_REVIEW. DEPENDS_ON properties include ID/status/evidenceId/from/to. The authoritative direction is the actual graph edge; rendering derives endpoints from returned paths.

## Confirmed relationship amendments

- `POST /api/dependencies/:id/replacements` accepts a UUID request ID, expected relationship revision, replacement endpoints and their expected item revisions, exact evidence slice and a non-empty reason. It handles both evidence-only amendments and endpoint replacements. Self-links, duplicate active directed pairs, unchanged endpoints/evidence, inactive relationships and stale revisions are refused.
- The existing synchronous transaction owner and Mutation receipt mechanism atomically append new evidence and a confirmed edge, mark the old edge superseded, advance its revision and persist the result. The old edge retains its endpoint/evidence properties. New edges carry `supersedes`, `reason`, `createdAt`; old edges gain `supersededBy`. Retry checks precede revision/state checks, so retries return their original receipt even after later replacements.
- Schema remains 2: these are additive relationship properties with no new node type/constraint. Old sample edges expose revision 1 when the property is absent; their first replacement persists revision 2. Existing manual candidates retain their revisions. Workspace dependencies derive endpoints from the actual graph, while candidates contains only original manual proposals and their lifecycle states.
- No Change, Review, ReviewEvent, SourceVersion or existing Evidence is rewritten. Existing change snapshots remain historical; future impact queries traverse only current confirmed edges. Relationship confirmation is a graph correction and does not increment item revisions or create implementation reviews. A future item change recomputes its impact atomically as before.
- The editor captures endpoint revisions on opening; a workspace refresh does not silently rebase its draft. Conflicts ask users to reopen against current revisions. Identical retries within the page reuse the request ID, including after a lost response/workspace-refresh failure. Drafts remain in memory across panel switches/failures; reloading loses unsaved input. Evidence choice preserves UTF-16 offsets, CRLF and explicit repeated occurrences.
- The 200-record cap includes all superseded generations; history is never pruned to make room. There is no retirement-only action, restore button, history search or automatic semantic evidence verifier. To correct a replacement again, create another generation and provide its reason.

| Method | Route                                  | Purpose                                                                     |
| ------ | -------------------------------------- | --------------------------------------------------------------------------- |
| GET    | /api/health                            | Native DB read probe                                                        |
| GET    | /api/workspace                         | Items, preserved sources, proposals, changes, developer storage information |
| GET    | /api/items/:id/impact                  | Actual Relate impact query                                                  |
| GET    | /api/evidence/:id                      | Validated original source and quote                                         |
| POST   | /api/changes                           | Idempotent, revision-checked atomic application                             |
| GET    | /api/changes/:id                       | Saved impact snapshot and review history                                    |
| PUT    | /api/changes/:changeId/reviews/:itemId | Record keep/revise/defer plus non-empty reason                              |

## Known limits and next design choices

- Store APIs are synchronous and can block the event loop on larger graphs. The depth/row cap is an output bound, not a strict query execution-time/memory bound. M2 should set domain ingestion limits before accepting arbitrary large input.
- Built-in and manually created change proposals are selectable. Imported items can be both the changed item and impacted items.
- Review updates use last-write-wins within the single-user app. Multi-tab conflicting review drafts are not revision-checked yet. Change requests are revision-checked.
- Review and document drafts survive panel switches and failed requests only in the current browser page. Reloading loses unsaved input; saved source versions, candidates, proposals and reviews persist.
- Raw direct access to Relate can bypass application invariants. Only the backend should write the live store.
- Public demo database export and reopening of a consistent exported copy are M4 work. GitHub origin is configured; public application hosting is not.
