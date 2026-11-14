# Semantic review of evaluation cases

The automated evaluator proves that the native graph returns the curated expectations. It cannot prove those expectations make semantic sense. Both frozen graphs remain **AI-curated and not human-reviewed** until a person assesses them. This worksheet records that assessment separately, without editing the gold fixtures or opening an application database.

## Run the worksheet

```powershell
npm run evaluate:review
```

Open **http://127.0.0.1:4324**. The command needs neither a build nor an API key. It serves local HTML/CSS with native forms and no client scripts. Use `REVIEW_PORT` for a different loopback port. The default artifact directory is `%LOCALAPPDATA%/Ripple/semantic-reviews` (the platform local-share directory otherwise). `RIPPLE_REVIEW_PATH` selects a separate review directory; `RIPPLE_DB_PATH`, `.env` and the application `PORT` are ignored.

There are **18 subjects for database ownership** and **21 for SemVer deprecation**: one scenario, every item, every relationship including proposed/rejected controls, and all three query path/exclusion sets. Sources retain their attribution, pinned links, exact excerpts, SHA-256 and original/excerpt UTF-16 ranges. The first fixture has no structured basis labels; the worksheet explicitly identifies its documented ATOMIC inference and synthetic controls without modifying that fixture. Other unlabeled relationships remain labeled as such.

1. Read the hypothetical change and frozen sources. Expand a source at the bottom to inspect its full excerpt; follow its pinned original if more context is needed.
2. Enter your name or alias and select **Human** only if you are personally reviewing. Automated checks select **Automated / QA**.
3. For each subject choose **Accept**, **Revise** or **Uncertain**, and explain why. Every answer, including acceptance, requires a reason. Pending subjects may carry draft notes. Check missing relationships and alternate paths as well as the listed paths; do not accept merely because the automated score is perfect.
4. Pay special attention to **ATOMIC → OWNER** and **MAJOR → DEPRECATE**. Their quotes do not explicitly assert those dependencies; assess whether the hypothetical scenario justifies the curator's inference. A recommendation in the SemVer FAQ must not become a normative MUST. Accepting a synthetic candidate control confirms its role and state in the test, not a real source-grounded obligation.
5. **Save review snapshot** before switching cases or reloading. Unsaved input is memory-only. Each save appends a numbered JSON file under the case directory. Earlier versions remain unchanged. A stale form receives a conflict with its input preserved; copy any desired edits before reloading the saved version.
6. After personally answering every subject, a human may select the attestation checkbox. Revise/Uncertain still prevent acceptance. Download the saved JSON for a portable record. Do not publish reviewer identity or notes without deciding they are appropriate to share.

Reloading or restarting the same command/directory restores the latest valid saved version. Maximum: 1,000 snapshots per case; records are never pruned to make room. A corrupt latest artifact or changed fixture/checklist stops loading instead of silently falling back or reusing judgments. Preserve that directory and explicitly choose a new `RIPPLE_REVIEW_PATH` for a new fixture/checklist revision. JSON files are evaluation artifacts, not an alternative graph database. Snapshot publication uses a fully written temporary file and an exclusive hard link; the local filesystem must support hard links. There is no power-loss durability claim or restore/import UI.

## Check a downloaded record

Pass a real path to a saved JSON file (the example uses the first ownership snapshot in the default directory):

```powershell
$reviewFile = Join-Path $env:LOCALAPPDATA 'Ripple/semantic-reviews/async-owner/000001.json'
node --import tsx scripts/review-evaluation.ts --check $reviewFile
```

The checker validates strict fields, case ID, exact fixture bytes, checklist content, one entry per subject, reasons and reviewer provenance. It recomputes completeness and acceptance; it does not trust submitted totals. Exit codes:

| Code | Meaning                                                                              |
| ---- | ------------------------------------------------------------------------------------ |
| 0    | Every subject accepted with reasons and explicit human self-attestation              |
| 2    | Valid record, but pending, disputed, uncertain, automated or unattested              |
| 1    | Malformed record, wrong case/hash/checklist, missing/duplicate entries or read error |

`identityVerified` is always false. Self-attestation is not authentication, proof of expertise or independent annotation. A person who authored or saw the gold labels is not a blind independent annotator. An automated record can be complete and accepted without becoming human-attested. An accepted record for one case says nothing about the other. Do not treat an older accepted snapshot as the latest decision when a later snapshot exists.

The existing `npm run evaluate` remains a graph regression gate; it does not silently start requiring private human artifacts in CI. The two fixture files stay unchanged. If review reveals an error, preserve the original fixture and review snapshots, introduce a new version with an explained correction, then rerun native evaluation and human adjudication against the new hashes.

## Next: bounded manual-workflow comparison

No comparison has been run. Prepare it only after resolving both cases' semantic disagreements, and record the accepted fixture/checklist/review hashes before measuring.

- **Question:** for these two hypothetical changes, can a person identify the review targets and explain their source-backed paths using source documents alone versus Ripple with the preconfirmed graph? This measures assistance after graph preparation, not extraction or automatic graph creation.
- **Common task:** return the impacted item IDs, dependency paths, exact source quotes and excluded controls for OWNER or DEPRECATE. Record missed/extra items, missing/incorrect paths and unsupported quotes separately. Keep the same source content, item inventory and scenario in both conditions; hide gold labels and prior answers during timed work.
- **Baseline:** frozen sources and item list in a text editor/search, with a blank answer sheet. **Ripple:** a freshly prepared case using `evaluate:demo` or `evaluate:semver:demo`. Record ingestion, graph confirmation and reviewer training time separately; do not hide those costs inside a claim about total workflow savings.
- **Assignment:** counterbalance case and tool order across participants. With only one participant, use different cases per condition, disclose case-difficulty and learning confounds, and call the result a feasibility observation. A gold adjudicator who has already seen the answers is not a blind timing participant.
- **Timing:** define start as the scenario being revealed and stop as the final answer being submitted. Retain raw elapsed time, interruptions, tool condition/order, prior familiarity and assistance. Do not time this agent's browser automation and label it human performance.
- **Reporting:** score answers against the frozen adjudicated expectations after submission. Keep per-case results and disagreements; report participant/task counts and preparation costs. Two small cases do not establish customer accuracy, general time savings or significance. No projected percentages are supplied.

This protocol sets the next study's boundaries. Participant selection, actual judgments, raw answers and measurements remain outstanding.
