"use client";

/**
 * Emergency Controls — the "nuclear controls" screen (docs/21 CON-15/28).
 *
 *   - Tenant Halt (stops new purchases, payout requests, account transitions)
 *   - Maintenance Mode (trading continues, new purchases unavailable)
 *   - Relay Pause (stops event relay processing, not trading)
 *   - Feature/Kill Switches (evaluation pause, auto-approval force-off)
 *   - Platform Halt (last resort — two-operator approval + type-to-confirm)
 *
 * Phase C: every action routes through SensitiveActionDialog — explicit
 * reason, blast radius with what-stops / what-continues (the spec's
 * requirement), runbook, 2FA step-up. The nuclear set (Platform Halt,
 * Relay Pause, Flag kill-switch) is two-operator: 2FA *initiates* an
 * approval (CON-32) that a second operator must approve within 10 minutes
 * before it executes. Control state is persisted in the console store and
 * every transition is audit-logged (`console.operator_action`).
 *
 * Platform Halt is intentionally NOT disabled — protection here is
 * procedural (acknowledge → type HALT → 2FA → second operator), not a
 * greyed-out button.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import {
  useConsoleStore,
  setControl,
  type ControlKey,
} from "@/lib/platform/console-store";
import { toast } from "@/hooks/use-toast";
import {
  AlertOctagon,
  Power,
  Wrench,
  Zap,
} from "lucide-react";

interface ControlSpec {
  key: ControlKey;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  severity: "critical" | "high" | "medium";
  summary: string;
  whatStops: string[];
  whatContinues: string[];
  runbook: string;
  /** Two-operator approval required before execution (nuclear set). */
  twoOperator: boolean;
  /** Type-to-confirm phrase (highest tier only). */
  confirmPhrase?: string;
}

const CONTROLS: ControlSpec[] = [
  {
    key: "relay_pause",
    title: "Relay Pause",
    icon: Zap,
    severity: "high",
    summary: "Stops event relay processing platform-wide. Trading is unaffected.",
    whatStops: [
      "Event relay processing (deposits, withdrawals, status transitions)",
      "Downstream webhooks and integrations receiving platform events",
      "Automated payout and evaluation pipelines driven by relay events",
    ],
    whatContinues: [
      "Trading — orders, positions, and risk checks run normally",
      "Console and dashboard reads (data is fresh as of pause time)",
      "Market data feeds",
    ],
    runbook: "OPS-07 · relay backlog runbook",
    twoOperator: true,
  },
  {
    key: "flag_kill_switches",
    title: "Feature / Kill Switches",
    icon: Power,
    severity: "high",
    summary: "Force-disables risky feature flags fleet-wide (e.g. auto_payout, challenge_payouts).",
    whatStops: [
      "Flagged automation (auto payouts, auto-approval) across all tenants",
      "Any feature whose kill-switch flag is flipped off",
    ],
    whatContinues: [
      "Manual operations — staff can still process payouts by hand",
      "Trading and everything not behind the flagged feature",
    ],
    runbook: "OPS-09 · flag rollback of the offending release",
    twoOperator: true,
  },
  {
    key: "maintenance_mode",
    title: "Maintenance Mode",
    icon: Wrench,
    severity: "medium",
    summary: "Trading continues; new purchases, sign-ups, and upgrades are unavailable.",
    whatStops: [
      "New purchases, plan upgrades, and tenant sign-ups",
      "Non-essential writes (profile edits, notification prefs)",
    ],
    whatContinues: [
      "Trading and open positions",
      "Existing sessions and read access",
      "Payout processing (unless combined with a relay pause)",
    ],
    runbook: "OPS-03 · scheduled maintenance",
    twoOperator: false,
  },
  {
    key: "platform_halt",
    title: "Platform Halt",
    icon: AlertOctagon,
    severity: "critical",
    summary:
      "LAST RESORT — halts all trading across every tenant. Enormous blast radius; two-operator approval and type-to-confirm required.",
    whatStops: [
      "All trading across every tenant — no new orders, no closes via the platform",
      "Payouts, evaluations, and account transitions",
      "API access for all connected clients",
    ],
    whatContinues: [
      "Market data feeds (positions remain open at the broker)",
      "Console read access for incident response",
      "Out-of-band broker-side risk controls",
    ],
    runbook: "INC-01 · platform halt rung 3 · estimated blast radius $1.4M monthly volume",
    twoOperator: true,
    confirmPhrase: "HALT",
  },
];

interface PendingAction {
  spec: ControlSpec;
  operation: "engage" | "release";
}

