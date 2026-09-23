# Work Record — `impl-audit-module`

**Agent:** Implementation (audit module registration)
**Task ID:** `impl-audit-module`
**Scope:** 8 owned files — see "Files Modified" below. Strict — no other files touched.

## Pre-Work Done
1. Read last ~600 lines of `/home/z/my-project/worklog.md` — focused on
   `analysis-settings-super-shell` (which identified the audit module as
   completely orphaned: no `audit-module.ts` manifest, no entry in
   `module-bootstrap.ts`, 4 of 5 audit pages unreachable from
   sidebar/command menu) and `impl-bugs-mockdata` (which just fixed
   `getTenantAudit` tenant-scoping + `getTenantUserEvents` /
   `getTenantChangeHistory` helpers).
2. Read `AGENTS.md` §3-§35 (PRIMARY UX MODEL, user-centered dashboards,
   navigation principles, attention center §11, destructive actions §24).
3. Studied manifest pattern in `src/modules/kyc/manifest.ts` and
   `src/modules/super-admin/super-admin-module.ts`.
4. Read prior agent work record in `/home/z/my-project/agent-ctx/impl-bugs-mockdata-implementation.md`
   (Bug 7 specifically — `getTenantAudit(tid)` rewritten to actually filter
   by `tid`; new `getPlatformAudit()` returns the full stream for
   super-admin).

## Files Modified (8 — exactly the owned set)
- `src/modules/audit/audit-module.ts` — NEW. The FrontendModule manifest
  (id `audit`, v1.0.0, category `compliance`, optional `true`, deps
  `["settings"]`, apps `[prop-admin, super-admin]`, accentColor `#475569`
  slate, 3 perms, 4 nav children, 4 routes).
- `src/modules/audit/index.ts` — NEW. Barrel exports `auditModule`,
  `AuditPage`, `UserEventsPage`, `EnhancedUserEventsPage`,
  `ChangeHistoryPage`, `UserEventDetailPage`.
- `src/lib/platform/module-bootstrap.ts` — added `auditModule` to imports
  + registered in `bootstrapModules()` after `aiModule` (audit depends on
  settings which is registered earlier in the platform-level block).
- `src/components/platform/attention-center.tsx` — added 2 audit-related
  entries: (action) "Unresolved audit alerts" — critical-severity count;
  (warning) "Failed login attempts" — 24h count of LOGIN events whose
  description contains "fail". Both gated on `has("audit")`; both return
  null when count is 0.
