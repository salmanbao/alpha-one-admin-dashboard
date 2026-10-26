"use client";
import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { Page, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { users as allUsers, roles as allRoles } from "@/lib/platform/mock-data";
import { AuthUser, TenantContext } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { Users, Eye, UserPlus, CheckCircle2 } from "lucide-react";

const roleBadge = (r: string) =>
  r === "super-admin" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" :
  r === "prop-admin" ? "border-teal-500/30 text-teal-700 dark:text-teal-400" :
  "border-slate-500/30 text-slate-700 dark:text-slate-400";

export function OperatorDetailPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [operators] = useState<AuthUser[]>(allUsers.filter((u) => u.application === "super-admin" || u.application === "prop-admin"));

  const detailOperator = operators.find((o) => o.id === selectedUserId);

  const inviteFormOpen = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    roles: [],
    application: "super-admin",
  });

  const handleSubmit = () => {
    toast({ title: "Invitation sent", description: `${inviteForm.name} (${inviteForm.email}) invited.` });
    setInviteForm((f) => ({ ...f, name: "", email: "", roles: [], application: "super-admin" }));
    inviteFormOpen[0](false);
  };

  return (
    <Page>
      <PageContent>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Operators</span></CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                {operators.map((op) => (
                  <Button key={op.id} variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedUserId(op.id)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> {op.name}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => inviteFormOpen[0](true)}>
                <UserPlus className="mr-1 h-3.5 w-3.5" /> Invite
              </Button>
            </div>

            {selectedUserId && detailOperator ? (
              <Card>
                <CardHeader className="pb-2"><span className="text-sm font-medium">{detailOperator.name}</span></CardHeader>
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium text-foreground">{detailOperator.email}</p>
                  <p className="text-xs text-muted-foreground">Roles: {detailOperator.roles.join(", ")}</p>
                  <p className="text-xs text-muted-foreground">Application: {detailOperator.application}</p>
                </CardContent>
              </Card>
            ) : operators.length > 0 ? (
              <div className="space-y-3 p-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                <p>Select an operator from the directory above to view their details.</p>
              </div>
            ) : (
              <div className="space-y-3 p-8 text-center text-sm text-muted-foreground">
                <UserPlus className="mx-auto h-6 w-6 text-muted-foreground" />
                <p>No operators found. Click <strong>Invite</strong> to add one.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite modal */}
        <Modal open={inviteFormOpen} onClose={() => inviteFormOpen(false)}>
          <ModalHeader>
            <ModalTitle>Invite Operator</ModalTitle>
            <ModalDescription>Enter details for the new operator invitation.</ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => inviteFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>Send Invite</Button>
          </ModalFooter>
        </Modal>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Permission Matrix Helper                                              */
/* ------------------------------------------------------------------ */

function PermissionMatrix({ permissions }: { permissions: string[] }) {
  // Toggle visibility in a grid grouped by permission category
  // for an editable permission matrix in the Role Editor.
  const grouped = permissions.reduce((acc, id) => {
    const label = permLabel(id);
    if (!label) return acc;
    (acc[label.group ?? "Other"] = acc[label.group ?? "Other"] ?? []).push(id);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.entries(grouped).map(([group, ids]) => (
        <div key={group} className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium capitalize">{group}</p>
          <ul className="space-y-1">
            {ids.map((id) => (
              <li key={id}>
                <Badge variant="outline" className="text-[10px]">{permLabelShort(id)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function permLabel(id: string): { group?: string; label?: string } | undefined {
  const map: Record<string, { group: string; label: string }> = {
    "billing:read": { group: "Finance", label: "View Billing" },
    "billing:write": { group: "Finance", label: "Edit Billing" },
    "billing:manage": { group: "Finance", label: "Manage Invoices" },
    "ops:read": { group: "Operations", label: "View Ops" },
    "ops:write": { group: "Operations", label: "Edit Ops" },
    "config:read": { group: "Configuration", label: "View Config" },
    "config:write": { group: "Configuration", label: "Edit Config" },
    "audit:read": { group: "Audit", label: "View Audit" },
    "users:read": { group: "People", label: "View Users" },
    "users:write": { group: "People", label: "Edit Users" },
    "tenants:read": { group: "Tenant", label: "View Tenants" },
    "tenants:write": { group: "Tenant", label: "Edit Tenants" },
    "approvals:manage": { group: "Approvals", label: "Manage Approvals" },
    "security:overview": { group: "Security", label: "Security Overview" },
  };
  return map[id];
}

function permLabelShort(id: string): string {
  const m = permLabel(id);
  return m?.label ?? id;
}
ENDOFFILE