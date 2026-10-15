Working rules:
1. This file is the source of truth: docs/PRODUCT_SPEC.md.
2. Maintain docs/PLAN.md as a phase checklist. Update it at the end of every phase.
3. Record every non-trivial technical decision as a short ADR in docs/DECISIONS.md.
4. Record every external blocker (missing API key, OAuth verification, paid
   access) in docs/BLOCKERS.md, with the exact steps the owner must take.
5. Work in vertical slices. After every slice, run typecheck, lint, unit tests,
   integration tests, and the app itself. Fix failures before moving on.
6. No fake implementations: no empty handlers, no hardcoded results, no buttons
   that do nothing, no placeholder success messages, no fake metrics.
7. When a third-party integration cannot be activated, do three things:
   - implement the real interface;
   - add a clearly labeled development mock (UI badge "DEV MOCK");
   - document the blocker and continue.
8. Make sensible defaults for engineering choices and document them. Ask the
   owner only for genuine product or business decisions.
9. Never commit secrets. Never log tokens, OTPs, passwords, or resume contents.
10. Prefer boring, well-maintained libraries. Pin versions. Verify that APIs and
    packages exist before using them; do not invent endpoints or package names.
11. Begin by inspecting the repository. Then write PLAN.md. Then immediately
    implement Phase 1. Do not stop after planning.