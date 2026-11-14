# SemVer public-document evaluation

This second case uses an external specification rather than Ripple's own documents. The source and scenario are independent of the first case; the AI curator, runner and scorer are shared. **Neither case is independently human-validated.** This is a document-grounded graph regression, not a customer case, extraction benchmark or measured time saving.

## Run and inspect

```powershell
npm run evaluate:semver
npm run evaluate:semver:demo
```

The first command uses a disposable store and validates separate-process reopening. The second builds the UI, prepares a new retained `%LOCALAPPDATA%/Ripple/ripple-evaluation-*` store and starts production at **http://127.0.0.1:4323**. Both ignore the live DB setting. Set `PORT` to a free port if needed. The first case's demo still defaults to 4322. All inputs are frozen locally; evaluation needs no network or API key after installation.

1. Select **Public API deprecation plan · proposed update**.
2. Expect **3 direct + 2 indirect** impacted items. The metadata, proposed/rejected candidates and built-in inventory sample are excluded.
3. Select **Reset minor and patch for removal**. Inspect both its two-hop and three-hop paths and exact evidence.
4. Apply: seven paths must yield **five reviews**, one per impacted item. Save Defer with a reason and reload.
5. At 390px inspect the same case using Change / Impact path / Review.

Ctrl+C stops the owner and retains the printed directory. To reopen it, stop its owner first, set `RIPPLE_DB_PATH` to that directory's `db` child and `PORT` to 4323, then run `npm start`. Running `evaluate:demo` again creates another store. This helper is not a submission export or hosted deployment.

## Frozen source and attribution

[Fixture](../evaluation/semver-deprecation.json) contains four verbatim excerpts from [`semver/semver`, commit `f99d5485190a47c0863949e7da810a5553e0ed4d`, `semver.md`](https://github.com/semver/semver/blob/f99d5485190a47c0863949e7da810a5553e0ed4d/semver.md): the deprecation FAQ, minor-release rule, major-release rule and build-metadata rule. **Semantic Versioning 2.0.0**, originally authored by **Tom Preston-Werner**, with **the SemVer Team**, is licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Each source records its original URL, commit, UTF-16 range, excerpt SHA-256 and attribution. Offsets are end-exclusive and based on the original LF text. See [third-party notices](../THIRD_PARTY.md).

Excerpt text is unmodified; Ripple added item labels, release plans, graph relationships and expected results. The upstream authors do not endorse this evaluation. The hypothetical library plans to deprecate `legacy parse()` in 1.4.0 and remove it in 2.0.0. The proposal delays deprecation to 1.5.0. These API names, versions and tasks are invented, not a real SemVer project migration. Impact means **review the dependent plan**, not that every impacted implementation or release date must change.

## Explicit gold graph

| Item                | Expected path(s) when DEPRECATE changes                                | Basis                                                                                                           |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DEPRECATE           | Changed target; excluded                                               | Hypothetical API deprecation plan grounded in the FAQ                                                           |
| DOCS                | DOCS → DEPRECATE                                                       | FAQ explicitly asks for documentation updates                                                                   |
| MINOR               | MINOR → DEPRECATE                                                      | Specification requires a minor increment for API deprecation                                                    |
| PATCH_RESET         | PATCH_RESET → MINOR → DEPRECATE                                        | Specification requires patch reset on minor increment                                                           |
| MAJOR               | MAJOR → DEPRECATE; MAJOR → MINOR → DEPRECATE                           | Direct plan dependency is a **curator inference**; FAQ explicitly recommends a deprecation minor before removal |
| CORE_RESET          | CORE_RESET → MAJOR → DEPRECATE; CORE_RESET → MAJOR → MINOR → DEPRECATE | Specification requires minor/patch resets on major increment                                                    |
| METADATA            | Excluded                                                               | Build metadata precedence is independent of this schedule despite shared vocabulary/owner                       |
| PROPOSED / REJECTED | Excluded                                                               | Synthetic candidates exercised through the ordinary API                                                         |

All nine items share one assigned owner. Six confirmed edges, one proposed edge and one rejected edge are explicit; each has a rationale and direct/inferred/synthetic classification. Gold paths are written out, not calculated by a second traversal. MAJOR → DEPRECATE means that changing the plan triggers review of the later removal; the FAQ does not guarantee a removal date change. The FAQ's recommendation to release a deprecation minor is not promoted to a normative MUST.

Convergent paths extend the first case's coverage: CORE_RESET retains two paths of different lengths and one review. A scorer regression removes only an alternate path and requires failure even though item precision/recall remain 1.0. The smaller MINOR query expects PATCH_RESET, MAJOR and CORE_RESET; METADATA expects zero. The six built-in sample items remain disconnected. These are three queries over one graph, not three independent cases.

## Observed results — 2026-11-14 KST

| Query     | Correct / returned / expected items | Paths | Valid distinct edge evidence / expected | Precision / recall |
| --------- | ----------------------------------- | ----- | --------------------------------------- | ------------------ |
| DEPRECATE | 5 / 5 / 5                           | 7 / 7 | 6 / 6                                   | 1.0 / 1.0          |
| MINOR     | 3 / 3 / 3                           | 3 / 3 | 3 / 3                                   | 1.0 / 1.0          |
| METADATA  | 0 / 0 / 0                           | 0 / 0 | 0 / 0                                   | null / null        |

Both write and reopened read phases passed. Seven paths produce five reviews; applying the same request twice creates one change, and saving the same review twice creates one event. Appending deprecation source v2 preserves all four original v1 excerpts and saved evidence. Distinct evidence counts mean **edge evidence records**: two edges can cite the same passage, so this is not six independent textual claims. See [QA](QA.md) and [STATUS](STATUS.md) for browser and completion-gate evidence.

Human semantic review of both cases, especially the disclosed inferred edges, and comparison with a manual workflow remain next work. Do not overwrite v1 gold labels to hide a regression; revise the fixture explicitly with review rationale when meaning changes.
