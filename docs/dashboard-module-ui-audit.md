# Dashboard Module & UI/UX Audit — trader · prop-admin · platform-admin

**Date:** 2026-11-06
**Scope:** static code + information-architecture audit of `apps/trader`, `apps/prop-admin`, `apps/platform-admin`
**Audit base:** `fcba12c` — inspected working tree at `832a035` (branch `main`, 6 commits after base; working tree clean)
**Outcome:** findings only. **No code was changed by this audit.**

Finding IDs: `TR-nnn` (trader), `PA-nnn` (prop-admin), `PL-nnn` (platform-admin console). IDs are assigned within this document, in presentation order.

---

## 1. Methodology

### 1.1 Inventory performed

| App | Shape | Inventory |
|---|---|---|
| `apps/trader` | Next.js App Router, 78 `page.tsx` routes | 78 routes, 48 sidebar targets, 11 module directories under `src/modules/*` |
| `apps/prop-admin` | Single-page app (`src/app/page.tsx`) + client view-router | 16 registered modules (14 `manifest.ts` + `audit-module.ts` + `settings-module.ts`), 5 non-module directories, 199 generated stitch pages, 182 registered nav hrefs (+136 flag-gated stitch hrefs) |
| `apps/platform-admin` | Single-page console + client view-router | 15 catalog entries (manifest-only stubs), super-admin section with 60 nav items / 72 declared routes / 77 page components |

### 1.2 Classification sources (mandatory vs auxiliary)

No single authoritative "mandatory vs auxiliary" list exists in the repository, so this audit **synthesizes** one from three sources, in priority order:

1. **`docs/AGENTS.md` §5 — role mental models** (Super Admin, Prop Firm Admin, Finance Manager, Risk Manager, Marketing Manager, Trader). A surface is *mandatory* when it directly answers a mental-model item for the app's primary role(s) ("How am I doing?", "Am I safe?", "payouts / risk / KYC", "platform / tenants / services / health").
2. **`docs/AGENTS.md` §6–7 — navigation & progressive disclosure.** §6 names the expected navigation taxonomy (Operate / Monitor / Grow / Finance / Configure / System); §7 requires a compact sidebar with depth pushed into tabs, filters and detail views. A module that §6 places on the core path is mandatory *unless* §5 assigns it to a secondary role only.
3. **Module manifests** — `category`, `optional`, permission keys and nav `order` in `apps/prop-admin/src/modules/*/manifest.ts` (and `*-module.ts`), mirrored by `apps/platform-admin/src/lib/platform/module-catalog.ts`.

**Decision rule used throughout:**

- **Mandatory (M)** — serves a §5 mental-model item for the app's primary role, **or** manifest `category: "core"` with `optional: false`, **or** §6 places it on the primary role's core path (Operate / Monitor / Finance / Configure / System for admins; the trader job loop for traders).
- **Auxiliary (A)** — growth/engagement surfaces (§6 "Grow"), advanced/optional add-ons (`optional: true`, categories `growth` / `advanced` / `ai`), education/engagement features, or surfaces outside the §5 loop.

Where the two signals disagree (manifest `optional: true` but §5/§6 makes the surface core), the §5/§6 signal wins and the tension is called out as a finding.

### 1.3 Status legend

| Symbol | Meaning |
|---|---|
| ✅ **Present** | Nav entry + route/view binding + view component + substantive UI all exist. Mock/fixture data is acceptable; demo-only actions are explicitly labelled as such. |
| ⚠️ **Partial** | Reachable UI exists but is incomplete: dead buttons (no `onClick`), toast-only actions that never mutate state, missing wiring, or hardcoded sections inside an otherwise real page. |
| 🚧 **Demo** | Placeholder content — hardcoded sample arrays, fixed statistics, no meaningful interaction. |
| ❌ **Broken** | Nav item or route resolves to nothing ("View … not found"). |
| 🔌 **Unreachable** | Real UI exists but has no nav entry and no inbound link anywhere in `src` (dead code). |
| ➖ **Stub** | A module/nav/route declaration with no view of its own. |

### 1.4 How statuses were derived (and verified)

- Static reading only: page components, manifests, view-router maps, sidebar/nav definitions, and action handlers.
- Signals used: presence of `onClick`/form handlers, state mutation vs `toast()`-only actions, hardcoded arrays vs store/fixture wiring, `TODO`/`coming soon`/`demo` markers, nav↔route↔view binding completeness.
- Verification: every source path and symbol cited below was re-checked against the working tree; status ratings were spot-checked per app (trader: web-terminal / account-settings / orphans; prop-admin: bootstrap order, `marketing-dashboard` route gap, thin pages; platform-admin: `api-keys`, `role-management`, `emergency-controls`, `platform-health`, `platform-billing`). Counts (routes, nav items, view keys, stitch pages) were re-derived with `find`/`grep`.
- Constraint noted for all three apps: **there is no network data layer** — `grep 'fetch(|axios|useQuery'` returns 0 hits in all three `src` trees. "Present" therefore means *complete UI with local state/fixtures*, not production-wired.

---

## 2. Classification framework

### 2.1 Role → mandatory surfaces (AGENTS.md §5)

| Role (§5) | Mental model / emphasis | Mandatory surfaces implied |
|---|---|---|
| Super Admin | platform, tenants, services, health, integrations, subscriptions, global problems | Tenant health & lifecycle, platform/service health, integration problems, platform usage, system alerts, subscriptions/billing, audit |
| Prop Firm Admin | traders, accounts, challenges, risk, payouts, business performance, operations | Trading, challenges, risk, payouts, KYC/reviews, business overview, revenue |
| Finance Manager | payouts, payment failures, reconciliation, revenue, outstanding items, transactions | Payouts, accounting/reconciliation, transactions, invoices |
| Risk Manager | accounts near breach, breaches, exposure, abnormal activity, rule violations | Risk, breaches, exposure analytics |
| Marketing Manager | acquisition, affiliates, conversion, campaigns, CPA, attribution | Affiliates, marketing, CRM |
| Trader | how am I doing / am I safe / what are my rules / how close to goal / what next | Account health, progress, risk, open positions, rules, alerts, next milestone, recent activity |

### 2.2 Expected navigation taxonomy (AGENTS.md §6)

`Home · Operate (Traders, Accounts, Challenges, Payouts, Reviews) · Monitor (Risk, Breaches, Performance, Analytics) · Grow (Affiliates, Marketing, CRM) · Finance (Revenue, Accounting, Transactions) · Configure (Challenges, Rules, Risk Policies, Payout Policies, Integrations) · System (Team, Roles, Audit, Settings)`.
§7: keep the primary navigation compact; push depth into tabs/filters/detail views.

### 2.3 Module classification summary

**apps/trader** (primary role: Trader — all §5 items are the trader job loop)

| Module dir | Class | Rationale |
|---|---|---|
| `dashboard` | **M** | §5 "how am I doing / next milestone / recent activity" — the landing surface |
| `accounts` | **M** | §5 "am I safe / what are my rules / how close to goal" (objectives, rules, account detail) |
| `trading` | **M** | §5 "open positions / risk" — core job |
| `payouts` | **M** | §5 "what do I need to do next" + Finance Manager emphasis on payouts |
| `marketplace` | **M** | Challenge purchase/compare — the entry to the whole product loop |
| `onboarding` | **M** | KYC, verification, provisioning, breach/lock — account lifecycle gates |
| `finance` | **M** | §5 "how am I doing" via statements, certificates, documents, tax |
| `support` | **M** | Tickets, help, terms — operational necessity |
| `account` | **M** | Settings, security, 2FA, notifications (§5 "alerts") |
| `community` | **A** | Leaderboard/competitions/referrals — engagement, outside the §5 loop |
| `announcements` | **A** | Broadcast channel; alerts are already served by notification-center |

**apps/prop-admin** (primary role: Prop Firm Admin; Finance/Risk/Marketing Manager are secondary roles served by the same app)

