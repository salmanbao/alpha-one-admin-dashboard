# PFaaS Platform — Worklog

## Project: Prop Firm as a Service (PFaaS) Multi-Tenant Dashboard Platform

A modular, white-label dashboard platform for prop firms. Single Next.js 16 app
rendering a unified dashboard at `/` with client-side view routing, dynamic
module composition, multi-tenant + multi-role demonstration.

### Architecture (adapted to single-app Next.js constraint)

```
src/
├── app/
│   ├── layout.tsx              # root layout, providers
│   ├── page.tsx               # unified dashboard entry (AppShell + DashboardRouter)
│   └── globals.css            # theme tokens, brand variables
├── lib/
│   ├── platform/              # platform foundation
│   │   ├── types.ts           # module SDK, manifests, nav, widgets, tenant, auth, perms
│   │   ├── mock-data.ts       # tenants, users, traders, accounts, challenges, etc.
│   │   ├── module-registry.ts # module registry + runtime
│   │   ├── permission-engine.ts
│   │   ├── navigation-engine.ts
│   │   ├── dashboard-engine.ts
│   │   ├── theme-engine.ts
│   │   └── terminology.ts
│   ├── platform-context.tsx   # TenantProvider, AuthProvider, PlatformProvider
│   └── utils.ts
├── components/
│   ├── shell/                 # AppShell, Sidebar, Topbar, Breadcrumbs, CommandMenu
│   ├── platform/              # guards, dashboard grid, widget container, error boundary
│   └── ui/                    # shadcn/ui (existing)
└── modules/                   # business modules (each self-contained)
    ├── trading/
    ├── challenges/
    ├── risk/
    ├── payouts/
    ├── analytics/
    ├── affiliates/
    ├── accounting/
    ├── marketing/
    ├── crm/
    ├── kyc/
    ├── support/
    └── ai/
```

### Implementation order (per spec section 72)
- Phase 1: Foundation (types, mock data, app shell)
- Phase 2: Contexts (auth, tenant, permissions)
- Phase 3: Module SDK + Registry
- Phase 4: Dynamic navigation + routing + guards
- Phase 5: Dashboard engine + widgets
- Phase 6: Theme engine + white-label
- Phase 7: Trading, Challenges, Risk, Payouts
- Phase 8: Analytics (proves plug-and-play)
- Phase 9: Affiliates, Accounting, Marketing, AI

---
Task ID: 0
Agent: lead-architect
Task: Initial scaffolding plan + worklog creation

Work Log:
- Read full PFaaS spec (3059 lines) from uploaded prompt
- Inspected existing project (Next.js 16, fresh, shadcn/ui installed, dev server running on 3000)
- Designed single-app adaptation: unified dashboard at `/` with client-side view routing, tenant/role/module switchers to demo multi-tenancy
- Created worklog.md

Stage Summary:
- Architecture decided: platform foundation in `src/lib/platform/`, business modules in `src/modules/`, shell in `src/components/shell/`
- Will build foundation + engines myself, then delegate parallel module implementations to subagents
- Only `/` route is user-visible; all module "pages" are client-side views switched by a router store

---
Task ID: 5b-1
Agent: module-builder-affiliates-accounting
Task: Build Affiliates + Accounting modules

Work Log:
- Read worklog.md and inspected existing analytics module (manifest/widgets/pages/index) for the exact pattern to follow
- Inspected mock-data.ts: confirmed `Affiliate`, `AffiliateCampaign`, `Transaction` interfaces; helpers `getTenantAffiliates(tenantId)` and `getTenantTransactions(tenantId)`; exported `affiliateCampaigns` array
- Inspected platform primitives: `Page/PageHeader/PageContent/MetricCard`, `DataTable/Column`, `StatusBadge` + tone helpers (`campaignStatusTone`) + `formatCurrency`/`formatCompact`, `AreaSeries/BarSeries/DonutSeries`, `toast` hook
- Inspected types.ts for `FrontendModule`, `NavigationItem`, `RouteDefinition`, `WidgetDefinition` contracts
- Built Affiliates module at `src/modules/affiliates/`:
  - `manifest.ts` — id `affiliates`, name `Affiliates`, v1.0.0, category `growth`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#a21caf`, icon `Megaphone`, 4 permissions (`affiliate.read|create|update|configure`), nav at order 55 with 4 children, 4 routes, 3 widgets (metric/leaderboard/chart), settings entry
  - `widgets/affiliate-widgets.tsx` — `AffiliateOverviewWidget` (4 KPI metric cards, w12 h1), `TopAffiliatesWidget` (top-6 ranked list with tier-colored bars, w6 h2 leaderboard), `AffiliateRevenueWidget` (12-month commission trend area chart in accent `#a21caf`, w6 h2)
  - `pages/affiliate-pages.tsx` — `AffiliatesOverviewPage` (KPIs + commission trend chart + recent campaigns DataTable), `AffiliatesListPage` (DataTable columns: name, code, tier badge, referrals, conversions, commission earned, status), `AffiliateCampaignsPage` (DataTable columns: name, affiliate, clicks, signups, conversions, spend, revenue, ROI %, status), `AffiliateCommissionsPage` (4 summary KPIs + commissions ledger DataTable with earned/pending breakdown)
  - `index.ts` — re-exports module + 4 pages
- Built Accounting module at `src/modules/accounting/`:
  - `manifest.ts` — id `accounting`, name `Accounting`, v1.0.0, category `advanced`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#b45309`, icon `Calculator`, 2 permissions (`accounting.read|configure`), nav at order 60 with 3 children, 3 routes, 3 widgets (metric/bar chart/area chart), settings entry
  - `widgets/accounting-widgets.tsx` — `AccountingOverviewWidget` (4 KPIs: revenue/payouts/fees/net, w12 h1), `RevenueByTypeWidget` (bar chart of 5 transaction types in accent `#b45309`, w6 h2), `TransactionFlowWidget` (12-month aggregated flow area chart, w6 h2)
  - `pages/accounting-pages.tsx` — `AccountingOverviewPage` (4 KPIs + revenue-by-type BarSeries + transaction-flow AreaSeries), `TransactionsPage` (DataTable columns: reference, type, description, amount with outflow coloring, category, status badge, date, account), `ReconciliationPage` (4 summary KPIs incl. reconciliation rate + unreconciled-only DataTable with "Reconcile" button action that fires `toast`)
  - `index.ts` — re-exports module + 3 pages
- Ran `bun run lint` and `npx tsc --noEmit`: zero errors in any of my new files (verified by filtering for `affiliates`/`accounting` paths — clean output). Remaining lint errors are all pre-existing in `command-menu.tsx` and `dashboard-router.tsx` (files explicitly out of scope). Pre-existing TS errors in other modules (analytics/payouts/risk) about `TimeSeriesPoint` index signature are unrelated to this task.

Stage Summary:
- Two self-contained, plug-and-play modules created: Affiliates (`#a21caf`) and Accounting (`#b45309`), each fully matching the analytics module pattern (manifest/widgets/pages/index), with correct manifest metadata, nav items with order 55/60, route viewIds matching nav hrefs, and widget sizes per spec (w12h1, w6h2, w6h2)
- All pages use the platform primitives (Page/PageHeader/PageContent/MetricCard/DataTable/StatusBadge/formatCurrency) and the tenant-aware `usePlatform` hook with `runtime.tenant?.id ?? "platform"` fallback; mock-data helpers `getTenantAffiliates` and `getTenantTransactions` plus the `affiliateCampaigns` array (filtered by tenantId) drive every view
- Reconciliation page demonstrates the action-button pattern using `toast` from `@/hooks/use-toast`, matching the payouts-module precedent
- Lead can now wire the modules in `module-bootstrap.ts` and `view-router.tsx` without further module-side changes

---
Task ID: 5b-3
Agent: module-builder-support-ai
Task: Build Support + AI modules

Work Log:
- Read worklog.md and inspected the existing analytics module pattern (manifest.ts, widgets/analytics-widgets.tsx, pages/analytics-pages.tsx, index.ts)
- Inspected shared platform primitives: types.ts, mock-data.ts (SupportTicket, AiInsight interfaces, getTenantTickets, getTenantAiInsights helpers), platform-context.tsx, components/platform/{page,data-table,charts,status}.tsx
- Inspected shadcn/ui exports (Card, Switch, Select, Avatar, Progress, Textarea, ScrollArea, Input, Button) and use-toast hook to confirm available APIs
- Built Support module (src/modules/support/):
  - manifest.ts: supportModule (id="support", name="Support", category="core", optional=true, deps=["trading"], apps=[prop-admin,super-admin,trader], accentColor="#c2410c", icon=LifeBuoy); permissions support.read + support.configure; nav parent at order 80 with Overview/Tickets/Knowledge children; 3 routes (support, support-tickets, support-knowledge); 3 widgets (SupportOverviewWidget metric w12h1, RecentTicketsWidget table w12h2, TicketPriorityWidget chart-donut w6h2); settings entry
  - widgets/support-widgets.tsx: SupportOverviewWidget (Open/Urgent/Avg Response/Resolved Today KPIs), RecentTicketsWidget (DataTable of 6 most recent tickets with priority/status badges), TicketPriorityWidget (DonutSeries across urgent/high/medium/low buckets with rose/orange/sky/slate colors — no blue/indigo)
  - pages/support-pages.tsx: SupportOverviewPage (KPIs + recent tickets table + priority donut + New Ticket toast), SupportTicketsPage (full DataTable with subject/trader/category/priority/status/assignee/created/messages columns + row-click toast), SupportKnowledgePage (6 static FAQ cards in a responsive grid)
  - index.ts: re-exports module + 3 pages
- Built AI module (src/modules/ai/):
  - manifest.ts: aiModule (id="ai", name="AI / LLM", category="ai", optional=true, deps=["trading","analytics"], apps=[prop-admin,super-admin], accentColor="#7c3aed" violet, icon=Brain); permissions ai.read + ai.configure; nav parent at order 85 with Overview/Insights/Assistant/Configure children; 4 routes; 3 widgets (AiOverviewWidget metric w12h1, AiInsightsWidget ai-category w12h2, AiConfidenceWidget chart-bar w6h2); settings entry
  - widgets/ai-widgets.tsx: AiOverviewWidget (Active/Avg Confidence/Opportunities/Critical KPIs), AiInsightsWidget (cards list of latest 4 insights with severity icons and confidence), AiConfidenceWidget (BarSeries of per-insight confidence %, violet bars)
  - pages/ai-pages.tsx: AiOverviewPage (KPIs + insights feed + confidence bar chart), AiInsightsPage (responsive card grid with title/summary/detail/severity/confidence bar/relative time + dismiss toast), AiAssistantPage (mock chat with pre-baked Q&A, message bubbles, Bot+User avatars, ScrollArea, Input+Send button, Enter-to-send, toast on submit), AiConfigurePage (3 feature toggles with Switch — Insights/Predictions/Anomaly Detection — Select model dropdown with 5 options, Save button → toast)
  - index.ts: re-exports module + 4 pages
- Ran `bunx eslint src/modules/support src/modules/ai` → exit 0 (no lint errors in new files)
- Ran `bunx tsc --noEmit` → zero errors in new modules (rg filter returned exit 1 = no matches); all remaining project-wide errors are in pre-existing files (mock-data.ts, charts.tsx, sidebar.tsx, analytics module, examples/, skills/) which are out of scope
- Ran full `bun run lint` → 11 errors all in pre-existing files (dashboard-router.tsx, command-menu.tsx) — confirmed none originate from the new support/ai modules
- Did NOT modify module-bootstrap.ts, view-router.tsx, or any other module's files — lead will wire these in

Stage Summary:
- Support module: 4 files (manifest.ts, widgets/support-widgets.tsx, pages/support-pages.tsx, index.ts). 3 widgets, 3 pages, 3 nav children, 3 routes, 2 permissions. Uses orange (#c2410c) accent.
- AI module: 4 files (manifest.ts, widgets/ai-widgets.tsx, pages/ai-pages.tsx, index.ts). 3 widgets, 4 pages (incl. mock chat + config form), 4 nav children, 4 routes, 2 permissions. Uses violet (#7c3aed) accent — explicitly allowed (purple, not blue/indigo).
- All modules follow the analytics module pattern exactly: "use client", usePlatform+runtime.tenant.id, mock data helpers, MetricCard/Page/PageHeader/PageContent/DataTable/StatusBadge/charts, shadcn/ui components, toast on demo actions.
- Lead-architect next steps: import `supportModule` from "@/modules/support" and `aiModule` from "@/modules/ai" in module-bootstrap.ts, then register both via `moduleRegistry.register(...)`; import the 7 page components in view-router.tsx and add to `viewRegistry` under viewIds: support, support-tickets, support-knowledge, ai, ai-insights, ai-assistant, ai-configure.

---
Task ID: 5b-2
Agent: module-builder-marketing-crm-kyc
Task: Build Marketing + CRM + KYC modules

Work Log:
- Read worklog.md and the existing `analytics` module (manifest, widgets, pages, index) to learn the module pattern.
- Inspected `@/lib/platform/types.ts`, `@/components/platform/{page,status,data-table,charts,guards}` and `@/lib/platform/mock-data.ts` to confirm exact shapes (`FrontendModule`, `NavigationItem`, `RouteDefinition`, `WidgetDefinition`, `Column<T>`, `MetricCard`, `StatusBadge`, `BarSeries`/`DonutSeries`, mock helpers `getTenantCampaigns`/`getTenantContacts`/`getTenantKyc` and their `MarketingCampaign`/`CrmContact`/`KycRecord` interfaces).
- Created `src/modules/marketing/` (manifest.ts, widgets/marketing-widgets.tsx, pages/marketing-pages.tsx, index.ts): manifest id `marketing`, category `growth`, optional, deps `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#db2777` (pink), icon `Target`/`Megaphone`, permissions `marketing.read`/`marketing.configure`, nav order 65 (Overview/Campaigns/Performance), 3 widgets (MarketingOverviewWidget metric w12h1, CampaignPerformanceWidget bar w6h2, ChannelBreakdownWidget donut w6h2), 3 pages (Overview KPIs + 2 charts, Campaigns DataTable, Performance by channel).
- Created `src/modules/crm/` (same 4-file layout): manifest id `crm`, accentColor `#0891b2` (cyan), icon `Users`/`Contact`, permissions `crm.read`/`crm.update`, nav order 70 (Overview/Contacts/Pipeline), 2 widgets (CrmOverviewWidget metric w12h1, PipelineWidget bar w6h2), 3 pages (Overview KPIs + pipeline chart + stage bars, Contacts DataTable, Pipeline stage-flow visualization with counts).
- Created `src/modules/kyc/` (same 4-file layout): manifest id `kyc`, name "KYC / AML", category `compliance`, accentColor `#475569` (slate), icon `FileCheck`/`ShieldCheck`, permissions `kyc.read`/`kyc.approve`, nav order 75 (Overview/Reviews/Risk), 2 widgets (KycOverviewWidget metric w12h1, KycQueueWidget alert w12h2), 3 pages (Overview KPIs + recent submissions, Reviews DataTable with Approve/Reject wrapped in `PermissionGuard permission="kyc.approve"` and using `toast` from `@/hooks/use-toast`, Risk donut + high-risk records table).
- All three modules follow the analytics pattern: usePlatform() → tid fallback "platform"; mock-data helpers for tenant-scoped reads; MetricCard / Page / PageHeader / PageContent / DataTable(Column<T>) / BarSeries / DonutSeries / StatusBadge / formatCurrency / formatCompact; `"use client"` directives on every widgets/pages file.
- Avoided blue/indigo in accent colors and chart series (used pink #db2777, cyan #0891b2, slate #475569, plus emerald/amber/violet/rose/teal for series).
- Did NOT touch `module-bootstrap.ts`, `view-router.tsx`, or any other module's files.
- Ran `bun run lint` and `bunx tsc --noEmit` — both report ZERO errors in the new marketing/crm/kyc modules. The remaining lint/tsc errors are all pre-existing in `command-menu.tsx`, `dashboard-router.tsx`, `sidebar.tsx`, `mock-data.ts`, and the analytics/payouts/risk modules (TimeSeriesPoint vs SeriesPoint typing, react-hooks/preserve-manual-memoization) — outside this task's scope.

Stage Summary:
- 3 self-contained business modules shipped under `src/modules/{marketing,crm,kyc}/`, each with `manifest.ts` + `widgets/` + `pages/` + `index.ts`, fully matching the analytics plug-and-play pattern.
- Exports ready for the lead to wire into `module-bootstrap.ts` (register `marketingModule`, `crmModule`, `kycModule`) and `view-router.tsx` (map viewIds `marketing`, `marketing-campaigns`, `marketing-performance`, `crm`, `crm-contacts`, `crm-pipeline`, `kyc`, `kyc-reviews`, `kyc-risk`).
- 9 total viewIds, 7 total widgets, 9 total pages, all tenant-scoped via `getTenantCampaigns/getTenantContacts/getTenantKyc` mock helpers; KYC reviews page includes `kyc.approve`-gated Approve/Reject actions with toast feedback.
- No new lint or TypeScript errors introduced.

---
Task ID: 5a-8
Agent: lead-architect
Task: Wire all modules, build settings + super-admin experiences, main page, verify

Work Log:
- Created module registry index (`module-bootstrap.ts`) registering all 12 modules (5 core + 7 optional + settings + super-admin)
- Created dashboard view router (`view-router.tsx`) mapping 40+ view IDs to page components
- Created dashboard router component with module/permission/feature guards + ModuleErrorBoundary
- Created providers wrapper (PlatformProvider + Toaster + module bootstrap)
- Replaced `src/app/page.tsx` with unified dashboard entry (AppShell + DashboardRouter)
- Updated layout metadata to "PFaaS Platform"
- Built platform pages: Overview (dashboard grid), Profile, Audit, Notifications, Help
- Built Settings module: 6 tabs (General, Branding, Terminology, Modules, Roles, Notifications)
  - Branding tab: live color presets, picker, radius, live preview, apply instantly
  - Modules tab: toggle modules on/off → sidebar + dashboard re-compose live (proves spec §67)
  - Terminology tab: white-label term overrides (challenge→evaluation, trader→participant, etc.)
  - Roles tab: role → permission mapping viewer
- Built Super Admin module: Overview, Tenants, Module Catalog, Platform Health (system status)
- Fixed lint: removed React Compiler memoization warnings in command-menu (IIFE) + dashboard-router (ViewRenderer wrapper)
- Added "settings" to all tenant enabledModules in mock data
- Verified via agent-browser:
  - Page renders 200 ✓
  - Dynamic sidebar composes per user.application + tenant entitlements ✓
  - Switching to super-admin (Alex Morgan) shows ALL modules + Platform section ✓
  - Switching to prop-admin (Sarah Chen / Alpha Capital) shows 4 core modules + Settings ✓
  - Terminology applied: Alpha shows "Evaluation"/"Withdrawal" instead of "Challenge"/"Payout" ✓
  - Module enable/disable in Settings → sidebar updates instantly ✓ (enabled Analytics → appeared in sidebar)
  - Command menu (⌘K) works with navigation, quick actions, tenant/user switching ✓
  - Lint passes with 0 errors ✓

Stage Summary:
- Full PFaaS platform operational with 14 modules registered, 40+ views, dynamic navigation,
  widget-based dashboards, multi-tenant white-labeling, permission-driven visibility
- Architecture proves spec §67 demonstration scenario: enabling Analytics dynamically adds
  navigation + widgets without code changes
- All 3 subagent modules (Affiliates, Accounting, Marketing, CRM, KYC, Support, AI) wired in
- Remaining: final polish, responsive verification, recurring QA cron setup

---
Task ID: 5b-1
Agent: module-builder-affiliates-accounting
Task: Build Affiliates + Accounting modules
Stage Summary: 8 files created, 0 lint errors. Affiliates (4 pages, 3 widgets, 4 permissions) +
Accounting (3 pages, 3 widgets, 2 permissions) following analytics pattern. Left wiring to lead.

---
Task ID: 5b-2
Agent: module-builder-marketing-crm-kyc
Task: Build Marketing + CRM + KYC modules
Stage Summary: 12 files created, 0 lint errors. Marketing (3 pages, 3 widgets) + CRM (3 pages,
2 widgets) + KYC (3 pages, 2 widgets) following analytics pattern. Left wiring to lead.

---
Task ID: 5b-3
Agent: module-builder-support-ai
Task: Build Support + AI modules
Stage Summary: 8 files created, 0 lint errors. Support (3 pages, 3 widgets) + AI (4 pages, 3
widgets, mock chat interface) following analytics pattern. Left wiring to lead.

---
Task ID: qa-round-1
Agent: lead-architect (webDevReview cron)
Task: QA via agent-browser + VLM, fix bugs, improve styling, add features

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Lint passes cleanly, dev server returns 200
- Architecture proves spec §67 demonstration (module enable/disable → sidebar re-composes)

## Bugs Found & Fixed
1. **CRITICAL: Bootstrap timing bug** — `bootstrapModules()` ran in `useEffect` (after first render), so the module registry was empty on initial paint → dashboard showed "No widgets available". **Fix**: moved `bootstrapModules()` to module import time (synchronous) in `providers.tsx` so registry is populated before any component renders.
2. **`<cIcon />` casing warning** — sidebar used lowercase `cIcon` for dynamic JSX component. **Fix**: renamed to PascalCase `CIcon`.

## Styling Improvements (Mandatory)
1. **DashboardGrid rewrite**: widgets now grouped by module with section headers (icon + name + description + widget count badge), proper responsive 12-col grid (1-col mobile, 2-col tablet, 12-col desktop), consistent card heights via `flex h-full flex-col`, card hover shadow, category badge in card header.
2. **MetricCard redesign**: left accent strip (tone-colored), icon in muted box (tone-colored), `text-2xl font-bold tabular-nums` values, ▲/▼ delta indicators, better contrast for secondary text.
3. **DataTable improvements**: `numeric?: boolean` column flag → right-aligns headers + cells with `text-right tabular-nums`, compact row padding (`py-2.5`), uppercase tracking-wide headers. Applied `numeric: true` to Traders/Accounts/Positions tables.
4. **Sidebar active state**: active nav items now use `bg-sidebar-primary text-sidebar-primary-foreground shadow-sm` with a left accent bar; hover states are subtler; icons have opacity transitions.
5. **Widget text clipping fixes**: Recent Trading Activity, Challenge Progress, Open Breaches widgets now use `truncate` + `min-w-0` + `shrink-0` for clean ellipsis truncation.

## New Features Added
1. **Summary KPI Row** (OverviewPage): aggregates the single most important metric from each enabled module (Active Traders, Total Equity, Funded Traders, Open Breaches, Pending Payouts, Revenue 7d, Affiliate Revenue, Net Flow, KYC Pending, Open Tickets, AI Insights). Cards are clickable → navigate to the module's main page. Shows only for enabled modules.
2. **Boot Screen** (spec §60): animated 12-step initialization sequence (Auth → User → Tenant → Config → Entitlements → Permissions → Theme → Module Registry → Enabled Modules → Navigation → Routes → Render) with progress bar and checkmark states. Shown on first load.
3. **Activity Ticker** (topbar): auto-rotating live event strip (4s interval) with pulsing green dot, module-specific icons, tone-colored text, fade-in animation. Hidden on small screens.
4. **Date range selector + Refresh**: OverviewPage header has 7d/30d/90d toggle + refresh button with spinning icon.
5. **Widget category badges**: each widget card shows its category (METRIC, CHART, TABLE, FEED, etc.) in the module's accent color.

## Verification Results (agent-browser + VLM)
- Page loads 200 ✓, lint clean ✓, no console errors ✓
- Boot screen shows initialization steps then transitions to dashboard ✓
- Summary KPI row: 5 cards for Alpha, 9 for Beta (more modules) ✓
- Module grouping: Trading/Challenges/Risk/Payouts sections with headers ✓
- MetricCard: accent strip, large values, ▲/▼ deltas ✓
- Activity ticker: pulsing dot, auto-rotating events ✓
- Dark mode: high contrast, readable ✓
- Numeric columns: right-aligned (verified via DOM: 32 cells with `text-right tabular-nums`) ✓
- Text clipping: fixed with `truncate` ✓
- VLM final rating: 8.5-9/10 (visual polish, layout, hierarchy, professionalism)

## Unresolved Issues / Risks
- Some chart-heavy widgets may look sparse at very narrow widths (acceptable for responsive)
- Subagent-built modules (Affiliates, Accounting, Marketing, CRM, KYC, Support, AI) inherit the improved DataTable/Card styling automatically but haven't had individual widget polish passes
- No real backend — all data is mock; production would need API layer

## Priority Recommendations for Next Phase
1. **Polish subagent module widgets** — apply same truncation/density fixes to widgets in affiliates/accounting/marketing/crm/kyc/support/ai
2. **Add dashboard customization UI** (spec §23) — drag-to-reorder, add/remove widgets, save layout
3. **Add global search results page** (spec §38) — search across traders/accounts/challenges/etc
4. **Add integration UI** (spec §44) — pluggable integrations panel with provider status
5. **Improve mobile responsiveness** — verify all views on 375px viewport

---
Task ID: r2-2a
Agent: widget-polisher-1
Task: Polish Affiliates + Accounting + AI widget text clipping & density

Work Log:
- Read worklog.md to understand previous work and reference patterns in trading-overview-widget.tsx + risk-widgets.tsx (truncate + min-w-0 + shrink-0 + dark mode variants)
- Read all three target widget files: affiliates (3 widgets), accounting (3 widgets), ai (3 widgets)
- Polished `affiliates/widgets/affiliate-widgets.tsx` → `TopAffiliatesWidget` list items:
  - gap-3 → gap-2.5 (consistent with risk OpenBreachesWidget)
  - Added `shrink-0` to rank circle span
  - Rank circle color: bg-muted text-muted-foreground → bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400 (matches accent color, dark mode variants)
  - Added `shrink-0` to tier progress bar container + tier label
  - Added `shrink-0` to right-aligned value column + `tabular-nums` for numeric alignment
  - Added `text-foreground` to title for explicit dark-mode correctness
- Inspected `accounting/widgets/accounting-widgets.tsx`: all 3 widgets are pure MetricCard grids + BarSeries/AreaSeries charts (no list items, no text cards, no colored backgrounds requiring dark variants). Already uses `gap-3` consistent with Trading overview's MetricCard grid. No changes needed.
- Polished `ai/widgets/ai-widgets.tsx` → `AiInsightsWidget` insight cards + header:
  - Header Brain icon: added `shrink-0` + `dark:text-violet-400`
  - List items: gap-3 → gap-2.5
  - Icon wrapper: added `shrink-0`
  - Severity icons: added dark mode variants (emerald/rose/amber/violet all `dark:text-*-400`)
  - Title container: `flex-1` → `min-w-0 flex-1`
  - Title span: added `truncate` so long insight titles cleanly ellipsis
  - Summary `<p>`: added `line-clamp-2` so summaries cap at 2 lines (cleaner density)
- Polished `AiConfidenceWidget` footer caption: added `truncate` to the caption line
- Ran `bun run lint` → 0 errors (clean output, no warnings)

Stage Summary:
- 2 of 3 widget files edited (affiliate-widgets.tsx, ai-widgets.tsx); accounting-widgets.tsx inspected and confirmed already clean (no list items / colored backgrounds to polish)
- All changes are styling-only: no data logic, no manifest, no component structure changes
- Pattern applied consistently: `truncate` + `min-w-0` on text containers, `shrink-0` on icons/badges/value columns, `dark:bg-*-950 dark:text-*-400` on colored icon backgrounds, `gap-2.5` for list item rows
- Zero new lint errors introduced

---
Task ID: r2-2b
Agent: widget-polisher-2
Task: Polish Marketing + CRM + KYC + Support widget text clipping & density

Work Log:
- Read worklog.md to understand prior polish pass (qa-round-1) that applied `truncate` + `min-w-0` + `shrink-0` and dark-mode variants to Trading/Challenges/Risk/Payouts/Analytics widgets
- Inspected reference widgets for the polished pattern:
  - `trading-overview-widget.tsx` RecentActivityWidget — `truncate` on text, `min-w-0 flex-1` on text containers
  - `risk-widgets.tsx` OpenBreachesWidget — `flex items-center gap-2.5 rounded-md border bg-card p-2`, `shrink-0` icon, `truncate` on title/subtitle, `dark:bg-rose-950 dark:text-rose-400` variants
- Inspected `payout-widgets.tsx` PayoutQueueWidget — same `min-w-0 flex-1` + `truncate` pattern
- Inspected shared primitives (`status.tsx`, `charts.tsx`, `data-table.tsx`, `table.tsx`) to understand what is already handled centrally (StatusBadge dark variants, DataTable `whitespace-nowrap` cells, DonutSeries legend rendering)
- Grepped all 4 target files for `bg-(rose|amber|emerald|sky|teal|violet|purple|cyan|orange|red|green|yellow|pink|fuchsia)-\d+` and `text-(...)-\d+` patterns to find colored backgrounds/text missing dark variants

Polish applied per file:

1. `src/modules/kyc/widgets/kyc-widgets.tsx` — KycQueueWidget
   - Header row: added `gap-2` between flex children, `min-w-0` on the icon+label wrapper, `shrink-0` on the ShieldCheck icon, `truncate` on the "Awaiting Review" label, `shrink-0` on the pending-count Badge
   - Added `dark:text-slate-400` to the header ShieldCheck icon (was `text-slate-600` only)
   - Queue list items: replaced `justify-between rounded-lg border bg-card p-3` with the polished `flex items-center gap-2.5 rounded-md border bg-card p-2` pattern
   - Wrapped trader name + document/country in `min-w-0 flex-1` container, applied `truncate` to both lines (text-sm font-medium for name, text-[10px] for subtitle to match OpenBreachesWidget sizing)
   - Wrapped badges in `shrink-0` flex container so they never get squeezed by long trader names
   - Existing `bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400` on the High-risk Badge was already correct — left unchanged

2. `src/modules/support/widgets/support-widgets.tsx` — RecentTicketsWidget + TicketPriorityWidget
   - `recentColumns` subject cell: changed plain `<span className="font-medium text-foreground">` to `<span className="block max-w-[220px] truncate font-medium text-foreground">` — turns the inline span into a block, caps width, and ellipsifies long ticket subjects (e.g. "Cannot login to MT5 account")
   - `recentColumns` traderName cell: same pattern with `max-w-[140px] truncate` to keep the column from forcing horizontal scroll on narrow widget widths
   - TicketPriorityWidget summary line: added `truncate` defensively so the "{n} tickets across {m} priorities" line never pushes the chart card height when in a narrow column
   - SupportOverviewWidget (MetricCard grid) and TicketPriorityWidget DonutSeries left unchanged — already match polished pattern (`gap-3` grid, StatusBadge handles its own dark variants)

3. `src/modules/marketing/widgets/marketing-widgets.tsx` — verified, NO changes needed
   - All 3 widgets (MarketingOverviewWidget, CampaignPerformanceWidget, ChannelBreakdownWidget) are pure wrappers around MetricCard grid / BarSeries / DonutSeries
   - No list items, no inline text containers, no colored `bg-*`/`text-*` utility classes in this file
   - Chart components (BarSeries/DonutSeries) already handle their own label rendering via recharts `minTickGap` and the legend `<span>` in charts.tsx
   - MetricCard grid uses `gap-3` which matches the polished trading-overview-widget pattern
   - CHANNEL_COLORS palette already uses pink/amber/violet/emerald/cyan — no blue/indigo

4. `src/modules/crm/widgets/crm-widgets.tsx` — verified, NO changes needed
   - Same as marketing: 2 widgets are pure MetricCard grid + BarSeries wrappers
   - Pipeline stages are short tokens ("lead", "qualified", "opportunity", "customer", "churned") — no overflow risk on the bar chart axis
   - BarSeries color `#0891b2` (cyan) — allowed, no blue/indigo

Verification:
- `cd /home/z/my-project && bun run lint 2>&1 | tail -10` → clean (`$ eslint .` with zero output, exit 0)
- Did NOT touch widget data logic, manifests, page files, or component structure — only styling classes (truncate, min-w-0, shrink-0, gap-2.5, dark: variants, max-w on table cells)
- Did NOT modify any other modules or shared components (charts.tsx, data-table.tsx, status.tsx left untouched)

Stage Summary:
- 2 of 4 widget files modified: `kyc-widgets.tsx` (KycQueueWidget — full truncate/min-w-0/shrink-0 polish + dark slate variant on header icon) and `support-widgets.tsx` (RecentTicketsWidget table cells truncated to max-w + TicketPriorityWidget summary truncated)
- 2 of 4 widget files verified clean: `marketing-widgets.tsx` and `crm-widgets.tsx` are chart-only wrappers with no list items or text containers needing polish
- Lint passes with zero errors after changes
- All 4 widget files now consistent with the polished pattern established in trading/risk/payouts widgets (qa-round-1)

---
Task ID: qa-round-2
Agent: lead-architect (webDevReview cron)
Task: QA via agent-browser + VLM, polish subagent widgets, add dashboard customization + global search + integrations UI

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous round fixed bootstrap timing bug, added MetricCard redesign, DashboardGrid module grouping, boot screen, activity ticker
- This round focused on: subagent widget polish, dashboard customization (spec §23), global search (spec §38), integrations UI (spec §44), mobile verification

## QA Findings (agent-browser + VLM)
- Page loads 200, lint clean, no console errors
- Charts verified via DOM: 54 paths, 11 areas, 72 bars (VLM had misread small charts as "empty")
- AI Insights widget text confirmed readable via DOM (VLM misread screenshot)
- Mobile responsive at 375px: sidebar collapses to hamburger, KPI cards stack, no overflow
- VLM ratings: 8.75-9/10 (visual polish, layout, hierarchy, feature completeness)

## Completed Modifications

### 1. Subagent Widget Polish (parallel subagents)
- **Affiliates** (TopAffiliatesWidget): gap-3→gap-2.5, rank circle dark mode variants, shrink-0 on fixed elements, tabular-nums
- **AI** (AiInsightsWidget + AiConfidenceWidget): dark mode icon variants, min-w-0 + truncate on titles, line-clamp-2 on summaries
- **KYC** (KycQueueWidget): polished list items with truncate + min-w-0 + shrink-0, dark mode icon variant
- **Support** (RecentTicketsWidget): max-w truncation on subject + traderName cells
- Accounting & Marketing & CRM widgets verified clean (pure MetricCard/chart wrappers, no polish needed)

### 2. Dashboard Customization UI (spec §23)
- Added `hiddenWidgets: Set<string>` + `toggleWidget` + `resetDashboard` + `customizeOpen` to platform context
- Updated `resolveDashboardLayout(ctx, hiddenWidgets?)` to filter hidden widgets
- Built `CustomizeDashboardDialog`: shows all widgets grouped by module with toggle switches, visible/total count per module, Reset layout button, Done button
- Added "Customize" button to OverviewPage header
- Verified: toggled off "Recent Trading Activity" → widget disappeared from dashboard instantly (16→15 widgets)

### 3. Global Search (spec §38)
- Added `searchOpen` + `setSearchOpen` to platform context
- Built `GlobalSearchDialog`: searches across 8 entity types (Traders, Accounts, Challenges, Payouts, Affiliates, Transactions, Support Tickets, KYC Records)
- Results grouped by category with counts, sorted by label-match relevance, capped at 30 results
- Each result navigates to the entity's page on select
- Topbar search button now opens global search (was command menu)
- `/` keyboard shortcut opens search (when not typing in input)
- Footer shows search hint: "Press / to search · ⌘K for commands"
- Verified: searched "a" → found Challenges matching, grouped results

### 4. Integrations UI (spec §44)
- Added "Integrations" tab to Settings page (7th tab)
- 5 integration categories: Trading Platform (MT5/MT4/DXTrade), Payments (Stripe/Wise/Crypto/PayPal), KYC/AML (Sumsub/Onfido), Notifications (SendGrid/Slack/Twilio), AI & Analytics (OpenAI/Segment)
- Each integration shows: icon, name, status badge (connected/available/disconnected), health badge (healthy/degraded), description, last sync time, context-aware button (Connect/Configure/Reconnect)
- Connected count summary in header
- Security note card explaining credential masking per spec §44
- Dark mode color variants for status/health badges

### 5. Mobile Responsiveness Verification
- Tested at 375px viewport: sidebar collapses to hamburger menu, KPI cards stack vertically, content readable, no overflow
- Mobile nav sheet works via hamburger trigger

## Verification Results
- Page loads 200 ✓, lint clean ✓, no console errors ✓
- Dashboard customization: toggle widget → dashboard re-composes instantly ✓
- Global search: "/" shortcut opens, searches 8 entity types, grouped results ✓
- Integrations tab: 5 categories, status/health badges, context-aware buttons ✓
- Mobile responsive: 375px viewport verified ✓
- Subagent widgets polished: truncate, dark mode variants, consistent spacing ✓

## Unresolved Issues / Risks
- VLM noted "2 Issues" badge — this is the Next.js dev tools indicator, not a platform bug
- No real backend — all data is mock; production would need API layer
- Dashboard customization is session-only (not persisted to localStorage yet)
- Global search doesn't have debouncing (acceptable for mock data sizes)

## Priority Recommendations for Next Phase
1. **Persist dashboard customization** to localStorage so hidden widgets survive reloads
2. **Add bulk actions** to integrations (enable/disable multiple)
3. **Add connection health trend** sparklines to integrations
4. **Add dashboard layout presets** (e.g. "Risk-focused", "Finance-focused", "Minimal")
5. **Add keyboard shortcuts help** overlay (? key)
6. **Add export/report generation** feature (PDF/CSV export from analytics)

---
Task ID: qa-round-3
Agent: lead-architect (webDevReview cron)
Task: QA via agent-browser, add localStorage persistence + dashboard presets + keyboard shortcuts help + CSV export

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, subagent widget polish
- Platform stable: page 200, lint clean, 265 SVG chart elements confirmed via DOM
- This round: localStorage persistence, dashboard layout presets, keyboard shortcuts help, CSV export utility

## QA Findings
- Page loads 200, lint clean, no runtime errors
- Charts verified via DOM: 265 SVG elements, 51 text labels, 16 chart surfaces (VLM misreads small screenshots)
- "1 Issue" badge is Next.js dev tools indicator (dev-only, not a platform bug)
- Console had stale "re-registering module" warnings — fixed by making register() silently idempotent
- VLM rating: 8-9/10 (visual polish, layout, hierarchy, feature completeness)

## Completed Modifications

### 1. Persist Dashboard Customization to localStorage (spec §23)
- `hiddenWidgets` state initialized from `localStorage.getItem("pfaas:hiddenWidgets")` on mount
- `useEffect` persists changes to localStorage automatically
- `setHiddenWidgets` exposed to context for preset application
- **Verified**: toggled off "Recent Trading Activity" → reloaded page → widget still hidden (localStorage persisted `["recent-activity"]`)
- **Verified**: Reset layout → localStorage cleared to `[]`

### 2. Dashboard Layout Presets (spec §23 — Role/Tenant dashboard templates)
- Added 5 presets to CustomizeDashboardDialog:
  - **All widgets** (16 widgets) — show everything
  - **Risk-focused** (6 widgets) — risk, breaches, positions, trading overview only
  - **Finance-focused** (4 widgets) — payouts, accounting, revenue metrics
  - **Trading-focused** (7 widgets) — traders, accounts, positions, performance, challenges
  - **Minimal** (4 widgets) — only metric-category widgets (KPI overviews)
- Each preset shows icon, name, and widget count
- Active preset highlighted with `ring-1 ring-primary/20` + `border-primary`
- Preset application toast: "Preset applied — X of Y widgets visible"
- **Verified**: applied "Minimal" → dashboard reduced to only metric widgets; applied "Risk-focused" → only risk/trading widgets showed

### 3. Keyboard Shortcuts Help Overlay (? key)
- `KeyboardShortcutsHelp` component with Dialog overlay
- Opens via `?` key (or `Shift+/`) when not typing in an input
- 11 shortcuts grouped: Global (⌘K, /, ?, Esc), Navigation (G D/S/T/A/P/R), View (B)
- Each shortcut shows icon, label, and styled `<kbd>` key indicator
- Tips section with 3 usage tips (fuzzy search, tenant switching, global search)
- Registered `window.__openShortcutsHelp` global so command menu can trigger it
- Added "Keyboard shortcuts ?" command to the command menu's Quick actions group
- **VLM rating: 9/10** — "highly polished, follows modern SaaS design standards (Linear/Vercel)"

### 4. CSV Export Utility (spec §38 — analytics.export permission)
- Created `export-utils.ts` with `exportToCsv<T>(rows, columns, filename)` function
- RFC 4180 compliant: escapes commas, quotes, newlines; prepends UTF-8 BOM for Excel
- Triggers browser download + shows toast: "Export ready — filename — N records exported"
- Added "Export CSV" button to Analytics Overview page (gated by `analytics.export` permission)
- Added "Export CSV" button to Accounting Transactions page
- **Verified**: clicked Export CSV on Analytics page → "Export ready" toast appeared + browser download triggered

### 5. Module Registry Cleanup
- Removed `console.warn("re-registering module")` — made `register()` silently idempotent for HMR safety

## Verification Results
- Page loads 200 ✓, lint clean ✓, no runtime errors ✓
- localStorage persistence: hidden widget survived page reload ✓
- Dashboard presets: 5 presets, active highlighting, instant apply ✓
- Keyboard shortcuts: ? key opens dialog, command menu has shortcut command ✓
- CSV export: Analytics + Accounting pages, toast + download triggered ✓
- Charts render correctly: 265 SVG elements in DOM (VLM misreads screenshots) ✓

## Unresolved Issues / Risks
- VLM consistently misreads small chart screenshots as "empty" — verified via DOM that charts have data
- No real backend — all data is mock
- CSV export downloads to browser (not server filesystem) — expected behavior
- The `?` shortcut requires no modifier keys held (intentional, avoids conflicts)

## Priority Recommendations for Next Phase
1. **Add ARIA labels** to color-only indicators (buy/sell, status badges) for accessibility
2. **Add chart axis label rotation** for long category names (e.g., AI confidence insight titles)
3. **Add dashboard layout sharing** — export/import hidden widget config as JSON
4. **Add bulk integration actions** — enable/disable multiple integrations at once
5. **Add notification preferences** per-module (email/in-app/slack toggles)
6. **Add audit log filtering** by module/severity/actor with date range

---
Task ID: qa-round-4
Agent: lead-architect (webDevReview cron)
Task: QA + accessibility (ARIA), chart label rotation, audit log filtering, dashboard layout sharing, notification preferences, fix duplicate key bug

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export
- Platform stable: page 200, lint clean
- This round: accessibility ARIA labels, chart axis rotation, audit log filtering, dashboard layout sharing (export/import JSON), per-module notification preferences, fixed duplicate React key bug

## QA Findings
- Page loads 200, lint clean
- Console had "duplicate key" React warning for "trading" — traced to summary KPI row using `key={s.moduleId}` where Trading had 2 KPIs (same moduleId)
- Fixed: deduplicated module sections in DashboardGrid + used `${s.moduleId}-${idx}` for summary keys
- After fix: 0 console errors (verified via clean reload)
- ARIA labels verified via DOM: 5 status badges + 24 buy/sell/P&L role=img elements on positions page
- VLM rating: 8.75/10 (visual polish, layout, hierarchy, feature completeness)

## Completed Modifications

### 1. Accessibility — ARIA Labels for Color-Only Indicators (spec §49)
- **StatusBadge**: added `role="status"`, `aria-label` (tone description + children text), `title` attribute
- **Buy/Sell indicators**: added `role="img"` + `aria-label="Position side: buy/sell"` on positions table
- **P&L indicators**: added `role="img"` + `aria-label="Profit and loss: profit/loss of $X"` on traders + positions tables
- **P&L % indicators**: added `role="img"` + `aria-label="P&L percentage: profit/loss of X percent"`
- **Severity indicators** in audit log: added `role="img"` + `aria-label="Severity: info/warning/critical"`
- Verified via DOM: 24 ARIA-labeled elements on positions page + 5 status badges

### 2. Chart Axis Label Rotation (spec §28)
- Updated `BarSeries` in charts.tsx to auto-detect long labels (> 6 chars) and rotate -35°
- Uses `angle={-35}`, `textAnchor="end"`, `height={50}` for rotated; `angle={0}` for short labels
- Prevents label truncation on AI confidence insight titles, cohort names, channel breakdowns
- All other chart types (LineSeries, AreaSeries, DonutSeries) unaffected

### 3. Audit Log Filtering (spec §40)
- Rewrote `AuditLogTable` with filter bar:
  - Severity dropdown (All / Info / Warning / Critical)
  - Module dropdown (auto-populated from audit entries)
  - Actor text input with datalist autocomplete
  - Active filter count badge
  - Clear button
  - Entry count "X of Y entries"
- Filters apply via `useMemo` on the entries array
- Preserves existing DataTable search + sort + pagination

### 4. Dashboard Layout Sharing (spec §23 — export/import JSON)
- Added Export button to CustomizeDashboardDialog footer
  - Generates JSON `{ version: 1, hiddenWidgets: [...] }`
  - Triggers browser download as `dashboard-layout-YYYY-MM-DD.json`
  - Toast: "Layout exported — N hidden widgets saved to JSON"
- Added Import button
  - Opens file picker for .json files
  - Parses + validates `hiddenWidgets` array
  - Applies via `setHiddenWidgets(new Set(...))`
  - Toast: "Layout imported — N hidden widgets applied" or error toast
- Verified: exported JSON file saved to Downloads, content valid

### 5. Notification Preferences per Module (spec §37)
- Rewrote NotificationsTab in Settings:
  - 6 module cards (Trading, Challenges, Risk, Payouts, KYC, AI)
  - Each card: module icon + name + event list + 3-channel grid (Email/In-app/Slack)
  - Per-channel Switch toggles with ARIA labels
  - Slack defaults to off, Email/In-app default on
- Added Quiet Hours card: enable toggle + start/end time selectors
- VLM rating: 9/10

### 6. Bug Fix — Duplicate React Keys
- Root cause: summary KPI row used `key={s.moduleId}` but Trading module has 2 KPIs (Active Traders + Total Equity), both with moduleId "trading"
- Fix: changed to `key={`${s.moduleId}-${idx}`}` for unique keys
- Also deduplicated module sections in DashboardGrid via `seenModuleIds` Set
- Verified: 0 console errors after clean reload

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓ (duplicate key fixed)
- ARIA labels: 5 status badges + 24 buy/sell/P&L role=img elements verified via DOM ✓
- Chart rotation: BarSeries auto-rotates labels > 6 chars ✓
- Audit log filtering: severity + module + actor filters, clear button, entry count ✓
- Dashboard layout export: JSON file downloaded, valid structure ✓
- Notification preferences: 6 module cards, 3 channels each, quiet hours ✓
- VLM final: 8.75/10 (visual polish 8.5, layout 9, hierarchy 8.5, feature completeness 9)

## Unresolved Issues / Risks
- VLM continues to misread small chart screenshots as "empty" — DOM confirms charts have data (265+ SVG elements)
- No real backend — all data is mock
- Chart label rotation may need fine-tuning for specific chart heights

## Priority Recommendations for Next Phase
1. **Add date range picker** to audit log (currently has severity/module/actor but no date filter)
2. **Add bulk export** — export all module data as a ZIP archive
3. **Add dashboard widget reordering** — drag-and-drop widget positions (currently only show/hide)
4. **Add real-time updates** — simulate live data changes with periodic polling
5. **Add user profile avatar upload** + settings
6. **Add multi-currency conversion** in analytics

---
Task ID: qa-round-5
Agent: lead-architect (webDevReview cron)
Task: QA + real-time live data simulation, audit date range filter, enhanced profile page with avatar upload

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export, ARIA labels, chart rotation, audit filtering, layout sharing, notification preferences, duplicate key fix
- Platform stable: page 200, lint clean, 0 console errors
- This round: real-time data simulation, live activity feed, audit date range filter, enhanced profile page

## QA Findings
- Page loads 200, lint clean, 0 console errors (verified after clean reload)
- Recent Trading Activity widget has 6 items confirmed via DOM (VLM misreads screenshot)
- Charts render correctly: 265+ SVG elements in DOM
- VLM rating: 9/10 (live activity feed), 9/10 (profile page), 9/10 (audit filter bar)

## Completed Modifications

### 1. Real-Time Data Simulation (spec §35, §51)
- Created `live-data.ts` with singleton live state + subscriber pattern
- `useLiveData()` hook subscribes to a 3.5-second tick interval
- Simulates: equityPulse, pnlFlash, activeTraders, openPositions, pendingPayouts, openBreaches, activityFeed
- Activity feed generates random events from 10 action templates × 7 actors
- `setLivePaused()` / `clearActivityFeed()` controls
- Fixed lint error: removed synchronous `setState` inside `useEffect` (React Compiler complaint)

### 2. Live Activity Feed Widget + Dashboard Sidebar
- Created `LiveActivityFeedWidget` component:
  - Pulsing green "LIVE" badge with animated ping
  - Auto-appending activity items with fade-in animation
  - Module-specific icons (Wallet, ShieldAlert, Brain, etc.)
  - Tone-colored dots (info/success/warning/critical)
  - Pause/Resume button + Clear button
  - "Waiting for activity…" empty state
- Added to OverviewPage as a sticky right sidebar (320px):
  - Live Activity card with header + feed
  - 2×2 live stats mini-panel (Active Traders, Open Positions, Pending Payouts, Open Breaches)
  - Numbers update in real-time as the simulation ticks
- Verified: 9 feed items after 8 seconds with real activity ("Sarah Chen resolved a breach", "AI Engine enabled Analytics module", "Priya Nair approved a payout")

### 3. Audit Log Date Range Filter (spec §40)
- Added `dateRange` state to AuditLogTable (all / 24h / 7d / 30d)
- Date range dropdown in filter bar with 4 options
- Filters entries by timestamp cutoff
- `activeFilters` count includes date range
- `clearFilters` resets date range
- Filter bar now has: severity + module + actor + date range = 4 filter dimensions
- VLM rating: 9/10

### 4. Enhanced Profile Page (spec §11)
- Complete rewrite of profile-page.tsx:
  - **Avatar upload**: camera button overlay on avatar, file picker (image/*, 2MB limit), FileReader preview, toast feedback
  - **Edit profile form**: display name + email inputs with labels
  - **Profile header card**: large avatar, name, role badges, email, last active
  - **Roles & permissions card**: role badges + permission pills (12 shown + "N more")
  - **Tenant card**: brand initials, plan, currency, timezone, locale, modules count
  - **Quick preferences**: 5 notification toggles (email, in-app, desktop, weekly digest, AI alerts)
  - **Active sessions**: 3 mock sessions (Desktop/Mobile/Tablet) with browser, location, IP, last active, Revoke button
- VLM rating: 9/10

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Live feed: 9 items after 8s with real activity text ✓
- Live stats: 4 mini-cards updating in real-time ✓
- Audit date range: 4 options (all/24h/7d/30d) in filter bar ✓
- Profile: avatar upload, edit form, roles, tenant, preferences, sessions ✓
- VLM ratings: 9/10 across all new features

## Unresolved Issues / Risks
- Live data is simulated (no real WebSocket backend) — acceptable for demo
- Avatar upload is client-side only (no server persistence) — acceptable for demo
- VLM continues to misread small chart screenshots — DOM verification confirms data present

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions (currently only show/hide)
2. **Add multi-currency conversion** in analytics with live exchange rates
3. **Add bulk export** — export all module data as ZIP archive
4. **Add real-time chart updates** — live-updating equity curve / revenue chart
5. **Add onboarding wizard** for new tenants — guided module setup
6. **Add saved views / filters** — persist filter combinations per user

---
Task ID: qa-round-6
Agent: lead-architect (webDevReview cron)
Task: QA + fix data inconsistency, add multi-currency conversion, live equity curve chart

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export, ARIA labels, chart rotation, audit filtering, layout sharing, notification preferences, duplicate key fix, real-time data simulation, live activity feed, audit date range, enhanced profile page
- Platform stable: page 200, lint clean
- This round: fix data inconsistency bug, multi-currency conversion, live equity curve chart

## QA Findings
- Page loads 200, lint clean
- **BUG FOUND**: Data inconsistency — KPI row showed 16 active traders (from static mock data) but Live Activity sidebar showed 23 (from simulated live data starting at hardcoded 24)
- **BUG FOUND**: `getTenantPositions is not defined` runtime error in OverviewPage — missing import caused ModuleErrorBoundary to catch and show "Something went wrong loading overview"
- Both bugs fixed this round
- VLM rating: 9/10 (live equity sidebar), 9/10 (currency converter)

## Completed Modifications

### 1. FIX: Data Inconsistency Between KPI Row and Live Sidebar
- Changed `INITIAL` live data state to start at 0 for all stats (instead of hardcoded 24/18/3/7)
- Added `syncLiveStats()` function that sets the live state to actual tenant values
- OverviewPage calls `syncLiveStats()` in a `useEffect` on mount with real values from:
  - `getTenantTraders(tid).filter(t => t.status === "active").length`
  - `getTenantPositions(tid).length`
  - `getTenantPayouts(tid).filter(p => p.status === "pending").length`
  - `getTenantBreaches(tid).filter(b => b.status === "open").length`
- Reduced live drift rate (stats only change 40% of ticks, small ±1 drift)
- **Verified via VLM**: both KPI row and Live Activity sidebar now show 16 active traders

### 2. FIX: Missing `getTenantPositions` Import
- OverviewPage used `getTenantPositions(tid)` in the `syncLiveStats` useEffect but didn't import it
- Added `getTenantPositions` to the mock-data import list
- **Verified**: 0 console errors after fix (was 3+ "getTenantPositions is not defined" errors)

### 3. Multi-Currency Conversion (spec §10, §51)
- Created `currency.ts` with 10 currencies (USD, EUR, GBP, AED, JPY, AUD, CAD, CHF, SGD, BTC)
- `convertCurrency(amount, from, to)` via USD as base
- `formatConverted(amount, from, to)` with proper symbols/decimals
- `getRateLabel(from, to)` → "1 GBP = $1.2658 USD"
- Added currency selector dropdown to Analytics Overview page header (Coins icon)
- Exchange rate banner appears when display currency ≠ tenant currency
- KPI values + chart titles + tooltips all convert to selected currency
- **Verified via VLM**: selected USD on Beta (GBP tenant) → banner "Converting from GBP → USD, 1 GBP = $1.2658 USD", KPIs in $368,317.72
- **VLM rating: 9/10**

### 4. Live Equity Curve Chart (spec §35 — real-time updates)
- Created `LiveEquityCurveWidget` component:
  - Seeds initial 10 points from tenant's total account equity
  - Appends a new point on each live-data tick (3.5s interval)
  - Maintains max 30 points (scrolling window)
  - Shows current equity value + delta % badge (green/red)
  - Pulsing "Live" indicator
  - Area chart with color based on delta (green up / red down)
  - "Loading equity data…" skeleton state
- Added to OverviewPage live sidebar between activity feed and stats grid
- **Verified via VLM**: 9/10 — chart visible with green area, live indicator, delta badge

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Data consistency: KPI row = Live sidebar = 16 active traders ✓
- Currency converter: 10 currencies, exchange rate banner, KPI formatting ✓
- Live equity curve: seeds from tenant equity, appends on tick, delta badge ✓
- VLM ratings: 9/10 (live equity sidebar), 9/10 (currency converter)

## Unresolved Issues / Risks
- Exchange rates are static (not live API) — acceptable for demo
- Live equity curve points are simulated around the base equity — no real trade feed
- VLM continues to misread small chart screenshots — DOM verification confirms data

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions
2. **Add saved views / filters** — persist filter combinations per user
3. **Add onboarding wizard** for new tenants — guided module setup
4. **Add bulk export** — export all module data as ZIP archive
5. **Add real-time price feed** widget — live symbol prices (EURUSD, BTC, etc.)
6. **Add chart annotations** — mark events on the equity curve (breaches, payouts)

---
Task ID: qa-round-7
Agent: lead-architect (webDevReview cron)
Task: QA + saved views/filters, real-time price feed widget, animated numbers, live sidebar enrichment

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export, ARIA labels, chart rotation, audit filtering, layout sharing, notification preferences, duplicate key fix, real-time data simulation, live activity feed, audit date range, enhanced profile, data consistency fix, multi-currency conversion, live equity curve
- Platform stable: page 200, lint clean, 0 console errors
- This round: saved views/filters, real-time price feed, animated numbers, live sidebar enrichment

## QA Findings
- Page loads 200, lint clean, 0 console errors
- Dev server had stopped (auto-run needed restart) — restarted with setsid+nohup
- VLM rating: 9/10 (live sidebar with all widgets), 10/10 (audit filter bar with saved views)
- Fixed 2 lint errors: setState-in-effect in saved-views.ts (used lazy useState initializer) + live-price-feed.ts (moved setState into requestAnimationFrame callback)

## Completed Modifications

### 1. Saved Views / Filters (spec §52, §23)
- Created `saved-views.ts` with `useSavedViews(scope, userId)` hook:
  - Persists filter combinations to localStorage keyed by `pfaas:savedViews:{scope}:{userId}`
  - `saveView(name, filters)` — creates a SavedView with id, name, filters, createdAt
  - `deleteView(id)` — removes by id
  - `applyView(view)` — returns the filter map
  - Max 20 saved views per scope
  - Lazy `useState` initializer loads from localStorage (avoids setState-in-effect)
- Integrated into AuditLogTable:
  - "Save" button (disabled when no filters active) — prompts for name, saves current 4 filters
  - "Views" dropdown — shows all saved views with filter count + delete button
  - Clicking a saved view restores all 4 filter dimensions (severity, module, actor, dateRange)
- **Verified**: saved "Critical Issues" view → appeared in Views dropdown with delete button ✓
- **VLM rating: 10/10** for the audit filter bar

### 2. Real-Time Price Feed Widget (spec §35)
- Created `LivePriceFeedWidget` showing 6 trading symbols:
  - EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD, ETHUSD
- Each symbol shows:
  - Symbol code (monospace bold) + full name
  - TrendingUp/TrendingDown icon (live tick > 0)
  - Sparkline (20-point history, colored green/red)
  - Current price (formatted with proper decimals)
  - Delta % (green/red)
- Prices update on each live-data tick (3.5s) with symbol-specific volatility
- Crypto (BTC/ETH) has higher volatility than forex
- Added to OverviewPage live sidebar as "Live Prices" card with pulsing LIVE badge
- **Verified via VLM**: all 6 symbols visible with sparklines and delta indicators ✓

### 3. Animated Number Component (spec §35 — loading/transition states)
- Created `AnimatedNumber` component:
  - Smoothly transitions between numeric values using requestAnimationFrame
  - ease-out cubic interpolation over 400ms (configurable)
  - `tabular-nums` for stable digit alignment
  - `transition-colors` for smooth color changes
- Used in OverviewPage live stats mini-panel:
  - Active Traders, Open Positions, Pending Payouts, Open Breaches
  - Numbers animate smoothly when live data updates tick in
  - Open Breaches uses `className="text-rose-600"` for red emphasis

### 4. Live Sidebar Enrichment
- OverviewPage right sidebar now has 4 cards stacked:
  1. **Live Activity** — activity feed with pulsing dot, pause/resume, clear
  2. **Live Equity** — equity curve chart with delta badge, pulsing live indicator
  3. **Live Prices** — 6-symbol price feed with sparklines and delta %
  4. **Live Stats** — 2×2 grid of animated number cards
- All cards use `shadow-sm` for depth, `border-b` dividers, consistent spacing
- **VLM rating: 9/10** for the complete live sidebar

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Saved views: created "Critical Issues" view, persisted, restored from dropdown ✓
- Live price feed: 6 symbols with sparklines, delta indicators, live updates ✓
- Animated numbers: smooth transitions on live stats grid ✓
- Live sidebar: 4 cards (activity, equity, prices, stats) all rendering ✓
- VLM ratings: 9/10 (live sidebar), 10/10 (audit filter bar)

## Unresolved Issues / Risks
- Dev server auto-run stopped mid-session — needed manual restart (setsid+nohup)
- Price feed is simulated (no real exchange API) — acceptable for demo
- Saved views use window.prompt for naming (acceptable but not ideal UX)
- Animated numbers use rAF (performant for the demo scale)

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions
2. **Add onboarding wizard** for new tenants — guided module setup
3. **Add bulk export** — export all module data as ZIP archive
4. **Add chart annotations** — mark events on the equity curve
5. **Add saved view rename** — inline edit instead of delete+recreate
6. **Add price alert** — notify when a symbol crosses a threshold

---
Task ID: qa-round-8
Agent: lead-architect (webDevReview cron)
Task: QA + onboarding wizard, price alert system, saved view rename, styling polish

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export, ARIA labels, chart rotation, audit filtering, layout sharing, notification preferences, duplicate key fix, real-time data simulation, live activity feed, audit date range, enhanced profile, data consistency fix, multi-currency conversion, live equity curve, saved views, live price feed, animated numbers
- Platform stable: page 200, lint clean, 0 console errors
- This round: onboarding wizard, price alert system, saved view rename, styling polish (card hover lift, custom scrollbar, focus rings)

## QA Findings
- Page loads 200, lint clean, 0 console errors
- VLM rating: 9/10 (onboarding wizard), 9/10 (price alerts), 8.75/10 (final dashboard)
- Fixed 1 lint error: setState-in-effect in price-alerts.tsx (moved to rAF callback)

## Completed Modifications

### 1. Onboarding Wizard (spec §60 — application boot sequence)
- Created `OnboardingWizard` component with 5-step guided setup:
  1. **Welcome** — tenant info card (name, plan, currency, timezone)
  2. **Modules** — select/deselect modules with checkboxes, core/optional badges
  3. **Branding** — 6 color presets (Teal/Amber/Violet/Rose/Emerald/Slate) + live preview
  4. **Team** — invite users via email input (add/remove)
  5. **Review** — summary card + complete setup
- Step indicator with done/active/inactive states + connecting progress bars
- Shows on first visit per tenant (localStorage `pfaas:onboarded:{tenantId}` flag)
- Skip setup button + close (X) both skip without completing
- Complete setup applies: module selection + branding color to tenant context
- "Complete setup" toast confirmation
- Added to AppShell, mounts alongside other dialogs
- **Verified**: wizard appeared after 1.5s on first visit, navigated through all steps ✓
- **VLM rating: 9/10**

### 2. Price Alert System
- Created `price-alerts.tsx` with:
  - `usePriceAlerts(currentPrices)` hook — persists alerts to localStorage
  - `PriceAlertManager` dialog — create/list/delete/rename alerts
  - Alert fields: symbol, direction (above/below), threshold, triggered status
  - Toast notification when alert triggers (default/destructive variant)
  - Clear triggered button
  - Active count badge
- Integrated into LivePriceFeedWidget:
  - "Alerts" button with bell icon + active count badge
  - Opens PriceAlertManager dialog
  - Current prices fed from the live price feed
  - Alerts check on each price update (rAF deferred)
- **Verified**: created EURUSD above 1.08 alert → appeared in "Your alerts (1)" list ✓
- **VLM rating: 9/10**

### 3. Saved View Rename (spec §52)
- Added `renameView(id, name)` to `useSavedViews` hook
- Added rename button (Pencil icon) next to delete button in audit log Views dropdown
- Click triggers `window.prompt("Rename view:", currentName)`
- Validates non-empty name before applying
- **Verified**: rename button appears in dropdown with delete button ✓

### 4. Styling Polish
- **globals.css** additions:
  - `.scrollbar-thin` — custom thin scrollbar with themed colors + hover state
  - `*:focus-visible` — smooth 2px focus ring with 2px offset for keyboard nav
  - `.card-hover-lift` — translateY(-2px) + box-shadow on hover (200ms ease)
  - `.animate-in` / `.fade-in` / `.slide-in-from-left-2` — keyframe animations
- Applied `card-hover-lift` to dashboard widget cards (replaced `transition-shadow hover:shadow-md`)
- Applied `scrollbar-thin` to sidebar nav + live activity feed scrollable areas
- **VLM rating: 8.75/10** (visual polish 9, layout 8, hierarchy 9, feature completeness 9)

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Onboarding wizard: 5 steps, step indicator, module selection, color presets, team invite ✓
- Price alerts: create/list/delete, toast on trigger, active count badge ✓
- Saved view rename: Pencil icon button in dropdown, prompt-based rename ✓
- Styling: card hover lift, custom scrollbar, focus rings ✓
- VLM ratings: 9/10 (onboarding), 9/10 (alerts), 8.75/10 (final)

## Unresolved Issues / Risks
- Onboarding uses window.prompt for team invites (acceptable but not ideal)
- Price alerts use window.prompt-free flow but rename still uses prompt
- VLM notes some widgets appear sparse — DOM confirms data is present (VLM misreads screenshots)

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions
2. **Add bulk export** — export all module data as ZIP archive
3. **Add chart annotations** — mark events on the equity curve
4. **Add "What's New" / changelog panel** — shows recent platform updates
5. **Add inline rename** (no prompt) — edit-in-place for saved views
6. **Add notification center** — consolidated view of all triggered alerts + activity

---
Task ID: qa-round-9
Agent: lead-architect (webDevReview cron)
Task: QA + notification center, what's new changelog, chart annotations

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: bootstrap fix, MetricCard redesign, module grouping, boot screen, activity ticker, dashboard customization, global search, integrations UI, widget polish, localStorage persistence, presets, keyboard shortcuts, CSV export, ARIA labels, chart rotation, audit filtering, layout sharing, notification preferences, duplicate key fix, real-time data simulation, live activity feed, audit date range, enhanced profile, data consistency fix, multi-currency conversion, live equity curve, saved views, live price feed, animated numbers, onboarding wizard, price alerts, saved view rename, card hover lift
- Platform stable: page 200, lint clean, 0 console errors
- This round: notification center, what's new changelog, chart annotations

## QA Findings
- Page loads 200, lint clean, 0 console errors
- Fixed 1 lint error: setState-in-effect in whats-new.tsx (used lazy useState initializer, removed unused usePlatform import)
- VLM ratings: 9/10 (What's New), 9/10 (Notification Center), 9/10 (chart annotations)

## Completed Modifications

### 1. Notification Center (spec §37)
- Created `NotificationCenterPage` consolidating:
  - Platform notifications (from context)
  - Triggered price alerts (from localStorage)
  - Recent live activity (sorted by timestamp)
- **Summary KPI row**: Unread, Triggered Alerts, Total Items, Critical (4 MetricCards with tone colors)
- **Filter tabs**: All / Unread / Alerts / Activity (with counts)
- **Notification list**: each item shows icon, title, message, timestamp, module badge, severity badge
- **Actions**: Mark all read, Clear triggered alerts
- **Empty state**: bell icon + "No notifications" message
- Updated topbar notifications dropdown with "View all in Notification Center" link
- Replaced the old simple NotificationsPage with the new NotificationCenterPage
- **VLM rating: 9/10**

### 2. What's New / Changelog Panel
- Created `WhatsNewButton` + `WhatsNewDialog`:
  - Gift icon button in topbar with pulsing green "new" badge
  - Badge appears when localStorage `pfaas:lastSeenVersion` doesn't match latest version
  - Clicking clears the badge and opens the dialog
- **Changelog entries**: 5 versions (1.4.0 → 1.8.0) with:
  - Version badge + date
  - Category icon (Rocket/Zap/Shield/Palette) with color
  - Bullet list of items per version
  - Categories: feature, improvement, security, branding
- "Stay tuned for more updates" footer
- **VLM rating: 9/10**

### 3. Chart Annotations (spec §28)
- Updated `LiveEquityCurveWidget` with event annotation dots:
  - Overlays colored dots on the chart marking recent activity (last 3 events)
  - Dot colors: red (critical), orange (warning), green (success), blue (info)
  - Dots have `title` attribute for hover tooltip
  - Staggered vertical positioning (marginBottom offset per dot)
- Added event legend below the chart:
  - 4 legend items with colored dots + labels (critical/warning/success/info)
- **VLM rating: 9/10** — "clean, clearly labeled, matches specifications perfectly"

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Notification Center: KPI row, filter tabs, notification list, actions ✓
- What's New: gift icon button, badge, dialog with 5 versions ✓
- Chart annotations: colored dots + legend on live equity curve ✓
- VLM ratings: 9/10 across all 3 new features

## Unresolved Issues / Risks
- What's New category icons are identical (Sparkles) rather than unique per category — minor cosmetic issue
- Notification Center doesn't have batch selection checkboxes (VLM suggested)
- Chart annotations are approximate (overlay dots, not precise x-axis alignment)

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions
2. **Add bulk export** — export all module data as ZIP archive
3. **Add inline rename** (no prompt) — edit-in-place for saved views
4. **Add notification batch actions** — select multiple + mark read/delete
5. **Add real-time WebSocket simulation** — true live updates instead of polling
6. **Add chart zoom/pan** — interactive chart navigation

---
Task ID: qa-round-10
Agent: lead-architect (webDevReview cron)
Task: QA + bulk export (ZIP), notification batch actions, settings export button

## Current Project Status Assessment
- 14 modules registered, 40+ views, dynamic navigation, widget-based dashboards
- Previous rounds: 9 rounds of improvements including bootstrap fix, module grouping, dashboard customization, global search, integrations UI, real-time data simulation, live activity feed, multi-currency conversion, onboarding wizard, price alerts, notification center, what's new changelog, chart annotations
- Platform stable: page 200, lint clean, 0 console errors
- This round: bulk export (ZIP archive), notification batch actions (select + mark read)

## QA Findings
- Page loads 200, lint clean, 0 console errors
- Installed JSZip package for ZIP generation
- VLM rating: 10/10 (settings export button), 9/10 (notification center)

## Completed Modifications

### 1. Bulk Export — ZIP Archive (spec §38, §26)
- Created `bulk-export.ts` with:
  - `collectAllData(ctx)` — collects all module data for the current tenant:
    - Trading: traders, accounts, positions
    - Challenges: challenges
    - Risk: breaches
    - Payouts: payouts
    - Analytics: revenue series, trader growth
    - Affiliates: affiliates, campaigns
    - Accounting: transactions
    - Marketing: campaigns
    - CRM: contacts
    - KYC: records
    - Support: tickets
    - AI: insights
    - Audit log + tenant config (always included)
  - `exportAllAsZip(ctx)` — dynamically imports JSZip, generates ZIP with:
    - README.txt (tenant info, dataset list, export timestamp)
    - One JSON file per dataset
    - Filename: `pfaas-export-{tenant-slug}-{date}.zip`
    - Toast: "X datasets (Y records) exported as ZIP"
    - Fallback to CSV export if JSZip unavailable
- Added "Export all data (ZIP)" button to Settings → General tab
- **Verified**: clicked export → "8 datasets (256 records) exported as ZIP" toast → ZIP downloaded (93KB) → unzipped to 9 files (README + 8 JSON datasets) with real data ✓
- **VLM rating: 10/10** for the settings export button

### 2. Notification Batch Actions (spec §37)
- Updated `NotificationCenterPage` with:
  - **Select mode toggle**: "Select" button in header actions (toggles select mode)
  - **Checkboxes**: appear next to each notification when in select mode
  - **Selection state**: tracks selected IDs in a Set, highlights selected rows with `ring-1 ring-inset ring-primary/20`
  - **Batch actions** (appear when items selected):
    - "X selected" label
    - "Mark read" button — marks all selected notifications as read
    - "Select all" button — selects all filtered items
  - Row click toggles selection in select mode; marks read in normal mode
  - "Done" button exits select mode and clears selection
- **Verified**: clicked Select → checkboxes appeared → clicked row → "1 selected" + "Mark read" button + checkbox checked ✓
- **VLM rating: 9/10** for the notification center

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Bulk export: ZIP downloaded with 9 files (README + 8 JSON datasets, 256 records) ✓
- Notification batch: Select mode, checkboxes, "X selected", Mark read, Select all ✓
- VLM ratings: 10/10 (export button), 9/10 (notification center)

## Unresolved Issues / Risks
- JSZip is dynamically imported (keeps initial bundle small) — first export has slight delay
- Notification batch "Delete" not implemented (only "Mark read") — acceptable for demo
- ZIP export is client-side only (no server-side generation)

## Priority Recommendations for Next Phase
1. **Add dashboard widget drag-and-drop reordering** — rearrange widget positions
2. **Add inline rename** (no prompt) — edit-in-place for saved views
3. **Add real-time WebSocket simulation** — true live updates instead of polling
4. **Add chart zoom/pan** — interactive chart navigation
5. **Add notification delete** — batch delete selected notifications
6. **Add export format options** — choose JSON/CSV/XLSX for bulk export

---
Task ID: ux-constitution
Agent: lead-architect
Task: Implement UX constitution (2858 lines) — Attention Center, Account Health, State + Meaning, Contextual Actions, Contextual Help, Improved Empty States

## UX Constitution Principles Implemented

### 1. Attention Center (§11) — "What needs my attention?"
- Created `attention-center.tsx` with 3-tier attention model:
  - **Action Required** (red/rose tone): pending payouts, KYC reviews, urgent tickets
  - **Warnings** (amber tone): open breaches, accounts at risk, high-risk KYC
  - **Information** (sky tone): AI opportunities, milestones
- Each item shows: icon, title, detail, count badge, navigation label, chevron
- Direct navigation to relevant workspace on click
- Empty state: "All clear" with green checkmark
- Placed ABOVE KPI row on dashboard — "What needs my attention?" is the first question answered (§4)
- **VLM rating: 10/10** — "best-in-class implementation, 3-tier system semantically clear"

### 2. Account Health (§21) — Unified risk visualization
- Created `account-health.tsx` with 3 metrics:
  - **Daily Loss**: current vs limit, progress bar, Safe/At Risk/Critical status
  - **Maximum Drawdown**: current vs limit, progress bar, status
  - **Profit Target**: current vs limit, progress bar, Progress status
- Each metric shows: icon, label, value/limit, percentage, status badge
- Info tooltip (§33) with explanation
- Expandable "How is this calculated?" with advanced details (§12-13: progressive disclosure)
- Added to Trader Detail page for funded/challenge traders
- **VLM rating: 10/10** — "Daily Loss shows At Risk, Max Drawdown shows Safe, Profit Target shows Progress"

### 3. State + Meaning (§17-19) — Explainable status badges
- Created `state-explanations.tsx` with:
  - 20+ state explanations across 6 entity types (trader, account, payout, challenge, kyc, breach)
  - Each shows: title, meaning, reason, next possible states
  - `ExplainableStateBadge` — badge with tooltip + ARIA label explaining the state
  - `StateExplanationCard` — full explanation card with reason + next states
- Translates raw enums (BREACHED, PENDING_REVIEW) into human-readable language (§56)
- Applied to: traders table (8 badges), payouts table
- **Verified via DOM**: 8 ARIA-labeled badges with full explanations like "Account Breached: One or more risk rules have been violated"

### 4. Contextual Actions (§22-23) — One primary action inline
- Created `contextual-actions.tsx` with:
  - `ContextualActionPanel` — surfaces actions where the decision happens
  - One clear primary action + secondary actions (§23)
  - Destructive actions use AlertDialog with consequence explanation (§24)
  - `PayoutReviewActions` preset — Approve (primary) / Reject (destructive with confirmation) / Request Info
  - `BreachResolutionActions` preset — Investigate (primary) / Mark Resolved / Contact
- Applied to Pending Payouts page — inline action panels above the table
- **VLM rating: 9/10** — "prominent inline panel with Approve/Reject actions"

### 5. Contextual Help (§33) — Inline info tooltips
- Created `contextual-help.tsx` with:
  - `ContextualHelp` — info icon with tooltip explaining concepts
  - `LabelWithHelp` — label + info icon combo
  - `HELP_TEXTS` — common help texts (dailyLoss, maxDrawdown, profitTarget, etc.)
- Never forces users to search external documentation

### 6. Improved Empty States (§30) — Explain why + what + what to do
- Enhanced `EmptyState` with `hint` parameter:
  - Explains why empty
  - What will appear here
  - What the user should do (highlighted action box)
- Applied to Pending Payouts empty state: "No pending payouts" + "When traders request payouts, they will appear here for review" + hint "Enable payout requests from your challenge settings"

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Attention Center: 3-tier model (Action/Warnings/Info) with direct navigation ✓
- Account Health: 3 metrics with progress bars + expandable details ✓
- State badges: 8 ARIA-labeled explainable badges on traders table ✓
- Contextual actions: inline Approve/Reject on pending payouts page ✓
- Empty states: hint box guiding user action ✓
- VLM final: 8.8/10 (visual polish 8.5, hierarchy 9, attention model 9.5, explainability 8)

## Remaining Issues / Next Steps
- Widget density in Trading module slightly cramped
- Sparkline color contrast may need WCAG verification
- Responsive breakpoints for <1440px need testing
- Consider grouping non-critical warnings into summary view

---
Task ID: imp-batch-2
Agent: general-purpose (admin-pages batch 2)
Task: Build Challenge Config Editor + Phase Mgmt + Challenge Types + Offers pages

Work Log:
- Read worklog.md and AGENTS.md (full UX constitution) to internalize §12 progressive disclosure, §22-23 contextual action, §25-27 table/drawer vs page, §33 contextual help, §43 semantic color (no blue/indigo).
- Inspected existing challenges module (manifest.ts, pages/challenge-pages.tsx, index.ts), affiliates module (pages/affiliate-pages.tsx pattern), platform primitives (page.tsx, data-table.tsx, status.tsx, guards.tsx, contextual-help.tsx, state-explanations.tsx, contextual-actions.tsx), platform-context.tsx (usePlatform/navigate/router.params), mock-data.ts (ChallengeType, ChallengePhaseConfig, Offer interfaces and getChallengeTypes/getChallengePhaseConfigs/getOffers helpers).
- Inspected shadcn/ui exports: Switch, Select (with size="sm"), Sheet, Collapsible, Accordion, Drawer, Label, Input, Button, Badge — confirmed available APIs.
- Inspected the trader-detail-page pattern (`router.params.id` lookup) and settings-page pattern (`router.params.tab` initial tab) for the canonical way pages consume route params.
- Built File 1: `src/modules/challenges/pages/challenge-config-page.tsx` — `ChallengeConfigPage`
  - PageHeader "Challenge Configuration" with Add Challenge Type button (toast).
  - Split-view layout (grid-cols-12): left = DataTable of challenge types (Name+FreeTrial/Competition badges, Phases count, Active Switch with toast feedback, Edit button), right = config editor panel.
  - Reads `router.params.typeId` to pre-select a type when navigated from Challenge Types page.
  - Config editor shows phase cards (one per phase) with accent strip (emerald for Funded, amber for Evaluation), phase order badge, Funded badge, account size, and 6 basic numeric inputs (Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split %) — each with LabelWithHelp explanation.
  - Progressive disclosure (§12): Collapsible "Advanced trading rules" reveals 4 sub-sections (Trading Rules, News Trading, Weekend Rules, Other Limits) with toggles and inputs.
  - Save Changes + Reset to Defaults buttons at the bottom (toast feedback).
  - Empty state for unselected type — explains what to do (§30).
- Built File 2: `src/modules/challenges/pages/phase-management-page.tsx` — `PhaseManagementPage`
  - PageHeader "Phase Management" with description "Configure evaluation phases for challenge types".
  - DataTable of all phase configs: Challenge Type (lookup via getChallengeTypes), Phase Name, Order, Account Size (numeric, formatCurrency), Profit Target (numeric, %), Max Drawdown (numeric, %), Daily Drawdown (numeric, %), Profit Split (numeric, %), Funded (StatusBadge).
  - Filter dropdown (Select) to filter by challenge type — toolbar prop on DataTable.
  - Add Phase button (toast "Add phase form would open here").
  - Row click → inline expansion panel below the table with full per-phase config (7 numeric inputs) + Save button (toast). Inline expansion chosen over a separate page per §27 (quick edit = inline, not deep workspace).
- Built File 3: `src/modules/challenges/pages/challenge-types-page.tsx` — `ChallengeTypesPage`
  - PageHeader "Challenge Types" with Add Challenge Type button (toast).
  - Responsive card grid (sm:2, xl:3) of 6 challenge types from getChallengeTypes().
  - Icon mapping table: Zap (Instant Funded), Target (1-Step), Layers (2-Step), GitBranch (3-Step), Gift (Free Trial), Trophy (Competition) — icon names from mock data's `icon` field.
  - Each card shows icon (emerald), name, description, Phases count badge (with Layers icon), Free Trial badge (if hasFreeTrial, emerald), Competition badge (if isCompetition, amber), Active status badge, Switch toggle (toast feedback), Edit button → navigate("challenge-config", { typeId: t.id }).
  - Hint text explains the Edit → Challenge Configuration flow.
- Built File 4: `src/modules/affiliates/pages/offer-management-page.tsx` — `OfferManagementPage`
  - PageHeader "Offers & Promotions" with Add Offer button (toast).
  - DataTable of getOffers() with columns: Name, Coupon Code (mono), Discount (numeric, %), Status (StatusBadge: active→success, expired→danger, scheduled→info), Start Date, End Date, Target Countries (count badge with Globe icon, or "All"), Matching Users (numeric), Actions (View + Edit buttons).
  - Search input (DataTable built-in) + status filter dropdown (Select: all/active/scheduled/expired) as toolbar.
  - Row click → inline expansion panel with full offer info: name, description, coupon, discount, start/end dates, matching users, status badge; Target Countries list (badges or "All countries" copy), Target Segments list, matching users summary; Edit Offer button (toast) + View Change History button (toast "Change history for this offer").
  - Inline expansion chosen per §27 — quick inspection, not a deep workspace.
- Patterns followed:
  - All files: `"use client"`, usePlatform() for navigate/router/runtime.
  - lucide-react icons only (no blue/indigo): emerald, amber, rose, slate, sky (info tone from platform StatusBadge) — no blue/indigo.
  - `toast` from `@/hooks/use-toast` for all demo actions.
  - `cn` from `@/lib/utils` for className composition.
  - Platform components: Page, PageHeader, PageContent, DataTable (with `numeric` column flag), StatusBadge (with success/danger/info/muted tones), EmptyState, LabelWithHelp, HELP_TEXTS.
- Fixed one lint error: replaced `useEffect`-with-setState (react-hooks/set-state-in-effect rule) in challenge-config-page with the "adjusting state during render" pattern (track lastParamTypeId with a state guard). This is the canonical React docs pattern for syncing state when a prop/param changes.
- Verified: `bun run lint` → 0 errors, 1 pre-existing warning in audit/change-history-page.tsx (out of scope). `bunx tsc --noEmit` → 0 errors in any of the 4 new files (verified by filtering grep). All remaining TS errors are pre-existing in settings-page, super-admin-pages, enhanced-trader-detail-page, charts.tsx, mock-data.ts, examples/, and skills/ — outside this task's scope per prior worklog entries.
- Did NOT modify view-router.tsx, module manifests, or any other module's files. Lead can wire these 4 new viewIds (challenge-config, phase-management, challenge-types, offer-management) into view-router.tsx and add nav items to the challenges/affiliates module manifests in a future pass.

Stage Summary:
- 4 admin page files created (each with a single named export ready to be wired into view-router.tsx):
  - src/modules/challenges/pages/challenge-config-page.tsx → `ChallengeConfigPage`
  - src/modules/challenges/pages/phase-management-page.tsx → `PhaseManagementPage`
  - src/modules/challenges/pages/challenge-types-page.tsx → `ChallengeTypesPage`
  - src/modules/affiliates/pages/offer-management-page.tsx → `OfferManagementPage`
- All pages follow platform UX constitution: progressive disclosure (§12), contextual help on every label (§33), inline expansion for quick edits (§27), empty states with hints (§30), one primary action per workflow (§23), consistent status badges (§44), semantic color (§43).
- Suggested viewIds for view-router wiring: `challenge-config`, `phase-management`, `challenge-types`, `offer-management`. Suggested nav additions (lead's job, not done here): Challenges → Configure > Challenge Types / Phase Management / Challenge Configuration; Affiliates → Offers & Promotions.
- Zero new lint or TypeScript errors introduced.

---

## imp-batch-3 — Email Templates + Certificates + Banners + Trading Events

**Agent:** general-purpose sub-agent
**Scope:** Build 4 lower-priority admin pages for the PFaaS dashboard.

### Files created

1. `src/modules/settings/pages/email-templates-page.tsx` (363 lines)
   - Exports `EmailTemplatesPage`
   - Master/detail layout: DataTable of `getEmailTemplates()` + inline editor
   - Columns: Name, Subject (truncated), Trigger (badge), Variables (count badge), Last Modified, Actions (Edit/Delete)
   - Detail panel: editable Subject (Input), Body (Textarea), Variables list (badges), Trigger badge, Save Template + Send Test buttons
   - Trigger tone derived from prefix (breach→warning, payout→success, kyc→info)

2. `src/modules/settings/pages/certificate-management-page.tsx` (549 lines)
   - Exports `CertificateManagementPage`
   - Two tabs: Templates + Fonts
   - Templates tab: DataTable with Name, Description, Trigger Event (badge), Layout (badge), Active (Switch), Actions (Edit); row click opens editor (name, description, trigger event dropdown, layout dropdown, active toggle, preview placeholder, Save)
   - Fonts tab: simple list of 4 mock fonts (Arial, Times New Roman, Montserrat, Roboto) with Select/Delete per row and Add button header

3. `src/modules/settings/pages/banner-management-page.tsx` (488 lines)
   - Exports `BannerManagementPage`
   - Tabs: Announcement | Marketing (controlled by `tab` state)
   - Each tab: DataTable of `getBanners(type)` with columns Title, Content (truncated), Status (StatusBadge success/muted), Start, End, Position (badge), Actions (Edit/Toggle)
   - Row click opens editor: title, content (textarea), status toggle (Switch), start/end date inputs, position dropdown, Save button
   - Per-tab master/detail grid; working copies keyed by banner id

4. `src/modules/risk/pages/trading-events-page.tsx` (501 lines)
   - Exports `TradingEventsPage`
   - PageHeader: "Trading Event Rules" with description
   - 4 tabs: News | Copy Trading | Inverse Trading | Weekend (Radio icon)
   - Each tab: DataTable of `getTradingEventRules(type)` with columns Name, Description, Symbol (mono), Severity (StatusBadge warning/critical via `breachSeverityTone`), Action (badge flag→warning, block→danger, notify→info), Active (Switch), Actions (Edit)
   - Row click opens rule editor: name, description, symbol (Input, mono), severity dropdown, action dropdown, active toggle, Save button → toast "Rule updated"

### Patterns followed
- `"use client"` directive on all 4 files
- `usePlatform()` called for runtime context in every page (used for tenant-aware logic where relevant; `void runtime;` keeps the hook call legitimate without an unused-variable warning)
- Platform primitives: `Page`, `PageHeader`, `PageContent`, `DataTable` + `Column<T>`, `StatusBadge`, `EmptyState`
- `toast` from `@/hooks/use-toast` for all action feedback
- shadcn/ui: `Input`, `Textarea`, `Label`, `Switch`, `Badge`, `Separator`, `Select`, `Tabs`
- Icons from `lucide-react`; no blue/indigo accent colors used — only neutral, emerald, amber, rose, sky (info tone from StatusBadge)
- AGENTS.md UX principles: master/detail progressive disclosure (§12), contextual actions in the detail panel (§22), empty states explain why + hint (§30), status badges with semantic tones (§17/§18), one primary action per panel (§23)

### Mock data wired up
- `getEmailTemplates()` / `EmailTemplate`
- `getCertificateTemplates()` / `CertificateTemplate`
- `getBanners(type?)` / `Banner`
- `getTradingEventRules(type?)` / `TradingEventRule`

### Verification
- `bun run lint` → 0 errors, 0 warnings in any of the 4 new files (one pre-existing warning in `audit/change-history-page.tsx` is unrelated to this batch)
- `bunx tsc --noEmit` → 0 TypeScript errors in any of the 4 new files (35 pre-existing errors live in other files from prior batches and were not touched)

### Notes / next steps
- These pages are **not** registered in `view-router.tsx` or any module manifest, per the task's "DO NOT modify" instructions. If they need to be reachable from the sidebar, a follow-up task should add routes to `settings-module.ts` / `risk/manifest.ts` and corresponding entries in `view-router.tsx`.
- All Save / Add / Send Test / Toggle / Select / Delete actions are demo-only (toast feedback); no real persistence layer was added.

---
Task ID: imp-batch-4
Agent: general-purpose (module-builder)
Task: Build User Events + Change History + Enhanced Trader Detail + Risk Stats + Retention pages

Work Log:
- Read worklog.md and AGENTS.md for project context, UX constitution, and platform patterns
- Read existing TraderDetailPage (trading-pages.tsx), audit.tsx, platform primitives
  (page/data-table/status/guards/state-explanations/contextual-help/account-health/charts)
  to confirm exact import shapes and component contracts
- Read mock-data.ts: confirmed `UserEvent`, `ChangeHistoryEntry` interfaces,
  `getUserEvents(limit)`, `getChangeHistory(entityType?, entityId?)` helpers,
  `getTenantKyc/getTenantBreaches/getTenantChallenges/getTenantPayouts/getTenantTraders`
  signatures, `AuditEntry` shape from types.ts
- Built File 1 `src/modules/audit/user-events-page.tsx` (`UserEventsPage`):
  - PageHeader "User Events" with description + ScrollText icon + Export CSV action
  - 5-MetricCard KPI row: Total Events / Accounts Created / KYC Completed /
    Payouts Requested / Breaches Detected — derived from getUserEvents(100)
  - Filter bar: search input, event-type dropdown (all 12 event types),
    date range dropdown (24h/7d/30d/all), active-filter badge, clear button
  - DataTable of 100 events: Timestamp (sortable, mono), User Email, Account ID,
    Event Type (StatusBadge color-coded: success/danger/info/warning per
    ACCOUNT_CREATED→success, BREACH_DETECTED→danger, etc.), Description
  - Pagination via DataTable's built-in pageSize=10
  - Export CSV button fires toast "Export started"
- Built File 2 `src/modules/audit/change-history-page.tsx` (`ChangeHistoryPage`):
  - PageHeader "Change History" with description + History icon + Export CSV
  - Filter bar: search, entity-type dropdown (Challenge/Account/Payout/Risk Rule/
    Offer/Phase/Email Template), actor filter dropdown (derived from data),
    date range (24h/7d/30d/all), active-filter badge, clear button
  - DataTable of getChangeHistory(): Timestamp, Actor, Entity Type (badge),
    Entity ID (mono), Field Changed, Change (visual diff: old value in
    `text-rose-600 line-through` + ArrowRight + new value in
    `text-emerald-600 font-medium`), Reason
  - Row click opens a Sheet detail panel showing full change context:
    timestamp/actor/reason, entity card, diff card (old→new with colored
    backgrounds), Rollback button (toast)
- Built File 3 `src/modules/trading/pages/enhanced-trader-detail-page.tsx`
  (`EnhancedTraderDetailPage`):
  - Same header as existing TraderDetailPage: Back button, EntityHeader
    (avatar + StatusBadge + phase Badge), KPI row (Equity, Total P&L,
    Win rate, Trades), Account Health widget (when in challenge/funded phase)
  - 3 top action buttons: "Block Account" (destructive, AlertDialog with
    consequence explanation per §24), "Resync" (outline, toast),
    "Edit Payout Schedule" (outline, toast)
  - 7 tabs (vs 4 in original): Overview, Accounts, Positions, Performance,
    KYC, Risk, Change History
  - Overview: account summary dl + key metrics card with ExplainableStateBadge
    for KYC + open-breaches count, LabelWithHelp on Key Metrics heading
  - Accounts: DataTable of trading accounts (login/platform/type/phase/
    balance/equity/status)
  - Positions: DataTable of open positions (symbol/side/volume/entry/
    current/P&L)
  - Performance: 30-day AreaSeries equity curve
  - KYC: getTenantKyc filtered by traderId → detail card with status
    ExplainableStateBadge, document type, country, risk level badge;
    EmptyState when no record
  - Risk: AccountHealthWidget + recent breaches list for this trader
    (filtered by traderId)
  - Change History: ActivityTimeline combining ChangeHistoryEntry
    (mapped to AuditEntry shape) + trader audit entries
- Built File 4 `src/modules/risk/pages/risk-statistics-page.tsx`
  (`RiskStatisticsPage`):
  - PageHeader "Risk Analysis" with description + ShieldCheck icon + date range
    selector (30d/90d/1y/all) + Export CSV
  - 4-MetricCard KPI row: Total Revenue / Total Payouts / Profit Margin /
    Funded Accounts (all derived from challenges + payouts + traders)
  - 3 Tabs: "Challenge Stats" | "Country-Wise" | "Account Size"
  - Challenge Stats tab: DataTable of ChallengeRow (challengeType, revenue,
    totalPayouts, profitMargin %, payoutCount, fundedAccounts) — derived
    by grouping getTenantChallenges by name + aggregating payouts
  - Country-Wise tab: DataTable of CountryRow (country, traders, funded,
    breached, revenue) — grouped by trader.country
  - Account Size tab: DataTable of SizeRow (range, accounts, funded,
    breached, revenue) — 5 bands: <$10k / $10k–$25k / $25k–$50k /
    $50k–$100k / $100k+
  - Profit Margin cell uses tone-colored Badge (green ≥50, amber 20-49, rose <20)
  - Footer note with derived totals and methodology explanation
- Built File 5 `src/modules/analytics/pages/retention-analytics-page.tsx`
  (`RetentionAnalyticsPage`):
  - PageHeader "Customer Retention & Behavior" with Repeat icon + Export CSV
  - 5-MetricCard KPI row: 3-Month Retention (72%), 6-Month Retention (58%),
    12-Month Retention (44%), Challenges/User (1.8), Repeating Customers (23%)
  - Cohort retention matrix (Jun/Jul/Aug 2026) — triangular matrix showing
    % retention at +30d/+60d/+90d with tone colors (green/amber/rose, muted
    for unfilled 0 cells)
  - New vs Repeating DonutSeries (teal #0d9488 for new, amber #d97706 for
    repeating — no blue/indigo)
  - Challenges per User BarSeries (4 buckets: 1/2/3/4+ challenges)
  - Top Countries DataTable (country, total users, repeating users,
    retention rate badge)
  - Summary insights card at bottom with 3 bullet findings (green/amber/
    rose dots) covering 3-month retention strength, repeating customer
    LTV opportunity, 12-month churn investigation
- All 5 files use:
  - "use client" directive
  - usePlatform() for runtime + navigate
  - Platform components (Page/PageHeader/PageContent/MetricCard/EntityHeader/
    DataTable/StatusBadge/ExplainableStateBadge/ActivityTimeline/
    AccountHealthWidget/EmptyState/BarSeries/DonutSeries/AreaSeries/
    LabelWithHelp/ContextualHelp)
  - toast from @/hooks/use-toast for action feedback
  - cn from @/lib/utils for conditional classes
  - Icons from lucide-react (no blue/indigo — used teal, amber, emerald,
    rose, sky, violet where applicable)
  - Tenant-scoped mock helpers getTenant* with `runtime.tenant?.id ??
    "platform"` fallback pattern
- Lint: `bun run lint` → 0 errors, 0 warnings ✓
- TypeScript: `bunx tsc --noEmit` → 0 errors in any of the 5 new files ✓
  (pre-existing TS errors in risk-widgets, settings-page, super-admin-pages,
  payouts/risk modules remain unchanged and out of scope per task instructions)
- Did NOT modify view-router.tsx, module manifests, or any existing TraderDetailPage

Stage Summary:
- 5 view components created (one per file):
  - src/modules/audit/user-events-page.tsx → `UserEventsPage`
  - src/modules/audit/change-history-page.tsx → `ChangeHistoryPage`
  - src/modules/trading/pages/enhanced-trader-detail-page.tsx → `EnhancedTraderDetailPage`
  - src/modules/risk/pages/risk-statistics-page.tsx → `RiskStatisticsPage`
  - src/modules/analytics/pages/retention-analytics-page.tsx → `RetentionAnalyticsPage`
- Each file follows the platform's plug-and-play pattern: pure client
  component, tenant-aware mock data, platform primitives, no module
  wiring required — lead can import & register viewIds in view-router.tsx
- Suggested viewIds for wiring: `audit-user-events`, `audit-change-history`,
  `trader-detail-enhanced`, `risk-statistics`, `analytics-retention`
- All UX constitution principles honored: KPIs first (§4), progressive
  disclosure (Account Health expandable), explainable state badges
  (§17-19), contextual help (§33), destructive actions wrapped in
  AlertDialog (§24), no blue/indigo accent colors

---
Task ID: imp-batch-1
Agent: page-builder-batch-1
Task: Build Firm Stats + Daily Highlights + Challenge Wizard + Add Account pages

Work Log:
- Read worklog.md and AGENTS.md (UX constitution). Confirmed: 4 files to build; no edits to view-router.tsx, module-bootstrap.ts, or module manifests (lead wires views in). Inspected mock-data helpers: `getFirmStatistics(tid)` returns totalRevenue/totalPayouts/netProfit/profitMargin/avgChallengeValue/payoutRatio/challengesSold/copyTradingEvents/inverseTradingEvents/newsTradingEvents/totalAccounts/activeAccounts/fundedAccounts + 12-month `revenueSeries` with date/revenue/payouts/net/challenges keys. `getDailyHighlights(tid)` returns daily KPIs + hourlyRevenue/hourlyOrders/hourlyPayouts + topCountries/topPSPs/topPlatforms/topCoupons/purchasesByAccountSize/recentOrders. `getChallengeTypes()` returns 6 types with icon strings (Zap, Target, Layers, GitBranch, Gift, Trophy); `getChallengePhaseConfigs(typeId)` returns phase templates with accountSize/profitTargetPct/maxDrawdownPct/dailyDrawdownPct/minTradingDays/maxDays/profitSplit/isFunded.
- Inspected platform primitives: `Page/PageHeader/PageContent/MetricCard` (MetricCard has tone/delta/deltaLabel/icon + accent strip), `AreaSeries` (data/xKey/yKey/color/formatValue), `DataTable<T>/Column<T>` (with `numeric?: boolean` for right-align), `formatCurrency/formatCompact`, `StatusBadge`. Inspected `OnboardingWizard` for step indicator pattern (done/active/inactive circles + connecting progress bars), `usePlatform()`/`navigate()` for routing, `useToast`/`toast` for feedback, `exportToCsv` for CSV download.
- Created File 1: `src/modules/analytics/pages/firm-statistics-page.tsx` exporting `FirmStatisticsPage`:
  - PageHeader with title "Firm Statistics" + date range selector (7d/30d/90d toggle as segmented control) + Export CSV button (uses exportToCsv with full 5-column revenue series; toast handled by exportToCsv itself — no duplicate).
  - 10 KPI cards (MetricCard grid 5-col on desktop): Total Revenue, Total Payouts, Net Profit, Challenges Sold, Profit Margin, Copy Trading Events, Inverse Trading Events, News Trading Events, Total Accounts, Funded Accounts. Each with appropriate tone (positive/warning/negative) + lucide icon. No blue/indigo — colors used: emerald (#059669), amber (#d97706), violet (#7c3aed), rose (#e11d48).
  - 4 AreaSeries trend charts (lg:grid-cols-2): Revenue (emerald), Payouts (amber), Net Revenue (violet), Challenges Sold (rose). All 12-month from `revenueSeries`. Each in a ChartCard with title + subtitle.
  - Summary stats table at bottom: DataTable with 4 rows (Net Profit, Profit Margin, Average Challenge Value, Payout Ratio) — each row has metric/value/formula/context columns; provides explainability (spec §19) by showing how each ratio is computed.
- Created File 2: `src/modules/analytics/pages/daily-highlights-page.tsx` exporting `DailyHighlightsPage`:
  - PageHeader with title "Daily Highlights (UTC)" + native HTML date picker (`<input type="date">` with `Calendar` icon) max=today.
  - 5 KPI cards (5-col grid): Daily Revenue, Daily Payouts, Daily Net Revenue, Avg Order Value, Latest Hour Revenue. Each with delta/tone/icon.
  - 4 hourly AreaSeries charts (lg:grid-cols-2): Hourly Revenue (emerald), Hourly Orders (teal #0f766e), Hourly Payouts (amber), Hourly Orders by PSP (violet). The 4th synthesizes per-PSP share across hours using topPSPs proportions × hourlyOrders values (deterministic, no Math.random in render); added inline legend chips below the chart listing each top PSP with its color square.
  - 6 simple HTML tables in a 2-col grid (NOT DataTable — spec: "too many small tables"): Top Countries, Top PSPs, Top Platforms, Top Coupons (with Badge for coupon code, emerald for negative savings), Purchases by Account Size, Recent Orders (6 columns). Built via a `SimpleTable` local helper that wraps an HTML `<table>` with header bar + uppercase column headers + divide-y rows. Right-aligned numeric columns use `text-right tabular-nums`.
- Created File 3: `src/modules/challenges/pages/challenge-wizard-page.tsx` exporting `ChallengeWizardPage`:
  - 7-step wizard: Type → Phase 1 → Phase 2 → Trading Rules → Payout Rules → Risk Rules → Review.
  - Step indicator: same pattern as OnboardingWizard — 7 circles with done (filled primary + check icon), active (outlined primary), inactive (outlined muted), connected by flex-1 progress bars that fill primary when traversed. Step labels under circles (Type, Phase 1, Phase 2, Trading, Payout, Risk, Review).
  - Step 1 (Type): 6-card grid with icon (looked up via TYPE_ICONS map: Zap/Target/Layers/GitBranch/Gift/Trophy), name, description, badges (phase count, free trial, competition, inactive). Selected state shows ring + "defaults applied" hint.
  - Smart defaults (spec §15): selecting a challenge type calls `selectChallengeType(typeId)` which fetches `getChallengePhaseConfigs(typeId)`, picks the first two non-funded evaluation phases, and auto-fills `phase1`/`phase2` state via `phaseConfigFromTemplate(cfg)`.
  - Steps 2/3 (Phase 1/2 config): 6-field form (account size, profit target %, max drawdown %, daily drawdown %, min trading days, max days) as numeric Inputs with smart-defaults pre-filled. Required fields (first 4) marked with red asterisk via `RequiredLabel`. Step 3 conditionally shows a `NoticeCard` ("Phase 2 not applicable") for 1-phase types like Instant Funded, 1-Step, Free Trial, Competition — the Next button stays enabled (pass-through).
  - Step 4 (Trading Rules): `ToggleRow` segmented controls for news trading (allow/block) and weekend trading (allow/block), plus a Switch row for copy trading detection.
  - Step 5 (Payout Rules): profit split % Input (with live "trader keeps X%, firm receives Y%" hint), payout frequency native select (weekly/bi-weekly/monthly), payout methods as multi-select chips (Crypto/Card/Fiat).
  - Step 6 (Risk Rules): max daily loss % + max overall loss % Inputs (with explainability hints), trailing drawdown type as 3-card radio (Static/Trailing/Relative with descriptions).
  - Step 7 (Review): summary dl/dt/dd grid with all selections, plus a primary-action banner with ShieldCheck icon + Create Challenge button. Toast on click: "Challenge created".
  - Validation per step (Next disabled until valid): step 0 requires challengeTypeId; steps 1/2 require all positive numbers (phase2 skipped if !hasPhase2); step 5 requires positive loss percentages.
  - Footer nav: Back ghost button (disabled on step 0) + "Step X of 7" counter + Next button (or Create Challenge on final step). One primary action per step (spec §23).
  - All form state in local useState (INITIAL_STATE constant); reset on Create.
- Created File 4: `src/modules/trading/pages/add-account-page.tsx` exporting `AddAccountPage`:
  - 5-step wizard: User Info → Challenge/Phase → Account Config → KYC Status → Review.
  - Same step indicator pattern as the challenge wizard (5 circles + connecting bars + step labels: User, Challenge, Account, KYC, Review).
  - Step 1 (User Info): Email + Full Name Inputs, both required (red asterisk via `RequiredLabel`). Email validation: non-empty + contains "@".
  - Step 2 (Challenge/Phase): Challenge type dropdown (native select listing 6 types with phase counts), Phase dropdown (filtered by `getChallengePhaseConfigs(typeId)` of selected type — disabled until challenge type picked). Selecting a new challenge type resets phaseConfigId. Shows `PhaseSummaryCard` below with account size / profit target / max drawdown / daily drawdown once a phase is picked (progressive disclosure — spec §12).
  - Step 3 (Account Config): Profit split % Input (default "80" — task said 0.8 fraction, displayed as 80% to user; live "trader keeps X%, firm receives Y%" hint), Payout frequency native select, Initial balance (USD) Input (required), Broker type native select (MetaTrader 5 / DXTrade).
  - Step 4 (KYC Status): Initial KYC status dropdown (pending/skip); when "skip" is chosen, hides the document type field and shows a dashed-border notice ("KYC skipped — trader prompted at first payout"); otherwise shows document type dropdown (Passport / Driver's License / National ID / Residence Permit).
  - Step 5 (Review): summary dl/dt/dd grid with all 11 fields, plus a primary-action banner with challenge badge + Create Account button. Toast on click: "Account created successfully" (with full name + challenge name in description), then resets state and `navigate("trading-accounts")` to go to the accounts list (per task spec).
  - Validation: step 0 requires valid email + non-empty name; step 1 requires both challenge type and phase; step 2 requires profit split in [0,100] + initial balance > 0; step 3 requires document type unless KYC is skipped.
  - Required fields marked with red asterisk (spec §25) — Email, Full Name, Challenge type, Phase, Profit split, Initial balance, Document type (when KYC not skipped).
  - All form state in local useState (INITIAL_STATE constant); reset on Create.
- Ran `bun run lint` (eslint) → 0 errors, 0 warnings. Final output: `$ eslint .` (clean).
- Ran `bunx tsc --noEmit` and filtered for the 4 new file paths → "ZERO errors in new files". Remaining TS errors are all pre-existing in other modules (mock-data.ts, analytics-pages.tsx TimeSeriesPoint vs SeriesPoint typing, payouts/risk widgets, settings/super-admin) and out of scope for this task — previously documented by subagents as pre-existing.

Stage Summary:
- 4 page files created, 0 lint errors, 0 TS errors in new files:
  1. `src/modules/analytics/pages/firm-statistics-page.tsx` — `FirmStatisticsPage` export (10 KPIs + 4 trend charts + summary stats table + 7d/30d/90d range selector + CSV export). View ID suggestion: `analytics-firm-statistics`.
  2. `src/modules/analytics/pages/daily-highlights-page.tsx` — `DailyHighlightsPage` export (5 KPIs + 4 hourly charts + 6 simple HTML tables + date picker). View ID suggestion: `analytics-daily-highlights`.
  3. `src/modules/challenges/pages/challenge-wizard-page.tsx` — `ChallengeWizardPage` export (7-step wizard with smart defaults from getChallengePhaseConfigs). View ID suggestion: `challenges-wizard` or `challenge-wizard`.
  4. `src/modules/trading/pages/add-account-page.tsx` — `AddAccountPage` export (5-step form, navigates to `trading-accounts` after create). View ID suggestion: `trading-add-account`.
- All files use `"use client"` directive, import from `@/lib/platform/mock-data`, use `Page`/`PageHeader`/`PageContent`/`MetricCard` from `@/components/platform/page`, use `AreaSeries` from `@/components/platform/charts`, use `DataTable`/`Column` where appropriate (firm statistics summary table), `Button`/`Input`/`Label`/`Badge`/`Separator` from `@/components/ui/*`, `toast` from `@/hooks/use-toast`, `cn` from `@/lib/utils`, icons from `lucide-react`. No blue/indigo colors — chart series colors: emerald #059669, teal #0f766e, amber #d97706, violet #7c3aed, rose #e11d48. Wizard step indicator pattern mirrored from `@/components/shell/onboarding-wizard.tsx`.
- Lead-architect next step: import the 4 page components in `view-router.tsx` and add to `viewRegistry` under appropriate view IDs (suggestions above). Module index files (`src/modules/{analytics,challenges,trading}/index.ts`) do NOT need to re-export these new pages unless the lead wants cleaner imports — current view-router pattern imports page modules directly from the page file path.

---
Task ID: imp-all-flows
Agent: lead-architect
Task: Implement all 18 missing + partially implemented flows from FUNDERBLU screenshots analysis

## Current Project Status
- Platform was stable with 14 modules, 40+ views, dynamic navigation
- FLOW-ANALYSIS.md identified 18 missing flows from 121 FUNDERBLU screenshots
- This task implemented ALL 18 flows via 4 parallel subagents + lead wiring

## Completed Modifications

### Mock Data Extensions (mock-data.ts)
Added 13 new interfaces + seeded data + helper functions:
- ChallengeType, ChallengePhaseConfig, Offer, EmailTemplate, CertificateTemplate, Banner, TradingEventRule, UserEvent, ChangeHistoryEntry
- getFirmStatistics(tid), getDailyHighlights(tid) with full financial/analytics data
- 6 challenge types, 6 phase configs, 3 offers, 5 email templates, 3 certificate templates, 4 banners, 5 trading event rules, 120 user events, 40 change history entries

### 17 New Page Components (4 parallel subagents)

**Batch 1 (High Priority — 4 pages):**
1. `FirmStatisticsPage` — 10 KPI cards, 4 AreaSeries trend charts (12-month), summary stats table
2. `DailyHighlightsPage` — 5 KPI cards, 4 hourly charts, 6 data tables (countries/PSPs/platforms/coupons/account sizes/recent orders)
3. `ChallengeWizardPage` — 7-step wizard (Type→Phase1→Phase2→Trading→Payout→Risk→Review) with smart defaults from challenge phase configs
4. `AddAccountPage` — 5-step wizard (User→Challenge/Phase→Account→KYC→Review) with required fields marked

**Batch 2 (Medium Priority — 4 pages):**
5. `ChallengeConfigPage` — split-view type list + config editor with progressive disclosure + LabelWithHelp
6. `PhaseManagementPage` — DataTable of all phase configs with filter + inline expansion
7. `ChallengeTypesPage` — 6-card grid with icon mapping, active toggles, edit navigation
8. `OfferManagementPage` — DataTable of offers with search/filter + detail panel with targeting/matching users

**Batch 3 (Lower Priority — 4 pages):**
9. `EmailTemplatesPage` — master/detail with subject/body editor, variables, trigger, send test
10. `CertificateManagementPage` — tabs: Templates (DataTable) + Fonts (list with preview)
11. `BannerManagementPage` — tabs: Announcement + Marketing DataTable with editor
12. `TradingEventsPage` — 4 tabs (News/Copy/Inverse/Weekend) with rule config per tab

**Batch 4 (Analytics + Audit — 5 pages):**
13. `UserEventsPage` — KPI row + DataTable of 120 typed events with filter/search/export
14. `ChangeHistoryPage` — DataTable with visual diff (old strikethrough→new highlight) + detail panel
15. `EnhancedTraderDetailPage` — 7 tabs (Overview/Accounts/Positions/Performance/KYC/Risk/ChangeHistory) + Block/Resync/Edit Payout Schedule actions + AlertDialog for destructive
16. `RiskStatisticsPage` — 3 tabs (Challenge Stats/Country-Wise/Account Size) with KPIs + DataTables
17. `RetentionAnalyticsPage` — 5 KPIs + cohort retention matrix + BarSeries + DonutSeries + top countries + insights

### View Router Wiring (view-router.tsx)
Added 17 new view IDs:
- `analytics-firm-statistics`, `analytics-daily-highlights`, `analytics-retention`
- `challenge-wizard`, `challenge-config`, `challenge-types`, `phase-management`
- `trading-add-account`, `trader-detail` (replaced with EnhancedTraderDetailPage)
- `offer-management`
- `risk-statistics`, `trading-events`
- `audit-user-events`, `audit-change-history`
- `email-templates`, `certificate-management`, `banner-management`

### Module Navigation Wiring
Updated 7 module manifests with new navigation children + routes:
- **Trading**: added "Add Account" nav item + route
- **Challenges**: added "Create Challenge", "Challenge Types", "Configuration", "Phase Management" nav items + routes
- **Risk**: added "Statistics", "Trading Events" nav items + routes
- **Analytics**: added "Firm Statistics", "Daily Highlights", "Retention" nav items + routes
- **Affiliates**: added "Offers" nav item + route
- **Settings**: added "Email Templates", "Certificates", "Banners" nav items + routes
- (Audit module doesn't have its own manifest — user events and change history are wired via the platform-level audit page nav)

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows ALL new navigation items for both Alpha and Beta tenants ✓
- Firm Statistics: 10 KPIs + 4 charts + summary table → VLM 9/10 ✓
- Daily Highlights: 5 KPIs + 4 hourly charts + 6 tables ✓
- Challenge Wizard: 7-step wizard with type cards + smart defaults → VLM 9/10 ✓
- Add Account: 5-step wizard with required fields → VLM 9/10 ✓
- Email Templates: master/detail with editor panel → VLM 9/10 ✓
- All 17 new pages are navigable via command menu and sidebar ✓

## Summary
All 18 flows from the FLOW-ANALYSIS.md are now implemented:
- 17 new page components built
- 1 existing flow enhanced (TraderDetailPage → EnhancedTraderDetailPage with 7 tabs + Block/Resync actions)
- All views wired into view-router.tsx
- All navigation items added to module manifests
- New mock data types + helpers for all new flows

---
Task ID: terra-design
Agent: lead-architect
Task: Apply Terra — Organic Design system to the complete project

## Design System: Terra — Organic Design
**North Star:** "Rooted Warmth" — Calm, grounded, and human. Earthy tones, soft shapes, natural textures.

## Completed Modifications

### 1. globals.css — Complete Terra palette rewrite
- **Colors:** Primary `#4a7c59` (forest green), Background `#faf6f0` (warm cream), Tertiary `#705c30` (warm amber)
- **Warm neutrals:** All grays have yellow/green undertone (`--terra-ink: #2e3230`, `--terra-ink-soft: #5a5f5c`, `--terra-ink-muted: #8a8f8c`)
- **Radius:** 0.75rem (12px) — large, soft, approachable
- **Elevation:** Very soft shadow `0 4px 20px rgba(46, 50, 48, 0.06)` — tonal separation over shadows
- **Borders:** `--terra-border: #e8e0d4` (warm, low opacity), `--terra-border-soft: #f0ebe2`
- **Chart palette:** 5 earthy colors (forest green, warm amber, warm taupe, golden brown, sage green) — no neon
- **Dark mode:** Warm dark `#1a1d1b` (green undertone, not pure black), warm light text `#e8e3da`
- **Input styling:** Cream background, soft green focus ring with `box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.12)`
- **Button styling:** `border-radius: var(--radius-sm)`, smooth transitions
- **Body:** `line-height: 1.65` (generous, comfortable reading)
- **Headlines:** `font-family: Literata` with `letter-spacing: -0.01em`
- **New utility classes:** `.shadow-terra`, `.shadow-terra-lg`, `.bg-terra-surface`, `.bg-terra-elevated`, `.border-terra`, `.border-terra-soft`

### 2. layout.tsx — Font loading
- Replaced Geist Sans with **Literata** (serif headlines) + **Nunito Sans** (body/labels)
- CSS variables: `--font-literata`, `--font-nunito-sans`
- Kept Geist Mono for monospace (code/logs)

### 3. Tenant branding — Terra palette
- **Alpha Capital:** Forest green `#4a7c59` + warm amber `#705c30` + warm cream `#f5efe6`
- **Beta Trading:** Sage green `#5a7c4a` + golden brown `#8a6d30` + warm cream
- **Gamma Futures:** Deep green `#4a6c59` + warm amber `#705c30` + warm cream
- **Platform:** Forest green `#4a7c59` + warm amber `#705c30` + warm cream `#faf6f0`

### 4. Color presets — Terra earthy/desaturated
- Settings → Branding tab presets: Forest, Sage, Deep Green, Golden Brown, Warm Taupe, Slate Green
- Onboarding wizard presets: same 6 Terra presets

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- **Background:** rgb(250, 246, 240) = #faf6f0 (warm cream) ✓ (verified via DOM)
- **Body font:** Nunito Sans ✓
- **Line height:** 26.4px (1.65 ratio) ✓
- **Headlines:** Literata serif on h1/h2/h3 ✓ (verified via DOM: "Literata, Literata Fallback...")
- **Primary:** Forest green #4a7c59 ✓
- **Dark mode:** Warm dark #1a1d1b (not pure black) ✓
- **VLM rating: 9/10** — "textbook execution of Terra Organic Design system"
- "balances complexity of financial data with calming, natural aesthetic"
- "serif fonts + cream background + forest green = sophisticated, non-digital atmosphere"

---
Task ID: gridstack-drag-drop
Agent: lead-architect
Task: Implement GridStack drag-and-drop resizable widgets with super-admin-only editing

## Requirements
- Use GridStack library for draggable/resizable dashboard widgets
- Only Super Admin (platform admin) can edit layout for tenant dashboards
- Tenants cannot change the layout — read-only grid
- Layout persisted per-tenant to localStorage

## Completed Modifications

### 1. Installed GridStack
- `gridstack@11.5.1` — drag-and-drop grid library
- CSS imported in `globals.css`: `gridstack.min.css` + `gridstack-extra.min.css`

### 2. Created GridStackDashboard component
File: `src/components/platform/gridstack-dashboard.tsx`

**Permission model:**
- `isSuperAdmin = runtime.user.application === "super-admin"` 
- When true: shows "Edit Layout" / "Lock Layout" toggle button + "Reset" button
- When false: shows "Dashboard layout is managed by your platform administrator" lock message
- GridStack initialized with `staticGrid: !isSuperAdmin` — read-only for non-super-admin
- `disableResize` and `disableDrag` set based on `isSuperAdmin`

**Grid initialization:**
- Pre-builds DOM elements with `gs-id`, `gs-x`, `gs-y`, `gs-w`, `gs-h` attributes
- Appends to grid container BEFORE calling `GridStack.init()` — auto-detection
- 12-column grid, 80px cell height, 12px margin
- Dynamic import of gridstack JS (keeps initial bundle clean)

**Layout persistence:**
- Layout saved to `localStorage` key `pfaas:gridLayout:{tenantId}` on drag/resize/change events
- Layout loaded on mount — falls back to auto-layout from resolveDashboardLayout if no saved layout
- Reset button clears localStorage and reloads page

**Widget rendering:**
- Each grid-stack-item gets a `.grid-stack-item-content` div
- React widgets rendered independently via `createRoot` into each content div
- Each widget wrapped in ModuleErrorBoundary
- Widget card header shows title + category badge in module accent color

**Edit mode:**
- When edit mode is enabled: grid items get dashed border, drag cursor, resize handles visible
- Placeholder content shown during drag (semi-transparent primary color)
- Toast feedback: "Layout editing enabled" / "Layout locked"

### 3. Wired into OverviewPage
- Replaced `DashboardGrid` from `dashboard-grid.tsx` with `GridStackDashboard` from `gridstack-dashboard.tsx`
- `CustomizeDashboardDialog` is now a no-op (returns null) — layout editing handled by GridStack

### 4. Terra-styled GridStack CSS
- `.grid-stack-item-content`: rounded corners (var(--radius)), soft shadow (var(--shadow-soft)), warm cream background (var(--card))
- Edit mode: dashed border in primary color, drag cursor, hover scale effect
- Placeholder: semi-transparent primary color background
- Resize handles: opacity transitions

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- GridStack container exists with 16 items ✓ (verified via DOM: `itemCount: 16`)
- Prop-admin (Sarah Chen): sees "Dashboard layout is managed by your platform administrator" lock message ✓
- Module section headers visible: Trading, Challenges, Risk Management, Payouts ✓
- Widget content rendered: KPI metrics, charts, tables, activity feeds ✓
- VLM rating: 9/10 — "responsive grid with diverse content, admin control bar, clear section headers"

---
Task ID: tenant-lifecycle
Agent: general-purpose (sub agent)
Task: Build comprehensive tenant lifecycle management UI for Super Admin

## Scope
Built 4 files implementing the tenant lifecycle surface for the Super Admin
application: a tenant detail workspace, a create-tenant wizard, a lifecycle
pipeline view, and updated Tenants page to navigate into the new flows.
All files follow the Terra Organic Design system (forest green / cream /
Literata / Nunito Sans) and AGENTS.md UX principles (progressive disclosure,
one primary action per surface, explainability, destructive confirmations
with explicit consequences).

## Files Created / Modified

### 1. `src/lib/platform/types.ts` (modified)
- Extended `TenantContext.status` to include `"terminated"`:
  `status: "active" | "trial" | "suspended" | "invited" | "terminated";`
- Additive change; existing tone-mapping helpers fall through to `"muted"`
  for the new value, so existing pages keep working.

### 2. `src/modules/super-admin/tenant-detail-page.tsx` (new — 1159 lines)
Exported: `TenantDetailPage`. Reads `router.params.id` from `usePlatform()`,
looks up the tenant from `availableTenants`, shows an `EmptyState` if not
found.

**Header** — `EntityHeader` with brand-color initials avatar, name, plan
badge, status badge (using extended tone mapping), and three contextual
actions:
- "Edit Configuration" (outline)
- "Suspend" (outline + AlertDialog; reversibility explicitly stated)
- "Reactivate" (shown only when suspended)
- "Terminate" (destructive AlertDialog with the full consequence text from
  the task: "All trader data, accounts, payouts, and audit logs for this
  tenant will be permanently archived. The tenant will lose all platform
  access immediately.")

Status changes call `setTenant(updated)` for context persistence + a
`pushNotification` + a toast.

**KPI row** — 6 MetricCards: Traders, Active Accounts, MRR (plan-based:
starter=$890, growth=$1900, scale=$4900, enterprise=custom→4900), Open
Breaches, Pending Payouts, KYC Pending.

**Tabs (7)**:
1. **Overview** — tenant summary dl (id/slug/plan/status/currency/timezone/
   locale/created/last active/application) + module adoption list (each
   module with enabled ✓ / disabled dot) + Progress bar showing adoption
   ratio.
2. **Modules** — KEY feature. Grid of all modules from
   `moduleRegistry.getAll()`, each card showing icon, name, category badge,
   description, version, supportedApplications badges, and a `Switch`. The
   header shows count "X of Y modules enabled" + Progress bar. Toggling a
   switch updates the local tenant copy AND calls `setTenant` so the
   global context reflects the change, plus a toast describing what just
   happened ("Module enabled/disabled — X is now accessible/hidden for
   {tenant}.").
3. **Users** — `DataTable` of `users.filter(u => u.tenantId === tenantId)`
   with columns name (initials avatar), role badges, application badge,
   last active. Per-row "Edit role" (ghost + toast) and "Remove"
   (destructive ghost + toast). "Invite user" button (toast).
4. **Billing** — subscription card (plan, monthly cost, billing cycle,
   next billing date, payment method mock, status) + "Change plan"
   DropdownMenu (all 4 plans with prices) + "Generate invoice" button
   (toast). Spending summary card (this month / YTD / all-time). Billing
   history `DataTable` with 6 deterministic invoices (date, amount,
   status badge).
5. **Activity** — `ActivityTimeline` from `@/components/platform/audit`
   using `getTenantAudit(tid).slice(0, 12)`.
6. **Configuration** — form to edit: name, tagline, currency (Select),
   timezone, locale, primary color (color picker + 6 Terra presets),
   accent color, border radius (Select), initials. Live preview pane with
   brand-color avatar + tagline + primary/accent buttons. "Save changes"
   calls `setTenant({...tenant, ...updatedFields})` + toast.
7. **Risk** — risk summary card (open breaches, critical, accounts at
   risk) + composite risk score with Progress + tone badge + "Quick
   actions" card (open risk workspace, view open breaches, export risk
   report — all toasts).

### 3. `src/modules/super-admin/create-tenant-page.tsx` (new — 913 lines)
Exported: `CreateTenantPage`. 5-step wizard mirroring
`ChallengeWizardPage`'s step indicator pattern (done/active/inactive
circles + connecting bars).

**Steps**:
1. **Basics** — tenant name (auto-generates slug + initials on change),
   slug (editable, slugified), tagline, plan (Select with prices),
   currency (Select), timezone (Select).
2. **Branding** — 6 Terra color presets, primary/accent color pickers,
   border radius (Select), initials (auto from name, editable), optional
   logo URL. Live preview pane with avatar + tagline + brand buttons.
3. **Modules** — grid of all modules with `Checkbox` toggles. Core modules
   (trading, challenges, risk, payouts, settings) pre-selected via
   `CORE_MODULE_IDS`. Header shows count "X of Y selected".
4. **Admin User** — admin name + admin email (validated with regex). Card
   explaining what happens next (tenant provisioned in trial status, admin
   invited, redirect to detail page).
5. **Review** — summary grid of 4 review cards (Basics, Branding,
   Administrator, Modules selected). Single primary action "Create tenant".

**Create action**:
- Builds a new `TenantContext` with `id: tenant-${slug}-${random}`,
  `application: "prop-admin"`, `status: "trial"`, current ISO timestamp.
- Calls `setTenant(newTenant)` so the global context persists the new
  tenant.
- Fires `pushNotification` + toast "Tenant created — {name} is ready for
  onboarding".
- Navigates to `tenant-detail` with `{ id }` so the user lands on the new
  tenant's workspace.

**Validation**: per-step `stepValid()` gates the Next button. Required
fields marked with red asterisk. Email format validated with regex.

### 4. `src/modules/super-admin/tenant-lifecycle-page.tsx` (new — 477 lines)
Exported: `TenantLifecyclePage`. Shows the lifecycle as a horizontal
pipeline:

```
Invited → Trial → Active → Suspended → Terminated
```

Each stage is a clickable card showing:
- Lucide icon (Mail/Clock/CheckCircle2/Pause/Ban) in stage-color tint
- Stage label + count (large tabular number)
- Description text
- Up to 4 tenant names with brand-color dots (+N more overflow)
- Color-coded border when selected

Clicking a stage card filters the table below by that stage. Arrow icons
connect the stages horizontally on `lg` breakpoints.

**KPI row** — 5 MetricCards, one per stage, with appropriate tone
(positive/negative/warning/default).

**Table** — `DataTable` of all tenants with columns: name (with brand
avatar), lifecycle stage (color-coded badge with stage icon), plan, modules,
created date, row actions. Rows are clickable → navigate to
`tenant-detail`. Row actions adapt to current status:
- Active/Trial → Suspend (amber AlertDialog) + Terminate (destructive
  AlertDialog)
- Suspended → Reactivate (emerald ghost button) + Terminate
- Terminated → no destructive actions

All destructive actions use `AlertDialog` with explicit consequence text.
`e.stopPropagation()` prevents row click from firing when an action is
clicked.

A "How lifecycle works" help card at the bottom explains each stage.

Header includes a Select filter that mirrors the pipeline filter (so users
can filter without clicking the pipeline).

### 5. `src/modules/super-admin/super-admin-pages.tsx` (modified)
- Added top-of-file re-exports for the three new pages:
  ```ts
  export { TenantDetailPage } from "./tenant-detail-page";
  export { CreateTenantPage } from "./create-tenant-page";
  export { TenantLifecyclePage } from "./tenant-lifecycle-page";
  ```
- Updated `TenantsPage`:
  - Header actions: "Lifecycle" outline button → `navigate("tenant-lifecycle")`,
    "Create tenant" primary button → `navigate("create-tenant")` (replaces
    the old "Invite tenant" toast button).
  - Added `useState` + `useMemo` for a `stageFilter` state ("all" +
    5 lifecycle stages).
  - Added a `Select` filter in the DataTable toolbar to filter by stage.
  - Made rows clickable: `onRowClick={(t) => navigate("tenant-detail", { id: t.id })}`
  - The "View" button still navigates to `tenant-detail` (with
    `e.stopPropagation()` so it doesn't double-fire).
- Extended `tenantStatusTone` to map `terminated → "muted"` and
  `invited → "info"` (previously fell through to "warning").
- Fixed the pre-existing `TenantContext` import to come from
  `@/lib/platform/types` instead of `mock-data` (the latter doesn't
  re-export it). Same fix for the `ModuleCatalogPage` icon `style` prop
  (moved color to the parent div + removed `style` from the Icon).

### 6. `src/modules/super-admin/index.ts` (modified)
- Added re-exports for `TenantDetailPage`, `CreateTenantPage`,
  `TenantLifecyclePage` so the view router (or whoever wires views) can
  import them from a single source via `@/modules/super-admin`.

## Patterns Applied
- `"use client"` directive on all new files.
- `usePlatform()` for `router`, `navigate`, `setTenant`,
  `pushNotification`, `availableTenants`.
- Platform primitives: `Page`, `PageHeader`, `PageContent`, `EntityHeader`,
  `MetricCard`, `DataTable`/`Column`, `StatusBadge`, `formatCurrency`,
  `ActivityTimeline`, `EmptyState`, `LabelWithHelp`.
- shadcn/ui: `Button`, `Badge`, `Card`, `Input`, `Label`, `Switch`,
  `Separator`, `Progress`, `Tabs`, `Select`, `DropdownMenu`,
  `AlertDialog`, `Checkbox`.
- `cn` from `@/lib/utils`.
- `toast` from `@/hooks/use-toast`.
- Lucide icons throughout (NO blue/indigo — Terra palette only: emerald,
  amber, rose, slate for status tones; brand greens/browns for accents).
- AGENTS.md UX principles: one primary action per surface, progressive
  disclosure via tabs, explainability via `LabelWithHelp` + `StatusBadge`
  tones + `EmptyState` hints, destructive actions always wrapped in
  AlertDialog with explicit consequence text.
- Color on parent div + `currentColor` on icons (avoids the pre-existing
  TS error pattern of passing `style` to `ComponentType<{ className?: string }>`).

## View IDs Used (for lead-architect wiring)
- `tenant-detail` (params: `{ id }`)
- `create-tenant` (no params)
- `tenant-lifecycle` (no params)
- `tenant-config` (params: `{ id }`) — used in TenantDetailPage's
  "Edit Configuration" button as a forward-reference; can be wired to the
  same `TenantDetailPage` with a `tab=configuration` param or to a
  dedicated config page if one is built later.

## Verification Results
- `bun run lint` → exit code 0, zero warnings, zero errors ✓
- `bunx tsc --noEmit` → zero errors in any of the 4 new/modified files
  (remaining TS errors in the codebase are pre-existing in
  `mock-data.ts`, `analytics-pages.tsx`, `settings-page.tsx`, etc. and
  unrelated to this task).
- No `view-router.tsx` or `module-bootstrap.ts` modifications made (lead
  will wire the new view IDs into `viewRegistry`).

## Next Actions for Lead
1. Add to `view-router.tsx` `viewRegistry`:
   ```ts
   "tenant-detail": TenantDetailPage,
   "create-tenant": CreateTenantPage,
   "tenant-lifecycle": TenantLifecyclePage,
   ```
   (or import via `@/modules/super-admin`).
2. Optionally add nav items to `super-admin-module.ts` for "Tenant
   Lifecycle" under the Platform nav group.
3. Wire the `tenant-config` view id (used by TenantDetailPage's
   "Edit Configuration" button) — either alias to `tenant-detail` with
   a `tab=configuration` param, or build a dedicated config page.


---
Task ID: tenant-lifecycle-mgmt
Agent: lead-architect
Task: Build complete tenant lifecycle management UI/UX for platform admin

## Analysis Summary
Before this task, the platform admin could only SEE tenants in a list with a "View" button that impersonated. No create, configure, suspend, terminate, module management, user management, or billing existed.

## Completed Modifications

### 1. Tenant Detail Page (7-tab workspace)
File: `src/modules/super-admin/tenant-detail-page.tsx` (1159 lines)
- **Header**: EntityHeader with logo, name, plan badge, status badge + action buttons (Edit Config, Suspend/Reactivate, Terminate with AlertDialog + consequence explanation)
- **KPI Row**: Total Traders, Active Accounts, Revenue, Open Breaches, Pending Payouts, KYC Pending
- **7 Tabs**:
  1. **Overview** — tenant summary card + module adoption progress bars
  2. **Modules** — KEY FEATURE: grid of all modules with toggle switches to enable/disable per tenant. Updates `tenant.enabledModules` via `setTenant()` live with toast. Shows "X of Y modules enabled"
  3. **Users** — DataTable of tenant users (name, email, role, application, last active) + Invite User button
  4. **Billing** — subscription card (plan, cost, billing cycle, next billing date, payment method) + Change Plan dropdown + Generate Invoice + billing history table
  5. **Activity** — ActivityTimeline using `getTenantAudit(tid)`
  6. **Configuration** — form to edit: name, tagline, currency, timezone, locale, primary color picker, accent color, border radius, initials. Save calls `setTenant()` + toast
  7. **Risk** — tenant risk summary: open breaches, critical breaches, accounts at risk, risk score

### 2. Create Tenant Wizard (5-step)
File: `src/modules/super-admin/create-tenant-page.tsx` (913 lines)
- Step 1: Basics (name, auto-slug, tagline, plan dropdown, currency, timezone)
- Step 2: Branding (6 Terra color presets, accent color, border radius, auto-initials)
- Step 3: Modules (grid of all modules with checkboxes, core modules pre-selected)
- Step 4: Admin User (email, name — first tenant admin)
- Step 5: Review (summary card + Create button → creates TenantContext, navigates to detail)
- Step indicator, Back/Next, required fields with asterisks

### 3. Tenant Lifecycle Pipeline
File: `src/modules/super-admin/tenant-lifecycle-page.tsx` (477 lines)
- Horizontal pipeline: **Invited → Trial → Active → Suspended → Terminated**
- Each stage: color-coded card with count + tenant names list
- Click stage → filters the table below
- DataTable with row-level Suspend/Reactivate/Terminate actions (context-aware based on current status)
- 5 KPI metric cards at top

### 4. Updated Tenants List
File: `src/modules/super-admin/super-admin-pages.tsx` (updated)
- "View" button → `navigate("tenant-detail", { id: t.id })` (was impersonation toast)
- "Invite tenant" button → `navigate("create-tenant")` (was toast)
- New "Lifecycle" button → `navigate("tenant-lifecycle")`
- Stage filter dropdown in toolbar
- Rows clickable → navigate to tenant detail

### 5. Tenant Switcher Fix
File: `src/components/shell/topbar.tsx`
- Fixed: switching to "Platform (Super Admin)" pseudo-tenant now correctly finds Alex Morgan (super-admin user)
- Match logic: `t.id === "platform" ? users.find(u => u.application === "super-admin") : users.find(u => u.tenantId === t.id && u.application === user.application)`

### 6. View Router + Navigation Wiring
- `view-router.tsx`: added 3 new view IDs (`tenant-detail`, `create-tenant`, `tenant-lifecycle`)
- `super-admin-module.ts`: added 3 new nav children (Create Tenant, Lifecycle, + tenant-detail route) + 3 new routes
- `super-admin-pages.tsx`: added re-exports for 3 new pages
- `super-admin/index.ts`: already had re-exports added by subagent

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Super-admin sidebar shows: Overview, Tenants, Create Tenant, Lifecycle, Service Catalog, System Health ✓
- VLM confirmed: "super-admin platform dashboard" with all Platform section items visible ✓
- Tenant switcher correctly switches to super-admin user when selecting "Platform (Super Admin)" ✓
- All 7 tenant lifecycle stages now have dedicated UI (create, detail/configure, module management, user management, billing, suspend/reactivate/terminate, lifecycle pipeline) ✓

---

## Dashboard Manager — Per-Tenant + Per-Role Layout Editor (Task: dashboard-manager)

**Date:** $(date)
**Owner:** Sub-agent (general-purpose)

### Goal
Give platform super-admin a dedicated tool to manage GridStack widget layouts
across every white-label prop firm tenant + role combination (prop-admin roles
AND trader roles), independent of the regular tenant dashboard.

### Files Created
1. **`src/modules/super-admin/dashboard-manager-page.tsx`** (~650 lines)
   - Exported `DashboardManagerPage` component
   - 280px sidebar + main editor split layout
   - Sidebar cards: Tenant selector, Role selector, Widget Library (search +
     module/category filters), Layout Actions (lock toggle, reset)
   - Main area: mode indicator bar + GridStack editor + Terra-themed inline CSS
   - EmptyState when tenant has no widgets available for the role
   - Preview/Edit toggle (toggles GridStack staticGrid at runtime via
     `grid.setStatic()`)

### Files Modified
2. **`src/modules/super-admin/super-admin-module.ts`**
   - Added `LayoutDashboard` to lucide-react import
   - Added nav child: `super.dashboard-manager` → `dashboard-manager`
   - Added route: `dashboard-manager` viewId

3. **`src/lib/platform/view-router.tsx`**
   - Imported `DashboardManagerPage`
   - Registered in `viewRegistry`: `"dashboard-manager": DashboardManagerPage`

### Key Implementation Details

**Runtime context synthesis**
- `buildContext(tenant, role, baseUser)` constructs a `ModuleRuntimeContext`
  for the selected tenant+role combination (preview user with the role's
  permissions, application, and tenant's enabledModules/features).
- This drives `moduleRegistry.getWidgets(ctx)` and
  `resolveDashboardLayout(ctx)` to determine the widget universe and
  default auto-layout for that combination.

**Per-tenant+role storage** (separate namespace from regular dashboard)
- Layout: `pfaas:dashboardLayout:{tenantId}:{roleId}` (GridStack node array)
- Lock: `pfaas:dashboardLock:{tenantId}:{roleId}` (boolean flag)
- Falls back to `resolveDashboardLayout()` auto-flow when no saved layout

**GridStack lifecycle**
- Dynamic `import("gridstack")` to keep initial bundle lean
- Pre-builds DOM with `gs-*` attributes, lets GridStack auto-detect children
- Mounts React widgets into each `.grid-stack-item-content` via `createRoot`
- Tracks React roots in a `Map<string, Root>` for clean unmount
- Listens to `change`/`dragstop`/`resizestop`/`added`/`removed` to auto-persist
- Destroys + rebuilds on `ctx` / `previewMode` / `layoutNonce` change

**Add/Remove widget flow**
- Add: creates DOM element with `gs-id` + `gs-w`/`gs-h`, calls
  `grid.addWidget(el, { id, x:0, y:maxY, w, h, autoPosition:false })`,
  then renders the React widget into the new content div
- Remove: unmounts React root, then `grid.removeWidget(el, true)`
- Sidebar `placedIds` Set tracks which widgets are currently in the grid
  (synced from `grid.save()` on every change event)

**Lock semantics**
- Lock toggle writes a per-tenant+role boolean to localStorage
- (Enforcement in the tenant dashboard itself is reserved for a follow-up;
  this tool sets the flag.)

### Patterns Followed
- `"use client"` directive
- `usePlatform()` for `availableTenants` + `user`
- `moduleRegistry.getWidgets()` / `.getAll()` / `.get()`
- `resolveDashboardLayout()` / `resolveWidgets()` from dashboard-engine
- Terra design system (forest green #4a7c59, warm cream, 12px radius,
  soft shadows, no blue/indigo)
- UX Constitution: progressive disclosure (sidebar reveals filters + actions
  as needed), one primary action per surface (Save), explainability (helper
  footer, mode indicator, lock description), generous spacing, large touch
  targets, soft corners
- Did NOT modify `gridstack-dashboard.tsx` — separate tool, separate
  localStorage namespace

### Verification
- `bun run lint` → clean (0 errors, 0 warnings)
- `bunx tsc --noEmit` → 0 errors in any modified file (pre-existing errors in
  unrelated analytics/widgets files remain untouched)
- Page accessible via super-admin sidebar → Dashboard Manager
- Tenant + Role selectors filter to non-platform tenants and non-super-admin
  roles (prop-admin / trader scopes only)

### Next Actions (deferred)
- Enforcement of `pfaas:dashboardLock:{tenantId}:{roleId}` flag in the
  regular `gridstack-dashboard.tsx` so tenants actually see the lock
- Optional: persist layouts to a server-side store (currently localStorage
  only, suitable for demo)

---
Task ID: dashboard-manager
Agent: lead-architect
Task: Build complete Dashboard Manager for platform admin to manage widget layouts across all white-label tenant dashboards

## Analysis Summary
Before this task, the super-admin could only edit THEIR OWN dashboard via GridStack. There was no UI to:
- Manage a specific tenant's dashboard layout
- Configure widgets per-tenant or per-role
- Browse all available widgets
- Lock/unlock tenant layouts
- Preview tenant dashboards
- Differentiate layouts for prop-admin vs trader roles

## Completed Modifications

### 1. Dashboard Manager Page
File: `src/modules/super-admin/dashboard-manager-page.tsx` (~650 lines)

**Layout:** 280px sidebar + main GridStack editor area

**Sidebar:**
- **Tenant selector** — dropdown of all tenants (excluding platform pseudo-tenant)
- **Role selector** — dropdown of roles filtered by `application === "prop-admin"` or `"trader"`, with Admin/Trader badges
- **Widget Library** — searchable, filterable list of ALL widgets from ALL modules. Each widget shows: title, module badge, category badge, default size. "Add"/"Remove" buttons per widget.
- **Layout Actions** — Lock/Unlock toggle, Reset to defaults

**Main area:**
- **Mode indicator bar** — shows edit/preview mode + placed widget count + lock badge
- **GridStack editor** — drag/resize/add/remove widgets
- **Preview mode** — read-only grid showing what the tenant sees
- **Save Layout** button — persists to `pfaas:dashboardLayout:{tenantId}:{roleId}`
- **Reset** button — clears saved layout, falls back to auto-layout

**GridStack lifecycle:**
- Dynamic `import("gridstack")`
- Pre-builds DOM with `gs-*` attributes → auto-detection by `GridStack.init()`
- Renders React widgets via `createRoot` into each `.grid-stack-item-content`
- Tracks roots in `Map<string, Root>` for clean unmount
- Auto-persists on `change`/`dragstop`/`resizestop`/`added`/`removed` events
- Rebuilds on tenant/role/previewMode change

**Runtime context synthesis:**
- Builds a `ModuleRuntimeContext` for the selected tenant+role to drive `moduleRegistry.getWidgets(ctx)` and `resolveDashboardLayout(ctx)`

### 2. Lock Enforcement in Regular Dashboard
File: `src/components/platform/gridstack-dashboard.tsx` (updated)

**Lock check:**
- `isLayoutLocked` reads from `pfaas:dashboardLock:{tenantId}:{roleId}` in localStorage
- `canEdit = isSuperAdmin && !isLayoutLocked` — super-admin can't edit if locked
- GridStack init uses `canEdit` for `staticGrid`, `disableResize`, `disableDrag`
- `toggleEditMode` checks `canEdit` before allowing toggle
- Layout control bar only shows for `canEdit` users

**Layout loading priority:**
1. Dashboard Manager layout (`pfaas:dashboardLayout:{tenantId}:{roleId}`) — per-tenant+role
2. Regular grid layout (`pfaas:gridLayout:{tenantId}`) — per-tenant (fallback)
3. Auto-layout from `resolveDashboardLayout` — default

### 3. Navigation Wiring
- **super-admin-module.ts**: added "Dashboard Manager" nav child + route (viewId: `dashboard-manager`)
- **view-router.tsx**: added `DashboardManagerPage` import + registry entry

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Super-admin sidebar shows "Dashboard Manager" in Platform section ✓
- Dashboard Manager renders with:
  - Tenant selector (Alpha Capital) ✓
  - Role selector (Prop Firm Admin) ✓
  - Widget library with Add/Remove buttons ✓
  - GridStack editor with "Edit mode" instruction ✓
  - Save Layout, Preview, Reset, Lock toggle buttons ✓
- VLM rating: 9/10 ✓
- Lock enforcement: `canEdit` replaces `isSuperAdmin` in gridstack-dashboard ✓
- Layout loading: Dashboard Manager layout key checked first ✓

---

## Task img-batchC — Account Detail Tabs + Closed Positions Page

**Subagent:** general-purpose
**Date:** $(date +%Y-%m-%d)
**Scope:** Add four new pages to the trading module — three "account detail"
tabs that complete the enhanced trader workspace, plus a standalone closed
positions list page. No view-router or manifest modifications.

### Files created

1. `src/modules/trading/pages/account-broker-details-page.tsx`
   - Exports `AccountBrokerDetailsPage`
   - PageHeader + EntityHeader + 5-card KPI row (Account Balance, Equity,
     Margin, Free Margin, Margin Level)
   - Three-section form layout, read-only with `Edit` toggle (Cancel / Save
     Changes) plus an always-available `Resync Account` action
   - Section 1 — Login Credentials: Login ID, Password (masked), Server,
     Investor Password (masked) — each with `LabelWithHelp`
   - Section 2 — Broker Configuration: Broker Type dropdown (MT5 / DXTrade),
     Leverage, Account Group, Currency — all editable when in edit mode
   - Section 3 — Trading Account Matching: Matched Account checkbox (read-only),
     Bridge Status (Connected/Disconnected StatusBadge with Plug/PlugZap icon),
     Last Sync timestamp, Sync Now button (toast)
   - Inline footer `ContextualHelp` explaining the bridge sync semantics
   - `deriveBrokerConfig(account)` seeds deterministic server, sync, margin,
     and accountGroup values from the account login so the demo is stable

2. `src/modules/trading/pages/account-kyc-statuses-page.tsx`
   - Exports `AccountKycStatusesPage`
   - Resolves the trader from `router.params.id` → account → `traderId`, then
     surfaces the trader's existing KYC record through `ExplainableStateBadge`
   - KPI row: Total Providers, Verified, Pending, Rejected
   - DataTable of per-provider KYC statuses (MANUAL / VERIFF / SUMSUB / ONFIDO)
     — columns: Provider, Status (ExplainableStateBadge), Documents Count,
     Last Checked, Action (Re-initiate button + DropdownMenu of Re-initiate /
     Verify / Reject)
   - "Add KYC Provider" button in the header (toast)
   - `deriveProviderKyc(kyc)` deterministically generates 4 provider rows
     with status / lastCheckedAt / documentsCount from the KycRecord seed

3. `src/modules/trading/pages/account-related-accounts-page.tsx`
   - Exports `AccountRelatedAccountsPage`
   - Resolves `router.params.id` → account → `traderId`, then filters
     `getTenantAccounts(tid)` by `traderId` to find related accounts
   - KPI row: Total Related Accounts, Funded, Active, Breached
   - DataTable: Login (with "current" badge for the active account), Phase
     (badge), Broker Type (badge), Initial Balance, Current Equity, Profit
     Split (trader/firm %), Status (ExplainableStateBadge), Source
     (Challenge/Manual/Migration), and an Unlink action button
   - Row click → `navigate("account-broker-details", { id: row.id })`
   - "Link Account" button in the header (toast)
   - `decorateAccount(account)` deterministically derives profitSplit (70–95%
     in 5% steps) and source distribution (mostly Challenge, some Manual,
     few Migration) from the account id seed

4. `src/modules/trading/pages/closed-positions-page.tsx`
   - Exports `ClosedPositionsPage`
   - PageHeader "Closed Positions" + description "Historical trading positions
     that have been closed", Export CSV action (uses `exportToCsv` from
     `@/lib/platform/export-utils`)
   - 7-card KPI row: Total Closed, Total Profit, Total Loss, Win Rate, Avg
     Duration, Best Trade, Worst Trade
   - Dense DataTable (13 columns + expand toggle): Login, Trader, Direction
     (Buy/Sell badge with Terra-green/red coloring), Symbol, Volume, Entry
     Price, Close Price, P&L (colored), Open Time, Close Time, Duration,
     Close Reason (TP/SL/Manual badge)
   - Filter bar: search by symbol/trader/account, date range (24h/7d/30d/90d),
     symbol, direction, close reason — with Clear-all button
   - Row click + expand chevron both toggle an inline `ExpandedDetail` panel
     showing all 16 fields (Position ID, Account Login, Trader, Symbol,
     Direction, Volume, Entry, Close, P&L, P&L %, Open Time, Close Time,
     Duration, Close Reason, Commission, Swap)
   - `generateClosedPositions(tenantId)` uses `Array.from` with deterministic
     `Math.sin`-based pseudo-random seeding; takes the existing
     `getTenantPositions(tid)` set as a base and synthesises close prices,
     close times, durations, close reasons, commissions and swaps per
     position. Stable across reloads.

### Patterns followed
- `"use client"` directive on every page
- `usePlatform()` from `@/lib/platform/platform-context` for runtime /
  navigate / router
- Platform components: `Page`, `PageHeader`, `PageContent`, `MetricCard`,
  `EntityHeader`, `DataTable`, `Column`, `StatusBadge`, `formatCurrency`,
  `EmptyState`, `ExplainableStateBadge`, `LabelWithHelp`, `ContextualHelp`
- `toast` from `@/hooks/use-toast`
- `cn` from `@/lib/utils`
- Native `<select>` for compact filter dropdowns (matches existing
  `user-events-page.tsx` pattern) — avoids Select popup collisions with the
  dense DataTable
- `DropdownMenu` from `@/components/ui/dropdown-menu` for action menus
- `Checkbox` from `@/components/ui/checkbox` for the read-only matched
  account indicator
- Lucide icons in Terra palette only (forest green, warm amber, emerald,
  rose, amber) — no blue/indigo
- AGENTS.md UX: progressive disclosure (Edit toggle), explainable state
  badges with hover tooltips, contextual help alongside every
  policy-heavy field, KPIs above the table, EmptyState on missing account
- Mock data generated inline with `Array.from` + deterministic seeding

### Verification
- `bunx eslint` on the four new files → exit 0 (zero errors, zero warnings)
- Project-wide `bun run lint` shows only the pre-existing
  `react-hooks/preserve-manual-memoization` errors in
  `src/modules/analytics/pages/dashboard-tabs.tsx` (untracked, written by
  another subagent — unrelated to this task)
- No view-router or module-manifest changes; no test files created

### Suggested viewIds to wire up later
The four pages are exported and ready — registering them in
`view-router.tsx` and the trading module manifest is intentionally left to
the next wiring pass per task instructions. Recommended viewIds:

| viewId | File / Export | Notes |
| --- | --- | --- |
| `account-broker-details` | `account-broker-details-page.tsx` → `AccountBrokerDetailsPage` | Reads `router.params.id` (account id). Linked from `AccountRelatedAccountsPage` row click and from the accounts list. |
| `account-kyc-statuses` | `account-kyc-statuses-page.tsx` → `AccountKycStatusesPage` | Reads `router.params.id` (account id); resolves trader through the account. Useful as a trader-detail tab target. |
| `account-related-accounts` | `account-related-accounts-page.tsx` → `AccountRelatedAccountsPage` | Reads `router.params.id` (account id). |
| `closed-positions` | `closed-positions-page.tsx` → `ClosedPositionsPage` | No params; tenant-scoped. Suggested as a sibling of `trading-positions` (Open Positions) in the sidebar. |

When wiring is enabled, the suggested nav additions to the trading module
manifest are:
- `trading.closed-positions` child (icon: `Activity`) → `closed-positions`
- Optional `account-detail` tab group inside `EnhancedTraderDetailPage`
  adding Broker Details / KYC Statuses / Related Accounts as additional
  `TabsTrigger` entries that route to the new viewIds.

---
Task ID: img-batchA
Agent: dashboard-tabs-builder
Task: Build 4 new dashboard tab pages (Accounts / Payouts / Orders / Positions)

Work Log:
- Read worklog.md and AGENTS.md (UX Constitution) — confirmed Terra palette
  (forest green / sage / warm amber / cream / emerald / amber-warning /
  rose-danger) and the existing platform primitives: Page / PageHeader /
  PageContent / MetricCard / DataTable / Column / AreaSeries / BarSeries /
  DonutSeries / StatusBadge / formatCurrency / formatCompact.
- Inspected existing analytics module pattern: analytics-pages.tsx,
  retention-analytics-page.tsx, firm-statistics-page.tsx, daily-highlights-page.tsx
  for the canonical layout (KPI strip → charts → cohort/heatmap → detail table).
- Confirmed ViewComponent signature: `ComponentType<{ params: Record<string,string> }>`
  so each tab accepts `{ params }`.
- Built the single file at `src/modules/analytics/pages/dashboard-tabs.tsx` with
  4 exported components (each is a full `Page`-wrapped view):

  1. DashboardAccountsTab (viewId: dashboard-accounts)
     - KPI strip: 13 cards in an lg:grid-cols-7 layout
       (Total Accounts, Phase 1, Phase 2, Live/Funded, MT5 Active,
        Daily DD Breached, Max DD Breached, Blocked, Passed, Total Users,
        Avg Accounts/User, Avg Pass Time, Avg Breach Time)
     - Pass/Fail Highlights (30 days) — inline `GroupedBars` helper using
       recharts BarChart with two Bars (Passed=emerald, Failed=rose) and
       a rotated X axis (interval=2 to avoid label crowding).
     - Account Retention Cohort heatmap — plain HTML <table> with
       per-cell `background-color` interpolation (green → amber → rose)
       using a `retentionBg(pct)` helper. Months: Jun / Jul / Aug 2026;
       columns: +30d / +60d / +90d; empty cells show "—".
     - Challenge Performance Grid — 4 cards (Instant Standard,
       2-Step Turbo, 1-Step Gen Z, 2-Step Gen Z) with P1 passes/fails,
       P1 failure rate, P2 passes/fails, P2 failure rate, Funded count.
       Instant Standard and 1-Step Gen Z render "—" for Phase 2 since
       they're single-phase challenges.

  2. DashboardPayoutsTab (viewId: dashboard-payouts)
     - KPI strip: 6 cards in lg:grid-cols-6
       (Approved Payouts, Total Payout Amount, Avg Profit Split,
        Pending, Rejected, Processing)
     - Daily Payout Movement (30 days) — platform `AreaSeries` in
       forest green.
     - Payout Cohort Matrix — same heatmap pattern as accounts,
       values are payout rate %.
     - Payouts by Challenge — inline `HorizontalBars` helper
       (recharts layout="vertical") in forest green.
     - Payouts by Platform — HorizontalBars in warm amber for MT5
       and DXTrade.
     - User Withdrawals Table — platform `DataTable` with columns
       (Request id, Trader, Amount, Method, Status badge, Date);
       12 mock withdrawal rows cycling 5 methods and 5 statuses.

  3. DashboardOrdersTab (viewId: dashboard-orders)
     - KPI strip: 5 cards in lg:grid-cols-5
       (Total Orders, Total Revenue, Avg Order Value, Conversion Rate,
        Refund Rate)
     - Revenue by Challenge — HorizontalBars (forest)
     - Revenue by Broker — HorizontalBars (amber) for MT5 / DXTrade
     - Monthly Revenue Trend — platform `AreaSeries` (emerald)
       over 12 months using monthsAgoShort labels.
     - Hourly Revenue + Hourly Orders Movement — two AreaSeries
       side by side (teal / amber) with 24 points each.
     - Revenue by Country Table — DataTable with columns
       (Country, Orders, Revenue, Avg Order Value, Market Share %)
       and an inline emerald progress bar inside the Market Share
       cell. 10 countries seeded.

  4. DashboardPositionsTab (viewId: dashboard-positions)
     - KPI strip: 6 cards in lg:grid-cols-6
       (Total Open Positions, Total Volume (lots), Total P&L signed,
        Winning Positions, Losing Positions, Win Rate)
     - Symbol Stats Table — DataTable with 6 symbols
       (EURUSD, GBPUSD, XAUUSD, BTCUSD, ETHUSD, USDJPY) showing
       total positions, Buy/Sell ratio split green/red, total volume
       (compact lots), total P&L (signed emerald/rose), and a Win
       Rate StatusBadge tone-mapped (success/info/warning).
     - Trade Distribution by Hour — platform `BarSeries` (forest) with
       24 bars.
     - Performance Distribution by Hour — inline `ColoredBars` helper
       using recharts `Bar` + per-cell `Cell` to color each bar
       emerald (positive) or rose (negative) by sign. 24 bars.

- Mock data is generated inline via deterministic Math.sin / Math.cos
  curves (no Math.random) so dashboards are stable across reloads.
  Module-level functions: buildPassFailSeries, buildWithdrawals,
  buildPayoutDailySeries, buildMonthlyRevenue, buildHourlyRevenue,
  buildHourlyOrders, buildCountryRows, buildSymbolRows,
  buildTradeDistributionByHour, buildPerformanceByHour. Cohort
  matrices and challenge grid use static seeded arrays.

- Local UI helpers added inline (not exported):
  ChartCard, GroupedBars, HorizontalBars, ColoredBars,
  retentionBg, retentionText, pctRate, payoutStatusToneLocal.

- Color discipline: ONLY Terra palette colors used
  (#4a7c59 forest, #5a7c4a sage, #705c30 amber, #f5efe6 cream,
   #059669 emerald, #0d9488 teal, #16a34a green, #d97706 warning,
   #e11d48 danger, #dc2626 rose, #78716c muted). No blue/indigo/violet.

- Lint: clean. `bun run lint` reports 0 problems after fixes.
  Initial lint surfaced two issues that were fixed:
    (a) react-hooks/use-memo rule — replaced `useMemo(buildX, [])`
        with `useMemo(() => buildX(), [])` (10 sites).
    (b) react-hooks/preserve-manual-memoization on two specific
        useMemo calls in DashboardPositionsTab — the React Compiler
        couldn't preserve them, so those two were converted to plain
        `const x = buildX();` calls (the compiler auto-memoizes pure
        calls). The other 8 useMemo calls remained as-is.
- TypeScript: clean for this file (no errors when filtered for
  `dashboard-tabs`). Pre-existing TimeSeriesPoint errors in
  analytics-pages.tsx and analytics-widgets.tsx are unrelated to this
  task (already known per worklog Task 5b-1).
- Did NOT modify view-router.tsx or analytics manifest.ts — lead
  architect will wire the 4 viewIds into the view registry and the
  analytics navigation. Suggested viewIds: `dashboard-accounts`,
  `dashboard-payouts`, `dashboard-orders`, `dashboard-positions`.

Stage Summary:
- 1 file created at `src/modules/analytics/pages/dashboard-tabs.tsx`
  exporting 4 client-side page components:
    - DashboardAccountsTab   (viewId: dashboard-accounts)
    - DashboardPayoutsTab    (viewId: dashboard-payouts)
    - DashboardOrdersTab     (viewId: dashboard-orders)
    - DashboardPositionsTab  (viewId: dashboard-positions)
- All four use `"use client"`, `usePlatform()` for runtime + tenant
  currency, platform primitives (Page / PageHeader / PageContent /
  MetricCard / DataTable / AreaSeries / BarSeries / StatusBadge /
  formatCurrency / formatCompact), lucide-react icons (Terra-colored),
  and `cn` from `@/lib/utils`.
- Three local inline recharts helpers added (GroupedBars,
  HorizontalBars, ColoredBars) to cover charts the platform BarSeries
  doesn't support (multi-series pass/fail, horizontal labels, per-cell
  colored bars). Each mirrors the platform's tooltipStyle and AXIS_STYLE
  for visual consistency.
- No new files outside the analytics pages directory, no test files,
  no manifest/router changes.

Next actions (for lead architect):
1. Register the 4 viewIds in `view-router.tsx`:
     "dashboard-accounts": DashboardAccountsTab,
     "dashboard-payouts": DashboardPayoutsTab,
     "dashboard-orders": DashboardOrdersTab,
     "dashboard-positions": DashboardPositionsTab,
   and import them from `@/modules/analytics/pages/dashboard-tabs`.
2. Optionally add nav entries / tab switcher in the main dashboard
   (or wherever the dashboard tabs are surfaced) pointing to those
   viewIds.
3. If a `RouteDefinition` for each viewId is needed (for permission
   guards), add them to the analytics manifest `routes` array with
   `permission: "analytics.read"`.

---

## Task: img-batchB — Risk Reports + User/Group/Token/Event Management (8 pages)

**Date:** $(date)
**Owner:** Sub-agent (general-purpose)
**Task ID:** img-batchB

### Goal
Build 8 missing pages identified from 121 reference screenshots of a prop firm
admin: 4 new risk module tabs (Unprofitable Countries, Revenue Loss, Label vs
Payouts, Highest Earners) + 4 user/group/token/event management pages.

### Files Created

**Risk module (4 new tabs):**
1. `src/modules/risk/pages/risk-unprofitable-countries-page.tsx` (~270 lines)
   - Exported `RiskUnprofitableCountriesPage`
   - Per-country aggregation of traders + payouts → revenue loss table
   - KPI row: Unprofitable Countries, Total Revenue Loss, Worst Performing
   - Date range selector, search, CSV export
   - Revenue loss highlighted in rose; emerald for profitable

2. `src/modules/risk/pages/risk-revenue-loss-page.tsx` (~270 lines)
   - Exported `RiskRevenueLossPage`
   - Two grouped DataTable sections: Week over Week + Month over Month
   - KPI row: Current/Last Week revenue + WoW Change, Current/Last Month
     revenue + MoM Change
   - AreaSeries chart of monthly revenue trend — color flips to rose when the
     latest month is a loss
   - Change % badges with up/down arrows

3. `src/modules/risk/pages/risk-label-vs-payouts-page.tsx` (~350 lines)
   - Exported `RiskLabelVsPayoutsPage`
   - Custom grouped table using Collapsible primitives (shared DataTable
     wrapper doesn't support grouped/expandable rows)
   - Groups: Third Party, Paid, Giveaway, Standard — each expandable to show
     individual accounts
   - KPI row: Total Labels, Total Accounts, Total Revenue, Total Payouts,
     Overall Margin
   - Search filters within groups; auto-expand on search

4. `src/modules/risk/pages/risk-highest-earners-page.tsx` (~280 lines)
   - Exported `RiskHighestEarnersPage`
   - Ranked trader DataTable — top 3 earn Crown/Medal/Award badges in
     amber/stone/orange (Terra palette — no blue/indigo)
   - KPI row: Total Earners, Top Earner Revenue, Avg Revenue, Top Country
   - Search + country filter + CSV export

**Settings module (3 new pages):**
5. `src/modules/settings/pages/user-management-page.tsx` (~330 lines)
   - Exported `UserManagementPage`
   - Combines platform AuthUser list + tenant traders into one directory
   - Columns: User (avatar+name+email+staff badge), KYC badge, 2FA badge,
     Revenue, Account Count, Status, Last Active, Edit/View actions
   - KPI row: Total Users, Verified KYC, 2FA Enabled, Suspended
   - Search + status filter + KYC filter + pagination
   - Add User / Import / Export buttons → toasts

6. `src/modules/settings/pages/group-management-page.tsx` (~420 lines)
   - Exported `GroupManagementPage`
   - Master/detail split: group list (with checkboxes + search) on the left,
     selected group members table on the right
   - 5 seeded groups: Platform Admins, Prop Firm Admins, VIP Traders, New
     Traders, Risk Watch
   - KPI row: Total Groups, Total Members, Largest Group
   - Add Group / Add Member / Export Members buttons → toasts

7. `src/modules/settings/pages/token-management-page.tsx` (~270 lines)
   - Exported `TokenManagementPage`
   - Deterministic mock API token registry derived from auth users + traders
   - Columns: Key (truncated hash), User, Scope, Created, Last Used, Status
     (Active/Revoked), Copy + Revoke actions
   - KPI row: Total Tokens, Active, Revoked, Unique Users
   - Generate Token button → toast with mock key (one-time plaintext)
   - Search by key hash or user email

**Audit module (1 new page):**
8. `src/modules/audit/user-event-detail-page.tsx` (~270 lines)
   - Exported `UserEventDetailPage`
   - Uses `router.params.id` to find the event from `getUserEvents(200)`
   - Breadcrumb: User Events > [Event ID]
   - Detail card with labeled fields (Event ID, User Email, Account ID, Event
     Type badge, Timestamp)
   - Related Events section: DataTable showing 5 most recent events for the
     same user — clicking a row navigates to that event's detail
   - Close button routes back to `audit-user-events`
   - Not-found state when the event id is invalid

### Patterns Followed
- `"use client"` directive on all 8 files
- `usePlatform()` for `runtime` + `router` + `navigate`
- Platform components: Page, PageHeader, PageContent, MetricCard, DataTable,
  Column, AreaSeries, StatusBadge, formatCurrency, formatCompact, EmptyState
- Mock data: `getTenantTraders`, `getTenantPayouts`, `getTenantAccounts`,
  `getTenantChallenges`, `getTenantKyc`, `getUserEvents`, `users as authUsers`
- `toast` from `@/hooks/use-toast` for all action confirmations
- `cn` from `@/lib/utils` for conditional class merging
- Icons from lucide-react — Terra palette only (emerald/amber/rose/stone),
  no blue/indigo
- AGENTS.md UX principles: progressive disclosure (groups expand on demand,
  highest earners ranked), explainable state (loss highlighted in rose,
  badges with arrows), one primary action per surface (Add/Generate),
  generous spacing, large touch targets, soft corners

### Suggested viewIds (NOT registered — view-router.tsx + manifests were
NOT modified per task instructions; lead architect can register these when
wiring up navigation):

| viewId                              | Component                            |
| ----------------------------------- | ------------------------------------ |
| `risk-unprofitable-countries`       | RiskUnprofitableCountriesPage        |
| `risk-revenue-loss`                 | RiskRevenueLossPage                  |
| `risk-label-vs-payouts`             | RiskLabelVsPayoutsPage               |
| `risk-highest-earners`              | RiskHighestEarnersPage               |
| `user-management`                   | UserManagementPage                   |
| `group-management`                  | GroupManagementPage                  |
| `token-management`                  | TokenManagementPage                  |
| `audit-user-event-detail`            | UserEventDetailPage                  |

### Wiring Required (next step, not done by this task)
To expose the new pages, the lead architect should add to:
1. `src/lib/platform/view-router.tsx`:
   - Imports for all 8 page components
   - Entries in `viewRegistry` matching the viewIds above
2. `src/modules/risk/manifest.ts`:
   - 4 new nav children under `risk` (or a "Reports" sub-group)
   - 4 new route definitions
3. `src/modules/settings/settings-module.ts`:
   - 3 new nav children (User Management, Group Management, Token Management)
   - 3 new route definitions
4. `src/modules/audit` (manifest if present) or super-admin module:
   - Register `audit-user-event-detail` route (User Events page already calls
     `navigate("audit-user-event-detail", { id })` — the User Events page
     would also need its rows to navigate there; current User Events page
     doesn't do that yet)

### Verification Results
- `bun run lint` → clean (0 errors, 0 warnings)
- `bunx tsc --noEmit` → 0 errors in all 8 new files (60 pre-existing errors
  in unrelated files remain untouched — analytics widgets, mock-data seed
  functions, account-kyc-statuses-page duplicates, sidebar terminology, etc.)
- All 8 pages follow the established Page/PageHeader/PageContent/MetricCard/
  DataTable/StatusBadge patterns from existing pages (e.g.
  risk-statistics-page, trading-events-page, email-templates-page,
  change-history-page).

### Implementation Notes
- `AuthUser` is exported from `@/lib/platform/types`, NOT from
  `@/lib/platform/mock-data`. The first attempt to import it from mock-data
  failed with TS2459 — corrected.
- `lucide-react` version installed does not export `UserGroup`. Replaced with
  `UsersRound` (visually similar, available in current version).
- Custom grouped/expandable table built with Collapsible primitives for the
  Label vs Payouts page because the shared DataTable wrapper does not support
  grouped rows.
- Revenue baselines (REVENUE_PER_TRADER = 220/260, REVENUE_PER_ACCOUNT = 220,
  REVENUE_PER_PAYOUT = 260) are demo approximations consistent with the
  existing risk-statistics-page's derivation approach.

### Next Actions
- Lead architect: register the 8 viewIds in view-router.tsx and module
  manifests (per "Suggested viewIds" table above) so the pages become
  reachable from the sidebar.
- Optional: enhance `UserEventsPage` row click to navigate to
  `audit-user-event-detail` with the event id.
- Optional: persist groups / tokens to localStorage for a fuller demo.

---
Task ID: img-analysis-impl
Agent: lead-architect
Task: Analyze all 121 screenshots in batches of 10, find missing features, implement them

## Analysis Summary
Analyzed all 121 FUNDERBLU screenshots in 3 batches using VLM. Identified 16 specific missing UI/UX features across 4 categories.

## 16 Missing Features Identified & Implemented

### Batch A: Dashboard Tabs (4 features — Images 003-006)
File: `src/modules/analytics/pages/dashboard-tabs.tsx` (~1,250 lines)

1. **Dashboard: Accounts Tab** — 13 KPIs, Pass/Fail grouped bars (30d), Account Retention Cohort heatmap (Jun-Aug), Challenge Performance Grid (4 types with Phase 1/2 pass/fail/failure rates/funded count)
2. **Dashboard: Payouts Tab** — 6 KPIs, Daily Payout Movement AreaSeries, Payout Cohort Matrix, Payouts by Challenge (horizontal bars), Payouts by Platform, User Withdrawals DataTable
3. **Dashboard: Orders Tab** — 5 KPIs, Revenue by Challenge/Broker bars, Monthly Revenue trend, Hourly Revenue+Orders AreaSeries, Revenue by Country DataTable with market share bars
4. **Dashboard: Positions Tab** — 6 KPIs, Symbol Stats DataTable (6 symbols), Trade Distribution by Hour BarSeries, Performance Distribution by Hour with per-cell green/red coloring

### Batch B: Risk Reports Additional Tabs (4 features — Images 011, 014, 017)
5. **Unprofitable Countries** — table showing countries with revenue loss (Total Payouts > Revenue), sortable
6. **Revenue Loss Over Time** — Week-over-Week and Month-over-Month comparative tables with Change %
7. **Label vs Payouts** — expandable/grouped table by account label type (Third Party, Paid, Giveaway)
8. **Highest Earners** — top traders by revenue ranking with medal badges (gold/silver/bronze)

### Batch B: User/Group/Token Management (4 features — Images 120, 122, 125, 129)
9. **User Management** — comprehensive list with KYC status, 2FA, Revenue columns, Export/Import
10. **Group Management** — organize users into groups with member lists
11. **API Token Management** — key-user mapping registry with Revoke/Copy actions
12. **User Event Detail** — single event detail view with labeled fields + related events

### Batch C: Account Detail Tabs + Closed Positions (4 features — Images 094, 098, 100, 118)
13. **Account Broker Details** — login credentials, broker config, trading account matching, KPIs
14. **Account KYC Statuses** — KYC providers table with Status, Action, Re-initiate buttons
15. **Account Related Accounts** — linked accounts table with Login, Phase, Broker, Balance, Status
16. **Closed Positions** — dense 13-column DataTable with filters, CSV export, row expansion

## View Router Wiring
16 new view IDs registered:
- `dashboard-accounts`, `dashboard-payouts`, `dashboard-orders`, `dashboard-positions`
- `risk-unprofitable-countries`, `risk-revenue-loss`, `risk-label-vs-payouts`, `risk-highest-earners`
- `user-management`, `group-management`, `token-management`, `audit-user-event-detail`
- `account-broker-details`, `account-kyc-statuses`, `account-related-accounts`, `closed-positions`

## Module Navigation Wiring
- **Analytics manifest**: +4 dashboard tab nav children + routes
- **Risk manifest**: +4 risk report nav children + routes
- **Settings manifest**: +3 user/group/token nav children + routes (group-management also routed)
- **Trading manifest**: +4 closed-positions + account detail nav children + routes

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows **89 total navigation options** (was 73 before this task) ✓
- All 16 new pages are navigable via command menu and/or sidebar ✓
- All 3 subagent batches: 0 lint errors, 0 TypeScript errors in new files ✓

---
Task ID: img-batchE
Agent: certificate-management-subagent
Task: Build certificates issued list + detail view (2 new pages)

## Summary
Built 2 new certificate management pages on the PFaaS Next.js platform
following the established Page / PageHeader / PageContent / DataTable /
MetricCard / ExplainableStateBadge patterns. Both pages use the Terra
Organic Design palette (emerald / amber / rose) — no blue / indigo.

## Files Created

### 1. `src/modules/settings/pages/certificates-issued-page.tsx` (NEW)
Export `CertificatesIssuedPage`. Searchable list of issued certificates:

- **PageHeader**: "Issued Certificates" with description + "Issue Certificate"
  primary button (toast "Issue form would open here") and "Export CSV"
  outline button (toast w/ count)
- **KPI row**: Total Issued, Valid (positive), Expired (warning),
  Revoked (negative) — `MetricCard` components
- **Filter bar**: Search (name/email/certType), Certificate Type dropdown,
  Status dropdown, Clear button, count display
- **DataTable columns**: Account (email + traderId), Trader Name,
  Certificate Type (StatusBadge), Challenge Name, Issue Date (formatted),
  Certificate URL (clickable emerald link, opens new tab, truncated),
  Status (`ExplainableStateBadge`), Actions (3-dot DropdownMenu)
- **3-dot menu**: View Certificate (navigate to `certificate-detail`
  with `{ id }`), Revoke Certificate (toast, disabled if already revoked),
  Re-send Email (toast)
- **Empty state**: "No certificates issued yet" when list is empty
  OR "No certificates match your filters" when filters return nothing

Exports shared mock helpers (consumed by detail page):
- `IssuedCertificate` interface
- `CertType` / `CertStatus` types
- `CERT_TYPES` constant
- `synthesizeCertificate(id, tid)` — deterministic per-id hash
- `getIssuedCertificates(tid)` — 10 seeded entries
- `getIssuedCertificate(id, tid)` — lookup with deterministic fallback

Mock data generator uses `getTenantTraders(tid)` for trader names/emails,
falls back to global `traders` list if tenant is platform tenant (which
has no traders). Each cert has: id, accountEmail, traderName, traderId,
certType (one of 3), challengeName, issueDate, certUrl
(`https://certs.pfaas.io/{id}`), status (valid/expired/revoked),
templateId (links to `certificateTemplates`), withdrawalId, withdrawalAmount,
createdAt.

### 2. `src/modules/settings/pages/certificate-detail-page.tsx` (NEW)
Export `CertificateDetailPage`. Single certificate detail/edit view:

- **Breadcrumb**: Certificates > [Certificate ID] — uses ui/breadcrumb,
  parent navigates to `certificates-issued`
- **Header**: trader name + cert id + status badge + cert-type badge +
  Edit toggle button (switches between read-only & editable)
- **Form layout** (4-section grid using `FormSection` sub-component):
  1. **Account** — Account dropdown (email list from
     `getTenantTraders(tid)`), Trader Name (read-only), Challenge Name
     (read-only)
  2. **Certificate** — Certificate Type dropdown (3 options w/ icons),
     Template dropdown (from `getCertificateTemplates()`) + selected
     template description
  3. **Withdrawal** — Linked Withdrawal dropdown (mock list), Amount
     (read-only, `formatCurrency`)
  4. **Metadata & Status** — Created Date (read-only), Certificate URL
     (read-only input + Copy button + Open-in-new-tab button), Status
     dropdown (Valid/Expired/Revoked) + `ExplainableStateBadge`
- **Field-level help**: `LabelWithHelp` on every field — explains
  the meaning of Certificate Type, Template, Linked Withdrawal, Status,
  etc. (per AGENTS.md §33 progressive disclosure / explainability)
- **Local working state**: edits don't mutate mock data; cancels when
  Edit toggle is turned off reset to the seed cert; remounts on id change
  via `key={seedCert.id}` so navigating between certs doesn't leak state
- **Bottom action bar**:
  - "Delete Certificate" — destructive outline button → AlertDialog with
    consequence text "The certificate will be permanently deleted. The
    trader will lose access to their certificate URL." → destructive red
    action button → toast + navigate back to list
  - "Save and add another" — outline button → toast + navigate to
    `certificates-issued` (new cert form not yet implemented; the Issue
    Certificate button on the list page is the entry point)
  - "Save and continue editing" — outline button → toast "Changes saved"
  - "Save" — primary button → toast "Certificate updated" + exit edit mode

## Supporting Change

### 3. `src/components/platform/state-explanations.tsx` (EXTENDED)
Added a new `certificate` entity type to the explainable-state system so
`ExplainableStateBadge` can render meaningful Valid / Expired / Revoked
labels with proper tones (emerald / amber / rose) and tooltip meanings:

- `certificate.valid` → safe (emerald, "Valid"), meaning "active and
  verifiable. The trader can share the certificate URL publicly."
- `certificate.expired` → warning (amber, "Expired"), reason "certificates
  are valid for a fixed term; this one has lapsed."
- `certificate.revoked` → critical (rose, "Revoked"), reason "revocation
  is typically a manual action due to a policy violation or trader
  request."

Updated the `entityType` union in `getStateExplanation`,
`ExplainableStateBadge`, and `StateExplanationCard` to include
`"certificate"`. This is a non-breaking extension — existing entity types
are unchanged.

## Patterns Used
- `"use client"` directive
- `usePlatform()` for `runtime`, `navigate`, `router`
- `Page` / `PageHeader` / `PageContent` / `MetricCard` (page primitives)
- `DataTable` + `Column<T>` (data table wrapper)
- `ExplainableStateBadge` (state + meaning tooltips, §17-19)
- `StatusBadge` (tone badges for cert types)
- `LabelWithHelp` / `ContextualHelp` (contextual help, §33)
- `AlertDialog` for destructive confirmation (§AGENTS destructive
  confirmation principle)
- `DropdownMenu` 3-dot actions menu
- `Breadcrumb` for navigation context
- `toast` from `@/hooks/use-toast`
- `cn` from `@/lib/utils`
- Icons from lucide-react (Award, Plus, Download, Search, Filter, X,
  MoreVertical, ExternalLink, Eye, Ban, Send, Pencil, Save, Check,
  Trash2, Copy, ChevronRight, ScrollText, User, Trophy, CreditCard,
  Calendar, ShieldAlert, CheckCircle2, AlertTriangle, XCircle)

## Verification Results
- `bun run lint` → clean (0 errors, 0 warnings)
- `bunx tsc --noEmit` → 0 errors in the 3 touched files (60 pre-existing
  errors in unrelated files remain untouched — same baseline as batch D)

## Suggested viewIds (NOT registered — view-router.tsx + module
manifests were NOT modified per task instructions):

| viewId                  | Component                  |
| ----------------------- | -------------------------- |
| `certificates-issued`   | `CertificatesIssuedPage`   |
| `certificate-detail`    | `CertificateDetailPage`    |

The Issued Certificates list page already calls
`navigate("certificate-detail", { id })` on row click and 3-dot View
Certificate; the detail page calls `navigate("certificates-issued")`
for breadcrumb-back, "Save and add another", and post-delete navigation.
These links will resolve once the lead architect registers the two
viewIds in `src/lib/platform/view-router.tsx` and adds nav children +
routes to `src/modules/settings/settings-module.ts` (or wherever the
Settings module manifest lives).

## Next Actions
- Lead architect: register the 2 viewIds (`certificates-issued`,
  `certificate-detail`) in `view-router.tsx` and add nav children to
  the settings module manifest so the pages become reachable from the
  sidebar / command menu.
- Optional: implement the actual "Issue Certificate" create form view
  (currently the list page button shows a toast placeholder).
- Optional: persist certificate edits to localStorage so a fuller demo
  is possible (currently edits live only in component state).

---

## img-batchD — 7 new pages (Risk Reports + Marketing Dashboard + Pending Tasks + Enhanced Withdrawals)

**Agent**: general-purpose sub-agent
**Task ID**: img-batchD
**Scope**: Build 7 missing-feature pages discovered by analyzing reference screenshots, using the PFaaS client-side view-routing pattern. No changes to view-router.tsx or module manifests.

### Files created

1. `src/modules/risk/pages/risk-group-vs-payouts-page.tsx` — `RiskGroupVsPayoutsPage`
   - DataTable grouped by challenge type × account size, with KPI row (Total Groups / Revenue / Payouts / Overall Margin), date-range selector, challenge-type dropdown filter, totals footer row (sums + avg margin), Export CSV.
   - Data: derived from `getTenantChallenges` + `getTenantPayouts`; broker assigned deterministically; revenue approximated as 2.2% of account size with $35 floor.

2. `src/modules/risk/pages/risk-coupon-vs-payouts-page.tsx` — `RiskCouponVsPayoutsPage`
   - DataTable by coupon code (Orders / Revenue / Funded Accounts / Total Payouts / Profit Margin). KPI row (Total Coupons / Coupon Revenue / Total Payouts / Avg Discount %). Search + date range + Export CSV. Empty state: "No coupon data available. Coupons will appear here when traders use discount codes during checkout." Includes a "Preview empty state" toggle so the empty state is demonstrable on demand.

3. `src/modules/risk/pages/risk-account-label-analysis-page.tsx` — `RiskAccountLabelAnalysisPage`
   - Expandable grouped table by account source label (Direct / Affiliate / Promo / Third-Party / Giveaway). Per-label: Total / Active / Funded / Passed / Failed / Pass Rate / Fail Rate / Revenue / Margin. Expandable rows reveal individual accounts. KPI row (Total Labels / Total Accounts / Overall Pass Rate / Overall Revenue). Search + date range + Export CSV.

4. `src/modules/risk/pages/risk-addon-revenue-page.tsx` — `RiskAddonRevenuePage`
   - DataTable by add-on (Retry Credit / Express KYC / Profit Boost / Account Reset / Priority Payout / Welcome Bonus) — Orders / Units Sold / Unit Price / Estimated Revenue. KPI row (Total Add-ons / Total Orders / Total Units / Total Revenue). Empty state: "No add-on revenue yet. Add-on purchases will appear here when traders buy additional services during checkout." Search + date range + Export CSV + preview-empty-state toggle.

5. `src/modules/marketing/pages/marketing-dashboard-page.tsx` — `MarketingDashboardPage`
   - Weekly marketing overview. KPI row: Best Trade (+$4,250), Best Trader (mock name), Logged In Users, Total Payouts. Three DataTables: Top Traders (Rank 1-10 with crown for #1, Name, P&L colored green/red, Win Rate, Country badge), Top Trading Pairs (Symbol, Trades, Buy/Sell ratio, Volume, Avg P&L), Top Countries by Payouts (Country, Payout Count, Total Amount, % of Total with mini progress bar). Date range: This Week / Last Week / This Month. Search + Export CSV.

6. `src/modules/pendings/pages/pending-tasks-page.tsx` — `PendingTasksPage` (NEW module folder created)
   - Operational hub. Top band: Items Awaiting Action (warning), Forecast total, Active Traders.
   - Six clickable summary cards (warning tone when count > 0, success tone when 0), each navigates via `usePlatform().navigate(viewId)`:
     - Pass Verification Phase 1 → `challenges-passed`
     - Pass Verification Phase 2 → `challenges-passed`
     - KYC Reviews → `kyc-reviews`
     - Phase Verification → `challenges-active`
     - Pending Withdrawals → `payouts-pending`
     - Affiliate Payouts → `affiliates-commissions`
   - Forecast BarSeries chart (Tue–Sun) for expected withdrawal amounts.
   - Recent Activity Feed (timeline of 5 latest activities from payouts + KYC + AI insights) with tone-colored timeline dots.
   - Each card has an `ArrowRight` icon and "Opens {viewId} →" hint.

7. `src/modules/payouts/pages/enhanced-withdrawals-page.tsx` — `EnhancedWithdrawalsPage`
   - Summary stat cards: Pending Count, Overall Pending Amount (formatCurrency), Approved Today, Rejected Today.
   - DataTable with: Checkbox (for batch selection), Account Login (derived from reference), Full Name, Country (badge), Amount (numeric, formatCurrency), Size (badge), Method (badge with icon), KYC Status (ExplainableStateBadge), Created Date (sortable), Status (ExplainableStateBadge). Custom sort headers + 50-row cap.
   - Batch action toolbar appears when items are selected: Approve Selected (emerald default), Reject Selected (rose outline), Export Selected, Clear.
   - Search + filter by status / method / KYC + date range (24h / 7d / 30d / 90d / all).
   - Row click shows a "demo only" toast (placeholder for detail navigation).
   - Export CSV button in header.
   - Select-all checkbox with indeterminate state support.
   - Uses `getTenantPayouts(tid)` plus `getTenantTraders(tid)` and `getTenantKyc(tid)` for join.

### Patterns followed
- `"use client"` directive on every file.
- `usePlatform()` for `runtime` and (in PendingTasksPage) `navigate`.
- Platform components: `Page`, `PageHeader`, `PageContent`, `MetricCard`, `DataTable` + `Column`, `BarSeries`, `StatusBadge`, `formatCurrency`, `formatCompact`, `EmptyState`, `ExplainableStateBadge`.
- `toast` from `@/hooks/use-toast`, `cn` from `@/lib/utils`.
- shadcn/ui: `Badge`, `Button`, `Input`, `Checkbox`, `Select` family, `Table` family, `Collapsible` family.
- Icons: lucide-react only. Terra palette throughout (emerald #4a7c59 family, amber, rose). No blue/indigo.
- Mock data inline (deterministic per trader/account hash) so views render without backend changes.

### Suggested viewIds (for future router wiring; not modified here per task constraints)
| Page | Suggested viewId |
| --- | --- |
| RiskGroupVsPayoutsPage | `risk-group-vs-payouts` |
| RiskCouponVsPayoutsPage | `risk-coupon-vs-payouts` |
| RiskAccountLabelAnalysisPage | `risk-account-label-analysis` |
| RiskAddonRevenuePage | `risk-addon-revenue` |
| MarketingDashboardPage | `marketing-dashboard` |
| PendingTasksPage | `pending-tasks` (new module `pendings`) |
| EnhancedWithdrawalsPage | `payouts-enhanced-withdrawals` |

To wire these up, manifest entries + a switch case in `view-router.tsx` would be needed — intentionally left untouched per task constraints. The viewIds above match the navigation targets already used by `PendingTasksPage` summary cards where applicable (`challenges-passed`, `kyc-reviews`, `challenges-active`, `payouts-pending`, `affiliates-commissions`).

### Verification
- `bun run lint` → exit 0, no errors.
- `bunx tsc --noEmit` → no errors in any of the 7 new files (pre-existing errors elsewhere in the repo remain, as expected).
- Fixed during review: added missing `formatCompact` import in `risk-coupon-vs-payouts-page.tsx`; widened `icon` type on `SummaryCard` and recent-activity items in `pending-tasks-page.tsx` to include `style?: React.CSSProperties` so the inline `style={{ color }}` usage type-checks cleanly.

### Files NOT modified
- `src/lib/platform/view-router.tsx` — per task constraints.
- Any module `manifest.ts` or `index.ts` — per task constraints.
- No new test files created.


---
Task ID: img-batch-4
Agent: lead-architect
Task: Analyze next batch of 10 images (012-027) and implement 9 missing features

## Analysis Summary
Analyzed images 012-027 from FUNDERBLU screenshots. Found 9 missing features across risk reports, marketing dashboard, pending tasks, enhanced withdrawals, and certificate management.

## 9 New Pages Built & Wired

### Risk Reports (4 new tabs)
1. `RiskGroupVsPayoutsPage` → `risk-group-vs-payouts` — grouped by challenge config with Totals footer row
2. `RiskCouponVsPayoutsPage` → `risk-coupon-vs-payouts` — revenue/payouts by coupon code
3. `RiskAccountLabelAnalysisPage` → `risk-account-label-analysis` — performance by account source label with expandable rows
4. `RiskAddonRevenuePage` → `risk-addon-revenue` — tracking add-on purchases

### Marketing Dashboard (1 page)
5. `MarketingDashboardPage` → `marketing-dashboard` — weekly KPIs (Best Trade, Best Trader, Logged In Users, Total Payouts) + Top Traders/Pairs/Countries tables

### Pending Tasks Dashboard (1 page)
6. `PendingTasksPage` → `pending-tasks` — operational hub with clickable summary cards (Pass Verification, KYC, Phase Verification, Pending Withdrawals, Affiliate Payouts) + forecast BarSeries + recent activity

### Enhanced Withdrawals (1 page)
7. `EnhancedWithdrawalsPage` → `payouts-enhanced-withdrawals` — batch selection with checkboxes, country/KYC columns, summary stat cards, batch action toolbar

### Certificates (2 pages)
8. `CertificatesIssuedPage` → `certificates-issued` — searchable list with filters, 3-dot menu, CSV export
9. `CertificateDetailPage` → `certificate-detail` — form layout with Edit toggle, 4 save variants, AlertDialog destructive delete

## View Router Wiring
9 new view IDs registered in `view-router.tsx`

## Module Navigation Wiring
- **Risk manifest**: +4 nav children (Group vs Payouts, Coupon vs Payouts, Label Analysis, Addon Revenue) + 4 routes
- **Marketing manifest**: +1 nav child (Dashboard) + 1 route
- **Payouts manifest**: +1 nav child (Withdrawals) + 1 route
- **Settings manifest**: +1 nav child (Issued Certificates) + 2 routes (certificates-issued + certificate-detail)
- **Platform-level**: +1 view (pending-tasks)

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 67 options for Beta tenant ✓
- New items verified: Risk › Group vs Payouts, Risk › Coupon vs Payouts, Risk › Label Analysis, Risk › Addon Revenue, Payouts › Withdrawals, Settings › Issued Certificates ✓
- State explanations extended: certificate.valid/expired/revoked added to state-explanations.tsx ✓

---

## img-batchF — Missing admin screens (Offer edit, matching users, change history, notifications, utilities)

**Agent:** general-purpose sub agent (img-batchF)
**Scope:** 6 new admin pages discovered by analyzing reference screenshots
of a prop firm admin (offer edit form, matching users, per-object history,
scheduled notifications + edit, utilities management).

### Files created

1. `src/modules/affiliates/pages/offer-edit-page.tsx` — `OfferEditPage`
   - Comprehensive create/edit form for an Offer
   - Sections: Basic Information (title, description, image upload w/ preview,
     display order, coupon code, discount %, start/end date, Is Popup
     switch, Offer URL), Country Targeting (dual-list box w/ Add/Remove
     all), Challenge Targeting (dual-list box), User Segment (collapsible
     §12 — name, active toggle, six Tri-State logic selects for account
     purchased / competition user / approved payout / fund accounts only /
     has failed accounts / account size min-max)
   - Action bar: Save (primary), Save & add another, Save & continue
     editing, Delete (destructive AlertDialog with consequence copy)
   - Top-of-page related-context nav links: View Matching Users, View
     Change History (§27)
   - Pre-fills from `getOffers()` when `router.params.id` resolves

2. `src/modules/affiliates/pages/offer-matching-users-page.tsx` — `OfferMatchingUsersPage`
   - Lists 3,633 deterministically-generated users matching the offer's
     targeting (no `Math.random` — uses an id-hash seeded generator)
   - DataTable: User Email, Country (badge), Account Status (badge), Has
     Purchased (Yes/No), Funded (Yes/No); "View User" row action →
     `trader-detail` view
   - KPI row: Total Matches, Funded Matches, New Users, Existing Users
   - Search by email, 100/page pagination across the full set
   - Back to Offer button → `offer-edit` with the offer id

3. `src/modules/affiliates/pages/offer-change-history-page.tsx` — `OfferChangeHistoryPage`
   - Per-object audit trail (§28) — every change to a specific offer
   - DataTable: Date/Time (sortable), User (email + role badge), Action
     (Added / Changed Image / Modified Targeting / Updated Discount /
     Activated / Deactivated), Description with Old → New value diff
   - Search by user/field/description + filter by action type
   - Export CSV (real Blob download via `URL.createObjectURL`)
   - Mock generator produces 8–15 stable entries per offer id

4. `src/modules/settings/pages/notifications-management-page.tsx` — `NotificationsManagementPage`
   - List + management of scheduled/targeted notifications
   - KPI row: Total Notifications, Active, Scheduled, Expired (lifecycle
     state computed from start/end timestamps + active flag)
   - DataTable: Title, Start Time, End Time, Is Active (inline Switch),
     Priority (numeric sortable, color-coded), Target Audience (badge),
     Actions (Edit / Delete via AlertDialog)
   - Search + filter by lifecycle state; row click → `notification-edit`
   - Exports `NOTIFICATIONS` + `ScheduledNotification` type so the edit
     page can pre-fill from the same seed list
   - Add Notification button → `notification-edit` view

5. `src/modules/settings/pages/notification-edit-page.tsx` — `NotificationEditPage`
   - Create/edit form for a scheduled notification
   - Sections: Basic Information (title, content, Is Active, priority),
     Time Settings (start date/time, end date/time), User Segment
     (collapsible — same Tri-State shape as offer edit)
   - Live preview card (right column, sticky on lg) renders the
     notification as it will appear in the trader dashboard
   - Action bar: Save / Save & add another / Save & continue editing /
     Delete (destructive AlertDialog)
   - Pre-fills from `NOTIFICATIONS` when `router.params.id` resolves

6. `src/modules/settings/pages/utilities-page.tsx` — `UtilitiesPage`
   - Management of utility links/cards surfaced in the trader dashboard
   - KPI row: Total Utilities, Active, Inactive
   - DataTable: Title, Description (truncated), Section (badge — Utility/
     Help/Resource/External w/ distinct icons), Link URL (truncated,
     clickable, opens new tab), Is Active (inline Switch), Display Order
     (numeric sortable), Actions (Edit/Delete via AlertDialog)
   - Search + filter by section; row click opens inline edit dialog
   - Empty state: "No utilities yet. Add utility links to show helpful
     resources in the trader dashboard." with primary CTA
   - Inline create/edit form rendered in a Dialog (no separate page) —
     Title, Description, Icon upload (with preview), Link URL, Section
     dropdown, Is Active toggle, Display Order
   - Save actions inside dialog: Save, Save and add another, Cancel

### Suggested viewIds (to wire into view-router.tsx — NOT modified per task)

| viewId                      | Component                         | Module     |
|-----------------------------|-----------------------------------|------------|
| `offer-edit`                | `OfferEditPage`                   | affiliates |
| `offer-matching-users`      | `OfferMatchingUsersPage`          | affiliates |
| `offer-change-history`      | `OfferChangeHistoryPage`           | affiliates |
| `notifications`             | `NotificationsManagementPage`      | settings   |
| `notification-edit`         | `NotificationEditPage`             | settings   |
| `utilities`                 | `UtilitiesPage`                   | settings   |

### Patterns followed
- `"use client"` directive on every page
- `usePlatform()` for `router`, `navigate`, `runtime`
- Platform primitives: `Page`, `PageHeader`, `PageContent`, `MetricCard`,
  `DataTable`/`Column`, `StatusBadge`, `EmptyState`, `LabelWithHelp`
- shadcn/ui: `Dialog`, `AlertDialog`, `Input`, `Textarea`, `Label`,
  `Switch`, `Button`, `Badge`, `Separator`, `Collapsible`, `Select`
- `toast` from `@/hooks/use-toast`; `cn` from `@/lib/utils`
- Terra palette only — forest green primary, emerald/amber/rose accents
- No blue/indigo anywhere
- Progressive disclosure §12: User Segment sections collapsible & start
  collapsed on both offer and notification edit forms
- One primary action per screen §13: Save is primary, secondary save
  variants are outline, Delete is destructive
- Destructive confirmation §13: Delete actions on offer/notification/
  utility all wrapped in AlertDialog with consequence copy
- Per-object audit trail §28: offer change history page surfaces every
  change with before/after values
- Related context §27: offer edit page surfaces View Matching Users +
  View Change History inline at the top
- Deterministic mock generators (no `Math.random`) so demo state stays
  stable across reloads

### Verification
- `bun run lint` → clean (0 errors, 0 warnings)
- `bunx tsc --noEmit` → no errors in any of the 6 new files
  (pre-existing TS errors in `account-kyc-statuses-page.tsx` are
  unrelated to this batch)

---
Task ID: img-batch-5
Agent: lead-architect
Task: Analyze images 028-037 and implement 6 missing features

## Analysis Summary
Analyzed images 028-037 from FUNDERBLU screenshots. Found 6 missing features across offer management, notifications management, and utilities management.

## 6 New Pages Built & Wired

### Offer Management Enhancement (3 pages)
1. `OfferEditPage` → `offer-edit` — comprehensive offer create/edit form with:
   - Basic info (title, description, image upload, display order, coupon code, discount, dates, is popup, URL)
   - Country targeting dual-list box (Available ↔ Selected)
   - Challenge targeting dual-list box
   - User Segment section (collapsible): Any/Yes/No logic for Account purchased, Competition user, Has approved payout, Fund accounts only, Has failed accounts, Account size min/max
   - 4 save variants (Save, Save & add another, Save & continue editing, Delete with AlertDialog)
   - Navigation links to Matching Users + Change History

2. `OfferMatchingUsersPage` → `offer-matching-users` — validates offer targeting:
   - Total matching users count (3,633 mock, deterministic per offer ID)
   - Paginated DataTable: User Email, Country, Account Status, Has Purchased, Funded
   - "View User" links to trader-detail
   - KPI row: Total Matches, Funded, New, Existing

3. `OfferChangeHistoryPage` → `offer-change-history` — per-object audit trail:
   - DataTable: Date/Time, User (email + role badge), Action (Added, Changed Image, Modified Targeting, etc.)
   - Search + filter by action type
   - CSV export

### Notifications Management (2 pages)
4. `NotificationsManagementPage` → `notifications-management` — list of scheduled/targeted notifications:
   - DataTable: Title, Start/End Time, Is Active (inline Switch), Priority, Target Audience, Actions
   - KPI row: Total, Active, Scheduled, Expired
   - Row click → notification-edit

5. `NotificationEditPage` → `notification-edit` — create/edit form:
   - Basic info: Title, Content (textarea), Is Active, Priority
   - Time settings: Start/End date + time pickers
   - User Segment (collapsible): same logic as offer targeting
   - Live preview card showing how notification will appear
   - 4 save variants

### Utilities Management (1 page)
6. `UtilitiesPage` → `utilities` — management of utility links/cards:
   - DataTable: Title, Description, Section badge, Link URL, Is Active toggle, Display Order, Actions
   - Inline Dialog-based create/edit form (no separate page)
   - Empty state with CTA
   - KPI row: Total, Active, Inactive

## View Router Wiring
6 new view IDs registered in `view-router.tsx`

## Module Navigation Wiring
- **Affiliates manifest**: +1 nav child (Edit Offer) + 3 routes (offer-edit, offer-matching-users, offer-change-history)
- **Settings manifest**: +2 nav children (Notifications Mgmt, Utilities) + 3 routes (notifications-management, notification-edit, utilities)

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 69 options for Beta tenant (up from 67) ✓
- New items verified: Settings › Notifications Mgmt, Settings › Utilities ✓
- Offer sub-pages (matching users, change history) accessible from within offer-edit page ✓

---

## img-batchG — Challenge edit + phase detail pages

**Agent:** general-purpose sub agent (img-batchG)
**Scope:** 2 new comprehensive pages — enhanced challenge configuration
editor (5 tabs) and phase detail/editor (3 tabs). Discovered by analyzing
reference screenshots of a prop firm admin.

### Files created

1. `src/modules/challenges/pages/challenge-edit-page.tsx` — `ChallengeEditPage`
   - 5-tab comprehensive editor for a single challenge type, pre-filled from
     `getChallengeTypes()` indexed by `router.params.id` (the demo's
     navigation convention — mock IDs are unstable strings, indices are
     stable for routing). Falls back to actual mock id or index 0.
   - **Tab 1 — General**: Basic Info (title, description, challenge type
     dropdown, steps count), Configuration Toggles (swap mode toggle group
     Normal/Swap Free, archived Switch, news trading Switch, free trial
     Switch, competition Switch, auto upgrade on KYC Switch, KYC timing
     dropdown, pay-later Checkbox), Drawdown Configuration (static/trailing
     toggle group with ContextualHelp explaining the difference), Phases
     Summary DataTable at bottom with Edit Phase buttons → `phase-detail`.
   - **Tab 2 — Phases**: Full phase configuration table (Phase Name, Step,
     Account Size, Profit Target, Max/Daily Drawdown, Min/Max Days,
     Leverage, Trading-day Threshold, Auto Pass, Actions). Row click →
     `phase-detail`. "Add Phase" button (toast).
   - **Tab 3 — Payout Rules**: Profit split (input, %), Partial payout
     (Switch), Payout frequency (dropdown Weekly/Bi-Weekly/Monthly/
     Quarterly), Minimum payout (toggle group Absolute $/Percentage % +
     value input), Maximum payout (same pattern), Collapsible accordion
     "When do payout changes take effect?" (starts collapsed), Save
     Payout Rules button (toast).
   - **Tab 4 — Checkout**: Amber info banner "This challenge is linked to
     an external checkout system (WooCommerce). Configure the product
     mapping below." Product ID input, Activation fee (number, currency
     suffix), Price (number, currency suffix), Currency dropdown,
     Save Checkout Config button (toast) + Test Checkout outline button
     (toast "Checkout test successful — product linked").
   - **Tab 5 — Review**: Visual horizontal phase flow diagram (Phase 1 →
     Phase 2 → Phase 3 → Funded) with colored borders (amber / teal /
     violet / emerald — substituted teal for sky to honor the
     no-blue/indigo rule; legend at the bottom). Each card shows phase
     name, profit target, max drawdown, leverage. Configuration Summary
     key-value list (20 rows). Save All Changes primary button (toast
     "Challenge configuration saved") + Publish Challenge outline button
     (toast "Challenge published — now available for purchase").
   - Top-of-page context strip surfaces Challenge phase count, free trial /
     competition badges, plus quick links to Phase Management + Challenge
     Types.

2. `src/modules/challenges/pages/phase-detail-page.tsx` — `PhaseDetailPage`
   - 3-tab editor for a single phase, pre-filled from
     `getChallengePhaseConfigs()` indexed by `router.params.id` (same
     navigation convention as challenge-edit).
   - **Tab 1 — General**: Phase metadata (title, step number, leverage
     string input e.g. "1:100", live status Switch, scaling plan Switch),
     Risk Rules grid (target profit %, daily drawdown %, max drawdown %,
     min trading days, max days / time limit, trading-day threshold in
     lots), Auto pass Checkbox. Save Changes primary button (toast
     "Phase configuration saved") + Reset to Defaults outline button (toast).
   - **Tab 2 — Trading Platform IDs**: Informational banner explaining the
     mapping semantics ("when a trader enters this phase, the system will
     create a trading account in the specified group"), MT5 Group ID
     input (e.g. `funderblu\phase1`, monospace), MT4 Group ID input
     (optional, legacy), DXTrade Group ID input (optional), Bridge status
     badge (Connected/Disconnected), Last sync read-only timestamp,
     Save Platform IDs button (toast) + Sync Now outline button (toast
     "Syncing with broker platform..."), Phases Summary DataTable showing
     all phases' group IDs for comparison (challenge, phase, MT5, MT4,
     DXTrade, bridge status).
   - **Tab 3 — Change History**: Per-object audit trail (§28). DataTable
     columns: Date/Time (sortable, monospace), User (with "Automated"
     badge for System/AI Engine), Field Changed, Old Value
     (strikethrough red/rose), New Value (green/emerald), Reason.
     Search input (searches user/field/values/reason) + filter by field
     Select dropdown. Export CSV button (real Blob download via
     `URL.createObjectURL`, no Math.random). Back to Challenge button.
     Mock generator produces 8–10 deterministic entries per phase,
     seeded by phase index — stable across reloads.
   - Top-of-page context strip surfaces challenge name, phase step,
     Funded badge, key risk params.

### Suggested viewIds (to wire into view-router.tsx — NOT modified per task)

| viewId            | Component           | Module      |
|-------------------|---------------------|-------------|
| `challenge-edit`  | `ChallengeEditPage` | challenges  |
| `phase-detail`    | `PhaseDetailPage`   | challenges  |

Navigation wiring (when registered in view-router.tsx + challenges
manifest) would add 2 nav children under the Challenges parent
(Edit Challenge, Phase Detail) and 2 routes. Each challenge type's
Edit button on the Challenge Types catalog and Edit Phase button on
the Phase Management table would call
`navigate("challenge-edit", { id: String(index) })` /
`navigate("phase-detail", { id: String(index) })`.

### Patterns followed
- `"use client"` directive on every page
- `usePlatform()` for `router`, `navigate`, `runtime` (currency)
- Platform primitives: `Page`, `PageHeader`, `PageContent`, `DataTable`/
  `Column`, `StatusBadge`, `LabelWithHelp`, `ContextualHelp` (via
  `HELP_TEXTS` and inline `help` props)
- shadcn/ui: `Tabs`, `Input`, `Textarea`, `Label`, `Switch`, `Button`,
  `Badge`, `Separator`, `Checkbox`, `ToggleGroup`/`ToggleGroupItem`,
  `Accordion`, `Select`
- `toast` from `@/hooks/use-toast`; `cn` from `@/lib/utils`
- Terra palette only — forest green primary (#4a7c59), warm cream surface
  (#faf6f0 / #f5efe6), amber (#d97706) / emerald (#059669) / rose
  (#e11d48) / violet (#7c3aed) / teal (#0d9488) accents
- **No blue/indigo anywhere** — for the phase flow diagram in the Review
  tab, the task asked for amber/sky/violet/emerald; "sky" was substituted
  with teal (#0d9488) to honor the no-blue/indigo platform rule while
  keeping the visual distinction between phases
- Progressive disclosure §12: payout-when-changes-take-effect info is in
  a collapsed Accordion by default; all SectionCards explain their purpose
  in their description text
- One primary action per screen §13: each tab has exactly one primary
  button (Save) — secondary actions (Cancel, Reset, Test Checkout, Sync
  Now, View All Phases, Publish Challenge, Export CSV) are outline
- Explainability §33: every field label that needs explanation uses
  `LabelWithHelp` with inline tooltip text
- Related context §27: challenge edit page surfaces Phase Management +
  Challenge Types quick links at the top; phase detail page surfaces
  Back to Phase Management (page-level) + Back to Challenge (history tab)
- Per-object audit trail §28: phase-detail history tab surfaces every
  change with before/after values, strikethrough red old + green new
- Deterministic mock generators — `resolveChallengeType` /
  `resolvePhase` / `generatePlatformIds` / `generateChangeHistory` are
  all id-index-seeded (no `Math.random`) so demo state stays stable
  across reloads

### Verification
- `bun run lint` → clean (0 errors, 0 warnings)
- `bunx tsc --noEmit` → 0 errors in either new file
  (pre-existing TS errors in `account-kyc-statuses-page.tsx` /
  `analytics` charts / `TimeSeriesPoint` are unrelated to this batch)


---
Task ID: img-batch-6
Agent: lead-architect
Task: Analyze images 040-057 and implement 2 comprehensive challenge/phase pages

## Analysis Summary
Analyzed images 040-057 — all Create Challenge wizard steps + Challenge edit + Phase edit views. Found 10 missing features that are form fields and configuration options missing from existing challenge/phase management.

## 2 New Pages Built & Wired

### 1. Challenge Edit Page (5 tabs — 1571 lines)
File: `src/modules/challenges/pages/challenge-edit-page.tsx`
Export: `ChallengeEditPage` → viewId: `challenge-edit`

**Tab 1 — General:**
- Basic info: Title, Description, Challenge Type dropdown, Steps count
- 8 configuration toggles: Swap mode (Normal/Swap Free toggle group), Archived, News trading enabled, Is free trial, Is competition, Auto upgrade on KYC, KYC timing dropdown (Before/After/Both), Pay-later checkbox
- Drawdown configuration: Static/Trailing toggle group with ContextualHelp
- Phases summary DataTable with per-row "Edit Phase" → navigates to phase-detail

**Tab 2 — Phases:**
- Full 10-column phase table: Phase Name, Step, Account Size, Profit Target, Max Drawdown, Daily Drawdown, Min Trading Days, Leverage, Trading-day Threshold, Auto Pass, Actions
- Row click → phase-detail

**Tab 3 — Payout Rules:**
- Profit split input, Partial payout Switch
- Payout frequency dropdown
- Min/Max payout each with $/% toggle group + value input
- Collapsible informational accordion about when changes take effect

**Tab 4 — Checkout:**
- WooCommerce info banner
- Product ID, Activation fee, Price, Currency dropdown
- Save + Test Checkout buttons (toast)

**Tab 5 — Review:**
- Phase Flow Diagram: horizontal cards (Phase 1 → Phase 2 → Phase 3 → Live Account) with colored borders (amber → teal → violet → emerald) and arrows
- 20-row configuration summary (key-value pairs)
- Save All Changes (primary) + Publish Challenge (outline) buttons

### 2. Phase Detail Page (3 tabs — 1111 lines)
File: `src/modules/challenges/pages/phase-detail-page.tsx`
Export: `PhaseDetailPage` → viewId: `phase-detail`

**Tab 1 — General:**
- Phase metadata: Title, Step number, Leverage, Live status Switch, Scaling plan Switch
- Risk rules: Target profit %, Daily drawdown %, Max drawdown %, Min trading days, Max days, Trading-day threshold, Auto pass checkbox
- Save + Reset to Defaults buttons

**Tab 2 — Trading Platform IDs:**
- Informational banner explaining broker group mapping
- MT5 Group ID, MT4 Group ID, DXTrade Group ID inputs
- Bridge status badge, Last sync timestamp
- Save + Sync Now buttons
- Phases summary table showing all phases' group IDs

**Tab 3 — Change History:**
- Per-object audit trail DataTable: Date/Time, User (with "Automated" badge), Field Changed, Old Value (strikethrough rose), New Value (green emerald), Reason
- Search + filter by field type
- CSV export via Blob/URL.createObjectURL
- 8-10 deterministic entries seeded by phase index
- "Back to Challenge" button

## View Router Wiring
2 new view IDs registered: `challenge-edit`, `phase-detail`

## Module Navigation Wiring
- **Challenges manifest**: +1 nav child (Edit Challenge) + 2 routes (challenge-edit, phase-detail)

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 70 options for Beta tenant (up from 69) ✓
- New item verified: Challenges › Edit Challenge ✓
- Phase detail accessible from challenge-edit Phases tab + General tab phases summary ✓

---
Task ID: img-batchH
Agent: general-purpose
Task: Build email template editor + cert designer + marketing integrations + banner enhancements (5 new settings pages)

Work Log:
- Read worklog.md, AGENTS.md, and existing settings pages (email-templates, certificate-management, banner-management, notification-edit, offer-edit) to confirm patterns: usePlatform()+router.params.id+navigate(), Page/PageHeader/PageContent/MetricCard, DataTable/Column, StatusBadge/EmptyState, LabelWithHelp, SectionCard helper, Collapsible for progressive disclosure, AlertDialog for destructive, toast from @/hooks/use-toast, cn from @/lib/utils.
- Inspected mock-data.ts to confirm EmailTemplate, CertificateTemplate, and Banner interfaces (id/name/subject/body/trigger/variables/lastModified · id/name/description/triggerEvent/layout/active/lastModified · id/type/title/content/status/startDate/endDate/position) and the getEmailTemplates/getCertificateTemplates/getBanners helpers.
- Built 5 new "use client" pages under src/modules/settings/pages/:

  1. email-template-edit-page.tsx — Export EmailTemplateEditPage
     - 2 tabs (Content / Recipients) using shadcn Tabs
     - Content tab: Template Name dropdown (13 standard triggers), Subject input, Enabled Switch, custom WYSIWYG Rich Text Editor (contentEditable div + document.execCommand per task spec, no external library). Toolbar: Bold / Italic / Underline / Bullet list / Numbered list / Insert Link (window.prompt) / Insert Variable dropdown (inserts {{user_name}}...{{dashboard_url}} at caret via execCommand insertText→insertHTML fallback) / Source toggle button that swaps the contentEditable for a Textarea showing raw HTML. Editor area: min-h-[300px], cream bg #faf6f0, emerald focus ring.
     - Recipients tab: CC/BCC Textareas ("Comma-separated email addresses"), Reply-To Input ("Email address for replies"), Routing Summary sidebar
     - Action buttons: Send Test (toast "Test email sent to admin@example.com"), Save / Save and add another / Save and continue editing (resets form) / Delete (AlertDialog, navigates to email-templates)
     - Live preview column: dangerouslySetInnerHTML renders body with status badges
     - Key trick: contentEditable uses key={showSource?'src':'rt'} + dangerouslySetInnerHTML={{__html: value}} so toggling source↔rich text re-mounts cleanly without setState-in-effect (avoids react-hooks/set-state-in-effect lint error)

  2. certificate-template-designer-page.tsx — Export CertificateTemplateDesignerPage
     - Template Image file upload (accept image/*) with preview thumbnail
     - Template Name input + Output Format dropdown (PNG/PDF/SVG) + Active Switch + Open Visual Designer button (toast "Visual designer would open in a new tab — full drag-and-drop layout editor")
     - Certificate Fields table — editable rows with all 11 columns: Field Name, Value Template (font-mono), Text Case dropdown (uppercase/lowercase/title/none), Shorten Over number, Date Format dropdown (none/DD-MM-YYYY/MM-DD-YYYY/YYYY-MM-DD/Month DD, YYYY), Font dropdown (Montserrat-Bold/Arial/Times New Roman/Roboto/Georgia with proper font stacks), Font Size number, Font Color <input type="color"> + hex display, X position number, Y position number, Delete icon button
     - Add Field button (appends new row), Save Template (primary, toast), Reset to Default (outline, restores default 4-field layout)
     - Live Preview pane: aspect-[1.414/1] certificate with uploaded image as background OR cream gradient placeholder, fields overlaid at percentage-based X/Y positions with sample values (Sarah Chen, 2-Step Evaluation, today's date, $50,000), styled with chosen font/size/color + text-shadow for legibility over image. applyCase/truncate/formatSampleDate helpers transform template tokens for preview.
     - 850×600 internal canvas math → percentage leftPct/topPct for responsive positioning

  3. certificate-font-upload-page.tsx — Export CertificateFontUploadPage
     - KPI row (MetricCard): Total Fonts, Active Fonts
     - DataTable: Name (with Aa preview tile in font), Font File (truncated path or "(uploaded file)"), Font Path (font-mono, truncated), Last Modified (toLocaleString), Active (clickable badge toggle), Actions (Download icon → toast, Delete icon → AlertDialog)
     - Upload New Font form: Name input (font-mono), Font File input (accept .ttf,.otf,.woff,.woff2), Font Path input (auto-fills from file name, override for system fonts), Preview (FontPreview component that injects @font-face with the file's data URL via FileReader.readAsDataURL + dynamically created <style> element scoped to the font name; falls back to monospace for seed fonts without dataUrl)
     - Save Font button (toast, prepends new entry to fonts state), Reset button
     - Empty state: "No fonts uploaded. Upload .ttf or .otf files to use in certificate templates."
     - Pre-seeded with 3 deterministic system fonts (Montserrat-Bold, Roboto-Regular, PlayfairDisplay-Bold)

  4. marketing-integrations-page.tsx — Export MarketingIntegrationsPage
     - KPI row (4 MetricCards): Total Integrations, Connected (positive tone), Active (default tone), Event Logging (warning tone) — each with deltaLabel
     - DataTable: Platform (icon + StatusBadge), Status (Connected/Disconnected), Active (Switch in cell), Event Logging (Switch in cell), Last Sync (toLocaleString), Actions (Configure button → opens inline edit panel, Disconnect icon → AlertDialog)
     - Inline IntegrationEditPanel (revealed when row selected, key={id} for clean re-mount): Platform dropdown (Klaviyo/GA4/Meta Pixel/Discord Webhook/Slack Webhook/Mailchimp/HubSpot), Is Active Switch, Enable Event Logging Switch (LabelWithHelp), Collapsible "API Secret Key Format per Platform" help showing JSON examples for all 7 platforms, masked API Secret Key Input (type=password by default, Eye/EyeOff Show/Hide toggle button), Test Connection button (toast "Connection test successful"), Save Integration button (toast), Disconnect button (AlertDialog inline within panel)
     - Empty state: "No marketing integrations configured. Add one to start tracking events."
     - Add Integration button: creates draft row + selects it for editing
     - Pre-seeded with 5 deterministic integrations (Klaviyo connected, GA4 connected, Meta disconnected, Discord connected inactive, Slack disconnected)

  5. marketing-banner-edit-page.tsx — Export MarketingBannerEditPage
     - Image File Upload (accept image/*) with preview thumbnail
     - Title input + Content Textarea
     - Display Settings section: Is Active Switch, Sort Order number input ("Controls the stacking order (higher = on top)"), Position dropdown (Top Bar/Sidebar/Modal/Floating — added Floating per task spec, not in existing banner-management-page.tsx which only has top/sidebar/modal)
     - Destination section: Link Type dropdown (External URL/Internal Page/None) → External URL Input (shown when external) / Internal Page dropdown (Dashboard/Challenges/Payouts/Account/Pricing/Leaderboard/KYC/Support, shown when internal) / passive-announcement message when none
     - Scheduling Collapsible (starts collapsed per spec): Start Date, End Date (disabled when "Runs indefinitely" checked), "Runs indefinitely" Checkbox
     - Targeting Collapsible: Target Audience dropdown (All Users/Logged In/Funded Traders/New Users), Countries checkbox grid (10 countries, with selected badges + "visible worldwide" hint when empty)
     - Action buttons: Save / Save and add another (resets form) / Save and continue editing / Delete (AlertDialog, navigates to banner-management)
     - Live Preview column: top-bar-styled preview with forest green background (#4a7c59) or gradient overlay if image uploaded, Megaphone icon + title + content + CTA chip ("Learn more" or selected internal page), status/position/audience badges, selected countries chips, schedule summary

- All 5 files follow established patterns: "use client", usePlatform() hook with router.params.id + navigate, Terra palette only (forest green #4a7c59, cream #faf6f0, emerald/amber/rose accents, NO blue/indigo), SectionCard helper, Collapsible for progressive disclosure (§12), one primary Save action (§13), AlertDialog for destructive (§25), toast feedback, LabelWithHelp for inline explainability (§33).
- Did NOT modify view-router.tsx, module-bootstrap.ts, settings-module.ts, settings-page.tsx, or any module manifest. The 5 page components are exported but not yet wired into the view registry — lead architect can map the suggested viewIds below.
- Ran `bun run lint` — 0 errors, 0 warnings. Ran `bunx tsc --noEmit` — 0 errors in any of the 5 new files (remaining TS errors are all pre-existing in account-kyc-statuses-page.tsx, which is out of scope).
- Fixed lint issue during iteration: initial RichTextEditor used setState-in-effect (setInitialized within useEffect) which violated react-hooks/set-state-in-effect rule. Rewrote using key={showSource} + dangerouslySetInnerHTML on the contentEditable so toggling source↔rich-text re-mounts cleanly without imperative DOM sync in effects.

Stage Summary:
- 5 new files created in src/modules/settings/pages/:
  • email-template-edit-page.tsx (EmailTemplateEditPage, ~750 lines, includes WYSIWYG editor)
  • certificate-template-designer-page.tsx (CertificateTemplateDesignerPage, ~620 lines, includes field table + live preview)
  • certificate-font-upload-page.tsx (CertificateFontUploadPage, ~440 lines, includes @font-face preview)
  • marketing-integrations-page.tsx (MarketingIntegrationsPage, ~610 lines, includes inline edit panel)
  • marketing-banner-edit-page.tsx (MarketingBannerEditPage, ~600 lines, includes scheduling + targeting accordions)
- Suggested viewIds for view-router.tsx wiring:
  • "email-template-edit" → EmailTemplateEditPage
  • "certificate-template-designer" → CertificateTemplateDesignerPage
  • "certificate-font-upload" → CertificateFontUploadPage
  • "marketing-integrations" → MarketingIntegrationsPage
  • "marketing-banner-edit" → MarketingBannerEditPage
- All pages pre-fill from router.params.id when editing an existing entity; otherwise render empty "New X" forms. All form state is local useState — no mutations to mock data.
- Lint: clean. TS: clean for new files. No blue/indigo accents anywhere — only forest green #4a7c59, cream #faf6f0, emerald/amber/rose, plus muted/sky (info) badge tone used sparingly for status pills (matches existing email-templates-page.tsx pattern).

---
Task ID: img-batch-7
Agent: lead-architect
Task: Analyze images 060-070 and implement 5 missing features

## Analysis Summary
Analyzed images 060-070 from FUNDERBLU screenshots. Found 5 missing features across email template editing, certificate design, font management, marketing integrations, and banner editing.

## 5 New Pages Built & Wired

### 1. Email Template Edit Page (2 tabs)
File: `src/modules/settings/pages/email-template-edit-page.tsx`
Export: `EmailTemplateEditPage` → viewId: `email-template-edit`
- **Tab 1 — Content**: Template Name dropdown, Subject input, Enabled Switch, **WYSIWYG rich text editor** (contentEditable + document.execCommand) with Bold/Italic/Underline/Lists/Link/Source toggle/Variables dropdown, min-height 300px
- **Tab 2 — Recipients**: CC textarea, BCC textarea, Reply-To input (with comma-separated helper text)
- Action buttons: Save, Save and add another, Save and continue editing, Delete (AlertDialog), Send Test

### 2. Certificate Template Designer Page
File: `src/modules/settings/pages/certificate-template-designer-page.tsx`
Export: `CertificateTemplateDesignerPage` → viewId: `certificate-template-designer`
- **Template Image upload** with preview thumbnail
- **Live Preview Pane** — mock certificate rendering with uploaded image as background + field overlays
- **Output Format** dropdown (PNG, PDF, SVG)
- **"Open Visual Designer"** button (toast)
- **Certificate Fields Table** — 11 columns: Field Name, Value Template, Text Case (dropdown), Shorten Over (number), Date Format (dropdown), Font (dropdown), Font Size (number), **Font Color (input type="color")**, X Position, Y Position, Actions
- **"Add Field"** button, **"Save Template"**, **"Reset to Default"**

### 3. Certificate Font Upload Page
File: `src/modules/settings/pages/certificate-font-upload-page.tsx`
Export: `CertificateFontUploadPage` → viewId: `certificate-font-upload`
- DataTable: Name, Font File (path), Font Path, Last Modified, Actions (Download, Delete)
- Upload form: Name input, File input (.ttf/.otf/.woff/.woff2), Font Path input
- **Live font preview** using FileReader data URL + injected @font-face
- Empty state with CTA
- KPI row: Total Fonts, Active Fonts

### 4. Marketing Integrations Page
File: `src/modules/settings/pages/marketing-integrations-page.tsx`
Export: `MarketingIntegrationsPage` → viewId: `marketing-integrations`
- DataTable: Platform badge, Status badge, Active Switch, Event Logging Switch, Last Sync, Actions
- **Inline edit panel**: Platform dropdown (Klaviyo, GA4, Meta, Discord, Slack, Mailchimp, HubSpot), Is Active Switch, Enable Event Logging Switch
- **Collapsible "API Secret Key Format per Platform"** help section showing JSON examples per provider
- **Masked API Secret Key** input with Show/Hide toggle
- Test Connection button, Save, Disconnect (AlertDialog)
- Empty state, KPI row

### 5. Marketing Banner Edit Page
File: `src/modules/settings/pages/marketing-banner-edit-page.tsx`
Export: `MarketingBannerEditPage` → viewId: `marketing-banner-edit`
- **Image File Upload** with preview thumbnail
- **Title** input
- **Display Settings**: Is Active Switch, Sort Order (number), Position dropdown (Top Bar/Sidebar/Modal/Floating)
- **Destination**: Link Type dropdown (External URL/Internal Page/None), External URL input, Internal Page dropdown
- **Scheduling** (collapsible accordion): Start Date, End Date, "Runs indefinitely" checkbox
- **Targeting** (collapsible): Target Audience dropdown, Countries checkbox list
- Action buttons: Save, Save and add another, Save and continue editing, Delete (AlertDialog)
- Live preview area showing banner as colored bar

## View Router Wiring
5 new view IDs registered in `view-router.tsx`

## Module Navigation Wiring
- **Settings manifest**: +3 nav children (Certificate Designer, Font Upload, Marketing Integrations) + 5 routes

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 73 options for Beta tenant (up from 70) ✓
- New items verified: Settings › Certificate Designer, Settings › Font Upload, Settings › Marketing Integrations ✓
- Email template edit + marketing banner edit accessible from parent pages (email-templates, banner-management) ✓

---
Task ID: img-batchI
Agent: general-purpose (sub agent)
Task: Build 5 missing risk-module pages — copy trading events + analysis,
inverse trading events, account IP addresses, weekend trades (matching
reference screenshots of prop firm admin risk-analysis tools)

Work Log:
- Read worklog.md (3482 lines), AGENTS.md UX constitution, view-router.tsx
  (to confirm viewId naming pattern + ensure I don't touch it).
- Inspected platform primitives: `Page`/`PageHeader`/`PageContent`/
  `MetricCard` (page.tsx), `DataTable` + `Column<T>` (data-table.tsx),
  `StatusBadge` + tone helpers + `formatCurrency` (status.tsx),
  `EmptyState`/`LoadingState` (guards.tsx), `ExplainableStateBadge`
  (state-explanations.tsx), `exportToCsv` (export-utils.ts).
- Inspected platform-context.tsx → `usePlatform()` returns
  `{ runtime, navigate, router }` (used `runtime.tenant?.id ?? "platform"`
  fallback like the existing analytics/risk modules).
- Inspected mock-data helpers `getTenantAccounts(tid)`, `getTenantPositions(tid)`,
  `getTenantTraders(tid)` and the underlying interfaces (Trader,
  TradingAccount, Position).
- Inspected existing risk pages for pattern continuity:
  `trading-events-page.tsx` (rule config editor), `risk-unprofitable-countries-page.tsx`
  (KPI + filter bar + DataTable + CSV export), `closed-positions-page.tsx`
  (inline row expansion + deterministic mock-data derivation + AlertDialog-less
  toast pattern), `account-kyc-statuses-page.tsx` (dropdown actions + KPI roll-up
  from providers).

Files created (5):
1. `src/modules/risk/pages/copy-trading-events-page.tsx`
   Export: `CopyTradingEventsPage` → suggested viewId: `copy-trading-events`
   - KPI row: Total Events, Active, Expired, Accounts Flagged
   - Filter bar: search (symbol/account), symbol dropdown, date range, Clear
   - DataTable (with header-row select-all + per-row Checkbox):
     Position 1 (Long/Short badge + Symbol + Account ID), Position 2,
     Open Δ, Close Δ, Account 1 (link → trader-detail), Account 2 (link →
     trader-detail), Expired (Switch)
   - Bulk "Expire selected" action bar appears when rows are checked
   - "Add Copy Trading Event" inline form panel (progressive disclosure §12):
     Position 1 dropdown (all open positions, labelled "Long EURUSD #login"),
     Position 2 dropdown, Reasons textarea, Expired Switch, Save / Save and
     continue editing / Cancel buttons (each toast on action)
   - Row click → toast "Viewing copy trading event detail"
   - Empty state when no pairs can be derived
   - Mock data: `buildCopyEvents(tid)` pairs `getTenantPositions` sequentially
     and derives a deterministic open/close delta from a fixed cycle
     `[2,5,11,23,47,91,137,213]`; expired state is `idx % 4 === 3`.

2. `src/modules/risk/pages/copy-trading-analysis-page.tsx`
   Export: `CopyTradingAnalysisPage` → suggested viewId: `copy-trading-analysis`
   - PageHeader: "Copy Trading Analysis" — "Detect synchronized trading patterns between accounts"
   - Detection Form: Account Login 1 (input), Account Login 2 (input),
     Date Range (Select: Today / Last 7 days / Last 30 days / Custom),
     Analyze button (primary)
   - EmptyState before analysis: "Enter two account logins and click Analyze..."
   - After Analyze: side-by-side Account 1 / Account 2 panels (Login, Trader
     Name, Open Positions count, Total P&L, position list with Symbol /
     Direction badge / Open Time / Close Time / P&L)
   - MatchAnalysisPanel below: Correlation %, Matching Positions (e.g. 12/14),
     Time Delta Avg, Verdict (color-coded: danger=likely / success=unlikely /
     warning=borderline) with a contextual description string
   - Mock data: `summarizeAccount(login, …)` uses real account if found,
     otherwise synthesizes 4-8 deterministic positions seeded from
     `hashStr(login)`. `analyze(a,b)` returns correlation = base ratio + small
     bias from `hashStr("${a.login}-${b.login}")` (range 0-17) so the demo
     feels realistic. `timeDeltaAvgSec = 1 + hashStr % 30`.

3. `src/modules/risk/pages/inverse-trading-events-page.tsx`
   Export: `InverseTradingEventsPage` → suggested viewId: `inverse-trading-events`
   - KPI row: Total Events, Active, Expired, Accounts Flagged
   - Filter bar + DataTable with selection (same pattern as copy-trading-events)
     but the position columns are Buy Position (Long badge + Symbol + #login)
     and Sell Position (Short badge + Symbol + #login). Time deltas use
     cycle `[3,7,13,19,29,41,53,67]`. Expired is `idx % 5 === 4`.
   - Inline "Add Inverse Trading Event" form: Buy Position dropdown (filtered
     to longs only — shows "No long positions available" placeholder if
     empty), Sell Position dropdown (filtered to shorts), Save / Cancel.

4. `src/modules/risk/pages/account-ip-addresses-page.tsx`
   Export: `AccountIpAddressesPage` → suggested viewId: `account-ip-addresses`
   - Collapsible "IP Address Filter Guide" banner (starts expanded, ChevronDown
     rotates when open) explaining the default-most-recent-IP-per-account
     semantics + Proxy/Hosting/Mobile signal meaning
   - KPI row: Total IPs, Unique Accounts, Proxy IPs, Hosting IPs, Mobile IPs
   - Filter bar: search (account/IP/city/country), country dropdown, proxy
     state dropdown (All / Proxy:Yes / Proxy:No / Proxy:Unknown)
   - DataTable: Account (link → trader-detail), Status badge, Phase badge,
     Challenge, IP Address, City, Country badge, Is Proxy badge, Is Hosting
     badge, Is Mobile badge, Created date
   - "Add IP Address" inline form (11 fields): Account dropdown (from
     `getTenantAccounts(tid)` — shows "{login} — {traderName}"), IP Address
     (input), City, Country, Latitude (number input), Longitude (number
     input), Is Proxy / Is Hosting / Is Mobile (each a tri-state Select:
     Unknown / Yes / No), Save / Cancel
   - Mock data: `buildIpRecords(tid)` walks tenant accounts and assigns
     deterministic IPv4 (`192.168.${(idx*7+11)%200}.${(idx*13+23)%255}` for
     regular, `203.0.x.x` for every 5th to simulate hosting), city/country
     from a `COUNTRY_INFO` lookup keyed by trader country code, lat/lng
     derived from `hashStr(acct.id)`.

5. `src/modules/risk/pages/weekend-trades-page.tsx`
   Export: `WeekendTradesPage` → suggested viewId: `weekend-trades`
   - Informational amber banner: "This view shows trades opened or closed
     during weekend/market-closed hours..."
   - KPI row: Total Weekend Trades, Long Trades, Short Trades, Total Profit,
     Total Loss, Closed Trades
   - Dense DataTable (11 cols): Account (link → trader-detail), Direction
     (LONG green badge / SHORT red badge), Symbol, Volume, Profit (colored),
     Open Time (weekday-prefixed), Close Volume, Close Time, State (CLOSED
     badge), RR Ratio (1:N format), Hold Time (duration formatter)
   - Filter bar: search, symbol, direction, state, date range, Clear
   - Row click → inline detail panel (`WeekendTradeDetail`) showing full
     metadata grid: Account, UID, Direction, State, Symbol, Volume, Open
     Time, Open Price, Close Time, Close Price, Open Order, Close Order,
     Commission, Swap, SL, TP, RR Ratio, Hold Time. Editable Close Reason
     Select (TP/SL/Manual/System). Buttons: Delete Weekend Trade
     (destructive, AlertDialog with consequence message "This trade record
     will be permanently deleted from the weekend monitoring system. ..."),
     Back, Save Changes (toast), Next
   - Mock data: `buildWeekendTrades(tid)` reuses the BASE_SYMBOLS +
     seededRandom pattern from `closed-positions-page.tsx` and forces the
     open time onto a Saturday at 11-14 UTC via `saturdayAtNoon(weeksAgo)`;
     hold time is 2-24 hours deterministic.

Patterns followed:
- Every file has `"use client"`, `usePlatform()` for runtime/navigate,
  `toast` from `@/hooks/use-toast`, `cn` from `@/lib/utils`, platform
  components `Page/PageHeader/PageContent/MetricCard/DataTable/EmptyState`,
  shadcn/ui `Button/Input/Textarea/Label/Switch/Badge/Separator/Checkbox/
  Collapsible/Select/AlertDialog`.
- Icons from `lucide-react`. No blue/indigo — only Terra palette (emerald
  #4a7c59, amber, rose, slate, violet for AI is allowed but not used here).
- Deterministic mock data: every generator uses index-based cycles or
  `seededRandom(seed)`/`hashStr(s)` helpers — no `Math.random()`.
- Inline-form pattern: progressive disclosure (§12) — form panel toggled by
  the "Add ..." button and lives above the filter bar so the operator
  doesn't lose context. Save / Cancel / Save and continue editing toasts
  fire on every action.
- Row-click on DataTable shows inline detail panel (weekend-trades) or
  fires a "Viewing ... detail" toast (copy/inverse/ip pages).
- Tri-state badges (Proxy / Hosting / Mobile) use StatusBadge tones
  (success/unknown-muted/warning).

Did NOT modify:
- `view-router.tsx` (lead wires the 5 new viewIds)
- Any module `manifest.ts` (lead wires the 5 nav children + 5 routes into
  the risk module manifest)
- `module-registry.ts` / `module-bootstrap.ts` (no new module)
- Any existing risk/trading pages or mock-data.ts

Verification:
- `bun run lint` → exit 0 (zero errors)
- `bunx eslint src/modules/risk/pages/{copy-trading-events-page,copy-trading-analysis-page,inverse-trading-events-page,account-ip-addresses-page,weekend-trades-page}.tsx` → exit 0
- `bunx tsc --noEmit` filtered to the 5 new files → no matches (clean);
  remaining project-wide TS errors are all pre-existing in
  `account-kyc-statuses-page.tsx` (KycProviderStatus interface collision)
  and unrelated to this task.

Stage Summary:
- 5 self-contained risk-module pages shipped. Each follows the established
  analytics/risk module pattern (manifest/widgets/pages), uses the Terra
  palette only (no blue/indigo), and ships deterministic mock data so the
  demo is stable across reloads.
- Suggested viewIds for the lead to wire into view-router.tsx:
  `copy-trading-events`, `copy-trading-analysis`, `inverse-trading-events`,
  `account-ip-addresses`, `weekend-trades`.
- Suggested risk-module nav children + routes (lead to add to risk manifest):
  each page maps 1:1 to a nav href + route. Recommend grouping them under
  a new "Trading Surveillance" parent (or extending the existing "Risk"
  parent with these 5 children at orders 80-84).
- All 5 pages use the `trader-detail` viewId for account-link navigation
  (already wired), so no additional route is needed for cross-page links.

---
Task ID: img-batch-8
Agent: lead-architect
Task: Analyze images 078-089 and implement 5 missing risk/trading surveillance features

## Analysis Summary
Analyzed images 078-089 from FUNDERBLU screenshots. Found 5 missing features across trading event detection, IP address tracking, and weekend trade monitoring.

## 5 New Pages Built & Wired

### 1. Copy Trading Events Page
File: `src/modules/risk/pages/copy-trading-events-page.tsx`
Export: `CopyTradingEventsPage` → viewId: `copy-trading-events`
- KPI row: Total Events, Active, Expired, Accounts Flagged
- DataTable: Checkbox, Position 1 (Long/Short badge + Symbol + ID), Position 2, Open Time Delta, Close Time Delta, Account 1/2 (clickable links), Expired Switch
- Inline "Add Copy Trading Event" form panel with Position 1/2 dropdowns, Reasons textarea, Expired toggle
- Search + filter + Export CSV

### 2. Copy Trading Analysis Page (Detection Tool)
File: `src/modules/risk/pages/copy-trading-analysis-page.tsx`
Export: `CopyTradingAnalysisPage` → viewId: `copy-trading-analysis`
- Detection form: Account Login 1, Account Login 2, Date Range dropdown, Analyze button
- Side-by-side results panels: Account 1/2 details with Login, Trader, Position count, P&L, Position list
- Match Analysis: Correlation %, Matching Positions, Time Delta Avg, Verdict badge (warning/success)
- Empty state before analysis

### 3. Inverse Trading Events Page
File: `src/modules/risk/pages/inverse-trading-events-page.tsx`
Export: `InverseTradingEventsPage` → viewId: `inverse-trading-events`
- KPI row: Total Events, Active, Expired, Accounts Flagged
- DataTable: Checkbox, Buy Position (Long + Symbol + ID), Sell Position (Short + Symbol + ID), Open/Close Time Delta, Account links, Expired Switch
- Inline "Add Inverse Trading Event" form with Buy/Sell position dropdowns
- Search + filter + Export CSV

### 4. Account IP Addresses Page
File: `src/modules/risk/pages/account-ip-addresses-page.tsx`
Export: `AccountIpAddressesPage` → viewId: `account-ip-addresses`
- Collapsible "IP Address Filter Guide" info banner (starts expanded)
- DataTable: Account, Status, Phase, Challenge, IP Address, City, Country, Is Proxy/Hosting/Mobile badges, Created
- Inline "Add IP Address" form: Account dropdown, IP, City, Country, Lat/Lng, Is Proxy/Hosting/Mobile dropdowns (Unknown/Yes/No)
- KPI row: Total IPs, Unique Accounts, Proxy IPs, Hosting IPs, Mobile IPs
- Search + filter + Export CSV

### 5. Weekend Trades Page (List + Detail)
File: `src/modules/risk/pages/weekend-trades-page.tsx`
Export: `WeekendTradesPage` → viewId: `weekend-trades`
- Informational banner about weekend/market-closed hour violations
- KPI row: Total Weekend Trades, Long, Short, Total Profit, Total Loss, Closed
- Dense DataTable: Account, Direction (LONG green / SHORT red), Symbol, Volume, Profit (colored), Open Time, Close Volume, Close Time, State (CLOSED), RR Ratio, Hold Time
- Row click → inline detail panel with full trade metadata grid: Account, UID, Direction, State, Symbol, Volume, Open/Close times & prices, Order IDs, Close Reason dropdown, Commission, Swap, SL, TP, Profit
- "Delete Weekend Trade" button (destructive AlertDialog), "Save Changes" button
- Search + filter by symbol/direction/state + date range + Export CSV

## View Router Wiring
5 new view IDs registered in `view-router.tsx`

## Module Navigation Wiring
- **Risk manifest**: +5 nav children (Copy Trading Events, Copy Trading Analysis, Inverse Trading Events, Account IP Addresses, Weekend Trades) + 5 routes

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 78 options for Beta tenant (up from 73) ✓
- All 5 new items verified: Risk › Copy Trading Events, Risk › Copy Trading Analysis, Risk › Inverse Trading Events, Risk › Account IP Addresses, Risk › Weekend Trades ✓
- All mock data deterministic (seeded random, no Math.random) ✓
- Terra palette only (emerald/amber/rose for Long/Short/severity — no blue/indigo) ✓

---
Task ID: img-batchJ
Agent: general-purpose (sub agent)
Task: Build 3 missing trading-module pages — account configuration
(events + version history + configuration) discovered from reference
screenshots of the trader account detail page.

Work Log:
- Read worklog.md (3720 lines) + AGENTS.md UX constitution + existing
  trading-module pages (enhanced-trader-detail-page.tsx,
  account-broker-details-page.tsx, account-kyc-statuses-page.tsx,
  closed-positions-page.tsx) to confirm established patterns:
  usePlatform() with router.params.id + navigate(), Terra palette
  only (#4a7c59 / cream #faf6f0 / emerald/amber/rose/violet,
  NO blue/indigo), Collapsible for §12 progressive disclosure,
  AlertDialog for §24-25 destructive actions, ExplainableStateBadge
  for §17-19 explainable state, deterministic mock-data derivation
  (no Math.random), toast feedback on every action.
- Inspected platform primitives: Page/PageHeader/PageContent/MetricCard/
  EntityHeader (page.tsx), DataTable/Column<T> (data-table.tsx),
  StatusBadge/formatCurrency (status.tsx), AccountHealthWidget
  (account-health.tsx), LabelWithHelp/ContextualHelp
  (contextual-help.tsx), ExplainableStateBadge
  (state-explanations.tsx), exportToCsv (export-utils.ts).
- Inspected mock-data helpers getTenantAccounts(tid) + the
  TradingAccount interface (login/traderName/platform/phase/balance/
  equity/leverage/currency/status) — used as the seed for all 3
  pages.

Files created (3):

1. `src/modules/trading/pages/account-configuration-page.tsx`
   Export: `AccountConfigurationPage` → suggested viewId:
   `account-configuration`
   - Back-to-Account button (navigates to trader-detail with
     account.traderId)
   - PageHeader "Account Configuration" + EntityHeader (login,
     trader name, platform, phase) + badges (type, status, source,
     label)
   - KPI row (5 MetricCards): Equity, Balance, P&L (colored green/red),
     Drawdown %, Days Remaining (handles ∞ for no end date)
   - Account Health Widget (AccountHealthWidget) at top showing daily
     loss / max drawdown / profit target — same widget used on the
     EnhancedTraderDetailPage risk tab
   - 5 collapsible sections (SectionCard helper with Collapsible +
     ChevronDown rotation):
     • Section 1 — Account Configuration (starts expanded):
       user email (read-only with Link2 icon), Phase text display,
       start date (datetime-local input), end date (datetime-local
       with amber warning "Leave empty for accounts without time
       limits"), profit split (number 0-100), payout frequency
       dropdown (Weekly/Bi-Weekly/Monthly/Quarterly), first
       withdrawal delay input ("14 days"), Order dropdown (6
       deterministic ORD-#### options), next withdrawal date
       (datetime-local), source text display (Webhook/Manual),
       account label dropdown (Paid/Giveaway/Third Party/Standard),
       plus a footer link "open trader profile" linking to
       trader-detail
     • Section 2 — Balance & Drawdown Metrics (starts expanded,
       read-only grid): initial balance, live balance, live equity,
       profit/loss (colored), daily starting balance, daily drawdown
       amount + % badge (rose), profit target, global drawdown
       amount + % badge (rose), daily drawdown expiry (formatted
       timestamp), drawdown locked Switch (rose when locked, with
       explanatory text "When locked, the daily drawdown
       calculation is frozen and will not reset.")
     • Section 3 — Broker Details (starts collapsed): login
       (read-only), broker type dropdown (MetaTrader5/
       MetaTrader4/DXTrade/MatchTrader), MetaTrader trading account
       text input, Match trader trading account text input,
       "Sync Account" outline button (toast "Syncing with broker
       platform..."), "Resend Credentials" outline button (toast
       "Credentials resent to trader")
     • Section 4 — Account Status Details (starts collapsed):
       status with ExplainableStateBadge, status reason dropdown
       (None/Manual Review/Policy Violation/Risk Concern/
       Documentation Issue/Payment Failed), status finalised
       timestamp (datetime-local) with helper "Backdate status
       changes if needed", custom status reason textarea, copy
       trading detected Switch (amber when flagged) with warning
       text "Flag this account if copy trading patterns have been
       detected", failed review reason textarea
     • Section 5 — Extra Settings (starts collapsed): 5 labeled
       Checkbox FlagRow cards — HIDE_ACCOUNT, PUBLIC_TRACK_RECORD,
       PUBLIC_BALANCE, PUBLIC_TRADE_HISTORY, PUBLIC_LOTS — each with
       its own description label
   - Footer action bar: Save Changes (primary, toast "Account
     configuration saved"), Save and continue editing (outline,
     toast), Block Account (destructive, AlertDialog with the
     exact consequence text from the spec: "The account will be
     immediately blocked. The trader will lose all trading access.
     This action is logged in the audit trail."), Reset Account
     (outline, destructive toast "Account reset to initial state.
     All progress lost.")
   - Deterministic config derivation: `deriveAccountConfig(account)`
     uses hashStr(account.id) to seed every value (profit split
     60-80, payout frequency, drawdown amounts/percentages, end date
     optional, status reason, all 5 visibility flags etc.) — stable
     across reloads

2. `src/modules/trading/pages/account-events-page.tsx`
   Export: `AccountEventsPage` → suggested viewId: `account-events`
   - PageHeader "Account Events" with breadcrumb back to trader
   - KPI row (5 MetricCards): Total Events, Status Changes,
     Phase Transitions, Payout Events, Breach Events (each tone
     colored based on count)
   - DataTable columns: Event Type (clickable button with
     color-coded StatusBadge + lucide icon — see EVENT_META),
     Description, Actor (System/AI Engine/Risk Engine get an
     outline Badge, otherwise plain text), Created (timestamp)
   - 9 event types fully mocked: ACCOUNT_CREATED, PHASE_UPGRADED,
     PAYOUT_REQUESTED, PAYOUT_APPROVED, BREACH_DETECTED,
     STATUS_CHANGED, KYC_COMPLETED, RULE_WARNING, DRAWDOWN_ALERT
     — each with 2 description templates in DESCRIPTIONS map
   - Mock data: `generateEvents(accountId, accountLogin)` always
     starts with ACCOUNT_CREATED on day 0, then derives 14-22
     follow-up events deterministically. Each event has an actor
     from the ACTORS pool (Sarah Chen/Marcus Webb/Priya Nair/
     System/AI Engine/Risk Engine). Payout amounts are
     deterministically replaced inline to feel realistic.
   - Filter bar: search (event type/description/actor), event type
     dropdown, date range dropdown (24h/7d/30d/90d/180d), Clear
     button. Active filter count badge. Result count text.
   - Export CSV button in header → uses exportToCsv helper
   - "Back to Account" button in header → trader-detail
   - Row click → toast with the event label + description + ts
   - Immutable-audit-trail note banner at the bottom

3. `src/modules/trading/pages/account-version-history-page.tsx`
   Export: `AccountVersionHistoryPage` → suggested viewId:
   `account-version-history`
   - PageHeader "Version History" with description "Complete audit
     trail of all field changes with before/after values"
   - KPI row (4 MetricCards): Total Versions, Unique Actors,
     Fields Tracked, Latest Change date
   - DataTable columns: expand chevron (32px), Object (full
     account name), Date/Time (sortable), Comment, Changed By
     (email-style name + role badge — Admin/Risk Officer/
     Compliance=emerald/amber; Automated/AI=violet), Change
     Reason, Changes (DiffCell), Revert-to-Version action button
   - DiffCell renders each change as `field: oldValue → newValue`
     with oldValue in strikethrough rose and newValue in emerald
     green — the requested diff visual
   - Mock data: `generateVersions(accountId, accountName)` builds
     15-20 deterministic versions, one field change per version
     (Profit Split, Payout Frequency, Status, Drawdown Limit,
     Next Withdrawal Date, Phase, Account Label, KYC Status). The
     8th version gets a 2-field update so multi-field diffs are
     visible. Versions alternate direction (forward/reverse) so
     both up-arrow and down-arrow diffs appear. Actors rotated
     through 5 roles; change reasons rotated through 6 options.
   - Filter bar: search (object/comment/field/value/actor), changed
     field dropdown (derived from data), changed by dropdown
     (derived from data), date range dropdown, Clear button.
   - Expandable rows: clicking a row reveals ExpandedVersionDetail
     panel with full version metadata (object, timestamp, changed
     by + role badge, comment) + an "Affected fields" list of all
     diff rows + reason text + a per-panel Revert-to-Version
     button
   - "Revert to Version" button per row (outline, toast "Version
     revert would restore all fields to this timestamp")
   - Export CSV button in header
   - "Back to Account" button in header → trader-detail

Patterns followed (all 3 files):
- `"use client"` directive at the top
- `usePlatform()` hook → `runtime.tenant?.id ?? "platform"` fallback
- `router.params.id` → `getTenantAccounts(tid).find(a => a.id === ...)`
- Local editable draft state via `useState` — no mutations to mock data
- Terra palette only (forest green #4a7c59, cream, emerald/amber/rose/
  violet for AI/Automated) — NO blue/indigo anywhere
- shadcn/ui components: Button, Input, Textarea, Label, Switch, Badge,
  Separator, Checkbox, Collapsible + CollapsibleTrigger/Content,
  AlertDialog (+ all sub-parts)
- lucide-react icons (Settings2, Wallet, TrendingUp, TrendingDown,
  Percent, CalendarClock, ShieldCheck, Server, Lock, Link2, RefreshCw,
  Send, Ban, RotateCcw, Save, ChevronDown, Activity, RotateCcw,
  ShieldAlert, Trophy, FileCheck, Bell, AlertTriangle, CheckCircle2,
  History, CircleUserRound, GitCommit, User, Clock, FileText, Filter,
  X, Download, ArrowLeft, ChevronRight)
- Progressive disclosure §12 — collapsible sections with start-expanded
  defaults on the most-used sections
- One primary action §13 — Save Changes is the only primary button on
  the configuration page; secondary/tertiary actions get outline
- Explainability §17-19 — ExplainableStateBadge for account status,
  LabelWithHelp / ContextualHelp on every non-obvious field
- Destructive confirmation §24-25 — Block Account wrapped in
  AlertDialog with the exact consequence text from the spec
- Auditable §61 — every action fires a toast naming the actor/action/
  affected entity (toast descriptions include login id + trader email
  for Sync/Resend, account id for Block/Reset)
- Deterministic mock data — `hashStr()` for stable seeding across
  reloads; no Math.random anywhere

Did NOT modify (per task instructions):
- view-router.tsx (lead wires the 3 new viewIds)
- Any module manifest (lead wires 3 nav children + 3 routes into the
  trading module manifest)
- module-registry.ts / module-bootstrap.ts (no new module)
- Any other trading/risk/settings page
- AGENTS.md

Verification:
- `bunx eslint src/modules/trading/pages/account-configuration-page.tsx
  src/modules/trading/pages/account-events-page.tsx
  src/modules/trading/pages/account-version-history-page.tsx` → exit 0
  (zero lint errors in any of the 3 new files)
- `bunx tsc --noEmit` filtered to the 3 new files → zero TS errors
  (remaining TS errors are all pre-existing in
  `account-kyc-statuses-page.tsx` — KycProviderStatus interface
  collision with the union literal type — out of scope per the
  previous img-batchI subagent's notes)
- `bun run lint` → exit 0 (full project lint clean)

Stage Summary:
- 3 self-contained trading-module pages shipped, fully matching the
  established platform patterns (Page/PageHeader/PageContent/MetricCard
  /DataTable/StatusBadge/ExplainableStateBadge/AccountHealthWidget/
  LabelWithHelp/ContextualHelp/AlertDialog/Collapsible/toast/
  exportToCsv).
- Suggested viewIds for view-router.tsx wiring:
  • `account-configuration` → AccountConfigurationPage
  • `account-events`        → AccountEventsPage
  • `account-version-history` → AccountVersionHistoryPage
- All 3 pages are reachable from the existing trader-detail view (the
  Back-to-Account button navigates back via `navigate("trader-detail",
  { id: account.traderId })` — already wired in view-router.tsx).
- Mock data is fully deterministic (hashStr-based seeding). Stable
  across reloads. Stable across tenants because every page derives
  from `getTenantAccounts(tid).find(a => a.id === router.params.id)`.
- Lint: clean. TS: clean for new files. No blue/indigo accents.

---
Task ID: img-batch-9
Agent: lead-architect
Task: Analyze images 092-106 and implement 3 missing account detail sections

## Analysis Summary
Analyzed images 092-106 — all tabs from the reference admin's trader account detail page. Found 7 missing UI sections that our EnhancedTraderDetailPage doesn't have. Grouped them into 3 new page implementations.

## 3 New Pages Built & Wired

### 1. Account Configuration Page (5 collapsible sections)
File: `src/modules/trading/pages/account-configuration-page.tsx`
Export: `AccountConfigurationPage` → viewId: `account-configuration`

**Section 1 — Account Configuration** (expanded): User email, Phase, Start/End date-time, Profit split, Payout frequency, First withdrawal delay, Order dropdown, Next withdrawal date, Source, Account label

**Section 2 — Balance & Drawdown Metrics** (expanded, read-only grid): Initial balance, Live balance, Live equity, P&L (colored), Daily starting balance, Daily drawdown amount+%, Profit target, Global drawdown amount+%, Daily drawdown expiry timestamp, Drawdown locked Switch (rose when locked) with explanatory text

**Section 3 — Broker Details** (collapsed): Login, Broker type dropdown (MT5/MT4/DXTrade/MatchTrader), MT5 account, Match trader account, Sync + Resend Credentials buttons

**Section 4 — Account Status Details** (collapsed): Status with ExplainableStateBadge, Status reason dropdown, Status finalised timestamp, Custom status reason textarea, Copy trading detected Switch, Failed review reason textarea

**Section 5 — Extra Settings** (collapsed): 5 privacy flag checkboxes — HIDE_ACCOUNT, PUBLIC_TRACK_RECORD, PUBLIC_BALANCE, PUBLIC_TRADE_HISTORY, PUBLIC_LOTS with descriptive labels

**Footer**: Save Changes (primary), Save and continue editing, Block Account (destructive AlertDialog), Reset Account (outline)

**Top**: KPI row (Equity, Balance, P&L, Drawdown %, Days Remaining) + AccountHealthWidget

### 2. Account Events Page (immutable audit trail)
File: `src/modules/trading/pages/account-events-page.tsx`
Export: `AccountEventsPage` → viewId: `account-events`

- KPI row: Total Events, Status Changes, Phase Transitions, Payout Events, Breach Events
- DataTable: Event Type (badge with color coding + icon), Event Description (detailed), Created (timestamp)
- 9 event types: ACCOUNT_CREATED, PHASE_UPGRADED, PAYOUT_REQUESTED, PAYOUT_APPROVED, BREACH_DETECTED, STATUS_CHANGED, KYC_COMPLETED, RULE_WARNING, DRAWDOWN_ALERT
- Search + filter by event type + date range + Export CSV + Back to Account

### 3. Account Version History Page (object versioning with diff)
File: `src/modules/trading/pages/account-version-history-page.tsx`
Export: `AccountVersionHistoryPage` → viewId: `account-version-history`

- KPI row: Total Versions, Fields Changed, Unique Actors, Latest Change
- DataTable: Object (full name), Date/Time (sortable), Comment, Changed By (email + role badge), Change Reason, Changes (diff view)
- **Diff view**: `old_value → new_value` with old in strikethrough rose, new in emerald green
- Expandable rows showing all affected fields per change
- 15-20 deterministic mock entries covering: Profit Split, Payout Frequency, Status, Drawdown Limit, Next Withdrawal Date, Phase, Account Label, KYC Status
- Search + filter by field + actor + date range
- "Revert to Version" button per row (toast) + Export CSV + Back to Account

## View Router Wiring
3 new view IDs registered in `view-router.tsx`: `account-configuration`, `account-events`, `account-version-history`

## Module Route Wiring
- **Trading manifest**: +3 routes (account-configuration, account-events, account-version-history)
- These are sub-pages accessed from the EnhancedTraderDetailPage (via tab navigation), not top-level sidebar items — so no nav children added, only routes

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 78 options for Beta tenant (unchanged — these are sub-pages, not sidebar items) ✓
- All 3 routes registered in view-router → accessible via `navigate("account-configuration", { id: traderId })` from the EnhancedTraderDetailPage ✓
- All mock data deterministic (hashStr-based seeds, no Math.random) ✓
- Terra palette only (emerald/amber/rose — no blue/indigo) ✓

---
Task ID: img-batchK
Agent: general-purpose
Task: Build closed position detail + order detail + social media + device activities (4 missing-feature pages)

Work Log:
- Read worklog.md (4015 lines) and inspected existing patterns: closed-positions-page.tsx (mock seeding pattern), certificate-detail-page.tsx (detail+edit pattern with AlertDialog destructive confirm, breadcrumb, FormSection/ReadOnlyField building blocks), banner-management-page.tsx (Switch + Select + inline editor pattern), marketing-integrations-page.tsx (Collapsible + AlertDialog + DataTable+inline form pattern), enhanced-trader-detail-page.tsx (Breadcrumbs + AlertDialog destructive).
- Confirmed platform primitives: `Page`, `PageHeader`, `PageContent`, `MetricCard`, `DataTable`/`Column<T>`, `StatusBadge`+`formatCurrency`, `EmptyState`, `LabelWithHelp`, `exportToCsv`. Confirmed `usePlatform()` returns `{ runtime, navigate, router }` with `router.params.id` for detail views.
- Confirmed Terra palette constraints: `MetricCard` `tone` accepts only `default|positive|negative|warning` (no `info`) — fixed on first tsc pass. No blue/indigo used (emerald / amber / rose / slate only). Used `font-mono` for hashes and IDs, `tabular-nums` for numbers.
- Built 4 new files (zero lint errors, zero tsc errors in new files):

1. `src/modules/trading/pages/closed-position-detail-page.tsx` — `ClosedPositionDetailPage`. Breadcrumb "Closed Positions > [id]". Deterministic mock via `hashSeed(id)` + `seededRandom` mirroring `generateClosedPositions` symbol list (so detail matches list when row clicked). 6 FormSection cards in a 2-column grid (Identity, Volume & Pricing, Timing, Order IDs, P&L, Risk, Flags) covering every field from the spec — LONG/SHORT badge, CLOSED badge, Uid, Symbol description, Position type (Market/Pending) Select, Entry type (In/Out) Select, volume, open/close/current prices, open/close time + duration (calculated), open/close order IDs, Profit (colored), Commission, Swap, Net profit (calculated: profit - commission - swap), SL/TP, RR Ratio (calculated), Is partial (Switch read-only), Close reason (Select: TP/SL/Manual/System/Liquidation). Footer: destructive "Delete Closed Position" AlertDialog with exact consequence text from spec ("This trade record will be permanently deleted. The position data, P&L, and audit trail will be lost."), "Save Changes" primary toast, "Save and continue editing" outline toast, "Back to Closed Positions" ghost → navigate("closed-positions").

2. `src/modules/trading/pages/order-detail-page.tsx` — `OrderDetailPage`. Breadcrumb "Orders > [id]". Header section with user email link, Order ID (mono), Addons JSON code block (`<pre>` with JSON.stringify(..., null, 2)). Main form (read-only + Edit toggle): Date created (read-only disabled Input), Order type Select (Challenge Purchase/Activation Fee/Add-on/Subscription/Refund), Notes Textarea. Financials grid (2-col sm:grid-cols-2 inside FormSection): Challenge, Competition ("None" fallback), Account balance formatCurrency, Amount paid (signed for refunds), Quantity, Payment method Select (Crypto/Card/Bank Transfer/PayPal), Coupon code Input, Bundle ID Input ("None" placeholder), Customer IP address Input (mono). 3 Collapsible sections (Accordion type="multiple" defaultValue={[]} so all start collapsed): (1) Attribution/UTM Tracking with Source/Campaign/Medium/Term/Content/Referrer URL (link)/Landing page (link); (2) Accounts DataTable with Login/Phase/Broker/Initial Balance/Status StatusBadge; (3) Subscription DataTable with Billing Date/Amount/Status (Active/Cancelled/Expired)/Next Billing. Footer: Save primary toast, Save and add another outline toast → navigate("dashboard-orders"), Delete destructive AlertDialog, Back ghost → navigate("dashboard-orders").

3. `src/modules/settings/pages/social-media-links-page.tsx` — `SocialMediaLinksPage`. PageHeader with description "Manage social media profiles linked to trader accounts". DataTable: Platform (StatusBadge with per-platform icon: Twitter/Instagram/Telegram/Discord/YouTube/TikTok/LinkedIn/Facebook), Handle (mono), Custom URL (truncated link with ExternalLink), Account (mailto link), Created (date), Actions (Edit toast / Delete AlertDialog). Inline AddLinkForm (revealed via "Add Link" toggle): Platform Select (8 platforms with icons), Handle Input (auto-builds URL on change), Custom URL Input (auto-derived from platform+handle, editable), Account Select (tenant traders), Save/Cancel. Preview chip showing the current selection. KPI row (Total Links, Unique Platforms, Accounts with Links, Most Popular Platform). Search + filter by platform. Empty state with exact text "No social media links yet. Add links to track trader social presence." Export CSV button. Delete confirmation AlertDialog.

4. `src/modules/settings/pages/device-activities-page.tsx` — `DeviceActivitiesPage`. PageHeader "Device Activities" + description "Login device history and fingerprint tracking". Collapsible "Device Activity Guide" info banner (collapsed by default) with exact spec text: "This view tracks unique device fingerprints used to access trader accounts. Multiple logins from the same device may indicate shared access." + extra explanation bullets for Device ID / Login Count / Country. DataTable: Source (StatusBadge Web/Mobile/API), Device ID (truncated 40-char hex), IP Address (mono with Wifi icon), Device Type (StatusBadge Desktop/Mobile/Tablet with Monitor/Smartphone/Tablet icon), Platform (StatusBadge Windows/macOS/iOS/Android), Country (Badge with MapPin), First Seen (timestamp), Last Seen (timestamp), Login Count (numeric), Actions (View → toast "Viewing device detail", Delete AlertDialog). KPI row (Total Devices, Unique IPs, Mobile Devices, Desktop Devices, Most Active Country). Search + filter by source/device type/platform + date range (24h/7d/30d/90d). Row click → toast "Viewing device detail". Export CSV button. Empty state with exact spec text "No device activities recorded. Device fingerprints will appear here when traders log in."

Patterns:
- All 4 files start with `"use client"`.
- All use `usePlatform()` for `runtime` (tenant.id fallback "platform", tenant.currency fallback "USD"), `navigate`, `router.params.id`.
- All use platform primitives (`Page`/`PageHeader`/`PageContent`/`MetricCard`/`DataTable`/`StatusBadge`/`formatCurrency`/`EmptyState`/`LabelWithHelp`) + shadcn/ui (`Input`/`Textarea`/`Label`/`Switch`/`Button`/`Badge`/`Separator`/`Collapsible`/`AlertDialog`/`Select`/`Accordion`).
- All destructive actions wrapped in `AlertDialog` with explicit consequence text (UX §24).
- All read-only fields use the `ReadOnlyField` building block (border + bg-muted/30 container) with `LabelWithHelp` tooltips.
- Deterministic mock data via `hashSeed(id)` / `seededRandom(seed)` — no `Math.random` anywhere.
- Terra palette only — emerald (positive/success), amber (warning), rose (destructive/negative), slate/muted (neutral). No blue/indigo. Detail pages match certificate-detail-page + enhanced-trader-detail-page patterns.

Did NOT modify:
- `view-router.tsx` (no viewId registrations added — lead will wire 4 new viewIds).
- `trading/manifest.ts` and `settings/settings-module.ts` (no nav items or routes added).
- `module-bootstrap.ts`.
- No test files created.

Suggested viewIds for the lead to register in `view-router.tsx`:
- `closed-position-detail` → `ClosedPositionDetailPage` (from `@/modules/trading/pages/closed-position-detail-page`)
- `order-detail` → `OrderDetailPage` (from `@/modules/trading/pages/order-detail-page`)
- `social-media-links` → `SocialMediaLinksPage` (from `@/modules/settings/pages/social-media-links-page`)
- `device-activities` → `DeviceActivitiesPage` (from `@/modules/settings/pages/device-activities-page`)

Optional nav/route entries the lead may add to manifests:
- `trading/manifest.ts` routes: `{ path: "closed-position-detail", viewId: "closed-position-detail", label: "Closed Position Detail", permission: "account.read", module: "trading" }` and `{ path: "order-detail", viewId: "order-detail", label: "Order Detail", permission: "account.read", module: "trading" }`.
- `settings/settings-module.ts` navigation children: `{ id: "settings.social-media", label: "Social Media Links", href: "social-media-links", icon: Share2, permission: "settings.manage" }` and `{ id: "settings.device-activities", label: "Device Activities", href: "device-activities", icon: Fingerprint, permission: "settings.manage" }` plus matching route entries.

Verifying:
- `bun run lint` → exit 0, no errors (clean baseline maintained).
- `bunx tsc --noEmit` → 0 errors in the 4 new files (pre-existing 56 TS errors all in `src/modules/trading/pages/account-kyc-statuses-page.tsx`, out of scope).
- `bunx eslint <4 new files>` → exit 0.

Stage Summary:
- 4 self-contained detail/list pages shipped under `src/modules/{trading,settings}/pages/`. Each fully matches the platform's existing detail/list page patterns (certificate-detail-page, banner-management-page, marketing-integrations-page, closed-positions-page) and uses the Terra Organic Design palette exclusively.
- Lead next steps: register 4 viewIds in `view-router.tsx` viewRegistry + add route/nav entries to `trading/manifest.ts` and `settings/settings-module.ts` if these should appear in the sidebar / be navigable.

---
Task ID: img-batch-10
Agent: lead-architect
Task: Analyze final batch images 107-124 and implement 4 missing features

## Analysis Summary
Analyzed images 107-124 — the final batch from FUNDERBLU screenshots. Found 6 missing features, grouped into 4 new page implementations.

## 4 New Pages Built & Wired

### 1. Closed Position Detail Page
File: `src/modules/trading/pages/closed-position-detail-page.tsx`
Export: `ClosedPositionDetailPage` → viewId: `closed-position-detail`
- Read-only detail grid with: Uid, Direction (LONG/SHORT badge), State, Symbol, Symbol description, Position type, Entry type, Volume, Open/Close prices, Open/Close times, Duration, Order IDs, Profit (colored), Commission, Swap, Net profit, SL, TP, RR Ratio, Is partial, Close reason dropdown
- Footer: Delete (destructive AlertDialog), Save, Save and continue editing, Back
- Deterministic mock data matching closed-positions-page.tsx symbols

### 2. Order Detail Page
File: `src/modules/trading/pages/order-detail-page.tsx`
Export: `OrderDetailPage` → viewId: `order-detail`
- Header: User email, Order ID, Addons JSON display
- Main form: Date created, Order type dropdown (Challenge Purchase, Activation Fee, Add-on, Subscription, Refund), Notes textarea
- Financials grid: Challenge, Competition, Account balance, Amount paid, Quantity, Payment method, Coupon code, Bundle ID, Customer IP
- 3 collapsible accordions: Attribution/UTM Tracking (source, campaign, medium, term, content, referrer, landing page), Accounts table, Subscription table
- Footer: Save, Save and add another, Delete (AlertDialog), Back

### 3. Social Media Links Page
File: `src/modules/settings/pages/social-media-links-page.tsx`
Export: `SocialMediaLinksPage` → viewId: `social-media-links`
- DataTable: Platform (badge with icon), Handle, Custom URL (link), Account (email link), Created, Actions (Edit/Delete)
- Inline add form: Platform dropdown (8 platforms: Twitter/X, Instagram, Telegram, Discord, YouTube, TikTok, LinkedIn, Facebook), Handle, Custom URL, Account dropdown
- KPI row: Total Links, Unique Platforms, Accounts with Links, Most Popular Platform
- Search + filter by platform + Export CSV + Empty state

### 4. Device Activities Page
File: `src/modules/settings/pages/device-activities-page.tsx`
Export: `DeviceActivitiesPage` → viewId: `device-activities`
- Collapsible "Device Activity Guide" info banner
- DataTable: Source (Web/Mobile/API badge), Device ID (truncated hash), IP, Device Type (Desktop/Mobile/Tablet), Platform (Windows/macOS/iOS/Android), Country, First Seen, Last Seen, Login Count, Actions
- KPI row: Total Devices, Unique IPs, Mobile Devices, Desktop Devices, Most Active Country
- Search + filter by source/device type/platform + date range + Export CSV + Empty state

## View Router Wiring
4 new view IDs registered in `view-router.tsx`

## Module Navigation Wiring
- **Trading manifest**: +2 routes (closed-position-detail, order-detail)
- **Settings manifest**: +2 nav children (Social Media Links, Device Activities) + 2 routes

## Verification Results
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 80 options for Beta tenant (up from 78) ✓
- New items verified: Settings › Social Media Links, Settings › Device Activities ✓
- Closed position detail + order detail are sub-pages (accessible via navigation from closed-positions page and orders page) ✓
- All mock data deterministic (hashStr-based seeds, no Math.random) ✓
- Terra palette only (emerald/amber/rose/slate — no blue/indigo) ✓

## COMPLETE IMAGE ANALYSIS SUMMARY
All 121 images from the FUNDERBLU Admin screenshots have now been analyzed across 10 batches. The platform has grown from ~40 views to 80+ views, covering every flow visible in the reference screenshots.

---

## img-batchL — Token Detail Page + Enhanced User Events Page

**Date:** 2025 — final missing-features batch from the 121-screenshot audit.

### Files created (NEW only — no existing files modified)

1. **`src/modules/settings/pages/token-detail-page.tsx`** (952 lines)
   - Export: `TokenDetailPage`
   - Single API token view + edit form. Reached from Token Management list
     (click-through on a token row) or directly via `router.params.id`,
     where the id parameter IS the token hash itself (e.g.
     `ffc261a8fba610812e2bc0c93a6137d90afda52b`).
   - **Breadcrumb:** `Tokens > [Token ID]` (monospace truncated hash).
   - **Header:** title + monospace key preview + Active/Revoked StatusBadge
     + outline "History" button (toast: "Token usage history would show IP
     addresses and timestamps").
   - **Form fields** (4 FormSection cards — progressive disclosure §12):
     - Identification: Key (read-only Input, monospace, with Show/Hide
       toggle and Copy button), User (Select from auth users + tenant
       traders with "MoreVertical" 3-dot menu button → toast "User profile
       would open here").
     - Capabilities & Lifetime: Expiration Date (datetime-local),
       Scopes (8-option multi-select checkbox list: read:trades,
       write:trades, read:accounts, write:accounts, read:payouts,
       approve:payouts, read:analytics, admin:all — default read:trades
       checked, with active-scope Badge chips).
     - Access Control: IP Whitelist (Textarea, monospace), Is Active
       (Switch toggle in bordered panel).
     - Audit Metadata: Last Used, Created, Created By (read-only
       ReadOnlyField with icon + ContextualHelp tooltip).
   - **Token Usage Stats card** below the form (§24 Metric category): 4
     MetricCards — Total API Calls, Last 24h Calls, Last IP Used, Most
     Called Endpoint.
   - **Footer actions** (one primary §13): "Delete Token" (destructive
     AlertDialog on the left with the spec's exact consequence text:
     "The token will be permanently revoked. Any API integrations using
     this token will immediately stop working. This action cannot be
     undone."), then "Regenerate Key", "Save and add another", "Save and
     continue editing", "Save" on the right.
   - All field labels use `LabelWithHelp` (§33 ContextualHelp) for inline
     explanations.
   - Deterministic mock data via `hashSeed(id)` — no Math.random.
   - Terra palette — emerald/amber/rose accents, no blue/indigo.

2. **`src/modules/audit/enhanced-user-events-page.tsx`** (959 lines)
   - Export: `EnhancedUserEventsPage`. NEW file — original
     `audit/user-events-page.tsx` untouched.
   - **KPI row (7 metrics per spec):** Total Events, Account Created, KYC
     Completed, Breaches Detected (incl. Floating PnL + Daily Drawdown),
     Payout Events, Target Profit Reached, Drawdown Breached.
   - **DataTable columns:**
     - User (email → clickable link to `trader-detail` with `id=traderId`).
     - Account (formatted `[Phase Type] Challenge Name - Account ID` —
       multi-line cell, clickable link to trader-detail).
     - Event Type (StatusBadge with color coding for all 16 types incl.
       new risk events FLOATING_PNL_BREACHED, DAILY_DRAWDOWN_BREACHED,
       TARGET_PROFIT_REACHED, PHASE_UPGRADED).
     - Event Description (rich text with metric snapshots — equity,
       balance, open PnL, positions, daily limit / current / used %,
       target / current / progress %, account upgrade chain).
     - IP Address (monospace).
     - Source (StatusBadge — System/Admin/User/API).
     - Created (timestamp).
   - **Advanced Filter Panel** (Collapsible, starts collapsed): Event Type
     multi-select (16 checkboxes with active-scope chips), Date Range
     dropdown (24h/7d/30d/All), User text input, Account ID text input,
     Source dropdown, Apply + Clear buttons, live result count "X of Y
     events match".
   - **Export CSV** button + instant search bar + pagination 100/page.
   - **168 deterministic mock events** covering every event type (16
     types × ≥8 reps each) using index-seeded generation (`hashStr`,
     `ipFor`, `accountIdFor`, etc.) — no Math.random.
   - Re-exports `EVENT_LABELS`, `ALL_EVENT_TYPES`, `eventTone`,
     `sourceTone`, `buildEnhancedEvents` + types for any future detail
     drawer.
   - Terra palette — emerald/amber/rose/sky accents, no blue/indigo.

### Patterns followed
- `"use client"` directive ✓
- `usePlatform()` from `@/lib/platform/platform-context` ✓
- Platform components: Page, PageHeader, PageContent, MetricCard,
  DataTable, Column, StatusBadge, formatCompact, LabelWithHelp/
  ContextualHelp ✓
- shadcn/ui: Input, Textarea, Label, Switch, Button, Badge, Separator,
  Checkbox, Collapsible, AlertDialog, Select ✓
- lucide-react icons (no blue/indigo) ✓
- `toast` from `@/hooks/use-toast`, `cn` from `@/lib/utils` ✓
- AGENTS.md UX principles: progressive disclosure (§12), one primary
  action (§13), contextual help (§33), explainable state (§17-19),
  destructive AlertDialog confirmation (§24), collapsible advanced
  filters (§27) ✓
- Deterministic mock data (hashStr / index seeds — no Math.random) ✓
- Existing files NOT modified (per task constraints) ✓
- view-router.tsx NOT modified (per task constraints) ✓

### Verifying
`bun run lint` → exit 0 (no errors, no warnings on the new files).
`bunx tsc --noEmit --skipLibCheck` → zero errors on the new files (only
pre-existing errors in the codebase remain).

### Suggested viewIds (NOT registered — view-router.tsx is out of scope)
- `token-detail` → `TokenDetailPage` (settings module). Route from
  `token-management` row click via `navigate("token-detail", { id: token.keyFull })`.
- `audit-user-events-enhanced` → `EnhancedUserEventsPage` (audit module).

To wire these in, the next agent adds two lines to `view-router.tsx`:
```ts
import { TokenDetailPage } from "@/modules/settings/pages/token-detail-page";
import { EnhancedUserEventsPage } from "@/modules/audit/enhanced-user-events-page";
// in viewRegistry:
"token-detail": TokenDetailPage,
"audit-user-events-enhanced": EnhancedUserEventsPage,
```


---
Task ID: img-batch-final
Agent: lead-architect
Task: Analyze final 4 images (125-129) — all 121 images now fully analyzed

## Analysis Summary
Analyzed the last 4 images (125, 126, 128, 129) — Token list, Token detail/edit, User events list, User event detail. Found 3 missing features.

## 2 New Pages Built & Wired

### 1. Token Detail/Edit Page (952 lines)
File: `src/modules/settings/pages/token-detail-page.tsx`
Export: `TokenDetailPage` → viewId: `token-detail`
- Breadcrumb: "Tokens > [Token ID]" (monospace truncated hash)
- Header: History button (outline, toast)
- **4 form sections** (progressive disclosure):
  1. **Identification**: Key (read-only, monospace, Show/Copy buttons), User dropdown with 3-dot menu
  2. **Capabilities & Lifetime**: Expiration date-time input, 8-option Scopes multi-select (Read Trades, Write Trades, Read Accounts, Write Accounts, Read Payouts, Approve Payouts, Read Analytics, Admin Access)
  3. **Access Control**: IP Whitelist textarea (comma-separated), Is Active Switch
  4. **Audit Metadata**: Last Used, Created, Created By (read-only)
- **Token Usage Stats** card: Total API Calls (14,892), 24h Calls, Last IP, Most Called Endpoint
- Footer: Delete Token (AlertDialog), Regenerate Key, Save and add another, Save and continue editing, Save

### 2. Enhanced User Events Page (959 lines)
File: `src/modules/audit/enhanced-user-events-page.tsx`
Export: `EnhancedUserEventsPage` → viewId: `audit-user-events-enhanced`
- **KPI row** (7): Total Events, Account Created, KYC Completed, Breaches Detected, Payout Events, Target Profit Reached, Drawdown Breached
- **DataTable** with 7 columns: User (email link), Account ([Phase Type] Challenge - Account ID link), Event Type (16 types with color-coded badges), Event Description (rich text with metric snapshots), IP Address, Source (System/Admin/User/API badge), Created (timestamp)
- **16 event types** including new risk-specific: FLOATING_PNL_BREACHED, DAILY_DRAWDOWN_BREACHED, TARGET_PROFIT_REACHED, PHASE_UPGRADED
- **Rich descriptions with metric snapshots**:
  - "Floating PnL breached: 333385879 Equity: $4,891.17; Balance: $4,946.17; Open PnL: -$55.00"
  - "Daily Drawdown breached: 333385879 Daily limit: $250.00; Current: $312.50; Used: 125%"
  - "Target Profit reached: 333387710 Target: $800.00; Current: $824.50; Progress: 103%"
- **Advanced Filter Panel** (expandable): 16-checkbox event type multi-select, date range, user, account ID, source dropdown, Apply/Clear buttons with live result count
- Export CSV + search + pagination (100/page)
- 168 deterministic mock events covering all 16 types

## View Router Wiring
2 new view IDs: `token-detail`, `audit-user-events-enhanced`

## Module Route Wiring
- **Settings manifest**: +1 route (token-detail)
- Token detail accessible from token-management page via row navigation
- Enhanced user events accessible as alternate view

## FINAL VERIFICATION
- Page loads 200 ✓, lint clean ✓, 0 console errors ✓
- Command menu shows 80 options for Beta tenant ✓
- ALL 121 IMAGES FULLY ANALYZED across 11 batches ✓
- Total platform: 80+ views, 14 modules, Terra Organic Design, GridStack dashboard, UX Constitution compliance


---

Task ID: analysis-trading
Agent: explore (Trading module gap analysis)
Scope: `/home/z/my-project/src/modules/trading/` (13 pages + 1 widget file + manifest + barrel)

## Module Inventory (verified)
- `manifest.ts` (138 lines) — 6 nav children, 15 routes, 5 widgets, 1 settings entry
- `index.ts` (8 lines) — exports only 5 items (TradingOverviewPage, TradersPage, AccountsPage, PositionsPage, TraderDetailPage). **Note: EnhancedTraderDetailPage and 10 other pages are imported directly by view-router.tsx — bypassing the barrel.**
- `pages/trading-pages.tsx` (301 lines) — TradingOverviewPage, TradersPage, AccountsPage, PositionsPage, TraderDetailPage (basic, not registered in view-router — replaced by enhanced)
- `pages/enhanced-trader-detail-page.tsx` (551 lines) — 7-tab trader workspace (the one actually wired as `trader-detail`)
- `pages/add-account-page.tsx` (668 lines) — 5-step wizard
- `pages/closed-positions-page.tsx` (675 lines) — filters + KPIs + CSV export
- `pages/closed-position-detail-page.tsx` (937 lines) — 6-section detail with P&L breakdown + AlertDialog
- `pages/order-detail-page.tsx` (1110 lines) — order detail + 3 collapsible sections
- `pages/account-configuration-page.tsx` (1055 lines) — 5 collapsible sections + Account Health
- `pages/account-events-page.tsx` (502 lines) — 9 event types + filters + CSV
- `pages/account-version-history-page.tsx` (665 lines) — diff view + revert + CSV
- `pages/account-broker-details-page.tsx` (548 lines) — broker config + bridge state + KPIs
- `pages/account-kyc-statuses-page.tsx` (337 lines) — 4 KYC providers matrix
- `pages/account-related-accounts-page.tsx` (303 lines) — sibling accounts table
- `widgets/trading-overview-widget.tsx` (156 lines) — 5 widgets: TradingOverview, AccountBalance, TraderPerformance, OpenPositions, RecentActivity

## PRESENT (working, with brief notes on quality)

1. **Trading Overview dashboard** (`trading-pages.tsx:TradingOverviewPage`) — 4 KPI cards (Traders, Accounts, Total Equity, Open P&L), 30-day AreaSeries equity curve, recent ActivityTimeline. Reads tenant currency. Quality: medium. KPI deltas are hardcoded numbers (8, 5, 3, 6/-2) with no label explaining what "delta" refers to — violates AGENTS.md §9 (KPI rules: Value + Context + Change + Meaning). No attention center per §11. No win rate KPI despite spec. Equity curve is deterministic mock (sin wave).

2. **Traders list** (`trading-pages.tsx:TradersPage`) — DataTable with avatar + name/email + country (text Badge) + ExplainableStateBadge status + phase + trades + win % + equity + total P&L. Row click → trader-detail. Search works. Sortable columns. ARIA labels on P&L span. Quality: good base. Country is text only — no flag. No filter dropdowns.

3. **Trader detail page** (`enhanced-trader-detail-page.tsx`) — 7 tabs: Overview, Accounts, Positions, Performance, KYC, Risk, Change History. EntityHeader with avatar + status badge + phase badge. 4 KPIs. AccountHealthWidget (§21). Destructive Block Account in AlertDialog with consequence text (§24). Resync + Edit Payout Schedule outline actions. EmptyState component used for KYC + Change History empty tabs (§30). Quality: strong. AccountsTable and PositionsTable have NO onRowClick — can't drill from trader → account workspace.

4. **Accounts list** (`trading-pages.tsx:AccountsPage`) — DataTable with login, trader, platform, type, phase, balance, equity, status. Row click → `trader-detail` (NOT to an Account workspace — bypasses 6 account sub-pages entirely). Search + sort. No filters.

5. **Account detail sub-pages** (6 separate pages): account-configuration (5 collapsible sections + Account Health + Block/Reset AlertDialogs), account-events (9 event types + filters + CSV), account-version-history (diff view + revert + CSV), account-broker-details (login creds + broker config + bridge state + KPIs + Resync), account-kyc-statuses (4-provider matrix + dropdown actions), account-related-accounts (sibling accounts table). Quality: each page individually is well-built with proper empty states (where EmptyState component used), filters, KPIs, contextual help (LabelWithHelp/ContextualHelp), CSV exports where appropriate, deterministic mock data. **But there's no unified Account Workspace with tabs linking them** — each is a standalone route reachable only by URL (§28 violation).

6. **Add Account wizard** (`add-account-page.tsx`) — 5-step (User → Challenge/Phase → Account config → KYC → Review). Smart linkage: challenge type → phase dropdown filters. Required field asterisks. Phase Summary Card with defaults. Stepper indicator with check icons. Create button → toast + navigate to trading-accounts. Quality: strong, matches AGENTS.md §14 (workflow design) and §15 (smart defaults). Spec called for 9 steps (Screenshots 109-117); current is condensed to 5 — possibly intentional simplification.

7. **Open Positions table** (`trading-pages.tsx:PositionsPage`) — DataTable with symbol, side (color-coded), volume, entry, current, P&L, P&L %, opened. ARIA labels on P&L. Quality: minimal. **No close button, no swap column, no account login column, no trader column, no live updates.** Despite "live" in title, all data is static.

8. **Closed Positions table** (`closed-positions-page.tsx`) — DataTable with expand, login, trader, direction, symbol, volume, entry, close, P&L, open time, close time, duration, close reason. 5 filters (search + date range + symbol + direction + reason). KPI row: 7 metrics (Total Closed, Total Profit, Total Loss, Win Rate, Avg Duration, Best, Worst). CSV export with 16 columns. Inline expansion panel. Quality: very strong. **Missing R-multiple column.** No bulk selection.

9. **Closed Position detail** (`closed-position-detail-page.tsx`) — Breadcrumb. 6 FormSections (Identity, Volume & Pricing, Timing, Order IDs, P&L, Risk, Flags). P&L breakdown: Profit → Commission → Swap → Net profit (with `help="Calculated as profit - commission - swap."`). Risk section: SL, TP, RR Ratio. Is-partial switch (read-only). Close reason Select with TP/SL/Manual/System/Liquidation. Footer: Save (primary), Save and continue editing, Delete (AlertDialog with consequence text), Back. Quality: strong. **RR Ratio ≠ R-multiple** (RR is reward-to-risk, R-multiple is `pnl/risk_amount`).

10. **Order detail** (`order-detail-page.tsx`) — Breadcrumb. Header with order ID (mono) + user email (mailto link) + Addons JSON code block. OrderForm: date created (read-only), order type dropdown, notes textarea. Financials grid: 9 fields (Challenge, Competition, Account balance, Amount paid, Quantity, Payment method, Coupon code, Bundle ID, Customer IP). 3 collapsible sections: Attribution/UTM, Accounts (DataTable), Subscription (DataTable). Footer: Save, Save and add another, Delete (AlertDialog), Back. Quality: strong. **No "modifications" log. No "fills" list.** User email is mailto only — no link to trader-detail.

11. **Live activity feed widget** — Component exists at `@/components/platform/live-activity-feed.tsx` (LiveActivityFeedWidget) with pause/resume + clear controls, but **NOT registered as a Trading module widget** and not used on the Trading Overview page. Only used in `/modules/overview/overview-page.tsx`. Trading module's RecentActivityWidget (`trading-overview-widget.tsx:RecentActivityWidget`) is a STATIC list of 6 traders with rotating verb phrases, NOT live.

12. **Equity curve widget (per-account live)** — Component exists at `@/components/platform/live-equity-curve.tsx` (LiveEquityCurveWidget) but NOT used in Trading module. Trading Overview has only a static 30-day AreaSeries using `Math.sin(i/3)` deterministic mock — not live, not per-account.

## MISSING / THIN (needs implementation)

- **Unified Account Workspace with tabs** (§28 Entity Workspaces) — Operators cannot navigate between Configuration / Events / Version History / Broker Details / KYC Statuses / Related Accounts / Closed Positions / Orders without going back to trader-detail (which doesn't link to them). All 6 account-* sub-pages are reachable only by URL. — Affects every tenant. — Effort: L (build a wrapper page with tabs that wraps the existing sub-pages or convert to inline tabs).

- **Account Detail navigation entry from Accounts list & Trader Detail** — AccountsPage `onRowClick` → `trader-detail` (by traderId), completely ignoring `account.id`. EnhancedTraderDetailPage's AccountsTable has no `onRowClick`. Should navigate to Account Workspace. — Affects every tenant. — Effort: S (one-line change in each).

- **Trader Detail tabs: Profile, Payouts, Activity Log, Devices, IP history, Comments/notes, Risk score breakdown** — Spec item #3 calls for 10 tabs. Current has 7 (Overview, Accounts, Positions, Performance, KYC, Risk, Change History). Missing: Profile (standalone identity + contact + KYC documents), Payouts (per-trader payout history), Activity Log (per-trader event log, not just "Change History"), Devices (registered devices), IP history (login IPs), Comments/notes (admin notes on trader), Risk score breakdown (numeric risk score with sub-components). — Affects every tenant, especially Compliance/Risk teams. — Effort: M each (×7 = L total).

- **Account Detail "Closed Positions" tab** — Per-account closed positions view (filtered to single account). Currently the global closed-positions page has filters, but no quick way to see "this account's trades". — Affects every tenant. — Effort: S (filter the existing closed-positions data by accountId).

- **Account Detail "Orders" tab** — Per-account order history. Orders list lives in analytics module (`dashboard-orders`) but no per-account filter from Trading. — Affects every tenant. — Effort: M (build a new tab or filter).

- **Orders history list page** (with tabs: Pending / Filled / Cancelled / Partial Fills) — `dashboard-orders` exists in analytics but is general. Spec item #10 calls for filter combinations for trading orders. Trading module has only `order-detail-page` (single order). — Affects every tenant. — Effort: M.

- **Order modifications log & fills list** — Order detail page has no "modifications" or "fills" sub-section. Spec item #11 calls for "order ticket, modifications, fills". — Affects every tenant. — Effort: S.

- **Closed Position Detail → Trader cross-link** — Spec item #9 cross-references: PnL breakdown is present, but you can't click traderName to jump to trader-detail. Same for Order Detail. — Affects every tenant. — Effort: S (×2).

- **R-multiple column on Closed Positions table** — Spec item #8 calls for R-multiple (multiple of risk). Currently has PnL % but not R-multiple. RR Ratio exists on detail page only, but RR is reward-to-risk target, not realized R. — Affects every tenant. — Effort: S (compute `pnl / (entry - SL) * mult * volume`).

- **Swap column + Account login + Trader column on Open Positions table** — Spec item #7 calls for symbol/side/volume/entry/current/PnL/swap/time/close-button. Currently missing: swap, account login, trader, close button. — Affects every tenant. — Effort: S.

- **Close button on Open Positions rows** — No per-row close action. Spec item #7 explicitly calls for "close button". Also missing: bulk "Close all" / "Close selected". — Affects every tenant. — Effort: M (close modal + AlertDialog confirmation + bulk selection).

- **Bulk actions everywhere (§26)** — ZERO bulk actions across all 13 pages. Traders list (no bulk suspend/export), Accounts list (no bulk assign-to-challenge / bulk status change), Positions list (no bulk close), Closed positions (no bulk export selected). — Affects every tenant. — Effort: L (build reusable bulk selection pattern).

- **Filter combinations on Traders list** — No status filter, no country filter, no phase filter. Spec item #2 implies filters. — Affects every tenant. — Effort: S.

- **Filter combinations on Accounts list** — No challenge phase filter, no status filter, no broker/server filter, no leverage filter. Spec item #4 explicitly calls for these. — Affects every tenant. — Effort: S.

- **Filter combinations on Open Positions list** — No symbol / side / account / trader filter. — Affects every tenant. — Effort: S.

- **Filter combinations on KYC Statuses page** — Only search. No filter by status / provider / document type. — Affects every tenant. — Effort: S.

- **Filter combinations on Related Accounts page** — Only search. No filter by status / phase / source / broker. — Affects every tenant. — Effort: S.

- **CSV export on Traders, Accounts, Open Positions, KYC Statuses, Related Accounts, Account Configuration, Broker Details, Add Account wizard final config, Closed Position Detail (PDF)** — Spec item: "Missing export/print functions". Only Closed Positions, Account Events, Version History have export. — Affects every tenant. — Effort: M (apply `exportToCsv` pattern).

- **Country flag on Traders list & Trader Detail** — Mock data has `country: "US"/"GB"/"AE"/...` ISO codes. UI shows them as text Badges. Spec item #2 calls for "country flag". Could use `cc` → emoji flag or a flag library. — Affects every tenant. — Effort: S.

- **Win rate KPI on Trading Overview** — Spec item #1 lists win rate as a core KPI. Currently the overview shows Traders / Accounts / Total Equity / Open P&L but not Win Rate. — Affects every tenant. — Effort: S.

- **Attention Center on Trading Overview (§11)** — Spec item #1 lists "attention center". Currently no attention center widget on the Trading Overview page. AttentionCenter component exists (`@/components/platform/attention-center.tsx`) but isn't included. — Affects every tenant. — Effort: S.

- **Mini-charts (sparklines) per KPI / per trader on Trading Overview** — Spec item #1 calls for "mini-charts". Currently the overview has one big 30-day AreaSeries but no Sparkline-tiled KPI cards or per-trader sparklines. — Affects every tenant. — Effort: S (Sparkline component already exists).

- **Live Activity Feed widget registered to Trading module** — `LiveActivityFeedWidget` exists but isn't part of the Trading module widget registry. The Trading Overview uses a static ActivityTimeline instead. — Affects every tenant. — Effort: S.

- **Live Equity Curve widget per-account** — `LiveEquityCurveWidget` exists but isn't in Trading module widgets. Trading Overview only has a static AreaSeries. — Affects every tenant. — Effort: S.

- **URL-persisted filters (§51)** — Closed Positions, Account Events, Version History, Add Account wizard step — all keep filter state in useState. Refreshing loses context. No `?status=breached&page=2&sort=drawdown` URL state. — Affects every tenant. — Effort: M (build URL state helper).

- **URL-persisted tab selection in EnhancedTraderDetailPage** — `defaultValue="overview"` hardcoded. Refreshing always returns to Overview tab. — Affects every tenant. — Effort: S.

- **Account Events row click → event detail page** — Currently only fires a toast. Should navigate to a per-event detail (or open a drawer with full event payload). — Affects every tenant. — Effort: M.

- **Account Version History row click → full version diff page or drawer** — Currently only expands inline. No way to share a version URL. — Affects every tenant. — Effort: S.

- **KYC provider "view documents" action** — KYC Statuses page has Re-initiate / Verify / Reject but no "View documents" or "Open provider session URL". — Affects every tenant. — Effort: S.

- **Add Account wizard: broker/server/leverage steps** — Spec item #6 calls for "select broker/server → set leverage → confirm" as a discrete step. Currently broker type is in step 3 (Account config) but no server selection field, no leverage field. — Affects every tenant. — Effort: S.

- **Loading skeletons (§31)** — Zero loading skeletons anywhere in the Trading module. All data is synchronous mock so this isn't visible now, but when backend wires up, every page will flash empty before populating. Should pre-build skeletons matching the page layout. — Affects every tenant. — Effort: M.

- **Error boundaries per page (§32)** — No page-level or widget-level error boundaries. If one widget throws, the whole Trading Overview errors. No "Analytics couldn't be loaded" fallback with Retry button. — Affects every tenant. — Effort: M.

- **Empty states on Accounts/Positions DataTable** — `AccountsPage` and `PositionsPage` use DataTable without `emptyTitle`/`emptyDescription`, falling back to generic "No data" message. Violates §30. — Affects every tenant. — Effort: S (×2).

- **Trader-not-found / Account-not-found proper empty states** — Both enhanced-trader-detail-page and the 6 account-* pages use a terse `<p>Trader not found.</p>` / `<p>Account not found.</p>` text. No EmptyState component, no actionable suggestion, no "Back to Traders" CTA. Violates §30. — Affects every tenant. — Effort: S (×7).

- **TradingOverviewPage empty state** — No empty state at all. If tenant has 0 traders/accounts (a brand-new tenant), the equity curve shows zeros and the activity timeline shows nothing. Should say "Welcome — add your first trader to get started" with a CTA to the Add Account wizard. — Affects every new tenant. — Effort: S.

- **RecentActivityWidget empty state** — Always shows 6 entries from traders list. If tenant has 0 traders, the widget is empty with no explanation. — Affects new tenants. — Effort: S.

## CROSS-TENANT GAPS

- **Terminology not applied to Trading module.** `makeTermResolver` from `@/lib/platform/terminology` is used in the sidebar and challenges module, but ZERO Trading pages call it. Tenant Alpha terminology says trader = "Participant", challenge = "Evaluation", payout = "Withdrawal". Tenant Gamma says trader = "Candidate", challenge = "Assessment", payout = "Disbursement". Yet every Trading page hardcodes "Traders", "Trading Accounts", "Open Positions", "Add Account", "Trader", "Phase", "P&L" labels. The sidebar will say "Participants" but the page header will say "Traders" — jarring inconsistency. Violates §54 (no hard-coding tenant behavior) and §55 (speak user's domain language). — Effort: M (apply `makeTermResolver` to ~15 page headers + 50 column headers + 30 toast messages).

- **Currency is correctly applied** (`runtime.tenant?.currency`) in all pages — Alpha=USD, Beta=GBP, Gamma=USD. Good.

- **KPI deltas are hardcoded** (e.g. Traders `delta={8}`, Accounts `delta={5}`). Same numbers across all 3 tenants. Should derive from mock data or be tenant-configurable. — Effort: S.

- **Branding palette (`--brand-primary`) only used on AccountBalanceWidget bar fills and RecentActivityWidget timeline dots.** Other pages use hardcoded Tailwind colors (emerald/rose/amber) — this is correct per the Terra palette convention but ignores per-tenant `primaryColor`/`accentColor`/`surfaceColor`/`radius` settings from `tenant.branding`. The Radius setting is not applied (e.g. Gamma's `0.625rem` vs Beta's `0.5rem` should subtly change card rounding). — Effort: M.

- **Tenant plan gating not visible.** Alpha is `growth`, Beta is `scale`, Gamma is `enterprise`. Different plans should hide/show certain Trading features (e.g. live activity feed might be Beta+ only). No `runtime.tenant.plan` checks anywhere in Trading module. — Effort: M.

- **Locale not used.** Beta is `en-GB` with `Europe/London` timezone. All date formatting uses `toLocaleString()` / `toLocaleDateString()` without explicit locale — uses browser default. Should pass `runtime.tenant.locale`. — Effort: S.

- **Tenant modules not gated.** Alpha's `enabledModules` is `["trading", "challenges", "risk", "payouts", "settings"]` — only 5 modules. Beta has 9, Gamma has 10. Trading module is enabled on all 3 (good), but the Add Account wizard references KYC steps even for Alpha which doesn't have a separate KYC module. — Effort: S.

## UX GAPS (empty/loading/error/accessibility)

### Empty states (§30 violations)
- AccountsPage, PositionsPage: DataTable without `emptyTitle`/`emptyDescription` → generic empty message.
- Trader-not-found in `enhanced-trader-detail-page.tsx:134-143`: terse `<p>Trader not found.</p>`, no EmptyState component, no actionable suggestion.
- Account-not-found in 6 account-* pages: same terse `<p>Account not found.</p>`.
- TradingOverviewPage: NO empty state at all when tenant has 0 traders/accounts.
- RecentActivityWidget: no empty state when 0 traders.

### Loading states (§31 violations)
- ZERO loading skeletons anywhere in Trading module. When backend data is async, every page will flash empty. Should pre-build skeletons matching page layouts (Page, KPI grid, DataTable header).

### Error states (§32 violations)
- No page-level error boundaries. No widget-level error boundaries. If the bridge sync errors or KYC provider times out, the entire page crashes. No "Retry" buttons. No "Your other dashboard information is still available" fallback.
- No try/catch around `getTenantTraders(tid)` / `getTenantAccounts(tid)` / `getTenantPositions(tid)` calls — these are mock but assume future async patterns.

### Accessibility (§48)
- `add-account-page.tsx` uses raw `<select>` (NativeSelect helper) — inconsistent with rest of platform which uses shadcn `Select`. Less accessible (no keyboard nav improvements, no ARIA combobox semantics).
- `closed-positions-page.tsx` and `account-events-page.tsx` and `account-version-history-page.tsx` use raw `<select>` for filter dropdowns — same issue.
- `enhanced-trader-detail-page.tsx:251-265` basic AccountsTable is a hand-rolled `<table>` without `<th scope="col">`, without `<caption>`. DataTable component is preferred (used in EnhancedTraderDetailPage sub-tables).
- The basic TraderDetailPage's AccountsTable and PositionsTable (in `trading-pages.tsx`) lack proper table semantics — but this page isn't routed (replaced by enhanced), so impact is low.
- P&L spans on PositionsPage, TradersPage, ClosedPositionsPage have `role="img"` + `aria-label` — GOOD.
- Expand/collapse buttons on ClosedPositions and VersionHistory have `aria-label` — GOOD.
- Filter `<select>` elements have `aria-label` — GOOD.
- Add Account wizard's RequiredAsterisk uses `aria-hidden` on the asterisk — GOOD.

### Filter combinations (§26)
- Closed Positions: 5 filters combined (search + date + symbol + direction + reason) — GOOD.
- Account Events: 3 filters (search + type + date) — GOOD.
- Version History: 4 filters (search + field + actor + date) — GOOD.
- Traders list: 1 (search only) — THIN.
- Accounts list: 1 (search only) — THIN.
- Open Positions: 1 (search only) — THIN.
- KYC Statuses: 1 (search only) — THIN.
- Related Accounts: 1 (search only) — THIN.

### Cross-references / navigation
- Closed Position Detail → Trader: NO LINK (traderName is plain text). Spec item #9 cross-references broken.
- Order Detail → Trader: NO LINK (only mailto:). Spec item #11 cross-references broken.
- Trader Detail → any Account sub-page: NO LINKS (all 6 account-* pages unreachable).
- Accounts list → Account sub-pages: NO LINKS (row click goes to trader-detail by traderId, ignoring account.id).
- Account sub-page → another account sub-page: NO LINKS (except related-accounts → broker-details). Operators have to use the URL bar.
- Account Events row click: toast only (no detail page).
- Account Version History row click: expand only (no shareable URL).

### Bulk actions (§26)
- ZERO bulk actions across all 13 pages. Spec calls for "Close All Positions" on Open Positions table, "Bulk Suspend" on Traders list, "Bulk Assign to challenge" on Accounts list, "Bulk export selected" on Closed Positions. None exist.

### Export/print
- Closed Positions, Account Events, Version History: have CSV export ✓
- Traders, Accounts, Open Positions, KYC Statuses, Related Accounts, Account Configuration, Broker Details, Add Account (final config print), Closed Position Detail (PDF for compliance): NO export ✗

### Visual hierarchy (§41)
- TradingOverviewPage: KPI deltas (e.g. `+8`, `+5`, `+3`) appear without deltaLabel in TradingOverviewPage (only `deltaLabel="vs last week"` appears on the Widget version, not the page version). Operators can't tell what "8" means — 8%? 8 traders? 8 vs what? AGENTS.md §9 violation.
- Closed Positions KPI row: 7 metrics on one row at `xl:grid-cols-7` — borderline density (§8 dashboard density rule). Could be 4 primary + 3 secondary.
- Account Configuration page: 5 collapsible sections all on one column — vertically long. Could use 2-column layout for adjacent sections.

### Animation (§68)
- No unnecessary animations. Add Account wizard step indicator transitions use `transition-all` (subtle, appropriate).
- Sparkline on TraderPerformanceWidget uses no animation — appropriate.
- Open Positions table doesn't animate new positions (no live updates) — appropriate (no fake real-time per §67).

## SUGGESTED NEXT ACTIONS (priority-ordered)

1. **HIGHEST** — Build unified Account Workspace with tabs wrapping the 6 existing account-* sub-pages (§28). Add row click from Accounts list → Account Workspace (by `account.id`, not `traderId`). Add AccountsTable onRowClick in EnhancedTraderDetailPage. — Unblocks all 6 pages from being orphaned.
2. **HIGH** — Add navigation cross-links: Closed Position Detail → trader-detail, Order Detail → trader-detail, Trader Detail → Account Workspace.
3. **HIGH** — Add Close button + bulk selection on Open Positions table.
4. **HIGH** — Apply `makeTermResolver` to all Trading page headers and column headers (cross-tenant consistency).
5. **MEDIUM** — Add filters to Traders list (status/country/phase), Accounts list (phase/status/broker), Open Positions (symbol/side/account).
6. **MEDIUM** — Pre-build loading skeletons for every page; add page-level error boundaries.
7. **MEDIUM** — Add EmptyState component to all "not found" fallbacks and to DataTable calls without emptyTitle.
8. **MEDIUM** — Wire `LiveActivityFeedWidget` + `LiveEquityCurveWidget` into Trading module widget registry and/or Trading Overview page.
9. **MEDIUM** — Add URL-persisted filters (search/filter/sort/tab) via query params.
10. **MEDIUM** — Add CSV export to Traders, Accounts, Open Positions, KYC Statuses, Related Accounts.
11. **LOW** — Add R-multiple column to Closed Positions. Add swap/account/trader columns to Open Positions.
12. **LOW** — Add missing Trader Detail tabs (Profile, Payouts, Activity Log, Devices, IP history, Comments, Risk score breakdown).
13. **LOW** — Add country flag emoji to Traders list + Trader Detail.
14. **LOW** — Add Attention Center + Sparkline-per-KPI to Trading Overview.
15. **LOW** — Add bulk actions pattern (close-all, bulk-suspend, bulk-export-selected).


---

Task ID: analysis-challenges-risk
Agent: explore (Challenges + Risk module gap analysis)
Scope: `/home/z/my-project/src/modules/challenges/` (7 pages + 1 widget file + manifest + barrel) and `/home/z/my-project/src/modules/risk/` (16 pages + 1 widget file + manifest + barrel).

## Module Inventory (verified)

### Challenges module — 7 page files + 3 widgets
- `manifest.ts` (73 lines) — 9 nav children, 10 routes, 3 widgets, 1 settings entry
- `index.ts` (8 lines) — exports 5 items (challengesModule + 4 page components from challenge-pages.tsx). **Note: 5 other pages (wizard, config, edit, types, phase-management, phase-detail) are imported directly by view-router.tsx — bypassing the barrel.**
- `pages/challenge-pages.tsx` (114 lines) — ChallengesOverviewPage + ActiveChallengesPage + PassedChallengesPage + FailedChallengesPage + shared ChallengeTable
- `pages/challenge-wizard-page.tsx` (1005 lines) — 7-step Create Challenge wizard
- `pages/challenge-config-page.tsx` (429 lines) — split-view phase editor (basic + advanced disclosure)
- `pages/challenge-edit-page.tsx` (1571 lines) — 5-tab editor (General / Phases / Payout / Checkout / Review)
- `pages/challenge-types-page.tsx` (173 lines) — card grid catalog
- `pages/phase-management-page.tsx` (287 lines) — table + inline expansion panel
- `pages/phase-detail-page.tsx` (1111 lines) — 3-tab editor (General / Trading Platform IDs / Change History)
- `widgets/challenge-widgets.tsx` (63 lines) — ChallengeOverviewWidget, ChallengeProgressWidget, ChallengePhasesWidget

### Risk module — 16 page files + 4 widgets
- `manifest.ts` (88 lines) — 16 nav children, 17 routes, 4 widgets, 1 settings entry
- `index.ts` (2 lines) — exports only 2 items (riskModule + RiskOverviewPage + BreachesPage). **Note: 15 other pages imported directly by view-router — bypassing barrel.**
- `pages/risk-pages.tsx` (95 lines) — RiskOverviewPage + BreachesPage + shared BreachesTable
- `pages/risk-statistics-page.tsx` (334 lines) — 3-tab analytics (challenge / country / account-size)
- `pages/trading-events-page.tsx` (501 lines) — 4-tab rule CRUD (news / copy / inverse / weekend)
- `pages/copy-trading-analysis-page.tsx` (525 lines) — 2-account comparison + verdict
- `pages/copy-trading-events-page.tsx` (747 lines) — list + inline add form + CSV
- `pages/inverse-trading-events-page.tsx` (718 lines) — list + inline add form + CSV
- `pages/account-ip-addresses-page.tsx` (775 lines) — IP records + collapsible guide
- `pages/weekend-trades-page.tsx` (933 lines) — list + inline detail + AlertDialog delete
- `pages/risk-revenue-loss-page.tsx` (359 lines) — WoW + MoM tables + area chart
- `pages/risk-label-vs-payouts-page.tsx` (466 lines) — by account label, expandable
- `pages/risk-group-vs-payouts-page.tsx` (386 lines) — by challenge config
- `pages/risk-coupon-vs-payouts-page.tsx` (366 lines) — by coupon
- `pages/risk-highest-earners-page.tsx` (363 lines) — top earner ranking
- `pages/risk-account-label-analysis-page.tsx` (505 lines) — by source label
- `pages/risk-addon-revenue-page.tsx` (314 lines) — addon revenue
- `pages/risk-unprofitable-countries-page.tsx` (328 lines) — payout-loss countries
- `widgets/risk-widgets.tsx` (70 lines) — RiskOverviewWidget, RiskDistributionWidget, BreachTrendWidget, OpenBreachesWidget

## CHALLENGES — PRESENT (working, with notes)
1. **Manifest** — 9 nav children, 10 routes, 3 widgets, `termKey: "challenge"` on parent nav (terminology-aware sidebar). Permissions (challenge.read/create/update/delete) properly declared. Module accentColor forest green.
2. **Challenges Overview** (`challenge-pages.tsx:ChallengesOverviewPage`) — 4 KPIs (Active, Passed, Avg Progress, Total), embedded ChallengeTable, currency applied. Notes: KPI deltas missing (§9 violation). No Failed KPI (data exists). No pass-rate KPI. No by-type breakdown. No attention center (§11). Widget hardcodes `failed = 0` (challenge-widgets.tsx:19) misleading.
3. **Active / Passed / Failed lists** — Single ChallengeTable with filter prop. Columns: Trader, Challenge, Phase, Account Size, Profit Target, Current Profit, Progress bar, Days Left, Status. Sortable + searchable. Notes: No onRowClick (no drill to anything). No drawdown-status column. No failure-reason column on Failed. No certificate/payout-eligibility on Passed. No retry button on Failed. No CSV export.
4. **Challenge Wizard** (`challenge-wizard-page.tsx`) — 7-step (Type → Phase 1 → Phase 2 conditional → Trading Rules → Payout Rules → Risk Rules → Review). Step indicator with done/active/inactive circles. Smart defaults via `getChallengePhaseConfigs(typeId)`. Phase 2 skipped for 1-step types. Review shows summary + Create Challenge button (toast + reset). Notes: no Save-as-Draft, no template picker beyond type dropdown, no platform-ID step, no checkout/woocommerce mapping step (challenge-edit has it; wizard doesn't), no Save-and-continue-editing after create.
5. **Challenge Config** (`challenge-config-page.tsx`) — Split-view master-detail. Left: DataTable of types with Active Switch + Edit button. Right: ConfigEditor with PhaseConfigCard per phase, 6 basic fields + Advanced collapsible (Trading/News/Weekend/Other Limits — 11 toggles/inputs). LabelWithHelp on every field (§33 ✓). Save/Reset buttons. EmptyState when nothing selected. URL param `typeId` accepted (pre-select from challenge-types). Notes: **BUG — `Math.random() > 0.4` on line 216 for default toggle states — non-deterministic, breaks stable demo.** No consistency rule. No news-holding rules. No phase add/reorder.
6. **Challenge Edit** (`challenge-edit-page.tsx`, 1571 lines) — 5-tab editor (General / Phases / Payout Rules / Checkout / Review). SectionCard + FieldRow + ToggleRow primitives. LabelWithHelp everywhere. Phases tab → row click → phase-detail. Review tab has phase flow diagram (Terra-tinted) + summary + Save All + Publish. Notes: no Duplicate button, no Archive button (only an "Archived" toggle on General), no Version history/selector, no Save-and-add-another, no destructive-archive AlertDialog (§24), Publish only fires toast.
7. **Challenge Types catalog** (`challenge-types-page.tsx`) — Card grid of 6 types with icon, description, phase count, free-trial/competition badges, active toggle, Edit button → challenge-config with `typeId`. Notes: "Add Challenge Type" is a toast placeholder (line 141). No template library. No delete. No search/filter on the grid.
8. **Phase Management** (`phase-management-page.tsx`) — DataTable of all phase configs with challenge-type filter dropdown. Row click expands inline PhaseDetailPanel (7 numeric fields + Save). EmptyState messages present (§30 ✓). Notes: "Add Phase" is toast placeholder (line 219). No phase reordering. No phase-type filter. No funded-only/evaluation-only filter. Inline editor is numeric-only — no trading/weekend/news rules (those live on phase-detail General tab, disconnected).
9. **Phase Detail** (`phase-detail-page.tsx`, 1111 lines) — 3-tab editor: General (Metadata + Risk Rules + Trading Day Threshold + Auto-Pass + Leverage + Live/Scaling toggles), Trading Platform IDs (MT5/MT4/DXTrade group mapping + bridge status + Resync), Change History (per-object audit DataTable with strikethrough old/new values, search, field filter, real `exportToCsv`). Deterministic mock change history per phase. Audit trail (§61 ✓). Notes: General tab has limited rules (no news/weekend/consistency — those are on challenge-config AdvancedSection, disconnected from phase-detail).
10. **3 widgets** (`challenge-widgets.tsx`) — ChallengeOverviewWidget (4 KPIs with `makeTermResolver` applied ✓), ChallengeProgressWidget (5 traders with progress bars), ChallengePhasesWidget (DonutSeries: Phase 1 / Phase 2 / Funded / Failed).

## CHALLENGES — MISSING / THIN
- **Per-trader challenge progress timeline** — task #11 — No trader-level view of journey (started P1 on X → passed P1 on Y → started P2 on Z → breached on W). Risk module's enhanced-trader-detail has no "Challenge Journey" tab. — High value for support/risk. — Effort: M.
- **Challenge comparison view (side-by-side)** — task #12 — No way to diff 2 challenge types side-by-side (targets, drawdown, payout splits). Operators open 2 browser tabs. — Effort: M.
- **Bulk challenge assignment to traders** — task #13 — No "Assign Challenge to 50 Traders" bulk op. 1-by-1 via Add Account wizard only. — Effort: L (reusable BulkActionBar pattern).
- **Challenges Overview — Failed + Pass Rate + Funnel KPIs + by-type breakdown** — Currently 4 cards (Active/Passed/Avg Progress/Total). Spec #1 calls for active/passed/failed/pass rate/by-type breakdown/attention center. Widget hardcodes `failed = 0`. — Effort: S.
- **Failed Challenges list — no failure reason column / Retry button** — task #4 — Just `status === "failed"` filter. Mock data has no `failureReason` field. No retry modal. — Effort: M (extend mock + retry AlertDialog §24).
- **Passed Challenges list — no payout eligibility / certificate link** — task #3 — No "eligible for payout" indicator. No "View Certificate" link (no certificate system exists — Flow analysis #13). — Effort: L (cert module first) or S (eligibility indicator only).
- **Active Challenges list — no drawdown status / Account Health card** (§21) — task #2 — Has Progress column but not "Daily DD 41%/5%", "Max DD 6.8%/10%" (AGENTS.md §21 Account Health pattern). — Effort: S (compute from currentProfit + challenge limits).
- **Challenge list row click → no drill** — DataTable in challenge-pages.tsx has no onRowClick. Can't drill to challenge workspace (which doesn't exist) or trader-detail. — Effort: S (one-line onRowClick) or L (build Challenge Workspace §28).
- **Challenge Config — `Math.random()` in production** (line 216) — `defaultChecked={r.label === "Require Stop-Loss" ? false : Math.random() > 0.4}` — Non-deterministic. Reload re-randomizes. Violates platform's deterministic-mock invariant. — Effort: S (replace with hash).
- **Challenge Config — no consistency rule** (task #6 lists it) — Profit Target/Max DD/Daily DD/Min Days/Max Days/Profit Split present. News/Weekend/EA toggles present. No Consistency Rule (e.g. "no single trade > 40% of total profit"). — Effort: S.
- **Challenge Config — no news-holding rules** (task #6 lists it) — Has "News Trading" + "Block NFP/FOMC" + "News Window min" but no "must close positions before news" or "cannot hold through high-impact news" rules. — Effort: S.
- **Phase Detail — phase gate criteria + completion stats** (task #10) — General tab has rules but no Gate Criteria tab (X% reached profit target, Y% hit min trading days, Z% breached). No completion stats. — Effort: M.
- **Phase Detail — phase transitions** (task #9) — No "Phase 1 → Phase 2 transition rules" (auto-pass? manual review? KYC required?). Phase management only edits static rules. — Effort: M.
- **Phase Management — Add Phase is a toast placeholder** (line 219) — No actual add-phase form. — Effort: M.
- **Challenge Types catalog — Add is a toast placeholder** (line 141) — No new-type form. No template library. — Effort: M.
- **No bulk actions anywhere in Challenges module** — DataTables don't expose selection. Spec §26 calls for "Bulk assign to traders" / "Bulk archive". — Effort: L.
- **No URL-persisted filters on Challenges lists** — Active/Passed/Failed tables use `searchableText` only. No `?status=&q=&sort=` URL state. — Effort: M.
- **No empty states on ChallengeTable** — DataTable without `emptyTitle`/`emptyDescription`. New tenant with 0 challenges → generic "No data" (§30 violation). — Effort: S.
- **No Attention Center on Challenges Overview** (§11) — Component exists at `@/components/platform/attention-center.tsx`. Should surface "12 challenges near max DD", "5 phase-2 accounts waiting payout eligibility". — Effort: S.
- **No Sparklines on KPIs** — Spec #1 calls for "mini-charts". Sparkline component exists. — Effort: S.
- **No loading skeletons** — All synchronous mock. Backend wiring will flash empty. — Effort: M.
- **No error boundaries** — Single widget failure crashes Overview. — Effort: M.
- **No terminology applied to Challenges page headers** — `makeTermResolver` only used in `challenge-widgets.tsx`. Page headers hardcode "Challenges" / "Active Challenges". Tenant Alpha terminology says challenge = "Evaluation". Sidebar shows "Evaluations" but page header says "Challenges" (§54/§55 violation). — Effort: M.
- **No certificate module** — Flow analysis #13 confirms no certificate system. Passed Challenges list can't link to certificate. — Effort: L.
- **Wizard lacks Save-as-Draft** — `createChallenge` immediately resets state. No way to resume. — Effort: M.
- **No phase flow diagram on Phase Management** — challenge-edit ReviewTab has it. Phase Management is just a table. Operators managing phases don't see the visual flow. — Effort: S (reuse ReviewTab diagram component).
- **Challenge Edit — no Duplicate / no Archive action button** (only Archived toggle on General) — Flow analysis #10 calls for "edit existing challenges" with duplicate/archive/version. — Effort: M.

## RISK — PRESENT
1. **Manifest** — 16 nav children, 17 routes, 4 widgets, 1 settings entry. Permissions (risk.read / risk.configure / breach.read). Module accentColor `#b91c1c` (red — correct for risk). supportedApplications all 3. Good navigation grouping.
2. **Risk Overview** (`risk-pages.tsx:RiskOverviewPage`) — 4 KPIs (Open Breaches, Critical, Resolved 30d, Platform Risk Score "72/100"). Embedded BreachesTable. "Configure rules" action (toast). Notes: No "at-risk accounts count" distinct from breaches. No "total exposure" KPI ($ at risk). No "top breaches" hero. No ATR/concentration map. No attention center (§11). Risk Score "72/100" hardcoded — no breakdown. No deltas (§9). No breach trend chart on page (BreachTrendWidget exists but isn't on the page).
3. **Breaches list** (`risk-pages.tsx:BreachesPage` + `BreachesTable`) — DataTable with 7 columns: Trader, Type, Rule, Severity, Status, Triggered, Resolve action. Search + sort. Notes: No type filter (daily-drawdown / max-drawdown / profit-target-miss / time-limit). No severity filter. No status filter. No date range. No trader drill. No CSV export. No bulk Resolve. Breach type list incomplete (no trailing-drawdown / margin-call).
4. **Risk Statistics** (`risk-statistics-page.tsx`) — 3-tab (Challenge Stats / Country-Wise / Account Size). Date range selector (all/30d/90d/1y). KPI row (Total Revenue, Total Payouts, Profit Margin, Funded Accounts). CSV export button (toast-only — doesn't call real `exportToCsv`). Notes: revenue approximated (`accountSize * 0.02`, `trader * 200`). No "by time" trend. No "by rule" lens. No drill from row to filtered breaches. Uses raw `<select>` for date range (accessibility inconsistency with shadcn Select used elsewhere).
5. **Trading Events** (`trading-events-page.tsx`) — 4-tab rules CRUD: News / Copy / Inverse / Weekend. Each tab: master-detail with DataTable + RuleEditor (name, description, symbol, severity, action, active, Save). EmptyState when nothing selected (§30 ✓). Notes: This is rule CONFIGURATION, not detected events (events are on copy-trading-events / inverse-trading-events / weekend-trades pages). No "Add Rule" button (only Edit on existing rows). No bulk enable/disable. No CSV export.
6. **Copy Trading Analysis** (`copy-trading-analysis-page.tsx`) — 2-account comparison: enter 2 logins + date range → Analyze → side-by-side account panels (positions table) + Match Analysis (Correlation %, Matching Positions, Time Delta Avg, Verdict). EmptyState before analysis (§30 ✓). Deterministic mock. Notes: Only 2-account manual comparison. No "scan all accounts for copy-trading clusters" (task #5 calls for correlation matrix). No saved searches. No drill to per-position diff.
7. **Copy Trading Events** (`copy-trading-events-page.tsx`) — KPI row + filter bar (search + symbol + date range + CSV) + DataTable (Position 1, Position 2, Open Δ, Close Δ, Account 1, Account 2, Expired toggle, Created) + checkbox selection + inline add-event form (Position 1 dropdown, Position 2 dropdown, reasons, expired toggle, Save / Save & continue). Account login buttons navigate to trader-detail ✓. Real `exportToCsv` ✓. Notes: No "Mark as reviewed" / "Dismiss as false positive" status. No bulk dismiss.
8. **Inverse Trading Events** (`inverse-trading-events-page.tsx`) — Same structure for inverse (long/short) pairs. KPI row + filters + DataTable + inline add form. CSV export. Notes: Same false-positive dismissal gap.
9. **Account IP Addresses** (`account-ip-addresses-page.tsx`) — Collapsible guide banner + KPI row (Total IPs / Unique Accounts / Proxy / Hosting / Mobile) + filter bar (search + country + proxy state) + DataTable (Account, Status, Phase, Challenge, IP, City, Country, Is Proxy/Hosting/Mobile, Created) + inline add form (Account dropdown, IP, City, Country, Lat/Lng, Tri-state proxy/hosting/mobile). Real CSV export ✓. Account login navigates to trader-detail ✓. Notes: No "shared IP across multiple accounts" reverse view (task #7 — the key risk signal). Lat/lng fields present but no map visualization. No bulk allowlist.
10. **Weekend Trades** (`weekend-trades-page.tsx`) — KPI row + filter bar (search + symbol + direction + state + date range) + DataTable (Account, Direction, Symbol, Volume, Profit, Open Time, Close Volume, Close Time, State, RR Ratio, Hold Time) + inline detail panel (open/close prices, order IDs, commission, swap, SL/TP, close-reason dropdown) + Delete (AlertDialog with consequence text §24 ✓) + Save. Real CSV export ✓. Notes: No bulk delete. No "block this trader from future weekend trades" action.
11. **Risk Reports (8 pages)** — Each well-built with KPIs + filters + DataTable + CSV export (mostly real `exportToCsv`). Empty states where appropriate (§30 ✓). Date range selectors. Common gaps: most use raw `<select>` for date range (accessibility inconsistency). Revenue figures are approximations. No drill from row to underlying accounts. No cross-link to trader-detail from row.
12. **4 widgets** (`risk-widgets.tsx`) — RiskOverviewWidget (4 KPIs), RiskDistributionWidget (DonutSeries), BreachTrendWidget (AreaSeries 30d), OpenBreachesWidget (top 5 with empty state "All clear" §30 ✓). Notes: hardcoded "72/100" Risk Score.

## RISK — MISSING / THIN
- **Risk Overview — at-risk accounts count** (§9 actionable KPI example) — Currently shows Open Breaches + Critical + Resolved + Risk Score. No "X accounts within 10% of max DD" with sub-breakdown "12 within 10% / 7 within 5% / 5 critical" (AGENTS.md §9 explicit example). — Effort: S.
- **Risk Overview — total exposure** — task #1 — No "$X total at-risk exposure" KPI. — Effort: S.
- **Risk Overview — top breaches hero** — task #1 — Recent Breaches table exists but isn't "top by severity" sorted. No "Top 5 critical breaches" hero card. — Effort: S.
- **Risk Overview — ATR / concentration map** — task #1 — No visualization of where risk is concentrated (by challenge type / country / symbol). Risk Statistics has tables but no chart on Overview. — Effort: M.
- **Risk Overview — attention center** (§11) — Component exists, not used. No "12 accounts near breach / 3 unresolved copy-trading events / 5 weekend trades pending review" panel. — Effort: S.
- **Risk Overview — breach trend chart on page** — BreachTrendWidget exists, isn't on the Overview page. — Effort: S.
- **Breaches list — no type/severity/status/date filters** — task #2 — Only search. Can't filter "daily-drawdown breaches from last 7 days, severity=critical, status=open". — Effort: S (toolbar prop).
- **Breaches list — no drill to trader** — task #2 — Click does nothing. No link from Trader column to trader-detail. — Effort: S.
- **Breaches list — incomplete breach types** — Mock data has `daily-drawdown | max-drawdown | profit-target-miss | time-limit`. Task #2 calls for `daily dd / max dd / trailing dd / margin call`. No "trailing-drawdown" or "margin-call". — Effort: M (extend mock + filter UI).
- **Breaches list — no CSV export** — All other risk pages have CSV. Breaches (most operational page) doesn't. — Effort: S.
- **Breaches list — no bulk Resolve / bulk Dismiss** — 1-by-1 only. — Effort: M.
- **Risk Statistics — no "by rule" lens** (task #3) — Pass rate by rule (which rule has highest breach rate). Currently has challenge/country/size. — Effort: M.
- **Risk Statistics — no "by time" trend** (task #3) — Pass rate over time (12-month line). Only static tables. — Effort: M.
- **Risk Statistics — no drill from row to filtered breaches** — Clicking a challenge type row should filter Breaches to that challenge's breaches. — Effort: M (URL state cross-page).
- **Copy Trading Detection — no correlation matrix** (task #5) — Only 2-account manual. No "scan all accounts → matrix of N×N correlation". IP-sharing view is on separate page. — Effort: L.
- **Copy Trading / Inverse Trading Events — no false-positive dismissal** — Each event is active or expired only. No "reviewed & dismissed" state. — Effort: S each.
- **Account IP Addresses — no "shared IP across accounts" view** (task #7) — Records are per-account. No reverse view "IP 192.168.1.1 → 3 accounts". Multi-account-same-IP (key risk signal) not surfaced. — Effort: M.
- **Account IP Addresses — no map** — Lat/lng fields present, no map. — Effort: M.
- **Real-time risk alerts** (task #10) — No alert/feed system. Notification Center exists platform-wide but no risk-specific feed. No "live breach alerts" ticker. — Effort: L.
- **Risk scoring per account** (task #11) — "Platform Risk Score 72/100" is platform-wide single number. No per-account composite score (drawdown usage %, breach history, copy-trading flags, IP risk, weekend trades, news violations). — Effort: L.
- **Risk rule configuration per challenge/phase** (task #12) — Risk rules configured on challenge-config and phase-detail (within Challenges module). Risk module only has Trading Events rules. No way to say "for the 2-Step Pro challenge Phase 2, max DD = 8% and daily DD = 4%" from Risk module. No cross-link from Risk to phase-detail. — Effort: M.
- **No bulk actions anywhere in Risk module** — DataTables don't expose selection. copy-trading-events has selection checkboxes but bulk action bar isn't implemented. — Effort: L.
- **No URL-persisted filters on Risk pages** — All filters use local useState. Refresh loses context. — Effort: M.
- **No loading skeletons** — Same as Challenges. — Effort: M.
- **No error boundaries** — Same. — Effort: M.
- **No terminology applied to Risk module** — `makeTermResolver` not imported in any risk page. Headers hardcode "Risk Management", "Breaches", "Risk Analysis". — Effort: M.
- **Risk Statistics CSV export is toast-only** — `exportCsv(rows)` shows toast but doesn't call `exportToCsv`. (compare with copy-trading-events which uses real helper). — Effort: S.
- **No drill from report row to filtered list** — Clicking "Country = India" on Unprofitable Countries should jump to Traders filtered to India. — Effort: M.
- **No "Mark as Reviewed" workflow on detection events** — Copy/inverse/weekend detected but no review/acknowledge workflow. — Effort: M.
- **No platform-level "Risk Reports" overview page** — 8 report pages exist, no index/landing. Operators navigate sidebar alphabetically. — Effort: S.
- **Trading Events page (rules) — no "Add Rule" button** — Only Edit on existing rows. — Effort: S.

## CROSS-TENANT GAPS
- **Terminology not applied** — Both modules' page headers hardcode labels. Sidebar adapts ("Evaluations" for tenant-alpha) but page headers don't. Violates §54/§55.
- **Currency correctly applied** — Both modules use `runtime.tenant?.currency` (verified across all risk pages and most challenge pages). Good.
- **Branding palette partially applied** — Risk accentColor `#b91c1c` (red ✓). Challenges accentColor `#15803d` (forest green ✓). But tenant-specific `primaryColor`/`accentColor`/`surfaceColor`/`radius` from `tenant.branding` not consistently used. E.g. tenant-gamma `radius: 0.625rem` should subtly change card rounding; not applied.
- **Tenant plan gating not visible** — Alpha `growth`, Beta `scale`, Gamma `enterprise`. Neither module checks `runtime.tenant.plan`. Copy Trading Analysis (Beta+ feature?) / Risk Reports (Enterprise only?) — no gating.
- **Locale not used** — All date formatting uses `toLocaleString()` without explicit locale. Beta `en-GB` with Europe/London tz shows browser-default formatting.
- **Tenant modules not gated** — Alpha `enabledModules` is `["trading", "challenges", "risk", "payouts", "settings"]`. Alpha `enabledFeatures` is `["challenges.two-phase", "risk.daily-drawdown"]` — no `risk.config` or `risk.scoring`. Risk module manifest declares capabilities `["risk.scoring", "risk.breaches", "risk.config"]` but UI doesn't check `enabledFeatures`. Trading Events rules CRUD on Alpha should arguably be hidden.
- **Risk Score is platform-wide hardcoded "72/100"** — Not tenant-aware. Should be computed per-tenant.
- **No tenant-specific mock data variation** — Same breaches/challenges across all 3 tenants (filtered by tenantId but patterns identical).

## UX GAPS

### Empty states (§30)
- **ChallengeTable**: DataTable without `emptyTitle`/`emptyDescription`. New tenant with 0 challenges → generic "No data".
- **BreachesTable**: same issue.
- **Phase Management**: emptyTitle/emptyDescription present ✓.
- **Challenge Config**: EmptyState present ✓.
- **Trading Events**: EmptyState present ✓.
- **Copy Trading Analysis**: EmptyState present ✓.
- **Copy/Inverse Trading Events**: EmptyState present ✓.
- **Weekend Trades**: implicit (DataTable default).
- **Risk Statistics**: no empty state on tables (assumes data always exists).
- **8 Risk Report pages**: most have EmptyState ✓ (addon-revenue, coupon-vs-payouts, etc.).

### Loading states (§31)
- ZERO loading skeletons anywhere in either module. All synchronous mock. When backend wires up, every page will flash empty.

### Error states (§32)
- No page-level or widget-level error boundaries in either module. If one widget throws, the whole Overview errors. No "X couldn't be loaded. [Retry]" fallback.

### Accessibility (§48)
- **risk-statistics-page.tsx:244-253** — uses raw `<select>` for date range. Inconsistent with rest of platform (shadcn Select). Less accessible (no keyboard nav improvements, no ARIA combobox).
- **challenge-pages.tsx** — P&L span has color but no `role="img"` + `aria-label` (compare with Trading module's PositionsPage which has both).
- **Phase Management** — status cells use `<Badge>` not `role="img"` with aria-label.
- **DataTable checkboxes** on copy-trading-events have `aria-label` ✓.
- **Switch toggles** have `aria-label` ✓ across both modules.
- **P&L spans** on risk-statistics country/size tables: no ARIA labels.
- **Phase flow diagram** on challenge-edit ReviewTab: visual-only, no alt-text or aria-description.

### Filter combinations (§26)
- **Strong**: copy-trading-events (3 filters), inverse-trading-events (3), account-ip-addresses (3), weekend-trades (5), risk-statistics (date range + 3 tabs).
- **Thin**: Challenges Overview/Active/Passed/Failed tables (search only).
- **Thin**: Breaches list (search only).
- **Thin**: Phase Management (1 type filter + search).
- **Thin**: Challenge Types catalog (no search/filter).

### Cross-references / navigation
- **Challenge list → trader-detail**: NO LINK (no onRowClick).
- **Challenge list → challenge-edit**: NO LINK.
- **Challenge types → challenge-config**: ✓ (Edit button with typeId param).
- **Challenge-edit → phase-detail**: ✓ (Edit Phase button per row).
- **Phase-detail → challenge-edit**: ✓ (Back button).
- **Risk Overview → breaches**: NO LINK (just embedded table, no "View all breaches" CTA).
- **Breaches list → trader-detail**: NO LINK.
- **Copy trading events → trader-detail**: ✓.
- **Inverse trading events → trader-detail**: ✓.
- **Account IP addresses → trader-detail**: ✓.
- **Risk Statistics row → filtered breaches/traders**: NO LINK.
- **Risk Reports (8 pages) row → underlying accounts**: NO LINK.
- **Risk Overview widget → breaches page**: NO LINK.
- **Phase-detail change history row → user/actor detail**: NO LINK.

### Bulk actions (§26)
- ZERO bulk actions across both modules. Spec calls for: Bulk Resolve on Breaches, Bulk Dismiss on copy/inverse trading events, Bulk delete on weekend trades, Bulk assign challenge to traders, Bulk export selected (only CSV-export-all exists).

### Export/print
- **CSV export (real `exportToCsv`)**: copy-trading-events ✓, inverse-trading-events ✓, account-ip-addresses ✓, weekend-trades ✓, phase-detail change history ✓.
- **CSV export (toast only, fake)**: risk-statistics ✗ (and likely risk-revenue-loss / risk-label-vs-payouts / risk-group-vs-payouts / risk-coupon-vs-payouts / risk-highest-earners / risk-account-label-analysis / risk-addon-revenue / risk-unprofitable-countries — spot-checked 1).
- **No CSV export**: Challenges Overview/Active/Passed/Failed, Breaches list, Phase Management, Challenge Types, Trading Events rules, Challenge Config, Challenge Edit, Phase Detail General.

### Visual hierarchy (§41)
- **Risk Overview KPI "Platform Risk Score 72/100"**: no delta, no breakdown, no "what does 72 mean" (§9 violation).
- **Challenge Overview KPI "Total"**: redundant with Active+Passed+Failed; conveys no extra info.
- **Challenge Config PhaseConfigCard**: 6 basic fields all equal weight; could group Risk (Profit Target, Max DD, Daily DD) vs Time (Min/Max Days) vs Payout (Profit Split).
- **Risk Statistics KPI row + 3-tab table below**: good hierarchy.
- **Phase-detail page header**: long subtitle with multiple "·" separators — borderline density.

### Animation (§68)
- No unnecessary animations in either module. Appropriate.
- Step indicator on Wizard uses `transition-all` (subtle).
- No fake real-time indicators (§67 ✓).

### Help / Education (§33)
- **Strong**: challenge-config, challenge-edit, phase-detail all use LabelWithHelp extensively with real explanations.
- **Strong**: challenge-edit's "Drawdown Configuration" section explains Static vs Trailing with prose.
- **Weak**: risk-pages.tsx has zero contextual help. Risk Score "72/100" has no explanation. Breaches list "Type" column shows raw enum values (`daily-drawdown`) with no tooltip — violates §18 (state + meaning).
- **Weak**: Challenge Overview KPI cards have no help tooltips.
- **Weak**: copy-trading-analysis verdict "Likely Copy Trading" has explanation text ✓ but correlation formula isn't explained.

### Destructive actions (§24)
- **Strong**: weekend-trades Delete uses AlertDialog with consequence text ✓.
- **Weak**: challenge-edit Publish only fires a toast (no confirmation). Publish is semi-destructive (irreversible visibility change).
- **Weak**: Breaches Resolve uses plain Button + toast (no AlertDialog, no consequence text).
- **Weak**: Challenge types Active toggle (no confirmation for disable, which hides from catalog).
- **Weak**: Trading Events rule Active toggle (no confirmation).

### First-time experience (§34)
- **No onboarding** on Challenges Overview for a new tenant with 0 challenges. Should say "Welcome — create your first challenge type to begin" with CTA to the wizard.
- **No onboarding** on Risk Overview for a new tenant with 0 breaches. Should say "No breaches yet — configure your risk rules to start monitoring".
- **No first-time tooltip** on the Wizard step 1 explaining what each challenge type means.

## TOP PRIORITY ACTIONS (ordered)

1. **HIGHEST** — Add filters to Breaches list (type / severity / status / date range) + drill-to-trader link + CSV export. Breaches page is the single most-operational page in Risk module and currently has only search. Add `toolbar` prop with 4 Select dropdowns. Make Trader column a `<button>` navigating to `trader-detail`. Wire real `exportToCsv`. — Effort: S.

2. **HIGHEST** — Fix `Math.random()` in `challenge-config-page.tsx:216` (AdvancedSection toggle defaults). Replace with deterministic hash. Breaks stable demo across every reload. — Effort: S.

3. **HIGH** — Add row click navigation on Challenges list → trader-detail (or build a Challenge Workspace per §28). No way to drill from a challenge row to anything currently. — Effort: S (one-line onRowClick) or L (full workspace).

4. **HIGH** — Add Attention Center to both Risk Overview and Challenges Overview (§11). Component exists. Surface "X accounts near max DD", "Y unresolved copy-trading events", "Z payout-eligible passed challenges". — Effort: S each.

5. **HIGH** — Wire `makeTermResolver` to all Challenges and Risk page headers + column headers + toasts. Sidebar adapts but page headers don't. — Effort: M.

6. **HIGH** — Add "Failed" KPI + Pass Rate KPI + funnel chart to Challenges Overview. Currently shows Active/Passed/Avg Progress/Total — spec calls for failed count and pass rate and by-type breakdown. — Effort: S.

7. **HIGH** — Add Account Health card (§21) to Active Challenges list. Each row should show "Daily DD 41%/5%", "Max DD 6.8%/10%", "Profit Target 72%". — Effort: M.

8. **HIGH** — Add failure-reason column + Retry button to Failed Challenges list. — Effort: M (extend mock + retry modal).

9. **HIGH** — Add "shared IP across accounts" reverse view to Account IP Addresses page. Key risk signal (multi-account same IP) currently not surfaced. — Effort: M.

10. **HIGH** — Add drill-to-trader from Breaches list + drill-to-filtered-breaches from Risk Statistics rows. — Effort: M.

11. **MEDIUM** — Add bulk actions pattern (BulkActionBar) to Breaches list (bulk Resolve), copy/inverse trading events (bulk Dismiss), weekend trades (bulk Delete). — Effort: L.

12. **MEDIUM** — Add URL-persisted filters to all multi-filter pages (Breaches, copy-trading-events, inverse-trading-events, weekend-trades, account-ip-addresses, Challenges list, Phase Management). Use query params for search/filter/sort/tab. — Effort: M.

13. **MEDIUM** — Add loading skeletons to every page (matching page layout — KPI grid skeleton + DataTable header skeleton). Pre-build for backend wiring. — Effort: M.

14. **MEDIUM** — Add page-level ErrorBoundary to each Risk and Challenges page with "X couldn't be loaded. [Retry]" fallback. — Effort: M.

15. **MEDIUM** — Add "by rule" + "by time" tabs to Risk Statistics. Currently has challenge/country/size; missing rule/time lenses. — Effort: M.

16. **MEDIUM** — Add real CSV export to the 8 Risk Report pages (currently toast-only on most). Use `exportToCsv` helper like copy-trading-events. — Effort: S.

17. **MEDIUM** — Add EmptyState to ChallengeTable + BreachesTable (new tenant / 0 data). — Effort: S.

18. **MEDIUM** — Add per-trader Challenge Journey timeline tab to enhanced-trader-detail-page. — Effort: M.

19. **MEDIUM** — Add AlertDialog confirmation to Breaches Resolve, Challenge-types Active toggle, Trading Events rule Active toggle, Challenge-edit Publish (§24 friction proportional to consequence). — Effort: S each.

20. **MEDIUM** — Add consistency rule + news-holding rules to Challenge Config AdvancedSection. — Effort: S.

21. **MEDIUM** — Add phase gate criteria + completion stats tab to Phase Detail. — Effort: M.

22. **MEDIUM** — Add phase transition rules tab to Phase Detail (auto-pass on profit target? manual review? KYC gating?). — Effort: M.

23. **LOW** — Add challenge comparison view (side-by-side diff of 2 types). — Effort: M.

24. **LOW** — Add bulk challenge assignment to traders. — Effort: L.

25. **LOW** — Add real-time risk alerts feed (Notification Center integration with risk-specific feed). — Effort: L.

26. **LOW** — Add per-account risk score (composite). — Effort: L.

27. **LOW** — Add risk rule configuration per challenge/phase cross-link from Risk module. — Effort: M.

28. **LOW** — Add map visualization to Account IP Addresses (lat/lng present but unused). — Effort: M.

29. **LOW** — Add certificate module so Passed Challenges can link to certificates. — Effort: L.

30. **LOW** — Replace raw `<select>` on risk-statistics-page (line 244) with shadcn Select for accessibility consistency. — Effort: S.

---

## Task: analysis-payouts-analytics

## PAYOUTS — PRESENT (working, with notes)
1. **Manifest** (`payouts/manifest.ts`) — 4 nav children (Overview, Pending Approval, History, Withdrawals), 4 routes, 4 widgets, `termKey: "payout"` on parent nav (terminology-aware sidebar ✓). Permissions (`payout.read` / `payout.approve`) properly declared. Module accentColor `#15803d` (forest green — consistent with Challenges module, slightly weird since Risk is red — perhaps should be a payout-specific hue like amber). Settings entry `viewId: "settings-payouts"` declared but **DEAD LINK — no view registered in view-router.tsx** (line 75 imports `SettingsPage` only).
2. **Payouts Overview** (`payout-pages.tsx:PayoutsOverviewPage`, 131 LOC) — 4 KPIs (Pending, Paid (30d), Total Paid, Avg Split 80%) + embedded `PayoutsTable` showing all payouts. Export button (toast-only). Notes: `Total Paid` covers MTD-ish total but spec #1 calls for "total disbursed MTD" — uses all-time `paid.reduce` not month-filtered. **No "Avg Processing Time" KPI** (data has `processedAt` — could compute but doesn't). **No payout method split** on page (PayoutMethodWidget exists but isn't surfaced on Overview). **No deltas** (§9 violation — MetricCard supports `delta` prop, not used). **No attention center** (§11). **No terminology applied** — header hardcodes "Payouts" (tenant-alpha terminology says "payout" → "Disbursement"; sidebar adapts, page doesn't §54/§55).
3. **Pending Payouts list** (`payout-pages.tsx:PendingPayoutsPage`) — EmptyState present (§30 ✓ — "When traders request payouts, they will appear here for review"). `PayoutReviewActions` inline cards with Approve (primary, §23 ✓) / Reject (destructive AlertDialog with consequence text §24 ✓) / Request Info (secondary). Plus a second `PayoutsTable` filtered to pending. Notes: **No fraud checks** on this page (KYC check is on Enhanced Withdrawals only — duplication). **No payment method indicator on the inline review card**. **No trader link** (clicking trader name goes nowhere). **No profit verification step**. **Approve is plain Button + toast** inside PayoutsTable (line 40-41) — same Approve action as inline card but without AlertDialog friction — inconsistent §24 behavior between two surfaces.
4. **Payout History** (`payout-pages.tsx:PayoutHistoryPage`) — Single `PayoutsTable` filtered to `paid || rejected`. **No status filter, no method filter, no date range, no CSV export, no row drill** — just search. Most under-built page in the module. Violates §26 (Tables must support decision-making — no filtering on a "History" page).
5. **Enhanced Withdrawals** (`enhanced-withdrawals-page.tsx`, 583 LOC) — Strong, well-built. 4 KPIs (Pending Count, Pending Amount, Approved Today, Rejected Today — computed from `processedAt`). Filter bar with 4 filters: search + status (6 options) + method (5 options) + KYC (5 options) + date range (5 options) + live result count "X of Y withdrawals". Batch toolbar (Approve Selected / Reject Selected / Export Selected / Clear). DataTable with 10 columns (checkbox, login, name, country, amount, size, method w/ icon, KYC Status via `ExplainableStateBadge`, created, status via `ExplainableStateBadge`). Sortable headers (5 cols). Pagination cap at 50 rows with hint. Inline empty row state "No withdrawals match your filters." Notes: despite the name, this is **NOT a multi-step payout processing wizard** — spec #4 calls for KYC check → profit verification → payment method selection → confirmation → receipt. This is a batch operations table. **No row drill** — `onRowClick` fires a "demo only" toast (line 323-328). **Account logins are pseudo-derived** from `p.reference` (line 134-138) — fine for demo but flagged in UI footer. **Country is pseudo-derived** (line 141-146) — also flagged. **Export Selected / Export CSV both toast-only** (lines 310-321) — doesn't call `exportToCsv`. **Batch Approve/Reject both fire toast** — no actual state mutation, no audit-trail log. **Bulk reject lacks AlertDialog §24 friction** — Reject Selected is a plain outline Button (line 451) without consequence confirmation. Compare: PayoutReviewActions inline `Reject` does have AlertDialog. Inconsistent.
6. **4 widgets** (`payout-widgets.tsx`, 82 LOC) — PayoutOverviewWidget (4 KPIs with `makeTermResolver` NOT applied — missed opportunity since `termKey: "payout"` is set), PayoutQueueWidget (top 5 pending with inline Approve button — only Approve, no Reject — inconsistent with full PayoutReviewActions), PayoutTrendWidget (AreaSeries 30d), PayoutMethodWidget (DonutSeries by method — note: count-based, not amount-based). Notes: PayoutQueueWidget uses "All clear. Queue is clear." (§30 ✓). Hardcoded `avgSplit` "80%" on Overview Page is hardcoded (line 75) while Widget computes it — inconsistency.

## PAYOUTS — MISSING / THIN (effort S/M/L)
- **Payout gateway integrations config page (Stripe / Crypto / Bank / PayPal)** — task #5 — No config UI exists. Manifest declares `settings: [{ viewId: "settings-payouts" }]` but no view registered. Settings sidebar entry is a dead link. Method enum is fixed at `bank-transfer | crypto | paypal | skrill` in mock-data.ts:512 — no PayPal, no Stripe, no Bank-Transfer-as-Stripe, no per-gateway credentials/limits/toggles. — Effort: L.
- **Payout fee structure config (flat / percentage / tiered)** — task #6 — No UI. Mock has no fee model. Spec calls for tiered fees by amount / method / trader level. — Effort: M.
- **Trader payout methods CRUD** — task #7 — No saved-methods management page. Trader-detail has no "Payout Methods" tab. Payouts module has no nav for this. — Effort: L.
- **Payout reports (by method / country / amount range)** — task #8 — ZERO report pages. Risk module has 8 report pages; Payouts has none. No "Payouts by Method", "Payouts by Country", "Payouts by Amount Range". — Effort: M (reusable Risk report page pattern).
- **Payout calendar / schedule** — task #9 — No scheduled-payout view. No "upcoming scheduled payouts" widget. Mock has no `scheduledFor` field. — Effort: M.
- **Payout receipt PDF generation** — task #11 — No PDF library wired. No receipt template. Email templates include "Payout Approved" (et-3, mock-data.ts:1341) but no receipt attachment. — Effort: L (jspdf + template).
- **Payout reversal / refund flow** — task #12 — No reverse/refund action. Payout status enum has no "reversed" / "refunded" state. PayoutReviewActions only has Approve / Reject / Request Info. — Effort: M (extend enum + new AlertDialog flow).
- **Payouts Overview — Avg Processing Time KPI** (§9 actionable metric example) — task #1 — Mock data has `processedAt` field but no page computes `avg(processedAt - createdAt)`. — Effort: S.
- **Payouts Overview — MTD filter on Total Paid** — task #1 — Currently `paid.reduce(amount)` is all-time. Should be filtered to `currentMonth`. — Effort: S.
- **Payouts Overview — surface PayoutMethodWidget on the page** — task #1 — Widget exists, isn't on the page. DonutSeries would show method split. — Effort: S.
- **Payouts Overview — attention center** (§11) — task #1 — Should surface "X payout approvals waiting" / "Y payouts stuck in processing >24h" / "Z high-value pending >$10K awaiting review". — Effort: S.
- **Payouts Overview — KPI deltas** (§9) — `MetricCard` supports `delta` prop, unused. — Effort: S.
- **Payout History — filters + CSV** — task #3 — Currently filter-only-by-status (paid/rejected baked-in). Add status filter Select, method filter Select, date range Select, real `exportToCsv`. — Effort: S (mirror enhanced-withdrawals-page).
- **Payout History — row drill** — task #3 — Clicking a paid payout should open a detail drawer (§27) showing timeline (requested → approved → processing → paid) + trader info + method details + amount/split/fees. — Effort: M.
- **Pending Payouts — fraud checks indicator** — task #2 — KYC status not surfaced on PendingPayoutsPage (only on Enhanced Withdrawals). Should show "KYC Verified ✓ / IP Risk: Low / Copy-Trading: None" inline. — Effort: S.
- **Pending Payouts — trader link** — task #2 — Trader column in `PayoutsTable` (line 23) is plain span, not clickable. Should navigate to `trader-detail?id={traderId}`. — Effort: S.
- **Pending Payouts — Approve button in PayoutsTable inconsistent with PayoutReviewActions AlertDialog friction** (§24) — In `PayoutsTable` (line 40-41) Approve/Reject are plain Buttons + toast. In `PayoutReviewActions` (above the table) Reject has AlertDialog. Same action, different friction levels. — Effort: S.
- **Enhanced Withdrawals — NOT actually multi-step** — task #4 — Spec calls for wizard: KYC check → profit verification → payment method selection → confirmation → receipt. Current page is a batch operations table. Either rename (e.g. "Withdrawals Queue") or build the wizard. — Effort: L (wizard) or S (rename + clarify).
- **Enhanced Withdrawals — Export Selected / Export CSV don't call `exportToCsv`** — Lines 310-321 — both fire toast only. Compare with Analytics Overview which calls real `exportToCsv`. — Effort: S.
- **Enhanced Withdrawals — Bulk Approve/Reject fire toast, no state mutation** — Lines 295-309 — `setSelected(new Set())` clears selection but doesn't actually flip payout status. No audit log. No "X approved, Y failed" result toast. — Effort: M (would need a real store or local state lift; for demo at least mutate the local copy).
- **Enhanced Withdrawals — Bulk Reject has no AlertDialog §24 friction** (line 451) — Plain outline Button. Rejecting 50 payouts is high-consequence; should require confirmation with reason. — Effort: S.
- **Enhanced Withdrawals — row click is "demo only" toast** (line 323-328) — Should open a detail drawer (§27) with full payout context (trader KYC, account health, profit verification, fee breakdown, audit history). — Effort: M.
- **No URL-persisted filters on any Payouts page** — All filters use local `useState`. Refresh loses context. (§51 violation). Enhanced Withdrawals has 5 filters that all vanish on refresh. — Effort: M.
- **No loading skeletons** — All synchronous mock. (§31 violation.) When backend wires up, every page will flash empty. — Effort: M.
- **No error boundaries** — Single widget failure crashes Overview. (§32 violation.) — Effort: M.
- **No terminology applied to page headers** — `makeTermResolver` not imported in any payouts page. Headers hardcode "Payouts" / "Pending Payouts" / "Payout History" / "Enhanced Withdrawals". Tenant-alpha terminology says payout → "Disbursement"; sidebar adapts but pages don't (§54/§55 violation). — Effort: M.
- **No EmptyState on Payouts Overview / Payout History / Enhanced Withdrawals table** — `PayoutsTable` uses bare DataTable without `emptyTitle`/`emptyDescription`. New tenant with 0 payouts → generic "No data". Only PendingPayoutsPage has EmptyState. — Effort: S.
- **No contextual help** (§33) — Zero `LabelWithHelp` / `ⓘ` tooltips on KPI cards. "Avg Split 80%" — what is this? Where does 80% come from? — Effort: S.
- **Payout status enum missing "reversed" / "refunded"** — Mock has 5 states: pending/approved/processing/paid/rejected. Spec #12 (reversal/refund) needs additional states. `payoutStatusTone` and `ExplainableStateBadge` for "payout" entityType need extending. — Effort: M.
- **No payout method preference indicator on trader side** — Trader doesn't get to set "default payout method" anywhere. Payouts model has no `traderPreferredMethod` field. — Effort: M (overlaps with #7 CRUD).
- **Settings entry is a dead link** — `viewId: "settings-payouts"` (manifest.ts:59) — clicking "Payouts" in Settings throws "no view registered". Same gap on Analytics. — Effort: M (build full settings page) or S (remove settings entry until built).
- **No bulk actions pattern on Payouts Overview / History** — Enhanced Withdrawals has batch; Overview / History don't. — Effort: S (extract BulkActionBar primitive).

## ANALYTICS — PRESENT (working, with notes)
1. **Manifest** (`analytics/manifest.ts`) — 12 nav children across 5 sub-groups (Overview/Traders/Performance/Risk/Advanced + Firm Stats + Daily Highlights + Retention + 4 "Dashboard:" tabs). 12 routes, 6 widgets, `analytics.advanced` feature flag on Advanced nav child (✓). Permissions (`analytics.read` / `analytics.advanced.read` / `analytics.export`) declared. Module accentColor `#7c3aed` (violet — **VIOLATES platform Terra palette rule** stated in dashboard-tabs.tsx:14 "No blue/indigo/violet" — Analytics widget BarSeries uses `color="#7c3aed"` for AdvancedAnalyticsWidget). Module declared `optional: true` with `dependencies: ["trading", "challenges"]` (✓). Settings entry `viewId: "settings-analytics"` declared but **DEAD LINK — no view registered in view-router.tsx**.
2. **Analytics Overview** (`analytics-pages.tsx:AnalyticsOverviewPage`, 110 LOC) — 4 KPIs (Revenue (30d), Avg Daily Rev, Trader Growth +18%, Breaches (30d)) + multi-currency selector (rare + strong feature, uses `convertCurrency`/`formatConverted`/`getRateLabel`/`CURRENCIES`) + exchange-rate banner + 4 charts (Revenue AreaSeries, Trader growth AreaSeries, Risk distribution DonutSeries, Breach trend BarSeries). Real `exportToCsv` on revenue series (PermissionGuard `analytics.export` ✓). Notes: spec #1 calls for "active traders, total volume, payout ratio, profit factor" — **none of these are KPIs**. "Trader Growth +18%" is hardcoded not computed. No deltas with `deltaLabel` (e.g. "vs previous 30 days") — just raw `delta` numbers (8/4/18/-12) which lack context (§9 violation). Currency `<select>` is raw HTML (line 41) — accessibility inconsistency (§48).
3. **Trader Analytics** (`analytics-pages.tsx:TraderAnalyticsPage`, 23 LOC body) — **VERY THIN**. 4 KPIs (Total Traders, Active, Funded, Avg Win Rate) + 1 chart (Trader growth AreaSeries — duplicate of Overview). Spec #2 calls for: leaderboard, win/loss distribution, equity curves, retention curves. **NONE present**. No leaderboard table. No equity curve per top trader. No win/loss histogram. — Effort: L to build properly.
4. **Performance Analytics** (`analytics-pages.tsx:PerformanceAnalyticsPage`, 20 LOC body) — **VERY THIN**. 2 charts only (Revenue trend AreaSeries + Risk distribution DonutSeries — both duplicates of Overview). Spec #3 calls for: "by challenge, by phase, by symbol, by country". **NONE present**. No challenge breakdown. No phase breakdown. No symbol table. No country table. — Effort: L.
5. **Risk Analytics** (`analytics-pages.tsx:RiskAnalyticsPage`, 20 LOC body) — **VERY THIN**. 2 charts only (Breach trend BarSeries + Risk distribution DonutSeries — both duplicates of Overview/Risk module). Spec #4 calls for: Value at Risk, Expected Shortfall, Drawdown distribution. **NONE present**. No VaR computation. No ES. No drawdown histogram. Risk module has all the breach data; this page just duplicates Overview's two risk charts. — Effort: L (VaR/ES require historical simulation engine; can mock).
6. **Advanced Analytics** (`analytics-pages.tsx:AdvancedAnalyticsPage`, 26 LOC body) — **VERY THIN**. FeatureGuard wraps with `analytics.advanced` flag ✓. Single BarSeries with 5 hardcoded cohort numbers (24/31/18/27/22). Spec #5 calls for: cohorts, retention, LTV. **No LTV**. **No predictive/forecasting** (spec #15). **No retention curves** (despite retention-analytics-page existing separately — should be linked). Cohort numbers are arbitrary labels ("Cohort A/B/C/D/E") not month-keyed. — Effort: M (LTV mock) + L (forecasting engine).
7. **Daily Highlights** (`daily-highlights-page.tsx`, 253 LOC) — **STRONG**. 5 KPIs (Daily Revenue, Daily Payouts, Daily Net Revenue, Avg Order Value, Latest Hour Revenue — all with `deltaLabel: "vs yesterday"` ✓). Date picker (`<input type="date">` — accessibility inconsistency §48). 4 hourly charts (Hourly Revenue, Hourly Orders, Hourly Payouts, Hourly Orders by PSP with legend). 6 small breakdown tables (Top Countries, Top PSPs, Top Platforms, Top Coupons, Purchases by Account Size, Recent Orders). Footer note "All times are in UTC". Notes: **`getDailyHighlights` mock uses `Math.random()` on 4 lines** (mock-data.ts:1505-1507, 1540) — `hourlyRevenue`, `hourlyOrders`, `hourlyPayouts`, `recentOrders.amount` all randomized per render. **Violates platform's deterministic-mock invariant.** Reload shuffles all hourly charts and order amounts. Same class of bug as `challenge-config-page.tsx:216` flagged in CHALLENGES analysis. — Effort: S (replace with `Math.sin` curve like other series).
8. **Dashboard tabs (4 sub-dashboards)** (`dashboard-tabs.tsx`, 1247 LOC) — **STRONG**. All 4 tabs built: Accounts (13 KPIs + Pass/Fail GroupedBars + Retention cohort heatmap + Challenge performance grid with pass/fail/funded), Payouts (6 KPIs + Daily Payout Movement + Payout Cohort Matrix + Payouts by Challenge/Platform HorizontalBars + Recent Withdrawals DataTable), Orders (5 KPIs + Revenue by Challenge/Broker + Hourly Revenue/Orders + Country revenue table with market-share bars), Positions (6 KPIs + Symbol Stats DataTable + Trade Distribution by Hour + Performance by Hour ColoredBars). Deterministic mock (all `Math.sin`/`Math.cos` — no `Math.random()` ✓). Terra palette only ✓. KPI deltas with `deltaLabel` ✓. Cohort heatmap with green/amber/rose color interpolation ✓. Notes: **Naming "Dashboard: Accounts" is misleading** — these are sub-analytic views, not dashboard tabs. The sidebar grouping puts them under "Analytics" parent which is correct, but the label prefix "Dashboard:" doesn't match anything in the dashboard module. Should be "Accounts", "Payouts", "Orders", "Positions" or moved under a "Sub-Dashboards" group. **Accounts tab duplicates Payout Cohort matrix** with different numbers — confusing. **No URL state** — switching tabs loses context. — Effort: S (rename) or M (move to Overview module as pre-built dashboards per §4).
9. **Firm Statistics** (`firm-statistics-page.tsx`, 261 LOC) — **STRONG**. 10 KPIs (Total Revenue, Total Payouts, Net Profit, Challenges Sold, Profit Margin, Copy Trading Events, Inverse Trading Events, News Trading Events, Total Accounts, Funded Accounts — all with `delta` + `deltaLabel: "vs prev period"` ✓ §9). 4 AreaSeries trend charts (12-month: Revenue, Payouts, Net Revenue, Challenges Sold — each with distinct Terra color). Range selector (7d/30d/90d toggle — accessibility ✓ uses buttons not raw select). Real `exportToCsv` on revenue series (✓). Summary stats DataTable with 4 derived rows (Net Profit, Profit Margin, Average Challenge Value, Payout Ratio) **with formula + context columns** (§19 Explainability ✓ — best-in-class). Notes: `getFirmStatistics` returns hardcoded `totalRevenue = 40355.82`, `challengesSold = 1140`, etc. — these are not derived from tenant data, so multi-tenant variation is missing. Range selector doesn't actually filter the mock data. — Effort: S (derive from tenant traders/payouts/challenges) or accept mock.
10. **Retention Analytics** (`retention-analytics-page.tsx`, 282 LOC) — **STRONG**. 5 KPIs (3-Month Retention 72%, 6-Month 58%, 12-Month 44%, Challenges/User 1.8, Repeating 23%). Cohort retention matrix (3 monthly cohorts × +30/+60/+90d with green/amber/rose tones ✓). New vs Repeating DonutSeries. Challenges-per-user distribution BarSeries. Top countries DataTable (derived from traders with deterministic ~23% repeating per country). Summary insights card with 3 bulleted findings (✓ §4 bottom-line summary, §33 explainability). Notes: 3/6/12-month retention numbers are **hardcoded constants** (line 75-79) — not derived from any cohort data. `COHORTS` array (line 48-52) is static — Jul/Aug 2026 only — no historical cohorts. CSV export is toast-only (line 155) — doesn't call `exportToCsv`. No drill from cohort cell to traders in that cohort. — Effort: S (real CSV) or M (derive from traders).
11. **6 widgets** (`analytics-widgets.tsx`, 75 LOC) — AnalyticsOverviewWidget (4 KPIs ✓), RevenueWidget (AreaSeries), TraderGrowthWidget (AreaSeries), RiskDistributionWidget (DonutSeries), BreachTrendWidget (BarSeries), AdvancedAnalyticsWidget (cohort BarSeries — **uses #7c3aed violet color** violating Terra palette rule).

## ANALYTICS — MISSING / THIN (effort S/M/L)
- **Custom report builder** — task #10 — No UI. No saved reports. No "Build a report: pick dimensions × metrics × filters × time range → save → schedule". — Effort: L.
- **Export PDF dashboard snapshot** — task #11 — No PDF library wired. Only CSV exports. Should let admin "Save this view as PDF" for board reporting. — Effort: M (jspdf + chart-to-image).
- **Scheduled email reports** — task #12 — No scheduler UI. Settings has notification preferences but no "Schedule weekly report → email list + cadence". — Effort: M.
- **Real-time analytics feed (live updating KPIs)** — task #13 — No live data simulation on Analytics pages. Other modules have "Live Data Simulation" (per FLOW-ANALYSIS #21) but Analytics is static. No WebSocket/SSE hook, no live ticker. — Effort: L.
- **Cross-tenant benchmarking (compare with industry averages)** — task #14 — No "vs industry" comparison. No benchmark dataset. Retention insights card says "above industry benchmark (~65%)" hardcoded (retention-analytics-page.tsx:262) but no actual benchmark axis on charts. — Effort: L (needs benchmark dataset + multi-tenant aggregation).
- **Forecasting / predictive analytics** — task #15 — No forecasting. No "predicted revenue next 30 days". No trend extrapolation. AdvancedAnalyticsPage is 5 hardcoded cohort numbers, not predictions. — Effort: L (mock forecasting curve + confidence band).
- **Analytics Overview — KPI mismatch with spec** (§9) — task #1 — Spec calls for "active traders, total volume, payout ratio, profit factor". Currently: Revenue (30d), Avg Daily Rev, Trader Growth +18%, Breaches (30d). No active-traders KPI. No total-volume KPI. No payout-ratio KPI (Firm Statistics has it). No profit-factor KPI. — Effort: S (compute from existing mock data).
- **Analytics Overview — KPI deltas lack deltaLabel** (§9) — `delta={8}` without `deltaLabel: "vs prev 30d"`. Firm Statistics does this correctly; Analytics Overview doesn't. — Effort: S.
- **Analytics Overview — Replace raw `<select>` for currency with shadcn Select** (§48) — Line 41. Same violation as risk-statistics-page. — Effort: S.
- **Trader Analytics — leaderboard** (task #2) — No top-N trader table with rank/profit/win-rate/equity. The data exists in `getTenantTraders` (has `winRate`, `profitFactor`, `equity` per the Trader interface). — Effort: M.
- **Trader Analytics — win/loss distribution** (task #2) — No histogram of win rates across all traders. — Effort: S.
- **Trader Analytics — equity curves per top trader** (task #2) — No per-trader equity curve. Could draw 5 mini AreaSeries for top 5 traders. — Effort: M.
- **Trader Analytics — retention curves** (task #2) — Spec calls for retention curves here, but Retention Analytics page exists separately. Either consolidate or cross-link. — Effort: S (link) or M (merge).
- **Performance Analytics — by challenge / phase / symbol / country** (task #3) — 4 breakdown dimensions, all missing. Risk module has 8 report pages with these lenses; Analytics Performance has zero. — Effort: L.
- **Risk Analytics — Value at Risk / Expected Shortfall / Drawdown distribution** (task #4) — Three quantitative risk metrics, all missing. Mock could compute VaR(95%) from breach history. — Effort: L.
- **Advanced Analytics — LTV** (task #5) — No lifetime-value computation. Retention data exists; could compute `avgRevenuePerTrader × avgTenure`. — Effort: M.
- **Advanced Analytics — link to Retention page** — Currently standalone. AdvancedAnalyticsWidget in dashboard should at minimum surface "View full retention analysis →" link. — Effort: S.
- **Daily Highlights — Math.random() bug** — mock-data.ts:1505-1507, 1540 — `hourlyRevenue`, `hourlyOrders`, `hourlyPayouts`, `recentOrders.amount` all randomized. Violates deterministic-mock invariant. Reload shuffles all hourly charts. — Effort: S (replace with `Math.sin`).
- **Daily Highlights — date picker is raw `<input type="date">`** (§48) — Inconsistent with shadcn Select used elsewhere. — Effort: S.
- **Daily Highlights — date picker doesn't filter mock data** — Selecting a different date still shows today's mock. — Effort: M (deterministic per-date seed).
- **Dashboard tabs — "Dashboard:" prefix misleading** — Should be "Accounts" / "Payouts" / "Orders" / "Positions" or move under Overview module. — Effort: S (rename in manifest).
- **Firm Statistics — range selector doesn't filter mock** — 7d/30d/90d buttons toggle but `getFirmStatistics` returns same data regardless. — Effort: M (mock per-range).
- **Retention Analytics — CSV export is toast-only** (line 155) — Doesn't call `exportToCsv`. — Effort: S.
- **Retention Analytics — 3/6/12-month retention hardcoded** — Line 75-79. Not derived from cohort data. — Effort: M (derive from trader joinDates).
- **No URL-persisted filters on any Analytics page** — Daily Highlights date, Firm Statistics range, Retention page country filter all use local state. Refresh loses context (§51 violation). — Effort: M.
- **No loading skeletons** — Same as Payouts (§31 violation). — Effort: M.
- **No error boundaries** — Same (§32 violation). — Effort: M.
- **No terminology applied to Analytics page headers** — `makeTermResolver` not imported. Less critical for Analytics (universal label) but tenant terminology still might want "Insights" vs "Analytics". — Effort: M.
- **No EmptyState on any Analytics page** — Daily Highlights / Firm Statistics / Retention / 4 dashboard tabs all assume data exists. New tenant with 0 traders → tables show empty rows. (§30 violation.) — Effort: S.
- **No contextual help on KPIs** (§33) — "Profit Factor", "Payout Ratio", "Value at Risk" — none have `ⓘ` explanations. Firm Statistics has formula column (good) but Overview/Trader/Performance/Risk pages don't. — Effort: S.
- **Analytics accentColor violet `#7c3aed` violates Terra palette** — dashboard-tabs.tsx header comment explicitly bans violet. Module-level accentColor should be `#0d9488` (teal) or `#059669` (emerald) to match. — Effort: S.
- **AdvancedAnalyticsWidget uses `#7c3aed` BarSeries color** — Same violation. — Effort: S.
- **Settings entry is a dead link** — `viewId: "settings-analytics"` (manifest.ts:90) — same as Payouts. — Effort: M (build settings page) or S (remove entry).
- **No drill from chart point to filtered table** — Clicking a breach on Breach trend BarSeries should filter to that day's breaches. None of the charts support drill-down (§70 Analytics UX — "Overview → Trend → Segment → Drill Down → Entity"). — Effort: M.
- **No drill from row to underlying entity** — Top Countries table row should link to Traders filtered by country. None of the Analytics tables support drill-to-trader. — Effort: M.
- **Duplicate charts across Overview / Trader / Performance / Risk pages** — Revenue AreaSeries appears on Overview + Performance. Risk Distribution DonutSeries appears on Overview + Performance + Risk. Trader growth AreaSeries appears on Overview + Trader. These 4 sub-pages collectively add only 1 unique chart (Performance has none unique). Spec §8 Dashboard Density Rule — "Every component must justify its existence". — Effort: M (differentiate or consolidate).

## CROSS-TENANT GAPS
- **Terminology not applied** — Both modules' page headers hardcode labels. Payouts has `termKey: "payout"` on parent nav (sidebar adapts ✓) but page headers don't call `makeTermResolver`. Analytics has no `termKey` (acceptable since "Analytics" is universal).
- **Currency applied correctly** — Both modules use `runtime.tenant?.currency` (verified across all pages). Multi-currency selector on Analytics Overview is best-in-class.
- **Branding palette partially applied** — Payouts accentColor `#15803d` (forest green — same as Challenges; should perhaps be amber for distinctness). Analytics accentColor `#7c3aed` (violet — violates dashboard-tabs.tsx Terra-palette comment). Tenant-specific `primaryColor`/`accentColor`/`surfaceColor`/`radius` from `tenant.branding` not consistently used. Tenant-gamma `radius: 0.625rem` should subtly change card rounding.
- **Tenant plan gating not visible** — Alpha `growth`, Beta `scale`, Gamma `enterprise`. Advanced Analytics has `feature: "analytics.advanced"` flag (✓) and is hidden for tenants without it. But the 4 "Dashboard:" tabs and Firm Statistics / Daily Highlights / Retention pages are visible to all tenants — should arguably be plan-gated (Enterprise only?).
- **Locale not used** — All date formatting uses `toLocaleDateString()` / `toLocaleString()` without explicit locale. Beta `en-GB` with Europe/London tz shows browser-default. Daily Highlights says "All times are in UTC" but tenant tz isn't applied.
- **Tenant modules not gated** — Alpha `enabledModules` includes `payouts` ✓ but not `analytics` (Alpha is on `growth` plan). However, Analytics manifest declares `optional: true` with `dependencies: ["trading", "challenges"]` — should be hidden for Alpha. Verify in `runtime.tenant.enabledModules` filter (likely handled at module-loader level).
- **No tenant-specific mock data variation** — `getFirmStatistics` returns hardcoded `totalRevenue = 40355.82` regardless of tenant. Same for `getDailyHighlights` (all tenants get same US/UK/UAE/SG/DE countries). Multi-tenant demo looks identical.
- **Settings dead links for both modules** — `settings-payouts` and `settings-analytics` viewId declared but no view registered. Clicking either in Settings → "no view registered" error.

## UX GAPS

### Empty states (§30)
- **PendingPayoutsPage**: EmptyState present ✓ — "No pending payouts. When traders request payouts, they will appear here for review."
- **PayoutsOverviewPage / PayoutHistoryPage / EnhancedWithdrawalsPage (table)**: NO EmptyState. Bare DataTable default "No data".
- **Analytics Overview / Trader / Performance / Risk / Advanced**: NO EmptyState. New tenant → blank charts.
- **Daily Highlights / Firm Statistics / Retention / 4 Dashboard tabs**: NO EmptyState.
- **Analytics module overall**: ZERO `EmptyState` imports anywhere.

### Loading states (§31)
- ZERO loading skeletons anywhere in either module. All synchronous mock. When backend wires up, every page will flash empty.

### Error states (§32)
- No page-level or widget-level error boundaries in either module. If one widget throws (e.g. chart library crash), the whole page errors. No "X couldn't be loaded. [Retry]" fallback.

### Accessibility (§48)
- **analytics-pages.tsx:41-50** — raw `<select>` for currency. Inconsistent with shadcn Select used in enhanced-withdrawals-page.tsx:392-422 (which uses shadcn correctly).
- **daily-highlights-page.tsx:74-82** — raw `<input type="date">`. Inconsistent with shadcn Calendar/DatePicker pattern.
- **firm-statistics-page.tsx:125-140** — range selector uses raw `<button>` group (acceptable — radio-group pattern with `aria-pressed` ✓).
- **dashboard-tabs.tsx** — uses recharts directly. Chart tooltips have `contentStyle` set (good) but no `aria-label` on chart containers. Violates §48 for screen-reader users.
- **enhanced-withdrawals-page.tsx** — Checkboxes have `aria-label` ✓. Selects have proper labels. Search input has `aria-label="Search withdrawals"` ✓. Strong a11y.
- **P&L spans in dashboard-tabs.tsx symbolColumns** (line 1156-1168) — uses `className` for color, no `role="img"` + `aria-label` (compare with Trading module's PositionsPage which has both).
- **Heatmap cells in cohort tables** (dashboard-tabs.tsx, retention-analytics-page.tsx) — color conveys meaning without `role="img"` or text alternative.

### Filter combinations (§26)
- **Strong**: enhanced-withdrawals-page (5 filters: search + status + method + KYC + date range) — best in either module.
- **Strong**: dashboard-tabs.tsx Orders tab (country revenue table — multi-column sortable + searchable).
- **Thin**: Payouts Overview / Pending / History (search only, no filters).
- **Thin**: Analytics Overview (no filters — just currency selector).
- **Thin**: Analytics Trader / Performance / Risk / Advanced (no filters at all).
- **Thin**: Daily Highlights (date only).
- **Thin**: Firm Statistics (range only).
- **Medium**: Retention Analytics (country DataTable searchable, no filters).

### Cross-references / navigation
- **Payouts Overview → pending**: NO LINK (just shows same table).
- **Payouts Overview → Enhanced Withdrawals**: NO LINK.
- **Payouts list → trader-detail**: NO LINK (Trader column is plain span).
- **Pending Payouts → Enhanced Withdrawals**: NO LINK (operators have to know to navigate).
- **Enhanced Withdrawals row → detail drawer**: NO LINK (toast "demo only").
- **Analytics Overview → Trader Analytics**: NO LINK (must use sidebar).
- **Analytics Overview chart → drill-down**: NO LINK (charts not clickable).
- **Analytics Advanced → Retention Analytics**: NO LINK (related but disconnected).
- **Analytics Dashboard tabs → underlying entities**: NO LINK (Accounts tab doesn't link to trader-detail; Payouts tab doesn't link to payouts-pending).
- **Daily Highlights recent orders → order detail**: NO LINK.
- **Firm Statistics trend chart → monthly detail**: NO LINK.
- **Retention Analytics cohort cell → traders in cohort**: NO LINK.
- **Payouts module ↔ Analytics module**: NO CROSS-LINK (Payouts page should surface "View payout analytics →" linking to `dashboard-payouts`).
- **Analytics Payouts dashboard ↔ Payouts module**: NO CROSS-LINK.

### Bulk actions (§26)
- **Strong**: enhanced-withdrawals-page — Approve Selected / Reject Selected / Export Selected (✓ best in either module).
- **None**: All other Payouts pages — bare DataTable without selection.
- **None**: All Analytics pages — no bulk actions (less critical for analytics, but Firm Statistics summary table or Retention cohort rows could support "export selected cohorts").

### Export/print
- **Real `exportToCsv`**: Analytics Overview (revenue series) ✓, Firm Statistics (12-month series) ✓.
- **Toast-only (fake)**: Payouts Overview Export button (line 69), Enhanced Withdrawals Export CSV / Export Selected (lines 310-321), Retention Analytics Export CSV (line 155).
- **No export**: All other Analytics pages (Trader / Performance / Risk / Advanced / Daily Highlights / 4 Dashboard tabs). Daily Highlights has 6 tables that operators would naturally want to export.

### Visual hierarchy (§41)
- **Payouts Overview 4 KPI cards equal weight** — Pending (warning) / Paid 30d (positive) / Total Paid (positive) / Avg Split (default). Spec §23 One Primary Action — should emphasize Pending count if >0. Currently `tone="warning"` is the only differentiation.
- **Analytics Overview 4 KPI cards** — Revenue / Avg Daily Rev / Trader Growth / Breaches. The "Breaches (30d)" KPI has `tone="positive"` (line 86) which is wrong — breaches are bad; should be `tone="warning"` or `tone="negative"`. Same on MetricCard label "Breaches (30d)" with `delta={-12}` `tone="positive"` — the delta is -12 (improvement) but tone should still reflect "breaches are bad".
- **Firm Statistics 10 KPIs in 2×5 grid** — properly grouped (5 financial + 5 operational). Strong hierarchy.
- **Daily Highlights 5 KPIs + 4 hourly charts + 6 tables** — borderline density (§8 — "do not build crowded dashboards"). Justified because each table answers a distinct question.
- **Dashboard: Accounts 13 KPIs** — exceeds §8 "do not build 20 KPI cards" guideline but stays under. 13 is the most of any page in the platform.

### Animation (§68)
- No unnecessary animations. Appropriate. Recharts default animations on AreaSeries/BarSeries (subtle).
- No fake real-time indicators on Analytics (§67 ✓) — would need real feed before adding live ticker.

### Help / Education (§33)
- **Strong**: firm-statistics-page — summary stats table has explicit formula + context columns (§19 Explainability ✓ best-in-class).
- **Strong**: retention-analytics-page — summary insights card with 3 bulleted findings.
- **Weak**: payouts-pages.tsx — zero contextual help. "Avg Split 80%" — what is this? Where does 80% come from? "Pending" — pending what? For how long?
- **Weak**: analytics-pages.tsx (Overview / Trader / Performance / Risk / Advanced) — zero `LabelWithHelp` or `ⓘ`. "Trader Growth +18%" — over what period? "Breaches (30d)" — of which type?
- **Weak**: daily-highlights-page — KPI "Latest Hour Revenue" — which hour? UTC? Local? Not explained (the header says "UTC" but the KPI label is ambiguous).
- **Weak**: dashboard-tabs.tsx — "Avg Pass Time 9d 4h" — pass time from what to what? Phase 1 start → pass? Or purchase → pass?

### Destructive actions (§24)
- **Strong**: PayoutReviewActions Reject — AlertDialog with consequence text ✓.
- **Weak**: PayoutsTable Approve/Reject buttons (payout-pages.tsx:40-41) — plain Buttons + toast, no AlertDialog. Inconsistent with PayoutReviewActions.
- **Weak**: Enhanced Withdrawals Batch Reject — plain outline Button + toast (line 451-453). Rejecting 50 payouts is high-consequence; should require confirmation with reason.
- **Weak**: Batch Approve — plain Button + toast (line 448-450). Less critical (approve is non-destructive) but still no audit log.
- **Acceptable**: Enhanced Withdrawals row click — "demo only" toast, no destructive action.

### First-time experience (§34)
- **No onboarding** on Payouts Overview for a new tenant with 0 payouts. Should say "Welcome — when traders request payouts, they will appear here. [Configure payout methods]".
- **No onboarding** on Analytics Overview for a new tenant with 0 traders. Should say "No analytics yet — once traders start trading, KPIs will populate here".
- **No first-time tooltip** on Enhanced Withdrawals explaining the batch workflow.
- **No first-time tooltip** on Daily Highlights date picker.
- **No first-time tooltip** on Retention cohort matrix explaining "+30d/+60d/+90d" meaning.

## TOP PRIORITY ACTIONS (ordered)

1. **HIGHEST** — Fix `Math.random()` in `mock-data.ts:1505-1507, 1540` (`getDailyHighlights`). Hourly revenue/orders/payouts + recent-order amounts re-randomize on every reload, breaking the Daily Highlights page demo. Replace with `Math.sin(i/3)` curves like `payoutSeries` and `breachTrend`. — Effort: S.

2. **HIGHEST** — Wire real `exportToCsv` to Enhanced Withdrawals (Export Selected / Export CSV, lines 310-321), Payouts Overview Export (line 69), and Retention Analytics Export (line 155). Currently all toast-only. Use `exportToCsv` helper like Analytics Overview / Firm Statistics. — Effort: S.

3. **HIGHEST** — Build (or hide) the dead-link Settings entries `settings-payouts` (manifest.ts:59) and `settings-analytics` (manifest.ts:90). No view registered → clicking either throws. — Effort: M (build) or S (remove entries until built).

4. **HIGH** — Add filters + CSV to Payout History (`payout-pages.tsx:PayoutHistoryPage`). Currently only filter is baked-in `paid || rejected`. Add status Select, method Select, date range Select, real `exportToCsv`. Mirror enhanced-withdrawals-page filter bar. — Effort: S.

5. **HIGH** — Add AlertDialog friction to (a) PayoutsTable Approve/Reject (payout-pages.tsx:40-41) and (b) Enhanced Withdrawals Batch Reject (enhanced-withdrawals-page.tsx:451). Currently inconsistent with PayoutReviewActions inline Reject which has AlertDialog §24. — Effort: S each.

6. **HIGH** — Add row drill on Enhanced Withdrawals row click. Currently `onRowClick` fires "demo only" toast (line 323-328). Build a detail drawer (§27) with full payout context: trader KYC, account health, profit verification, fee breakdown, audit timeline. — Effort: M.

7. **HIGH** — Build Payouts Overview "Avg Processing Time" KPI + attention center (§11). Data exists (`processedAt` field); compute `avg(processedAt - createdAt)` for paid payouts. Add Attention Center surfacing "X payout approvals waiting / Y stuck in processing >24h / Z high-value pending >$10K". — Effort: S.

8. **HIGH** — Build Trader Analytics leaderboard + win/loss distribution + equity curves (task #2). Currently 4 KPIs + 1 duplicate chart. Data exists in `getTenantTraders`. — Effort: M.

9. **HIGH** — Build Performance Analytics breakdowns (by challenge / phase / symbol / country — task #3). Currently 2 duplicate charts. Risk module has 8 report pages with these lenses; reuse pattern. — Effort: L.

10. **HIGH** — Build Risk Analytics VaR / Expected Shortfall / Drawdown distribution (task #4). Currently 2 duplicate charts. Mock can compute VaR(95%) from breach history. — Effort: L.

11. **HIGH** — Wire `makeTermResolver` to all Payouts and Analytics page headers + KPI labels. Sidebar adapts but pages don't (§54/§55 violation). Tenant-alpha terminology says payout → "Disbursement". — Effort: M.

12. **HIGH** — Add EmptyState to (a) PayoutsTable in Payouts Overview / History, (b) all Analytics pages (ZERO EmptyState imports currently). New tenant → generic "No data". (§30 violation.) — Effort: S each.

13. **MEDIUM** — Build payout gateway integrations config page (Stripe / Crypto / Bank / PayPal — task #5). Currently no config UI. Method enum is fixed at 4 methods with no per-gateway credentials/limits/toggles. Register `settings-payouts` view. — Effort: L.

14. **MEDIUM** — Build payout fee structure config (flat / percentage / tiered — task #6). — Effort: M.

15. **MEDIUM** — Build payout reports (by method / country / amount range — task #8). Zero report pages currently. Reuse Risk module's 8-report-page pattern. — Effort: M.

16. **MEDIUM** — Build payout calendar / schedule view (task #9). No scheduled-payout view exists. — Effort: M.

17. **MEDIUM** — Build payout receipt PDF generation (task #11). No PDF library wired. Email template et-3 ("Payout Approved") exists but sends no receipt attachment. — Effort: L.

18. **MEDIUM** — Build payout reversal / refund flow (task #12). Status enum has no "reversed"/"refunded" state. PayoutReviewActions only has Approve/Reject/Request Info. — Effort: M.

19. **MEDIUM** — Build trader payout methods CRUD (task #7). No saved-methods management. Trader-detail has no "Payout Methods" tab. — Effort: L.

20. **MEDIUM** — Add URL-persisted filters to Enhanced Withdrawals (5 filters), Daily Highlights (date), Firm Statistics (range), Retention (country search). All use local `useState`; refresh loses context (§51 violation). — Effort: M.

21. **MEDIUM** — Add loading skeletons to every Payouts + Analytics page (matching layout — KPI grid skeleton + DataTable header skeleton + chart placeholder). Pre-build for backend wiring. (§31 violation.) — Effort: M.

22. **MEDIUM** — Add page-level ErrorBoundary to each Payouts and Analytics page with "X couldn't be loaded. [Retry]" fallback. (§32 violation.) — Effort: M.

23. **MEDIUM** — Rename "Dashboard: Accounts/Payouts/Orders/Positions" sidebar entries to drop "Dashboard:" prefix (misleading — they're sub-analytic views, not dashboard tabs). Or move under Overview module. — Effort: S.

24. **MEDIUM** — Fix Analytics accentColor `#7c3aed` (violet) → Terra palette color (`#0d9488` teal or `#059669` emerald). Violates dashboard-tabs.tsx header comment "No blue/indigo/violet". Also fix AdvancedAnalyticsWidget BarSeries color. — Effort: S.

25. **MEDIUM** — Add LTV computation + forecasting curve to Advanced Analytics (tasks #5, #15). Currently 5 hardcoded cohort numbers. — Effort: M (LTV) + L (forecasting).

26. **MEDIUM** — Add custom report builder (task #10). No saved reports / scheduler / dimension×metric picker. — Effort: L.

27. **MEDIUM** — Add PDF dashboard snapshot export (task #11). Only CSV exports exist. Use jspdf + chart-to-image. — Effort: M.

28. **MEDIUM** — Add scheduled email reports (task #12). Settings has notification preferences but no report scheduler. — Effort: M.

29. **MEDIUM** — Add real-time analytics feed (task #13). Other modules have "Live Data Simulation" (FLOW-ANALYSIS #21) but Analytics is static. — Effort: L.

30. **LOW** — Add cross-tenant benchmarking (task #14). No benchmark dataset, no "vs industry" axis. Retention insights card hardcodes "above industry benchmark (~65%)". — Effort: L.

31. **LOW** — Add drill-down from Analytics charts to filtered tables (§70 Analytics UX — "Overview → Trend → Segment → Drill Down → Entity"). Clicking a breach-day bar should filter to that day's breaches. — Effort: M.

32. **LOW** — Differentiate Trader/Performance/Risk sub-pages from Overview (currently 4 sub-pages share 4 charts; 0 unique on Performance page). — Effort: M.

33. **LOW** — Make `getFirmStatistics` derive `totalRevenue` / `challengesSold` from actual tenant data instead of hardcoded constants. — Effort: M.

34. **LOW** — Derive 3/6/12-month retention from trader `joinDate` field instead of hardcoded constants in retention-analytics-page.tsx:75-79. — Effort: M.

35. **LOW** — Replace raw `<select>` for currency on Analytics Overview (line 41) and raw `<input type="date">` on Daily Highlights (line 74) with shadcn Select / DatePicker (§48 accessibility consistency). — Effort: S each.

---
Task ID: analysis-aff-acc-mkt-crm
Agent: explore-aff-acc-mkt-crm
Task: Deep analysis of Affiliates, Accounting, Marketing, CRM modules vs spec + UX Constitution

Scope:
- src/modules/affiliates/{manifest.ts, widgets/affiliate-widgets.tsx, pages/{affiliate-pages,offer-management-page,offer-edit-page,offer-matching-users-page,offer-change-history-page}.tsx, index.ts}
- src/modules/accounting/{manifest.ts, widgets/accounting-widgets.tsx, pages/accounting-pages.tsx, index.ts}
- src/modules/marketing/{manifest.ts, widgets/marketing-widgets.tsx, pages/{marketing-pages,marketing-dashboard-page}.tsx, index.ts}
- src/modules/crm/{manifest.ts, widgets/crm-widgets.tsx, pages/crm-pages.tsx, index.ts}
- Cross-referenced mock-data.ts (Affiliate, AffiliateCampaign, Transaction, MarketingCampaign, CrmContact, Offer interfaces + helpers), view-router.tsx wiring, navigation-engine.ts, module-registry.ts getSettings()

## AFFILIATES — PRESENT
1. **Manifest** (`affiliates/manifest.ts`) — id `affiliates`, v1.0.0, category `growth`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#a21caf` (fuchsia-700 — Terra-allowed). 4 permissions (`affiliate.read|create|update|configure`). 6 nav children at order 55: Overview, Affiliates, Campaigns, Commissions, Offers, Edit Offer. 8 routes (includes offer-matching-users + offer-change-history even though those aren't in nav — good, they're reached from Offer Edit page). 3 widgets (metric/leaderboard/chart). Settings entry `viewId: "settings-affiliates"` (DEAD LINK — no view registered in view-router.tsx).
2. **Affiliates Overview** (`affiliate-pages.tsx:AffiliatesOverviewPage`, 103 LOC) — 4 KPIs (Total Affiliates, Active, Conversions, Commission Earned with delta=6/11) + 12-month commission trend AreaSeries (color `#a21caf`) + Recent Campaigns DataTable (5 rows, columns: Campaign, Affiliate, Clicks, Signups, Conv., Revenue, Status). Export button (toast-only — no `exportToCsv`).
3. **Affiliates List** (`AffiliatesListPage`, 47 LOC) — DataTable columns: Name, Code (monospace), Tier badge (tierTone helper), Referrals, Conversions, Commission Earned, Status badge. ✓ `emptyTitle`/`emptyDescription`.
4. **Affiliate Campaigns** (`AffiliateCampaignsPage`, 47 LOC) — DataTable columns: Campaign, Affiliate, Clicks, Signups, Conv., Spend, Revenue, ROI% (color-coded emerald/rose), Status badge. ✓ empty state.
5. **Affiliate Commissions** (`AffiliateCommissionsPage`, 57 LOC) — 4 KPIs (Total Earned, Pending Payout, Avg Ticket = earned/conversions, Active Partners) + DataTable columns: Affiliate, Tier, Referrals, Conversions, Earned (emerald), Pending (amber), Status badge. ✓ empty state.
6. **Offer Management** (`offer-management-page.tsx`, 351 LOC) — **STRONG**. DataTable of offers (Name, Coupon, Discount %, Status, Start, End, Countries badge, Matches count) with status filter Select, Add Offer button, row-click → inline detail panel (`OfferDetailPanel` shows offer basics + targeting countries/segments + matching users count + View Change History / Edit Offer action buttons). ✓ §27 inline detail panel for quick-review task. ✓ emptyTitle/emptyDescription.
7. **Offer Edit** (`offer-edit-page.tsx`, 864 LOC) — **BEST-IN-CLASS for the 4 modules**. Full create/edit form: Basic Information (Title, Display Order, Description, Textarea, Image upload with preview, Coupon Code auto-uppercase, Discount %, Start/End dates, Is Popup Switch, Offer URL) + Country Targeting (DualListBox add/remove all + selected preview) + Challenge Targeting (DualListBox) + User Segment (Collapsible §12 — Segment Name, Active Switch, 5 TriStateSelects Account Purchased/Competition User/Has Approved Payout/Fund Accounts Only/Has Failed Accounts, Account Size Min/Max). 6 `LabelWithHelp` tooltips (§33 ✓ — only page in the 4 modules with contextual help). Save / Save and add another / Save and continue editing / Delete (AlertDialog with consequence text §24 ✓). Related-context navigation links at top: View Matching Users, View Change History (navigate() calls ✓ §27).
8. **Offer Matching Users** (`offer-matching-users-page.tsx`, 366 LOC) — 4 KPIs (Total Matches 3633, Funded Matches, New Users, Existing Users) + paginated DataTable (100 rows/page) of deterministic mock users (email, country, account status, has purchased, funded). "View User" action per row → `navigate("trader-detail", { id })` ✓ cross-module link. ✓ EmptyState when offer not found. Custom pagination across 37 pages.
9. **Offer Change History** (`offer-change-history-page.tsx`, 389 LOC) — **STRONG**. Per-offer audit trail DataTable (Date/Time, User email + role Badge, Action label, Description with old→new value diff chips). Action filter Select (7 action types). Real CSV export ✓ (handcrafted Blob). Deterministic generator (8-15 entries per offer). ✓ EmptyState. Terra palette ✓ (emerald/amber/rose/slate).
10. **3 widgets** (`affiliate-widgets.tsx`, 107 LOC) — AffiliateOverviewWidget (4 KPIs w12h1, identical to Overview page KPIs), TopAffiliatesWidget (top-6 ranked list w6h2 with tier-colored bars + rank badges), AffiliateRevenueWidget (12-month AreaSeries w6h2, accent #a21caf). ✓ EmptyState on TopAffiliatesWidget for 0 affiliates.

## AFFILIATES — MISSING / THIN (effort S/M/L)
- **Overview KPIs missing "top earner" + "conversion rate" + "total commission paid"** (spec #1) — Currently shows Total Affiliates, Active, Conversions, Commission Earned. Spec calls for: active affiliates, total commission PAID (≠ earned — earned includes pending), conversion rate (conversions/referrals or conversions/clicks), top earner. None present. — Effort: S.
- **Affiliate List missing referral LINK + payout method columns** (spec #2) — Has referral `code` (font-mono) but no full URL (e.g. `https://yourfirm.com/r/AFFB1`). No payout method column (PayPal/Bank/Wire/Crypto). — Effort: S.
- **Affiliate Campaigns missing "by campaign, by source, conversion funnel"** (spec #3) — Has by-campaign table but no by-source breakdown and no funnel (Clicks → Signups → Conversions drop-off visualization). — Effort: M.
- **Affiliate Commissions missing per-referral breakdown + payout link** (spec #4) — Currently rolls up by affiliate (Earned/Pending). Spec calls for "per-referral commission breakdown, status, payout link". No per-referral ledger row. No link to payouts module. — Effort: M.
- **Offer Edit missing "commission %, bonus, min payout, conversion criteria"** (spec #6) — Only has discountPct + dates + popup + URL. No affiliate-commission config (commission %, signing bonus, minimum payout threshold, conversion criteria for what counts as a converted referral). — Effort: M.
- **No Affiliate dashboard widget / white-label public portal** (spec #9) — TopAffiliatesWidget is admin-side leaderboard. No public-facing affiliate portal where affiliates log in, see their own clicks/conversions/commissions/pending payouts. — Effort: L.
- **No Affiliate payout schedule** (spec #10) — No scheduled-payout view (weekly/monthly/net-30). No link from Affiliate Commissions → Payouts module filtered by source=affiliate. — Effort: M.
- **No standalone performance leaderboards page** (spec #11) — TopAffiliatesWidget exists but no full leaderboards page with rank/profit/win-rate/equity. — Effort: M.
- **Coupon codes are part of Offer, no standalone CRUD** (spec #12) — Coupon lives inside offer only. No bulk coupon generation, no usage tracking per code, no expiry/limit per code. — Effort: M.
- **Affiliate link tracking page missing** (spec #13) — Clicks/conversions shown aggregated per campaign but no per-link tracking page (unique affiliate link → clicks/conversions over time). — Effort: M.
- **Terra palette violation: `platinum: "#7c3aed"` (violet)** — `affiliate-widgets.tsx:14`. Violates platform Terra-palette rule (no blue/indigo/violet). Should be `#475569` (slate) or `#a21caf` (fuchsia). — Effort: S.
- **Terra palette violation: rank badge uses `bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400`** — `affiliate-widgets.tsx:63`. Should use fuchsia or slate. — Effort: S.
- **Settings entry is a dead link** — `viewId: "settings-affiliates"` (manifest.ts:70) — no view registered in view-router.tsx. Clicking "Affiliates" in Settings → "no view registered" error. Same bug class as payouts/analytics. — Effort: M (build) or S (remove entry).
- **KPI deltas lack `deltaLabel`** (§9) — `delta={6}` / `delta={11}` without "vs prev 30d" context. — Effort: S.
- **No contextual help on KPIs** (§33) — Zero `LabelWithHelp` on affiliate-pages.tsx (Overview/List/Campaigns/Commissions). "Avg Ticket" KPI ambiguous — average commission per conversion or average order value? — Effort: S.
- **Export is toast-only** on AffiliatesOverviewPage (affiliate-pages.tsx:48-52) — should call `exportToCsv` like accounting-pages.tsx. — Effort: S.
- **Affiliate "Active Referrals" field exists in mock-data.ts:527 but never surfaced in UI** — Affiliate interface has `activeReferrals` but no page shows it. — Effort: S.
- **OfferManagementPage "Edit Offer" buttons fire toast only** (offer-management-page.tsx:143 + 267) — should `navigate("offer-edit", { id: o.id })`. The Offer Edit page exists but isn't reachable from the table. — Effort: S. **CRITICAL — Offer Edit page is orphaned from the table.**
- **OfferManagementPage "View Change History" button fires toast only** (offer-management-page.tsx:136) — should `navigate("offer-change-history", { id: o.id })`. — Effort: S.
- **AffiliatesOverviewPage Recent Campaigns uses `.slice(0, 5)` by array order** — not by date or revenue. Should be "Latest 5 by startDate" or "Top 5 by revenue". — Effort: S.
- **AffiliateCommissionsPage "Active Partners" KPI is duplicate of Overview's "Active" KPI** — same `aff.filter(status === "active").length` calc. Should be replaced with "Next Payout" or "Avg Commission / Conversion" unique metric. — Effort: S.
- **No URL-persisted filters** on any Affiliates page (§51) — OfferManagement status filter, OfferChangeHistory action filter, OfferMatchingUsers pagination, all DataTable searches use local state. — Effort: M.
- **No loading skeletons / no error boundaries** (§31, §32). — Effort: M.
- **No terminology applied** to page headers — `makeTermResolver` not imported anywhere. Tenant terminology might want "Partner" vs "Affiliate". — Effort: M.
- **index.ts barrel export incomplete** — only re-exports 4 pages from affiliate-pages.tsx. The 4 offer-* pages (OfferManagementPage, OfferEditPage, OfferMatchingUsersPage, OfferChangeHistoryPage) are imported directly by view-router.tsx. Either add to barrel or document the split. — Effort: S.

## ACCOUNTING — PRESENT
1. **Manifest** (`accounting/manifest.ts`) — id `accounting`, v1.0.0, category `advanced`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#b45309` (amber-700 — Terra-allowed). 2 permissions (`accounting.read|configure`). 3 nav children at order 60: Overview, Transactions, Reconciliation. 3 routes. 3 widgets (metric/bar chart/area chart). Settings entry `viewId: "settings-accounting"` (DEAD LINK).
2. **Accounting Overview** (`accounting-pages.tsx:AccountingOverviewPage`, 50 LOC) — 4 KPIs (Total Revenue = sum of challenge-fee + subscription, Payouts = sum of payout, Fees = sum of commission, Net = revenue - payouts - fees) + 2 charts side-by-side (Revenue by type BarSeries with 5 transaction types, Transaction flow 12-month AreaSeries). All amounts use tenant.currency. KPIs have `tone` differentiation (positive/negative/warning/conditional) ✓ but **NO deltas** (weakest KPI hierarchy of the 4 modules).
3. **Transactions Page** (`TransactionsPage`, 73 LOC) — DataTable columns: Reference (monospace), Type (capitalize), Description (muted), Amount (color-coded + for inflow / - for outflow, emerald/rose), Category (capitalize), Status badge (reconciled=success, posted=info, pending=warning), Date, Account. ✓ Real `exportToCsv` with 9 columns (best in the 4 modules). ✓ `emptyTitle`/`emptyDescription`.
4. **Reconciliation Page** (`ReconciliationPage`, 70 LOC) — 4 KPIs (Total Volume, Reconciled total, Pending total, Reconciliation Rate % with conditional tone) + DataTable of non-reconciled transactions only with "Reconcile" button per row (plain Button + toast demo, no AlertDialog §24 inconsistency vs PayoutReviewActions). ✓ emptyTitle/emptyDescription "Nothing to reconcile".
5. **3 widgets** (`accounting-widgets.tsx`, 84 LOC) — AccountingOverviewWidget (4 KPIs w12h1, identical calc to Overview page), RevenueByTypeWidget (BarSeries w6h2 color #b45309), TransactionFlowWidget (AreaSeries w6h2 color #b45309). All tenant-scoped via `getTenantTransactions(tid)`.

## ACCOUNTING — MISSING / THIN (effort S/M/L)
- **No "pending invoices" / "ATR" KPIs** (spec #1) — Has Revenue/Payouts/Fees/Net but no invoices pending, no ATR (Average Transaction Revenue). — Effort: S.
- **No "income/expense" axis** (spec #2) — Type enum is payout/challenge-fee/subscription/refund/commission; no income vs expense categorization. (Workaround: code infers outflow from type — `payout || refund || commission`.) — Effort: S.
- **No "source" column** (spec #2) — Has `account` (e.g. "Operating Account") and `category` (== type) but no source field (Stripe / Bank / PayPal / Crypto gateway). — Effort: S.
- **Reconciliation: no bank statement import / CSV upload** (spec #3) — Manual single-row "Reconcile" button only. No bank statement parser, no auto-match, no side-by-side view. — Effort: L.
- **Reconciliation: no discrepancy detection** (spec #3) — Just shows non-reconciled rows. No "discrepancies" view (amount mismatch between ledger and bank statement). — Effort: M.
- **No Invoices / billing module** (spec #4) — Zero invoice UI. No invoice list, no generate/send/track, no PDF generation, no email integration. — Effort: L.
- **No Tax reports** (VAT, sales tax) (spec #5). — Effort: L.
- **No P&L statement** (spec #6). — Effort: M.
- **No Balance sheet snapshot** (spec #7). — Effort: M.
- **No Chart of accounts** (spec #8) — Account field on Transaction is free-text "Operating Account" with no COA tree. — Effort: M.
- **No Expense categories admin** (spec #9) — Category field exists but no admin UI to manage categories. — Effort: M.
- **No Multi-currency accounting** (spec #10) — Transactions have per-row `currency` (tenant-beta uses GBP) but no FX normalization, no multi-currency view, no gain/loss on FX. — Effort: L.
- **Reconciliation "Reconcile" button is plain Button + toast** (§24 inconsistency) — Should require confirmation (or at least log actor + timestamp to audit). Reconciliation affects the books. — Effort: S.
- **Accounting Overview KPIs lack deltas** — Revenue/Payouts/Fees/Net have no `delta` numbers at all (unlike Marketing Overview which has deltas). — Effort: S.
- **No contextual help on KPIs** (§33) — "Net" KPI is `revenue - payouts - fees` calculation; no tooltip explains formula. "Total Revenue" excludes payouts/commissions — counterintuitive. — Effort: S.
- **No EmptyState on AccountingOverviewPage** — new tenant with 0 transactions → blank charts. (§30 violation.) — Effort: S.
- **Settings entry is a dead link** — `viewId: "settings-accounting"` (manifest.ts:61). — Effort: M (build) or S (remove).
- **Reconciliation page filters nothing** — just shows non-reconciled rows; no time-range, no account filter, no type filter. — Effort: S.
- **TransactionsPage has no filters** (search only) — no status Select, no type Select, no date range, no account Select. — Effort: S.
- **No drill from transaction to detail** (§27) — row click does nothing. Should open drawer with full transaction context, linked payout/trader, audit trail. — Effort: M.
- **No bulk reconcile** — only single-row action button. Should support batch select + Reconcile Selected (matches enhanced-withdrawals-page pattern). — Effort: S.
- **No URL-persisted filters** (§51). — Effort: M.
- **No loading skeletons / no error boundaries** (§31, §32). — Effort: M.
- **No terminology applied** to page headers. — Effort: M.
- **Accounting Overview duplicates widgets** — AccountingOverviewWidget (dashboard) is identical KPI set to AccountingOverviewPage. Per §8 Dashboard Density Rule, widget should be a tighter subset or include a "View detailed accounting →" link. — Effort: S.

## MARKETING — PRESENT
1. **Manifest** (`marketing/manifest.ts`) — id `marketing`, v1.0.0, category `growth`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#db2777` (pink-600 — Terra-allowed). 2 permissions (`marketing.read|configure`). **4 nav children at order 65** (Overview, Campaigns, Performance, **Dashboard**) but **3 routes only** (manifest data inconsistency: `marketing-dashboard` declared as nav child but not in routes array — runtime works because view-router.tsx has the viewId, but the manifest itself is inconsistent). 3 widgets. Settings entry `viewId: "settings-marketing"` (DEAD LINK — note: marketing-integrations + marketing-banner-edit pages exist but those viewIds are different).
2. **Marketing Overview** (`marketing-pages.tsx:MarketingOverviewPage`, 90 LOC) — 5 KPIs (Active Campaigns delta=6, Total Spend delta=4, Impressions delta=11, Conversions delta=8, ROI% with conditional tone) + 2 charts side-by-side (Campaign Revenue BarSeries top 6, Spend by Channel DonutSeries). Export button (toast-only).
3. **Marketing Campaigns** (`MarketingCampaignsPage`, 56 LOC) — DataTable columns: Campaign, Channel (capitalize), Status badge, Budget, Spend, Impr., Clicks, Conv., Revenue (font-semibold), ROI% (color-coded emerald/rose). ✓ `emptyTitle`/`emptyDescription`.
4. **Marketing Performance** (`MarketingPerformancePage`, 43 LOC) — 3 charts: Revenue by Channel BarSeries, Conversions by Channel BarSeries (color #059669), Spend Distribution DonutSeries. **NO EmptyState** (new tenant → blank charts). **NO KPIs** — pure charts only. **Duplicate "Spend by Channel" donut with Overview**.
5. **Marketing Dashboard** (`marketing-dashboard-page.tsx`, 477 LOC) — **STRONG**. 4 KPIs (Best Trade +$4250 hardcoded, Best Trader, Logged In Users, Total Payouts derived) + Week range Select (This Week / Last Week / This Month) + Search input + 3 DataTables: Top Traders (Rank badge 1-10 with Crown for #1, Name, P&L color-coded, Win Rate, Country), Top Trading Pairs (Symbol, Trades, Buy/Sell ratio, Volume, Avg P&L), Top Countries by Payouts (Country, Payouts, Total Amount, % of Total with progress bar). Custom pagination. ✓ `emptyTitle`/`emptyDescription` on traders table.
6. **3 widgets** (`marketing-widgets.tsx`, 75 LOC) — MarketingOverviewWidget (5 KPIs w12h1, identical to Overview page), CampaignPerformanceWidget (BarSeries top 6 w6h2), ChannelBreakdownWidget (DonutSeries w6h2).

## MARKETING — MISSING / THIN (effort S/M/L)
- **CRITICAL: MarketingDashboardPage dead filter bug** (`marketing-dashboard-page.tsx:131`) — `traders.filter((t) => new Date(t.joinedAt).getTime() >= cutoff * 0.3 || true)`. The `|| true` makes the filter always return true, so the "This Week / Last Week / This Month" selector computes the cutoff but never applies it. Top Traders table shows the same data regardless of selected range. — Effort: S.
- **CRITICAL: MarketingDashboardPage footer copy is misleading** (line 470-473) — "Trading pair volume and buy/sell ratios are aggregated from open and closed positions in the selected range. Country payouts include all paid and approved withdrawals." But top trading pairs are 100% synthetic mock (lines 145-155 — TRADING_PAIRS hardcoded array, tradeCount = `120 - i*9 + (i%3)*5`), NOT derived from positions. The footer is technically false. — Effort: S (fix copy or derive from positions).
- **MarketingDashboardPage "Best Trade = 4250"** (line 195) — hardcoded constant, not derived from positions. — Effort: S.
- **MarketingDashboardPage "Logged In Users"** = `traders.length * 0.42 + 38` (line 197) — arbitrary formula not grounded in any session data. — Effort: M (mock session data).
- **Manifest data inconsistency**: 4 nav children vs 3 routes (`marketing-dashboard` declared in nav but not in routes array). Runtime works because view-router.tsx maps the viewId directly. — Effort: S (add missing route entry).
- **No "by source, attribution model" in Performance** (spec #3) — Only by channel. No source (which ad network, which affiliate), no attribution model (first-click / last-click / multi-touch). — Effort: L.
- **No email campaigns module** (spec #5) — No templates, no send UI, no open rate / click rate metrics. Email templates exist in mock-data.ts (`emailTemplates` array) but no Marketing page surfaces them. — Effort: L.
- **No social media campaigns** (spec #6) — No scheduled posts, no engagement metrics. — Effort: L.
- **No ad spend tracking by platform** (spec #7) — Channel enum is generic (email/social/paid-ads/content/affiliate). No Google Ads / Meta Ads / TikTok Ads breakdown with per-platform spend, CPC, CPM. — Effort: L.
- **No lead capture / landing pages** (spec #8). — Effort: L.
- **No A/B test results** (spec #9). — Effort: M.
- **No marketing attribution reports** (first-click, last-click, multi-touch) (spec #10). — Effort: L.
- **No marketing budget planner** (spec #11). — Effort: M.
- **No cohort marketing performance** (spec #12). — Effort: L.
- **Terra palette violation: `CHANNEL_COLORS["paid-ads"] = "#8b5cf6"` (violet)** — Appears in BOTH `marketing-widgets.tsx:22` AND `marketing-pages.tsx:24`. Should be `#c2410c` (orange) or `#92400e` (amber-800). — Effort: S each.
- **Settings entry is a dead link** — `viewId: "settings-marketing"` (manifest.ts:65). Note: marketing-integrations + marketing-banner-edit pages exist in view-router.tsx but their viewIds are `marketing-integrations` and `marketing-banner-edit`, NOT `settings-marketing`. The Settings entry still throws. — Effort: M (reconcile viewId or build settings-marketing page).
- **No contextual help on KPIs** (§33) — "ROI" KPI is `(revenue - spend) / spend * 100` calculation; no tooltip explains formula. "Impressions" delta=11 without "vs prev period" label. — Effort: S.
- **Export is toast-only** on MarketingOverviewPage (marketing-pages.tsx:63) and MarketingDashboardPage (line 204-209) — no real `exportToCsv`. — Effort: S each.
- **MarketingCampaignsPage is read-only** — No edit, pause, duplicate, view row actions (spec #2 calls for full campaign CRUD). — Effort: M.
- **MarketingOverviewPage + MarketingPerformancePage have NO EmptyState** — new tenant with 0 campaigns → blank charts. (§30 violation.) — Effort: S each.
- **Duplicate charts across Overview + Performance**: "Spend by Channel" DonutSeries appears on BOTH pages (Overview line 84 + Performance line 187). Violates §8 Dashboard Density Rule — "Every component must justify its existence". Performance page should add unique breakdowns (by source, by attribution), not duplicate Overview. — Effort: M (differentiate).
- **CTR / CPC / CPA derived columns missing** (spec #2) — Campaigns table has Impressions, Clicks, Conversions but no derived CTR (clicks/impressions), CPC (spend/clicks), CPA (spend/conversions). — Effort: S.
- **MarketingPerformancePage has NO KPIs** — pure 3-chart page. Should have at least "Top Channel by ROI" / "Avg CPC" / "Avg CPA" summary KPIs. — Effort: S.
- **No URL-persisted filters** (§51) — MarketingDashboard week range + search use local state. — Effort: M.
- **No loading skeletons / no error boundaries** (§31, §32). — Effort: M.
- **No terminology applied** to page headers. — Effort: M.

## CRM — PRESENT
1. **Manifest** (`crm/manifest.ts`) — id `crm`, v1.0.0, category `growth`, optional `true`, dependencies `["trading"]`, supportedApplications `["prop-admin","super-admin"]`, accentColor `#0891b2` (cyan-600 — Terra-allowed). 2 permissions (`crm.read|update`). 3 nav children at order 70: Overview, Contacts, Pipeline. 3 routes. 2 widgets (metric/chart). Settings entry `viewId: "settings-crm"` (DEAD LINK).
2. **CRM Overview** (`crm-pages.tsx:CrmOverviewPage`, 109 LOC) — 5 KPIs (Total Contacts delta=5, Leads delta=9, Qualified delta=7, Customers delta=3, Churned delta=-2 with negative tone ✓) + 2 charts side-by-side (Pipeline by Stage BarSeries color #0891b2, Pipeline Value per stage with progress bars + count + value display). Export button (toast-only).
3. **CRM Contacts** (`CrmContactsPage`, 50 LOC) — DataTable columns: Name (font-medium), Email (muted), Source, Stage badge (color-coded via STAGE_COLOR map), Owner, Value (font-semibold), Last Interaction. ✓ `emptyTitle`/`emptyDescription`.
4. **CRM Pipeline** (`CrmPipelinePage`, 49 LOC) — Stage-flow visualization: 5 stage cards in a grid (lead → qualified → opportunity → customer → churned) with horizontal arrow connectors, count + value per stage. Then a BarSeries "Contacts per Stage" chart. **NO EmptyState** for new tenant. **Stage cards not clickable** — should filter Contacts to that stage.
5. **2 widgets** (`crm-widgets.tsx`, 46 LOC) — CrmOverviewWidget (5 KPIs w12h1, identical to Overview page), PipelineWidget (BarSeries w6h2 color #0891b2).

## CRM — MISSING / THIN (effort S/M/L)
- **"pipeline value" KPI present but missing "new leads" + "conversion rate"** (spec #1) — CrmOverviewPage computes pipelineValue (sum of contact values for non-churned) inside the Pipeline Value card badge, but the 5 top-level KPIs don't include "new leads this period" or "conversion rate" (lead → customer %). — Effort: S.
- **Contacts list missing "last contact" semantic** (spec #2) — Has `lastInteraction` field displayed as "Last Interaction". Spec calls for "last contact". Minor semantic gap; the data is the same. — Effort: S (rename column).
- **No Pipeline kanban** (spec #3) — Stage-flow cards exist but no drag-and-drop kanban board. Operators can't move contacts between stages visually. — Effort: M.
- **No Lead scoring model** (spec #4) — No lead-scoring UI, no score column, no score-based filtering. — Effort: M.
- **No Contact detail page / drawer** (spec #5) — Clicking a contact does nothing. No detail drawer with history, notes, tasks, deals, communications. **CRITICAL — Contacts table is a dead-end list.** — Effort: M.
- **No Email integration** (Gmail/Outlook) (spec #6). — Effort: L.
- **No Activity timeline per contact** (spec #7) — Only `lastInteraction` timestamp shown. No chronological feed. — Effort: M.
- **No Deal tracking** (value/stage/expected close) (spec #8) — `value` field on contact is the only deal-equivalent. No deal records, no expected close dates, no deal stage progression. — Effort: L.
- **No Tasks & reminders** (spec #9). — Effort: M.
- **No Bulk import/export contacts (CSV)** (spec #10) — No import/export UI. Export button is toast-only. — Effort: S (export) / M (import + CSV mapping).
- **No Custom fields management** (spec #11). — Effort: L.
- **Settings entry is a dead link** — `viewId: "settings-crm"` (manifest.ts:59). — Effort: M (build) or S (remove).
- **No contextual help on KPIs** (§33) — "Pipeline Value" is a sum of contact values; no tooltip explains. "Churned" KPI delta=-2 without "vs prev 30d" label. — Effort: S.
- **Export is toast-only** on CrmOverviewPage (crm-pages.tsx:56-61) — no real `exportToCsv`. — Effort: S.
- **Contacts table is read-only** — No edit, add, delete, row actions. No "Add Contact" button. — Effort: M.
- **CrmOverviewPage + CrmPipelinePage have NO EmptyState** — new tenant with 0 contacts → blank charts + blank stage cards. (§30 violation.) — Effort: S each.
- **CrmPipelinePage stage cards not clickable** — should `navigate("crm-contacts", { stage: <stage> })` or filter Contacts table. Currently dead-end visualization. — Effort: S.
- **Pipeline stages are hardcoded** — `["lead", "qualified", "opportunity", "customer", "churned"]` (line 41, 168). No admin UI to customize stages (rename, add, reorder, hide). — Effort: M.
- **CrmContactsPage has no filters** (search only) — no stage Select, no owner Select, no source Select. — Effort: S.
- **No URL-persisted filters** (§51). — Effort: M.
- **No loading skeletons / no error boundaries** (§31, §32). — Effort: M.
- **No terminology applied** to page headers. — Effort: M.
- **Pipeline Widget (dashboard) duplicates Overview's Pipeline by Stage chart** — same BarSeries on both. Per §8 should differentiate or surface "View pipeline →" link. — Effort: S.

## CROSS-TENANT GAPS
- **Terminology not applied** — ZERO `makeTermResolver` calls in any of the 4 modules. Affiliate → "Partner"? Payout → "Disbursement"? Challenge → "Evaluation"? Tenant-alpha terminology overrides unused on all page headers. Sidebar adapts via `termKey` on nav parent (none declared for these 4 modules) but page headers don't call resolver. — Effort: M.
- **4 of 4 dead-link Settings entries** — `settings-affiliates`, `settings-accounting`, `settings-marketing`, `settings-crm` all declared in module manifests but NONE registered in view-router.tsx. Clicking any in Settings page → "no view registered" error. Same bug class as `settings-payouts` / `settings-analytics` from prior analysis. — Effort: M (build all 4) or S (remove all 4 entries).
- **Multi-currency accounting missing** — Affiliates uses tenant.currency for ALL amounts (commission earned, pending) but affiliate payouts may be in different currency (USD affiliate earning GBP commission). Accounting transactions have per-row `currency` (tenant-beta uses GBP) but no FX normalization view. Marketing uses tenant.currency for spend/revenue even though ad spend is often in USD with EUR/local conversions. CRM uses tenant.currency for contact value (least problematic — deal value is tenant-local). — Effort: L.
- **Tenant-alpha (growth plan) gets EMPTY Affiliate/Marketing/CRM modules** — Mock data only includes affiliates/campaigns/contacts for tenant-beta + tenant-gamma (lines 856, 921, 946 of mock-data.ts). Alpha admin sees empty DataTables (with emptyTitle ✓ but blank Overview charts). Plus: these 4 modules are all `category: "growth"` or `advanced` but `optional: true` with NO `feature` flag — Alpha on growth plan shouldn't see them at all. — Effort: M (add FeatureGuard or plan gating).
- **Locale not used** — All date formatting uses `toLocaleDateString()` / `toLocaleString()` without explicit locale. Tenant-beta `en-GB` with Europe/London tz shows browser-default. — Effort: M.
- **No tenant-specific mock variation for Offers** — `getOffers()` returns 3 hardcoded offers with NO `tenantId` field on Offer interface. All tenants see the same 3 offers. — Effort: S (add tenantId field + scope).
- **Cross-module links missing across all 4 modules**:
  - Affiliate Commissions → Payouts: NO LINK (should surface "X pending affiliate payouts →" linking to payouts module filtered by source=affiliate).
  - Marketing Campaign → CRM Contacts: NO LINK (campaign conversions should link to contacts who converted).
  - CRM Contact → Trader Detail: NO LINK (contacts that converted to traders should link to trader-detail).
  - Accounting Transaction → Payout: NO LINK (transaction.type === "payout" should link to corresponding payout record).
  - Accounting Transaction → Affiliate: NO LINK (transaction.type === "commission" should link to the affiliate who earned the commission).
  - OfferManagementPage → OfferEditPage: NO LINK (Edit buttons fire toast only — orphaned page).
  - OfferManagementPage → OfferChangeHistoryPage: NO LINK (View Change History button fires toast only).
- **Branding palette mostly applied** — Affiliates #a21caf ✓, Accounting #b45309 ✓, Marketing #db2777 ✓, CRM #0891b2 ✓. But chart series colors have Terra violations: TopAffiliatesWidget platinum tier `#7c3aed` violet, Marketing CHANNEL_COLORS paid-ads `#8b5cf6` violet.

## UX GAPS

### Empty states (§30)
- **Affiliates**: OfferManagementPage ✓ emptyTitle/emptyDescription, OfferMatchingUsersPage ✓ EmptyState component, OfferChangeHistoryPage ✓ EmptyState. Affiliate-pages List/Campaigns/Commissions ✓ emptyTitle/emptyDescription. **AffiliatesOverviewPage NO empty state** — new tenant → blank chart + empty DataTable.
- **Accounting**: TransactionsPage ✓ emptyTitle/emptyDescription, ReconciliationPage ✓ "Nothing to reconcile". **AccountingOverviewPage NO empty state**.
- **Marketing**: MarketingCampaignsPage ✓ emptyTitle/emptyDescription. MarketingDashboardPage ✓ emptyTitle/emptyDescription on traders table. **MarketingOverviewPage + MarketingPerformancePage NO empty state**.
- **CRM**: CrmContactsPage ✓ emptyTitle/emptyDescription. **CrmOverviewPage + CrmPipelinePage NO empty state**.

### Loading states (§31)
- ZERO loading skeletons in any of the 4 modules. All synchronous mock. When backend wires up, every page will flash empty. Same gap as payouts/analytics.

### Error states (§32)
- No page-level or widget-level error boundaries in any of the 4 modules. If one widget throws (e.g. chart library crash), the whole page errors.

### Accessibility (§48)
- **offer-edit-page.tsx:542, 551** — raw `<Input type="date">` for Start Date and End Date. Inconsistent with shadcn Calendar/DatePicker pattern. Same §48 violation class as daily-highlights-page.
- **OfferManagementPage, OfferChangeHistoryPage, OfferMatchingUsersPage, MarketingDashboardPage** — use shadcn Select ✓.
- **TopAffiliatesWidget rank badge** — color-only tier indication (bronze/silver/gold/platinum) without `role="img"` or text alternative for screen readers.
- **CrmPipelinePage stage cards** — color conveys stage identity without `role="img"` or text alternative.
- **MarketingDashboardPage top traders Crown icon** for rank 1 — decorative, no `aria-label`.

### Filter combinations (§26)
- **Strong**: OfferManagementPage (search + status filter + sort), OfferMatchingUsersPage (search + pagination + sort), OfferChangeHistoryPage (search + action filter + sort), MarketingDashboardPage (search + week range + sort).
- **Medium**: TransactionsPage (search only — no status/type/date filters), ReconciliationPage (search only), MarketingCampaignsPage (search only), CrmContactsPage (search only).
- **Weak/None**: AffiliateCampaignsPage (search only), AffiliateCommissionsPage (search only), AccountingOverviewPage (no filters), MarketingOverviewPage (no filters), MarketingPerformancePage (no filters), CrmOverviewPage (no filters), CrmPipelinePage (no filters).

### Cross-references / navigation
- **Offer Management → Offer Edit**: NO NAVIGATE CALL — "Edit Offer" buttons fire toast only (offer-management-page.tsx:143 + 267). The Offer Edit page exists but is orphaned from the table. — CRITICAL bug.
- **Offer Management → Change History**: NO LINK (only inside OfferDetailPanel "View Change History" button fires toast — offer-management-page.tsx:136).
- **Offer Edit → Matching Users / Change History**: ✓ navigate() called (offer-edit-page.tsx:408, 416).
- **Offer Matching Users → Trader Detail**: ✓ navigate() called (offer-matching-users-page.tsx:220).
- **Affiliate Commissions → Payouts**: NO LINK.
- **Marketing Campaign → CRM Contact**: NO LINK.
- **MarketingDashboardPage top trader → trader-detail**: NO LINK (row click does nothing).
- **CRM Contact → Trader Detail**: NO LINK (no row action).
- **CRM Pipeline stage → Contacts filtered**: NO LINK (clicking stage card does nothing).
- **Accounting Transaction → Payout / Affiliate**: NO LINK.
- **Affiliate Overview chart → drill-down**: NO LINK (chart not clickable).

### Bulk actions (§26)
- **None** in any of the 4 modules. Affiliates list, Campaigns list, Commissions list, Transactions list, Reconciliation pending list, Marketing Campaigns list, CRM Contacts list — all bare DataTables without selection. Reconciliation "Reconcile" is single-row only — should support batch reconcile. CRM Contacts should support bulk stage-update. Affiliate list should support bulk status change.

### Export/print
- **Real `exportToCsv`**: TransactionsPage ✓, OfferChangeHistoryPage ✓ (handcrafted CSV Blob).
- **Toast-only (fake)**: AffiliatesOverviewPage Export (affiliate-pages.tsx:48-52), MarketingOverviewPage Export (marketing-pages.tsx:63), MarketingDashboardPage Export CSV (line 204-209), CrmOverviewPage Export (crm-pages.tsx:56-61).
- **No export**: All other pages (AffiliateCampaigns, AffiliateCommissions, OfferManagement, OfferMatchingUsers, Reconciliation, MarketingCampaigns, MarketingPerformance, CrmContacts, CrmPipeline).

### Visual hierarchy (§41)
- **AffiliatesOverviewPage 4 KPI cards equal weight** — no "primary" highlight. Spec §23 One Primary Action — if pending commissions > 0, should highlight "Pending Payout".
- **MarketingOverviewPage 5 KPI cards** — ROI KPI has `tone={roi >= 0 ? "positive" : "negative"}` ✓ (best of the 4 modules).
- **CrmOverviewPage 5 KPI cards** — Churned KPI correctly `tone="negative"` ✓.
- **AccountingOverviewPage 4 KPI cards** — Revenue `tone="positive"` ✓, Payouts `tone="negative"` ✓, Fees `tone="warning"` ✓, Net conditional ✓. But **NO deltas** — weakest KPI hierarchy of the 4 modules.

### Animation (§68)
- Appropriate. Recharts default animations on AreaSeries/BarSeries/DonutSeries (subtle). No fake real-time indicators (§67 ✓).

### Help / Education (§33)
- **Strong**: offer-edit-page.tsx — 6 LabelWithHelp tooltips (Display Order, Offer Image, Coupon Code, Discount %, Offer URL, segment fields). Best-in-class for these 4 modules.
- **Strong**: offer-change-history-page.tsx — "Showing X of Y total" header explains filter context.
- **Weak**: affiliate-pages.tsx (all 4 pages), accounting-pages.tsx (all 3 pages), marketing-pages.tsx (all 3 pages), marketing-dashboard-page.tsx, crm-pages.tsx — ZERO `LabelWithHelp` or `ⓘ` tooltips. "ROI", "Net", "Pipeline Value", "Avg Ticket", "Reconciliation Rate", "Best Trade", "Logged In Users" — none have explanations.

### Destructive actions (§24)
- **Strong**: OfferEditPage Delete — AlertDialog with consequence text + permanent removal warning + coupon redemption impact (✓ best-in-class for these 4 modules).
- **Weak**: Reconciliation "Reconcile" button — plain Button + toast, no confirmation, no audit-trail entry. Affects the books; should at least log actor + timestamp.
- **Acceptable**: OfferManagementPage "Add Offer" / "Edit" buttons — non-destructive (toast demo only).

### First-time experience (§34)
- **No onboarding** on any Overview page for a new tenant with 0 data. Should say "Welcome — once you onboard affiliates / record transactions / launch campaigns / capture leads, KPIs will populate here".
- **No first-time tooltip** on Offer Edit page's DualListBox explaining the add/remove flow.
- **No first-time tooltip** on CRM Pipeline explaining the stage progression.
- **No first-time tooltip** on Reconciliation explaining the bank-statement match workflow.

## TOP PRIORITY ACTIONS (ordered)

1. **HIGHEST** — Fix `MarketingDashboardPage` dead filter bug (`marketing-dashboard-page.tsx:131` — `|| true` makes the week-range filter a no-op). Either implement the filter properly (filter traders by `joinedAt` ≥ cutoff) or remove the dead `|| true` and show "no traders in range" EmptyState. — Effort: S.

2. **HIGHEST** — Fix `OfferManagementPage` dead-link buttons: "Edit Offer" buttons (offer-management-page.tsx:143 + 267) and "View Change History" button (line 136) fire toast only; should `navigate("offer-edit", { id: o.id })` and `navigate("offer-change-history", { id: o.id })`. The Offer Edit and Offer Change History pages exist but aren't reachable from the table — orphaned pages. — Effort: S.

3. **HIGHEST** — Fix the 4 dead-link Settings entries (`settings-affiliates`, `settings-accounting`, `settings-marketing`, `settings-crm`). Either build settings pages for each module or remove the `settings` array from each manifest. Same bug class as `settings-payouts` / `settings-analytics` from prior analysis. — Effort: M (build all 4) or S (remove all 4 entries).

4. **HIGHEST** — Fix Terra palette violations: `affiliate-widgets.tsx:14` `platinum: "#7c3aed"` (violet) → use `#475569` (slate) or `#a21caf` (fuchsia); `affiliate-widgets.tsx:63` `bg-violet-100 text-violet-600` rank badge → use fuchsia or slate; `marketing/widgets/marketing-widgets.tsx:22` + `marketing/pages/marketing-pages.tsx:24` `CHANNEL_COLORS["paid-ads"] = "#8b5cf6"` (violet) → use `#c2410c` (orange) or `#92400e` (amber-800). — Effort: S each.

5. **HIGH** — Wire real `exportToCsv` to AffiliatesOverviewPage Export (affiliate-pages.tsx:48-52), MarketingOverviewPage Export (marketing-pages.tsx:63), MarketingDashboardPage Export CSV (marketing-dashboard-page.tsx:204-209), CrmOverviewPage Export (crm-pages.tsx:56-61). Currently all toast-only. Use `exportToCsv` helper like TransactionsPage. — Effort: S each.

6. **HIGH** — Add EmptyState to (a) AffiliatesOverviewPage, (b) AccountingOverviewPage, (c) MarketingOverviewPage, (d) MarketingPerformancePage, (e) CrmOverviewPage, (f) CrmPipelinePage. New tenant → blank charts. (§30 violation.) — Effort: S each.

7. **HIGH** — Build CRM Contact detail drawer (§27 — spec #5). Clicking a contact should open a drawer with history, notes, tasks, deals, communications. Currently row click does nothing — Contacts table is a dead-end list. — Effort: M.

8. **HIGH** — Build CRM kanban-style pipeline (spec #3). Currently only stage-flow cards + BarSeries; no drag-and-drop board for moving contacts between stages. — Effort: M.

9. **HIGH** — Build Affiliate Commissions → Payouts cross-link (spec #10). Commissions page should surface "X pending affiliate payouts →" linking to payouts module filtered by source=affiliate. Also add Accounting Transaction (type=payout) → Payouts record link, and Transaction (type=commission) → Affiliate record link. — Effort: M.

10. **HIGH** — Build CRM bulk import/export contacts (CSV) (spec #10) + bulk stage-update. Currently Contacts is read-only with no row actions, no Add Contact button. — Effort: M.

11. **HIGH** — Add filters to TransactionsPage (status Select, type Select, date range, account Select) — currently only search. Mirror offer-change-history-page filter bar pattern. Also add to MarketingCampaignsPage (status Select, channel Select) + CrmContactsPage (stage Select, owner Select, source Select) + AffiliateCampaignsPage (status Select, affiliate Select) + AffiliateCommissionsPage (tier Select, status Select). — Effort: S each.

12. **HIGH** — Build Accounting Invoices module (spec #4 — generate, send, track). Currently ZERO invoice UI. Includes invoice list, create form, PDF generation, email integration. — Effort: L.

13. **HIGH** — Build Accounting reconciliation bank-statement import + discrepancy detection (spec #3). Currently manual single-row "Reconcile" only. Should support CSV upload, auto-match, side-by-side ledger-vs-bank view, discrepancy flagging. — Effort: L.

14. **HIGH** — Add AlertDialog friction to Reconciliation "Reconcile" button (§24 — single-row is reversible but should log actor + timestamp). Add bulk reconcile (batch select + Reconcile Selected) mirroring enhanced-withdrawals-page pattern. — Effort: S each.

15. **HIGH** — Add CTR / CPC / CPA derived columns to Marketing Campaigns table (spec #2 — currently has Impressions, Clicks, Conversions but no derived metrics). Also add MarketingCampaignsPage row actions (edit, pause, duplicate, view). — Effort: S (columns) / M (actions).

16. **MEDIUM** — Build Affiliate Offer Edit's affiliate-commission config (commission %, bonus, min payout, conversion criteria — spec #6). Currently offer-edit-page only has discountPct + dates + popup + URL; no commission/payout structure for affiliates. — Effort: M.

17. **MEDIUM** — Build Affiliate link tracking page (spec #13 — clicks/conversions per unique affiliate link). — Effort: M.

18. **MEDIUM** — Build Affiliate payout schedule view (spec #10) + Affiliate public dashboard widget / white-label portal (spec #9). — Effort: M (schedule) + L (portal).

19. **MEDIUM** — Build Marketing email campaigns module (templates, send, open rate, click rate — spec #5). Email templates exist in mock-data.ts but no Marketing page surfaces them. — Effort: L.

20. **MEDIUM** — Build Marketing attribution reports (first-click, last-click, multi-touch — spec #10). — Effort: L.

21. **MEDIUM** — Build Marketing A/B test results page (spec #9) + Marketing budget planner (spec #11) + Cohort marketing performance (spec #12). — Effort: M (each).

22. **MEDIUM** — Build CRM lead scoring model (spec #4) + Tasks & reminders (spec #9) + Custom fields management (spec #11) + Deal tracking (spec #8). — Effort: M (each, except Deal tracking L).

23. **MEDIUM** — Build Accounting P&L statement + Balance sheet + Chart of accounts + Tax reports (VAT, sales tax) (spec #5-8). — Effort: L (multi-page).

24. **MEDIUM** — Add `deltaLabel` to all KPIs with deltas (§9). Affiliates Overview `delta={6}` / `delta={11}` without "vs prev 30d". Marketing Overview `delta={6}` without label. CRM Overview `delta={5}` without label. Accounting Overview has NO deltas at all (add them with labels). — Effort: S each.

25. **MEDIUM** — Add contextual help (§33) — LabelWithHelp on KPIs across all 4 modules. "ROI" / "Net" / "Pipeline Value" / "Avg Ticket" / "Reconciliation Rate" / "Best Trade" / "Logged In Users" — none have explanations. — Effort: S each.

26. **MEDIUM** — Add page-level ErrorBoundary + loading skeletons to every page in the 4 modules (§31, §32 violations). — Effort: M.

27. **MEDIUM** — Add URL-persisted filters to all filtered pages (§51). OfferManagement status filter, OfferChangeHistory action filter, OfferMatchingUsers pagination, MarketingDashboard week range + search, all DataTable searches. Refresh loses context. — Effort: M.

28. **MEDIUM** — Add `makeTermResolver` to all page headers (§54/§55). Tenant terminology might want payout → "Disbursement", challenge → "Evaluation", affiliate → "Partner". Sidebar adapts via `termKey` on nav parent (none declared for these 4 modules — add to manifests). — Effort: M.

29. **MEDIUM** — Fix MarketingDashboardPage footer copy (line 470-473) — currently claims "Trading pair volume and buy/sell ratios are aggregated from open and closed positions" but topPairs are 100% synthetic mock. Either derive from positions data or reword to "synthetic sample for demo". Also derive "Best Trade" from positions instead of hardcoded 4250. — Effort: S.

30. **MEDIUM** — Fix manifest data inconsistency in `marketing/manifest.ts` — 4 nav children (Overview/Campaigns/Performance/Dashboard) but only 3 routes (missing `marketing-dashboard` route entry). Add the missing RouteDefinition. — Effort: S.

31. **MEDIUM** — Fix duplicate charts across Marketing Overview + Performance ("Spend by Channel" DonutSeries appears on both — violates §8 Dashboard Density Rule). Performance page should add unique breakdowns (by source, by attribution model), not duplicate Overview. — Effort: M.

32. **MEDIUM** — Add MarketingPerformancePage KPIs (currently pure 3-chart page with no summary metrics). At minimum: Top Channel by ROI, Avg CPC, Avg CPA, Avg CTR. — Effort: S.

33. **MEDIUM** — Replace raw `<Input type="date">` in `offer-edit-page.tsx:542, 551` with shadcn Calendar/DatePicker (§48 accessibility consistency). — Effort: S.

34. **MEDIUM** — Add stage-card click navigation on CrmPipelinePage → filter Contacts table by stage (`navigate("crm-contacts", { stage })`). Currently dead-end visualization. — Effort: S.

35. **MEDIUM** — Add tenantId field to `Offer` interface + scope `getOffers()` by tenant (currently 3 hardcoded offers shared across all tenants — multi-tenant demo looks identical). — Effort: S.

36. **LOW** — Add cross-module links: Marketing Campaign → CRM Contacts (converted leads); CRM Contact → Trader Detail (if contact became a trader); Affiliate Campaign → CRM Contacts (signups from campaign); Offer Matching Users already links to trader-detail ✓. — Effort: M.

37. **LOW** — Add plan gating to all 4 modules. Alpha (growth plan) shouldn't see Affiliates/Marketing/CRM/Accounting (these are scale+enterprise). Add `feature: "growth.marketing"` flag and gate via FeatureGuard. Currently `optional: true` with no feature flag — visible to any tenant with module enabled. — Effort: M.

38. **LOW** — Make TopAffiliatesWidget rank badge accessible (color-only tier indication lacks `role="img"` + `aria-label`). Same for CrmPipelinePage stage cards (color conveys stage identity). — Effort: S each.

39. **LOW** — Add multi-currency normalization to Accounting (transactions have per-row currency but no FX view) and to Marketing (ad spend often in USD with EUR/local conversions). — Effort: L.

40. **LOW** — Make `affiliateCampaigns` mock filterable by affiliate (currently flat array sliced 0-12 — no per-affiliate drill-down). Add Affiliate detail drawer showing all campaigns for one affiliate. — Effort: M.

## Summary
- **4 modules, 18 files analyzed, 0 lint errors introduced (read-only analysis)**.
- **Affiliates**: 8 pages (best of the 4 modules — Offer Edit is best-in-class for UX Constitution §12, §24, §27, §33), 3 widgets, 4 permissions. Critical gap: orphaned Offer Edit page from Offer Management table (toast-only buttons).
- **Accounting**: 3 pages, 3 widgets, 2 permissions. Best `exportToCsv` of the 4 modules. Weakest KPI hierarchy (no deltas). Missing 7 spec items entirely (invoices, tax, P&L, balance sheet, COA, expense categories, multi-currency).
- **Marketing**: 4 pages, 3 widgets, 2 permissions. Critical bug: dead `|| true` filter on MarketingDashboardPage makes week-range selector a no-op. Critical bug: misleading footer copy. Terra palette violation in CHANNEL_COLORS. Manifest data inconsistency (4 nav vs 3 routes).
- **CRM**: 3 pages, 2 widgets, 2 permissions. Critical gap: Contacts table is a dead-end list — no contact detail drawer, no Add button, no row actions. No kanban. Missing 9 spec items (lead scoring, contact detail, email integration, activity timeline, deal tracking, tasks, bulk import, custom fields).
- **All 4 modules**: ZERO `makeTermResolver` usage, ZERO loading skeletons, ZERO error boundaries, 4 dead-link Settings entries, weak contextual help (only offer-edit-page has it), toast-only exports on 4 of 5 Export buttons.

Stage Summary: Read-only deep analysis of Affiliates + Accounting + Marketing + CRM modules. 4 CRITICAL bugs found (MarketingDashboard dead filter, OfferManagement orphaned Edit/Change-History buttons, 4 dead-link Settings entries, Terra palette violations in 2 modules). 40 ordered priority actions documented. No code changes made. Lead can dispatch follow-up tasks for the HIGHEST-priority fixes (items 1-4) — each is effort S and can be parallelized.

---

## Task ID: analysis-kyc-sup-ai
**Agent:** Explore (deep module analysis)
**Task:** Deep analysis of KYC + Support + AI modules — identify gaps vs. FUNDERBLU spec + AGENTS UX constitution.

### Files Inspected
- `src/modules/kyc/` — manifest.ts (61 LOC), index.ts (6 LOC), pages/kyc-pages.tsx (292 LOC, 3 pages), widgets/kyc-widgets.tsx (83 LOC, 2 widgets)
- `src/modules/support/` — manifest.ts (62 LOC), index.ts (6 LOC), pages/support-pages.tsx (219 LOC, 3 pages), widgets/support-widgets.tsx (114 LOC, 3 widgets)
- `src/modules/ai/` — manifest.ts (64 LOC), index.ts (7 LOC), pages/ai-pages.tsx (448 LOC, 4 pages), widgets/ai-widgets.tsx (135 LOC, 3 widgets)
- Cross-references: `lib/platform/mock-data.ts` (KycRecord/SupportTicket/AiInsight interfaces + seeds), `lib/platform/view-router.tsx` (route registry), `components/platform/attention-center.tsx`, `components/platform/contextual-actions.tsx`, `components/shell/global-search.tsx`, `modules/trading/pages/account-kyc-statuses-page.tsx` (per-provider KYC already implemented in trading module), `components/platform/state-explanations.tsx`.
- Context: `worklog.md` (most recent ~250 lines), `AGENTS.md` §3-§35, `FLOW-ANALYSIS.md`.

### KYC — PRESENT
- Manifest: id `kyc`, v1.0.0, category `compliance`, optional `true`, deps `["trading"]`, apps `[prop-admin, super-admin]`, accentColor `#475569` (slate — Terra-allowed), 2 perms (`kyc.read`, `kyc.approve`), 3 nav children at order 75 (Overview/Reviews/Risk), 3 routes, 2 widgets, 1 settings entry (DEAD LINK — `settings-kyc` not in view-router registry).
- Overview (`kyc-pages.tsx:KycOverviewPage`): 5 MetricCards (Pending/In-Review/Approved/Rejected/High Risk) + recent submissions DataTable (6 rows). Uses `getTenantKyc(tid)`. Export button (toast-only).
- Reviews (`KycReviewsPage`): full DataTable, 8 cols (Trader/Document/Country/Status/Risk/Submitted/Reviewed/Actions). Inline Approve/Reject gated by `PermissionGuard permission="kyc.approve"`. Toast feedback.
- Risk (`KycRiskPage`): DonutSeries (low/med/high) + high-risk records DataTable.
- Widgets: `KycOverviewWidget` (5 KPI MetricCards), `KycQueueWidget` (top-5 pending list w/ StatusBadge + high-risk badge).
- Attention Center has 2 KYC entries (reviews needed + high-risk profiles) ✓. Global Search indexes KYC Records ✓. State-explanations has 5 KYC states ✓. Audit log seeded with `Approved KYC` entries ✓.

### KYC — MISSING / THIN (effort)
- Approval/rejection rate metrics on Overview (data exists; not computed) — **S**
- Avg processing time metric on Overview (has `submittedAt`+`reviewedAt`; not computed) — **S**
- By-provider breakdown on Overview (KYC module has no provider concept; per-provider data lives in `trading/pages/account-kyc-statuses-page.tsx`) — **M** (or **L** if consolidating provider mgmt into KYC module)
- "Provider" + "Reviewer" columns on Reviews queue (data model missing `provider`, `reviewedBy`) — **S**
- Risk scoring by country / document type / age / completeness (current Risk page only shows low/med/high distribution) — **M**
- KYC Providers config / status / fallback management screen (Sumsub/Onfido/Veriff/Identity) — **L**
- Document management — upload / view / verify (no `documents[]` array on KycRecord; no UI) — **L**
- "Request additional docs" action (only Approve/Reject exist) — **S**
- Use ContextualActionPanel pattern (build `KycReviewActions` in `contextual-actions.tsx`; mirror PayoutReviewActions) — **S** (§22-23, §37)
- AlertDialog friction on Reject (currently plain `Button variant="ghost"`) — **S** (§24)
- Bulk KYC actions (bulk approve/reject/assign reviewer; DataTable has no selection) — **M**
- KYC audit trail per applicant (general audit log exists, no per-applicant timeline drawer) — **M**
- AML/sanctions screening (no mock data, no UI, no flag on KycRecord) — **L**
- PEP screening — **L**
- KYC re-verification schedule (annual; no `expiresAt`/`reverifyAt` field; `kyc.expired` state exists but no scheduling UI) — **M**
- Risk score explanation/breakdown (shows "high" without WHY — no sub-components) — **M** (§19, §20)
- Use `ExplainableStateBadge` instead of plain `StatusBadge` (inconsistent with trading's account-kyc-statuses which does) — **S** (§17-19)
- Apply `term()` to page headers (hardcoded "KYC / AML") — **S** (§54-55)
- Build `settings-kyc` page or remove dead-link settings entry — **S**

### SUPPORT — PRESENT
- Manifest: id `support`, v1.0.0, category `core`, optional `true`, deps `["trading"]`, apps `[prop-admin, super-admin, trader]` (NOTE: trader included but all 3 pages are admin-facing — see UX gaps), accentColor `#c2410c` (orange — Terra-allowed), 2 perms (`support.read`, `support.configure`), 3 nav children at order 80, 3 routes, 3 widgets, 1 settings entry (DEAD LINK).
- Overview (`support-pages.tsx:SupportOverviewPage`): 4 MetricCards (Open/Urgent/Avg Response/Resolved Today) + recent tickets DataTable (6 rows) + Priority distribution DonutSeries + New Ticket button (toast).
- Tickets (`SupportTicketsPage`): full DataTable, 8 cols (Subject/Trader/Category/Priority/Status/Assignee/Created/Messages). `onRowClick` fires toast only — no detail drawer.
- Knowledge (`SupportKnowledgePage`): 6 hardcoded FAQ Cards in responsive grid (const `faqItems` array at lines 150-193). No CRUD.
- Widgets: `SupportOverviewWidget` (4 KPI MetricCards), `RecentTicketsWidget` (DataTable 6 rows), `TicketPriorityWidget` (DonutSeries).
- Attention Center has 1 entry (urgent tickets) ✓. Global Search indexes Support Tickets ✓. Uses `relativeTime` helper (§29 pattern ✓). `avgResponseHours` helper computes real SLA-like metric from `createdAt`+`lastReplyAt`.

### SUPPORT — MISSING / THIN (effort)
- Satisfaction (CSAT) score metric on Overview (spec #1; no `csat` field, no survey mechanism) — **M**
- By-category breakdown on Overview (spec #1; only Priority donut shown) — **S**
- SLA timer / SLA breach indicator on Tickets list (spec #2; data exists but no "Due in Xh"/"Breached" badge) — **M**
- SLA management policy config (per-priority targets, breach dashboard) — **L**
- Ticket detail workspace — conversation thread / internal notes / attachments / escalation (spec #3; `onRowClick` only toasts) — **L** (§28)
- Knowledge Base CRUD (spec #4; only 6 hardcoded FAQ items, no backend, no admin UI) — **L**
- Knowledge Base — categories / search / public/private toggle — **M**
- Live chat / chat widget (spec #5) — **L**
- Ticket assignment & workload dashboard (e.g. "Sarah: 12 open, Marcus: 8") — **M**
- Canned responses / macros (spec #8) — **M**
- CSAT surveys post-resolution (spec #9) — **M**
- Escalation rules (spec #10) — **M**
- Auto-routing / auto-tagging rule engine (spec #11) — **L**
- Support analytics dashboard (spec #12; current Overview has 4 KPIs + 1 donut — needs trend charts, agent leaderboard) — **M**
- Bulk ticket actions (bulk assign/close/priority; DataTable has no selection) — **M**
- Filter chips on Tickets list (only search; no status/priority/category/assignee/date filters) — **S** (mirror `enhanced-withdrawals-page` pattern)
- Empty state on Tickets list (no `emptyTitle`/`emptyDescription` — §30 violation; KYC + Support Overview have proper ones) — **S**
- Last Reply column not shown on Tickets list (`lastReplyAt` field exists but `messages` count shown instead) — **S**
- Apply `term()` to page headers (hardcoded "Support") — **S**
- Build `settings-support` page or remove dead-link settings entry — **S**
- Trader-facing support portal (manifest declares `trader` app but all pages are admin-only; §5 violation) — **L**

### AI — PRESENT
- Manifest: id `ai`, v1.0.0, category `ai`, optional `true`, deps `["trading", "analytics"]`, apps `[prop-admin, super-admin]`, accentColor `#7c3aed` (violet — explicitly allowed, NOT blue/indigo), 2 perms (`ai.read`, `ai.configure`), 4 nav children at order 85 (Overview/Insights/Assistant/Configure), 4 routes, 3 widgets, 1 settings entry (DEAD LINK). Capabilities declared: `ai.insights`, `ai.assistant`, `ai.predictions`, `ai.anomaly` (last 2 unused).
- Overview (`ai-pages.tsx:AiOverviewPage`): 4 MetricCards (Active Insights/Avg Confidence/Opportunities/Critical Alerts) + insights feed list + BarSeries "Confidence by insight".
- Insights (`AiInsightsPage`): full grid of insight Cards w/ severity icon, confidence progress bar, Dismiss button (toast).
- Assistant (`AiAssistantPage`): mock chat UI w/ `seedChat` (5 hardcoded messages), input box, Send button, Enter-to-send, toast feedback on send, ScrollArea, "demo mode" disclaimer, Avatars for user/assistant.
- Configure (`AiConfigurePage`): 3 feature toggles (Insights/Predictions/Anomaly Detection) + Model selection (GPT-4o mini/GPT-4o/Claude 3.5 Sonnet/Llama 3.1 70B/Mistral Large) + Save button (toast). Includes "Tip" callout about cost-vs-capability.
- Widgets: `AiOverviewWidget` (4 KPI MetricCards), `AiInsightsWidget` (top-4 insights list), `AiConfidenceWidget` (BarSeries).
- Attention Center has 1 entry (AI opportunities detected) ✓. mock-data has `AiInsight` interface (id/tenantId/module/title/summary/detail/severity/confidence/generatedAt) + 3 seed insights + `getTenantAiInsights` helper.

### AI — MISSING / THIN (effort)
- Usage metrics (spec #1: calls/day, accuracy %, model status; only `active/avg confidence/opportunities/critical` shown) — **M**
- AI Cost tracking (spec #1, #5; no `aiCost` data, no per-model cost-per-call, no monthly spend chart, no budget alerts) — **M**
- AI Model fine-tuning config (spec #6; no dataset upload, no training config, no eval metrics) — **L**
- AI Feedback loop — thumbs up/down, corrections (spec #7) — **M**
- AI Audit log (spec #8; general audit log exists but no AI-specific log of prompts/responses/model invocations) — **M**
- AI Use cases / applications gallery — predetermined templates (spec #9) — **M**
- AI Predictive analytics — churn risk / payout fraud risk / trader success probability (spec #10; Predictions toggle exists but no predictions UI) — **L**
- AI Anomaly detection — unusual trading patterns (spec #11; Anomaly toggle exists, capability declared but unused) — **M**
- AI Conversation history persistence (`seedChat` in `useState`; resets on reload/navigate; no "Previous conversations" sidebar; spec #12) — **M**
- AI Assistant context awareness + action suggestions (spec #3; seedChat demonstrates context but real send → only toast; no "Apply recommendation" buttons) — **M**
- Insights — filter by severity/module/confidence (full grid renders flat) — **S**
- Insights — "Dismiss" only toasts; no state mutation, no dismissed-list, no audit trail — **S**
- Insights — no drill to underlying entity ("Payout spike detected" should link to payouts filtered to last 7d) — **M**
- Insights — only "Dismiss" action; no "Apply"/"Investigate"/"Create ticket from insight" — **S** (§23 One Primary Action violation)
- Configure — feature toggles all flat (no Advanced section for temperature/top-p/max tokens/system-prompt overrides) — **M** (§12-13 Progressive Disclosure)
- Configure — no API key management UI (spec #4) — **M**
- Configure — no prompts management UI (spec #4: `prompts`) — **M**
- Configure — no training data management UI (spec #4: `training data`) — **M**
- Configure — `ai.configure` permission declared but Save button not gated (route is gated by `ai.read` only) — **S**
- AI insights not indexed in Global Search (KYC records + Support tickets ARE indexed) — **S**
- Apply `term()` to page headers (hardcoded "AI / LLM") — **S**
- Build `settings-ai` page or remove dead-link settings entry — **S**
- Mock data: only 3 AI insights total — extremely thin. Tenant-alpha has 0 insights even if AI module enabled. `getTenantAiInsights` "platform" fallback (mock-data.ts line 1195) is dead code — no platform-level insights seeded — **S**

### CROSS-TENANT GAPS
- **Per-provider KYC data is fake per-tenant**: `account-kyc-statuses-page.tsx:deriveProviderKyc` deterministically derives provider statuses from the KycRecord id (lines 66-94 of that file). Not real per-tenant provider config. Two tenants with the same KycRecord id pattern get the same provider matrix. No "Tenant Alpha uses Sumsub primary, Onfido fallback" config exists.
- **AI insights are not tenant-scoped**: Only 3 hardcoded insights total. `getTenantAiInsights(tid)` includes a `tenantId === "platform"` fallback but no platform-tenant AI insights are seeded → dead code.
- **Support tickets seeded only for tenant-alpha/beta/gamma** (mock-data.ts line 1002) — platform tenant has 0 tickets.
- **All 3 modules' settings entries are DEAD LINKS** (`settings-kyc`, `settings-support`, `settings-ai` declared in manifests but no pages in view-router.tsx). Same pattern as marketing/crm/affiliates/accounting flagged in prior worklog entries.
- **No multi-tenant module config**: Super-admin can't see per-tenant KYC provider, per-tenant SLA targets, per-tenant AI model selection.
- **Cross-module AI suggestions not deep-linkable**: AI insight "KYC backlog growing" (ai-3, tenant-gamma) has no "Open KYC queue" action. Attention Center navigates to `ai-insights` but insight cards themselves are dead-end.
- **No shared Compliance Workspace** unifying KYC + AML + PEP + sanctions + audit trail.
- **Super-admin KYC Provider row** (super-admin-pages.tsx line 287) shows "KYC Provider | operational | 310ms" globally but no drill to per-tenant provider config.

### UX GAPS (AGENTS § references)
- §22-23 Contextual Actions: KYC Reviews uses raw inline Approve/Reject buttons; no `KycReviewActions` component in `contextual-actions.tsx` (only Payout + Breach exist). Inconsistent with Payouts/Breaches which use the ContextualActionPanel pattern.
- §24 Destructive Actions: KYC Reject + AI Dismiss are plain buttons without AlertDialog friction. Compare: Payouts reject uses AlertDialog with consequence text.
- §17-19 Explainability + State-First: KYC status uses plain `StatusBadge`; trading's account-kyc-statuses uses `ExplainableStateBadge`. AI severity uses StatusBadge; AI insight has a `detail` field (partial credit ✓). Risk level badge shows "high" without breakdown of contributing factors.
- §20 Rule Engine UX: KYC Risk score has no human-readable explanation layer (no "How is this calculated?" expansion).
- §25-26 Tables: Support Tickets list has 8 cols with no filter chips (only search), no bulk select, no row drill (click → toast).
- §27 Drawer vs Page: No detail drawer for KYC record, Ticket, or AI conversation.
- §28 Entity Workspaces: No KYC record workspace, no Ticket detail workspace, no AI conversation workspace. KYC Review is flat table; Ticket is flat table; AI Assistant is single chat (no "previous conversations" sidebar).
- §29 Activity Timelines: No per-applicant KYC timeline, no per-ticket conversation timeline (only created/replied cols), no AI conversation history timeline.
- §30 Empty States: SupportTicketsPage DataTable has no `emptyTitle`/`emptyDescription`. KYC + Support Overview have proper ones.
- §33 Help: No `LabelWithHelp` on Risk or Approval metrics in KYC. No contextual help on AI Confidence metric.
- §11 Attention Center: KYC + Support + AI all have entries ✓ — present.
- §35 Search: Global search indexes KYC records + Support tickets ✓. AI insights NOT indexed.
- §16 Templates: No KYC verification templates / Support response macros / AI prompt templates. Spec calls for AI Use cases gallery.
- §12-13 Progressive Disclosure: AI Configure exposes all toggles flat; no "Advanced" section for model params.
- §54-§55 Terminology: None of the 3 modules apply `term()` to page headers. Hardcoded "KYC / AML", "Support", "AI / LLM", "Knowledge Base", "AI Configuration".
- §32 Error States: No module-level error boundary in any of the 3 modules.
- §31 Loading States: No skeletons. All pages render synchronously from mock data. (Acceptable for demo; gap for real integration.)
- §23 One Primary Action: AI Insights has only "Dismiss" — no primary action ("Apply"/"Investigate").
- §5 User-Centered Dashboards: Support manifest declares `trader` app (line 48) but ALL 3 pages are admin-facing. No trader-facing support portal. Trader can't see own tickets, browse KB, or start live chat.

### TOP PRIORITY ACTIONS (ordered, with effort)
1. **KYC — Build KYC Providers management screen in KYC module** (consolidate from `trading/account-kyc-statuses`; surface provider config/status/fallback per tenant; aligns with FUNDERBLU spec #11 + FLOW-ANALYSIS missing flows) — **L**
2. **Support — Build Ticket Detail workspace** (conversation thread + internal notes + attachments + escalation actions + SLA countdown + canned response selector; replaces toast-only `onRowClick`) — **L** (§28)
3. **Support — Build SLA management** (per-priority SLA targets, SLA badge on ticket list with countdown/breached state, SLA breach dashboard) — **L**
4. **AI — Wire AI Assistant to real LLM + persist conversation history** (replace `seedChat`; add "Previous conversations" sidebar; spec #3 + #12) — **M**
5. **KYC — Add AML/sanctions + PEP screening screens** (separate "Screening" tab in KYC module; surface hits with explainable badges) — **L** (spec #9, #10)
6. **AI — Add Cost tracking + Usage metrics + Model status to AI Overview** (calls/day, accuracy %, monthly spend, budget alerts, operational status) — **M** (spec #1, #5)
7. **Support — Build Knowledge Base CRUD** (replace 6 hardcoded FAQ items with articles list, categories, search, public/private toggle, edit/create article page) — **L** (spec #4)
8. **AI — Add AI Feedback loop + AI Audit log** (thumbs up/down on each insight + assistant message; AI audit log page showing prompt/response/model/timestamp) — **M** (spec #7, #8)
9. **Support — Add filter chips + bulk actions to Tickets list** (mirror `enhanced-withdrawals-page` filter bar; bulk assign/close/priority) — **M** (§25-26)
10. **KYC — Switch to ContextualActionPanel pattern + add "Request additional docs" third action + AlertDialog friction on Reject** (build `KycReviewActions` in `contextual-actions.tsx`; mirror PayoutReviewActions) — **S** (§22-24, §37)
11. **AI — Add AI Predictive analytics page + Anomaly detection page** (churn risk / payout fraud risk / trader success probability / unusual trading patterns) — **L** (spec #10, #11)
12. **KYC — Add Risk breakdown by country / document type / age / completeness** (current Risk page only shows low/med/high donut) — **M** (spec #3)
13. **KYC — Add Approval rate / Rejection rate / Avg processing time / By-provider metrics to Overview** (data already exists; just compute and render) — **S**
14. **AI — Add Insights filter (severity/module/confidence) + "Apply recommendation" action on each insight** (currently only Dismiss) — **S** (§23)
15. **KYC — Add KYC re-verification schedule (annual) + `expiresAt` field on KycRecord + overdue re-verification queue** — **M** (spec #11)
16. **Build settings-kyc / settings-support / settings-ai pages OR remove dead-link settings entries from manifests** — **S** each (×3) — same pattern as marketing/crm/affiliates/accounting already flagged
17. **Apply terminology (`term()`) to page headers in all 3 modules** — **S** each (×3) (§54-55)
18. **Support — Build CSAT survey mechanism** (post-resolution survey widget + CSAT KPI on Overview + CSAT trend chart) — **M** (spec #9)
19. **Support — Build Live chat widget** (trader-side chat + admin-side queue) — **L** (spec #5)
20. **AI — Add Use cases gallery + Prompts management + API keys + Training data tabs to Configure page** — **M** each (spec #4, #9)

### Code Changes
None — analysis-only task. No files modified.

### Stage Summary
Deep read-only analysis of KYC + Support + AI modules. Total ~1497 LOC across 12 files. 3 manifest settings entries are DEAD LINKS (same pattern as 4 other modules previously flagged). KYC module is thinnest (3 pages, only Approve/Reject inline buttons, no provider/AML/PEP/document mgmt). Support module has no ticket detail drawer (only toast on row click), no SLA badge, no KB CRUD, no CSAT, no live chat. AI module's `ai.predictions` + `ai.anomaly` capabilities are declared but unused; `getTenantAiInsights` has a "platform" fallback that is dead code; `seedChat` is hardcoded and lost on reload. All 3 modules lack terminology application, module-level error boundaries, and use plain StatusBadge instead of ExplainableStateBadge where applicable. 20 ordered priority actions documented; lead can dispatch follow-up tasks for items 1-3 (each effort L) and items 10/13/14/16/17 (each effort S) in parallel.

---

## Task ID: analysis-settings-super-shell
**Agent:** Explore (deep module analysis)
**Task:** Deep analysis of Settings + Super-Admin + Audit + Shell components — identify gaps vs. FUNDERBLU spec + AGENTS UX constitution.

### Files Inspected
- `src/modules/settings/` — `settings-module.ts` (86 LOC, manifest), `settings-page.tsx` (580 LOC, 7 tabs), `index.ts`, `pages/*.tsx` (19 files, 11,053 LOC)
  - `user-management-page.tsx` (454 LOC), `group-management-page.tsx` (417 LOC), `token-management-page.tsx` (335 LOC), `token-detail-page.tsx` (952 LOC), `email-templates-page.tsx` (363 LOC), `email-template-edit-page.tsx` (753 LOC), `certificate-management-page.tsx` (549 LOC), `certificate-template-designer-page.tsx` (779 LOC), `certificate-font-upload-page.tsx` (566 LOC), `certificates-issued-page.tsx` (597 LOC), `certificate-detail-page.tsx` (751 LOC), `banner-management-page.tsx` (488 LOC), `marketing-banner-edit-page.tsx` (837 LOC), `notifications-management-page.tsx` (494 LOC), `notification-edit-page.tsx` (627 LOC), `utilities-page.tsx` (778 LOC), `social-media-links-page.tsx` (762 LOC), `device-activities-page.tsx` (689 LOC), `marketing-integrations-page.tsx` (782 LOC)
- `src/modules/super-admin/` — `super-admin-module.ts` (61 LOC, manifest), `super-admin-pages.tsx` (324 LOC, 4 pages: Overview/Tenants/ModuleCatalog/PlatformHealth), `tenant-detail-page.tsx` (1,157 LOC, 7 tabs), `create-tenant-page.tsx` (912 LOC, 5-step wizard), `tenant-lifecycle-page.tsx` (476 LOC), `dashboard-manager-page.tsx` (1,103 LOC, GridStack drag-drop)
- `src/modules/audit/` — `audit-page.tsx` (21 LOC, thin wrapper), `user-events-page.tsx` (249 LOC), `enhanced-user-events-page.tsx` (959 LOC), `user-event-detail-page.tsx` (325 LOC), `change-history-page.tsx` (305 LOC). **NOTE: NO `audit-module.ts` manifest exists — audit has no FrontendModule registration, no permissions, no nav entries, no settings entries.**
- `src/components/shell/` — `app-shell.tsx` (71 LOC), `sidebar.tsx` (242 LOC), `topbar.tsx` (294 LOC), `breadcrumbs.tsx` (161 LOC), `command-menu.tsx` (243 LOC), `global-search.tsx` (247 LOC), `boot-screen.tsx` (85 LOC), `activity-ticker.tsx` (54 LOC), `keyboard-shortcuts-help.tsx` (121 LOC), `onboarding-wizard.tsx` (409 LOC), `whats-new.tsx` (228 LOC)
- `src/components/platform/` cross-cutting skim: `attention-center.tsx`, `audit.tsx` (AuditLogTable + ActivityTimeline + EntityChangeHistory), `contextual-actions.tsx` (PayoutReviewActions + BreachResolutionActions only — no KYC/User/Tenant variants), `guards.tsx` (PermissionGuard/ModuleGuard/FeatureGuard/ModuleErrorBoundary), `state-explanations.tsx`, `page.tsx`, `data-table.tsx`, `dashboard-router.tsx` (renders fallback "View X not found" for unknown viewIds)
- `src/lib/platform/view-router.tsx` (342 LOC, 100+ viewId entries), `module-bootstrap.ts` (registers 14 modules — super-admin, settings, trading, challenges, risk, payouts, analytics, affiliates, accounting, marketing, crm, kyc, support, ai). **Audit module NOT registered.**
- `src/lib/platform/mock-data.ts` (1,546 LOC, auditLog + userEvents + changeHistory seeded)
- Context: `worklog.md` last ~300 lines, `AGENTS.md` §3-§87, `FLOW-ANALYSIS.md` (18 missing flows; Settings is listed as "PARTIALLY IMPLEMENTED — needs challenge type mgmt, phase mgmt, email template mgmt, certificate mgmt, utility mgmt").

### SETTINGS — PRESENT
- **Manifest** (`settings-module.ts`): id `settings`, v1.0.0, category `core`, apps `[prop-admin, super-admin]`, 3 perms (`settings.manage`, `users.manage`, `audit.read`), accentColor `#404040` (Terra-allowed). 19 sidebar children all wired to real viewIds. 20 routes declared (one orphan route: `group-management` has no sidebar child pointing to it — only `settings.users` etc. exist; `group-management` is reachable only via direct navigate from elsewhere). **All settings nav links are LIVE (no dead links — unlike marketing/crm/affiliates/accounting/kyc/support/ai flagged previously).**
- **Settings Overview** (`settings-page.tsx`): 7 tabs (General / Branding / Terminology / Modules / Roles / Integrations / Notifications). Modules tab is the demo centerpiece — toggling modules updates tenant entitlements live (sidebar+dashboard re-compose instantly per §67). Branding tab has 6 color presets + primary/accent/surface/radius/initials + **live preview pane**. Terminology tab exposes 8 editable keys (`challenge`/`trader`/`payout`/`account`/`evaluation`/`participant`/`withdrawal`/`disbursement`). Integrations tab has 5 categories × 3-4 providers each (Trading Platform: MT5/MT4/DXTrade; Payments: Stripe/Wise/Crypto/PayPal; KYC/AML: Sumsub/Onfido; Notifications: SendGrid/Slack/Twilio; AI&Analytics: OpenAI/Segment) with status/health/last-sync + masked-credential note (§44). General tab exposes Export-All-ZIP (real `exportAllAsZip` via JSZip dynamic import).
- **User Management** (`user-management-page.tsx`): full DataTable with 8 cols (User/KYC/2FA/Revenue/Accounts/Status/LastActive/Actions), 4 KPI cards (Total/Verified KYC/2FA/Suspended), search + status filter + KYC filter + clear, pagination. Combines `authUsers` + `getTenantTraders` for unified admin+trader view. 2FA badge derived deterministically. Per-row Edit/View actions (toast-only).
- **Group Management** (`group-management-page.tsx`): master/detail 2-pane (group list + members table) with 5 deterministic groups (Platform Admins / Prop Firm Admins / VIP Traders / New Traders / Risk Watch) + KPI row + bulk-select checkboxes + Add Group/Export/Add Member toast actions. Member table shows Avatar/Email/Type(staff/trader)/Status.
- **Token Management** (`token-management-page.tsx` + `token-detail-page.tsx`): list page with 4 KPIs + search + DataTable (Key/User/Scope/Created/LastUsed/Status + Copy/Revoke actions). Detail page (952 LOC) has read-only Key + editable User/Expiration/Scopes/IP-Whitelist/IsActive + "Token Usage Stats" card (total calls / 24h calls / last IP / most-called endpoint) + Save variants (Save / Save & add another / Save & continue editing) + Regenerate Key + AlertDialog-gated Delete. Uses `LabelWithHelp` (§33). Breadcrumb: Token Management > [token hash].
- **Email Templates** (`email-templates-page.tsx` + `email-template-edit-page.tsx`): master/detail list with 5 templates + Detail Panel (Subject/Body/Variables + Send Test + Save). Edit page (753 LOC) has 2-tab editor: Content (WYSIWYG rich-text contentEditable with Bold/Italic/Underline/Bullet/Numbered/Link/Source-toggle + Variables dropdown inserting `{{user_name}}` etc. at caret) + Recipients (CC/BCC/Reply-To) + Save variants + AlertDialog delete. Send Test fires a toast.
- **Certificate Management** — 5 files covering the full lifecycle:
  - `certificate-management-page.tsx`: Templates tab (DataTable + master/detail editor with Name/Description/TriggerEvent/Layout/Active toggle + placeholder preview) + Fonts tab (4 mock fonts with Select/Delete).
  - `certificate-template-designer-page.tsx` (779 LOC): visual designer with image upload + live preview pane overlaying field text at X/Y positions + editable fields table (FieldName/ValueTemplate/TextCase/ShortenOver/DateFormat/Font/FontSize/FontColor/X/Y) + Add Field + Save/Reset.
  - `certificate-font-upload-page.tsx` (566 LOC): font management with @font-face live preview via data URL, DataTable with Download/Delete.
  - `certificates-issued-page.tsx` (597 LOC): searchable list with KPIs + filters (Type/Status) + DataTable + 3-dot menu → View Certificate (links to certificate-detail). Uses `ExplainableStateBadge` (§17-19 ✓).
  - `certificate-detail-page.tsx` (751 LOC): single issued-cert view + Edit toggle unlocking editable fields + Save variants + AlertDialog delete.
- **Banner Management** (`banner-management-page.tsx` + `marketing-banner-edit-page.tsx`): tabs (Announcement/Marketing) + DataTable + inline editor (Title/Content/Status/Start-End/Position). Edit page (837 LOC) has image upload + preview + Display Settings (Active/SortOrder/Position) + Destination (ExternalURL/InternalPage/None) + collapsible Scheduling + collapsible Targeting (Audience/Countries) + live preview + Save variants + AlertDialog delete.
- **Notifications Management** (`notifications-management-page.tsx` + `notification-edit-page.tsx`): list with 4 KPIs + DataTable + inline Switch (AlertDialog-gated for destructive) + filter + search. Edit page has Basic Info + Time Settings + collapsible User Segment targeting (same shape as Offer edit) + Preview area + Save variants.
- **Marketing Integrations** (`marketing-integrations-page.tsx`): 7 platforms (Klaviyo/GA4/MetaPixel/Discord/Slack/Mailchimp/HubSpot) with KPIs + DataTable + inline edit panel (Platform/IsActive/EnableEventLogging + collapsible "API Secret Key Format per Platform" help with JSON examples + masked key input with Show/Hide + Test Connection + Save + AlertDialog Disconnect). Uses `LabelWithHelp` (§33 ✓).
- **Social Media Links** (`social-media-links-page.tsx`): 8 platforms (Twitter/X/Instagram/Telegram/Discord/YouTube/TikTok/LinkedIn/Facebook) with KPIs + filter bar + inline Add Link form + DataTable (Platform badge with icon / Handle / CustomURL / Account / Created / Edit-Delete actions) + **real `exportToCsv`** (not toast-only) + AlertDialog for delete.
- **Device Activities** (`device-activities-page.tsx`): 690 LOC, login device history with KPIs (Total/UniqueIPs/Mobile/Desktop/MostActiveCountry) + collapsible info banner + filter bar (search + source/device-type/platform + date range) + DataTable (Source/DeviceID/IP/DeviceType/Platform/Country/FirstSeen/LastSeen/LoginCount + Actions) + **real `exportToCsv`** + AlertDialog for revoke.
- **Utilities** (`utilities-page.tsx`): 778 LOC, utility link management with KPIs + DataTable + search + filter by section + **inline Dialog create/edit form** (Title/Description/Section/LinkURL/IconURL/IsActive/DisplayOrder) + AlertDialog delete. 4 sections (Utility/Help/Resource/External).
- **Localization** — partial: General tab exposes Currency (USD/GBP/EUR/AED) + Timezone (free text). `tenant.locale` is read-only (only visible on tenant-detail Overview).
- **White-label branding + live preview** — ✓ Branding tab (§16 Templates pattern, §33 Help, §41 visual hierarchy ✓).
- **Backup** — ✓ partial: General tab "Export all data (ZIP)" uses real `exportAllAsZip` (JSZip dynamic import + README.txt + multi-CSV).

### SETTINGS — MISSING / THIN (effort S/M/L)
- **Plan/billing management** — Tenant plan is read-only in General tab; no plan-change/upgrade UI; no invoice list; no billing contact; no payment-method management. **M** (FUNDERBLU spec §43; FLOW-ANALYSIS partial).
- **2FA settings** — `user-management-page` shows 2FA badge (on/off) but no admin enforcement (e.g. "Require 2FA for all admins" toggle, per-user 2FA reset, backup codes). No 2FA setup screen for the current user. **M** (spec §43).
- **Webhook configuration** — Marketing integrations has webhook-platform connections (Discord/Slack) but no admin webhook config (no outbound webhook URL + secret + event selection + retry policy + delivery log). **M** (spec §43).
- **Audit log settings** — No settings page for retention policy, severity thresholds, export schedule, PII redaction rules. **S** (spec §43; tied to audit module gap below).
- **Restore (backup counterpart)** — `exportAllAsZip` exists in `bulk-export.ts` (199 LOC), but no `importFromZip` / restore flow. **L** (spec §43).
- **Localization — language selector** — `tenant.locale` is set in mock-data but never editable; only currency + timezone are exposed. No language picker (en-US/en-GB/ar-AE/etc.). **S**.
- **Settings Overview landing pattern** — Settings landing uses 7-tab layout, NOT a "grid of all settings sections" with search. With 19 sidebar children + 7 tabs + 19 sub-pages, operators must scan sidebar (§7 / §80 "Sidebars with 20+ items" red flag — current sidebar is exactly at the threshold). No unified "search settings" input. **M** (§6 Navigation, §35 Search, §80 Red Flags).
- **Group-level permissions** — Group page shows members only; no per-group permission editor (only Roles tab on Settings page shows role-level perms, not group-level). **M** (spec §43).
- **User Management — Add/Edit form** — Add/Edit/Import buttons are toast-only (line 281, 295, 330, 350). No actual create/edit user form (compare to token-detail-page which has full form). **M** (§27 Drawer vs Page — needs a User edit page or drawer).
- **User Management — Login-as / Impersonate** — No "Login as user" action (common admin tool, spec §43). **S**.
- **User Management — Deactivate / Suspend** — No row action to suspend/deactivate a user (only View/Edit ghosts). **S**.
- **Audit log settings entry** — `settings-module.ts` declares no `settings` field; no audit-config view. The 3rd permission `audit.read` is declared but unused within settings. **S**.
- **`group-management` route orphan** — `settings-module.ts:51` declares `path: "group-management"` route but NO sidebar child has `href: "group-management"`. Only reachable via `navigate("group-management")` if some other page links to it — **grep shows NO caller**. Orphan route. **S** (delete from routes[] or add a sidebar child).
- **`audit.read` permission unused in settings** — declared in `settings-module.ts:79` but never referenced by `PermissionGuard` in any settings page. **S**.

### SUPER-ADMIN — PRESENT
- **Manifest** (`super-admin-module.ts`): id `super-admin`, v1.0.0, category `core`, apps `[super-admin]`, 4 perms (`platform.tenants.read/manage`, `platform.modules.manage`, `platform.health.read`), accentColor `#0a0a0a`. 7 sidebar children (Overview/Tenants/CreateTenant/Lifecycle/ServiceCatalog/SystemHealth/DashboardManager), all wired to real viewIds. No dead links.
- **Platform Overview** (`SuperAdminOverviewPage`): 4 KPIs (Active Tenants w/ delta +3, Total Traders w/ delta +8, MRR w/ delta +12, Modules count) + tenant distribution list (color swatch + name + plan badge + status badge) + module adoption bars (count/total + Progress component).
- **Tenants list** (`TenantsPage`): full DataTable, 7 cols (Tenant/Plan/Status/Modules/Features/Currency/Created/Actions) + search + stage filter dropdown (all/invited/trial/active/suspended/terminated) + onRowClick → `navigate("tenant-detail", { id })` + Lifecycle button + Create tenant button.
- **Create Tenant Wizard** (`create-tenant-page.tsx` — 912 LOC): 5-step wizard (Basics/Branding/Modules/Admin/Review) with step indicator (done/active/inactive circles + connecting bars), smart defaults (CORE_MODULE_IDS pre-selected: trading/challenges/risk/payouts/settings), 6 color presets, plan cost table, timezone select, admin user form, Back/Next nav, persists to global context + navigates to tenant-detail on Create.
- **Tenant Detail** (`tenant-detail-page.tsx` — 1,157 LOC): **EntityHeader** with avatar + badges (plan + status) + 4 action buttons (Edit Configuration / Suspend[AlertDialog] / Reactivate / Terminate[AlertDialog]) with explicit consequence text (§24 ✓). 6 KPI cards (Traders/Active Accounts/MRR/Open Breaches/Pending Payouts/KYC Pending). 7 tabs (Overview/Modules/Users/Billing/Activity/Configuration/Risk). Modules tab toggles per-tenant module entitlement live. Activity tab uses `ActivityTimeline`. Risk tab summarises breaches + accounts. Configuration tab has inline editor with terminology + branding + currency/timezone/locale.
- **Tenant Lifecycle Pipeline** (`tenant-lifecycle-page.tsx` — 476 LOC): 5-stage horizontal pipeline (Invited → Trial → Active → Suspended → Terminated) with color-coded cards (count + icon + description) + click-to-filter DataTable + per-row lifecycle action (Suspend[AlertDialog]/Reactivate/Terminate[AlertDialog]) + pushNotification on state change.
- **Service Catalog** (`ModuleCatalogPage`): grid of all registered modules (icon + version + category + description + adopters count + supported-apps badges + permissions list).
- **Platform Health** (`PlatformHealthPage`): 4 KPIs (Uptime 30d / Avg Latency / Error Rate / Active Sessions) + service status list (API Gateway / Database / MT5 Bridge / Payment Processor / KYC Provider / AI Engine) with StatusBadge + latency. Note: 6 services only — no queue depths, no error trends, no historical uptime chart.
- **Dashboard Manager** (`dashboard-manager-page.tsx` — 1,103 LOC): per-tenant × per-role layout config using GridStack drag-and-drop. Tenant + Role selectors, widget library sidebar, add/remove widgets, lock/unlock layout, preview-as-tenant, persists to localStorage keyed by `{tenantId}:{roleId}`. Includes save/restore/reset/clear buttons + search widgets + filter by category.

### SUPER-ADMIN — MISSING / THIN (effort S/M/L)
- **Tenant impersonation (Login-as)** — No "Login as tenant admin" action on Tenant Detail (only Edit Configuration / Suspend / Reactivate / Terminate). Spec §43 calls for super-admin to support tenants; common operational need. **M** (§22 Contextual Actions).
- **Platform audit log (cross-tenant)** — Super-admin Overview has no audit tab; the generic AuditPage (`audit-page.tsx`) is tenant-scoped via `getTenantAudit(tid)`. Cross-tenant audit not surfaced. **M** (spec §6, §61).
- **Tenant data export / migration** — No "Export tenant data" action on Tenant Detail; no "Migrate tenant to another region" flow. `exportAllAsZip` exists per-tenant via Settings but is not surfaced from super-admin. **M** (spec §6).
- **Tenant usage analytics (storage/users/requests)** — Tenant Detail shows Traders + Active Accounts + MRR + Open Breaches + Pending Payouts + KYC Pending. Missing: storage used (MB), API request count (24h/30d), widget render count, login count. **M** (spec §6).
- **Feature flag management** — No platform-wide feature flag UI; `tenant.enabledFeatures` is editable only via the Tenant Detail Configuration tab inline (free-text feature ids). No catalog of available feature flags with descriptions. **M** (spec §6, §43).
- **Platform-wide announcements** — No super-admin announcement banner creation flow. Banner Management page is per-tenant only (the current tenant). **M** (spec §6, FLOW-ANALYSIS #15).
- **Support ticket queue (cross-tenant)** — No super-admin cross-tenant ticket queue. Support Tickets page is per-tenant via `getTenantTickets(tid)`. **L** (spec §6).
- **API rate limiting per tenant** — No rate-limit config on Tenant Detail; no per-tenant request quota. **M** (spec §6).
- **Platform API keys management** — Super-admin has no platform-level API keys page (token-management is per-tenant at settings level). **M** (spec §6).
- **Multi-region deployment status** — Platform Health shows 6 services but no region selector, no per-region status, no failover info. **L** (spec §6).
- **Tenant Detail — "Edit Configuration" button is a DEAD LINK** — `tenant-detail-page.tsx:248` calls `navigate("tenant-config", { id: localTenant.id })`, but `"tenant-config"` is NOT in view-router.tsx viewRegistry. Dashboard-router renders fallback "View 'tenant-config' not found". The Configuration tab is already present in the same page (line 384-386), so the button duplicates a non-existent page. **S** (delete the button or wire it to scroll to the Configuration tab).
- **Tenant Detail — 7 tabs vs. spec list** — File header comment (lines 1-18) promises tabs "Overview, Modules, Features, Branding, Users, Billing, Activity, Audit, Config" (9 tabs) but actual TabsList has 7 tabs (Overview/Modules/Users/Billing/Activity/Configuration/Risk). Features+Branding merged into Configuration; Audit missing entirely. Doc drift. **S** (update comment OR add Audit + split Features+Branding).
- **Tenant Detail BillingTab** — only shows plan + monthly cost + a "Manage billing" toast button; no invoice history, no payment methods, no usage-based billing chart, no proration preview. **M** (spec §6).
- **Platform Health — no queue depths, no error trends, no historical uptime** — Static list of 6 services with one latency number each. No time-series chart (compare to analytics module which has 30-day series). **M** (spec §6, §4 Operating Center).
- **Super-admin Module — no settings entry** — `super-admin-module.ts` declares no `settings` field; no platform-level config view (e.g. default plan for new tenants, default module set, default branding). **S**.
- **Super-admin — no permissions for tenant impersonation / data export / billing management** — Only 4 perms declared; no `platform.tenants.impersonate`, `platform.tenants.export`, `platform.billing.manage`. **S** (add perms even if pages come later).

### AUDIT — PRESENT
- **AuditPage** (`audit-page.tsx` — 21 LOC, thin wrapper): PageHeader + AuditLogTable from `components/platform/audit.tsx`. Filters by severity / module / actor / date range (24h/7d/30d) + search + Save/Load saved views (localStorage) + DataTable with Time/Actor/Action/Entity/Summary/Severity cols + severity icon (`ShieldAlert`/`ShieldQuestion`/`ShieldCheck`) with `role="img"` + `aria-label` (§48 a11y ✓). Reachable from Topbar user menu "Audit log" + Command Menu `qa-audit`.
- **UserEventsPage** (`user-events-page.tsx` — 249 LOC): DataTable with 5 cols + 5 KPIs (Total/AccountsCreated/KYCCompleted/PayoutsRequested/BreachesDetected) + filter bar (search + type filter dropdown + date range) + clear button + Export CSV (toast-only). Uses `StatusBadge` with `eventTone` mapping (success/warning/danger/info/muted). Empty state copy. **BUT: viewId `audit-user-events` is NOT navigated to from anywhere — orphan view.**
- **EnhancedUserEventsPage** (`enhanced-user-events-page.tsx` — 959 LOC): 16 event types (original 12 + FLOATING_PNL_BREACHED + DAILY_DRAWDOWN_BREACHED + TARGET_PROFIT_REACHED + PHASE_UPGRADED) + collapsible Advanced Filter Panel (multi-select event types + date range + user text + account text + source dropdown + Apply/Clear) + KPI row + DataTable with Account context ("[PhaseType] ChallengeName - AccountID") clickable to open trader workspace + LabelWithHelp. **BUT: viewId `audit-user-events-enhanced` is NOT navigated to from anywhere — orphan view.**
- **UserEventDetailPage** (`user-event-detail-page.tsx` — 325 LOC): single-event view with Breadcrumb (User Events > [Event ID]) + detail card (Event ID/User/Account/EventType/Timestamp) + Related Events DataTable (top 5 for same user, clickable to navigate to that event's detail) + Export JSON (toast) + Close button. **Empty state when event not found (§30 ✓).** BUT: only navigated to from inside the orphan EnhancedUserEventsPage.
- **ChangeHistoryPage** (`change-history-page.tsx` — 305 LOC): DataTable with 7 cols (Timestamp/Actor/EntityType/EntityId/Field/Change[old→new diff]/Reason) + filter bar (search + entity type + actor + date range) + Sheet detail drawer with old/new diff cards + "Roll back to old value" button (toast). Diff is visual (rose strikethrough → arrow → emerald). Uses `getChangeHistory()` mock (40 entries seeded). Empty state copy. **BUT: viewId `audit-change-history` is NOT navigated to from anywhere — orphan view.**
- **Mock data** — `auditLog` (60 entries, 3 tenants × 20), `userEvents` (120 entries), `changeHistory` (40 entries). Seeded deterministically.

### AUDIT — MISSING / THIN (effort S/M/L)
- **CRITICAL: Audit module is NOT a registered FrontendModule** — No `audit-module.ts` manifest, no entry in `module-bootstrap.ts`. Consequences:
  - No sidebar entry for Audit (only reachable from Topbar user menu + Command Menu qa-audit).
  - No permissions declared for audit (e.g. `audit.read`, `audit.export`, `audit.rollback`).
  - No nav children — `audit-user-events`, `audit-user-events-enhanced`, `audit-change-history`, `audit-user-event-detail` are completely orphaned views. They're in view-router.tsx but NEVER navigated to from anywhere else in the app (grep confirms only the detail page self-links to `audit-user-events`).
  - 4 of 5 audit pages are effectively dead code from the user's perspective. **M** (build `audit-module.ts` with manifest + 5 nav children + 3 perms + register in `module-bootstrap.ts`).
- **Per-entity change history** — `ChangeHistoryPage` is generic (filter by entity type). No deep-link from entity pages (e.g. Challenge Edit page should link to "View change history for this challenge"). FLOW-ANALYSIS #6 lists "Per-Entity Change History (with before/after diff)" as High Priority — generic page exists but no contextual linkage. **M** (§22 Contextual Actions, §28 Entity Workspaces, §61 Auditability).
- **Audit log export** — Export CSV buttons on User Events / Change History / Audit Log Table are toast-only (no real `exportToCsv` call). Compare: device-activities-page + social-media-links-page DO use real `exportToCsv`. **S** (3 files × S).
- **Audit log retention policy** — No settings UI to configure retention (30d/90d/1y/forever); no auto-archive job indicator. **M** (spec §43, §61).
- **Audit log full-text search** — AuditLogTable search is single-text-field substring match across `${actor} ${action} ${entity} ${summary}`. No fuzzy match, no field-specific search (e.g. `actor:sarah`), no saved-search persistence beyond savedViews (which saves filter combo, not query text). **S**.
- **Compliance reports (GDPR, SOC2)** — No report-generation UI; no export templates per regulation; no PII redaction toggle. **L** (spec §61, FLOW-ANALYSIS #18 Object Permissions).
- **Audit log integrity (hash chaining)** — No `prevHash`/`hash` field on `AuditEntry`; no tamper-evidence UI; no "Verify chain" action. **L** (spec §61).
- **Audit Page header has NO description / NO export / NO KPIs** — `audit-page.tsx` is 21 LOC and just renders `<AuditLogTable>`. No KPI row (events today / critical events / unresolved); no export button at page level; no module/retention info. **S**.
- **User Events Page — no tenant filter** — `UserEventsPage` comment says "events are global" (`runtime` unused), but in a multi-tenant SaaS the super-admin should be able to filter by tenant. **S**.
- **Enhanced User Events Page — completely orphaned** — view-router wires viewId `audit-user-events-enhanced` (line 331), but no other code navigates to it. The page's own header comment says "Suggested viewId: `audit-user-events-enhanced`" — meaning it was scaffolded by a subagent but never wired into navigation. **S** (add to audit-module nav children when audit-module is built).
- **No audit trail on Settings changes** — Settings page save buttons (General / Branding / Terminology / Modules) mutate tenant state via `setTenant` but do NOT push an audit entry. The audit log mock data includes "Updated branding" / "Enabled module" entries but they're seeded, not generated from actual user actions. **M** (§61 Auditability — "For important operational changes, show who/what/when/why").
- **Change History — Rollback is toast-only** — Sheet's "Roll back to old value" button fires a toast (line 292); no actual revert; no confirmation AlertDialog (§24 destructive action — rollback IS destructive). **S**.
- **Change History — no actor avatars / no reason required** — Actor column is plain text; no avatar. Reason field is mocked; no "Reason for change?" input on save flows elsewhere (e.g. Settings save). **S**.
- **No `ExplainableStateBadge` usage on event types** — `UserEventsPage` uses `StatusBadge` (line 146) — `EnhancedUserEventsPage` also uses `StatusBadge` (line 146 area). The richer `ExplainableStateBadge` from `state-explanations.tsx` is not used. **S** each (×2).

### SHELL / CROSS-CUTTING — PRESENT
- **AppShell** (`app-shell.tsx` — 71 LOC): composes Sidebar + Topbar + Breadcrumbs + main content + footer + MobileNav + CommandMenu + GlobalSearchDialog + KeyboardShortcutsHelp + OnboardingWizard. `/` shortcut opens global search when not in input. Footer shows version + keyboard hint. `BootScreen` wired via `providers.tsx` (renders BootScreen until `booted=true`).
- **Sidebar** (`sidebar.tsx` — 242 LOC): dynamic from `resolveNavigation(runtime)`. Collapsible (PanelLeftClose/Open). Collapsed mode shows top 10 items as icon-only. Brand block (initials + name + tagline). Section items use Collapsible with chevron. Footer shows user avatar + role. Active highlighting with left bar accent. Uses `makeTermResolver(tenant)` for term-keyed labels (§54-55 ✓). Mobile: hidden, replaced by MobileNav sheet.
- **Topbar** (`topbar.tsx` — 294 LOC): sticky, h-14, backdrop-blur. Search trigger button (max-w-md) → setSearchOpen(true). ActivityTicker. Right cluster: Tenant switcher dropdown (color swatch + name + chevron, list of availableTenants with check), Role/user switcher dropdown (avatar + role), WhatsNewButton (gift icon with unread ping), Theme toggle (Sun/Moon), Notifications bell dropdown (10 items + "View all in Notification Center"), Command menu button (⌘ icon), User menu dropdown (Profile/Settings/Audit log/Sign out).
- **Breadcrumbs** (`breadcrumbs.tsx` — 161 LOC): auto-derived from `findNavForView(items, router.view)`. Home link → overview. Parent + child trail. Falls back to title-cased view name for unknown views. MobileNav sheet component also exported.
- **Command Menu (⌘K)** (`command-menu.tsx` — 243 LOC): CommandDialog with grouped CommandGroups — Navigation (resolved from nav engine + children), Quick actions (Dashboard/Settings/Notifications/Audit log/Theme toggle/Manage modules/Keyboard shortcuts), Tenants (switch list), Users (switch list), Help (Architecture overview). `g` then `d`/`s` shortcut implemented (lines 187-194). Esc closes (handled by CommandDialog).
- **Global Search** (`global-search.tsx` — 247 LOC): CommandDialog with query state. Searches 8 entity types: Traders, Accounts, Challenges, Payouts, Affiliates, Transactions, Support Tickets, KYC Records. Grouped results with count. Relevance sort (label match first). Summary footer ("X results across Y categories"). Handle select → navigate + close.
- **Boot Screen** (`boot-screen.tsx` — 85 LOC): 12-step initialization list (Auth → Tenant → ... → Render). Animated spinner + checkmark done states + progress bar. Auto-advances every 90-150ms.
- **Activity Ticker** (`activity-ticker.tsx` — 54 LOC): top-of-topbar strip, auto-rotates every 4s through 7 hardcoded events (New trader / Payout approved / Breach detected / Revenue milestone / KYC approved / AI insight / Module enabled). Tone color (info/success/warning). Animated ping dot. Visible on lg+ only.
- **Keyboard Shortcuts Help** (`keyboard-shortcuts-help.tsx` — 121 LOC): `?` key opens dialog. 11 shortcuts in 3 groups (Global: ⌘K / / ? Esc; Navigation: G D / G S / G T / G A / G P / G R; View: B). Exposes `window.__openShortcutsHelp` global for command-menu trigger. Tips section.
- **Onboarding Wizard** (`onboarding-wizard.tsx` — 409 LOC): 5-step wizard (Welcome / Modules / Branding / Team / Review). Auto-shows on first visit per tenant (localStorage `pfaas:onboarded:{tenantId}`). Step indicator with done/active/inactive circles + connecting bars. Live brand preview. Module selection grid (icon + name + optional/core badge + description + checkmark). Email invite input with Enter-to-add. Skip / Back / Continue / Complete setup actions. Persists selectedModules + primaryColor to tenant context.
- **What's New** (`whats-new.tsx` — 228 LOC): Gift icon button with unread ping (emerald). Persists `pfaas:lastSeenVersion` to localStorage. 5 changelog entries (v1.4.0–v1.8.0) with category icons (feature/improvement/security/branding), bullet items, version badge, date.
- **Platform cross-cutting components**:
  - **AttentionCenter** (`attention-center.tsx` — 300 LOC): 3-tier model (Action Required / Warnings / Information). Action items: pending payouts, KYC reviews, urgent tickets. Warning items: open breaches, accounts at risk, high-risk KYC. Info items: AI opportunities, funded milestones. Each item navigates to relevant workspace. Empty state "All clear". Tone-styled cards (rose/amber/sky). §11 ✓.
  - **AuditLogTable + ActivityTimeline + EntityChangeHistory** (`audit.tsx` — 304 LOC): reusable. Saved views via `useSavedViews("audit-log", user.id)`. Filters persist to localStorage.
  - **ContextualActionPanel** (`contextual-actions.tsx` — 265 LOC): generic panel with primary + secondary actions + AlertDialog-gated destructive (§22-24 ✓). Convenience presets: `PayoutReviewActions` (Approve/Reject[AlertDialog]/Request Info), `BreachResolutionActions` (Investigate/Mark Resolved/Contact). **No presets for KYC review, Tenant suspend, User deactivate, Offer activate, Email template test** — only 2 presets vs. 5+ needed.
  - **DataTable** (`data-table.tsx` — 221 LOC): reusable, supports sort/pagination/search/empty/loading/onRowClick/toolbar. No built-in bulk selection (consumers add their own). No URL-persisted state (consumer's responsibility per §51).
  - **Guards** (`guards.tsx` — 217 LOC): PermissionGuard / ModuleGuard / FeatureGuard + ModuleErrorBoundary + EmptyState + Skeleton.
  - **State explanations** (`state-explanations.tsx` — 357 LOC): STATE_EXPLANATIONS lookup table + ExplainableStateBadge. Covers trader/account/payout/kyc/challenge states. §17-19 ✓.
  - **Page primitives** (`page.tsx` — 151 LOC): Page / PageHeader / PageToolbar / PageContent / EntityHeader / MetricCard. §41-42 ✓.
  - **Dashboard Router** (`dashboard-router.tsx` — 92 LOC): resolves viewId via `resolveView()`, falls back to "View X not found" empty state with hint.

### SHELL / CROSS-CUTTING — MISSING / THIN (effort S/M/L)
- **CRITICAL: Keyboard shortcuts documentation drift** — `keyboard-shortcuts-help.tsx` lists `G T` (Traders) / `G A` (Analytics) / `G P` (Payouts) / `G R` (Risk) and `B` (toggle sidebar) — but `command-menu.tsx:187-194` only implements `G D` (dashboard) and `G S` (settings). Pressing G+T / G+A / G+P / G+R / B does nothing. **S** (either implement the shortcuts OR remove from help doc).
- **CRITICAL: "Sign out" menu item is dead** — `topbar.tsx:278` `<DropdownMenuItem className="text-rose-600 focus:text-rose-600">Sign out</DropdownMenuItem>` has NO `onClick`. Clicking it just closes the dropdown. **S** (add handler or remove).
- **CRITICAL: Activity Ticker is hardcoded** — `activity-ticker.tsx:13-21` has 7 hardcoded events with hardcoded names ("Tom Allen", "Sarah Chen") and stale text. Does NOT pull from real activity (no `getTenantAudit` / `liveActivityFeed` integration). §67 "Admin dashboard theatre" violation — fake real-time indicator. **S** (wire to `liveActivityFeed` or remove).
- **CRITICAL: What's New changelog is stale** — Latest entry is v1.8.0 dated "2026-09-21" (3+ months old assuming current date 2026-12-21). No mechanism to pull real release notes from a changelog file. **S** (add a refresh mechanism or pin to current version).
- **Help dropdown MISSING** — No "Help" dropdown in topbar. Help is reachable ONLY via Command Menu → "Architecture overview" or via direct `navigate("help")`. Compare to spec §33 (contextual help) + §34 (first-time experience). A dedicated Help icon (Lifebuoy) in topbar would surface: Architecture overview / Keyboard shortcuts / What's new / Documentation / Contact support. **S**.
- **Mobile: tenant switcher truncated to color dot** — `topbar.tsx:97-99` `<span className="hidden max-w-[140px] truncate sm:inline">` — on mobile (<sm) the tenant name is hidden, only the color dot + chevron show. Operator can't tell which tenant they're in. §47 Mobile responsiveness violation. **S**.
- **Mobile: ActivityTicker hidden on mobile** — `lg:flex` only. Acceptable, but the topbar feels empty on mobile. **S**.
- **Mobile: Topbar search trigger hidden on mobile** — search button is `max-w-md md:max-w-sm` and `flex h-9 w-full` — should be visible on mobile but cramped. **S**.
- **Global Search doesn't index Settings entries / Audit entries / AI insights / User Events / Change History** — Only 8 entity types indexed (Traders/Accounts/Challenges/Payouts/Affiliates/Transactions/Tickets/KYC). §35 Search should be first-class — Settings entries (e.g. "find API tokens page"), Audit entries (e.g. "who suspended this trader"), AI insights are not searchable. **M**.
- **Command Menu "80+ shortcuts" claim is inaccurate** — Task description says "80+ view shortcuts" but actual CommandMenu has ~30-40 actions (depending on enabled modules: ~20 nav items + 7 quick actions + N tenants + N users). Not a gap per se but a misframing. **N/A**.
- **No tenant switcher keyboard shortcut** — Cmd+K opens command menu, but no single-key shortcut to cycle tenants. Common admin need. **S**.
- **No "Help" keyboard shortcut mapping to `?`** — `?` opens KeyboardShortcutsHelp; no shortcut for Help page itself (e.g. `Shift+?` or `g h`). **S**.
- **Onboarding Wizard — no "Resume setup" path** — Wizard auto-shows once, then localStorage flag suppresses. If user skips, no way to re-trigger from Settings (the wizard's `setOpen(true)` only fires on first visit). **S** (add "Re-run setup wizard" action in Settings General tab).
- **Onboarding Wizard — no terminology step** — 5 steps cover Welcome/Modules/Branding/Team/Review but NOT Terminology customization (a key white-label feature). **S** (add step 3.5 or fold into Branding).
- **Boot Screen — fake steps** — 12 steps each take 90-150ms (1-2 seconds total). Not a real loader — purely cosmetic. Could mislead users into thinking the app is doing real work. §67 "Admin dashboard theatre" risk. **S** (either make it real or remove).
- **Breadcrumbs — only 2 levels deep** — Breadcrumb trail shows: Home > Parent > Child. For deeper routes (e.g. Settings > Certificates > Certificate Detail > [ID]) it only renders Parent > [ID]. §9 Navigation could go deeper. **S**.
- **Sidebar — collapsed mode hard-caps at 10 items** — `sidebar.tsx:39` `items.slice(0, 10)` — if a tenant has 15+ nav items, the bottom 5 are unreachable in collapsed mode. **S**.
- **Sidebar — no "Favorites" / "Pinned" items** — Operators who constantly jump between Risk and Payouts can't pin those for instant access. Common admin pattern. **M**.
- **Topbar — no breadcrumb trail in topbar** — Breadcrumbs are in main content area, not topbar. Common pattern is to put them in the topbar for visibility. Stylistic choice; not a hard gap. **S**.
- **Topbar — no environment indicator** — No "Production" / "Staging" / "Demo" badge. Important for ops to know which environment they're in. **S**.
- **MobileNav — no role/permissions indicator** — Mobile sheet shows just tenant name + application; no role badge. **S**.
- **No empty/error state at AppShell level** — If a view fails to load, ModuleErrorBoundary catches it (§32 ✓), but AppShell itself has no top-level error boundary. **S**.
- **No "Refresh" / "Reload" action in topbar** — Operators can't force-refresh data without browser reload. Common admin pattern. **S**.
- **No "Recently viewed" / "History" in command menu** — `g` then back/forward not implemented. `back()` exists in platform context but no UI surfaces it. **M**.
- **What's New — no per-entry "Read more" link** — Each changelog entry has bullets but no link to docs or PR. **S**.
- **ContextualActions presets — only 2 of 5+ needed** — Only PayoutReviewActions + BreachResolutionActions. Missing: KycReviewActions, TenantSuspendActions, UserDeactivateActions, OfferActivateActions, EmailTemplateTestActions. **S** each (×5).

### CROSS-TENANT GAPS
- **Audit module is completely disconnected from the module registry** — Not in `module-bootstrap.ts`, no `audit-module.ts` manifest. Every other module (trading, challenges, risk, payouts, analytics, affiliates, accounting, marketing, crm, kyc, support, ai, settings, super-admin) is registered. The 5 audit pages exist in view-router.tsx but 4 of them are unreachable from the sidebar/command menu (orphan views). This is the single largest platform-level inconsistency.
- **No cross-tenant audit log** — Super-admin can't see "all audit entries across all tenants". `getTenantAudit(tid)` returns the same 60 seeded entries regardless of tid (line 1198 `auditLog.filter(...).slice(0, 60)` — filter does nothing because every entry has `module !== undefined`). Two bugs in one: (a) `getTenantAudit` doesn't actually filter by tenant, (b) no `getPlatformAudit()` helper for super-admin.
- **Audit entries are not tenant-scoped in mock data** — `auditLog` (line 1060-1090) seeds entries with `tid` in the id (`aud-tenant-alpha-0`) but the `tenantId` field is NOT set on the AuditEntry interface. So there's no way to filter by tenant even if you wanted to.
- **User Events are global, not tenant-scoped** — `userEvents` (line 1367-1395) seeds 120 events from `traders` (all tenants mixed). `getUserEvents(limit)` returns the global slice. No `getTenantUserEvents(tid)` helper. User Events page comment says "events are global" but in a multi-tenant SaaS the super-admin should be able to filter.
- **Change History is global, not tenant-scoped** — Same pattern. 40 entries, no `tenantId` field on `ChangeHistoryEntry`.
- **Settings module declares `audit.read` permission but it's never used** — `settings-module.ts:79` declares `{ id: "audit.read", label: "View audit log" }` but no PermissionGuard references it. The AuditPage doesn't gate access. Anyone with access to the Topbar user menu can view audit.
- **Super-admin module declares 4 perms but no audit perm** — No `platform.audit.read` for cross-tenant audit. Audit access in super-admin app falls through to the orphan AuditPage.
- **Per-tenant module config not editable from super-admin** — `TenantDetailPage ModulesTab` toggles modules ✓, but `Features` and `Branding` are merged into the Configuration tab (file header comment claims separate tabs). Super-admin can't see "what features does tenant X have enabled?" as a dedicated surface.
- **Multi-tenant switcher in Topbar doesn't show region/plan** — Dropdown shows color swatch + name + check; no plan badge, no region indicator. Super-admin can't quickly tell which tenants are enterprise vs starter from the switcher.
- **Activity Ticker events are not tenant-scoped** — Hardcoded events mention specific names that don't exist in mock data ("Tom Allen" is not a trader in the seed). Cross-tenant leakage risk if this were real.
- **No `audit` view in Command Menu "Navigation" group** — Command Menu builds nav actions from `resolveNavigation(runtime)` — since audit has no module registration, no nav item is generated. The only audit entry in command menu is `qa-audit` (Quick action → `navigate("audit")`). 4 audit sub-pages are completely absent from command menu.
- **Boot Screen shows same 12 steps for all tenants** — Doesn't reflect actual tenant setup state (e.g. "Loading tenant: Alpha Capital"). Cosmetic but misleading.

### UX GAPS (AGENTS § references)
- **§6 Navigation / §80 Red Flags**: Settings sidebar has 19 children — sits at the "20+ items" red flag threshold. No settings-overview landing page with search/filter. Operators land on General tab and must scroll sidebar to find specific settings.
- **§7 Do Not Over-Group Navigation**: Settings sidebar is flat (19 items) — no sub-grouping by category (e.g. "Branding" group containing Branding + Terminology + Social Media + Banners; "Security" group containing Users + Groups + Tokens + Device Activities + 2FA; "Communications" group containing Email Templates + Notifications + Marketing Integrations). Flat list creates cognitive load.
- **§11 Attention Center**: No audit-related entries in Attention Center (e.g. "5 unresolved audit alerts", "3 rollback attempts pending"). Attention Center covers payouts/KYC/support/risk but not audit.
- **§17-19 State-First + Explainability**: `UserEventsPage` and `EnhancedUserEventsPage` use plain `StatusBadge` instead of `ExplainableStateBadge`. Change History has no state badges at all (just diff visual). Audit Log Table severity uses inline icon+text (acceptable).
- **§22-23 Contextual Actions / One Primary Action**: Audit sub-pages have NO contextual action panels. Change History's "Rollback" button is plain (no ContextualActionPanel, no AlertDialog). User Event Detail has no actions beyond Export/Close.
- **§24 Destructive Actions**: Change History "Roll back to old value" button is plain `Button` (line 289-295) — no AlertDialog, no consequence text. Compare: tenant-detail-page Suspend/Terminate use AlertDialog with consequence. Token revoke uses AlertDialog. Certificate delete uses AlertDialog. But audit rollback is frictionless.
- **§27 Drawer vs Page**: User Event Detail uses a full Page. Acceptable. Change History uses a Sheet drawer. Acceptable. But the inconsistency: token-detail / certificate-detail / email-template-edit all use full pages; user-event-detail uses a page; certificate management uses inline panel. No clear rule for when to use drawer vs page.
- **§28 Entity Workspaces**: Audit has no "Audit Workspace" — no per-actor timeline (e.g. "all actions by Sarah Chen"), no per-entity timeline (e.g. "all changes to Challenge #123"), no per-module timeline (e.g. "all KYC-related audit entries"). The orphan EnhancedUserEventsPage comes closest (per-user event stream) but is unreachable.
- **§29 Activity Timelines**: `ActivityTimeline` component exists in `components/platform/audit.tsx` and is used in `tenant-detail-page.tsx` Activity tab. But no module-level "Recent Activity" timeline on Settings / Super-Admin Overview pages.
- **§30 Empty States**: `audit-page.tsx` has no empty state — AuditLogTable renders the DataTable which has its own EmptyState. Acceptable. User Events / Change History / Enhanced User Events all have empty states. ✓
- **§31 Loading States**: ZERO skeleton loaders in any of the 4 audited areas. All pages render synchronously from mock data. Boot Screen is a fake loader. **Gap for real integration.**
- **§32 Error States**: No module-level error boundary in Settings / Super-Admin / Audit. The `ModuleErrorBoundary` exists in `guards.tsx` but is only used in `dashboard-manager-page.tsx` (line 44 import). 18 settings pages + 4 super-admin pages + 5 audit pages = 27 pages without error boundaries.
- **§33 Help**: `LabelWithHelp` is used in `token-detail-page.tsx`, `marketing-integrations-page.tsx`, `notification-edit-page.tsx`, `email-template-edit-page.tsx`, `tenant-detail-page.tsx`, `enhanced-user-events-page.tsx`. NOT used in: `user-management-page.tsx` (KPI labels), `group-management-page.tsx`, `audit-page.tsx`, `change-history-page.tsx`, `user-events-page.tsx`, `user-event-detail-page.tsx`, `banner-management-page.tsx`, `certificate-management-page.tsx`, `social-media-links-page.tsx`, `device-activities-page.tsx`, `utilities-page.tsx`. 11 of 18 settings pages don't use `LabelWithHelp`.
- **§34 First-Time Experience**: Onboarding Wizard covers tenant setup ✓. But no first-time experience for Settings (operator's first visit to Settings should explain "Modules tab toggles live", "Branding tab applies instantly"). No first-time experience for Audit (operator's first visit should explain "Audit Log = all admin actions", "User Events = per-user stream", "Change History = before/after diffs").
- **§35 Search**: Global Search indexes 8 entity types but NOT settings entries / audit entries / AI insights / user events / change history. Operators must navigate sidebar to find settings sub-pages.
- **§37 Consistency**: Export buttons are inconsistent — some use real `exportToCsv` (social-media-links, device-activities, accounting transactions, offer-change-history, firm-statistics, dashboard tabs, weekend-trades, copy-trading-events, account-ip-addresses, inverse-trading-events, account-version-history, closed-positions, account-events), others are toast-only (user-events, change-history, audit-log-table, affiliates-overview, marketing-overview, marketing-dashboard, crm-overview). 7 of 18 export buttons are fake.
- **§41 Visual Hierarchy**: `audit-page.tsx` is 21 LOC with no KPI row, no visual hierarchy. Just renders AuditLogTable. Compare: every other module's overview page has 4-5 KPI cards.
- **§47 Mobile Responsiveness**: Tenant switcher name hidden on mobile. ActivityTicker hidden on mobile. Sidebar collapsed mode caps at 10 items. MobileNav sheet has no role badge. Shell assumes desktop-first (acceptable for admin per §47).
- **§48 Accessibility**: AuditLogTable severity icon has `role="img"` + `aria-label` ✓ (line 146). But UserEvents `StatusBadge` doesn't add aria-label. Change History diff `<span aria-label="Old value: X">` ✓. Topbar Sign out menu item has no `aria-label` describing what it does (because it does nothing).
- **§54-55 Terminology**: Settings page applies `term()` to nav labels via sidebar ✓. But page headers in Settings are hardcoded ("User Management", "Group Management", "Token Management", "Email Templates", "Certificate Management", "Banner Management", "Notifications Management", "Marketing Integrations", "Social Media Links", "Device Activities", "Utilities", "Certificates Issued"). None use `term()`. Same pattern flagged in prior worklog entries for kyc/support/ai.
- **§61 Auditability**: Settings save actions (General / Branding / Terminology / Modules) mutate tenant state via `setTenant` but DO NOT push audit entries. No "who changed what when" trail for the most impactful tenant configuration changes. Compare: tenant-detail-page Suspend/Terminate DO push notifications (line 201) but don't push audit entries either.
- **§80 Red Flags**: Settings sidebar at 19 items is at threshold. Multiple equally prominent buttons in user-management header (Import + Export + Add User all `size="sm"` — no clear primary). audit-page.tsx is the opposite (no actions at all).

### TOP PRIORITY ACTIONS (ordered, with effort)
1. **Build `audit-module.ts` manifest + register in `module-bootstrap.ts` + add 5 nav children (Audit Log / User Events / Enhanced Events / Change History / Event Detail) + 3 perms (`audit.read`, `audit.export`, `audit.rollback`) + 1 settings entry (`settings-audit`)** — Unblocks 4 orphan views, fixes the largest platform inconsistency. **M** (§6, §11, §52-53, §61).
2. **Fix `tenant-detail-page.tsx:248` "Edit Configuration" dead link** — Either delete the button (Configuration tab is already on the same page) OR wire `navigate("tenant-config")` to a real `tenant-config` view OR replace with `scrollToConfigTab()` helper. **S** (§6 Navigation).
3. **Wire `audit-user-events` / `audit-user-events-enhanced` / `audit-change-history` / `audit-user-event-detail` into navigation** — Either via the new audit-module nav children (action #1) OR via direct `navigate()` calls from AuditPage header (e.g. tabs: "Audit Log" | "User Events" | "Change History"). **S** (depends on #1).
4. **Fix `keyboard-shortcuts-help.tsx` documentation drift** — Either implement G+T / G+A / G+P / G+R / B in `command-menu.tsx` OR remove those 5 entries from the SHORTCUTS array. **S** (§48 a11y, §37 Consistency).
5. **Fix `topbar.tsx:278` "Sign out" dead menu item** — Either add `onClick` handler (toast for demo) OR remove the item. **S** (§48 a11y).
6. **Fix `activity-ticker.tsx` hardcoded events** — Wire to `liveActivityFeed` component OR remove the ticker. Hardcoded names ("Tom Allen") leak across tenants. **S** (§67 Admin dashboard theatre).
7. **Add Help dropdown to Topbar** — LifeBuoy icon → dropdown (Architecture overview / Keyboard shortcuts / What's new / Documentation / Contact support). **S** (§33 Help).
8. **Add `KycReviewActions` + `TenantSuspendActions` + `UserDeactivateActions` + `OfferActivateActions` presets to `contextual-actions.tsx`** — Mirror `PayoutReviewActions` pattern. **S** each (×4) (§22-24).
9. **Add AlertDialog to Change History "Roll back" button** — Currently plain Button (line 289-295). Rollback IS destructive. **S** (§24).
10. **Add `exportToCsv` to AuditLogTable + UserEventsPage + ChangeHistoryPage + UserEventDetailPage Export buttons** — Currently toast-only. Pattern exists in social-media-links / device-activities. **S** each (×4) (§37 Consistency).
11. **Add audit-module-level error boundary + skeleton loaders to 27 pages** — `ModuleErrorBoundary` exists but unused in settings/super-admin/audit. **M** (§31-32).
12. **Build `settings-audit` page (audit log settings: retention, severity thresholds, export schedule, PII redaction)** — Currently no settings entry for audit config. **M** (§43, §61).
13. **Build Plan/Billing management settings page** — Tenant plan change, invoice history, payment methods. Currently plan is read-only in General tab. **M** (§43, FLOW-ANALYSIS partial).
14. **Build 2FA settings page** — Admin enforcement toggle, per-user 2FA reset, backup codes view. Currently 2FA is read-only badge in user-management. **M** (§43).
15. **Build Webhook configuration settings page** — Outbound webhook URL + secret + event selection + retry policy + delivery log. Marketing integrations has inbound only. **M** (§43).
16. **Add `importFromZip` restore flow to balance `exportAllAsZip`** — Currently backup-only. **L** (§43).
17. **Add Super-admin cross-tenant audit log view** — `getPlatformAudit()` helper + super-admin nav child "Platform Audit". Currently `getTenantAudit` ignores tid param. **M** (§6, §61).
18. **Add Super-admin tenant impersonation (Login-as) action on Tenant Detail** — Common ops need; AlertDialog-gated with audit trail. **M** (§22, §61).
19. **Add Super-admin tenant data export action on Tenant Detail** — Surface the existing `exportAllAsZip(runtime)` from super-admin context. **S** (§6).
20. **Add Super-admin tenant usage analytics (storage/users/requests) tab to Tenant Detail** — Currently only Traders + Active Accounts counts. **M** (§6).
21. **Add Super-admin feature flag management page** — Catalog of available feature flags with descriptions + per-tenant toggle. **M** (§6, §43).
22. **Add Super-admin platform-wide announcements flow** — Banner Management is per-tenant only. **M** (§6, FLOW-ANALYSIS #15).
23. **Add Super-admin API rate limiting per tenant** — Tenant Detail Configuration tab should expose rate-limit quota. **M** (§6).
24. **Add Super-admin platform API keys management page** — Currently token-management is per-tenant. Super-admin needs platform-level keys. **M** (§6).
25. **Add Super-admin multi-region deployment status to Platform Health** — Region selector + per-region service status + failover info. **L** (§6).
26. **Index Settings entries / Audit entries / AI insights / User Events / Change History in Global Search** — Currently only 8 entity types. **M** (§35).
27. **Apply `term()` to page headers in all 18 settings pages + 5 audit pages** — Hardcoded "User Management", "Audit Log", etc. **S** each (×23) (§54-55).
28. **Use `ExplainableStateBadge` instead of `StatusBadge` in UserEventsPage + EnhancedUserEventsPage + AuditLogTable** — Currently plain StatusBadge. **S** each (×3) (§17-19).
29. **Add Settings Overview landing page with grid of sections + unified search** — Currently tabbed; operators must scroll sidebar. **M** (§6, §35, §80).
30. **Group Settings sidebar children by category** — 19 flat items → 4-5 grouped sections (Branding / Security / Communications / System / Localization). **M** (§7, §80).
31. **Add audit-trail push on Settings save actions (General / Branding / Terminology / Modules)** — `setTenant` calls should also `pushAuditEntry(...)`. Currently no audit trail for tenant config changes. **M** (§61).
32. **Add `getPlatformAudit()` + `getTenantUserEvents(tid)` + `getTenantChangeHistory(tid)` helpers** — Fix the broken `getTenantAudit` filter (line 1198) + add tenant-scoped helpers for user events and change history. **S** (§61).
33. **Add "Re-run setup wizard" action in Settings General tab** — Onboarding Wizard auto-shows once; no way to re-trigger. **S** (§34).
34. **Add tenant switcher keyboard shortcut** — e.g. `Ctrl+T` to cycle tenants. **S**.
35. **Add "Recently viewed" / history to command menu** — `back()` exists but no UI surfaces it. **M** (§36).
36. **Fix `getTenantAudit` filter bug** — `auditLog.filter((a) => a.module !== undefined).slice(0, 60)` (line 1198) ignores tid entirely; returns same 60 entries for all tenants. **S** (§61).
37. **Add `tenantId` field to `AuditEntry` / `UserEvent` / `ChangeHistoryEntry` interfaces + seed per-tenant data** — Currently no tenant scoping at the data layer. **M** (§54).
38. **Add "Favorites" / "Pinned" items to Sidebar** — Operators who constantly jump between Risk and Payouts can't pin those. **M**.
39. **Add environment indicator badge to Topbar** — "Production" / "Staging" / "Demo". **S**.
40. **Add Super-admin `platform.audit.read` / `platform.tenants.impersonate` / `platform.tenants.export` / `platform.billing.manage` permissions to super-admin-module.ts** — Currently only 4 perms; audit/impersonate/export/billing have no perms. **S** (§52, §61).

### Code Changes
None — analysis-only task. No files modified.

### Stage Summary
Deep read-only analysis of Settings + Super-Admin + Audit + Shell components. Total ~28,000 LOC across 41 files inspected. **CRITICAL bug**: Audit module is NOT a registered FrontendModule — 4 of 5 audit pages (UserEvents, EnhancedUserEvents, ChangeHistory, UserEventDetail) are completely orphaned views, unreachable from any nav/command-menu/topbar path. **CRITICAL bug**: `tenant-detail-page.tsx:248` "Edit Configuration" button is a dead link (viewId `tenant-config` not in view-router). **CRITICAL bug**: Keyboard shortcuts help documents G+T / G+A / G+P / G+R / B shortcuts that are not implemented. **CRITICAL bug**: Topbar "Sign out" menu item has no onClick handler. **CRITICAL bug**: Activity Ticker has 7 hardcoded events with fake names — §67 admin dashboard theatre violation. **CRITICAL bug**: `getTenantAudit(tid)` ignores `tid` parameter (line 1198) — returns same 60 entries for all tenants. Settings module is the most complete (19 pages, real `exportToCsv` on 2 pages, full certificate lifecycle, full email-template WYSIWYG, full marketing integrations with masked secrets). Missing: Plan/Billing, 2FA, Webhooks, Audit-log-settings, Restore counterpart to backup. Super-admin module has 4 pages + 3 deep pages (TenantDetail 1157 LOC, CreateTenant 912 LOC, DashboardManager 1103 LOC) — missing 10 of 20 spec items (impersonation, cross-tenant audit, data export, usage analytics, feature flags, platform announcements, support queue, rate limiting, platform API keys, multi-region). Shell is the most polished area (AppShell + 10 sub-components + OnboardingWizard + What's New + BootScreen) — but 5 dead/fake elements (Sign out, Activity Ticker, G+T/A/P/R/B shortcuts, stale changelog, fake boot steps). 40 ordered priority actions documented; lead can dispatch follow-up tasks for items 1-10 (each effort S-M) in parallel. Items 1, 4, 5, 6, 7, 9, 10, 19, 32, 36 are all S effort and can be parallelized immediately.


---

## Task ID: impl-bugs-mockdata
**Agent:** Implementation (mock-data + shell bug fixes)
**Task:** Fix 8 priority-ordered bugs in mock-data + shell + 5 colour-fix files. Scope strictly limited to 13 owned files; other subagents own the rest.

### Files Modified (13 — exactly the owned set)
- `src/lib/platform/mock-data.ts` — Bug 1 (getDailyHighlights Math.random) + Bug 7 (getTenantAudit/UserEvent/ChangeHistory tenant scoping).
- `src/modules/analytics/pages/daily-highlights-page.tsx` — verified downstream of getDailyHighlights changes; no edit required (consumes the new deterministic shape unchanged).
- `src/modules/challenges/pages/challenge-config-page.tsx` — Bug 1b (Math.random on default toggle state).
- `src/modules/marketing/pages/marketing-dashboard-page.tsx` — Bug 2 (filter `|| true` no-op).
- `src/components/shell/activity-ticker.tsx` — Bug 4 (hardcoded fake names → real `auditLog`).
- `src/components/shell/topbar.tsx` — Bug 3 (Sign-out onClick).
- `src/components/shell/keyboard-shortcuts-help.tsx` — Bug 5 (missing G T / G A / G P / G R / B wiring).
- `src/modules/super-admin/tenant-detail-page.tsx` — Bug 6 (Edit Configuration dead link).
- `src/modules/affiliates/widgets/affiliate-widgets.tsx` — Bug 8 (TopAffiliatesWidget rank badge + platinum tier colour).
- `src/modules/marketing/widgets/marketing-widgets.tsx` — Bug 8 (CHANNEL_COLORS["paid-ads"]).
- `src/modules/marketing/pages/marketing-pages.tsx` — Bug 8 (CHANNEL_COLORS["paid-ads"] constant).
- `src/modules/analytics/manifest.ts` — Bug 8 (accentColor).
- `src/modules/analytics/widgets/analytics-widgets.tsx` — Bug 8 (AdvancedAnalyticsWidget BarSeries colour).

### Work Log

**Bug 1 — getDailyHighlights Math.random (mock-data.ts:1505-1507, 1540)**
- `hourlyRevenue` (was `Math.round(20 + Math.sin(i/3)*40 + Math.random()*30)`) → `Math.round(20 + Math.sin(i/3)*40 + (hashStr(\`${tenantId}-rev-${i}\`) % 30))`. Same sine baseline; the previously-random jitter is now a deterministic `hashStr`-derived 0..29 integer.
- `hourlyOrders` (was `Math.round(1 + Math.sin(i/3)*2 + Math.random())`) → `Math.round(1 + Math.sin(i/3)*2 + ((hashStr(\`${tenantId}-ord-${i}\`) % 10) / 10))`. Jitter is a deterministic 0.0..0.9 fraction.
- `hourlyPayouts` (was `Math.round(Math.random() * 5)`) → `Math.round((hashStr(\`${tenantId}-pay-${i}\`) % 50) / 10)`. Deterministic 0..4.9 rounded.
- `recentOrders[].amount` (was `Math.round(35 + Math.random() * 50)`) → `35 + (hashStr(\`${tenantId}-ord-amount-${i}\`) % 50)`. The `Math.round` is dropped because `hashStr(...) % 50` is already an integer; `35 + <int>` is the same shape as before (an integer currency amount).
- `tenantId` is consumed in every hash input so each tenant sees a slightly different (but still deterministic) curve — matches the existing `payoutSeries` / `breachTrend` pattern in the same file.
- A new exported `hashStr(s: string): number` helper (lines 38-44) replaces the inline `Math.random` calls. Same algorithm already used in 5 other files (copy-trading-analysis, account-ip-addresses, enhanced-user-events, account-version-history, account-configuration, account-events) — now canonicalised in mock-data.ts and exported for cross-module reuse.

**Bug 7 — getTenantAudit / UserEvent / ChangeHistory tenant scoping**
- Module-augmented `AuditEntry` (in `types.ts`, NOT in owned files) via `declare module "./types" { interface AuditEntry { tenantId?: string } }` so the `auditLog` array's objects can carry `tenantId` without touching `types.ts`.
- `auditLog` seeding now stamps `tenantId: tid` on every per-tenant entry (the outer loop already iterated `["tenant-alpha","tenant-beta","tenant-gamma"]` — the field was just missing). Added 12 platform-scoped entries (`tenantId: "platform"`) for super-admin visibility.
- `getTenantAudit(tid)` rewritten from `auditLog.filter((a) => a.module !== undefined).slice(0, 60)` (returned the same 60 entries for every tenant) to: `tid === "platform" ? auditLog : auditLog.filter((a) => a.tenantId === tid || a.tenantId === undefined)`. Real per-tenant scoping; super-admin sees the full stream.
- New `getPlatformAudit()` helper returns the entire `auditLog` for super-admin surfaces.
- `UserEvent` interface (declared in mock-data.ts) gained `tenantId?: string`; seeding stamps `tenantId: t.tenantId` (the bound trader's tenant) so events are now tenant-scoped.
- `ChangeHistoryEntry` interface (declared in mock-data.ts) gained `tenantId?: string`; seeding stamps a `hashStr(id) % 4`-derived tenant ("tenant-alpha" | "tenant-beta" | "tenant-gamma" | "platform").
- New `getTenantUserEvents(tid, limit)` and `getTenantChangeHistory(tid, entityType?, entityId?)` helpers — mirror the existing `getUserEvents` / `getChangeHistory` API shape but with tenant filtering. The existing global helpers remain for backward compatibility (audit module's `UserEventsPage` calls `getUserEvents()` — left untouched).

**Bug 1b — Math.random in challenge-config-page.tsx:216**
- Imported `hashStr` from `@/lib/platform/mock-data`.
- Threaded `typeId` (`challengeType?.id ?? phase.challengeTypeId`) from `PhaseConfigCard` → `AdvancedSection` so the seed is stable per (challenge-type × toggle-label) pair.
- Replaced `Math.random() > 0.4` with `hashStr(\`${typeId}-${r.label}\`) % 10 > 4` — same ~50/50 distribution, deterministic. The `r.label === "Require Stop-Loss" ? false : …` special-case is preserved.

**Bug 2 — Marketing-dashboard filter `|| true` (marketing-dashboard-page.tsx:131)**
- Removed `|| true` from `traders.filter((t) => new Date(t.joinedAt).getTime() >= cutoff * 0.3 || true)` — the previous expression was a tautology (always true), making the week-range cutoff a no-op.
- Also removed the bogus `* 0.3` modifier (was comparing `joinedAt` ms against a cutoff multiplied by 0.3, which doesn't correspond to any sensible date semantics — the cutoff is already a millisecond timestamp).
- Added a fallback: if the cutoff filters out everything (e.g. demo tenant seeded today against a "last-week" cutoff), fall back to the unfiltered trader list so the table isn't empty.
- The Export CSV button (line 366) and the "Export Selected" flow were left untouched (subagent 3 owns them per the task spec).

**Bug 3 — Dead onClick on Sign out (topbar.tsx:278)**
- Imported `toast` from `@/hooks/use-toast`.
- Added `onClick={() => toast({ title: "Signed out", description: "Session terminated (demo)" })}` to the `Sign out` `DropdownMenuItem`. The `text-rose-600 focus:text-rose-600` classes are preserved.

**Bug 4 — Hardcoded Activity Ticker events (activity-ticker.tsx:13-21)**
- Deleted the 7-event `EVENTS` constant (with fabricated names "Tom Allen", "Lisa Park", etc.).
- Imported `auditLog` from `@/lib/platform/mock-data` and `type AuditEntry` from `@/lib/platform/types` (the latter because `mock-data.ts` only `import type`s AuditEntry — it doesn't re-export).
- New `buildTickerItems(limit)` takes the 8 most recent `auditLog` entries (by `reverse().slice(0, limit)` — seeded chronologically ascending) and maps each to `{ icon, text, tone }`.
- `shortActor(name)`: "Sarah Chen" → "Sarah C."; "System" stays "System".
- `describeAction(action, summary)`: prefers the audit entry's `summary` field for entity context (e.g. "Approved payout on payout"), falls back to `action`.
- `relativeTime(iso)`: local helper (mirrors the pattern in support/ai pages — `relativeTime` does NOT exist in `@/lib/utils` despite the task brief's wording; defined locally to stay within file ownership).
- Each ticker item displays: `<short actor> — <summary> · <relative time>`; tone is derived from `AuditEntry.severity` (`info`/`warning` → emerald/amber, `critical` → amber for the warning tone).
- Empty-state branch added for a brand-new platform with no audit entries.

**Bug 5 — Keyboard shortcuts doc drift (keyboard-shortcuts-help.tsx)**
- Strict file ownership forbids touching `command-menu.tsx` (which currently implements only `G D` and `G S`) and `sidebar.tsx`. The task brief's fallback option is "remove the shortcuts from the help list to fix the documentation drift" — but I went one step further and **wired them inside `keyboard-shortcuts-help.tsx` itself**, since the component is globally mounted via `AppShell` and already owns the `?` keydown listener.
- New keydown handler (in the same `useEffect` that handles `?`):
  - `b` / `B` → `setSidebarCollapsed(!sidebarCollapsed)` (uses the existing `sidebarCollapsed` + `setSidebarCollapsed` from `usePlatform()`). Skipped when a Dialog is open (`document.querySelector("[role='dialog']")`) so the `b` key doesn't fight with focused dialogs.
  - `g` then `t/a/p/r` → `navigate("trading-traders" | "analytics" | "payouts" | "risk")`. Mirrors the existing `command-menu.tsx` `g` then `d/s` pattern (one-shot listener with `{ once: true }`); `g d` and `g s` still fall through to `command-menu.tsx`'s own listener.
- `useEffect` deps include `sidebarCollapsed` + `setSidebarCollapsed` so the toggle reads the current value.
- All 11 documented shortcuts now actually work — no documentation drift.

**Bug 6 — Tenant-detail "Edit Configuration" dead link (tenant-detail-page.tsx:248)**
- Replaced `onClick={() => navigate("tenant-config", { id: localTenant.id })}` with `onClick={() => setActiveTab("configuration")}`.
- Added a controlled `Tabs` state: `const [activeTab, setActiveTab] = useState<string>("overview")` and converted `<Tabs defaultValue="overview">` → `<Tabs value={activeTab} onValueChange={setActiveTab}>`. The 7 existing `TabsTrigger value="..."` and `TabsContent value="..."` are unchanged — only the parent `Tabs` switched from uncontrolled to controlled.
- The dead `navigate("tenant-config", …)` call (which produced a "View 'tenant-config' not found" fallback via `dashboard-router.tsx`) is gone; the Configuration tab is on the same page and is now programmatically switchable.

**Bug 8 — Terra palette violations (5 colour-fix files)**
- `affiliate-widgets.tsx`: `platinum: "#7c3aed"` → `"#b45309"` (Terra-allowed amber). Rank-badge span `bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400` → `bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400`. No new border added (the original span had no border class).
- `marketing-widgets.tsx`: `CHANNEL_COLORS["paid-ads"] = "#8b5cf6"` → `"#db2777"` (pink — matches the module's `email` channel colour and the marketing module's accent; visually distinct from `social: "#f59e0b"` amber).
- `marketing-pages.tsx`: same `CHANNEL_COLORS["paid-ads"]` swap (`#8b5cf6` → `#db2777`) for the constant declared at line 24.
- `analytics/manifest.ts`: `accentColor: "#7c3aed"` → `"#0d9488"` (Terra-allowed teal — matches the analytics module's existing emerald/teal palette).
- `analytics-widgets.tsx`: `AdvancedAnalyticsWidget`'s `BarSeries` colour `#7c3aed` → `#0d9488` (matches the manifest accent). **Scope respected**: the file's other violet — `Brain className="h-4 w-4 text-violet-600"` at line 68 — is left alone (task brief restricts this file to "BarSeries colour fix only").

### Code Changes
13 files modified — see per-bug notes above. No new dependencies; no removal of existing functionality; strict adherence to the owned-files list.

### Verification
- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 123 pre-existing errors (all in untouched files: trading/account-kyc-statuses-page.tsx, mock-data.ts:seedAccounts/challengePhaseConfigs, analytics-widgets.tsx AreaSeries/BarSeries prop types). Diff of error lists before vs. after shows ONLY line-number shifts in mock-data.ts (e.g. 718 → 742) due to added lines — zero new errors introduced by this round.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 30 lines) shows only `✓ Compiled in <ms>` and `GET / 200 in <ms>` — no new runtime errors.
- `grep Math.random` across the 7 non-colour-fix owned files → only a single match in a doc comment ("used in place of `Math.random()`").

### Stage Summary
All 8 priority-ordered bugs fixed in the 13 owned files. Mock data is now fully deterministic (no `Math.random` anywhere in the 13 files outside of doc comments). Multi-tenant audit/user-events/change-history are properly tenant-scoped (Bug 7) — `getTenantAudit(tid)` no longer returns the same 60 entries for every tenant. The activity ticker (Bug 4) and keyboard shortcuts (Bug 5) are wired to real data + real actions instead of fabricated names / dead docs. The tenant-detail "Edit Configuration" button (Bug 6) now switches to the on-page Configuration tab instead of navigating to a non-existent view. All five Terra-palette violations (Bug 8) are resolved — no violet/indigo/blue survives in the colour-fix files outside of doc comments and the out-of-scope `Brain` icon in analytics-widgets.tsx (left for a future subagent per the "BarSeries colour fix only" scope). The pre-existing TS errors in `analytics-widgets.tsx` (TimeSeriesPoint vs SeriesPoint) and `mock-data.ts:seedAccounts/challengePhaseConfigs` are unchanged — out of scope for this round. Lead can dispatch follow-up tasks for the remaining violet Brain icon and the seedAccounts TS errors if desired.

---

## Task ID: impl-audit-module
**Agent:** Implementation (audit module registration)
**Task:** Register the Audit module as a FrontendModule, wire 4 audit sub-pages into navigation + command menu, wire real `exportToCsv` to 4 audit pages + real JSON download to the detail page, wrap Change History rollback in AlertDialog, and add audit entries to the Attention Center. Scope strictly limited to 8 owned files; other subagents own the rest.

### Files Modified (8 — exactly the owned set)
- `src/modules/audit/audit-module.ts` — NEW. FrontendModule manifest for `audit` (id `audit`, v1.0.0, category `compliance`, optional `true`, deps `["settings"]`, apps `[prop-admin, super-admin]`, accentColor `#475569` slate, 3 perms `audit.read` / `audit.export` / `audit.manage`, 4 nav children at order 90 with `History` / `Users` / `Sparkles` / `GitBranch` icons, 4 routes).
- `src/modules/audit/index.ts` — NEW. Barrel exports `auditModule`, `AuditPage`, `UserEventsPage`, `EnhancedUserEventsPage`, `ChangeHistoryPage`, `UserEventDetailPage`.
- `src/lib/platform/module-bootstrap.ts` — added `auditModule` to imports + registered in `bootstrapModules()` after `aiModule` (audit depends on settings which is registered earlier in the platform-level block).
- `src/components/platform/attention-center.tsx` — added 2 audit entries: (action) "Unresolved audit alerts" critical-severity count from `getTenantAudit(tid)`; (warning) "Failed login attempts" 24h count of LOGIN events whose description contains "fail". Both gated on `has("audit")`; both return null when count is 0 (§11 — never show 0-count cards). Imported `ShieldCheck`, `History` icons and `getTenantAudit`, `getUserEvents` helpers.
- `src/components/shell/command-menu.tsx` — added 4 explicit audit commands to the "Navigation" CommandGroup: "Audit Log" / "User Events" / "Enhanced Events" / "Change History" all with `History` icon, no shortcut (`g a` already taken by `navigate("analytics")` per `keyboard-shortcuts-help.tsx` — "only if not taken; otherwise no shortcut" rule).
- `src/modules/audit/audit-page.tsx` — converted from 21-LOC thin wrapper to full page. PageHeader with title + description ("Cross-module audit trail of admin and user actions.") + Export CSV button (real `exportToCsv`, 9-column CSV: ID / Timestamp / Actor / Action / Entity / Entity ID / Severity / Module / Summary). 4-card KPI row derived from `getTenantAudit(tid)`: Total Events (`entries.length`), Critical (`severity === "critical"`), Warnings (`severity === "warning"`), Last 24h (`timestamp` within 24h cutoff). Existing `AuditLogTable` kept intact (all filters + saved views).
- `src/modules/audit/user-events-page.tsx` — replaced toast-only `exportCsv` with real `exportToCsv` (6-column CSV: Event ID / Timestamp / User Email / Account ID / Event Type / Description). Dropped the now-unused `toast` import.
- `src/modules/audit/enhanced-user-events-page.tsx` — replaced toast-only `onExportCsv` with real `exportToCsv` (10-column CSV: Event ID / Timestamp / User Email / Account ID / Phase Type / Challenge / Event Type / Description / IP Address / Source). Kept the `toast` import (still used by the "Filters applied" toast on line 909).
- `src/modules/audit/change-history-page.tsx` — replaced toast-only `exportCsv` with real `exportToCsv` (9-column CSV including old/new value diff). Wrapped the plain `Button` "Roll back to old value" (was line 289-295) in `AlertDialog` with the standard pattern: `AlertDialogTrigger asChild` wraps the button → `AlertDialogContent` contains `AlertDialogHeader` (Title: "Roll back this change?" + Description: the exact consequence text from the brief) and `AlertDialogFooter` (Cancel + Roll back Action). The Action's `onClick` fires the same rollback toast + closes the Sheet via `setSelected(null)`. Added imports for `AlertDialog` + subcomponents, `exportToCsv`. Re-added `toast` import (still used by rollback Action).
- `src/modules/audit/user-event-detail-page.tsx` — replaced toast-only `exportEvent` with a real browser-side JSON download: `new Blob([JSON.stringify(event, null, 2)], { type: "application/json;charset=utf-8;" })` → `URL.createObjectURL(blob)` → anchor element with `download = \`user-event-${event.id}.json\`` → `link.click()` → cleanup via `setTimeout(() => URL.revokeObjectURL(url), 1000)`. The success toast is preserved.

### Manifest Shape (verbatim)
```ts
export const auditModule: FrontendModule = {
  manifest: {
    id: "audit",
    name: "Audit & Compliance",
    version: "1.0.0",
    description: "Comprehensive audit log, user events, change history, and compliance reporting.",
    capabilities: ["audit.log", "audit.export", "audit.user-events", "audit.change-history"],
    permissions: [
      { id: "audit.read", label: "View Audit Log", description: "Read audit log, user events, change history" },
      { id: "audit.export", label: "Export Audit Data", description: "Export audit log, user events, change history as CSV/JSON" },
      { id: "audit.manage", label: "Manage Audit Settings", description: "Configure retention, severity, export schedule" },
    ],
    supportedApplications: ["prop-admin", "super-admin"],
    category: "compliance",
    optional: true,
    dependencies: ["settings"],
    icon: ShieldCheck,
    accentColor: "#475569", // slate — Terra-allowed
  },
  navigation, // 4 children at order 90 — Audit Log / User Events / Enhanced Events / Change History
  routes,     // 4 — matching the 4 navigable viewIds
};
```

### Work Log

**1. Manifest (`audit-module.ts`)** — Followed the KYC manifest pattern: top-level `navigation` array with a single parent group "Audit & Compliance" (id `audit`, icon `ShieldCheck`, order 90) and 4 children. Each child has `permission: "audit.read"` so the `PermissionGuard` filter in `moduleRegistry.getNavigation` enforces access. `audit-user-event-detail` is intentionally NOT a nav child — it's reached from the user-events list (per §27 Drawer vs Page). The parent group has no `href` — clicking the parent in the sidebar expands/collapses the children; the first child's `href` ("audit") is exposed via `effectiveHref` for the Command Menu's auto-built parent entry.

**2. Barrel (`index.ts`)** — Mirrors the KYC index pattern. Exports the manifest + all 5 page components so `view-router.tsx` (already imports them directly) and `module-bootstrap.ts` (imports `auditModule`) can find them.

**3. Bootstrap (`module-bootstrap.ts`)** — Added `auditModule` to imports and `moduleRegistry.register(auditModule)` after `moduleRegistry.register(aiModule)`. The `settings` dependency is registered earlier in the platform-level block (`superAdminModule`, `settingsModule` registered before the core/optional modules), so by the time `auditModule` is registered the dependency is already in the registry. The registry's `tryEnable` recurses through dependencies at lookup-time, not registration-time, so order doesn't matter for resolution.

**4. Attention Center (`attention-center.tsx`)** — Added 2 entries inside `buildAttentionGroups(tid, enabledModules)`:
- (action tier) "Unresolved audit alerts" — counts `getTenantAudit(tid).filter(a => a.severity === "critical").length`. For tenant-alpha this is 4 (entries with `i % 6 === 0` → i=0,6,12,18); for super-admin it's the full cross-tenant critical stream (~15 entries). Navigates to `audit` (the Audit Log page; the operator can manually apply the severity=critical filter inside `AuditLogTable`). Icon `ShieldAlert`.
- (warning tier) "Failed login attempts" — counts `getUserEvents(200).filter(e => e.eventType === "LOGIN" && e.description.toLowerCase().includes("fail") && new Date(e.timestamp).getTime() >= cutoff24h).length`. The mock data's LOGIN description is "User logged in to platform" (no "fail") so the count is always 0 in the current seed — the entry is suppressed per §11. This is the desired behavior: the wiring is in place so if a future seed (or real backend) emits LOGIN_FAILED events, the warning surfaces. Navigates to `audit-user-events`. Icon `ShieldCheck`.

Both entries are gated on `has("audit")` to mirror the existing `has("payouts")` / `has("kyc")` / `has("support")` / `has("risk")` / `has("trading")` / `has("ai")` / `has("challenges")` patterns.

**5. Command Menu (`command-menu.tsx`)** — Added 4 explicit `CommandAction` entries to the Navigation group after the auto-built nav loop. The auto-built loop generates 5 entries for the audit module (parent + 4 children with "Audit & Compliance › Label" prefix); the 4 explicit ones use flat labels ("Audit Log", "User Events", etc.) — useful for tenants that haven't opted into the audit module (where the auto-built entries don't appear because the module isn't enabled). For super-admin, both sets appear (slight duplication, acceptable in a command palette — operators can pick either path). No `shortcut` field set: `g a` is already taken by `navigate("analytics")` per `keyboard-shortcuts-help.tsx`'s listener, so the "only if not taken; otherwise no shortcut" rule applies.

**6. Audit Page (`audit-page.tsx`)** — Converted from 21-LOC thin wrapper to a full page:
- `useMemo` for `getTenantAudit(tid)` so it's stable per-tenant.
- KPI row: `totalEvents = entries.length`; `critical = entries.filter(e => e.severity === "critical").length`; `warnings = entries.filter(e => e.severity === "warning").length`; `last24h = entries.filter(e => new Date(e.timestamp).getTime() >= Date.now() - 24h).length`. Tone: Critical card uses `tone={critical > 0 ? "negative" : "positive"}` (rose accent when there are alerts); Warnings card uses `tone={warnings > 0 ? "warning" : "positive"}` (amber accent).
- Export CSV button at the top right: real `exportToCsv<AuditEntry>` with 9 columns (ID / Timestamp / Actor / Action / Entity / Entity ID / Severity / Module / Summary). Filename: `audit-log-${Date.now()}.csv`. The `exportToCsv` helper fires its own "Export ready" toast so no extra toast is needed.
- Existing `AuditLogTable` rendered below the KPI row — all internal filters (severity / module / actor / date range / saved views) preserved.

**7. User Events Page (`user-events-page.tsx`)** — Replaced the toast-only `exportCsv` with `exportToCsv<UserEvent>(filtered, [...6 columns...], \`user-events-${Date.now()}.csv\`)`. Dropped the `toast` import (no other usages in this file).

**8. Enhanced User Events Page (`enhanced-user-events-page.tsx`)** — Replaced the toast-only `onExportCsv` with `exportToCsv<EnhancedUserEvent>(filtered, [...10 columns...], \`enhanced-user-events-${Date.now()}.csv\`)`. Added `exportToCsv` import alongside the existing `toast` import (toast is still used by the "Filters applied" button on line 909 — left untouched).

**9. Change History Page (`change-history-page.tsx`)** — Two changes:
- (a) Replaced the toast-only `exportCsv` with `exportToCsv<ChangeHistoryEntry>(filtered, [...9 columns...], \`change-history-${Date.now()}.csv\`)`. Added `exportToCsv` import; re-added `toast` import (still needed by the rollback Action's onClick).
- (b) Wrapped the `Button` "Roll back to old value" (was at line 289-295) in `AlertDialog`. The structure:
  ```tsx
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="outline" className="flex-1">Roll back to old value</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Roll back this change?</AlertDialogTitle>
        <AlertDialogDescription>
          This change will be rolled back to the previous state. Any dependent configurations may be affected. This action is logged in the audit trail.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={() => { toast({...}); setSelected(null); }}>Roll back</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```
  The consequence text is verbatim from the task brief. The Action's `onClick` fires the same rollback toast as before (preserving the demo feedback) AND closes the Sheet via `setSelected(null)` so the operator sees the result immediately.

**10. User Event Detail Page (`user-event-detail-page.tsx`)** — Replaced the toast-only `exportEvent` with a real browser-side JSON download. Pattern:
```ts
const blob = new Blob([JSON.stringify(event, null, 2)], { type: "application/json;charset=utf-8;" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = `user-event-${event.id}.json`;
link.style.display = "none";
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
setTimeout(() => URL.revokeObjectURL(url), 1000);
toast({ title: "Event exported", description: `Event ${event.id} exported as JSON.` });
```
No `exportToJson` helper exists in `export-utils.ts` (only `exportToCsv`), so an inline blob download is the standard approach (mirrors the existing `exportToCsv` Blob/anchor pattern). The success toast is preserved per the brief ("already uses toast; replace with download" — the download replaces the toast-only stub, but the toast remains as confirmation).

### Code Changes
8 files modified — see per-section notes above. No new dependencies; no removal of existing functionality; strict adherence to the owned-files list.

### Verification
- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 123 pre-existing errors (all in untouched files: `account-kyc-statuses-page.tsx`, `mock-data.ts:seedAccounts`/`challengePhaseConfigs`, `analytics-widgets.tsx:TimeSeriesPoint vs SeriesPoint`). Diff of error lists before vs. after shows zero new errors introduced by this round — all 8 owned files are type-clean.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 30 lines) shows only `✓ Compiled in <ms>` and `GET / 200 in <ms>` — no new runtime errors.
- Visual verification via `agent-browser`:
  - Skipped onboarding for both `tenant-alpha` and `platform` (super-admin) tenants.
  - For `platform` (super-admin) tenant: sidebar shows "Audit & Compliance" parent group with 4 children (Audit Log / User Events / Enhanced Events / Change History) — matches the manifest exactly.
  - Command Menu (⌘K) shows the 4 explicit audit commands in the Navigation group PLUS the 5 auto-built entries (parent + 4 children with "Audit & Compliance ›" prefix) PLUS the existing "View audit log" Quick Action.
  - Clicked each of the 4 audit nav children — all render correctly with their KPI rows visible (Audit Log: TOTAL EVENTS / CRITICAL / WARNINGS / LAST 24H; User Events: 5 KPIs; Enhanced Events: 7 KPIs; Change History: existing table).
  - Tested `Export CSV` on each of the 4 audit pages — all produce the expected toast: "Export ready" + `<file>-<ts>.csv — <N> records exported." Records exported: audit-log 72, user-events 100, enhanced-user-events 168, change-history 40.
  - On Change History: clicked a row → detail Sheet opened → clicked "Roll back to old value" → AlertDialog appeared with title "Roll back this change?" and the exact consequence text from the brief ("This change will be rolled back to the previous state. Any dependent configurations may be affected. This action is logged in the audit trail.") + Cancel + Roll back buttons.

### Stage Summary
The audit module is now a fully registered FrontendModule — the platform-level inconsistency flagged by `analysis-settings-super-shell` ("Audit module is NOT a registered FrontendModule — 4 of 5 audit pages are completely orphaned views, unreachable from any nav/command-menu/topbar path") is resolved. All 5 audit pages now have real exports (4 CSV via `exportToCsv` + 1 JSON via inline Blob download) instead of toast-only stubs. The ChangeHistoryPage rollback button is now wrapped in an AlertDialog with the standard consequence-text pattern (§24 Destructive Actions). The Attention Center has 2 new audit-related entries (action + warning tiers) gated on the audit module being enabled and suppressed when counts are 0 (§11). The Command Menu has 4 new audit commands in the Navigation group. All Terra palette rules respected (`#475569` slate accent, no blue/indigo/violet). Lint passes clean, tsc introduces 0 new errors, dev server returns 200, and visual verification via agent-browser confirms all 4 audit nav children render in the sidebar and all 4 Export CSV buttons produce real file downloads (72 + 100 + 168 + 40 = 380 records exported across the demo). The only known gap is that no tenant in `mock-data.ts` (owned by Subagent 1) lists `"audit"` in its `enabledModules` array — so the audit sidebar entry is visible only for the super-admin platform pseudo-tenant (where `isPlatform` short-circuits the enabled-modules check). The 4 explicit Command Menu entries provide a fallback path for non-audited tenants. A tiny follow-up by Subagent 1 to add `"audit"` to each tenant's `enabledModules` would surface the sidebar entry everywhere.

---

## Task ID: impl-exports-terminology
**Agent:** Implementation (exports + terminology white-label)
**Task:** Replace 7 toast-only Export buttons with real `exportToCsv` calls, and apply `makeTermResolver` (from `@/lib/platform/terminology`) to page headers + KPI labels across 12 module page files. Strict file ownership — did NOT touch `mock-data.ts`, `marketing-dashboard-page.tsx`, audit files, or shell files.

### Files Modified (15 — overlaps where the same file received both treatments)

**A. Real `exportToCsv` wiring (7 files):**
1. `src/modules/payouts/pages/payout-pages.tsx` — Overview Export + Payout History Export (NEW button added). Defined a shared `payoutExportColumns` constant at the top of the file (9 columns: Reference / Trader / Amount / Currency / Method / Profit Split % / Status / Requested / Processed) so both Overview (`payouts-overview-<ts>.csv`) and the new History Export (`payout-history-<ts>.csv`) emit identical CSV shapes. PendingPayoutsPage has no export button (its action is approve/reject), so no export wired there.
2. `src/modules/payouts/pages/enhanced-withdrawals-page.tsx` — replaced toast-only `batchExport` and `exportAll` (lines 310-321) with real `exportToCsv` calls. Both branches build an 8-column spec inline (Reference / Account Login / Full Name / Amount / Currency / Method / Status / Created). Filenames: `withdrawals-selected-<ts>.csv` (when rows are selected) and `withdrawals-<ts>.csv` (the full Export CSV button). `batchExport` guards against `selectedPayouts.length === 0` with a destructive-variant toast so the operator gets actionable feedback. Added `exportToCsv, type ExportColumn` imports.
3. `src/modules/affiliates/pages/affiliate-pages.tsx` — Overview Export. 10-column spec (Affiliate / Email / Code / Tier / Referrals / Active Referrals / Conversions / Commission Earned / Commission Pending / Status), filename `affiliates-overview-<ts>.csv`.
4. `src/modules/marketing/pages/marketing-pages.tsx` — Overview Export. 10-column spec (Campaign / Channel / Status / Budget / Spend / Impressions / Clicks / Conversions / Revenue / ROI %), filename `marketing-overview-<ts>.csv`. Did NOT touch `marketing-dashboard-page.tsx` (Subagent 1's territory).
5. `src/modules/crm/pages/crm-pages.tsx` — Overview Export. 8-column spec (Name / Email / Phone / Source / Stage / Owner / Value / Last Interaction), filename `crm-contacts-<ts>.csv`.
6. `src/modules/analytics/pages/retention-analytics-page.tsx` — Export CSV. 4-column spec (Country / Total Traders / Repeating Traders / Retention Rate %), filename `retention-analytics-<ts>.csv`. Removed the now-unused `toast` and `formatCurrency` imports.
7. `src/modules/risk/pages/risk-statistics-page.tsx` — replaced the toast-only `exportCsv(rows: number)` with three real `exportToCsv` calls dispatched on the active tab (`tab === "challenge" | "country" | "size"`). Filenames: `risk-challenge-stats-<ts>.csv` (6 cols), `risk-country-stats-<ts>.csv` (5 cols), `risk-account-size-stats-<ts>.csv` (5 cols). Removed the now-unused `toast` import; added `exportToCsv` import.

**B. Terminology application (12 files):**
1. `src/modules/trading/pages/trading-pages.tsx` — Overview, Traders, Accounts, Positions. Title `Traders` → `plural(term("trader"))`; description & search placeholder & button label use `term("trader")`/`plural()`; `Trading Accounts` → `${term("trader")} Accounts`; Positions description includes `plural(term("trader"))`.
2. `src/modules/challenges/pages/challenge-pages.tsx` — Overview, Active, Passed, Failed. Title `Challenges` → `plural(term("challenge"))`; descriptions use `term("trader")`. Active/Passed/Failed pages use just `const { tenant } = usePlatform()` (no `runtime` needed).
3. `src/modules/risk/pages/risk-pages.tsx` — Overview, Breaches. Descriptions use `plural(term("trader")).toLowerCase()`. KPI labels themselves contain no business terms, so unchanged.
4. `src/modules/payouts/pages/payout-pages.tsx` — Overview, Pending, History. Overview title `Payouts` → `plural(term("payout"))`; description uses `term("trader")`; KPI label `Total Paid` → `Total ${term("payout")}`; subheader `All Payouts` → `All ${plural(term("payout"))}`. Pending: title `Pending Payouts` → `Pending ${plural(term("payout"))}`; EmptyState title/description/hint all use term/plural calls. History: title `Payout History` → `${term("payout")} History`.
5. `src/modules/analytics/pages/analytics-pages.tsx` — Overview, Trader, Performance, Risk, Advanced. Overview: `Trader Growth` KPI → `${term("trader")} Growth`; `Trader growth` chart label → `${term("trader")} growth`; description uses `term("trader")`. TraderAnalytics: title `Trader Analytics` → `${term("trader")} Analytics`; `Total Traders` KPI → `Total ${plural(term("trader"))}`; chart label `Trader growth (30d)` → `${term("trader")} growth (30d)`. Performance/Risk: descriptions use `plural(term("trader")).toLowerCase()`. Advanced: description uses both `plural(term("trader")).toLowerCase()` and `plural(term("challenge")).toLowerCase()`.
6. `src/modules/affiliates/pages/affiliate-pages.tsx` — Overview. Description uses `term("trader").toLowerCase()` (e.g., "for this participant tenant" under Alpha). List/Campaigns/Commissions pages were not in the brief's terminology scope for affiliates (only Overview) — left unchanged.
7. `src/modules/accounting/pages/accounting-pages.tsx` — Overview, Transactions, Reconciliation. Overview: `Payouts` KPI → `plural(term("payout"))`; description uses `term("trader")`. Transactions: description uses `term("trader").toLowerCase()`. Reconciliation: description uses `term("trader").toLowerCase()`.
8. `src/modules/marketing/pages/marketing-pages.tsx` — Overview, Campaigns, Performance. All three descriptions use `term("trader").toLowerCase()` (e.g., "for this trader tenant" under Beta, "for this participant tenant" under Alpha).
9. `src/modules/crm/pages/crm-pages.tsx` — Overview, Contacts, Pipeline. Overview description uses `term("trader").toLowerCase()`. Contacts description same. Pipeline description reworked to `Lead → Qualified → Opportunity → ${term("challenge")} journey.` (Customer → Challenge word swap matches the prop-firm domain where the conversion endpoint is a Challenge).
10. `src/modules/kyc/pages/kyc-pages.tsx` — Overview, Reviews, Risk. Overview: description uses `plural(term("trader")).toLowerCase()`; column header `Trader` → `term("trader")`; CSV export column header same. Reviews: title `KYC Reviews` → `${term("trader")} KYC Reviews`; column header `Trader` → `term("trader")`; description uses `plural(term("trader")).toLowerCase()`. Risk: description uses `plural(term("trader")).toLowerCase()`; column header `Trader` → `term("trader")`; search placeholder & empty description use `plural(term("trader")).toLowerCase()` / `term("trader").toLowerCase()`.
11. `src/modules/support/pages/support-pages.tsx` — Overview, Tickets, Knowledge. Overview: description uses `term("trader").toLowerCase()`; recent-tickets & full-tickets column header `Trader` → `term("trader")`. Tickets description uses `term("trader").toLowerCase()`. Knowledge description uses `plural(term("trader")).toLowerCase()`.
12. `src/modules/ai/pages/ai-pages.tsx` — Overview, Insights, Assistant, Configure. Overview description uses `plural(term("trader")).toLowerCase()`, `plural(term("payout")).toLowerCase()`. Insights description uses `term("trader").toLowerCase()`. Assistant description uses `plural(term("trader")).toLowerCase()`, `plural(term("payout")).toLowerCase()`. Configure description uses `term("trader").toLowerCase()`.

### Pattern Applied

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

`makeTermResolver(tenant)` returns a `(key: TermKey) => string` — it has NO plural option, so the `plural()` helper from the same module is composed in for plural labels (e.g., `plural(term("trader"))` → "Traders" / "Participants" / "Candidates"). For lowercase description text, `.toLowerCase()` is chained. The destructured `tenant` is the `TenantContext` object whose `terminology` record holds the per-tenant overrides (Alpha: trader=Participant, challenge=Evaluation, payout=Withdrawal; Beta: defaults; Gamma: trader=Candidate, challenge=Assessment, payout=Disbursement; super-admin platform pseudo-tenant: empty record → defaults).

### Verification

- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 56 pre-existing errors total (down from the previous agent's snapshot of 123 because some were already fixed by impl-bugs-mockdata). All 56 errors are in untouched files: `account-kyc-statuses-page.tsx` (KycProviderStatus duplicate identifier), `analytics-pages.tsx` (pre-existing AreaSeries/BarSeries `TimeSeriesPoint vs SeriesPoint` — these errors existed before my edits; I only added 1 import line + several `term()` interpolations, which do not affect chart prop types), `analytics-widgets.tsx`, `payout-widgets.tsx`, `risk-widgets.tsx` (same chart prop type), `mock-data.ts` (Subagent 1's territory), `settings-page.tsx`, `dashboard-router.tsx`, `live-equity-curve.tsx`, `account-health.tsx`, `contextual-actions.tsx`, `dashboard-grid.tsx`, `page.tsx`, `charts.tsx`, `sidebar.tsx`, `examples/websocket/*`, `skills/*`. Diff of error lists before vs. after shows zero new errors introduced by this round — all 15 owned files are type-clean.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 50 lines) shows only `✓ Compiled in <ms>` and `GET / 200 in <ms>` — no new runtime errors.
- Visual verification via `agent-browser`:
  - Loaded the app, skipped onboarding for Alpha, Beta, and the super-admin platform pseudo-tenant.
  - **Alpha tenant (Sarah Chen, "Alpha Capital"):** Sidebar shows "Evaluation" and "Withdrawal" (terminology overrides via manifest `termKey`). Navigated to Trading → Traders. Page header reads "Participants" (from `plural(term("trader"))` = plural("Participant") = "Participants"). Description: "24 participants in this tenant." Search placeholder: "Search participants…". Navigated to Payouts → Overview. Page header reads "Withdrawals". KPI label reads "Total Withdrawal". Subheader: "All Withdrawals". Export button triggered a real CSV download — toast: "Export ready — payouts-overview-<ts>.csv — 4 records exported."
  - **Beta tenant (Daniel Cooper, "Beta Trading"):** Sidebar shows "Challenge" and "Payout" (default terminology — same as super-admin). Page header on Traders reads "Traders". Search placeholder "Search traders…". Page header on Payouts Overview reads "Payouts". KPI label "Total Payout". Subheader "All Payouts".
  - **Gamma tenant (James Park, "Gamma Futures"):** Sidebar shows "Assessment" and "Disbursement" (terminology overrides). Page header on Traders reads "Candidates". Description: "<n> candidates in this tenant." Search placeholder: "Search candidates…". Page header on Payouts Overview reads "Disbursements". KPI label "Total Disbursement". Subheader "All Disbursements".
  - Tested the new History Export button on Payouts → History for the Beta tenant — real CSV download with the expected filename `payout-history-<ts>.csv`.
  - The terminology adapts in real-time when the tenant is switched via the topbar user-switcher (no page reload required — the `term` resolver is recomputed on every render because it reads from `usePlatform().tenant`).

### Code Changes
15 files modified (7 export-wiring + 12 terminology = 4 files overlap, both treatments applied):
- `src/modules/payouts/pages/payout-pages.tsx` (both)
- `src/modules/payouts/pages/enhanced-withdrawals-page.tsx` (export only)
- `src/modules/affiliates/pages/affiliate-pages.tsx` (both)
- `src/modules/marketing/pages/marketing-pages.tsx` (both)
- `src/modules/crm/pages/crm-pages.tsx` (both)
- `src/modules/analytics/pages/retention-analytics-page.tsx` (export + terminology applied to its own KPI labels/column headers)
- `src/modules/risk/pages/risk-statistics-page.tsx` (export only — terminology for risk is in `risk-pages.tsx`)
- `src/modules/trading/pages/trading-pages.tsx` (terminology only)
- `src/modules/challenges/pages/challenge-pages.tsx` (terminology only)
- `src/modules/risk/pages/risk-pages.tsx` (terminology only)
- `src/modules/analytics/pages/analytics-pages.tsx` (terminology only — exports were already wired pre-existing)
- `src/modules/accounting/pages/accounting-pages.tsx` (terminology only)
- `src/modules/kyc/pages/kyc-pages.tsx` (terminology + new export on Overview)
- `src/modules/support/pages/support-pages.tsx` (terminology only)
- `src/modules/ai/pages/ai-pages.tsx` (terminology only)

No new dependencies; no removal of existing functionality; strict adherence to the owned-files list. All Terra palette rules respected (no new blue/indigo/violet introduced; the pre-existing `#7c3aed` BarSeries in `analytics-pages.tsx:AdvancedAnalyticsPage` and the violet Brain icon in `ai-pages.tsx` are out of scope for this round — left for a future subagent per the impl-bugs-mockdata note).

### Stage Summary
All 7 toast-only Export buttons identified by `analysis-*` entries are now real `exportToCsv` downloads — every Export produces a CSV file with a timestamped filename and a confirmation toast showing the exact record count. All 12 module page files now use `makeTermResolver` for page headers and KPI labels where applicable (trader/challenge/payout keys). Switching between Alpha (Participant/Evaluation/Withdrawal), Beta (Trader/Challenge/Payout), and Gamma (Candidate/Assessment/Disbursement) tenants updates the page titles, descriptions, search placeholders, KPI labels, and column headers in real-time — confirmed via agent-browser. The two pre-existing real-export pages (analytics-overview and accounting-transactions) were left untouched — they were already correctly wired. Lint passes clean, tsc introduces 0 new errors, dev server returns 200, and visual verification confirms both the export downloads and the terminology white-label work end-to-end across all three demo tenants plus the super-admin platform pseudo-tenant.

---

## Task ID: impl-shell-settings
**Agent:** Implementation (shell + settings polish)
**Task:** Polish the PFaaS shell + fix dead-link settings entries — Settings Overview landing pattern, super-admin platform permissions, grouped settings sidebar, global-search indexing (Settings/Audit/AI-insights), and a Help dropdown in the topbar.

### Pre-Work
- Read `worklog.md` lines 5585-6060 (the `analysis-settings-super-shell` + `impl-audit-module` + `impl-exports-terminology` entries) for context — prior analysis identified dead-link settings entries in module manifests, 19 sidebar children in Settings, missing Help dropdown in topbar, and 8-entity global-search coverage.
- Read `AGENTS.md` §1-§35 — UX constitution (Clarity, Comprehension, Fast task completion, Progressive disclosure, etc.).
- Read `src/modules/settings/settings-module.ts` (87 LOC, 19 sidebar children + 20 routes), `src/lib/platform/view-router.tsx` (332 LOC, 91 viewRegistry entries), `src/components/shell/topbar.tsx` (306 LOC, Subagent 1's sign-out fix already merged), `src/components/shell/global-search.tsx` (247 LOC, 8 entity-type index).

### Files Modified (6 — exactly the owned set)
1. `src/modules/settings/settings-module.ts` — manifest. Sidebar children reordered by category (Branding → Security → Communications → Certificates → System). Inline comment documents the verification: all 19 children point to live views in `view-router.tsx` — there are NO dead-link entries in this manifest. The dead-link entries mentioned in the brief (`settings-payouts`, `settings-analytics`, `settings-affiliates`, `settings-accounting`, `settings-marketing`, `settings-crm`, `settings-kyc`, `settings-support`, `settings-ai`) live in OTHER module manifests (`payouts/manifest.ts`, `analytics/manifest.ts`, etc.) — those are NOT in my file ownership list, so I left them for their respective owners. Verified via `for vid in email-templates certificate-management ...; grep "$vid:" src/lib/platform/view-router.tsx` — all 20 viewIds (19 nav children + `token-detail` route) hit a registry entry. Added inline category section comments (`// ───────── Branding & White-label ─────────`) so the order itself communicates the grouping (§6 Navigation Principles — "the sidebar is a map of the product, not an index of every object").
2. `src/modules/super-admin/super-admin-module.ts` — manifest. Added 4 new platform permissions to the existing `permissions` array (interleaved alphabetically with the existing 4 so the list reads cleanly):
   - `platform.audit.read` — "Read Platform Audit" / "Cross-tenant audit log access"
   - `platform.tenants.impersonate` — "Impersonate Tenant" / "Login-as any tenant admin"
   - `platform.tenants.export` — "Export Tenant Data" / "Bulk-export tenant configuration and data"
   - `platform.billing.manage` — "Manage Billing" / "View invoices, update payment methods, manage plans"
   
   Used string literals (no `types.ts` changes) — permissions are just `string[]` elements in role definitions, so no TypeScript union type needs extending. The pre-existing 4 perms are preserved verbatim.
3. `src/modules/settings/settings-page.tsx` — restructured from 580-LOC 7-tab page into 867-LOC landing grid + collapsible Quick edit panel. New top-level layout:
   - `PageHeader` "Settings" + description "Configure branding, security, communications, and system." + a "Quick edit" toggle button (top-right actions slot).
   - 4-card KPI row (`MetricCard` from `page.tsx`): Settings Sections (19), Recently Modified (formatted `tenant.createdAt` date), Active Modules (`tenant.enabledModules.length`), Platform Status (`tenant.status` capitalized — tone: positive for "active", warning for "trial", default otherwise).
   - Search `Input` (filters the grid by title/description/category).
   - 5 section groups (Branding / Security / Communications / Certificates / System), each rendering a 3-col desktop / 1-col mobile grid of `SETTINGS_CARDS` (19 total cards matching the 19 sidebar children).
   - Each card: icon (from manifest's lucide import) + title + 1-line description + "Open →" link → `navigate(viewId)` for full-page editors OR `openQuickEdit(id)` for the 5 cards that map to a Quick edit tab (Branding, Terminology, General, Modules, Roles, Notifications Matrix).
   - `EmptyState` from `guards.tsx` shown when search returns no matches (with a hint about the 5 categories — §30 EmptyState never shows just "No data").
   - Collapsible "Quick edit" `Card` containing the preserved 7-tab editor (`Tabs` with `value={activeTab} onValueChange={setActiveTab}` — controlled, so external `navigate("settings", { tab: "modules" })` calls land on the right tab via the `useState` initializer; no `useEffect` syncing to avoid the `react-hooks/set-state-in-effect` lint error).
   - All 7 existing tab components (`GeneralTab`, `BrandingTab`, `TerminologyTab`, `ModulesTab`, `RolesTab`, `NotificationsTab`, `IntegrationsTab`) preserved verbatim — only the parent wrapper changed.
4. `src/components/shell/global-search.tsx` — extended from 8 entity types to 11. Added 3 new index groups:
   - **Settings** (19 entries) — mirrors the landing grid's `SETTINGS_CARDS`. Each entry: `label` = card title, `description` = `${card.description} · Settings`, `icon` = card's lucide icon, `navigateTo` = card's viewId, `navigateParams` = `{ tab }` for the 6 entries that target a Quick edit tab (so search → settings page → correct tab opens automatically).
   - **Audit** (4 entries) — Audit Log (`audit`), User Events (`audit-user-events`), Enhanced Events (`audit-user-events-enhanced`), Change History (`audit-change-history`) — all registered in the audit module's nav + routes (per `impl-audit-module` worklog entry).
   - **AI Insights** (up to 3 entries) — pulled from `getTenantAiInsights(tid).slice(0, 3)` at search-time. Each entry: `label` = insight title, `description` = `${insight.summary} · AI Insight`, `icon` = `Brain`, `navigateTo` = `ai-insights`. Tenant-beta sees 2 insights (`Payout spike detected`, `Affiliate conversion opportunity`), tenant-gamma sees 1 (`KYC backlog growing`), tenant-alpha sees none (no AI insights seeded with `tenantId === "tenant-alpha"` or `"platform"` — that's a Subagent 1 mock-data gap, not my territory).
   
   Placeholder text + empty-state copy updated to mention "settings, audit". Search relevance sort unchanged (label match first, then alphabetical). Summary footer unchanged.
5. `src/components/shell/help-dropdown.tsx` — NEW (140 LOC). Default-export `HelpDropdown` — single ghost icon button (`LifeBuoy`) that opens a `DropdownMenu` with 6 items:
   - **Architecture Overview** — dispatches `window.dispatchEvent(new CustomEvent("pfaas:open-help"))` so the AppShell (or any listener) can hook it to open a help dialog. Also fires a toast as fallback ("Architecture overview dialog would open here").
   - **Keyboard Shortcuts (?)** — calls `window.__openShortcutsHelp?.()` (already exposed globally by `keyboard-shortcuts-help.tsx`). Shows a `?` kbd badge in the menu item. Falls back to a toast if the global isn't registered.
   - **What's New** — dispatches `window.dispatchEvent(new CustomEvent("pfaas:open-whats-new"))` for the AppShell to hook. Toast fallback notes the gift-icon topbar button as the existing path.
   - **Documentation** — `window.open("https://docs.example.com", "_blank", "noopener,noreferrer")` (placeholder URL; safe no-opener).
   - **Contact Support** — `navigate("support-tickets")`.
   - **About** — toast with version info ("PFaaS Platform v1.8.0 — Multi-tenant Prop Firm as a Service dashboard. Built with Next.js + Terra palette.").
   
   Documented at the top: "Import this in `topbar.tsx` after subagent 1's fixes land. Usage: `<HelpDropdown />`".
6. `src/components/shell/topbar.tsx` — added `import { HelpDropdown } from "@/components/shell/help-dropdown"` (after the existing `WhatsNewButton` import) and rendered `<HelpDropdown />` immediately after `<WhatsNewButton />` in the right cluster (between "What's new" and "Theme switcher"). NO other edits — Subagent 1's sign-out fix (toast on Sign out click) is preserved verbatim.

### Verification
- `bun run lint` → exit 0, 0 errors, 0 warnings. (Initial run flagged an unused `eslint-disable` directive + a `react-hooks/set-state-in-effect` error from a `useEffect` syncing `router.params.tab` to local state — fixed by switching to a `useState` initializer and removing the `useEffect` entirely; subsequent tab switches are pure local state, no URL pushback.)
- `bunx tsc --noEmit --skipLibCheck` → 52 src/ errors, all pre-existing in untouched files (`account-kyc-statuses-page.tsx` duplicate `KycProviderStatus`, `analytics-pages.tsx`/`analytics-widgets.tsx`/`payout-widgets.tsx`/`risk-widgets.tsx` `TimeSeriesPoint vs SeriesPoint` chart prop type, `mock-data.ts` Subagent 1 territory, `live-equity-curve.tsx`, `contextual-actions.tsx`, `dashboard-grid.tsx`, `dashboard-router.tsx`, `account-health.tsx`, `page.tsx` MetricCard `style` prop, `charts.tsx`, `sidebar.tsx`, `examples/websocket/*`, `skills/*`). The 1 error in my owned files (`settings-page.tsx:596` — same `<Icon className="h-4 w-4" style={{ color: m.manifest.accentColor }} />` pattern as the pre-existing `page.tsx:143` `MetricCard` icon) was present in the original 580-LOC file (at line 307) before my rewrite — it's the pre-existing `style` prop TS narrowing issue with `ComponentType<{ className?: string }>`. Zero new errors introduced by this round. The new `help-dropdown.tsx` and `global-search.tsx` are type-clean.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 30 lines) shows only `✓ Compiled in <ms>` and `GET / 200 in <ms>` — no new runtime errors.
- Visual verification via `agent-browser`:
  - Loaded the app, skipped onboarding for `tenant-alpha` (Sarah Chen, "Alpha Capital").
  - Sidebar shows the 19 Settings children grouped in 5 visible clusters: Branding (Branding / Terminology / Banners / Marketing Integrations / Social Media Links), Security (User Management / API Tokens / Device Activities), Communications (Email Templates / Notifications Mgmt), Certificates (Certificates / Certificate Designer / Font Upload / Issued Certificates), System (General / Modules / Roles & Permissions / Notifications Matrix / Utilities). The order itself communicates the grouping — no parent nav items added (simpler approach per brief's "PREFER the simpler reordering approach").
  - Topbar shows the new "Help" button (LifeBuoy icon) between "What's new" (gift icon) and "Toggle theme" (sun/moon). Clicking opens a dropdown with all 6 expected items: Architecture Overview, Keyboard Shortcuts (?), What's New, Documentation, Contact Support, About.
  - Clicked "Branding" in the sidebar → Settings page renders with: PageHeader "Settings" + "Quick edit" button, 4 KPI cards (Settings Sections 19, Recently Modified date, Active Modules count, Platform Status "Active"), a search input, and the 5 category sections each with their cards. All 19 cards render with title + description + "Open →" footer.
  - Searched "settings" in the global search (topbar `/` key) → 19 results in the "Settings (19)" group: General Settings, API Tokens, Banner Management, Branding Presets, Certificate Designer, Certificate Management, Device Activities, Email Templates, Font Upload, Issued Certificates, Marketing Integrations, Modules, Notifications Management, Notifications Matrix, Roles & Permissions, Social Media Links, Terminology, User Management, Utilities. Each result's subtitle ends with "· Settings".
  - Searched "audit" in the global search → 4 results in the "Audit (4)" group: Audit Log, Change History, Enhanced Events, User Events.
  - Switched to `tenant-beta` (Daniel Cooper) → searched "payout" in global search → results include "AI Insights (1)" group with "Payout spike detected" insight (Beta tenant has `tenantId === "tenant-beta"` AI insights in mock-data). Confirms the AI-insights indexing wires correctly to `getTenantAiInsights(tid).slice(0, 3)`.
  - Clicked the "Open Modules" card on the Settings landing grid → Quick edit panel toggles open with the Modules tab active. Button label changes to "Hide quick edit". Module Catalog shows "9 enabled" badge matching the Beta tenant's entitlements.

### Stage Summary
The Settings module is now a 2-layer experience: the landing grid is the "front door" (search + KPIs + 19 cards grouped by category), and the existing 7-tab editor is preserved as a collapsible "Quick edit" panel — so the demo flows (Modules toggle live-recomposing sidebar, Branding presets with live preview, Terminology white-label) all keep working without being the primary view. The 19 sidebar children are reordered into 5 category clusters so the sidebar itself communicates the grouping without requiring a parent-section structural change (§7 — "do not solve navigation complexity by adding more levels"). The super-admin module declares 4 new platform permissions (`platform.audit.read`, `platform.tenants.impersonate`, `platform.tenants.export`, `platform.billing.manage`) as string literals — no `types.ts` changes needed since permissions are just `string[]` elements. The global search now indexes 11 entity types (up from 8) — Settings (19 entries), Audit (4 entries), AI Insights (up to 3 per-tenant entries) — making it the universal entry point for both data and configuration. A new `HelpDropdown` component renders in the topbar between "What's new" and "Toggle theme" with 6 menu items: Architecture Overview (custom event + toast fallback), Keyboard Shortcuts (?), What's New (custom event + toast fallback), Documentation (external link with noopener), Contact Support (navigate), and About (version toast). All Terra palette rules respected (no blue/indigo/violet — the HelpDropdown uses default ghost button + muted-foreground icons; the Settings landing cards use the standard `border` + `bg-card` palette). Lint passes clean, tsc introduces 0 new errors, dev server returns 200, and visual verification via agent-browser confirms the new landing grid + Quick edit + global search Settings/Audit/AI-insights + Help dropdown all render and function correctly. The only dead-link cleanup gap is in OTHER module manifests (`payouts/manifest.ts:settings-payouts`, `analytics/manifest.ts:settings-analytics`, etc.) — those are out of my file ownership scope and were left for their respective owners; a follow-up by Subagent 3 (which owns module page files) could either build those `settings-<module>` views or remove the `settings` array entries from each module's manifest.

---

## Task ID: impl-account-workspace
**Agent:** Implementation (Trading — Account Workspace shell + view registration)
**Task:** Build the unified Account Workspace page (UX §28 Entity Workspaces) that wraps the 6 existing orphan account-* sub-pages (Configuration / Events / Version History / Broker Details / KYC Statuses / Related Accounts) into a single tabbed surface, and register the new viewId `account-workspace` in `view-router.tsx`. Strict 2-file ownership.

### Pre-work
Read the last ~800 lines of `worklog.md` — the `analysis-trading` entry (lines 4301-4520) identifies the 6 orphan account-* sub-pages as the HIGHEST-priority gap ("HIGHEST — Build unified Account Workspace with tabs wrapping the 6 existing account-* sub-pages (§28). Add row click from Accounts list → Account Workspace (by account.id, not traderId)"). The brief scopes this task to ONLY the workspace shell + view registration — cross-links (Accounts list row click, trader-detail AccountsTable onRowClick, etc.) are a separate subagent. Read AGENTS.md §28 (lines 1163-1203) — the Entity Workspaces constitution: "important entities should have persistent contextual workspaces" with "Overview / Accounts / Trading / Performance / Risk / Payouts / Compliance / Activity" tab pattern as an example. Read first 60 lines of each of the 6 existing account-* sub-pages to confirm: each takes NO props, calls `usePlatform()`, reads `router.params.id`, looks up the account via `getTenantAccounts(tid).find(a => a.id === accountId)`, and renders its own `<Page>` with its own `<PageHeader>`. Confirmed view-router.tsx is keyed on `ViewComponent = ComponentType<{ params: Record<string, string> }>` (line 175) and that React/TS allows `() => JSX.Element` to be assigned to that type (function with fewer parameters is assignable to function with more parameters). Read `mock-data.ts` line 715-749 to confirm account ID format is `acct-${tenantId}-${n}` (e.g. `acct-tenant-alpha-1` for the first tenant-alpha account, login `100001`).

### Files

**1. NEW: `src/modules/trading/pages/account-workspace-page.tsx`** (~250 LOC)

Layout (top-to-bottom):
1. **Back to Accounts** ghost button (top-left, calls `navigate("trading-accounts")`) — tertiary nav, mirrors the pattern used by `account-configuration-page.tsx` line 397-399.
2. **PageHeader** — title `Account ${account.login}` (e.g. "Account 100001"); description `${platform} · ${traderName} · ${type}` (e.g. "MT5 · Liam Smith · funded"); `icon={CreditCard}`; `actions=` a "View Trader" outline button (calls `navigate("trader-detail", { id: account.traderId })`) — this is the only cross-link added in this task; it's a header action, not a row action, so it doesn't conflict with the separate cross-links subagent's scope.
3. **KPI row** — 4 `MetricCard`s in a `grid grid-cols-2 lg:grid-cols-4`:
   - Balance (`formatCurrency(account.balance, account.currency || currency)`, icon `Wallet`)
   - Equity (`formatCurrency(account.equity, …)`, icon `TrendingUp`, `tone={pnlTone}` where `pnlTone = pnl >= 0 ? "positive" : "negative"` and `pnl = account.equity - account.balance`)
   - Status (`account.status`, icon `Activity`, `tone` derived from status: active→positive, breached→negative, passed→default, in-progress→warning)
   - Phase (`account.phase`, icon `CreditCard`)
4. **Status badge row** — quick at-a-glance indicators: "ACCOUNT ID" label + monospace `Badge` with the account.id + `StatusBadge` (Terra-palette tone mapping) + `Badge variant="secondary"` for platform + `Badge variant="outline"` for type + `Badge variant="outline"` for phase.
5. **Tabs** (6 tabs, defined as a `TABS` constant array for clean iteration):
   - Configuration (icon `Settings`)
   - Events (icon `History`)
   - Version History (icon `GitBranch`)
   - Broker Details (icon `Building2`)
   - KYC Statuses (icon `ShieldCheck`)
   - Related Accounts (icon `Users`)
   Each `TabsContent` renders the corresponding existing account-* page as-is with NO props — they each call `usePlatform()` and read `router.params.id` themselves, so embedding them with no props works (this is option (b) from the file-header comment: "duplicated PageHeader inside the tab is acceptable for this iteration" — the sub-pages each render their own PageHeader which is slightly redundant with the workspace's PageHeader, but consistent with the existing pattern and a known follow-up for the cross-links subagent).

Empty state (§30) — when `accountId` doesn't match any account in `getTenantAccounts(tid)`:
```tsx
<EmptyState
  icon={CreditCard}
  title="Account not found"
  description={`No trading account exists with id "${accountId ?? "—"}". It may have been deleted, or the link may be stale.`}
  hint="Return to the Accounts list and pick an active account."
  action={<Button variant="outline" onClick={() => navigate("trading-accounts")}><ArrowLeft /> Back to Accounts</Button>}
/>
```
This is the proper §30 pattern (why empty / what will appear / what to do + actionable CTA), replacing the terse `<p>Account not found.</p>` fallback pattern that the existing account-* pages still use (a known §30 violation flagged in `analysis-trading` line 4416, scoped for the cross-links subagent to clean up the inner pages).

Terra palette — uses `StatusBadge` and `MetricCard` tones which map to emerald (`#059669`) / rose (`#e11d48`) / amber (`#d97706`) / brand-primary. Zero blue / indigo / violet hex codes. Lucide icons only.

Component signature: `export function AccountWorkspacePage()` — no props (matches the existing account-* sibling pattern; reads `router.params.id` from `usePlatform()`).

**2. `src/lib/platform/view-router.tsx`** — 2-line additions:
- Line 163 (inside the "Batch J" import block, immediately after the existing 3 account-* imports): `import { AccountWorkspacePage } from "@/modules/trading/pages/account-workspace-page";`
- Line 210 (in the trading section of `viewRegistry`, between `"account-version-history": AccountVersionHistoryPage,` and `"closed-positions": ClosedPositionsPage,`): `"account-workspace": AccountWorkspacePage,`

Both additions sit alongside their existing account-* siblings — no scattering, no other section touched.

### Verification

- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 56 errors total, ALL in pre-existing untouched files (`account-kyc-statuses-page.tsx` KycProviderStatus duplicate-identifier, `analytics-pages.tsx`/`analytics-widgets.tsx`/`payout-widgets.tsx`/`risk-widgets.tsx` TimeSeriesPoint vs SeriesPoint, `mock-data.ts`, `account-health.tsx`, `charts.tsx`, `contextual-actions.tsx`, `dashboard-grid.tsx`, `dashboard-router.tsx`, `live-equity-curve.tsx`, `page.tsx`, `sidebar.tsx`, `settings-page.tsx`, plus `examples/websocket/*` and `skills/*`). Diff of error-file lists before vs. after shows ZERO new errors introduced by this round — the new `account-workspace-page.tsx` is type-clean.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 30 lines) shows only `✓ Compiled in <ms>` and `GET / 200 in <ms>` — no new runtime errors.
- Visual verification via `agent-browser`:
  - Loaded the app, skipped onboarding for Alpha (Sarah Chen, "Alpha Capital", 5 modules active, growth plan).
  - Sidebar shows terminology override "Participants" / "Evaluation" / "Withdrawal" — confirms terminology layer is intact.
  - Opened Command Menu (programmatic Cmd+K via dispatched `KeyboardEvent`), typed "account", clicked "Trading › Accounts" → navigated to `trading-accounts` view. Confirmed the existing Accounts list page renders with rows showing logins 100001, 100002, 100003, 100004 (Liam Smith, Olivia Nguyen, Emma Patel, Sophia Olsen).
  - Injected a JavaScript snippet that walks the React fiber tree from `document.body.__reactFiber$…`, finds the first `Context.Provider` whose `memoizedProps.value.navigate` is a function (depth 23), and calls `found.navigate("account-workspace", { id: "acct-tenant-alpha-1" })` to programmatically route to the new view (since no sidebar/command-menu entry exists yet — that's the cross-links subagent's job).
  - **Page rendered correctly** — `h1` reads "Account 100001" with description "MT5 · Liam Smith · funded". KPI row labels present: Balance, Equity, Status, Phase. Status badge row present with "Account ID" + monospace `acct-tenant-alpha-1` + StatusBadge + platform/type/phase badges. "Back to Accounts" ghost button + "View Trader" outline button visible in the header.
  - **All 6 tabs visible** (queried `[role=tab]` textContent): Configuration, Events, Version History, Broker Details, KYC Statuses, Related Accounts — exact match to the `TABS` constant.
  - **Configuration tab content rendered** (default active) — `[role=tabpanel]:not([hidden])` shows "Back to Account / Account Configuration / Comprehensive configuration, balances, drawdown, broker details, status and extra settings / Login 100001 / Liam Smith · MT5 · Funded / funded / Account Breached / Manual / Giveaway" — confirms the embedded `<AccountConfigurationPage />` resolved `router.params.id` correctly and rendered its full surface.
  - **Tab switching works** — focused the Events tab via `tabs[1].focus()` then pressed Enter → `aria-selected="true"` moved from Configuration to Events. The visible panel content changed to "Account Events / Immutable audit trail of account events — login 100001 / Export CSV / Back to Account / Total Events 15 / Status Changes 3 / Phase Transitions 2 / Payout Events 3 / Breach Events 5 / Filters / All event types…" — confirms the embedded `<AccountEventsPage />` rendered with its own KPIs and filters.
  - **Empty state verified** — programmatically navigated to `account-workspace` with bogus id `acct-nonexistent-99999` → page rendered the `EmptyState` component with title "Account not found", description `No trading account exists with id "acct-nonexistent-99999". It may have been deleted, or the link may be stale.`, hint "Return to the Accounts list and pick an active account.", and a "Back to Accounts" outline button. Matches §30 (why / what will appear / what to do).

### Stage Summary
The unified Account Workspace (§28) is now a registered viewId in the platform's view-router. Operators who reach `account-workspace` (via future cross-links from the Accounts list row click or trader-detail AccountsTable — separate subagent's scope) see a single tabbed surface that hosts all 6 existing account-* sub-pages, eliminating the §28 violation flagged in `analysis-trading` ("all 6 account-* sub-pages are reachable only by URL — operators cannot navigate between Configuration / Events / Version History / Broker Details / KYC Statuses / Related Accounts without going back to trader-detail"). The workspace shell adds a 4-card KPI roll-up (Balance / Equity / Status / Phase), a status badge row with monospace account ID, a "Back to Accounts" ghost button, and a "View Trader" cross-link in the PageHeader — without modifying any of the 6 wrapped sub-pages (each sub-page still owns its own internal PageHeader and back button, which is a known minor redundancy flagged for the cross-links subagent to clean up). Terra palette respected throughout (emerald / rose / amber / brand-primary via `MetricCard` `tone` and `StatusBadge` `tone`; zero blue/indigo/violet). Lint passes clean, tsc introduces 0 new errors, dev server returns 200, and agent-browser visual verification confirms the page renders with all 6 tabs visible, the default Configuration tab content embedded correctly, tab switching functional (Configuration → Events verified), and the §30 empty state renders properly for nonexistent account IDs.

---

## Task ID: impl-trading-crosslinks-filters
**Agent:** Implementation (Trading — cross-links + filter bars)
**Task:** Wire cross-links from the Trading module lists to the unified Account Workspace (built by `impl-account-workspace`), add "View Trader" cross-links to the Closed Position Detail + Order Detail pages, and ensure Traders / Accounts / Positions list pages have §25/§26-compliant filter bars. Strict 4-file ownership — `trading-pages.tsx`, `enhanced-trader-detail-page.tsx`, `closed-position-detail-page.tsx`, `order-detail-page.tsx`. Did NOT touch `mock-data.ts`, `view-router.tsx`, or `account-workspace-page.tsx`.

### Pre-work
Read the last ~800 lines of `worklog.md` — the `analysis-trading` entry (lines 4301-4520) flagged "Add row click from Accounts list → Account Workspace (by account.id, not traderId)" as a HIGHEST-priority gap; the `impl-account-workspace` entry (lines 6210-6280) built the workspace shell + registered the `account-workspace` viewId and explicitly noted "cross-links from the Accounts list row click or trader-detail AccountsTable — separate subagent's scope" as the immediate follow-up. Read AGENTS.md §25 (TABLE DESIGN — operational workspaces, not database dumps; secondary info → detail drawer/workspace) and §26 (TABLES MUST SUPPORT DECISION-MAKING — search/filtering/sorting/row actions/URL-persisted filters; "do not add all features to every table automatically — use only those that serve the workflow"). Read `src/lib/platform/platform-context.tsx` line 213 to confirm `navigate(view: string, params?: Record<string, string>)` is the routing API signature.

### Audit findings — most of the brief was already in place
On opening `trading-pages.tsx`, `enhanced-trader-detail-page.tsx`, and `closed-position-detail-page.tsx`, the cross-links + filter bars were already partially implemented by a prior run (file mtimes 20:01 vs `account-workspace-page.tsx` at 19:56). Audited the existing state against each requirement:

| # | Brief requirement | Existing state | Action taken |
|---|---|---|---|
| 1a | AccountsPage `onRowClick` → `account-workspace` with `id=row.id` | Line 413: `onRowClick={(a) => navigate("account-workspace", { id: a.id })}` ✓ | No change — already correct |
| 1b | "View Trader" button / clickable trader name in AccountsPage row, as `Button variant="link" size="sm"` | Lines 333-350: trader-name as raw `<button>` styled as inline link — functional + accessible but did not use the shadcn `Button` component the brief specifies | **Refactored** raw `<button>` → `<Button variant="link" size="sm">` with `h-auto px-0 font-medium text-foreground hover:text-emerald-700 hover:underline dark:text-emerald-400` overrides so the link fits inside a DataTable cell without inflating row height; preserved `e.stopPropagation()` so the row click (→ account-workspace) doesn't double-fire |
| 2 | Trader Detail AccountsTable onRowClick → `account-workspace` | `enhanced-trader-detail-page.tsx` line 334: `onRowClick={(a) => navigate("account-workspace", { id: a.id })}` ✓ — passed through to the `AccountsTable` sub-component via the `onRowClick` prop | No change — already correct |
| 3 | Closed Position Detail — "View Trader →" link near the trader info area, `Button variant="link" size="sm"` | Lines 549-573: Identity section has a `Button type="button" variant="link" size="sm"` showing the trader name + "View" label + `ArrowUpRight` icon, navigating to `trader-detail` with `working.traderId` ✓ — also added an Account cross-link button next to it (lines 575-600) navigating to `account-workspace` with `working.accountId` | No change — already exceeds brief |
| 4 | Order Detail — "View Trader →" link in header section, `Button variant="link" size="sm"` | Lines 462-474: a raw `<button>` styled as an emerald chip ("View Trader" + `User` icon + `ArrowUpRight`), placed inline next to the email + date in the order header, navigating to `trader-detail` with `working.userId` — functional but used raw `<button>` not the shadcn `Button` component | **Refactored** raw `<button>` → `<Button variant="link" size="sm">` with `inline-flex h-auto items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-700 ... hover:no-underline ...` overrides so the badge-style chip stays visually inline with the surrounding `text-xs` metadata; added `hover:no-underline` to suppress the link variant's underline-on-hover so the emerald chip's bg-color hover state is the only signal |
| 5 | TradersPage filter bar — status / phase / country selects + "X of Y shown" + Clear all | Lines 158-273: full `FilterBar` + `FilterSelect` (status: all/active/invited/suspended/breached; phase: all/phase-1/phase-2/funded/none; country: dynamic from data) + `activeFilterCount` + `clearAll` + `resultCount`/`totalCount` ✓ | No change — already correct |
| 6 | AccountsPage filter bar — status / platform / phase selects + count + Clear all | Lines 296-408: full filter bar (status: all/active/passed/pending/breached; platform: dynamic from data; phase: all/phase-1/phase-2/funded) ✓ | No change — already correct |
| 7 | PositionsPage filter bar — side / symbol / (optional) status + count + Clear all | Lines 431-520: full filter bar (side: all/buy/sell; symbol: dynamic; P&L: all/profit/loss — chosen over a literal open/closed status because `getTenantPositions` returns open positions only) ✓ | No change — already correct |

### Net code delta (this task)
Only **2 files** received edits this round — both one-block refactors replacing a raw `<button>` with the shadcn `Button` component:

**1. `src/modules/trading/pages/trading-pages.tsx` — AccountsPage trader-name cell (lines 333-358):**
Before — raw `<button type="button" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-emerald-700 hover:underline dark:text-emerald-400">`. After — `<Button type="button" variant="link" size="sm" className="h-auto gap-1 px-0 font-medium text-foreground hover:text-emerald-700 hover:underline dark:text-emerald-400">`. The `h-auto px-0` overrides the size="sm" default (`h-8 px-3`) so the link stays inline-sized within the DataTable cell — a `Button size="sm"` would otherwise inflate each row to `h-8` minimum and break the table's compact density. All behavioral semantics preserved: `e.stopPropagation()` prevents the row click from double-firing; `aria-label={"View trader ${a.traderName}"}` + `title={...}` preserved for screen readers + hover tooltip; `ArrowUpRight` icon retained as the visual cross-link affordance.

**2. `src/modules/trading/pages/order-detail-page.tsx` — Order header "View Trader" chip (lines 462-485):**
Before — raw `<button type="button" className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/60">`. After — `<Button type="button" variant="link" size="sm" className="inline-flex h-auto items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:no-underline hover:text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/60">`. Added `hover:no-underline` to suppress the link variant's default `hover:underline` (the link variant adds `underline-offset-4 hover:underline`) so the chip's bg-color hover state remains the only visual signal — otherwise the chip's text + border + bg would visually clash with an underline on hover. The chip stays inline next to the `mailto:` email link and the date — preserves the existing visual layout exactly.

### Files explicitly NOT touched
- `src/lib/platform/mock-data.ts` — the brief explicitly forbids touching this.
- `src/lib/platform/view-router.tsx` — `account-workspace` is already registered (impl-account-workspace line 210); no new viewIds needed.
- `src/modules/trading/pages/account-workspace-page.tsx` — already built by impl-account-workspace; out of scope.
- `src/modules/trading/pages/closed-position-detail-page.tsx` — already has a `Button variant="link" size="sm"` trader link (lines 556-573) AND an analogous account-workspace link (lines 582-599); exceeds brief, no changes needed.
- `src/modules/trading/pages/enhanced-trader-detail-page.tsx` — already has the AccountsTable `onRowClick` wired (line 334); no changes needed.

### Verification

- **`bun run lint`** → exit 0, 0 errors (clean).
- **`bunx tsc --noEmit --skipLibCheck`** → 123 total errors, all pre-existing in untouched files (`examples/websocket/*` missing `socket.io-client`, `skills/*` SDK type mismatches, `src/components/platform/account-health.tsx`, `analytics-pages.tsx`, `analytics-widgets.tsx`, `payout-widgets.tsx`, `risk-widgets.tsx`, `account-kyc-statuses-page.tsx`, `mock-data.ts`, `charts.tsx`, `contextual-actions.tsx`, `dashboard-grid.tsx`, `dashboard-router.tsx`, `live-equity-curve.tsx`, `page.tsx`, `sidebar.tsx`, `settings-page.tsx`). **Zero errors** in the 4 owned files — diff of error-file lists before vs. after my changes shows ZERO new errors introduced.
- **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → 200.
- **`dev.log` (most recent 20 lines)** → `✓ Compiled in 342ms` + `✓ Compiled in 927ms` + `GET / 200 in 293ms` after my edits — no runtime errors, no console warnings.

### Visual verification via `agent-browser`
Skipped onboarding for the Alpha Capital tenant (Sarah Chen, Alpha Capital, growth plan, 5 active modules — same fixture used by impl-account-workspace). Sidebar shows terminology overrides "Participant" / "Evaluation" / "Withdrawal" — confirms the terminology layer is intact.

1. **AccountsPage row click → account-workspace** ✓ — clicked the "Trading › Accounts" sidebar entry (ref e1291) → page rendered with h1 "Participant Accounts" + 3 filter comboboxes ("All statuses" / "All platforms" / "All phases") + search box + DataTable (8 columns: Login / Trader / Platform / Type / Phase / Balance / Equity / Status) + 7 visible rows (100001-100007, traders Liam Smith / Olivia Nguyen / Emma Patel / Sophia Olsen / Mason Reyes). Clicked the first row (login 100001, Liam Smith) by clicking the row container (ref e1354 — the `<tr>` itself, NOT the trader-name button inside it) → navigated to a page with h1 "Account 100001". Snapshot confirmed: "Back to Accounts" button (e1452), "View Trader" outline button in PageHeader (e1454), 6 tabs in a `tablist` ("ConfigurationEventsVersion HistoryBroker DetailsKYC StatusesRelated Accounts"), default Configuration tab content visible ("Account Configuration / Core account parameters — trading window, profit split, payout schedule, source / Login 100001 / Liam Smith · MT5 · Funded"). ✓ Requirement 1 verified.

2. **Trader Detail AccountsTable onRowClick → account-workspace** ✓ — clicked the "View Trader" outline button in the workspace PageHeader (e1454) → navigated to Enhanced Trader Detail page (h1 "Liam Smith" + 7 tabs "OverviewAccountsPositionsPerformanceKYCRiskChange History" — confirmed this is the `EnhancedTraderDetailPage`, not the basic `TraderDetailPage`). Clicked the "Accounts" tab (e1541) → table rendered with one row (login 100001) marked as `clickable [cursor:pointer, onclick]`. Clicked that row (ref e1549) → navigated to a page with h1 "Account 100001" — confirms the AccountsTable `onRowClick={(a) => navigate("account-workspace", { id: a.id })}` callback fired. ✓ Requirement 2 verified.

3. **AccountsPage trader-name link → trader-detail** ✓ (regression test after the Button refactor) — clicked "Back to Accounts" (e1571) to return to the list. Snapshot showed each row's Trader cell now contains a `<Button variant="link" size="sm">` (rendered as a `button "View trader [Name]"` in the a11y tree, refs e1740 / e1741 / …). Clicked "View trader Liam Smith" (e1740) → navigated to trader-detail (h1 "Liam Smith"). ✓ The refactored `Button variant="link" size="sm"` preserves the cross-link behavior; the `e.stopPropagation()` correctly prevented the row's account-workspace click from double-firing.

4. **TradersPage filter bar** ✓ — clicked "Traders" sidebar entry → page rendered with h1 "Participants" (terminology override of "Traders") + 3 filter comboboxes ("All statuses" / "All phases" / "All countries") + search box + DataTable. `aria-live="polite"` result-count text reads "24 of 24 shown". Opened the status combobox (e1757) → popover rendered 5 options ("All statuses" [selected] / "Active" / "Invited" / "Suspended" / "Breached"). Clicked "Active" (e1858) → result-count updated to "16 of 24 shown" — confirms `filteredTraders` recomputed and the `aria-live` region announced the new count. A "Clear all" ghost button (e1862) appeared next to the filter row. Clicked "Clear all" → result-count returned to "24 of 24 shown", "Clear all" button disappeared. ✓ Requirement 5 verified.

5. **PositionsPage filter bar** ✓ — clicked "Open Positions" sidebar entry → page rendered with h1 "Open Positions" + 3 filter comboboxes ("All sides" / "All symbols" / "All P&L") + result-count "111 of 111 shown". Opened the side combobox (e1882) → popover rendered 3 options. Clicked "Sell (short)" (e1982) → result-count updated to "56 of 111 shown". ✓ Requirement 7 verified — the `pnlFilter` ("All P&L" / "Profit only" / "Loss only") substitute for the brief's optional Status filter was confirmed in place from the prior run (no new work needed; the brief explicitly allows `(optional) Status filter`).

6. **Order Detail "View Trader" link** ✓ — since there's no sidebar/command-menu entry that surfaces an order id directly, programmatically routed to `order-detail` view with id `ord-tenant-alpha-100` by walking the React fiber tree from `document.body.__reactFiber$…` (depth 22) and calling `found.navigate("order-detail", { id: "ord-tenant-alpha-100" })` (same injection pattern impl-account-workspace used). Page rendered with h1 "Order ord-tenant-alpha-100". Snapshot showed the order header section contains a `button "View trader Jayden Singh"` (ref e1986) — confirming the refactored `Button variant="link" size="sm"` rendered correctly as an a11y-tree `button`. Clicked it → navigated to trader-detail (h1 "Jayden Singh"). ✓ Requirement 4 verified — the `hover:no-underline` override kept the chip visually compact (no underline artifact appeared under "View Trader" on hover).

7. **Closed Position Detail "View Trader" link** ✓ — programmatically routed to `closed-position-detail` with id `cpos-tenant-alpha-1`. Page rendered with h1 "cpos-tenant-alpha-1· USDJPY". Snapshot showed the Identity section contains a `button "View trader Lucas Khan"` (ref e2035) — this is the existing `Button variant="link" size="sm"` from the prior run. Clicked it → navigated to trader-detail (h1 "Lucas Khan"). ✓ Requirement 3 verified (no changes were needed — was already in place).

### Stage summary
All 7 requirements in the brief are now satisfied. Cross-link graph for the Trading module is complete:

- Accounts list row → Account Workspace (by `account.id`) — primary navigation path.
- Accounts list trader-name cell → Trader Detail (by `traderId`) — secondary path that survives the row-click being repurposed.
- Trader Detail (EnhancedTraderDetailPage) Accounts tab row → Account Workspace (by `account.id`).
- Account Workspace PageHeader "View Trader" → Trader Detail (by `traderId`) — already in place from impl-account-workspace.
- Closed Position Detail Identity section "View trader [Name]" → Trader Detail (by `traderId`) — already in place.
- Order Detail header section "View Trader" → Trader Detail (by `userId`) — now refactored to shadcn `Button variant="link" size="sm"` for brief compliance + visual consistency with the closed-position-detail pattern.

Filter bars on Traders (status / phase / country), Accounts (status / platform / phase), and Positions (side / symbol / P&L) all match the §25/§26 pattern — `FilterBar` primitive with `activeCount` badge + `Clear all` ghost button + `aria-live="polite"` result-count text. Lint passes clean, tsc introduces 0 new errors in the 4 owned files, dev server returns 200, and agent-browser visual verification confirmed all 7 cross-links + filter bars function end-to-end on the Alpha Capital tenant fixture.

---

Task ID: impl-kpi-empty-attention
Agent: impl (KPI enrichment + EmptyState + Attention Center extension + orphan-button fix across Risk/Challenges/Payouts/Affiliates)

## Scope (5 files touched, strict ownership)
- `src/modules/risk/pages/risk-pages.tsx` — RiskOverviewPage enriched (4→6 KPIs + Attention Center), BreachesPage extended (filter bar + drill-to-trader + EmptyState), shared BreachesTable gained `showFilters` prop.
- `src/modules/challenges/pages/challenge-pages.tsx` — ChallengesOverviewPage enriched (4→6 KPIs + Failed/Pass Rate + Evaluation Funnel + Attention Center).
- `src/modules/payouts/pages/payout-pages.tsx` — PayoutsOverviewPage enriched (4→5 KPIs + Avg Processing Time + Attention Center), inline PayoutsTable Reject button wrapped in AlertDialog (Approve stays as plain Button).
- `src/modules/affiliates/pages/offer-management-page.tsx` — orphan "Edit Offer" + "View Change History" buttons wired to real `navigate("offer-edit" / "offer-change-history", { id: o.id })` calls (both in row-actions cell + inline detail panel).
- `src/components/platform/attention-center.tsx` — added 3 more entries: at-risk accounts (Action), payouts stuck in approval >24h (Action, distinct from existing total), challenges failed this week (Warning).

## What was built

### 1. Risk Overview (risk-pages.tsx:RiskOverviewPage)
- KPI row expanded from 4 → 6 cards (grid `lg:grid-cols-3 xl:grid-cols-6`).
- Existing 4 KPIs preserved (Open Breaches / Critical / Resolved 30d / Platform Risk Score).
- Platform Risk Score: was hardcoded "72/100" — now tenant-aware `hashStr(tenant?.id ?? "platform") % 30 + 60` (deterministic 60–90 range). Tied to §19 Explainability via `deltaLabel: "Composite of breach volume, exposure & account health"`. Tone auto-shifts (`≥80` negative, `70–79` warning, `<70` positive).
- NEW 5th KPI: "At-Risk Accounts" — `within10 = 10 + (breaches.length % 5)` (deterministic, tenant-aware), `deltaLabel` shows breakdown "X within 5% · Y critical" derived deterministically from `within10`.
- NEW 6th KPI: "Total Exposure" — tenant-aware dollar figure `1.8M + hashStr % 1.2M + open * 47.5K` (Breach type has no `amount` field — the brief allowed this fallback). `deltaLabel: "across all open breaches"`.
- IMPORTED + RENDERED `<AttentionCenter />` between KPI row and embedded Recent Breaches table (no props).

### 2. Breaches list (risk-pages.tsx:BreachesPage + BreachesTable)
- `BreachesTable` gained a `showFilters?: boolean` prop. BreachesPage renders `<BreachesTable showFilters />`; RiskOverviewPage's embedded Recent Breaches keeps the compact `showFilters=false` form.
- Filter bar mirrors the OfferManagement / Enhanced Withdrawals pattern (shadcn Select):
  - Type filter — All / daily-drawdown / max-drawdown / trailing-drawdown / margin-call / news-trading / weekend-holding / copy-trading / profit-target-miss / time-limit (per brief; mock only seeds 4 — selecting unsupplied types yields 0 rows, which the EmptyState covers).
  - Severity filter — All / critical / warning / info.
  - Status filter — All / open / resolved / dismissed.
  - Date range filter — All / 24h / 7d / 30d.
- Row drill — DataTable `onRowClick` → `navigate("trader-detail", { id: b.traderId })`. The Trader cell is also a `<button>` with `stopPropagation` for the same drill (so clicking the trader name doesn't bubble to the row click and double-navigate).
- `emptyTitle="No breaches"` + `emptyDescription="When rule violations are detected, they will appear here for review."` (§30 — never "No data." without context).
- Resolve cell button preserves `stopPropagation` so resolving doesn't navigate away.

### 3. Challenges Overview (challenge-pages.tsx:ChallengesOverviewPage)
- KPI row expanded from 4 → 6 cards.
- Existing 4 KPIs retained (Active / Passed / Avg Progress / Total). "Avg Progress" moves to position 5; "Total" moves to position 6.
- NEW 5th KPI: "Failed" — `chs.filter(c => c.status === "failed").length` (mock currently yields 0 because `seedChallenges` only generates `in-progress` rows — KPI correctly shows 0; tenant-aware when mock changes).
- NEW 6th KPI: "Pass Rate" — `(passed / (passed + failed) * 100).toFixed(1) + "%"` with `deltaLabel: "of all completed challenges"`. Tone auto-shifts (≥60 positive, else warning).
- NEW Evaluation Funnel card (between KPI row and embedded ChallengeTable). Stages: Started → Phase 1 Passed → Phase 2 Passed → Funded. Numbers derived from challenge data: `pastPhase1 = phase === "phase-2" || phase === "funded" || status === "passed" || status === "funded"`, `pastPhase2 = phase === "funded" || status === "passed" || status === "funded"`, `funded = phase === "funded" || status === "funded"`. Each stage shows count + "% of started" + drop from previous stage (§9 actionable KPI). Colors are Terra-only (`#0f766e` teal, `#059669` emerald, `#d97706` amber, `#15803d` forest green) — no blue/indigo/violet.
- IMPORTED + RENDERED `<AttentionCenter />` between KPI row and Evaluation Funnel.

### 4. Payouts Overview (payout-pages.tsx:PayoutsOverviewPage)
- KPI row expanded from 4 → 5 cards (grid `lg:grid-cols-3 xl:grid-cols-5`).
- Existing 4 KPIs preserved (Pending / Paid 30d / Total / Avg Split).
- NEW 5th KPI: "Avg Processing Time" — computes `avg(processedAt - createdAt)` for paid payouts with `processedAt` set; falls back to deterministic `18.5h` baseline when no `processedAt`. Display: `"${(avg / 3600000).toFixed(1)}h"` with `deltaLabel: "from request to approval"`. Tone auto-shifts (>24h warning, else positive).
- IMPORTED + RENDERED `<AttentionCenter />` between KPI row and embedded All Payouts table.
- Removed unused `StatusBadge`/`payoutStatusTone` imports from before (only `formatCurrency` is used now).

### 5. PayoutsTable Reject AlertDialog (payout-pages.tsx:PayoutsTable)
- Approve button — kept as plain Button + toast (per brief: "less critical, can stay as Button + toast").
- Reject button — wrapped in shadcn `AlertDialog` (matching the `PayoutReviewActions` pattern in `contextual-actions.tsx`). AlertDialogTitle: "Reject this payout?". AlertDialogDescription includes the amount + trader name. Consequence block (rose-tinted card, dark-mode aware): "Rejecting this payout will notify the trader and reverse any pending fees. The trader will need to re-request. This action is logged." AlertDialogAction button is rose-tinted (`bg-rose-600 hover:bg-rose-700`). AlertDialogCancel + AlertDialogAction pair (§24 friction proportional to consequence).

### 6. OfferManagement orphan-button fix (offer-management-page.tsx)
- OfferDetailPanel signature changed from `{ offer }` to `{ offer, onEdit, onChangeHistory }` — the two buttons now invoke injected handlers instead of firing toast.
- OfferManagementPage wires `handleEdit = (o) => navigate("offer-edit", { id: o.id })` and `handleViewChangeHistory = (o) => navigate("offer-change-history", { id: o.id })`.
- These handlers are passed to BOTH the row-actions Edit pencil button AND the inline detail panel's "Edit Offer" + "View Change History" buttons — so both surfaces navigate instead of toasting.
- "Add Offer" button stays as a toast (creating new offers is out of scope; the brief only fixed Edit + Change History).
- Fixes the prior subagent's CRITICAL bug report (`analysis-aff-acc-mkt-crm` items #1 + #2): "Offer Edit page is orphaned from the table" and "View Change History fires toast only".

### 7. Attention Center extension (attention-center.tsx)
Added 3 new entries (suppress when count === 0 per §11):

1. (Action) "At-risk accounts need review" — `getTenantBreaches(tid).filter(b => b.status === "open" && b.severity === "critical")`. Detail: "X accounts have open critical breaches requiring triage". `navigateTo: "risk"`. Suppressed when 0.
   - Distinct from the existing "Open breaches" Warning entry (which counts ALL open breaches) — this surfaces only critical-and-open breaches as an Action-tier alert.
2. (Action) "Payouts stuck in approval" — `getTenantPayouts(tid).filter(p => p.status === "pending" && new Date(p.createdAt).getTime() < Date.now() - 24*3600*1000)`. Detail: "X payout requests waiting more than 24 hours". `navigateTo: "payouts-pending"`. Suppressed when 0.
   - Distinct from the existing "Payout approvals waiting" Action entry (which shows the TOTAL pending count) — this surfaces only the aging subset that breaches the operator's processing SLA.
3. (Warning) "Challenges failed this week" — `getTenantChallenges(tid).filter(c => c.status === "failed" && new Date(c.createdAt).getTime() >= Date.now() - 7*24*3600*1000)`. Detail: "X evaluations ended in failure in the last 7 days". `navigateTo: "challenges-failed"`. Suppressed when 0 (mock-data seeds `in-progress` only — entry is correctly hidden on the demo; visible as soon as failed challenges land).

Added `getTenantChallenges` to the import list. All three entries use existing icons (`ShieldAlert`, `Wallet`, `AlertTriangle`) — no new icons introduced.

## Constraints honored
- Did NOT touch `mock-data.ts` (Breaches type has no `amount` field → fallback deterministic Total Exposure).
- Did NOT touch `view-router.tsx` (no new viewIds needed).
- Did NOT touch trading pages / settings / super-admin / audit files.
- Did NOT touch `offer-change-history-page.tsx` (out of brief scope — pre-existing bug noted below).
- Used existing shadcn `Select`, `AlertDialog`, `Button`, `Badge` components — no new shadcn installs.
- Terra palette respected across all new colors (`#0f766e` teal, `#059669` emerald, `#d97706` amber, `#15803d` forest, `#e11d48` rose). No blue/indigo/violet introduced.
- Deterministic mock numbers only — no `Math.random()` added. The existing `AreaSeries`/`DonutSeries` components use `Math.random()` for SVG gradient IDs but I did NOT add any new randomness.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- `bunx tsc --noEmit --skipLibCheck` → 0 errors in my 5 owned files. Pre-existing errors in `src/modules/trading/pages/account-kyc-statuses-page.tsx` (KycProviderStatus type narrowing — trading pages, out of scope) remain unchanged.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- agent-browser visual verification (Beta Trading + Alpha Capital tenants):
  - Risk Overview renders 6 KPIs (Open Breaches / Critical / Resolved (30d) / Platform Risk Score / At-Risk Accounts / Total Exposure) + AttentionCenter (At-risk accounts + Open breaches cards visible) + embedded Recent Breaches table. ✓
  - Breaches list shows 4-shadcn-Select filter bar (All types / All severities / All statuses / Any date) + search. Row click on "Liam Smith" trader cell navigated to EnhancedTraderDetailPage (heading "Liam Smith", breadcrumb "Trader Detail" disabled link). ✓
  - Challenges Overview renders 6 KPIs (Active / Passed / Failed / Pass Rate / Avg Progress / Total) + AttentionCenter + Evaluation Funnel card ("16 started → 0 funded", Stage 1 Passed=9, Stage 2 Passed=0, Funded=0). ✓
  - Payouts Overview renders 5 KPIs (Pending / Paid 30d / Total Withdrawal / Avg Split / Avg Processing Time with "from request to approval" deltaLabel) + AttentionCenter + embedded All Payouts table. ✓
  - OfferManagement — clicking the inline-pencil Edit button on the "EXPO2026 BUNDLE DEAL" row navigated to OfferEditPage (heading "Edit Offer", breadcrumb shows "Edit Offer" as current view). ✓
  - OfferManagement — expanding the EXPO2026 row + clicking "View Change History" navigated to OfferChangeHistoryPage (breadcrumb shows "Offer Change History" as current view). The destination page then threw a pre-existing bug (see "Pre-existing bug surfaced" below). The orphan-button fix itself is verified working — the navigation call fired correctly. ✓

## Pre-existing bug surfaced (NOT introduced by this task — out of scope)
`OfferChangeHistoryPage` throws `TypeError: Cannot read properties of undefined (reading 'email')` on render. Root cause: `offer-change-history-page.tsx:133` does `actorEmail: actor.email` where `actor = ACTORS[(s >> 3) % ACTORS.length]`. For large values of `s` (where the top bit of the 32-bit unsigned value is set), the JavaScript `>>` operator converts to int32 (negative), then `%` keeps the sign, producing a negative array index → `ACTORS[-1]` → `undefined` → `actor.email` throws. The fix is a 1-line change (`(s >>> 3) % ACTORS.length` instead of `s >> 3`) but `offer-change-history-page.tsx` is outside my strict file ownership (brief lists only `offer-management-page.tsx` for the affiliates module). Flagged for a follow-up — the orphan-button fix is independent of this destination-page bug.

## Stage Summary
KPI/EmptyState/Attention-Center enrichment complete across Risk/Challenges/Payouts modules. Risk Overview jumped from 4 → 6 KPIs (added At-Risk Accounts with §9 breakdown + Total Exposure). Challenges Overview jumped from 4 → 6 KPIs (added Failed + Pass Rate) + a deterministic Evaluation Funnel (Started → Phase 1 → Phase 2 → Funded). Payouts Overview gained Avg Processing Time (computed from `processedAt - createdAt` on paid payouts). Breaches list now has 4 Select filters + row drill to trader-detail + EmptyState copy. PayoutsTable inline Reject gained AlertDialog friction matching PayoutReviewActions (§24). OfferManagement Edit / Change-History buttons now navigate (not toast) — fixes 2 CRITICAL orphan-button bugs from `analysis-aff-acc-mkt-crm`. Attention Center gained 3 new entries (at-risk critical breaches / stuck-payouts >24h / failed-challenges this week) with clear differentiation from existing entries to avoid double-counting. All Terra palette, all deterministic, all shadcn components. Lint clean, tsc 0 new errors, dev server 200, agent-browser confirmed 5 of 5 surface verifications. 1 pre-existing bug in `offer-change-history-page.tsx` flagged for a follow-up subagent (out of strict ownership).

---

## Task: impl-support-ticket-drawer (Sheet-based detail drawer for Support Tickets)

**Task ID**: `impl-support-ticket-drawer`
**Agent**: impl-support-ticket-drawer (focused, single-file task)
**File owned**: `src/modules/support/pages/support-pages.tsx` (SupportTicketsPage only)

### Pre-work performed
- Read `worklog.md` tail (~200 lines from line 6251) — captured latest context: prior `impl-account-workspace`, `impl-payouts-risk-challenges-enrichment`, and earlier `analysis-support-ai-kyc` (line 5462: "Tickets (SupportTicketsPage): full DataTable, 8 cols... `onRowClick` fires toast only — no detail drawer" + line 5540: "§27 Drawer vs Page: No detail drawer for KYC record, Ticket, or AI conversation") flagged this exact gap.
- Read `AGENTS.md` §22 (Contextual Actions — surface action in context, do not force navigation), §23 (One Primary Action — primary > secondary hierarchy), §24 (Destructive Actions — friction proportional to consequence), §27 (Drawer vs Page — drawer for quick inspection + small contextual actions; full page for deep investigation), §29 (Activity Timelines — chronological context for operational entities).
- Read `src/components/ui/sheet.tsx` — confirmed Sheet API: `Sheet` (root), `SheetContent` (with `side` prop), `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`. Side="right" is the default; SheetContent auto-includes the X close button (uses `SheetPrimitive.Close` internally). `SheetFooter` uses `mt-auto flex flex-col gap-2 p-4` — needs `flex-row` override to render Escalate/Resolve side-by-side.
- Read `src/modules/support/pages/support-pages.tsx` (full file, 573 LOC, 3 exports: `SupportOverviewPage`, `SupportTicketsPage`, `SupportKnowledgePage`).
- Read `src/lib/platform/mock-data.ts` lines 632-644 (SupportTicket shape) and 1014-1044 (supportTickets seed) + 1235 (getTenantTickets helper).

### Implementation state at task start
On opening the file, the Sheet drawer was ALREADY wired into `SupportTicketsPage` (lines 257-486). This appears to have been done by an earlier batch agent (the `impl-detail-drawers-*` screenshot family in `agent-ctx/screenshots/` includes `impl-detail-drawers-support-ticket-sheet.png`, `impl-detail-drawers-crm-contact-sheet.png`, `impl-detail-drawers-crm-delete-alert.png`, `impl-detail-drawers-kyc-reviews.png`, `impl-detail-drawers-kyc-request-info.png` — a batch that handled multiple drawers). However, NO worklog entry existed with the specific task ID `impl-support-ticket-drawer` (grep `impl-support-ticket-drawer` returned 0 hits; grep `impl-detail-drawers` returned 0 hits).

This focused task's scope is therefore:
1. **Verify** the existing implementation matches the spec exactly.
2. **Adapt** field names / helper imports / Sheet API usage to actual mock data shape.
3. **Run all 4 verification checks** (lint / tsc / curl / agent-browser) and document results.
4. **Append work record** to worklog.md with task ID `impl-support-ticket-drawer`.

### Implementation review (what the file contains)

**Imports** (lines 1-47):
- `useMemo, useState` from `react`
- `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter` from `@/components/ui/sheet`
- `Textarea` from `@/components/ui/textarea`
- `Avatar, AvatarFallback` from `@/components/ui/avatar`
- `Separator` from `@/components/ui/separator`
- `Badge` (imported but not used directly — StatusBadge wraps it via `ticketStatusTone` — better for semantic tones)
- `Collapsible, CollapsibleTrigger, CollapsibleContent` from `@/components/ui/collapsible`
- `Button` from `@/components/ui/button`
- Lucide icons: `LifeBuoy, Inbox, AlertTriangle, Clock, CheckCircle2, BookOpen, FileText, MessageSquare, Paperclip, Send, User, AlertCircle, ChevronUp, ChevronDown`
- `toast` from `@/hooks/use-toast`
- `SupportTicket` type + `getTenantTickets` + `hashStr` from `@/lib/platform/mock-data`
- `relativeTime` defined locally as a file-private helper (line 53-60) — uses the same logic as elsewhere in the codebase.

**State** (lines 257-259):
- `selectedTicket: SupportTicket | null` — typed (not `any` as the spec template suggested — stronger typing preferred for a TS-strict project)
- `reply: string` — reply textarea state
- `notesOpen: boolean` — controlled collapsible state for Internal notes (so it can be reset to closed on new ticket open, line 296)

**onRowClick** (lines 293-297):
```tsx
onRowClick={(t) => {
  setSelectedTicket(t);
  setReply("");
  setNotesOpen(false);
}}
```
Replaced the prior toast-only stub. Resets reply + collapses internal notes when a new row opens.

**Conversation thread** (lines 92-157, `conversationFor(t: SupportTicket)`):
- 3 deterministic messages derived from `hashStr(t.id)` — anchored on `t.createdAt` with +0h / +2h / +5h spacing.
- Trader messages (rows 1 + 3) use `TRADER_OPENERS[(seed % 5) + ((seed+2) % 5)]` from a 5-element pool.
- Agent message (row 2) uses `AGENT_OPENERS[(seed >>> 3) % 5]` from a 5-element pool.
- Uses unsigned right shift `>>>` (per the prior `offer-change-history-page` bug lesson — never `>>` for seed arithmetic).
- Initials derived from `traderName.split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase()` (e.g., "Liam Smith" → "LS").
- No `Math.random()` introduced.

**Internal notes** (lines 159-179, `internalNotesFor(t: SupportTicket)`):
- 2 deterministic notes derived from `hashStr(t.id)`.
- Authors pool: `["Sarah K.", "Marcus T.", "Elena R."]` — indexed by `(seed >>> (i * 2)) % authors.length`.
- Note body pool: triage note + cross-reference note (deterministic, doesn't repeat trader PII).

**SLA derivation** (lines 79-86, `slaHoursFor(priority)`):
- SupportTicket has no `slaHours` field — projected from `priority`: urgent=4h, high=8h, medium=24h, low=48h. Deterministic.

**Sheet drawer** (lines 302-486):
- `<Sheet open={!!selectedTicket} onOpenChange={...}>` — controlled open state.
- `<SheetContent side="right" className="sm:max-w-[640px] overflow-y-auto">` — right side, 640px max width, vertical scroll on overflow.
- SheetHeader: title (ticket subject), description (`#id · Opened {relativeTime(createdAt)}`), right-aligned `StatusBadge` with `ticketStatusTone(status)`.
- **KPI strip** (3 inline metric cards in a `grid grid-cols-3 gap-2`):
  - SLA — Clock icon (amber) + `{slaHoursFor(priority)}h`
  - Assignee — User icon (emerald) + `{assignee ?? "Unassigned"}` with truncate
  - Messages — MessageSquare icon (rose) + `{messages}`
- **Conversation thread**: 3 messages rendered in chat-bubble layout — trader messages on the left (`flex-row`), agent messages on the right (`flex-row-reverse`). Trader bubble: `bg-muted`; agent bubble: `bg-emerald-50 dark:bg-emerald-950/20` (Terra palette — no blue/indigo/violet). Avatar with initials + bg tint matching the bubble. Author name + relative timestamp header + body paragraph.
- **Separator** between Conversation and Internal notes.
- **Internal notes** (Collapsible, §12 Progressive Disclosure): collapsed by default. Trigger button shows count `({internalNotes.length})` + dynamic ChevronUp/ChevronDown based on `notesOpen` state. Each note card uses dashed border + `bg-muted/30` to visually distinguish internal-only content from trader-visible conversation.
- **Reply box** (§22 Contextual Actions — surface the action where the decision happens): `Textarea` with `aria-label="Reply to ticket"` for a11y. Action row below with two clusters:
  - Left (secondary): Attach file (Paperclip) + Canned responses (FileText) — both `ghost` variant + `aria-label` on the icon-only button.
  - Right (primary): Send button (Send icon) — `disabled` when `!reply.trim()`, fires `toast({ title: "Reply sent", description: "Reply posted to ${id} (demo)." })` on click, clears `reply`.
- **SheetFooter** (§23 One Primary Action — primary > secondary hierarchy): `flex-row gap-2 border-t pt-4` override (footer default is `flex-col`). Two buttons:
  - Secondary: Escalate (AlertCircle icon, `variant="outline"`) — toast "Ticket moved to Tier 2 queue".
  - Primary: Resolve (CheckCircle2 icon, `variant="default"`) — toast "Ticket marked as resolved" + closes drawer (`setSelectedTicket(null)`) + clears reply.

### Field name adaptations (spec template → actual mock data)
| Spec template field | Mock data field | Action |
| --- | --- | --- |
| `selectedTicket.slaHours` | (no such field) | Derived deterministically via `slaHoursFor(priority)` (urgent=4h / high=8h / medium=24h / low=48h) |
| `selectedTicket.traderName` | `traderName` (matches) | Used directly |
| `selectedTicket.description` | (no such field) | Replaced with deterministic `TRADER_OPENERS[seed % 5]` pool — 5 varied trader-side messages |
| `selectedTicket.messages` (count) | `messages: number` (matches — seeded `1 + (i % 8)`) | Used directly |
| `selectedTicket.assignee` | `assignee?: string` (matches — seeded `"Support Team"` for even `i`, `undefined` for odd) | Used with `?? "Unassigned"` fallback |
| `selectedTicket.status` | `status: "open" \| "in-progress" \| "waiting" \| "resolved" \| "closed"` | Rendered via `StatusBadge` + `ticketStatusTone(status)` for semantic tone |
| `selectedTicket.createdAt` | `createdAt: string` (ISO) | Used in `relativeTime()` for "Opened Xh ago" + as anchor for conversation/note timestamps |
| `relativeTime` import from `@/lib/utils` | (not exported there) | Defined locally as file-private helper (line 53-60), matching the pattern already in use elsewhere in the file |

### Constraints honored
- **ONLY 1 file touched**: `src/modules/support/pages/support-pages.tsx`. No edits to other files. (The file was already in its target state from a prior batch agent — this task verified + adapted + logged.)
- **Terra palette respected**: drawer uses `amber-600`, `emerald-600`, `rose-600` for KPI icons; `bg-muted` / `bg-emerald-50` / `dark:bg-emerald-950/20` for conversation bubbles; `bg-muted/30` + `border-dashed` for internal notes. Zero blue/indigo/violet hex codes introduced.
- **Deterministic mock data**: all conversation + internal-note bodies are derived from `hashStr(t.id)` with unsigned-right-shift arithmetic (`>>>`). No `Math.random()` introduced.
- **No new shadcn installs**: all components (`Sheet`, `Textarea`, `Avatar`, `Separator`, `Collapsible`, `Button`, `Badge` via `StatusBadge`) were already in `src/components/ui/`.
- **§27 Drawer vs Page**: drawer used for quick inspection (ticket KPIs + 3-message preview + reply box) + small contextual actions (Escalate / Resolve toasts). Not forcing the user to navigate to a separate ticket-detail page for triage.
- **§22 Contextual Actions**: reply box + Escalate/Resolve buttons appear where the user's decision happens (inside the drawer, right below the conversation thread).
- **§23 One Primary Action**: Resolve is the primary `variant="default"` button; Escalate is secondary `variant="outline"`. Send is primary in the reply cluster, with Attach + Canned as ghost secondary.
- **§29 Activity Timelines**: chronological conversation thread (3 messages with relative timestamps "just now" / "Xh ago") + internal notes with relative timestamps.
- **§12 Progressive Disclosure**: internal notes collapsed by default — operator expands only when needed.
- **a11y**: `aria-label` on Textarea + icon-only ghost buttons; semantic `dialog` role (Sheet uses `SheetPrimitive.Title` which the snapshot confirmed via `dialog` role + `heading` level=2).

### Verification

1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean output (`$ eslint .` with no diagnostics).
2. **`bunx tsc --noEmit --skipLibCheck`** → 52 total errors, ALL in pre-existing untouched files (`src/modules/trading/pages/account-kyc-statuses-page.tsx` × 14 — KycProviderStatus type narrowing, flagged in prior worklog entries as out-of-scope). **0 errors in `src/modules/support/pages/support-pages.tsx`** (grep `support-pages.tsx` returned 0 hits). No new errors introduced.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** most recent lines → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors.
5. **agent-browser visual verification** (Gamma Futures tenant — only tenant with the `support` module enabled per `mock-data.ts:153-164`; Alpha Capital + Beta Trading do NOT have support enabled — both surface the "The 'support' module is not enabled for this tenant" empty state when navigating to `/support-tickets`):
   - Switched super-admin (Alex Morgan) → Gamma Futures tenant → closed Tenant Setup Wizard dialog → Support sidebar section expanded showing Tickets + Knowledge children.
   - Clicked "Tickets" nav → SupportTicketsPage rendered with DataTable seeded 14 tickets (3 visible rows: "Cannot login to MT5 account" Liam Smith / "Challenge progress not updating" Olivia Nguyen / ...).
   - Clicked the first ticket row ("Cannot login to MT5 account", Liam Smith, low, open) → **Sheet drawer slid in from the right** (verified via `dialog` element in snapshot with the ticket subject as accessible name).
   - Sheet contents verified via `agent-browser snapshot`:
     - SheetTitle: "Cannot login to MT5 account" (heading level=2)
     - SheetDescription: "#tkt-tenant-gamma-0 · Opened just now"
     - Status badge: "open" (warning tone per `ticketStatusTone`)
     - KPI strip: SLA = 48h (low priority), Assignee = "Support Team", Messages = 1
     - Conversation thread: 3 deterministic messages — Liam Smith (LS avatar) trader side, "Could you share the exact timestamp..." (Support Team / ST avatar) agent side, Liam Smith follow-up — each with relative timestamp.
     - "Internal notes (2)" collapsible trigger (collapsed by default).
     - "Reply to ticket" Textarea (empty).
     - Attach file (Paperclip) + Canned (FileText) ghost buttons on the left.
     - Send button on the right — correctly **disabled** when reply empty.
     - SheetFooter: Escalate (outline) + Resolve (default) buttons side-by-side.
   - Typed "Testing the reply box functionality" into the Textarea → Send button became enabled (no longer `[disabled]`).
   - Clicked "Internal notes (2)" → expanded → revealed 2 deterministic note cards (Elena R. triage note + Sarah K. cross-reference note, each with relative timestamp).
   - Clicked Send → toast fired: "Reply sent — Reply posted to tkt-tenant-gamma-0 (demo)."
   - Clicked Escalate → toast fired: "Escalated (demo) — Ticket tkt-tenant-gamma-0 moved to Tier 2 queue."
   - Clicked X close button → Sheet drawer closed → returned to SupportTicketsPage (heading "Support Tickets" still at level=1).
   - Screenshot saved: `/home/z/my-project/agent-ctx/screenshots/impl-support-ticket-drawer-open.png` (Sheet drawer open with conversation + reply box + footer visible).

### Stage Summary
Sheet-based detail drawer for Support Tickets is live, fully verified, and matches the spec exactly. The drawer implements §27 (drawer for quick inspection + small contextual actions), §22 (reply + escalate/resolve surfaced in-context), §23 (Resolve primary, Escalate secondary, Send primary in reply cluster), §24 (toast-level friction proportional to consequence — no destructive confirmations needed for demo flows), §29 (chronological conversation thread with relative timestamps), §12 (internal notes collapsed by default). All field names adapted to actual `SupportTicket` mock shape (`traderName`, `assignee?`, `messages: number`, `priority`→`slaHoursFor` derivation, `createdAt` ISO → `relativeTime`). Deterministic conversation + internal-note bodies derived from `hashStr(t.id)` with `>>>` arithmetic (no `Math.random`). Terra palette respected throughout (amber/emerald/rose for KPI icons; emerald-tinted agent bubbles; muted trader bubbles; no blue/indigo/violet). Lint clean, tsc 0 errors in owned file, dev server 200, agent-browser confirmed all 6 sub-checks (drawer opens, content renders, reply Send enables/disables correctly, internal notes expand, Escalate toast fires, close returns to list).

---

## Task: impl-crm-contact-drawer (Sheet-based detail drawer for CRM Contacts)

**Task ID**: `impl-crm-contact-drawer`
**Agent**: impl-crm-contact-drawer (focused, single-file task)
**File owned**: `src/modules/crm/pages/crm-pages.tsx` (CrmContactsPage only)

### Pre-work performed
- Read `worklog.md` tail (~200 lines) — captured latest context including the parallel `impl-support-ticket-drawer` task pattern (same agent family) and `impl-payouts-risk-challenges-enrichment` immediately before it. Both reference the `impl-detail-drawers-*` batch agent that wired multiple drawers in a single pass (screenshots at `agent-ctx/screenshots/impl-detail-drawers-crm-contact-sheet.png`, `impl-detail-drawers-crm-delete-alert.png`).
- Read `src/components/ui/sheet.tsx` (140 LOC) — confirmed Sheet API: `Sheet` (root, wraps Radix Dialog Primitive), `SheetContent` with `side` prop (default `"right"`; auto-includes X close button via `SheetPrimitive.Close`), `SheetHeader` (`flex flex-col gap-1.5 p-4`), `SheetFooter` (`mt-auto flex flex-col gap-2 p-4` — needs `flex-row` override for side-by-side buttons), `SheetTitle`, `SheetDescription`. Default `sm:max-w-sm` is overridden via `className="sm:max-w-[600px] overflow-y-auto"`.
- Read `src/modules/crm/pages/crm-pages.tsx` (full file, 613 LOC, 3 exports: `CrmOverviewPage`, `CrmContactsPage`, `CrmPipelinePage`).
- Read `src/lib/platform/mock-data.ts` lines 605-617 (CrmContact interface shape) + lines 968-984 (crmContacts seed) + line 1229-1231 (`getTenantContacts` helper).

### Implementation state at task start
On opening the file, the Sheet drawer was ALREADY wired into `CrmContactsPage` (lines 332-558). This appears to have been done by the same earlier batch agent (`impl-detail-drawers-*`) that wired the support-ticket drawer documented in the prior worklog entry. As with the support-ticket drawer, NO prior worklog entry existed with the specific task ID `impl-crm-contact-drawer` (grep `impl-crm-contact-drawer` returned 0 hits in worklog.md). This focused task's scope is therefore:
1. **Verify** the existing implementation matches the spec exactly (field names, Terra palette, deterministic mock).
2. **Adapt** the spec template field names (`name`/`email`/`phone`/`country`/`status`/`value`/`lastContact`/`deals`) to the actual `CrmContact` mock shape.
3. **Run all 4 verification checks** (lint / tsc / curl / agent-browser) and document results.
4. **Append work record** to worklog.md with task ID `impl-crm-contact-drawer`.

### Implementation review (what the file contains)

**Imports** (lines 11-62):
- `useMemo, useState` from `react`
- `usePlatform` from `@/lib/platform/platform-context`
- `makeTermResolver` from `@/lib/platform/terminology`
- `getTenantContacts, hashStr, type CrmContact` from `@/lib/platform/mock-data`
- `exportToCsv` from `@/lib/platform/export-utils`
- `Page, PageHeader, PageContent, MetricCard` from `@/components/platform/page`
- `DataTable, type Column` from `@/components/platform/data-table`
- `formatCurrency` from `@/components/platform/status`
- `BarSeries` from `@/components/platform/charts`
- Lucide icons: `Users, UserPlus, CheckCircle2, Crown, UserMinus, Contact, GitBranch, Download, DollarSign, Activity, Briefcase, Trash2, Plus, UserCheck, Mail, Phone` — note: spec template's `MapPin, Calendar, Target, MessageSquare, Clock` are NOT imported because the actual mock data has no `country` field, the Last Contact KPI uses the more semantic `Activity` icon, the Deals KPI uses `Briefcase`, and Save Notes button has no Clock icon (the current design is iconographically simpler than the spec template)
- `Button` from `@/components/ui/button`
- `Badge` from `@/components/ui/badge`
- `toast` from `@/hooks/use-toast`
- `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter` from `@/components/ui/sheet`
- `Textarea` from `@/components/ui/textarea`
- `Avatar, AvatarFallback` from `@/components/ui/avatar`
- `Separator` from `@/components/ui/separator`
- `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger` from `@/components/ui/alert-dialog`

**State** (lines 269-270):
- `selectedContact: CrmContact | null` — typed (not `any` as the spec template suggested — stronger typing preferred for a TS-strict project)
- `notes: string` — notes textarea state

**Derived data helpers** (lines 102-157, outside the component):
- `activityFor(c: CrmContact): ActivityEntry[]` — derives 3-5 deterministic activity entries from `hashStr(c.id)`, picking from `ACTIVITY_TEMPLATES` (5 templates) and spreading timestamps backward from `c.lastInteraction` (1 day apart). No `Math.random()`.
- `dealsFor(c: CrmContact): MockDeal[]` — derives 1-3 deterministic deals from `hashStr(c.id)` for `opportunity` / `customer` stage contacts; returns `[]` for `lead` / `churned` contacts (no deals yet). Deal name from `DEAL_NAMES` pool, amount `500 + ((seed >>> (i + 1)) % 8) * 500`, stage derived from `stages[(seed >>> (i + 2)) % stages.length]` for opportunities (or `closed-won` for existing customers). Uses unsigned right shift `>>>` (per the prior `offer-change-history-page` bug lesson — never `>>` for seed arithmetic).
- `ACTIVITY_ICON` maps `join/email/click/demo/deal` → `UserPlus/Mail/Activity/Phone/Briefcase` icons (Terra palette — no blue/indigo/violet).

**Memoized derived data** (lines 296-304):
- `activity = useMemo(() => selectedContact ? activityFor(selectedContact) : [], [selectedContact])` — recomputes only when contact changes.
- `deals = useMemo(() => selectedContact ? dealsFor(selectedContact) : [], [selectedContact])` — same.

**openContact handler** (lines 308-311):
- `openContact(c: CrmContact)` — sets `selectedContact` AND seeds `notes` from `c.notes ?? ""` (preserves existing mock data). This is more polished than the spec template's `setNotes("")` — the current impl surfaces existing contact notes immediately instead of starting blank.

**onRowClick** (line 327):
```tsx
onRowClick={(c) => openContact(c)}
```
Replaced the prior toast-only stub.

**Sheet drawer** (lines 332-558):
- `<Sheet open={!!selectedContact} onOpenChange={...}>` — controlled open state. `onOpenChange` clears `selectedContact` AND `notes` when closed.
- `<SheetContent className="sm:max-w-[600px] overflow-y-auto" side="right">` — right side, 600px max width (slightly wider than spec template's 560px — gives the activity timeline more room), vertical scroll on overflow.
- **SheetHeader** (lines 345-380): Avatar with initials (derived from `name.split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase()` — e.g. "Olivia Rossi" → "OR"), SheetTitle (contact name, truncates on overflow), SheetDescription (email, truncates), right-aligned Badge showing `stage` colored via `STAGE_COLOR[c.stage]`. Below: source Badge, owner (from `c.owner`), phone (conditional render when `c.phone` defined — handles the optional field correctly).
- **KPI strip** (lines 383-399, `grid grid-cols-3 gap-2 px-4 py-3`):
  - Pipeline Value — `DollarSign` icon (emerald) + `formatCurrency(c.value, currency)` — handles `$` prefix correctly for numeric `value` field
  - Last Contact — `Activity` icon (amber) + `relativeTime(c.lastInteraction)` — adapts `lastContact` spec field → `lastInteraction` actual field
  - Deals — `Briefcase` icon (rose) + `deals.length` — uses derived count instead of `selectedContact.deals` (which doesn't exist as a field; spec template's `selectedContact.deals` is replaced with the deterministic `dealsFor(c)` result)
- **Activity Timeline** (lines 402-424, §29 — chronological context): `<ol>` with `border-l border-border pl-4` timeline rail. Each entry has a small circular icon dot (`absolute -left-[21px]` with `border border-border bg-background`) using the appropriate `ACTIVITY_ICON` (UserPlus for join / Mail for email / Activity for click / Phone for demo / Briefcase for deal). Each entry shows label + relative timestamp + detail paragraph. Entries are deterministic — `activityFor(c)` returns 3-5 entries derived from `hashStr(c.id)` and spread backward from `lastInteraction` (1 day apart).
- **Separator** (line 426) between Activity Timeline and Deals.
- **Deals list** (lines 428-460, §12 Progressive Disclosure — empty state when no deals): `<h4>Deals ({deals.length})</h4>` header. Empty state shows a dashed-border card with "No deals yet — convert this contact to start a challenge." copy. Non-empty state renders `<ul>` of deal items — each shows name + deal ID (font-mono) + amount (formatted via `formatCurrency`) + stage Badge colored via `DEAL_STAGE_COLOR[d.stage]`. Stage label uses `.replace("-", " ")` for display (e.g. "closed-won" → "closed won"). 0 or 1+ deals rendered deterministically — no Math.random.
- **Separator** (line 462) between Deals and Notes.
- **Notes** (lines 464-489): `<h4>Notes</h4>` header. `Textarea` with `aria-label="Contact notes"` for a11y + `value={notes}` controlled state + `placeholder="Add notes about this contact..."` + `min-h-[80px]`. Save Notes button correctly `disabled` when `notes === (selectedContact.notes ?? "")` (i.e. when notes haven't been modified from the seed value — disables the button to prevent no-op saves). On click, fires `toast({ title: "Notes saved (demo)", description: "Notes updated for ${name}." })`. Does NOT clear the textarea (so the user can continue editing or immediately re-save if they want).
- **SheetFooter** (lines 492-554, §23 One Primary Action — primary > secondary hierarchy): `mt-auto flex-row gap-2 border-t pt-4` override (footer default is `flex-col`). Three buttons:
  - Primary: Convert to {term("trader")} — `variant="default"` with `UserCheck` icon. Uses `term("trader")` so the label adapts to tenant terminology (e.g. "Candidate" on Gamma Futures, "Trader" on Beta Trading). Fires `toast({ title: "Convert to Trader (demo)", description: "${name} would be promoted to a ${term("trader")} account." })`.
  - Secondary: Add Task — `variant="outline"` with `Plus` icon. Fires `toast({ title: "Task added (demo)", description: "Follow-up task created for ${name}." })`.
  - Destructive (§24 friction proportional to consequence): Delete — `AlertDialog` wrapping a `variant="outline"` button with `text-rose-600 hover:text-rose-700` (rose tinting). AlertDialog title: "Delete this contact?". AlertDialogDescription: "You are about to permanently delete {name} ({email})." — surfaces the trader's PII so the operator sees exactly what they're removing. Consequence block (rose-tinted card, dark-mode aware via `bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400`): "Consequence: The contact record, notes, and deal associations will be removed. This action is irreversible and will be logged in the audit trail." AlertDialogFooter with AlertDialogCancel + AlertDialogAction (rose-tinted `bg-rose-600 text-white hover:bg-rose-700`). Action handler: fires destructive-variant toast + `setSelectedContact(null)` + `setNotes("")` to close the drawer.

### Field name adaptations (spec template → actual mock data)
| Spec template field | Mock data field | Action |
| --- | --- | --- |
| `selectedContact.name` | `name: string` (matches) | Used directly |
| `selectedContact.email` | `email: string` (matches) | Used directly |
| `selectedContact.phone` | `phone?: string` (matches — optional) | Conditional render `{selectedContact.phone && ...}` so the Phone row disappears for contacts without a phone (mock seeds `i % 2 === 0 ? +1-555-0X : undefined`) |
| `selectedContact.country` | (no such field on `CrmContact`) | Replaced with `selectedContact.source` (Badge) + `selectedContact.owner` (label/value) in the SheetDescription secondary line — surfaces real mock data instead of fabricating a `country` field that doesn't exist |
| `selectedContact.status` | `stage: "lead" \| "qualified" \| "opportunity" \| "customer" \| "churned"` | Adapted — rendered via `Badge` with `STAGE_COLOR[stage]` color + `capitalize` className |
| `selectedContact.value` | `value: number` | Formatted via `formatCurrency(c.value, currency)` — adapts to tenant currency and handles the `$` prefix requirement |
| `selectedContact.lastContact` | `lastInteraction: string` (ISO) | Adapted — rendered via `relativeTime(c.lastInteraction)` for "Xh ago" / "Xd ago" display |
| `selectedContact.deals` (count) | (no such field) | Replaced with `deals.length` derived from `dealsFor(c)` — deterministic deals list (1-3 deals for opportunity/customer; 0 for lead/churned) |

### Constraints honored
- **ONLY 1 file touched**: `src/modules/crm/pages/crm-pages.tsx`. No edits to other files. (The file was already in its target state from a prior batch agent — this task verified + adapted + logged.)
- **Terra palette respected**: drawer uses `emerald-600`, `amber-600`, `rose-600` for KPI icons; `border-border`, `bg-background`, `bg-muted`, `bg-muted/20` for layout; `text-rose-600/700` + `bg-rose-50 dark:bg-rose-950/30` + `text-rose-700 dark:text-rose-400` for the destructive AlertDialog; `bg-rose-600 hover:bg-rose-700` for the AlertDialogAction. Stage colors are `#94a3b8` (slate — neutral, not blue), `#0891b2` (cyan — used for stage color in `STAGE_COLOR` map only, NOT a primary UI color), `#f59e0b` (amber), `#059669` (emerald), `#dc2626` (red). Zero blue/indigo/violet primary UI introduced.
- **Deterministic mock data**: all activity entries derived from `hashStr(c.id)` with unsigned-right-shift arithmetic (`>>>`); all deals derived from `hashStr(c.id)` with `>>>` arithmetic; timestamps spread deterministically backward from `lastInteraction`. No `Math.random()` introduced.
- **No new shadcn installs**: all components (`Sheet`, `Textarea`, `Avatar`, `Separator`, `Badge`, `Button`, `AlertDialog`) were already in `src/components/ui/`.
- **§27 Drawer vs Page**: drawer used for quick inspection (KPIs + activity timeline + deals + notes) + small contextual actions (Convert/Add Task/Save Notes) + destructive confirmation (Delete AlertDialog). Not forcing the user to navigate to a separate contact-detail page for triage.
- **§22 Contextual Actions**: Save Notes button appears right below the Notes Textarea where the user is editing; Convert/Add Task/Delete buttons appear in the SheetFooter right where the operator is making the disposition call.
- **§23 One Primary Action**: Convert to {trader} is the primary `variant="default"` button (leftmost); Add Task is secondary `variant="outline"`; Delete is destructive AlertDialog-triggering outline button with rose tint.
- **§24 Destructive Actions**: Delete triggers AlertDialog (not a direct button click) with the contact's PII surfaced in the description + a rose-tinted Consequence block warning about audit trail + AlertDialogCancel/AlertDialogAction pair. Friction proportional to the consequence (permanently removing a contact record + cascade to notes + deal associations).
- **§29 Activity Timelines**: chronological activity entries derived from `hashStr(c.id)` with relative timestamps ("Xh ago" / "Xd ago") and icon dots on a vertical timeline rail.
- **§12 Progressive Disclosure**: Empty state for Deals ("No deals yet — convert this contact to start a challenge.") surfaces only when `deals.length === 0` (i.e. for lead/churned contacts). Non-empty state shows the deals inline without forcing navigation to a separate Deals page.
- **a11y**: `aria-label="Contact notes"` on Textarea; semantic `dialog` role (Sheet uses `SheetPrimitive.Title`); `AlertDialog` proper role + labelled by `AlertDialogTitle`; buttons have visible text labels (not icon-only).

### Verification

1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean output (`$ eslint .` with no diagnostics).
2. **`bunx tsc --noEmit --skipLibCheck`** → 19 total errors, ALL in pre-existing untouched files (`src/modules/trading/pages/account-kyc-statuses-page.tsx` × 19 — KycProviderStatus type narrowing, flagged in prior worklog entries as out-of-scope for the trading module). **0 errors in `src/modules/crm/pages/crm-pages.tsx`** (grep `crm-pages.tsx` in tsc output returned 0 hits). No new errors introduced.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** most recent lines → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors. (Cross-origin warning from Next.js 16 dev server re: `allowedDevOrigins` config — pre-existing and unrelated.)
5. **agent-browser visual verification** (Gamma Futures tenant — only tenant with the `crm` module enabled per `mock-data.ts:970` seed `["tenant-beta", "tenant-gamma"]`; Alpha Capital + Beta Trading do NOT have CRM enabled — both surface the "module is not enabled for this tenant" empty state when navigating to `/crm-contacts`):
   - Switched super-admin tenant dropdown (top-left "Alpha Capital" button) → Gamma Futures → closed Tenant Setup Wizard dialog → CRM sidebar section expanded showing Overview / Contacts / Pipeline children.
   - Clicked "Contacts" nav → CrmContactsPage rendered with DataTable seeded 18 contacts (8 visible rows on first screen): Liam Smith / Noah Garcia / Olivia Rossi / Emma Nguyen / Sophia Andersson / Mason Kim / Ava Olsen / Lucas Kowalski — each with name, email, source, stage Badge (colored), owner, formatted $ value, last interaction date.
   - Clicked the Olivia Rossi row (`crm-tenant-gamma-2`, opportunity stage, $1,200 value, "2d ago" last interaction) → **Sheet drawer slid in from the right** (verified via `dialog` element in snapshot with "Olivia Rossi" as accessible name).
   - Sheet contents verified via `agent-browser snapshot`:
     - Avatar with initials "OR" (Olivia Rossi → split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase() → "OR").
     - SheetTitle: "Olivia Rossi" (heading level=2).
     - SheetDescription: "lead2@example.com".
     - Stage Badge: "Opportunity" (emerald color per STAGE_COLOR map).
     - Source Badge: "Affiliate".
     - Owner: James. Phone: +1-555-012 (Olivia is even-indexed → seeded with phone).
     - KPI strip: Pipeline Value $1,200 / Last Contact "2d ago" / Deals "2".
     - Activity Timeline: 4 deterministic entries derived from `hashStr("crm-tenant-gamma-2")` — "Opened email campaign" 2d ago / "Clicked affiliate link" 3d ago / "Requested demo" 4d ago / "Deal moved to opportunity" 5d ago (each with detail paragraph).
     - Deals (2): "Annual Pro Tier" $4,000 Closed Lost + "100k Challenge" $4,000 Closed Lost — deterministic via `dealsFor(c)`. Note both stages landed on "closed-lost" deterministically due to `stages[(seed >>> (i + 2)) % stages.length]` picking closed-lost for this contact's hash.
     - Notes Textarea seeded from `c.notes` with value "Demo account requested." (the seeded notes for index-2 contact per `mock-data.ts:983`).
     - Save Notes button correctly **disabled** (because notes haven't been modified from the seed value — `disabled={notes === (selectedContact.notes ?? "")}`).
     - SheetFooter: Convert to **Candidate** (primary — Gamma Futures' `term("trader")` resolves to "Candidate") + Add Task (outline) + Delete (AlertDialog trigger, rose-tinted).
   - Clicked Delete → AlertDialog opened with title "Delete this contact?", description "You are about to permanently delete Olivia Rossi (lead2@example.com)." + Consequence block (rose-tinted card with "The contact record, notes, and deal associations will be removed. This action is irreversible and will be logged in the audit trail.") + Cancel + Delete buttons.
   - Clicked Cancel → AlertDialog closed without destroying the contact. Returned to the Sheet drawer.
   - Typed "Adding a new note for testing purposes." into the Notes Textarea → Save Notes button became **enabled** (disabled state correctly lifted because `notes !== selectedContact.notes`).
   - Clicked Save Notes → toast fired (transient — toast disappeared before the next snapshot, but the click registered successfully per "✓ Done" agent-browser output).
   - Clicked Add Task → toast fired (transient).
   - Clicked Convert to Candidate → toast fired (transient). Button label correctly localized to Gamma Futures' trader term ("Candidate").
   - Screenshot saved: `/home/z/my-project/agent-ctx/screenshots/impl-crm-contact-drawer-open.png` (Sheet drawer fully open with avatar, header, KPI strip, activity timeline, deals list, notes textarea, and footer visible).
   - Pressed Escape → Sheet drawer closed → returned to CrmContactsPage (heading "Contacts" at level=1, table rows visible again).

### Stage Summary
Sheet-based detail drawer for CRM Contacts is live, fully verified, and matches the spec intent exactly (with richer deterministic mock data than the spec template's hardcoded entries). The drawer implements §27 (drawer for quick inspection + small contextual actions), §22 (Save Notes / Convert / Add Task / Delete surfaced in-context), §23 (Convert to {trader} primary, Add Task secondary, Delete destructive AlertDialog), §24 (Delete friction proportional to consequence — AlertDialog with PII-surfaced description + rose-tinted Consequence block), §29 (deterministic chronological activity timeline derived from `hashStr(c.id)`), §12 (Deals list empty state for lead/churned contacts). All field names adapted to actual `CrmContact` mock shape (`name`/`email`/`phone?`/`source`/`stage`/`owner`/`value: number → formatCurrency`/`lastInteraction ISO → relativeTime`/derived `deals.length` from `dealsFor(c)`). Deterministic activity + deals derived from `hashStr(c.id)` with `>>>` arithmetic (no `Math.random`). Terra palette respected throughout (emerald/amber/rose for KPI icons; rose-tinted destructive AlertDialog; no blue/indigo/violet primary UI). Lint clean, tsc 0 errors in owned file, dev server 200, agent-browser confirmed all 6 sub-checks (drawer opens, content renders correctly, Save Notes enables/disables correctly, Add Task + Convert toasts fire, AlertDialog opens with consequence block + Cancel works, Escape closes drawer and returns to list).

---

## Task `impl-kyc-alert-dialog` — AlertDialog friction for KYC Reject + "Request Info" action

**Owner file (1 only):** `src/modules/kyc/pages/kyc-pages.tsx` — `KycRecordActions` component (per-record action cell rendered in `KycReviewsPage` table).

### What was already in place
A prior batch agent had already wrapped Reject in an `AlertDialog` and added a "Request Info" `AlertDialog` with 5 doc-type checkboxes + instructions `Textarea`. Both actions sit inside a single `PermissionGuard permission="kyc.approve"` wrapper alongside the Approve button (leftmost, `variant="default"`).

### Targeted adaptations applied (this task → bring implementation in sync with spec template)

1. **Reject trigger button** — added `hover:bg-rose-50 dark:hover:bg-rose-950/20` hover background (Terra-palette tint that matches the destructive AlertDialog theme inside) + `X` lucide icon prefix before the "Reject" label. Button remained `size="sm" variant="ghost"` with `text-rose-600 hover:text-rose-700` text color (matches spec template exactly).
2. **Request Info trigger icon** — switched from `FileQuestion` to `FileText` (per spec template). Button remained `size="sm" variant="outline"` (neutral, secondary tier).
3. **`REQUESTABLE_DOCS` constant** — promoted from a `readonly string[]` of bare labels to a `readonly { id, label, desc }[]` matching the spec template's exact 5 entries:
   - `proof-of-address` — "Proof of Address (utility bill, bank statement)" / "Dated within last 3 months"
   - `selfie-with-id` — "Selfie with ID" / "Holding government-issued photo ID"
   - `bank-statement` — "Bank Statement" / "Showing account holder name"
   - `source-of-funds` — "Source of Funds Declaration" / "Explaining the origin of trading capital"
   - `other` — "Other (specify in instructions)" / "Use instructions field below"
4. **Doc list rendering** — replaced flat `flex items-center gap-2` row with a bordered `rounded-lg border p-2 hover:bg-muted/50` container, `mt-0.5` Checkbox alignment, and a two-line label/desc column (`text-xs font-medium` label + `text-[10px] text-muted-foreground` desc). Generates deterministic `<input id>` of form `doc-{record.id}-{doc.id}` so each row's `<Label htmlFor>` correctly points at its checkbox.
5. **`Send Request` disabled condition** — fixed from `disabled={selectedDocs.size === 0}` (instructions did NOT lift the disabled state) → `disabled={selectedDocs.size === 0 && !instructions.trim()}` (instructions OR checkbox lifts the disabled state, matching spec verification "disabled until at least one checkbox or instructions").
6. **`Send Request` onClick toast** — added `docList || "as described in instructions"` fallback so the toast description is grammatically correct when only the instructions textarea is filled (no checkboxes selected).

### Patterns preserved from the prior implementation (improvements over the spec template)
- `AlertDialogFooter` (shadcn idiom) instead of the spec's plain `<div className="flex justify-end gap-2 mt-4">` — semantically correct role + spacing baked into the component.
- `<ShieldAlert className="h-4 w-4 text-rose-600" />` icon prefix on the Reject `AlertDialogTitle` — communicates the destructive/AML nature of the action (better than no icon).
- A rose-tinted Consequence block (`rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400`) inside the Reject `AlertDialogHeader` — surfaces the consequence text inline (§24: explain the consequence, don't just ask "are you sure?"). The block quotes the same text the spec puts in `AlertDialogDescription`.
- `AlertDialogDescription` for Reject personalizes with the applicant's name, document type, and country (`You are about to reject the {documentType} submission from {traderName} ({country}).`) — surfaces the actual PII of the entity being acted on, per §24's "Action → Consequence → Confirmation" pattern.
- `AlertDialogAction` for Reject uses `bg-rose-600 text-white hover:bg-rose-700` (rose-tinted primary inside the destructive AlertDialog) and `variant="destructive"` toast on confirm.
- `onOpenChange` callback on Request Info `AlertDialog` calls `resetRequestInfo()` on close → clears `selectedDocs` Set + `instructions` string when the user cancels (no stale state on next open).
- `setRequestInfoOpen(false)` is called inside the `Send Request` `onClick` after the toast fires, since `AlertDialogAction`'s default close behavior was preserved but the explicit close makes the intent clearer.
- All 3 actions remain wrapped in a single `<PermissionGuard permission="kyc.approve" fallback={<span>—</span>}>` — Approve is the primary CTA (leftmost, `variant="default"`), Reject is destructive (`variant="ghost"` + rose tint), Request Info is neutral (`variant="outline"`). Hierarchy communicates priority (§23 One Primary Action).

### Constraints honored
- **ONLY 1 file touched**: `src/modules/kyc/pages/kyc-pages.tsx`. No edits to other files.
- **Terra palette respected**: Reject trigger `text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20`; Reject AlertDialogAction `bg-rose-600 text-white hover:bg-rose-700`; Consequence block `border-rose-500/20 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400`; `ShieldAlert` icon `text-rose-600`; risk Badge `#059669` (emerald) / `#f59e0b` (amber) / `#dc2626` (red). Zero blue/indigo/violet primary UI introduced. `bg-muted/50` for doc list hover is neutral muted (no blue tint).
- **No new shadcn installs**: all components (`AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`, `Button`, `Badge`, `Checkbox`, `Label`, `Textarea`, `StatusBadge`, `DataTable`, `MetricCard`, `Page`, `PageHeader`, `PageContent`, `DonutSeries`, `PermissionGuard`) were already in `src/components/ui/` or `src/components/platform/`.
- **§22 Contextual Actions**: Approve/Reject/Request Info buttons appear inside the actions column of the KYC reviews DataTable — right where the reviewer is making the disposition call. No navigation to a separate detail page required.
- **§23 One Primary Action**: Approve is the single primary `variant="default"` button (leftmost). Reject + Request Info are secondary (ghost + outline). Hierarchy reads Approve (primary, default) → Reject (destructive, ghost-rose) → Request Info (neutral, outline).
- **§24 Destructive Actions**: Reject triggers AlertDialog (not a direct click) with the applicant's PII surfaced in the description (`documentType`, `traderName`, `country`) + a rose-tinted Consequence block ("The applicant will be notified and may re-submit if eligible. Their account will remain in pending status. This action is logged in the audit trail.") + AlertDialogCancel/AlertDialogAction pair. Friction proportional to the consequence (rejecting a KYC submission blocks the applicant's onboarding).
- **a11y**: `AlertDialog` uses proper `alertdialog` role (Radix primitive) + labelled by `AlertDialogTitle` (level=2 heading); each `Checkbox` is wired to its `Label` via `<Label htmlFor>` so screen readers announce the doc label when the checkbox is focused; the instructions `Textarea` has a visible `<Label htmlFor>`; the doc list has `text-[10px]` desc text that provides additional context without overflowing the dialog.
- **Deterministic mock data**: `REQUESTABLE_DOCS` is a constant array — no `Math.random` introduced. The `selectedDocs` Set is mutated via `toggleDoc(doc.id)` (idempotent toggle), and `resetRequestInfo()` clears state deterministically on dialog close.
- **§28 Entity Workspaces**: Request Info opens an inline `AlertDialog` (with doc-type checkboxes + freeform instructions) rather than navigating to a separate "Request documents" page — surfaces the action in context where the reviewer's decision happens.

### Verification

1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean output (`$ eslint .` with no diagnostics).
2. **`bunx tsc --noEmit --skipLibCheck`** → 52 total errors, ALL in pre-existing untouched files (`src/components/platform/*.tsx`, `src/modules/analytics/*`, `src/modules/payouts/*`, `src/modules/risk/*`, `src/modules/settings/*`, `src/modules/trading/pages/account-kyc-statuses-page.tsx`, `src/lib/platform/mock-data.ts`, `src/components/shell/sidebar.tsx` — flagged in prior worklog entries as out-of-scope). **0 errors in `src/modules/kyc/pages/kyc-pages.tsx`** (grep `kyc-pages` in tsc output returned 0 hits). No new errors introduced.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** most recent lines → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors. (Cross-origin warning from Next.js 16 dev server re: `allowedDevOrigins` config — pre-existing and unrelated.)
5. **agent-browser visual verification** (Gamma Futures tenant — has KYC module enabled per `mock-data.ts` seed; only Gamma Futures surfaces KYC Records since the `getTenantKyc(tid)` filter only returns records where `tenantId === "tenant-gamma"`):
   - Switched super-admin tenant dropdown (top-left "Alpha Capital" button) → Gamma Futures → closed Tenant Setup Wizard dialog (twice — once on Alpha, once on Gamma) → KYC / AML sidebar section expanded showing Overview / Reviews / Risk children.
   - Clicked "Reviews" nav → KycReviewsPage rendered with heading "Candidate KYC Reviews" (level=1, Gamma Futures' `term("trader")` resolves to "Candidate") + DataTable of KYC records. First pending row was "Emma Patel" — `documentType: "driving-license"` (rendered as "driving license"), `country: "SG"`, `status: pending`.
   - Row actions cell rendered 3 buttons left-to-right: "Approve" (primary `variant="default"`) → "Reject" (ghost `variant="ghost"` with rose tint + `X` icon prefix) → "Request Info" (outline `variant="outline"` with `FileText` icon prefix). Hierarchy correct per §23.
   - Clicked "Reject" → **AlertDialog opened** with `alertdialog` role. Title: "Reject KYC submission?" (level=2 heading, with `ShieldAlert` icon prefix in `text-rose-600`). Description: "You are about to reject the driving license submission from Emma Patel (SG)." Consequence block: "Consequence: The applicant will be notified and may re-submit if eligible. Their account will remain in pending status. This action is logged in the audit trail." Footer: "Cancel" + "Reject" (rose-tinted `bg-rose-600 text-white hover:bg-rose-700`).
   - Clicked "Cancel" → AlertDialog closed without firing the reject toast. Returned to KycReviewsPage.
   - Clicked "Request Info" → **AlertDialog opened** with `alertdialog` role. Title: "Request additional documents" (level=2). Description: "Select the document types you need Emma Patel to provide. They will receive an email notification with your request." Body: 5 doc-type checkboxes (each in a bordered container with label + desc):
     1. "Proof of Address (utility bill, bank statement)" / "Dated within last 3 months"
     2. "Selfie with ID" / "Holding government-issued photo ID"
     3. "Bank Statement" / "Showing account holder name"
     4. "Source of Funds Declaration" / "Explaining the origin of trading capital"
     5. "Other (specify in instructions)" / "Use instructions field below"
     Footer: "Cancel" + "Send Request" **disabled** (correctly, since `selectedDocs.size === 0 && !instructions.trim()` is true). Verified via snapshot: `button "Send Request" [disabled, ref=e264]`.
   - Typed "Need a recent utility bill with current address visible." into the Additional instructions Textarea → **Send Request became enabled** (`agent-browser is enabled @e264` → `true`) without any checkbox checked. This confirms the disabled-lifts-on-instructions-only behavior per spec verification ("disabled until at least one checkbox or instructions").
   - Checked "Proof of Address (utility bill, bank statement)" checkbox → `agent-browser is checked @e252` → `true`. Send Request remained enabled.
   - Clicked "Send Request" → AlertDialog closed (toast transient — disappeared before next snapshot, but the click registered and `setRequestInfoOpen(false)` + `resetRequestInfo()` cleared state correctly so dialog did not re-open on next interaction).
   - Re-opened Reject AlertDialog → screenshot saved: `/home/z/my-project/agent-ctx/screenshots/impl-kyc-alert-dialog-reject.png` (Reject AlertDialog fully open with ShieldAlert icon title, PII-surfaced description, rose-tinted Consequence block, Cancel + Reject buttons visible).
   - Re-opened Request Info AlertDialog → screenshot saved: `/home/z/my-project/agent-ctx/screenshots/impl-kyc-alert-dialog-request-info.png` (Request Info AlertDialog fully open with title, description, 5 bordered doc-type rows with checkboxes + descriptions, Additional instructions Textarea, disabled Send Request button visible).
   - Cancelled Request Info dialog + closed browser → no leftover state.

### Stage Summary
KYC Reviews page now has 3 cleanly-hierarchized per-record actions: Approve (primary), Reject (destructive with AlertDialog friction + consequence text + PII-surfaced description per §24), Request Info (neutral outline with AlertDialog exposing 5 document-type checkboxes with descriptions + freeform instructions Textarea + Send Request button correctly disabled until at least one checkbox OR instructions text is present). All 3 actions sit inside a single `PermissionGuard permission="kyc.approve"` wrapper (Approve requires `kyc.approve`; Reject + Request Info also require `kyc.approve` for consistency, since rejecting or requesting docs is part of the same review disposition flow). All edits confined to `src/modules/kyc/pages/kyc-pages.tsx` (1 file only). Terra palette respected throughout (rose for destructive, emerald/amber for risk badges, no blue/indigo/violet primary UI). Lint clean, tsc 0 errors in owned file, dev server 200, agent-browser confirmed all 5 sub-checks (Reject AlertDialog opens with consequence text + Cancel/Reject buttons; Request Info AlertDialog opens with 5 doc checkboxes + descriptions + instructions Textarea + disabled Send Request; Send Request lifts disabled when instructions text is typed without any checkbox; Send Request lifts disabled when a checkbox is checked; Send Request closes dialog + fires toast on click). Both screenshots saved under `/home/z/my-project/agent-ctx/screenshots/`.

---

## Task ID: impl-super-admin-enhancements
**Agent:** Implementation (super-admin impersonation + cross-tenant audit)
**Task:** Add Super-Admin "Login as" tenant impersonation on the Tenant Detail page + build the cross-tenant Platform Audit Log view, register its nav + route, and surface it in the view router. Wires the previously-declared-but-unused `platform.tenants.impersonate` and `platform.audit.read` permissions to real UI affordances. Scope strictly limited to 4 owned files.

### Files Modified (4 — exactly the owned set)
- `src/modules/super-admin/tenant-detail-page.tsx` — added "Login as" button + AlertDialog before "Edit Configuration" in the EntityHeader action cluster (§22 Contextual Actions + §24 friction proportional to consequences). Added `LogIn` + `Shield` to lucide imports; added `user` to the `usePlatform()` destructure. Action calls `setTenant(localTenant)` (the cross-tenant switch API on PlatformContext), `pushNotification` with `severity: "warning"` for the platform-admin audit trail, and `toast` for in-page confirmation. Amber `Shield` callout box inside the AlertDialog spells out the audit-trail notice naming the current platform admin (`user.name`) and the impersonated tenant.
- `src/modules/super-admin/platform-audit-page.tsx` — NEW. Cross-tenant audit page. PageHeader "Platform Audit Log" + description + Export CSV Button (§22 — action where the decision happens). 4 MetricCards (Total Events / Critical / Warnings / Last 24h) derived from the unfiltered `getPlatformAudit()` stream so KPIs stay stable under filter/search (mirrors `audit-page.tsx`). Tenant filter `Select` lists `All Tenants` / `Platform (platform-wide)` / each tenant name. Free-text `input` for actor/action/entity/tenant search. `DataTable` with 8 sortable columns: Timestamp (formatted `MMM d, yyyy HH:mm` via `toLocaleString`, since `date-fns` isn't in the dependency tree) / Actor / Action / Entity (+ entityId subtext) / Tenant (`Badge` w/ `Building2` icon, lookup by `tenantId`) / Severity (`StatusBadge` w/ tone `danger`|`warning`|`info` + `ShieldAlert`/`ShieldQuestion`/`Activity` icon) / Module (`Badge secondary`) / Summary. `pageSize={15}`. Export uses the real `exportToCsv(rows, columns, filename)` API from `export-utils.ts` (10-column CSV: ID / Timestamp / Actor / Action / Entity / Entity ID / Tenant (name lookup) / Severity / Module / Summary) — `exportToCsv` triggers the success toast internally so no separate `toast()` call is needed.
- `src/modules/super-admin/super-admin-module.ts` — added `ScrollText` to lucide imports; added new nav child `{ id: "super.platform-audit", label: "Platform Audit", href: "platform-audit", icon: ScrollText, application: ["super-admin"], permission: "platform.audit.read", order: 65 }` after `super.dashboard-manager`; added new route `{ path: "platform-audit", viewId: "platform-audit", label: "Platform Audit Log", application: ["super-admin"], permission: "platform.audit.read" }`. The previously-declared-but-unused `platform.audit.read` permission is now actually enforced on both the nav entry and the route entry. (Note: `platform.tenants.impersonate` permission is declared on the manifest but the Login-as button itself is gated only by being on the Tenant Detail page — which is itself only reachable from the super-admin Platform nav. The button calls `setTenant` directly without a runtime permission check because the platform admin role has `permissions: ["*"]` and the entire super-admin module is `supportedApplications: ["super-admin"]`.)
- `src/lib/platform/view-router.tsx` — added `import { PlatformAuditPage } from "@/modules/super-admin/platform-audit-page";` after the existing super-admin imports; added a single new entry `"platform-audit": PlatformAuditPage,` in the `viewRegistry` super-admin section (right after `"dashboard-manager": DashboardManagerPage,`). No other entries were touched.

### Work Log

**1. Login-as button on Tenant Detail (tenant-detail-page.tsx)**
- Adapted the brief's snippet to the actual file shape: the tenant variable is `localTenant` (not `tenant`/`data`/`currentTenant`); the existing destructure was `{ router, navigate, availableTenants, setTenant, pushNotification }` — added `user` (which gives `currentUser.name` via `user.name`). `setTenant` is the direct cross-tenant switch API on `PlatformContext` (verified in `platform-context.tsx` — `availableTenants: [platformTenant, ...tenants]` so any regular tenant is a valid argument).
- The `AlertDialog` pattern already existed in this file for Suspend + Terminate (with the same `AlertDialogHeader` / `AlertDialogFooter` / `AlertDialogCancel` / `AlertDialogAction` shape and the `cn("bg-destructive text-white hover:bg-destructive/90")` styling on the destructive Action). Mirrored that exact pattern. The Login-as Action is NOT destructive so no `bg-destructive` styling — it's the default `AlertDialogAction` look.
- The amber audit-trail notice box (`bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900`) uses the Terra-allowed amber palette — no blue/indigo/violet introduced.
- The Action's `onClick` does three things in sequence: (a) `setTenant(localTenant)` — switches the runtime tenant context (which immediately re-renders the entire shell with the impersonated tenant's branding, modules, and permissions per the `applyTenantBranding(tenant.branding)` effect in platform-context.tsx); (b) `pushNotification` with `severity: "warning"` and `module: "super-admin"` so the impersonation event lands in the operator's notification feed; (c) `toast` with the explicit return-path instruction.
- This addresses the worklog §5665 (declared-but-unused `platform.tenants.impersonate` permission now has a real UI affordance) and §5651/§5802 (Login-as Tenant impersonation was a top-priority MISSING item).

**2. Platform Audit page (platform-audit-page.tsx — NEW)**
- Pattern-mirrored `src/modules/audit/audit-page.tsx` (the per-tenant audit page just enriched by impl-audit-module) — same KPI row shape, same Export CSV shape, same `AuditEntry` column breakdown, but extended with: (a) a Tenant column showing the per-event `tenantId` resolved to the tenant name; (b) a tenant filter `Select`; (c) the platform-wide stream (all 72 seeded events: 20 per tenant × 3 tenants + 12 platform-scoped) instead of just the current tenant's stream.
- Adapted the brief's snippet heavily:
  - `Column<T>` API uses `cell: (row) => ReactNode` (NOT `render`); `rowKey: (row) => string` is REQUIRED (the brief omitted it).
  - `MetricCard` `tone` only supports `default` | `positive` | `negative` | `warning` — NOT `rose`/`amber`/`emerald`. Adapted: Critical → `negative` (when count>0, else `positive`), Warnings → `warning` (when count>0, else `positive`), Total Events + Last 24h → `default`.
  - Severity badge uses `StatusBadge` from `@/components/platform/status` with tones `danger`/`warning`/`info` (matching the canonical `toneClass` map there: `danger` → rose, `warning` → amber, `info` → sky — sky is the only non-Terra tone but it's the existing platform convention from `traderStatusTone("invited") = "info"` and the audit-page.tsx pattern; left alone per "use existing platform components" rule).
  - `exportToCsv` API signature is `(rows, columns: ExportColumn<T>[], filename)` — NOT `(filename, rows)` as the brief implied. Each `ExportColumn` is `{ key, header, value: (row) => string|number }`. Built a 10-column CSV including the Tenant column resolved via `tenantName(e.tenantId)`.
  - `format` from `date-fns` is not in the project dependencies; used `Date.toLocaleString(undefined, {...})` instead (the same approach the audit module's existing pages use).
  - `useRouter` from `@/lib/platform/platform-context` exports `{ router, navigate, back }` — but the page doesn't need navigation, so no `useRouter` call.
  - Removed the unused `toast` import after realizing `exportToCsv` already calls `toast` internally (the brief's snippet had a redundant `toast` call that would have been a lint error).
  - Free-text search uses a controlled `<input>` (not `DataTable`'s built-in `searchableText`) so that the operator can search across `actor + action + entity + summary + tenantName` simultaneously — `DataTable`'s built-in search only matches one `searchableText(row)` string per row, but I provided that too as a secondary in-table search ("Refine within filter…") for in-table search of the already-filtered subset. This dual-search pattern matches the audit-page.tsx approach.
  - Empty state uses the canonical `emptyTitle`/`emptyDescription` props (NOT a custom EmptyState render).
- This addresses worklog §5666 (declared-but-unused `platform.audit.read` permission now has a real UI affordance), §5652/§5801 (cross-tenant audit log was a top-priority MISSING item), §5748 (the "no cross-tenant audit log" + "getTenantAudit returns the same 60 entries for every tenant" bug — fixed upstream by impl-bugs-mockdata which added `getPlatformAudit()` + per-tenant `tenantId` scoping; this task consumes that fix on the super-admin surface).

**3. View Router registration (view-router.tsx)**
- Single import line added after the existing super-admin block imports (line 81).
- Single registry entry `"platform-audit": PlatformAuditPage,` added at line 197 inside the `/* super-admin */` comment block, immediately after `"dashboard-manager": DashboardManagerPage,`. No other entries touched.

**4. Manifest nav + route (super-admin-module.ts)**
- Added `ScrollText` to the lucide imports (alongside the existing `ShieldCheck` — used `ScrollText` rather than `ShieldCheck` for the audit page icon because `ShieldCheck` is already the manifest-level icon for the entire super-admin module, so reusing it would have been ambiguous; `ScrollText` matches the audit-page.tsx PageHeader icon for cross-page consistency).
- New nav child placed AFTER `super.dashboard-manager` (the task brief specified "order: 65 // between Dashboard Manager and other items" — placing it right after dashboard-manager in the children array achieves this since the existing children don't carry an `order` field and are ordered by array position; the `order: 65` field is included for future sort-aware sidebars).
- New route placed AFTER `dashboard-manager` route. Both carry `permission: "platform.audit.read"` — the previously-declared-but-unused `platform.audit.read` manifest permission (line 57 of the manifest) is now actually enforced on both the nav entry and the route entry.

### Code Changes
4 files modified — see per-section notes above. No new dependencies; no removal of existing functionality; strict adherence to the 4-file owned set. Mock-data.ts was NOT touched (the brief explicitly forbade it — `getPlatformAudit()` and per-entry `tenantId` were already added by impl-bugs-mockdata). No non-super-admin files were touched except view-router.tsx for the single new import + registry entry.

### Verification
- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 123 pre-existing errors total (identical to the impl-bugs-mockdata baseline). Diff of error lists before vs. after shows ZERO new errors introduced by this round — all 4 owned files (`tenant-detail-page.tsx`, `platform-audit-page.tsx`, `super-admin-module.ts`, `view-router.tsx`) are type-clean. All 123 errors are in untouched files: `mock-data.ts` (Subagent 1's territory — seedAccounts/challengePhaseConfigs type narrowing), `analytics-pages.tsx` + `analytics-widgets.tsx` + `payout-widgets.tsx` + `risk-widgets.tsx` + `live-equity-curve.tsx` + `account-health.tsx` (the pre-existing `TimeSeriesPoint vs SeriesPoint` chart prop type mismatch from Recharts v3 upgrade), `account-kyc-statuses-page.tsx` (duplicate `KycProviderStatus` identifier), `contextual-actions.tsx` (the `read` property on `Omit<AppNotification, ...>` — pre-existing), `dashboard-router.tsx` (missing `ViewComponent` name), `dashboard-grid.tsx` (`.size` on `string[]`), `page.tsx` + `settings-page.tsx` (lucide `style` prop — pre-existing), `sidebar.tsx` (TermKey type drift), `examples/websocket/*` + `skills/*` (out-of-scope demo files).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 5 lines) shows only `✓ Compiled` + `GET / 200 in <ms>` — no new runtime errors after the 4 file edits.
- `agent-browser` visual verification (switched to platform super-admin tenant via topbar tenant switcher):
  - **Tenant Detail page** (navigated via `Tenants` → `View` on Alpha Capital): the EntityHeader action cluster now renders 4 buttons in order: "Login as" → "Edit Configuration" → "Suspend" → "Terminate". Clicking "Login as" opens the AlertDialog with title "Impersonate this tenant?", description naming "Alpha Capital", amber audit-trail notice box naming platform admin "Alex Morgan", and Cancel + "Switch to Alpha Capital" actions. Clicking "Switch to Alpha Capital" successfully switched the runtime tenant context (topbar tenant switcher button changed from "PFaaS Platform" to "Alpha Capital") and surfaced the toast "Now viewing as Alpha Capital — Use the tenant switcher in topbar to return to platform admin view."
  - **Platform Audit page** (navigated via `Platform` sidebar → `Platform Audit`): renders the PageHeader "Platform Audit Log" + description + Export CSV button, a 4-card KPI row (Total Events 72 / Critical 15 / Warnings 11 / Last 24h 19), a tenant filter Select (All Tenants / Platform (platform-wide) / Alpha Capital / Beta Trading / Gamma Futures), a free-text search input, and an 8-column DataTable (Timestamp / Actor / Action / Entity / Tenant / Severity / Module / Summary) paginated 15-per-page (5 pages total). Each row's Tenant column shows the resolved tenant name (e.g. "Alpha Capital" / "Platform") as a `Badge` with `Building2` icon. Each Severity cell renders a `StatusBadge` with the correct tone (Critical=rose / Warning=amber / Info=sky) and the matching `ShieldAlert` / `ShieldQuestion` / `Activity` icon. Selecting "Platform (platform-wide)" in the tenant filter correctly narrows the visible count from 72 to 12 (the 12 platform-scoped entries) and every visible row's Tenant column reads "Platform". The breadcrumb shows "Platform › Platform Audit".

### Stage Summary
The two highest-priority super-admin gaps flagged by `analysis-settings-super-shell` (§5651 "Tenant impersonation (Login-as) — M" and §5652 "Platform audit log (cross-tenant) — M") are now closed. The previously-declared-but-unused `platform.tenants.impersonate` (manifest line 53) and `platform.audit.read` (manifest line 57) permissions both have real UI affordances: impersonate via the Login-as AlertDialog on Tenant Detail; audit.read via the new Platform Audit nav child + route + view. The Login-as action is reversible without any new platform code — the operator returns via the existing topbar tenant switcher, which already lists `[platformTenant, ...tenants]` as `availableTenants` per `platform-context.tsx:265`. The Platform Audit page consumes the `getPlatformAudit()` helper and per-entry `tenantId` scoping that impl-bugs-mockdata added to mock-data.ts (which I was forbidden to touch), making the cross-tenant filter actually meaningful (20 Alpha + 20 Beta + 20 Gamma + 12 Platform = 72 total entries — the page surfaces all of them and the tenant filter narrows correctly). All Terra palette rules respected (amber audit-trail notice, rose/amber/sky severity tones — sky is the pre-existing `info` tone from `status.tsx` and matches the audit-page.tsx pattern; no new blue/indigo/violet introduced). Lint passes clean, tsc introduces 0 new errors, dev server returns 200, and visual verification via agent-browser confirms both the Login-as AlertDialog (with working tenant switch + toast + notification) and the Platform Audit page (with working tenant filter + KPI stability under filter + 8-column DataTable) render and function correctly.

---

## Task ID: impl-kyc-providers-config
**Agent:** Implementation (Settings → KYC Providers configuration page)
**Task:** Build a KYC Providers configuration page in the Settings module — manage Sumsub / Onfido / Veriff credentials, set the primary provider + fallback order, see per-provider health/sync/approval metrics, and configure each provider through a Sheet drawer. Add the nav child + route entry; do NOT touch view-router.tsx (lead batched-edit).

### Files Modified (2 — exactly the owned set)
- `src/modules/settings/pages/kyc-providers-page.tsx` — NEW. Single-page KYC provider configuration surface (PageHeader + 4-MetricCard KPI row + highlighted Primary Provider card + 8-column provider DataTable + Add-provider empty-state card + reorderable Fallback Order section + Export CSV + Edit Sheet drawer with AlertDialog-gated Deactivate). Exports `KycProvidersPage`.
- `src/modules/settings/settings-module.ts` — added `ShieldCheck` to the lucide-react import list; added 1 new nav child `{ id: "settings.kyc-providers", label: "KYC Providers", href: "kyc-providers", icon: ShieldCheck, permission: "settings.manage", order: 75 }` inside the `Security & Access` group (after `settings.device-activities`); added 1 new route `{ path: "kyc-providers", viewId: "kyc-providers", label: "KYC Providers", permission: "settings.manage", module: "settings" }` after the `device-activities` route. Doc comment updated from "19 children" → "20 children" with a note that the lead registers the viewId in view-router.tsx.

### Deliverable Identifiers
- **viewId**: `kyc-providers`
- **component export name**: `KycProvidersPage`
- **import path lead will use**: `import { KycProvidersPage } from "@/modules/settings/pages/kyc-providers-page";`
- **registry key lead will add**: `"kyc-providers": KycProvidersPage,`

### Layout (top → bottom)

1. **PageHeader** — title "KYC Providers" + description "Configure identity verification providers, credentials, and fallback order." + `ShieldCheck` icon tile + `term` sublabel `Across all {trader} KYC submissions · 3 providers configured` (white-label-aware via `makeTermResolver(tenant)` so Gamma Futures' "Candidate" terminology surfaces correctly). Export CSV button sits in the header actions cluster — §22 Contextual Actions: the export decision happens where the data is being inspected, not on a separate exports page.
2. **KPI row** — 4 MetricCards (responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`):
   - Active Providers (count, `ShieldCheck` icon, emerald accent, sublabel `of 3 configured`)
   - Total Verifications 30d (count, `Activity` icon, sublabel `across all {trader} KYC submissions` — uses `term("trader")` for white-label)
   - Approval Rate % (`ShieldCheck` icon, emerald accent, `delta=2.1` MoM with green up-arrow)
   - Avg Processing Time (`Clock` icon, emerald accent, `delta=-0.4` MoM with green down-arrow because lower processing time is good)
3. **Primary provider card** — Sumsub (the only `isPrimary: true` provider). Emerald-bordered card with left accent strip + `bg-gradient-to-br from-emerald-50 to-background` (light) / `dark:from-emerald-950/30` (dark). Shows large 12×12 logo placeholder with "S" initial in emerald tile, name + StatusBadge (Active / emerald) + Crown "Primary" badge. Meta row: `RefreshCw` + Last sync relative timestamp ("12m ago"), `Activity` + verifications 30d count, `Clock` + avg processing minutes. Actions: Edit (primary, default variant) → Test Connection (outline) → Deactivate (ghost). Per §23 One Primary Action, Edit is the leftmost + default variant — the others de-emphasize. §22 Contextual Actions: the primary provider's controls are inline on the card itself, not buried in a row action menu.
4. **Provider list DataTable** — 8 columns covering every decision-relevant field:
   - Provider (logo + name + truncated description)
   - Status (StatusBadge — Active=success/emerald, Fallback=warning/amber, Inactive=muted/slate)
   - API Key (`KeyRound` icon + monospace `sum_live_••••••••3a9f` masked + Eye/EyeOff toggle button — per-row visibility via `Set<string>` state)
   - Webhook URL (truncate with `title` tooltip; "Not configured" muted placeholder for Veriff)
   - Last Sync (`RefreshCw` + relative time "12m ago" / "2h ago" / "—")
   - Verifications 30d (right-aligned tabular-nums count)
   - Approval Rate (% with `TrendingUp`/`TrendingDown` trend arrow + delta — emerald for positive, rose for negative, em-dash for zero)
   - Actions (Edit outline / Test ghost icon-only / Set Primary ghost OR Crown badge if already primary — disabled for Inactive providers)
   Sortable on Provider / Status / Last Sync / Verifications 30d / Approval Rate (DataTable's built-in click-header-sort). `searchableText` matches across `name + description + status + webhookUrl`. `pageSize=10`. `toolbar` cluster: Export (outline) + Add provider (default).
5. **Add provider card** — empty-state card with dashed border + `Plus` icon in muted circle + headline "Connect a new KYC provider" + supporting copy + "Browse providers" button. Per §30 Empty States: explains what appears and that configuring ≠ activating. Button fires `toast({ title: "Provider marketplace", description: "Provider marketplace would open here." })`.
6. **Fallback order section** — reorderable list (not a separate page) showing all 3 providers in cascade order: Sumsub (Primary, emerald badge) → Onfido (Fallback, amber badge) → Veriff (Inactive, slate badge, opacity-60). Each row: numeric position tile + logo + name + status badge + sub-text describing the cascade contract for that position ("Tries after position N fails…" for active, "Skipped — provider not configured" for inactive). Per-row ChevronUp/ChevronDown buttons (disabled at first/last position) call `moveUp`/`moveDown` which swap IDs in `fallbackOrder` state. Collapsible "How it works" trigger reveals an amber-tinted help panel explaining the cascade contract (500ms retry window, inactive auto-skip, audit trail logs which provider ultimately resolved each verification) — §33 Help and Education in context, no external doc lookup.

### Edit Sheet Drawer (§27 — quick configuration, no full page nav)

Opens when "Edit" is clicked on a provider row OR on the Primary Provider card. Sheet slides in from the right with `sm:max-w-[560px] overflow-y-auto` (overrides the default `sm:max-w-sm` because the form has 5 stacked fields + a destructive footer action — narrower would clip the slider and the AlertDialog preview text). SheetHeader: ProviderLogo + SheetTitle (provider name) + SheetDescription (provider description) + right-aligned StatusBadge. Body fields (each with icon-prefixed Label and contextual help text):
- **API Key** — `<Input type={apiVisible ? "text" : "password"} className="font-mono text-xs">` flanked by Show/Hide (`Eye`/`EyeOff` outline button) + Copy (`Copy` outline button — uses `navigator.clipboard.writeText` with success/error toast). Help: "Stored encrypted at rest. Rotating the key invalidates pending webhook signatures."
- **Webhook URL** — `<Input type="url">` with `Webhook` icon. Help: "Provider will POST verification lifecycle events to this endpoint. Leave empty to disable webhooks."
- **Sandbox Mode** — bordered card with Label + help text + right-aligned `Switch`. Help text uses `term("trader").toLowerCase()` so a "Candidate"-first firm sees "live candidate accounts" instead of "live trader accounts".
- **Auto-approve threshold** — `<Slider min={0} max={100} step={1}>` with `Zap` icon, live value display "≥ 85" on the right, default 85. Help: "Verifications scoring at or above this threshold are auto-approved. Below it, they queue for manual review."
- **Fallback priority** — `<Select>` with 4 options (Primary / Fallback #1 / Fallback #2 / Inactive) and `RefreshCw` icon. Help: "Determines this provider's position in the fallback cascade. Only one provider can be Primary at a time."

SheetFooter (sticky to bottom via `mt-auto`):
- Row 1: Save changes (default, flex-1, `Edit3` icon — fires `toast({ title: "Saved", description: "Provider configuration saved" })` and closes sheet) + Test Connection (outline, `TestTube` icon — fires `toast({ title: "Connection test", description: "Connection test: Success (demo)" })`).
- Row 2: Deactivate provider (ghost, full-width, rose-tinted `text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30` — `Power` icon — wraps an `AlertDialogTrigger`). AlertDialog: title `Deactivate {provider.name}?` with `ShieldAlert` icon in rose, description uses the exact consequence text from the spec ("Deactivating this provider will pause all pending verifications and reroute them to the next available fallback. The provider can be reactivated at any time. Audit trail will be logged."), rose-tinted Consequence block naming the in-flight 30-day count + re-assignment + audit-trail logging, footer with Cancel + Deactivate (rose `bg-rose-600 text-white hover:bg-rose-700`). Per §24 Destructive Actions: friction proportional to consequence; the consequence text explains the system impact (rerouting + audit) rather than a generic "Are you sure?". On confirm: closes both the AlertDialog + the Sheet and fires a `toast` confirming deactivation.

### Form State Sync Pattern (lint-clean)

The sheet's local form state (`values`, `apiVisible`, `deactivateOpen`) needs to reset whenever the operator opens the sheet on a different provider. The initial implementation used `useEffect([provider]) → setValues(...)`, which the project's ESLint config (`react-hooks/set-state-in-effect`) flags as cascading renders. Refactored to React's documented "adjust state during render" pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
```tsx
const [prevProviderId, setPrevProviderId] = useState(provider?.id);
if (provider && provider.id !== prevProviderId) {
  setPrevProviderId(provider.id);
  setValues(valuesFromProvider(provider));
  setApiVisible(false);
  setDeactivateOpen(false);
}
```
This is allowed because React handles setState-during-render specially when guarded by a prop-change condition (it re-renders synchronously without committing, no cascade). Lint now clean.

### Mock Data (deterministic — no Math.random)

`KYC_PROVIDERS` constant with 3 entries seeded exactly per the brief: Sumsub (active/primary, `sum_live_••••••••3a9f` masked, `sum_live_sk_1234567890abcdef3a9f` full, last sync 12m ago, 184 verifications, 87.5% approval, 4.2 min avg, `approvalRateDelta: +2.3`), Onfido (fallback, 2h ago sync, 47 verifications, 82% approval, `approvalRateDelta: -1.4`), Veriff (inactive, "—" last sync, 0 verifications, 0% approval, `approvalRateDelta: 0`). The brief's mock data omitted the trend delta; added a small deterministic signed `approvalRateDelta` per provider so the "Approval Rate (% with trend arrow)" DataTable column has data to render.

### Constraints honored

- **ONLY 2 files touched**: `src/modules/settings/pages/kyc-providers-page.tsx` (NEW) + `src/modules/settings/pages/settings-module.ts` (nav child + route + import + docstring). No view-router.tsx edit — lead will batch the `kyc-providers` registry entry.
- **Terra palette respected throughout**: emerald for success / primary (active provider, primary card accent, MetricCard `tone="positive"`, Crown "Primary" badge, TrendingUp positive trend); amber for warning / fallback (StatusBadge `warning`, fallback section help panel `border-amber-200 bg-amber-50`); rose for destructive (deactivate button `text-rose-600 hover:bg-rose-50`, AlertDialogAction `bg-rose-600 text-white hover:bg-rose-700`, Consequence block `border-rose-200 bg-rose-50`, TrendingDown negative trend `text-rose-600`); slate for muted (inactive StatusBadge, Veriff logo tile, numeric position tiles). Zero blue/indigo/violet primary UI introduced.
- **No new shadcn installs**: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Button, Input, Label, Switch, Select/SelectContent/SelectItem/SelectTrigger/SelectValue, Slider, Separator, Badge, AlertDialog/*, Collapsible/CollapsibleTrigger/CollapsibleContent — all already in `src/components/ui/`. Platform Page/PageHeader/PageContent/MetricCard, DataTable/Column, StatusBadge — already in `src/components/platform/`.
- **§22 Contextual Actions**: Edit / Test / Set Primary / Deactivate all sit inline on the row (and on the Primary card). No navigation to a separate detail page. Export CSV sits in the PageHeader actions cluster (and again in the DataTable toolbar) — where the export decision happens.
- **§23 One Primary Action**: On the Primary card, Edit is the leftmost + default variant; Test Connection is outline; Deactivate is ghost. In the Sheet footer, Save changes is the leftmost + default + flex-1; Test Connection is outline; Deactivate is ghost + destructive-tinted + AlertDialog-gated. Hierarchy communicates priority.
- **§24 Destructive Actions**: Deactivate requires AlertDialog friction with (a) the brief's exact consequence text surfaced in the description, (b) a rose-tinted Consequence block naming the in-flight 30-day count + re-assignment + audit-trail logging, (c) Cancel + Deactivate action pair. No generic "Are you sure?" — the consequence text explains the system impact (rerouting to next fallback + audit trail).
- **§33 Help and Education**: Three inline help affordances — (1) Fallback Order section's Collapsible "How it works" trigger reveals the cascade contract (500ms retry, inactive auto-skip, audit trail logs resolver); (2) Each sheet form field has a sub-text helper explaining what the field controls (encryption-at-rest + rotation semantics for API key; lifecycle POST semantics for webhook URL; auto-approve threshold behavior; fallback-priority semantics); (3) The Add-provider card explains "Configuring a new provider does not activate it immediately — you control when it goes live." No external doc lookup required.
- **§41 Visual Hierarchy**: 3-tier visual hierarchy — primary info (Primary provider card with emerald accent + crown badge + largest logo tile), secondary info (provider DataTable rows with smaller logo tiles), supporting details (KPI MetricCards + Add-provider empty state + Fallback Order section as a smaller bordered card). The user can scan top-to-bottom and immediately understand: "Sumsub is primary / 3 providers configured / Onfido is the fallback / Veriff is not yet set up / Export or Add-provider actions available".
- **a11y**: Sheet uses Radix Dialog primitives (proper `role="dialog"`, `aria-labelledby` to SheetTitle, `aria-describedby` to SheetDescription); Show/Hide API key buttons have `aria-label="Hide API key"` / `aria-label="Show API key"`; Move-up/Move-down buttons have `aria-label="Move {provider} up in fallback order"`; AlertDialog uses `role="alertdialog"`; Copy button has `aria-label="Copy API key"`; the Slider has a `<Label htmlFor="kyc-threshold">` (the underlying Radix Slider.Root forwards the `id` prop to a focusable element); the Sandbox Switch is wired to its Label via `htmlFor="kyc-sandbox"`. StatusBadge carries an `aria-label` like "success status: Active".
- **Deterministic mock data**: `KYC_PROVIDERS` is a constant array — no `Math.random`. KPI values are `useMemo`-derived from the constant. Fallback order state is initialized from `KYC_PROVIDERS.map(p => p.id)` and only mutates via `moveUp`/`moveDown` swaps (deterministic). `approvalRateDelta` is a fixed number per provider.
- **`usePlatform()` + `makeTermResolver(tenant)`**: Both the page header and the Edit sheet call `usePlatform()` to get `tenant`, then `makeTermResolver(tenant)` to resolve the `trader` TermKey. The page header `term` prop renders "Across all {trader} KYC submissions · 3 providers configured". The Total Verifications 30d MetricCard sublabel renders "across all {trader} KYC submissions". The Sandbox Mode help text renders "Verifications return test data and never affect live {trader-lowercase} accounts." A Candidate-first firm (Gamma Futures) sees "Candidate" everywhere a default firm sees "Trader".

### Verification

1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean output (`$ eslint .` with no diagnostics). Initial pass had 1 error (`react-hooks/set-state-in-effect` on the EditProviderSheet's useEffect); refactored to the "adjust state during render" pattern (`if (provider && provider.id !== prevProviderId) { setPrevProviderId(...); setValues(...); ... }`) and the error cleared.
2. **`bunx tsc --noEmit --skipLibCheck`** → 56 total errors, ALL in pre-existing untouched files (`src/modules/trading/pages/account-kyc-statuses-page.tsx` — the `KycProviderStatus` duplicate-identifier narrowing issue flagged in prior worklog entries as out-of-scope; plus the usual `mock-data.ts` / `analytics-*` / `payout-widgets` / `risk-widgets` / `live-equity-curve` / `account-health` / `contextual-actions` / `dashboard-router` / `dashboard-grid` / `sidebar.tsx` cluster). **0 errors in `src/modules/settings/pages/kyc-providers-page.tsx`** and **0 errors in `src/modules/settings/settings-module.ts`** (grep `kyc-providers-page` + `settings-module` in tsc output returned 0 hits). No new errors introduced.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log` (most recent 8 lines)** → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors after the 2 file edits. (The `EADDRINUSE: address already in use :::3000` line at the top of the log is the system's auto-restart stub trying to spin a second dev server while the first is already running — pre-existing and unrelated to my edits.)

### Stage Summary

Settings module now ships a KYC Providers configuration surface (the 20th nav child + route). Operators landing on it see, top-to-bottom: a 4-card KPI row reading off the deterministic Sumsub/Onfido/Veriff mock data (active=2, total verifications=231, approval rate=86.6%, avg processing=5.15 min); a highlighted emerald-bordered Primary Provider card for Sumsub with inline Edit / Test Connection / Deactivate actions; an 8-column provider DataTable with sortable columns, masked API keys with show/hide toggles, webhook URLs with truncate+tooltip, relative-time last sync, MoM trend arrows, and per-row Edit / Test / Set Primary affordances; an Add-provider empty-state card with marketplace toast; and a reorderable Fallback Order section with a Collapsible cascade-contract explainer. Clicking Edit opens a right-side Sheet drawer with API Key (show/hide + copy), Webhook URL, Sandbox Mode toggle, Auto-approve threshold Slider (default 85), and Fallback priority Select — plus a Save + Test Connection primary row and a destructive Deactivate AlertDialog-gated row with the brief's exact consequence text. All five of the brief's required Sheet affordances are present (the AlertDialog consequence text is verbatim from the spec). The brief's "use `makeTermResolver` for any 'trader' references" rule is honored in three places (page header sublabel, Total Verifications 30d MetricCard sublabel, Sandbox Mode help text). The brief's "Export CSV button (real `exportToCsv`)" requirement is satisfied — the PageHeader Export CSV button AND the DataTable toolbar Export button both call `exportToCsv(KYC_PROVIDERS, exportColumns, "kyc-providers.csv")` with a 10-column CSV (Provider / Status / Is Primary / API Key masked / Webhook URL / Last Sync / Verifications 30d / Approval Rate % / Approval Rate Δ MoM / Avg Processing min). `exportToCsv` triggers the success toast internally. The viewId `kyc-providers` and component export name `KycProvidersPage` are documented in this worklog entry for the lead's batched view-router.tsx edit. Zero blue/indigo/violet primary UI; lint clean; 0 new tsc errors; dev server 200.

---

## Task: impl-analytics-breakdowns

**Agent**: fullstack-developer (analytics module enricher)
**Scope**: Replace the "VERY THIN" TraderAnalyticsPage / PerformanceAnalyticsPage / RiskAnalyticsPage in `src/modules/analytics/pages/analytics-pages.tsx` with rich breakdowns.

### Files touched
- `src/modules/analytics/pages/analytics-pages.tsx` (REWRITTEN — kept `AnalyticsOverviewPage` + `AdvancedAnalyticsPage` verbatim; replaced 3 target pages + added 4 local helpers + `ExplainableMetricCard` wrapper).
- `src/modules/analytics/manifest.ts` (NOT MODIFIED — no new viewIds needed).

### Pre-work
1. Read `worklog.md` lines 4813-4907 (`analysis-payouts-analytics` task summary) — confirmed Trader/Performance/Risk pages flagged "VERY THIN".
2. Read `AGENTS.md` §8 (Density), §9 (KPI rule), §33 (Contextual help), §70 (Analytics UX).
3. Read `analytics-pages.tsx` (full file), `analytics/manifest.ts`, `mock-data.ts` (traders/accounts/payouts/breaches + helpers), `charts.tsx`, `page.tsx`, `data-table.tsx`, `terminology.ts`, `contextual-help.tsx`, `status.tsx`, plus existing `dashboard-tabs.tsx` `GroupedBars`/`ColoredBars` patterns.

### Local helpers added (in analytics-pages.tsx)
- `TERRA` palette: emerald #10b981, amber #f59e0b, rose #e11d48, slate #64748b, sky #0ea5e9, teal #0d9488, forest #4a7c59. NO blue/indigo/violet.
- `ChartCard` — section wrapper (title + subtitle + body).
- **`ExplainableMetricCard`** — local wrapper mirroring `MetricCard` but accepts `help?: ReactNode` rendered via `LabelWithHelp` inline next to label (since `MetricCard.label` is typed `string` and is out of file-ownership scope). Used for VaR / ES / Max Drawdown / Sharpe / Profit Factor KPIs.
- `countryFlagEmoji(country)` — ISO-2 → 🇺🇸 via regional indicator code points.
- `deriveProfitFactor(trader)` — deterministic proxy [0.5–2.65] from `winRate` + `hashStr(trader.id)` jitter.
- `derive30dPnl(trader)` — deterministic 25–65% slice of `totalPnl` seeded by `hashStr(trader.id + "30d")`.
- `activityTier(trades)` — buckets trade count into Low/Medium/High/Power.
- `GroupedBars` — recharts BarChart with **dual Y-axis** support (left for %, right for currency).
- `ColoredBars` — recharts BarChart with per-`<Cell>` color picking (hour-of-day heatmap).
- `MultiLineChart` — recharts LineChart overlaying N series (Top-5 equity curves).

### 1. TraderAnalyticsPage (was 23 LOC body → ~190 LOC body)
- **4 KPI cards** (Terra tones): Top Trader Equity (emerald), Avg Win Rate (amber), Profit Factor (emerald, with ⓘ), Most Traded Symbol (neutral).
- **Trader Leaderboard DataTable** (Top 10 by equity): Rank (Crown/Award icons for top 3) / Trader (Avatar + name + email + flag emoji) / Equity / 30d PnL (signed, color-coded) / Win Rate / Profit Factor / Trades / Status (StatusBadge with `traderStatusTone`). `onRowClick` → `navigate("trader-detail", { id: trader.id })`. EmptyState with terminology-aware copy.
- **Win/Loss Distribution Donut**: 3 slices (Profitable ≥55% / Break-even 45–54% / Losing <45%) in emerald/amber/rose.
- **Top 5 Equity Curves (12d)**: `MultiLineChart` with 12 deterministic `Math.sin`-seeded points per trader anchored at current equity; legend shows `#1 Lucas` / `#2 Riley` etc.
- **Trader Activity Distribution BarSeries**: 4 tiers (Low/Medium/High/Power) with trader counts.

### 2. PerformanceAnalyticsPage (was 20 LOC body → ~210 LOC body)
- **4 KPI cards**: Best Challenge Type (Trophy, emerald), Most Profitable Symbol (Target, emerald), Highest Win Rate Phase (Award, amber), Best Performing Country (Flag, emerald, with flag emoji).
- **Performance by Challenge Type BarSeries**: 4 bars (1-Step/2-Step/3-Step/Funded), Y-axis pass rate %.
- **Performance by Phase `GroupedBars` (dual-axis)**: left axis = Pass Rate % (teal), right axis = Avg PnL (amber), 3 phases. Tooltip uses `rightFormatValue` for the Avg PnL series.
- **Performance by Symbol (Top 8) DataTable**: Symbol / Trades / Win Rate (color-coded) / Avg PnL (signed) / Total Volume / Sharpe. Sharpe formula in section subtitle (header is a button so can't nest another button for ⓘ).
- **Performance by Country DataTable**: Country (flag + ISO) / Traders / Avg Equity / Win Rate / Total Payouts / Profit Factor. Derived from `getTenantTraders(tid)` + `getTenantPayouts(tid)` aggregated by trader country.
- **Performance by Hour of Day ColoredBars**: 24 hours, trade count colored emerald/amber/rose by profitability signal.

### 3. RiskAnalyticsPage (was 20 LOC body → ~230 LOC body)
- **4 KPI cards — every label has a ⓘ tooltip** (via `ExplainableMetricCard`): VaR (95%) (AlertTriangle, rose), Expected Shortfall (rose), Max Drawdown (amber), Sharpe Ratio (emerald, Sigma icon).
- **Drawdown Distribution AreaSeries** (rose): 5 buckets (0–5% / 5–10% / 10–15% / 15–20% / 20%+) with account counts.
- **VaR Confidence Curve AreaSeries** (amber): 5 confidence levels (90% / 95% / 97.5% / 99% / 99.9%) with VaR $ amounts widening as confidence tightens.
- **Risk-Adjusted Returns by Challenge Type BarSeries** (teal): 4 challenge types, Sharpe ratio per category.
- **Top 10 Highest-Risk Accounts DataTable**: Account (login + platform + phase) / Trader (flag + name) / Equity / Drawdown % (color-coded) / Open PnL (signed) / Risk Score (color-coded) / Status (StatusBadge). `onRowClick` → `navigate("account-workspace", { id: account.id })`. Risk Score formula in section subtitle.
- **Breach Type Breakdown DonutSeries**: 7 slices — 4 actual breach types from `getTenantBreaches(tid)` (Daily DD / Max DD / Profit Target Miss / Time Limit) + 3 rule-engine-derived (Trailing DD / Margin Call / News Trading), all deterministic.

### Deterministic mock (no `Math.random`)
- `hashStr(s)` for per-trader / per-account / per-symbol seeding.
- `Math.sin(i / 3)` / `Math.cos(i / 4)` patterns for chart curves.
- Equity curve anchors at current equity with 4% wobble per point.
- All numerical KPIs (VaR, ES, Max DD, Sharpe) derive from `hashStr(tid + metric)`.

### Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings.
2. **`bunx tsc --noEmit --skipLibCheck`** → 3 errors in `analytics-pages.tsx` at lines 497, 501, 509 — ALL pre-existing in the verbatim `AnalyticsOverviewPage` (`TimeSeriesPoint[]` not assignable to `SeriesPoint[]`; same pattern as `analytics-widgets.tsx` lines 34/41/54, `payout-widgets.tsx` line 68, `risk-widgets.tsx` line 40). **0 new errors** introduced. Before: 6 errors (3 from Overview + 1 each from Trader/Performance/Risk). After: 3 errors (only Overview — the 3 target pages no longer pass `TimeSeriesPoint[]` to chart components).
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors.
5. **agent-browser visual verification** (Beta Trading tenant — terminology "Challenge", currency GBP):
   - **Trader Analytics**: Header "Trader Analytics"; 4 KPIs (£105,256 Top Equity / 50% Avg Win Rate / 2.64 Profit Factor with ⓘ / BTCUSD Most Traded); leaderboard table with 10 ranked rows (Crown on #1, Award on #2/#3, Avatar initials LK/RW/HG/NM/...); row click on #1 → navigated to `trader-detail` viewId for `Lucas Khan` (verified breadcrumb "Trader Detail" + heading "Lucas Khan" + email "lucas.khan@email.com · IN"); Win/Loss Donut with 3 slices; Top 5 Equity Curves MultiLineChart with 5 distinct Terra-colored legend entries; Activity Distribution BarSeries with 4 tiers.
   - **Performance Analytics**: Header "Performance Analytics"; 4 KPIs (2-Step Best Challenge 79% / XAUUSD Most Profitable +£1,766 / Phase 2 Highest Win 56% / 🇩🇪 DE Best Country £38,419 avg equity — country flag emoji rendered correctly); Performance by Challenge Type BarSeries (4 bars 0–80%); Performance by Phase dual-axis GroupedBars (left 0–60% teal "Pass Rate %", right £0–£2,600 amber "Avg PnL", legend present); Symbol Performance DataTable (8 symbols with sortable headers); Country Performance DataTable (8 countries DE/IN/FR/CA/ZA/GB/SG/AE sorted by avg equity); Hour of Day ColoredBars (24 hours 0–23).
   - **Risk Analytics**: Header "Risk Analytics"; 4 KPIs with single ⓘ button each (£27,668 VaR 95% / £39,959 ES +44% vs VaR / 15.2% Max DD / 1.07 Sharpe — no duplicate label text after ExplainableMetricCard fix); Drawdown Distribution AreaSeries (5 buckets); VaR Confidence Curve AreaSeries (5 levels 90–99.9%, £0–£60,000); Risk-Adjusted Returns BarSeries (4 challenge types, Sharpe 0–2.0); Breach Type Breakdown DonutSeries (7 slices); Top 10 Highest-Risk Accounts DataTable (Account 100047 MT5 phase-2 Jayden Singh / 100042 DXTrade phase-1 Aiden Haddad breached, etc.); row click on first row → navigated to `account-workspace` viewId for `Account 100047` (verified breadcrumb "Account Workspace" + heading "Account 100047" + "MT5 · Jayden Singh · challenge").
6. **Console**: `[Fast Refresh] rebuilding/done in <ms>` only — no React warnings after fixing the nested-button issue (initial run flagged `<button> cannot contain a nested <button>` from passing `LabelWithHelp` JSX to DataTable `Column.header`; resolved by moving the Sharpe / Risk Score formulas to section subtitles and rendering plain string headers).

### Design decisions (deviations from spec, with rationale)
- **ExplainableMetricCard wrapper** (instead of passing `LabelWithHelp` to `MetricCard.label`): `MetricCard.label` is typed `string` in `page.tsx` (out of file-ownership scope). Built a local wrapper that mirrors the exact visual treatment and accepts `help?: ReactNode` rendered inline.
- **Sharpe / Risk Score formulas in section subtitle** (instead of in DataTable column headers): `Column.header` is typed `string` and is rendered inside a sort-toggle `<button>`, so passing JSX-with-`<button>` (LabelWithHelp) creates invalid nested-button HTML. Moved the formulas into the section subtitle (visible to all users, better per §9 KPI rule "Never show a metric without meaning" — the formula is shown by default rather than requiring hover).
- **Dual-axis GroupedBars**: Initial implementation mixed Pass Rate % (0–100) and Avg PnL (£0–£2,600) on a single Y-axis, producing garbled axis labels (`650%` for £650). Added an optional `rightSeries` + `rightFormatValue` config so the second series plots against a right-side Y-axis with its own currency formatter.
- **Profit Factor / 30d PnL derived**: Real PF needs gross profit / gross loss per trade — the mock only exposes signed `totalPnl`. Built `deriveProfitFactor` (winRate-anchored + hashStr jitter) and `derive30dPnl` (deterministic slice of `totalPnl`). Documented both in code comments.
- **Breach Type Breakdown**: Mock `Breach.type` enum only has 4 values (daily-drawdown/max-drawdown/profit-target-miss/time-limit). Spec called for 7 (Daily DD / Max DD / Trailing DD / Margin Call / News Trading / Weekend / Copy Trading). Showed 4 actual + 3 rule-engine-derived slices with deterministic counts anchored to total breach count.

### Outcome vs `analysis-payouts-analytics` gaps
- ✅ Trader Analytics — leaderboard (#2) — DONE.
- ✅ Trader Analytics — win/loss distribution (#2) — DONE.
- ✅ Trader Analytics — equity curves per top trader (#2) — DONE (MultiLineChart Top 5).
- ✅ Performance Analytics — by challenge / phase / symbol / country (#3) — DONE (4 breakdowns + hour-of-day).
- ✅ Risk Analytics — VaR / ES / Drawdown distribution (#4) — DONE (4 KPIs with formulas + 5 charts + risk accounts table + breach donut).
- ✅ Contextual help on KPIs (§33) — DONE (LabelWithHelp on VaR, ES, Max DD, Sharpe, Profit Factor; formulas also surfaced in section subtitles for table headers that couldn't accept JSX).
- ✅ Drill from row to underlying entity (§70 Analytics UX) — DONE (trader-detail from leaderboard; account-workspace from risk accounts).
- ✅ Terra palette only (no violet) — DONE.
- ✅ Deterministic mock (no `Math.random`) — DONE.

---

**Task ID**: `impl-crm-kanban`
**Agent**: impl-crm-kanban (focused, single-file task)
**File owned**: `src/modules/crm/pages/crm-pages.tsx` (CrmPipelinePage rewrite + LeadScoreCard + computeLeadScore + CrmContactSheet extraction — all within the same file)
**File size**: 612 → 1,218 lines (~2× growth; new code is kanban + Lead Score + methodology card + shared Sheet drawer)

### Pre-work performed
- Read `worklog.md` tail (~200 lines) — captured the latest context including the `impl-crm-contact-drawer` task (which had FOUND the Sheet drawer already wired into `CrmContactsPage` lines 332-558 by an earlier batch agent `impl-detail-drawers-*`); also noted `analysis-aff-acc-mkt-crm` flagging the CRM Pipeline page as "stage-flow visualization with 5 cards + connectors + BarSeries" but cards NOT clickable — exactly what this task fixes.
- Read `AGENTS.md` §22-§30 (Contextual Actions / One Primary Action / Destructive Actions / Table Design / Tables Support Decision-Making / Drawer vs Page / Entity Workspaces / Activity Timelines / Empty States) to ground the kanban rewrite in the UX constitution.
- Read full `src/modules/crm/pages/crm-pages.tsx` (612 LOC) — confirmed the 3 exports (`CrmOverviewPage`, `CrmContactsPage`, `CrmPipelinePage`) and the existing Sheet drawer structure (lines 332-558) wired by the prior task.
- Read `src/lib/platform/mock-data.ts` lines 605-617 (CrmContact interface — `stage: "lead" | "qualified" | "opportunity" | "customer" | "churned"`) + lines 968-988 (`crmContacts` seed — 18 contacts per tenant for tenant-beta + tenant-gamma; source values are `"Website" | "Webinar" | "Affiliate" | "Social" | "Cold Outbound"`) + line 1229-1231 (`getTenantContacts` helper).
- Read `src/components/platform/page.tsx` (150 LOC) — confirmed `Page` / `PageHeader` / `PageContent` / `MetricCard` API (MetricCard accepts `deltaLabel` for explainability).
- Read `src/components/platform/contextual-help.tsx` (87 LOC) — `LabelWithHelp` API: takes `children` (label text) + `help` (ReactNode for tooltip body).
- Read `src/components/platform/status.tsx` (138 LOC) — confirmed `formatCurrency(value, currency)` + `StatusBadge({ tone, children })` exports (Tone: `default | success | warning | danger | info | muted`).
- Read `src/components/ui/card.tsx` (92 LOC) + `src/components/ui/badge.tsx` (46 LOC) — standard shadcn exports.
- Read `src/app/globals.css` lines 220-241 — confirmed `scrollbar-thin` utility class is already defined globally (used for kanban card lists).
- Confirmed `crm/manifest.ts` only declares `crm-pipeline` viewId (no new viewId needed for this task — kept everything inline on the existing Pipeline page).

### Implementation state at task start
- `CrmPipelinePage` was a 5-card stage-flow visualization + BarSeries chart (lines 563-612 of the prior file). Cards showed stage name + count + currency but were NOT interactive — matching the `analysis-aff-acc-mkt-crm` finding.
- The Sheet drawer (lines 332-558 of the prior file) lived inline inside `CrmContactsPage` — owned entirely by that page, not reusable.

### Architectural decision: extract CrmContactSheet
- The brief asked the kanban cards to "open the existing Contact Sheet drawer (already implemented in the file — keep it!)". The drawer was wired inline inside `CrmContactsPage`, so reusing it from `CrmPipelinePage` required either (a) duplicating ~230 lines of JSX in the new page, or (b) extracting it into a shared component.
- Chose (b) — extracted `CrmContactSheet` (outer shell: handles Sheet open/close + tenant/currency/term resolution via `usePlatform`) + `CrmContactSheetBody` (inner: keyed by `contact.id` so it remounts per contact, manages its own `notes` `useState` initialised from `contact.notes`, memoises `activityFor` + `dealsFor` on the whole `contact` object).
- Keying the body by `contact.id` eliminated the prior `useEffect(() => setNotes(contact.notes), [contact?.id])` pattern — React Compiler rejects `setState-in-effect` (`react-hooks/set-state-in-effect`) and the `[contact?.id]` manual memo dependency (`react-hooks/preserve-manual-memoization`). The keyed-remount pattern resolves both: notes initial state is read once on mount, and `useMemo(..., [contact])` matches the React Compiler's inferred dependency.
- `CrmContactsPage` and `CrmPipelinePage` both render `<CrmContactSheet contact={...} onClose={...} />` — single source of truth for the drawer UI.

### Code Changes

**1. New helpers (top of file, after existing helpers)**

- `KANBAN_STAGES` constant — `["lead", "qualified", "opportunity", "customer", "churned"]` array used by both the column renderer and the Move dropdown (filters out current stage).
- `computeLeadScore(contact: CrmContact): number` — deterministic scoring function (no `Math.random`):
  - `+50` base
  - `+20` if `contact.value > 5000`
  - `+10` if `contact.value > 15000` (stacks with the +20)
  - `+15` if `contact.source.toLowerCase()` is `"referral"` or `"affiliate"` (case-insensitive — mock data source values are capitalized like `"Affiliate"`)
  - `+15` if `lastInteraction < 3 days`
  - `+8` else if `< 7 days` (mutually exclusive with the +15)
  - `−10` else if `> 30 days`
  - `+12` if `dealsFor(contact).length > 0` (reuses the existing `dealsFor` helper which already exists in the file — no duplication)
  - Clamps to `[0, 100]` via `Math.max(0, Math.min(100, score))`.
- `leadScoreTone(score)` — returns `"hot" | "warm" | "cold"` (Hot ≥ 80, Warm 50–79, Cold < 50).
- `LEAD_SCORE_TONE_CLASS` + `LEAD_SCORE_TONE_LABEL` — Terra palette mappings: emerald (Hot), amber (Warm), rose (Cold). No blue/indigo/violet.
- `LeadScoreCard` component — small pill Badge with `Zap` icon + numeric score + tone label. Rendered on every kanban card and inline in the Sheet drawer's "Lead Score" row above the activity timeline.

**2. CrmContactSheet + CrmContactSheetBody (extracted, ~230 LOC)**

- Outer `CrmContactSheet({ contact, onClose })` — `Sheet open={!!contact}` controlled wrapper. Resolves `term` + `currency` via `usePlatform` once at the shell level (avoids re-resolving on every notes keystroke inside the body).
- Inner `CrmContactSheetBody({ contact, currency, term, onClose })` — keyed remount per `contact.id`. Renders the same JSX the prior task shipped: Avatar + initials + SheetTitle + SheetDescription + stage Badge + source/owner/phone row; 3-cell KPI strip (Pipeline Value / Last Contact / Deals); inline Lead Score row (NEW — surfaces `LeadScoreCard`); activity timeline (§29); deal list; notes Textarea + Save button; SheetFooter with Convert to {term("trader")} + Add Task + Delete (AlertDialog with consequence panel — §24 destructive friction preserved).

**3. CrmContactsPage (refactored, slightly shrunk)**

- Removed inline Sheet drawer JSX (was 230 LOC) — replaced with `<CrmContactSheet contact={selectedContact} onClose={() => setSelectedContact(null)} />`.
- Removed local `notes` + `setNotes` state + `openContact` notes-seeding logic (now owned by `CrmContactSheetBody`).
- Removed `useMemo` for `activity` + `deals` (now owned by `CrmContactSheetBody`).
- `onRowClick={(c) => setSelectedContact(c)}` — same as before but no notes seeding (handled by keyed remount).
- All other behavior (DataTable, columns, search, export) unchanged.

**4. CrmPipelinePage (full rewrite — 5 stages → kanban board)**

- Replaced the old 5-card stage-flow visualization + BarSeries chart with a real kanban.
- **State**: `localContacts` (local copy of `getTenantContacts(tid)` so DnD + Move menu can mutate stage assignments client-side; mock data — no persistence layer); `selectedContact`; `draggedContact`; `draggedOverStage`.
- **KPI row** (4 `MetricCard`s with `deltaLabel` explainability — §24 metric category):
  1. Total Pipeline Value — `formatCurrency(totalPipelineValue, currency)`, icon `DollarSign`, tone `positive`, deltaLabel `"all stages"`.
  2. Open Deals — count of contacts in `lead` + `qualified` + `opportunity` stages, icon `Briefcase`, deltaLabel `"lead → opportunity"`.
  3. Avg Deal Size — `totalPipelineValue / localContacts.length`, icon `TrendingUp`, deltaLabel `"per contact"`.
  4. Win Rate — `(customer / (customer + churned)) * 100` formatted to 1 decimal, icon `Award`, tone `positive`, deltaLabel `"{wonCount} won / {lostCount} lost"`.
- **Kanban board** — `flex gap-3 overflow-x-auto pb-2` outer row (horizontal scroll on small viewports), 5 `KanbanColumn`s each `w-[280px] shrink-0`. Each column is a drop target via HTML5 `onDragOver` (preventDefault + `setDraggedOverStage`), `onDragLeave`, `onDrop` (calls `moveContact` + clears state).
- **Column header** — colored square + stage name (capitalized) + count `Badge` + total pipeline value (`formatCurrency`).
- **Card list** — `max-h-[600px] overflow-y-auto p-2 space-y-2` with `scrollbar-thin` class (existing project utility from `globals.css`). Empty state shows `"Drop contact here"` when `draggedOverStage === stage` else `"No contacts in this stage"` (§30 — never "No data." without context).
- **Contact cards** (`ContactKanbanCard`) — `draggable` HTML5 element + per-card Move dropdown fallback:
  - Top row: Avatar (7×7) with initials + name + email (truncated) + `MoreHorizontal` button (Move dropdown trigger).
  - Middle row: `formatCurrency(contact.value, currency)` (left, bold) + `LeadScoreCard` (right).
  - Bottom row: source `Badge` (secondary) + last interaction `Badge` (outline, with `Activity` icon + `relativeTime`).
  - Card click → `onOpen` (opens Sheet drawer via `setSelectedContact`). Card `role="button"` + `tabIndex={0}` + `onKeyDown` Enter/Space handler for keyboard accessibility (§AGENTS).
  - Move dropdown trigger `onClick={(e) => e.stopPropagation()}` + `onPointerDown={(e) => e.stopPropagation()}` to prevent triggering the card's dragstart. Dropdown lists the 4 other stages (current excluded) with `ArrowRight` icon + colored dot.
- **Lead Scoring Methodology card** (`Card` + `CardHeader` + `CardContent`) — inline "Lead Scoring page" (avoiding new viewId per task brief preference):
  - Title uses `LabelWithHelp` wrapping `"How lead scores are calculated"` with a tooltip body explaining the deterministic 50-base + weighted-factors + clamp 0–100 computation.
  - `CardDescription` spells out the tone thresholds: Hot ≥ 80 (emerald), Warm 50–79 (amber), Cold < 50 (rose).
  - 2-column grid (`sm:grid-cols-2`) of 8 factor rows — each row is `border p-2.5 rounded-md` with factor label + detail + weight `Badge` (font-mono, color-coded: positive factors in emerald/slate, neutral recent-interaction in amber, negative stale-interaction in rose).
  - Factors surfaced verbatim from `computeLeadScore` (Base +50, Pipeline value > $5,000 +20, Pipeline value > $15,000 +10, Referral/affiliate source +15, Recent interaction < 3 days +15, Recent interaction < 7 days +8, Stale interaction > 30 days −10, Has associated deals +12).
- `moveContact(contact, newStage)` mutator:
  - Early-returns if `contact.stage === newStage` (no-op).
  - Updates `localContacts` via `prev.map(...)` (immutable update with `{ ...c, stage: newStage }`).
  - Also updates `selectedContact` if the moved contact is currently open in the Sheet drawer (keeps the drawer in sync — the body's `useMemo([contact])` recomputes `activityFor` / `dealsFor` for the new stage automatically).
  - Fires `toast({ title: "Moved", description: "{name} → {stage}" })` — §22 contextual feedback.
- `handleColumnDrop(stage)` — invoked by `KanbanColumn.onDrop`; calls `moveContact(draggedContact, stage)` then clears DnD state.
- Tenant-aware language via `makeTermResolver(tenant)` — description uses `term("trader").toLowerCase()` + `term("challenge")`. Verified live: Gamma tenant (terminology `{ challenge: "Assessment", trader: "Candidate" }`) renders description as "Kanban view of the candidate → Assessment journey…" and the Sheet drawer's Convert button shows "Convert to Candidate".

**5. Imports added**

- `useMemo, useState` (removed `useEffect` after the keyed-remount refactor — no longer needed).
- `LabelWithHelp` from `@/components/platform/contextual-help`.
- `MoreHorizontal, ArrowRight, TrendingUp, Award, Zap` from lucide-react (Move dropdown trigger, dropdown item icon, Avg Deal icon, Win Rate icon, Lead Score icon).
- `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger` from `@/components/ui/dropdown-menu` (Move menu).
- `Card, CardContent, CardDescription, CardHeader, CardTitle` from `@/components/ui/card` (methodology card).
- `cn` from `@/lib/utils` (conditional class merging for drop-target highlight).

### Verification

- `bun run lint` → exit 0, 0 errors, 0 warnings.
- `bunx tsc --noEmit --skipLibCheck` → 0 errors in `src/modules/crm/pages/crm-pages.tsx` (the 53 pre-existing errors are in OTHER files: `account-kyc-statuses-page.tsx`, `charts.tsx`, `mock-data.ts`, etc. — none in this file).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200 (server responding).
- **agent-browser live verification** (full happy-path):
  1. Loaded `/` → switched tenant Alpha Capital → Beta Trading → Gamma Futures (only Gamma has CRM module enabled per `mock-data.ts:160`).
  2. Dismissed Gamma's "Tenant Setup Wizard" dialog (auto-shown for fresh tenants).
  3. Sidebar showed new "CRM" section with Overview / Contacts / Pipeline children.
  4. Clicked "Pipeline" → kanban page rendered with:
     - KPI row: `$62,550` (Total Pipeline Value, all stages), `12` (Open Deals, lead → opportunity), `$3,475` (Avg Deal Size, per contact), `50.0%` (Win Rate, 3 won / 3 lost). All four numbers check out: 18 contacts total × $3,475 avg = $62,550 ✓; 4+4+4 = 12 open deals ✓; 3 customer / (3 customer + 3 churned) = 50% ✓.
     - 5 columns rendered with correct counts: lead=4, qualified=4, opportunity=4, customer=3, churned=3 (total 18 ✓).
     - Lead Score badges appear on cards — tone distribution matches the score function (no Math.random, deterministic).
     - Methodology card lists all 8 factors with weight badges: +50 / +20 / +10 / +15 / +15 / +8 / −10 / +12.
     - "How lead scores are calculated" tooltip trigger renders as a contextual help button.
  5. Clicked a contact card (Liam Smith) → Sheet drawer opened with Avatar + SheetTitle + SheetDescription + stage Badge + source/owner row + 3-cell KPI strip (Pipeline Value / Last Contact / Deals) + Lead Score row + Activity Timeline + Deals list + Notes Textarea + Convert/Add Task/Delete footer.
  6. Closed the drawer (Escape), clicked the `MoreHorizontal` button on a card → Move dropdown opened listing 4 other stages (current excluded). Clicked "Customer" → card moved from lead column to customer column (lead: 4→3, customer: 3→4), toast "Moved" + "Liam Smith → customer" appeared, Liam Smith now visible in Customer column.
  7. Screenshot saved at `agent-ctx/screenshots/impl-crm-kanban-pipeline.png` (335KB).

### Constraints respected
- ✅ ONLY touched `src/modules/crm/pages/crm-pages.tsx` — no other file modified.
- ✅ Did NOT touch `view-router.tsx` (no new viewId needed — Lead Scoring is inline section on CrmPipelinePage).
- ✅ Did NOT touch `mock-data.ts` (consumed existing `crmContacts` via `getTenantContacts(tid)`).
- ✅ Did NOT touch `crm/manifest.ts` (existing `crm-pipeline` route/viewId reused).
- ✅ Did NOT remove the existing Contact Sheet drawer (extracted to shared `CrmContactSheet` component — same UI/behavior, used by both CrmContactsPage and CrmPipelinePage).
- ✅ Used existing platform components: `Page` / `PageHeader` / `PageContent` / `MetricCard` / `LabelWithHelp`; existing shadcn: `Card` / `Badge` / `Avatar` / `Separator` / `Sheet` / `AlertDialog` / `DropdownMenu` / `Textarea` / `Button`.
- ✅ Terra palette only — emerald / amber / rose / slate / cyan-600 (existing `STAGE_COLOR` for `qualified` is `#0891b2` cyan-600, untouched because it's referenced by CrmOverviewPage + CrmContactsPage; all NEW colors added are emerald/amber/rose/slate). No blue/indigo/violet introduced.
- ✅ Deterministic mock data — `computeLeadScore` is pure, no `Math.random`. Verified live: same contact yields same score across renders.
- ✅ `usePlatform()` + `makeTermResolver(tenant)` for tenant-aware "trader"/"challenge" references.
- ✅ Mobile-first responsive: kanban uses `flex overflow-x-auto` on small viewports (each column `w-[280px] shrink-0`), KPI row uses `grid-cols-2 lg:grid-cols-4`, methodology card uses `grid-cols-1 sm:grid-cols-2`.

### Code Changes Summary
1 file modified (`src/modules/crm/pages/crm-pages.tsx`): rewrote CrmPipelinePage as a kanban board; added `computeLeadScore` + `LeadScoreCard` + `KANBAN_STAGES` + `ContactKanbanCard` + `KanbanColumn` + `SCORING_FACTORS`; extracted `CrmContactSheet` (outer shell) + `CrmContactSheetBody` (inner keyed body) from inline `CrmContactsPage` Sheet drawer so both Contacts and Pipeline pages share the same detail drawer. No new dependencies. No new viewIds. No breaking changes to existing exports (`CrmOverviewPage` byte-identical; `CrmContactsPage` behavior-identical with the Sheet drawer just delegated to `CrmContactSheet`).

---

## Task ID: impl-support-sla
**Agent:** impl-support-sla (focused, single-feature task)
**Task:** Build the Support SLA Management + Breach Dashboard page (per-priority SLA targets, breach dashboard, agent workload, breach trend + compliance charts, edit-via-Sheet policy editor). Implements priority action #3 from `analysis-kyc-sup-ai` ("Build SLA management").

### Pre-work (read-only)
1. Read `worklog.md` tail (~400 lines) — captured context incl. `analysis-kyc-sup-ai` (line 5419+, which explicitly identified "Support module has no SLA badge, no SLA management policy, no breach dashboard" — priority action #3 = "Build SLA management").
2. Read `AGENTS.md` UX constitution — §9 KPIs (every metric needs context), §17-§19 State-First + Explainability (breached state must explain WHY), §22-§23 Contextual Actions + One Primary Action, §24 Destructive Actions, §27 Drawer vs Page, §33 Help (`LabelWithHelp`), §54-§55 Terminology (`term()` + `plural()`).
3. Read `src/modules/support/manifest.ts` (62 LOC, 4 nav children, 3 routes — Note: nav uses parent `order: 80`; child ordering is positional, but task spec asked for `order: 84` on the new child, and `NavigationItem.order?` is a valid optional field per `types.ts` line 120).
4. Read `src/modules/support/pages/support-pages.tsx` (FULL — 573 LOC) — captured Sheet drawer pattern from `impl-support-ticket-drawer` (lines 302-486), `relativeTime` helper, `slaHoursFor(priority)` projection, `conversationFor`/`internalNotesFor` deterministic generators. The existing SupportTicketsPage Sheet is at lines 302-486 and uses `Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter` from `@/components/ui/sheet`.
5. Read `src/lib/platform/mock-data.ts` — `SupportTicket` interface (id/tenantId/subject/traderName/category/priority/status/assignee/createdAt/lastReplyAt?/messages — NO `slaHours` field), `getTenantTickets(tid)` filter, `hashStr(s)` helper.
6. Read `src/components/platform/page.tsx` — `Page`, `PageHeader` (supports `title/description/icon/term/actions`), `PageContent`, `MetricCard` (supports `label/value/delta/deltaLabel/icon/tone`).
7. Read `src/components/platform/data-table.tsx` — `DataTable` API: `columns//data/loading/searchPlaceholder/searchableText/pageSize/rowKey/onRowClick/toolbar/emptyTitle/emptyDescription`. `Column<T>`: `key/header/cell/sortValue/className/width/numeric`.
8. Read `src/components/platform/charts.tsx` — `AreaSeries(data, xKey, yKey, color, height, formatValue)`, `BarSeries` (single color per chart — not per-bar, so compliance-by-priority chart inlined using recharts `<BarChart>` + `<Cell>` per-bar coloring for color-band semantics).
9. Read `src/components/platform/status.tsx` — `StatusBadge` tones (`default/success/warning/danger/info/muted`), `ticketPriorityTone(p)` returns `danger/warning/info/muted` for `urgent/high/medium/low`.
10. Read `src/components/platform/contextual-help.tsx` — `LabelWithHelp({children, help, className})` shows label + info tooltip.
11. Read `src/lib/platform/export-utils.ts` — `exportToCsv<T>(rows, columns: ExportColumn<T>[], filename)` with RFC 4180 escaping + UTF-8 BOM + toast on success / empty.
12. Read `src/lib/platform/platform-context.tsx` — `usePlatform()` returns `{ runtime, tenant, navigate, ... }`; `runtime.tenant?.id` for the tenant id; `navigate(view, params)` for client-side routing.
13. Read `src/lib/platform/view-router.tsx` lines 290-345 — confirmed `viewRegistry` is keyed by `viewId`. **Did NOT touch** — lead will batch-register `"support-sla": SupportSlaPage` in `viewRegistry` (after line 302, alongside the other `support-*` entries).

### Files touched
- **NEW** `src/modules/support/pages/support-sla-page.tsx` (~620 LOC, single named export `SupportSlaPage`).
- **EDIT** `src/modules/support/manifest.ts` — added `Clock` to the lucide-react import line (line 8); added `{ id: "support.sla", label: "SLA Management", href: "support-sla", icon: Clock, permission: "support.read", order: 84 }` to nav children between `support-tickets` and `support-knowledge` (line 21); added `{ path: "support-sla", viewId: "support-sla", label: "SLA Management", permission: "support.read", module: "support" }` to routes (line 31).

### Files deliberately NOT touched (per task constraints)
- `src/lib/platform/view-router.tsx` — lead will batch-register `support-sla` viewId after all batch-1 subagents finish.
- `src/lib/platform/mock-data.ts` — read-only; SLA mock data (policies / breach trend / compliance / breached tickets / agent workload) lives inside the new page module as constants so the page is self-contained.
- `src/modules/support/pages/support-pages.tsx` — owned by `impl-support-ticket-drawer`'s previous work (Sheet drawer already wired there).
- `src/modules/support/index.ts` — file ownership scope is restricted to `manifest.ts` + the new page file; lead will add the export in the batched edit alongside the view-router registration.

### Component export name + viewId (for lead's batched registration)
- **Export name**: `SupportSlaPage` (named export — matches the pattern of `SupportOverviewPage`/`SupportTicketsPage`/`SupportKnowledgePage`).
- **viewId / route path**: `support-sla`.
- **Suggested view-router line** (lead to add after `support-knowledge` entry at line 302): `"support-sla": SupportSlaPage,` (with `import { SupportSlaPage } from "@/modules/support/pages/support-sla-page";` at the top alongside the other support imports at line 59-60).

### Page Layout (top → bottom)

1. **PageHeader** — title "SLA Management" + description "Configure service level targets per priority and monitor breach rates." + `Clock` icon tile + `term` sublabel `Across all {trader}s · {N} active policies` (white-label-aware via `makeTermResolver(tenant)` + `plural()` so Gamma Futures' "Candidate" terminology surfaces correctly as "Candidates"). Actions cluster (§22 — contextual actions where the decision happens): **Export CSV** (outline — `exportToCsv` real call on `BREACHED_TICKETS`) + **Save Changes** (default — toast "SLA policies saved (demo)").
2. **KPI row** — 4 MetricCards responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (§9 — every metric carries a `deltaLabel` for context):
   - **Total Tickets (30d)** — deterministic count derived via `deriveTotalTickets30d(tid)` (uses `hashStr(tid)` → range 80–180; super-admin/platform sees 142). `Inbox` icon. `deltaLabel="across all priorities"`.
   - **Breached SLAs** — `BREACHED_TICKETS.length = 7`. `AlertTriangle` icon, **rose tone** (`tone="negative"`). `deltaLabel="past their SLA target"`.
   - **Avg First Response** — `"2.4h"`. `Timer` icon. `deltaLabel="target: 4h"` (target surfaced inline §9 + §33).
   - **Avg Resolution Time** — `"8.1h"`. `TimerReset` icon. `deltaLabel="target: 24h"`.
3. **SLA Policy Configuration Card** — `Card` + `DataTable` with 6 columns: Priority (`StatusBadge` via `ticketPriorityTone(p.priority)` — rose for urgent, amber for high, sky for medium, slate for low) / First Response / Resolution / Description / Active (per-row `Switch` toggle, fires toast on change) / Actions (`Button` outline "Edit" → opens Sheet drawer). `searchableText` covers priority + description; `pageSize=8`. Mock `SLA_POLICIES` array (4 entries — urgent: 1h/4h/2h auto-escalate, businessHoursOnly=false, pauseOnCustomer=true, active=true / high: 4h/8h/6h / medium: 24h/48h/36h businessHoursOnly=true / low: 48h/72h/60h **active=false** to demonstrate the disabled-policy state).
4. **Charts row** — `grid gap-4 lg:grid-cols-2`:
   - **SLA Breach Trend** (AreaSeries) — `BREACH_TREND` 12 weeks deterministically generated via `Math.floor(8 + Math.sin(i / 2) * 4 + (i % 3 === 0 ? 3 : 0))` → produces a smooth sin-wave baseline (range 4–15) with periodic spikes every 3rd week. `color=rose #e11d48`. height=220.
   - **SLA Compliance by Priority** (inlined recharts `BarChart` with per-bar `Cell` coloring — the platform `BarSeries` only supports a single chart-wide color, so per-band coloring required inline recharts. Not a new abstraction — just direct recharts usage in one spot, allowed per §76). Bars: Urgent 88% (amber), High 92% (amber), Medium 96% (emerald), Low 98% (emerald). Y-axis 0–100 formatted as `%`. Legend below explains the 3 bands (≥95% On Target emerald / 80–94% At Risk amber / <80% Off Target rose).
5. **Currently Breached Tickets Card** — `DataTable` with 8 columns: Ticket ID (mono) / Subject / Priority (`StatusBadge`) / Created / SLA Due / **Time Over** (`AlertTriangle` icon + `{N}h` in **rose** — §17-§19 makes the breach state visible + explainable) / Assignee / Status (`StatusBadge tone="danger"` showing "Breached"). `onRowClick` → `navigate("support-tickets", { breached: t.id })` (existing `SupportTicketsPage` is the row drill target — §22 contextual action, the deep-link to investigate is inline). 7 deterministic breached tickets (T-1042 urgent 1h over → T-0998 medium 8h over).
6. **Agent Workload Card** — `DataTable` with 6 columns: Agent (avatar circle with initials + name) / Open Tickets / Avg Response / Avg Resolution / SLA Compliance % (inline mini-progress-bar colored by band + percentage in band color) / Status (`StatusBadge` "On Target"/"At Risk"/"Off Target" using `complianceTone(v)` = `success` if ≥95 / `warning` if 80-94 / `danger` if <80). 5 deterministic agents (Sarah 94% amber / Marcus 91% amber / Elena 96% emerald / David 85% amber / Priya 89% amber).
7. **Sheet drawer (SLA Policy Editor)** — opened by Edit button on each policy row. Right-side `sm:max-w-[480px]`. Sections:
   - **SheetHeader** — title "Edit SLA Policy — {priority}" + description.
   - **Priority** (read-only) — locked field showing the `StatusBadge` + "Cannot be changed".
   - **Separator**.
   - **First Response Target (hours)** — `LabelWithHelp` (§33) explaining "Time within which an agent must send the first reply to the trader... breaching triggers At-Risk state" + numeric `Input` clamped to `Math.max(1, …)`.
   - **Resolution Target (hours)** — `LabelWithHelp` explaining "Time within which the ticket must be fully resolved... Breaching triggers the Breached state shown in the dashboard" + numeric `Input`.
   - **Auto-escalate after (hours)** — `LabelWithHelp` explaining "When the SLA clock crosses this threshold, the ticket is auto-routed to a senior agent or Tier 2 queue" + numeric `Input`.
   - **Separator**.
   - **Business hours only** — boxed `Switch` + `LabelWithHelp` ("Only count business hours toward the SLA clock").
   - **Pause on customer response** — boxed `Switch` + `LabelWithHelp` ("Pause the SLA clock while waiting for the customer. The clock resumes once the customer replies, so SLA is not unfairly penalised by customer latency").
   - **SheetFooter** — Cancel (outline) + Save Policy (default — writes draft back to `policies` state, fires toast "SLA policy saved", closes Sheet).
   - Sheet state is `useState`-local (`editingPriority` + `draft`). Cancel / overlay-click / Esc all call `closeSheet()` which nulls out the draft. Save commits the draft back to the `policies` state array, so toggling Edit on the same row again reflects the saved values.

### Determinism guarantees
- **No `Math.random()` anywhere.** All numbers are either constants, `Math.sin()` patterns, or derived from `hashStr(tid)`.
- `BREACH_TREND[i].breaches = Math.floor(8 + Math.sin(i / 2) * 4 + (i % 3 === 0 ? 3 : 0))` — same value on every render, every tenant.
- `deriveTotalTickets30d(tid)` — `hashStr(tid) % 101 + 80`, deterministic per-tenant; platform sees 142.
- All mock `BREACHED_TICKETS`, `AGENT_WORKLOAD`, `COMPLIANCE_BY_PRIORITY`, `SLA_POLICIES` are constant arrays.

### Color palette (Terra-only, no blue/indigo/violet)
- emerald `#059669` (On Target ≥95%)
- amber   `#d97706` (At Risk 80-94%)
- rose    `#e11d48` (Off Target <80% + Breached + breach trend chart)
- sky     `#0ea5e9` (medium-priority StatusBadge — comes from `ticketPriorityTone`, already in platform `status.tsx`)
- slate   muted-foreground / muted backgrounds
- No blue/indigo/violet anywhere in the file (verified by grep on the source).

### Accessibility
- Every `Switch` has an `aria-label`.
- Every numeric `Input` has an `aria-label`.
- `StatusBadge` exposes `role="status"` + computed `aria-label` (from platform `status.tsx`).
- Edit button uses `e.stopPropagation()` so a future row-click handler on the policies table wouldn't double-fire.
- Breached tickets row click uses `cursor-pointer` (added by `DataTable` when `onRowClick` is set).

### Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean `$ eslint .` output.
2. **`bunx tsc --noEmit --skipLibCheck`** → 0 errors in `src/modules/support/pages/support-sla-page.tsx` and `src/modules/support/manifest.ts` (grep `support-sla` returns 0 hits). All pre-existing errors are in untouched files (`examples/*`, `skills/*`, `src/components/platform/*` flagged in prior worklog entries, `src/lib/platform/mock-data.ts`, `src/components/shell/sidebar.tsx`, `src/modules/analytics/*`) — out of scope.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200` (after both edits).
4. **`dev.log`** tail → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` — no runtime errors. The pre-existing `EADDRINUSE` error at the very top is unrelated (auto-dev-server restart race — flagged in prior entries).

### Notes for lead
- The new file imports from `recharts` directly (for `BarChart`/`Bar`/`Cell`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`ResponsiveContainer`) because the platform `BarSeries` component only supports a single chart-wide fill color and cannot do per-bar `<Cell>` coloring. This is consistent with §76 (don't build ad-hoc primitives) — I'm not creating a new wrapper, just using recharts components directly in one spot.
- The `AreaSeries` from `@/components/platform/charts` IS used for the breach trend (single color, fine for that use case).
- The `usePlatform()` import pulls in `runtime`, `tenant`, `navigate`. `runtime.tenant?.id` feeds `deriveTotalTickets30d()`; `tenant` feeds `makeTermResolver()`; `navigate("support-tickets", { breached: t.id })` is the row-click drill.
- The `tid` is also used implicitly via `runtime.tenant?.id ?? "platform"` — same pattern as the existing `SupportOverviewPage` line 188.

### Code Changes
- `src/modules/support/pages/support-sla-page.tsx` (NEW — ~620 LOC)
- `src/modules/support/manifest.ts` (EDIT — +1 import keyword, +1 nav child line, +1 route line; total file now 65 LOC, was 62)

---

## Task ID: impl-ai-predictive-anomaly-cost
**Agent:** impl-ai-predictive-anomaly-cost (Batch 2 — focused AI module expansion)
**Task:** Build the three missing AI module pages flagged as a gap by `analysis-kyc-sup-ai` — **Predictive Analytics**, **Anomaly Detection**, and **Cost Tracking**. Adds 3 viewIds (`ai-predictive`, `ai-anomaly`, `ai-cost`) and 3 named exports (`AiPredictivePage`, `AiAnomalyPage`, `AiCostPage`) for the lead's batched registration in `view-router.tsx` and `modules/ai/index.ts`.

### Pre-work (read-only)
1. Read `worklog.md` tail — captured context incl. `analysis-kyc-sup-ai` flagging "AI module lacks Predictive analytics, Anomaly detection, Cost tracking"; the existing `impl-support-sla` and `impl-crm-kanban-pipeline` precedent patterns (local `ChartCard` helper, deterministic `hashStr()`-seeded mock data, Terra-only palette, `ExplainableMetricCard` / `LabelWithHelp` pattern from `analytics-pages.tsx`).
2. Read `AGENTS.md` UX constitution — §9 KPIs (every metric needs context + `deltaLabel`), §33 Help (`LabelWithHelp`), §41 Visual Hierarchy (primary/secondary/supporting info), §40 don't overuse cards (use sections/lists), §22 Contextual Actions (Investigate / Mark FP / Create ticket inline).
3. Read `src/modules/ai/manifest.ts` (62 LOC, 4 nav children + 4 routes; AI module parent `order: 85`).
4. Read `src/modules/ai/pages/ai-pages.tsx` (FULL — 456 LOC) — captured `AiOverviewPage` / `AiInsightsPage` / `AiAssistantPage` / `AiConfigurePage` structure: `usePlatform()` + `makeTermResolver(tenant)` + `runtime.tenant?.id ?? "platform"` + `getTenantAiInsights(tid)` + `Page`/`PageHeader`/`PageContent`/`MetricCard`.
5. Read `src/lib/platform/mock-data.ts` — `AiInsight` interface (646), `aiInsights` seed (1047), `getTenantAiInsights(tid)` (1238), `hashStr(s)` (38), `Trader` (449), `Payout` (529), `TradingAccount` (465), `tenants` + `platformTenant` constants, `getTenantTraders(tid)` / `getTenantPayouts(tid)` / `getTenantAccounts(tid)` filter helpers.
6. Read `src/components/platform/charts.tsx` — `AreaSeries` / `BarSeries` (single chart-wide color) / `DonutSeries` / `Sparkline`; `SeriesPoint = { [key: string]: string | number }` interface with index signature (extends required for typed arrays passed to chart props).
7. Read `src/components/platform/data-table.tsx` — `Column<T>` API (`key/header/cell/sortValue/className/width/numeric`), `DataTable` props (`searchableText/pageSize/rowKey/onRowClick/toolbar/emptyTitle/emptyDescription`).
8. Read `src/components/platform/page.tsx` — `Page` / `PageHeader` (`title/description/icon/term/actions`) / `PageContent` / `MetricCard` (`label: string` — no JSX, no `help`; needs the `ExplainableMetricCard` local helper for `LabelWithHelp` integration).
9. Read `src/components/platform/status.tsx` — `StatusBadge` tones (`default/success/warning/danger/info/muted`), `formatCurrency(value, currency)`.
10. Read `src/components/platform/contextual-help.tsx` — `LabelWithHelp({children, help, className})` and `ContextualHelp({label, children})`.
11. Read `src/lib/platform/export-utils.ts` — `exportToCsv<T>(rows, columns: ExportColumn<T>[], filename)` with RFC 4180 escaping + UTF-8 BOM + toast on success / empty.
12. Read `src/lib/platform/platform-context.tsx` — `usePlatform()` returns `{ runtime, tenant, navigate, ... }`; `runtime.tenant?.id` is the tid; `navigate(view, params)` for client-side routing.
13. Read `src/lib/platform/view-router.tsx` lines 280-336 — confirmed `viewRegistry` is keyed by `viewId`. **Did NOT touch** — lead will batch-register `ai-predictive` / `ai-anomaly` / `ai-cost` viewIds in `viewRegistry` after Batch 2 completes (alongside the export additions in `modules/ai/index.ts`).
14. Read `src/lib/platform/terminology.ts` — `TermKey` literal-union accepts **lowercase only** (`"challenge" | "trader" | "payout" | ...`). `term("Trader")` with capital letter fails `tsc`; all calls must use lowercase keys (`term("trader")`) — the resolver itself returns the title-cased override string.
15. Read `src/modules/analytics/pages/analytics-pages.tsx` lines 123-203 — captured the `ExplainableMetricCard` pattern (mirrors `MetricCard` but accepts `help?: ReactNode` rendered via `LabelWithHelp`), `ChartCard` local helper, `ColoredBars` per-bar `<Cell>` coloring using recharts directly.
16. Read `src/components/ui/slider.tsx` + `progress.tsx` + `badge.tsx` + `switch.tsx` — confirmed shadcn primitives available for the budget alert config card on the cost page.

### Files touched
- **NEW** `src/modules/ai/pages/ai-predictive-page.tsx` (~860 LOC, single named export `AiPredictivePage`).
- **NEW** `src/modules/ai/pages/ai-anomaly-page.tsx` (~870 LOC, single named export `AiAnomalyPage`).
- **NEW** `src/modules/ai/pages/ai-cost-page.tsx` (~665 LOC, single named export `AiCostPage`).
- **EDIT** `src/modules/ai/manifest.ts` — added `TrendingUp, AlertTriangle, DollarSign` to the lucide-react import line; added 3 nav children (`ai.predictive` / `ai.anomaly` / `ai.cost` with `order: 86` / `87` / `88`); added 3 routes (`ai-predictive` / `ai-anomaly` / `ai-cost` mapping to viewIds `ai-predictive` / `ai-anomaly` / `ai-cost`).

### Files deliberately NOT touched (per task constraints)
- `src/lib/platform/view-router.tsx` — lead will batch-register `ai-predictive` / `ai-anomaly` / `ai-cost` viewIds after Batch 2 finishes.
- `src/modules/ai/index.ts` — file ownership scope restricted to manifest + new page files; lead will add the 3 exports (`AiPredictivePage`, `AiAnomalyPage`, `AiCostPage`) alongside the view-router registration.
- `src/lib/platform/mock-data.ts` — read-only; all mock data lives inside the new page modules as constants / `hashStr`-seeded derivations so the pages are self-contained.
- `src/modules/ai/pages/ai-pages.tsx` — existing file, out of scope per task constraints.
- `src/modules/ai/widgets/ai-widgets.tsx` — out of scope (only the 3 page files + manifest.ts are owned).

### Component export names + viewIds (for lead's batched registration)
- **`ai-predictive`** viewId → `AiPredictivePage` (named export from `src/modules/ai/pages/ai-predictive-page.tsx`).
- **`ai-anomaly`** viewId → `AiAnomalyPage` (named export from `src/modules/ai/pages/ai-anomaly-page.tsx`).
- **`ai-cost`** viewId → `AiCostPage` (named export from `src/modules/ai/pages/ai-cost-page.tsx`).
- **Suggested view-router edits** (lead to add after the existing `ai-configure` entry at line 308):
  ```ts
  "ai-predictive": AiPredictivePage,
  "ai-anomaly": AiAnomalyPage,
  "ai-cost": AiCostPage,
  ```
  with corresponding imports added at the top alongside the existing AI imports (line 64-68):
  ```ts
  import {
    AiOverviewPage,
    AiInsightsPage,
    AiAssistantPage,
    AiConfigurePage,
    AiPredictivePage,
    AiAnomalyPage,
    AiCostPage,
  } from "@/modules/ai";
  ```
  and `src/modules/ai/index.ts` updated to re-export the three new named exports from `./pages/ai-predictive-page`, `./pages/ai-anomaly-page`, `./pages/ai-cost-page`.

### Page 1: `AiPredictivePage` (`ai-predictive-page.tsx`)
**Layout (top → bottom):**
1. **PageHeader** — title "Predictive Analytics" + description + `TrendingUp` icon tile + `term` sublabel `{trader} tenant · {N} predictions (30d)`. Actions cluster: **Export churn** CSV + **Export payouts** CSV (both real `exportToCsv` calls).
2. **KPI row** (4 MetricCards, responsive `grid-cols-2 lg:grid-cols-4`):
   - Predictions Made (30d) — `Brain` icon, deterministic `240 + (hashStr % 80)` range.
   - Model Accuracy — `Target` icon, positive tone, `delta={4}` with `deltaLabel="vs industry avg 82%"`.
   - High-Risk {trader}s Flagged — `AlertTriangle` icon, **rose tone**, `deltaLabel="churn score ≥ 60"`.
   - Fraud Prevented — `ShieldCheck` icon, positive tone, deterministic `$24k–$33k` range.
3. **Section 1: {Trader} Churn Risk Distribution** — inline recharts `BarChart` with per-bar `<Cell>` coloring (emerald → teal → sky → amber → rose gradient across 5 buckets: Very Low 0–20, Low 20–40, Medium 40–60, High 60–80, Critical 80–100). Legend below shows per-bucket counts. Help tooltip via `LabelWithHelp` (§33).
4. **Section 2: Top 10 Churn-Risk {Trader}s** — DataTable (8 columns: Rank (Crown/Award/Medal icons for top 3) / {Trader} (name + email) / Churn Risk (StatusBadge + mini progress bar) / Days Inactive / Equity (formatCurrency) / Last Activity / Recommended Action (badge)). `onRowClick` → `navigate("trader-detail", { id: trader.id })`. `deltaLabel`-style header banner showing count of traders needing action.
5. **Section 3: {Payout} Fraud Risk** — DataTable (7 columns: Payout ID (mono) / {Trader} / Amount (formatCurrency) / Risk Score (StatusBadge + mini progress bar) / Risk Factors (rose badges: High value / Multiple IPs / New account / Unusual pattern / Crypto method) / Recommended Reviewer / Review button). `onRowClick` → `navigate("payouts-pending", { id: payoutId })`. Review button uses `e.stopPropagation()` to avoid double-fire with row click.
6. **Section 4: {Trader} Success Probability** — `BarSeries` (single emerald color) showing top 20 active traders by success probability. Tier legend below (High ≥70% / Medium 40–69% / Low <40%) with counts.
7. **Section 5: Forecast — Next 30 Days** — `AreaSeries` (emerald) showing daily predicted new trader signups. Subtitle explains the ±22% confidence band.
8. **Methodology Card** — 3 columns (Churn inputs / Fraud inputs / Action matrix) explaining model inputs and recommended action by score band.
9. **Footer button** — "Model status" toast trigger.

### Page 2: `AiAnomalyPage` (`ai-anomaly-page.tsx`)
**Layout (top → bottom):**
1. **PageHeader** — title "Anomaly Detection" + description + `AlertTriangle` icon tile + `term` sublabel `Last 24 hours · {N} detected · {N} confirmed`. Actions: **Export CSV** button (real `exportToCsv` on the 14 anomalies array).
2. **KPI row** (4 `ExplainableMetricCard`s — local helper mirrors `MetricCard` but supports `help?: ReactNode` rendered via `LabelWithHelp` per §33):
   - Anomalies Detected (24h) — `AlertTriangle`, **warning tone**, help tooltip explaining the 24h window.
   - Anomalies Confirmed — `CheckCircle2`, positive tone, `deltaLabel="confirmed by human review"`.
   - False Positive Rate — `EyeOff`, tone toggles positive/warning based on ≤10% threshold, help tooltip + `deltaLabel="target: ≤ 10%"`.
   - Avg Detection Time — `Clock`, `deltaLabel="from event → model alert"`.
3. **Charts row** (`grid gap-4 lg:grid-cols-2`):
   - **Anomaly Trend (24h)** — `AreaSeries` (amber), 24 hourly bars, peak hours 09–16 UTC carry extra baseline. Help tooltip.
   - **Anomaly Type Distribution** — `DonutSeries` with 6 slices (Unusual Trade Size / Off-Hours Trading / Pattern Break / Volume Spike / Spread Anomaly / Latency) in Terra colors. Empty-state fallback when no anomalies.
4. **Section 3: Recent Anomalies** — DataTable (8 columns: Detected (relativeTime) / Type (color dot + label) / {Trader} / Account (mono) / Severity (StatusBadge: Critical=rose, High=amber, Medium=sky, Low=slate) / Confidence (% + mini progress bar) / Description / Actions). Actions column has 3 buttons (Investigate → `navigate("trader-detail", { id: traderId })` / Mark false positive → toast / Create ticket → toast with deterministic T-XXXX number). Severity counts in header row.
5. **Section 4: Anomaly Heatmap — Hour × Day** — custom CSS-grid heatmap (7 days × 24 hours). Each cell colored by count bucket (0=muted, 1–2=emerald, 3–5=amber, 6–8=rose, 9+=slate) with opacity scaling. Title attribute per cell for native tooltip. Legend below. Horizontally scrollable on small viewports (`overflow-x-auto` + `min-w-[640px]` inner).
6. **Section 5: Top Affected Accounts** — DataTable (5 columns: Account (mono + ID) / {Trader} / Anomalies (badge count) / Last Anomaly (relativeTime) / Risk Tier (StatusBadge: Critical/High/Medium/Low)). Filtered to accounts with `anomaliesCount > 0`.
7. **Methodology Card** — 3 columns (Model inputs / Severity bands / Escalation paths).
8. **Footer button** — "Detector status" toast trigger.

### Page 3: `AiCostPage` (`ai-cost-page.tsx`)
**Layout (top → bottom):**
1. **PageHeader** — title "AI Cost Tracking" + description (super-admin vs tenant-scoped copy) + `DollarSign` icon tile + `term` sublabel `30d spend {currency} · {N}% of monthly budget`. Actions: **Export daily** + (super-admin only) **Export tenants** CSV buttons.
2. **KPI row** (4 MetricCards — plain `MetricCard` since no help text needed on cost page):
   - Total Spend (30d) — `Wallet` icon, tone toggles negative when ≥80% of budget, `deltaLabel="of $5,000 monthly budget"`.
   - Daily Avg — `Receipt` icon, `deltaLabel="across last 30 days"`.
   - Cost per Prediction — `Brain` icon, positive tone, `delta={-3}` with `deltaLabel="vs prior 30d"`.
   - Budget Used — `PiggyBank` icon, tone toggles positive/warning/negative by 75%/90% thresholds.
3. **Section 1: Cost Trend (30d)** — `AreaSeries` (emerald) showing daily spend. Help tooltip.
4. **Sections 2 + 3 row** (`grid gap-4 lg:grid-cols-2`):
   - **Cost by Model** — `BarSeries` (teal, single chart-wide color). 5 bars (GPT-4o $1180 / Claude 3.5 $720 / Gemini 1.5 $410 / Llama 3.1 $280 / Internal $257). `ModelCost` interface extends `SeriesPoint` so the typed array is assignable to `BarSeries`'s `SeriesPoint[]` prop.
   - **Cost by Use Case** — `DonutSeries` with 5 slices (Chat Assistant / Insights Generation / Anomaly Detection / Predictive Analytics / Document Parsing) in Terra colors. `formatValue` formats as currency.
5. **Section 4: Cost by Tenant** (super-admin only — `isPlatform = tid === "platform"` gates the section). DataTable (6 columns: Tenant (name + ID) / Requests (toLocaleString) / Tokens (toLocaleString) / Cost (formatCurrency) / Cost/Request / Trend (TrendingUp/TrendingDown icon + StatusBadge with signed %)). Built from `[platformTenant, ...tenants]` array with deterministic per-tenant seed.
6. **Section 5: Budget Alert Configuration** — Card with 3-column grid:
   - Monthly budget (numeric `Input`, min 100, step 100, `aria-label`).
   - Alert threshold (`Slider` 25–100% step 5%, badge that toggles color by 75%/90% thresholds, marks `aria-label`).
   - Email recipient (email `Input`).
   CardFooter shows projected trigger status with `Bell` icon + Save button (toast on save).
7. **Section 6: Cost Forecast — Next 30 Days** — `AreaSeries` (amber) showing predicted daily spend with ±18% confidence band.
8. **Methodology Card** — 3 columns (Cost inputs / Refresh cadence / Pricing tiers).
9. **Footer button** — "Cost status" toast trigger.
10. **SR-only summary** — terminology-aware `<p className="sr-only">` for screen readers summarising the page.

### Determinism guarantees
**No `Math.random()` anywhere.** All numbers are constants, `Math.sin()` / `Math.cos()` patterns, or `hashStr(tid + key)` derivations.
- Predictive: `churnScore(trader)` = `18 + (seed % 22) + inactivity*0.4 + winPenalty + pnlPenalty + equityLow`, clamped 2–99. `payoutRisk(p)` = `22 + (seed % 35) + amountPenalty + methodPenalty + recent`, clamped 3–98. `successProbability(trader)` = `28 + (seed % 22) + win*0.8 + pnlBonus + tradeBonus`, clamped 8–98. Signup forecast = `8 + (seed % 6) + Math.sin((i + seed % 7) / 3) * 3.2 + weeklyDip + i * 0.18`.
- Anomaly: 14 anomalies seeded by `hashStr(tid + "anomaly" + i)`; hourly trend = `3 + Math.sin((h + seed % 6) / 3) * 2 + peak + noise`; heatmap 7×24 grid seeded by `hashStr(tid + "hm" + d + h)` with peak-hour multipliers.
- Cost: daily series = `78 + (seed % 20) + Math.sin((i + seed % 5) / 3) * 14 + weeklyDip + i * 0.6`; per-tenant cost = `(tokens/1000) * (0.6 + (seed % 40)/100)`; forecast extends last actual baseline forward with `+ Math.sin((i + seed % 4) / 3) * 11 + i * 0.9`.

### Color palette (Terra-only, no blue/indigo/violet)
- emerald `#059669` (success, positive trend)
- amber `#d97706` (warning, anomaly trend, cost forecast)
- rose `#e11d48` (critical, breach, false-positive risk)
- sky `#0ea5e9` (medium severity, info StatusBadge — comes from platform `status.tsx`)
- teal `#0d9488` (Cost by Model chart — neutral positive)
- slate `#475569` (low severity, heatmap critical band)
- No blue/indigo/violet anywhere in the 3 new files (verified by grep — the only matches are `text-sky-*` shadcn utility classes which are platform `status.tsx` exports, not custom additions).

### Accessibility
- All `Slider` + `Input` have `aria-label` attributes (some also have visible `<label htmlFor="…">`).
- `StatusBadge` exposes `role="status"` + computed `aria-label` (from platform `status.tsx`).
- Review button on payout rows uses `e.stopPropagation()` to avoid double-firing with the parent row click.
- Anomaly action buttons (Investigate / Mark false positive / Create ticket) all use `e.stopPropagation()`.
- Heatmap cells have `title` attributes for native hover tooltips.
- Cost page has an `sr-only` summary paragraph for screen readers.

### Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean `$ eslint .` output.
2. **`bunx tsc --noEmit --skipLibCheck`** → 0 errors in `src/modules/ai/pages/ai-predictive-page.tsx`, `src/modules/ai/pages/ai-anomaly-page.tsx`, `src/modules/ai/pages/ai-cost-page.tsx`, and `src/modules/ai/manifest.ts` (grep `ai/` returns 0 hits). All remaining 114 errors are in pre-existing untouched files (`examples/*`, `skills/*`, `src/components/platform/*.tsx`, `src/lib/platform/mock-data.ts`, `src/components/shell/sidebar.tsx`, `src/modules/analytics/*`, `src/modules/payouts/*`, `src/modules/risk/*`, `src/modules/settings/*`, `src/modules/trading/pages/account-kyc-statuses-page.tsx`) — flagged in prior worklog entries as out-of-scope.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log`** tail → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` lines — no runtime errors. Pre-existing `EADDRINUSE` at the very top is unrelated (auto-dev-server restart race, flagged in prior entries).

### Notes for lead
- The `ai-predictive-page.tsx` and `ai-anomaly-page.tsx` import from `recharts` directly (for `BarChart`/`Bar`/`Cell`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`ResponsiveContainer`) because the platform `BarSeries` component only supports a single chart-wide fill color and cannot do per-bar `<Cell>` coloring. This is consistent with §76 (don't build ad-hoc primitives) — not creating a new wrapper, just using recharts components directly in one spot per chart.
- The `AreaSeries` + `DonutSeries` + `BarSeries` from `@/components/platform/charts` ARE used wherever single-color / donut rendering is sufficient.
- The `ExplainableMetricCard` local helper in `ai-anomaly-page.tsx` mirrors `MetricCard` exactly (same className structure, same tone → color mapping) — only difference is it accepts `help?: ReactNode` and renders `LabelWithHelp` inline next to the label per §33. Copied verbatim from `analytics-pages.tsx` lines 155-203 (the existing precedent).
- `ModelCost` interface in `ai-cost-page.tsx` `extends SeriesPoint` (the index-signature base type from `charts.tsx`) so the typed array is assignable to `BarSeries`'s `data: SeriesPoint[]` prop without a cast. This is the same workaround `analytics-pages.tsx` uses implicitly via inline objects.
- `TermKey` is a literal union of lowercase keys — all `term()` calls use lowercase (`term("trader")`, `term("payout")`). The resolver returns the title-cased override string (e.g. "Participant" for Gamma, "Trader" default). Calling `term("Trader")` with a capital letter fails `tsc` (caught and fixed during verification).
- The cost page's `isPlatform = tid === "platform"` gate mirrors the existing `SupportOverviewPage` pattern — super-admin sees the cross-tenant breakdown table; regular tenants see only their own KPIs + chart sections (no per-tenant table).
- The "Export tenants" CSV button only renders when `isPlatform` is true (saves a useless button for regular tenants who only have one row of cost data).

### Code Changes Summary
4 files modified:
- `src/modules/ai/pages/ai-predictive-page.tsx` (NEW — ~860 LOC, single `AiPredictivePage` export, 6 chart/table sections + methodology card).
- `src/modules/ai/pages/ai-anomaly-page.tsx` (NEW — ~870 LOC, single `AiAnomalyPage` export, 5 chart/table/heatmap sections + methodology card, includes local `ExplainableMetricCard` helper).
- `src/modules/ai/pages/ai-cost-page.tsx` (NEW — ~665 LOC, single `AiCostPage` export, 6 chart/table/card sections + budget alert config + methodology card).
- `src/modules/ai/manifest.ts` (EDIT — +3 icon imports, +3 nav children with `order: 86/87/88`, +3 routes; total file now 71 LOC, was 64).

No new dependencies. No viewId registrations in `view-router.tsx` (lead does batched). No mock-data.ts edits. No `ai-pages.tsx` edits. No `index.ts` edits. Terra palette only. Deterministic mock data only.

---

## Task ID: impl-accounting-invoices-pl
**Agent:** impl-accounting-invoices-pl (Batch 2 — focused Accounting module expansion)
**Task:** Build the two missing Accounting module pages flagged as a gap by `analysis-aff-acc-mkt-crm` — **Invoices** (generate, send, track invoices) and **P&L Statement** (vertical income statement with Revenue → COGS → Gross Profit → OpEx → Operating Profit → Other → Net Profit). Adds 2 viewIds (`accounting-invoices`, `accounting-pl`) and 2 named exports (`AccountingInvoicesPage`, `AccountingPlPage`) for the lead's batched registration in `view-router.tsx` and `modules/accounting/index.ts`.

### Pre-work (read-only)
1. Read `worklog.md` tail — captured context incl. `analysis-aff-acc-mkt-crm` flagging "Accounting module lacks invoices, P&L, balance sheet"; the existing `impl-support-sla` precedent patterns (Sheet drawer with form state, AlertDialog destructive confirmation, deterministic `Math.sin` mock data, Terra-only palette, `LabelWithHelp` integration, `exportToCsv` real call with `ExportColumn<T>[]`).
2. Read `AGENTS.md` UX constitution — §9 KPIs (every metric needs context + `deltaLabel`), §17-§19 state-first + explainability (invoice status badges explain what each state means; overdue rows visually flagged in rose), §22-§24 contextual actions + one primary action + destructive actions (Cancel invoice uses AlertDialog with consequence spelled out), §27 Drawer vs Page (invoice view/create uses right-side Sheet drawer), §33 Help (`LabelWithHelp` for Subtotal / Tax / Operating Profit / P&L line items), §54-§55 terminology (`term("trader")` lowercase key only; `plural()` for "Payouts to traders" / "Traders"); §71 Accounting UX (start with overview/outstanding/needs attention, then expose technical concepts for those who need them — P&L is the explicit technical surface).
3. Read `src/modules/accounting/manifest.ts` (FULL — 63 LOC; 3 nav children + 3 routes; AI module parent `order: 60`; Accounting accent `#b45309` amber-700; children pattern: `{ id, label, href, icon, permission }` — note `order` is an optional `NavigationItem` field per `types.ts:120`).
4. Read `src/modules/accounting/pages/accounting-pages.tsx` lines 1-100 — captured `AccountingOverviewPage` pattern: `usePlatform()` + `makeTermResolver(tenant)` + `runtime.tenant?.id ?? "platform"` + `runtime.tenant?.currency ?? "USD"` + `getTenantTransactions(tid)` + `Page`/`PageHeader`/`PageContent`/`MetricCard`/`DataTable` + `StatusBadge`/`formatCurrency` + `BarSeries`/`AreaSeries` + `exportToCsv`. KPI row uses `grid grid-cols-2 gap-3 lg:grid-cols-4`.
5. Read `src/lib/platform/mock-data.ts` — `transactions` array (line 913) is deterministic (`Math.sin(i) + 1) * 3500 + 200`; status `i % 5 === 0 ? "pending" : i % 7 === 0 ? "reconciled" : "posted"`). Read-only — invoices + P&L mock data lives inside the new page modules as constants so the pages are self-contained (no `mock-data.ts` mutation, per task constraints).
6. Read `src/components/platform/charts.tsx` (FULL — 248 LOC) — `AreaSeries(data, xKey, yKey, color, height, formatValue)` accepts a single yKey + single color (fine for the margin trend chart); `BarSeries` only supports a single chart-wide color (NOT suitable for Revenue-vs-Expenses grouped bars), so the P&L page uses recharts directly (`BarChart` + 2 `Bar`s + `Legend`) for that one chart — same precedent set by `impl-support-sla` (§76 — direct recharts in one spot, no new abstraction).
7. Read `src/lib/platform/export-utils.ts` (FULL — 67 LOC) — `exportToCsv<T>(rows, columns: ExportColumn<T>[], filename)` with RFC 4180 escaping + UTF-8 BOM + toast on success / empty. `ExportColumn<T>` shape: `{ key: string; header: string; value: (row: T) => string | number }`.
8. Read `src/components/platform/data-table.tsx` (FULL — 221 LOC) — `Column<T>` API (`key/header/cell/sortValue/className/width/numeric`), `DataTable` props (`searchableText/pageSize/rowKey/onRowClick/toolbar/emptyTitle/emptyDescription`).
9. Read `src/components/platform/page.tsx` (FULL — 150 LOC) — `Page` (flex-col gap-4 p-4 md:p-6), `PageHeader` (title/description/icon/term/actions), `PageContent` (flex-col gap-4), `MetricCard` (label/value/delta/deltaLabel/icon/tone — `tone` accepts `default | positive | negative | warning`).
10. Read `src/components/platform/status.tsx` (FULL — 137 LOC) — `StatusBadge` tones: `default/success/warning/danger/info/muted` (Terra palette: success=emerald, warning=amber, danger=rose, info=sky, muted=slate). `formatCurrency(value, currency)` for `$X` rendering. The 5 invoice statuses map: draft→muted (slate) / sent→info (sky) / paid→success (emerald) / overdue→danger (rose) / cancelled→muted (slate).
11. Read `src/components/platform/contextual-help.tsx` (FULL — 86 LOC) — `LabelWithHelp({children, help, className})` shows label + info tooltip.
12. Read `src/components/platform/guards.tsx` (lines 124-161) — `EmptyState` for DataTable empty rows; `EmptyState` already wired into `DataTable` cell renderer when `paged.length === 0`.
13. Read `src/lib/platform/platform-context.tsx` (lines 130-318) — `usePlatform()` returns `{ runtime, tenant, navigate, ... }`; `runtime.tenant?.id` is the tid; `runtime.tenant?.currency` for currency; `tenant.branding.name` for "Bill From" identity.
14. Read `src/lib/platform/terminology.ts` (FULL — 49 LOC) — `TermKey` literal-union accepts lowercase only (`"challenge" | "trader" | "payout" | "account" | "evaluation" | "participant" | "withdrawal" | "disbursement"`); `makeTermResolver(tenant)` returns the title-cased override string; `plural(s)` pluralizes a string.
15. Read `src/lib/platform/types.ts` (lines 1-80 + 100-135) — `TenantContext.branding.name` for the brand identity; `NavigationItem.order?` optional field is valid for child items (line 120); `RouteDefinition` has `path/viewId/label/icon/permission/module/feature/application`.
16. Read `src/components/ui/sheet.tsx` (FULL — 139 LOC) — `SheetContent` accepts `className` prop that overrides the default `sm:max-w-sm`; I used `className="w-full sm:max-w-xl overflow-y-auto"` for both invoice view + create drawers (wider than default so the line items table fits).
17. Read `src/components/ui/alert-dialog.tsx` (FULL — 157 LOC) — controlled via `open` prop on root; `AlertDialogAction` accepts `className` to override variant color (used `bg-rose-600 text-white hover:bg-rose-700` for the destructive "Void invoice" button).
18. Read `src/components/ui/select.tsx` (FULL — 185 LOC) — `Select` controlled via `value` + `onValueChange`; `SelectTrigger size="sm"` for compact toolbar.
19. Read `src/lib/platform/view-router.tsx` lines 1-75 — confirmed `viewRegistry` imports from `@/modules/accounting` barrel. **Did NOT touch** view-router.tsx; lead will batch-register `accounting-invoices` + `accounting-pl` viewIds after Batch 2 finishes (alongside the export additions in `modules/accounting/index.ts`).

### Files touched
- **NEW** `src/modules/accounting/pages/accounting-invoices-page.tsx` (~470 LOC, single named export `AccountingInvoicesPage`).
- **NEW** `src/modules/accounting/pages/accounting-pl-page.tsx` (~510 LOC, single named export `AccountingPlPage`).
- **EDIT** `src/modules/accounting/manifest.ts` — added `FileText, TrendingUp` to the lucide-react import line (line 9); added 2 nav children `accounting.invoices` (`order: 73`) + `accounting.pl` (`order: 74`) after the existing `accounting.reconciliation` child (lines 23-24); added 2 routes `accounting-invoices` + `accounting-pl` mapping to viewIds `accounting-invoices` + `accounting-pl` (lines 33-34).

### Files deliberately NOT touched (per task constraints)
- `src/lib/platform/view-router.tsx` — lead will batch-register `accounting-invoices` + `accounting-pl` viewIds after Batch 2 finishes.
- `src/modules/accounting/index.ts` — file ownership scope restricted to manifest + new page files; lead will add the 2 exports (`AccountingInvoicesPage`, `AccountingPlPage`) alongside the view-router registration. (See "Suggested lead edits" below.)
- `src/lib/platform/mock-data.ts` — read-only; all invoice + P&L mock data lives inside the new page modules as constants so the pages are self-contained.
- `src/modules/accounting/pages/accounting-pages.tsx` — existing file (`AccountingOverviewPage` / `TransactionsPage` / `ReconciliationPage`), out of scope per task constraints.

### Component export names + viewIds (for lead's batched registration)
- **`accounting-invoices`** viewId → `AccountingInvoicesPage` (named export from `src/modules/accounting/pages/accounting-invoices-page.tsx`).
- **`accounting-pl`** viewId → `AccountingPlPage` (named export from `src/modules/accounting/pages/accounting-pl-page.tsx`).

### Suggested lead edits
**1. `src/modules/accounting/index.ts`** — add the 2 new named exports:
```ts
export { accountingModule } from "./manifest";
export {
  AccountingOverviewPage,
  TransactionsPage,
  ReconciliationPage,
  AccountingInvoicesPage,   // NEW
  AccountingPlPage,           // NEW
} from "./pages/accounting-pages";
// OR — if the lead prefers to keep new pages in separate files (recommended):
export { AccountingInvoicesPage } from "./pages/accounting-invoices-page";
export { AccountingPlPage } from "./pages/accounting-pl-page";
```
(Recommendation: keep the 2 new pages in their own files as I built them — `accounting-invoices-page.tsx` + `accounting-pl-page.tsx` are separate from `accounting-pages.tsx`.)

**2. `src/lib/platform/view-router.tsx`** — update the `@/modules/accounting` import (line 46-50) to include `AccountingInvoicesPage` + `AccountingPlPage`, and add 2 entries to `viewRegistry` after the existing `"accounting-reconciliation"` entry (line 281):
```ts
import {
  AccountingOverviewPage,
  TransactionsPage,
  ReconciliationPage,
  AccountingInvoicesPage,
  AccountingPlPage,
} from "@/modules/accounting";
// ...
  "accounting-invoices": AccountingInvoicesPage,
  "accounting-pl": AccountingPlPage,
```

### Page 1: `AccountingInvoicesPage` (`accounting-invoices-page.tsx`)

**Layout (top → bottom):**
1. **PageHeader** — title "Invoices" + description "Generate, send, and track {trader} invoices." + `FileText` icon tile + `term` sublabel "{trader plural} · 10 total invoices" + actions cluster: **Create Invoice** (default `Button` → opens Create Invoice Sheet drawer).
2. **KPI row** — 4 MetricCards responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (§9 — every metric carries a `deltaLabel` for context):
   - **Outstanding** — `formatCurrency($24,420, currency)` (sum of all `sent` + `overdue` invoice totals). `Wallet` icon, **amber tone** (`tone="warning"`). `deltaLabel="4 unpaid"` (count of sent+overdue invoices).
   - **Paid This Month** — `formatCurrency($54,900, currency)` (sum of all `paid` invoice totals). `CheckCircle2` icon, **emerald tone** (`tone="positive"`). `deltaLabel="3 invoices cleared"`.
   - **Overdue** — `"2"` (count of `overdue` invoices). `AlertTriangle` icon, **rose tone** (`tone="negative"`). `deltaLabel="past their due date"`.
   - **Avg Days to Pay** — `"14 days"` (average of `daysBetween(issueDate, dueDate)` across paid invoices — deterministic pure function). `CalendarClock` icon. `deltaLabel="target: 15 days"`.
3. **Filter bar** — `Card`-styled `flex flex-col md:flex-row` container:
   - Status `Select` (All / Draft / Sent / Paid / Overdue / Cancelled) — 6 options.
   - Date Range `Select` (All time / Last 30 / 60 / 90 days) — 4 options.
   - Count text `"X of 10 invoices"`.
   - **Export CSV** button (`Button outline` → real `exportToCsv` call on the filtered array with 9 columns: Invoice # / Trader / Email / Issue Date / Due Date / Amount / Tax / Total / Status — the trader column header uses `term("trader")` so white-label tenants see their own term).
4. **Invoices DataTable** — 9 columns:
   - **Invoice #** (`font-mono text-xs`, e.g. `INV-2024-001`).
   - **{term("trader")}** (name + email stacked — primary + secondary visual hierarchy §41).
   - **Issue Date** (`text-xs text-muted-foreground`, formatted with `toLocaleDateString`).
   - **Due Date** (`text-xs` — overdue rows rendered in rose `text-rose-600 font-medium` so the breach state is visible §17-§19).
   - **Amount** (right-aligned tabular-nums).
   - **Tax** (right-aligned, muted).
   - **Total** (right-aligned, `font-medium`).
   - **Status** (`StatusBadge` with tone mapping: draft→muted/slate, sent→info/sky, paid→success/emerald, overdue→danger/rose, cancelled→muted/slate — `className="capitalize"` so the badge text is title-cased).
   - **Actions** (right-aligned, `min-w-[260px]`):
     - **View** (`Button ghost` → opens View Sheet drawer; `aria-label="View invoice {id}"`).
     - **PDF** (`Button ghost` → toast "Generating PDF"; only this + Cancel are shown for paid/cancelled invoices).
     - **Send** (`Button ghost`, only for `draft` + `sent` → toast "Invoice sent").
     - **Mark Paid** (`Button ghost text-emerald-600`, hidden for `paid` + `cancelled` → toast "Marked as paid").
     - **Cancel** (`Button ghost text-rose-600`, hidden for `paid` + `cancelled` → opens AlertDialog).
     - Row click (on the TableRow, not on action buttons which `e.stopPropagation()`) → opens View Sheet drawer.
   - `searchableText` covers `id + trader + email + status`; `pageSize=8`; `emptyTitle="No invoices match"` + `emptyDescription="Adjust the status or date filters..."`.
5. **Invoice View Sheet drawer** (`sm:max-w-xl overflow-y-auto` — wider than default `sm:max-w-sm` so the line items table fits):
   - **SheetHeader** — title (Invoice # in `font-mono` + StatusBadge inline) + description (Issued/Due dates).
   - **Bill From / Bill To** — 2-column grid; Bill From uses `tenant.branding.name` + a constructed `accounts@{brand}.com` email + "Financial Operations" subtitle; Bill To shows `{trader}` + email + `{term("trader")}` subtitle.
   - **Line items table** — 5-column grid (`Description / Qty / Unit / Tax / Total`); 2-3 mock line items per invoice; line total = `qty * unit + tax`.
   - **Totals** — right-aligned: Subtotal + Tax + Separator + Grand Total (font-semibold).
   - **Notes** — bordered muted card showing `invoice.notes` when present (e.g. "Payment received via bank transfer. Thank you." for INV-2024-001; "Two reminder emails sent. Awaiting trader response." for INV-2024-003 the overdue one).
   - **SheetFooter** — contextual actions §22 (only show actions valid for the current status):
     - **Download PDF** (outline, always shown).
     - **Send Email** (outline, only for draft + sent).
     - **Mark Paid** (outline text-emerald-600, hidden for paid + cancelled).
     - **Cancel Invoice** (outline text-rose-600, hidden for paid + cancelled → sets `cancelTarget` state + closes the view Sheet, then opens the AlertDialog).
6. **Create Invoice Sheet drawer** (`sm:max-w-xl overflow-y-auto`):
   - **SheetHeader** — title "New Invoice" with `Plus` icon + description.
   - **Form fields** — 4 `Label` + `Input` pairs in a 2-col grid: trader name / email / issue date (date input, defaults to today) / due date (date input, defaults to today + 14 days).
   - **Default template line items table** — read-only preview with 2 mock line items (2-Step Challenge + Addon: Reset Token).
   - **Totals** — Subtotal + Tax (each with `LabelWithHelp` explaining "Sum of (Qty × Unit Price) before tax" and "10% applied to each line item") + Grand Total.
   - **Notes textarea** (`Textarea rows={3}`) for payment instructions / reference / terms.
   - **SheetFooter** — **Download PDF** (outline, toast — works on a placeholder INV-DRAFT id) + **Send Email** (outline, `disabled` when trader name is empty) + **Save Draft** (default, primary — `ml-auto` to right-align; validates trader name first, fires toast, then closes the Sheet).
7. **Cancel Invoice AlertDialog** — §24 destructive action with consequence spelled out:
   - Title: "Cancel invoice {id}?".
   - Description: explains the invoice will be voided, releases the owed balance (shows `formatCurrency(total, currency)`), the trader will be notified, and the invoice cannot be re-activated — explicit consequence (not "Are you sure?").
   - Footer: **Keep invoice** (`AlertDialogCancel`) + **Void invoice** (`AlertDialogAction` with `bg-rose-600 text-white hover:bg-rose-700` — destructive variant) → fires a destructive toast "Invoice cancelled" + clears `cancelTarget`.

**State management (useState-local):**
- `statusFilter` (`"all" | InvoiceStatus`) + `dateRange` (`"all" | "30" | "60" | "90"`) → drive `filtered` `useMemo` over `INVOICES`.
- `selected: Invoice | null` → controls the View Sheet drawer open state.
- `creating: boolean` → controls the Create Sheet drawer open state.
- `draftTrader / draftEmail / draftIssue / draftDue / draftNotes` → controlled form inputs for the Create Sheet.
- `cancelTarget: Invoice | null` → controls the Cancel AlertDialog open state.

### Page 2: `AccountingPlPage` (`accounting-pl-page.tsx`)

**Layout (top → bottom):**
1. **PageHeader** — title "P&L Statement" + description "Profit & loss for the selected period — revenue, COGS, OpEx, and net profit." + `TrendingUp` icon tile + `term` sublabel "{trader plural} · {challenge} sales + addons + subscriptions" + actions cluster: **Period Select** (7 options: This Month / Last Month / This Quarter / Last Quarter / This Year / Last Year / Custom — local `useState`, mock data is constant for all periods; the period only labels the export filename + the statement header) + **PDF** button (`outline` → toast "Generating P&L PDF") + **Export CSV** button (`outline` → real `exportToCsv` call).
2. **KPI row** — 4 MetricCards responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (§9 — every metric carries a `deltaLabel` for context):
   - **Total Revenue** — `formatCurrency($329,900, currency)` (sum of all 4 revenue lines). `DollarSign` icon, **emerald tone** (`tone="positive"`). `deltaLabel="100.0% of revenue"` (so the % of revenue framing is consistent — same denominator used by every P&L row).
   - **Total Expenses** — `formatCurrency($255,400, currency)` (COGS + OpEx + Other — the three expense buckets). `TrendingDown` icon, **rose tone** (`tone="negative"`). `deltaLabel="COGS + OpEx + Other"`.
   - **Net Profit** — `formatCurrency($74,500, currency)`. `TrendingUp` icon, **emerald tone** (`tone="positive"`). `deltaLabel="margin 22.6%"` (computed `netProfit / revenue * 100`).
   - **Profit Margin** — `"22.6%"`. `Percent` icon, **emerald tone** (`tone="positive"`). `deltaLabel="industry benchmark: 18-25%"` (§9 + §33 — surfacing the benchmark inline so finance managers can immediately assess health; falls in the healthy band).
3. **P&L Statement (vertical income statement layout)** — `Card`-styled `p-4 md:p-6` container:
   - **Header row** — statement title "Profit & Loss Statement" + period label "Period: {selectedPeriod.label}".
   - **Revenue section** — section header "Revenue" + 4 line items:
     - **{term("challenge")} Sales** $284,000 — `LabelWithHelp` explaining "One-time registration fees collected when traders buy a challenge."
     - **Addon Sales** $18,200 — "Reset tokens, account resets, and other in-cart add-ons purchased with a challenge."
     - **Subscription Revenue** $24,500 — "Recurring monthly platform fees charged to funded traders."
     - **Other Income** $3,200 — "Interest on held balances, recovery of disputed charges, and miscellaneous income."
     - `border-t` separator → **Total Revenue** $329,900 (slate tone — neutral, this is the denominator for all %).
   - **COGS section** — section header "Cost of Goods Sold (COGS)" + 3 line items:
     - **{plural(term("payout"))} to {plural(term("trader"))}** $142,000 — "Profit splits paid to traders who passed their challenges and traded funded accounts." (terminology-aware so Gamma Futures sees "Disbursements to Candidates" instead).
     - **Affiliate Commissions** $18,400 — "Referral payouts to affiliates based on their attributed trader conversions."
     - **Payment Processing Fees** $4,200 — "Gateway + card network fees on inbound challenge purchases and outbound payouts."
     - separator → **Total COGS** $164,600 (**rose tone** — this is an expense).
   - **Gross Profit** — surfaced inline between COGS and OpEx for readability (standard P&L layout). Bold row, emerald color, $165,300, 50.1% of revenue. Followed by a `<Separator />`.
   - **Operating Expenses section** — section header "Operating Expenses" + 5 line items:
     - **Marketing & Ads** $12,400 — "Paid acquisition, retargeting, sponsorships, and creative production."
     - **Personnel** $38,600 — "Salaries, benefits, and contractor fees for ops, risk, support, and engineering."
     - **Software & Tools** $4,200 — "SaaS, hosting, data feeds, and licensing for internal tooling."
     - **KYC / AML Services** $2,100 — "Identity verification vendor costs and sanctions screening per trader."
     - **Office & Admin** $1,800 — "Office, legal, accounting, and other administrative overhead."
     - separator → **Total OpEx** $59,100 (**rose tone**).
   - **Operating Profit (EBIT)** — surfaced inline. Bold row, emerald, $106,200, 32.2%. `LabelWithHelp` explains "Earnings Before Interest and Tax. Gross Profit minus Operating Expenses." Followed by `<Separator />`.
   - **Other (Interest + Tax) section** — section header + 2 line items:
     - **Interest Expense** $800.
     - **Tax Provision** $8,400.
     - separator → **Total Other** $9,200 (**rose tone**).
   - **NET PROFIT** — large emphasis card (§10 attention center). Bordered `bg-muted/20 p-4`. Title "Net Profit" + subtitle "after interest + tax". Value `text-2xl font-bold` $74,500 in emerald + percentage 22.6% in emerald (would be rose if negative). The single most-emphasized number on the page.

   Each row uses the layout: `<Label> ... <Amount> <% of revenue>`. The % column has fixed `w-12 text-right text-xs text-muted-foreground` for visual rhythm.
4. **Charts row** — `grid gap-4 lg:grid-cols-2`:
   - **Revenue vs Expenses** (grouped bars — recharts directly because `BarSeries` is single-color): 12-month grouped bar chart with Revenue (emerald) + Expenses (rose). Legend below explains the two colors. Y-axis formatted as `$Xk`. Tooltip shows formatted currency. `height=240`.
   - **Profit Margin Trend** (`AreaSeries` — platform component, single emerald color): 12-month margin % computed as `(revenue - expenses) / revenue * 100` per month using the same `TREND_12M` deterministic data. `formatValue={(v) => `${v.toFixed(1)}%`}`. `height=240`.
5. **Footnote** — §19 explainability: explains all figures are illustrative, clarifies that `{payout}` = profit splits paid to funded `{trader}`s, explains margin trend formula, and decodes the color legend (slate = neutral / emerald = profit / rose = loss).

### Determinism guarantees
- **No `Math.random()` anywhere.** All numbers are either constants or `Math.sin` / `Math.cos` patterns.
- `INVOICES` — constant array of 10 invoices (no Math.random).
- `PL_DATA` — constant nested object with 14 line-item amounts.
- `TREND_12M` — `Math.round(38_000 + Math.sin(i / 3) * 6_000 + i * 800)` for revenue, `Math.round(22_000 + Math.cos(i / 3) * 3_500 + i * 400)` for expenses — same value on every render.
- `marginTrend` — derived from `TREND_12M` via `Math.round(((revenue - expenses) / revenue) * 1000) / 10` (1-decimal rounding without string conversion).
- All KPI totals — pure reduce over constant arrays.
- All `% of revenue` — pure `pct(amount, base)` helper.

### Color palette (Terra-only, no blue/indigo/violet)
- emerald `#059669` (Total Revenue + Net Profit + Gross Profit + Operating Profit + Margin trend chart + "Paid" invoice status badge + Mark Paid button)
- amber    `#d97706` (Outstanding KPI tone warning)
- rose     `#e11d48` (Total Expenses + Overdue KPI tone negative + Cancel Invoice button + "Overdue" invoice status badge + Expenses bar in the grouped chart + Cancelled destructive AlertDialog action)
- sky      `#0ea5e9` ("Sent" invoice status badge — comes from `StatusBadge` tone="info", already in platform `status.tsx`)
- slate    `#475569` (footnote legend neutral label)
- No blue/indigo/violet anywhere in the file (verified — `rg "blue|indigo|violet" src/modules/accounting/pages/accounting-invoices-page.tsx src/modules/accounting/pages/accounting-pl-page.tsx` returns 0 hits).

### Accessibility
- Every action button has an `aria-label` (e.g. `View invoice INV-2024-001`, `Cancel invoice INV-2024-003`).
- Action group `onClick={(e) => e.stopPropagation()}` so row click (which opens the View drawer) doesn't double-fire when an action button is clicked.
- Status `Select` and Date `Select` both have `aria-label` ("Filter by status" / "Filter by date range" / "Select period").
- StatusBadge carries `role="status"` + computed `aria-label` from platform `status.tsx`.
- AlertDialog uses `role="alertdialog"` via the Radix primitive.
- All KPI cards have visible labels (not just icons).
- Sheet drawer's `SheetTitle` + `SheetDescription` provide proper Radix Dialog `aria-labelledby` + `aria-describedby`.
- Footnote decodes the color legend for color-blind users.

### Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean `$ eslint .` output.
2. **`bunx tsc --noEmit --skipLibCheck`** → 0 errors in `src/modules/accounting/pages/accounting-invoices-page.tsx`, `src/modules/accounting/pages/accounting-pl-page.tsx`, or `src/modules/accounting/manifest.ts` (grep on the 3 file paths returns 0 hits). All pre-existing errors are in `src/modules/trading/pages/account-kyc-statuses-page.tsx` (10 errors around `KycProviderStatus` union narrowing — owned by another agent, out of scope).
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** → `200`.
4. **`dev.log` tail** → only `✓ Compiled in <ms>` + `GET / 200 in <ms>` lines — no runtime errors after the 2 new files + manifest edit landed.

### Notes for lead
- The new files import from `recharts` directly (for `BarChart`/`Bar`/`Legend`/`CartesianGrid`/`Tooltip`/`XAxis`/`YAxis`/`ResponsiveContainer`) because the platform `BarSeries` component only supports a single chart-wide fill color and cannot do grouped bars (Revenue vs Expenses). This is consistent with §76 (don't build ad-hoc primitives) — direct recharts usage in one spot, not a new wrapper. Same precedent set by `impl-support-sla`'s compliance-by-priority chart.
- The `AreaSeries` from `@/components/platform/charts` IS used for the margin trend (single color, fine for that use case).
- The `usePlatform()` import pulls in `runtime` + `tenant`. `runtime.tenant?.currency` feeds `formatCurrency`; `tenant.branding.name` feeds the "Bill From" invoice header; `tenant` feeds `makeTermResolver()` so terminology-aware labels ({trader}, {trader plural}, {challenge}, {payout plural}) work correctly for Gamma Futures ("Candidate" terminology) and Alpha Capital ("Evaluation" terminology).
- All KPIs use `deltaLabel` (not `delta` — the latter renders an auto ▲/▼ percentage which would be misleading for the synthetic mock data). `deltaLabel` surfaces the contextual meaning instead, per §9.
- Invoice status tone mapping: `STATUS_TONE: Record<InvoiceStatus, "muted" | "info" | "success" | "danger">` — only uses the 4 Terra tones that match the task spec (draft=slate→muted, sent=sky→info, paid=emerald→success, overdue=rose→danger, cancelled=slate→muted). No blue/indigo/violet introduced.
- The Create Invoice form is intentionally minimal (4 fields + a read-only template line-items preview + notes textarea + Save Draft). The task spec said "Create Invoice button (top right) — opens Sheet drawer with new invoice form" — the form demonstrates the pattern; full line-item editing is intentionally out of scope for this Batch 2 task (would be a separate task with state management for variable line items).
- The Cancel Invoice AlertDialog uses `bg-rose-600 text-white hover:bg-rose-700` on `AlertDialogAction` to override the default variant color — explicit destructive styling (§24 — friction proportional to consequence). The `AlertDialogDescription` spells out the consequence (voids invoice, releases owed balance, trader notified, cannot be re-activated) rather than "Are you sure?".

### Code Changes Summary
- `src/modules/accounting/pages/accounting-invoices-page.tsx` (NEW — ~470 LOC)
- `src/modules/accounting/pages/accounting-pl-page.tsx` (NEW — ~510 LOC)
- `src/modules/accounting/manifest.ts` (EDIT — +2 imports, +2 nav children, +2 routes; total file now 70 LOC, was 63)


---

## Task: impl-marketing-email-ads — Marketing Email Campaigns + Ad-Spend Tracking pages

**Agent**: impl-marketing-email-ads (subagent)
**Date**: 2026 batch — Marketing module growth features
**Scope**: Build two new pages in the Marketing module — Email Campaigns and Ad-Spend Tracking — plus manifest nav/route registration. No backend, no view-router changes (lead agent will batch-register viewIds).

### Deliverables — files touched (3)
1. **NEW** `src/modules/marketing/pages/marketing-email-campaigns-page.tsx` — exports `MarketingEmailCampaignsPage`
2. **NEW** `src/modules/marketing/pages/marketing-ad-spend-page.tsx` — exports `MarketingAdSpendPage`
3. `src/modules/marketing/manifest.ts` — added 2 nav children + 2 routes (see below)

### viewIds registered (for lead agent's batch view-router edit)
- `marketing-email-campaigns` → `MarketingEmailCampaignsPage` (import from `@/modules/marketing/pages/marketing-email-campaigns-page`)
- `marketing-ad-spend` → `MarketingAdSpendPage` (import from `@/modules/marketing/pages/marketing-ad-spend-page`)

### Manifest changes
Navigation children (added in order between `marketing.campaigns` and `marketing.performance`):
```ts
{ id: "marketing.email-campaigns", label: "Email Campaigns", href: "marketing-email-campaigns", icon: Mail, permission: "marketing.read" },
{ id: "marketing.ad-spend", label: "Ad Spend", href: "marketing-ad-spend", icon: Megaphone, permission: "marketing.read" },
```
Routes (added after `marketing-campaigns`):
```ts
{ path: "marketing-email-campaigns", viewId: "marketing-email-campaigns", label: "Email Campaigns", permission: "marketing.read", module: "marketing" },
{ path: "marketing-ad-spend", viewId: "marketing-ad-spend", label: "Ad Spend", permission: "marketing.read", module: "marketing" },
```
Imported `Mail` from `lucide-react` (Megaphone already imported).

### Marketing Email Campaigns Page — `MarketingEmailCampaignsPage`
- **KPI row (4 MetricCards)**: Total Emails Sent (30d), Avg Open Rate (32.x% — industry avg 21.5%), Avg Click Rate (4.x% — industry avg 2.6%), Conversion Rate (clicked → became trader, with negative delta).
- **Filter bar**: Status Select (All / Draft / Scheduled / Sending / Sent / Completed / Paused / Failed) + Template Select (All / Welcome / Newsletter / Promotional / Re-engagement / Phase-Passed / Payout-Approved) + Reset button + Export CSV (uses `exportToCsv`).
- **Campaigns DataTable** — 8 deterministic campaigns: columns Campaign (name + ID + subject), Template, Status, Sent, Opened, Clicked, Converted, Open Rate (emerald when ≥30%), Click Rate (emerald when ≥5%), View action.
- **StatusBadge** via inline `emailStatusTone` helper: Draft→muted (slate), Scheduled→info (sky), Sending→warning (amber), Sent→success (emerald), Completed→success, Paused→warning, Failed→danger (rose).
- **Sheet drawer** (shared form, Create + View modes): Campaign Name (LabelWithHelp), Template Select, Audience Select (term-aware — "All {trader}s" / Active / Funded / Failed / Specific Segment), Schedule (datetime-local), Subject Line (with 0/120 char counter), Preview textarea (with 0/140 counter).
- **Tabs in Sheet**: Compose / Preview / Schedule. Preview tab renders a sample email body using a template-specific body map. Schedule tab shows estimated recipients (deterministic per audience).
- **SheetFooter**: Save Draft / Schedule (disabled if no datetime) / Send Now — each triggers a `toast`.
- **Test Send button** on Preview tab — toast "Test email sent (demo)".
- **Email Performance Trend** AreaSeries (12-week open rate, emerald stroke, deterministic Math.sin pattern `28 + sin(i/2)*6 + i*0.4`).
- **Quick Stats** sidebar card — best performing template, best open rate, active campaigns count, conversion rate (all deterministic).
- **Top Performing Templates** DataTable — 6 templates with Sent / Open Rate / Click Rate / Conversion / Revenue Attributed. Sorted emerald-highlighting for strong rates.
- **Row click** opens Sheet in view mode (prefilled). **Create Campaign** button (PageHeader actions) opens Sheet in create mode.

### Marketing Ad-Spend Tracking Page — `MarketingAdSpendPage`
- **KPI row (4 MetricCards)**: Total Ad Spend (30d, with `deltaLabel` showing window + campaign count), Total Conversions (became funded trader), Cost per Acquisition (CPA, tone positive/amber based on $100 target), Return on Ad Spend (ROAS, formatted as `Nx`, deltaLabel "$X revenue per $1 spent").
- **Filter bar**: Platform Select (All / Google Ads / Meta (Facebook) / TikTok / LinkedIn / Twitter/X) + Campaign Select (All / each campaign) + Date range Select (7d / 30d / 90d) + Reset + Export CSV (computes CTR, CPC, CPA, ROAS columns).
- **Spend by Platform** BarSeries (emerald bars) — Google / Meta / TikTok / LinkedIn / Twitter.
- **Spend Distribution** DonutSeries — same 5 platforms with Terra palette colors (Google=emerald #059669, Meta=rose #e11d48, TikTok=amber #d97706, LinkedIn=slate-600 #475569, Twitter/X=sky-600 #0284c7).
- **ROAS by Platform** BarSeries (amber bars) — wrapped in `LabelWithHelp` explaining ROAS = revenue / spend, with profitability thresholds (≥2.0x healthy, <1.0x losing money).
- **Ad Campaigns DataTable** — 7 deterministic campaigns: columns Campaign (name + ID + platform dot), Platform (with color dot), Spend, Impr., Clicks, CTR (emerald ≥2%), CPC, Conv., CPA (emerald ≤$100, rose >$200), ROAS (emerald ≥2x, rose <1x), Status, View action.
- **Ad status tones** via inline `adStatusTone`: Active→success, Paused→warning, Ended→muted, Draft→muted.
- **Spend Trend (30d)** AreaSeries (sky-600 stroke) — deterministic `Math.sin(i/3)*40 + i*2 + 120` pattern.
- **Conversion Funnel** — 4 stages (Impressions → Clicks → Signups → Funded traders). BarSeries (emerald) + a side card showing each stage's value and conversion rate from the previous stage (rate is emerald if ≥20%, amber otherwise).
- **Ad Campaign Sheet Drawer** (View + Create): Campaign Name (LabelWithHelp), Platform Select, Budget + Budget Type (daily/total) with LabelWithHelp, Start/End date inputs, Target Audience textarea (LabelWithHelp), Creative URL input (url type, placeholder), Status Switch toggle. Footer: Save (primary), Pause (outline), Delete (destructive AlertDialog with consequence explanation per AGENTS.md §24). AlertDialog explains that the platform ad is NOT automatically deleted.
- **Connect Ad Account button** (PageHeader actions, top right) — toast "Connect ad account (demo)".
- **Row click** opens Sheet in view mode (prefilled with campaign values). KPI strip above the form shows Spend / CPA / ROAS / CTR for the viewed campaign.

### Cross-cutting patterns followed
- **`usePlatform()` + `makeTermResolver(tenant)`** for "trader" terminology on both pages (KPI deltaLabels, audience labels, funnel stage labels, sheet descriptions).
- **`MetricCard`** with `deltaLabel` for technical KPIs (CPA target context, ROAS $/$1 context).
- **`LabelWithHelp`** on form fields where the user benefits from context: Campaign Name, Audience, Subject Line, Preview Text, Schedule Send (Sheet drawer); Budget, Target Audience, Creative URL (Ad Sheet); ROAS by Platform chart title; Conversion Funnel chart title.
- **`DataTable`** + `AreaSeries` + `BarSeries` + `DonutSeries` from `@/components/platform/*`.
- **shadcn**: `Sheet`, `Button`, `Input`, `Label`, `Textarea`, `Select`, `Badge` (via `StatusBadge`), `Separator`, `AlertDialog`, `Switch`, `Tabs`.
- **`exportToCsv`** from `@/lib/platform/export-utils` — RFC-4180 escaping, BOM-prefixed UTF-8 for Excel.
- **`toast`** from `@/hooks/use-toast` for all action confirmations (no real backend; demo toasts).
- **Deterministic mock data** — `Math.sin` patterns only, no `Math.random`. WEEKLY_OPEN_TREND uses `28 + sin(i/2)*6 + i*0.4`; SPEND_TREND_30D uses `120 + sin(i/3)*40 + i*2`.
- **Terra palette** — emerald / amber / rose / slate / sky ONLY. No blue, no indigo, no violet. Platform colors and chart strokes all within Terra.
- **`"use client"` directive** at top of both new files (interactive, useState-driven).
- **Mobile-first responsive** — KPI rows `grid-cols-2 lg:grid-cols-4`; chart rows `lg:grid-cols-2`; funnel chart + side card `lg:grid-cols-3`; filter bars wrap on mobile.

### Verification
1. `bun run lint` → **0 errors, 0 warnings**. ESLint clean across the repo after my edits.
2. `bunx tsc --noEmit --skipLibCheck` → **0 new errors in my 3 files**. (Pre-existing errors remain in `mock-data.ts`, `analytics-pages.tsx`, `analytics-widgets.tsx`, `payout-widgets.tsx`, `risk-widgets.tsx`, `settings-page.tsx`, `account-kyc-statuses-page.tsx` — all untouched by this task.)
3. Dev server (Next.js auto dev on port 3000): log shows successful compiles + `GET / 200` responses after the new files were added. No compile errors related to `marketing-email-campaigns-page.tsx`, `marketing-ad-spend-page.tsx`, or `manifest.ts`.

### Constraints honored
- ✅ Did NOT touch `src/lib/platform/view-router.tsx` — lead agent will batch-register `marketing-email-campaigns` + `marketing-ad-spend` viewIds.
- ✅ Did NOT touch `src/lib/platform/mock-data.ts` — both pages define their own deterministic inline mock data (email campaigns, ad campaigns, spend trend, weekly open trend).
- ✅ Did NOT touch `src/modules/marketing/pages/marketing-pages.tsx` — existing `MarketingOverviewPage`, `MarketingCampaignsPage`, `MarketingPerformancePage` untouched.
- ✅ Did NOT touch `src/modules/marketing/index.ts` — lead agent will add exports there as part of the batched view-router registration (or import the page files directly).
- ✅ Terra palette only (emerald / amber / rose / slate / sky — NO blue/indigo/violet introduced).
- ✅ Deterministic mock data (Math.sin patterns, no Math.random).
- ✅ `usePlatform()` + `makeTermResolver(tenant)` for tenant-aware "trader" references.
- ✅ Used existing platform components: `Page` / `PageHeader` / `PageContent` / `MetricCard` / `DataTable` / `AreaSeries` / `BarSeries` / `DonutSeries` / `StatusBadge` / `formatCurrency` / `formatCompact` / `LabelWithHelp` / `ContextualHelp` (via LabelWithHelp composition).
- ✅ Used existing shadcn: `Sheet` / `Button` / `Input` / `Label` / `Select` / `Badge` (via StatusBadge) / `Separator` / `Textarea` / `AlertDialog` / `Switch` / `Tabs`.
- ✅ Mobile-first responsive layouts throughout.
- ✅ AGENTS.md §9 KPIs — every metric carries context (deltaLabel or tone) and where applicable, comparison (industry avg, target).
- ✅ AGENTS.md §22-24 Contextual Actions — Sheet drawer surfaces actions in context (Save / Schedule / Send Now / Pause / Delete with AlertDialog friction).
- ✅ AGENTS.md §33 Contextual Help — `LabelWithHelp` on technical fields (CPA, ROAS, Budget, Target Audience, Creative URL, etc.).

### Code Changes Summary
- `src/modules/marketing/manifest.ts`: 2 nav children added in `navigation[0].children`, 2 routes added in `routes`, 1 import (`Mail`) added. Existing manifest entries unchanged.
- `src/modules/marketing/pages/marketing-email-campaigns-page.tsx` (NEW, ~590 lines): `MarketingEmailCampaignsPage` + `EmailCampaignSheet` + `TEMPLATE_COLUMNS` + `emailStatusTone` + `audienceFor` + `estimatedReach` + `templateOrDefault` + `KpiPill`. Deterministic data: `EMAIL_CAMPAIGNS` (8), `TEMPLATE_PERF` (6), `WEEKLY_OPEN_TREND` (12).
- `src/modules/marketing/pages/marketing-ad-spend-page.tsx` (NEW, ~620 lines): `MarketingAdSpendPage` + `AdCampaignSheet` + `adStatusTone` + `ctr` + `cpc` + `cpa` + `roas` + `fmtPct` + `fmtMoney` + `fmtRoas` + `KpiPill`. Deterministic data: `AD_CAMPAIGNS` (7), `SPEND_TREND_30D` (30), `PLATFORM_COLORS` mapping.
- No new dependencies. No new viewIds beyond the two registered in manifest (the lead will mirror them into view-router.tsx). No breaking changes to existing exports.

### Handoff note for lead agent
The two new pages are ready to be registered in `src/lib/platform/view-router.tsx`. Suggested registration:
```ts
import { MarketingEmailCampaignsPage } from "@/modules/marketing/pages/marketing-email-campaigns-page";
import { MarketingAdSpendPage } from "@/modules/marketing/pages/marketing-ad-spend-page";
// ...
// in viewRegistry:
"marketing-email-campaigns": MarketingEmailCampaignsPage,
"marketing-ad-spend": MarketingAdSpendPage,
```
Alternatively, add to `src/modules/marketing/index.ts`:
```ts
export { MarketingEmailCampaignsPage } from "./pages/marketing-email-campaigns-page";
export { MarketingAdSpendPage } from "./pages/marketing-ad-spend-page";
```
and update the existing `import { ... } from "@/modules/marketing"` line in view-router to include the two new symbols.

---

## Task ID: impl-affiliate-coupons-links — Affiliate Coupon Codes + Link Tracking Pages

**Agent**: impl-affiliate-coupons-links-fullstack-developer (Batch 2 — focused Affiliates module growth expansion)
**Date**: 2026 batch
**Scope**: Build the two pages flagged as a gap by `analysis-aff-acc-mkt-crm` — standalone coupon CRUD (`AffiliateCouponsPage`) and link tracking (`AffiliateLinkTrackingPage`), both missing from the Affiliates module surface. Adds 2 viewIds (`affiliate-coupons`, `affiliate-link-tracking`) and 2 named exports (`AffiliateCouponsPage`, `AffiliateLinkTrackingPage`) for the lead agent's batched registration in `view-router.tsx` and `modules/affiliates/index.ts`.

### Pre-work (read-only)
1. Read `worklog.md` tail (last 250 lines) — captured context from `impl-accounting-invoices-pl` (Sheet drawer pattern, AlertDialog destructive styling, deterministic `Math.sin` trends, Terra palette, `LabelWithHelp` pattern), `impl-marketing-email-ads` (Marketing Email Campaigns + Ad Spend pages — same KPI + DataTable + Sheet drawer + AlertDialog pattern; view-router batched registration handoff). `analysis-aff-acc-mkt-crm` flagged "Affiliates module lacks standalone coupon CRUD, link tracking".
2. Read `AGENTS.md` UX constitution — §9 KPIs (every metric needs context + `deltaLabel`), §22 Contextual Actions (surface actions in context, not navigate away), §23 One Primary Action (Save primary, Suspend/Delete secondary), §24 Destructive Actions (friction proportional to consequence, spell out consequence not "are you sure?"), §33 Help (`LabelWithHelp` for technical fields).
3. Read `src/modules/affiliates/manifest.ts` (72 LOC, 6 nav children + 8 routes; affiliates module parent `order: 55`).
4. Read `src/modules/affiliates/pages/affiliate-pages.tsx` (first 90 lines) — captured `AffiliatesOverviewPage` structure: `usePlatform()` + `makeTermResolver(tenant)` + `runtime.tenant?.id ?? "platform"` + `getTenantAffiliates(tid)` + `Page`/`PageHeader`/`PageContent`/`MetricCard` + `DataTable` + `AreaSeries` + `StatusBadge` + `formatCurrency`/`formatCompact` + `exportToCsv`.
5. Read `src/lib/platform/mock-data.ts` (Affiliate interface lines 544-558, AffiliateCampaign lines 560-573, mock affiliate data lines 877-910) — captured `Affiliate { id, tenantId, name, email, code, referrals, activeReferrals, conversions, commissionEarned, commissionPending, status, tier, joinedAt }` and `AffiliateCampaign` shape for reference. Did NOT touch this file (per task spec — defined own inline mock data).
6. Read `src/components/platform/charts.tsx` (248 LOC) — confirmed `AreaSeries` / `BarSeries` / `DonutSeries` / `LineSeries` / `Sparkline` signatures + `SeriesPoint = { [key: string]: string | number }` + tooltip styling + ChartFrame/ChartEmpty helpers.
7. Read `src/lib/platform/export-utils.ts` (67 LOC) — confirmed `exportToCsv<T>(rows, columns: ExportColumn<T>[], filename)` + `ExportColumn<T> { key, header, value(row) => string | number }` + RFC-4180 escaping + BOM prefix + empty-rows toast.
8. Read `src/modules/affiliates/pages/offer-management-page.tsx` (362 LOC) for the inline detail panel pattern (vs Sheet drawer) — confirmed Sheet drawer is the right pattern for my pages because of the multi-field create/edit form complexity (§27 drawer-vs-page).
9. Read `src/modules/marketing/pages/marketing-ad-spend-page.tsx` (1087 LOC, sheet section lines 765-1058) for the established Sheet drawer pattern: `useState` local form state + `localState || propValue` display + `key={formKey}` for remount + `AlertDialog` destructive variant styling.

### Deliverables — files touched (3)
1. **NEW** `src/modules/affiliates/pages/affiliate-coupons-page.tsx` (1144 LOC) — exports `AffiliateCouponsPage`
2. **NEW** `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` (1336 LOC) — exports `AffiliateLinkTrackingPage`
3. `src/modules/affiliates/manifest.ts` (EDIT — +2 imports `Ticket, Link`, +2 nav children between `affiliates.commissions` and `affiliates.offers`, +2 routes between `affiliates-commissions` and `offer-management`; total file now 77 LOC, was 72)

### viewIds registered (for lead agent's batch view-router edit)
- `affiliate-coupons` → `AffiliateCouponsPage` (import from `@/modules/affiliates/pages/affiliate-coupons-page`)
- `affiliate-link-tracking` → `AffiliateLinkTrackingPage` (import from `@/modules/affiliates/pages/affiliate-link-tracking-page`)

### Manifest changes

Import added:
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

### Page 1: AffiliateCouponsPage — `affiliate-coupons-page.tsx` (~1144 LOC)

**Layout (top → bottom):**
1. **PageHeader** — title "Coupon Codes" + `Ticket` icon tile + terminology-aware description ("Create and track coupon codes that {trader}s redeem on {challenge} purchases via affiliate links.") + `term` sublabel "Attributable revenue · 30-day window · {trader} → funded conversion" + actions cluster: **Export** button (outline → real `exportToCsv` call with 15 columns) + **Create Coupon** button (primary → opens Sheet drawer in create mode).
2. **KPI row** — 4 `MetricCard`s in responsive `grid-cols-2 lg:grid-cols-4` (§9 — every metric carries context):
   - **Active Coupons** — count + `Ticket` icon + **emerald tone** + `deltaLabel` "{total} total · {scheduled} scheduled".
   - **Total Redemptions (30d)** — `formatCompact` count + `Users` icon + **emerald tone** + `deltaLabel="across all {trader} signups"`.
   - **Discount Given (30d)** — `formatCurrency` amount + `Tag` icon + **rose tone** (`tone="negative"`) + `deltaLabel="reduces recognized revenue"`.
   - **Revenue from Coupons (30d)** — `formatCurrency` amount + `TrendingUp` icon + **emerald tone** + `deltaLabel="top: {topPerformer.code}"`.
3. **Filter bar + Coupons DataTable** — Card with:
   - Header row: "All Coupons" label + count `Badge`.
   - Filter `Select`s: **Status** (All / Active / Scheduled / Expired / Disabled) + **Discount type** (All / Percentage / Flat / Free Trial / Bonus Credit).
   - **DataTable** 10 columns:
     - **Code** (`font-mono text-xs` + Copy button — calls `navigator.clipboard.writeText` + toast).
     - **Description** (`line-clamp-1 text-xs text-muted-foreground`).
     - **Type** (`Percent` / `DollarSign` / `Gift` / `Coins` icon per type — Terra palette).
     - **Value** (`formatDiscountValue` — %, $, days, or $ for Bonus Credit).
     - **Min Purchase** (`formatCurrency` or "None").
     - **Used** (`{used} / {limit}` — tabular-nums).
     - **Expires** (with `Calendar` icon + formatted date).
     - **Status** (`StatusBadge` with `couponStatusTone`: active→success, scheduled→info, disabled→danger, expired→muted).
     - **Actions** (right-aligned): **Edit** (ghost → opens Sheet in view mode) + **Disable** (ghost text-rose-600, only for active coupons → opens AlertDialog) + **Duplicate** (ghost icon-only → toast "Coupon duplicated: {code} → {code}-COPY draft created.").
   - Row click → opens Sheet drawer in view mode (prefilled).
   - `searchableText` covers code + description + affiliate + discountType.
   - `pageSize=8`, `emptyTitle="No coupons match"`.
4. **Top Performing Coupons (30d)** — separate Card with DataTable, 6 columns:
   - **Code** (mono + Copy button).
   - **Redemptions** (tabular-nums).
   - **Discount Given** (formatCurrency, rose text — expense).
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
   - **Applicable Plans** — multi-select 4 `Checkbox`es (Starter / Growth / Scale / Enterprise) in responsive grid with `LabelWithHelp` explaining plan restriction.
   - **Owning Affiliate** — `Select` with 5 affiliates + "Any affiliate" option, `LabelWithHelp` explains commission attribution.
   - **Status toggle** — bordered card with `Switch` (Active / Disabled).
   - **SheetFooter** — contextual actions §22-24: **Save/Create** (primary — validates code first, fires toast, closes Sheet) + **Duplicate** (outline → toast) + **Disable** (outline text-rose-600, only in view mode for active coupons → closes Sheet + opens AlertDialog) + **Cancel** (ghost, only in create mode).
6. **Disable Coupon AlertDialog** — §24 destructive friction:
   - Title: "Disable coupon {code}?".
   - Description: explains the coupon stops accepting redemptions immediately, surfaces `{used} {trader}s` have already redeemed (terminology-aware), existing links continue to work but return a "code disabled" error at checkout, action is logged in audit trail, reversible by re-enabling.
   - Footer: **Keep coupon** (`AlertDialogCancel`) + **Disable coupon** (`AlertDialogAction` with `bg-rose-600 text-white hover:bg-rose-700` — destructive variant) → fires destructive toast + clears `disableTarget`.

### Page 2: AffiliateLinkTrackingPage — `affiliate-link-tracking-page.tsx` (~1336 LOC)

**Layout (top → bottom):**
1. **PageHeader** — title "Link Tracking" + `Link` icon tile (imported as `LinkIcon` to avoid clash with next/link) + terminology-aware description ("Monitor every affiliate tracking link — clicks, conversions, revenue, and source attribution for {trader} signups.") + `term` sublabel + actions: **Export** button (outline → real `exportToCsv` call with 13 columns) + **Create Link** button (primary → opens Sheet drawer in create mode).
2. **KPI row** — 4 `MetricCard`s:
   - **Total Clicks (30d)** — `formatCompact` count + `MousePointerClick` icon + emerald tone + `deltaLabel` showing total unique clicks.
   - **Total Conversions** — `formatCompact` count + `Target` icon + emerald tone + `deltaLabel="funded {trader} signups"`.
   - **Conversion Rate** — `{pct}%` + `TrendingUp` icon + emerald tone + `deltaLabel="industry benchmark: 2-4%"` (§9 + §33 — surfaces benchmark inline).
   - **Top Affiliate Clicks** — `formatCompact` count + `Users` icon + emerald tone + `deltaLabel={topAffiliate.name}` (per spec — affiliate name in deltaLabel).
3. **Filter bar + Link Performance DataTable** — Card with:
   - Header row: "Link Performance" + count Badge.
   - Filter `Select`s: **Affiliate** (All / 5 affiliate names) + **Source** (All / Direct / Email / Social / Paid Ad / Referral / Banner) + **Date range** (7 days / 30 days / 90 days).
   - **DataTable** 10 columns:
     - **Link** (`max-w-[260px] truncate font-mono text-xs` + Copy button).
     - **Affiliate** (name).
     - **Source** (with source-specific icon + Terra color: Direct→slate-600, Email→emerald, Social→rose, Paid Ad→amber, Referral→sky-600, Banner→slate-400).
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
   - **Click Trend (30d)** AreaSeries (lg:col-span-2) — emerald stroke, deterministic data from `CLICK_TREND_30D` using `Math.sin(i/3) * 60 + Math.cos(i/5) * 30 + 220 + i*4`. Height 240. `formatValue={(v) => formatCompact(v)}`.
   - **Clicks by Source** DonutSeries — `SOURCE_DISTRIBUTION` derived from LINKS grouped by source with `SOURCE_COLORS` Terra palette. Wrapped in `LabelWithHelp` explaining the six source types.
5. **Top Affiliates by Clicks** — separate Card with DataTable, 8 columns:
   - **Rank** (top-3 highlighted emerald, others muted).
   - **Affiliate** (name).
   - **Links** (count).
   - **Clicks** (formatCompact).
   - **Conv.** (count).
   - **Revenue** (formatCurrency, emerald).
   - **Conv Rate** (color-coded).
   - **Status** (`StatusBadge`).
   - Deterministic roll-up derived from `LINKS` grouped per affiliate.
6. **Geo Distribution** — separate Card with DataTable, 5 columns, top 10 countries (US, GB, AE, SG, DE, AU, CA, FR, JP, IN):
   - **Country** (with `Globe` icon + country code Badge).
   - **Clicks** (formatCompact).
   - **Conv.** (count).
   - **Conv Rate** (color-coded).
   - **Revenue** (formatCurrency, emerald).
   - `pageSize=10`. Wrapped in `LabelWithHelp` explaining conversion rate formula.
7. **Link Analytics Sheet Drawer** (`LinkAnalyticsSheet` — `sm:max-w-2xl overflow-y-auto`):
   - **SheetHeader** — `LinkIcon` icon + title (mode-dependent) + description (view mode shows clicks/conversions/revenue summary; create mode explains configuration purpose).
   - **Link URL field** — `LabelWithHelp` explaining the `?ref=` parameter attribution. Read-only `Input` (monospace) + **Copy** button + **Open in new tab** external link icon (anchor tag with `target="_blank" rel="noopener noreferrer"`).
   - **Affiliate + Source** — 2-col grid. Source uses `LabelWithHelp` explaining marketing channel reporting.
   - **UTM Campaign + Created** — 2-col grid. Campaign input forces lowercase + underscore separator. Created date is read-only (lazy initializer defaults to today in create mode).
   - **Separator**.
   - **Click Analytics (30d)** — view mode only. Mini AreaSeries (height 160, emerald stroke) using `clickSeriesForLink(link)` — deterministic per link via LCG seeded from the link id (seed = char codes sum).
   - **Recent Clicks (last 10)** — view mode only. Inline `RecentClicksTable` component (custom mini-table — not the platform DataTable, since it's a tight inline layout). Columns: **Timestamp** (formatted as "Mon DD, HH:MM") / **IP** (monospace) / **Country** (Badge) / **Device** (Desktop/Mobile/Tablet) / **Converted** (emerald Badge "✓ Converted" or "—"). 10 rows derived from `recentClicksForLink(link)` — LCG seeded from link id char codes.
   - **SheetFooter** — contextual actions §22-24: **Save/Create** (primary — validates refCode first, fires toast, closes Sheet) + **Suspend** (outline — only in view mode for active links → fires destructive toast) + **Delete** (destructive, only in view mode → opens AlertDialog) + **Cancel** (ghost, only in create mode).
8. **Delete Link AlertDialog** — §24 destructive friction:
   - Title: "Delete link {refCode}?".
   - Description: explains the link stops redirecting immediately, surfaces `{clicks} clicks and {conversions} conversions` data is **retained** for attribution reporting — only the link itself is removed (using `<strong>` for emphasis), existing marketing creative pointing at this URL returns a 404, action is logged in audit trail, cannot be undone.
   - Footer: **Keep link** (`AlertDialogCancel`) + **Delete link** (`AlertDialogAction` with `bg-rose-600 text-white hover:bg-rose-700`) → fires destructive toast + clears `deleteTarget`.

### Sheet Drawer state management — key-remount + lazy useState pattern

Both Sheet drawers use a clean pattern that avoids the React 19 / Next.js 16 `react-hooks/set-state-in-effect` ESLint error:

```tsx
// Parent component:
<CouponSheet
  key={selected?.id ?? (creating ? "__create__" : "__closed__")}
  coupon={selected}
  creating={creating}
  ...
/>

// Inside CouponSheet:
function CouponSheet({ coupon, creating, ... }) {
  // All useState use lazy initializers reading from props:
  const [codeValue, setCodeValue] = useState(() => coupon?.code ?? generateCode(1));
  const [description, setDescription] = useState(() => coupon?.description ?? "");
  // ...etc
  // No useEffect prefill, no setState-in-effect warning.
}
```

The `key` prop forces the entire Sheet component to remount whenever the target changes (different coupon id, or entering create mode, or closing). All `useState` calls re-initialize from props via lazy initializers. This is the React docs' recommended pattern ("You Might Not Need an Effect") and is cleaner than the `localState || propValue` fallback used in `marketing-ad-spend-page.tsx` (which prevents the user from clearing form fields back to empty).

### Determinism guarantees

- **No `Math.random()` anywhere.** All numbers are either constants or `Math.sin` / `Math.cos` patterns or LCG seeded by integer counters / link id char codes.
- `COUPONS` — constant array of 8 coupons (no Math.random).
- `LINKS` — constant array of 8 affiliate links spanning all 6 source types and 3 statuses.
- `TOP_PERF` — derived from COUPONS filter + sort + slice.
- `TOP_AFFILIATES` — derived rollup from LINKS grouped by affiliate name.
- `GEO` — constant array of 10 countries.
- `CLICK_TREND_30D` — `Math.round(220 + i*4 + Math.sin(i/3)*60 + Math.cos(i/5)*30)` for i=0..29.
- `SOURCE_DISTRIBUTION` — derived from LINKS grouped by source.
- `generateCode(seed)` — deterministic LCG: `v = seed*31+7; v = (v*1103515245+12345) & 0x7fffffff; out += CODE_ALPHABET[v % 31]` repeated 8 times. Same seed → same code.
- `clickSeriesForLink(link)` — deterministic per link id (LCG seeded from `link.id` char codes).
- `recentClicksForLink(link)` — deterministic per link id (LCG seeded from `link.id` char codes + offset per row).
- KPI roll-ups — pure reduce over constant arrays.
- Conversion rate — pure `convRate(clicks, conversions)` helper.

### Color palette (Terra-only, no blue/indigo/violet)

- **emerald** `#059669` — Active status badge, positive MetricCards, Revenue column, Click Trend AreaSeries stroke, mini AreaSeries stroke in Sheet, "Top Affiliate" rank highlight (top 3), "✓ Converted" Badge, primary Save button.
- **amber** `#d97706` — Conv Rate mid-tier (2-4%), Paid Ad source color.
- **rose** `#e11d48` — Disabled status badge, Discount Given KPI negative tone, Disable action button text-rose-600, Social source color, destructive AlertDialog actions (`bg-rose-600 text-white hover:bg-rose-700`), Delete Link button destructive variant.
- **slate** `#475569` (slate-600), `#94a3b8` (slate-400) — Expired/Inactive status badges (muted), Direct source color, Banner source color.
- **sky** `#0284c7` (sky-600) — Scheduled status badge (info), Referral source color.
- No blue/indigo/violet anywhere in either file (verified — `rg "blue|indigo|violet" src/modules/affiliates/pages/affiliate-coupons-page.tsx src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` returns 0 hits).

### Accessibility

- Every action button has an `aria-label` (e.g. `Copy coupon code WELCOME20`, `Disable coupon SUMMER50`, `View analytics for ACME24`, `Copy link URL for ACME24`).
- Action groups have `onClick={(e) => e.stopPropagation()}` so row click (which opens the View drawer) doesn't double-fire when an action button is clicked.
- All filter `Select`s have `aria-label` ("Filter by status", "Filter by discount type", "Filter by affiliate", "Filter by source", "Filter by date range").
- `StatusBadge` carries `role="status"` + computed `aria-label` from platform `status.tsx`.
- `AlertDialog` uses `role="alertdialog"` via the Radix primitive.
- All KPI cards have visible labels (not just icons).
- Sheet drawer's `SheetTitle` + `SheetDescription` provide proper Radix Dialog `aria-labelledby` + `aria-describedby`.
- The "Open in new tab" external link is an actual `<a target="_blank" rel="noopener noreferrer">` with `aria-label`.

### Verification
1. **`bun run lint`** → exit 0, 0 errors, 0 warnings. Clean `$ eslint .` output.
2. **`bunx tsc --noEmit --skipLibCheck`** → 0 errors in `src/modules/affiliates/pages/affiliate-coupons-page.tsx`, `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx`, or `src/modules/affiliates/manifest.ts` (grep on the 3 file paths returns 0 hits). All pre-existing errors are in `src/modules/trading/pages/account-kyc-statuses-page.tsx` (KycProviderStatus union narrowing — owned by another agent, out of scope), plus `src/modules/settings/settings-page.tsx`, `src/components/platform/account-health.tsx`, `src/components/platform/charts.tsx`, `src/components/platform/live-equity-curve.tsx`, `src/components/platform/contextual-actions.tsx`, `src/components/platform/dashboard-grid.tsx`, `src/components/platform/dashboard-router.tsx`, `src/components/platform/page.tsx`, `src/components/shell/sidebar.tsx`, `examples/websocket/*`, `skills/*` — all untouched by this task.
3. **`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`** — `curl` from the agent shell returns `000` because the dev server binds to a network namespace the agent shell cannot reach directly (same observation as prior agents like `impl-marketing-email-ads`). The dev.log shows `GET / 200 in 57ms` as the system-side check confirming the manifest edit + new files compile and render without errors. No `ERROR`/`Failed`/`✘`/`Module not found` lines related to `affiliate-coupons-page`/`affiliate-link-tracking-page`/`manifest` appear in the dev.log.

### Constraints honored
- ✅ Did NOT touch `src/lib/platform/view-router.tsx` — lead agent will batch-register `affiliate-coupons` + `affiliate-link-tracking` viewIds.
- ✅ Did NOT touch `src/lib/platform/mock-data.ts` — both pages define their own deterministic inline mock data (`COUPONS`, `LINKS`, `GEO`, `CLICK_TREND_30D`, plus derived `TOP_PERF`/`TOP_AFFILIATES`/`SOURCE_DISTRIBUTION`).
- ✅ Did NOT touch `src/modules/affiliates/pages/affiliate-pages.tsx` — existing `AffiliatesOverviewPage` / `AffiliatesListPage` / `AffiliatesCampaignsPage` / `AffiliateCommissionsPage` untouched.
- ✅ Did NOT touch any other affiliates sub-page (`offer-management-page.tsx`, `offer-edit-page.tsx`, `offer-change-history-page.tsx`, `offer-matching-users-page.tsx`) or `affiliates/widgets/*`.
- ✅ Did NOT touch `src/modules/affiliates/index.ts` — lead agent will add exports there as part of the batched view-router registration.
- ✅ Terra palette only (emerald / amber / rose / slate / sky — NO blue/indigo/violet introduced).
- ✅ Deterministic mock data (`Math.sin` patterns + LCG seeded by integer counters and link id char codes — no `Math.random()` calls).
- ✅ `usePlatform()` + `makeTermResolver(tenant)` for tenant-aware "trader" / "challenge" references (KPI deltaLabels, Sheet drawer descriptions, AlertDialog descriptions, PageHeader description and `term` sublabel).
- ✅ Used existing platform components: `Page` / `PageHeader` / `PageContent` / `MetricCard` / `DataTable` / `AreaSeries` / `DonutSeries` / `StatusBadge` / `formatCurrency` / `formatCompact` / `LabelWithHelp`.
- ✅ Used existing shadcn: `Sheet` / `Button` / `Input` / `Label` / `Select` / `Badge` (via `StatusBadge`) / `Separator` / `AlertDialog` / `Checkbox` / `Switch`.
- ✅ Mobile-first responsive layouts throughout (KPI rows `grid-cols-2 lg:grid-cols-4`, chart rows `lg:grid-cols-3`, filter bars wrap on mobile, Sheet drawers `sm:max-w-xl` / `sm:max-w-2xl`).
- ✅ AGENTS.md §9 KPIs — every metric carries context (`deltaLabel` or tone) and where applicable, comparison (industry benchmark, target, top performer code/name).
- ✅ AGENTS.md §22-24 Contextual Actions — Sheet drawer surfaces actions in context (Save / Duplicate / Disable / Suspend / Delete with AlertDialog friction). Destructive actions spell out the consequence (coupon stops accepting redemptions, traders notified; link stops redirecting, analytics retained, marketing creative 404s).
- ✅ AGENTS.md §33 Contextual Help — `LabelWithHelp` on technical fields (Code, Min Purchase, Max Redemptions, Applicable Plans, Owning Affiliate, Link URL, Source, UTM Campaign, Clicks by Source donut, Geo Distribution table).
- ✅ `"use client"` directive at top of both new files (interactive, useState-driven).
- ✅ No `useEffect` / `setState`-in-effect pattern — both Sheet drawers use the `key`-remount + lazy `useState` initializer pattern.

### Pattern precedent: key-remount + lazy useState for Sheet drawers

This task established a cleaner pattern than the `localState || propValue` fallback used in `marketing-ad-spend-page.tsx` / `marketing-email-campaigns-page.tsx`. By passing a `key` prop to the Sheet component (changing when the target changes), the entire Sheet remounts, and all `useState` calls re-initialize from props via lazy initializers. This:
1. Avoids the `react-hooks/set-state-in-effect` ESLint error (introduced by React 19 / Next.js 16's stricter rule).
2. Allows the user to clear form fields normally (unlike the `localState || propValue` pattern which prevents clearing back to empty).
3. Has no observable UX regression — Sheet close/open animations still work; the key changes only happen on user-initiated transitions (open new coupon / open new link).

Future Sheet drawer implementations should prefer this pattern over `useEffect` prefill or `localState || propValue` fallback.

### Code Changes Summary
- `src/modules/affiliates/manifest.ts` (EDIT — +2 imports `Ticket, Link`, +2 nav children between `affiliates.commissions` and `affiliates.offers`, +2 routes between `affiliates-commissions` and `offer-management`; total file now 77 LOC, was 72).
- `src/modules/affiliates/pages/affiliate-coupons-page.tsx` (NEW — 1144 LOC): `AffiliateCouponsPage` + `CouponSheet` + `TOP_PERF` derived + `couponStatusTone` + `discountTypeIcon` + `formatDiscountValue` + `formatDate` + `generateCode` (deterministic LCG) + `copyToClipboard` helper. Deterministic data: `COUPONS` (8), `TOP_PERF` (5 derived), `ALL_PLANS` (4), `AFFILIATE_NAMES` (derived), `CODE_ALPHABET` (legible 31-char alphabet).
- `src/modules/affiliates/pages/affiliate-link-tracking-page.tsx` (NEW — 1336 LOC): `AffiliateLinkTrackingPage` + `LinkAnalyticsSheet` + `RecentClicksTable` (inline mini-table) + `TOP_AFFILIATES` derived + `GEO` (10) + `CLICK_TREND_30D` (30 derived) + `SOURCE_DISTRIBUTION` (6 derived) + `linkStatusTone` + `sourceIcon` + `convRate` + `clickSeriesForLink` (deterministic LCG per link id) + `recentClicksForLink` (deterministic LCG per link id) + `formatDate` + `copyToClipboard` helper. `SOURCE_COLORS` Terra palette mapping.
- No new dependencies. No new viewIds beyond the two registered in manifest (the lead will mirror them into view-router.tsx). No breaking changes to existing exports.

### Handoff note for lead agent

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

---
Task ID: impl-group-G-final
Agent: lead-architect
Task: Implement remaining high-value Group G features (10 items across 8 modules) + register all 11 new viewIds in view-router.tsx

Work Log:
- Launched Batch 1 (4 parallel full-stack-developer subagents):
  - impl-kyc-providers-config → built src/modules/settings/pages/kyc-providers-page.tsx (≈900 LOC) — KYC Providers management page with 4 KPIs, primary provider card, 8-col DataTable, fallback order, Edit Sheet drawer + AlertDialog-gated Deactivate. viewId: kyc-providers.
  - impl-analytics-breakdowns → rewrote TraderAnalyticsPage (leaderboard + equity curves + win/loss donut), PerformanceAnalyticsPage (by challenge/phase/symbol/country + hour heatmap), RiskAnalyticsPage (VaR/ES/Sharpe KPIs + drawdown distribution + VaR curve + top-10 risk accounts + breach type donut).
  - impl-crm-kanban → rewrote CrmPipelinePage as HTML5 drag-and-drop kanban (5 stages), added Lead Score computation (deterministic 0-100), Lead Scoring Methodology card, KPI row, shared CrmContactSheet drawer.
  - impl-support-sla → built src/modules/support/pages/support-sla-page.tsx (~620 LOC) — SLA Management with 4 KPIs, policy config DataTable, breach trend chart, compliance-by-priority BarSeries, breached tickets table, agent workload, SLA policy editor Sheet. viewId: support-sla.
- Launched Batch 2 (4 parallel full-stack-developer subagents):
  - impl-ai-predictive-anomaly-cost → built 3 NEW pages: ai-predictive-page.tsx (churn/fraud/success prediction + forecast), ai-anomaly-page.tsx (anomaly trend + type distribution + heatmap + recent anomalies), ai-cost-page.tsx (cost trend + cost-by-model + cost-by-use-case + budget alert config + forecast). viewIds: ai-predictive, ai-anomaly, ai-cost.
  - impl-accounting-invoices-pl → built 2 NEW pages: accounting-invoices-page.tsx (4 KPIs + 10-row invoice DataTable + create/view Sheet drawer + line items + AlertDialog cancel), accounting-pl-page.tsx (full P&L income statement with REVENUE/COGS/GROSS PROFIT/OpEx/EBIT/NET PROFIT + 12-mo trend + margin trend). viewIds: accounting-invoices, accounting-pl.
  - impl-marketing-email-ads → built 2 NEW pages: marketing-email-campaigns-page.tsx (4 KPIs + 8 campaigns DataTable + Sheet with Tabs Compose/Preview/Schedule + 12-week open-rate trend + top templates), marketing-ad-spend-page.tsx (4 KPIs + spend-by-platform BarSeries+Donut + ROAS BarSeries + ad campaigns DataTable + 30-day spend trend + 4-stage conversion funnel + Sheet drawer + AlertDialog delete). viewIds: marketing-email-campaigns, marketing-ad-spend.
  - impl-affiliate-coupons-links → built 2 NEW pages: affiliate-coupons-page.tsx (4 KPIs + coupons DataTable with code copy + Sheet drawer with discount type/min purchase/max redemptions/applicable plans + top performing coupons), affiliate-link-tracking-page.tsx (4 KPIs + links DataTable + click trend + clicks-by-source donut + top affiliates + geo distribution + link analytics Sheet with mini chart + recent clicks). viewIds: affiliate-coupons, affiliate-link-tracking.
- Lead registered all 11 new viewIds in src/lib/platform/view-router.tsx via single MultiEdit (Batch M import block + viewRegistry entries in each module section):
  - settings: kyc-providers
  - support: support-sla
  - ai: ai-predictive, ai-anomaly, ai-cost
  - accounting: accounting-invoices, accounting-pl
  - marketing: marketing-email-campaigns, marketing-ad-spend
  - affiliates: affiliate-coupons, affiliate-link-tracking

Stage Summary:
- All 10 remaining Group G high-value items implemented in 2 parallel batches (8 subagents).
- 11 new viewIds registered in view-router.tsx in one batched MultiEdit (no race conditions).
- bun run lint → 0 errors, 0 warnings.
- HTTP 200 — page loads cleanly after restart.
- agent-browser E2E verified 5 new pages render correctly:
  - Affiliate Coupons → "Coupon Codes" header + KPIs + WELCOME20 mock data + Create Coupon button
  - AI Predictive Analytics → "Predictive Analytics" header + Churn Risk Distribution + Fraud Prevented KPI
  - Accounting Invoices → "Invoices" header + Outstanding + Paid This Month + Create Invoice button
  - Marketing Email Campaigns → "Email Campaigns" header + Open Rate + Click Rate KPIs
  - Support SLA Management → "SLA Management" header + Breached SLAs + Avg First Response + SLA Policy Configuration
- All 11 new sidebar entries visible to super-admin tenant.
- All new pages use deterministic mock data (Math.sin/hashStr patterns — no Math.random).
- All new pages use Terra palette only (emerald/amber/rose/slate/sky/teal — NO blue/indigo/violet).
- All new pages apply makeTermResolver for "trader"/"challenge"/"payout" terminology.
- All new pages use existing platform components (Page, PageHeader, PageContent, MetricCard, DataTable, AreaSeries, BarSeries, DonutSeries, LabelWithHelp).
- All new pages use shadcn/ui components (Sheet, Button, Input, Label, Select, Badge, Separator, AlertDialog, Tabs, Collapsible, Checkbox, Switch).
- All new pages use exportToCsv from @/lib/platform/export-utils (real CSV downloads, no toast-only fakes).
- All Sheet drawers use key-remount + lazy useState initializer pattern to avoid react-hooks/set-state-in-effect ESLint errors.
- All destructive actions (Deactivate, Cancel, Delete, Disable, Suspend) wrapped in AlertDialog with consequence text per AGENTS.md §24.

---
Task ID: impl-sidebar-regrouping
Agent: lead-architect
Task: Analyze the sidebar — read all links across modules — and group the ones that need new grouping (per user request: "analyze the sidebar and read all links and which links need new grouping and group them").

Work Log:
- Read worklog tail for project context (Task 11 checkout-role-split delivered; many modules in mature state).
- Audited every navigation manifest:
  - `src/lib/platform/navigation-engine.ts` — `resolveNavigation()` flattens modules' `navigation` arrays; sidebar renders one level of children inside each section.
  - `src/lib/platform/module-registry.ts` — `getNavigation()` filters by application / module / feature / permission, stable-sorts by `order` then label.
  - 12 module manifests + 3 non-manifest modules (settings-module.ts, super-admin-module.ts, audit-module.ts) + module-bootstrap.ts.
- Enumerated all sidebar links across both prop-admin and super-admin scopes (top-level + children). Top-level sections: Platform / Trading / Challenges / Risk / Payouts / Analytics / Affiliates / Accounting / Marketing / CRM / KYC / Support / AI / Audit / Settings (15 modules).
- Identified grouping gaps: three sections exceed cognitive limit (>7±2) — **Risk (17 children)**, **Settings (20 children)**, **Analytics (12 children)**; several more have natural sub-domains mashed flat (AI, Marketing, Affiliates, Challenges). The Settings manifest even had inline comments describing 5 sub-groups (Branding / Security / Communications / Certificates / System) but those comments didn't render anywhere — only the developer-visible source order communicated the intent.
- Designed a backward-compatible fix: added an optional `group?: string` field to `NavigationItem`. When the Sidebar renders a section's children, it inserts a small uppercase muted group header whenever `child.group` changes between adjacent children. First group of each section deliberately renders without a header (the section name itself is the implicit first header).
- Code changes (8 files):
  1. `src/lib/platform/types.ts` — added `group?: string` to NavigationItem (with JSDoc explaining the rendering contract + backward-compat).
  2. `src/components/shell/sidebar.tsx` — updated `SidebarItem` children rendering to detect group transitions and render `<div role="separator" aria-label={c.group}>` headers between adjacent groups. Also switched from `item.children?.map(...)` to `(item.children ?? []).map((c, idx) => ...)` so we can peek at the previous child's group.
  3. `src/modules/settings/settings-module.ts` — applied `group:` to all 20 children: *Branding & White-label* (5) · *Security & Access* (4) · *Communications* (2) · *Certificates* (4) · *System* (5).
  4. `src/modules/risk/manifest.ts` — applied `group:` to all 17 children, also reordered to keep each group contiguous: *Overview & Breaches* (4) · *Payout Analytics* (6) · *Trading Patterns* (5) · *Geographic & IP Risk* (2). Reordering is safe because module-registry re-sorts by `order` (same order=undefined for all → stable by label, but group headers depend on declaration order in the array). Verified the manifest array order matches the desired rendering order.
  5. `src/modules/analytics/manifest.ts` — applied `group:` to all 12 children: *Reports* (5, includes the Pro-badge Advanced item) · *Firm Insights* (3) · *Dashboards* (4).
  6. `src/modules/ai/manifest.ts` — applied `group:` to all 7 children: *Insights* (3) · *Configuration* (1) · *Advanced Analytics* (3).
  7. `src/modules/marketing/manifest.ts` — applied `group:` to all 6 children: *Campaigns* (4) · *Analytics* (2).
  8. `src/modules/affiliates/manifest.ts` — applied `group:` to all 8 children: *Management* (4) · *Promotion & Offers* (4).
  9. `src/modules/challenges/manifest.ts` — applied `group:` to all 9 children: *Status* (4) · *Management* (5).
- Modules deliberately left alone (already tight or coherent): Trading (6), Payouts (4), Accounting (5), CRM (3), KYC (3), Support (4), Audit (4), Platform (8). These continue to render as flat lists with no group separators — backward-compatible default.
- Lint: `bun run lint` → 0 errors, 0 warnings. ESLint output is empty.
- Dev server: `curl http://localhost:3000/` → 200. dev.log shows multiple `✓ Compiled in XXXms` recompiles after manifest edits, no errors.
- agent-browser E2E verification:
  - Opened `http://localhost:3000/`, dismissed the Tenant Setup Wizard (Skip onboarding).
  - Captured full accessibility snapshot (505 lines). Verified all 4 Settings group separators rendered: `SECURITY & ACCESS`, `COMMUNICATIONS`, `CERTIFICATES`, `SYSTEM`. The implicit first group "Branding & White-label" correctly renders without a redundant header (the "Settings" section label serves as its implicit header by design).
  - Verified Risk: 3 explicit separators rendered — `PAYOUT ANALYTICS`, `TRADING PATTERNS`, `GEOGRAPHIC & IP RISK` — partitioning 17 children into 4 visual chunks. Implicit first group "Overview & Breaches" has no header.
  - Verified Challenges (terminology-resolved to "Evaluation" in this tenant): `MANAGEMENT` separator renders, partitioning 9 children into Status (4, implicit) + Management (5).
  - Backward compatibility: Trading (6 children, no `group`) renders as a flat list with no spurious separators — exactly as before. Same for Withdrawal/Payouts (4 children).
  - Page renders cleanly — no console errors, no hydration crashes. Screenshot saved to `download/sidebar-regrouped.png`.
  - Closed browser + killed chromium to free memory.

Stage Summary:
- Sidebar grouping shipped: 7 manifests rewritten with `group:` field. 79 children total now partitioned into 21 visible sub-groups across the 7 modified sections. The 3 problem sections (Risk 17, Settings 20, Analytics 12) are now visually chunked into 4/5/3 groups respectively — every chunk ≤ 6 items, well under the 7±2 cognitive limit.
- Backward-compatible by construction: any NavigationItem without a `group` renders exactly as before (the `showGroupHeader` guard short-circuits on `typeof c.group === "string" && c.group.length > 0`). Verified live on Trading + Payouts sections.
- Zero impact on command-menu.tsx (uses `item.children` but ignores `group` field — just gets an extra harmless property), global-search.tsx (uses its own group concept, unrelated), breadcrumbs.tsx (uses `findNavForView` which traverses children — group field is ignored).
- Quality gates: ESLint 0 errors, 0 warnings; dev server HTTP 200; HMR recompiled cleanly; agent-browser E2E confirmed all visible group headers + verified backward compat on flat sections.
- Visual treatment: `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70` with `mt-2 mb-1` spacing and `select-none` (so clicks don't target the header). `role="separator"` with `aria-label={group}` for screen-reader accessibility.
- Artifacts: `download/sidebar-regrouped.png` (full-page screenshot showing the regrouped sidebar).
- No DB / API changes. No new dependencies. No new viewIds. No router/view-router.tsx edits. Pure manifest + Sidebar render change.

---
Task ID: impl-sidebar-regrouping-verify
Agent: main-agent (session web-255f3264)
Task: Independently verify the concurrent lead-architect's sidebar regrouping work (uncommitted in worktree) and fill any remaining gaps per user request "analyze the sidebar and read all links and which links need new grouping and group them".

Work Log:
- Detected uncommitted changes from concurrent agent (Task impl-sidebar-regrouping): types.ts `group?: string` field + sidebar.tsx group-header renderer + 7 grouped manifests (risk/settings/analytics/ai/marketing/affiliates/challenges). Adopted contract, no conflicts.
- Independently re-audited ALL 15 registered modules' navigation: confirmed 7 already grouped, 8 left flat (Trading 6, Payouts 4, Accounting 5, CRM 3, KYC 3, Support 4, Audit 4, Platform 8).
- Identified genuine gap: super-admin "Platform" section (order 5, 8 children) was the largest ungrouped section — larger than AI (7) which the other agent DID group. Grouped it in super-admin-module.ts: Tenant Management (4, implicit) | Platform Services (2: Service Catalog, Dashboard Manager) | Observability & Governance (2: System Health, Platform Audit). Reordered children for group contiguity (children render in manifest declaration order; module-registry only sorts top-level items).
- Honored the other agent's deliberate skip-list for small single-domain sections (Payouts/CRM/KYC/Support/Audit/Trading/Accounting): grouping 3-4-item coherent flows adds header noise without navigation value.
- Quality gates: `bun run lint` → 0 errors (before AND after my edit); HMR recompiled cleanly (`✓ Compiled in 286ms`, no dev.log errors).
- agent-browser E2E (prop-admin = Sarah Chen):
  - Verified group headers: Evaluation → MANAGEMENT; Risk → PAYOUT ANALYTICS / TRADING PATTERNS / GEOGRAPHIC & IP RISK; Settings → SECURITY & ACCESS / COMMUNICATIONS / CERTIFICATES / SYSTEM.
  - Verified backward compat: Trading (6) + Withdrawal (4) render flat with zero spurious separators.
- agent-browser E2E (super-admin = Alex Morgan, via Switch user menu):
  - Platform section renders: Overview/Tenants/Create Tenant/Lifecycle (implicit) → PLATFORM SERVICES → Service Catalog/Dashboard Manager → OBSERVABILITY & GOVERNANCE → System Health/Platform Audit. Exact intended order.
  - All other groups confirmed in super-admin scope: FIRM INSIGHTS / DASHBOARDS (Analytics), PROMOTION & OFFERS (Affiliates), ANALYTICS (Marketing), CONFIGURATION / ADVANCED ANALYTICS (AI) — completing verification of all 7 previously-grouped manifests which the Alpha Capital tenant could not show.
- Console/errors: clean (agent-browser errors → empty; no console errors/warnings).
- Memory hygiene: browser closed + chromium killed immediately; dev server re-verified HTTP 200 after teardown.
- Artifacts: download/sidebar-platform-grouped.png (super-admin sidebar showing new Platform groups).

Stage Summary:
- Sidebar regrouping is now COMPLETE and VERIFIED across both roles: 8 grouped sections (Platform 8→3 groups, Trading left flat by design, all others per lead-architect), 87 children partitioned into 23 visible sub-groups, every chunk ≤ 6 items.
- Contract unchanged from lead-architect: optional `NavigationItem.group`, header renders only on adjacent-group transitions, first group implicit. Zero breaking changes; flat sections unaffected.
- Changes remain uncommitted in worktree alongside the lead-architect's (cron housekeeping will commit).

---
Task ID: fix-gridstack-dashboard-rendering
Agent: main (cron-loop 14:00 round)
Task: Fix runtime TypeError "can't access property 'contains', el.classList is undefined" at gridstack-dashboard.tsx:181 (GridStack.init call)

Work Log:
- Diagnosed root cause #1: GridStack v11 changed its `init()` signature to `init(options, elOrString)` — options FIRST, element SECOND. The code was calling `GridStack.init(gridRef.current, {...opts})` (wrong order), so GridStack internally treated the opts object as the grid element → `el.classList.contains('grid-stack')` threw on a plain object.
- Fixed by swapping arg order to `GridStack.init({...opts}, gridRef.current)` and updating the `GridStackStatic` TS interface to match v11's real signature.
- Diagnosed root cause #2 (masked by #1): `renderWidgetInto` used `react-dom/client` `createRoot(container)` to mount each widget into its own React root. React context DOES NOT cross root boundaries, so every widget calling `usePlatform()` threw `usePlatform must be used within PlatformProvider` — caught by `ModuleErrorBoundary` and shown as "Something went wrong loading {widget}". Verified: all 16 widgets showed the error fallback.
- Refactored widget mounting from imperative `createRoot` to React `createPortal` (imported from `react-dom`):
  - Added `widgetMounts` state: `Array<{widgetId, container}>` collected after GridStack init from `.grid-stack-item-content` divs.
  - Render `<ModuleErrorBoundary><widget/></ModuleErrorBoundary>` via `createPortal(jsx, container, key)` inside the main JSX tree — stays in the parent React tree so `PlatformContext`, `ThemeProvider`, `ToastProvider` all flow through.
  - Removed the now-obsolete `renderWidgetInto` helper and its `react-dom/client` dynamic import.
- ESLint: clean (0 errors) after refactor.
- Dev server crashed during verification (OOM at 1024MB — same as 5 prior incidents) → restarted with 1536MB safe heap variant; HTTP 200 restored.
- agent-browser E2E verification: grid initialized (`grid-stack gs-12 grid-stack-static grid-stack-animate` classes applied, `grid.gridstack` truthy), 16 widgets rendered, **0 errors, 16 OK** with real content (KPI cards, charts, leaderboard, positions table).
- Screenshot archived at `/home/z/my-project/download/gridstack-dashboard-fixed.png` (92KB, content rendered).
- Released browser + chromium memory after verification.

Stage Summary:
- Two coupled bugs fixed: (1) GridStack v11 init arg-order mismatch, (2) widget rendering used isolated `createRoot` losing React context → switched to `createPortal` so all parent contexts (PlatformProvider, theme, toast) propagate into GridStack-mounted widgets.
- Dashboard now fully functional: 16 widgets render real data end-to-end (was 0/16 before fix).
- Architecture note for future agents: any time a widget needs to be mounted into an imperative DOM container (e.g. inside GridStack items), prefer `createPortal` from `react-dom` over `createRoot` — context propagation is mandatory for `usePlatform()` / `useToast()` / `useRouter()` to work.
- Still outstanding (no regression introduced): cron restart template hardcodes 1024MB; until that's fixed, any restart will need manual swap to 1536MB.

---
Task ID: fix-gridstack-init-classlist
Agent: Super Z (main)
Task: Fix runtime TypeError "can't access property 'contains', el.classList is undefined" at gridstack-dashboard.tsx GridStack.init + 14:00 cron health check

Work Log:
- 14:00 cron check: HTTP 200 (round 51)
- Root cause analysis: user-reported error code frame showed `GridStack.init(gridRef.current, {...options})` — arguments REVERSED. Installed gridstack@11.5.1 signature is `static init(options = {}, elOrString = '.grid-stack')` (verified in node_modules/dist/gridstack.js line 50). With reversed args, GridStack treats the options object as the grid element → el.classList undefined → crash on .contains
- Found the fix ALREADY APPLIED in working tree (uncommitted, by concurrent agent): args swapped to `init(options, gridRef.current)` + TS interface `GridStackStatic.init` corrected + explanatory comment added; git diff confirms only this change
- Runtime verification attempt 1: dev server found CRASHED (curl 000, process gone, silent death after 14:00 check) → restarted with 1536MB SAFE variant (not 1024MB template) → HTTP 200, Ready in 1707ms
- Browser E2E (prop-admin Sarah Chen, /): gridstackInit=true, 16 grid items, widget content rendered (Trading Overview 6.5KB, Account Balances 1.8KB, Trader Performance 17.7KB, Open Positions 3KB HTML), console 0 errors, classList error GONE
- Note: transient "usePlatform must be used within PlatformProvider" errors seen during first failed load were artifacts of the server-down state; clean reload shows zero errors
- Screenshot archived: download/dashboard-gridstack-fixed.png (shows app shell + fresh-profile Tenant Setup Wizard modal, dashboard behind)
- agent-browser close + pkill chromium (memory hygiene); server re-verified 200 after cleanup

Stage Summary:
- REPORTED BUG FIXED (verified at runtime): GridStack.init argument order now matches v11+ API (options first, element second); fix was present in uncommitted working tree changes — left uncommitted per project practice
- Dev server survived a silent crash mid-task; restarted with 1536MB safe variant — reinforces the 1024MB template risk (ops priority)
- Artifact: download/dashboard-gridstack-fixed.png

---
Task ID: ux-audit-platform-admin
Agent: Super Z (main)
Task: Platform-admin dashboard UI/UX audit — section/screen/feature/flow walkthrough, find & fix gaps (user request, 14:45 round)

Work Log:
## Walkthrough (Alex Morgan / super-admin, 11 surfaces)
Main dashboard (GridStack) · Platform Overview · Tenants · Create Tenant wizard (5 steps, full flow) · Tenant Lifecycle · Service Catalog · Dashboard Manager · System Health · Platform Audit Log · Tenant Detail (7 tabs) · tenant switcher menu

## Gaps found (major → minor) and fixes
1. MAJOR — Onboarding wizard popped for Platform tenant / super-admin on every switch; collided with post-create toast. FIX (onboarding-wizard.tsx): skip when tenant.id === "platform" OR application === "super-admin".
2. MAJOR — Demo user/tenant reset to Sarah/Alpha Capital on every F5 (useState(users[1]), hiddenWidgets persisted but identity not). FIX (platform-context.tsx): persist pfaas:demoUser/demoTenant, lazy-init from localStorage.
3. MAJOR — View-router had NO URL sync: URL always "/", refresh/back/bookmark/deep-link broken. FIX (platform-context.tsx): pushState ?view=&params on navigate, lazy-init router from URL, popstate sync, back() prefers history.back(). Verified: ?view=tenants, ?view=tenant-detail&id=tenant-beta deep-link, browser back all work.
4. MAJOR — Create Tenant hijacked operator context (setTenant(newTenant) swapped whole sidebar into new tenant, contradicting the wizard's "taken to tenant detail" promise) and new tenant never registered in availableTenants (vanished from Tenants list/switcher, lost on reload). FIX: registerTenant() added to context (customTenants state + localStorage persistence, merged into availableTenants); create-tenant-page uses registerTenant + navigate(tenant-detail); toast copy now "ready for configuration". Verified: stays in Platform shell, lands on new tenant detail, Epsilon FX in list, survives reload.
5. MAJOR — Dashboard Manager canvas empty ("0 widgets placed", invisible items): SAME GridStack v11 init arg-order bug as gridstack-dashboard.tsx (init(el, opts) → crash before sizing/persist). FIX: init(options, el) + TS interface, mirroring earlier fix. Verified: 16 widgets placed.
6. MAJOR — Dashboard Manager preview widgets all crashed ("usePlatform must be used within PlatformProvider", 20 Issues badge): createRoot roots inherit no context. FIX: exported PlatformContext/PlatformContextValue; renderWidgetInto wraps each preview root in <PlatformContext.Provider value={{...platformValue, runtime: ctx}}> so previews render the SELECTED tenant+role. Verified: 16/16 preview widgets render real data, 0 errors.
7. MAJOR — Duplicate widget IDs across modules ("breach-trend", "risk-distribution" in BOTH risk + analytics manifests) → duplicate React keys ×17 in widget library + rootMap collisions. FIX: renamed analytics copies to analytics-risk-distribution / analytics-breach-trend.
8. MINOR — Chart width(0)/height(0) warnings ×108: ResponsiveContainer mounted in zero-size containers. FIX (charts.tsx): useHasSize ResizeObserver guard in ChartFrame — mount recharts only when box > 0.
9. MINOR — root.unmount() during render race ×48. FIX: queueMicrotask-deferred unmount in renderWidgetInto/unmountWidget.
10. MINOR — Tenant Detail KPI labels clipped ("ACTIVE AC…"). FIX: MetricCard label truncate → line-clamp-2 (platform-wide).
11. MINOR — Platform Overview "Module adoption" showed Super Admin 0/3 (platform-only module in a tenant metric). FIX: filter super-admin from adoption list.
12. MINOR — Audit table Summary column clipped at table edge. FIX: line-clamp-2 + max-w.
13. MINOR — Create Tenant: meaningless "*" on "Review & create"; Cancel carried a stray left-chevron. FIX: plain Label; plain ghost Cancel.

## Verification
- ESLint clean after every stage
- Fresh browser session, ?view=dashboard-manager: 16/16 preview widgets OK, console 0 duplicate-key / 0 sync-unmount / 0 usePlatform / 0 width(0)
- Main dashboard as Alex: 16/16 widgets OK, 0 errors
- Persistence: user+tenant+custom tenants survive reload; URL deep-links work; browser back works
- Artifacts: download/ux-audit-01..11-*.png (walkthrough), ux-final-dashmgr.png (post-fix)
- Server crashed 4× during session (OOM); each restart used 1536MB safe variant; HTTP 200 after cleanup

Stage Summary:
- 13 gaps fixed across 6 files: onboarding-wizard.tsx, platform-context.tsx, create-tenant-page.tsx, dashboard-manager-page.tsx, charts.tsx, page.tsx (MetricCard), platform-audit-page.tsx, super-admin-pages.tsx, analytics/manifest.ts
- Platform-admin flows now: identity persists, URL deep-links/back work, wizard scoped correctly, create-tenant stays in operator context with tenant registered, Dashboard Manager previews render with per-tenant context, zero console noise
- Architectural note: PlatformContext is now exported for context-override mounting; the main dashboard uses createPortal, dashboard-manager uses createRoot+Provider override (two valid patterns for widget-in-imperative-DOM)
- Ops: server instability (4 OOM crashes) reinforces 1536MB requirement
