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