| Module | Manifest (category / optional) | Class | Rationale |
|---|---|---|---|
| `trading` | core / — | **M** | §5 traders+accounts; §6 Operate |
| `challenges` | core / — | **M** | §5 challenges; §6 Operate + Configure |
| `risk` | core / — | **M** | §5 risk; §6 Monitor (Risk, Breaches) |
| `payouts` | core / — | **M** | §5 payouts; §6 Operate + Finance |
| `settings` | core / — | **M** | §6 System → Settings |
| `self-service` | core / — | **M** | §5 trader loop surfaced to operators; nav-only aggregator (see PA-017) |
| `kyc` | compliance / true | **M** | §5 Prop Firm Admin "KYC / Reviews" — manifest `optional` conflicts with §5 (finding PA-010) |
| `support` | core / true | **M** | §5 "operations"; manifest marks it an optional add-on (tension noted) |
| `audit` | compliance / true | **M** | §6 System → Audit; compliance loop |
| `accounting` | advanced / true | **M** | Finance Manager §5: reconciliation, revenue, transactions (§6 Finance) |
| `analytics` | growth / true | **M** | §5 "business performance / Revenue"; §6 Monitor → Performance/Analytics — manifest marks it growth/optional (tension noted) |
| `affiliates` | growth / true | **A** | §5 Marketing Manager only; §6 Grow |
| `marketing` | growth / true | **A** | §5 Marketing Manager; §6 Grow |
| `crm` | growth / true | **A** | §5 Marketing Manager; §6 Grow |
| `ai` | ai / true | **A** | Advanced add-on, outside every §5 core loop |
| `stitch` | core / true, flag-gated | **A** | Generated reference renders, demo builds only (`NEXT_PUBLIC_SHOW_STITCH=1`) |
| `overview`, `notifications`, `profile`, `help`, `pendings` | *no manifest, not registered* | **M** (as surfaces) | Landing view, alerts, profile, help, pending tasks — §5 essentials that are **not** modules and therefore unguarded/unlisted (findings PA-018…PA-022) |

**apps/platform-admin** (primary role: Super Admin)

| Console surface | Class | Rationale |
|---|---|---|
| Tenant Management, Operations, Observability, Infrastructure, Platform Config, Security, Finance, Governance, Integrations groups | **M** | §5 Super Admin: platform/tenants/services/health/integrations/subscriptions/global problems; §6 System + Configure |
| Developer, Analytics, Content & Marketing, Platform Docs groups | **A** | Developer tooling, reporting extras, content and docs — outside the §5 health/tenant loop |
| 15 catalog entries (`module-catalog.ts`) | *data, not nav* | Mirror of the prop-admin module set for entitlement management; classified by their prop-admin class above. Keep-in-lockstep requirement is a maintenance finding (PL-016) |

---

## 3. apps/trader — findings (TR)

Nav source of truth: `src/components/shell/sidebar.tsx` — `directItems` (line 111, 4 items) + `sections` (line 118, 44 items) = **48 sidebar targets, all resolving to an existing `page.tsx` (0 broken links)**. Consumed by `src/components/shell/app-shell.tsx` and `src/components/shell/command-palette.tsx`.

Status tally across 78 routes: **68 ✅ · 6 ⚠️ · 2 🚧 · 2 ➖** (plus 4 🔌 orphans counted inside those rows).

### 3.1 Dashboard (module `dashboard`) — Mandatory

| ID | View / route | Status | Source (file :: symbol) | Description / user journey |
|---|---|---|---|---|
| TR-001 | `/dashboard` | ✅ | `src/app/dashboard/page.tsx` :: `DashboardPage` | Equity curve, KPI cards, milestone + risk alerts, profit-target progress. Journey: Trader → logs in → lands here → reads "how am I doing / next milestone" (§5). Loading state present. |
| TR-002 | `/state-adaptive` | ✅ | `src/app/state-adaptive/page.tsx` :: `StateAdaptiveDashboardPage` | Lifecycle state switcher rewires banner/CTA/stats; explicitly a simulator. Nav: Account Lifecycle → Lifecycle Simulator. |

### 3.2 Accounts (module `accounts`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-003 | `/my-accounts` | ✅ | `src/app/my-accounts/page.tsx` :: `MyAccountsPage` | Account cards, phase badges, KPI mini-cards, progress bars. Journey: Dashboard → My Accounts → open an account. |
| TR-004 | `/account-detail` | ✅ | `src/app/account-detail/page.tsx` :: `AccountDetailPage` | KPIs + charts + 3 roving-tab sections; reached via account card. |
| TR-005 | `/objectives` | ✅ | `src/app/objectives/page.tsx` :: `ObjectivesPage` | Progress bars, rule-adherence panel, what-if calculator (localStorage). §5 "how close am I to my goal". |
| TR-006 | `/rules` | ✅ | `src/app/rules/page.tsx` :: `RulesPage` | Allowed/limit rule cards + program parameters, scoped to active account. §5 "what are my rules". Reached from objectives/account detail. |

### 3.3 Trading (module `trading`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-007 | `/trading-positions` | ✅ | `src/app/trading-positions/page.tsx` :: `OpenPositionsPage` | Live session table (close/SL-TP/breakeven/flatten) + Pending Orders tab, wired to `TradingContext`. Journey: Trading → Open Positions. |
| TR-008 | `/order-ticket` | ✅ | `src/app/order-ticket/page.tsx` :: `OrderTicketPage` | Real `onSubmit` → `handlePlaceOrder`, lot/risk calculator. |
| TR-009 | `/order-detail` | ✅ (🔌 nav) | `src/app/order-detail/page.tsx` :: `OrderDetailPage` | Pending-order modify/cancel — but no sidebar entry and no inbound link found; reachable only by direct URL. |
| TR-010 | `/trade-history` | ✅ | `src/app/trade-history/page.tsx` :: `TradeHistoryPage` | Search/sort/pagination + export over `terraTrades`. |
| TR-011 | `/trade-detail` | ✅ | `src/app/trade-detail/page.tsx` :: `TradeDetailPage` | Execution detail + chart + timeline; `activePrefix` highlight on Trade History. |
| TR-012 | `/closed-positions` | ✅ (🔌 orphan) | `src/app/closed-positions/page.tsx` :: `ClosedPositionsPage` | Permission-gated list. **No nav entry and no inbound link** — only referenced by the unused `traderNavigation` in `src/lib/platform/view-router.tsx:95`. |
| TR-013 | `/trader-detail` | ✅ (🔌 orphan) | `src/app/trader-detail/page.tsx` :: `TraderDetailPage` | Full permission-gated workspace (KPIs, tabs, DataTable) — same orphan problem as TR-012; sidebar never shows it. |
| TR-014 | `/market-watch` | ✅ | `src/app/market-watch/page.tsx` :: `MarketWatchPage` | Bid/ask/spread cards from fixture; static (no ticks); Trade → `/order-ticket`. |
| TR-015 | `/web-terminal` | ⚠️ | `src/app/web-terminal/page.tsx` :: `WebTerminalPage` (`src/modules/trading/pages/web-terminal-page.tsx`) | Browser Web Terminal converted from `stitch_screens/web_terminal_launch`. **"Launch →" (line 59) and "Download" (line 80) have no `onClick`; DXtrade row is a "Coming soon" badge (line 62).** Journey: Trading → Web Terminal → press Launch → nothing happens. |
| TR-016 | `/performance-analytics` | ✅ | `src/app/performance-analytics/page.tsx` :: `PerformanceAnalyticsPage` | Tables/charts/weekday heatmap/P&L histogram; export is a mock toast (labelled). |
| TR-017 | `/risk-dashboard` | ✅ | `src/app/risk-dashboard/page.tsx` :: `RiskDashboardPage` | Health meters/gauges fed by live `TradingContext` positions + breach history. §5 "am I safe". |
| TR-018 | `/trading-patterns` | ✅ | `src/app/trading-patterns/page.tsx` :: `TradingPatternsPage` | Three detection panels over closed-trade fixtures. |
| TR-019 | `/trade-replay` | ✅ | `src/app/trade-replay/page.tsx` :: `TradeReplayPage` | Playback controls + step timeline + price path. |

