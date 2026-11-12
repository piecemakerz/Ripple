# Official Relate resources and Ripple decisions

Reviewed: **2026-11-13 KST**. Scope: the four resources linked by the hackathon organizer, compared with Ripple M0/M1. These are implementation references; their example features do not all become submission requirements.

## The four resources

| Resource                                                            | Relevant guidance                                                                                                                                          | Ripple's adoption                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Relate website](https://relatedb.ai/)                              | Embedded graphs connect facts and dependencies; language bindings, CLI and agent interfaces are different entry points.                                    | Keep a native Node engine inside the local API. The A1 dependency traversal and evidence paths are the product's core behavior.                                                                              |
| [Installation guide](https://relatedb.ai/docs/get-started/install/) | Provides a Node package route as well as CLI/agent setup. Agent guidance includes schema inspection, parameters, bounded results and read-only inspection. | `npm ci` installs the pinned native package. Connect its bundled Node skill to development instructions; keep exploratory access away from the running live DB.                                              |
| [Relate source repository](https://github.com/relatedb/relate)      | The Node API defines database opens, parameterized queries, explicit transactions, typed results and durability; release-specific limitations matter.      | Use the installed package's skill/types and the [v1.0.1 Node specification](https://github.com/relatedb/relate/blob/v1.0.1/docs/api/javascript/spec.md). Existing code and native tests exercise these APIs. |
| [Relate Ideas](https://github.com/jexp/relate-ideas)                | A collection of project ideas, itself modeled as a Markdown graph vault. Includes dependency impact and evidence/provenance patterns.                      | Use as design reference. Preserve Ripple's change → impact → original evidence → per-change review workflow and immutable source model.                                                                      |

The reviewed ideas snapshot is commit [`e32f3d8`](https://github.com/jexp/relate-ideas/tree/e32f3d88517776f33eb9d3a9f6a0e1d32eaef600). No idea-vault code or datasets were imported into Ripple.

## Version and surface choices

At review time, npm's latest `@relate/relate` and GitHub's latest published release both reported **1.0.1**. The GitHub default-branch README already included a 1.0.2 shell example. Keep the exact tested dependency and lockfile; a default-branch example is not an upgrade instruction. [Published release](https://github.com/relatedb/relate/releases/tag/v1.0.1)

The [official bundled Node/TypeScript skill](https://github.com/relatedb/relate/blob/v1.0.1/clients/javascript/.agents/skills/relate/SKILL.md) is installed by npm at `node_modules/@relate/relate/.agents/skills/relate/SKILL.md`. Its API matches this app. `AGENTS.md` and the Astra launcher now explicitly direct development sessions to read it before database work; this does not register a global CLI skill or switch the current chat's model.

The upstream CLI's `relate skill install --agent codex` and `relate agent-context` are optional CLI tooling. They have not been installed or run here. Ripple's `npm run relate:context` is a separate **Node-package preflight**: it checks the exact installed version, skill and types, executes one native parameterized read in `:memory:`, and prints the reference locations. It never opens persistent data or calls a model. The launcher and `npm run verify` run this preflight.

CLI, MCP, WASM, vector search and Markdown-vault storage are available design options. The current application needs the embedded Node interface. Adding an independent CLI/MCP process against the live database would conflict with Ripple's single-owner rule. Future inspection/export tools should use a closed copy and read-only access. See the [release limitations](https://github.com/relatedb/relate/blob/v1.0.1/docs/limitations.md).

## Implementation comparison

| Contract                        | Current evidence                                                                             | Decision                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Real native engine              | `Database.open` / `connect` / `query` in `server/store.ts`; separate-process tests           | Retain; no database replacement needed.                                      |
| Parameter binding               | Queries pass values as parameter objects; injection-like values are tested                   | Retain.                                                                      |
| Graph-derived impact            | Confirmed `DEPENDS_ON` paths, deduplication, cycle termination, T3 exclusion                 | Retain; no keyword/owner-based impact shortcuts.                             |
| Explicit transaction boundaries | Change, path snapshot, review creation and revision update roll back together                | Retain; no nested transactions.                                              |
| Durable local storage           | Directory mode, checkpoint and WAL restoration tests                                         | Retain; an inspectable submission copy remains pending.                      |
| Agent context                   | Official package skill existed but was not named in startup instructions                     | Fixed by the context preflight, AGENTS instructions and launcher prompt.     |
| Bounded reads                   | Impact traversal is capped at 8 hops and 500 returned paths; incomplete previews block apply | Retain. This bounds output, not worst-case execution time/memory.            |
| Exact provenance                | Immutable source versions, hashes, UTF-16 quote offsets and per-change snapshots             | Retain; manually edited vault files cannot silently replace source versions. |

## Relevant ideas and the next slice

- [Code Graph](https://github.com/jexp/relate-ideas/blob/main/Project/code-graph.md) uses graph reachability to explain what a code change affects. Ripple applies that pattern to product assumptions, decisions and tasks. It does not claim to parse source code or resolve imports.
- [Policy-Impact Knowledge Graphs](https://github.com/jexp/relate-ideas/blob/main/Project/policy-impact-knowledge-graphs.md) connects modeled impacts to their supporting assumptions and evidence. This supports Ripple's requirement that each confirmed dependency expose an exact source quote.
- [The Judgment Ledger](https://github.com/jexp/relate-ideas/blob/main/Project/the-judgment-ledger.md) proposes tracing model judgments to their inputs. If AI extraction is later authorized, record model identity, source version, prompt/schema version and validation status with each candidate. The present app records human review decisions and makes no model calls.

The next product slice remains M2: document input → immutable source version → manually validated relationship/evidence → graph-derived impact. Automatic extraction can subsequently propose candidates within an agreed provider/budget. Source traceability, candidate/confirmed separation and review history remain acceptance criteria. This review does not implement M2 or change the hackathon's requirements.

## Verification

Run `npm run relate:context`, `npm run ai:check` and `npm run verify`. The first two are development-environment checks and do not invoke a model. See [STATUS](STATUS.md) for the observed results. No application UI or live data was changed in this resource-alignment work.
