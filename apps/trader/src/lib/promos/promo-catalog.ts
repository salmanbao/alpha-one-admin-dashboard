/**
 * Unified Promo Catalog — W1-03 (single promo catalog).
 *
 * Before this, checkout, promo wallet, /promo-error, and the welcome
 * notification all had different code sets. Checkout only accepted
 * TERRA10/FLASH25; the wallet advertised WELCOME25/EARLYBIRD15/REFERRAL10;
 * the inbox pushed WELCOME25; /promo-error listed TERRA10/FLASH25.
 * Applying the wallet's own codes yielded "Invalid promo code".
 *
 * This module is now the single source of truth. Every surface that
 * consumes promo codes imports from here. Each entry carries its
 * eligibility rules so surfaces can show *why* a code doesn't apply
 * instead of just "invalid".
 */
 
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";
 
export type DiscountType = "percent" | "fixed";
 
export interface PromoCatalogEntry {
  /** The promo code (uppercase, no spaces). */
  code: string;
  /** Human-readable label (e.g., "25% off"). */
  label: string;
  /** Discount type and value. */
  discountType: DiscountType;
  discountValue: number;
  /** ISO expiry timestamp. After this, the code is expired. */
  expiry: string;
  /** Plain-language description of what the code discounts. */
  eligibleItems: string;
  /** Full terms & conditions for the code. */
  conditions: string;
  /** Challenge/program IDs this code applies to. Empty = all. */
  eligibleChallengeIds: string[];
  /** Whether the code is currently "live" (shown in /promo-error alternatives). */
  live: boolean;
  /** Brand/origin for display (e.g., "Alpha Capital", "Terra Flash"). */
  brand: string;
  /** Potential savings at $100K baseline — drives summary strip. */
  potentialSavings: number;
}
 
/** The unified catalog — single source of truth for all promo surfaces. */
export const promoCatalog: PromoCatalogEntry[] = [
  {
    code: "WELCOME25",
    label: "25% off your first challenge",
    discountType: "percent",
    discountValue: 25,
    expiry: "2026-12-31T23:59:59Z",
    eligibleItems: "Challenge fees $25K and above",
    conditions: "First purchase only. One redemption per trader.",
    eligibleChallengeIds: [],
    live: true,
    brand: "Alpha Capital",
    potentialSavings: 25000,
  },
  {
    code: "FLASH25",
    label: "25% off Flash $10K accounts",
    discountType: "percent",
    discountValue: 25,
    expiry: "2026-11-30T23:59:59Z",
    eligibleItems: "Terra Flash Instant $10K accounts",
    conditions: "Requires an active Flash $10K account on your profile.",
    eligibleChallengeIds: terraChallenges
      .filter((c) => c.name === "Terra Flash" && c.accountSize === 10000)
      .map((c) => c.id),
    live: true,
    brand: "Terra Flash",
    potentialSavings: 2500,
  },
  {
    code: "EARLYBIRD15",
    label: "15% off early-bird pricing",
    discountType: "percent",
    discountValue: 15,
    expiry: "2026-11-15T23:59:59Z",
    eligibleItems: "All two-phase evaluation challenges",
    conditions: "Valid for the first 100 redemptions per campaign.",
    eligibleChallengeIds: terraChallenges
      .filter((c) => c.tag !== "instant")
      .map((c) => c.id),
    live: true,
    brand: "Alpha Capital",
    potentialSavings: 15000,
  },
  {
    code: "REFERRAL10",
    label: "10% referral reward",
    discountType: "percent",
    discountValue: 10,
    expiry: "2026-12-31T23:59:59Z",
    eligibleItems: "Any challenge purchase",
    conditions: "Earned when a referred trader completes their first purchase.",
    eligibleChallengeIds: [],
    live: true,
    brand: "Referral Program",
    potentialSavings: 10000,
  },
  {
    code: "TERRA10",
    label: "10% off Terra Pro challenges",
    discountType: "percent",
    discountValue: 10,
    expiry: "2026-12-31T23:59:59Z",
    eligibleItems: "Terra Pro challenges ($25K, $50K, $100K, $200K)",
    conditions: "Applies to Terra Pro evaluation programs only.",
    eligibleChallengeIds: terraChallenges
      .filter((c) => c.name === "Terra Pro")
      .map((c) => c.id),
    live: true,
    brand: "Terra",
    potentialSavings: 10000,
  },
];
 
/** Map for O(1) lookup by code (uppercase). */
export const promoCatalogByCode: Record<string, PromoCatalogEntry> = Object.fromEntries(
  promoCatalog.map((p) => [p.code.toUpperCase(), p]),
);
 
/** Codes that are currently live (shown as alternatives on /promo-error). */
export const livePromoCodes: PromoCatalogEntry[] = promoCatalog.filter((p) => p.live);
 
/** Check if a code is valid (exists, not expired). */
export function isPromoCodeValid(code: string): boolean {
  const entry = promoCatalogByCode[code.toUpperCase()];
  if (!entry) return false;
  return new Date(entry.expiry) > new Date();
}
 
/** Get the discount percent for a valid code (for checkout math). */
export function getPromoDiscount(code: string): { type: DiscountType; value: number } | null {
  const entry = promoCatalogByCode[code.toUpperCase()];
  if (!entry) return null;
  if (new Date(entry.expiry) <= new Date()) return null;
  return { type: entry.discountType, value: entry.discountValue };
}
 
/** Evaluate eligibility for a specific challenge. Returns (eligible, reason). */
export function evaluatePromoEligibility(
  code: string,
  challengeId: string,
): { eligible: boolean; reason?: string } {
  const entry = promoCatalogByCode[code.toUpperCase()];
  if (!entry) return { eligible: false, reason: "Unknown promo code." };
  if (new Date(entry.expiry) <= new Date()) {
    return { eligible: false, reason: "This promo code has expired." };
  }
  if (entry.eligibleChallengeIds.length > 0 && !entry.eligibleChallengeIds.includes(challengeId)) {
    return { eligible: false, reason: entry.conditions };
  }
  return { eligible: true };
}
 
/** Get all active (non-expired) codes for display in wallet. */
export function getActivePromoCodes(): PromoCatalogEntry[] {
  const now = new Date();
  return promoCatalog.filter((p) => new Date(p.expiry) > now);
}
 
/** Get all expired codes. */
export function getExpiredPromoCodes(): PromoCatalogEntry[] {
  const now = new Date();
  return promoCatalog.filter((p) => new Date(p.expiry) <= now);
}