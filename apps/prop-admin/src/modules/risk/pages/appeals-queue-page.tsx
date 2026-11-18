"use client";

/**
 * Appeals Queue — R9 W1 Part B5 (UC-O1).
 *
 * The operator's side of the trust loop: every trader outage claim
 * (`appeal.claim-submitted`) and every support escalation lands here as
 * an Appeal row with its evidence packet expanded per row:
 *
 *   • outage claims     — symbol, window, auto-attached trade refs
 *   • breach disputes   — rule cited, threshold vs observed (from the
 *                         risk-rules alert the ticket escalated against)
 *   • verdicts          — accept/reject with a required reason; persist
 *                         (R10), `recordAudit`, emit `appeal.accepted` /
 *                         `appeal.rejected`. Accepting reverses the
 *                         linked breach (`breach.reversed` — alert
 *                         reversed + risk case dismissed), which the
 *                         trader sees in their inbox.
 *
 * The confirm dialog states exactly which breach will be reversed (or
 * that none exists) before the operator commits — no hidden effects.
 * Declared in the risk manifest + registered in view-router (R9).
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { usePlatform, useRouter } from "@/lib/platform/platform-context";
import {
  breachToReverse,
  decideAppeal,
  useAppeals,
  type Appeal,
  type AppealVerdict,
} from "@/lib/appeals-store";

const STATUS_BADGE: Record<Appeal["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "destructive" },
  "under-review": { label: "Under review", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  rejected: { label: "Rejected", variant: "outline" },
};

const KIND_LABEL: Record<Appeal["kind"], string> = {
  "outage-claim": "Outage claim",
  "breach-dispute": "Breach dispute",
};

function fmt(v: string): string {
  const t = Date.parse(v);
  return Number.isNaN(t) ? v : new Date(t).toLocaleString();
}

export function AppealsQueuePage() {
  const { runtime } = usePlatform();
  // ?view= shell — cross-view links use navigate() (no physical routes).
  const { navigate } = useRouter();
  const tid = runtime.tenant?.id ?? "platform";
  const appeals = useAppeals();

  const [filter, setFilter] = useState<"all" | "open" | "decided">("all");
  const [deciding, setDeciding] = useState<{ appeal: Appeal; verdict: AppealVerdict } | null>(null);
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = appeals.filter((a) =>
    filter === "all" ? true : filter === "open" ? a.status === "open" : a.status === "accepted" || a.status === "rejected",
  );
  const openCount = appeals.filter((a) => a.status === "open").length;

  function confirmVerdict(): void {
    if (!deciding) return;
    if (reason.trim().length < 5) {
      toast({ title: "Reason required", description: "Verdicts must state why — the trader sees this reason.", variant: "destructive" });
      return;
    }
    const done = decideAppeal(tid, deciding.appeal.id, deciding.verdict, reason);
    if (done) {
      const reversed = deciding.verdict === "accepted" ? breachToReverse(done) : undefined;
      toast({
        title: deciding.verdict === "accepted" ? "Appeal accepted" : "Appeal rejected",
        description: reversed
          ? `${done.id} decided — breach ${reversed.id} reversed; trader notified (Demo).`
          : `${done.id} decided — trader notified with your reason (Demo).`,
      });
    }
    setDeciding(null);
    setReason("");
  }

  function openVerdict(a: Appeal, verdict: AppealVerdict): void {
    setReason("");
    setDeciding({ appeal: a, verdict });
  }

  const pendingBreach = deciding?.verdict === "accepted" ? breachToReverse(deciding.appeal) : undefined;

  return (
    <Page>
      <PageHeader
        title="Appeals Queue"
        description="Outage claims and breach disputes with their evidence packets — trader-filed and support-escalated (UC-O1 / UC-O9). (Demo)"
      />
      <PageContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Total appeals" value={String(appeals.length)} />
          <MetricCard label="Open" value={String(openCount)} />
          <MetricCard label="Accepted" value={String(appeals.filter((a) => a.status === "accepted").length)} />
          <MetricCard label="Rejected" value={String(appeals.filter((a) => a.status === "rejected").length)} />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "open", "decided"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "open" ? "Open" : "Decided"}
            </Button>
          ))}
          <button
            type="button"
            onClick={() => navigate("risk-rule-engine")}
            className="ml-auto text-sm font-medium text-primary hover:underline"
          >
            Rule versions →
          </button>
        </div>

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No appeals in this filter. Traders file outage claims from their /rules page; support
            tickets escalate from Support Tickets.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((a) => {
            const isOpen = a.status === "open";
            const breach = a.evidence.breachAlertId
              ? breachToReverse(a)
              : undefined;
            const isOpenRow = expanded === a.id;
            return (
              <div key={a.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.id}</span>
                    <Badge variant="secondary">{KIND_LABEL[a.kind]}</Badge>
                    <Badge variant={STATUS_BADGE[a.status].variant}>{STATUS_BADGE[a.status].label}</Badge>
                    {a.evidence.breachAlertId && breach?.reversedAt && (
                      <Badge variant="outline">Breach reversed</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>trader {a.traderId}</span>
                    <span>opened {fmt(a.openedAt)}</span>
                  </div>
                </div>

                {/* Evidence packet — expanded per appeal (spec: queue with
                    evidence packet expanded per appeal). */}
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Evidence
                    </div>
                    {a.evidence.ruleId ? (
                      <div>
                        Rule <code>{a.evidence.ruleId}</code>
                        {typeof a.evidence.threshold === "number" && typeof a.evidence.observed === "number" && (
                          <span>
                            {" "}— threshold {a.evidence.threshold} · observed {a.evidence.observed}
                          </span>
                        )}
                        {breach && (
                          <div className="text-xs text-muted-foreground">
                            {breach.ruleName} · {breach.detail} {breach.reversedAt ? "· reversed" : breach.status === "open" ? "· still open" : ""}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        No rule cited — {a.kind === "outage-claim" ? "outage window + trades" : "dispute without a linked breach"}.
                      </div>
                    )}
                    {a.evidence.window && (
                      <div className="text-xs text-muted-foreground">
                        Window {fmt(a.evidence.window.from)} → {fmt(a.evidence.window.to)}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {a.evidence.tradeRefs.length
                        ? `${a.evidence.tradeRefs.length} trade ref(s): ${a.evidence.tradeRefs.slice(0, 5).join(", ")}${a.evidence.tradeRefs.length > 5 ? " …" : ""}`
                        : "No trade refs attached"}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Notes
                    </div>
                    <div className="whitespace-pre-wrap text-muted-foreground">
                      {a.notes ?? "—"}
                    </div>
                    {a.verdictReason && (
                      <div className="mt-2 border-t pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Verdict reason
                        </span>
                        <div className="whitespace-pre-wrap">{a.verdictReason}</div>
                        {a.decidedAt && (
                          <div className="text-xs text-muted-foreground">decided {fmt(a.decidedAt)}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpenRow ? null : a.id)}>
                    {isOpenRow ? "Hide detail" : "Show detail"}
                  </Button>
                  {isOpen && (
                    <>
                      <Button size="sm" onClick={() => openVerdict(a, "accepted")}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openVerdict(a, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          (Demo) Every verdict persists to the session store, is recorded in the audit log, and
          notifies the trader&apos;s inbox with your reason. Accepting an appeal reverses the
          disputed breach and dismisses its risk case.
        </p>
      </PageContent>

      {/* Verdict confirm — shows the exact blast radius before commit. */}
      <Dialog open={!!deciding} onOpenChange={(o) => { if (!o) setDeciding(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding?.verdict === "accepted" ? "Accept appeal" : "Reject appeal"} — {deciding?.appeal.id}
            </DialogTitle>
            <DialogDescription>
              {deciding?.verdict === "accepted"
                ? "The trader sees your reason in their inbox; accepting reverses the disputed breach."
                : "The trader sees your reason in their inbox; the breach (if any) stays in place."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {deciding ? KIND_LABEL[deciding.appeal.kind] : ""} evidence
              </div>
              {deciding?.appeal.evidence.ruleId ? (
                <div>
                  Rule <code>{deciding.appeal.evidence.ruleId}</code> — threshold{" "}
                  {deciding.appeal.evidence.threshold ?? "?"} · observed{" "}
                  {deciding.appeal.evidence.observed ?? "?"}
                </div>
              ) : (
                <div className="text-muted-foreground">No rule cited.</div>
              )}
              <div className="text-xs text-muted-foreground">
                {deciding?.appeal.evidence.tradeRefs.length ?? 0} trade ref(s)
              </div>
            </div>
            {deciding?.verdict === "accepted" && (
              <div className="rounded-md border p-3 text-sm">
                {pendingBreach ? (
                  <>
                    <span className="font-medium">Will reverse breach {pendingBreach.id}</span>{" "}
                    <span className="text-muted-foreground">
                      ({pendingBreach.ruleName} — {pendingBreach.accountLogin ?? pendingBreach.accountId})
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    No open breach will be reversed — nothing linked to this appeal&apos;s account.
                  </span>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium" htmlFor="verdict-reason">
                Verdict reason (required — shown to the trader)
              </label>
              <Textarea
                id="verdict-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Outage confirmed in provider logs — losses in the window are void."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button onClick={confirmVerdict}>
              {deciding?.verdict === "accepted" ? "Confirm accept" : "Confirm reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
