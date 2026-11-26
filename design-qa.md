# Ripple Map design QA — 2026-11-15

## Later refinement after user rejection

The user subsequently rejected the aesthetic finish. The historical pass below established the inspected implementation and reference comparison, **not user aesthetic acceptance**. D14 refines the existing flow: white chrome, smaller comparison, less tinted surface area, a primary action above the graph, consistent local Korean type and quieter decision controls. The original generated board is no longer an exact color/surface target. [Current-run audit and before/after evidence](docs/VISUAL_REFINEMENT.md) records the revised intent, 1440/1024/390px observations and remaining limits. Fresh before/after entry and D1-review images were opened together in one comparison input. Their different viewport densities, saved/draft counts and guide states are disclosed, not treated as pixel-level regressions.

Current functional gate: 72/72 and all verify checks passed. No blocking overlap or hidden primary control was observed in the inspected states. User aesthetic acceptance remains pending; this refinement is not a claim of exact fidelity to the rejected colors. The existing wordmark and standard graph/icons remain functional assets; the only added asset is the unmodified local font with its license.

## Historical concept-3 comparison

Selected source visual: `.runtime/product-design-2026-11-15/ripple-map.png`, the third displayed Product Design result, **876×1796 pixels**. Two vertically stacked app states; board labels and outer separator are not product UI. User delegated selection against the hackathon; D13 records concept 3 and the official scoring ambiguity.

Final implementation: `http://127.0.0.1:4353/` fresh entry and `http://127.0.0.1:4352/` saved review. Accepted desktop viewport 1440×1024 CSS pixels; mobile 390×844. Actual screenshot pixel dimensions are recorded below. The source board does not supply CSS viewport/device-density metadata. Compare the app regions proportionally by frame width, excluding board labels, rather than claiming a literal one-pixel match between a two-state board and a single browser screen.

Returned image sizes: desktop entry **1425×1013**, full-page review **1425×1190**, mobile entry and decision **375×812**. Browser-returned image bounds differ from the CSS viewport; the effective screenshot density/cropping was not independently specified by the provider. This report uses proportional composition and readable content comparison, not pixel-level measurements or a claimed 1:1 device capture.

State difference: the source review shows D1/Revise with an unsaved reason and 0/4 progress. The final desktop capture shows the same D1/Revise and reason after a real save, with 4/4 progress and a saved receipt. Disabled saved controls, the history disclosure and progress count are expected state differences. Functional unsaved/failure/retry states were tested separately. The source has no mobile frame; mobile is a responsive usability check, not source-image pixel fidelity.

## Final findings

No open P0/P1/P2 issue remains in the inspected entry, selected-proof and review states. The final source board, desktop entry, full desktop review and mobile decision capture were opened together in the same comparison input after the fixes below. Header, hero, diagram, evidence and form text are legible in that input; a separate cropped comparison was unnecessary. The 390px proof/decision captures additionally expose the small reading and form controls at readable scale.

Accepted differences: real data auto-layout places D2 above D1; node height/position follows measured labels, not fixed mock coordinates. Actual graph controls/attribution, source versions/ranges, explicit Apply, saved-history controls and optional guidance add information absent from the concept. Desktop has more breathing room at its wider aspect ratio. These are product/data constraints, not claims of exact image replication. The original wordmark and existing standard icons remain; no standalone reference illustration or photograph needed substitution.

## Iteration history

- **P1, fixed:** optional walkthrough, workflow overview and receipt occupied the top half of the review viewport in `ripple-map-review-top-initial.jpg`. General help now collapses/hides without unmounting draft state; active/paused guidance remains. Receipt and navigation are compact. `ripple-map-review-desktop-full.jpg` shows the selected item, graph and decision directly below navigation.
- **P2, fixed:** first-screen lane labels were spread across the full container while graph nodes used a centered layout in `ripple-map-entry-initial.jpg`. The legend now shares the graph's natural 900px maximum width. `ripple-map-entry-desktop.jpg` confirms aligned premise/decision/task headings.
- **P2, fixed:** review-stage focus scrolled past the item heading. Programmatic content focus now retains the top heading context. The full final review capture includes navigation and selected-item title.
- **P2, fixed:** mobile's primary entry action sat after a tall vertical map. The same action group now precedes the graph in DOM order; `ripple-map-entry-mobile.jpg` shows the CTA in the initial viewport. Selecting a node focuses its proof rather than leaving the user at the map.
- **P2, fixed:** sticky review navigation covered the mobile reason area during focus/scroll. `.ripple-review .studio-navigation` now uses normal flow. `ripple-map-review-mobile.jpg`, captured after the final build/reload, shows the whole form and save actions unobstructed; the saved amendment is retained.

