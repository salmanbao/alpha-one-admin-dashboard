"use client";

/**
 * System Health page (M13 Admin Panel — "System Health").
 *
 * Tenant-scoped operational health: trading bridge servers, payment
 * gateways, KYC providers, notification delivery, and background job
 * queues. Each service exposes a health-drill action and incidents are
 * tracked in a bottom incident log.
 *
 * Layout:
 *  - PageHeader with "Run Health Drill" + "Refresh" actions
 *  - KPI row: Overall Status, 30d Uptime, Open Incidents, MTTR
 *  - Service cards grouped by category (status dot, uptime, latency,
 *    last checked, Drill + Log Incident actions)
 *  - Incident log DataTable (service, severity, started, duration,
 *    status, summary) with Resolve action
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  HeartPulse,
  Activity,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Timer,
  CheckCircle2,
  Wrench,
  Server,
  CreditCard,
  Shield,
  Mail,
  ListChecks,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type ServiceStatus = "operational" | "degraded" | "down" | "maintenance";
type ServiceCategory = "Trading" | "Payments" | "Verification" | "Messaging" | "Jobs";

interface ServiceHealth {
  id: string;
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  uptime30d: number;
  latencyMs: number;
  lastChecked: string;
  openIncidents: number;
  detail: string;
}

const DEMO_SERVICES: ServiceHealth[] = [
  { id: "svc-mt5", name: "MT5 Bridge (eu-1)", category: "Trading", status: "operational", uptime30d: 99.98, latencyMs: 42, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "14 servers · 8,412 concurrent sessions" },
  { id: "svc-dx", name: "DXtrade Bridge", category: "Trading", status: "degraded", uptime30d: 99.82, latencyMs: 310, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 1, detail: "Elevated order latency in eu-2 region" },
  { id: "svc-cgroup", name: "cTrader Bridge", category: "Trading", status: "operational", uptime30d: 99.96, latencyMs: 65, lastChecked: "2026-10-08T09:57:00Z", openIncidents: 0, detail: "3 servers · 1,204 concurrent sessions" },
  { id: "svc-stripe", name: "Stripe Gateway", category: "Payments", status: "operational", uptime30d: 99.99, latencyMs: 120, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "99.4% auth rate (24h)" },
  { id: "svc-paypal", name: "PayPal Gateway", category: "Payments", status: "operational", uptime30d: 99.97, latencyMs: 185, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "98.9% auth rate (24h)" },
  { id: "svc-crypto", name: "CoinPayments (Crypto)", category: "Payments", status: "maintenance", uptime30d: 99.5, latencyMs: 0, lastChecked: "2026-10-08T09:55:00Z", openIncidents: 0, detail: "Scheduled maintenance until 10:30 UTC" },
  { id: "svc-sumsub", name: "Sumsub KYC", category: "Verification", status: "operational", uptime30d: 99.95, latencyMs: 540, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "Median review 4m 12s" },
  { id: "svc-onfido", name: "Onfido KYC", category: "Verification", status: "degraded", uptime30d: 99.9, latencyMs: 820, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 1, detail: "Webhook delivery delays (~90s)" },
  { id: "svc-ses", name: "Email Delivery (SES)", category: "Messaging", status: "operational", uptime30d: 99.99, latencyMs: 95, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "0.08% bounce rate (24h)" },
  { id: "svc-twilio", name: "SMS (Twilio)", category: "Messaging", status: "operational", uptime30d: 99.96, latencyMs: 210, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "1,842 SMS delivered (24h)" },
  { id: "svc-eval", name: "Evaluation Engine Queue", category: "Jobs", status: "operational", uptime30d: 99.94, latencyMs: 75, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "Depth 128 · p95 wait 1.2s" },
  { id: "svc-payout-worker", name: "Payout Batch Worker", category: "Jobs", status: "operational", uptime30d: 99.91, latencyMs: 130, lastChecked: "2026-10-08T09:58:00Z", openIncidents: 0, detail: "Depth 42 · next batch 10:00 UTC" },
];

interface Incident {
  id: string;
  service: string;
  severity: "sev1" | "sev2" | "sev3";
  startedAt: string;
  durationMin: number;
  status: "investigating" | "identified" | "resolved";
  summary: string;
}

const DEMO_INCIDENTS: Incident[] = [
  { id: "inc-1041", service: "DXtrade Bridge", severity: "sev2", startedAt: "2026-10-08T08:42:00Z", durationMin: 76, status: "investigating", summary: "Order execution latency p95 > 900ms in eu-2; traffic shifted to eu-1." },
  { id: "inc-1040", service: "Onfido KYC", severity: "sev3", startedAt: "2026-10-08T07:15:00Z", durationMin: 163, status: "identified", summary: "Provider webhook deliveries delayed ~90s; reviews completing via polling fallback." },
  { id: "inc-1039", service: "Email Delivery (SES)", severity: "sev3", startedAt: "2026-10-07T22:04:00Z", durationMin: 22, status: "resolved", summary: "Bounce rate spike from a single blocklist; throttled and cleared." },
  { id: "inc-1038", service: "Stripe Gateway", severity: "sev2", startedAt: "2026-10-06T14:31:00Z", durationMin: 38, status: "resolved", summary: "Elevated 3DS challenge failures; provider-side incident, recovered automatically." },
  { id: "inc-1037", service: "MT5 Bridge (eu-1)", severity: "sev1", startedAt: "2026-10-04T03:12:00Z", durationMin: 51, status: "resolved", summary: "Session disconnect burst after failover; sticky sessions re-enabled." },
];

const CATEGORY_META: Record<ServiceCategory, { icon: typeof Server; color: string }> = {
  Trading: { icon: Server, color: "#4a7c59" },
  Payments: { icon: CreditCard, color: "#705c30" },
  Verification: { icon: Shield, color: "#6b6358" },
  Messaging: { icon: Mail, color: "#74796e" },
  Jobs: { icon: ListChecks, color: "#8a6d3b" },
};

const STATUS_TONES: Record<ServiceStatus, "success" | "warning" | "danger" | "info"> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
  maintenance: "info",
};

const STATUS_DOT: Record<ServiceStatus, string> = {
  operational: "#059669",
  degraded: "#d97706",
  down: "#e11d48",
  maintenance: "#0d9488",
};

const SEVERITY_TONES: Record<Incident["severity"], "danger" | "warning" | "info"> = {
  sev1: "danger",
  sev2: "warning",
  sev3: "info",
};

const INCIDENT_TONES: Record<Incident["status"], "danger" | "warning" | "success"> = {
  investigating: "danger",
  identified: "warning",
  resolved: "success",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SystemHealthPage() {
  const [services, setServices] = useState<ServiceHealth[]>(DEMO_SERVICES);
  const [incidents, setIncidents] = useState<Incident[]>(DEMO_INCIDENTS);
  const [refreshing, setRefreshing] = useState(false);
  const [drilling, setDrilling] = useState<string | null>(null);

  const stats = useMemo(() => {
    const down = services.filter((s) => s.status === "down").length;
    const degraded = services.filter((s) => s.status === "degraded").length;
    const avgUptime = services.reduce((sum, s) => sum + s.uptime30d, 0) / services.length;
    const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
    const resolved = incidents.filter((i) => i.status === "resolved");
    const mttr = resolved.length
      ? Math.round(resolved.reduce((sum, i) => sum + i.durationMin, 0) / resolved.length)
      : 0;
    const overall: ServiceStatus = down > 0 ? "down" : degraded > 0 ? "degraded" : "operational";
    return { down, degraded, avgUptime, openIncidents, mttr, overall };
  }, [services, incidents]);

  const refresh = () => {
    setRefreshing(true);
    const now = new Date().toISOString();
    setServices((prev) => prev.map((s) => ({ ...s, lastChecked: now })));
    window.setTimeout(() => setRefreshing(false), 600);
    toast({ title: "Health checks refreshed", description: `${services.length} services re-probed just now.` });
  };

  const runDrill = (svc: ServiceHealth) => {
    setDrilling(svc.id);
    window.setTimeout(() => {
      setDrilling(null);
      toast({
        title: "Health drill completed",
        description: `${svc.name}: probe OK — failover path verified, no action required.`,
      });
    }, 900);
  };

  const runFullDrill = () => {
    toast({
      title: "Full health drill queued",
      description: "Probing all services incl. failover paths. Results will appear in the incident log.",
    });
    setIncidents((prev) => [
      {
        id: `inc-${1042 + prev.length}`,
        service: "Platform-wide drill",
        severity: "sev3",
        startedAt: new Date().toISOString(),
        durationMin: 0,
        status: "investigating",
        summary: "Scheduled full health drill started from System Health page.",
      },
      ...prev,
    ]);
  };

  const logIncident = (svc: ServiceHealth) => {
    setIncidents((prev) => [
      {
        id: `inc-${1042 + prev.length}`,
        service: svc.name,
        severity: "sev3",
        startedAt: new Date().toISOString(),
        durationMin: 0,
        status: "investigating",
        summary: `Manually logged incident for ${svc.name} from the health dashboard.`,
      },
      ...prev,
    ]);
    toast({ title: "Incident logged", description: `${svc.name} added to the incident log. On-call notified.` });
  };

  const resolveIncident = (inc: Incident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === inc.id ? { ...i, status: "resolved", durationMin: i.durationMin || 5 } : i)),
    );
    toast({ title: "Incident resolved", description: `${inc.id} marked resolved. Post-mortem task created.` });
  };

  const incidentColumns: Column<Incident>[] = [
    {
      key: "id",
      header: "Incident",
      cell: (row) => (
        <div>
          <p className="text-sm font-mono font-semibold">{row.id}</p>
          <p className="text-xs text-muted-foreground">{row.service}</p>
        </div>
      ),
      sortValue: (row) => row.id,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (row) => <StatusBadge tone={SEVERITY_TONES[row.severity]}>{row.severity.toUpperCase()}</StatusBadge>,
      sortValue: (row) => row.severity,
    },
    {
      key: "summary",
      header: "Summary",
      cell: (row) => <p className="max-w-[380px] text-xs text-muted-foreground">{row.summary}</p>,
    },
    {
      key: "started",
      header: "Started",
      cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.startedAt).toLocaleString()}</span>,
      sortValue: (row) => row.startedAt,
    },
    {
      key: "duration",
      header: "Duration",
      cell: (row) => (
        <span className="text-sm">
          {row.durationMin}
          <span className="text-muted-foreground"> min</span>
        </span>
      ),
      numeric: true,
      sortValue: (row) => row.durationMin,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={INCIDENT_TONES[row.status]}>{row.status}</StatusBadge>,
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) =>
        row.status !== "resolved" ? (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => resolveIncident(row)}>
            <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">Closed</span>
        ),
    },
  ];

  const categories = Object.keys(CATEGORY_META) as ServiceCategory[];

  return (
    <Page>
      <PageHeader
        title="System Health"
        description="Live operational status of trading bridges, gateways, providers, and job queues."
        icon={HeartPulse}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button size="sm" onClick={runFullDrill}>
              <Wrench className="mr-1 h-4 w-4" /> Run Health Drill
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Overall Status"
            value={stats.overall === "operational" ? "Operational" : stats.overall === "down" ? "Outage" : "Degraded"}
            icon={HeartPulse}
            tone={stats.overall === "operational" ? "positive" : stats.overall === "down" ? "negative" : "warning"}
          />
          <MetricCard label="30d Avg Uptime" value={`${stats.avgUptime.toFixed(2)}%`} icon={Activity} tone={stats.avgUptime >= 99.9 ? "positive" : "warning"} />
          <MetricCard label="Open Incidents" value={stats.openIncidents} icon={AlertTriangle} tone={stats.openIncidents > 0 ? "warning" : "positive"} />
          <MetricCard label="MTTR (resolved)" value={`${stats.mttr} min`} icon={Timer} tone="info" />
        </div>

        {/* Service cards by category */}
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const list = services.filter((s) => s.category === cat);
          if (list.length === 0) return null;
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded" style={{ background: `${meta.color}20`, color: meta.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="text-base font-semibold">{cat}</h2>
                  <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                    {list.length} service{list.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((svc) => (
                  <div key={svc.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: STATUS_DOT[svc.status] }}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-medium">{svc.name}</p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{svc.detail}</p>
                      </div>
                      <StatusBadge tone={STATUS_TONES[svc.status]}>{svc.status}</StatusBadge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                      <div className="rounded bg-background/60 px-1.5 py-1">
                        <p className="text-muted-foreground">Uptime 30d</p>
                        <p className="font-semibold">{svc.uptime30d}%</p>
                      </div>
                      <div className="rounded bg-background/60 px-1.5 py-1">
                        <p className="text-muted-foreground">Latency</p>
                        <p className="font-semibold">{svc.latencyMs > 0 ? `${svc.latencyMs}ms` : "—"}</p>
                      </div>
                      <div className="rounded bg-background/60 px-1.5 py-1">
                        <p className="text-muted-foreground">Checked</p>
                        <p className="font-semibold">
                          {new Date(svc.lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-[10px]"
                        disabled={drilling === svc.id}
                        onClick={() => runDrill(svc)}
                      >
                        <Wrench className={drilling === svc.id ? "mr-1 h-3 w-3 animate-spin" : "mr-1 h-3 w-3"} />
                        {drilling === svc.id ? "Drilling…" : "Drill"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => logIncident(svc)}>
                        Log Incident
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Incident log */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Incident Log</h2>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" /> {incidents.filter((i) => i.status === "resolved").length} resolved
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> rolling 30 days
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={incidentColumns}
              data={incidents}
              rowKey={(row) => row.id}
              searchableText={(row) => `${row.id} ${row.service} ${row.summary} ${row.status}`}
              searchPlaceholder="Search incidents…"
              pageSize={6}
              emptyTitle="No incidents"
              emptyDescription="All services have been healthy for the last 30 days."
            />
            <Separator />
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Health probes run every 60 seconds. Sev1 incidents page the on-call rotation immediately; all state changes are
              written to the audit log.
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
