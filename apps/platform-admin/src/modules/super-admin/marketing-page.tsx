"use client";

/**
 * Marketing Page — Coupons, campaigns, automation & A/B tests (M13 Marketing Tools).
 *
 * Stitch screen: (new)
 * Tier 3 — Coupon codes, email campaigns, automation flows, A/B experiments.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Percent,
  Send,
  Pause,
  Play,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  FlaskConical,
  Zap,
} from "lucide-react";

const demoCoupons = [
  { id: "cpn-001", code: "LAUNCH50", type: "percent", value: 50, redemptions: 342, maxRedemptions: 1000, expiresAt: "2026-11-30T00:00:00Z", status: "active" },
  { id: "cpn-002", code: "WELCOME25", type: "percent", value: 25, redemptions: 1840, maxRedemptions: null, expiresAt: null, status: "active" },
  { id: "cpn-003", code: "BLACKFRIDAY", type: "fixed", value: 100, redemptions: 0, maxRedemptions: 500, expiresAt: "2026-11-27T00:00:00Z", status: "scheduled" },
  { id: "cpn-004", code: "PARTNER10", type: "percent", value: 10, redemptions: 890, maxRedemptions: null, expiresAt: null, status: "active" },
  { id: "cpn-005", code: "SUMMER24", type: "percent", value: 30, redemptions: 2200, maxRedemptions: 2500, expiresAt: "2026-09-01T00:00:00Z", status: "expired" },
];

const demoCampaigns = [
  { id: "cmp-001", name: "Q4 Challenge Launch", channel: "email", audience: "All prospects", sent: 24500, opened: 9800, clicked: 2150, status: "sent", sentAt: "2026-10-01T10:00:00Z" },
  { id: "cmp-002", name: "Win-back: Lapsed Traders", channel: "email", audience: "Inactive 60d", sent: 8200, opened: 2100, clicked: 430, status: "sent", sentAt: "2026-10-05T14:00:00Z" },
  { id: "cmp-003", name: "Black Friday Teaser", channel: "email", audience: "All users", sent: 0, opened: 0, clicked: 0, status: "scheduled", sentAt: "2026-11-24T09:00:00Z" },
  { id: "cmp-004", name: "Payout Reminder", channel: "push", audience: "Eligible traders", sent: 0, opened: 0, clicked: 0, status: "draft", sentAt: null },
];

const demoExperiments = [
  { id: "exp-001", name: "Pricing page: annual vs monthly", metric: "Trial starts", variantA: "Control (monthly)", variantB: "Annual default", uplift: 12.4, status: "running", confidence: 94 },
  { id: "exp-002", name: "Signup CTA copy", metric: "Conversion", variantA: "Start Challenge", variantB: "Get Funded", uplift: -2.1, status: "running", confidence: 61 },
  { id: "exp-003", name: "Checkout: card vs wallet", metric: "Payment success", variantA: "Card first", variantB: "Wallet first", uplift: 5.8, status: "completed", confidence: 97 },
];

const statusTones: Record<string, "success" | "warning" | "info" | "danger"> = {
  active: "success",
  scheduled: "info",
  expired: "warning",
  disabled: "warning",
  sent: "success",
  draft: "warning",
  running: "info",
  completed: "success",
};

export function MarketingPage() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ coupons: demoCoupons, campaigns: demoCampaigns, experiments: demoExperiments }), { delayMs: 500 }), []);
  const data = loadedData ?? { coupons: [], campaigns: [], experiments: [] };
  const [couponSearch, setCouponSearch] = useState("");

  const coupons = useMemo(() => {
    return data.coupons.filter((c) => couponSearch === "" || c.code.toLowerCase().includes(couponSearch.toLowerCase()));
  }, [data.coupons, couponSearch]);

  const stats = useMemo(() => ({
    activeCoupons: data.coupons.filter((c) => c.status === "active").length,
    totalRedemptions: data.coupons.reduce((s, c) => s + c.redemptions, 0),
    runningCampaigns: data.campaigns.filter((c) => c.status === "scheduled" || c.status === "draft").length,
    totalOpened: data.campaigns.reduce((s, c) => s + c.opened, 0),
  }), [data]);

  return (
    <Page>
      <PageHeader
        title="Marketing"
        description="Coupons, campaigns, automation, and A/B experiments."
        icon={Megaphone}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Automation builder", description: "Automation flow builder: trigger → conditions → actions." })}>
              <Zap className="mr-1 h-4 w-4" /> Automation
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New campaign", description: "Campaign form: channel, audience, schedule, content." })}>
              <Plus className="mr-1 h-4 w-4" /> New Campaign
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
          loadingLabel="Loading marketing data…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active Coupons" value={stats.activeCoupons} icon={Percent} />
          <MetricCard label="Total Redemptions" value={stats.totalRedemptions.toLocaleString()} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Queued Campaigns" value={stats.runningCampaigns} icon={Send} tone="warning" />
          <MetricCard label="Emails Opened" value={stats.totalOpened.toLocaleString()} icon={TrendingUp} />
        </div>

        {/* Coupons */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Coupons</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Input
                    placeholder="Search codes..."
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                    className="h-8 w-44 pl-3 text-xs"
                  />
                </div>
                <Button size="sm" onClick={() => toast({ title: "Create coupon", description: "Coupon form: code, type, value, limits, expiry." })}>
                  <Plus className="mr-1 h-3 w-3" /> Create
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Redemptions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3"><code className="text-xs font-bold bg-muted px-2 py-0.5 rounded">{c.code}</code></td>
                      <td className="px-4 py-3 text-sm font-semibold">{c.type === "percent" ? `${c.value}%` : `$${c.value}`}</td>
                      <td className="px-4 py-3 text-sm">
                        {c.redemptions.toLocaleString()}
                        {c.maxRedemptions && <span className="text-muted-foreground"> / {c.maxRedemptions.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</td>
                      <td className="px-4 py-3"><StatusBadge tone={statusTones[c.status]}>{c.status}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Copied", description: `Coupon code ${c.code} copied.` })}>
                            Copy
                          </Button>
                          {c.status === "active" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Coupon disabled", description: `${c.code} disabled. Audited.` })}>
                              Disable
                            </Button>
                          )}
                          {c.status === "scheduled" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Coupon activated", description: `${c.code} is now live.` })}>
                              <Play className="h-3 w-3" /> Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns + Experiments */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Campaigns</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.campaigns.map((cmp) => {
                  const openRate = cmp.sent > 0 ? ((cmp.opened / cmp.sent) * 100).toFixed(1) : "—";
                  const clickRate = cmp.sent > 0 ? ((cmp.clicked / cmp.sent) * 100).toFixed(1) : "—";
                  return (
                    <div key={cmp.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{cmp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cmp.channel} · {cmp.audience}
                            {cmp.sentAt && ` · ${new Date(cmp.sentAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge tone={statusTones[cmp.status]}>{cmp.status}</StatusBadge>
                          {cmp.status === "scheduled" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Campaign paused", description: `${cmp.name} removed from schedule.` })}>
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                          {cmp.status === "draft" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Campaign scheduled", description: `${cmp.name} queued for delivery.` })}>
                              <Send className="h-3 w-3" /> Send
                            </Button>
                          )}
                        </div>
                      </div>
                      {cmp.sent > 0 && (
                        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                          <span>Sent: <strong className="text-foreground">{cmp.sent.toLocaleString()}</strong></span>
                          <span>Opened: <strong className="text-foreground">{cmp.opened.toLocaleString()}</strong> ({openRate}%)</span>
                          <span>Clicked: <strong className="text-foreground">{cmp.clicked.toLocaleString()}</strong> ({clickRate}%)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">A/B Experiments</h2>
                <Button size="sm" variant="outline" onClick={() => toast({ title: "New experiment", description: "Experiment form: hypothesis, variants, metric, traffic split." })}>
                  <FlaskConical className="mr-1 h-3 w-3" /> New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.experiments.map((exp) => (
                  <div key={exp.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{exp.name}</p>
                        <p className="text-xs text-muted-foreground">Metric: {exp.metric}</p>
                      </div>
                      <StatusBadge tone={statusTones[exp.status]}>{exp.status}</StatusBadge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <p className="text-muted-foreground">A: {exp.variantA}</p>
                      </div>
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <p className="text-muted-foreground">B: {exp.variantB}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="font-semibold" style={{ color: exp.uplift >= 0 ? "#4a7c59" : "#b83230" }}>
                        {exp.uplift >= 0 ? "+" : ""}{exp.uplift}% uplift
                      </span>
                      <span className="text-muted-foreground">{exp.confidence}% confidence</span>
                      {exp.status === "running" && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] ml-auto" onClick={() => toast({ title: "Experiment concluded", description: `${exp.name}: winner applied based on ${exp.confidence}% confidence.` })}>
                          Conclude
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
