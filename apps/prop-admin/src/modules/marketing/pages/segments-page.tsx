"use client";

/**
 * M3.2 — Saved Segments Library (spec §7.2).
 * Reusable segments with freshness, owner, usage references and
 * full row/bulk actions. Delete is guarded by active usage.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Layers, Plus, RefreshCw, Copy, Trash2, Download, Rocket } from "lucide-react";
import { listSegments, deleteSegment, recomputeSegment, duplicateSegment, type Segment } from "../segments-store";

export function SegmentsPage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const all = listSegments();
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState<"all"|"active"|"stale">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; blockers: { name: string; kind: string }[] } | null>(null);

  const owners = useMemo(() => Array.from(new Set(all.map((s) => s.owner))), [all]);
  const rows = useMemo(() => all.filter((s) => (owner === "all" || s.owner === owner) && (status === "all" || s.status === status)), [all, owner, status]);

  function tryDelete(ids: string[]) {
    const blockers: { name: string; kind: string }[] = [];
    for (const id of ids) {
      const r = deleteSegment(id);
      if (!r.ok) r.blockedBy.forEach((u) => blockers.push({ name: u.name, kind: u.kind }));
    }
    if (blockers.length > 0) setPendingDelete({ ids, blockers });
    else {
      toast({ title: `Deleted ${ids.length} segment${ids.length > 1 ? "s" : ""}` });
      setSelected([]);
      refresh();
    }
  }

  const columns: Column<Segment>[] = [
    { key: "sel", header: "", width: "36px", cell: (s) => (
      <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => setSelected((p) => v ? [...p, s.id] : p.filter((x) => x !== s.id))} aria-label={`Select ${s.name}`} />
    )},
    { key: "name", header: "Name", sortValue: (s) => s.name, cell: (s) => (
      <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => navigate("marketing-audience-builder", { id: s.id })}>{s.name}</button>
    )},
    { key: "owner", header: "Owner", sortValue: (s) => s.owner, cell: (s) => <span className="text-xs">{s.owner}</span> },
    { key: "size", header: "Size", numeric: true, sortValue: (s) => s.size, cell: (s) => <span className="tabular-nums">{s.size.toLocaleString()}</span> },
    { key: "fresh", header: "Freshness", sortValue: (s) => s.computedAt, cell: (s) => (
      <StatusBadge tone={s.status === "stale" ? "danger" : "success"}>{relativeTime(s.computedAt)}</StatusBadge>
    )},
    { key: "used", header: "Used by", cell: (s) => s.usedBy.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
      <Popover>
        <PopoverTrigger asChild><button type="button" className="text-xs underline decoration-dotted">{s.usedBy.length} items</button></PopoverTrigger>
        <PopoverContent className="w-64 space-y-1 p-2 text-xs">
          {s.usedBy.map((u) => <div key={`${u.kind}-${u.id}`} className="flex items-center justify-between gap-2"><span className="truncate">{u.name}</span><Badge variant={u.status === "active" ? "default" : "secondary"} className="text-[10px]">{u.kind} · {u.status}</Badge></div>)}
        </PopoverContent>
      </Popover>
    )},
    { key: "status", header: "Status", sortValue: (s) => s.status, cell: (s) => <StatusBadge tone={s.status === "active" ? "success" : "warning"}>{s.status}</StatusBadge> },
    { key: "actions", header: "", cell: (s) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Open" onClick={() => navigate("marketing-audience-builder", { id: s.id })}><Layers className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Duplicate" onClick={() => { const c = duplicateSegment(s.id); if (c) { toast({ title: "Segment duplicated", description: c.name }); refresh(); } }}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Create campaign" onClick={() => navigate("campaign-new", { segment: s.id })}><Rocket className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Recompute" onClick={() => { recomputeSegment(s.id); toast({ title: "Segment recomputed", description: `${s.name} refreshed.` }); refresh(); }}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" title="Delete" onClick={() => tryDelete([s.id])}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <Page>
      <PageHeader title="Segments" description="Reusable audience definitions with freshness, usage and consent coverage." icon={Layers}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => toast({ title: "CSV export started", description: "Members CSV will download shortly (dummy)." })}><Download className="mr-1 h-4 w-4" />Export members CSV</Button><Button size="sm" onClick={() => navigate("marketing-audience-builder")}><Plus className="mr-1 h-4 w-4" />New Segment</Button></div>}
      />
      <PageContent>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All owners</SelectItem>{owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as "all"|"active"|"stale")}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="stale">Stale</SelectItem></SelectContent>
          </Select>
          {selected.length > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
              <span>{selected.length} selected</span>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { selected.forEach(recomputeSegment); toast({ title: "Recomputed", description: `${selected.length} segments refreshed.` }); setSelected([]); refresh(); }}>Recompute</Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => toast({ title: "Export queued", description: `${selected.length} segment exports.` })}>Export CSV</Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={() => tryDelete(selected)}>Delete</Button>
            </div>
          )}
        </div>

        {all.length === 0 ? (
          <EmptyState title="No segments yet" description="Build a reusable audience over traders, leads and trading activity." icon={Layers}
            action={<Button size="sm" onClick={() => navigate("marketing-audience-builder")}><Plus className="mr-1 h-4 w-4" />New Segment</Button>}
          />
        ) : (
          <DataTable columns={columns} data={rows} rowKey={(s) => s.id} searchableText={(s) => `${s.name} ${s.owner}`} pageSize={10} emptyTitle="No segments match" emptyDescription="Adjust filters or create a new segment." />
        )}
      </PageContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blocked by active usage</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>These segments are referenced by active campaigns/flows and cannot be deleted:</p>
                <ul className="list-disc pl-5 text-xs">{pendingDelete?.blockers.map((b, i) => <li key={i}>{b.kind}: {b.name}</li>)}</ul>
                <p className="text-xs text-muted-foreground">Deactivate or reassign those references first, then try again.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction disabled>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