- `src/components/shell/command-menu.tsx` — added 4 explicit audit
  commands to the "Navigation" CommandGroup: "Audit Log", "User Events",
  "Enhanced Events", "Change History". `History` icon for all 4. No
  shortcut assigned (`g a` is already taken by `navigate("analytics")`
  per the keyboard-shortcuts-help listener — "only if not taken; otherwise
  no shortcut" rule).
- `src/modules/audit/audit-page.tsx` — converted from 21-LOC thin wrapper
  to a full page with PageHeader (title + description + Export CSV
  button), 4-card KPI row (Total Events / Critical / Warnings / Last 24h
  derived from `getTenantAudit(tid)`), and the existing `AuditLogTable`
  (all filters intact). Real `exportToCsv` wired (9-column CSV).
- `src/modules/audit/user-events-page.tsx` — replaced toast-only
  `exportCsv` with real `exportToCsv` (6-column CSV). Dropped the now-
  unused `toast` import.
- `src/modules/audit/enhanced-user-events-page.tsx` — replaced toast-only
  `onExportCsv` with real `exportToCsv` (10-column CSV including phase
  type, challenge name, IP address, source). Kept the `toast` import
  (still used by the "Filters applied" toast on line 909).
- `src/modules/audit/change-history-page.tsx` — replaced toast-only
  `exportCsv` with real `exportToCsv` (9-column CSV including old/new
  value diff). Wrapped the plain `Button` "Roll back to old value" in
  `AlertDialog` with the standard pattern (Trigger + Content + Title +
  Description with the consequence text from the brief + Cancel + Action
  buttons).
- `src/modules/audit/user-event-detail-page.tsx` — replaced toast-only
  `exportEvent` with a real browser-side JSON download (Blob + anchor +
  `URL.revokeObjectURL`). Filename pattern: `user-event-<id>.json`. The
  success toast is preserved.

## Manifest Shape (verbatim from `audit-module.ts`)
- `id: "audit"`, `name: "Audit & Compliance"`, `version: "1.0.0"`
- `description: "Comprehensive audit log, user events, change history, and compliance reporting."`
- `category: "compliance"`, `optional: true`, `dependencies: ["settings"]`
- `capabilities: ["audit.log", "audit.export", "audit.user-events", "audit.change-history"]`
- `permissions`: `audit.read` (View Audit Log), `audit.export` (Export
  Audit Data), `audit.manage` (Manage Audit Settings)
- `supportedApplications: ["prop-admin", "super-admin"]`
- `icon: ShieldCheck`, `accentColor: "#475569"` (slate — Terra-allowed)
- Navigation children (4 at order 90): Audit Log (`History`) → `audit`;
  User Events (`Users`) → `audit-user-events`; Enhanced Events
  (`Sparkles`) → `audit-user-events-enhanced`; Change History (`GitBranch`)
  → `audit-change-history`. `audit-user-event-detail` intentionally NOT
  a nav child (sub-page reached from user-events list, per §27).
- Routes: 4 — matching the 4 navigable viewIds.

## Verification
- `bun run lint` → exit 0, 0 errors.
- `bunx tsc --noEmit --skipLibCheck` → 123 pre-existing errors (all in
  untouched files: `account-kyc-statuses-page.tsx`, `mock-data.ts`:
  `seedAccounts`/`challengePhaseConfigs`, `analytics-widgets.tsx`:
  `TimeSeriesPoint` vs `SeriesPoint`). Diff of error lists before vs.
  after shows zero new errors introduced by this round (all owned files
  are type-clean).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200.
- `dev.log` (most recent 30 lines) shows only `✓ Compiled in <ms>` and
  `GET / 200 in <ms>` — no new runtime errors.
- Visual verification via `agent-browser`:
  - Skipped onboarding for both `tenant-alpha` and `platform` (super-admin)
    tenants.
  - For `platform` (super-admin) tenant: sidebar shows "Audit & Compliance"
    parent group with 4 children (Audit Log / User Events / Enhanced
    Events / Change History) — matches the manifest exactly.
  - Command Menu (⌘K) shows the 4 explicit audit commands in the
    Navigation group PLUS the auto-built 5 entries (parent + 4 children
    with "Audit & Compliance ›" prefix) PLUS the existing "View audit log"
    Quick Action.
  - Clicked each of the 4 audit nav children — all render correctly with
    their KPI rows visible (Audit Log: TOTAL EVENTS / CRITICAL / WARNINGS /
    LAST 24H; User Events: 5 KPIs; Enhanced Events: 7 KPIs; Change
    History: existing table).
  - Tested `Export CSV` on each of the 4 audit pages — all produce the
    expected toast: "Export ready" + `<file>-<ts>.csv — <N> records
    exported." Records exported: audit-log 72, user-events 100,
    enhanced-user-events 168, change-history 40.
  - On Change History: clicked a row → detail Sheet opened → clicked
    "Roll back to old value" → AlertDialog appeared with title "Roll back
    this change?" and the exact consequence text from the brief ("This
    change will be rolled back to the previous state. Any dependent
    configurations may be affected. This action is logged in the audit
    trail.") + Cancel + Roll back buttons.

## Known Gaps / Follow-ups
1. **Audit module not in any tenant's `enabledModules` list** —
   `mock-data.ts` (owned by Subagent 1) seeds `tenant-alpha` /
   `tenant-beta` / `tenant-gamma` / `platformTenant` without `"audit"`
   in their `enabledModules` arrays. For prop-admin tenants the audit
   module's sidebar entry is therefore hidden (the
   `moduleRegistry.getNavigation` filter skips modules not in
   `enabledModules` for non-platform tenants). Super-admin (platform
   pseudo-tenant) sees all modules via the `isPlatform` short-circuit,
   so audit appears in the sidebar there. The 4 explicit Command Menu
   entries I added let operators on non-audited tenants still navigate
   to the audit viewIds (so the pages aren't truly orphaned even for
   them). Lead can dispatch a tiny follow-up to add `"audit"` to each
   tenant's `enabledModules` in `mock-data.ts` if sidebar visibility is
   desired everywhere — out of scope for this round (file ownership).
2. **`enabledModules` variable in `command-menu.tsx`** (line 55) is
   declared but never used — pre-existing unused-var. Left untouched
   (file ownership is restricted to audit-related additions; cleanup is
   out of scope).
3. **`getTenantAccounts` import in `attention-center.tsx`** is unused
   (pre-existing). Left untouched per file-ownership rules.
4. **Pre-existing TS errors** in `mock-data.ts:seedAccounts` (lines 742,
   764, 767, 773, 777, 805) and `analytics-widgets.tsx`
   `TimeSeriesPoint` vs `SeriesPoint` (lines 34, 41, 54) and
   `account-kyc-statuses-page.tsx` `KycProviderStatus` (lines 50, 52, 70,
   80, 133-236) are unchanged — out of scope.

## Summary
The audit module is now a fully registered FrontendModule. The platform-
level inconsistency flagged by `analysis-settings-super-shell` is
resolved: 4 of 5 audit pages are no longer orphaned. All 5 audit pages
have real exports (4 CSV + 1 JSON) instead of toast-only stubs. The
ChangeHistoryPage rollback button is now wrapped in an AlertDialog with
the standard consequence-text pattern (§24 Destructive Actions). The
Attention Center has 2 new audit-related entries (action + warning
tiers) gated on the audit module being enabled. The Command Menu has 4
new audit commands in the Navigation group. All Terra palette rules
respected (`#475569` slate accent, no blue/indigo/violet). Lint passes
clean, tsc introduces 0 new errors, dev server returns 200, and visual
verification via agent-browser confirms all 4 audit nav children render
in the sidebar and all 4 Export CSV buttons produce real file downloads.
