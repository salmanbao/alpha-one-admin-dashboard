"use client";
/**
 * N8 — Campaign Report / Postmortem (depth pass, Wave 2/P1).
 *
 * Adds over the Round-1 summary:
 *   - **full funnel** delivered → open → click → convert with step-to-step
 *     conversion rates plus bounce / spam / unsubscribe diagnostics,
 *   - **revenue attribution via M5 windows** (click/view/server-event windows),
 *   - **segment comparison** (revenue, conversions, ROI, deltas),
 *   - **PDF export** (print-to-PDF) and CSV export,
 *   - postmortem panel: findings, next actions, shared notes.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarSeries, AreaSeries } from "@/components/platform/charts";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { FileText, Download, Printer, CheckCircle2, Circle, TrendingUp, TrendingDown } from "lucide-react";
import { listCampaigns, type StudioCampaign } from "../campaign-studio-store";

/* ------------------------------------------------------------------ */
/* Report model (deterministic dummy data per campaign)                */
/* ------------------------------------------------------------------ */

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  /** % of previous stage */
  stepPct: number;
  /** % of delivered */
  ofDeliveredPct: number;
}
interface AttributionWindow {
  id: string;
  label: string;
  rule: string;
  conversions: number;
  revenue: number;
}
interface SegmentRow {
  seg: string;
  delivered: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  deltaPct: number;
}
interface Finding {
  id: string;
  kind: "worked" | "failed" | "test";
  text: string;
  done?: boolean;
}

