"use client";
import { useState } from "react";
import { Page, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { roles as allRoles } from "@/lib/platform/mock-data";
import { RoleDefinition } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { Users, ShieldCheck, KeyRound, Edit2, Plus, Trash2, CheckCircle2, ShieldAlert } from "lucide-react";

export function RoleEditorPage() {
  const [roles] = useState<RoleDefinition[]>(allRoles);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const role = roles.find((r) => r.id === editRoleId);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [appScope, setAppScope] = useState(role?.application ?? "super-admin");
  const [permissions, setPermissions] = useState(role?.permissions ?? []);

  const allPermissions = [
    { id: "billing:read", label: "Billing: Read" },
    { id: "billing:write", label: "Billing: Write" },
    { id: "billing:manage", label: "Billing: Manage Invoices" },
    { id: "ops:read", label: "Operations: Read" },
    { id: "ops:write", label: "Operations: Write" },
    { id: "config:read", label: "Configuration: Read" },
    { id: "config:write", label: "Configuration: Write" },
    { id: "audit:read", label: "Audit: Read" },
    { id: "users:read", label: "Users: Read" },
    { id: "users:write", label: "Users: Write" },
    { id: "tenants:read", label: "Tenants: Read" },
    { id: "tenants:write", label: "Tenants: Write" },
    { id: "approvals:manage", label: "Approvals: Manage" },
    { id: "security:overview", label: "Security: Overview" },
  ];

  return (
    <Page>
      <PageContent>
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Role Editor</span>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Button variant="ghost" size="sm" onClick={() => setEditRoleId(null)}>
                  <Users className="mr-1 h-3.5 w-3.5" /> Roles
                </Button>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> New Role
              </Button>
            </div>

            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roles.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{r.application}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.permissions.join(", ")}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditRoleId(r.id);
                            setName(r.name);
                            setDescription(r.description);
                            setAppScope(r.application);
                            setPermissions(r.permissions);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs text-rose-600 hover:text-rose-600"
                          onClick={() => toast({ title: "Deleted", description: `Role ${r.name} removed.` })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">{role ? "Edit Role" : "New Role"}</span>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tenant Operator"
                />
              </div>
              <div>
                <Label>Application Scope</Label>
                <Select value={appScope} onValueChange={setAppScope}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select application" />
                    <SelectContent>
                      <SelectItem label="Super Admin" value="super-admin" />
                      <SelectItem label="Prop Admin" value="prop-admin" />
                      <SelectItem label="Trader" value="trader" />
                    </SelectContent>
                  </SelectTrigger>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Role description"
                />
              </div>
            </div>

            <div>
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select the permissions this role grants. Use <code>space</code> to toggle selection.
              </p>
              <div className="grid grid-cols-4 gap-3">
                {allPermissions.map((p) => {
                  const isSelected = permissions.includes(p.id);
                  return (
                    <Badge
                      key={p.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn("text-[10px] cursor-pointer", isSelected ? "bg-emerald-500 text-black" : "")}
                      onClick={() =>
                        setPermissions(isSelected ? permissions.filter((id) => id !== p.id) : [...permissions, p.id])
                      }
                    >
                      {p.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!name || permissions.length === 0}
                onClick={() => {
                  toast({ title: "Role Saved", description: `${name} updated with ${permissions.length} permissions.` });
                  setOpen(false);
                }}
              >
                {role ? "Update Role" : "Create Role"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Permission Matrix (inline helper for editable matrix in Role Editor) */
/* ------------------------------------------------------------------ */

export function PermissionMatrix({ permissions }: { permissions: string[] }) {
  const allPermissions = [
    { id: "billing:read", label: "Billing Read" },
    { id: "billing:write", label: "Billing Write" },
    { id: "billing:manage", label: "Billing Manage" },
    { id: "ops:read", label: "Ops Read" },
    { id: "ops:write", label: "Ops Write" },
    { id: "config:read", label: "Config Read" },
    { id: "config:write", label: "Config Write" },
    { id: "audit:read", label: "Audit Read" },
    { id: "users:read", label: "Users Read" },
    { id: "users:write", label: "Users Write" },
    { id: "tenants:read", label: "Tenants Read" },
    { id: "tenants:write", label: "Tenants Write" },
    { id: "approvals:manage", label: "Approvals Manage" },
    { id: "security:overview", label: "Security Overview" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 text-xs">
      {allPermissions.map((p) => (
        <Badge
          key={p.id}
          variant={permissions.includes(p.id) ? "default" : "outline"}
          className={cn("cursor-pointer", permissions.includes(p.id) ? "bg-emerald-500 text-black" : "")}
        >
          {p.label}
        </Badge>
      ))}
    </div>
  );
