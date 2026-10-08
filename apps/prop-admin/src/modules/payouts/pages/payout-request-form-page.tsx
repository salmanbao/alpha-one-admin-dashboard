"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/components/platform/status";
import { Wallet, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

export function PayoutRequestFormPage() {
  const { runtime, user, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const account = accounts.find((a) => a.phase === "funded") ?? accounts[0];

  const eligibleProfit = Math.max(0, (account?.equity ?? 0) - (account?.balance ?? 0));
  const traderShare = Math.round(eligibleProfit * 0.8);
  const fee = 20;
  const netPayout = traderShare - fee;
  const [method, setMethod] = useState("bank-transfer");

  if (!account || eligibleProfit <= 0) {
    return (
      <Page><PageHeader title="Request Payout" icon={Wallet} /><PageContent>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No profit available for withdrawal</p>
          <Button size="sm" variant="outline" onClick={() => navigate("payout-eligibility")}>Check eligibility</Button>
        </div>
      </PageContent></Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Request Payout" description="Review the calculation and submit your payout request." icon={Wallet} />
      <PageContent>
        {/* Calculation breakdown */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Payout calculation</span></CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Eligible profit</span><span className="font-medium tabular-nums">{formatCurrency(eligibleProfit, currency)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Trader share (80%)</span><span className="font-medium tabular-nums">{formatCurrency(traderShare, currency)}</span></div>
              <div className="flex items-center justify-between border-t pt-2"><span className="text-muted-foreground">Processing fee</span><span className="font-medium tabular-nums text-rose-600">-{formatCurrency(fee, currency)}</span></div>
              <div className="flex items-center justify-between border-t-2 pt-2"><span className="font-semibold">Net payout</span><span className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(netPayout, currency)}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Payout method */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Payout method</span></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Select method</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                <option value="bank-transfer">Bank Transfer</option>
                <option value="crypto">Crypto (USDT)</option>
                <option value="paypal">PayPal</option>
                <option value="skrill">Skrill</option>
              </select>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-50/30 p-2 text-xs text-muted-foreground dark:bg-amber-950/10">
              <Info className="mr-1 inline h-3 w-3" />
              Your payout will be reviewed by the firm's operations team. Processing typically takes 1-3 business days after approval.
            </div>
          </CardContent>
        </Card>

        {/* Summary + submit */}
        <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold">You will receive {formatCurrency(netPayout, currency)}</p>
              <p className="text-xs text-muted-foreground">Via {method} · after review and approval</p>
            </div>
            <Button onClick={() => {
              toast({ title: "Payout requested", description: `Request for ${formatCurrency(netPayout, currency)} via ${method} submitted. You'll be notified when it's approved.` });
              navigate("payouts-history");
            }}>
              <Wallet className="mr-1 h-4 w-4" /> Request payout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
