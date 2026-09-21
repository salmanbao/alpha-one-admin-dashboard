# PFaaS Platform — Flow Analysis: FUNDERBLU Admin Screenshots vs Current Implementation

## Summary

121 screenshots from the FUNDERBLU Admin platform were analyzed, covering **39 distinct flows**.
Of these, **21 flows are already implemented** (fully or partially) in the current PFaaS platform,
and **18 flows are missing** or need significant enhancement.

---

## ALREADY IMPLEMENTED ✅ (21 flows)

| # | Flow | Screenshot Range | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | **Dashboard/Overview** | 003-006, 019, 021, 081, 086 | ✅ Implemented | KPI summary row, module sections, live sidebar. Missing: pass/fail chart, retention cohort table, challenge performance grid |
| 2 | **Risk Analysis** | 007-018 | ✅ Implemented | Breaches table, risk distribution, breach trend chart, severity filters. Missing: challenge payout stats, country-wise, account-size reports |
| 3 | **Payout/Withdrawal Management** | 023, 024 | ✅ Implemented | Pending payouts with contextual approve/reject, payout history, payout queue widget. Missing: force approve, resend certificate |
| 4 | **Trader/Account Detail** | 024, 027, 092-103, 108 | ✅ Partial | Has tabs (Accounts, Positions, Performance, History) + Account Health. Missing: KYC tab, Risk Analysis tab, Change History tab, Block/Resync actions, payout schedule |
| 5 | **Challenges List** | 047 | ✅ Implemented | Active/Passed/Failed challenges with progress, phase, profit target |
| 6 | **Analytics** | 020 | ✅ Partial | Revenue, trader growth, risk distribution, breach trend, multi-currency. Missing: customer retention cohorts, 3/6/12-month retention rates, repeating customers by country |
| 7 | **Affiliates** | — | ✅ Implemented | Affiliate list, campaigns, commissions, top affiliates widget |
| 8 | **Accounting/Transactions** | — | ✅ Implemented | Transactions table, reconciliation, CSV export |
| 9 | **Marketing Campaigns** | — | ✅ Implemented | Campaign list, performance by channel, ROI |
| 10 | **CRM Contacts** | — | ✅ Implemented | Contact list, pipeline stages, stage-flow visualization |
| 11 | **KYC Reviews** | — | ✅ Implemented | KYC overview, reviews with approve/reject, risk distribution |
| 12 | **Support Tickets** | — | ✅ Implemented | Ticket list, priority distribution, knowledge base |
| 13 | **AI Insights** | — | ✅ Implemented | AI overview, insights cards, confidence chart, mock chat assistant |
| 14 | **Settings** | — | ✅ Implemented | Branding, terminology, modules, roles, integrations, notifications, quiet hours |
| 15 | **Audit Log** | 128-129 | ✅ Partial | Audit table with severity/module/actor/date filters, saved views. Missing: user event log (65K+ events with event types), per-entity change history |
| 16 | **Notification Center** | — | ✅ Implemented | Consolidated view, batch select, mark read, filter tabs |
| 17 | **Global Search** | — | ✅ Implemented | Searches 8 entity types, grouped results, `/` shortcut |
| 18 | **Command Menu** | — | ✅ Implemented | Navigation, quick actions, tenant/user switching, keyboard shortcuts |
| 19 | **Onboarding Wizard** | — | ✅ Implemented | 5-step setup: welcome, modules, branding, team, review |
| 20 | **Price Alerts** | — | ✅ Implemented | Create/list/delete alerts, toast on trigger, active count badge |
| 21 | **Live Data Simulation** | — | ✅ Implemented | Activity feed, equity curve, price feed, animated stats |

---

## MISSING FLOWS ❌ (18 flows)

### 1. Firm Statistics Dashboard (Screenshot 001)
**What it shows:** Comprehensive financial overview with:
- 10 KPI cards: Total Revenue, Total Payouts, Revenue from Converted Users, Challenges Sold, Tasks Completed, Copy Trading Events, Inverse Trading Events, News Trading Events, Unprofitable Countries, Competition Users Converted
- 4 trend charts (12-month): Revenue, Payouts, Net Revenue (Profit), Challenges Sold
- Summary table: Net Profit, Profit Margin, Average Challenge Value, Payout Ratio
- Date range filtering
**Gap:** Current dashboard is operational (attention center + KPIs) but lacks financial/revenue analytics at this depth.

