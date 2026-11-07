"use client";
/**
 * R2-03 — On-Site Designer (round-3 depth uplift).
 *
 * Trigger/targeting/frequency panels are now the editors of real rule
 * objects evaluated by the store's engine — the new "Rules & evaluation"
 * card runs evaluateOnsite() against an editable visitor context and shows
 * the per-stage trace (R3-F05: replaces the narrated toasts). Conversions
 * are recorded as attribution records feeding the unit's counters and the
 * suppress_after_conversion rule.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { MousePointerClick, Save, Eye, Smartphone, Monitor, Play, Target } from "lucide-react";
import {
  getOnsite, saveOnsite, listOnsite, listConversions, recordConversion,
  evaluateOnsite, sessionContext, useOnsiteVersion, type OnsiteContext,
} from "../onsite-store";

const PALETTE = ["headline", "body", "CTA button", "form embed (R2-02)", "countdown", "image (R2-04)", "trust badges"];

export function OnsiteDesignerPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id || listOnsite()[0]?.id;
  const base = useMemo(() => (id ? getOnsite(id) : undefined), [id]);
  const [c, setC] = useState(base);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  useOnsiteVersion(); // conversion/impression records bump the store

  if (!c) return <Page><PageContent><p className="text-sm text-muted-foreground">No campaign. <button className="underline" onClick={() => navigate("onsite-campaigns")}>Back</button></p></PageContent></Page>;

  function save() {
    if (!c) return;
    saveOnsite(c);
    recordAudit({ action: "onsite.save", entity: "onsite", entityId: c.id, summary: `Saved ${c.name} (trigger ${c.trigger.kind}, freq ${c.frequency.mode}).`, module: "marketing" });
    toast({ title: "Saved", description: "Rule objects persisted — the evaluation engine reads the same store." });
    setC({ ...c });
  }

  const conversions = listConversions(c.id);

  return (
    <Page>
      <PageHeader title={`On-Site: ${c.name}`} description={`${c.type} · ${c.status} · trigger ${c.trigger.kind} · ${c.conversions} conversions attributed`} icon={MousePointerClick}
        actions={<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}><Eye className="mr-1 h-4 w-4" />Preview</Button>
          <Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4" />Save</Button>
          <Button size="sm" variant={c.status === "active" ? "outline" : "default"} onClick={() => { saveOnsite({ id: c.id, status: c.status === "active" ? "paused" : "active" }); setC({ ...c, status: c.status === "active" ? "paused" : "active" }); recordAudit({ action: `onsite.${c.status === "active" ? "pause" : "activate"}`, entity: "onsite", entityId: c.id, summary: `${c.status === "active" ? "Paused" : "Activated"} ${c.name}`, module: "marketing" }); toast({ title: c.status === "active" ? "Paused" : "Activated" }); }}>{c.status === "active" ? "Pause" : "Activate"}</Button>
        </div>} />
      <PageContent>
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_300px]">
          <Card><CardContent className="p-2 space-y-1 text-xs"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Blocks (R2-01 canvas)</p>{PALETTE.map(b => <button key={b} type="button" className="w-full rounded border px-2 py-1 text-left hover:bg-muted" onClick={() => setC({ ...c, blocks: [...c.blocks, { id: `b${Date.now()}`, type: b, label: b }] })}>+ {b}</button>)}<p className="text-[10px] text-muted-foreground pt-1">Uses design-system tokens (no visual fork). Conversions attribute to marketing-performance.</p></CardContent></Card>
          <Card><CardContent className="p-3 space-y-2"><p className="text-[10px] text-muted-foreground">Canvas ({c.type})</p>{c.blocks.map((b, i) => <div key={b.id} className="rounded border p-2 text-xs"><strong>{i + 1}. {b.label}</strong> <span className="text-muted-foreground">({b.type})</span></div>)}</CardContent></Card>
          <div className="space-y-2">
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Trigger (rule object)</p><Select value={c.trigger.kind} onValueChange={v => setC({ ...c, trigger: { ...c.trigger, kind: v as any } })}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent>{["page_view", "scroll", "exit_intent", "time_on_page", "click"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input value={c.trigger.value || ""} onChange={e => setC({ ...c, trigger: { ...c.trigger, value: e.target.value } })} placeholder="value (e.g. scroll %, /path)" className="h-7" /></CardContent></Card>
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Targeting (rule object)</p><Input value={c.audience.segment || ""} onChange={e => setC({ ...c, audience: { ...c.audience, segment: e.target.value } })} placeholder="Segment" className="h-7" /><Input value={c.audience.country || ""} onChange={e => setC({ ...c, audience: { ...c.audience, country: e.target.value } })} placeholder="Country" className="h-7" /><Select value={c.audience.device || "any"} onValueChange={v => setC({ ...c, audience: { ...c.audience, device: v === "any" ? undefined : v } })}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent>{["any", "desktop", "mobile"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2"><Switch checked={!!c.audience.loggedIn} onCheckedChange={v => setC({ ...c, audience: { ...c.audience, loggedIn: !!v } })} />Logged-in only</label></CardContent></Card>
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Frequency (rule object)</p><Select value={c.frequency.mode} onValueChange={v => setC({ ...c, frequency: { ...c.frequency, mode: v as any } })}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent>{["once", "session", "every_n_days", "suppress_after_conversion"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>{c.frequency.mode === "every_n_days" && <Input type="number" value={String(c.frequency.n || 1)} onChange={e => setC({ ...c, frequency: { ...c.frequency, n: parseInt(e.target.value) || 1 } })} className="h-7" placeholder="N days" />}<p className="text-[10px] text-muted-foreground">Dismissal state persists per trader across sessions.</p></CardContent></Card>
          </div>
        </div>

        {/* Rules & evaluation — the engine behind the three panels above */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <RulesEvaluationCard unitId={c.id} />
          <ConversionsCard unitId={c.id} conversions={conversions} />
        </div>
      </PageContent>
      <Sheet open={preview} onOpenChange={setPreview}><SheetContent side="bottom" className="h-[70vh]"><SheetHeader><SheetTitle>Preview ({device})</SheetTitle><SheetDescription>Mocked trader page; fires only when the rule engine returns show.</SheetDescription></SheetHeader>
        <div className="mt-2 flex gap-2"><Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}><Monitor className="h-3 w-3" /></Button><Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}><Smartphone className="h-3 w-3" /></Button></div>
        <div className={`mt-3 mx-auto rounded border bg-muted/30 p-4 ${device === "mobile" ? "max-w-[360px]" : "max-w-3xl"} relative min-h-[300px]`}><p className="text-xs text-muted-foreground text-center mb-8">Mocked trader dashboard</p><div className={`rounded-lg border bg-background p-3 shadow-lg ${c.type === "banner" ? "" : "max-w-sm mx-auto"}`}><p className="font-semibold text-sm">{c.blocks[0]?.label || c.name}</p><p className="text-xs text-muted-foreground mt-1">Template: {c.template} · Trigger: {c.trigger.kind} · Segment: {c.audience.segment || "all"}</p><div className="mt-2 flex gap-2"><Button size="sm" className="h-7 text-xs">CTA</Button><Button size="sm" variant="ghost" className="h-7 text-xs">Dismiss</Button></div></div></div>
      </SheetContent></Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Rules & evaluation — run the store engine against a visitor context */
