# Task ID: impl-exports-terminology — Implementation (exports + terminology)

## Summary

Two-part task executed against a PFaaS multi-tenant Next.js 16 dashboard:

1. **Real export wiring** — Replaced 7 toast-only Export buttons with real `exportToCsv` calls. Every Export now produces a CSV file with a timestamped filename and a confirmation toast that reports the exact record count. Filenames follow the pattern `<module>-<scope>-<Date.now()>.csv` (e.g., `payouts-overview-1790192216537.csv`).
2. **Terminology white-label** — Applied `makeTermResolver` (from `@/lib/platform/terminology`) to page headers + KPI labels across 12 module page files. The 3 configurable business keys (`trader`, `challenge`, `payout`) now render tenant-specifically: Alpha → Participant / Evaluation / Withdrawal, Beta → Trader / Challenge / Payout (defaults), Gamma → Candidate / Assessment / Disbursement. Switching tenants in the topbar re-renders all the labels in real-time — no page reload required.

15 files total were modified (4 files received both treatments; the rest received only one).

## Files Modified (Strict Ownership)

### A. Real `exportToCsv` wiring (7 files)
1. `src/modules/payouts/pages/payout-pages.tsx` — Overview Export + new History Export. Shared `payoutExportColumns` constant (9 cols: Reference / Trader / Amount / Currency / Method / Profit Split % / Status / Requested / Processed). Filenames: `payouts-overview-<ts>.csv`, `payout-history-<ts>.csv`.
2. `src/modules/payouts/pages/enhanced-withdrawals-page.tsx` — Two export flows: `batchExport` (selected rows) and `exportAll` (full filtered list). 8-col spec inline. Filenames: `withdrawals-selected-<ts>.csv`, `withdrawals-<ts>.csv`. `batchExport` guards against zero selection with a destructive-variant toast.
3. `src/modules/affiliates/pages/affiliate-pages.tsx` — Overview Export. 10-col spec (Affiliate / Email / Code / Tier / Referrals / Active Referrals / Conversions / Commission Earned / Commission Pending / Status). Filename: `affiliates-overview-<ts>.csv`.
4. `src/modules/marketing/pages/marketing-pages.tsx` — Overview Export. 10-col spec (Campaign / Channel / Status / Budget / Spend / Impressions / Clicks / Conversions / Revenue / ROI %). Filename: `marketing-overview-<ts>.csv`. Did NOT touch `marketing-dashboard-page.tsx` (Subagent 1's territory).
5. `src/modules/crm/pages/crm-pages.tsx` — Overview Export. 8-col spec (Name / Email / Phone / Source / Stage / Owner / Value / Last Interaction). Filename: `crm-contacts-<ts>.csv`.
6. `src/modules/analytics/pages/retention-analytics-page.tsx` — Export CSV. 4-col spec (Country / Total Traders / Repeating Traders / Retention Rate %). Filename: `retention-analytics-<ts>.csv`. Removed now-unused `toast` and `formatCurrency` imports.
7. `src/modules/risk/pages/risk-statistics-page.tsx` — Replaced `exportCsv(rows: number)` toast stub with 3 real `exportToCsv` calls dispatched on the active tab. Filenames: `risk-challenge-stats-<ts>.csv` (6 cols), `risk-country-stats-<ts>.csv` (5 cols), `risk-account-size-stats-<ts>.csv` (5 cols). Removed `toast` import; added `exportToCsv`.

### B. Terminology application (12 files)
1. `src/modules/trading/pages/trading-pages.tsx` — Overview, Traders, Accounts, Positions.
2. `src/modules/challenges/pages/challenge-pages.tsx` — Overview, Active, Passed, Failed.
3. `src/modules/risk/pages/risk-pages.tsx` — Overview, Breaches.
4. `src/modules/payouts/pages/payout-pages.tsx` — Overview, Pending, History (also wired for exports).
5. `src/modules/analytics/pages/analytics-pages.tsx` — Overview, Trader, Performance, Risk, Advanced.
6. `src/modules/affiliates/pages/affiliate-pages.tsx` — Overview (also wired for exports).
7. `src/modules/accounting/pages/accounting-pages.tsx` — Overview, Transactions, Reconciliation.
8. `src/modules/marketing/pages/marketing-pages.tsx` — Overview, Campaigns, Performance (also wired for exports).
9. `src/modules/crm/pages/crm-pages.tsx` — Overview, Contacts, Pipeline (also wired for exports).
10. `src/modules/kyc/pages/kyc-pages.tsx` — Overview, Reviews, Risk (+ new Overview export).
11. `src/modules/support/pages/support-pages.tsx` — Overview, Tickets, Knowledge.
12. `src/modules/ai/pages/ai-pages.tsx` — Overview, Insights, Assistant, Configure.

## Pattern Applied

```tsx
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { usePlatform } from "@/lib/platform/platform-context";

function Page() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  // titles & KPI labels use plural(term(...)) or term(...)
  // descriptions & search placeholders use plural(term(...)).toLowerCase() or term(...).toLowerCase()
}
```

`makeTermResolver(tenant)` returns a `(key: TermKey) => string` — no plural option, so `plural()` from the same module is composed in for plural labels. For lowercase description text, `.toLowerCase()` is chained.

## Verification

- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 56 pre-existing errors (down from 123 because impl-bugs-mockdata fixed some). All 56 are in untouched files. Diff before vs after shows zero new errors — all 15 owned files are type-clean.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 50 lines) — only `✓ Compiled` and `GET / 200` messages; no new runtime errors.
- Visual verification via `agent-browser`:
  - **Alpha tenant (Sarah Chen, "Alpha Capital")** — sidebar shows "Evaluation" and "Withdrawal" (termKey overrides via manifest). Trading → Traders page header reads "Participants" (from `plural(term("trader"))` = "Participants"). Description: "24 participants in this tenant." Search placeholder: "Search participants…". Payouts → Overview header reads "Withdrawals". KPI label "Total Withdrawal". Subheader "All Withdrawals". Export button → real CSV download (toast: "Export ready — payouts-overview-<ts>.csv — 4 records exported.").
  - **Beta tenant (Daniel Cooper, "Beta Trading")** — sidebar shows "Challenge" and "Payout" (default terminology). Page header on Traders reads "Traders". Search placeholder "Search traders…". Payouts Overview header "Payouts". KPI label "Total Payout". Subheader "All Payouts". Tested the new History Export → real CSV download (`payout-history-<ts>.csv`).
  - **Gamma tenant (James Park, "Gamma Futures")** — sidebar shows "Assessment" and "Disbursement". Page header on Traders reads "Candidates". Search placeholder "Search candidates…". Payouts Overview header "Disbursements". KPI label "Total Disbursement". Subheader "All Disbursements".
  - All terminology adapts in real-time on tenant switch (no reload needed — `term` is recomputed every render from `usePlatform().tenant`).

