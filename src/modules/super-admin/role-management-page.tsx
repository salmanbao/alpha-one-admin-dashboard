"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { roles as allRoles } from "@/lib/platform/mock-data";
import { UserCheck, ShieldCheck, Lock, Users } from "lucide-react";

export function RoleManagementPage() {
  return (
    <Page>
      <PageHeader title="Platform Role Management" description="Manage platform roles, permissions, and scope assignments." icon={UserCheck} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Roles" value={allRoles.length} icon={UserCheck} />
          <MetricCard label="Super Admin" value={allRoles.filter((r) => r.application === "super-admin").length} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Prop Admin" value={allRoles.filter((r) => r.application === "prop-admin").length} icon={Users} />
          <MetricCard label="Trader" value={allRoles.filter((r) => r.application === "trader").length} icon={Lock} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {allRoles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{r.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{r.application}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{r.permissions.length} perms</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.slice(0, 8).map((p) => (
                    <Badge key={p} variant="secondary" className="text-[9px] font-mono">{p}</Badge>
                  ))}
                  {r.permissions.length > 8 && (
                    <Badge variant="outline" className="text-[9px]">+{r.permissions.length - 8} more</Badge>
                  )}
                </div>
                {r.color && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    Role color
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Role governance</p>
          <p className="mt-1">Platform roles control access to the super-admin console. Tenant roles (prop-admin, trader) control access within individual tenants. Role changes are audited and require two-operator approval for privilege escalation.</p>
        </div>
      </PageContent>
    </Page>
  );
}
