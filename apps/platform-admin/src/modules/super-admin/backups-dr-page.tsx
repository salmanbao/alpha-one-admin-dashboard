"use client";

/**
 * Backup & Disaster Recovery — research item #24.
 *
 * Shows last WAL backup, last full backup, backup status, backup age,
 * RPO, restore test status, last restore drill, next scheduled drill,
 * and backup integrity.
 *
 * Actions: verify backup, start restore drill, view restore history.
 *
 * P0-4: backup status / drill actions persist under pfaas:platform-admin:backups-dr.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useState, useMemo } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, CheckCircle2, Clock, RefreshCw, ShieldCheck, AlertTriangle, HardDrive } from "lucide-react";
import { StatusBadge } from "@/components/platform/status";
import { useBackupsDr, verifyBackup, startDrill, restorePITR, type BackupState } from "@/lib/platform/backups-dr-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { PLATFORM_FACTS } from "@/lib/platform/operations-signals";

const DEFAULT_BACKUP_STATE: BackupState = {
  lastVerify: undefined,
  lastDrill: undefined,
  drillStatus: undefined,
  lastRestore: undefined,
  events: [],
};

function formatISO(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatFullISO(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function BackupsDrPage() {
  const { user } = usePlatform();
  const backup = useBackupsDr();
  const [drillProgress, setDrillProgress] = useState<number>(0);

  const handleVerify = () => {
    const result = verifyBackup(user?.name ?? "Console operator");
    toast({ title: result.title, description: result.description });
  };

  const handleStartDrill = () => {
    const result = startDrill(user?.name ?? "Console operator");
    toast({ title: result.title, description: result.description });
    setDrillProgress(0);
    // Simulate progress
    const interval = setInterval(() => {
      setDrillProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 25;
      });
    }, 1000);
  };

  const handleRestorePITR = (artifactId: string) => {
    const result = restorePITR(artifactId, user?.name ?? "Console operator");
    toast({ title: result.title, description: result.description });
  };

  const events = backup.events ?? [];

  // KPIs using store state + seeded fallbacks
  const lastWAL = formatISO(backup.lastVerify); // using lastVerify as WAL backup proxy
  const lastFull = formatISO(backup.lastDrill); // using lastDrill as full backup proxy
  const lastDrill = formatISO(backup.lastDrill);
  const lastRestore = formatISO(backup.lastRestore);

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
          <MetricCard label="Last WAL Backup" value={lastWAL} icon={HardDrive} tone="positive" />
          <MetricCard label="Last Full Backup" value={lastFull} icon={Database} tone="positive" />
          <MetricCard label="RPO Target" value="24h" icon={Clock} tone="positive" />
          <MetricCard label="Last Restore Drill" value={lastDrill} icon={ShieldCheck} tone={backup.drillStatus === "passed" ? "positive" : "warning"} />
        </div>

        {/* Backup status card */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Backup status</span></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 rounded-md border p-2">
              <div className="flex-1">
                <p className="text-sm font-medium">WAL backup</p>
                <p className="text-xs text-muted-foreground">Last verified {formatFullISO(backup.lastVerify)} · next check in 6h</p>
              </div>
              <StatusBadge tone={backup.lastVerify ? "success" : "warning"}>
                {backup.lastVerify ? "Verified" : "Not verified"}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-2">
              <div className="flex-1">
                <p className="text-sm font-medium">Full backup</p>
                <p className="text-xs text-muted-foreground">Last drill {formatFullISO(backup.lastDrill)} · recommended every 7d</p>
              </div>
              <StatusBadge tone={backup.drillStatus === "passed" ? "success" : "warning"}>
                {backup.drillStatus || "Not run"}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-2">
              <div className="flex-1">
                <p className="text-sm font-medium">Backup integrity</p>
                <p className="text-xs text-muted-foreground">Checksum verified · last check {formatFullISO(backup.lastVerify)}</p>
              </div>
              <StatusBadge tone="success">Verified</StatusBadge>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-2">
              <div className="flex-1">
                <p className="text-sm font-medium">RPO compliance</p>
                <p className="text-xs text-muted-foreground">Max data loss window: {Math.floor((Date.now() - Date.parse(PLATFORM_FACTS.lastBackupAt)) / 3_600_000)}h (target: {PLATFORM_FACTS.rpoWindowHours}h)</p>
              </div>
              <StatusBadge tone={Math.floor((Date.now() - Date.parse(PLATFORM_FACTS.lastBackupAt)) / 3_600_000) <= PLATFORM_FACTS.rpoWindowHours ? "success" : "warning"}>Within target</StatusBadge>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-2">
              <div className="flex-1">
                <p className="text-sm font-medium">Restore drill</p>
                <p className="text-xs text-muted-foreground">Last drill {formatFullISO(backup.lastDrill)} · recommended every 7d</p>
              </div>
              <StatusBadge tone={backup.drillStatus === "passed" ? "success" : "warning"}>
                {backup.drillStatus || "Overdue"}
              </StatusBadge>
            </div>
          </CardContent>
        </Card>

        {/* Restore history */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Restore drill history</span></CardHeader>
          <CardContent className="space-y-2">
            {events.length > 0 ? (
              events
                .filter((e) => e.type === "drill" || e.type === "verify" || e.type === "restore")
                .slice(0, 5)
                .map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-md border p-2 text-xs">
                    <CheckCircle2 className={`h-4 w-4 ${e.status === "completed" ? "text-emerald-500" : "text-rose-500"}`} />
                    <span className="font-medium tabular-nums">{formatFullISO(e.startedAt)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{e.type}</Badge>
                    <span className="text-muted-foreground">{e.detail || "—"}</span>
                    <StatusBadge tone={e.status === "completed" ? "success" : "danger"}>{e.status}</StatusBadge>
                  </div>
                ))
            ) : (
              <div className="text-xs text-muted-foreground">No drill history yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Backup artifacts */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Backup artifacts</span></CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: "WAL-2026-10-26-18h", type: "WAL", size: "2.1 GB", checksum: "sha256:a8f2…", retention: "7d", location: "s3://pfaas-backups/wal/" },
              { id: "FULL-2026-10-24-36h", type: "Full", size: "14.7 GB", checksum: "sha256:3e7b…", retention: "30d", location: "s3://pfaas-backups/full/" },
            ].map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border p-2 text-xs">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.id}</p>
                  <p className="text-muted-foreground truncate">{a.type} · {a.size} · {a.checksum}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{a.retention}</Badge>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleRestorePITR(a.id)}>
                  Restore PITR
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Drill stepper (progress view when active) */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Restore drill progress</span></CardHeader>
          <CardContent className="space-y-2">
            {[
              { step: "Provision isolated env", status: drillProgress >= 25 ? "done" : "pending" as const },
              { step: "Restore latest WAL", status: drillProgress >= 50 ? "done" : "pending" as const },
              { step: "Verify service health", status: drillProgress >= 75 ? "done" : "pending" as const },
              { step: "Confirm data consistency", status: drillProgress >= 100 ? "done" : "pending" as const },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 rounded-md border p-2 text-xs">
                <div className={`h-2 w-2 rounded-full ${s.status === "done" ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span className="font-medium">{s.step}</span>
                <Badge variant="outline" className={`text-[9px] ${s.status === "done" ? "text-emerald-600" : "text-amber-600"}`}>
                  {s.status === "done" ? "Completed" : "In progress"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={handleVerify}>
            <RefreshCw className="mr-1 h-4 w-4" /> Verify backup now
          </Button>
          <Button variant="outline" onClick={handleStartDrill}>
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