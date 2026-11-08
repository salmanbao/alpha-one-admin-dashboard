"use client";
/**
 * N9 — Frequency & Budget Caps (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 cap-values screen:
 *   - **pacing calendar** — daily spend vs linear pace, cumulative projection,
 *   - **per-segment and per-channel cap matrix** (heat-mapped usage),
 *   - **cap-hit forecasts** — when each cap/budget trips at the current pace,
 *   - **breach alerts into the risk alert subscription** (routes to the
 *     existing Risk → Alert Subscriptions view),
 * alongside the frequency rules, monthly budget, quiet hours and overrides.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Gauge, CalendarDays, BellRing, Grid3x3, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

interface Rule {
  id: string;
  scope: string;
  channel: string;
  limit: string;
  /** % of the cap consumed in the current period */
  used: number;
  status: "ok" | "near" | "breach";
}

type CellStatus = "ok" | "near" | "breach";

const SEGMENTS = ["All segments", "Funded traders", "Dormant 60d", "KYC pending", "VIP"];
const CHANNELS = ["email", "sms", "whatsapp", "push"] as const;
const CAPS: Record<(typeof CHANNELS)[number], string> = {
  email: "5 / wk",
  sms: "2 / wk",
  whatsapp: "3 / wk",
  push: "4 / wk",
};

const MONTH_BUDGET = 5_000;
const ALERT_THRESHOLD = 80;

/** Deterministic per-day spend for the current month (dummy metering). */
function dailySpend(daysInMonth: number): number[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const wave = Math.sin((i + 1) / 2.4) * 0.45 + Math.cos((i + 1) / 5) * 0.3;
    const weekday = ((i + 1) % 7 === 0 || (i + 1) % 7 === 6) ? 0.55 : 1;
    return Math.round((95 + wave * 70) * weekday * 100) / 100;
  });
}

