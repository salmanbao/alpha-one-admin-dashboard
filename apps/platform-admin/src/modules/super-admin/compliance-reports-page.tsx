"use client";

/**
 * Compliance Reports Page — SOC2/GDPR compliance reporting (M23).
 *
 * Stitch screen: (new)
 * Tier 1 — Report generator, schedule builder, export actions.
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  FileCheck,
  Plus,
  Download,
  Play,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  Activity,
  RefreshCw,
  Eye,
  Send,
} from "lucide-react";

const demoReports = [
  { id: "rpt-001", name: "SOC2 Type II — Q4 2026", type: "soc2", period: "2026-07-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T10:00:00Z", fileSize: "2.4 MB", sections: ["Access Controls", "Availability", "Confidentiality", "Security"], schedule: null },
  { id: "rpt-002", name: "GDPR Data Processing — Oct 2026", type: "gdpr", period: "2026-10-01 to 2026-10-31", status: "generating", generatedAt: null, fileSize: null, sections: ["Data Inventory", "Processing Activities", "Third Country Transfers"], schedule: null },
  { id: "rpt-003", name: "PCI DSS — Monthly Compliance", type: "pci", period: "2026-10-01 to 2026-10-31", status: "scheduled", generatedAt: null, fileSize: null, sections: ["Network Security", "Access Control", "Monitoring"], schedule: "Monthly, 1st day 02:00 UTC" },
  { id: "rpt-004", name: "Internal Audit — Security Controls", type: "custom", period: "2026-09-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T14:30:00Z", fileSize: "1.8 MB", sections: ["Authentication", "Authorization", "Encryption", "Logging"], schedule: null },
  { id: "rpt-005", name: "SOC2 Type II — Q3 2026", type: "soc2", period: "2026-04-01 to 2026-06-30", status: "completed", generatedAt: "2026-07-01T10:00:00Z", fileSize: "2.3 MB", sections: ["Access Controls", "Availability", "Confidentiality", "Security"], schedule: null },
  { id: "rpt-006", name: "GDPR Data Processing — Sep 2026", type: "gdpr", period: "2026-09-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T09:00:00Z", fileSize: "890 KB", sections: ["Data Inventory", "Processing Activities"], schedule: null },
];

const demoSchedules = [
  { id: "sch-001", name: "Monthly PCI DSS", type: "pci", frequency: "Monthly", nextRun: "2026-11-01T02:00:00Z", enabled: true, delivery: "Email to compliance@" },
  { id: "sch-002", name: "Quarterly SOC2", type: "soc2", frequency: "Quarterly", nextRun: "2027-01-01T02:00:00Z", enabled: true, delivery: "Email + S3 Archive" },
  { id: "sch-003", name: "GDPR Monthly", type: "gdpr", frequency: "Monthly", nextRun: "2026-11-01T03:00:00Z", enabled: false, delivery: "Email to dpo@" },
];

const typeColors: Record<string, string> = {
  soc2: "#4a7c59",
  gdpr: "#705c30",
  pci: "#b83230",
  hipaa: "#6b6358",
  custom: "#74796e",
};

const statusTones: Record<string, "success" | "warning" | "info" | "danger"> = {
  completed: "success",
  generating: "info",
  scheduled: "warning",
  failed: "danger",
};

export function ComplianceReportsPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ reports: demoReports, schedules: demoSchedules }), { delayMs: 500 }), []);
  const data = loadedData ?? { reports: [], schedules: [] };
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showSchedules, setShowSchedules] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Report generation + schedule creation (finding #10) — real forms
  // layered over the async fixture data. Deterministic: IDs derive from
  // list position, next-run dates come from a fixed lookup (no clocks).
  const [extraReports, setExtraReports] = useState<typeof demoReports>([]);
  const [extraSchedules, setExtraSchedules] = useState<typeof demoSchedules>([]);
  const [genOpen, setGenOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [genType, setGenType] = useState("soc2");
  const [genPeriod, setGenPeriod] = useState("2026-10-01 to 2026-10-31");
  const [genSections, setGenSections] = useState<string[]>(["Access Controls", "Security"]);
  const [schedName, setSchedName] = useState("");
  const [schedType, setSchedType] = useState("soc2");
  const [schedFrequency, setSchedFrequency] = useState("Monthly");
  const [schedDelivery, setSchedDelivery] = useState("Email to compliance@");

  const allReports = [...extraReports, ...data.reports];
  const allSchedules = [...data.schedules, ...extraSchedules];

  const SECTION_OPTIONS = ["Access Controls", "Availability", "Confidentiality", "Security", "Data Inventory", "Processing Activities", "Network Security", "Monitoring"];

  const generateReport = () => {
    const id = `rpt-${String(demoReports.length + extraReports.length + 1).padStart(3, "0")}`;
    const typeName = genType === "soc2" ? "SOC2" : genType === "gdpr" ? "GDPR" : genType === "pci" ? "PCI DSS" : genType === "hipaa" ? "HIPAA" : "Custom";
    setExtraReports((prev) => [
      {
        id,
        name: `${typeName} — ${genPeriod.split(" to ")[0]}`,
        type: genType,
        period: genPeriod,
        status: "generating",
        generatedAt: null,
        fileSize: null,
        sections: genSections.length > 0 ? genSections : ["Security"],
        schedule: null,
      },
      ...prev,
    ]);
    setGenOpen(false);
    toast({ title: "(demo) Report generation started", description: `${typeName} for ${genPeriod} — ${genSections.length} sections. It will appear as completed once processing finishes.` });
  };

  const addSchedule = () => {
    const name = schedName.trim() || `${schedFrequency} ${schedType.toUpperCase()}`;
    const id = `sch-${String(demoSchedules.length + extraSchedules.length + 1).padStart(3, "0")}`;
    // Deterministic next-run per frequency (fixed fixture dates).
    const nextRunByFreq: Record<string, string> = {
      Weekly: "2026-11-08T02:00:00Z",
      Monthly: "2026-12-01T02:00:00Z",
      Quarterly: "2027-01-01T02:00:00Z",
      Annually: "2027-01-01T02:00:00Z",
    };
    setExtraSchedules((prev) => [
      ...prev,
      { id, name, type: schedType, frequency: schedFrequency, nextRun: nextRunByFreq[schedFrequency] ?? "2026-12-01T02:00:00Z", enabled: true, delivery: schedDelivery },
    ]);
    setSchedOpen(false);
    setSchedName("");
    setShowSchedules(true);
    toast({ title: "(demo) Schedule created", description: `${name} — ${schedFrequency}, ${schedDelivery}.` });
  };

  const filtered = useMemo(() => {
    return allReports.filter((rpt) => {
      const matchesType = typeFilter === "all" || rpt.type === typeFilter;
      return matchesType;
    });
  }, [allReports, typeFilter]);

  const stats = useMemo(() => ({
    total: allReports.length,
    completed: allReports.filter((r) => r.status === "completed").length,
    generating: allReports.filter((r) => r.status === "generating").length,
    scheduled: allReports.filter((r) => r.status === "scheduled").length,
    activeSchedules: allSchedules.filter((s) => s.enabled).length,
  }), [allReports, allSchedules]);

  const selectedRpt = allReports.find((r) => r.id === selectedReport);

  return (
    <Page>
      <PageHeader
        title="Compliance Reports"
        description="Generate and schedule SOC2, GDPR, and custom compliance reports."
        icon={FileCheck}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowSchedules(!showSchedules)}>
              <Calendar className="mr-1 h-4 w-4" /> {showSchedules ? "Hide" : "Show"} Schedules
            </Button>
            <Button size="sm" onClick={() => setGenOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Generate Report
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
          loadingLabel="Loading compliance reports…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Reports" value={stats.total} icon={FileText} />
          <MetricCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="positive" />
          <MetricCard label="In Progress" value={stats.generating + stats.scheduled} icon={Clock} tone="warning" />
          <MetricCard label="Active Schedules" value={stats.activeSchedules} icon={Calendar} />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Type:</span>
          <Button size="sm" variant={typeFilter === "all" ? "default" : "outline"} onClick={() => setTypeFilter("all")}>All</Button>
          <Button size="sm" variant={typeFilter === "soc2" ? "default" : "outline"} onClick={() => setTypeFilter("soc2")} className="text-[10px]">SOC2</Button>
          <Button size="sm" variant={typeFilter === "gdpr" ? "default" : "outline"} onClick={() => setTypeFilter("gdpr")} className="text-[10px]">GDPR</Button>
          <Button size="sm" variant={typeFilter === "pci" ? "default" : "outline"} onClick={() => setTypeFilter("pci")} className="text-[10px]">PCI DSS</Button>
          <Button size="sm" variant={typeFilter === "custom" ? "default" : "outline"} onClick={() => setTypeFilter("custom")} className="text-[10px]">Custom</Button>
        </div>

        {/* Reports table */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Reports</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((rpt) => (
                    <tr key={rpt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm">{rpt.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] uppercase" style={{ borderColor: typeColors[rpt.type], color: typeColors[rpt.type] }}>
                          {rpt.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{rpt.period}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {rpt.sections.slice(0, 2).map((sec) => (
                            <Badge key={sec} variant="secondary" className="text-[9px]">{sec}</Badge>
                          ))}
                          {rpt.sections.length > 2 && (
                            <Badge variant="secondary" className="text-[9px]">+{rpt.sections.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {rpt.generatedAt ? new Date(rpt.generatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{rpt.fileSize ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTones[rpt.status]}>{rpt.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setSelectedReport(rpt.id)}>
                            <Eye className="h-3 w-3" /> View
                          </Button>
                          {rpt.status === "completed" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "(demo) Download started", description: `${rpt.name} PDF download initiated.` })}>
                              <Download className="h-3 w-3" /> Download
                            </Button>
                          )}
                          {rpt.status === "scheduled" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "(demo) Run now", description: `Triggering ${rpt.name} generation.` })}>
                              <Play className="h-3 w-3" /> Run Now
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Schedules */}
        {showSchedules && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Scheduled Reports</h2>
                <Button size="sm" onClick={() => setSchedOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Add Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequency</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Run</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allSchedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-sm">{sch.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] uppercase" style={{ borderColor: typeColors[sch.type], color: typeColors[sch.type] }}>
                            {sch.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">{sch.frequency}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sch.nextRun).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{sch.delivery}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={sch.enabled ? "success" : "warning"}>{sch.enabled ? "enabled" : "disabled"}</StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: sch.enabled ? "Schedule disabled" : "Schedule enabled", description: `${sch.name} ${sch.enabled ? "disabled" : "enabled"}.` })}>
                              {sch.enabled ? "Disable" : "Enable"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "(demo) Run now", description: `Triggering ${sch.name} report generation.` })}>
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report detail */}
        {selectedRpt && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedRpt.name}</h2>
                <Button size="sm" variant="ghost" onClick={() => setSelectedReport(null)}>Close</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                    <Badge variant="outline" className="text-[11px] uppercase" style={{ borderColor: typeColors[selectedRpt.type], color: typeColors[selectedRpt.type] }}>
                      {selectedRpt.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Period</p>
                    <p className="text-sm">{selectedRpt.period}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <StatusBadge tone={statusTones[selectedRpt.status]}>{selectedRpt.status}</StatusBadge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated</p>
                    <p className="text-sm">{selectedRpt.generatedAt ? new Date(selectedRpt.generatedAt).toLocaleString() : "Not yet generated"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File Size</p>
                    <p className="text-sm">{selectedRpt.fileSize ?? "—"}</p>
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Sections</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRpt.sections.map((sec) => (
                    <Badge key={sec} variant="secondary">{sec}</Badge>
                  ))}
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
                {selectedRpt.status === "completed" && (
                  <Button onClick={() => toast({ title: "(demo) Download started", description: `${selectedRpt.name} PDF download initiated.` })}>
                    <Download className="mr-1 h-4 w-4" /> Download PDF
                  </Button>
                )}
                {selectedRpt.status !== "completed" && (
                  <Button onClick={() => toast({ title: "(demo) Regenerate", description: `Triggering regeneration of ${selectedRpt.name}.` })}>
                    <RefreshCw className="mr-1 h-4 w-4" /> Regenerate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </PageAsyncBoundary>

        {/* Generate report form (finding #10) — type, period, sections */}
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate compliance report</DialogTitle>
              <DialogDescription>
                Pick the regulatory framework, reporting period, and sections to include. The
                report is queued immediately and appears in the list above.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gen-type">Framework</Label>
                <select
                  id="gen-type"
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="soc2">SOC 2 Type II</option>
                  <option value="gdpr">GDPR Data Processing</option>
                  <option value="pci">PCI DSS</option>
                  <option value="hipaa">HIPAA</option>
                  <option value="custom">Custom audit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gen-period">Reporting period</Label>
                <Input
                  id="gen-period"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  placeholder="2026-10-01 to 2026-10-31"
                />
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Sections</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {SECTION_OPTIONS.map((sec) => (
                    <label key={sec} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={genSections.includes(sec)}
                        onChange={(e) =>
                          setGenSections((prev) =>
                            e.target.checked ? [...prev, sec] : prev.filter((s) => s !== sec),
                          )
                        }
                        className="h-3.5 w-3.5"
                      />
                      {sec}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
              <Button onClick={generateReport} disabled={genSections.length === 0}>
                <Play className="mr-1 h-4 w-4" /> Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add schedule form (finding #10) — name, framework, frequency, delivery */}
        <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule automated report</DialogTitle>
              <DialogDescription>
                The report regenerates on this cadence and is delivered automatically — no
                manual trigger needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched-name">Schedule name</Label>
                <Input
                  id="sched-name"
                  value={schedName}
                  onChange={(e) => setSchedName(e.target.value)}
                  placeholder="Monthly PCI DSS"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-type">Framework</Label>
                <select
                  id="sched-type"
                  value={schedType}
                  onChange={(e) => setSchedType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="soc2">SOC 2 Type II</option>
                  <option value="gdpr">GDPR Data Processing</option>
                  <option value="pci">PCI DSS</option>
                  <option value="hipaa">HIPAA</option>
                  <option value="custom">Custom audit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-freq">Frequency</Label>
                <select
                  id="sched-freq"
                  value={schedFrequency}
                  onChange={(e) => setSchedFrequency(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-delivery">Delivery</Label>
                <Input
                  id="sched-delivery"
                  value={schedDelivery}
                  onChange={(e) => setSchedDelivery(e.target.value)}
                  placeholder="Email to compliance@"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSchedOpen(false)}>Cancel</Button>
              <Button onClick={addSchedule}>
                <Calendar className="mr-1 h-4 w-4" /> Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </Page>
  );
}
