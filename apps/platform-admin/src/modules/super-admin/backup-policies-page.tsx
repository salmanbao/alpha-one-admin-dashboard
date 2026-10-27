"use client";

/**
 * Backup Policies Page — Schedule / retention policy editor (M13 / M24).
 *
 * Stitch screen: (new)
 * Tier 1 — Backup schedules, retention windows, per-tenant overrides.
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
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  HardDrive,
  Calendar,
  Clock,
  Database,
  Save,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RefreshCw,
  Building2,
} from "lucide-react";

const demoPolicies = [
  { id: "pol-001", name: "Core Platform DB", scope: "Platform", frequency: "Every 6 hours", retentionDays: 30, keepVersions: 12, encryption: "AES-256", crossRegion: true, lastRun: "2026-10-08T12:00:00Z", nextRun: "2026-10-08T18:00:00Z", status: "active", sizeGB: 412 },
  { id: "pol-002", name: "Tenant Data Snapshots", scope: "Platform", frequency: "Daily 02:00 UTC", retentionDays: 90, keepVersions: 30, encryption: "AES-256", crossRegion: true, lastRun: "2026-10-08T02:00:00Z", nextRun: "2026-10-09T02:00:00Z", status: "active", sizeGB: 1280 },
  { id: "pol-003", name: "Audit Log Archive", scope: "Platform", frequency: "Weekly (Sun 01:00)", retentionDays: 365, keepVersions: 52, encryption: "AES-256", crossRegion: false, lastRun: "2026-10-05T01:00:00Z", nextRun: "2026-10-12T01:00:00Z", status: "active", sizeGB: 96 },
  { id: "pol-004", name: "Alpha Capital — Override", scope: "Tenant: Alpha Capital", frequency: "Every 1 hour", retentionDays: 14, keepVersions: 24, encryption: "AES-256", crossRegion: true, lastRun: "2026-10-08T14:00:00Z", nextRun: "2026-10-08T15:00:00Z", status: "active", sizeGB: 210 },
  { id: "pol-005", name: "Beta Trading — Override", scope: "Tenant: Beta Trading", frequency: "Daily 04:00 UTC", retentionDays: 30, keepVersions: 14, encryption: "AES-256", crossRegion: false, lastRun: "2026-10-08T04:00:00Z", nextRun: "2026-10-09T04:00:00Z", status: "paused", sizeGB: 145 },
  { id: "pol-006", name: "Model Weights Archive", scope: "Platform", frequency: "Monthly (1st 03:00)", retentionDays: 730, keepVersions: 24, encryption: "AES-256", crossRegion: true, lastRun: "2026-10-01T03:00:00Z", nextRun: "2026-11-01T03:00:00Z", status: "active", sizeGB: 860 },
];

const statusTones: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  failed: "danger",
};

export function BackupPoliciesPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoPolicies, { delayMs: 450 }), []);
  const policies = loadedData ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string | number | boolean>>({});

  const startEdit = (pol: (typeof demoPolicies)[0]) => {
    setEditingId(pol.id);
    setEditValues({
      frequency: pol.frequency,
      retentionDays: pol.retentionDays,
      keepVersions: pol.keepVersions,
      crossRegion: pol.crossRegion,
    });
  };

  const saveEdit = (polId: string, polName: string) => {
    toast({
      title: "Backup policy saved",
      description: `${polName}: every ${editValues.frequency}, keep ${editValues.retentionDays} days / ${editValues.keepVersions} versions.`,
    });
    setEditingId(null);
    setEditValues({});
  };

  const stats = useMemo(() => ({
    total: policies.length,
    active: policies.filter((p) => p.status === "active").length,
    totalSize: policies.reduce((s, p) => s + p.sizeGB, 0),
    tenantOverrides: policies.filter((p) => p.scope.startsWith("Tenant")).length,
  }), [policies]);

  return (
    <Page>
      <PageHeader
        title="Backup Policies"
        description="Backup schedules, retention windows, and per-tenant overrides."
        icon={HardDrive}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("backups-dr")}>
              <Database className="mr-1 h-4 w-4" /> Backups & DR
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New policy", description: "Policy form: scope, frequency, retention, encryption." })}>
              <Plus className="mr-1 h-4 w-4" /> New Policy
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
          loadingLabel="Loading backup policies…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Policies" value={stats.total} icon={HardDrive} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Protected Data" value={`${stats.totalSize.toLocaleString()} GB`} icon={Layers} />
          <MetricCard label="Tenant Overrides" value={stats.tenantOverrides} icon={Building2} />
        </div>

        {/* Policy cards */}
        <div className="grid gap-4">
          {policies.map((pol) => {
            const isEditing = editingId === pol.id;
            return (
              <Card key={pol.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-base font-semibold">{pol.name}</h2>
                      <StatusBadge tone={statusTones[pol.status]}>{pol.status}</StatusBadge>
                      <Badge variant={pol.scope.startsWith("Tenant") ? "outline" : "secondary"} className="text-[10px]">
                        {pol.scope}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditValues({}); }}>Cancel</Button>
                          <Button size="sm" onClick={() => saveEdit(pol.id, pol.name)}>
                            <Save className="mr-1 h-3 w-3" /> Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(pol)}>
                            <Calendar className="mr-1 h-3 w-3" /> Edit Schedule
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast({ title: "Backup triggered", description: `${pol.name} manual backup started.` })}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Frequency
                      </label>
                      {isEditing ? (
                        <Input
                          value={String(editValues.frequency ?? pol.frequency)}
                          onChange={(e) => setEditValues((v) => ({ ...v, frequency: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <div className="rounded-md bg-muted/50 p-2 text-sm font-medium">{pol.frequency}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Retention (days)
                      </label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={String(editValues.retentionDays ?? pol.retentionDays)}
                          onChange={(e) => setEditValues((v) => ({ ...v, retentionDays: Number(e.target.value) }))}
                          className="h-8"
                        />
                      ) : (
                        <div className="rounded-md bg-muted/50 p-2 text-lg font-bold">{pol.retentionDays}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Versions to Keep
                      </label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={String(editValues.keepVersions ?? pol.keepVersions)}
                          onChange={(e) => setEditValues((v) => ({ ...v, keepVersions: Number(e.target.value) }))}
                          className="h-8"
                        />
                      ) : (
                        <div className="rounded-md bg-muted/50 p-2 text-lg font-bold">{pol.keepVersions}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cross-Region Copy</label>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Button
                            size="sm"
                            variant={editValues.crossRegion ? "default" : "outline"}
                            className="h-8"
                            onClick={() => setEditValues((v) => ({ ...v, crossRegion: !v.crossRegion }))}
                          >
                            {editValues.crossRegion ? "Enabled" : "Disabled"}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: pol.crossRegion ? "#4a7c59" : "#74796e", color: pol.crossRegion ? "#4a7c59" : "#74796e" }}>
                            {pol.crossRegion ? "enabled" : "disabled"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-4">
                      <span>Encryption: <strong className="text-foreground">{pol.encryption}</strong></span>
                      <span>Size: <strong className="text-foreground">{pol.sizeGB} GB</strong></span>
                      <span>Last run: <strong className="text-foreground">{new Date(pol.lastRun).toLocaleString()}</strong></span>
                      <span>Next run: <strong className="text-foreground">{new Date(pol.nextRun).toLocaleString()}</strong></span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: pol.status === "active" ? "Policy paused" : "Policy resumed", description: `${pol.name} ${pol.status === "active" ? "paused" : "resumed"}. Audited.` })}>
                        {pol.status === "active" ? "Pause" : "Resume"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Run history", description: `${pol.name}: last ${pol.keepVersions} runs, all verified.` })}>
                        View Runs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
