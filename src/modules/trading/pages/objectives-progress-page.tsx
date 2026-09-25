"use client";

/**
 * Objectives & Progress — research item #18.
 *
 * One of the most important trader screens. Shows profit target, daily loss,
 * max drawdown, trading days, and time limit with visual progress bars.
 *
 * "How close am I to my objective?"
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts, getTraderPositions, hashStr } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingDown, Shield, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ObjectivesProgressPage() {
  const { runtime, user } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = user.application === "trader" ? getTraderForUser(user) : null;
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const positions = trader ? getTraderPositions(trader.id) : [];

  // Use first account for the objectives view
  const account = accounts[0];
  if (!account) {
    return (
      <Page>
        <PageHeader title="Objectives & Progress" description="Track your evaluation objectives." icon={Target} />
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Target className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No active account</p>
            <p className="text-xs text-muted-foreground">Purchase a challenge to start tracking your objectives.</p>
          </div>
        </PageContent>
      </Page>
    );
  }

  const balance = account.balance;
  const equity = account.equity;
  const pnl = equity - balance;
  const pnlPct = balance > 0 ? (pnl / balance) * 100 : 0;

  // Profit target — typically 10% of account size
  const profitTarget = balance * 0.10;
  const targetProgress = Math.max(0, Math.min(100, (pnl / profitTarget) * 100));
  const targetRemaining = Math.max(0, profitTarget - pnl);

  // Daily loss — typically 5% of account
  const dailyLossLimit = balance * 0.05;
  const dailyLossUsed = Math.abs(Math.min(0, pnl)); // simplified — uses current P&L as proxy
  const dailyLossRemaining = Math.max(0, dailyLossLimit - dailyLossUsed);
  const dailyLossPct = (dailyLossUsed / dailyLossLimit) * 100;

  // Max drawdown — typically 10% of account
  const maxDrawdown = balance * 0.10;
  const currentDrawdown = Math.max(0, balance - equity); // simplified
  const drawdownRemaining = Math.max(0, maxDrawdown - currentDrawdown);
  const drawdownPct = (currentDrawdown / maxDrawdown) * 100;

  // Trading days — minimum 7 days required
  const minTradingDays = 7;
  const completedDays = 3 + (hashStr(account.id) % 5); // deterministic 3-7
  const remainingDays = Math.max(0, minTradingDays - completedDays);
  const daysProgress = (completedDays / minTradingDays) * 100;

  // Time limit — 30 days from creation
  const maxDuration = 30;
  const createdDate = new Date(account.createdAt);
  const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, maxDuration - daysSinceCreation);
  const timeProgress = (daysSinceCreation / maxDuration) * 100;

  const isNearTarget = targetProgress >= 70;
  const isNearBreach = drawdownPct >= 80 || dailyLossPct >= 80;

  return (
    <Page>
      <PageHeader
        title="Objectives & Progress"
        description={`Account #${account.login} · ${account.phase === "funded" ? "Funded" : `Phase ${account.phase?.includes("1") ? "1" : "2"}`} · ${account.platform}`}
        icon={Target}
      />
      <PageContent>
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(balance, currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Equity</p>
            <p className={cn("text-xl font-bold tabular-nums", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(equity, currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current P&L</p>
            <p className={cn("text-xl font-bold tabular-nums", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Return</p>
            <p className={cn("text-xl font-bold tabular-nums", pnlPct >= 0 ? "text-emerald-600" : "text-rose-600")}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%</p>
          </div>
        </div>

        {/* Important alerts */}
        {(isNearTarget || isNearBreach) && (
          <div className={cn(
            "rounded-lg border p-3",
            isNearBreach ? "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20" : "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20",
          )}>
            {isNearTarget && (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Target className="h-4 w-4" /> You are {targetProgress.toFixed(0)}% toward your profit target! Only {formatCurrency(targetRemaining, currency)} to go.
              </p>
            )}
            {isNearBreach && (
              <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" /> Warning: Your account is approaching the {drawdownPct >= 80 ? "maximum drawdown" : "daily loss"} limit. Trade carefully.
              </p>
            )}
          </div>
        )}

        {/* Progress sections */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Profit Target */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">Profit Target</span>
              <StatusBadge tone={targetProgress >= 100 ? "success" : "info"}>{targetProgress.toFixed(0)}%</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={targetProgress} className="h-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current: <span className={cn("font-medium", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)}</span></span>
                <span className="text-muted-foreground">Target: <span className="font-medium text-foreground">{formatCurrency(profitTarget, currency)}</span></span>
              </div>
              <p className="text-xs text-muted-foreground">Remaining: <span className="font-medium text-foreground">{formatCurrency(targetRemaining, currency)}</span></p>
            </CardContent>
          </Card>

          {/* Daily Loss */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Daily Loss Limit</span>
              <StatusBadge tone={dailyLossPct >= 80 ? "danger" : dailyLossPct >= 50 ? "warning" : "success"}>{dailyLossPct.toFixed(0)}% used</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={dailyLossPct} className="h-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Used: <span className="font-medium text-rose-600">{formatCurrency(dailyLossUsed, currency)}</span></span>
                <span className="text-muted-foreground">Limit: <span className="font-medium text-foreground">{formatCurrency(dailyLossLimit, currency)}</span></span>
              </div>
              <p className="text-xs text-muted-foreground">Remaining: <span className="font-medium text-emerald-600">{formatCurrency(dailyLossRemaining, currency)}</span></p>
            </CardContent>
          </Card>

          {/* Max Drawdown */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Shield className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-medium">Maximum Drawdown</span>
              <StatusBadge tone={drawdownPct >= 80 ? "danger" : drawdownPct >= 50 ? "warning" : "success"}>{drawdownPct.toFixed(0)}% used</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={drawdownPct} className="h-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current: <span className="font-medium text-rose-600">{formatCurrency(currentDrawdown, currency)}</span></span>
                <span className="text-muted-foreground">Limit: <span className="font-medium text-foreground">{formatCurrency(maxDrawdown, currency)}</span></span>
              </div>
              <p className="text-xs text-muted-foreground">Remaining: <span className="font-medium text-emerald-600">{formatCurrency(drawdownRemaining, currency)}</span></p>
            </CardContent>
          </Card>

          {/* Trading Days */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Calendar className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-medium">Trading Days</span>
              <StatusBadge tone={remainingDays === 0 ? "success" : "info"}>{completedDays}/{minTradingDays} days</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={daysProgress} className="h-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Completed: <span className="font-medium text-foreground">{completedDays} days</span></span>
                <span className="text-muted-foreground">Required: <span className="font-medium text-foreground">{minTradingDays} days</span></span>
              </div>
              <p className="text-xs text-muted-foreground">
                {remainingDays > 0
                  ? <>Remaining: <span className="font-medium text-amber-600">{remainingDays} more day{remainingDays === 1 ? "" : "s"}</span></>
                  : <span className="flex items-center gap-1 font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Requirement met</span>
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Time Limit */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Time Limit</span>
            <StatusBadge tone={daysRemaining <= 5 ? "warning" : "info"}>{daysRemaining} days left</StatusBadge>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={timeProgress} className="h-3" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Started: <span className="font-medium text-foreground">{createdDate.toLocaleDateString()}</span></span>
              <span className="text-muted-foreground">Deadline: <span className="font-medium text-foreground">{new Date(createdDate.getTime() + maxDuration * 86400000).toLocaleDateString()}</span></span>
            </div>
            <p className="text-xs text-muted-foreground">Days elapsed: <span className="font-medium text-foreground">{daysSinceCreation}</span> of {maxDuration} maximum</p>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
