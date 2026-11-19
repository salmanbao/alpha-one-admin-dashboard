"use client";

/**
 * Risk & Evaluation Engine — finding #8 (4 reviewer gaps):
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
import { useRiskParams, setRiskParams, DEFAULT_RISK_PARAMS, type TenantRiskParams } from "@/lib/platform/risk-defaults-store";
import { useRuleToggles, toggleRule as toggleRuleStore, type EngineRule } from "@/lib/platform/risk-engine-store";
import { useThresholds, applyThresholds as applyThresholdsStore, type Thresholds } from "@/lib/platform/risk-engine-store";
import { recordAudit } from "@/lib/platform/console-store";
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
  Clock,
  ArrowRight,
  SlidersHorizontal,
  RotateCcw,
  Zap,
} from "lucide-react";

const PARAM_FIELDS: { key: keyof TenantRiskParams; label: string; unit: string; min: number; max: number; step: string }[] = [
  { key: "dailyLoss", label: "Daily loss limit", unit: "%", min: 0.1, max: 20, step: "0.5" },
  { key: "maxDd", label: "Max drawdown", unit: "%", min: 1, max: 50, step: "0.5" },
  { key: "profitTarget", label: "Profit target", unit: "%", min: 0, max: 100, step: "0.5" },
  { key: "minDays", label: "Minimum trading days", unit: "d", min: 0, max: 60, step: "1" },
];

const DEFAULT_PARAMS = DEFAULT_RISK_PARAMS;

interface RiskRule {
  id: string;
  name: string;
  description: string;
  scope: "Global" | "Per-tenant" | "Beta";
  enabled: boolean;
  critical: boolean;
}

interface ThresholdFields {
  nearMiss: string;
  equityDrop: string;
  criticalDd: string;
  rapid: string;
}

const DEFAULT_THRESHOLDS: ThresholdFields = {
  nearMiss: "80",
  equityDrop: "3",
  criticalDd: "90",
  rapid: "1.5",
};

function validateRange(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

export function RiskEnginePage() {
  const { navigate, user } = usePlatform();
  const rosterTenants = useTenants();
  const appliedParams = useRiskParams();
  const appliedRules: EngineRule[] = useRuleToggles();
  const appliedThresholds: Thresholds = useThresholds();
  const [selectedTenant, setSelectedTenant] = useState(rosterTenants[0]?.id ?? "");
  const [draftParams, setDraftParams] = useState<Record<string, TenantRiskParams>>({});
  const [thresholdDraft, setThresholdDraft] = useState<ThresholdFields>(DEFAULT_THRESHOLDS);

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

  const thresholdsDirty = useMemo(() => {
    return Object.keys(DEFAULT_THRESHOLDS).some((k) => thresholdDraft[k as keyof ThresholdFields] !== appliedThresholds[k as keyof Thresholds]);
  }, [thresholdDraft, appliedThresholds]);

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
    setRiskParams(tenant.id, draft);
    recordAudit({
      actor: user?.name ?? "Console operator",
      action: "risk.params_applied",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: Object.keys(draft).map((k) => `${PARAM_FIELDS.find((f) => f.key === k)?.label}: ${draft[k]}`).join(" · "),
    });
    setDraftParams((prev) => {
      const next = { ...prev };
      delete next[tenant.id];
      return next;
    });
    toast({
      title: "Risk parameters applied",
      description: `${tenant.name} — ${Object.keys(draft).map((k) => `${PARAM_FIELDS.find((f) => f.key === k)?.label}: ${draft[k]}`).join(" · ")}. Saved to this tenant and used by new evaluations.`,
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
    toggleRuleStore(rule, enabled);
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
    const bad = Object.keys(DEFAULT_THRESHOLDS).some(
      (k) => !validateRange(thresholdDraft[k as keyof ThresholdFields], 1, 100)
    );
    if (bad) {
      toast({
        variant: "destructive",
        title: "Invalid threshold",
        description: "Please fix the invalid value before applying.",
      });
      return;
    }
    applyThresholdsStore(thresholdDraft as Thresholds);
    toast({
      title: "Breach thresholds applied",
      description: `Near-miss ${thresholdDraft.nearMiss}% · equity drop ${thresholdDraft.equityDrop}% · critical ${thresholdDraft.criticalDd}% · rapid ${thresholdDraft.rapid}%.`,
    });
    setThresholdDraft(DEFAULT_THRESHOLDS);
  };

  const isCustom = (id: string) => Boolean(appliedParams[id]);

  const breachEvents = useMemo(
    () => rosterTenants.reduce((s, t) => s + getTenantBreaches(t.id).length, 0),
    []
  );
  const enabledRules = appliedRules.filter((r) => r.enabled).length;
  const criticalOff = appliedRules.filter((r) => r.critical && !r.enabled).length;

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
            value={`${enabledRules} / ${appliedRules.length}`}
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
              {criticalOff} critical rule{criticalOff === 1 ? " is" : "s are"} disabled — the engine is not enforcing full coverage. Re-enable {criticalOff === 1 ? "it" : "them"} below.
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
                      {f.min}–{f.max}{f.unit}
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
                  <Button variant="default" size="sm" onClick={applyParams}>
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gap 2 — engine rule toggles */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Engine Rule Toggles</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable/disable real-time evaluation rules (consistency, copy-trade, news guard, etc.).
                  </p>
                </div>
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {appliedRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 py-2 border-b border-gray-200">
                  <Badge
                    variant={rule.critical ? "destructive" : "secondary"}
                    className="mr-2 h-4 w-4"
                  >
                    {rule.critical ? "CRIT" : ""}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {rule.scope}
                    </span>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => toggleRule(rule, enabled)}
                    className="h-4 w-6"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Gap 3 — dynamic breach thresholds */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Breach Thresholds</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Near-miss / equity-drop / critical / rapid drawdown levels — live and editable.
                  </p>
                </div>
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(DEFAULT_THRESHOLDS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label htmlFor={`thresh-${key}`}>{label.replace(/([A-Z])/g, " $1").trim()}</Label>
                      <Input
                        id={`thresh-${key}`}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={100}
                        step="0.1"
                        value={thresholdDraft[key as keyof ThresholdFields]}
                        onChange={(e) => setThresholdDraft({
                          ...thresholdDraft,
                          [key as keyof ThresholdFields]: e.target.value,
                        })}
                        className="h-9 tabular-nums"
                      />
                      <span className="w-4 text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="default" size="sm" onClick={applyThresholds}>
                  Apply Thresholds
                </Button>
                <Button variant="outline" size="sm" onClick={() => setThresholdDraft(DEFAULT_THRESHOLDS)}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}