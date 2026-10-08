"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts, getTraderPayouts, getTraderBreaches } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { CheckCircle2, XCircle, Clock, Wallet, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PayoutEligibilityPage() {
  const { runtime, user, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const payouts = trader ? getTraderPayouts(trader.id) : [];
  const breaches = trader ? getTraderBreaches(trader.id) : [];
  const account = accounts.find((a) => a.phase === "funded") ?? accounts[0];

  const checks = [
    { label: "Funded account", status: account?.phase === "funded" ? "passed" : "failed", detail: account?.phase === "funded" ? "You have a funded account" : "You need a funded account to request payouts" },
    { label: "KYC verification", status: "passed", detail: "Your identity has been verified" },
    { label: "No active risk hold", status: breaches.filter((b) => b.status === "open").length === 0 ? "passed" : "failed", detail: breaches.filter((b) => b.status === "open").length === 0 ? "No risk cases on your account" : `${breaches.filter((b) => b.status === "open").length} open risk case(s) blocking payouts` },
    { label: "Minimum trading period", status: "passed", detail: "7+ trading days completed" },
    { label: "Profit available", status: (account?.equity ?? 0) > (account?.balance ?? 0) ? "passed" : "failed", detail: (account?.equity ?? 0) > (account?.balance ?? 0) ? `${formatCurrency((account?.equity ?? 0) - (account?.balance ?? 0), currency)} profit available` : "No profit available for withdrawal" },
  ];

  const allPassed = checks.every((c) => c.status === "passed");
  const eligibleProfit = Math.max(0, (account?.equity ?? 0) - (account?.balance ?? 0));
  const traderShare = Math.round(eligibleProfit * 0.8);

  return (
    <Page>
      <PageHeader title="Payout Eligibility" description="Check if you're eligible to request a profit payout." icon={Wallet} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard label="Eligible Profit" value={formatCurrency(eligibleProfit, currency)} icon={Wallet} tone={eligibleProfit > 0 ? "positive" : "default"} />
          <MetricCard label="Your Share (80%)" value={formatCurrency(traderShare, currency)} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Previous Payouts" value={payouts.filter((p) => p.status === "paid").length} icon={Clock} />
        </div>

        {/* Eligibility checklist */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Eligibility checklist</span></CardHeader>
          <CardContent className="space-y-2">
            {checks.map((c) => (
              <div key={c.label} className={cn("flex items-center gap-3 rounded-md border p-3", c.status === "passed" ? "border-emerald-500/20" : "border-rose-500/20")}>
                {c.status === "passed" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
                <StatusBadge tone={c.status === "passed" ? "success" : "danger"}>{c.status}</StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CTA */}
        {allPassed ? (
          <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">You're eligible for a payout!</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(traderShare, currency)} available to withdraw (80% of {formatCurrency(eligibleProfit, currency)} profit).</p>
              </div>
              <Button onClick={() => navigate("payout-request")}><Wallet className="mr-1 h-4 w-4" /> Request payout <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-rose-500/20 bg-rose-50/30 p-3 dark:bg-rose-950/10">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <XCircle className="h-4 w-4" /> Not yet eligible
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Resolve the failed items above to become eligible for a payout. Contact support if you have questions.</p>
          </div>
        )}
      </PageContent>
    </Page>
  );
}
