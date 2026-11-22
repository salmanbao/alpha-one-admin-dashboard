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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  listWebhooks,
  listDeliveries,
  createWebhook,
  sendTestEvent,
  pauseWebhook,
  resumeWebhook,
  retryWebhook,
  useWebhooksVersion,
} from "@/lib/platform/webhooks-store";
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
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the persisted
  // webhook store is authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 500 }), []);
  useWebhooksVersion();
  const webhooks = listWebhooks();
  const deliveries = listDeliveries();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState("");
  const [newTenant, setNewTenant] = useState("");

  const handleCreate = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const wh = createWebhook({
      name: newName.trim(),
      url: newUrl.trim(),
      events: newEvents.split(",").map((e) => e.trim()).filter(Boolean),
      tenant: newTenant.trim() || "Platform",
    });
    setNewName(""); setNewUrl(""); setNewEvents(""); setNewTenant("");
    setShowCreate(false);
    toast({ title: "Endpoint created", description: `"${wh.name}" is now registered and active.` });
  };

  const handleTest = (id: string) => {
    const d = sendTestEvent(id);
    if (!d) return;
    toast({
      title: d.status === "success" ? "Test delivered" : "Test failed",
      description: `Event dispatched — ${d.responseCode} in ${d.duration}ms.`,
      variant: d.status === "success" ? "default" : "destructive",
    });
  };

  const handlePause = (id: string) => {
    const wh = pauseWebhook(id);
    if (wh) toast({ title: "Endpoint paused", description: `${wh.name} — deliveries suspended.` });
  };

  const handleResume = (id: string) => {
    const wh = resumeWebhook(id);
    if (wh) toast({ title: "Endpoint resumed", description: `${wh.name} — deliveries restarted.` });
  };

  const handleRetry = (id: string) => {
    const wh = retryWebhook(id);
    if (wh) toast({ title: "Retry queued", description: `Re-drive for ${wh.name} dispatched.` });
  };

  const filtered = useMemo(() => {
    return webhooks.filter((wh) => {
      const matchesSearch =
        search === "" ||
        wh.name.toLowerCase().includes(search.toLowerCase()) ||
        wh.url.toLowerCase().includes(search.toLowerCase()) ||
        wh.tenant.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || wh.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [webhooks, search, statusFilter]);

  const stats = useMemo(() => ({
    total: webhooks.length,
    active: webhooks.filter((w) => w.status === "active").length,
    paused: webhooks.filter((w) => w.status === "paused").length,
    failing: webhooks.filter((w) => w.status === "failing").length,
    avgSuccess: webhooks.length
      ? (webhooks.reduce((s, w) => s + w.successRate, 0) / webhooks.length).toFixed(1)
      : "0.0",
    totalDeliveries: webhooks.reduce((s, w) => s + w.deliveries, 0),
  }), [webhooks]);

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
            <Button size="sm" onClick={() => setShowCreate(true)}>
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
          hasData={hydrated !== undefined}
          loadingLabel="Loading webhooks…"
        >
        {/* Create endpoint dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add webhook endpoint</DialogTitle>
              <DialogDescription>
                Register a new delivery endpoint. The secret is generated on create.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Alpha Capital — Order Events" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Endpoint URL</Label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://api.example.com/webhooks/orders" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Events (comma-separated)</Label>
                <Input value={newEvents} onChange={(e) => setNewEvents(e.target.value)} placeholder="order.created, order.filled" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tenant</Label>
                <Input value={newTenant} onChange={(e) => setNewTenant(e.target.value)} placeholder="Alpha Capital" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !newUrl.trim()}>Create endpoint</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => handleTest(wh.id)}>
                            <Play className="h-3 w-3" /> Test
                          </Button>
                          {wh.status === "active" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handlePause(wh.id)}>
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                          {wh.status === "paused" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handleResume(wh.id)}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          {wh.status === "failing" && (
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => handleRetry(wh.id)}>
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
                    {deliveries.map((dlv) => {
                      const wh = webhooks.find((w) => w.id === dlv.webhookId);
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
