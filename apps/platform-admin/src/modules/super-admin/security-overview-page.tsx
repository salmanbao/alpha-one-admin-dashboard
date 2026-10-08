"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Lock, AlertTriangle, CheckCircle2, XCircle, KeyRound, Clock, Eye, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecurityEvent {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  actor: string;
  detail: string;
  ip: string;
  timestamp: string;
}

const events: SecurityEvent[] = [
  { id: "SE-001", type: "Failed login", severity: "warning", actor: "unknown@example.com", detail: "3 failed attempts from new IP", ip: "203.0.113.10", timestamp: "15m ago" },
  { id: "SE-002", type: "Suspicious login", severity: "critical", actor: "admin@gammafutures.com", detail: "Login from anomalous location (Russia) — blocked", ip: "198.51.100.42", timestamp: "1h ago" },
  { id: "SE-003", type: "MFA challenge", severity: "warning", actor: "sarah@alphacapital.com", detail: "TOTP verification required after device change", ip: "192.168.1.1", timestamp: "2h ago" },
  { id: "SE-004", type: "Session revoked", severity: "info", actor: "marcus@betatrading.com", detail: "Admin revoked stale session from London, UK", ip: "203.0.113.5", timestamp: "5h ago" },
  { id: "SE-005", type: "Credential rotation", severity: "info", actor: "system", detail: "Postmark API key rotated — fingerprint changed to ••••C2D5", ip: "—", timestamp: "1d ago" },
  { id: "SE-006", type: "Certificate expiry", severity: "warning", actor: "system", detail: "MT5 Bridge SSL certificate expires in 14 days", ip: "—", timestamp: "1d ago" },
];

const sevTone = (s: SecurityEvent["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : "info";

const columns: Column<SecurityEvent>[] = [
  { key: "type", header: "Event", cell: (e) => <span className="font-medium">{e.type}</span>, sortValue: (e) => e.type },
  { key: "severity", header: "Severity", cell: (e) => <StatusBadge tone={sevTone(e.severity)}>{e.severity}</StatusBadge>, sortValue: (e) => e.severity },
  { key: "actor", header: "Actor", cell: (e) => <span className="text-xs">{e.actor}</span>, sortValue: (e) => e.actor },
  { key: "detail", header: "Detail", cell: (e) => <span className="text-xs text-muted-foreground">{e.detail}</span> },
  { key: "ip", header: "IP", cell: (e) => <span className="font-mono text-xs">{e.ip}</span>, sortValue: (e) => e.ip },
  { key: "timestamp", header: "Time", cell: (e) => <span className="text-xs text-muted-foreground">{e.timestamp}</span>, sortValue: (e) => e.timestamp },
];

export function SecurityOverviewPage() {
  const failedLogins = events.filter((e) => e.type === "Failed login").length;
  const suspiciousLogins = events.filter((e) => e.type === "Suspicious login").length;
  const anomalyBlocks = events.filter((e) => e.severity === "critical").length;

  return (
    <Page>
      <PageHeader title="Security Overview" description="Platform security posture — logins, anomalies, credential rotation, and certificate health." icon={Lock} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Failed Logins (24h)" value={failedLogins} icon={XCircle} tone={failedLogins > 2 ? "warning" : "positive"} />
          <MetricCard label="Suspicious Logins" value={suspiciousLogins} icon={ShieldAlert} tone={suspiciousLogins > 0 ? "negative" : "positive"} />
          <MetricCard label="Anomaly Blocks" value={anomalyBlocks} icon={AlertTriangle} tone={anomalyBlocks > 0 ? "warning" : "positive"} />
          <MetricCard label="MFA Enabled" value="100%" icon={KeyRound} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Credential rotation status</span></CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "MetaApi key", status: "Current", age: "12 days", tone: "success" as const },
                { name: "Veriff key", status: "Current", age: "45 days", tone: "success" as const },
                { name: "NOWPayments key", status: "Current", age: "8 days", tone: "success" as const },
                { name: "Postmark key", status: "Current", age: "30 days", tone: "success" as const },
                { name: "MT5 SSL cert", status: "Expiring (14d)", age: "—", tone: "warning" as const },
              ].map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" />{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{c.age}</span>
                    <StatusBadge tone={c.tone}>{c.status}</StatusBadge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">MFA status</span></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Platform operators with MFA</span>
                <span className="font-medium">5 / 5 (100%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Tenant admins with MFA (avg)</span>
                <span className="font-medium">89%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />Last MFA challenge</span>
                <span className="font-medium">2h ago</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-slate-500" />Security events (24h)</span>
                <span className="font-medium">{events.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Security events</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={events} rowKey={(e) => e.id} searchableText={(e) => `${e.type} ${e.actor} ${e.detail}`} searchPlaceholder="Search security events…" pageSize={10} emptyTitle="No events" emptyDescription="Security events will appear here." />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
