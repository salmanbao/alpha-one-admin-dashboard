"use client";

/**
 * Notifications Page — console notification centre (docs/21 CON-33).
 *
 * The full-page centre behind the topbar bell: every platform event the
 * operator has been notified about, with severity/read filters, deep-link
 * actions into the owning console view, and read-state management that
 * shares state with the topbar dropdown (both read from `usePlatform()`).
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import {
  Bell,
  CheckCheck,
  Check,
  Inbox,
  AlertTriangle,
  Info,
  XCircle,
  ShieldAlert,
  Activity,
  Gauge,
} from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import type { AppNotification } from "@/lib/platform/types";

type Filter = "all" | "unread" | "critical";

const sevTone = (s: AppNotification["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : s === "success" ? "success" : "info";

const sevIcon = (s: AppNotification["severity"]) =>
  s === "critical" ? XCircle : s === "warning" ? AlertTriangle : s === "success" ? Check : Info;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
];

/* ------------------------------------------------------------------ */
/* Configurable alert rules — audit #8: threshold-based alerting       */
/* ------------------------------------------------------------------ */

type AlertRuleId = "queueBacklog" | "apiUsage" | "tenantHealth" | "slaBreach";

interface AlertRule {
  id: AlertRuleId;
  label: string;
  description: string;
  unit: string;
  /** Threshold above/below which the alert fires. */
  threshold: number;
  enabled: boolean;
  icon: typeof ShieldAlert;
  /** Current mock value for demo breach simulation. */
  currentValue: number;
  /** Whether higher values are worse (true) or lower (false). */
  higherIsWorse: boolean;
  linkHref: string;
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "queueBacklog",
    label: "Queue backlog",
    description: "Alert when total pending KYC + payouts + tickets exceeds the threshold.",
    unit: "items",
    threshold: 25,
    enabled: true,
    icon: Inbox,
    currentValue: 18,
    higherIsWorse: true,
    linkHref: "cross-tenant-queues",
  },
  {
    id: "apiUsage",
    label: "API usage anomaly",
    description: "Alert when any tenant's daily API calls exceed the threshold.",
    unit: "calls/day",
    threshold: 50000,
    enabled: true,
    icon: Activity,
    currentValue: 42000,
    higherIsWorse: true,
    linkHref: "tenant-api-usage",
  },
  {
    id: "tenantHealth",
    label: "Tenant health score",
    description: "Alert when a tenant's health score drops below the threshold.",
    unit: "score",
    threshold: 60,
    enabled: false,
    icon: Gauge,
    currentValue: 72,
    higherIsWorse: false,
    linkHref: "tenant-health",
  },
  {
    id: "slaBreach",
    label: "SLA breach risk",
    description: "Alert when projected SLA breach probability exceeds the threshold.",
    unit: "%",
    threshold: 70,
    enabled: true,
    icon: ShieldAlert,
    currentValue: 82,
    higherIsWorse: true,
    linkHref: "sla-monitoring",
  },
];

const ALERT_RULES_KEY = "pfaas:platform:alertRules";

function loadAlertRules(): AlertRule[] {
  if (typeof window === "undefined") return DEFAULT_ALERT_RULES;
  try {
    const stored = window.localStorage.getItem(ALERT_RULES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Record<AlertRuleId, { threshold: number; enabled: boolean }>>;
      return DEFAULT_ALERT_RULES.map((rule) => {
        const override = parsed[rule.id];
        return override ? { ...rule, threshold: override.threshold, enabled: override.enabled } : rule;
      });
    }
  } catch { /* ignore corrupt storage */ }
  return DEFAULT_ALERT_RULES;
}

function saveAlertRules(rules: AlertRule[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: Partial<Record<AlertRuleId, { threshold: number; enabled: boolean }>> = {};
    rules.forEach((r) => { payload[r.id] = { threshold: r.threshold, enabled: r.enabled }; });
    window.localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(payload));
  } catch { /* ignore quota errors */ }
}

function isBreached(rule: AlertRule): boolean {
  if (!rule.enabled) return false;
  return rule.higherIsWorse ? rule.currentValue >= rule.threshold : rule.currentValue <= rule.threshold;
}

export function NotificationsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { notifications, markRead, markAllRead, navigate } = usePlatform();
  const [filter, setFilter] = useState<Filter>("all");
  const [alertRules, setAlertRules] = useState<AlertRule[]>(loadAlertRules);

  const updateRule = (id: AlertRuleId, patch: Partial<Pick<AlertRule, "threshold" | "enabled">>) => {
    setAlertRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      saveAlertRules(next);
      return next;
    });
  };

  const breachedRules = alertRules.filter(isBreached);

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
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
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
                const breached = isBreached(rule);
                return (
                  <div
                    key={rule.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      breached
                        ? "border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20"
                        : rule.enabled
                          ? "border-border"
                          : "border-border opacity-60"
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
                        onCheckedChange={(v) => updateRule(rule.id, { enabled: v })}
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
                        onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
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
