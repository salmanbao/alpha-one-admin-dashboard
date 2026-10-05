"use client";

/**
 * Trading module — Stitch conversion (Batches 2 & 4)
 *
 * Base screens: add-account wizard, closed positions, closed position detail,
 * trading credentials + NEW: trader comparison, bridge sync log, trader audit
 * log, MT4/DXTrade server catalog, bulk account operations.
 *
 * State screens wired:
 *  - add_account_validation_error_bridge_failure_state
 *  - closed_positions_empty_state / _no_filter_results_state
 *  - closed_position_detail_reopen_reverse_position_modal_state / _destructive_delete_confirmation_state
 *  - trading_credentials_reveal_master_password_alertdialog_state / _rotate_password_modal_state
 *  - trader_comparison_pick_trader_sheet_state / _schedule_report_sheet_state
 *  - bridge_sync_log_sync_detail_sheet_state / _retry_failed_replay_progress_state
 *  - trader_audit_log_event_subscription_sheet_state / _compare_to_previous_period_state
 *  - server_catalog_add_server_provisioning_sheet_state / _connection_test_diagnostics_modal_state
 *  - bulk_account_operations_step_4_review_execute_alertdialog_state / _operation_history_sheet_state
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantTraders,
  getTenantPositions,
  getTenantAudit,
} from "@/lib/platform/mock-data";
import {
  StitchCard,
  StitchCardHeader,
  StitchPageHeader,
  StitchPill,
  StitchTable,
  StitchSheet,
  StitchConfirm,
  StitchButton,
  StitchStateBadge,
  StitchKpi,
  StitchDetailRow,
  StitchTimeline,
  StitchStepper,
  StitchMonoChip,
  StitchEmpty,
  StitchSegmented,
  StitchInfoHint,
  StitchSubHeader,
  StitchActionBar,
} from "@/components/stitch/stitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function MsIconSafe({ name = "more_vert" }: { name?: string }) {
  return <span aria-hidden className="ms-icon text-[18px] leading-none">{name}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink">{label}</Label>
      {children}
    </div>
  );
}
function money(v: number, currency = "USD", compact = false) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(v);
}
function toneFor(s: string): "positive" | "negative" | "warning" | "info" | "muted" {
  switch (s) {
    case "active": case "approved": case "passed": case "connected": case "online": case "completed": return "positive";
    case "breached": case "failed": case "rejected": case "blocked": case "offline": return "negative";
    case "pending": case "review": case "degraded": case "running": return "warning";
    case "info": return "info";
    default: return "muted";
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* Add Account wizard (view-id: trading-add-account)                */
/* ═══════════════════════════════════════════════════════════════ */

const WIZ_STEPS = ["User", "Challenge", "Account", "KYC", "Review"] as const;

export function AddAccountStitchPage() {
  const { navigate } = usePlatform();
  const [step, setStep] = React.useState(0);
  const [welcome, setWelcome] = React.useState(true);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [bridgeError, setBridgeError] = React.useState(false);
  const [uploadName, setUploadName] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="person_add"
        title="Add Account"
        subtitle="Create a new trader account with associated challenge and KYC."
        actions={<StitchButton variant="ghost" icon="bookmark" onClick={() => { toast({ title: "Draft saved", description: "Resume any time from the drafts list." }); navigate("trading-accounts"); }}>Resume Later</StitchButton>}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 rounded-xl bg-sfc-low p-4 shadow-sm">
        {WIZ_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i < step ? "bg-tp text-on-primary" : i === step ? "border-2 border-tp bg-sfc-lowest text-tp" : "bg-sfc text-ink-muted",
              )}>
                {i < step ? <MsIconSafe name="check" /> : i + 1}
              </span>
              <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-ink-variant")}>{s}</span>
            </div>
            {i < WIZ_STEPS.length - 1 ? <div className={cn("h-0.5 flex-1", i < step ? "bg-tp" : "bg-sfc-high")} /> : null}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <StitchCard className="min-h-72 p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <div><h2 className="font-serif text-lg font-bold text-ink">User Information</h2><p className="text-xs text-ink-variant">The trader identity behind this account</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email"><Input className="stitch-input" type="email" placeholder="elena@example.com" /></Field>
              <Field label="Full Name"><Input className="stitch-input" placeholder="Elena Althaus" /></Field>
            </div>
            <label className="flex w-fit items-center justify-between gap-3 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Send welcome email automatically<Switch checked={welcome} onCheckedChange={setWelcome} /></label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-serif text-lg font-bold text-ink">Challenge & Phase</h2><p className="text-xs text-ink-variant">Objectives the trader must complete</p></div>
              <StitchButton variant="ghost" icon="content_paste" onClick={() => setTemplateOpen(true)}>Load from existing template</StitchButton>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Challenge Type">
                <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>2-Phase Standard (2 phases)</option><option>1-Phase Turbo (1 phase)</option><option>Instant Funded</option></select>
              </Field>
              <Field label="Phase">
                <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Phase 1 — Evaluation</option><option>Phase 2 — Verification</option></select>
              </Field>
            </div>
            <div className="rounded-xl bg-sfc-low p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-tsc">Phase defaults</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StitchDetailRow label="Account Size" value="$100,000" />
                <StitchDetailRow label="Profit Target" value="10%" />
                <StitchDetailRow label="Max Drawdown" value="10%" />
                <StitchDetailRow label="Daily Drawdown" value="5%" />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div><h2 className="font-serif text-lg font-bold text-ink">Account Configuration</h2><p className="text-xs text-ink-variant">Economics and broker platform</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Profit Split %"><Input className="stitch-input" type="number" defaultValue={20} /><span className="text-[10px] text-ink-variant">Trader keeps 80%, firm 20%</span></Field>
              <Field label="Payout Frequency">
                <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option></select>
              </Field>
              <Field label="Initial Balance USD"><Input className="stitch-input" type="number" defaultValue={100000} /></Field>
              <Field label="Broker Type">
                <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>MT5</option><option>DXTrade</option></select>
              </Field>
            </div>
            {bridgeError ? (
              <div className="rounded-xl bg-terr-container/50 p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-terr"><MsIconSafe name="error" /> Bridge provisioning failed</p>
                <p className="mt-1 text-xs text-ink-variant">The MT5 bridge rejected the provisioning request (timeout after 30s). The account was NOT created — retry or choose a different server group.</p>
                <div className="mt-2 flex gap-2">
                  <StitchButton variant="surface" icon="refresh" onClick={() => setBridgeError(false)}>Retry</StitchButton>
                  <StitchButton variant="ghost" onClick={() => setBridgeError(false)}>Dismiss</StitchButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div><h2 className="font-serif text-lg font-bold text-ink">KYC Status</h2><p className="text-xs text-ink-variant">Initial verification state</p></div>
            <Field label="Initial KYC Status">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Pending verification</option><option>Skip KYC</option></select>
            </Field>
            <Field label="Document Type">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Passport</option><option>Driver's License</option><option>National ID</option><option>Residence Permit</option></select>
            </Field>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                uploadName ? "border-tp bg-tp-fixed/30" : "border-outline-variant hover:border-tp/50",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setUploadName(e.dataTransfer.files?.[0]?.name ?? "document.pdf"); }}
            >
              <MsIconSafe name="upload_file" />
              <span className="text-xs font-semibold text-ink">{uploadName ?? "Drag & drop document (PDF / JPG / PNG, max 10 MB)"}</span>
              <span className="text-[10px] text-ink-variant">or click to browse · camera capture supported</span>
              <input type="file" className="hidden" onChange={(e) => setUploadName(e.target.files?.[0]?.name ?? null)} />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div><h2 className="font-serif text-lg font-bold text-ink">Review & Create</h2><p className="text-xs text-ink-variant">Confirm everything before provisioning</p></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label="Email" value="elena@example.com" />
              <StitchDetailRow label="Full Name" value="Elena Althaus" />
              <StitchDetailRow label="Challenge Type" value="2-Phase Standard" />
              <StitchDetailRow label="Phase" value="Phase 1 — Evaluation" />
              <StitchDetailRow label="Account Size" value="$100,000" />
              <StitchDetailRow label="Profit Split" value="80 / 20" />
              <StitchDetailRow label="Payout Frequency" value="Weekly" />
              <StitchDetailRow label="Initial Balance" value="$100,000" />
              <StitchDetailRow label="Broker Type" value="MT5" />
              <StitchDetailRow label="KYC Status" value="Pending verification" />
              <StitchDetailRow label="Document Type" value="Passport" />
            </div>
            <div className="rounded-xl border-l-4 border-tp bg-tp-fixed/40 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-tp-fixed-variant"><MsIconSafe name="verified" /> Ready to provision</p>
              <p className="mt-1 text-xs text-ink-variant">The account, challenge and KYC record will be created. A welcome email {welcome ? "will" : "will not"} be sent.</p>
            </div>
          </div>
        ) : null}
      </StitchCard>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <div className="flex gap-2">
          <StitchButton variant="ghost" icon="arrow_back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</StitchButton>
          <StitchButton variant="ghost" icon="save" onClick={() => toast({ title: "Draft saved" })}>Save Draft</StitchButton>
        </div>
        <span className="text-xs font-semibold text-ink-variant">Step {step + 1} of 5</span>
        {step < 4 ? (
          <StitchButton variant="primary" onClick={() => { if (step === 2 && !bridgeError) setBridgeError(true); else { setBridgeError(false); setStep((s) => Math.min(4, s + 1)); } }}>
            Next
          </StitchButton>
        ) : (
          <StitchButton variant="primary" icon="rocket_launch" onClick={() => { toast({ title: "Account created", description: "Provisioning dispatched to bridge." }); navigate("trading-accounts"); }}>Create Account</StitchButton>
        )}
      </div>

      {/* Template sheet */}
      <StitchSheet
        open={templateOpen} onOpenChange={setTemplateOpen} icon="content_paste" title="Load template"
        description="Populates steps 2-4 from a saved template"
        footer={<>
          <StitchButton variant="surface" onClick={() => setTemplateOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setTemplateOpen(false); toast({ title: "Template applied" }); }}>Apply Template</StitchButton>
        </>}
      >
        <div className="space-y-2">
          {["2-Phase $100K Standard", "1-Phase $50K Turbo", "Instant $25K Funded"].map((t) => (
            <label key={t} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
              <span className="flex items-center gap-2.5"><Checkbox className="border-ink-variant/40" />{t}</span>
              <button className="text-[11px] font-bold text-tp hover:underline">Preview</button>
            </label>
          ))}
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Closed Positions (view-id: closed-positions)                     */
/* ═══════════════════════════════════════════════════════════════ */

