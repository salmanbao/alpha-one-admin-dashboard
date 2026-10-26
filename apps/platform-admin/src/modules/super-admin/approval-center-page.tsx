"use client";

/**
 * Approval Center (docs/21 CON-32)
 *
 * Two-operator approval queue for the nuclear set (tenant suspend/
 * terminate, platform halt, relay pause, flag kill-switches).
 *
 * Phase B: fully wired to the console store — pending requests show the
 * exact action + blast radius, a live 10-minute countdown, and 2FA-gated
 * Approve/Reject. Self-approval is structurally denied: the Approve
 * button is disabled for the initiator, and the store returns a 403-shaped
 * error even if that guard were bypassed. Requests initiated from the
 * safety screens (Phase C) land here.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import {
  ApprovalRequestCard,
  useApprovalRequests,
} from "@/components/platform/approval-flow";
import {
  initiateApproval,
  useConsoleStore,
} from "@/lib/platform/console-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { EmptyState } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";

const DEMO_ACTIONS = [
  {
    actionKey: "tenant.terminate",
    actionLabel: "Terminate tenant Gamma Futures",
    blastRadius: [
      "All 8 traders permanently lose access",
      "2 funded accounts ($46k) are closed out at market",
      "Data export window: 72 hours, then purged",
    ],
    detail: "Runbook TEN-09 · abuse investigation AB-131",
  },
  {
    actionKey: "control.platform_halt",
    actionLabel: "Platform halt (all tenants)",
    blastRadius: [
      "All trading halts across every tenant",
      "Payouts, evaluations, and API access stop",
      "Estimated blast radius: $1.4M monthly volume",
    ],
    detail: "Incident ladder rung 3 · OPS-11",
  },
  {
    actionKey: "control.flag_kill_switch",
    actionLabel: "Kill-switch: disable auto_payout flag fleet-wide",
    blastRadius: ["Payout automation halts for all tenants", "Manual payouts unaffected"],
    detail: "Flag rollback of v1.8.2",
  },
];

export function ApprovalCenterPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { user } = usePlatform();
  const store = useConsoleStore();
  const approvals = useApprovalRequests();
  const [demoIdx, setDemoIdx] = useState(0);

  const pending = approvals.filter((a) => a.status === "pending_approval");
  const closed = approvals.filter((a) => a.status !== "pending_approval");
  const expiringSoon = pending.filter((a) => a.expiresAt - Date.now() < 2 * 60 * 1000);

  const simulate = () => {
    const spec = DEMO_ACTIONS[demoIdx % DEMO_ACTIONS.length];
    const request = initiateApproval({
      ...spec,
      initiator: { id: user.id, name: user.name },
    });
    setDemoIdx((i) => i + 1);
    toast({
      title: "Demo request created",
      description: `${request.actionLabel} — you are the initiator, so you can't approve it yourself. Switch user (topbar) to approve.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Approval Center"
        description="Two-operator approval queue for dangerous actions. Operator A initiates (2FA) → operator B approves (2FA, 10-min window) → executes. Self-approval is impossible."
        icon={ShieldCheck}
        actions={
          <Button size="sm" variant="ghost" onClick={simulate}>
            <Sparkles className="mr-1 h-4 w-4" /> Simulate request (demo)
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading approvals…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pending" value={pending.length} icon={Clock} tone={pending.length > 0 ? "warning" : "positive"} />
          <MetricCard label="Expiring < 2 min" value={expiringSoon.length} icon={AlertTriangle} tone={expiringSoon.length > 0 ? "negative" : "positive"} />
          <MetricCard label="Approved / executed" value={store.audit.filter((a) => a.action === "console.escalation_approved").length} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Rejected" value={store.audit.filter((a) => a.action === "console.escalation_rejected").length} icon={XCircle} />
        </div>

        {/* ── Pending queue ─────────────────────────────────────── */}
        {pending.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No approvals pending. Dangerous actions land here the moment a second operator's review is required."
            icon={CheckCircle2}
            hint="Use “Simulate request (demo)” to exercise the approval flow."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((req) => (
              <ApprovalRequestCard
                key={req.id}
                request={req}
                onDecided={(r, decision) => {
                  if (decision === "reject") {
                    toast({
                      title: "Rejected",
                      description: `${r.actionLabel} — rejection recorded in the audit trail.`,
                      variant: "destructive",
                    });
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* ── Closed history ────────────────────────────────────── */}
        {closed.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recently closed
            </p>
            {closed.map((req) => (
              <ApprovalRequestCard key={req.id} request={req} />
            ))}
          </div>
        ) : null}

        {/* Self-approval rule */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Two-operator approval</p>
          <p className="mt-1">
            The approval token names the initiator — a self-approval is rejected as a 403, not a
            warning. Every decision requires the approver&apos;s 2FA and is permanently logged in the
            platform audit trail (actor, target, blast radius, timestamp). Pending requests expire
            10 minutes after initiation.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
