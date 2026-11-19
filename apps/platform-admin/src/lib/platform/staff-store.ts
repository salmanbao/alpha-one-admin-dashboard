"use client";

/**
 * Platform staff store — the persistent roster behind Platform Staff
 * (gap S-01's write-path share in P0-2: the invite action used to be a
 * toast on a page-local const).
 *
 * The invite itself is a maker-checker action (S-09): a form gathers
 * email/role/tenant-access, the initiator 2FA-verifies a two-operator
 * request, and `applyStaffApproval` adds the row (status `invited`)
 * with an audit row the moment operator B approves. Activation,
 * suspension and offboarding build on this roster in P0-3.
 */

import { useMemo, useSyncExternalStore } from "react";
import { recordAudit, type ApprovalRequest } from "@/lib/platform/console-store";
import { readRoles } from "@/lib/platform/role-store";

const STORAGE_KEY = "pfaas:platform-admin:staff";

export type StaffStatus = "active" | "inactive" | "suspended" | "invited";

export interface StoredStaff {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string;
  status: StaffStatus;
  lastActive: string;
  permissions: number;
  tenantAccess: string;
  color: string;
  initials: string;
  /** Set when invited through the two-operator flow (P0-2/S-09). */
  invitedAt?: number;
  invitedBy?: string;
}

/* ------------------------------------------------------------------ */
/* Seed (moved from platform-staff-page — was a page-local const)      */
/* ------------------------------------------------------------------ */

const STAFF_SEED: StoredStaff[] = [
  {
    id: "staff-1",
    name: "Marcus Vance",
    email: "marcus.vance@pfaas.io",
    role: "Platform Administrator",
    level: "L5",
    status: "active",
    lastActive: "2 min ago",
    permissions: 48,
    tenantAccess: "All Tenants",
    color: "#4a7c59",
    initials: "MV",
  },
  {
    id: "staff-2",
    name: "Sarah Chen",
    email: "sarah.chen@pfaas.io",
    role: "Security Officer",
    level: "L4",
    status: "active",
    lastActive: "15 min ago",
    permissions: 32,
    tenantAccess: "All Tenants",
    color: "#b83230",
    initials: "SC",
  },
  {
    id: "staff-3",
    name: "James Rodriguez",
    email: "james.r@pfaas.io",
    role: "Billing Administrator",
    level: "L3",
    status: "active",
    lastActive: "1 hour ago",
    permissions: 16,
    tenantAccess: "All Tenants",
    color: "#6b6358",
    initials: "JR",
  },
  {
    id: "staff-4",
    name: "Emily Kim",
    email: "emily.kim@pfaas.io",
    role: "Tenant Operator",
    level: "L2",
    status: "active",
    lastActive: "3 hours ago",
    permissions: 12,
    tenantAccess: "Alpha, Beta, Gamma",
    color: "#705c30",
    initials: "EK",
  },
  {
    id: "staff-5",
    name: "David Park",
    email: "david.park@pfaas.io",
    role: "Audit Reviewer",
    level: "L3",
    status: "inactive",
    lastActive: "2 days ago",
    permissions: 8,
    tenantAccess: "All Tenants",
    color: "#4a4e4a",
    initials: "DP",
  },
  {
    id: "staff-6",
    name: "Lisa Thompson",
    email: "lisa.t@pfaas.io",
    role: "Support Agent",
    level: "L1",
    status: "active",
    lastActive: "5 min ago",
    permissions: 6,
    tenantAccess: "Alpha Capital",
    color: "#74796e",
    initials: "LT",
  },
  {
    id: "staff-7",
    name: "Michael Brown",
    email: "michael.b@pfaas.io",
    role: "Support Agent",
    level: "L1",
    status: "suspended",
    lastActive: "1 week ago",
    permissions: 6,
    tenantAccess: "Beta Trading",
    color: "#74796e",
    initials: "MB",
  },
  {
    id: "staff-8",
    name: "Anna Martinez",
    email: "anna.m@pfaas.io",
    role: "Tenant Operator",
    level: "L2",
    status: "active",
    lastActive: "30 min ago",
    permissions: 12,
    tenantAccess: "Gamma, Delta",
    color: "#705c30",
    initials: "AM",
  },
];

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): StoredStaff[] {
  if (typeof window === "undefined") return STAFF_SEED;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    // Whole-list snapshot so invited rows and future lifecycle changes
    // (P0-3) survive reloads without the seed resurrecting old rows.
    if (Array.isArray(stored)) {
      const valid = stored.filter(
        (s): s is StoredStaff =>
          !!s && typeof s === "object" && typeof (s as StoredStaff).id === "string",
      );
      if (valid.length > 0) return valid;
    }
  } catch {
    /* fall through to seed */
  }
  return STAFF_SEED;
}

function writeRaw(next: StoredStaff[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function readStaff(): StoredStaff[] {
  return readRaw().map((s) => ({ ...s }));
}

export function useStaff(): StoredStaff[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(STAFF_SEED),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as StoredStaff[]).map((s) => ({ ...s }));
    } catch {
      return STAFF_SEED.map((s) => ({ ...s }));
    }
  }, [snapshot]);
}

/* ------------------------------------------------------------------ */
/* Approval-bridge mutation (S-09)                                     */
/* ------------------------------------------------------------------ */

export type StaffMutation = {
  kind: "invite";
  email: string;
  role: string;
  tenantAccess: string;
};

/** `dana.w@pfaas.io` → `Dana W` (honest placeholder until they accept). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "operator";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Operator";
}

/**
 * Apply an approved `staff.*` request — called exactly once by the
 * approval bridge (see approval-apply.ts).
 */
export function applyStaffApproval(
  request: ApprovalRequest,
): { title: string; description: string } | void {
  const mutation = request.payload as StaffMutation | undefined;
  if (mutation?.kind !== "invite") return;
  const approver = request.approver?.name ?? "second operator";
  const staff = readRaw();

  if (staff.some((s) => s.email.toLowerCase() === mutation.email.toLowerCase())) {
    return {
      title: "Already on the roster",
      description: `${mutation.email} already has an account — duplicate invite skipped.`,
    };
  }

  // Permission count + role color resolved from the role store at apply
  // time, so the roster reflects the role's *current* permissions.
  const role = readRoles("platform").find((r) => r.name === mutation.role);
  const name = nameFromEmail(mutation.email);
  const initials = name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const invitee: StoredStaff = {
    id: `staff-${Date.now().toString(36)}`,
    name,
    email: mutation.email,
    role: mutation.role,
    level: "—",
    status: "invited",
    lastActive: "Invite pending — not yet accepted",
    permissions: role?.permissions.length ?? 0,
    tenantAccess: mutation.tenantAccess,
    color: role?.color ?? "#74796e",
    initials,
    invitedAt: Date.now(),
    invitedBy: request.initiator.name,
  };

  writeRaw([...staff, invitee]);
  recordAudit({
    actor: approver,
    action: "staff.invite_sent",
    target: mutation.email,
    severity: "warning",
    detail: `Invited ${mutation.email} as "${mutation.role}" (tenant access: ${mutation.tenantAccess}); initiated by ${request.initiator.name}`,
  });
  return {
    title: "Staff invite sent",
    description: `${mutation.email} invited as ${mutation.role} — 2FA + second-operator approval recorded.`,
  };
}