The first report remained blocked while these findings were open. Accepted final evidence replaces that result; the initial screenshots remain iteration records, not final proof.

## Required fidelity surfaces

- **Fonts/typography:** existing local Space Grotesk headings and IBM Plex Sans reading/UI retain Korean sans fallback. The source does not identify a font. Actual heavy headline, two-line desktop wrapping, legible Korean labels, normal-weight English quotations and distinct form/title hierarchy follow the reference. Exact generated glyph/anti-aliasing identity is not claimed. Mobile wraps naturally without truncating source or reason text.
- **Spacing/layout:** left-aligned hero and source comparison, centered three-column native graph, desktop evidence/decision split and compact help follow the target hierarchy. Real controls and provenance require additional height. Narrow screens stack the regions, use a vertical graph and keep actions reachable. No horizontal document overflow was observed at 390px (375px client/scroll width).
- **Colors/tokens:** forest `#153f43`, teal `#007f78`, mist `#f7fbfa`, ink `#15363c`, apricot `#ffdc9c`, task blue `#e9f4ff` implement the inferred source palette. Selection, source and task states use text/icons as well as color. The saved state intentionally differs from the reference's unsaved button. Exhaustive numeric contrast auditing was not performed.
- **Image quality/assets:** existing ring wordmark, Lucide icons and live React Flow visualization are sharp, functional product assets. There is no separate photo/illustration in the target. The generated raster is never embedded as a fake interactive map. No runtime remote image dependency was added.
- **Copy/content:** the entry question and real-time→daily comparison preserve the concept's story. Korean translations are reading aids; original English proof is expanded and exact. Keep means still valid, Revise means a decision to change, Defer means revisit; none claims implementation completion. Real identifiers, source versions/ranges and saved results come from native data. No auto-filled reason or invented saved status.

## Evidence and behavior

- Desktop: [entry](docs/evidence/ripple-map-entry-desktop.jpg), [full review](docs/evidence/ripple-map-review-desktop-full.jpg), [failed save](docs/evidence/ripple-map-review-failure.jpg).
- Mobile: [entry](docs/evidence/ripple-map-entry-mobile.jpg), [selected proof](docs/evidence/ripple-map-proof-mobile.jpg), [original](docs/evidence/ripple-map-source-mobile.jpg), [final decision](docs/evidence/ripple-map-review-mobile.jpg), [English entry](docs/evidence/ripple-map-entry-en.jpg).
- Native flow: actual four impacts/T3 exclusion, direct/indirect original proof, explicit Apply, all decisions, failed writes/retry, 4/4 reload, literal bilingual draft retention and two-entry T1 history verified. Full observations: [QA](docs/QA.md).
- Final gate: `npm run verify`, 72 passed / 0 failed, formatting/types/skills/native context/production build. No backend or dependency change.

## Open verification and follow-up polish

The extra 1024px viewport attempt produced inconsistent browser metrics/captures, was cleared and discarded; it is not a passed tablet check. Independent novice comprehension, physical touch devices, screen readers and exhaustive contrast measurements remain unverified. This visual acceptance is limited to the inspected desktop/mobile states. Generated image fidelity and automated checks cannot establish improved understanding or hackathon scores.

P3 optional polish: explore a stable sibling order if actual users find the D2/D1 layout harder to follow; preserve data-driven layout and keyboard item selection. Do not hard-code sample coordinates merely to mimic the board.

## Implementation checklist

- [x] Preserve native relationships, evidence and explicit save semantics.
- [x] Fix/recapture each actionable layout finding and compare source plus final render together.
- [x] Check typography, layout rhythm, colors, assets and actual copy.
- [x] Exercise desktop/mobile primary, failure, retry, persistence and language behavior.
- [x] Record accepted deviations and unavailable checks; retain a fresh local preview.
- [ ] Observe an unfamiliar user's indirect-impact explanation and first personal review (X06/X07); rehearse the short hackathon narrative (X09).

final result: passed
