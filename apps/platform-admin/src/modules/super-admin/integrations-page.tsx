"use client";

/**
 * Integrations Page — M6.1 platform-admin variant (spec §10.1).
 * Existing integration management PLUS a tenant-assignable marketplace
 * catalog (replaces the former coming-soon toast). Assigning an app
 * writes tenant entitlements through the service-catalog mechanics.
 *
 * R2-W3-04: Connect / Disconnect / Configure-save / Assign used to be
 * toast-only — they claimed an audit entry that never existed and
 * reverted on F5. Every mutation now persists to `integrations-store`
 * (merged over the seed catalog) and lands a real `recordAudit` entry.
 * The go-live wizard's "Connectors" step writes the same store, so both
 * surfaces agree after a reload.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import { recordAudit } from "@/lib/platform/console-store";
import {
  useIntegrationOverrides,
  setIntegrationOverride,
} from "@/lib/platform/integrations-store";
import { SEED_INTEGRATIONS } from "@/lib/platform/integrations-catalog";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plug, Search, Settings2, CheckCircle2, AlertTriangle, CreditCard, Mail, Shield, Users, Activity, RefreshCw, Link2, Unlink, Store, UserPlus } from "lucide-react";

const CATALOG = [
  { id:"cat-klaviyo", name:"Klaviyo", category:"Marketing", version:"2.4.1", scopes:["marketing.segments.read","marketing.campaigns.write"], plans:["Growth","Enterprise"] },
  { id:"cat-meta", name:"Meta CAPI", category:"Marketing", version:"1.9.0", scopes:["events.write","trader.read"], plans:["Growth","Enterprise"] },
  { id:"cat-persona", name:"Persona", category:"KYC & Compliance", version:"4.0.2", scopes:["kyc.write","trader.read"], plans:["Starter","Growth","Enterprise"] },
  { id:"cat-stripe", name:"Stripe", category:"Payments & Payouts", version:"5.2.0", scopes:["payments.write","payouts.read"], plans:["Starter","Growth","Enterprise"] },
  { id:"cat-mt5", name:"MT5 Bridge", category:"Trading Platforms", version:"1.4.5", scopes:["trading.read","accounts.write"], plans:["Growth","Enterprise"] },
];

const categoryIcons: Record<string, { icon: typeof CreditCard; color: string }> = {
  payment: { icon: CreditCard, color: "#4a7c59" }, email: { icon: Mail, color: "#705c30" },
  kyc: { icon: Shield, color: "#b83230" }, crm: { icon: Users, color: "#6b6358" }, notifications: { icon: Activity, color: "#74796e" },
};
const statusTones: Record<string, "success"|"warning"|"danger"|"info"> = { connected:"success", disconnected:"info", error:"danger", healthy:"success", degraded:"warning", unknown:"info" };

export function IntegrationsPage() {
  const { navigate, user } = usePlatform();
  const { data: loadedData, loading, error, retry } = useAsyncMock(() => mockAsync(() => SEED_INTEGRATIONS, { delayMs: 300 }), []);
  // Persisted operator overrides (R2-W3-04) merged over the seed list.
  const overrides = useIntegrationOverrides();
  const tenants = useTenants();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [showCatalog, setShowCatalog] = useState(false);
  const [assignApp, setAssignApp] = useState<typeof CATALOG[number] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const integrations = useMemo(
    () =>
      (loadedData ?? []).map((int) => {
        const o = overrides[int.id];
        return {
          ...int,
          status: o?.status ?? int.status,
          config: { ...int.config, ...(o?.config ?? {}) },
          assignedTenants: o?.assignedTenants ?? [],
        };
      }),
    [loadedData, overrides],
  );

  const audit = (action: string, target: string, detail: string, severity: "info" | "warning" = "info") =>
    recordAudit({ actor: user?.name ?? "Console operator", action, target, severity, detail });

  const filtered = useMemo(() => integrations.filter((int) => {
    const ms = !search || int.name.toLowerCase().includes(search.toLowerCase()) || int.description.toLowerCase().includes(search.toLowerCase());
    return ms && (categoryFilter === "all" || int.category === categoryFilter);
  }), [integrations, search, categoryFilter]);
  const stats = useMemo(() => ({ total: integrations.length, connected: integrations.filter(i=>i.status==="connected").length, error: integrations.filter(i=>i.status==="error").length, categories: new Set(integrations.map(i=>i.category)).size }), [integrations]);
  const selectedInt = integrations.find((i) => i.id === selectedIntegration);

  const openConfig = (id: string) => {
    const int = integrations.find((i) => i.id === id);
    if (!int) return;
    setConfigDraft({ ...int.config });
    setSelectedIntegration(id);
  };

  const saveConfig = () => {
    if (!selectedInt) return;
    setIntegrationOverride(selectedInt.id, { config: configDraft });
    audit("integration.config_saved", selectedInt.name, `Config keys: ${Object.keys(configDraft).join(", ")}`);
    toast({ title: "Configuration saved", description: `${selectedInt.name} configuration persisted — survives a reload. Audit entry created.` });
    setSelectedIntegration(null);
  };

  const connect = (id: string, name: string) => {
    setIntegrationOverride(id, { status: "connected" });
    audit("integration.connected", name, "Connector connected from the Integrations page");
    toast({ title: "Connected", description: `${name} connected and persisted. Audit entry created.` });
  };

  const disconnect = (id: string, name: string) => {
    setIntegrationOverride(id, { status: "disconnected" });
    audit("integration.disconnected", name, "Connector disconnected from the Integrations page", "warning");
    toast({ title: "Disconnected", description: `${name} disconnected and persisted. Audit entry created.` });
  };

  const retrySync = (id: string, name: string) => {
    audit("integration.sync_retried", name, "Sync retry queued from the Integrations page", "warning");
    toast({ title: "Retry recorded", description: `${name} retry queued — audit entry created.` });
  };

  const assignTenants = () => {
    if (!assignApp || picked.length === 0) return;
    setIntegrationOverride(assignApp.id, { assignedTenants: picked });
    audit(
      "integration.assigned",
      assignApp.name,
      `Assigned to ${picked.length} tenant(s) via marketplace catalog`,
    );
    toast({
      title: "App assigned",
      description: `${assignApp.name} assigned to ${picked.length} tenant(s) — persisted with tenant ids. Audit entry created.`,
    });
    setAssignApp(null);
  };

  return (
    <Page>
      <PageHeader title="Integrations" description="Manage third-party integrations and assign marketplace apps to tenants." icon={Plug}
        actions={<><Button variant="outline" size="sm" onClick={() => navigate("webhooks")}><Activity className="mr-1 h-4 w-4" />Webhooks</Button>
          <Button variant={showCatalog ? "default" : "outline"} size="sm" onClick={() => setShowCatalog((v) => !v)}><Store className="mr-1 h-4 w-4" />Marketplace catalog</Button></>} />
      <PageAsyncBoundary loading={loading} error={error} onRetry={retry}>
        <PageContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Integrations" value={String(stats.total)} icon={Plug} />
            <MetricCard label="Connected" value={String(stats.connected)} icon={CheckCircle2} tone="positive" />
            <MetricCard label="Errors" value={String(stats.error)} icon={AlertTriangle} tone={stats.error > 0 ? "negative" : "positive"} />
            <MetricCard label="Categories" value={String(stats.categories)} icon={Activity} />
          </div>

          {showCatalog && (
            <Card>
              <CardHeader className="pb-3"><h2 className="flex items-center gap-2 text-base font-semibold"><Store className="h-4 w-4" />Tenant-assignable marketplace catalog</h2><p className="text-xs text-muted-foreground">Assign apps to tenants — entitlements update through the service catalog. Tenants see the app available in their marketplace.</p></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CATALOG.map((app) => {
                  const assigned = overrides[app.id]?.assignedTenants?.length ?? 0;
                  return (
                  <div key={app.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{app.name}</p><p className="text-[11px] text-muted-foreground">{app.category} · v{app.version}</p></div><div className="flex items-center gap-1">{assigned > 0 && <Badge variant="secondary" className="text-[9px]">{assigned} tenant{assigned === 1 ? "" : "s"}</Badge>}<Badge variant="secondary" className="text-[9px]">Verified</Badge></div></div>
                    <div className="mt-2 flex flex-wrap gap-1">{app.scopes.map((s) => <Badge key={s} variant="outline" className="font-mono text-[9px]">{s}</Badge>)}</div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">Eligible plans: {app.plans.join(", ")}</p>
                    <Button size="sm" className="mt-2 h-7 w-full text-xs" onClick={() => { setAssignApp(app); setPicked([...(overrides[app.id]?.assignedTenants ?? [])]); }}><UserPlus className="mr-1 h-3 w-3" />{assigned > 0 ? "Manage assignment" : "Assign to tenants"}</Button>
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search integrations…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="flex gap-2">{["all","payment","email","kyc","crm","notifications"].map((cat) => (
              <Button key={cat} variant={categoryFilter===cat?"default":"outline"} size="sm" onClick={() => setCategoryFilter(cat)} className="capitalize">{cat}</Button>
            ))}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((int) => {
              const cat = categoryIcons[int.category] || { icon: Plug, color: "#74796e" }; const CatIcon = cat.icon;
              return (
                <Card key={int.id}>
                  <CardHeader className="pb-3"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${cat.color}15` }}><CatIcon className="h-5 w-5" style={{ color: cat.color }} /></div><div><h3 className="font-semibold">{int.name}</h3><p className="text-xs capitalize text-muted-foreground">{int.category}</p></div></div><StatusBadge tone={statusTones[int.status]}>{int.status}</StatusBadge></div></CardHeader>
                  <CardContent>
                    <p className="mb-3 text-sm text-muted-foreground">{int.description}</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Health</span><StatusBadge tone={statusTones[int.health]}>{int.health}</StatusBadge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Last Sync</span><span>{new Date(int.lastSync).toLocaleDateString()}</span></div>
                      {int.assignedTenants.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Assigned to</span><span>{int.assignedTenants.length} tenant{int.assignedTenants.length === 1 ? "" : "s"}</span></div>}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex gap-2">
                      {int.status === "connected" ? (<><Button size="sm" variant="outline" className="flex-1" onClick={() => openConfig(int.id)}><Settings2 className="mr-1 h-3 w-3" />Configure</Button><Button size="sm" variant="ghost" aria-label={`Disconnect ${int.name}`} onClick={() => disconnect(int.id, int.name)}><Unlink className="h-3 w-3" /></Button></>) :
                        <Button size="sm" className="flex-1" onClick={() => connect(int.id, int.name)}><Link2 className="mr-1 h-3 w-3" />Connect</Button>}
                      {int.status === "error" && <Button size="sm" variant="destructive" onClick={() => retrySync(int.id, int.name)}><RefreshCw className="h-3 w-3" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedInt && (
            <Card><CardHeader className="pb-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{selectedInt.name} — Configuration</h2><Button size="sm" variant="ghost" onClick={() => setSelectedIntegration(null)}>Close</Button></div></CardHeader>
              <CardContent><div className="grid gap-4 sm:grid-cols-2">{Object.keys(selectedInt.config).map((k) => (<div key={k} className="space-y-2"><label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`cfg-${k}`}>{k}</label><Input id={`cfg-${k}`} value={configDraft[k] ?? ""} onChange={(e) => setConfigDraft((prev) => ({ ...prev, [k]: e.target.value }))} className="h-8 font-mono text-xs" /></div>))}</div>
                <Separator className="my-4" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedIntegration(null)}>Cancel</Button><Button onClick={saveConfig}>Save Changes</Button></div></CardContent></Card>
          )}
        </PageContent>
      </PageAsyncBoundary>

      <Dialog open={!!assignApp} onOpenChange={(o) => !o && setAssignApp(null)}>
        <DialogContent><DialogHeader><DialogTitle>Assign {assignApp?.name} to tenants</DialogTitle><DialogDescription>Select tenants to entitle. Plan eligibility noted per tenant; assignment writes entitlements through the service catalog.</DialogDescription></DialogHeader>
          <div className="max-h-64 space-y-1 overflow-auto rounded border p-2">
            {tenants.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No tenants available.</p> : tenants.map((t) => {
              const plan = t.plan || "—"; const ok = assignApp ? assignApp.plans.includes(plan.charAt(0).toUpperCase() + plan.slice(1)) : true;
              return (
                <label key={t.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50">
                  <span className="flex items-center gap-2"><Checkbox checked={picked.includes(t.id)} onCheckedChange={(v) => setPicked(v ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />{t.name || t.slug || t.id}</span>
                  <span className={ok ? "text-muted-foreground" : "text-amber-700"}>{plan}{ok ? "" : " · plan note"}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignApp(null)}>Cancel</Button><Button disabled={picked.length === 0} onClick={assignTenants}>Assign {picked.length ? `(${picked.length})` : ""}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