const statusOf = (pct: number): CellStatus => (pct >= 90 ? "breach" : pct >= 75 ? "near" : "ok");
const cellClass = (s: CellStatus) =>
  s === "breach" ? "bg-rose-500/85 text-white" : s === "near" ? "bg-amber-500/80 text-black" : "bg-emerald-500/70 text-white";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketingGovernancePage() {
  const { navigate } = usePlatform();

  const [rules, setRules] = useState<Rule[]>([
    { id: "r1", scope: "All segments", channel: "email", limit: "5 / week / contact", used: 62, status: "ok" },
    { id: "r2", scope: "Dormant 60d", channel: "sms", limit: "2 / week / contact", used: 88, status: "near" },
    { id: "r3", scope: "All segments", channel: "whatsapp", limit: "3 / week / contact", used: 41, status: "ok" },
    { id: "r4", scope: "VIP", channel: "push", limit: "4 / week / contact", used: 94, status: "breach" },
  ]);
  const [budget, setBudget] = useState({ monthly: MONTH_BUDGET, spent: 3_180, alert: ALERT_THRESHOLD });
  const [quiet, setQuiet] = useState({ start: "21:00", end: "08:00", enabled: true });
  const [routeAlerts, setRouteAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ scope: "All segments", channel: "email", limit: "5 / week / contact" });

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const spend = useMemo(() => dailySpend(daysInMonth), [daysInMonth]);
  const monthTotal = useMemo(() => Math.round(spend.reduce((s, v) => s + v, 0) * 100) / 100, [spend]);
  // Scale the dummy daily spend so month-to-date reconciles with `budget.spent`.
  const scale = monthTotal > 0 ? budget.spent / (spend.slice(0, dayOfMonth).reduce((s, v) => s + v, 0) || 1) : 1;
  const scaled = useMemo(() => spend.map((v) => Math.round(v * scale * 100) / 100), [spend, scale]);
  const monthToDate = scaled.slice(0, dayOfMonth).reduce((s, v) => s + v, 0);
  const dailyTarget = budget.monthly / daysInMonth;
  const projectedEOM = Math.round((monthToDate / dayOfMonth) * daysInMonth * 100) / 100;
  const pacePct = Math.round((monthToDate / (dailyTarget * dayOfMonth)) * 100);
  const spendPct = Math.round((budget.spent / budget.monthly) * 100);

  /** Days until the monthly budget trips at the current pace (forecast). */
  const budgetHitDays = (() => {
    const remaining = budget.monthly - budget.spent;
    const perDay = monthToDate / dayOfMonth;
    if (perDay <= 0) return null;
    if (remaining <= 0) return 0;
    return Math.max(1, Math.ceil(remaining / perDay));
  })();

  /** Cap-hit forecasts per rule (current period usage → days to trip). */
  const forecasts = rules
    .filter((r) => r.used >= 70)
    .map((r) => ({ id: r.id, label: `${r.scope} · ${r.channel}`, used: r.used, days: Math.max(1, Math.ceil(((100 - r.used) / 100) * 7)), status: r.status }));

  /** Cap matrix: per-segment × per-channel usage heat map. */
  const matrix = useMemo(
    () =>
      SEGMENTS.map((seg, si) => ({
        seg,
        cells: CHANNELS.map((ch, ci) => {
          const wave = Math.sin((si * 3 + ci * 5 + 1) * 1.7) * 0.5 + 0.5;
          const used = Math.round((18 + wave * 78) * (rules.some((r) => r.scope === seg && r.channel === ch) ? 1.12 : 0.92));
          const pct = Math.min(99, used);
          return { ch, pct, status: statusOf(pct), cap: CAPS[ch] };
        }),
      })),
    [rules],
  );

  const breachCount = rules.filter((r) => r.status === "breach").length;

  const cols: Column<Rule>[] = [
    { key: "scope", header: "Scope", cell: (r) => r.scope },
    { key: "ch", header: "Channel", cell: (r) => r.channel },
    { key: "lim", header: "Limit", cell: (r) => r.limit },
    {
      key: "used",
      header: "Usage vs cap",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded bg-muted">
            <div className={`h-1.5 rounded ${r.used >= 90 ? "bg-destructive" : r.used >= 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${r.used}%` }} />
          </div>
          <span className="text-xs tabular-nums">{r.used}%</span>
        </div>
      ),
    },
    {
      key: "st",
      header: "Status",
      cell: (r) => <StatusBadge tone={r.status === "breach" ? "danger" : r.status === "near" ? "warning" : "success"}>{r.status}</StatusBadge>,
    },
    {
      key: "a",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, used: Math.max(0, x.used - 15), status: statusOf(Math.max(0, x.used - 15)) } : x))); toast({ title: "Usage reset", description: `${r.scope} · ${r.channel} counter decremented (dummy).` }); }}>Reset</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => { setRules((rs) => rs.filter((x) => x.id !== r.id)); recordAudit({ action: "cap.rule_removed", entity: "marketing", entityId: r.id, summary: `Removed frequency cap ${r.scope} · ${r.channel} (${r.limit})`, module: "marketing", severity: "warning" }); toast({ title: "Rule removed" }); }}>Remove</Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Frequency & Budget Caps"
        description="Frequency rules, monthly budget, pacing calendar, segment × channel cap matrix, cap-hit forecasts and breach alert routing."
        icon={Gauge}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>Add rule</Button>}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Monthly budget" value={`$${budget.spent.toLocaleString()} / $${budget.monthly.toLocaleString()}`} tone={spendPct >= budget.alert ? "warning" : "positive"} deltaLabel={`${spendPct}% consumed`} />
          <MetricCard label="Projected month-end" value={`$${projectedEOM.toLocaleString()}`} tone={projectedEOM > budget.monthly ? "negative" : "positive"} deltaLabel={`pace ${pacePct}% of linear`} />
          <MetricCard label="Rules in breach" value={String(breachCount)} tone={breachCount ? "negative" : "positive"} />
          <MetricCard label="Budget trip forecast" value={budgetHitDays === null ? "—" : budgetHitDays === 0 ? "now" : `${budgetHitDays}d`} tone={budgetHitDays !== null && budgetHitDays <= 5 ? "warning" : "default"} deltaLabel={`alert at ${budget.alert}%`} />
        </div>

        {/* ── Pacing calendar ──────────────────────────────────────── */}
        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1 text-sm font-semibold"><CalendarDays className="h-4 w-4" />Pacing calendar — {today.toLocaleString(undefined, { month: "long", year: "numeric" })}</p>
              <span className="text-[11px] text-muted-foreground">daily target ${dailyTarget.toFixed(0)} · actual/day ${(monthToDate / dayOfMonth).toFixed(0)}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[9px] text-muted-foreground sm:grid-cols-[repeat(7,minmax(0,1fr))]">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="text-center">{d}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const v = scaled[i] ?? 0;
                const over = v > dailyTarget * 1.15;
                const future = day > dayOfMonth;
                return (
                  <div
                    key={day}
                    title={`Day ${day}: $${v.toFixed(2)} (target $${dailyTarget.toFixed(2)})`}
                    className={`rounded border p-1 text-center text-[9px] ${future ? "border-dashed text-muted-foreground" : over ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"} ${day === dayOfMonth ? "ring-2 ring-primary" : ""}`}
                  >
                    <span className="block font-semibold">{day}</span>
                    <span className="block tabular-nums">{future ? "" : `$${Math.round(v)}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span>ringed = today</span>
              <span>rose = &gt;115% of daily target</span>
              <span>dashed = future days (forecast only)</span>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* ── Rules table ───────────────────────────────────────── */}
          <Card>
            <CardContent className="p-3">
              <p className="mb-2 text-sm font-semibold">Frequency rules</p>
              <DataTable columns={cols} data={rules} rowKey={(r) => r.id} pageSize={6} />
              <div className="mt-3 rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold">Quiet hours policy</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Suppress non-transactional sends between</span>
                  <Input className="h-8 w-24" value={quiet.start} onChange={(e) => setQuiet({ ...quiet, start: e.target.value })} />
                  <span>and</span>
                  <Input className="h-8 w-24" value={quiet.end} onChange={(e) => setQuiet({ ...quiet, end: e.target.value })} />
                  <span>(recipient local time)</span>
                  <Switch checked={quiet.enabled} onCheckedChange={(v) => setQuiet({ ...quiet, enabled: v })} />
                </div>
                <Button size="sm" variant="outline" onClick={() => { recordAudit({ action: "cap.override_requested", entity: "marketing", summary: `Quiet-hours override requested (${quiet.start}-${quiet.end})`, module: "marketing", severity: "warning" }); toast({ title: "Override requested", description: "Routed through Campaign Approval (N6)." }); }}>Request override</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {/* ── Cap-hit forecasts ───────────────────────────────── */}
            <Card>
              <CardContent className="p-3">
                <p className="mb-2 flex items-center gap-1 text-sm font-semibold"><ChevronRight className="h-4 w-4" />Cap-hit forecasts</p>
                {forecasts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No cap is above 70% — nothing forecast to trip this period.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {forecasts.map((f) => (
                      <li key={f.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                        <span>{f.label} <span className="text-muted-foreground">· {f.used}% used</span></span>
                        <span className="flex items-center gap-2">
                          <StatusBadge tone={f.status === "breach" ? "danger" : "warning"}>{f.status}</StatusBadge>
                          <span className="text-muted-foreground">{f.used >= 100 ? "tripped" : `~${f.days}d to cap`}</span>
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between rounded border px-2 py-1.5">
                      <span>Monthly budget ${budget.monthly.toLocaleString()} <span className="text-muted-foreground">· {spendPct}% used</span></span>
                      <span className="text-muted-foreground">{budgetHitDays === 0 ? "tripped now" : budgetHitDays ? `~${budgetHitDays}d to trip` : "within budget"}</span>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* ── Breach alerts → risk alert subscription ─────────── */}
            <Card>
              <CardContent className="space-y-2 p-3">
                <p className="flex items-center gap-1 text-sm font-semibold"><BellRing className="h-4 w-4" />Breach alerts</p>
                <p className="text-[11px] text-muted-foreground">
                  Cap and budget breaches raise marketing alerts; routing them into the platform risk alert subscription keeps them visible on the
                  Risk → Alert Subscriptions surface.
                </p>
                <label className="flex items-center justify-between text-xs">
                  <span>Route breaches to Risk Alert Subscriptions</span>
                  <Switch checked={routeAlerts} onCheckedChange={(v) => { setRouteAlerts(v); recordAudit({ action: "cap.alert_routing", entity: "marketing", summary: `Breach alert routing to risk alert subscription ${v ? "enabled" : "disabled"}`, module: "marketing", severity: v ? "info" : "warning" }); toast({ title: v ? "Routing enabled" : "Routing disabled", description: v ? "Breach alerts now also land on the risk alert subscription." : "Marketing-only alerts remain." }); }} />
                </label>
                <label className="flex items-center justify-between text-xs">
                  <span>In-app marketing alert</span>
                  <Switch checked={inAppAlerts} onCheckedChange={setInAppAlerts} />
                </label>
                <label className="flex items-center justify-between text-xs">
                  <span>Email digest to marketing owner</span>
                  <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                </label>
                <div className="flex items-center gap-2 border-t pt-2">
                  <Button size="sm" variant="outline" onClick={() => { if (!routeAlerts) { setRouteAlerts(true); recordAudit({ action: "cap.alert_routing", entity: "marketing", summary: "Breach alert routing enabled from governance", module: "marketing" }); } navigate("risk-alert-subscription"); }}>
                    Open alert subscriptions
                  </Button>
                  <span className="text-[10px] text-muted-foreground">{breachCount ? `${breachCount} breach alert(s) pending` : "No active breaches"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Cap matrix ───────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-sm font-semibold"><Grid3x3 className="h-4 w-4" />Cap matrix — segment × channel (% of weekly cap consumed)</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-2">Segment</th>
                    {CHANNELS.map((ch) => <th key={ch} className="py-1 px-2 text-center">{ch} ({CAPS[ch]})</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.seg} className="border-t">
                      <td className="py-1.5 pr-2 font-medium">{row.seg}</td>
                      {row.cells.map((cell) => (
                        <td key={cell.ch} className="p-1">
                          <div className={`rounded px-2 py-1.5 text-center tabular-nums ${cellClass(cell.status)}`} title={`${row.seg} · ${cell.ch}: ${cell.pct}% of ${cell.cap}`}>
                            {cell.pct}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Green &lt;75% · amber 75–89% · rose ≥90% (breach). Cells for actively-capped combos run hotter.</p>
          </CardContent>
        </Card>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Cap values persist for the session; forecasts are projections from the current metering window.
        </p>
      </PageContent>

      {/* ── Add rule ─────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add frequency rule</DialogTitle>
            <DialogDescription>Per-contact caps per segment and channel. Breaches feed the forecast and alert panels above.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <Select value={draft.scope} onValueChange={(v) => setDraft({ ...draft, scope: v })}>
              <SelectTrigger><SelectValue placeholder="Segment" /></SelectTrigger>
              <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
              <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} placeholder="e.g. 5 / week / contact" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const rec: Rule = { id: `r-${Date.now()}`, ...draft, used: 0, status: "ok" };
                setRules((rs) => [rec, ...rs]);
                recordAudit({ action: "cap.rule_created", entity: "marketing", entityId: rec.id, summary: `Created frequency cap ${rec.scope} · ${rec.channel} (${rec.limit})`, module: "marketing" });
                toast({ title: "Rule created", description: `${rec.scope} · ${rec.channel} — ${rec.limit}` });
                setAddOpen(false);
                setDraft({ scope: "All segments", channel: "email", limit: "5 / week / contact" });
              }}
            >
              Create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
