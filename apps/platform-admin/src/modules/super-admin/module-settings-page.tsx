"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { Settings2, AlertTriangle, CheckCircle2, Clock, Activity, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ModuleParam {
  key: string;
  label: string;
  type: "text" | "number" | "toggle" | "select";
  defaultValue: string;
  value: string;
  options?: string[];
  description: string;
  scope: "global" | "tenant" | "module";
}

export function ModuleSettingsPage() {
  const allModules = moduleRegistry.getAll();
  const [selectedModuleId, setSelectedModuleId] = useState(allModules[0]?.manifest.id ?? "");
  const [params, setParams] = useState<ModuleParam[]>([
    { key: "max_daily_drawdown", label: "Max Daily Drawdown", type: "number", defaultValue: "5", value: "5", description: "Maximum daily drawdown percentage before trading halts.", scope: "tenant" },
    { key: "max_drawdown", label: "Max Drawdown", type: "number", defaultValue: "10", value: "10", description: "Absolute max drawdown before account suspension.", scope: "tenant" },
    { key: "leverage", label: "Default Leverage", type: "select", defaultValue: "100", value: "100", options: ["1", "10", "25", "50", "100", "200"], description: "Default leverage applied to new trading accounts.", scope: "tenant" },
    { key: "trading_enabled", label: "Trading Enabled", type: "toggle", defaultValue: "true", value: "true", description: "Enable or disable trading for this module.", scope: "module" },
    { key: "auto_approval_threshold", label: "Auto-Approval Threshold", type: "number", defaultValue: "1000", value: "1000", description: "Payouts below this amount are auto-approved.", scope: "global" },
    { key: "session_timeout", label: "Session Timeout (hours)", type: "number", defaultValue: "24", value: "24", description: "Inactive session expiration window.", scope: "global" },
  ]);

  const updateParam = (key: string, value: string) => {
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  };

  const selectedModule = allModules.find((m) => m.manifest.id === selectedModuleId);

  return (
    <Page>
      <PageHeader
        title="Module Settings"
        description={`Configure module parameters and tenant overrides for ${selectedModule?.manifest.name ?? "selected module"}.`}
        icon={Settings2}
      />
      <PageContent>
        {/* Module selector */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Select Module</span></CardHeader>
          <CardContent className="space-y-1">
            {allModules.map((m) => {
              const active = m.manifest.id === selectedModuleId;
              return (
                <button
                  key={m.manifest.id}
                  onClick={() => setSelectedModuleId(m.manifest.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted",
                  )}
                >
                  <span className="text-sm font-medium">{m.manifest.name}</span>
                  <Badge variant="outline" className="text-[9px]">{m.manifest.id}</Badge>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Parameter editor */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Parameter Overrides</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> Changes apply to current tenant
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {params.map((p) => (
                <div key={p.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <Label className="text-xs font-medium">{p.label}</Label>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.key}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">{p.scope}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{p.description}</p>
                  {p.type === "toggle" ? (
                    <Switch
                      checked={p.value === "true"}
                      onCheckedChange={(v) => updateParam(p.key, v ? "true" : "false")}
                    />
                  ) : p.type === "select" ? (
                    <Select value={p.value} onValueChange={(v) => updateParam(p.key, v)}>
                      <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {p.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-8 w-32 text-xs font-mono"
                      value={p.value}
                      onChange={(e) => updateParam(p.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => toast({ title: "Settings saved", description: "Module parameters updated." })}>Save Changes</Button>
                <Button size="sm" variant="outline" onClick={() => setParams((prev) => prev.map((p) => ({ ...p, value: p.defaultValue })))}>Reset to Defaults</Button>
              </div>
            </CardContent>
          </Card>

          {/* Scope info */}
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Override Scope</span></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground mb-1">
                  <SlidersHorizontal className="h-3 w-3" /> Override hierarchy
                </div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>· Module defaults (lowest priority)</li>
                  <li>· Global defaults (platform-wide)</li>
                  <li>· Tenant overrides (per-tenant)</li>
                  <li>· Module-level toggles (highest priority)</li>
                </ul>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Activity className="h-3 w-3" /> Current module status
                </div>
                <p className="mt-1 text-muted-foreground">{selectedModule?.manifest.name} is active and deployed. Parameter changes take effect on next tenant sync.</p>
              </div>
              <div className="rounded-md border bg-amber-50/20 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Clock className="h-3 w-3" /> Pending changes
                </div>
                <p className="mt-1">No pending changes. All parameters match their defaults.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
