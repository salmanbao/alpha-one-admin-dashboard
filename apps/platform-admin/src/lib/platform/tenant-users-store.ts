"use client";

/**
 * Tenant users store — P1-4.
 * One audit stream, one state model, honest "(Demo)" labels.
 * Persists under `pfaas:platform-admin:tenantUsers`.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { users as seedUsers } from "@/lib/platform/mock-data";

const STORAGE_KEY = "pfaas:platform-admin:tenantUsers";

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  initials: string;
  roles: string[];
  application: "prop-admin" | "trader" | "super-admin";
  status: "active" | "invited" | "suspended";
  invitedAt?: string;
  lastActiveAt: string;
}

interface SeedUserInput {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  initials: string;
  roles: string[];
  application: "prop-admin" | "trader" | "super-admin" | string;
  mfa?: string;
  status?: string;
  lastActiveAt: string;
}

function toTenantUser(u: SeedUserInput): TenantUser | null {
  if (!u.tenantId) return null;
  return {
    id: u.id,
    tenantId: u.tenantId,
    name: u.name,
    email: u.email,
    initials: u.initials,
    roles: u.roles ?? [],
    application: u.application as "prop-admin" | "trader" | "super-admin",
    status: (u.status === "suspended" ? "suspended" : "active") as "active" | "suspended" | "invited",
    lastActiveAt: u.lastActiveAt,
  };
}

const SEED_USERS: TenantUser[] = seedUsers
  .map((u: SeedUserInput) => toTenantUser(u))
  .filter((u): u is TenantUser => u !== null);

function readRaw(): TenantUser[] {
  if (typeof window === "undefined") return SEED_USERS.map((u) => ({ ...u }));
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return stored.filter(
      (u): u is TenantUser =>
        !!u &&
        typeof u === "object" &&
        typeof u.id === "string" &&
        typeof u.tenantId === "string"
    );
  } catch {
    return SEED_USERS.map((u) => ({ ...u }));
  }
}

function writeRaw(next: TenantUser[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
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
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(SEED_USERS.map((u) => ({ ...u })));
}

export function readTenantUsers(): TenantUser[] {
  return readRaw();
}

export function getTenantUser(id: string): TenantUser | undefined {
  return readRaw().find((u) => u.id === id);
}

export function useTenantUsers(): TenantUser[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as TenantUser[];
}

export function useTenantUsersForTenant(tenantId: string): TenantUser[] {
  return useTenantUsers().filter((u) => u.tenantId === tenantId);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inviteTenantUser(
  tenantId: string,
  tenantName: string,
  name: string,
  email: string,
  roles: string[],
  application: "prop-admin" | "trader"
): { title: string; description: string } {
  const users = readRaw();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

  const newUser: TenantUser = {
    id: generateId("usr"),
    tenantId,
    name,
    email,
    initials,
    roles,
    application,
    status: "invited",
    invitedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const next = [...users, newUser];
  writeRaw(next);

  recordAudit({
    actor: "Console operator",
    action: "tenant.user_invited",
    target: tenantId,
    tenantId,
    severity: "info",
    detail: `Invited ${name} (${email}) as ${roles.join(", ")} to ${tenantName}.`,
  });

  return {
    title: "User invited",
    description: `Invitation sent to ${name} (${email}) for ${tenantName} — ${roles.join(", ")}.`,
  };
}

export function removeTenantUser(
  userId: string,
  tenantId: string,
  tenantName: string
): { title: string; description: string } {
  const users = readRaw();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { title: "(Demo)", description: "User not found." };
  }
  const user = users[idx];
  const next = users.filter((u) => u.id !== userId);
  writeRaw(next);

  recordAudit({
    actor: "Console operator",
    action: "tenant.user_removed",
    target: tenantId,
    tenantId,
    severity: "warning",
    detail: `Removed ${user.name} (${user.email}) from ${tenantName}.`,
  });

  return {
    title: "User removed",
    description: `${user.name} removed from ${tenantName}.`,
  };
}

export function updateTenantUserRole(
  userId: string,
  tenantId: string,
  tenantName: string,
  newRoles: string[]
): { title: string; description: string } {
  const users = readRaw();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { title: "(Demo)", description: "User not found." };
  }
  const user = users[idx];
  const oldRoles = user.roles.join(", ");
  const next = [...users];
  next[idx] = { ...user, roles: newRoles };
  writeRaw(next);

  recordAudit({
    actor: "Console operator",
    action: "tenant.user_role_changed",
    target: tenantId,
    tenantId,
    severity: "info",
    detail: `Updated roles for ${user.name} in ${tenantName}: ${oldRoles} → ${newRoles.join(", ")}.`,
  });

  return {
    title: "Roles updated",
    description: `Roles updated for ${user.name} in ${tenantName}: ${oldRoles} → ${newRoles.join(", ")}.`,
  };
}

export function suspendTenantUser(
  userId: string,
  tenantId: string,
  tenantName: string
): { title: string; description: string } {
  const users = readRaw();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { title: "(Demo)", description: "User not found." };
  }
  const user = users[idx];
  const next = [...users];
  next[idx] = { ...user, status: "suspended" };
  writeRaw(next);

  recordAudit({
    actor: "Console operator",
    action: "tenant.user_suspended",
    target: tenantId,
    tenantId,
    severity: "warning",
    detail: `Suspended ${user.name} (${user.email}) in ${tenantName}.`,
  });

  return {
    title: "User suspended",
    description: `${user.name} suspended in ${tenantName}.`,
  };
}

export function reactivateTenantUser(
  userId: string,
  tenantId: string,
  tenantName: string
): { title: string; description: string } {
  const users = readRaw();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { title: "(Demo)", description: "User not found." };
  }
  const user = users[idx];
  const next = [...users];
  next[idx] = { ...user, status: "active" };
  writeRaw(next);

  recordAudit({
    actor: "Console operator",
    action: "tenant.user_reactivated",
    target: tenantId,
    tenantId,
    severity: "info",
    detail: `Reactivated ${user.name} (${user.email}) in ${tenantName}.`,
  });

  return {
    title: "User reactivated",
    description: `${user.name} reactivated in ${tenantName}.`,
  };
}