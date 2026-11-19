"use client";

/**
 * Role Management — platform-admin
 * Manage application roles across super-admin and prop-admin (and the
 * trader realm).
 *
 * Gap P0-2/S-04/S-05: this list used to read a page-local const with
 * dead Edit/Delete buttons. It is now backed by the role store:
 *   - Edit → Manage Permissions (the real editor, deep-linked by id),
 *   - Delete → guardrails first (built-in protection, assigned-user
 *     count), then the 2FA → two-operator approval flow — the role is
 *     removed from the store only after operator B approves,
 *   - the application filter actually filters.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  roleDeleteBlockReason,
  useRoles,
  type RoleMutation,
  type StoredRole,
} from "@/lib/platform/role-store";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, Lock, Plus, AlertTriangle } from "lucide-react";

export function RoleManagementPage() {
  const { navigate } = usePlatform();
  const roles = useRoles("app");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<StoredRole | null>(null);

  const filtered = useMemo(
    () => (appFilter === "all" ? roles : roles.filter((r) => r.application === appFilter)),
    [roles, appFilter],
  );

  const columns: Column<StoredRole>[] = [
    {
      key: "id",
      header: "Role ID",
      cell: (r) => <span className="font-mono text-sm">{r.id}</span>,
      sortValue: (r) => r.id,
    },
    {
      key: "name",
      header: "Role Name",
      cell: (r) => (
        <span>
          <Button
            size="sm"
            variant="outline"
            className="hover:underline"
            onClick={() => navigate("manage-permissions", { role: r.id })}
          >
            {r.name}
          </Button>
        </span>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "description",
      header: "Description",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span>,
      sortValue: (r) => r.description,
    },
    {
      key: "application",
      header: "Application",
      cell: (r) => (
        <Badge variant={r.application === "super-admin" ? "default" : "secondary"}>
          {r.application}
        </Badge>
      ),
      sortValue: (r) => r.application,
    },
    {
      key: "users",
      header: "Assigned",
      cell: (r) => (
        <span
          className={`flex items-center gap-1 text-[11px] ${r.assignedUsers > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
          title={
            r.assignedUsers > 0
              ? `${r.assignedUsers} users assigned — deletion blocked until they are reassigned`
              : "No users assigned"
          }
        >
          <Users className="h-3 w-3" />
          {r.assignedUsers}
          {r.assignedUsers > 0 && <AlertTriangle className="h-3 w-3" />}
        </span>
      ),
      sortValue: (r) => r.assignedUsers,
      numeric: true,
    },
    {
      key: "permissions-count",
      header: "Perms",
      cell: (r) => <span className="text-[10px]">{r.permissions.length}</span>,
      sortValue: (r) => r.permissions.length,
      numeric: true,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => {
        const blockReason = roleDeleteBlockReason(r);
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => navigate("manage-permissions", { role: r.id })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              disabled={!!blockReason}
              title={blockReason ?? "Delete needs 2FA + a second operator's approval"}
              onClick={() => setDeleteTarget(r)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Role Management"
        description="Manage platform roles and permissions across super-admin and prop-admin applications"
        icon={Shield}
      />
      <PageContent>
        <div className="grid gap-4 mb-6 sm:flex sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("create-role")}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New role
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("manage-permissions")}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" /> Manage permissions
            </Button>
          </div>
          <Select value={appFilter} onValueChange={setAppFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All applications</SelectItem>
              <SelectItem value="super-admin">Super Admin</SelectItem>
              <SelectItem value="prop-admin">Prop Admin</SelectItem>
              <SelectItem value="trader">Trader</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          searchableText={(r) => `${r.id} ${r.name} ${r.description}`}
          searchPlaceholder="Search roles…"
          pageSize={10}
          emptyTitle="No roles found"
          emptyDescription="Create a new role to get started."
        />
      </PageContent>

      {/* ── Guardrailed delete → maker-checker (S-05 + S-09) ─────── */}
      {deleteTarget ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          actionKey="role.delete"
          title={`Delete role "${deleteTarget.name}"`}
          consequence="The role is removed from the RBAC catalog permanently."
          blastRadius={[
            `${deleteTarget.permissions.length} permissions leave the catalog`,
            `Currently assigned operators: ${deleteTarget.assignedUsers}`,
            "Version history for the role is discarded",
            "Two-operator approval required — the request expires in 10 minutes",
          ]}
          detail={`RBAC change · id ${deleteTarget.id}`}
          twoOperator
          approvalPayload={{ kind: "delete", role: deleteTarget } satisfies RoleMutation}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: "Role deletion pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}
    </Page>
  );
}
