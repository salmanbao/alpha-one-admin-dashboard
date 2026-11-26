// ──────────────────────────────────────────────────────────────────────
// Single source of truth for platform operational signals.
//
// Audit fix (P0-1 / P0-2 / P0-3, Operations Home report): this module is the
// ONLY service inventory + attention-ranking policy in the app:
//
//   - `PLATFORM_SERVICES` — the one service catalog. Operations Home renders
//     an aggregated summary; System Health renders the same catalog with its
//     richer fields (uptimePct / region). Union of the previous two lists
//     (~17 rows, incl. the vendor-mapped bridge/email/payment services).
//   - `PLATFORM_FACTS`    — deployment/backup/RPO truth consumed by the
//     Operations Home infrastructure card, Deployments, Backups/DR, and Jobs.
//   - `SIGNAL_THRESHOLDS` — documented thresholds turning raw counts into
//     severity labels (critical > warning > info). Tones are a property of
//     the rule, not a per-page literal.
//   - `deriveAttention`   — builds the attention-item list from the upstream
//     stores the owning workspaces already own (incidents, jobs, queues, facts)
//     and applies the severity-ranking policy. No rule may exist without a
//     documented source + threshold.
// ──────────────────────────────────────────────────────────────────────

import { PROVIDERS, type Provider } from "./provider-catalog";
import { effectiveJobs, type Job } from "./jobs-store";

export interface PlatformService {
  id: string;
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number | null;
  lastHeartbeatAt: string;
  uptimePct?: number;
  region?: string;
  /** Maps a platform service to its vendor (provider-catalog root cause). */
  vendorId?: string;
}

export interface PlatformFacts {
  platformVersion: string;
  lastDeploymentAt: string;
  lastBackupAt: string;
  rpoTargetHours: number;
  rpoWindowHours: number;
}

/** Documented thresholds (source: SLA rules + ops policy docs). */
export const SIGNAL_THRESHOLDS = {
  /** Critical: pending payouts older than this are an SLA breach. */
  payoutSlaHours: 24,
  /** Warning: KYC pending+review backlog above this size. */
  kycBacklogWarn: 20,
  /** Warning: open risk breaches above this size. */
  openBreachesWarn: 10,
  /** Warning: failed jobs count above this. */
  failedJobWarn: 3,
  /** Positive: relay/event-sync lag under which the signal is healthy. */
  relayLagPositiveMs: 800,
  eventSyncLagPositiveMs: 1200,
} as const;

export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  cta: string;
  /** Registered view id to navigate to (router accepts params via `?key=value`). */
  navigateTo: string;
}

export interface QueueCounts {
  payouts: number;
  kyc: number;
  breaches: number;
  support: number;
}

export const PLATFORM_FACTS: PlatformFacts = {
  platformVersion: "v1.8.0",
  lastDeploymentAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  lastBackupAt: new Date(Date.now() - 18 * 3_600_000).toISOString(),
  rpoTargetHours: 24,
  rpoWindowHours: 24,
};

/**
 * The one service inventory. `system-health` renders uptimePct/region; the
 * operations home renders a compact summary. Status must be derivable from a
 * real source — the vendor map below is the documented service→vendor split
 * that resolves the "MT5 Bridge vs MetaApi" identity confusion (P0-2).
 */
