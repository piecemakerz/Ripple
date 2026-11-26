# Ripple hackathon submission working draft

Updated 2026-11-26 KST after the [critical review](HACKATHON_CRITICAL_REVIEW_2026-11-26.md), [improvements](HACKATHON_IMPROVEMENTS_2026-11-26.md) and approved [publication](PUBLICATION_2026-11-26.md). Devpost draft, not submitted. The current source is on [candidate branch / draft PR #1](https://github.com/piecemakerz/Ripple/pull/1); the [public prerelease](https://github.com/piecemakerz/Ripple/releases/tag/v0.1.0-hackathon.20261126) contains the matching ZIP, video and checksums. The tag stays on verified commit `b577290`; main remains `e7d28a7`.

The [overview](https://relate.devpost.com/), [Official Rules](https://relate.devpost.com/rules) and [schedule](https://relate.devpost.com/details/dates) were checked November 26. The November 24 update gives connected context 30, functionality 25, usefulness 20, documentation/reproducibility 15, creativity 10. Deadline: **2026-12-12 11:00 KST** (December 11, 18:00 PST). These are weights, not predicted scores. The overview permits extensions while Rules §3 requires a new project; retain development history and disclose reused work.

## Direction

For developers and technical product leads: follow a changed assumption to connected work, inspect original evidence and record the next decision. The user selected **Ripple's actual review API change** as the lead case. SemVer remains supporting evidence for alternate paths, ownership for storage migration, and inventory for the introductory example. See [the real case](RIPPLE_CHANGE_CASE.md).

## Devpost text draft

### Ripple — One change. See the ripple.

A local change-impact workbench that follows source-backed dependencies to the decisions and tasks that need another look.

### What it does

A requirement changes. Finding the sentence is easy; finding the decisions and work that relied on it is harder. Ripple connects assumptions, decisions and tasks through explicit, confirmed dependencies. It shows downstream review candidates and the original source passages behind each path.

Our main case is a real Ripple change: review saves now require a revision and retry identity. That affects browser saves and an evaluation worker. Two links away, the judge's native-store package depends on that worker and must be rebuilt and checked. Ripple returns four review candidates across four paths, excluding the independent language preference. The response is concrete: revise two callers, keep the draft-preservation requirement and defer publishing the package until verification is complete.

Users import documents, preserve source versions, confirm evidenced relationships, preview and apply changes, record Keep / Revise / Defer with reasons, and download a decision brief. A newer source can be compared without rewriting the original quote. If another tab changed a review, the draft is preserved and the user compares the latest decision before saving again. A decision is a plan, not completed implementation; connected does not mean broken.

### How Relate makes it work

Native Relate 1.0.1 is embedded in a loopback Node app. It stores the graph, immutable sources, exact evidence, changes, review history and request receipts without a separate service. Parameterized Cypher follows confirmed `downstream -> upstream` dependencies. Apply snapshots paths and evidence in the transaction that creates the change and reviews. Review updates check revisions and atomically commit the decision, history and request receipt. Identical retries do not replay older decisions.

React, Vite and TypeScript provide the interface; Express and Zod provide the API and strict validation. Context is explicitly prepared through the application's ingestion API. The app makes no model calls and does not extract dependencies automatically.

### What we verified and learned

The local gate passes 91 tests, strict types, skill checks and the production build on Windows x64. Native tests cover stale saves, retries, rollback, legacy records, source preservation and separate-process reopening. Actual two-tab checks cover conflict comparison/recovery, with 390px checks for narrow interaction.

Three frozen cases exercise the graph. Ripple uses actual pre-change working-tree excerpts, with hashes and null commit provenance. SemVer has five targets/seven paths and disclosed planning inferences. Ownership covers a hypothetical storage migration. All graphs are curated, not independent human annotations. The current worksheet has 51 subjects; the historical 39-subject automated assessment does not cover the new case.

Preparation for the real case uses six excerpts, six items, four connections and 21 API writes. Source reading and graph-authoring time were not measured. We learned to show the next action behind a connection and make preparation limits visible. Independent-user outcomes and time savings remain unmeasured.

### AI, attribution and limits

Codex assisted design, implementation, tests, debugging, documentation, curation and video editing. The participant selected the direction and real case. No additional agents or paid model APIs were launched for these improvements. The application needs no AI API key. See [AI disclosure](AI_DISCLOSURE.md).

The main case quotes Ripple's own MIT source. Supporting SemVer excerpts are by Tom Preston-Werner and the SemVer Team under CC BY 3.0, with hypothetical labels added by Ripple. [Third-party notices](../THIRD_PARTY.md) include references and fonts. Other operating systems, large-workspace performance, hosted use and independent effectiveness remain unverified.

## Judge quick start

Use the [public candidate branch](https://github.com/piecemakerz/Ripple/tree/codex/hackathon-verified-20261126) or the release ZIP's `app/` directory. Requires Node 22.12+; validated with 22.17.1 on Windows x64.

```powershell
npm ci
npm run evaluate:ripple:demo
```

Open the **full proposal/item URL printed**, normally on **http://127.0.0.1:4326**. It selects **Review writes accept status and reason** and **Rebuild the judge store after the API change**. If occupied, set `$env:PORT = '4327'` first. The command builds the app and prints a separate persistent evaluation directory.

1. Read the before/after contract and two links to the package task. Open the original worker quote. There are four targets/four paths, excluding API itself.
2. Apply explicitly; record Defer with a reason to rebuild and verify the worker/store. Review the two callers and draft-preservation requirement, then download the brief.
3. Expand **Outside this ripple**: LANGUAGE plus six unrelated inventory items are excluded.
4. For conflicts, open the saved URL in a second tab before either saves. Save one decision, then a different stale draft in the other; compare explicitly to resolve it.

Stop the owner with Ctrl+C before restarting the same printed directory:

```powershell
$demoDirectory = 'REPLACE_WITH_THE_PRINTED_EVALUATION_DIRECTORY'
$env:RIPPLE_DB_PATH = Join-Path $demoDirectory 'db'
$env:PORT = '4326'
npm start
```

Reload the saved change/item URL. Only one backend may own a store. `npm run evaluate` runs all three cases; `npm run doctor` checks separate-process persistence. SemVer remains available with `npm run evaluate:semver:demo` on 4323.

## Judge package

`npm run judge:prepare:ripple` generates current source in `app/`, a closed native store in `snapshot/db/`, exact hashes, inspection output and a recipient README. Each generated source manifest records its actual preparation commit and dirty state. The unchanged published ZIP retains its earlier preparation commit and `workingTreeDirty: true`; the release's `RELEASE_MANIFEST.json` maps those approved bytes to the tagged public candidate.

From the bundle's `app/` directory:

```powershell
npm ci
npm run verify
npm run judge:inspect -- ..
npm run judge:start -- ..
```

Inspection hashes and copies the closed snapshot, then reads it in a separate native read-only process and verifies unchanged files. Start creates a writable copy and prints its saved-review URL. The package has four targets and **one curator-authored Defer**; the video's four decisions use another database. Each start creates another copy. Keep active DBs and generated packages/media out of Git.

## Current video

[Download the published 110-second video](https://github.com/piecemakerz/Ripple/releases/download/v0.1.0-hackathon.20261126/ripple-demo-improved-110s.mp4): **110.0s, 1280×1080, 24fps H.264**, English captions, silent. Ten edited scenes include **8.19s of continuous actual interaction** at original speed. The whole video is not continuous recording. Full local decode and every scene's representative frame, opening and first saved decision were checked. Anonymous download returned HTTP 200 and the identical SHA-256; hosted browser playback has not been separately observed.

| Time       | Content                                                      |
| ---------- | ------------------------------------------------------------ |
| 0–10s      | Full map and actual API→worker→judge-package consequence     |
| 10–18.2s   | Real Apply, original quote and Defer save; saved about 15.6s |
| 18.2–28.2s | Concrete next action and preserved evidence                  |
| 28.2–40.2s | Actual two-tab conflict and comparison                       |
| 40.2–52.2s | New worker source beside original v1                         |
| 52.2–64.2s | Two Revise, one Keep, one Defer                              |
| 64.2–74.2s | Four recorded decisions and actual export                    |
| 74.2–86.2s | Labeled report from actual native inspection                 |
| 86.2–98.2s | Preparation and unmeasured manual/user costs                 |
| 98.2–110s  | Commands, AI/MIT disclosure and local-candidate status       |

The release's `VIDEO_DESCRIPTION_PUBLIC.txt` includes disclosures and public source links. The previous SemVer video remains preserved. The approved video's local-candidate end card is historical; the release notes identify the published version without changing its bytes. A submission-compatible hosted video link and logged-out playback still need verification before Devpost submission. Loopback addresses remain local only.

## Submission status

| Requirement                    | State                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Public current source/topics   | Candidate branch and draft PR published; tagged candidate CI passed; topics checked            |
| Meaningful Relate/reproduction | Native tests, three cases and package available; final evidence in STATUS/QA                   |
| Video within two minutes       | 110s MP4 published; anonymous download/hash passed; submission-compatible playback outstanding |
| Description/disclosure         | Updated to real Ripple case and manual/AI provenance                                           |
| Participant/submission facts   | Eligibility, team, reused-work declarations and Devpost review/submission need the participant |
| User effectiveness             | No independent participants or preparation-inclusive time-saving result                        |

Public candidate publication is complete; final Devpost submission remains separate. [RETROSPECTIVE](learning/RETROSPECTIVE.md) records the public candidate, without treating it as the submitted version. Freeze the actual submitted commit, artifact hashes, public URLs and receipt when submission happens.
