"use client";

/**
 * Platform Staff Page — Platform-level user/staff management.
 *
 * Stitch screen: platform_staff
 * Tier 1 — Manage platform operators, their roles, and access.
 *
 * Gap P0-2 (S-01 write-path share / S-09): the roster was a page-local
 * const and "Invite Staff" was a toast with no form. The roster now
 * lives in the staff store, and an invite collects email/role/tenant
 * access, then runs the 2FA → two-operator approval flow — the row
 * appears (status `invited`) with an audit row the moment operator B
 * approves.
 *
 * Gap P0-3 (S-01): the row action menu runs the real lifecycle —
 * activate / suspend / offboard — each staged as a `staff.*` two-
 * operator request whose applier revokes or restores access (permissions
 * → 0, tenant access → "Access revoked", stashed for restore) and writes
 * one audit row per transition. Deep-link: the directory's "Invite
 * operator" arrives with `?invite=1`.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useStaff, type StoredStaff, type StaffMutation, type StaffLifecycleMutation } from "@/lib/platform/staff-store";
import { useRoles } from "@/lib/platform/role-store";
import { useTenants } from "@/lib/platform/tenant-store";
import { toast } from "@/hooks/use-toast";
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  ShieldAlert,
  LogOut,
  Key,
} from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const staffTone: Record<string, "success" | "muted" | "danger" | "warning"> = {
  active: "success",
  inactive: "muted",
  suspended: "danger",
  invited: "warning",
  offboarded: "muted",
};

export function PlatformStaffPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the store-
  // backed roster below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { navigate, router } = usePlatform();
  const staff = useStaff();
  const platformRoles = useRoles("platform");
  const tenants = useTenants();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  /* ── Invite flow (S-09): form dialog → 2FA → staged request ── */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteAccess, setInviteAccess] = useState("All Tenants");
  const [inviteFlow, setInviteFlow] = useState<StaffMutation | null>(null);

  const selectedRolePermissions =
    platformRoles.find((r) => r.name === inviteRole)?.permissions.length ?? 0;
  const emailOk = EMAIL_RE.test(inviteEmail.trim());
  const inviteFormOk = emailOk && inviteRole !== "";

  const openInvite = () => {
    setInviteEmail("");
    setInviteRole(platformRoles[0]?.name ?? "");
    setInviteAccess("All Tenants");
    setInviteOpen(true);
  };

  /* ── Row lifecycle (gap S-01 / P0-3): activate/suspend/offboard ── */
  const [lifecycleFlow, setLifecycleFlow] = useState<{
    kind: StaffLifecycleMutation["kind"];
    staff: StoredStaff;
  } | null>(null);

  // The directory's "Invite operator" deep-links here with ?invite=1 —
  // one-shot so later re-renders never clobber a half-typed form.
  const inviteDeepLinked = useRef(false);
  useEffect(() => {
    if (inviteDeepLinked.current || router.params.invite !== "1") return;
    inviteDeepLinked.current = true;
    openInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.params.invite]);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [staff, search, statusFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((s) => s.status === "active").length,
    inactive: staff.filter((s) => s.status === "inactive").length,
    suspended: staff.filter((s) => s.status === "suspended").length,
  }), [staff]);

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    staff.forEach((s) => {
      counts[s.role] = (counts[s.role] ?? 0) + 1;
    });
    return Object.entries(counts).map(([role, count]) => ({
      role,
      count,
      pct: Math.round((count / stats.total) * 100),
      color: platformRoles.find((r) => r.name === role)?.color ?? "#74796e",
    }));
  }, [staff, stats.total, platformRoles]);

  return (
    <Page>
      <PageHeader
        title="Platform Staff"
        description="Manage platform operators, their roles, and access permissions."
        icon={Users}
        actions={
          <>
            {/* Directory (operator profiles) lives behind Platform Staff */}
            <Button size="sm" variant="outline" onClick={() => navigate("operator-directory")}>
              Directory
            </Button>
            <Button size="sm" onClick={openInvite}>
              <Plus className="mr-1 h-4 w-4" /> Invite Staff
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading platform staff…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Staff" value={stats.total} icon={Users} />
          <MetricCard label="Active Now" value={stats.active} delta={8} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Inactive" value={stats.inactive} icon={LogOut} tone="warning" />
          <MetricCard label="Suspended" value={stats.suspended} icon={ShieldAlert} tone="negative" />
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "active", "invited", "inactive", "suspended", "offboarded"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Role distribution */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Role Distribution</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roleDistribution.map((r) => (
                <div key={r.role} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: r.color }}>
                    {r.role.slice(0, 2)}
                  </div>
                  <span className="flex-1 text-sm">{r.role}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={r.pct} className="h-1.5 w-20" />
                    <span className="text-xs text-muted-foreground">{r.count} ({r.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Staff table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant Access</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: s.color }}
                          >
                            {s.initials}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {s.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                          style={{ borderColor: s.color, color: s.color }}
                        >
                          {s.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] font-mono">{s.level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{s.tenantAccess}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Key className="h-3 w-3" /> {s.permissions}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.lastActive}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={staffTone[s.status] ?? "muted"}>
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label={`Actions for ${s.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {s.status !== "active" && s.status !== "invited" && (
                              <DropdownMenuItem
                                onSelect={() => setLifecycleFlow({ kind: "activate", staff: s })}
                              >
                                Activate — restore access
                              </DropdownMenuItem>
                            )}
                            {s.status === "active" && (
                              <DropdownMenuItem
                                onSelect={() => setLifecycleFlow({ kind: "suspend", staff: s })}
                              >
                                Suspend — revoke access
                              </DropdownMenuItem>
                            )}
                            {s.status !== "offboarded" && (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setLifecycleFlow({ kind: "offboard", staff: s })}
                              >
                                Offboard — deactivate &amp; revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 font-medium">No staff members found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Invite form → maker-checker (S-01 form + S-09 flow) ─── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite platform staff</DialogTitle>
            <DialogDescription>
              The invite is a two-operator action: 2FA → second operator approves →
              the row appears as <strong>invited</strong> (audited).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                Work email (required)
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="operator@pfaas.io"
                autoFocus
              />
              {inviteEmail.trim() !== "" && !emailOk && (
                <p className="text-[11px] text-destructive">
                  Enter a valid email address.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="text-xs">
                Role (required)
              </Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Pick a platform role…" />
                </SelectTrigger>
                <SelectContent>
                  {platformRoles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name} · {r.permissions.length} perms
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-access" className="text-xs">
                Tenant access
              </Label>
              <Select value={inviteAccess} onValueChange={setInviteAccess}>
                <SelectTrigger id="invite-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Tenants">All Tenants</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
              The role&apos;s current permission set ({selectedRolePermissions}{" "}
              {selectedRolePermissions === 1 ? "permission" : "permissions"}) is
              applied when the invitee accepts — approvers see this count.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!inviteFormOk}
              onClick={() => {
                setInviteFlow({
                  kind: "invite",
                  email: inviteEmail.trim(),
                  role: inviteRole,
                  tenantAccess: inviteAccess,
                });
                setInviteOpen(false);
              }}
            >
              <Mail className="mr-1 h-4 w-4" /> Continue to 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Maker-checker (S-09): consequences → 2FA → staged request ── */}
      {inviteFlow ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setInviteFlow(null);
          }}
          actionKey="staff.invite"
          title={`Invite ${inviteFlow.email}`}
          consequence={`Sends an invitation email granting the "${inviteFlow.role}" role.`}
          blastRadius={[
            `New operator account with role "${inviteFlow.role}" (${selectedRolePermissions} permissions)`,
            `Tenant access: ${inviteFlow.tenantAccess}`,
            "The invitee appears in the roster as invited until they accept",
            "Two-operator approval required — the request expires in 10 minutes",
          ]}
          detail={`Staff invite · ${inviteFlow.email}`}
          twoOperator
          approvalPayload={inviteFlow}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: "Staff invite pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}

      {/* ── Row lifecycle (gap S-01 / P0-3): consequence → 2FA → staged
            request; the applier revokes/restores access + audits ──── */}
      {lifecycleFlow ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setLifecycleFlow(null);
          }}
          actionKey={`staff.${lifecycleFlow.kind}`}
          title={`${lifecycleFlow.kind.charAt(0).toUpperCase()}${lifecycleFlow.kind.slice(1)} ${lifecycleFlow.staff.name}`}
          consequence={
            lifecycleFlow.kind === "suspend"
              ? `Revokes ${lifecycleFlow.staff.name}'s platform access — they cannot act until reactivated.`
              : lifecycleFlow.kind === "offboard"
                ? `Deactivates ${lifecycleFlow.staff.name}'s account and revokes all access permanently.`
                : `Restores ${lifecycleFlow.staff.name}'s previous permissions and tenant access.`
          }
          blastRadius={
            lifecycleFlow.kind === "activate"
              ? [
                  `Restores ${lifecycleFlow.staff.revoked?.permissions ?? lifecycleFlow.staff.permissions} permissions (stashed at revocation)`,
                  `Tenant access restored: ${lifecycleFlow.staff.revoked?.tenantAccess ?? lifecycleFlow.staff.tenantAccess}`,
                  "The row returns to active in the roster and the metrics recalculate",
                  "Two-operator approval required — the request expires in 10 minutes",
                ]
              : [
                  `${lifecycleFlow.staff.revoked?.permissions ?? lifecycleFlow.staff.permissions} permissions revoked${lifecycleFlow.kind === "offboard" ? " and account deactivated" : ""}`,
                  `Tenant access "${lifecycleFlow.staff.revoked?.tenantAccess ?? lifecycleFlow.staff.tenantAccess}" cut to "Access revoked"`,
                  "An audit row lands with your typed reason (actor = approver)",
                  "Two-operator approval required — the request expires in 10 minutes",
                ]
          }
          detail={`Staff lifecycle · ${lifecycleFlow.staff.email}`}
          requireReason={lifecycleFlow.kind !== "activate"}
          twoOperator
          approvalPayload={{
            kind: lifecycleFlow.kind,
            staffId: lifecycleFlow.staff.id,
            name: lifecycleFlow.staff.name,
          } satisfies StaffLifecycleMutation}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: `${lifecycleFlow.kind === "activate" ? "Reactivation" : lifecycleFlow.kind === "suspend" ? "Suspension" : "Offboarding"} pending approval`,
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}
    </Page>
  );
}
