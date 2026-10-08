# TypeScript Error Report — apps/trader

Command: `bunx tsc --noEmit -p apps/trader` (baseline, before flag removal)

**Total errors: 0** (exit code 0, empty output — `/tmp/opencode/tsc-trader.txt`, 0 bytes)

Verification of the check itself:

- `--listFilesOnly` reports **709 files** checked, including **29 from `packages/ui`** (trader's tsconfig path-maps `@/components/platform/*` → `packages/ui/src/components/platform/*`).
- The shared `packages/ui` errors (ChartFrame, MetricCard icon style, account-health lucide title, guards.tsx React class members) were already fixed in the platform-admin commit `ac47d75`, which is why trader's baseline is clean. Trader's own `src/` contributes no errors.

**Breakdown by folder:**

| Folder | Error Count |
|---|---|
| (all folders) | 0 |
| **Total** | **0** |

Raw output: `/tmp/opencode/tsc-trader.txt`

## Status

- **Errors after: 0** — `bunx tsc --noEmit -p apps/trader` exits 0 with empty output (`/tmp/opencode/tsc-trader-final.txt`, 0 bytes).
- **`ignoreBuildErrors` removed** from `apps/trader/next.config.ts`.
- **Build: PASS** — `bun run build --filter=@pfaas/trader` → exit 0, `✓ Compiled successfully`, `Running TypeScript ... Finished TypeScript`, 1/1 task successful (6 routes generated).
- Quarantined pages: none.
