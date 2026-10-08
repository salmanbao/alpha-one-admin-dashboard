/** * PFaaS Platform — Module Bootstrap * * Registers all platform modules into the module registry at app boot. * Spec section 45. Only super-admin for platform-admin app. */import { moduleRegistry } from "./module-registry";import { superAdminModule } from "@/modules/super-admin/super-admin-module";
let bootstrapped = false;
export function bootstrapModules() {  if (bootstrapped) return;
  bootstrapped = true;
  moduleRegistry.register(superAdminModule);}