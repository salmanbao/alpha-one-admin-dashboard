"use client";

/**
 * Reports — research item #40.
 *
 * Report workspace: recent reports, saved reports, scheduled reports,
 * generate report with date range + filters.
 *
 * Report states: Requested → Processing → Ready → Downloaded.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Label } from "@/components/ui/label";
import { FileText, Download, Clock, CheckCircle2, Plus, Calendar, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Report {
  id: string;
  name: string;
  type: string;
  dateRange: string;
  status: "requested" | "processing" | "ready" | "downloaded";
  format: "CSV" | "PDF";
  requestedAt: string;
  requestedBy: string;
}

const reports: Report[] = [
  { id: "RPT-001", name: "Monthly Revenue Summary", type: "Financial", dateRange: "Aug 2026", status: "ready", format: "PDF", requestedAt: "2d ago", requestedBy: "Sarah Chen" },
  { id: "RPT-002", name: "Trader Activity Log", type: "Operations", dateRange: "Last 7d", status: "ready", format: "CSV", requestedAt: "3d ago", requestedBy: "Marcus Webb" },
  { id: "RPT-003", name: "Risk Cases Summary", type: "Risk", dateRange: "Last 30d", status: "downloaded", format: "PDF", requestedAt: "5d ago", requestedBy: "Sarah Chen" },
  { id: "RPT-004", name: "KYC Compliance Report", type: "Compliance", dateRange: "Aug 2026", status: "processing", format: "PDF", requestedAt: "10m ago", requestedBy: "Priya Nair" },
  { id: "RPT-005", name: "Payout Reconciliation", type: "Finance", dateRange: "Last 30d", status: "requested", format: "CSV", requestedAt: "2m ago", requestedBy: "Daniel Cooper" },
  { id: "RPT-006", name: "Challenge Pass Rate Analysis", type: "Analytics", dateRange: "Q3 2026", status: "ready", format: "PDF", requestedAt: "1w ago", requestedBy: "Sarah Chen" },
];

const reportTypes = [
  "Financial Summary", "Trader Activity", "Risk Cases", "KYC Compliance",
  "Payout Reconciliation", "Challenge Analytics", "Account Lifecycle",
  "Affiliate Performance", "Custom Report",
];

const statusTone = (s: Report["status"]) =>
  s === "ready" ? "success" : s === "processing" ? "info" : s === "downloaded" ? "muted" : "warning";

export function ReportsPage() {
  const [showForm, setShowForm] = useState(false);
  const [reportType, setReportType] = useState(reportTypes[0]);
  const [dateRange, setDateRange] = useState("30");

  const ready = reports.filter((r) => r.status === "ready").length;
  const processing = reports.filter((r) => r.status === "processing").length;

  return (
    <Page>
      <PageHeader title="Reports" description="Generate, schedule, and download business reports." icon={FileText}
        actions={<Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="mr-1 h-4 w-4" /> Generate report</Button>} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Reports" value={reports.length} icon={FileText} />
          <MetricCard label="Ready" value={ready} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Processing" value={processing} icon={Clock} tone={processing > 0 ? "warning" : "positive"} />
          <MetricCard label="Scheduled" value={2} icon={Calendar} />
        </div>

        {showForm && (
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Generate new report</span></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Report type</Label>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {reportTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Date range</Label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="month">This month</option>
                  <option value="quarter">This quarter</option>
                  <option value="year">This year</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setShowForm(false); toast({ title: "Report requested", description: `${reportType} for last ${dateRange} days. You'll be notified when it's ready.` }); }}>
                  <FileText className="mr-1 h-3.5 w-3.5" /> Request report
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="rounded-md bg-muted p-2"><FileText className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{r.name}</p>
                    <Badge variant="outline" className="text-[10px]">{r.format}</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                    <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.dateRange} · Requested {r.requestedAt} by {r.requestedBy} · <span className="font-mono">{r.id}</span>
                  </p>
                </div>
                {r.status === "ready" && (
                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Download started", description: `${r.name} (${r.format}) downloading…` })}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Download
                  </Button>
                )}
                {r.status === "processing" && (
                  <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400"><Clock className="mr-1 h-3 w-3" /> Processing…</Badge>
                )}
                {r.status === "requested" && (
                  <Badge variant="outline" className="text-[10px]"><Clock className="mr-1 h-3 w-3" /> Queued</Badge>
                )}
                {r.status === "downloaded" && (
                  <Badge variant="outline" className="text-[10px]"><CheckCircle2 className="mr-1 h-3 w-3" /> Downloaded</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Scheduled reports</span></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Monthly Revenue Summary</span>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">Monthly</Badge><span className="text-muted-foreground">Next: Oct 1</span></div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Weekly Risk Cases Summary</span>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">Weekly</Badge><span className="text-muted-foreground">Next: Mon</span></div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