### 3.4 Tools (module `trading`, nav group "Tools") — Auxiliary

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-020 | `/simulator` | ✅ | `src/app/simulator/page.tsx` :: `TradingSimulatorPage` | Virtual-capital simulator, 744 lines, live fixture rules. |
| TR-021 | `/trading-journal` | ✅ | `src/app/trading-journal/page.tsx` :: `TradingJournalPage` | Entry CRUD persisted to localStorage (labelled demo-only). |
| TR-022 | `/trading-plan-builder` | ✅ | `src/app/trading-plan-builder/page.tsx` :: `TradingPlanBuilderPage` | Structured plan form with local state. |
| TR-023 | `/trading-calendar` | ✅ | `src/app/trading-calendar/page.tsx` :: `TradingCalendarPage` | Month heat map derived from closed trades + per-day drawer. |
| TR-024 | `/economic-calendar` | ✅ | `src/app/economic-calendar/page.tsx` :: `EconomicCalendarPage` | Search/impact filters, localStorage view prefs. |

### 3.5 Challenges & marketplace (module `marketplace`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-025 | `/marketplace` | ✅ | `src/app/marketplace/page.tsx` :: `MarketplacePage` | Filter pills + challenge cards. Journey: Trader → Marketplace → compare → buy. |
| TR-026 | `/challenge-comparison` | ✅ | `src/app/challenge-comparison/page.tsx` :: `ChallengeComparisonPage` | 3-program table with per-column checkout links. |
| TR-027 | `/challenge-detail` | ✅ | `src/app/challenge-detail/page.tsx` :: `ChallengeDetailPage` | Spec sheet, phase table, purchase CTA (`?id` lookup). |
| TR-028 | `/checkout` | ✅ | `src/app/checkout/page.tsx` :: `CheckoutPage` | Multi-step form, live order recalc, routes to failure/completed. |
| TR-029 | `/checkout-failure` | ✅ | `src/app/checkout-failure/page.tsx` :: `CheckoutFailurePage` | Failure recovery, retry → `/checkout?retry=1`. |
| TR-030 | `/checkout-validation` | ✅ | `src/app/checkout-validation/page.tsx` :: `CheckoutValidationPage` | Replays billing validators over the saved draft. |
| TR-031 | `/promo-error` | ✅ | `src/app/promo-error/page.tsx` :: `PromoErrorPage` | Promo rejection recovery (`?code=`), reasons + alternatives. |
| TR-032 | `/purchase-completed` | ⚠️ | `src/app/purchase-completed/page.tsx` :: `PurchaseCompletedPage` | Success screen works, but order number and contents are hardcoded (`#TT-48210`, `terraChallenges[1]`) regardless of what was bought. |
| TR-033 | `/purchase-history` | ✅ | `src/app/purchase-history/page.tsx` :: `PurchaseHistoryPage` | Purchases table with invoice links. |
| TR-034 | `/my-challenges` | ✅ | `src/app/my-challenges/page.tsx` :: `MyChallengesPage` | Active/completed cards with drawdown meters. §5 "how close am I to my goal". |

### 3.6 Payouts (module `payouts`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-035 | `/payout-history` | ✅ | `src/app/payout-history/page.tsx` :: `PayoutHistoryPage` | Nav landing: eligibility summary above history table. |
| TR-036 | `/payout-request` | ✅ | `src/app/payout-request/page.tsx` :: `PayoutRequestPage` | Funded-only gated form; blocked accounts get an explanation. Journey: Payouts → Request → submit → status. |
| TR-037 | `/payout-eligibility` | ✅ | `src/app/payout-eligibility/page.tsx` :: `PayoutEligibilityPage` | Checklist + schedule management (demo-labelled persistence). |
| TR-038 | `/payout-detail` | ✅ | `src/app/payout-detail/page.tsx` :: `PayoutDetailPage` | Status timeline + demo toasts; quick-view variant embedded. |
| TR-039 | `/scaling-plan` | ✅ | `src/app/scaling-plan/page.tsx` :: `ScalingPlanPage` | Tier ladder, readiness meters, counted-payout history. |
| TR-040 | `/withdrawal-methods` | ✅ | `src/app/withdrawal-methods/page.tsx` :: `WithdrawalMethodsPage` | Full CRUD + two-step confirm; every toast says "(Demo)". |
| TR-041 | `/payouts` | ➖ (🔌 orphan) | `src/app/payouts/page.tsx` :: renders `PayoutHistoryPage` | **Duplicate route**: identical import as `/payout-history`, no nav entry, no inbound links anywhere in `src`. Dead weight + a doc comment in `payout-history-page.tsx` claims nav points here (it does not). |

### 3.7 Finance (module `finance`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-042 | `/account-statement` | ✅ | `src/app/account-statement/page.tsx` :: `AccountStatementPage` | Period selector genuinely filters trades/payouts; balance-chain math. §5 "how am I doing". |
| TR-043 | `/certificates` | ✅ | `src/app/certificates/page.tsx` :: `CertificatesPage` | Certificate preview cards; download is a mock toast (labelled "no backend/PDF service"). |
| TR-044 | `/documents` | ✅ | `src/app/documents/page.tsx` :: `DocumentsPage` | Doc centre grid + secure-viewer quick view. |
| TR-045 | `/document-viewer` | ✅ | `src/app/document-viewer/page.tsx` :: `DocumentViewerPage` | Access-code unlock gate then preview. |
| TR-046 | `/invoice-detail` | ⚠️ | `src/app/invoice-detail/page.tsx` :: `InvoiceDetailPage` | **"Download PDF" button (line 29) has no `onClick`**; invoice lines hardcoded, only `?id` echoed. Journey: Purchase History → invoice → Download → nothing. |
| TR-047 | `/tax-documents` | ⚠️ | `src/app/tax-documents/page.tsx` :: `TaxDocumentsPage` | Header comment promises a year selector that was never built; inline hardcoded `taxDocs`, no filters. |
| TR-048 | `/tax-statement-detail` | ⚠️ | `src/app/tax-statement-detail/page.tsx` :: `TaxStatementDetailPage` | **"Download PDF" button (line 39) has no `onClick`**; hardcoded `monthly` array. |

### 3.8 Onboarding & account lifecycle (module `onboarding`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-049 | `/kyc-onboarding` | ✅ | `src/app/kyc-onboarding/page.tsx` :: `KycOnboardingPage` | Multi-step KYC form, focus management + aria-live. Journey: sign-up → KYC → status. |
| TR-050 | `/kyc-verification-status` | ✅ | `src/app/kyc-verification-status/page.tsx` :: `KycVerificationStatusPage` | Timeline + rejected/approved variants; explicit "Demo states" preview links. |
| TR-051 | `/account-verification-1` | ✅ | `src/app/account-verification-1/page.tsx` :: `AccountVerification1Page` | Validated form → pushes step 2. |
| TR-052 | `/account-verification-2` | ⚠️ | `src/app/account-verification-2/page.tsx` :: `AccountVerification2Page` | **"Upload" rows are styled `<span>`s — no file input, no handler**; review pane hardcoded. Journey: Verification step 2 → click Upload → nothing happens. |
| TR-053 | `/account-provisioning` | 🚧 | `src/app/account-provisioning/page.tsx` :: `AccountProvisioningPage` | Hardcoded `stages` array (4 done / 2 pending fixed) → progress bar is permanently 67%, never updates. |
| TR-054 | `/evaluation-passed` | 🚧 | `src/app/evaluation-passed/page.tsx` :: `EvaluationPassedPage` | Fixed celebration stats (68% win rate, 12 days, 0 violations) + hardcoded next-steps. |
| TR-055 | `/account-breach` | ✅ | `src/app/account-breach/page.tsx` :: `AccountBreachPage` | Breach fixture, limit-vs-breach meter, retry links. §5 "am I safe / what next". |
| TR-056 | `/account-locked` | ✅ | `src/app/account-locked/page.tsx` :: `AccountLockedPage` | Lock reasons, numbered steps, support CTAs; inbound from `/login`. |
| TR-057 | `/login` | ✅ | `src/app/login/page.tsx` :: `LoginPage` | Validated form; `setTimeout` push after 600 ms — **no auth backend** (demo flow). |
| TR-058 | `/forgot-password` | ✅ | `src/app/forgot-password/page.tsx` :: `ForgotPasswordPage` | Confirmation state only; no email sent (documented demo). |
| TR-059 | `/2fa-setup` | ✅ | `src/app/2fa-setup/page.tsx` :: `TwoFactorSetupPage` | 3-step wizard (QR → OTP → backup codes) with a11y wiring. |
| TR-060 | `/recovery-codes` | ✅ | `src/app/recovery-codes/page.tsx` :: `RecoveryCodesPage` | View/download/regenerate; local state only. |
| TR-061 | `/` | ➖ | `src/app/page.tsx` :: `Home` | Server `redirect("/dashboard")` only — correct, listed for completeness. |

