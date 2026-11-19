"use client";

/**
 * Rate Limits Page — API rate limit configuration (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Per-plan tier rate limit editor (requests/min, burst, concurrent).
 *
 * P0-4: tier edits / Create Tier / Change Policy persist under
 * pfaas:platform-admin:rate-limits. Acceptance test: action → reload →
 * state + audit row + toast agree.
 */

import { useState, useMemo } from "react";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Lock,
  Gauge,
  Activity,
  Clock,
  CheckCircle2,
  Settings2,
  Save,
  Key,
  Zap,
} from "lucide-react";
import { useRateLimitTiers, updateTier, createTier, changeTierPolicy, type RateLimitTier } from "@/lib/platform/rate-limits-store";

const overagePolicyColors: Record<string, string> = {
  throttle: "#705c30",
  bill: "#4a7c59",
  hard_stop: "#b83230",
};

const statusTones: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  deprecated: "warning",
  disabled: "danger",
};

export function RateLimitsPage() {
  const { navigate } = usePlatform();
  const rateLimitTiers = useRateLimitTiers();
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Record<string, number | string>>>({});

  const startEdit = (tierId: string, tier: RateLimitTier) => {
    setEditingTier(tierId);
    setEditValues({
      [tierId]: {
        requestsPerMin: tier.requestsPerMin,
        burstLimit: tier.burstLimit,
        concurrentConns: tier.concurrentConns,
        monthlyQuota: tier.monthlyQuota,
      },
    });
  };

  const cancelEdit = () => {
    setEditingTier(null);
    setEditValues({});
  };

  const saveEdit = (tierId: string) => {
    const values = editValues[tierId];
    const tier = rateLimitTiers.find((t) => t.id === tierId);
    if (!tier || !values) return;
    updateTier({
      ...tier,
      requestsPerMin: Number(values.requestsPerMin ?? tier.requestsPerMin),
      burstLimit: Number(values.burstLimit ?? tier.burstLimit),
      concurrentConns: Number(values.concurrentConns ?? tier.concurrentConns),
      monthlyQuota: Number(values.monthlyQuota ?? tier.monthlyQuota),
    });
    toast({
      title: "Rate limits saved",
      description: `${tier.name}: ${values.requestsPerMin} req/min, ${values.burstLimit} burst, ${values.concurrentConns} concurrent, ${values.monthlyQuota} monthly.`,
    });
    setEditingTier(null);
    setEditValues({});
  };

  const updateValue = (tierId: string, field: string, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [field]: value === "" ? 0 : Number(value),
      },
    }));
  };

  const handleCreateTier = () => {
    const created = createTier({
      name: "Custom Tier",
      description: "Operator-created tier",
      requestsPerMin: 120,
      burstLimit: 30,
      concurrentConns: 10,
      monthlyQuota: 25000,
      overagePolicy: "throttle",
      status: "active",
    });
    toast({ title: "Tier created", description: `${created.name} added (${created.requestsPerMin} req/min).` });
  };

  const handleChangePolicy = (tier: RateLimitTier) => {
    const order: Array<"throttle" | "bill" | "hard_stop"> = ["throttle", "bill", "hard_stop"];
    const idx = order.indexOf(tier.overagePolicy);
    const next = order[(idx + 1) % order.length];
    changeTierPolicy(tier.id, next);
    toast({ title: "Overage policy updated", description: `${tier.name} → ${next.replace("_", " ")}.` });
  };

  const stats = useMemo(() => ({
    total: rateLimitTiers.length,
    active: rateLimitTiers.filter((t) => t.status === "active").length,
    avgReqPerMin: rateLimitTiers.length ? Math.round(rateLimitTiers.reduce((s, t) => s + t.requestsPerMin, 0) / rateLimitTiers.length) : 0,
    avgMonthlyQuota: rateLimitTiers.length ? Math.round(rateLimitTiers.reduce((s, t) => s + t.monthlyQuota, 0) / rateLimitTiers.length) : 0,
  }), [rateLimitTiers]);

  return (
    <Page>
      <PageHeader
        title="API Rate Limits"
        description="Configure per-tier rate limits and quotas."
        icon={Lock}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("api-keys")}>
              <Key className="mr-1 h-4 w-4" /> API Keys
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("api-analytics")}>
              <Activity className="mr-1 h-4 w-4" /> API Analytics
            </Button>
            <Button size="sm" onClick={handleCreateTier}>
              <Zap className="mr-1 h-4 w-4" /> Create Tier
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => undefined}
          hasData={true}
          loadingLabel="Loading rate limit tiers…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Tiers" value={stats.total} icon={Gauge} />
          <MetricCard label="Active Tiers" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Avg Req/Min" value={stats.avgReqPerMin} icon={Activity} />
          <MetricCard label="Avg Monthly Quota" value={stats.avgMonthlyQuota.toLocaleString()} icon={Clock} />
        </div>

        {/* Tier cards */}
        <div className="grid gap-4">
          {rateLimitTiers.map((tier) => (
            <Card key={tier.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{tier.name}</h2>
                    <StatusBadge tone={statusTones[tier.status]}>{tier.status}</StatusBadge>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingTier === tier.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                        <Button size="sm" onClick={() => saveEdit(tier.id)}>
                          <Save className="mr-1 h-3 w-3" /> Save
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(tier.id, tier)}>
                        <Settings2 className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requests/Min</label>
                    {editingTier === tier.id ? (
                      <Input
                        type="number"
                        value={editValues[tier.id]?.requestsPerMin ?? tier.requestsPerMin}
                        onChange={(e) => updateValue(tier.id, "requestsPerMin", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div className="rounded-md bg-muted/50 p-2">
                        <span className="text-lg font-bold">{tier.requestsPerMin.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Burst Limit</label>
                    {editingTier === tier.id ? (
                      <Input
                        type="number"
                        value={editValues[tier.id]?.burstLimit ?? tier.burstLimit}
                        onChange={(e) => updateValue(tier.id, "burstLimit", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div className="rounded-md bg-muted/50 p-2">
                        <span className="text-lg font-bold">{tier.burstLimit.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Concurrent Connections</label>
                    {editingTier === tier.id ? (
                      <Input
                        type="number"
                        value={editValues[tier.id]?.concurrentConns ?? tier.concurrentConns}
                        onChange={(e) => updateValue(tier.id, "concurrentConns", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div className="rounded-md bg-muted/50 p-2">
                        <span className="text-lg font-bold">{tier.concurrentConns}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly Quota</label>
                    {editingTier === tier.id ? (
                      <Input
                        type="number"
                        value={editValues[tier.id]?.monthlyQuota ?? tier.monthlyQuota}
                        onChange={(e) => updateValue(tier.id, "monthlyQuota", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div className="rounded-md bg-muted/50 p-2">
                        <span className="text-lg font-bold">{tier.monthlyQuota.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Overage Policy:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                      style={{ borderColor: overagePolicyColors[tier.overagePolicy], color: overagePolicyColors[tier.overagePolicy] }}
                    >
                      {tier.overagePolicy.replace("_", " ")}
                    </Badge>
                  </div>
                  {editingTier !== tier.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleChangePolicy(tier)}
                    >
                      <Settings2 className="mr-1 h-3 w-3" /> Change Policy
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}