# AI and tool-use disclosure

Updated: 2026-11-13 KST. Scope: the published M0/M1 implementation.

## AI-assisted development

OpenAI Codex assisted the project setup, architecture, application code, synthetic scenario, tests, debugging, browser checks and documentation. The participant supplied the product direction, requested the M0/M1 scope and selected the repository and MIT license. AI-produced work remains subject to the participant's review and responsibility; this disclosure does not claim that every line received an independent human review.

The project config and `npm run ai` request **GPT-6 Astra (`gpt-6-astra`) with high reasoning** for future coding sessions. A separate Astra inference was not invoked or verified during setup. The existing chat's underlying model was not independently verified, so this document does not identify it as Astra merely because of a config file.

No additional agents or paid AI API calls were launched for the implementation. The application has no runtime LLM, automatic extraction or agent orchestration. Sources, names and relationships in the sample are synthetic and seeded explicitly; impacts are computed by the real Relate database.

## Product and verification tools

- Relate 1.0.1: embedded native graph storage, parameterized Cypher traversal, transactions, WAL and checkpoints.
- React, Vite and TypeScript: interface and build; Express and Zod: local API and validation.
- Node test runner: database, API, rollback and separate-process persistence tests.
- Connected browser tooling: actual desktop/mobile interaction, source inspection, apply/review persistence and failure/retry checks. See [QA](QA.md) for the observed scope.
- Git and GitHub Actions: source publication and repeatable Windows verification. Fonts and icons are listed in [third-party notices](../THIRD_PARTY.md).

These checks establish behavior on the synthetic sample and regression cases. They do not establish extraction accuracy, production readiness or measured customer outcomes. Demo/video and Devpost submission remain separate tasks.
