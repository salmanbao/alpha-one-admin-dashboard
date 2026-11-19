"use client";

/**
 * R10-A4 — Add-on purchase path and payout-time entitlements (P1).
 *
 * Add-ons existed as wizard rows and invoice fixtures with no purchasable
 * catalog and no entitlement check anywhere. This store provides:
 *
 *   • an add-on catalog (express payout, weekend trading pass, priority
 *     support, custom leverage, extended drawdown) with CRUD,
 *   • purchases persisted against an account with expiry/uses tracking,
 *   • entitlement checks — `getPayoutGateEntitlements()` is the payout
 *     gate's read API (express-payout skips the standard wait window),
 *     `checkWeekendTradingEligibility` feeds the pre-trade surface,
 *   • a 60s expiry sweep (the lifecycle log carries no clock events).
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events (`addon.purchased`)
 * - recordAudit for audit trails
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EntitlementType =
  | "express-payout"
  | "weekend-trading"
  | "priority-support"
  | "custom-leverage"
  | "extended-drawdown";

export interface AddOnProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  entitlementType: EntitlementType;
  /** 0 = lifetime. */
  durationDays: number;
  /** 0 = unlimited uses. */
  maxUses: number;
  /** Empty = all programs. */
  applicablePrograms: string[];
  /** Empty = all phases. */
  applicablePhases: string[];
  enabled: boolean;
  order: number;
}

export interface AddOnPurchase {
  id: string;
  traderId: string;
  accountId: string;
  addOnId: string;
  addOnName: string;
  entitlementType: EntitlementType;
  price: number;
  currency: string;
  purchasedAt: string;
  expiresAt?: string;
  usesRemaining: number;
  status: "active" | "expired" | "exhausted" | "refunded";
  paymentReference?: string;
}

export interface AddOnState {
  products: AddOnProduct[];
  purchases: AddOnPurchase[];
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().min(0),
  currency: z.string(),
  entitlementType: z.enum([
    "express-payout",
    "weekend-trading",
    "priority-support",
    "custom-leverage",
    "extended-drawdown",
  ]),
  durationDays: z.number().min(0),
  maxUses: z.number().min(0),
  applicablePrograms: z.array(z.string()),
  applicablePhases: z.array(z.string()),
  enabled: z.boolean(),
  order: z.number(),
});

const purchaseSchema = z.object({
  id: z.string(),
  traderId: z.string(),
  accountId: z.string(),
  addOnId: z.string(),
  addOnName: z.string(),
  entitlementType: z.enum([
    "express-payout",
    "weekend-trading",
    "priority-support",
    "custom-leverage",
    "extended-drawdown",
  ]),
  price: z.number().min(0),
  currency: z.string(),
  purchasedAt: z.string(),
  expiresAt: z.string().optional(),
  usesRemaining: z.number().min(0),
  status: z.enum(["active", "expired", "exhausted", "refunded"]),
  paymentReference: z.string().optional(),
});

const addOnStateSchema = z.object({
  products: z.array(productSchema),
  purchases: z.array(purchaseSchema),
});

type AddOnStateType = z.infer<typeof addOnStateSchema>;

/* ------------------------------------------------------------------ */
/* Default catalog                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_PRODUCTS: AddOnProduct[] = [
  {
    id: "addon-express-payout",
    name: "Express Payout",
    description: "Skip the standard payout window — funds within 24 hours",
    price: 99,
    currency: "USD",
    entitlementType: "express-payout",
    durationDays: 0,
    maxUses: 0,
    applicablePrograms: [],
    applicablePhases: ["funded"],
    enabled: true,
    order: 1,
  },
  {
    id: "addon-weekend-trading",
    name: "Weekend Trading Pass",
    description: "Trade weekend sessions on eligible instruments",
    price: 49,
    currency: "USD",
    entitlementType: "weekend-trading",
    durationDays: 30,
    maxUses: 0,
    applicablePrograms: [],
    applicablePhases: ["funded"],
    enabled: true,
    order: 2,
  },
  {
    id: "addon-priority-support",
    name: "Priority Support",
    description: "2-hour first-response time on support tickets",
    price: 29,
    currency: "USD",
    entitlementType: "priority-support",
    durationDays: 30,
    maxUses: 0,
    applicablePrograms: [],
    applicablePhases: [],
    enabled: true,
    order: 3,
  },
  {
    id: "addon-custom-leverage",
    name: "Custom Leverage",
    description: "Request leverage up to 1:500 for 90 days",
    price: 149,
    currency: "USD",
    entitlementType: "custom-leverage",
    durationDays: 90,
    maxUses: 1,
    applicablePrograms: [],
    applicablePhases: ["funded"],
    enabled: true,
    order: 4,
  },
  {
    id: "addon-extended-drawdown",
    name: "Extended Drawdown",
    description: "Raises the maximum drawdown by 2 points for 60 days",
    price: 199,
    currency: "USD",
    entitlementType: "extended-drawdown",
    durationDays: 60,
    maxUses: 1,
    applicablePrograms: [],
    applicablePhases: ["funded"],
    enabled: true,
    order: 5,
  },
];

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "add-on-entitlements";
let state: AddOnStateType = loadDemoState(SLOT, addOnStateSchema, {
  products: DEFAULT_PRODUCTS,
  purchases: [],
});
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useAddOnVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* Catalog management                                                  */
/* ------------------------------------------------------------------ */