### 3.9 Account settings (module `account`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-062 | `/account-settings` | ⚠️ | `src/app/account-settings/page.tsx` :: `AccountSettingsPage` | Link hub is fine, but the Danger-zone **"Delete account" button (line ~116) has no `onClick`** — a destructive CTA that silently does nothing. |
| TR-063 | `/profile-security` | ✅ | `src/app/profile-security/page.tsx` :: `ProfileSecurityPage` | Profile/password/avatar forms, local-state demos labelled. |
| TR-064 | `/trading-credentials` | ✅ | `src/app/trading-credentials/page.tsx` :: `TradingCredentialsPage` | Reveal/copy, demo reset, Web Terminal link. |
| TR-065 | `/sessions` | ✅ | `src/app/sessions/page.tsx` :: `SessionsPage` | Revoke / revoke-all (demo-labelled). |
| TR-066 | `/api-tokens` | ✅ | `src/app/api-tokens/page.tsx` :: `ApiTokensPage` | Create dialog + copy/revoke over fixture. |
| TR-067 | `/notification-center` | ✅ | `src/app/notification-center/page.tsx` :: `NotificationCenterPage` | Grouped feed, read/unread state. §5 "alerts". |
| TR-068 | `/notification-preferences` | ✅ | `src/app/notification-preferences/page.tsx` :: `NotificationPreferencesPage` | Channel toggles; save says "(demo — not persisted)". |
| TR-069 | `/announcements` | ✅ (🔌 orphan) | `src/app/announcements/page.tsx` :: `AnnouncementsPage` | Real filterable list — **but zero inbound references anywhere in `src`**: no nav item, no `activePrefix`, no link. Only "use client" route in the app. |

### 3.10 Support (module `support`) — Mandatory

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-070 | `/support` | ✅ | `src/app/support/page.tsx` :: `SupportPage` | Ticket list + create form (localStorage) + mocked live chat ("canned replies"). |
| TR-071 | `/ticket-detail` | ✅ | `src/app/ticket-detail/page.tsx` :: `TicketDetailPage` | Thread, reply composer, close/reopen. |
| TR-072 | `/help-center` | ✅ | `src/app/help-center/page.tsx` :: `HelpCenterPage` | Search + category filter + expandable KB articles. |
| TR-073 | `/learning-center` | ✅ | `src/app/learning-center/page.tsx` :: `LearningCenterPage` | Articles/tutorials; progress in localStorage (documented demo). |
| TR-074 | `/risk-consultation` | ✅ | `src/app/risk-consultation/page.tsx` :: `RiskConsultationPage` | Own breach/win-rate metrics + booking form. |
| TR-075 | `/terms` | ✅ | `src/app/terms/page.tsx` :: `TermsPage` | Section navigation + document content. |

### 3.11 Community (module `community`) — Auxiliary

| ID | View / route | Status | Source | Description / journey |
|---|---|---|---|---|
| TR-076 | `/leaderboard` | ✅ | `src/app/leaderboard/page.tsx` :: `LeaderboardPage` | Segment filters, podium, ranks recomputed from filter. |
| TR-077 | `/competitions` | ✅ | `src/app/competitions/page.tsx` :: `CompetitionsPage` | Join/leave local state with "(Demo)" toasts. |
| TR-078 | `/referrals` | ⚠️ | `src/app/referrals/page.tsx` :: `ReferralDashboardPage` | Stats + history work, but the **secondary "Share" button (line 60) has no `onClick`** (Copy link works). |

### 3.12 Trader structural findings

| ID | Finding | Evidence |
|---|---|---|
| TR-079 | **Dead nav config**: `traderNavigation` / `traderModule` are exported but never imported (only `TraderView` is used) — the intended "My Workspace / My Open Positions / My Closed Positions" nav never renders, which is why `/trader-detail` and `/closed-positions` are orphans. | `src/lib/platform/view-router.tsx:95,163`; zero imports outside that file |
| TR-080 | **4 orphan routes** with no nav entry and no inbound link: `/announcements`, `/payouts`, `/closed-positions`, `/trader-detail`. 10 further routes have neither sidebar href nor `activePrefix` (`/`, `/account-locked`, `/account-verification-2`, `/forgot-password`, `/login`, `/recovery-codes`, plus the 4 above) but most are flow-reachable. | grep across `src` for each path |
| TR-081 | **Dead view-map entry**: `viewMap["trading-positions"]` → `PositionsPage` is unreachable; `/trading-positions` renders `OpenPositionsPage` directly. | `src/modules/trading/pages/positions-page.tsx` imported only by `view-router.tsx` |
| TR-082 | **No data layer**: 0 `fetch`/`axios`/`useQuery` hits in `src`; all 78 views are `"use client"` rendering fixtures (`terra-fixtures.ts`, `trader-fixtures.ts`), in-memory contexts, or localStorage. Acceptable for a demo build, but every "✅ Present" is UI-complete only. | grep result = 0 |
| TR-083 | **Loading/error coverage is uneven**: `loading.tsx` exists for only 8 of 78 routes (+ app root); most routes render a `Suspense` fallback but have no route-level `loading.tsx`/`error.tsx`. | `find src/app -name loading.tsx` |
| TR-084 | **IA check vs §6/§7**: sidebar = 4 direct + 9 sections, 48 targets, 0 broken — compact and human-oriented ("Trading / Tools / Challenges / Payouts / Finance / Account Lifecycle / Community / Support / Account"), no backend-architecture labels. This is the healthiest IA of the three apps. | `src/components/shell/sidebar.tsx` |

---

## 4. apps/prop-admin — findings (PA)

Nav source of truth: `src/lib/platform/module-bootstrap.ts` (`bootstrapModules()`, called from `src/components/platform/providers.tsx`) → `moduleRegistry` → `resolveNavigation()` rendered by `src/components/shell/sidebar.tsx`. Registration order: `settings, trading, challenges, risk, payouts, analytics, affiliates, accounting, marketing, crm, kyc, support, ai, self-service, audit`, then `stitch` **only if** `SHOW_STITCH` (`src/lib/platform/feature-flags.ts:19`, `NEXT_PUBLIC_SHOW_STITCH === "1"`, default off).

Registered nav hrefs (excluding stitch): **182** — all resolve to a view key (0 dead links), of which **46 render raw stitch reference pages** (see PA-022), and **1** has no route guard (PA-025).

### 4.1 Registered modules

