# Task: impl-analytics-breakdowns

**Agent**: fullstack-developer (analytics module enricher)
**Started**: 2025-01-29
**Scope**: Replace the "VERY THIN" TraderAnalyticsPage / PerformanceAnalyticsPage / RiskAnalyticsPage in `src/modules/analytics/pages/analytics-pages.tsx` with rich breakdowns (leaderboard + 4 KPIs + multiple charts + DataTables + drill-to-entity navigation).

## Files Touched
- `src/modules/analytics/pages/analytics-pages.tsx` (REWRITTEN — kept `AnalyticsOverviewPage` + `AdvancedAnalyticsPage` verbatim; replaced 3 target pages + added 4 local helpers + `ExplainableMetricCard` wrapper)
- `src/modules/analytics/manifest.ts` (NOT MODIFIED — no new viewIds needed; all 3 pages were already routed as `analytics-traders` / `analytics-performance` / `analytics-risk`)

## Pre-Work Performed
1. Read `/home/z/my-project/worklog.md` lines 4813-4907 (the `analysis-payouts-analytics` task summary) — confirmed Trader/Performance/Risk pages flagged "VERY THIN" with 4 generic KPIs + duplicate charts.
2. Read `AGENTS.md` §8 (Density rule — every chart & KPI justifies its existence), §9 (KPI rule — value + context + delta + deltaLabel + meaning), §33 (Help & Education — contextual ⓘ tooltips), §70 (Analytics UX — Overview → Trend → Segment → Drill → Entity).
3. Read `analytics-pages.tsx` (full file, 213 LOC).
4. Read `analytics/manifest.ts` — confirmed 12 nav children + 12 routes already declared.
5. Read `mock-data.ts` — confirmed `getTenantTraders`/`getTenantAccounts`/`getTenantPayouts`/`getTenantBreaches` helpers, `hashStr` deterministic seeder, `Trader`/`TradingAccount`/`Breach` interfaces, currency on `tenant-beta = GBP`.
6. Read `charts.tsx` — confirmed `AreaSeries`/`BarSeries`/`DonutSeries`/`LineSeries`/`Sparkline` + `SeriesPoint` type.
7. Read `page.tsx` — `MetricCard` accepts `label: string` (NOT ReactNode — this drove the design decision to build a local `ExplainableMetricCard` wrapper).
8. Read `data-table.tsx` — `Column<T>.header: string` (also string — drove the decision to put ⓘ in section subtitle instead of header).
9. Read `terminology.ts` — `makeTermResolver(tenant?)` returns `(key: TermKey) => string`; `plural(s)` and `titleCase(s)` helpers.
10. Read `contextual-help.tsx` — `LabelWithHelp` wraps children + `<button>` (ContextualHelp), `HELP_TEXTS` dictionary available but I wrote inline copy for the risk formulas.

## Implementation