### 2. Daily Highlights Dashboard (Screenshot 002)
**What it shows:** Daily performance with:
- 5 KPIs: Daily Revenue, Daily Payouts, Daily Net Revenue, Average Order Value, Latest Hour Revenue
- 6 hourly charts: Revenue Movement, Number of Orders, Payout Movement, Number of Payouts, Hourly Revenue by PSP, Hourly Orders by PSP
- 7 data tables: Top Countries, Top PSPs, Top Platforms, Top Coupon Redemptions, Purchases by Account Size, Top Challenges, Revenue by Order Type
- Recent Successful Orders table
- Date selection + PSP filtering
**Gap:** No daily-level operational analytics with hourly breakdowns.

### 3. Account Retention Cohort Table (Screenshot 003)
**What it shows:** Cohort-based churn analysis showing breach rates at 30d, 60d, 90d intervals for cohorts created in different months. Triangular cohort matrix.
**Gap:** Analytics has a simple cohort retention bar chart but no detailed cohort matrix table.

### 4. Challenge Performance Grid (Screenshot 003)
**What it shows:** Per-challenge-type breakdown (Instant Standard, 2-Step Turbo, 1-Step Gen Z) with step-by-step Passes, Fails, and Failure Rates.
**Gap:** Challenges page shows individual challenges but no aggregated performance grid by challenge type.

### 5. Customer Retention & Behavior Analytics (Screenshot 020)
**What it shows:** 3/6/12-month retention rates, challenges per user, account counts, repeating customers by country and engagement type, top countries table, summary insights.
**Gap:** Analytics module lacks retention/behavior analytics entirely.

### 6. Risk Analysis: Challenge Payout Statistics (Screenshot 007)
**What it shows:** Per-challenge revenue, total payouts, profit margin, payout count, funded accounts in a table. Tabs for: Account Size, Country-Wise, and other report types.
**Gap:** Risk module shows breaches but not challenge-level payout profitability analysis.

### 7. Offer/Promotion Management (Screenshots 028-032)
**What it shows:** Full CRUD for promotional offers with:
- Offer name, description, promotional image, coupon code
- Start/expiry dates
- Country targeting (dual-list box)
- User segment targeting (account status, purchase history, challenge participation)
- Matching users preview
- Change history per offer
**Gap:** No offer/promotion/coupon management system exists.

### 8. Challenge Type Management (Screenshots 037-038)
**What it shows:** Select/add challenge types: Instant Funded, 1-Step, 2-Step, 3-Step, Free Trial, Competition. Each with description of evaluation phases.
**Gap:** Challenges are hardcoded; no admin UI to create/manage challenge types.

### 9. Create Challenge Multi-Step Wizard (Screenshots 039-046)
**What it shows:** 7-step wizard for creating challenges:
- Step 1: Select challenge type (Instant Funded, 1-Step, 2-Step, 3-Step, Free Trial, Competition)
- Steps 2-6: Configure phases, trading rules, risk rules, payout rules
- Step 7: Review and create
- Progress stepper at top
- Smart defaults based on type selection
**Gap:** No challenge creation wizard exists. Onboarding wizard exists but not for challenge configuration.

### 10. Challenge Configuration Editor (Screenshots 047-052)
**What it shows:** Edit existing challenges with all parameters: phases, rules, payout splits, trading conditions, etc.
**Gap:** No challenge editor — challenges are read-only in the current platform.

### 11. Phase Management (Screenshots 053-058)
**What it shows:** Select/add/edit phases for challenges (Phase 1, Phase 2, Live Account) with detailed configuration per phase.
**Gap:** Phases are display-only; no admin UI to configure phase rules.

### 12. Email Template Management (Screenshots 060-062)
**What it shows:** Select/add email templates with subject, body, variables, trigger conditions.
**Gap:** No email template management. Notification preferences exist but not template editing.

### 13. Certificate Template Management (Screenshots 063-064)
**What it shows:** Select/edit certificate templates (e.g., "Challenge Passed" certificate) with layout, text, branding.
**Gap:** No certificate system exists.

