"use client";

/**
 * Trading module — Stitch conversion (Batch 1)
 * Trading Overview · Traders · Accounts · Open Positions
 *
 * Converted from stitch_screens/trading_overview, traders_directory,
 * accounts_dashboard, open_positions + state screens:
 *  - trading_overview_empty_first_time_state / _degraded_high_risk_state
 *  - traders_directory_empty_state / _no_filter_results_state
 *  - accounts_dashboard_kpi_drill_down_sheet_state / _pass_fail_day_inspection_sheet_state
 *  - open_positions_empty_state / _no_filter_results_state
 *  - position_detail_live_* (positions row click sheet)
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  type Trader,
  type TradingAccount,
  type Position,
} from "@/lib/platform/mock-data";
import {
  StitchPageHeader,
  StitchKpi,
  StitchCard,
  StitchCardHeader,
  StitchPill,
  StitchFilterChips,
  StitchSegmented,
  StitchTimeline,
  StitchTable,
  StitchSheet,
  StitchConfirm,
  StitchEmpty,
  StitchButton,
  StitchStateBadge,
  StitchInfoHint,
  StitchMonoChip,
  StitchDetailRow,
  type StitchTone,
} from "@/components/stitch/stitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════ */
/* Trading Overview (view-id: trading)                              */
/* ═══════════════════════════════════════════════════════════════ */

