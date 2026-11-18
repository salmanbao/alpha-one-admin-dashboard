"use client";

/**
 * Feature Flags — research item #31 + R9 W6 UC-P1.
 *
 * Registry of global/tenant/environment toggles, kill switches (2FA) and
 * change history. Since I11 every flip runs through
 * `lib/platform/feature-flags-store`: the change persists under
 * `pfaas:platform-admin:feature-flags`, writes a Platform Audit Log row
 * and emits a lifecycle event — the "Change history" panel below is the
 * named consumer of those events (it projects `kind === "flag"` rows out
 * of the shared log), so a toast is feedback, never the record.
 *
 * UC-P1 — before any flip the confirm dialog shows the blast radius
 * computed from the tenant-store ("affects N tenants · M accounts") and
 * lists the affected tenants; global flags stage the rollout 0 → 25 →
 * 50 → 100 % with a per-stage audit and an auto-rollback criterion the
 * operator states at flip time.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/platform/status";
import {
  Flag,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  History,
  Rocket,
  Undo2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { useLifecycleLog } from "@pfaas/lifecycle";
import {
  useFeatureFlags,
  blastRadiusFor,
  setFlagEnabled,
  advanceRollout,
  rollbackRollout,
  setRolloutCriterion,
  ROLLOUT_STAGES,
  type RolloutStage,
} from "@/lib/platform/feature-flags-store";

const scopeTone = (s: string) =>
  s === "global" ? "info" : s === "tenant-override" ? "warning" : "muted";

type DialogMode = "flip" | "stage" | "rollback" | "criterion";

interface ConfirmState {
  flagId: string;
  mode: DialogMode;
  /** Target stage for `stage` mode. */
  stage?: RolloutStage;
}

/* ------------------------------------------------------------------ */
/* Change history — named consumer of the flag lifecycle events        */
/* ------------------------------------------------------------------ */

function historyLine(e: { name: string; payload: Record<string, unknown>; at: string; actor: string }): string {
  const p = e.payload;
  if (e.name === "feature-flag.rollout-stage")
    return `Rollout ${String(p.from)}% → ${String(p.to)}% · affects ${String(p.affectedTenants)} tenant(s)`;
  if (e.name === "feature-flag.rollout-rollback")
    return `Rolled back ${String(p.from)}% → ${String(p.to)}%${p.reason ? ` · ${String(p.reason)}` : ""}`;
  if (p.change === "criterion") return `Rollback criterion updated → "${String(p.criterion)}"`;
  return `${p.enabled ? "Enabled" : "Disabled"}${p.stage != null && p.enabled ? ` · rollout ${String(p.stage)}%` : ""} · affects ${String(p.affectedTenants)} tenant(s), ${String(p.affectedAccounts)} account(s)`;
}

