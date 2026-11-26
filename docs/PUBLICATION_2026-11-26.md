# Verified candidate publication — 2026-11-26

The participant explicitly approved publishing the verified source on a new branch and draft PR, plus the matching ZIP/video in a GitHub release. Publication completed on **2026-11-26 at 15:38 KST**. The release and all five attachments are publicly accessible. Main remains unmerged; no Devpost submission was performed.

- [Public candidate branch](https://github.com/piecemakerz/Ripple/tree/codex/hackathon-verified-20261126)
- [Draft PR #1](https://github.com/piecemakerz/Ripple/pull/1), targeting main
- [Public prerelease and five attachments](https://github.com/piecemakerz/Ripple/releases/tag/v0.1.0-hackathon.20261126)
- [Candidate commit b577290](https://github.com/piecemakerz/Ripple/commit/b577290613ad72f31cac1f16974065c17e773625) and its [successful Verify Ripple run](https://github.com/piecemakerz/Ripple/actions/runs/45768805050)

## Approved artifacts

| File                                   | Bytes      | SHA-256                                                            |
| -------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `ripple-judge-improved-2026-11-26.zip` | 19,800,646 | `6aa49c97532c319dcdea1aa86dda659eaa6d52bb9b58a81e9f2b8a6018035d4e` |
| `ripple-demo-improved-110s.mp4`        | 2,525,048  | `92b9687f0e6949bfb3ecf2596de19de3b0dc03336ab80f54b587d5755a18dde9` |

All four delivery artifacts and all 513 source files were rechecked against their preparation hashes before publication edits. The original ZIP remains unchanged, including its earlier `sourceCommit` and `workingTreeDirty` preparation metadata. A separate public release record maps those prepared bytes to the published source commit. Documentation updates describe publication; executable/test/fixture changes are not silently introduced. Git's existing `.gitattributes` may normalize text line endings, which must be identified separately from content differences.

## Publication validation

- Created `codex/hackathon-verified-20261126` from main `e7d28a70028ff87a2934fbdf14d9cef21ba9ee5e`; published the verified source as `b577290613ad72f31cac1f16974065c17e773625`. PR #1 is open and draft, with no merge or auto-merge.
- The annotated tag `v0.1.0-hackathon.20261126` stays on that candidate commit. Later publication-documentation commits on the PR branch do not move the tag or rebuild the approved ZIP/video.
- The exact candidate commit passed Verify Ripple before release. Existing worktree and clean-package **91/91**, doctor, browser, read-only native and video evidence are recorded in [QA](QA.md). Publication changed documentation and declared line endings, not executable behavior.
- GitHub reported matching SHA-256 and size for all five uploads. A fresh unauthenticated HTTP download of **each attachment returned 200 and the identical SHA-256**. The signed-out browser displayed the release title, Pre-release badge and candidate commit. MP4 bytes match the locally decoded and visually checked video; hosted browser playback was not separately measured.
- Source correspondence used `git archive` of the tagged commit, honoring repository attributes: **502 of 513** approved source files were byte-identical, **5** differed only in line endings, **6** contained publication-documentation updates, plus this new publication record. No unexpected difference. `RELEASE_MANIFEST.json` lists the exact paths and comparison basis.

The attachments are the ZIP and video above, `RELEASE_MANIFEST.json`, `VIDEO_DESCRIPTION_PUBLIC.txt` and `SHA256SUMS.txt`. Their exact hashes are in the release; the ZIP's historical preparation metadata and video's local-candidate end card remain unchanged. The public manifest and release notes identify the later publication state without rewriting the approved artifacts.

The GitHub plugin created the branch/PR and read CI. Release upload is not exposed by that plugin; the official GitHub REST API used the existing Git Credential Manager authentication. No credential was printed, written to an artifact or committed. The initially signed-out browser route was not a successful upload and was replaced by this API route. A precommit whitespace check found trailing whitespace in the unchanged upstream Pretendard license; its bytes were preserved and the remaining paths passed. These tool limitations do not replace the successful CI and download evidence.

The candidate is a manually curated developer case. Independent-user efficacy, authoring time, time savings and winning sufficiency remain unmeasured. See [improvement evidence](HACKATHON_IMPROVEMENTS_2026-11-26.md), [AI disclosure](AI_DISCLOSURE.md) and [case provenance](RIPPLE_CHANGE_CASE.md).
