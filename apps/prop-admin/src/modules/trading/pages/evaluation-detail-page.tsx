"use client";

/**
 * Evaluation Detail — single challenge evaluation summary + decision actions.
 *
 * Extracted from the Evaluation Queue into the detail-overlay pattern:
 * a queue row opens this screen as a sheet (?panel=evaluation-detail&id=eval-…)
 * and the same component renders full-page from ?view=evaluation-detail&id=eval-…
 * (new tab).
 *
 * Shows the full evaluation summary (profit vs target, days, drawdown,
 * requested/decided timestamps and the decision record) plus the
 * Approve / Reject / Override actions for pending evaluations — shared
 * with the queue's inline actions column via EvaluationRowActions, so
 * decisions mutate the same session evaluation store and both views
 * re-render from useEvaluationVersion().
 */

import { usePlatform } from "@/lib/platform/platform-context";
import {
  getEvaluation,
  useEvaluationVersion,
} from "@/modules/trading/evaluation-store";
import {
  EvaluationRowActions,
  statusLabel,
  statusTone,
} from "@/modules/trading/pages/evaluation-queue-page";
import { Page, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, ClipboardCheck } from "lucide-react";

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={cn("mt-1 text-sm", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

export function EvaluationDetailPage() {
  const { router, navigate } = usePlatform();
  useEvaluationVersion(); // re-render after Approve / Reject / Override

  const ev = getEvaluation(router.params.id ?? "") ?? null;
  const close = () => navigate("evaluation-queue");

  if (!ev) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Evaluation not found</p>
            <p className="text-sm text-muted-foreground">
              The evaluation you&apos;re looking for no longer exists.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ChevronRight className="mr-1 h-4 w-4 rotate-180" /> Back to Evaluation Queue
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  const pct = Math.min(100, Math.round((ev.profitPct / ev.targetPct) * 100));
  const met = ev.profitPct >= ev.targetPct;

  return (
    <Page>
      {/* Breadcrumb — Evaluation Queue > [evaluation id] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Evaluation Queue
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{ev.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        {/* Summary card */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <ClipboardCheck className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {ev.traderName}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · {ev.id}
                  </span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ev.challengeName} · {ev.phase}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusTone[ev.status]}>{statusLabel[ev.status]}</StatusBadge>
                  <Badge variant="outline" className="font-mono text-[10px]">{ev.accountLogin}</Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Key metrics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Trader Email" value={ev.traderEmail} />
            <DetailField label="Account" value={ev.accountLogin} mono />
            <DetailField
              label="Requested"
              value={new Date(ev.requestedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Profit vs Target
              </p>
              <div className="mt-1">
                <span className={cn("text-sm font-semibold", met ? "text-emerald-600" : "text-muted-foreground")}>
                  {ev.profitPct}% / {ev.targetPct}%
                </span>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn("h-1.5 rounded-full", met ? "bg-emerald-500" : "bg-sky-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
            <DetailField
              label="Days"
              value={`${ev.daysTraded}/${ev.minDays} min`}
              mono
            />
            <DetailField label="Drawdown Used" value={`${ev.drawdownUsedPct}%`} mono />
          </div>

          {/* Decision record (present once decided) */}
          {ev.status !== "pending" ? (
            <>
              <Separator className="my-4" />
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Decision
                </p>
                <p className="mt-1 text-sm">
                  {ev.overrideOutcome ? `Force ${ev.overrideOutcome}: ` : ""}
                  {ev.reason ?? "—"}
                </p>
                {ev.decidedAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Decided {new Date(ev.decidedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Decision actions — Approve / Reject (reason) / Override (reason) */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">
            {ev.status === "pending" ? "Review decision" : "No action needed"}
          </p>
          {ev.status === "pending" ? (
            <EvaluationRowActions ev={ev} />
          ) : (
            <p className="text-xs text-muted-foreground">
              This evaluation has already been reviewed. The decision above is
              recorded in the audit trail.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Decisions are recorded in the audit trail. Manual overrides require a
          reason and are flagged for compliance review.
        </p>
      </PageContent>
    </Page>
  );
}
