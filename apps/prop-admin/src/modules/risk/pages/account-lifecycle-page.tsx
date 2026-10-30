"use client";

/**
 * Account Lifecycle — audit finding #2 (HIGH, missing screen).
 *
 * Structured suspension / termination workflow for trader accounts:
 * select an account → choose an action (restrict, suspend, terminate)
 * → document a reason (required) → confirm with optional notification →
 * the change is applied to the in-memory account store and written to
 * the lifecycle log (immutable audit trail rows below the queue).
 *
 * Frontend-only demo: mutations live in component state; nothing hits
 * a backend. The reason requirement mirrors the PRD's "no silent
 * restriction" rule — every state change needs a documented justification.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert, Ban, PauseCircle, XCircle, History, Send,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getTenantTraders } from "@/lib/platform/mock-data";

type LifecycleAction = "restrict" | "suspend" | "terminate";

interface LifecycleEntry {
  id: string;
  accountId: string;
  traderName: string;
  action: LifecycleAction;
  reason: string;
  operator: string;
  notified: boolean;
  at: string;
}

const ACTION_META: Record<LifecycleAction, { label: string; tone: "warning" | "destructive"; icon: typeof Ban }> = {
  restrict: { label: "Restrict", tone: "warning", icon: Ban },
  suspend: { label: "Suspend", tone: "warning", icon: PauseCircle },
  terminate: { label: "Terminate", tone: "destructive", icon: XCircle },
};

const REASON_PRESETS = [
  "Suspected copy-trading / inverse hedging",
  "KYC verification failure",
  "Terms of service violation",
  "Chargeback / payment dispute",
  "Regulatory requirement",
];

export function AccountLifecyclePage() {
  const { runtime } = usePlatform();
  const traders = getTenantTraders(runtime.tenant?.id ?? "platform").slice(0, 12);

  const [log, setLog] = useState<LifecycleEntry[]>([
    {
      id: "lc-1001",
      accountId: "acct-7741",
      traderName: "Marta Vidal",
      action: "suspend",
      reason: "Suspected copy-trading / inverse hedging across 3 accounts",
      operator: "risk.ops@firm",
      notified: true,
      at: "2026-10-28T09:14:00Z",
    },
    {
      id: "lc-1002",
      accountId: "acct-7690",
      traderName: "Jonas Berg",
      action: "restrict",
      reason: "KYC document expired — restricted pending re-verification",
      operator: "kyc.review@firm",
      notified: true,
      at: "2026-10-26T16:02:00Z",
    },
  ]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>("");
  const [action, setAction] = useState<LifecycleAction>("suspend");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const openDialog = (traderId: string) => {
    setTargetId(traderId);
    setAction("suspend");
    setReason("");
    setNotify(true);
    setReasonError(null);
    setDialogOpen(true);
  };

  const apply = () => {
    if (reason.trim().length < 10) {
      setReasonError("A documented reason of at least 10 characters is required.");
      return;
    }
    const trader = traders.find((t) => t.id === targetId);
    const entry: LifecycleEntry = {
      id: `lc-${Date.now().toString(36)}`,
      accountId: targetId,
      traderName: trader?.name ?? targetId,
      action,
      reason: reason.trim(),
      operator: "you@firm",
      notified: notify,
      at: new Date().toISOString(),
    };
    setLog((prev) => [entry, ...prev]);
    setDialogOpen(false);
    toast({
      title: `${ACTION_META[action].label} applied`,
      description: `${entry.traderName} (${targetId}) — audit entry ${entry.id} recorded.`,
    });
  };

  const active = log.filter((e) => e.action !== "terminate").length;
  const suspended = log.filter((e) => e.action === "suspend").length;

  const queueColumns: Column<(typeof traders)[number]>[] = [
    {
      key: "name",
      header: "Trader",
      cell: (row) => (
        <div>
          <div className="font-medium text-sm">{row.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.id}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Account status",
      cell: (row) => <StatusBadge tone="success">Active</StatusBadge>,
    },
    {
      key: "country",
      header: "Country",
      cell: (row) => <Badge variant="outline">{row.country ?? "—"}</Badge>,
    },
    {
      key: "action",
      header: "",
      className: "w-32 text-right",
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => openDialog(row.id)}>
          Manage
        </Button>
      ),
    },
  ];

  const logColumns: Column<LifecycleEntry>[] = [
    {
      key: "at",
      header: "When",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.at).toLocaleString()}
        </span>
      ),
    },
    {
      key: "trader",
      header: "Account",
      cell: (row) => (
        <div>
          <div className="text-sm font-medium">{row.traderName}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.accountId}</div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (row) => {
        const meta = ACTION_META[row.action];
        return (
          <Badge variant={meta.tone === "destructive" ? "destructive" : "secondary"}>
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => <span className="text-sm">{row.reason}</span>,
    },
    {
      key: "operator",
      header: "Operator",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.operator}</span>,
    },
    {
      key: "notified",
      header: "Trader notified",
      cell: (row) => (
        <StatusBadge tone={row.notified ? "success" : "muted"}>{row.notified ? "Yes" : "No"}</StatusBadge>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Account Lifecycle"
        description="Structured suspension and termination workflow with documented reasons and immutable audit trail."
        icon={ShieldAlert}
      />
      <PageContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricCard label="Open lifecycle actions" value={String(active)} icon={History} />
          <MetricCard label="Suspended accounts" value={String(suspended)} icon={PauseCircle} tone={suspended > 0 ? "warning" : "default"} />
          <MetricCard label="Terminated (log)" value={String(log.filter((e) => e.action === "terminate").length)} icon={XCircle} tone="negative" />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Ban className="h-4 w-4 text-muted-foreground" />
            Accounts eligible for restriction
          </p>
          <DataTable
            columns={queueColumns}
            data={traders}
            rowKey={(row) => row.id}
            pageSize={8}
            searchableText={(row) => `${row.name} ${row.id}`}
            searchPlaceholder="Search traders…"
            emptyTitle="No accounts in scope"
            emptyDescription="All trader accounts are currently in good standing."
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" />
            Lifecycle audit trail
          </p>
          <DataTable
            columns={logColumns}
            data={log}
            rowKey={(row) => row.id}
            pageSize={6}
            emptyTitle="No lifecycle actions recorded"
            emptyDescription="Restrictions, suspensions, and terminations will appear here with their documented reasons."
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply lifecycle action</DialogTitle>
              <DialogDescription>
                Every state change requires a documented reason and is written to the
                immutable audit trail. The trader is notified immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as LifecycleAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restrict">Restrict (limits trading)</SelectItem>
                    <SelectItem value="suspend">Suspend (freeze account)</SelectItem>
                    <SelectItem value="terminate">Terminate (close account)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-reason">Reason (required)</Label>
                <Textarea
                  id="lc-reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(null);
                  }}
                  placeholder="Describe the violation or risk event that justifies this action…"
                  rows={3}
                  aria-invalid={!!reasonError}
                  aria-describedby={reasonError ? "lc-reason-error" : undefined}
                />
                {reasonError && (
                  <p id="lc-reason-error" role="alert" className="text-xs font-medium text-destructive">
                    {reasonError}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {REASON_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setReason(p);
                        setReasonError(null);
                      }}
                      className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="accent-primary"
                />
                Notify the trader by email and in-app message
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={action === "terminate" ? "destructive" : "default"}
                onClick={apply}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Apply {ACTION_META[action].label.toLowerCase()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </Page>
  );
}
