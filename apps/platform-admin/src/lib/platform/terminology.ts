/**
 * PFaaS Platform — Terminology Resolver
 *
 * Spec section 30. White-label terminology overrides. Only business
 * terms are configurable; arbitrary strings are not.
 */

import type { TenantContext } from "./types";

/** Canonical business term keys. */
export type TermKey =
  | "challenge"
  | "trader"
  | "payout"
  | "account"
  | "evaluation"
  | "participant"
  | "withdrawal"
  | "disbursement";

const DEFAULTS: Record<TermKey, string> = {
  challenge: "Challenge",
  trader: "Trader",
  payout: "Payout",
  account: "Account",
  evaluation: "Evaluation",
  participant: "Participant",
  withdrawal: "Withdrawal",
  disbursement: "Disbursement",
};

export function makeTermResolver(tenant?: Pick<TenantContext, "terminology">) {
  return (key: TermKey): string => {
    const override = tenant?.terminology[key];
    return override ?? DEFAULTS[key];
  };
}

/** Title-case a term (e.g. "payout" → "Payout"). */
export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pluralize naively. */
export function plural(s: string): string {
  if (s.endsWith("y")) return s.slice(0, -1) + "ies";
  if (s.endsWith("s")) return s;
  return s + "s";
}

/**
 * Replace default business terms embedded in a static UI string with the
 * tenant's white-label terms. Handles singular, plural and lowercase forms
 * with word boundaries, so "Create Challenge" → "Create Evaluation",
 * "Traders" → "Participants", "Search payouts…" → "Search withdrawals…".
 * No-op for tenants that keep the default terminology.
 */
export function resolveTermsInString(
  str: string,
  tenant?: Pick<TenantContext, "terminology">,
): string {
  const t = makeTermResolver(tenant);
  let out = str;
  for (const key of ["challenge", "trader", "payout"] as const) {
    const replacement = t(key);
    if (replacement === DEFAULTS[key]) continue; // same term — nothing to swap
    const singular = DEFAULTS[key];
    const pluralForm = plural(singular);
    // Plural first so "Challenges" doesn't leave a stray "s" after "Challenge" is replaced
    const forms: Array<[RegExp, string]> = [
      [new RegExp(`\\b${pluralForm}\\b`, "g"), plural(replacement)],
      [new RegExp(`\\b${singular}\\b`, "g"), replacement],
      [new RegExp(`\\b${singular.toLowerCase()}\\b`, "g"), replacement.toLowerCase()],
    ];
    for (const [re, rep] of forms) out = out.replace(re, rep);
  }
  return out;
}
