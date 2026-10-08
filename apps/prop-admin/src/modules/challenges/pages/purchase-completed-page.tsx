"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Download, Mail, Key } from "lucide-react";

export function PurchaseCompletedPage() {
  const { navigate, runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const order = { id: "ORD-48291", amount: 990, method: "Credit Card", timestamp: new Date().toLocaleString() };

  return (
    <Page>
      <PageHeader title="Purchase Complete" icon={CheckCircle2} />
      <PageContent>
        <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-950">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Challenge purchased!</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your 2-Step Standard challenge is ready to set up.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Order #</p><p className="font-mono font-medium">{order.id}</p></div>
              <div><p className="text-muted-foreground">Amount</p><p className="font-medium">${order.amount} {currency}</p></div>
              <div><p className="text-muted-foreground">Method</p><p className="font-medium">{order.method}</p></div>
            </div>
            <p className="text-xs text-muted-foreground">Purchased at {order.timestamp}</p>
          </CardContent>
        </Card>

        {/* Next steps */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Next steps</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600 dark:bg-emerald-950">1</div>
                <div className="flex-1"><p className="text-sm font-medium">Complete KYC verification</p><p className="text-xs text-muted-foreground">Required before account activation</p></div>
                <Button size="sm" onClick={() => navigate("kyc-onboarding")}>Complete <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</div>
                <div className="flex-1"><p className="text-sm font-medium">Account provisioning</p><p className="text-xs text-muted-foreground">Your trading account will be created automatically</p></div>
                <Button size="sm" variant="outline" onClick={() => navigate("account-provisioning")}>View progress</Button>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">3</div>
                <div className="flex-1"><p className="text-sm font-medium">Start trading</p><p className="text-xs text-muted-foreground">Once your account is active, view your credentials and start trading</p></div>
                <Button size="sm" variant="outline" disabled>Start trading</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Receipt downloaded" })}><Download className="mr-1 h-4 w-4" /> Download receipt</Button>
          <Button variant="outline"><Mail className="mr-1 h-4 w-4" /> Email confirmation sent</Button>
        </div>
      </PageContent>
    </Page>
  );
}
