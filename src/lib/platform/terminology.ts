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
