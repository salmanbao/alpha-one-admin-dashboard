"use client";

/**
 * Correlation Clusters — R9 W4 UC-O4.
 *
 * Collusion workbench: shows candidate clusters of accounts that share
 * suspicious signals (IP overlap, method reuse, mirrored fills, shared
 * referral). Each cluster has a signal matrix, evidence lines, notes,
 * and a one-click "Escalate to payout fraud queue" action.
 *
 * Single-signal guardrail: clusters with only 1 signal cannot escalate —
 * the UI shows "insufficient signal strength" and disables the button.
 *
 * Route-only (no nav child) — NAV_CHILDREN_MAX is at cap.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/platform/status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Network,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useClusterCases,
  addClusterNote,
  dismissCluster,
  escalateCluster,
  clusterHasFraudFlag,
  signalStrengthLabel,
  type ClusterCase,
  type ClusterSignal,
} from "@/lib/clusters-store";

const SIGNAL_LABELS: Record<ClusterSignal, string> = {
  "ip-overlap": "IP Overlap",
  "method-reuse": "Method Reuse",
  "mirrored-fills": "Mirrored Fills",
  "shared-referral": "Shared Referral",
};

const SIGNAL_ICONS: Record<ClusterSignal, string> = {
  "ip-overlap": "🌐",
  "method-reuse": "💳",
  "mirrored-fills": "📊",
  "shared-referral": "🔗",
};

export function CorrelationClustersPage() {
  const { runtime, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const clusters = useClusterCases(tid);

  const [selectedCluster, setSelectedCluster] = useState<ClusterCase | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const candidates = clusters.filter((c) => c.status === "candidate");
    const escalated = clusters.filter((c) => c.status === "escalated");
    const dismissed = clusters.filter((c) => c.status === "dismissed");
    const multiSignal = candidates.filter((c) => c.signals.length >= 2);
    return { candidates: candidates.length, escalated: escalated.length, dismissed: dismissed.length, multiSignal: multiSignal.length };
  }, [clusters]);

  const handleAddNote = () => {
    if (!selectedCluster || !noteText.trim()) return;
    addClusterNote(selectedCluster.id, noteText.trim(), "Operator");
    setNoteText("");
    toast({ title: "Note added", description: `Note added to cluster ${selectedCluster.id}` });
    // Refresh selected cluster
    const updated = clusters.find((c) => c.id === selectedCluster.id);
    if (updated) setSelectedCluster(updated);
  };

  const handleDismiss = () => {
    if (!selectedCluster || !dismissReason.trim()) return;
    dismissCluster(selectedCluster.id, dismissReason.trim(), "Operator");
    setShowDismissDialog(false);
    setDismissReason("");
    setSelectedCluster(null);
    toast({ title: "Cluster dismissed", description: "No fraud indicators confirmed." });
  };

  const handleEscalate = () => {
    if (!selectedCluster) return;
    if (selectedCluster.signals.length < 2) {
      toast({ title: "Insufficient signal strength", description: "At least 2 signals required to escalate.", variant: "destructive" });
      return;
    }
    const ok = escalateCluster(selectedCluster.id, "Operator");
    if (ok) {
      toast({ title: "Escalated to fraud queue", description: `Cluster ${selectedCluster.id} escalated with ${selectedCluster.signals.length} signals.` });
      const updated = clusters.find((c) => c.id === selectedCluster.id);
      if (updated) setSelectedCluster(updated);
    } else {
      toast({ title: "Escalation failed", description: "Cluster may already be escalated.", variant: "destructive" });
    }
  };

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns: Column<ClusterCase>[] = [
    {
      key: "id",
      header: "Cluster ID",
      render: (c) => <span className="font-mono text-xs">{c.id.slice(0, 32)}</span>,
    },
    {
      key: "accounts",
      header: "Accounts",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.accountLogins.slice(0, 3).map((l) => (
            <Badge key={l} variant="outline" className="text-xs">#{l}</Badge>
          ))}
          {c.accountLogins.length > 3 && <Badge variant="outline" className="text-xs">+{c.accountLogins.length - 3}</Badge>}
        </div>
      ),
    },
    {
      key: "signals",
      header: "Signals",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.signals.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {SIGNAL_ICONS[s]} {SIGNAL_LABELS[s]}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "strength",
      header: "Strength",
      render: (c) => {
        const { label, tone } = signalStrengthLabel(c.signals);
        return (
          <Badge variant={tone === "error" ? "destructive" : tone === "warning" ? "default" : "secondary"} className="text-xs">
            {label} ({c.signals.length})
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <StatusBadge
          status={c.status === "escalated" ? "escalated" : c.status === "dismissed" ? "dismissed" : "candidate"}
          label={c.status === "escalated" ? "Escalated" : c.status === "dismissed" ? "Dismissed" : "Candidate"}
        />
      ),
    },
    {
      key: "fraudFlag",
      header: "Fraud Queue",
      render: (c) => {
        const hasFlag = clusterHasFraudFlag(c.id);
        return hasFlag ? (
          <Badge variant="destructive" className="text-xs">In Queue</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedCluster(c)}>
          View <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Correlation Clusters"
        description="Collusion workbench — detect account linkage via IP, method, fill, and referral signals"
        icon={Network}
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Candidate Clusters" value={String(stats.candidates)} icon={Network} />
          <MetricCard label="Multi-Signal (≥2)" value={String(stats.multiSignal)} icon={ShieldAlert} />
          <MetricCard label="Escalated" value={String(stats.escalated)} icon={ArrowUpRight} />
          <MetricCard label="Dismissed" value={String(stats.dismissed)} icon={XCircle} />
        </div>

        {/* Guide */}
        <Collapsible defaultOpen className="rounded-lg border bg-muted/30 p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              How the collusion workbench works
            </span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Signals:</strong> IP Overlap (same IP), Method Reuse (same payout fingerprint),
              Mirrored Fills (opposing positions within 2h), Shared Referral (same affiliate code).
            </p>
            <p>
              <strong>Escalation guardrail:</strong> At least <strong>2 signals</strong> required.
              Single-signal clusters show &quot;insufficient signal strength&quot; and cannot escalate.
            </p>
            <p>
              <strong>Demo pair:</strong> Accounts #100001 and #100002 share IP 203.0.113.42,
              referral REF-COLLUSION-01, and mirrored EURUSD fills — a 3-signal cluster ready for escalation.
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Cluster table */}
        <div className="rounded-lg border bg-background">
          <DataTable
            columns={columns}
            data={clusters}
            emptyMessage="No collusion clusters detected."
            keyExtractor={(c) => c.id}
          />
        </div>

        {/* Detail dialog */}
        {selectedCluster && (
          <Dialog open onOpenChange={() => setSelectedCluster(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Cluster {selectedCluster.id.slice(0, 32)}
                </DialogTitle>
                <DialogDescription>
                  {selectedCluster.accountLogins.length} accounts · {selectedCluster.signals.length} signals
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Signal matrix */}
                <div className="rounded-lg border p-3">
                  <Label className="text-sm font-semibold">Signal Matrix</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(Object.keys(SIGNAL_LABELS) as ClusterSignal[]).map((s) => {
                      const has = selectedCluster.signals.includes(s);
                      return (
                        <div key={s} className={`flex items-center gap-2 rounded p-2 text-xs ${has ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"}`}>
                          {has ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {SIGNAL_ICONS[s]} {SIGNAL_LABELS[s]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accounts */}
                <div className="rounded-lg border p-3">
                  <Label className="text-sm font-semibold">Linked Accounts</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCluster.accountLogins.map((l, i) => (
                      <Badge key={l} variant="outline">
                        #{l} {selectedCluster.traderNames[i] ? `(${selectedCluster.traderNames[i]})` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Evidence */}
                <div className="rounded-lg border p-3">
                  <Label className="text-sm font-semibold">Evidence ({selectedCluster.evidence.length})</Label>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {selectedCluster.evidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="mt-0.5">•</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Notes */}
                <div className="rounded-lg border p-3">
                  <Label className="text-sm font-semibold">Notes ({selectedCluster.notes.length})</Label>
                  {selectedCluster.notes.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {selectedCluster.notes.map((n) => (
                        <li key={n.id} className="rounded bg-muted/50 p-2 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{n.actor}</span>
                            <span>{new Date(n.at).toLocaleString()}</span>
                          </div>
                          <p className="mt-1">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add investigation note..."
                      rows={2}
                      className="text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={handleAddNote} disabled={!noteText.trim()}>
                      Add
                    </Button>
                  </div>
                </div>

                {/* Status warning for single-signal */}
                {selectedCluster.signals.length < 2 && selectedCluster.status === "candidate" && (
                  <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs text-warning">
                    <strong>Insufficient signal strength:</strong> Only 1 signal detected. At least 2 signals required to escalate to the fraud queue.
                  </div>
                )}
              </div>

              <DialogFooter>
                {selectedCluster.status === "candidate" && (
                  <>
                    <Button variant="outline" onClick={() => setShowDismissDialog(true)}>
                      <XCircle className="mr-1 h-4 w-4" /> Dismiss
                    </Button>
                    <Button
                      onClick={handleEscalate}
                      disabled={selectedCluster.signals.length < 2}
                      className={selectedCluster.signals.length < 2 ? "opacity-50" : ""}
                    >
                      <ArrowUpRight className="mr-1 h-4 w-4" /> Escalate to Fraud Queue
                    </Button>
                  </>
                )}
                {selectedCluster.status === "escalated" && (
                  <Badge variant="destructive">Escalated {selectedCluster.escalatedAt ? new Date(selectedCluster.escalatedAt).toLocaleString() : ""}</Badge>
                )}
                {selectedCluster.status === "dismissed" && (
                  <Badge variant="secondary">Dismissed</Badge>
                )}
                <Button variant="ghost" onClick={() => setSelectedCluster(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Dismiss dialog */}
        {showDismissDialog && selectedCluster && (
          <Dialog open onOpenChange={setShowDismissDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dismiss Cluster</DialogTitle>
                <DialogDescription>
                  Mark cluster {selectedCluster.id} as dismissed (no fraud indicators).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="dismiss-reason">Reason *</Label>
                <Textarea
                  id="dismiss-reason"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="e.g., Shared office IP, family accounts, legitimate copy-trading..."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDismissDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDismiss} disabled={!dismissReason.trim()}>
                  Dismiss Cluster
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageContent>
    </Page>
  );
}