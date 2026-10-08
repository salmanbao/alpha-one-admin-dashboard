"use client";

/**
 * Account Workspace cluster — Stitch conversion (Batches 2-3)
 *
 * From stitch_screens:
 *  - account_workspace_mt5_882049_elena_althaus
 *  - account_workspace_block_account_risk_quarantine_confirmation_state
 *  - account_workspace_sync_bridge_reconciliation_modal_state
 *  - account_broker_details_* (base + edit mode + bridge connection log)
 *  - account_kyc_statuses_* (base + doc inspection + mark all approved)
 *  - account_related_accounts_* (base + link account + compare)
 *  - account_configuration_* (base + resend credentials + reset confirm)
 *  - account_events_* (base + event detail + subscribe)
 *  - account_version_history_* (base + compare versions + revert confirm)
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantTraders,
  getTenantKyc,
  getTenantPositions,
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
  StitchProgress,
  StitchMonoChip,
  StitchEmpty,
  StitchSegmented,
  StitchInfoHint,
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
function money(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function toneFor(s: string): "positive" | "negative" | "warning" | "info" | "muted" {
  switch (s) {
    case "active": case "connected": case "approved": return "positive";
    case "breached": case "rejected": case "blocked": return "negative";
    case "pending": case "review": return "warning";
    case "passed": case "info": return "info";
    default: return "muted";
  }
}

const TABS = [
  { id: "configuration", label: "Configuration", icon: "settings" },
  { id: "events", label: "Events", icon: "history" },
  { id: "versions", label: "Version History", icon: "difference" },
  { id: "broker", label: "Broker Details", icon: "dns" },
  { id: "kyc", label: "KYC Statuses", icon: "verified_user" },
  { id: "related", label: "Related Accounts", icon: "link" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AccountWorkspaceStitchPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = getTenantAccounts(tid);
  const account = accounts[0] ?? {
    id: "a0", tenantId: tid, traderId: "t0", traderName: "Elena Althaus", login: "MT5-882049",
    platform: "MT5" as const, type: "funded" as const, phase: "funded" as const,
    balance: 100000, equity: 106720, leverage: "1:100", currency: "USD", status: "active" as const, createdAt: "",
  };
  const trader = getTenantTraders(tid).find((t) => t.id === account.traderId);
  const positions = getTenantPositions(tid).filter((p) => p.accountId === account.id);

  const [tab, setTab] = React.useState<TabId>("configuration");
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  const pnl = account.equity - account.balance;

  return (
    <div className="flex flex-col gap-6">
      <button className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-tp transition-colors hover:bg-sfc" onClick={() => navigate("trading-accounts")}>
        <MsIconSafe name="arrow_back" /> Back to Accounts
      </button>

      <StitchPageHeader
        icon="account_balance_wallet"
        title={`Account ${account.login}`}
        subtitle={`${account.platform} · ${trader?.name ?? "Trader"} · ${account.type}`}
        actions={
          <>
            <StitchButton variant="surface" icon="open_in_new" onClick={() => navigate("trader-detail")}>View Trader</StitchButton>
            <StitchButton variant="surface" icon="sticky_note_2" onClick={() => setNoteOpen(true)}>Add Note</StitchButton>
            <StitchButton variant="surface" icon="sync" onClick={() => setSyncOpen(true)}>Sync Account</StitchButton>
            <StitchButton variant="destructive" icon="block" onClick={() => setBlockOpen(true)}>Block</StitchButton>
          </>
        }
      />

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StitchKpi label="Balance" value={money(account.balance, currency)} icon="account_balance" hint="Initial + realized" />
        <StitchKpi
          label="Equity" value={money(account.equity, currency)}
          delta={`${pnl >= 0 ? "+" : ""}${((pnl / Math.max(1, account.balance)) * 100).toFixed(1)}%`}
          icon="show_chart" hint={pnl >= 0 ? "P&L direction positive" : "P&L direction negative"}
        />
        <StitchKpi label="Status" value={account.status} icon="toggler" tone={account.status === "active" ? "positive" : "default"} hint="Live from bridge" />
        <StitchKpi label="Phase" value={account.phase} icon="alt_route" hint="Provisioned objective set" />
      </section>

      {/* Status badge row */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sfc-low px-4 py-2.5 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-widest text-tsc">Account ID</span>
        <StitchMonoChip>{account.id}</StitchMonoChip>
        <StitchStateBadge state={account.status} tone={toneFor(account.status)} meaning="Live account state" />
        <StitchPill tone="muted">{account.platform}</StitchPill>
        <StitchPill tone="info">{account.type}</StitchPill>
        <StitchPill tone="muted">{account.phase}</StitchPill>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl bg-sfc-low p-1 shadow-sm">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn("no-scrollbar shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors", tab === t.id ? "bg-tp text-on-primary shadow-sm" : "text-ink-variant hover:bg-sfc hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "configuration" ? <ConfigurationTab account={account} onBlock={() => setBlockOpen(true)} onReset={() => setResetOpen(true)} /> : null}
      {tab === "events" ? <EventsTab /> : null}
      {tab === "versions" ? <VersionHistoryTab /> : null}
      {tab === "broker" ? <BrokerDetailsTab account={account} /> : null}
      {tab === "kyc" ? <KycTab account={account} /> : null}
      {tab === "related" ? <RelatedAccountsTab account={account} accounts={accounts} /> : null}

      {/* Shared sheets */}
      <AddNoteSheet open={noteOpen} onOpenChange={setNoteOpen} />
      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
      <StitchConfirm
        open={blockOpen} onOpenChange={setBlockOpen} icon="block"
        title={`Block ${account.login}?`}
        body="The account will be immediately blocked and the trader will lose all trading access. This action is logged in the audit trail."
        confirmLabel="Block account"
        onConfirm={() => toast({ title: "Account blocked", description: account.login })}
      />
      <ResetAccountConfirm open={resetOpen} onOpenChange={setResetOpen} login={account.login} />
    </div>
  );
}

/* ═══════════════ Configuration tab (account_configuration) ═══════════════ */

