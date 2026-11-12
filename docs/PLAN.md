# Ripple execution plan

Current authorized scope: Astra development setup + M0 + M1, and publication to `piecemakerz/Ripple` on GitHub. No hosted app deployment or paid extraction API.

1. [complete] Bootstrap isolated Git project, pinned dependencies, Astra config, persistent instructions and reproducible commands.
2. [complete] Prove native Relate persistence, parameterized multi-hop queries and transaction rollback on Windows.
3. [complete] Implement sample/source model, impact service, atomic/idempotent changes and per-change reviews.
4. [complete] Build the change → impact path → evidence → review screen, including responsive and error states.
5. [complete] Run real-DB edge-case/restart tests, browser E2E, typecheck and production build; leave the app runnable and handoff current.

Next milestones (not implicitly implemented): M2 document ingestion and verified candidate extraction; M3 broader review/history UX and evaluation; M4 submission preparation. Consult original handoff for full acceptance.

## Hackathon audit

- [complete] Compare updated official requirements/Rules with the current implementation, rerun native checks, and record findings in `docs/HACKATHON_AUDIT.md`.
- [in progress] Publish the source to the existing public `piecemakerz/Ripple` repository; preserve its MIT license and initial commit, sanitize local paths, document setup/AI use, and verify GitHub Actions.
- [not started] Remaining submission preparation: inspectable sample store, demo, final distribution notices and Devpost submission. These gaps are separate from M2 feature development; repository publication does not mark submission readiness complete.
- [unresolved] Overview and Official Rules disagree on scoring weights and existing-project eligibility. Preserve the discrepancy in planning until clarified by the organizer.
