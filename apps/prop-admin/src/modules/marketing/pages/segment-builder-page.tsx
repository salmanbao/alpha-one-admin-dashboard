"use client";

/**
 * M3.1 — Segment Builder (spec §7.1).
 * Condition canvas (AND/OR groups, nested up to 3 levels) with a
 * debounced deterministic preview (count, consent coverage, sample
 * members) and starter templates. Replaces the stitch audience builder.
 */

import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { Filter, Plus, Save, Trash2, Rocket, GripVertical, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  SEGMENT_ATTRIBUTES, SEGMENT_TEMPLATES, OPERATOR_LABEL, type AttributeDef, type SegmentOperator, type SegmentGroup, type SegmentNode,
  getAttribute, isGroup, emptyCondition, emptyGroup, newConditionId, newGroupId, estimateSegment, sampleMembers, saveSegment, getSegment, hasIncompleteCondition, treeStats,
} from "../segments-store";

function opOptions(attr: AttributeDef | undefined): SegmentOperator[] { return attr?.operators ?? ["is"]; }

export function SegmentBuilderPage() {
  const { router, navigate } = usePlatform();
  const existing = router.params.id ? getSegment(router.params.id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [root, setRoot] = useState<SegmentGroup>(() => existing?.conditions ? JSON.parse(JSON.stringify(existing.conditions)) : emptyGroup());
  const [nameErr, setNameErr] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(() => estimateSegment(existing?.conditions ?? emptyGroup()));
  const [dirty, setDirty] = useState(false);

  // Debounced estimate (500ms) with shimmer
  useEffect(() => {
    setEstimating(true);
    const t = setTimeout(() => { setEstimate(estimateSegment(root)); setEstimating(false); }, 500);
    return () => clearTimeout(t);
  }, [root]);

  const stats = useMemo(() => treeStats(root), [root]);
  const canNest = stats.depth < 4; // 3 group levels + leaf = depth 4 max

  function mutate(updater: (g: SegmentGroup) => SegmentGroup) { setRoot((r) => updater(structuredClone(r))); setDirty(true); }

  function updateNode(group: SegmentGroup, id: string, fn: (n: SegmentNode) => SegmentNode): SegmentGroup {
    return { ...group, children: group.children.map((c) => c.id === id ? fn(c) : isGroup(c) ? updateNode(c, id, fn) : c) };
  }
  function removeNode(group: SegmentGroup, id: string): SegmentGroup {
    return { ...group, children: group.children.filter((c) => c.id !== id).map((c) => isGroup(c) ? removeNode(c, id) : c) };
  }
  function moveNode(group: SegmentGroup, id: string, dir: -1|1): SegmentGroup {
    const idx = group.children.findIndex((c) => c.id === id);
    if (idx >= 0) { const arr = [...group.children]; const j = idx + dir; if (j < 0 || j >= arr.length) return group; [arr[idx], arr[j]] = [arr[j], arr[idx]]; return { ...group, children: arr }; }
    return { ...group, children: group.children.map((c) => isGroup(c) ? moveNode(c, id, dir) : c) };
  }

  function doSave(andCreate = false) {
    if (!name.trim()) { setNameErr("Segment name is required."); return; }
    if (hasIncompleteCondition(root)) { toast({ title: "Incomplete conditions", description: "Fill in attribute and value for every condition before saving." }); return; }
    const res = saveSegment({ id: existing?.id, name, description: desc, conditions: root });
    if (!res.ok) { setNameErr(res.error); return; }
    setNameErr(""); setDirty(false);
    recordAudit({ action: "segment.save", entity: "segment", entityId: res.segment.id, summary: `Saved segment “${res.segment.name}” (${res.segment.size} members).`, module: "marketing" });
    toast({ title: existing ? "Segment updated" : "Segment saved", description: `${res.segment.name} — ${res.segment.size.toLocaleString()} estimated members.` });
    if (andCreate) navigate("campaign-new", { segment: res.segment.id }); else navigate("segments");
  }

  return (
    <Page>
      <PageHeader title={name.trim() || (existing ? existing.name : "New Segment")} description="Build an audience over traders, leads and trading activity." icon={Filter}
        actions={<div className="flex gap-2">{dirty && <Button variant="ghost" size="sm" onClick={() => navigate("segments")}>Discard</Button>}<Button variant="outline" size="sm" onClick={() => doSave(false)}><Save className="mr-1 h-4 w-4" />Save</Button><Button size="sm" onClick={() => doSave(true)}><Rocket className="mr-1 h-4 w-4" />Save &amp; Create Campaign</Button></div>} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* LEFT — condition canvas */}
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                <div><Label className="text-xs">Segment name</Label><Input value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); setDirty(true); }} placeholder="e.g. Funded EU traders" className="mt-1" aria-invalid={!!nameErr} />{nameErr && <p className="mt-1 text-[11px] text-destructive">{nameErr}</p>}</div>
                <div><Label className="text-xs">Description</Label><Input value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true); }} placeholder="What this audience is for" className="mt-1" /></div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Starter templates:</span>
              {SEGMENT_TEMPLATES.map((t) => (
                <button key={t.key} type="button" title={t.description} className="rounded-full border px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => { setRoot(structuredClone(t.conditions)); if (!name) setName(t.name); if (!desc) setDesc(t.description); setDirty(true); toast({ title: "Template loaded", description: t.name }); }}>
                  {t.name}
                </button>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Conditions</CardTitle><p className="text-xs text-muted-foreground">Combine attributes with AND/OR groups (nesting up to 3 levels). Order is preserved.</p></CardHeader>
              <CardContent>
                {root.children.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    <p>No conditions — everyone matches.</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => mutate((g) => ({ ...g, children: [emptyCondition()] }))}><Plus className="mr-1 h-3 w-3" />Add condition</Button>
                  </div>
                ) : (
                  <GroupEditor group={root} depth={1} canNest={canNest} onUpdate={(g) => mutate(() => g)} onMutate={mutate} updateNode={updateNode} removeNode={removeNode} moveNode={moveNode} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — preview */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Preview</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated size</p>
                  {estimating ? <div className="mt-1 h-8 w-24 animate-pulse rounded bg-muted" /> : <p className="text-2xl font-semibold tabular-nums">{estimate.size.toLocaleString()}</p>}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Consent coverage</p>
                  <div className="mt-1 flex items-center gap-3">
                    <svg viewBox="0 0 36 36" className="h-12 w-12">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={estimate.consentCoverage < 70 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} strokeWidth="3" strokeDasharray={`${estimate.consentCoverage} ${100 - estimate.consentCoverage}`} strokeDashoffset="25" />
                    </svg>
                    <span className={`text-lg font-semibold ${estimate.consentCoverage < 70 ? "text-destructive" : ""}`}>{estimating ? "…" : `${estimate.consentCoverage}%`}</span>
                  </div>
                </div>
                {estimate.size < 50 && !estimating && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/30"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" /><span>Very narrow segment (&lt; 50 members) — consider broadening conditions. (Save not blocked.)</span></div>
                )}
                {estimate.consentCoverage < 70 && !estimating && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/30"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" /><span>Consent coverage is low — campaigns to this segment will auto-exclude many members.</span></div>
                )}
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Sample members (masked)</p>
                  <div className="max-h-48 space-y-1 overflow-auto rounded-lg border p-2">
                    {sampleMembers(root, 10).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-[11px]"><span className="font-mono">{m.handle}</span><span className="text-muted-foreground">{m.country} · {m.phase}</span></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

function GroupEditor({ group, depth, canNest, onUpdate, onMutate, updateNode, removeNode, moveNode }: {
  group: SegmentGroup; depth: number; canNest: boolean;
  onUpdate: (g: SegmentGroup) => void; onMutate: (u: (g: SegmentGroup) => SegmentGroup) => void;
  updateNode: (g: SegmentGroup, id: string, fn: (n: SegmentNode) => SegmentNode) => SegmentGroup;
  removeNode: (g: SegmentGroup, id: string) => SegmentGroup;
  moveNode: (g: SegmentGroup, id: string, dir: -1|1) => SegmentGroup;
}) {
  return (
    <div className={`space-y-2 rounded-lg border p-3 ${depth > 1 ? "bg-muted/20" : ""}`}>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">Group</Badge>
        <div className="flex rounded-md border p-0.5">
          {(["AND", "OR"] as const).map((op) => (
            <button key={op} type="button" onClick={() => onUpdate({ ...group, op })} className={`rounded px-2 py-0.5 text-[10px] font-semibold ${group.op === op ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{op}</button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Match {group.op === "AND" ? "all" : "any"} of the following</span>
      </div>
      {group.children.map((child, i) => (
        <div key={child.id} className="group/row">
          {isGroup(child) ? (
            <div className="relative">
              <GroupEditor group={child} depth={depth + 1} canNest={canNest} onUpdate={(ng) => onUpdate({ ...group, children: group.children.map((c) => c.id === child.id ? ng : c) })} onMutate={onMutate} updateNode={updateNode} removeNode={removeNode} moveNode={moveNode} />
              <Button size="sm" variant="ghost" className="absolute -right-1 -top-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onMutate((r) => removeNode(r, child.id))} aria-label="Remove group"><Trash2 className="h-3 w-3" /></Button>
            </div>
          ) : (
            <ConditionRow node={child} onChange={(n) => onMutate((r) => updateNode(r, child.id, () => n))} onRemove={() => onMutate((r) => removeNode(r, child.id))} onMove={(dir) => onMutate((r) => moveNode(r, child.id, dir))} />
          )}
          {i < group.children.length - 1 && <p className="py-0.5 pl-3 text-[10px] font-semibold text-muted-foreground">{group.op}</p>}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUpdate({ ...group, children: [...group.children, emptyCondition()] })}><Plus className="mr-1 h-3 w-3" />Condition</Button>
        {canNest && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUpdate({ ...group, children: [...group.children, emptyGroup()] })}><Plus className="mr-1 h-3 w-3" />Group</Button>}
      </div>
    </div>
  );
}

function ConditionRow({ node, onChange, onRemove, onMove }: { node: import("../segments-store").SegmentCondition; onChange: (n: import("../segments-store").SegmentCondition) => void; onRemove: () => void; onMove: (dir: -1|1) => void }) {
  const attr = getAttribute(node.attribute);
  const ops = opOptions(attr);
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      <Select value={node.attribute} onValueChange={(v) => { const a = getAttribute(v); onChange({ ...node, attribute: v, operator: a?.operators[0] ?? "is", value: null }); }}>
        <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Attribute" /></SelectTrigger>
        <SelectContent>{SEGMENT_ATTRIBUTES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={node.operator} onValueChange={(v) => onChange({ ...node, operator: v as SegmentOperator })}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{ops.map((o) => <SelectItem key={o} value={o}>{OPERATOR_LABEL[o]}</SelectItem>)}</SelectContent>
      </Select>
      <ValueInput attr={attr} value={node.value} onChange={(v) => onChange({ ...node, value: v })} />
      <span className="ml-auto flex gap-0.5 opacity-60 group-hover/row:opacity-100">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onMove(-1)} aria-label="Move up"><ChevronUp className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onMove(1)} aria-label="Move down"><ChevronDown className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={onRemove} aria-label="Remove"><Trash2 className="h-3 w-3" /></Button>
      </span>
    </div>
  );
}

function ValueInput({ attr, value, onChange }: { attr: AttributeDef | undefined; value: string|number|string[]|null; onChange: (v: string|number|string[]|null) => void }) {
  if (!attr) return <Input disabled placeholder="Pick attribute" className="h-8 w-[160px] text-xs" />;
  if (attr.valueKind === "number") return <Input type="number" value={value as number ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder="Value" className="h-8 w-[120px] text-xs" />;
  if (attr.valueKind === "multi") {
    const sel = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-1">
        {(attr.options ?? []).map((o) => (
          <button key={o} type="button" onClick={() => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${sel.includes(o) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{o}</button>
        ))}
      </div>
    );
  }
  return (
    <Select value={(value as string) ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Value" /></SelectTrigger>
      <SelectContent>{(attr.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}
