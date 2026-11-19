"use client";

/**
 * Manage Permissions (gap S-04/S-05) — the real permission editor
 * replacing the "coming soon" placeholder.
 *
 * - Deep-linkable: `?role=<id>` (Role Management Edit / Platform Roles
 *   Edit navigate here); the selector keeps the URL in sync.
 * - Editable name, description and permission set with a live
 *   permission diff (+granted / −removed) against the saved state.
 * - Built-in roles are immutable (S-05 guardrail) with the reason shown.
 * - Save is maker-checker (S-09): consequences → 2FA → staged request;
 *   the store applies it — version-history entry + audit row — the
 *   moment operator B approves, from any page, after reloads.
 * - Version history: every applied change with actor, time and diff.
 */

import { useEffect, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { PermissionPicker } from "@/components/platform/permission-picker";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { EmptyState } from "@/components/platform/guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  diffPermissions,
  permissionCatalog,
  roleEditBlockReason,
  useRoles,
  type RoleMutation,
  type StoredRole,
} from "@/lib/platform/role-store";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, History, Lock, Plus, Save, ShieldCheck } from "lucide-react";

const ACTION_TONES: Record<string, "default" | "secondary" | "outline"> = {
  create: "default",
  clone: "secondary",
  update: "outline",
  delete: "outline",
};

