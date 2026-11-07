"use client";

/**
 * Provider Pool & Subaccounts (M7 §11.3) — shared ESP/SMS/WhatsApp business
 * account operations.
 *
 * Operators running a shared SendGrid, Twilio or WhatsApp business account
 * need subaccount isolation: per-tenant quotas, IP pool assignment and
 * reputation quarantine, so one spammy tenant cannot burn deliverability
 * for everybody. IP changes are deferred to batch boundaries and
 * quarantine re-routes only the affected tenant's traffic.
 */

import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Network,
  Plus,
  Settings2,
  Mail,
  MessageSquare,
  MessagesSquare,
  ShieldAlert,
  ArrowRightLeft,
  AlertTriangle,
  Activity,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + seed data                                                   */
/* ------------------------------------------------------------------ */

type ProviderKind = "Email" | "SMS" | "WhatsApp";
type QuarantineReason = "complaint rate" | "spam traps" | "abuse report";

interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  masterStatus: "connected" | "degraded";
  quotaUsed: number;
  quotaTotal: number;
  health: number;
}

interface Allocation {
  id: string;
  tenant: string;
  plan: string;
  providerId: string;
  subaccount: string;
  quotaUsed: number;
  quotaAssigned: number;
  ipPool: string;
  reputation: number;
  costCenter: string;
  status: "active" | "quarantined";
  quarantineReason?: QuarantineReason;
}

const kindMeta: Record<ProviderKind, { icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  Email: { icon: Mail, badge: "SMTP" },
  SMS: { icon: MessageSquare, badge: "SMS" },
  WhatsApp: { icon: MessagesSquare, badge: "Cloud API" },
};

const quarantineReasons: QuarantineReason[] = ["complaint rate", "spam traps", "abuse report"];

const ipPools = ["shared-us-east", "shared-eu-west", "warmup-pool-2", "isolated-quarantine"];

const seedProviders: Provider[] = [
  { id: "prv-sendgrid", name: "SendGrid — shared business", kind: "Email", masterStatus: "connected", quotaUsed: 640_000, quotaTotal: 900_000, health: 94 },
  { id: "prv-twilio", name: "Twilio — shared account", kind: "SMS", masterStatus: "connected", quotaUsed: 62_000, quotaTotal: 150_000, health: 88 },
  { id: "prv-wa", name: "WhatsApp Cloud API — BSP", kind: "WhatsApp", masterStatus: "degraded", quotaUsed: 34_000, quotaTotal: 60_000, health: 71 },
];

