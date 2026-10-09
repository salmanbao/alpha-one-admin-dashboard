"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Activity, Search, Clock, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Server } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface BridgeSyncEntry {
  id: string;
  bridge: string;
  direction: "sync" | "replay" | "retry" | "failover";
  status: "success" | "in_progress" | "failed" | "pending";
  source: string;
  target: string;
  records: number;
  startedAt: string;
  completedAt: string;
  latency: string;
  error?: string;
  hash?: string;
}

const initialEntries: BridgeSyncEntry[] = [
  { id: "BSL-001", bridge: "MT5 Bridge", direction: "sync", status: "success", source: "MT5 Server 1", target: "PFaaS Core", records: 1240, startedAt: "2m ago", completedAt: "2m 30s ago", latency: "30s", hash: "0x9f4a...21c4" },
  { id: "BSL-002", bridge: "MT5 Bridge", direction: "replay", status: "in_progress", source: "WAL Archive", target: "PFaaS Core", records: 340, startedAt: "1m ago", completedAt: "—", latency: "—", hash: "0x7b3c...d91e" },
  { id: "BSL-003", bridge: "Payout Rail", direction: "sync", status: "success", source: "Match2Pay", target: "PFaaS Core", records: 89, startedAt: "5m ago", completedAt: "5m 12s ago", latency: "12s", hash: "0x3d8a...f5a2" },
  { id: "BSL-004", bridge: "MT5 Bridge", direction: "retry", status: "pending", source: "MT5 Server 2 (failed)", target: "PFaaS Core", records: 56, startedAt: "—", completedAt: "—", latency: "—", error: "Connection timeout — retry scheduled", hash: "0xe2b1...c7d8" },
  { id: "BSL-005", bridge: "KYC Provider", direction: "sync", status: "success", source: "Veriff", target: "PFaaS Core", records: 23, startedAt: "8m ago", completedAt: "8m 45s ago", latency: "45s", hash: "0x5a1c...b3e9" },
  { id: "BSL-006", bridge: "MT5 Bridge", direction: "failover", status: "success", source: "MT5 Server 1 (primary)", target: "MT5 Server 2 (secondary)", records: 1240, startedAt: "1h ago", completedAt: "1h 5m ago", latency: "5m", hash: "0x2d7b...e4f1" },
  { id: "BSL-007", bridge: "NOWPayments", direction: "sync", status: "failed", source: "NOWPayments API", target: "PFaaS Core", records: 0, startedAt: "12m ago", completedAt: "12m ago", latency: "12m", error: "API error 503 — Service unavailable", hash: "0xf8c2...a1d4" },
  { id: "BSL-008", bridge: "Trade Copy", direction: "sync", status: "success", source: "Signal Provider", target: "Subscriber Accounts", records: 45, startedAt: "15m ago", completedAt: "15m 20s ago", latency: "20s", hash: "0xc4a1...d8e2" },
];

