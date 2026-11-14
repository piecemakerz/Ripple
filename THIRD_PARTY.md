# Third-party notices

Ripple's own source is covered by [LICENSE](LICENSE). Dependencies retain their separate licenses. This repository contains dependency manifests and imports, not vendored dependency source or production bundles. `npm ci` installs the pinned packages and their upstream license files.

| Dependency                                                               | License    | Role                         |
| ------------------------------------------------------------------------ | ---------- | ---------------------------- |
| `@relate/relate` and its native platform package                         | Apache-2.0 | Embedded graph engine        |
| React and React DOM                                                      | MIT        | Interface                    |
| Express                                                                  | MIT        | Local HTTP API               |
| Zod                                                                      | MIT        | Input validation             |
| Lucide React                                                             | ISC        | Icons                        |
| `@fontsource/dm-sans`                                                    | OFL-1.1    | DM Sans font                 |
| `@fontsource/manrope`                                                    | OFL-1.1    | Manrope font                 |
| TypeScript                                                               | Apache-2.0 | Type checking                |
| Vite, React Vite plugin, tsx, Prettier and installed `@types/*` packages | MIT        | Development and verification |

Versions are pinned in `package.json` and `package-lock.json`. For exact copyright and license text, read each installed package's `LICENSE`, `LICENSE.txt`, `OFL.txt` or `NOTICE` files, including transitive dependencies and the native Relate package. This table is a direct-dependency inventory, not an exhaustive audit of a future binary distribution. A release that distributes built bundles or dependencies must retain all applicable upstream license and notice texts.

The inventory sample text, names and graph are synthetic project materials. Evaluation screenshots can also show the attributed public-document excerpts below. No customer documents are included. Relate and Neo4j names identify the technology and hackathon; no endorsement is claimed.

## Public evaluation excerpts

`evaluation/semver-deprecation.json` contains four unmodified excerpts of **Semantic Versioning 2.0.0**, originally authored by **Tom Preston-Werner**, with **the SemVer Team**. Source: [`semver.md` at commit `f99d5485190a47c0863949e7da810a5553e0ed4d`](https://github.com/semver/semver/blob/f99d5485190a47c0863949e7da810a5553e0ed4d/semver.md), under [Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/) ([legal code](https://creativecommons.org/licenses/by/3.0/legalcode)). The upstream document retains its own license; Ripple's MIT license does not relicense these excerpts. Each source records its URL, attribution, original range and hash. Ripple added hypothetical descriptions, release plans, graph relationships and expected results. No endorsement by the authors is implied. Source text in evaluation screen captures has the same attribution and license.

`evaluation/async-owner.json` contains excerpts from Ripple's own MIT-licensed published documents. Both evaluations are AI-curated and not human-validated; see [scope and provenance](docs/EVALUATION.md).

## Agent skills

The checked-in `.agents/skills/relate` snapshot is from [Relate v1.0.1](https://github.com/relatedb/relate/tree/v1.0.1/clients/javascript/.agents/skills/relate), under [Apache-2.0](.agents/licenses/relate-Apache-2.0.txt).

The `vercel-react-best-practices` and `web-design-guidelines` snapshots are from [Vercel agent-skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62). The upstream README declares MIT; original author and license metadata are retained. See [the attribution and MIT permission text](.agents/licenses/vercel-MIT.txt). The reviewed upstream tree contained no separate root LICENSE file. Exact sources and snapshot hashes are in `.agents/skills-lock.json`.

`ripple-verify` and the project validation scripts are Ripple source under the repository's MIT license.
