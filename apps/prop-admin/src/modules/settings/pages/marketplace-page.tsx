"use client";

/**
 * M6.1 — Integration Marketplace (spec §10.1).
 * Category browsing, app cards with scope previews, and a
 * consent-based 3-step install wizard (permissions → config →
 * post-install). Install disabled until scopes are consented.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { Search, Store, ShieldCheck, CheckCircle2, ExternalLink, Puzzle } from "lucide-react";
import { CATEGORIES, listCatalog, installApp, type AppCategory, type MarketplaceApp } from "../marketplace-store";
import { getConnectorDefinition } from "@/modules/integrations/registry";
import { ConfigFieldControl, validateConfig, type FieldErrors } from "@/modules/integrations/config-fields";

export function MarketplacePage() {
  const { navigate } = usePlatform();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AppCategory | "All">("All");
  const [target, setTarget] = useState<MarketplaceApp | null>(null);

  const apps = useMemo(() => {
    const needle = q.toLowerCase();
    return listCatalog().filter((a) => (cat === "All" || a.category === cat) && (!needle || a.name.toLowerCase().includes(needle) || a.publisher.toLowerCase().includes(needle) || a.category.toLowerCase().includes(needle)));
  }, [q, cat]);

  return (
    <Page>
      <PageHeader title="Marketplace" description="Installable integrations with honest, consent-based permissions." icon={Store}
        actions={<Button variant="outline" size="sm" onClick={() => navigate("installed-apps")}>Installed Apps</Button>} />
      <PageContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps, publishers, categories…" className="pl-8" aria-label="Search marketplace" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCat("All")} className={`rounded-full border px-3 py-1 text-xs ${cat === "All" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{c}</button>
          ))}
        </div>

        {apps.length === 0 ? (
          <EmptyState title="No apps in this category" description="We’re expanding the catalog. You can build a connector or become a publisher." icon={Puzzle}
            hint="Become a publisher — see the integration docs."
            action={<Button size="sm" variant="outline" onClick={() => toast({ title: "Publisher docs", description: "Docs link opened (dummy)." })}>Publisher docs</Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className="group transition-shadow hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{app.name}</p>
                      <p className="text-[11px] text-muted-foreground">{app.publisher}</p>
                    </div>
                    {app.verified && <Badge variant="secondary" className="text-[9px]">Verified</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{app.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.scopes.slice(0, 3).map((s) => <Badge key={s.id} variant="outline" className="text-[9px] font-mono">{s.id}</Badge>)}
                    {app.scopes.length > 3 && <Badge variant="outline" className="text-[9px]">+{app.scopes.length - 3}</Badge>}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>★ {app.rating} · {app.installs.toLocaleString()} installs</span>
                    <Button size="sm" className="h-7 text-xs opacity-90 group-hover:opacity-100" onClick={() => setTarget(app)}>Install</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <InstallDrawer app={target} onClose={() => setTarget(null)} onInstalled={(name) => { setTarget(null); toast({ title: "App installed", description: `${name} is enabled with consented scopes.` }); }} />
    </Page>
  );
}

function InstallDrawer({ app, onClose, onInstalled }: { app: MarketplaceApp | null; onClose: () => void; onInstalled: (name: string) => void }) {
  const [step, setStep] = useState<1|2|3>(1);
  const [consented, setConsented] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [fail, setFail] = useState("");

  // reset when app changes
  const [lastId, setLastId] = useState<string | null>(null);
  if (app && app.id !== lastId) { setLastId(app.id); setStep(1); setConsented(Object.fromEntries(app.scopes.map((s) => [s.id, s.required]))); setValues({}); setErrors({}); setFail(""); }

  const def = app ? getConnectorDefinition(app.id.replace("app-", "")) : undefined; // reuse M1 schema when available
  const allRequiredConsented = app ? app.scopes.filter((s) => s.required).every((s) => consented[s.id]) : false;

  function doInstall() {
    if (!app) return;
    if (def && def.fields.length > 0) {
      const e = validateConfig(def, values);
      if (Object.keys(e).length) { setErrors(e); setStep(2); setFail("Fix the highlighted fields to continue."); return; }
    }
    // Simulate rare install failure path
    if (values._simulate_fail === "1") { setFail("Provider refused the credential exchange (simulated). Check the app configuration and retry."); return; }
    installApp(app.id, "You");
    recordAudit({ action: "marketplace.install", entity: "installed-app", entityId: app.id, summary: `Installed ${app.name} v${app.version}; scopes consented: ${Object.entries(consented).filter(([, v]) => v).map(([k]) => k).join(", ")}`, module: "settings" });
    setStep(3);
  }

  return (
    <Sheet open={!!app} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {app && (
          <>
            <SheetHeader>
              <SheetTitle>Install {app.name}</SheetTitle>
              <SheetDescription>{app.publisher} · v{app.version} · {app.category}</SheetDescription>
            </SheetHeader>

            <div className="mt-2 flex gap-1 text-[11px]">
              {[1,2,3].map((n) => <span key={n} className={`rounded-full px-2 py-0.5 ${step === n ? "bg-primary text-primary-foreground" : step > n ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{n === 1 ? "Permissions" : n === 2 ? "Configure" : "Checklist"}</span>)}
            </div>

            {fail && <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive">{fail} <button type="button" className="ml-1 underline" onClick={() => { setFail(""); }}>Retry</button></div>}

            {step === 1 && (
              <div className="mt-4 space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-primary" />This app requests the following permissions</p>
                {app.scopes.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                    <Checkbox checked={!!consented[s.id]} disabled={s.required} onCheckedChange={(v) => setConsented({ ...consented, [s.id]: !!v })} aria-label={s.label} />
                    <span><span className="block">{s.label}</span><span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>{s.required && <Badge variant="secondary" className="ml-1 text-[9px]">required</Badge>}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={allRequiredConsented} onCheckedChange={() => { const all: Record<string, boolean> = {}; app.scopes.forEach((s) => (all[s.id] = true)); setConsented(all); }} />Consent to the scopes above to continue</label>
                <Button className="w-full" disabled={!allRequiredConsented} onClick={() => setStep(2)}>Continue</Button>
              </div>
            )}

            {step === 2 && (
              <div className="mt-4 space-y-3">
                {def && def.fields.length > 0 ? def.fields.map((f) => (
                  <ConfigFieldControl key={f.key} field={f} value={values[f.key] ?? ""} error={errors[f.key]} onChange={(v) => { setValues({ ...values, [f.key]: v }); if (errors[f.key]) setErrors({ ...errors, [f.key]: "" }); }} idPrefix="mkt" />
                )) : <p className="text-xs text-muted-foreground">No configuration required for this app. Continue to install.</p>}
                <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button className="flex-1" onClick={doInstall}>Install</Button></div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />{app.name} installed and scopes granted.</div>
                <p className="text-xs font-semibold">Post-install checklist</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />First sync queued</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Test event ready</li>
                  <li className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /><a href="#" className="underline" onClick={(e) => { e.preventDefault(); toast({ title: "Docs opened" }); }}>Read the {app.name} docs</a></li>
                </ul>
                <Button className="w-full" onClick={() => onInstalled(app.name)}>Done</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
