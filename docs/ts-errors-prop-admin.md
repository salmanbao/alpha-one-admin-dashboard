# TypeScript Error Report — apps/prop-admin

Command: `bunx tsc --noEmit -p apps/prop-admin` (baseline, before fixes)

**Total errors: 54** (exit code 1)

Raw output: `/tmp/opencode/tsc-prop-admin.txt`

**Breakdown by folder:**

| Folder | Error Count |
|---|---|
| `packages/ui/src/components/platform/` | 9 |
| `apps/prop-admin/src/modules/kyc/pages/` | 8 |
| `apps/prop-admin/src/modules/analytics/pages/` | 6 |
| `apps/prop-admin/src/modules/support/pages/` | 4 |
| `apps/prop-admin/src/modules/overview/` | 4 |
| `apps/prop-admin/src/modules/risk/pages/` | 3 |
| `apps/prop-admin/src/modules/analytics/widgets/` | 3 |
| `apps/prop-admin/src/components/platform/` | 3 |
| `apps/prop-admin/src/modules/payouts/pages/` | 2 |
| `apps/prop-admin/src/modules/analytics/` (manifest) | 2 |
| `apps/prop-admin/src/lib/platform/` | 2 |
| `apps/prop-admin/src/components/shell/` | 2 |
| `apps/prop-admin/src/modules/settings/` | 1 |
| `apps/prop-admin/src/modules/risk/widgets/` | 1 |
| `apps/prop-admin/src/modules/payouts/widgets/` | 1 |
| `apps/prop-admin/src/modules/challenges/pages/` | 1 |
| `apps/prop-admin/src/lib/` (db.ts) | 1 |
| `apps/prop-admin/.next/types/app/` (generated) | 1 |
| **Total** | **54** |

**Breakdown by error code:**

| Code | Count | Meaning |
|---|---|---|
| TS2322 | 15 | Type not assignable |
| TS2339 | 14 | Property does not exist |
| TS2367 | 8 | Comparison has no overlap |
| TS2353 | 6 | Unknown property in object literal |
| TS2552 | 3 | Cannot find name (typo) |
| TS2304 | 3 | Cannot find name |
| TS2869 | 1 | `??` right operand unreachable |
| TS2769 | 1 | No overload matches |
| TS2537 | 1 | Interface has no index signature |
| TS2344 | 1 | Generic constraint (generated layout) |
| TS2305 | 1 | No exported member |
| **Total** | **54** | |

**Note:** `packages/ui` errors are pulled in via workspace imports (path-mapped through
tsconfig) and counted here because they surface in this app's tsc run.

## Detail