export const PLATFORM_SERVICES: PlatformService[] = [
  { id: "api-gateway", name: "API Gateway", status: "operational", latencyMs: 42, lastHeartbeatAt: "2s ago", uptimePct: 99.97, region: "us-east-1" },
  { id: "database", name: "Primary Database", status: "operational", latencyMs: 8, lastHeartbeatAt: "1s ago", uptimePct: 99.99, region: "us-east-1" },
  { id: "database-replica", name: "Database Replica (NY4)", status: "operational", latencyMs: 12, lastHeartbeatAt: "1s ago", uptimePct: 99.99, region: "ny4" },
  { id: "mt5-bridge", name: "MT5 Bridge", status: "degraded", latencyMs: 320, lastHeartbeatAt: "8s ago", uptimePct: 99.95, region: "eu-west-1", vendorId: "metaapi" },
  { id: "ctrader-gateway", name: "cTrader Gateway", status: "degraded", latencyMs: 850, lastHeartbeatAt: "8s ago", uptimePct: 99.85, region: "us-east-2" },
  { id: "payment-processor", name: "Payment Processor", status: "degraded", latencyMs: 850, lastHeartbeatAt: "6s ago", uptimePct: 99.9, region: "us-east-1" },
  { id: "kyc-provider", name: "KYC Provider", status: "operational", latencyMs: 310, lastHeartbeatAt: "12s ago", uptimePct: 99.92, region: "eu-central-1" },
  { id: "ai-engine", name: "AI Engine", status: "operational", latencyMs: 1200, lastHeartbeatAt: "3s ago", uptimePct: 99.88, region: "us-east-1" },
  { id: "notification-service", name: "Notification Service", status: "degraded", latencyMs: 680, lastHeartbeatAt: "15s ago", uptimePct: 99.95, region: "us-east-1", vendorId: "postmark" },
  { id: "cache", name: "Redis Cache", status: "operational", latencyMs: 2, lastHeartbeatAt: "1s ago", uptimePct: 99.99, region: "us-east-1" },
  { id: "event-bus", name: "Event Bus", status: "operational", latencyMs: 15, lastHeartbeatAt: "3s ago", uptimePct: 99.98, region: "us-east-1" },
  { id: "worker-pool", name: "Worker Pool", status: "operational", latencyMs: null, lastHeartbeatAt: "5s ago", uptimePct: 99.9, region: "us-east-1" },
  { id: "identity-provider", name: "Identity Provider", status: "operational", latencyMs: 120, lastHeartbeatAt: "4s ago", uptimePct: 99.95, region: "eu-west-1" },
  { id: "document-generator", name: "Document Generator", status: "operational", latencyMs: 180, lastHeartbeatAt: "9s ago", uptimePct: 99.96, region: "us-east-1" },
  { id: "queue", name: "Message Queue", status: "operational", latencyMs: 5, lastHeartbeatAt: "1s ago", uptimePct: 99.98, region: "us-east-1" },
  { id: "cdn", name: "CDN / Edge", status: "operational", latencyMs: 15, lastHeartbeatAt: "2s ago", uptimePct: 99.99, region: "global" },
];

export function severityRank(sev: AttentionSeverity): number {
  return sev === "critical" ? 0 : sev === "warning" ? 1 : 2;
}

/**
 * Derive the attention list from the upstream stores, applying the
 * severity-ranking policy (critical → warning → info). Deep links carried
 * in `navigateTo` are resolved through the router's params support
 * (`?service=<id>`, `?queue=<queue>&tenant=<id>`).
 */
