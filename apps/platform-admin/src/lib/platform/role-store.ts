"use client";

/**
 * Role store — the single write-path for RBAC roles (gaps S-04, S-05).
 *
 * Two scopes share one persisted store:
 *   - `app`      — application roles (super-admin / prop-admin / trader),
 *                  managed on Role Management;
 *   - `platform` — the platform-level RBAC matrix on Platform Roles.
 *
 * Every mutation flows through the two-operator approval center
 * (S-09 / P0-2): the editor stages the change on the approval request
 * and `applyRoleApproval` — invoked by the approval bridge the moment
 * operator B approves — lands it with a version-history entry and an
 * audit row. Built-in roles are immutable and roles with assigned
 * users can never be deleted (the S-05 guardrails).
 */

import { useMemo, useSyncExternalStore } from "react";
import { roles as seedAppRoles, users as seedUsers } from "@/lib/platform/mock-data";
import { recordAudit, type ApprovalRequest } from "@/lib/platform/console-store";
import type { ApplicationId } from "@/lib/platform/types";

const STORAGE_KEY = "pfaas:platform-admin:roles";

const DAY = 86_400_000;
/** Seed timestamps only — relative to now so no absolute dates hard-code (R10). */
const daysAgo = (n: number) => Date.now() - n * DAY;

export type RoleScope = "platform" | "app";

export interface RoleVersion {
  at: number;
  /** Who the change is attributed to (approver — their 2FA landed it). */
  actor: string;
  action: "create" | "update" | "clone" | "delete";
  /** Human summary, e.g. `+2 / −1 permissions · renamed`. */
  summary: string;
}

export interface StoredRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  application: ApplicationId;
  color: string;
  scope: RoleScope;
  /** Operators assigned this role — the delete guardrail. */
  assignedUsers: number;
  /** Built-in roles are immutable: never edited, never deleted. */
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
  versions: RoleVersion[];
}

/* ------------------------------------------------------------------ */
/* Seeds                                                               */
/* ------------------------------------------------------------------ */

