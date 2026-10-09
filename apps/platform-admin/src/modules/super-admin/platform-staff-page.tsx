"use client";

/**
 * Platform Staff Page — Platform-level user/staff management.
 *
 * Stitch screen: platform_staff
 * Tier 1 — Manage platform operators, their roles, and access.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  ShieldAlert,
  Building2,
  LogOut,
  Key,
} from "lucide-react";

// Demo platform staff
const platformStaff = [
  {
    id: "staff-1",
    name: "Marcus Vance",
    email: "marcus.vance@pfaas.io",
    role: "Platform Administrator",
    level: "L5",
    status: "active",
    lastActive: "2 min ago",
    permissions: 48,
    tenantAccess: "All Tenants",
    color: "#4a7c59",
    initials: "MV",
  },
  {
    id: "staff-2",
    name: "Sarah Chen",
    email: "sarah.chen@pfaas.io",
    role: "Security Officer",
    level: "L4",
    status: "active",
    lastActive: "15 min ago",
    permissions: 32,
    tenantAccess: "All Tenants",
    color: "#b83230",
    initials: "SC",
  },
  {
    id: "staff-3",
    name: "James Rodriguez",
    email: "james.r@pfaas.io",
    role: "Billing Administrator",
    level: "L3",
    status: "active",
    lastActive: "1 hour ago",
    permissions: 16,
    tenantAccess: "All Tenants",
    color: "#6b6358",
    initials: "JR",
  },
  {
    id: "staff-4",
    name: "Emily Kim",
    email: "emily.kim@pfaas.io",
    role: "Tenant Operator",
    level: "L2",
    status: "active",
    lastActive: "3 hours ago",
    permissions: 12,
    tenantAccess: "Alpha, Beta, Gamma",
    color: "#705c30",
    initials: "EK",
  },
  {
    id: "staff-5",
    name: "David Park",
    email: "david.park@pfaas.io",
    role: "Audit Reviewer",
    level: "L3",
    status: "inactive",
    lastActive: "2 days ago",
    permissions: 8,
    tenantAccess: "All Tenants",
    color: "#4a4e4a",
    initials: "DP",
  },
  {
    id: "staff-6",
    name: "Lisa Thompson",
    email: "lisa.t@pfaas.io",
    role: "Support Agent",
    level: "L1",
    status: "active",
    lastActive: "5 min ago",
    permissions: 6,
    tenantAccess: "Alpha Capital",
    color: "#74796e",
    initials: "LT",
  },
  {
    id: "staff-7",
    name: "Michael Brown",
    email: "michael.b@pfaas.io",
    role: "Support Agent",
    level: "L1",
    status: "suspended",
    lastActive: "1 week ago",
    permissions: 6,
    tenantAccess: "Beta Trading",
    color: "#74796e",
    initials: "MB",
  },
  {
    id: "staff-8",
    name: "Anna Martinez",
    email: "anna.m@pfaas.io",
    role: "Tenant Operator",
    level: "L2",
    status: "active",
    lastActive: "30 min ago",
    permissions: 12,
    tenantAccess: "Gamma, Delta",
    color: "#705c30",
    initials: "AM",
  },
];

const roleColors: Record<string, string> = {
  "Platform Administrator": "#4a7c59",
  "Security Officer": "#b83230",
  "Billing Administrator": "#6b6358",
  "Tenant Operator": "#705c30",
  "Audit Reviewer": "#4a4e4a",
  "Support Agent": "#74796e",
};

export function PlatformStaffPage() {
  const { navigate } = usePlatform();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return platformStaff.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const stats = useMemo(() => ({
    total: platformStaff.length,
    active: platformStaff.filter((s) => s.status === "active").length,
    inactive: platformStaff.filter((s) => s.status === "inactive").length,
    suspended: platformStaff.filter((s) => s.status === "suspended").length,
  }), []);

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    platformStaff.forEach((s) => {
      counts[s.role] = (counts[s.role] ?? 0) + 1;
    });
    return Object.entries(counts).map(([role, count]) => ({
      role,
      count,
      pct: Math.round((count / stats.total) * 100),
      color: roleColors[role] ?? "#74796e",
    }));
  }, [stats.total]);

  return (
    <Page>
      <PageHeader
        title="Platform Staff"
        description="Manage platform operators, their roles, and access permissions."
        icon={Users}
        actions={
          <Button size="sm" onClick={() => {}}>
            <Plus className="mr-1 h-4 w-4" /> Invite Staff
          </Button>
        }
      />
      <PageContent>
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Staff" value={stats.total} icon={Users} />
          <MetricCard label="Active Now" value={stats.active} delta={8} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Inactive" value={stats.inactive} icon={LogOut} tone="warning" />
          <MetricCard label="Suspended" value={stats.suspended} icon={ShieldAlert} tone="negative" />
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "active", "inactive", "suspended"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Role distribution */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Role Distribution</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roleDistribution.map((r) => (
                <div key={r.role} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: r.color }}>
                    {r.role.slice(0, 2)}
                  </div>
                  <span className="flex-1 text-sm">{r.role}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={r.pct} className="h-1.5 w-20" />
                    <span className="text-xs text-muted-foreground">{r.count} ({r.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Staff table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant Access</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: s.color }}
                          >
                            {s.initials}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {s.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                          style={{ borderColor: s.color, color: s.color }}
                        >
                          {s.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] font-mono">{s.level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{s.tenantAccess}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Key className="h-3 w-3" /> {s.permissions}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.lastActive}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={
                            s.status === "active"
                              ? "success"
                              : s.status === "inactive"
                                ? "muted"
                                : "danger"
                          }
                        >
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 font-medium">No staff members found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
