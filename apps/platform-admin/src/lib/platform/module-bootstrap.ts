/**
 * PFaaS Platform — Module Bootstrap
 *
 * Registers all platform modules into the module registry at app boot.
 * Spec section 45.
 *
 * platform-admin registers two kinds of modules:
 *  1. superAdminModule — the console's own module (navigation, routes).
 *  2. tenantModuleCatalog — manifest-only stubs for every tenant-facing
 *     module (trading, challenges, risk, …). The real implementations live
 *     in the prop-admin app bundle and cannot be imported here; the console
 *     needs their metadata for catalog / entitlement surfaces (Service
 *     Catalog, create-tenant picker, tenant-detail adoption). The stubs
 *     declare supportedApplications: ["prop-admin"], so they never resolve
 *     into the platform shell's own navigation.
 */

import { moduleRegistry } from "./module-registry";
import { superAdminModule } from "@/modules/super-admin/super-admin-module";
import { tenantModuleCatalog } from "./module-catalog";

let bootstrapped = false;
export function bootstrapModules() {
  if (bootstrapped) return;
  bootstrapped = true;
  moduleRegistry.register(superAdminModule);
  for (const mod of tenantModuleCatalog) {
    moduleRegistry.register(mod);
  }
}
