"use client";

/**
 * Trader Detail — Stitch conversion (Batch 1, screen 5)
 * From stitch_screens/trader_detail_elena_althaus + state screens:
 *  - trader_detail_new_onboarding_state_pending_kyc_unfunded
 *  - trader_detail_suspended_rule_breached_state
 *  - trader_audit_log_elena_althaus (Change History tab deep-dive)
 *
 * 11 tabs: Overview / Accounts / Payments / Payouts / Positions /
 * Performance / KYC / Risk / Activity Log / Internal Notes / Change History.
 * (PRD §4.8.2 tabs: Accounts, Payments, Payouts, KYC, Risk, Activity Log,
 *  Internal Notes — plus the stitch-native extras.)
 *
 * Header actions: Add Note, Impersonate, Edit, Suspend ⇄ Reactivate (PRD
 * §4.8.2 Suspend/Reactivate wired to the trader-status store).
 */

import * as React from "react";
import { formatCurrencyValue, formatCompactCurrencyValue } from "@pfaas/platform-core";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantKyc,
  getTenantBreaches,
  getTenantAudit,
  getTenantUserEvents,
  getTraderPayouts,
  getTenant,
  type Trader,
} from "@/lib/platform/mock-data";
import { buildOrders } from "@/modules/trading/pages/orders-page";
import { effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import {
  applyTraderStatus,
  effectiveTraderStatus,
  useTraderStatusVersion,
} from "@/modules/trading/trader-store";
import {
  StitchPageHeader,
  StitchCard,
  StitchCardHeader,
  StitchPill,
  StitchTable,
  StitchSheet,
  StitchConfirm,
  StitchButton,
  StitchStateBadge,
  StitchKpi,
  StitchTimeline,
  StitchProgress,
  StitchDetailRow,
  StitchInfoHint,
  StitchSegmented,
} from "@/components/stitch/stitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { startImpersonation } from "@/lib/platform/impersonation";
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

function statusTone(s: string): "positive" | "negative" | "warning" | "info" | "muted" | "default" {
  switch (s) {
    case "active": return "positive";
    case "breached": return "negative";
    case "suspended": return "warning";
    case "invited": return "info";
    default: return "muted";
  }
}

/**
 * finding #7: money formatting delegates to the central utility in
 * `@pfaas/platform-core`. Non-compact = exact amounts (2 decimals);
 * compact = dense KPI labels only (canonical compact rules).
 */
function money(v: number, currency = "USD", compact = false) {
  return compact ? formatCompactCurrencyValue(v, currency) : formatCurrencyValue(v, currency);
}

const TABS = ["Overview", "Accounts", "Payments", "Payouts", "Positions", "Performance", "KYC", "Risk", "Activity Log", "Internal Notes", "Change History"] as const;
type Tab = (typeof TABS)[number];

/** Internal note — PRD trader-360 "Internal Notes" tab (add/remove). */
interface InternalNote {
  id: string;
  body: string;
  author: string;
  at: string;
  pinned?: boolean;
}

export function TraderDetailStitchPage() {
  const { runtime, navigate, tenant, router, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traderId = router.params.id || "t0";
  const tenantCur = runtime.tenant?.currency ?? "USD";

  const traders = getTenantTraders(tid);
  const traderSeed: Trader = traders.find((t) => t.id === traderId) ?? traders[0] ?? {
    id: "t0", tenantId: tid, name: "Elena Althaus", email: "elena@example.com", country: "DE",
    status: "active" as const, equity: 0, totalPnl: 0, trades: 0, winRate: 0, joinedAt: "", userId: "u0",
  };
  // Session status overrides (suspend/reactivate from list or here).
  useTraderStatusVersion();
  const trader: Trader = { ...traderSeed, status: effectiveTraderStatus(traderSeed) };
  const accounts = getTenantAccounts(tid).filter((a) => a.traderId === trader.id);
  const positions = getTenantPositions(tid).filter((p) => p.traderId === trader.id);
  const kyc = getTenantKyc(tid).find((k) => k.traderId === trader.id);
  const breaches = getTenantBreaches(tid).filter((b) => b.traderId === trader.id);
  const audit = getTenantAudit(tid).slice(0, 12);
  // PRD trader-360 Payouts + Activity Log tabs — subscribe to payout
  // decisions so this list tracks the queue's live status.
  usePayoutVersion();
  const traderPayouts = getTraderPayouts(trader.id);
  const activity = getTenantUserEvents(tid).filter((e) => e.userEmail === trader.email);

  const [tab, setTab] = React.useState<Tab>("Overview");
  const [addNoteOpen, setAddNoteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [impersonateOpen, setImpersonateOpen] = React.useState(false);
  const [payoutScheduleOpen, setPayoutScheduleOpen] = React.useState(false);
  const [resyncOpen, setResyncOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [kycRejectOpen, setKycRejectOpen] = React.useState(false);
  // PRD trader-360 "Internal Notes" tab — session notes (add/remove).
  const [notes, setNotes] = React.useState<InternalNote[]>([
    { id: "n1", body: "Verified source of funds — bank statements match deposit pattern.", author: "Sarah Chen", at: "2025-05-12 09:14 UTC", pinned: true },
    { id: "n2", body: "Asked support about scaling plan rules; forwarded docs.", author: "Maya Okafor", at: "2025-05-18 16:40 UTC" },
  ]);

  const tenantData = getTenant(tid);
  const isChallengePhase = trader.challengePhase === "phase-1" || trader.challengePhase === "phase-2";

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-tp transition-colors hover:bg-sfc"
        onClick={() => navigate("trading-traders")}
      >
        <MsIconSafe name="arrow_back" /> Back to {plural(term("account")).toLowerCase()}
      </button>

      <StitchPageHeader
        icon="person"
        title={trader.name}
        subtitle={`${trader.email} · ${trader.country}`}
        chip={
          <span className="flex flex-wrap items-center gap-2">
            <StitchStateBadge state={trader.status} tone={statusTone(trader.status)} />
            <StitchPill tone="muted">{trader.challengePhase ?? "no phase"}</StitchPill>
          </span>
        }
        actions={
          <>
            <StitchButton variant="surface" icon="sticky_note_2" onClick={() => setAddNoteOpen(true)}>Add Note</StitchButton>
            {/* In-page guard — impersonation requires impersonation.start
                (prop-admin only); other roles don't get the entry point. */}
            <StitchButton
              variant="surface"
              icon="swap_horiz"
              disabled={!hasPermission(user, "impersonation.start")}
              title={hasPermission(user, "impersonation.start") ? undefined : "Requires impersonation.start"}
              onClick={() => setImpersonateOpen(true)}
            >
              Impersonate
            </StitchButton>
            <StitchButton variant="surface" icon="edit" onClick={() => setEditOpen(true)}>Edit</StitchButton>
            {/* PRD §4.8.2 — Suspend and Reactivate are the same toggle; the
                header shows the action matching the effective status. */}
            {trader.status === "suspended" || trader.status === "breached" ? (
              <StitchButton variant="primary" icon="play_circle" onClick={() => setReactivateOpen(true)}>Reactivate</StitchButton>
            ) : (
              <StitchButton variant="destructive" icon="pause_circle" onClick={() => setSuspendOpen(true)}>Suspend</StitchButton>
            )}
          </>
        }
      />

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StitchKpi label="Equity" value={money(trader.equity, tenantCur)} delta="+4.1%" icon="account_balance" hint="Across all linked accounts" />
        <StitchKpi label="Total P&L" value={<span className={trader.totalPnl >= 0 ? "text-tp" : "text-terr"}>{money(trader.totalPnl, tenantCur)}</span>} delta={trader.totalPnl >= 0 ? "+6.8%" : "-3%"} icon="trending_up" hint="Lifetime realized + floating" />
        <StitchKpi label="Win rate" value={`${trader.winRate}%`} delta="+1.2%" icon="percent" hint={`${trader.trades} trades closed`} />
        <StitchKpi label="Trades" value={trader.trades} delta="+12" icon="swap_vert" hint="Last 30 days" />
      </section>

      {/* Account Health widget (challenge phases only — UX §21) */}
      {isChallengePhase ? (
        <StitchCard>
          <StitchCardHeader
            icon="health_and_safety"
            title="Account Health"
            description="Unified view of the three objectives that decide this phase"
            right={<StitchPill tone="positive" icon="verified">On Track</StitchPill>}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <HealthMeter label="Daily Loss" used={41} detail="$820 of $2,000 used" />
            <HealthMeter label="Max Drawdown" used={37} detail="$1,840 of $5,000 used" />
            <HealthMeter label="Profit Target" used={72} detail="$7,200 of $10,000" tone="positive" />
          </div>
        </StitchCard>
      ) : null}

      {/* Tab strip */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl bg-sfc-low p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
              tab === t ? "bg-tp text-on-primary shadow-sm" : "text-ink-variant hover:bg-sfc hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <StitchCard>
            <StitchCardHeader icon="badge" title="Account Summary" description="Identity and challenge context" />
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label={`${term("trader")} ID`} value={trader.id} />
              <StitchDetailRow label="Country" value={trader.country} />
              <StitchDetailRow label="Joined" value={trader.joinedAt || "—"} />
              <StitchDetailRow label="Phase" value={trader.challengePhase ?? "—"} />
              <StitchDetailRow label="Balance" value={money(accounts.reduce((s, a) => s + a.balance, 0), tenantCur)} />
              <StitchDetailRow label="Equity" value={money(trader.equity, tenantCur)} />
            </div>
          </StitchCard>
          <StitchCard>
            <StitchCardHeader icon="insights" title="Key Metrics" description="Operational state at a glance" />
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label="Accounts" value={accounts.length} />
              <StitchDetailRow label="Open Positions" value={positions.length} />
              <StitchDetailRow label="KYC" value={kyc ? <StitchPill tone={kyc.status === "approved" ? "positive" : kyc.status === "pending" ? "warning" : "negative"}>{kyc.status}</StitchPill> : <StitchPill tone="muted">No KYC</StitchPill>} />
              <StitchDetailRow label="Open Breaches" value={breaches.length} />
            </div>
            <div className="mt-4 rounded-xl bg-sfc-low p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-tsc">Firm context</p>
              <p className="text-xs text-ink-variant">{tenantData?.name ?? "Tenant"} · payout split 80/20 · currency {tenantCur}</p>
            </div>
          </StitchCard>
        </div>
      ) : null}

      {tab === "Accounts" ? (
        <StitchCard className="p-0">
          <StitchTable
            keyOf={(a) => a.id}
            onRowClick={(row) => navigate("account-workspace", { id: row.id })}
            rows={accounts}
            columns={[
              { header: "Login", cell: (a) => <span className="font-mono text-xs font-semibold text-ink">{a.login}</span> },
              { header: "Platform", cell: (a) => <StitchPill tone="muted">{a.platform}</StitchPill> },
              { header: "Type", cell: (a) => <StitchPill tone="info">{a.type}</StitchPill> },
              { header: "Phase", cell: (a) => <StitchPill tone="muted">{a.phase}</StitchPill> },
              { header: "Balance", cell: (a) => money(a.balance, tenantCur), numeric: true },
              { header: "Equity", cell: (a) => money(a.equity, tenantCur), numeric: true },
              { header: "Status", cell: (a) => <StitchStateBadge state={a.status} tone={a.status === "active" ? "positive" : a.status === "breached" ? "negative" : "muted"} /> },
            ]}
            emptyState={<EmptyHint title="No accounts" body="This trader has no provisioned accounts yet." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Payments" ? (
        <StitchCard className="p-0">
          <StitchCardHeader
            icon="receipt_long"
            title="Payments"
            description="Challenge purchase orders tied to this trader"
            right={<StitchButton variant="surface" icon="download" onClick={() => toast({ title: "Export ready", description: "Payment history exported to CSV." })}>Export CSV</StitchButton>}
          />
          <StitchTable
            keyOf={(o) => o.id}
            rows={buildOrders(tid).filter((o) => o.traderId === trader.id)}
            columns={[
              { header: "Order", cell: (o) => <span className="font-mono text-xs font-semibold text-ink">{o.id}</span> },
              { header: "Challenge", cell: (o) => o.challenge },
              { header: "Amount", cell: (o) => money(o.amount, o.currency), numeric: true },
              { header: "Method", cell: (o) => <StitchPill tone="muted">{o.paymentMethod}</StitchPill> },
              { header: "Provider", cell: (o) => o.paymentProvider },
              { header: "Status", cell: (o) => <StitchStateBadge state={o.status} tone={o.status === "paid" ? "positive" : o.status === "failed" ? "negative" : o.status === "refunded" ? "warning" : "info"} /> },
              { header: "Date", cell: (o) => <span className="text-ink-variant">{new Date(o.createdAt).toLocaleDateString()}</span> },
            ]}
            emptyState={<EmptyHint title="No payments yet" body="Challenge purchases made by this trader will appear here." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Payouts" ? (
        <StitchCard className="p-0">
          <StitchCardHeader
            icon="payments"
            title="Payouts"
            description="Withdrawal requests from this trader"
            right={<StitchButton variant="surface" onClick={() => navigate("payouts")}>Open Payout Queue</StitchButton>}
          />
          <StitchTable
            keyOf={(p) => p.id}
            rows={traderPayouts}
            columns={[
              { header: "Reference", cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
              { header: "Amount", cell: (p) => <span className="font-semibold text-ink">{money(p.amount, p.currency)}</span>, numeric: true },
              { header: "Split", cell: (p) => `${p.profitSplit}%` },
              { header: "Method", cell: (p) => <StitchPill tone="muted">{p.method}</StitchPill> },
              { header: "Status", cell: (p) => <StitchStateBadge state={effectivePayoutStatus(p)} tone={effectivePayoutStatus(p) === "paid" ? "positive" : effectivePayoutStatus(p) === "rejected" ? "negative" : "warning"} /> },
              { header: "Requested", cell: (p) => <span className="text-ink-variant">{new Date(p.createdAt).toLocaleDateString()}</span> },
            ]}
            emptyState={<EmptyHint title="No payouts yet" body="Withdrawal requests submitted by this trader will appear here for review." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Positions" ? (
        <StitchCard className="p-0">
          <StitchTable
            keyOf={(p) => p.id}
            rows={positions}
            columns={[
              { header: "Symbol", cell: (p) => <span className="font-mono text-xs font-semibold text-ink">{p.symbol}</span> },
              { header: "Side", cell: (p) => <span className={cn("font-bold", p.side === "buy" ? "text-tp" : "text-terr")}>{p.side === "buy" ? "Buy" : "Sell"}</span> },
              { header: "Volume", cell: (p) => p.volume, numeric: true },
              { header: "Entry", cell: (p) => p.entryPrice, numeric: true },
              { header: "Current", cell: (p) => p.currentPrice, numeric: true },
              { header: "P&L", cell: (p) => <span className={cn("font-bold", p.pnl >= 0 ? "text-tp" : "text-terr")}>{money(p.pnl, tenantCur)}</span>, numeric: true },
            ]}
            emptyState={<EmptyHint title="No open positions" body="Open trades appear here in real time while they are live." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Performance" ? (
        <StitchCard>
          <StitchCardHeader icon="monitoring" title="Equity Curve" description="30-day account equity progression" right={<StitchSegmented options={[{ value: "30d", label: "30d" }]} value="30d" onChange={() => {}} />} />
          <div className="h-56">
            <SimpleCurve points={Array.from({ length: 30 }, (_, i) => trader.equity * (0.85 + Math.sin(i / 3) * 0.04 + i * 0.006))} />
          </div>
        </StitchCard>
      ) : null}

      {tab === "KYC" ? (
        <StitchCard>
          <StitchCardHeader
            icon="verified_user"
            title="KYC Record"
            description={kyc ? "Identity verification state for this trader" : "No verification submitted yet"}
            right={
              <div className="flex gap-2">
                <StitchButton variant="surface" onClick={() => toast({ title: "KYC re-initiated" })}>Re-initiate</StitchButton>
                <StitchButton variant="surface" onClick={() => toast({ title: "KYC marked verified", description: "Payout eligibility unlocked." })}>Mark Verified</StitchButton>
                <StitchButton variant="destructive" onClick={() => setKycRejectOpen(true)}>Reject</StitchButton>
              </div>
            }
          />
          {kyc ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <StitchDetailRow label="Submitted" value={kyc.submittedAt} />
              <StitchDetailRow label="Status" value={<StitchPill tone={kyc.status === "approved" ? "positive" : "warning"}>{kyc.status}</StitchPill>} />
              <StitchDetailRow label="Document" value={kyc.documentType} />
              <StitchDetailRow label="Country" value={kyc.country} />
              <StitchDetailRow label="Risk level" value={<StitchPill tone={kyc.riskLevel === "high" ? "negative" : kyc.riskLevel === "medium" ? "warning" : "positive"}>{kyc.riskLevel}</StitchPill>} />
              <StitchDetailRow label="Reviewed" value={kyc.reviewedAt ?? "—"} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center">
              <p className="text-sm font-semibold text-ink">No KYC record yet</p>
              <p className="mt-1 text-xs text-ink-variant">When the trader submits identity documents, verification state will appear here.</p>
              <div className="mt-3"><StitchButton variant="primary" onClick={() => toast({ title: "KYC request sent to trader" })}>Request KYC</StitchButton></div>
            </div>
          )}
        </StitchCard>
      ) : null}

      {tab === "Risk" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {isChallengePhase ? (
            <StitchCard>
              <StitchCardHeader icon="health_and_safety" title="Account Health" />
              <div className="space-y-4">
                <HealthMeter label="Daily Loss" used={41} detail="$820 of $2,000 used" />
                <HealthMeter label="Max Drawdown" used={37} detail="$1,840 of $5,000 used" />
                <HealthMeter label="Profit Target" used={72} detail="$7,200 of $10,000" tone="positive" />
              </div>
            </StitchCard>
          ) : null}
          <StitchCard>
            <StitchCardHeader icon="gpp_maybe" title="Recent Breaches" description={`${breaches.length} recorded for this trader`} />
            {breaches.length === 0 ? (
              <p className="rounded-lg bg-sfc-low p-4 text-xs text-ink-variant">No breaches — this trader has stayed within every risk rule.</p>
            ) : (
              <div className="space-y-2">
                {breaches.slice(0, 6).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-sfc-low px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{b.type}</p>
                      <p className="text-[10px] text-ink-variant">{b.rule} · {b.triggeredAt}</p>
                    </div>
                    <StitchPill tone={b.severity === "critical" ? "negative" : "warning"}>{b.severity}</StitchPill>
                  </div>
                ))}
              </div>
            )}
          </StitchCard>
        </div>
      ) : null}

      {tab === "Activity Log" ? (
        <StitchCard>
          <StitchCardHeader
            icon="bolt"
            title="Activity Log"
            description={`${activity.length} events recorded for ${trader.email}`}
          />
          {activity.length === 0 ? (
            <EmptyHint title="No activity yet" body="Logins, orders, payouts and breaches for this trader stream here." />
          ) : (
            <StitchTimeline
              items={activity.map((e) => ({
                dotClass: e.eventType === "BREACH_DETECTED" || e.eventType === "KYC_REJECTED" ? "bg-terr" : "bg-tp",
                title: e.eventType.replaceAll("_", " "),
                time: e.timestamp,
                body: e.description,
              }))}
            />
          )}
        </StitchCard>
      ) : null}

      {tab === "Internal Notes" ? (
        <StitchCard>
          <StitchCardHeader
            icon="sticky_note_2"
            title="Internal Notes"
            description="Staff-only notes — never visible to the trader"
            right={<StitchButton variant="primary" icon="add" onClick={() => setAddNoteOpen(true)}>Add Note</StitchButton>}
          />
          {notes.length === 0 ? (
            <EmptyHint title="No internal notes" body="Capture context for other staff — verification calls, exceptions, escalations." />
          ) : (
            <div className="space-y-2">
              {notes
                .slice()
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                .map((n) => (
                  <div key={n.id} className="rounded-lg bg-sfc-low px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium leading-relaxed text-ink">
                        {n.pinned ? <StitchPill tone="info" icon="keep">Pinned</StitchPill> : null} {n.body}
                      </p>
                      <button
                        type="button"
                        aria-label="Delete note"
                        onClick={() => {
                          setNotes((prev) => prev.filter((x) => x.id !== n.id));
                          toast({ title: "Note removed" });
                        }}
                        className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-sfc hover:text-terr"
                      >
                        <MsIconSafe name="delete" />
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-ink-variant">{n.author} · {n.at}</p>
                  </div>
                ))}
            </div>
          )}
        </StitchCard>
      ) : null}

      {tab === "Change History" ? (
        <StitchCard>
          <StitchCardHeader
            icon="history"
            title="Change History"
            description="Last 12 changes recorded for this trader"
            right={<StitchButton variant="surface" onClick={() => toast({ title: "Opening full audit log" })}>View Full Audit Log</StitchButton>}
          />
          <StitchTimeline
            items={audit.map((a) => ({
              dotClass: "bg-tp",
              title: a.action,
              time: a.timestamp,
              body: `${a.actor} — ${a.summary}`,
            }))}
          />
        </StitchCard>
      ) : null}

      {/* ── Wired sheets/dialogs ── */}
      <AddNoteSheet
        open={addNoteOpen}
        onOpenChange={setAddNoteOpen}
        targetName={trader.name}
        onAdd={(body, pinned) => {
          setNotes((prev) => [
            {
              id: `n${Date.now()}`,
              body,
              author: user?.name ?? "Admin",
              at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
              pinned,
            },
            ...prev,
          ]);
          toast({ title: "Note saved", description: "Added to Internal Notes — staff only." });
        }}
      />
      <EditTraderSheet open={editOpen} onOpenChange={setEditOpen} trader={trader} />
      <PayoutScheduleSheet open={payoutScheduleOpen} onOpenChange={setPayoutScheduleOpen} />
      <ResyncSheet open={resyncOpen} onOpenChange={setResyncOpen} />
      <StitchConfirm
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        icon="pause_circle"
        title={`Suspend ${trader.name}?`}
        body="All trading will halt immediately. Open positions will remain open. Reversible from the trader profile."
        confirmLabel="Suspend Trader"
        onConfirm={() => {
          applyTraderStatus(trader.id, "suspended");
          toast({ title: "Trader suspended", description: `${trader.name} can no longer trade.` });
        }}
      />
      {/* PRD §4.8.2 Reactivate — restore a suspended/breached trader. */}
      <StitchConfirm
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        icon="play_circle"
        title={`Reactivate ${trader.name}?`}
        body="Trading access will be restored immediately. Breached accounts keep their current state. This action is logged."
        confirmLabel="Reactivate Trader"
        destructive={false}
        onConfirm={() => {
          applyTraderStatus(trader.id, "active");
          toast({ title: "Trader reactivated", description: `${trader.name} can trade again.` });
        }}
      />
      <StitchConfirm
        open={kycRejectOpen}
        onOpenChange={setKycRejectOpen}
        icon="gpp_bad"
        title="Reject KYC?"
        confirmLabel="Reject"
        onConfirm={() => toast({ title: "KYC rejected", description: "Trader notified with re-submission instructions." })}
        body="The trader will be emailed with re-submission instructions. The rejection is logged."
      >
        <Field label="Rejection Reason">
          <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
            <option>Document Expired</option><option>Document Unclear</option><option>Identity Mismatch</option><option>Country Not Supported</option><option>Other</option>
          </select>
        </Field>
        <Field label="Notes (required)"><Textarea className="stitch-input" /></Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          Email trader with re-submission instructions
          <Switch defaultChecked />
        </label>
      </StitchConfirm>
      <ImpersonateSheet open={impersonateOpen} onOpenChange={setImpersonateOpen} name={trader.name} />
      <StitchButton variant="ghost" className="hidden" onClick={() => setPayoutScheduleOpen(true)}>payout</StitchButton>
    </div>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-variant">{body}</p>
    </div>
  );
}

function HealthMeter({ label, used, detail, tone = "warning" }: { label: string; used: number; detail: string; tone?: "positive" | "warning" | "negative" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink">{label}<StitchInfoHint text="Progress toward this objective's limit. The bar turns amber near the limit and red when breached." /></span>
        <span className={cn("text-xs font-bold", used >= 80 ? "text-terr" : used >= 60 ? "text-tt-fixed-variant" : "text-tp")}>{used}%</span>
      </div>
      <StitchProgress value={used} tone={used >= 80 ? "negative" : used >= 60 ? "warning" : tone} />
      <p className="mt-1 text-[10px] text-ink-variant">{detail}</p>
    </div>
  );
}

function SimpleCurve({ points }: { points: number[] }) {
  const w = 600, h = 200;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(1, max - min);
  const pts = points.map((v, i) => [30 + (i / (points.length - 1)) * (w - 40), 14 + (1 - (v - min) / span) * (h - 36)] as const);
  const path = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tdCurve" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.25" /><stop offset="100%" stopColor="#4a7c59" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`} fill="url(#tdCurve)" />
      <path d={path} fill="none" stroke="#4a7c59" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Sheets ── */

function AddNoteSheet({ open, onOpenChange, targetName, onAdd }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetName: string;
  /** PRD trader-360 Internal Notes — called with the note body + pin flag. */
  onAdd?: (body: string, pinned: boolean) => void;
}) {
  const [pinned, setPinned] = React.useState(false);
  const [body, setBody] = React.useState("");
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="sticky_note_2"
      title={`Add note — ${targetName}`}
      description="Notes are timestamped and attributed to your admin ID"
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" disabled={!body.trim()} onClick={() => { onAdd?.(body.trim(), pinned); setBody(""); setPinned(false); onOpenChange(false); }}>Save Note</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="Note"><Textarea className="stitch-input min-h-24" value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Called trader about payout verification — docs match." /></Field>
        <Field label="Visibility">
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink"><Checkbox defaultChecked className="border-ink-variant/40" />Internal Only</label>
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink"><Checkbox className="border-ink-variant/40" />Visible to Trader</label>
          </div>
        </Field>
        <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Pin to top<Switch checked={pinned} onCheckedChange={setPinned} /></label>
      </div>
    </StitchSheet>
  );
}

function EditTraderSheet({ open, onOpenChange, trader }: { open: boolean; onOpenChange: (o: boolean) => void; trader: Trader }) {
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="edit" title={`Edit ${trader.name}`}
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Trader updated" }); }}>Save</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="Full Name"><Input className="stitch-input" defaultValue={trader.name} /></Field>
        <Field label="Email"><Input className="stitch-input" defaultValue={trader.email} /></Field>
        <Field label="Country"><Input className="stitch-input" defaultValue={trader.country} /></Field>
        <Field label="Phone (optional)"><Input className="stitch-input" placeholder="+1 …" /></Field>
        <Field label="Tags"><Input className="stitch-input" placeholder="vip, high-volume, affiliate…" /></Field>
      </div>
    </StitchSheet>
  );
}

function PayoutScheduleSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="payments" title="Edit Payout Schedule"
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        <StitchButton variant="primary" onClick={() => { onOpenChange(false); toast({ title: "Payout schedule saved" }); }}>Save</StitchButton>
      </>}
    >
      <div className="space-y-3">
        <Field label="Frequency">
          <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">
            <option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option><option>Quarterly</option>
          </select>
        </Field>
        <Field label="Next Payout Date"><Input className="stitch-input" type="date" /></Field>
        <Field label="Profit Split Override (%)"><Input className="stitch-input" type="number" placeholder="blank = challenge default" /></Field>
        <Field label="First Withdrawal Delay"><Input className="stitch-input" placeholder="e.g. 14 days" /></Field>
        <Field label="Notes"><Textarea className="stitch-input" /></Field>
      </div>
    </StitchSheet>
  );
}

function ResyncSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = ["Connecting to bridge", "Fetching equity", "Fetching open positions", "Reconciling history"];
  const [done, setDone] = React.useState(0);
  React.useEffect(() => {
    if (!open) { setDone(0); return; }
    const t = setInterval(() => setDone((d) => (d >= steps.length ? d : d + 1)), 700);
    return () => clearInterval(t);
  }, [open, steps.length]);
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="sync" title="Resync in progress"
      description="Estimated 15 seconds"
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

function ImpersonateSheet({ open, onOpenChange, name }: { open: boolean; onOpenChange: (o: boolean) => void; name: string }) {
  const [ack, setAck] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const { user } = usePlatform();
  // In-page guard — starting a session requires impersonation.start
  // (prop-admin). The trigger is already disabled for other roles; this
  // covers deep entry points too.
  const allowed = hasPermission(user, "impersonation.start");
  const canBegin = allowed && ack && reason.trim().length > 0;
  return (
    <StitchSheet
      open={open} onOpenChange={onOpenChange} icon="swap_horiz" title={`Login as ${name}?`}
      footer={<>
        <StitchButton variant="surface" onClick={() => onOpenChange(false)}>Cancel</StitchButton>
        {/* PRD L5494 — session start pushes impersonation_started + opens
            the shell banner (reason + duration are required inputs). */}
        <StitchButton
          variant="primary"
          disabled={!canBegin}
          title={canBegin ? undefined : !allowed ? "Requires impersonation.start" : "Acknowledge audit logging and provide a reason"}
          onClick={() => {
            onOpenChange(false);
            startImpersonation(name, user?.name ?? "Platform Admin", { reason: reason.trim(), durationMinutes: duration });
            setAck(false);
            setReason("");
          }}
        >
          Begin Session
        </StitchButton>
      </>}
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-variant">
          You will be signed in as <strong className="text-ink">{name}</strong> for {duration} minutes.
          Every action is recorded under your admin ID.
        </p>
        {!allowed ? (
          <p className="rounded-lg bg-terr-container/40 px-3 py-2.5 text-xs font-medium text-terr">
            Requires the impersonation.start permission (prop-admin).
          </p>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink">Business reason (required)</span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Reproducing a trader-reported order placement issue."
            className="stitch-input min-h-[64px]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink">Session duration</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        <label className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="border-ink-variant/40" />
          I understand audit logging is enabled
        </label>
      </div>
    </StitchSheet>
  );
}
