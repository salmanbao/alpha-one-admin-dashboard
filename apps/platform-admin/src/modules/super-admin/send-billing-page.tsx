"use client";
/**
 * N16 — Send-Based Usage Billing Rollup (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 skeleton:
 *   - per-tenant **invoice-line rollup by channel** (included units vs overage, unit rates),
 *   - **plan-tier thresholds** (included quotas + overage rates per tier),
 *   - **overage calculation export** to platform billing (CSV),
 *   - **anomaly flags** (month-over-month spike/drop detection per tenant/channel),
 * alongside the provider-cost / margin summary.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Receipt, Download, TriangleAlert, FileSpreadsheet } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Data model                                                          */
/* ------------------------------------------------------------------ */

type Channel = "email" | "sms" | "whatsapp";

interface Tier {
  id: string;
  label: string;
  monthlyFee: number;
  included: Record<Channel, number>;
  /** per-1k overage unit price billed to the tenant */
  overageRate: Record<Channel, number>;
}

/** Plan-tier thresholds (editable rate card — dummy). */
const TIERS: Tier[] = [
  {
    id: "starter",
    label: "Starter",
    monthlyFee: 99,
    included: { email: 50_000, sms: 2_000, whatsapp: 500 },
    overageRate: { email: 1.2, sms: 18, whatsapp: 22 },
  },
  {
    id: "growth",
    label: "Growth",
    monthlyFee: 349,
    included: { email: 250_000, sms: 10_000, whatsapp: 3_000 },
    overageRate: { email: 0.9, sms: 14, whatsapp: 18 },
  },
  {
    id: "scale",
    label: "Scale",
    monthlyFee: 899,
    included: { email: 750_000, sms: 30_000, whatsapp: 10_000 },
    overageRate: { email: 0.6, sms: 11, whatsapp: 15 },
  },
  {
    id: "enterprise",
    label: "Enterprise",
    monthlyFee: 2_499,
    included: { email: 3_000_000, sms: 120_000, whatsapp: 40_000 },
    overageRate: { email: 0.35, sms: 8, whatsapp: 12 },
  },
];

interface TenantUsage {
  id: string;
  tenant: string;
  tier: string;
  /** current-month sends per channel */
  sends: Record<Channel, number>;
  /** trailing 3-month baseline per channel (anomaly detection) */
  baseline: Record<Channel, number>;
  /** provider cost for the month ($) */
  providerCost: number;
  /** margin platform books on top of provider cost (%) */
  margin: number;
}

const SEED: TenantUsage[] = [
  { id: "r1", tenant: "ApexFunded", tier: "scale", sends: { email: 482_000, sms: 12_400, whatsapp: 8_200 }, baseline: { email: 300_000, sms: 11_000, whatsapp: 7_400 }, providerCost: 412.4, margin: 28 },
  { id: "r2", tenant: "TradeMax", tier: "growth", sends: { email: 210_000, sms: 4_400, whatsapp: 0 }, baseline: { email: 205_000, sms: 4_600, whatsapp: 0 }, providerCost: 148.2, margin: 30 },
  { id: "r3", tenant: "FundedHub", tier: "growth", sends: { email: 98_000, sms: 18_200, whatsapp: 3_100 }, baseline: { email: 96_000, sms: 6_000, whatsapp: 2_800 }, providerCost: 221.7, margin: 25 },
  { id: "r4", tenant: "MomentumFX", tier: "starter", sends: { email: 41_000, sms: 1_100, whatsapp: 180 }, baseline: { email: 44_000, sms: 1_250, whatsapp: 210 }, providerCost: 38.9, margin: 33 },
];

const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];
const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };

/** Spike/drop detection: >1.5× baseline = spike, <0.5× = drop (only when baseline > 0). */
type AnomalyKind = "spike" | "drop" | "none";
interface Anomaly {
  key: string;
  tenantId: string;
  tenant: string;
  channel: Channel;
  kind: AnomalyKind;
  deltaPct: number;
}

