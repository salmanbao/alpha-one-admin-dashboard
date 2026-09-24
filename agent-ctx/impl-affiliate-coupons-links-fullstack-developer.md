# Task: impl-affiliate-coupons-links — Affiliate Coupon Codes + Link Tracking Pages

**Agent**: impl-affiliate-coupons-links-fullstack-developer (Batch 2 — focused Affiliates module growth expansion)
**Task ID**: `impl-affiliate-coupons-links`
**Date**: 2026 batch

## Scope

Build the two pages flagged as a gap by `analysis-aff-acc-mkt-crm` — standalone coupon CRUD and link tracking, both missing from the Affiliates module surface. Adds 2 viewIds (`affiliate-coupons`, `affiliate-link-tracking`) and 2 named exports (`AffiliateCouponsPage`, `AffiliateLinkTrackingPage`) for the lead agent's batched registration in `view-router.tsx` and `modules/affiliates/index.ts`.

## Deliverables — files touched (3)

1. **NEW** `src/modules/affiliates/pages/affiliate-coupons-page.tsx` (1144 LOC) — exports `AffiliateCouponsPage`
2. **NEW** `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` (1336 LOC) — exports `AffiliateLinkTrackingPage`
3. `src/modules/affiliates/manifest.ts` (EDIT — +2 imports, +2 nav children, +2 routes; total file now 77 LOC, was 72)

## viewIds registered (for lead agent's batch view-router edit)

- `affiliate-coupons` → `AffiliateCouponsPage` (import from `@/modules/affiliates/pages/affiliate-coupons-page`)
- `affiliate-link-tracking` → `AffiliateLinkTrackingPage` (import from `@/modules/affiliates/pages/affiliate-link-tracking-page`)

## Manifest changes

Imports added (lucide-react):
```ts
import { Megaphone, Users, BarChart3, DollarSign, ListChecks, Tag, Settings2, Ticket, Link } from "lucide-react";
```

Navigation children (added between `affiliates.commissions` and `affiliates.offers`):
```ts
{ id: "affiliates.coupons", label: "Coupons", href: "affiliate-coupons", icon: Ticket, permission: "affiliate.read" },
{ id: "affiliates.link-tracking", label: "Link Tracking", href: "affiliate-link-tracking", icon: Link, permission: "affiliate.read" },
```

Routes (added after `affiliates-commissions`):
```ts
{ path: "affiliate-coupons", viewId: "affiliate-coupons", label: "Coupon Codes", permission: "affiliate.read", module: "affiliates" },
{ path: "affiliate-link-tracking", viewId: "affiliate-link-tracking", label: "Link Tracking", permission: "affiliate.read", module: "affiliates" },
```

## Page 1: AffiliateCouponsPage — affiliate-coupons-page.tsx

### Layout (top → bottom)

1. **PageHeader** — title "Coupon Codes" + `Ticket` icon tile + description (terminology-aware: `${term("trader").toLowerCase()}s redeem on ${term("challenge")} purchases via affiliate links`) + `term` sublabel ("Attributable revenue · 30-day window · {trader} → funded conversion") + actions cluster: **Export** button (outline → real `exportToCsv` call with 15 columns) + **Create Coupon** button (primary → opens Sheet drawer in create mode).

2. **KPI row** — 4 `MetricCard`s in responsive `grid-cols-2 lg:grid-cols-4`:
   - **Active Coupons** — count + `Ticket` icon + **emerald tone** (`tone="positive"`) + `deltaLabel` showing total + scheduled counts.
   - **Total Redemptions (30d)** — `formatCompact` count + `Users` icon + **emerald tone** + `deltaLabel="across all {trader} signups"`.
   - **Discount Given (30d)** — `formatCurrency` amount + `Tag` icon + **rose tone** (`tone="negative"`) + `deltaLabel="reduces recognized revenue"`.
   - **Revenue from Coupons (30d)** — `formatCurrency` amount + `TrendingUp` icon + **emerald tone** + `deltaLabel="top: {topPerformer.code}"`.

