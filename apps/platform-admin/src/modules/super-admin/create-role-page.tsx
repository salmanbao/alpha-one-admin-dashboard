"use client";

/**
 * Create Role (gap S-04) — the real role editor replacing the
 * "coming soon" placeholder.
 *
 * - Scope-aware: `?scope=platform` (from Platform Roles) creates a
 *   platform-matrix role, otherwise an application role.
 * - Pick name/description/application + permissions from the scope's
 *   catalog (grouped picker with per-group toggles).
 * - Save is a maker-checker action (S-09): consequences → 2FA → staged
 *   two-operator request; the role lands in the role store — with a
 *   version-history entry and an audit row — the moment operator B
 *   approves in the Approval Center, from any page, after reloads.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { PermissionPicker } from "@/components/platform/permission-picker";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
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
  permissionCatalog,
  slugifyRole,
  useRoles,
  type RoleMutation,
  type RoleScope,
  type StoredRole,
} from "@/lib/platform/role-store";
import { toast } from "@/hooks/use-toast";
import type { ApplicationId } from "@/lib/platform/types";
import { ArrowLeft, Plus, ShieldCheck, Lock } from "lucide-react";

/** Terra-adjacent palette — new roles get a stable color from their id. */
const ROLE_COLORS = ["#4a7c59", "#705c30", "#6b6358", "#b83230", "#0f766e", "#0369a1", "#7c3aed", "#b45309"];

export function CreateRolePage() {
  const { navigate, router } = usePlatform();
  const scope: RoleScope = router.params.scope === "platform" ? "platform" : "app";
  const catalog = useMemo(() => permissionCatalog(scope), [scope]);
  const existingRoles = useRoles();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [application, setApplication] = useState<ApplicationId>("prop-admin");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const slug = slugifyRole(name);
  const nameOk = name.trim().length >= 3;
  const duplicate = existingRoles.some((r) => r.id === slug);
  const descOk = description.trim().length >= 5;
  const permsOk = selected.size > 0;
  const formOk = nameOk && !duplicate && descOk && permsOk;

  const color =
    ROLE_COLORS[[...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % ROLE_COLORS.length];

  const candidate: StoredRole = {
    id: slug,
    name: name.trim(),
    description: description.trim(),
    permissions: [...selected].sort(),
    application: scope === "platform" ? "super-admin" : application,
    color,
    scope,
    assignedUsers: 0,
    builtIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [],
  };

  const mutation: RoleMutation = { kind: "create", role: candidate };

  const toggle = (permissionId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
  };

  const problems = [
    !nameOk ? "Name needs at least 3 characters" : null,
    duplicate ? `A role with id "${slug}" already exists` : null,
    !descOk ? "Description needs at least 5 characters" : null,
    !permsOk ? "Select at least one permission" : null,
  ].filter(Boolean);

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate(scope === "platform" ? "platform-roles" : "role-management")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>
      <PageHeader
        title="Create Role"
        description={
          scope === "platform"
            ? "New platform-matrix role — permissions apply across the console."
            : "New application role — permissions apply inside its application."
        }
        icon={Plus}
        actions={
          <Badge variant="outline" className="text-[10px]">
            {scope === "platform" ? "Platform scope" : "Application scope"}
          </Badge>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Role details ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Role details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-name" className="text-xs">
                  Name (required)
                </Label>
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Compliance Analyst"
                  maxLength={48}
                />
                {name.trim().length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Role id: <code className="font-mono">{slug}</code>
                    {duplicate ? (
                      <span className="text-destructive"> · already taken</span>
                    ) : null}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc" className="text-xs">
                  Description (required)
                </Label>
                <Textarea
                  id="role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this role for? Shown to approvers and in the RBAC matrix."
                  rows={3}
                  maxLength={200}
                />
              </div>
              {scope === "app" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="role-app" className="text-xs">
                    Application
                  </Label>
                  <Select value={application} onValueChange={(v) => setApplication(v as ApplicationId)}>
                    <SelectTrigger id="role-app">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                      <SelectItem value="prop-admin">Prop Admin</SelectItem>
                      <SelectItem value="trader">Trader</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="rounded-md border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                  Platform roles run in the super-admin realm — no application choice.
                </p>
              )}
              <div className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ background: color }}
                >
                  {(name.trim().slice(0, 2) || "??" ).toUpperCase()}
                </span>
                <span className="text-muted-foreground">Preview · starts with 0 assigned users</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Permission picker ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Permissions</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {selected.size} of {catalog.length} selected
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  The exact set this role grants — approvers see this count and the diff on every change.
                </p>
              </CardHeader>
              <CardContent>
                <PermissionPicker catalog={catalog} selected={selected} onToggle={toggle} />
              </CardContent>
            </Card>

            {/* ── Save → maker-checker ───────────────────────────── */}
            <Card>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {formOk ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Ready — “{candidate.name}” will grant {candidate.permissions.length}{" "}
                      {candidate.permissions.length === 1 ? "permission" : "permissions"}.
                    </span>
                  ) : (
                    <ul className="space-y-0.5">
                      {problems.map((p) => (
                        <li key={p} className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3" /> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate(scope === "platform" ? "platform-roles" : "role-management")}
                  >
                    Cancel
                  </Button>
                  <Button disabled={!formOk} onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Save role
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>

      {/* ── Maker-checker (S-09): consequences → 2FA → staged request */}
      <SensitiveActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        actionKey="role.create"
        title={`Create role "${candidate.name}"`}
        consequence={`New ${scope} role granting ${candidate.permissions.length} permissions.`}
        blastRadius={[
          `${candidate.permissions.length} permissions become grantable to every operator assigned this role`,
          scope === "platform"
            ? "Appears in the platform RBAC matrix immediately after approval"
            : `Scoped to the ${application} application`,
          "Two-operator approval required — the request expires in 10 minutes",
        ]}
        detail={`RBAC change · id ${candidate.id}`}
        twoOperator
        approvalPayload={mutation}
        onExecute={() => undefined}
        onApprovalInitiated={() =>
          toast({
            title: "Role creation pending approval",
            description: "Operator B must approve within 10 minutes — Approval Center.",
          })
        }
      />
    </Page>
  );
}
