"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { Shield, TrendingDown, Target, Calendar, Clock, Lock, Zap, Eye, Ban, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface RuleDef {
  name: string;
  limit: string;
  current: string;
  status: "safe" | "warning" | "breached" | "info";
  explanation: string;
  violation: string;
  icon: ComponentType<{ className?: string }>;
}

export function RulesPage() {
  const { runtime, user } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const account = accounts[0];
  const balance = account?.balance ?? 25000;

  const rules: RuleDef[] = [
    { name: "Profit Target", limit: formatCurrency(balance * 0.10, currency), current: formatCurrency(balance * 0.074, currency), status: "safe", explanation: "You must reach this profit target to pass the evaluation phase.", violation: "If you don't reach the target within the time limit, your evaluation will expire.", icon: Target },
    { name: "Daily Loss Limit", limit: formatCurrency(balance * 0.05, currency), current: formatCurrency(balance * 0.022, currency), status: "safe", explanation: "The maximum amount your account can lose in a single day. Resets at 00:00 server time.", violation: "If your daily loss reaches this limit, your account will be marked as breached.", icon: TrendingDown },
    { name: "Maximum Drawdown", limit: formatCurrency(balance * 0.10, currency), current: formatCurrency(balance * 0.031, currency), status: "safe", explanation: "The maximum total drawdown allowed from your starting balance. This does not reset daily.", violation: "If your account equity drops below this threshold, your evaluation will fail.", icon: Shield },
    { name: "Minimum Trading Days", limit: "7 days", current: "4 days", status: "info", explanation: "You must trade on at least this many separate days to be eligible to pass.", violation: "Even if you reach the profit target, you cannot pass until this requirement is met.", icon: Calendar },
    { name: "Maximum Duration", limit: "30 days", current: "12 days elapsed", status: "info", explanation: "You have a maximum of 30 days to complete this evaluation phase.", violation: "If the time limit expires before you reach the profit target, your evaluation will fail.", icon: Clock },
    { name: "Leverage", limit: "1:100", current: "1:100", status: "info", explanation: "The maximum leverage available on your trading account.", violation: "Attempting to use higher leverage will be rejected by the broker.", icon: Zap },
    { name: "Weekend Trading", limit: "Not allowed", current: "—", status: "info", explanation: "Holding positions over the weekend is not permitted on evaluation accounts.", violation: "If a position is open at market close on Friday, it will be force-closed and may trigger a breach.", icon: Ban },
    { name: "News Trading", limit: "Restricted", current: "—", status: "info", explanation: "Trading 2 minutes before or after high-impact news events is restricted.", violation: "Trades opened during restricted news periods may be voided.", icon: Eye },
    { name: "EA / Bot Trading", limit: "Allowed", current: "—", status: "safe", explanation: "Expert Advisors and automated trading bots are permitted on this account.", violation: "—", icon: Lock },
    { name: "Copy Trading", limit: "Not allowed", current: "—", status: "info", explanation: "Copying another trader's positions is not permitted. Your trading must be independent.", violation: "If copy-trading is detected, your account may be suspended.", icon: Copy },
  ];

  const statusTone = (s: RuleDef["status"]) => s === "safe" ? "success" : s === "warning" ? "warning" : s === "breached" ? "danger" : "info";

  return (
    <Page>
      <PageHeader title="Rules & Trading Conditions" description="Every rule explained in plain language. What it means, what happens if violated." icon={Shield} />
      <PageContent>
        {rules.map((rule) => {
          const Icon = rule.icon;
          return (
            <Card key={rule.name}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{rule.name}</h3>
                    <StatusBadge tone={statusTone(rule.status)}>{rule.status === "safe" ? "Within limit" : rule.status === "warning" ? "Warning" : rule.status === "breached" ? "Breached" : "Info"}</StatusBadge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Limit</p>
                    <p className="text-sm font-medium">{rule.limit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</p>
                    <p className={cn("text-sm font-medium", rule.status === "warning" ? "text-amber-600" : rule.status === "breached" ? "text-rose-600" : "text-foreground")}>{rule.current}</p>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="rounded-md bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">What it means</p>
                    <p className="text-xs">{rule.explanation}</p>
                  </div>
                  {rule.violation !== "—" && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-50/30 p-2 dark:bg-rose-950/10">
                      <p className="text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-400">If violated</p>
                      <p className="text-xs text-muted-foreground">{rule.violation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </PageContent>
    </Page>
  );
}
