"use client";

/**
 * PFaaS Platform — Price Alert System
 *
 * Create and manage price alerts that trigger when a symbol crosses
 * a threshold. Alerts persist to localStorage and fire toast
 * notifications when triggered by the live price feed.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Bell, BellRing, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  threshold: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

const STORAGE_KEY = "pfaas:priceAlerts";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD"];

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

export function usePriceAlerts(currentPrices: Record<string, number>) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch { /* ignore */ }
  }, [alerts]);

  // Check alerts against current prices — use rAF to defer setState
  // out of the effect body (avoids cascading renders lint rule).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const alert of alerts) {
        if (alert.triggered) continue;
        const price = currentPrices[alert.symbol];
        if (price === undefined) continue;
        const shouldTrigger =
          (alert.direction === "above" && price >= alert.threshold) ||
          (alert.direction === "below" && price <= alert.threshold);
        if (shouldTrigger) {
          setAlerts((prev) =>
            prev.map((a) => a.id === alert.id ? { ...a, triggered: true, triggeredAt: Date.now() } : a)
          );
          toast({
            title: "Price alert triggered",
            description: `${alert.symbol} is now ${alert.direction} ${alert.threshold} (current: ${price})`,
            variant: alert.direction === "above" ? "default" : "destructive",
          });
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [currentPrices, alerts]);

  const addAlert = useCallback((symbol: string, direction: "above" | "below", threshold: number) => {
    const alert: PriceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol,
      direction,
      threshold,
      createdAt: Date.now(),
      triggered: false,
    };
    setAlerts((prev) => [alert, ...prev]);
    toast({
      title: "Alert created",
      description: `You'll be notified when ${symbol} goes ${direction} ${threshold}.`,
    });
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.triggered));
  }, []);

  const activeCount = alerts.filter((a) => !a.triggered).length;
  const triggeredCount = alerts.filter((a) => a.triggered).length;

  return { alerts, addAlert, deleteAlert, clearTriggered, activeCount, triggeredCount };
}

export function PriceAlertManager({
  open,
  onOpenChange,
  currentPrices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrices: Record<string, number>;
}) {
  const { alerts, addAlert, deleteAlert, clearTriggered, activeCount, triggeredCount } = usePriceAlerts(currentPrices);
  const [symbol, setSymbol] = useState("EURUSD");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");

  const handleCreate = () => {
    const t = parseFloat(threshold);
    if (isNaN(t) || t <= 0) {
      toast({ title: "Invalid threshold", variant: "destructive" });
      return;
    }
    addAlert(symbol, direction, t);
    setThreshold("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            Price Alerts
          </DialogTitle>
          <DialogDescription>
            Get notified when a symbol crosses your threshold. Alerts persist across sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Create alert form */}
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium">Create new alert</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Symbol"
            >
              {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">goes</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "above" | "below")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Direction"
            >
              <option value="above">above</option>
              <option value="below">below</option>
            </select>
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="threshold"
              className="h-9 w-28 text-sm"
              step="any"
            />
            <Button size="sm" onClick={handleCreate} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {currentPrices[symbol] ? (
            <p className="text-[10px] text-muted-foreground">Current {symbol} price: {currentPrices[symbol]}</p>
          ) : null}
        </div>

        {/* Active alerts */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Your alerts ({alerts.length})</p>
            {triggeredCount > 0 ? (
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={clearTriggered}>
                Clear triggered ({triggeredCount})
              </Button>
            ) : null}
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No alerts yet. Create one above.</p>
            </div>
          ) : (
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5",
                    alert.triggered ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "bg-card"
                  )}
                >
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-full", alert.triggered ? "bg-amber-100 dark:bg-amber-950" : "bg-muted")}>
                    {alert.triggered ? <BellRing className="h-3.5 w-3.5 text-amber-600" /> : <Bell className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold">{alert.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{alert.direction}</span>
                      <span className="text-xs font-semibold tabular-nums">{alert.threshold}</span>
                      {alert.triggered ? <Badge variant="outline" className="text-[8px] border-amber-500/40 text-amber-700 dark:text-amber-400">triggered</Badge> : null}
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {alert.triggered && alert.triggeredAt
                        ? `Triggered ${new Date(alert.triggeredAt).toLocaleTimeString()}`
                        : `Created ${new Date(alert.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete alert for ${alert.symbol}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
