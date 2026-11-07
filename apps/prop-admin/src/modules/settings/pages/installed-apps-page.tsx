"use client";

/**
 * M6.2 — Installed Apps Management (spec §10.2).
 * Lifecycle control for marketplace installs: versions, scopes,
 * disable with 30-day retention, updates requiring re-consent for
 * new scopes, safe uninstall.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Package, Store, RefreshCw, Trash2, ShieldCheck, Settings2 } from "lucide-react";
import { listInstalled, uninstallApp, disableApp, enableApp, updateApp, getApp, type InstalledApp } from "../marketplace-store";

const STATUS_TONE: Record<InstalledApp["status"], "success"|"muted"|"warning"> = { enabled: "success", disabled: "muted", update: "warning" };
const STATUS_LABEL: Record<InstalledApp["status"], string> = { enabled: "Enabled", disabled: "Disabled", update: "Update available" };

export function InstalledAppsPage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const rows = listInstalled();
  const [review, setReview] = useState<InstalledApp | null>(null);
  const [updateTarget, setUpdateTarget] = useState<InstalledApp | null>(null);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [uninstallTarget, setUninstallTarget] = useState<InstalledApp | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const columns: Column<InstalledApp>[] = [
    { key: "app", header: "App", sortValue: (r) => r.name, cell: (r) => <span className="text-sm font-medium">{r.name}<span className="ml-1.5 text-[10px] text-muted-foreground">v{r.version}</span></span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <div className="space-y-0.5"><StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>{r.disabledAt && r.purgeAt && <p className="text-[10px] text-amber-700">Purges {relativeTime(r.purgeAt)} unless restored</p>}</div> },
    { key: "scopes", header: "Scopes granted", cell: (r) => (
      <Popover><PopoverTrigger asChild><button type="button" className="text-xs underline decoration-dotted">{r.scopesGranted.length} scopes</button></PopoverTrigger>
        <PopoverContent className="w-72 space-y-1 p-2">{r.scopesGranted.map((s) => <div key={s} className="font-mono text-[10px]">{s}</div>)}</PopoverContent></Popover>
    )},
    { key: "last", header: "Last activity", sortValue: (r) => r.lastActivity, cell: (r) => <span className="text-xs" title={absoluteTime(r.lastActivity)}>{relativeTime(r.lastActivity)}</span> },
    { key: "by", header: "Installed by", cell: (r) => <span className="text-xs">{r.installedBy}</span> },
    { key: "actions", header: "", cell: (r) => (
      <div className="flex flex-wrap justify-end gap-1">
        {r.status === "update" && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => { setUpdateTarget(r); setAck(Object.fromEntries((r.newScopes ?? []).map((s) => [s, false]))); }}><RefreshCw className="mr-1 h-3 w-3" />Update</Button>}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toast({ title: "Configure", description: `${r.name} configuration opened (dummy).` })}><Settings2 className="mr-1 h-3 w-3" />Configure</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setReview(r)}><ShieldCheck className="mr-1 h-3 w-3" />Permissions</Button>
        <div className="flex items-center gap-1 px-1" title={r.status === "disabled" ? "Enable" : "Disable"}>
          <Switch checked={r.status !== "disabled"} onCheckedChange={(v) => {
            if (v) { enableApp(r.id, "You"); recordAudit({ action: "marketplace.enable", entity: "installed-app", entityId: r.id, summary: `Enabled ${r.name}.`, module: "settings" }); toast({ title: "App enabled", description: r.name }); }
            else { disableApp(r.id, "You"); recordAudit({ action: "marketplace.disable", entity: "installed-app", entityId: r.id, summary: `Disabled ${r.name}; data retained 30 days.`, severity: "warning", module: "settings" }); toast({ title: "App disabled", description: `${r.name} — data retained 30 days; scopes revoked.` }); }
            refresh();
          }} aria-label={`Toggle ${r.name}`} />
        </div>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => { setUninstallTarget(r); setConfirmName(""); }}><Trash2 className="mr-1 h-3 w-3" />Uninstall</Button>
      </div>
    )},
  ];

  const newScopes = updateTarget?.newScopes ?? [];
  const allAcked = newScopes.length === 0 || newScopes.every((s) => ack[s]);

  return (
    <Page>
      <PageHeader title="Installed Apps" description="Versions, scopes and lifecycle for everything installed from the marketplace." icon={Package}
        actions={<div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => toast({ title: "Checked for updates", description: "All apps are at their latest consented versions (simulated)." })}>Check for updates</Button><Button variant="outline" size="sm" onClick={() => navigate("marketplace")}><Store className="mr-1 h-4 w-4" />Open Marketplace</Button></div>} />
      <PageContent>
        {rows.length === 0 ? (
          <EmptyState title="Nothing installed yet" description="Browse the marketplace to add integrations." icon={Package} action={<Button size="sm" onClick={() => navigate("marketplace")}>Open Marketplace</Button>} />
        ) : (
          <DataTable columns={columns} data={rows} rowKey={(r) => r.id} searchableText={(r) => `${r.name} ${r.status}`} pageSize={10} emptyTitle="No apps" />
        )}
      </PageContent>

      {/* Permissions review */}
      <Sheet open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Permissions — {review?.name}</SheetTitle><SheetDescription>Granted vs requested scope diff and history.</SheetDescription></SheetHeader>
          {review && (
            <div className="mt-4 space-y-4">
              {(() => { const app = getApp(review.appId); const requested = app?.scopes.map((s) => s.id) ?? review.scopesGranted; const unused = review.scopesGranted.filter((s) => !(app?.scopes.some((x) => x.id === s && x.required))); return (
                <>
                  <div><p className="mb-1 text-xs font-semibold">Granted</p><div className="space-y-1">{review.scopesGranted.map((s) => <div key={s} className="flex items-center justify-between rounded border px-2 py-1 font-mono text-[10px]"><span>{s}</span>{unused.includes(s) && <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]" onClick={() => toast({ title: "Scope revoked", description: `${s} revoked (unused).` })}>Revoke unused</Button>}</div>)}</div></div>
                  <div><p className="mb-1 text-xs font-semibold">Requested by app</p><div className="space-y-1">{requested.map((s) => <div key={s} className={`rounded border px-2 py-1 font-mono text-[10px] ${review.scopesGranted.includes(s) ? "border-emerald-400/50" : "border-amber-400/50"}`}>{s} <span className="text-muted-foreground">({review.scopesGranted.includes(s) ? "granted" : "not granted"})</span></div>)}</div></div>
                </>
              ); })()}
              <div><p className="mb-1 text-xs font-semibold">Scope history</p><ul className="space-y-1 text-[11px] text-muted-foreground">{review.audit.map((a, i) => <li key={i}><span className="font-mono text-[10px]">{absoluteTime(a.ts)}</span> — {a.action} <span className="text-foreground">({a.actor})</span></li>)}</ul></div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Update dialog */}
      <Dialog open={!!updateTarget} onOpenChange={(o) => !o && setUpdateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update {updateTarget?.name}</DialogTitle><DialogDescription>v{updateTarget?.version} → v{updateTarget?.availableVersion}. Review the changelog and any new scopes.</DialogDescription></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Changelog: security fixes, improved sync reliability, and minor UI updates (dummy).</p>
            {newScopes.length > 0 && (
              <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">New scopes added — re-consent required</p>
                {newScopes.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs"><Checkbox checked={!!ack[s]} onCheckedChange={(v) => setAck({ ...ack, [s]: !!v })} /><span className="font-mono">{s}</span></label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button disabled={!allAcked} onClick={() => {
              if (!updateTarget) return;
              // simulate update failure rollback path occasionally? keep deterministic: always succeeds
              const next = updateApp(updateTarget.id, "You", newScopes.filter((s) => ack[s]));
              if (next) { recordAudit({ action: "marketplace.update", entity: "installed-app", entityId: next.id, summary: `Updated ${next.name} to v${next.version} with re-consent.`, module: "settings" }); toast({ title: "App updated", description: `${next.name} is now v${next.version}.` }); }
              else toast({ title: "Update failed", description: "Rolled back to the prior version automatically." });
              setUpdateTarget(null); refresh();
            }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall */}
      <AlertDialog open={!!uninstallTarget} onOpenChange={(o) => !o && setUninstallTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Uninstall {uninstallTarget?.name}?</AlertDialogTitle><AlertDialogDescription>Scopes are revoked immediately and the connector (if any) disconnects. Type the app name to confirm.</AlertDialogDescription></AlertDialogHeader>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={uninstallTarget?.name} aria-label="Confirm app name" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={confirmName !== uninstallTarget?.name} onClick={() => {
              if (!uninstallTarget) return;
              uninstallApp(uninstallTarget.id, "You");
              recordAudit({ action: "marketplace.uninstall", entity: "installed-app", entityId: uninstallTarget.id, summary: `Uninstalled ${uninstallTarget.name}; scopes revoked.`, severity: "warning", module: "settings" });
              toast({ title: "App uninstalled", description: `${uninstallTarget.name} removed and scopes revoked.` });
              setUninstallTarget(null); refresh();
            }}>Uninstall</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
