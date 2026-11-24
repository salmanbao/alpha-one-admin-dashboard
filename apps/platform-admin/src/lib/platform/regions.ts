/**
 * Canonical tenant region vocabulary — single source of truth for the
 * `TenantContext.region` data-residency pin.
 *
 * Why this file (create-tenant report, P1-1): the wizard's residency
 * `Select` emitted unsuffixed values (`us-east`, `eu-west`, …) while the
 * seeded roster pinned tenants to AWS-style ids (`us-east-1`,
 * `eu-west-1`, `ap-southeast-1`). One physical region therefore showed up
 * as two filter values on the Tenants screen and two buckets in the
 * Residency report, and `dataLocationFor()` defaulted unpinned data to a
 * third spelling.
 *
 * Every surface — wizard Select, Tenants screen region filter, Residency
 * grouping, unpinned data-location defaults, benchmarking filter — imports
 * from here so the vocabulary stays single-sourced.
 */

export interface TenantRegion {
  /** Value persisted on `TenantContext.region`. */
  id: string;
  /** Operator-facing label shown in selects and detail views. */
  label: string;
}

/** The residency pin choices, in the wizard's display order. */
export const TENANT_REGIONS: TenantRegion[] = [
  { id: "us-east-1", label: "US East (N. Virginia)" },
  { id: "us-west-2", label: "US West (Oregon)" },
  { id: "eu-west-1", label: "EU West (Ireland)" },
  { id: "eu-central-1", label: "EU Central (Frankfurt)" },
  { id: "ap-southeast-1", label: "AP Southeast (Singapore)" },
  { id: "ap-northeast-1", label: "AP Northeast (Tokyo)" },
  { id: "me-south-1", label: "ME South (Bahrain)" },
];

/** Just the ids — for membership checks and filters. */
export const TENANT_REGION_IDS: readonly string[] = TENANT_REGIONS.map((r) => r.id);

/**
 * Where unpinned data lands (`dataLocationFor` defaults). Kept here so a
 * default is never spelled differently from a pin.
 */
export const UNPINNED_DEFAULT_REGION = "us-east-1";
export const UNPINNED_DEFAULT_EU_REGION = "eu-west-1";

/** True when `value` is one of the canonical pin ids. */
export function isTenantRegion(value?: string): value is string {
  return !!value && TENANT_REGION_IDS.includes(value);
}

/** Display label for a stored region id; honest fallback for unknown ids. */
export function regionLabel(value?: string): string {
  if (!value) return "Unpinned (global)";
  return TENANT_REGIONS.find((r) => r.id === value)?.label ?? value;
}
