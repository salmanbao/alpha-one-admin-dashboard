"use client";

/**
 * Payout Fraud & Abuse Queue — R9 W2 UC-O5.
 *
 * Signals computed at payout intake land here as flags with their
 * evidence lines expanded per row:
 *
 *   • method-reuse   — same withdrawal detail (fingerprint) across
 *                      multiple trading accounts
 *   • rapid-cycle    — purchase → payout request within 7 days on the
 *                      same program label
 *   • round-amount   — amount structuring just under a round threshold
 *
 * Verdicts (clear / block / escalate) persist under
 * `pfaas:demo:payout-fraud` (R10), `recordAudit`, and emit
 * `payout.fraud-cleared/blocked/escalated` — the trader sees the
 * receipt in their inbox. A `blocked` flag removes the Approve action
 * from every payout queue surface until cleared (chokepoint in
 * `applyPayoutDecision`, mirroring the AML hold). Declared in the
 * payouts manifest + registered in view-router (R9).
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
import { useRouter } from "@/lib/platform/platform-context";
import {
  setPayoutFraudVerdict,
  usePayoutFraudFlags,
  type FraudFlag,
  type FraudFlagStatus,
  type FraudSignal,
  type FraudVerdict,
} from "@/lib/payout-fraud-store";
import { formatCurrency } from "@/components/platform/status";

const STATUS_BADGE: Record<FraudFlagStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "destructive" },
  blocked: { label: "Blocked", variant: "destructive" },
  escalated: { label: "Escalated", variant: "secondary" },
  cleared: { label: "Cleared", variant: "default" },
};

const SIGNAL_LABEL: Record<FraudSignal, string> = {
  "method-reuse": "Method reuse",
  "rapid-cycle": "Rapid cycle",
  "round-amount": "Round threshold",
};

function fmt(v: string): string {
  const t = Date.parse(v);
  return Number.isNaN(t) ? v : new Date(t).toLocaleString();
}

export function PayoutFraudQueuePage() {
  // ?view= shell — cross-view links use navigate() (no physical routes).
  const { navigate } = useRouter();
  const flags = usePayoutFraudFlags();

  const [filter, setFilter] = useState<"all" | "open" | "decided">("all");
  const [deciding, setDeciding] = useState<{ flag: FraudFlag; verdict: FraudVerdict } | null>(null);
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = flags.filter((f) =>
    filter === "all" ? true : filter === "open" ? f.status === "open" : f.status !== "open",
  );
  const openCount = flags.filter((f) => f.status === "open").length;
  const blockedCount = flags.filter((f) => f.status === "blocked").length;

  function confirmVerdict(): void {
    if (!deciding) return;
    // Blocking money must state why — the reason goes to the audit row,
    // the lifecycle payload and the trader's inbox receipt.
    if (deciding.verdict !== "cleared" && reason.trim().length < 5) {
      toast({ title: "Reason required", description: "A block/escalation must state why — the trader sees this reason.", variant: "destructive" });
      return;
    }
    const done = setPayoutFraudVerdict(deciding.flag.reference, deciding.verdict, reason);
    if (done) {
      toast({
        title:
          deciding.verdict === "cleared"
            ? "Flag cleared"
            : deciding.verdict === "blocked"
              ? "Payout blocked"
              : "Flag escalated",
        description:
          deciding.verdict === "cleared"
            ? `${done.reference} is approvable again — trader notified (Demo).`
            : `${done.reference} cannot move money until cleared — trader notified (Demo).`,
      });
    }
    setDeciding(null);
    setReason("");
  }

  function openVerdict(f: FraudFlag, verdict: FraudVerdict): void {
    setReason("");
    setDeciding({ flag: f, verdict });
  }

  return (
    <Page>
      <PageHeader
        title="Payout Fraud Queue"
        description="Payout-abuse signals from intake with their evidence — method reuse, rapid cycles, threshold structuring (UC-O5). (Demo)"
      />
      <PageContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Total flags" value={String(flags.length)} />
          <MetricCard label="Open" value={String(openCount)} />
          <MetricCard label="Blocked" value={String(blockedCount)} />
          <MetricCard label="Cleared" value={String(flags.filter((f) => f.status === "cleared").length)} />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "open", "decided"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "open" ? "Open" : "Decided"}
            </Button>
          ))}
          <button
            type="button"
            onClick={() => navigate("payouts-pending")}
            className="ml-auto text-sm font-medium text-primary hover:underline"
          >
            Pending payouts →
          </button>
        </div>

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No fraud flags in this filter. Signals are computed when traders submit payout
            requests — method reuse across accounts, purchase-to-payout cycles under 7 days,
            and amounts structured just under round thresholds.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((f) => {
            const isOpen = f.status === "open";
            const isBlocked = f.status === "blocked";
            const isOpenRow = expanded === f.id;
            return (
              <div key={f.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.reference}</span>
                    {f.signals.map((s) => (
                      <Badge key={s} variant="secondary">{SIGNAL_LABEL[s]}</Badge>
                    ))}
                    <Badge variant={STATUS_BADGE[f.status].variant}>{STATUS_BADGE[f.status].label}</Badge>
                    {isBlocked && (
                      <Badge variant="destructive">Approve removed in queue</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{f.traderName}</span>
                    <span>{formatCurrency(f.amount, f.currency)}</span>
                    <span>flagged {fmt(f.openedAt)}</span>
                  </div>
                </div>

                {/* Evidence — one line per tripped signal (spec: flags
                    with evidence lines). */}
                <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence
                  </div>
                  <ul className="space-y-1">
                    {f.evidence.map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 text-rose-600 dark:text-rose-400" aria-hidden>•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  {f.verdictReason && (
                    <div className="mt-2 border-t pt-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Verdict reason
                      </span>
                      <div className="whitespace-pre-wrap">{f.verdictReason}</div>
                      {f.decidedAt && (
                        <div className="text-xs text-muted-foreground">decided {fmt(f.decidedAt)}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpenRow ? null : f.id)}>
                    {isOpenRow ? "Hide detail" : "Show detail"}
                  </Button>
                  {isOpen && (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => openVerdict(f, "blocked")}>
                        Block payout
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openVerdict(f, "cleared")}>
                        Clear
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openVerdict(f, "escalated")}>
                        Escalate
                      </Button>
                    </>
                  )}
                  {isBlocked && (
                    <Button size="sm" onClick={() => openVerdict(f, "cleared")}>
                      Clear & restore approval
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          (Demo) Every verdict persists to the session store, is recorded in the audit log, and
          notifies the trader&apos;s inbox. A blocked payout cannot be approved on any payout
          surface — batch pre-flight and the automation gate count it as gated — until cleared
          here.
        </p>
      </PageContent>

      {/* Verdict confirm — states the blast radius before commit. */}
      <Dialog open={!!deciding} onOpenChange={(o) => { if (!o) setDeciding(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding?.verdict === "cleared"
                ? "Clear fraud flag"
                : deciding?.verdict === "blocked"
                  ? "Block payout"
                  : "Escalate fraud flag"}{" "}
              — {deciding?.flag.reference}
            </DialogTitle>
            <DialogDescription>
              {deciding?.verdict === "cleared"
                ? "The payout returns to the normal approval flow; the trader receives a cleared receipt."
                : deciding?.verdict === "blocked"
                  ? "The Approve action disappears from every payout queue surface until you clear this flag; the trader receives a paused receipt with your reason."
                  : "The flag moves to senior review; the payout stays in the queue under review."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Signals
              </div>
              <ul className="space-y-1">
                {deciding?.flag.evidence.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="fraud-verdict-reason">
                Reason{deciding?.verdict !== "cleared" ? " (required — shown to the trader)" : " (optional)"}
              </label>
              <Textarea
                id="fraud-verdict-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Same withdrawal detail across three accounts — ownership unverified."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button
              variant={deciding?.verdict === "blocked" ? "destructive" : "default"}
              onClick={confirmVerdict}
            >
              {deciding?.verdict === "cleared"
                ? "Confirm clear"
                : deciding?.verdict === "blocked"
                  ? "Confirm block"
                  : "Confirm escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
