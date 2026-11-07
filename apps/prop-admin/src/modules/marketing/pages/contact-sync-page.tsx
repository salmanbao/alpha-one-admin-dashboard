"use client";

/**
 * M3.4 — Contact Sync Monitor (spec §7.4).
 * Sync status per connected ESP/CRM destination, field mapping
 * editor, manual sync with progress, and an error queue with
 * retry/skip + CSV download.
 */

import { useEffect, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { RefreshCw, Settings2, Pause, Play, Download, ArrowLeftRight, Database } from "lucide-react";
import {
  listSyncDestinations, listSyncMappings, saveSyncMappings, listSyncErrors,
  startSync, completeSync, toggleDestinationPause, retrySyncError, skipSyncError,
  type SyncDestination, type SyncMappingRow, type SyncErrorRow,
} from "../segments-store";

const SYNC_TONE: Record<string, "success"|"danger"|"muted"|"info"|"warning"> = { ok:"success", error:"danger", paused:"muted", syncing:"info" };

export function ContactSyncPage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const dests = listSyncDestinations();
  const errors = listSyncErrors();
  const [mappingDest, setMappingDest] = useState<SyncDestination | null>(null);
  const [mappingRows, setMappingRows] = useState<SyncMappingRow[]>([]);

  // Complete dummy syncs after a short delay
  useEffect(() => {
    const syncing = listSyncDestinations().filter((d) => d.status === "syncing");
    if (syncing.length === 0) return;
    const t = setTimeout(() => { syncing.forEach((d) => completeSync(d.id)); refresh(); }, 1400);
    return () => clearTimeout(t);
  });

  function openMapping(d: SyncDestination) { setMappingDest(d); setMappingRows(JSON.parse(JSON.stringify(listSyncMappings(d.id)))); }

  const destCols: Column<SyncDestination>[] = [
    { key: "name", header: "Destination", sortValue: (d) => d.name, cell: (d) => <span className="text-sm font-medium">{d.name}<span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{d.kind}</span></span> },
    { key: "dir", header: "Direction", cell: (d) => <Badge variant="outline" className="text-[10px] capitalize">{d.direction}</Badge> },
    { key: "last", header: "Last sync", sortValue: (d) => d.lastSync, cell: (d) => <span className="text-xs" title={d.error}>{relativeTime(d.lastSync)}</span> },
    { key: "synced", header: "Synced / Failed", numeric: true, sortValue: (d) => d.synced, cell: (d) => <span className="text-xs tabular-nums">{d.synced.toLocaleString()} / <span className={d.failed > 0 ? "text-destructive" : ""}>{d.failed}</span></span> },
    { key: "map", header: "Field mapping", cell: (d) => <button type="button" className="text-xs underline decoration-dotted" onClick={() => openMapping(d)}>{d.mappedFields} fields mapped</button> },
    { key: "status", header: "Status", cell: (d) => <div className="space-y-1"><StatusBadge tone={SYNC_TONE[d.status]}>{d.status}</StatusBadge>{d.status === "syncing" && <Progress value={d.progress ?? 10} className="h-1 w-20" />}{d.error && <p className="max-w-[200px] truncate text-[10px] text-destructive" title={d.error}>{d.error}</p>}</div> },
    { key: "actions", header: "", cell: (d) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={d.status === "syncing"} onClick={() => { startSync(d.id); toast({ title: "Sync started", description: d.name }); refresh(); }}><RefreshCw className="mr-1 h-3 w-3" />Sync</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openMapping(d)}><Settings2 className="mr-1 h-3 w-3" />Map</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => { toggleDestinationPause(d.id); toast({ title: d.status === "paused" ? "Sync resumed" : "Sync paused", description: d.name }); refresh(); }}>{d.status === "paused" ? <><Play className="mr-1 h-3 w-3" />Resume</> : <><Pause className="mr-1 h-3 w-3" />Pause</>}</Button>
      </div>
    )},
  ];

  const errCols: Column<SyncErrorRow>[] = [
    { key: "contact", header: "Contact", cell: (e) => <span className="font-mono text-xs">{e.contact}</span> },
    { key: "dest", header: "Destination", cell: (e) => <span className="text-xs">{listSyncDestinations().find((d) => d.id === e.destinationId)?.name ?? e.destinationId}</span> },
    { key: "reason", header: "Reason", cell: (e) => <span className="text-xs text-destructive">{e.reason}</span> },
    { key: "first", header: "First seen", sortValue: (e) => e.firstSeen, cell: (e) => <span className="text-xs">{relativeTime(e.firstSeen)}</span> },
    { key: "attempts", header: "Attempts", numeric: true, sortValue: (e) => e.attempts, cell: (e) => <span className="tabular-nums text-xs">{e.attempts}</span> },
    { key: "actions", header: "", cell: (e) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => { retrySyncError(e.id); toast({ title: "Retry queued", description: `${e.contact} requeued to destination.` }); refresh(); }}>Retry</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { skipSyncError(e.id); toast({ title: "Error skipped" }); refresh(); }}>Skip</Button>
      </div>
    )},
  ];

  return (
    <Page>
      <PageHeader title="Contact Sync" description="Keep ESPs and the CRM aligned with your segment definitions." icon={ArrowLeftRight}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => toast({ title: "Mapping templates", description: "Template library opened (dummy)." })}>Mapping templates</Button><Button size="sm" onClick={() => { dests.forEach((d) => startSync(d.id)); toast({ title: "Syncing all destinations", description: `${dests.length} destinations started.` }); refresh(); }}><RefreshCw className="mr-1 h-4 w-4" />Sync all now</Button></div>} />
      <PageContent>
        {dests.length === 0 ? (
          <EmptyState title="No destinations connected" description="Connect an ESP or CRM to start syncing contacts." icon={Database}
            action={<Button size="sm" onClick={() => navigate("connector-new")}>Add connector</Button>} hint="Marketing → Integrations" />
        ) : (
          <DataTable columns={destCols} data={dests} rowKey={(d) => d.id} searchableText={(d) => `${d.name} ${d.kind}`} pageSize={10} emptyTitle="No destinations" />
        )}

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Error queue <Badge variant="secondary" className="ml-1 text-[10px]">{errors.length}</Badge></p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast({ title: "Errors CSV downloaded", description: `${errors.length} rows exported (dummy).` })}><Download className="mr-1 h-3 w-3" />Download errors CSV</Button>
          </div>
          <div className="p-2">
            {errors.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No sync errors.</p> :
              <DataTable columns={errCols} data={errors} rowKey={(e) => e.id} pageSize={6} emptyTitle="No errors" />}
          </div>
        </div>
      </PageContent>

      <Sheet open={!!mappingDest} onOpenChange={(o) => !o && setMappingDest(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Field mapping — {mappingDest?.name}</SheetTitle><SheetDescription>Platform field ↔ local field. PII flags control masking and export rules.</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-2">
            {mappingRows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_80px_28px] items-center gap-1.5 rounded-md border p-2">
                <Input value={r.platformField} onChange={(e) => { const n=[...mappingRows]; n[i]={...r,platformField:e.target.value}; setMappingRows(n); }} className="h-7 text-xs font-mono" aria-label="Platform field" />
                <Input value={r.localField} onChange={(e) => { const n=[...mappingRows]; n[i]={...r,localField:e.target.value}; setMappingRows(n); }} className="h-7 text-xs font-mono" aria-label="Local field" />
                <Badge variant={r.pii ? "secondary" : "outline"} className="justify-center text-[9px]">{r.pii ? "PII" : r.type}</Badge>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setMappingRows(mappingRows.filter((_, j) => j !== i))} aria-label="Remove">×</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMappingRows([...mappingRows, { id:`map-${Date.now()}`, platformField:"", localField:"", type:"string", pii:false }])}>Add row</Button>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { if (mappingDest) { saveSyncMappings(mappingDest.id, mappingRows); recordAudit({ action: "sync.mapping.save", entity: "sync-destination", entityId: mappingDest.id, summary: `Saved ${mappingRows.length} field mappings for ${mappingDest.name}.`, module: "marketing" }); toast({ title: "Test mapping passed", description: `5 sample records validated — ${mappingRows.length} fields mapped (${mappingRows.filter(r=>r.pii).length} PII). No destructive changes.` }); refresh(); } }}>Save &amp; test on 5 samples</Button>
              <Button variant="outline" onClick={() => setMappingDest(null)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  );
}