/** Platform matrix roles (previously a page-local const — split-brain S-05). */
const PLATFORM_ROLE_SEED: StoredRole[] = [
  {
    id: "platform-admin",
    name: "Platform Administrator",
    description: "Full access to all platform-level operations, tenant management, and system configuration.",
    permissions: ["platform.*"],
    application: "super-admin",
    color: "#4a7c59",
    scope: "platform",
    assignedUsers: 3,
    builtIn: true,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
  {
    id: "billing-admin",
    name: "Billing Administrator",
    description: "Manage global billing, invoices, payment methods, and subscription plans across tenants.",
    permissions: ["platform.billing.*", "platform.tenants.read"],
    application: "super-admin",
    color: "#6b6358",
    scope: "platform",
    assignedUsers: 2,
    builtIn: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
  {
    id: "security-officer",
    name: "Security Officer",
    description: "Monitor platform security, audit logs, incident response, and compliance reporting.",
    permissions: ["platform.audit.*", "platform.health.read", "platform.emergency.read"],
    application: "super-admin",
    color: "#b83230",
    scope: "platform",
    assignedUsers: 4,
    builtIn: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
  {
    id: "tenant-operator",
    name: "Tenant Operator",
    description: "Day-to-day tenant management and support operations. Read-only access to platform metrics.",
    permissions: ["platform.tenants.read", "platform.tenants.manage"],
    application: "super-admin",
    color: "#705c30",
    scope: "platform",
    assignedUsers: 12,
    builtIn: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
  {
    id: "audit-reviewer",
    name: "Audit Reviewer",
    description: "Read-only access to platform audit logs for compliance and forensic review.",
    permissions: ["platform.audit.read"],
    application: "super-admin",
    color: "#4a4e4a",
    scope: "platform",
    assignedUsers: 8,
    builtIn: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
  {
    // Renamed from `support-agent`: that id already belongs to the
    // application scope (prop-admin "Support Agent") — colliding ids in
    // one store would make getRole()/deep links ambiguous.
    id: "platform-support-agent",
    name: "Support Agent",
    description: "Access to tenant support tools, ticket management, and customer-facing data.",
    permissions: ["platform.tenants.read", "support.*"],
    application: "super-admin",
    color: "#74796e",
    scope: "platform",
    assignedUsers: 24,
    builtIn: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    versions: [],
  },
];

function buildSeed(): StoredRole[] {
  const app: StoredRole[] = seedAppRoles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: [...r.permissions],
    application: r.application,
    color: r.color ?? "#6b6358",
    scope: "app" as const,
    // Real usage: operators in the user roster carrying this role.
    assignedUsers: seedUsers.filter((u) => u.roles.includes(r.id)).length,
    builtIn: r.id === "super-admin",
    createdAt: daysAgo(365),
    updatedAt: daysAgo(90),
    versions: [],
  }));
  return [...PLATFORM_ROLE_SEED, ...app];
}

/**
 * Built ONCE at module load: `daysAgo()` reads `Date.now()`, so
 * rebuilding the seed inside `getSnapshot` would return a different
 * string on every call and spin `useSyncExternalStore` into an
 * infinite update loop (Maximum update depth exceeded).
 */
const ROLE_SEED: StoredRole[] = buildSeed();

function seedRoles(): StoredRole[] {
  return ROLE_SEED;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): StoredRole[] {
  if (typeof window === "undefined") return seedRoles();
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    // Whole-list snapshot (not a seed merge): a deletion must survive
    // reloads — merging the seed back would resurrect deleted roles.
    if (Array.isArray(stored)) {
      const valid = stored.filter(
        (r): r is StoredRole =>
          !!r && typeof r === "object" && typeof (r as StoredRole).id === "string",
      );
      if (valid.length > 0) return valid;
    }
  } catch {
    /* fall through to seed */
  }
  return seedRoles();
}

function writeRaw(next: StoredRole[]): void {
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

/** All roles; pass a scope to filter. */
export function readRoles(scope?: RoleScope): StoredRole[] {
  const all = readRaw();
  return (scope ? all.filter((r) => r.scope === scope) : all).map((r) => ({ ...r }));
}

export function useRoles(scope?: RoleScope): StoredRole[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(seedRoles()),
  );
  return useMemo(() => {
    let parsed: StoredRole[];
    try {
      parsed = JSON.parse(snapshot) as StoredRole[];
    } catch {
      parsed = seedRoles();
    }
    return (scope ? parsed.filter((r) => r.scope === scope) : parsed).map((r) => ({ ...r }));
  }, [snapshot, scope]);
}

export function getRole(id: string): StoredRole | undefined {
  return readRaw().find((r) => r.id === id);
}

/* ------------------------------------------------------------------ */
/* Policy: guardrails + diff                                           */
/* ------------------------------------------------------------------ */

/** Why this role cannot be deleted — `null` when allowed (S-05). */
export function roleDeleteBlockReason(role: StoredRole | null | undefined): string | null {
  if (!role) return null;
  if (role.builtIn) return "Built-in role — protected, it can never be deleted.";
  if (role.assignedUsers > 0) {
    const n = role.assignedUsers;
    return `${n} ${n === 1 ? "user is" : "users are"} assigned to this role — reassign them first.`;
  }
  return null;
}

/** Why this role cannot be edited — `null` when allowed (S-05). */
export function roleEditBlockReason(role: StoredRole | null | undefined): string | null {
  if (!role) return null;
  if (role.builtIn) return "Built-in role — its permissions are fixed by the platform.";
  return null;
}

export interface PermissionDiff {
  added: string[];
  removed: string[];
}

export function diffPermissions(before: string[], after: string[]): PermissionDiff {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((p) => !b.has(p)),
    removed: [...b].filter((p) => !a.has(p)),
  };
}