function ChangeHistory({ events }: { events: ReturnType<typeof useLifecycleLog> }) {
  const rows = events.filter((e) => e.entity.kind === "flag").slice(-8).reverse();
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Change history</p>
            <p className="text-[11px] text-muted-foreground">
              Every flip, stage advance and rollback — projected from the shared lifecycle log
              (the named consumer of <code>feature-flag.*</code> events) plus the Platform Audit
              Log row.
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No flag changes recorded yet — flip a flag to see the trail here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{historyLine(e)}</p>
                  <p className="text-muted-foreground">
                    {e.name} · by {e.actor} · entity <code>{e.entity.id}</code>
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function FeatureFlagsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the persisted
  // store below is authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const flags = useFeatureFlags();
  const events = useLifecycleLog();
  const { user } = usePlatform();
  const actor = user?.name ?? "Platform operator";

  const [pendingKillSwitchId, setPendingKillSwitchId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [stageDraft, setStageDraft] = useState<RolloutStage>(100);
  const [criterionDraft, setCriterionDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [tenantDraft, setTenantDraft] = useState<string[]>([]);

  const flag = confirm ? flags.find((f) => f.id === confirm.flagId) ?? null : null;
  const radius = flag ? blastRadiusFor(flag, confirm?.mode === "flip" && flag.scope === "tenant-override" ? tenantDraft : undefined) : null;

  const openConfirm = (f: (typeof flags)[number], mode: DialogMode, stage?: RolloutStage) => {
    setStageDraft(stage ?? nextStage(f));
    setCriterionDraft(f.rollout?.criterion ?? "");
    setReasonDraft("");
    if (f.scope === "tenant-override") {
      setTenantDraft(
        f.enabled
          ? blastRadiusFor(f).tenants.map((t) => t.id)
          : [],
      );
    }
    setConfirm({ flagId: f.id, mode, stage });
  };

  const closeConfirm = () => setConfirm(null);

  const submitConfirm = () => {
    if (!flag || !confirm) return;
    const reason = reasonDraft.trim();
    if (confirm.mode === "rollback" && !reason) {
      toast({
        title: "Reason required",
        description: "A rollback must say why it was pulled back.",
        variant: "destructive",
      });
      return;
    }
    if (confirm.mode === "flip") {
      const stage = flag.scope === "global" ? stageDraft : 100;
      setFlagEnabled(flag.id, !flag.enabled, {
        actor,
        stage,
        criterion: criterionDraft,
        reason,
        tenantIds: tenantDraft,
      });
      toast({
        title: `${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`,
        description: `Affects ${radius?.tenants.length ?? 0} tenant(s) · ${radius?.accounts ?? 0} account(s)${flag.scope === "global" ? ` · rollout ${stage}%` : ""}. Persisted + audited (Demo).`,
        variant: flag.isKillSwitch && !flag.enabled ? "destructive" : "default",
      });
    } else if (confirm.mode === "stage" && confirm.stage != null) {
      advanceRollout(flag.id, confirm.stage, { actor, criterion: criterionDraft, reason });
      toast({
        title: `Rollout advanced to ${confirm.stage}%`,
        description: `Affects ${radius?.tenants.length ?? 0} tenant(s) · ${radius?.accounts ?? 0} account(s). Stage audited (Demo).`,
      });
    } else if (confirm.mode === "rollback") {
      rollbackRollout(flag.id, { actor, reason });
      toast({
        title: "Rollout rolled back",
        description: reason,
        variant: "destructive",
      });
    } else if (confirm.mode === "criterion") {
      setRolloutCriterion(flag.id, criterionDraft, { actor });
      toast({ title: "Rollback criterion saved", description: criterionDraft || "Cleared." });
    }
    closeConfirm();
  };

  const handleKillSwitchExecute = async (reason: string) => {
    const target = flags.find((f) => f.id === pendingKillSwitchId);
    if (!target) return;
    const r = blastRadiusFor(target);
    setFlagEnabled(target.id, !target.enabled, { actor, reason, stage: 100 });
    toast({
      title: `${target.name} ${!target.enabled ? "enabled" : "disabled"}`,
      description: `Kill switch — affects ${r.tenants.length} tenant(s), ${r.accounts} account(s). 2FA + audit recorded (Demo).`,
      variant: !target.enabled ? "destructive" : "default",
    });
    setPendingKillSwitchId(null);
  };

  const disabled = flags.filter((f) => !f.enabled).length;
  const killSwitches = flags.filter((f) => f.isKillSwitch).length;
  const activeKillSwitches = flags.filter((f) => f.isKillSwitch && f.enabled).length;
  const enabled = flags.filter((f) => f.enabled).length;

  return (
    <Page>
      <PageHeader
        title="Feature Flags"
        description="Global and environment-level feature toggles. Kill switches require 2FA; every change persists and is audited."
        icon={Flag}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading feature flags…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Flags" value={flags.length} icon={Flag} />
          <MetricCard label="Enabled" value={enabled} icon={ToggleRight} tone="positive" />
          <MetricCard label="Disabled" value={disabled} icon={ToggleLeft} />
          <MetricCard label="Active Kill Switches" value={activeKillSwitches} icon={AlertTriangle} tone={activeKillSwitches > 0 ? "negative" : "positive"} />
        </div>

        {activeKillSwitches > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 p-3 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              {activeKillSwitches} kill switch{activeKillSwitches === 1 ? "" : "es"} active — platform-wide impact.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {flags.map((f) => {
            const r = blastRadiusFor(f);
            const next = nextStage(f);
            return (
            <Card key={f.id} className={cn(f.isKillSwitch && f.enabled && "border-rose-500/40 ring-1 ring-rose-500/20")}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {f.enabled ? (
                        <ToggleRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold">{f.name}</span>
                      {f.isKillSwitch && (
                        <Badge variant="outline" className="border-rose-500/30 text-[9px] text-rose-700 dark:text-rose-400">
                          KILL SWITCH
                        </Badge>
                      )}
                      {f.rollout && (
                        <Badge variant="outline" className="text-[9px]">
                          ROLLOUT {f.rollout.stage}%
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>

                    {/* UC-P1 — blast radius, computed before the flip */}
                    <p className="mt-1.5 text-[11px] font-medium text-foreground/80">
                      Affects {r.tenants.length} tenant{r.tenants.length === 1 ? "" : "s"} · {r.accounts.toLocaleString()} account{r.accounts === 1 ? "" : "s"}
                    </p>

                    {f.rollout && (
                      <div className="mt-1.5 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Rocket className="h-3 w-3" aria-hidden />
                          <span>
                            Rollout {f.rollout.stage}% of {r.tenants.length} tenant(s)
                          </span>
                        </div>
                        <p className="mt-1">
                          Auto-rollback if: <span className="text-foreground/80">{f.rollout.criterion}</span>
                        </p>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <StatusBadge tone={scopeTone(f.scope)}>{f.scope}</StatusBadge>
                      <span>Updated by {f.updatedBy} · {new Date(f.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={() =>
                      f.isKillSwitch
                        ? setPendingKillSwitchId(f.id)
                        : openConfirm(f, "flip")
                    }
                    aria-label={`Toggle ${f.name}`}
                  />
                </div>

                {/* UC-P1 — staged rollout controls */}
                {f.rollout && f.enabled && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ROLLOUT_STAGES.filter((p) => p > f.rollout!.stage).map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => openConfirm(f, "stage", p)}
                      >
                        Advance to {p}%
                      </Button>
                    ))}
                    {f.rollout.stage > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] text-destructive"
                        onClick={() => openConfirm(f, "rollback")}
                      >
                        <Undo2 className="mr-1 h-3 w-3" />
                        Roll back
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => openConfirm(f, "criterion")}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Criterion
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Dangerous flag notice */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Dangerous flags</p>
          <p className="mt-1">
            Kill switches (evaluation pause, auto-approval force-off, payment rail override) require 2FA verification and are audited.
            Tenant overrides affect only the selected tenants. Environment overrides affect the current deployment environment.
            Global flags affect all tenants and all environments — staged 0/25/50/100 % with an auto-rollback criterion (Demo).
          </p>
        </div>

        <ChangeHistory events={events} />
        </PageAsyncBoundary>
      </PageContent>

      {/* ----- Confirm dialog: blast radius + tenant list (+ stage) ----- */}
      {flag && radius && (
        <Dialog open onOpenChange={(o) => { if (!o) closeConfirm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {confirm?.mode === "flip"
                  ? `${flag.enabled ? "Disable" : "Enable"} ${flag.name}`
                  : confirm?.mode === "stage"
                    ? `Advance rollout — ${flag.name}`
                    : confirm?.mode === "rollback"
                      ? `Roll back ${flag.name}`
                      : `Rollback criterion — ${flag.name}`}
              </DialogTitle>
              <DialogDescription>
                {confirm?.mode === "flip"
                  ? flag.enabled
                    ? "Turning this off takes effect for every tenant listed below."
                    : "Turning this on takes effect for every tenant listed below."
                  : confirm?.mode === "stage"
                    ? `Move the staged rollout to ${stageDraft}% of tenants.`
                    : confirm?.mode === "rollback"
                      ? "Pull the rollout back one stage — the reason is recorded in the audit trail."
                      : "State the condition that makes this rollout pull back automatically (Demo policy: recorded, not auto-enforced)."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Blast radius — computed from the tenant-store */}
              <div className="rounded-md border bg-muted/40 p-3 text-xs">
                <p className="font-semibold">
                  Affects {radius.tenants.length} tenant{radius.tenants.length === 1 ? "" : "s"} · {radius.accounts.toLocaleString()} account{radius.accounts === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Scope {flag.scope} · computed from the tenant store before the change.
                </p>
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                  {radius.tenants.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      <Badge variant="outline" className="text-[9px]">{t.plan}</Badge>
                    </li>
                  ))}
                  {radius.tenants.length > 8 && (
                    <li className="text-muted-foreground">+{radius.tenants.length - 8} more tenant(s)</li>
                  )}
                  {radius.tenants.length === 0 && (
                    <li className="text-muted-foreground">
                      No tenant carries this override yet — pick tenants below.
                    </li>
                  )}
                </ul>
              </div>

              {/* tenant-override: pick who carries it */}
              {confirm?.mode === "flip" && flag.scope === "tenant-override" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tenants carrying this override</Label>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                    {blastRadiusFor({ id: flag.id, scope: "global" }).tenants.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={tenantDraft.includes(t.id)}
                          onCheckedChange={(v) =>
                            setTenantDraft((prev) =>
                              v ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                            )
                          }
                        />
                        <span>{t.name}</span>
                        <span className="ml-auto text-muted-foreground">{t.plan}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* global: staged rollout target */}
              {confirm?.mode === "flip" && flag.enabled === false && flag.scope === "global" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Staged rollout (0 / 25 / 50 / 100 % of tenants)</Label>
                  <div className="flex gap-1.5">
                    {ROLLOUT_STAGES.map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={stageDraft === p ? "default" : "outline"}
                        className="h-7 flex-1 text-[11px]"
                        onClick={() => setStageDraft(p)}
                      >
                        {p}%
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {confirm?.mode === "stage" && (
                <div className="flex gap-1.5">
                  {ROLLOUT_STAGES.filter((p) => p > flag.rollout!.stage).map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={stageDraft === p ? "default" : "outline"}
                      className="h-7 flex-1 text-[11px]"
                      onClick={() => setStageDraft(p)}
                    >
                      {p}%
                    </Button>
                  ))}
                </div>
              )}

              {(confirm?.mode === "criterion" ||
                (confirm?.mode === "stage" && flag.scope === "global") ||
                (confirm?.mode === "flip" && flag.enabled === false && flag.scope === "global")) && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="rollback-criterion">
                    Auto-rollback criterion
                  </Label>
                  <Textarea
                    id="rollback-criterion"
                    value={criterionDraft}
                    onChange={(e) => setCriterionDraft(e.target.value)}
                    placeholder="e.g. error rate above 1% for 5 minutes, or checkout conversion drops 10%"
                    className="min-h-[56px] text-xs"
                  />
                </div>
              )}

              {(confirm?.mode === "rollback" || confirm?.mode === "stage") && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="flag-reason">
                    Reason {confirm.mode === "rollback" ? "(required)" : "(optional)"}
                  </Label>
                  <Textarea
                    id="flag-reason"
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    placeholder={confirm.mode === "rollback" ? "Why is this being pulled back?" : "Why advance now?"}
                    className="min-h-[56px] text-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeConfirm}>Cancel</Button>
              <Button onClick={submitConfirm}>
                {confirm?.mode === "flip"
                  ? flag.enabled
                    ? "Disable flag"
                    : flag.scope === "global"
                      ? `Enable at ${stageDraft}%`
                      : "Enable flag"
                  : confirm?.mode === "stage"
                    ? `Advance to ${stageDraft}%`
                    : confirm?.mode === "rollback"
                      ? "Roll back"
                      : "Save criterion"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Kill switch 2FA gate — blast radius listed from the tenant store */}
      <SensitiveActionDialog
        open={pendingKillSwitchId !== null}
        onOpenChange={(o) => { if (!o) setPendingKillSwitchId(null); }}
        actionKey={pendingKillSwitchId ? `kill-switch-${pendingKillSwitchId}` : "kill-switch"}
        title="Kill switch toggle"
        consequence="Kill switches affect ALL tenants and environments. Confirm this action requires 2FA verification."
        blastRadius={(() => {
          const target = flags.find((f) => f.id === pendingKillSwitchId);
          if (!target) return ["All production services", "All active user sessions", "Global platform state"];
          const r = blastRadiusFor(target);
          return [
            `${r.tenants.length} tenant(s) · ${r.accounts.toLocaleString()} account(s)`,
            ...r.tenants.slice(0, 5).map((t) => `${t.name} (${t.plan})`),
            ...(r.tenants.length > 5 ? [`+${r.tenants.length - 5} more tenant(s)`] : []),
          ];
        })()}
        confirmPhrase="Enable 2FA"
        requireReason
        onExecute={handleKillSwitchExecute}
      />
    </Page>
  );
}

/** Next staged-rollout step above the flag's current stage. */
function nextStage(f: { rollout?: { stage: RolloutStage } }): RolloutStage {
  if (!f.rollout) return 100;
  return ROLLOUT_STAGES.find((p) => p > f.rollout!.stage) ?? 100;
}
