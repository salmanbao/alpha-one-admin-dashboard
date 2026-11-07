"use client";

/**
 * Tenant Marketing Usage (M7 §11.1) — cross-tenant marketing console.
 *
 * Replaces the old single-tenant demo (coupons/campaigns/A-B tests with
 * stubbed buttons) with the operator view: which tenants are sending, how
 * much of their plan quota they consume, which channels they use, and where
 * anomalies (send spikes, complaint rates, quota forecast breaches) need
 * intervention. Quota changes are dual-controlled — they create an
 * approval-center item and only apply on the effective date after a second
 * operator approves (CON-32).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { usePlatform } from "@/lib/platform/platform-context";
import { initiateApproval } from "@/lib/platform/console-store";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Download,
  Settings2,
  Users,
  Send,
  DollarSign,
  AlertTriangle,
  Mail,
  MessageSquare,
  Bell,
  MessagesSquare,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Megaphone as NotifyIcon,
  Ban,
  ShieldCheck,
  Activity,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + seed data (dummy only — no network calls)                   */
/* ------------------------------------------------------------------ */

type ChannelKey = "email" | "sms" | "push" | "whatsapp";
type AnomalyReason = "send spike" | "complaint rate" | "quota forecast breach";

interface QuotaHistoryEntry {
  at: string;
  change: string;
  by: string;
  state: "applied" | "pending";
}

interface CampaignStat {
  name: string;
  channel: ChannelKey;
  volume: number;
  sentAt: string;
}

interface TenantUsage {
  id: string;
  name: string;
  plan: "Starter" | "Growth" | "Scale" | "Enterprise";
  sendsUsed: number;
  sendsQuota: number;
  channels: ChannelKey[];
  connectors: number;
  adSpend: number;
  providerCost30d: number;
  planAllowance30d: number;
  anomaly?: { reason: AnomalyReason; detail: string; evidence: string[] };
  /** Usage fetch failure marks the row stale with its last-computed stamp. */
  stale?: boolean;
  lastComputed: string;
  suspended?: boolean;
  limits: Record<ChannelKey, number>;
  channelBreakdown: { channel: ChannelKey; sends: number }[];
  campaigns: CampaignStat[];
  trend30d: number[];
  quotaHistory: QuotaHistoryEntry[];
}

const channelMeta: Record<ChannelKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
  push: { label: "Push", icon: Bell },
  whatsapp: { label: "WhatsApp", icon: MessagesSquare },
};

const allChannels: ChannelKey[] = ["email", "sms", "push", "whatsapp"];

/** Deterministic 30d series — no Math.random (hydration-safe). */
function trendSeries(base: number, spikeFrom?: number): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const wave = 0.75 + ((i * 37) % 45) / 100;
    const spike = spikeFrom !== undefined && i >= spikeFrom ? base * 1.8 : 0;
    return Math.round(base * wave + spike);
  });
}

