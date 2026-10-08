"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { CheckCircle2, Clock, Key, ArrowRight, LifeBuoy, Server } from "lucide-react";

export function AccountProvisioningPage() {
  const { navigate } = usePlatform();
  const steps = [
    { label: "Purchase confirmed", status: "completed", icon: CheckCircle2 },
    { label: "KYC verification completed", status: "completed", icon: CheckCircle2 },
    { label: "Creating trading account", status: "completed", icon: Server },
    { label: "Applying challenge configuration", status: "completed", icon: CheckCircle2 },
    { label: "Generating credentials", status: "current", icon: Key },
    { label: "Account ready", status: "pending", icon: CheckCircle2 },
  ];

  return (
    <Page>
      <PageHeader title="Account Provisioning" description="Your trading account is being prepared." icon={Server} />
      <PageContent>
        <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Preparing your account…</p>
              <p className="text-xs text-muted-foreground">Step 5 of 6: Generating credentials. Estimated time: 30 seconds.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3 py-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${s.status === "completed" ? "bg-emerald-100 dark:bg-emerald-950" : s.status === "current" ? "bg-amber-100 dark:bg-amber-950 animate-pulse" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${s.status === "completed" ? "text-emerald-600" : s.status === "current" ? "text-amber-600" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-sm ${s.status === "completed" ? "text-muted-foreground line-through" : s.status === "current" ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  {s.status === "completed" && <StatusBadge tone="success">Done</StatusBadge>}
                  {s.status === "current" && <StatusBadge tone="warning">In progress</StatusBadge>}
                  {i < steps.length - 1 && <div className={`ml-3.5 h-4 w-px ${s.status === "completed" ? "bg-emerald-500/30" : "bg-border"}`} />}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" disabled><Key className="mr-1 h-4 w-4" /> View credentials (available soon)</Button>
          <Button variant="ghost" onClick={() => navigate("support-tickets")}><LifeBuoy className="mr-1 h-4 w-4" /> Contact support</Button>
        </div>
      </PageContent>
    </Page>
  );
}
