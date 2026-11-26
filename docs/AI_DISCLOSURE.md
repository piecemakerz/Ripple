# AI and tool-use disclosure

Updated: 2026-11-26 KST. Scope: M0/M1, manual ingestion, relationship/history features, public-document evaluation, bilingual guidance, design, review-save protection, source freshness, the actual Ripple change case and local hackathon preparation.

The latest [improvements](HACKATHON_IMPROVEMENTS_2026-11-26.md) use six actual pre-change Ripple source excerpts, captured from the working tree with SHA-256 and explicit null commit provenance. The user chose this case; Codex manually curated its relationships and review reasons and implemented the API/UI changes. It is a developer-authored case, not automatic code analysis, independently annotated evidence, newly discovered work or a measured user benefit. The three-case worksheet now contains 51 subjects; the older 39-subject automated assessment below covers only the two earlier cases.

The revised 110-second presentation includes an 8.19-second continuous real interaction at original speed, edited actual screenshots and a labeled report generated from native inspection. The first decision is saved by approximately 15.6 seconds. It is not a continuous 110-second recording. The four-decision walkthrough and package's one-Defer fixture use separate databases. No music, synthesized voice, additional agents or paid model API calls were used for this follow-up. Reading and manual authoring time were not measured; automatic import duration excludes them.

## AI-assisted development

OpenAI Codex assisted the project setup, architecture, application code, synthetic scenario, tests, debugging, browser checks and documentation. It also curated the two public-document graphs and gold expectations, built their evaluation and review workflows, assessed all 39 semantic subjects with automated provenance, prepared a disposable sample store and drafted submission text and a recording script. The participant supplied the product direction, authorized the development scope, selected the repository and MIT license, and prioritized the hackathon. AI-produced work remains subject to the participant's review and responsibility; this disclosure does not claim that every line received an independent human review.

The project config and `npm run ai` request **GPT-6 Astra (`gpt-6-astra`) with high reasoning** for future coding sessions. A separate Astra inference was not invoked or verified during setup. The existing chat's underlying model was not independently verified, so this document does not identify it as Astra merely because of a config file.

No additional agents or paid AI API calls were launched for the implementation or this preparation. The application has no runtime LLM, automatic extraction or agent orchestration. The built-in inventory sample is synthetic. The evaluation cases use attributed public-document excerpts with hypothetical scenarios and AI-curated relationships; impacts are computed by the real Relate database. The 39-subject assessment is automated, with human attestation false. The user's delegation of direction is not independent annotation or a personal acceptance of the graph. See [assessment and inference limits](HACKATHON_SEMANTIC_ASSESSMENT.md).

The November 26 follow-up used Codex to recheck the public requirements, implement direct case/review URLs and isolated judge-bundle preparation/inspection, run native and browser regression checks, and prepare a captioned local screen presentation from actual app captures. It did not collect independent human feedback, invoke a runtime model, alter the fixture semantics, or submit the project. A captioned screen presentation is edited evidence, not a continuous real-time recording.

## Product and verification tools

- Product Design ideation and built-in ImageGen produced three static first-screen/review-screen concepts from actual screenshots. The user delegated a hackathon-based selection; Codex chose concept 3 and used Product Design image-to-code/design QA plus the local frontend guidance to implement and compare it. Generated images are local references, not runtime assets or independent human design validation. See [comparison](DESIGN_CONCEPTS.md) and [design QA](../design-qa.md).
- Relate 1.0.1: embedded native graph storage, parameterized Cypher traversal, transactions, WAL and checkpoints.
- React, Vite and TypeScript: interface and build; Express and Zod: local API and validation.
- Node test runner: database, API, rollback and separate-process persistence tests.
- Connected browser tooling: actual desktop/mobile interaction, source inspection, apply/review persistence and failure/retry checks. See [QA](QA.md) for the observed scope.
- Git and GitHub Actions: source publication and repeatable Windows verification. Fonts and icons are listed in [third-party notices](../THIRD_PARTY.md).

These checks establish behavior on the sample and curated cases, not extraction accuracy, production readiness or customer outcomes. Current source/native-store and media candidates have evidence in [STATUS](STATUS.md). Publishing matching source/video/store, checking public access and submitting remain outstanding. See [submission runbook](HACKATHON_SUBMISSION.md).
