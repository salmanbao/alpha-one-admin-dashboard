"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTraderForUser,
  getFirstFundedTrader,
  getTraderAccounts,
  getTraderPayouts,
  getTraderBreaches,
  getTraderKyc,
} from "@/lib/platform/mock-data";
import { computePayoutQuote } from "@/lib/payout-math";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { Eye, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function PayoutEligibilityPage() {
  const { runtime, user, navigate, router } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  // Resolve the trader: a linked trader user sees their own numbers; an admin
  // opening this self-service view gets a labelled preview of the first funded
  // trader in the tenant (deep-linkable via ?traderId=…).
  const linkedTrader = getTraderForUser(user);
  const previewTrader = linkedTrader
    ? null
    : getFirstFundedTrader(runtime.tenant?.id ?? "tenant-alpha");
  const trader =
    linkedTrader ??
    (router.params.traderId
      ? (getTraderForUser({ traderId: router.params.traderId }) ?? previewTrader)
      : previewTrader);
  const isPreview = trader !== null && trader !== linkedTrader;

  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const payouts = trader ? getTraderPayouts(trader.id) : [];
  const breaches = trader ? getTraderBreaches(trader.id) : [];
  const kyc = trader ? getTraderKyc(trader.id) : null;
  const account = accounts.find((a) => a.phase === "funded") ?? accounts[0];

  const openBreaches = breaches.filter((b) => b.status === "open").length;
  const quote = account
    ? computePayoutQuote(account, payouts, openBreaches, kyc?.status === "approved")
    : null;
  const allPassed = quote?.canRequestPayout ?? false;

  return (
    <Page>
      <PageHeader
        title="Payout Eligibility"
        description="Check if you're eligible to request a profit payout."
        icon={Wallet}
      />
      <PageContent>
        {isPreview && (
          <Card className="mb-4 border-dashed">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              Preview — viewing the payout position of{" "}
              <span className="font-medium text-foreground">{trader?.name}</span> (demo data, no
              real trader is logged in).
            </CardContent>
          </Card>
        )}

        {!quote || !account ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No trading account found — payouts become available once an account is funded.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <MetricCard
                label="Eligible profit (above starting balance)"
                value={formatCurrency(quote.eligibleProfit, currency)}
                deltaLabel={`Balance ${formatCurrency(quote.balance, currency)} − starting ${formatCurrency(quote.startingBalance, currency)}`}
              />
              <MetricCard
                label={`Your share (${quote.traderSplitPct}%)`}
                value={formatCurrency(quote.traderShare, currency)}
                deltaLabel={`Plan split — firm retains ${formatCurrency(quote.firmShare, currency)}`}
              />
              <MetricCard
                label="Floating P&L (excluded)"
                value={formatCurrency(quote.floatingPnl, currency)}
                deltaLabel="Unrealised — not withdrawable until positions close"
              />
            </div>

            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Eligibility checklist</span>
                  <StatusBadge tone={allPassed ? "success" : "danger"}>
                    {allPassed ? "Eligible" : "Not yet eligible"}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {quote.checks.map((c) => (
                    <li key={c.label} className="flex items-start justify-between gap-4 py-2">
                      <div>
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.detail}</div>
                      </div>
                      <StatusBadge
                        tone={c.status === "passed" ? "success" : c.status === "warning" ? "warning" : "danger"}
                        className={cn("shrink-0")}
                      >
                        {c.status === "passed" ? "Pass" : c.status === "warning" ? "Note" : "Blocked"}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="mt-4 flex justify-end">
              <Button disabled={!allPassed} onClick={() => navigate("payout-request")}>
                Request payout
              </Button>
            </div>
          </>
        )}
      </PageContent>
    </Page>
  );
}
