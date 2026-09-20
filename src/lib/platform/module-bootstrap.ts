/**
 * PFaaS Platform — Module Bootstrap
 *
 * Registers all platform modules into the module registry at app boot.
 * Spec section 45. The order doesn't matter; dependency resolution is
 * handled by the registry.
 */

import { moduleRegistry } from "./module-registry";
import { tradingModule } from "@/modules/trading";
import { challengesModule } from "@/modules/challenges";
import { riskModule } from "@/modules/risk";
import { payoutsModule } from "@/modules/payouts";
import { analyticsModule } from "@/modules/analytics";
import { affiliatesModule } from "@/modules/affiliates";
import { accountingModule } from "@/modules/accounting";
import { marketingModule } from "@/modules/marketing";
import { crmModule } from "@/modules/crm";
import { kycModule } from "@/modules/kyc";
import { supportModule } from "@/modules/support";
import { aiModule } from "@/modules/ai";
import { settingsModule } from "@/modules/settings";
import { superAdminModule } from "@/modules/super-admin";

let bootstrapped = false;

export function bootstrapModules() {
  if (bootstrapped) return;
  bootstrapped = true;
  // platform-level modules
  moduleRegistry.register(superAdminModule);
  moduleRegistry.register(settingsModule);
  // core business modules
  moduleRegistry.register(tradingModule);
  moduleRegistry.register(challengesModule);
  moduleRegistry.register(riskModule);
  moduleRegistry.register(payoutsModule);
  // optional / growth modules
  moduleRegistry.register(analyticsModule);
  moduleRegistry.register(affiliatesModule);
  moduleRegistry.register(accountingModule);
  moduleRegistry.register(marketingModule);
  moduleRegistry.register(crmModule);
  moduleRegistry.register(kycModule);
  moduleRegistry.register(supportModule);
  moduleRegistry.register(aiModule);
}
