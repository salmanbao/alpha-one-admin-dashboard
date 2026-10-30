"use client";

/**
 * Risk Case Detail — investigation workspace for a single risk case.
 *
 * Extracted from the Risk Cases queue (master-detail right pane) into the
 * detail-overlay pattern: a queue row opens this screen as a sheet
 * (?panel=risk-case-detail&id=RC-…) while the same component renders
 * full-page from ?view=risk-case-detail&id=RC-… (new tab).
 *
 * Contains everything that used to live inline in the queue's right pane:
 * severity/status badges, reviewer assignment, trader link, signal +
 * evidence, resolution/dismissal record, internal notes, and the
 * Investigate / Escalate / Mark action required / Resolve / Dismiss
 * workflow actions with their dialogs (PRD §4.11 / §4.17).
 *
 * The case is resolved by `router.params.id` from the session
 * risk-case-store; useRiskCaseVersion() re-renders after every mutation.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  addRiskCaseNote,
  assignRiskCase,
  dismissRiskCase,
  getRiskCases,
  resolveRiskCase,
  setRiskCaseStatus,
  useRiskCaseVersion,
  type RiskActionTaken,
  type RiskCase,
} from "@/modules/risk/risk-case-store";
import { sevTone, statusTone } from "@/modules/risk/pages/risk-cases-page";

const actionTakenLabel: Record<RiskActionTaken, string> = {
  warned: "Warned trader",
  account_closed: "Account closed",
  payout_blocked: "Payout blocked",
  none: "No action needed",
};

const REVIEWERS = ["Unassigned", "Sarah Chen", "Marcus Webb"];

export function RiskCaseDetailPage() {
  const { runtime, navigate, router, user } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useRiskCaseVersion(); // re-render after every workflow action

  const id = router.params.id ?? "";
  const riskCase: RiskCase | null =
    getRiskCases(tid).find((c) => c.id === id) ?? null;

  const [note, setNote] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [actionTaken, setActionTaken] = useState<RiskActionTaken>("none");

  const reviewers =
    user?.name && !REVIEWERS.includes(user.name) ? [...REVIEWERS, user.name] : REVIEWERS;

  const close = () => navigate("risk-cases");

  if (!riskCase) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Risk case not found</p>
            <p className="text-sm text-muted-foreground">
              The case you&apos;re looking for no longer exists or belongs to another tenant.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back to Risk Cases
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      {/* Breadcrumb — Risk Cases > [case id] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Risk Cases
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{riskCase.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        <Card
          className={cn(
            riskCase.severity === "critical" && "border-rose-500/40",
            riskCase.severity === "high" && "border-amber-500/40",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={sevTone(riskCase.severity)}>{riskCase.severity}</StatusBadge>
                <StatusBadge tone={statusTone(riskCase.status)}>{riskCase.status}</StatusBadge>
                <Badge variant="outline" className="text-[10px] font-mono">{riskCase.id}</Badge>
              </div>
              <p className="mt-1 text-sm font-semibold">{riskCase.signal}</p>
              <p className="text-xs text-muted-foreground">Opened {riskCase.opened}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Reviewer assignment (PRD assigned_to) */}
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned to</p>
              <Select
                value={riskCase.assignedTo}
                onValueChange={(v) => {
                  assignRiskCase(tid, riskCase.id, v);
                  toast({ title: "Reviewer assigned", description: `${v} assigned to ${riskCase.id}.` });
                }}
              >
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trader */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trader</p>
                <button onClick={() => navigate("trader-detail", { id: riskCase.traderId })} className="flex items-center gap-1 font-medium text-primary hover:underline">
                  <User className="h-3 w-3" />{riskCase.traderName}
                </button>
              </div>
              <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Accounts</p>
                <p className="font-medium">{riskCase.accountIds.length > 0 ? riskCase.accountIds.join(", ") : "—"}</p>
              </div>
              <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Exposure</p>
                <p className="font-medium tabular-nums">${riskCase.currentExposure.toLocaleString()}</p>
              </div>
              <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payout hold</p>
                {riskCase.payoutHold ? <Badge variant="outline" className="border-amber-500/30 text-amber-700 text-[10px] dark:text-amber-400">${riskCase.payoutHoldAmount.toLocaleString()} held</Badge> : <span className="text-muted-foreground">None</span>}
              </div>
            </div>

            {/* Signal detail */}
            <div className="rounded-md border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Signal</p>
              <p className="text-xs">{riskCase.signalDetail}</p>
            </div>

            {/* Evidence */}
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><FileText className="h-3 w-3" />Evidence</p>
              <ul className="space-y-0.5">
                {riskCase.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />{e}
                  </li>
                ))}
              </ul>
            </div>

            {/* Resolution (visible once resolved — PRD resolution + action taken) */}
            {riskCase.status === "resolved" && riskCase.resolution ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 p-2 dark:bg-emerald-950/20">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Resolution</p>
                <p className="text-xs">{riskCase.resolution}</p>
                {riskCase.actionTaken ? (
                  <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Action taken: {actionTakenLabel[riskCase.actionTaken]}
                  </p>
                ) : null}
              </div>
            ) : riskCase.status === "dismissed" ? (
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dismissed</p>
                <p className="text-xs text-muted-foreground">Closed without further action.</p>
              </div>
            ) : null}

            {/* Notes */}
            {riskCase.notes.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Internal notes</p>
                <div className="space-y-1">
                  {riskCase.notes.map((n, i) => (
                    <div key={i} className="rounded-md border bg-muted/30 p-2 text-[11px]">{n}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Add note */}
            <div>
              <Textarea placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
              <Button size="sm" variant="outline" className="mt-1" disabled={!note.trim()} onClick={() => {
                addRiskCaseNote(tid, riskCase.id, note);
                toast({ title: "Note added", description: `Note on ${riskCase.id} logged.` });
                setNote("");
              }}>Add note</Button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t pt-2">
              {riskCase.status !== "resolved" && riskCase.status !== "dismissed" && (
                <>
                  {riskCase.status !== "investigating" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setRiskCaseStatus(tid, riskCase.id, "investigating");
                      if (riskCase.assignedTo === "Unassigned" && user?.name) {
                        assignRiskCase(tid, riskCase.id, user.name);
                      }
                      toast({ title: "Investigation started", description: `${riskCase.id} is now under investigation.` });
                    }}>
                      <Eye className="mr-1 h-3 w-3" /> Investigate
                    </Button>
                  )}
                  {riskCase.status !== "escalated" && (
                    <Button size="sm" variant="outline" className="text-amber-700" onClick={() => {
                      setRiskCaseStatus(tid, riskCase.id, "escalated");
                      toast({ title: "Case escalated", description: `${riskCase.id} escalated to senior risk review.` });
                    }}>
                      <AlertTriangle className="mr-1 h-3 w-3" /> Escalate
                    </Button>
                  )}
                  {riskCase.status !== "action-required" && (
                    <Button size="sm" variant="outline" className="text-rose-700" onClick={() => {
                      setRiskCaseStatus(tid, riskCase.id, "action-required");
                      toast({ title: "Action required", description: `${riskCase.id} marked as action required.` });
                    }}>
                      <AlertTriangle className="mr-1 h-3 w-3" /> Mark action required
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-emerald-700" onClick={() => setResolveOpen(true)}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-muted-foreground">
                        <XCircle className="mr-1 h-3 w-3" /> Dismiss
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Dismiss {riskCase.id}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Close “{riskCase.signal}” for {riskCase.traderName} without further action.
                          The case stays visible under the Dismissed filter and the closure is logged.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                          dismissRiskCase(tid, riskCase.id);
                          toast({ title: "Case dismissed", description: `${riskCase.id} closed without action.` });
                        }}>
                          Dismiss case
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resolve dialog — resolution text + action-taken selector (PRD §4.5) */}
        <AlertDialog
          open={resolveOpen}
          onOpenChange={(o) => {
            setResolveOpen(o);
            if (!o) {
              setResolution("");
              setActionTaken("none");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resolve {riskCase.id}?</AlertDialogTitle>
              <AlertDialogDescription>
                Record the outcome of this investigation. Resolution text and action taken are
                stored on the case for the audit trail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="case-resolution" className="text-xs text-muted-foreground">
                  Resolution (required)
                </Label>
                <Textarea
                  id="case-resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="What did the investigation conclude?"
                  className="min-h-[72px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Action taken</Label>
                <Select value={actionTaken} onValueChange={(v) => setActionTaken(v as RiskActionTaken)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No action needed</SelectItem>
                    <SelectItem value="warned">Warned trader</SelectItem>
                    <SelectItem value="account_closed">Account closed</SelectItem>
                    <SelectItem value="payout_blocked">Payout blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!resolution.trim()}
                onClick={() => {
                  resolveRiskCase(tid, riskCase.id, resolution.trim(), actionTaken);
                  toast({
                    title: "Case resolved",
                    description: `${riskCase.id} resolved — ${actionTakenLabel[actionTaken]}.`,
                  });
                }}
              >
                Resolve case
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContent>
    </Page>
  );
}
