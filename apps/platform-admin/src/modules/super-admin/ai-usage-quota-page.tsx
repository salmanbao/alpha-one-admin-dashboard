"use client";

import { useState } from "react";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, Activity, Gauge, DollarSign, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useAiQuotas,
  applyQuotaOverride,
  resetCounters,
  type TenantQuota,
} from "@/lib/platform/ai-quota-store";

export function AiUsageQuotaPage() {
  const quotas = useAiQuotas();
  const [tenantFilter, setTenantFilter] = useState("all");
  const [overrideTenant, setOverrideTenant] = useState("");
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideQuota, setOverrideQuota] = useState("");
  const [overrideRateLimit, setOverrideRateLimit] = useState("");

  const tenants = Array.from(new Set(quotas.map((q) => q.tenant)));
  const filtered = quotas.filter((q) => tenantFilter === "all" || q.tenant === tenantFilter);

  const totalUsed = quotas.reduce((s, q) => s + q.used, 0);
  const totalQuota = quotas.reduce((s, q) => s + q.monthlyQuota, 0);
  const totalSpend = quotas.reduce((s, q) => s + q.spend, 0);
  const exceeded = quotas.filter((q) => q.status === "exceeded").length;
  const warnings = quotas.filter((q) => q.status === "warning").length;

  const handleResetCounters = () => {
    const result = resetCounters();
    toast({ title: result.title, description: result.description });
  };

  const handleApplyOverride = () => {
    const quotaNum = Number(overrideQuota);
    const rateNum = Number(overrideRateLimit);
    const result = applyQuotaOverride(
      overrideTenant,
      overrideModel,
      Number.isFinite(quotaNum) && quotaNum > 0 ? quotaNum : undefined,
      Number.isFinite(rateNum) && rateNum > 0 ? rateNum : undefined,
    );
    toast({ title: result.title, description: result.description });
    setOverrideTenant("");
    setOverrideModel("");
    setOverrideQuota("");
    setOverrideRateLimit("");
  };

  return (
    <Page>
      <PageHeader
        title="AI Usage Quota"
        description="Monthly inference quotas, rate limits, and spend tracking across AI models and tenants."
        icon={Gauge}
        actions={<Button size="sm" variant="outline" onClick={handleResetCounters}><DollarSign className="mr-1 h-4 w-4" /> Reset Counters</Button>}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => undefined}
          hasData={true}
          loadingLabel="Loading AI usage…"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Total Used" value={totalUsed > 999 ? `${(totalUsed / 1000).toFixed(0)}k` : totalUsed} icon={Activity} />
            <MetricCard label="Total Quota" value={totalQuota > 999 ? `${(totalQuota / 1000).toFixed(0)}k` : totalQuota} icon={BarChart3} />
            <MetricCard label="Total Spend" value={formatCurrencyValue(totalSpend, "USD")} icon={DollarSign} tone="positive" />
            <MetricCard label="Exceeded" value={exceeded} icon={AlertTriangle} tone="negative" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Usage gauges */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Usage Overview</span></CardHeader>
              <CardContent className="space-y-3">
                {quotas.map((q) => {
                  const pct = Math.round((q.used / q.monthlyQuota) * 100);
                  return (
                    <div key={`${q.tenant}-${q.model}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{q.tenant}</span>
                        <span className="text-muted-foreground">{q.used.toLocaleString()} / {q.monthlyQuota.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex-1 rounded-full bg-muted overflow-hidden",
                          q.status === "exceeded" ? "bg-rose-500/20" : q.status === "warning" ? "bg-amber-500/20" : "",
                        )}>
                          <div className={cn(
                            "h-full rounded-full transition-all",
                            q.status === "exceeded" ? "bg-rose-500" : q.status === "warning" ? "bg-amber-500" : "bg-primary",
                          )} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <Badge variant="outline" className="text-[9px] w-12">{pct}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Rate limits */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Rate Limits & Reset</span></CardHeader>
              <CardContent className="space-y-2">
                {filtered.map((q) => (
                  <div key={`${q.tenant}-${q.model}`} className="flex items-center justify-between rounded-md border p-2.5 text-xs">
                    <div>
                      <span className="font-medium">{q.tenant}</span>
                      <p className="text-muted-foreground">{q.model}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{q.rateLimit} req/min</span>
                      <Badge variant={q.status === "exceeded" ? "destructive" : q.status === "warning" ? "outline" : "secondary"} className="text-[9px]">
                        {q.status === "exceeded" ? "Exceeded" : q.status === "warning" ? "Warning" : "OK"}
                      </Badge>
                      <span className="text-muted-foreground">Resets {q.resetsAt}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Tenant detail table */}
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Tenant Quota Detail</span></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Select value={tenantFilter} onValueChange={(v) => setTenantFilter(v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All tenants" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenants</SelectItem>
                    {tenants.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">No quota data for selected tenant.</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((q) => (
                    <div key={`${q.tenant}-${q.model}`} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{q.tenant}</span>
                            <Badge variant="outline" className="text-[9px]">{q.model}</Badge>
                            <Badge variant={q.status === "exceeded" ? "destructive" : q.status === "warning" ? "outline" : "secondary"} className="text-[9px]">
                              {q.status}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{q.requests.toLocaleString()} requests · ${q.spend.toLocaleString()} spend</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{q.remaining.toLocaleString()} remaining</p>
                        <p className="text-[10px] text-muted-foreground">of {q.monthlyQuota.toLocaleString()} · resets {q.resetsAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Override controls */}
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Quota Overrides</span></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Override monthly quota or rate limit for a specific tenant and model.</p>
              <div className="flex flex-wrap gap-2">
                <Select value={overrideTenant} onValueChange={setOverrideTenant}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={overrideModel} onValueChange={setOverrideModel}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Model" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai-insights-v2">ai-insights-v2</SelectItem>
                    <SelectItem value="predictive-analytics-v1">predictive-analytics-v1</SelectItem>
                    <SelectItem value="ai-cost-tracker">ai-cost-tracker</SelectItem>
                    <SelectItem value="fine-tune-job-v1">fine-tune-job-v1</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="h-8 w-24 text-xs" placeholder="Quota" value={overrideQuota} onChange={(e) => setOverrideQuota(e.target.value)} />
                <Input className="h-8 w-24 text-xs" placeholder="Rate limit" value={overrideRateLimit} onChange={(e) => setOverrideRateLimit(e.target.value)} />
                <Button size="sm" onClick={handleApplyOverride} disabled={!overrideTenant || !overrideModel}>Apply</Button>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border bg-amber-50/20 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <AlertTriangle className="h-3 w-3" /> {exceeded} tenant{exceeded !== 1 ? "s" : ""} have exceeded their monthly quota
            </div>
            <p className="mt-1">Rate limits are enforced at the model API gateway. Tenants exceeding quota receive HTTP 429 responses. Quota overrides take effect immediately.</p>
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}