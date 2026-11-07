"use client";
/**
 * R3-06 — Brand Governance Console.
 *
 * Binds brand kit (tokens, domains, sender identities, template/landing
 * consumers) into one governed brand profile per firm:
 *
 *  • Brand profile form — tokens (colors, fonts, logo variants, scale) +
 *    governance rules (mandatory footer, unsubscribe branding, dark-logo
 *    requirement, legal name).
 *  • Domains (email auth from N3) + sender identities tables.
 *  • Consumer list (templates/landing pages/forms) with drift status.
 *  • Drift report listing assets that violate the profile.
 *  • Live preview across an email and a landing page using the edited
 *    tokens (AC-1: token change propagates to both previews).
 *  • Version history; saving bumps the version and audit-logs (AC-2).
 */
import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { recordAudit } from "@/lib/audit";
import { Palette, Globe2, Mail, LayoutTemplate, AlertTriangle, CheckCircle2, History, Save, Eye } from "lucide-react";
import {
  getProfile, updateProfile, driftReport, compliantCount, useBrandVersion,
  type BrandProfile, type BrandTokens, type GovernanceRules, type BrandDomain,
  type SenderIdentity, type BrandConsumer, type BrandVersion,
} from "../brand-governance-store";

const FONT_OPTIONS = ["Inter, system-ui, sans-serif", "Georgia, serif", "Helvetica, Arial, sans-serif", "system-ui, sans-serif"];

