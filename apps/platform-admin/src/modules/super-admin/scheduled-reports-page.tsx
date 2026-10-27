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

const demoSchedules = [
  { id: "sch-001", name: "Weekly Revenue Digest", category: "finance", frequency: "Weekly (Mon 07:00 UTC)", recipients: ["finance@pfaas.com", "ceo@pfaas.com"], format: "PDF + CSV", lastRun: "2026-10-06T07:00:00Z", nextRun: "2026-10-13T07:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-002", name: "Daily Tenant Usage Meter", category: "analytics", frequency: "Daily 06:00 UTC", recipients: ["ops@pfaas.com"], format: "CSV", lastRun: "2026-10-08T06:00:00Z", nextRun: "2026-10-09T06:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-003", name: "Monthly Churn & Retention", category: "growth", frequency: "Monthly (1st 08:00)", recipients: ["growth@pfaas.com"], format: "PDF", lastRun: "2026-10-01T08:00:00Z", nextRun: "2026-11-01T08:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-004", name: "Payout Reconciliation", category: "finance", frequency: "Daily 23:00 UTC", recipients: ["finance@pfaas.com", "treasury@pfaas.com"], format: "CSV", lastRun: "2026-10-07T23:00:00Z", nextRun: "2026-10-08T23:00:00Z", status: "active", lastDelivery: "failed" },
  { id: "sch-005", name: "Quarterly Board Metrics", category: "analytics", frequency: "Quarterly (1st 09:00)", recipients: ["board@pfaas.com"], format: "PDF", lastRun: "2026-07-01T09:00:00Z", nextRun: "2027-01-01T09:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-006", name: "API Usage Export", category: "analytics", frequency: "Weekly (Fri 18:00)", recipients: ["platform@pfaas.com"], format: "CSV", lastRun: "2026-10-02T18:00:00Z", nextRun: "2026-10-09T18:00:00Z", status: "paused", lastDelivery: "delivered" },
];

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
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoSchedules, { delayMs: 450 }), []);
  const schedules = loadedData ?? [];
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
          <Button size="sm" onClick={() => toast({ title: "New schedule", description: "Schedule form: report type, frequency, recipients, format." })}>
            <Plus className="mr-1 h-4 w-4" /> New Schedule
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
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
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Report generated", description: `${sch.name} generated and queued for ${sch.recipients.length} recipient(s).` })}>
                              <Play className="h-3 w-3" /> Run Now
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: sch.status === "active" ? "Schedule paused" : "Schedule resumed", description: `${sch.name} ${sch.status === "active" ? "paused" : "resumed"}. Audited.` })}>
                              {sch.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Download", description: `Fetching last generated file for ${sch.name}.` })}>
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