const seedAllocations: Allocation[] = [
  { id: "al-1", tenant: "Alpha Capital", plan: "Enterprise", providerId: "prv-sendgrid", subaccount: "sg-alpha-prod", quotaUsed: 412_500, quotaAssigned: 450_000, ipPool: "shared-us-east", reputation: 96, costCenter: "MKT-ALPHA-01", status: "active" },
  { id: "al-2", tenant: "Beta Trading", plan: "Scale", providerId: "prv-sendgrid", subaccount: "sg-beta-prod", quotaUsed: 96_400, quotaAssigned: 100_000, ipPool: "shared-us-east", reputation: 41, costCenter: "MKT-BETA-02", status: "active" },
  { id: "al-3", tenant: "Gamma Futures", plan: "Growth", providerId: "prv-sendgrid", subaccount: "sg-gamma-prod", quotaUsed: 51_800, quotaAssigned: 120_000, ipPool: "shared-eu-west", reputation: 74, costCenter: "MKT-GAMMA-01", status: "active" },
  { id: "al-4", tenant: "Beta Trading", plan: "Scale", providerId: "prv-twilio", subaccount: "tw-beta", quotaUsed: 25_000, quotaAssigned: 40_000, ipPool: "shared-us-east", reputation: 82, costCenter: "MKT-BETA-02", status: "active" },
  { id: "al-5", tenant: "Delta Prop", plan: "Starter", providerId: "prv-twilio", subaccount: "tw-delta", quotaUsed: 4_200, quotaAssigned: 25_000, ipPool: "warmup-pool-2", reputation: 91, costCenter: "MKT-DELTA-01", status: "active" },
  { id: "al-6", tenant: "Epsilon Markets", plan: "Growth", providerId: "prv-wa", subaccount: "wa-epsilon", quotaUsed: 18_000, quotaAssigned: 20_000, ipPool: "shared-eu-west", reputation: 68, costCenter: "MKT-EPS-01", status: "active" },
  { id: "al-7", tenant: "Gamma Futures", plan: "Growth", providerId: "prv-wa", subaccount: "wa-gamma", quotaUsed: 16_000, quotaAssigned: 40_000, ipPool: "shared-eu-west", reputation: 77, costCenter: "MKT-GAMMA-01", status: "active" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const repTone = (score: number) => (score < 40 ? "#e11d48" : score < 70 ? "#d97706" : "#059669");
const repLabel = (score: number) => (score < 40 ? "Poor" : score < 70 ? "Fair" : "Good");

function QuotaRing({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const color = pct >= 90 ? "#e11d48" : pct >= 75 ? "#d97706" : "#059669";
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0" role="img" aria-label={label}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700 }} fill="#0a0a0a">
        {pct}%
      </text>
    </svg>
  );
}

function ReputationGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 16;
  const arcLength = Math.PI * r;
  const color = repTone(clamped);
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 40 24" className="h-6 w-10 shrink-0" role="img" aria-label={`Reputation ${clamped} ${repLabel(clamped)}`}>
        <path d="M4 20 A 16 16 0 0 1 36 20" fill="none" stroke="#e5e7eb" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M4 20 A 16 16 0 0 1 36 20"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - clamped / 100)}
        />
      </svg>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{clamped}</span>
      <span className="text-[10px] text-muted-foreground">{repLabel(clamped)}</span>
    </div>
  );
}