1. `.next/types/app/layout.ts(14,13)` TS2344 — `materialSymbols` exported from `src/app/layout.tsx`, rejected by Next's generated layout export constraint. Fix: drop the `export` keyword (only used inside the layout).
2. `src/components/platform/account-health.tsx(70,74)` TS2322 — lucide `Info` does not accept `title`. Fix: wrap in `<span title={...} className="cursor-help">` to keep the native tooltip.
3. `src/components/platform/dashboard-grid.tsx(136,68)` TS2339 — `p.hidden.size` on `string[]`. Fix: `p.hidden.length` (matches every other use of `p.hidden` in the same file).
4. `src/components/platform/live-equity-curve.tsx(108,23)` TS2322 — `Point[]` not assignable to `SeriesPoint[]`. Fix: add `[key: string]: string | number` index signature to `Point` (same shape as `SeriesPoint` in `charts.tsx`).
5. `src/components/shell/sidebar.tsx(93,64)` TS2322 — `TermFn` declared `(k: string) => string` but `makeTermResolver` returns `(key: TermKey) => string`. Fix: type `TermFn` as `(k: TermKey) => string`.
6. `src/components/shell/sidebar.tsx(149,28)` TS2537 — `ResolvedNavigation[number]` indexes an interface. Fix: `item: ResolvedNavigation` (interface; `resolveNavigation()` returns `ResolvedNavigation[]`).
7. `src/lib/db.ts(1,10)` TS2305 — `PrismaClient` not exported by `@prisma/client` (client never generated). Fix: `bunx prisma generate` in `apps/prop-admin` — generated Prisma Client v6.19.3 from `prisma/schema.prisma`. No source change.
8. `src/lib/platform/mock-data.ts(697,9)` TS2322 — seed assigns `"in-progress"`, missing from `TradingAccount.status`. Fix: widen the union (`"active" | "breached" | "passed" | "pending" | "in-progress" | "blocked"`); the UI already renders both extra values.
9. `src/lib/platform/mock-data.ts(806,7)` TS2322 — `phase` possibly `undefined`; guard only excluded `"none"`/`"funded"`. Fix: also exclude falsy `challengePhase` (`!t.challengePhase ||`). Runtime-neutral: `seedTraders` (the only trader creation path) always assigns `challengePhase`.
10. `src/modules/analytics/manifest.ts(47,5)` TS2353 — `path` does not exist on `NavigationItem`. Fix: convert to a proper nav item (`id`/`label`/`href`/`permission`). It never rendered before (sidebar `go(undefined)` no-ops); it now deep-links to the already-registered `trader-performance` view — appearance unchanged.
11. `src/modules/analytics/manifest.ts(74,5)` TS2353 — same stray entry inside the `widgets` array. Fix: delete it (the real route stays registered at `routes` line 64).
12–14. `src/modules/analytics/pages/analytics-pages.tsx(497,501,509)` TS2322 — `TimeSeriesPoint[]` not assignable to `SeriesPoint[]`. Fix: index signature on `TimeSeriesPoint` (see #15).
15. `src/modules/analytics/pages/dashboard-tabs.tsx(389,46)` TS2339 — `a.broker` does not exist on `TradingAccount`. Fix: `a.platform` (field holds `"MT5" | "MT4" | "DXTrade"`).
16. `src/modules/analytics/pages/dashboard-tabs.tsx(392,50)` TS2367 — comparison against `"blocked"` had no overlap. Fix: covered by the status union widening in #8.
17. `src/modules/analytics/pages/performance-analytics-page.tsx(29,20)` TS2869 — `?? 0` unreachable. Fix: `(equityCurve.at(-1)?.value ?? 25000) - 25000` (parenthesised so the fallback applies to the lookup, not the subtraction; array is always length 30).
18–20. `src/modules/analytics/widgets/analytics-widgets.tsx(34,41,54)` TS2322 — `TimeSeriesPoint[]` → `SeriesPoint[]`. Fix: add `[key: string]: string | number` to `TimeSeriesPoint`.
21. `src/modules/challenges/pages/competitions-page.tsx(107,15)` TS2304 — `usePlatform` used without import. Fix: add `import { usePlatform } from "@/lib/platform/platform-context"`.
22. `src/modules/kyc/pages/kyc-document-requests-page.tsx(105,79)` TS2322 — `tone="info"` not in `MetricCard`'s tone union. Fix: widen the union in `packages/ui/src/components/platform/page.tsx` with `"info"`.
23–29. `src/modules/kyc/pages/kyc-pages.tsx(119,132,391,476)` TS2339 — `accountName` does not exist on `KycRecord`. Fix: add `accountName?: string` to `KycRecord`; add `?? ""` at the `ExportColumn.value` / `Column.sortValue` call sites only (JSX cells unchanged — `undefined` renders blank, which is current runtime behaviour).
30–33. `src/modules/overview/overview-page.tsx(249,307,320,333)` TS2353 — `deltaLabel` not in `SummaryKpi`. Fix: add `deltaLabel?: string` to the interface (already rendered).
34–35. `src/modules/payouts/pages/payout-pages.tsx(60)` TS2339 — `accountName` does not exist on `Payout`. Fix: `accountName?: string` + `?? ""` at `sortValue`.
36. `src/modules/payouts/widgets/payout-widgets.tsx(145,22)` TS2322 — `TimeSeriesPoint[]` → `SeriesPoint[]`. Fix: see #18.
37–38. `src/modules/risk/pages/risk-group-vs-payouts-page.tsx(216,231)` TS2552 — `filtered` does not exist (did you mean `Filter`?). Fix: `filteredGroups` — the actual variable in scope used by every neighbouring line.
39. `src/modules/risk/pages/risk-label-vs-payouts-page.tsx(243,5)` TS2552 — `exportToCsv` does not exist (did you mean `exportCsv`?). Fix: add `import { exportToCsv } from "@/lib/platform/export-utils"` (matches the sibling risk-group page).
40. `src/modules/risk/widgets/risk-widgets.tsx(53,22)` TS2322 — `TimeSeriesPoint[]` → `SeriesPoint[]`. Fix: see #18.
41. `src/modules/settings/settings-page.tsx(605,51)` TS2769 — catalog icon receives a `style` prop the type doesn't allow. Fix: widen `ModuleManifest.icon` to `ComponentType<{ className?: string; style?: CSSProperties }>`.
42–43. `src/modules/support/pages/support-pages.tsx(298,342)` TS2339 — `accountName` does not exist on `SupportTicket`. Fix: `accountName?: string` (cell sites only; renders blank when absent).
44–45. `src/modules/support/pages/support-sla-page.tsx(338,339)` TS2304 — `useMemo` not imported. Fix: `import { useMemo, useState } from "react"`.
46. `packages/ui/src/components/platform/attention-center.tsx(79,18)` TS2367 — `"trader"` compared against `"prop-admin"` had no overlap. Fix: widen `ApplicationId` to `"super-admin" | "prop-admin" | "trader"` (see #48).
47–48. `packages/ui/src/components/platform/dashboard-grid.tsx(57,175)` TS2367 — same `ApplicationId` overlap issue. Fix: `export type ApplicationId = "super-admin" | "prop-admin" | "trader"` in `apps/prop-admin/src/lib/platform/types.ts` — the package deliberately supports all three shells; the literal had just been narrowed to one.
49. `packages/ui/src/components/platform/dashboard-grid.tsx(296,68)` TS2339 — `p.hidden.size` on `string[]`. Fix: `p.hidden.length` (same as #3).
50. `packages/ui/src/components/platform/gridstack-dashboard.tsx(102,24)` TS2367 — `"super-admin"` overlap. Fix: #48.
51. `packages/ui/src/components/platform/gridstack-dashboard.tsx(322,22)` TS2367 — `"trader"` overlap. Fix: #48.
52. `packages/ui/src/components/platform/live-activity-feed.tsx(55,18)` TS2367 — `"trader"` overlap. Fix: #48.
53. `packages/ui/src/components/platform/live-equity-curve.tsx(38,18)` TS2367 — `"trader"` overlap. Fix: #48.
54. `packages/ui/src/components/platform/live-equity-curve.tsx(108,23)` TS2322 — `Point[]` → `SeriesPoint[]`. Fix: index signature on `Point` (same as #4).

No `@ts-ignore` / `any` suppressions were added. No UI, copy or styling was changed
(beyond moving an existing tooltip `title` from the `<Info>` icon to a wrapping `<span>`).

## Status

- **Errors after: 0** — `bunx tsc --noEmit -p apps/prop-admin` exits 0 with empty output (`/tmp/opencode/tsc-prop-admin-after.txt`).
- **`ignoreBuildErrors` removed** from `apps/prop-admin/next.config.ts`.
- **Build: PASS** — `bun run build --filter=@pfaas/prop-admin` → exit 0, `✓ Compiled successfully in 18.7s`, `Running TypeScript ... Finished TypeScript in 2.5min`, 1/1 task successful, 3m38s (turbo cache miss; raw output `/tmp/opencode/build-prop-admin.txt`).
- **Regression:** `bunx tsc --noEmit -p apps/platform-admin` → exit 0; `bunx tsc --noEmit -p apps/trader` → exit 0 (both re-run after the `packages/ui` edits).
- Quarantined pages: none (baseline had zero stitch errors; `docs/tools/stitch2tsx.py` untouched).
