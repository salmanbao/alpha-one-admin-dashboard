"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts, getTraderBreaches } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { AlertTriangle, ShieldAlert, TrendingDown, Target, ArrowRight, ShoppingCart, LifeBuoy, Eye } from "lucide-react";

export function AccountBreachPage() {
  const { runtime, user, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const breaches = trader ? getTraderBreaches(trader.id) : [];
  const breach = breaches.find((b) => b.status === "open") ?? breaches[0];

  if (!breach) {
    return (
      <Page><PageHeader title="Account Status" icon={ShieldAlert} /><PageContent>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-950"><ShieldAlert className="h-8 w-8 text-emerald-600" /></div>
          <p className="text-sm font-medium">Your account is in good standing</p>
          <p className="text-xs text-muted-foreground">No breaches detected. Keep trading within the rules.</p>
          <Button size="sm" variant="outline" onClick={() => navigate("trader-detail")}>Back to my account</Button>
        </div>
      </PageContent></Page>
    );
  }

  const account = accounts.find((a) => a.id === breach.accountId) ?? accounts[0];
  const balance = account?.balance ?? 25000;

  return (
    <Page>
      <PageHeader title="Evaluation Failed" description={`Account #${account?.login ?? "—"} · ${breach.rule}`} icon={AlertTriangle} />
      <PageContent>
        {/* Breach explanation */}
        <Card className="border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/10">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-rose-100 p-2 dark:bg-rose-950"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
            <div>
              <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Your account breached the {breach.rule} rule.</h2>
              <p className="text-xs text-muted-foreground">Violation detected at {new Date(breach.triggeredAt).toLocaleString()}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* What happened */}
            <div className="rounded-md border p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">What happened</p>
              <p className="text-sm">
                Your account was monitored for <strong>{breach.rule}</strong>.
                {breach.type === "daily-drawdown" && ` Your daily loss limit was ${formatCurrency(balance * 0.05, currency)}. At the time of the violation, your account reached the threshold.`}
                {breach.type === "max-drawdown" && ` Your maximum drawdown limit was ${formatCurrency(balance * 0.10, currency)}. Your account equity dropped below this threshold.`}
                {breach.type === "profit-target-miss" && ` You did not reach the profit target within the time limit.`}
                {breach.type === "time-limit" && ` The maximum evaluation duration expired before you reached the profit target.`}
              </p>
            </div>

            {/* Rule + value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rule violated</p>
                <p className="text-sm font-medium">{breach.rule}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Severity</p>
                <StatusBadge tone={breach.severity === "critical" ? "danger" : "warning"}>{breach.severity}</StatusBadge>
              </div>
            </div>

            {/* Evidence */}
            <div className="rounded-md border p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Evidence</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-1"><ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />Rule: {breach.rule}</li>
                <li className="flex items-start gap-1"><ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />Triggered: {new Date(breach.triggeredAt).toLocaleString()}</li>
                <li className="flex items-start gap-1"><ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />Account: #{account?.login ?? "—"}</li>
                <li className="flex items-start gap-1"><ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />Status: {breach.status}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* What happens next */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">What happens next</span></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>· Your evaluation account has been marked as <strong className="text-rose-600">failed</strong>.</p>
            <p>· You can no longer trade on this account.</p>
            <p>· Your account history and trade records are preserved for your reference.</p>
            <p>· You can purchase a new challenge to start a fresh evaluation.</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("challenges")}><ShoppingCart className="mr-1 h-4 w-4" /> Purchase new challenge</Button>
          <Button variant="outline" onClick={() => navigate("closed-positions")}><Eye className="mr-1 h-4 w-4" /> View trade history</Button>
          <Button variant="outline" onClick={() => navigate("support-tickets")}><LifeBuoy className="mr-1 h-4 w-4" /> Contact support</Button>
        </div>
      </PageContent>
    </Page>
  );
}
