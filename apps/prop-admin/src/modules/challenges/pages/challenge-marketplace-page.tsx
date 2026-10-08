"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/components/platform/status";
import { Target, TrendingUp, TrendingDown, Shield, Calendar, Clock, Zap, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ChallengeCard {
  id: string;
  name: string;
  accountSize: number;
  price: number;
  profitTarget: string;
  dailyLoss: string;
  maxDrawdown: string;
  minTradingDays: number;
  maxDuration: number;
  platform: string;
  phases: number;
  popular?: boolean;
}

const challenges: ChallengeCard[] = [
  { id: "ch1", name: "2-Step Standard", accountSize: 100000, price: 990, profitTarget: "10%", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 7, maxDuration: 30, platform: "MT5", phases: 2, popular: true },
  { id: "ch2", name: "1-Step Turbo", accountSize: 50000, price: 490, profitTarget: "10%", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 5, maxDuration: 30, platform: "MT5", phases: 1 },
  { id: "ch3", name: "2-Step Gen Z", accountSize: 25000, price: 199, profitTarget: "8%", dailyLoss: "4%", maxDrawdown: "8%", minTradingDays: 5, maxDuration: 30, platform: "MT5", phases: 2 },
  { id: "ch4", name: "Instant Funded", accountSize: 100000, price: 4990, profitTarget: "—", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 0, maxDuration: 0, platform: "MT5", phases: 0 },
];

export function ChallengeMarketplacePage() {
  const { runtime, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  return (
    <Page>
      <PageHeader title="Challenge Marketplace" description="Choose the challenge that's right for you. Every rule is explained in plain language." icon={Target} />
      <PageContent>
        {/* Hero */}
        <div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-amber-50 p-6 dark:from-emerald-950/20 dark:to-amber-950/20">
          <h2 className="text-xl font-bold">Trade. Prove. Earn.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pass the evaluation, get funded, and trade with real capital. No hidden rules.</p>
        </div>

        {/* Challenge cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {challenges.map((c) => (
            <Card key={c.id} className={c.popular ? "border-emerald-500/40 ring-1 ring-emerald-500/10" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">{c.name}</h3>
                    {c.popular && <Badge className="text-[10px] bg-emerald-600">POPULAR</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.accountSize === 0 ? "Direct funding" : `${formatCurrency(c.accountSize, currency)} account`}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(c.price, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">one-time</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Key rules */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {c.profitTarget !== "—" && <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /><span className="text-muted-foreground">Profit target:</span><span className="font-medium">{c.profitTarget}</span></div>}
                  <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-amber-500" /><span className="text-muted-foreground">Daily loss:</span><span className="font-medium">{c.dailyLoss}</span></div>
                  <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-rose-500" /><span className="text-muted-foreground">Max DD:</span><span className="font-medium">{c.maxDrawdown}</span></div>
                  {c.minTradingDays > 0 && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-teal-500" /><span className="text-muted-foreground">Min days:</span><span className="font-medium">{c.minTradingDays}</span></div>}
                  {c.maxDuration > 0 && <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /><span className="text-muted-foreground">Time limit:</span><span className="font-medium">{c.maxDuration}d</span></div>}
                  <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-slate-500" /><span className="text-muted-foreground">Platform:</span><span className="font-medium">{c.platform}</span></div>
                </div>

                {/* What's included */}
                {c.phases > 0 && (
                  <div className="rounded-md bg-muted/30 p-2 text-xs">
                    <p className="font-medium text-foreground">{c.phases}-Phase Evaluation</p>
                    <p className="text-muted-foreground">Phase 1: Pass profit target → Phase 2: Confirm consistency → Funded</p>
                  </div>
                )}
                {c.phases === 0 && (
                  <div className="rounded-md bg-emerald-50/30 p-2 text-xs dark:bg-emerald-950/10">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">Instant Funding</p>
                    <p className="text-muted-foreground">Skip the evaluation — get funded immediately after purchase and KYC.</p>
                  </div>
                )}

                {/* CTA */}
                <Button className="w-full" onClick={() => toast({ title: "Starting checkout", description: `${c.name} — ${formatCurrency(c.price, currency)}` })}>
                  Buy {c.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Frequently asked questions</span></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div><p className="font-medium">What happens after I buy?</p><p className="text-muted-foreground">You'll complete KYC verification, then your trading account is provisioned with your challenge rules applied.</p></div>
            <div><p className="font-medium">Can I get a refund?</p><p className="text-muted-foreground">Refunds are available if your account is not yet activated. Once you start trading, the challenge fee is non-refundable.</p></div>
            <div><p className="font-medium">What if I fail?</p><p className="text-muted-foreground">If you breach a rule, you can purchase a new challenge. Some challenges include a free reset token as an add-on.</p></div>
            <div><p className="font-medium">How much can I earn?</p><p className="text-muted-foreground">Once funded, you keep 80% of the profits you generate on your funded account.</p></div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
