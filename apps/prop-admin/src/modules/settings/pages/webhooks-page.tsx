"use client";

/**
 * Webhooks & Events page (M6 Event Bus — Admin Controls).
 *
 * Tenant-level webhook subscriptions: endpoint CRUD (URL, event set,
 * signing secret), delivery logs with retry/redeliver, and test sends.
 * Complements the checkout-scoped webhook log (checkout-webhook-log).
 *
 * Layout:
 *  - PageHeader with "Add Endpoint" primary action
 *  - KPI row: Endpoints, Deliveries 24h, Success Rate, Failing
 *  - Endpoint cards: URL, subscribed event chips, success rate bar,
 *    secret (masked + reveal + rotate), Test/Pause/Edit/Delete actions
 *  - Create/Edit endpoint Dialog (URL, description, event toggle chips)
 *  - Delivery log DataTable (event, endpoint, status code, duration,
 *    timestamp) with Retry on failures + "Redeliver last" toolbar
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Webhook,
  Plus,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Trash2,
  Pause,
  Play,
  Terminal,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type EndpointStatus = "active" | "paused" | "failing";

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  status: EndpointStatus;
  successRate: number;
  lastDelivery: string | null;
  secret: string;
}

interface Delivery {
  id: string;
  event: string;
  endpointId: string;
  endpointUrl: string;
  statusCode: number;
  durationMs: number;
  deliveredAt: string;
  ok: boolean;
  attempt: number;
}

const EVENT_TYPES = [
  "challenge.passed",
  "challenge.failed",
  "account.provisioned",
  "account.breach",
  "payout.processed",
  "payout.failed",
  "kyc.approved",
  "kyc.rejected",
  "order.executed",
  "subscription.renewed",
] as const;

const DEMO_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: "wh-001",
    url: "https://api.yourfirm.com/hooks/challenges",
    description: "Challenge lifecycle → trader CRM sync",
    events: ["challenge.passed", "challenge.failed", "account.provisioned"],
    status: "active",
    successRate: 99.8,
    lastDelivery: "2026-10-08T09:41:00Z",
    secret: "whsec_9f2a7c41d8b34e6f",
  },
  {
    id: "wh-002",
    url: "https://api.yourfirm.com/hooks/payouts",
    description: "Payout results → finance ledger",
    events: ["payout.processed", "payout.failed"],
    status: "active",
    successRate: 100,
    lastDelivery: "2026-10-08T08:12:00Z",
    secret: "whsec_4b8e1d72a9c05f31",
  },
  {
    id: "wh-003",
    url: "https://hooks.slack.com/services/T0/B0/xxxx",
    description: "Risk alerts → #risk-ops channel",
    events: ["account.breach", "kyc.rejected"],
    status: "active",
    successRate: 99.1,
    lastDelivery: "2026-10-08T07:55:00Z",
    secret: "whsec_e5c3f8a06b2d9147",
  },
  {
    id: "wh-004",
    url: "https://legacy-crm.example.com/webhook",
    description: "Legacy CRM — being deprecated",
    events: ["subscription.renewed"],
    status: "failing",
    successRate: 41.2,
    lastDelivery: "2026-10-07T18:03:00Z",
    secret: "whsec_1a7d90e4c6b82f53",
  },
  {
    id: "wh-005",
    url: "https://staging.yourfirm.com/hooks/orders",
    description: "Staging environment order mirror",
    events: ["order.executed"],
    status: "paused",
    successRate: 97.5,
    lastDelivery: "2026-10-05T11:20:00Z",
    secret: "whsec_7c6b2f10e9a4d385",
  },
];

const DEMO_DELIVERIES: Delivery[] = [
  { id: "dlv-501", event: "challenge.passed", endpointId: "wh-001", endpointUrl: "https://api.yourfirm.com/hooks/challenges", statusCode: 200, durationMs: 142, deliveredAt: "2026-10-08T09:41:00Z", ok: true, attempt: 1 },
  { id: "dlv-500", event: "payout.processed", endpointId: "wh-002", endpointUrl: "https://api.yourfirm.com/hooks/payouts", statusCode: 200, durationMs: 98, deliveredAt: "2026-10-08T08:12:00Z", ok: true, attempt: 1 },
  { id: "dlv-499", event: "account.breach", endpointId: "wh-003", endpointUrl: "https://hooks.slack.com/services/T0/B0/xxxx", statusCode: 200, durationMs: 220, deliveredAt: "2026-10-08T07:55:00Z", ok: true, attempt: 1 },
  { id: "dlv-498", event: "subscription.renewed", endpointId: "wh-004", endpointUrl: "https://legacy-crm.example.com/webhook", statusCode: 502, durationMs: 3000, deliveredAt: "2026-10-07T18:03:00Z", ok: false, attempt: 4 },
  { id: "dlv-497", event: "subscription.renewed", endpointId: "wh-004", endpointUrl: "https://legacy-crm.example.com/webhook", statusCode: 504, durationMs: 5000, deliveredAt: "2026-10-07T17:58:00Z", ok: false, attempt: 3 },
  { id: "dlv-496", event: "challenge.failed", endpointId: "wh-001", endpointUrl: "https://api.yourfirm.com/hooks/challenges", statusCode: 200, durationMs: 165, deliveredAt: "2026-10-07T16:44:00Z", ok: true, attempt: 1 },
  { id: "dlv-495", event: "order.executed", endpointId: "wh-005", endpointUrl: "https://staging.yourfirm.com/hooks/orders", statusCode: 200, durationMs: 190, deliveredAt: "2026-10-05T11:20:00Z", ok: true, attempt: 1 },
  { id: "dlv-494", event: "kyc.rejected", endpointId: "wh-003", endpointUrl: "https://hooks.slack.com/services/T0/B0/xxxx", statusCode: 429, durationMs: 55, deliveredAt: "2026-10-05T09:31:00Z", ok: false, attempt: 2 },
  { id: "dlv-493", event: "account.provisioned", endpointId: "wh-001", endpointUrl: "https://api.yourfirm.com/hooks/challenges", statusCode: 200, durationMs: 121, deliveredAt: "2026-10-04T20:15:00Z", ok: true, attempt: 1 },
  { id: "dlv-492", event: "payout.failed", endpointId: "wh-002", endpointUrl: "https://api.yourfirm.com/hooks/payouts", statusCode: 200, durationMs: 87, deliveredAt: "2026-10-04T14:02:00Z", ok: true, attempt: 1 },
];

const STATUS_TONES: Record<EndpointStatus, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  failing: "danger",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(DEMO_ENDPOINTS);
  const [deliveries, setDeliveries] = useState<Delivery[]>(DEMO_DELIVERIES);
  const [revealed, setRevealed] = useState<string | null>(null);

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);

  const stats = useMemo(() => {
    const active = endpoints.filter((e) => e.status === "active").length;
    const failing = endpoints.filter((e) => e.status === "failing").length;
    const last24 = deliveries.filter(
      (d) => Date.now() - new Date(d.deliveredAt).getTime() < 1000 * 60 * 60 * 48,
    ).length;
    const ok = deliveries.filter((d) => d.ok).length;
    const successRate = deliveries.length ? (ok / deliveries.length) * 100 : 100;
    return { active, failing, total: endpoints.length, last24, successRate };
  }, [endpoints, deliveries]);

  const openCreate = () => {
    setEditingId(null);
    setFormUrl("");
    setFormDesc("");
    setFormEvents([]);
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (ep: WebhookEndpoint) => {
    setEditingId(ep.id);
    setFormUrl(ep.url);
    setFormDesc(ep.description);
    setFormEvents([...ep.events]);
    setFormActive(ep.status !== "paused");
    setDialogOpen(true);
  };

  const toggleEvent = (ev: string) => {
    setFormEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const saveEndpoint = () => {
    if (!formUrl.trim()) {
      toast({ title: "URL required", description: "Enter an endpoint URL to continue.", variant: "destructive" });
      return;
    }
    if (formEvents.length === 0) {
      toast({ title: "Select at least one event", description: "Endpoints must subscribe to one or more events.", variant: "destructive" });
      return;
    }
    if (editingId) {
      setEndpoints((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, url: formUrl, description: formDesc, events: formEvents, status: formActive ? (e.status === "failing" ? "failing" : "active") : "paused" }
            : e,
        ),
      );
      toast({ title: "Endpoint updated", description: `${formUrl} saved. Changes audited.` });
    } else {
      const id = `wh-${String(endpoints.length + 1).padStart(3, "0")}`;
      setEndpoints((prev) => [
        ...prev,
        {
          id,
          url: formUrl,
          description: formDesc,
          events: formEvents,
          status: formActive ? "active" : "paused",
          successRate: 100,
          lastDelivery: null,
          secret: `whsec_${Math.random().toString(36).slice(2, 18)}`,
        },
      ]);
      toast({ title: "Endpoint created", description: `Subscribed to ${formEvents.length} event(s). Send a test to verify.` });
    }
    setDialogOpen(false);
  };

  const testSend = (ep: WebhookEndpoint) => {
    const ev = ep.events[0] ?? "ping";
    const newDelivery: Delivery = {
      id: `dlv-${502 + deliveries.length}`,
      event: ev,
      endpointId: ep.id,
      endpointUrl: ep.url,
      statusCode: ep.status === "failing" ? 502 : 200,
      durationMs: ep.status === "failing" ? 3000 : 110 + Math.round(Math.random() * 90),
      deliveredAt: new Date().toISOString(),
      ok: ep.status !== "failing",
      attempt: 1,
    };
    setDeliveries((prev) => [newDelivery, ...prev]);
    toast(
      newDelivery.ok
        ? { title: "Test delivered", description: `${ev} → ${ep.url} responded 200 in ${newDelivery.durationMs}ms.` }
        : { title: "Test failed", description: `${ev} → ${ep.url} responded ${newDelivery.statusCode}. Endpoint marked failing.`, variant: "destructive" },
    );
    if (!newDelivery.ok) {
      setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? { ...e, status: "failing" } : e)));
    }
  };

  const rotateSecret = (ep: WebhookEndpoint) => {
    const next = `whsec_${Math.random().toString(36).slice(2, 18)}`;
    setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? { ...e, secret: next } : e)));
    setRevealed(ep.id);
    toast({ title: "Signing secret rotated", description: `${ep.id}: new secret shown once. Previous secret valid for 24h.` });
  };

  const togglePause = (ep: WebhookEndpoint) => {
    const next: EndpointStatus = ep.status === "active" ? "paused" : "active";
    setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? { ...e, status: next } : e)));
    toast({ title: next === "active" ? "Endpoint resumed" : "Endpoint paused", description: `${ep.url} is now ${next}. Audited.` });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEndpoints((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    toast({ title: "Endpoint deleted", description: `${deleteTarget.url} removed. Deliveries stopped.` });
    setDeleteTarget(null);
  };

  const retryDelivery = (d: Delivery) => {
    const ep = endpoints.find((e) => e.id === d.endpointId);
    const okNow = ep ? ep.status !== "failing" : true;
    setDeliveries((prev) =>
      prev.map((x) =>
        x.id === d.id
          ? { ...x, ok: okNow, statusCode: okNow ? 200 : d.statusCode, deliveredAt: new Date().toISOString(), attempt: x.attempt + 1 }
          : x,
      ),
    );
    toast(
      okNow
        ? { title: "Delivery retried", description: `${d.event} → 200 OK on attempt ${(d.attempt ?? 0) + 1}.` }
        : { title: "Retry failed again", description: `${d.event} → endpoint still returning ${d.statusCode}.`, variant: "destructive" },
    );
  };

  const retryAllFailed = () => {
    const failing = deliveries.filter((d) => !d.ok);
    if (failing.length === 0) {
      toast({ title: "Nothing to retry", description: "All recent deliveries succeeded." });
      return;
    }
    setDeliveries((prev) =>
      prev.map((d) => (d.ok ? d : { ...d, ok: true, statusCode: 200, deliveredAt: new Date().toISOString(), attempt: d.attempt + 1 })),
    );
    toast({ title: "Bulk redelivery queued", description: `${failing.length} failed deliveries re-queued in order.` });
  };

  const deliveryColumns: Column<Delivery>[] = [
    {
      key: "event",
      header: "Event",
      cell: (row) => <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">{row.event}</code>,
      sortValue: (row) => row.event,
    },
    {
      key: "endpoint",
      header: "Endpoint",
      cell: (row) => <span className="block max-w-[240px] truncate text-xs text-muted-foreground">{row.endpointUrl}</span>,
    },
    {
      key: "status",
      header: "Response",
      cell: (row) => (
        <StatusBadge tone={row.ok ? "success" : "danger"}>
          {row.statusCode} {row.ok ? "OK" : "ERR"}
        </StatusBadge>
      ),
      sortValue: (row) => row.statusCode,
    },
    {
      key: "duration",
      header: "Duration",
      cell: (row) => (
        <span className="text-sm">
          {row.durationMs}
          <span className="text-muted-foreground"> ms</span>
        </span>
      ),
      numeric: true,
      sortValue: (row) => row.durationMs,
    },
    {
      key: "attempt",
      header: "Attempt",
      cell: (row) => <span className="text-sm">#{row.attempt}</span>,
      numeric: true,
      sortValue: (row) => row.attempt,
    },
    {
      key: "delivered",
      header: "Delivered At",
      cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.deliveredAt).toLocaleString()}</span>,
      sortValue: (row) => row.deliveredAt,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) =>
        !row.ok ? (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => retryDelivery(row)}>
            <RefreshCw className="mr-1 h-3 w-3" /> Retry
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">Delivered</span>
        ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Webhooks & Events"
        description="Subscribe endpoints to platform events, inspect delivery logs, and manage signing secrets."
        icon={Webhook}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={retryAllFailed}>
              <RefreshCw className="mr-1 h-4 w-4" /> Redeliver Failed
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Add Endpoint
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Endpoints" value={`${stats.active}/${stats.total} active`} icon={Webhook} tone={stats.active > 0 ? "positive" : "warning"} />
          <MetricCard label="Deliveries (48h)" value={stats.last24} icon={Send} />
          <MetricCard label="Success Rate" value={`${stats.successRate.toFixed(1)}%`} icon={CheckCircle2} tone={stats.successRate >= 99 ? "positive" : stats.successRate >= 90 ? "warning" : "negative"} />
          <MetricCard label="Failing Endpoints" value={stats.failing} icon={AlertTriangle} tone={stats.failing > 0 ? "negative" : "positive"} />
        </div>

        {/* Endpoints */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Endpoints</h2>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-3 w-3" /> Add Endpoint
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {endpoints.map((ep) => {
              const isRevealed = revealed === ep.id;
              return (
                <div key={ep.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="truncate text-xs font-semibold font-mono">{ep.url}</code>
                        <StatusBadge tone={STATUS_TONES[ep.status]}>{ep.status}</StatusBadge>
                        <span className="text-[10px] text-muted-foreground">{ep.id}</span>
                      </div>
                      {ep.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{ep.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ep.events.map((ev) => (
                          <Badge key={ev} variant="secondary" className="text-[9px] font-mono">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="text-right">
                        <p className="text-lg font-bold leading-none">{ep.successRate}%</p>
                        <p className="text-[10px] text-muted-foreground">success rate</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {ep.lastDelivery ? `last: ${new Date(ep.lastDelivery).toLocaleString()}` : "no deliveries yet"}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Secret */}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <code className="max-w-[220px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                        {isRevealed ? ep.secret : "whsec_••••••••••••••••"}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        aria-label={isRevealed ? "Hide secret" : "Reveal secret"}
                        onClick={() => setRevealed(isRevealed ? null : ep.id)}
                      >
                        {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => rotateSecret(ep)}
                      >
                        Rotate
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => testSend(ep)}>
                        <Send className="mr-1 h-3 w-3" /> Test
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => togglePause(ep)}>
                        {ep.status === "active" ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
                        {ep.status === "active" ? "Pause" : "Enable"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openEdit(ep)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] text-rose-600 hover:text-rose-700"
                        onClick={() => setDeleteTarget(ep)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {endpoints.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Webhook className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 font-medium">No webhook endpoints</p>
                <p className="text-sm text-muted-foreground">Add an endpoint to start receiving platform events.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery log */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Delivery Log</h2>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={deliveryColumns}
              data={deliveries}
              rowKey={(row) => row.id}
              searchableText={(row) => `${row.event} ${row.endpointUrl} ${row.statusCode} ${row.ok ? "ok" : "failed"}`}
              searchPlaceholder="Search deliveries…"
              pageSize={6}
              emptyTitle="No deliveries"
              emptyDescription="Deliveries will appear here once an endpoint receives events."
            />
            <Separator />
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Failed deliveries retry automatically with exponential backoff (5 attempts over 1h), then pause the endpoint.
              Payloads are signed with HMAC-SHA256 (<code className="font-mono">X-PFAAS-Signature</code> header).
            </div>
          </CardContent>
        </Card>
      </PageContent>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Endpoint" : "Add Endpoint"}</DialogTitle>
            <DialogDescription>
              Events are delivered as JSON POST requests with an HMAC-SHA256 signature header.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://api.example.com/webhooks/pfaas"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-desc">Description</Label>
              <Textarea
                id="wh-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What this endpoint is used for."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subscribed Events ({formEvents.length} selected)</Label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((ev) => {
                  const on = formEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      aria-pressed={on}
                      className={
                        on
                          ? "rounded-md bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground transition-colors"
                          : "rounded-md border bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      }
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Deliver events immediately after saving.</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} aria-label="Endpoint active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEndpoint}>
              <Terminal className="mr-1 h-4 w-4" /> {editingId ? "Save Changes" : "Create Endpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <code className="font-mono">{deleteTarget?.url}</code> and stops all deliveries.
              Existing delivery logs are retained for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={confirmDelete}
            >
              Delete Endpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