export function TradingOverviewStitchPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  const positions = getTenantPositions(tid);
  const currency = runtime.tenant?.currency ?? "USD";
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const openPnl = positions.reduce((s, p) => s + p.pnl, 0);

  const [range, setRange] = React.useState<"7d" | "30d" | "90d">("30d");
  const [platform, setPlatform] = React.useState<string>("all");
  const [detailSheet, setDetailSheet] = React.useState<TradingAccount | null>(null);
  const [inspectSheet, setInspectSheet] = React.useState<null | { day: string; pass: number; fail: number }>(null);

  const platformChips: { value: string; label: string; count?: number; dotClass?: string }[] = [
    { value: "all", label: "All Platforms", count: accounts.length },
    { value: "MT5", label: "MetaTrader 5", count: accounts.filter((a) => a.platform === "MT5").length, dotClass: "bg-tp" },
    { value: "MT4", label: "MetaTrader 4", count: accounts.filter((a) => a.platform === "MT4").length, dotClass: "bg-tt" },
    { value: "DXTrade", label: "DXTrade", count: accounts.filter((a) => a.platform === "DXTrade").length, dotClass: "bg-tsc" },
  ];

  const rangeMult = range === "7d" ? 0.35 : range === "90d" ? 2.8 : 1;
  const curve = Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    value: Math.round(totalEquity * (0.86 + Math.sin(i / 3.2) * 0.05 + i * 0.005 * rangeMult)),
  }));

  /* KPI drill-down sheet (accounts_dashboard_kpi_drill_down_sheet_state) */
  const [kpiSheet, setKpiSheet] = React.useState<null | { title: string; rows: { login: string; trader: string; status: string; statusTone: StitchTone; passDay: string }[] }>(null);

  const openKpiDrill = (title: string, rows: { login: string; trader: string; status: string; statusTone: StitchTone; passDay: string }[]) =>
    setKpiSheet({ title, rows: rows.slice(0, 12) });

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="query_stats"
        title="Trading Overview"
        subtitle="Aggregate trading activity and capital distribution across all operational accounts"
        chip={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sfc-high px-2.5 py-0.5 text-xs font-semibold text-ink-variant">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tp opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tp" />
            </span>
            Live Data · Synced just now
          </span>
        }
        actions={
          <StitchButton variant="surface" icon="group" onClick={() => navigate("trading-traders")}>
            View {plural(term("trader")).toLowerCase()}
          </StitchButton>
        }
      />

      {/* KPI strip — drill-down on click (spec Batch 1) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StitchKpi
          label={plural(term("trader"))}
          value={traders.length.toLocaleString()}
          delta="+8 today"
          icon="trending_up"
          hint={`Click to view active ${plural(term("trader")).toLowerCase()}`}
          onClick={() => navigate("trading-traders")}
        />
        <StitchKpi
          label="Accounts"
          value={accounts.length.toLocaleString()}
          delta="+5 new"
          icon="add"
          hint="Click to drill into accounts"
          onClick={() =>
            openKpiDrill(
              "Account drill-down",
              accounts.slice(0, 40).map((a) => ({
                login: a.login,
                trader: a.traderName,
                status: a.status,
                statusTone: (a.status === "active" ? "positive" : a.status === "breached" ? "negative" : a.status === "passed" ? "info" : "muted") as StitchTone,
                passDay: a.phase === "funded" ? "—" : "3/5",
              })),
            )
          }
        />
        <StitchKpi
          label="Total Equity"
          value={new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(totalEquity)}
          delta="+3.2% (30d)"
          icon="north_east"
          hint="Aggregate client collateral"
          onClick={() => openKpiDrill("Equity drill-down — top accounts", accounts.slice(0, 40).map((a) => ({ login: a.login, trader: a.traderName, status: a.status, statusTone: "muted" as StitchTone, passDay: "—" })))}
        />
        <StitchKpi
          label="Open P&L"
          value={
            <span className={openPnl >= 0 ? "text-tp" : "text-terr"}>
              {openPnl >= 0 ? "+" : ""}
              {new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(openPnl)}
            </span>
          }
          delta={openPnl >= 0 ? "+5.4%" : "-2.1%"}
          icon="candlestick_chart"
          hint={`Unrealized across ${positions.length} books`}
        />
      </section>

      {/* Two-column main grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-6 lg:col-span-8">
          <StitchCard className="p-6">
            <div className="flex flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-bold text-ink">Equity Curve</h2>
                <StitchInfoHint text="Rolling aggregate portfolio equity calculated daily at market close." />
                <span className="ml-1 text-xs font-medium text-ink-variant">(Past {range})</span>
              </div>
              <StitchSegmented
                options={[
                  { value: "7d", label: "7d" },
                  { value: "30d", label: "30d" },
                  { value: "90d", label: "90d" },
                ]}
                value={range}
                onChange={setRange}
              />
            </div>
            <StitchFilterChips options={platformChips} value={platform} onChange={setPlatform} />
            <div className="relative mt-4 h-64 w-full">
              {/* recharts-based sparkline-free lightweight curve */}
              <EquityCurve data={curve} currency={currency} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-sfc-high pt-4 sm:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-ink-variant">Monthly Low-to-High</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-base font-bold text-ink">
                    {formatMoney(totalEquity * 0.91, currency)} → {formatMoney(totalEquity, currency)}
                  </span>
                  <span className="text-xs font-bold text-tp">+9.7%</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-ink-variant">Max Drawdown (30d)</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-base font-bold text-ink">1.82%</span>
                  <StitchPill tone="positive">Low Risk</StitchPill>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-ink-variant">Average Margin Level</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-base font-bold text-ink">412.6%</span>
                  <span className="text-xs text-ink-variant">Coverage ratio</span>
                </div>
              </div>
            </div>
          </StitchCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StitchCard>
              <StitchCardHeader icon="shield" title="Book Exposure Balance" right={<span className="text-xs font-semibold text-tp">A-Book 78%</span>} />
              <p className="text-xs leading-relaxed text-ink-variant">
                Institutional STP coverage is routing smoothly with zero backpressures across FX and Commodity liquidity hubs.
              </p>
              <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-sfc-high">
                <div className="h-full bg-tp" style={{ width: "78%" }} />
                <div className="h-full bg-tt-container" style={{ width: "22%" }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-ink-variant">
                <span>A-Book: Direct STP ({formatMoney(totalEquity * 0.78, currency)})</span>
                <span>B-Book: Internalized ({formatMoney(totalEquity * 0.22, currency)})</span>
              </div>
            </StitchCard>
            <StitchCard>
              <StitchCardHeader icon="speed" title="Execution Latency" right={<span className="text-xs font-bold text-ink">14.2 ms avg</span>} />
              <p className="text-xs leading-relaxed text-ink-variant">
                LD4 Equinix and NY4 cross-connects performing within nominal SLA thresholds. Zero slippage incidents reported.
              </p>
              <div className="mt-4 flex items-center gap-4 pt-1">
                {["London: 6ms", "New York: 22ms", "Tokyo: 68ms"].map((l) => (
                  <div key={l} className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span className="h-2 w-2 rounded-full bg-tp" />
                    {l}
                  </div>
                ))}
              </div>
            </StitchCard>
          </div>
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <StitchCard className="p-6">
            <div className="flex items-center justify-between pb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="font-serif text-lg font-bold text-ink">Recent Activity</h2>
                <span className="rounded-full bg-sfc-high px-2 py-0.5 text-xs font-bold text-ink">6 events</span>
              </div>
              <button className="text-xs font-bold text-tp transition-colors hover:text-tp/80" onClick={() => navigate("audit-user-events")}>
                View Audit Log
              </button>
            </div>
            <StitchTimeline
              items={[
                { dotClass: "bg-tp", title: "Deposit Confirmed", time: "2m ago", body: <>Alex Morgan (ACC-8921) deposited <strong className="text-ink">$25,000</strong> via Wire.</>, meta: <><span className="rounded bg-sfc px-1.5 py-0.5 text-[10px] font-semibold text-ink-variant">Cleared</span><span className="text-[10px] text-ink-variant">Treasury Vault A</span></> },
                { dotClass: "bg-tsc", title: "High Leverage Position", time: "14m ago", body: <>Liam Vance (ACC-4410) opened <strong className="text-ink">15.0 lots EUR/USD</strong> on MT5.</>, meta: <><span className="rounded bg-tsc-container px-1.5 py-0.5 text-[10px] font-semibold text-tsc">1:200 Lev</span><span className="text-[10px] text-ink-variant">Risk Monitor Notified</span></> },
                { dotClass: "bg-tt", title: "Stop-Out Triggered", time: "38m ago", body: <>Account <strong className="text-ink">ACC-1902</strong> hit 50% margin stop level on DXTrade.</>, meta: <><span className="rounded bg-tt-fixed px-1.5 py-0.5 text-[10px] font-semibold text-tt-fixed-variant">Liquidation</span><span className="text-[10px] text-ink-variant">Auto-Closed 2 Orders</span></> },
                { dotClass: "bg-ink-muted", title: "New MT5 Account", time: "1h ago", body: <>Sarah Chen registered a new live hedging sub-account (ACC-9940).</>, meta: <span className="rounded bg-sfc px-1.5 py-0.5 text-[10px] font-semibold text-ink-variant">Hedging Desk</span> },
                { dotClass: "bg-tp", title: "Withdrawal Approved", time: "2h ago", body: <>David K. (ACC-7714) payout of <strong className="text-ink">$8,200</strong> processed via SEPA.</>, meta: <span className="rounded bg-sfc px-1.5 py-0.5 text-[10px] font-semibold text-ink-variant">2FA Confirmed</span> },
                { icon: <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tp-fixed"><StitchPill tone="positive" icon="verified" > </StitchPill></span>, title: "KYC Verification Complete", time: "3h ago", body: <>Trader <strong className="text-ink">Elena Rostova</strong> upgraded to Tier 2 trading limits ($100k+).</>, meta: <span className="rounded bg-tp-fixed px-1.5 py-0.5 text-[10px] font-bold text-tp-fixed-variant">Tier 2 Approved</span> },
              ]}
            />
          </StitchCard>
          <StitchCard>
            <h3 className="mb-3 font-serif text-sm font-bold text-ink">Live Platform Server Status</h3>
            <div className="flex flex-col gap-2.5">
              {[
                { name: "MetaTrader 5 Cluster", up: "99.98% Uptime" },
                { name: "DXTrade Cloud", up: "100% Uptime" },
                { name: "FIX API Liquidity Bridge", up: "0 Dropped Packets" },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <span className="h-2 w-2 rounded-full bg-tp" />
                    {s.name}
                  </span>
                  <span className="font-semibold text-ink">{s.up}</span>
                </div>
              ))}
            </div>
          </StitchCard>
        </aside>
      </div>

      {/* KPI drill-down sheet (accounts_dashboard_kpi_drill_down_sheet_state) */}
      <StitchSheet
        open={!!kpiSheet}
        onOpenChange={(o) => !o && setKpiSheet(null)}
        title={kpiSheet?.title ?? ""}
        description="Drill into the accounts behind this metric"
        icon="drill_down"
        wide
        footer={<StitchButton variant="surface" onClick={() => setKpiSheet(null)}>Close</StitchButton>}
      >
        {kpiSheet ? (
          <StitchTable
            keyOf={(r) => r.login}
            columns={[
              { header: "Login", cell: (r) => <StitchMonoChip>{r.login}</StitchMonoChip> },
              { header: "Trader", cell: (r) => r.trader },
              { header: "Status", cell: (r) => <StitchPill tone={r.statusTone}>{r.status}</StitchPill> },
              { header: "Pass Day", cell: (r) => r.passDay, numeric: true },
            ]}
            rows={kpiSheet.rows}
          />
        ) : null}
      </StitchSheet>

      {/* Pass/fail day inspection (accounts_dashboard_pass_fail_day_inspection_sheet_state) */}
      <StitchSheet
        open={!!inspectSheet}
        onOpenChange={(o) => !o && setInspectSheet(null)}
        title={`Day inspection — ${inspectSheet?.day ?? ""}`}
        description="Objective pass/fail distribution for the selected day"
        icon="fact_check"
        footer={<StitchButton variant="surface" onClick={() => setInspectSheet(null)}>Close</StitchButton>}
      >
        {inspectSheet ? (
          <div className="space-y-3">
            <StitchDetailRow label="Passed" value={`${inspectSheet.pass} accounts`} />
            <StitchDetailRow label="Failed" value={`${inspectSheet.fail} accounts`} />
            <StitchProgressRow pass={inspectSheet.pass} fail={inspectSheet.fail} />
          </div>
        ) : null}
      </StitchSheet>

      {/* account drill-down via row click */}
      <StitchSheet
        open={!!detailSheet}
        onOpenChange={(o) => !o && setDetailSheet(null)}
        title={`Account ${detailSheet?.login ?? ""}`}
        description={detailSheet ? `${detailSheet.platform} · ${detailSheet.traderName}` : ""}
        icon="account_balance_wallet"
        footer={
          <>
            <StitchButton variant="surface" onClick={() => setDetailSheet(null)}>Close</StitchButton>
            <StitchButton variant="primary" icon="open_in_new" onClick={() => { setDetailSheet(null); navigate("account-workspace"); }}>Open Workspace</StitchButton>
          </>
        }
      >
        {detailSheet ? (
          <div className="space-y-2">
            <StitchDetailRow label="Status" value={<StitchStateBadge state={detailSheet.status} tone={statusTone(detailSheet.status)} />} />
            <StitchDetailRow label="Balance" value={formatMoney(detailSheet.balance, currency)} />
            <StitchDetailRow label="Equity" value={formatMoney(detailSheet.equity, currency)} />
            <StitchDetailRow label="Phase" value={detailSheet.phase} />
            <StitchDetailRow label="Open positions" value={positions.filter((p) => p.accountId === detailSheet.id).length} />
          </div>
        ) : null}
      </StitchSheet>
    </div>
  );
}

