/**
 * Provider registry catalog — shared read model for the provider
 * registry page and anything that must name a provider-registry root
 * cause (R9 W6 UC-P4 incident correlation, UC-P5 SLA credits).
 *
 * Extracted from provider-registry-page so the incident center can
 * resolve `incident.providerId → provider name/status` without a
 * cross-page import. Health values are demo data (honest seed — the
 * registry page labels them as such); credentials are fingerprint-only
 * by house rule: never render the actual key.
 */

import {
  ShieldCheck,
  DollarSign,
  Bell,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

export interface Provider {
  id: string;
  name: string;
  type: string;
  icon: ComponentType<{ className?: string }>;
  status: "operational" | "degraded" | "down";
  latencyMs: number | null;
  errorRatePct: number | null;
  tenantsUsing: number;
  credentialFingerprint: string;
  lastRotatedAt: number;
  lastSuccessAt: number;
  checkedAt: number;
  config: "Configured" | "Not configured" | "Pending";
  payoutCapability: "bank-transfer" | "crypto" | "paypal" | "skrill" | "none";
  /** Payout slice fields promised by the payout health board (R10 PF-04) */
  payoutsInFlight?: number;
  lastFailure?: { at: number; code: string };
}

/** Helper to parse latency strings like "320ms" or "1.2s" to milliseconds */
function parseLatency(s: string): number {
  if (s.endsWith("ms")) return parseInt(s.slice(0, -2), 10);
  if (s.endsWith("s")) return Math.round(parseFloat(s.slice(0, -1)) * 1000);
  return 0;
}

/** Helper to parse error rate strings like "2.1%" to percentage number */
function parseErrorRate(s: string): number {
  return parseFloat(s.replace("%", ""));
}

/** Fixed demo timestamps for reproducible demo data (anchored to a base time) */
const BASE_TIME = new Date("2026-01-15T10:00:00Z").getTime();
const daysAgo = (n: number) => BASE_TIME - n * 24 * 60 * 60 * 1000;
const hoursAgo = (n: number) => BASE_TIME - n * 60 * 60 * 1000;
const minutesAgo = (n: number) => BASE_TIME - n * 60 * 1000;
const secondsAgo = (n: number) => BASE_TIME - n * 1000;

export const PROVIDERS: Provider[] = [
  {
    id: "metaapi",
    name: "MetaApi",
    type: "Trading Bridge",
    icon: Zap,
    status: "degraded",
    latencyMs: parseLatency("320ms"),
    errorRatePct: parseErrorRate("2.1%"),
    tenantsUsing: 3,
    credentialFingerprint: "••••8A42",
    lastRotatedAt: daysAgo(12),
    lastSuccessAt: secondsAgo(30),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "none",
    payoutsInFlight: 0,
  },
  {
    id: "veriff",
    name: "Veriff",
    type: "KYC Provider",
    icon: ShieldCheck,
    status: "operational",
    latencyMs: parseLatency("310ms"),
    errorRatePct: parseErrorRate("0.1%"),
    tenantsUsing: 2,
    credentialFingerprint: "••••F19C",
    lastRotatedAt: daysAgo(45),
    lastSuccessAt: minutesAgo(2),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "none",
    payoutsInFlight: 0,
  },
  {
    id: "nowpayments",
    name: "NOWPayments",
    type: "Payment Provider",
    icon: DollarSign,
    status: "operational",
    latencyMs: parseLatency("210ms"),
    errorRatePct: parseErrorRate("0.3%"),
    tenantsUsing: 2,
    credentialFingerprint: "••••3B7E",
    lastRotatedAt: daysAgo(8),
    lastSuccessAt: minutesAgo(1),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "crypto",
    payoutsInFlight: 0,
  },
  {
    id: "postmark",
    name: "Postmark",
    type: "Notification Service",
    icon: Bell,
    status: "degraded",
    latencyMs: parseLatency("680ms"),
    errorRatePct: parseErrorRate("1.4%"),
    tenantsUsing: 3,
    credentialFingerprint: "••••C2D5",
    lastRotatedAt: daysAgo(30),
    lastSuccessAt: minutesAgo(5),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "none",
    payoutsInFlight: 0,
  },
  {
    id: "match2pay",
    name: "Match2Pay",
    type: "Payment Provider",
    icon: DollarSign,
    status: "operational",
    latencyMs: parseLatency("180ms"),
    errorRatePct: parseErrorRate("0.2%"),
    tenantsUsing: 1,
    credentialFingerprint: "••••E9A1",
    lastRotatedAt: daysAgo(20),
    lastSuccessAt: minutesAgo(3),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "crypto",
    payoutsInFlight: 0,
  },
  {
    id: "twilio",
    name: "Twilio",
    type: "SMS Provider",
    icon: Bell,
    status: "down",
    latencyMs: parseLatency("150ms"),
    errorRatePct: parseErrorRate("0.0%"),
    tenantsUsing: 1,
    credentialFingerprint: "••••7F3B",
    lastRotatedAt: daysAgo(60),
    lastSuccessAt: hoursAgo(1),
    checkedAt: BASE_TIME,
    config: "Not configured",
    payoutCapability: "none",
    payoutsInFlight: 0,
  },
  {
    id: "paypal-payouts",
    name: "PayPal Payouts",
    type: "Payout Provider",
    icon: DollarSign,
    status: "operational",
    latencyMs: parseLatency("1.2s"),
    errorRatePct: parseErrorRate("0.8%"),
    tenantsUsing: 4,
    credentialFingerprint: "••••G7H2",
    lastRotatedAt: daysAgo(5),
    lastSuccessAt: secondsAgo(45),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "paypal",
    payoutsInFlight: 12,
    lastFailure: { at: daysAgo(2), code: "PAYER_ACTION_REQUIRED" },
  },
  {
    id: "skrill-payouts",
    name: "Skrill Payouts",
    type: "Payout Provider",
    icon: DollarSign,
    status: "degraded",
    latencyMs: parseLatency("1.5s"),
    errorRatePct: parseErrorRate("3.4%"),
    tenantsUsing: 2,
    credentialFingerprint: "••••K9L4",
    lastRotatedAt: daysAgo(14),
    lastSuccessAt: minutesAgo(12),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "skrill",
    payoutsInFlight: 3,
    lastFailure: { at: daysAgo(1), code: "INSUFFICIENT_BALANCE" },
  },
  {
    id: "broker-bridge",
    name: "Broker Bridge",
    type: "Broker Integration",
    icon: Zap,
    status: "operational",
    latencyMs: parseLatency("400ms"),
    errorRatePct: parseErrorRate("0.5%"),
    tenantsUsing: 1,
    credentialFingerprint: "••••M7N8",
    lastRotatedAt: daysAgo(7),
    lastSuccessAt: secondsAgo(20),
    checkedAt: BASE_TIME,
    config: "Configured",
    payoutCapability: "none",
    payoutsInFlight: 0,
  },
];

/** Display name for a provider id — falls back to the raw id. */
export function providerName(providerId: string): string {
  return PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;
}

export function providerById(providerId: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Single source of truth for provider status tone (P2-7) — used by the
 * registry card dot, the registry detail badge, and the payout board badge
 * so all three surfaces render a provider's status identically.
 */
export function providerStatusTone(s: Provider["status"]): "success" | "warning" | "danger" {
  return s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";
}