/** `Alpha Capital Admin` → `alpha-capital-admin`. */
export function slugifyRole(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "role"
  );
}

function ensureUniqueId(base: string, existing: StoredRole[]): string {
  if (!existing.some((r) => r.id === base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!existing.some((r) => r.id === candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/* ------------------------------------------------------------------ */
/* Permission catalog                                                  */
/* ------------------------------------------------------------------ */

export interface PermissionOption {
  id: string;
  label: string;
  group: string;
}

const PLATFORM_PERMISSION_IDS: Array<[string, string]> = [
  ["platform.tenants.*", "Tenants (CRUD)"],
  ["platform.tenants.read", "View Tenants"],
  ["platform.tenants.manage", "Manage Tenants"],
  ["platform.tenants.impersonate", "Impersonate Tenant"],
  ["platform.tenants.export", "Export Tenant Data"],
  ["platform.modules.*", "Modules (CRUD)"],
  ["platform.modules.manage", "Manage Module Catalog"],
  ["platform.health.*", "System Health"],
  ["platform.health.read", "View System Health"],
  ["platform.audit.*", "Audit Logs (CRUD)"],
  ["platform.audit.read", "Read Platform Audit"],
  ["platform.billing.*", "Billing (CRUD)"],
  ["platform.billing.manage", "Manage Billing"],
  ["platform.emergency.*", "Emergency Controls"],
  ["platform.emergency.manage", "Manage Emergency Controls"],
  // R10 PW-01 — payout-scoped permissions (module-catalog's payout
  // widgets already presume payout.read / payout.approve; the catalog
  // now models the entitlement it sells).
  ["payout.*", "Payouts (All)"],
  ["payout.read", "View Payouts"],
  ["payout.approve", "Approve Payouts"],
  ["payout.hold", "Hold / Release Payouts"],
  ["payout.fail", "Fail / Retry Payouts"],
  ["payout.clawback", "Claw Back Payouts"],
  ["payout.policy", "Manage Payout Policy"],
  ["support.*", "Support (All)"],
  ["support.tickets.*", "Support Tickets"],
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `platform.tenants.read` → `Tenants` · `support.*` → `Support`. */
function permissionGroup(id: string): string {
  const segs = id.split(".");
  return capitalize(segs[0] === "platform" ? segs[1] : segs[0]);
}

/** `trader.read` → `Trader · read` (app catalog has no hand labels). */
function prettifyPermission(id: string): string {
  return id.split(".").map(capitalize).join(" · ");
}

const PLATFORM_CATALOG: PermissionOption[] = PLATFORM_PERMISSION_IDS.map(([id, label]) => ({
  id,
  label,
  group: permissionGroup(id),
}));

/** Union of every application-role permission (minus the `*` wildcard). */
const APP_CATALOG: PermissionOption[] = Array.from(
  new Set(seedAppRoles.flatMap((r) => r.permissions).filter((p) => p !== "*")),
)
  .sort()
  .map((id) => ({ id, label: prettifyPermission(id), group: permissionGroup(id) }));

/** The permissions an editor for this scope may toggle. */
export function permissionCatalog(scope: RoleScope): PermissionOption[] {
  return scope === "platform" ? PLATFORM_CATALOG : APP_CATALOG;
}

/* ------------------------------------------------------------------ */
/* Approval-bridge mutation (S-09)                                     */
/* ------------------------------------------------------------------ */

export type RoleMutation =
  | { kind: "create"; role: StoredRole }
  | { kind: "clone"; role: StoredRole; sourceName: string }
  | {
      kind: "update";
      roleId: string;
      name: string;
      description: string;
      permissions: string[];
      added: string[];
      removed: string[];
    }
  | { kind: "delete"; role: StoredRole };

/**
 * Apply an approved `role.*` request — called exactly once by the
 * approval bridge (see approval-apply.ts). Returns what the toast shows.
 */
export function applyRoleApproval(
  request: ApprovalRequest,
): { title: string; description: string } | void {
  const mutation = request.payload as RoleMutation | undefined;
  if (!mutation) return;
  const approver = request.approver?.name ?? "second operator";
  const initiator = request.initiator.name;
  const roles = readRaw();

  if (mutation.kind === "create" || mutation.kind === "clone") {
    const base = mutation.role;
    if (roles.some((r) => r.id === base.id)) {
      // The name may have been taken while the request was pending —
      // resolve at apply time instead of silently clobbering.
      base.id = ensureUniqueId(slugifyRole(base.name), roles);
    }
    const now = Date.now();
    const created: StoredRole = {
      ...base,
      assignedUsers: 0, // a new role starts unassigned — no inherited usage
      createdAt: now,
      updatedAt: now,
      versions: [
        {
          at: now,
          actor: approver,
          action: mutation.kind === "clone" ? "clone" : "create",
          summary:
            mutation.kind === "clone"
              ? `Cloned from "${mutation.sourceName}" · ${base.permissions.length} permissions`
              : `Created with ${base.permissions.length} permissions`,
        },
      ],
    };
    writeRaw([created, ...roles]);
    const cloned = mutation.kind === "clone";
    recordAudit({
      actor: approver,
      action: cloned ? "rbac.role_cloned" : "rbac.role_created",
      target: created.id,
      severity: "info",
      detail: cloned
        ? `Cloned "${mutation.sourceName}" → "${created.name}" (${created.permissions.length} permissions); initiated by ${initiator}`
        : `Created ${created.scope} role "${created.name}" (${created.permissions.length} permissions); initiated by ${initiator}`,
    });
    return {
      title: cloned ? "Role cloned" : "Role created",
      description: `"${created.name}" with ${created.permissions.length} permissions — approved by ${approver}.`,
    };
  }

  if (mutation.kind === "update") {
    const role = roles.find((r) => r.id === mutation.roleId);
    if (!role) return; // deleted while pending — nothing left to edit
    const renamed = role.name !== mutation.name ? ` · renamed to "${mutation.name}"` : "";
    const summary = `+${mutation.added.length} / −${mutation.removed.length} permissions${renamed}`;
    const updated: StoredRole = {
      ...role,
      name: mutation.name,
      description: mutation.description,
      permissions: mutation.permissions,
      updatedAt: Date.now(),
      versions: [
        ...role.versions,
        {
          at: Date.now(),
          actor: approver,
          action: "update",
          summary,
        },
      ],
    };
    writeRaw(roles.map((r) => (r.id === role.id ? updated : r)));
    recordAudit({
      actor: approver,
      action: "rbac.role_updated",
      target: role.id,
      severity: "warning",
      detail: `Updated "${role.name}": +${mutation.added.length} / −${mutation.removed.length} permissions${renamed}; initiated by ${initiator}`,
    });
    return {
      title: "Role updated",
      description: `"${mutation.name}" — +${mutation.added.length} / −${mutation.removed.length} permissions, approved by ${approver}.`,
    };
  }

  // delete
  const role = roles.find((r) => r.id === mutation.role.id);
  if (!role) return;
  const block = roleDeleteBlockReason(role);
  if (block) {
    // Guardrails hold at apply time too (usage may have changed while
    // the request was pending).
    return {
      title: "Role not deleted",
      description: `"${role.name}" — ${block}`,
    };
  }
  writeRaw(roles.filter((r) => r.id !== role.id));
  recordAudit({
    actor: approver,
    action: "rbac.role_deleted",
    target: role.id,
    severity: "warning",
    detail: `Deleted "${role.name}" (${role.permissions.length} permissions, ${role.assignedUsers} assigned); initiated by ${initiator}`,
  });
  return {
    title: "Role deleted",
    description: `"${role.name}" removed from the RBAC catalog — approved by ${approver}.`,
  };
}
