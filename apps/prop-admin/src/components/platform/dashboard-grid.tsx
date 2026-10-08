"use client";

/**
 * PFaaS Platform — Dashboard Customization Dialog
 *
 * Spec §23: Dashboard Customization — shows all available widgets
 * grouped by module with toggle switches. Hidden widgets are filtered
 * out of the dashboard grid (see gridstack-dashboard.tsx). Includes
 * layout presets and export/import of the hidden-widget config.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { cn } from "@pfaas/ui/cn";
import { Button } from "@pfaas/ui/button";
import { Badge } from "@pfaas/ui/badge";
import { Switch } from "@pfaas/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@pfaas/ui/dialog";
import { toast } from "@pfaas/ui/use-toast";
import { LayoutGrid, Settings2, Eye, EyeOff, RotateCcw, X, ShieldAlert, Wallet, CandlestickChart, Minimize2, Download, Upload } from "lucide-react";

/**
 * Customize Dashboard dialog (spec §23). Shows all available widgets
 * grouped by module with toggle switches. Hidden widgets are filtered
 * out of the dashboard grid. Includes a Reset layout action.
 */
export function CustomizeDashboardDialog() {
  const {
    customizeOpen,
    setCustomizeOpen,
    runtime,
    hiddenWidgets,
    toggleWidget,
    resetDashboard,
    setHiddenWidgets,
  } = usePlatform();

  const enabledModules = moduleRegistry.getEnabledModules(runtime);
  const allWidgets = enabledModules.flatMap((m) => m.widgets ?? []);
  const totalWidgets = allWidgets.length;
  const visibleCount = totalWidgets - hiddenWidgets.size;

  // Dashboard layout presets (spec §23 — Role/Tenant dashboard templates)
  // Each preset hides widgets NOT in its include list.
  const presets = [
    {
      id: "all",
      name: "All widgets",
      description: "Show every available widget",
      icon: LayoutGrid,
      hidden: [] as string[],
    },
    {
      id: "risk",
      name: "Risk-focused",
      description: "Risk, breaches, trading positions only",
      icon: ShieldAlert,
      hidden: allWidgets
        .filter((w) => !["risk-overview", "risk-distribution", "breach-trend", "open-breaches", "open-positions", "trading-overview"].includes(w.id))
        .map((w) => w.id),
    },
    {
      id: "finance",
      name: "Finance-focused",
      description: "Payouts, accounting, revenue metrics",
      icon: Wallet,
      hidden: allWidgets
        .filter((w) => !["payout-overview", "payout-queue", "payout-trend", "payout-method", "accounting-overview", "revenue-by-type", "transaction-flow", "analytics-overview", "revenue"].includes(w.id))
        .map((w) => w.id),
    },
    {
      id: "trading",
      name: "Trading-focused",
      description: "Traders, accounts, positions, performance",
      icon: CandlestickChart,
      hidden: allWidgets
        .filter((w) => !["trading-overview", "account-balance", "trader-performance", "open-positions", "recent-activity", "challenge-overview", "challenge-progress"].includes(w.id))
        .map((w) => w.id),
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Only top-level KPI overview widgets",
      icon: Minimize2,
      hidden: allWidgets
        .filter((w) => w.category !== "metric")
        .map((w) => w.id),
    },
  ];

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setHiddenWidgets(new Set(preset.hidden));
    toast({
      title: "Preset applied",
      description: `"${preset.name}" layout — ${totalWidgets - preset.hidden.length} of ${totalWidgets} widgets visible.`,
    });
  };

  const handleReset = () => {
    resetDashboard();
    toast({
      title: "Dashboard reset",
      description: "All widgets restored to default layout.",
    });
  };

  return (
    <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Customize Dashboard
          </DialogTitle>
          <DialogDescription>
            Toggle widgets to show or hide them on your dashboard. Changes apply instantly and are saved to your browser.
            Showing {visibleCount} of {totalWidgets} widgets.
          </DialogDescription>
        </DialogHeader>

        {/* Layout presets — quick-switch dashboard templates (spec §23) */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layout presets</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {presets.map((p) => {
              const PIcon = p.icon;
              const activePreset = hiddenWidgets.size === p.hidden.size &&
                p.hidden.every((id) => hiddenWidgets.has(id));
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border p-2.5 text-center transition-all hover:shadow-sm",
                    activePreset
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <PIcon className={cn("h-4 w-4", activePreset ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-[11px] font-medium text-foreground">{p.name}</span>
                  <span className="text-[9px] text-muted-foreground">{totalWidgets - p.hidden.length} widgets</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 py-2">
          {enabledModules.map((mod) => {
            const widgets = mod.widgets ?? [];
            if (widgets.length === 0) return null;
            const Icon = mod.manifest.icon;
            const visibleInModule = widgets.filter((w) => !hiddenWidgets.has(w.id)).length;
            return (
              <div key={mod.manifest.id} className="rounded-lg border">
                <div className="flex items-center gap-2.5 border-b bg-muted/30 px-3 py-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded"
                    style={{ background: `${mod.manifest.accentColor}1a`, color: mod.manifest.accentColor }}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  </div>
                  <span className="text-sm font-medium">{mod.manifest.name}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {visibleInModule}/{widgets.length} visible
                  </Badge>
                </div>
                <div className="divide-y">
                  {widgets.map((w) => {
                    const hidden = hiddenWidgets.has(w.id);
                    return (
                      <div
                        key={`${mod.manifest.id}-${w.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors",
                          hidden && "bg-muted/20 opacity-60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {hidden ? (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            <span className="truncate text-sm font-medium text-foreground">{w.title}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase tracking-wide"
                              style={{ color: mod.manifest.accentColor, borderColor: `${mod.manifest.accentColor}40` }}
                            >
                              {w.category}
                            </Badge>
                          </div>
                          {w.description ? (
                            <p className="ml-6 truncate text-xs text-muted-foreground">{w.description}</p>
                          ) : null}
                        </div>
                        <Switch
                          checked={!hidden}
                          onCheckedChange={() => toggleWidget(w.id)}
                          aria-label={`Toggle ${w.title}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {/* Layout sharing — export/import hidden widget config as JSON */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const config = { version: 1, hiddenWidgets: Array.from(hiddenWidgets) };
              const json = JSON.stringify(config, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `dashboard-layout-${new Date().toISOString().slice(0, 10)}.json`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              toast({ title: "Layout exported", description: `${hiddenWidgets.size} hidden widgets saved to JSON.` });
            }}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "application/json";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const config = JSON.parse(ev.target?.result as string);
                    if (Array.isArray(config.hiddenWidgets)) {
                      setHiddenWidgets(new Set(config.hiddenWidgets));
                      toast({
                        title: "Layout imported",
                        description: `${config.hiddenWidgets.length} hidden widgets applied.`,
                      });
                    } else {
                      toast({ title: "Invalid layout file", variant: "destructive" });
                    }
                  } catch {
                    toast({ title: "Failed to parse JSON", variant: "destructive" });
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={() => setCustomizeOpen(false)} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