| ID | Module (class) | Manifest source | Status | Views (sample of the inventory) | Notes / journey |
|---|---|---|---|---|---|
| PA-001 | `trading` (**M**, core) | `src/modules/trading/manifest.ts` :: `tradingModule` | ⚠️ (strong) | 25 views, all module-owned pages: `trading-stitch-pages.tsx` (overview/traders/accounts/positions), `trading-stitch-pages-2.tsx` (add-account, closed-positions, credentials, bridge-sync, server-catalog, bulk-ops), `trader-detail-stitch-page.tsx`, `account-workspace-stitch-page.tsx`, plus `pages/*-page.tsx` (orders, order-detail, evaluation-queue/detail, account-*) | First-class despite the "stitch" filename: wired to `getTenant*` + permissions + toasts. Thin: `account-provisioning-page.tsx` (59 L, disabled "available soon" button), `orders-page.tsx` (129 L), `evaluation-detail-page.tsx` (read-only). Journey: Operate → Traders → trader detail → account workspace. |
| PA-002 | `challenges` (**M**, core) | `src/modules/challenges/manifest.ts` :: `challengesModule` | ⚠️ | 20 views: 15 module-owned conversions in `pages/challenges-stitch-pages.tsx` (wired to mock-data, 83 `onClick`), `competitions-page`, `leaderboard-management-page`, `checkout-page`, `purchase-completed-page` (69 L), `challenge-marketplace-page` (113 L, thin), `competitive-analysis-page` (87 L, 🚧 hardcoded `competitorCards`) | 5 views (`challenge-marketplace-preview`, `challenge-comparison`, `challenge-analytics`, `phase-migration-tool`, `bulk-phase-editor`) are declared **only** in the stitch manifest → no registered route when the flag is off (PA-027). |
| PA-003 | `risk` (**M**, core) | `src/modules/risk/manifest.ts` :: `riskModule` | ✅ (strongest) | 21 first-class views: `risk-pages.tsx` (overview/breaches, store-wired `resolveBreach`), `risk-cases-page`, `trader-risk-scoring-page`, `risk-statistics-page`, `trading-events-page`, + 14 analytics pages (`copy-trading-*`, `weekend-trades`, `account-ip-addresses`, `risk-*`) | Only 3 nav items are stitch renders: `risk-rules-editor`, `risk-alert-subscription`, `vpn-proxy-detection-dashboard`. Journey: Monitor → Risk → breaches → resolve. |
| PA-004 | `payouts` (**M**, core) | `src/modules/payouts/manifest.ts` :: `payoutsModule` | ⚠️ | `payout-pages.tsx` (overview/pending/history, store-wired `applyPayoutDecision` + nav badge), `enhanced-withdrawals-page.tsx` (1095 L), `payout-request-page` (136 L), `payout-request-form-page` (142 L), `payout-provider-status-page.tsx` (106 L, 🚧 hardcoded `providers`, 0 handlers) | 6 of 8 nav hrefs are stitch renders (`payout-detail`, `payouts-bulk-approval`, `payout-schedule`, `payout-methods-config`, `payout-compliance`, `payout-reversal`); the manifest comment itself admits `payout-detail` "is still a stitch reference render". Journey: Operate → Payouts → pending → approve (store-wired). |
| PA-005 | `analytics` (**M**, growth/optional) | `src/modules/analytics/manifest.ts` :: `analyticsModule` | ⚠️ | 14 first-class views: `analytics-pages.tsx` (overview/traders/performance/risk/advanced, 1549 L), `reports-page`, `firm-statistics-page`, `daily-highlights-page`, `retention-analytics-page`, `dashboard-tabs.tsx` (4 tabs), `performance-analytics-page.tsx` (95 L, hardcoded win-rate) | 6 nav children are stitch renders (`scheduled-exports`, `saved-reports`, `dashboard-template-library`, `cohort-builder`, `custom-segmentation`, `cookie-attribution`). Manifest marks it growth/optional although §5 makes business performance core (see §2.3). |
| PA-006 | `affiliates` (**A**, growth) | `src/modules/affiliates/manifest.ts` :: `affiliatesModule` | ✅ | 13 first-class views across 9 files (`affiliate-pages.tsx` ×5, `offer-*` ×4, `affiliate-coupons/link-*` ×3) | Cleanest module: every nav item backed by a real page. Only `affiliate-coupon-detail` / `affiliate-link-detail` lack nav+route (by design, drill-downs). |
| PA-007 | `accounting` (**M**, advanced) | `src/modules/accounting/manifest.ts` :: `accountingModule` | ⚠️ | 6 real views (`accounting-pages.tsx` overview/transactions/reconciliation, `accounting-invoices-page` 821 L, `accounting-invoice-detail-page`, `accounting-pl-page` 525 L) | **15 of 20 nav items render raw stitch pages** (Payments & Billing + Financial Reports groups). Reconcile action is toast-only. Journey: Finance → Accounting → invoices → invoice detail. |
| PA-008 | `marketing` (**A**, growth) | `src/modules/marketing/manifest.ts` :: `marketingModule` | ⚠️ | 8 first-class views (`marketing-pages.tsx`, `marketing-dashboard-page` 497 L, `marketing-email-campaigns` 997 L, `marketing-ad-spend` 1088 L, `marketing-vip-campaigns` 628 L) + 3 stitch | `marketing-dashboard` nav item exists but is **missing from the manifest `routes[]`** → no permission/module guard (PA-025). |
| PA-009 | `crm` (**A**, growth) | `src/modules/crm/manifest.ts` :: `crmModule` | ⚠️ | 4 first-class views (`crm-pages.tsx` overview/contacts/pipeline — store mutations `updateCrmContact`/`deleteCrmContact`; `crm-live-rules-page` 437 L) | 3 nav items are stitch renders (`crm-lead-scoring`, `crm-activity-log`, `crm-contact-create`). |
| PA-010 | `kyc` (**M**, compliance) | `src/modules/kyc/manifest.ts` :: `kycModule` | ⚠️ | 7 views: `kyc-pages.tsx` (overview/reviews/risk, store-wired `applyKycDecision`), `kyc-document-requests-page` (121 L), `kyc-rejected-queue-page` (169 L), `kyc-onboarding-page` (107 L), `kyc-status-page` (59 L, 🚧 fully hardcoded checklist) | §5 makes KYC mandatory but manifest says `optional: true`. 3 views have routes but no nav in this manifest; 3 nav items are stitch renders. |
| PA-011 | `support` (**M**, core/optional) | `src/modules/support/manifest.ts` :: `supportModule` | ⚠️ | 4 first-class views (`support-pages.tsx` overview/tickets/knowledge — store-wired resolve/escalate/reply; `support-sla-page` 992 L) | 4 nav items are stitch renders (`support-csat`, `support-canned-responses`, `support-knowledge-editor`, `support-contact`). Dead file: `pages/support-tickets-page.tsx` (153 L) is imported nowhere. |
| PA-012 | `ai` (**A**, ai) | `src/modules/ai/manifest.ts` :: `aiModule` | ⚠️ | 7 first-class views (`ai-pages.tsx` overview/insights/assistant/configure, `ai-predictive-page` 860 L, `ai-anomaly-page` 891 L, `ai-cost-page` 699 L) | All 5 Training+Governance nav entries are stitch renders. |
| PA-013 | `audit` (**M**, compliance) | `src/modules/audit/audit-module.ts` :: `auditModule` | ⚠️ | 6 first-class views (`audit-page.tsx` KPI + log table + CSV export, `user-events-page`, `user-event-detail-page`, `change-history-page`, `change-history-detail-page`, `enhanced-user-events-page` 982 L) | 5 nav items are stitch renders (`audit-siem`, `audit-compliance-report`, `audit-retention`, `audit-severity-policy`, `user-audit-timeline`). Journey: System → Audit → user event → detail. |
| PA-014 | `settings` (**M**, core) | `src/modules/settings/settings-module.ts` :: `settingsModule` | ⚠️ | 24 first-class views (`settings-page.tsx` 1168 L tabbed + 23 `pages/*-page.tsx` covering users, groups, tokens, certificates, email templates, webhooks, system-health, KYC providers, banners, announcements…) | 2 nav items are stitch renders (`team-members`, `roles-management`). `terms-policies-page.tsx` (45 L) is 🚧 hardcoded. Manifest header claims "all 20 children point to live views" — true for view binding, false for quality. |
| PA-015 | `self-service` (**M**, core) | `src/modules/self-service/manifest.ts` :: `selfServiceModule` | ➖ | **0 views** — nav-only aggregator (7 items: My Active/Passed/Failed/Breaches/Withdrawals/Performance/Tickets) that re-point to origin modules' views | Intentional per header comment (§7 progressive disclosure: separating trader-facing "my…" views from operator sections). All 7 hrefs resolve; the directory itself contains only `manifest.ts`. |
| PA-016 | `stitch` (**A**, flag-gated) | `src/modules/stitch/manifest.ts` :: `stitchModule` | 🚧 | 199 files in `src/modules/stitch/pages/`, 91 wired into the view-router, 319 route entries / 228 unique paths, 136 flat nav hrefs | Machine-generated by `tools/stitch2tsx.py` ("do not hand-edit"), static markup + local state, no data layer. Registered only when `SHOW_STITCH` (default off). |

