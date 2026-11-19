"use client";

/**
 * Platform Roles Page — Multi-tenant RBAC matrix.
 *
 * Stitch screen: platform_roles
 * Tier 1 — Platform-level role management with permission matrix.
 *
 * Gap P0-2/S-05: the role list used to be a page-local const —
 * "Duplicate" toasted success on a const and "Edit" navigated to a
 * dead-end. The list now comes from the role store, Edit deep-links
 * into the real editor, Duplicate stages a two-operator clone (S-09),
 * and Create opens the scope-aware editor.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  permissionCatalog,
  slugifyRole,
  useRoles,
  type RoleMutation,
  type StoredRole,
} from "@/lib/platform/role-store";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Plus,
  Edit2,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function PlatformRolesPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { navigate } = usePlatform();
  const roles = useRoles("platform");
  const platformPermissions = useMemo(() => permissionCatalog("platform"), []);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [cloneTarget, setCloneTarget] = useState<StoredRole | null>(null);

  const role = useMemo(
    () => roles.find((r) => r.id === selectedRole) ?? roles[0],
    [roles, selectedRole]
  );

  return (
    <Page>
      <PageHeader
        title="Platform Roles"
        description="Multi-tenant RBAC matrix for platform-level access control."
        icon={ShieldCheck}
        actions={
          <>
            {/* Role editor lives behind Platform Roles */}
            <Button size="sm" variant="outline" onClick={() => navigate("role-management")}>
              Role editor
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("create-role", { scope: "platform" })}
            >
              <Plus className="mr-1 h-4 w-4" /> Create Role
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
          loadingLabel="Loading roles…"
        >
        {!role ? (
          <p className="text-sm text-muted-foreground">No platform roles in the store.</p>
        ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Role list */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Roles</h2>
                <Badge variant="secondary" className="text-[10px]">{roles.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                      role.id === r.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                      style={{ background: r.color }}
                    >
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.assignedUsers} users</p>
                    </div>
                    {r.builtIn ? (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-label="Built-in, immutable" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Editable" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role detail */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
                      style={{ background: role.color }}
                    >
                      {role.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{role.name}</h2>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("manage-permissions", { role: role.id })}
                    >
                      <Edit2 className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={role.builtIn}
                      title={
                        role.builtIn
                          ? "Built-in role — it can never be duplicated or edited"
                          : "Create an unassigned copy (2FA + second-operator approval)"
                      }
                      onClick={() => setCloneTarget(role)}
                    >
                      <Copy className="mr-1 h-4 w-4" /> Duplicate
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Users Assigned</p>
                      <p className="mt-1 text-2xl font-bold">{role.assignedUsers}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Permissions</p>
                      <p className="mt-1 text-2xl font-bold">{role.permissions.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge tone={role.builtIn ? "muted" : "success"}>
                          {role.builtIn ? "built-in (immutable)" : "custom (editable)"}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Permissions matrix */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Permission Matrix</h3>
                      <Badge variant="secondary" className="text-[10px]">{role.permissions.length} granted</Badge>
                    </div>
                    <div className="space-y-1">
                      {platformPermissions.map((perm) => {
                        const granted = role.permissions.some(
                          (p) => p === perm.id || (p.endsWith(".*") && perm.id.startsWith(p.replace(".*", "")))
                        );
                        return (
                          <div
                            key={perm.id}
                            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                              granted ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-muted/50"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {granted ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                              )}
                              <span className="text-muted-foreground">{perm.label}</span>
                            </span>
                            <Badge variant={granted ? "default" : "outline"} className="text-[9px]">
                              {granted ? "Granted" : "—"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Tenant access */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Tenant Access Scope</h3>
                    <div className="space-y-2">
                      {roles.map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                            role.permissions.some((p) => p.includes(".*")) ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
                              style={{ background: r.color }}
                            >
                              {r.name.slice(0, 2)}
                            </div>
                            <span className="text-muted-foreground">{r.name}</span>
                          </div>
                          {role.permissions.some((p) => p.includes(".*")) ? (
                            <Badge className="text-[9px] bg-primary text-primary-foreground">All</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px]">Specific</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Duplicate → maker-checker clone (S-05 + S-09) ─────────── */}
      {cloneTarget ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setCloneTarget(null);
          }}
          actionKey="role.clone"
          title={`Duplicate role "${cloneTarget.name}"`}
          consequence={`Creates an unassigned copy granting the same ${cloneTarget.permissions.length} permissions.`}
          blastRadius={[
            `Copy starts with 0 assigned operators`,
            `Same ${cloneTarget.permissions.length} permissions as "${cloneTarget.name}"`,
            "The copy is editable — it is not protected like the original",
            "Two-operator approval required — the request expires in 10 minutes",
          ]}
          detail={`RBAC change · clone of ${cloneTarget.id}`}
          twoOperator
          approvalPayload={
            {
              kind: "clone",
              sourceName: cloneTarget.name,
              role: {
                ...cloneTarget,
                id: slugifyRole(`${cloneTarget.name} copy`),
                name: `${cloneTarget.name} (Copy)`,
                assignedUsers: 0,
                builtIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                versions: [],
              },
            } satisfies RoleMutation
          }
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: "Role duplication pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}
    </Page>
  );
}
