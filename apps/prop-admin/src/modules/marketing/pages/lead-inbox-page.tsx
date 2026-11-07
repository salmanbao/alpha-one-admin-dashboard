"use client";
/**
 * R4-02 — Lead Inbox & Assignment (P0, 1 route).
 *
 * UI layout:
 *   ● Triage columns: New / Assigned / Working / Won / Lost with counts and aging;
 *     drag or menu to move (store-backed)
 *   ● Lead detail drawer: submission payload verbatim, source attribution (form,
 *     landing page variant, UTM from link-tracking, onsite unit), deduplicated
 *     CRM contact link
 *   ● Assignment: single or bulk assign to operators with presence; reassignment
 *     keeps history
 *   ● SLA clock on first response per lead; breach escalates into the notifications
 *     center with the lead link
 *   ● Conversion toggle: Won writes the revenue event back to the campaign report
 *     funnel (N8) and attribution settings
 * AC-1: assignment and state changes persist via a lead store and survive reload
 *       (no local setState)
 * AC-2: SLA breaches appear as notifications with a deep link within one poll
 *       interval
 * AC-3: marking a lead Won increments the campaign-report conversion count for
 *       the source campaign
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/platform/permission-engine";
import {
  listLeads, listOperators, getCrmContact, getLead, assignLead, bulkAssign, setLeadStatus,
  checkSlaBreaches, useLeadVersion, metricCounts, type Lead, type Operator,
} from "../lead-inbox-store";
import { Mail, Activity, Clock, Users, UserPlus, CheckCircle2, ArrowRight, TrendingUp, DollarSign } from "lucide-react";

const STATUS_ORDER: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "New", color: "text-muted-foreground" },
  { id: "assigned", label: "Assigned", color: "text-blue-600" },
  { id: "working", label: "Working", color: "text-indigo-600" },
  { id: "won", label: "Won", color: "text-emerald-600" },
  { id: "lost", label: "Lost", color: "text-rose-600" },
];
type LeadStatus = "new" | "assigned" | "working" | "won" | "lost";

export function LeadInboxPage() {
  const { user, pushNotification, navigate } = usePlatform();
  const actor = user?.name ?? "operator";
  const canOperate = hasPermission(user, "marketing.leads.operate");
  useLeadVersion();
  const leads = listLeads();
  const operators = listOperators();
  const metrics = metricCounts();

  const [slaChecked, setSlaChecked] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [assignOwner, setAssignOwner] = useState<string | undefined>(undefined);
  const [drawer, setDrawer] = useState<Lead | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusIds, setBulkStatusIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("working");

  const selectedIds = Object.keys(selected).filter(id => selected[id]);

  // Poll SLA every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      const breaches = checkSlaBreaches((n) => {
        pushNotification({
          title: n.title,
          message: n.message,
          severity: n.severity === "danger" ? "critical" : n.severity,
          module: n.module,
        });
        if (n.deepLink) toast({ title: n.title, description: n.message });
      });
      if (breaches.length) setSlaChecked(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const colsByStatus: Record<LeadStatus, Lead[]> = useMemo(() => {
    const out: Record<LeadStatus, Lead[]> = { new: [], assigned: [], working: [], won: [], lost: [] };
    for (const l of leads) out[l.status].push(l);
    return out;
  }, [leads]);

  const aging = (lead: Lead) => {
    const mins = Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
  };

  const openAssign = (ids: string[]) => {
    setAssignIds(ids);
    setAssignOwner(undefined);
    setAssignOpen(true);
  };

  return (
    <Page>
      <PageHeader
        title="Lead Inbox & Assignment"
        description="Triage, assign and convert inbound leads from forms, landing pages, on-site units and tracked links. SLA breaches are escalated to the notifications center (requires marketing.leads.operate)."
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!canOperate} onClick={() => openAssign(selectedIds)}>
              Bulk assign
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map(m => (
            <MetricCard key={m.label} label={m.label} value={m.value} tone="info" />
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {STATUS_ORDER.map(({ id: status, label, color }) => {
            const items = colsByStatus[status];
            return (
              <Card key={status} className="border-border transition-colors hover:border-primary/50">
                <CardContent className="p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1 text-sm font-medium ${color}`}>
                      <Activity className="h-3.5 w-3.5" /> {label}
                    </span>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                    {items.map(l => (
                      <div key={l.id} className="flex items-center justify-between p-1.5 rounded border cursor-pointer hover:bg-muted"
                        onClick={() => setDrawer(l)}>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate">{l.email}</span>
                          <span className="text-[10px] text-muted-foreground block">{l.sourceName}</span>
                          <span className="text-[10px] text-muted-foreground block">{l.ownerName ?? "Unassigned"}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-mono">{aging(l)} old</span>
                          {l.slaBreached && <span className="text-[10px] text-rose-600 font-medium">SLA breach</span>}
                          <Checkbox checked={!!selected[l.id]} onCheckedChange={v => setSelected(s => ({ ...s, [l.id]: !!v }))} />
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-[10px] text-muted-foreground px-1">—</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Assignment dialog */}
        <AlertDialog open={assignOpen} onOpenChange={o => { setAssignOpen(o); if (!o) setAssignIds([]); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Assign lead(s)</AlertDialogTitle>
              <AlertDialogDescription>{assignIds.length === 1 ? "Assign a single lead to an operator." : `Assign ${assignIds.length} leads to an operator.`}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 p-3">
              <label className="text-xs font-medium text-muted-foreground">Operator</label>
              <Select value={assignOwner} onValueChange={v => setAssignOwner(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select operator" /></SelectTrigger>
                <SelectContent>
                  {operators.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name} <span className="text-[10px] text-muted-foreground">{o.presence}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={!assignOwner || !canOperate} onClick={() => {
                if (assignIds.length === 1) assignLead(assignIds[0], assignOwner!, actor);
                else bulkAssign(assignIds, assignOwner!, actor);
                setAssignOpen(false);
                toast({ title: "Assigned", description: `${assignIds.length} lead(s) assigned.` });
              }}>Assign</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk status change dialog */}
        <AlertDialog open={bulkStatusOpen} onOpenChange={o => { setBulkStatusOpen(o); if (!o) setBulkStatusIds([]); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change status</AlertDialogTitle>
              <AlertDialogDescription>{bulkStatusIds.length === 1 ? "Change a single lead's status." : `Change ${bulkStatusIds.length} leads.`}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 p-3">
              <label className="text-xs font-medium text-muted-foreground">New status</label>
              <Select value={bulkStatus} onValueChange={v => setBulkStatus(v as LeadStatus)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={bulkStatus} /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {bulkStatus === "won" && (
                <Input type="number" placeholder="Revenue ($)" className="h-9 text-xs" />
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={!canOperate} onClick={() => {
                for (const id of bulkStatusIds) setLeadStatus(id, bulkStatus, actor);
                setBulkStatusOpen(false);
                toast({ title: "Status updated", description: `${bulkStatusIds.length} lead(s) marked ${bulkStatus}.` });
              }}>{bulkStatus}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lead detail drawer */}
        <Sheet open={!!drawer} onOpenChange={o => !o && setDrawer(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Lead: {drawer?.email}</SheetTitle>
              <SheetDescription>{drawer?.sourceName}</SheetDescription>
            </SheetHeader>
            <div className="mt-3 space-y-4 text-xs">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={drawer?.status === "won" ? "secondary" : drawer?.status === "lost" ? "destructive" : "default"}>{drawer?.status}</Badge>
                {drawer?.ownerName && <Badge variant="outline" className="text-xs">Owner: {drawer.ownerName}</Badge>}
                {drawer?.slaBreached && <Badge variant="destructive" className="text-xs">SLA breach</Badge>}
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Submission payload</p>
                <pre className="bg-muted p-2 rounded overflow-x-auto text-[10px]">{JSON.stringify(drawer?.payload ?? {}, null, 2)}</pre>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Source attribution</p>
                <p className="text-muted-foreground">Source: {drawer?.source}</p>
                {drawer?.utm && (
                  <div className="space-y-0.5">
                    {Object.entries(drawer.utm).map(([k, v]) => (
                      <span key={k} className="text-[10px]">{k}: {v}</span>
                    ))}
                  </div>
                )}
                {drawer?.crmContactId && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-medium">CRM contact:</span>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate(`crm-contact-detail?id=${drawer.crmContactId}`)}>
                      {getCrmContact(drawer.crmContactId)?.email ?? drawer.crmContactId}
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold">History</p>
                <div className="space-y-1">
                  {drawer?.history.map((h, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="font-medium">{h.action}</span>
                      <span className="text-muted-foreground">{new Date(h.at).toLocaleString()} — {h.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setDrawer(null)}>Close</Button>
                <Button size="sm" onClick={() => { openAssign(drawer ? [drawer.id] : []); setDrawer(null); }}>Assign</Button>
                <Button size="sm" onClick={() => { setBulkStatusIds(drawer ? [drawer.id] : []); setBulkStatus("working"); setBulkStatusOpen(true); setDrawer(null); }}>Working</Button>
                <Button size="sm" variant="outline" onClick={() => { setBulkStatusIds(drawer ? [drawer.id] : []); setBulkStatus("won"); setBulkStatusOpen(true); setDrawer(null); }}>Mark Won</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}