function StitchProgressRow({ pass, fail }: { pass: number; fail: number }) {
  const total = Math.max(1, pass + fail);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-sfc-high">
      <div className="h-full bg-tp" style={{ width: `${(pass / total) * 100}%` }} />
      <div className="h-full bg-terr" style={{ width: `${(fail / total) * 100}%` }} />
    </div>
  );
}

/* Lightweight equity curve drawn with SVG (stitch pattern). */
function EquityCurve({ data, currency }: { data: { date: string; value: number }[]; currency: string }) {
  const w = 700;
  const h = 220;
  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const span = Math.max(1, max - min);
  const pts = data.map((d, i) => ({
    x: 50 + (i / (data.length - 1)) * (w - 60),
    y: 18 + (1 - (d.value - min) / span) * (h - 50),
  }));
  const path = pts
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${pts[i - 1].x + 30} ${pts[i - 1].y}, ${p.x - 30} ${p.y}, ${p.x} ${p.y}`))
    .join(" ");
  const area = `${path} L ${pts[pts.length - 1].x} ${h - 24} L ${pts[0].x} ${h - 24} Z`;
  return (
    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="stitchEquityGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.28" />
          <stop offset="60%" stopColor="#4a7c59" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#4a7c59" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="46" x2={w} y1={18 + f * (h - 50)} y2={18 + f * (h - 50)} stroke="#eae6de" strokeDasharray="3 3" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#stitchEquityGrad)" />
      <path d={path} fill="none" stroke="#4a7c59" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="5.5" fill="#4a7c59" stroke="#fff" strokeWidth="2.5" />
      <text fill="#74796e" fontSize="11" x="8" y={20 + 0.25 * (h - 50)}>{formatMoney(max, currency, true)}</text>
      <text fill="#74796e" fontSize="11" x="8" y={18 + 0.75 * (h - 50)}>{formatMoney(min, currency, true)}</text>
    </svg>
  );
}

function formatMoney(v: number, currency = "USD", compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
}

function statusTone(s: string): StitchTone {
  switch (s) {
    case "active": return "positive";
    case "breached": return "negative";
    case "review": return "warning";
    case "pending": return "info";
    default: return "muted";
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* Traders (view-id: trading-traders)                               */
/* ═══════════════════════════════════════════════════════════════ */

export function TradersStitchPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [phaseFilter, setPhaseFilter] = React.useState("all");
  const [countryFilter, setCountryFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [suspendTarget, setSuspendTarget] = React.useState<Trader | null>(null);
  const [resetTarget, setResetTarget] = React.useState<Trader | null>(null);
  const [messageTarget, setMessageTarget] = React.useState<Trader | null>(null);
  const [impersonateTarget, setImpersonateTarget] = React.useState<Trader | null>(null);
  const [bulkSuspendOpen, setBulkSuspendOpen] = React.useState(false);

  const countries = React.useMemo(() => Array.from(new Set(traders.map((t) => t.country))).sort(), [traders]);

  const filtered = React.useMemo(
    () =>
      traders.filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (phaseFilter !== "all" && (t.challengePhase ?? "none") !== phaseFilter) return false;
        if (countryFilter !== "all" && t.country !== countryFilter) return false;
        if (query && !(`${t.name} ${t.email}`.toLowerCase().includes(query.toLowerCase()))) return false;
        return true;
      }),
    [traders, statusFilter, phaseFilter, countryFilter, query],
  );

  const activeCount =
    (statusFilter !== "all" ? 1 : 0) + (phaseFilter !== "all" ? 1 : 0) + (countryFilter !== "all" ? 1 : 0);

  const toggleAll = () => {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="badge"
        title={plural(term("trader"))}
        subtitle={`${traders.length} ${plural(term("trader")).toLowerCase()} in this tenant.`}
        actions={
          <>
            <StitchButton variant="surface" icon="visibility" onClick={() => toast({ title: "Saved view", description: "Current filters saved as a view." })}>
              Save View
            </StitchButton>
            <StitchButton variant="surface" icon="view_column" onClick={() => toast({ title: "Column picker", description: "Choose visible columns." })}>
              Columns
            </StitchButton>
            <StitchButton variant="primary" icon="person_add" onClick={() => setAddOpen(true)}>
              Add {term("trader")}
            </StitchButton>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StitchNativeSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: "all", label: "All statuses" }, ...Array.from(new Set(traders.map((t) => t.status))).map((s) => ({ value: s, label: s }))]}
          />
          <StitchNativeSelect
            value={phaseFilter}
            onChange={setPhaseFilter}
            options={[{ value: "all", label: "All phases" }, ...Array.from(new Set(traders.map((t) => t.challengePhase ?? "none"))).map((s) => ({ value: s, label: s }))]}
          />
          <StitchNativeSelect
            value={countryFilter}
            onChange={setCountryFilter}
            options={[{ value: "all", label: "All countries" }, ...countries.map((c) => ({ value: c, label: c }))]}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-8 w-44 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none placeholder:text-ink-muted focus:ring-1 focus:ring-tp"
          />
          {activeCount > 0 || query ? (
            <StitchButton
              variant="ghost"
              icon="restart_alt"
              onClick={() => { setStatusFilter("all"); setPhaseFilter("all"); setCountryFilter("all"); setQuery(""); }}
            >
              Clear all
            </StitchButton>
          ) : null}
        </div>
        <span className="text-xs text-ink-variant" aria-live="polite">
          {filtered.length} of {traders.length} shown
        </span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tp-fixed/60 px-4 py-2.5 text-xs font-semibold text-tp-fixed-variant shadow-sm">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <StitchButton variant="surface" icon="mail" onClick={() => toast({ title: "Email queued", description: `${selected.size} traders will receive your message.` })}>Email Selected</StitchButton>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${selected.size} traders exported to CSV.` })}>Export Selected</StitchButton>
            <StitchButton variant="destructive" icon="pause_circle" onClick={() => setBulkSuspendOpen(true)}>Suspend Selected</StitchButton>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <StitchCard className="p-0">
        {filtered.length === 0 ? (
          <StitchEmpty
            icon={traders.length === 0 ? "group_off" : "filter_alt_off"}
            title={traders.length === 0 ? `No ${plural(term("trader")).toLowerCase()} yet` : "No results match your filters"}
            body={
              traders.length === 0
                ? `When ${plural(term("trader")).toLowerCase()} join this tenant, they will appear here with status, phase and performance.`
                : "Try clearing a filter or adjusting your search to see more results."
            }
            action={<StitchButton variant="primary" onClick={() => setAddOpen(true)}>Add {term("trader")}</StitchButton>}
          />
        ) : (
          <StitchTable
            keyOf={(t) => t.id}
            onRowClick={(t) => navigate("trader-detail")}
            rows={filtered}
            columns={[
              {
                header: (
                  <Checkbox
                    aria-label="Select all traders"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                    className="border-ink-variant/40"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                ),
                cell: (t) => (
                  <Checkbox
                    aria-label={`Select ${t.name}`}
                    checked={selected.has(t.id)}
                    onCheckedChange={() => toggleOne(t.id)}
                    className="border-ink-variant/40"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                ),
                className: "w-10",
              },
              {
                header: term("trader"),
                cell: (t) => (
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tp/15 text-[10px] font-bold text-tp">
                      {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{t.name}</p>
                      <p className="truncate text-[10px] text-ink-variant">{t.email}</p>
                    </div>
                  </div>
                ),
              },
              { header: "Country", cell: (t) => <StitchPill tone="muted">{t.country}</StitchPill> },
              { header: "Status", cell: (t) => <StitchStateBadge state={t.status} tone={statusTone(t.status)} meaning={`${t.status} trader`} /> },
              { header: "Phase", cell: (t) => <StitchPill tone="muted">{t.challengePhase ?? "none"}</StitchPill> },
              { header: "Trades", cell: (t) => t.trades, numeric: true },
              { header: "Win %", cell: (t) => `${t.winRate}%`, numeric: true },
              { header: "Equity", cell: (t) => formatMoney(t.equity, currency), numeric: true },
              {
                header: "Total P&L",
                cell: (t) => (
                  <span className={cn("font-semibold", t.totalPnl >= 0 ? "text-tp" : "text-terr")}>
                    {t.totalPnl >= 0 ? "+" : ""}
                    {formatMoney(t.totalPnl, currency)}
                  </span>
                ),
                numeric: true,
              },
              {
                header: "",
                cell: (t) => <TraderRowMenu trader={t} onSuspend={() => setSuspendTarget(t)} onReset={() => setResetTarget(t)} onMessage={() => setMessageTarget(t)} onImpersonate={() => setImpersonateTarget(t)} />,
                className: "w-10",
              },
            ]}
          />
        )}
      </StitchCard>

      {/* ── Sheets & dialogs (wired state screens) ── */}
      <AddTraderSheet open={addOpen} onOpenChange={setAddOpen} termLabel={term("trader")} />
      <StitchConfirm
        open={!!suspendTarget}
        onOpenChange={(o) => !o && setSuspendTarget(null)}
        icon="pause_circle"
        title={`Suspend ${suspendTarget?.name ?? "trader"}?`}
        body="All trading will halt immediately. Open positions will remain open. This is reversible from the trader profile."
        confirmLabel="Suspend Trader"
        onConfirm={() => toast({ title: "Trader suspended", description: `${suspendTarget?.name} can no longer trade.` })}
      />
      <StitchConfirm
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
        icon="lock_reset"
        title="Reset password?"
        body={`A new temporary password will be emailed to ${resetTarget?.email ?? "the trader"}. The previous password stops working immediately.`}
        confirmLabel="Send Reset Email"
        destructive={false}
        onConfirm={() => toast({ title: "Reset email sent", description: resetTarget?.email })}
      />
      <MessageTraderSheet target={messageTarget} onClose={() => setMessageTarget(null)} />
      <ImpersonateDialog target={impersonateTarget} onClose={() => setImpersonateTarget(null)} />
      <StitchConfirm
        open={bulkSuspendOpen}
        onOpenChange={setBulkSuspendOpen}
        icon="pause_circle"
        title={`Suspend ${selected.size} traders?`}
        body="All selected traders will be suspended immediately. Open positions remain. Each action is logged in the audit trail."
        confirmLabel="Suspend Traders"
        onConfirm={() => { toast({ title: "Traders suspended", description: `${selected.size} accounts suspended.` }); setSelected(new Set()); }}
      />
    </div>
  );
}

