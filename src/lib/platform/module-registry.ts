/**
 * PFaaS Platform — Module Registry & Runtime
 *
 * Spec sections: 13, 15, 16, 46. Central source of module metadata.
 * Resolves which modules are enabled given tenant entitlements, deps,
 * and application scope.
 */

import type {
  ApplicationId,
  FrontendModule,
  ModuleManifest,
  ModuleRuntimeContext,
  NavigationItem,
  WidgetDefinition,
} from "./types";
import { hasPermission } from "./permission-engine";

class ModuleRegistryImpl {
  private modules = new Map<string, FrontendModule>();

  register(mod: FrontendModule): void {
    if (this.modules.has(mod.manifest.id)) {
      // idempotent — allow re-registration in dev
      console.warn(`[module-registry] re-registering module "${mod.manifest.id}"`);
    }
    this.modules.set(mod.manifest.id, mod);
  }

  get(moduleId: string): FrontendModule | undefined {
    return this.modules.get(moduleId);
  }

  getManifest(moduleId: string): ModuleManifest | undefined {
    return this.modules.get(moduleId)?.manifest;
  }

  getAll(): FrontendModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Resolve modules enabled for a runtime context. A module is enabled iff:
   *  - it's in tenant.enabledModules (or tenant is platform pseudo-tenant)
   *  - it supports the current application (or has no app restriction)
   *  - all its dependencies are themselves enabled
   */
  getEnabledModules(ctx: ModuleRuntimeContext): FrontendModule[] {
    const tenantModules = ctx.enabledModules;
    const isPlatform = ctx.tenant?.id === "platform";

    const enabled = new Set<string>();

    const tryEnable = (id: string, seen: Set<string>): boolean => {
      if (enabled.has(id)) return true;
      if (seen.has(id)) return false; // cycle guard
      seen.add(id);

      const mod = this.modules.get(id);
      if (!mod) return false;
      if (!isPlatform && !tenantModules.includes(id)) return false;
      if (
        mod.manifest.supportedApplications &&
        mod.manifest.supportedApplications.length > 0 &&
        !mod.manifest.supportedApplications.includes(ctx.application)
      ) {
        return false;
      }
      // dependencies must be enabled
      for (const dep of mod.manifest.dependencies ?? []) {
        if (!tryEnable(dep, seen)) return false;
      }
      enabled.add(id);
      return true;
    };

    // Try every module the tenant thinks it has, plus platform-only ones
    const candidates = new Set<string>(isPlatform ? this.getAll().map((m) => m.manifest.id) : tenantModules);
    for (const id of candidates) {
      tryEnable(id, new Set());
    }
    return this.getAll().filter((m) => enabled.has(m.manifest.id));
  }

  isModuleEnabled(ctx: ModuleRuntimeContext, moduleId: string): boolean {
    return this.getEnabledModules(ctx).some((m) => m.manifest.id === moduleId);
  }

  /**
   * Resolve the navigation tree for a runtime context.
   * Combines all enabled modules' navigation items, filtered by:
   * application, module, feature, permission.
   */
  getNavigation(ctx: ModuleRuntimeContext): NavigationItem[] {
    const enabled = this.getEnabledModules(ctx);
    const tenantFeatures = ctx.enabledFeatures;
    const isPlatform = ctx.tenant?.id === "platform";

    const items: NavigationItem[] = [];
    for (const mod of enabled) {
      for (const nav of mod.navigation ?? []) {
        // apply app filter on nav item itself
        if (
          nav.application &&
          nav.application.length > 0 &&
          !nav.application.includes(ctx.application)
        ) {
          continue;
        }
        // module-level filter (use the module id from nav or the module's own id)
        const moduleId = nav.module ?? mod.manifest.id;
        if (!isPlatform && !ctx.enabledModules.includes(moduleId)) continue;
        // feature flag filter
        if (nav.feature && !ctx.enabledFeatures.includes(nav.feature) && !isPlatform) continue;
        // permission filter
        if (!hasPermission(ctx.user, nav.permission)) continue;
        // recurse into children with same filters
        const children = (nav.children ?? []).filter((c) => {
          if (c.application && c.application.length > 0 && !c.application.includes(ctx.application)) return false;
          if (c.feature && !tenantFeatures.includes(c.feature) && !isPlatform) return false;
          if (!hasPermission(ctx.user, c.permission)) return false;
          return true;
        });
        items.push({ ...nav, module: moduleId, children: children.length ? children : undefined });
      }
    }
    // stable sort by order then by label
    items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label));
    return items;
  }

  /**
   * Resolve all eligible widgets for a runtime context.
   */
  getWidgets(ctx: ModuleRuntimeContext): WidgetDefinition[] {
    const enabled = this.getEnabledModules(ctx);
    const tenantFeatures = ctx.enabledFeatures;
    const isPlatform = ctx.tenant?.id === "platform";

    const out: WidgetDefinition[] = [];
    for (const mod of enabled) {
      for (const w of mod.widgets ?? []) {
        if (
          w.application &&
          w.application.length > 0 &&
          !w.application.includes(ctx.application)
        ) continue;
        if (w.feature && !ctx.enabledFeatures.includes(w.feature) && !isPlatform) continue;
        if (!hasPermission(ctx.user, w.permission)) continue;
        out.push(w);
      }
    }
    return out;
  }

  /** Resolve settings entries (modular settings, spec section 43). */
  getSettings(ctx: ModuleRuntimeContext) {
    const enabled = this.getEnabledModules(ctx);
    const out: { moduleId: string; moduleName: string; settings: NonNullable<FrontendModule["settings"]> }[] = [];
    for (const mod of enabled) {
      if (!mod.settings || mod.settings.length === 0) continue;
      if (
        mod.manifest.supportedApplications &&
        mod.manifest.supportedApplications.length > 0 &&
        !mod.manifest.supportedApplications.includes(ctx.application)
      ) continue;
      out.push({ moduleId: mod.manifest.id, moduleName: mod.manifest.name, settings: mod.settings });
    }
    return out;
  }
}

export const moduleRegistry = new ModuleRegistryImpl();

/** Helper for components to test entitlement against a runtime context. */
export function isModuleEnabled(ctx: ModuleRuntimeContext, moduleId: string): boolean {
  return moduleRegistry.isModuleEnabled(ctx, moduleId);
}
