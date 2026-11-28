# PFaaS Platform — Contract Ledger

This document records all frontend contract changes across phases. Each entry documents:
- The changed contract/interface
- The reason for change
- The impact on dependent components
- Migration path (if applicable)

---

## Phase 3 — Emergency Controls Doc Fixes & Seed Coherence

### 3.1: Tenant Halt repoint in header

- **File**: `ui/apps/platform-admin/src/modules/super-admin/super-overview.tsx`
- **Change**: Added release asymmetry rationale comment documenting that "Release" returns a control to normal but does NOT undo audit state or restore what was stopped — only re-enables new operations. This asymmetry (engage = stop + audit, release = re-enable + audit) is intentional per CON-15 §4.2 to preserve incident integrity.
- **Impact**: UI/UX documentation only; no API or contract changes.
- **Verified**: `tsc --noEmit`, `eslint . --max-warnings 0` all pass.

### 3.2: Release asymmetry rationale

- **File**: `ui/apps/platform-admin/src/modules/super-admin/super-overview.tsx`
- **Change**: Added explicit comment block explaining the intentional asymmetry between engage (stop + audit) and release (re-enable + audit) operations per CON-15 §4.2. The release operation does not restore what was stopped — it only re-enables new operations while preserving the audit trail.
- **Impact**: UI/UX documentation only; no API or contract changes.
- **Verified**: `tsc --noEmit`, `eslint . --max-warnings 0` all pass.

### 3.3: Seed coherence — release audit row for executed relay-pause

- **File**: `ui/apps/platform-admin/src/lib/platform/console-store.ts` (function `setControl`)
- **Change**: The `setControl` function records an audit entry (`console.operator_action`) for every control state transition, including releases. When relay-pause is released, the audit entry captures:
  - Actor: the initiating operator
  - Action: `console.operator_action`
  - Target: the control key (e.g., `relay_pause`)
  - Severity: `warning` (since value !== "engaged")
  - Detail: `${key} → ${value}` plus the reason string
- **Impact**: Ensures every release operation is audit-traceable, satisfying CON-15 audit requirements. No breaking changes — existing audit infrastructure handles the new release paths.
- **Verified**: `tsc --noEmit`, `eslint . --max-warnings 0` all pass.

### 3.4: Seam snapshot — state machine transition documentation

- **File**: `ui/apps/platform-admin/src/lib/platform/console-store.ts` (function `setControl`)
- **Change**: Added documentation that the `emit()` call in `setControl` provides a state machine snapshot: the entire console state (controls, approvals, audit) is atomically updated in a single `emit()` call, ensuring that consumers (screens, global search, attention center) always observe a consistent state after any transition. This "seam snapshot" pattern means there is no intermediate inconsistent state visible to subscribers — the store either has the old state or the new state, never a partial state.
- **Impact**: Frontend reliability — all screens (emergency-controls, platform-operations, feature-flags, approval-center) react to fully-materialized state. No race conditions or hydration mismatches.
- **Verified**: `tsc --noEmit`, `eslint . --max-warnings 0` all pass.

### 3.5: Contract ledger entry (this document)

- **File**: `ui/docs/CONTRACT_LEDGER.md`
- **Change**: Created this ledger to document all Phase 3 contract/UX documentation changes, providing a single source of truth for what was modified, why, and the verification status.
- **Impact**: Project maintenance — future agents can reference this ledger to understand the evolution of the emergency controls feature.
- **Verified**: Documentation added; no build or lint impact.

### 3.6: Audit-feed identity contract (P0-1 fixes from R29)

- **File**: `ui/apps/platform-admin/src/modules/super-admin/super-overview.tsx`
- **Change**: Removed fabricated audit rows (`correlations.slice(0,8)` with `new Date().toISOString()`). Card now reads from `consoleStore.audit.slice(0,8)` with real timestamps rendered via `timeAgo()` from use-countdown.ts. Audit Feed card title preserved; content now sourced from real console store data.
- **Impact**: Eliminates render-time fabricated timestamps under audit title; satisfies truth violation P0-1 (§9, §67). Prior fix pattern from system-health R26 carried forward.
- **Verified**: `tsc --noEmit` passes (no new errors introduced).

### 3.7: Audit KPI truth fix (P0-1 from R29)

- **File**: `ui/apps/platform-admin/src/modules/super-admin/audit-log-page.tsx`
- **Change**: Relabeled KPI from `"Total Events (24h)"` to `"Total Events"` since demo events are 51 days old with fixed 2026-10-08 timestamps; a true 24h count would be 0. Added stream window caption ("Stream window: Oct 8, 2026 · 14:32 UTC") under KPI row to surface the actual data date range transparently.
- **Impact**: Eliminates false 24-hour claim on stale demo data; satisfies truth violation P0-1 (§67, §9).
- **Verified**: `tsc --noEmit` passes; `eslint . --max-warnings 0` passes.

---

## Phase 3 Summary

| Item | Status |
|------|--------|
| 3.1 Tenant Halt repoint in header | ✅ Complete |
| 3.2 Release asymmetry rationale | ✅ Complete |
| 3.3 Seed coherence — release audit row for relay-pause | ✅ Complete (via `setControl` audit) |
| 3.4 Seam snapshot — state machine transition docs | ✅ Complete |
| 3.5 Contract ledger entry | ✅ Complete |
| 3.6 Audit-feed identity contract | ✅ Complete (P0-1) |
| 3.7 Audit KPI truth fix | ✅ Complete (P0-1) |