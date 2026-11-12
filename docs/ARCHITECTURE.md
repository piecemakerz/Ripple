# Architecture and decisions

2026-11-12 KST · M0/M1

## Boundaries

`React UI → same-origin Express API → synchronous domain/store service → native Relate → WAL + Parquet`.

- `src/`: interaction state and rendering. Impact targets are never hardcoded in the client.
- `shared/types.ts`: response types, graph/evidence/change/review contracts.
- `server/app.ts`: HTTP validation, local Host/Origin checks, errors.
- `server/store.ts`: parameterized Cypher, graph traversal, atomic changes, immutable snapshots, reviews.
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

## Data and API

Nodes: Item, Person, SourceVersion, Evidence, Proposal, Change, Review, ReviewEvent, RippleMeta. Stable node IDs have unique constraints. Current schema version: 1. Unknown non-empty stores are refused instead of seeded. Migrations must be explicit in future versions.

Relationships: DEPENDS_ON, OWNED_BY, EVIDENCED_BY, FROM_SOURCE, CHANGES, FOR_CHANGE, FOR_ITEM, FOR_REVIEW. DEPENDS_ON properties include ID/status/evidenceId/from/to. The authoritative direction is the actual graph edge; rendering derives endpoints from returned paths.

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
- One built-in change proposal is exposed. The backend supports independent subsequent changes, tested at the API/store level; generic change creation UI belongs with M2.
- Review updates use last-write-wins within the single-user app. Multi-tab conflicting review drafts are not revision-checked yet. Change requests are revision-checked.
- Saved review drafts survive panel switches and failed requests only in the current browser page. They are not offline drafts.
- Raw direct access to Relate can bypass application invariants. Only the backend should write the live store.
- Public demo database export and reopening of a consistent exported copy are M4 work. GitHub origin is configured; public application hosting is not.