export function BridgeSyncLogPage() {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [bridgeFilter, setBridgeFilter] = useState("all");

  const bridges = Array.from(new Set(entries.map((e) => e.bridge)));
  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.bridge.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()) || (e.error && e.error.toLowerCase().includes(search.toLowerCase()));
    const matchBridge = bridgeFilter === "all" || e.bridge === bridgeFilter;
    return matchSearch && matchBridge;
  });

  const successes = entries.filter((e) => e.status === "success").length;
  const inProgress = entries.filter((e) => e.status === "in_progress").length;
  const failed = entries.filter((e) => e.status === "failed").length;
  const totalRecords = entries.reduce((s, e) => s + e.records, 0);

  const statusTone = (s: BridgeSyncEntry["status"]) => s === "success" ? "success" : s === "in_progress" ? "info" : s === "failed" ? "danger" : "warning";

  const columns: Column<BridgeSyncEntry>[] = [
    { key: "id", header: "ID", cell: (e) => <Badge variant="outline" className="text-[9px] font-mono">{e.id}</Badge>, sortValue: (e) => e.id },
    { key: "bridge", header: "Bridge", cell: (e) => <span className="font-medium">{e.bridge}</span>, sortValue: (e) => e.bridge },
    { key: "direction", header: "Direction", cell: (e) => <Badge variant="outline" className="text-[9px] capitalize">{e.direction}</Badge>, sortValue: (e) => e.direction },
    { key: "status", header: "Status", cell: (e) => <StatusBadge tone={statusTone(e.status)}>{e.status}</StatusBadge>, sortValue: (e) => e.status },
    { key: "source", header: "Source", cell: (e) => <span className="text-xs">{e.source}</span>, sortValue: (e) => e.source },
    { key: "target", header: "Target", cell: (e) => <span className="text-xs">{e.target}</span>, sortValue: (e) => e.target },
    { key: "records", header: "Records", cell: (e) => <span className="text-xs tabular-nums font-medium">{e.records.toLocaleString()}</span>, sortValue: (e) => e.records },
    { key: "latency", header: "Latency", cell: (e) => <span className="text-xs tabular-nums">{e.latency}</span>, sortValue: (e) => e.latency },
    { key: "startedAt", header: "Started", cell: (e) => <span className="text-xs text-muted-foreground">{e.startedAt}</span>, sortValue: (e) => e.startedAt },
    { key: "error", header: "Error", cell: (e) => e.error ? <span className="text-xs text-rose-600 max-w-[200px] truncate">{e.error}</span> : <span className="text-xs text-muted-foreground">—</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Bridge Sync Log"
        description="Real-time bridge synchronization, replay, retry, and failover events with record counts and hashes."
        icon={Activity}
        actions={<Button size="sm" variant="outline"><RefreshCw className="mr-1 h-4 w-4" /> Retry Failed</Button>}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Events" value={entries.length} icon={Server} />
          <MetricCard label="Successes" value={successes} icon={CheckCircle2} tone="positive" />
          <MetricCard label="In Progress" value={inProgress} icon={RefreshCw} tone="warning" />
          <MetricCard label="Failed" value={failed} icon={XCircle} tone="negative" />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Activity className="h-4 w-4" /> Bridge Sync Engine: 1240 records synced · WORM hash: 0x9f4a...21c4
          </div>
          <p className="mt-1">{totalRecords.toLocaleString()} total records processed · All syncs recorded with cryptographic hashes for audit.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bridge, error…" className="flex-1" />
            <Select value={bridgeFilter} onValueChange={(v) => setBridgeFilter(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All bridges" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bridges</SelectItem>
                {bridges.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No sync events found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              pageSize={10}
              searchableText={(e) => `${e.bridge} ${e.direction} ${e.source} ${e.error ?? ""}`}
              searchPlaceholder="Search sync log…"
              emptyTitle="No entries"
              emptyDescription="Bridge sync events will appear here."
            />
          )}
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Bridge Health</span></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              { bridge: "MT5 Bridge", status: "operational", latency: "320ms", errorRate: "2.1%", lastSync: "2m ago" },
              { bridge: "Payout Rail", status: "operational", latency: "180ms", errorRate: "0.2%", lastSync: "5m ago" },
              { bridge: "KYC Provider", status: "operational", latency: "310ms", errorRate: "0.1%", lastSync: "8m ago" },
              { bridge: "NOWPayments", status: "degraded", latency: "850ms", errorRate: "5.3%", lastSync: "12m ago (failed)" },
              { bridge: "Trade Copy", status: "operational", latency: "95ms", errorRate: "0.0%", lastSync: "15m ago" },
            ].map((b) => (
              <div key={b.bridge} className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <span className="font-medium text-xs">{b.bridge}</span>
                  <p className="text-[10px] text-muted-foreground">Last sync: {b.lastSync}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={b.status === "operational" ? "success" : "warning"}>{b.status}</StatusBadge>
                  <span className="text-muted-foreground">{b.latency}</span>
                  <span className="text-muted-foreground">{b.errorRate}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-rose-50/20 p-3 text-xs text-muted-foreground dark:bg-rose-950/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="h-3 w-3" /> {failed} bridge{failed !== 1 ? "s" : ""} failed in the last hour
          </div>
          <p className="mt-1">Failed syncs are automatically queued for retry. Manual retry available via the Retry Failed button. All events are recorded in the WORM audit store.</p>
        </div>
      </PageContent>
    </Page>
  );
}