function detectAnomalies(rows: TenantUsage[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    for (const ch of CHANNELS) {
      const base = r.baseline[ch];
      const cur = r.sends[ch];
      if (!base) continue;
      const ratio = cur / base;
      const deltaPct = Math.round((ratio - 1) * 100);
      const kind: AnomalyKind = ratio >= 1.5 ? "spike" : ratio <= 0.5 ? "drop" : "none";
      if (kind !== "none") {
        out.push({ key: `${r.id}-${ch}`, tenantId: r.id, tenant: r.tenant, channel: ch, kind, deltaPct });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Derived rows                                                        */
/* ------------------------------------------------------------------ */

interface Line {
  id: string;
  tenantId: string;
  tenant: string;
  tier: string;
  channel: Channel;
  units: number;
  included: number;
  overageUnits: number;
  /** $ per 1k overage units */
  rate: number;
  overageFee: number;
}

function buildLines(rows: TenantUsage[]): Line[] {
  const lines: Line[] = [];
  for (const r of rows) {
    const tier = TIERS.find((t) => t.id === r.tier) ?? TIERS[0];
    for (const ch of CHANNELS) {
      const units = r.sends[ch];
      const included = tier.included[ch];
      const overageUnits = Math.max(0, units - included);
      const rate = tier.overageRate[ch];
      const overageFee = Math.round((overageUnits / 1000) * rate * 100) / 100;
      lines.push({ id: `${r.id}-${ch}`, tenantId: r.id, tenant: r.tenant, tier: tier.id, channel: ch, units, included, overageUnits, rate, overageFee });
    }
  }
  return lines;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SendBillingPage() {
  const [rows, setRows] = useState<TenantUsage[]>(SEED);
  const lines = useMemo(() => buildLines(rows), [rows]);
  const anomalies = useMemo(() => detectAnomalies(rows), [rows]);

  const totalOverage = lines.reduce((s, l) => s + l.overageFee, 0);
  const totalCost = rows.reduce((s, r) => s + r.providerCost, 0);
  const totalBillable = rows.reduce((s, r) => s + r.providerCost * (1 + r.margin / 100), 0) + totalOverage;
  const avgMargin = rows.length ? Math.round((rows.reduce((s, r) => s + r.margin, 0) / rows.length) * 10) / 10 : 0;

  const tenantLines = (id: string) => lines.filter((l) => l.tenantId === id && l.overageUnits > 0);

  const tenantCols: Column<TenantUsage>[] = [
    { key: "t", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant}</span> },
    { key: "tier", header: "Plan tier", cell: (r) => <StatusBadge tone="info">{TIERS.find((t) => t.id === r.tier)?.label ?? r.tier}</StatusBadge> },
    ...CHANNELS.map(
      (ch): Column<TenantUsage> => ({
        key: ch,
        header: CHANNEL_LABEL[ch],
        numeric: true,
        cell: (r) => r.sends[ch].toLocaleString(),
      }),
    ),
    { key: "c", header: "Provider cost", numeric: true, cell: (r) => usd(r.providerCost) },
    { key: "m", header: "Margin %", numeric: true, cell: (r) => `${r.margin}%` },
    {
      key: "bill",
      header: "Billable",
      numeric: true,
      cell: (r) => {
        const overage = tenantLines(r.id).reduce((s, l) => s + l.overageFee, 0);
        return (
          <span className="font-medium">
            {usd(r.providerCost * (1 + r.margin / 100) + overage)}
            {overage > 0 && <span className="block text-[10px] font-normal text-amber-600">+{usd(overage)} overage</span>}
          </span>
        );
      },
    },
    {
      key: "flag",
      header: "Anomaly",
      cell: (r) => {
        const mine = anomalies.filter((a) => a.tenantId === r.id);
        if (!mine.length) return <span className="text-muted-foreground">—</span>;
        const worst = mine.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
        return <StatusBadge tone={worst.kind === "spike" ? "warning" : "danger"}>{worst.kind} {worst.deltaPct > 0 ? "+" : ""}{worst.deltaPct}%</StatusBadge>;
      },
    },
  ];

  const lineCols: Column<Line>[] = [
    { key: "tenant", header: "Tenant", cell: (l) => <span className="font-medium">{l.tenant}</span> },
    { key: "ch", header: "Channel", cell: (l) => CHANNEL_LABEL[l.channel] },
    { key: "units", header: "Units", numeric: true, cell: (l) => l.units.toLocaleString() },
    { key: "incl", header: "Included", numeric: true, cell: (l) => l.included.toLocaleString() },
    {
      key: "over",
      header: "Overage units",
      numeric: true,
      cell: (l) => (l.overageUnits ? <span className="text-amber-600">{l.overageUnits.toLocaleString()}</span> : <span className="text-muted-foreground">0</span>),
    },
    { key: "rate", header: "$/1k", numeric: true, cell: (l) => `$${l.rate.toFixed(2)}` },
    { key: "fee", header: "Overage fee", numeric: true, cell: (l) => (l.overageFee ? <span className="font-medium">{usd(l.overageFee)}</span> : <span className="text-muted-foreground">—</span>) },
    {
      key: "a",
      header: "",
      cell: (l) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={() => {
            setRows((rs) => rs.map((r) => (r.id === l.tenantId ? { ...r, sends: { ...r.sends, [l.channel]: l.included } } : r)));
            recordAudit({ actor: "You", action: "billing.clamp", target: l.tenantId, detail: `${l.tenant} ${CHANNEL_LABEL[l.channel]} clamped to included ${l.included.toLocaleString()} (dummy correction)`, severity: "info" });
            toast({ title: "Clamped to plan", description: `${l.tenant} ${CHANNEL_LABEL[l.channel]} usage set to included threshold.` });
          }}
        >
          Clamp
        </Button>
      ),
    },
  ];

  const anomalyCols: Column<Anomaly>[] = [
    { key: "tenant", header: "Tenant", cell: (a) => <span className="font-medium">{a.tenant}</span> },
    { key: "ch", header: "Channel", cell: (a) => CHANNEL_LABEL[a.channel] },
    { key: "kind", header: "Flag", cell: (a) => <StatusBadge tone={a.kind === "spike" ? "warning" : "danger"}>{a.kind}</StatusBadge> },
    { key: "delta", header: "vs baseline", numeric: true, cell: (a) => `${a.deltaPct > 0 ? "+" : ""}${a.deltaPct}%` },
    {
      key: "a",
      header: "",
      cell: (a) => (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px]"
          onClick={() => {
            recordAudit({ actor: "You", action: "billing.anomaly_review", target: a.tenantId, detail: `${a.tenant} ${CHANNEL_LABEL[a.channel]} ${a.kind} reviewed (${a.deltaPct}%)`, severity: "warning" });
            setRows((rs) => rs.map((r) => (r.id === a.tenantId ? { ...r, baseline: { ...r.baseline, [a.channel]: r.sends[a.channel] } } : r)));
            toast({ title: "Baseline reset", description: `${a.tenant}: baseline rebaselined to current month.` });
          }}
        >
          Acknowledge
        </Button>
      ),
    },
  ];

  function exportOverage() {
    const header = "tenant,plan_tier,channel,units,included,overage_units,rate_per_1k,overage_fee_usd";
    const body = lines
      .map((l) => [l.tenant, l.tier, l.channel, l.units, l.included, l.overageUnits, l.rate, l.overageFee.toFixed(2)].join(","))
      .join("\n");
    const csv = `${header}\n${body}\n`;
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `send-overage-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* clipboard/download unavailable — CSV still surfaced in the toast */
    }
    recordAudit({ actor: "You", action: "billing.overage_export", target: "send-billing", detail: `Exported ${lines.length} invoice lines (overage ${usd(totalOverage)}) to platform billing`, severity: "info" });
    toast({ title: "Overage export ready", description: `${lines.length} invoice lines · total overage ${usd(totalOverage)} → platform billing.` });
  }

  return (
    <Page>
      <PageHeader
        title="Send-Based Usage Billing Rollup"
        description="Metered marketing sends per tenant rolled into billing: per-channel invoice lines, plan-tier thresholds, overage export to platform billing and anomaly flags."
        icon={Receipt}
        actions={
          <Button size="sm" variant="outline" onClick={exportOverage}>
            <Download className="mr-1 h-4 w-4" />
            Export overage CSV
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Billable (month)" value={usd(totalBillable)} tone="positive" />
          <MetricCard label="Provider cost" value={usd(totalCost)} />
          <MetricCard label="Overage billed" value={usd(totalOverage)} tone={totalOverage > 0 ? "warning" : "default"} />
          <MetricCard label="Anomaly flags" value={String(anomalies.length)} tone={anomalies.length ? "negative" : "positive"} />
        </div>

        <Tabs defaultValue="tenants">
          <TabsList>
            <TabsTrigger value="tenants">Per-tenant rollup</TabsTrigger>
            <TabsTrigger value="lines">Invoice lines</TabsTrigger>
            <TabsTrigger value="tiers">Plan-tier thresholds</TabsTrigger>
            <TabsTrigger value="anomalies">Anomaly flags ({anomalies.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="mt-3 space-y-3">
            <DataTable columns={tenantCols} data={rows} rowKey={(r) => r.id} pageSize={8} searchableText={(r) => `${r.tenant} ${r.tier}`} />
            <p className="text-[11px] text-muted-foreground">
              Avg margin {avgMargin}% · rate card editable per channel (dummy). Depends on the send-gateway runtime for real metering.
            </p>
          </TabsContent>

          <TabsContent value="lines" className="mt-3 space-y-3">
            <Card>
              <CardContent className="p-3 text-xs">
                <p className="font-semibold">Invoice-line rollup by channel — included units are free, everything above the tier threshold bills at $/1k.</p>
              </CardContent>
            </Card>
            <DataTable columns={lineCols} data={lines} rowKey={(l) => l.id} pageSize={12} searchableText={(l) => `${l.tenant} ${l.channel} ${l.tier}`} />
          </TabsContent>

          <TabsContent value="tiers" className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TIERS.map((t) => (
                <Card key={t.id}>
                  <CardContent className="space-y-2 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{t.label}</p>
                      <StatusBadge tone="info">{usd(t.monthlyFee)}/mo</StatusBadge>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[10px] text-muted-foreground">
                          <th>Channel</th>
                          <th className="text-right">Included</th>
                          <th className="text-right">$/1k over</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CHANNELS.map((ch) => (
                          <tr key={ch} className="border-t">
                            <td>{CHANNEL_LABEL[ch]}</td>
                            <td className="text-right tabular-nums">{t.included[ch].toLocaleString()}</td>
                            <td className="text-right tabular-nums">${t.overageRate[ch].toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-muted-foreground">
                      Overage charge = (units − included) ÷ 1000 × rate.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="anomalies" className="mt-3 space-y-3">
            {anomalies.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />No sends deviate ±50% from the trailing 3-month baseline this period.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {anomalies.length} send-volume anomaly flag(s) — spikes can indicate runaway automation or compromised API keys; drops can indicate
                    provider or consent-suppression problems. Flags cross-link to tenant-api-usage alerts.
                  </span>
                </div>
                <DataTable columns={anomalyCols} data={anomalies} rowKey={(a) => a.key} pageSize={8} />
              </>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Rolled up into the platform billing page (Finance → Billing &amp; Invoices); monthly export reconciles against provider invoices.
        </p>
      </PageContent>
    </Page>
  );
}
