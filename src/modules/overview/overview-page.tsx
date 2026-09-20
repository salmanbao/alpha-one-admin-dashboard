"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { DashboardGrid } from "@/components/platform/dashboard-grid";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { moduleRegistry } from "@/lib/platform/module-registry";

export function OverviewPage() {
  const { runtime, tenant, user } = usePlatform();
  const enabled = moduleRegistry.getEnabledModules(runtime);

  return (
    <Page>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={`${tenant.branding.name} · ${enabled.length} modules active · ${user.roles[0]?.replace("-", " ")}`}
        icon={LayoutDashboard}
        actions={
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> {tenant.plan} plan
          </Badge>
        }
      />
      <PageContent>
        <DashboardGrid />
      </PageContent>
    </Page>
  );
}