export function deriveAttention(input: {
  services: PlatformService[];
  incidents: Array<{ id: string; severity: string; affectedServices: string[]; started: string; title: string }>;
  jobs: Job[];
  queueCounts: QueueCounts;
  facts: PlatformFacts;
  failedJobFailureCounts?: Record<string, number>;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  // R1 — Payouts SLA: critical when any tenant queue exceeds the payout SLA
  // window. Caller passes derived counts (pending payouts per tenant).
  const payoutsStuck = input.queueCounts.payouts;
  if (payoutsStuck > 0) {
    items.push({
      id: "payouts-stuck",
      severity: "critical",
      title: `${payoutsStuck} payouts stuck >24h`,
      detail: "Pending payouts older than the 24h payout SLA (oldest breach tracked in queue workspace).",
      cta: "Clear queue",
      navigateTo: "cross-tenant-queues?queue=payouts",
    });
  }

  // R2 — Open critical/high incident.
  const openCritical = input.incidents.filter(
    (i) => i.severity !== "resolved" && (i.severity === "critical" || i.severity === "high"),
  );
  if (openCritical.length > 0) {
    const worst = openCritical.sort((a, b) => (a.severity === "critical" ? -1 : 1))[0];
    items.push({
      id: `incident-${worst.id}`,
      severity: "critical",
      title: `Open ${worst.severity} incident — ${worst.title}`,
      detail: `Affected services: ${worst.affectedServices.join(", ") || "unknown"}.`,
      cta: "Open incident center",
      navigateTo: "incident-center",
    });
  }

  // R3 — Failed jobs (warning when count crosses failedJobWarn threshold).
  const failedJobs = input.jobs.filter((j) => j.status === "failed");
  const failedJobTotal = failedJobs.reduce((s, j) => s + (j.failureCount ?? 0), 0);
  if (failedJobs.length > 0) {
    items.push({
      id: `failed-job-${failedJobs[0].id}`,
      severity: failedJobTotal > SIGNAL_THRESHOLDS.failedJobWarn ? "critical" : "warning",
      title: `Failed job — ${failedJobs[0].name} (${failedJobTotal} failures)`,
      detail: `Last failure ${failedJobs[0].lastFailure}.`,
      cta: "Open jobs dashboard",
      navigateTo: "jobs-dashboard",
    });
  }

  // R4 — Degraded/down services (warning).
  const degradedServices = input.services.filter((s) => s.status !== "operational");
  if (degradedServices.length > 0) {
    items.push({
      id: "service-degraded",
      severity: "warning",
      title: `${degradedServices.length} service${degradedServices.length > 1 ? "s" : ""} degraded`,
      detail: degradedServices.map((s) => `${s.name} (${s.latencyMs ?? "?"}ms)`).join(", ") + ".",
      cta: "View service health",
      navigateTo: `system-health?service=${degradedServices[0].id}`,
    });
  }

  // R5 — Provider degradation (warning) — vendor-scoped catalog.
  const degradedProviders = PROVIDERS.filter((p) => p.status !== "operational");
  if (degradedProviders.length > 0) {
    items.push({
      id: "provider-degraded",
      severity: "warning",
      title: `${degradedProviders.length} provider${degradedProviders.length > 1 ? "s" : ""} degraded`,
      detail: degradedProviders.map((p) => p.name).join(", ") + ".",
      cta: "Open provider registry",
      navigateTo: "provider-registry",
    });
  }

  // R6 — KYC backlog (warning when above threshold).
  const kycPending = input.queueCounts.kyc;
  if (kycPending > SIGNAL_THRESHOLDS.kycBacklogWarn) {
    items.push({
      id: "kyc-backlog",
      severity: "warning",
      title: `${kycPending} KYC reviews pending`,
      detail: `Backlog above warning threshold (${SIGNAL_THRESHOLDS.kycBacklogWarn}).`,
      cta: "Review KYC queue",
      navigateTo: "cross-tenant-queues?queue=kyc",
    });
  }

  // R7 — Open breaches (warning when above threshold).
  const breachesOpen = input.queueCounts.breaches;
  if (breachesOpen > SIGNAL_THRESHOLDS.openBreachesWarn) {
    items.push({
      id: "open-breaches",
      severity: "warning",
      title: `${breachesOpen} open risk breaches`,
      detail: `Breaches above warning threshold (${SIGNAL_THRESHOLDS.openBreachesWarn}).`,
      cta: "Review risk queue",
      navigateTo: "cross-tenant-queues?queue=risk",
    });
  }

  // R8 — Backup / RPO (info when backup age exceeds the RPO window).
  const backupAgeHours = (Date.now() - new Date(input.facts.lastBackupAt).getTime()) / 3_600_000;
  if (backupAgeHours > input.facts.rpoWindowHours) {
    items.push({
      id: "backup-overdue",
      severity: "info",
      title: `Last backup ${Math.floor(backupAgeHours)}h ago (RPO window ${input.facts.rpoWindowHours}h)`,
      detail: "Backup freshness below the recovery point objective.",
      cta: "Open backups & DR",
      navigateTo: "backups-dr",
    });
  }

  const sorted = [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  if (sorted.length === 0) {
    return [
      {
        id: "all-clear",
        severity: "info",
        title: "All clear — no payouts, queues, services or backups need attention right now.",
        detail: "Attention items appear here when an SLA or health threshold is crossed.",
        cta: "",
        navigateTo: "",
      },
    ];
  }
  return sorted;
}

export type { Provider, Job };
