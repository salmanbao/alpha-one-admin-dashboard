"use client";

/** 
 * PFaaS Prop Admin — Challenge Detail Stitch Page
 * Displays detailed challenge information with 7 tabs: Overview, Participants, 
 * Positions, Performance, KYC, Risk, Change History.
 * Uses stitch component library consistent with trading module pattern.
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  getTenantChallenges,
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantKyc,
  getTenantBreaches,
  getTenantAudit,
  getTenant,
  type Challenge,
  type Trader,
} from "@/lib/platform/mock-data";
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

function money(v: number, currency = "USD", compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
}

const TABS = [
  "Overview",
  "Participants",
  "Positions",
  "Performance",
  "KYC",
  "Risk",
  "Change History",
] as const;
type Tab = (typeof TABS)[number];

export function ChallengeDetailStitchPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const tenantCur = runtime.tenant?.currency ?? "USD";

  const challenges = getTenantChallenges(tid);
  const challenge: Challenge = challenges[0] ?? {
    id: "c0",
    tenantId: tid,
    name: "Evaluation Challenge 30",
    description: "80/20 profit split, 10% evaluation fee",
    type: "evaluation" as const,
    phase: "phase-1" as const,
    status: "active" as const,
    startDate: "",
    endDate: "",
    traderCount: 3,
    totalTraders: 3,
    passedTraders: 1,
    failedTraders: 1,
    fundedTraders: 1,
    equity: 0,
    totalPnl: 0,
    combinedPnl: 0,
    joinCode: "ABC123",
    maxTraders: 20,
    objectives: {
      "daily-loss": 1000,
      "max-drawdown": 5000,
      "profit-target": 10000,
    },
    currency: "USD",
  };

  const traders = getTenantTraders(tid);
  const participants = traders.filter((t) => t.challengeId === challenge.id);
  const allAccounts = getTenantAccounts(tid);
  const positions = getTenantPositions(tid);
  const kyc = getTenantKyc(tid).find((k) => k.challengeId === challenge.id);
  const breaches = getTenantBreaches(tid).filter((b) => b.challengeId === challenge.id);
  const audit = getTenantAudit(tid).slice(0, 12);

  const [tab, setTab] = React.useState<Tab>("Overview");
  const [resyncOpen, setResyncOpen] = React.useState(false);

  const tenantData = getTenant(tid);

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-tp transition-colors hover:bg-sfc"
        onClick={() => navigate("challenges")}
      >
        <MsIconSafe name="arrow_back" /> Back to {plural(term("challenge")).toLowerCase()}
      </button>

      <StitchPageHeader
        icon="trending_up"
        title={challenge.name}
        subtitle={`${challenge.phase} — ${challenge.status}`}
        chip={
          <span className="flex flex-wrap items-center gap-2">
            <StitchStateBadge state={challenge.status} tone={statusTone(challenge.status)} />
            <StitchPill tone="muted">{challenge.type}</StitchPill>
          </span>
        }
        actions={
          <>
            <StitchButton variant="surface" icon="sync" onClick={() => setResyncOpen(true)}>
              Resync
            </StitchButton>
          </>
        }
      />

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StitchKpi label="Traders" value={challenge.traderCount} delta={
          challenge.traderCount >= challenge.totalTraders ? "+100%" : challenge.traderCount > 0 ? `+${challenge.traderCount - 1}` : "0%"
        } icon="users" hint="Total enrolled traders" />
        <StitchKpi label="Passed" value={challenge.passedTraders} delta={
          challenge.passedTraders > 0 ? "+12%" : "0%"
        } icon="check_circle" hint="Traders who passed evaluation" />
        <StitchKpi label="Funded" value={challenge.fundedTraders} delta={
          challenge.fundedTraders > 0 ? "+8%" : "0%"
        } icon="trending_up" hint="Traders receiving funding" />
        <StitchKpi label="P&L" value={money(challenge.combinedPnl, tenantCur)} delta={
          challenge.combinedPnl >= 0 ? "+6.8%" : "-3%"
        } icon="account_balance" hint="Combined across all traders" />
      </section>

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
            <StitchCardHeader icon="badge" title="Challenge Details" description="Core challenge configuration" />
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label={`${term("challenge")} ID"} value={challenge.id} />
              <StitchDetailRow label="Type" value={challenge.type} />
              <StitchDetailRow label="Phase" value={challenge.phase} />
              <StitchDetailRow label="Status" value={
                <StitchPill tone={statusTone(challenge.status)}>
                  {challenge.status}
                </StitchPill>
              } />
              <StitchDetailRow label="Traders" value={`${challenge.traderCount}/${challenge.totalTraders}`} />
              <StitchDetailRow label="Join Code" value={challenge.joinCode} />
            </div>
          </StitchCard>
          <StitchCard>
            <StitchCardHeader icon="calendar_today" title="Timeline" description="Challenge start and end dates" />
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label="Start Date" value={challenge.startDate || "—"} />
              <StitchDetailRow label="End Date" value={challenge.endDate || "—"} />
              <StitchDetailRow label="Max Traders" value={challenge.maxTraders} />
              <StitchDetailRow label="Objective: Daily Loss" value={money(challenge.objectives["daily-loss"], challenge.currency)} />
              <StitchDetailRow label="Objective: Max Drawdown" value={money(challenge.objectives["max-drawdown"], challenge.currency)} />
              <StitchDetailRow label="Objective: Profit Target" value={money(challenge.objectives["profit-target"], challenge.currency)} />
            </div>
            <div className="mt-4 rounded-xl bg-sfc-low p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-tsc">Firm context</p>
              <p className="text-xs text-ink-variant">
                {tenantData?.name ?? "Tenant"} · payout split 80/20 · currency {tenantCur}
              </p>
            </div>
          </StitchCard>
        </div>
      ) : null}

      {tab === "Participants" ? (
        <StitchCard className="p-0">
          <StitchTable
            keyOf={(t) => t.id}
            rows={participants}
            columns={[
              { header: "Trader", cell: (t) => <span className="font-medium text-ink">{t.name}</span> },
              { header: "Email", cell: (t) => <span className="text-sm text-ink-variant">{t.email}</span> },
              { header: "Country", cell: (t) => <span className="text-sm text-ink-variant">{t.country}</span> },
              { header: "Status", cell: (t) =>
                <StitchStateBadge state={t.status} tone={statusTone(t.status)} />,
              },
              { header: "Equity", cell: (t) => money(t.equity, tenantCur), numeric: true },
              { header: "P&L", cell: (t) => money(t.totalPnl, tenantCur), numeric: true },
              { header: "Trades", cell: (t) => t.trades, numeric: true },
            ]}
            emptyState={<EmptyHint title="No participants" body="Traders join the challenge using the join code." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Positions" ? (
        <StitchCard className="p-0">
          <StitchTable
            keyOf {(p) => p.id}
            rows=positions>
            columns={[
              { header: "Symbol", cell: (p) => <span className="font-mono text-xs font-semibold text-ink">{p.symbol}</span> },
              { header: "Side", cell: (p) => <span className={cn("font-bold", p.side === "buy" ? "text-tp" : "text-terr")}>{p.side === "buy" ? "Buy" : "Sell"}</span> },
              { header: "Volume", cell: (p) => p.volume, numeric: true },
              { header: "Entry", cell: (p) => p.entryPrice, numeric: true },
              { header: "Current", cell: (p) => p.currentPrice, numeric: true },
              {
                header: "P&L",
                cell: (p) => (
                  <span className={cn("font-bold", p.pnl >= 0 ? "text-tp" : "text-terr")}>
                    {money(p.pnl, tenantCur)}
                  </span>
                ),
                numeric: true,
              },
            ]}
            emptyState={<EmptyHint title="No open positions" body="Open trades appear here while challenge is active." />}
          />
        </StitchCard>
      ) : null}

      {tab === "Performance" ? (
        <StitchCard>
          <StitchCardHeader icon="monitoring" title="Equity Curve" description="30-day challenge equity progression" right={<StitchSegmented options={[{ value: "30d", label: "30d" }]} value="30d" onChange={() => {}} />} />
          <div className="h-56">
            <SimpleCurve points={Array.from({ length: 30 }, (_, i) => challenge.equity * (0.85 + Math.sin(i / 3) * 0.04 + i * 0.006))} />
          </div>
        </StitchCard>
      ) : null}

      {tab === "KYC" ? (
        <StitchCard>
          <StitchCardHeader
            icon="verified_user"
            title="KYC Record"
            description={kyc ? "Identity verification state for this challenge" : "No verification submitted yet"}
            right={
              <div className="flex gap-2">
                <StitchButton variant="surface" onClick={() => toast({ title: "KYC re-initiated" })}>Re-initiate</StitchButton>
                <StitchButton variant="surface" onClick={() => toast({ title: "KYC marked verified", description: "Payout eligibility unlocked." })}>Mark Verified</StitchButton>
              </div>
            }
          />
          {kyc ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <StitchDetailRow label="Submitted" value={kyc.submittedAt} />
              <StitchDetailRow label="Status" value={
                <StitchPill tone={kyc.status === "approved" ? "positive" : "warning"}>
                  {kyc.status}
                </StitchPill>
              } />
              <StitchDetailRow label="Document" value={kyc.documentType} />
              <StitchDetailRow label="Country" value={kyc.country} />
              <StitchDetailRow label="Risk level" value={
                <StitchPill tone={kyc.riskLevel === "high" ? "negative" : kyc.riskLevel === "medium" ? "warning" : "positive"}>
                  {kyc.riskLevel}
                </StitchPill>
              } />
              <StitchDetailRow label="Reviewed" value={kyc.reviewedAt ?? "—"} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center">
              <p className="text-sm font-semibold text-ink">No KYC record yet</p>
              <p className="mt-1 text-xs text-ink-variant">When traders submit identity documents, verification state will appear here.</p>
              <div className="mt-3">
                <StitchButton variant="primary" onClick={() => toast({ title: "KYC request sent to traders" })}>Request KYC</StitchButton>
              </div>
            </div>
          )}
        </StitchCard>
      ) : null}

      {tab === "Risk" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <StitchCard>
            <StitchCardHeader icon="gpp_maybe" title="Recent Breaches" description={`${breaches.length} recorded for this challenge`} />
            {breaches.length === 0 ? (
              <p className="rounded-lg bg-sfc-low p-4 text-xs text-ink-variant">
                No breaches — all traders staying within risk rules.
              </p>
            ) : (
              <div className="space-y-2">
                {breaches.slice(0, 6).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-sfc-low px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{b.type}</p>
                      <p className="text-[10px] text-ink-variant">{b.rule} · {b.triggeredAt}</p>
                    </div>
                    <StitchPill tone={b.severity === "critical" ? "negative" : "warning"}>
                      {b.severity}
                    </StitchPill>
                  </div>
                ))}
              </div>
            )}
          </StitchCard>
          <StitchCard>
            <StitchCardHeader icon="health_and_safety" title="Challenge Health" description="Phase objectives progress" />
            <div className="space-y-3">
              <HealthMeter label="Daily Loss" used={41} detail="$820 of $1,000 used" />
              <HealthMeter label="Max Drawdown" used={37} detail="$1,840 of $5,000 used" />
              <HealthMeter label="Profit Target" used={72} detail="$7,200 of $10,000" tone="positive" />
            </div>
          </StitchCard>
        </div>
      ) : null}

      {tab === "Change History" ? (
        <StitchCard>
          <StitchCardHeader
            icon="history"
            title="Change History"
            description="Last 12 changes recorded for this challenge"
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
      <ResyncSheet open={resyncOpen} onOpenChange={setResyncOpen} />
      <StitchButton variant="ghost" className="hidden" onClick={() => setResyncOpen(true)}>resync</StitchButton>
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

function HealthMeter({
  label,
  used,
  detail,
  tone = "warning",
}: {
  label: string;
  used: number;
  detail: string;
  tone?: "positive" | "warning" | "negative";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
          {label}<StitchInfoHint text="Progress toward this objective's limit. The bar turns amber near the limit and red when breached." />
        </span>
        <span className={cn("text-xs font-bold", used >= 80 ? "text-terr" : used >= 60 ? "text-tt-fixed-variant" : "text-tp")}>{used}%</span>
      </div>
      <StitchProgress value={used} tone={used >= 80 ? "negative" : used >= 60 ? "warning" : tone} />
      <p className="mt-1 text-[10px] text-ink-variant">{detail}</p>
    </div>
  );
}

function SimpleCurve({ points }: { points: number[] }) {
  const w = 600,
    h = 200;
  const min = Math.min(...points),
    max = Math.max(...points);
  const span = Math.max(1, max - min);
  const pts = points.map((v, i) => [30 + (i / (points.length - 1)) * (w - 40), 14 + (1 - (v - min) / span) * (h - 36)] as const);
  const path = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tdCurve" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4a7c59" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`} fill="url(#tdCurve)" />
      <path d={path} fill="none" stroke="#4a7c59" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}