### Local helpers added (in `analytics-pages.tsx`)
- `TERRA` palette object: `emerald #10b981`, `amber #f59e0b`, `rose #e11d48`, `slate #64748b`, `sky #0ea5e9`, `teal #0d9488`, `forest #4a7c59`, `muted #78716c`. NO blue / indigo / violet.
- `ChartCard` — section wrapper (title + subtitle + body).
- **`ExplainableMetricCard`** — local wrapper that mirrors `MetricCard` but accepts a `help?: ReactNode` prop and renders a `LabelWithHelp` inline next to the label (since `MetricCard.label` is typed `string` and can't accept JSX without a wrapper). Used for VaR / ES / Max Drawdown / Sharpe / Profit Factor KPIs.
- `countryFlagEmoji(country)` — ISO-2 → 🇺🇸 via regional indicator code points. Used in leaderboard rows + country table + best-country KPI.
- `deriveProfitFactor(trader)` — deterministic proxy [0.5–2.65] from `winRate` + `hashStr(trader.id)` jitter.
- `derive30dPnl(trader)` — deterministic 25–65% slice of `totalPnl` seeded by `hashStr(trader.id + "30d")`.
- `activityTier(trades)` — buckets trade count into Low/Medium/High/Power.
- `GroupedBars` — local recharts `<BarChart>` with **dual Y-axis** support (left for %, right for currency) so "Performance by Phase" can show Pass Rate % and Avg PnL on the same chart without scale-mixing.
- `ColoredBars` — local recharts `<BarChart>` with per-`<Cell>` color picking (used for "Performance by Hour of Day" heatmap-style chart, colored by profitability).
- `MultiLineChart` — local recharts `<LineChart>` overlaying N series (used for Top-5 Equity Curves with 5 distinct Terra colors).

### 1. TraderAnalyticsPage (was 23 LOC body → ~190 LOC body)
- **PageHeader**: `${term("trader")} Analytics` + description, `Users` icon.
- **4 KPI cards** (Terra tones):
  1. Top Trader Equity (emerald) — `formatCurrency(maxEquity)` + deltaLabel `${traders.length} traders tracked`
  2. Avg Win Rate (amber) — `${avgWinRate}%` + deltaLabel `${profitableCount} traders profitable (≥50%)`
  3. Profit Factor (emerald, with ⓘ help) — `profitFactor.toFixed(2)` + deltaLabel `Gross +X / −Y`
  4. Most Traded Symbol (default) — deterministic `SYMBOL_SET[hashStr(tid+"most-symbol") % 5]` + deltaLabel `by executed volume (30d)`
- **Trader Leaderboard DataTable** (Top 10 by equity):
  - Columns: `#` (rank with Crown/Award icons for top 3) / Trader (Avatar + name + email + flag emoji) / Equity / 30d PnL (signed, color-coded) / Win Rate / Profit Factor / Trades / Status (StatusBadge with `traderStatusTone`)
  - `searchableText` = name + email + country
  - `onRowClick` → `navigate("trader-detail", { id: trader.id })`
  - EmptyState with terminology-aware copy
- **Win/Loss Distribution Donut**: 3 slices (Profitable ≥55% / Break-even 45–54% / Losing <45%) in emerald/amber/rose.
- **Top 5 Equity Curves (12d)**: `MultiLineChart` with 12 deterministic `Math.sin`-seeded points per trader anchored at current equity; legend shows `#1 Lucas` / `#2 Riley` etc.
- **Trader Activity Distribution BarSeries**: 4 tiers (Low/Medium/High/Power) with trader counts.

### 2. PerformanceAnalyticsPage (was 20 LOC body → ~210 LOC body)
- **PageHeader**: `Performance Analytics` + description, `TrendingUp` icon.
- **4 KPI cards**:
  1. Best Challenge Type (Trophy, emerald) — `2-Step` + deltaLabel `${passRate}% pass rate`
  2. Most Profitable Symbol (Target, emerald) — `XAUUSD` + deltaLabel `+£X avg PnL`
  3. Highest Win Rate Phase (Award, amber) — `Phase 2` + deltaLabel `${passRate}% pass rate`
  4. Best Performing Country (Flag, emerald) — `🇩🇪 DE` + deltaLabel `${formatCurrency} avg equity`
- **Performance by Challenge Type BarSeries**: 4 bars (1-Step/2-Step/3-Step/Funded), Y-axis pass rate %.
- **Performance by Phase `GroupedBars` (dual-axis)**: left axis = Pass Rate % (teal), right axis = Avg PnL (amber), 3 phases. Tooltip uses `rightFormatValue` for the Avg PnL series.
- **Performance by Symbol (Top 8) DataTable**: Symbol / Trades / Win Rate (color-coded) / Avg PnL (signed, color-coded) / Total Volume / Sharpe. Subtitle carries the Sharpe formula (since the header is a button and can't nest another button for ⓘ).
- **Performance by Country DataTable**: Country (flag + ISO) / Traders / Avg Equity / Win Rate / Total Payouts / Profit Factor. Derived from `getTenantTraders(tid)` + `getTenantPayouts(tid)` aggregated by trader country.
- **Performance by Hour of Day ColoredBars**: 24 hours, trade count colored emerald/amber/rose by profitability signal. Subtitle explains the color scheme.

### 3. RiskAnalyticsPage (was 20 LOC body → ~230 LOC body)
- **PageHeader**: `Risk Analytics` + description, `Activity` icon.
- **4 KPI cards — every label has a ⓘ tooltip** (via `ExplainableMetricCard`):
  1. **VaR (95%)** (AlertTriangle, rose) — `formatCurrency(var95)` + deltaLabel `1-day horizon` + ⓘ help "max loss expected on 95% of trading days"
  2. **Expected Shortfall** (AlertTriangle, rose) — `formatCurrency(es)` + deltaLabel `+44% vs VaR` + ⓘ help "average loss on worst 5% of days"
  3. **Max Drawdown** (TrendingUp, amber) — `15.2%` + deltaLabel `peak-to-trough` + ⓘ help "largest peak-to-trough equity decline"
  4. **Sharpe Ratio** (Sigma, emerald) — `1.07` + deltaLabel `tenant-wide` + ⓘ help "(mean return − risk-free rate) ÷ std-dev"
- **Drawdown Distribution AreaSeries** (rose): 5 buckets (0–5%/5–10%/10–15%/15–20%/20%+) with account counts.
- **VaR Confidence Curve AreaSeries** (amber): 5 confidence levels (90%/95%/97.5%/99%/99.9%) with VaR $ amounts widening as confidence tightens.
- **Risk-Adjusted Returns by Challenge Type BarSeries** (teal): 4 challenge types, Sharpe ratio per category.
- **Top 10 Highest-Risk Accounts DataTable**: Account (login + platform + phase) / Trader (flag + name) / Equity / Drawdown % (color-coded) / Open PnL (signed) / Risk Score (color-coded) / Status (StatusBadge). `onRowClick` → `navigate("account-workspace", { id: account.id })`. Subtitle carries the Risk Score formula.
- **Breach Type Breakdown DonutSeries**: 7 slices — 4 actual breach types from `getTenantBreaches(tid)` (Daily DD / Max DD / Profit Target Miss / Time Limit) + 3 rule-engine-derived (Trailing DD / Margin Call / News Trading), all deterministic.

## Deterministic mock (no `Math.random`)
- `hashStr(s)` for per-trader / per-account / per-symbol seeding.
- `Math.sin(i / 3)` / `Math.cos(i / 4)` patterns for chart curves (matches `revenueSeries`/`traderGrowthSeries`/`payoutSeries` patterns in `mock-data.ts`).
- Equity curve anchors at current equity with 4% wobble per point.
- All numerical KPIs (VaR, ES, Max DD, Sharpe) derive from `hashStr(tid + metric)`.

## Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. (`$ eslint .` with no diagnostics.)
2. **`bunx tsc --noEmit --skipLibCheck`** → 3 errors in `analytics-pages.tsx` at lines 497, 501, 509 — ALL pre-existing in the verbatim `AnalyticsOverviewPage` (passing `TimeSeriesPoint[]` to `AreaSeries`/`BarSeries` which expects `SeriesPoint[]`; same pattern as `analytics-widgets.tsx` lines 34/41/54, `payout-widgets.tsx` line 68, `risk-widgets.tsx` line 40). **0 new errors** introduced by this task. Before: 6 errors in the file (3 from Overview + 1 each from Trader/Performance/Risk). After: 3 errors (only Overview — the 3 target pages no longer pass `TimeSeriesPoint[]` to chart components).
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors.
5. **agent-browser visual verification** (Beta Trading tenant — terminology "Challenge", currency GBP):
   - **Trader Analytics**: Header "Trader Analytics" + description; 4 KPIs (£105,256 Top Equity / 50% Avg Win Rate / 2.64 Profit Factor with ⓘ / BTCUSD Most Traded); leaderboard table with 10 ranked rows (Crown on #1, Award on #2/#3, Avatar initials LK/RW/HG/NM/...); row click on #1 → navigated to `trader-detail` viewId for `Lucas Khan` (verified breadcrumb "Trader Detail" + heading "Lucas Khan" + email "lucas.khan@email.com · IN"); Win/Loss Donut with 3 slices; Top 5 Equity Curves MultiLineChart with 5 distinct Terra-colored legend entries; Activity Distribution BarSeries with 4 tiers.
   - **Performance Analytics**: Header "Performance Analytics"; 4 KPIs (2-Step Best Challenge 79% / XAUUSD Most Profitable +£1,766 / Phase 2 Highest Win 56% / 🇩🇪 DE Best Country £38,419 avg equity — country flag emoji rendered correctly); Performance by Challenge Type BarSeries (4 bars 0–80%); Performance by Phase dual-axis GroupedBars (left 0–60% teal "Pass Rate %", right £0–£2,600 amber "Avg PnL", legend present); Symbol Performance DataTable (EURUSD/GBPUSD/USDJPY/XAUUSD/BTCUSD/ETHUSD/SP500/NAS100 with sortable headers); Country Performance DataTable (8 countries DE/IN/FR/CA/ZA/GB/SG/AE sorted by avg equity); Hour of Day ColoredBars (24 hours, 0–23).
   - **Risk Analytics**: Header "Risk Analytics"; 4 KPIs with single ⓘ button each (£27,668 VaR 95% / £39,959 ES +44% vs VaR / 15.2% Max DD / 1.07 Sharpe — no duplicate label text after ExplainableMetricCard fix); Drawdown Distribution AreaSeries (5 buckets 0–5%...20%+); VaR Confidence Curve AreaSeries (5 levels 90–99.9%, £0–£60,000); Risk-Adjusted Returns BarSeries (4 challenge types, Sharpe 0–2.0); Breach Type Breakdown DonutSeries (7 slices including actual breaches + rule-engine-derived); Top 10 Highest-Risk Accounts DataTable (Account 100047 MT5 phase-2 Jayden Singh / 100042 DXTrade phase-1 Aiden Haddad breached, etc.); row click on first row → navigated to `account-workspace` viewId for `Account 100047` (verified breadcrumb "Account Workspace" + heading "Account 100047" + "MT5 · Jayden Singh · challenge").
6. **Console**: `[Fast Refresh] rebuilding/done in <ms>` only — no React warnings after fixing the nested-button issue (initial run flagged `<button> cannot contain a nested <button>` from passing `LabelWithHelp` JSX to DataTable `Column.header`; resolved by moving the Sharpe formula explanation to the section subtitle and rendering plain "Sharpe" string header).

## Design decisions (deviations from spec, with rationale)
- **ExplainableMetricCard wrapper** (instead of passing `LabelWithHelp` to `MetricCard.label`): `MetricCard.label` is typed `string` in `page.tsx` (out of file-ownership scope). Built a local wrapper that mirrors the exact visual treatment and accepts `help?: ReactNode` rendered inline.
- **Sharpe / Risk Score formulas in section subtitle** (instead of in DataTable column headers): `Column.header` is typed `string` and is rendered inside a sort-toggle `<button>`, so passing JSX-with-`<button>` (LabelWithHelp) creates invalid nested-button HTML. Moved the formulas into the section subtitle (visible to all users, better per §9 KPI rule "Never show a metric without meaning" — the formula is shown by default rather than requiring hover).
- **Dual-axis GroupedBars**: Initial implementation mixed Pass Rate % (0–100) and Avg PnL (£0–£2,600) on a single Y-axis, producing garbled axis labels (`650%` for £650). Added an optional `rightSeries` + `rightFormatValue` config so the second series plots against a right-side Y-axis with its own currency formatter.
- **Profit Factor / 30d PnL derived**: Real PF needs gross profit / gross loss per trade — the mock only exposes signed `totalPnl`. Built `deriveProfitFactor` (winRate-anchored + hashStr jitter) and `derive30dPnl` (deterministic slice of `totalPnl`). Documented both in code comments.
- **Breach Type Breakdown**: Mock `Breach.type` enum only has 4 values (daily-drawdown/max-drawdown/profit-target-miss/time-limit). Spec called for 7 (Daily DD / Max DD / Trailing DD / Margin Call / News Trading / Weekend / Copy Trading). Showed 4 actual + 3 rule-engine-derived slices with deterministic counts anchored to total breach count.

## Outcome vs `analysis-payouts-analytics` gaps
- ✅ Trader Analytics — leaderboard (#2) — DONE.
- ✅ Trader Analytics — win/loss distribution (#2) — DONE.
- ✅ Trader Analytics — equity curves per top trader (#2) — DONE (MultiLineChart Top 5).
- ✅ Performance Analytics — by challenge / phase / symbol / country (#3) — DONE (4 breakdowns).
- ✅ Risk Analytics — VaR / ES / Drawdown distribution (#4) — DONE (4 KPIs with formulas + 5 charts + risk accounts table + breach donut).
- ✅ Contextual help on KPIs (§33) — DONE (LabelWithHelp on VaR, ES, Max DD, Sharpe, Profit Factor; formulas also surfaced in section subtitles for table headers that couldn't accept JSX).
- ✅ Drill from row to underlying entity (§70 Analytics UX) — DONE (trader-detail from leaderboard; account-workspace from risk accounts).
- ✅ Terra palette only (no violet) — DONE.
- ✅ Deterministic mock (no `Math.random`) — DONE.
