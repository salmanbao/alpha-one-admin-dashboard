"use client";

/**
 * Provider / Integration Registry — research item #12.
 *
 * Lists all external providers (MetaApi, Veriff, NOWPayments, Postmark,
 * Match2Pay, etc.) with health, latency, credential status (fingerprint
 * only — never the actual key), and tenant usage.
 *
 * Critical security rule: never display provider secrets.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { PROVIDERS, type Provider } from "@/lib/platform/provider-catalog";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import {
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  KeyRound,
  Fingerprint,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusTone = (s: Provider["status"]) =>
  s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

export function ProviderRegistryPage() {
  // Async seam (frontend-first): data resolves via the mock layer so the
  // loading skeleton + error/retry states are exercised.
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => PROVIDERS, { delayMs: 450 }), []);
  const providers = loadedData ?? [];
  const [selected, setSelected] = useState<Provider | null>(null);
  const operational = providers.filter((p) => p.status === "operational").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;

  return (
    <Page>
      <PageHeader
        title="Provider Registry"
        description="External integrations and their health. Credentials are never displayed — only fingerprints."
        icon={Globe}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading provider registry…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Providers" value={providers.length} icon={Globe} />
          <MetricCard label="Operational" value={operational} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Degraded" value={degraded} icon={AlertTriangle} tone={degraded > 0 ? "warning" : "positive"} />
          <MetricCard label="Credential Issues" value={providers.filter((p) => p.config === "Not configured").length} icon={KeyRound} tone="warning" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.id}
                className={cn("cursor-pointer transition hover:shadow-md", selected?.id === p.id && "ring-2 ring-primary")}
                onClick={() => setSelected(p)}
              >
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.type}</p>
                  </div>
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    p.status === "operational" ? "bg-emerald-500" : p.status === "degraded" ? "bg-amber-500" : "bg-rose-500",
                  )} />
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-medium tabular-nums">{p.latency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Error rate</span>
                    <span className={cn("font-medium tabular-nums", parseFloat(p.errorRate) > 1 ? "text-amber-600" : "")}>{p.errorRate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tenants</span>
                    <span className="font-medium tabular-nums">{p.tenantsUsing}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Fingerprint className="h-3 w-3" />
                      {p.credentialFingerprint}
                    </span>
                    <Badge variant="outline" className={cn(
                      "text-[9px]",
                      p.config === "Configured" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-amber-500/30 text-amber-700 dark:text-amber-400",
                    )}>{p.config}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected provider detail */}
        {selected && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold">{selected.name} — Provider Detail</span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Service type</p><p className="font-medium">{selected.type}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p><StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency</p><p className="font-medium tabular-nums">{selected.latency}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Error rate</p><p className="font-medium tabular-nums">{selected.errorRate}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tenants using</p><p className="font-medium tabular-nums">{selected.tenantsUsing}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last success</p><p className="font-medium">{selected.lastSuccess}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Credential fingerprint</p><p className="flex items-center gap-1 font-mono"><Fingerprint className="h-3 w-3" />{selected.credentialFingerprint}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last rotated</p><p className="flex items-center gap-1 font-medium"><Clock className="h-3 w-3" />{selected.lastRotated}</p></div>
              </div>
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-50/30 p-2 text-[11px] text-muted-foreground dark:bg-amber-950/10">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                API credentials are never displayed in the UI. Only the fingerprint ({selected.credentialFingerprint}) is shown.
                Rotate credentials via the secure vault.
              </div>
            </CardContent>
          </Card>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
