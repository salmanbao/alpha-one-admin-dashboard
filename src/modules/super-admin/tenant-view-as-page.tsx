"use client";

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { tenants as allTenants, users as allUsers } from "@/lib/platform/mock-data";
import { Eye, ShieldCheck, AlertTriangle, Lock, User, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function TenantViewAsPage() {
  const { setUser, setTenant, navigate, user: currentUser } = usePlatform();
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [viewAsRole, setViewAsRole] = useState<"trader" | "prop-admin">("prop-admin");

  const tenantOptions = allTenants.filter((t) => t.id !== "platform");
  const userOptions = allUsers.filter((u) => {
    if (!selectedTenantId) return false;
    return u.tenantId === selectedTenantId && u.application === viewAsRole;
  });

  return (
    <Page>
      <PageHeader title="Tenant View-As" description="Read-only impersonation of a tenant or trader. All actions are audited. State-changing operations are blocked." icon={Eye} />
      <PageContent>
        {/* Active view-as banner */}
        {currentUser.application !== "super-admin" && (
          <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-3 py-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  You are viewing as {currentUser.name} — {viewAsRole === "trader" ? "Trader" : "Tenant Admin"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Platform Operator session · <strong className="text-rose-600">READ ONLY</strong> — no state-changing actions available
                </p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => {
                const superUser = allUsers.find((u) => u.application === "super-admin");
                if (superUser) {
                  setUser(superUser);
                  setTenant(allTenants.find((t) => t.id === "platform")!);
                  navigate("super-overview");
                }
              }}>
                Exit View-As
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View-As configuration */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Configure View-As session</span></CardHeader>
          <CardContent className="space-y-4">
            {/* Role selection */}
            <div>
              <Label className="text-xs font-medium">Identity type</Label>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => { setViewAsRole("prop-admin"); setSelectedUserId(""); }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-3 text-sm transition",
                    viewAsRole === "prop-admin" ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <Building2 className="h-4 w-4" /> Tenant Admin
                </button>
                <button
                  onClick={() => { setViewAsRole("trader"); setSelectedUserId(""); }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-3 text-sm transition",
                    viewAsRole === "trader" ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <User className="h-4 w-4" /> Trader
                </button>
              </div>
            </div>

            {/* Tenant selection */}
            <div>
              <Label className="text-xs font-medium">Tenant</Label>
              <select
                value={selectedTenantId}
                onChange={(e) => { setSelectedTenantId(e.target.value); setSelectedUserId(""); }}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Select a tenant…</option>
                {tenantOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* User selection */}
            {selectedTenantId && userOptions.length > 0 && (
              <div>
                <Label className="text-xs font-medium">{viewAsRole === "trader" ? "Trader" : "Admin"} user</Label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Select a user…</option>
                  {userOptions.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
            )}

            {/* Read-only restrictions */}
            <div className="rounded-lg border border-rose-500/20 bg-rose-50/30 p-3 dark:bg-rose-950/10">
              <p className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <Lock className="h-3 w-3" /> Explicitly unavailable during View-As:
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                <li>· Approve payout</li>
                <li>· Reveal credentials</li>
                <li>· Change settings</li>
                <li>· Any state-changing action</li>
              </ul>
            </div>

            {/* Launch */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={!selectedUserId}>
                  <Eye className="mr-1 h-4 w-4" /> Start View-As session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start View-As session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be logged in as the selected user in <strong>read-only mode</strong>.
                    A persistent banner will remind you that you are in a View-As session.
                    This session is audited with your platform operator identity.
                    2FA verification will be required.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const targetUser = allUsers.find((u) => u.id === selectedUserId);
                      const targetTenant = allTenants.find((t) => t.id === selectedTenantId);
                      if (targetUser && targetTenant) {
                        setUser(targetUser);
                        setTenant(targetTenant);
                        navigate("overview");
                        toast({ title: "View-As session started", description: `Viewing as ${targetUser.name} (${viewAsRole === "trader" ? "Trader" : "Tenant Admin"}). READ ONLY — no state-changing actions.` });
                      }
                    }}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" /> Start (requires 2FA)
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">View-As vs Support Assist</p>
          <p className="mt-1">
            View-As grants read-only access to a tenant/trader interface. It differs from Support Assist (future) which exposes only the minimum information required to resolve a support issue without granting unrestricted tenant access.
            All View-As sessions are audited and time-limited. The operator's real identity is always logged alongside the impersonated identity.
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