export function getAddOnProducts(): AddOnProduct[] {
  return [...state.products].sort((a, b) => a.order - b.order);
}

export function getAddOnProduct(productId: string): AddOnProduct | null {
  return state.products.find((p) => p.id === productId) ?? null;
}

export function updateAddOnProduct(
  productId: string,
  updates: Partial<AddOnProduct>,
  actor: string,
): void {
  const existing = state.products.find((p) => p.id === productId);
  if (!existing) return;
  state.products = state.products.map((p) =>
    p.id === productId ? { ...p, ...updates } : p,
  );
  notify();
  recordAudit({
    action: "Updated add-on product",
    entity: "add-on-entitlement",
    entityId: productId,
    summary: `Add-on "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function addAddOnProduct(
  product: Omit<AddOnProduct, "id">,
  actor: string,
): AddOnProduct {
  const id = `addon-${Date.now()}`;
  const newProduct: AddOnProduct = { id, ...product };
  state.products = [...state.products, newProduct];
  notify();
  recordAudit({
    action: "Added add-on product",
    entity: "add-on-entitlement",
    entityId: id,
    summary: `Add-on "${newProduct.name}" ($${newProduct.price} ${newProduct.currency}) added by ${actor}`,
    severity: "info",
  });
  return newProduct;
}

export function removeAddOnProduct(productId: string, actor: string): void {
  const existing = state.products.find((p) => p.id === productId);
  if (!existing) return;
  state.products = state.products.filter((p) => p.id !== productId);
  notify();
  recordAudit({
    action: "Removed add-on product",
    entity: "add-on-entitlement",
    entityId: productId,
    summary: `Add-on "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */

export function purchaseAddOn(
  traderId: string,
  accountId: string,
  addOnId: string,
  opts: { paymentReference?: string; actor?: string } = {},
): AddOnPurchase | null {
  const product = getAddOnProduct(addOnId);
  if (!product || !product.enabled) return null;

  const existing = getActiveEntitlement(
    traderId,
    accountId,
    product.entitlementType,
  );
  if (existing) return existing; // already entitled — no double charge

  const purchase: AddOnPurchase = {
    id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    traderId,
    accountId,
    addOnId,
    addOnName: product.name,
    entitlementType: product.entitlementType,
    price: product.price,
    currency: product.currency,
    purchasedAt: new Date().toISOString(),
    expiresAt:
      product.durationDays > 0
        ? new Date(Date.now() + product.durationDays * 86_400_000).toISOString()
        : undefined,
    usesRemaining: product.maxUses,
    status: "active",
    paymentReference: opts.paymentReference,
  };

  state.purchases = [...state.purchases, purchase];
  notify();

  recordAudit({
    action: "Purchased add-on",
    entity: "add-on-entitlement",
    entityId: purchase.id,
    summary: `"${product.name}" purchased by ${traderId} (account ${accountId}) for $${product.price} ${product.currency}`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "addon.purchased",
    actor: "trader",
    key: `addon:${purchase.id}`,
    payload: {
      accountId,
      traderId,
      addOnId,
      addOnName: product.name,
      entitlementType: product.entitlementType,
      price: product.price,
      currency: product.currency,
    },
  });

  return purchase;
}

export function refundAddOn(purchaseId: string, actor: string): boolean {
  const purchase = state.purchases.find((p) => p.id === purchaseId);
  if (!purchase || purchase.status === "refunded") return false;

  state.purchases = state.purchases.map((p) =>
    p.id === purchaseId ? { ...p, status: "refunded" as const } : p,
  );
  notify();

  recordAudit({
    action: "Refunded add-on",
    entity: "add-on-entitlement",
    entityId: purchaseId,
    summary: `Add-on "${purchase.addOnName}" refunded to ${purchase.traderId} by ${actor}`,
    severity: "warning",
  });
  return true;
}

export function getPurchases(
  filters?: { accountId?: string; traderId?: string; status?: AddOnPurchase["status"] },
): AddOnPurchase[] {
  let list = [...state.purchases];
  if (filters?.accountId) list = list.filter((p) => p.accountId === filters.accountId);
  if (filters?.traderId) list = list.filter((p) => p.traderId === filters.traderId);
  if (filters?.status) list = list.filter((p) => p.status === filters.status);
  return list;
}

/* ------------------------------------------------------------------ */
/* Entitlement checks (the payout/pre-trade gate read API)             */
/* ------------------------------------------------------------------ */

export function getActiveEntitlement(
  traderId: string,
  accountId: string,
  entitlementType: EntitlementType,
): AddOnPurchase | null {
  return (
    state.purchases.find(
      (p) =>
        p.traderId === traderId &&
        p.accountId === accountId &&
        p.entitlementType === entitlementType &&
        p.status === "active" &&
        (!p.expiresAt || new Date(p.expiresAt) > new Date()) &&
        p.usesRemaining !== 0,
    ) ?? null
  );
}

export function hasEntitlement(
  traderId: string,
  accountId: string,
  entitlementType: EntitlementType,
): boolean {
  return getActiveEntitlement(traderId, accountId, entitlementType) !== null;
}

/** Decrement a use-limited entitlement; returns false when exhausted. */
export function consumeEntitlement(
  traderId: string,
  accountId: string,
  entitlementType: EntitlementType,
): boolean {
  const entitlement = getActiveEntitlement(traderId, accountId, entitlementType);
  if (!entitlement) return false;
  if (entitlement.usesRemaining === 0) return false;

  state.purchases = state.purchases.map((p) => {
    if (p.id !== entitlement.id || p.usesRemaining === 0) return p;
    const remaining = p.usesRemaining - 1;
    return {
      ...p,
      usesRemaining: remaining,
      status: remaining === 0 ? ("exhausted" as const) : p.status,
    };
  });
  notify();

  recordAudit({
    action: "Consumed add-on entitlement",
    entity: "add-on-entitlement",
    entityId: entitlement.id,
    summary: `"${entitlement.addOnName}" entitlement consumed by ${traderId} (account ${accountId})`,
    severity: "info",
  });
  return true;
}

export interface PayoutGateEntitlements {
  expressPayout: boolean;
  weekendTrading: boolean;
  prioritySupport: boolean;
  customLeverage: boolean;
  extendedDrawdown: boolean;
}

/** Read API for the payout gate + pre-trade surfaces. */
export function getPayoutGateEntitlements(
  traderId: string,
  accountId: string,
): PayoutGateEntitlements {
  return {
    expressPayout: hasEntitlement(traderId, accountId, "express-payout"),
    weekendTrading: hasEntitlement(traderId, accountId, "weekend-trading"),
    prioritySupport: hasEntitlement(traderId, accountId, "priority-support"),
    customLeverage: hasEntitlement(traderId, accountId, "custom-leverage"),
    extendedDrawdown: hasEntitlement(traderId, accountId, "extended-drawdown"),
  };
}

export function checkExpressPayoutEligibility(
  traderId: string,
  accountId: string,
): { eligible: boolean; reason?: string } {
  if (hasEntitlement(traderId, accountId, "express-payout"))
    return { eligible: true };
  return {
    eligible: false,
    reason: "Express payout requires the 'Express Payout' add-on",
  };
}

/* ------------------------------------------------------------------ */
/* Evaluator — expiry sweep                                            */
/* ------------------------------------------------------------------ */

export function useAddOnEvaluator(_tenantId: string): void {
  // 60s tick: flip active purchases past their expiry to "expired"
  // (idempotent — status flips once).
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      let changed = false;
      state.purchases = state.purchases.map((p) => {
        if (
          p.status === "active" &&
          p.expiresAt &&
          new Date(p.expiresAt).getTime() <= now
        ) {
          changed = true;
          return { ...p, status: "expired" as const };
        }
        return p;
      });
      if (changed) notify();
    };
    const t = setInterval(sweep, 60_000);
    return () => clearInterval(t);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getAddOnStats(): {
  totalProducts: number;
  activeProducts: number;
  totalPurchases: number;
  activeEntitlements: number;
  expiredEntitlements: number;
  totalRevenue: number;
  topSellingAddOn: string | null;
} {
  const nonRefunded = state.purchases.filter((p) => p.status !== "refunded");
  const salesByAddOn: Record<string, number> = {};
  for (const p of nonRefunded) {
    salesByAddOn[p.addOnName] = (salesByAddOn[p.addOnName] ?? 0) + 1;
  }
  return {
    totalProducts: state.products.length,
    activeProducts: state.products.filter((p) => p.enabled).length,
    totalPurchases: state.purchases.length,
    activeEntitlements: state.purchases.filter((p) => p.status === "active").length,
    expiredEntitlements: state.purchases.filter(
      (p) => p.status === "expired" || p.status === "exhausted",
    ).length,
    totalRevenue: nonRefunded.reduce((s, p) => s + p.price, 0),
    topSellingAddOn:
      Object.entries(salesByAddOn).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
  };
}