export function EmergencyControlsPage() {
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
  const { controls } = useConsoleStore();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const operator = { id: user.id, name: user.name };

  const execute = async (spec: ControlSpec, operation: "engage" | "release", reason: string) => {
    const value = operation === "engage" ? "engaged" : "normal";
    setControl(
      spec.key,
      value,
      operator,
      `${operation === "engage" ? "Engaged" : "Released"} "${spec.title}" — reason: ${reason}`,
    );
    toast({
      title: operation === "engage" ? `${spec.title} engaged` : `${spec.title} released`,
      description: `2FA verified · recorded in the audit trail${spec.twoOperator ? " · two-operator approval satisfied" : ""}.`,
    });
  };

  const engage = (spec: ControlSpec, operation: "engage" | "release") => {
    setPending({ spec, operation });
  };

  /** Release needs a reason too (auditability), but no 2FA/approval tier. */
  const releaseDirect = (spec: ControlSpec) => {
    setPending({ spec, operation: "release" });
  };

  const activeCount = Object.values(controls).filter((c) => c !== "normal").length;

  return (
    <Page>
      <PageHeader
        title="Emergency Controls"
        description="Platform-wide break-glass controls. Every action states what stops, what continues, the runbook, and requires 2FA; the nuclear set additionally needs a second operator's approval within 10 minutes."
        icon={AlertOctagon}
        actions={
          <Badge variant={activeCount > 0 ? "destructive" : "outline"}>
            {activeCount > 0 ? `${activeCount} engaged` : "All normal"}
          </Badge>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading emergency controls…"
        >
        <div className="grid gap-4 lg:grid-cols-2">
          {CONTROLS.map((spec) => {
            const state = controls[spec.key];
            const engaged = state === "engaged";
            const pendingApproval = state === "pending_approval";
            const Icon = spec.icon;

            return (
              <Card
                key={spec.key}
                className={
                  engaged
                    ? "border-destructive/60 bg-destructive/5"
                    : pendingApproval
                      ? "border-amber-500/50"
                      : spec.severity === "critical"
                        ? "border-destructive/30"
                        : undefined
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${
                          engaged ? "text-destructive" : "text-muted-foreground"
                        }`}
                      />
                      <h3 className="text-sm font-semibold">{spec.title}</h3>
                      <Badge
                        variant={
                          spec.severity === "critical"
                            ? "destructive"
                            : spec.severity === "high"
                              ? "default"
                              : "secondary"
                        }
                        className="text-[9px]"
                      >
                        {spec.severity}
                      </Badge>
                      {spec.twoOperator ? (
                        <Badge variant="outline" className="text-[9px]">
                          2-operator
                        </Badge>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        engaged
                          ? "destructive"
                          : pendingApproval
                            ? "default"
                            : "secondary"
                      }
                    >
                      {engaged ? "ENGAGED" : pendingApproval ? "pending approval" : "normal"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{spec.summary}</p>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        What stops
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {spec.whatStops.map((l) => (
                          <li key={l} className="flex gap-1.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                        What continues
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {spec.whatContinues.map((l) => (
                          <li key={l} className="flex gap-1.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">{spec.runbook}</p>
                    {engaged ? (
                      <Button size="sm" variant="outline" onClick={() => releaseDirect(spec)}>
                        Release with note
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={spec.severity === "critical" ? "destructive" : "default"}
                        onClick={() => engage(spec, "engage")}
                        disabled={pendingApproval}
                      >
                        Engage
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Incident ladder (CON-15)</p>
          <p className="mt-1">
            Escalate in order: individual account actions → maintenance mode → relay pause /
            kill-switch → <span className="font-medium text-destructive">platform halt</span>.
            Each engagement is audit-logged (actor, reason, timestamp) and reversible with a
            release note. Platform Halt additionally requires type-to-confirm and a second
            operator&apos;s approval — see the Approval Center for the live queue.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Sensitive action dialog: reason → blast radius → 2FA → execute/initiate ── */}
      <SensitiveActionDialog
        open={pending !== null}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        actionKey={
          pending
            ? `control.${pending.spec.key}.${pending.operation}`
            : "control.unknown"
        }
        title={
          pending
            ? `${pending.operation === "engage" ? "Engage" : "Release"} ${pending.spec.title}`
            : ""
        }
        consequence={
          pending
            ? pending.operation === "engage"
              ? `Engaging ${pending.spec.title} takes effect platform-wide immediately after the approval (if any) is satisfied.`
              : `Releasing ${pending.spec.title} restores normal operation immediately after 2FA.`
            : ""
        }
        blastRadius={
          pending
            ? pending.operation === "engage"
              ? [
                  ...pending.spec.whatStops.map((l) => `Stops: ${l}`),
                  ...pending.spec.whatContinues.map((l) => `Continues: ${l}`),
                ]
              : [`Restores everything listed under "What stops" for ${pending.spec.title}.`]
            : undefined
        }
        confirmPhrase={pending?.operation === "engage" ? pending.spec.confirmPhrase : undefined}
        twoOperator={pending?.operation === "engage" ? pending.spec.twoOperator : false}
        requireReason
        detail={
          pending
            ? `${pending.spec.runbook} · reason recorded at execution`
            : undefined
        }
        onExecute={(reason) =>
          pending ? execute(pending.spec, pending.operation, reason) : undefined
        }
        onApprovalInitiated={(request) => {
          // Keep the dialog open on its "waiting for a second operator"
          // step — the toast is supplementary, not the feedback.
          toast({
            title: "Approval requested",
            description: `${request.actionLabel} — waiting for a second operator (10-min window).`,
          });
        }}
      />
    </Page>
  );
}
