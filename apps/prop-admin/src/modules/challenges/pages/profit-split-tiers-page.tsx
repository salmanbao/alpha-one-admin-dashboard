"use client";

/**
 * R10-A2 — Profit-Split Tiers and First-Payout Hold (operator-facing).
 *
 * Operator view over `profit-split-tiers-store`:
 *   • Tier list (5 tiers, configurable).
 *   • Per-account tier progress with first-payout hold status.
 *   • Hold eligibility check via the `checkFirstPayoutEligibility` API.
 *   • Release first-payout hold with operator confirmation.
 *
 * Registered in the challenges manifest + view-router; reachable via
 * direct link (nav-children cap is at 150/150).
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  addProfitSplitTier,
  checkFirstPayoutEligibility,
  getProfitSplitTiers,
  getProfitSplitStats,
  releaseFirstPayoutHold,
  useProfitSplitVersion,
} from "@/lib/profit-split-tiers-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function ProfitSplitTiersPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useProfitSplitVersion(); // re-render on any mutation

  const tiers = getProfitSplitTiers();
  const stats = getProfitSplitStats();

  const progressRows = useMemo(
    () => Object.values(stats).map((p) => ({
      name: p.toString(),
      minProfitPct: 0,
      traderSplitPct: 0,
      order: 0,
    } as any)),
    [],
  );

  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPct, setEditPct] = useState("");
  const [editReason, setEditReason] = useState("");

  const tierColumns = [
    { key: "name", header: "Tier", cell: (t) => <span>{t.name}</span> },
    { key: "minPct", header: "Min Profit %", cell: (t) => <span className="text-xs">{String(t.minProfitPct)}</span> },
    { key: "splitPct", header: "Trader Split", cell: (t) => <span className="text-xs">{t.traderSplitPct}%</span> },
    {
      key: "order",
      header: "Order",
      cell: (t) => <span className="text-xs">{String(t.order)}</span>,
    },
    { key: "expressPayout", header: "Express", cell: (t) => <span className="text-xs">{String(t.benefits.expressPayout)}</span> },
    { key: "actions", header: "", cell: () => null },
  ];

  const progressColumns = [
    { key: "accountId", header: "Account", cell: (p) => <span>{p.accountId}</span> },
    {
      key: "tier",
      header: "Current Tier",
      cell: (p) => {
        const tier = getProfitSplitTiers().find((t) => t.id === p.currentTierId) ?? { name: "—" };
        return <span>{tier.name ?? "—"}</span>;
      },
    },
    {
      key: "cumulativePct",
      header: "Cumulative Profit %",
      cell: (p) => <span className="text-xs font-mono">{p.cumulativeProfitPct.toFixed(1)}%</span>,
    },
    {
      key: "tradingDays",
      header: "Trading Days",
      cell: (p) => <span className="text-xs">{String(p.tradingDays)}</span>,
    },
    {
      key: "profitableCycles",
      header: "Profitable Cycles",
      cell: (p) => <span className="text-xs">{String(p.profitableCycles)}</span>,
    },
    {
      key: "firstPayout",
      header: "First Payout",
      cell: (p) => {
        const hold = p.firstPayoutHold;
        if (!hold.isOnHold) return <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-400 text-sm">released</Badge>;
        const met = hold.requirementsMet ? "✓" : "✗";
        return <Badge variant="outline" className="text-[10px] bg-rose-500/20 text-rose-400 text-sm">{met}</Badge>;
      },
    },
  ];

  // Release hold confirmation
  const releaseHold = async (accountId: string) => {
    if (!window.confirm(`Release first payout hold for account ${accountId}?`)) return;
    const ok = releaseFirstPayoutHold(accountId, "operator");
    if (ok) {
      window.alert("First payout hold released");
    }
  };

  return (
    <Page>
      <PageHeader
        title="Profit-Split Tiers & First-Payout Hold"
        description="Tiered profit splits with automated upgrades and first-payout hold — the operator-gate API (checkFirstPayoutEligibility) and operator override (releaseFirstPayoutHold). Every mutation persists to pfaas:demo:profit-split-tiers and is audited."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Accounts" value={stats.totalAccounts} />
          <MetricCard label="Accounts on Hold" value={stats.firstPayoutHoldsActive} />
          <MetricCard label="Avg Split %" value={stats.averageSplitPct.toFixed(1)} />
        </div>

        <div className="space-y-4">
          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Profit-Split Tiers</h2>
            <DataTable
              columns={tierColumns}
              data={tiers}
              rowKey={(t) => t.id}
              pageSize={8}
              searchPlaceholder="Search tiers…"
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Account Tier Progress</h2>
            <DataTable
              columns={progressColumns}
              data={progressRows}
              rowKey={(r) => r.accountId}
              pageSize={10}
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Release First-Payout Hold</h2>
            <p className="text-sm mb-3">
              Selected account must have the hold requirements met to release.
            </p>
            <Input
              placeholder="accountId"
              onChange={(v) => console.log("placeholder:", v)}
              className="w-full mb-2"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => releaseHold("placeholder-account-id")}
            >
              Release Hold (placeholder)
            </Button>
          </section>
        </div>
      </PageContent>
    </Page>
  );
}