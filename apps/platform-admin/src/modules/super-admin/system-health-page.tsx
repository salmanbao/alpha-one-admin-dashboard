"use client";

/**
 * System Health — research item #4.
 *
 * Renders the one shared service catalog from
 * `lib/platform/operations-signals.ts` (Operations Home renders the
 * aggregated summary of the same catalog). The page keeps its status
 * filter chip row and shows per-service latency / uptime / region.
 *
 * The `?service=<id>` query param (set by deep links from Operations
 * Home attention items) pre-selects a service tile — the tile is
 * highlighted on arrival.
 */

import { useMemo, useState, useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { PLATFORM_SERVICES, type PlatformService, serviceIcon, statusTones } from "@/lib/platform/operations-signals";
import { readIncidents, effectiveSeverity } from "@/lib/platform/incident-center-store";
import {
  Globe,
  Server,
  Database,
  Zap,
  ShieldCheck,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  HardDrive,
  Network,
  Cloud,
  RefreshCw,
} from "lucide-react";

export function SystemHealthPage() {
  const { navigate, router } = usePlatform();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [highlightService, setHighlightService] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  // Deep-link target from Operations Home attention items:
  //   `?service=<id>` (e.g. ?service=mt5-bridge).
  useEffect(() => {
    const id = router.params.service;
    if (id) {
      setHighlightService(id);
      setStatusFilter("all");
    }
  }, [router.params.service]);

  // Sync status filter with URL state
  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }
    navigate("system-health", params, { replace: true });
  }, [statusFilter, navigate]);

  // Read URL params on mount
  useEffect(() => {
    const params = router.params;
    if (params.status) {
      setStatusFilter(params.status);
    }
  }, [router.params]);

  // Escape key closes detail sheet
  useEscapeKey(selectedService !== null, () => setSelectedService(null));

  // Async seam (frontend-first): service status resolves via the mock layer.
  const {
    data: loadedServices,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => PLATFORM_SERVICES, { delayMs: 400 }), []);
  const services = loadedServices ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === "all") return services;
    return services.filter((s) => s.status === statusFilter);
  }, [services, statusFilter]);

  const stats = useMemo(() => {
    const totalLatency = services.reduce((s, svc) => s + (svc.latencyMs ?? 0), 0);
    const totalUptime = services.reduce((s, svc) => s + (svc.uptimePct ?? 0), 0);
    const totalCount = services.filter((s) => s.latencyMs !== null).length;
    return {
      operational: services.filter((s) => s.status === "operational").length,
      degraded: services.filter((s) => s.status === "degraded").length,
      down: services.filter((s) => s.status === "down").length,
      avgLatency: totalCount > 0 ? totalLatency / totalCount : 0,
      avgUptime: totalCount > 0 ? totalUptime / totalCount : 0,
    };
  }, [services]);

  return (
    <Page>
      <PageHeader
        title="System Health"
        description="Platform service status, latency metrics, and incident monitoring."
        icon={Server}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("bridge-sync-log")}>
              <Activity className="mr-1 h-4 w-4" /> Bridge sync
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('incident-center')}>
              <Clock className="mr-1 h-4 w-4" /> Incident History
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedServices !== undefined}
          loadingLabel="Loading system health…"
        >
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="bg-emerald-600 text-white">
            <CheckCircle2 className="mr-1 h-3 w-3" /> {stats.operational} Operational
          </Badge>
          {stats.degraded > 0 && (
            <Badge variant="default" className="bg-amber-500 text-white">
              <AlertTriangle className="mr-1 h-3 w-3" /> {stats.degraded} Degraded
            </Badge>
          )}
          {stats.down > 0 && (
            <Badge variant="default" className="bg-rose-600 text-white">
              <AlertTriangle className="mr-1 h-3 w-3" /> {stats.down} Down
            </Badge>
          )}
          <Badge variant="outline" className="text-muted-foreground">
            Avg Latency: {Math.round(stats.avgLatency)}ms
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            Avg Uptime: {stats.avgUptime.toFixed(2)}%
          </Badge>
        </div>

        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Avg Uptime (snapshot)" value={`${stats.avgUptime.toFixed(2)}%`} delta={0} icon={Server} tone="positive" />
          <MetricCard label="Avg Latency" value={`${Math.round(stats.avgLatency)}ms`} icon={Zap} />
          <MetricCard label="Active Incidents" value={readIncidents().filter((i) => effectiveSeverity(i, {}) !== "resolved").length} delta={0} icon={AlertTriangle} tone="warning" />
          <MetricCard label="Services Monitored" value={services.length} icon={Server} />
        </div>

        {/* Service status grid */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Service Status</h2>
              <div className="flex items-center gap-2">
                {["all", "operational", "degraded", "down"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    onClick={() => setStatusFilter(s)}
                    className="text-[10px] capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((svc) => {
                const Icon = serviceIcon[svc.id] ?? Server;
                return (
                  <div
                    key={svc.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      highlightService === svc.id
                        ? "ring-2 ring-blue-500 ring-offset-1"
                        : svc.status === "degraded"
                          ? "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10"
                          : svc.status === "operational"
                            ? "border-border bg-card"
                            : "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/10"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`rounded-md p-2 ${
                          svc.status === "operational"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : svc.status === "degraded"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <StatusBadge tone={statusTones[svc.status]}>{svc.status}</StatusBadge>
                    </div>
                    <div className="mt-3">
                      <p className="font-medium text-sm">{svc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{svc.region}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" /> {svc.latencyMs !== null ? `${svc.latencyMs}ms` : "—"}
                      </span>
                      {svc.uptimePct !== undefined ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {svc.uptimePct}%
                        </span>
                      ) : null}
                    </div>
                    {/* Uptime bar */}
                    {svc.uptimePct !== undefined ? (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            svc.uptimePct >= 99.9
                              ? "bg-emerald-500"
                              : svc.uptimePct >= 99.5
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(svc.uptimePct, 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center p-8 text-center">
                <Server className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="mt-2 font-medium">No services match filter</p>
              </div>
            )}
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}