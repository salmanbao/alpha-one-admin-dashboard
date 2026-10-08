/**
 * PFaaS Platform — Guard utilities (non-JSX helpers usable from server
 * components and hooks).
 */

import type { ModuleRuntimeContext, PermissionCheck } from "@/lib/platform/types";

export function isModuleEnabledSafe(
  ctx: ModuleRuntimeContext,
  moduleId: string,
): boolean {
  const isPlatform = ctx.tenant?.id === "platform";
  if (isPlatform) return true;
  return ctx.enabledModules.includes(moduleId);
}

export function isFeatureEnabledSafe(
  ctx: ModuleRuntimeContext,
  feature: string,
): boolean {
  const isPlatform = ctx.tenant?.id === "platform";
  if (isPlatform) return true;
  return ctx.enabledFeatures.includes(feature);
}

export function hasPermissionSafe(
  permissions: string[],
  check: PermissionCheck | undefined,
): boolean {
  if (!check) return true;
  if (permissions.includes("*")) return true;
  const required = Array.isArray(check) ? check : [check];
  return required.some((p) => permissions.includes(p));
}
