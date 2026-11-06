"use client";

/**
 * M1 — Connector Activity & Event Log (spec 5.4).
 *
 * Operational black box for every integration event: deliveries, syncs,
 * webhook receipts and failures. Turns the silent Last Sync column into a
 * queryable stream — first screen support engineers open when a provider
 * integration misbehaves.
 *
 * Dummy data only — no network calls. Events are generated from the
 * connector store and filtered by connector, event type, status and date
 * range. Clicking a row opens a Payload drawer with formatted JSON, headers,
 * provider response, correlation ID copy, and Retry button for failed
 * outbound events.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Download, RotateCcw, Copy, Package2, FileText, ArrowUpDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { getConnectors } from "../connector-store";
import { getConnectorDefinition } from "../registry";
import { absoluteTime } from "../format";

interface ActivityEvent {
  id: string;
  connectorId: string;
  connectorName: string;
  type: "delivery" | "sync" | "webhook.received" | "error";
  direction: "outbound" | "inbound";
  status: "Success" | "Retried" | "Failed";
  timestamp: string;
  durationMs: number;
  payloadPreview: string;
  responsePreview: string;
  correlationId: string;
}

function buildEvents(): ActivityEvent[] {
  const records = getConnectors();
  const events: ActivityEvent[] = [];
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const MIN = 60 * 1000;

  for (const rec of records) {
    const def = getConnectorDefinition(rec.definitionId);
    const name = def?.name ?? rec.definitionId;
    const baseTs = now - 4 * HOUR;

    // Generate sync events
    for (let i = 0; i < (rec.events24h || 0); i++) {
      const status = i % 5 === 0 ? "Retried" : "Success";
      events.push({
        id: `evt-${rec.id}-sync-${i}`,
        connectorId: rec.id,
        connectorName: name,
        type: "sync",
        direction: "outbound",
        status,
        timestamp: new Date(baseTs + i * 5 * MIN).toISOString(),
        durationMs: rec.latencyMs ?? 200,
        payloadPreview: JSON.stringify({ event: "contact.sync", count: 123 + i }).slice(0, 120),
        responsePreview: `{ "status": 200, "processed": ${123 + i} }`,
        correlationId: `corr-${rec.id}-${i}`,
      });
    }

    // One webhook event
    events.push({
      id: `evt-${rec.id}-webhook`,
      connectorId: rec.id,
      connectorName: name,
      type: "webhook.received",
      direction: "inbound",
      status: rec.status === "error" ? "Failed" : "Success",
      timestamp: new Date(now - 2 * MIN).toISOString(),
      durationMs: rec.latencyMs ?? 150,
      payloadPreview: JSON.stringify({ event: "provider.webhook", source: name }).slice(0, 120),
      responsePreview: rec.status === "error"
        ? `{ "error": "HTTP 401 invalid_grant" }`
        : `{ "status": 200 }`,
      correlationId: `corr-${rec.id}-webhook`,
    });

    // One delivery event for error cases
    if (rec.status === "error" || rec.status === "degraded") {
      events.push({
        id: `evt-${rec.id}-delivery`,
        connectorId: rec.id,
        connectorName: name,
        type: "delivery",
        direction: "outbound",
        status: "Failed",
        timestamp: new Date(now - 45 * MIN).toISOString(),
        durationMs: rec.latencyMs ?? 300,
        payloadPreview: JSON.stringify({ event: "provider.delivery", destination: name }).slice(0, 120),
        responsePreview: rec.lastError ?? `{ "error": "HTTP 401 invalid_grant" }`,
        correlationId: `corr-${rec.id}-delivery`,
      });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

interface ActivityKpis {
  events24h: number;
  successRate: number;
  averageLatency: number;
  failed: number;
}

function computeActivityKpis(events: ActivityEvent[]): ActivityKpis {
  const total = events.length;
  const success = events.filter((e) => e.status === "Success").length;
  const avgLatency = total > 0
    ? Math.round(events.reduce((s, e) => s + e.durationMs, 0) / total)
    : 0;
  const failed = events.filter((e) => e.status === "Failed").length;
  return {
    events24h: total,
    successRate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
    averageLatency: avgLatency,
    failed,
  };
}

export function ConnectorActivityPage() {
  const records = getConnectors();
  const connectors = useMemo(
    () => records.map((r) => ({ id: r.id, name: getConnectorDefinition(r.definitionId)?.name ?? r.definitionId })),
    [records],
  );

  const [allEvents, setAllEvents] = useState<ActivityEvent[]>(buildEvents());
  const [connectorFilter, setConnectorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("last-24h");
  const [drawerEvent, setDrawerEvent] = useState<ActivityEvent | null>(null);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (connectorFilter !== "all" && e.connectorId !== connectorFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (dateRange !== "all-time") {
        const cutoff = dateRange === "last-24h" ? Date.now() - 24 * 60 * 60 * 1000 : Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (new Date(e.timestamp).getTime() < cutoff) return false;
      }
      return true;
    });
  }, [allEvents, connectorFilter, typeFilter, statusFilter, dateRange]);

  const kpis = useMemo(() => computeActivityKpis(filtered), [filtered]);

  const dataTableColumns: Column<ActivityEvent>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (e) => (
        <span title={absoluteTime(e.timestamp)}>
          {new Date(e.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (e) => e.timestamp,
    },
    {
      key: "connector",
      header: "Connector",
      cell: (e) => e.connectorName,
      sortValue: (e) => e.connectorName,
    },
    {
      key: "type",
      header: "Event",
      cell: (e) => (
        <span className="text-sm font-medium">{e.type}</span>
      ),
      sortValue: (e) => e.type,
    },
    {
      key: "direction",
      header: "Dir",
      cell: (e) => (
        <span className={`text-xs ${e.direction === "outbound" ? "text-rose-600" : "text-green-600"}`}>
          {e.direction === "outbound" ? "outbound" : "inbound"}
        </span>
      ),
      sortValue: (e) => e.direction,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <StatusBadge tone={e.status === "Failed" ? "warning" : e.status === "Retried" ? "warning" : "success"}>
          {e.status}
        </StatusBadge>
      ),
      sortValue: (e) => e.status,
    },
    {
      key: "durationMs",
      header: "Dur",
      cell: (e) => (
        <span className="text-xs">{e.durationMs}ms</span>
      ),
      sortValue: (e) => e.durationMs,
    },
    {
      key: "payloadPreview",
      header: "Payload",
      cell: (e) => (
        <span className="text-xs text-muted-foreground" title={e.payloadPreview}>
          {e.payloadPreview.length > 100 ? `${e.payloadPreview.slice(0, 97)}…` : e.payloadPreview}
        </span>
      ),
      sortValue: (e) => e.payloadPreview,
    },
    {
      key: "responsePreview",
      header: "Response",
      cell: (e) => (
        <span className="text-xs text-muted-foreground" title={e.responsePreview}>
          {e.responsePreview.length > 100 ? `${e.responsePreview.slice(0, 97)}…` : e.responsePreview}
        </span>
      ),
      sortValue: (e) => e.responsePreview,
    },
    {
      key: "correlationId",
      header: "Corr ID",
      cell: (e) => (
        <span className="text-xs">
          <Badge variant="outline" className="text-sm">{e.correlationId.slice(-8)}</Badge>
        </span>
      ),
    },
    {
      key: "actions",
      width: "120px",
      header: "Actions",
      cell: (e) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setDrawerEvent(e)}>
            <Package2 className="h-3 w-3" />
          </Button>
          {e.status === "Failed" && (
            <Button size="sm" variant="destructive" onClick={() => {
              setDrawerEvent(null);
              toast({
                title: "Retry started",
                description: `${e.connectorName} ${e.type} retried — new event linked by ${e.correlationId.slice(-8)}.`,
              });
            }}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const searchableText = (e: ActivityEvent) => `${e.connectorName} ${e.type} ${e.status}`;

  const onExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "timestamp", header: "Timestamp", value: (e) => new Date(e.timestamp).toLocaleString() },
        { key: "connector", header: "Connector", value: (e) => e.connectorName },
        { key: "type", header: "Event Type", value: (e) => e.type },
        { key: "direction", header: "Direction", value: (e) => e.direction },
        { key: "status", header: "Status", value: (e) => e.status },
        { key: "durationMs", header: "Duration (ms)", value: (e) => e.durationMs },
        { key: "payloadPreview", header: "Payload Preview", value: (e) => e.payloadPreview },
        { key: "responsePreview", header: "Response Preview", value: (e) => e.responsePreview },
        { key: "correlationId", header: "Correlation ID", value: (e) => e.correlationId },
      ],
      "connector-activity.csv",
    );
    toast({
      title: "Export ready",
      description: `${filtered.length} event(s) exported to CSV.`,
    });
  };

  const onClearFilters = () => {
    setConnectorFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setDateRange("all-time");
  };

  const dateLabel: Record<string, string> = {
    "last-24h": "Last 24 h",
    "last-7d": "Last 7 d",
    "all-time": "All time",
  };

  return (
    <Page>
      <PageHeader
        title="Connector Activity"
        description="Operational black box for every integration event — deliveries, syncs, webhook receipts and failures."
        icon={RotateCcw}
        actions={(
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        )}
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Events 24h" value={kpis.events24h.toLocaleString("en-US")} icon={Download} />
          <MetricCard
            label="Success rate"
            value={`${kpis.successRate.toFixed(1)}%`}
            deltaLabel="vs prev 24h"
            tone={kpis.failed > 0 ? "warning" : "default"}
          />
          <MetricCard label="Average latency" value={`${kpis.averageLatency} ms`} icon={FileText} />
          <MetricCard
            label="Failed"
            value={kpis.failed.toLocaleString("en-US")}
            tone={kpis.failed > 0 ? "negative" : "default"}
          />
        </div>

        {/* Filter bar */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Connector</label>
            <Select value={connectorFilter} onValueChange={setConnectorFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All connectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All connectors</SelectItem>
                {connectors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Event type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {["delivery", "sync", "webhook.received", "error"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[ "Success", "Retried", "Failed" ].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Date range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={dateLabel[dateRange]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-24h">Last 24 h</SelectItem>
                <SelectItem value="last-7d">Last 7 d</SelectItem>
                <SelectItem value="all-time">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Search</label>
            <Input
              value=""
              onChange={() => {}}
              placeholder="Search events…"
              className="w-full h-10"
              disabled
            />
          </div>
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">&nbsp;</label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onClearFilters}>
                <ArrowUpDown className="mr-1 h-3 w-3" /> Clear filters
              </Button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No events match these filters"
            description="Adjust the connector, event type, status or date range filter. Enable event logging on a connector to start recording events."
            action={
              <Button size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={dataTableColumns}
            data={filtered}
            rowKey={(e) => e.id}
            pageSize={8}
            searchableText={searchableText}
            searchPlaceholder="Search events…"
            emptyTitle="No events match these filters"
            emptyDescription="Adjust the connector, event type, status or date range filter."
          />
        )}

        {/* Payload drawer — opens when a table row is clicked */}
        <Sheet open={drawerEvent !== null} onOpenChange={(o) => { if (!o) setDrawerEvent(null); }}>
          <SheetContent side="right" className="max-w-2xl">
            <SheetHeader>
              <SheetTitle>Event Payload</SheetTitle>
              <SheetDescription>
                Full request/response details for the selected integration event.
              </SheetDescription>
            </SheetHeader>
            {drawerEvent && (
              <div className="space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Connector</p>
                    <p className="font-medium">{drawerEvent.connectorName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Event type</p>
                    <p className="font-medium">{drawerEvent.type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Direction</p>
                    <p className="font-medium">{drawerEvent.direction}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">
                      <StatusBadge tone={drawerEvent.status === "Failed" ? "warning" : drawerEvent.status === "Retried" ? "warning" : "success"}>
                        {drawerEvent.status}
                      </StatusBadge>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Timestamp</p>
                    <p className="font-medium" title={absoluteTime(drawerEvent.timestamp)}>
                      {new Date(drawerEvent.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">{drawerEvent.durationMs} ms</p>
                  </div>
                </div>

                <Separator />

                {/* Correlation ID with copy */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Correlation ID</p>
                    <Badge variant="outline" className="text-sm">{drawerEvent.correlationId.slice(-8)}</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(drawerEvent.correlationId);
                    toast({ title: "Copied", description: "Correlation ID copied to clipboard." });
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Request payload */}
                <div>
                  <p className="text-sm font-medium mb-1">Request payload</p>
                  <pre className="bg-black/5 p-3 rounded text-[11px] overflow-x-auto text-mono max-h-48 overflow-y-auto">
                    {JSON.stringify(JSON.parse(drawerEvent.payloadPreview.slice(0, -1) + "}"), null, 2)}
                  </pre>
                </div>

                {/* Response payload */}
                <div>
                  <p className="text-sm font-medium mb-1">Provider response</p>
                  <pre className="bg-black/5 p-3 rounded text-[11px] overflow-x-auto text-mono max-h-48 overflow-y-auto">
                    {JSON.stringify(JSON.parse(drawerEvent.responsePreview), null, 2)}
                  </pre>
                </div>

                {/* Headers */}
                <div>
                  <p className="text-sm font-medium mb-1">Request headers</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>Content-Type: application/json</li>
                    <li>Authorization: Bearer [redacted]</li>
                    <li>User-Agent: PFaaS-Integration/1.0</li>
                    <li>X-Correlation-ID: {drawerEvent.correlationId}</li>
                  </ul>
                </div>

                {/* Retry button for failed outbound */}
                {drawerEvent.status === "Failed" && drawerEvent.direction === "outbound" && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      This outbound event failed. Retrying will send the exact same payload and create a new event linked by the same correlation ID.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        const retryEvent: ActivityEvent = {
                          id: `evt-${drawerEvent.connectorId}-retry-${Date.now()}`,
                          connectorId: drawerEvent.connectorId,
                          connectorName: drawerEvent.connectorName,
                          type: drawerEvent.type,
                          direction: "outbound",
                          status: "Success",
                          timestamp: new Date().toISOString(),
                          durationMs: drawerEvent.durationMs,
                          payloadPreview: drawerEvent.payloadPreview,
                          responsePreview: `{ "status": 200, "retried": true, "originalCorrelationId": "${drawerEvent.correlationId}" }`,
                          correlationId: drawerEvent.correlationId,
                        };
                        setAllEvents((prev) => [retryEvent, ...prev]);
                        setDrawerEvent(null);
                        toast({
                          title: "Retry succeeded",
                          description: `New event created linked by correlation ID ${drawerEvent.correlationId.slice(-8)}.`,
                        });
                      }}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry delivery
                    </Button>
                  </div>
                )}
              </div>
            )}
            <SheetFooter>
              <Button variant="outline" onClick={() => setDrawerEvent(null)}>Close</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}

const searchableText = (e: ActivityEvent) => `${e.connectorName} ${e.type} ${e.status}`;
