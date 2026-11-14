# Real-document evaluation

There are now **two separately sourced curated graphs**, each with three queries. `async-owner` uses Ripple documents; [`semver-deprecation`](EVALUATION_SEMVER.md) uses the external Semantic Versioning 2.0.0 specification. Independence refers to source and scenario, **not independent annotation or human validation**. Both scenarios and gold labels are AI-curated. No customer or extraction accuracy is measured.

`npm run evaluate` runs both cases sequentially in separate temporary stores and returns `{ ok, caseCount, cases }`. Select one with `npm run evaluate:owner` or `npm run evaluate:semver`; its report retains `{ ok, caseName, phases, ... }`. Phase report schema version is 2, separate from database schema. Scores stay per query rather than pooling repeated items into an independent-sample accuracy metric. Reopening rejects a manifest for a different case or fixture hash before opening the store. All evaluation inputs are local; no network or API key is needed after installation.

`npm run evaluate:semver:demo` opens the new case at port **4323**. The original demo command and port **4322** remain unchanged. Details below describe the first case; see [the second case](EVALUATION_SEMVER.md) for its sources, paths, scores and screen flow.

The first case uses frozen excerpts from Ripple's own published project documents. The proposed asynchronous-store migration is hypothetical. Item descriptions, dependency choices and expected results were curated with AI assistance and **have not been reviewed by a human domain expert**. The two candidate controls are synthetic. This is a reproducible document-grounded graph regression, not a customer study, automatic extraction benchmark or a claim that the migration has been implemented.

## Run it

Human semantic adjudication now has a local worksheet: `npm run evaluate:review` opens both cases at port 4324, with versioned review artifacts and a strict checker. See [semantic review and manual-comparison protocol](SEMANTIC_REVIEW.md). The worksheet is available; actual human judgments and comparison measurements remain pending.

```powershell
npm ci
npm run evaluate:owner
```

The command creates a fresh temporary native Relate store, imports every source/item/candidate through the loopback HTTP API, confirms or rejects the intended candidates, and compares three impact queries with explicitly listed expected paths. It applies the hypothetical change, repeats the same request to check idempotency, saves the same review twice, appends a second source version, and verifies the original snapshot and review. The writer checkpoints and exits before a second owner process opens the same store and repeats the checks. The temporary directory is then removed. `RIPPLE_DB_PATH` and `.env` are ignored; no existing workspace is opened.

Output is a JSON report containing the fixture SHA-256, case/provenance, expected and observed items, false positives/negatives, precision/recall, path matches and distinct evidence checks for each query in both processes. A mismatch exits nonzero. Empty denominators produce `null`, not an invented 100%. Missing paths/evidence, duplicate impacts/paths, wrong depth/direction/status, invalid offsets/source/hash and traversal warnings all fail the gate even if the item set matches. `npm run verify` includes this evaluation and scorer regression tests.

## Inspect the case in the app

```powershell
npm run evaluate:demo
```

