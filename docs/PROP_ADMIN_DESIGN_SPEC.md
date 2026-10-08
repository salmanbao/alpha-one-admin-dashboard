# Prop Firm Admin Dashboard — Complete Stitch Design Specification

> **Purpose**: This document contains the complete design specification for every screen in the prop-admin dashboard — both existing screens (to be redesigned in the warm stitch design language) and new screens (to be designed from scratch). It is the source-of-truth for the Google Stitch design team to generate all designs.
>
> **Structure**: 265 screens organized into 55 sequential batches of 5 screens each (with the final batch containing the remaining screens). Each screen entry includes: Purpose, Layout (top-to-bottom sections), Tables (columns + per-row actions), Forms (fields + types), Actions (buttons + behavior), and Dialogs/Modals/Sheets (trigger + content + actions).
>
> **Design notes**: No color references are included — the design system is already established in stitch. Status tones are expressed semantically (positive/warning/negative/info/muted/default). All interactive patterns follow the established shadcn/ui conventions (DataTable, Sheet, AlertDialog, Collapsible, Tabs, Select, Switch, Checkbox).
>
> **How to use**: Each batch of 5 screens can be processed independently by the design team. Read the screen's spec, generate the stitch design, then move to the next screen.

---

# Prop-Admin Dashboard — Stitch Design Spec (Part 1)

> **Scope**: Every screen in the Trading, Challenges, and Risk modules of the prop-admin dashboard, restyled in the warm **Stitch** design language that already powers the trader dashboard. This document is the source-of-truth that the Google Stitch design team will use to generate pixel-perfect designs.
>
> **Total screens in this part**: 60 (Trading 22, Challenges 15, Risk 23), organized into 12 sequential batches of 5 screens each.
>
> **Color policy**: This document contains **no color references**. The trader dashboard's stitch design system already defines every color, ramp, elevation layer, and typography ramp. Every screen below reuses those exact tokens. Where the current shadcn implementation uses a status badge with a tone (`success`, `warning`, `danger`, `info`, `muted`, `default`), the spec keeps the same tone name — the design team maps each tone onto the matching stitch semantic slot.

---

## Batch 1 — Trading Overview, Traders, Accounts, Open Positions, Trader Detail

### Trading Overview (view-id: `trading`) [EXISTING]

**Purpose**: Aggregate snapshot of all trading activity under the tenant — equity, open P&L, recent activity — giving ops a landing view before drilling into a specific trader or account.

**Layout** (top-to-bottom):
1. Page header — title "Trading Overview", subtitle "Aggregate trading activity across all trader accounts", icon (Activity), one primary action button on the right ("View Traders").
2. KPI strip — 4 cards in a 2×2 (mobile) / 4-column (desktop) grid: Traders (count, delta badge +8), Accounts (count, delta +5), Total Equity (currency, delta +3%), Open P&L (currency, tone flips with sign).
3. Two-column grid — left: area chart "Equity curve (30d)" inside a card; right: "Recent activity" timeline inside a card (up to 6 audit entries).

**Tables**: none on this screen.

**Forms**: none.

**Actions** (buttons + behavior):
- "View Traders" (header, outline) → navigate to `trading-traders`.
- KPI card click → drill-down to filtered list (new behavior — opens `trading-traders` with the matching filter pre-applied: Traders card → no filter; Accounts card → `trading-accounts`; Total Equity card → `trading-accounts`; Open P&L card → `trading-positions`).
- Date-range selector (new — pill-style toggle on the equity-curve card header): 7d / 30d / 90d.
- Per-account platform filter chip row above the chart (All / MT5 / MT4 / DXTrade / MatchTrader).

**Dialogs / Modals / Sheets**: none.

---

### Traders (view-id: `trading-traders`) [EXISTING]

**Purpose**: Filterable directory of every trader on the tenant; entry point to the per-trader workspace.

**Layout** (top-to-bottom):
1. Page header — title "Traders", subtitle "{N} traders in this tenant.", icon (Users). No right-side action in the current spec; design must reserve room for two new actions (see below).
2. Filter bar — sticky card row: "Filters" label with active-count badge, three dropdowns (Status, Phase, Country), result-count text "X of Y shown", and "Clear all" button when any filter is active.
3. Data table card — sortable, searchable DataTable with row click → trader-detail.

**Tables**:
- Traders table: Trader (avatar + name + email), Country (outline badge), Status (ExplainableStateBadge), Phase (outline badge), Trades (numeric), Win % (numeric), Equity (currency, numeric), Total P&L (currency, numeric, tone-tinted). | per-row action menu (new — kebab) with: View Profile, Edit Trader (sheet), Reset Password (alert dialog), Suspend (alert dialog), Message Trader (sheet), Impersonate / Login as Trader (alert dialog).

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Add Trader" / "Invite Trader" (new — primary button in header) → opens Sheet (Add Trader form: Full Name, Email, Country, Initial Phase, Send Welcome Email toggle → Create + Cancel).
- Bulk-select checkbox column (new) enables bulk action bar: "Suspend Selected" (alert dialog), "Email Selected" (sheet with template picker), "Export Selected" (toast + CSV).
- Per-row kebab menu → as above.
- Saved view control (new — top-right of filter bar): "Save View" button opens Sheet (Name, Description, Make Default toggle → Save).
- Column-picker button (new — top-right of filter bar) → Sheet with checkbox list of columns to show/hide.

**Dialogs / Modals / Sheets**:
- Add Trader Sheet (trigger: "Add Trader" button) → form fields: Full Name (input, required), Email (input, required), Country (select, required), Initial Phase (select, required), Send Welcome Email (toggle, default on) → actions: Cancel / Create Trader.
- Suspend Trader AlertDialog (trigger: row kebab → Suspend) → text: "Suspend {trader name}? All trading will halt immediately. Open positions will remain. Reversible from the trader profile." → actions: Cancel / Suspend Trader.
- Reset Password AlertDialog (trigger: row kebab → Reset Password) → text: "A new temporary password will be emailed to {trader email}. The previous password stops working immediately." → actions: Cancel / Send Reset Email.
- Message Trader Sheet (trigger: row kebab → Message Trader) → form: Subject (input), Body (textarea, 6 rows), Send Copy to Compliance (toggle) → actions: Cancel / Send.
- Impersonate AlertDialog (trigger: row kebab → Impersonate) → text: "You will be signed in as {trader name} for 30 minutes. Every action is recorded under your admin ID." → checkbox "I understand audit logging is enabled" → actions: Cancel / Begin Session.

---

### Accounts (view-id: `trading-accounts`) [EXISTING]

**Purpose**: Flat directory of every MT5 / MT4 / DXTrade / MatchTrader account under the tenant; the main launchpad into the Account Workspace.

**Layout** (top-to-bottom):
1. Page header — title "Trader Accounts", subtitle "MT5 / MT4 / DXTrade accounts for this trader tenant.", icon (CreditCard), right-side action area.
2. Filter bar — same FilterBar pattern: Status, Platform, Phase dropdowns + result count + Clear all.
3. Data table card.

**Tables**:
- Accounts table: Login (mono), Trader (link-style button → trader-detail, with arrow icon), Platform (outline badge), Type (secondary badge), Phase, Balance (currency), Equity (currency), Status (StatusBadge tone-mapped). | per-row action menu (new — kebab): Open Workspace, Block Account (alert dialog), Sync Account (toast with progress), Reset Account (alert dialog), Rotate Password (sheet), View Events.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Add Account" (new — primary button in header) → navigate to `trading-add-account`.
- "Export" (new — outline button in header) → toast + CSV of currently filtered rows.
- Bulk-select checkbox column (new) enables bulk bar: "Block Selected" (alert dialog), "Sync Selected" (progress toast), "Export Selected" (CSV).
- Date-range filter chip (new) in filter bar.
- Row click → navigate to `account-workspace` with id.
- Trader-name cell click → navigate to `trader-detail` (stopPropagation).

**Dialogs / Modals / Sheets**:
- Block Account AlertDialog (trigger: kebab → Block Account) → text + checkbox "Close all open positions at market" → actions: Cancel / Block Account.
- Reset Account AlertDialog (trigger: kebab → Reset Account) → text: "Resetting restores the initial balance and discards all progress. This cannot be undone." → reason-input (textarea, required) → actions: Cancel / Reset.
- Rotate Password Sheet (trigger: kebab → Rotate Password) → form: New Password (input, generated, with regenerate button), Send to Trader (toggle, default on), Audit Reason (textarea, required) → actions: Cancel / Rotate.

---

### Open Positions (view-id: `trading-positions`) [EXISTING]

**Purpose**: Live cross-account list of every open position so risk and ops can watch exposure in one place.

**Layout** (top-to-bottom):
1. Page header — title "Open Positions", subtitle "{N} positions currently open across all traders.", icon (Activity), right-side action area.
2. Filter bar — Side, Symbol, P&L dropdowns + result count + Clear all.
3. Data table card.

**Tables**:
- Open Positions table: Symbol (mono), Side (tone-tinted text: Buy → positive tone, Sell → negative tone), Volume (numeric), Entry, Current, P&L (currency, numeric, tone-tinted), P&L % (numeric, tone-tinted), Opened (date-time, muted). | row actions (new): "View Detail" (opens Position Detail Sheet), "Close Position" (alert dialog, destructive), kebab menu → "Modify SL/TP" (sheet), "View Account" (navigate).

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Export CSV" (new — outline button in header) → toast + CSV.
- "Bulk Close All" (new — destructive button in header, disabled when no rows selected) → alert dialog.
- Row click → currently navigates to `account-workspace`; new behavior: opens **Position Detail (Live)** Sheet first; secondary "Open Account" link inside the sheet goes to account-workspace.
- Per-row "Close Position" (destructive ghost button, new) → AlertDialog: "Close {side} {volume} {symbol} on login {login}? Estimated fill at current market ({price}). Slippage may apply." → actions: Cancel / Close at Market.
- Per-row kebab → "Modify SL/TP" Sheet (inputs: Stop Loss, Take Profit, both with "Use current" buttons), "View Account" (navigate).

**Dialogs / Modals / Sheets**:
- Position Detail (Live) Sheet (trigger: row click) — content: full position snapshot (UID, side, volume, entry, current, P&L, swap, commission, SL/TP, open time, account login, trader name) + mini equity sparkline + "Modify SL/TP" inline form + footer actions (Close at Market, Notify Trader, Open Account Workspace).
- Bulk Close AlertDialog (trigger: header "Bulk Close All") → text: "Close {N} selected positions? Each will be closed at current market. Slippage may apply. Action is irreversible." → checkbox "Notify each trader by email" → actions: Cancel / Close {N} Positions.
- Modify SL/TP Sheet (trigger: kebab → Modify SL/TP) → form: Stop Loss (input, optional), Take Profit (input, optional), Audit Reason (textarea) → actions: Cancel / Save.

---

### Trader Detail (view-id: `trader-detail`) [EXISTING]

**Purpose**: 7-tab per-trader workspace — at-a-glance identity, KPIs, account health, then deep-dive into accounts, positions, performance, KYC, risk, and change history.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to traders".
2. Entity header — avatar (initials fallback), title (trader name), subtitle (email · country), badges (status badge, phase badge), right-side action cluster.
3. KPI strip — 4 cards: Equity, Total P&L (tone-tinted), Win rate, Trades.
4. Account Health widget (conditional — only when trader is in a challenge phase): unified bar showing Daily Loss, Max Drawdown, Profit Target, with current-vs-limit progress for each.
5. Tab strip — Overview, Accounts, Positions, Performance, KYC, Risk, Change History.
6. Tab content area — varies per tab (described below).

**Tab content**:
- **Overview tab** — 2-column grid: left "Account Summary" card (Trader ID, Country, Joined, Phase, Account Balance, Equity — 6-cell read-only grid); right "Key Metrics" card (Accounts count, Open Positions count, KYC state, Open Breaches count).
- **Accounts tab** — DataTable of accounts owned by this trader (Login, Platform, Type, Phase, Balance, Equity, Status) with row click → `account-workspace`.
- **Positions tab** — DataTable of open positions (Symbol, Side, Volume, Entry, Current, P&L).
- **Performance tab** — 30-day equity curve area chart.
- **KYC tab** — KYC record card (submitted date, reviewed date, status badge, document type, country, risk level badge) or empty state when no KYC.
- **Risk tab** — Account Health widget + "Recent Breaches" list (per-breach row: type, rule, severity, status badges).
- **Change History tab** — ActivityTimeline of last 12 changes for this trader.

**Tables**:
- Accounts sub-table (in Accounts tab): Login, Platform, Type, Phase, Balance, Equity, Status | row click → account-workspace.
- Positions sub-table (in Positions tab): Symbol, Side, Volume, Entry, Current, P&L | no per-row actions.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Block Account" (header, destructive) → AlertDialog (existing) → on confirm, toast.
- "Resync" (header, outline) → toast with progress; should open an inline progress sheet that shows sync steps (connecting → fetching equity → fetching positions → done).
- "Edit Payout Schedule" (header, outline) → opens Sheet (new — currently toast-stub).
- "Edit Trader" (header, outline, currently dead button — new): opens Sheet to edit name, email, country.
- "Unblock Account" / "Reactivate" (new — outline, shown when trader is suspended): AlertDialog → "Reactivate {name}? Trading access will be restored immediately." → actions: Cancel / Reactivate.
- KYC tab actions (new): "Re-initiate KYC" (outline) → toast; "Mark Verified" (outline) → AlertDialog; "Reject KYC" (destructive) → AlertDialog with reason input.
- "Add Note" / "Impersonate" (new — secondary action cluster above KPI strip): Add Note → Sheet (note body + internal-only toggle); Impersonate → AlertDialog as in Traders page.
- "View Full Audit Log" link in Change History tab (new) → navigate to `trader-audit-log` (new screen — see Batch 4).

**Dialogs / Modals / Sheets**:
- Edit Payout Schedule Sheet (trigger: "Edit Payout Schedule" button) → form: Frequency (select: Weekly / Bi-Weekly / Monthly / Quarterly), Next Payout Date (date input), Profit Split Override (number %, optional, blank = use challenge default), First Withdrawal Delay (text), Notes (textarea) → actions: Cancel / Save.
- Edit Trader Sheet (trigger: "Edit Trader" button) → form: Full Name, Email, Country, Phone (optional), Tags (multi-select chip) → actions: Cancel / Save.
- KYC Mark Verified AlertDialog → text: "Mark {trader}'s KYC as verified? This will unlock payout eligibility. The action is logged." → actions: Cancel / Mark Verified.
- KYC Reject AlertDialog → form: Rejection Reason (select: Document Expired / Document Unclear / Identity Mismatch / Country Not Supported / Other), Notes (textarea, required) → checkbox "Email trader with re-submission instructions" → actions: Cancel / Reject.
- Add Note Sheet (trigger: "Add Note") → form: Note (textarea 4 rows), Visibility (radio: Internal Only / Visible to Trader), Pin to Top (toggle) → actions: Cancel / Save Note.
- Impersonate AlertDialog — same as on Traders page.
- Resync Progress Sheet (trigger: "Resync") → content: 4-step progress list (1. Connecting to bridge — pending/done, 2. Fetching equity, 3. Fetching open positions, 4. Reconciling history) + estimated time + Cancel button.

---

## Batch 2 — Add Account, Closed Positions, Closed Position Detail, Account Workspace, Account Broker Details

### Add Account (view-id: `trading-add-account`) [EXISTING]

**Purpose**: 5-step guided wizard that provisions a new trader account end-to-end (user → challenge → config → KYC → review).

**Layout** (top-to-bottom):
1. Page header — title "Add Account", subtitle "Create a new trader account with associated challenge and KYC.", icon (UserPlus).
2. Step indicator card — horizontal row of 5 numbered circles (User, Challenge, Account, KYC, Review) with connecting progress bars; done = filled, active = outlined, pending = muted.
3. Step content card — renders the active step's form; min-height 280 px to prevent layout jump.
4. Footer nav — ghost "Back" left, "Step X of 5" center, primary "Next" / "Create Account" right.

**Step content**:
- **Step 1 — User** — title "User Information", subtitle, 2-column grid: Email (input, required), Full Name (input, required). Footnote about automatic welcome email.
- **Step 2 — Challenge & Phase** — title, subtitle, 2-column grid: Challenge Type (select, required — list of types with phase count), Phase (select, required — filtered by chosen type). Below: "Phase defaults" summary card (Account Size, Profit Target, Max Drawdown, Daily Drawdown — 4-cell grid).
- **Step 3 — Account Configuration** — title, subtitle, 2-column grid: Profit Split % (input, required, with live "Trader keeps X%, firm Y%" hint), Payout Frequency (select), Initial Balance USD (input, required), Broker Type (select: MT5 / DXTrade).
- **Step 4 — KYC Status** — title, subtitle, Initial KYC Status (select: Pending verification / Skip KYC). When "Skip KYC" chosen: dashed-border placeholder card explaining "KYC skipped — trader will be prompted before first payout." Otherwise: Document Type select (Passport / Driver's License / National ID / Residence Permit).
- **Step 5 — Review** — title "Review & Create", subtitle, summary card listing 11 rows (Email, Full Name, Challenge Type, Phase, Account Size, Profit Split, Payout Frequency, Initial Balance, Broker Type, KYC Status, Document Type) in a 2-column dl, then accent-bordered callout with badge + confirmation text + "Create Account" button.

**Tables**: none.

**Forms**:
- User Info form: Email (input, required), Full Name (input, required).
- Challenge / Phase form: Challenge Type (select, required), Phase (select, required, conditional on type).
- Account Config form: Profit Split % (input, required, 0–100), Payout Frequency (select), Initial Balance (input, required, >0), Broker Type (select).
- KYC form: Initial KYC Status (select, required), Document Type (select, conditional — required unless skipped).
- Review form: read-only summary, primary "Create Account" button.

**Actions** (buttons + behavior):
- "Back" (ghost, disabled on step 1) → previous step.
- "Next" (primary, disabled until step-valid) → next step.
- "Create Account" (primary, step 5) → toast + reset state + navigate to `trading-accounts`.
- "Save Draft" (new — ghost button on the left of the footer) → toast "Draft saved — resume any time from the drafts list".
- "Resume Later" (new — link on the right of the header) → navigate back to `trading-accounts` without losing draft.
- "Send Welcome Email" (new — toggle in step 1, default on) — controls whether the welcome email fires on create.
- "Load from existing template" (new — link in step 2 header) → opens Sheet with a list of saved templates; selecting one populates steps 2-4.
- KYC file-upload widget (new — in step 4 when not skipped): drag-and-drop area accepting PDF / JPG / PNG up to 10 MB, with file preview thumbnail, "Remove" button, and "Use camera" fallback.

**Dialogs / Modals / Sheets**:
- Load Template Sheet (trigger: "Load from existing template") → list of templates with radio selection + "Preview" link per template → actions: Cancel / Apply Template.

---

### Closed Positions (view-id: `closed-positions`) [EXISTING]

**Purpose**: Historical cross-account list of every closed position with rich filters, KPI roll-ups, and CSV export.

**Layout** (top-to-bottom):
1. Page header — title "Closed Positions", subtitle "Historical trading positions that have been closed.", icon (Activity), right-side "Export CSV" outline button.
2. KPI strip — 7 cards in 2×4 / 7-column grid: Total Closed, Total Profit (positive tone), Total Loss (negative tone), Win Rate (tone flips with value), Avg Duration, Best Trade (positive), Worst Trade (negative).
3. Filter bar — card row: "Filters" label + active-count badge, search input, 4 dropdowns (Date Range, Symbol, Direction, Close Reason), Clear button, result-count text.
4. Data table card.

**Tables**:
- Closed Positions table: (expand chevron), Login (mono), Trader, Direction (badge tone-tinted), Symbol (mono), Volume (numeric), Entry, Close, P&L (currency, tone-tinted), Open Time, Close Time, Duration (e.g. "3h 42m"), Reason (badge tone-tinted: TP positive, SL negative, Manual muted). | row actions: row click → expand inline detail panel (current behavior); new: kebab → "View Detail" (navigate to closed-position-detail), "Tag Trade" (sheet), "Convert to Journal Entry" (sheet), "Export PDF Ticket" (toast + PDF).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header) → CSV of filtered rows (current behavior preserved).
- Row click → expand inline detail panel below table.
- Per-row kebab (new) → as above.
- Bulk-export selected (new — checkbox column enables bulk bar with "Export Selected" + "Tag Selected" buttons).
- "Tag Trade" Sheet (new) → chips of existing tags + free-text input → Save.

**Dialogs / Modals / Sheets**:
- Expanded detail panel (current) — 16-cell dl showing every field including Commission, Swap, P&L%.
- Tag Trade Sheet (trigger: kebab → Tag Trade) → form: Tags (chip input — type to add, click to remove), Internal Note (textarea, optional) → actions: Cancel / Save.
- Convert to Journal Entry Sheet (trigger: kebab → Convert to Journal Entry) → form: Journal Name (input, prefilled "{symbol} {side} {volume}"), Entry Date (date), Strategy Tags (chip input), Notes (textarea) → actions: Cancel / Save to Journal.

---

### Closed Position Detail (view-id: `closed-position-detail`) [EXISTING]

**Purpose**: Single closed trade audit view with inline edit form and destructive delete.

**Layout** (top-to-bottom):
1. Breadcrumb — "Closed Positions › {position id}".
2. Header row — small icon-tile (Activity icon in muted box), title (position id mono + symbol), description (symbol description), right-side action cluster (direction badge, state badge, "Edit" toggle button).
3. Two-column form grid — 6 FormSection cards arranged 2-wide × 3-tall: Identity, Volume & Pricing, Timing, Order IDs, P&L, Risk, Flags. (Note: 6 sections in 2 columns = 3 rows, but the existing code has 7 sections including Flags as a 7th; the layout wraps to 4 rows on smaller widths.)
4. Footer action bar — left: destructive "Delete Closed Position" outline button; right: ghost "Back to Closed Positions", outline "Save and continue editing", primary "Save Changes".

**FormSection cards** (each: header with small icon + title + description, divider, then content):
- Identity — Uid (read-only), Trader (link-button → trader-detail with arrow), Account (link-button → account-workspace with arrow), Direction (badge), State (read-only), Symbol (read-only), Symbol Description (read-only), Position Type (select: Market / Pending — editable), Entry Type (select: In / Out — editable).
- Volume & Pricing — Volume, Open Price, Close Price, Current Price (read-only fields).
- Timing — Open Time, Close Time, Duration (read-only, computed).
- Order IDs — Open Order ID, Close Order ID (read-only mono).
- P&L — Profit (tone-tinted), Commission, Swap, divider, Net Profit (tone-tinted, strong).
- Risk — Stop Loss, Take Profit, RR Ratio (read-only mono).
- Flags — Is Partial (read-only Switch), Close Reason (select: Take Profit / Stop Loss / Manual / System / Liquidation — editable) with tone-tinted preview badge below.

**Tables**: none.

**Forms**:
- Closed Position form (per above): Position Type (select), Entry Type (select), Close Reason (select) are the only editable fields. Everything else is read-only with help tooltips.

**Actions** (buttons + behavior):
- "Edit" toggle button (header) → flips the 3 editable selects to enabled state; label changes to "Done".
- "Save Changes" (footer primary) → toast + exit edit mode.
- "Save and continue editing" (footer outline) → toast, stays in edit mode.
- "Back to Closed Positions" (footer ghost) → navigate to `closed-positions`.
- "Delete Closed Position" (footer destructive outline) → AlertDialog.
- "Reopen Position" (new — outline button in header next to Edit) → AlertDialog: "Reopen {id}? The position will return to the open-positions list with the original entry price and volume." → actions: Cancel / Reopen.
- "Reverse Trade" (new — outline button in header) → AlertDialog: "Open an opposite-side position at the close price of this trade?" → form: Volume (input, default = original volume) → actions: Cancel / Open Reverse.
- "Download Trade Ticket PDF" (new — outline button in header) → toast + PDF download.
- "Audit History" inline preview (new — collapsible section below the form): shows 5 most-recent audit entries for this position with "View full history" link → toast (or future audit-log page).

**Dialogs / Modals / Sheets**:
- Delete AlertDialog (trigger: "Delete Closed Position") → icon (ShieldAlert), title "Delete closed position?", body "This trade record will be permanently deleted. The position data, P&L, and audit trail will be lost." → actions: Cancel / Delete permanently (destructive).
- Reopen Position AlertDialog (trigger: "Reopen Position") → form: Reopen at Price (input, default = close price), Reopen Volume (input, default = original), Reason (textarea, required) → actions: Cancel / Reopen.
- Reverse Trade AlertDialog (trigger: "Reverse Trade") → form: Volume (input, default = original), Use Current Market Price (toggle, default on; when off, show Limit Price input), Reason (textarea) → actions: Cancel / Open Reverse.

---

### Account Workspace (view-id: `account-workspace`) [EXISTING]

**Purpose**: Unified tabbed workspace for a single trading account — wraps the 6 existing account-* sub-pages under one header so the operator can move between Configuration, Events, Version History, Broker Details, KYC, and Related Accounts without returning to the sidebar.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to Accounts".
2. Page header — title "Account {login}", subtitle "{platform} · {trader name} · {type}", icon (CreditCard), right-side "View Trader" outline button with arrow.
3. KPI strip — 4 cards: Balance, Equity (tone-tinted with P&L direction), Status, Phase.
4. Status badge row — "Account ID" label + mono id badge + StatusBadge + platform/type/phase badges, separated by middots.
5. Tab strip — Configuration, Events, Version History, Broker Details, KYC Statuses, Related Accounts (each tab has an icon).
6. Tab content area — renders the corresponding existing account-* page.

**Tables**: see individual sub-pages below.

**Forms**: see individual sub-pages below.

**Actions** (buttons + behavior):
- "View Trader" (header) → navigate to `trader-detail`.
- "Block Account" (new — destructive button in header) → AlertDialog (reuses Account Configuration's Block dialog).
- "Reset Account" (new — destructive outline button in header) → AlertDialog (reuses Account Configuration's Reset dialog).
- "Sync Account" (new — outline button in header) → toast with progress + opens inline sync sheet (steps: 1. Connecting to bridge, 2. Fetching balance, 3. Fetching positions, 4. Reconciling).
- "Add Note" (new — ghost button in header) → Sheet (note body + internal-only toggle).
- "Copy account ID" (new — ghost icon button next to the Account ID badge) → toast.
- "Open in MT5 / Web Terminal" (new — outline button in header, deep-link) → toast with "Opening MT5 web terminal…" and external link.

**Dialogs / Modals / Sheets**:
- Sync Progress Sheet (trigger: "Sync Account") → content: 4-step progress list + estimated time + Cancel button.
- Add Note Sheet (trigger: "Add Note") → form: Note (textarea), Visibility (radio: Internal Only / Visible to Trader), Pin to Top (toggle) → actions: Cancel / Save.
- Block Account AlertDialog (trigger: "Block Account") → reuses Account Configuration dialog.
- Reset Account AlertDialog (trigger: "Reset Account") → reuses Account Configuration dialog.

---

### Account Broker Details (view-id: `account-broker-details`) [EXISTING]

**Purpose**: Read-only broker / bridge configuration with explicit Edit toggle, plus a live account-metrics KPI row.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to trader".
2. Page header — title "Account Broker Details", subtitle "Broker / trading-platform configuration and live bridge sync state.", icon (Server), right-side action cluster: "Edit" outline + "Resync Account" outline (or "Cancel" + "Save Changes" when in edit mode).
3. Entity header — title "Login {login}", subtitle "{trader name} · {platform} · {phase}", badges (type badge, status badge).
4. KPI strip — 5 cards: Account Balance, Equity, Margin, Free Margin, Margin Level (tone-tinted by threshold).
5. 3-column grid (lg:col-span layout): Login Credentials (2-wide), Broker Configuration (1-wide), Trading Account Matching (3-wide full row).

**Section content**:
- **Login Credentials** — 4-cell grid: Login ID (mono), Password (masked, with help tooltip), Server (mono), Investor Password (masked, with help tooltip). All read-only.
- **Broker Configuration** — 2-cell × 2-row grid: Broker Type (select: MT5 / DXTrade — disabled unless editing), Leverage (input — disabled unless editing), Account Group (input — disabled unless editing), Currency (input — disabled unless editing).
- **Trading Account Matching** — 4-cell grid: Matched Account (checkbox, read-only, "Matched to broker login" / "Awaiting match"), Bridge Status (status badge with icon: Connected / Disconnected), Last Sync (date-time), Sync Action ("Sync Now" outline button). Footer help row with bridge sync explanation.

**Tables**: none.

**Forms**:
- Broker Configuration form: Broker Type (select, editable in edit mode), Leverage (input, editable), Account Group (input, editable), Currency (input, editable).

**Actions** (buttons + behavior):
- "Edit" (header outline) → toggles edit mode; shows "Cancel" + "Save Changes" instead. On save → toast.
- "Cancel" (header ghost, edit mode) → discard draft.
- "Save Changes" (header primary, edit mode) → toast.
- "Resync Account" (header outline) → toast.
- "Sync Now" (in Trading Account Matching section) → toast + opens sync progress sheet (new).
- "Rotate Password" (new — destructive outline button in Login Credentials section footer) → AlertDialog.
- "Reset Master Password" (new — destructive outline button in Login Credentials section footer) → AlertDialog.
- "Bridge Connection Log" (new — ghost link in Trading Account Matching section footer) → opens Bridge Connection Log Sheet (new).
- "Reconnect Bridge" / "Test Connection" (new — outline button in Trading Account Matching section footer) → toast.

**Dialogs / Modals / Sheets**:
- Rotate Password AlertDialog (trigger: "Rotate Password") → form: New Password (input, generated, with regenerate button), Send to Trader (toggle, default on), Audit Reason (textarea, required) → actions: Cancel / Rotate.
- Reset Master Password AlertDialog (trigger: "Reset Master Password") → text: "Reset the master trading password? The trader will receive a new temporary password by email. All open sessions will be force-logged-out." → actions: Cancel / Reset Password.
- Bridge Connection Log Sheet (trigger: "Bridge Connection Log") → content: scrollable timeline of last 50 connection events (timestamp, event type, latency, status) with filter by event type → actions: Close.
- Sync Progress Sheet (trigger: "Sync Now" or "Resync Account") → 4-step progress list + Cancel.

---

## Batch 3 — Account KYC Statuses, Account Related Accounts, Account Configuration, Account Events, Account Version History

### Account KYC Statuses (view-id: `account-kyc-statuses`) [EXISTING]

**Purpose**: Per-provider KYC verification matrix for the trader associated with the active account.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to trader".
2. Page header — title "Account KYC Statuses", subtitle "Per-provider KYC verification state for {trader name}.", icon (FileCheck), right-side primary "Add KYC Provider" button.
3. Entity header — title {trader name}, subtitle "Login {login} · {platform}", badges (phase badge, trader-level KYC status badge or "No KYC" badge).
4. KPI strip — 4 cards: Total Providers, Verified (positive tone), Pending (warning tone), Rejected (negative tone when > 0).
5. Card containing the providers table + an accent-bordered tip footer.

**Tables**:
- KYC Providers table: Provider (mono uppercase), Status (ExplainableStateBadge), Documents (numeric badge), Last Checked (date-time), Action (per-row: "Re-initiate" outline button + "More" kebab with Re-initiate / Verify / Reject items). | row click → opens IP Detail Sheet (new — see below).

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Add KYC Provider" (header primary) → opens Sheet (new — currently toast-stub).
- "Re-initiate" (per-row outline) → toast.
- "Verify" (per-row kebab item) → AlertDialog.
- "Reject" (per-row kebab item, destructive) → AlertDialog.
- Row click → opens KYC Document Detail Sheet (new).
- "Mark All Approved" (new — outline button in header next to Add) → AlertDialog: "Mark all {N} pending providers as approved? This will unlock payout eligibility for the trader." → actions: Cancel / Mark All Approved.

**Dialogs / Modals / Sheets**:
- Add KYC Provider Sheet (trigger: "Add KYC Provider") → form: Provider (select: VERIFF / SUMSUB / ONFIDO / MANUAL), API Key (input, masked), Webhook URL (input, optional), Default Document Type (select), Auto-verify on Submit (toggle) → actions: Cancel / Add Provider.
- Verify AlertDialog (trigger: kebab → Verify) → text: "Mark {provider} as verified for {trader}? This action is logged." → actions: Cancel / Verify.
- Reject AlertDialog (trigger: kebab → Reject) → form: Rejection Reason (select: Document Expired / Document Unclear / Identity Mismatch / Country Not Supported / Other), Notes (textarea, required), Email Trader (toggle, default on) → actions: Cancel / Reject.
- KYC Document Detail Sheet (trigger: row click) → content: list of submitted documents with thumbnail previews, document type, submission date, status; footer actions: "Download All" (toast + zip), "Re-initiate" (toast), "Verify" (AlertDialog), "Reject" (AlertDialog).

---

### Account Related Accounts (view-id: `account-related-accounts`) [EXISTING]

**Purpose**: Every trading account owned by the same trader as the active account — for spotting duplicate traders, parallel phases, or broker migrations.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to trader".
2. Page header — title "Related Accounts", subtitle "All trading accounts owned by {trader name}.", icon (Link2), right-side primary "Link Account" button.
3. Entity header — title {trader name}, subtitle "Showing {N} accounts · current login {login}", badges ("{N} linked" badge).
4. KPI strip — 4 cards: Total Related Accounts, Funded (positive), Active (positive), Breached (negative when > 0).
5. Card containing the related-accounts table + accent-bordered note footer.

**Tables**:
- Related Accounts table: Login (mono, with "current" badge on the active row), Phase (badge), Broker Type (secondary badge), Initial Balance (currency), Current Equity (currency), Profit Split ("X% / Y%" text), Status (ExplainableStateBadge), Source (badge: Challenge / Manual / Migration), Actions ("Unlink" ghost-destructive button, hidden on the current row). | row click → currently navigates to `account-broker-details` (inconsistent — fix below).

**Forms**: none.

**Actions** (buttons + behavior):
- "Link Account" (header primary) → opens Sheet (new — currently toast-stub).
- Row click → navigate to `account-workspace` (fixed from current behavior of going to broker-details).
- "Unlink" (per-row ghost-destructive) → AlertDialog (new — currently toast-stub).
- "Compare Accounts" (new — outline button in header, enabled when ≥ 2 accounts selected via checkbox column) → opens Compare Accounts Sheet.
- "Merge Accounts" (new — destructive outline button in header, enabled when exactly 2 accounts selected) → AlertDialog with merge direction picker.

**Dialogs / Modals / Sheets**:
- Link Account Sheet (trigger: "Link Account") → form: Broker Login (input, required), Broker Type (select), Trader Email (input, prefilled with current trader email, required), Verify Identity (toggle, default on — runs email match check) → actions: Cancel / Link Account.
- Unlink AlertDialog (trigger: "Unlink") → text: "Unlink login {login} ({platform}) from {trader}? The account will be detached from this trader's portfolio. It can be re-linked later." → actions: Cancel / Unlink.
- Compare Accounts Sheet (trigger: "Compare Accounts") → content: side-by-side read-only comparison of 2-3 selected accounts (Login, Platform, Phase, Balance, Equity, P&L, Status, Profit Split, Source) with cells highlighting differences → actions: Close.
- Merge Accounts AlertDialog (trigger: "Merge Accounts") → form: Primary Account (radio — which one wins), Secondary Account (read-only — will be archived), Reason (textarea, required), Acknowledge Data Loss (checkbox, required) → actions: Cancel / Merge Accounts.

---

### Account Configuration (view-id: `account-configuration`) [EXISTING]

**Purpose**: Comprehensive account admin form with 5 collapsible sections + Account Health widget + destructive Block/Reset actions guarded by AlertDialog.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to Account".
2. Page header — title "Account Configuration", subtitle "Comprehensive configuration, balances, drawdown, broker details, status and extra settings.", icon (Settings2). No header actions — the page-level actions live in the footer bar.
3. Entity header — title "Login {login}", subtitle "{trader name} · {platform} · {phase}", badges (type badge, status badge, source badge, account-label badge).
4. KPI strip — 5 cards: Equity, Balance, P&L (tone-tinted), Drawdown % (tone-tinted by threshold: ≥8% negative, ≥5% warning), Days Remaining (tone-tinted: ≤7 negative, ≤14 warning).
5. Account Health widget card.
6. 5 Collapsible SectionCard components (1, 2 start expanded; 3, 4, 5 collapsed by default).
7. Footer action bar — card with two clusters: left "Save Changes" primary + "Save and continue editing" outline; right "Block Account" destructive + "Reset Account" outline.

**Section content**:
- **Section 1 — Account Configuration** (expanded): 3-cell grid: User Email (read-only, with link-to-trader hint), Phase (read-only), Start Date (datetime-local input), End Date (datetime-local input, with "leave empty for no limit" hint), Profit Split % (number input, 0–100, with live split hint), Payout Frequency (select: Weekly / Bi-Weekly / Monthly / Quarterly), First Withdrawal Delay (text input), Order (select with mock ORD- IDs), Next Withdrawal Date (datetime-local input), Source (read-only: Webhook / Manual), Account Label (select: Paid / Giveaway / Third Party / Standard). Footer: link-to-trader inline link.
- **Section 2 — Balance & Drawdown Metrics** (expanded, read-only): Initial Balance, Live Balance, Live Equity, P&L (tone-tinted), Daily Starting Balance, Daily Drawdown Amount (+ % badge), Profit Target Amount, Global Drawdown Amount (+ % badge), Daily Drawdown Expiry (date-time), Drawdown Locked (Switch + Locked/Unlocked badge).
- **Section 3 — Broker Details** (collapsed): Login (read-only), Broker Type (select: MetaTrader5 / MetaTrader4 / DXTrade / MatchTrader), MetaTrader Trading Account (input, mono), MatchTrader Trading Account (input, mono). Footer: "Sync Account" outline + "Resend Credentials" outline.
- **Section 4 — Account Status Details** (collapsed): Status (ExplainableStateBadge), Status Reason (select: None / Manual Review / Policy Violation / Risk Concern / Documentation Issue / Payment Failed), Status Finalised Timestamp (datetime-local), Custom Status Reason (textarea), Copy Trading Detected (Switch + Flagged/Not flagged badge), Failed Review Reason (textarea).
- **Section 5 — Extra Settings** (collapsed): 2-column grid of FlagRow checkboxes: HIDE_ACCOUNT, PUBLIC_TRACK_RECORD, PUBLIC_BALANCE, PUBLIC_TRADE_HISTORY, PUBLIC_LOTS. Each row has a checkbox + mono label + description text.

**Tables**: none.

**Forms**:
- Account Configuration form: Start Date (datetime-local), End Date (datetime-local), Profit Split % (number), Payout Frequency (select), First Withdrawal Delay (text), Order (select), Next Withdrawal Date (datetime-local), Account Label (select).
- Balance & Drawdown: Drawdown Locked (Switch) — only editable field in section 2.
- Broker Details: Broker Type (select), MetaTrader Trading Account (input), MatchTrader Trading Account (input).
- Account Status Details: Status Reason (select), Status Finalised Timestamp (datetime-local), Custom Status Reason (textarea), Copy Trading Detected (Switch), Failed Review Reason (textarea).
- Extra Settings: 5 toggle checkboxes.

**Actions** (buttons + behavior):
- Section expand/collapse — click the section header to toggle.
- "Sync Account" (footer of Section 3) → toast.
- "Resend Credentials" (footer of Section 3) → toast (current) → fix: opens Resend Credentials Sheet.
- "Save Changes" (footer primary) → toast.
- "Save and continue editing" (footer outline) → toast.
- "Block Account" (footer destructive) → AlertDialog.
- "Reset Account" (footer outline) → AlertDialog (fix: should be destructive AlertDialog, currently toast-only).
- "Audit Trail" inline preview (new — collapsible card below footer): shows last 5 audit entries with "View full history" link → `account-events`.
- "Schedule Status Change" (new — outline button in Section 4) → Sheet.

**Dialogs / Modals / Sheets**:
- Block Account AlertDialog (trigger: "Block Account") → text: "Block this account? The account will be immediately blocked. The trader will lose all trading access. This action is logged in the audit trail." → actions: Cancel / Block account.
- Reset Account AlertDialog (trigger: "Reset Account") → text: "Reset account to its initial state? All progress (balance, equity, P&L, drawdown) will be lost. The account will return to its starting balance. This action is irreversible." → form: Reason (textarea, required), Acknowledge Data Loss (checkbox, required) → actions: Cancel / Reset Account (destructive).
- Resend Credentials Sheet (trigger: "Resend Credentials") → form: Template (select: Welcome / Reset Password / Account Reactivation), Custom Message (textarea, optional), Send To (input, prefilled with trader email) → actions: Cancel / Send.
- Schedule Status Change Sheet (trigger: "Schedule Status Change") → form: New Status (select: Active / Manual Review / Suspended / Breached), Effective At (datetime-local, required), Reason (textarea, required), Notify Trader (toggle, default on) → actions: Cancel / Schedule.

---

### Account Events (view-id: `account-events`) [EXISTING]

**Purpose**: Immutable audit trail of every lifecycle event for a single account — feeds the compliance archive.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to trader".
2. Page header — title "Account Events", subtitle "Immutable audit trail of account events — login {login}", icon (History), right-side "Export CSV" outline + "Back to Account" outline.
3. KPI strip — 5 cards: Total Events, Status Changes (warning tone), Phase Transitions (positive tone), Payout Events (positive tone), Breach Events (negative tone).
4. Filter bar — card row: "Filters" label + active-count badge, search input, 3 dropdowns (Event Type, Date Range — currently native HTML selects), Clear button, result-count text.
5. Card containing the events table + accent-bordered footer help ("This audit trail is immutable…").

**Tables**:
- Account Events table: Event Type (icon + StatusBadge button — clickable), Description (text), Actor (text or "System"/"AI Engine"/"Risk Engine" badge), Created (date-time, tabular). | row click → opens Event Detail Sheet (new — currently toast-only).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV of filtered events.
- "Back to Account" (header outline) → navigate to `account-workspace` (currently navigates to `trader-detail` — fix: should go to account-workspace since this page is now inside the workspace tab).
- Row click → opens Event Detail Sheet (new — currently toast-only).
- Filter dropdowns (currently native HTML `<select>`) → convert to shadcn Select components.
- "Subscribe to events" (new — ghost button in header) → opens Subscription Sheet.
- "View trader's all-events" cross-link (new — ghost link in entity header) → navigate to `trader-audit-log` filtered to this trader.

**Dialogs / Modals / Sheets**:
- Event Detail Sheet (trigger: row click) → content: full event payload (ID, Type, Description, Actor, Actor Role, Created, IP Address, Browser/User Agent if available, Before-state, After-state, Related Entity IDs) + footer actions: "View Related Entity" (navigates), "Copy Event JSON" (toast).
- Subscription Sheet (trigger: "Subscribe to events") → form: Notification Channels (multi-checkbox: Email / Slack / Webhook), Event Types (multi-checkbox: Status Changed / Phase Upgraded / Breach Detected / Drawdown Alert / Payout Events), Cadence (radio: Real-time / Daily digest / Weekly digest) → actions: Cancel / Subscribe.

---

### Account Version History (view-id: `account-version-history`) [EXISTING]

**Purpose**: Object versioning for the account record — every save creates a snapshot; supports diff view and revert.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to trader".
2. Page header — title "Version History", subtitle "Complete audit trail of all field changes with before/after values", icon (History), right-side "Export CSV" outline + "Back to Account" outline.
3. KPI strip — 4 cards: Total Versions, Unique Actors, Fields Tracked, Latest Change (date).
4. Filter bar — card row: search input, 3 dropdowns (Changed Field, Changed By, Date Range — currently native selects), Clear button, result-count text.
5. Card containing the versions table + (when a row is expanded) inline expansion panel below the table + footer help.

**Tables**:
- Versions table: (expand chevron), Object (text — "{trader name} · Login {login}"), Date/Time (tabular date-time), Comment (text, e.g. "Profit Split updated"), Changed By (text + role badge), Change Reason (muted text), Changes (DiffCell: "Field: ~old~ → **new**" mini diff, supports multiple fields), Action ("Revert to Version" outline button). | row click → expands inline detail panel.

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV of filtered versions.
- "Back to Account" (header outline) → navigate to `account-workspace` (fix: same as Account Events).
- Row click → expands inline detail panel below the table.
- "Revert to Version" (per-row + in expansion panel) → AlertDialog (fix: currently toast-only).
- Filter dropdowns (currently native HTML) → convert to shadcn Select.
- "Compare two versions" (new — outline button in header) → opens Compare Sheet with side-by-side diff viewer.

**Dialogs / Modals / Sheets**:
- Revert to Version AlertDialog (trigger: "Revert to Version") → content: diff preview showing fields that will change back (current value → version value, in a list) + reason textarea (required) + checkbox "Acknowledge: revert will be logged as a new version" (required) → actions: Cancel / Revert to {version id}.
- Compare Two Versions Sheet (trigger: "Compare two versions") → form: Version A (select), Version B (select) → "Compare" button → content: side-by-side table of every changed field with old/new values, with rows tone-tinted to highlight differences → actions: Close.

---

## Batch 4 — Trading Credentials, Trader Comparison, Position Detail (Live), Bridge Sync Log, Trader Audit Log

### Trading Credentials (view-id: `trading-credentials`) [EXISTING]

**Purpose**: Stitch-styled credentials view for the trader — connection details, master/investor passwords, platform downloads. The admin-side variant mirrors this but adds audit logging on every reveal.

**Layout** (top-to-bottom):
1. Security warning banner — rounded card with shield-lock icon, "Credential Security Notice" headline, body text about audit logging, right-side SSL badge with pulse dot.
2. Two-column grid (lg:col-span 6 / 6): left "Platform Connection Details" card, right "Account Access Passwords" card.
3. Platform download section — full-width card titled "Download & Launch Trading Platform" with 3 download tiles (Desktop, Web Terminal, Setup Guide).

**Section content**:
- **Platform Connection Details** card — header with "dns" icon, "Primary Routing" pill. Body: 4 stacked rows (Platform / Trading Server / Login Account ID / Server IP), each with label + value + copy button. Below: Connectivity Status row (animated pulse dot + "Server Online • Ping 14ms (London Equinix LD4)" + uptime badge). Below: Network Hop Distribution bar (LD4 → NY4 → FRA, segmented bar).
- **Account Access Passwords** card — header with "key" icon + "encrypted" icon. Body: Master Password sub-card (label, "High Security" badge, masked password display + Reveal/Hide/Copy buttons), Investor Password sub-card (label, "Auditor Safe" badge, masked password + toggle/copy), full-width "Download Credentials Card (PDF Encrypted)" button. Footer: lock-clock icon + auto-rotation notice.
- **Platform Download** card — 3 tiles in 3-column grid: Desktop (laptop_mac icon, "Download MT5 for Desktop", description, "Windows / macOS / Linux" + "Get App →" CTA), Web Terminal (web icon, "Launch MT5 Web Terminal", "Zero Setup • All Browsers" + "Launch →"), Setup Guide (menu_book icon, "Connection & Setup Guide", "PDF & Video Walkthrough" + "Read Guide →").

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- Copy buttons (4 — platform, server, login, IP) → toast "Copied" (fix: must call `navigator.clipboard.writeText`).
- "Reveal" Master Password (button with visibility icon) → AlertDialog (current: AlertDialog is already there; preserve).
- "Hide" Master Password (button, visible only when password revealed) → toggles state.
- "Copy" Master Password → toast (fix: clipboard).
- Investor Password toggle (eye icon button) → toggles state directly (current; preserve but add audit log).
- Investor Password Copy → toast.
- "Download Credentials Card (PDF Encrypted)" (full-width button) → toast + actual PDF download (fix: currently toast-only).
- Three download tile CTAs → toast (current) — fix: Desktop tile triggers actual MT5 installer download; Web Terminal opens new tab to MT5 web terminal with server prefilled; Setup Guide opens PDF.
- "Rotate Password" (new — destructive outline button in Master Password sub-card footer) → AlertDialog.

**Dialogs / Modals / Sheets**:
- Reveal Master Password AlertDialog (trigger: "Reveal" Master) → text: "This action will decrypt and display your live MT5 execution password on this monitor screen. This action is recorded in the Security Audit Log with your IP address and timestamp." → actions: Cancel / Reveal Password (with lock_open icon).
- Rotate Password AlertDialog (trigger: "Rotate Password") → form: New Password (input, generated, with regenerate button), Send to Trader (toggle, default on), Audit Reason (textarea, required) → actions: Cancel / Rotate.

---

### Trader Comparison (view-id: `trader-comparison`) [NEW]

**Purpose**: Side-by-side comparison of up to 4 traders — equity, win rate, P&L, breach count, account count — so ops can pick a winner or spot a copy-trading ring.

**Layout** (top-to-bottom):
1. Page header — title "Trader Comparison", subtitle "Side-by-side metrics for up to 4 traders.", icon (GitCompareArrows).
2. Trader picker card — 4-cell grid; each cell has a Trader select (or "Add trader" placeholder when empty); a small remove-X button on each selected trader.
3. Comparison grid — column-per-trader + first column for metric labels. Each row is a metric; cells in the same row are tone-tinted to show the best (positive tone) and worst (negative tone) value across the selected traders.
4. Equity curve overlay chart — area/line chart with one series per trader, 30-day window.
5. Recent breaches side-by-side — column-per-trader with last 5 breaches as small cards.

**Tables**:
- Comparison matrix (rendered as a styled table, not a DataTable): rows = Trader ID, Country, Joined, Status, Phase, Equity, Total P&L, Win Rate, Trades, Open Positions, Active Accounts, Funded Accounts, Open Breaches, KYC Status, Days Since Last Trade. | columns: Metric label + one per selected trader.

**Forms**:
- Trader picker form: 4× Trader Select (with searchable dropdown).

**Actions** (buttons + behavior):
- "Add trader" (placeholder cell) → opens search-driven Sheet to pick a trader.
- Remove-X per trader column → removes that trader from the comparison.
- "Export comparison" (header outline) → CSV of the matrix + toast.
- "Schedule weekly comparison report" (header ghost) → Sheet.

**Dialogs / Modals / Sheets**:
- Pick Trader Sheet (trigger: "Add trader" placeholder) → form: search input + matching trader list (avatar, name, email, country, equity) + radio selection → actions: Cancel / Add to Comparison.
- Schedule Report Sheet (trigger: "Schedule weekly comparison report") → form: Cadence (radio: Weekly / Monthly), Recipients (chip-input of emails), Format (radio: CSV / PDF) → actions: Cancel / Schedule.

---

### Position Detail (Live) (view-id: `position-detail-live`) [NEW]

**Purpose**: A dedicated page for inspecting a single open position in depth — equivalent of closed-position-detail but for live trades. Currently only exists as an inline expansion on Open Positions.

**Layout** (top-to-bottom):
1. Breadcrumb — "Open Positions › {position id}".
2. Header row — icon tile, title (position id mono + symbol), description (symbol description), right-side badges (direction badge, "OPEN" state badge), action cluster: "Modify SL/TP" outline, "Close at Market" destructive.
3. KPI strip — 5 cards: Volume, Entry Price, Current Price, Unrealized P&L (tone-tinted), P&L % (tone-tinted).
4. Mini equity sparkline card — small area chart showing the position's price history since open.
5. Two-column form grid — Identity, Volume & Pricing, Timing, Risk, Audit, Flags (6 cards same shape as closed-position-detail but with editable SL/TP fields and live current-price).

**Section content** (mirror closed-position-detail):
- Identity — UID, Trader (link-button), Account (link-button), Direction (badge), State (read-only "OPEN"), Symbol (read-only), Symbol Description (read-only), Position Type (read-only Market/Pending), Entry Type (read-only In/Out).
- Volume & Pricing — Volume (read-only), Open Price (read-only mono), Current Price (read-only mono, refreshes every few seconds), Swap (read-only), Commission (read-only).
- Timing — Open Time (read-only), Hold Duration (read-only, computed live), Server Time (read-only, live).
- Risk — Stop Loss (input, editable), Take Profit (input, editable), RR Ratio (read-only, computed).
- Audit — Open Order ID (read-only mono), Bridge Sync Status (status badge), Last Bridge Update (read-only date-time).
- Flags — Is Partial (read-only Switch), Copy Trading Flag (Switch), News Window Active (Switch, read-only).

**Tables**: none.

**Forms**:
- Risk form: Stop Loss (number input), Take Profit (number input) + "Save SL/TP" button.

**Actions** (buttons + behavior):
- "Modify SL/TP" (header outline) → toggles inline edit on Risk section + opens Sheet for batch edits.
- "Close at Market" (header destructive) → AlertDialog.
- "Save SL/TP" (in Risk section footer) → toast.
- "Notify Trader" (new — outline button in header) → Sheet.
- "View Account" (new — ghost link in Identity section) → navigate to `account-workspace`.
- "View Trade Replay" (new — ghost button in header) → opens Replay Sheet (step-through of every tick since open).

**Dialogs / Modals / Sheets**:
- Close at Market AlertDialog (trigger: "Close at Market") → text: "Close {side} {volume} {symbol} on login {login}? Estimated fill at current market ({price}). Slippage may apply." → form: Volume to Close (input, default = full, with "Partial" toggle), Reason (textarea, optional) → actions: Cancel / Close at Market.
- Modify SL/TP Sheet (trigger: "Modify SL/TP") → form: Stop Loss (number input, optional), Take Profit (number input, optional), Audit Reason (textarea, required) → actions: Cancel / Save.
- Notify Trader Sheet (trigger: "Notify Trader") → form: Channel (radio: Email / Push / In-app), Subject (input), Body (textarea), Urgency (radio: Info / Warning / Critical) → actions: Cancel / Send.
- Trade Replay Sheet (trigger: "View Trade Replay") → content: scrollable tick-by-tick chart of the position's price since open with play/pause/scrubber controls + per-tick P&L readout + close button.

---

### Bridge Sync Log (view-id: `bridge-sync-log`) [NEW]

**Purpose**: Dedicated log of every bridge sync attempt across every account — referenced by Account Broker Details but currently has no view of its own.

**Layout** (top-to-bottom):
1. Page header — title "Bridge Sync Log", subtitle "Every sync attempt between the platform and broker bridges.", icon (Cable).
2. KPI strip — 5 cards: Total Syncs (24h), Successful, Failed, Avg Latency, Last Failure (date-time).
3. Filter bar — card row: Account Login (search input), Bridge Status (select: All / Connected / Disconnected), Outcome (select: All / Success / Failure / Partial), Date Range (select), Clear button, result-count text.
4. Card containing the sync log table.

**Tables**:
- Bridge Sync Log table: Timestamp (date-time), Account Login (mono, link-button → account-workspace), Bridge (text: MT5-Alpha / MT5-Beta / DXTrade), Direction (badge: Pull / Push), Outcome (status badge: Success / Partial / Failure), Latency (ms, numeric), Records Pulled (numeric — positions / orders / history counts), Duration (ms), Error (text — empty when success, otherwise short error code + tooltip with full stack). | row actions: kebab → "View Account" (navigate), "Replay Sync" (toast with progress sheet), "Copy Error JSON" (toast).

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV of filtered log.
- "Replay Selected" (new — outline button in filter bar, enabled when ≥ 1 row selected via checkbox column) → opens Replay Sheet.
- "Retry Failed" (new — destructive outline button in header) → AlertDialog.
- Row click → opens Sync Detail Sheet.
- Filter dropdowns → standard shadcn Selects.

**Dialogs / Modals / Sheets**:
- Sync Detail Sheet (trigger: row click) → content: full sync payload (start time, end time, duration, request type, request payload JSON, response payload JSON, error stack if any, records pulled breakdown) + footer actions: "Replay Sync" (toast), "Copy Request JSON" (toast), "Copy Response JSON" (toast), "View Account" (navigate).
- Replay Sync Sheet (trigger: "Replay Selected" or kebab → "Replay Sync") → content: progress list (1. Connecting, 2. Authenticating, 3. Fetching positions, 4. Fetching orders, 5. Reconciling) + Cancel button.
- Retry Failed AlertDialog (trigger: "Retry Failed") → text: "Retry {N} failed syncs? Each will be re-queued and processed in order. Failures will be re-logged." → actions: Cancel / Retry {N}.

---

### Trader Audit Log (view-id: `trader-audit-log`) [NEW]

**Purpose**: Dedicated per-trader audit timeline page — every action that touched the trader record, accounts, positions, payouts, KYC, and risk flags. Currently surfaced only as a tab inside trader-detail; this page provides the full unbounded view with filters.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to {trader name}".
2. Page header — title "Trader Audit Log — {trader name}", subtitle "{email} · {country}", icon (History), right-side "Export CSV" outline + "Subscribe" ghost.
3. Entity header — title {trader name}, subtitle "Showing {N} events across all related entities", badges (status badge, phase badge, "Trader ID: {id}" mono badge).
4. KPI strip — 5 cards: Total Events (30d), By Actor (count of distinct actors), By Source System (count of distinct source systems — Platform / Risk Engine / AI Engine / Bridge / Manual), Latest Event (date-time), Open Breaches.
5. Filter bar — card row: search input, 5 dropdowns (Event Type, Actor, Source System, Entity Type, Date Range), Clear button, result-count text.
6. Card containing the timeline.

**Tables**: none — rendered as an ActivityTimeline component (vertical timeline with icons, timestamps, actor avatars, and per-event detail cards).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- "Subscribe" (header ghost) → opens Subscription Sheet (same as Account Events).
- Per-event "View related entity" button → navigate to the appropriate detail page (trader-detail, account-workspace, breach-detail, payout-detail, etc.).
- Filter dropdowns → standard shadcn Selects.
- "Compare to previous period" (new — toggle in filter bar) → splits the timeline into two columns (current vs previous period).

**Dialogs / Modals / Sheets**:
- Subscription Sheet — same shape as Account Events subscription.

---

## Batch 5 — MT4/DXTrade Server Config Catalog, Bulk Account Operations, Challenges Overview, Active Challenges, Passed Challenges

### MT4/DXTrade Server Config Catalog (view-id: `mt4-dxtrade-server-catalog`) [NEW]

**Purpose**: Admin-side catalog of every broker server (MT5-Alpha, MT5-Beta, DXTrade, etc.) — connection params, credential rotation schedule, live health.

**Layout** (top-to-bottom):
1. Page header — title "Server Catalog", subtitle "MT5 / MT4 / DXTrade server configurations and live health.", icon (Server), right-side "Add Server" primary button.
2. KPI strip — 5 cards: Total Servers, Healthy (positive tone), Degraded (warning), Offline (negative), Avg Latency.
3. Filter bar — card row: search input, Platform (select: All / MT5 / MT4 / DXTrade / MatchTrader), Health (select: All / Healthy / Degraded / Offline), Region (select), Clear button, result-count text.
4. Card grid — 3-column grid of server cards (one per server).

**Server card content**:
- Header row: server icon, server name (mono), "Primary" pill badge if primary, health dot (positive/warning/negative).
- Body: 4-cell grid — Platform, Region, Endpoint (mono, with copy button), Port (mono).
- Live metrics row: Latency (ms), Uptime %, Last Heartbeat (date-time, muted).
- Connection stats: Active Accounts (numeric), Active Sessions (numeric), Daily Syncs (numeric).
- Footer actions row: "Edit" outline, "Test Connection" outline, "Rotate Credentials" destructive outline, "View Log" ghost.

**Tables**: none on the page surface (cards).

**Forms**: none.

**Actions** (buttons + behavior):
- "Add Server" (header primary) → opens Sheet.
- Per-card "Edit" → opens Edit Server Sheet.
- Per-card "Test Connection" → toast + opens Connection Test Sheet with progress (1. Resolving DNS, 2. TCP connect, 3. Auth handshake, 4. Ping measurement).
- Per-card "Rotate Credentials" → AlertDialog.
- Per-card "View Log" → navigate to `bridge-sync-log` filtered to this server.
- Per-card "Copy endpoint" (new — ghost icon button) → toast.
- Bulk-select checkbox on each card (new) enables bulk bar: "Test Selected" (toast + sheet), "Rotate Credentials for Selected" (alert dialog).

**Dialogs / Modals / Sheets**:
- Add Server Sheet (trigger: "Add Server") → form: Server Name (input, required), Platform (select, required), Region (select, required), Endpoint Host (input, required), Port (number input, required), API Username (input, required), API Password (input, masked, required), Is Primary (toggle), Heartbeat Interval seconds (number, default 30) → actions: Cancel / Add Server.
- Edit Server Sheet (trigger: "Edit" per card) → same form as Add, prefilled, plus "Archive" destructive button.
- Rotate Credentials AlertDialog (trigger: "Rotate Credentials") → form: New API Password (input, generated, with regenerate button), Acknowledge Active Sessions Will Be Reconnect (checkbox, required), Schedule (radio: Now / Next Maintenance Window) → actions: Cancel / Rotate.
- Connection Test Sheet (trigger: "Test Connection") → content: 4-step progress list + per-step status + final latency readout → actions: Close.

---

### Bulk Account Operations (view-id: `bulk-account-operations`) [NEW]

**Purpose**: Focused workflow for applying one operation to many accounts at once — block, reset, sync, archive, change label, change profit split.

**Layout** (top-to-bottom):
1. Page header — title "Bulk Account Operations", subtitle "Apply an operation to multiple accounts in one transaction.", icon (Layers3), right-side "Operation History" ghost.
2. Step indicator card — 4-step horizontal indicator: Select Accounts, Choose Operation, Configure, Review & Execute.
3. Step content card — renders the active step.
4. Footer nav — ghost Back, "Step X of 4" center, primary Next / Execute.

**Step content**:
- **Step 1 — Select Accounts** — FilterBar (status, platform, phase, country, date-range) + DataTable with checkbox column (Login, Trader, Platform, Phase, Balance, Status) + selection summary card ("X accounts selected, total equity $Y").
- **Step 2 — Choose Operation** — 6-cell grid of large operation cards: Block, Reset, Sync, Archive, Change Label, Change Profit Split. Each card is a radio-button selection.
- **Step 3 — Configure** — varies by chosen operation: Block → textarea reason + checkbox "Close positions at market" + checkbox "Notify traders"; Reset → textarea reason + checkbox "Acknowledge data loss" + checkbox "Notify traders"; Sync → toggle "Force full re-sync" + select "Priority (Low/Normal/High)"; Archive → textarea reason + checkbox "Move to archive tenant"; Change Label → select new label + textarea reason; Change Profit Split → number input new split + date input effective from + textarea reason.
- **Step 4 — Review & Execute** — summary card listing: operation, target accounts (count + total equity), parameters (per the chosen operation), expected impact, audit reason. Accent-bordered callout with "Execute Bulk Operation" primary button.

**Tables**:
- Step 1 accounts table: Checkbox, Login (mono), Trader, Platform, Phase, Balance, Status | no per-row actions (selection only).

**Forms**:
- Step 1 filter form (described above).
- Step 3 operation form (varies — described above).
- Step 4 has no editable fields.

**Actions** (buttons + behavior):
- "Operation History" (header ghost) → navigate to a history list (renders as a Sheet with last 20 bulk operations).
- "Back" / "Next" / "Execute Bulk Operation" (footer) → step navigation; Execute → AlertDialog.
- Per-row checkbox toggle on Step 1.
- "Select all filtered" / "Clear selection" buttons on Step 1.

**Dialogs / Modals / Sheets**:
- Execute AlertDialog (trigger: "Execute Bulk Operation") → text: "Apply {operation} to {N} accounts? Total equity impacted: ${total}. This action is logged in the audit trail. Some operations are irreversible." → checkbox "I acknowledge the consequences" (required) → actions: Cancel / Execute Now.
- Operation History Sheet (trigger: "Operation History") → content: scrollable list of last 20 bulk operations (date-time, operation type, target count, actor, outcome) with row click → toast with summary.

---

### Challenges Overview (view-id: `challenges`) [EXISTING]

**Purpose**: Landing view for the Challenges module — KPI strip, attention center, evaluation funnel, full challenges table.

**Layout** (top-to-bottom):
1. Page header — title "Challenges", subtitle "Trader evaluation phases.", icon (Target), right-side "Create Challenge" primary button (new).
2. KPI strip — 6 cards in 2×3 / 6-column grid: Active (warning), Passed (positive), Failed (negative when > 0), Pass Rate (tone-tinted), Avg Progress, Total.
3. Attention Center card — centralized attention model widget (preserved).
4. Evaluation Funnel card — 4-stage horizontal bar chart: Started → Phase 1 Passed → Phase 2 Passed → Funded. Each stage shows count + % of started + drop count from previous.
5. Card containing the challenges table.

**Tables**:
- Challenges table: Trader, Challenge, Phase (badge), Account Size (currency), Profit Target (currency), Current Profit (currency, tone-tinted), Progress (mini progress bar + %), Days Left (text), Status (status badge). | row actions (new): kebab → "View Detail" (navigate to challenge-edit), "Extend Time" (alert dialog), "Force Fail" (alert dialog, destructive), "Force Pass" (alert dialog), "Issue Payout" (sheet), "Generate Certificate" (toast + PDF).

**Forms**: none.

**Actions** (buttons + behavior):
- "Create Challenge" (header primary, new) → navigate to `challenge-wizard`.
- Row click → navigate to `challenge-edit` with id (fix: currently no navigation).
- Date-range selector (new — pill toggle in funnel card header): 7d / 30d / 90d / All time.
- Funnel stage click → drill-down to filtered challenges-active / challenges-passed / challenges-failed with stage-matching filter.
- Per-row kebab → as above.

**Dialogs / Modals / Sheets**:
- Extend Time AlertDialog (trigger: kebab → Extend Time) → form: Days to Add (number, required), Reason (textarea, required), Notify Trader (toggle, default on) → actions: Cancel / Extend.
- Force Fail AlertDialog (trigger: kebab → Force Fail) → text: "Force-fail {trader}'s {challenge}? This is irreversible. The account will be marked as failed and the trader notified." → form: Reason (textarea, required), Notify Trader (toggle, default on) → actions: Cancel / Force Fail.
- Force Pass AlertDialog (trigger: kebab → Force Pass) → text: "Force-pass {trader}'s {challenge}? The account will advance to the next phase automatically. This is logged." → form: Reason (textarea, required), Skip KYC Check (toggle) → actions: Cancel / Force Pass.
- Issue Payout Sheet (trigger: kebab → Issue Payout) → form: Amount (input, prefilled with current profit), Method (select: Crypto / Bank / PayPal), Notes (textarea) → actions: Cancel / Issue Payout.
- Generate Certificate (trigger: kebab → Generate Certificate) → toast + PDF download.

---

### Active Challenges (view-id: `challenges-active`) [EXISTING]

**Purpose**: Filtered DataTable view of currently in-progress evaluations.

**Layout** (top-to-bottom):
1. Page header — title "Active Challenges", subtitle "Currently in-progress evaluations.", icon (Flame).
2. Card containing the challenges table (filtered to status = in-progress).

**Tables**:
- Challenges table (same columns as Challenges Overview): Trader, Challenge, Phase, Account Size, Profit Target, Current Profit, Progress, Days Left, Status. | per-row kebab menu (new): Extend Time (alert dialog), Force Fail (alert dialog), Force Pass (alert dialog), Add Note (sheet), Notify Trader (sheet).

**Forms**: none.

**Actions** (buttons + behavior):
- Row click → navigate to `challenge-edit` with id (fix).
- Per-row kebab → as above.
- "Bulk Extend" (new — outline button in header, enabled when ≥ 1 row selected via checkbox column) → opens Bulk Extend Sheet.
- Filter chip row (new) above the table: Phase (All / Phase 1 / Phase 2 / Funded), Days Left (All / <7 days / <3 days / Expired), Account Size (All / $5k / $10k / $25k / $50k / $100k).

**Dialogs / Modals / Sheets**:
- Extend Time, Force Fail, Force Pass AlertDialogs — same shape as Challenges Overview.
- Add Note Sheet (trigger: kebab → Add Note) → form: Note (textarea), Pin to Top (toggle), Visibility (radio: Internal Only / Visible to Trader) → actions: Cancel / Save Note.
- Notify Trader Sheet (trigger: kebab → Notify Trader) → form: Channel (radio: Email / Push / In-app), Subject (input), Body (textarea), Urgency (radio: Info / Warning / Critical) → actions: Cancel / Send.
- Bulk Extend Sheet (trigger: "Bulk Extend") → form: Days to Add (number, required), Reason (textarea, required), Notify All Affected Traders (toggle, default on) → actions: Cancel / Extend {N}.

---

### Passed Challenges (view-id: `challenges-passed`) [EXISTING]

**Purpose**: Filtered DataTable view of passed evaluations (including funded accounts).

**Layout** (top-to-bottom):
1. Page header — title "Passed Challenges", subtitle "Successfully completed evaluations.", icon (Trophy).
2. Card containing the challenges table (filtered to status = passed or phase = funded).

**Tables**:
- Challenges table (same columns as Challenges Overview). | per-row kebab menu (new): Issue Payout (sheet), Generate Certificate (toast + PDF), Offer Retry (alert dialog), Reset to Phase 1 (alert dialog), Archive (alert dialog), Mark as Funded (alert dialog).

**Forms**: none.

**Actions** (buttons + behavior):
- Row click → navigate to `challenge-edit` with id (fix).
- Per-row kebab → as above.
- "Bulk Issue Payouts" (new — outline button in header, enabled when ≥ 1 row selected) → opens Bulk Payout Sheet.
- "Export" (header outline) → CSV.
- Filter chip row (new): Phase, Account Size, Funded Date Range.

**Dialogs / Modals / Sheets**:
- Issue Payout Sheet — same shape as Challenges Overview.
- Generate Certificate — same shape (toast + PDF).
- Offer Retry AlertDialog (trigger: kebab → Offer Retry) → text: "Offer {trader} a retry of {challenge}? A new evaluation account will be provisioned at no cost." → form: Discount % (number, default 100), Message to Trader (textarea) → actions: Cancel / Offer Retry.
- Reset to Phase 1 AlertDialog (trigger: kebab → Reset to Phase 1) → text: "Reset {trader}'s {challenge} back to Phase 1? All progress in subsequent phases will be lost." → form: Reason (textarea, required), Acknowledge Data Loss (checkbox, required) → actions: Cancel / Reset.
- Archive AlertDialog (trigger: kebab → Archive) → text: "Archive {trader}'s {challenge}? It will be removed from active views but kept in audit history." → actions: Cancel / Archive.
- Mark as Funded AlertDialog (trigger: kebab → Mark as Funded) → text: "Mark {trader}'s {challenge} as Funded? This will provision a live funded account and trigger the payout setup flow." → form: Funded Account Size (input, default = original size), Profit Split % (input, default = challenge default) → actions: Cancel / Mark as Funded.
- Bulk Payout Sheet (trigger: "Bulk Issue Payouts") → form: Method (select), Batch Reference (input, generated), Notes (textarea) → actions: Cancel / Issue {N} Payouts.

---

## Batch 6 — Failed Challenges, Create Wizard, Challenge Types, Configuration, Phase Management

### Failed Challenges (view-id: `challenges-failed`) [EXISTING]

**Purpose**: Filtered DataTable view of failed evaluations — for re-engagement campaigns.

**Layout** (top-to-bottom):
1. Page header — title "Failed Challenges", subtitle "Evaluations that did not pass.", icon (Target).
2. Card containing the challenges table (filtered to status = failed).

**Tables**:
- Challenges table (same columns as Challenges Overview). | per-row kebab menu (new): Offer Retry (alert dialog), Reset Account (alert dialog), Refund (sheet), Add to Re-engagement Campaign (sheet), Add Note (sheet), Archive (alert dialog).

**Forms**: none.

**Actions** (buttons + behavior):
- Row click → navigate to `challenge-edit` with id (fix).
- Per-row kebab → as above.
- "Bulk Offer Retry" (new — outline button in header, enabled when ≥ 1 row selected) → opens Bulk Retry Sheet.
- "Export" (header outline) → CSV.
- Filter chip row (new): Failure Reason (All / Drawdown / Time Limit / Manual / Other), Days Since Failure, Account Size.

**Dialogs / Modals / Sheets**:
- Offer Retry, Reset Account, Archive AlertDialogs — same shape as Active/Passed Challenges.
- Refund Sheet (trigger: kebab → Refund) → form: Amount (input, prefilled with entry fee), Method (select: Original Method / Wallet Credit / Bank Wire), Reason (textarea, required), Notify Trader (toggle, default on) → actions: Cancel / Issue Refund.
- Re-engagement Campaign Sheet (trigger: kebab → Add to Re-engagement Campaign) → form: Campaign (select of existing campaigns or "Create New"), Send Discount (toggle, default on), Discount % (number, conditional), Send Date (date), Message (textarea) → actions: Cancel / Add to Campaign.
- Add Note Sheet — same shape as Active Challenges.
- Bulk Retry Sheet (trigger: "Bulk Offer Retry") → form: Discount % (number, default 50), Message (textarea), Notify All (toggle, default on) → actions: Cancel / Offer Retries to {N}.

---

### Create Wizard (view-id: `challenge-wizard`) [EXISTING]

**Purpose**: 7-step guided wizard to create a new challenge template end-to-end.

**Layout** (top-to-bottom):
1. Page header — title "Create Challenge", subtitle "Guided wizard to configure a new evaluation challenge template.", icon (Sparkles).
2. Step indicator card — 7 numbered circles with connecting bars (Type, Phase 1, Phase 2, Trading, Payout, Risk, Review).
3. Step content card — renders the active step.
4. Footer nav — ghost Back, "Step X of 7" center, primary Next / Create Challenge.

**Step content**:
- **Step 1 — Select challenge type** — 3-column grid of selectable type cards (icon, name, description, badges for phases/free-trial/competition/active), with "Selected — defaults applied" inline confirmation on the chosen card.
- **Step 2 — Phase 1 (Evaluation)** — 3-column grid of required inputs: Account Size (USD), Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days. Smart defaults pulled from the selected type.
- **Step 3 — Phase 2 (Verification)** — same form as Step 2 (or NoticeCard when the selected type only has 1 phase).
- **Step 4 — Trading Rules** — 3 toggle rows: News Trading (Allow / Block segmented toggle), Weekend Trading (Allow / Block segmented toggle), Copy Trading Detection (Switch + description).
- **Step 5 — Payout Rules** — 2-column grid: Profit Split % (input with live split hint), Payout Frequency (select), Payout Methods (multi-chip toggle: Crypto (USDT) / Card (Stripe) / Fiat (Bank)).
- **Step 6 — Risk Rules** — 2-column grid: Max Daily Loss %, Max Overall Loss %. Below: 3-card grid for Trailing Drawdown Type (Static / Trailing / Relative — radio-card selection).
- **Step 7 — Review** — title "Review & Create", subtitle, summary card listing ~14 rows (Challenge Type, Phases, Phase 1 fields, Phase 2 fields, Trading Rules, Payout Rules, Risk Rules) in a 2-column dl. Accent-bordered callout with ShieldCheck icon + confirmation text + "Create Challenge" primary button.

**Tables**: none.

**Forms**: per step content above.

**Actions** (buttons + behavior):
- "Back" (footer ghost, disabled on step 1) → previous step.
- "Next" (footer primary, disabled until step-valid) → next step.
- "Create Challenge" (footer primary, step 7) → toast + reset state.
- "Save Draft" (new — ghost button on the left of the footer) → toast.
- "Load from existing template" (new — link in step 1 header) → opens Template Sheet.
- "Preview as Trader" (new — outline button in step 7 header) → opens Marketplace Preview Sheet (renders Challenge Marketplace Preview screen inline).
- "Export/Import Configuration JSON" (new — outline button in step 7 header) → toast + JSON download / file picker.
- "Version History" (new — ghost link in step 7 header) → opens Version History Sheet.

**Dialogs / Modals / Sheets**:
- Template Sheet (trigger: "Load from existing template") → list of saved templates with radio selection + Preview link → actions: Cancel / Apply Template.
- Marketplace Preview Sheet (trigger: "Preview as Trader") → content: render of the Challenge Marketplace Preview screen (see Batch 7) inline in a Sheet → actions: Close.
- Version History Sheet (trigger: "Version History") → content: scrollable list of versions with diff cells + "Revert to Version" outline button per row → actions: Close.

---

### Challenge Types (view-id: `challenge-types`) [EXISTING]

**Purpose**: Card-grid catalog of every challenge type with active toggle + edit.

**Layout** (top-to-bottom):
1. Page header — title "Challenge Types", subtitle "Catalog of evaluation programs available to traders. Toggle availability or edit phase configuration.", icon (Layers), right-side "Add Challenge Type" primary button.
2. 3-column card grid — one ChallengeTypeCard per type.
3. Footer help text.

**ChallengeTypeCard content**:
- Header row: icon-tile (TypeIcon, type-specific), title + description (line-clamped 2-line), active toggle Switch on the right.
- Badges row: phases badge, Free Trial badge (when present), Competition badge (when present), Active/Disabled badge.
- Footer row: type id (muted text), "Edit" outline button.

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- "Add Challenge Type" (header primary) → opens Sheet (currently toast-stub).
- Per-card active Switch → toast (currently) → fix: AlertDialog confirm for disable, instant for enable.
- Per-card "Edit" → navigate to `challenge-config` with typeId.
- Per-card "Duplicate" (new — ghost icon button in footer) → toast + duplicate card appears.
- Per-card "Archive" (new — ghost icon button in footer) → AlertDialog.
- Per-card "Preview in Marketplace" (new — ghost link in footer) → opens Marketplace Preview Sheet.

**Dialogs / Modals / Sheets**:
- Add Challenge Type Sheet (trigger: "Add Challenge Type") → form: Name (input, required), Description (textarea), Icon (select from icon library), Number of Phases (number, 1-5, default 2), Has Free Trial (toggle), Is Competition (toggle), Default Active (toggle, default on) → actions: Cancel / Create & Edit (navigates to challenge-config).
- Disable Confirm AlertDialog (trigger: active Switch → off) → text: "Disable {type}? Traders will no longer be able to purchase this challenge type. Existing in-progress accounts are unaffected." → actions: Cancel / Disable.
- Archive AlertDialog (trigger: "Archive" per card) → text: "Archive {type}? It will be removed from the catalog but existing accounts continue to function." → actions: Cancel / Archive.
- Marketplace Preview Sheet — same as in Create Wizard.

---

### Configuration (view-id: `challenge-config`) [EXISTING]

**Purpose**: Split-view — left list of challenge types, right phase-config editor with collapsible advanced rules.

**Layout** (top-to-bottom):
1. Page header — title "Challenge Configuration", subtitle "Edit phase parameters, risk limits, and trading rules for each challenge type.", icon (Settings2), right-side "Add Challenge Type" primary button.
2. 2-column grid (lg:col-span 5 / 7):
   - Left: card with "Challenge Types" header + DataTable (Type, Phases, Active toggle, Edit button) + "Open Challenge Types catalog" ghost link at bottom.
   - Right: ConfigEditor panel — header card (type name + description + phases count badge) + per-phase PhaseConfigCard list + footer action row (Save Changes primary + Reset to Defaults outline).

**PhaseConfigCard content**:
- Header row: "Phase {order}" colored pill + phase name + Funded badge (when applicable) + account size text.
- Basic config grid (3-cell): Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split % (each as number input with suffix where applicable + LabelWithHelp tooltip).
- Advanced disclosure (collapsible): 4 sub-sections in 2-column grid:
  - Trading Rules: News Trading (toggle), Hold Over Weekend (toggle), Allow EA Trading (toggle).
  - News Trading: Block NFP (toggle), Block FOMC (toggle), News Window min (input).
  - Weekend Rules: Close on Friday (toggle), Friday Cutoff HH:MM (input).
  - Other Limits: Max Daily Trades (input), Max Lot Size (input), Require Stop-Loss (toggle).

**Tables**:
- Challenge Types list table: Challenge Type (with badges), Phases (numeric), Active (Switch), Actions (Edit button). | row click → loads that type into the editor.

**Forms**:
- Phase Config form (per phase): Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split %, plus all Advanced disclosure fields.

**Actions** (buttons + behavior):
- "Add Challenge Type" (header primary) → opens Sheet (currently toast-stub).
- Row click on left list → loads type into right editor.
- "Edit" per-row on left list → same as row click.
- Per-phase Advanced disclosure chevron → expands/collapses.
- "Save Changes" (footer primary) → toast.
- "Reset to Defaults" (footer outline) → toast.
- "Add Phase" (new — outline button in ConfigEditor header next to phases-count badge) → opens Add Phase Sheet.
- "Duplicate Challenge Type" (new — ghost button in ConfigEditor header) → toast + duplicate.
- "Test Configuration" (new — outline button in footer) → opens Test Sheet with dry-run against sample account.

**Dialogs / Modals / Sheets**:
- Add Challenge Type Sheet — same as Challenge Types page.
- Add Phase Sheet (trigger: "Add Phase") → form: Phase Name (input, required), Phase Order (number, auto-suggested), Is Funded (toggle), Account Size (number), Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split % → actions: Cancel / Add Phase.
- Test Configuration Sheet (trigger: "Test Configuration") → form: Sample Account Size (number), Test Scenario (select: Pass / Fail / Drawdown Breach) → "Run Test" button → content: simulated outcome (final balance, drawdown hit, P&L, pass/fail verdict) → actions: Close.

---

### Phase Management (view-id: `phase-management`) [EXISTING]

**Purpose**: Tabular overview of every phase config across every challenge type, with inline expansion for quick edits.

**Layout** (top-to-bottom):
1. Page header — title "Phase Management", subtitle "Configure evaluation phases for challenge types", icon (Layers), right-side "Add Phase" primary button.
2. Card containing the phases table with toolbar.

**Tables**:
- Phases table: Challenge Type, Phase (order badge + name), Account Size (currency), Profit Target %, Max DD %, Daily DD %, Profit Split %, Funded (status badge). | row click → expands inline PhaseDetailPanel below the table for editing. Toolbar contains a challenge-type Select filter.

**Forms**:
- PhaseDetailPanel (inline expansion) — 4-cell grid of inputs: Account Size, Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split %. Footer: Save button.

**Actions** (buttons + behavior):
- "Add Phase" (header primary) → opens Sheet (currently toast-stub).
- Filter Select in toolbar → narrows table.
- Row click → expands inline detail panel.
- "Save" (in inline panel footer) → toast.
- "Delete Phase" (new — destructive ghost button in inline panel footer) → AlertDialog.
- "Bulk operations" (new — outline button in toolbar, enabled when ≥ 1 row selected via checkbox column) → navigate to Bulk Phase Editor.

**Dialogs / Modals / Sheets**:
- Add Phase Sheet — same shape as Challenge Configuration Add Phase Sheet.
- Delete Phase AlertDialog (trigger: "Delete Phase" in inline panel) → text: "Delete phase {phase name}? Accounts currently in this phase will need to be migrated to another phase. This cannot be undone." → form: Migrate Accounts To (select of remaining phases, required), Reason (textarea, required) → actions: Cancel / Delete & Migrate.

---

## Batch 7 — Edit Challenge, Phase Detail, Challenge Marketplace Preview, Challenge Comparison, Challenge Analytics

### Edit Challenge (view-id: `challenge-edit`) [EXISTING]

**Purpose**: 5-tab editor for a single challenge type — General, Phases, Payout Rules, Checkout, Review.

**Layout** (top-to-bottom):
1. Page header — title "Edit Challenge — {type name}", subtitle "Challenge type {index} of {total}. Configure phase parameters, payout rules, checkout integration, then review before publishing.", icon (Settings2), right-side "Back to Configuration" outline button.
2. Status strip — rounded bar with type name + phase count + step count + Free Trial / Competition badges + Phase Management ghost link + Challenge Types ghost link.
3. Tab strip — General, Phases, Payout Rules, Checkout, Review (each tab has an icon).
4. Tab content area — varies per tab (below).

**Tab content**:
- **General tab** — 4 SectionCards: Basic Info (Title, Challenge Type select, Description textarea, Steps Count number), Configuration Toggles (Swap Mode toggle-group, KYC Timing select, Archived switch, News Trading Enabled switch, Is Free Trial switch, Is Competition switch, Auto Upgrade on KYC switch, Pay-later checkbox), Drawdown Configuration (Max Drawdown Type toggle-group: Static / Trailing), Phases Summary (DataTable of phases with Edit button per row).
- **Phases tab** — DataTable of phases (Phase Name, Step, Account Size, Profit Target %, Max Drawdown %, Daily Drawdown %, Profit Split %, Funded status, Actions: Edit Phase button). Phase Flow Diagram SectionCard below the table (visual flowchart of phases). Configuration Summary SectionCard at the bottom.
- **Payout Rules tab** — 2 SectionCards: Profit Split (Profit Split %, Payout Frequency select, Partial Payout toggle) + Payout Limits (Min Payout Type toggle-group + Min Payout Value, Max Payout Type toggle-group + Max Payout Value).
- **Checkout tab** — 1 SectionCard: WooCommerce Product Mapping (Product ID input, Currency select, Activation Fee input, Price input).
- **Review tab** — summary of all configured fields in a dl grid + Publish / Save actions.

**Tables**:
- Phases Summary table (General tab): Phase Name (with order badge), Account Size, Profit Target %, Max Drawdown %, Daily Drawdown %, Profit Split %, Funded status, Edit Phase button. | per-row Edit Phase button → navigate to `phase-detail`.
- Phases tab table — same columns.

**Forms**:
- General tab form: Title, Challenge Type, Description, Steps Count, Swap Mode, KYC Timing, Archived, News Trading, Is Free Trial, Is Competition, Auto Upgrade KYC, Pay-later, Max Drawdown Type.
- Payout Rules form: Profit Split %, Payout Frequency, Partial Payout, Min Payout Type, Min Payout Value, Max Payout Type, Max Payout Value.
- Checkout form: Product ID, Currency, Activation Fee, Price.

**Actions** (buttons + behavior):
- "Back to Configuration" (header outline) → navigate to `challenge-config`.
- "Phase Management" (status strip ghost) → navigate to `phase-management`.
- "Challenge Types" (status strip ghost) → navigate to `challenge-types`.
- Per-row "Edit Phase" (Phases Summary / Phases tab) → navigate to `phase-detail`.
- "Add Phase" (new — outline button in Phases tab header) → opens Add Phase Sheet.
- "Save" / "Publish" (Review tab) → toast (fix: should navigate back to challenge-config on Publish).
- "Preview as Trader" (new — outline button in header) → opens Marketplace Preview Sheet.
- "Export Configuration JSON" / "Import Configuration JSON" (new — outline buttons in header) → toast + file download / file picker.
- "Version History" / changelog (new — ghost link in header) → opens Version History Sheet.

**Dialogs / Modals / Sheets**:
- Add Phase Sheet — same shape as Configuration page.
- Marketplace Preview Sheet — same shape as Create Wizard.
- Version History Sheet — same shape as Create Wizard.

---

### Phase Detail (view-id: `phase-detail`) [EXISTING]

**Purpose**: 3-tab editor for a single phase — General, Trading Platform IDs, Change History.

**Layout** (top-to-bottom):
1. Page header — title "Phase Detail — {phase name}", subtitle "Step {order} of {challenge name}. {Funded/Evaluation} phase. Configure risk rules, broker mappings, and review change history.", icon (GitBranch), right-side "Back to Phase Management" outline button.
2. Status strip — challenge name + phase order + Funded badge (when applicable) + profit target + max DD + daily DD.
3. Tab strip — General, Trading Platform IDs, Change History (each tab has an icon).
4. Tab content area.

**Tab content**:
- **General tab** — 3 SectionCards: Phase Metadata (Title input, Step Number input, Leverage input, Live Status select, Scaling Plan select), Risk Rules (Target Profit %, Daily Drawdown %, Maximum Drawdown %, Minimum Trading Days, Maximum Days / Time Limit, Trading-day Threshold number, Auto Pass switch), Platform Group Mapping (MT5 Group ID input, MT4 Group ID input, DXTrade Group ID input).
- **Trading Platform IDs tab** — DataTable of platform IDs with add/edit.
- **Change History tab** — ActivityTimeline of changes to this phase.

**Tables**:
- Trading Platform IDs table: Platform (MT5 / MT4 / DXTrade / MatchTrader), Group ID (mono), Server (mono), Leverage, Active (Switch), Actions (Edit, Delete). | per-row Edit + Delete.

**Forms**:
- Phase Metadata form: Title, Step Number, Leverage, Live Status, Scaling Plan.
- Risk Rules form: Target Profit %, Daily Drawdown %, Maximum Drawdown %, Minimum Trading Days, Maximum Days, Trading-day Threshold, Auto Pass.
- Platform Group Mapping form: MT5 Group ID, MT4 Group ID, DXTrade Group ID.

**Actions** (buttons + behavior):
- "Back to Phase Management" (header outline) → navigate to `phase-management`.
- "Save" / "Reset" / "Sync" (footer of General tab) → toast (fix: should provide feedback and re-render).
- Per-row "Edit" (Trading Platform IDs tab) → opens inline editor.
- Per-row "Delete" (Trading Platform IDs tab) → AlertDialog.
- "Add Platform ID" (new — outline button in Trading Platform IDs tab header) → opens Sheet.
- "Test Platform ID" (new — outline button per row) → opens Connection Test Sheet.
- "Duplicate Phase" (new — outline button in header) → toast + duplicate.

**Dialogs / Modals / Sheets**:
- Add Platform ID Sheet (trigger: "Add Platform ID") → form: Platform (select), Group ID (input, required), Server (select of servers from MT4/DXTrade Server Catalog), Leverage (input), Active (toggle) → actions: Cancel / Add.
- Delete Platform ID AlertDialog (trigger: per-row Delete) → text: "Delete {platform} group {group id}? Accounts using this group will need to be reassigned." → actions: Cancel / Delete.
- Connection Test Sheet (trigger: "Test Platform ID") → 4-step progress (DNS / TCP / Auth / Ping) + final latency → Close.

---

### Challenge Marketplace Preview (view-id: `challenge-marketplace-preview`) [NEW]

**Purpose**: What the trader sees when browsing the purchase catalog — used by admins to QA the trader-facing purchase experience before publishing a challenge type.

**Layout** (top-to-bottom):
1. Page header — title "Marketplace Preview", subtitle "Trader-facing catalog view of this challenge type.", icon (Store), right-side "Open Real Marketplace" ghost (deep-link to trader dashboard) + "Edit Challenge" outline (navigate to challenge-edit).
2. Hero card — challenge type name, tagline, key badges (phases, free trial, competition, payout split), price (with currency), CTA "Buy Now" button (preview-only).
3. Phase timeline — visual horizontal timeline showing each phase with key metrics (account size, profit target, max DD, min trading days, max days).
4. Risk rules summary card — daily loss, overall loss, trailing type, news trading, weekend trading.
5. Payout rules summary card — profit split, payout frequency, payout methods, min/max payout.
6. Reviews / social proof card — rating + count + sample review snippets (mocked).
7. FAQ accordion — 5-6 common trader questions.

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- "Open Real Marketplace" (header ghost) → opens trader dashboard marketplace in new tab.
- "Edit Challenge" (header outline) → navigate to `challenge-edit`.
- "Buy Now" (hero CTA, preview-only) → toast "Preview mode — no purchase will be processed".
- "Save as Default Preview" (new — ghost button in header) → toast.

**Dialogs / Modals / Sheets**: none.

---

### Challenge Comparison (view-id: `challenge-comparison`) [NEW]

**Purpose**: Side-by-side comparison of up to 3 challenge types — for ops to pick a winner before publishing or for traders (via support) to choose between plans.

**Layout** (top-to-bottom):
1. Page header — title "Challenge Comparison", subtitle "Side-by-side diff between challenge types.", icon (GitCompareArrows).
2. Picker card — 3-cell grid; each cell has a Challenge Type select (or "Add challenge type" placeholder).
3. Comparison matrix table — column per type + first column for metric labels; rows tone-tinted to highlight best value.
4. Phase-by-phase diff card — for each phase present in any of the selected types, a row showing each type's metric (or "—" when the type doesn't have that phase).
5. Pricing & payout card — price, profit split, payout frequency, payout methods side-by-side.

**Tables**:
- Comparison matrix: rows = Number of Phases, Free Trial, Competition, Account Sizes Available, Default Profit Target, Default Max Drawdown, Default Daily Drawdown, Default Min Trading Days, Default Max Days, Default Profit Split, Default Payout Frequency, News Trading Allowed, Weekend Trading Allowed, Copy Trading Detection, Trailing Drawdown Type, Swap Mode, KYC Timing, Active Status. | columns: Metric label + one per selected type.

**Forms**:
- Challenge Type picker form: 3× Challenge Type select.

**Actions** (buttons + behavior):
- "Add challenge type" (placeholder cell) → opens search Sheet.
- Remove-X per type column → removes that type.
- "Export comparison" (header outline) → CSV.
- "Schedule weekly comparison report" (header ghost) → Sheet.

**Dialogs / Modals / Sheets**:
- Pick Challenge Type Sheet (trigger: "Add challenge type") → form: search input + matching type list (name, description, badges) + radio selection → actions: Cancel / Add to Comparison.
- Schedule Report Sheet — same as Trader Comparison.

---

### Challenge Analytics (view-id: `challenge-analytics`) [NEW]

**Purpose**: Per-challenge-type analytics — pass rate, revenue, time-to-pass, drop-off per phase.

**Layout** (top-to-bottom):
1. Page header — title "Challenge Analytics", subtitle "Per-challenge-type trends in pass rate, revenue, and time-to-pass.", icon (BarChart3), right-side Challenge Type select + Date Range select.
2. KPI strip — 6 cards: Total Started, Pass Rate, Avg Time to Pass (days), Total Revenue, Total Payouts, Profit Margin.
3. Trends chart card — line chart with 3 series (Started / Passed / Failed) over the selected date range.
4. Funnel-by-phase card — horizontal bar chart with one bar per phase showing drop-off (% of starters reaching each phase).
5. Account-size distribution card — bar chart of accounts by size band ($5k / $10k / $25k / $50k / $100k).
6. Top failing reasons card — horizontal bar chart of failure reasons (Max Drawdown / Daily Drawdown / Time Limit / Manual / Other).
7. Per-phase detail table card — DataTable.

**Tables**:
- Per-phase detail table: Phase, Started, Passed, Failed, Pass Rate %, Avg Time to Pass (days), Avg Profit at Pass, Avg Drawdown at Fail, Drop-off %. | per-row: kebab → "View Phase Detail" (navigate to phase-detail), "Drill into Accounts" (navigate to challenges-active filtered to phase).

**Forms**:
- Header filter form: Challenge Type (select, required — defaults to first type), Date Range (select: 7d / 30d / 90d / 1y / All).

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV of per-phase detail.
- "Save View" (new — ghost button in header) → Sheet.
- Challenge Type select → re-filters all widgets.
- Date Range select → re-filters.
- Per-row kebab → as above.

**Dialogs / Modals / Sheets**:
- Save View Sheet (trigger: "Save View") → form: Name (input, required), Description (textarea), Make Default (toggle), Share with Team (toggle) → actions: Cancel / Save View.

---

## Batch 8 — Phase Migration Tool, Bulk Phase Editor, Risk Overview, Breaches, Risk Statistics

### Phase Migration Tool (view-id: `phase-migration-tool`) [NEW]

**Purpose**: Migrate existing in-progress accounts when phase rules change — preview impact, execute in batches.

**Layout** (top-to-bottom):
1. Page header — title "Phase Migration Tool", subtitle "Migrate in-progress accounts when phase rules change.", icon (GitMerge), right-side "Migration History" ghost.
2. Step indicator card — 4-step horizontal: Select Source Phase, Configure Target, Preview Impact, Execute.
3. Step content card.
4. Footer nav.

**Step content**:
- **Step 1 — Select Source Phase** — 2-column grid: Challenge Type select + Phase select. Below: card showing count of in-progress accounts in that phase + their total equity + KPI mini-cards (Active / In Drawdown / Near Time Limit).
- **Step 2 — Configure Target** — 2-column grid: Target Challenge Type select + Target Phase select. Below: "Rule Differences" diff card listing every field that differs between source and target (e.g. "Profit Target: 8% → 10%") with tone-tinted badges for severity.
- **Step 3 — Preview Impact** — card listing every in-progress account that will be affected (Login, Trader, Current Progress, New Progress after migration, Warnings). Filter checkbox row: "Only show accounts with > 50% progress", "Hide accounts in drawdown". Per-row warning icon when migration would lose progress.
- **Step 4 — Execute** — summary card: Source → Target, N accounts affected, Rule diff summary, Audit reason. Accent-bordered callout with "Execute Migration" primary button.

**Tables**:
- Preview Impact table: Login (mono), Trader, Current Phase, Current Progress %, Current Balance, New Phase, New Target %, Projected Progress %, Warnings (badge list). | per-row kebab → "Exclude from Migration" (toast), "View Account" (navigate).

**Forms**:
- Step 1 form: Challenge Type (select), Phase (select).
- Step 2 form: Target Challenge Type (select), Target Phase (select).
- Step 4 form: Audit Reason (textarea, required), Notify Affected Traders (toggle, default on), Dry Run (toggle, default off).

**Actions** (buttons + behavior):
- "Migration History" (header ghost) → opens History Sheet.
- "Back" / "Next" / "Execute Migration" (footer) → step navigation.
- Per-row "Exclude from Migration" (preview step kebab) → removes row from migration batch.
- Filter checkboxes on preview step → narrow the table.
- "Execute Migration" (footer primary, step 4) → AlertDialog.

**Dialogs / Modals / Sheets**:
- Execute Migration AlertDialog (trigger: "Execute Migration") → text: "Migrate {N} accounts from {source} to {target}? Progress will be recalculated against the new rules. Some accounts may immediately breach under the new limits. This is logged in the audit trail." → checkbox "Acknowledge irreversibility" (required) → actions: Cancel / Execute Migration.
- Migration History Sheet (trigger: "Migration History") → content: scrollable list of past migrations (date, source → target, account count, actor, outcome) → actions: Close.

---

### Bulk Phase Editor (view-id: `bulk-phase-editor`) [NEW]

**Purpose**: Apply one rule change across multiple phases at once — e.g. "set daily drawdown to 4% on every Phase 1 across every challenge type".

**Layout** (top-to-bottom):
1. Page header — title "Bulk Phase Editor", subtitle "Apply a single rule change across multiple phases.", icon (SquareStack), right-side "Edit History" ghost.
2. Step indicator card — 4-step: Select Phases, Choose Field, Configure, Review & Apply.
3. Step content card.
4. Footer nav.

**Step content**:
- **Step 1 — Select Phases** — FilterBar (challenge type filter, funded vs evaluation filter) + DataTable with checkbox column. Summary card showing selected count.
- **Step 2 — Choose Field** — 6-cell grid of field cards (Profit Target %, Max Drawdown %, Daily Drawdown %, Min Trading Days, Max Days, Profit Split %). Each card is a radio selection.
- **Step 3 — Configure** — varies by chosen field: number input + Apply To (radio: All Selected / Only Funded / Only Evaluation) + Preview of new value vs current value for first 5 selected phases.
- **Step 4 — Review & Apply** — summary card: field, new value, target phases count, current values summary (min/max/distribution). Accent-bordered callout with "Apply to {N} Phases" primary.

**Tables**:
- Step 1 phases table: Checkbox, Challenge Type, Phase Name, Account Size, current value of selected field, Funded status. | no per-row actions (selection only).

**Forms**:
- Step 1 filter form: Challenge Type (select), Phase Type (select: All / Funded / Evaluation).
- Step 2 picker (radio cards).
- Step 3 form: New Value (number input), Apply To (radio).

**Actions** (buttons + behavior):
- "Edit History" (header ghost) → opens History Sheet.
- "Back" / "Next" / "Apply to {N} Phases" (footer) → step navigation.
- Per-row checkbox toggle on Step 1.
- "Select all filtered" / "Clear selection" buttons on Step 1.
- "Apply to {N} Phases" (footer primary, step 4) → AlertDialog.

**Dialogs / Modals / Sheets**:
- Apply AlertDialog (trigger: "Apply to {N} Phases") → text: "Set {field} to {new value} on {N} phases? In-progress accounts will be re-evaluated against the new rule on next sync. Some accounts may immediately breach." → checkbox "Acknowledge: this affects in-progress accounts" (required) → actions: Cancel / Apply Now.
- Edit History Sheet (trigger: "Edit History") → content: list of past bulk edits (date, field, old → new, target count, actor) → Close.

---

### Risk Overview (view-id: `risk`) [EXISTING]

**Purpose**: Landing view for the Risk module — KPI strip, attention center, recent breaches table.

**Layout** (top-to-bottom):
1. Page header — title "Risk Management", subtitle "Monitor drawdown, risk scores, and breaches across all traders.", icon (ShieldCheck), right-side "Configure rules" outline button.
2. KPI strip — 6 cards: Open Breaches (warning), Critical (negative when > 0), Resolved 30d (positive), Platform Risk Score (tone-tinted: ≥80 negative, ≥70 warning, otherwise positive), At-Risk Accounts (warning), Total Exposure (warning).
3. Attention Center card.
4. Card containing recent breaches table.

**Tables**:
- Breaches table: Trader (link-button), Type (badge), Rule (text), Severity (status badge), Status (status badge), Triggered (date-time), Resolve (ghost button when open). | row click → navigate to `trader-detail` (fix: should navigate to `breach-detail`).

**Forms**: none.

**Actions** (buttons + behavior):
- "Configure rules" (header outline) → navigate to `risk-rules-editor` (new — currently toast-only).
- Per-row "Resolve" (ghost button when open) → AlertDialog (fix: should match bulk pattern, currently toast-only).
- Date-range selector (new — pill toggle in KPI strip area): 24h / 7d / 30d / 90d.
- Row click → navigate to `breach-detail` (new).
- Per-row "Reopen" (new — ghost button when resolved) → AlertDialog.
- Per-row "Escalate" (new — ghost icon button) → AlertDialog.
- Per-row kebab → "View Trade Replay" (sheet), "Suspend Trader" (alert dialog), "View Trader" (navigate).

**Dialogs / Modals / Sheets**:
- Resolve AlertDialog (trigger: per-row "Resolve") → form: Resolution Note (textarea, required), Action Taken (select: Trader Notified / Account Blocked / Manual Override), Notify Trader (toggle, default on) → actions: Cancel / Resolve Breach.
- Reopen AlertDialog (trigger: per-row "Reopen") → text: "Reopen breach {id}? The trader's account will be re-flagged and trading may be halted." → form: Reason (textarea, required) → actions: Cancel / Reopen.
- Escalate AlertDialog (trigger: per-row "Escalate") → form: Escalate To (select: Risk Officer / Compliance / Senior Management), Priority (radio: High / Critical), Note (textarea, required) → actions: Cancel / Escalate.
- Trade Replay Sheet (trigger: kebab → View Trade Replay) → content: scrollable tick-by-tick chart around the breach timestamp with breach threshold marker + Close button.
- Suspend Trader AlertDialog (trigger: kebab → Suspend Trader) → text: "Suspend {trader}? All open positions will be closed at market. Reversible from the trader profile." → actions: Cancel / Suspend.

---

### Breaches (view-id: `breaches`) [EXISTING]

**Purpose**: Full breaches list with filters + bulk actions.

**Layout** (top-to-bottom):
1. Page header — title "Breaches", subtitle "All rule violations across traders and accounts.", icon (ShieldAlert).
2. Card containing the breaches table with toolbar.

**Tables**:
- Breaches table: Trader (link-button → trader-detail), Type (badge), Rule (text), Severity (status badge), Status (status badge), Triggered (date-time), Actions (Resolve ghost button when open). | row click → navigate to `trader-detail` (fix: → `breach-detail`). Toolbar contains 4 filter Selects (Type, Severity, Status, Date Range) + result-count text + "Export" outline button + "Resolve open" outline button (AlertDialog).

**Forms**: none.

**Actions** (buttons + behavior):
- Filter Selects in toolbar → narrow table.
- "Export" (toolbar outline) → CSV of filtered breaches.
- "Resolve open" (toolbar outline, opens AlertDialog) → bulk resolve.
- Per-row "Resolve" (ghost button when open) → AlertDialog (fix: should be AlertDialog, currently toast-only).
- Row click → navigate to `breach-detail` (fix).
- Per-row kebab (new) → Reopen (alert dialog), Escalate (alert dialog), View Trade Replay (sheet), Suspend Trader (alert dialog).
- Bulk-select checkbox column (new) enables bulk bar: "Resolve Selected" (alert dialog), "Escalate Selected" (alert dialog), "Export Selected" (CSV).

**Dialogs / Modals / Sheets**:
- Bulk Resolve AlertDialog (existing) — text: "Resolve {N} open breach(es)? Their trader accounts will be released from breach hold and may resume trading. This action is logged and can be reversed per-row." → actions: Cancel / Resolve {N} breach(es).
- Per-row Resolve AlertDialog — same shape as Risk Overview.
- Reopen, Escalate, Trade Replay, Suspend Trader — same shapes as Risk Overview.
- Bulk Escalate AlertDialog (new — trigger: "Escalate Selected") → form: Escalate To (select), Priority (radio), Note (textarea, required) → actions: Cancel / Escalate {N}.

---

### Risk Statistics (view-id: `risk-statistics`) [EXISTING]

**Purpose**: 3-tab stats view — per-challenge-type, per-country, per-account-size-band — with date range + CSV export.

**Layout** (top-to-bottom):
1. Page header — title "Risk Analysis", subtitle "Challenge payout statistics, country breakdown, and account-size distribution.", icon (ShieldCheck), right-side Date Range select + "Export CSV" outline button.
2. KPI strip — 4 cards: Total Revenue (positive), Total Payouts (warning), Profit Margin (tone-tinted), Funded Accounts (positive).
3. Tab strip — Challenge Stats, Country-Wise, Account Size.
4. Tab content area.

**Tab content**:
- **Challenge Stats tab** — DataTable grouped by challenge type: Challenge Type, Revenue (currency), Total Payouts (currency), Profit Margin % (tone-tinted badge), Payout Count, Funded Accounts.
- **Country-Wise tab** — DataTable grouped by country: Country, Traders, Funded (positive tone), Breached (negative tone when > 0), Revenue (currency).
- **Account Size tab** — DataTable grouped by balance band: Size Range, Accounts, Funded, Breached, Revenue.

**Tables**:
- Per-tab table as above. | no per-row actions currently — new: row click → drill-down (Challenge Stats row → challenges-active filtered to type; Country-Wise row → traders filtered to country; Account Size row → accounts filtered to balance band).

**Forms**: none.

**Actions** (buttons + behavior):
- Date Range select (header) → re-filter all tabs.
- "Export CSV" (header outline) → CSV of current tab.
- Tab switch → swap table.
- Row click → drill-down to filtered list (new).
- "Save View" / saved-report (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Save View Sheet — same shape as Challenge Analytics.
- Drill-down Sheet (new — trigger: row click) → content: list of matching entities with count + "Open full list" button → actions: Close / Open Full List (navigates).

---

## Batch 9 — Trading Events, Copy Trading Events, Copy Trading Analysis, Inverse Trading Events, Account IP Addresses

### Trading Events (view-id: `trading-events`) [EXISTING]

**Purpose**: 4-tab rule config — News, Copy, Inverse, Weekend — with master-detail layout.

**Layout** (top-to-bottom):
1. Page header — title "Trading Event Rules", subtitle "Configure detection for news, copy, inverse, and weekend trading events.", icon (Radio).
2. Tab strip — News, Copy Trading, Inverse Trading, Weekend (each with an icon + description text below the active tab).
3. Tab content area — 2-column grid (lg: 1.5fr / 1fr): left master DataTable of rules, right RuleEditor panel.

**Tables**:
- Rules table (per tab): Name, Description (truncated), Symbol (mono), Severity (status badge), Action (status badge), Active (Switch), Actions (Edit ghost icon button). | row click → loads rule into the right-side RuleEditor.

**Forms**:
- RuleEditor form: Name (input), Description (textarea, 3 rows), Symbol (input, mono), Severity (select: warning / critical), Action (select: flag / block / notify), Active (Switch + label). Footer: Save Rule button.

**Actions** (buttons + behavior):
- Tab switch → swap rules list + editor.
- Row click → load rule into editor.
- "Save Rule" (editor footer) → toast.
- Active Switch (per-row) → toast (fix: should preserve + log change).
- "Add Rule" (new — outline button per tab header) → opens Sheet.
- "Test Rule" (new — outline button in editor footer) → opens Test Sheet with dry-run against recent trades.
- "Rule History" / audit trail (new — ghost link in editor header) → opens History Sheet.

**Dialogs / Modals / Sheets**:
- Add Rule Sheet (trigger: "Add Rule") → form: Name, Description, Symbol, Severity, Action, Active → actions: Cancel / Add Rule.
- Test Rule Sheet (trigger: "Test Rule") → form: Test Account Login (input), Date Range (select) → "Run Test" → content: list of matching trades that would trigger the rule, with verdict counts → actions: Close.
- Rule History Sheet (trigger: "Rule History") → content: scrollable timeline of every change to this rule (timestamp, actor, before/after diff) → actions: Close.

---

### Copy Trading Events (view-id: `copy-trading-events`) [EXISTING]

**Purpose**: List of detected copy-trading event pairs with inline create form.

**Layout** (top-to-bottom):
1. Page header — title "Copy Trading Events", subtitle "Detected synchronized trading patterns between accounts.", icon (Copy), right-side "Export CSV" outline + "Add Copy Trading Event" primary.
2. KPI strip — 4 cards: Total Events, Active (positive), Expired (warning), Accounts Flagged (negative when > 0).
3. Inline add form (progressive disclosure — shown when "Add Copy Trading Event" is clicked).
4. Filter bar — card row: search input, 3 dropdowns (Symbol, Date Range, plus new: Min Delta seconds), Clear button, result-count text.
5. Card containing the events table.

**Tables**:
- Copy Events table: Checkbox (selection), Position 1 (badge + symbol + login mono), Position 2 (same), Open Δ (text), Close Δ (text), Account 1 (link-button → trader-detail), Account 2 (link-button), Expired (Switch). | row click → opens Event Detail Sheet (new — currently toast-only). Per-row Switch (Expired) → toast.

**Forms**:
- Add Event form (inline panel): Position 1 (select of open positions), Position 2 (select), Reasons (textarea), Expired (Switch). Footer: Cancel / Save / Save & continue editing.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV of filtered events.
- "Add Copy Trading Event" (header primary) → toggles inline form.
- Inline form Save / Save & continue editing / Cancel → as expected.
- Per-row Switch (Expired) → toast (fix: should be AlertDialog for flip to Expired=True).
- Row click → opens Event Detail Sheet.
- Bulk-select checkbox column enables bulk bar: "Mark All Expired" (alert dialog), "Mark All Active" (alert dialog), "Export Selected" (CSV).
- Per-row kebab (new) → "Suspend Trader 1" (alert dialog), "Suspend Trader 2" (alert dialog), "Mark as Reviewed" (toast), "View Both Accounts" (sheet with side-by-side).

**Dialogs / Modals / Sheets**:
- Event Detail Sheet (trigger: row click) → content: full event payload (ID, both position IDs, both account IDs, both trader IDs, both directions, both volumes, open time delta, close time delta, expired flag, created at, reasons text) + mini equity sparkline for each account + "View Both Accounts" sheet-within-sheet + "Suspend Trader 1/2" alert dialogs + "Mark as Reviewed" toast → actions: Close.
- Bulk Expired AlertDialog (trigger: "Mark All Expired") → text: "Mark {N} events as expired? They will be excluded from active copy-trading alerts." → actions: Cancel / Mark Expired.
- Suspend Trader AlertDialog — same shape as Risk Overview.
- View Both Accounts Sheet (trigger: kebab → View Both Accounts) → content: side-by-side account panels (login, trader, balance, equity, recent positions) → actions: Close.

---

### Copy Trading Analysis (view-id: `copy-trading-analysis`) [EXISTING]

**Purpose**: Interactive detection tool — enter 2 account logins + date range → see match verdict with side-by-side account panels.

**Layout** (top-to-bottom):
1. Page header — title "Copy Trading Analysis", subtitle "Detect synchronized trading patterns between accounts.", icon (ArrowLeftRight).
2. Detection form card — header "Detection Form", 3-column grid: Account Login 1 (input), Account Login 2 (input), Date Range (select). Footer right-aligned: "Analyze" primary button.
3. PageContent area — empty state when no analysis, otherwise: 2-column grid of AccountPanel cards + MatchAnalysisPanel card below.

**AccountPanel content**:
- Header: "Account 1" / "Account 2" + login (mono).
- KPIs: Trader name, Country, Total Trades, Win Rate, Open Positions, Equity, Total P&L (tone-tinted).
- Mini equity sparkline.

**MatchAnalysisPanel content**:
- Header: "Match Analysis" + verdict badge (Match / Possible / No Match with tone-tinting).
- KPIs: Correlation %, Symbol Overlap %, Open Time Delta avg, Trade Direction Match %.
- Matched Trades table: Symbol, Side 1, Side 2, Open Δ, Close Δ, P&L 1, P&L 2. | no per-row actions.

**Tables**:
- Matched Trades table (in MatchAnalysisPanel) — per above.

**Forms**:
- Detection form: Account Login 1 (input, mono), Account Login 2 (input, mono), Date Range (select).

**Actions** (buttons + behavior):
- "Analyze" (form footer primary) → runs analysis + renders result panels.
- "Save Analysis" (new — outline button in MatchAnalysisPanel header) → toast.
- "Create Event from Analysis" (new — primary button in MatchAnalysisPanel header) → creates a Copy Trading Event and navigates to `copy-trading-events`.
- "Drill into matching positions" (new — ghost link in Matched Trades table header) → opens Positions Sheet listing all matched positions with full details.
- "Switch to Inverse Analysis" (new — toggle in form header) → swaps the analysis mode.

**Dialogs / Modals / Sheets**:
- Positions Sheet (trigger: "Drill into matching positions") → content: scrollable DataTable of all matched positions across both accounts (Symbol, Side, Volume, Open Time, Close Time, P&L, Account Login) → actions: Close.

---

### Inverse Trading Events (view-id: `inverse-trading-events`) [EXISTING]

**Purpose**: Detected inverse (hedging) pairs with inline create form.

**Layout** (top-to-bottom):
1. Page header — title "Inverse Trading Events", subtitle "Detected hedging and inverse position patterns between accounts.", icon (Repeat), right-side "Export CSV" outline + "Add Inverse Trading Event" primary.
2. KPI strip — 4 cards: Total Events, Active, Expired, Accounts Flagged.
3. Inline add form (progressive disclosure).
4. Filter bar — search + symbol + date range + Clear.
5. Card containing the events table.

**Tables**:
- Inverse Events table: Checkbox, Buy Position (badge + symbol + login), Sell Position (badge + symbol + login), Open Δ, Close Δ, Account 1 (link-button), Account 2 (link-button), Expired (Switch). | row click → opens Event Detail Sheet.

**Forms**:
- Add Event form (inline panel): Buy Position (select), Sell Position (select), Reasons (textarea), Expired (Switch). Footer: Cancel / Save / Save & continue.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- "Add Inverse Trading Event" (header primary) → toggles inline form.
- Per-row Switch (Expired) → toast (fix: AlertDialog).
- Row click → opens Event Detail Sheet.
- Per-row kebab (new) → Suspend Trader 1 / 2 (alert dialogs), Mark as Reviewed (toast), View Both Accounts (sheet).
- Bulk-select checkbox column → bulk bar.

**Dialogs / Modals / Sheets**:
- Event Detail Sheet — same shape as Copy Trading Events but for inverse (buy + sell positions).
- Bulk Expired AlertDialog, Suspend Trader AlertDialog, View Both Accounts Sheet — same shapes as Copy Trading Events.

---

### Account IP Addresses (view-id: `account-ip-addresses`) [EXISTING]

**Purpose**: IP log per account with inline add form + proxy/hosting/mobile badges.

**Layout** (top-to-bottom):
1. Page header — title "Account IP Addresses", subtitle "IP log per account with proxy/hosting/mobile detection.", icon (Network), right-side "Export CSV" outline + "Add IP Address" primary.
2. KPI strip — 5 cards: Total IPs, Unique Accounts, Proxy IPs (warning), Hosting IPs (warning), Mobile IPs.
3. Inline add form (progressive disclosure).
4. Filter bar — search + country select + proxy state select + Clear.
5. Card containing the IP table.

**Tables**:
- IP Addresses table: Account (login mono + trader name), Status (badge), Phase (badge), Challenge (text), IP Address (mono), City, Country, Is Proxy (badge), Is Hosting (badge), Is Mobile (badge), Created (date-time). | row click → opens IP Detail Sheet (new — currently toast-only). Per-row kebab → Block IP (alert dialog), Allowlist IP (alert dialog), View Account (navigate).

**Forms**:
- Add IP form (inline panel): Account (select), IP Address (input), City (input), Country (input), Latitude (input), Longitude (input), Is Proxy (toggle), Is Hosting (toggle), Is Mobile (toggle). Footer: Cancel / Save.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- "Add IP Address" (header primary) → toggles inline form.
- Row click → opens IP Detail Sheet.
- Per-row kebab → Block IP (AlertDialog), Allowlist IP (AlertDialog), View Account (navigate to account-workspace).
- Bulk-select checkbox column → bulk bar: "Bulk Allowlist" (alert dialog), "Bulk Block" (alert dialog), "Export Selected" (CSV).
- "Geo map" toggle (new — ghost button in header) → switches to a world-map visualization of the IPs with markers tone-tinted by proxy/hosting.

**Dialogs / Modals / Sheets**:
- IP Detail Sheet (trigger: row click) → content: full IP payload (account, trader, IP, city, country, lat/lng with mini map, ISP, ASN, connection type, proxy/hosting/mobile flags, first seen, last seen, login count) + footer actions: Block IP, Allowlist IP, View Account → actions: Close.
- Block IP AlertDialog (trigger: kebab → Block IP) → text: "Block IP {ip}? Future login attempts from this IP will be rejected for all accounts on this tenant." → form: Reason (textarea, required), Notify Trader (toggle, default off) → actions: Cancel / Block IP.
- Allowlist IP AlertDialog (trigger: kebab → Allowlist IP) → text: "Allowlist IP {ip}? This IP will bypass geo-restriction and proxy checks." → form: Reason (textarea, required) → actions: Cancel / Allowlist.
- Bulk Allowlist / Bulk Block AlertDialogs — same shapes per-row, with count in title.
- Geo Map view (full-screen Sheet or inline panel) → world map with IP markers + filter sidebar → Close.

---

## Batch 10 — Weekend Trades, Unprofitable Countries, Revenue Loss, Label vs Payouts, Highest Earners

### Weekend Trades (view-id: `weekend-trades`) [EXISTING]

**Purpose**: List of weekend-held trades with inline detail panel + delete + save.

**Layout** (top-to-bottom):
1. Page header — title "Weekend Trades", subtitle "Trades held over the weekend — policy-violation detection.", icon (CalendarClock), right-side "Export CSV" outline + "Save Changes" primary (when in edit mode).
2. KPI strip — cards: Total Trades, Total Volume, Total Profit (tone-tinted), Buy / Sell split.
3. Filter bar — search + symbol + date range + Clear.
4. Card containing the weekend-trades table.
5. Inline detail panel (below table when row expanded).

**Tables**:
- Weekend Trades table: Account (login mono + trader), Direction (badge tone-tinted), Symbol (mono), Volume (numeric), Profit (currency tone-tinted), Open Time (date-time), Close Vol, Close Time, State (badge), RR Ratio, Hold Time, (expand chevron). | row click → expands inline detail panel. Per-row: Delete (ghost-destructive, new) + Save (ghost, when edited).

**Forms**:
- Inline detail panel form (per expanded row): Close Reason (select: Take Profit / Stop Loss / Manual / System / Liquidation), Profit (read-only), other read-only fields.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- "Save Changes" (header primary, edit mode only) → toast (fix: should persist all edited rows).
- Row click → expands inline detail.
- Per-row "Delete" (ghost-destructive, new) → AlertDialog.
- Per-row "Save" (ghost, in inline panel) → toast.
- "Reverse Trade" (new — outline button in inline panel) → AlertDialog.
- "Force Close" (new — destructive button in inline panel) → AlertDialog.
- "Notify Trader" (new — ghost button in inline panel) → Sheet.
- "Bulk Force Close" (new — destructive outline button in header, enabled when ≥ 1 row selected) → AlertDialog.

**Dialogs / Modals / Sheets**:
- Delete AlertDialog (trigger: per-row Delete) → text: "Delete this weekend-trade record? It will be removed from the audit trail." → actions: Cancel / Delete.
- Reverse Trade AlertDialog (trigger: "Reverse Trade") → form: Volume (input, default = original), Use Current Market Price (toggle), Reason (textarea) → actions: Cancel / Open Reverse.
- Force Close AlertDialog (trigger: "Force Close") → text: "Force-close this position at market? Slippage may apply." → form: Reason (textarea, required), Notify Trader (toggle, default on) → actions: Cancel / Force Close.
- Notify Trader Sheet — same shape as Position Detail (Live).
- Bulk Force Close AlertDialog (trigger: "Bulk Force Close") → text: "Force-close {N} selected positions? Each will be closed at current market. Slippage may apply." → checkbox "Notify each trader by email" → actions: Cancel / Force Close {N}.

---

### Unprofitable Countries (view-id: `risk-unprofitable-countries`) [EXISTING]

**Purpose**: Regions where total payouts exceed total revenue — for geo-restriction decisions.

**Layout** (top-to-bottom):
1. Page header — title "Unprofitable Countries", subtitle "Regions where total payouts exceed total revenue.", icon (Globe), right-side "Export CSV" outline.
2. KPI strip — 3 cards: Unprofitable Countries (warning), Total Revenue Loss (negative), Worst Performing (negative tone, country name).
3. Filter bar — search + date range + Clear + result-count.
4. Card containing the countries table.

**Tables**:
- Countries table: Country (code badge + name), Total Traders (numeric), Total Payouts (currency), Total Revenue (currency), Revenue Loss (currency, tone-tinted negative), Loss % (tone-tinted badge). | row click → drill-down Sheet (new) listing traders in that country. Per-row kebab (new) → Add to Geo Restriction (alert dialog), Export Country Report (toast + CSV), Notify Country Manager (sheet).

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow table.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Bulk Add to Geo Restriction" (new — destructive outline button in header, enabled when ≥ 1 row selected) → AlertDialog.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: list of traders in the country (avatar, name, email, equity, total payout) with summary KPIs + "Open Full List" button → actions: Close / Open Full List (navigates to traders filtered to country).
- Add to Geo Restriction AlertDialog (trigger: kebab → Add to Geo Restriction) → text: "Add {country} to geo-restriction list? New trader signups from this country will be blocked." → form: Reason (textarea, required), Effective Date (date), Notify Existing Traders (toggle, default on) → actions: Cancel / Add Restriction.
- Notify Country Manager Sheet (trigger: kebab → Notify Country Manager) → form: Manager (input, prefilled), Subject (input), Body (textarea), Attach Report (toggle, default on) → actions: Cancel / Send.
- Bulk Add to Geo Restriction AlertDialog (trigger: "Bulk Add to Geo Restriction") → text: "Add {N} countries to geo-restriction?" → form: Reason (textarea, required), Effective Date (date) → actions: Cancel / Add {N} Restrictions.

---

### Revenue Loss (view-id: `risk-revenue-loss`) [EXISTING]

**Purpose**: Period-over-period revenue loss analysis with breakdown by cadence.

**Layout** (top-to-bottom):
1. Page header — title "Revenue Loss Analysis", subtitle "Period-over-period revenue loss breakdown.", icon (TrendingDown), right-side Date Range select + "Export CSV" outline.
2. KPI strip — 4 cards: Current Period Revenue, Previous Period Revenue, Revenue Loss (negative tone), Change % (tone-tinted).
3. Trend chart card — line chart of revenue over time with current vs previous period overlay.
4. Filter bar — search + cadence select + Clear.
5. Card containing the loss breakdown table.

**Tables**:
- Revenue Loss table: Period (text), Current Revenue (currency), Previous Revenue (currency), Revenue Loss (currency, tone-tinted), Change % (tone-tinted badge). | row click → drill-down Sheet. Per-row kebab → Export Period (toast + CSV), Schedule Deep-Dive (sheet).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Date Range + Cadence selects → re-filter.
- Row click → opens Drill-down Sheet.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: detailed breakdown of revenue sources for the period (challenge entry fees, addons, refunds) + payouts issued + net loss → actions: Close.
- Schedule Deep-Dive Sheet (trigger: kebab → Schedule Deep-Dive) → form: Cadence (radio: Weekly / Monthly), Recipients (chip-input), Include Period Comparison (toggle, default on) → actions: Cancel / Schedule.
- Save View Sheet — same shape as Challenge Analytics.

---

### Label vs Payouts (view-id: `risk-label-vs-payouts`) [EXISTING]

**Purpose**: Payout breakdown by account label (Paid / Giveaway / Third Party / Standard).

**Layout** (top-to-bottom):
1. Page header — title "Label vs Payouts", subtitle "Payout breakdown by account label.", icon (Tags), right-side "Export CSV" outline.
2. KPI strip — 4 cards: Total Labels, Total Accounts, Total Revenue (positive), Total Payouts (warning).
3. Filter bar — search + label select + date range + Clear.
4. Card containing the table.

**Tables**:
- Label vs Payouts table: Label (badge), Account ID (mono), Login (mono), Trader ID (mono), Trader Name, Trader Email, Phase (badge), Status (badge), Balance (currency), Currency (text), Payouts (currency). | row click → drill-down Sheet. Per-row kebab → View Account (navigate), View Trader (navigate), Export Row (toast + CSV).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Bulk Export Selected" (new — enabled when ≥ 1 row selected) → CSV.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: full payout history for this account (date, amount, method, status, payout id) + summary KPIs (total payouts, count, avg payout) + "Open Payout Detail" link → actions: Close.
- Save View Sheet — same shape.

---

### Highest Earners (view-id: `risk-highest-earners`) [EXISTING]

**Purpose**: Leaderboard of traders by total revenue contribution.

**Layout** (top-to-bottom):
1. Page header — title "Highest Earners", subtitle "Top traders by total revenue contribution.", icon (Trophy), right-side Date Range select + "Export CSV" outline.
2. KPI strip — 4 cards: Top Earner Revenue, Top 10 %, Total Funded Accounts, Top Earner Country.
3. Podium card — top 3 traders with avatar, name, country, revenue, rank badge.
4. Filter bar — search + country select + date range + Clear.
5. Card containing the leaderboard table.

**Tables**:
- Highest Earners table: Rank (numeric badge), Trader Name, Trader Email, Country (badge), Total Revenue (currency), Active Accounts (numeric), Funded Accounts (numeric), Payout Accounts (numeric), Profit Margin % (tone-tinted badge). | row click → navigate to `trader-detail`. Per-row kebab → View Trader (navigate), Send Bonus (sheet), Add to VIP Tier (alert dialog), Export Trader Card (toast + PDF).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Date Range select → re-filter.
- Row click → navigate to `trader-detail`.
- Per-row kebab → as above.
- "Send Bulk Bonus" (new — outline button in header, enabled when ≥ 1 row selected) → Sheet.

**Dialogs / Modals / Sheets**:
- Send Bonus Sheet (trigger: kebab → Send Bonus) → form: Amount (input, required), Method (select), Reason (textarea, required), Send to (radio: Email / Wallet Credit / Both) → actions: Cancel / Send Bonus.
- Add to VIP AlertDialog (trigger: kebab → Add to VIP Tier) → text: "Add {trader} to VIP tier? They'll receive reduced payout delays and dedicated support." → form: VIP Tier (select: Silver / Gold / Platinum), Notes (textarea) → actions: Cancel / Add to VIP.
- Send Bulk Bonus Sheet (trigger: "Send Bulk Bonus") → form: Amount (input, required), Method (select), Reason (textarea, required), Notify All (toggle, default on) → actions: Cancel / Send {N} Bonuses.

---

## Batch 11 — Group vs Payouts, Coupon vs Payouts, Account Label Analysis, Addon Revenue, Risk Rules Editor

### Group vs Payouts (view-id: `risk-group-vs-payouts`) [EXISTING]

**Purpose**: Payout breakdown by challenge group (challenge name + type + account size + broker).

**Layout** (top-to-bottom):
1. Page header — title "Group vs Payouts", subtitle "Payout breakdown by challenge group.", icon (Layers), right-side "Export CSV" outline.
2. KPI strip — 4 cards: Total Groups, Total Order Revenue, Total Payouts, Avg Profit Margin.
3. Filter bar — search + challenge type select + broker select + date range + Clear.
4. Card containing the table.

**Tables**:
- Group vs Payouts table: Challenge Name, Challenge Type (badge), Account Size (currency), Broker (badge), Order Revenue (currency), Order Count (numeric), Total Payouts (currency, tone-tinted), Profit Margin % (tone-tinted badge). | row click → drill-down Sheet. Per-row kebab → View Challenge (navigate to challenge-edit), Export Group (CSV), Schedule Group Report (sheet).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: list of accounts in the group with per-account payouts + summary KPIs + "Open Full List" button → actions: Close.
- Schedule Group Report Sheet (trigger: kebab → Schedule Group Report) → form: Cadence (radio), Recipients (chip-input), Format (radio: CSV / PDF) → actions: Cancel / Schedule.
- Save View Sheet — same shape.

---

### Coupon vs Payouts (view-id: `risk-coupon-vs-payouts`) [EXISTING]

**Purpose**: Payout breakdown by coupon code — to evaluate discount strategy.

**Layout** (top-to-bottom):
1. Page header — title "Coupon vs Payouts", subtitle "Payout breakdown by coupon code.", icon (Ticket), right-side "Export CSV" outline.
2. KPI strip — 4 cards: Total Coupons, Total Orders, Total Revenue, Total Payouts.
3. Filter bar — search + discount-range select + date range + Clear.
4. Card containing the table.

**Tables**:
- Coupon vs Payouts table: Coupon Code (mono badge), Discount % (numeric), Orders (numeric), Revenue (currency), Funded Accounts (numeric), Total Payouts (currency, tone-tinted), Profit Margin % (tone-tinted badge). | row click → drill-down Sheet. Per-row kebab → View Coupon (navigate to offer-edit), Archive Coupon (alert dialog), Export (CSV).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: list of orders using this coupon with per-order revenue + payouts + summary KPIs → actions: Close.
- Archive Coupon AlertDialog (trigger: kebab → Archive Coupon) → text: "Archive coupon {code}? It will no longer be redeemable but existing discounted accounts are unaffected." → form: Reason (textarea, required) → actions: Cancel / Archive.
- Save View Sheet — same shape.

---

### Account Label Analysis (view-id: `risk-account-label-analysis`) [EXISTING]

**Purpose**: Per-account deep-dive by label — like Label vs Payouts but with extra label description and trader-level detail.

**Layout** (top-to-bottom):
1. Page header — title "Account Label Analysis", subtitle "Per-account breakdown by label.", icon (Tags), right-side "Export CSV" outline.
2. KPI strip — 4 cards: Total Labels, Total Accounts, Total Funded, Total Breached.
3. Filter bar — search + label select + phase select + date range + Clear.
4. Card containing the table.

**Tables**:
- Account Label Analysis table: Label (badge), Label Description (text), Account ID (mono), Login (mono), Trader ID (mono), Trader Name, Phase (badge), Status (badge), Balance (currency), Currency (text). | row click → drill-down Sheet. Per-row kebab → View Account (navigate), View Trader (navigate), Change Label (sheet).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Bulk Change Label" (new — outline button in header, enabled when ≥ 1 row selected) → Sheet.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: full account detail + payout history + label change history → actions: Close.
- Change Label Sheet (trigger: kebab → Change Label) → form: New Label (select: Paid / Giveaway / Third Party / Standard), Reason (textarea, required), Notify Trader (toggle, default off) → actions: Cancel / Change Label.
- Bulk Change Label Sheet (trigger: "Bulk Change Label") → form: New Label (select), Reason (textarea, required), Notify All (toggle) → actions: Cancel / Change {N} Labels.
- Save View Sheet — same shape.

---

### Addon Revenue (view-id: `risk-addon-revenue`) [EXISTING]

**Purpose**: Revenue breakdown by add-on product — to evaluate addon strategy.

**Layout** (top-to-bottom):
1. Page header — title "Add-on Revenue", subtitle "Revenue breakdown by add-on product.", icon (PackagePlus), right-side "Export CSV" outline.
2. KPI strip — 4 cards: Total Add-ons, Total Orders, Total Units, Total Estimated Revenue.
3. Filter bar — search + addon type select + date range + Clear.
4. Card containing the table.

**Tables**:
- Addon Revenue table: Add-on ID (mono), Add-on Name, Orders (numeric), Units Sold (numeric), Unit Price (currency), Estimated Revenue (currency, tone-tinted). | row click → drill-down Sheet. Per-row kebab → View Add-on (navigate to offer-edit), Promote Add-on (sheet), Archive (alert dialog).

**Forms**: none.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- Filter dropdowns → narrow.
- Row click → opens Drill-down Sheet.
- Per-row kebab → as above.
- "Save View" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: row click) → content: list of orders containing this add-on + summary KPIs + "Open Full List" button → actions: Close.
- Promote Add-on Sheet (trigger: kebab → Promote Add-on) → form: Promotion Type (radio: Discount / Bundle / Featured), Value (input), Start Date (date), End Date (date), Target Segment (select) → actions: Cancel / Create Promotion.
- Archive AlertDialog (trigger: kebab → Archive) → text: "Archive add-on {name}? It will no longer be available for new orders." → form: Reason (textarea, required) → actions: Cancel / Archive.
- Save View Sheet — same shape.

---

### Risk Rules Editor (view-id: `risk-rules-editor`) [NEW]

**Purpose**: The dedicated rules editor that the Risk Overview "Configure rules" button has been missing. A focused rule-config workspace covering daily loss, max drawdown, profit target, news trading, weekend trading, copy trading detection, inverse detection, and IP/proxy rules — all in one place.

**Layout** (top-to-bottom):
1. Page header — title "Risk Rules Editor", subtitle "Tenant-wide risk rule configuration.", icon (SlidersHorizontal), right-side "Save All" primary + "Reset to Defaults" outline.
2. KPI strip — 4 cards: Active Rules, Disabled Rules, Rules with Overrides (count of per-account overrides), Last Published (date-time).
3. Tab strip — Drawdown, Trading Restrictions, Detection, IP & Geo, Notifications.
4. Tab content area — varies per tab (below).

**Tab content**:
- **Drawdown tab** — 3 SectionCards: Daily Loss (Daily Loss Limit % input, Reset Time select, Per-Account Override toggle, Notify Trader at % Threshold input, Notify Admin at % Threshold input, Action select: Warn / Halt / Block), Maximum Drawdown (Max Drawdown % input, Trailing Type radio: Static / Trailing / Relative, Per-Account Override toggle, Action select), Profit Target (Default Profit Target % input, Auto-Pass on Target toggle, Per-Phase Override list).
- **Trading Restrictions tab** — 3 SectionCards: News Trading (Allow toggle, Block NFP toggle, Block FOMC toggle, News Window minutes input, Action select), Weekend Trading (Allow toggle, Friday Cutoff time input, Force Close on Friday toggle, Action select), Hold Over Weekend (Allow toggle, Force Close Saturday toggle).
- **Detection tab** — 2 SectionCards: Copy Trading (Enabled toggle, Sensitivity select: Low / Medium / High, Min Symbol Overlap % input, Max Open Delta seconds input, Action select), Inverse Trading (Enabled toggle, Sensitivity select, Min Buy/Sell Volume Ratio input, Action select).
- **IP & Geo tab** — 3 SectionCards: Proxy Detection (Enabled toggle, Block Proxy Logins toggle, Allowlist known hosting providers toggle), Geo Restrictions (Restricted Countries multi-chip-input, Allowlisted Countries multi-chip-input, VPN Block toggle), Mobile Detection (Enabled toggle, Flag Mobile Logins toggle, Allowlisted Mobile Networks multi-chip-input).
- **Notifications tab** — 1 SectionCard: Alert Subscriptions (DataTable of subscriptions — channel, event types, cadence, recipients — with Add Subscription button per row).

**Tables**:
- Alert Subscriptions table (Notifications tab): Channel (badge), Event Types (badge list), Cadence (badge), Recipients (text), Active (Switch), Actions (Edit / Delete). | per-row Edit + Delete.

**Forms**:
- Drawdown tab form: 3 cards' worth of inputs as above.
- Trading Restrictions tab form: 3 cards' worth.
- Detection tab form: 2 cards' worth.
- IP & Geo tab form: 3 cards' worth.
- Notifications tab form: per-row edit (channel, event types, cadence, recipients).

**Actions** (buttons + behavior):
- "Save All" (header primary) → toast + persists all tabs.
- "Reset to Defaults" (header outline) → AlertDialog.
- Tab switch → swap editor.
- Per-row "Edit" (Notifications tab) → opens inline editor.
- Per-row "Delete" (Notifications tab) → AlertDialog.
- "Add Subscription" (Notifications tab header outline) → opens Sheet.
- "Test Rule" (new — outline button per SectionCard) → opens Test Sheet with dry-run against recent activity.
- "Rule History" / changelog (new — ghost link per SectionCard) → opens History Sheet.

**Dialogs / Modals / Sheets**:
- Reset AlertDialog (trigger: "Reset to Defaults") → text: "Reset all risk rules to platform defaults? Per-account overrides will be preserved." → actions: Cancel / Reset All.
- Add Subscription Sheet (trigger: "Add Subscription") → form: Channel (select: Email / Slack / Webhook / SMS), Event Types (multi-checkbox), Cadence (radio: Real-time / Daily digest / Weekly digest), Recipients (chip-input of emails or webhook URLs), Active (toggle, default on) → actions: Cancel / Add Subscription.
- Test Rule Sheet (trigger: "Test Rule" per SectionCard) → form: Test Scope (radio: Last 24h / Last 7d / Custom range), Sample Account Login (input, optional) → "Run Test" → content: list of recent events that would trigger this rule, with verdict counts → actions: Close.
- Rule History Sheet (trigger: "Rule History" per SectionCard) → content: scrollable timeline of every change to rules in this section (timestamp, actor, before/after diff) → actions: Close.

---

## Batch 12 — Breach Detail, Trader Risk Score Detail, Risk Alert Subscription, VPN/Proxy Detection Dashboard, Account Linkage Graph

### Breach Detail (view-id: `breach-detail`) [NEW]

**Purpose**: Dedicated breach-audit page — every detail about a single breach, the rule that fired, the trader's state at the moment, and resolution workflow.

**Layout** (top-to-bottom):
1. Breadcrumb — "Breaches › {breach id}".
2. Header row — icon tile (ShieldAlert), title (breach id mono + type), description (rule text), right-side badges (severity, status), action cluster: "Resolve" outline (when open), "Reopen" outline (when resolved), "Escalate" outline.
3. KPI strip — 6 cards: Account Login (mono), Trader Name, Account Balance at Breach, Equity at Breach, Drawdown at Breach, Time Since Breach.
4. Two-column grid — 6 SectionCards in 2-wide × 3-tall: Breach Rule, Trader State, Trade Replay, Resolution, Audit Trail, Related Breaches.

**Section content**:
- **Breach Rule** — Rule Type (badge), Rule Description (textarea read-only), Threshold (text), Actual Value (text, tone-tinted), Severity (badge), Action Taken (badge), Configured In (link-button → risk-rules-editor with rule preselected).
- **Trader State** — Phase (badge), Account Status (badge), Open Positions Count, Equity at Breach, Daily Starting Balance, Max Drawdown Limit, Daily Drawdown Limit, Profit Target.
- **Trade Replay** — mini chart of account equity around breach timestamp with breach marker. Below: scrollable list of trades opened/closed in the 60-min window around breach (Symbol, Side, Volume, Open/Close time, P&L).
- **Resolution** — Status (badge), Resolved At (date-time), Resolver (text), Resolution Note (textarea read-only), Action Taken (badge). If unresolved: empty state with "Resolve Now" outline button.
- **Audit Trail** — ActivityTimeline of every event tied to this breach (creation, escalation, resolution, reopens).
- **Related Breaches** — list of other breaches on the same account or same trader (date, type, severity, status, link-button → breach-detail).

**Tables**:
- Trade Replay table (inside Trade Replay section): Symbol, Side, Volume, Open Time, Close Time, P&L. | no per-row actions.
- Related Breaches list (inside Related Breaches section): date, type, severity, status. | row click → navigate to `breach-detail`.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Resolve" (header outline, when open) → opens Resolve Sheet (reuses the AlertDialog form from Risk Overview but as a Sheet for more detail).
- "Reopen" (header outline, when resolved) → opens Reopen Sheet.
- "Escalate" (header outline) → opens Escalate Sheet.
- "Resolve Now" (in Resolution section, when unresolved) → same as header Resolve.
- "Open Account Workspace" (new — ghost link in Trader State section) → navigate to `account-workspace`.
- "Open Trader Profile" (new — ghost link in Trader State section) → navigate to `trader-detail`.
- "Export Breach Report" (new — outline button in header) → toast + PDF.

**Dialogs / Modals / Sheets**:
- Resolve Sheet (trigger: "Resolve") → form: Resolution Note (textarea, required), Action Taken (select: Trader Notified / Account Blocked / Manual Override / Refund Issued), Refund Amount (input, conditional on Action Taken = Refund Issued), Notify Trader (toggle, default on), Mark as False Positive (toggle) → actions: Cancel / Resolve Breach.
- Reopen Sheet (trigger: "Reopen") → form: Reason (textarea, required), Re-evaluate Account (toggle, default on) → actions: Cancel / Reopen.
- Escalate Sheet (trigger: "Escalate") → form: Escalate To (select), Priority (radio), Note (textarea, required), Attach Evidence (file upload, optional) → actions: Cancel / Escalate.

---

### Trader Risk Score Detail (view-id: `trader-risk-score-detail`) [NEW]

**Purpose**: Breakdown of the "Platform Risk Score" KPI that appears on Risk Overview — per-trader composite of breach volume, exposure, account health, and behavior flags.

**Layout** (top-to-bottom):
1. Back-link button (ghost) → "Back to {trader name}".
2. Page header — title "Trader Risk Score — {trader name}", subtitle "{email} · {country}", icon (Gauge), right-side "Recalculate" outline + "Export Report" outline.
3. Entity header — title {trader name}, subtitle "Composite risk score breakdown", badges (status badge, phase badge, "Overall Score: {X}/100" big badge with tone-tinting).
4. KPI strip — 5 cards: Overall Score, Trend (delta vs 7d ago), Peer Percentile (e.g. "Top 15% riskiest"), Open Breaches, Account Health Avg.
5. Score Breakdown card — horizontal bar chart with 5 segments (each weighted component tone-tinted by contribution): Breach History 30%, Drawdown Behavior 25%, Account Health 20%, Copy Trading Signals 15%, IP/Geo Risk 10%, Trading Pattern Anomalies 5%.
6. Per-component cards — 6 SectionCards (one per component, each showing the component score, the underlying metrics that feed it, and a sparkline trend).

**Section content**:
- **Breach History** — Component Score (e.g. 8/10), Open Breaches (numeric), Resolved 30d (numeric), Last Breach (date-time), Breach Trend (sparkline).
- **Drawdown Behavior** — Component Score, Avg Max Drawdown %, Avg Daily Drawdown %, Drawdown Breach Count, Drawdown Trend (sparkline).
- **Account Health** — Component Score, Avg Equity / Balance Ratio, Funded Account Count, Active Account Count, Account Health Trend (sparkline).
- **Copy Trading Signals** — Component Score, Detected Events (numeric), Confirmed Events (numeric), Accounts Flagged (numeric), Trend (sparkline).
- **IP/Geo Risk** — Component Score, Distinct IPs (numeric), Proxy IPs (numeric), Hosting IPs (numeric), VPN Suspected (badge), Country Risk Tier (badge).
- **Trading Pattern Anomalies** — Component Score, Off-Hours Trades %, Weekend Trades (numeric), News Window Violations (numeric), High-Frequency Flags (numeric), Trend (sparkline).

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- "Recalculate" (header outline) → toast + re-renders all components with loading shimmer.
- "Export Report" (header outline) → toast + PDF download with full breakdown.
- Per-component "Drill Down" (new — ghost link in each SectionCard header) → opens Drill-down Sheet.
- "Schedule Weekly Score Report" (new — ghost button in header) → Sheet.

**Dialogs / Modals / Sheets**:
- Drill-down Sheet (trigger: "Drill Down" per component) → content: detailed list of the underlying events that contributed to that component's score (e.g. for Breach History: list of recent breaches with severity and status; for Copy Trading: list of detected events; etc.) → actions: Close.
- Schedule Weekly Score Report Sheet (trigger: "Schedule Weekly Score Report") → form: Cadence (radio), Recipients (chip-input), Include Components (multi-checkbox), Format (radio: PDF / CSV) → actions: Cancel / Schedule.

---

### Risk Alert Subscription (view-id: `risk-alert-subscription`) [NEW]

**Purpose**: Manage subscriptions to breach / drawdown / risk-score alerts across the team — channels, event types, cadence, recipients.

**Layout** (top-to-bottom):
1. Page header — title "Risk Alert Subscriptions", subtitle "Manage breach, drawdown, and risk-score alerts.", icon (Bell), right-side "Add Subscription" primary.
2. KPI strip — 4 cards: Total Subscriptions, Active, Paused, Notifications Sent (24h).
3. Filter bar — search + channel select + event type select + active state select + Clear.
4. Card containing the subscriptions table.

**Tables**:
- Subscriptions table: Name (text), Channel (badge: Email / Slack / Webhook / SMS), Event Types (badge list), Cadence (badge: Real-time / Daily / Weekly), Recipients (text count + avatar stack), Active (Switch), Created By (text), Actions (Edit / Pause / Delete). | row click → opens Edit Sheet.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Add Subscription" (header primary) → opens Add Sheet.
- Row click → opens Edit Sheet.
- Per-row "Edit" → opens Edit Sheet.
- Per-row "Pause" / "Resume" (toggle) → toast.
- Per-row "Delete" → AlertDialog.
- Per-row "Test" (new — ghost icon button) → sends a test alert and shows toast.
- "Bulk Pause" / "Bulk Resume" (new — outline buttons in header, enabled when ≥ 1 row selected) → toast.

**Dialogs / Modals / Sheets**:
- Add Subscription Sheet (trigger: "Add Subscription") → form: Name (input, required), Channel (select: Email / Slack / Webhook / SMS), Recipients (chip-input of emails or webhook URLs, required), Event Types (multi-checkbox: Breach Opened / Breach Resolved / Drawdown Warning / Drawdown Critical / Risk Score Change / VPN Detected / Copy Trading Detected / Weekend Trade Detected), Cadence (radio: Real-time / Daily digest / Weekly digest), Filters (collapsible: min severity select, account filter, country filter), Active (toggle, default on) → actions: Cancel / Add Subscription.
- Edit Subscription Sheet (trigger: row click or "Edit") → same form as Add, prefilled, plus "Pause" toggle and "Test" button.
- Delete AlertDialog (trigger: per-row Delete) → text: "Delete subscription {name}? Recipients will stop receiving alerts immediately." → actions: Cancel / Delete.

---

### VPN/Proxy Detection Dashboard (view-id: `vpn-proxy-detection-dashboard`) [NEW]

**Purpose**: Aggregate view of proxy / hosting / VPN-suspected IPs across the tenant — feeds decisions to geo-restrict, block IPs, or escalate traders.

**Layout** (top-to-bottom):
1. Page header — title "VPN / Proxy Detection", subtitle "Aggregate view of proxy, hosting, and VPN-suspected IPs.", icon (ShieldAlert), right-side "Export CSV" outline + "Block All Flagged" destructive outline.
2. KPI strip — 6 cards: Total Distinct IPs, Proxy IPs (warning), Hosting IPs (warning), Mobile IPs, VPN-Suspected IPs (negative), Affected Accounts.
3. Trend chart card — line chart with 4 series (Proxy / Hosting / Mobile / VPN) over the last 30 days.
4. Geo map card — world map with markers tone-tinted by IP type; clicking a marker opens IP Detail Sheet.
5. Filter bar — search + IP type select + country select + date range + Clear.
6. Card containing the flagged IPs table.

**Tables**:
- Flagged IPs table: IP Address (mono), Type (badge: Proxy / Hosting / Mobile / VPN), Country (badge), ISP (text), ASN (mono), First Seen (date-time), Last Seen (date-time), Login Count (numeric), Distinct Accounts (numeric), Actions (kebab → Block IP alert dialog, Allowlist alert dialog, View Accounts sheet, View Trend sheet). | row click → opens IP Detail Sheet.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Export CSV" (header outline) → CSV.
- "Block All Flagged" (header destructive outline, opens AlertDialog).
- Filter dropdowns → narrow.
- Geo map marker click → opens IP Detail Sheet.
- Row click → opens IP Detail Sheet.
- Per-row kebab → as above.

**Dialogs / Modals / Sheets**:
- Block All Flagged AlertDialog (trigger: "Block All Flagged") → text: "Block {N} flagged IPs? Future login attempts from these IPs will be rejected. Some legitimate traders may be affected — review the list before confirming." → form: Reason (textarea, required), Notify Affected Traders (toggle, default off), Schedule (radio: Now / Next Maintenance Window) → actions: Cancel / Block {N} IPs.
- IP Detail Sheet (trigger: row click or geo marker click) → content: full IP payload (IP, type, ISP, ASN, country, city, lat/lng with mini map, first seen, last seen, login count, distinct accounts list with last-login timestamps, VPN suspicion evidence list) + footer actions: Block IP, Allowlist IP, View Accounts → actions: Close.
- View Accounts Sheet (trigger: kebab → View Accounts) → content: list of accounts that have logged in from this IP (login mono, trader name, last login, current status) → actions: Close.
- View Trend Sheet (trigger: kebab → View Trend) → content: 30-day line chart of login attempts from this IP with markers for each breach/event tied to the IP → actions: Close.

---

### Account Linkage Graph (view-id: `account-linkage-graph`) [NEW]

**Purpose**: Visual graph of cross-account relationships — shared IPs, shared devices, copy-trading pairs, inverse-trading pairs, same-name/email matches — to spot multi-account abusers.

**Layout** (top-to-bottom):
1. Page header — title "Account Linkage Graph", subtitle "Visual map of cross-account relationships.", icon (Share2), right-side "Export Graph" outline + "Layout" select (Force / Radial / Hierarchical).
2. KPI strip — 5 cards: Total Nodes (accounts), Total Edges (relationships), Clusters (count of tightly-linked groups), High-Risk Clusters (negative tone), Isolated Accounts (positive tone).
3. Filter bar — search + relationship type select (All / Shared IP / Shared Device / Copy Trading / Inverse Trading / Same Email / Same Name) + min edge strength slider + date range + Clear.
4. Graph canvas card — large interactive network graph (nodes = accounts, edges = relationships, edge thickness = strength). Clicking a node opens the Account Detail Sheet; clicking an edge opens the Relationship Detail Sheet. Tone-tinted clusters by risk level.
5. Side panel (right of graph when a node is selected) — selected account's KPIs + immediate neighbors list + risk score + actions.
6. Cluster list card (below graph) — top 10 clusters by size with expand-to-see-members.

**Tables**:
- Cluster list table: Cluster ID (mono), Size (numeric), Edge Count (numeric), Risk Score (tone-tinted badge), Common Relationship Type (badge), Members (avatar stack). | row click → focuses graph on this cluster.

**Forms**: none on the page surface.

**Actions** (buttons + behavior):
- "Export Graph" (header outline) → toast + GraphML/PDF download.
- "Layout" select (header) → switches graph layout algorithm.
- Filter dropdowns + slider → narrow graph.
- Node click → opens Account Detail Sheet + shows side panel.
- Edge click → opens Relationship Detail Sheet.
- "Block Cluster" (new — destructive outline button in side panel, shown when a node is selected) → AlertDialog.
- "Investigate Cluster" (new — outline button in side panel) → opens Investigation Sheet.
- Cluster list row click → focuses graph on that cluster.
- "Save Graph Snapshot" (new — ghost button in header) → toast + saves current filter/layout as a snapshot.

**Dialogs / Modals / Sheets**:
- Account Detail Sheet (trigger: node click) → content: account KPIs (login, trader, balance, equity, status, phase, open positions, recent breaches) + immediate neighbors list (avatar, login, relationship type, edge strength) + "Open Account Workspace" link + "Block Account" alert dialog + "Suspend Trader" alert dialog → actions: Close.
- Relationship Detail Sheet (trigger: edge click) → content: full relationship payload (account 1, account 2, relationship type, strength, evidence list — e.g. shared IPs with timestamps, copy-trading event IDs, same-email match) + "View Both Accounts" sheet → actions: Close.
- Block Cluster AlertDialog (trigger: "Block Cluster") → text: "Block all {N} accounts in this cluster? Every account will be blocked and every trader notified." → form: Reason (textarea, required), Notify All (toggle, default on), Schedule (radio: Now / Next Maintenance Window) → actions: Cancel / Block Cluster.
- Investigation Sheet (trigger: "Investigate Cluster") → form: Investigator (input, prefilled with current admin), Priority (radio: Low / Medium / High / Critical), Notes (textarea), Attach Evidence (file upload, optional) → "Create Investigation" button → content: investigation created confirmation with investigation ID → actions: Close.

---

# Summary

- **Batches**: 12 sequential batches of exactly 5 screens each.
- **Total screens**: 60 (Trading 22, Challenges 15, Risk 23).
- **Existing screens covered**: 43 (16 Trading + 10 Challenges + 17 Risk) — every page file in `src/modules/trading/pages/`, `src/modules/challenges/pages/`, and `src/modules/risk/pages/` was inspected to extract exact table columns, form fields, button labels, and dialog flows.
- **New screens designed from scratch**: 17 (6 Trading + 5 Challenges + 6 Risk) — Trader Comparison, Position Detail (Live), Bridge Sync Log, Trader Audit Log, MT4/DXTrade Server Config Catalog, Bulk Account Operations, Challenge Marketplace Preview, Challenge Comparison, Challenge Analytics, Phase Migration Tool, Bulk Phase Editor, Risk Rules Editor, Breach Detail, Trader Risk Score Detail, Risk Alert Subscription, VPN/Proxy Detection Dashboard, Account Linkage Graph.
- **Color policy**: Zero color references in this document — all tone names (`positive`, `warning`, `negative`, `info`, `muted`, `default`, `success`, `danger`) are kept identical to the existing shadcn implementation so the Stitch design team can map each to the trader dashboard's semantic slot.
- **Coverage per screen**: Purpose, full top-to-bottom layout, tables (with exact columns + per-row actions), forms (with field types), actions (every button with its target behavior — navigate / open Sheet / open AlertDialog / toggle state / toast), and dialogs / modals / sheets (with trigger, content, and footer actions).


---

# Prop-Admin Dashboard — Stitch Design Spec (Part 2)

> **Scope**: Modules 4–7 — Payouts, Analytics, Affiliates, Accounting.
> **Coverage**: 56 screens (31 existing + 25 new), grouped into **12 batches** numbered Batch 13 → Batch 24.
> **Continuity**: Pick up where Part 1 (60 screens, Batches 1–12) ended. Batches 13–23 each contain exactly 5 screens; Batch 24 contains the final 1 screen.
> **Design language**: Warm stitch design system (matches trader-dashboard redesign) — soft canvas background, warm cream cards, hand-stitched divider accents, serif display type for headings, sans-serif body, hand-drawn icons in the margins, generous whitespace. No cold/utilitarian shadcn chrome.
> **No color tokens**: Per instruction, no hex/Tailwind-color references appear in this document. All visual decisions defer to the existing stitch design system tokens.

---

## Batch 13 — Payouts Module (1 of 2)

### Payouts Overview (view-id: payouts) [EXISTING]

**Purpose**: At-a-glance health of the firm's payout pipeline — pending count, paid totals, processing time, and a searchable table of every payout with inline Approve / Reject.

**Layout** (top-to-bottom):
1. Page header — title (term-resolved "Payouts"), subtitle ("Trader withdrawal requests and approvals."), primary action button on the right, icon-led stitch ornament at top-left.
2. KPI strip — five metric cards in a responsive grid (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`). Each card has a soft stitched border, a left vertical accent strip, an icon, a label, a value, and an optional delta with delta-label.
3. Attention Center strip — a slim card listing contextual attention items (KYC pending, large-payout flag, etc.). Each item is a clickable pill that drills into the relevant screen.
4. All Payouts card — a single bordered card containing the all-payouts table with search input at top.

**Tables**:
- All Payouts: Reference (mono), Trader (medium), Amount (semibold, currency-formatted), Method, Split (%), Status (ExplainableStateBadge with contextual help popover), Requested (date), Actions | per-row actions: Approve (default button — toast in current spec; spec for stitch redesign: must open confirm AlertDialog because irreversible financial action), Reject (ghost button with destructive styling — wrapped in AlertDialog already)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export" → download CSV (full payout ledger)
- Per-row "Approve" → toast today; **redesign target**: open AlertDialog with irreversible-action confirmation (amount + trader consequence text), then toast + audit-log entry
- Per-row "Reject" → AlertDialog with consequence text ("will notify trader, reverse pending fees, trader must re-request, action is logged"), then destructive toast + audit-log entry
- Row click → **redesign target**: navigate to Payout Detail (admin-side) view (`payout-detail?id={id}`)
- Header "Create Payout" → **redesign target**: open Sheet for manual payout creation (currently missing)

**Dialogs / Modals / Sheets**:
- Reject AlertDialog (trigger: row-level "Reject" button) → content: confirmation heading, consequence description with amount and trader name, "Consequence" warning panel → actions: Cancel, Reject (destructive)
- **New for redesign**: Approve AlertDialog (trigger: row-level "Approve" button) → content: confirm irreversible approve, KYC pre-check warning if KYC ≠ verified, expected disbursement date, consequence text → actions: Cancel, Approve
- **New for redesign**: Create Payout Sheet (trigger: header "Create Payout" button) → content: trader select, amount input, method select, scheduled-date picker, internal note textarea → actions: Cancel, Create Payout

---

### Pending Payouts (view-id: payouts-pending) [EXISTING]

**Purpose**: A focused queue of payouts awaiting approval — each rendered as a contextual action panel for fast approve/reject, with a fallback table below.

**Layout** (top-to-bottom):
1. Page header — title "Pending Payouts", subtitle "Awaiting approval."
2. Empty state (when no pending payouts) — illustration, "No pending payouts" heading, "When traders request payouts, they will appear here for review." body, suggestion hint linking to challenge settings.
3. Contextual action panel list — vertical stack of PayoutReviewActions cards. Each card is a hand-stitched bordered surface with: trader avatar + name, payout reference (mono), amount (large currency format), method badge, KYC status pill, age ("requested 2h ago"), and inline primary action "Approve" + destructive ghost "Reject".
4. All-payouts table (filter = pending only) — same schema as Overview table for cross-reference.

**Tables**:
- Pending Payouts (filtered): Reference, Trader, Amount, Method, Split, Status, Requested, Actions | per-row actions same as Overview

**Forms**: none.

**Actions** (buttons + behavior):
- Per-card "Approve" → **redesign target**: AlertDialog friction (currently toast only) with KYC pre-check warning if applicable
- Per-card "Reject" → AlertDialog with consequence panel
- Row click → navigate to Payout Detail

**Dialogs / Modals / Sheets**:
- Reject AlertDialog (trigger: per-card "Reject") → content: amount + trader + consequence panel → actions: Cancel, Reject (destructive)
- **New for redesign**: Approve AlertDialog (trigger: per-card "Approve") → content: confirm irreversible approve, KYC pre-check warning panel if KYC ≠ verified, expected disbursement date → actions: Cancel, Approve
- **New for redesign**: Bulk Approve AlertDialog (trigger: a new "Bulk Approve" button at top of pending queue) → content: shows count of selected + total amount + consequence text → actions: Cancel, Approve N Payouts

---

### Payout History (view-id: payouts-history) [EXISTING]

**Purpose**: A complete archive of all paid and rejected payouts — the historical ledger for finance reconciliation, with drill-down to receipt and filter by date/method/trader.

**Layout** (top-to-bottom):
1. Page header — title "Payout History", subtitle "All processed payouts.", header Export button.
2. **New for redesign**: Filter toolbar — search input, status filter (Paid / Rejected / All), method filter, date-range select (7d / 30d / 90d / All), trader-name filter, "Showing N of M" counter on the right.
3. All-payouts table — filtered to status ∈ {paid, rejected}.

**Tables**:
- Payout History: Reference, Trader, Amount, Method, Split, Status (ExplainableStateBadge), Requested, Processed (date), Actions | per-row actions: View (opens Sheet with receipt), Reverse (only when status = paid; destructive — opens AlertDialog)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export" → CSV with the filtered rows
- Per-row "View" → **redesign target**: open Receipt Sheet with payout details, invoice link, audit-trail snippet
- Per-row "Reverse" (only paid rows) → **redesign target**: open AlertDialog with consequence text + reverses payout to original funding account + audit log entry. (Currently missing.)
- Row click → navigate to Payout Detail

**Dialogs / Modals / Sheets**:
- Receipt Sheet (trigger: per-row "View" button) → content: payout reference, trader block (name, email, country flag, account login), amount breakdown (gross profit / firm cut / payout), method details (bank account last-4 / wallet address / PayPal email), processed timestamp, audit-trail timeline → actions: Download Receipt PDF, Close
- **New for redesign**: Reverse Payout AlertDialog (trigger: per-row "Reverse" on paid rows) → content: warning panel explaining the payout will be reversed to the trader's funding balance, the trader will be notified, finance will be flagged, action is logged → actions: Cancel, Reverse Payout (destructive)

---

### Enhanced Withdrawals (view-id: payouts-enhanced-withdrawals) [EXISTING]

**Purpose**: The operational war-room for batch withdrawal management — KPI summary, multi-axis filter bar, sortable table with per-row checkbox selection, and a batch-action toolbar for bulk approve/reject/export.

**Layout** (top-to-bottom):
1. Page header — title "Enhanced Payouts", subtitle, primary Export CSV button.
2. KPI strip — four metric cards: Pending count, Pending Amount (currency-formatted), Approved Today, Rejected Today.
3. Filter bar — search input (reference / login / name / country), Status select, Method select, KYC select, Date-range select, count badge on the right ("N of M withdrawals").
4. Batch action toolbar (appears only when ≥ 1 row is selected) — emerald-tinted surface showing "{n} selected · {currency} total" + Approve Selected, Reject Selected (destructive), Export Selected, Clear.
5. Withdrawals table — checkbox column + 10 columns with sort headers (Account Login, Full Name, Country, Amount, Size, Method, KYC Status, Created, Status).
6. Footer caption — note about how account logins/countries are derived + suggestion to use batch selection.

**Tables**:
- Withdrawals: Checkbox (select-all-capable), Account Login (mono), Full Name (medium), Country (outline badge), Amount (right-aligned tabular-nums), Size badge (Small/Medium/Large), Method (icon + text), KYC Status (ExplainableStateBadge), Created (date), Status (ExplainableStateBadge) | per-row click → opens Payout Detail Sheet (currently toast-stub)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export CSV" → export all filtered rows
- Batch "Approve Selected" → **redesign target**: AlertDialog (currently toast-stub) with count + total amount + KYC warning panel
- Batch "Reject Selected" → AlertDialog with count + consequence text + destructive action
- Batch "Export Selected" → CSV with only selected rows; toast if nothing selected
- Batch "Clear" → unselect all
- Row click → **redesign target**: open Payout Detail Sheet (currently toast-only)
- Sort header click → toggle sort column / direction

**Dialogs / Modals / Sheets**:
- Reject Selected AlertDialog (trigger: batch "Reject Selected" button) → content: count + consequence text ("traders notified, may re-request if eligible, action logged, cannot be undone") → actions: Cancel, Reject N (destructive)
- **New for redesign**: Approve Selected AlertDialog (trigger: batch "Approve Selected" button) → content: count + total amount + KYC pre-check warning list (any selected rows with KYC ≠ verified) → actions: Cancel, Approve N Payouts
- **New for redesign**: Payout Detail Sheet (trigger: row click) → content: trader block, payout amount breakdown, method details, KYC status, audit timeline → actions: Approve (irreversible AlertDialog), Reject (AlertDialog), View Trader (navigates), Close
- **New for redesign**: KYC-rejected preset filter chip (trigger: a chip in the filter bar) → applies the preset KYC=Rejected filter in one click; surfaces a warning banner that N payouts have failed KYC and cannot be approved

---

### Payout Detail (Admin-side) (view-id: payout-detail) [NEW]

**Purpose**: A single-payout deep-dive view for admins — full lifecycle (requested → approved → paid → settled), audit timeline, receipt/invoice link, reversal/refund path, and trader-context cross-links.

**Layout** (top-to-bottom):
1. Page header — back to Payouts button, payout reference (mono) as the title, status badge (ExplainableStateBadge), subtitle (trader name + email + amount).
2. KPI strip — Requested At (timestamp + age), Amount (currency), Profit Split (%), Method (icon + label), Processing Time (delta from request to approval), Settlement Date.
3. Two-column grid —
   - Left (wider): Payout Lifecycle timeline (vertical stepper showing each state transition with timestamp + actor + note), then the Audit Trail card (table of timestamp / actor / action / before / after / ip).
   - Right (narrower): Trader context card (avatar, name, email, country flag, KYC status pill, account login link → trader-detail), Payout Method details card (e.g. Bank transfer: bank name, account last-4, routing, IBAN masked; Crypto: chain, wallet address truncated, tx hash; PayPal: email; Skrill: email), Linked Invoice card (link to invoice-detail view), Linked Transactions card (commission fee line, processing fee line, FX conversion line if applicable).
4. Action bar (sticky at bottom of main column) — Approve (primary, AlertDialog friction), Reject (destructive ghost, AlertDialog), Hold (toast + sets status to on-hold), Reverse Payout (only when paid; destructive AlertDialog), Download Receipt PDF, Copy Reference (clipboard).

**Tables**:
- Audit Trail: Timestamp, Actor (email + role badge), Action (badge — Approved / Rejected / Reversed / Note Added / KYC Cleared), Note (short text), IP address (mono), Before → After values (two color-coded chips)

**Forms**: none on page; Add Note Sheet has a single textarea.

**Actions** (buttons + behavior):
- Header "Back to Payouts" → navigate to payouts
- Action bar "Approve" → AlertDialog (KYC pre-check warning if applicable; expected disbursement date; irreversible) → toast + audit-log entry → status flips to approved
- Action bar "Reject" → AlertDialog (consequence text + reason textarea required) → destructive toast + audit-log
- Action bar "Hold" → toast + sets status on-hold (reversible via "Release Hold" button)
- Action bar "Release Hold" → only shown when on-hold; toast + sets back to pending
- Action bar "Reverse Payout" → AlertDialog (destructive; consequence text explaining trader will be re-credited, finance flagged, action logged, cannot be undone) → toast + audit-log + status flips to reversed
- Action bar "Download Receipt PDF" → toast + triggers download
- Action bar "Copy Reference" → clipboard
- "View Trader" link → navigate to trader-detail
- "View Invoice" link → navigate to invoice-detail (accounting-invoices view with the invoice selected)
- "Add Note" button (in audit trail card) → opens Sheet with textarea + visibility select (Internal / Trader-visible)

**Dialogs / Modals / Sheets**:
- Approve AlertDialog (trigger: "Approve") → content: amount + trader + KYC pre-check warning if applicable + expected disbursement date + irreversible warning → actions: Cancel, Approve Payout
- Reject AlertDialog (trigger: "Reject") → content: amount + trader + reason textarea (required) + consequence panel → actions: Cancel, Reject Payout (destructive)
- Reverse AlertDialog (trigger: "Reverse Payout" when status=paid) → content: amount + trader + reversal-amount (defaults to full; admin can adjust) + reason textarea (required) + consequence panel → actions: Cancel, Reverse Payout (destructive)
- Add Note Sheet (trigger: "Add Note" button in audit trail card) → content: note textarea (required), visibility select (Internal / Trader-visible) → actions: Cancel, Save Note

---

## Batch 14 — Payouts Module (2 of 2)

### Bulk Payout Approval Queue (view-id: payouts-bulk-approval) [NEW]

**Purpose**: A focused workbench for finance operators who batch-approve payouts each day — sorted queue by amount/age, KYC pre-check warnings inline, two-person approval flow for large payouts.

**Layout** (top-to-bottom):
1. Page header — title "Bulk Payout Approval Queue", subtitle, header actions: "Sort by" select (Amount desc / Age desc / Trader A-Z), "Export Queue" button, "Refresh" button.
2. KPI strip — In Queue (count + total amount), Largest Pending (currency + trader name), Oldest Pending (age + trader name), Approved Today (count), Rejected Today (count), 2-Person Approval Required (count of payouts above the configured threshold).
3. Two-Person Approval banner (appears when queue contains any payout above the 2-person threshold) — warning panel explaining "{n} payouts exceed the {currency} threshold and require a second approver. Your approval alone will mark them as 'Pending 2nd Approval'." with two action buttons: "Filter to Large Payouts" (applies a filter chip), "Read Policy".
4. Filter bar — search input, Status select (Pending / Pending 2nd Approval / All), Method select, KYC select (Verified / Under Review / Verification Failed / Awaiting Submission), Date-range select, trader-name filter, "Apply KYC-Verified Filter" preset chip, "Clear Filters" button.
5. Queue table — checkbox column + payout columns + a "Risk Flags" column showing pills (Large Amount, KYC Pending, First-Time Trader, High-Risk Country).
6. Batch action toolbar (appears when ≥ 1 row is selected) — selected count + total amount + Approve Selected (AlertDialog), Approve & Forward for 2nd Review (only shown if any selected exceeds threshold; AlertDialog), Reject Selected (AlertDialog), Export Selected, Clear.

**Tables**:
- Bulk Queue: Checkbox, Reference (mono), Trader (medium), Amount (right-aligned, semibold), Method (icon + label), KYC Status (ExplainableStateBadge), Age (relative time), Risk Flags (pills — Large Amount / KYC Pending / First-Time Trader / High-Risk Country), Status (ExplainableStateBadge), Actions | per-row click → navigate to payout-detail

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Sort by" select → re-sorts the queue
- Header "Export Queue" → CSV
- Header "Refresh" → re-fetch + toast
- "Apply KYC-Verified Filter" chip → sets KYC = Verified in one click
- "Filter to Large Payouts" (in banner) → applies a Large Amount filter chip
- "Read Policy" (in banner) → opens Sheet with the firm's 2-person approval policy text
- Batch "Approve Selected" → AlertDialog with count + total + KYC pre-check warnings
- Batch "Approve & Forward for 2nd Review" (only shown if any selected exceeds threshold) → AlertDialog; forwards to second approver queue
- Batch "Reject Selected" → AlertDialog with count + consequence text
- Batch "Export Selected" → CSV
- "Clear" → unselect

**Dialogs / Modals / Sheets**:
- Approve Selected AlertDialog (trigger: batch Approve Selected) → content: count + total amount + KYC pre-check warning list (any selected with KYC ≠ verified) + irreversible warning → actions: Cancel, Approve N Payouts
- Approve & Forward AlertDialog (trigger: batch Approve & Forward) → content: count + total + names the second approver (select) + note textarea + consequence panel → actions: Cancel, Forward for 2nd Review
- Reject Selected AlertDialog (trigger: batch Reject Selected) → content: count + consequence + reason textarea (required, applied to all rejected) → actions: Cancel, Reject N (destructive)
- Read Policy Sheet (trigger: "Read Policy" in banner) → content: 2-person approval policy text, threshold amount, list of designated second approvers → actions: Close

---

### Payout Methods Configuration (view-id: payout-methods-config) [NEW]

**Purpose**: Admin-side management of the firm's enabled payout methods (bank transfer, crypto, PayPal, Skrill, etc.) — toggle on/off, configure thresholds, set supported currencies, manage credentials.

**Layout** (top-to-bottom):
1. Page header — title "Payout Methods Configuration", subtitle "Manage which payout methods are enabled, their limits, and credentials.", primary "Add Method" button.
2. KPI strip — Active Methods (count), Total Methods (count + delta-label "X disabled"), Largest Single Payout Allowed (currency + method), Pending Methods Review (count of methods missing credentials or in test mode).
3. Methods grid — a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) of method cards. Each card has:
   - Method icon (Banknote / Bitcoin / CreditCard / ArrowLeftRight / etc.) in a stitched circle
   - Method name + status badge (Active / Disabled / Test Mode / Requires Setup)
   - Supported currencies row (currency pills)
   - Min/Max amount row (per currency)
   - Processing time label
   - Credential status row (Connected / Missing / Expired)
   - Footer actions: Edit (opens Sheet), Toggle Switch (enable/disable), Test Payout (opens Sheet to send a small test)
4. Global settings card — fields: Default payout currency (select), Batch approval threshold (currency input — above this requires 2-person approval), Daily payout cap (currency input), Weekly payout cap (currency input), Crypto wallet whitelist toggle, Auto-reconcile bank payouts toggle.

**Tables**: none (cards + forms).

**Forms**:
- Global Settings: Default Payout Currency (select), Batch Approval Threshold (currency input), Daily Payout Cap (currency input), Weekly Payout Cap (currency input), Crypto Wallet Whitelist (toggle), Auto-Reconcile Bank Payouts (toggle)

**Actions** (buttons + behavior):
- Header "Add Method" → open "Add Payout Method" Sheet
- Per-card "Edit" → open "Edit Method" Sheet (pre-filled)
- Per-card Toggle Switch → flip active/inactive; if disabling an active method, opens AlertDialog warning
- Per-card "Test Payout" → open "Test Payout" Sheet
- Global Settings "Save" → toast + audit-log

**Dialogs / Modals / Sheets**:
- Add Payout Method Sheet (trigger: header "Add Method") → content: method type select (Bank / Crypto / PayPal / Skrill / Wise / Other), display name, supported currencies multi-select, min amount input, max amount input, processing time select, credential fields (method-specific), test mode toggle, active toggle → actions: Cancel, Save Method
- Edit Method Sheet (trigger: per-card "Edit") → same fields as Add, pre-filled → actions: Cancel, Save Changes, Disable Method (destructive)
- Disable Method AlertDialog (trigger: per-card Toggle off, or "Disable Method" in Edit Sheet) → content: confirms disable, warning that pending payouts using this method must be re-routed → actions: Cancel, Disable Method (destructive)
- Test Payout Sheet (trigger: per-card "Test Payout") → content: trader select (test trader only), amount input (capped at small test amount), destination display (e.g. test bank account last-4 / test wallet) → actions: Cancel, Send Test Payout

---

### Payout Schedule (view-id: payout-schedule) [NEW]

**Purpose**: Configure when payouts run — daily/weekly/monthly batches, blackout windows (holidays, weekends), and trader-facing expected settlement windows.

**Layout** (top-to-bottom):
1. Page header — title "Payout Schedule", subtitle "Configure automated batch payout windows and trader-facing settlement expectations.", primary "Add Schedule" button.
2. KPI strip — Active Schedules (count), Next Run (timestamp + schedule name), Blackout Windows (count + next one), Avg Settlement Window (label like "T+2 business days").
3. Calendar preview card — a month-view calendar showing scheduled batch runs (dots), blackout days (hatched pattern), and today's marker. Calendar has prev/next month nav and a "Today" button.
4. Schedules table — list of configured schedules with columns.
5. Blackout windows table — list of holiday/blackout windows.
6. Trader-facing messaging card — preview of the text shown to traders on the trader-dashboard payout-request page ("Payouts are processed every Tuesday and Friday. Expected settlement: T+2 business days. Next window: {date}."). Editable textarea + Save button.

**Tables**:
- Schedules: Name (medium), Frequency (Daily / Weekly / Monthly badge), Day-of-week (label), Time (UTC, e.g. "14:00 UTC"), Methods (count badge), Status (Active / Paused badge), Last Run (timestamp), Next Run (timestamp), Actions | per-row: Edit (opens Sheet), Pause/Resume (toggle), Run Now (AlertDialog — runs immediately bypassing schedule), Delete (AlertDialog)
- Blackout Windows: Name (e.g. "Christmas 2026"), Start Date, End Date, Affected Schedules (count), Reason (text), Actions | per-row: Edit (opens Sheet), Delete (AlertDialog)

**Forms**:
- Trader-facing Messaging: Message Text (textarea)

**Actions** (buttons + behavior):
- Header "Add Schedule" → open "Add Schedule" Sheet
- Header "Add Blackout" → open "Add Blackout" Sheet
- Calendar "Prev / Next / Today" → navigate the calendar
- Per-schedule row "Edit" → open Edit Schedule Sheet
- Per-schedule row "Pause / Resume" → toggle + toast
- Per-schedule row "Run Now" → AlertDialog (manual run confirmation)
- Per-schedule row "Delete" → AlertDialog (destructive)
- Per-blackout row "Edit" → open Edit Blackout Sheet
- Per-blackout row "Delete" → AlertDialog (destructive)
- Trader-facing messaging "Save" → toast + audit-log

**Dialogs / Modals / Sheets**:
- Add/Edit Schedule Sheet (trigger: "Add Schedule" or per-row "Edit") → content: name input, frequency select (Daily / Weekly / Monthly), day-of-week multi-select (when Weekly), day-of-month select (when Monthly), time input (UTC), methods multi-select, min payout amount input (only payouts ≥ this amount are included), max batch size input, active toggle → actions: Cancel, Save Schedule
- Add/Edit Blackout Sheet (trigger: "Add Blackout" or per-row "Edit") → content: name input, start date, end date, reason textarea, affected schedules multi-select (auto-suggested) → actions: Cancel, Save Blackout
- Run Now AlertDialog (trigger: per-schedule "Run Now") → content: confirm immediate run with count of payouts that will be processed + total amount → actions: Cancel, Run Now
- Delete Schedule AlertDialog (trigger: per-schedule "Delete") → content: confirm permanent delete + warning that any in-progress payouts stay queued → actions: Cancel, Delete (destructive)
- Delete Blackout AlertDialog (trigger: per-blackout "Delete") → content: confirm → actions: Cancel, Delete (destructive)

---

### Payout Reversal / Refund (view-id: payout-reversal) [NEW]

**Purpose**: A workbench for handling payout reversals and refunds — initiated either by finance (clerical error, compliance hold) or by trader dispute.

**Layout** (top-to-bottom):
1. Page header — title "Payout Reversals & Refunds", subtitle "Manage payout reversals, partial refunds, and dispute resolutions.", primary "Initiate Reversal" button.
2. KPI strip — Pending Reversals (count + total amount), Completed Reversals (30d, count + total), Reversed-Back to Trader (count + total), Dispute Open Cases (count), Avg Resolution Time (hours).
3. Filter bar — search, Status select (Pending / Approved / Completed / Rejected / Disputed / All), Type select (Clerical Error / Compliance Hold / Trader Dispute / Bank Reject / All), Date-range select, trader-name filter.
4. Reversals table — list of reversal cases.
5. Dispute open-cases card — a focused panel listing only disputed reversals with SLA countdown.

**Tables**:
- Reversals: Reference (mono), Original Payout Reference (mono, linked to payout-detail), Trader (medium), Original Amount (currency), Reversal Amount (currency, may be partial), Reason (badge — Clerical / Compliance / Dispute / Bank Reject), Status (ExplainableStateBadge), Initiated At (timestamp), Initiator (email + role badge), SLA Remaining (countdown, only for Disputed), Actions | per-row: View (opens Sheet), Approve (AlertDialog, irreversible), Reject (AlertDialog), Mark Completed (toast)

**Forms**: none on page; Initiate Reversal Sheet has multiple fields.

**Actions** (buttons + behavior):
- Header "Initiate Reversal" → open Sheet
- Per-row "View" → open Reversal Detail Sheet
- Per-row "Approve" → AlertDialog with consequence text + reversal-amount confirmation
- Per-row "Reject" → AlertDialog with reason textarea
- Per-row "Mark Completed" → toast + status flips
- Row click → open Reversal Detail Sheet

**Dialogs / Modals / Sheets**:
- Initiate Reversal Sheet (trigger: header "Initiate Reversal") → content: original payout reference (search-by-reference), trader auto-populated display, original amount display, reversal amount input (defaults to full; admin can adjust), reason select (Clerical Error / Compliance Hold / Trader Dispute / Bank Reject), reason detail textarea, trader notification toggle, finance flag toggle → actions: Cancel, Initiate Reversal
- Reversal Detail Sheet (trigger: per-row "View" or row click) → content: full reversal record, original payout snapshot, audit timeline, trader context block, linked transactions → actions: Approve (AlertDialog), Reject (AlertDialog), Mark Completed, Link to Dispute (if disputed), Close
- Approve Reversal AlertDialog (trigger: per-row "Approve") → content: confirm reversal amount + trader will be re-credited + finance flagged + action logged + irreversible → actions: Cancel, Approve Reversal (destructive)
- Reject Reversal AlertDialog (trigger: per-row "Reject") → content: confirm rejection + reason textarea (required) → actions: Cancel, Reject (destructive)

---

### Payout Compliance / Audit Report (view-id: payout-compliance) [NEW]

**Purpose**: A monthly/period compliance and audit report surface — for finance teams to reconcile payouts against policy, detect anomalies, and produce exportable reports for regulators/auditors.

**Layout** (top-to-bottom):
1. Page header — title "Payout Compliance & Audit Report", subtitle, header actions: Period select (This Month / Last Month / This Quarter / This Year / Custom Range), Generate Report button, Export PDF button, Export CSV button.
2. KPI strip — Total Payouts (count + amount), Approved Without Issue (count + %), Flagged for Review (count + % of total), Reversed (count + amount), Disputed (count), Avg Approval Time (hours).
3. Compliance scorecard card — large progress-bar style indicator showing overall compliance score (e.g. "92% Compliant") with breakdown by category (KYC verification, AML screening, Sanctions screening, Threshold checks, Manual review).
4. Anomalies card — list of detected anomalies (each with severity badge Critical / Warning / Info): e.g. "Payout approved before KYC verification completed", "Crypto payout to wallet on watchlist", "Same-bank multiple payouts within 1h window". Each anomaly row has a "View Payout" link.
5. Audit trail table — list of all audit events for the period filtered to payout-related actions.
6. Sign-off card — list of required sign-offs (e.g. "Finance Lead", "Compliance Officer") with status (Signed / Pending), signer email + timestamp, and a "Sign Off" button for the current user if they have the role.

**Tables**:
- Audit Trail (period-filtered to payout events): Timestamp, Actor (email + role badge), Action (badge — Approved / Rejected / Reversed / Held / Released / Note Added), Payout Reference (mono, linked to payout-detail), Amount (currency), Reason / Note, IP (mono)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Period" select → re-renders report
- Header "Generate Report" → toast + refreshes with selected period
- Header "Export PDF" → toast + triggers PDF download
- Header "Export CSV" → CSV of audit trail
- Anomaly row "View Payout" → navigate to payout-detail
- Sign-off card "Sign Off" → AlertDialog (confirms sign-off; irreversible)

**Dialogs / Modals / Sheets**:
- Sign-Off AlertDialog (trigger: "Sign Off" button in sign-off card) → content: confirms the user is signing off on the compliance report for the selected period + warning that sign-off is logged and auditable → actions: Cancel, Sign Off
- Custom Range Sheet (trigger: Period select → "Custom Range") → content: start date, end date → actions: Cancel, Apply

---

## Batch 15 — Analytics Module (1 of 4)

### Analytics Overview (view-id: analytics) [EXISTING]

**Purpose**: The single-pane business-intelligence view for the tenant — multi-currency revenue KPIs plus four trend charts (revenue, trader growth, risk distribution, breach trend).

**Layout** (top-to-bottom):
1. Page header — title "Analytics", subtitle, header actions: multi-currency selector (native `<select>` wrapped in a bordered pill, **redesign target**: replace with stitched Select component), Export CSV button (permission-gated).
2. Exchange-rate banner (appears only when display currency ≠ tenant currency) — explains the conversion with from→to currency pills and the rate label on the right.
3. KPI strip — four metric cards: Revenue (30d, with delta %), Avg Daily Rev (with delta %), Trader Growth (with delta %), Breaches (30d, with delta %).
4. Charts grid (2 columns) — four chart cards:
   - Revenue (30d) — AreaSeries with currency-formatted axis labels
   - Trader growth — AreaSeries
   - Risk distribution — DonutSeries
   - Breach trend (30d) — BarSeries

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- Header currency select → re-renders KPIs + Revenue chart in the selected display currency (with exchange-rate banner if different from tenant currency)
- Header "Export CSV" → exports the 30-day revenue series as CSV
- **New for redesign**: Date-range selector (Today / 7d / 30d / 90d / Custom) — currently missing; should re-filter all KPIs + charts
- **New for redesign**: Drill-down from any chart point — clicking a data point opens a Sheet showing the underlying transactions/traders for that day
- **New for redesign**: "Save as Report" button in header → opens Sheet to save current view as a named report (links to Saved Reports view)

**Dialogs / Modals / Sheets**:
- **New for redesign**: Drill-down Sheet (trigger: chart data point click) → content: shows the date, transaction list for that date or trader cohort → actions: Export, Close
- **New for redesign**: Save as Report Sheet (trigger: header "Save as Report") → content: report name input, description textarea, save-as-default toggle, schedule-on-save toggle (links to Scheduled Exports) → actions: Cancel, Save Report

---

### Trader Analytics (view-id: analytics-traders) [EXISTING]

**Purpose**: Trader-level intelligence — leaderboard with avatars/flags/win-rates/PnL/profit-factor, win/loss distribution donut, top-5 equity curves multi-line chart, and an activity-tier bar chart.

**Layout** (top-to-bottom):
1. Page header — title "Trader Analytics", subtitle.
2. KPI strip — four metric cards: Top Trader Equity (with delta-label "{n} traders tracked"), Avg Win Rate (with delta-label "X traders profitable ≥50%"), Profit Factor (ExplainableMetricCard with help popover explaining the formula), Most Traded Symbol (with delta-label "by executed volume (30d)").
3. Trader Leaderboard card — DataTable of top-10 traders by equity. Row click → trader-detail.
4. Two-column grid — Win/Loss Distribution donut (1 col, narrow) + Top 5 Equity Curves multi-line chart (2 cols, wide).
5. Activity Distribution bar chart card — bucketed by trade count (Low / Medium / High / Power).

**Tables**:
- Trader Leaderboard: Rank (# with crown/award icons for top-3), Trader (avatar + name + email + country flag), Equity (currency), 30d PnL (currency, color-coded), Win Rate (%), Profit Factor (2-decimal), Trades (compact format), Status (StatusBadge) | per-row: row click → navigate to trader-detail

**Forms**: none.

**Actions** (buttons + behavior):
- Row click → navigate to trader-detail
- **New for redesign**: Header "Export CSV" → export leaderboard rows
- **New for redesign**: Per-row action menu (Suspend / Reset 2FA / View Account / Pay Outstanding Payout)
- **New for redesign**: Segment filter in toolbar — apply a saved segment (links to Custom Segmentation Builder)

**Dialogs / Modals / Sheets**:
- **New for redesign**: Per-row action menu → opens a dropdown menu (Lucide `MoreHorizontal` icon) with the action list
- **New for redesign**: Apply Segment Sheet (trigger: "Apply Segment" in toolbar) → content: list of saved segments (radio-select) → actions: Cancel, Apply

---

### Performance Analytics (view-id: analytics-performance) [EXISTING]

**Purpose**: Performance breakdowns by challenge type, phase, symbol, country, and hour-of-day — surfaces best-performing cohorts and patterns.

**Layout** (top-to-bottom):
1. Page header — title "Performance Analytics", subtitle.
2. KPI strip — four metric cards: Best Challenge Type (with pass-rate delta-label), Most Profitable Symbol (with avg PnL delta-label), Highest Win Rate Phase (with pass-rate delta-label), Best Performing Country (with avg-equity delta-label).
3. Two-column grid — Performance by Challenge Type (BarSeries, pass-rate %), Performance by Phase (GroupedBars — pass-rate on left axis, avg PnL on right axis).
4. Performance by Symbol (Top 8) card — DataTable with sortable columns.
5. Performance by Country card — DataTable with sortable columns.
6. Performance by Hour of Day (UTC) card — ColoredBars chart (bars colored by profitability signal).

**Tables**:
- Performance by Symbol: Symbol (medium), Trades (compact), Win Rate (color-coded %), Avg PnL (color-coded currency), Total Volume (compact), Sharpe (2-decimal) | per-row click → **redesign target**: open Symbol Drill-down Sheet
- Performance by Country: Country (with flag emoji), Traders (count), Avg Equity (currency), Win Rate (color-coded %), Total Payouts (currency), Profit Factor (2-decimal) | per-row click → **redesign target**: open Country Drill-down Sheet

**Forms**: none.

**Actions** (buttons + behavior):
- Row click (symbol/country) → **redesign target**: open Drill-down Sheet
- **New for redesign**: Header Date-range selector (Today / 7d / 30d / 90d / Custom) — currently missing
- **New for redesign**: Header "Export CSV" button

**Dialogs / Modals / Sheets**:
- **New for redesign**: Symbol Drill-down Sheet (trigger: symbol row click) → content: per-symbol trader table, per-symbol equity curve, per-symbol PnL distribution → actions: Export, Close
- **New for redesign**: Country Drill-down Sheet (trigger: country row click) → content: per-country trader table, country map view, country payout history → actions: Export, Close
- **New for redesign**: Custom Date Range Sheet (trigger: Date-range selector → Custom) → content: start date, end date → actions: Cancel, Apply

---

### Risk Analytics (view-id: analytics-risk) [EXISTING]

**Purpose**: Risk metrics — VaR, Expected Shortfall, Max Drawdown, Sharpe — plus drawdown distribution, VaR confidence curve, risk-adjusted returns by challenge type, breach type breakdown, and a top-10 highest-risk accounts table.

**Layout** (top-to-bottom):
1. Page header — title "Risk Analytics", subtitle.
2. KPI strip — four ExplainableMetricCards (each with a help popover explaining the metric):
   - VaR (95%) — currency-formatted, delta-label "1-day horizon"
   - Expected Shortfall — currency-formatted, delta-label "+X% vs VaR"
   - Max Drawdown — % value, delta-label "peak-to-trough"
   - Sharpe Ratio — 2-decimal, delta-label "tenant-wide"
3. Four-card grid (2×2) — Drawdown Distribution (AreaSeries), VaR Confidence Curve (AreaSeries), Risk-Adjusted Returns by Challenge Type (BarSeries), Breach Type Breakdown (DonutSeries with 7 segments).
4. Top 10 Highest-Risk Accounts card — DataTable with composite Risk Score column. Row click → account-workspace.

**Tables**:
- Top 10 Highest-Risk Accounts: Account (login + platform + phase), Trader (with flag), Equity (currency), Drawdown % (color-coded), Open PnL (color-coded currency), Risk Score (color-coded semibold), Status (StatusBadge) | per-row: row click → navigate to account-workspace

**Forms**: none.

**Actions** (buttons + behavior):
- Row click → navigate to account-workspace
- **New for redesign**: Header "Recalculate" button → triggers a toast + recomputes VaR/ES (currently missing)
- **New for redesign**: Header confidence-level selector (90% / 95% / 97.5% / 99% / 99.9%) — currently missing; re-renders VaR card
- **New for redesign**: Header Date-range selector
- **New for redesign**: Header "Export CSV" → export top-10 risk accounts

**Dialogs / Modals / Sheets**:
- **New for redesign**: Recalculate AlertDialog (trigger: "Recalculate") → content: confirm re-computation + warning that historical VaR values will be replaced → actions: Cancel, Recalculate
- **New for redesign**: Custom Date Range Sheet (trigger: Date-range selector → Custom) → content: start date, end date, confidence-level select → actions: Cancel, Apply

---

### Advanced Analytics (view-id: analytics-advanced) [EXISTING]

**Purpose**: Currently a FeatureGuard placeholder with a single cohort-retention preview chart. **Redesign target**: replace the placeholder with real advanced/predictive analytics content (anomaly detection, churn prediction, LTV forecasting).

**Layout** (top-to-bottom, redesigned):
1. Page header — title "Advanced Analytics", subtitle "Predictive insights, anomaly detection, and cohort forecasting across traders and challenges.", badge "Pro feature", header actions: Date-range selector, Export CSV.
2. FeatureGate banner (when feature flag is off) — explains the feature flag and shows a "Request Access" button.
3. KPI strip — four metric cards: Predicted 30d Churn (% + count), Predicted LTV (currency, 12-month forecast), Anomalies Detected (count, last 7d), Model Confidence (%, label "X% confidence interval").
4. Anomaly Detection card — a timeline chart showing detected anomalies (markers on the revenue/breach curve) + a table listing each anomaly with timestamp, severity, type, affected entity, recommended action.
5. Churn Prediction card — bar chart of traders ranked by churn probability (top 20) + table of traders with churn risk score + recommended retention action.
6. LTV Forecast card — area chart of projected LTV over next 12 months + confidence interval band.
7. Cohort Retention Forecast card — BarSeries showing 6-month retention forecast per cohort.

**Tables**:
- Anomaly Detection List: Timestamp, Severity (Critical / Warning / Info), Type (Revenue Spike / Trading Pattern / Login Pattern / Payout Pattern), Affected Entity (link to detail), Confidence (%), Recommended Action (text), Actions | per-row: Investigate (opens Sheet)
- Churn Risk Top 20: Trader (avatar + name + email), Churn Probability (% color-coded), Last Active (relative), Trades (30d), Account Status (StatusBadge), Recommended Action (badge — Email Campaign / Account Review / Personal Outreach), Actions | per-row: Trigger Outreach (opens Sheet)

**Forms**: none.

**Actions** (buttons + behavior):
- FeatureGate banner "Request Access" → toast + email to platform-admin
- Header Date-range selector → re-renders
- Header "Export CSV" → export all anomaly/churn/LTV data
- Anomaly row "Investigate" → open Anomaly Investigation Sheet
- Churn row "Trigger Outreach" → open Outreach Sheet (compose re-engagement email)

**Dialogs / Modals / Sheets**:
- Anomaly Investigation Sheet (trigger: per-row "Investigate") → content: full anomaly detail, affected entity snapshot, related audit events, recommended actions checklist → actions: Mark as Resolved, Snooze 7d, Escalate, Close
- Outreach Sheet (trigger: per-row "Trigger Outreach") → content: trader context block, template select (Re-engagement / Personal / Bundle Offer), subject input, body textarea, schedule send toggle, schedule datetime → actions: Cancel, Send Now, Schedule Send

---

## Batch 16 — Analytics Module (2 of 4)

### Firm Statistics (view-id: analytics-firm-statistics) [EXISTING]

**Purpose**: The "how is the firm doing?" view — 10 KPIs across revenue/payouts/profit/challenges/risk-events/accounts, plus four 12-month trend charts and a summary table of derived ratios with their formulas.

**Layout** (top-to-bottom):
1. Page header — title "Firm Statistics", subtitle, header actions: Range selector (segmented button group: 7d / 30d / 90d), Export button.
2. KPI strip — 10 metric cards in a `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` layout:
   - Row 1 (5 cards): Total Revenue (delta %), Total Payouts (delta %), Net Profit (delta %), Challenges Sold (delta %), Profit Margin (delta pts)
   - Row 2 (5 cards): Copy Trading Events, Inverse Trading Events, News Trading Events, Total Accounts (delta %), Funded Accounts (delta %)
3. Charts grid (2 columns, 2 rows) — four AreaSeries trend charts:
   - Revenue (12 months)
   - Payouts (12 months)
   - Net Revenue (12 months)
   - Challenges Sold (12 months)
4. Separator
5. Summary Statistics card — DataTable with four derived-ratio rows.

**Tables**:
- Summary Statistics: Metric (medium), Value (tabular-nums), Formula (muted), Context (small muted) | per-row: no per-row actions (read-only)

**Forms**: none.

**Actions** (buttons + behavior):
- Header range selector (7d / 30d / 90d) → re-renders KPIs (currently doesn't re-filter mock; redesign should wire to actual data)
- Header "Export" → CSV with 12-month series (date / revenue / payouts / net / challenges)
- **New for redesign**: Drill-down from "Challenges Sold" KPI card → navigate to Dashboard Orders tab
- **New for redesign**: "Compare to previous period" toggle in header → overlays previous period as a dashed line on each AreaSeries

**Dialogs / Modals / Sheets**: none in current spec. **New for redesign**: a "Compare to Previous Period" toggle that shows overlay lines on the trend charts.

---

### Daily Highlights (view-id: analytics-daily-highlights) [EXISTING]

**Purpose**: Hour-by-hour operational snapshot for a selected UTC day — KPIs, four hourly area charts, and six breakdown tables (countries, PSPs, platforms, coupons, account sizes, recent orders).

**Layout** (top-to-bottom):
1. Page header — title "Daily Highlights (UTC)", subtitle, header action: Date picker (native `<input type="date">` wrapped in a bordered pill, capped at today).
2. KPI strip — five metric cards: Daily Revenue (delta % vs yesterday), Daily Payouts (delta %), Daily Net Revenue (delta %), Avg Order Value (delta %), Latest Hour Revenue.
3. Hourly charts grid (2 columns, 2 rows) — four AreaSeries:
   - Hourly Revenue
   - Hourly Orders
   - Hourly Payouts
   - Hourly Orders by PSP (with a legend row of colored squares + PSP names below the chart)
4. Breakdown tables grid (2 columns, 3 rows) — six small HTML tables:
   - Top Countries (Country / Orders / Revenue)
   - Top PSPs (PSP / Orders / Revenue)
   - Top Platforms (Platform / Accounts / Share %)
   - Top Coupons (Code badge / Redemptions / Savings)
   - Purchases by Account Size (Size / Count / Revenue)
   - Recent Orders (Order ID / Customer / Challenge / Amount / PSP / Time)
5. Footer caption — "All times are in UTC. Values shown for {date}."

**Tables**:
- Top Countries: Country, Orders (right-aligned), Revenue (right-aligned)
- Top PSPs: PSP, Orders, Revenue
- Top Platforms: Platform, Accounts, Share (%)
- Top Coupons: Code (outline badge), Redemptions, Savings (negative currency)
- Purchases by Account Size: Size, Count, Revenue
- Recent Orders: Order (mono medium), Customer (xs), Challenge (muted), Amount (tabular-nums), PSP (muted), Time (right-aligned)

**Forms**: none.

**Actions** (buttons + behavior):
- Header date picker → re-renders for selected date
- **New for redesign**: Header "Export CSV" → export all breakdown tables as one CSV workbook
- **New for redesign**: Top Countries row click → drill-down Sheet of country's hourly breakdown
- **New for redesign**: "Compare to yesterday" toggle in header → shows yesterday's overlay on each hourly chart
- **New for redesign**: Recent Orders row click → navigate to checkout-platform-transactions detail

**Dialogs / Modals / Sheets**:
- **New for redesign**: Country Drill-down Sheet (trigger: Top Countries row click) → content: hourly revenue curve for that country, top traders from that country that day → actions: Close
- **New for redesign**: Recent Orders Detail Sheet (trigger: Recent Orders row click) → content: full order detail with line items, customer block, PSP transaction → actions: View Customer, Close

---

### Retention Analytics (view-id: analytics-retention) [EXISTING]

**Purpose**: Customer retention view — cohort retention matrix (3 hard-coded months), challenges-per-user distribution bar, new vs repeating donut, top countries by retention, and a summary-insights card with three findings.

**Layout** (top-to-bottom):
1. Page header — title "Trader Retention & Behavior", subtitle, header action: Export CSV button.
2. KPI strip — five metric cards: 3-Month Retention (%), 6-Month Retention (%), 12-Month Retention (%), Challenges / Trader (count), Repeating Traders (%).
3. Two-column grid —
   - Cohort Retention Matrix (2 cols wide): a small table with cohort month rows and +30d / +60d / +90d columns, each cell color-coded green-amber-rose based on retention %. Footer caption explaining the trend.
   - New vs Repeating Donut (1 col narrow).
4. Challenges per User Distribution card — BarSeries showing the count of traders in each bucket (1 / 2 / 3 / 4+ challenges).
5. Top Countries by Retention card — DataTable with sortable columns.
6. Summary Insights card — a primary-tinted card with three bullets (color-coded dots — emerald / amber / rose — for positive / caution / negative findings).

**Tables**:
- Cohort Retention Matrix: Cohort (medium), Start (count, right-aligned), +30d (% color-coded), +60d (% or "—" color-coded), +90d (% or "—" color-coded)
- Top Countries: Country (medium), Total Traders (count), Repeating Traders (count, emerald), Retention Rate (% in an outline badge, color-coded)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export CSV" → export top-countries table
- **New for redesign**: Cohort cell click → open Sheet showing the cohort's user list (currently the matrix is hard-coded to 3 cohorts and has no drill-down)
- **New for redesign**: "Re-engagement Campaign" button in header → open Outreach Composer Sheet targeting the lowest-retention cohort
- **New for redesign**: "Extend Cohort Range" selector (3m / 6m / 12m / 24m) — currently hard-coded to 3 months

**Dialogs / Modals / Sheets**:
- **New for redesign**: Cohort Drill-down Sheet (trigger: cohort cell click) → content: cohort month, retention cell value, list of users in that cohort with their current status, retention action button per user → actions: Trigger Outreach, Close
- **New for redesign**: Re-engagement Composer Sheet (trigger: header "Re-engagement Campaign") → content: target segment (auto-filled from lowest-retention cohort), template select, subject, body, schedule send → actions: Cancel, Send Now, Schedule Send

---

### Dashboard: Accounts Tab (view-id: dashboard-accounts) [EXISTING]

**Purpose**: Operational dashboard tab focused on the account lifecycle — KPI strip of 13 account-related metrics, daily pass/fail chart, account retention cohort heatmap, and a challenge performance grid.

**Layout** (top-to-bottom):
1. Page header — title "Accounts Dashboard", subtitle "Account lifecycle, breach health, and challenge performance — operational view.", no header actions in current spec (**redesign target**: add date-range selector + export).
2. KPI strip — 13 metric cards in `grid-cols-2 md:grid-cols-3 lg:grid-cols-7`:
   - Total Accounts (delta %), Phase 1 Accounts (delta %), Phase 2 Accounts (delta %), Live / Funded (delta %), MT5 Active (delta %), Daily DD Breached (delta %), Max DD Breached (delta %), Blocked Accounts (delta %), Passed Accounts (delta %), Total Users (delta %), Avg Accounts / User, Avg Pass Time, Avg Breach Time
3. Pass / Fail Highlights card — GroupedBars chart (30 days, daily pass count vs fail count, two-color bars).
4. Account Retention Cohort card — heatmap table with +30/+60/+90d cells color-coded from green (high retention) → amber → rose (low). Empty cells show "—".
5. Challenge Performance Grid — 2-column grid of cards, one per challenge type. Each card shows: challenge name, "{n} funded" badge, a 2-column mini-grid of Phase 1 Passes / Phase 1 Fails / Phase 1 Failure Rate / Phase 2 Passes / Phase 2 Fails / Phase 2 Failure Rate, footer row with Funded Accounts count.

**Tables**:
- Account Retention Cohort (heatmap): Cohort Month, +30d (color-coded %), +60d (color-coded % or "—"), +90d (color-coded % or "—")

**Forms**: none.

**Actions** (buttons + behavior):
- **New for redesign**: Header date-range selector → re-filters all KPIs + chart
- **New for redesign**: Header "Export CSV" → export KPIs + cohort matrix
- **New for redesign**: KPI card click → drill-down Sheet showing underlying accounts
- **New for redesign**: Pass / Fail chart bar click → drill-down Sheet showing that day's passes/fails
- **New for redesign**: Challenge Performance card click → navigate to challenge-detail

**Dialogs / Modals / Sheets**:
- **New for redesign**: KPI Drill-down Sheet (trigger: KPI card click) → content: KPI name, value, list of underlying accounts/traders contributing to the metric, with per-row drill → actions: Export, Close
- **New for redesign**: Pass/Fail Day Sheet (trigger: Pass / Fail chart bar click) → content: date, list of accounts that passed/failed that day with reasons → actions: Export, Close

---

### Dashboard: Payouts Tab (view-id: dashboard-payouts) [EXISTING]

**Purpose**: Operational dashboard tab for payouts — 6 KPI cards, daily payout area chart, payout cohort matrix, payouts-by-challenge & payouts-by-platform horizontal bar charts, and a recent withdrawals table.

**Layout** (top-to-bottom):
1. Page header — title "Payouts Dashboard", subtitle.
2. KPI strip — six metric cards: Approved Payouts (delta %), Total Payout Amount (delta %), Avg Profit Split (delta pts), Pending Payouts (delta %), Rejected Payouts (delta %), Processing Payouts (delta %).
3. Daily Payout Movement card — AreaSeries over 30 days, currency-formatted.
4. Payout Cohort Matrix card — heatmap with +30/+60/+90d cells showing % of cohort paid out. Caption explaining the trend.
5. Two-column grid — Payouts by Challenge (HorizontalBars) + Payouts by Platform (HorizontalBars).
6. Recent Withdrawal Requests card — DataTable.

**Tables**:
- Recent Withdrawals: Request (mono), Trader (medium), Amount (tabular-nums), Method (muted), Status (StatusBadge), Date (tabular-nums muted) | per-row: row click → **redesign target**: navigate to payout-detail (currently no row click)

**Forms**: none.

**Actions** (buttons + behavior):
- **New for redesign**: Header date-range selector
- **New for redesign**: Header "Export CSV" → export KPIs + cohort + recent withdrawals
- **New for redesign**: Recent Withdrawals row click → navigate to payout-detail
- **New for redesign**: KPI card click → drill-down
- **New for redesign**: HorizontalBars bar click → drill-down Sheet for that challenge/platform

**Dialogs / Modals / Sheets**:
- **New for redesign**: Drill-down Sheet for Payouts by Challenge (trigger: bar click) → content: challenge name, list of payouts in that challenge with trader / amount / status → actions: Export, Close
- **New for redesign**: Drill-down Sheet for Payouts by Platform → content: platform name, list of payouts on that platform → actions: Export, Close

---

## Batch 17 — Analytics Module (3 of 4)

### Dashboard: Orders Tab (view-id: dashboard-orders) [EXISTING]

**Purpose**: Operational dashboard tab for orders — 5 KPIs, monthly revenue trend area chart, revenue-by-challenge & revenue-by-broker horizontal bars, hourly revenue & hourly orders area charts, and a revenue-by-country table.

**Layout** (top-to-bottom):
1. Page header — title "Orders Dashboard", subtitle.
2. KPI strip — five metric cards: Total Orders (delta %), Total Revenue (delta %), Avg Order Value (delta %), Conversion Rate (delta pts), Refund Rate (delta pts).
3. Two-column grid — Revenue by Challenge (HorizontalBars) + Revenue by Broker (HorizontalBars).
4. Monthly Revenue Trend card — AreaSeries over 12 months.
5. Two-column grid — Hourly Revenue Movement (AreaSeries) + Hourly Orders Movement (AreaSeries), 24-hour UTC.
6. Revenue by Country card — DataTable with market-share progress bar.

**Tables**:
- Revenue by Country: Country (medium), Orders (count), Revenue (currency), Avg Order Value (currency, muted), Market Share (% with progress-bar pill) | per-row: **redesign target**: row click → drill-down Sheet

**Forms**: none.

**Actions** (buttons + behavior):
- **New for redesign**: Header date-range selector
- **New for redesign**: Header "Export CSV"
- **New for redesign**: Country row click → drill-down Sheet showing that country's order detail
- **New for redesign**: HorizontalBars bar click → drill-down Sheet for that challenge/broker
- **New for redesign**: KPI card click → drill-down

**Dialogs / Modals / Sheets**:
- **New for redesign**: Country Drill-down Sheet (trigger: row click) → content: country's orders list, top traders, top coupons → actions: Export, Close
- **New for redesign**: Challenge/Broker Drill-down Sheet (trigger: bar click) → content: revenue trend for that challenge/broker, top orders → actions: Export, Close

---

### Dashboard: Positions Tab (view-id: dashboard-positions) [EXISTING]

**Purpose**: Operational dashboard tab for trading positions — 6 KPIs (total open positions, total volume, total PnL, winning/losing counts, win rate), symbol stats table, and two hourly distribution charts (trade count + PnL by hour).

**Layout** (top-to-bottom):
1. Page header — title "Positions Dashboard", subtitle.
2. KPI strip — six metric cards: Total Open Positions (delta %), Total Volume (compact lots, delta %), Total P&L (compact signed, color-coded, delta %), Winning Positions (delta %), Losing Positions (delta %), Win Rate (delta pts).
3. Symbol Stats card — DataTable.
4. Two-column grid — Trade Distribution by Hour (BarSeries, 24 bars) + Performance Distribution by Hour (ColoredBars — emerald for positive, rose for negative hours). Footer legend with two colored square pills.

**Tables**:
- Symbol Stats: Symbol (mono with colored dot prefix), Positions (tabular-nums), Buy / Sell (color-coded split — emerald % / rose %), Total Volume (compact, muted), Total P&L (compact signed, color-coded), Win Rate (StatusBadge color-coded by tier) | per-row: **redesign target**: row click → drill-down Sheet showing that symbol's positions

**Forms**: none.

**Actions** (buttons + behavior):
- **New for redesign**: Header date-range selector
- **New for redesign**: Header "Export CSV"
- **New for redesign**: Symbol row click → drill-down Sheet
- **New for redesign**: Chart bar click → drill-down Sheet for that hour

**Dialogs / Modals / Sheets**:
- **New for redesign**: Symbol Drill-down Sheet (trigger: symbol row click) → content: live positions table for that symbol, recent closed positions, top traders holding that symbol → actions: Export, Close
- **New for redesign**: Hour Drill-down Sheet (trigger: chart bar click) → content: trades opened in that hour, traders active in that hour → actions: Export, Close

---

### Saved Reports / Report Builder (view-id: saved-reports) [NEW]

**Purpose**: A library of saved analytics views — each one captures a complete snapshot of filters, chart config, KPI selection, and date range. The Report Builder lets operators compose new views without leaving the analytics module.

**Layout** (top-to-bottom):
1. Page header — title "Saved Reports", subtitle "Your saved analytics views and report templates.", primary "New Report" button, secondary "Import Report" button.
2. Filter bar — search input, source view select (All / Analytics Overview / Trader Analytics / Performance / Risk / Dashboard Tabs), category select (Executive / Operational / Compliance / Custom), shared-with-me toggle, sort-by select (Recent / Name / Owner).
3. Two-column grid of report cards — each card shows: report name (medium), source view badge, last-run timestamp, owner avatar + name, shared-with count, scheduled indicator (clock icon if scheduled), description (truncated). Card hover lifts the card and reveals quick-action buttons: Run, Edit, Duplicate, Share, Delete.
4. Recent Runs card (bottom) — a table of the last 10 report runs with timestamp, report name, run-by, status, duration, and an "Open Result" action.

**Tables**:
- Recent Runs: Timestamp, Report (medium), Run By (avatar + name), Status (Success / Failed / Running badge), Duration (relative), Result (link or "—"), Actions | per-row: Open Result (navigates), Re-run (toast), View Logs (opens Sheet)

**Forms**: none on the main page. The Report Builder is a Sheet.

**Actions** (buttons + behavior):
- Header "New Report" → open Report Builder Sheet (empty)
- Header "Import Report" → open Import Sheet (paste JSON or upload .json)
- Per-card "Run" → toast + runs the report; navigates to the source view with the report's filters applied
- Per-card "Edit" → open Report Builder Sheet (pre-filled)
- Per-card "Duplicate" → toast + creates a copy in draft state
- Per-card "Share" → open Share Sheet
- Per-card "Delete" → AlertDialog (destructive)
- Per-card click (anywhere except actions) → open Report Detail Sheet
- Recent Runs "Open Result" → navigate to the source view with that run's snapshot
- Recent Runs "Re-run" → toast + queues a re-run
- Recent Runs "View Logs" → open Logs Sheet

**Dialogs / Modals / Sheets**:
- Report Builder Sheet (trigger: "New Report" or per-card "Edit") → content:
  - Step 1 (Source): Source view select (Analytics Overview / Trader Analytics / Performance / Risk / Dashboard tab), report name input, description textarea, category select
  - Step 2 (Filters): Date-range select, currency select, segment select (links to Custom Segmentation), additional filter chips (per source view)
  - Step 3 (KPI Selection): checkbox grid of available KPIs for the chosen source view
  - Step 4 (Charts): checkbox grid of available charts, with reorder handles
  - Step 5 (Schedule): toggle "Schedule this report", recurrence select (Daily / Weekly / Monthly), day-of-week multi-select, time input, recipients email-list input
  - Step 6 (Sharing): shared-with multi-select (user picker), make-default toggle
  - Live preview pane on the right showing the report as it will render
  → actions: Cancel, Save as Draft, Save & Run Now
- Share Sheet (trigger: per-card "Share") → content: shared-with user multi-select, permission select (Viewer / Editor), message textarea, copy-link button → actions: Cancel, Send Invites
- Delete Report AlertDialog (trigger: per-card "Delete") → content: confirm + warning that scheduled runs will be cancelled + warning that historical run results are retained → actions: Cancel, Delete (destructive)
- Import Report Sheet (trigger: header "Import Report") → content: paste-JSON textarea or upload .json file → actions: Cancel, Import
- Logs Sheet (trigger: Recent Runs "View Logs") → content: log lines (timestamped) → actions: Copy Logs, Close

---

### Scheduled Exports (view-id: scheduled-exports) [NEW]

**Purpose**: A scheduler for periodic data exports — email-me-this-report-every-Monday style. Manage existing schedules, see next-run timestamps, pause/resume, and audit past deliveries.

**Layout** (top-to-bottom):
1. Page header — title "Scheduled Exports", subtitle "Email-me-this-report-on-a-cadence.", primary "New Schedule" button.
2. KPI strip — Active Schedules (count), Paused Schedules (count), Failed Deliveries (last 7d, count), Next Run (timestamp + report name).
3. Failed Deliveries banner (appears when count > 0) — warning panel listing recent failures with "Retry" buttons.
4. Filter bar — search, frequency select (All / Daily / Weekly / Monthly), format select (All / CSV / PDF / XLSX), status select (All / Active / Paused / Failed).
5. Schedules table — list of all scheduled exports.
6. Delivery History card (below) — a timeline list of past deliveries.

**Tables**:
- Schedules: Name (medium), Source (badge — Analytics Overview / Trader Analytics / etc.), Frequency (Daily / Weekly / Monthly badge), Next Run (timestamp + relative), Recipients (count + avatar stack), Format (badge — CSV / PDF / XLSX), Status (Active / Paused / Failed StatusBadge), Last Delivery (timestamp + status icon), Actions | per-row: Run Now (AlertDialog), Edit (Sheet), Pause/Resume (toggle), Delete (AlertDialog)
- Delivery History: Timestamp, Schedule Name, Format, Recipients Count, Delivery Status (Success / Failed / Partial badge), Failure Reason (if any), Actions | per-row: Download Result (if successful), View Logs (Sheet), Retry (if failed)

**Forms**: none on main page. New Schedule Sheet has multiple fields.

**Actions** (buttons + behavior):
- Header "New Schedule" → open New Schedule Sheet
- Per-row "Run Now" → AlertDialog (manual run)
- Per-row "Edit" → open Edit Schedule Sheet
- Per-row Pause/Resume toggle → toast
- Per-row "Delete" → AlertDialog (destructive)
- Per-row click → open Schedule Detail Sheet
- Delivery History "Download Result" → triggers download
- Delivery History "View Logs" → open Logs Sheet
- Delivery History "Retry" → toast + queues re-run

**Dialogs / Modals / Sheets**:
- New/Edit Schedule Sheet (trigger: "New Schedule" or per-row "Edit") → content:
  - Source view select (Analytics Overview / Trader Analytics / Performance / Risk / Dashboard tabs / Saved Report)
  - If Saved Report → saved-report select
  - Filters block: date-range select, currency select, segment select
  - Format select (CSV / PDF / XLSX)
  - Recurrence select (Daily / Weekly / Monthly)
  - Day-of-week multi-select (when Weekly)
  - Day-of-month select (when Monthly)
  - Time input (UTC)
  - Recipients: user multi-select (auto-suggest from team members) + free-text email input
  - Subject input (auto-suggested)
  - Message textarea (auto-suggested template)
  - Active toggle
  → actions: Cancel, Save Schedule, Save & Send Test
- Schedule Detail Sheet (trigger: row click) → content: full schedule config, last 10 deliveries, recipients list → actions: Run Now, Edit, Pause/Resume, Delete, Close
- Run Now AlertDialog (trigger: per-row "Run Now") → content: confirm immediate run + recipients will receive an email + count of expected rows → actions: Cancel, Run Now
- Delete Schedule AlertDialog (trigger: per-row "Delete") → content: confirm + warning that historical deliveries are retained → actions: Cancel, Delete (destructive)
- Logs Sheet (trigger: Delivery History "View Logs") → content: log lines → actions: Copy Logs, Close

---

### Custom Segmentation Builder (view-id: custom-segmentation) [NEW]

**Purpose**: A visual segment builder — "show me traders from US+GB who passed phase 2 in the last 30 days". Compose rules with AND/OR logic, preview the matching cohort live, save and reuse across analytics views.

**Layout** (top-to-bottom):
1. Page header — title "Custom Segmentation Builder", subtitle "Build reusable trader cohorts with rule-based filters.", primary "New Segment" button.
2. KPI strip — Saved Segments (count), Active Segments (count, used in last 30d), Avg Cohort Size (count of traders per segment, avg), Largest Segment (count + name).
3. Two-column main grid —
   - Left (wider): Rule Builder card.
     - Source entity select (Trader / Account / Payout / Order)
     - Match mode toggle (Match ALL (AND) / Match ANY (OR))
     - Rule list — each rule is a row with: attribute select (Country / Status / Phase / Win Rate / Equity / Trades / Payout Amount / KYC / Signup Date / Last Active / Challenge Type / Has Funded Account / Has Failed Account / etc.), operator select (equals / not equals / in / not in / greater than / less than / between / is set / is not set / relative date), value input (type varies by operator — text / number / multi-select pills / date / relative date like "last 30 days")
     - "+ Add Rule" button (appends a new row)
     - "+ Add Rule Group" button (appends a nested group with its own match-mode toggle)
   - Right (narrower): Live Preview card.
     - Matching count (large number) + "of N total traders"
     - Top 5 matching traders (avatar + name + email)
     - "View Full List" button → opens Sheet with all matching traders
4. Saved Segments card (below main grid) — DataTable of saved segments.

**Tables**:
- Saved Segments: Name (medium), Source (badge — Trader / Account / etc.), Rules Count (count), Match Mode (ALL / ANY badge), Cohort Size (count), Last Used (timestamp), Owner (avatar + name), Shared (count), Actions | per-row: Apply (toast + redirects to chosen analytics view), Edit (Sheet), Duplicate (toast), Share (Sheet), Delete (AlertDialog)

**Forms**: none on main page (Rule Builder is in the Rule Builder card itself, not a separate form).

**Actions** (buttons + behavior):
- Header "New Segment" → clears the Rule Builder
- Rule attribute select → updates operator options + value input type
- "+ Add Rule" → appends new rule row
- "+ Add Rule Group" → appends a nested group
- Per-rule "Remove" (icon button) → removes that rule
- Live Preview "View Full List" → open Matching Traders Sheet
- "Save Segment" button (top-right of Rule Builder) → open Save Segment Sheet
- "Test Segment" button → toast + applies the segment to a chosen analytics view in a new tab
- Saved Segments row "Apply" → opens Apply To Sheet (choose target view)
- Saved Segments row "Edit" → loads the segment into Rule Builder
- Saved Segments row "Duplicate" → toast + creates a copy
- Saved Segments row "Share" → open Share Sheet
- Saved Segments row "Delete" → AlertDialog

**Dialogs / Modals / Sheets**:
- Save Segment Sheet (trigger: "Save Segment" button) → content: name input, description textarea, category select, shared-with multi-select, make-default toggle → actions: Cancel, Save
- Matching Traders Sheet (trigger: "View Full List" in Live Preview) → content: paginated DataTable of all matching traders → actions: Export, Close
- Apply To Sheet (trigger: Saved Segments row "Apply") → content: target view select (Analytics Overview / Trader Analytics / Performance / Risk / Dashboard Tabs), open-in-new-tab toggle → actions: Cancel, Apply & Navigate
- Share Sheet (trigger: per-row "Share") → content: shared-with multi-select, permission select, message textarea → actions: Cancel, Send Invites
- Delete AlertDialog (trigger: per-row "Delete") → content: confirm + warning that any scheduled exports using this segment will fail → actions: Cancel, Delete (destructive)

---

## Batch 18 — Analytics Module (4 of 4) + Affiliates Module (1 of 4)

### Cohort Builder (view-id: cohort-builder) [NEW]

**Purpose**: Define custom cohorts for retention/churn analysis — pick the cohort anchor event (signup / first purchase / first funded account / first payout), the bucketing interval (daily / weekly / monthly), and the retention windows (e.g. +7d / +14d / +30d / +60d / +90d / +180d / +365d).

**Layout** (top-to-bottom):
1. Page header — title "Cohort Builder", subtitle "Define cohort anchors and retention windows for custom churn analysis.", primary "New Cohort" button.
2. KPI strip — Saved Cohorts (count), Active Cohorts (count), Avg Cohort Size (count), Avg Retention at +90d (%).
3. Two-column main grid —
   - Left (wider): Cohort Definition card.
     - Cohort name input
     - Anchor event select (Signup / First Purchase / First Funded Account / First Payout / Challenge Pass / Custom Event)
     - If Custom Event → event-name input + event-property select
     - Cohort start date (date)
     - Cohort end date (date)
     - Bucketing interval select (Daily / Weekly / Monthly)
     - Retention windows multi-select (Day 1 / Day 7 / Day 14 / Day 30 / Day 60 / Day 90 / Day 180 / Day 365)
     - Retention metric select (Active Account / Placed a Trade / Funded Account / Made a Payout Request / Any Activity)
     - Segment filter (links to Custom Segmentation Builder — only include traders in this segment)
     - Compare-to toggle (off / previous-period / same-cohort-last-year)
   - Right (narrower): Live Preview card.
     - Cohort count (large number) + "traders matching anchor event in window"
     - Mini cohort retention matrix (3 cohorts × selected windows, color-coded cells)
     - "View Full Matrix" button → opens Sheet with the full rendered cohort matrix
4. Saved Cohorts card — DataTable.

**Tables**:
- Saved Cohorts: Name (medium), Anchor Event (badge), Interval (Daily / Weekly / Monthly badge), Windows Count (count), Cohort Size (count), Avg Retention +90d (%), Last Run (timestamp), Owner (avatar + name), Actions | per-row: Run (toast), Edit (Sheet), Duplicate (toast), Share (Sheet), Delete (AlertDialog)

**Forms**: none on main page (Cohort Definition card contains the form inline).

**Actions** (buttons + behavior):
- Header "New Cohort" → clears the Cohort Definition card
- "Save Cohort" button (top-right of Cohort Definition) → open Save Cohort Sheet
- "Run Cohort" button → toast + computes the cohort matrix and shows it in Live Preview
- Live Preview "View Full Matrix" → open Full Matrix Sheet
- Saved Cohorts row "Run" → toast + computes
- Saved Cohorts row "Edit" → loads into Cohort Definition
- Saved Cohorts row "Duplicate" → toast
- Saved Cohorts row "Share" → open Share Sheet
- Saved Cohorts row "Delete" → AlertDialog

**Dialogs / Modals / Sheets**:
- Save Cohort Sheet (trigger: "Save Cohort" button) → content: name input (auto-suggested from anchor event + window), description textarea, category select, shared-with multi-select, schedule-recurring-run toggle (weekly / monthly) → actions: Cancel, Save
- Full Matrix Sheet (trigger: "View Full Matrix" in Live Preview) → content: complete cohort retention matrix with all cohort months × all retention windows, color-coded cells, drill-down per cell → actions: Export, Close
- Cohort Cell Drill-down Sheet (trigger: cell click in Full Matrix) → content: cohort month, retention window, list of traders in that cohort cell with their status → actions: Export, Trigger Outreach, Close
- Share Sheet (trigger: per-row "Share") → content: shared-with multi-select, permission select, message textarea → actions: Cancel, Send Invites
- Delete AlertDialog (trigger: per-row "Delete") → content: confirm + warning that any scheduled runs using this cohort will fail → actions: Cancel, Delete (destructive)

---

### Affiliates Overview (view-id: affiliates) [EXISTING]

**Purpose**: At-a-glance health of the affiliate program — total/active affiliates, conversions, commission earned, plus a 12-month commission trend chart and a recent-campaigns table.

**Layout** (top-to-bottom):
1. Page header — title "Affiliates", subtitle, header action: Export button.
2. KPI strip — four metric cards: Total Affiliates, Active (count, positive tone), Conversions (compact, delta %, positive tone), Commission Earned (currency, delta %, positive tone).
3. Commission Trend card — AreaSeries over 12 months, currency-formatted.
4. Recent Campaigns card — DataTable (top 5 by recent activity).

**Tables**:
- Recent Campaigns: Campaign (medium), Affiliate, Clicks (compact), Signups, Conv. (count), Revenue (currency, medium), Status (StatusBadge) | per-row: row click → **redesign target**: navigate to affiliate-campaign-detail (currently no row click)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export" → CSV with full affiliate list
- **New for redesign**: Header "Add Affiliate" / "Invite Affiliate" button → open Invite Sheet (links to Affiliate Onboarding view)
- **New for redesign**: Recent Campaigns row click → navigate to affiliate-campaign-detail
- **New for redesign**: Header date-range selector (Today / 7d / 30d / 90d / Custom)

**Dialogs / Modals / Sheets**:
- **New for redesign**: Invite Affiliate Sheet (trigger: header "Add Affiliate") → content: name input, email input, tier select (Bronze / Silver / Gold / Platinum), commission rate input, default campaign select, send-invite-email toggle, custom message textarea → actions: Cancel, Send Invite
- **New for redesign**: Custom Date Range Sheet (trigger: date-range selector → Custom) → content: start date, end date → actions: Cancel, Apply

---

### Affiliates List (view-id: affiliates-list) [EXISTING]

**Purpose**: A DataTable of every affiliate partner — name, code, tier, referrals, conversions, commission, status. Currently read-only; **redesign target**: add row-click to Affiliate Detail + per-row action menu + "Add Affiliate" button + bulk commission payout flow.

**Layout** (top-to-bottom):
1. Page header — title "Affiliates", subtitle.
2. **New for redesign**: Header actions block — "Add Affiliate" button, "Pay Outstanding Commission" button (bulk), "Export CSV" button.
3. **New for redesign**: Filter bar — search, tier select (All / Bronze / Silver / Gold / Platinum), status select (All / Active / Pending / Suspended), country filter, sort-by select.
4. Affiliates DataTable.

**Tables**:
- Affiliates: Name (medium), Code (mono), Tier (StatusBadge), Referrals (count), Conversions (count), Commission Earned (currency), Status (StatusBadge) | per-row: row click → **redesign target**: navigate to affiliate-detail; per-row action menu → Suspend / Reset Referral Code / View Campaigns / Pay Outstanding Commission

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Add Affiliate" → open Invite Sheet (links to Affiliate Onboarding)
- Header "Pay Outstanding Commission" → open Bulk Payout Sheet (lists all affiliates with pending commission; multi-select)
- Header "Export CSV" → export filtered rows
- Row click → navigate to affiliate-detail (currently missing)
- Per-row action menu (Lucide `MoreHorizontal`) → dropdown menu with: Suspend (AlertDialog), Reset Referral Code (AlertDialog), View Campaigns (navigates), Pay Outstanding Commission (Sheet), View Profile (navigates to affiliate-detail)

**Dialogs / Modals / Sheets**:
- Invite Sheet (trigger: header "Add Affiliate") → content: name, email, tier select, commission rate, default campaign, send-invite toggle, message → actions: Cancel, Send Invite
- Bulk Payout Sheet (trigger: header "Pay Outstanding Commission") → content: list of affiliates with pending commission (checkbox + name + pending amount + payment-method select), running total at bottom, payment-date input, note textarea → actions: Cancel, Pay Selected
- Suspend AlertDialog (trigger: per-row action menu "Suspend") → content: confirm suspension + reason textarea (required) + warning that affiliate's links stop redirecting → actions: Cancel, Suspend (destructive)
- Reset Referral Code AlertDialog (trigger: per-row action menu "Reset Referral Code") → content: confirm reset + warning that existing marketing creative using old code will 404 → actions: Cancel, Reset Code

---

### Campaigns (view-id: affiliates-campaigns) [EXISTING]

**Purpose**: A DataTable of affiliate marketing campaigns with ROI calculation. Currently read-only; **redesign target**: add "Add Campaign" button + per-row Pause/Resume/Delete + bulk actions.

**Layout** (top-to-bottom):
1. Page header — title "Campaigns", subtitle "Affiliate marketing campaigns and ROI."
2. **New for redesign**: Header actions — "Add Campaign" button, "Export CSV" button.
3. **New for redesign**: Filter bar — search, affiliate select, status select (All / Active / Paused / Ended), source select (Direct / Email / Social / Paid Ad / Referral / Banner).
4. Campaigns DataTable.

**Tables**:
- Campaigns: Campaign (medium), Affiliate, Clicks (compact), Signups, Conv. (count), Spend (currency), Revenue (currency, medium), ROI (% color-coded), Status (StatusBadge) | per-row: row click → **redesign target**: navigate to affiliate-campaign-detail; per-row action menu → Pause / Resume / Duplicate / Delete

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Add Campaign" → navigate to affiliate-campaign-detail (new campaign mode)
- Header "Export CSV" → export filtered
- Row click → navigate to affiliate-campaign-detail
- Per-row action menu → Pause (toast + AlertDialog if active) / Resume (toast) / Duplicate (toast) / Delete (AlertDialog)

**Dialogs / Modals / Sheets**:
- Pause Campaign AlertDialog (trigger: per-row action menu "Pause") → content: confirm pause + reason textarea (optional) + warning that the campaign's tracking links stop redirecting → actions: Cancel, Pause
- Delete Campaign AlertDialog (trigger: per-row action menu "Delete") → content: confirm + warning that historical click/conversion data is retained → actions: Cancel, Delete (destructive)

---

### Commissions (view-id: affiliates-commissions) [EXISTING]

**Purpose**: Affiliate commission summary — KPIs for total earned / pending / avg ticket / active partners, plus a per-affiliate ledger table. **Redesign target**: add "Pay Outstanding Commission" bulk action + row click → affiliate's commission ledger + date-range filter + export.

**Layout** (top-to-bottom):
1. Page header — title "Commissions", subtitle.
2. **New for redesign**: Header actions — "Pay Outstanding Commission" button, "Export CSV" button, date-range selector.
3. KPI strip — four metric cards: Total Earned (currency, positive), Pending Payout (currency, warning), Avg Ticket (currency), Active Partners (count, positive).
4. Commissions DataTable.

**Tables**:
- Commissions: Affiliate (medium), Tier (StatusBadge), Referrals (count), Conversions (count), Earned (currency, emerald), Pending (currency, amber), Status (StatusBadge) | per-row: row click → **redesign target**: open Commission Ledger Sheet for that affiliate

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Pay Outstanding Commission" → open Bulk Payout Sheet
- Header "Export CSV" → export filtered
- Header date-range selector → re-renders
- Row click → open Commission Ledger Sheet (currently missing)
- Per-row action menu → Pay Outstanding (Sheet), View Affiliate (navigates), View Campaigns (navigates)

**Dialogs / Modals / Sheets**:
- Bulk Payout Sheet (trigger: header "Pay Outstanding Commission") → content: list of affiliates with pending commission (checkbox + name + pending amount + payment-method select), running total, payment-date, note → actions: Cancel, Pay Selected
- Commission Ledger Sheet (trigger: row click) → content: affiliate block (name, tier, contact), per-conversion ledger (date, trader, conversion amount, commission %, commission amount, status), running totals → actions: Pay Outstanding, Export, Close

---

## Batch 19 — Affiliates Module (2 of 4)

### Offer Management (view-id: offer-management) [EXISTING]

**Purpose**: Operational table of coupon offers with status filter, inline detail panel beneath the table for the selected offer, and per-row View / Edit actions. **Redesign target**: "Add Offer" should navigate to offer-edit; add "Duplicate Offer" + "Archive / Delete" per-row + bulk actions.

**Layout** (top-to-bottom):
1. Page header — title "Offers & Promotions", subtitle, primary "Add Offer" button.
2. All Offers card — DataTable with status filter Select in the toolbar, count badge.
3. Inline detail panel (appears below the table when a row is selected) — Offer Detail Panel with two columns:
   - Left: offer basics (name, description, coupon code, discount %, start/end dates, matching-users count, status badge)
   - Right: targeting (target countries as outline badges or "All countries", target segments as outline badges or "No segments specified", matching-users count summary)
   - Footer actions: "View Change History" (ghost button → navigates), "Edit Offer" (primary button → navigates)

**Tables**:
- Offers: Name (medium), Coupon (mono), Discount (%), Status (StatusBadge), Start (date), End (date), Countries (badge with count or "All"), Matches (count), Actions | per-row: View (ghost button — toggles inline detail), Edit (ghost button → navigates to offer-edit), Duplicate (ghost button — toast), Archive (ghost button — AlertDialog), Delete (ghost button — AlertDialog)

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Add Offer" → navigate to offer-edit (new mode) — currently toast-only; redesign should navigate
- Per-row "View" → toggles inline detail panel
- Per-row "Edit" → navigate to offer-edit
- Per-row "Duplicate" → toast + creates a draft copy
- Per-row "Archive" → AlertDialog (offer moves to archived state, can be restored)
- Per-row "Delete" → AlertDialog (destructive, permanent)
- Row click → toggles inline detail panel (same as "View")
- Status filter Select → re-filters the table
- Inline detail "View Change History" → navigate to offer-change-history
- Inline detail "Edit Offer" → navigate to offer-edit
- **New for redesign**: Bulk-select with checkbox column + bulk actions (Activate / Pause / Archive / Export)

**Dialogs / Modals / Sheets**:
- Archive AlertDialog (trigger: per-row "Archive") → content: confirm + warning that the offer will no longer accept redemptions but historical data is retained → actions: Cancel, Archive
- Delete AlertDialog (trigger: per-row "Delete") → content: confirm permanent delete + warning that already-redeemed coupons keep their discount + warning that this cannot be undone → actions: Cancel, Delete (destructive)
- **New for redesign**: Bulk Archive AlertDialog (trigger: bulk "Archive" button) → content: confirm + count + consequence text → actions: Cancel, Archive N

---

### Offer Edit (view-id: offer-edit) [EXISTING]

**Purpose**: Comprehensive create/edit form for an Offer — basic info (title, description, image, coupon, discount, schedule, popup, url), country targeting (dual-list), challenge targeting (dual-list), user-segment rules (collapsible progressive disclosure), and 3 save variants + delete.

**Layout** (top-to-bottom):
1. Page header — title "New Offer" or "Edit Offer" (dynamic), subtitle, secondary "Back to Offers" button.
2. Related-context navigation bar (only when editing existing offer) — "View Matching Users" + "View Change History" ghost buttons.
3. Basic Information section card — grid form with: Title (input), Display Order (number input with help popover), Description (textarea), Offer Image (file upload with preview + remove), Coupon Code (mono input, auto-uppercases), Discount % (number input 0-100), Start Date (date input), End Date (date input), Is Popup (toggle with label + description), Offer URL (input with help popover).
4. Country Targeting section card — DualListBox with Available Countries (left, with checkboxes), middle controls (Add All / Remove All buttons), Selected Countries (right, with checkboxes).
5. Challenge Targeting section card — DualListBox with Available Challenges, controls, Selected Challenges.
6. User Segment section card (Collapsible) — CollapsibleTrigger header with chevron icon; CollapsibleContent reveals: Segment Name (input), Segment Active (toggle), 5 tri-state selects (Account Purchased / Competition User / Has Approved Payout / Fund Accounts Only / Has Failed Accounts), Account Size Min (number input with help), Account Size Max (number input with help), segment-preview footer.
7. Action bar (sticky bottom) — "Last updated" timestamp on left; buttons on right: Delete (destructive, only when editing), Save and add another (outline), Save and continue editing (outline), Save (primary).

**Forms**:
- Basic Information: Title (input), Display Order (number input), Description (textarea), Offer Image (file upload), Coupon Code (mono input), Discount % (number input 0-100), Start Date (date input), End Date (date input), Is Popup (toggle), Offer URL (input)
- User Segment: Segment Name (input), Segment Active (toggle), Account Purchased (tri-state select — Any / Yes / No), Competition User (tri-state select), Has Approved Payout (tri-state select), Fund Accounts Only (tri-state select), Has Failed Accounts (tri-state select), Account Size Min (number input), Account Size Max (number input)

**Actions** (buttons + behavior):
- Header "Back to Offers" → navigate to offer-management
- "View Matching Users" → navigate to offer-matching-users
- "View Change History" → navigate to offer-change-history
- Image "Remove image" → clears preview
- DualListBox "Add All" / "Remove All" → bulk-move items
- Per-item checkbox in Available → adds to Selected
- Per-item checkbox in Selected → removes from Selected
- CollapsibleTrigger click → toggles User Segment section
- Action bar "Delete" → open Delete AlertDialog
- Action bar "Save and add another" → toast + resets form (currently toast-stub; redesign should persist then reset)
- Action bar "Save and continue editing" → toast + keeps form populated (currently toast-stub)
- Action bar "Save" → toast + navigates to offer-management (currently toast-stub)
- **New for redesign**: "Preview as Trader" button in action bar → opens Sheet showing how the offer will look on the trader dashboard
- **New for redesign**: "Schedule Activation" button → opens Sheet with date/time input + activate-automatically toggle

**Dialogs / Modals / Sheets**:
- Delete AlertDialog (trigger: action bar "Delete") → content: confirm permanent delete + coupon code shown + warning that already-redeemed coupons keep their discount + cannot be undone → actions: Cancel, Delete offer (destructive)
- **New for redesign**: Preview as Trader Sheet (trigger: "Preview as Trader") → content: rendered preview of the offer as a trader would see it (popup or banner, depending on Is Popup toggle) → actions: Close
- **New for redesign**: Schedule Activation Sheet (trigger: "Schedule Activation") → content: activation date input, activation time input (UTC), activate-automatically toggle, deactivate-on-end-date toggle → actions: Cancel, Schedule

---

### Offer Matching Users (view-id: offer-matching-users) [EXISTING]

**Purpose**: A paginated list of users matching an offer's targeting rules — reached from Offer Edit's "View Matching Users" link. KPIs + paginated DataTable + per-row "View User" action.

**Layout** (top-to-bottom):
1. Page header — title "Matching Users — {offer name}", subtitle "Total Matching Users: {N} — these traders match the targeting rules defined for this offer.", secondary "Back to Offer" button.
2. Empty state (when no offer selected) — illustration, "Offer not found" heading, "Return to the offers list and select an offer" hint.
3. KPI strip — four metric cards: Total Matches (count), Funded Matches (count, positive), New Users (count, warning), Existing Users (count, default).
4. Matching Users card — DataTable header row with title + count badge + "100 per page · sorted by email" caption. Below the table: pagination footer with "Page X of Y · showing N of M matches" + Prev/Next buttons.

**Tables**:
- Matching Users: User Email (medium), Country (outline badge), Account Status (StatusBadge — Active / Invited / Suspended / Breached), Has Purchased (Yes/No StatusBadge), Funded (Yes/No StatusBadge), Actions | per-row: "View User" (ghost button → navigates to trader-detail)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Back to Offer" → navigate to offer-edit
- Per-row "View User" → navigate to trader-detail
- Pagination Prev / Next → loads the previous/next page slice (Next currently fires a toast in addition to pagination; **redesign target**: remove the noisy toast)
- **New for redesign**: Header "Export Matching Users" → CSV
- **New for redesign**: Per-row checkbox + bulk "Apply Offer to Selected" → toast + applies the offer to the selected users' accounts (manual override)
- **New for redesign**: Filter bar — country filter, account-status filter, has-purchased filter

**Dialogs / Modals / Sheets**:
- **New for redesign**: Apply Offer Confirmation Sheet (trigger: bulk "Apply Offer to Selected") → content: shows count + the offer being applied + each selected user → actions: Cancel, Apply to N Users

---

### Offer Change History (view-id: offer-change-history) [EXISTING]

**Purpose**: Per-object audit trail for an offer — every change with timestamp, actor (email + role badge), action (Added / Changed Image / Modified Targeting / Updated Discount / Activated / Deactivated), description with old→new values. Filtered DataTable + Export CSV.

**Layout** (top-to-bottom):
1. Page header — title "Change History — {offer name}", subtitle, secondary "Back to Offer" button, primary "Export CSV" button.
2. Empty state (when no offer selected) — same pattern as Matching Users empty state.
3. Change Entries card — DataTable header row with title + count badge + "Showing N of M total" caption. Toolbar with action-type filter Select.

**Tables**:
- Change Entries: Date / Time (xs), User (mono email + role outline badge), Action (color-coded badge — Added / Changed Image / Modified Targeting / Updated Discount / Activated / Deactivated), Description (xs + old→new values with colored chips: rose for old, emerald for new, with arrow icon between) | per-row: **redesign target**: row click → open Side-by-side Diff Viewer Sheet; per-row "Revert to this change" → AlertDialog

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Back to Offer" → navigate to offer-edit
- Header "Export CSV" → CSV with filtered entries
- Action-type filter Select → re-filters the table
- **New for redesign**: Row click → open Diff Viewer Sheet
- **New for redesign**: Per-row "Revert to this change" → AlertDialog

**Dialogs / Modals / Sheets**:
- **New for redesign**: Diff Viewer Sheet (trigger: row click) → content: side-by-side diff of the change — left = before state (all fields), right = after state (all fields), changed fields highlighted → actions: Revert to This Version (AlertDialog), Close
- **New for redesign**: Revert AlertDialog (trigger: per-row "Revert to this change" or Diff Viewer "Revert") → content: confirm + warning that this creates a new change-log entry (not a true revert) → actions: Cancel, Revert

---

### Affiliate Coupons (view-id: affiliate-coupons) [EXISTING]

**Purpose**: CRUD surface for coupon codes — KPI row, status/type filter, full Coupons DataTable with per-row Edit/Disable/Duplicate, Top Performing Coupons DataTable, Coupon Sheet (view + create), and Disable AlertDialog.

**Layout** (top-to-bottom):
1. Page header — title "Coupon Codes", subtitle, term hint, primary "Create Coupon" button, secondary "Export" button.
2. KPI strip — four metric cards: Active Coupons (count, with delta-label "X total · Y scheduled"), Total Redemptions (30d, compact, with delta-label), Discount Given (30d, currency, negative tone, with delta-label "reduces recognized revenue"), Revenue from Coupons (30d, currency, positive tone, with top-coupon delta-label).
3. All Coupons card — DataTable with status filter Select + type filter Select in toolbar + count badge.
4. Top Performing Coupons card — DataTable (top 5 by revenue attributed).

**Tables**:
- Coupons: Code (mono + Copy icon button), Description (xs muted, line-clamp-1), Type (icon + label — Percentage / Flat / Free Trial / Bonus Credit), Value (medium tabular-nums), Min Purchase (currency or "None"), Used (count / limit), Expires (icon + date), Status (StatusBadge — Active / Scheduled / Expired / Disabled), Actions | per-row: Edit (ghost button → opens Sheet in view mode), Disable (ghost button — only when active; opens AlertDialog), Duplicate (ghost icon button — toast)
- Top Performing Coupons: Code (mono + Copy icon button), Redemptions (count), Discount Given (currency, rose), Revenue (currency, emerald medium), Conv. Rate (% color-coded), Top Affiliate (xs)

**Forms**: none on main page. Coupon Sheet has the form.

**Actions** (buttons + behavior):
- Header "Create Coupon" → open Coupon Sheet (create mode)
- Header "Export" → CSV
- Per-row "Edit" → open Coupon Sheet (view mode, pre-filled)
- Per-row "Disable" (only active) → open Disable AlertDialog
- Per-row "Duplicate" → toast + creates draft copy
- Per-row Code "Copy" icon → clipboard + toast
- Top-performer Code "Copy" icon → clipboard + toast
- Row click → open Coupon Sheet (view mode)
- Status filter Select → re-filters
- Type filter Select → re-filters
- **New for redesign**: Per-row "Delete" button (only available when coupon has 0 redemptions) → AlertDialog (destructive, permanent)
- **New for redesign**: Bulk-select with checkbox column + "Bulk Disable" + "Bulk Export"

**Dialogs / Modals / Sheets**:
- Coupon Sheet (trigger: "Create Coupon" or per-row "Edit" or row click) → content:
  - Header: title (Create Coupon or Edit {code}), subtitle
  - Code field (mono input + Generate button — deterministic 8-char LCG)
  - Description (input)
  - Discount Type (select — Percentage / Flat / Free Trial / Bonus Credit) + Discount Value (number input — label changes per type)
  - Min Purchase (currency input with help popover)
  - Max Redemptions (number input with help) + Unlimited (checkbox)
  - Valid From (date input), Valid Until (date input)
  - Applicable Plans (4-checkbox grid — Starter / Growth / Scale / Enterprise, with help popover)
  - Owning Affiliate (select — list of affiliates or "Any affiliate", with help popover)
  - Status (toggle — Accepting redemptions / Disabled)
  → actions: Cancel, Save (or Create), Duplicate, Disable (if active)
- Disable AlertDialog (trigger: per-row "Disable" or "Disable" in Sheet) → content: confirm disable + warning that existing redemptions are honored + warning that tracked links return "code disabled" error + reversibility note → actions: Keep coupon, Disable coupon (destructive)
- **New for redesign**: Delete AlertDialog (trigger: per-row "Delete" for coupons with 0 redemptions) → content: confirm permanent delete + cannot be undone → actions: Cancel, Delete (destructive)
- **New for redesign**: Bulk Disable AlertDialog (trigger: bulk "Bulk Disable") → content: count + consequence text → actions: Cancel, Disable N (destructive)

---

## Batch 20 — Affiliates Module (3 of 4)

### Affiliate Link Tracking (view-id: affiliate-link-tracking) [EXISTING]

**Purpose**: Operational view of every affiliate tracking link — KPI row, affiliate/source/date filters, link-performance DataTable with per-row View/Suspend actions, click-trend area chart, source-distribution donut, top-affiliates table, geo-distribution table, and a Link Analytics Sheet (view + create) with mini click chart + recent-clicks table.

**Layout** (top-to-bottom):
1. Page header — title "Link Tracking", subtitle, term hint, primary "Create Link" button, secondary "Export" button.
2. KPI strip — four metric cards: Total Clicks (30d, compact, with delta-label "X unique"), Total Conversions (compact, with delta-label "funded trader signups"), Conversion Rate (%, with delta-label "industry benchmark 2-4%"), Top Affiliate Clicks (compact, with delta-label = top affiliate's name).
3. Link Performance card — DataTable with affiliate/source/date filters in toolbar + count badge.
4. Two-column grid — Click Trend (30d) AreaSeries (2 cols wide) + Clicks by Source DonutSeries (1 col narrow, with help popover).
5. Top Affiliates by Clicks card — DataTable (rank, name, links, clicks, conversions, revenue, conv rate, status).
6. Geo Distribution card — DataTable (top 10 countries by click volume).

**Tables**:
- Links: Link (mono URL truncated + Copy icon button), Affiliate (xs), Source (icon + label — Direct / Email / Social / Paid Ad / Referral / Banner), Clicks (compact), Unique (compact, muted), Conv. (count), Conv Rate (% color-coded), Revenue (currency, emerald medium), Status (StatusBadge), Actions | per-row: View (ghost button → opens Sheet), Suspend (ghost icon button — only when active; **redesign target**: AlertDialog, currently toast-stub)
- Top Affiliates: Rank (numbered badge, top-3 highlighted), Affiliate (medium), Links (count), Clicks (compact), Conv. (count), Revenue (currency, emerald), Conv Rate (% color-coded), Status (StatusBadge)
- Geo Distribution: Country (icon + label + ISO-2 outline badge), Clicks (compact), Conv. (count), Conv Rate (% color-coded), Revenue (currency, emerald)

**Forms**: none on main page. Link Analytics Sheet has the form.

**Actions** (buttons + behavior):
- Header "Create Link" → open Link Analytics Sheet (create mode)
- Header "Export" → CSV with filtered links
- Per-row "View" → open Link Analytics Sheet (view mode)
- Per-row "Suspend" (only active) → **redesign target**: AlertDialog (currently toast-stub)
- Per-row Link URL "Copy" icon → clipboard + toast
- Top-affiliate Code "Copy" icon → clipboard + toast
- Row click → open Link Analytics Sheet (view mode)
- Affiliate filter Select → re-filters
- Source filter Select → re-filters
- Date-range filter Select → re-filters
- **New for redesign**: Per-row "Delete" button → AlertDialog (destructive)
- **New for redesign**: Bulk-select with checkbox + "Bulk Disable" links

**Dialogs / Modals / Sheets**:
- Link Analytics Sheet (trigger: "Create Link" or per-row "View" or row click) → content:
  - Header: title (Create Tracking Link or "Link Analytics — {refCode}"), subtitle with click/conversion/revenue summary
  - Link URL (read-only mono input + Copy button + ExternalLink anchor)
  - Affiliate (select), Source (select with help popover), UTM Campaign (mono input with help), Created (read-only date input)
  - Click Analytics mini AreaSeries (30d, view mode only)
  - Recent Clicks inline mini-table (last 10 — timestamp, IP, country, device, converted badge)
  → actions: Cancel (create) / Save (or Create) primary, Suspend (if active, view mode), Delete (AlertDialog, view mode)
- Suspend AlertDialog (trigger: per-row "Suspend" or "Suspend" in Sheet) → content: confirm suspend + warning that the link stops redirecting + reversibility note → actions: Keep link, Suspend (destructive)
- Delete AlertDialog (trigger: per-row "Delete" or "Delete" in Sheet) → content: confirm permanent delete + warning that past click/conversion data is retained + warning that marketing creative pointing at this URL will 404 + cannot be undone → actions: Keep link, Delete link (destructive)
- **New for redesign**: Bulk Disable AlertDialog (trigger: bulk "Bulk Disable") → content: count + consequence text → actions: Cancel, Disable N (destructive)

---

### Affiliate Detail (view-id: affiliate-detail) [NEW]

**Purpose**: A single-affiliate deep-dive — profile block, commission history, campaigns, payouts, contact info, and a full audit timeline.

**Layout** (top-to-bottom):
1. Page header — back to Affiliates button, affiliate name as title, status badge, subtitle (tier + referrals + conversions).
2. Two-column layout —
   - Left (wider): a tab strip with 4 tabs:
     - Overview — KPI mini-cards (Lifetime Commission, Pending Payout, Avg Conversion Rate, Active Links) + commission trend AreaSeries (12 months) + recent payouts table (last 5)
     - Campaigns — DataTable of this affiliate's campaigns with click/signup/conversion/ROI columns
     - Commissions — DataTable of per-conversion commission ledger (date / trader / conversion amount / commission % / commission amount / status)
     - Audit Trail — DataTable of all affiliate-scoped audit events (timestamp / actor / action / before / after / ip)
   - Right (narrower): affiliate profile card (avatar, name, email, phone, country, tier badge, signup date, referral code mono + Copy button, default campaign) + contact card (primary contact name, email, phone, preferred contact method, timezone) + linked resources card (linked campaigns count, linked coupons count, linked tracking links count, recent activity)
3. Action bar (sticky at bottom of left column) — Edit Profile (Sheet), Suspend Affiliate (AlertDialog), Reset Referral Code (AlertDialog), Pay Outstanding Commission (Sheet), Send Message (Sheet), Export Profile (toast + CSV).

**Tables**:
- Recent Payouts (in Overview tab): Date, Amount (currency), Method, Status (StatusBadge), Reference (mono)
- Affiliate's Campaigns (in Campaigns tab): Campaign (medium), Status (StatusBadge), Clicks (compact), Signups, Conv. (count), Revenue (currency), Commission Earned (currency, emerald), ROI (% color-coded)
- Commission Ledger (in Commissions tab): Date, Trader (medium), Conversion Amount (currency), Commission % (%), Commission Amount (currency, emerald), Status (StatusBadge — Pending / Paid / Reversed), Payout Reference (mono linked to commission-payout view)
- Audit Trail (in Audit Trail tab): Timestamp, Actor (email + role badge), Action (badge), Field, Before (chip), After (chip), IP (mono)

**Forms**: none on main page. Edit Profile Sheet has fields.

**Actions** (buttons + behavior):
- Header "Back to Affiliates" → navigate to affiliates-list
- Tab strip click → switches the visible table
- Action bar "Edit Profile" → open Edit Profile Sheet
- Action bar "Suspend Affiliate" → AlertDialog (destructive)
- Action bar "Reset Referral Code" → AlertDialog
- Action bar "Pay Outstanding Commission" → open Commission Payout Sheet (single-affiliate mode, pre-filled)
- Action bar "Send Message" → open Send Message Sheet
- Action bar "Export Profile" → toast + CSV (full affiliate profile + ledger + campaigns)
- Referral code "Copy" icon → clipboard + toast
- Commission Ledger row "Payout Reference" click → navigate to commission-payout view
- **New for redesign**: Send invite to refer another affiliate

**Dialogs / Modals / Sheets**:
- Edit Profile Sheet (trigger: action bar "Edit Profile") → content: name input, email input, phone input, country select, tier select (Bronze / Silver / Gold / Platinum), commission rate input (override default), preferred contact method select, timezone select, notes textarea → actions: Cancel, Save
- Suspend AlertDialog (trigger: action bar "Suspend Affiliate") → content: confirm suspension + reason textarea (required) + warning that all this affiliate's links stop redirecting + reversibility note → actions: Cancel, Suspend (destructive)
- Reset Referral Code AlertDialog (trigger: action bar "Reset Referral Code") → content: confirm reset + warning that existing marketing creative using old code will 404 + new code preview → actions: Cancel, Reset Code
- Commission Payout Sheet (trigger: action bar "Pay Outstanding Commission") → content: affiliate block, outstanding amount, payment-method select, payment-date input, note textarea, schedule-for-later toggle → actions: Cancel, Pay Outstanding
- Send Message Sheet (trigger: action bar "Send Message") → content: template select (Custom / Welcome / Payout Notification / Tier Upgrade), subject input, body textarea → actions: Cancel, Send Now

---

### Campaign Detail / Edit (view-id: affiliate-campaign-detail) [NEW]

**Purpose**: Create or edit an affiliate campaign — basic info, budget, UTM config, creative assets, targeting, schedule, and a live preview of the tracking link.

**Layout** (top-to-bottom):
1. Page header — back to Campaigns button, title "New Campaign" or "Edit {campaign name}", subtitle, secondary "Save as Draft" button, primary "Save Campaign" button.
2. Two-column layout —
   - Left (wider): a stack of section cards:
     - Basic Information: Campaign Name (input), Description (textarea), Affiliate (select — populated from affiliates list), Status (select — Draft / Active / Paused / Ended)
     - Budget & Goals: Total Budget (currency input), Daily Cap (currency input), Conversion Goal (number input), Cost-per-Click cap (currency input), Cost-per-Conversion cap (currency input)
     - UTM Configuration: UTM Source (input, auto-filled from Source select), UTM Medium (input), UTM Campaign (input, auto-suggested), UTM Term (input), UTM Content (input), live preview of the full tracking URL (mono + Copy button)
     - Creative Assets: Banner Image (file upload + preview), Headline (input), Body Copy (textarea), CTA Text (input), Landing Page URL (input)
     - Targeting: Target Countries (multi-select pills), Target Segments (multi-select pills, links to Custom Segmentation), Device Targeting (checkboxes — Desktop / Mobile / Tablet)
     - Schedule: Start Date (date input), End Date (date input), Timezone (select), Activate-automatically toggle, Pause-on-end-date toggle
   - Right (narrower): Live Preview card.
     - Rendered preview of the banner as it will appear
     - Tracking URL preview (mono, with Copy button)
     - QR code for the URL
     - Estimated reach (based on targeting)
     - Cost estimate (based on budget × projected CPC)
3. Action bar (sticky bottom) — "Save as Draft" outline, "Save Campaign" primary.

**Forms**:
- Basic Information: Campaign Name (input), Description (textarea), Affiliate (select), Status (select)
- Budget & Goals: Total Budget (currency input), Daily Cap (currency input), Conversion Goal (number input), CPC cap (currency input), CPA cap (currency input)
- UTM Configuration: UTM Source (input), UTM Medium (input), UTM Campaign (input), UTM Term (input), UTM Content (input)
- Creative Assets: Banner Image (file upload), Headline (input), Body Copy (textarea), CTA Text (input), Landing Page URL (input)
- Targeting: Target Countries (multi-select pills), Target Segments (multi-select pills), Device Targeting (3 checkboxes)
- Schedule: Start Date (date), End Date (date), Timezone (select), Activate-automatically (toggle), Pause-on-end-date (toggle)

**Actions** (buttons + behavior):
- Header "Back to Campaigns" → navigate to affiliates-campaigns
- Header "Save as Draft" → toast + saves as draft, stays on page
- Header "Save Campaign" → toast + saves + navigates to affiliates-campaigns
- Live Preview "Copy Tracking URL" → clipboard + toast
- Banner Image upload → preview renders
- Banner Image "Remove" → clears preview

**Dialogs / Modals / Sheets**: none on main page.

---

### Commission Payout Flow (view-id: affiliate-commission-payout) [NEW]

**Purpose**: A workbench for processing commission payouts — initiate, review, approve, and pay outstanding commissions to one or many affiliates. Includes a payout ledger and a per-payout detail view.

**Layout** (top-to-bottom):
1. Page header — title "Commission Payouts", subtitle "Process and track commission payouts to affiliates.", primary "Initiate Payout" button, secondary "Export" button.
2. KPI strip — Pending Payouts (count + total amount), Approved (awaiting payment) (count + total), Paid This Month (count + total), Reversed (count + total), Avg Processing Time (hours).
3. Filter bar — search, Status select (All / Pending / Approved / Paid / Reversed), Affiliate select, Method select (Bank / Crypto / PayPal / Skrill / Wise), Date-range select.
4. Payouts table — list of commission payouts.
5. Payout queue (right rail or below) — a focused panel showing payouts that have been Approved and are awaiting disbursement, with a "Pay Now" button.

**Tables**:
- Commission Payouts: Reference (mono), Affiliate (medium), Period (e.g. "Sep 2026"), Outstanding Amount (currency), Method (icon + label), Status (ExplainableStateBadge — Pending / Approved / Paid / Reversed), Initiated At (timestamp), Approved At (timestamp), Paid At (timestamp), Actions | per-row: View (Sheet), Approve (AlertDialog, irreversible), Reject (AlertDialog), Mark Paid (toast), Reverse (AlertDialog, only when paid)

**Forms**: none on main page. Initiate Payout Sheet has fields.

**Actions** (buttons + behavior):
- Header "Initiate Payout" → open Initiate Payout Sheet
- Header "Export" → CSV
- Per-row "View" → open Payout Detail Sheet
- Per-row "Approve" → AlertDialog (irreversible)
- Per-row "Reject" → AlertDialog (with reason textarea)
- Per-row "Mark Paid" → toast + status flips to Paid + Paid At timestamp
- Per-row "Reverse" (only when paid) → AlertDialog (destructive)
- Row click → open Payout Detail Sheet
- Payout queue "Pay Now" → AlertDialog (batch pay all approved)

**Dialogs / Modals / Sheets**:
- Initiate Payout Sheet (trigger: header "Initiate Payout") → content: affiliate select (or "All affiliates with outstanding"), period select (Last Month / Last Quarter / Custom Range), method select, payment-date input, note textarea → actions: Cancel, Initiate Payout
- Payout Detail Sheet (trigger: per-row "View" or row click) → content: payout reference, affiliate block, period, outstanding amount, method details, audit timeline, linked conversions table → actions: Approve (AlertDialog), Reject (AlertDialog), Mark Paid, Reverse (AlertDialog), Close
- Approve AlertDialog (trigger: per-row "Approve" or Payout Detail "Approve") → content: confirm irreversible approve + amount + affiliate + expected disbursement date → actions: Cancel, Approve Payout
- Reject AlertDialog (trigger: per-row "Reject" or Payout Detail "Reject") → content: confirm rejection + reason textarea (required) → actions: Cancel, Reject (destructive)
- Reverse AlertDialog (trigger: per-row "Reverse" when paid) → content: confirm reversal + reason textarea (required) + warning that the affiliate's commission balance will be re-credited + finance flagged + action logged → actions: Cancel, Reverse (destructive)
- Pay Now AlertDialog (trigger: Payout queue "Pay Now") → content: count of approved payouts + total amount + confirm batch payment → actions: Cancel, Pay N Payouts

---

### Affiliate Onboarding / Invite (view-id: affiliate-onboarding) [NEW]

**Purpose**: A multi-step onboarding flow for new affiliates — collect profile info, set tier & commission, configure default campaign, send invite email with referral link, and track signup completion.

**Layout** (top-to-bottom):
1. Page header — title "Affiliate Onboarding", subtitle "Invite a new partner to the affiliate program.", secondary "Back to Affiliates" button.
2. Stepper card — a horizontal stepper with 4 steps: Profile → Tier & Commission → Campaign → Invite.
3. Step content card — renders the active step's form.
4. Step navigation footer — Back (outline, disabled on step 1), Next (primary), Save & Send Invite (primary, only on step 4).
5. Onboarding status sidebar — shows the affiliate's progress: Profile Complete, Tier Set, Default Campaign Set, Invite Sent, Invite Accepted, First Referral.

**Forms**:
- Step 1 (Profile): First Name (input), Last Name (input), Email (input), Phone (input), Country (select), Company (input, optional), Website (input, optional), Preferred Contact Method (select — Email / Phone / WhatsApp), Timezone (select)
- Step 2 (Tier & Commission): Tier (radio group — Bronze / Silver / Gold / Platinum, each with a description of perks), Default Commission Rate (number input %, with help popover explaining override behavior), Custom Commission per Challenge (toggle, reveals per-challenge rate inputs), Payout Method (select — Bank / Crypto / PayPal / Skrill / Wise), Payout Details (method-specific fields), Minimum Payout Threshold (currency input)
- Step 3 (Campaign): Default Campaign (select — pick from existing or "Create New"), if Create New → links to affiliate-campaign-detail, Tracking Link Format (select — Short / Long / Custom), UTM Defaults (source, medium, campaign)
- Step 4 (Invite): Invite Email Template (select — Welcome / Custom), Subject (input, auto-suggested), Body (textarea, auto-suggested template with placeholders for {name}, {referral_code}, {referral_link}), Send Invite toggle, Schedule Send (toggle, reveals date/time inputs), CC Account Manager (toggle, reveals email input)

**Actions** (buttons + behavior):
- Header "Back to Affiliates" → navigate to affiliates-list
- Stepper step click → jump to that step (only if previous steps are valid)
- Footer "Back" → previous step
- Footer "Next" → next step (validates current step; if invalid, shows inline errors)
- Footer "Save & Send Invite" → toast + creates the affiliate + sends the invite email + navigates to affiliate-detail
- Tier radio change → updates the default commission rate suggestion
- Custom Commission toggle → reveals per-challenge rate inputs
- Payout Method change → reveals method-specific fields
- Default Campaign "Create New" → navigate to affiliate-campaign-detail (new mode)

**Dialogs / Modals / Sheets**:
- Validation AlertDialog (trigger: "Next" with invalid step) → content: lists the fields requiring attention → actions: OK
- Save & Send Invite Confirmation AlertDialog (trigger: footer "Save & Send Invite") → content: summary of all entered data (name, email, tier, commission, default campaign, invite recipient) + warning that the invite cannot be unsent → actions: Cancel, Send Invite

---

## Batch 21 — Affiliates Module (4 of 4) + Accounting Module (1 of 3)

### Affiliate Performance Comparison (view-id: affiliate-comparison) [NEW]

**Purpose**: Side-by-side A/B comparison of up to 4 affiliates — pick the affiliates, choose the metrics, see overlaid trend charts and a comparison table.

**Layout** (top-to-bottom):
1. Page header — title "Affiliate Performance Comparison", subtitle "Side-by-side A/B comparison of up to 4 affiliates.", primary "Export" button.
2. Affiliate picker card — up to 4 affiliate selector slots. Each slot is a Search select populated from the affiliates list. Each chosen affiliate shows as a colored chip with their tier badge and a "Remove" X.
3. Metric selector card — multi-select of metrics to compare: Clicks, Unique Clicks, Conversions, Conversion Rate, Revenue, Commission Earned, ROI. Date-range selector (7d / 30d / 90d / Custom).
4. Comparison grid —
   - Top row: KPI comparison cards — one card per selected affiliate showing all selected metrics side-by-side
   - Middle row: overlaid trend chart — multi-line chart of the primary metric over the selected date range (one line per affiliate, color-coded)
   - Bottom row: comparison table — affiliates in columns, metrics in rows, with the winner highlighted per row
5. Insights card — auto-generated bullet findings ("Affiliate A has the highest conversion rate at X% but Affiliate B drives 3x more revenue due to higher AOV.").

**Tables**:
- Comparison Table: Metric (left column, medium), then one column per selected affiliate (color-coded by affiliate's color); cells show the metric value; winner cell highlighted with a star icon

**Forms**:
- Affiliate Picker: 4 affiliate SearchSelect slots
- Metric Selector: metric multi-select (checkboxes)
- Date Range: select (7d / 30d / 90d / Custom)

**Actions** (buttons + behavior):
- Header "Export" → CSV with the comparison data
- Per-affiliate "Remove" X → removes that affiliate from the comparison
- Affiliate SearchSelect change → adds the affiliate
- Metric checkbox toggle → adds/removes the metric column
- Date-range select → re-renders
- **New for redesign**: Comparison table cell click → drill-down Sheet for that affiliate + metric

**Dialogs / Modals / Sheets**:
- **New for redesign**: Drill-down Sheet (trigger: comparison table cell click) → content: affiliate + metric detail, per-day breakdown → actions: Export, Close

---

### Cookie Attribution Report (view-id: cookie-attribution) [NEW]

**Purpose**: First-touch vs last-touch attribution report — show how attribution changes between cookie models, which affiliates gain/lose under each, and recommend a model.

**Layout** (top-to-bottom):
1. Page header — title "Cookie Attribution Report", subtitle "First-touch vs last-touch attribution analysis across affiliate conversions.", primary "Export" button.
2. Attribution model selector card — radio group: First-Touch / Last-Touch / Linear / Time-Decay / Position-Based (40/20/40). Help popover explaining each model.
3. KPI strip — Total Attributed Revenue (under selected model), Affiliate Disputes (count — affiliates whose commission changes by > 10% under last-touch vs first-touch), Affiliates Gaining (count), Affiliates Losing (count).
4. Comparison table — list of affiliates with their attributed revenue under each model + delta vs current model.
5. Revenue difference chart — stacked bar chart showing per-affiliate revenue under first-touch (bottom) vs last-touch (top).
6. Recommendation card — auto-generated text recommending the best model for the firm based on data shape.

**Tables**:
- Attribution Comparison: Affiliate (medium + tier badge), Conversions (count), First-Touch Revenue (currency), Last-Touch Revenue (currency), Linear Revenue (currency), Time-Decay Revenue (currency), Delta First vs Last (currency + %, color-coded), Recommended Model (badge) | per-row: View Detail (opens Sheet)

**Forms**: none.

**Actions** (buttons + behavior):
- Header "Export" → CSV
- Attribution model radio change → re-renders the KPI strip + recommendation
- Per-row "View Detail" → open Affiliate Attribution Detail Sheet
- Row click → open Affiliate Attribution Detail Sheet

**Dialogs / Modals / Sheets**:
- Affiliate Attribution Detail Sheet (trigger: per-row "View Detail" or row click) → content: affiliate block, per-conversion attribution breakdown (date, trader, conversion amount, first-touch affiliate, last-touch affiliate, attributed revenue under selected model, revenue under each alternative model), timeline of touchpoints → actions: Export, Close

---

### Accounting Overview (view-id: accounting) [EXISTING]

**Purpose**: At-a-glance financial health — total revenue, payouts, fees, and net, with revenue-by-type bar chart, transaction-flow area chart, and an inline Net formula explanation. **Redesign target**: add date-range selector + drill-down from KPI to transactions + Create Journal Entry button + export.

**Layout** (top-to-bottom):
1. Page header — title "Accounting", subtitle, no header actions in current spec (**redesign target**: add Date-range selector + Export button + Create Journal Entry button).
2. Empty state (when no transactions) — illustration, "No transactions yet" heading, "Challenge entry fees, payouts, refunds, and commissions all flow into this ledger automatically." hint.
3. KPI strip — four metric cards: Total Revenue (currency, positive), Payouts (currency, negative), Fees (currency, warning), Net (currency, tone by sign) — each with a deltaLabel.
4. Net formula explanation card — inline LabelWithHelp with a popover explaining Net = Revenue − Payouts − Fees, with descriptions of each component.
5. Two-column grid — Revenue by Type (BarSeries — challenge-fee / subscription / payout / refund / commission) + Transaction Flow (AreaSeries — 12-month absolute-value buckets).

**Tables**: none.

**Forms**: none.

**Actions** (buttons + behavior):
- **New for redesign**: Header Date-range selector → re-renders KPIs + charts
- **New for redesign**: Header "Export CSV" → CSV with KPIs + flow series
- **New for redesign**: Header "Create Journal Entry" → open Journal Entry Sheet (links to journal-entries view)
- **New for redesign**: KPI card click → drill-down Sheet showing underlying transactions for that KPI

**Dialogs / Modals / Sheets**:
- **New for redesign**: KPI Drill-down Sheet (trigger: KPI card click) → content: KPI name, value, list of transactions contributing to the metric → actions: Export, Close
- **New for redesign**: Create Journal Entry Sheet (trigger: header "Create Journal Entry") → content: entry date, description, debit account select, credit account select, amount, reference, notes → actions: Cancel, Post Entry

---

### Transactions (view-id: accounting-transactions) [EXISTING]

**Purpose**: All financial transactions ledger — sortable/filterable DataTable with Export CSV. **Redesign target**: row click → transaction detail + filters (type/category/status/date range) + per-row action menu (View/Reconcile/Add Note) + bulk actions.

**Layout** (top-to-bottom):
1. Page header — title "Transactions", subtitle, header action: Export CSV button.
2. **New for redesign**: Filter bar — search, Type select (All / challenge-fee / subscription / payout / refund / commission), Category select, Status select (All / posted / pending / reconciled), Date-range select, trader/account filter.
3. Transactions DataTable.

**Tables**:
- Transactions: Reference (mono), Type (capitalized label), Description (muted), Amount (color-coded — green for inflow / red for outflow, with + / − sign), Category (capitalized label), Status (ExplainableStateBadge), Date (xs muted), Account (xs) | per-row: row click → **redesign target**: navigate to transaction-detail; per-row action menu → View / Reconcile (opens Sheet) / Add Note (opens Sheet)

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Export CSV" → export all transactions
- Row click → navigate to transaction-detail (currently missing)
- Per-row action menu → View (navigates), Reconcile (Sheet), Add Note (Sheet)
- **New for redesign**: Filter bar — Type / Category / Status / Date-range / trader
- **New for redesign**: Bulk-select with checkbox column + bulk "Reconcile Selected" / "Export Selected" / "Add Note to Selected"

**Dialogs / Modals / Sheets**:
- Reconcile Sheet (trigger: per-row action menu "Reconcile") → content: transaction block, bank-statement match suggestion (auto-matched by amount + date ±2 days), manual match input → actions: Cancel, Mark Reconciled
- Add Note Sheet (trigger: per-row action menu "Add Note") → content: note textarea, visibility select (Internal / Auditor-visible) → actions: Cancel, Save Note

---

### Reconciliation (view-id: accounting-reconciliation) [EXISTING]

**Purpose**: Match ledger entries against bank statements — KPIs for total/reconciled/pending/rate, plus a per-row Reconcile button (AlertDialog). **Redesign target**: bulk reconcile + Import Bank Statement flow + Discrepancy workflow + filter by date/type/amount + Reopen Reconciled + reconciled transactions excluded from view.

**Layout** (top-to-bottom):
1. Page header — title "Reconciliation", subtitle.
2. KPI strip — four metric cards: Total Volume (currency), Reconciled (currency, positive), Pending (currency, warning), Reconciliation Rate (%, tone by ≥80%).
3. **New for redesign**: Filter bar — search, Type select, Date-range select, Amount-range inputs (min / max), Show Reconciled toggle (off by default — reconciled transactions excluded from view).
4. **New for redesign**: Import banner — at the top, an "Import Bank Statement" button + last-import summary.
5. Reconciliation table — currently filtered to status ≠ reconciled.

**Tables**:
- Reconciliation Queue: Reference (mono), Type (capitalized), Description (muted), Amount (currency, medium), Account (xs), Status (ExplainableStateBadge), Actions | per-row: Reconcile (default button → AlertDialog) when not reconciled; "Cleared" text label when reconciled

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Per-row "Reconcile" → AlertDialog with consequence text
- **New for redesign**: Header "Import Bank Statement" → open Import Sheet
- **New for redesign**: Bulk-select + "Reconcile Selected" → AlertDialog (bulk)
- **New for redesign**: Filter bar — Type / Date-range / Amount-range / Show Reconciled toggle
- **New for redesign**: Per-row "Reopen" (only when reconciled, requires Show Reconciled toggle on) → AlertDialog
- **New for redesign**: Per-row "Flag Discrepancy" (when amount doesn't match any bank entry) → open Discrepancy Sheet

**Dialogs / Modals / Sheets**:
- Reconcile AlertDialog (trigger: per-row "Reconcile") → content: confirm reconciliation + warning that discrepancies will be flagged in audit log + reversibility note → actions: Cancel, Reconcile
- Bulk Reconcile AlertDialog (trigger: bulk "Reconcile Selected") → content: count + total amount + consequence text → actions: Cancel, Reconcile N
- Reopen AlertDialog (trigger: per-row "Reopen") → content: confirm reopen + reason textarea (required) → actions: Cancel, Reopen
- Import Bank Statement Sheet (trigger: header "Import Bank Statement") → content: file upload (.csv / .xlsx / .ofx / .qif), bank-account select, date-range covered, auto-match toggle, preview of detected matches → actions: Cancel, Import & Auto-Match
- Discrepancy Sheet (trigger: per-row "Flag Discrepancy") → content: transaction block, expected amount, actual bank amount, difference, reason textarea, resolution select (Manual Adjustment / Bank Error / Duplicate / Other) → actions: Cancel, Submit Discrepancy

---

## Batch 22 — Accounting Module (2 of 3)

### Invoices (view-id: accounting-invoices) [EXISTING]

**Purpose**: Generate, send, track invoices — KPI strip, status/date filters, full DataTable with per-row View/Send/Mark Paid/Cancel/PDF actions, View Invoice Sheet (full invoice with line items + totals + Bill From/To + notes), Create Invoice Sheet (draft creation with line-item template), and Cancel AlertDialog.

**Layout** (top-to-bottom):
1. Page header — title "Invoices", subtitle, term hint, primary "Create Invoice" button.
2. KPI strip — four metric cards: Outstanding (currency, warning, with delta-label "X unpaid"), Paid This Month (currency, positive, with delta-label "X invoices cleared"), Overdue (count, negative, with delta-label "past their due date"), Avg Days to Pay (label, with delta-label "target: 15 days").
3. Filter bar — status filter Select + date-range Select + "N of M invoices" counter + Export CSV button.
4. Invoices DataTable.

**Tables**:
- Invoices: Invoice # (mono), Trader (medium + email below), Issue Date (xs muted), Due Date (xs, rose + medium if overdue), Amount (tabular-nums), Tax (tabular-nums muted), Total (tabular-nums medium), Status (StatusBadge — draft / sent / paid / overdue / cancelled), Actions | per-row: View (ghost → opens Sheet), PDF (ghost → toast + triggers download), Send (ghost, only when draft/sent), Paid (ghost emerald, when not paid/cancelled), Cancel (ghost rose, when not cancelled/paid)

**Forms**: none on main page. Create Invoice Sheet has fields.

**Actions** (buttons + behavior):
- Header "Create Invoice" → open Create Invoice Sheet
- Filter bar status Select → re-filters
- Filter bar date-range Select → re-filters
- Filter bar "Export CSV" → CSV
- Per-row "View" → open View Invoice Sheet
- Per-row "PDF" → toast + triggers PDF download (currently toast-stub)
- Per-row "Send" → toast + sends email (currently toast-stub)
- Per-row "Paid" → toast + marks as paid (currently toast-stub)
- Per-row "Cancel" → open Cancel AlertDialog
- Row click → open View Invoice Sheet
- View Invoice Sheet "Download PDF" → toast + PDF download (currently toast-stub)
- View Invoice Sheet "Send Email" → toast (currently toast-stub)
- View Invoice Sheet "Mark Paid" → toast (currently toast-stub)
- View Invoice Sheet "Cancel Invoice" → open Cancel AlertDialog
- Create Invoice Sheet "Download PDF" → toast (currently toast-stub)
- Create Invoice Sheet "Send Email" → toast (currently toast-stub)
- Create Invoice Sheet "Save Draft" → toast + closes Sheet (currently toast-stub)
- **New for redesign**: Per-row "Edit Invoice" → navigate to invoice-edit (new view, currently missing) — only available for draft invoices
- **New for redesign**: Per-row "Issue Refund / Credit Note" → open Refund Sheet (links to refunds-credit-notes view)
- **New for redesign**: Per-row "View Trader" → navigate to trader-detail
- **New for redesign**: Per-row "Recurring Schedule" → open Recurring Schedule Sheet (links to recurring-invoices view)

**Dialogs / Modals / Sheets**:
- View Invoice Sheet (trigger: per-row "View" or row click) → content: invoice header (id + status badge), Bill From block (brand name + email + Financial Operations label), Bill To block (trader name + email + "Trader" label), line-items grid (Description / Qty / Unit / Tax / Total), totals block (Subtotal / Tax / Grand Total), notes block (if any), footer actions → actions: Download PDF, Send Email (if draft/sent), Mark Paid (if not paid/cancelled), Cancel Invoice (if not cancelled/paid)
- Create Invoice Sheet (trigger: header "Create Invoice") → content: trader name input, email input, issue date, due date, default-template line items preview (read-only — 2-Step Challenge × 1 + Addon: Reset Token × 2), totals block (Subtotal / Tax / Grand Total), notes textarea → actions: Download PDF, Send Email, Save Draft (primary)
- Cancel AlertDialog (trigger: per-row "Cancel" or View Sheet "Cancel Invoice") → content: confirm cancel + warning that owed balance is released + trader will be notified + cannot be re-activated → actions: Keep invoice, Void invoice (destructive)
- **New for redesign**: Issue Refund Sheet (trigger: per-row "Issue Refund") → content: original invoice block, refund amount input (defaults to full), reason select (Duplicate Charge / Service Disruption / Trader Request / Other), reason detail textarea, issue-credit-note toggle → actions: Cancel, Issue Refund
- **New for redesign**: Recurring Schedule Sheet (trigger: per-row "Recurring Schedule") → content: recurrence select (Weekly / Monthly / Quarterly / Yearly), next-issue date, end-date input (optional), auto-send toggle, auto-mark-paid toggle → actions: Cancel, Save Schedule

---

### P&L Statement (view-id: accounting-pl) [EXISTING]

**Purpose**: Vertical income statement — Revenue → COGS → Gross Profit → OpEx → Operating Profit → Other (Interest + Tax) → Net Profit — with KPI strip, vertical P&L section card, two charts (Revenue vs Expenses grouped bars, Profit Margin Trend area), and Export CSV + PDF download. Each line item shows amount + % of revenue, with help popovers for technical terms.

**Layout** (top-to-bottom):
1. Page header — title "P&L Statement", subtitle, term hint, header actions: Period select (This Month / Last Month / This Quarter / Last Quarter / This Year / Last Year / Custom Range), PDF button (outline), Export CSV button (outline).
2. KPI strip — four metric cards: Total Revenue (currency, positive, with delta-label "100% of revenue"), Total Expenses (currency, negative, with delta-label "COGS + OpEx + Other"), Net Profit (currency, tone by sign, with delta-label "margin X%"), Profit Margin (%, positive, with delta-label "industry benchmark: 18-25%").
3. P&L Statement card — large bordered card with title + period label. Inside: a vertical stack of 4 sections (Revenue / COGS / OpEx / Other), each with section title, list of rows (each row: label with optional help popover + amount + % of revenue), and a section-total row at the bottom. Then two emphasis rows: Gross Profit (between COGS and OpEx) and Operating Profit (EBIT) (after OpEx). Then a final Net Profit block with large emphasis (large font + colored).
4. Charts row (2 columns) — Revenue vs Expenses grouped bars (12-month trend, two-color) + Profit Margin Trend AreaSeries (12-month %).
5. Footnote — explainability caption.

**Tables**: none (the P&L is a custom vertical layout, not a DataTable).

**Forms**: none.

**Actions** (buttons + behavior):
- Header Period select → re-renders statement
- Header "PDF" → toast + triggers PDF download (currently toast-stub)
- Header "Export CSV" → CSV with section / label / amount / % of revenue
- **New for redesign**: P&L line click → drill-down Sheet showing underlying transactions for that line item
- **New for redesign**: "Compare Periods" toggle in header → side-by-side comparison view
- **New for redesign**: "Audit Trail" button → open Audit Trail Sheet

**Dialogs / Modals / Sheets**:
- **New for redesign**: Line Drill-down Sheet (trigger: P&L line click) → content: line label, amount, list of transactions contributing → actions: Export, Close
- **New for redesign**: Compare Periods Sheet (trigger: header "Compare Periods" toggle) → content: side-by-side current vs previous period P&L with delta column → actions: Close
- **New for redesign**: Audit Trail Sheet (trigger: header "Audit Trail") → content: list of all P&L adjustments for the period (timestamp / actor / line item / before / after / reason) → actions: Export, Close
- Custom Range Sheet (trigger: Period select → Custom Range) → content: start date, end date → actions: Cancel, Apply

---

### Transaction Detail (view-id: transaction-detail) [NEW]

**Purpose**: Single-transaction deep-dive — full record, linked invoice/payout/trader, audit timeline, reconciliation status, and reversal path.

**Layout** (top-to-bottom):
1. Page header — back to Transactions button, transaction reference (mono) as title, status badge (ExplainableStateBadge), subtitle (type + amount + trader).
2. KPI strip — Amount (currency, color-coded by direction), Type (label), Category (label), Date (timestamp + relative), Account (label), Reconciliation Status (badge).
3. Two-column layout —
   - Left (wider): Transaction Lifecycle card (vertical stepper showing each state transition with timestamp + actor + note), Audit Trail card (table of timestamp / actor / action / before / after / ip).
   - Right (narrower): Linked Invoice card (if applicable — link to invoice-detail), Linked Payout card (if applicable — link to payout-detail), Linked Trader card (link to trader-detail), Bank Statement Match card (if reconciled — shows the matched bank entry; if not — shows "No match found" + "Match Manually" button).
4. Action bar (sticky at bottom) — Add Note (Sheet), Reconcile (AlertDialog), Reverse (AlertDialog, only for posted/reconciled), Export PDF (toast + download), Copy Reference (clipboard).

**Tables**:
- Audit Trail: Timestamp, Actor (email + role badge), Action (badge — Posted / Reconciled / Reversed / Note Added / Flagged), Note (text), IP (mono), Before → After (two color-coded chips)

**Forms**: none on page.

**Actions** (buttons + behavior):
- Header "Back to Transactions" → navigate to accounting-transactions
- Action bar "Add Note" → open Add Note Sheet
- Action bar "Reconcile" → AlertDialog (only when not reconciled)
- Action bar "Reverse" → AlertDialog (destructive, only when posted/reconciled)
- Action bar "Export PDF" → toast + download
- Action bar "Copy Reference" → clipboard
- Linked Invoice link → navigate to invoice-detail
- Linked Payout link → navigate to payout-detail
- Linked Trader link → navigate to trader-detail
- Bank Statement Match "Match Manually" → open Manual Match Sheet

**Dialogs / Modals / Sheets**:
- Add Note Sheet (trigger: action bar "Add Note") → content: note textarea, visibility select (Internal / Auditor-visible) → actions: Cancel, Save Note
- Reconcile AlertDialog (trigger: action bar "Reconcile") → content: confirm reconciliation + warning that discrepancies will be flagged → actions: Cancel, Reconcile
- Reverse AlertDialog (trigger: action bar "Reverse") → content: confirm reversal + reason textarea (required) + warning that the reversal creates a new offsetting transaction + finance flagged + action logged → actions: Cancel, Reverse (destructive)
- Manual Match Sheet (trigger: "Match Manually" in Bank Statement Match card) → content: list of unmatched bank entries (filtered by amount ±5% + date ±2 days), select one to match → actions: Cancel, Match Selected

---

### Bank Statement Import (view-id: bank-statement-import) [NEW]

**Purpose**: A workbench for importing bank statements (CSV / XLSX / OFX / QIF) — drag-drop upload, column-mapping, auto-match against ledger, discrepancy review, and reconciliation.

**Layout** (top-to-bottom):
1. Page header — title "Bank Statement Import", subtitle "Upload bank statements to auto-match against ledger transactions.", primary "New Import" button.
2. KPI strip — Total Imports (count), Auto-Matched (count + % of imported rows), Pending Review (count), Discrepancies (count), Last Import (timestamp + filename).
3. Imports table — list of past imports.
4. Pending Review card — list of imported rows awaiting manual match.

**Tables**:
- Imports: Filename (mono), Bank Account (label), Date Range (start → end), Rows Imported (count), Auto-Matched (count + %), Pending (count), Discrepancies (count), Imported At (timestamp), Imported By (avatar + name), Status (StatusBadge — Processing / Completed / Failed), Actions | per-row: View Details (Sheet), Re-run Auto-Match (toast), Delete (AlertDialog)
- Pending Review: Import Date, Bank Description, Bank Amount (currency), Suggested Match (transaction reference, if auto-matched), Match Confidence (% color-coded), Actions | per-row: Match (opens Sheet), Skip (toast), Flag Discrepancy (opens Sheet)

**Forms**: none on main page. New Import Sheet has multiple steps.

**Actions** (buttons + behavior):
- Header "New Import" → open New Import Sheet (multi-step)
- Per-row "View Details" → open Import Details Sheet
- Per-row "Re-run Auto-Match" → toast + re-runs
- Per-row "Delete" → AlertDialog (destructive)
- Pending Review "Match" → open Manual Match Sheet
- Pending Review "Skip" → toast + marks row as skipped
- Pending Review "Flag Discrepancy" → open Discrepancy Sheet

**Dialogs / Modals / Sheets**:
- New Import Sheet (multi-step, trigger: header "New Import"):
  - Step 1 (Upload): file drag-drop area (accepts .csv / .xlsx / .ofx / .qif), bank-account select
  - Step 2 (Map Columns): source columns on left → target fields on right (Date / Description / Amount / Currency / Reference), with auto-detection but editable
  - Step 3 (Preview): preview of first 10 rows + auto-match summary (X of Y rows auto-matched)
  - Step 4 (Confirm): import options (auto-reconcile matches toggle, flag discrepancies toggle), confirm button
  → actions: Cancel, Back, Next, Import (final step)
- Import Details Sheet (trigger: per-row "View Details") → content: full imported rows table, match results per row, discrepancies → actions: Re-run Auto-Match, Export, Close
- Manual Match Sheet (trigger: Pending Review "Match") → content: bank row block, list of candidate ledger transactions (filtered by amount ±5% + date ±2 days), select one → actions: Cancel, Match Selected
- Discrepancy Sheet (trigger: "Flag Discrepancy") → content: bank row, expected match, difference, reason select, resolution select → actions: Cancel, Submit Discrepancy
- Delete Import AlertDialog (trigger: per-row "Delete") → content: confirm + warning that any reconciliations based on this import will be reopened → actions: Cancel, Delete (destructive)

---

### Journal Entries / Manual Adjustments (view-id: journal-entries) [NEW]

**Purpose**: Create and review manual journal entries — post debits/credits to the general ledger, with approval workflow for entries above a threshold.

**Layout** (top-to-bottom):
1. Page header — title "Journal Entries", subtitle "Manual adjustments to the general ledger.", primary "New Entry" button, secondary "Export" button.
2. KPI strip — Pending Approval (count + total amount), Posted Today (count + total), Reversed (count, 30d), Avg Approval Time (hours), Largest Pending (currency + reference).
3. Pending Approval banner (when count > 0) — list of entries awaiting approval with "Approve" / "Reject" buttons.
4. Filter bar — search, Status select (All / Draft / Pending Approval / Posted / Reversed), Type select (Manual Adjustment / Accrual / Deferral / Correction / Reclassification), Date-range select, account filter.
5. Journal Entries table.

**Tables**:
- Journal Entries: Reference (mono), Date (xs), Description (medium), Debit Account (label), Credit Account (label), Amount (currency), Type (badge), Status (ExplainableStateBadge — Draft / Pending Approval / Posted / Reversed), Created By (avatar + name), Approved By (avatar + name, or "—"), Actions | per-row: View (Sheet), Approve (AlertDialog, if pending), Reject (AlertDialog, if pending), Post (AlertDialog, if draft), Reverse (AlertDialog, if posted)

**Forms**: none on main page. New Entry Sheet has fields.

**Actions** (buttons + behavior):
- Header "New Entry" → open New Entry Sheet
- Header "Export" → CSV
- Per-row "View" → open Entry Detail Sheet
- Per-row "Approve" → AlertDialog (only when pending)
- Per-row "Reject" → AlertDialog with reason textarea (only when pending)
- Per-row "Post" → AlertDialog (only when draft)
- Per-row "Reverse" → AlertDialog (destructive, only when posted)
- Row click → open Entry Detail Sheet
- Pending Approval banner "Approve" / "Reject" → same as per-row

**Dialogs / Modals / Sheets**:
- New Entry Sheet (trigger: header "New Entry") → content: entry date, description, debit account select, credit account select, amount, currency select, reference (mono, auto-suggested), notes textarea, requires-approval toggle (auto-on if amount > threshold) → actions: Cancel, Save as Draft, Post (if no approval required), Submit for Approval (if approval required)
- Entry Detail Sheet (trigger: per-row "View" or row click) → content: full entry record, debit/credit blocks, audit timeline, approver block → actions: Approve, Reject, Post, Reverse, Close
- Approve AlertDialog (trigger: per-row "Approve") → content: confirm approval + warning that the entry will post to the general ledger + cannot be undone → actions: Cancel, Approve
- Reject AlertDialog (trigger: per-row "Reject") → content: confirm rejection + reason textarea (required) → actions: Cancel, Reject (destructive)
- Post AlertDialog (trigger: per-row "Post") → content: confirm post + warning that the entry is now in the general ledger → actions: Cancel, Post Entry
- Reverse AlertDialog (trigger: per-row "Reverse") → content: confirm reversal + reason textarea (required) + warning that a new offsetting entry will be created → actions: Cancel, Reverse (destructive)

---

## Batch 23 — Accounting Module (3 of 3)

### Refunds / Credit Notes (view-id: refunds-credit-notes) [NEW]

**Purpose**: A workbench for processing refunds and issuing credit notes — initiated from an invoice or as a standalone, with approval workflow above a threshold.

**Layout** (top-to-bottom):
1. Page header — title "Refunds & Credit Notes", subtitle "Process refunds and issue credit notes against invoices.", primary "New Refund" button, secondary "Export" button.
2. KPI strip — Pending Refunds (count + total amount), Completed Refunds (30d, count + total), Credit Notes Issued (30d, count + total), Disputed Refunds (count), Avg Processing Time (hours).
3. Pending Approval banner (when count > 0) — list of refunds awaiting approval.
4. Filter bar — search, Status select (All / Pending / Approved / Completed / Rejected / Disputed), Type select (Refund / Credit Note / Partial Refund / Full Refund), Date-range select, invoice filter.
5. Refunds table.

**Tables**:
- Refunds: Reference (mono), Original Invoice (mono, linked to invoice-detail), Trader (medium), Original Amount (currency), Refund Amount (currency, may be partial), Type (badge — Full / Partial / Credit Note), Reason (badge — Duplicate Charge / Service Disruption / Trader Request / Bank Reject / Other), Status (ExplainableStateBadge), Initiated At (timestamp), Initiator (avatar + name), Actions | per-row: View (Sheet), Approve (AlertDialog), Reject (AlertDialog), Mark Completed (toast)

**Forms**: none on main page. New Refund Sheet has fields.

**Actions** (buttons + behavior):
- Header "New Refund" → open New Refund Sheet
- Header "Export" → CSV
- Per-row "View" → open Refund Detail Sheet
- Per-row "Approve" → AlertDialog
- Per-row "Reject" → AlertDialog with reason textarea
- Per-row "Mark Completed" → toast + status flips
- Row click → open Refund Detail Sheet

**Dialogs / Modals / Sheets**:
- New Refund Sheet (trigger: header "New Refund") → content: original invoice select (search-by-reference, auto-populates trader + amount), refund amount input (defaults to full), type select (Full / Partial / Credit Note), reason select, reason detail textarea, trader-notification toggle, issue-credit-note toggle (auto-on if type = Credit Note), requires-approval toggle (auto-on if amount > threshold) → actions: Cancel, Save as Draft, Submit for Approval
- Refund Detail Sheet (trigger: per-row "View" or row click) → content: full refund record, original invoice snapshot, audit timeline, trader context, linked transactions → actions: Approve, Reject, Mark Completed, Link to Dispute, Close
- Approve AlertDialog (trigger: per-row "Approve") → content: confirm + warning that the refund will be processed + trader notified + finance flagged → actions: Cancel, Approve Refund
- Reject AlertDialog (trigger: per-row "Reject") → content: confirm + reason textarea (required) → actions: Cancel, Reject (destructive)

---

### Recurring Invoices (view-id: recurring-invoices) [NEW]

**Purpose**: Manage recurring invoice schedules — weekly/monthly/quarterly/yearly cadences, auto-send and auto-mark-paid toggles, next-issue preview, and a history of generated invoices.

**Layout** (top-to-bottom):
1. Page header — title "Recurring Invoices", subtitle "Schedule invoices to generate and send on a cadence.", primary "New Schedule" button.
2. KPI strip — Active Schedules (count), Paused Schedules (count), Next Issue (timestamp + trader name), Generated This Month (count + total amount), Failed Issues (count, last 7d).
3. Failed Issues banner (when count > 0) — list of recent failures with "Retry" buttons.
4. Filter bar — search, frequency select (All / Daily / Weekly / Monthly / Quarterly / Yearly), status select (All / Active / Paused / Failed).
5. Schedules table.
6. Generated Invoices History card — a table of the last 20 invoices generated by recurring schedules.

**Tables**:
- Schedules: Name (medium, auto-suggested from trader + frequency), Trader (medium), Frequency (badge), Next Issue (timestamp + relative), Amount (currency), Auto-Send (badge), Auto-Mark-Paid (badge), Status (StatusBadge), Last Issue (timestamp + status icon), Actions | per-row: Run Now (AlertDialog), Edit (Sheet), Pause/Resume (toggle), Delete (AlertDialog)
- Generated Invoices History: Generated At, Schedule Name, Invoice # (mono, linked to invoice-detail), Amount (currency), Send Status (Success / Failed badge), Mark Paid Status (Auto / Manual badge), Actions | per-row: View Invoice (navigates), Retry Send (if failed)

**Forms**: none on main page. New Schedule Sheet has fields.

**Actions** (buttons + behavior):
- Header "New Schedule" → open New Schedule Sheet
- Per-row "Run Now" → AlertDialog
- Per-row "Edit" → open Edit Schedule Sheet
- Per-row Pause/Resume toggle → toast
- Per-row "Delete" → AlertDialog (destructive)
- Per-row click → open Schedule Detail Sheet
- Generated History "View Invoice" → navigate to invoice-detail
- Generated History "Retry Send" → toast + queues re-send

**Dialogs / Modals / Sheets**:
- New/Edit Schedule Sheet (trigger: "New Schedule" or per-row "Edit") → content: schedule name (auto-suggested), trader select (auto-populates email + amount), frequency select (Daily / Weekly / Monthly / Quarterly / Yearly), day-of-week multi-select (when Weekly), day-of-month select (when Monthly), month-of-year select (when Quarterly/Yearly), start date, end date (optional), amount input, line-items template (editable), auto-send toggle, auto-mark-paid toggle, active toggle → actions: Cancel, Save Schedule
- Schedule Detail Sheet (trigger: row click) → content: full schedule config, last 10 generated invoices, linked trader → actions: Run Now, Edit, Pause/Resume, Delete, Close
- Run Now AlertDialog (trigger: per-row "Run Now") → content: confirm immediate issue + warning that trader will receive an email → actions: Cancel, Run Now
- Delete Schedule AlertDialog (trigger: per-row "Delete") → content: confirm + warning that historical generated invoices are retained → actions: Cancel, Delete (destructive)

---

### Tax / VAT Configuration (view-id: tax-vat-config) [NEW]

**Purpose**: Configure tax/VAT rates per region, manage tax IDs, set tax-inclusive vs tax-exclusive pricing, and review tax collected for filing.

**Layout** (top-to-bottom):
1. Page header — title "Tax / VAT Configuration", subtitle "Configure tax rates, manage tax IDs, and review collected tax for filing.", primary "Add Tax Rate" button.
2. KPI strip — Tax Regions (count), Default Tax Rate (%), Tax Collected This Period (currency), Pending Filing (count + next filing date), Tax IDs Configured (count).
3. Two-column layout —
   - Left (wider): Tax Rates card — DataTable of configured tax rates.
   - Right (narrower): Firm Tax IDs card — list of configured tax IDs (VAT / GST / EIN / etc.), Tax Settings card (Tax-inclusive pricing toggle, Default tax region select, Reverse-charge enabled toggle, Tax-exempt traders handled toggle).
4. Tax Collected by Period card (below main grid) — table of tax collected per period per region.

**Tables**:
- Tax Rates: Region (medium + flag), Tax Type (badge — VAT / GST / Sales Tax / Withholding), Rate (%), Effective Date, Expiry Date (or "—"), Status (Active / Inactive StatusBadge), Actions | per-row: Edit (Sheet), Delete (AlertDialog)
- Tax Collected by Period: Period (e.g. "Q3 2026"), Region, Taxable Amount (currency), Tax Collected (currency), Filing Status (Not Due / Due / Filed badge), Filing Date (or "—"), Actions | per-row: File Now (opens Sheet), View Filing (Sheet)

**Forms**:
- Tax Settings: Tax-inclusive Pricing (toggle), Default Tax Region (select), Reverse-Charge Enabled (toggle), Tax-Exempt Traders Handled (toggle)

**Actions** (buttons + behavior):
- Header "Add Tax Rate" → open Add Tax Rate Sheet
- Per-row "Edit" → open Edit Tax Rate Sheet
- Per-row "Delete" → AlertDialog
- Tax Settings "Save" → toast
- Tax Collected "File Now" → open Filing Sheet
- Tax Collected "View Filing" → open Filing Detail Sheet
- **New for redesign**: Per-row "Add Tax ID" in Firm Tax IDs card → open Add Tax ID Sheet

**Dialogs / Modals / Sheets**:
- Add/Edit Tax Rate Sheet (trigger: header "Add Tax Rate" or per-row "Edit") → content: region select (or custom region input), tax type select, rate input (%), effective date, expiry date (optional), compound-on-other-taxes toggle, exemptions multi-select (challenge type / addon type / etc.) → actions: Cancel, Save
- Add Tax ID Sheet (trigger: "Add Tax ID" in Firm Tax IDs) → content: tax-id type select (VAT / GST / EIN / Company Registration / Other), tax-id number input, region select, issued date, expiry date (optional) → actions: Cancel, Save
- Filing Sheet (trigger: Tax Collected "File Now") → content: period, region, taxable amount, tax collected, filing deadline, filing method select (e-file / paper / third-party), confirmation checkbox → actions: Cancel, File Now
- Filing Detail Sheet (trigger: Tax Collected "View Filing") → content: full filing record, supporting transactions, audit trail → actions: Export, Close
- Delete AlertDialog (trigger: per-row "Delete") → content: confirm + warning that historical tax collected under this rate is retained → actions: Cancel, Delete (destructive)

---

### Chart of Accounts (view-id: chart-of-accounts) [NEW]

**Purpose**: Manage the firm's general ledger chart of accounts — assets / liabilities / equity / revenue / expenses / etc. with account numbers, types, and balances.

**Layout** (top-to-bottom):
1. Page header — title "Chart of Accounts", subtitle "The general ledger account structure for the firm.", primary "New Account" button, secondary "Export" button.
2. KPI strip — Total Accounts (count), Asset Accounts (count), Liability Accounts (count), Equity Accounts (count), Revenue Accounts (count), Expense Accounts (count).
3. Account type filter strip — segmented buttons: All / Assets / Liabilities / Equity / Revenue / Expenses / Other.
4. Chart of Accounts tree — a hierarchical list grouped by account type, with expand/collapse per group. Each account row shows: account number (mono), name, type, sub-type, currency, current balance (currency), status (Active / Inactive badge).

**Tables**:
- Chart of Accounts: Account Number (mono), Account Name (medium), Type (badge — Asset / Liability / Equity / Revenue / Expense / Other), Sub-Type (label, e.g. "Current Asset" / "Long-term Liability"), Currency (badge), Current Balance (currency, color-coded by direction), Status (Active / Inactive StatusBadge), Actions | per-row: View (Sheet), Edit (Sheet), Deactivate (AlertDialog), Reactivate (toast)

**Forms**: none on main page. New Account Sheet has fields.

**Actions** (buttons + behavior):
- Header "New Account" → open New Account Sheet
- Header "Export" → CSV
- Filter strip click → re-filters
- Per-row "View" → open Account Detail Sheet
- Per-row "Edit" → open Edit Account Sheet
- Per-row "Deactivate" → AlertDialog (only when active)
- Per-row "Reactivate" → toast (only when inactive)
- Group expand/collapse toggle → toggles the group's child accounts visibility

**Dialogs / Modals / Sheets**:
- New Account Sheet (trigger: header "New Account") → content: account number input (auto-suggested based on type), account name input, type select (Asset / Liability / Equity / Revenue / Expense / Other), sub-type select (filtered by type), parent account select (optional, for hierarchical accounts), currency select, opening balance input, opening-balance date, description textarea, active toggle → actions: Cancel, Save
- Account Detail Sheet (trigger: per-row "View") → content: account block, current balance, recent transactions (last 20), audit trail → actions: Edit, Deactivate, Export, Close
- Edit Account Sheet (trigger: per-row "Edit") → content: same fields as New Account, pre-filled, with deactivated edit (account number is read-only) → actions: Cancel, Save Changes
- Deactivate AlertDialog (trigger: per-row "Deactivate") → content: confirm + warning that the account cannot receive new postings but historical postings are retained → actions: Cancel, Deactivate

---

### Reconciled Transactions Review (view-id: reconciled-transactions) [NEW]

**Purpose**: A review surface for already-reconciled transactions — audit past reconciliations, reopen if needed, and produce audit-trail exports for auditors.

**Layout** (top-to-bottom):
1. Page header — title "Reconciled Transactions Review", subtitle "Audit and reopen past reconciliations.", secondary "Export" button.
2. KPI strip — Reconciled Transactions (count + total amount), Reopened This Period (count + total), Avg Reopen Time (hours), Auditor Review Pending (count).
3. Filter bar — search, Date-range select (reconciliation date), Account select, Amount-range inputs, Reopen Status select (All / Original / Reopened / Auditor-flagged).
4. Reconciled transactions table.

**Tables**:
- Reconciled: Reference (mono), Type (capitalized), Description (muted), Amount (currency), Account (xs), Reconciled At (timestamp), Reconciled By (avatar + name), Bank Statement Reference (mono), Reopen Status (badge — Original / Reopened / Auditor-flagged), Actions | per-row: View (Sheet), Reopen (AlertDialog), Flag for Auditor (Sheet), Export PDF (toast + download)

**Forms**: none on main page.

**Actions** (buttons + behavior):
- Header "Export" → CSV with all reconciled transactions for the selected period
- Per-row "View" → open Transaction Detail Sheet (links to transaction-detail view)
- Per-row "Reopen" → AlertDialog (destructive)
- Per-row "Flag for Auditor" → open Flag Sheet
- Per-row "Export PDF" → toast + triggers PDF download (single-transaction receipt)
- Row click → open Transaction Detail Sheet

**Dialogs / Modals / Sheets**:
- Reopen AlertDialog (trigger: per-row "Reopen") → content: confirm reopen + reason textarea (required) + warning that the reconciliation is reversed + auditor will be notified + action is logged → actions: Cancel, Reopen (destructive)
- Flag Sheet (trigger: per-row "Flag for Auditor") → content: transaction block, flag reason select (Discrepancy / Missing Documentation / Suspicious Pattern / Other), detail textarea, assign-to select (auditor name) → actions: Cancel, Submit Flag
- Transaction Detail Sheet (trigger: per-row "View" or row click) → content: full transaction record, audit timeline, bank statement match detail → actions: Reopen, Flag for Auditor, Close

---

## Batch 24 — Accounting Module (Final Screen)

### Financial Reports Library (view-id: financial-reports-library) [NEW]

**Purpose**: A library of standard and custom financial reports — Balance Sheet, Cash Flow, Trial Balance, AR Aging, AP Aging, Tax Summary, and any saved custom reports. Each report has a schedule, last-run, and export option.

**Layout** (top-to-bottom):
1. Page header — title "Financial Reports Library", subtitle "Generate, schedule, and audit financial reports.", primary "New Report" button, secondary "Import" button.
2. KPI strip — Standard Reports (count), Custom Reports (count), Scheduled Reports (count), Last Generated (timestamp + report name), Pending Generation (count).
3. Filter bar — search, category select (All / Standard / Custom / Compliance / Management), schedule select (All / Scheduled / On-demand), format select (All / PDF / CSV / XLSX), sort-by select (Recent / Name / Category).
4. Reports grid — a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) of report cards. Each card shows: report name (medium), category badge, schedule indicator (clock icon if scheduled + next-run timestamp), last-run timestamp + status icon, format badge (PDF / CSV / XLSX), description (truncated). Card hover lifts and reveals quick-action buttons: Generate, Edit, Duplicate, Share, Delete.
5. Recent Generations card (below grid) — a table of the last 20 report generations.

**Tables**:
- Recent Generations: Timestamp, Report (medium), Format (badge), Generated By (avatar + name), Status (Success / Failed / Running badge), Duration (relative), Result (link or "—"), Actions | per-row: Download Result (if successful), View Logs (Sheet), Re-generate (toast)

**Forms**: none on main page. New Report Sheet has multiple fields.

**Actions** (buttons + behavior):
- Header "New Report" → open New Report Sheet
- Header "Import" → open Import Sheet (paste JSON or upload .json)
- Per-card "Generate" → toast + runs the report; on success, reveals a "Download Result" button
- Per-card "Edit" → open Edit Report Sheet (pre-filled)
- Per-card "Duplicate" → toast + creates a copy in draft state
- Per-card "Share" → open Share Sheet
- Per-card "Delete" → AlertDialog (destructive)
- Per-card click (anywhere except actions) → open Report Detail Sheet
- Recent Generations "Download Result" → triggers download
- Recent Generations "View Logs" → open Logs Sheet
- Recent Generations "Re-generate" → toast + queues re-generation

**Dialogs / Modals / Sheets**:
- New Report Sheet (trigger: header "New Report") → content:
  - Step 1 (Type): report type select (Balance Sheet / Cash Flow Statement / Trial Balance / AR Aging / AP Aging / Tax Summary / Custom), report name input, description textarea, category select
  - Step 2 (Parameters): period select, comparison toggle (Compare to Previous Period), segment filter (links to Custom Segmentation), currency select
  - Step 3 (Format & Schedule): format select (PDF / CSV / XLSX), schedule toggle, recurrence select (Daily / Weekly / Monthly / Quarterly), day-of-week/month select, time input, recipients email-list
  - Step 4 (Sharing): shared-with multi-select (user picker), make-default toggle
  - Live preview pane on the right showing the report's first page as it will render
  → actions: Cancel, Save as Draft, Save & Generate Now
- Edit Report Sheet (trigger: per-card "Edit") → same fields as New Report, pre-filled → actions: Cancel, Save Changes, Delete Report (destructive)
- Report Detail Sheet (trigger: per-card click) → content: full report config, last 10 generations, recipients list, audit timeline → actions: Generate Now, Edit, Share, Delete, Close
- Share Sheet (trigger: per-card "Share") → content: shared-with multi-select, permission select (Viewer / Editor), message textarea, copy-link button → actions: Cancel, Send Invites
- Delete Report AlertDialog (trigger: per-card "Delete" or Edit Report "Delete Report") → content: confirm + warning that scheduled generations will be cancelled + warning that historical generations are retained → actions: Cancel, Delete (destructive)
- Import Report Sheet (trigger: header "Import") → content: paste-JSON textarea or upload .json file → actions: Cancel, Import
- Logs Sheet (trigger: Recent Generations "View Logs") → content: log lines (timestamped) → actions: Copy Logs, Close

---

## Summary

- **Total batches**: 12 (Batch 13 → Batch 24)
- **Total screens**: 56
- **Batch breakdown**:
  - Batch 13 (5 screens): Payouts Overview, Pending Payouts, Payout History, Enhanced Withdrawals, Payout Detail
  - Batch 14 (5 screens): Bulk Payout Approval Queue, Payout Methods Configuration, Payout Schedule, Payout Reversal / Refund, Payout Compliance / Audit Report
  - Batch 15 (5 screens): Analytics Overview, Trader Analytics, Performance Analytics, Risk Analytics, Advanced Analytics
  - Batch 16 (5 screens): Firm Statistics, Daily Highlights, Retention Analytics, Dashboard: Accounts Tab, Dashboard: Payouts Tab
  - Batch 17 (5 screens): Dashboard: Orders Tab, Dashboard: Positions Tab, Saved Reports / Report Builder, Scheduled Exports, Custom Segmentation Builder
  - Batch 18 (5 screens): Cohort Builder, Affiliates Overview, Affiliates List, Campaigns, Commissions
  - Batch 19 (5 screens): Offer Management, Offer Edit, Offer Matching Users, Offer Change History, Affiliate Coupons
  - Batch 20 (5 screens): Affiliate Link Tracking, Affiliate Detail, Campaign Detail / Edit, Commission Payout Flow, Affiliate Onboarding / Invite
  - Batch 21 (5 screens): Affiliate Performance Comparison, Cookie Attribution Report, Accounting Overview, Transactions, Reconciliation
  - Batch 22 (5 screens): Invoices, P&L Statement, Transaction Detail, Bank Statement Import, Journal Entries / Manual Adjustments
  - Batch 23 (5 screens): Refunds / Credit Notes, Recurring Invoices, Tax / VAT Configuration, Chart of Accounts, Reconciled Transactions Review
  - Batch 24 (1 screen): Financial Reports Library
- **Existing screens covered**: 31
- **New screens designed from scratch**: 25
- **Document length**: 2,013 lines


---

# Prop-Admin Dashboard — Stitch Design Spec (Part 3 of 3)

**Scope**: All screens in Module 8 (Marketing), Module 9 (CRM), Module 10 (KYC), Module 11 (Support), Module 12 (AI/LLM), Module 13 (Checkout), and Module 14 (Audit & Compliance).

**Batches**: 25 → 39 (15 batches, 73 screens total). Parts 1 + 2 cover 116 screens across 24 batches, so Part 3 picks up at Batch 25.

**Conventions**
- All screens are tenant-scoped (`prop-admin`) unless the screen name begins with "Platform" — those are super-admin (`super-admin`) cross-tenant views.
- "Sheet" always means the shadcn right-side drawer. "AlertDialog" means a friction-confirm modal.
- "Stitch design language" refers to the warm, hand-stitched visual system already established in Parts 1 + 2 — `Page / PageHeader / PageContent / MetricCard / DataTable / Sheet / Tabs / Card / Collapsible` primitives, `StatusBadge` with the canonical 6 tones, contextual help via `LabelWithHelp`, deterministic mock data (no `Math.random`), and the warm token-driven palette (`primary`, `accent`, `success`, `warning`, `danger`, `muted`). **No raw color names appear in this document** — every chromatic choice is expressed through the design tokens above.
- Every per-row action, every form field, every dialog is enumerated — there is nothing implicit.

---

## Batch 25 — Marketing (5 existing)

### Marketing Overview (view-id: marketing) [EXISTING]

**Purpose**: Headline KPIs plus the two campaign-level charts that frame the rest of the Marketing module.

**Layout** (top-to-bottom):
1. PageHeader — title "Marketing", description that mentions the tenant-aware `trader` term, Megaphone icon, single action button.
2. KPI row — 5 MetricCards in a `grid-cols-2 lg:grid-cols-5` strip: Active Campaigns (positive), Total Spend, Impressions, Conversions (positive), ROI (positive/negative based on value).
3. Charts row — `grid gap-4 lg:grid-cols-2` with two equal cards: Campaign Revenue (BarSeries, top 6 campaigns by revenue) on the left; Spend by Channel (DonutSeries) on the right.

**Tables**: (none — KPIs + 2 charts only)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export" (outline, top-right of PageHeader) → triggers `exportToCsv` of all campaigns with name/channel/status/budget/spend/impressions/clicks/conversions/revenue/roi → toast "Export started".

**Dialogs / Modals / Sheets**: (none)

---

### Campaigns (view-id: marketing-campaigns) [EXISTING]

**Purpose**: Searchable DataTable of every campaign running on the tenant.

**Layout** (top-to-bottom):
1. PageHeader — title "Campaigns", LayoutList icon, no actions.
2. Card — `bg-card p-4` with header line "Campaigns ({count})" and a DataTable.

**Tables**:
- Campaigns DataTable: Campaign (name), Channel (capitalize), Status (StatusBadge with `campaignStatusTone`), Budget (currency), Spend (currency), Impr. (compact), Clicks (compact), Conv. (number), Revenue (currency, semibold), ROI (percentage, success tone if ≥0, danger tone if <0) | (no per-row actions; full-text search only)

**Forms**: (none)

**Actions** (buttons + behavior):
- Search input inside DataTable — filters rows by name + channel + status.

**Dialogs / Modals / Sheets**: (none — drill into Campaign Detail Sheet is **missing today**; the new Campaign Detail screen in Batch 26 replaces the missing per-row Sheet)

---

### Performance (view-id: marketing-performance) [EXISTING]

**Purpose**: Channel-aggregated bar charts that compare revenue, conversions and spend side-by-side.

**Layout** (top-to-bottom):
1. PageHeader — title "Performance", TrendingUp icon, no actions.
2. Charts row — `grid gap-4 lg:grid-cols-2` with two BarSeries: Revenue by Channel and Conversions by Channel.
3. Full-width card — Spend Distribution DonutSeries spanning both columns.

**Tables**: (none)

**Forms**: (none)

**Actions** (buttons + behavior): (none — no buttons today; spec audit flags this as a missing-Export + missing-date-range screen; redesign will add the shared Marketing toolbar retroactively)

**Dialogs / Modals / Sheets**: (none)

---

### Ad Spend (view-id: marketing-ad-spend) [EXISTING]

**Purpose**: Cross-platform paid-acquisition performance (Google/Meta/TikTok/LinkedIn/X) with CPA/ROAS attribution and a 4-stage funnel down to funded traders.

**Layout** (top-to-bottom):
1. PageHeader — title "Ad Spend", Megaphone icon, single primary action button "Connect Ad Account" (toast today; the new Ad Account Connections screen in Batch 27 absorbs this).
2. KPI row — 4 MetricCards in `grid-cols-2 lg:grid-cols-4`: Total Ad Spend (30d), Total Conversions, CPA (positive ≤ $100, warning otherwise), ROAS (positive ≥ 2x, warning otherwise). Each card carries a `deltaLabel` explaining the threshold.
3. Filter bar — bordered card containing: Platform Select (All / Google Ads / Meta / TikTok / LinkedIn / Twitter-X), Campaign Select (All campaigns + each campaign id), Range Select (7d / 30d / 90d), Reset button (only when a filter is non-default), and on the right a "Export CSV" outline button.
4. Charts row — `grid gap-4 lg:grid-cols-2`: Spend by Platform (BarSeries) + Spend Distribution (DonutSeries).
5. ROAS by Platform — full-width BarSeries card with a `LabelWithHelp` explaining the ROAS formula.
6. Ad Campaigns DataTable — bordered card, header "Ad Campaigns ({count})" with Filter icon, the table below.
7. Spend Trend (30d) — full-width AreaSeries card.
8. Conversion Funnel — bordered card with a `LabelWithHelp`; left 2/3 is a BarSeries (Impressions → Clicks → Signups → Funded Traders), right 1/3 is a stack of per-stage mini-cards showing each stage value + "from previous %" rate.
9. Floating "New Ad Campaign" — bottom-right primary button.

**Tables**:
- Ad Campaigns: Campaign (name + id + platform subline), Platform (color dot + name), Spend (currency), Impr. (compact), Clicks (compact), CTR (percentage, success tone ≥ 2%), CPC (currency, muted dash when 0), Conv. (number), CPA (currency, success ≤ $100, danger > $200), ROAS (e.g. `2.1x`, success ≥ 2x, danger < 1x), Status (StatusBadge active/paused/ended/draft) | View (ghost button → opens Sheet in view mode)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Connect Ad Account" (outline, PageHeader) → toast stub (replaced by Ad Account Connections screen in Batch 27).
- Platform Select / Campaign Select / Range Select → set local filter state, recomputes KPIs and DataTable rows.
- "Reset" (ghost) → clears platform + campaign filters, keeps range.
- "Export CSV" (outline) → `exportToCsv` of filtered campaigns.
- Row "View" or row click → opens Ad Campaign Sheet in view mode.
- "New Ad Campaign" (primary, bottom-right) → opens Ad Campaign Sheet in create mode.

**Dialogs / Modals / Sheets**:
- Ad Campaign Sheet (trigger: row View / New Ad Campaign button) → content: Campaign Name (input, LabelWithHelp), Platform (Select — Google Ads / Meta / TikTok / LinkedIn / Twitter-X), Budget (number) + Budget Type (Select — Total / Daily) in a 2-col grid, Start Date (date input) + End Date (date input) in a 2-col grid, Target Audience (textarea, LabelWithHelp), Creative URL (url input, LabelWithHelp), Separator, Campaign Active (Switch in a bordered box with label + helper). When in view mode and the campaign has spend > 0, a 4-pill KPI strip (Spend / CPA / ROAS / CTR) renders above the form. → actions: Save (primary, toast + close), Pause (outline, toast + close), Delete (destructive, opens AlertDialog). → AlertDialog content: title "Delete this campaign?", consequence describing platform-side cleanup needed, audit logging. → actions: Cancel, Delete campaign (destructive).

---

### Email Campaigns (view-id: marketing-email-campaigns) [EXISTING]

**Purpose**: Plan, send and measure email campaigns — open rate, click rate, conversion, template leaderboard.

**Layout** (top-to-bottom):
1. PageHeader — title "Email Campaigns", Mail icon, primary action "Create Campaign".
2. KPI row — 4 MetricCards in `grid-cols-2 lg:grid-cols-4`: Total Emails Sent (30d), Avg Open Rate (positive, deltaLabel = industry avg), Avg Click Rate (positive, deltaLabel = industry avg), Conversion Rate (warning, deltaLabel "clicked → became trader").
3. Filter bar — bordered card with Status Select (All / draft / scheduled / sending / sent / completed / paused / failed), Template Select (All / Welcome / Newsletter / Promotional / Re-engagement / Phase-Passed / Payout-Approved), Reset button (only when a filter is non-default), and on the right an "Export CSV" outline button.
4. Campaigns DataTable — bordered card, header "Campaigns ({count})", DataTable below.
5. Performance trend — `grid gap-4 lg:grid-cols-3`: left 2/3 = Email Performance Trend (AreaSeries of 12-week open rate, with subtitle); right 1/3 = Quick Stats card (Best performing, Best open rate, Active campaigns, Conversion click → trader).
6. Top Performing Templates — bordered card, header with TrendingUp icon and "Top Performing Templates", DataTable below.

**Tables**:
- Campaigns: Campaign (name + id + subject subline), Template (muted), Status (StatusBadge draft/scheduled/sending/sent/completed/paused/failed), Sent (compact), Opened (compact), Clicked (compact), Converted (number), Open Rate (percentage, success tone ≥ 30%), Click Rate (percentage, success tone ≥ 5%) | View (ghost button → opens Sheet in view mode)
- Top Performing Templates: Template (name), Sent (compact), Open Rate (percentage, success ≥ 50% semibold), Click Rate (percentage, success ≥ 10% semibold), Conversion (percentage), Revenue Attributed (currency, semibold) | (no per-row actions)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Create Campaign" (primary, PageHeader) → opens Email Campaign Sheet in create mode.
- Status Select / Template Select → filter DataTable rows; count label updates.
- "Reset" (ghost) → clears both filters.
- "Export CSV" (outline) → `exportToCsv` of filtered campaigns.
- Row "View" or row click → opens Email Campaign Sheet in view mode.

**Dialogs / Modals / Sheets**:
- Email Campaign Sheet (trigger: Create Campaign / row View) → content: 3-tab Tabs (Compose / Preview / Schedule). Compose tab — Campaign Name (input, LabelWithHelp), Template (Select), Audience (Select — All / Active / Funded / Failed / Specific Segment), Separator, Subject Line (input with char-counter, max 120, LabelWithHelp), Preview Text (textarea, max 140, LabelWithHelp). Preview tab — bordered mock-email card rendering Subject + Preview Text + template body, plus a "Send Test Email" outline button (toast). Schedule tab — Schedule Send (datetime-local input, LabelWithHelp) and an "Estimated recipients" hint box. When in view mode and the campaign has sent > 0, a 4-pill KPI strip (Open Rate / Click Rate / Converted / Conv. Rate) renders above the Tabs. → actions: Save Draft (outline, toast + close), Schedule (outline, disabled until a datetime is set, toast + close), Send Now (primary, toast + close).

---

## Batch 26 — Marketing (1 existing + 4 new)

### Marketing Dashboard (view-id: marketing-dashboard) [EXISTING]

**Purpose**: Weekly snapshot of top traders, top trading pairs and top payout countries — the marketing team's at-a-glance board.

**Layout** (top-to-bottom):
1. PageHeader — title "Marketing Dashboard", Megaphone icon, single action "Export CSV".
2. KPI row — 4 MetricCards in `grid-cols-2 lg:grid-cols-4`: Best Trade (positive), Best Trader, Logged In Users, Total Payouts (warning).
3. Toolbar — flex row with a Calendar icon + Week-range Select (This Week / Last Week / This Month) and a Search input (searches traders or countries).
4. Top Traders card — bordered card with Trophy icon header "Top Traders" + right-aligned count line "Ranked by P&L · {filtered} of {total} shown". DataTable below.
5. Side-by-side cards — `grid gap-4 lg:grid-cols-2`: Top Trading Pairs (Activity icon header, DataTable) + Top Countries by Payouts (Globe icon header, DataTable).
6. Footer note — single muted paragraph explaining aggregation method.

**Tables**:
- Top Traders: Rank (badge with crown icon for #1, distinct tones for top 3 vs the rest), Name (semibold), P&L (currency, success tone if ≥0, danger tone if <0), Win Rate (percentage), Country (StatusBadge muted) | (no per-row actions — drill to trader detail is **missing today**)
- Top Trading Pairs: Symbol (monospace), Trades (compact), Buy/Sell (monospace ratio), Volume lots (compact), Avg P&L (currency, success/danger tone) | (no per-row actions)
- Top Countries by Payouts: Country (globe icon + name), Payouts (compact), Total Amount (currency), % of Total (small progress bar + percentage) | (no per-row actions)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline, PageHeader) → today this is a toast stub; Stitch redesign must wire `exportToCsv` of the visible rows.
- Week-range Select → recomputes the cutoff, filters traders + payouts by date.
- Search input → filters the Top Traders table only.

**Dialogs / Modals / Sheets**: (none)

---

### Campaign Detail (view-id: marketing-campaign-detail) [NEW]

**Purpose**: Single-campaign workspace so marketing ops never need to leave the page to inspect or mutate one campaign's lifecycle, spend, creative and attribution.

**Layout** (top-to-bottom):
1. Breadcrumb — Marketing › Campaigns › {Campaign Name}.
2. PageHeader — title {Campaign Name}, Megaphone icon, StatusBadge for status, subline `{campaign id} · {channel} · {start date → end date}`. Actions: Edit (outline → opens Sheet in edit mode), Pause/Resume (toggle outline, label depends on status), Duplicate (outline, toast), Delete (destructive ghost → opens AlertDialog).
3. KPI strip — 10 MetricCards in a 2×5 grid: Budget, Spend (30d), Impressions, Clicks, Conversions, Revenue, ROI, CPA, CTR, ROAS (each MetricCard carries a `deltaLabel` threshold).
4. Tabs — Tabs with 4 TabsTriggers: Overview / Performance / Creative / Attribution.
5. Overview tab content: two cards side-by-side (`grid lg:grid-cols-2`). Left: "Campaign Facts" card — definition list of Name, Channel, Owner, Status, Start Date, End Date, Budget Type (daily/total), Target Audience (freeform), Created At, Last Modified. Right: "Activity Timeline" card — vertical ordered list of campaign events (Created, Activated, Paused, Resumed, Budget Changed, Creative Swapped, Sent, Completed) each with a small icon, label, actor, timestamp.
6. Performance tab content: AreaSeries "Spend Trend (30d)", BarSeries "Daily Conversions", DonutSeries "Traffic Source Split" (organic / paid-search / paid-social / direct / referral), and a small KPI strip for Click-through funnel (Impr → Clicks → Signups → Conversions) with stage-to-stage rate pills.
7. Creative tab content: bordered card showing the creative preview (image / video URL), the headline + body copy in a textarea-readonly form, the destination URL, and a small list of "Creative variants" with per-variant impression split bar. "Swap Creative" outline button opens a Sheet (see below).
8. Attribution tab content: read-only UTM breakdown (source / medium / campaign / term / content), the conversion window explanation, the attribution model label (Last-click / First-click / Linear / Time-decay), and a BarSeries "Conversions by Daypart".

**Tables**: (none — content is per-campaign)

**Forms**: (none on the page; see Sheets)

**Actions** (buttons + behavior):
- "Edit" (outline) → opens Campaign Edit Sheet.
- "Pause" / "Resume" (outline, label toggles based on status) → toggles status, toast, KPI strip stays.
- "Duplicate" (outline) → toast; in production wires a `POST /api/marketing/campaigns/:id/duplicate`.
- "Delete" (destructive ghost) → opens Delete AlertDialog.
- "Swap Creative" (outline, Creative tab) → opens Swap Creative Sheet.

**Dialogs / Modals / Sheets**:
- Campaign Edit Sheet (trigger: Edit) → content: identical to the existing Ad Campaign Sheet form (Campaign Name, Platform, Budget + Type, Start/End Date, Target Audience, Creative URL, Active Switch) with the KPI strip on top when spend > 0. → actions: Save (primary, toast + close), Cancel (ghost).
- Delete AlertDialog (trigger: Delete) → content: title "Delete campaign?", description warning that the platform record is removed but the underlying ad-platform campaign is NOT auto-deleted, with a consequence box. → actions: Cancel, Delete campaign (destructive).
- Swap Creative Sheet (trigger: Swap Creative) → content: Creative URL (url input), Headline (input), Body Copy (textarea), Destination URL (url input), Notes (textarea), A/B variant label (input). → actions: Save Variant (primary, toast + close), Cancel (ghost).

---

### Audience / Segment Builder (view-id: marketing-audience-builder) [NEW]

**Purpose**: Build reusable audiences (segments) that drive email-campaign targeting and ad-account lookalikes, with a live size estimate.

**Layout** (top-to-bottom):
1. PageHeader — title "Audiences", Users icon, actions: "New Segment" (primary → opens Sheet), "Import CSV" (outline → opens AlertDialog).
2. KPI row — 4 MetricCards: Total Segments, Active Segments, Total Reach (sum of segment sizes), Synced to Ad Accounts.
3. Filter bar — bordered card with Source Select (All / CRM / Trading / KYC / Custom), Min Size number input, Max Size number input, Sort Select (Recently updated / Largest / Smallest / Most used), Reset, and on the right "Export CSV".
4. Segments DataTable — bordered card with header "Segments ({count})", DataTable below.

**Tables**:
- Segments: Name (semibold + id subline), Source (badge — CRM / Trading / KYC / Custom), Size (number with "recipients" suffix), Last Updated (relative), Synced to (badge list — Google Ads / Meta / Klaviyo / None), Status (StatusBadge active / draft / archived) | Edit (ghost → opens Sheet), Duplicate (ghost → opens Sheet pre-filled), Archive (ghost → opens AlertDialog)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "New Segment" (primary) → opens Segment Builder Sheet in create mode.
- "Import CSV" (outline) → opens Import CSV AlertDialog.
- "Export CSV" (outline) → exports segments list.
- Source Select / Min / Max / Sort → filter + sort DataTable.
- "Reset" (ghost) → clears filters.
- Row "Edit" → opens Segment Builder Sheet in edit mode.
- Row "Duplicate" → opens Segment Builder Sheet pre-filled with the row's values, name suffixed " (Copy)".
- Row "Archive" → opens Archive AlertDialog.

**Dialogs / Modals / Sheets**:
- Segment Builder Sheet (trigger: New Segment / Edit / Duplicate) → content: Segment Name (input), Description (textarea), Source Select (CRM / Trading / KYC / Custom). A 2-column "Rule Builder" — left column lists filter rows (`{Field} {Operator} {Value}`), right column renders a live "Estimated size" card showing recipient count and a sparkline of size over time. Each rule row has Field Select (Tier / Country / Stage / Last Active / Equity / Win Rate / Joined At / KYC Status / Has Payout), Operator Select (= / ≠ / in / not in / ≥ / ≤ / between), Value input (type adapts: text / number / multi-select / date), AND/OR toggle. Footer has "Add Rule" / "Add Rule Group" buttons. Below the rule builder: a "Sync to Ad Accounts" multi-select (Google Ads / Meta / TikTok / LinkedIn / Klaviyo). → actions: Save (primary, toast + close), Save & Build Lookalike (outline, toast + close), Cancel (ghost).
- Import CSV AlertDialog (trigger: Import CSV) → content: a file-drop zone, an uploaded-file preview row with column-mapping Selects, a "Has header row" checkbox, and a "Skip duplicates by email" checkbox. → actions: Cancel, Import (primary, disabled until a file is staged and required mappings set, toast + close).
- Archive AlertDialog (trigger: Archive) → content: title "Archive segment?", warning that the segment stops refreshing but is not deleted. → actions: Cancel, Archive (destructive).

---

### Template Editor (Marketing-local) (view-id: marketing-template-editor) [NEW]

**Purpose**: A Marketing-local editor for reusable email-template skeletons (separate from the global Settings templates module), with merge-field insertion and a side-by-side live preview.

**Layout** (top-to-bottom):
1. PageHeader — title "Template Editor", FileText icon, actions: "New Template" (primary → opens Sheet), "Insert Merge Field" (outline, opens a small dialog), "Save Draft" (outline), "Publish" (primary).
2. Template gallery — bordered card with header "Templates ({count})" and a `grid md:grid-cols-3 xl:grid-cols-4` of template thumbnails. Each thumbnail card shows: name, category badge (Welcome / Newsletter / Promotional / Re-engagement / Phase-Passed / Payout-Approved), small preview snippet, status badge (Draft / Published / Archived), "Open" button (opens editor below in-place).
3. Two-pane editor — `grid lg:grid-cols-2`: Left = Subject (input), Preview Text (input), Body (rich Textarea with merge-field tokens rendered as inline pills). Right = a phone-frame mock of the rendered email, with device tabs (Inbox preview / Desktop / Mobile).

**Tables**: (none)

**Forms**:
- Template Edit form (left pane): Template Name (input), Category (Select), Subject (input with merge-field insert helper), Preview Text (input with merge-field insert helper), Body (rich textarea), Merge fields used (chips list with remove), Footer toggle (Switch — Use default footer), Footer override textarea (only visible when toggle on).

**Actions** (buttons + behavior):
- "New Template" (primary) → opens blank editor.
- "Insert Merge Field" (outline) → opens Merge Field Picker Dialog.
- "Save Draft" (outline) → toast "Draft saved".
- "Publish" (primary) → toast "Published" if no validation errors; otherwise warning toast with errors list.
- Thumbnail "Open" → loads template into the editor panes.
- Subject / Preview / Body inputs → live-update the right-pane preview.

**Dialogs / Modals / Sheets**:
- New Template Sheet (trigger: New Template) → content: Template Name (input), Category (Select), Description (textarea), Starting Template (Select — Blank / Welcome / Newsletter / Promotional / Re-engagement / Phase-Passed / Payout-Approved). → actions: Create (primary, opens blank editor), Cancel (ghost).
- Merge Field Picker Dialog (trigger: Insert Merge Field) → content: searchable list of merge fields (`{{first_name}}`, `{{trader_tier}}`, `{{challenge_name}}`, `{{payout_amount}}`, `{{payout_date}}`, `{{kyc_status}}`, `{{tenant_name}}`, `{{support_email}}`, `{{unsubscribe_url}}`), each with a small description. → actions: Cancel, Insert (primary, inserts token at cursor, closes dialog).

---

### Attribution / UTM Builder (view-id: marketing-utm-builder) [NEW]

**Purpose**: Build, validate and share UTM-tagged links for every campaign surface — email, ad, social, affiliate — with a live preview and a clipboard-ready output.

**Layout** (top-to-bottom):
1. PageHeader — title "UTM Builder", Link icon, actions: "New Link" (primary → opens Sheet), "Export CSV" (outline).
2. KPI row — 4 MetricCards: Total Links, Clicks (30d), Conversions Attributed, Top Source (text value, the source with most clicks).
3. Filter bar — Source Select (All / newsletter / google / meta / tiktok / linkedin / affiliate / direct), Medium Select (All / email / cpc / social / referral / none), Campaign Select, Date-range Select (7d / 30d / 90d), Reset.
4. Links DataTable — bordered card with header "UTM Links ({count})".

**Tables**:
- UTM Links: Link Name (semibold), Source, Medium, Campaign, Clicks (compact), Conversions (number), Conv. Rate (percentage), Last Clicked (relative), Status (StatusBadge active / paused / expired) | Copy URL (ghost → clipboard + toast), Edit (ghost → opens Sheet), QR Code (ghost → opens Dialog), Delete (destructive ghost → opens AlertDialog)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "New Link" (primary) → opens UTM Builder Sheet.
- "Export CSV" (outline) → exports links table.
- Source / Medium / Campaign / Date-range filters → filter DataTable.
- "Reset" → clears filters.
- Row "Copy URL" → clipboard + toast.
- Row "Edit" → opens UTM Builder Sheet in edit mode.
- Row "QR Code" → opens QR Dialog.
- Row "Delete" → opens Delete AlertDialog.

**Dialogs / Modals / Sheets**:
- UTM Builder Sheet (trigger: New Link / Edit) → content: Link Name (input), Destination URL (url input, LabelWithHelp), then a 2-column grid of the five UTM fields (Source / Medium / Campaign / Term / Content), each with a Select-or-type input plus suggestions dropdown. A live "Generated URL" monospace read-only field at the bottom with a Copy button. A "Save as new" vs "Update existing" toggle (only in edit mode). → actions: Save (primary, toast + close), Copy URL (outline), Cancel (ghost).
- QR Code Dialog (trigger: QR Code) → content: a centered QR image generated from the link URL, the URL as a caption, and download-format buttons (PNG / SVG). → actions: Close, Download PNG (primary), Download SVG (outline).
- Delete AlertDialog (trigger: Delete) → content: title "Delete UTM link?", consequence text. → actions: Cancel, Delete (destructive).

---

## Batch 27 — Marketing (1 new) + CRM (3 existing + 1 new)

### Ad Account Connections (view-id: marketing-ad-accounts) [NEW]

**Purpose**: Replace today's toast-only "Connect Ad Account" button with a real CRUD surface that lists every connected ad account, its auth status, last sync, and provides OAuth connect/disconnect.

**Layout** (top-to-bottom):
1. PageHeader — title "Ad Account Connections", Plug icon, primary action "Connect Ad Account" (→ opens Sheet).
2. KPI row — 4 MetricCards: Connected Accounts, Active Syncs, Last Sync (relative), Failed Authorizations (negative tone if > 0).
3. Health banner (conditional) — bordered card with AlertTriangle icon, only visible when at least one account has auth_status = `expired` or `error`. Banner text "Some ad accounts require re-authorization — click Reconnect." Each named account in the banner is a button → opens Sheet in reconnect mode.
4. Connections DataTable — bordered card with header "Connected Ad Accounts ({count})".

**Tables**:
- Ad Accounts: Platform (logo glyph + name), Account ID (monospace), Account Name, Auth Status (StatusBadge — connected / expired / error / pending), Last Sync (relative), Synced Campaigns (number), Sync Frequency Select (15m / 30m / 1h / 6h / daily), Currency | Reconnect (outline, only when auth expired/error → opens Sheet in reconnect mode), Pause Sync (ghost toggle), Settings (ghost → opens Sheet), Disconnect (destructive ghost → opens AlertDialog)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Connect Ad Account" (primary) → opens Connect Sheet (step 1: platform select).
- Row "Reconnect" → opens Reconnect Sheet (step 1 of connect, prefilled).
- Row "Pause Sync" → toggle, toast.
- Row "Settings" → opens Settings Sheet.
- Row "Disconnect" → opens Disconnect AlertDialog.
- Sync Frequency Select → updates the per-account sync cadence (toast).

**Dialogs / Modals / Sheets**:
- Connect Sheet (trigger: Connect Ad Account) → content: 2-step Tabs. Step 1 "Choose platform": radio-card list of Google Ads / Meta / TikTok / LinkedIn / Twitter-X, each with logo, short description, "Connect" button → would start OAuth (today a toast simulates the redirect). Step 2 "Map accounts": after OAuth, the sheet lists the discovered ad-account IDs with checkboxes and an "Import selected" button. → actions: Cancel (ghost), Back (outline, only in step 2), Import Selected (primary, only in step 2, toast + close).
- Settings Sheet (trigger: Settings) → content: Account name (input), Sync frequency (Select), Auto-pause low-performing campaigns threshold (number, CPA threshold), Webhook URL (read-only + copy), IP allowlist (textarea). → actions: Save (primary), Cancel (ghost).
- Disconnect AlertDialog (trigger: Disconnect) → content: title "Disconnect {platform} — {account}?", warning that historical campaigns remain visible but new campaigns will not sync. → actions: Cancel, Disconnect (destructive).

---

### CRM Overview (view-id: crm) [EXISTING]

**Purpose**: KPI strip plus pipeline-by-stage bar chart and pipeline-value progress bars that frame the rest of the CRM module.

**Layout** (top-to-bottom):
1. PageHeader — title "CRM", Contact icon, single action "Export" (outline).
2. KPI row — 5 MetricCards in `grid-cols-2 lg:grid-cols-5`: Total Contacts (positive), Leads, Qualified (positive), Customers (positive), Churned (negative).
3. Charts row — `grid gap-4 lg:grid-cols-2`: Pipeline by Stage (BarSeries) + Pipeline Value card (per-stage progress bars with count + currency per stage).

**Tables**: (none)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export" (outline, PageHeader) → `exportToCsv` of all contacts.

**Dialogs / Modals / Sheets**: (none)

---

### Contacts (view-id: crm-contacts) [EXISTING]

**Purpose**: DataTable of every CRM contact with a row-click that opens the rich Contact Sheet drawer.

**Layout** (top-to-bottom):
1. PageHeader — title "Contacts", Users icon, no actions (Stitch redesign will add "+ New Contact" — see Add Contact Flow screen, Batch 27).
2. Card — bordered `bg-card p-4` with header "Contacts ({count})" and DataTable.

**Tables**:
- Contacts: Name (semibold), Email (muted), Source, Stage (StatusBadge with stage tone), Owner, Value (currency, semibold), Last Interaction (date, muted) | (row-click → opens Contact Sheet; no per-row buttons)

**Forms**: (none)

**Actions** (buttons + behavior):
- Search input inside DataTable → filters by name + email + source + stage + owner.

**Dialogs / Modals / Sheets**:
- Contact Sheet (trigger: row click) → content: avatar + name + email header, stage Badge, source/owner/phone meta line. KPI strip — 3 pills: Pipeline Value (currency), Last Contact (relative), Deals (count). Lead-score row — uppercase label + Lead Score pill (Hot ≥ 80 / Warm 50-79 / Cold < 50). Activity Timeline — vertical ordered list with small icons (joined / email / click / demo / deal) and timestamps. Deals list — header "Deals ({count})" with each deal rendered as a row (name + id + amount + stage badge); empty state when no deals. Notes — textarea with "Save Notes" button (disabled until changed). → actions: Convert to {trader} (primary, toast), Add Task (outline, toast — today a stub; redesign should open an inline Task form), Delete (destructive outline → opens AlertDialog), Save Notes (outline, toast). → AlertDialog content: title "Delete this contact?", consequence box describing the irreversible removal + audit logging, → actions: Cancel, Delete (destructive).

---

### Pipeline (view-id: crm-pipeline) [EXISTING]

**Purpose**: 5-column Kanban (lead / qualified / opportunity / customer / churned) with drag-and-drop card movement, plus the inline Lead Scoring Methodology card.

**Layout** (top-to-bottom):
1. PageHeader — title "Pipeline", GitBranch icon, action: a single Badge "{count} contacts".
2. KPI row — 4 MetricCards: Total Pipeline Value (positive), Open Deals, Avg Deal Size, Win Rate (positive, deltaLabel "{won} won / {lost} lost").
3. Kanban board — bordered card with header "Pipeline Stages" and a hint "Drag a card to a column, or use the ⋯ menu on each card." Below the header, a horizontal-scroll flex row of 5 Kanban columns.
4. Lead Scoring Methodology card — full-width Card with Award icon, LabelWithHelp "How lead scores are calculated", and a `sm:grid-cols-2` grid of factor rows (Base score +50, Pipeline value > $5,000 +20, Pipeline value > $15,000 +10, Referral/affiliate source +15, Recent interaction < 3 days +15, Recent interaction < 7 days +8, Stale interaction > 30 days −10, Has associated deals +12). Each factor row is bordered with label + detail + weight Badge.

**Tables**: (none — kanban is the table equivalent)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- Drag a card to another column → mutates local state, toast "Moved {name} → {stage}".
- Per-card ⋯ Move menu → same mutation as drag.
- Card click → opens the same Contact Sheet as on the Contacts page.

**Dialogs / Modals / Sheets**:
- Contact Sheet (trigger: card click) → identical to the Contacts page Sheet.

---

### Add Contact Flow (view-id: crm-contact-create) [NEW]

**Purpose**: A first-class Create Contact dialog + flow that is missing today — every CRM screen that lacks a "+ New Contact" button will route here.

**Layout** (top-to-bottom): (this is a Sheet, not a full page — accessible from Contacts + Pipeline + CRM Overview)
1. Sheet header — title "New Contact", Contact icon, subline "Add a contact to this {trader} tenant."
2. Two-step form (Tabs): Identity / Stage & Owner.
3. Identity tab content: First Name (input), Last Name (input), Email (input, validated), Phone (input, optional), Company (input, optional), Source Select (Organic / Referral / Affiliate / Outbound / Inbound / Event / Other), Lead Score preview (read-only pill, updates as fields change), Notes (textarea).
4. Stage & Owner tab content: Stage Select (Lead / Qualified / Opportunity / Customer / Churned), Owner Select (derived from tenant users), Pipeline Value (currency input), Expected Close Date (date input, only for Opportunity/Customer stages), Tags (multi-input chip field).

**Tables**: (none)

**Forms**:
- Add Contact form (above).

**Actions** (buttons + behavior):
- "Save & Open" (primary) → creates contact, opens the Contact Sheet for the new contact, toast "Contact created".
- "Save & Add Another" (outline) → creates contact, resets the Identity tab, toast "Contact created".
- "Cancel" (ghost) → closes Sheet without saving.

**Dialogs / Modals / Sheets**: (the Add Contact Sheet itself is the sheet — no nested dialogs)

---

## Batch 28 — CRM (2 new) + KYC (2 existing + 1 new)

### Deal Detail (view-id: crm-deal-detail) [NEW]

**Purpose**: Per-deal workspace so deals have a real detail/edit surface — today deals only appear as inline rows inside the Contact Sheet.

**Layout** (top-to-bottom):
1. Breadcrumb — CRM › {Contact Name} › {Deal Name}.
2. PageHeader — title {Deal Name}, Briefcase icon, StatusBadge for stage, subline `{deal id} · {contact name} · {value}`. Actions: Edit (outline → opens Sheet), Move Stage (outline → opens Move Sheet), Mark Won (primary when stage ≠ closed-won), Mark Lost (destructive outline → opens AlertDialog), Delete (destructive ghost → opens AlertDialog).
3. KPI strip — 4 MetricCards: Deal Value, Probability %, Expected Close, Days in Stage.
4. Two-column layout — `grid lg:grid-cols-3`. Left 2/3 = tabs; right 1/3 = side panel.
5. Tabs (left): Overview / Activity / Files / Notes.
6. Overview tab: definition list (Name, Contact, Stage, Value, Currency, Probability, Owner, Source, Expected Close, Created At, Last Modified) + a stage-progress stepper showing the 4 deal stages (Qualified → Negotiation → Closed-Won / Closed-Lost) with the current stage highlighted.
7. Activity tab: vertical timeline (Created, Stage Moved, Note Added, File Attached, Email Sent) with actor + timestamp + small icon.
8. Files tab: file list (name, size, uploader, date) + "Upload File" outline button (opens File Upload Sheet).
9. Notes tab: textarea + "Save Note" outline button + a chronological list of prior notes.
10. Side panel (right): "Linked Contact" card with avatar + contact summary + "Open Contact" link; "Quick Actions" card with buttons (Log Call, Send Email, Schedule Follow-up — all toast stubs).

**Tables**: (none on the page; the Files tab renders a list, not a DataTable)

**Forms**: (none on the page; see Sheets)

**Actions** (buttons + behavior):
- "Edit" → opens Edit Deal Sheet.
- "Move Stage" → opens Move Stage Sheet.
- "Mark Won" → sets stage to closed-won, toast, KPI strip updates.
- "Mark Lost" → opens Mark Lost AlertDialog.
- "Delete" → opens Delete AlertDialog.
- "Upload File" (Files tab) → opens File Upload Sheet.
- "Save Note" (Notes tab) → toast "Note saved".
- "Open Contact" (side panel) → navigates to Contact Sheet / contact-detail.
- "Log Call" / "Send Email" / "Schedule Follow-up" → toast stubs.

**Dialogs / Modals / Sheets**:
- Edit Deal Sheet (trigger: Edit) → content: Name (input), Stage (Select — Qualified / Negotiation / Closed-Won / Closed-Lost), Value (currency input), Probability (number, 0–100), Expected Close (date input), Owner (Select), Source (Select), Notes (textarea). → actions: Save (primary, toast + close), Cancel (ghost).
- Move Stage Sheet (trigger: Move Stage) → content: a vertical stage stepper with a radio per stage + a "Reason for move" textarea. → actions: Move (primary, toast + close), Cancel (ghost).
- Mark Lost AlertDialog (trigger: Mark Lost) → content: title "Mark {Deal Name} as lost?", reason Select (Price / Competitor / No Decision / Timing / Other), loss-note textarea. → actions: Cancel, Mark as Lost (destructive).
- Delete AlertDialog (trigger: Delete) → content: title "Delete deal?", consequence text. → actions: Cancel, Delete (destructive).
- File Upload Sheet (trigger: Upload File) → content: file drop-zone, file-name input, file-type Select (Contract / Proposal / Invoice / Other), visibility Select (Private / Team). → actions: Upload (primary, toast + close), Cancel (ghost).

---

### Activity Log Timeline (view-id: crm-activity-log) [NEW]

**Purpose**: Cross-contact activity timeline that aggregates every CRM event (joins, emails, calls, deal moves, notes) into a single filterable feed.

**Layout** (top-to-bottom):
1. PageHeader — title "Activity Log", Activity icon, actions: "Export CSV" (outline).
2. KPI row — 4 MetricCards: Total Events (7d), Emails, Calls, Stage Moves.
3. Filter bar — Activity Type multi-select chips (Join / Email / Click / Demo / Deal / Note / Call), Owner Select, Stage Select, Date-range Select (24h / 7d / 30d / all), Reset, and on the right an "Apply Filters" outline button.
4. Activity feed — bordered card. A vertical timeline ordered list of events; each entry shows: timestamp (relative + absolute), actor avatar + name, activity-type icon, event label, contact link (navigates to Contact Sheet), deal link (when applicable, navigates to Deal Detail), event-detail line.

**Tables**: (none — feed is the table equivalent)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline) → exports the filtered feed.
- Activity-type chips → toggle filters.
- Owner / Stage / Date-range Selects → filter feed.
- "Reset" → clears filters.
- "Apply Filters" → no-op beyond toast today; redesign should simply apply the filter state (the chip pattern is enough).
- Contact link (per entry) → opens Contact Sheet.
- Deal link (per entry) → navigates to Deal Detail.

**Dialogs / Modals / Sheets**:
- Contact Sheet (trigger: contact link click) → identical to the Contacts page Sheet.

---

### Lead Scoring Configuration (view-id: crm-lead-scoring) [NEW]

**Purpose**: Tune the deterministic lead-scoring weights inline (today the methodology card is read-only on the Pipeline page).

**Layout** (top-to-bottom):
1. PageHeader — title "Lead Scoring", Award icon, primary action "Save Weights" (PermissionGuard `crm.update`).
2. KPI row — 4 MetricCards: Average Score, Hot Contacts (≥80), Warm Contacts (50–79), Cold Contacts (<50).
3. Score distribution card — bordered card with a 5-bucket BarSeries (Critical / High / Moderate / Low / Minimal) + tone legend.
4. Weight configuration card — Card with CardHeader "Scoring Weights" + CardDescription. CardContent is a DataTable of factor rows.
5. Thresholds card — Card with CardHeader "Thresholds" + CardContent: Hot threshold (number, default 80), Warm threshold (number, default 50), Auto-route Hot to (Select — Owner / Senior Rep / Round-robin), Auto-mark Cold as (Select — Watchlist / Archived).
6. Live preview card — Card with CardHeader "Live Preview" + CardContent: a Trader Select + a recalculated score read-out + a list of which factors fired.

**Tables**:
- Scoring Weights: Factor (label), Detail (muted), Current Weight (read-only), New Weight (number input, can be negative), Category (badge — Value / Engagement / Source / Profile) | (no per-row actions; the number input is the per-row action)

**Forms**:
- Scoring Weights form (above — the per-row inputs).
- Thresholds form (above).

**Actions** (buttons + behavior):
- "Save Weights" (primary, PageHeader) → toast "Weights saved"; recalculates KPI strip + distribution chart.
- "Reset to defaults" (outline) → resets all weights to defaults, toast.
- Per-row New Weight input → live-updates the Live Preview card.
- Threshold number inputs → live-update the KPI strip.
- Auto-route / Auto-mark Selects → update thresholds.
- Live Preview Trader Select → picks a contact whose score is recomputed live.

**Dialogs / Modals / Sheets**: (none)

---

### KYC Overview (view-id: kyc) [EXISTING]

**Purpose**: KPI grid + recent submissions table — the queue summary a reviewer sees first thing.

**Layout** (top-to-bottom):
1. PageHeader — title "KYC / AML", ShieldCheck icon, single action "Export" (outline).
2. KPI grid — `grid-cols-2 lg:grid-cols-4` of 8 MetricCards: Pending (warning), In Review, Approved (positive), Rejected (negative), High Risk (negative), Approval Rate (positive, with LabelWithHelp explaining the formula), Rejection Rate (negative, with LabelWithHelp), Avg Processing Time (warning, with LabelWithHelp).
3. Recent Submissions card — bordered card with header "Recent Submissions", DataTable below (6 rows, pageSize 6).

**Tables**:
- Recent Submissions: {Trader} (semibold), Document (capitalize), Country, Status (ExplainableStateBadge — kyc entity), Risk (StatusBadge low/medium/high with tone), Submitted (date, muted) | (no per-row actions today — spec flags missing "Start Review" button; redesign will add a Review button that opens the KYC Record Detail screen)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export" (outline, PageHeader) → `exportToCsv` of all KYC records.

**Dialogs / Modals / Sheets**: (none — KYC Record Detail screen in Batch 29 absorbs the row drill)

---

### KYC Reviews (view-id: kyc-reviews) [EXISTING]

**Purpose**: The full KYC queue + history table with Approve / Reject / Request Info actions per row.

**Layout** (top-to-bottom):
1. PageHeader — title "{Trader} KYC Reviews", FileSearch icon, no actions.
2. Card — bordered `bg-card p-4` with header "All Submissions ({count})", DataTable below.

**Tables**:
- KYC Submissions: {Trader} (semibold), Document (capitalize), Country, Status (ExplainableStateBadge), Risk (StatusBadge), Submitted (date, muted), Reviewed (date or em-dash) | Approve (primary, only when status = pending/review), Reject (destructive ghost → opens AlertDialog), Request Info (outline → opens AlertDialog)

**Forms**: (none on the page; see AlertDialogs)

**Actions** (buttons + behavior):
- "Approve" → toast "Approved" (spec flags this as a stub; redesign calls a real mutation).
- "Reject" → opens Reject AlertDialog.
- "Request Info" → opens Request Info AlertDialog.
- Row click → opens KYC Record Detail screen (NEW in Batch 29, replacing today's missing drill).

**Dialogs / Modals / Sheets**:
- Reject AlertDialog (trigger: Reject) → content: title with ShieldAlert icon, description naming the trader + document + country, consequence box ("Applicant will be notified and may re-submit if eligible. Account remains pending. Action logged."). → actions: Cancel, Reject (destructive).
- Request Info AlertDialog (trigger: Request Info) → content: title "Request additional documents", description, a checklist of 5 document types (Proof of Address, Selfie with ID, Bank Statement, Source of Funds, Other) each with a label + helper line, an "Additional instructions" textarea, disabled Send button until at least one doc is checked or instructions are non-empty. → actions: Cancel, Send Request (primary).

---

## Batch 29 — KYC (1 existing + 4 new)

### KYC Risk (view-id: kyc-risk) [EXISTING]

**Purpose**: Risk distribution donut + high-risk records table so the compliance lead sees the shape of AML exposure.

**Layout** (top-to-bottom):
1. PageHeader — title "Risk", AlertTriangle icon, no actions.
2. Charts row — `grid gap-4 lg:grid-cols-2`: Risk Distribution DonutSeries card (low / medium / high) + High-Risk Records card (header with a danger-toned badge "{count} flagged" + DataTable).

**Tables**:
- High-Risk Records: {Trader} (semibold), Document (capitalize), Country, Status (ExplainableStateBadge), Risk (StatusBadge low/med/high), Submitted (date, muted) | (no per-row actions today — redesign wires row click to KYC Record Detail)

**Forms**: (none)

**Actions** (buttons + behavior):
- Row click (redesign, missing today) → opens KYC Record Detail screen.
- "Escalate to AML team" (redesign, missing today) → opens Escalate to AML Sheet (defined on KYC Record Detail).
- Donut segment click (redesign, missing today) → filters the high-risk table by the clicked risk level.

**Dialogs / Modals / Sheets**: (none — redesign wires KYC Record Detail Sheet on row click)

---

### KYC Record Detail (view-id: kyc-record-detail) [NEW]

**Purpose**: Full document viewer for a single KYC record — ID images, selfie, address proof — so reviewers can adjudicate without leaving the prop-admin.

**Layout** (top-to-bottom):
1. Breadcrumb — KYC › Reviews › {Trader Name} #{record id}.
2. PageHeader — title {Trader Name}, ShieldCheck icon, StatusBadge for status, subline `{document type} · {country} · submitted {relative}`. Actions: Approve (primary, only when status = pending/review), Reject (destructive outline → opens AlertDialog), Request Info (outline → opens AlertDialog — reuses the Request Info pattern from Reviews), Assign Reviewer (outline → opens Sheet), Escalate to AML (outline → opens Sheet).
3. KPI strip — 4 MetricCards: Risk Score (low/med/high + tone), Submitted (relative), Reviewer (name or "Unassigned"), Time in Queue (relative).
4. Two-column layout — `grid lg:grid-cols-3`. Left 2/3 = document viewer; right 1/3 = side panel.
5. Document viewer (left): Tabs with one TabsTrigger per uploaded document (ID Front / ID Back / Selfie / Proof of Address / Source of Funds). Each tab renders a large image preview with zoom controls, a "Download original" outline button, and a "Flag for re-upload" ghost button.
6. Side panel (right): "Applicant" card (name, email, phone, country, DOB); "Account" card (trader id, account id, challenge name, plan); "Verification History" card (timeline of submitted → reviewed → approved/rejected → re-submitted); "Reviewer Notes" card (textarea + "Save Note" outline button).

**Tables**: (none on the page)

**Forms**: (none on the page; see Sheets)

**Actions** (buttons + behavior):
- "Approve" → toast "Approved"; navigates back to KYC Reviews.
- "Reject" → opens Reject AlertDialog (reuses the pattern from KYC Reviews).
- "Request Info" → opens Request Info AlertDialog (reuses the pattern from KYC Reviews).
- "Assign Reviewer" → opens Assign Reviewer Sheet.
- "Escalate to AML" → opens Escalate to AML Sheet.
- Tab image zoom controls → zoom in / out / reset.
- "Download original" → triggers download of the high-res image.
- "Flag for re-upload" → toast "Flagged for re-upload"; adds a status badge to the document.
- "Save Note" → toast "Note saved".

**Dialogs / Modals / Sheets**:
- Assign Reviewer Sheet (trigger: Assign Reviewer) → content: a searchable list of available reviewers (name + current queue size + specialty badges), with radio selection. → actions: Assign (primary), Cancel (ghost).
- Escalate to AML Sheet (trigger: Escalate to AML) → content: reason Select (High-risk jurisdiction / Structured deposits / PEP match / Adverse media / Other), priority Select (Standard / High / Critical), narrative textarea, "Attach SAR (Suspicious Activity Report)" file upload. → actions: Escalate (primary, navigates to AML Case Management), Cancel (ghost).

---

### AML Case Management (view-id: kyc-aml-cases) [NEW]

**Purpose**: A dedicated workspace for AML analysts to triage escalated cases, attach SARs, mark cleared, and route to compliance.

**Layout** (top-to-bottom):
1. PageHeader — title "AML Cases", ShieldAlert icon, primary action "New Case" (only visible to compliance role — PermissionGuard).
2. KPI row — 4 MetricCards: Open Cases, Critical Priority (negative), Avg Time-to-Close, Cleared This Month (positive).
3. Filter bar — Status Select (All / Open / In Review / Pending SAR / Cleared / Escalated), Priority Select (All / Standard / High / Critical), Risk Select, Assignee Select, Date-range, Reset.
4. Cases DataTable — bordered card with header "AML Cases ({count})".

**Tables**:
- AML Cases: Case ID (monospace), Trader (semibold), Risk (StatusBadge), Reason (badge list — High-risk jurisdiction / Structured deposits / PEP / Adverse media), Priority (StatusBadge), Assignee, Opened (relative), Status (StatusBadge) | Open (primary → navigates to AML Case Detail), Assign (ghost → opens Sheet), Attach SAR (ghost → opens Sheet), Mark Cleared (outline → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Case" (primary) → opens New Case Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Open" → navigates to AML Case Detail (sub-route).
- Row "Assign" → opens Assign Sheet.
- Row "Attach SAR" → opens SAR Upload Sheet.
- Row "Mark Cleared" → opens Clear Case AlertDialog.

**Dialogs / Modals / Sheets**:
- New Case Sheet (trigger: New Case) → content: Trader Select (searchable), Reason Select, Priority Select, Narrative textarea, Initial SAR upload (optional). → actions: Create Case (primary), Cancel (ghost).
- Assign Sheet (trigger: Assign) → content: searchable reviewer list. → actions: Assign (primary), Cancel (ghost).
- SAR Upload Sheet (trigger: Attach SAR) → content: file drop-zone, SAR type Select (Initial / Continuing / Final), filing-id input, narrative textarea. → actions: Upload (primary), Cancel (ghost).
- Clear Case AlertDialog (trigger: Mark Cleared) → content: title "Mark case as cleared?", a closure reason Select (No further action / False positive / Resolved via SAR / Other), and a closure-note textarea. → actions: Cancel, Mark Cleared (primary).

---

### KYC Provider Settings (view-id: kyc-providers) [NEW]

**Purpose**: Switch the KYC verification provider per tenant — Onfido / Sumsub / Veriff / Persona / manual — and tune thresholds.

**Layout** (top-to-bottom):
1. PageHeader — title "KYC Provider Settings", Settings2 icon, primary action "Save Configuration" (PermissionGuard `kyc.configure`).
2. KPI row — 4 MetricCards: Active Provider, Avg API Latency (ms), Verification Success Rate, Fallback Status (StatusBadge).
3. Active provider card — bordered card with the provider logo, name, status badge, last sync, and a "Test Connection" outline button + "Switch Provider" outline button.
4. Provider selection grid — `grid md:grid-cols-2 xl:grid-cols-3` of provider cards (Onfido / Sumsub / Veriff / Persona / Manual). Each card shows logo, name, description, status badge (Active / Available / Not configured), and per-card actions.
5. Configuration form card — Card with CardHeader "Provider Configuration" + Tabs: Credentials / Thresholds / Webhooks.
6. Credentials tab: API Key (SecretField), Secret Key (SecretField), Webhook Secret (SecretField with regenerate button), Environment Select (Sandbox / Live).
7. Thresholds tab: Auto-approve threshold (number, 0–100), Auto-reject threshold (number), Manual review band (read-only computed range), PEP screening toggle, Sanctions screening toggle, Adverse media toggle, Document expiry days (number).
8. Webhooks tab: Inbound webhook URL (read-only + copy), Subscribed events multi-select (verification.completed / verification.failed / check.run / report.ready), IP allowlist textarea.

**Tables**: (none)

**Forms**:
- Configuration form (above — across 3 tabs).

**Actions** (buttons + behavior):
- "Save Configuration" (primary, PageHeader) → toast "Saved".
- "Test Connection" (outline, Active provider card) → toast "Connection OK" / "Connection failed".
- "Switch Provider" (outline) → opens Switch Provider AlertDialog.
- Provider card "Configure" → loads that provider's credentials into the form.
- Provider card "Activate" → opens Activate AlertDialog.
- "Regenerate" (webhook secret) → toast "Regenerated; copy before save".
- Copy buttons → clipboard + toast.

**Dialogs / Modals / Sheets**:
- Switch Provider AlertDialog (trigger: Switch Provider) → content: title "Switch from {active} to {target}?", consequence text describing the in-flight verification interruption. → actions: Cancel, Switch (destructive).
- Activate AlertDialog (trigger: provider card Activate) → content: title "Activate {provider}?", warning that switching providers may invalidate pending checks. → actions: Cancel, Activate (primary).

---

### Reviewer Audit Trail (view-id: kyc-reviewer-trail) [NEW]

**Purpose**: Reviewer-by-reviewer audit trail so compliance leads can adjudicate performance, bias and throughput.

**Layout** (top-to-bottom):
1. PageHeader — title "Reviewer Audit Trail", History icon, single action "Export CSV" (outline).
2. KPI row — 4 MetricCards: Reviewers Active, Reviews Today, Avg Time / Review, Approval Rate (positive).
3. Filter bar — Reviewer Select (derived from tenant compliance users), Decision Select (All / Approved / Rejected / Requested Info / Escalated), Date-range, Reset.
4. Reviewers leaderboard DataTable — bordered card with header "Reviewers ({count})".
5. Per-reviewer decision timeline — bordered card showing the selected reviewer's chronological decision feed; each entry has timestamp, trader, document, decision badge, time-to-decision, risk-at-decision.

**Tables**:
- Reviewers: Reviewer (avatar + name), Reviews (number), Avg Time / Review (e.g. `4m 20s`), Approval % (success tone), Rejection % (danger tone), Escalations (number), Last Active (relative), Bias Indicator (StatusBadge — Balanced / Approve-leaning / Reject-leaning) | Open Profile (ghost → opens Reviewer Sheet)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline) → exports the leaderboard.
- Reviewer / Decision / Date-range filters → filter leaderboard + timeline.
- "Reset" → clears filters.
- Row "Open Profile" → opens Reviewer Sheet.

**Dialogs / Modals / Sheets**:
- Reviewer Sheet (trigger: Open Profile) → content: header with avatar + name + role. KPI strip — 4 pills (Reviews / Avg Time / Approval / Reject). Tabs: Decisions / Workload / Notes. Decisions tab = DataTable of their decisions (timestamp / trader / document / decision / time-to-decision). Workload tab = a small BarSeries of their reviews per day for the last 14 days. Notes tab = a textarea + Save Note button. → actions: Save Note (outline, toast), Close (ghost).

---

## Batch 30 — Support (4 existing + 1 new)

### Support Overview (view-id: support) [EXISTING]

**Purpose**: 4-card KPI row + recent tickets + priority distribution donut — the support lead's at-a-glance dashboard.

**Layout** (top-to-bottom):
1. PageHeader — title "Support", LifeBuoy icon, single action "New Ticket" (outline — today a toast stub; redesign opens Create Ticket dialog from Batch 30).
2. KPI row — 4 MetricCards: Open Tickets (warning), Urgent (negative), Avg Response (e.g. `3h`), Resolved Today (positive).
3. Three-column row — `grid gap-4 lg:grid-cols-3`: left 2/3 = Recent tickets DataTable, right 1/3 = Priority distribution DonutSeries (Urgent / High / Medium / Low).

**Tables**:
- Recent tickets: Subject (semibold), {Trader} (muted), Priority (StatusBadge), Status (StatusBadge), Created (relative) | (row click is **missing today** — redesign wires it to the same Ticket Sheet used on the Tickets page)

**Forms**: (none)

**Actions** (buttons + behavior):
- "New Ticket" (outline, PageHeader) → toast stub today; redesign opens Create Ticket dialog.
- Row click (redesign) → opens Ticket Sheet.

**Dialogs / Modals / Sheets**:
- Ticket Sheet (redesign only) → identical to the Tickets page Sheet.

---

### Tickets (view-id: support-tickets) [EXISTING]

**Purpose**: Full ticket queue with multi-select filter chips + a rich Ticket Sheet drawer for reply / escalation / resolution.

**Layout** (top-to-bottom):
1. PageHeader — title "Support Tickets", Inbox icon, no actions.
2. Filter bar — bordered `bg-muted/20 p-2` row: Filter icon + label + active-count Badge; Status Select (All / open / in-progress / waiting / resolved / closed), Priority Select (All / urgent / high / medium / low), Category Select (All / account / payout / trading / technical / billing), Assignee Select (All / Unassigned + each tenant assignee), Clear-all ghost button; right-aligned count "filtered of total tickets".
3. DataTable — full-width, pageSize 12.

**Tables**:
- Tickets: Subject (semibold), {Trader} (muted), Category (capitalize, muted), Priority (StatusBadge), Status (StatusBadge), SLA (StatusBadge — Breached / At Risk / OK), Assignee (or "Unassigned"), Created (relative), Messages (number) | (row click → opens Ticket Sheet)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- Status / Priority / Category / Assignee Selects → filter rows; count label updates.
- "Clear all" → resets all filters to "All".
- Row click → opens Ticket Sheet.

**Dialogs / Modals / Sheets**:
- Ticket Sheet (trigger: row click) → content: header with subject + ticket id + opened-relative + StatusBadge. KPI strip — 3 pills: SLA (hours), Assignee (or "Unassigned"), Messages (count). Conversation thread — alternating left/right chat bubbles (trader left, agent right) with avatar + author + timestamp + body. Internal notes Collapsible — collapsed by default with a "Internal notes (n)" trigger; expanded reveals dashed-border note cards. Reply box — Textarea + Attach (Paperclip ghost button → toast stub), Canned (FileText ghost button → toast stub), Send (primary, disabled until reply non-empty). → actions: Escalate (outline, toast "Escalated to Tier 2"), Resolve (primary, closes Sheet + toast).

---

### SLA Management (view-id: support-sla) [EXISTING]

**Purpose**: SLA policy configuration table + breach-monitoring charts + agent-workload table with a per-policy Edit Sheet.

**Layout** (top-to-bottom):
1. PageHeader — title "SLA Management", Clock icon, `term` line "Across all {traders} · {active} active policies", actions: "Export CSV" (outline), "Save Changes" (primary).
2. KPI row — 4 MetricCards: Total Tickets (30d), Breached SLAs (negative), Avg First Response, Avg Resolution Time.
3. SLA Policy Configuration card — Card with CardHeader (Gauge icon + "SLA Policy Configuration" + CardDescription) + DataTable.
4. Charts row — `grid gap-4 lg:grid-cols-2`: SLA Breach Trend AreaSeries card + SLA Compliance by Priority BarChart card (with color-band legend).
5. Currently Breached Tickets card — Card with CardHeader (AlertTriangle icon + "Currently Breached Tickets" + CardDescription "Click any row to open the ticket") + DataTable.
6. Agent Workload card — Card with CardHeader (Users icon + "Agent Workload" + CardDescription) + DataTable.

**Tables**:
- SLA Policies: Priority (StatusBadge), First Response (hours, tabular), Resolution (hours, tabular), Description (muted), Active (Switch — toggles live), Actions: Edit (outline → opens Sheet)
- Breached Tickets: Ticket ID (monospace), Subject (semibold), Priority (StatusBadge), Created (relative), SLA Due (relative), Time Over (hours + AlertTriangle), Assignee, Status (Breached StatusBadge) | (row click → navigates to support-tickets with `{ breached: ticketId }`)
- Agent Workload: Agent (avatar + name), Open Tickets (number), Avg Response (e.g. `1.8h`), Avg Resolution (e.g. `6.4h`), SLA Compliance (number + small progress bar + tone), Status (StatusBadge On Target / At Risk / Off Target) | (no per-row actions today; redesign wires row click to Agent Detail screen, Batch 30)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Export CSV" (outline, PageHeader) → `exportToCsv` of breached tickets.
- "Save Changes" (primary, PageHeader) → toast "SLA policies saved".
- Per-row Switch → toggles the policy on/off, toast "Enabled/Disabled".
- Per-row "Edit" → opens SLA Policy Edit Sheet.
- Breached-ticket row click → `navigate("support-tickets", { breached: ticketId })`.
- Agent-workload row click (redesign) → navigates to Agent Detail screen.

**Dialogs / Modals / Sheets**:
- SLA Policy Edit Sheet (trigger: Edit) → content: Priority (read-only StatusBadge + "Cannot be changed" caption), Separator, First Response Target hours (number input, LabelWithHelp), Resolution Target hours (number input, LabelWithHelp), Auto-escalate after hours (number input, LabelWithHelp), Separator, Business hours only (Switch in a bordered box with LabelWithHelp), Pause on customer response (Switch in a bordered box with LabelWithHelp). → actions: Cancel (outline), Save Policy (primary).

---

### Knowledge (view-id: support-knowledge) [EXISTING]

**Purpose**: Static FAQ cards (6 cards today) — the redesign adds search + category filter + CRUD scaffolding.

**Layout** (top-to-bottom):
1. PageHeader — title "Knowledge Base", BookOpen icon, action: "New Article" (primary — PermissionGuard `support.configure`, only visible to admins; opens Knowledge Article Editor in Batch 30).
2. Toolbar — Search input (full-text), Category Select (All / Getting Started / Trading / Payouts / Account / Technical / Billing), Sort Select (Most viewed / Recently updated / A–Z).
3. Card grid — `grid md:grid-cols-2 lg:grid-cols-3` of FAQ cards. Each card: small icon box, category uppercase label, CardTitle (the question), CardDescription (the answer), a footer with "Was this helpful?" (Thumbs Up / Thumbs Down ghost buttons) + view count.

**Tables**: (none)

**Forms**: (none)

**Actions** (buttons + behavior):
- "New Article" (primary, admin-only) → navigates to Knowledge Article Editor screen.
- Search input → filters cards by question + answer.
- Category Select → filters cards.
- Sort Select → re-sorts cards.
- Card click → (redesign) navigates to article detail page.
- Thumbs Up / Thumbs Down → toast "Thanks for the feedback" (today stub; redesign persists CSAT).
- "Contact support" CTA at the bottom of the page → navigates to Tickets page (today a static link).

**Dialogs / Modals / Sheets**: (none)

---

### Create Ticket Dialog (view-id: support-create-ticket) [NEW]

**Purpose**: First-class Create Ticket dialog that every support screen can trigger — replaces today's toast stubs on Support Overview and elsewhere.

**Layout** (top-to-bottom): (this is a Dialog/Sheet, not a full page)
1. Dialog header — title "New Support Ticket", LifeBuoy icon, subline "Open a ticket on behalf of {trader}."
2. Form body — 2-step Tabs (Details / Advanced).
3. Details tab: Trader Select (searchable by name/email), Subject (input, max 120, char counter), Category Select (Account / Payout / Trading / Technical / Billing), Priority Select (Low / Medium / High / Urgent — choosing Urgent surfaces an SLA warning), Description (Textarea, LabelWithHelp).
4. Advanced tab: Assignee Select (default = current user), Tags (chip multi-input), Attachments (file drop-zone, multiple), Related Order/Payout ID (optional input), Internal Note (Textarea — only visible to support agents, not the trader).

**Tables**: (none)

**Forms**:
- Create Ticket form (above).

**Actions** (buttons + behavior):
- "Create & Open" (primary) → creates ticket, opens Ticket Sheet for the new ticket, toast "Ticket created".
- "Create & Add Another" (outline) → creates ticket, resets the form, toast "Ticket created".
- "Cancel" (ghost) → closes Dialog without saving.

**Dialogs / Modals / Sheets**: (none nested — the Create Ticket Dialog is itself the dialog)

---

## Batch 31 — Support (4 new) + AI (1 existing)

### Canned Responses Library (view-id: support-canned-responses) [NEW]

**Purpose**: Admin surface for the canned-response picker that today is a toast stub inside the Ticket Sheet — operators can author, organize and approve reusable macros.

**Layout** (top-to-bottom):
1. PageHeader — title "Canned Responses", FileText icon, primary action "New Response" (→ opens Sheet).
2. KPI row — 4 MetricCards: Total Responses, Active Responses, Most Used (text), Avg Insertions / Week.
3. Filter bar — Category Select (All / Greeting / Refund / KYC / Payout / Technical / Closing), Tag multi-input chips, Status Select (All / Draft / Published / Archived), Reset.
4. Responses DataTable — bordered card with header "Responses ({count})".

**Tables**:
- Responses: Title (semibold + id subline), Category (badge), Body Preview (muted, truncated 1 line), Tags (chip list), Insertions (number, 30d), Last Edited (relative), Status (StatusBadge Draft / Published / Archived) | Edit (ghost → opens Sheet), Duplicate (ghost → opens Sheet pre-filled), Archive (ghost → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Response" (primary) → opens Response Editor Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Edit" → opens Response Editor Sheet in edit mode.
- Row "Duplicate" → opens Response Editor Sheet pre-filled.
- Row "Archive" → opens Archive AlertDialog.

**Dialogs / Modals / Sheets**:
- Response Editor Sheet (trigger: New / Edit / Duplicate) → content: Title (input), Category Select, Tags (chip multi-input), Body (rich Textarea with merge-field insert button — `{{trader_first_name}}` etc), Status Select (Draft / Published), Preview card (renders the body with sample merge-field values). → actions: Save (primary, toast + close), Insert Merge Field (outline, opens Merge Field Picker Dialog), Cancel (ghost).
- Merge Field Picker Dialog (trigger: Insert Merge Field) → content: same picker as the Marketing Template Editor's. → actions: Cancel, Insert (primary).
- Archive AlertDialog (trigger: Archive) → content: title "Archive canned response?", consequence text. → actions: Cancel, Archive (destructive).

---

### Agent Detail (view-id: support-agent-detail) [NEW]

**Purpose**: Per-agent workspace reached from SLA Management agent-workload table — workload, performance, assigned tickets, recent activity.

**Layout** (top-to-bottom):
1. Breadcrumb — Support › SLA Management › {Agent Name}.
2. PageHeader — title {Agent Name}, User icon, StatusBadge for compliance state (On Target / At Risk / Off Target), subline `{role} · {email} · {active tickets} open`. Actions: Assign Tickets (outline → opens Sheet), Reassign All (outline → opens AlertDialog — destructive), View Profile (ghost → navigates to user-management detail).
3. KPI row — 5 MetricCards in `grid-cols-2 lg:grid-cols-5`: Open Tickets, Avg First Response, Avg Resolution, SLA Compliance % (tone), CSAT (positive).
4. Two-column layout — `grid lg:grid-cols-3`. Left 2/3 = tabs; right 1/3 = side panel.
5. Tabs (left): Assigned Tickets / Recent Activity / CSAT Feedback.
6. Assigned Tickets tab — DataTable of the agent's open tickets (Subject / Priority / Status / SLA / Opened) | row click navigates to the Ticket Sheet.
7. Recent Activity tab — vertical timeline (Ticket Assigned / Replied / Resolved / Escalated / Note Added) with timestamps.
8. CSAT Feedback tab — DataTable of recent CSAT ratings (Ticket / Rating 1–5 / Comment / Submitted-relative) | row click opens Ticket Sheet.
9. Side panel (right): "Workload heatmap" card (small grid of cells, color intensity = ticket count per day-hour over last 14 days); "Workload by Category" DonutSeries card; "Quick Actions" card with buttons.

**Tables**:
- Assigned Tickets: Subject, Priority, Status, SLA, Opened | row click → Ticket Sheet
- CSAT Feedback: Ticket, Rating (1–5), Comment, Submitted-relative | row click → Ticket Sheet

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "Assign Tickets" → opens Assign Sheet.
- "Reassign All" → opens Reassign All AlertDialog.
- "View Profile" → navigates to user-management detail.
- Row clicks → open Ticket Sheet or relevant sub-page.

**Dialogs / Modals / Sheets**:
- Assign Sheet (trigger: Assign Tickets) → content: a multi-select list of unassigned tickets with checkboxes, an Assignee Select defaulting to this agent, a Note textarea. → actions: Assign (primary), Cancel (ghost).
- Reassign All AlertDialog (trigger: Reassign All) → content: title "Reassign all of {agent}'s tickets?", a Reassign-to Select (other agent), a warning that in-flight tickets will move ownership. → actions: Cancel, Reassign (destructive).

---

### Knowledge Article Editor (view-id: support-knowledge-editor) [NEW]

**Purpose**: Author surface for knowledge-base articles — content authors draft, preview, and publish, with version history.

**Layout** (top-to-bottom):
1. PageHeader — title "Article Editor", FileText icon, actions: "Save Draft" (outline), "Preview" (outline → opens Preview Sheet), "Publish" (primary → opens Publish AlertDialog), "Delete" (destructive ghost → opens AlertDialog).
2. Two-pane layout — `grid lg:grid-cols-2`. Left = article form; right = live preview.
3. Article form (left): Title (input), Slug (auto-generated from title, editable), Category Select (Getting Started / Trading / Payouts / Account / Technical / Billing), Tags (chip multi-input), Summary (input — used in card list), Body (rich Textarea with merge-field tokens for article links), Related Articles (multi-select), Visibility Select (Public / Authenticated / Internal).
4. Preview (right): phone-frame mock of the article as it will appear on the trader dashboard, with a category badge, title, summary, body, related-articles chips.

**Tables**: (none)

**Forms**:
- Article form (above).

**Actions** (buttons + behavior):
- "Save Draft" → toast "Draft saved".
- "Preview" → opens Preview Sheet (full-width) with a larger phone/desktop preview.
- "Publish" → opens Publish AlertDialog.
- "Delete" → opens Delete AlertDialog.
- Title input → live-updates slug + preview.

**Dialogs / Modals / Sheets**:
- Preview Sheet (trigger: Preview) → content: large rendered preview with device tabs (Desktop / Mobile). → actions: Close (ghost).
- Publish AlertDialog (trigger: Publish) → content: title "Publish article?", a "Notify subscribers" checkbox, a "Schedule for" datetime input. → actions: Cancel, Publish (primary).
- Delete AlertDialog (trigger: Delete) → content: title "Delete article?", consequence text. → actions: Cancel, Delete (destructive).

---

### CSAT / Feedback Review (view-id: support-csat) [NEW]

**Purpose**: Central review screen for CSAT ratings — surface low ratings for follow-up, track trends.

**Layout** (top-to-bottom):
1. PageHeader — title "CSAT & Feedback", Star icon, action: "Export CSV" (outline).
2. KPI row — 4 MetricCards: Avg CSAT (positive), Responses (30d), Low Ratings (1–2, negative), Follow-ups Needed (negative when > 0).
3. Charts row — `grid gap-4 lg:grid-cols-2`: CSAT Trend AreaSeries (14-day) + Rating Distribution DonutSeries (1★ / 2★ / 3★ / 4★ / 5★).
4. Filter bar — Rating multi-select chips (1–5), Agent Select, Category Select, Date-range, Reset, "Only Follow-up Needed" Switch.
5. Feedback DataTable — bordered card with header "Feedback ({count})".

**Tables**:
- Feedback: Ticket (monospace + subject), Rating (1–5 stars), Comment (truncated), Agent (when assigned), Category, Submitted (relative), Follow-up Status (StatusBadge Needed / Done / N/A) | Open Ticket (ghost → opens Ticket Sheet), Mark Follow-up Done (ghost toggle), Reply (ghost → opens Reply Sheet)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "Export CSV" → exports feedback.
- Rating / Agent / Category / Date-range filters → filter DataTable.
- "Reset" → clears filters.
- "Only Follow-up Needed" Switch → toggles the filter.
- Row "Open Ticket" → opens Ticket Sheet.
- Row "Mark Follow-up Done" → toggles the row's follow-up status, toast.
- Row "Reply" → opens Reply Sheet.

**Dialogs / Modals / Sheets**:
- Ticket Sheet (trigger: Open Ticket) → identical to the Tickets page Sheet.
- Reply Sheet (trigger: Reply) → content: rating context card (ticket id + rating + comment), a Reply Textarea, a "Mark follow-up done" checkbox (default checked), a "Send to trader" checkbox. → actions: Send (primary, toast + close), Cancel (ghost).

---

### AI Overview (view-id: ai) [EXISTING]

**Purpose**: 4-card KPI row + insights feed + confidence chart — the AI module landing page.

**Layout** (top-to-bottom):
1. PageHeader — title "AI / LLM", Brain icon, no actions.
2. KPI row — 4 MetricCards: Active Insights (positive), Avg Confidence, Opportunities (positive), Critical Alerts (negative).
3. Three-column row — `grid gap-4 lg:grid-cols-3`: left 2/3 = Insights feed card (vertical list of insight rows, each with severity icon + title + summary + confidence + relative time); right 1/3 = Confidence by insight BarSeries card.

**Tables**: (none — feed is the table equivalent)

**Forms**: (none)

**Actions** (buttons + behavior):
- Insight card click → navigates to AI Insights page filtered to that insight (today missing; redesign wires it).
- "Refresh insights" button (redesign, missing today) → toast "Insights refreshed".

**Dialogs / Modals / Sheets**: (none)

---

## Batch 32 — AI (5 existing)

### AI Insights (view-id: ai-insights) [EXISTING]

**Purpose**: Filterable grid of AI insight cards with Apply / Investigate / Create ticket / Dismiss actions.

**Layout** (top-to-bottom):
1. PageHeader — title "AI Insights", Sparkles icon, no actions.
2. Filter bar — bordered `bg-muted/20 p-2`: Filter icon + active-count Badge; Severity Select (All / critical / warning / info / opportunity), Module Select (All / trading / risk / payouts / analytics / kyc / support / ai), Confidence Select (All / High > 80% / Medium 50–80% / Low < 50%), Clear-all ghost; right-aligned count "filtered of total · n dismissed".
3. Insight grid — `grid gap-4 md:grid-cols-2 lg:grid-cols-3` of insight Cards. Each card: severity icon + StatusBadge + relative time; CardTitle = insight title; CardDescription = summary; muted detail line; confidence progress bar at the bottom; CardFooter with action buttons.

**Tables**: (none — grid of Cards)

**Forms**: (none)

**Actions** (buttons + behavior):
- Severity / Module / Confidence Selects → filter grid.
- "Clear all" → resets filters.
- Card body click → `navigate(investigateTargetFor(insight))` — routes to the relevant module page.
- "Apply" (primary, footer) → toast "Applied recommendation".
- "Investigate" (outline, footer) → same navigation as card body click.
- "Create ticket" (ghost, footer) → toast "Subject pre-filled" + `navigate("support-tickets", { subject: insight.title })`.
- "Dismiss" (outline, footer) → removes the card from the grid, toast "Insight dismissed".

**Dialogs / Modals / Sheets**: (none — redesign adds the Per-Insight Detail Sheet in Batch 32)

---

### AI Assistant (view-id: ai-assistant) [EXISTING]

**Purpose**: Mock chat UI; redesign wires real LLM calls + history sidebar.

**Layout** (top-to-bottom):
1. PageHeader — title "AI Assistant", Bot icon, no actions.
2. Chat card — full-width Card with a fixed height (`h-[560px]`) and three stacked zones:
3. Top bar — avatar (Bot icon) + "PFaaS Assistant" + "Powered by tenant LLM · demo mode" caption.
4. ScrollArea — alternating left (assistant) / right (user) chat bubbles with avatar + body.
5. Bottom bar — Input (full width) + "Send" primary button; muted caption "Press Enter to send. Demo mode — responses are simulated."

**Tables**: (none)

**Forms**:
- Chat input — single Input + Send button.

**Actions** (buttons + behavior):
- Input + Enter (or Send click) → today: appends the user message + toast "AI response (demo)"; redesign: appends user message + streams real LLM reply.
- "Clear conversation" / "New chat" (redesign, missing today) → resets the chat to seed.
- Suggested-prompts chips (redesign) → pre-fill the input.
- Copy-to-clipboard per assistant bubble (redesign) → toast "Copied".

**Dialogs / Modals / Sheets**: (none)

---

### AI Configure (view-id: ai-configure) [EXISTING]

**Purpose**: Feature toggles + model selector + advanced hyperparameters + system prompt; gated by `ai.configure` permission.

**Layout** (top-to-bottom):
1. PageHeader — title "AI Configuration", Brain icon, no actions.
2. Two-column row — `grid gap-4 lg:grid-cols-2`: Feature toggles card + Model selection card.
3. Feature toggles card — Card with CardHeader "Feature toggles" + CardDescription, CardContent renders 3 FeatureToggle rows (AI Insights / Predictions / Anomaly Detection). Each row is a bordered box with label + description + Switch.
4. Model selection card — Card with CardHeader "Model selection" + CardDescription, CardContent renders Model Select (GPT-4o mini / GPT-4o / Claude 3.5 Sonnet / Llama 3.1 70B / Mistral Large) + a muted "Tip" card explaining the cost-capability trade-off.
5. Advanced Configuration Collapsible — Card with a CollapsibleTrigger header (Settings2 icon + "Advanced Configuration" + Show/Hide label). When expanded, CardContent renders a 3-column grid (Temperature number / Top-p number / Max tokens number, each with a LabelWithHelp) and a System prompt Textarea with a LabelWithHelp.
6. Footer — PermissionGuard fallback (read-only notice for users without `ai.configure`) or a right-aligned "Save configuration" primary button.

**Forms**:
- AI Configuration form (above — feature toggles + model + advanced + system prompt).

**Actions** (buttons + behavior):
- "Save configuration" (primary, PageFooter) → toast "AI configuration saved" with the resolved values.
- "Reset to defaults" (redesign, missing today) → resets all fields to defaults, toast.
- "Test model" (redesign, missing today) → opens Test Model Sheet.

**Dialogs / Modals / Sheets**:
- Test Model Sheet (redesign, trigger: Test Model) → content: a single-turn prompt Input + Send button + a result Textarea that streams the LLM reply + tokens-used readout. → actions: Send (primary), Close (ghost).

---

### Predictive Analytics (view-id: ai-predictive) [EXISTING]

**Purpose**: Churn risk, payout fraud risk, success probability, 30-day signup forecast — with deterministic mock models.

**Layout** (top-to-bottom):
1. PageHeader — title "Predictive Analytics", TrendingUp icon, `term` line "{trader} tenant · {predictions} predictions (30d)", actions: "Export churn" (outline), "Export payouts" (outline).
2. KPI row — 4 MetricCards: Predictions Made (30d), Model Accuracy (positive), High-Risk {Trader} Flagged (negative), Fraud Prevented (positive).
3. Churn Risk Distribution card — ChartCard with a 5-bucket BarChart (Critical / High / Moderate / Low / Minimal), color-coded, with a legend.
4. Top 10 Churn-Risk {Traders} card — bordered card with header (LabelWithHelp) + count badge "n need action" + DataTable.
5. Payout Fraud Risk card — bordered card with DataTable.
6. Success Probability card — bordered card with DataTable.
7. 30-Day Signup Forecast card — ChartCard with an AreaSeries of forecasted daily signups.

**Tables**:
- Top 10 Churn-Risk: Rank (medal icon for top 3), {Trader} (semibold + email), Churn Score (number, tone), Days Inactive (number), Equity (currency), Last Activity (relative), Recommended Action (text badge) | row click → `navigate("trader-detail", { id })`
- Payout Fraud Risk: Payout ID (monospace), {Trader} (semibold), Amount (currency), Risk Score (number, tone), Risk Factors (badge list), Recommended Reviewer | row click → `navigate("payouts-pending", { id: payoutId })`
- Success Probability: Rank (medal icon), {Trader} (semibold + email), Probability (number, tone), Tier (badge High / Medium / Low) | row click → `navigate("trader-detail", { id })`

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export churn" → `exportToCsv` of churn rows.
- "Export payouts" → `exportToCsv` of payout-risk rows.
- Row clicks → navigate to trader-detail / payouts-pending.
- "Retrain model" (redesign, missing today) → opens Retrain AlertDialog.

**Dialogs / Modals / Sheets**:
- Retrain AlertDialog (redesign, missing today) → content: title "Retrain churn model?", a model-version Select + a confirmation text field (type the model name to confirm). → actions: Cancel, Retrain (destructive — model goes offline for ~2h).

---

### Anomaly Detection (view-id: ai-anomaly) [EXISTING]

**Purpose**: Real-time anomaly feed with severity escalation paths and per-row Investigate / Mark FP / Create ticket actions.

**Layout** (top-to-bottom):
1. PageHeader — title "Anomaly Detection", AlertTriangle icon, `term` line "Last 24 hours · {n} detected · {m} confirmed", single action "Export CSV" (outline).
2. KPI row — 4 ExplainableMetricCards: Anomalies Detected (24h, warning), Anomalies Confirmed (positive), False Positive Rate (positive ≤ 10%, warning otherwise), Avg Detection Time (e.g. `4m`).
3. Charts row — `grid gap-4 lg:grid-cols-2`: Anomaly Trend AreaSeries (24h) + Anomaly Type Distribution DonutSeries.
4. Recent Anomalies card — bordered card with header (LabelWithHelp) + severity counts row (critical / high / medium / low) + DataTable.

**Tables**:
- Recent Anomalies: Detected (relative), Type (color dot + label), {Trader} (semibold), Account (monospace), Severity (StatusBadge), Confidence (percentage + small progress bar) | Investigate (outline → navigates to relevant module), Mark False Positive (ghost → mutates row status), Create Ticket (ghost → navigates to support-tickets with prefilled subject), Acknowledge (ghost → toast)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" → `exportToCsv` of anomalies.
- Row "Investigate" → `navigate(investigateTarget)`.
- Row "Mark False Positive" → mutates row FP status, toast.
- Row "Create Ticket" → `navigate("support-tickets", { subject: anomaly.typeLabel })`.
- Row "Acknowledge" (redesign, missing today) → toast "Acknowledged"; bulk-acknowledge action also missing today.
- Row click (redesign, missing today) → opens Anomaly Detail Sheet.

**Dialogs / Modals / Sheets**:
- Anomaly Detail Sheet (redesign, missing today) → content: header with anomaly id + type + severity; KPI strip — Confidence / Detected / Account / Trader. Tabs: Detail / Timeline / Raw Signals. Detail tab = description + model inputs list. Timeline tab = ordered events leading to the anomaly. Raw Signals tab = a read-only JSON view of the model's input feature vector + output probabilities. → actions: Mark False Positive (outline), Create Ticket (outline), Close (ghost).

---

## Batch 33 — AI (1 existing + 4 new)

### Cost Tracking (view-id: ai-cost) [EXISTING]

**Purpose**: AI spend, daily trend, per-tenant breakdown (super-admin), per-model + per-use-case breakdown, budget alerts, 30d forecast.

**Layout** (top-to-bottom):
1. PageHeader — title "AI Cost Tracking", DollarSign icon, `term` line "30d spend {currency} · {%} of monthly budget", actions: "Export daily" (outline), and when super-admin: "Export tenants" (outline).
2. KPI row — 4 MetricCards: Total Spend (30d, tone by budget %), Daily Avg, Cost per Prediction (positive), Budget Used (tone by %).
3. Cost Trend (30d) — ChartCard with AreaSeries.
4. Cost by Model + Cost by Use Case row — `grid gap-4 lg:grid-cols-2`: BarSeries card + DonutSeries card.
5. Cost by Tenant (super-admin only) — bordered card with header (LabelWithHelp) + super-admin badge + DataTable.
6. Budget Alert Configuration card — Card with CardHeader (LabelWithHelp + "Budget Alert Configuration") + CardDescription. CardContent 3-col grid: Monthly budget (number input), Alert threshold (Slider 25–100% with a colored Badge), Email recipient (email input). CardFooter with projected-month-end text + Save Configuration primary button.
7. Cost Forecast — ChartCard with an AreaSeries of the next 30 days.
8. Methodology card — Card with CardHeader (LabelWithHelp "How cost is calculated") + CardContent 3-col grid of mini-cards (Cost inputs / Refresh cadence / Pricing tiers).

**Tables**:
- Cost by Tenant: Tenant (name + id), Requests (number), Tokens (number), Cost (currency), Cost/Request (currency), Trend (up-arrow + percentage, tone) | (no per-row actions today; redesign adds per-tenant drill-down Sheet)

**Forms**:
- Budget Alert Configuration form (above).

**Actions** (buttons + behavior):
- "Export daily" → `exportToCsv` of daily series.
- "Export tenants" (super-admin) → `exportToCsv` of per-tenant rows.
- "Save Configuration" → toast "Budget alert saved".
- Row click (redesign) → opens per-tenant Cost Drill-down Sheet.

**Dialogs / Modals / Sheets**:
- Per-Tenant Cost Drill-down Sheet (redesign, missing today) → content: header with tenant name; KPI strip — 30d cost / 30d requests / 30d tokens / cost per request; two AreaSeries cards (Daily cost + Daily requests); a per-model BarSeries card. → actions: Close (ghost).

---

### Per-Insight Detail (view-id: ai-insight-detail) [NEW]

**Purpose**: Per-insight Sheet that exposes model reasoning, input features, output probabilities and recommended actions — today the Insight grid card click navigates away without showing reasoning.

**Layout** (top-to-bottom): (this is a Sheet, not a full page — opened from AI Insights grid)
1. Sheet header — title {Insight Title}, Sparkles icon, severity StatusBadge, subline `{module} · generated {relative}`.
2. KPI strip — 3 pills: Confidence (percentage + small progress bar), Severity, Module.
3. Tabs — 4 TabsTriggers: Summary / Reasoning / Inputs / Actions.

**Tables**: (none)

**Forms**: (none — see Actions)

**Actions** (buttons + behavior):
- "Apply" (primary, footer) → toast "Applied recommendation"; closes Sheet.
- "Investigate" (outline, footer) → `navigate(investigateTargetFor(insight))`.
- "Create ticket" (ghost, footer) → `navigate("support-tickets", { subject: insight.title })`.
- "Snooze" (outline, footer) → opens Snooze AlertDialog.
- "Dismiss" (outline, footer) → toast "Insight dismissed"; closes Sheet.
- "Copy reasoning" (ghost, footer) → clipboard + toast.

**Dialogs / Modals / Sheets**:
- Snooze AlertDialog (trigger: Snooze) → content: title "Snooze this insight?", a duration Select (1h / 4h / 1 day / 1 week), a reason textarea. → actions: Cancel, Snooze (primary).

---

### Model Audit Log (view-id: ai-model-audit) [NEW]

**Purpose**: Who changed what AI configuration, when — every model swap, hyperparameter change, prompt edit.

**Layout** (top-to-bottom):
1. PageHeader — title "Model Audit Log", History icon, single action "Export CSV" (outline).
2. KPI row — 4 MetricCards: Config Changes (30d), Model Swaps, Hyperparameter Changes, Prompt Edits.
3. Filter bar — Actor Select (derived from tenant users with `ai.configure`), Change Type Select (Model swap / Hyperparameter / System prompt / Feature toggle / Budget), Date-range, Reset.
4. Audit DataTable — bordered card with header "Changes ({count})".

**Tables**:
- Audit entries: Timestamp (mono), Actor (semibold), Change Type (badge), Field (e.g. "model"), Old Value (monospace, strike-through), New Value (monospace, success tone), Reason (muted), IP Address (monospace) | View Detail (ghost → opens Sheet)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" → exports the audit entries.
- Actor / Change Type / Date-range filters → filter DataTable.
- "Reset" → clears filters.
- Row "View Detail" → opens Change Detail Sheet.

**Dialogs / Modals / Sheets**:
- Change Detail Sheet (trigger: View Detail) → content: header with timestamp + actor. Definition list — Change Type, Field, Old Value, New Value, Reason, IP Address, User Agent, Session ID. A read-only "Diff" card showing old→new with proper syntax highlighting when the field is the system prompt. → actions: Roll Back (outline, only when reversible), Close (ghost).

---

### AI Usage Quota / Rate-Limit (view-id: ai-quota) [NEW]

**Purpose**: Per-tenant AI usage quota + rate-limit configuration so a runaway tenant cannot bankrupt the platform.

**Layout** (top-to-bottom):
1. PageHeader — title "AI Usage Quota", Gauge icon, single action "Save Configuration" (PermissionGuard `ai.configure`).
2. KPI row — 4 MetricCards: Daily Requests, Daily Tokens, Burst Limit Hit (negative when > 0), Quota Resets In (relative).
3. Usage charts row — `grid gap-4 lg:grid-cols-2`: Daily Requests AreaSeries (14d) + Daily Tokens AreaSeries (14d).
4. Quota Configuration card — Card with CardHeader "Quota Configuration" + CardContent 3-col grid: Daily request cap (number), Daily token cap (number), Burst per minute (number), Monthly cap (number), Reset timezone (Select), Hard vs Soft limit Select (Hard = block / Soft = warn only).
5. Rate-Limit Configuration card — Card with CardHeader "Rate-Limit Configuration" + CardContent: Requests per second (number), Requests per minute (number), Concurrent requests (number), Retry-after seconds (number).
6. Current usage card — Card with CardHeader "Current Usage" + CardContent: a progress-bar grid showing daily-requests %, daily-tokens %, monthly-requests %, each with a tone.

**Tables**: (none)

**Forms**:
- Quota Configuration form (above).
- Rate-Limit Configuration form (above).

**Actions** (buttons + behavior):
- "Save Configuration" → toast "Quota saved".
- "Reset counters" (redesign, outline) → opens Reset AlertDialog.

**Dialogs / Modals / Sheets**:
- Reset AlertDialog (trigger: Reset counters) → content: title "Reset all counters for today?", consequence text. → actions: Cancel, Reset (destructive).

---

### Prompt Library (view-id: ai-prompt-library) [NEW]

**Purpose**: Saved prompts / templates that operators can reuse in the AI Assistant and Insight workflows.

**Layout** (top-to-bottom):
1. PageHeader — title "Prompt Library", BookOpen icon, primary action "New Prompt" (→ opens Sheet).
2. KPI row — 4 MetricCards: Total Prompts, Published, Drafts, Most Used (text).
3. Filter bar — Category Select (All / Risk / Payouts / KYC / Trading / Analytics / Operations), Tag multi-input chips, Status Select (All / Draft / Published / Archived), Reset.
4. Prompts DataTable — bordered card with header "Prompts ({count})".

**Tables**:
- Prompts: Title (semibold + id subline), Category (badge), Tags (chip list), Model Select hint (e.g. "GPT-4o mini"), Insertions (number, 30d), Last Edited (relative), Status (StatusBadge Draft / Published / Archived) | Edit (ghost → opens Sheet), Duplicate (ghost → opens Sheet pre-filled), Archive (ghost → opens AlertDialog), Test (outline → opens Test Sheet)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Prompt" → opens Prompt Editor Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Edit" → opens Prompt Editor Sheet in edit mode.
- Row "Duplicate" → opens Prompt Editor Sheet pre-filled.
- Row "Archive" → opens Archive AlertDialog.
- Row "Test" → opens Test Prompt Sheet.

**Dialogs / Modals / Sheets**:
- Prompt Editor Sheet (trigger: New / Edit / Duplicate) → content: Title (input), Category Select, Tags (chip multi-input), Model Select (default), System Prompt (Textarea, LabelWithHelp), User Prompt (Textarea with merge-field insert), Variables list (read-only, derived from `{{var}}` tokens in the prompt), Status Select (Draft / Published). → actions: Save (primary), Insert Merge Field (outline, opens Merge Field Picker Dialog), Cancel (ghost).
- Test Prompt Sheet (trigger: Test) → content: a Variables form (one input per `{{var}}`), a "Run" primary button, a Result Textarea that streams the LLM reply, a tokens-used readout. → actions: Run (primary), Close (ghost).
- Archive AlertDialog (trigger: Archive) → content: title "Archive prompt?", consequence text. → actions: Cancel, Archive (destructive).

---

## Batch 34 — AI (2 new) + Checkout (3 existing)

### Fine-tuning (view-id: ai-finetuning) [NEW]

**Purpose**: Train custom models on tenant data — list existing fine-tunes, kick off new runs, monitor status.

**Layout** (top-to-bottom):
1. PageHeader — title "Fine-tuning", Beaker icon, primary action "New Fine-tune" (→ opens Sheet, PermissionGuard `ai.configure`).
2. KPI row — 4 MetricCards: Active Jobs, Completed Jobs, Failed Jobs, Avg Cost / Job.
3. Filter bar — Base Model Select (All / GPT-4o / GPT-4o mini / Llama 3.1 70B / Mistral Large), Status Select (All / Queued / Running / Completed / Failed / Cancelled), Date-range, Reset.
4. Fine-tunes DataTable — bordered card with header "Fine-tunes ({count})".
5. Active job monitor (conditional) — bordered card showing the running job with a real-time progress bar, current step (e.g. "Step 480 / 1000 · Loss 0.32"), ETA, and a Cancel button.

**Tables**:
- Fine-tunes: Job ID (monospace), Base Model (badge), Status (StatusBadge), Epochs (number), Examples (number), Loss (number, muted when in progress), Cost (currency), Started (relative), Completed (relative or "—") | View Detail (ghost → opens Sheet), Cancel (ghost, only when Running/Queued → opens AlertDialog), Download Weights (outline, only when Completed)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Fine-tune" → opens New Fine-tune Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "View Detail" → opens Fine-tune Detail Sheet.
- Row "Cancel" → opens Cancel AlertDialog.
- Row "Download Weights" → triggers download (toast "Preparing weights").

**Dialogs / Modals / Sheets**:
- New Fine-tune Sheet (trigger: New Fine-tune) → content: Base Model Select, Training Dataset Select (from Training Data Export screen), Validation Split % (number), Epochs (number), Learning Rate (number, scientific notation), Batch Size (number), Hyperparameter preset Select (Conservative / Balanced / Aggressive), Compute budget Select (CPU / GPU-T4 / GPU-A100). → actions: Start Job (primary, toast + close), Cancel (ghost).
- Fine-tune Detail Sheet (trigger: View Detail) → content: header with job id + status; KPI strip — Base model / Epochs / Examples / Loss. Tabs: Metrics / Logs / Datasets. Metrics tab = AreaSeries of loss-over-steps. Logs tab = scrollable monospace log. Datasets tab = read-only dataset card with download buttons. → actions: Download Weights (outline), Cancel Job (outline, only when running), Close (ghost).
- Cancel AlertDialog (trigger: Cancel) → content: title "Cancel fine-tune job?", consequence text describing the partial-weights loss. → actions: Cancel, Confirm Cancel (destructive).

---

### Training Data Export (view-id: ai-training-export) [NEW]

**Purpose**: Curate + export training datasets for fine-tuning and compliance — each export is audit-stamped.

**Layout** (top-to-bottom):
1. PageHeader — title "Training Data Export", Database icon, primary action "New Export" (→ opens Sheet).
2. KPI row — 4 MetricCards: Total Exports, Total Rows Exported, Pending Exports, Last Export (relative).
3. Filter bar — Source Select (All / Chat / Insights / Anomalies / Predictive / Custom), Status Select (All / Pending / Building / Ready / Failed), Date-range, Reset.
4. Exports DataTable — bordered card with header "Exports ({count})".

**Tables**:
- Exports: Export ID (monospace), Source (badge), Filters summary (muted), Rows (number), Format (badge JSONL / CSV / Parquet), Status (StatusBadge), Requested By (semibold), Requested (relative), Ready (relative or "—") | Download (primary, only when Ready → triggers download), View Filters (ghost → opens Sheet), Cancel (ghost, only when Pending → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Export" → opens Export Builder Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Download" → triggers download + toast.
- Row "View Filters" → opens Export Detail Sheet (read-only).
- Row "Cancel" → opens Cancel AlertDialog.

**Dialogs / Modals / Sheets**:
- Export Builder Sheet (trigger: New Export) → content: Source Select (Chat / Insights / Anomalies / Predictive / Custom), Date-range Select, Filters form (per source — e.g. for Chat: min length, exclude flagged, only specific traders), Format Select (JSONL / CSV / Parquet), Anonymize Switch (PII redaction), Compliance note (read-only). → actions: Build Export (primary, toast + close), Cancel (ghost).
- Export Detail Sheet (trigger: View Filters) → content: read-only view of the export's filters + metadata. → actions: Close (ghost).
- Cancel AlertDialog (trigger: Cancel) → content: title "Cancel this export?", consequence text. → actions: Cancel, Confirm Cancel (destructive).

---

### Checkout Overview (view-id: checkout) [EXISTING]

**Purpose**: Mode selector (Built-in vs External) + mode-aware KPIs + surface cards + recent transactions. Single source of truth for the firm's checkout posture.

**Layout** (top-to-bottom):
1. PageHeader — title "Checkout", CreditCard icon, single StatusBadge action showing the active mode.
2. Mode selector — `grid gap-4 md:grid-cols-2` with two ModeCards. Built-in (Building2 icon, "Platform-hosted payment page", 3 bullets: PSPs connected / PCI scope stays with platform / Native refund + dispute tracking). External (Globe icon, "Bring your own funnel", 3 bullets: API key + webhook secret / signed events / return URLs).
3. Mode-aware KPI row — `grid-cols-2 lg:grid-cols-4`. When Built-in: Active PSPs (positive), Volume 30d, Transactions 30d, Success Rate (tone by 95%/90%). When External: Webhooks 24h (positive), Verified % (positive ≥ 98%), Last Webhook (relative), Subscribed Events (number).
4. Surface cards — `grid gap-4 md:grid-cols-3`: Payment Providers, Payment Methods, External Integration. Each card has a live/paused badge, a description that adapts to mode, and an "Manage / Curate / Open" outline button → navigates to the relevant sub-page.
5. Recent Transactions card — bordered card with header (ListChecks icon + "Recent Transactions" + a StatusBadge "via built-in PSPs" / "via external webhooks"), a "View all" ghost button → navigates to checkout-transactions, and a `divide-y` list of the 5 most recent transactions (provider glyph + trader name + reference + method + relative time, right-aligned amount + StatusBadge).
6. Footer note — muted paragraph showing "Mode last changed {relative} by {actor}. Switching modes never deletes PSP credentials."

**Tables**: (none — recent transactions is a list, not a DataTable)

**Forms**: (none)

**Actions** (buttons + behavior):
- ModeCard click → `switchMode(next)` toast (redesign should wrap in a confirm AlertDialog — see missing friction flag in the audit).
- "Manage PSPs" / "Curate Methods" / "Open Integration" → navigate to the relevant sub-page.
- "View all" → navigate to checkout-transactions.

**Dialogs / Modals / Sheets**:
- Switch Mode AlertDialog (redesign, missing today — audit flags the one-click switch as no-friction) → content: title "Switch to {mode}?", a "What changes" preview list (which surfaces go live / pause), a "I understand" checkbox. → actions: Cancel, Switch (destructive — only when switching away from a mode with active volume).

---

### Payment Providers (view-id: checkout-providers) [EXISTING]

**Purpose**: Connect, configure, test, deactivate PSPs. Full Sheet with credential editing; Deactivate wrapped in AlertDialog.

**Layout** (top-to-bottom):
1. PageHeader — title "Payment Providers", Plug icon, primary action "Add Provider" (→ opens Sheet in add mode).
2. External-mode banner (conditional) — bordered card with PauseCircle icon when the tenant is in external mode, explaining that PSPs are paused but credentials stay saved.
3. KPI row — 4 MetricCards: Active PSPs (positive), Volume 30d, Weighted Success (tone by 95%), Refunds 30d.
4. Primary provider card (conditional) — bordered card with a left accent strip showing the primary PSP: glyph + name + StatusBadge + Primary Badge + Sandbox Badge; description; meta row (Last sync / transactions 30d / inbound webhook URL mono); action buttons (Edit, Test Connection, Deactivate AlertDialog).
5. Provider DataTable — full-width, no border card (DataTable alone).

**Tables**:
- Providers: Provider (glyph + name + Primary badge + kind subline), Status (StatusBadge + Sandbox StatusBadge when sandbox), Secret Key (KeyRound icon + masked mono + Eye/EyeOff toggle button), Inbound Webhook (Webhook icon + truncated mono URL), Methods (badge list), Volume 30d (currency), Success 30d (percentage + TrendingUp/Down icon), Actions: Edit (ghost → opens Sheet), Make Primary (ghost, disabled when already primary)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Add Provider" → opens Provider Sheet in add mode.
- Primary card "Edit" → opens Provider Sheet in edit mode.
- Primary card "Test Connection" → toast "Connection OK" / "Connection failed".
- Primary card "Deactivate" → opens Deactivate AlertDialog.
- Row "Edit" → opens Provider Sheet in edit mode.
- Row "Make Primary" → promotes the row, toast "{name} promoted to primary".
- Row eye toggle → reveals/hides the secret key.

**Dialogs / Modals / Sheets**:
- Provider Sheet (trigger: Add Provider / Edit) → content: SheetTitle "{isAdd ? 'Connect a payment provider' : 'Configure {name}'}". Form: Provider name (input), Kind Select (Card / Wallet / Crypto / Bank / BNPL), Status Select (Active / Fallback / Inactive / Error), Separator, Publishable/Client key (SecretField), Secret key (SecretField), Webhook signing secret (SecretField), Inbound webhook URL (read-only + copy button), Separator, Sandbox mode Switch (bordered box), Routes payment methods (chip multi-select from PAYMENT_METHODS), Supported currencies (input, comma-separated). → actions: Save Changes / Connect Provider (primary), Test Connection (outline), Cancel (ghost).
- Deactivate AlertDialog (trigger: primary card Deactivate) → content: title "Deactivate {name}?", description that new charges route to fallback PSPs and credentials are kept. → actions: Cancel, Deactivate (destructive).

---

### Payment Methods (view-id: checkout-methods) [EXISTING]

**Purpose**: Curate the payment methods traders see at the checkout step — switch + reorder + Edit Sheet.

**Layout** (top-to-bottom):
1. PageHeader — title "Payment Methods", Wallet icon, no actions.
2. External-mode banner (conditional) — same warning-toned banner as on Providers page when tenant is in external mode.
3. KPI row — 4 MetricCards: Enabled Methods (positive), In Preview, Tx via Methods 30d, Volume-weighted Fee %.
4. Methods DataTable — full-width.

**Tables**:
- Methods: Method (glyph + label + brand subline), Category (badge), Status (StatusBadge + warning-toned "No active PSP" indicator when enabled but unrouted), Routed via (badge list of provider names, or "Unassigned"), Trader Fee (percentage + flat currency), Limits (min – max), Tx 30d (number), Order (ArrowUp / ArrowDown ghost buttons), Actions: Edit (ghost → opens Sheet), Enabled Switch (toggle)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- Row "Move up" / "Move down" → re-sorts the methods list (toast).
- Row "Edit" → opens Method Sheet.
- Row Switch → toggles enabled; if enabling an unrouted method, blocks with a destructive toast "No active provider routes this method" and does not toggle.
- "+ New Method" (redesign, missing today) → opens Method Sheet in add mode.
- "Preview checkout" (redesign, missing today) → opens Preview Dialog.

**Dialogs / Modals / Sheets**:
- Method Sheet (trigger: Edit / + New Method) → content: SheetTitle "Configure {label}". Form: Display label (input), Brand mark (input), Status Select (Enabled / Preview / Disabled), Category Select, Min amount (currency), Max amount (currency), Trader fee percent (number), Trader fee flat (currency), Provider routing (multi-select chip from active PSPs), Supported currencies (input), Country availability (multi-select), Geo map preview (a small grid of country dots). → actions: Save (primary), Cancel (ghost).
- Preview Dialog (redesign, missing today) → content: a phone-frame mock of the trader-facing checkout step with the enabled methods shown in the configured order. → actions: Close (ghost).

---

## Batch 35 — Checkout (5 existing)

### External Integration (view-id: checkout-external) [EXISTING]

**Purpose**: Configure external checkout URL, API key, signing secret, return URLs, event subscriptions, IP allowlist. Save / Regenerate Secret / Send Test Event are real mutations.

**Layout** (top-to-bottom):
1. PageHeader — title "External Checkout Integration", ExternalLink icon, primary action "Save Configuration".
2. Built-in-active banner (conditional) — bordered card with Info icon when the tenant is in built-in mode, explaining that pre-configuration is allowed.
3. Three-column row — `grid gap-4 lg:grid-cols-3`. Left 2/3 = config form; right 1/3 = onboarding checklist.
4. Outbound section (left, top) — bordered card "Outbound — where traders pay": Checkout URL (input, monospace), 3-col grid of Success / Cancel / Pending return URLs, Separator, API key SecretRow (input + Show/Hide + Copy).
5. Inbound section (left, bottom) — bordered card "Inbound — what your system tells the platform": Platform webhook URL (read-only + Copy), HMAC signing secret SecretRow (with Regenerate button), IP allowlist Textarea, 2-col grid of Verification timeout Select (3s / 8s / 15s / 30s) + Auto-retry Switch (bordered box).
6. Subscribed events section — bordered card "Subscribed events": a 2-col grid of event toggle cards (checkout.session.completed / checkout.session.expired / checkout.refund.issued / checkout.dispute.opened), each with an aria-pressed button + description.
7. Onboarding checklist (right) — bordered card with a 4-item checklist (URL configured / Webhook secret exchanged / completion event subscribed / Test event verified) and a progress bar; below the checklist, a "Send test event" primary button (disabled when URL + secret not set).

**Tables**: (none)

**Forms**:
- External Integration form (above — across 4 sections).

**Actions** (buttons + behavior):
- "Save Configuration" (primary, PageHeader) → persists, toast "External integration saved".
- "Regenerate" (signing secret) → generates a new secret, toast warning.
- "Send test event" → sets `sendingTest` true, toast "Test event dispatched"; after 1.1s, toast "Test event verified" and the checklist updates.
- Copy buttons → clipboard + toast.
- Show/Hide buttons → toggle visibility.
- "Disable external mode" (redesign, missing today) → opens Disable AlertDialog.

**Dialogs / Modals / Sheets**:
- Disable External Mode AlertDialog (redesign, missing today) → content: title "Disable external integration?", warning that the platform will no longer accept signed events; a "I understand" checkbox. → actions: Cancel, Disable (destructive).
- Download Postman / Copy cURL helper (redesign, missing today) → a small dropdown with two actions: "Download Postman collection" (downloads a JSON file) and "Copy cURL" (clipboard + toast).

---

### Transactions (view-id: checkout-transactions) [EXISTING]

**Purpose**: Unified tenant ledger of challenge purchases, top-ups, add-ons — with status filter + CSV export.

**Layout** (top-to-bottom):
1. PageHeader — title "Checkout Transactions", ListChecks icon, primary action "Export CSV".
2. KPI row — 4 MetricCards: Collected (positive), Successful Tx, Success Rate (tone by 90% / 75%), Refunds + Disputes (warning when > 0).
3. DataTable — full-width, with a status filter Select in the toolbar.

**Tables**:
- Transactions: Reference (mono + relative subline), Trader (semibold + email subline), Amount (currency, semibold), Method (label + provider subline), Purpose (intent + intentRef subline), Source (StatusBadge "Built-in PSP" / "External webhook"), Status (StatusBadge) | (row click is **missing today**; redesign opens Transaction Detail Sheet — see Batch 36)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" → `exportToCsv` of filtered transactions.
- Status filter Select → filters DataTable.
- Row click (redesign) → opens Transaction Detail Sheet.
- "Refund" / "Issue partial refund" (redesign, missing today) → opens Refund Sheet.

**Dialogs / Modals / Sheets**:
- Transaction Detail Sheet (redesign, missing today — Batch 36) → content: header with reference + status. KPI strip — Amount / Method / Provider / Intent. Tabs: Detail / Timeline / Refunds. Detail tab = definition list. Timeline tab = ordered events (Created / Authorized / Captured / Refunded). Refunds tab = list of refunds + a "Issue Refund" outline button. → actions: Issue Refund (outline → opens Refund Sheet), Open in PSP Dashboard (outline, opens external URL), Close (ghost).
- Refund Sheet (redesign, missing today — Batch 36) → content: amount input (default = full), reason Select, note textarea. → actions: Issue Refund (primary), Cancel (ghost).

---

### Platform Overview (view-id: checkout-platform-overview) [EXISTING]

**Purpose**: Super-admin cross-tenant view: adoption, GMV, platform fees, mode mix, top tenants, alerts.

**Layout** (top-to-bottom):
1. PageHeader — title "Checkout Management", LayoutGrid icon, primary action "Tenant Checkout" (→ navigates to tenant matrix).
2. Primary KPI row — 4 MetricCards: Firms on Checkout (positive), GMV 30d (positive), Transactions 30d, Success Rate (tone by 95% / 90%).
3. Secondary strip — 4 MetricCards: Platform Fees 30d, Active PSP Integrations, Built-in Firms, External Firms.
4. Mode mix + top tenants row — `grid gap-4 lg:grid-cols-2`: Mode Mix card (per-mode progress bars with counts) + Top Firms by Volume card (per-firm avatar + name + amount + small progress bar + meta line "n tx · x% success · mode").
5. Health Alerts card — bordered card with header (AlertTriangle icon + "Health Alerts" + "All clear" StatusBadge when empty), and an alert list. Each alert row has title + message + severity StatusBadge + "Manage firm" outline button (→ navigates to tenant matrix filtered by tenantId).
6. Recent Activity — All Firms card — bordered card with header (ListChecks icon + "Recent Activity — All Firms" + "View all" ghost button → navigates to platform-transactions), and a `divide-y` list of 5 recent cross-tenant transactions.

**Tables**: (none — lists only)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Tenant Checkout" (primary, PageHeader) → `navigate("checkout-platform-tenants")`.
- "All firms" (ghost, Top Firms card) → `navigate("checkout-platform-tenants")`.
- "Manage firm" (alert row) → `navigate("checkout-platform-tenants", { tenant: a.tenantId })`.
- "View all" (Recent Activity card) → `navigate("checkout-platform-transactions")`.
- Date-range Select (redesign, missing today) → recomputes KPIs + lists.
- Export (redesign, missing today) → exports the visible data.

**Dialogs / Modals / Sheets**: (none)

---

### Tenant Checkout Matrix (view-id: checkout-platform-tenants) [EXISTING]

**Purpose**: Per-firm checkout state with Manage Sheet + Disable AlertDialog. Deep-linkable by tenant.

**Layout** (top-to-bottom):
1. PageHeader — title "Tenant Checkout", Building2 icon, no actions.
2. KPI row — 4 MetricCards: Firms Enabled (positive), Built-in / External split, Volume 30d (positive), Platform Fees 30d.
3. DataTable — full-width.
4. Footer note — muted paragraph explaining that changes apply immediately, audit-stamped, and PSP secrets are not exposed.

**Tables**:
- Tenant Checkout: Prop Firm (avatar + name + plan/currency subline), Module (Enabled / Disabled StatusBadge), Mode (Built-in / External / — StatusBadge), Primary PSP (text), PSPs (number), Volume 30d (currency), Tx 30d (number), Success (percentage, tone by 95% / 90%), Platform Fee (percentage), Last Change (relative + actor subline) | Manage (outline → opens Sheet)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- Row "Manage" → opens Manage Sheet.
- "+ Add new tenant to checkout" (redesign, missing today) → opens Add Tenant Sheet.
- Bulk enable/disable (redesign, missing today) → row-multi-select + bulk action bar.

**Dialogs / Modals / Sheets**:
- Manage Sheet (trigger: Manage) → content: SheetHeader with tenant avatar + name. Body sections: (1) Module enable Switch (bordered box with label + helper), (2) Checkout mode Select (Built-in / External, disabled when module off, with a per-mode summary), (3) Platform fee on built-in volume Input + Apply button + 30d fee-revenue text, (4) Firm snapshot card (Volume / Transactions / Success 3-pill), (5) PSP-credentials-owned-by-firm note. → actions: Done (outline).
- Disable AlertDialog (trigger: module Switch toggled off) → content: title "Disable checkout for {name}?", description with 30d volume + consequence text. → actions: Cancel, Disable checkout (destructive).
- Add Tenant Sheet (redesign, missing today) → content: Tenant Select (searchable), Mode Select (Built-in / External), Platform fee %, Initial PSP templates multi-select. → actions: Add (primary), Cancel (ghost).

---

### PSP Catalog (view-id: checkout-platform-psp-catalog) [EXISTING]

**Purpose**: Curate platform-wide PSP templates; firms bring their own credentials.

**Layout** (top-to-bottom):
1. PageHeader — title "PSP Catalog", Plug icon, no actions.
2. KPI row — 4 MetricCards: Templates, Available (positive), Beta (warning when > 0), Active Integrations.
3. Templates grid — `grid gap-4 md:grid-cols-2 xl:grid-cols-3` of template cards. Each card: provider glyph + name + kind subline + lifecycle StatusBadge; description; definition list (Regions badges / Native webhook StatusBadge / Supported methods badges / Currencies monospace); footer row with lifecycle Select + Doc ghost button; muted footer "Used by {n} firms · certified {month year}".

**Tables**: (none — grid of cards)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- Lifecycle Select → `setStatus(p.id, status)` toast "{name} marked {status}".
- "Doc" button → today a toast stub; redesign should `window.open(p.onboardDocUrl)`.
- "+ Add new PSP template" (redesign, missing today) → opens Template Editor Sheet.
- "Delete / Retire" (redesign, missing today) → opens Retire AlertDialog.
- "Certification upload" (redesign, missing today) → opens Upload Sheet.

**Dialogs / Modals / Sheets**:
- Template Editor Sheet (redesign, missing today) → content: Name (input), Kind Select, Description (textarea), Regions multi-select, Supported methods multi-select, Currencies (input), Native webhook Switch, Onboard doc URL (url input), Certification file (file upload). → actions: Save (primary), Cancel (ghost).
- Retire AlertDialog (redesign, missing today) → content: title "Retire {name}?", warning that firms using this template must migrate. → actions: Cancel, Retire (destructive).
- Upload Sheet (redesign, missing today) → content: certification file drop-zone, certification type Select (SOC2 / PCI-DSS / ISO 27001 / Other), expiry date. → actions: Upload (primary), Cancel (ghost).

---

## Batch 36 — Checkout (2 existing + 3 new)

### Platform External Defaults (view-id: checkout-platform-external) [EXISTING]

**Purpose**: Platform-wide external checkout contract — webhook URL, signing, retry, egress IPs, event catalog. Read-only today; redesign adds an editor.

**Layout** (top-to-bottom):
1. PageHeader — title "External Checkout Defaults", ServerCog icon, no actions today (redesign adds "Edit Contract").
2. KPI row — 4 MetricCards: Webhooks 24h (positive), Verified Ratio 24h (positive ≥ 98%, warning otherwise), Last Ingest Incident (date), Default Mode for new firms.
3. Contract row — `grid gap-4 lg:grid-cols-2`: Inbound webhook contract card (webhook base URL + Copy button + signing/timeout/retry/new-firm-default definition list) + Platform egress IPs card (Copy-all + per-IP list with per-row copy buttons).
4. Event catalog — full-width DataTable.

**Tables**:
- Event catalog: Event (monospace), Meaning (muted), Requirement (StatusBadge Mandatory / Optional) | (no per-row actions today; redesign adds CRUD)

**Forms**: (none today; redesign adds Contract Editor Sheet in Batch 36)

**Actions** (buttons + behavior):
- Copy buttons → clipboard + toast.
- "Edit contract" (redesign, missing today) → opens Contract Editor Sheet.
- "Rotate egress IPs" (redesign, missing today) → opens Rotate IPs AlertDialog.
- Event catalog "Add event" / "Edit event" / "Delete event" (redesign, missing today) → opens Event Editor Sheet.

**Dialogs / Modals / Sheets**:
- Contract Editor Sheet (redesign, missing today — Batch 36 — covered by the Platform External Contract Editor screen) → content: Default webhook base URL (input), Signing algorithm Select (HMAC-SHA256 / HMAC-SHA512), Default verification timeout Select, Default retry policy (max attempts + backoff + base delay), Default mode for new firms Select. → actions: Save (primary), Cancel (ghost).
- Rotate IPs AlertDialog (redesign, missing today) → content: title "Rotate platform egress IPs?", warning that firms using external mode must update their allowlists; a "Notify all firm admins" checkbox (default on). → actions: Cancel, Rotate (destructive).
- Event Editor Sheet (redesign, missing today) → content: Event ID (input, monospace), Description (textarea), Required Switch. → actions: Save (primary), Cancel (ghost).

---

### Platform Transactions (view-id: checkout-platform-transactions) [EXISTING]

**Purpose**: Cross-tenant transaction ledger for reconciliation.

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Transactions", Receipt icon, primary action "Export CSV".
2. KPI row — 4 MetricCards: Collected all firms (positive), Success Rate (tone), Refunds + Disputes (warning when > 0), Built-in / External split.
3. DataTable — full-width, toolbar has status + firm + source filters.

**Tables**:
- Platform Transactions: Reference (mono + relative subline), Prop Firm (avatar + name + slug subline), Trader (semibold + email subline), Amount (currency, semibold), Method (label + provider subline), Purpose (intent + intentRef subline), Source (StatusBadge Built-in / External), Status (StatusBadge) | (row click missing today; redesign opens Transaction Detail Sheet)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" → `exportToCsv` of filtered rows.
- Status / Firm / Source filters → filter DataTable.
- Row click (redesign) → opens Transaction Detail Sheet.
- "Dispute" / "Refund" (redesign, missing today) → opens the Refund / Dispute Workflow screen.

**Dialogs / Modals / Sheets**:
- Transaction Detail Sheet (redesign, missing today — Batch 36) → identical to the tenant-scoped Sheet, but with the Prop Firm field prominent.

---

### Transaction Detail Sheet (view-id: checkout-transaction-detail) [NEW]

**Purpose**: Single-transaction workspace that surfaces the full lifecycle, PSP-side payload, refunds/disputes and reconciliation status — replaces today's missing row-click drill.

**Layout** (top-to-bottom): (this is a Sheet — opened from Transactions + Platform Transactions)
1. Sheet header — title {reference}, Receipt icon, StatusBadge for status, subline `{trader} · {firm} · {amount} · {relative}`.
2. KPI strip — 4 pills: Amount, Method, Provider, Intent.
3. Tabs — 4 TabsTriggers: Detail / Timeline / Refunds / Raw Payload.
4. Detail tab — definition list (Reference, Trader, Email, Account, Amount, Currency, Method, Provider, Intent, Intent Reference, Source, Status, Created, Authorized, Captured, Settled).
5. Timeline tab — vertical ordered list (Created / Authorized / Captured / Refunded / Disputed / Settled) with timestamp + actor + small icon.
6. Refunds tab — DataTable of refunds (Reference / Amount / Reason / Status / Created) + "Issue Refund" outline button (only when status = succeeded).
7. Raw Payload tab — read-only monospace JSON of the PSP-side webhook payload + signature header.

**Tables**:
- Refunds: Reference (mono), Amount (currency), Reason (badge), Status (StatusBadge), Created (relative) | (no per-row actions)

**Forms**: (none on the page; see Sheet)

**Actions** (buttons + behavior):
- "Issue Refund" (outline, Refunds tab) → opens Refund Sheet.
- "Open in PSP Dashboard" (outline, footer) → opens external URL in new tab.
- "Copy reference" (ghost, footer) → clipboard + toast.
- "Close" (ghost, footer) → closes Sheet.

**Dialogs / Modals / Sheets**:
- Refund Sheet (trigger: Issue Refund) → content: Amount (currency input, default = full, max = original amount), Reason Select (Dissatisfied / Duplicate / Fraud / At-customer-request / Other), Note (textarea), "Notify trader" checkbox (default on). → actions: Issue Refund (primary, destructive styling), Cancel (ghost).

---

### Webhook Log Viewer (view-id: checkout-webhook-log) [NEW]

**Purpose**: Recent inbound webhook log with payload + signature status — debug webhook delivery issues.

**Layout** (top-to-bottom):
1. PageHeader — title "Webhook Log", Webhook icon, primary action "Export CSV".
2. KPI row — 4 MetricCards: Webhooks 24h, Verified % (positive ≥ 98%), Failed Verifications (negative when > 0), Avg Delivery Latency (ms).
3. Filter bar — Event Select (All / checkout.session.completed / expired / refund.issued / dispute.opened), Verification Status Select (All / Verified / Failed signature / Failed IP / Failed timeout), Firm Select (super-admin only), Date-range, Reset.
4. Webhooks DataTable — bordered card with header "Webhooks ({count})".

**Tables**:
- Webhooks: Received (relative), Event (monospace), Firm (super-admin) or Source IP (tenant), Status (StatusBadge Verified / Failed), Signature (mono, truncated), Latency (ms), Delivery Attempts (number) | View Payload (ghost → opens Sheet), Retry (ghost → toast), Block IP (ghost → opens AlertDialog)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" → exports webhooks.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "View Payload" → opens Payload Sheet.
- Row "Retry" → toast "Retried".
- Row "Block IP" → opens Block IP AlertDialog.

**Dialogs / Modals / Sheets**:
- Payload Sheet (trigger: View Payload) → content: header with event + received-relative + StatusBadge. Tabs: Payload / Headers / Signature. Payload tab = read-only monospace JSON of the body. Headers tab = key-value list of headers. Signature tab = expected vs actual signature, algorithm, secret-id used. → actions: Copy Payload (outline), Replay (outline → toast), Close (ghost).
- Block IP AlertDialog (trigger: Block IP) → content: title "Block IP {address}?", warning that future events from this IP will be rejected. → actions: Cancel, Block (destructive).

---

### Refund / Dispute Workflow (view-id: checkout-refund-dispute) [NEW]

**Purpose**: Central screen for managing refund requests and chargeback disputes across the tenant.

**Layout** (top-to-bottom):
1. PageHeader — title "Refunds & Disputes", Undo2 icon, primary action "New Refund" (→ opens Sheet).
2. KPI row — 4 MetricCards: Open Refunds (warning), Open Disputes (negative), Refunded 30d (currency), Dispute Loss 30d (currency, negative tone).
3. Filter bar — Type Select (All / Refund / Dispute), Status Select (All / Open / Processing / Approved / Denied / Expired), PSP Select, Date-range, Reset.
4. Cases DataTable — bordered card with header "Cases ({count})".

**Tables**:
- Cases: Reference (monospace), Type (StatusBadge Refund / Dispute), Trader (semibold), Amount (currency), Reason (badge), PSP (text), Status (StatusBadge), Opened (relative), Updated (relative) | Open (primary → opens Case Sheet), Evidence (ghost → opens Sheet), Close (ghost → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "New Refund" → opens New Refund Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Open" → opens Case Sheet.
- Row "Evidence" → opens Evidence Sheet.
- Row "Close" → opens Close AlertDialog.

**Dialogs / Modals / Sheets**:
- New Refund Sheet (trigger: New Refund) → content: Transaction Select (searchable by reference), Amount (currency input, default = full), Reason Select, Note (textarea), "Notify trader" checkbox. → actions: Submit (primary), Cancel (ghost).
- Case Sheet (trigger: Open) → content: header with reference + type StatusBadge + status. KPI strip — Amount / Trader / PSP / Opened. Tabs: Timeline / Evidence / Communication. Timeline tab = ordered events (Opened / Submitted to PSP / PSP Decision / Refunded / Closed). Evidence tab = list of evidence files + "Upload Evidence" outline button. Communication tab = list of trader emails + "Send Update" outline button. → actions: Submit Evidence (outline → opens Evidence Sheet), Accept (primary when status = Open), Contest (outline when status = Open, opens Contest Sheet), Close (ghost).
- Evidence Sheet (trigger: Evidence / Upload Evidence / Submit Evidence) → content: file drop-zone, evidence type Select (Delivery proof / Customer communication / Transaction receipt / Refund policy / Other), description (textarea). → actions: Upload (primary), Cancel (ghost).
- Contest Sheet (trigger: Contest) → content: contest reason Select (Transaction not recognized / Duplicate / Product not received / Fraud / Other), narrative (textarea), evidence multi-select (from already-uploaded). → actions: Submit Contest (primary), Cancel (ghost).
- Close AlertDialog (trigger: Close) → content: title "Close this case?", closure reason Select. → actions: Cancel, Close Case (primary).

---

## Batch 37 — Checkout (3 new) + Audit (2 existing)

### Settlement / Reconciliation Report (view-id: checkout-settlement) [NEW]

**Purpose**: Per-PSP, per-period settlement report that reconciles platform-side transactions with PSP-side settlement files.

**Layout** (top-to-bottom):
1. PageHeader — title "Settlement & Reconciliation", FileText icon, primary action "Generate Report" (→ opens Sheet).
2. KPI row — 4 MetricCards: Settled 30d (currency, positive), Outstanding (currency, warning), Reconciliation Errors (negative when > 0), Avg Settlement Lag (days).
3. Filter bar — PSP Select, Period Select (Daily / weekly / monthly), Date-range, Reset.
4. Reconciliation summary card — bordered card with header (LabelWithHelp) and a 3-col grid: Platform-side total / PSP-side total / Variance (with tone).
5. Reconciliation DataTable — bordered card with header "Settlements ({count})".

**Tables**:
- Settlements: PSP (logo + name), Period (e.g. "2026-04-15 → 2026-04-30"), Platform Total (currency), PSP Total (currency), Variance (currency, tone), Status (StatusBadge Matched / Variance / Pending), Settled (relative), Settlement File (mono, truncated) | View Report (ghost → opens Sheet), Download (outline → triggers download), Reconcile (outline → opens Sheet)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "Generate Report" → opens Generate Report Sheet.
- Filters → filter DataTable + summary card.
- "Reset" → clears filters.
- Row "View Report" → opens Settlement Report Sheet.
- Row "Download" → downloads the settlement file.
- Row "Reconcile" → opens Reconcile Sheet.

**Dialogs / Modals / Sheets**:
- Generate Report Sheet (trigger: Generate Report) → content: PSP Select, Period Select (daily / weekly / monthly), Start date (date input), End date (date input), Format Select (CSV / PDF / XLSX). → actions: Generate (primary), Cancel (ghost).
- Settlement Report Sheet (trigger: View Report) → content: header with PSP + period. KPI strip — Platform total / PSP total / Variance / Settlement file. A 2-tab layout: Summary (definition list) + Transactions (DataTable of reconciled transactions for this period). → actions: Download (outline), Close (ghost).
- Reconcile Sheet (trigger: Reconcile) → content: variance amount (read-only), explanation Select (FX difference / Refund timing / Dispute reversal / PSP fee not tracked / Other), note (textarea), "Adjust platform ledger" checkbox. → actions: Save Reconciliation (primary), Cancel (ghost).

---

### PSP Onboarding Wizard (view-id: checkout-psp-onboarding) [NEW]

**Purpose**: Step-by-step in-app onboarding wizard for adding a new PSP — replaces today's ad-hoc Provider Sheet add flow with a guided 4-step experience.

**Layout** (top-to-bottom): (this is a full page — a multi-step wizard)
1. PageHeader — title "PSP Onboarding", Plug icon, actions: "Cancel" (ghost → navigates back to checkout-providers).
2. Step indicator — a 4-step horizontal stepper (Choose PSP → Credentials → Methods → Test & Activate), highlighting the current step.
3. Step 1 — Choose PSP: a `grid md:grid-cols-2 xl:grid-cols-3` of PSP template cards (only Available + Beta templates from PSP Catalog). Each card has a logo, name, description, kind badge, "Select" outline button.
4. Step 2 — Credentials: the Provider Sheet form (Provider name, Kind Select, Publishable key, Secret key, Webhook signing secret, Inbound webhook URL read-only + copy, Sandbox mode Switch, Supported currencies input).
5. Step 3 — Methods: the methods chip multi-select (from PAYMENT_METHODS), with a live preview of which methods the new PSP will route.
6. Step 4 — Test & Activate: a "Test Connection" primary button that, on success, shows a checklist (Credentials valid / Webhook reachable / Methods assigned / Sandbox mode); a "Activate PSP" primary button at the bottom that promotes the PSP to Active status.

**Tables**: (none)

**Forms**:
- Credentials form (step 2 — same as Provider Sheet).

**Actions** (buttons + behavior):
- Step 1 "Select" → advances to step 2 with the chosen template.
- Step 2 → Step 3 "Next" (primary) — disabled until required credentials are filled.
- Step 3 → Step 4 "Next" (primary).
- Step 4 "Test Connection" → toast "Connection OK" / "Connection failed".
- Step 4 "Activate PSP" → toast "PSP activated", navigate to checkout-providers.
- "Back" (outline) → returns to previous step.
- "Cancel" (ghost, PageHeader) → navigates back without saving.

**Dialogs / Modals / Sheets**: (none — wizard is the page)

---

### Platform External Contract Editor (view-id: checkout-platform-external-editor) [NEW]

**Purpose**: The platform-wide external checkout contract is read-only today; this screen gives super-admins a first-class editor for the contract + incident history + event catalog CRUD.

**Layout** (top-to-bottom):
1. PageHeader — title "External Contract Editor", ServerCog icon, primary action "Save Contract" (PermissionGuard `checkout.platform.manage`).
2. KPI row — 4 MetricCards: Active Firms on External, Webhooks 24h, Verified %, Last Incident (relative).
3. Two-column layout — `grid lg:grid-cols-3`. Left 2/3 = contract form; right 1/3 = incident history.
4. Contract form (left) — Card with CardHeader "Contract" + CardContent. Form fields: Default webhook base URL (input), Signing algorithm Select (HMAC-SHA256 / HMAC-SHA512), Default verification timeout Select (3s / 8s / 15s / 30s), Default retry max attempts (number), Default retry backoff Select (linear / exponential / fixed), Default retry base delay ms (number), Default mode for new firms Select (Built-in / External), Platform egress IPs (Textarea, one per line).
5. Incident history (right) — bordered card with header "Incident History" and a vertical timeline of recent ingest incidents (timestamp + severity + affected firms + resolution).

**Tables**: (none — incident history is a timeline)

**Forms**:
- Contract form (above).

**Actions** (buttons + behavior):
- "Save Contract" (primary, PageHeader) → toast "Contract saved".
- "Rotate egress IPs" (outline) → opens Rotate IPs AlertDialog (same as Platform External Defaults page).
- "Add incident" (redesign, ghost, incident history) → opens Incident Sheet.

**Dialogs / Modals / Sheets**:
- Rotate IPs AlertDialog (trigger: Rotate egress IPs) → identical to the Rotate IPs AlertDialog on Platform External Defaults page.
- Incident Sheet (trigger: Add incident) → content: Severity Select (Minor / Major / Critical), Affected firms multi-select, Description (textarea), Status Select (Investigating / Identified / Resolved). → actions: Save (primary), Cancel (ghost).

---

### Audit Log (view-id: audit) [EXISTING]

**Purpose**: Cross-module audit trail of admin and user actions. KPI strip + AuditLogTable component with built-in filters + CSV export.

**Layout** (top-to-bottom):
1. PageHeader — title "Audit Log", ScrollText icon, single action "Export CSV" (outline).
2. KPI row — 4 MetricCards: Total Events, Critical (negative when > 0, positive when 0), Warnings (warning when > 0, positive when 0), Last 24h.
3. AuditLogTable — the shared audit component with its own filter UI (search, severity, module, actor, entity-type, date-range).

**Tables**:
- AuditLogTable: Timestamp (mono), Actor (semibold), Action (badge), Entity (badge), Entity ID (mono), Severity (StatusBadge), Module (badge), Summary (muted) | (row click is **missing today**; redesign opens Audit Entry Detail Sheet — Batch 38)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline, PageHeader) → `exportToCsv` of all entries.
- AuditLogTable internal filters → filter rows.
- Row click (redesign) → opens Audit Entry Detail Sheet.

**Dialogs / Modals / Sheets**: (none — Audit Entry Detail Sheet is added in Batch 38)

---

### User Events (view-id: audit-user-events) [EXISTING]

**Purpose**: Real-time stream of user/account activity, with type-toned badges and CSV export.

**Layout** (top-to-bottom):
1. PageHeader — title "User Events", ScrollText icon, single action "Export CSV" (outline).
2. KPI row — 5 MetricCards in `grid-cols-2 lg:grid-cols-5`: Total Events, Accounts Created (positive), KYC Completed (positive), Payouts Requested (warning), Breaches Detected (negative when > 0, positive when 0).
3. Filter bar — bordered `bg-muted/20 p-2`: Filter icon + active-count Badge; Search input (email / account / description), event-type `<select>` (All / 17 event types), date-range `<select>` (All / 24h / 7d / 30d), Clear ghost; right-aligned count "filtered of total events".
4. Events DataTable — bordered `bg-card` card.

**Tables**:
- User Events: Timestamp (mono, muted), User Email (semibold), Account ID (monospace), Event Type (StatusBadge with event-tone mapping), Description (muted) | (row click is **missing today**; redesign navigates to User Event Detail page)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline) → `exportToCsv` of filtered events.
- Search input → filters rows.
- Event-type / Date-range `<select>`s → filter rows.
- "Clear" → resets filters.
- Row click (redesign) → `navigate("audit-user-event-detail", { id: e.id })`.

**Dialogs / Modals / Sheets**: (none)

---

## Batch 38 — Audit (3 existing + 2 new)

### Enhanced Events (view-id: audit-user-events-enhanced) [EXISTING]

**Purpose**: Enhanced event stream with metric snapshots for forensic review of breach events; collapsible advanced-filter panel.

**Layout** (top-to-bottom):
1. PageHeader — title "User Events (Enhanced)", ScrollText icon, single action "Export CSV" (outline).
2. KPI row — 7 MetricCards in `grid-cols-2 md:grid-cols-4 lg:grid-cols-7`: Total Events, Account Created (positive), KYC Completed (positive), Breaches Detected (negative when > 0), Payout Events (warning), Target Profit Reached (positive), Drawdown Breached (negative when > 0).
3. Top toolbar — bordered `bg-muted/20 p-2`: Filter icon + active-count Badge; Search input (full-text); Advanced Collapsible button with chevron + active-count Badge; Clear ghost when filters active; right-aligned count.
4. Advanced Filter Panel — Collapsible bordered `bg-card p-4` with: a 2-col grid of event-type Checkboxes (16 types), date-range Select, user-text Input, account-text Input, source Select (System / Admin / User / API), Apply + Clear buttons + live result-count.
5. Events DataTable — full-width.

**Tables**:
- Enhanced Events: User (button → navigates to trader-detail), Account (button → navigates to trader-detail, with `[phaseType]` + challenge name + accountId subline), Event Type (StatusBadge with event-tone mapping), Event Description (muted), IP Address (monospace), Source (StatusBadge), Created (monospace relative) | (row click is **missing today**; redesign opens Event Detail Sheet)

**Forms**: (none — the Advanced Filter Panel is a form, but no Save/Submit; redesign adds the missing Apply behavior)

**Actions** (buttons + behavior):
- "Export CSV" (outline) → `exportToCsv` of filtered events.
- Search input → filters rows live.
- Advanced toggle → expands/collapses the Advanced Filter Panel.
- Apply Filters (redesign) → today a no-op toast; redesign should just apply the panel state.
- Clear → resets all panel filters.
- User / Account cell click → `navigate("trader-detail", { id: e.traderId })`.
- Row click (redesign) → opens Event Detail Sheet.

**Dialogs / Modals / Sheets**:
- Event Detail Sheet (redesign, missing today) → content: header with event-type StatusBadge + timestamp. KPI strip — Equity / Balance / Open PnL / Limit (only for breach events). Tabs: Detail / Metric Snapshot / Related. Detail tab = definition list (Event ID, User, Account, Type, Description, IP, Source, Timestamp). Metric Snapshot tab = read-only snapshot of the trader's metric values at the time of the event (equity, balance, open PnL, daily drawdown used, max drawdown used, profit target progress). Related tab = list of related events for the same account_id. → actions: Create Support Ticket (outline → navigates to support-tickets with prefilled subject), View Trader Profile (outline → navigates to trader-detail), Drill to Risk Module (outline → navigates to risk-statistics), Close (ghost).

---

### Change History (view-id: audit-change-history) [EXISTING]

**Purpose**: Audit trail of config changes with before/after diff + rollback. Row click opens the Change Detail Sheet.

**Layout** (top-to-bottom):
1. PageHeader — title "Change History", History icon, single action "Export CSV" (outline).
2. Filter bar — bordered `bg-muted/20 p-2`: Filter icon + active-count Badge; Search input (actor / field / entity); entity-type `<select>` (All + ENTITY_TYPES), actor `<select>` (All + each actor), date-range `<select>` (All / 24h / 7d / 30d); Clear ghost; right-aligned count.
3. Change history DataTable — bordered `bg-card`.

**Tables**:
- Change History: Timestamp (mono, muted), Actor (semibold), Entity Type (badge), Entity ID (monospace), Field Changed (semibold), Change (old value strike-through → arrow → new value success tone), Reason (muted) | (row click → opens Change Detail Sheet)

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export CSV" (outline) → `exportToCsv` of filtered changes.
- Search input + 3 `<select>`s → filter rows.
- "Clear" → resets filters.
- Row click → opens Change Detail Sheet.

**Dialogs / Modals / Sheets**:
- Change Detail Sheet (trigger: row click) → content: header with History icon + "Change Detail". 3-col grid (Timestamp / Actor / Entity Type / Entity ID / Field / Old Value / New Value / Reason). A read-only "Diff" card showing old→new. → actions: Roll Back (destructive → opens Rollback AlertDialog), View Related (outline → navigates to filtered Change History), Close (ghost).
- Rollback AlertDialog (trigger: Roll Back) → content: title "Roll back this change?", consequence text, reason textarea. → actions: Cancel, Confirm Rollback (destructive). (Today the rollback is a stub; redesign persists the change + audit-stamps the rollback.)

---

### User Event Detail (view-id: audit-user-event-detail) [EXISTING]

**Purpose**: Single-event detail page reached from User Events list (today this page exists but is never linked from the list — redesign wires the link).

**Layout** (top-to-bottom):
1. Breadcrumb — User Events › {event id}.
2. Detail card — bordered `bg-card p-4` with header row (ScrollText icon + Event Type label + description + StatusBadge + event-id Badge), actions: "Export" (outline → JSON download), "Close" (ghost → navigates back to User Events).
3. Separator.
4. Labeled fields grid — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of field cards (Event ID / User Email / Account ID / Event Type / Timestamp), each with an icon box + uppercase label + value.
5. Related events card — bordered `bg-card p-2` with DataTable of the 5 most recent related events for the same user.

**Tables**:
- Related events: Timestamp (mono, muted), Event Type (StatusBadge), Account (monospace), Description (muted) | row click → `navigate("audit-user-event-detail", { id: e.id })`

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export" (outline) → downloads JSON of the event.
- "Close" (ghost) → `navigate("audit-user-events")`.
- Related-events row click → `navigate("audit-user-event-detail", { id: e.id })`.
- "Create support ticket from this event" (redesign, missing today) → `navigate("support-tickets", { subject: event.eventType })`.
- "View user profile" (redesign, missing today) → `navigate("user-management", { id: event.userId })`.
- "View account detail" (redesign, missing today) → `navigate("trader-detail", { id: event.traderId })`.
- "Mark as reviewed" / "Flag for follow-up" (redesign, missing today) → toast + status badge on the event.

**Dialogs / Modals / Sheets**: (none)

---

### Audit Entry Detail Sheet (view-id: audit-entry-detail) [NEW]

**Purpose**: Per-entry Sheet for the main Audit Log page — surfaces actor context, entity context, raw payload, related entries, and audit-export actions.

**Layout** (top-to-bottom): (this is a Sheet — opened from Audit Log row click)
1. Sheet header — title {Action label}, ScrollText icon, Severity StatusBadge, subline `{actor} · {entity} #{entityId} · {timestamp}`.
2. KPI strip — 4 pills: Severity, Module, Actor (with role), IP Address.
3. Tabs — 4 TabsTriggers: Summary / Context / Related / Raw Payload.
4. Summary tab — definition list (Event ID, Timestamp, Actor, Action, Entity, Entity ID, Severity, Module, Summary).
5. Context tab — two cards: Actor context (user id, email, role, last login) + Entity context (entity type, entity id, current status, link to the entity's home page).
6. Related tab — DataTable of related audit entries for the same entity_id, ordered by timestamp.
7. Raw Payload tab — read-only monospace JSON of the audit entry's full payload + diff (when applicable).

**Tables**:
- Related entries: Timestamp (mono), Actor (semibold), Action (badge), Severity (StatusBadge), Summary (muted) | row click → opens this Sheet for the related entry

**Forms**: (none)

**Actions** (buttons + behavior):
- "Export JSON" (outline, footer) → downloads the entry as JSON.
- "Export CSV" (outline, footer) → exports the related entries as CSV.
- "View entity" (outline, footer) → navigates to the entity's home page.
- "View actor" (outline, footer) → navigates to user-management for the actor.
- "Mark as reviewed" (ghost, footer) → toast "Marked as reviewed" + status badge.
- "Flag for follow-up" (ghost, footer) → toast "Flagged" + flag badge.
- "Close" (ghost, footer) → closes Sheet.
- Related-entries row click → opens this Sheet for the clicked entry.

**Dialogs / Modals / Sheets**: (none — this is itself the Sheet)

---

### Retention / Export Scheduling (view-id: audit-retention) [NEW]

**Purpose**: Configure how long audit data is retained, and schedule recurring exports to compliance owners.

**Layout** (top-to-bottom):
1. PageHeader — title "Retention & Exports", Clock icon, primary action "Save Configuration" (PermissionGuard `audit.manage`).
2. KPI row — 4 MetricCards: Total Records, Records Older Than 1y, Scheduled Exports, Last Export (relative).
3. Retention configuration card — Card with CardHeader "Retention Policy" + CardContent. Form: Default retention days (number), Per-module retention overrides (a table of module + days-input pairs), Hard-delete vs Soft-delete Select (Hard = irrecoverable / Soft = archived), Archive destination Select (S3 / GCS / Azure Blob / Local).
4. Export scheduling card — Card with CardHeader "Scheduled Exports" + CardContent. A DataTable of scheduled exports + "New Schedule" outline button.
5. Storage usage card — Card with CardHeader "Storage Usage" + CardContent. A small BarSeries of records-by-month for the last 12 months + a progress bar of current storage vs quota.

**Tables**:
- Scheduled Exports: Schedule ID (monospace), Recipient (email), Frequency (badge — Daily / Weekly / Monthly), Filters summary (muted), Format (badge CSV / JSON / Parquet), Next Run (relative), Status (StatusBadge Active / Paused / Failed) | Edit (ghost → opens Sheet), Pause (ghost toggle), Run Now (ghost → toast), Delete (destructive ghost → opens AlertDialog)

**Forms**:
- Retention Policy form (above).
- Scheduled Exports form (see Sheet).

**Actions** (buttons + behavior):
- "Save Configuration" (primary, PageHeader) → toast "Retention policy saved".
- "New Schedule" (outline, scheduled-exports card) → opens Schedule Sheet.
- Row "Edit" → opens Schedule Sheet in edit mode.
- Row "Pause" → toggles schedule, toast.
- Row "Run Now" → toast "Export queued".
- Row "Delete" → opens Delete AlertDialog.

**Dialogs / Modals / Sheets**:
- Schedule Sheet (trigger: New / Edit) → content: Recipient email (input), Frequency Select (Daily / Weekly / Monthly), Day-of-week Select (when weekly), Day-of-month number (when monthly), Time-of-day (time input), Filters form (severity multi-select / module multi-select / actor input / entity-type multi-select), Format Select (CSV / JSON / Parquet). → actions: Save (primary), Cancel (ghost).
- Delete AlertDialog (trigger: Delete) → content: title "Delete this schedule?", consequence text. → actions: Cancel, Delete (destructive).

---

## Batch 39 — Audit (3 new)

### Severity & Policy Configuration (view-id: audit-severity-policy) [NEW]

**Purpose**: Tune which actions are critical vs warning vs info, and configure escalation rules.

**Layout** (top-to-bottom):
1. PageHeader — title "Severity & Policy", ShieldCheck icon, primary action "Save Policies" (PermissionGuard `audit.manage`).
2. KPI row — 4 MetricCards: Critical Rules, Warning Rules, Escalation Channels, Active Policies.
3. Severity mapping card — Card with CardHeader "Action → Severity Mapping" + CardContent. A DataTable of actions with per-action severity Selects.
4. Escalation rules card — Card with CardHeader "Escalation Rules" + CardContent. A list of rules, each with a condition (action + severity), a target (email / Slack / PagerDuty / webhook), and an enabled Switch.
5. Notification channels card — Card with CardHeader "Notification Channels" + CardContent. A list of channels (Slack webhook URL, PagerDuty integration key, email recipients list, SIEM webhook URL) with Edit buttons.

**Tables**:
- Action → Severity: Module (badge), Action (badge), Default Severity (StatusBadge), Configured Severity (Select — Critical / Warning / Info / Muted), Reason (muted) | (no per-row actions; the Select is the per-row action)

**Forms**:
- Severity mapping form (above — the per-row Selects).
- Escalation rules form (see Sheet).
- Notification channels form (see Sheet).

**Actions** (buttons + behavior):
- "Save Policies" (primary, PageHeader) → toast "Policies saved".
- Per-row Severity Select → updates the mapping (toast "Updated").
- "Add rule" (outline, escalation rules card) → opens Rule Sheet.
- Per-rule Switch → toggles escalation, toast.
- Per-rule "Edit" → opens Rule Sheet in edit mode.
- Per-rule "Delete" → opens Delete AlertDialog.
- Per-channel "Edit" → opens Channel Sheet.

**Dialogs / Modals / Sheets**:
- Rule Sheet (trigger: Add rule / Edit) → content: Module Select, Action Select, Severity Select, Target Select (Email / Slack / PagerDuty / Webhook), Recipient (input or Select depending on target), Cooldown minutes (number). → actions: Save (primary), Cancel (ghost).
- Channel Sheet (trigger: Edit channel) → content: depends on the channel type — Slack (webhook URL + channel name), PagerDuty (integration key + severity mapping), Email (recipients list + subject template), Webhook (URL + signing secret + headers). → actions: Save (primary), Test (outline → toast), Cancel (ghost).
- Delete AlertDialog (trigger: Delete rule) → content: title "Delete escalation rule?", consequence text. → actions: Cancel, Delete (destructive).

---

### Compliance Report Generator (view-id: audit-compliance-report) [NEW]

**Purpose**: Date-ranged compliance PDF/CSV bundle — pulls from Audit Log + Change History + KYC + Support — for regulators and external auditors.

**Layout** (top-to-bottom):
1. PageHeader — title "Compliance Reports", FileCheck icon, primary action "Generate Report" (→ opens Sheet).
2. KPI row — 4 MetricCards: Reports Generated (30d), Pending Reports, Last Generated (relative), Avg Generation Time.
3. Filter bar — Report Type Select (All / SOC2 / PCI-DSS / AML / GDPR / Custom), Status Select (All / Pending / Generating / Ready / Failed), Date-range, Reset.
4. Reports DataTable — bordered card with header "Reports ({count})".

**Tables**:
- Reports: Report ID (monospace), Type (badge), Period (date range), Modules included (badge list), Format (badge PDF / CSV / XLSX), Requested By (semibold), Status (StatusBadge), Generated (relative or "—") | Download (primary, only when Ready), View (ghost → opens Sheet), Regenerate (ghost → opens Sheet), Delete (destructive ghost → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "Generate Report" (primary, PageHeader) → opens Generate Report Sheet.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Download" → triggers download of the report file.
- Row "View" → opens Report View Sheet.
- Row "Regenerate" → opens Generate Report Sheet pre-filled.
- Row "Delete" → opens Delete AlertDialog.

**Dialogs / Modals / Sheets**:
- Generate Report Sheet (trigger: Generate / Regenerate) → content: Report Type Select (SOC2 / PCI-DSS / AML / GDPR / Custom), Period Start (date), Period End (date), Modules multi-select (Audit / Change History / KYC / Support / Payouts / Risk / Checkout), Format Select (PDF / CSV / XLSX), Recipient email (input — for delivery), "Include raw payload" checkbox, "Sign with platform key" checkbox. → actions: Generate (primary, toast + close), Cancel (ghost).
- Report View Sheet (trigger: View) → content: header with report type + period + status. KPI strip — Generated by / Generated at / Size / Format. A read-only preview pane (PDF embedded when PDF, monospace when CSV/JSON, spreadsheet grid when XLSX). → actions: Download (outline), Re-send to recipient (outline → toast), Close (ghost).
- Delete AlertDialog (trigger: Delete) → content: title "Delete report?", consequence text. → actions: Cancel, Delete (destructive).

---

### SIEM / External Sink Integration (view-id: audit-siem) [NEW]

**Purpose**: Configure external SIEM / log-aggregator sinks (Splunk / Datadog / Elastic / Sumo Logic / S3 / HTTP webhook) so audit events stream out in real time.

**Layout** (top-to-bottom):
1. PageHeader — title "SIEM & External Sinks", Network icon, primary action "Add Sink" (→ opens Sheet, PermissionGuard `audit.manage`).
2. KPI row — 4 MetricCards: Active Sinks, Events Streamed (24h), Failed Deliveries (negative when > 0), Avg Latency (ms).
3. Filter bar — Sink Type Select (All / Splunk / Datadog / Elastic / Sumo Logic / S3 / HTTP Webhook), Status Select (All / Active / Paused / Error), Reset.
4. Sinks DataTable — bordered card with header "Sinks ({count})".
5. Event-stream health card — bordered card showing a small AreaSeries of events-streamed per hour for the last 24h + a per-sink breakdown.

**Tables**:
- Sinks: Name (semibold + id subline), Type (badge), Endpoint (monospace, truncated), Status (StatusBadge Active / Paused / Error), Events 24h (number), Avg Latency (ms), Last Delivery (relative), Format (badge JSON / CEF / CSV / Parquet) | Edit (ghost → opens Sheet), Pause (ghost toggle), Test (outline → toast), Delete (destructive ghost → opens AlertDialog)

**Forms**: (none on the page)

**Actions** (buttons + behavior):
- "Add Sink" (primary, PageHeader) → opens Sink Editor Sheet in add mode.
- Filters → filter DataTable.
- "Reset" → clears filters.
- Row "Edit" → opens Sink Editor Sheet in edit mode.
- Row "Pause" → toggles sink, toast.
- Row "Test" → toast "Test event delivered" / "Test failed".
- Row "Delete" → opens Delete AlertDialog.

**Dialogs / Modals / Sheets**:
- Sink Editor Sheet (trigger: Add / Edit) → content: Name (input), Type Select (Splunk / Datadog / Elastic / Sumo Logic / S3 / HTTP Webhook), Endpoint URL (url input, monospace), Authentication Select (API key / Bearer token / Basic auth / IAM role / None), Credentials (SecretField), Format Select (JSON / CEF / CSV / Parquet), Filters form (severity multi-select / module multi-select / actions multi-select), Retry policy (max attempts + backoff), Enabled Switch (bordered box). → actions: Save (primary), Test (outline → toast), Cancel (ghost).
- Delete AlertDialog (trigger: Delete) → content: title "Delete SIEM sink?", warning that streaming to this sink stops immediately. → actions: Cancel, Delete (destructive).

---

## Batch-by-Batch Index (Batch 25 → Batch 39)

| Batch | Module | Screens (5 each, except Batch 39 = 3) |
|-------|--------|---------|
| 25 | Marketing | Marketing Overview (E), Campaigns (E), Performance (E), Ad Spend (E), Email Campaigns (E) |
| 26 | Marketing | Marketing Dashboard (E), Campaign Detail (N), Audience / Segment Builder (N), Template Editor (N), Attribution / UTM Builder (N) |
| 27 | Marketing + CRM | Ad Account Connections (N), CRM Overview (E), Contacts (E), Pipeline (E), Add Contact Flow (N) |
| 28 | CRM + KYC | Deal Detail (N), Activity Log Timeline (N), Lead Scoring Configuration (N), KYC Overview (E), KYC Reviews (E) |
| 29 | KYC | KYC Risk (E), KYC Record Detail (N), AML Case Management (N), KYC Provider Settings (N), Reviewer Audit Trail (N) |
| 30 | Support | Support Overview (E), Tickets (E), SLA Management (E), Knowledge (E), Create Ticket Dialog (N) |
| 31 | Support + AI | Canned Responses Library (N), Agent Detail (N), Knowledge Article Editor (N), CSAT / Feedback Review (N), AI Overview (E) |
| 32 | AI | AI Insights (E), AI Assistant (E), AI Configure (E), Predictive Analytics (E), Anomaly Detection (E) |
| 33 | AI | Cost Tracking (E), Per-Insight Detail (N), Model Audit Log (N), AI Usage Quota / Rate-Limit (N), Prompt Library (N) |
| 34 | AI + Checkout | Fine-tuning (N), Training Data Export (N), Checkout Overview (E), Payment Providers (E), Payment Methods (E) |
| 35 | Checkout | External Integration (E), Transactions (E), Platform Overview (E), Tenant Checkout Matrix (E), PSP Catalog (E) |
| 36 | Checkout | Platform External Defaults (E), Platform Transactions (E), Transaction Detail Sheet (N), Webhook Log Viewer (N), Refund / Dispute Workflow (N) |
| 37 | Checkout + Audit | Settlement / Reconciliation Report (N), PSP Onboarding Wizard (N), Platform External Contract Editor (N), Audit Log (E), User Events (E) |
| 38 | Audit | Enhanced Events (E), Change History (E), User Event Detail (E), Audit Entry Detail Sheet (N), Retention / Export Scheduling (N) |
| 39 | Audit | Severity & Policy Configuration (N), Compliance Report Generator (N), SIEM / External Sink Integration (N) |

**Total**: 73 screens across 15 batches — Batches 25–38 contain 5 screens each (= 70); Batch 39 contains 3 screens. 38 EXISTING + 35 NEW = 73.


---

# Prop-Admin Dashboard — Warm Stitch Design Specification (Part 4 of 4)

> **Scope**: Settings, Super-Admin, Pendings, Profile, Notifications, Help, and Overview modules — 76 spec entries organized in batches of 5 starting at **Batch 40**.
>
> **Design language**: warm stitch — `bg-background`, `bg-card` with `border` + `shadow-sm`, `bg-primary` + `text-primary-foreground`, `bg-sidebar` + `bg-sidebar-accent`, `rounded-lg` cards, `rounded-md` buttons, `max-w-7xl mx-auto` with `space-y-6` section gaps. Lucide icons throughout. shadcn/ui New York components.
>
> **Semantic tones** (no color references in this spec — all references are design-token or semantic): `success`, `positive`, `warning`, `info`, `danger`, `critical`, `muted`, `default`. Tones drive `StatusBadge` / `Badge` variants. Status colors never appear as bare Tailwind classes — always via the badge/status primitive.
>
> **Page shell**: every screen renders inside `<Page>` → `<PageHeader>` (title + description + actions) → `<PageContent>` with `space-y-6` between blocks. Cards use `rounded-lg border bg-card p-4` (or `p-6`). Tables wrap in `rounded-lg border bg-card`. Long lists use `max-h-96 overflow-y-auto` with custom scrollbar styling.
>
> **Layout invariant**: sticky footer (`min-h-screen flex flex-col` root, footer with `mt-auto`). Mobile-first: 1 column → 2 col on `sm` → 3-4 col on `lg`. Touch targets ≥ 44px.
>
> **Persistence**: all spec-listed Save / Delete / etc. actions MUST persist to the RBAC store / mock data / `localStorage` as appropriate — not toast-only stubs. Toasts confirm the mutation after it has landed.

---

# Batch 40 — Settings Landing Cluster (Screens 196-200)

## 196. Settings Landing (view-id: `settings`) [EXISTING]

**Purpose**: The front-door to the Settings module — a searchable, categorized grid of all settings sections plus a collapsible "Quick edit" panel containing a 7-tab inline editor.

**Layout** (top-to-bottom):
1. PageHeader — title "Settings", description, "Quick edit" toggle button (outline when hidden, primary when shown).
2. KPI row (4 MetricCards) — "Settings Sections" (count of all cards), "Recently Modified" (tenant creation date), "Active Modules" (count of `tenant.enabledModules`), "Platform Status" (active/trial/suspended with plan label).
3. Search bar — `Input` with `Search` icon prefix; filters the landing grid live.
4. Landing grid — grouped by category (Branding → Security → Communications → Certificates → System). Each category header has a count badge. Cards render in a 1/2/3-column responsive grid.
5. Quick edit panel (conditional — shown when toggle is on) — Card containing a `Tabs` with 7 triggers: General, Branding, Terminology, Modules, Roles, Integrations, Notifications.

**Per-card content** (each card in the grid):
- Card with icon tile + chevron-right (chevron shows on hover).
- Title + description.
- "Open →" label at the bottom.
- Card click → `navigate(card.viewId)` or open Quick edit on the matching tab.

**Forms** (Quick-edit tabs):
- General tab: Tenant name (input), Tagline (input), Currency (select), Timezone (input), "Save changes" button, "Export all data (ZIP)" outline button. Sub-row of read-only facts (Plan / Status / Modules / Features).
- Branding tab: 6 brand presets (button row of swatches), Primary brand swatch (color input + text input), Accent swatch (color input + text input), Border radius (select), Initials (input, maxLength 3, uppercase), Live preview tile, "Apply branding" button.
- Terminology tab: 8 terminology inputs (challenge, trader, payout, account, evaluation, participant, withdrawal, disbursement), each prefilled with default placeholder. "Save terminology" button.
- Modules tab: list of all modules with icon + name + optional badge + category badge + dependencies line; per-module `Switch` toggling `tenant.enabledModules`.
- Roles tab: read-only role cards summarizing each role with name + application badge + description + first 15 permissions + "+N more". "Open full workspace" button → `navigate("roles-management")`.
- Notifications tab: per-module cards (Trading / Challenges / Risk / Payouts / KYC / AI-LLM), each with 3 channel toggles (Email / In-app / Slack) using `Switch`. Plus Quiet Hours card with master toggle + Start select + End select.
- Integrations tab: 5 integration category cards (Trading Platform, Payments, KYC/AML, Notifications, AI & Analytics), each listing its integrations with status badge + health badge + last-sync timestamp + per-row "Configure / Connect / Reconnect" button. Security note card at the bottom.

**Actions**:
- "Quick edit" toggle → shows/hides the Quick edit panel (state persists in local component state).
- "Save changes" (General) → `setTenant({ ...tenant, name, branding, currency, timezone })` + toast "Settings saved".
- "Apply branding" (Branding) → `setTenant({ ...tenant, branding })` + toast "Branding applied" + live re-composes sidebar/dashboard instantly.
- "Save terminology" (Terminology) → `setTenant({ ...tenant, terminology: terms })` + toast.
- Module Switch → toggles membership in `enabledModules` Set + toast confirmation.
- "Open full workspace" (Roles tab) → `navigate("roles-management")`.
- "Export all data (ZIP)" → `await import("@/lib/platform/bulk-export")` → `exportAllAsZip(runtime)`.
- Card click (any landing grid card) → either opens Quick edit tab or `navigate(card.viewId)`.

**Dialogs / Modals / Sheets**:
- None — the Quick edit panel is an inline Card, not a modal.

---

## 197. User Management (view-id: `user-management`) [EXISTING]

**Purpose**: Tenant-wide user directory combining admin staff and traders into a single searchable, filterable, paginated list with KYC + 2FA status, revenue, account counts, and per-row Edit / View actions.

**Layout** (top-to-bottom):
1. PageHeader — title "User Management", description, action group: "Import" (outline) + "Export" (outline) + "Add User" (primary, disabled when `!canManage`).
2. KPI row (4 MetricCards) — Total Users, Verified KYC, 2FA Enabled, Suspended.
3. Filter bar — bordered `bg-muted/20` strip with: Filter icon + count badge, search Input (name/email), status Select, KYC Select, role Select, Clear button, "{n} of {m} users" counter.
4. Users DataTable — paginated 10 rows/page, sortable columns.
5. Footnote line — "Admin staff carry verified KYC by default; traders carry KYC from the KYC module."

**Tables**:
- Users table: User (avatar + name + staff badge + email), Roles (color dots + role badges), KYC (StatusBadge), 2FA (on/off badge), Revenue (formatted currency, "—" for staff), Accounts (count, "—" for staff), Status (StatusBadge), Last Active (date) | per-row: Edit (Pencil), View (Eye)

**Forms**:
- Edit access dialog (see below) — checkbox list of roles.
- Invite user sheet (see below).

**Actions**:
- "Import" (outline) → **open CSV Import Dialog** (Batch 44).
- "Export" (outline) → real `exportToCsv(filteredRows, columns, filename)` — writes a CSV download.
- "Add User" (primary) → opens `InviteUserSheet`.
- Per-row "Edit" → opens `EditUserRolesDialog` (admin rows) or toast-stub "Edit user" (trader rows — should navigate to trader-detail; see NEW Trader Detail View).
- Per-row "View" → `navigate("trader-detail", { id })` for trader rows; for admin rows opens `Per-User Audit Timeline` (NEW, Batch 45).
- Filter-bar selects + search → drive the filtered list (local state, not URL — known limitation called out in audit §8).
- "Clear" → resets all filters.

**Dialogs / Modals / Sheets**:
- EditUserRolesDialog (trigger: per-row Edit on admin row) → content: DialogTitle "Edit access — {name}", list of roles (each a label with checkbox + role color dot + name + system/custom badge + description), footer Cancel + "Save access" (disabled when no role selected). On Save → `setUserRoles(userId, roleIds, currentUser.name)` + toast "Access updated".
- InviteUserSheet (trigger: "Add User" button) → right-side Sheet, see dedicated spec below (separate component reused by Team Members + Roles Management + User Management).

---

## 198. Team Members (view-id: `team-members`) [EXISTING]

**Purpose**: Tenant-isolated staff directory showing every role assignment for the active tenant — active, expired, revoked — with Edit Role Assignment Sheet, Invite User Sheet, and AlertDialog-gated Remove.

**Layout** (top-to-bottom):
1. PageHeader — title "Team Members", description "Manage staff and role assignments for {tenantName}", actions: "Export CSV" (outline, real `exportToCsv`) + "Invite User" (primary, permission-gated).
2. KPI row (4 MetricCards) — Total Staff, Active Assignments, Roles Available, Pending Invitations.
3. Filter bar — Card with: Search Input (name/email/role), Role Select, Status Select, Clear button.
4. Staff DataTable — paginated, sortable.

**Tables**:
- Staff assignments table: User (avatar + name + staff badge + email), Role (color dot + name — click to filter by that role), Application (badge), Assigned (date + "by {assignedBy}"), Status (ExplainableStateBadge), Expiry (date) | per-row: 3-dot DropdownMenu (Edit Role Assignment / View Activity / Remove)

**Forms**:
- EditRoleAssignmentSheet — see dedicated component spec.

**Actions**:
- "Export CSV" → `exportToCsv(filteredRows, exportColumns, "team-members-{tenantId}.csv")` — real CSV download.
- "Invite User" → opens `InviteUserSheet`.
- Per-row 3-dot → "Edit Role Assignment" → opens `EditRoleAssignmentSheet`.
- Per-row 3-dot → "View Activity" → opens `Per-User Audit Timeline` (NEW, Batch 45 — currently toast-stub).
- Per-row 3-dot → "Remove" (destructive) → opens Remove AlertDialog.

**Dialogs / Modals / Sheets**:
- EditRoleAssignmentSheet (trigger: 3-dot Edit Role Assignment) → right-side Sheet, fields: Role (Select), Reason (Textarea, maxLength 280), Expiry (date input, min today). Footer Cancel + "Save assignment". On Save → `setUserRoles(userId, [roleId], currentUser.name)` + toast "Role assignment updated · Recorded in the role audit log".
- Remove AlertDialog (trigger: 3-dot Remove) → AlertDialogContent with explicit consequence text ("immediate access loss, email notification, audit-log entry"). Footer Cancel + "Remove access" (destructive). On Confirm → `setUserRoles(userId, [], currentUser.name)` + toast "User removed".
- InviteUserSheet (trigger: Invite User button) — reused from User Management.

---

## 199. Group Management (view-id: `group-management`) [EXISTING]

**Purpose**: Master/detail layout to organize platform users (admins + traders) into groups for bulk actions, reporting, and risk monitoring.

**Layout** (top-to-bottom):
1. PageHeader — title "Group Management", description, action: "Add Group" (primary).
2. KPI row (3 MetricCards) — Total Groups, Total Members, Largest Group (name).
3. Master/detail grid (`lg:grid-cols-[1fr_1.2fr]`):
   - Left card — Groups list with search Input + bulk-action bar (when ≥1 selected) + per-group row with checkbox + color square + name + member-count badge + description + creation date.
   - Right card — Selected group detail: header (name + description + member-count badge) + Separator + members Table + footer actions.

**Tables**:
- Group members table: Member (avatar + name), Email, Type (Staff/Trader badge), Status (StatusBadge) | no per-row actions (Add Member and Export Members are at the panel footer)

**Forms**:
- Add Group Sheet (NEW — see Batch 44).
- Edit Group dialog (NEW).

**Actions**:
- "Add Group" → opens `Add Group Sheet` (NEW, Batch 44).
- Group row click → selects the group; right panel re-renders.
- Group checkbox → toggles bulk selection; "Apply to {N}" button appears (currently toast-stub — should open bulk-action menu).
- "Add member" (panel footer) → opens Add Member Sheet (NEW sub-flow).
- "Export members" (panel footer) → real `exportToCsv` of selected group's members.
- Per-group "Edit" → opens Edit Group dialog (NEW).
- Per-group "Delete" → opens Delete Group AlertDialog (NEW).

**Dialogs / Modals / Sheets**:
- Add Group Sheet (NEW) — see Batch 44.
- Add Member Sheet (NEW sub-flow, similar shape to InviteUserSheet) — fields: Search trader/admin, multi-select chips, optional role/label, reason. Footer Cancel + "Add {N} members".
- Edit Group dialog (NEW) — fields: Name, Description, Color (preset palette), default module access. Footer Cancel + "Save group".
- Delete Group AlertDialog (NEW) — destructive confirmation; "Delete group" button → `removeGroup` mutation + toast.

---

## 200. Banner Management (view-id: `banner-management`) [EXISTING]

**Purpose**: Tabs by type (Announcement vs Marketing) with a master DataTable and an inline detail editor showing banner fields with live preview affordances.

**Layout** (top-to-bottom):
1. PageHeader — title "Banner Management", description, action: "Add Banner" (primary).
2. Tabs (announcement / marketing) — `TabsList` with two triggers.
3. Tab content — master/detail grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left card — DataTable of banners with built-in search.
   - Right card — Empty state when nothing selected, or `BannerEditor` when a row is clicked.

**Tables**:
- Banners table: Title (text), Content (truncated tooltip), Status (StatusBadge), Start (date with Calendar icon), End (date with Calendar icon), Position (StatusBadge) | per-row: Edit (Pencil) + Toggle (ToggleLeft icon)

**Forms**:
- BannerEditor (right panel): Title (Input), Content (Textarea, 4 rows), Active (Switch with label + description), Start Date (date Input), End Date (date Input), Position (Select with Layout icon prefix), "Save Banner" button.

**Actions**:
- "Add Banner" → **navigates to `marketing-banner-edit`** (NEW — replaces toast-stub).
- Tab trigger click → swaps the DataTable data source (`getBanners(tab)`).
- Per-row "Edit" or row click → selects the banner; right panel shows the editor with a working copy of the banner.
- Per-row "Toggle" → flips status between `active`/`inactive` + toast.
- "Save Banner" → toast "Banner saved".
- "Close" (X icon in editor header) → deselects the banner.

**Dialogs / Modals / Sheets**:
- Delete Banner AlertDialog (NEW sub-flow, missing) — per-row 3-dot menu item "Delete" with explicit consequence text + "Delete banner" destructive button.
- Preview Banner Modal (NEW sub-flow, missing) — "Preview" button opens a modal showing the rendered banner as it would appear in Top Bar / Sidebar / Modal / Floating positions.

---

# Batch 41 — Marketing + Token Cluster (Screens 201-205)

## 201. Marketing Integrations (view-id: `marketing-integrations`) [EXISTING]

**Purpose**: Third-party marketing platform connections (Klaviyo, GA4, Meta Pixel, Discord, Slack, Mailchimp, HubSpot) with inline Active / Event Logging toggles, masked API key, and AlertDialog-gated Disconnect.

**Layout** (top-to-bottom):
1. PageHeader — title "Marketing Integrations", description, action: "Add Integration" (primary).
2. KPI row (4 MetricCards) — Total Integrations, Connected, Active, Event Logging.
3. Master/detail grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left card — DataTable of integrations.
   - Right card — Empty state, or `IntegrationEditPanel` when a row is selected.

**Tables**:
- Integrations table: Platform (icon + StatusBadge), Status (Connected/Disconnected badge), Active (inline Switch), Event Logging (inline Switch), Last Sync (formatted date) | per-row: Configure (Settings2 icon) + Disconnect (Unplug icon, destructive styling)

**Forms**:
- IntegrationEditPanel (right panel): Platform read-only header + ID, Platform dropdown (Select — only enabled for new drafts), Is Active (Switch with label), Enable Event Logging (Switch with label), collapsible "API Secret Key Format per Platform" help (shows JSON example for the selected platform), masked API Secret Key (Input with Eye/EyeOff show/hide toggle), "Test Connection" outline button, "Save Integration" primary button, "Disconnect" destructive button.

**Actions**:
- "Add Integration" → creates a draft row pre-set to Klaviyo, prepends it to the list, selects it for editing.
- Per-row "Configure" or row click → selects the row; right panel renders the editor.
- Per-row "Active" Switch → `onToggleActive(i)` mutates state + toast "Integration paused / activated".
- Per-row "Event Logging" Switch → `onToggleLogging(i)` mutates state + toast.
- "Test Connection" → real network call (currently always returns success — should call `GET {platform}/health`); toast "Connection test successful".
- "Save Integration" → persists to integrations store + toast "Integration saved".
- "Disconnect" → opens Disconnect AlertDialog.
- Inline Active / Event Logging switches should call backend persist endpoints, not just local state (currently local only — known limitation; the spec calls for server-side persistence).

**Dialogs / Modals / Sheets**:
- Disconnect AlertDialog (trigger: "Disconnect" button) → AlertDialogContent: title "Disconnect this integration?", description with explicit consequences ("stop all event sync", "stored API keys are removed", "cannot be undone"). Footer Cancel + "Disconnect" (destructive variant). On Confirm → `onDisconnect(i)` clears `connected=false, active=false`, deselects row, toasts "Integration disconnected".
- OAuth Connect Sheet (NEW sub-flow, missing) — when a platform requires OAuth (Meta Pixel, Google Analytics 4), the panel should open an OAuth connect sheet with "Authorize with {Platform}" button → opens OAuth popup → on success, captures tokens, replaces the API key field.

---

## 202. Social Media Links (view-id: `social-media-links`) [EXISTING]

**Purpose**: Manage trader social media profiles — Twitter/X, Instagram, Telegram, Discord, YouTube, TikTok, LinkedIn, Facebook — with add/delete (real), filter by platform, KPI roll-ups, CSV export, and per-link analytics.

**Layout** (top-to-bottom):
1. PageHeader — title "Social Media Links", description, actions: "Export CSV" (outline, real) + "Add Link" (primary).
2. KPI row (4 MetricCards) — Total Links, Unique Platforms, Accounts with Links, Most Popular Platform ("{platform} ({count})").
3. Filter bar — bordered strip with Filter icon + count, search Input (handle/URL/account), platform native `<select>` (audit §7 — should be shadcn `Select`), Clear button, "{n} of {m} links" counter.
4. Links DataTable — paginated, sortable.
5. Inline Add Link form (conditionally rendered when "Add Link" is clicked) — Card above the table with: Platform Select, Handle Input, Custom URL Input, Account Select, "Save" + "Cancel" buttons.

**Tables**:
- Links table: Platform (icon + StatusBadge), Handle (monospace), Custom URL (ExternalLink icon + truncated clickable anchor, target _blank), Account (Mail icon + clickable mailto), Created (date) | per-row: Edit (Pencil, currently toast-stub) + Delete (Trash2, AlertDialog-gated)

**Forms**:
- Inline Add Link form: Platform (Select), Handle (Input, required), Custom URL (Input, required), Account (Select — populated from tenant traders), "Save" + "Cancel".

**Actions**:
- "Export CSV" → `exportToCsv(filtered, columns, "social-media-links-{tid}.csv")`.
- "Add Link" → shows inline form; pre-fills with first trader + Twitter/X.
- "Save" (inline form) → validates Handle + URL + Trader; on success `setLinks(prev => [newLink, ...prev])` + toast "Link added".
- "Cancel" (inline form) → hides form, clears fields.
- Per-row "Edit" → **opens Edit Link Sheet** (NEW sub-flow — currently toast-stub) with same fields as Add Link form, pre-filled.
- Per-row "Delete" → opens Delete AlertDialog.

**Dialogs / Modals / Sheets**:
- Delete Link AlertDialog (trigger: per-row Delete) → AlertDialogContent: title "Delete social link?", description ("{platform} handle {handle} will be removed from trader {traderName}. The trader can re-link the profile at any time."). Footer Cancel + "Delete link" (destructive). On Confirm → `setLinks(prev => prev.filter(...))` + toast.
- Edit Link Sheet (NEW sub-flow) — right-side Sheet with the same fields as the inline Add form, pre-filled with the selected link. Footer Cancel + "Save changes".
- Verify Ownership Flow (NEW sub-flow, missing) — per-link 3-dot menu item "Verify ownership" → opens a Sheet with platform-specific OAuth verification steps + "Verify now" button.
- Link Preview Modal (NEW sub-flow, missing) — per-link 3-dot "Preview" → renders the profile URL in an embedded iframe-like modal.

---

## 203. Marketing Banner Edit (view-id: `marketing-banner-edit`) [EXISTING]

**Purpose**: Enhanced banner create/edit form with image upload, scheduling, targeting, and live preview. Reached from Banner Management "Add Banner" or by clicking an existing banner row.

**Layout** (top-to-bottom):
1. PageHeader — title "Edit Banner" or "New Banner" (depends on `router.params.id`), description, action: "Back to Banners" outline button.
2. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked SectionCards: Image, Display Settings, Destination, Scheduling (Collapsible), Targeting (Collapsible).
   - Right column — Live Preview Card + Action Bar at the bottom.
3. Action bar (sticky bottom): "Delete" (destructive outline, AlertDialog) + "Save and add another" (outline) + "Save and continue editing" (outline) + "Save" (primary).

**Forms**:
- Image section: image file Input (accept image/*), preview thumbnail with "Replace" + "Remove" buttons.
- Display Settings section: Is Active (Switch), Sort Order (number Input), Position (Select: Top Bar / Sidebar / Modal / Floating).
- Destination section: Link Type (Select: External URL / Internal Page / None), External URL (Input, visible when type=external), Internal Page (Select: Dashboard / Challenges / Payouts / Account / Pricing / Leaderboard / KYC / Support, visible when type=internal).
- Scheduling section (collapsible, collapsed by default): Start Date (date Input), End Date (date Input, disabled when "Runs indefinitely" checked), "Runs indefinitely" (Checkbox).
- Targeting section (collapsible): Target Audience (Select: All Users / Logged In / Funded Traders / New Users), Countries (Checkbox list — US / GB / AE / SG / DE / FR / BR / IN / ZA / CA).
- Live Preview card: rendered preview bar with the title text, accent for active vs muted for inactive.

**Actions**:
- "Save" → `toast({ title: "Banner saved" })` + navigate to `banner-management`.
- "Save and add another" → save + clear form (currently toast-stub doesn't clear).
- "Save and continue editing" → save + keep form state.
- "Delete" → opens Delete AlertDialog.
- "Back to Banners" → `navigate("banner-management")`.

**Dialogs / Modals / Sheets**:
- Delete Banner AlertDialog (trigger: "Delete" button) — explicit consequence text + destructive "Delete permanently" → `navigate("banner-management")` + toast.
- Image Library Picker Sheet (NEW sub-flow, missing) — "Choose from library" link under the image upload → opens right-side Sheet with a gallery of previously-uploaded banner images; click to select.
- A/B Variant Selector (NEW sub-flow, missing) — per-banner "Create variant" button → opens a Sheet with variant name + targeting split.

---

## 204. Token Management (view-id: `token-management`) [EXISTING]

**Purpose**: API token / key registry — shows every issued token with its truncated key hash, owning user, creation date, last-used, status (active / revoked), and per-row Copy / Revoke actions.

**Layout** (top-to-bottom):
1. PageHeader — title "Token Management", description, action: "Generate Token" (primary).
2. KPI row (4 MetricCards) — Total Tokens, Active Tokens, Revoked Tokens, Unique Users.
3. Filter bar — bordered strip with Filter icon + count, search Input (key hash or user email), Clear button, "{n} of {m} tokens" counter.
4. Tokens DataTable — paginated 10 rows/page, sortable.
5. Footnote — "Keys are stored as truncated hashes — full plaintext is shown only once at generation time."

**Tables**:
- Tokens table: Key (monospace preview, e.g. `pfaas_abc123def456…`), User (email), Scope (monospace badge, e.g. `read:trades`), Created (date), Last Used (relative time-ago, "never" in destructive tone when null), Status (StatusBadge) | per-row: Copy (Copy icon), Revoke (Ban icon, destructive — only shown for active tokens)

**Forms**:
- Generate Token Sheet (NEW — see below).

**Actions**:
- "Generate Token" → **opens Generate Token Sheet** (NEW sub-flow, currently toast-stub).
- Per-row click → **navigates to `token-detail?id={token.id}`** (NEW — currently no row click handler).
- Per-row "Copy" → `navigator.clipboard.writeText(t.keyFull)` + toast "Token copied".
- Per-row "Revoke" → opens Revoke Token AlertDialog.

**Dialogs / Modals / Sheets**:
- Generate Token Sheet (NEW) — right-side Sheet, fields: Name (Input), User (Select — populated from tenant users), Expiration Date (date Input, optional), Scopes (multi-select checkbox list — read:trades, write:trades, read:accounts, write:accounts, read:payouts, approve:payouts, read:analytics, admin:all), IP Whitelist (Textarea, comma-separated, with validation), "Generate" primary button. On submit → mints a new token hash, displays it ONCE in a modal with a copy button + warning "Store securely — this key will not be shown again."
- Revoke Token AlertDialog (NEW, missing) — per-row "Revoke" → AlertDialogContent: title "Revoke this token?", description with consequences ("Any API integrations using this token will immediately stop working. Cannot be undone.") Footer Cancel + "Revoke permanently" (destructive).

---

## 205. Token Detail (view-id: `token-detail`) [EXISTING]

**Purpose**: Single API token view + edit form. Reached from Token Management list (click-through on a token row) or directly via `router.params.id`. The id parameter IS the token hash itself.

**Layout** (top-to-bottom):
1. Breadcrumb — "Tokens / {key.slice(0,16)}…" with link back to `token-management`.
2. Header row — KeyRound icon tile + "API Token" (or "New API Token") title + monospace key preview + StatusBadge + "History" outline button.
3. Form grid (`lg:grid-cols-2`):
   - FormSection "Identification" — Key (read-only Input, monospace, with Show/Hide toggle + Copy button), User (Select, populated from tenant users).
   - FormSection "Access Control" — Is Active (Switch), Expiration Date (date Input), Scopes (checkbox list with 8 scope options — each with label + description), IP Whitelist (Textarea).
4. Separator.
5. Token Usage Stats card — 4 MetricCards: Total API Calls, Last 24h Calls, Last IP Used, Most Called Endpoint.
6. Separator.
7. Footer action bar — "Delete Token" (destructive outline, AlertDialog) on the left + "Regenerate Key" (outline) + "Save and add another" (outline) + "Save and continue editing" (outline) + "Save" (primary) on the right.

**Forms**:
- Identification form: Key (read-only Input), User (Select).
- Access Control form: Is Active (Switch), Expiration Date (date Input), Scopes (8 checkboxes with descriptions), IP Whitelist (Textarea, comma-separated, with IP validation).

**Actions**:
- "Save" → toast "Token saved".
- "Save and add another" → save + reset form to fresh-token layout (`buildTokenDetail("new", tid)`).
- "Save and continue editing" → save + keep state.
- "Regenerate Key" → **opens Regenerate Key AlertDialog** (NEW — currently toast-stub; should be AlertDialog-gated because it's irreversible).
- "Delete Token" → opens Delete Token AlertDialog.
- "History" → **opens Token Usage History Modal** (NEW sub-flow, currently toast-stub) with per-IP breakdown chart + endpoint table.
- "Show / Hide" key → toggles `showKey` local state.
- "Copy" key → `navigator.clipboard.writeText(working.key)` + toast "Key copied".
- Click on user → opens `Per-User Audit Timeline` for that user (currently toast-stub).

**Dialogs / Modals / Sheets**:
- Delete Token AlertDialog (trigger: "Delete Token" button) → AlertDialogContent with ShieldAlert icon + title "Delete this token?", description "permanently revoked… API integrations will stop working. Cannot be undone." Footer Cancel + "Delete permanently" (destructive). On Confirm → toast + `navigate("token-management")`.
- Regenerate Key AlertDialog (NEW sub-flow, missing) — AlertDialogContent: title "Regenerate key?", description "The old key will be immediately invalid. Any integrations using it will need to be updated." Footer Cancel + "Regenerate" (destructive variant) → mints new hash + shows one-time display modal + toast.
- Token Usage History Modal (NEW sub-flow, missing) — full modal with per-IP table + per-endpoint breakdown chart + 30-day call timeline.

---

# Batch 42 — Devices + KYC + Email Cluster (Screens 206-210)

## 206. Device Activities (view-id: `device-activities`) [EXISTING]

**Purpose**: Login device fingerprint history — surfaces every unique device fingerprint that has logged into a trader account. Used by ops / risk teams to detect shared access, multi-account logins, and fraud.

**Layout** (top-to-bottom):
1. PageHeader — title "Device Activities", description.
2. Collapsible "Device Activity Guide" info banner (collapsed by default) — explains the value of the view.
3. KPI row (5 MetricCards) — Total Devices, Unique IPs, Mobile Devices, Desktop Devices, Most Active Country.
4. Filter bar — bordered strip: Filter icon + count, search Input, Source Select (Web/Mobile/API), Device Type Select (Desktop/Mobile/Tablet), Platform Select (Windows/macOS/iOS/Android), Date Range Select (24h/7d/30d/90d/All), Clear button.
5. Devices DataTable — paginated, sortable.
6. Footnote line with "Export CSV" button.

**Tables**:
- Devices table: Source (StatusBadge), Device ID (monospace, truncated, tooltip with full hash), IP Address (monospace with Wifi icon), Device Type (StatusBadge with icon — Monitor/Smartphone/Tablet), Platform (StatusBadge), Country (Badge with MapPin icon), First Seen (date-time with Clock icon), Last Seen (date-time), Login Count (numeric) | per-row: View (Eye icon) + Delete (Trash2 icon, AlertDialog-gated)

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv(filtered, columns, "device-activities-{tid}.csv")`.
- Per-row click or "View" → **opens Device Detail View** (NEW, Batch 44 — currently toast-stub).
- Per-row "Delete" → opens Remove Device AlertDialog.

**Dialogs / Modals / Sheets**:
- Remove Device AlertDialog (trigger: per-row Delete) → AlertDialogContent: title "Remove device record?", description "Fingerprint {hash} ({ip}) will be removed from history. Next login creates a new fingerprint." Footer Cancel + "Remove device" (destructive).
- Device Detail View (NEW — see Batch 44).

---

## 207. KYC Providers (view-id: `kyc-providers`) [EXISTING]

**Purpose**: Manage identity-verification providers (Sumsub, Onfido, Veriff, etc.) — configure credentials, set the active primary provider + fallback order, see per-provider health / sync / approval metrics.

**Layout** (top-to-bottom):
1. PageHeader — title "KYC Providers", description, action: "Export CSV" (outline).
2. KPI row (4 MetricCards) — Active Providers, Total Verifications 30d, Approval Rate %, Avg Processing Time.
3. Primary provider card (highlighted with primary accent) — shows logo placeholder, status badge, last sync timestamp, 3 contextual actions: "Edit" (primary) + "Test Connection" (outline) + "Deactivate" (destructive outline).
4. Provider list DataTable — 8 columns.
5. Add-provider empty-state card — "Connect a new KYC provider" CTA where the next onboarding decision happens.
6. Fallback order section — reorderable list (ChevronUp / ChevronDown arrows) of providers tried when the primary fails. Collapsible "How fallback works" help.

**Tables**:
- Providers table: Name (logo placeholder + name + description), Status (StatusBadge — active/fallback/inactive), API Key (monospace, masked, with Eye/EyeOff toggle), Webhook URL (truncated), Last Sync (relative time-ago), 30d Verifications (numeric), Approval Rate (percentage with TrendingUp/Down arrow showing MoM delta) | per-row: Edit (Edit3 icon) + Test (TestTube icon) + Deactivate (Power icon, destructive)

**Forms**:
- Edit Sheet (right-side Sheet, see below).

**Actions**:
- "Export CSV" → real `exportToCsv`.
- "Connect a new KYC provider" CTA → **opens Add KYC Provider Marketplace** (NEW, Batch 45 — currently toast-stub).
- Per-row "Edit" or row click → opens Edit Provider Sheet.
- Per-row "Test Connection" → real network call (currently always returns success); toast "Connection test successful".
- Per-row "Deactivate" → opens Deactivate AlertDialog.
- Fallback reorder → ChevronUp / ChevronDown mutates the order in state + persists; current implementation toasts only — should persist to RBAC store / KYC config.

**Dialogs / Modals / Sheets**:
- Edit Provider Sheet (trigger: per-row Edit or primary card Edit) → right-side Sheet, fields: Provider name + status (read-only display), API Key (Input with Show/Hide toggle + Copy button), Webhook URL (Input), Sandbox Mode (Switch), Auto-approve threshold (Slider 0-100, default 85), Fallback priority (Select: Primary / Fallback #1 / Fallback #2 / Inactive), "Test Connection" outline button, "Save" primary button, "Deactivate" destructive button.
- Deactivate Provider AlertDialog (trigger: per-row Deactivate or sheet's Deactivate button) → AlertDialogContent with explicit consequences ("pending verifications will be rerouted to the next fallback provider; audit trail entry recorded"). Footer Cancel + "Deactivate provider" (destructive).
- Add KYC Provider Marketplace (NEW — see Batch 45).

---

## 208. Email Templates (view-id: `email-templates`) [EXISTING]

**Purpose**: Master/detail layout for transactional email templates — DataTable on the left, editable detail panel on the right (progressive disclosure: advanced editing only when needed).

**Layout** (top-to-bottom):
1. PageHeader — title "Email Templates", description, action: "Add Template" (primary).
2. Master/detail grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left card — DataTable of templates with built-in search.
   - Right card — Empty state, or `TemplateDetailPanel` when a row is clicked.

**Tables**:
- Templates table: Name (text), Subject (truncated, tooltip with full text), Trigger (StatusBadge — breach/payout/kyc/challenge), Variables (badge with Variable icon + count), Last Modified (date with Clock icon) | per-row: Edit (Pencil) + Delete (Trash2 icon)

**Forms**:
- TemplateDetailPanel (right panel): Subject (Input), Body (Textarea, 8 rows, monospace, placeholder mentions `{{variables}}`), Variables list (read-only Badge chips with `{{var}}`), "Send Test" outline button, "Save Template" primary button.

**Actions**:
- "Add Template" → **navigates to `email-template-edit`** (NEW — replaces toast-stub).
- Per-row "Edit" or row click → selects the template; right panel renders the editor with a working copy.
- Per-row "Delete" → currently toast-stub; **should open Delete Template AlertDialog** (NEW sub-flow) with confirmation, then `setTemplates(prev => prev.filter(...))` + toast.
- "Save Template" → toast "Template saved" (should persist to templates store).
- "Send Test" → currently toast-stub; should open Send Test Dialog (NEW sub-flow) with recipient email Input + "Send test email" button.
- "Close" (X icon in panel header) → deselects the template.

**Dialogs / Modals / Sheets**:
- Delete Template AlertDialog (NEW sub-flow, missing) — title "Delete template?", description "Template {name} will be removed. Templates already queued for sending will still be dispatched." Footer Cancel + "Delete template" (destructive).
- Send Test Dialog (NEW sub-flow, missing) — title "Send test email", recipient email Input (pre-filled with current user's email), optional variables overrides, "Send test email" primary button + Cancel. On send → dispatches via backend + toast.

---

## 209. Email Template Edit (view-id: `email-template-edit`) [EXISTING]

**Purpose**: Enhanced email template editor with WYSIWYG content editor, variables insertable at the caret, recipients tab (CC/BCC/Reply-To), and Save variants.

**Layout** (top-to-bottom):
1. PageHeader — title "Edit Template" or "New Template", description, action: "Back to Templates" outline button.
2. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked SectionCards: Basic Info, Content (with WYSIWYG + Variables), Recipients.
   - Right column — Live Preview Card showing rendered HTML in a phone-frame mock.
3. Action bar (sticky bottom): "Delete" (destructive outline, AlertDialog) + "Save and add another" (outline) + "Save and continue editing" (outline) + "Send Test" (outline) + "Save" (primary).

**Forms**:
- Basic Info section: Template Name (Select — 13 standard triggers: Challenge Purchased, Challenge Passed, Payout Approved, etc.), Enabled (Switch).
- Content tab: Subject (Input), WYSIWYG editor (`contentEditable` div) with toolbar — Bold / Italic / Underline / Bullet list / Numbered list / Link / Source toggle. Variables dropdown (Insert at caret — 14 variables: user_name, user_email, challenge_name, phase, amount, currency, etc.). Source view = Textarea with raw HTML.
- Recipients tab: CC (Input, comma-separated), BCC (Input), Reply-To (Input).

**Actions**:
- "Save" → toast "Template saved".
- "Save and add another" → save + reset form (currently doesn't clear).
- "Save and continue editing" → save + keep state.
- "Send Test" → opens Send Test Dialog (NEW sub-flow).
- "Delete" → opens Delete Template AlertDialog (NEW sub-flow).
- "Back to Templates" → `navigate("email-templates")`.
- WYSIWYG toolbar button → `document.execCommand(command)` on the contentEditable.
- Variables dropdown item → inserts `{{var}}` at the caret.
- Source toggle → switches between WYSIWYG view and raw HTML Textarea.

**Dialogs / Modals / Sheets**:
- Delete Template AlertDialog (NEW sub-flow) — destructive confirmation.
- Send Test Dialog (NEW sub-flow) — recipient email Input + optional variable overrides (rendered as inline Inputs) + "Send test email" primary button → dispatches via backend (currently toast-stub).
- Preview Modal (NEW sub-flow, missing) — "Preview" button per content version → opens a modal showing the rendered HTML in phone/desktop frame toggle.
- Template Versioning Sheet (NEW sub-flow, missing) — "Version history" button → right-side Sheet with timeline of past versions + per-version "Restore" + "Compare to current" actions.

---

## 210. Notifications Management (view-id: `notifications-management`) [EXISTING]

**Purpose**: List scheduled / targeted notifications shown in the trader dashboard. Inline Active Switch, Edit navigation, AlertDialog-gated Delete, with bulk activate/deactivate and per-notification delivery stats.

**Layout** (top-to-bottom):
1. PageHeader — title "Notifications Management", description, action: "Add Notification" (primary).
2. KPI row (4 MetricCards) — Total Notifications, Active, Scheduled, Expired.
3. Filter bar — bordered strip with Filter icon + count, search Input, active-status Select, Clear button.
4. Notifications DataTable — paginated, sortable.

**Tables**:
- Notifications table: Title (text), Start Time (date with CalendarClock icon), End Time (date), Is Active (inline Switch), Priority (numeric, sortable), Target Audience (badge) | per-row: Edit (Pencil icon) + Delete (Trash2 icon, AlertDialog-gated)

**Forms**:
- (None on this page — Notification Edit form lives on `notification-edit` page.)

**Actions**:
- "Add Notification" → `navigate("notification-edit", { id: "new" })`.
- Per-row click or "Edit" → `navigate("notification-edit", { id: notification.id })`.
- Per-row inline Switch → toggles `isActive` + persists to notifications store + toast "Notification activated / deactivated".
- Per-row "Delete" → opens Delete Notification AlertDialog.
- Bulk activate / bulk deactivate (NEW sub-flow, missing) — when ≥1 row selected via checkbox column, shows action bar with "Activate {N}" + "Deactivate {N}" + "Delete {N}" buttons.
- "Duplicate notification" (NEW sub-flow, missing) — 3-dot menu item per row → clones notification with "-copy" suffix.

**Dialogs / Modals / Sheets**:
- Delete Notification AlertDialog (trigger: per-row Delete) → AlertDialogContent: title "Delete notification?", description "Notification {title} will be removed permanently. Cannot be undone." Footer Cancel + "Delete notification" (destructive).
- Preview-as-trader Modal (NEW sub-flow, missing) — 3-dot menu item "Preview as trader" → opens a modal with a trader persona Select + rendered notification card preview as the trader would see it.
- Per-Notification Delivery Stats Sheet (NEW sub-flow, missing) — 3-dot menu item "Delivery stats" → right-side Sheet with sent count, open rate, click rate, bounce rate, per-channel breakdown chart.

---

# Batch 43 — Notifications + Certificates Cluster (Screens 211-215)

## 211. Notification Edit (view-id: `notification-edit`) [EXISTING]

**Purpose**: Create/edit form for a scheduled notification. Basic info + time settings + collapsible User Segment (targeting rules) + preview area + Save variants.

**Layout** (top-to-bottom):
1. PageHeader — title "Edit Notification" or "New Notification", description, action: "Back to Notifications" outline button.
2. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked SectionCards: Basic Information, Time Settings, User Segment (Collapsible).
   - Right column — Preview Card showing how the notification will appear in the trader dashboard.
3. Action bar (sticky bottom): "Delete" (destructive outline) + "Save and add another" (outline) + "Save and continue editing" (outline) + "Send Now" (outline, NEW) + "Save" (primary).

**Forms**:
- Basic Information: Title (Input, required), Content (Textarea, 4 rows), Is Active (Switch), Priority (number Input, sortable on the list).
- Time Settings: Start Date (date Input), Start Time (time Input), End Date (date Input), End Time (time Input), "Runs indefinitely" (Checkbox — disables end date/time when checked).
- User Segment (Collapsible, collapsed by default): Target Audience (Select — All Traders / Funded Only / New Users / Affiliates / Competition Users), 6 tri-state rules (Account Purchased, Competition User, Has Approved Payout, Fund Accounts Only, Has Failed Accounts — each Any/Yes/No Select), Account Size Min (number Input), Account Size Max (number Input).

**Actions**:
- "Save" → toast "Notification saved" + `navigate("notifications-management")`.
- "Save and add another" → save + reset form.
- "Save and continue editing" → save + keep state.
- "Send Now" (NEW) → opens Send Now AlertDialog (broadcast immediately to current segment).
- "Delete" → opens Delete Notification AlertDialog.
- "Back to Notifications" → `navigate("notifications-management")`.

**Dialogs / Modals / Sheets**:
- Delete Notification AlertDialog (trigger: "Delete" button) — destructive confirmation.
- Send Now AlertDialog (NEW sub-flow, missing) — title "Broadcast this notification now?", description "{N} traders in the current segment will receive it immediately." Footer Cancel + "Send now" (primary).
- Audience Size Estimator Sheet (NEW sub-flow, missing) — "Estimate audience" button → right-side Sheet showing the live count of matching traders for the current segment rules + breakdown by country / plan / phase.
- Preview-as-Specific-Trader Modal (NEW sub-flow, missing) — "Preview as trader" → trader Select + rendered card preview for that specific trader (with their personalization variables resolved).

---

## 212. Certificate Management (view-id: `certificate-management`) [EXISTING]

**Purpose**: Two tabs — Templates (DataTable + master/detail editor) and Fonts (list of certificate fonts with add / select / delete).

**Layout** (top-to-bottom):
1. PageHeader — title "Certificate Management", description.
2. Tabs (templates / fonts) — `TabsList` with two triggers.
3. Templates tab content — master/detail grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left card — DataTable of certificate templates.
   - Right card — Empty state, or `TemplateDetailPanel`.
4. Fonts tab content — list of fonts with "Add Font" button (navigates to `certificate-font-upload`).

**Tables**:
- Templates table: Name (text), Description (truncated, tooltip), Trigger (StatusBadge — passed/funded/won), Layout (StatusBadge — standard/premium/trophy), Active (Switch) | per-row: Edit (Pencil), Delete (Trash2)
- Fonts list: Name, Font Path, Category, Last Modified | per-row: Select (radio), Delete (Trash2)

**Forms**:
- TemplateDetailPanel (right panel): Name (Input), Description (Textarea), Trigger Event (Select: challenge.passed / challenge.funded / competition.won), Layout (Select: standard / premium / trophy), Active (Switch), Preview placeholder, "Save Template" primary button + "Open Visual Designer" outline button (navigates to `certificate-template-designer`).

**Actions**:
- "Add Template" (Templates tab) → **navigates to `certificate-template-designer`** (NEW — currently toast-stub).
- "Add Font" (Fonts tab) → **navigates to `certificate-font-upload`** (NEW — currently toast-stub).
- Per-row "Edit" or row click (Templates tab) → selects template; right panel renders editor.
- Per-row "Delete" → opens Delete Template AlertDialog (NEW sub-flow).
- "Save Template" → toast "Certificate template saved".
- "Open Visual Designer" → `navigate("certificate-template-designer", { id: template.id })`.
- Per-font "Select" → sets as the active font.
- Per-font "Delete" → opens Delete Font AlertDialog.
- "Duplicate template" (NEW sub-flow, missing) — 3-dot menu item per template → clones with "-copy" suffix.
- "Preview template" (NEW sub-flow, missing) — "Preview" button → opens a modal with the rendered certificate using sample data.

**Dialogs / Modals / Sheets**:
- Delete Template AlertDialog (NEW sub-flow) — destructive confirmation.
- Delete Font AlertDialog (NEW sub-flow) — destructive confirmation; if font is in use by any template, shows warning + lists affected templates.
- Template Preview Modal (NEW sub-flow) — rendered certificate image using sample trader data.

---

## 213. Certificate Template Designer (view-id: `certificate-template-designer`) [EXISTING]

**Purpose**: Visual designer for a single certificate template — image upload + live preview pane showing the uploaded image as background with sample field text overlaid at the configured X/Y positions + editable fields table.

**Layout** (top-to-bottom):
1. PageHeader — title "Certificate Template Designer", description, action: "Back to Templates" outline button.
2. Two-column grid (`lg:grid-cols-[1fr_1.4fr]`):
   - Left column — stacked sections: Template Image upload, Output Format dropdown, "Open Visual Designer" button (currently toast-stub — should be removed or replaced with a real "full-screen editor" mode), Editable fields table + "Add Field" button.
   - Right column — Live Preview pane showing the uploaded image with sample field text overlaid at X/Y positions.
3. Action bar (sticky bottom): "Reset to Default" (outline) + "Save Template" (primary).

**Tables**:
- Fields table: Field Name (Input), Value Template (Input), Text Case (Select: uppercase/lowercase/title/none), Shorten Over (number Input — char limit), Date Format (Select: none / DD/MM/YYYY / MM/DD/YYYY / YYYY-MM-DD / Month DD, YYYY), Font (Select: Montserrat-Bold / Arial / Times New Roman / Roboto / Georgia), Font Size (number Input), Font Color (color Input), X (number Input), Y (number Input) | per-row: Delete (Trash2 icon)

**Forms**:
- Image upload section: file Input (accept image/*), preview thumbnail with "Replace" + "Remove".
- Output Format: Select (PNG / PDF / SVG).
- Per-field row: all 10 fields listed above (each row in the table is itself a form).

**Actions**:
- "Add Field" → appends a new row with defaults (`defaultField(id)`).
- Per-row "Delete" → removes the field from the array.
- "Save Template" → toast "Template saved".
- "Reset to Default" → restores the 4 default fields (Trader Name, Challenge, Date, Account Size).
- "Back to Templates" → `navigate("certificate-management")`.
- Field reordering (NEW sub-flow, missing) — drag handle on each row + up/down arrow buttons to reorder the field stack.
- Zoom controls (NEW sub-flow, missing) — zoom in / out / fit buttons on the preview pane.
- Export Template as JSON (NEW sub-flow, missing) — "Export" button → downloads `{templateId}.json` with all field config.

**Dialogs / Modals / Sheets**:
- (None currently — "Open Visual Designer" is a toast-stub; should either be removed or open a full-screen editor modal with the same fields but a larger preview canvas.)

---

## 214. Certificate Detail (view-id: `certificate-detail`) [EXISTING]

**Purpose**: Single issued certificate view + edit form. Read-only by default with an "Edit" toggle that unlocks editable fields (Certificate Type, Template, Linked Withdrawal, Status). Account / Trader Name / Challenge Name / Created Date / Certificate URL remain read-only.

**Layout** (top-to-bottom):
1. Breadcrumb — "Certificates / {certificate.id}" with link back to `certificates-issued`.
2. Header row — Award icon tile + title "Certificate" + status badge (ExplainableStateBadge) + "Edit" toggle button (primary when editing, outline when not) + "Copy URL" outline button.
3. Form grid (`lg:grid-cols-2`):
   - Read-only section — Account, Trader Name, Challenge Name, Created Date, Certificate URL.
   - Editable section — Certificate Type (Select), Template (Select), Linked Withdrawal (Select), Status (Select: valid / expired / revoked).
4. Action bar — "Delete Certificate" (destructive outline, AlertDialog) on the left + Save variants on the right.

**Forms**:
- Read-only form: Account, Trader Name, Challenge Name, Created Date, Certificate URL — all `Input` with `readOnly` attribute.
- Editable form: Certificate Type (Select), Template (Select — populated from `getCertificateTemplates()`), Linked Withdrawal (Select — populated from `getWithdrawalOptions(cert)`), Status (Select).

**Actions**:
- "Edit" toggle → flips `isEditing` state; editable fields become enabled.
- "Save" → toast "Certificate saved".
- "Save and add another" → save + reset form to new certificate layout.
- "Save and continue editing" → save + keep state.
- "Copy URL" → `navigator.clipboard.writeText(cert.certUrl)` + toast "Certificate URL copied".
- "Delete Certificate" → opens Delete Certificate AlertDialog.
- "Re-Send email" (NEW sub-flow, missing) — outline button → opens Re-Send Email Dialog with recipient email + message + "Send" button.
- "Replace certificate image" upload (NEW sub-flow, missing) — file input → uploads a new image for this issued certificate.

**Dialogs / Modals / Sheets**:
- Delete Certificate AlertDialog (trigger: "Delete Certificate" button) → AlertDialogContent with ShieldAlert icon + title "Delete this certificate?", description "The certificate will be permanently revoked. The trader will receive an email notification. Cannot be undone." Footer Cancel + "Delete permanently" (destructive). On Confirm → toast + `navigate("certificates-issued")`.
- Certificate Preview Modal (NEW sub-flow, missing) — "Preview" button → modal with rendered certificate image (PNG) using actual trader data.
- Re-Send Email Dialog (NEW sub-flow, missing) — recipient email (pre-filled), custom message Textarea, "Send email" primary button.
- Per-Certificate Audit Trail Sheet (NEW sub-flow, missing) — "Audit trail" button → right-side Sheet with timeline of issue / view / email / status change events.

---

## 215. Certificates Issued (view-id: `certificates-issued`) [EXISTING]

**Purpose**: Searchable list of certificates awarded to traders for passing challenges and reaching milestones. KPI row + search + filters + DataTable with 3-dot menu actions.

**Layout** (top-to-bottom):
1. PageHeader — title "Certificates Issued", description, actions: "Export CSV" (outline) + "Issue Certificate" (primary).
2. KPI row (4 MetricCards) — Total Issued, Valid, Expired, Revoked.
3. Filter bar — bordered strip: Filter icon + count, search Input (trader name / email / certificate type), Certificate Type Select, Status Select, Clear button, "{n} of {m} certificates" counter.
4. Certificates DataTable — paginated, sortable.

**Tables**:
- Certificates table: Account (email link), Trader Name (text), Certificate Type (StatusBadge), Challenge Name (text), Issue Date (date), Certificate URL (ExternalLink icon, target _blank, clickable), Status (ExplainableStateBadge) | per-row: 3-dot DropdownMenu (View / Revoke / Re-send email)

**Forms**:
- Issue Certificate Sheet (NEW — currently toast-stub; see below).

**Actions**:
- "Export CSV" → real `exportToCsv`.
- "Issue Certificate" → **opens Issue Certificate Sheet** (NEW sub-flow, currently toast-stub).
- 3-dot "View" → `navigate("certificate-detail", { id: cert.id })`.
- 3-dot "Revoke" → opens Revoke Certificate AlertDialog.
- 3-dot "Re-send email" → opens Re-Send Email Dialog (see Certificate Detail spec).
- Bulk select (NEW sub-flow, missing) — checkbox column + bulk "Revoke {N}" + "Export {N}" buttons.

**Dialogs / Modals / Sheets**:
- Revoke Certificate AlertDialog (trigger: 3-dot "Revoke") → AlertDialogContent: title "Revoke this certificate?", description "The certificate will be marked as revoked. The trader will be notified. The certificate URL will no longer render." Footer Cancel + "Revoke certificate" (destructive).
- Issue Certificate Sheet (NEW sub-flow, missing) — right-side Sheet, fields: Account (Select — populated from tenant traders), Certificate Type (Select), Template (Select), Challenge Name (Input or Select from trader's challenges), Linked Withdrawal (Select, optional), "Issue" primary button. On submit → creates a new `IssuedCertificate` + toast "Certificate issued".
- Expired Certificates Coming Up for Renewal View (NEW sub-flow, missing) — toggle button on the filter bar → filters to certificates expiring in the next 30 days.

---

# Batch 44 — Settings Detail + Settings NEW #1 Cluster (Screens 216-220)

## 216. Certificate Font Upload (view-id: `certificate-font-upload`) [EXISTING]

**Purpose**: Font management for certificate rendering. KPI row + DataTable + Upload New Font form with live `@font-face` preview rendered via injected style.

**Layout** (top-to-bottom):
1. PageHeader — title "Certificate Font Upload", description, action: "Back to Certificate Management" outline button.
2. KPI row (2 MetricCards) — Total Fonts, Active Fonts.
3. Fonts DataTable — paginated, sortable.
4. Upload New Font card — Name (Input), Font File (file Input, accept .ttf/.otf/.woff/.woff2), Font Path (Input — for referencing system fonts), live preview area rendered via injected `@font-face` rule.

**Tables**:
- Fonts table: Name (text), Font File (truncated path), Font Path (text), Last Modified (date) | per-row: Download (Download icon) + Delete (Trash2 icon, AlertDialog-gated)

**Forms**:
- Upload New Font form: Name (Input, required), Font File (file Input, accept .ttf/.otf/.woff/.woff2, with on-change → reads file as data URL → injects `@font-face` style for live preview), Font Path (Input — optional, for system font references), "Save" primary button + "Cancel" outline button.

**Actions**:
- "Save" → appends the new font to `fonts` state + toast "Font saved".
- "Cancel" → clears the form.
- Per-row "Download" → real file download of the font file (currently toast-stub — should trigger a Blob download with the original file content).
- Per-row "Delete" → opens Delete Font AlertDialog.
- "Back to Certificate Management" → `navigate("certificate-management")`.
- Per-font metadata editor (NEW sub-flow, missing) — 3-dot menu "Edit metadata" → opens Sheet with category (Sans-serif / Serif / Display / Mono), foundry, license, supported weights.
- Font subsetting / optimization (NEW sub-flow, missing) — 3-dot menu "Subset" → opens a Sheet showing glyph coverage + "Generate subset" button.

**Dialogs / Modals / Sheets**:
- Delete Font AlertDialog (trigger: per-row Delete) → AlertDialogContent: title "Delete this font?", description "The font {name} will be removed. Templates using this font will fall back to Montserrat-Bold." If `font.active && templatesUsing > 0` → additional warning listing affected templates. Footer Cancel + "Delete font" (destructive).

---

## 217. Utilities (view-id: `utilities`) [EXISTING]

**Purpose**: Management of utility links / cards surfaced in the trader dashboard (helpful resources, external links, FAQ shortcuts). KPI row + DataTable + Dialog-gated create/edit + bulk activate/deactivate.

**Layout** (top-to-bottom):
1. PageHeader — title "Utilities", description, action: "Add Utility" (primary).
2. KPI row (3 MetricCards) — Total Utilities, Active, Inactive.
3. Filter bar — bordered strip: Filter icon + count, search Input, section Select (Utility / Help / Resource / External), Clear button.
4. Utilities DataTable — paginated, sortable.

**Tables**:
- Utilities table: Title (text), Description (truncated, tooltip), Section (Badge), Link URL (truncated, ExternalLink icon, clickable), Is Active (inline Switch), Display Order (numeric, sortable) | per-row: Edit (Pencil icon) + Delete (Trash2 icon, AlertDialog-gated)

**Forms**:
- Utility Editor Dialog (right-side Dialog, see below).

**Actions**:
- "Add Utility" → opens Utility Editor Dialog in create mode.
- Per-row "Edit" → opens Utility Editor Dialog in edit mode (pre-filled).
- Per-row "Delete" → opens Delete Utility AlertDialog.
- Per-row inline Switch → toggles `isActive` + persists + toast "Utility activated / deactivated".
- "Save and add another" (NEW sub-flow, missing) — in the dialog, secondary button → saves current utility + clears form for the next.
- Bulk activate / deactivate (NEW sub-flow, missing) — checkbox column + bulk action bar.

**Dialogs / Modals / Sheets**:
- Utility Editor Dialog (trigger: "Add Utility" or per-row "Edit") → DialogContent, fields: Title (Input, required), Description (Textarea, 3 rows), Section (Select: Utility / Help / Resource / External), Link URL (Input, required, URL validation), Icon URL (Input, optional — for custom icons), Is Active (Switch), Display Order (number Input), "Save" primary button + "Cancel" outline + "Save and add another" outline (NEW).
- Delete Utility AlertDialog (trigger: per-row Delete) → AlertDialogContent: title "Delete this utility?", description "The utility {title} will be removed from the trader dashboard." Footer Cancel + "Delete utility" (destructive).
- Icon Upload (NEW sub-flow, missing) — file input → uploads a custom icon for the utility card.
- Display Order drag-and-drop (NEW sub-flow, missing) — "Reorder" mode toggle → rows become draggable; on drop, persists new order.
- Preview-as-Trader Modal (NEW sub-flow, missing) — "Preview as trader" → modal showing how the utility cards render in the trader dashboard.

---

## 218. Roles Management (view-id: `roles-management`) [EXISTING]

**Purpose**: First-class RBAC workspace with 4 tabs — Roles (cards with CRUD), Permission Matrix (roles × permissions grid), Team Assignments (who holds what), My Access (current user's effective access).

**Layout** (top-to-bottom):
1. PageHeader — title "Roles & Permissions", description, actions: "Invite Member" (outline, permission-gated) + "New Role" (primary, permission-gated).
2. KPI row (4 MetricCards) — Active Roles, Custom Roles, Distinct Permissions Granted, Members in scope.
3. Filter bar — Scope Select (All / Prop firm staff / Platform staff / Trader app), Type Select (All / System / Custom), search Input.
4. Tabs (roles / matrix / assignments / my-access) — `TabsList` with 4 triggers.

**Tabs**:

**Roles tab** — grid of role Cards (1/2/3 columns responsive), each card with:
- Role color dot + name + application badge + system/custom badge.
- Description.
- Member count (live from `memberCount(role)`).
- Permission count.
- Color dot + 3-dot DropdownMenu (Edit / Duplicate / Delete).
- "View members" link → filters Team Assignments tab.

**Permission Matrix tab** — grid of roles × permission categories. Cell shows ✓ (granted) / — (not granted). Cell click → **opens grant/revoke confirmation AlertDialog** (NEW sub-flow, currently toast-stub).

**Team Assignments tab** — DataTable of `(user, role)` assignments: User (avatar + name + email), Role (color dot + name), Application (badge), Assigned (date + assigned-by), Status (ExplainableStateBadge), Expiry (date) | per-row: Edit Role Assignment Sheet + Remove AlertDialog.

**My Access tab** — current user's effective access: roles held + permissions list (categorized) + recent access changes timeline.

**Forms**:
- RoleEditorDialog (NEW dialog, see below) — fields: Name, Description, Application (Select), Color (preset palette), System (read-only), Permissions (PermissionPicker — category-grouped searchable checkbox list).

**Actions**:
- "New Role" → opens `RoleEditorDialog` in create mode.
- "Invite Member" → opens `InviteUserSheet`.
- Per-role 3-dot "Edit" → opens `RoleEditorDialog` in edit mode.
- Per-role 3-dot "Duplicate" → `duplicateRole(roleId)` + toast.
- Per-role 3-dot "Delete" → opens `DeleteRoleDialog` (blocked if role has members).
- Per-role "View members" → sets scope filter + switches to Team Assignments tab.
- Matrix cell click → opens grant/revoke AlertDialog.
- Per-assignment "Edit" → opens `EditRoleAssignmentSheet`.
- Per-assignment "Remove" → opens Remove AlertDialog.
- "Export role as JSON" (NEW sub-flow, missing) — 3-dot menu item per role → downloads `{roleId}.json` with the role definition.
- Role template library (NEW sub-flow, missing) — "Templates" button → opens Sheet with predefined role templates (Compliance Officer, Risk Manager, Support Agent, etc.) → "Create from template" → opens RoleEditorDialog pre-filled.
- Per-role audit timeline (NEW sub-flow, missing) — 3-dot menu "Audit timeline" → opens Sheet with timeline of all changes to this role.
- Compare roles diff (NEW sub-flow, missing) — select two roles via checkboxes + "Compare" button → opens diff modal showing which permissions differ.
- Bulk permission grant (NEW sub-flow, missing) — checkbox column in matrix + bulk action bar.

**Dialogs / Modals / Sheets**:
- RoleEditorDialog (trigger: "New Role" or per-role Edit) → DialogContent: Name (Input, required), Description (Textarea), Application (Select — prop-admin / super-admin / trader), Color (preset palette swatches + custom color input), System badge (read-only display), PermissionPicker (searchable ScrollArea with category-accordions, each category shows checkboxes for its permissions), "Save role" primary button + "Cancel" outline. On Save → `createRole` / `updateRole` mutation + toast.
- RoleDetailDialog (trigger: per-role "View" or row click) → DialogContent: full permission list (grouped by category, color-coded), member management (list of users holding the role + Remove buttons), "Edit" outline button, danger zone with "Delete role" destructive button.
- DeleteRoleDialog (trigger: per-role Delete) → AlertDialogContent: title "Delete role {name}?", description "Members holding this role will lose its permissions." If `memberCount > 0` → blocked with "Reassign or remove members first" message + list of affected members. Footer Cancel + "Delete role" (destructive).
- Grant/Revoke Permission AlertDialog (NEW sub-flow, missing, matrix cell click) → AlertDialogContent: title "Grant permission to role?", description "Role {roleName} will gain {permissionId}. This will be recorded in the role audit log." Footer Cancel + "Grant" / "Revoke" (primary).
- Per-Role Audit Timeline Sheet (NEW sub-flow, missing) — right-side Sheet with timeline of role.created / role.updated / role.deleted / role.assigned / role.revoked / permission.granted / permission.revoked events filtered to this role.
- Compare Roles Diff Modal (NEW sub-flow, missing) — modal showing side-by-side role A vs role B with permission diff (only-in-A / only-in-B / in-both).

---

## 219. CSV Import Dialog (view-id: `csv-import-dialog`) [NEW]

**Purpose**: Multi-step CSV import dialog for bulk-adding users to `user-management`. Upload → preview parsed rows → map columns → confirm → import.

**Layout** (top-to-bottom, rendered inside a Dialog):
1. Step indicator — 4 steps: Upload → Map Columns → Preview → Confirm.
2. Step content area — varies by current step.
3. Footer action bar — Back (outline) + Next/Confirm (primary).

**Forms** (per step):
- Upload step: Drag-and-drop zone (accept .csv), "Browse" button, file name + size + first-N-lines preview, "Continue" button.
- Map Columns step: Two-column mapping — Left: CSV column names. Right: target field Select (Name, Email, Role, Status, etc.). Auto-match by header name where possible.
- Preview step: Read-only DataTable with first 20 parsed rows (mapped to target fields) + count of valid / invalid rows + per-row error badges (e.g., "Invalid email", "Missing required field").
- Confirm step: Summary card — "{N} users to import · {M} valid · {K} invalid (skipped)". "Send invite email to new users" Switch. "Import" primary button.

**Actions**:
- "Browse" → opens file picker.
- "Continue" (Upload step) → parses CSV client-side (Papa Parse or similar) → advances to Map step.
- "Continue" (Map step) → applies mapping → advances to Preview step.
- "Back" → returns to previous step.
- "Import" (Confirm step) → `bulkInviteUsers(mappedRows, sendInviteEmail)` + toast "{N} users imported" + closes dialog.
- "Cancel" → closes dialog without saving.

**Dialogs / Modals / Sheets**:
- (Self-contained Dialog — no nested modals.)

---

## 220. Add Group Sheet (view-id: `add-group-sheet`) [NEW]

**Purpose**: Right-side Sheet for creating a new user group in `group-management`. Captures name, description, color, default members, and inherited permissions.

**Layout** (top-to-bottom, inside a right-side Sheet):
1. SheetHeader — UserPlus icon + title "Add Group" + description "Create a new group for bulk actions, reporting, or risk monitoring."
2. Body (ScrollArea) — stacked form fields.
3. SheetFooter — Cancel (ghost) + "Create group" (primary, disabled until required fields filled).

**Forms**:
- Group Name (Input, required, maxLength 64).
- Description (Textarea, 3 rows, optional).
- Color (preset palette — 8 swatches matching the Terra palette + custom color input).
- Group Type (Select: Static / Dynamic / Risk-monitoring — Dynamic groups auto-populate from rules; Risk-monitoring groups auto-add breached/suspended traders).
- Initial Members (multi-select Input with search + chip list — populated from tenant users).
- Inherited Permissions (optional, collapsible) — Checkbox list of permissions all group members will inherit on top of their own role permissions.
- Auto-add rules (conditional, visible when Type=Dynamic) — Tri-state rules (similar to notification-edit's User Segment): Account Purchased, Competition User, Has Approved Payout, Fund Accounts Only, Has Failed Accounts.

**Actions**:
- "Create group" → validates Name + initial members + `addGroup({ name, description, color, type, memberIds, inheritedPermissions })` + toast "Group {name} created with {N} members".
- "Cancel" → closes Sheet.
- Member chip "X" → removes from selected list.
- Color swatch click → selects preset.
- Custom color input → opens color picker.

**Dialogs / Modals / Sheets**:
- (Self-contained Sheet — no nested modals. Validation toasts appear inline as error text under the relevant field.)

---

# Batch 45 — Settings NEW #2 + Super-Admin Start (Screens 221-225)

## 221. Add KYC Provider Marketplace (view-id: `kyc-provider-marketplace`) [NEW]

**Purpose**: Modal marketplace for browsing and connecting new KYC providers — Sumsub, Onfido, Veriff, Identity Pass, Jumio, etc. — with comparison and one-click connect.

**Layout** (top-to-bottom, rendered inside a full-screen Dialog):
1. DialogHeader — title "KYC Provider Marketplace" + description + search Input + close (X) button.
2. Filter bar — Categories (Identity Verification / Biometric / Document-only / AML Screening / Watchlist), Pricing model (Per-verification / Monthly / Hybrid), Region (Global / EU / US / APAC / MENA), "Compare" toggle.
3. Provider cards grid (1/2/3 columns responsive) — each card with: provider logo + name + category badge + pricing model + region + 3 feature bullets + approval rate metric + avg processing time + "View details" outline + "Connect" primary.
4. Compare tray (conditionally rendered when 2-3 providers selected) — side-by-side comparison table.

**Forms**:
- (No form on this dialog — connecting happens via the provider's edit sheet.)

**Actions**:
- Search Input → filters provider cards.
- Filter bar Selects → filter by category / pricing / region.
- Provider card "View details" → opens Provider Detail Sheet (right-side Sheet with full description, pricing breakdown, supported document types, integration guide link, customer references).
- Provider card "Connect" → opens Edit Provider Sheet (same as in `kyc-providers`) pre-filled with this provider's defaults + API key input empty.
- "Compare" toggle → enables comparison mode; checkboxes appear on each card; selecting 2-3 shows the compare tray at the bottom.
- "Close" → closes the marketplace dialog.

**Dialogs / Modals / Sheets**:
- Provider Detail Sheet (trigger: "View details" on a card) — right-side Sheet: provider logo + name + tagline + description (Markdown), supported documents (Badges), supported countries (Badges), pricing breakdown table, integration guide link, SLA terms, "Connect" primary button + "Close" outline.
- Edit Provider Sheet (trigger: "Connect" on a card) — same shape as `kyc-providers` Edit Sheet, pre-filled with the marketplace provider's defaults. On Save → adds to the `kyc-providers` list + toast "{Provider} connected".

---

## 222. Per-User Audit Timeline — Settings Context (view-id: `user-audit-timeline`) [NEW]

**Purpose**: Unified per-user audit timeline showing every action a specific user (admin or trader) has performed or has been performed on them — login events, role assignments, permission changes, profile updates, etc. Accessed from Team Members "View Activity", User Management "View", Roles Management "Team Assignments" per-row.

**Layout** (top-to-bottom):
1. Breadcrumb — "Team Members / {user.name} / Activity" or "User Management / {user.name} / Activity" depending on entry point.
2. Header row — User avatar + name + email + status badge + role badges + "Export Activity CSV" outline button + "Back" outline button.
3. Filter bar — Date Range Select (24h / 7d / 30d / 90d / All), Action Type Select (login / role.assigned / role.revoked / permission.granted / permission.revoked / profile.updated / session.revoked / password.changed / 2fa.enabled), Severity Select (All / Info / Warning / Critical), Search Input (summary text).
4. KPI row (3 MetricCards) — Total Events, Critical Events, Events in last 24h.
5. Timeline list — vertical timeline with per-event: timestamp, action badge, severity badge, actor avatar + name, summary text, "View details" expand button.

**Tables**:
- (No DataTable — this is a timeline list, not a table. Each event is a Card in a vertical `space-y-3` list with a left-side timeline line connecting the icon dots.)

**Forms**: none.

**Actions**:
- Filter bar Selects + search → drive the filtered timeline.
- "Export Activity CSV" → real `exportToCsv(filteredEvents, columns, "user-activity-{userId}.csv")`.
- "Back" → returns to the previous screen (`navigate("team-members")` or `navigate("user-management")`).
- Per-event "View details" → expands inline to show the structured changes[] diff (before / after JSON).
- Per-event "View actor profile" → opens actor's profile in a new tab/dialog (NEW sub-flow).
- Per-event "Create incident from this event" (visible for critical events only) → opens Incident Management Sheet (cross-link to Super-Admin).

**Dialogs / Modals / Sheets**:
- Event Detail Expansion (inline) — per-event expandable Card showing full structured changes[] diff + actor IP + user agent + session ID.
- Actor Profile Dialog (NEW sub-flow, missing) — clicking the actor avatar opens a Dialog with actor name, email, roles, last active, and recent activity (5 most recent events by the actor).

---

## 223. Device Detail View (view-id: `device-detail`) [NEW]

**Purpose**: Per-device fingerprint detail view accessed from `device-activities` row click. Shows login timeline, IP geo, device fingerprint attributes, linked traders, and "Block device" / "Force logout all sessions" actions.

**Layout** (top-to-bottom):
1. Breadcrumb — "Device Activities / {deviceId.slice(0,16)}…" with back link.
2. Header row — Fingerprint icon tile + monospace device hash + source badge + device type badge + platform badge + "Block device" destructive outline button + "Mark as trusted" outline button.
3. KPI row (4 MetricCards) — Login Count, First Seen, Last Seen, Unique Trader Logins.
4. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — Login Timeline Card (vertical timeline of every login event for this device).
   - Right column — stacked Cards: IP Geo (Google Maps embed or static map image of last known IP), Device Fingerprint Attributes (browser, OS, screen resolution, timezone, languages), Linked Traders (list of traders who have logged in from this device with cross-reference links).

**Tables**:
- Linked traders table: Trader (avatar + name + email, clickable to trader-detail), Login Count (numeric), First Login (date), Last Login (date), Status (StatusBadge) | per-row: View (Eye icon — opens trader-detail)

**Forms**: none.

**Actions**:
- "Block device" → opens Block Device AlertDialog.
- "Mark as trusted" → opens Mark as Trusted Confirm Dialog (simpler confirmation).
- "Force logout all sessions" (NEW sub-flow, missing) → outline button → opens Force Logout AlertDialog.
- Per-trader row click → `navigate("trader-detail", { id: trader.id })`.
- "Export device history CSV" → `exportToCsv(events, "device-history-{deviceId}.csv")`.

**Dialogs / Modals / Sheets**:
- Block Device AlertDialog (trigger: "Block device" button) → AlertDialogContent: title "Block this device?", description "Fingerprint {hash} will be blocked. All active sessions from this device will be terminated. The next login attempt will be rejected. Cannot be undone without admin intervention." Footer Cancel + "Block device" (destructive).
- Mark as Trusted Confirm Dialog (trigger: "Mark as trusted" button) → simpler AlertDialogContent: title "Mark as trusted?", description "This device will skip enhanced verification on future logins." Footer Cancel + "Mark as trusted" (primary).
- Force Logout AlertDialog (NEW sub-flow, missing) → title "Force logout all sessions?", description "All active sessions from this device across all users will be immediately terminated." Footer Cancel + "Force logout" (destructive).

---

## 224. Settings Module Detail (view-id: `settings-module-detail`) [NEW]

**Purpose**: Per-module detail view accessed from the Settings Landing "Modules" tab (when the operator clicks a module card). Shows the module's manifest info, configuration schema, enabled features, dependencies, version, and per-tenant adoption.

**Layout** (top-to-bottom):
1. Breadcrumb — "Settings / Modules / {module name}" with back link.
2. Header row — Module icon tile + name + version badge + category badge + "Enable" / "Disable" primary toggle button + "Configure" outline button (if the module exposes configuration).
3. KPI row (4 MetricCards) — Permissions Count, Adopting Tenants, Dependencies Count, Version.
4. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked Cards: Manifest Details (description, category, supported applications, dependencies), Permissions List (Badges for each declared permission), Configuration Schema (JSON viewer showing the schema).
   - Right column — stacked Cards: Adoption by Tenant (mini-table or progress bars showing which tenants have it enabled), Recent Changes (changelog for this module — last 5 entries), "Open module" primary button → navigates to the module's primary view.

**Tables**:
- Permissions list table (read-only): Permission ID (monospace), Label, Description | no per-row actions.
- Adoption by tenant table (read-only): Tenant (name + initials badge), Enabled? (StatusBadge), Enabled At (date), Plan (badge) | per-row: View (opens tenant-detail).

**Forms**: none.

**Actions**:
- "Enable" / "Disable" primary toggle → opens Enable/Disable AlertDialog with explicit consequence text ("Sidebar and dashboard will recompose live; permissions from this module will become available / unavailable to all roles").
- "Configure" → opens Module Configuration Sheet (right-side Sheet with the module's configuration form).
- "Open module" → `navigate(modulePrimaryViewId)`.

**Dialogs / Modals / Sheets**:
- Enable/Disable Module AlertDialog (trigger: "Enable" / "Disable" toggle) → AlertDialogContent: title "Enable module {name}?" or "Disable module {name}?", description with explicit consequences (visible navigation changes, affected permissions, dependent modules if disabling). Footer Cancel + "Confirm" (primary or destructive depending on action).
- Module Configuration Sheet (trigger: "Configure" button) → right-side Sheet rendering the module's declared configuration schema as a form (fields vary by module — e.g., AI module exposes model + temperature + max-tokens; Trading module exposes default leverage + bridge timeouts).

---

## 225. Platform Overview (view-id: `super-overview`) [EXISTING]

**Purpose**: PFaaS platform health and tenant summary — top-level super-admin landing with KPI row, tenant distribution, and module adoption bars.

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Overview", description.
2. KPI row (4 MetricCards) — Active Tenants, Total Traders, MRR, Modules.
3. Two-column grid (`lg:grid-cols-2`):
   - Left card — Tenant Distribution (per-tenant: color square + name + plan badge + status badge).
   - Right card — Module Adoption (per-module: name + count of tenants enabled + Progress bar showing % adoption).

**Tables**: none (this is a dashboard, not a list).

**Forms**: none.

**Actions**:
- "Create tenant" CTA (NEW sub-flow, missing) — primary button in PageHeader → `navigate("create-tenant")`.
- Tenant distribution row click (NEW sub-flow, missing) → `navigate("tenant-detail", { id: tenant.id })`.
- Module adoption bar click (NEW sub-flow, missing) → `navigate("module-catalog")` filtered to that module, or `navigate("module-detail", { id: moduleId })`.
- "Subscribe to platform alerts" (NEW sub-flow, missing) — outline button → opens Subscription Sheet with severity checkboxes + Slack webhook input.
- MRR trend chart (NEW sub-flow, missing) — click the MRR card → expands inline sparkline chart of MRR over last 12 months.
- Health alerts banner (NEW sub-flow, missing) — banner above the KPI row when any service is degraded; clicking opens Incident Management.
- Platform-wide activity feed (NEW sub-flow, missing) — Card below the two-column grid showing the last 20 platform-level events (tenant created, module enabled, etc.).

**Dialogs / Modals / Sheets**:
- Subscribe to Platform Alerts Sheet (NEW sub-flow, missing) — right-side Sheet: severity checkboxes (Info / Warning / Critical), channels (Email / Slack / SMS), webhook URL Input, "Subscribe" primary button.
- MRR Trend Chart Inline Expansion (NEW sub-flow, missing) — clicking the MRR MetricCard expands an inline Sparkline + monthly breakdown table.

---

# Batch 46 — Super-Admin Tenant Cluster (Screens 226-230)

## 226. Tenants (view-id: `tenants`) [EXISTING]

**Purpose**: Tenant directory — searchable, filterable DataTable of all tenants on the platform. Row click → tenant-detail. View / Lifecycle / Create actions.

**Layout** (top-to-bottom):
1. PageHeader — title "Tenants", description "{N} tenants on the platform.", actions: "Lifecycle" (outline) + "Create tenant" (primary).
2. DataTable with built-in search + filter toolbar.

**Tables**:
- Tenants table: Tenant (initials tile + name + tagline), Plan (badge), Status (StatusBadge), Modules (count), Features (count), Currency (text), Created (date) | per-row: View (outline button) + 3-dot menu (Impersonate / Suspend / Terminate — NEW sub-flow, missing)

**Forms**: none.

**Actions**:
- "Lifecycle" → `navigate("tenant-lifecycle")`.
- "Create tenant" → `navigate("create-tenant")`.
- Per-row click or "View" → `navigate("tenant-detail", { id: tenant.id })`.
- Per-row 3-dot "Impersonate" (NEW sub-flow, missing) → opens Impersonate Tenant AlertDialog → on confirm, switches to that tenant's context + logs the impersonation event in the audit trail.
- Per-row 3-dot "Suspend" / "Terminate" (NEW sub-flow, missing) → opens Suspend/Terminate AlertDialog.
- Bulk actions (NEW sub-flow, missing) — checkbox column + bulk "Suspend {N}" + "Export {N}" + "Terminate {N}" buttons.
- "Export CSV" (NEW sub-flow, missing) — outline button → real `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Impersonate Tenant AlertDialog (NEW sub-flow, missing) → title "Impersonate {tenant.name}?", description "You will be logged in as this tenant. Every action you take will be recorded in the impersonation audit trail. You can exit impersonation from the topbar." Footer Cancel + "Impersonate" (primary, with warning icon).
- Suspend Tenant AlertDialog (NEW sub-flow, missing) → title "Suspend this tenant?", description "All tenant users will lose access immediately. Billing will pause. The action is reversible." Footer Cancel + "Suspend tenant" (destructive variant).
- Terminate Tenant AlertDialog (NEW sub-flow, missing) → title "Terminate this tenant?", description "Permanent. All tenant data will be archived after 30 days. The tenant cannot be reactivated." Footer Cancel + "Terminate tenant" (destructive).

---

## 227. Module Catalog (view-id: `module-catalog`) [EXISTING]

**Purpose**: Read-only catalog of all modules available on the platform — module cards with version, category, adopter count, supported applications, and declared permissions.

**Layout** (top-to-bottom):
1. PageHeader — title "Service Catalog", description "All modules available on the platform."
2. Module cards grid (1/2/3 columns responsive).

**Per-card content**:
- Module icon tile (with module's `accentColor` background at low opacity).
- Name + version badge.
- Category text.
- Description.
- Adopter count ("{N} tenants").
- Supported application badges.
- First 4 declared permissions as Badge chips.

**Forms**: none.

**Actions**:
- Card click (NEW sub-flow, missing) → `navigate("module-detail", { id: moduleId })`.
- Search Input (NEW sub-flow, missing) — in PageHeader actions area.
- "Enable for all tenants" bulk action (NEW sub-flow, missing) — per-card "Enable for all" button → opens Platform-wide Module Enable/Disable AlertDialog.
- Per-module version history (NEW sub-flow, missing) — 3-dot menu "Version history" → opens Sheet with changelog.

**Dialogs / Modals / Sheets**:
- Platform-wide Module Enable/Disable AlertDialog (NEW sub-flow, missing) → see Batch 49.
- Module Version History Sheet (NEW sub-flow, missing) → right-side Sheet with version-by-version changelog.

---

## 228. Platform Health (view-id: `platform-health`) [EXISTING]

**Purpose**: Platform service status — KPI row (uptime / latency / error rate / active sessions) + service list with per-service latency and status.

**Layout** (top-to-bottom):
1. PageHeader — title "System Health", description "Platform service status and metrics."
2. KPI row (4 MetricCards) — Uptime 30d, Avg Latency, Error Rate, Active Sessions.
3. Service status Card — list of services.

**Per-service row**:
- Service icon tile (Globe / Database / Zap / DollarSign / ShieldCheck / Cpu).
- Service name + latency text.
- Status StatusBadge (operational / degraded / down).

**Tables**: none (this is a status dashboard).

**Forms**: none.

**Actions**:
- Per-service row click (NEW sub-flow, missing) → `navigate("service-detail", { id: serviceId })`.
- Incident timeline (NEW sub-flow, missing) — Card below the service list showing recent incidents with status timeline.
- "Subscribe to status updates" (NEW sub-flow, missing) — outline button → opens Subscription Sheet (similar to Platform Overview).
- "Simulated incident drill" (NEW sub-flow, missing) — destructive outline button → opens Simulated Drill Dialog.
- Per-service metrics drill-down (NEW sub-flow, missing) — clicking a service metric (e.g., latency) opens a line chart modal showing the metric over the last 7 days.

**Dialogs / Modals / Sheets**:
- Subscribe to Status Updates Sheet (NEW sub-flow, missing) — right-side Sheet with severity checkboxes + channel checkboxes + webhook Input.
- Simulated Drill Dialog (NEW sub-flow, missing) — title "Run a simulated incident drill?", service Select, scenario Select (Latency spike / Full outage / Degraded), "Run drill" primary button → injects a fake incident into the timeline.
- Per-Service Metrics Drill-Down Modal (NEW sub-flow, missing) — full modal with line chart + table of recent metric readings.

---

## 229. Create Tenant (view-id: `create-tenant`) [EXISTING]

**Purpose**: 5-step onboarding wizard for new tenants. Step indicator + Back/Next nav + required fields marked with asterisks + smart defaults (core modules pre-selected) + review summary.

**Layout** (top-to-bottom):
1. PageHeader — title "Create Tenant", description, action: "Back to Tenants" outline button.
2. Step indicator — 5 circles (done / active / inactive) connected by bars: Basics → Branding → Modules → Admin → Review.
3. Step content area — Card with the current step's fields.
4. Footer action bar — "Back" outline (disabled on step 1) + "Next" outline (validates current step; disabled when invalid) / "Create" primary (on last step).

**Forms** (per step):
- Basics step: Tenant Name (Input, required), Slug (auto-derived, editable, uniqueness check on blur), Tagline (Input), Plan (Select: starter / growth / scale / enterprise — shows monthly cost), Currency (Select: USD / GBP / EUR / AED), Timezone (Select from 9 zones).
- Branding step: 6 brand presets (swatches labeled Preset 1–6), Primary brand swatch (color input + text), Accent swatch, Surface swatch, Border radius (Select), Initials (auto-derived from name, editable, maxLength 3), Logo URL (Input — optional).
- Modules step: List of all modules with checkbox + icon + name + optional badge + category badge + dependencies. Core modules (trading, challenges, risk, payouts, settings) pre-selected.
- Admin step: Admin Email (Input, required, email validation), Admin Name (Input, required), Initial Role (Select — defaults to Tenant Admin), "Send invite email" Switch.
- Review step: Summary Card listing all collected values in a 2-column key/value layout + "Create tenant" primary button.

**Actions**:
- "Back" → `setStep(step - 1)`.
- "Next" → `if (stepValid(step)) setStep(step + 1)`.
- "Create" → `setTenant(newTenant)` + `pushNotification({ title: "Tenant created", ... })` + toast + `navigate("tenant-detail", { id: newTenant.id })`.
- "Back to Tenants" → opens Cancel Wizard AlertDialog (NEW sub-flow, missing — currently no confirmation, just navigates away).
- Slug field blur → client-side uniqueness check against existing tenants (NEW sub-flow, missing).
- "Save Draft" (NEW sub-flow, missing) — outline button → persists the wizard state to localStorage + toast "Draft saved".
- Billing setup step (NEW sub-flow, missing) — insert a new step between Admin and Review for billing setup (credit card input via Stripe Elements + plan confirmation).
- Preview of what tenant will see (NEW sub-flow, missing) — link on the Review step → opens a Preview Modal rendering the tenant's future landing dashboard with their branding.

**Dialogs / Modals / Sheets**:
- Cancel Wizard AlertDialog (NEW sub-flow, missing) → title "Discard this tenant?", description "All entered information will be lost." Footer Cancel + "Discard" (destructive).
- Tenant Preview Modal (NEW sub-flow, missing) → modal rendering the future tenant dashboard with the chosen branding + modules.

---

## 230. Tenant Detail (view-id: `tenant-detail`) [EXISTING]

**Purpose**: Comprehensive tenant workspace with 7 tabs covering the full tenant lifecycle surface. Header + KPI row + tabs: Overview / Modules / Users / Billing / Activity / Configuration / Risk.

**Layout** (top-to-bottom):
1. PageHeader — EntityHeader with tenant initials + name + status badge + plan badge + actions: "Edit Configuration" (outline, switches to Configuration tab) + "View as tenant" (outline) + Suspend / Terminate / Reactivate dropdown (destructive).
2. KPI row (4 MetricCards) — Traders, Open Breaches, Pending Payouts, MRR.
3. Tabs (overview / modules / users / billing / activity / configuration / risk) — `TabsList` with 7 triggers.

**Tabs**:

**Overview tab** — summary Card (status, plan, created date, modules count, features count) + Module Adoption progress bars.

**Modules tab** — list of all modules with per-module Switch toggling `tenant.enabledModules`. **Live mutation** — `setTenant({ ...tenant, enabledModules })` + toast. Module click → opens Settings Module Detail (cross-link).

**Users tab** — DataTable of tenant admin/support users. Per-row actions: Edit (toast-stub → should open `EditRoleAssignmentSheet`), Remove (toast-stub → should open AlertDialog), Invite (toast-stub → should open `InviteUserSheet`). Cross-link to `team-members`.

**Billing tab** — subscription Card (plan, MRR, next billing date, payment method) + Plan Change dropdown (toast-stub → should open Plan Change AlertDialog) + Invoice history (toast-stub → should render real invoice DataTable with download) + "Generate invoice" outline button (toast-stub → should open Generate Invoice Sheet).

**Activity tab** — recent audit timeline (`ActivityTimeline` component, last 12 events).

**Configuration tab** — edit form for tenant settings (name, currency, timezone, branding presets, primary brand swatch, accent swatch, surface swatch, radius, initials, terminology). "Save" → real `setTenant` mutation + toast.

**Risk tab** — risk summary Card (open breaches count, pending payouts count, AML risk score) + "Open risk workspace" outline button (toast-stub → should `navigate("risk")` filtered to this tenant) + "View open breaches" outline button (toast-stub → should `navigate("risk")` filtered to breaches) + "Export risk report" outline button (toast-stub → should trigger PDF download).

**Tables**:
- Users tab table: User (avatar + name + email), Role (color dot + name), Assigned (date), Status (StatusBadge) | per-row: 3-dot menu (Edit / Remove / View activity)

**Forms**:
- Configuration tab form: Name, Currency, Timezone, Branding (color presets + custom), Terminology (8 inputs).
- Plan Change form (see below).
- Generate Invoice form (see below).

**Actions**:
- "Edit Configuration" → switches to Configuration tab.
- "View as tenant" → `setTenant(localTenant)` + `setUser(...)` with preview-user + toast + navigates to tenant's overview.
- "Suspend" → opens Suspend Tenant AlertDialog.
- "Terminate" → opens Terminate Tenant AlertDialog.
- "Reactivate" → opens Reactivate Tenant AlertDialog.
- Module Switch (Modules tab) → `setTenant` mutation + toast.
- Users tab per-row "Edit" → opens `EditRoleAssignmentSheet` (NEW — currently toast-stub).
- Users tab per-row "Remove" → opens Remove User AlertDialog (NEW — currently toast-stub).
- Users tab "Invite" → opens `InviteUserSheet` (NEW — currently toast-stub).
- Billing tab Plan Change dropdown → opens Plan Change AlertDialog (NEW — currently toast-stub).
- Billing tab "Generate invoice" → opens Generate Invoice Sheet (NEW — currently toast-stub).
- Risk tab "Open risk workspace" → `navigate("risk", { tenantId: tenant.id })` (NEW — currently toast-stub).
- "Reset tenant to defaults" (NEW sub-flow, missing) — destructive outline button → opens Reset AlertDialog.
- "Clone tenant" (NEW sub-flow, missing) — outline button → opens Clone Sheet with new name + slug + checkbox list of what to copy (settings / branding / modules / users).

**Dialogs / Modals / Sheets**:
- Suspend/Terminate/Reactivate AlertDialogs — destructive confirmations with explicit consequences.
- EditRoleAssignmentSheet (NEW sub-flow for Users tab) — same shape as Team Members'.
- Remove User AlertDialog (NEW sub-flow for Users tab) — destructive confirmation.
- InviteUserSheet (NEW sub-flow for Users tab) — same as elsewhere.
- Plan Change AlertDialog (NEW sub-flow for Billing tab) → title "Change plan from {current} to {new}?", description with prorated charge / refund + effective date. Footer Cancel + "Confirm plan change" (primary).
- Generate Invoice Sheet (NEW sub-flow for Billing tab) → right-side Sheet: invoice date, line items (editable: description + quantity + unit price), tax rate, "Generate" primary button → triggers PDF download + toast.
- Reset Tenant AlertDialog (NEW sub-flow, missing) → title "Reset tenant to defaults?", description "All custom branding, terminology, and module overrides will be reverted to platform defaults." Footer Cancel + "Reset" (destructive).
- Clone Tenant Sheet (NEW sub-flow, missing) → right-side Sheet: new name, new slug, copy options (checkboxes), "Clone" primary button.

---

# Batch 47 — Super-Admin Lifecycle + Audit Cluster (Screens 231-235)

## 231. Tenant Lifecycle (view-id: `tenant-lifecycle`) [EXISTING]

**Purpose**: Pipeline visualization of tenant states — Invited → Trial → Active → Suspended → Terminated. Stage cards + filtered DataTable + per-row lifecycle action buttons.

**Layout** (top-to-bottom):
1. PageHeader — title "Tenant Lifecycle", description, actions: "Back to Tenants" outline + "Invite tenant" (NEW sub-flow, missing) primary button.
2. Pipeline visualization — horizontal row of 5 stage Cards connected by arrows: Invited / Trial / Active / Suspended / Terminated. Each card: stage icon + count + description.
3. KPI row (5 MetricCards) — count per stage.
4. Stage filter Select (All / per-stage).
5. Tenants DataTable — filtered by selected stage.

**Tables**:
- Tenants table: Tenant (initials tile + name + tagline), Lifecycle Stage (icon + label + tone), Plan (badge), Modules (count), Created (date) | per-row: RowActions (Suspend / Reactivate / Terminate / View — AlertDialog-gated per current status)

**Forms**: none.

**Actions**:
- Stage card click → sets `activeFilter` to that stage + filters the DataTable below.
- Per-row "Suspend" → opens Suspend AlertDialog (only when status is trial/active).
- Per-row "Reactivate" → opens Reactivate AlertDialog (only when status is suspended).
- Per-row "Terminate" → opens Terminate AlertDialog (only when status is suspended).
- Per-row "View" → `navigate("tenant-detail", { id: tenant.id })`.
- "Invite tenant" (NEW sub-flow, missing) → `navigate("create-tenant")` or opens an Invite Tenant Sheet (simpler than the full create wizard).
- Per-stage SLA / time-in-stage metric (NEW sub-flow, missing) — Card on each stage showing avg time tenants spend in that stage.
- Bulk stage transition (NEW sub-flow, missing) — checkbox column + bulk "Move {N} to {stage}" action.
- Stage transition history per tenant (NEW sub-flow, missing) — per-row 3-dot "Lifecycle history" → opens Sheet with timeline of this tenant's stage transitions.

**Dialogs / Modals / Sheets**:
- Suspend/Reactivate/Terminate AlertDialogs — same shape as Tenants page, with explicit consequence text and `applyStatus(tenant, status, verb)` mutation that calls `setTenant(updated)` + `pushNotification` + toast.
- Invite Tenant Sheet (NEW sub-flow, missing) → right-side Sheet: email, name, plan, "Send invite" primary → creates a new tenant in `invited` status.
- Per-Tenant Lifecycle History Sheet (NEW sub-flow, missing) → right-side Sheet with timeline of stage transitions + actor + reason.

---

## 232. Dashboard Manager (view-id: `dashboard-manager`) [EXISTING]

**Purpose**: Lets the platform admin configure widget layouts on a per-tenant + per-role basis for all white-label prop firm admin/trader dashboards. GridStack drag-and-drop editor with widget library sidebar.

**Layout** (top-to-bottom):
1. PageHeader — title "Dashboard Manager", description.
2. Toolbar Card — Tenant Select + Role Select + "Lock layout" Switch + action buttons: Save / Reset / Preview / Publish to all tenants (NEW sub-flow).
3. Two-column grid (`lg:grid-cols-[260px_1fr]`):
   - Left column — Widget Library sidebar (scrollable): search Input + categorized list of available widgets. Each widget: drag handle + icon + name + description + "Add" button.
   - Right column — GridStack editor area: drag-and-drop grid showing current layout. Each widget renders inside its grid item.

**Per-widget grid item**:
- Header bar with widget name + "Configure" (gear icon) + "Remove" (Trash2 icon).
- Widget preview rendered via React portal.

**Tables**: none.

**Forms**:
- Per-widget Configuration Dialog (NEW sub-flow, missing — opened via the gear icon per widget).
- "Copy layout from another tenant/role" Sheet (NEW sub-flow, missing).

**Actions**:
- Tenant Select → loads the saved layout for that tenant + role from localStorage (`pfaas:dashboardLayout:{tenantId}:{roleId}`).
- Role Select → loads the saved layout for that role (within the selected tenant).
- Widget library "Add" button → `addWidget(widget, options)` to the grid.
- Widget library item drag → drop on grid → `addWidget` at drop position.
- Per-widget "Configure" → opens Per-Widget Configuration Dialog.
- Per-widget "Remove" → `removeWidget(el, true)`.
- "Save" → `saveLayoutToStorage(tenantId, roleId, layout)` + toast "Layout saved".
- "Reset" → `clearLayoutFromStorage` + reloads default layout + toast "Layout reset".
- "Lock layout" Switch → `saveLock(tenantId, roleId, value)` + `setStatic(value)` on the grid.
- "Preview" → opens Preview Modal rendering the layout as a tenant with that role would see it.
- "Publish to all tenants" (NEW sub-flow, missing) → opens Publish to All AlertDialog ("This layout will be applied to all {N} tenants' {role} users. Existing custom layouts will be overwritten.").
- "Copy layout from another tenant/role" (NEW sub-flow, missing) → opens Copy Layout Sheet with source tenant + role selects + "Copy" button.
- "Export layout as JSON" (NEW sub-flow, missing) → downloads `{tenantId}-{roleId}-layout.json`.
- "Import layout from JSON" (NEW sub-flow, missing) → file input → parses + applies.
- Layout version history (NEW sub-flow, missing) → "History" button → opens Sheet with version timeline + per-version "Restore" + "Compare to current".
- Layout conflict resolution (NEW sub-flow, missing) → when a tenant already has a custom layout, "Publish to all" opens a Conflict Resolution Sheet listing affected tenants with per-tenant "Overwrite" / "Keep custom" / "Merge" options.

**Dialogs / Modals / Sheets**:
- Per-Widget Configuration Dialog (NEW sub-flow, missing) → trigger: per-widget gear icon. Modal with widget-specific configuration fields (e.g., for a "KPI Card" widget: metric select, time range, refresh interval).
- Preview Modal (NEW sub-flow, missing) → trigger: "Preview" button. Modal rendering the layout as a tenant with that role would see it.
- Publish to All AlertDialog (NEW sub-flow, missing) → destructive confirmation with explicit overwrite warning.
- Copy Layout Sheet (NEW sub-flow, missing) → right-side Sheet with source tenant + role selects + preview of source layout.
- Layout Version History Sheet (NEW sub-flow, missing) → right-side Sheet with version timeline.
- Layout Conflict Resolution Sheet (NEW sub-flow, missing) → right-side Sheet with per-tenant decision matrix.

---

## 233. Platform Audit (view-id: `platform-audit`) [EXISTING]

**Purpose**: Cross-tenant audit trail — surfaces the entire `auditLog` (all tenants + the platform-scoped stream) with a tenant filter, severity KPIs, free-text search, and CSV export.

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Audit", description, action: "Export CSV" (outline, real).
2. KPI row (4 MetricCards) — Total Events, Critical Events, Warning Events, Last 24h Events.
3. Filter bar — bordered strip: search Input, tenant Select, severity Select (All / Info / Warning / Critical), Clear button, "{n} of {m} events" counter.
4. Audit DataTable — paginated, sortable.

**Tables**:
- Audit events table: Timestamp (date-time), Tenant (name badge), Actor (avatar + name), Action (StatusBadge), Entity (monospace), Summary (truncated text), Severity (StatusBadge) | per-row: View (Eye icon → expand inline detail)

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv(filtered, columns, "platform-audit.csv")`.
- Per-row click or "View" → expands inline to show full event details (changes[] diff, actor IP, user agent).
- Date-range filter (NEW sub-flow, missing) — Select (24h / 7d / 30d / 90d / All).
- "View actor profile" (NEW sub-flow, missing) — clicking the actor name opens a Dialog with the actor's recent activity.
- "Create incident from event" (NEW sub-flow, missing) — per-row 3-dot menu → opens Incident Management Sheet pre-filled with this event as the source.
- Saved searches / alerts (NEW sub-flow, missing) — "Save search" outline button → opens Sheet with name + alert delivery (Slack webhook / email).

**Dialogs / Modals / Sheets**:
- Event Detail Inline Expansion (existing) → expands the row to show changes[] diff.
- View Actor Profile Dialog (NEW sub-flow, missing) → actor name + email + roles + recent activity list.
- Create Incident Sheet (NEW sub-flow, missing) → right-side Sheet pre-filled with event details: title, severity, affected service, "Create incident" primary button → `navigate("incident-management")`.
- Save Search Sheet (NEW sub-flow, missing) → right-side Sheet with name Input + alert channel checkboxes + webhook Input + "Save" primary.

---

## 234. Platform Staff (view-id: `platform-staff`) [EXISTING]

**Purpose**: Cross-tenant admin staff directory — every admin user across every tenant + the platform pseudo-tenant, with primary role assignment, tenant, application, last active, and assigned date.

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Staff", description, actions: "Export CSV" (outline, real) + "Invite platform staff" (NEW sub-flow, missing) primary.
2. KPI row (4 MetricCards) — Total Staff, Super-Admins, Prop-Admins, Pending Invitations.
3. Filter bar — bordered strip: search Input (name/email), application Select (All / super-admin / prop-admin / trader), tenant Select (All / per-tenant), Clear button, "{n} of {m} staff" counter.
4. Staff DataTable — paginated, sortable.

**Tables**:
- Staff table: User (avatar + name + email), Primary Role (color dot + name), Application (badge), Tenant (name badge), Last Active (relative time), Assigned (date) | per-row: 3-dot menu (Role assignment / User activity / Impersonate)

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv`.
- "Invite platform staff" (NEW sub-flow, missing) → opens Invite User Sheet (platform-scoped).
- Per-row 3-dot "Role assignment" (NEW sub-flow, missing — currently toast-stub) → opens `EditRoleAssignmentSheet`.
- Per-row 3-dot "User activity" (NEW sub-flow, missing — currently toast-stub) → `navigate("user-audit-timeline", { id: user.id })` (Per-User Audit Timeline).
- Per-row 3-dot "Impersonate" (NEW sub-flow, missing) → opens Impersonate AlertDialog.
- Per-staff permission breakdown (NEW sub-flow, missing) — per-row 3-dot "Permissions" → opens Sheet showing every permission the staff member holds across all roles.
- "Suspend staff" / "Revoke all access" (NEW sub-flow, missing) — destructive per-row action → opens AlertDialog.

**Dialogs / Modals / Sheets**:
- EditRoleAssignmentSheet (NEW sub-flow, missing) → same as Team Members', scoped to the platform.
- Per-User Audit Timeline (NEW sub-flow, missing — shared with Settings) → `navigate("user-audit-timeline", { id: user.id })`.
- Impersonate Staff AlertDialog (NEW sub-flow, missing) → title "Impersonate {name}?", description with audit-trail warning. Footer Cancel + "Impersonate" (primary).
- Per-Staff Permission Breakdown Sheet (NEW sub-flow, missing) → right-side Sheet listing every permission the staff member holds, grouped by role.
- Suspend Staff AlertDialog (NEW sub-flow, missing) → destructive confirmation.

---

## 235. Platform Roles (view-id: `platform-roles`) [EXISTING]

**Purpose**: Cross-tenant role catalog + permission matrix. Three tabs: Catalog (DataTable of all roles across all applications), Matrix (heatmap of role × permission-group coverage), Audit (hint linking to the dedicated role-audit page).

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Roles & Permissions", description, action: "Export CSV" (outline, real).
2. KPI row (4 MetricCards) — Total Roles, System Roles, Custom Roles, Total Members.
3. Filter bar — search Input, application Select (All / super-admin / prop-admin / trader), type Select (All / System / Custom), Clear button.
4. Tabs (catalog / matrix / audit) — `TabsList` with 3 triggers.

**Tabs**:

**Catalog tab** — DataTable of roles: Role (color dot + name + system/custom badge + application badge), Members (count), Permissions (count), Last Modified (date + actor) | per-row: 3-dot menu (View detail / Edit role / Duplicate)

**Matrix tab** — heatmap grid of roles × permission groups. Cell shows grant count or ✓/—. Cell tone varies by coverage (low/medium/high). Cell hover → tooltip with detail. Cell click → opens Permission List filtered to that role × group (NEW sub-flow, currently toast-stub).

**Audit tab** — hint Card linking to `role-audit` page ("View full role audit log →").

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv`.
- Per-row 3-dot "View detail" (NEW sub-flow, missing — currently toast-stub) → opens `RoleDetailDialog` (same as Roles Management).
- Per-row 3-dot "Edit role" (NEW sub-flow, missing — currently toast-stub) → `navigate("roles-management", { roleId: role.id })` (deep-links to prop-admin Roles Management).
- Per-row 3-dot "Duplicate" (NEW sub-flow, missing) → `duplicateRole(roleId)` + toast.
- Matrix cell click → opens Permission List Filtered Dialog (NEW sub-flow, missing — currently toast-stub).
- "Compare roles" (NEW sub-flow, missing) — select two roles via checkboxes + "Compare" button → opens Compare Roles Diff Modal.

**Dialogs / Modals / Sheets**:
- RoleDetailDialog (NEW sub-flow, missing) → same as Roles Management's RoleDetailDialog.
- Permission List Filtered Dialog (NEW sub-flow, missing — matrix cell click) → modal showing the list of permissions in the clicked role × group, with "Grant to another role" outline + "Revoke from this role" destructive.
- Compare Roles Diff Modal (NEW sub-flow, missing) → side-by-side diff.

---

# Batch 48 — Super-Admin Audit + NEW Cluster (Screens 236-240)

## 236. Role Audit Log (view-id: `role-audit`) [EXISTING]

**Purpose**: Cross-tenant audit trail of every role & permission change. KPI row + filter bar + DataTable + expandable detail panel showing actor reason + structured changes[] diff.

**Layout** (top-to-bottom):
1. PageHeader — title "Role Audit Log", description, action: "Export CSV" (outline, real).
2. KPI row (4 MetricCards) — Total Events, Assignments, Revocations, Permission Changes.
3. Filter bar — bordered strip: search Input, action type Select (9 actions: role.created / role.updated / role.deleted / role.assigned / role.revoked / permission.granted / permission.revoked / user.invited / user.removed), date range Select (24h / 7d / 30d / All), severity Select (All / Info / Warning / Critical), Clear button, "{n} of {m}" counter.
4. Audit DataTable — paginated, sortable, with expandable rows.

**Tables**:
- Audit events table: Timestamp (date-time), Action (StatusBadge with icon), Actor (avatar + name), Target User (avatar + name, if applicable), Role (color dot + name), Reason (truncated, tooltip), Severity (StatusBadge) | per-row: Expand (ChevronRight icon → expands inline)

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv`.
- Per-row click → expands inline to show full details: reason (full text), structured changes[] diff (before/after JSON), actor IP, user agent.
- "Undo this change" (NEW sub-flow, missing) — per-row 3-dot menu (visible for destructive entries only) → opens Undo AlertDialog reverting the change.
- "Filter by role" / "Filter by target user" (NEW sub-flow, missing) — per-row 3-dot menu → sets the filter bar Select to that role/user.
- Saved searches / alerts (NEW sub-flow, missing).
- Related-events cluster (NEW sub-flow, missing) — per-row 3-dot "View related events" → opens Sheet showing all events for the same target user / role within ±24h.

**Dialogs / Modals / Sheets**:
- Undo Change AlertDialog (NEW sub-flow, missing) → title "Undo this change?", description "This will revert the action {action} performed by {actor} on {target}. An opposing audit entry will be recorded." Footer Cancel + "Undo" (destructive).
- Related Events Sheet (NEW sub-flow, missing) → right-side Sheet with timeline of related events.

---

## 237. Permissions Catalog (view-id: `permissions-catalog`) [EXISTING]

**Purpose**: Aggregated permission catalog from all modules' manifests. KPI row + filter bar + Accordion-grouped list of permissions, each showing which roles grant it (with "unused" warning-tone badge when no role grants).

**Layout** (top-to-bottom):
1. PageHeader — title "Permissions Catalog", description, action: "Export CSV" (outline, real).
2. KPI row (4 MetricCards) — Total Permissions, Granted Permissions, Orphan Permissions (unused), Permission Groups.
3. Filter bar — search Input, module Select (All / per-module), "Show only unused" Switch, Clear button.
4. Accordion — one item per module. Inside each: grid of small Cards (1 per permission).

**Per-permission Card content**:
- Permission ID (monospace, primary tone).
- Label (text).
- Description (small muted text).
- "Granted via" badges — list of roles that grant this permission (with role color dot).
- "unused" warning-tone badge when no role grants.
- "granted via *" success-tone badge when granted via wildcard.

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv`.
- Permission row click (NEW sub-flow, missing — currently toast-stub) → inline expand showing which roles grant it (already shown, but click could deep-link to Platform Roles matrix filtered).
- "Grant to role" CTA (NEW sub-flow, missing) — per-permission 3-dot menu → opens Grant Permission to Role Sheet with role Select + "Grant" button.
- Per-permission usage audit (NEW sub-flow, missing) — 3-dot "Usage audit" → opens Sheet showing every role assignment that includes this permission.
- Module deep-link (NEW sub-flow, missing) — clicking the module header in the Accordion → `navigate("module-detail", { id: moduleId })`.
- Orphan-permission cleanup (NEW sub-flow, missing) — outline button "Review {N} orphan permissions" → opens Sheet listing all unused permissions with per-permission "Archive" destructive button.

**Dialogs / Modals / Sheets**:
- Grant Permission to Role Sheet (NEW sub-flow, missing) → right-side Sheet: permission (read-only display), role Select (only roles that don't already grant it), reason Textarea (required), "Grant permission" primary → mutates RBAC store + records audit entry + toast.
- Per-Permission Usage Audit Sheet (NEW sub-flow, missing) → right-side Sheet listing every role × user that currently holds this permission.
- Orphan Permissions Cleanup Sheet (NEW sub-flow, missing) → right-side Sheet with list of unused permissions + per-permission "Archive" destructive button.

---

## 238. Module Detail — Super-Admin (view-id: `super-module-detail`) [NEW]

**Purpose**: Per-module detail view in the Super-Admin context — permissions list, adopters, config schema, version history, platform-wide enable/disable.

**Layout** (top-to-bottom):
1. Breadcrumb — "Module Catalog / {module name}" with back link.
2. Header row — Module icon tile + name + version badge + category badge + "Enable for all tenants" primary button (NEW — currently missing on the catalog) + "Disable for all tenants" destructive outline button.
3. KPI row (4 MetricCards) — Adopting Tenants, Permissions Declared, Dependencies, Latest Version.
4. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked Cards: Manifest Details (description, category, supported applications, dependencies, version, manifest URL), Permissions List (DataTable), Configuration Schema (JSON viewer), Recent Changes (changelog Card with last 10 entries).
   - Right column — stacked Cards: Adoption by Tenant (mini-table with enable/disable Switch per tenant), Per-tenant Module Detail (NEW sub-flow, missing — clicking a tenant row opens a Sheet showing this module's per-tenant configuration), Module Health (uptime %, error rate, last sync).

**Tables**:
- Permissions table: Permission ID (monospace), Label, Description | no per-row actions.
- Adoption table: Tenant (initials tile + name), Enabled (Switch), Enabled At (date), Plan (badge) | per-row: View (opens tenant-detail)

**Forms**: none (configuration is via Sheet, not inline).

**Actions**:
- "Enable for all tenants" → opens Platform-wide Module Enable/Disable AlertDialog (Batch 49).
- "Disable for all tenants" → opens Platform-wide Module Enable/Disable AlertDialog (Batch 49).
- Per-tenant Switch (Adoption table) → toggles module for that tenant + `setTenant` mutation + toast + records audit entry.
- Per-tenant row click → `navigate("tenant-detail", { id: tenant.id })`.
- Per-tenant "View per-tenant config" (NEW sub-flow, missing) → opens right-side Sheet showing this module's per-tenant configuration (overrides on top of the module defaults).

**Dialogs / Modals / Sheets**:
- Platform-wide Module Enable/Disable AlertDialog (NEW sub-flow, missing — see Batch 49).
- Per-Tenant Module Configuration Sheet (NEW sub-flow, missing) → right-side Sheet with the module's per-tenant config form (overrides on top of defaults).

---

## 239. Service Detail (view-id: `service-detail`) [NEW]

**Purpose**: Per-service detail view — uptime history, incident log, metrics drill-down. Accessed from Platform Health by clicking a service row.

**Layout** (top-to-bottom):
1. Breadcrumb — "Platform Health / {service name}" with back link.
2. Header row — Service icon tile + name + status badge (operational / degraded / down) + "Acknowledge incident" outline button (visible when there's an open incident) + "Subscribe to alerts" outline button.
3. KPI row (4 MetricCards) — Uptime 30d, Avg Latency 24h, Error Rate 24h, Last Incident.
4. Two-column grid (`lg:grid-cols-[1.6fr_1fr]`):
   - Left column — stacked Cards: Uptime History (line chart, last 30 days), Latency History (line chart, last 7 days), Error Rate History (line chart, last 7 days).
   - Right column — stacked Cards: Recent Incidents (timeline of last 5 incidents with status), Metrics Drill-Down Table (per-endpoint breakdown for API services: endpoint, call count, avg latency, error rate).

**Tables**:
- Metrics drill-down table: Endpoint (monospace), Call Count (numeric, 24h), Avg Latency (ms), P99 Latency (ms), Error Rate (%) | no per-row actions (read-only)

**Forms**: none.

**Actions**:
- "Acknowledge incident" → opens Acknowledge Incident Sheet (cross-link to Incident Management).
- "Subscribe to alerts" → opens Subscription Sheet (similar to Platform Health).
- Time range Select on each chart → reloads chart with new range (24h / 7d / 30d / 90d).
- Per-incident row click → `navigate("incident-management", { id: incident.id })`.
- Per-endpoint row click → opens Endpoint Detail Modal (NEW sub-flow, missing) with per-endpoint latency breakdown chart.

**Dialogs / Modals / Sheets**:
- Acknowledge Incident Sheet (NEW sub-flow, missing) → right-side Sheet: incident (read-only display), acknowledgment note Textarea (required), "Acknowledge" primary button.
- Subscribe to Alerts Sheet (NEW sub-flow, missing) → right-side Sheet with severity checkboxes + channel checkboxes + webhook Input.
- Endpoint Detail Modal (NEW sub-flow, missing) → full modal with line chart of latency over time + table of recent calls.

---

## 240. Per-User Audit Timeline — Super-Admin Context (view-id: `super-admin-user-audit-timeline`) [NEW]

**Purpose**: Same unified per-user audit timeline as Settings (Batch 45), but accessed from Super-Admin → Platform Staff "User activity" or from Platform Audit "View actor profile". In the Super-Admin context, the timeline spans ALL tenants — i.e., the user's actions across every tenant they have access to (including platform-scoped actions).

**Layout** (top-to-bottom — same structure as the Settings variant):
1. Breadcrumb — "Platform Staff / {user.name} / Activity" or "Platform Audit / Actor: {user.name} / Activity".
2. Header row — User avatar + name + email + status badge + application badge + role badges + "Export Activity CSV" outline + "Back" outline.
3. Filter bar — Date Range Select, Action Type Select (same 9 actions as Role Audit Log), Tenant Select (All / per-tenant — for cross-tenant scoping), Severity Select, Search Input.
4. KPI row (3 MetricCards) — Total Events, Critical Events, Events in last 24h.
5. Timeline list — vertical timeline of events.

**Tables**: none (timeline list, same as Settings variant).

**Forms**: none.

**Actions**:
- Filter bar Selects + search → drive the filtered timeline.
- "Export Activity CSV" → real `exportToCsv`.
- "Back" → returns to Platform Staff or Platform Audit depending on entry point.
- Per-event "View details" → expands inline.
- Per-event "Create incident from this event" (visible for critical events only) → opens Incident Management Sheet pre-filled.
- Per-event "View actor profile" → opens Actor Profile Dialog (NEW sub-flow, missing — for cross-actor navigation).
- "Impersonation trail" sub-view (NEW sub-flow, missing) — outline button "View impersonation trail" → opens Sheet showing every time this user has been impersonated + every impersonation this user has performed.

**Dialogs / Modals / Sheets**:
- Event Detail Inline Expansion — same as Settings variant.
- Actor Profile Dialog (NEW sub-flow, missing) — actor name, email, roles, last active, recent activity (5 most recent events by the actor).
- Impersonation Trail Sheet (NEW sub-flow, missing — unique to Super-Admin context) → right-side Sheet showing every impersonation event involving this user (as impersonator or impersonated), with timestamp, impersonator, target, duration, reason.
- Create Incident Sheet (NEW sub-flow, missing — same as Platform Audit).

---

# Batch 49 — Super-Admin NEW Cluster + Pendings Start (Screens 241-245)

## 241. Tenant Billing Detail (view-id: `tenant-billing-detail`) [NEW]

**Purpose**: Real billing detail view for a single tenant — invoice history DataTable with PDF download + plan change confirmation + payment method management. Accessed from Tenant Detail → Billing tab "View full billing history" link.

**Layout** (top-to-bottom):
1. Breadcrumb — "Tenants / {tenant.name} / Billing" with back link.
2. Header row — Tenant initials + name + status badge + plan badge + MRR MetricCard.
3. KPI row (4 MetricCards) — MRR, Lifetime Revenue, Outstanding Balance, Next Billing Date.
4. Subscription Card — current plan, billing cycle, next billing date, payment method (last 4 digits + brand), "Change plan" outline button + "Update payment method" outline button + "Cancel subscription" destructive outline button.
5. Invoice History DataTable — paginated, sortable.

**Tables**:
- Invoices table: Invoice # (monospace), Date (date), Period (start – end), Amount (formatted currency), Status (StatusBadge — paid / pending / overdue / void), PDF (Download icon, clickable) | per-row: Download (real PDF download) + View (opens Invoice Detail Sheet) + Refund (destructive, only for paid invoices)

**Forms**:
- Plan Change Sheet (see below).
- Update Payment Method Sheet (see below).
- Refund / Credit Note Sheet (see below).

**Actions**:
- "Change plan" → opens Plan Change Sheet.
- "Update payment method" → opens Update Payment Method Sheet (Stripe Elements integration).
- "Cancel subscription" → opens Cancel Subscription AlertDialog.
- Per-row "Download" → triggers real PDF download (Blob → save as `{invoiceNumber}.pdf`).
- Per-row "View" → opens Invoice Detail Sheet.
- Per-row "Refund" → opens Refund Sheet.
- "Generate custom invoice" (NEW sub-flow) → opens Generate Invoice Sheet (same as Tenant Detail).
- "Export invoices CSV" (NEW sub-flow) → `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Plan Change Sheet (trigger: "Change plan" button) → right-side Sheet: current plan (read-only), new plan Select, prorated charge preview, effective date Select, reason Textarea, "Confirm plan change" primary button → mutates `tenant.plan` + records billing audit entry + toast.
- Update Payment Method Sheet (trigger: "Update payment method" button) → right-side Sheet: Stripe Elements card input, billing address form, "Update" primary button → calls Stripe API to update payment method.
- Cancel Subscription AlertDialog (trigger: "Cancel subscription" button) → AlertDialogContent: title "Cancel subscription?", description "The tenant will lose access at the end of the current billing period. A prorated refund will be issued." Footer Cancel + "Cancel subscription" (destructive).
- Invoice Detail Sheet (trigger: per-row "View") → right-side Sheet: invoice header, line items table, subtotal/tax/total, payment history, "Download PDF" outline button + "Refund" destructive outline.
- Refund / Credit Note Sheet (trigger: per-row "Refund") → right-side Sheet: original invoice (read-only), refund amount Input (max = invoice total), reason Textarea, "Issue refund" primary button → creates a credit note + toast.

---

## 242. Incident Management (view-id: `incident-management`) [NEW]

**Purpose**: Acknowledge / resolve flow for platform incidents. Timeline of incidents with severity, affected services, status transitions, and postmortem notes.

**Layout** (top-to-bottom):
1. PageHeader — title "Incident Management", description, actions: "Create incident" (outline) + "Run simulated drill" (destructive outline).
2. KPI row (4 MetricCards) — Open Incidents, Acknowledged (unresolved), Resolved 7d, MTTR (Mean Time to Resolve).
3. Filter bar — bordered strip: search Input, severity Select (All / Critical / Warning / Info), status Select (All / Open / Acknowledged / Resolved), affected service Select, Clear button.
4. Incidents DataTable — paginated, sortable.

**Tables**:
- Incidents table: Severity (StatusBadge with icon), Title (text), Affected Services (badges), Started At (date-time), Status (StatusBadge), Acknowledged By (avatar + name), MTTR (duration) | per-row: View (Eye icon → opens Incident Detail Sheet)

**Forms**:
- Create Incident Sheet (see below).
- Acknowledge / Resolve Sheet (see below).

**Actions**:
- "Create incident" → opens Create Incident Sheet.
- "Run simulated drill" → opens Simulated Drill Dialog (same as Platform Health).
- Per-row click or "View" → opens Incident Detail Sheet.
- Per-row "Acknowledge" (inline, visible when status=open) → opens Acknowledge Sheet.
- Per-row "Resolve" (inline, visible when status=acknowledged) → opens Resolve Sheet.
- "Subscribe to incidents" (NEW sub-flow) → opens Subscription Sheet.

**Dialogs / Modals / Sheets**:
- Create Incident Sheet (trigger: "Create incident" button) → right-side Sheet: Title (Input, required), Severity (Select), Affected Services (multi-select chips), Description (Textarea), Source Event (optional — auto-filled when created from Platform Audit), "Create incident" primary → mutates incidents store + toast.
- Incident Detail Sheet (trigger: per-row "View") → right-side Sheet: full incident header, timeline of status transitions (Created → Acknowledged → Resolved), affected services list, postmortem notes Textarea (visible only after resolution), "Acknowledge" / "Resolve" / "Reopen" action buttons.
- Acknowledge Sheet (trigger: per-row "Acknowledge") → right-side Sheet: incident (read-only), acknowledgment note Textarea (required), "Acknowledge" primary.
- Resolve Sheet (trigger: per-row "Resolve") → right-side Sheet: incident (read-only), resolution note Textarea (required), postmortem required? (Switch — for critical incidents), time-to-resolve auto-calculated, "Resolve" primary.
- Subscribe to Incidents Sheet (NEW sub-flow, missing) → right-side Sheet with severity checkboxes + channel checkboxes + webhook Input.
- Simulated Drill Dialog (NEW sub-flow, missing) → same as Platform Health.

---

## 243. Tenant Impersonation Audit Trail (view-id: `tenant-impersonation-audit`) [NEW]

**Purpose**: Cross-tenant audit trail of every impersonation event — who impersonated whom, when, for how long, what actions they took, and the reason captured at start.

**Layout** (top-to-bottom):
1. PageHeader — title "Tenant Impersonation Audit", description, action: "Export CSV" (outline, real).
2. KPI row (4 MetricCards) — Total Impersonations 30d, Active Now, Avg Duration, Distinct Impersonators.
3. Filter bar — bordered strip: search Input, impersonator Select (All / per-admin), target tenant Select (All / per-tenant), date range Select (24h / 7d / 30d / All), Clear button.
4. Impersonation DataTable — paginated, sortable.

**Tables**:
- Impersonation events table: Started At (date-time), Impersonator (avatar + name + role badge), Target Tenant (initials + name), Target User (avatar + name, if impersonating a specific user), Reason (truncated, tooltip), Duration (relative), Actions Count (numeric — how many mutations performed during the session) | per-row: View (Eye icon → opens Impersonation Detail Sheet)

**Forms**: none.

**Actions**:
- "Export CSV" → `exportToCsv`.
- Per-row click or "View" → opens Impersonation Detail Sheet.
- "Force-end active session" (NEW sub-flow, missing) — per-row 3-dot menu (visible when session is active) → opens Force-End AlertDialog.
- Per-row 3-dot "View impersonator's full activity" → `navigate("user-audit-timeline", { id: impersonator.id })`.

**Dialogs / Modals / Sheets**:
- Impersonation Detail Sheet (trigger: per-row "View") → right-side Sheet: full session header (started, ended, duration, impersonator, target, reason captured at start), timeline of every action taken during the session (clickable → drill into the underlying audit event), "End session" button (if still active).
- Force-End Impersonation AlertDialog (NEW sub-flow, missing) → title "Force-end this impersonation session?", description "The impersonator will be immediately logged out. An audit entry will be recorded." Footer Cancel + "Force-end" (destructive).

---

## 244. Platform-wide Module Enable/Disable (view-id: `platform-module-toggle`) [NEW]

**Purpose**: Bulk enable/disable flow for a module across all tenants — surfaced from Module Catalog "Enable for all tenants" per-card action and Module Detail "Enable for all" / "Disable for all" buttons.

**Layout** (rendered as an AlertDialog with multi-step flow):
1. Title — "Enable {module name} for all tenants?" or "Disable for all tenants?"
2. Description — explicit consequences.
3. Affected tenants preview — DataTable or chip list of every tenant that will be affected (those without the module enabled, for enable; those with it enabled, for disable).
4. Conflict resolution matrix (for disable) — per-tenant: Overwrite / Keep / Merge.
5. Reason Textarea (required for audit log).
6. Footer — Cancel + "Confirm" (destructive if disabling).

**Tables** (inside the dialog):
- Affected tenants table: Tenant (initials + name), Current State (Enabled/Disabled badge), Action (Select: Overwrite / Keep / Merge — only for disable) | no per-row actions (the Select is the action)

**Forms**:
- Reason Textarea (required, maxLength 280).
- Conflict resolution Selects per row (disable flow).

**Actions**:
- "Confirm" → iterates affected tenants, applies the toggle per the per-tenant decision, records a single bulk audit entry + per-tenant audit entries, fires `{N} toasts` (or a single summary toast) + closes dialog.
- "Cancel" → closes dialog without action.
- Per-row Select change → updates the per-tenant decision (default: Overwrite for enable; Keep for disable).

**Dialogs / Modals / Sheets**:
- (Self-contained AlertDialog — no nested modals. Note: the affected tenants table inside the dialog uses `max-h-64 overflow-y-auto` for scrolling.)

---

## 245. Pending Tasks (view-id: `pending-tasks`) [EXISTING]

**Purpose**: Operational hub surfacing what needs admin attention right now. 6 clickable summary cards + forecast chart + recent activity feed.

**Layout** (top-to-bottom):
1. PageHeader — title "Pending Tasks", description "Operational hub — what needs admin attention right now."
2. Top summary band (3 MetricCards) — Items Awaiting Action (warning tone), Forecast (this week), Active Traders.
3. Summary cards grid (1/2/3 columns responsive) — 6 clickable Cards (Phase 1 Verification, Phase 2 Verification, KYC Reviews, Phase Verification, Pending Withdrawals, Affiliate Payouts).
4. Two-column grid (`lg:grid-cols-2`):
   - Left card — Withdrawal Forecast Bar Chart (Tue–Sun).
   - Right card — Recent Activity Feed (last 5 activities).
5. Footnote line.

**Per-card content** (summary cards):
- Left edge color strip (warning tone when count > 0, success tone when 0).
- Icon tile + uppercase label.
- Big count number.
- Description text.
- Right arrow icon (animates on hover).
- "Opens {viewId} →" hint at the bottom.

**Tables**: none.

**Forms**: none.

**Actions**:
- Per-card click → `navigate(card.viewId)` (e.g., challenges-passed, kyc-reviews, payouts-pending, etc.).
- Per-card "Snooze" (NEW sub-flow, missing) — 3-dot menu → opens Snooze AlertDialog with duration Select (1h / 4h / 1d / 1w) + reason Textarea.
- Per-card "Assign to" (NEW sub-flow, missing) — 3-dot menu → opens Assign Sheet with admin Select + "Assign" primary.
- Per-card detail expansion (NEW sub-flow, missing) — clicking the card body (not the arrow) expands inline showing the top 5 items in that category.
- Filter by assignee / priority (NEW sub-flow, missing) — outline "Filters" button → opens Filter Sheet.
- Per-card "Mark as handled" (NEW sub-flow, missing) — 3-dot menu → marks the category as handled for the day + toast.
- Forecast chart bar click (NEW sub-flow, missing) → `navigate("payouts-pending", { day: clickedDay })`.
- Recent Activity feed item click (NEW sub-flow, missing — currently items are not clickable) → navigates to the underlying entity (e.g., withdrawal → payout-detail, KYC → kyc-reviews, AI insight → ai-detail).
- Affiliate Payouts count (NEW sub-flow — currently hardcoded `3`) → derive from `getTenantAffiliates(tid)` real count.

**Dialogs / Modals / Sheets**:
- Snooze AlertDialog (NEW sub-flow, missing) → trigger: per-card 3-dot "Snooze". AlertDialogContent: title "Snooze {category}?", duration Select (1h / 4h / 1d / 1w), reason Textarea, "Snooze" primary.
- Assign Sheet (NEW sub-flow, missing) → right-side Sheet: category (read-only), admin Select, reason Textarea, "Assign" primary.
- Filter Sheet (NEW sub-flow, missing) → right-side Sheet: assignee Select, priority Select, date range Select, "Apply" primary + "Clear" outline.

---

# Batch 50 — Pendings NEW + Profile Start (Screens 246-250)

## 246. Pending Task Detail (view-id: `pending-task-detail`) [NEW]

**Purpose**: Single pending task detail — assignment, status, comments, history. Accessed from Pending Tasks by clicking a card's "View details" or from a 3-dot menu on a specific item.

**Layout** (top-to-bottom):
1. Breadcrumb — "Pending Tasks / {task.title}" with back link.
2. Header row — Task icon + title + priority StatusBadge + status StatusBadge + "Assign" outline + "Snooze" outline + "Resolve" primary + "Reject" destructive outline.
3. KPI row (3 MetricCards) — Created (date), Due (date), Time Until Due (countdown).
4. Two-column grid (`lg:grid-cols-[1.6fr_1fr]`):
   - Left column — stacked Cards: Task Details (description, category, source link), Comments Thread (list + add comment form at the bottom), Activity History (timeline of status changes / assignments).
   - Right column — stacked Cards: Assignment (current assignee avatar + name + role, "Reassign" outline button), Related Entities (linked trader / payout / KYC record / challenge — clickable cross-links), Tags (badge list with add Tag input).

**Tables**: none.

**Forms**:
- Comment form (inline at the bottom of the Comments Thread): Textarea (3 rows, maxLength 500), "Add comment" primary button.

**Actions**:
- "Assign" → opens Assign Sheet.
- "Snooze" → opens Snooze AlertDialog.
- "Resolve" → opens Resolve AlertDialog (with resolution note Textarea).
- "Reject" → opens Reject AlertDialog (with reason Textarea).
- "Reassign" → opens Reassign Sheet (admin Select + reason Textarea).
- Per-comment "Edit" (only for own comments) → inline edit mode.
- Per-comment "Delete" (only for own comments) → opens Delete Comment AlertDialog.
- Per-related-entity click → `navigate` to the underlying entity's detail page.
- "Add Tag" → inline input + Enter to commit.
- Per-tag "X" → removes the tag.

**Dialogs / Modals / Sheets**:
- Assign Sheet (trigger: "Assign" button) → right-side Sheet: task (read-only), admin Select (filtered by current tenant), reason Textarea, "Assign" primary → mutates assignment + records audit entry + toast.
- Snooze AlertDialog (trigger: "Snooze" button) → AlertDialogContent: title "Snooze this task?", duration Select, reason Textarea, "Snooze" primary.
- Resolve AlertDialog (trigger: "Resolve" button) → AlertDialogContent: title "Resolve this task?", resolution note Textarea (required), "Resolve" primary → mutates status to `resolved` + records audit entry + toast.
- Reject AlertDialog (trigger: "Reject" button) → AlertDialogContent: title "Reject this task?", reason Textarea (required), "Reject" destructive.
- Reassign Sheet (trigger: "Reassign" button) → right-side Sheet: current assignee (read-only), new assignee Select, reason Textarea, "Reassign" primary.
- Delete Comment AlertDialog (trigger: per-comment "Delete") → simple confirmation.

---

## 247. My Tasks (view-id: `my-tasks`) [NEW]

**Purpose**: "Tasks assigned to me" view — a personal filter on top of Pending Tasks. Surfaces what the current admin personally owes action on.

**Layout** (top-to-bottom):
1. PageHeader — title "My Tasks", description "{N} tasks assigned to you", actions: "Switch to all pending" outline button (toggles to `pending-tasks`) + "Export CSV" outline.
2. KPI row (4 MetricCards) — Assigned to Me (count), Due Today (count), Overdue (count, destructive tone), Resolved This Week (count, positive tone).
3. Filter bar — bordered strip: status Select (All / Open / In Progress / Snoozed / Resolved), priority Select (All / Low / Medium / High / Critical), due date Select (All / Today / This Week / Overdue), Clear button.
4. Tasks DataTable — paginated, sortable.

**Tables**:
- My tasks table: Title (text), Category (badge), Priority (StatusBadge), Status (StatusBadge), Assigned At (date), Due (date, destructive tone when overdue) | per-row: View (Eye icon → opens Pending Task Detail) + 3-dot menu (Snooze / Resolve / Reassign)

**Forms**: none (all form interactions live on the Pending Task Detail page).

**Actions**:
- "Switch to all pending" → `navigate("pending-tasks")`.
- "Export CSV" → `exportToCsv`.
- Per-row click or "View" → `navigate("pending-task-detail", { id: task.id })`.
- Per-row 3-dot "Snooze" → opens Snooze AlertDialog.
- Per-row 3-dot "Resolve" → opens Resolve AlertDialog.
- Per-row 3-dot "Reassign" → opens Reassign Sheet.
- "Group by" toggle (NEW sub-flow, missing) — outline button → toggles between flat list and grouped-by-status view.

**Dialogs / Modals / Sheets**:
- Snooze / Resolve / Reassign dialogs — same as Pending Task Detail.

---

## 248. Snoozed / Resolved History (view-id: `pending-snoozed-resolved`) [NEW]

**Purpose**: Previously-handled items — snoozed (will resurface) and resolved (closed). Provides accountability for past decisions and a path to reopen if needed.

**Layout** (top-to-bottom):
1. PageHeader — title "Snoozed / Resolved History", description.
2. Tabs (snoozed / resolved) — `TabsList` with two triggers.
3. KPI row (4 MetricCards) — Snoozed (count), Avg Snooze Duration, Resolved 7d (count), Reopened 30d (count).
4. Filter bar — bordered strip: search Input, category Select, resolver Select (for resolved tab), date range Select (24h / 7d / 30d / 90d / All), Clear button.
5. History DataTable — paginated, sortable.

**Tables**:
- Snoozed table: Title (text), Category (badge), Snoozed At (date-time), Snoozed By (avatar + name), Reason (truncated, tooltip), Resurfaces At (date-time, warning tone when < 24h) | per-row: "Wake now" outline + 3-dot (View / Cancel snooze)
- Resolved table: Title (text), Category (badge), Resolved At (date-time), Resolved By (avatar + name), Resolution Note (truncated, tooltip), Time to Resolve (duration) | per-row: View (Eye icon → opens Pending Task Detail in read-only mode) + "Reopen" destructive outline

**Forms**: none.

**Actions**:
- Tab trigger click → swaps the DataTable data source.
- Per-row "Wake now" (Snoozed tab) → mutates status back to `open` + toast "Task woken up".
- Per-row 3-dot "Cancel snooze" (Snoozed tab) → opens Cancel Snooze AlertDialog.
- Per-row "View" (Resolved tab) → `navigate("pending-task-detail", { id: task.id })` in read-only mode.
- Per-row "Reopen" (Resolved tab) → opens Reopen AlertDialog.
- Per-row 3-dot "View snoozer profile" / "View resolver profile" → `navigate("user-audit-timeline", { id: user.id })`.
- "Export CSV" (NEW sub-flow) → `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Cancel Snooze AlertDialog (trigger: per-row 3-dot "Cancel snooze") → title "Cancel this snooze?", description "The task will resurface immediately in the open queue." Footer Cancel + "Cancel snooze" (primary).
- Reopen AlertDialog (trigger: per-row "Reopen") → AlertDialogContent: title "Reopen this task?", description "The task will move back to the open queue. A reopen note is required." Reopen note Textarea (required), "Reopen" destructive.

---

## 249. Pending Task Bulk-Assign / Bulk-Resolve (view-id: `pending-bulk-assign`) [NEW]

**Purpose**: Bulk action surface for assigning or resolving multiple pending tasks at once — reached by selecting multiple rows on Pending Tasks or My Tasks.

**Layout** (rendered as a Sheet that opens when ≥1 task is selected on the parent list):
1. SheetHeader — title "Bulk Assign {N} Tasks" or "Bulk Resolve {N} Tasks" + description.
2. Selected tasks summary Card — list of all selected task titles (with "Remove" X per row).
3. Bulk form (varies by mode):
   - Assign mode: Assignee Select (single admin for all), Reason Textarea (required), "Apply to all {N}" primary + "Per-task assignment" outline (switches to per-task mode where each row gets its own Select).
   - Resolve mode: Resolution Note Textarea (required, applied to all), "Apply to all {N}" primary + "Per-task note" outline (switches to per-task mode).
4. Preview Card — read-only DataTable showing each task with the proposed assignee / resolution note.
5. SheetFooter — Cancel (ghost) + "Apply bulk action" (primary).

**Tables** (preview card):
- Preview table: Task Title (text), Category (badge), Current Assignee (avatar + name), Proposed Assignee (avatar + name, for assign mode) / Proposed Note (truncated, for resolve mode) | per-row: Edit (Pencil icon → opens per-task override Sheet) — only in per-task mode

**Forms**:
- Assign mode form: Assignee Select, Reason Textarea.
- Resolve mode form: Resolution Note Textarea.
- Per-task override Sheet (per-task mode): per-task assignee Select / per-task note Textarea.

**Actions**:
- "Apply to all {N}" → iterates selected tasks, applies the action, records a single bulk audit entry + per-task audit entries, fires a summary toast + closes Sheet.
- "Per-task assignment" / "Per-task note" toggle → switches between bulk-apply and per-task modes.
- Per-row "Edit" (per-task mode) → opens per-task override Sheet.
- Per-row "Remove" (selected summary) → removes from selection.
- "Cancel" → closes Sheet without action.

**Dialogs / Modals / Sheets**:
- Per-task Override Sheet (NEW sub-flow, missing — per-task mode) → right-side Sheet: task title (read-only), assignee Select (or note Textarea for resolve), reason Textarea, "Save override" primary.

---

## 250. Profile (view-id: `profile`) [EXISTING]

**Purpose**: User account, avatar, preferences, sessions. Avatar upload (client-side preview), display name editing, notification preferences quick-access, active sessions, and security info.

**Layout** (top-to-bottom):
1. PageHeader — title "Profile", description "Your account, preferences, and security."
2. Profile header Card — Avatar (with upload button overlay) + name + application badge + role badges + email + last active + "Save" primary button.
3. Edit Profile Card — Display Name (Input), Email (Input type email).
4. Two-column grid (`md:grid-cols-2`):
   - Roles & Permissions Card — roles list (Badges) + permissions list (Badges, "+N more" overflow).
   - Tenant Card — tenant initials + name + plan/currency/timezone + locale + modules enabled.
5. Quick Preferences Card — 5 toggles: Email notifications, In-app notifications, Desktop notifications, Weekly digest, AI insight alerts.
6. Active Sessions Card — list of sessions.

**Tables**:
- Sessions list (Card-internal, not a DataTable): Device (icon + name + Current badge), Browser/Location/IP (small text), Last Active (text) | per-row: Revoke (ghost button, destructive — only for non-current sessions)

**Forms**:
- Profile header form: Avatar file input (accept image/*, max 2MB), Display Name (Input), Email (Input).
- Quick Preferences form: 5 Switches with labels + descriptions.

**Actions**:
- Avatar upload button → opens file picker → on file selected, validates type + size, reads as DataURL, sets `avatarUrl` + toast "Avatar updated".
- "Save" (profile header) → toast "Profile saved" (currently toast-stub — should persist to user store).
- Quick Preferences Switches → currently don't persist (no toast, no store update — known limitation; should persist to user preferences store + at least toast).
- Per-session "Revoke" → **real session revoke** (currently toast-stub — should call auth API + toast).
- "Change Password" (NEW sub-flow, missing — see Batch 51).
- "Enable / Disable 2FA" (NEW sub-flow, missing — see Batch 51).
- "Revoke all sessions" / "Log out everywhere" (NEW sub-flow, missing) — destructive outline button.
- "Connected apps" / OAuth tokens (NEW sub-flow, missing) — Card below Active Sessions.
- API token cross-link (NEW sub-flow, missing) — "Manage my API tokens" outline button → `navigate("token-management", { userId: currentUser.id })`.
- Avatar "Remove" / "Reset" (NEW sub-flow, missing) — small X button overlay.
- Email change confirmation (NEW sub-flow, missing) — Email input + "Verify" button → sends verification email.
- Per-session device info drill-down (NEW sub-flow, missing) — clicking a session row opens a Sheet with full device info (browser, OS, IP geo, last 10 actions).
- Per-module notification matrix (NEW sub-flow, missing — see Notification Preferences Matrix, Batch 51).
- Avatar upload progress bar (NEW sub-flow, missing).

**Dialogs / Modals / Sheets**:
- Change Password Dialog (NEW — see Batch 51).
- 2FA Setup Dialog (NEW — see Batch 51).
- Revoke All Sessions AlertDialog (NEW sub-flow, missing) → title "Revoke all sessions?", description "You will be logged out of every device. The current session will also end." Footer Cancel + "Revoke all" (destructive).
- Connected Apps Sheet (NEW sub-flow, missing) → right-side Sheet listing every OAuth token the user has issued (Slack, Google, etc.) + per-token "Revoke access" destructive button.
- Per-Session Device Info Sheet (NEW sub-flow, missing) → right-side Sheet: full device fingerprint, browser, OS, IP geo map, last 10 actions timeline.

---

# Batch 51 — Profile NEW Cluster (Screens 251-255)

## 251. Change Password Dialog (view-id: `change-password-dialog`) [NEW]

**Purpose**: Modal dialog for changing the current user's password. Enforces current-password confirmation, new-password strength validation, and confirmation match.

**Layout** (rendered inside a Dialog):
1. DialogHeader — title "Change Password" + description "Your new password must be at least 12 characters and include upper/lower/number/symbol."
2. Form fields (stacked):
   - Current Password (Input type password, with Eye/EyeOff show/hide toggle).
   - New Password (Input type password, with show/hide toggle + strength meter below).
   - Confirm New Password (Input type password, with show/hide toggle + match indicator).
   - "Revoke all other sessions after change" Switch (default on, with description).
3. DialogFooter — Cancel (outline) + "Change password" (primary, disabled until all validations pass).

**Forms**:
- Change Password form: Current Password, New Password, Confirm New Password, Revoke other sessions Switch.

**Actions**:
- Show/hide toggle per field → toggles input type between `password` and `text`.
- New Password input → on every keystroke, recompute strength meter (very weak / weak / fair / strong / very strong) and validation checklist (length ≥ 12, has upper, has lower, has number, has symbol).
- Confirm Password input → on every keystroke, check match with New Password.
- "Change password" → validates all fields; on success calls auth API (`POST /auth/change-password`), optionally revokes other sessions, fires toast "Password changed", closes Dialog.
- "Cancel" → closes Dialog without action.

**Dialogs / Modals / Sheets**:
- (Self-contained Dialog — no nested modals. Validation toasts appear inline as error text under the relevant field.)

---

## 252. 2FA Setup Dialog (view-id: `2fa-setup-dialog`) [NEW]

**Purpose**: Modal dialog for setting up or disabling two-factor authentication. QR-code-based TOTP enrollment with backup codes.

**Layout** (rendered inside a Dialog, multi-step):
1. DialogHeader — title "Set Up Two-Factor Authentication" or "Disable 2FA" (depending on current state).
2. Step indicator — 4 steps for setup: Choose Method → Scan QR → Verify → Backup Codes.
3. Step content area — varies by step.
4. DialogFooter — Back (outline) + Next/Confirm (primary).

**Forms** (per step):
- Choose Method step: Method radio cards — Authenticator App (recommended) / SMS / Email. Each card with icon + description.
- Scan QR step: QR code image (generated from `otpauth://` URL), secret key (monospace, with Copy button), "Open in app" deep-link button, "I've scanned it" primary.
- Verify step: 6-digit OTP Input (segmented, 6 boxes), "Verify" primary.
- Backup Codes step: list of 10 backup codes (monospace, with "Download" + "Copy all" buttons), warning text "Store these in a safe place — each can be used once.", "I've saved them" primary.

**For Disable 2FA mode** (single-step dialog):
- Current Password (Input type password, required).
- Reason Textarea (optional).
- "Disable 2FA" destructive primary button.

**Actions**:
- Method radio card click → selects method.
- "Open in app" → opens `otpauth://` deep link.
- "I've scanned it" → advances to Verify step.
- OTP input → auto-advances cursor on each digit; auto-submits when 6 digits entered.
- "Verify" → calls auth API (`POST /auth/2fa/verify`); on success advances to Backup Codes step + toast "2FA verified".
- "Download" backup codes → triggers Blob download of `2fa-backup-codes-{date}.txt`.
- "Copy all" → `navigator.clipboard.writeText(codes.join("\n"))` + toast.
- "I've saved them" → completes setup + closes Dialog + toast "2FA enabled".
- "Back" / "Next" / "Cancel" → standard nav.
- Disable 2FA mode → "Disable 2FA" → calls auth API (`POST /auth/2fa/disable`) + toast "2FA disabled" + closes Dialog.

**Dialogs / Modals / Sheets**:
- (Self-contained Dialog — no nested modals. Note: backup codes should be displayed only once — server should not store them in plaintext.)

---

## 253. Connected Sessions Detail (view-id: `connected-sessions-detail`) [NEW]

**Purpose**: Per-session detail view — IP geo, device fingerprint, activity timeline. Reached from Profile → Active Sessions by clicking a session row.

**Layout** (top-to-bottom):
1. Breadcrumb — "Profile / Active Sessions / {session.device}" with back link.
2. Header row — Device icon + name + Current badge + "Revoke session" destructive outline button (only for non-current sessions).
3. KPI row (4 MetricCards) — Started At, Last Active, IP Address, Login Count.
4. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — Activity Timeline Card (vertical timeline of every action performed in this session).
   - Right column — stacked Cards: IP Geo (map of last known IP location + city/region/country + ISP + ASN), Device Fingerprint (browser, OS, screen resolution, timezone, languages, user agent), Authentication (login method — password / 2FA / SSO, success/failure history).

**Tables**:
- Activity timeline (Card-internal list, not a DataTable): Timestamp (date-time), Action (text), Entity (monospace link to the affected entity), Result (StatusBadge — success / failure) | per-row: View (Eye icon → opens the underlying entity)

**Forms**: none.

**Actions**:
- "Revoke session" → opens Revoke Session AlertDialog.
- Per-activity row click → `navigate` to the underlying entity's detail page.
- "Export session history CSV" (NEW sub-flow) → `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Revoke Session AlertDialog (trigger: "Revoke session" button) → AlertDialogContent: title "Revoke this session?", description "The user on this device will be immediately logged out. Any unsaved work may be lost." Footer Cancel + "Revoke session" (destructive).

---

## 254. Notification Preferences Matrix (view-id: `notification-preferences-matrix`) [NEW]

**Purpose**: Unified per-module / per-channel notification preferences page (replaces the 5 generic toggles on Profile). Full matrix with quiet hours, frequency caps, and per-event overrides.

**Layout** (top-to-bottom):
1. PageHeader — title "Notification Preferences", description, actions: "Reset to defaults" outline + "Save changes" primary + sticky save bar at the bottom.
2. Channels Row — 4 Cards: Email Delivery, SMS Routing, Push Notification, In-App Center. Each with verified badge + "Test Channel" outline button.
3. Quiet Hours Window Card — master Switch + From (time Input) + To (time Input) + "Critical breach override" Switch + system localization note.
4. Event Matrix table — 5 sections × 2-5 rows each × 4 channels (Email / SMS / Push / In-App).
5. Frequency Caps & Summaries Card — Max per hour (number Input), Max per day (number Input), Daily Executive Summary Digest Switch.
6. Sticky Save Bar — change counter + "Discard changes" outline + "Save Preferences" primary.

**Tables**:
- Event matrix table: Event (label + description + section header row), Email (Switch — locked ON for compliance events), SMS (Switch), Push (Switch), In-App (Switch — locked ON for compliance events) | no per-row actions (the Switches are the actions)

**Forms**:
- Channels row: 4 channel cards (read-only display with verified badge + Test button — no editable fields).
- Quiet Hours form: master Switch, From time, To time, Critical override Switch.
- Event matrix: per-cell Switch (some locked).
- Frequency caps form: Max per hour, Max per day, Daily Digest Switch.

**Actions**:
- "Test Channel" (per channel card) → fires a test notification + toast "{Channel} test sent".
- Quiet Hours master Switch → toggles quiet hours.
- Event matrix Switch → toggles the channel for that event (locked cells show a tooltip "Required for compliance — cannot be disabled").
- "Reset to defaults" → restores the default matrix + toast "Reset to defaults".
- "Save changes" / "Save Preferences" → persists matrix to user preferences store + toast "Preferences saved".
- "Discard changes" → reverts to last-saved state + toast "Changes discarded".
- Sticky save bar shows change counter ("3 unsaved changes").

**Dialogs / Modals / Sheets**:
- (No nested modals — the matrix is fully inline. Validation toasts appear inline as error text under the relevant row.)

---

## 255. API Tokens Cross-link (view-id: `profile-api-tokens`) [NEW]

**Purpose**: Cross-link from Profile to Token Management filtered to the current user. Shows the user's own API tokens with quick generate / revoke actions, without navigating away from the Profile context.

**Layout** (top-to-bottom):
1. PageHeader — title "My API Tokens", description, actions: "Generate token" primary + "Open full token management" outline (navigates to `token-management`).
2. KPI row (3 MetricCards) — My Active Tokens, My Revoked Tokens, My 24h Calls.
3. Tokens DataTable — paginated, sortable.

**Tables**:
- My tokens table: Key (monospace preview), Scopes (Badges), Created (date), Last Used (relative), Status (StatusBadge), 24h Calls (numeric) | per-row: Copy (Copy icon) + Revoke (Ban icon, destructive — only for active)

**Forms**:
- Generate Token Sheet (same as Token Management, but `userId` pre-set to current user).

**Actions**:
- "Generate token" → opens Generate Token Sheet (pre-set to current user).
- Per-row "Copy" → `navigator.clipboard.writeText(token.keyFull)` + toast.
- Per-row "Revoke" → opens Revoke Token AlertDialog.
- Per-row click → `navigate("token-detail", { id: token.id })`.
- "Open full token management" → `navigate("token-management")`.

**Dialogs / Modals / Sheets**:
- Generate Token Sheet (NEW — same shape as Token Management's, but `userId` pre-set to current user).
- Revoke Token AlertDialog (NEW — same as Token Management's).

---

# Batch 52 — Notifications Module (Screens 256-260)

## 256. Notification Center (view-id: `notifications`) [EXISTING]

**Purpose**: Consolidated view of all notifications — platform notifications, triggered price alerts, and recent live activity. Select mode for bulk mark-read.

**Layout** (top-to-bottom):
1. PageHeader — title "Notification Center", description "{N} unread · {M} triggered alerts", actions: "Select" toggle button (outline ↔ primary when active) + (conditional) "{N} selected" + "Mark read" + "Select all" + "Mark all read" outline + "Clear alerts" outline (only when triggered alerts > 0).
2. KPI row (4 MetricCards) — Unread, Triggered Alerts, Total Items, Critical.
3. Filter bar — Filter icon + 4 filter buttons: All / Unread / Alerts / Activity (with counts in parentheses).
4. Notifications list Card — vertical list of notification items.

**Per-item content** (notifications list):
- Severity icon + tone (info / success / warning / critical).
- Module badge (optional).
- Title + message text.
- Timestamp.
- Select mode checkbox (when select mode is on).
- "Snooze" / "Delete" / "Mute this type" inline actions (NEW sub-flows, missing).

**Tables**: none (this is a vertical list, not a DataTable).

**Forms**: none.

**Actions**:
- "Select" toggle → enters/exits select mode.
- "Mark read" (select mode) → marks all selected notifications as read.
- "Select all" (select mode) → selects all filtered items.
- "Mark all read" → marks every notification as read.
- "Clear alerts" → clears all triggered price alerts.
- Per-item click → marks as read (currently — should open Notification Detail Dialog, NEW Batch 52).
- Per-item "Snooze" (NEW sub-flow, missing) → opens Snooze AlertDialog with duration Select.
- Per-item "Delete" (NEW sub-flow, missing) → opens Delete Notification AlertDialog.
- Per-item "Mute this type" (NEW sub-flow, missing) → opens Mute Type Sheet with mute duration Select.
- Filter bar button click → filters list.
- Price alert item click (NEW sub-flow, missing — currently not clickable) → `navigate("trading-credentials")` or chart view for the symbol.
- "Create ticket from notification" (NEW sub-flow, missing) — for support alerts → `navigate("support-tickets", { subject: notification.title })` (deep-link to create ticket).
- "Notification preferences" link (NEW sub-flow, missing) → `navigate("notification-preferences-matrix")`.
- Filter by module / severity / date range (NEW sub-flows, missing) — additional filter Selects.
- "Export notifications CSV" (NEW sub-flow, missing) — outline button → `exportToCsv`.
- "Archived" tab (NEW sub-flow, missing) — fourth tab showing archived/snoozed items (see Batch 52).

**Dialogs / Modals / Sheets**:
- Notification Detail Dialog (NEW — see Batch 52).
- Snooze AlertDialog (NEW sub-flow, missing) → AlertDialogContent: title "Snooze this notification?", duration Select (1h / 4h / 1d / 1w), "Snooze" primary.
- Delete Notification AlertDialog (NEW sub-flow, missing) → simple destructive confirmation.
- Mute Type Sheet (NEW sub-flow, missing) → right-side Sheet: notification type (read-only), mute duration Select, "Mute" primary.

---

## 257. Notification Detail Dialog (view-id: `notification-detail-dialog`) [NEW]

**Purpose**: Per-notification detail dialog showing the full message, related entity link, and per-notification actions. Reached by clicking a notification item in the Notification Center.

**Layout** (rendered inside a full-screen Dialog):
1. DialogHeader — Severity icon + module badge + title + timestamp + close (X) button.
2. Body — full message text (Markdown rendered), related entity Card (clickable cross-link), action buttons (vary by notification type — e.g., "Approve payout" for payout-pending notifications, "View breach" for risk-breach notifications).
3. DialogFooter — "Snooze" outline + "Mute this type" outline + "Mark as unread" outline + "Delete" destructive + "Open related" primary.

**Per-action buttons** (vary by notification type):
- Payout-pending: "Approve payout" + "Reject payout" outline + "View payout" primary.
- Risk-breach: "View breach" primary.
- KYC-pending: "Open KYC review" primary.
- Challenge-passed: "Issue certificate" outline + "View challenge" primary.
- AI-insight: "View insight" primary + "Create ticket" outline.
- Price-alert: "View chart" primary + "Edit alert" outline + "Delete alert" destructive.

**Forms**: none.

**Actions**:
- "Snooze" → opens Snooze AlertDialog (sub-dialog — same as Notification Center's).
- "Mute this type" → opens Mute Type Sheet.
- "Mark as unread" → marks notification as unread + closes Dialog.
- "Delete" → opens Delete Notification AlertDialog.
- "Open related" / per-type action button → `navigate` to the underlying entity's detail page.
- Close (X) → closes Dialog.
- "Create ticket" (AI insight) → `navigate("support-tickets", { subject: notification.title })`.

**Dialogs / Modals / Sheets**:
- Snooze AlertDialog (nested sub-dialog — same as Notification Center's).
- Mute Type Sheet (nested sub-sheet — same as Notification Center's).
- Delete Notification AlertDialog (nested sub-dialog — same as Notification Center's).

---

## 258. Archived / Snoozed Notifications (view-id: `notifications-archived`) [NEW]

**Purpose**: View of previously-snoozed and manually-archived notifications. Provides a path to restore or permanently delete.

**Layout** (top-to-bottom):
1. PageHeader — title "Archived & Snoozed Notifications", description, action: "Back to active" outline.
2. Tabs (snoozed / archived) — `TabsList` with two triggers.
3. KPI row (4 MetricCards) — Snoozed (count), Avg Snooze Remaining, Archived 30d (count), Auto-deleted 30d (count).
4. Filter bar — bordered strip: search Input, module Select, severity Select, date range Select, Clear button.
5. Notifications list Card — vertical list (same shape as Notification Center).

**Per-item content** (snoozed list):
- Snooze icon + module badge + title + message text.
- Snoozed at timestamp.
- Resurfaces at timestamp (warning tone when < 24h).
- "Restore now" outline button + "Delete" destructive button + "Edit snooze" outline button.

**Per-item content** (archived list):
- Archive icon + module badge + title + message text.
- Archived at timestamp.
- "Restore" outline button + "Delete permanently" destructive button.

**Tables**: none (vertical list).

**Forms**: none.

**Actions**:
- Tab trigger click → swaps the list data source.
- Per-snoozed-item "Restore now" → restores to active list + toast "Notification restored".
- Per-snoozed-item "Edit snooze" → opens Edit Snooze Sheet (sub-sheet with new duration Select).
- Per-snoozed-item "Delete" → opens Delete Notification AlertDialog.
- Per-archived-item "Restore" → restores to active list + toast.
- Per-archived-item "Delete permanently" → opens Delete Notification AlertDialog (irreversible).
- Filter bar Selects + search → drive the filtered list.
- "Back to active" → `navigate("notifications")`.
- "Export archived CSV" (NEW sub-flow) → `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Edit Snooze Sheet (NEW sub-flow) → right-side Sheet: current snooze end (read-only), new duration Select, "Save" primary.
- Delete Notification AlertDialog → destructive confirmation.

---

## 259. Per-Module Notification Feed (view-id: `notifications-module-feed`) [NEW]

**Purpose**: Single-module notification feed — "only payouts" or "only risk alerts". Accessed from the Notification Center filter bar "By module" Select, or from a module's own notification bell.

**Layout** (top-to-bottom):
1. PageHeader — title "{Module Name} Notifications", description, actions: "Back to all" outline + "Module preferences" outline (deep-link to Notification Preferences Matrix filtered to this module).
2. KPI row (4 MetricCards) — Unread, Triggered Alerts, Total 30d, Critical 30d.
3. Filter bar — bordered strip: search Input, severity Select, event type Select (per-module event types — e.g., for Payouts: payout.requested / payout.approved / payout.rejected / payout.completed), date range Select, Clear button.
4. Module feed list Card — vertical list filtered to this module only.

**Per-item content** (same as Notification Center item, but with module badge always set to the current module).

**Tables**: none (vertical list).

**Forms**: none.

**Actions**:
- "Back to all" → `navigate("notifications")`.
- "Module preferences" → `navigate("notification-preferences-matrix", { module: currentModule })`.
- Per-item click → opens Notification Detail Dialog.
- Per-item inline actions (Snooze / Delete / Mute) — same as Notification Center.
- Filter bar Selects + search → drive the filtered list.
- "Export module feed CSV" (NEW sub-flow) → `exportToCsv`.

**Dialogs / Modals / Sheets**:
- Notification Detail Dialog (nested — same as Batch 52).
- Snooze AlertDialog, Delete Notification AlertDialog, Mute Type Sheet — same as Notification Center.

---

## 260. Notification Preferences Matrix — Notifications Context (view-id: `notification-preferences-matrix-notifications`) [NEW]

**Purpose**: Same unified matrix as Profile (Batch 51, screen 254), but accessed from the Notification Center "Notification preferences" link. Slight context difference: emphasized as the unified notification-preferences surface (rather than a per-user preference).

**Layout** (top-to-bottom — same structure as the Profile variant):
1. PageHeader — title "Notification Preferences", description, actions: "Reset to defaults" outline + "Save changes" primary + sticky save bar at the bottom.
2. Breadcrumb — "Notifications / Preferences" (vs. "Profile / Preferences" for the Profile variant).
3. Channels Row — 4 Cards: Email Delivery, SMS Routing, Push Notification, In-App Center. Each with verified badge + "Test Channel" outline button.
4. Quiet Hours Window Card — master Switch + From + To + Critical override.
5. Event Matrix table — 5 sections × 2-5 rows × 4 channels.
6. Frequency Caps & Summaries Card — Max per hour, Max per day, Daily Digest Switch.
7. Sticky Save Bar — change counter + "Discard changes" + "Save Preferences".

**Tables**: same as Profile variant.

**Forms**: same as Profile variant.

**Actions**: same as Profile variant — "Test Channel", matrix Switches, "Reset to defaults", "Save", "Discard".

**Dialogs / Modals / Sheets**: same as Profile variant (no nested modals).

---

# Batch 53 — Help Module (Screens 261-265)

## 261. Help (view-id: `help`) [EXISTING]

**Purpose**: Static architecture overview page explaining how the PFaaS platform composes the frontend — 6 principle cards + module registry badge list.

**Layout** (top-to-bottom):
1. PageHeader — title "Platform Architecture", description "How the PFaaS platform composes the frontend."
2. Principles grid (1/2/3 columns responsive) — 6 Cards: Modular platform, Permission-driven, White-label, Dynamic navigation, Widget dashboards, Plug-and-play. Each card: icon tile + title + description.
3. Module registry Card — header "Module registry ({N} registered · {M} enabled)" + Badge list of all modules (default variant when enabled, outline when disabled).

**Per-card content** (principles):
- Icon tile + title + 1-sentence description.

**Forms**: none.

**Actions**:
- Module badge click (NEW sub-flow, missing — currently badges are not clickable) → `navigate("module-detail", { id: moduleId })` or `navigate("settings-module-detail", { id: moduleId })` depending on context.
- Principle card click (NEW sub-flow, missing) → opens Principle Deep-Dive Modal.
- Search Input (NEW sub-flow, missing) — in PageHeader actions area.
- Architecture diagram visual (NEW sub-flow, missing) — Card below principles showing a Mermaid-rendered diagram of the module composition flow.
- External docs links (NEW sub-flow, missing) — Card with links to design system docs, API reference, GitHub repo.
- "What's new" / changelog (NEW sub-flow, missing) — see Batch 53.
- Support contact CTA (NEW sub-flow, missing) — see Batch 53.
- FAQ section (NEW sub-flow, missing) — see Batch 53.
- "Report a bug" CTA (NEW sub-flow, missing) — outline button → opens Report Bug Sheet (sub-form with title + description + severity + screenshot upload).

**Dialogs / Modals / Sheets**:
- Principle Deep-Dive Modal (NEW sub-flow, missing) → full modal with expanded principle description, related design tokens, code example, and related modules list.
- Report Bug Sheet (NEW sub-flow, missing) → right-side Sheet: title Input, description Textarea, severity Select, screenshot file input, "Submit bug" primary.

---

## 262. Help Center / FAQ (view-id: `help-center-faq`) [NEW]

**Purpose**: Searchable FAQ + knowledge base for prop-admin operators (mirrors the trader-dashboard's help-center page, but scoped to admin-operator concerns).

**Layout** (top-to-bottom):
1. PageHeader — title "Help Center & Knowledge Base", description.
2. Hero search bar — large Input with search icon prefix + tag chips below ("Onboarding", "Roles & Permissions", "Modules", "Audit", "Integrations").
3. Live status pill + quick metrics banner — "System Status: All Trading Engines, Liquidity Bridges & Gateways Operational" + "Avg KYC: 11 mins" + "Payout SLA: Same Day".
4. Browse by Topic grid (1/2/3 columns responsive) — 6 category Cards: Account & Access, Modules & RBAC, Tenants & Lifecycle, Risk & Compliance, Integrations, Audit & Reports. Each card: icon + title + article count + description + "Explore {topic} Guides" CTA.
5. Editorial visual feature — "Admin Operator Handbook 2024" deep-dive PDF Card.
6. FAQ accordion — 6 items in an `Accordion` (single-open behavior, searchable).
7. "Still Need Help?" CTA Card — "Create Support Ticket" primary → `navigate("support-contact")`.

**Per-card content** (Browse by Topic):
- Icon tile + title + "{N} articles" + description + "Explore" CTA text.

**Forms**: none.

**Actions**:
- Search bar Input → filters both the topic cards and FAQ items live.
- Tag chip click → sets the search query.
- Topic card click → opens Topic Articles Sheet (NEW sub-flow, right-side Sheet listing all articles in that topic).
- FAQ accordion item click → expands inline.
- "Download handbook" (editorial feature) → triggers PDF download.
- "Create Support Ticket" → `navigate("support-contact")`.
- "Back to Help" → `navigate("help")`.

**Dialogs / Modals / Sheets**:
- Topic Articles Sheet (NEW sub-flow) → right-side Sheet listing all articles in the clicked topic, with per-article title + 1-line summary + "Read article" outline button → opens Article Detail Modal.
- Article Detail Modal (NEW sub-flow, missing) → full modal with Markdown-rendered article body + table of contents sidebar + "Was this helpful?" thumbs up/down + "Report issue" outline.

---

## 263. Changelog / What's New (view-id: `help-changelog`) [NEW]

**Purpose**: Chronological list of platform changes — version-by-version changelog with feature highlights, bug fixes, and breaking changes.

**Layout** (top-to-bottom):
1. PageHeader — title "What's New", description, actions: "Subscribe to changelog" outline + "RSS feed" outline.
2. Filter bar — bordered strip: version Select (All / per-version), category Select (All / Features / Fixes / Breaking Changes / Security), date range Select, Clear button.
3. KPI row (3 MetricCards) — Releases 30d, Features 30d, Fixes 30d.
4. Changelog timeline — vertical timeline, one Card per release.

**Per-release Card content**:
- Version badge (e.g., "v2.4.1") + release date + release tone (major / minor / patch).
- Sections: ✨ Features, 🐛 Bug Fixes, ⚠️ Breaking Changes, 🔒 Security (each section is a sub-list).
- "View full release notes" outline → opens Release Notes Modal.
- "View on GitHub" outline (external link).

**Tables**: none (timeline list).

**Forms**: none.

**Actions**:
- "Subscribe to changelog" → opens Subscription Sheet (email / Slack / RSS).
- "RSS feed" → opens RSS URL in a new tab.
- Filter bar Selects → drive the filtered timeline.
- Per-release "View full release notes" → opens Release Notes Modal.
- Per-release "View on GitHub" → opens GitHub release page in new tab.
- "Mark as read" per-release (NEW sub-flow, missing) — icon button → marks as read.

**Dialogs / Modals / Sheets**:
- Subscription Sheet (NEW sub-flow) → right-side Sheet: email Input, Slack webhook Input, RSS URL display + Copy button, "Subscribe" primary.
- Release Notes Modal (NEW sub-flow) → full modal with Markdown-rendered release notes + migration guide (for breaking changes) + asset downloads.

---

## 264. Support Contact (view-id: `support-contact`) [NEW]

**Purpose**: Support contact surface for prop-admin operators — submit a ticket, view existing tickets, contact options (Slack, email, phone for enterprise).

**Layout** (top-to-bottom):
1. PageHeader — title "Support & Contact", description.
2. KPI row (4 MetricCards) — My Open Tickets, Avg Response Time, SLA Adherence, Satisfaction Score.
3. Two-column grid (`lg:grid-cols-[1fr_1.4fr]`):
   - Left column — Contact Options Card: Slack (with "Join #prop-admin-support" button), Email (mailto link), Phone (enterprise plan only, with hours), Live Chat (online indicator + "Start chat" button).
   - Right column — Submit New Ticket Card (form).
4. My Recent Tickets Card — DataTable of the operator's last 10 tickets.

**Tables**:
- Recent tickets table: Ticket # (monospace), Subject (text), Status (StatusBadge), Priority (StatusBadge), Last Updated (date), Assigned To (avatar + name) | per-row: View (Eye icon → opens Ticket Detail)

**Forms**:
- Submit New Ticket form: Subject (Input, required), Category (Select: Account / Modules / Tenants / Risk / Integrations / Audit / Other), Priority (Select: Low / Medium / High / Critical), Description (Textarea, 8 rows, with Markdown support), Attachments (file input, multi-select), "Submit ticket" primary + "Cancel" outline.

**Actions**:
- "Join #prop-admin-support" → opens Slack deep link.
- Email link → opens mailto.
- Phone — click to call (enterprise plans only).
- "Start chat" → opens Live Chat Widget (bottom-right popover).
- "Submit ticket" → validates form → creates ticket in support queue → toast "Ticket # created" + clears form + prepends to recent tickets list.
- Per-ticket "View" → `navigate("support-ticket-detail", { id: ticket.id })` (cross-link to Support module).
- "View all my tickets" outline → `navigate("support-tickets", { assignedToMe: true })`.

**Dialogs / Modals / Sheets**:
- Live Chat Widget (NEW sub-flow, missing) → bottom-right popover with chat input + message history + "Minimize" / "End chat" buttons.

---

## 265. Onboarding / Getting Started (view-id: `help-onboarding`) [NEW]

**Purpose**: Onboarding checklist for new prop-admin operators — a guided tour of the platform's key surfaces, with progress tracking and "next best action" suggestions.

**Layout** (top-to-bottom):
1. PageHeader — title "Getting Started", description, action: "Resume tour" outline (visible when tour progress > 0).
2. KPI row (3 MetricCards) — Completion %, Steps Completed, Days Since Started.
3. Progress Card — visual progress bar with % + step counter.
4. Onboarding checklist Card — vertical list of steps.
5. "Next best action" Card — highlighted single CTA.
6. Video tutorial library Card — grid of video Cards.

**Per-step content** (checklist):
- Step number + title + description.
- Status badge (Completed / In Progress / Not Started).
- "Start step" outline button (when not started) / "Resume" outline (when in progress) / "Completed ✓" (read-only).
- "Skip step" ghost button.

**Per-video card content**:
- Thumbnail + title + duration + "Watch" primary.

**Forms**: none.

**Actions**:
- "Resume tour" → resumes the onboarding tour (see Batch 55 — Onboarding Tour).
- Per-step "Start" → `navigate` to the relevant surface + marks step as in progress.
- Per-step "Resume" → `navigate` to the relevant surface.
- Per-step "Skip" → marks step as skipped + toast.
- Per-step completion → automatically detected by the platform (e.g., "Create your first tenant" step completes when the operator creates a tenant).
- "Watch" video → opens Video Modal.
- "Restart onboarding" (NEW sub-flow, missing) → outline button → opens Restart AlertDialog.

**Dialogs / Modals / Sheets**:
- Video Modal (NEW sub-flow, missing) → full modal with embedded video player + transcript + "Mark step complete" primary (if the video is part of a step).
- Restart Onboarding AlertDialog (NEW sub-flow, missing) → title "Restart onboarding?", description "Your progress will be reset. Completed steps will become incomplete." Footer Cancel + "Restart" (destructive).

---

# Batch 54 — Help NEW + Overview Module (Screens 266-270)

## 266. Module Detail — Help Context (view-id: `help-module-detail`) [NEW]

**Purpose**: Per-module detail view accessed from Help page's module badges — explains what the module does, its design principles, related modules, and provides deep-links into the module's primary surfaces.

**Layout** (top-to-bottom):
1. Breadcrumb — "Help / Modules / {module name}" with back link.
2. Header row — Module icon tile + name + version badge + category badge + "Open module" primary button (deep-link to the module's primary view).
3. KPI row (4 MetricCards) — Permissions Declared, Adopting Tenants, Dependencies, Last Updated.
4. Two-column grid (`lg:grid-cols-[1.5fr_1fr]`):
   - Left column — stacked Cards: Module Overview (description + key principles + use cases), Design Decisions (list of architectural choices + rationale), Screens Inventory (DataTable of all screens in this module — clickable cross-links).
   - Right column — stacked Cards: Related Modules (Badges with click-through), External Resources (links to design docs / API reference / GitHub), Recent Changes (last 5 changelog entries).

**Tables**:
- Screens inventory table: View ID (monospace), Title (text), Type (badge — Page / Dialog / Sheet), Status (badge — Existing / New) | per-row: Open (Eye icon → `navigate(viewId)`)

**Forms**: none.

**Actions**:
- "Open module" → `navigate(modulePrimaryViewId)`.
- Per-screen row click → `navigate(viewId)`.
- Per-related-module badge click → `navigate("help-module-detail", { id: relatedModuleId })`.
- External resource link → opens in new tab.
- "Edit this documentation" (NEW sub-flow, missing) → outline button → opens Edit Doc Sheet (Markdown editor).

**Dialogs / Modals / Sheets**:
- Edit Documentation Sheet (NEW sub-flow, missing) → right-side Sheet with Markdown editor + preview + "Save" primary.

---

## 267. Overview (view-id: `overview`) [EXISTING]

**Purpose**: Prop-admin landing dashboard — KPI row per enabled module (clickable), GridStack widget dashboard, Live Activity sidebar, Customize dialog, Refresh.

**Layout** (top-to-bottom):
1. PageHeader — title "Welcome, {firstName}", description "{tenantName} · {N} modules active · {primaryRole}", actions: Plan badge + Range toggle (7d / 30d / 90d) + Refresh outline + Customize outline.
2. Attention Center Card — top-priority items needing attention.
3. KPI row (1/2/3/4/5 columns responsive) — per-enabled-module MetricCard (clickable → `navigate(s.href)`).
4. Two-column grid (`lg:grid-cols-[1fr_320px]`):
   - Left column — `<DashboardGrid />` (GridStack drag-and-drop widget dashboard).
   - Right column — Live Activity sidebar (sticky): Live Activity Feed Card + Live Equity Curve Card + Live Price Feed Card + 4 mini stat Cards (Active Traders / Open Positions / Pending Payouts / Open Breaches).
5. Footnote line.

**Per-widget content** (DashboardGrid):
- Each widget renders inside its grid item with a header bar (title + drag handle + per-widget Configure + Remove).
- Widget body varies by type (KPI / Chart / Table / Feed / Map).

**Forms**:
- Customize Dashboard Dialog (per-widget visibility toggles, opened via "Customize" button).

**Actions**:
- Plan badge → no action (display only).
- Range toggle (7d / 30d / 90d) → sets `range` state (NEW sub-flow, missing — currently doesn't change data; should re-fetch KPIs with new range).
- Refresh → spins icon + after 600ms toast "Dashboard refreshed" (currently no data refetch — should re-call `useLiveData()`).
- Customize → opens Customize Dashboard Dialog.
- Per-KPI MetricCard click → `navigate(s.href)`.
- Per-widget Configure (gear icon, NEW sub-flow, missing) → opens Per-Widget Configuration Dialog.
- Per-widget Remove (Trash2 icon) → removes widget from grid + `saveLayout`.
- Per-widget drag → GridStack handles repositioning + `saveLayout` on drop.
- "Add widget" CTA (NEW sub-flow, missing) — visible button on the dashboard → opens Add Widget Sheet with widget library.
- "Share dashboard" / "Export dashboard as PDF" (NEW sub-flow, missing) — outline button.
- "Reset to default layout" inline (NEW sub-flow, missing) — outline button → opens Reset Layout AlertDialog.
- Notification badge for unread alerts (NEW sub-flow, missing) — outline bell icon with count.
- "What's new" banner (NEW sub-flow, missing) — dismissible banner at the top showing the latest release highlights.

**Dialogs / Modals / Sheets**:
- Customize Dashboard Dialog (trigger: "Customize" button) → DialogContent with per-widget Switch toggles (show/hide each widget) + "Save" primary + "Reset to default" outline.
- Per-Widget Configuration Dialog (NEW sub-flow, missing — Batch 55).
- Add Widget Sheet (NEW sub-flow, missing) → right-side Sheet with widget library (categorized list with search) + per-widget "Add" button.
- Reset Layout AlertDialog (NEW sub-flow, missing) → destructive confirmation.
- Share Dashboard Sheet (NEW sub-flow, missing) → right-side Sheet with share URL + email invite + "Copy link" primary.

---

## 268. Per-Widget Configuration Dialogs (view-id: `overview-widget-config`) [NEW]

**Purpose**: Per-widget configuration dialogs opened from the gear icon on each widget in the Overview dashboard. Each widget type exposes its own configuration form.

**Layout** (rendered inside a Dialog; fields vary by widget type):
1. DialogHeader — title "{Widget Name} Configuration" + description.
2. Form fields (varies by widget type, see below).
3. DialogFooter — Cancel (outline) + "Apply" primary + "Reset to default" outline.

**Forms** (per widget type):
- KPI Card widget: Metric Select (from the module's available metrics), Time Range Select (24h / 7d / 30d / 90d), Refresh Interval Select (Realtime / 5min / 1h / Manual), Display Trend Switch, Display Delta Switch.
- Chart widget: Metric Select (Y-axis), Time Range Select, Chart Type Select (Line / Bar / Area / Stacked), Group By Select (Day / Week / Month), Color Select.
- Table widget: Columns multi-select (checkbox list), Rows per page Select, Sort By Select, Filter preset Select.
- Feed widget: Source Select (all modules / specific module), Max items Select, Severity filter (All / Info / Warning / Critical).
- Map widget: Metric to display (trader count / revenue / breach count), Color scale Select, Region Select (Global / Europe / Americas / APAC).

**Actions**:
- "Apply" → persists config to widget instance + `saveLayout` + closes Dialog + toast "Widget configured".
- "Reset to default" → restores widget's default config.
- "Cancel" → closes without saving.
- Form field change → live preview in the dialog body (mini render of the widget with current config).

**Dialogs / Modals / Sheets**:
- (Self-contained Dialog — no nested modals.)

---

## 269. Dashboard Template Library (view-id: `dashboard-template-library`) [NEW]

**Purpose**: Library of pre-built dashboard templates — "Save this layout as a template" + browse community templates + apply templates to the current dashboard.

**Layout** (top-to-bottom):
1. PageHeader — title "Dashboard Template Library", description, actions: "Save current as template" primary + "Import template" outline (upload JSON).
2. Tabs (my-templates / community / platform-defaults) — `TabsList` with three triggers.
3. Filter bar — search Input, category Select (Operations / Risk / Trading / Executive / Compliance), tag Select, Clear button.
4. Templates grid (1/2/3 columns responsive) — Card per template.

**Per-template Card content**:
- Thumbnail preview (mini render of the dashboard layout).
- Name + author + plan badge.
- Tags (Badges).
- Last applied date.
- "Apply" primary + "Preview" outline + 3-dot menu (Duplicate / Export / Delete).

**Forms**:
- Save Current as Template Sheet (see below).
- Import Template Sheet (see below).

**Actions**:
- "Save current as template" → opens Save Current as Template Sheet.
- "Import template" → opens Import Template Sheet.
- Tab trigger click → swaps the templates data source.
- Per-template "Apply" → opens Apply Template AlertDialog (with overwrite warning if current layout is custom).
- Per-template "Preview" → opens Template Preview Modal.
- Per-template 3-dot "Duplicate" → `duplicateTemplate(templateId)` + toast.
- Per-template 3-dot "Export" → triggers JSON download.
- Per-template 3-dot "Delete" → opens Delete Template AlertDialog (only for my-templates).

**Dialogs / Modals / Sheets**:
- Save Current as Template Sheet (trigger: "Save current as template" button) → right-side Sheet: Name (Input, required), Description (Textarea), Category (Select), Tags (chip input), Visibility (Select: Private / Tenant-wide / Platform-wide — platform-wide only for super-admin), "Save template" primary → persists current layout as a template + toast.
- Import Template Sheet (trigger: "Import template" button) → right-side Sheet: file Input (accept .json), preview of detected widgets, "Import" primary → parses JSON + adds to my-templates + toast.
- Apply Template AlertDialog (trigger: per-template "Apply") → AlertDialogContent: title "Apply template {name}?", description "Your current layout will be replaced. You can undo via Reset." Footer Cancel + "Apply" (primary).
- Template Preview Modal (trigger: per-template "Preview") → full modal with full-size render of the dashboard + widget list + "Apply this template" primary.
- Delete Template AlertDialog (trigger: per-template 3-dot "Delete") → destructive confirmation.

---

## 270. Saved Views / Multi-dashboard Switcher (view-id: `overview-saved-views`) [NEW]

**Purpose**: Multi-dashboard switcher — save the current dashboard state as a named view, switch between saved views, share views with the team.

**Layout** (top-to-bottom):
1. PageHeader — title "Saved Views", description, actions: "Save current view" primary + "Import view" outline.
2. KPI row (3 MetricCards) — My Views, Shared with Team, Starred.
3. Filter bar — search Input, tag Select, sort Select (Last Used / Recently Created / Alphabetical), Clear button.
4. Views grid (1/2/3 columns responsive) — Card per saved view.

**Per-view Card content**:
- Thumbnail preview (mini render).
- Name + created date + last used date.
- Tags (Badges).
- Star icon (toggle).
- "Open" primary + "Edit" outline + 3-dot menu (Duplicate / Share / Export / Delete).

**Forms**:
- Save Current View Sheet (see below).
- Edit View Sheet (see below).
- Share View Sheet (see below).

**Actions**:
- "Save current view" → opens Save Current View Sheet.
- "Import view" → opens Import View Sheet (file input).
- Per-view "Open" → applies the view to the current dashboard + `navigate("overview")`.
- Per-view "Edit" → opens Edit View Sheet.
- Per-view star icon → toggles starred state + persists + toast.
- Per-view 3-dot "Duplicate" → `duplicateView(viewId)` + toast.
- Per-view 3-dot "Share" → opens Share View Sheet.
- Per-view 3-dot "Export" → triggers JSON download.
- Per-view 3-dot "Delete" → opens Delete View AlertDialog.

**Dialogs / Modals / Sheets**:
- Save Current View Sheet (trigger: "Save current view" button) → right-side Sheet: Name (Input, required), Description (Textarea), Tags (chip input), Set as default Switch, "Save view" primary → persists current dashboard state as a view + toast.
- Edit View Sheet (trigger: per-view "Edit") → right-side Sheet: Name, Description, Tags, Set as default, "Save changes" primary.
- Share View Sheet (trigger: per-view 3-dot "Share") → right-side Sheet: share with team Select (multi-select), share with tenant Switch, "Share" primary → grants view access + toast.
- Import View Sheet (trigger: "Import view" button) → right-side Sheet: file Input (accept .json), preview, "Import" primary.
- Delete View AlertDialog (trigger: per-view 3-dot "Delete") → destructive confirmation.

---

# Batch 55 — Overview NEW (Screen 271)

## 271. Onboarding Tour (view-id: `overview-onboarding-tour`) [NEW]

**Purpose**: Guided tour for first-time prop-admin users — walks through the platform's key surfaces with highlight overlays, tooltips, and step-by-step instructions.

**Layout** (rendered as an overlay on top of the Overview dashboard, not a separate page):
1. Tour overlay — dimmed background + spotlight on the current step's target element + tooltip Card positioned next to the target.
2. Tooltip Card content: Step number + title + description + animated GIF or static image (optional).
3. Tour progress bar — bottom of the screen, showing current step / total steps.
4. Tour controls — "Skip tour" ghost + "Back" outline + "Next" primary + "Got it" primary (last step).

**Tour steps** (suggested, ~8 steps):
1. Welcome — "Welcome to {tenantName}! This tour walks you through the prop-admin dashboard." (Centered modal, no target.)
2. KPI row — "These KPIs update live from your platform data. Click any one to navigate to the underlying module."
3. Attention Center — "Items needing your attention appear here. Click any item to handle it."
4. Dashboard widgets — "This is your customizable dashboard. Drag widgets to rearrange, click the gear icon to configure each widget."
5. Live Activity sidebar — "Real-time platform activity streams here. Stay on top of every event as it happens."
6. Range toggle — "Switch between 7-day, 30-day, and 90-day views. KPIs and charts re-fetch on toggle."
7. Customize button — "Click Customize to show or hide widgets, or to add new ones from the widget library."
8. Profile menu — "Your profile, preferences, and 2FA setup live here. Complete your profile to enable 2FA."
9. Complete — "You're ready to go! Explore the sidebar — every module is a click away." (Centered modal, no target.)

**Forms**: none.

**Actions**:
- "Skip tour" → closes the tour overlay + marks tour as skipped + toast "Tour skipped — you can resume from Help → Getting Started".
- "Back" → goes to previous step.
- "Next" → advances to next step + records step-completed audit entry.
- "Got it" (last step) → closes the tour + marks tour as complete + toast "Onboarding complete".
- Per-step target highlight → auto-detected via CSS selector; if the target is not visible (e.g., the user is on a different page), the tour auto-navigates to the correct page first.
- "Restart tour" (from Help → Getting Started) → opens Restart Tour AlertDialog.
- Auto-pause on navigation away (NEW sub-flow, missing) — if the user navigates away mid-tour, the tour pauses and shows a "Resume tour" banner on the new page.

**Dialogs / Modals / Sheets**:
- Restart Tour AlertDialog (trigger: "Restart tour" from Help → Getting Started) → AlertDialogContent: title "Restart onboarding tour?", description "Your previous progress will be reset. The tour will start from step 1." Footer Cancel + "Restart" (primary).
- Resume Tour Banner (NEW sub-flow, missing) → inline banner on the new page when tour is auto-paused, with "Resume tour" primary + "Dismiss" ghost.

---

# Summary

## Batch Coverage

| Batch | Module | Screens | View IDs |
|-------|--------|---------|----------|
| 40 | Settings (5) | 196-200 | settings, user-management, team-members, group-management, banner-management |
| 41 | Settings (5) | 201-205 | marketing-integrations, social-media-links, marketing-banner-edit, token-management, token-detail |
| 42 | Settings (5) | 206-210 | device-activities, kyc-providers, email-templates, email-template-edit, notifications-management |
| 43 | Settings (5) | 211-215 | notification-edit, certificate-management, certificate-template-designer, certificate-detail, certificates-issued |
| 44 | Settings (5) | 216-220 | certificate-font-upload, utilities, roles-management, csv-import-dialog (NEW), add-group-sheet (NEW) |
| 45 | Settings + Super-Admin (5) | 221-225 | kyc-provider-marketplace (NEW), user-audit-timeline (NEW), device-detail (NEW), settings-module-detail (NEW), super-overview |
| 46 | Super-Admin (5) | 226-230 | tenants, module-catalog, platform-health, create-tenant, tenant-detail |
| 47 | Super-Admin (5) | 231-235 | tenant-lifecycle, dashboard-manager, platform-audit, platform-staff, platform-roles |
| 48 | Super-Admin (5) | 236-240 | role-audit, permissions-catalog, super-module-detail (NEW), service-detail (NEW), super-admin-user-audit-timeline (NEW) |
| 49 | Super-Admin + Pendings (5) | 241-245 | tenant-billing-detail (NEW), incident-management (NEW), tenant-impersonation-audit (NEW), platform-module-toggle (NEW), pending-tasks |
| 50 | Pendings + Profile (5) | 246-250 | pending-task-detail (NEW), my-tasks (NEW), pending-snoozed-resolved (NEW), pending-bulk-assign (NEW), profile |
| 51 | Profile (5) | 251-255 | change-password-dialog (NEW), 2fa-setup-dialog (NEW), connected-sessions-detail (NEW), notification-preferences-matrix (NEW), profile-api-tokens (NEW) |
| 52 | Notifications (5) | 256-260 | notifications, notification-detail-dialog (NEW), notifications-archived (NEW), notifications-module-feed (NEW), notification-preferences-matrix-notifications (NEW) |
| 53 | Help (5) | 261-265 | help, help-center-faq (NEW), help-changelog (NEW), support-contact (NEW), help-onboarding (NEW) |
| 54 | Help + Overview (5) | 266-270 | help-module-detail (NEW), overview, overview-widget-config (NEW), dashboard-template-library (NEW), overview-saved-views (NEW) |
| 55 | Overview (1) | 271 | overview-onboarding-tour (NEW) |

## Screen Count by Module

| Module | Existing | NEW | Total |
|--------|----------|-----|-------|
| 15 — Settings | 23 | 6 | 29 |
| 16 — Super-Admin | 13 | 7 | 20 |
| 17 — Pendings | 1 | 4 | 5 |
| 18 — Profile | 1 | 5 | 6 |
| 19 — Notifications | 1 | 4 | 5 |
| 20 — Help | 1 | 5 | 6 |
| 21 — Overview | 1 | 4 | 5 |
| **Total** | **41** | **35** | **76** |

## Notable Shared Screens (written twice with context-specific content)

- **Per-User Audit Timeline** — appears in Settings (Batch 45, screen 222) and Super-Admin (Batch 48, screen 240). The Settings variant is tenant-scoped; the Super-Admin variant is cross-tenant with an impersonation trail sub-view.
- **Notification Preferences Matrix** — appears in Profile (Batch 51, screen 254) and Notifications (Batch 52, screen 260). Same structure; different breadcrumb and contextual framing.

## Critical Design Patterns Applied Throughout

1. **Progressive disclosure** — advanced fields behind Collapsibles; detail panels via Sheets rather than separate pages.
2. **Single primary action per surface** — each PageHeader has exactly one primary button; secondary actions as outline.
3. **Destructive actions wrapped in AlertDialog** — explicit consequence text + Cancel + destructive confirm.
4. **Bulk operations** — checkbox columns reveal bulk action bars; bulk Confirm uses per-row decision matrix where appropriate.
5. **Audit trail on every mutation** — role.assigned / permission.granted / etc. events flow into Role Audit Log and Per-User Audit Timeline.
6. **Permission guards on mutation buttons** — `disabled={!canManage}` with tooltip "Requires the Manage roles permission".
7. **Real persistence** — Save / Delete / Revoke / Toggle actions mutate the underlying store (RBAC store, mock data, or `localStorage`); toasts confirm the mutation after it lands.
8. **Mobile-first responsive** — all grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` patterns; touch targets ≥ 44px.
9. **Sticky footer** — root wrapper uses `min-h-screen flex flex-col` with `mt-auto` on the footer.
10. **Custom scrollbars** — long lists use `max-h-96 overflow-y-auto` with custom scrollbar styling.

## Missing Screens and Sub-Flows Explicitly Designed Here

Every screen and sub-flow called out in the audit's "Missing" lists for Modules 15-21 is given a full spec entry in this document. The design team can hand this document to the Stitch design tool to generate pixel-perfect mockups for each entry, in batches of 5, starting at Batch 40.

---

*End of Part 4 of 4. Total: 76 screen spec entries across 16 batches (40-55), covering all 7 modules in scope.*
