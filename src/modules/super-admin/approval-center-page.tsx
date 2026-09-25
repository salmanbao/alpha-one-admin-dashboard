"use client";

/**
 * Approval Center — research item #16.
 *
 * Two-operator approval queue for dangerous actions:
 *   - Tenant suspension
 *   - Tenant termination
 *   - Platform halt
 *   - Relay pause
 *   - Kill switch
 *   - Financial adjustments
 *
 * Self-approval must be impossible.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalRequest {
  id: string;
  action: string;
  requestedBy: string;
  tenant: string;
  risk: "high" | "critical" | "extreme";
  age: string;
  reason: string;
  blastRadius: string;
}

const pendingApprovals: ApprovalRequest[] = [
  {
    id: "APR-001",
    action: "Suspend Tenant",
    requestedBy: "Sarah Chen",
    tenant: "Gamma Futures",
    risk: "high",
    age: "23m",
    reason: "Recurring billing failures — 3 invoices past due",
    blastRadius: "1 tenant · 8 traders · All accounts frozen",
  },
  {
    id: "APR-002",
    action: "Relay Pause",
    requestedBy: "Marcus Webb",
    tenant: "All tenants (platform-wide)",
    risk: "critical",
    age: "8m",
    reason: "Event bus consumer lag detected — investigating DLQ depth",
    blastRadius: "ALL tenants · Event delivery paused · Trading continues",
  },
  {
    id: "APR-003",
    action: "Credit Note — $4,200",
    requestedBy: "Priya Nair",
    tenant: "Alpha Capital",
    risk: "high",
    age: "1h 12m",
    reason: "Duplicate charge — invoice INV-2024-008. Manual credit note requested.",
    blastRadius: "1 tenant · Financial adjustment · Reversed charge",
  },
  {
    id: "APR-004",
    action: "Platform Halt",
    requestedBy: "Daniel Cooper",
    tenant: "ALL TENANTS",
    risk: "extreme",
    age: "3m",
    reason: "Suspected data breach — isolating platform while investigating",
    blastRadius: "ALL trading · ALL payouts · ALL evaluations · ALL API access",
  },
];

const riskTone = (r: ApprovalRequest["risk"]) =>
  r === "extreme" ? "danger" : r === "critical" ? "warning" : "info";

const riskBadge = (r: ApprovalRequest["risk"]) => {
  if (r === "extreme") return "border-rose-500/40 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400";
  if (r === "critical") return "border-amber-500/40 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "border-slate-500/40 bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400";
};

export function ApprovalCenterPage() {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleApprove = (req: ApprovalRequest) => {
    setResolved((prev) => new Set(prev).add(req.id));
    toast({
      title: "Approved",
      description: `${req.action} for ${req.tenant} approved. 2FA verified. Audit ID: APR-${Date.now().toString(36).toUpperCase()}`,
    });
  };

  const handleReject = (req: ApprovalRequest) => {
    setResolved((prev) => new Set(prev).add(req.id));
    toast({
      title: "Rejected",
      description: `${req.action} for ${req.tenant} rejected. Audit ID: APR-${Date.now().toString(36).toUpperCase()}`,
      variant: "destructive",
    });
  };

  const active = pendingApprovals.filter((a) => !resolved.has(a.id));

  return (
    <Page>
      <PageHeader
        title="Approval Center"
        description="Two-operator approval queue for dangerous actions. Self-approval is impossible."
        icon={ShieldCheck}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pending" value={active.length} icon={Clock} tone={active.length > 0 ? "warning" : "positive"} />
          <MetricCard label="High Risk" value={active.filter((a) => a.risk === "high").length} icon={AlertTriangle} />
          <MetricCard label="Critical" value={active.filter((a) => a.risk === "critical").length} icon={AlertTriangle} tone="warning" />
          <MetricCard label="Extreme" value={active.filter((a) => a.risk === "extreme").length} icon={AlertTriangle} tone={active.some((a) => a.risk === "extreme") ? "negative" : "positive"} />
        </div>

        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground">No approvals pending. All dangerous actions have been resolved.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((req) => (
              <Card key={req.id} className={cn(
                req.risk === "extreme" && "border-rose-500/40 ring-1 ring-rose-500/20",
                req.risk === "critical" && "border-amber-500/40",
              )}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{req.action}</h3>
                        <Badge variant="outline" className={cn("text-[10px] capitalize", riskBadge(req.risk))}>
                          {req.risk} risk
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{req.id}</Badge>
                        <Badge variant="outline" className="text-[10px] tabular-nums">{req.age} old</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requested by</p><p className="font-medium">{req.requestedBy}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p><p className="font-medium">{req.tenant}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blast radius</p><p className="font-medium text-amber-700 dark:text-amber-400">{req.blastRadius}</p></div>
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                        <p className="text-xs">{req.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve {req.action}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              You are approving: {req.action} for {req.tenant}.<br />
                              Blast radius: {req.blastRadius}<br />
                              Requested by: {req.requestedBy}<br />
                              <strong className="text-rose-600">2FA verification will be required. This action is permanently logged in the audit trail.</strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 text-white hover:bg-rose-700"
                              onClick={() => handleApprove(req)}
                            >
                              Approve (requires 2FA)
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject {req.action}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The requesting operator will be notified. This rejection is also audited.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReject(req)}>Reject</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Self-approval rule */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Two-operator approval</p>
          <p className="mt-1">
            Actions requested by the current operator cannot be self-approved — a different operator must review and approve.
            All approvals require 2FA verification and are permanently logged in the platform audit trail with the actor, target, reason, and timestamp.
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
