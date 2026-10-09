"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Eye, Search, Clock, Shield, AlertTriangle, CheckCircle2, UserCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ImpersonationEntry {
  id: string;
  operator: string;
  operatorRole: string;
  targetTenant: string;
  targetAdmin: string;
  action: "impersonate" | "view_as" | "revert" | "session_ended" | "flagged" | "approved";
  duration: string;
  timestamp: string;
  reason: string;
  status: "normal" | "flagged" | "audited";
  ip: string;
}

const initialEntries: ImpersonationEntry[] = [
  { id: "IMP-001", operator: "Alex Morgan", operatorRole: "super-admin", targetTenant: "Alpha Capital", targetAdmin: "sarah@alphacapital.com", action: "impersonate", duration: "12m", timestamp: "15m ago", reason: "Investigate payout workflow", status: "normal", ip: "192.168.1.1" },
  { id: "IMP-002", operator: "Marcus Vance", operatorRole: "super-admin", targetTenant: "Beta Trading", targetAdmin: "tom@betatrading.io", action: "view_as", duration: "8m", timestamp: "1h ago", reason: "Verify dashboard configuration", status: "normal", ip: "10.0.0.42" },
  { id: "IMP-003", operator: "Sarah Chen", operatorRole: "super-admin", targetTenant: "Gamma Futures", targetAdmin: "linda@gammafutures.com", action: "impersonate", duration: "23m", timestamp: "2h ago", reason: "Review KYC queue", status: "flagged", ip: "203.0.113.5" },
  { id: "IMP-004", operator: "Tom Harper", operatorRole: "super-admin", targetTenant: "Delta Capital", targetAdmin: "maya@deltacapital.io", action: "revert", duration: "35m", timestamp: "3h ago", reason: "Completed configuration review", status: "normal", ip: "198.51.100.1" },
  { id: "IMP-005", operator: "Lisa Park", operatorRole: "super-admin", targetTenant: "Alpha Capital", targetAdmin: "sarah@alphacapital.com", action: "impersonate", duration: "4h 12m", timestamp: "1d ago", reason: "Emergency payout investigation", status: "audited", ip: "192.168.1.1" },
  { id: "IMP-006", operator: "James Wright", operatorRole: "prop-admin", targetTenant: "Beta Trading", targetAdmin: "tom@betatrading.io", action: "flagged", duration: "2m", timestamp: "1d ago", reason: "Privilege escalation attempt detected", status: "flagged", ip: "45.33.22.11" },
  { id: "IMP-007", operator: "Alex Morgan", operatorRole: "super-admin", targetTenant: "Gamma Futures", targetAdmin: "linda@gammafutures.com", action: "session_ended", duration: "18m", timestamp: "2d ago", reason: "Session terminated by operator", status: "normal", ip: "192.168.1.1" },
  { id: "IMP-008", operator: "Platform System", operatorRole: "system", targetTenant: "All tenants", targetAdmin: "—", action: "approved", duration: "—", timestamp: "3d ago", reason: "Automated impersonation audit completed. All sessions nominal.", status: "normal", ip: "—" },
];

export function ImpersonationAuditPage() {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return !search || e.operator.toLowerCase().includes(q) || e.targetTenant.toLowerCase().includes(q) || e.targetAdmin.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
  });

  const flagged = entries.filter((e) => e.status === "flagged").length;
  const audited = entries.filter((e) => e.status === "audited").length;
  const totalSessions = entries.filter((e) => e.action === "impersonate" || e.action === "view_as").length;

  const statusTone = (s: ImpersonationEntry["status"]) => s === "flagged" ? "danger" : s === "audited" ? "warning" : "success";

  const columns: Column<ImpersonationEntry>[] = [
    { key: "id", header: "ID", cell: (e) => <Badge variant="outline" className="text-[9px] font-mono">{e.id}</Badge>, sortValue: (e) => e.id },
    { key: "operator", header: "Operator", cell: (e) => <span className="font-medium">{e.operator}</span>, sortValue: (e) => e.operator },
    { key: "operatorRole", header: "Role", cell: (e) => <Badge variant="outline" className="text-[9px]">{e.operatorRole}</Badge>, sortValue: (e) => e.operatorRole },
    { key: "targetTenant", header: "Target Tenant", cell: (e) => <span className="text-xs">{e.targetTenant}</span>, sortValue: (e) => e.targetTenant },
    { key: "targetAdmin", header: "Target Admin", cell: (e) => <span className="text-xs font-mono">{e.targetAdmin}</span>, sortValue: (e) => e.targetAdmin },
    { key: "action", header: "Action", cell: (e) => <Badge variant="outline" className="text-[9px] capitalize">{e.action.replace(/_/g, " ")}</Badge>, sortValue: (e) => e.action },
    { key: "duration", header: "Duration", cell: (e) => <span className="text-xs tabular-nums">{e.duration}</span>, sortValue: (e) => e.duration },
    { key: "reason", header: "Reason", cell: (e) => <span className="text-xs text-muted-foreground">{e.reason}</span> },
    { key: "status", header: "Status", cell: (e) => <StatusBadge tone={statusTone(e.status)}>{e.status}</StatusBadge>, sortValue: (e) => e.status },
    { key: "timestamp", header: "Time", cell: (e) => <span className="text-xs text-muted-foreground">{e.timestamp}</span>, sortValue: (e) => e.timestamp },
  ];

  return (
    <Page>
      <PageHeader
        title="Impersonation Audit Trail"
        description="All tenant impersonation and view-as sessions with operator, target, duration, and audit status."
        icon={Eye}
        actions={<Button size="sm" variant="outline"><Shield className="mr-1 h-4 w-4" /> Audit Now</Button>}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Sessions" value={totalSessions} icon={UserCheck} />
          <MetricCard label="Flagged" value={flagged} icon={AlertTriangle} tone="negative" />
          <MetricCard label="Audited" value={audited} icon={Shield} tone="warning" />
          <MetricCard label="Avg Duration" value="18m" icon={Clock} />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Shield className="h-4 w-4" /> Impersonation Audit: All sessions logged with "impersonated by" flag
          </div>
          <p className="mt-1">{entries.length} entries · {totalSessions} active sessions · All impersonation actions require two-operator approval for privilege escalation.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search operator, tenant, admin…" className="flex-1" />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No impersonation sessions found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term.</p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              pageSize={10}
              searchableText={(e) => `${e.operator} ${e.targetTenant} ${e.targetAdmin} ${e.reason}`}
              searchPlaceholder="Search impersonation log…"
              emptyTitle="No entries"
              emptyDescription="Impersonation sessions will appear here."
            />
          )}
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Audit Policy</span></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Two-operator approval</span>
              <span className="font-medium">Required for privilege escalation</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Flagged sessions</span>
              <span className="font-medium">{flagged} pending review</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-sky-500" /> Audit retention</span>
              <span className="font-medium">180 days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Session timeout</span>
              <span className="font-medium">24h inactivity</span>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
