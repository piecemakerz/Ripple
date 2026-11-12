# M0/M1 verification record

Date: **2026-11-12 KST**. Data is synthetic. No external AI extraction was used.

## Automated checks

`npm run verify` runs formatting, strict TypeScript, native integration tests and production build. Thirteen tests cover:

1. HTTP flow, input validation, stale revision and cross-origin rejection.
2. Separate-process restoration from a checkpoint.
3. Separate-process restoration from WAL without a final explicit checkpoint.
4. Idempotent seeding, exact D1/D2/T1/T2 impacts, T3 exclusion, path/evidence correctness.
5. Shared owner/words and proposed/rejected/superseded edges do not imply impact; injection-like IDs remain data.
6. Cycles terminate, target excluded, multiple paths create one review per item.
7. Atomic/idempotent changes, request reuse conflicts, stale revision and independent subsequent reviews.
8. Rollback, including an injected failure after Change/Review writes but before item update.
9. Historical paths and original content survive current graph edits.
10. Missing/invalid evidence prevents application.
11. Unicode UTF-16 offsets, exact hashes, parameter safety.
12. Depth limit disclosure and application guard.
13. Path-count limit disclosure.

Result: **13 passed, 0 failed**. `npm run doctor` passed. `npm run reproduce` verified clean npm installation and checks from a temporary checkout. These tests do not open the live DB. Results are regression evidence, not real-user accuracy/speed measurements.

## Browser acceptance

Actual local UI and Relate API/database, without mocked impact responses. Desktop 1440px and mobile 390px inspected. Final server runs the production bundle.

| Check             | Observed result                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Initial workspace | Daily refresh proposal; 2 direct + 2 indirect impacts; T3 excluded                                         |
| Select T1         | T1 → D1 → A1, two evidence links                                                                           |
| Source dialog     | Exact quote highlighted, version/offsets visible; close returns to workspace                               |
| Apply             | A1 revision 2, one Change and four pending Reviews                                                         |
| Review save       | T1 revise + reason; progress 1/4 and history entry                                                         |
| Browser reload    | Applied change, original paths and saved review restored                                                   |
| Mobile navigation | Change / Impact path / Review panels at 390px                                                              |
| Mobile graph      | Initial clipping fixed; nodes within panel                                                                 |
| Failed save       | Temporarily blocked local review request in browser devtools; failure displayed, T2 draft/reason preserved |
| Retry             | Removed network block; same draft saved as defer; progress 2/4                                             |
| Server restart    | Stopped dev process, started production, reloaded; graph/revision/both reviews preserved                   |
| Console           | No normal-flow errors observed; intentional blocked request produced an expected network error             |

Temporary network/device overrides were removed. The live sample has two recorded review decisions. Keep/revise/defer record decisions, not implementation completion.

## Captures

![Desktop workbench after restart](evidence/desktop.jpg)

![Original dependency evidence](evidence/source.jpg)

[Mobile viewport](evidence/mobile.jpg)

## Re-run browser checks

For an untouched proposal, use a fresh DB path from README. Follow the 2-minute flow, then inspect a saved review after process restart. For visual changes inspect three-column desktop and 390px panel layout. API/DB tests are automated; browser acceptance in this iteration used the connected browser, not a committed automated browser test suite.
