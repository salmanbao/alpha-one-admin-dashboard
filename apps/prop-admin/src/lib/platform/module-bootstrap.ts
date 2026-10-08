/**
 * PFaaS Platform — Module Bootstrap
 *
 * Registers all platform modules into the module registry at app boot.
 * Spec section 45. The order doesn't matter; dependency resolution is
 * handled by the registry.
 */

import { moduleRegistry } from "./module-registry";
import { tradingModule } from "@/modules/trading/manifest";
import { challengesModule } from "@/modules/challenges/manifest";
import { riskModule } from "@/modules/risk/manifest";
import { payoutsModule } from "@/modules/payouts/manifest";
import { analyticsModule } from "@/modules/analytics/manifest";
import { affiliatesModule } from "@/modules/affiliates/manifest";
import { accountingModule } from "@/modules/accounting/manifest";
import { marketingModule } from "@/modules/marketing/manifest";
import { crmModule } from "@/modules/crm/manifest";
import { kycModule } from "@/modules/kyc/manifest";
import { supportModule } from "@/modules/support/manifest";
import { aiModule } from "@/modules/ai/manifest";
import { auditModule } from "@/modules/audit/audit-module";
import { settingsModule } from "@/modules/settings/settings-module";

let bootstrapped = false;
export function bootstrapModules() {
  if (bootstrapped) return;
  bootstrapped = true;
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
  // compliance modules — audit depends on settings, register after it.
  moduleRegistry.register(auditModule);
}
