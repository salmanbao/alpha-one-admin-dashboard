"use client";
/**
 * R2-02 — Form Editor (round-3 depth uplift).
 *
 * Replaces the narrated conditional-logic/routing toasts (R3-F05) with:
 *  • a real rules builder — FormRule objects persisted in the store, with
 *    the same evaluateRules() engine the embed script uses
 *  • a live test panel that evaluates rules against typed values
 *  • submissions that write through: CRM contact + consent receipt, both
 *    shown per submission in the Submissions tab
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Save, Eye, Code, Plus, Trash2, Play, ExternalLink } from "lucide-react";
import {
  getForm, saveForm, listForms, addRule, removeRule, evaluateRules, submitForm,
  listSubmissions, type FormRule, type RuleAction, type RuleOp,
} from "../forms-store";

const PALETTE = ["name", "email", "phone", "country", "experience level", "account size intent", "consent checkbox", "hidden/UTM"];

export function FormEditorPage() {
  const { router, navigate, runtime } = usePlatform();
  const id = router.params.id || listForms()[0]?.id;
  const base = useMemo(() => (id ? getForm(id) : undefined), [id]);
  const [form, setForm] = useState(base);
  const [embed, setEmbed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [, tick] = useState(0);

  if (!form) return <Page><PageContent><p className="text-sm text-muted-foreground">No form. <button className="underline" onClick={() => navigate("forms")}>Back</button></p></PageContent></Page>;

  function addField(type: string) { setForm(f => f ? { ...f, fields: [...f.fields, { id: `f${Date.now()}`, type, label: type, required: type === "email" || type === "consent checkbox" }] } : f); }
  function save() {
    if (!form) return;
    saveForm(form);
    recordAudit({ action: "form.save", entity: "form", entityId: form.id, summary: `Saved form ${form.name} (${form.fields.length} fields, ${form.rules.length} rules, routing: CRM ${form.routing.createCrm}, consent ${form.routing.consentCapture}).`, module: "marketing" });
    toast({ title: "Form saved", description: `${form.rules.length} rule(s) and routing persisted — evaluation engine reads the same store.` });
    setForm({ ...form });
  }

  return (
    <Page>
      <PageHeader title={`Form: ${form.name}`} description={`${form.submissions} submissions · ${form.embedTarget} · ${form.rules.length} rule(s)`} icon={ClipboardList}
        actions={<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEmbed(true)}><Code className="mr-1 h-4 w-4" />Embed</Button>
          <Button variant="outline" size="sm" onClick={() => setRulesOpen(true)}>Rules ({form.rules.length})</Button>
          <Button variant="outline" size="sm" onClick={() => setEmbed(true)}><Eye className="mr-1 h-4 w-4" />Test</Button>
          <Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4" />Save</Button>
        </div>} />
      <PageContent>
        <Tabs defaultValue="editor">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="submissions">Submissions ({listSubmissions(form.id).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-3">
            <div className="grid gap-3 lg:grid-cols-[200px_1fr_280px]">
              <Card><CardContent className="p-2 space-y-1"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Field palette</p>{PALETTE.map(b => <button key={b} type="button" className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => addField(b)}>+ {b}</button>)}</CardContent></Card>
              <Card><CardContent className="p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground">Canvas — drag-ordered fields; conditional logic via the Rules builder</p>
                {form.fields.map((f, i) => (
                  <div key={f.id} className="rounded border p-2 text-xs flex items-center justify-between">
                    <span><strong>{i + 1}. {f.label}</strong> <span className="text-muted-foreground">({f.type})</span>{f.required && <Badge variant="secondary" className="ml-1 text-[9px]">required</Badge>}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setRulesOpen(true)}>Rules</Button>
                  </div>
                ))}
                <div className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">Spam protection: honeypot + rate limit. UTM params pass through to contact record (R2-06).</div>
              </CardContent></Card>
              <Card><CardContent className="p-2 space-y-2 text-xs"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Submission routing</p>
                <label className="flex items-center gap-2"><Checkbox checked={form.routing.createCrm} onCheckedChange={v => { setForm({ ...form, routing: { ...form.routing, createCrm: !!v } }); }} />Create/update CRM contact</label>
                <label className="flex items-center gap-2"><Checkbox checked={form.routing.consentCapture} onCheckedChange={v => { setForm({ ...form, routing: { ...form.routing, consentCapture: !!v } }); }} />Capture consent receipt (N10, timestamped)</label>
                <div><label className="text-[10px]">Add to segment</label><Input value={form.routing.segment ?? ""} onChange={e => setForm({ ...form, routing: { ...form.routing, segment: e.target.value } })} className="h-7 text-xs mt-0.5" placeholder="segment name/id" /></div>
                <div><label className="text-[10px]">Enroll in flow (M4)</label><Input value={form.routing.flow ?? ""} onChange={e => setForm({ ...form, routing: { ...form.routing, flow: e.target.value } })} className="h-7 text-xs mt-0.5" placeholder="flow name" /></div>
                <div><label className="text-[10px]">Fire webhook</label><Input value={form.routing.webhook ?? ""} onChange={e => setForm({ ...form, routing: { ...form.routing, webhook: e.target.value } })} className="h-7 text-xs mt-0.5" placeholder="https://..." /></div>
                <p className="text-[10px] text-muted-foreground">Submissions appear in the Submissions tab with their CRM contact and consent receipt ids.</p>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="mt-3">
            <SubmissionsTab formId={form.id} />
          </TabsContent>
        </Tabs>

        {embed && <LiveTestCard form={form} onClose={() => setEmbed(false)} />}
      </PageContent>

      {/* Rules builder sheet — the real thing behind the old toast */}
      <Sheet open={rulesOpen} onOpenChange={(o) => !o && setRulesOpen(false)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <RulesBuilder
            formId={form.id}
            onMutate={() => {
              const fresh = getForm(form.id);
              if (fresh) setForm({ ...fresh });
              tick(n => n + 1);
            }}
          />
        </SheetContent>
      </Sheet>
      <span className="hidden">{String(runtime.tenant?.id)}</span>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Rules builder                                                       */
/* ------------------------------------------------------------------ */

function RulesBuilder({ formId, onMutate }: { formId: string; onMutate: () => void }) {
  const form = getForm(formId)!;
  const [fieldId, setFieldId] = useState(form.fields[0]?.id ?? "");
  const [op, setOp] = useState<RuleOp>("equals");
  const [value, setValue] = useState("");
  const [action, setAction] = useState<RuleAction>("show");
  const [target, setTarget] = useState(form.fields[1]?.id ?? form.fields[0]?.id ?? "");

  const targets = action === "redirect"
    ? null
    : form.fields.map(f => f.id);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Conditional logic — rules builder</SheetTitle>
        <SheetDescription>
          Real FormRule objects in the store — the embed script and the test panel run the
          same evaluateRules() engine, so what you build here is what visitors get.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        {/* Existing rules */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Active rules ({form.rules.length})</p>
          {form.rules.length === 0 && <p className="text-xs text-muted-foreground">No rules — the form shows every field and enforces only the required flags.</p>}
          {form.rules.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs">
              <span>
                <strong>{r.action}</strong> {r.target}
                <span className="text-muted-foreground"> when </span>
                {r.fieldId} <span className="font-mono">{r.op}{r.value ? ` "${r.value}"` : ""}</span>
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Remove rule"
                onClick={() => { removeRule(formId, r.id); onMutate(); toast({ title: "Rule removed" }); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add rule */}
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Add rule</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">When field</Label>
              <Select value={fieldId} onValueChange={setFieldId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.fields.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Condition</Label>
              <Select value={op} onValueChange={(v) => setOp(v as RuleOp)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["equals", "not_equals", "contains", "is_filled", "is_empty"] as RuleOp[]).map(o => <SelectItem key={o} value={o}>{o.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {op !== "is_filled" && op !== "is_empty" && (
              <div className="space-y-1">
                <Label className="text-[10px]">Value</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. professional" className="h-8 text-xs" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px]">Then</Label>
              <Select value={action} onValueChange={(v) => setAction(v as RuleAction)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["show", "hide", "require", "redirect"] as RuleAction[]).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">{action === "redirect" ? "Target URL/path" : "Target field"}</Label>
              {action === "redirect" ? (
                <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/pricing" className="h-8 text-xs" />
              ) : (
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(targets ?? []).map(f => <SelectItem key={f} value={f}>{form.fields.find(x => x.id === f)?.label ?? f}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <Button
            size="sm"
            disabled={!fieldId || !target}
            onClick={() => {
              const rec = addRule(formId, { fieldId, op, value: op === "is_filled" || op === "is_empty" ? undefined : value, action, target });
              if (rec) {
                toast({ title: "Rule added", description: `${action} ${target} when ${fieldId} ${op}${value ? ` "${value}"` : ""}` });
                onMutate();
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add rule
          </Button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Live test — evaluate rules + run a submission through the store     */
/* ------------------------------------------------------------------ */

function LiveTestCard({ form, onClose }: { form: ReturnType<typeof getForm>; onClose: () => void }) {
  const { runtime } = usePlatform();
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  if (!form) return null;
  const evaln = evaluateRules(form, values);

  const run = () => {
    const res = submitForm(form.id, values, {
      tenantId: runtime.tenant?.id ?? "platform",
      origin: "editor live test",
      actor: "editor",
    });
    if (!res.ok) {
      setResult(`✗ ${res.errors.join(" · ")}`);
      return;
    }
    setResult(
      `✓ ${res.submission?.id} — CRM ${res.crmContactId ?? "skipped (routing off)"} · consent ${res.consentReceiptId ?? "skipped"}${evaln.redirect ? ` · redirect ${evaln.redirect}` : ""}`,
    );
    toast({ title: "Test submission stored", description: "Check the Submissions tab — contact + receipt ids are linked." });
  };

  return (
    <Card className="m-4">
      <CardContent className="p-3 space-y-2 text-xs">
        <p className="flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Live test — rules engine + routing</span>
          <Button size="sm" variant="ghost" className="h-6" onClick={onClose}>Close</Button>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {form.fields.map(f => (
            <div key={f.id} className={evaln.hidden.includes(f.id) ? "opacity-40" : ""}>
              <Label className="text-[10px]">
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
                {evaln.required.includes(f.id) && <span className="text-amber-700"> (rule-required)</span>}
                {evaln.hidden.includes(f.id) && <span className="text-muted-foreground"> (hidden by rule)</span>}
              </Label>
              <Input
                value={values[f.id] ?? ""}
                onChange={(e) => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                className="h-8 text-xs"
                disabled={evaln.hidden.includes(f.id)}
                placeholder={f.type === "email" ? "trader@example.com" : f.type}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={run}><Play className="h-3.5 w-3.5" /> Run submission</Button>
          {result && <span className="font-mono text-[11px]">{result}</span>}
        </div>
        {/* Rule trace */}
        <div className="rounded border p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Rule trace</p>
          {evaln.fired.length === 0 && <p className="text-muted-foreground">No rules defined.</p>}
          {evaln.fired.map(f => (
            <p key={f.ruleId} className={f.matched ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
              {f.matched ? "▶ fired" : "· idle"} — {f.describe}
            </p>
          ))}
          {evaln.redirect && <p className="text-amber-700 dark:text-amber-400">→ would redirect to {evaln.redirect}</p>}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Embed snippet: <code className="bg-muted px-1">{`<script src="https://cdn.alpha.one/forms/${form.id}.js"></script>`}</code>
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Submissions tab — CRM contact + consent receipt linkage             */
/* ------------------------------------------------------------------ */

function SubmissionsTab({ formId }: { formId: string }) {
  const subs = listSubmissions(formId);
  if (subs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No submissions yet — run the live test from the editor to store one with its CRM contact
        and consent receipt.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {subs.map(s => (
        <div key={s.id} className="rounded-lg border p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono font-medium">{s.id}</span>
            <span className="text-muted-foreground">{new Date(s.at).toLocaleString()}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(s.values).filter(([, v]) => v.trim()).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px]">{k}: {v}</Badge>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
            <span className={s.crmContactId ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
              CRM: {s.crmContactId ?? "not created (routing off)"}
            </span>
            <span className={s.consentReceiptId ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
              Consent: {s.consentReceiptId ?? "no consent field/capture"}
            </span>
            {s.hiddenFields.length > 0 && <span className="text-muted-foreground">hidden: {s.hiddenFields.join(", ")}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