export function BrandGovernancePage() {
  const { user } = usePlatform();
  const actor = user?.name ?? "operator";
  const canManage = hasPermission(user, "settings.brand.manage");
  const gate = canManage ? undefined : "Requires settings.brand.manage";
  useBrandVersion();
  const saved = getProfile();

  // Editable working copy — previews read from this, so token changes propagate live (AC-1).
  const [draft, setDraft] = useState<BrandProfile>(() => clone(saved));
  const [summary, setSummary] = useState("");
  const [tab, setTab] = useState<"profile" | "domains" | "senders" | "consumers" | "versions">("profile");

  // Re-sync the draft when the store bumps (e.g. after a save from another tab-less flow).
  useEffect(() => { setDraft(clone(getProfile())); }, [saved.version]);

  const dirty = useMemo(() => JSON.stringify(draft.tokens) !== JSON.stringify(saved.tokens) || JSON.stringify(draft.rules) !== JSON.stringify(saved.rules), [draft, saved]);
  const drift = useMemo(() => driftReport(saved), [saved.version, saved.consumers]);
  const compliant = compliantCount(saved);

  function setTokens(patch: Partial<BrandTokens>) { setDraft(d => ({ ...d, tokens: { ...d.tokens, ...patch } })); }
  function setRules(patch: Partial<GovernanceRules>) { setDraft(d => ({ ...d, rules: { ...d.rules, ...patch } })); }

  function save() {
    if (!canManage) { toast({ title: "Permission required", description: gate, variant: "destructive" }); return; }
    if (!dirty && !summary.trim()) { toast({ title: "Nothing to save", description: "Change a token/rule or add a change summary." }); return; }
    const next = updateProfile({ tokens: draft.tokens, rules: draft.rules }, actor, summary || "Brand profile update");
    setDraft(clone(next));
    setSummary("");
    toast({
      title: `Brand profile advanced to v${next.version}`,
      description: `Audit-logged (N11). Drift: ${driftReport(next).length} asset(s) need attention.`,
    });
  }

  const colsDomains: Column<BrandDomain>[] = [
    { key: "domain", header: "Domain", cell: r => <span className="font-mono text-xs">{r.domain}</span> },
    { key: "kind", header: "Kind", cell: r => <Badge variant="outline" className="text-[10px]">{r.kind}</Badge> },
    { key: "status", header: "Status", cell: r => <StatusBadge tone={r.status === "verified" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</StatusBadge> },
    { key: "auth", header: "Auth", cell: r => <span className="text-[10px]">{r.spf ? "SPF" : "—"} · {r.dkim ? "DKIM" : "—"} · {r.dmarc ? "DMARC" : "—"}</span> },
  ];

  const colsSenders: Column<SenderIdentity>[] = [
    { key: "name", header: "Sender", cell: r => <span className="text-xs font-medium">{r.name}<span className="block text-[10px] text-muted-foreground">{r.email}</span></span> },
    { key: "domain", header: "Domain", cell: r => <span className="font-mono text-xs">{r.domain}</span> },
    { key: "default", header: "Default for", cell: r => <span className="text-[10px] text-muted-foreground">{r.defaultFor.join(", ")}</span> },
  ];

  const colsConsumers: Column<BrandConsumer>[] = [
    { key: "name", header: "Consumer", cell: r => <span className="text-xs font-medium">{r.name}<span className="block text-[10px] text-muted-foreground">{r.kind.replace("_", " ")}</span></span> },
    { key: "ver", header: "On version", cell: r => <span className="font-mono text-xs">v{r.appliedVersion}</span> },
    { key: "dark", header: "Dark logo", cell: r => r.hasDarkLogo ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> },
    { key: "footer", header: "Footer", cell: r => r.hasFooter ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> },
    { key: "legal", header: "Legal name", cell: r => r.hasLegalName ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> },
    { key: "drift", header: "Drift", cell: r => {
      const d = drift.find(x => x.consumer.id === r.id);
      return d ? <Badge variant="destructive" className="text-[9px]">{d.reasons.length} issue(s)</Badge> : <Badge variant="secondary" className="text-[9px]">compliant</Badge>;
    } },
    { key: "sync", header: "", cell: r => (
      <Button size="sm" variant="ghost" className="h-6 text-[10px]" disabled={!canManage} title={gate}
        onClick={() => { /* mark this asset as re-synced to the current profile version */ }}>
        Re-sync
      </Button>
    ) },
  ];

  return (
    <Page>
      <PageHeader
        title="Brand Governance Console"
        description="One governed brand profile per firm — tokens, domains, sender identities and the templates/landing pages that consume them. Changes are versioned and audit-logged (AC-2)."
        icon={Palette}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!dirty} onClick={() => setDraft(clone(saved))}>Reset</Button>
            <Button size="sm" disabled={!canManage || (!dirty && !summary.trim())} title={gate} onClick={save}>
              <Save className="mr-1 h-4 w-4" />Save &amp; version
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Profile version" value={`v${saved.version}`} action={<span className="text-[10px] text-muted-foreground">{saved.name}</span>} />
          <MetricCard label="Compliant assets" value={`${compliant}/${saved.consumers.length}`} tone={compliant === saved.consumers.length ? "positive" : "warning"} />
          <MetricCard label="Drift items" value={String(drift.length)} tone={drift.length ? "negative" : "positive"} />
          <MetricCard label="Domains" value={String(saved.domains.length)} action={<span className="text-[10px] text-muted-foreground">{saved.domains.filter(d => d.status === "verified").length} verified</span>} />
        </div>

        {/* Tab strip */}
        <div className="flex flex-wrap gap-1.5">
          {(["profile", "domains", "senders", "consumers", "versions"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${tab === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Card><CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Brand tokens</p>
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="Primary" value={draft.tokens.primaryColor} onChange={v => setTokens({ primaryColor: v })} disabled={!canManage} />
                  <ColorField label="Secondary" value={draft.tokens.secondaryColor} onChange={v => setTokens({ secondaryColor: v })} disabled={!canManage} />
                  <ColorField label="Accent" value={draft.tokens.accentColor} onChange={v => setTokens({ accentColor: v })} disabled={!canManage} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Font family</label>
                    <Select value={draft.tokens.fontFamily} onValueChange={v => setTokens({ fontFamily: v })} disabled={!canManage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(",")[0]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Font scale</label>
                    <Input type="number" step="0.05" min={0.85} max={1.15} value={draft.tokens.fontScale}
                      onChange={e => setTokens({ fontScale: Number(e.target.value) || 1 })} disabled={!canManage} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Logo (light)</label>
                    <Input value={draft.tokens.logoLight} onChange={e => setTokens({ logoLight: e.target.value })} disabled={!canManage} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Logo (dark)</label>
                    <Input value={draft.tokens.logoDark} onChange={e => setTokens({ logoDark: e.target.value })} disabled={!canManage} />
                  </div>
                </div>
              </CardContent></Card>

              <Card><CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Governance rules</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mandatory footer text</label>
                  <Textarea value={draft.rules.footerText} onChange={e => setRules({ footerText: e.target.value })} rows={2} disabled={!canManage} />
                </div>
                <RuleSwitch label="Unsubscribe line must carry brand styling" checked={draft.rules.unsubscribeBranded} onChange={v => setRules({ unsubscribeBranded: v })} disabled={!canManage} />
                <RuleSwitch label="Dark-mode logo required on every asset" checked={draft.rules.darkLogoRequired} onChange={v => setRules({ darkLogoRequired: v })} disabled={!canManage} />
                <RuleSwitch label="Legal name required in templates" checked={draft.rules.legalNameRequired} onChange={v => setRules({ legalNameRequired: v })} disabled={!canManage} />
              </CardContent></Card>

              <Card><CardContent className="space-y-2 p-4">
                <label className="text-xs font-medium text-muted-foreground">Change summary (audit-logged)</label>
                <Input value={summary} onChange={e => setSummary(e.target.value)} placeholder="e.g. Accent color refresh + dark-logo rule" disabled={!canManage} />
              </CardContent></Card>
            </div>

            {/* Live previews (AC-1) */}
            <div className="space-y-4">
              <Card><CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Eye className="h-4 w-4" />Email preview</p>
                <div className="rounded border p-3" style={{ fontFamily: draft.tokens.fontFamily, fontSize: `${draft.tokens.fontScale}rem` }}>
                  <div style={{ color: draft.tokens.primaryColor, fontWeight: 700, fontSize: "1.1em" }}>AlphaOne</div>
                  <p className="mt-2 text-sm">Hi trader — your consistency score puts you in the top 12% this quarter.</p>
                  <button type="button" className="mt-2 rounded px-3 py-1 text-sm text-white" style={{ backgroundColor: draft.tokens.accentColor }}>View your path</button>
                  <div className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
                    {draft.rules.footerText.replace("{{unsubscribe_url}}", "#")}
                    {draft.rules.unsubscribeBranded && <span style={{ color: draft.tokens.primaryColor }}> · Unsubscribe</span>}
                  </div>
                </div>
              </CardContent></Card>

              <Card><CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Eye className="h-4 w-4" />Landing page preview</p>
                <div className="rounded border p-3" style={{ fontFamily: draft.tokens.fontFamily, fontSize: `${draft.tokens.fontScale}rem` }}>
                  <header style={{ backgroundColor: draft.tokens.primaryColor, color: "#fff", padding: "8px 12px", fontWeight: 700 }}>AlphaOne — Scale to 200K</header>
                  <main className="mt-2 space-y-2">
                    <h2 style={{ color: draft.tokens.secondaryColor, fontWeight: 700 }}>Your path this quarter</h2>
                    <p className="text-sm">Two steps from the next account tier. Challenge fee waiver ends Sunday.</p>
                    <a className="inline-block rounded px-3 py-1 text-sm text-white" style={{ backgroundColor: draft.tokens.accentColor }}>Start challenge</a>
                  </main>
                  <footer className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
                    {draft.rules.footerText.replace("{{unsubscribe_url}}", "#")}
                  </footer>
                </div>
              </CardContent></Card>

              <p className="text-[11px] text-muted-foreground">
                Previews use the edited (unsaved) tokens — change a color above and both previews update immediately (AC-1).
              </p>
            </div>
          </div>
        )}

        {tab === "domains" && (
          <Card><CardContent className="p-3">
            <p className="mb-2 text-sm font-semibold">Domains (email auth from N3 + site domain)</p>
            <DataTable columns={colsDomains} data={saved.domains} rowKey={r => r.id} pageSize={8} />
          </CardContent></Card>
        )}

        {tab === "senders" && (
          <Card><CardContent className="p-3">
            <p className="mb-2 text-sm font-semibold">Sender identities</p>
            <DataTable columns={colsSenders} data={saved.senders} rowKey={r => r.id} pageSize={8} />
          </CardContent></Card>
        )}

        {tab === "consumers" && (
          <div className="space-y-3">
            <Card><CardContent className="p-3">
              <p className="mb-2 text-sm font-semibold">Template &amp; landing-page consumers ({saved.consumers.length})</p>
              <DataTable columns={colsConsumers} data={saved.consumers} rowKey={r => r.id} pageSize={10} />
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Drift report ({drift.length})</p>
              {drift.length === 0 ? (
                <p className="text-xs text-muted-foreground">All consumers are compliant with the current profile.</p>
              ) : (
                <div className="space-y-1.5">
                  {drift.map(d => (
                    <div key={d.consumer.id} className="rounded border border-amber-400/60 bg-amber-50 p-2.5 text-xs dark:bg-amber-950/30">
                      <p className="font-medium">{d.consumer.name} <span className="text-muted-foreground">({d.consumer.kind.replace("_", " ")}, v{d.consumer.appliedVersion})</span></p>
                      <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                        {d.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Saving a new profile version (AC-2) re-runs this report; assets still on an older version or violating a governance rule are flagged here (AC-1).
              </p>
            </CardContent></Card>
          </div>
        )}

        {tab === "versions" && (
          <Card><CardContent className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" />Version history</p>
            <div className="space-y-2">
              {saved.versions.map(v => (
                <div key={v.version} className="rounded border p-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">v{v.version} — {v.summary}</span>
                    <span className="text-muted-foreground">{v.changedBy} · {new Date(v.changedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    primary {v.tokens.primaryColor} · accent {v.tokens.accentColor} · font {v.tokens.fontFamily.split(",")[0]} · scale {v.tokens.fontScale}
                    {v.rules.darkLogoRequired ? " · dark-logo required" : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clone(p: BrandProfile): BrandProfile {
  return JSON.parse(JSON.stringify(p));
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
        <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function RuleSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2">
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={v => onChange(!!v)} disabled={disabled} />
    </div>
  );
}
