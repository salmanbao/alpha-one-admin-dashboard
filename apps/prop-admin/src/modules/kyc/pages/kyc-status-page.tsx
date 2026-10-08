"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { ShieldCheck, Clock, CheckCircle2, XCircle, Upload, LifeBuoy, ArrowRight } from "lucide-react";

export function KycStatusPage() {
  const { navigate } = usePlatform();
  return (
    <Page>
      <PageHeader title="KYC Verification Status" description="What was verified and what you need to do next." icon={ShieldCheck} />
      <PageContent>
        <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Identity verified</p>
              <p className="text-xs text-muted-foreground">Your identity was verified 2 months ago. All checks passed.</p>
            </div>
            <StatusBadge tone="success">Approved</StatusBadge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold">Verification details</h3>
            {[
              { label: "Identity document", status: "Verified", detail: "Passport · issued 2022" },
              { label: "Address verification", status: "Verified", detail: "Utility bill · 2024-03" },
              { label: "Selfie / liveness", status: "Verified", detail: "Liveness check passed" },
              { label: "PEP / sanctions screening", status: "Passed", detail: "No matches found" },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3 rounded-md border p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div className="flex-1"><p className="text-sm font-medium">{c.label}</p><p className="text-xs text-muted-foreground">{c.detail}</p></div>
                <StatusBadge tone="success">{c.status}</StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
            <div className="space-y-2 text-xs">
              <div className="flex gap-2"><Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">2 months ago</span><span>KYC submitted</span></div>
              <div className="flex gap-2"><Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">2 months ago (+8 min)</span><span>Identity document verified</span></div>
              <div className="flex gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-muted-foreground">2 months ago (+12 min)</span><span className="font-medium text-emerald-600">All checks passed — KYC approved</span></div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("account-provisioning")}>Continue to provisioning <ArrowRight className="ml-1 h-3 w-3" /></Button>
          <Button variant="ghost" onClick={() => navigate("support-tickets")}><LifeBuoy className="mr-1 h-4 w-4" /> Contact support</Button>
        </div>
      </PageContent>
    </Page>
  );
}
