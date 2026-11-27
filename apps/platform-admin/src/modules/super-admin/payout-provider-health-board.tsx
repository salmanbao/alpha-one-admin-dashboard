"use client";

/**
 * Payout Provider Health Board — R10 PF-04.
 *
 * Health metrics for payout providers across all rails — bank transfer,
 * crypto, PayPal, Skrill. Consumes the SHARED Provider record from the
 * provider catalog (provider-catalog.ts) so the registry and this board
 * can never drift (Screen Improvement Report P1-2).
 *
 * This is the payout SLICE of the provider family: it renders payout
 * capability + payouts-in-flight + last failure, and consumes the shared
 * health fields (latencyMs / errorRatePct / status / config / timestamps).
 */

import { useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/platform/status";
import { PROVIDERS, type Provider, providerStatusTone } from "@/lib/platform/provider-catalog";
import {
  DollarSign,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

const PayoutCapabilityIcon: Record<string, ComponentType<{ className?: string }>> = {
  crypto: DollarSign,
  paypal: DollarSign,
  skrill: DollarSign,
  "bank-transfer": Globe,
};

/**
 * Tenant dependency sets per provider (P2-5). The registry surfaces these
 * as a dependency list; the payout board unions them to count DISTINCT
 * tenants served (an edge sum double-counts a tenant using two rails).
 */
const PROVIDER_TENANT_SETS: Record<string, string[]> = {
  nowpayments: ["tenant-alpha", "tenant-beta"],
  match2pay: ["tenant-beta"],
  "paypal-payouts": ["tenant-alpha", "tenant-beta", "tenant-gamma"],
  "skrill-payouts": ["tenant-alpha", "tenant-gamma"],
};

const formatLatency = (ms: number | null): string =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

const formatPct = (v: number | null): string =>
  v === null ? "—" : `${v.toFixed(1)}%`;

const formatAgo = (at: number): string => {
  const diff = Date.now() - at;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

export function PayoutProviderHealthBoard() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => PROVIDERS, { delayMs: 450 }), []);
  const providers = loadedData ?? [];

  const payoutProviders = useMemo(
    () => providers.filter((p) => p.payoutCapability !== "none"),
    [providers],
  );
  const operational = payoutProviders.filter((p) => p.status === "operational").length;
  const degraded = payoutProviders.filter((p) => p.status === "degraded").length;
  const down = payoutProviders.filter((p) => p.status === "down").length;

  // P2-5: distinct tenants across payout rails (not an edge sum).
  const tenantsServed = useMemo(() => {
    const set = new Set<string>();
    payoutProviders.forEach((p) => {
      (PROVIDER_TENANT_SETS[p.id] ?? []).forEach((t) => set.add(t));
    });
    return set.size;
  }, [payoutProviders]);

  return (
    <Page>
      <PageHeader
        title="Payout Provider Health Board"
        description="Health metrics for payout providers across all rails — bank transfer, crypto, PayPal, Skrill. Includes payouts in flight and last failure."
        icon={DollarSign}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading payout provider health…"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="Payout Providers" value={payoutProviders.length} icon={Globe} />
            <MetricCard label="Operational" value={operational} icon={CheckCircle2} tone="positive" />
            <MetricCard
              label="Degraded"
              value={degraded}
              icon={AlertTriangle}
              tone={degraded > 0 ? "warning" : "positive"}
            />
            <MetricCard
              label="Down"
              value={down}
              icon={AlertTriangle}
              tone={down > 0 ? "negative" : "positive"}
            />
            <MetricCard label="Tenants Served" value={tenantsServed} icon={ShieldCheck} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payoutProviders.map((p) => {
              const Icon = p.icon;
              const CapabilityIcon = PayoutCapabilityIcon[p.payoutCapability] || Globe;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "transition",
                    p.status === "degraded" && "border-amber-200",
                    p.status === "down" && "border-rose-200",
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-muted p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.type}</p>
                      </div>
                    </div>
                    <StatusBadge tone={providerStatusTone(p.status)}>{p.status}</StatusBadge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payout capability</span>
                      <div className="flex items-center gap-1">
                        <CapabilityIcon className="h-3 w-3" />
                        <span className="capitalize text-xs font-medium">{p.payoutCapability}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-medium tabular-nums">{formatLatency(p.latencyMs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Error rate</span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          (p.errorRatePct ?? 0) > 1 ? "text-amber-600" : "",
                        )}
                      >
                        {formatPct(p.errorRatePct)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tenants using</span>
                      <span className="font-medium tabular-nums">{p.tenantsUsing}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Fingerprint className="h-3 w-3" />
                        {p.credentialFingerprint}
                      </span>
                      <StatusBadge tone={p.config === "Configured" ? "success" : "warning"}>{p.config}</StatusBadge>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="text-muted-foreground">Last success</span>
                      <span className="font-medium">{formatAgo(p.lastSuccessAt)}</span>
                    </div>
                    {p.payoutsInFlight !== undefined && (
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="text-muted-foreground">Payouts in flight</span>
                        <span className="font-medium tabular-nums">{p.payoutsInFlight}</span>
                      </div>
                    )}
                    {p.lastFailure && (
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="text-muted-foreground">Last failure</span>
                        <span className="font-medium">{p.lastFailure.code}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}