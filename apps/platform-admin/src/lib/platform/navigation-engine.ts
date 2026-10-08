/**
 * PFaaS Platform — Navigation Engine
 *
 * Spec sections 17, 18. The sidebar is generated dynamically from:
 * Core Navigation + Module Navigation + Tenant Configuration +
 * Permissions + Feature Flags.
 */

import type {
  ModuleRuntimeContext,
  NavigationItem,
} from "./types";
import { moduleRegistry } from "./module-registry";

export interface ResolvedNavigation extends NavigationItem {
  /** Whether this item has children rendered as a section */
  isSection: boolean;
  /** Effective href (from item or first child) */
  effectiveHref?: string;
}

export function resolveNavigation(ctx: ModuleRuntimeContext): ResolvedNavigation[] {
  const items = moduleRegistry.getNavigation(ctx);
  const resolved: ResolvedNavigation[] = items.map((item) => {
    const isSection = (item.children?.length ?? 0) > 0;
    const effectiveHref = item.href ?? item.children?.[0]?.href;
    return { ...item, isSection, effectiveHref };
  });
  return resolved;
}

/** Flatten navigation to a list of {href,label} for breadcrumbs. */
export function flattenNavigation(items: NavigationItem[]): NavigationItem[] {
  const out: NavigationItem[] = [];
  for (const i of items) {
    out.push(i);
    if (i.children) out.push(...flattenNavigation(i.children));
  }
  return out;
}

/** Find the nav item matching a given view/path. */
export function findNavForView(
  items: NavigationItem[],
  viewId: string,
): NavigationItem | undefined {
  for (const i of items) {
    if (i.href === viewId) return i;
    if (i.children) {
      const c = findNavForView(i.children, viewId);
      if (c) return c;
    }
  }
  return undefined;
}