/* Per-row kebab menu (traders_directory) */
function TraderRowMenu({ trader, onSuspend, onReset, onMessage, onImpersonate }: {
  trader: Trader;
  onSuspend: () => void;
  onReset: () => void;
  onMessage: () => void;
  onImpersonate: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const items: { label: string; icon: string; action: () => void; danger?: boolean }[] = [
    { label: "View Profile", icon: "person", action: () => (window as unknown as { __pfNav?: (v: string) => void }).__pfNav?.("trader-detail") },
    { label: "Edit Trader", icon: "edit", action: () => toast({ title: "Edit trader", description: `${trader.name} — edit sheet coming from profile workspace.` }) },
    { label: "Reset Password", icon: "lock_reset", action: onReset },
    { label: "Message Trader", icon: "mail", action: onMessage },
    { label: "Impersonate", icon: "swap_horiz", action: onImpersonate, danger: true },
    { label: "Suspend", icon: "pause_circle", action: onSuspend, danger: true },
  ];
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${trader.name}`}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink"
      >
        <MsIconSafe />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-48 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => { setOpen(false); it.action(); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-sfc",
                it.danger ? "text-terr" : "text-ink-variant hover:text-ink",
              )}
            >
              <MsIconSafe name={it.icon} />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Local icon helpers (avoid circular import weight in menus) */
function MsIconSafe({ name = "more_vert" }: { name?: string }) {
  return <span aria-hidden className="ms-icon text-[18px] leading-none">{name}</span>;
}

function StitchNativeSelect({ value, onChange, options, width }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-lg bg-sfc-lowest px-2.5 text-xs font-medium text-ink shadow-sm outline-none transition-colors hover:bg-sfc focus:ring-1 focus:ring-tp",
        width ?? "w-36",
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* Add Trader sheet (traders_directory add flow) */
function AddTraderSheet({ open, onOpenChange, termLabel }: { open: boolean; onOpenChange: (o: boolean) => void; termLabel: string }) {
  const [welcome, setWelcome] = React.useState(true);
  return (
    <StitchSheet
      open={open}
      onOpenChange={onOpenChange}
      icon="person_add"
      title={`Add ${termLabel}`}
      description="Creates the trader and optionally sends a welcome email"
      footer={
        <>
          <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Trader created", description: welcome ? "Welcome email sent." : "Welcome email skipped." }); }}>
            Create Trader
          </StitchButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Full Name"><Input className="stitch-input" placeholder="Elena Althaus" /></Field>
        <Field label="Email"><Input className="stitch-input" type="email" placeholder="elena@example.com" /></Field>
        <Field label="Country"><StitchNativeSelect value="US" onChange={() => {}} options={[{ value: "US", label: "United States" }, { value: "DE", label: "Germany" }, { value: "GB", label: "United Kingdom" }, { value: "IN", label: "India" }]} width="w-full" /></Field>
        <Field label="Initial Phase"><StitchNativeSelect value="phase-1" onChange={() => {}} options={[{ value: "phase-1", label: "Phase 1 — Evaluation" }, { value: "phase-2", label: "Phase 2 — Verification" }, { value: "funded", label: "Funded" }]} width="w-full" /></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          Send welcome email
          <Switch checked={welcome} onCheckedChange={setWelcome} />
        </label>
      </div>
    </StitchSheet>
  );
}

/* Message Trader sheet */
function MessageTraderSheet({ target, onClose }: { target: Trader | null; onClose: () => void }) {
  const [compliance, setCompliance] = React.useState(false);
  return (
    <StitchSheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      icon="mail"
      title={`Message ${target?.name ?? ""}`}
      description="The message is delivered to the trader's portal inbox and email"
      footer={
        <>
          <StitchButton variant="surface" onClick={onClose}>Cancel</StitchButton>
          <StitchButton variant="primary" icon="send" onClick={() => { onClose(); toast({ title: "Message sent", description: compliance ? "Copy sent to compliance." : undefined }); }}>Send</StitchButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Subject"><Input className="stitch-input" placeholder="Regarding your recent payout request…" /></Field>
        <Field label="Body"><Textarea className="stitch-input min-h-28" /></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          Send copy to compliance
          <Switch checked={compliance} onCheckedChange={setCompliance} />
        </label>
      </div>
    </StitchSheet>
  );
}

/* Impersonate alert dialog */
function ImpersonateDialog({ target, onClose }: { target: Trader | null; onClose: () => void }) {
  const [ack, setAck] = React.useState(false);
  return (
    <StitchSheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      icon="swap_horiz"
      title={`Login as ${target?.name ?? ""}?`}
      footer={
        <>
          <StitchButton variant="surface" onClick={onClose}>Cancel</StitchButton>
          <StitchButton variant="primary" disabled={!ack} onClick={() => { onClose(); toast({ title: "Impersonation session started", description: "30-minute timer running. All actions are audited." }); }}>Begin Session</StitchButton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-variant">
          You will be signed in as <strong className="text-ink">{target?.name}</strong> for 30 minutes. Every action is recorded under your admin ID.
        </p>
        <label className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="border-ink-variant/40" />
          I understand audit logging is enabled
        </label>
      </div>
    </StitchSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink">{label}</Label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Accounts (view-id: trading-accounts)                             */
/* ═══════════════════════════════════════════════════════════════ */

export function AccountsStitchPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accounts = getTenantAccounts(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [platformFilter, setPlatformFilter] = React.useState("all");
  const [phaseFilter, setPhaseFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [blockTarget, setBlockTarget] = React.useState<TradingAccount | null>(null);
  const [resetTarget, setResetTarget] = React.useState<TradingAccount | null>(null);
  const [rotateTarget, setRotateTarget] = React.useState<TradingAccount | null>(null);

  const filtered = React.useMemo(
    () =>
      accounts.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (platformFilter !== "all" && a.platform !== platformFilter) return false;
        if (phaseFilter !== "all" && a.phase !== phaseFilter) return false;
        if (query && !`${a.login} ${a.traderName}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [accounts, statusFilter, platformFilter, phaseFilter, query],
  );

  const activeCount = (statusFilter !== "all" ? 1 : 0) + (platformFilter !== "all" ? 1 : 0) + (phaseFilter !== "all" ? 1 : 0);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="account_balance_wallet"
        title="Trader Accounts"
        subtitle="MT5 / MT4 / DXTrade accounts for this trader tenant."
        actions={
          <>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${filtered.length} accounts exported.` })}>Export</StitchButton>
            <StitchButton variant="primary" icon="add" onClick={() => navigate("trading-add-account")}>Add Account</StitchButton>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StitchNativeSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...Array.from(new Set(accounts.map((a) => a.status))).map((s) => ({ value: s, label: s }))]} />
          <StitchNativeSelect value={platformFilter} onChange={setPlatformFilter} options={[{ value: "all", label: "All platforms" }, ...Array.from(new Set(accounts.map((a) => a.platform))).map((s) => ({ value: s, label: s }))]} />
          <StitchNativeSelect value={phaseFilter} onChange={setPhaseFilter} options={[{ value: "all", label: "All phases" }, ...Array.from(new Set(accounts.map((a) => a.phase))).map((s) => ({ value: s, label: s }))]} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search login or trader…" className="h-8 w-44 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none placeholder:text-ink-muted focus:ring-1 focus:ring-tp" />
          {activeCount > 0 || query ? (
            <StitchButton variant="ghost" icon="restart_alt" onClick={() => { setStatusFilter("all"); setPlatformFilter("all"); setPhaseFilter("all"); setQuery(""); }}>Clear all</StitchButton>
          ) : null}
        </div>
        <span className="text-xs text-ink-variant" aria-live="polite">{filtered.length} of {accounts.length} shown</span>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tp-fixed/60 px-4 py-2.5 text-xs font-semibold text-tp-fixed-variant shadow-sm">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <StitchButton variant="surface" icon="sync" onClick={() => toast({ title: "Sync queued", description: `${selected.size} accounts queued for bridge sync.` })}>Sync Selected</StitchButton>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${selected.size} accounts exported.` })}>Export Selected</StitchButton>
            <StitchButton variant="destructive" icon="block" onClick={() => toast({ title: "Accounts blocked", description: `${selected.size} accounts blocked.` })}>Block Selected</StitchButton>
          </div>
        </div>
      ) : null}

      <StitchCard className="p-0">
        {filtered.length === 0 ? (
          <StitchEmpty
            icon={accounts.length === 0 ? "wallet" : "filter_alt_off"}
            title={accounts.length === 0 ? "No accounts yet" : "No results match your filters"}
            body={accounts.length === 0 ? "Provisioned trading accounts appear here with live balance, equity and bridge state." : "Try clearing a filter or adjusting your search."}
            action={<StitchButton variant="primary" onClick={() => navigate("trading-add-account")}>Add Account</StitchButton>}
          />
        ) : (
          <StitchTable
            keyOf={(a) => a.id}
            onRowClick={() => navigate("account-workspace")}
            rows={filtered}
            columns={[
              { header: "Login", cell: (a) => <StitchMonoChip>{a.login}</StitchMonoChip> },
              {
                header: "Trader",
                cell: (a) => (
                  <button
                    className="inline-flex items-center gap-1 font-semibold text-tp hover:underline"
                    onClick={(e) => { e.stopPropagation(); navigate("trader-detail"); }}
                  >
                    {a.traderName}
                    <MsIconSafe name="arrow_outward" />
                  </button>
                ),
              },
              { header: "Platform", cell: (a) => <StitchPill tone="muted">{a.platform}</StitchPill> },
              { header: "Type", cell: (a) => <StitchPill tone="info">{a.type}</StitchPill> },
              { header: "Phase", cell: (a) => <StitchPill tone="muted">{a.phase}</StitchPill> },
              { header: "Balance", cell: (a) => formatMoney(a.balance, currency), numeric: true },
              { header: "Equity", cell: (a) => formatMoney(a.equity, currency), numeric: true },
              { header: "Status", cell: (a) => <StitchStateBadge state={a.status} tone={statusTone(a.status)} /> },
              {
                header: "",
                cell: (a) => <AccountRowMenu account={a} onBlock={() => setBlockTarget(a)} onReset={() => setResetTarget(a)} onRotate={() => setRotateTarget(a)} />,
                className: "w-10",
              },
            ]}
          />
        )}
      </StitchCard>

      {/* ── Wired state screens ── */}
      <BlockAccountDialog target={blockTarget} onClose={() => setBlockTarget(null)} />
      <ResetAccountDialog target={resetTarget} onClose={() => setResetTarget(null)} />
      <RotatePasswordSheet
        open={!!rotateTarget}
        onOpenChange={(o) => !o && setRotateTarget(null)}
        title={`Rotate password — ${rotateTarget?.login ?? ""}`}
      />
    </div>
  );
}

