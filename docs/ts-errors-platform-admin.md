# TypeScript Error Report — apps/platform-admin

Command: `bunx tsc --noEmit -p apps/platform-admin` (baseline, before fixes)

**Total errors: 19** (exit code 1; verified on two consecutive fresh runs)

Raw output: `/tmp/opencode/tsc-platform-admin.txt`

**Breakdown by folder:**

| Folder | Error Count |
|---|---|
| `apps/platform-admin/.next/types/` (generated export check of `src/app/layout.tsx`) | 1 |
| `apps/platform-admin/src/components/platform/` | 3 |
| `apps/platform-admin/src/components/shell/` | 2 |
| `apps/platform-admin/src/components/ui/` | 1 |
| `apps/platform-admin/src/lib/platform/` | 3 |
| `apps/platform-admin/src/modules/super-admin/` | 3 |
| `packages/ui/src/components/platform/` | 6 |
| **Total** | **19** |

**Note:** `packages/ui` errors are pulled in via workspace imports and counted here because
they surface in this app's tsc run (and are shared with the other apps).

## Detail

1. `.next/types/app/layout.ts(14,13)` TS2344 — `materialSymbols` exported from `src/app/layout.tsx`, rejected by Next's generated layout export constraint. Fix: drop the `export` keyword (only used inside the layout).
2. `src/components/platform/charts.tsx(79,11)` TS2322 — `ChartFrame` children typed `ReactNode`; recharts `ResponsiveContainer` requires `ReactElement`. Fix: type children as `React.ReactElement`.
3. `src/components/platform/dashboard-router.tsx(88,14)` TS2304 — `ViewRenderer` uses `ViewComponent` without importing it. Fix: add `type ViewComponent` to the `view-router` import.
4. `src/components/platform/page.tsx(143,61)` TS2769 — `MetricCard` passes `style` to an icon typed `ComponentType<{ className?: string }>`. Fix: add `style?: React.CSSProperties`.
5. `src/components/shell/sidebar.tsx(93,64)` TS2322 — `TermFn` declared `(k: string) => string` but `makeTermResolver` returns `(key: TermKey) => string`. Fix: type `TermFn` as `(k: TermKey) => string`, narrow `NavigationItem.termKey` to `TermKey`, drop `?? ""` at both call sites.
6. `src/components/shell/sidebar.tsx(150,28)` TS2537 — `ResolvedNavigation[number]` indexes an interface. Fix: `item: ResolvedNavigation` (interface; `resolveNavigation()` returns `ResolvedNavigation[]`).
7. `src/components/ui/sonner.tsx(3,26)` TS2307 — `next-themes` not installed. Fix: add dependency.
8. `src/lib/platform/bulk-export.ts(215,33)` TS2307 — `jszip` not installed. Fix: add dependency.
9. `src/lib/platform/mock-data.ts(751,9)` TS2322 — seed assigns `"in-progress"`, missing from `TradingAccount.status`. Fix: widen the union (UI already handles it).
10. `src/lib/platform/mock-data.ts(860,7)` TS2322 — `phase` possibly `undefined`; guard only excluded `"none"`/`"funded"`. Fix: also exclude falsy `challengePhase`.
11. `src/modules/super-admin/index.ts(31,3)` TS2305 — `DashboardManagerPage` not re-exported by `super-admin-pages`. Fix: add re-export.
12. `src/modules/super-admin/index.ts(32,3)` TS2305 — `PlatformAuditPage` not re-exported by `super-admin-pages`. Fix: add re-export.
13. `src/modules/super-admin/platform-operations-page.tsx(257,21)` TS2367 — inline `as const` tones infer `"positive" | "warning"`, making the `"negative"` branch unreachable. Fix: lift the array to a typed const with `tone: "positive" | "warning" | "negative"`.
14. `packages/ui/src/components/platform/account-health.tsx(70,74)` TS2322 — lucide `Info` does not accept `title`. Fix: wrap in `<span title={...} className="cursor-help">` to keep the native tooltip.
15. `packages/ui/src/components/platform/charts.tsx(79,11)` TS2322 — same `ChartFrame` issue as the app copy. Fix: `React.ReactElement`.
16–18. `packages/ui/src/components/platform/guards.tsx(86,22)`, `(95,50)`, `(107,17)` TS2339 — `props`/`setState` invisible on `ModuleErrorBoundary`. Root cause: no `node_modules/@types` at the repo root, so files under `packages/*` resolved `react` to the plain JS entry (`react/index.js` via `allowJs`) instead of `@types/react`. Fix: add `@types/react` + `@types/react-dom` to the root `package.json` (bun links the same `.bun/@types+react@19.3.0` realpath the apps already use — no duplicate type identity).
19. `packages/ui/src/components/platform/page.tsx(143,61)` TS2769 — same `MetricCard` icon `style` issue as the app copy. Fix: add `style?: React.CSSProperties`.

## Status

- **Errors after: 0** — `bunx tsc --noEmit -p apps/platform-admin` exits 0 with empty output (`/tmp/opencode/tsc-platform-admin-final.txt`).
- **`ignoreBuildErrors` removed** from `apps/platform-admin/next.config.ts`.
- **Build: PASS** — `bun run build --filter=@pfaas/platform-admin` → exit 0, `✓ Compiled successfully`, `Running TypeScript ... Finished TypeScript`, 1/1 task successful (raw output in session; turbo cache miss, 1m18s).
- Quarantined pages: none.
