"use client";

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { PROVIDERS, type Provider } from "@/lib/platform/provider-catalog";
import {
  DollarSign,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  KeyRound,
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

export function PayoutProviderHealthBoard() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => PROVIDERS, { delayMs: 450 }), []);
  const providers = loadedData ?? [];

  const payoutProviders = providers.filter((p) => p.payoutCapability !== "none");
  const operational = payoutProviders.filter((p) => p.status === "operational").length;
  const degraded = payoutProviders.filter((p) => p.status === "degraded").length;
  const down = payoutProviders.filter((p) => p.status === "down").length;

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard label="Payout Providers" value={payoutProviders.length} icon={Globe} />
          <MetricCard label="Operational" value={operational} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Degraded" value={degraded} icon={AlertTriangle} tone={degraded > 0 ? "warning" : "positive"} />
          <MetricCard label="Down" value={down} icon={AlertTriangle} tone={down > 0 ? "negative" : "positive"} />
          <MetricCard label="Tenants Served" value={payoutProviders.reduce((s, p) => s + p.tenantsUsing, 0)} icon={ShieldCheck} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {payoutProviders.map((p) => {
            const Icon = p.icon;
            const CapabilityIcon = PayoutCapabilityIcon[p.payoutCapability] || Globe;
            return (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer transition hover:shadow-md",
                  p.status === "degraded" && "border-amber-100",
                  p.status === "down" && "border-rose-100",
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.type}</p>
                    </div>
                  </div>
                  <StatusBadge tone={p.status === "operational" ? "success" : p.status === "degraded" ? "warning" : "danger"}>{p.status}</StatusBadge>
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
                    <span className="font-medium tabular-nums">{p.latency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Error rate</span>
                    <span className={cn("font-medium tabular-nums", parseFloat(p.errorRate) > 1 ? "text-amber-600" : "")}>{p.errorRate}</span>
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
                    <span className="font-medium">{p.lastSuccess}</span>
                  </div>
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