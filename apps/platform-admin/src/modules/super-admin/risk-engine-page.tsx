"use client";

/**
 * Risk & Evaluation Engine — finding #8 (4 reviewer gaps):
 *
 *   1. Per-tenant risk parameters — custom daily loss %, max drawdown %,
 *      profit target % and minimum days per tenant prop firm.
 *   2. Engine rule toggles — direct configuration of the real-time
 *      evaluation rules (consistency, copy-trade, news guard, …).
 *   3. Dynamic breach thresholds — near-miss / equity-drop / critical
 *      levels editable and applied live.
 *   4. Status metrics — evaluations, breach events, enabled rules and
 *      decision latency as first-class MetricCards.
 *
 * Deterministic fixtures — no Math.random; every apply is toasted and
 * the header links to the audit log where the change would land.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantBreaches } from "@/lib/platform/mock-data";
import { useTenants } from "@/lib/platform/tenant-store";
import { recordAudit } from "@/lib/platform/console-store";
import {
  useRiskParams,
  setRiskParams,
  DEFAULT_RISK_PARAMS,
  type TenantRiskParams,
} from "@/lib/platform/risk-defaults-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Gauge,
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Save,
  Zap,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & deterministic fixtures                                      */
/* ------------------------------------------------------------------ */

// TenantRiskParams / DEFAULT_RISK_PARAMS live in risk-defaults-store —
// the same persisted values the go-live wizard's "Risk defaults" step
// writes (R2-W3-04).

const PARAM_FIELDS: { key: keyof TenantRiskParams; label: string; unit: string; min: number; max: number; step: string }[] = [
  { key: "dailyLoss", label: "Daily loss limit", unit: "%", min: 0.1, max: 20, step: "0.5" },
  { key: "maxDd", label: "Max drawdown", unit: "%", min: 1, max: 50, step: "0.5" },
  { key: "profitTarget", label: "Profit target", unit: "%", min: 0, max: 100, step: "0.5" },
  { key: "minDays", label: "Minimum trading days", unit: "d", min: 0, max: 60, step: "1" },
];

const DEFAULT_PARAMS = DEFAULT_RISK_PARAMS;

interface EngineRule {
  id: string;
  name: string;
  description: string;
  scope: "Global" | "Per-tenant" | "Beta";
  enabled: boolean;
  critical: boolean;
}

const ENGINE_RULES: EngineRule[] = [
  { id: "intraday-dd", name: "Intraday drawdown enforcement", description: "Breaches the daily loss limit while the session is still open.", scope: "Global", enabled: true, critical: true },
  { id: "consistency", name: "Consistency rule (30%)", description: "No single trading day may contribute more than 30% of total profit.", scope: "Global", enabled: true, critical: false },
  { id: "news-guard", name: "News-event position check", description: "Blocks new entries within ±2 minutes of tier-1 releases.", scope: "Global", enabled: true, critical: false },
  { id: "copy-detect", name: "Copy-trade detection", description: "Flags mirror execution across account clusters for review.", scope: "Global", enabled: true, critical: true },
  { id: "weekend-hold", name: "Weekend holding guard", description: "Restricts overnight and weekend exposure on challenge accounts.", scope: "Per-tenant", enabled: false, critical: false },
  { id: "ai-anomaly", name: "AI anomaly surveillance", description: "Scores tick-level anomalies and routes them to manual review.", scope: "Beta", enabled: false, critical: false },
];

interface Thresholds {
  nearMiss: string;
  equityDrop: string;
  criticalDd: string;
  rapid: string;
}

const THRESHOLD_FIELDS: { key: keyof Thresholds; label: string; hint: string; min: number; max: number; step: string }[] = [
  { key: "nearMiss", label: "Near-miss warning", hint: "% of daily limit consumed", min: 1, max: 100, step: "1" },
  { key: "equityDrop", label: "Equity drop alert", hint: "% equity lost within 5 minutes", min: 0.1, max: 20, step: "0.1" },
  { key: "criticalDd", label: "Critical drawdown", hint: "% of max DD before auto-breach", min: 1, max: 100, step: "1" },
  { key: "rapid", label: "Rapid drawdown trigger", hint: "% lost within 60 seconds", min: 0.1, max: 10, step: "0.1" },
];

const DEFAULT_THRESHOLDS: Thresholds = {
  nearMiss: "80",
  equityDrop: "3",
  criticalDd: "90",
  rapid: "1.5",
};