### 14. Certificate Font Management (Screenshots 065-066)
**What it shows:** Select/add certificate fonts for certificate rendering.
**Gap:** No certificate font management.

### 15. Marketing Banner & Announcement Management (Screenshots 069-073)
**What it shows:** Select/add/edit marketing banners and announcement banners with active/inactive status, scheduling, content.
**Gap:** Marketing module has campaigns but no banner/announcement management.

### 16. Trading Event Detection (Screenshots 074-083)
**What it shows:** Management for detecting and configuring:
- News trading events (economic calendar)
- Copy trading events (detecting copy trading between accounts)
- Inverse trading events (detecting inverse/hedge trading)
- Weekend trade management
- Account IP address management
**Gap:** No trading event detection or configuration system.

### 17. Add Account Multi-Step Form (Screenshots 109-117)
**What it shows:** 9-step account creation form with:
- User email, full name
- Phase selection
- Profit split, payout frequency
- Initial balance, broker type (MT5)
- KYC statuses
- Account label
- Required fields marked with asterisks
**Gap:** No account creation form. Accounts are display-only.

### 18. User Event Log / Per-Entity Change History (Screenshots 030, 106, 128-129)
**What it shows:**
- User event log: 65K+ events with event types (ACCOUNT_CREATED, KYC_COMPLETED, ORDER_CREATED), search, filters, pagination
- Per-entity change history: before/after values for any object (offers, accounts, challenges)
- Object permissions: manage user and group permissions per object
**Gap:** Audit log exists but is generic. No per-entity change history with diff view, no user event log with typed events, no object-level permissions.

---

## PARTIALLY IMPLEMENTED — NEEDS ENHANCEMENT ⚠️ (5 flows)

| # | Flow | Current State | Missing |
|---|------|---------------|---------|
| 1 | **Trader/Account Detail** | Has tabs (Accounts, Positions, Performance, History) + Account Health | Missing: KYC Statuses tab, Risk Analysis tab, Change History tab, Block Account/Resync actions, Payout Schedule, Account Label, Profit Split editor |
| 2 | **Risk Analysis** | Breaches table, risk distribution, breach trend | Missing: Challenge Payout Statistics, Country-Wise reports, Account Size reports, Copy/Inverse/News trading event tabs |
| 3 | **Analytics** | Revenue, trader growth, risk distribution, multi-currency | Missing: Customer Retention cohorts, 3/6/12-month rates, repeating customers by country, behavior analytics |
| 4 | **Audit Log** | Generic audit table with filters + saved views | Missing: Per-entity change history with before/after diff, user event log with typed events (ACCOUNT_CREATED etc.), object permissions |
| 5 | **Settings** | Branding, terminology, modules, roles, integrations, notifications | Missing: Challenge type management, phase management, email template management, certificate management, utility management |

---

## PRIORITY RECOMMENDATIONS

### High Priority (Core Prop Firm Operations)
1. **Create Challenge Multi-Step Wizard** (039-046) — the core product workflow
2. **Add Account Multi-Step Form** (109-117) — creating trader accounts
3. **Firm Statistics Dashboard** (001) — revenue/payout/profit analytics
4. **Daily Highlights Dashboard** (002) — hourly operational analytics
5. **Challenge Configuration Editor** (047-052) — editing challenge rules
6. **Per-Entity Change History** (030, 106) — audit trail with before/after diff

### Medium Priority (Operational Configuration)
7. **Challenge Type Management** (037-038) — defining challenge types
8. **Phase Management** (053-058) — configuring phase rules
9. **Offer/Promotion Management** (028-032) — coupon campaigns
10. **Enhanced Trader Detail** (092-103) — full tabs with KYC, Risk, Block/Resync
11. **Risk Analysis: Challenge Payout Statistics** (007) — profitability per challenge
12. **User Event Log** (128-129) — typed event stream

### Lower Priority (Platform Configuration)
13. **Email Template Management** (060-062)
14. **Certificate Template/Font Management** (063-066)
15. **Marketing/Announcement Banner Management** (069-073)
16. **Trading Event Detection** (074-083) — copy/inverse/news trading
17. **Object Permissions** (107) — per-object user/group permissions
18. **Customer Retention & Behavior Analytics** (020)