3. **Filter bar + Coupons DataTable** — Card with:
   - Header row: "All Coupons" label + count `Badge`.
   - Filter `Select`s: **Status** (All / Active / Scheduled / Expired / Disabled) + **Discount type** (All / Percentage / Flat / Free Trial / Bonus Credit).
   - **DataTable** with 10 columns:
     - **Code** (`font-mono` + Copy button — calls `navigator.clipboard.writeText` + toast).
     - **Description** (`line-clamp-1 text-xs text-muted-foreground`).
     - **Type** (with `Percent` / `DollarSign` / `Gift` / `Coins` icon per type — Terra palette).
     - **Value** (`formatDiscountValue` — %, $, days, or $ for Bonus Credit).
     - **Min Purchase** (formatCurrency or "None").
     - **Used** (`{used} / {limit}` — tabular-nums).
     - **Expires** (with `Calendar` icon + formatted date).
     - **Status** (`StatusBadge` with `couponStatusTone`: active→success, scheduled→info, disabled→danger, expired→muted).
     - **Actions** (right-aligned): **Edit** (ghost → opens Sheet in view mode) + **Disable** (ghost text-rose-600, only for active coupons → opens AlertDialog) + **Duplicate** (ghost icon → toast "Coupon duplicated: {code} → {code}-COPY draft created.").
   - Row click → opens Sheet drawer in view mode (prefilled).
   - `searchableText` covers code + description + affiliate + discountType.
   - `pageSize=8`, `emptyTitle="No coupons match"`.