### 4.2 Non-module directories (registered nowhere)

| ID | Dir / view | Class | Status | Source | Notes |
|---|---|---|---|---|---|
| PA-017 | `overview` → view `overview` | **M** | ✅ | `src/modules/overview/overview-page.tsx` :: `OverviewPage` (536 L) | **The default landing view** (`platform-context.tsx:196` fallback `{view:"overview"}`) yet not a module: no sidebar entry from any registered module, no route definition, no permission guard. Reached via breadcrumb/topbar/command menu. |
| PA-018 | `notifications` → view `notifications` | **M** | ✅ | `src/modules/notifications/notifications-page.tsx` :: re-exports `NotificationCenterPage` (289 L) | Topbar bell + command menu only; unguarded, no module. |
| PA-019 | `profile` → view `profile` | **M** | ✅ | `src/modules/profile/profile-page.tsx` :: `ProfilePage` (363 L) | Topbar dropdown/command menu only; unguarded. (`forgot-password-page.tsx` / `verify-email-page.tsx` are app-route pages, not views.) |
| PA-020 | `help` → view `help` | **A** | 🚧 | `src/modules/help/help-page.tsx` :: `HelpPage` (60 L) | Static "principles" cards + module badge list; no actions, no state. Topbar help-dropdown only. |
| PA-021 | `pendings` → view `pending-tasks` | **M** | ✅ (🔌) | `src/modules/pendings/pages/pending-tasks-page.tsx` :: `PendingTasksPage` (441 L, computed summary cards) | **No entry point anywhere**: no sidebar item, no `navigate("pending-tasks")` call, not in the command menu — deep-link `?view=pending-tasks` only. Its nav href exists only in the flag-gated stitch manifest. |

### 4.3 Prop-admin structural findings

| ID | Finding | Evidence |
|---|---|---|
| PA-022 | **46 of 182 registered nav hrefs render raw stitch reference pages** — accounting 15, analytics 6, payouts 5, ai 5, audit 5, support 4, risk 3, marketing 3, crm 3, kyc 3, settings 2. Operators see demo renders inside mandatory modules (Payments & Billing, Financial Reports, Rules & Alerts, Helpdesk, Governance are the worst hit). | `src/modules/stitch/pages/*` bound in `src/lib/platform/view-router.tsx` |
| PA-023 | **Stitch gating is a hand-maintained deny-list**: 91 stitch views are wired; only 35 are in `STITCH_ONLY_VIEWS` (`view-router.tsx`), so **56 stitch views resolve even with `SHOW_STITCH` off** — including all nav-declared ones. The list's own comment warns it must be edited by hand. | `src/lib/platform/view-router.tsx:374-414` |
| PA-024 | **~110 of 199 stitch page files are never imported** — dead duplicates of product view ids (e.g. `stitch/pages/risk.tsx`, `payouts.tsx`, `kyc.tsx`). | import graph over `src/modules/stitch/pages/` |
| PA-025 | **`marketing-dashboard` has a nav item and a view key but no `RouteDefinition`** → renders without module/permission guard. The only registered nav href without a route. | `src/modules/marketing/manifest.ts:42-52` (routes array has no `marketing-dashboard`) vs `view-router.tsx:185` |
| PA-026 | **5 views are not modules**: `overview` (the default landing view!), `notifications`, `profile`, `help`, `pending-tasks` — no nav, no route, no permission guard; `pending-tasks` additionally has no inbound link at all. | `module-bootstrap.ts` registration list vs `view-router.tsx` |
| PA-027 | **Manifest vs reality**: `self-service` is a nav-only stub (by design); 5 challenge views exist only in the flag-gated stitch manifest; `kyc` declares 3 routes with no nav in its own manifest; `settings`' "all live views" claim ignores 2 stitch renders. | per-manifest comparison in §4.1 |
| PA-028 | **Thin/dead screens inside mandatory modules**: `settings/pages/terms-policies-page.tsx` (45 L, hardcoded, 0 handlers), `kyc/pages/kyc-status-page.tsx` (59 L hardcoded), `payouts/pages/payout-provider-status-page.tsx` (106 L hardcoded, 0 handlers), `trading/pages/account-provisioning-page.tsx` (disabled "available soon"), `analytics/pages/performance-analytics-page.tsx` (hardcoded statistics), `challenges/pages/competitive-analysis-page.tsx` (87 L, "(demo)" toast), dead file `support/pages/support-tickets-page.tsx`. | line counts + handler greps |
| PA-029 | **No data layer**: 0 `fetch`/`axios`/`useQuery` in `src`; pages read `src/lib/platform/mock-data.ts` or module-local stores (`payout-store`, `kyc-store`, `crm-store`, `support-store`, `breach-store`, `evaluation-store`, …). Mutations are session-scoped and many actions are `toast()`-only. | grep result = 0 |
| PA-030 | **IA check vs §6/§7**: 15 sidebar sections in §6 order (Trading → Challenges → Risk → Payouts → Analytics → Affiliates → Accounting → Marketing → CRM → KYC → Support → AI → Audit → Self-Service → Settings), 0 broken links, depth held in `group` headers + `?tab=` links — compliant, but 46 demo-render items inflate the sidebar's apparent breadth (§7 "sidebar is a map, not an index"). | `sidebar.tsx` + `module-registry.ts:130` |

---

## 5. apps/platform-admin — findings (PL)

Two distinct surfaces:

- **A. Module catalog** (`src/lib/platform/module-catalog.ts`) — 15 manifest-only stubs mirroring prop-admin's registry for entitlement management (create-tenant wizard, tenant-detail adoption, Service Catalog, adoption metrics). Per its own header: *"Deliberately NO navigation / routes / widgets / settings — those belong to the prop-admin runtime."* Filtered out of this console's nav by `supportedApplications: ["prop-admin"]` (`module-registry.ts`).
- **B. Super Admin console** — `src/modules/super-admin/super-admin-module.ts`: one `Platform` section, 13 groups, **60 nav items / 72 declared routes**, backed by 77 page components.

### 5.1 Catalog entries (PL-001…PL-015) — data surfaces, status of the mirror itself

| ID | Entry (line) | Category / optional | Class* | Status | Notes |
|---|---|---|---|---|---|
| PL-001 | `settings` (:68) | core / — | M | ✅ | Mirror accurate |
| PL-002 | `trading` (:77) | core / — | M | ✅ | + 5 widget metadata entries (no components — by design) |
| PL-003 | `challenges` (:92) | core / — | M | ✅ | |
| PL-004 | `risk` (:105) | core / — | M | ✅ | |
| PL-005 | `payouts` (:119) | core / — | M | ✅ | |
| PL-006 | `support` (:133) | core / **true** | M | ✅ | optional flag mirrors prop-admin |
| PL-007 | `stitch` (:148) | core / **true** | A | ✅ | flag-gated in prop-admin; still sold in catalog |
| PL-008 | `analytics` (:164) | growth / **true** | M | ✅ | §5-vs-manifest tension mirrored (§2.3) |
| PL-009 | `affiliates` (:182) | growth / **true** | A | ✅ | |
| PL-010 | `marketing` (:197) | growth / **true** | A | ✅ | |
| PL-011 | `crm` (:212) | growth / **true** | A | ✅ | |
| PL-012 | `accounting` (:227) | advanced / **true** | M | ✅ | |
| PL-013 | `kyc` (:242) | compliance / **true** | M | ✅ | |
| PL-014 | `audit` (:256) | compliance / **true** | M | ✅ | |
| PL-015 | `ai` (:268) | ai / **true** | A | ✅ | |

