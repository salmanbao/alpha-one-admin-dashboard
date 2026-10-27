"use client";

/**
 * Rate Limits Page — API rate limit configuration (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Per-plan tier rate limit editor (requests/min, burst, concurrent).
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
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
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Save,
  RefreshCw,
  Key,
  Zap,
} from "lucide-react";

const demoRateLimitTiers = [
  { id: "tier-001", name: "Development", description: "Sandbox/testing tier", requestsPerMin: 60, burstLimit: 10, concurrentConns: 5, monthlyQuota: 10000, overagePolicy: "throttle", status: "active" },
  { id: "tier-002", name: "Standard", description: "Default production tier", requestsPerMin: 600, burstLimit: 100, concurrentConns: 25, monthlyQuota: 100000, overagePolicy: "throttle", status: "active" },
  { id: "tier-003", name: "Enterprise", description: "High-volume customers", requestsPerMin: 3000, burstLimit: 500, concurrentConns: 100, monthlyQuota: 1000000, overagePolicy: "bill", status: "active" },
  { id: "tier-004", name: "Premium (Legacy)", description: "Deprecated — new customers use Enterprise", requestsPerMin: 1500, burstLimit: 300, concurrentConns: 50, monthlyQuota: 500000, overagePolicy: "throttle", status: "deprecated" },
];

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
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoRateLimitTiers, { delayMs: 400 }), []);
  const rateLimitTiers = loadedData ?? [];
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Record<string, number | string>>>({});

  const startEdit = (tierId: string, tier: (typeof demoRateLimitTiers)[0]) => {
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
    toast({
      title: "Rate limits saved",
      description: `Tier updated: ${values.requestsPerMin} req/min, ${values.burstLimit} burst, ${values.concurrentConns} concurrent, ${values.monthlyQuota} monthly.`,
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

  const stats = useMemo(() => ({
    total: rateLimitTiers.length,
    active: rateLimitTiers.filter((t) => t.status === "active").length,
    avgReqPerMin: Math.round(rateLimitTiers.reduce((s, t) => s + t.requestsPerMin, 0) / rateLimitTiers.length),
    avgMonthlyQuota: Math.round(rateLimitTiers.reduce((s, t) => s + t.monthlyQuota, 0) / rateLimitTiers.length),
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
            <Button size="sm" onClick={() => toast({ title: "Create tier", description: "New rate limit tier form opened." })}>
              <Zap className="mr-1 h-4 w-4" /> Create Tier
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
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
                      onClick={() => toast({ title: "Edit overage policy", description: `Change overage policy for ${tier.name}.` })}
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