export function ManagePermissionsPage() {
  const { navigate, router } = usePlatform();
  const roles = useRoles();
  const roleId = router.params.role ?? roles[0]?.id ?? "";
  const role: StoredRole | undefined = roles.find((r) => r.id === roleId) ?? roles[0];

  const catalog = useMemo(
    () => permissionCatalog(role?.scope ?? "app"),
    [role?.scope],
  );

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeRoleId = role?.id ?? "";
  useEffect(() => {
    const r = roles.find((x) => x.id === activeRoleId);
    if (!r) return;
    // Re-sync whenever the stored role changes (approval applied,
    // another screen mutated it) — never mid-typing: deps only track the
    // store snapshot and the active id.
    setName(r.name);
    setDescription(r.description);
    setSelected(new Set(r.permissions));
  }, [activeRoleId, roles]);

  const editBlock = roleEditBlockReason(role);
  const diff = role
    ? diffPermissions(role.permissions, [...selected])
    : { added: [], removed: [] };
  const renamed = !!role && name.trim() !== role.name;
  const descChanged = !!role && description.trim() !== role.description;
  const permsChanged = diff.added.length > 0 || diff.removed.length > 0;
  const dirty = renamed || descChanged || permsChanged;
  const nameOk = name.trim().length >= 3;
  const canSave = !!role && !editBlock && dirty && nameOk;

  const toggle = (permissionId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
  };

  if (!role) {
    return (
      <Page>
        <PageHeader title="Manage Permissions" icon={Lock} />
        <EmptyState
          title="No roles left"
          description="Every role has been deleted — create a new one to manage its permissions."
          icon={Plus}
          hint="Role Management → New role."
        />
      </Page>
    );
  }

  const mutation: RoleMutation = {
    kind: "update",
    roleId: role.id,
    name: name.trim(),
    description: description.trim(),
    permissions: [...selected].sort(),
    added: diff.added,
    removed: diff.removed,
  };

  const blastRadius = [
    diff.added.length > 0 ? `+${diff.added.length} permissions granted` : null,
    diff.removed.length > 0 ? `−${diff.removed.length} permissions removed` : null,
    renamed ? `Renamed "${role.name}" → "${name.trim()}"` : null,
    `Affects ${role.assignedUsers} assigned ${role.assignedUsers === 1 ? "operator" : "operators"}`,
    "Two-operator approval required — the request expires in 10 minutes",
  ].filter((line): line is string => line !== null);

  const history = [...role.versions].reverse();

  return (
    <Page>
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("role-management")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to roles
      </Button>
      <PageHeader
        title="Manage Permissions"
        description={`Editing “${role.name}” — every save is diffed, versioned and second-operator approved.`}
        icon={Lock}
        actions={
          <Select
            value={role.id}
            onValueChange={(v) => navigate("manage-permissions", { role: v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Pick a role…" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.builtIn ? " (built-in)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Details + history ────────────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Details</h2>
                  <Badge variant="outline" className="text-[9px]">
                    {role.scope === "platform" ? "platform" : role.application}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editBlock ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{editBlock}</span>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="perm-role-name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="perm-role-name"
                    value={name}
                    disabled={!!editBlock}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={48}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="perm-role-desc" className="text-xs">
                    Description
                  </Label>
                  <Textarea
                    id="perm-role-desc"
                    value={description}
                    disabled={!!editBlock}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={200}
                  />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Assigned: <strong className="text-foreground">{role.assignedUsers}</strong>
                  </span>
                  <span>
                    Permissions: <strong className="text-foreground">{role.permissions.length}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Role id <code className="font-mono">{role.id}</code> · last updated{" "}
                  {new Date(role.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            {/* ── Version history (S-05) ──────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-base font-semibold">
                    <History className="h-4 w-4" /> Version history
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {history.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No changes recorded yet — history starts with the first approved edit.
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {history.map((v, i) => (
                      <li key={`${v.at}-${i}`} className="rounded-md border px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={ACTION_TONES[v.action] ?? "outline"} className="text-[9px]">
                            {v.action}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs">{v.summary}</p>
                        <p className="text-[10px] text-muted-foreground">by {v.actor}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Editor + diff ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Permission set</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {selected.size} selected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PermissionPicker
                  catalog={catalog}
                  selected={selected}
                  onToggle={toggle}
                  disabled={!!editBlock}
                />
              </CardContent>
            </Card>

            {/* ── Live diff + save ──────────────────────────────── */}
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Diff vs saved state</h3>
                  {dirty ? (
                    <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                      unsaved changes
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      in sync
                    </Badge>
                  )}
                </div>
                {!dirty ? (
                  <p className="text-xs text-muted-foreground">
                    Toggle permissions or edit the details above — the exact change appears here
                    before it is sent for approval.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {renamed ? (
                      <p className="text-xs">
                        <span className="font-medium">Rename:</span>{" "}
                        <span className="text-muted-foreground line-through">{role.name}</span> →{" "}
                        <span className="font-medium">{name.trim()}</span>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {diff.added.map((p) => (
                        <Badge
                          key={`+${p}`}
                          className="border border-emerald-500/40 bg-emerald-50 text-[10px] font-normal text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                          + {p}
                        </Badge>
                      ))}
                      {diff.removed.map((p) => (
                        <Badge
                          key={`-${p}`}
                          variant="outline"
                          className="border-destructive/40 bg-destructive/5 text-[10px] font-normal text-destructive"
                        >
                          − {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {editBlock
                      ? editBlock
                      : "Save opens the 2FA → two-operator flow; nothing applies before approval."}
                  </span>
                  <Button disabled={!canSave} onClick={() => setDialogOpen(true)}>
                    <Save className="mr-1 h-4 w-4" /> Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>

      {/* ── Maker-checker (S-09) ─────────────────────────────────── */}
      <SensitiveActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        actionKey="role.update"
        title={`Update role "${role.name}"`}
        consequence={`Permission set changes for a role assigned to ${role.assignedUsers} ${role.assignedUsers === 1 ? "operator" : "operators"}.`}
        blastRadius={blastRadius}
        detail={`RBAC change · id ${role.id}`}
        twoOperator
        approvalPayload={mutation}
        onExecute={() => undefined}
        onApprovalInitiated={() =>
          toast({
            title: "Role update pending approval",
            description: "Operator B must approve within 10 minutes — Approval Center.",
          })
        }
      />
    </Page>
  );
}
