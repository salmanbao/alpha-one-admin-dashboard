"use client";

/**
 * Super Admin Pages — platform-level administration.
 *
 * Spec section 6. Overview, Tenants, Module Catalog, System Health.
 * Only visible when the current user's application is super-admin.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { tenants as allTenants, type TenantContext } from "@/lib/platform/mock-data";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  Building2,
  Package,
  Server,
  BarChart3,
  ShieldCheck,
  Users,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Database,
  Globe,
  Zap,
} from "lucide-react";

const tenantStatusTone = (s: string) =>
  s === "active" ? "success" : s === "trial" ? "info" : s === "suspended" ? "danger" : "warning";

export function SuperAdminOverviewPage() {
  const { setTenant, setUser, navigate } = usePlatform();
  const totalTraders = allTenants.length * 26; // approx from mock
  const totalRevenue = allTenants.reduce((s, t) => s + (t.plan === "enterprise" ? 4900 : t.plan === "scale" ? 1900 : 890), 0);
  const allModules = moduleRegistry.getAll();

  return (
    <Page>
      <PageHeader title="Platform Overview" description="PFaaS platform health and tenant summary." icon={BarChart3} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active Tenants" value={allTenants.length} delta={3} icon={Building2} tone="positive" />
          <MetricCard label="Total Traders" value={formatCompact(totalTraders)} delta={8} icon={Users} />
          <MetricCard label="MRR" value={formatCurrency(totalRevenue)} delta={12} icon={DollarSign} tone="positive" />
          <MetricCard label="Modules" value={allModules.length} icon={Package} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Tenant distribution</span></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allTenants.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.branding.primaryColor }} />
                    <span className="flex-1 text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.plan}</Badge>
                    <StatusBadge tone={tenantStatusTone(t.status)}>{t.status}</StatusBadge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Module adoption</span></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allModules.map((m) => {
                  const count = allTenants.filter((t) => t.enabledModules.includes(m.manifest.id)).length;
                  const pct = Math.round((count / allTenants.length) * 100);
                  return (
                    <div key={m.manifest.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{m.manifest.name}</span>
                        <span className="text-muted-foreground">{count}/{allTenants.length}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}

export function TenantsPage() {
  const { setTenant, setUser, availableTenants } = usePlatform();
  const tenants = availableTenants.filter((t) => t.id !== "platform");

  const columns: Column<TenantContext>[] = [
    {
      key: "name",
      header: "Tenant",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: t.branding.primaryColor }}>{t.branding.initials}</span>
          <div>
            <p className="font-medium text-foreground">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">{t.branding.tagline}</p>
          </div>
        </div>
      ),
      sortValue: (t) => t.name,
    },
    { key: "plan", header: "Plan", cell: (t) => <Badge variant="outline" className="text-[10px] capitalize">{t.plan}</Badge>, sortValue: (t) => t.plan },
    { key: "status", header: "Status", cell: (t) => <StatusBadge tone={tenantStatusTone(t.status)}>{t.status}</StatusBadge>, sortValue: (t) => t.status },
    { key: "modules", header: "Modules", cell: (t) => <span className="text-sm font-medium">{t.enabledModules.length}</span>, sortValue: (t) => t.enabledModules.length },
    { key: "features", header: "Features", cell: (t) => t.enabledFeatures.length, sortValue: (t) => t.enabledFeatures.length },
    { key: "currency", header: "Currency", cell: (t) => t.currency, sortValue: (t) => t.currency },
    { key: "created", header: "Created", cell: (t) => <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>, sortValue: (t) => t.createdAt },
    {
      key: "actions",
      header: "",
      cell: (t) => (
        <Button size="sm" variant="outline" onClick={() => {
          setTenant(t);
          toast({ title: "Impersonating tenant", description: `Now viewing ${t.name}` });
        }}>
          View
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Tenants" description={`${tenants.length} tenants on the platform.`} icon={Building2} actions={<Button size="sm" onClick={() => toast({ title: "Invite tenant", description: "Invitation form (demo)." })}><Building2 className="mr-1 h-4 w-4" /> Invite tenant</Button>} />
      <PageContent>
        <DataTable columns={columns} data={tenants} rowKey={(t) => t.id} searchableText={(t) => `${t.name} ${t.plan} ${t.status}`} searchPlaceholder="Search tenants…" />
      </PageContent>
    </Page>
  );
}

export function ModuleCatalogPage() {
  const allModules = moduleRegistry.getAll();
  return (
    <Page>
      <PageHeader title="Service Catalog" description="All modules available on the platform." icon={Package} />
      <PageContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {allModules.map((m) => {
            const Icon = m.manifest.icon;
            const adopters = allTenants.filter((t) => t.enabledModules.includes(m.manifest.id)).length;
            return (
              <Card key={m.manifest.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md p-2" style={{ background: `${m.manifest.accentColor}1a` }}>
                      {Icon ? <Icon className="h-5 w-5" style={{ color: m.manifest.accentColor }} /> : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.manifest.name}</span>
                        <Badge variant="outline" className="text-[9px]">{m.manifest.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.manifest.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs text-muted-foreground">{m.manifest.description}</p>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{adopters} tenant{adopters !== 1 ? "s" : ""}</span>
                    <div className="flex flex-wrap gap-1">
                      {m.manifest.supportedApplications?.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[9px]">{a}</Badge>
                      ))}
                    </div>
                  </div>
                  {m.manifest.permissions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.manifest.permissions.slice(0, 4).map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[9px]">{p.id}</Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </Page>
  );
}

export function PlatformHealthPage() {
  const services = [
    { name: "API Gateway", status: "operational", latency: "42ms", icon: Globe },
    { name: "Database", status: "operational", latency: "8ms", icon: Database },
    { name: "MT5 Bridge", status: "operational", latency: "120ms", icon: Zap },
    { name: "Payment Processor", status: "degraded", latency: "850ms", icon: DollarSign },
    { name: "KYC Provider", status: "operational", latency: "310ms", icon: ShieldCheck },
    { name: "AI Engine", status: "operational", latency: "1.2s", icon: Cpu },
  ];

  const statusTone = (s: string) => s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

  return (
    <Page>
      <PageHeader title="System Health" description="Platform service status and metrics." icon={Server} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Uptime (30d)" value="99.97%" icon={Activity} tone="positive" />
          <MetricCard label="Avg Latency" value="142ms" icon={Zap} />
          <MetricCard label="Error Rate" value="0.03%" icon={AlertTriangle} tone="positive" />
          <MetricCard label="Active Sessions" value="284" icon={Users} />
        </div>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Service status</span></CardHeader>
          <CardContent className="space-y-2">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Latency: {s.latency}</p>
                  </div>
                  <StatusBadge tone={statusTone(s.status)}>{s.status}</StatusBadge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