\* Class inherited from the prop-admin classification (§2.3), since these entries exist to manage that module set.

### 5.2 Console nav groups (classified per §5 Super Admin)

| ID | Group (items) | Class | Contents |
|---|---|---|---|
| PL-016 | Tenant Management (6) | **M** | `super-overview`, `tenants`, `create-tenant`, `tenant-lifecycle`, `tenant-health`, `sla-monitoring` |
| PL-017 | Operations (6) | **M** | `platform-operations`, `emergency-controls`, `incident-center`, `jobs-dashboard`, `approval-center`, `support-assist` |
| PL-018 | Observability (7) | **M** | `platform-health`, `system-health`, `provider-registry`, `cross-tenant-queues`, `platform-audit`, `usage-metering`, `tenant-api-usage` |
| PL-019 | Infrastructure (3) | **M** | `deployments`, `backups-dr`, `backup-policies` |
| PL-020 | Platform Config (9) | **M** | `module-catalog`, `dashboard-manager`, `feature-flags`, `global-defaults`, `reference-data`, `risk-engine`, `announcements`, `notifications`, `notification-templates` |
| PL-021 | Security (5) | **M** | `security-overview`, `my-sessions`, `tenant-sessions`, `tenant-view-as`, `abuse-signals` |
| PL-022 | Finance (7) | **M** | `plans`, `plan-transition`, `platform-billing`❌, `platform-financials`, `platform-transactions`, `tax-currency`, `churn-prevention` |
| PL-023 | Governance (2) | **M** | `platform-roles`, `platform-staff` |
| PL-024 | Developer (3) | **A** | `api-keys`, `rate-limits`, `api-analytics` |
| PL-025 | Integrations (3) | **M** | `webhooks`, `integrations`, `compliance-reports` (§5 "integrations") |
| PL-026 | Analytics (3) | **A** | `platform-analytics`, `tenant-benchmarking`, `scheduled-reports` (usage is covered by Observability) |
| PL-027 | Content & Marketing (2) | **A** | `content-management`, `marketing` |
| PL-028 | Platform Docs (4) | **A** | `knowledge-base`, `changelog`, `platform-architecture`, `getting-started` |

### 5.3 View-level findings (77 page components)

Tally: **43 ✅ · 33 ⚠️ · 1 🚧 · 0 ➖** (72 bound to view keys + 4 unbound + 1 auth page).

#### ❌ Broken

| ID | View | Source | Notes |
|---|---|---|---|
| PL-029 | `platform-billing` | nav + route declared at `src/modules/super-admin/super-admin-module.ts:127` and `:204`; page `src/modules/super-admin/platform-billing-page.tsx` :: `PlatformBillingPage` | **No view key exists** → `dashboard-router.tsx` renders *"View \"platform-billing\" not found"*. The page is barrel-exported (`super-admin-pages.tsx:44`) but never wired. Journey: Finance → Billing & Invoices → error screen. The only broken nav item in any of the three apps. |

#### 🔌 Unbound pages (real UI, reachable from nowhere)

| ID | View | Source | Status | Notes |
|---|---|---|---|---|
| PL-030 | `role-editor` | `src/modules/super-admin/role-editor-page.tsx` :: `RoleEditorPage` | ✅ | Fully built editor (7 handlers, toasts) — **zero imports anywhere in `src`**. Platform roles flow navigates to `role-management` instead. |
| PL-031 | `feature-flags-editor` | `src/modules/super-admin/feature-flags-editor-page.tsx` :: `FeatureFlagEditorPage` | ✅ | Functional targeting/kill-switch editor — never imported. |
| PL-032 | `operator-detail` | `src/modules/super-admin/operator-detail-page.tsx` :: `OperatorDetailPage` | ⚠️ | Never imported; invite action only toasts without adding an operator. |
| PL-033 | `platform-billing` (page) | see PL-029 | ⚠️ | Both actions are "(demo)" toasts; unreachable due to missing view key. |
| — | root cause | `src/lib/platform/view-router.tsx` :: `registerModuleView` | — | The runtime view-registration hook exists but has **no callers**, so none of the above can self-register either. |

#### 🚧 Demo

| ID | View | Source | Notes |
|---|---|---|---|
| PL-034 | `platform-health` | `src/modules/super-admin/super-admin-pages.tsx` :: `PlatformHealthPage` (inline, ~:376) | Hardcoded 6-service status array + static KPI values (uptime 99.97%, latency 142 ms…), zero actions. This is the §5 "Platform Health / Service Health" surface for the Super Admin — the highest-profile demo screen in the console. |

#### ⚠️ Partial views (33) — grouped by failure mode

| Failure mode | Views (view key :: file) |
|---|---|
| **Toast-only primary actions** (button claims an action, only fires `toast()`, state never changes) | `api-keys` (Create/Rotate/Revoke — verified: `api-keys-page.tsx:116,265,274`), `webhooks` (Test/Pause/Resume/Retry/Add), `jobs-dashboard` (Run/Pause/Retry/Resume), `scheduled-reports` (Run Now/Pause/Download/New Schedule), `tax-currency` (rate save/enable/edit/add), `churn-prevention` (Report/Rule/Outreach/Offer), `content-management` (6 actions), `marketing` (all actions), `notification-templates` (Save/Test/Duplicate), `rate-limits` (Save discards inline edits), `module-settings` (Save never persists; "Pending changes" hardcoded), `module-detail` (override save toasts "mock — backend pending" and discards), `operator-detail`, `platform-billing` |
| **Dead buttons** (no `onClick` at all) | `api-analytics` (2), `backup-policies` (Save discards `editValues`; New Policy/trigger toast-only), `backups-dr` (2), `bridge-sync-log` (1), `getting-started` (3), `impersonation-audit` (1), `operator-directory` (3), `platform-architecture` (2), `platform-overview` (3 + hardcoded demo incident banner), `platform-staff` (row menu dead; Invite toast-only), `platform-transactions` (Export/Refresh dead; row detail uses `alert()`), `reference-data` (2), `system-health` (Live Monitor/View Details dead; 3 actions use `alert()`), `ai-usage-quota` (Reset Counters dead; override Apply toast-only) |
| **State that doesn't stick** | `plans` (CRUD is session-scoped by its own header comment; migration confirm toasts but never changes `tenant.plan`), `platform-roles` (Duplicate toast claims a list change that never happens) |
| **Read-only / hollow** | `role-management` (80 L, **0 `<Button>` elements** despite title "Manage platform roles, permissions, and scope assignments" — verified), `platform-financials` (hardcoded "12 invoices / $14,700"; View/Configure toast-only), `integrations` (connect/disconnect toast-only; "marketplace coming soon") |

#### ✅ Present highlights (43) — the parts that work

`super-overview`, `tenants`, `create-tenant` (5-step wizard, registers tenant + starts provisioning saga), `tenant-detail` (SensitiveActionDialog suspend/reactivate/terminate with 2FA + second operator, config save persists, CSV export), `tenant-lifecycle`, `tenant-health`, `sla-monitoring`, `provisioning-saga` (retry/compensate wired), `emergency-controls` (store-wired, 2FA, two-operator — verified), `incident-center`, `approval-center`, `cross-tenant-queues`, `platform-audit` (live store merge + CSV export), `audit-log`, `model-audit-log`, `usage-metering`, `tenant-api-usage`, `tenant-benchmarking`, `platform-analytics`, `risk-engine` (validated dirty apply/discard), `global-defaults` (dirty save/discard + audit record), `feature-flags`, `dashboard-manager` (GridStack editor persists to localStorage), `provider-registry`, `security-overview`, `my-sessions`, `tenant-sessions`, `tenant-view-as` (impersonation with 2FA + countdown), `abuse-signals`, `announcements`, `notifications`, `knowledge-base`, `compliance-reports`, `changelog`, `support-assist`, `plan-transition` (proration math + usage gate + ack-gated confirm), `module-catalog`, `challenge-programs`, `reference-data` badge/acting-tenant work (post-base fixes `a93de6f`…`832a035` improved several of these).

