"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Award, ArrowRight, TrendingUp, ShieldCheck } from "lucide-react";

export function EvaluationPassedPage() {
  const { navigate } = usePlatform();
  return (
    <Page>
      <PageHeader title="Evaluation Passed" icon={Award} />
      <PageContent>
        <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-emerald-100 p-5 dark:bg-emerald-950">
              <Award className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Congratulations!</h2>
              <p className="mt-1 text-sm text-muted-foreground">You've successfully passed your evaluation.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Profit achieved</p><p className="font-bold text-emerald-600">+$2,840</p></div>
              <div><p className="text-muted-foreground">Trading days</p><p className="font-bold">8/7</p></div>
              <div><p className="text-muted-foreground">Max drawdown</p><p className="font-bold">3.1%</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Next steps</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div className="flex-1"><p className="text-sm font-medium">Eligibility confirmed</p><p className="text-xs text-muted-foreground">You're eligible for a funded account</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
                <div className="flex-1"><p className="text-sm font-medium">Accept funded trader agreement</p><p className="text-xs text-muted-foreground">Review and accept the terms to proceed</p></div>
                <Button size="sm" variant="outline" onClick={() => navigate("terms-policies")}>Review</Button>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
                <div className="flex-1"><p className="text-sm font-medium">Funded account provisioning</p><p className="text-xs text-muted-foreground">Your funded account will be created automatically</p></div>
                <Button size="sm" variant="outline" disabled>Pending</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Button className="w-full" onClick={() => navigate("trading-credentials")}><ShieldCheck className="mr-1 h-4 w-4" /> View funded account credentials <ArrowRight className="ml-1 h-4 w-4" /></Button>
      </PageContent>
    </Page>
  );
}
