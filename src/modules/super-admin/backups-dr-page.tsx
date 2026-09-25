"use client";

/**
 * Backup & Disaster Recovery — research item #24.
 *
 * Shows last WAL backup, last full backup, backup status, backup age,
 * RPO, restore test status, last restore drill, next scheduled drill,
 * and backup integrity.
 *
 * Actions: verify backup, start restore drill, view restore history.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Database, CheckCircle2, Clock, RefreshCw, ShieldCheck, AlertTriangle, HardDrive } from "lucide-react";

export function BackupsDrPage() {
  return (
    <Page>
      <PageHeader
        title="Backups & Disaster Recovery"
        description="Backup status, RPO compliance, restore drill history, and backup integrity."
        icon={Database}
      />
      <PageContent>
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Last WAL Backup" value="18h ago" icon={HardDrive} tone="positive" />
          <MetricCard label="Last Full Backup" value="2d ago" icon={Database} tone="positive" />
          <MetricCard label="RPO Target" value="24h" icon={Clock} tone="positive" />
          <MetricCard label="Last Restore Drill" value="14d ago" icon={ShieldCheck} tone="warning" />
        </div>

        {/* Backup status card */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Backup status</span></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "WAL backup", status: "Current", detail: "Last run 18h ago · 2.1 GB · next in 6h", tone: "success" as const },
              { label: "Full backup", status: "Current", detail: "Last run 2d ago · 14.7 GB · next in 5d", tone: "success" as const },
              { label: "Backup integrity", status: "Verified", detail: "Checksum verified · last check 1h ago", tone: "success" as const },
              { label: "RPO compliance", status: "Within target", detail: "Max data loss window: 18h (target: 24h)", tone: "success" as const },
              { label: "Restore drill", status: "Overdue", detail: "Last drill 14d ago · recommended every 7d", tone: "warning" as const },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-3 rounded-md border p-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">{b.detail}</p>
                </div>
                <StatusBadge tone={b.tone}>{b.status}</StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Restore history */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Restore drill history</span></CardHeader>
          <CardContent className="space-y-2">
            {[
              { date: "14d ago", type: "Full restore", status: "success", duration: "3m 42s", note: "All services verified" },
              { date: "21d ago", type: "PITR drill", status: "success", duration: "1m 18s", note: "Recovered to T-2h" },
              { date: "28d ago", type: "Full restore", status: "success", duration: "4m 12s", note: "All services verified" },
            ].map((r) => (
              <div key={r.date} className="flex items-center gap-3 rounded-md border p-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium tabular-nums">{r.date}</span>
                <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                <span className="text-muted-foreground">{r.duration}</span>
                <span className="flex-1 text-muted-foreground">{r.note}</span>
                <StatusBadge tone="success">Passed</StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="default">
            <RefreshCw className="mr-1 h-4 w-4" /> Verify backup now
          </Button>
          <Button variant="outline">
            <ShieldCheck className="mr-1 h-4 w-4" /> Start restore drill
          </Button>
        </div>

        {/* RPO notice */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 dark:bg-amber-950/10">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Restore drill overdue
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The last restore drill was 14 days ago. The recommended cadence is every 7 days. Running a drill verifies that backups can be restored and that all services recover correctly. The drill runs in an isolated environment and does not affect production data.
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
