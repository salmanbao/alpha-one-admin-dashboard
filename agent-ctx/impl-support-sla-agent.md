# Task ID: impl-support-sla — Work Record (in progress)

**Agent**: impl-support-sla
**Scope**: Build the Support SLA Management + Breach Dashboard page (`src/modules/support/pages/support-sla-page.tsx`) + register nav + route in `src/modules/support/manifest.ts`.

## Files touched
- NEW `src/modules/support/pages/support-sla-page.tsx`
- EDIT `src/modules/support/manifest.ts` (add `support-sla` nav child + route — Clock icon, order 84)

## Out of scope (per task constraints)
- `src/lib/platform/view-router.tsx` — lead will batch-register the `support-sla` viewId after batch-1 subagents finish.
- `src/modules/support/pages/support-pages.tsx` — owned by previous `impl-support-ticket-drawer` work (Sheet drawer already wired there).
- `src/lib/platform/mock-data.ts` — read-only; SLA policies / breach mock data live inside the new page module.

## Component export name
- `SupportSlaPage` (named export, not default) — matches existing pattern in `support-pages.tsx`.

## viewId
- `support-sla` — used in nav `href`, route `path`, and route `viewId`. Lead will add `"support-sla": SupportSlaPage` to `viewRegistry` in `view-router.tsx`.
