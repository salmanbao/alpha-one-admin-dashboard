"use client";

/**
 * Notifications Page — console notification centre (docs/21 CON-33).
 *
 * The full-page centre behind the topbar bell: every platform event the
 * operator has been notified about, with severity/read filters, deep-link
 * actions into the owning console view, and read-state management that
 * shares state with the topbar dropdown (both read from `usePlatform()`).
 *
 * P1-5: Alert rules now persisted to localStorage via the alert-rules-store.
 * Every toggle/threshold change writes an audit row.
 */

import { useMemo, useState, useEffect } from "react";
import { useAlertRulesVersion, readAlertRules, toggleAlertRule, updateAlertRuleThreshold, resetAlertRules } from "@/lib/platform/alert-rules-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/platform/status";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { EmptyState } from "@/components/platform/guards";
import { Inbox, Activity, Gauge, ShieldAlert, XCircle, CheckCheck, Check, AlertTriangle, Info, Bell } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Filter = "all" | "unread" | "critical";

const sevTone = (s: string) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : s === "success" ? "success" : "info";

const sevIcon = (s: string) =>
  s === "critical" ? XCircle : s === "warning" ? AlertTriangle : s === "success" ? Check : Info;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

type AlertRuleId = "queueBacklog" | "apiUsage" | "tenantHealth" | "slaBreach";

interface AlertRule {
  id: AlertRuleId;
  label: string;
  description: string;
  unit: string;
  threshold: number;
  enabled: boolean;
  icon: typeof Inbox | typeof Activity | typeof Gauge | typeof ShieldAlert;
  currentValue: number;
  higherIsWorse: boolean;
  linkHref: string;
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
];

export function NotificationsPage() {
  const { notifications, markRead, markAllRead, navigate } = usePlatform();

  const [filter, setFilter] = useState<Filter>("all");
  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => {
    const read = readAlertRules();
    return read;
  });

  useEffect(() => {
    // Re-read from store whenever the store changes (persistence across tabs)
    const current = readAlertRules();
    if (current.length !== alertRules.length || current.some((r, i) => r.id !== alertRules[i]?.id)) {
      setAlertRules(current);
    }
  }, []);

  useEffect(() => {
    // Persist only threshold + enabled when alertRules changes
    const persisted: Record<string, { threshold: number; enabled: boolean }> = {};
    alertRules.forEach((r) => {
      persisted[r.id] = { threshold: r.threshold, enabled: r.enabled };
    });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("pfaas:platform:alertRules", JSON.stringify(persisted));
      } catch {
        /* ignore quota */
      }
    }
  }, [alertRules]);

  const breachedRules = alertRules.filter((r) => r.enabled && 
    (r.higherIsWorse ? r.currentValue >= r.threshold : r.currentValue <= r.threshold));

  const unread = notifications.filter((n) => !n.read);
  const critical = notifications.filter((n) => n.severity === "critical");
  const warnings = notifications.filter((n) => n.severity === "warning");

  const visible = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (filter === "unread") return sorted.filter((n) => !n.read);
    if (filter === "critical") return sorted.filter((n) => n.severity === "critical");
    return sorted;
  }, [notifications, filter]);

  const handleToggle = (id: AlertRuleId) => {
    const next = toggleAlertRule(id);
    setAlertRules(next);
    toast({ title: "Alert rule updated", description: `Alert rule "${id}" toggled` });
  };

  const handleThreshold = (id: AlertRuleId, threshold: number) => {
    const next = updateAlertRuleThreshold(id, threshold);
    setAlertRules(next);
    toast({ title: "Alert rule updated", description: `Alert rule "${id}" threshold set to ${threshold}` });
  };

  const handleReset = () => {
    const next = resetAlertRules();
    setAlertRules(next);
    toast({ title: "Alert rules reset", description: "All alert rules reset to defaults" });
  };

  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Platform events that need an operator's attention. Unread items stay in sync with the topbar bell."
        icon={Bell}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            disabled={unread.length === 0}
          >
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={true}
          hasData={true}
          onRetry={() => {}}
          loadingLabel="Loading notifications…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Unread" value={unread.length} icon={Inbox} tone={unread.length > 0 ? "warning" : "positive"} />
          <MetricCard label="Critical" value={critical.length} icon={XCircle} tone={critical.length > 0 ? "negative" : "positive"} />
          <MetricCard label="Warnings" value={warnings.length} icon={AlertTriangle} />
          <MetricCard label="Total" value={notifications.length} icon={Bell} />
        </div>

        {/* Configurable alert rules — audit #8: threshold-based alerting */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Alert Rules</h2>
                <p className="text-xs text-muted-foreground">
                  Threshold-based notifications — get notified before problems become incidents.
                </p>
              </div>
              {breachedRules.length > 0 && (
                <StatusBadge tone="danger">
                  {breachedRules.length} active
                </StatusBadge>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {alertRules.map((rule) => {
                const Icon = rule.icon;
                const breached = rule.enabled && 
                  (rule.higherIsWorse ? rule.currentValue >= rule.threshold : rule.currentValue <= rule.threshold);
                return (
                  <div
                    key={rule.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      breached ? "border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20" : rule.enabled ? "border-border" : "border-border opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            breached ? "text-rose-600" : "text-muted-foreground"
                          }`}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold">{rule.label}</p>
                          <p className="text-[10px] text-muted-foreground">{rule.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => handleToggle(rule.id)}
                        aria-label={`Toggle ${rule.label} alert`}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor={`threshold-${rule.id}`} className="text-[10px] text-muted-foreground">
                        Threshold
                      </Label>
                      <Input
                        id={`threshold-${rule.id}`}
                        type="number"
                        value={rule.threshold}
                        onChange={(e) => handleThreshold(rule.id, Number(e.target.value))}
                        className="h-7 w-24 text-xs"
                        disabled={!rule.enabled}
                        aria-label={`${rule.label} threshold in ${rule.unit}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{rule.unit}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        Current: {rule.currentValue.toLocaleString()} {rule.unit}
                      </span>
                      {breached && (
                        <StatusBadge tone="danger">Breach</StatusBadge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 px-2 text-[10px]"
                      onClick={() => navigate(rule.linkHref)}
                    >
                      View dashboard →
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={filter === "unread" ? "You're all caught up" : "No notifications here"}
            description={
              filter === "unread"
                ? "Every notification has been read."
                : filter === "critical"
                  ? "No critical events. The platform is quiet."
                  : "New platform events will appear here as they happen."
            }
            icon={Bell}
          />
        ) : (
          <div className="space-y-2">
            {visible.map((n) => {
              const SevIcon = sevIcon(n.severity);
              const canOpen = Boolean(n.actionHref);
              return (
                <Card key={n.id} className={n.read ? undefined : "border-l-2 border-l-primary"}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <SevIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{n.title}</h3>
                          <StatusBadge tone={sevTone(n.severity)}>{n.severity}</StatusBadge>
                          {n.module ? (
                            <StatusBadge tone="muted">{n.module}</StatusBadge>
                          ) : null}
                          {!n.read ? (
                            <span className="text-[10px] font-medium text-primary">UNREAD</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!n.read ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => markRead(n.id)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Mark read
                          </Button>
                        ) : null}
                        {canOpen ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              markRead(n.id);
                              navigate(n.actionHref!);
                            }}
                          >
                            {n.actionLabel ?? "Open"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}