function AccountRowMenu({ account, onBlock, onReset, onRotate }: {
  account: TradingAccount;
  onBlock: () => void;
  onReset: () => void;
  onRotate: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const { navigate } = usePlatform();
  const items: { label: string; icon: string; action: () => void; danger?: boolean }[] = [
    { label: "Open Workspace", icon: "open_in_new", action: () => navigate("account-workspace") },
    { label: "Sync Account", icon: "sync", action: () => toast({ title: "Syncing account", description: `Bridge sync for ${account.login} in progress…` }) },
    { label: "View Events", icon: "history", action: () => navigate("account-events") },
    { label: "Rotate Password", icon: "key", action: onRotate },
    { label: "Reset Account", icon: "restart_alt", action: onReset, danger: true },
    { label: "Block Account", icon: "block", action: onBlock, danger: true },
  ];
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`Actions for ${account.login}`} onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink">
        <MsIconSafe />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-48 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.action(); }} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-sfc", it.danger ? "text-terr" : "text-ink-variant hover:text-ink")}>
              <MsIconSafe name={it.icon} />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Shared destructive dialogs (used by accounts + workspace + configuration) */

export function BlockAccountDialog({ target, onClose }: { target: { login?: string } | null; onClose: () => void }) {
  const [closePositions, setClosePositions] = React.useState(false);
  return (
    <StitchConfirm
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      icon="block"
      title={`Block ${target?.login ?? "account"}?`}
      body="The account will be immediately blocked and the trader will lose all trading access. This action is logged in the audit trail."
      confirmLabel="Block Account"
      onConfirm={() => toast({ title: "Account blocked", description: target?.login })}
    >
      <label className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
        <Checkbox checked={closePositions} onCheckedChange={(v) => setClosePositions(v === true)} className="border-ink-variant/40" />
        Close all open positions at market
      </label>
    </StitchConfirm>
  );
}

