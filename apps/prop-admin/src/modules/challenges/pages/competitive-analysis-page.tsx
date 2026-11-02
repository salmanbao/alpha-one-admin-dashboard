"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown, Shield, Calendar, Clock, Zap, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CompetitiveAnalysisCard {
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

const competitorCards: CompetitiveAnalysisCard[] = [
  { id: "ct1", name: "2-Step Standard", accountSize: 100000, price: 990, profitTarget: "10%", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 7, maxDuration: 30, platform: "MT5", phases: 2, popular: true },
  { id: "ct2", name: "1-Step Turbo", accountSize: 50000, price: 490, profitTarget: "10%", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 5, maxDuration: 30, platform: "MT5", phases: 1, popular: true },
  { id: "ct3", name: "2-Step Gen Z", accountSize: 25000, price: 199, profitTarget: "8%", dailyLoss: "4%", maxDrawdown: "8%", minTradingDays: 5, maxDuration: 30, platform: "MT5", phases: 2, popular: true },
  { id: "ct4", name: "Instant Funded", accountSize: 100000, price: 4990, profitTarget: "—", dailyLoss: "5%", maxDrawdown: "10%", minTradingDays: 0, maxDuration: 0, platform: "MT5", phases: 0, popular: true },
  { id: "ct5", name: "3-Step Elite", accountSize: 200000, price: 1990, profitTarget: "12%", dailyLoss: "3%", maxDrawdown: "7%", minTradingDays: 10, maxDuration: 60, platform: "MT5", phases: 3, popular: true },
];

export function CompetitiveAnalysisPage() {
  const { runtime, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  return (
    <Page>
      <PageHeader title="Competitive Analysis" description="Compare our challenges against industry benchmarks." icon={Zap} />
      <PageContent>
        <Card>
          <CardHeader>Competitive Landscape</CardHeader>
          <CardContent>
            <div className="space-y-4">
              {competitorCards.map((c) => (
                <div key={c.id} className="rounded-md border bg-surface-container p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.accountSize.toLocaleString()} account size
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {c.price} {currency}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Profit target: {c.profitTarget}</span>
                    <span>Daily loss: {c.dailyLoss}</span>
                    <span>Max drawdown: {c.maxDrawdown}</span>
                    <span>{c.minTradingDays} days</span>
                  </div>
                  {c.popular && (
                    <Badge variant="default" className="text-xs">
                      Popular
                    </Badge>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2" 
                    onClick={() => toast({ title: "Details", description: `${c.name} details would open here. (demo)` })}>
                    View details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