This builds the production UI, prepares a **new** evaluation store under `%LOCALAPPDATA%/Ripple/ripple-evaluation-*` (the platform's local share directory otherwise), validates the previews and starts one backend at **http://127.0.0.1:4322**. It retains the directory printed in the terminal. It ignores any existing `RIPPLE_DB_PATH`. If the port is busy, set `PORT` to a free loopback port before running. The built-in inventory sample remains a separate disconnected component.

1. Select **Synchronous database owner · proposed update** in **Change to explore**.
2. Expect **Serialize database operations** and **Atomic change transaction** directly; **Queue reads with writes** and **Verify rollback and restart** indirectly.
3. Select **Verify rollback and restart**; open both path evidence links.
4. Apply the hypothetical change and save a review decision/reason. Refresh and inspect the preserved decision and original evidence.
5. At 390px, use **Change / Impact path / Review** to inspect the same case.

Ctrl+C stops the demo; its separate database remains. To reopen it, set `RIPPLE_DB_PATH` to the printed directory's `db` child and `PORT` to the desired free port, then run `npm start`. Stop its current owner first. Running `evaluate:demo` again creates a different store; it does not reopen or reset the earlier one. This helper prepares evaluation data only; it does not export a submission database or publish the app.

## Frozen inputs and expected graph

[Fixture](../evaluation/async-owner.json) pins excerpts from commit [`f59e0f9c9934e36f36e07d2f1fb070814d9b6d5a`](https://github.com/piecemakerz/Ripple/tree/f59e0f9c9934e36f36e07d2f1fb070814d9b6d5a). Each source includes its repository path, commit, MIT license, original-file UTF-16 range, exact text and SHA-256. Source text uses the committed Git blob's LF line endings, not a checkout's possible CRLF conversion. Quote offsets inside the imported excerpt are also UTF-16 and end-exclusive. Updating current architecture documentation cannot silently change these inputs.

| Source key   | Original section                                                        | Use                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ownership    | `docs/ARCHITECTURE.md`, decision 3                                      | Synchronous calls prevent transaction interleaving; an asynchronous implementation must queue reads and complete write transactions |
| atomicity    | `docs/ARCHITECTURE.md`, decision 7                                      | One explicit transaction contains snapshot/review/revision writes                                                                   |
| assets       | `docs/ARCHITECTURE.md`, decision 10                                     | Locally packaged fonts; unrelated control with the same assigned owner                                                              |
| verification | `.agents/skills/ripple-verify/SKILL.md`, storage verification paragraph | A failed write preserves revision, change/review records and evidence; restart restores them together                               |

| Key      | Item                          | Expected path when OWNER changes    | Curation rationale                                                                                                                                                      |
| -------- | ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWNER    | Synchronous database owner    | Changed item; excluded from impacts | Hypothetical switch from synchronous ownership to queued asynchronous calls                                                                                             |
| QUEUE    | Serialize database operations | QUEUE → OWNER                       | Ownership paragraph explicitly requires a queue for an asynchronous implementation                                                                                      |
| ATOMIC   | Atomic change transaction     | ATOMIC → OWNER                      | Curator inference: migration must preserve the whole transaction's isolation; the atomicity quote describes the required boundary, not a direct claim about async calls |
| READS    | Queue reads with writes       | READS → QUEUE → OWNER               | Ownership paragraph explicitly includes reads in that queue                                                                                                             |
| ROLLBACK | Verify rollback and restart   | ROLLBACK → ATOMIC → OWNER           | Verification paragraph requires all transaction effects to roll back and reopen together                                                                                |
| FONTS    | Bundle local fonts            | Excluded                            | Same assigned owner and database-related wording do not create an edge                                                                                                  |
| PROPOSED | Unconfirmed queue candidate   | Excluded                            | Deliberate synthetic candidate control; remains proposed                                                                                                                |
| REJECTED | Rejected queue candidate      | Excluded                            | Deliberate synthetic candidate control; rejected through the normal API                                                                                                 |

Gold paths/exclusions are listed in the fixture independently of the query implementation. The scorer does not derive them using a second graph traversal. The smaller ATOMIC query expects only ROLLBACK; FONTS expects no impact. These are **three queries over one curated graph**, not three independent real-world cases. Every item shares the same assigned owner. The six built-in sample items must also stay outside this ripple.

## Observed result — 2026-11-14 KST

| Query  | Correct / returned / expected items | Paths | Valid distinct evidence / expected | Precision / recall |
| ------ | ----------------------------------- | ----- | ---------------------------------- | ------------------ |
| OWNER  | 4 / 4 / 4                           | 4 / 4 | 4 / 4                              | 1.0 / 1.0          |
| ATOMIC | 1 / 1 / 1                           | 1 / 1 | 1 / 1                              | 1.0 / 1.0          |
| FONTS  | 0 / 0 / 0                           | 0 / 0 | 0 / 0                              | null / null        |

Both the original owner and the reopened process produced these results. Applied-change retry created one change/four reviews. Repeating the same review produced one review event. Appending ownership source version 2 retained all four original version-1 source texts, hashes and saved path quotes. The browser demo separately exercised actual UI apply/selection/evidence/review/reload on desktop and 390px. See [QA](QA.md) for screen evidence and [STATUS](STATUS.md) for the final completion gate and CI scope.

There is no measurement of extraction quality, time saved, user comprehension, latency at scale or independent customer accuracy. Human semantic review of both cases and comparison with a manual workflow remain next steps. Review ATOMIC → OWNER and the second case's MAJOR → DEPRECATE explicitly before treating either golden graph as human-validated. Never overwrite v1 gold labels to conceal a failed regression; introduce a reviewed fixture revision with rationale when meaning changes.
