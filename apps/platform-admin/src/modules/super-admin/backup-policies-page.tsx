"use client";

/**
 * Backup Policies Page — Schedule / retention policy editor (M13 / M24).
 *
 * Stitch screen: (new)
 * Tier 1 — Backup schedules, retention windows, per-tenant overrides.
 */

import { useState, useMemo } from "react";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  useBackupPolicies,
  savePolicy,
  pausePolicy,
  type BackupPolicy,
} from "@/lib/platform/backup-policies-store";
import {
  HardDrive,
  Calendar,
  Clock,
  Database,
  Save,
  Plus,
  Layers,
  RefreshCw,
  Building2,
  CheckCircle2,
} from "lucide-react";

export function BackupPoliciesPage() {
  const { navigate } = usePlatform();
  const policies = useBackupPolicies();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    frequency?: string;
    retentionDays?: number;
    keepVersions?: number;
    crossRegion?: boolean;
  }>({});

  const startEdit = (pol: BackupPolicy) => {
    setEditingId(pol.id);
    setEditValues({
      frequency: pol.frequency,
      retentionDays: pol.retentionDays,
      keepVersions: pol.keepVersions,
      crossRegion: pol.crossRegion,
    });
  };

  const saveEdit = (polId: string, name: string) => {
    const existing = policies.find((p) => p.id === polId);
    if (!existing) return;
    savePolicy({
      ...existing,
      frequency: editValues.frequency ?? existing.frequency,
      retentionDays: editValues.retentionDays ?? existing.retentionDays,
      keepVersions: editValues.keepVersions ?? existing.keepVersions,
      crossRegion: editValues.crossRegion ?? existing.crossRegion,
      status: existing.status,
      lastRun: existing.lastRun,
      nextRun: existing.nextRun,
      sizeGB: existing.sizeGB,
    });
    toast({
      title: "Backup policy saved",
      description: `${name}: every ${editValues.frequency}, keep ${editValues.retentionDays} days / ${editValues.keepVersions} versions.`,
    });
    setEditingId(null);
    setEditValues({});
  };

  const handleTogglePause = (polId: string, name: string, currentStatus: string) => {
    if (currentStatus === "active") {
      pausePolicy(polId);
      toast({ title: "Policy paused", description: `${name} paused. Audited.` });
    } else {
      pausePolicy(polId);
      toast({ title: "Policy resumed", description: `${name} resumed. Audited.` });
    }
  };

  const handleCreatePolicy = () => {
    const newPolicy = {
      id: `pol-${Date.now().toString(36)}`,
      name: "New Policy",
      scope: "Platform",
      frequency: "Daily 02:00 UTC",
      retentionDays: 30,
      keepVersions: 12,
      encryption: "AES-256",
      crossRegion: true,
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active" as const,
      sizeGB: 0,
    };
    savePolicy(newPolicy);
    toast({ title: "Policy created", description: `${newPolicy.name} created with spec 24h/30d/12v.` });
  };

  const handleTriggerBackup = (name: string) => {
    toast({ title: "Manual backup triggered", description: `${name} backup started.` });
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
            <Button size="sm" onClick={handleCreatePolicy}>
              <Plus className="mr-1 h-4 w-4" /> New Policy
            </Button>
          </>
        }
      />
      <PageContent>
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
                      <StatusBadge tone={pol.status === "active" ? "success" : pol.status === "paused" ? "warning" : "danger"}>
                        {pol.status}
                      </StatusBadge>
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
                          <Button size="sm" variant="ghost" onClick={() => handleTriggerBackup(pol.name)}>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </Page>
  );
}