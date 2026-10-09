"use client";

/**
 * Platform Roles Page — Multi-tenant RBAC matrix.
 *
 * Stitch screen: platform_roles
 * Tier 1 — Platform-level role management with permission matrix.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  Users,
  ShieldAlert,
  Plus,
  Edit2,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";

// Demo platform roles
const platformRoles = [
  {
    id: "platform-admin",
    name: "Platform Administrator",
    description: "Full access to all platform-level operations, tenant management, and system configuration.",
    permissions: ["platform.*"],
    users: 3,
    status: "active",
    color: "#4a7c59",
  },
  {
    id: "billing-admin",
    name: "Billing Administrator",
    description: "Manage global billing, invoices, payment methods, and subscription plans across tenants.",
    permissions: ["platform.billing.*", "platform.tenants.read"],
    users: 2,
    status: "active",
    color: "#6b6358",
  },
  {
    id: "security-officer",
    name: "Security Officer",
    description: "Monitor platform security, audit logs, incident response, and compliance reporting.",
    permissions: ["platform.audit.*", "platform.health.read", "platform.emergency.read"],
    users: 4,
    status: "active",
    color: "#b83230",
  },
  {
    id: "tenant-operator",
    name: "Tenant Operator",
    description: "Day-to-day tenant management and support operations. Read-only access to platform metrics.",
    permissions: ["platform.tenants.read", "platform.tenants.manage"],
    users: 12,
    status: "active",
    color: "#705c30",
  },
  {
    id: "audit-reviewer",
    name: "Audit Reviewer",
    description: "Read-only access to platform audit logs for compliance and forensic review.",
    permissions: ["platform.audit.read"],
    users: 8,
    status: "active",
    color: "#4a4e4a",
  },
  {
    id: "support-agent",
    name: "Support Agent",
    description: "Access to tenant support tools, ticket management, and customer-facing data.",
    permissions: ["platform.tenants.read", "support.*"],
    users: 24,
    status: "active",
    color: "#74796e",
  },
];

const allPermissions = [
  { id: "platform.tenants.*", label: "Tenants (CRUD)" },
  { id: "platform.tenants.read", label: "View Tenants" },
  { id: "platform.tenants.manage", label: "Manage Tenants" },
  { id: "platform.tenants.impersonate", label: "Impersonate Tenant" },
  { id: "platform.tenants.export", label: "Export Tenant Data" },
  { id: "platform.modules.*", label: "Modules (CRUD)" },
  { id: "platform.modules.manage", label: "Manage Module Catalog" },
  { id: "platform.health.*", label: "System Health" },
  { id: "platform.health.read", label: "View System Health" },
  { id: "platform.audit.*", label: "Audit Logs (CRUD)" },
  { id: "platform.audit.read", label: "Read Platform Audit" },
  { id: "platform.billing.*", label: "Billing (CRUD)" },
  { id: "platform.billing.manage", label: "Manage Billing" },
  { id: "platform.emergency.*", label: "Emergency Controls" },
  { id: "platform.emergency.manage", label: "Emergency Controls" },
  { id: "support.*", label: "Support (All)" },
  { id: "support.tickets.*", label: "Support Tickets" },
];

export function PlatformRolesPage() {
  const { navigate } = usePlatform();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const role = useMemo(
    () => platformRoles.find((r) => r.id === selectedRole) ?? platformRoles[0],
    [selectedRole]
  );

  return (
    <Page>
      <PageHeader
        title="Platform Roles"
        description="Multi-tenant RBAC matrix for platform-level access control."
        icon={ShieldCheck}
        actions={
          <Button size="sm" onClick={() => {}}>
            <Plus className="mr-1 h-4 w-4" /> Create Role
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Role list */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Roles</h2>
                <Badge variant="secondary" className="text-[10px]">{platformRoles.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {platformRoles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                      selectedRole === r.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                      style={{ background: r.color }}
                    >
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.users} users</p>
                    </div>
                    {r.status === "active" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role detail */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
                      style={{ background: role.color }}
                    >
                      {role.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{role.name}</h2>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Edit2 className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <Copy className="mr-1 h-4 w-4" /> Duplicate
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Users Assigned</p>
                      <p className="mt-1 text-2xl font-bold">{role.users}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Permissions</p>
                      <p className="mt-1 text-2xl font-bold">{role.permissions.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge tone={role.status === "active" ? "success" : "muted"}>
                          {role.status}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Permissions matrix */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Permission Matrix</h3>
                      <Badge variant="secondary" className="text-[10px]">{role.permissions.length} granted</Badge>
                    </div>
                    <div className="space-y-1">
                      {allPermissions.map((perm) => {
                        const granted = role.permissions.some(
                          (p) => p === perm.id || (p.endsWith(".*") && perm.id.startsWith(p.replace(".*", "")))
                        );
                        return (
                          <div
                            key={perm.id}
                            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                              granted ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-muted/50"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {granted ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                              )}
                              <span className="text-muted-foreground">{perm.label}</span>
                            </span>
                            <Badge variant={granted ? "default" : "outline"} className="text-[9px]">
                              {granted ? "Granted" : "—"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Tenant access */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Tenant Access Scope</h3>
                    <div className="space-y-2">
                      {platformRoles.map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                            role.permissions.some((p) => p.includes(".*")) ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                              style={{ background: r.color }}
                            >
                              {r.name.slice(0, 2)}
                            </div>
                            <span className="text-muted-foreground">{r.name}</span>
                          </div>
                          {role.permissions.some((p) => p.includes(".*")) ? (
                            <Badge className="text-[9px] bg-primary text-primary-foreground">All</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px]">Specific</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