/* ------------------------------------------------------------------ */

function RulesEvaluationCard({ unitId }: { unitId: string }) {
  const unit = getOnsite(unitId)!;
  const [page, setPage] = useState(unit.trigger.value?.startsWith("/") ? unit.trigger.value : "/register");
  const [visitorDevice, setVisitorDevice] = useState<"desktop" | "mobile">("desktop");
  const [loggedIn, setLoggedIn] = useState(!!unit.audience.loggedIn);
  const [segment, setSegment] = useState(unit.audience.segment ?? "");
  const [scrollPct, setScrollPct] = useState(0);
  const [timeSec, setTimeSec] = useState(0);
  const [lastResult, setLastResult] = useState<{ show: boolean; reasons: Array<{ stage: string; ok: boolean; detail: string }> } | null>(null);
  const [tick, setTick] = useState(0);
  void tick;

  const ctx: Omit<OnsiteContext, "impressionsInSession" | "dismissed" | "converted"> = {
    page,
    device: visitorDevice,
    country: unit.audience.country,
    loggedIn,
    segments: segment ? [segment] : [],
    triggerEvent: {
      kind: unit.trigger.kind,
      scrollPct,
      timeOnPageSec: timeSec,
    },
  };

  const evaluate = () => {
    const full = sessionContext(unitId, "sess-test", ctx);
    const r = evaluateOnsite(unit, full);
    setLastResult({ show: r.show, reasons: r.reasons });
    setTick(n => n + 1);
  };

  return (
    <Card>
      <CardContent className="space-y-2 p-3 text-xs">
        <p className="flex items-center gap-1 font-semibold uppercase text-muted-foreground"><Play className="h-3.5 w-3.5" /> Rules &amp; evaluation (store engine)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-[10px]">Visitor page</Label><Input value={page} onChange={e => setPage(e.target.value)} className="h-7" /></div>
          <div className="space-y-1"><Label className="text-[10px]">Segment</Label><Input value={segment} onChange={e => setSegment(e.target.value)} className="h-7" placeholder={unit.audience.segment ?? "e.g. Funded active"} /></div>
          <div className="space-y-1"><Label className="text-[10px]">Device</Label><Select value={visitorDevice} onValueChange={v => setVisitorDevice(v as any)}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="desktop">desktop</SelectItem><SelectItem value="mobile">mobile</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-[10px]">Trigger input</Label>
            {unit.trigger.kind === "scroll" ? <Input type="number" value={String(scrollPct)} onChange={e => setScrollPct(parseInt(e.target.value) || 0)} className="h-7" placeholder="scroll %" />
              : unit.trigger.kind === "time_on_page" ? <Input type="number" value={String(timeSec)} onChange={e => setTimeSec(parseInt(e.target.value) || 0)} className="h-7" placeholder="seconds" />
                : <Input value={page} onChange={e => setPage(e.target.value)} className="h-7" placeholder="/path" />}
          </div>
        </div>
        <label className="flex items-center gap-2"><Switch checked={loggedIn} onCheckedChange={setLoggedIn} />Logged-in visitor</label>
        <Button size="sm" onClick={evaluate}><Play className="h-3.5 w-3.5" /> Evaluate</Button>

        {lastResult && (
          <div className={`rounded border p-2 ${lastResult.show ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/30"}`}>
            <p className={`font-semibold ${lastResult.show ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
              {lastResult.show ? "▶ would show" : "· would skip"}
            </p>
            {lastResult.reasons.map((r, i) => (
              <p key={i} className={r.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                {r.ok ? "✓" : "✗"} {r.stage}: {r.detail}
              </p>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Same engine the preview and embed shim call — status → trigger → targeting → frequency,
          with a reason per stage.
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Conversions — attribution records                                   */
/* ------------------------------------------------------------------ */

function ConversionsCard({ unitId, conversions }: { unitId: string; conversions: ReturnType<typeof listConversions> }) {
  const { user } = usePlatform();
  const [session, setSession] = useState(`sess-${Math.random().toString(36).slice(2, 6)}`);
  const [page, setPage] = useState("/pricing");
  const [value, setValue] = useState("");

  return (
    <Card>
      <CardContent className="space-y-2 p-3 text-xs">
        <p className="flex items-center gap-1 font-semibold uppercase text-muted-foreground"><Target className="h-3.5 w-3.5" /> Conversion attribution</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-[10px]">Session</Label><Input value={session} onChange={e => setSession(e.target.value)} className="h-7" /></div>
          <div className="space-y-1"><Label className="text-[10px]">Page</Label><Input value={page} onChange={e => setPage(e.target.value)} className="h-7" /></div>
          <div className="space-y-1"><Label className="text-[10px]">Value (optional)</Label><Input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" className="h-7" placeholder="0" /></div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const rec = recordConversion({ unitId, session, page, value: Number(value) || 0 });
            if (rec) {
              toast({ title: "Conversion recorded", description: `Attributed to ${rec.unitId} (session ${rec.session}) — counters + suppress_after_conversion updated.` });
              recordAudit({ action: "onsite.conversion.manual", entity: "onsite", entityId: unitId, summary: `Manual conversion attribution by ${user?.name ?? "operator"}: ${rec.id}`, module: "marketing" });
            }
          }}
        >
          Record conversion
        </Button>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Attributed records ({conversions.length})</p>
          {conversions.length === 0 && <p className="text-muted-foreground">No conversions attributed yet.</p>}
          {conversions.map(cn => (
            <div key={cn.id} className="flex items-center justify-between rounded border px-2 py-1">
              <span className="font-mono">{cn.session} · {cn.page}</span>
              <span className="text-muted-foreground">{cn.value ? `${cn.value} ${cn.currency}` : "lead"} · {new Date(cn.at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Records bump the unit counter and flip the session to converted — a visitor under
          suppress_after_conversion is skipped by the engine on the next evaluation.
        </p>
      </CardContent>
    </Card>
  );
}
