"use client";

/**
 * Scheduled Reports Page — Auto-delivered analytics/finance reports (M13 Automation).
 *
 * Stitch screen: (new)
 * Tier 3 — Report schedules (frequency, recipients, format), run history.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  listSchedules,
  runSchedule,
  pauseSchedule,
  resumeSchedule,
  createSchedule,
  downloadLastRun,
  useSchedulesVersion,
} from "@/lib/platform/report-schedules-store";
import {
  CalendarClock,
  Plus,
  Play,
  Pause,
  Mail,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  BarChart3,
} from "lucide-react";

const categoryMeta: Record<string, { icon: typeof FileText; color: string }> = {
  finance: { icon: BarChart3, color: "#705c30" },
  analytics: { icon: FileText, color: "#4a7c59" },
  growth: { icon: BarChart3, color: "#6b6358" },
};

const statusTones: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  failed: "danger",
  delivered: "success",
};

export function ScheduledReportsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the persisted
  // schedule store is authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 450 }), []);
  useSchedulesVersion();
  const schedules = listSchedules();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const handleRun = (id: string) => {
    const sch = runSchedule(id);
    if (sch) toast({ title: "Report generated", description: `${sch.name} generated and queued for ${sch.recipients.length} recipient(s).` });
  };

  const handleToggle = (id: string) => {
    const current = schedules.find((s) => s.id === id);
    if (!current) return;
    const next = current.status === "active" ? pauseSchedule(id) : resumeSchedule(id);
    if (!next) return;
    toast({
      title: next.status === "active" ? "Schedule resumed" : "Schedule paused",
      description: `${next.name} ${next.status === "active" ? "resumed" : "paused"}.`,
    });
  };

  const handleDownload = (id: string) => {
    const sch = downloadLastRun(id);
    if (sch) toast({ title: "Download started", description: `Fetching last generated file for ${sch.name}.` });
  };

  const handleNewSchedule = () => {
    const sch = createSchedule({
      name: "Untitled schedule",
      category: "analytics",
      frequency: "Weekly (Mon 07:00 UTC)",
      recipients: ["platform@pfaas.com"],
      format: "CSV",
    });
    toast({ title: "Schedule created", description: `"${sch.name}" created and active.` });
  };

  const filtered = useMemo(() => {
    return schedules.filter((s) => categoryFilter === "all" || s.category === categoryFilter);
  }, [schedules, categoryFilter]);

  const stats = useMemo(() => ({
    total: schedules.length,
    active: schedules.filter((s) => s.status === "active").length,
    failedDeliveries: schedules.filter((s) => s.lastDelivery === "failed").length,
    recipients: new Set(schedules.flatMap((s) => s.recipients)).size,
  }), [schedules]);

  return (
    <Page>
      <PageHeader
        title="Scheduled Reports"
        description="Auto-delivered analytics and finance reports."
        icon={CalendarClock}
        actions={
          <Button size="sm" onClick={handleNewSchedule}>
            <Plus className="mr-1 h-4 w-4" /> New Schedule
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading schedules…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Schedules" value={stats.total} icon={CalendarClock} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Failed Deliveries" value={stats.failedDeliveries} icon={AlertTriangle} tone={stats.failedDeliveries > 0 ? "negative" : "positive"} />
          <MetricCard label="Recipients" value={stats.recipients} icon={Mail} />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Category:</span>
          <Button size="sm" variant={categoryFilter === "all" ? "default" : "outline"} onClick={() => setCategoryFilter("all")}>All</Button>
          <Button size="sm" variant={categoryFilter === "finance" ? "default" : "outline"} onClick={() => setCategoryFilter("finance")} className="text-[10px] capitalize">Finance</Button>
          <Button size="sm" variant={categoryFilter === "analytics" ? "default" : "outline"} onClick={() => setCategoryFilter("analytics")} className="text-[10px] capitalize">Analytics</Button>
          <Button size="sm" variant={categoryFilter === "growth" ? "default" : "outline"} onClick={() => setCategoryFilter("growth")} className="text-[10px] capitalize">Growth</Button>
        </div>

        {/* Schedules table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipients</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Run</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Run</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((sch) => {
                    const meta = categoryMeta[sch.category];
                    const Icon = meta?.icon ?? FileText;
                    return (
                      <tr key={sch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 shrink-0 rounded flex items-center justify-center" style={{ background: `${meta?.color ?? "#6b6358"}20`, color: meta?.color ?? "#6b6358" }}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{sch.name}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] capitalize" style={{ borderColor: meta?.color, color: meta?.color }}>{sch.category}</Badge>
                                <StatusBadge tone={sch.lastDelivery === "failed" ? "danger" : "success"}>last: {sch.lastDelivery}</StatusBadge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{sch.frequency}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {sch.recipients.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[9px]">{r}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{sch.format}</Badge></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sch.lastRun).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sch.nextRun).toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge tone={statusTones[sch.status]}>{sch.status}</StatusBadge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => handleRun(sch.id)}>
                              <Play className="h-3 w-3" /> Run Now
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => handleToggle(sch.id)}>
                              {sch.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => handleDownload(sch.id)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 font-medium">No schedules in this category</p>
                  <p className="text-sm text-muted-foreground">Try a different filter or create a new schedule.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}

// AlertTriangle used in MetricCard
import { AlertTriangle } from "lucide-react";
