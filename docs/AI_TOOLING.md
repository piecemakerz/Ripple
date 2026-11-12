# Ripple AI development tooling

Configured on 2026-11-13 KST. Skills live in `.agents/skills` so they travel with Ripple and do not change the user's other projects. Their metadata is discoverable; detailed instructions are loaded only for a relevant task. [Codex skill locations](https://learn.chatgpt.com/docs/build-skills)

## Installed skills

| Skill                         | Use                                                                      | Source                                                                              |
| ----------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `relate`                      | Node/TypeScript graph queries, parameters, transactions and result types | `relatedb/relate` v1.0.1, matching the installed npm package                        |
| `vercel-react-best-practices` | React state, rendering, request patterns and performance                 | Vercel `agent-skills`, commit `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`            |
| `web-design-guidelines`       | UI/accessibility reviews                                                 | Same Vercel snapshot; the skill retrieves current interface guidelines when invoked |
| `ripple-verify`               | Native DB, relevant browser checks, CI and honest handoff evidence       | Maintained in this repository                                                       |

The three upstream snapshots were installed with the bundled `skill-installer` helper after reviewing their instructions and sources. The local skill was initialized and validated with `skill-creator`. Upstream skill content is retained unchanged; license notices are under `.agents/licenses` and [THIRD_PARTY.md](../THIRD_PARTY.md). Formatter exclusions preserve upstream files; a narrow Git whitespace exemption preserves Vercel's existing Markdown/example whitespace. Ripple's own files retain normal checks.

`.agents/skills-lock.json` is Ripple's snapshot manifest, not an npm or Skills CLI lockfile. It records origin/ref, file counts and SHA-256 over sorted paths and LF-normalized text. `npm run ai:doctor` checks the entire installed snapshot and confirms the Relate skill matches the pinned npm package. Normalizing line endings avoids a false mismatch between Git's Windows checkout and npm's LF text. New upstream revisions require review and an intentional manifest update; no automatic updater is installed.

Keep the React guidance specific to this Vite application. Next.js/RSC examples do not apply by default. Prefer individual relevant rule files to loading the whole compiled guide. Retain the project's evidence and transaction invariants. The focused selection follows [OpenAI's Astra skill guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra), which cautions against bloated, overlapping instructions.

## Available commands

```powershell
npm run ai:doctor
npm run relate:context
npm run ai:check
npm run ai
npm run ci:status
```

- `ai:doctor`: local skill discovery/format/integrity checks. No account, network, model or persistent DB access.
- `relate:context`: version-matched reference paths and a native parameterized in-memory read.
- `ai:check`: both checks plus Codex CLI/login checks; no inference.
- `ai`: runs both checks, then launches Codex with the existing `gpt-6-astra`/high selection and concise project context. It does not change an already running chat's model.
- `ci:status`: a public, read-only GitHub API request for Verify Ripple on the exact committed HEAD. Exit 0 = passed, 2 = no run/pending, 1 = failed/request error. Uncommitted edits are reported separately and are never implied to be covered by a green HEAD. The command does not push, rerun workflows, post comments or store credentials. A private fork would need a connected account/tool instead.

`npm run verify` includes the skill checks. `npm run reproduce` copies the skill directory into its disposable checkout so a clean install exercises the same setup. Only `ai` starts a model session; it was not invoked during this tooling setup.

## Plugins and existing capabilities

- **GitHub:** **installed and connected**. The plugin confirmed the authenticated `piecemakerz` account, access to `piecemakerz/Ripple`, and successful Windows CI steps for the tooling commit. Use it for repository/PR/CI inspection; existing Git publication and the public CI status command remain available. Connection is not blanket authorization to post comments or perform unrelated mutations.
- **Browser/computer use:** already available in this Codex environment and previously used for Ripple's desktop/mobile acceptance. No second browser automation stack was installed.
- **OpenAI Docs:** already installed as a system skill; used for current Codex guidance. A second documentation plugin is unnecessary for the current task. No OpenAI product API key was added.
- **Deferred:** Figma without a design source, issue trackers without a team workflow, hosting plugins, model extraction APIs and autonomous multi-agent orchestration. These are not required for the current local MVP.

Codex CLI 0.106.0's `skills/list` reported all four as enabled repository skills with zero loader errors. The probe only initialized the app server and listed skills; it did not start a chat or invoke a model. New skills should be available on the next turn. If the desktop does not refresh its skill list, reopen the project/chat. Actual model selection/inference is not claimed by this discovery check.
