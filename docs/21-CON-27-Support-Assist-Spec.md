# CON-27: Support Assist - Cross-Tenant Support Read Path

## Purpose
The Support Assist screen provides a read-only mirror of a tenant's support ticket queue, enabling cross-tenant triage and audit visibility without allowing direct manipulation of tenant data. This is the console-side counterpart to the tenant's own support panel, maintaining the impersonation pattern established in CON-07.

## Scope
- **Scope**: Cross-tenant, read-only view of a tenant's support tickets (CON-27).
- **Purpose**: Enable triage and audit visibility without allowing direct action (reply, resolve, escalate).
- **Scope Boundary**: Console-side only; all actionable elements must redirect to tenant-owned support panel (docs/18).
- **Data Contract**: Reads from `support-store.ts` (shared contract), writes audit events to `console-store.ts` (CON-09 mirror).
- **Audience**: Super-admin (SUP), platform-admin (ADM) operators.

## Contract & Data Flow
1. **Data Source**: `support-store.ts` (platform-admin lib) - single source of truth for `SupportTicketRecord` objects.
2. **Seeding**: Migrated from `mock-data.ts` (14 tickets × 3 tenants = 42 total).
3. **Consumer Path**:
   - `support-assist-page.tsx` → `useSupportTickets()` → `supportTickets` (derived from `support-store.ts`)
   - `global-search.tsx` → `getTenantTickets()` → `support-assist-page.tsx`
   - `platform-overview.tsx` → `getTenantTickets()` → `platform-overview-page.tsx`
   - `cross-tenant-queues-page.tsx` → `getTenantTickets()` → `CrossTenantQueuesPage`
4. **Tenant Realm**:
   - `prop-admin/src/modules/stitch/pages/support-tickets.tsx` → binds to shared `support-store.ts` contract.
   - Removes hardcoded "184 Tickets" and `{{trader_name}}` template stubs.

## UI & Behavior Requirements
1. **Tenant Picker**:
   - Shows only tenants with support tickets.
   - Displays lifecycle status badge (suspended/terminated) next to tenant name.
   - Empty state: "No tenant selected" with clear instruction.
   - "All tenants" mode when no tenant param is present (aggregate view).
2. **Empty Picker State**:
   - Distinct empty state for "no tenant has tickets yet" (separate from "no tenant selected").
   - Clear copy: "Pick a tenant above to view its support queue."
3. **Search & Filters**:
   - Search: by subject, trader name, ticket ID, category, or assignee.
   - Status filter: chips for "Open", "In Progress", "Waiting", "Resolved", "Closed".
   - Priority filter: chips for "Urgent", "High", "Medium", "Low".
   - Sort: toggle between "Newest" and "Priority" (urgent → high → medium → low).
   - Clear filters: dedicated button to reset all filters.
4. **Ticket List**:
   - Each row is a button with `data-readonly-allow` attribute.
   - Status badge uses `statusTone()` mapping with distinct tones:
     - `resolved` → "outline" (distinct from `in-progress`)
     - `closed` → "secondary" + line-through (distinct from `open`)
   - Priority badge uses `priorityTone()`.
   - Clicking a row sets `selected` state and opens detail pane.
5. **Detail Pane**:
   - Shows metadata grid (trader, category, priority, messages count, assignee, last reply).
   - Includes "Read-only view" notice with Eye icon.
   - Includes "Open {tenant} detail" button with ArrowRight icon.
   - Shows last reply timestamp.
   - Shows "This console view is for cross-tenant context only" notice with CON-09 citation.
6. **Empty States**:
   - No tenant selected: "Pick a tenant above to view its support queue."
   - No tickets match: "Nothing matches '{query}'." or "No tickets yet."
   - Empty list: "All clear" with hint to simulate.
7. **Audit Trail**:
   - `console.support_assist_open` audit event with tenantId, severity: info.
   - Detail includes: "Read-only support view opened for {tenant.name} ({tickets.length} tickets) — CON-27 impersonation pattern [impersonation-exempt: {deny-reason}]"
   - Deny reason includes `impersonationDenyReason(tenant)` if applicable.

## Technical Requirements
1. **Contract Ledger**:
   - `support-store.ts` owns `SupportTicketRecord` type and `useSupportTickets()` hook.
   - `mock-data.ts` seeds `supportTickets` array; `getTenantTickets()` re-exports as derived read.
   - `support-assist-page.tsx` uses `useSupportTickets()` for all ticket data.
   - `global-search.tsx` uses `getTenantTickets()` for ticket search results.
2. **URL State**:
   - `parseParams()` and `setQueueFilter()` pattern (cross-tenant-queues-page.tsx).
   - `navigate("support-assist", { tenant, ticket, q })` with `replace: true`.
   - `useEffect` syncs `tenantId`, `query`, `selected` to URL parameters.
3. **Read-Only Controls**:
   - All interactive elements (picker buttons, ticket rows, close X, detail pane close, "Open detail" button) carry `data-readonly-allow` attribute.
   - `ReadOnlyGuard` component permits interaction with `data-readonly-allow` elements during View-As sessions.
4. **Impersonation Exemption**:
   - `impersonationDenyReason(tenant)` returns `null` for allowed tenants.
   - If non-null, renders amber context strip in detail pane with text: "Read-only support access exempt" + deny reason.
   - Audit detail includes `[impersonation-exempt: {deny-reason}]` suffix.
5. **As-of Indicator**:
   - "As of {time}" displayed near refresh button.
   - Refresh re-runs data seam; timestamp updates.

## Known Issues & Workarounds
1. **Current P0-1**: Console mirror shows different ticket counts than tenant panel (P0-1). Fix: Shared `support-store.ts` contract (C1).
2. **P0-2**: Dead CON spec pointers (docs/21, docs/18, etc.) — resolve or inline definitions (C3).
3. **P1-1**: Impersonation exemption not visible — add amber context strip (C7).
4. **P1-2**: ReadOnlyGuard blocks read-only controls — add `data-readonly-allow` to all read controls (C7).
5. **P1-3**: No URL state — add tenant/ticket/q params (C4).
6. **P2-1**: MetricCards not drill-downable — wire `onClick` → filter (C5).
7. **P2-2**: No data freshness indicator — add as-of timestamp + refresh (C8).
5. **P2-3**: Picker shows no tenant status, empty state impossible — add status badges, distinct empty state (C7).
6. **P2-4**: Seed covers only 3 tenants — generate per-tenant tickets (C7).
7. **P2-5**: Detail pane shows no message content — add read-only message excerpt (C8).
8. **P2-6**: Audit vocabularies split — adopt shared action registry (R22 C-plan).

## Success Metrics
1. **Data Consistency**: Console and tenant support panels show identical ticket counts for same tenant.
2. **URL State**: `?view=support-assist&tenant=...&ticket=...&q=...` preserves state on refresh/share/back.
3. **Impersonation**: Deny-listed tenants show amber exemption strip with visible audit suffix.
5. **Read-Only**: All read controls are accessible during View-As session; blocked otherwise.
5. **Filtering**: "urgent ∧ open" reachable in ≤2 clicks; resolved/closed visually distinct from in-progress.
5. **Aggregate**: All-tenants mode answers "which tenants have urgent open tickets" on one screen.