function ConfigurationTab({ account, onBlock, onReset }: { account: ReturnType<typeof getTenantAccounts>[number]; onBlock: () => void; onReset: () => void }) {
  const currency = account.currency;
  const [resendOpen, setResendOpen] = React.useState(false);
  const drawdownPct = Math.abs(((account.balance - account.equity) / Math.max(1, account.balance)) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* Health strip */}
      <StitchCard>
        <StitchCardHeader icon="health_and_safety" title="Account Health" description="Objective consumption at a glance" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Meter label="Drawdown" used={drawdownPct} detail={`${drawdownPct.toFixed(1)}% of 10% limit`} />
          <Meter label="Profit Target" used={72} detail="$7,200 of $10,000" tone="positive" />
          <Meter label="Days Remaining" used={45} detail="14 of 30 days used" />
        </div>
      </StitchCard>

      <StitchCard>
        <StitchCardHeader icon="settings" title="Account Configuration" description="Provisioning, payout policy and ordering" right={<StitchPill tone="muted">{account.platform}</StitchPill>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="User Email"><Input className="stitch-input" defaultValue="elena@example.com" readOnly /></Field>
          <Field label="Phase"><Input className="stitch-input" defaultValue={account.phase} readOnly /></Field>
          <Field label="Start Date"><Input className="stitch-input" type="datetime-local" defaultValue="2025-05-01T08:00" /></Field>
          <Field label="End Date"><Input className="stitch-input" type="datetime-local" /><span className="text-[10px] text-ink-muted">Leave empty for no limit</span></Field>
          <Field label="Profit Split %"><Input className="stitch-input" type="number" defaultValue={20} /><span className="text-[10px] text-ink-variant">Trader keeps 80%, firm 20%</span></Field>
          <Field label="Payout Frequency">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
              <option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option><option>Quarterly</option>
            </select>
          </Field>
          <Field label="First Withdrawal Delay"><Input className="stitch-input" defaultValue="14 days" /></Field>
          <Field label="Next Withdrawal Date"><Input className="stitch-input" type="datetime-local" /></Field>
          <Field label="Account Label">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
              <option>Paid</option><option>Giveaway</option><option>Third Party</option><option>Standard</option>
            </select>
          </Field>
        </div>
      </StitchCard>

      <StitchCard>
        <StitchCardHeader icon="savings" title="Balance & Drawdown Metrics" description="Read-only ledger state synced from bridge" />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <StitchDetailRow label="Initial Balance" value={money(100000, currency)} />
          <StitchDetailRow label="Live Balance" value={money(account.balance, currency)} />
          <StitchDetailRow label="Live Equity" value={money(account.equity, currency)} />
          <StitchDetailRow label="P&L" value={<span className={account.equity >= account.balance ? "text-tp" : "text-terr"}>{money(account.equity - account.balance, currency)}</span>} />
          <StitchDetailRow label="Daily Starting Balance" value={money(account.balance * 0.99, currency)} />
          <StitchDetailRow label="Daily Drawdown Amount" value={`${money(2000, currency)} · 2%`} />
          <StitchDetailRow label="Profit Target Amount" value={money(10000, currency)} />
          <StitchDetailRow label="Global Drawdown Amount" value={`${money(5000, currency)} · 5%`} />
          <StitchDetailRow label="Daily Drawdown Expiry" value="23:00 UTC" />
          <StitchDetailRow label="Drawdown Locked" value={<Switch defaultChecked aria-label="Drawdown locked" />} />
        </div>
      </StitchCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader icon="dns" title="Broker Details" description="Bridge and matching configuration" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Login"><Input className="stitch-input font-mono" defaultValue={account.login} readOnly /></Field>
            <Field label="Broker Type">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
                <option>MetaTrader5</option><option>MetaTrader4</option><option>DXTrade</option><option>MatchTrader</option>
              </select>
            </Field>
            <Field label="MetaTrader Trading Account"><Input className="stitch-input font-mono" defaultValue="882049" /></Field>
            <Field label="MatchTrader Trading Account"><Input className="stitch-input font-mono" placeholder="—" /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <StitchButton variant="surface" icon="sync" onClick={() => toast({ title: "Sync queued" })}>Sync Account</StitchButton>
            <StitchButton variant="surface" icon="forward_to_inbox" onClick={() => setResendOpen(true)}>Resend Credentials</StitchButton>
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="toggles" title="Account Status Details" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status Reason">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
                <option>None</option><option>Manual Review</option><option>Policy Violation</option><option>Risk Concern</option><option>Documentation Issue</option><option>Payment Failed</option>
              </select>
            </Field>
            <Field label="Status Finalised At"><Input className="stitch-input" type="datetime-local" /></Field>
            <Field label="Custom Status Reason"><Textarea className="stitch-input" placeholder="Free-text context for the status" /></Field>
            <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
              Copy Trading Detected
              <Switch defaultChecked={false} />
            </label>
            <Field label="Failed Review Reason"><Textarea className="stitch-input" /></Field>
          </div>
        </StitchCard>
      </div>

      <StitchCard>
        <StitchCardHeader icon="tune" title="Extra Settings" description="Visibility and behavioral flags for this account" />
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { k: "HIDE_ACCOUNT", d: "Hide this account from public dashboards", on: false },
            { k: "PUBLIC_TRACK_RECORD", d: "Include in public track record", on: true },
            { k: "PUBLIC_BALANCE", d: "Show balance publicly", on: false },
            { k: "PUBLIC_TRADE_HISTORY", d: "Show trade history publicly", on: false },
            { k: "PUBLIC_LOTS", d: "Show traded lots publicly", on: false },
          ].map((f) => (
            <label key={f.k} className="flex items-start gap-3 rounded-lg bg-sfc-low px-3 py-2.5">
              <Checkbox defaultChecked={f.on} className="mt-0.5 border-ink-variant/40" />
              <span className="min-w-0">
                <span className="block font-mono text-xs font-semibold text-ink">{f.k}</span>
                <span className="block text-[10px] text-ink-variant">{f.d}</span>
              </span>
            </label>
          ))}
        </div>
      </StitchCard>

      {/* Footer action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <div className="flex gap-2">
          <StitchButton variant="primary" icon="save" onClick={() => toast({ title: "Changes saved" })}>Save Changes</StitchButton>
          <StitchButton variant="surface" icon="save" onClick={() => toast({ title: "Saved — still editing" })}>Save and Continue</StitchButton>
        </div>
        <div className="flex gap-2">
          <StitchButton variant="destructive" icon="block" onClick={onBlock}>Block Account</StitchButton>
          <StitchButton variant="outline" icon="restart_alt" onClick={onReset}>Reset Account</StitchButton>
        </div>
      </div>

      <ResendCredentialsSheet open={resendOpen} onOpenChange={setResendOpen} />
    </div>
  );
}

function Meter({ label, used, detail, tone = "warning" }: { label: string; used: number; detail: string; tone?: "positive" | "warning" | "negative" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-ink">{label}</span>
        <span className={cn("text-xs font-bold", used >= 80 ? "text-terr" : used >= 60 ? "text-tt-fixed-variant" : "text-tp")}>{Math.round(used)}%</span>
      </div>
      <StitchProgress value={used} tone={used >= 80 ? "negative" : used >= 60 ? "warning" : tone} />
      <p className="mt-1 text-[10px] text-ink-variant">{detail}</p>
    </div>
  );
}

/* ═══════════════ Events tab (account_events) ═══════════════ */

const MOCK_EVENTS = [
  { id: "evt-1", type: "Status Changed", desc: "Account status changed to active", actor: "Sarah Chen", role: "Admin", at: "2025-05-28 14:32 UTC" },
  { id: "evt-2", type: "Phase Upgraded", desc: "Phase 1 → Phase 2 transition recorded", actor: "System", role: "Engine", at: "2025-05-27 09:40 UTC" },
  { id: "evt-3", type: "Drawdown Alert", desc: "Daily drawdown reached 80% of limit", actor: "Risk Engine", role: "Engine", at: "2025-05-27 11:12 UTC" },
  { id: "evt-4", type: "Payout Event", desc: "Payout PO-94102 settled & cleared", actor: "Treasury Engine", role: "Engine", at: "2025-05-26 14:25 UTC" },
  { id: "evt-5", type: "Status Changed", desc: "Bridge reconnected after failover", actor: "Aiden Lloyd", role: "Admin", at: "2025-05-25 20:02 UTC" },
];

function EventsTab() {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [detail, setDetail] = React.useState<(typeof MOCK_EVENTS)[number] | null>(null);
  const [subscribeOpen, setSubscribeOpen] = React.useState(false);

  const filtered = MOCK_EVENTS.filter(
    (e) => (typeFilter === "all" || e.type === typeFilter) && (!query || `${e.type} ${e.desc}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StitchKpi label="Total Events" value={MOCK_EVENTS.length} icon="list_alt" />
        <StitchKpi label="Status Changes" value={2} icon="toggler" tone="warning" />
        <StitchKpi label="Phase Transitions" value={1} icon="alt_route" tone="positive" />
        <StitchKpi label="Payout Events" value={1} icon="payments" tone="positive" />
        <StitchKpi label="Breach Events" value={0} icon="gpp_maybe" tone="positive" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="h-8 w-44 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none placeholder:text-ink-muted focus:ring-1 focus:ring-tp" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 rounded-lg bg-sfc-lowest px-2.5 text-xs font-medium text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
            <option value="all">All types</option>
            {Array.from(new Set(MOCK_EVENTS.map((e) => e.type))).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {typeFilter !== "all" || query ? (
            <StitchButton variant="ghost" icon="restart_alt" onClick={() => { setTypeFilter("all"); setQuery(""); }}>Clear</StitchButton>
          ) : null}
        </div>
        <div className="flex gap-2">
          <StitchButton variant="surface" icon="notifications_add" onClick={() => setSubscribeOpen(true)}>Subscribe</StitchButton>
          <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: `${filtered.length} events exported.` })}>Export CSV</StitchButton>
        </div>
      </div>

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(e) => e.id}
          onRowClick={(e) => setDetail(e)}
          rows={filtered}
          columns={[
            { header: "Event Type", cell: (e) => <StitchPill tone={e.type.startsWith("Breach") ? "negative" : e.type.startsWith("Payout") ? "positive" : e.type.startsWith("Status") ? "warning" : "info"}>{e.type}</StitchPill> },
            { header: "Description", cell: (e) => <span className="text-ink">{e.desc}</span> },
            { header: "Actor", cell: (e) => <span className="flex items-center gap-1.5"><span className="font-semibold text-ink">{e.actor}</span><StitchPill tone="muted">{e.role}</StitchPill></span> },
            { header: "Created", cell: (e) => <span className="font-mono text-[11px] text-ink-variant">{e.at}</span> },
          ]}
          emptyState={<StitchEmpty icon="contactless_off" title="No events match" body="Adjust filters to see lifecycle events for this account." />}
        />
      </StitchCard>

      {/* Event detail sheet */}
      <StitchSheet
        open={!!detail} onOpenChange={(o) => !o && setDetail(null)} icon="touch_app"
        title={detail?.type ?? ""} description="Immutable event payload"
        footer={
          <>
            <StitchButton variant="surface" icon="content_copy" onClick={() => toast({ title: "Event JSON copied" })}>Copy Event JSON</StitchButton>
            <StitchButton variant="primary" onClick={() => setDetail(null)}>Close</StitchButton>
          </>
        }
      >
        {detail ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Event ID" value={detail.id} />
            <StitchDetailRow label="Type" value={detail.type} />
            <StitchDetailRow label="Actor" value={detail.actor} />
            <StitchDetailRow label="Actor Role" value={detail.role} />
            <StitchDetailRow label="Created" value={detail.at} />
            <StitchDetailRow label="IP Address" value="194.22.81.4" />
            <StitchDetailRow label="Before State" value="pending" />
            <StitchDetailRow label="After State" value="active" />
          </div>
        ) : null}
      </StitchSheet>

      {/* Subscribe sheet */}
      <StitchSheet
        open={subscribeOpen} onOpenChange={setSubscribeOpen} icon="notifications_add"
        title="Subscribe to events" description="Choose channels, event types and cadence"
        footer={
          <>
            <StitchButton variant="surface" onClick={() => setSubscribeOpen(false)}>Cancel</StitchButton>
            <StitchButton variant="primary" onClick={() => { setSubscribeOpen(false); toast({ title: "Subscription created" }); }}>Subscribe</StitchButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Notification Channels">
            <div className="space-y-1.5">
              {["Email", "Slack", "Webhook"].map((c) => (
                <label key={c} className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2 text-xs font-medium text-ink">
                  <Checkbox defaultChecked={c === "Email"} className="border-ink-variant/40" /> {c}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Event Types">
            <div className="space-y-1.5">
              {["Status Changed", "Phase Upgraded", "Breach Detected", "Drawdown Alert", "Payout Events"].map((c) => (
                <label key={c} className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2 text-xs font-medium text-ink">
                  <Checkbox defaultChecked className="border-ink-variant/40" /> {c}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Cadence">
            <div className="flex gap-2">
              {["Real-time", "Daily digest", "Weekly digest"].map((c, i) => (
                <label key={c} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium", i === 0 ? "bg-tp text-on-primary" : "bg-sfc-low text-ink")}>
                  <Checkbox defaultChecked={i === 0} className="border-ink-variant/40" /> {c}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ Version history tab (account_version_history) ═══════════════ */

const MOCK_VERSIONS = [
  { id: "v-1042", obj: "Elena Althaus · MT5-882049", at: "2025-05-28 14:02 UTC", comment: "Profit Split updated", by: "Sarah Chen", role: "Admin", reason: "Updated challenge payout policy", diff: "Profit Split: 15% → 20%" },
  { id: "v-1041", obj: "Elena Althaus · MT5-882049", at: "2025-05-26 10:20 UTC", comment: "Payout Frequency changed", by: "Aiden Lloyd", role: "Admin", reason: "Finance ops request", diff: "Payout Frequency: Monthly → Weekly" },
  { id: "v-1040", obj: "Elena Althaus · MT5-882049", at: "2025-05-21 16:44 UTC", comment: "Account Label set", by: "System", role: "Engine", reason: "Automated coupon match", diff: "Account Label: Standard → Paid" },
];

function VersionHistoryTab() {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [revertTarget, setRevertTarget] = React.useState<(typeof MOCK_VERSIONS)[number] | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Total Versions" value={MOCK_VERSIONS.length} icon="difference" />
        <StitchKpi label="Unique Actors" value={2} icon="people_alt" />
        <StitchKpi label="Fields Tracked" value={41} icon="text_select_start" />
        <StitchKpi label="Latest Change" value="May 28" icon="update" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-sfc-low p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <span className="text-xs text-ink-variant" aria-live="polite">{MOCK_VERSIONS.length} snapshots · every save creates one</span>
        <div className="flex gap-2">
          <StitchButton variant="surface" icon="compare_arrows" onClick={() => setCompareOpen(true)}>Compare two versions</StitchButton>
          <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready" })}>Export CSV</StitchButton>
        </div>
      </div>

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(v) => v.id}
          onRowClick={(v) => setExpanded((e) => (e === v.id ? null : v.id))}
          rows={MOCK_VERSIONS}
          columns={[
            { header: "Object", cell: (v) => <span className="text-ink">{v.obj}</span> },
            { header: "Date/Time", cell: (v) => <span className="font-mono text-[11px] text-ink-variant">{v.at}</span> },
            { header: "Comment", cell: (v) => v.comment },
            { header: "Changed By", cell: (v) => <span className="flex items-center gap-1.5">{v.by}<StitchPill tone="muted">{v.role}</StitchPill></span> },
            { header: "Changes", cell: (v) => <span className="font-mono text-[10px] text-ink">{v.diff}</span> },
            {
              header: "Action",
              cell: (v) => (
                <StitchButton variant="surface" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setRevertTarget(v); }}>Revert</StitchButton>
              ),
            },
          ]}
        />
      </StitchCard>

      {expanded ? (
        <StitchCard>
          <StitchCardHeader icon="unfold_more" title={`Version ${expanded}`} description="Full field-level diff for this snapshot" />
          <div className="grid gap-2 sm:grid-cols-2">
            <StitchDetailRow label="Profit Split" value="15% → 20%" />
            <StitchDetailRow label="Payout Frequency" value="Monthly" />
            <StitchDetailRow label="Account Label" value="Standard → Paid" />
            <StitchDetailRow label="End Date" value="unchanged" />
          </div>
        </StitchCard>
      ) : null}

      {/* Compare sheet */}
      <StitchSheet
        open={compareOpen} onOpenChange={setCompareOpen} icon="compare_arrows" wide
        title="Compare versions" description="Side-by-side field diff"
        footer={<StitchButton variant="primary" onClick={() => setCompareOpen(false)}>Close</StitchButton>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Version A">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>v-1040</option><option>v-1041</option><option>v-1042</option></select>
            </Field>
            <Field label="Version B">
              <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>v-1042</option><option>v-1041</option><option>v-1040</option></select>
            </Field>
          </div>
          <StitchButton variant="primary" icon="compare" onClick={() => toast({ title: "Compared — differences highlighted below" })}>Compare</StitchButton>
          <div className="rounded-xl border border-sfc-high">
            {[["Profit Split", "15%", "20%"], ["Payout Frequency", "Monthly", "Weekly"], ["Account Label", "Standard", "Paid"]].map(([f, a, b]) => (
              <div key={f} className="grid grid-cols-3 items-center gap-2 border-b border-sfc-high px-3 py-2 text-xs last:border-0">
                <span className="font-semibold text-ink">{f}</span>
                <span className="rounded bg-terr-container/40 px-2 py-0.5 font-mono text-[10px] text-terr line-through">{a}</span>
                <span className="rounded bg-tp-fixed px-2 py-0.5 font-mono text-[10px] font-bold text-tp-fixed-variant">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </StitchSheet>

      {/* Revert confirm */}
      <StitchConfirm
        open={!!revertTarget} onOpenChange={(o) => !o && setRevertTarget(null)} icon="settings_backup_restore"
        title={`Revert to ${revertTarget?.id ?? ""}?`}
        body="The configuration fields below will change back to this version's values. The revert itself is logged as a new version."
        confirmLabel={revertTarget ? `Revert to ${revertTarget.id}` : "Revert"}
        onConfirm={() => toast({ title: "Version reverted", description: "A new snapshot recorded the revert." })}
      >
        <div className="space-y-1.5">
          {(revertTarget?.diff ?? "").split(", ").map((d) => (
            <div key={d} className="rounded-lg bg-sfc-low px-3 py-2 font-mono text-[10px] text-ink">{d}</div>
          ))}
        </div>
        <Field label="Reason (required)"><Textarea className="stitch-input" /></Field>
        <label className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          <Checkbox className="border-ink-variant/40" /> Acknowledge: revert will be logged as a new version
        </label>
      </StitchConfirm>
    </div>
  );
}

/* ═══════════════ Broker details tab (account_broker_details) ═══════════════ */

function BrokerDetailsTab({ account }: { account: ReturnType<typeof getTenantAccounts>[number] }) {
  const currency = account.currency;
  const [editing, setEditing] = React.useState(false);
  const [bridgeLogOpen, setBridgeLogOpen] = React.useState(false);
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [resetMasterOpen, setResetMasterOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StitchKpi label="Balance" value={money(account.balance, currency)} icon="account_balance" />
        <StitchKpi label="Equity" value={money(account.equity, currency)} icon="show_chart" />
        <StitchKpi label="Margin" value={money(12400, currency)} icon="avg_pace" />
        <StitchKpi label="Free Margin" value={money(account.equity - 12400, currency)} icon="payments" />
        <StitchKpi label="Margin Level" value="128.4%" icon="speed" tone="positive" hint="Above 100% is safe" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-ink">Edit broker configuration</span>
          <StitchInfoHint text="Changes are applied to the bridge on save and are fully audited." />
        </div>
        {editing ? (
          <div className="flex gap-2">
            <StitchButton variant="surface" onClick={() => setEditing(false)}>Cancel</StitchButton>
            <StitchButton variant="primary" icon="save" onClick={() => { setEditing(false); toast({ title: "Broker configuration saved" }); }}>Save Changes</StitchButton>
          </div>
        ) : (
          <StitchButton variant="surface" icon="edit" onClick={() => setEditing(true)}>Edit</StitchButton>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StitchCard className="lg:col-span-2">
          <StitchCardHeader icon="key" title="Login Credentials" description="Masked — reveal requires audit logging" right={<StitchPill tone="warning">Protected</StitchPill>} />
          <div className="grid gap-3 sm:grid-cols-2">
            <StitchDetailRow label="Login ID" value={<span className="font-mono">{account.login}</span>} />
            <StitchDetailRow label="Password" value="••••••••••" />
            <StitchDetailRow label="Server" value={<span className="font-mono">Terra-LD4-01</span>} />
            <StitchDetailRow label="Investor Password" value="••••••••" />
          </div>
          <div className="mt-4 flex gap-2">
            <StitchButton variant="destructive" icon="key" onClick={() => setRotateOpen(true)}>Rotate Password</StitchButton>
            <StitchButton variant="destructive" icon="lock_reset" onClick={() => setResetMasterOpen(true)}>Reset Master Password</StitchButton>
          </div>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader icon="dns" title="Broker Configuration" description={editing ? "Editable — changes audited on save" : "Read-only — press Edit to change"} />
          <div className="space-y-3">
            <Field label="Broker Type">
              <select disabled={!editing} className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none disabled:opacity-50">
                <option>MT5</option><option>MT4</option><option>DXTrade</option>
              </select>
            </Field>
            <Field label="Leverage"><Input className="stitch-input" defaultValue={account.leverage} disabled={!editing} /></Field>
            <Field label="Account Group"><Input className="stitch-input" defaultValue="prop-firm-core" disabled={!editing} /></Field>
            <Field label="Currency"><Input className="stitch-input" defaultValue={account.currency} disabled={!editing} /></Field>
          </div>
        </StitchCard>
      </div>

      <StitchCard>
        <StitchCardHeader icon="hub" title="Trading Account Matching" description="Bridge match + live sync state" right={<StitchPill tone="positive" icon="link">Matched</StitchPill>} />
        <div className="grid gap-2 sm:grid-cols-4">
          <StitchDetailRow label="Matched Account" value={<span className="text-tp">Matched to broker login</span>} />
          <StitchDetailRow label="Bridge Status" value={<StitchStateBadge state="Connected" tone="positive" />} />
          <StitchDetailRow label="Last Sync" value="2 min ago" />
          <StitchDetailRow label="Sync Action" value={<StitchButton variant="surface" className="h-7 px-2" onClick={() => toast({ title: "Sync started" })}>Sync Now</StitchButton>} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-sfc-high pt-3">
          <StitchButton variant="ghost" onClick={() => setBridgeLogOpen(true)}>Bridge Connection Log</StitchButton>
          <StitchButton variant="surface" icon="wifi" onClick={() => toast({ title: "Test connection OK", description: "RTT 14ms." })}>Test Connection</StitchButton>
          <StitchButton variant="surface" icon="cable" onClick={() => toast({ title: "Reconnect dispatched" })}>Reconnect Bridge</StitchButton>
        </div>
        <p className="mt-2 text-[10px] text-ink-variant">The bridge keeps broker login ↔ platform account state synchronized. Connection events are retained for 90 days.</p>
      </StitchCard>

      {/* Bridge connection log sheet */}
      <StitchSheet
        open={bridgeLogOpen} onOpenChange={setBridgeLogOpen} icon="cable" wide
        title="Bridge Connection Log" description="Last 50 connection events — filter by type"
        footer={<StitchButton variant="primary" onClick={() => setBridgeLogOpen(false)}>Close</StitchButton>}
      >
        <div className="space-y-2">
          {[
            { t: "14:25:08", e: "CONNECT", lat: "12ms", s: "OK" },
            { t: "14:02:11", e: "POSITION_SYNC", lat: "48ms", s: "OK" },
            { t: "13:40:02", e: "RECONNECT", lat: "156ms", s: "RETRY" },
            { t: "13:39:58", e: "DISCONNECT", lat: "—", s: "TIMEOUT" },
            { t: "12:15:40", e: "EQUITY_SYNC", lat: "22ms", s: "OK" },
          ].map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2 text-xs">
              <span className="flex items-center gap-3"><span className="font-mono text-[11px] text-ink-variant">{l.t}</span><StitchPill tone={l.s === "OK" ? "positive" : l.s === "RETRY" ? "warning" : "negative"}>{l.e}</StitchPill></span>
              <span className="font-mono text-[11px] text-ink-variant">{l.lat}</span>
            </div>
          ))}
        </div>
      </StitchSheet>

      <RotatePasswordSheetWrapped open={rotateOpen} onOpenChange={setRotateOpen} title={`Rotate password — ${account.login}`} />
      <StitchConfirm
        open={resetMasterOpen} onOpenChange={setResetMasterOpen} icon="lock_reset"
        title="Reset master password?"
        body="The trader will receive a new temporary password by email. All open sessions will be force-logged-out."
        confirmLabel="Reset Password"
        onConfirm={() => toast({ title: "Master password reset" })}
      />
    </div>
  );
}

/* Shared sheets for this cluster */

function RotatePasswordSheetWrapped({ open, onOpenChange, title }: { open: boolean; onOpenChange: (o: boolean) => void; title: string }) {
  const [send, setSend] = React.useState(true);
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="key" title={title}
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Password rotated" }); }}>Rotate</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="New Password"><div className="flex gap-2"><Input className="stitch-input font-mono" defaultValue="Xk9#mQ2$vL7p" /><StitchButton variant="surface" icon="casino" onClick={() => toast({ title: "New password generated" })}>Regen</StitchButton></div></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Send to trader<Switch checked={send} onCheckedChange={setSend} /></label>
        <Field label="Audit Reason (required)"><Textarea className="stitch-input" /></Field>
      </div>
    </StitchSheet>
  );
}

function ResetAccountConfirm({ open, onOpenChange, login }: { open: boolean; onOpenChange: (o: boolean) => void; login: string }) {
  const [ack, setAck] = React.useState(false);
  return (
    <StitchConfirm
      open={open} onOpenChange={onOpenChange} icon="restart_alt"
      title={`Reset ${login}?`}
      body="Reset account to its initial state? All progress (balance, equity, P&L, drawdown) will be lost. The account will return to its starting balance. This action is irreversible."
      confirmLabel="Reset Account"
      onConfirm={() => { if (ack) toast({ title: "Account reset" }); }}
    >
      <Field label="Reason (required)"><Textarea className="stitch-input" /></Field>
      <label className="flex items-center gap-2.5 rounded-lg bg-terr-container/40 px-3 py-2.5 text-xs font-semibold text-terr">
        <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="border-terr/40" />
        I acknowledge all progress will be lost
      </label>
    </StitchConfirm>
  );
}

function AddNoteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="sticky_note_2" title="Add note"
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Note saved" }); }}>Save</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="Note"><Textarea className="stitch-input min-h-24" /></Field>
        <Field label="Visibility">
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink"><Checkbox defaultChecked className="border-ink-variant/40" />Internal Only</label>
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink"><Checkbox className="border-ink-variant/40" />Visible to Trader</label>
          </div>
        </Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Pin to top<Switch defaultChecked={false} /></label>
      </div>
    </StitchSheet>
  );
}

function ResendCredentialsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="forward_to_inbox" title="Resend Credentials"
      description="Sends an existing credential email to the trader"
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" icon="send" onClick={() => { onOpenChange(false); toast({ title: "Credentials sent" }); }}>Send</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="Template">
          <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none">
            <option>Welcome</option><option>Reset Password</option><option>Account Reactivation</option>
          </select>
        </Field>
        <Field label="Custom Message (optional)"><Textarea className="stitch-input" /></Field>
        <Field label="Send To"><Input className="stitch-input" defaultValue="elena@example.com" /></Field>
      </div>
    </StitchSheet>
  );
}

function SyncSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = ["Connecting to bridge", "Fetching balance", "Fetching positions", "Reconciling"];
  const [done, setDone] = React.useState(0);
  React.useEffect(() => {
    if (!open) { setDone(0); return; }
    const t = setInterval(() => setDone((d) => (d >= steps.length ? d : d + 1)), 650);
    return () => clearInterval(t);
  }, [open, steps.length]);
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="sync" title="Bridge reconciliation" description="Estimated 12 seconds"
      footer={<StitchButton variant="surface" onClick={() => onOpenChange(false)}>{done >= steps.length ? "Done" : "Cancel"}</StitchButton>}
    >
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs">
            <span className="flex items-center gap-2 font-medium text-ink">
              {i < done ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tp text-[9px] text-on-primary">✓</span> : <span className="h-4 w-4 rounded-full border-2 border-outline-variant" />}
              {s}
            </span>
            <span className={cn("text-[10px] font-bold", i < done ? "text-tp" : "text-ink-muted")}>{i < done ? "DONE" : i === done ? "RUNNING…" : "PENDING"}</span>
          </div>
        ))}
      </div>
    </StitchSheet>
  );
}

/* ═══════════════ KYC tab (account_kyc_statuses) ═══════════════ */

function KycTab({ account }: { account: ReturnType<typeof getTenantAccounts>[number] }) {
  const tid = account.tenantId;
  const kycRows = [
    { provider: "VERIFF", status: "approved", docs: 2, lastChecked: "2025-05-27 10:40 UTC" },
    { provider: "SUMSUB", status: "pending", docs: 1, lastChecked: "2025-05-27 09:12 UTC" },
    { provider: "ONFIDO", status: "approved", docs: 1, lastChecked: "2025-05-20 16:02 UTC" },
  ];
  const [addOpen, setAddOpen] = React.useState(false);
  const [docOpen, setDocOpen] = React.useState<(typeof kycRows)[number] | null>(null);
  const [markAllOpen, setMarkAllOpen] = React.useState(false);
  const rejectTarget = kycRows.find((r) => r.status === "pending");
  const [rejectOpen, setRejectOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Entity header mini */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tp/15 text-xs font-bold text-tp">EA</span>
          <div>
            <p className="text-sm font-bold text-ink">{account.traderName}</p>
            <p className="text-[11px] text-ink-variant">Login {account.login} · {account.platform}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <StitchButton variant="surface" onClick={() => setMarkAllOpen(true)}>Mark All Approved</StitchButton>
          <StitchButton variant="primary" icon="add" onClick={() => setAddOpen(true)}>Add KYC Provider</StitchButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Providers" value={3} icon="verified_user" />
        <StitchKpi label="Verified" value={2} tone="positive" icon="check_circle" />
        <StitchKpi label="Pending" value={1} tone="warning" icon="pending" />
        <StitchKpi label="Rejected" value={0} tone="positive" icon="cancel" />
      </div>

      <StitchCard>
        <StitchTable
          keyOf={(r) => r.provider}
          onRowClick={(r) => setDocOpen(r)}
          rows={kycRows}
          columns={[
            { header: "Provider", cell: (r) => <span className="font-mono text-xs font-bold text-ink">{r.provider}</span> },
            { header: "Status", cell: (r) => <StitchStateBadge state={r.status} tone={toneFor(r.status)} /> },
            { header: "Documents", cell: (r) => <StitchPill tone="info">{r.docs}</StitchPill>, numeric: true },
            { header: "Last Checked", cell: (r) => <span className="font-mono text-[11px] text-ink-variant">{r.lastChecked}</span> },
            {
              header: "Action",
              cell: (r) => (
                <div className="flex gap-1.5">
                  <StitchButton variant="surface" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); toast({ title: `${r.provider} re-initiated` }); }}>Re-initiate</StitchButton>
                  <RowMenu provider={r.provider} onVerify={() => toast({ title: `${r.provider} verified` })} onReject={() => setRejectOpen(true)} />
                </div>
              ),
            },
          ]}
        />
        <div className="rounded-b-xl border-t border-sfc-high bg-tp-fixed/40 px-4 py-2.5 text-[11px] text-tp-fixed-variant">
          Tip: payout eligibility requires at least one approved provider per compliance policy.
        </div>
      </StitchCard>

      {/* Add provider sheet */}
      <StitchSheet
        open={addOpen} onOpenChange={setAddOpen} icon="add_business"
        title="Add KYC provider" description="Connects a verification provider for this trader"
        footer={<>
          <StitchButton variant="surface" onClick={() => setAddOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setAddOpen(false); toast({ title: "Provider added" }); }}>Add Provider</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Provider">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>VERIFF</option><option>SUMSUB</option><option>ONFIDO</option><option>MANUAL</option></select>
          </Field>
          <Field label="API Key"><Input className="stitch-input font-mono" type="password" /></Field>
          <Field label="Webhook URL (optional)"><Input className="stitch-input" /></Field>
          <Field label="Default Document Type">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Passport</option><option>Driver's License</option><option>National ID</option><option>Residence Permit</option></select>
          </Field>
          <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Auto-verify on submission<Switch defaultChecked /></label>
        </div>
      </StitchSheet>

      {/* Document detail inspection sheet */}
      <StitchSheet
        open={!!docOpen} onOpenChange={(o) => !o && setDocOpen(null)} icon="folder_open" wide
        title={`${docOpen?.provider ?? ""} documents`}
        footer={
          <>
            <StitchButton variant="surface" icon="download" onClick={() => toast({ title: "ZIP prepared" })}>Download All</StitchButton>
            <StitchButton variant="primary" onClick={() => setDocOpen(null)}>Close</StitchButton>
          </>
        }
      >
        <div className="space-y-2">
          {["passport_front.jpg", "passport_back.jpg", "proof_address.pdf"].slice(0, docOpen?.docs ?? 1).map((f) => (
            <div key={f} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs">
              <span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded bg-sfc-high"><MsIconSafe name="description" /></span><span className="font-medium text-ink">{f}</span></span>
              <StitchPill tone={toneFor(docOpen?.status ?? "")}>{docOpen?.status}</StitchPill>
            </div>
          ))}
        </div>
      </StitchSheet>

      {/* Reject dialog */}
      <StitchConfirm
        open={rejectOpen} onOpenChange={setRejectOpen} icon="gpp_bad"
        title={`Reject ${rejectTarget?.provider ?? "provider"}?`}
        body="The trader will be notified with the reason and re-submission instructions. The rejection is logged."
        confirmLabel="Reject"
        onConfirm={() => toast({ title: "Provider rejected" })}
      >
        <Field label="Rejection Reason">
          <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>Document Expired</option><option>Document Unclear</option><option>Identity Mismatch</option><option>Other</option></select>
        </Field>
        <Field label="Notes (required)"><Textarea className="stitch-input" /></Field>
      </StitchConfirm>

      {/* Mark all approved */}
      <StitchConfirm
        open={markAllOpen} onOpenChange={setMarkAllOpen} icon="done_all"
        title="Mark all pending providers approved?"
        body="This will unlock payout eligibility for the trader. Each provider state change is logged."
        confirmLabel="Mark All Approved"
        destructive={false}
        onConfirm={() => toast({ title: "All providers approved" })}
      />
    </div>
  );
}

function RowMenu({ provider, onVerify, onReject }: { provider: string; onVerify: () => void; onReject: () => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`Actions for ${provider}`} onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink">
        <MsIconSafe />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-40 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          <button type="button" onClick={() => { setOpen(false); onVerify(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-variant hover:bg-sfc hover:text-ink"><MsIconSafe name="check_circle" />Verify</button>
          <button type="button" onClick={() => { setOpen(false); onReject(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-terr hover:bg-terr-container/30"><MsIconSafe name="cancel" />Reject</button>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════ Related accounts tab (account_related_accounts) ═══════════════ */

function RelatedAccountsTab({ account, accounts }: { account: ReturnType<typeof getTenantAccounts>[number]; accounts: ReturnType<typeof getTenantAccounts> }) {
  const currency = account.currency;
  const related = accounts.filter((a) => a.traderId === account.traderId);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [unlinkTarget, setUnlinkTarget] = React.useState<(typeof related)[number] | null>(null);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const { navigate } = usePlatform();

  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <p className="text-sm font-bold text-ink">{account.traderName} <span className="text-xs font-medium text-ink-variant">· showing {related.length} accounts · current {account.login}</span></p>
        <div className="flex gap-2">
          <StitchButton variant="surface" icon="compare_arrows" disabled={selected.size < 2} onClick={() => setCompareOpen(true)}>Compare</StitchButton>
          <StitchButton variant="destructive" icon="merge" disabled={selected.size !== 2} onClick={() => setMergeOpen(true)}>Merge</StitchButton>
          <StitchButton variant="primary" icon="link" onClick={() => setLinkOpen(true)}>Link Account</StitchButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Related Accounts" value={related.length} icon="link" />
        <StitchKpi label="Funded" value={related.filter((a) => a.phase === "funded").length} tone="positive" icon="workspace_premium" />
        <StitchKpi label="Active" value={related.filter((a) => a.status === "active").length} tone="positive" icon="play_circle" />
        <StitchKpi label="Breached" value={related.filter((a) => a.status === "breached").length} tone={related.some((a) => a.status === "breached") ? "negative" : "positive"} icon="gpp_maybe" />
      </div>

      <StitchCard>
        <StitchTable
          keyOf={(a) => a.id}
          onRowClick={() => navigate("account-workspace")}
          rows={related}
          columns={[
            {
              header: "",
              cell: (a) => <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} className="border-ink-variant/40" onClick={(e: React.MouseEvent) => e.stopPropagation()} />,
              className: "w-10",
            },
            { header: "Login", cell: (a) => <span className="flex items-center gap-1.5"><span className="font-mono text-xs font-semibold text-ink">{a.login}</span>{a.id === account.id ? <StitchPill tone="info">current</StitchPill> : null}</span> },
            { header: "Phase", cell: (a) => <StitchPill tone="muted">{a.phase}</StitchPill> },
            { header: "Broker Type", cell: (a) => <StitchPill tone="info">{a.platform}</StitchPill> },
            { header: "Initial Balance", cell: () => money(100000, currency), numeric: true },
            { header: "Current Equity", cell: (a) => money(a.equity, currency), numeric: true },
            { header: "Profit Split", cell: () => "80% / 20%" },
            { header: "Status", cell: (a) => <StitchStateBadge state={a.status} tone={toneFor(a.status)} /> },
            {
              header: "Actions",
              cell: (a) => (a.id === account.id ? null : (
                <StitchButton variant="ghost" className="h-7 px-2 text-terr" onClick={(e) => { e.stopPropagation(); setUnlinkTarget(a); }}>Unlink</StitchButton>
              )),
            },
          ]}
          emptyState={<StitchEmpty icon="link_off" title="No related accounts" body="Only the current account belongs to this trader." />}
        />
      </StitchCard>

      {/* Link account sheet */}
      <StitchSheet
        open={linkOpen} onOpenChange={setLinkOpen} icon="link"
        title="Link account" description="Attach an external broker login to this trader"
        footer={<>
          <StitchButton variant="surface" onClick={() => setLinkOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setLinkOpen(false); toast({ title: "Account linked" }); }}>Link Account</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Broker Login"><Input className="stitch-input font-mono" placeholder="e.g. MT5-993201" /></Field>
          <Field label="Broker Type">
            <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none"><option>MT5</option><option>MT4</option><option>DXTrade</option></select>
          </Field>
          <Field label="Trader Email"><Input className="stitch-input" defaultValue="elena@example.com" /></Field>
          <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Verify identity (email match)<Switch defaultChecked /></label>
        </div>
      </StitchSheet>

      {/* Unlink confirm */}
      <StitchConfirm
        open={!!unlinkTarget} onOpenChange={(o) => !o && setUnlinkTarget(null)} icon="link_off"
        title={`Unlink ${unlinkTarget?.login ?? ""}?`}
        body="The account will be detached from this trader's portfolio. It can be re-linked later."
        confirmLabel="Unlink"
        onConfirm={() => toast({ title: "Account unlinked" })}
      />

      {/* Compare sheet */}
      <StitchSheet
        open={compareOpen} onOpenChange={setCompareOpen} icon="compare_arrows" wide
        title="Compare accounts"
        footer={<StitchButton variant="primary" onClick={() => setCompareOpen(false)}>Close</StitchButton>}
      >
        <StitchTable
          keyOf={(a) => a.id}
          rows={related.filter((a) => selected.has(a.id))}
          columns={[
            { header: "Field", cell: () => "" },
            ...related.filter((a) => selected.has(a.id)).map((a) => ({ header: a.login, cell: (r: (typeof related)[number]) => (r.id === a.id ? <span className="font-bold text-tp">selected</span> : "") })),
          ]}
        />
        <div className="mt-3 grid gap-2">
          <StitchDetailRow label="Platform" value="differs" />
          <StitchDetailRow label="Phase" value="same" />
          <StitchDetailRow label="Status" value="differs" />
        </div>
      </StitchSheet>

      {/* Merge confirm */}
      <StitchConfirm
        open={mergeOpen} onOpenChange={setMergeOpen} icon="merge"
        title="Merge accounts?"
        body="The secondary account will be archived and its history consolidated into the primary. This cannot be undone."
        confirmLabel="Merge Accounts"
        onConfirm={() => toast({ title: "Accounts merged" })}
      >
        <Field label="Primary Account (wins)">
          <div className="space-y-1.5">
            {related.filter((a) => selected.has(a.id)).map((a, i) => (
              <label key={a.id} className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2 text-xs font-medium text-ink">
                <Checkbox defaultChecked={i === 0} className="border-ink-variant/40" /> {a.login}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Reason (required)"><Textarea className="stitch-input" /></Field>
        <label className="flex items-center gap-2.5 rounded-lg bg-terr-container/40 px-3 py-2.5 text-xs font-semibold text-terr">
          <Checkbox className="border-terr/40" /> Acknowledge data loss on secondary
        </label>
      </StitchConfirm>
    </div>
  );
}
