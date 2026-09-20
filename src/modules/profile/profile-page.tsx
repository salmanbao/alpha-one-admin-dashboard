"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, EntityHeader } from "@/components/platform/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { User, Shield, Bell, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ProfilePage() {
  const { user, tenant } = usePlatform();
  return (
    <Page>
      <PageHeader title="Profile" description="Your account and access." icon={User} />
      <PageContent>
        <EntityHeader
          title={user.name}
          subtitle={user.email}
          avatar={<Avatar className="h-14 w-14"><AvatarFallback className="bg-muted">{user.initials}</AvatarFallback></Avatar>}
          badges={
            <>
              <StatusBadge tone="info">{user.application}</StatusBadge>
              {user.roles.map((r) => (
                <Badge key={r} variant="outline">{r.replace("-", " ")}</Badge>
              ))}
            </>
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><div className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="text-sm font-medium">Roles & permissions</span></div></CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">Roles:</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {user.roles.map((r) => <Badge key={r}>{r}</Badge>)}
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{user.permissions.length} permissions granted</p>
              <div className="flex flex-wrap gap-1">
                {user.permissions.slice(0, 12).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
                {user.permissions.length > 12 ? <Badge variant="outline" className="text-[10px]">+{user.permissions.length - 12} more</Badge> : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><div className="flex items-center gap-2"><Settings className="h-4 w-4" /><span className="text-sm font-medium">Tenant</span></div></CardHeader>
            <CardContent>
              <p className="text-sm">{tenant.branding.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.plan} plan · {tenant.currency} · {tenant.timezone}</p>
              <p className="mt-2 text-xs text-muted-foreground">Last active: {new Date(user.lastActiveAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
