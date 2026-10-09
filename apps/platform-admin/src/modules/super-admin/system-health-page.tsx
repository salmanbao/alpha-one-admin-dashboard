"use client";

/**
 * System Health Page — Platform infrastructure monitoring.
 *
 * Stitch screen: system_health
 * Tier 1 — Real-time system health, service status, and incident monitoring.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Globe,
  Database,
  Zap,
  DollarSign,
  ShieldCheck,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  HardDrive,
  Cloud,
  Percent,
  Thermometer,
  Network,
} from "lucide-react";

// Demo services
const services = [
  { id: "api-gateway", name: "API Gateway", status: "operational", latency: "42ms", uptime: 99.97, region: "us-east-1", icon: Globe },
  { id: "database", name: "Primary Database", status: "operational", latency: "8ms", uptime: 99.99, region: "us-east-1", icon: Database },
  { id: "database-replica", name: "Database Replica (NY4)", status: "operational", latency: "12ms", uptime: 99.99, region: "ny4", icon: Database },
  { id: "mt5-bridge", name: "MT5 Bridge", status: "operational", latency: "120ms", uptime: 99.95, region: "eu-west-1", icon: Zap },
  { id: "ctrader-gateway", name: "cTrader Gateway", status: "degraded", latency: "850ms", uptime: 99.85, region: "us-east-2", icon: Zap },
  { id: "payment-processor", name: "Payment Processor", status: "degraded", latency: "850ms", uptime: 99.90, region: "us-east-1", icon: DollarSign },
  { id: "kyc-provider", name: "KYC Provider", status: "operational", latency: "310ms", uptime: 99.92, region: "eu-central-1", icon: ShieldCheck },
  { id: "ai-engine", name: "AI Engine", status: "operational", latency: "1.2s", uptime: 99.88, region: "us-east-1", icon: Cpu },
  { id: "email-svc", name: "Email Service", status: "operational", latency: "250ms", uptime: 99.95, region: "us-east-1", icon: Activity },
  { id: "cache", name: "Redis Cache", status: "operational", latency: "2ms", uptime: 99.99, region: "us-east-1", icon: HardDrive },
  { id: "queue", name: "Message Queue", status: "operational", latency: "5ms", uptime: 99.98, region: "us-east-1", icon: Network },
  { id: "cdn", name: "CDN / Edge", status: "operational", latency: "15ms", uptime: 99.99, region: "global", icon: Cloud },
];

const statusTones: Record<string, "success" | "warning" | "danger" | "info"> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
  maintenance: "info",
};

export function SystemHealthPage() {
  const { navigate } = usePlatform();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return services;
    return services.filter((s) => s.status === statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => ({
    operational: services.filter((s) => s.status === "operational").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    down: services.filter((s) => s.status === "down").length,
    avgLatency: services.reduce((s, svc) => s + parseInt(svc.latency), 0) / services.length,
    avgUptime: services.reduce((s, svc) => s + svc.uptime, 0) / services.length,
    totalIncidents: 3,
    activeIncidents: 1,
  }), []);

  return (
    <Page>
      <PageHeader
        title="System Health"
        description="Platform service status, latency metrics, and incident monitoring."
        icon={Server}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Activity className="mr-1 h-4 w-4" /> Live Monitor
            </Button>
            <Button variant="outline" size="sm">
              <Clock className="mr-1 h-4 w-4" /> Incident History
            </Button>
          </>
        }
      />
      <PageContent>
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
          <MetricCard label="Overall Uptime (30d)" value={`${stats.avgUptime.toFixed(2)}%`} delta={0.02} icon={Percent} tone="positive" />
          <MetricCard label="Avg Latency" value={`${Math.round(stats.avgLatency)}ms`} icon={Zap} />
          <MetricCard label="Active Incidents" value={stats.activeIncidents} delta={-2} icon={AlertTriangle} tone="warning" />
          <MetricCard label="Services Monitored" value={services.length} icon={Server} />
        </div>

        {/* Incident banner */}
        {stats.activeIncidents > 0 && (
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Degraded Performance — cTrader Gateway &amp; Payment Processor</p>
                  <p className="text-sm mt-0.5 text-amber-800 dark:text-amber-200">
                    Elevated latency detected on US-EAST-02 nodes. Failover routes being activated.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                View Details
              </Button>
            </div>
          </div>
        )}

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
                const Icon = svc.icon;
                return (
                  <div
                    key={svc.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      svc.status === "degraded"
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
                        <Zap className="h-3 w-3" /> {svc.latency}
                      </span>
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" /> {svc.uptime}%
                      </span>
                    </div>
                    {/* Uptime bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          svc.uptime >= 99.9
                            ? "bg-emerald-500"
                            : svc.uptime >= 99.5
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(svc.uptime, 100)}%` }}
                      />
                    </div>
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

        {/* Infrastructure zones */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Region Health</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { region: "us-east-1 (Virginia)", services: 5, healthy: 5, latency: "23ms avg" },
                  { region: "us-east-2 (Ohio)", services: 2, healthy: 1, latency: "45ms avg" },
                  { region: "eu-west-1 (Ireland)", services: 2, healthy: 2, latency: "18ms avg" },
                  { region: "eu-central-1 (Frankfurt)", services: 1, healthy: 1, latency: "32ms avg" },
                  { region: "ny4 (New York)", services: 1, healthy: 1, latency: "12ms avg" },
                  { region: "Global Edge", services: 1, healthy: 1, latency: "15ms avg" },
                ].map((r) => (
                  <div
                    key={r.region}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.region}</p>
                      <p className="text-xs text-muted-foreground">{r.services} services · {r.latency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs">{r.healthy}/{r.services}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          r.healthy === r.services ? "text-emerald-600 border-emerald-500/30" : "text-amber-600 border-amber-500/30"
                        }`}
                      >
                        {r.healthy === r.services ? "Healthy" : "Degraded"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Resource Utilization</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "CPU Usage", value: 42, unit: "%", icon: Cpu, color: "var(--brand-primary)" },
                  { label: "Memory", value: 68, unit: "%", icon: HardDrive, color: "var(--brand-tertiary)" },
                  { label: "Disk I/O", value: 23, unit: "%", icon: Activity, color: "var(--brand-secondary)" },
                  { label: "Network Throughput", value: 56, unit: "Gbps", icon: Network, color: "#74796e" },
                  { label: "Connection Pool", value: 78, unit: "%", icon: Wifi, color: "#705c30" },
                  { label: "Queue Depth", value: 12, unit: "k msg", icon: Zap, color: "#4a4e4a" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="font-mono font-semibold">{item.value}{item.unit}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.value}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
