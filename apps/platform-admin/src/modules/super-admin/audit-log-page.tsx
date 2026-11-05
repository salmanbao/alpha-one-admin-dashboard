"use client";

/**
 * Audit Log Page — Platform audit trail and compliance logging.
 *
 * Stitch screen: audit_log
 * Tier 1 — Search, filter, and review platform audit events for compliance.
 */

import { useState, useMemo, useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { tenants } from "@/lib/platform/mock-data";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  ScrollText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  UserCog,
  Building2,
  Settings,
  AlertTriangle,
  Clock,
  FileText,
  X,
  CheckCircle2,
  Eye,
  Edit2,
  Trash2,
  Key,
  Lock,
  Unlock,
  Plus,
  Globe,
  ShieldAlert,
  DollarSign,
  HardDrive,
} from "lucide-react";

// Demo audit events
const demoAuditEvents = [
  { id: "evt-001", timestamp: "2026-10-08T14:32:15Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "tenant.update", target: "Alpha Capital", targetType: "Tenant", details: "Updated billing plan from Scale to Enterprise", region: "us-east-1", severity: "info" },
  { id: "evt-002", timestamp: "2026-10-08T14:28:42Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "user.suspend", target: "david.park@pfaas.io", targetType: "User", details: "Suspended user due to inactivity policy (30 days)", region: "us-east-1", severity: "warning" },
  { id: "evt-003", timestamp: "2026-10-08T14:15:00Z", actor: "James Rodriguez", actorRole: "Billing Admin", action: "billing.payout", target: "Beta Trading", targetType: "Tenant", details: "Initiated payout of $28,900.00 USD", region: "us-east-1", severity: "info" },
  { id: "evt-004", timestamp: "2026-10-08T13:55:23Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "module.enable", target: "Analytics", targetType: "Module", details: "Enabled Analytics module for Gamma Futures tenant", region: "eu-west-1", severity: "info" },
  { id: "evt-005", timestamp: "2026-10-08T13:42:18Z", actor: "Emily Kim", actorRole: "Tenant Operator", action: "support.ticket", target: "TC-2847", targetType: "Ticket", details: "Resolved support ticket #2847 - Account verification", region: "us-east-1", severity: "info" },
  { id: "evt-006", timestamp: "2026-10-08T13:30:00Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "security.breach", target: "acct-beta-7", targetType: "Account", details: "Max drawdown exceeded - automatic breach triggered", region: "us-east-2", severity: "critical" },
  { id: "evt-007", timestamp: "2026-10-08T13:15:45Z", actor: "System", actorRole: "Automated", action: "system.backup", target: "Alpha Capital DB", targetType: "Database", details: "Scheduled backup completed successfully", region: "us-east-1", severity: "info" },
  { id: "evt-008", timestamp: "2026-10-08T12:58:30Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "tenant.create", target: "Gamma Futures", targetType: "Tenant", details: "Created new tenant with Enterprise L4 plan", region: "us-east-1", severity: "info" },
  { id: "evt-009", timestamp: "2026-10-08T12:45:00Z", actor: "James Rodriguez", actorRole: "Billing Admin", action: "billing.invoice", target: "Alpha Capital", targetType: "Tenant", details: "Generated monthly invoice #INV-2026-10-045", region: "us-east-1", severity: "info" },
  { id: "evt-010", timestamp: "2026-10-08T12:30:15Z", actor: "Lisa Thompson", actorRole: "Support Agent", action: "support.ticket", target: "TC-2848", targetType: "Ticket", details: "Created support ticket - Withdrawal request inquiry", region: "us-east-1", severity: "info" },
  { id: "evt-011", timestamp: "2026-10-08T12:15:00Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "security.audit", target: "Platform Audit Log", targetType: "System", details: "Exported audit log for compliance review Q3 2026", region: "us-east-1", severity: "info" },
  { id: "evt-012", timestamp: "2026-10-08T11:55:22Z", actor: "Anna Martinez", actorRole: "Tenant Operator", action: "tenant.update", target: "Gamma Futures", targetType: "Tenant", details: "Updated tenant branding colors and logo", region: "eu-central-1", severity: "info" },
];

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "tenant.update": Edit2,
  "tenant.create": Plus,
  "tenant.delete": Trash2,
  "user.suspend": ShieldAlert,
  "user.activate": CheckCircle2,
  "billing.payout": DollarSign,
  "billing.invoice": FileText,
  "module.enable": Globe,
  "module.disable": X,
  "security.breach": AlertTriangle,
  "security.audit": ShieldCheck,
  "security.audit_export": Download,
  "support.ticket": ScrollText,
  "system.backup": HardDrive,
  "settings.update": Settings,
  "auth.login": Key,
  "auth.logout": Lock,
  "auth.failed": AlertTriangle,
};

const actionColors: Record<string, string> = {
  "tenant.update": "#4a7c59",
  "tenant.create": "#4a7c59",
  "tenant.delete": "#b83230",
  "user.suspend": "#d97706",
  "user.activate": "#059669",
  "billing.payout": "#705c30",
  "billing.invoice": "#6b6358",
  "module.enable": "#4a7c59",
  "module.disable": "#b83230",
  "security.breach": "#b83230",
  "security.audit": "#4a4e4a",
  "security.audit_export": "#4a4e4a",
  "support.ticket": "#74796e",
  "system.backup": "#059669",
  "settings.update": "#74796e",
  "auth.login": "#4a7c59",
  "auth.logout": "#6b6358",
  "auth.failed": "#b83230",
};

const severityTones: Record<string, "success" | "info" | "warning" | "danger"> = {
  info: "info",
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

/* ── Automated compliance checking (finding #8) ──────────────────────
 * Deterministic rule-based flagging: each rule is a pure predicate
 * over the audit event stream. Flagged events get an inline badge and
 * rule names in the list, plus a "Flagged only" filter. Enable/disable
 * state persists per operator in localStorage. */
type AuditEvent = (typeof demoAuditEvents)[number];

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: "high" | "medium" | "low";
  test: (evt: AuditEvent) => boolean;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: "payout-threshold",
    name: "High-value payout review",
    description: "Flags payouts of $10,000+ for MLRO review before settlement.",
    severity: "high",
    test: (evt) => {
      if (evt.action !== "billing.payout") return false;
      const m = evt.details.match(/\$([\d,]+)/);
      return m ? Number(m[1].replace(/,/g, "")) >= 10_000 : false;
    },
  },
  {
    id: "critical-escalation",
    name: "Critical event escalation",
    description: "Critical-severity events auto-escalate to the on-call security officer.",
    severity: "high",
    test: (evt) => evt.severity === "critical",
  },
  {
    id: "cross-region-change",
    name: "Cross-region configuration change",
    description: "Tenant or module changes outside the primary region require review.",
    severity: "medium",
    test: (evt) => evt.region.startsWith("eu-") && /^(tenant|module)\./.test(evt.action),
  },
  {
    id: "plan-change",
    name: "Billing plan modification",
    description: "Subscription plan changes are flagged for revenue-recognition audit.",
    severity: "medium",
    test: (evt) =>
      evt.action === "tenant.update" && evt.details.toLowerCase().includes("billing plan"),
  },
  {
    id: "audit-export",
    name: "Audit log export",
    description: "Every compliance export is itself an auditable disclosure event.",
    severity: "low",
    test: (evt) =>
      evt.action === "security.audit" && evt.details.toLowerCase().includes("export"),
  },
];

const COMPLIANCE_RULES_KEY = "pfaas:platform:complianceRules";

function loadComplianceRuleOverrides(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(COMPLIANCE_RULES_KEY);
    if (stored) return JSON.parse(stored) as Record<string, boolean>;
  } catch { /* ignore corrupt storage */ }
  return {};
}

function saveComplianceRuleOverrides(overrides: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLIANCE_RULES_KEY, JSON.stringify(overrides));
  } catch { /* ignore quota errors */ }
}

export function AuditLogPage() {
  const { navigate, router } = usePlatform();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  // Automated compliance checking (finding #8) — rule toggles persist
  // per operator; "Flagged only" narrows the list to rule matches.
  const [ruleOverrides, setRuleOverrides] = useState<Record<string, boolean>>({});
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    setRuleOverrides(loadComplianceRuleOverrides());
  }, []);

  const toggleRule = (ruleId: string) => {
    setRuleOverrides((prev) => {
      const next = { ...prev, [ruleId]: !(prev[ruleId] ?? true) };
      saveComplianceRuleOverrides(next);
      return next;
    });
  };

  const isRuleEnabled = (ruleId: string) => ruleOverrides[ruleId] ?? true;
  // Tenant scope — preset via navigate("audit-log", { tenant }) from the
  // tenant detail view (audit: tenant-specific log viewer).
  const [tenantFilter, setTenantFilter] = useState<string>(router.params.tenant ?? "all");

  useEffect(() => {
    if (router.params.tenant) setTenantFilter(router.params.tenant);
  }, [router.params.tenant]);

  const tenantName = useMemo(
    () => tenants.find((t) => t.id === tenantFilter)?.name ?? "",
    [tenantFilter],
  );

  /** Which tenant an event belongs to — derived from the tenant names
   *  referenced in its target/details; null = platform-wide / other. */
  const tenantOf = useMemo(() => {
    const byName = new Map(tenants.map((t) => [t.name, t.id]));
    return (evt: (typeof demoAuditEvents)[number]): string | null => {
      for (const [name, id] of byName) {
        if (evt.target === name || evt.details.includes(name)) return id;
      }
      return null;
    };
  }, []);

  // Async seam (frontend-first): event stream resolves via the mock layer.
  const {
    data: loadedEvents,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoAuditEvents, { delayMs: 450 }), []);
  const auditEvents = loadedEvents ?? [];

  // Evaluate enabled compliance rules against every event (finding #8).
  // Map of eventId → matched rules (deterministic, no randomness).
  const flagsByEvent = useMemo(() => {
    const map = new Map<string, ComplianceRule[]>();
    for (const evt of auditEvents) {
      const matches = COMPLIANCE_RULES.filter(
        (r) => (ruleOverrides[r.id] ?? true) && r.test(evt),
      );
      if (matches.length > 0) map.set(evt.id, matches);
    }
    return map;
  }, [auditEvents, ruleOverrides]);

  const filtered = useMemo(() => {
    return auditEvents.filter((evt) => {
      const matchesSearch =
        search === "" ||
        evt.id.toLowerCase().includes(search.toLowerCase()) ||
        evt.actor.toLowerCase().includes(search.toLowerCase()) ||
        evt.action.toLowerCase().includes(search.toLowerCase()) ||
        evt.target.toLowerCase().includes(search.toLowerCase());
      const matchesAction = actionFilter === "all" || evt.action === actionFilter;
      const matchesSeverity = severityFilter === "all" || evt.severity === severityFilter;
      const matchesTenant = tenantFilter === "all" || tenantOf(evt) === tenantFilter;
      const matchesFlagged = !flaggedOnly || flagsByEvent.get(evt.id)?.length;
      return matchesSearch && matchesAction && matchesSeverity && matchesTenant && matchesFlagged;
    });
  }, [auditEvents, search, actionFilter, severityFilter, tenantFilter, tenantOf, flaggedOnly, flagsByEvent]);

  const actions = useMemo(() => {
    const set = new Set(auditEvents.map((e) => e.action));
    return Array.from(set).sort();
  }, [auditEvents]);

  const stats = useMemo(() => ({
    total: auditEvents.length,
    critical: auditEvents.filter((e) => e.severity === "critical").length,
    warning: auditEvents.filter((e) => e.severity === "warning").length,
    info: auditEvents.filter((e) => e.severity === "info").length,
    actors: new Set(auditEvents.map((e) => e.actor)).size,
    flagged: flagsByEvent.size,
  }), [auditEvents, flagsByEvent]);

  const enabledRuleCount = COMPLIANCE_RULES.filter((r) => isRuleEnabled(r.id)).length;

  return (
    <Page>
      <PageHeader
        title="Platform Audit Log"
        description="Search, filter, and review platform audit events for compliance and security analysis."
        icon={ScrollText}
        actions={
          <>
            {/* Chain: platform-audit → here → model/change history */}
            <Button variant="ghost" size="sm" onClick={() => navigate("model-audit-log")}>
              Model / change history
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <ShieldCheck className="mr-1 h-4 w-4" /> Compliance Report
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedEvents !== undefined}
          loadingLabel="Loading audit events…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Events (24h)" value={stats.total} icon={ScrollText} />
          <MetricCard label="Critical Events" value={stats.critical} icon={AlertTriangle} tone="negative" />
          <MetricCard label="Warnings" value={stats.warning} icon={ShieldAlert} tone="warning" />
          <MetricCard label="Unique Actors" value={stats.actors} icon={UserCog} />
        </div>

        {/* Compliance badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> SOC 2 Type II
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
            <Lock className="mr-1 h-3 w-3" /> SEC Rule 17a-4 WORM
          </Badge>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <Globe className="mr-1 h-3 w-3" /> GDPR Compliant
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" /> Retention: 7 years
          </Badge>
        </div>

        {/* Automated compliance rules (finding #8) — toggleable rules
            that flag events inline below; matches counted live. */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Automated compliance checks
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {enabledRuleCount}/{COMPLIANCE_RULES.length} rules active ·{" "}
                  <span className={stats.flagged > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
                    {stats.flagged} events flagged
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={flaggedOnly ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  aria-pressed={flaggedOnly}
                  onClick={() => setFlaggedOnly((v) => !v)}
                  disabled={stats.flagged === 0}
                >
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                  {flaggedOnly ? "Showing flagged" : "Flagged only"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {COMPLIANCE_RULES.map((rule) => {
                const enabled = isRuleEnabled(rule.id);
                const hits = auditEvents.filter((e) => rule.test(e)).length;
                return (
                  <li
                    key={rule.id}
                    className={`rounded-md border p-2.5 text-xs ${enabled ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-70"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium leading-tight">{rule.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{rule.description}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`${enabled ? "Disable" : "Enable"} compliance rule: ${rule.name}`}
                        onClick={() => toggleRule(rule.id)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? "left-[18px]" : "left-0.5"}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase ${
                          rule.severity === "high"
                            ? "border-rose-500/30 text-rose-700 dark:text-rose-400"
                            : rule.severity === "medium"
                              ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
                              : "border-teal-500/30 text-teal-700 dark:text-teal-400"
                        }`}
                      >
                        {rule.severity}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {hits} matching event{hits === 1 ? "" : "s"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by event ID, actor, action, or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tenant scope — same audit events, narrowed to one tenant */}
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Filter by tenant">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tenantFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Tenant: {tenantName}
                <button
                  type="button"
                  aria-label="Clear tenant filter"
                  onClick={() => setTenantFilter("all")}
                  className="rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              size="sm"
              variant={actionFilter === "all" ? "default" : "outline"}
              onClick={() => setActionFilter("all")}
            >
              All Actions
            </Button>
            {actions.slice(0, 6).map((action) => (
              <Button
                key={action}
                size="sm"
                variant={actionFilter === action ? "default" : "outline"}
                onClick={() => setActionFilter(action)}
                className="text-[10px]"
              >
                {action.replace(".", " ")}
              </Button>
            ))}
          </div>
        </div>

        {/* Audit events list */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((evt) => {
                const Icon = actionIcons[evt.action] ?? FileText;
                const color = actionColors[evt.action] ?? "#74796e";
                const flags = flagsByEvent.get(evt.id) ?? [];
                return (
                  <div
                    key={evt.id}
                    className={`flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors ${flags.length > 0 ? "border-l-2 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                  >
                    {/* Action icon */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                      style={{ background: color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{evt.action.replace(".", " ")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {evt.actor} ({evt.actorRole}) · {evt.target} ({evt.targetType})
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {flags.map((f) => (
                            <Badge
                              key={f.id}
                              variant="outline"
                              title={f.description}
                              className={`text-[9px] ${
                                f.severity === "high"
                                  ? "border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                                  : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              <ShieldAlert className="mr-0.5 h-2.5 w-2.5" aria-hidden="true" />
                              {f.name}
                            </Badge>
                          ))}
                          <Badge
                            variant="outline"
                            className={`text-[9px] capitalize ${
                              evt.severity === "critical"
                                ? "border-rose-500/30 text-rose-700 dark:text-rose-400"
                                : evt.severity === "warning"
                                  ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
                                  : "border-teal-500/30 text-teal-700 dark:text-teal-400"
                            }`}
                          >
                            {evt.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(evt.timestamp).toLocaleDateString()} {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{evt.details}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {evt.targetType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {evt.region}
                        </span>
                        <span className="font-mono text-[10px]">{evt.id}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`View event ${evt.id}`} onClick={() => toast({ title: "View event", description: `${evt.action} · ${evt.id}. Audited.` })}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Download event ${evt.id}`} onClick={() => toast({ title: "Download started", description: `Exporting ${evt.id} audit event record.` })}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center p-8 text-center">
                <ScrollText className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="mt-2 font-medium">No audit events found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filter checklist */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Saved Filters</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Critical security events", filter: { severity: "critical" } },
                { label: "Billing transactions", filter: { action: "billing.payout" } },
                { label: "Admin actions by Marcus", filter: { actor: "Marcus Vance" } },
                { label: "Module changes", filter: { action: "module.enable" } },
              ].map((f) => (
                <Button
                  key={f.label}
                  variant="outline"
                  className="justify-start text-sm"
                  onClick={() => {}}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  {f.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