function validateRange(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function RiskEnginePage() {
  const { navigate, user } = usePlatform();

  // Live roster — store-backed, so tenants created by the go-live wizard
  // show up here — and the persisted parameter overrides they share with
  // the wizard's "Risk defaults" step (R2-W3-04).
  const rosterTenants = useTenants();
  const appliedParams = useRiskParams();

  // Gap 1 — per-tenant risk parameters (applied overrides on defaults).
  const [draftParams, setDraftParams] = useState<Record<string, TenantRiskParams>>({});
  const [selectedTenant, setSelectedTenant] = useState(rosterTenants[0]?.id ?? "");

  // Gap 2 — engine rule toggles.
  const [rules, setRules] = useState<EngineRule[]>(ENGINE_RULES);

  // Gap 3 — dynamic breach thresholds.
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [thresholdDraft, setThresholdDraft] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const tenant = rosterTenants.find((t) => t.id === selectedTenant) ?? rosterTenants[0];
  const effectiveParams = (id: string): TenantRiskParams =>
    draftParams[id] ?? appliedParams[id] ?? DEFAULT_PARAMS;

  const paramsDirty = useMemo(() => {
    if (!tenant) return false;
    const draft = draftParams[tenant.id];
    if (!draft) return false;
    const base = appliedParams[tenant.id] ?? DEFAULT_PARAMS;
    return (Object.keys(base) as (keyof TenantRiskParams)[]).some((k) => draft[k] !== base[k]);
  }, [tenant, draftParams, appliedParams]);

  const thresholdsDirty = useMemo(
    () =>
      (Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]).some(
        (k) => thresholdDraft[k] !== thresholds[k],
      ),
    [thresholdDraft, thresholds],
  );

  // Gap 4 — status metrics.
  const breachEvents = useMemo(
    () => rosterTenants.reduce((s, t) => s + getTenantBreaches(t.id).length, 0),
    [],
  );
  const enabledRules = rules.filter((r) => r.enabled).length;
  const criticalOff = rules.filter((r) => r.critical && !r.enabled).length;

  const editParam = (key: keyof TenantRiskParams, value: string) => {
    if (!tenant) return;
    setDraftParams((prev) => ({
      ...prev,
      [tenant.id]: { ...(prev[tenant.id] ?? appliedParams[tenant.id] ?? DEFAULT_PARAMS), [key]: value },
    }));
  };

  const applyParams = () => {
    if (!tenant) return;
    const draft = draftParams[tenant.id];
    if (!draft) return;
    const bad = PARAM_FIELDS.find((f) => !validateRange(draft[f.key], f.min, f.max));
    if (bad) {
      toast({
        variant: "destructive",
        title: "Invalid risk parameter",
        description: `${bad.label} must be between ${bad.min}${bad.unit} and ${bad.max}${bad.unit}.`,
      });
      return;
    }
    const base = appliedParams[tenant.id] ?? DEFAULT_PARAMS;
    const changed = (Object.keys(base) as (keyof TenantRiskParams)[])
      .filter((k) => draft[k] !== base[k])
      .map((k) => `${PARAM_FIELDS.find((f) => f.key === k)?.label}: ${base[k]} → ${draft[k]}`);
    if (changed.length === 0) {
      setDraftParams((prev) => {
        const next = { ...prev };
        delete next[tenant.id];
        return next;
      });
      return;
    }
    setRiskParams(tenant.id, draft);
    recordAudit({
      actor: user?.name ?? "Console operator",
      action: "risk.params_applied",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: changed.join(" · "),
    });
    setDraftParams((prev) => {
      const next = { ...prev };
      delete next[tenant.id];
      return next;
    });
    toast({
      title: "Risk parameters applied",
      description: `${tenant.name} — ${changed.join(" · ")}. Saved to this tenant and used by new evaluations.`,
    });
  };

  const discardParams = () => {
    if (!tenant) return;
    setDraftParams((prev) => {
      const next = { ...prev };
      delete next[tenant.id];
      return next;
    });
  };

  const toggleRule = (rule: EngineRule, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
    recordAudit({
      actor: user?.name ?? "Console operator",
      action: enabled ? "risk.rule_enabled" : "risk.rule_disabled",
      target: rule.name,
      severity: rule.critical && !enabled ? "warning" : "info",
      detail: `${rule.scope} scope · applies from the next evaluation cycle`,
    });
    if (!enabled && rule.critical) {
      toast({
        variant: "destructive",
        title: "Critical rule disabled",
        description: `${rule.name} is off — breaches it normally catch will slip through until it's re-enabled.`,
      });
    } else {
      toast({
        title: enabled ? "Rule enabled" : "Rule disabled",
        description: `${rule.name} · ${rule.scope} scope · applies from the next evaluation cycle.`,
      });
    }
  };

  const applyThresholds = () => {
    const bad = THRESHOLD_FIELDS.find((f) => !validateRange(thresholdDraft[f.key], f.min, f.max));
    if (bad) {
      toast({
        variant: "destructive",
        title: "Invalid threshold",
        description: `${bad.label} must be between ${bad.min} and ${bad.max}.`,
      });
      return;
    }
    setThresholds(thresholdDraft);
    recordAudit({
      actor: user?.name ?? "Console operator",
      action: "risk.thresholds_applied",
      target: "breach thresholds",
      severity: "info",
      detail: `near-miss ${thresholdDraft.nearMiss}% · equity drop ${thresholdDraft.equityDrop}% · critical ${thresholdDraft.criticalDd}% · rapid ${thresholdDraft.rapid}%`,
    });
    toast({
      title: "Breach thresholds applied (demo)",
      description: "Near-miss, equity-drop, critical and rapid-drawdown levels updated for every tenant.",
    });
  };

  const isCustom = (id: string) => Boolean(appliedParams[id]);

  return (
    <Page>
      <PageHeader
        title="Risk & Evaluation Engine"
        description="Configure per-tenant risk parameters, the real-time evaluation rules, and dynamic breach thresholds — with live engine status."
        icon={Gauge}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("audit-log")}>
            <Activity className="mr-1.5 h-4 w-4" /> Audit Log
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      />
      <PageContent>
        {/* Gap 4 — real-time engine status metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Evaluations (24h)" value={formatCompact(184392)} delta={7} icon={Zap} tone="positive" />
          <MetricCard label="Breach Events (24h)" value={formatCompact(breachEvents)} delta={-3} icon={ShieldAlert} tone={breachEvents > 0 ? "negative" : "positive"} />
          <MetricCard
            label="Engine Rules Enabled"
            value={`${enabledRules} / ${rules.length}`}
            delta={0}
            icon={CheckCircle2}
            tone={criticalOff > 0 ? "negative" : "positive"}
          />
          <MetricCard label="Median Decision Latency" value="38 ms" delta={-5} icon={Clock} tone="positive" />
        </div>

        {criticalOff > 0 && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {criticalOff} critical rule{criticalOff === 1 ? " is" : "s are"} disabled —
              the engine is not enforcing full coverage. Re-enable {criticalOff === 1 ? "it" : "them"} below.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Gap 1 — per-tenant risk parameters */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Per-Tenant Risk Parameters</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Custom drawdown, profit target and minimum days per prop firm.
                  </p>
                </div>
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="risk-tenant">Tenant prop firm</Label>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger id="risk-tenant" aria-label="Tenant prop firm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rosterTenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          {t.name}
                          {isCustom(t.id) && (
                            <Badge variant="outline" className="text-[9px]">custom</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PARAM_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`param-${f.key}`}>{f.label}</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id={`param-${f.key}`}
                        type="number"
                        inputMode="decimal"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={tenant ? effectiveParams(tenant.id)[f.key] : ""}
                        onChange={(e) => editParam(f.key, e.target.value)}
                        className="h-9 tabular-nums"
                      />
                      <span className="w-4 text-xs text-muted-foreground">{f.unit}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {f.min}–{f.max}
                      {f.unit}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <StatusBadge tone={isCustom(tenant?.id ?? "") ? "info" : "muted"}>
                  {isCustom(tenant?.id ?? "") ? "Custom parameters" : "Platform default"}
                </StatusBadge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!paramsDirty} onClick={discardParams}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard
                  </Button>
                  <Button size="sm" disabled={!paramsDirty} onClick={applyParams}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gap 3 — dynamic breach thresholds */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Dynamic Breach Thresholds</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Adjust alert and auto-breach levels live — applied on the next evaluation cycle.
                  </p>
                </div>
                <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {THRESHOLD_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`thr-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`thr-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={thresholdDraft[f.key]}
                      onChange={(e) =>
                        setThresholdDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="h-9 tabular-nums"
                    />
                    <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Currently applied</p>
                <p className="mt-1 font-mono text-[11px]">
                  near-miss {thresholds.nearMiss}% · equity drop {thresholds.equityDrop}% ·
                  critical {thresholds.criticalDd}% · rapid {thresholds.rapid}%
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <StatusBadge tone={thresholdsDirty ? "warning" : "success"}>
                  {thresholdsDirty ? "Unsaved changes" : "In sync"}
                </StatusBadge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!thresholdsDirty}
                    onClick={() => setThresholdDraft(thresholds)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard
                  </Button>
                  <Button size="sm" disabled={!thresholdsDirty} onClick={applyThresholds}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Apply thresholds
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gap 2 — engine rule toggles */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Evaluation Engine Rules</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct configuration of the real-time rules the engine enforces — each toggle
                  takes effect from the next evaluation cycle.
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {enabledRules} / {rules.length} enabled
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <Badge variant="outline" className="text-[9px]">{rule.scope}</Badge>
                      {rule.critical && (
                        <Badge variant="outline" className="border-rose-400/60 text-[9px] text-rose-600 dark:text-rose-400">
                          critical
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={rule.enabled ? "success" : "muted"}>
                      {rule.enabled ? "On" : "Off"}
                    </StatusBadge>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => toggleRule(rule, checked)}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <p className="text-[11px] text-muted-foreground">
              Rule changes and parameter applies are written to the platform audit log —
              open it from the header to review the full history.
            </p>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
