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
  latency: string;
  errorRate: string;
  tenantsUsing: number;
  credentialFingerprint: string;
  lastRotated: string;
  lastSuccess: string;
  config: string;
  /** Payout capability this provider supports (R10 PF-04) */
  payoutCapability: "bank-transfer" | "crypto" | "paypal" | "skrill" | "none";
}

export const PROVIDERS: Provider[] = [
  {
    id: "metaapi",
    name: "MetaApi",
    type: "Trading Bridge",
    icon: Zap,
    status: "degraded",
    latency: "320ms",
    errorRate: "2.1%",
    tenantsUsing: 3,
    credentialFingerprint: "••••8A42",
    lastRotated: "12 days ago",
    lastSuccess: "30s ago",
    config: "Configured",
    payoutCapability: "none",
  },
  {
    id: "veriff",
    name: "Veriff",
    type: "KYC Provider",
    icon: ShieldCheck,
    status: "operational",
    latency: "310ms",
    errorRate: "0.1%",
    tenantsUsing: 2,
    credentialFingerprint: "••••F19C",
    lastRotated: "45 days ago",
    lastSuccess: "2m ago",
    config: "Configured",
    payoutCapability: "none",
  },
  {
    id: "nowpayments",
    name: "NOWPayments",
    type: "Payment Provider",
    icon: DollarSign,
    status: "operational",
    latency: "210ms",
    errorRate: "0.3%",
    tenantsUsing: 2,
    credentialFingerprint: "••••3B7E",
    lastRotated: "8 days ago",
    lastSuccess: "1m ago",
    config: "Configured",
    payoutCapability: "crypto",
  },
  {
    id: "postmark",
    name: "Postmark",
    type: "Notification Service",
    icon: Bell,
    status: "degraded",
    latency: "680ms",
    errorRate: "1.4%",
    tenantsUsing: 3,
    credentialFingerprint: "••••C2D5",
    lastRotated: "30 days ago",
    lastSuccess: "5m ago",
    config: "Configured",
    payoutCapability: "none",
  },
  {
    id: "match2pay",
    name: "Match2Pay",
    type: "Payment Provider",
    icon: DollarSign,
    status: "operational",
    latency: "180ms",
    errorRate: "0.2%",
    tenantsUsing: 1,
    credentialFingerprint: "••••E9A1",
    lastRotated: "20 days ago",
    lastSuccess: "3m ago",
    config: "Configured",
    payoutCapability: "crypto",
  },
  {
    id: "twilio",
    name: "Twilio",
    type: "SMS Provider",
    icon: Bell,
    status: "operational",
    latency: "150ms",
    errorRate: "0.0%",
    tenantsUsing: 1,
    credentialFingerprint: "••••7F3B",
    lastRotated: "60 days ago",
    lastSuccess: "1h ago",
    config: "Not configured",
    payoutCapability: "none",
  },
  {
    id: "paypal-payouts",
    name: "PayPal Payouts",
    type: "Payout Provider",
    icon: DollarSign,
    status: "operational",
    latency: "1.2s",
    errorRate: "0.8%",
    tenantsUsing: 4,
    credentialFingerprint: "••••G7H2",
    lastRotated: "5 days ago",
    lastSuccess: "45s ago",
    config: "Configured",
    payoutCapability: "paypal",
  },
  {
    id: "skrill-payouts",
    name: "Skrill Payouts",
    type: "Payout Provider",
    icon: DollarSign,
    status: "degraded",
    latency: "1.5s",
    errorRate: "3.4%",
    tenantsUsing: 2,
    credentialFingerprint: "••••K9L4",
    lastRotated: "14 days ago",
    lastSuccess: "12m ago",
    config: "Configured",
    payoutCapability: "skrill",
  },
];

/** Display name for a provider id — falls back to the raw id. */
export function providerName(providerId: string): string {
  return PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;
}

export function providerById(providerId: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}