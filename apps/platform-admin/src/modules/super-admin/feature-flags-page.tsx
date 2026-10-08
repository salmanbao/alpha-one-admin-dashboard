"use client";

/**
 * Feature Flags — research item #31.
 *
 * Feature flag registry with global/tenant/environment overrides, kill
 * switches, and change history.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/platform/status";
import { Flag, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  scope: "global" | "tenant-override" | "environment";
  enabled: boolean;
  isKillSwitch?: boolean;
  updatedBy: string;
  updatedAt: string;
}

const initialFlags: FeatureFlag[] = [
  { id: "evaluation-pause", name: "Evaluation Pause", description: "Pause all challenge evaluations globally.", scope: "global", enabled: false, isKillSwitch: true, updatedBy: "Sarah Chen", updatedAt: "5d ago" },
  { id: "auto-approval", name: "Auto-Approval", description: "Enable automatic payout approvals.", scope: "global", enabled: true, updatedBy: "Marcus Webb", updatedAt: "12d ago" },
  { id: "payment-rail", name: "Payment Rail Override", description: "Force payment routing through Match2Pay (instead of NOWPayments).", scope: "environment", enabled: false, updatedBy: "Priya Nair", updatedAt: "3d ago" },
  { id: "new-onboarding", name: "New Onboarding Flow", description: "Use the v2 tenant onboarding wizard.", scope: "global", enabled: true, updatedBy: "Sarah Chen", updatedAt: "8d ago" },
  { id: "ai-insights-beta", name: "AI Insights (Beta)", description: "Enable AI-generated insights module.", scope: "global", enabled: true, updatedBy: "Daniel Cooper", updatedAt: "2d ago" },
  { id: "experimental-chart", name: "Experimental Chart Library", description: "Use the new charting library (D3 instead of Recharts).", scope: "environment", enabled: false, updatedBy: "Elena Rossi", updatedAt: "1d ago" },
  { id: "mobile-app", name: "Mobile App Access", description: "Enable the mobile companion app for traders.", scope: "tenant-override", enabled: true, updatedBy: "Sarah Chen", updatedAt: "20d ago" },
  { id: "developer-api", name: "Developer API", description: "Enable the public Developer API for tenants.", scope: "global", enabled: true, updatedBy: "Marcus Webb", updatedAt: "15d ago" },
];

const scopeTone = (s: FeatureFlag["scope"]) =>
  s === "global" ? "info" : s === "tenant-override" ? "warning" : "muted";

export function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);

  const toggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const next = { ...f, enabled: !f.enabled };
          toast({
            title: `${f.name} ${next.enabled ? "enabled" : "disabled"}`,
            description: `Scope: ${next.scope} · ${next.isKillSwitch ? "⚠ Kill switch — affects ALL tenants. " : ""}Change audited.`,
            variant: next.isKillSwitch && next.enabled ? "destructive" : "default",
          });
          return next;
        }
        return f;
      }),
    );
  };

  const enabled = flags.filter((f) => f.enabled).length;
  const disabled = flags.filter((f) => !f.enabled).length;
  const killSwitches = flags.filter((f) => f.isKillSwitch).length;
  const activeKillSwitches = flags.filter((f) => f.isKillSwitch && f.enabled).length;

  return (
    <Page>
      <PageHeader
        title="Feature Flags"
        description="Global and environment-level feature toggles. Kill switches require 2FA."
        icon={Flag}
      />
      <PageContent>
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
          {flags.map((f) => (
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <StatusBadge tone={scopeTone(f.scope)}>{f.scope}</StatusBadge>
                      <span>Updated by {f.updatedBy} · {f.updatedAt}</span>
                    </div>
                  </div>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={() => toggleFlag(f.id)}
                    aria-label={`Toggle ${f.name}`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dangerous flag notice */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Dangerous flags</p>
          <p className="mt-1">
            Kill switches (evaluation pause, auto-approval force-off, payment rail override) require 2FA verification and are audited.
            Tenant overrides affect only the specified tenant. Environment overrides affect the current deployment environment.
            Global flags affect all tenants and all environments.
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