const CLOSED_ROWS = [
  { id: "pos-908412", symbol: "XAUUSD", side: "buy" as const, volume: 2.0, entry: 2312.4, close: 2338.9, pnl: 5300, opened: "May 20 09:14", closed: "May 21 15:42", duration: "3h 42m", reason: "Take Profit" },
  { id: "pos-907901", symbol: "EURUSD", side: "sell" as const, volume: 5.0, entry: 1.0862, close: 1.0841, pnl: 1050, opened: "May 19 11:02", closed: "May 19 19:44", duration: "8h 42m", reason: "Manual" },
  { id: "pos-906554", symbol: "NAS100", side: "buy" as const, volume: 1.0, entry: 18240, close: 18118, pnl: -1220, opened: "May 18 14:30", closed: "May 18 16:20", duration: "1h 50m", reason: "Stop Loss" },
  { id: "pos-905110", symbol: "GBPJPY", side: "sell" as const, volume: 3.0, entry: 196.44, close: 195.88, pnl: 840, opened: "May 17 08:55", closed: "May 17 12:10", duration: "3h 15m", reason: "Take Profit" },
  { id: "pos-904887", symbol: "USDJPY", side: "buy" as const, volume: 4.0, entry: 156.2, close: 155.7, pnl: -2000, opened: "May 16 21:12", closed: "May 17 02:03", duration: "4h 51m", reason: "Stop Loss" },
];

