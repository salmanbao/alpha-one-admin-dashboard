"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { users as allUsers, roles as allRoles } from "@/lib/platform/mock-data";
import type { AuthUser } from "@/lib/platform/types";
import { Users, ShieldCheck, KeyRound, Clock, AlertTriangle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const platformOperators = allUsers.filter((u) => u.application === "super-admin" || u.application === "prop-admin");

const roleBadge = (r: string) =>
  r === "super-admin" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" :
  r === "prop-admin" ? "border-teal-500/30 text-teal-700 dark:text-teal-400" :
  "border-slate-500/30 text-slate-700 dark:text-slate-400";

const columns: Column<AuthUser>[] = [
  {
    key: "name",
    header: "Operator",
    cell: (u) => (
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{u.initials}</span>
        <div>
          <p className="font-medium text-foreground">{u.name}</p>
          <p className="text-[10px] text-muted-foreground">{u.email}</p>
        </div>
      </div>
    ),
    sortValue: (u) => u.name,
  },
  {
    key: "role",
    header: "Role",
    cell: (u) => u.roles.map((r) => (
      <Badge key={r} variant="outline" className={cn("mr-1 text-[10px] capitalize", roleBadge(r))}>{r}</Badge>
    )),
    sortValue: (u) => u.roles[0],
  },
  {
    key: "app",
    header: "Application",
    cell: (u) => <Badge variant="outline" className="text-[10px]">{u.application}</Badge>,
    sortValue: (u) => u.application,
  },
  {
    key: "mfa",
    header: "MFA",
    cell: () => <StatusBadge tone="success"><KeyRound className="mr-1 h-3 w-3" />Enabled</StatusBadge>,
  },
  {
    key: "lastActive",
    header: "Last Active",
    cell: (u) => <span className="text-xs text-muted-foreground">{u.lastActiveAt}</span>,
    sortValue: (u) => u.lastActiveAt,
  },
  {
    key: "status",
    header: "Status",
    cell: (u) => <StatusBadge tone={u.application === "super-admin" ? "success" : "info"}>Active</StatusBadge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: () => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="text-xs">Edit</Button>
        <Button size="sm" variant="ghost" className="text-xs text-rose-600 hover:text-rose-600">Suspend</Button>
      </div>
    ),
  },
];

export function OperatorDirectoryPage() {
  const withMfa = platformOperators.length;
  const activeSessions = platformOperators.length;

  return (
    <Page>
      <PageHeader
        title="Platform Operator Directory"
        description="Platform staff with access to the super-admin console."
        icon={Users}
        actions={<Button size="sm"><UserPlus className="mr-1 h-4 w-4" /> Invite operator</Button>}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Operators" value={platformOperators.length} icon={Users} />
          <MetricCard label="With MFA" value={withMfa} icon={KeyRound} tone="positive" />
          <MetricCard label="Active Sessions" value={activeSessions} icon={Clock} />
          <MetricCard label="Suspended" value={0} icon={AlertTriangle} tone="positive" />
        </div>
        <DataTable columns={columns} data={platformOperators} rowKey={(u) => u.id} searchableText={(u) => `${u.name} ${u.email} ${u.roles.join(" ")}`} searchPlaceholder="Search operators…" pageSize={20} emptyTitle="No operators" emptyDescription="Invite operators to get started." />
      </PageContent>
    </Page>
  );
}
