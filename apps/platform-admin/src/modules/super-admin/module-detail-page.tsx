"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { ExternalLink, GitBranch, Shield, AlertTriangle, CheckCircle2, Clock, AlertCircle, Activity, BarChart3 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { createElement } from "react";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ModuleVersion {
  version: string;
  status: "stable" | "beta" | "deprecated";
  deployed: string;
  tenants: number;
}

const moduleVersions: ModuleVersion[] = [
  { version: "v4.19.2", status: "stable", deployed: "3h ago", tenants: 7 },
  { version: "v4.18.0", status: "stable", deployed: "2d ago", tenants: 7 },
  { version: "v4.17.3", status: "deprecated", deployed: "1w ago", tenants: 0 },
];

export function ModuleDetailPage() {
  const allModules = moduleRegistry.getAll();
  const [selectedModule, setSelectedModule] = useState<typeof allModules[0] | null>(null);
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [fleetDisabled, setFleetDisabled] = useState(false);
  const activeVersions = moduleVersions.filter((v) => v.status === "stable").length;

  const selected = selectedModule?.manifest;

  return (
    <Page>
      <PageHeader
        title={selected ? selected.name : "Module Detail"}
        description={selected ? selected.description : "Select a module from the catalog to view its detail."}
        icon={selected ? (selected.icon as ComponentType<SVGProps<SVGSVGElement>>) : BarChart3}
        actions={
          selected ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowOverrides(!showOverrides)}>
                <AlertTriangle className="mr-1 h-4 w-4" /> Overrides
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowKillSwitch(!showKillSwitch)}>
                <Shield className="mr-1 h-4 w-4" /> {fleetDisabled ? "Re-enable" : "Kill Switch"}
              </Button>
            </>
          ) : null
        }
      />
      <PageContent>
        {/* Module selector */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Module Catalog</span></CardHeader>
          <CardContent className="space-y-1">
            {allModules.map((m) => {
              const Icon = m.manifest.icon as ComponentType<SVGProps<SVGSVGElement>> | undefined;
              const active = selectedModule?.manifest.id === m.manifest.id;
              return (
                <button
                  key={m.manifest.id}
                  onClick={() => { setSelectedModule(m); setShowKillSwitch(false); setShowOverrides(false); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" style={{ color: m.manifest.accentColor }} /> : <span className="h-4 w-4 rounded-full bg-muted" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.manifest.name}</span>
                      <Badge variant="outline" className="text-[9px]">{m.manifest.version}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{m.manifest.id} · {m.manifest.category}</p>
                  </div>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Module detail */}
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Overview */}
              <Card>
                <CardHeader className="pb-2"><span className="text-sm font-medium">Overview</span></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {selected.icon && (createElement(selected.icon as ComponentType<SVGProps<SVGSVGElement>>, { className: "h-5 w-5" }))}
                    <h3 className="text-base font-semibold">{selected.name}</h3>
                    <Badge variant="outline" className="text-[9px]">{selected.version}</Badge>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Stable</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.supportedApplications?.map((a) => (
                      <Badge key={a} variant="secondary" className="text-[9px]">{a}</Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">ID: {selected.id}</div>
                </CardContent>
              </Card>

              {/* Quick stats */}
              <Card>
                <CardHeader className="pb-2"><span className="text-sm font-medium">Quick Stats</span></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active versions</span>
                    <span className="font-medium">{activeVersions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tenants using</span>
                    <span className="font-medium">{selectedModule ? allModules.filter((m) => m.manifest.id === selected.id).length : 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Permissions</span>
                    <span className="font-medium">{selected.permissions?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dependencies</span>
                    <span className="font-medium">{selected.dependencies?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                      <Activity className="mr-1 h-3 w-3" /> Active in Production
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Version history */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Version History</span></CardHeader>
              <CardContent className="space-y-2">
                {moduleVersions.map((v) => (
                  <div key={v.version} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{v.version}</span>
                        <Badge variant="outline" className="text-[9px]">{v.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Deployed {v.deployed} · {v.tenants} tenant{v.tenants !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="text-xs">History</Button>
                      {v.status === "deprecated" && <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-500/30">Deprecated</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tenant parameter overrides sheet */}
            {showOverrides && (
              <Card className="border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tenant Parameter Overrides</span>
                    <Button size="sm" variant="ghost" onClick={() => setShowOverrides(false)}>Close</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Configure tenant-level parameter overrides for {selected.name}. Overrides take precedence over global defaults.</p>
                  <div className="space-y-2">
                    {[
                      { key: "max_daily_drawdown", label: "Max Daily Drawdown", value: "5", unit: "%" },
                      { key: "max_position_size", label: "Max Position Size", value: "1000000", unit: "USD" },
                      { key: "leverage", label: "Default Leverage", value: "100", unit: "x" },
                      { key: "trading_enabled", label: "Trading Enabled", value: "true", unit: "" },
                    ].map((p) => (
                      <div key={p.key} className="flex items-center justify-between rounded-md border p-2.5">
                        <div>
                          <Label className="text-xs font-medium">{p.label}</Label>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input className="h-8 w-24 text-xs font-mono" defaultValue={p.value} />
                          {p.unit && <span className="text-[10px] text-muted-foreground">{p.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm">Save Overrides</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowOverrides(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fleet-wide kill switch modal */}
            {showKillSwitch && (
              <Card className="border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Fleet-Wide Disable / Kill Switch</span>
                    <Button size="sm" variant="ghost" onClick={() => { setShowKillSwitch(false); setFleetDisabled(false); }}>Close</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border bg-muted/30 p-3 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Emergency Kill Switch</p>
                        <p className="mt-1 text-muted-foreground">Disabling {selected.name} fleet-wide will immediately affect all {selectedModule ? moduleVersions[0].tenants : 7} tenants using this module. This action requires two-operator approval and is audited.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Currently</span>
                    <Badge variant={fleetDisabled ? "destructive" : "outline"} className="text-[10px]">
                      {fleetDisabled ? "Disabled (fleet-wide)" : "Active"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => {
                      setFleetDisabled(!fleetDisabled);
                      toast({ title: fleetDisabled ? "Module re-enabled" : "Kill switch activated", description: fleetDisabled ? `${selected.name} is no longer fleet-disabled.` : `CRITICAL: ${selected.name} disabled for all tenants.` });
                    }}>
                      {fleetDisabled ? "Re-enable Module" : "Disable Fleet-Wide"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowKillSwitch(false); setFleetDisabled(false); }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Permissions */}
            {selected.permissions && selected.permissions.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><span className="text-sm font-medium">Permissions</span></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {selected.permissions.slice(0, 8).map((p) => (
                      <Badge key={p.id} variant="outline" className="text-[9px] font-mono">{p.id}</Badge>
                    ))}
                    {selected.permissions.length > 8 && (
                      <Badge variant="outline" className="text-[9px]">+{selected.permissions.length - 8} more</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Audit changelog */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Audit Changelog</span></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { action: "Version deployed", detail: `${selected.version} → production`, time: "3h ago", actor: "deployment-agent" },
                  { action: "Configuration updated", detail: "Tenant parameter overrides modified", time: "1d ago", actor: "platform-admin" },
                  { action: "Module enabled", detail: `${selected.name} enabled for 7 tenants`, time: "1w ago", actor: "platform-admin" },
                  { action: "Audit changelog viewed", detail: "Module manifest changelog inspected", time: "2d ago", actor: "platform-admin" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2.5 text-xs">
                    <div>
                      <span className="font-medium">{e.action}</span>
                      <p className="text-muted-foreground">{e.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">{e.time}</p>
                      <p className="font-mono text-[10px]">{e.actor}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!selected && (
          <Card>
            <CardContent className="py-8 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Select a module to view detail</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a module from the catalog above to see its version history, permissions, overrides, and audit changelog.</p>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </Page>
  );
}
