"use client";

/**
 * Webhooks Page — Webhook endpoint registry (M13 Settings / M23).
 *
 * Stitch screen: (new)
 * Tier 1 — Endpoint registry, event subscriptions, test/retry/pause, delivery log.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Webhook,
  Search,
  Plus,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  ExternalLink,
  Copy,
  Send,
} from "lucide-react";

const demoWebhooks = [
  { id: "wh-001", name: "Alpha Capital — Order Events", url: "https://api.alphacapital.com/webhooks/orders", events: ["order.created", "order.filled", "order.cancelled"], status: "active", secret: "whsec_a1b2…", lastDelivery: "2026-10-08T14:25:00Z", successRate: 99.8, deliveries: 12540, tenant: "Alpha Capital" },
  { id: "wh-002", name: "Alpha Capital — Balance Updates", url: "https://api.alphacapital.com/webhooks/balances", events: ["balance.updated", "balance.threshold"], status: "active", secret: "whsec_c3d4…", lastDelivery: "2026-10-08T14:30:00Z", successRate: 100.0, deliveries: 8420, tenant: "Alpha Capital" },
  { id: "wh-003", name: "Beta Trading — Trade Notifications", url: "https://hooks.betatrading.io/pfaas/trades", events: ["trade.executed", "trade.rejected"], status: "active", secret: "whsec_e5f6…", lastDelivery: "2026-10-08T13:45:00Z", successRate: 98.5, deliveries: 5620, tenant: "Beta Trading" },
  { id: "wh-004", name: "Gamma Futures — Risk Alerts", url: "https://gammafutures.com/api/pfaas/risk", events: ["risk.breach", "risk.warning"], status: "paused", secret: "whsec_g7h8…", lastDelivery: "2026-10-07T16:00:00Z", successRate: 87.2, deliveries: 2340, tenant: "Gamma Futures" },
  { id: "wh-005", name: "Legacy CRM Sync", url: "https://old-crm.internal/hooks/sync", events: ["user.created", "user.updated"], status: "failing", secret: "whsec_i9j0…", lastDelivery: "2026-10-05T09:30:00Z", successRate: 45.0, deliveries: 890, tenant: "Alpha Capital" },
  { id: "wh-006", name: "Beta Trading — Billing Events", url: "https://billing.betatrading.io/webhooks", events: ["invoice.paid", "payment.failed"], status: "active", secret: "whsec_k1l2…", lastDelivery: "2026-10-08T12:00:00Z", successRate: 99.9, deliveries: 1850, tenant: "Beta Trading" },
];

const demoDeliveries = [
  { id: "dlv-001", webhookId: "wh-001", event: "order.filled", status: "success", responseCode: 200, duration: 142, timestamp: "2026-10-08T14:25:00Z", attempt: 1 },
  { id: "dlv-002", webhookId: "wh-003", event: "trade.executed", status: "success", responseCode: 200, duration: 189, timestamp: "2026-10-08T13:45:00Z", attempt: 1 },
  { id: "dlv-003", webhookId: "wh-005", event: "user.updated", status: "failed", responseCode: 500, duration: 4200, timestamp: "2026-10-08T13:30:00Z", attempt: 3 },
  { id: "dlv-004", webhookId: "wh-002", event: "balance.updated", status: "success", responseCode: 200, duration: 98, timestamp: "2026-10-08T14:30:00Z", attempt: 1 },
  { id: "dlv-005", webhookId: "wh-004", event: "risk.warning", status: "failed", responseCode: 503, duration: 2800, timestamp: "2026-10-07T16:00:00Z", attempt: 2 },
];

const eventColors: Record<string, string> = {
  "order.created": "#4a7c59",
  "order.filled": "#705c30",
  "order.cancelled": "#b83230",
  "balance.updated": "#6b6358",
  "balance.threshold": "#74796e",
  "trade.executed": "#4a7c59",
  "trade.rejected": "#b83230",
  "risk.breach": "#b83230",
  "risk.warning": "#705c30",
  "user.created": "#4a7c59",
  "user.updated": "#6b6358",
  "invoice.paid": "#4a7c59",
  "payment.failed": "#b83230",
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  paused: "warning",
  failing: "danger",
  success: "success",
  failed: "danger",
  retrying: "info",
};

export function WebhooksPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ webhooks: demoWebhooks, deliveries: demoDeliveries }), { delayMs: 500 }), []);
  const data = loadedData ?? { webhooks: [], deliveries: [] };
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDeliveries, setShowDeliveries] = useState(false);

  const filtered = useMemo(() => {
    return data.webhooks.filter((wh) => {
      const matchesSearch =
        search === "" ||
        wh.name.toLowerCase().includes(search.toLowerCase()) ||
        wh.url.toLowerCase().includes(search.toLowerCase()) ||
        wh.tenant.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || wh.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.webhooks, search, statusFilter]);

  const stats = useMemo(() => ({
    total: data.webhooks.length,
    active: data.webhooks.filter((w) => w.status === "active").length,
    paused: data.webhooks.filter((w) => w.status === "paused").length,
    failing: data.webhooks.filter((w) => w.status === "failing").length,
    avgSuccess: (data.webhooks.reduce((s, w) => s + w.successRate, 0) / data.webhooks.length).toFixed(1),
    totalDeliveries: data.webhooks.reduce((s, w) => s + w.deliveries, 0),
  }), [data.webhooks]);

  return (
    <Page>
      <PageHeader
        title="Webhooks"
        description="Webhook endpoint registry and delivery monitoring."
        icon={Webhook}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowDeliveries(!showDeliveries)}>
              <Activity className="mr-1 h-4 w-4" /> {showDeliveries ? "Hide" : "Show"} Delivery Log
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("integrations")}>
              <ExternalLink className="mr-1 h-4 w-4" /> Integrations
            </Button>
            <Button size="sm" onClick={() => toast({ title: "Create webhook", description: "Add endpoint form: URL, events, secret, tenant." })}>
              <Plus className="mr-1 h-4 w-4" /> Add Endpoint
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading webhooks…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Endpoints" value={stats.total} icon={Webhook} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Failing" value={stats.failing} icon={AlertTriangle} tone={stats.failing > 0 ? "negative" : "positive"} />
          <MetricCard label="Avg Success Rate" value={`${stats.avgSuccess}%`} icon={Activity} tone={parseFloat(stats.avgSuccess) > 95 ? "positive" : "warning"} />
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, URL, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
            <Button size="sm" variant={statusFilter === "active" ? "default" : "outline"} onClick={() => setStatusFilter("active")} className="text-[10px]">Active</Button>
            <Button size="sm" variant={statusFilter === "paused" ? "default" : "outline"} onClick={() => setStatusFilter("paused")} className="text-[10px]">Paused</Button>
            <Button size="sm" variant={statusFilter === "failing" ? "default" : "outline"} onClick={() => setStatusFilter("failing")} className="text-[10px]">Failing</Button>
          </div>
        </div>

        {/* Webhook endpoints table */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Endpoints</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Events</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deliveries</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Delivery</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((wh) => (
                    <tr key={wh.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{wh.name}</p>
                          <p className="text-xs text-muted-foreground">{wh.tenant}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{wh.url}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {wh.events.slice(0, 2).map((evt) => (
                            <Badge key={evt} variant="outline" className="text-[9px]" style={{ borderColor: eventColors[evt] || "#6b6358", color: eventColors[evt] || "#6b6358" }}>
                              {evt}
                            </Badge>
                          ))}
                          {wh.events.length > 2 && (
                            <Badge variant="secondary" className="text-[9px]">+{wh.events.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: wh.successRate > 95 ? "#4a7c59" : wh.successRate > 70 ? "#705c30" : "#b83230", color: wh.successRate > 95 ? "#4a7c59" : wh.successRate > 70 ? "#705c30" : "#b83230" }}>
                          {wh.successRate}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{wh.deliveries.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(wh.lastDelivery).toLocaleDateString()} {new Date(wh.lastDelivery).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTones[wh.status]}>{wh.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Test sent", description: `Test event dispatched to ${wh.name}.` })}>
                            <Play className="h-3 w-3" /> Test
                          </Button>
                          {wh.status === "active" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Endpoint paused", description: `${wh.name} paused. Deliveries suspended.` })}>
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                          {wh.status === "paused" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Endpoint resumed", description: `${wh.name} resumed. Deliveries restarted.` })}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          {wh.status === "failing" && (
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Retry queued", description: `Retry deliveries for ${wh.name} queued.` })}>
                              <RefreshCw className="h-3 w-3" /> Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center p-8 text-center">
                  <Webhook className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 font-medium">No webhooks found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery log */}
        {showDeliveries && (
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Recent Deliveries</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endpoint</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attempt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.deliveries.map((dlv) => {
                      const wh = data.webhooks.find((w) => w.id === dlv.webhookId);
                      return (
                        <tr key={dlv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: eventColors[dlv.event] || "#6b6358", color: eventColors[dlv.event] || "#6b6358" }}>
                              {dlv.event}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{wh?.name ?? dlv.webhookId}</td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={statusTones[dlv.status]}>{dlv.status}</StatusBadge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="font-mono text-[10px]" style={{ borderColor: dlv.responseCode === 200 ? "#4a7c59" : "#b83230", color: dlv.responseCode === 200 ? "#4a7c59" : "#b83230" }}>
                              {dlv.responseCode}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{dlv.duration}ms</td>
                          <td className="px-4 py-3 text-sm">{dlv.attempt}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(dlv.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
