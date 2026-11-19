"use client";

/**
 * Platform Operator Directory (gap S-01 / S-02 — P0-3).
 *
 * Was: MFA hardcoded "Enabled", status hardcoded "Active", dead
 * Edit/Suspend buttons, an "Invite operator" button with no onClick, and
 * metrics that just returned the row count. Now:
 *
 * - Real per-operator MFA status from the seed (enabled / pending /
 *   disabled — honest states, no more universal "Enabled").
 * - Real lifecycle status, merged over the seed from persisted
 *   `pfaas:userOverrides` patches so transitions approved on *any* page
 *   (and from other tabs) show up here without a refresh.
 * - Edit / Suspend / Activate stage `operator.*` two-operator requests;
 *   the applier patches the override, writes one audit row (actor =
 *   approver, detail names the initiator + typed reason) and toasts the
 *   outcome. Self-suspend is blocked at initiation *and* at apply time.
 * - Invite operator deep-links into the staff invite form (`?invite=1`).
 * - Metrics (With MFA / Active / Suspended) are computed, not hardcoded.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { users as allUsers } from "@/lib/platform/mock-data";
import {
  usePlatform,
  useUserOverrides,
  type OperatorMutation,
} from "@/lib/platform/platform-context";
import type { AuthUser } from "@/lib/platform/types";
import { toast } from "@/hooks/use-toast";
import {
  Users,
  ShieldCheck,
  KeyRound,
  Clock,
  AlertTriangle,
  UserPlus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

const demoOperators = allUsers.filter(
  (u) => u.application === "super-admin" || u.application === "prop-admin",
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleBadge = (r: string) =>
  r === "super-admin" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" :
  r === "prop-admin" ? "border-teal-500/30 text-teal-700 dark:text-teal-400" :
  "border-slate-500/30 text-slate-700 dark:text-slate-400";

const mfaLabel: Record<string, string> = {
  enabled: "Enabled",
  pending: "Pending",
  disabled: "Disabled",
};

type EditFlow = {
  kind: "suspend" | "activate" | "edit";
  op: AuthUser;
  /** Post-edit values (suspend/activate pass the current ones). */
  name: string;
  email: string;
  /** Constrained by the form's SelectItem values. */
  mfa: NonNullable<AuthUser["mfa"]>;
};

