/**
 * Per-tenant feature derivation — create-tenant report, P1-2.
 *
 * Seed tenants ship `enabledFeatures` populated (`challenges.two-phase`,
 * `analytics.cohorts`, …) plus a `moduleRollout` percentage per enabled
 * module; the wizard always wrote `enabledFeatures: []` and
 * `moduleRollout: {}`, so a freshly provisioned tenant behaved
 * differently from an identically configured seed and its detail-page
 * rollout toggles read 0 %.
 *
 * Both fields are now derived at create time from the operator's module
 * selection. The feature ids below are NOT invented: every one of them
 * already appears in the seed vocabulary (`mock-data.ts`) or gates a
 * catalog widget (`analytics.advanced` in `module-catalog.ts`), which is
 * exactly what `module-registry` filters navigation/widgets on.
 *
 * When prop-admin introduces a new `module.feature` gate, add it to this
 * map — do not mint ids anywhere else.
 */

/** module id → feature ids that module unlocks. */
const MODULE_FEATURES: Record<string, readonly string[]> = {
  challenges: ["challenges.two-phase"],
  risk: ["risk.daily-drawdown"],
  analytics: ["analytics.advanced", "analytics.cohorts"],
  ai: ["ai.insights"],
  kyc: ["kyc.automated"],
};

/**
 * Feature flags implied by a module selection — de-duplicated, in map
 * order so the result is stable across creates.
 */
export function deriveEnabledFeatures(enabledModules: string[]): string[] {
  const out = new Set<string>();
  for (const moduleId of enabledModules) {
    for (const feature of MODULE_FEATURES[moduleId] ?? []) out.add(feature);
  }
  return Array.from(out);
}

/**
 * Rollout percentage written for every enabled module. New tenants start
 * fully rolled out (100 %) — staged rollout is an operator decision made
 * later from the tenant detail page, not a provisioning default.
 */
export function deriveModuleRollout(enabledModules: string[]): Record<string, number> {
  return Object.fromEntries(enabledModules.map((id) => [id, 100]));
}

/** How many features a module selection unlocks — shown on the review card. */
export function countDerivedFeatures(enabledModules: string[]): number {
  return deriveEnabledFeatures(enabledModules).length;
}