#### Nav-less views (13) — reachable but undiscoverable

`tenant-detail` (20 inbound links — fine), `audit-log`, `model-audit-log`, `role-management`, `operator-directory`, `provisioning-saga`, `module-detail`, `module-settings`, `platform-overview`, `bridge-sync-log`, `impersonation-audit`, `ai-usage-quota`, and **`challenge-programs` — reachable only from global search, zero `navigate()` callers**.

### 5.4 Platform-admin structural findings

| ID | Finding | Evidence |
|---|---|---|
| PL-035 | **Broken nav item** `platform-billing` (PL-029) — the console's only "View not found" path; page exists as dead code. | `super-admin-module.ts:127,204` vs `view-router.tsx` (no key) |
| PL-036 | **4 finished-but-unreachable pages** + a `registerModuleView` hook with no callers (PL-030…PL-033). | import graph = 0 hits |
| PL-037 | **Catalog/registry drift risk**: `module-catalog.ts` must be updated by hand whenever prop-admin adds/renames a module (stated in its header); no test or build check enforces lockstep. Currently in sync (15/15). | header comment + comparison with `module-bootstrap.ts` |
| PL-038 | **Widget metadata without components**: catalog entries carry `widgets[]` with `component?: never`, so `dashboard-manager` renders "widget preview requires prop-admin bundle" placeholders for every tenant widget. | `module-catalog.ts` `CatalogEntry.widgets` |
| PL-039 | **13 nav-less views**, one of which (`challenge-programs`) has no programmatic entry point at all; three are intentionally folded (`audit-log`, `operator-directory`, `role-management` per comments at `super-admin-module.ts:94-95,117-120`). | `navigate()` grep |
| PL-040 | **Demo surface on the #1 Super Admin mental-model item**: `platform-health` is hardcoded (PL-034), while §5 requires "Platform Health / Service Health / System Alerts" as the console's headline. | `super-admin-pages.tsx` inline page |
| PL-041 | **IA check vs §6/§7**: single `Platform` section with 13 groups/60 items is flat enough (no >2-level nesting) but sits **above §7's "compact sidebar" guidance** — 60 items vs the trader app's 48 across a much smaller product surface; 4 groups are auxiliary (Developer/Analytics/Content/Docs) and could be progressive-disclosure candidates. | `super-admin-module.ts:62-161` |
| PL-042 | **No data layer** (same as TR-082/PA-029): 0 `fetch`/`axios`/`useQuery`; state lives in `console-store` / component state / localStorage. Actions labelled "(demo)" are honest; the 14 toast-only Partial views are not. | grep result = 0 |

---

## 6. Cross-cutting conclusions

1. **Nothing is missing at the route level.** Every mandatory module identified in §2 has a nav entry and a view in all three apps (trader: 48/48 nav targets resolve; prop-admin: 182/182 registered hrefs resolve; platform-admin: 59/60 — the single exception is `platform-billing`, PL-029).
2. **The dominant defect class is "UI without wiring"**, not missing UI: 6 ⚠️ trader routes, 33 ⚠️ platform-admin views, and 46 stitch-render nav items in prop-admin. Roughly **80 surfaces** across the three apps show actions that cannot succeed (dead buttons or toast-only mutations).
3. **Orphaned real UI**: 4 trader routes (TR-080), 1 prop-admin view (PA-021), 4 platform-admin pages (PL-030…PL-033) exist but are unreachable — including a fully-built role editor and a functioning billing page.
4. **Demo content sits on mandatory paths**: `platform-health` (PL-034, Super Admin's headline), `account-provisioning`/`evaluation-passed` (TR-053/054), `kyc-status`/`terms-policies`/`payout-provider-status` (PA-028), and 46 stitch renders inside mandatory prop-admin modules (PA-022).
5. **Classification tensions to resolve with product**: manifest `optional: true` on `kyc`, `support`, `analytics` contradicts §5/§6 (§2.3); `self-service` is core-but-nav-only (PA-015); the default landing view is not a module (PA-017).
6. **§7 (do not over-group) is satisfied by the trader app, strained by the console**: prop-admin's 15 sections and platform-admin's 13 groups/60 items push the "sidebar is a map, not an index" rule; prop-admin's 46 demo-render items are the clearest violation because they advertise depth that does not exist.

## 7. Recommendations (for a future, separately-authorized task — not done here)

| Priority | Action | Findings addressed |
|---|---|---|
| P0 | Wire `platform-billing` view key (or remove the nav item); delete or wire the 4 unbound pages; call or remove `registerModuleView` | PL-029, PL-030…PL-033, PL-036 |
| P0 | Give `platform-health` real data or clearly mark it as demo; it is the Super Admin's primary §5 surface | PL-034, PL-040 |
| P1 | Triage the 33 toast-only/dead-button console views into "wire it" vs "hide it"; never show a primary action that only toasts | §5.3 |
| P1 | Add the missing `marketing-dashboard` RouteDefinition; add nav/routes for `pending-tasks`, or drop it | PA-025, PA-021 |
| P1 | Resolve the 4 trader orphans: import `traderNavigation` or delete it; link `/announcements`, `/payouts`, `/closed-positions`, `/trader-detail` | TR-079, TR-080 |
| P2 | Replace or gate the 46 stitch renders inside mandatory prop-admin modules; convert the deny-list (`STITCH_ONLY_VIEWS`) into an allow-list | PA-022, PA-023 |
| P2 | Fix the 6 trader dead buttons (Delete account, 2× Download PDF, 2× Upload, Launch/Download, Share) | TR-015, TR-046, TR-048, TR-052, TR-062, TR-078 |
| P2 | Reconcile manifest `optional` flags with §5 classification for `kyc`/`support`/`analytics`; add a lockstep check for `module-catalog.ts` | §2.3, PL-037 |
| P3 | Delete dead code: `support-tickets-page.tsx`, ~110 unreferenced stitch pages, `positions-page.tsx`, `traderNavigation` | TR-081, PA-024, PA-028 |
| P3 | Uniform route-level `loading.tsx`/`error.tsx` for trader | TR-083 |

## 8. Verification appendix

Re-checked directly against the working tree during this audit:

- `docs/AGENTS.md` §5 (lines 249-371), §6 (375-434), §7 (438-460) — read in full.
- Trader: 78 `page.tsx` files; `sidebar.tsx` `directItems` (:111) = 4, `sections` (:118) = 44, 0 broken links; `web-terminal-page.tsx` Launch :59 / Coming soon :62 / Download :80 with no handlers; `account-settings-page.tsx` Delete button has no `onClick`; `traderNavigation` has 0 imports outside `view-router.tsx`; `/payouts/page.tsx` imports `PayoutHistoryPage`; 0 network calls in `src`.
- Prop-admin: `module-bootstrap.ts` registration order and `SHOW_STITCH` gate; `feature-flags.ts:19`; `marketing/manifest.ts` routes array lacks `marketing-dashboard` (view key exists at `view-router.tsx:185`); `self-service/manifest.ts` header ("Only navigation moves"); `platform-context.tsx:196` default view `overview`; `pending-tasks` referenced only by stitch files; line counts for `terms-policies-page.tsx` (45), `help-page.tsx` (60), `kyc-status-page.tsx` (59); 199 stitch pages, 35 `STITCH_ONLY_VIEWS` entries, 318 manifest hrefs (182 registered + 136 stitch).
- Platform-admin: `super-admin-module.ts:127` (nav) and `:204` (route) for `platform-billing` with no matching view key; `super-admin-pages.tsx:44` barrel export; `api-keys-page.tsx:116/265/274` toast-only Create/Rotate/Revoke; `role-management-page.tsx` = 80 lines, 0 `<Button>`; `emergency-controls-page.tsx` store-wired handlers; `PlatformHealthPage` inline hardcoded services; 60 nav hrefs / 72 routes; 77 page components (43 ✅ / 33 ⚠️ / 1 🚧).

*End of audit. No source files were modified.*
