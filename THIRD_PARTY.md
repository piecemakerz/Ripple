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

The sample text, names, graph and application screenshots are synthetic project materials. No customer documents are included. Relate and Neo4j names identify the technology and hackathon; no endorsement is claimed.