function QuotaBar({ used, assigned }: { used: number; assigned: number }) {
  const pct = assigned > 0 ? Math.min(100, Math.round((used / assigned) * 100)) : 0;
  const tone = pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn("font-semibold tabular-nums", pct >= 90 ? "text-rose-600" : "text-foreground")}>{pct}%</span>
        <span className="tabular-nums text-muted-foreground">{used.toLocaleString()} / {assigned.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Subaccount quota consumed">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quarantine drawer                                                   */
/* ------------------------------------------------------------------ */

function QuarantineDrawer({
  allocation,
  provider,
  onClose,
  onConfirm,
}: {
  allocation: Allocation;
  provider: Provider | undefined;
  onClose: () => void;
  onConfirm: (reason: QuarantineReason) => void;
}) {
  const [reason, setReason] = useState<QuarantineReason | "">("");
  const [typed, setTyped] = useState("");
  const phrase = allocation.tenant;
  const ok = typed.trim() === phrase && reason !== "";
  const isoSubaccount = `iso-${allocation.subaccount}`;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Quarantine {allocation.tenant}
          </SheetTitle>
          <SheetDescription>
            Re-routes only this tenant&apos;s traffic on {provider?.name ?? "the shared provider"} —
            every other tenant keeps its pool, IP and reputation.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4 pt-0">
          {/* Reason select */}
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as QuarantineReason)}>
              <SelectTrigger className="mt-1 w-full" aria-label="Quarantine reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {quarantineReasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "complaint rate" ? "Complaint rate" : r === "spam traps" ? "Spam traps" : "Abuse report"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Isolated destination preview */}
          <section className="rounded-lg border border-amber-500/30 bg-amber-50/30 p-3 dark:bg-amber-950/10">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Activity className="h-3.5 w-3.5" /> Isolated destination preview
            </h3>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Isolated subaccount</span>
                <code className="rounded bg-background px-2 py-0.5 text-xs font-semibold">{isoSubaccount}</code>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Isolated IP pool</span>
                <code className="rounded bg-background px-2 py-0.5 text-xs font-semibold">quarantine-pool-1 · 198.51.100.77</code>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Current assignment</span>
                <code className="rounded bg-background px-2 py-0.5 text-xs">{allocation.subaccount} · {allocation.ipPool}</code>
              </div>
            </div>
          </section>

          {/* Notification plan */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">Notification plan</h3>
            <p className="text-xs text-muted-foreground">
              The tenant is informed: a banner is pinned on their channel dashboard (M2.1, scoped to
              their tenant), their admin receives an email naming the reason and the reversal path,
              and the action is written to the platform audit log. Other tenants are not notified —
              their deliverability is unaffected.
            </p>
          </section>

          {/* Reversal path */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">Reversal path</h3>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Operator files an incident with the offending evidence (complaint samples, spam-trap hits).</li>
              <li>Tenant remediates: suppression list sync + campaign pause confirmed.</li>
              <li>After 7 clean days on the isolated pool, an operator releases the tenant back to the shared pool — 2-operator approval in the Approval Center.</li>
            </ol>
          </section>

          <Separator />

          {/* Typed confirmation */}
          <div>
            <Label className="text-xs" htmlFor="quarantine-confirm">
              Type <span className="font-mono font-semibold">{phrase}</span> to confirm
            </Label>
            <Input
              id="quarantine-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={phrase}
              className="mt-1 font-mono"
              autoComplete="off"
            />
            {reason === "" ? (
              <p className="mt-1 text-xs text-muted-foreground">Select a reason to continue.</p>
            ) : null}
          </div>

          <Button variant="destructive" className="w-full" disabled={!ok} onClick={() => reason && onConfirm(reason)}>
            <ShieldAlert className="mr-1 h-4 w-4" /> Confirm quarantine
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ProviderPoolPage() {
  const {
    data: loaded,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ providers: seedProviders, allocations: seedAllocations }), { delayMs: 450 }), []);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [quarantineId, setQuarantineId] = useState<string | null>(null);
  const [reallocId, setReallocId] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) {
      setProviders(loaded.providers);
      setAllocations(loaded.allocations);
    }
  }, [loaded]);

  const providerById = (id: string) => providers.find((p) => p.id === id);
  const quarantineTarget = allocations.find((a) => a.id === quarantineId) ?? null;
  const reallocTarget = allocations.find((a) => a.id === reallocId) ?? null;

  const subaccountCount = (providerId: string) => allocations.filter((a) => a.providerId === providerId).length;

  const changeIpPool = (alloc: Allocation, pool: string) => {
    if (pool === alloc.ipPool) return;
    setAllocations((prev) => prev.map((a) => (a.id === alloc.id ? { ...a, ipPool: pool } : a)));
    toast({
      title: "IP pool change scheduled",
      description: `${alloc.tenant} → ${pool} applies at the next send batch — no partial-campaign split.`,
    });
  };

  const confirmQuarantine = (reason: QuarantineReason) => {
    const target = quarantineTarget;
    if (!target) return;
    setAllocations((prev) =>
      prev.map((a) => (a.id === target.id ? { ...a, status: "quarantined", quarantineReason: reason, ipPool: "isolated-quarantine" } : a)),
    );
    setQuarantineId(null);
    toast({
      title: `${target.tenant} quarantined`,
      description: `Reason: ${reason}. Traffic re-routed to iso-${target.subaccount} on quarantine-pool-1; banner pinned on their channel dashboard. Other tenants' reputation gauges are unchanged.`,
    });
  };

  const submitReallocate = (targetProviderId: string, subaccountLabel: string) => {
    const target = reallocTarget;
    if (!target) return;
    const destination = providerById(targetProviderId);
    if (!destination) return;

    const usedOnDestination = allocations
      .filter((a) => a.providerId === destination.id && a.id !== target.id)
      .reduce((s, a) => s + a.quotaUsed, 0);
    const free = destination.quotaTotal - usedOnDestination;

    if (free < target.quotaUsed) {
      // Failure path: roll back (nothing changed) + incident entry.
      setReallocId(null);
      toast({
        title: "Reallocation failed — rolled back",
        description: `${destination.name} has ${free.toLocaleString()} free capacity; ${target.quotaUsed.toLocaleString()} required. No change applied. Incident INC-2041 opened against the provider pool.`,
        variant: "destructive",
      });
      return;
    }

    const newLabel = subaccountLabel.trim() || `${destination.id.slice(4)}-${target.tenant.toLowerCase().split(" ")[0]}`;
    setAllocations((prev) =>
      prev.map((a) => (a.id === target.id ? { ...a, providerId: destination.id, subaccount: newLabel, status: "active", quarantineReason: undefined } : a)),
    );
    setReallocId(null);
    toast({
      title: "Tenant reallocated",
      description: `${target.tenant} now sends from ${destination.name} / ${newLabel}. Takes effect at the next batch boundary.`,
    });
  };

  const addProvider = (name: string, kind: ProviderKind) => {
    const id = `prv-${Date.now()}`;
    setProviders((prev) => [...prev, { id, name, kind, masterStatus: "connected", quotaUsed: 0, quotaTotal: 100_000, health: 100 }]);
    setAddOpen(false);
    toast({ title: "Shared provider connected", description: `${name} (${kind}) added at the platform level — subaccounts can now be allocated to tenants.` });
  };

  const columns: Column<Allocation>[] = [
    {
      key: "tenant",
      header: "Tenant",
      sortValue: (a) => a.tenant,
      cell: (a) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{a.tenant}</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[9px]">{a.plan}</Badge>
            {a.status === "quarantined" ? (
              <StatusBadge tone="danger">Quarantined{a.quarantineReason ? ` · ${a.quarantineReason}` : ""}</StatusBadge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      sortValue: (a) => providerById(a.providerId)?.name ?? "",
      cell: (a) => {
        const provider = providerById(a.providerId);
        const Icon = provider ? kindMeta[provider.kind].icon : Network;
        return (
          <span className="flex items-center gap-1.5 text-xs">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            {provider?.name ?? "Unknown provider"}
          </span>
        );
      },
    },
    {
      key: "subaccount",
      header: "Subaccount label",
      cell: (a) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{a.subaccount}</code>,
    },
    {
      key: "quota",
      header: "Quota used / assigned",
      sortValue: (a) => (a.quotaAssigned > 0 ? a.quotaUsed / a.quotaAssigned : 0),
      cell: (a) => <QuotaBar used={a.quotaUsed} assigned={a.quotaAssigned} />,
    },
    {
      key: "ipPool",
      header: "IP pool",
      sortValue: (a) => a.ipPool,
      cell: (a) => (
        <Select value={a.ipPool} onValueChange={(v) => changeIpPool(a, v)}>
          <SelectTrigger className="h-7 w-[140px] text-xs" aria-label={`IP pool for ${a.tenant}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ipPools.map((p) => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "reputation",
      header: "Reputation",
      sortValue: (a) => a.reputation,
      cell: (a) => <ReputationGauge score={a.reputation} />,
    },
    {
      key: "costCenter",
      header: "Cost center",
      sortValue: (a) => a.costCenter,
      cell: (a) => <Badge variant="outline" className="text-[9px]">{a.costCenter}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" aria-label={`Reallocate ${a.tenant}`} onClick={() => setReallocId(a.id)}>
            <ArrowRightLeft className="h-3 w-3" /> Reallocate
          </Button>
          {a.status === "quarantined" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              aria-label={`Release ${a.tenant} from quarantine`}
              onClick={() => {
                setAllocations((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "active", quarantineReason: undefined, ipPool: "shared-us-east" } : x)));
                toast({ title: "Released from quarantine", description: `${a.tenant} returned to the shared pool after 7 clean days. Approval item routed to the Approval Center.` });
              }}
            >
              <CheckCircle2 className="h-3 w-3" /> Release
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" aria-label={`Quarantine ${a.tenant}`} onClick={() => setQuarantineId(a.id)}>
              <ShieldAlert className="h-3 w-3" /> Quarantine
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Provider Pool"
        description="Shared ESP, SMS and WhatsApp business accounts: master status, quota rings, per-tenant subaccounts, IP pools and reputation quarantine."
        icon={Network}
        actions={
          <>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add shared provider
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCapacityOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" /> Capacity settings
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loaded !== undefined}
          loadingLabel="Loading provider pool…"
        >
          {providers.length === 0 ? (
            <EmptyState
              icon={Network}
              title="No shared providers"
              description="Connect a shared SendGrid, Twilio or WhatsApp business account to isolate tenants into subaccounts with per-tenant quotas, IP pools and reputation quarantine."
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add shared provider
                </Button>
              }
            />
          ) : (
            <>
              {/* Provider cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {providers.map((p) => {
                  const Icon = kindMeta[p.kind].icon;
                  const pct = p.quotaTotal > 0 ? Math.round((p.quotaUsed / p.quotaTotal) * 100) : 0;
                  return (
                    <Card key={p.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-md border bg-muted p-1.5">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold leading-tight">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{kindMeta[p.kind].badge} · {p.kind}</p>
                            </div>
                          </div>
                          <StatusBadge tone={p.masterStatus === "connected" ? "success" : "warning"}>
                            master {p.masterStatus}
                          </StatusBadge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <QuotaRing used={p.quotaUsed} total={p.quotaTotal} label={`${p.name} quota ${pct}% consumed`} />
                          <div className="min-w-0 flex-1 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Subaccounts</span>
                              <span className="font-semibold tabular-nums">{subaccountCount(p.id)} active</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Quota</span>
                              <span className="font-semibold tabular-nums">{p.quotaUsed.toLocaleString()} / {p.quotaTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Aggregate health</span>
                              <span
                                className="font-semibold tabular-nums"
                                style={{ color: repTone(p.health) }}
                              >
                                {p.health}% {repLabel(p.health)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Allocations table */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Tenant allocations</h2>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" /> IP changes apply at batch boundaries
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={columns}
                    data={allocations}
                    rowKey={(a) => a.id}
                    loading={loading}
                    searchableText={(a) => `${a.tenant} ${a.subaccount} ${a.ipPool} ${a.costCenter} ${a.status}`}
                    searchPlaceholder="Search allocations…"
                    pageSize={8}
                    emptyTitle="No tenant allocations"
                    emptyDescription="Allocations appear once tenants are assigned to a shared provider subaccount."
                  />
                </CardContent>
              </Card>
            </>
          )}
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Quarantine drawer ─────────────────────────────────── */}
      {quarantineTarget ? (
        <QuarantineDrawer
          key={`q-${quarantineTarget.id}`}
          allocation={quarantineTarget}
          provider={providerById(quarantineTarget.providerId)}
          onClose={() => setQuarantineId(null)}
          onConfirm={confirmQuarantine}
        />
      ) : null}

      {/* ── Reallocate dialog ─────────────────────────────────── */}
      {reallocTarget ? (
        <ReallocateDialog
          key={`r-${reallocTarget.id}`}
          allocation={reallocTarget}
          providers={providers}
          allocations={allocations}
          onClose={() => setReallocId(null)}
          onConfirm={submitReallocate}
        />
      ) : null}

      {/* ── Add shared provider ───────────────────────────────── */}
      <AddProviderDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={addProvider} />

      {/* ── Capacity settings ─────────────────────────────────── */}
      <CapacityDialog open={capacityOpen} onClose={() => setCapacityOpen(false)} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Reallocate dialog — failure path rolls back + incident entry        */
/* ------------------------------------------------------------------ */

function ReallocateDialog({
  allocation,
  providers,
  allocations,
  onClose,
  onConfirm,
}: {
  allocation: Allocation;
  providers: Provider[];
  allocations: Allocation[];
  onClose: () => void;
  onConfirm: (providerId: string, subaccount: string) => void;
}) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const destination = providers.find((p) => p.id === providerId);
  const usedOnDestination = allocations
    .filter((a) => a.providerId === providerId && a.id !== allocation.id)
    .reduce((s, a) => s + a.quotaUsed, 0);
  const free = destination ? destination.quotaTotal - usedOnDestination : 0;
  const capacityOk = free >= allocation.quotaUsed;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Reallocate {allocation.tenant}</DialogTitle>
          <DialogDescription>
            Move this tenant&apos;s subaccount to another shared provider. The change takes effect at
            the next batch boundary so campaigns are never split mid-send.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Target provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs" htmlFor="realloc-label">Subaccount label</Label>
            <Input
              id="realloc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`${allocation.providerId.slice(4)}-${allocation.tenant.toLowerCase().split(" ")[0]}`}
              className="mt-1 font-mono text-xs"
            />
          </div>

          <div className={cn("rounded-md border px-3 py-2 text-xs", capacityOk ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20")}>
            <p className="font-medium">
              Free capacity on {destination?.name}: {free.toLocaleString()}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Required for {allocation.tenant}: {allocation.quotaUsed.toLocaleString()}.
              {!capacityOk ? " Exceeds free capacity — this reallocation will be rejected and rolled back." : ""}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(providerId, label)}>{capacityOk ? "Reallocate" : "Attempt reallocation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Add shared provider + capacity settings                             */
/* ------------------------------------------------------------------ */

function AddProviderDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, kind: ProviderKind) => void;
}) {
  const [kind, setKind] = useState<ProviderKind>("Email");
  const [label, setLabel] = useState("");
  const [showError, setShowError] = useState(false);
  const ok = label.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setLabel(""); setShowError(false); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add shared provider</DialogTitle>
          <DialogDescription>
            Opens the M1-style connection flow at the platform level: authenticate the master
            account, then allocate isolated subaccounts per tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Provider type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ProviderKind)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Provider type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email (SendGrid / Amazon SES)</SelectItem>
                <SelectItem value="SMS">SMS (Twilio)</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp (Cloud API)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="provider-name">Master account label</Label>
            <Input
              id="provider-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. SendGrid — shared business (EU)"
              className="mt-1"
            />
            {showError && !ok ? <p className="mt-1 text-xs text-destructive">Give the account a label (at least 3 characters).</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setShowError(true); if (ok) onAdd(label.trim(), kind); }}>Connect provider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapacityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dailyCap, setDailyCap] = useState("2500000");
  const [warmupDays, setWarmupDays] = useState("14");
  const [maxSubs, setMaxSubs] = useState("50");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Capacity settings</DialogTitle>
          <DialogDescription>Pool-wide guardrails applied to every shared provider.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs" htmlFor="cap-daily">Global daily send cap</Label>
            <Input id="cap-daily" type="number" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} className="mt-1 tabular-nums" />
          </div>
          <div>
            <Label className="text-xs" htmlFor="cap-warmup">New subaccount warmup (days)</Label>
            <Input id="cap-warmup" type="number" value={warmupDays} onChange={(e) => setWarmupDays(e.target.value)} className="mt-1 tabular-nums" />
          </div>
          <div>
            <Label className="text-xs" htmlFor="cap-subs">Max subaccounts per provider</Label>
            <Input id="cap-subs" type="number" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value)} className="mt-1 tabular-nums" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onClose(); toast({ title: "Capacity settings saved", description: `Daily cap ${Number(dailyCap).toLocaleString()} · warmup ${warmupDays}d · max ${maxSubs} subaccounts per provider.` }); }}>
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
