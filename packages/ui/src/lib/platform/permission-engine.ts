/**
 * PFaaS Platform — Permission Engine
 *
 * Spec section 12, 33. Frontend guards are UX only — the backend enforces
 * authorization independently.
 */

import type { AuthUser, PermissionCheck } from "./types";

export function hasPermission(
  user: AuthUser | undefined,
  permission: PermissionCheck | undefined,
): boolean {
  if (!user) return false;
  if (!permission) return true;
  if (user.permissions.includes("*")) return true;
  const required = Array.isArray(permission) ? permission : [permission];
  // any-of semantics — if user has any required permission
  return required.some((p) => user.permissions.includes(p));
}

export function hasAllPermissions(
  user: AuthUser | undefined,
  permissions: PermissionCheck[],
): boolean {
  if (!user) return false;
  if (user.permissions.includes("*")) return true;
  return permissions.every((p) =>
    Array.isArray(p) ? p.some((x) => user.permissions.includes(x)) : user.permissions.includes(p),
  );
}

export function hasAnyPermission(
  user: AuthUser | undefined,
  permissions: PermissionCheck[],
): boolean {
  if (!user) return false;
  if (user.permissions.includes("*")) return true;
  return permissions.some((p) =>
    Array.isArray(p) ? p.some((x) => user.permissions.includes(x)) : user.permissions.includes(p),
  );
}

export function hasRole(user: AuthUser | undefined, role: string | string[]): boolean {
  if (!user) return false;
  const required = Array.isArray(role) ? role : [role];
  return required.some((r) => user.roles.includes(r));
}

export function can(permission: PermissionCheck, user: AuthUser | undefined): boolean {
  return hasPermission(user, permission);
}

export function makeCan(user: AuthUser | undefined) {
  return (permission: PermissionCheck) => hasPermission(user, permission);
}