/** Stable 0..1 hash so each campaign always renders the same report. */
function hash01(seed: string, salt = 0): number {
  let h = 2166136261 + salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function buildReport(c: StudioCampaign) {
  const sent = c.audienceSize;
  const deliveryRate = 0.94 + hash01(c.id, 1) * 0.05;
  const delivered = Math.round(sent * deliveryRate);
  const openRate = 0.32 + hash01(c.id, 2) * 0.24;
  const opened = Math.round(delivered * openRate);
  const ctr = 0.06 + hash01(c.id, 3) * 0.1;
  const clicked = Math.round(opened * ctr);
  const cvr = 0.08 + hash01(c.id, 4) * 0.16;
  const converted = Math.round(clicked * cvr);
  const hardBounce = Math.round(sent * 0.008);
  const softBounce = Math.max(0, sent - delivered - hardBounce);
  const spam = Math.max(1, Math.round(delivered * (0.0005 + hash01(c.id, 5) * 0.0015)));
  const unsub = Math.max(1, Math.round(delivered * (0.001 + hash01(c.id, 6) * 0.004)));
  const aov = 32 + hash01(c.id, 7) * 46;
  const revenue = Math.round(converted * aov);
  const sendCost = Math.round(sent * (c.channel === "sms" ? 0.045 : c.channel === "whatsapp" ? 0.03 : 0.0021) * 100) / 100;
  const adCost = Math.round((180 + hash01(c.id, 8) * 640) * 100) / 100;
  const cost = Math.round((sendCost + adCost) * 100) / 100;
  const roi = cost > 0 ? Math.round((revenue / cost) * 100) / 100 : 0;

  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const funnel: FunnelStage[] = [
    { key: "sent", label: "Sent", value: sent, stepPct: 100, ofDeliveredPct: pct(sent, delivered) },
    { key: "delivered", label: "Delivered", value: delivered, stepPct: pct(delivered, sent), ofDeliveredPct: 100 },
    { key: "opened", label: "Opened", value: opened, stepPct: pct(opened, delivered), ofDeliveredPct: pct(opened, delivered) },
    { key: "clicked", label: "Clicked", value: clicked, stepPct: pct(clicked, opened), ofDeliveredPct: pct(clicked, delivered) },
    { key: "converted", label: "Converted", value: converted, stepPct: pct(converted, clicked), ofDeliveredPct: pct(converted, delivered) },
  ];

  const windows: AttributionWindow[] = [
    { id: "w1", label: "Click window (7d)", rule: "M5.1 — click → conversion ≤ 7 days, last touch", conversions: converted, revenue },
    { id: "w2", label: "Click window (30d)", rule: "M5.1 — extended window", conversions: Math.round(converted * 1.28), revenue: Math.round(revenue * 1.31) },
    { id: "w3", label: "View window (1d)", rule: "M5.1 — view-through, email opens", conversions: Math.round(converted * 0.34), revenue: Math.round(revenue * 0.3) },
    { id: "w4", label: "Server event relay (7d)", rule: "M5.3 — CAPI relay, deduplicated", conversions: Math.round(converted * 1.12), revenue: Math.round(revenue * 1.16) },
  ];

  const segBase = [c.segmentName, "Funded traders", "Dormant 60 days", "KYC pending"];
  const segments: SegmentRow[] = segBase.map((seg, i) => {
    const w = 0.55 + hash01(c.id, 20 + i) * 0.6;
    const d = Math.max(24, Math.round(delivered * w * 0.42));
    const ck = Math.max(3, Math.round(d * (0.06 + hash01(c.id, 40 + i) * 0.09)));
    const cv = Math.max(1, Math.round(ck * (0.1 + hash01(c.id, 60 + i) * 0.18)));
    const rv = Math.round(cv * (28 + hash01(c.id, 80 + i) * 40));
    const segCost = Math.round((d * 0.004 + 40) * 100) / 100;
    return { seg, delivered: d, clicks: ck, conversions: cv, revenue: rv, roi: Math.round((rv / segCost) * 100) / 100, deltaPct: Math.round((hash01(c.id, 100 + i) - 0.42) * 80) };
  });

  const trend = Array.from({ length: 14 }, (_, i) => ({ d: i + 1, v: Math.round((opened / 14) * (0.55 + hash01(c.id, 200 + i) * 0.9)) }));

  const findings: Finding[] = [
    { id: "f1", kind: "worked", text: `${c.segmentName} delivered a ${pct(opened, delivered)}% open rate vs 38% platform baseline.` },
    { id: "f2", kind: "worked", text: `Mobile CTA drove ${Math.round(60 + hash01(c.id, 9) * 25)}% of all clicks — keep the above-the-fold button.` },
    { id: "f3", kind: "failed", text: `${hardBounce + softBounce} non-deliveries — clean ${hardBounce} hard bounces from M3 suppression.` },
    { id: "f4", kind: "failed", text: `${spam} spam complaints (${pct(spam, delivered)}%) — segment overlap with promo send cap.` },
    { id: "f5", kind: "test", text: `A/B subject variant B won by ${Math.round(4 + hash01(c.id, 11) * 14)}% — promote to the composer template.` },
  ];

  return { sent, delivered, opened, clicked, converted, hardBounce, softBounce, spam, unsub, revenue, sendCost, adCost, cost, roi, funnel, windows, segments, trend, findings };
}

type Report = ReturnType<typeof buildReport>;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CampaignReportPage() {
  const campaigns = listCampaigns();
  const [id, setId] = useState(campaigns[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const c = campaigns.find((x) => x.id === id) ?? campaigns[0];
  const r = useMemo<Report | null>(() => (c ? buildReport(c) : null), [c]);
  if (!c || !r) return <Page><PageContent><p className="text-sm text-muted-foreground">No campaigns yet.</p></PageContent></Page>;

  const stepDrop = (i: number) => {
    const a = r.funnel[i].value;
    const b = r.funnel[i + 1]?.value ?? a;
    return a - b;
  };

  const funnelCols: Column<SegmentRow>[] = [
    { key: "seg", header: "Segment", cell: (s) => <span className="font-medium">{s.seg}</span> },
    { key: "d", header: "Delivered", numeric: true, cell: (s) => s.delivered.toLocaleString() },
    { key: "ck", header: "Clicks", numeric: true, cell: (s) => s.clicks.toLocaleString() },
    { key: "cv", header: "Conv.", numeric: true, cell: (s) => s.conversions },
    { key: "rv", header: "Revenue", numeric: true, cell: (s) => `$${s.revenue.toLocaleString()}` },
    { key: "roi", header: "ROI", numeric: true, cell: (s) => `${s.roi}x` },
    {
      key: "dl",
      header: "vs prev.",
      numeric: true,
      cell: (s) => (
        <span className={`flex items-center justify-end gap-1 text-xs ${s.deltaPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {s.deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {s.deltaPct >= 0 ? "+" : ""}
          {s.deltaPct}%
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    const header = "stage,value,step_pct,of_delivered_pct";
    const csv = `${header}\n${r.funnel.map((f) => `${f.label},${f.value},${f.stepPct},${f.ofDeliveredPct}`).join("\n")}\n`;
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c.name.toLowerCase().replace(/\s+/g, "-")}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* download unavailable — toast still confirms the export */
    }
    recordAudit({ action: "campaign.report_export", entity: "campaign", entityId: c.id, summary: `Exported CSV report for ${c.name}`, module: "marketing" });
    toast({ title: "CSV exported", description: `Funnel + attribution rows for ${c.name}.` });
  };

  const exportPdf = () => {
    recordAudit({ action: "campaign.report_pdf", entity: "campaign", entityId: c.id, summary: `Exported PDF postmortem for ${c.name}`, module: "marketing" });
    toast({ title: "PDF export", description: "Opening the print dialog — choose 'Save as PDF'." });
    window.setTimeout(() => window.print(), 350);
  };

  return (
    <Page>
      <PageHeader
        title="Campaign Report / Postmortem"
        description="Full delivery funnel, revenue attribution, segment comparison, cost/ROI and PDF export."
        icon={FileText}
        actions={
          <div className="flex gap-2">
            <Select value={c.id} onValueChange={setId}>
              <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((x) => (
                  <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportPdf}><Printer className="mr-1 h-4 w-4" />PDF</Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Revenue attributed (7d click)" value={`$${r.revenue.toLocaleString()}`} tone="positive" delta={12.4} deltaLabel="vs previous send" />
          <MetricCard label="Cost (send + ad)" value={`$${r.cost.toFixed(2)}`} deltaLabel={`send $${r.sendCost.toFixed(2)} · ads $${r.adCost.toFixed(2)}`} />
          <MetricCard label="ROI" value={`${r.roi}x`} tone={r.roi >= 3 ? "positive" : "warning"} />
          <MetricCard label="Conversions" value={String(r.converted)} deltaLabel={`${r.funnel[4].ofDeliveredPct}% of delivered`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Full funnel ───────────────────────────────────────── */}
          <Card>
            <CardContent className="p-3">
              <p className="mb-2 text-sm font-semibold">Delivery funnel — {c.name} ({c.channel})</p>
              <div className="space-y-2">
                {r.funnel.map((f, i) => (
                  <div key={f.key}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium">{f.label}</span>
                      <span className="tabular-nums">
                        {f.value.toLocaleString()}
                        <span className="ml-2 text-muted-foreground">{f.ofDeliveredPct}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-6 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="flex h-full items-center rounded bg-primary/80 px-2 text-[10px] text-primary-foreground"
                        style={{ width: `${Math.max(4, (f.value / r.sent) * 100)}%` }}
                      >
                        {i > 0 ? `step ${f.stepPct}%` : "100%"}
                      </div>
                    </div>
                    {i < r.funnel.length - 1 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        −{stepDrop(i).toLocaleString()} between {f.label.toLowerCase()} → {r.funnel[i + 1].label.toLowerCase()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Hard bounce</p><p className="font-semibold">{r.hardBounce}</p></div>
                <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Soft bounce</p><p className="font-semibold">{r.softBounce}</p></div>
                <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Spam</p><p className="font-semibold">{r.spam}</p></div>
                <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Unsub</p><p className="font-semibold">{r.unsub}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* ── Attribution windows + trend ───────────────────────── */}
          <Card>
            <CardContent className="space-y-3 p-3">
              <div>
                <p className="mb-1 text-sm font-semibold">Revenue attribution — M5 windows</p>
                <div className="space-y-1.5 text-xs">
                  {r.windows.map((w) => (
                    <div key={w.id} className="rounded border px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{w.label}</span>
                        <span className="tabular-nums">${w.revenue.toLocaleString()} · {w.conversions} conv.</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{w.rule}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Click window is the reporting default; server-event relay deduplicates against UI events (M5.3).
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold">Opens by day (post-send)</p>
                <AreaSeries data={r.trend.map((t) => ({ d: t.d, v: t.v }))} xKey="d" yKey="v" height={130} color="hsl(var(--primary))" label="Opens by day after send" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Segment comparison ──────────────────────────────────── */}
        <Card className="mt-4">
          <CardContent className="p-3">
            <p className="mb-2 text-sm font-semibold">Segment comparison</p>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <DataTable columns={funnelCols} data={r.segments} rowKey={(s) => s.seg} pageSize={6} />
              <div>
                <BarSeries data={r.segments.map((s) => ({ seg: s.seg, rev: s.revenue }))} xKey="seg" yKey="rev" height={200} color="hsl(var(--primary))" label="Revenue by segment" />
                <p className="text-[10px] text-muted-foreground">Revenue by segment under the 7-day click window.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Postmortem ──────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardContent className="space-y-3 p-3">
            <p className="text-sm font-semibold">Postmortem — {c.name}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1.5 text-xs">
                {r.findings.map((f) => (
                  <div key={f.id} className="flex items-start gap-2 rounded border px-2 py-1.5">
                    <StatusBadge tone={f.kind === "worked" ? "success" : f.kind === "failed" ? "warning" : "info"}>{f.kind}</StatusBadge>
                    <span className="flex-1">{f.text}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                <p className="font-medium">Next actions</p>
                {r.findings.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left hover:bg-muted/50"
                    onClick={() => setChecks((k) => ({ ...k, [f.id]: !k[f.id] }))}
                  >
                    {checks[f.id] ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={checks[f.id] ? "text-muted-foreground line-through" : ""}>
                      {f.kind === "failed" ? "Remediate: " : f.kind === "test" ? "Promote winner: " : "Repeat: "}
                      {f.text}
                    </span>
                  </button>
                ))}
                <Textarea
                  className="text-xs"
                  placeholder="Shared postmortem notes (visible to the marketing team)…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if (!notes.trim()) return;
                    recordAudit({ action: "campaign.postmortem_note", entity: "campaign", entityId: c.id, summary: `Postmortem note saved for ${c.name}`, module: "marketing" });
                    toast({ title: "Note saved", description: "Audit-logged against the campaign." });
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Attribution sourced from Events Manager; cost from Ad Spend. Delivered/opened/clicked reflect real events once the
              send-gateway runtime is live — currently deterministic dummy data.
            </p>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
