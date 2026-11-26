# Verified candidate publication — 2026-11-26

The participant explicitly approved publishing the verified source on a new branch and draft PR, plus the matching ZIP/video in a GitHub release. Publication is in progress; completion evidence is appended after the external actions succeed. Main is not being merged and no Devpost submission is performed.

## Approved artifacts

| File                                   | Bytes      | SHA-256                                                            |
| -------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `ripple-judge-improved-2026-11-26.zip` | 19,800,646 | `6aa49c97532c319dcdea1aa86dda659eaa6d52bb9b58a81e9f2b8a6018035d4e` |
| `ripple-demo-improved-110s.mp4`        | 2,525,048  | `92b9687f0e6949bfb3ecf2596de19de3b0dc03336ab80f54b587d5755a18dde9` |

All four delivery artifacts and all 513 source files were rechecked against their preparation hashes before publication edits. The original ZIP remains unchanged, including its earlier `sourceCommit` and `workingTreeDirty` preparation metadata. A separate public release record maps those prepared bytes to the published source commit. Documentation updates describe publication; executable/test/fixture changes are not silently introduced. Git's existing `.gitattributes` may normalize text line endings, which must be identified separately from content differences.

## Publication plan and validation

- Branch: `codex/hackathon-verified-20261126`, from main `e7d28a70028ff87a2934fbdf14d9cef21ba9ee5e`.
- Draft PR to main; no merge or auto-merge.
- Public prerelease tag: `v0.1.0-hackathon.20261126`.
- Reuse the existing worktree and clean-package 91/91, doctor, browser, read-only native and video evidence. Verify the exact new public commit in CI before releasing.
- Verify uploaded artifact sizes/hashes and unauthenticated downloads; source and release metadata must point to the intended commit.

The candidate is a manually curated developer case. Independent-user efficacy, authoring time, time savings and winning sufficiency remain unmeasured. See [improvement evidence](HACKATHON_IMPROVEMENTS_2026-11-26.md), [AI disclosure](AI_DISCLOSURE.md) and [case provenance](RIPPLE_CHANGE_CASE.md).