export function OperatorDirectoryPage() {
  const { user, navigate } = usePlatform();
  // Async seam (frontend-first): data resolves via the mock layer so the
  // loading skeleton + error/retry states are exercised.
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoOperators, { delayMs: 450 }), []);
  // Persisted lifecycle/profile patches merged over the seed — the
  // single source of truth for status + MFA once an approval lands.
  const overrides = useUserOverrides();

  const operators = useMemo(
    () => (loadedData ?? []).map((u) => ({ ...u, ...overrides[u.id] })),
    [loadedData, overrides],
  );

  const total = operators.length;
  const withMfa = operators.filter((u) => u.mfa === "enabled").length;
  const suspended = operators.filter((u) => u.status === "suspended").length;
  const active = total - suspended;

  /* ── Edit form (S-01: directory Edit had no onClick) ──────────── */
  const [editTarget, setEditTarget] = useState<AuthUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMfa, setEditMfa] = useState<string>("enabled");

  /* ── Staged maker-checker flow (suspend / activate / edit) ────── */
  const [flow, setFlow] = useState<EditFlow | null>(null);

  const openEdit = (u: AuthUser) => {
    setEditTarget(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditMfa(u.mfa ?? "enabled");
  };

  const emailOk = EMAIL_RE.test(editEmail.trim());
  const editFormOk = editName.trim().length >= 2 && emailOk;
  const editDirty =
    editTarget !== null &&
    (editName.trim() !== editTarget.name ||
      editEmail.trim() !== editTarget.email ||
      editMfa !== (editTarget.mfa ?? "enabled"));

  /* Columns are per-render: the cells close over `user` (self-suspend
   * guard) and the handlers above. */
  const columns: Column<AuthUser>[] = [
    {
      key: "name",
      header: "Operator",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{u.initials}</span>
          <div>
            <p className="font-medium text-foreground">{u.name}</p>
            <p className="text-[10px] text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => u.roles.map((r) => (
        <Badge key={r} variant="outline" className={cn("mr-1 text-[10px] capitalize", roleBadge(r))}>{r}</Badge>
      )),
      sortValue: (u) => u.roles[0],
    },
    {
      key: "app",
      header: "Application",
      cell: (u) => <Badge variant="outline" className="text-[10px]">{u.application}</Badge>,
      sortValue: (u) => u.application,
    },
    {
      key: "mfa",
      header: "MFA",
      cell: (u) =>
        u.mfa === "pending" ? (
          <StatusBadge tone="warning"><Clock className="mr-1 h-3 w-3" />Pending</StatusBadge>
        ) : u.mfa === "disabled" ? (
          <StatusBadge tone="danger"><KeyRound className="mr-1 h-3 w-3" />Disabled</StatusBadge>
        ) : (
          <StatusBadge tone="success"><KeyRound className="mr-1 h-3 w-3" />Enabled</StatusBadge>
        ),
      sortValue: (u) => u.mfa ?? "enabled",
    },
    {
      key: "lastActive",
      header: "Last Active",
      cell: (u) => <span className="text-xs text-muted-foreground">{u.lastActiveAt}</span>,
      sortValue: (u) => u.lastActiveAt,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge tone={u.status === "suspended" ? "danger" : "success"}>
            {u.status === "suspended" ? "Suspended" : "Active"}
          </StatusBadge>
          {u.id === user.id && (
            <Badge variant="outline" className="text-[9px]">You</Badge>
          )}
        </span>
      ),
      sortValue: (u) => u.status ?? "active",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (u) => {
        const isSelf = u.id === user.id;
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              title="Edit — name, email, MFA status (2FA + second operator)"
              onClick={() => openEdit(u)}
            >
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            {u.status === "suspended" ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                title="Reactivate — 2FA + second-operator approval"
                onClick={() =>
                  setFlow({ kind: "activate", op: u, name: u.name, email: u.email, mfa: u.mfa ?? "enabled" })
                }
              >
                Activate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-rose-600 hover:text-rose-600"
                disabled={isSelf}
                title={
                  isSelf
                    ? "You cannot suspend your own account."
                    : "Suspend — 2FA + second-operator approval (reason required)"
                }
                onClick={() =>
                  setFlow({ kind: "suspend", op: u, name: u.name, email: u.email, mfa: u.mfa ?? "enabled" })
                }
              >
                Suspend
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Platform Operator Directory"
        description="Platform staff with access to the super-admin console."
        icon={Users}
        actions={
          <Button size="sm" onClick={() => navigate("platform-staff", { invite: "1" })}>
            <UserPlus className="mr-1 h-4 w-4" /> Invite operator
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading operators…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Operators" value={total} icon={Users} />
          <MetricCard label="With MFA" value={withMfa} icon={KeyRound} tone={withMfa === total ? "positive" : "warning"} />
          <MetricCard label="Active" value={active} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Suspended" value={suspended} icon={AlertTriangle} tone={suspended > 0 ? "negative" : "positive"} />
        </div>
        <DataTable
          columns={columns}
          data={operators}
          rowKey={(u) => u.id}
          searchableText={(u) => `${u.name} ${u.email} ${u.roles.join(" ")} ${u.mfa ?? ""} ${u.status ?? ""}`}
          searchPlaceholder="Search operators…"
          pageSize={20}
          emptyTitle="No operators"
          emptyDescription="Invite operators to get started."
        />
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Edit form → maker-checker (S-01 directory Edit) ──────── */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit operator</DialogTitle>
            <DialogDescription>
              Profile and MFA-state changes are a two-operator action: 2FA →
              second operator approves → the directory and audit log update
              together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="op-name" className="text-xs">Name (required)</Label>
              <Input
                id="op-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                maxLength={64}
              />
              {editName.trim() !== "" && editName.trim().length < 2 && (
                <p className="text-[11px] text-destructive">At least 2 characters.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-email" className="text-xs">Email (required)</Label>
              <Input
                id="op-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              {editEmail.trim() !== "" && !emailOk && (
                <p className="text-[11px] text-destructive">Enter a valid email address.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-mfa" className="text-xs">MFA status (S-02 — per operator, honest)</Label>
              <Select value={editMfa} onValueChange={setEditMfa}>
                <SelectTrigger id="op-mfa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled — enrolled & verified</SelectItem>
                  <SelectItem value="pending">Pending — enrollment not completed</SelectItem>
                  <SelectItem value="disabled">Disabled — recovery required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
              Which fields changed is decided at submit time and spelled out in
              the audit row the approver&apos;s decision triggers.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              disabled={!editFormOk || !editDirty}
              title={!editDirty ? "Nothing changed yet." : undefined}
              onClick={() => {
                if (!editTarget) return;
                setFlow({
                  kind: "edit",
                  op: editTarget,
                  name: editName.trim(),
                  email: editEmail.trim(),
                  // SelectItem values are exactly the three MFA states.
                  mfa: editMfa as NonNullable<AuthUser["mfa"]>,
                });
                setEditTarget(null);
              }}
            >
              Continue to 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Maker-checker (S-09): suspend / activate / edit ──────── */}
      {flow ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setFlow(null);
          }}
          actionKey={`operator.${flow.kind}`}
          title={
            flow.kind === "suspend"
              ? `Suspend ${flow.name}`
              : flow.kind === "activate"
                ? `Reactivate ${flow.name}`
                : `Update ${flow.name}`
          }
          consequence={
            flow.kind === "suspend"
              ? `Revokes ${flow.name}'s console access — status flips to Suspended the moment operator B approves.`
              : flow.kind === "activate"
                ? `Restores ${flow.name}'s console access and re-enables their roles.`
                : `Persists profile/MFA changes to ${flow.name}'s operator record.`
          }
          blastRadius={
            flow.kind === "suspend"
              ? [
                  "Console access revoked — no sign-in until reactivated",
                  `Roles retained but unusable while suspended: ${flow.op.roles.join(", ")}`,
                  "Directory status + Suspended metric update; one warning audit row records your reason",
                  "Two-operator approval required — the request expires in 10 minutes",
                ]
              : flow.kind === "activate"
                ? [
                    "Status returns to Active; the Suspended metric recalculates",
                    `Roles re-enabled: ${flow.op.roles.join(", ")}`,
                    "One info audit row records the reactivation",
                    "Two-operator approval required — the request expires in 10 minutes",
                  ]
                : [
                    `Name: "${flow.op.name}" → "${flow.name}"`,
                    `Email: ${flow.op.email} → ${flow.email}`,
                    `MFA status: ${mfaLabel[flow.op.mfa ?? "enabled"]} → ${mfaLabel[flow.mfa] ?? flow.mfa}`,
                    "One info audit row names exactly which fields changed",
                    "Two-operator approval required — the request expires in 10 minutes",
                  ]
          }
          detail={`Operator lifecycle · ${flow.email}`}
          requireReason={flow.kind === "suspend"}
          twoOperator
          approvalPayload={{
            kind: flow.kind,
            userId: flow.op.id,
            name: flow.name,
            email: flow.email,
            mfa: flow.mfa,
          } satisfies OperatorMutation}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title:
                flow.kind === "suspend"
                  ? "Operator suspension pending approval"
                  : flow.kind === "activate"
                    ? "Reactivation pending approval"
                    : "Operator update pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}
    </Page>
  );
}