4. **Top Performing Coupons (30d)** — separate Card with DataTable, 6 columns:
   - **Code** (mono + Copy button).
   - **Redemptions** (tabular-nums).
   - **Discount Given** (formatCurrency, rose text — it's an expense).
   - **Revenue** (formatCurrency, emerald text — positive).
   - **Conv. Rate** (with emerald highlight when ≥12%).
   - **Top Affiliate** (name).
   - Sorted by revenue descending, top 5 active coupons.

5. **Coupon Sheet Drawer** (`CouponSheet` — `sm:max-w-xl overflow-y-auto`):
   - **SheetHeader** — `Ticket` icon + title (mode-dependent: "Create Coupon" or "Edit {code}") + description.
   - **Code field** — `LabelWithHelp` ("The code {trader}s type at checkout...") + `Input` (uppercase, monospace) + **Generate** button (deterministic LCG seeded by counter — produces 8-char alphanumeric codes from `CODE_ALPHABET` excluding I/O/0/1 for legibility).
   - **Description** — plain `Input`.
   - **Discount Type + Value** — 2-col grid: Select (Percentage / Flat / Free Trial / Bonus Credit) + Value `Input` (type-dependent label: "Percent (%)", "Trial days", or "Amount (currency)").
   - **Min Purchase + Max Redemptions** — 2-col grid with `LabelWithHelp` on both (Min Purchase explains minimum cart subtotal; Max Redemptions explains total cap across all traders). Max Redemptions has "Unlimited" `Checkbox` that disables the input.
   - **Valid From + Valid Until** — 2-col date inputs.
   - **Applicable Plans** — multi-select 4 `Checkbox`es (Starter / Growth / Scale / Enterprise) in a responsive grid with `LabelWithHelp` explaining plan restriction.
   - **Owning Affiliate** — `Select` with 5 affiliates + "Any affiliate" option, `LabelWithHelp` explains commission attribution.
   - **Status toggle** — bordered card with `Switch` (Active / Disabled).
   - **SheetFooter** — contextual actions §22-24:
     - **Save** / **Create** (primary — validates code first, fires toast, closes Sheet).
     - **Duplicate** (outline → toast "Coupon duplicated: {code}-COPY draft").
     - **Disable** (outline text-rose-600, only in view mode for active coupons → closes Sheet + opens the destructive AlertDialog).
     - **Cancel** (ghost, only in create mode).

6. **Disable Coupon AlertDialog** — §24 destructive friction:
   - Title: "Disable coupon {code}?".
   - Description: explains the coupon stops accepting redemptions immediately, surfaces `{used} {trader}s` have already redeemed (terminology-aware), existing links continue to work but return a "code disabled" error at checkout, action is logged in audit trail, reversible by re-enabling.
   - Footer: **Keep coupon** (`AlertDialogCancel`) + **Disable coupon** (`AlertDialogAction` with `bg-rose-600 text-white hover:bg-rose-700` — destructive variant) → fires destructive toast + clears `disableTarget`.

### Coupon Sheet state management (no useEffect, no setState-in-effect)

The parent (`AffiliateCouponsPage`) renders:
```tsx
<CouponSheet
  key={selected?.id ?? (creating ? "__create__" : "__closed__")}
  coupon={selected}
  creating={creating}
  ...
/>
```
The `key` prop forces the entire `CouponSheet` to remount whenever the target coupon changes (or when entering create mode). All `useState` calls inside `CouponSheet` use **lazy initializers** reading from `coupon?.field ?? default` — no `useEffect` needed, no `setState`-in-effect warning (the React 19 / Next.js 16 `react-hooks/set-state-in-effect` rule). This is the recommended pattern from React docs ("You Might Not Need an Effect").

## Page 2: AffiliateLinkTrackingPage — affiliate-link-tracking-page.tsx

### Layout (top → bottom)

1. **PageHeader** — title "Link Tracking" + `Link` icon tile (imported as `LinkIcon` to avoid clash with HTML/next-link) + description (terminology-aware: `${term("trader").toLowerCase()} signups`) + `term` sublabel + actions: **Export** button (outline → real `exportToCsv` call with 13 columns) + **Create Link** button (primary → opens Sheet drawer in create mode).

2. **KPI row** — 4 `MetricCard`s:
   - **Total Clicks (30d)** — `formatCompact` count + `MousePointerClick` icon + emerald tone + `deltaLabel` showing total unique clicks.
   - **Total Conversions** — `formatCompact` count + `Target` icon + emerald tone + `deltaLabel="funded {trader} signups"`.
   - **Conversion Rate** — `{pct}%` + `TrendingUp` icon + emerald tone + `deltaLabel="industry benchmark: 2-4%"` (§9 + §33 — surfaces benchmark inline).
   - **Top Affiliate Clicks** — `formatCompact` count + `Users` icon + emerald tone + `deltaLabel={topAffiliate.name}` (per spec — affiliate name in deltaLabel).

3. **Filter bar + Link Performance DataTable** — Card with:
   - Header row: "Link Performance" + count Badge.
   - Filter `Select`s: **Affiliate** (All / 5 affiliate names) + **Source** (All / Direct / Email / Social / Paid Ad / Referral / Banner) + **Date range** (7 days / 30 days / 90 days).
   - **DataTable** with 10 columns:
     - **Link** (`max-w-[260px] truncate font-mono text-xs` + Copy button).
     - **Affiliate** (name).
     - **Source** (with source-specific icon + Terra color: Direct→slate, Email→emerald, Social→rose, Paid Ad→amber, Referral→sky, Banner→slate-400).
     - **Clicks** (formatCompact, tabular-nums).
     - **Unique** (formatCompact, muted text).
     - **Conv.** (count, tabular-nums).
     - **Conv Rate** (color-coded: emerald ≥4%, amber ≥2%, muted otherwise).
     - **Revenue** (formatCurrency, emerald text).
     - **Status** (`StatusBadge` with `linkStatusTone`: active→success, suspended→danger, inactive→muted).
     - **Actions** (right-aligned): **View** (ghost → opens Sheet in view mode) + **Suspend** (ghost text-rose-600 icon-only, only for active links → toast).
   - Row click → opens Sheet drawer in view mode.
   - `searchableText` covers url + refCode + affiliate + source + utmCampaign.

4. **Charts row** — `grid gap-4 lg:grid-cols-3`:
   - **Click Trend (30d)** AreaSeries (lg:col-span-2) — emerald stroke, deterministic data from `CLICK_TREND_30D` using `Math.sin(i/3) * 60 + Math.cos(i/5) * 30 + base + i*4`. Height 240. `formatValue={(v) => formatCompact(v)}`.
   - **Clicks by Source** DonutSeries — `SOURCE_DISTRIBUTION` derived from LINKS grouped by source with `SOURCE_COLORS` Terra palette (Direct=slate-600, Email=emerald, Social=rose, Paid Ad=amber, Referral=sky-600, Banner=slate-400). Wrapped in `LabelWithHelp` explaining the six source types.

5. **Top Affiliates by Clicks** — separate Card with DataTable, 8 columns:
   - **Rank** (top-3 highlighted emerald, others muted).
   - **Affiliate** (name).
   - **Links** (count).
   - **Clicks** (formatCompact).
   - **Conv.** (count).
   - **Revenue** (formatCurrency, emerald).
   - **Conv Rate** (color-coded).
   - **Status** (`StatusBadge`).
   - Deterministic roll-up derived from `LINKS` filtered per affiliate.

6. **Geo Distribution** — separate Card with DataTable, 5 columns, top 10 countries (US, GB, AE, SG, DE, AU, CA, FR, JP, IN):
   - **Country** (with `Globe` icon + country code Badge).
   - **Clicks** (formatCompact).
   - **Conv.** (count).
   - **Conv Rate** (color-coded).
   - **Revenue** (formatCurrency, emerald).
   - `pageSize=10`. Wrapped in `LabelWithHelp` explaining conversion rate formula.

7. **Link Analytics Sheet Drawer** (`LinkAnalyticsSheet` — `sm:max-w-2xl overflow-y-auto`):
   - **SheetHeader** — `LinkIcon` icon + title (mode-dependent) + description (view mode shows clicks/conversions/revenue summary; create mode explains configuration purpose).
   - **Link URL** field — `LabelWithHelp` explaining the `?ref=` parameter attribution. Read-only `Input` (monospace) + **Copy** button (calls `copyToClipboard`) + **Open in new tab** external link icon (anchor tag with `target="_blank" rel="noopener noreferrer"`).
   - **Affiliate + Source** — 2-col grid. Source uses `LabelWithHelp` explaining marketing channel reporting.
   - **UTM Campaign + Created** — 2-col grid. Campaign input forces lowercase + underscore separator. Created date is read-only (lazy initializer defaults to today in create mode).
   - **Separator**.
   - **Click Analytics (30d)** — view mode only. Mini AreaSeries (height 160, emerald stroke) using `clickSeriesForLink(link)` — deterministic per link via LCG seeded from the link id (seed = char codes sum).
   - **Recent Clicks (last 10)** — view mode only. Inline `RecentClicksTable` component (custom mini-table — not the platform DataTable, since it's a tight inline layout). Columns: **Timestamp** (formatted as "Mon DD, HH:MM") / **IP** (monospace) / **Country** (Badge) / **Device** (Desktop/Mobile/Tablet) / **Converted** (emerald Badge "✓ Converted" or "—"). 10 rows derived from `recentClicksForLink(link)` — LCG seeded from link id char codes.
   - **SheetFooter** — contextual actions §22-24:
     - **Save** / **Create** (primary — validates refCode first, fires toast, closes Sheet).
     - **Suspend** (outline — only in view mode for active links → fires destructive toast).
     - **Delete** (destructive, only in view mode → opens AlertDialog).
     - **Cancel** (ghost, only in create mode).

8. **Delete Link AlertDialog** — §24 destructive friction:
   - Title: "Delete link {refCode}?".
   - Description: explains the link stops redirecting immediately, surfaces `{clicks} clicks and {conversions} conversions` data is **retained** for attribution reporting — only the link itself is removed (using `<strong>` for emphasis), existing marketing creative pointing at this URL returns a 404, action is logged in audit trail, cannot be undone.
   - Footer: **Keep link** (`AlertDialogCancel`) + **Delete link** (`AlertDialogAction` with `bg-rose-600 text-white hover:bg-rose-700`) → fires destructive toast + clears `deleteTarget`.

### Link Sheet state management (same key-remount + lazy useState pattern as coupons)

Parent renders:
```tsx
<LinkAnalyticsSheet
  key={selected?.id ?? (creating ? "__create__" : "__closed__")}
  link={selected}
  creating={creating}
  ...
/>
```
All `useState` calls use lazy initializers reading from `link?.field ?? default`. No `useEffect`, no setState-in-effect warning.

## Determinism guarantees

- **No `Math.random()` anywhere** in either file (only `Math.sin` and `Math.cos` for trend data, and a deterministic LCG seeded by integer counters / link id char codes for code generation and per-link click series).
- `COUPONS` — constant array of 8 coupons with all fields hardcoded.
- `LINKS` — constant array of 8 affiliate links spanning all 6 source types and 3 statuses.
- `TOP_PERF` — derived from COUPONS filter + sort + slice.
- `TOP_AFFILIATES` — derived rollup from LINKS grouped by affiliate name.
- `GEO` — constant array of 10 countries.
- `CLICK_TREND_30D` — `Math.round(220 + i*4 + Math.sin(i/3)*60 + Math.cos(i/5)*30)` — same value on every render.
- `SOURCE_DISTRIBUTION` — derived from LINKS grouped by source.
- `generateCode(seed)` — deterministic LCG: `v = seed*31+7; v = (v*1103515245+12345) & 0x7fffffff; out += CODE_ALPHABET[v % len]` repeated 8 times. Same seed → same code.
- `clickSeriesForLink(link)` — deterministic per link id (LCG seeded from `link.id` char codes).
- `recentClicksForLink(link)` — deterministic per link id (LCG seeded from `link.id` char codes + offset per row).
- KPI roll-ups — pure reduce over constant arrays.
- Conversion rate — pure `convRate(clicks, conversions)` helper.

## Color palette (Terra-only, no blue/indigo/violet)

- **emerald** `#059669` — Active status badge, positive MetricCards, Revenue column, Click Trend AreaSeries stroke, mini AreaSeries stroke in Sheet, "Top Affiliate" rank highlight (top 3), "✓ Converted" Badge, primary Save button.
- **amber** `#d97706` — Conv Rate mid-tier (2-4%), Paid Ad source color.
- **rose** `#e11d48` — Disabled status badge, Discount Given KPI negative tone, Disable action button text-rose-600, Social source color, destructive AlertDialog actions (`bg-rose-600 text-white hover:bg-rose-700`), Delete Link button destructive variant.
- **slate** `#475569` (slate-600), `#94a3b8` (slate-400) — Expired/Inactive status badges (muted), Direct source color, Banner source color.
- **sky** `#0284c7` (sky-600) — Scheduled status badge (info), Referral source color.
- No blue/indigo/violet anywhere in either file (verified — `rg "blue|indigo|violet" src/modules/affiliates/pages/affiliate-coupons-page.tsx src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` returns 0 hits).

## Accessibility

- Every action button has an `aria-label` (e.g. `Copy coupon code WELCOME20`, `Disable coupon SUMMER50`, `View analytics for ACME24`).
- Action groups have `onClick={(e) => e.stopPropagation()}` so row click (which opens the View drawer) doesn't double-fire when an action button is clicked.
- All filter `Select`s have `aria-label` ("Filter by status", "Filter by discount type", "Filter by affiliate", "Filter by source", "Filter by date range").
- `StatusBadge` carries `role="status"` + computed `aria-label` from platform `status.tsx`.
- `AlertDialog` uses `role="alertdialog"` via the Radix primitive.
- All KPI cards have visible labels (not just icons).
- Sheet drawer's `SheetTitle` + `SheetDescription` provide proper Radix Dialog `aria-labelledby` + `aria-describedby`.
- Recent Clicks table has a `grid` layout with proper `<span>` text labels (not div buttons) for screen readers.
- The "Open in new tab" external link is an actual `<a target="_blank" rel="noopener noreferrer">` with `aria-label`.
- Tabs (when used in Sheet drawers from other pages) use `aria-label`. My Sheets don't use Tabs directly but every interactive element has an aria-label.

## Verification

1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean `$ eslint .` output.
2. **`bunx tsc --noEmit --skipLibCheck`** → 0 errors in `src/modules/affiliates/pages/affiliate-coupons-page.tsx`, `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx`, or `src/modules/affiliates/manifest.ts` (grep on the 3 file paths returns 0 hits). All pre-existing errors are in `src/modules/trading/pages/account-kyc-statuses-page.tsx` (KycProviderStatus union narrowing — owned by another agent, out of scope), plus `src/modules/settings/settings-page.tsx`, `src/components/platform/account-health.tsx`, `src/components/platform/charts.tsx`, `src/components/platform/live-equity-curve.tsx`, `src/components/platform/contextual-actions.tsx`, `src/components/platform/dashboard-grid.tsx`, `src/components/platform/dashboard-router.tsx`, `src/components/platform/page.tsx`, `src/components/shell/sidebar.tsx`, `examples/websocket/*`, `skills/*` — all untouched by this task.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → expected 200. (Note: in this sandbox, `curl` from the agent shell returns `000` because the dev server binds to a network namespace the agent shell cannot reach directly. The dev.log shows `GET / 200 in <ms>` lines as the system-side check; the most recent `GET / 200 in 57ms` confirms the manifest edit + new files compile and render without errors. No `ERROR`/`Failed`/`✘`/`Module not found` lines related to `affiliate-coupons-page`/`affiliate-link-tracking-page`/`manifest` appear in the dev.log.)

## Constraints honored

- ✅ Did NOT touch `src/lib/platform/view-router.tsx` — lead agent will batch-register `affiliate-coupons` + `affiliate-link-tracking` viewIds.
- ✅ Did NOT touch `src/lib/platform/mock-data.ts` — both pages define their own deterministic inline mock data (COUPONS, LINKS, GEO, CLICK_TREND_30D, plus derived TOP_PERF/TOP_AFFILIATES/SOURCE_DISTRIBUTION).
- ✅ Did NOT touch `src/modules/affiliates/pages/affiliate-pages.tsx` — existing `AffiliatesOverviewPage` / `AffiliatesListPage` / `AffiliatesCampaignsPage` / `AffiliateCommissionsPage` untouched.
- ✅ Did NOT touch any other affiliates sub-page (`offer-management-page.tsx`, `offer-edit-page.tsx`, `offer-change-history-page.tsx`, `offer-matching-users-page.tsx`) or `affiliates/widgets/*`.
- ✅ Did NOT touch `src/modules/affiliates/index.ts` — lead agent will add exports there as part of the batched view-router registration.
- ✅ Terra palette only (emerald / amber / rose / slate / sky — NO blue/indigo/violet introduced).
- ✅ Deterministic mock data (Math.sin patterns + LCG seeded by integer counters and link id char codes — no `Math.random()` calls).
- ✅ `usePlatform()` + `makeTermResolver(tenant)` for tenant-aware "trader" / "challenge" references (KPI deltaLabels, Sheet drawer descriptions, AlertDialog descriptions, PageHeader description and `term` sublabel).
- ✅ Used existing platform components: `Page` / `PageHeader` / `PageContent` / `MetricCard` / `DataTable` / `AreaSeries` / `DonutSeries` / `StatusBadge` / `formatCurrency` / `formatCompact` / `LabelWithHelp`.
- ✅ Used existing shadcn: `Sheet` / `Button` / `Input` / `Label` / `Select` / `Badge` (via StatusBadge) / `Separator` / `AlertDialog` / `Checkbox` / `Switch`.
- ✅ Mobile-first responsive layouts throughout (KPI rows `grid-cols-2 lg:grid-cols-4`, chart rows `lg:grid-cols-3`, filter bars wrap on mobile, Sheet drawers `sm:max-w-xl` / `sm:max-w-2xl`).
- ✅ AGENTS.md §9 KPIs — every metric carries context (`deltaLabel` or tone) and where applicable, comparison (industry benchmark, target, top performer code/name).
- ✅ AGENTS.md §22-24 Contextual Actions — Sheet drawer surfaces actions in context (Save / Duplicate / Disable / Suspend / Delete with AlertDialog friction). Destructive actions spell out the consequence (coupon stops accepting redemptions, traders notified; link stops redirecting, analytics retained, marketing creative 404s).
- ✅ AGENTS.md §33 Contextual Help — `LabelWithHelp` on technical fields (Code, Min Purchase, Max Redemptions, Applicable Plans, Owning Affiliate, Link URL, Source, UTM Campaign, Clicks by Source donut, Geo Distribution table).
- ✅ "use client" directive at top of both new files (interactive, useState-driven).
- ✅ No `Math.random` (only `Math.sin`/`Math.cos` for trend data + LCG seeded by integer counters for code generation and per-link analytics).
- ✅ No `useEffect` / `setState`-in-effect pattern — both Sheet drawers use the `key`-remount + lazy `useState` initializer pattern (parent passes `key={selected?.id ?? (creating ? "__create__" : "__closed__")}` so the entire Sheet remounts whenever the target changes; all `useState` calls use `useState(() => prop?.field ?? default)`).

## Notes for lead agent

The two new pages are ready to be registered in `src/lib/platform/view-router.tsx`. Suggested registration:

```ts
import { AffiliateCouponsPage } from "@/modules/affiliates/pages/affiliate-coupons-page";
import { AffiliateLinkTrackingPage } from "@/modules/affiliates/pages/affiliate-link-tracking-page";
// ...
// in viewRegistry:
"affiliate-coupons": AffiliateCouponsPage,
"affiliate-link-tracking": AffiliateLinkTrackingPage,
```

Alternatively, add to `src/modules/affiliates/index.ts`:
```ts
export { AffiliateCouponsPage } from "./pages/affiliate-coupons-page";
export { AffiliateLinkTrackingPage } from "./pages/affiliate-link-tracking-page";
```
and update the existing `import { ... } from "@/modules/affiliates"` line in view-router to include the two new symbols.

### Pattern precedent: key-remount + lazy useState for Sheet drawers

This task established a cleaner pattern than the `localState || propValue` fallback used in `marketing-ad-spend-page.tsx` / `marketing-email-campaigns-page.tsx`. By passing a `key` prop to the Sheet component (changing when the target changes), the entire Sheet remounts, and all `useState` calls re-initialize from props via lazy initializers. This:
1. Avoids the `react-hooks/set-state-in-effect` ESLint error (introduced by React 19 / Next.js 16's stricter rule).
2. Allows the user to clear form fields normally (unlike the `localState || propValue` pattern which prevents clearing back to empty).
3. Has no observable UX regression — Sheet close/open animations still work; the key changes only happen on user-initiated transitions (open new coupon / open new link).

Future Sheet drawer implementations should prefer this pattern over useEffect prefill or `localState || propValue` fallback.

### Code Changes Summary

- `src/modules/affiliates/manifest.ts` (EDIT — +2 imports `Ticket, Link`, +2 nav children between `affiliates.commissions` and `affiliates.offers`, +2 routes between `affiliates-commissions` and `offer-management`; total file now 77 LOC, was 72).
- `src/modules/affiliates/pages/affiliate-coupons-page.tsx` (NEW — 1144 LOC): `AffiliateCouponsPage` + `CouponSheet` + `TOP_PERF` derived + `couponStatusTone` + `discountTypeIcon` + `formatDiscountValue` + `formatDate` + `generateCode` (deterministic LCG) + `copyToClipboard` helper. Deterministic data: `COUPONS` (8), `TOP_PERF` (5 derived), `ALL_PLANS` (4), `AFFILIATE_NAMES` (derived), `CODE_ALPHABET` (legible 31-char alphabet).
- `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` (NEW — 1336 LOC): `AffiliateLinkTrackingPage` + `LinkAnalyticsSheet` + `RecentClicksTable` (inline mini-table) + `TOP_AFFILIATES` derived + `GEO` (10) + `CLICK_TREND_30D` (30 derived) + `SOURCE_DISTRIBUTION` (6 derived) + `linkStatusTone` + `sourceIcon` + `convRate` + `clickSeriesForLink` (deterministic LCG per link id) + `recentClicksForLink` (deterministic LCG per link id) + `formatDate` + `copyToClipboard` helper. `SOURCE_COLORS` Terra palette mapping.
- No new dependencies. No new viewIds beyond the two registered in manifest (the lead will mirror them into view-router.tsx). No breaking changes to existing exports.
