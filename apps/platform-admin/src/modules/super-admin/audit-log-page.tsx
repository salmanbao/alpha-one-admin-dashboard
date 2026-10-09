"use client";

/**
 * Audit Log Page — Platform audit trail and compliance logging.
 *
 * Stitch screen: audit_log
 * Tier 1 — Search, filter, and review platform audit events for compliance.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
const auditEvents = [
  { id: "evt-001", timestamp: "2026-10-08T14:32:15Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "tenant.update", target: "Alpha Capital Media", targetType: "Tenant", details: "Updated billing plan from Scale to Enterprise", region: "us-east-1", severity: "info" },
  { id: "evt-002", timestamp: "2026-10-08T14:28:42Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "user.suspend", target: "david.park@pfaas.io", targetType: "User", details: "Suspended user due to inactivity policy (30 days)", region: "us-east-1", severity: "warning" },
  { id: "evt-003", timestamp: "2026-10-08T14:15:00Z", actor: "James Rodriguez", actorRole: "Billing Admin", action: "billing.payout", target: "Beta Trading", targetType: "Tenant", details: "Initiated payout of $28,900.00 USD", region: "us-east-1", severity: "info" },
  { id: "evt-004", timestamp: "2026-10-08T13:55:23Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "module.enable", target: "Analytics", targetType: "Module", details: "Enabled Analytics module for Gamma Fund tenant", region: "eu-west-1", severity: "info" },
  { id: "evt-005", timestamp: "2026-10-08T13:42:18Z", actor: "Emily Kim", actorRole: "Tenant Operator", action: "support.ticket", target: "TC-2847", targetType: "Ticket", details: "Resolved support ticket #2847 - Account verification", region: "us-east-1", severity: "info" },
  { id: "evt-006", timestamp: "2026-10-08T13:30:00Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "security.breach", target: "acct-beta-7", targetType: "Account", details: "Max drawdown exceeded - automatic breach triggered", region: "us-east-2", severity: "critical" },
  { id: "evt-007", timestamp: "2026-10-08T13:15:45Z", actor: "System", actorRole: "Automated", action: "system.backup", target: "Alpha Capital DB", targetType: "Database", details: "Scheduled backup completed successfully", region: "us-east-1", severity: "info" },
  { id: "evt-008", timestamp: "2026-10-08T12:58:30Z", actor: "Marcus Vance", actorRole: "Platform Admin", action: "tenant.create", target: "Omega Prop House", targetType: "Tenant", details: "Created new tenant with Enterprise L4 plan", region: "us-east-1", severity: "info" },
  { id: "evt-009", timestamp: "2026-10-08T12:45:00Z", actor: "James Rodriguez", actorRole: "Billing Admin", action: "billing.invoice", target: "Delta Prop", targetType: "Tenant", details: "Generated monthly invoice #INV-2026-10-045", region: "us-east-1", severity: "info" },
  { id: "evt-010", timestamp: "2026-10-08T12:30:15Z", actor: "Lisa Thompson", actorRole: "Support Agent", action: "support.ticket", target: "TC-2848", targetType: "Ticket", details: "Created support ticket - Withdrawal request inquiry", region: "us-east-1", severity: "info" },
  { id: "evt-011", timestamp: "2026-10-08T12:15:00Z", actor: "Sarah Chen", actorRole: "Security Officer", action: "security.audit", target: "Platform Audit Log", targetType: "System", details: "Exported audit log for compliance review Q3 2026", region: "us-east-1", severity: "info" },
  { id: "evt-012", timestamp: "2026-10-08T11:55:22Z", actor: "Anna Martinez", actorRole: "Tenant Operator", action: "tenant.update", target: "Gamma Fund", targetType: "Tenant", details: "Updated tenant branding colors and logo", region: "eu-central-1", severity: "info" },
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

export function AuditLogPage() {
  const { navigate } = usePlatform();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

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
      return matchesSearch && matchesAction && matchesSeverity;
    });
  }, [search, actionFilter, severityFilter]);

  const actions = useMemo(() => {
    const set = new Set(auditEvents.map((e) => e.action));
    return Array.from(set).sort();
  }, []);

  const stats = useMemo(() => ({
    total: auditEvents.length,
    critical: auditEvents.filter((e) => e.severity === "critical").length,
    warning: auditEvents.filter((e) => e.severity === "warning").length,
    info: auditEvents.filter((e) => e.severity === "info").length,
    actors: new Set(auditEvents.map((e) => e.actor)).size,
  }), []);

  return (
    <Page>
      <PageHeader
        title="Platform Audit Log"
        description="Search, filter, and review platform audit events for compliance and security analysis."
        icon={ScrollText}
        actions={
          <>
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
          <div className="flex items-center gap-2">
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
                return (
                  <div
                    key={evt.id}
                    className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors"
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
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Download className="h-4 w-4" />
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
      </PageContent>
    </Page>
  );
}