export function ClosedPositionsStitchPage() {
  const { navigate } = usePlatform();
  const currency = "USD";
  const [query, setQuery] = React.useState("");
  const [symbolF, setSymbolF] = React.useState("all");
  const [dirF, setDirF] = React.useState("all");
  const [reasonF, setReasonF] = React.useState("all");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [tagTarget, setTagTarget] = React.useState<(typeof CLOSED_ROWS)[number] | null>(null);
  const [journalTarget, setJournalTarget] = React.useState<(typeof CLOSED_ROWS)[number] | null>(null);

  const filtered = CLOSED_ROWS.filter((r) =>
    (symbolF === "all" || r.symbol === symbolF) &&
    (dirF === "all" || r.side === dirF) &&
    (reasonF === "all" || r.reason === reasonF) &&
    (!query || `${r.id} ${r.symbol}`.toLowerCase().includes(query.toLowerCase())),
  );

  const totalProfit = CLOSED_ROWS.filter((r) => r.pnl > 0).reduce((s, r) => s + r.pnl, 0);
  const totalLoss = CLOSED_ROWS.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0);
  const wins = CLOSED_ROWS.filter((r) => r.pnl > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="history"
        title="Closed Positions"
        subtitle="Historical trading positions that have been closed."
        actions={<StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${filtered.length} rows exported.` })}>Export CSV</StitchButton>}
      />

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <StitchKpi label="Total Closed" value={CLOSED_ROWS.length} icon="inventory_2" />
        <StitchKpi label="Total Profit" value={money(totalProfit, currency, true)} tone="positive" icon="trending_up" />
        <StitchKpi label="Total Loss" value={money(totalLoss, currency, true)} tone="negative" icon="trending_down" />
        <StitchKpi label="Win Rate" value={`${Math.round((wins / CLOSED_ROWS.length) * 100)}%`} tone={wins >= 3 ? "positive" : "negative"} icon="percent" />
        <StitchKpi label="Avg Duration" value="4h 28m" icon="timer" />
        <StitchKpi label="Best Trade" value={money(5300, currency, true)} tone="positive" icon="emoji_events" />
        <StitchKpi label="Worst Trade" value={money(-2000, currency, true)} tone="negative" icon="sentiment_very_dissatisfied" />
      </section>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-8 w-40 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none placeholder:text-ink-muted focus:ring-1 focus:ring-tp" />
          <select value={symbolF} onChange={(e) => setSymbolF(e.target.value)} className="h-8 rounded-lg bg-sfc-lowest px-2.5 text-xs font-medium text-ink shadow-sm outline-none"><option value="all">All symbols</option>{Array.from(new Set(CLOSED_ROWS.map((r) => r.symbol))).map((s) => <option key={s}>{s}</option>)}</select>
          <select value={dirF} onChange={(e) => setDirF(e.target.value)} className="h-8 rounded-lg bg-sfc-lowest px-2.5 text-xs font-medium text-ink shadow-sm outline-none"><option value="all">All directions</option><option value="buy">Buy</option><option value="sell">Sell</option></select>
          <select value={reasonF} onChange={(e) => setReasonF(e.target.value)} className="h-8 rounded-lg bg-sfc-lowest px-2.5 text-xs font-medium text-ink shadow-sm outline-none"><option value="all">All reasons</option><option>Take Profit</option><option>Stop Loss</option><option>Manual</option></select>
          {symbolF !== "all" || dirF !== "all" || reasonF !== "all" || query ? <StitchButton variant="ghost" icon="restart_alt" onClick={() => { setSymbolF("all"); setDirF("all"); setReasonF("all"); setQuery(""); }}>Clear</StitchButton> : null}
        </div>
        <span className="text-xs text-ink-variant" aria-live="polite">{filtered.length} of {CLOSED_ROWS.length} shown</span>
      </div>

      <StitchCard className="p-0">
        {filtered.length === 0 ? (
          <StitchEmpty
            icon={CLOSED_ROWS.length === 0 ? "history" : "filter_alt_off"}
            title={CLOSED_ROWS.length === 0 ? "No closed positions yet" : "No results match your filters"}
            body={CLOSED_ROWS.length === 0 ? "When trades close, the full record — entry, exit, duration and reason — is archived here." : "Try clearing a filter or adjusting your search."}
          />
        ) : (
          <StitchTable
            keyOf={(r) => r.id}
            onRowClick={(r) => setExpanded((e) => (e === r.id ? null : r.id))}
            rows={filtered}
            columns={[
              { header: "Login", cell: () => <StitchMonoChip>MT5-882049</StitchMonoChip> },
              { header: "Trader", cell: () => "Elena Althaus" },
              { header: "Direction", cell: (r) => <span className={cn("font-bold", r.side === "buy" ? "text-tp" : "text-terr")}>{r.side === "buy" ? "Buy" : "Sell"}</span> },
              { header: "Symbol", cell: (r) => <StitchMonoChip>{r.symbol}</StitchMonoChip> },
              { header: "Volume", cell: (r) => r.volume, numeric: true },
              { header: "Entry", cell: (r) => r.entry, numeric: true },
              { header: "Close", cell: (r) => r.close, numeric: true },
              { header: "P&L", cell: (r) => <span className={cn("font-bold", r.pnl >= 0 ? "text-tp" : "text-terr")}>{money(r.pnl, currency)}</span>, numeric: true },
              { header: "Closed", cell: (r) => <span className="text-ink-variant">{r.closed}</span> },
              { header: "Duration", cell: (r) => r.duration },
              { header: "Reason", cell: (r) => <StitchPill tone={r.reason === "Take Profit" ? "positive" : r.reason === "Stop Loss" ? "negative" : "muted"}>{r.reason}</StitchPill> },
              {
                header: "",
                cell: (r) => (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <RowMenu items={[
                      { label: "View Detail", icon: "open_in_new", action: () => navigate("closed-position-detail") },
                      { label: "Tag Trade", icon: "sell", action: () => setTagTarget(r) },
                      { label: "Convert to Journal Entry", icon: "auto_stories", action: () => setJournalTarget(r) },
                      { label: "Export PDF Ticket", icon: "picture_as_pdf", action: () => toast({ title: "PDF ticket generated" }) },
                    ]} />
                  </div>
                ),
                className: "w-12",
              },
            ]}
          />
        )}
      </StitchCard>

      {/* Expanded inline detail panel */}
      {expanded ? (
        <StitchCard>
          <StitchCardHeader icon="receipt_long" title={`Position ${expanded}`} description="Full closed-trade record" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StitchDetailRow label="Commission" value="-$7.20" />
            <StitchDetailRow label="Swap" value="-$1.10" />
            <StitchDetailRow label="P&L %" value="+11.9%" />
            <StitchDetailRow label="Open Order ID" value="#88410221" />
            <StitchDetailRow label="Close Order ID" value="#88439900" />
            <StitchDetailRow label="Open Time" value="May 20 09:14" />
            <StitchDetailRow label="Close Time" value="May 21 15:42" />
            <StitchDetailRow label="Net Profit" value={<span className="text-tp">{money(5300, currency)}</span>} />
          </div>
        </StitchCard>
      ) : null}

      {/* Tag sheet */}
      <StitchSheet
        open={!!tagTarget} onOpenChange={(o) => !o && setTagTarget(null)} icon="sell" title={`Tag ${tagTarget?.symbol ?? ""} trade`}
        footer={<>
          <StitchButton variant="surface" onClick={() => setTagTarget(null)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setTagTarget(null); toast({ title: "Tags saved" }); }}>Save</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Tags (type to add)">
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-sfc-low p-2">
              {["breakout", "news", "A-setup"].map((t) => <StitchPill key={t} tone="info">{t} ×</StitchPill>)}
              <input className="min-w-24 flex-1 bg-transparent text-xs text-ink outline-none" placeholder="add tag…" />
            </div>
          </Field>
          <Field label="Internal Note (optional)"><Textarea className="stitch-input" /></Field>
        </div>
      </StitchSheet>

      {/* Journal sheet */}
      <StitchSheet
        open={!!journalTarget} onOpenChange={(o) => !o && setJournalTarget(null)} icon="auto_stories" title="Convert to journal entry"
        footer={<>
          <StitchButton variant="surface" onClick={() => setJournalTarget(null)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setJournalTarget(null); toast({ title: "Saved to journal" }); }}>Save to Journal</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Journal Name"><Input className="stitch-input" defaultValue={journalTarget ? `${journalTarget.symbol} ${journalTarget.side} ${journalTarget.volume}` : ""} /></Field>
          <Field label="Entry Date"><Input className="stitch-input" type="date" /></Field>
          <Field label="Strategy Tags"><Input className="stitch-input" placeholder="breakout, trend…" /></Field>
          <Field label="Notes"><Textarea className="stitch-input" /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

function RowMenu({ items }: { items: { label: string; icon: string; action: () => void }[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Row actions" onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink"><MsIconSafe /></button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.action(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink-variant transition-colors hover:bg-sfc hover:text-ink">
              <MsIconSafe name={it.icon} />{it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Closed Position Detail (view-id: closed-position-detail)         */
/* ═══════════════════════════════════════════════════════════════ */

export function ClosedPositionDetailStitchPage() {
  const { navigate } = usePlatform();
  const [editing, setEditing] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reopenOpen, setReopenOpen] = React.useState(false);
  const [reverseOpen, setReverseOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <StitchSubHeader back={{ label: "Closed Positions", onClick: () => navigate("closed-positions") }} trail={["Trading", "Closed Positions", "pos-908412"]} />

      <StitchPageHeader
        icon="receipt_long"
        title="pos-908412 · XAUUSD"
        subtitle="Gold vs US Dollar · closed May 21, 15:42 UTC"
        chip={
          <span className="flex gap-2">
            <StitchPill tone="positive">Buy</StitchPill>
            <StitchPill tone="info">Closed · Take Profit</StitchPill>
          </span>
        }
        actions={
          <>
            <StitchButton variant="surface" icon="picture_as_pdf" onClick={() => toast({ title: "Trade ticket PDF downloaded" })}>PDF Ticket</StitchButton>
            <StitchButton variant="surface" icon="undo" onClick={() => setReopenOpen(true)}>Reopen</StitchButton>
            <StitchButton variant="surface" icon="swap_vert" onClick={() => setReverseOpen(true)}>Reverse</StitchButton>
            <StitchButton variant={editing ? "primary" : "surface"} icon={editing ? "done" : "edit"} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</StitchButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader icon="badge" title="Identity" description="Position ownership and linkage" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Uid" value="pos-908412" />
            <StitchDetailRow label="Trader" value="Elena Althaus" />
            <StitchDetailRow label="Account" value="MT5-882049" />
            <StitchDetailRow label="Direction" value={<StitchPill tone="positive">Buy</StitchPill>} />
            <StitchDetailRow label="State" value="closed" />
            <StitchDetailRow label="Symbol" value="XAUUSD" />
            <StitchDetailRow label="Position Type" value={editing ? <select className="h-7 rounded bg-sfc-lowest px-2 text-xs"><option>Market</option><option>Pending</option></select> : "Market"} />
            <StitchDetailRow label="Entry Type" value={editing ? <select className="h-7 rounded bg-sfc-lowest px-2 text-xs"><option>In</option><option>Out</option></select> : "Out"} />
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="price_change" title="Volume & Pricing" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Volume" value="2.00 lots" />
            <StitchDetailRow label="Open Price" value="2312.40" />
            <StitchDetailRow label="Close Price" value="2338.90" />
            <StitchDetailRow label="Current Price" value="2338.90" />
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="schedule" title="Timing" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Open Time" value="May 20 09:14 UTC" />
            <StitchDetailRow label="Close Time" value="May 21 15:42 UTC" />
            <StitchDetailRow label="Duration" value="3h 42m" />
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="tag" title="Order IDs" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Open Order ID" value="#88410221" />
            <StitchDetailRow label="Close Order ID" value="#88439900" />
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="payments" title="P&L" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Profit" value={<span className="text-tp">{money(5300)}</span>} />
            <StitchDetailRow label="Commission" value="-$7.20" />
            <StitchDetailRow label="Swap" value="-$1.10" />
            <StitchDetailRow label="Net Profit" value={<span className="font-serif text-base font-bold text-tp">{money(5291.7)}</span>} />
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="shield" title="Risk & Flags" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Stop Loss" value="2298.10" />
            <StitchDetailRow label="Take Profit" value="2338.90" />
            <StitchDetailRow label="RR Ratio" value="1 : 2.8" />
            <StitchDetailRow label="Is Partial" value="No" />
            <StitchDetailRow label="Close Reason" value={editing ? <select className="h-7 rounded bg-sfc-lowest px-2 text-xs"><option>Take Profit</option><option>Stop Loss</option><option>Manual</option><option>System</option><option>Liquidation</option></select> : <StitchPill tone="positive">Take Profit</StitchPill>} />
          </div>
        </StitchCard>
      </div>

      {/* Audit history preview */}
      <StitchCard>
        <StitchCardHeader icon="history" title="Audit History" description="5 most recent entries for this position" right={<StitchButton variant="ghost" onClick={() => toast({ title: "Full history opened" })}>View full history</StitchButton>} />
        <StitchTimeline
          items={[
            { dotClass: "bg-tp", title: "Position closed at Take Profit", time: "May 21 15:42", body: "Bridge confirmed fill at 2338.90." },
            { dotClass: "bg-tsc", title: "SL modified to breakeven+", time: "May 21 11:20", body: "Trader adjusted stop via mobile terminal." },
            { dotClass: "bg-tsc", title: "Position opened", time: "May 20 09:14", body: "2.00 lots XAUUSD at 2312.40." },
          ]}
        />
      </StitchCard>

      <StitchActionBar
        left={<StitchButton variant="destructive" icon="delete_forever" onClick={() => setDeleteOpen(true)}>Delete Closed Position</StitchButton>}
        right={
          <>
            <StitchButton variant="ghost" onClick={() => navigate("closed-positions")}>Back to Closed Positions</StitchButton>
            <StitchButton variant="surface" icon="save" onClick={() => toast({ title: "Saved — still editing" })}>Save and Continue</StitchButton>
            <StitchButton variant="primary" icon="save" onClick={() => toast({ title: "Changes saved" })}>Save Changes</StitchButton>
          </>
        }
      />

      {/* Wired state screens */}
      <StitchConfirm
        open={deleteOpen} onOpenChange={setDeleteOpen} icon="shield" title="Delete closed position?"
        body="This trade record will be permanently deleted. The position data, P&L, and audit trail will be lost."
        confirmLabel="Delete permanently"
        onConfirm={() => { toast({ title: "Position deleted" }); navigate("closed-positions"); }}
      />
      <StitchConfirm
        open={reopenOpen} onOpenChange={setReopenOpen} icon="undo" title="Reopen pos-908412?"
        body="The position will return to the open-positions list with the original entry price and volume."
        confirmLabel="Reopen"
        destructive={false}
        onConfirm={() => toast({ title: "Position reopened" })}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Reopen at Price"><Input className="stitch-input" defaultValue="2338.90" /></Field>
          <Field label="Reopen Volume"><Input className="stitch-input" defaultValue="2.00" /></Field>
        </div>
        <Field label="Reason (required)"><Textarea className="stitch-input" /></Field>
      </StitchConfirm>
      <StitchConfirm
        open={reverseOpen} onOpenChange={setReverseOpen} icon="swap_vert" title="Open reverse trade?"
        body="An opposite-side position will be opened at the close price of this trade."
        confirmLabel="Open Reverse"
        destructive={false}
        onConfirm={() => toast({ title: "Reverse position opened" })}
      >
        <Field label="Volume"><Input className="stitch-input" defaultValue="2.00" /></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Use current market price<Switch defaultChecked /></label>
      </StitchConfirm>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Trading Credentials (view-id: trading-credentials)               */
/* ═══════════════════════════════════════════════════════════════ */

export function TradingCredentialsStitchPage() {
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [rotateOpen, setRotateOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Security banner */}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-sfc-low p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tp/10 text-tp"><MsIconSafe name="lock" /></span>
          <div>
            <p className="font-serif text-sm font-bold text-ink">Credential Security Notice</p>
            <p className="text-xs text-ink-variant">Every reveal, copy and rotation of these credentials is audit-logged with your admin ID, IP and timestamp.</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-tp-fixed px-3 py-1 text-[11px] font-bold text-tp-fixed-variant"><span className="h-2 w-2 animate-pulse rounded-full bg-tp" />SSL / TLS 1.3</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader icon="dns" title="Platform Connection Details" right={<StitchPill tone="info">Primary Routing</StitchPill>} />
          <div className="space-y-2">
            {[
              { l: "Platform", v: "MetaTrader 5" },
              { l: "Trading Server", v: "Terra-LD4-01.equinix.com:443" },
              { l: "Login Account ID", v: "882049" },
              { l: "Server IP", v: "185.193.38.10" },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5">
                <span className="text-xs font-medium text-tsc">{r.l}</span>
                <span className="flex items-center gap-2"><span className="font-mono text-xs font-semibold text-ink">{r.v}</span>
                  <button aria-label={`Copy ${r.l}`} className="text-tp hover:text-ink" onClick={() => toast({ title: `${r.l} copied` })}><MsIconSafe name="content_copy" /></button>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink"><span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-tp opacity-75" /><span className="relative h-2 w-2 rounded-full bg-tp" /></span>Server Online</span>
            <span className="text-xs text-ink-variant">Ping 14ms · London Equinix LD4 · <StitchPill tone="positive">99.98%</StitchPill></span>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-tsc">Network Hop Distribution</p>
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              <div className="h-full bg-tp" style={{ width: "62%" }} /><div className="h-full bg-tt" style={{ width: "24%" }} /><div className="h-full bg-tsc" style={{ width: "14%" }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-variant"><span>LD4 62%</span><span>NY4 24%</span><span>FRA 14%</span></div>
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="key" title="Account Access Passwords" description="Master grants trading, investor read-only" right={revealed ? <StitchPill tone="warning">Revealed — audit logged</StitchPill> : null} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5">
              <span className="text-xs font-medium text-tsc">Master Password</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{revealed ? "Xk9#mQ2$vL7p" : "••••••••••"}</span>
                <StitchButton variant="surface" className="h-7 px-2" icon="visibility" onClick={() => setRevealOpen(true)}>Reveal</StitchButton>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5">
              <span className="text-xs font-medium text-tsc">Investor Password</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-ink">••••••••</span>
                <StitchButton variant="surface" className="h-7 px-2" icon="visibility" onClick={() => { setRevealed(true); toast({ title: "Investor password revealed", description: "This action has been audit-logged." }); }}>Reveal</StitchButton>
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <StitchButton variant="surface" icon="content_copy" onClick={() => toast({ title: "Credentials copied" })}>Copy All</StitchButton>
              <StitchButton variant="destructive" icon="key" onClick={() => setRotateOpen(true)}>Rotate Password</StitchButton>
            </div>
          </div>
        </StitchCard>
      </div>

      <StitchCard>
        <StitchCardHeader icon="download" title="Download & Launch Trading Platform" description="Official builds and connection guides" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { i: "desktop_windows", t: "Desktop Terminal", d: "Windows / macOS · v5.12" },
            { i: "language", t: "Web Terminal", d: "Launch in browser — no install" },
            { i: "menu_book", t: "Setup Guide", d: "Connection walkthrough (PDF)" },
          ].map((d) => (
            <button key={d.t} onClick={() => toast({ title: `${d.t} — download started` })} className="group flex items-center gap-3 rounded-xl bg-sfc-low p-4 text-left transition-shadow hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tp/10 text-tp"><MsIconSafe name={d.i} /></span>
              <span className="min-w-0"><span className="block text-xs font-bold text-ink group-hover:text-tp">{d.t}</span><span className="block text-[10px] text-ink-variant">{d.d}</span></span>
            </button>
          ))}
        </div>
      </StitchCard>

      {/* Wired state screens */}
      <StitchConfirm
        open={revealOpen} onOpenChange={(o) => { setRevealOpen(o); if (!o) setRevealed(true); }} icon="lock_open"
        title="Reveal master password?"
        body="The master password will be shown once. This reveal is recorded in the audit trail with your admin ID, IP address and timestamp."
        confirmLabel="Reveal Password"
        destructive={false}
        onConfirm={() => toast({ title: "Master password revealed", description: "Audit entry recorded." })}
      />
      <RotateSheet open={rotateOpen} onOpenChange={setRotateOpen} />
    </div>
  );
}

function RotateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [send, setSend] = React.useState(true);
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="key" title="Rotate password"
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Password rotated" }); }}>Rotate</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="New Password"><div className="flex gap-2"><Input className="stitch-input font-mono" defaultValue="Rt4$pW8!zQ1n" /><StitchButton variant="surface" icon="casino" onClick={() => toast({ title: "Regenerated" })}>Regen</StitchButton></div></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Send to trader<Switch checked={send} onCheckedChange={setSend} /></label>
        <Field label="Audit Reason (required)"><Textarea className="stitch-input" /></Field>
      </div>
    </StitchSheet>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* NEW — Trader Comparison (view-id: trader-comparison)             */
/* ═══════════════════════════════════════════════════════════════ */

export function TraderComparisonStitchPage() {
  const { navigate } = usePlatform();
  const [pickOpen, setPickOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const traders = getTenantTraders("tenant-alpha").slice(0, 3);

  const metrics = [
    { m: "Equity", f: (t: (typeof traders)[number]) => money(t.equity, "USD", true) },
    { m: "Total P&L", f: (t: (typeof traders)[number]) => money(t.totalPnl, "USD", true) },
    { m: "Trades", f: (t: (typeof traders)[number]) => String(t.trades) },
    { m: "Win Rate", f: (t: (typeof traders)[number]) => `${t.winRate}%` },
    { m: "Status", f: (t: (typeof traders)[number]) => t.status },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="compare_arrows"
        title="Trader Comparison"
        subtitle="Side-by-side performance comparison across selected traders."
        actions={
          <>
            <StitchButton variant="surface" icon="schedule_send" onClick={() => setScheduleOpen(true)}>Schedule Report</StitchButton>
            <StitchButton variant="primary" icon="person_search" onClick={() => setPickOpen(true)}>Pick Traders</StitchButton>
          </>
        }
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(r) => r.m}
          rows={metrics}
          columns={[
            { header: "Metric", cell: (r) => <span className="font-bold text-ink">{r.m}</span> },
            ...traders.map((t) => ({ header: t.name, cell: (r: (typeof metrics)[number]) => <span className="text-ink">{r.f(t)}</span> })),
          ]}
          emptyState={<StitchEmpty icon="compare_arrows" title="No traders selected" body="Pick two or more traders to compare their performance side by side." />}
        />
      </StitchCard>

      <StitchCard>
        <StitchCardHeader icon="monitoring" title="Equity Curves Overlay" description="30-day normalized equity progression" />
        <div className="h-56">
          <OverlayCurve />
        </div>
      </StitchCard>

      <StitchSheet
        open={pickOpen} onOpenChange={setPickOpen} icon="person_search" wide title="Pick traders"
        description="Choose 2-4 traders to compare"
        footer={<>
          <StitchButton variant="surface" onClick={() => setPickOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setPickOpen(false); toast({ title: "Comparison updated" }); }}>Compare</StitchButton>
        </>}
      >
        <div className="space-y-2">
          {getTenantTraders("tenant-alpha").slice(0, 6).map((t, i) => (
            <label key={t.id} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
              <span className="flex items-center gap-2.5"><Checkbox defaultChecked={i < 3} className="border-ink-variant/40" />{t.name}<span className="text-ink-variant">· {t.country}</span></span>
              <span className="font-mono text-[11px] text-ink-variant">{money(t.equity, "USD", true)}</span>
            </label>
          ))}
        </div>
      </StitchSheet>

      <StitchSheet
        open={scheduleOpen} onOpenChange={setScheduleOpen} icon="schedule_send" title="Schedule comparison report"
        footer={<>
          <StitchButton variant="surface" onClick={() => setScheduleOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setScheduleOpen(false); toast({ title: "Report scheduled" }); }}>Schedule</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Cadence">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Weekly (Monday 08:00)</option><option>Monthly (1st, 08:00)</option></select>
          </Field>
          <Field label="Recipients"><Input className="stitch-input" placeholder="ops@firm.com, ceo@firm.com" /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

function OverlayCurve() {
  const w = 640, h = 200;
  const series = [
    { c: "#4a7c59", pts: Array.from({ length: 30 }, (_, i) => 0.6 + Math.sin(i / 4) * 0.05 + i * 0.012) },
    { c: "#705c30", pts: Array.from({ length: 30 }, (_, i) => 0.45 + Math.sin(i / 5 + 2) * 0.06 + i * 0.008) },
    { c: "#6b6358", pts: Array.from({ length: 30 }, (_, i) => 0.35 + Math.sin(i / 3 + 1) * 0.04 + i * 0.005) },
  ];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      {series.map((s, si) => {
        const p = s.pts.map((v, i) => [20 + (i / 29) * (w - 40), h - 10 - v * (h - 30)] as const);
        const d = p.map((q, i) => (i === 0 ? `M ${q[0]} ${q[1]}` : `L ${q[0]} ${q[1]}`)).join(" ");
        return <path key={si} d={d} fill="none" stroke={s.c} strokeWidth="2.5" strokeLinecap="round" />;
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* NEW — Bridge Sync Log (view-id: bridge-sync-log)                 */
/* ═══════════════════════════════════════════════════════════════ */

export function BridgeSyncLogStitchPage() {
  const [detail, setDetail] = React.useState<(typeof LOG)[number] | null>(null);
  const [retryOpen, setRetryOpen] = React.useState(false);
  const LOG = [
    { id: "sync-8841", at: "May 28 14:25:08", type: "POSITION_SYNC", account: "MT5-882049", status: "completed", latency: "48ms", rows: 312 },
    { id: "sync-8840", at: "May 28 14:02:11", type: "EQUITY_SYNC", account: "MT5-882049", status: "completed", latency: "22ms", rows: 1 },
    { id: "sync-8839", at: "May 28 13:40:02", type: "HISTORY_SYNC", account: "DX-441200", status: "failed", latency: "—", rows: 0 },
    { id: "sync-8838", at: "May 28 13:12:44", type: "BALANCE_SYNC", account: "MT4-771410", status: "completed", latency: "31ms", rows: 4 },
    { id: "sync-8837", at: "May 28 12:59:19", type: "POSITION_SYNC", account: "MT5-882049", status: "partial", latency: "310ms", rows: 141 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="sync"
        title="Bridge Sync Log"
        subtitle="Every bridge synchronization run — outcome, latency and row counts."
        actions={<StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready" })}>Export CSV</StitchButton>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Syncs (24h)" value={1842} icon="sync" />
        <StitchKpi label="Completed" value={1811} tone="positive" icon="check_circle" />
        <StitchKpi label="Partial" value={28} tone="warning" icon="rule" />
        <StitchKpi label="Failed" value={3} tone="negative" icon="error" />
      </section>

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(r) => r.id}
          onRowClick={(r) => setDetail(r)}
          rows={LOG}
          columns={[
            { header: "Run", cell: (r) => <StitchMonoChip>{r.id}</StitchMonoChip> },
            { header: "Time", cell: (r) => <span className="font-mono text-[11px] text-ink-variant">{r.at}</span> },
            { header: "Type", cell: (r) => <StitchPill tone="info">{r.type}</StitchPill> },
            { header: "Account", cell: (r) => <span className="font-mono text-xs">{r.account}</span> },
            { header: "Status", cell: (r) => <StitchStateBadge state={r.status} tone={toneFor(r.status)} meaning={`Bridge sync ${r.status}`} /> },
            { header: "Latency", cell: (r) => r.latency, numeric: true },
            { header: "Rows", cell: (r) => r.rows, numeric: true },
          ]}
          emptyState={<StitchEmpty icon="sync_problem" title="No sync runs" body="Bridge synchronization runs will appear here with latency and outcome." />}
        />
      </StitchCard>

      {/* Detail sheet */}
      <StitchSheet
        open={!!detail} onOpenChange={(o) => !o && setDetail(null)} icon="sync" wide
        title={`Sync ${detail?.id ?? ""}`} description={detail ? `${detail.type} · ${detail.account}` : ""}
        footer={
          detail?.status !== "completed" ? (
            <>
              <StitchButton variant="surface" onClick={() => setDetail(null)}>Close</StitchButton>
              <StitchButton variant="primary" icon="refresh" onClick={() => { setRetryOpen(true); setDetail(null); }}>Retry / Replay</StitchButton>
            </>
          ) : (
            <StitchButton variant="primary" onClick={() => setDetail(null)}>Close</StitchButton>
          )
        }
      >
        {detail ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Run ID" value={detail.id} />
            <StitchDetailRow label="Type" value={detail.type} />
            <StitchDetailRow label="Account" value={detail.account} />
            <StitchDetailRow label="Status" value={<StitchStateBadge state={detail.status} tone={toneFor(detail.status)} />} />
            <StitchDetailRow label="Latency" value={detail.latency} />
            <StitchDetailRow label="Rows Synced" value={detail.rows} />
            <div className="sm:col-span-2">
              <p className="mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-tsc">Step timeline</p>
              <StitchStepper steps={[
                { label: "Connect to bridge", time: "0.2s", state: "done", body: "TLS handshake with LD4 gateway." },
                { label: "Fetch deltas", time: "0.8s", state: detail.status === "failed" ? "pending" : "done", body: `${detail.rows} rows requested.` },
                { label: "Apply + reconcile", time: detail.status === "failed" ? "—" : "0.4s", state: detail.status === "failed" ? "pending" : "done", body: detail.status === "partial" ? "Timed out mid-batch — partial application." : "Ledger reconciled with zero drift." },
              ]} />
            </div>
          </div>
        ) : null}
      </StitchSheet>

      {/* Retry progress state */}
      <StitchSheet
        open={retryOpen} onOpenChange={setRetryOpen} icon="refresh" title="Replaying sync…"
        description="Re-dispatching the failed run against the bridge"
        footer={<StitchButton variant="surface" onClick={() => { setRetryOpen(false); toast({ title: "Replay completed" }); }}>Done</StitchButton>}
      >
        <StitchTimeline
          items={[
            { dotClass: "bg-tp", title: "Replay dispatched", time: "0:00", body: "Run sync-8839 re-queued with backoff." },
            { dotClass: "bg-tp", title: "Bridge acknowledged", time: "0:02", body: "LD4 gateway accepted the replay." },
            { dotClass: "bg-tt", title: "Applying deltas…", time: "running", body: "HISTORY_SYNC 842 rows in progress." },
          ]}
        />
      </StitchSheet>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* NEW — Trader Audit Log (view-id: trader-audit-log)               */
/* ═══════════════════════════════════════════════════════════════ */

export function TraderAuditLogStitchPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const entries = getTenantAudit(tid).slice(0, 14);
  const [subOpen, setSubOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = entries.filter((e) => !query || `${e.action} ${e.actor} ${e.entity}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="fact_check"
        title="Trader Audit Log"
        subtitle="Cross-account activity trail for this trader — logins, trades, config changes."
        actions={
          <>
            <StitchButton variant="surface" icon="notifications_add" onClick={() => setSubOpen(true)}>Subscribe</StitchButton>
            <StitchButton variant="surface" icon="compare_arrows" onClick={() => setCompareOpen(true)}>Compare to Previous Period</StitchButton>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${filtered.length} entries exported.` })}>Export</StitchButton>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by action, actor or entity…" className="h-8 w-64 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none placeholder:text-ink-muted focus:ring-1 focus:ring-tp" />
        <span className="text-xs text-ink-variant">{filtered.length} of {entries.length} entries</span>
      </div>

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(e) => e.id}
          rows={filtered}
          columns={[
            { header: "Timestamp", cell: (e) => <span className="font-mono text-[11px] text-ink-variant">{e.timestamp}</span> },
            { header: "Action", cell: (e) => <StitchPill tone="info">{e.action}</StitchPill> },
            { header: "Actor", cell: (e) => e.actor },
            { header: "Entity", cell: (e) => <span className="text-ink">{e.entity}</span> },
            { header: "Summary", cell: (e) => <span className="text-ink-variant">{e.summary}</span> },
            { header: "Severity", cell: (e) => <StitchPill tone={e.severity === "critical" ? "negative" : e.severity === "warning" ? "warning" : "muted"}>{e.severity}</StitchPill> },
          ]}
          emptyState={<StitchEmpty icon="fact_check" title="No audit entries" body="Actions on this trader's accounts will appear here." />}
        />
      </StitchCard>

      <StitchSheet
        open={subOpen} onOpenChange={setSubOpen} icon="notifications_add" title="Subscribe to audit events"
        footer={<>
          <StitchButton variant="surface" onClick={() => setSubOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setSubOpen(false); toast({ title: "Subscription created" }); }}>Subscribe</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Channels"><div className="flex gap-2">{["Email", "Slack", "Webhook"].map((c, i) => <label key={c} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sfc-low px-3 py-2 text-xs font-medium text-ink"><Checkbox defaultChecked={i === 0} className="border-ink-variant/40" />{c}</label>)}</div></Field>
          <Field label="Event Types"><div className="flex flex-wrap gap-1.5">{["login", "trade", "config-change", "payout", "breach"].map((t) => <StitchPill key={t} tone="info">{t} ×</StitchPill>)}</div></Field>
        </div>
      </StitchSheet>

      <StitchSheet
        open={compareOpen} onOpenChange={setCompareOpen} icon="compare_arrows" title="Compare to previous period"
        description="Volume of audit activity vs the prior 30 days"
        footer={<StitchButton variant="primary" onClick={() => setCompareOpen(false)}>Close</StitchButton>}
      >
        <div className="space-y-2">
          {[
            { k: "Logins", now: 48, prev: 41 },
            { k: "Trades", now: 312, prev: 288 },
            { k: "Config changes", now: 6, prev: 11 },
            { k: "Payout events", now: 2, prev: 3 },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs">
              <span className="font-semibold text-ink">{r.k}</span>
              <span className="flex items-center gap-3 font-mono">
                <span className="text-ink-variant">prev {r.prev}</span>
                <span className="text-ink">{r.now}</span>
                <StitchPill tone={r.now >= r.prev ? "positive" : "negative"}>{r.now >= r.prev ? "+" : ""}{Math.round(((r.now - r.prev) / Math.max(1, r.prev)) * 100)}%</StitchPill>
              </span>
            </div>
          ))}
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* NEW — MT4/DXTrade Server Config Catalog (mt4-dxtrade-server-catalog) */
/* ═══════════════════════════════════════════════════════════════ */

export function ServerCatalogStitchPage() {
  const [addOpen, setAddOpen] = React.useState(false);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const SERVERS = [
    { name: "Terra-LD4-01", platform: "MT4", region: "London LD4", status: "online", latency: "6ms", accounts: 412 },
    { name: "Terra-NY4-02", platform: "MT4", region: "New York NY4", status: "online", latency: "22ms", accounts: 188 },
    { name: "DX-Cloud-EU", platform: "DXTrade", region: "Frankfurt", status: "degraded", latency: "87ms", accounts: 96 },
    { name: "DX-Cloud-US", platform: "DXTrade", region: "Ashburn", status: "online", latency: "18ms", accounts: 143 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="dns"
        title="Server Config Catalog"
        subtitle="MT4 / DXTrade server endpoints available for account provisioning."
        actions={<StitchButton variant="primary" icon="add" onClick={() => setAddOpen(true)}>Add Server</StitchButton>}
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(s) => s.name}
          rows={SERVERS}
          columns={[
            { header: "Server", cell: (s) => <span className="font-mono text-xs font-bold text-ink">{s.name}</span> },
            { header: "Platform", cell: (s) => <StitchPill tone="info">{s.platform}</StitchPill> },
            { header: "Region", cell: (s) => s.region },
            { header: "Status", cell: (s) => <StitchStateBadge state={s.status} tone={toneFor(s.status)} /> },
            { header: "Latency", cell: (s) => s.latency, numeric: true },
            { header: "Accounts", cell: (s) => s.accounts, numeric: true },
            {
              header: "",
              cell: () => <StitchButton variant="surface" className="h-7 px-2" icon="speed" onClick={() => setDiagOpen(true)}>Test</StitchButton>,
            },
          ]}
          emptyState={<StitchEmpty icon="dns" title="No servers configured" body="Add an MT4 or DXTrade server endpoint to enable provisioning on that platform." />}
        />
      </StitchCard>

      <StitchSheet
        open={addOpen} onOpenChange={setAddOpen} icon="add" title="Add server"
        description="Registers a new provisioning endpoint"
        footer={<>
          <StitchButton variant="surface" onClick={() => setAddOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setAddOpen(false); toast({ title: "Server added" }); }}>Add Server</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Server Name"><Input className="stitch-input font-mono" placeholder="Terra-FRA-03" /></Field>
          <Field label="Platform"><select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>MT4</option><option>DXTrade</option></select></Field>
          <Field label="Region"><Input className="stitch-input" placeholder="Frankfurt" /></Field>
          <Field label="Endpoint"><Input className="stitch-input font-mono" placeholder="host:443" /></Field>
          <Field label="Max Accounts"><Input className="stitch-input" type="number" defaultValue={500} /></Field>
        </div>
      </StitchSheet>

      {/* Diagnostics modal */}
      <StitchSheet
        open={diagOpen} onOpenChange={setDiagOpen} icon="speed" title="Connection test"
        description="Diagnostic ping sequence"
        footer={<StitchButton variant="primary" onClick={() => setDiagOpen(false)}>Done</StitchButton>}
      >
        <StitchTimeline
          items={[
            { dotClass: "bg-tp", title: "DNS resolution", time: "4ms", body: "Resolved to 185.193.38.10." },
            { dotClass: "bg-tp", title: "TLS handshake", time: "11ms", body: "TLS 1.3 · X25519 · valid certificate." },
            { dotClass: "bg-tp", title: "Auth probe", time: "9ms", body: "API key accepted, scopes OK." },
            { dotClass: "bg-tt", title: "Load probe", time: "in progress", body: "Measuring throughput under 50 concurrent sessions…" },
          ]}
        />
      </StitchSheet>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* NEW — Bulk Account Operations (bulk-account-operations)          */
/* ═══════════════════════════════════════════════════════════════ */

export function BulkAccountOperationsStitchPage() {
  const { navigate } = usePlatform();
  const accounts = getTenantAccounts("tenant-alpha");
  const [step, setStep] = React.useState(0);
  const [op, setOp] = React.useState("block");
  const [selected, setSelected] = React.useState<Set<string>>(new Set(accounts.slice(0, 3).map((a) => a.id)));
  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const STEPS = ["Select Operation", "Select Accounts", "Configure", "Review & Execute"];

  const OPS = [
    { v: "block", l: "Block accounts", i: "block", d: "Immediately revoke trading access. Reversible." },
    { v: "reset", l: "Reset accounts", i: "restart_alt", d: "Restore initial balance and discard progress. Irreversible." },
    { v: "rotate", l: "Rotate passwords", i: "key", d: "Generate new master passwords and email traders." },
    { v: "sync", l: "Force bridge sync", i: "sync", d: "Re-run a full reconciliation for each account." },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="layers"
        title="Bulk Account Operations"
        subtitle="Apply an operation to many accounts safely, with review and full audit."
        actions={<StitchButton variant="surface" icon="history" onClick={() => setHistoryOpen(true)}>Operation History</StitchButton>}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 rounded-xl bg-sfc-low p-4 shadow-sm">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", i < step ? "bg-tp text-on-primary" : i === step ? "border-2 border-tp bg-sfc-lowest text-tp" : "bg-sfc text-ink-muted")}>{i < step ? <MsIconSafe name="check" /> : i + 1}</span>
              <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-ink-variant")}>{s}</span>
            </div>
            {i < STEPS.length - 1 ? <div className={cn("h-0.5 flex-1", i < step ? "bg-tp" : "bg-sfc-high")} /> : null}
          </React.Fragment>
        ))}
      </div>

      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {OPS.map((o) => (
            <button key={o.v} type="button" onClick={() => setOp(o.v)} className={cn("rounded-xl p-4 text-left transition-shadow", op === o.v ? "bg-tp-fixed/50 ring-2 ring-tp" : "bg-sfc-lowest shadow-sm hover:shadow-md")}>
              <span className="flex items-center gap-2.5 text-sm font-bold text-ink"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-tp/10 text-tp"><MsIconSafe name={o.i} /></span>{o.l}</span>
              <p className="mt-1.5 pl-12 text-xs text-ink-variant">{o.d}</p>
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <StitchCard className="p-0">
          <StitchTable
            keyOf={(a) => a.id}
            rows={accounts}
            columns={[
              { header: "", cell: (a) => <Checkbox checked={selected.has(a.id)} onCheckedChange={() => setSelected((p) => { const n = new Set(p); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} className="border-ink-variant/40" />, className: "w-10" },
              { header: "Login", cell: (a) => <StitchMonoChip>{a.login}</StitchMonoChip> },
              { header: "Trader", cell: (a) => a.traderName },
              { header: "Status", cell: (a) => <StitchStateBadge state={a.status} tone={toneFor(a.status)} /> },
              { header: "Equity", cell: (a) => money(a.equity), numeric: true },
            ]}
          />
          <div className="border-t border-sfc-high px-4 py-2.5 text-xs text-ink-variant">{selected.size} accounts selected</div>
        </StitchCard>
      ) : null}

      {step === 2 ? (
        <StitchCard>
          <StitchCardHeader icon="tune" title="Operation options" description={OPS.find((o) => o.v === op)?.d} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason (required)"><Textarea className="stitch-input" placeholder="Why is this bulk operation being run?" /></Field>
            <Field label="Schedule"><select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Execute immediately</option><option>Next maintenance window</option></select></Field>
            <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Notify affected traders<Switch defaultChecked /></label>
          </div>
        </StitchCard>
      ) : null}

      {step === 3 ? (
        <StitchCard>
          <StitchCardHeader icon="fact_check" title="Review & Execute" description="Confirm the operation before it is dispatched" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Operation" value={OPS.find((o) => o.v === op)?.l} />
            <StitchDetailRow label="Accounts" value={`${selected.size} selected`} />
            <StitchDetailRow label="Schedule" value="Immediately" />
            <StitchDetailRow label="Notify traders" value="Yes" />
          </div>
        </StitchCard>
      ) : null}

      <div className="flex items-center justify-between rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <StitchButton variant="ghost" icon="arrow_back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</StitchButton>
        {step < 3 ? (
          <StitchButton variant="primary" disabled={step === 1 && selected.size === 0} onClick={() => setStep((s) => Math.min(3, s + 1))}>Next</StitchButton>
        ) : (
          <StitchButton variant="primary" icon="rocket_launch" onClick={() => setExecuteOpen(true)}>Execute Operation</StitchButton>
        )}
      </div>
      {/* navigate is exercised through row actions and the back link */}

      {/* Execute confirm (step_4_review_execute_alertdialog_state) */}
      <StitchConfirm
        open={executeOpen} onOpenChange={setExecuteOpen} icon="rocket_launch"
        title={`Execute ${OPS.find((o) => o.v === op)?.l.toLowerCase()} on ${selected.size} accounts?`}
        body="This will be applied immediately to every selected account and recorded as a single audited bulk operation."
        confirmLabel="Execute"
        onConfirm={() => { setExecuteOpen(false); toast({ title: "Bulk operation dispatched", description: `${selected.size} accounts queued.` }); setStep(0); }}
      />

      {/* History sheet (operation_history_sheet_state) */}
      <StitchSheet
        open={historyOpen} onOpenChange={setHistoryOpen} icon="history" wide
        title="Operation History" description="Past bulk operations and their outcomes"
        footer={<StitchButton variant="primary" onClick={() => setHistoryOpen(false)}>Close</StitchButton>}
      >
        <StitchTable
          keyOf={(r) => r.id}
          rows={[
            { id: "bulk-441", op: "Rotate passwords", count: 118, by: "Sarah Chen", at: "May 27 09:12", status: "completed" },
            { id: "bulk-440", op: "Force bridge sync", count: 312, by: "System", at: "May 26 02:00", status: "completed" },
            { id: "bulk-439", op: "Block accounts", count: 4, by: "Aiden Lloyd", at: "May 25 16:40", status: "partial" },
          ]}
          columns={[
            { header: "Run", cell: (r) => <StitchMonoChip>{r.id}</StitchMonoChip> },
            { header: "Operation", cell: (r) => r.op },
            { header: "Accounts", cell: (r) => r.count, numeric: true },
            { header: "By", cell: (r) => r.by },
            { header: "When", cell: (r) => <span className="text-ink-variant">{r.at}</span> },
            { header: "Status", cell: (r) => <StitchStateBadge state={r.status} tone={toneFor(r.status)} /> },
          ]}
        />
      </StitchSheet>


    </div>
  );
}