export function ResetAccountDialog({ target, onClose }: { target: { login?: string } | null; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  const [ack, setAck] = React.useState(false);
  return (
    <StitchConfirm
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      icon="restart_alt"
      title={`Reset ${target?.login ?? "account"}?`}
      body="Resetting restores the initial balance and discards all progress (balance, equity, P&L, drawdown). This cannot be undone."
      confirmLabel="Reset Account"
      onConfirm={() => toast({ title: "Account reset", description: target?.login })}
    >
      <div className="space-y-2.5">
        <Field label="Reason (required)"><Textarea className="stitch-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being reset?" /></Field>
        <label className="flex items-center gap-2.5 rounded-lg bg-terr-container/40 px-3 py-2.5 text-xs font-semibold text-terr">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="border-terr/40" />
          I acknowledge all progress will be lost
        </label>
      </div>
    </StitchConfirm>
  );
}

export function RotatePasswordSheet({ open, onOpenChange, title }: { open: boolean; onOpenChange: (o: boolean) => void; title: string }) {
  const [sendToTrader, setSendToTrader] = React.useState(true);
  const [pw, setPw] = React.useState("Xk9#mQ2$vL7p");
  return (
    <StitchSheet
      open={open}
      onOpenChange={onOpenChange}
      icon="key"
      title={title}
      description="Generates a new master password and emails it to the trader"
      footer={
        <>
          <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" icon="key" onClick={() => { onOpenChange(false); toast({ title: "Password rotated", description: sendToTrader ? "New credentials emailed to trader." : undefined }); }}>Rotate</StitchButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="New Password">
          <div className="flex gap-2">
            <Input className="stitch-input font-mono" value={pw} onChange={(e) => setPw(e.target.value)} />
            <StitchButton variant="surface" icon="casino" onClick={() => setPw(`Xk${Math.random().toString(36).slice(2, 8)}#vL${Math.random().toString(36).slice(2, 5)}`)}>Regen</StitchButton>
          </div>
        </Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          Send to trader
          <Switch checked={sendToTrader} onCheckedChange={setSendToTrader} />
        </label>
        <Field label="Audit Reason (required)"><Textarea className="stitch-input" placeholder="Why are you rotating this password?" /></Field>
      </div>
    </StitchSheet>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Open Positions (view-id: trading-positions)                      */
/* ═══════════════════════════════════════════════════════════════ */

export function PositionsStitchPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const positions = getTenantPositions(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [sideFilter, setSideFilter] = React.useState("all");
  const [symbolFilter, setSymbolFilter] = React.useState("all");
  const [pnlFilter, setPnlFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = React.useState<Position | null>(null);
  const [sltpTarget, setSltpTarget] = React.useState<Position | null>(null);
  const [bulkCloseOpen, setBulkCloseOpen] = React.useState(false);

  const filtered = React.useMemo(
    () =>
      positions.filter((p) => {
        if (sideFilter !== "all" && p.side !== sideFilter) return false;
        if (symbolFilter !== "all" && p.symbol !== symbolFilter) return false;
        if (pnlFilter === "winning" && p.pnl <= 0) return false;
        if (pnlFilter === "losing" && p.pnl >= 0) return false;
        return true;
      }),
    [positions, sideFilter, symbolFilter, pnlFilter],
  );

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="candlestick_chart"
        title="Open Positions"
        subtitle={`${positions.length} positions currently open across all traders.`}
        actions={
          <>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${filtered.length} positions exported to CSV.` })}>Export CSV</StitchButton>
            <StitchButton variant="destructive" icon="dangerous" disabled={selected.size === 0} onClick={() => setBulkCloseOpen(true)}>Bulk Close All</StitchButton>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StitchNativeSelect value={sideFilter} onChange={setSideFilter} options={[{ value: "all", label: "All sides" }, { value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }]} />
          <StitchNativeSelect value={symbolFilter} onChange={setSymbolFilter} options={[{ value: "all", label: "All symbols" }, ...Array.from(new Set(positions.map((p) => p.symbol))).map((s) => ({ value: s, label: s }))]} />
          <StitchNativeSelect value={pnlFilter} onChange={setPnlFilter} options={[{ value: "all", label: "Any P&L" }, { value: "winning", label: "Winning" }, { value: "losing", label: "Losing" }]} />
          {sideFilter !== "all" || symbolFilter !== "all" || pnlFilter !== "all" ? (
            <StitchButton variant="ghost" icon="restart_alt" onClick={() => { setSideFilter("all"); setSymbolFilter("all"); setPnlFilter("all"); }}>Clear all</StitchButton>
          ) : null}
        </div>
        <span className="text-xs text-ink-variant" aria-live="polite">{filtered.length} of {positions.length} shown</span>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-terr-container/50 px-4 py-2.5 text-xs font-semibold text-terr shadow-sm">
          <span>{selected.size} positions selected</span>
          <StitchButton variant="destructive" icon="dangerous" onClick={() => setBulkCloseOpen(true)}>Close Selected</StitchButton>
        </div>
      ) : null}

      <StitchCard className="p-0">
        {filtered.length === 0 ? (
          <StitchEmpty
            icon={positions.length === 0 ? "monitoring" : "filter_alt_off"}
            title={positions.length === 0 ? "No open positions" : "No results match your filters"}
            body={positions.length === 0 ? "Live positions across every trader account stream here in real time." : "Try clearing a filter or widening your P&L range."}
          />
        ) : (
          <StitchTable
            keyOf={(p) => p.id}
            onRowClick={(p) => setDetail(p)}
            rows={filtered}
            columns={[
              {
                header: (
                  <Checkbox
                    aria-label="Select all positions"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={() => setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))))}
                    className="border-ink-variant/40"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                ),
                cell: (p) => (
                  <Checkbox aria-label={`Select ${p.symbol}`} checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} className="border-ink-variant/40" onClick={(e: React.MouseEvent) => e.stopPropagation()} />
                ),
                className: "w-10",
              },
              { header: "Symbol", cell: (p) => <StitchMonoChip>{p.symbol}</StitchMonoChip> },
              {
                header: "Side",
                cell: (p) => (
                  <span role="img" aria-label={`Position side: ${p.side}`} className={cn("inline-flex items-center gap-1 font-bold", p.side === "buy" ? "text-tp" : "text-terr")}>
                    <MsIconSafe name={p.side === "buy" ? "north_east" : "south_west"} />
                    {p.side === "buy" ? "Buy" : "Sell"}
                  </span>
                ),
              },
              { header: "Volume", cell: (p) => p.volume, numeric: true },
              { header: "Entry", cell: (p) => p.entryPrice, numeric: true },
              { header: "Current", cell: (p) => p.currentPrice, numeric: true },
              {
                header: "P&L",
                cell: (p) => (
                  <span role="img" aria-label={`Profit and loss: ${p.pnl >= 0 ? "profit" : "loss"} of ${formatMoney(Math.abs(p.pnl), currency)}`} className={cn("font-bold", p.pnl >= 0 ? "text-tp" : "text-terr")}>
                    {p.pnl >= 0 ? "+" : ""}
                    {formatMoney(p.pnl, currency)}
                  </span>
                ),
                numeric: true,
              },
              { header: "Opened", cell: (p) => p.openedAt, className: "text-ink-variant" },
              {
                header: "",
                cell: (p) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <StitchButton variant="destructive" className="h-7 px-2" onClick={() => setCloseTarget(p)}>Close</StitchButton>
                    <RowIconMenu
                      items={[
                        { label: "Modify SL/TP", icon: "tune", action: () => setSltpTarget(p) },
                        { label: "View Account", icon: "open_in_new", action: () => navigate("account-workspace") },
                      ]}
                    />
                  </div>
                ),
                className: "w-40",
              },
            ]}
          />
        )}
      </StitchCard>

      {/* ── Wired state screens ── */}
      {/* Position Detail (Live) sheet — position_detail_live_pos_894201_eurusd */}
      <StitchSheet
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={`Position ${detail?.symbol ?? ""}`}
        description={detail ? `${detail.side.toUpperCase()} · ${detail.volume} lots · opened ${detail.openedAt}` : ""}
        icon="monitoring"
        wide
        footer={
          <>
            <StitchButton variant="surface" icon="mail" onClick={() => toast({ title: "Trader notified" })}>Notify Trader</StitchButton>
            <StitchButton variant="surface" icon="open_in_new" onClick={() => { setDetail(null); navigate("account-workspace"); }}>Open Account</StitchButton>
            <StitchButton variant="destructive" icon="dangerous" onClick={() => { setCloseTarget(detail); setDetail(null); }}>Close at Market</StitchButton>
          </>
        }
      >
        {detail ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StitchDetailRow label="UID" value={detail.id} />
            <StitchDetailRow label="Side" value={<span className={detail.side === "buy" ? "text-tp" : "text-terr"}>{detail.side}</span>} />
            <StitchDetailRow label="Volume" value={`${detail.volume} lots`} />
            <StitchDetailRow label="Entry" value={detail.entryPrice} />
            <StitchDetailRow label="Current" value={detail.currentPrice} />
            <StitchDetailRow label="P&L" value={<span className={detail.pnl >= 0 ? "text-tp" : "text-terr"}>{formatMoney(detail.pnl, currency)}</span>} />
            <StitchDetailRow label="Stop Loss" value={"—"} />
            <StitchDetailRow label="Take Profit" value={"—"} />
            <div className="sm:col-span-2 rounded-lg bg-sfc-low p-3">
              <p className="mb-2 text-xs font-bold text-ink">Modify SL/TP</p>
              <div className="grid grid-cols-2 gap-2">
                <Input className="stitch-input" placeholder="Stop Loss" />
                <Input className="stitch-input" placeholder="Take Profit" />
              </div>
            </div>
          </div>
        ) : null}
      </StitchSheet>

      {/* Close at market — position_detail_live_close_at_market_modal_state */}
      <StitchConfirm
        open={!!closeTarget}
        onOpenChange={(o) => !o && setCloseTarget(null)}
        icon="dangerous"
        title={`Close ${closeTarget?.side.toUpperCase()} ${closeTarget?.volume} ${closeTarget?.symbol}?`}
        body={`Estimated fill at current market (${closeTarget?.currentPrice ?? "—"}). Slippage may apply. The position cannot be restored after closing.`}
        confirmLabel="Close at Market"
        onConfirm={() => toast({ title: "Position closed", description: `${closeTarget?.symbol} closed at market.` })}
      />

      {/* Bulk close — bulk close state */}
      <StitchConfirm
        open={bulkCloseOpen}
        onOpenChange={setBulkCloseOpen}
        icon="dangerous"
        title={`Close ${selected.size || filtered.length} positions?`}
        body="Each will be closed at current market. Slippage may apply. Action is irreversible."
        confirmLabel="Close Positions"
        onConfirm={() => { toast({ title: "Positions closed", description: "Bulk close dispatched to bridge." }); setSelected(new Set()); }}
      >
        <label className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          <Checkbox defaultChecked className="border-ink-variant/40" />
          Notify each trader by email
        </label>
      </StitchConfirm>

      {/* Modify SL/TP — position_detail_live_modify_sl_tp_sheet_state */}
      <StitchSheet
        open={!!sltpTarget}
        onOpenChange={(o) => !o && setSltpTarget(null)}
        icon="tune"
        title={`Modify SL/TP — ${sltpTarget?.symbol ?? ""}`}
        footer={
          <>
            <StitchButton variant="surface" onClick={() => setSltpTarget(null)}>Cancel</StitchButton>
            <StitchButton variant="primary" onClick={() => { setSltpTarget(null); toast({ title: "SL/TP updated" }); }}>Save</StitchButton>
          </>
        }
      >
        {sltpTarget ? (
          <div className="space-y-3">
            <Field label="Stop Loss"><div className="flex gap-2"><Input className="stitch-input" placeholder="e.g. 1.0840" /><StitchButton variant="surface" onClick={() => {}}>Use current</StitchButton></div></Field>
            <Field label="Take Profit"><div className="flex gap-2"><Input className="stitch-input" placeholder="e.g. 1.0920" /><StitchButton variant="surface" onClick={() => {}}>Use current</StitchButton></div></Field>
            <Field label="Audit Reason"><Textarea className="stitch-input" placeholder="Optional note for the audit trail" /></Field>
          </div>
        ) : null}
      </StitchSheet>
    </div>
  );
}

function RowIconMenu({ items }: { items: { label: string; icon: string; action: () => void }[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Row actions" onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink">
        <MsIconSafe />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.action(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink-variant transition-colors hover:bg-sfc hover:text-ink">
              <MsIconSafe name={it.icon} />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
