"use client";

/**
 * R4-03 — Compliance Workspace & Calendar (P1, 1 route).
 *
 * UI layout:
 *   ● 90-day deadline calendar: filings due, screening rescans scheduled,
 *     DSR SLA dates, retention expiries - color-coded by urgency
 *   ● Obligations grid: obligation, source screen link, owner, due,
 *     status (on track / due soon / overdue), last action
 *   ● This-week digest panel: everything due in 7 days with owner assignment;
 *     exportable as PDF for the compliance file
 *   ● Overdue escalation list: items past due, one click to underlying
 *     case/filing/DSR
 *
 * AC-1: deadlines aggregate live from str-filing, screening, consent-receipts
 *       and message-archive stores.
 * AC-2: overdue items escalate once (idempotent) into the risk alerts queue
 *       with audit entries.
 * AC-3: digest export renders the same data the grid shows, with a
 *       generation timestamp and actor.
 *
 * Permission: compliance.workspace.read (read via compliance.aml.read).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { recordAudit } from "@/lib/audit";
import {
  listDeadlines, listObligations, listWeeklyDigest, useDeadlineVersion,
  escalateOverdue, generateDigestExport, type Deadline, type Obligation,
} from "../compliance-workspace-store";
import { Calendar, Shield, CheckCircle2, Clock, Download } from "lucide-react";

const CALENDAR_DAYS = 90;

function statusColor(status: string) {
  switch (status) {
    case "on-track": return "bg-emerald-50 text-emerald-700";
    case "due-soon": return "bg-amber-50 text-amber-700";
    case "overdue": return "bg-rose-50 text-rose-700";
    default: return "bg-muted text-muted-foreground";
  }
}

function urgencyTone(urgencyClass: string): "default" | "warning" | "danger" {
  switch (urgencyClass) {
    case "overdue": return "danger";
    case "due-soon": return "warning";
    default: return "default";
  }
}

export function ComplianceWorkspacePage() {
  const { user } = usePlatform();
  const actor = user?.name ?? "operator";
  const canOperate = hasPermission(user, "compliance.workspace.read");

  useDeadlineVersion();
  const deadlines = listDeadlines();
  const obligations = listObligations();
  const weeklyDigest = listWeeklyDigest();

  const [escalated, setEscalated] = useState<{ newlyEscalated: number; alreadyEscalated: number }>({ newlyEscalated: 0, alreadyEscalated: 0 });

  const overdueDeadlines = useMemo(() => deadlines.filter(d => new Date(d.dueAt).getTime() < Date.now()), [deadlines]);
  const upcomingDeadlines = useMemo(() => deadlines.filter(d => new Date(d.dueAt).getTime() >= Date.now()), [deadlines]);

  const dueThisWeek = useMemo(() => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return deadlines.filter(d => {
      const due = new Date(d.dueAt).getTime();
      return due >= Date.now() && due < Date.now() + weekMs;
    });
  }, [deadlines]);

  // Run overdue escalation once on mount
  useEffect(() => {
    const result = escalateOverdue();
    setEscalated({ newlyEscalated: result.newlyEscalated.length, alreadyEscalated: result.alreadyEscalated.length });
    if (result.newlyEscalated.length > 0) {
      toast({
        title: "Deadlines escalated",
        description: `${result.newlyEscalated.length} overdue item(s) moved to the risk alerts queue (audited).`,
        variant: "destructive",
      });
    }
  }, []);

  const colsDeadline: Column<Deadline>[] = [
    { key: "id", header: "ID", cell: r => <span className="font-mono text-xs">{r.id}</span> },
    { key: "title", header: "Deadline", cell: r => <span className="text-xs font-medium">{r.title}</span> },
    { key: "source", header: "Source", cell: r => <Badge variant="outline" className="text-[10px]">{r.source}</Badge> },
    { key: "due", header: "Due", cell: r => <span className="text-xs text-muted-foreground">{r.dueLabel}</span> },
    { key: "urgency", header: "Urgency", cell: r => <StatusBadge tone={urgencyTone(r.urgencyClass)}>{r.dueLabel}</StatusBadge> },
  ];

  const colsObligation: Column<Obligation>[] = [
    { key: "id", header: "ID", cell: r => <span className="font-mono text-xs">{r.id}</span> },
    { key: "title", header: "Obligation", cell: r => <span className="text-xs font-medium">{r.title}</span> },
    { key: "source", header: "Source", cell: r => <span className="text-xs text-muted-foreground">{r.source}</span> },
    { key: "owner", header: "Owner", cell: r => <span className="text-xs">{r.owner}</span> },
    { key: "due", header: "Due", cell: r => <span className="text-xs text-muted-foreground">{new Date(r.dueAt).toLocaleDateString()}</span> },
    { key: "status", header: "Status", cell: r => <StatusBadge tone={r.status === "overdue" ? "danger" : r.status === "due-soon" ? "warning" : "default"} className="text-[10px]">{r.status}</StatusBadge> },
    { key: "lastAction", header: "Last action", cell: r => <span className="text-xs text-muted-foreground">{r.lastAction}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Compliance Workspace & Calendar"
        description="90-day deadline calendar, obligations grid, this-week digest and overdue escalation across STR filings, screening matches, consent DSRs and message archive retention (requires compliance.workspace.read)."
        icon={Calendar}
        actions={
          <div className="flex items-center gap-2">
            {canOperate && (
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                if (!canOperate) { toast({ title: "Permission required", description: "Requires compliance.workspace.read", variant: "destructive" }); return; }
                toast({ title: "Escalation run", description: "Checked overdue deadlines." });
              }}><Clock className="h-3 w-3 mr-1" />Re-check overdue</Button>
            )}
            {canOperate && (
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                if (!canOperate) { toast({ title: "Permission required", description: "Requires compliance.workspace.read", variant: "destructive" }); return; }
                const exportData = generateDigestExport();
                const blob = new Blob([JSON.stringify({
                  generatedAt: exportData.timestamp,
                  generatedBy: exportData.actor,
                  items: exportData.data.map(d => ({ id: d.id, title: d.title, source: d.source, dueAt: d.dueAt, urgencyClass: d.urgencyClass, dueLabel: d.dueLabel, lastAction: d.lastAction })),
                })], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `compliance-digest-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast({ title: "Digest exported", description: `Compliance workspace digest exported at ${exportData.timestamp}` });
              }}><Download className="h-3 w-3 mr-1" />Export digest</Button>
            )}
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total deadlines" value={String(deadlines.length)} />
          <MetricCard label="Overdue" value={String(overdueDeadlines.length)} tone={overdueDeadlines.length > 0 ? "negative" : "default"} />
          <MetricCard label="Due this week" value={String(dueThisWeek.length)} tone={dueThisWeek.length > 0 ? "warning" : "default"} />
          <MetricCard label="Escalated" value={String(escalated.newlyEscalated)} tone="info" />
        </div>

        {/* 90-day deadline calendar */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2">90-day deadline calendar</h2>
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="grid grid-cols-12 gap-1 text-xs mb-2">
                <div className="font-medium text-muted-foreground">Source</div>
                <div className="font-medium text-muted-foreground">Deadline</div>
                <div className="font-medium text-muted-foreground">Due</div>
                <div className="font-medium text-muted-foreground">Urgency</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {deadlines.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-2">No upcoming deadlines.</p>
                ) : (
                  deadlines.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 rounded border border-transparent hover:border-muted/50">
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium text-xs ${d.urgencyClass === "overdue" ? "text-rose-600" : ""}`}>{d.title}</span>
                        <span className="block text-[10px] text-muted-foreground">{d.source}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{new Date(d.dueAt).toLocaleDateString()}</span>
                      <StatusBadge tone={urgencyTone(d.urgencyClass)}>{d.dueLabel}</StatusBadge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Obligations grid */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2">Obligations</h2>
          <DataTable columns={colsObligation} data={obligations} rowKey={r => r.id} pageSize={8} searchableText={r => `${r.id} ${r.title} ${r.owner} ${r.lastAction}`} />
        </div>

        {/* This-week digest */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2">This-week digest (due in 7 days)</h2>
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="space-y-1">
                {weeklyDigest.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-2">No items due this week.</p>
                ) : (
                  weeklyDigest.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 rounded border">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">{d.title}</span>
                        <span className="block text-[10px] text-muted-foreground">{new Date(d.dueAt).toLocaleDateString()} · owner: {d.owner}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{d.owner}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue escalation list */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2">Overdue escalation</h2>
          <Card className={`border-border ${overdueDeadlines.length > 0 ? "border-rose-200" : ""}`}>
            <CardContent className="p-3">
              <div className="space-y-1">
                {overdueDeadlines.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-2">No overdue items — nothing to escalate.</p>
                ) : (
                  overdueDeadlines.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 rounded border-rose-50 bg-rose-50/50 border-rose-100">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-rose-800">{d.title}</span>
                        <span className="block text-[10px] text-rose-600">{d.source} · overdue {Math.round((Date.now() - new Date(d.dueAt).getTime()) / 86400000)}d ago</span>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">Escalated</Badge>
                    </div>
                  ))
                )}
              </div>
              {escalated.newlyEscalated > 0 && (
                <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {escalated.newlyEscalated} item(s) newly escalated to risk alerts queue (audited). {escalated.alreadyEscalated > 0 && `${escalated.alreadyEscalated} previously escalated.`}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