## Constraints Honored

- Did NOT touch `mock-data.ts` (Subagent 1 owns it).
- Did NOT touch `marketing-dashboard-page.tsx` (Subagent 1 owns it).
- Did NOT touch any audit files (Subagent 2 owns them).
- Did NOT touch shell files (Subagent 4 owns them).
- Did NOT introduce new dependencies.
- Kept Terra palette (no blue/indigo/violet introduced).
- Used existing helpers (`makeTermResolver`, `plural`, `exportToCsv`) — did not re-implement.

## Reference to Other Agents' Work

- Subagent 1 (`impl-bugs-mockdata`) — fixed `Math.random` in mock-data.ts, tautology in marketing-dashboard-page.tsx, dead links, Terra palette violations. Their changes are visible at `agent-ctx/impl-bugs-mockdata-implementation.md`. The deterministic `hashStr` they exported from `mock-data.ts` is not consumed by my work but the export shape is preserved.
- Subagent 2 (`impl-audit-module`) — registered the audit FrontendModule, wired real exports to 4 audit pages + JSON download to detail page, wrapped Change History rollback in AlertDialog. Their work is visible at `agent-ctx/impl-audit-module-implementation.md`. They confirmed that the existing `exportToCsv` helper at `src/lib/platform/export-utils.ts` accepts `(rows, columns, filename)` — I followed the same pattern.
- Subagent 4 owns shell files — I did NOT touch sidebar.tsx, topbar.tsx, command-menu.tsx, keyboard-shortcuts-help.tsx, activity-ticker.tsx, or any other shell component. The sidebar's `termKey` rendering (e.g., "Evaluation" instead of "Challenge" for Alpha) is pre-existing infra that my terminology work complements.

## Full Worklog

The complete task record with all per-file edit details has been appended to `/home/z/my-project/worklog.md` (Task ID: `impl-exports-terminology`, after the `---` separator following the previous impl-audit-module entry).
