"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { AlertTriangle, Eye, Users, Globe, Network, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";

interface AbuseSignal {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium";
  detail: string;
  affectedTenants: string[];
  evidence: string;
  detectedAt: string;
}

const signals: AbuseSignal[] = [
  { id: "AB-001", type: "Shared IP cluster", severity: "critical", detail: "12 accounts across 3 tenants share IP 198.51.100.42", affectedTenants: ["Alpha Capital", "Beta Trading", "Gamma Futures"], evidence: "IP fingerprint match · 3 tenants · 12 accounts", detectedAt: "2h ago" },
  { id: "AB-002", type: "Device cluster", severity: "high", detail: "Browser fingerprint matches across 5 accounts on 2 tenants", affectedTenants: ["Alpha Capital", "Beta Trading"], evidence: "Canvas fingerprint + UA match · 5 accounts", detectedAt: "6h ago" },
  { id: "AB-003", type: "Cross-tenant pattern", severity: "medium", detail: "Trader 'Liam Smith' has similar trading patterns on Alpha and Beta", affectedTenants: ["Alpha Capital", "Beta Trading"], evidence: "Position correlation 87% · same symbols · same timing", detectedAt: "1d ago" },
  { id: "AB-004", type: "Suspicious relationship", severity: "high", detail: "Payout destination wallet matches across 3 traders on 2 tenants", affectedTenants: ["Beta Trading", "Gamma Futures"], evidence: "Wallet address match · 3 traders · 2 tenants", detectedAt: "2d ago" },
  { id: "AB-005", type: "Repeated fraud pattern", severity: "critical", detail: "Challenge purchase → immediate payout → chargeback pattern detected 4 times", affectedTenants: ["Gamma Futures"], evidence: "Chargeback rate 8.2% (normal <0.5%) · 4 cases in 7d", detectedAt: "3d ago" },
];

const sevTone = (s: AbuseSignal["severity"]) =>
  s === "critical" ? "danger" : s === "high" ? "warning" : "info";

const columns: Column<AbuseSignal>[] = [
  { key: "type", header: "Signal", cell: (s) => <span className="font-medium">{s.type}</span>, sortValue: (s) => s.type },
  { key: "severity", header: "Severity", cell: (s) => <StatusBadge tone={sevTone(s.severity)}>{s.severity}</StatusBadge>, sortValue: (s) => s.severity },
  { key: "detail", header: "Detail", cell: (s) => <span className="text-xs text-muted-foreground">{s.detail}</span> },
  { key: "tenants", header: "Affected", cell: (s) => <div className="flex flex-wrap gap-1">{s.affectedTenants.map((t) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}</div> },
  { key: "evidence", header: "Evidence", cell: (s) => <span className="text-xs font-mono text-muted-foreground">{s.evidence}</span> },
  { key: "detectedAt", header: "Detected", cell: (s) => <span className="text-xs text-muted-foreground">{s.detectedAt}</span>, sortValue: (s) => s.detectedAt },
];

export function AbuseSignalsPage() {
  const critical = signals.filter((s) => s.severity === "critical").length;
  const high = signals.filter((s) => s.severity === "high").length;

  return (
    <Page>
      <PageHeader title="Cross-Tenant Abuse Signals" description="Observe and investigate cross-tenant abuse. The platform console observes; tenant-level risk decisions belong to the tenant/risk domain." icon={AlertTriangle} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Signals" value={signals.length} icon={AlertTriangle} />
          <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
          <MetricCard label="High" value={high} icon={Eye} tone={high > 0 ? "warning" : "positive"} />
          <MetricCard label="Tenants Affected" value={new Set(signals.flatMap((s) => s.affectedTenants)).size} icon={Users} />
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Observation only</p>
          <p className="mt-1">The platform console primarily <strong>observes and investigates</strong> cross-tenant abuse. The actual tenant-level risk decision (suspend trader, freeze account, etc.) belongs to the tenant/risk domain. Use these signals to notify affected tenants and coordinate response.</p>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Active abuse signals</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={signals} rowKey={(s) => s.id} searchableText={(s) => `${s.type} ${s.detail} ${s.evidence}`} searchPlaceholder="Search signals…" pageSize={10} emptyTitle="No signals" emptyDescription="Abuse signals will appear here when detected." />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