const seedTenants: TenantUsage[] = [
  {
    id: "t-alpha",
    name: "Alpha Capital",
    plan: "Enterprise",
    sendsUsed: 412_500,
    sendsQuota: 450_000,
    channels: ["email", "push", "whatsapp"],
    connectors: 4,
    adSpend: 18_400,
    providerCost30d: 6_900,
    planAllowance30d: 7_500,
    anomaly: {
      reason: "quota forecast breach",
      detail: "Forecast: 103% of email quota by 12 Nov",
      evidence: [
        "7-day average 21.4k/day vs quota headroom 12.5k/day",
        "Two scheduled campaigns (Black Friday, Win-back) land before the reset",
        "Forecast breach in 4 days at current ramp",
      ],
    },
    lastComputed: "8m ago",
    limits: { email: 450_000, sms: 0, push: 200_000, whatsapp: 60_000 },
    channelBreakdown: [
      { channel: "email", sends: 268_000 },
      { channel: "push", sends: 104_500 },
      { channel: "whatsapp", sends: 40_000 },
    ],
    campaigns: [
      { name: "Q4 Challenge Launch", channel: "email", volume: 96_000, sentAt: "2026-10-28" },
      { name: "Payout Reminder (push)", channel: "push", volume: 61_200, sentAt: "2026-11-01" },
      { name: "Win-back: Lapsed Traders", channel: "email", volume: 54_800, sentAt: "2026-10-19" },
      { name: "WhatsApp: Referral Nudge", channel: "whatsapp", volume: 40_000, sentAt: "2026-10-22" },
      { name: "Black Friday Teaser", channel: "email", volume: 38_000, sentAt: "2026-11-04" },
    ],
    trend30d: trendSeries(13_000, 22),
    quotaHistory: [
      { at: "2026-09-01", change: "Email quota 350k → 450k (Scale upgrade)", by: "R. Okafor", state: "applied" },
      { at: "2026-07-14", change: "WhatsApp channel added, 60k quota", by: "M. Lindqvist", state: "applied" },
      { at: "2026-05-02", change: "Initial quota set", by: "System", state: "applied" },
    ],
  },
  {
    id: "t-beta",
    name: "Beta Trading",
    plan: "Scale",
    sendsUsed: 96_400,
    sendsQuota: 200_000,
    channels: ["email", "sms"],
    connectors: 2,
    adSpend: 7_150,
    providerCost30d: 2_450,
    planAllowance30d: 3_200,
    anomaly: {
      reason: "complaint rate",
      detail: "Complaint rate 0.41% (platform limit 0.19%)",
      evidence: [
        "Complaint samples: 38 spam reports on 'Refill Promo — Day 3'",
        "ISP breakdown: Gmail 0.52% · Outlook 0.31% · Yahoo 0.28%",
        "Suppression list lag: 6h behind new complaints",
      ],
    },
    lastComputed: "14m ago",
    limits: { email: 160_000, sms: 40_000, push: 0, whatsapp: 0 },
    channelBreakdown: [
      { channel: "email", sends: 71_400 },
      { channel: "sms", sends: 25_000 },
    ],
    campaigns: [
      { name: "Refill Promo — Day 3", channel: "email", volume: 31_400, sentAt: "2026-11-02" },
      { name: "Challenge Expiry SMS", channel: "sms", volume: 25_000, sentAt: "2026-10-30" },
      { name: "Weekly Digest", channel: "email", volume: 18_000, sentAt: "2026-11-05" },
      { name: "Feature Announce", channel: "email", volume: 12_000, sentAt: "2026-10-24" },
      { name: "Re-engagement Drip", channel: "email", volume: 7_000, sentAt: "2026-10-18" },
    ],
    trend30d: trendSeries(3_200),
    quotaHistory: [
      { at: "2026-10-11", change: "Email quota 120k → 160k", by: "R. Okafor", state: "applied" },
      { at: "2026-08-03", change: "SMS channel enabled", by: "M. Lindqvist", state: "applied" },
    ],
  },
  {
    id: "t-gamma",
    name: "Gamma Futures",
    plan: "Growth",
    sendsUsed: 51_800,
    sendsQuota: 120_000,
    channels: ["email", "push"],
    connectors: 3,
    adSpend: 4_320,
    providerCost30d: 1_180,
    planAllowance30d: 1_800,
    anomaly: {
      reason: "send spike",
      detail: "4.2× baseline over 6 hours (2.1k → 8.9k/h)",
      evidence: [
        "Send spike chart: baseline 2.1k/h → peak 8.9k/h at 03:00 UTC",
        "Single automation 'cart-abandon' accounts for 78% of the delta",
        "No matching campaign schedule — likely a re-triggered flow",
      ],
    },
    lastComputed: "3m ago",
    limits: { email: 100_000, sms: 0, push: 20_000, whatsapp: 0 },
    channelBreakdown: [
      { channel: "email", sends: 39_800 },
      { channel: "push", sends: 12_000 },
    ],
    campaigns: [
      { name: "Cart Abandon Recover", channel: "email", volume: 24_000, sentAt: "2026-11-05" },
      { name: "Daily Market Push", channel: "push", volume: 12_000, sentAt: "2026-11-06" },
      { name: "New Tier Launch", channel: "email", volume: 9_800, sentAt: "2026-10-27" },
      { name: "Survey Request", channel: "email", volume: 4_000, sentAt: "2026-10-21" },
      { name: "Reactivation Nudge", channel: "email", volume: 1_500, sentAt: "2026-10-15" },
    ],
    trend30d: trendSeries(1_700, 27),
    quotaHistory: [
      { at: "2026-09-19", change: "Push quota 10k → 20k", by: "R. Okafor", state: "applied" },
      { at: "2026-06-30", change: "Initial quota set", by: "System", state: "applied" },
    ],
  },
  {
    id: "t-delta",
    name: "Delta Prop",
    plan: "Starter",
    sendsUsed: 9_120,
    sendsQuota: 25_000,
    channels: ["email"],
    connectors: 1,
    adSpend: 640,
    providerCost30d: 190,
    planAllowance30d: 400,
    lastComputed: "2h ago",
    stale: true,
    limits: { email: 25_000, sms: 0, push: 0, whatsapp: 0 },
    channelBreakdown: [{ channel: "email", sends: 9_120 }],
    campaigns: [
      { name: "Signup Welcome", channel: "email", volume: 4_500, sentAt: "2026-11-03" },
      { name: "Weekly Summary", channel: "email", volume: 3_120, sentAt: "2026-11-05" },
      { name: "Trial Expiry", channel: "email", volume: 1_500, sentAt: "2026-10-29" },
      { name: "Password Reset", channel: "email", volume: 640, sentAt: "2026-10-26" },
      { name: "Refund Notice", channel: "email", volume: 360, sentAt: "2026-10-20" },
    ],
    trend30d: trendSeries(300),
    quotaHistory: [{ at: "2026-10-02", change: "Initial quota set", by: "System", state: "applied" }],
  },
  {
    id: "t-epsilon",
    name: "Epsilon Markets",
    plan: "Growth",
    sendsUsed: 14_400,
    sendsQuota: 120_000,
    channels: ["email", "whatsapp"],
    connectors: 2,
    adSpend: 2_050,
    providerCost30d: 610,
    planAllowance30d: 1_800,
    lastComputed: "11m ago",
    limits: { email: 100_000, sms: 0, push: 0, whatsapp: 20_000 },
    channelBreakdown: [
      { channel: "email", sends: 11_400 },
      { channel: "whatsapp", sends: 3_000 },
    ],
    campaigns: [
      { name: "Onboarding Series 1/3", channel: "email", volume: 6_400, sentAt: "2026-11-01" },
      { name: "WhatsApp Price Alert", channel: "whatsapp", volume: 3_000, sentAt: "2026-11-04" },
      { name: "Onboarding Series 2/3", channel: "email", volume: 3_000, sentAt: "2026-11-03" },
      { name: "Monthly Report", channel: "email", volume: 1_500, sentAt: "2026-10-31" },
      { name: "NPS Request", channel: "email", volume: 500, sentAt: "2026-10-25" },
    ],
    trend30d: trendSeries(480),
    quotaHistory: [{ at: "2026-08-21", change: "Initial quota set", by: "System", state: "applied" }],
  },
  {
    id: "t-zeta",
    name: "Zeta Trading",
    plan: "Starter",
    sendsUsed: 0,
    sendsQuota: 25_000,
    channels: [],
    connectors: 0,
    adSpend: 0,
    providerCost30d: 0,
    planAllowance30d: 400,
    lastComputed: "—",
    limits: { email: 25_000, sms: 0, push: 0, whatsapp: 0 },
    channelBreakdown: [],
    campaigns: [],
    trend30d: trendSeries(0),
    quotaHistory: [{ at: "2026-11-04", change: "Provisioned — no channels enabled yet", by: "System", state: "applied" }],
  },
];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function QuotaBar({ used, quota, compact = false }: { used: number; quota: number; compact?: boolean }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const tone = pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full min-w-[110px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn("font-semibold tabular-nums", pct >= 90 ? "text-rose-600" : "text-foreground")}>
          {pct}%
        </span>
        {!compact && (
          <span className="tabular-nums text-muted-foreground">
            {used.toLocaleString()} / {quota.toLocaleString()}
          </span>
        )}
      </div>
      <div
        className={cn("mt-1 h-2 w-full overflow-hidden rounded-full bg-muted", pct >= 90 && "ring-1 ring-rose-500/40")}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Quota consumed"
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SendSparkline({ points, label }: { points: number[]; label: string }) {
  const width = 300;
  const height = 56;
  const max = Math.max(...points, 1);
  const coords = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * width;
    const y = height - 4 - (p / max) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full text-primary"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polygon points={`0,${height} ${coords.join(" ")} ${width},${height}`} fill="currentColor" opacity="0.12" />
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BarRow({ label, icon: Icon, value, max, suffix }: { label: string; icon: React.ComponentType<{ className?: string }>; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
        {value.toLocaleString()}
        {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Adjust quota dialog — creates an approval-center item               */
/* ------------------------------------------------------------------ */

function AdjustQuotaDialog({
  tenant,
  onClose,
  onSubmit,
}: {
  tenant: TenantUsage;
  onClose: () => void;
  onSubmit: (limits: Record<ChannelKey, number>, effectiveDate: string, justification: string) => void;
}) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [limits, setLimits] = useState<Record<ChannelKey, string>>({
    email: String(tenant.limits.email),
    sms: String(tenant.limits.sms),
    push: String(tenant.limits.push),
    whatsapp: String(tenant.limits.whatsapp),
  });
  const [effectiveDate, setEffectiveDate] = useState(tomorrow);
  const [justification, setJustification] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const justificationOk = justification.trim().length >= 10;
  const dateOk = effectiveDate.trim().length > 0;
  const activeChannels = tenant.channels.length > 0 ? tenant.channels : ["email"] as ChannelKey[];

  const submit = () => {
    if (!justificationOk || !dateOk) {
      setShowErrors(true);
      return;
    }
    const parsed = {} as Record<ChannelKey, number>;
    allChannels.forEach((ch) => {
      parsed[ch] = Math.max(0, Number(limits[ch]) || 0);
    });
    onSubmit(parsed, effectiveDate, justification.trim());
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Adjust quota — {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Per-channel limits take effect on the effective date, and only after a second platform
            operator approves this request in the Approval Center.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {activeChannels.map((ch) => {
              const meta = channelMeta[ch];
              return (
                <div key={ch}>
                  <Label className="text-xs" htmlFor={`limit-${ch}`}>
                    {meta.label} limit ({tenant.channels.includes(ch) ? "enabled" : "current"})
                  </Label>
                  <Input
                    id={`limit-${ch}`}
                    type="number"
                    min={0}
                    value={limits[ch]}
                    onChange={(e) => setLimits((prev) => ({ ...prev, [ch]: e.target.value }))}
                    className="mt-1 tabular-nums"
                  />
                </div>
              );
            })}
          </div>

          <div>
            <Label className="text-xs" htmlFor="quota-effective">Effective date</Label>
            <Input
              id="quota-effective"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="mt-1"
            />
            {showErrors && !dateOk ? (
              <p className="mt-1 text-xs text-destructive">An effective date is required.</p>
            ) : null}
          </div>

          <div>
            <Label className="text-xs" htmlFor="quota-justification">
              Justification note (required — recorded in the audit trail)
            </Label>
            <Textarea
              id="quota-justification"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. Plan upgrade to Enterprise + Black Friday ramp agreed with the tenant on 6 Nov"
              className="mt-1 text-sm"
            />
            {showErrors && !justificationOk ? (
              <p className="mt-1 text-xs text-destructive">Give a meaningful justification (at least 10 characters).</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Requester: this operator · Approver: second operator (self-approval denied).</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>
            <ShieldCheck className="mr-1 h-4 w-4" /> Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Suspend sends — danger dialog with typed confirmation               */
/* ------------------------------------------------------------------ */

function SuspendDialog({
  tenant,
  onClose,
  onConfirm,
}: {
  tenant: TenantUsage;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const phrase = tenant.name;
  const ok = typed.trim() === phrase;

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" /> Temporarily suspend marketing sends?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Marketing categories for <span className="font-semibold text-foreground">{tenant.name}</span> are
                blocked at the next campaign attempt. Transactional mail (payouts, security, receipts)
                stays lawful and continues to deliver via the M2.4 policy engine.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{tenant.sendsUsed.toLocaleString()} sends in the last 30 days stop at the next batch.</li>
                <li>{tenant.campaigns.filter((c) => c.volume > 0).length} scheduled marketing campaigns are blocked with a suspension reason.</li>
                <li>Reversible — resume from this drawer at any time.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div>
          <Label className="text-xs" htmlFor="suspend-confirm">
            Type <span className="font-mono font-semibold">{phrase}</span> to confirm
          </Label>
          <Input
            id="suspend-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phrase}
            className="mt-1 font-mono"
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!ok} onClick={onConfirm}>
            <Ban className="mr-1 h-4 w-4" /> Suspend marketing sends
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketingPage() {
  const { user } = usePlatform();

  // Async seam: skeleton + error/retry resolve through the mock layer.
  const {
    data: loaded,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => seedTenants, { delayMs: 450 }), []);

  const [tenants, setTenants] = useState<TenantUsage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const [detail, setDetail] = useState<TenantUsage | null>(null);
  const [focusEvidence, setFocusEvidence] = useState(false);
  const evidenceRef = useRef<HTMLDivElement | null>(null);
  const [quotaTarget, setQuotaTarget] = useState<TenantUsage | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<TenantUsage | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    if (loaded) setTenants(loaded);
  }, [loaded]);

  // Deep-link: anomaly flags open the drawer on the offending evidence.
  useEffect(() => {
    if (focusEvidence && detail && evidenceRef.current) {
      evidenceRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusEvidence(false);
    }
  }, [focusEvidence, detail]);

  const kpis = useMemo(() => {
    const active = tenants.filter((t) => t.sendsUsed > 0 && t.channels.length > 0).length;
    const totalSends = tenants.reduce((s, t) => s + t.sendsUsed, 0);
    const cost = tenants.reduce((s, t) => s + t.providerCost30d, 0);
    const allowance = tenants.reduce((s, t) => s + t.planAllowance30d, 0);
    const costPct = allowance > 0 ? Math.round((cost / allowance) * 100) : 0;
    const anomalies = tenants.filter((t) => t.anomaly).length;
    return { active, totalSends, costPct, anomalies };
  }, [tenants]);

  const hasActivity = tenants.length > 0 && tenants.some((t) => t.channels.length > 0 && t.sendsUsed > 0);

  const rows = useMemo(
    () => (channelFilter === "all" ? tenants : tenants.filter((t) => t.channels.includes(channelFilter as ChannelKey))),
    [tenants, channelFilter],
  );

  const openDetail = (t: TenantUsage, evidence = false) => {
    setDetail(t);
    setFocusEvidence(evidence);
  };

  const notifyTenant = (t: TenantUsage) => {
    toast({
      title: "Tenant notified",
      description: `${t.name} admin received a marketing usage notice (quota at ${Math.round((t.sendsUsed / t.sendsQuota) * 100)}%, ${t.anomaly ? t.anomaly.reason : "no anomaly"}).`,
    });
  };

  const refreshUsage = async () => {
    setRefreshing(true);
    try {
      await mockAsync(true, { delayMs: 600 });
      setTenants((prev) => prev.map((t) => ({ ...t, stale: false, lastComputed: "just now" })));
      const staleCount = tenants.filter((t) => t.stale).length;
      toast({ title: "Usage refreshed", description: `${staleCount || "Affected"} stale row(s) recomputed at ${new Date().toLocaleTimeString()}.` });
    } finally {
      setRefreshing(false);
    }
  };

  const submitQuota = (limits: Record<ChannelKey, number>, effectiveDate: string, justification: string) => {
    const target = quotaTarget;
    if (!target) return;
    const request = initiateApproval({
      actionKey: "marketing.quota.adjust",
      actionLabel: `Adjust marketing quota — ${target.name}`,
      blastRadius: [
        `New channel limits for ${target.name} apply on ${effectiveDate}: ${allChannels.filter((c) => target.channels.includes(c)).map((c) => `${channelMeta[c].label} ${limits[c].toLocaleString()}`).join(" · ")}`,
        "Limits are enforced by the metering engine only after approval — current quota stays in force until then.",
        "The audit trail records requester (this operator) and approver (second operator).",
      ],
      initiator: { id: user.id, name: user.name },
      tenantId: target.id,
      detail: `Effective ${effectiveDate} · justification: ${justification}`,
    });
    setTenants((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? {
              ...t,
              quotaHistory: [
                {
                  at: effectiveDate,
                  change: `Requested quota change ${request.id} — pending approval`,
                  by: user.name,
                  state: "pending" as const,
                },
                ...t.quotaHistory,
              ],
            }
          : t,
      ),
    );
    setQuotaTarget(null);
    setDetail((d) => (d && d.id === target.id ? { ...d, quotaHistory: [{ at: effectiveDate, change: `Requested quota change ${request.id} — pending approval`, by: user.name, state: "pending" }, ...d.quotaHistory] } : d));
    toast({
      title: "Routed to approval center",
      description: `Approval item ${request.id} created for ${target.name}. New limits apply on ${effectiveDate} — after a second operator approves.`,
    });
  };

  const confirmSuspend = () => {
    const target = suspendTarget;
    if (!target) return;
    setTenants((prev) => prev.map((t) => (t.id === target.id ? { ...t, suspended: true } : t)));
    setDetail((d) => (d && d.id === target.id ? { ...d, suspended: true } : d));
    setSuspendTarget(null);
    toast({
      title: "Marketing sends suspended",
      description: `${target.name}: marketing categories are blocked with a suspension reason at the next attempt. Transactional mail (payouts, security) continues to deliver.`,
    });
  };

  const resumeSends = (t: TenantUsage) => {
    setTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, suspended: false } : x)));
    setDetail((d) => (d && d.id === t.id ? { ...d, suspended: false } : d));
    toast({ title: "Marketing sends resumed", description: `${t.name} may schedule marketing campaigns again.` });
  };

  const columns: Column<TenantUsage>[] = [
    {
      key: "tenant",
      header: "Tenant",
      sortValue: (t) => t.name,
      cell: (t) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">{t.name}</span>
            <Badge variant="secondary" className="text-[9px]">{t.plan}</Badge>
          </div>
          {t.suspended ? (
            <span className="mt-0.5 inline-block"><StatusBadge tone="danger">Sends suspended</StatusBadge></span>
          ) : t.stale ? (
            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Stale · last computed {t.lastComputed}
            </span>
          ) : (
            <span className="mt-0.5 block text-[10px] text-muted-foreground">Computed {t.lastComputed}</span>
          )}
        </div>
      ),
    },
    {
      key: "quota",
      header: "Sends used / quota",
      sortValue: (t) => (t.sendsQuota > 0 ? t.sendsUsed / t.sendsQuota : 0),
      cell: (t) => <QuotaBar used={t.sendsUsed} quota={t.sendsQuota} />,
    },
    {
      key: "channels",
      header: "Channels enabled",
      cell: (t) =>
        t.channels.length === 0 ? (
          <span className="text-xs text-muted-foreground">None yet</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {t.channels.map((ch) => {
              const Icon = channelMeta[ch].icon;
              return (
                <Badge key={ch} variant="outline" className="gap-1 px-1.5 py-0 text-[9px]">
                  <Icon className="h-3 w-3" /> {channelMeta[ch].label}
                </Badge>
              );
            })}
          </div>
        ),
    },
    {
      key: "connectors",
      header: "Connectors",
      numeric: true,
      sortValue: (t) => t.connectors,
      cell: (t) => <span className="tabular-nums">{t.connectors}</span>,
    },
    {
      key: "adSpend",
      header: "Ad spend (30d)",
      numeric: true,
      sortValue: (t) => t.adSpend,
      cell: (t) => (
        <span className="tabular-nums">{t.adSpend > 0 ? `$${t.adSpend.toLocaleString()}` : "—"}</span>
      ),
    },
    {
      key: "anomaly",
      header: "Anomaly flag",
      sortValue: (t) => (t.anomaly ? t.anomaly.reason : "none"),
      cell: (t) =>
        t.anomaly ? (
          <button
            type="button"
            onClick={() => openDetail(t, true)}
            className="rounded-md p-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open evidence for ${t.name}: ${t.anomaly.reason}`}
            title={t.anomaly.detail}
          >
            <StatusBadge tone={t.anomaly.reason === "send spike" ? "warning" : "danger"}>{t.anomaly.reason}</StatusBadge>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" aria-label={`View detail — ${t.name}`} onClick={() => openDetail(t)}>
            <Eye className="h-3 w-3" /> Detail
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" aria-label={`Adjust quota — ${t.name}`} onClick={() => setQuotaTarget(t)}>
            <SlidersHorizontal className="h-3 w-3" /> Quota
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" aria-label={`Notify tenant — ${t.name}`} onClick={() => notifyTenant(t)}>
            <NotifyIcon className="h-3 w-3" /> Notify
          </Button>
        </div>
      ),
    },
  ];

  const d = detail;

  return (
    <Page>
      <PageHeader
        title="Tenant Marketing Usage"
        description="Cross-tenant send metering: plan quota consumption, channel enablement, provider cost and anomaly flags for every tenant."
        icon={Megaphone}
        actions={
          <>
            <Button size="sm" onClick={() => toast({ title: "CSV export queued", description: "tenant-marketing-usage-30d.csv — per-tenant sends, quota, channels, cost and anomalies. You'll be notified when it's ready." })}>
              <Download className="mr-1 h-4 w-4" /> Export usage CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPolicyOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" /> Quota policy
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading || refreshing}
          error={error}
          onRetry={retry}
          hasData={loaded !== undefined}
          loadingLabel="Loading tenant marketing usage…"
        >
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Tenants actively sending" value={kpis.active} icon={Users} />
            <MetricCard label="Total sends (30d)" value={kpis.totalSends.toLocaleString()} icon={Send} tone="positive" />
            <MetricCard
              label="Provider cost vs plan allowance"
              value={`${kpis.costPct}%`}
              icon={DollarSign}
              tone={kpis.costPct >= 90 ? "negative" : kpis.costPct >= 75 ? "warning" : "positive"}
              deltaLabel={kpis.costPct >= 100 ? "over allowance" : "within allowance"}
            />
            <MetricCard
              label="Anomalies open"
              value={kpis.anomalies}
              icon={AlertTriangle}
              tone={kpis.anomalies > 0 ? "negative" : "positive"}
              deltaLabel={kpis.anomalies > 0 ? "needs intervention" : "all clear"}
            />
          </div>

          {/* Tenants table (or the no-activity empty state) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Tenants</h2>
                <div className="flex items-center gap-2">
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by channel">
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      {allChannels.map((ch) => (
                        <SelectItem key={ch} value={ch}>{channelMeta[ch].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={refreshUsage} disabled={refreshing}>
                    <RefreshCw className={cn("mr-1 h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh stale rows
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasActivity ? (
                <EmptyState
                  icon={Send}
                  title="No tenant channel activity yet"
                  description="No tenant has enabled a sending channel, so there is nothing to meter. Usage appears here as soon as tenants connect email, SMS, push or WhatsApp."
                  hint="Tenants enable channels from their own marketing console."
                  action={
                    <Button size="sm" variant="outline" onClick={() => toast({ title: "Channel provisioning", description: "Tenants enable channels from their own console — the platform only meters what is enabled." })}>
                      Check channel provisioning
                    </Button>
                  }
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  rowKey={(t) => t.id}
                  loading={loading || refreshing}
                  searchableText={(t) => `${t.name} ${t.plan} ${t.channels.join(" ")} ${t.anomaly?.reason ?? ""}`}
                  searchPlaceholder="Search tenants…"
                  pageSize={8}
                  emptyTitle="No tenant channel activity"
                  emptyDescription={channelFilter === "all" ? "No tenants match this search." : `No tenant has enabled ${channelMeta[channelFilter as ChannelKey].label.toLowerCase()} yet.`}
                />
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Metering rules</p>
            <p className="mt-1">
              Progress turns danger at ≥90% of quota and automatically flags a <em>quota forecast breach</em>.
              Quota changes are dual-controlled: they route to the Approval Center and apply on the effective
              date only after a second operator approves. Suspension blocks marketing categories only —
              transactional mail continues to deliver.
            </p>
          </div>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Tenant drilldown drawer ───────────────────────────── */}
      <Sheet open={d !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {d ? (
            <>
              <SheetHeader className="p-0 pr-8">
                <SheetTitle className="flex items-center gap-2">
                  {d.name}
                  <Badge variant="secondary" className="text-[10px]">{d.plan}</Badge>
                  {d.suspended ? <StatusBadge tone="danger">Sends suspended</StatusBadge> : null}
                  {d.stale ? <StatusBadge tone="warning">Stale usage</StatusBadge> : null}
                </SheetTitle>
                <SheetDescription>
                  {d.sendsUsed.toLocaleString()} / {d.sendsQuota.toLocaleString()} sends in 30 days ·
                  {" "}{d.connectors} connectors · ${d.adSpend.toLocaleString()} ad spend
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 p-4 pt-0">
                {/* Send trend 30d sparkline */}
                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Activity className="h-3.5 w-3.5" /> Send trend · 30d</h3>
                    <span className="text-xs text-muted-foreground">peak {Math.max(...d.trend30d).toLocaleString()}/day</span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <SendSparkline points={d.trend30d} label={`${d.name} 30-day send trend`} />
                  </div>
                </section>

                {/* Channel breakdown bars */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Channel breakdown</h3>
                  {d.channelBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No channel activity yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.channelBreakdown.map((c) => (
                        <BarRow
                          key={c.channel}
                          label={channelMeta[c.channel].label}
                          icon={channelMeta[c.channel].icon}
                          value={c.sends}
                          max={Math.max(...d.channelBreakdown.map((x) => x.sends), 1)}
                          suffix=" sends"
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Anomaly evidence (deep-linked) */}
                {d.anomaly ? (
                  <section
                    ref={evidenceRef}
                    className={cn(
                      "rounded-lg border p-3",
                      d.anomaly.reason === "send spike" ? "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10" : "border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-semibold">Anomaly evidence — {d.anomaly.reason}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.anomaly.detail}</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {d.anomaly.evidence.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    {d.anomaly.reason === "send spike" ? (
                      <div className="mt-2 rounded border bg-background/60 p-2">
                        <SendSparkline points={d.trend30d} label="Send spike chart" />
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {/* Top 5 campaigns */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Top 5 campaigns by volume</h3>
                  {d.campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No campaigns yet.</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {d.campaigns.slice(0, 5).map((c, i) => (
                        <div key={c.name} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{channelMeta[c.channel].label} · {c.sentAt}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">{c.volume.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Quota history */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Quota history</h3>
                  <div className="space-y-2">
                    {d.quotaHistory.map((q, i) => (
                      <div key={`${q.at}-${i}`} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{q.change}</p>
                          <p className="text-[10px] text-muted-foreground">{q.at} · {q.by}</p>
                        </div>
                        <StatusBadge tone={q.state === "pending" ? "warning" : "muted"}>{q.state}</StatusBadge>
                      </div>
                    ))}
                  </div>
                </section>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setQuotaTarget(d)}>
                    <SlidersHorizontal className="mr-1 h-4 w-4" /> Adjust quota
                  </Button>
                  {d.suspended ? (
                    <Button size="sm" variant="outline" onClick={() => resumeSends(d)}>
                      <Sparkles className="mr-1 h-4 w-4" /> Resume marketing sends
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setSuspendTarget(d)}>
                      <Ban className="mr-1 h-4 w-4" /> Temporarily suspend marketing sends
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Suspension blocks marketing categories only (M2.4 policy engine) — payout and
                  security emails keep delivering.
                </p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Adjust quota dialog ───────────────────────────────── */}
      {quotaTarget ? (
        <AdjustQuotaDialog
          key={`quota-${quotaTarget.id}`}
          tenant={quotaTarget}
          onClose={() => setQuotaTarget(null)}
          onSubmit={submitQuota}
        />
      ) : null}

      {/* ── Suspend confirmation ──────────────────────────────── */}
      {suspendTarget ? (
        <SuspendDialog
          key={`suspend-${suspendTarget.id}`}
          tenant={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onConfirm={confirmSuspend}
        />
      ) : null}

      {/* ── Quota policy ──────────────────────────────────────── */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Platform quota policy</DialogTitle>
            <DialogDescription>Rules enforced by the metering engine for every tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ["Soft warning", "Progress bars turn amber at 75% of plan quota with a weekly digest to the tenant admin."],
              ["Danger + forecast", "At 90% the bar is danger-toned and a \"quota forecast breach\" anomaly opens automatically."],
              ["Adjustments", "Per-channel limit changes require a justification and a second operator's approval; they apply on the stated effective date."],
              ["Suspension", "Marketing categories can be suspended temporarily; transactional and payout mail is exempt by policy."],
              ["Anomalies", "Send spikes, complaint-rate breaches and forecast breaches are flagged in this table and deep-link to their evidence."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border px-3 py-2">
                <p className="text-xs font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setPolicyOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
