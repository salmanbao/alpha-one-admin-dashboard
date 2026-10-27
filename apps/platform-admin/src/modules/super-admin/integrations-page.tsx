"use client";

/**
 * Integrations Page — Third-party integration management (M13 Settings).
 *
 * Stitch screen: (new)
 * Tier 1 — Payment gateways, email, KYC, CRM integrations with config drawer.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Plug,
  Search,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Mail,
  Shield,
  Users,
  Activity,
  RefreshCw,
  Zap,
  Link2,
  Unlink,
} from "lucide-react";

const demoIntegrations = [
  { id: "int-001", name: "Stripe", category: "payment", description: "Payment processing for subscriptions and one-time charges", status: "connected", config: { publishableKey: "pk_live_51H8x…", webhookSigning: "Enabled", currencies: "USD, EUR, GBP" }, lastSync: "2026-10-08T14:00:00Z", health: "healthy" },
  { id: "int-002", name: "PayPal", category: "payment", description: "Alternative payment gateway for global customers", status: "connected", config: { clientId: "AeR8x…", sandbox: "Disabled", webhooks: "Enabled" }, lastSync: "2026-10-08T12:30:00Z", health: "healthy" },
  { id: "int-003", name: "Wise", category: "payment", description: "Multi-currency payouts and transfers", status: "disconnected", config: {}, lastSync: "2026-09-15T10:00:00Z", health: "unknown" },
  { id: "int-004", name: "SendGrid", category: "email", description: "Transactional email delivery", status: "connected", config: { apiKey: "SG.xK9p…", domain: "mail.pfaas.com", dailyLimit: "100,000" }, lastSync: "2026-10-08T14:30:00Z", health: "healthy" },
  { id: "int-005", name: "Mailgun", category: "email", description: "Backup email provider for redundancy", status: "disconnected", config: {}, lastSync: "2026-08-20T08:00:00Z", health: "unknown" },
  { id: "int-006", name: "Persona", category: "kyc", description: "KYC/AML identity verification", status: "connected", config: { environment: "production", webhookUrl: "https://api.pfaas.com/kyc/webhook", autoApprove: "Low risk only" }, lastSync: "2026-10-08T13:45:00Z", health: "healthy" },
  { id: "int-007", name: "Sumsub", category: "kyc", description: "Alternative KYC provider with document review", status: "error", config: { appId: "app_pfaas_01", level: "standard" }, lastSync: "2026-10-07T15:20:00Z", health: "degraded" },
  { id: "int-008", name: "HubSpot", category: "crm", description: "CRM sync for leads and customer data", status: "connected", config: { portalId: "23456789", syncInterval: "15 minutes", objects: "Contacts, Deals" }, lastSync: "2026-10-08T14:15:00Z", health: "healthy" },
  { id: "int-009", name: "Salesforce", category: "crm", description: "Enterprise CRM integration", status: "disconnected", config: {}, lastSync: "2026-07-30T09:00:00Z", health: "unknown" },
  { id: "int-010", name: "Slack", category: "notifications", description: "Team notifications for alerts and incidents", status: "connected", config: { workspace: "PFAAS Team", channels: "#alerts, #billing, #ops" }, lastSync: "2026-10-08T14:30:00Z", health: "healthy" },
];

const categoryIcons: Record<string, { icon: typeof CreditCard; color: string }> = {
  payment: { icon: CreditCard, color: "#4a7c59" },
  email: { icon: Mail, color: "#705c30" },
  kyc: { icon: Shield, color: "#b83230" },
  crm: { icon: Users, color: "#6b6358" },
  notifications: { icon: Activity, color: "#74796e" },
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info"> = {
  connected: "success",
  disconnected: "info",
  error: "danger",
  healthy: "success",
  degraded: "warning",
  unknown: "info",
};

export function IntegrationsPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoIntegrations, { delayMs: 500 }), []);
  const integrations = loadedData ?? [];
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return integrations.filter((int) => {
      const matchesSearch =
        search === "" ||
        int.name.toLowerCase().includes(search.toLowerCase()) ||
        int.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || int.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [integrations, search, categoryFilter]);

  const stats = useMemo(() => ({
    total: integrations.length,
    connected: integrations.filter((i) => i.status === "connected").length,
    error: integrations.filter((i) => i.status === "error").length,
    categories: new Set(integrations.map((i) => i.category)).size,
  }), [integrations]);

  const selectedInt = integrations.find((i) => i.id === selectedIntegration);

  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Manage third-party service integrations."
        icon={Plug}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("webhooks")}>
              <Activity className="mr-1 h-4 w-4" /> Webhooks
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Browse marketplace", description: "Integration marketplace coming soon." })}>
              <Zap className="mr-1 h-4 w-4" /> Browse Marketplace
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading integrations…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Integrations" value={stats.total} icon={Plug} />
          <MetricCard label="Connected" value={stats.connected} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Errors" value={stats.error} icon={AlertTriangle} tone={stats.error > 0 ? "negative" : "positive"} />
          <MetricCard label="Categories" value={stats.categories} icon={Settings2} />
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={categoryFilter === "all" ? "default" : "outline"} onClick={() => setCategoryFilter("all")}>All</Button>
            {Object.keys(categoryIcons).map((cat) => (
              <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} onClick={() => setCategoryFilter(cat)} className="text-[10px] capitalize">
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Integration cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((int) => {
            const cat = categoryIcons[int.category];
            const Icon = cat?.icon ?? Plug;
            return (
              <Card key={int.id} className={selectedIntegration === int.id ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center" style={{ background: `${cat?.color ?? "#6b6358"}20`, color: cat?.color ?? "#6b6358" }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{int.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{int.category}</p>
                      </div>
                    </div>
                    <StatusBadge tone={statusTones[int.status]}>{int.status}</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{int.description}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Health</span>
                      <StatusBadge tone={statusTones[int.health]}>{int.health}</StatusBadge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span>{new Date(int.lastSync).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex gap-2">
                    {int.status === "connected" ? (
                      <>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedIntegration(int.id)}>
                          <Settings2 className="mr-1 h-3 w-3" /> Configure
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast({ title: "Disconnected", description: `${int.name} disconnected. Audit logged.` })}>
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="flex-1" onClick={() => toast({ title: "Connected", description: `${int.name} connected. Configure credentials to start syncing.` })}>
                        <Link2 className="mr-1 h-3 w-3" /> Connect
                      </Button>
                    )}
                    {int.status === "error" && (
                      <Button size="sm" variant="destructive" onClick={() => toast({ title: "Retry sync", description: `Retry sync for ${int.name} queued.` })}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Config drawer */}
        {selectedInt && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedInt.name} — Configuration</h2>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIntegration(null)}>Close</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(selectedInt.config).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</label>
                    <Input value={value} readOnly className="h-8 font-mono text-xs" />
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedIntegration(null)}>Cancel</Button>
                <Button onClick={() => { toast({ title: "Configuration saved", description: `${selectedInt.name} configuration updated. Audited.` }); setSelectedIntegration(null); }}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
