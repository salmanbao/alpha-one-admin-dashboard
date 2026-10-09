"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, RefreshCw as Refresh, Play, CheckCircle2, Clock, AlertCircle, BookOpen, UserPlus, Building2, Shield, BarChart3, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { id: "account", label: "Account Setup", icon: UserPlus, done: true, description: "Configure your operator profile and credentials." },
  { id: "tenants", label: "Tenant Provisioning", icon: Building2, done: true, description: "Create and configure your first tenant." },
  { id: "modules", label: "Module Configuration", icon: Activity, done: true, description: "Enable core modules for your tenant." },
  { id: "risk", label: "Risk Rules", icon: Shield, done: false, description: "Set up drawdown limits and risk fences." },
  { id: "payouts", label: "Payout Integration", icon: BarChart3, done: false, description: "Connect payout rails and configure withdrawal rules." },
];

const milestones = [
  { label: "Account Setup", done: true },
  { label: "Tenant Provisioning", done: true },
  { label: "Module Configuration", done: true },
  { label: "Risk Rules", done: false },
  { label: "Payout Integration", done: false },
];

export function GettingStartedPage() {
  const [completed, setCompleted] = useState(STEPS.map((s) => s.id));
  const progress = Math.round((completed.length / STEPS.length) * 100);
  const completedCount = completed.length;

  const toggleStep = (id: string) => {
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    toast({ title: "Step updated", description: `${id} ${completed.includes(id) ? "unmarked" : "marked"} as complete.` });
  };

  return (
    <Page>
      <PageHeader
        title="Getting Started"
        description="Step-by-step operator onboarding. Master tenant provisioning, risk rules, trading bridge integration, and payout clearance."
        icon={Sparkles}
        actions={<Button size="sm" variant="outline" onClick={() => setCompleted([])}><Refresh className="mr-1 h-4 w-4" /> Restart</Button>}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Completion" value={`${completedCount}/${STEPS.length}`} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Progress" value={`${progress}%`} icon={Sparkles} />
          <MetricCard label="Modules Certified" value="3" icon={Activity} />
          <MetricCard label="Est. Remaining" value="25 min" icon={Clock} />
        </div>

        {/* Progress banner */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Operator Enablement Progress</span>
              </div>
              <Badge variant="outline" className="text-[9px]">Phase 1: Foundations ({progress}%)</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Foundation to Production Readiness</span>
              <span className="text-muted-foreground">{completedCount} of {STEPS.length} steps</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
              <Progress value={progress} className="h-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1 text-center">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm",
                    m.done ? "bg-primary text-on-primary" : "bg-muted text-muted-foreground",
                  )}>
                    {m.done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[10px]">{i + 1}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="grid gap-4 lg:grid-cols-2">
          {STEPS.map((step, i) => {
            const done = completed.includes(step.id);
            return (
              <Card key={step.id} className={cn("cursor-pointer transition-hover hover:shadow-sm", !done && "border-amber-500/20 bg-amber-50/10 dark:bg-amber-950/5")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm shadow-sm",
                      done ? "bg-primary text-on-primary" : "bg-muted text-muted-foreground",
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{step.label}</h3>
                        {done && <Badge variant="secondary" className="text-[9px]">Done</Badge>}
                        {!done && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400">In Progress</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Step {i + 1} of {STEPS.length}</span>
                        {!done && <Button size="sm" variant="ghost" className="text-xs text-primary h-6 px-2" onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}>Mark done</Button>}
                        {done && <Button size="sm" variant="ghost" className="text-xs text-rose-600 h-6 px-2" onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}>Undo</Button>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm"><Play className="mr-1 h-4 w-4" /> Resume Tour</Button>
          <Button size="sm" variant="outline" onClick={() => toast({ title: "Onboarding restarted", description: "All steps have been reset." })}>Restart Onboarding</Button>
          <Button size="sm" variant="outline"><BookOpen className="mr-1 h-4 w-4" /> Knowledge Base</Button>
          <Button size="sm" variant="outline"><Shield className="mr-1 h-4 w-4" /> Platform Overview</Button>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <AlertCircle className="h-3 w-3" /> Operator Onboarding · Self-Paced Cohort · Level 1 Certified Track
          </div>
          <p className="mt-1">Complete all 5 steps to achieve Level 1 certification. Estimated total time: 45 minutes. Progress is saved per operator.</p>
        </div>
      </PageContent>
    </Page>
  );
}
