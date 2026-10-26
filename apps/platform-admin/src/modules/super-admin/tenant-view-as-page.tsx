"use client";

/**
 * Tenant View-As (docs/21 CON-07).
 *
 * Read-only impersonation of a tenant or trader:
 *   - Start requires a 2FA step-up (CON-01) and creates a 15-minute
 *     impersonation session in the console store — start/end/renew/expiry
 *     are all audit-logged (`console.impersonation_*`).
 *   - Live countdown while active; Renew extends by another 15 minutes;
 *     the store auto-ends sessions at their deadline.
 *   - Deny-list: tenants under investigation / in a terminal state cannot
 *     be impersonated (option disabled with the reason shown).
 *   - Read-only: state-changing actions are unavailable during View-As.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import {
  useConsoleStore,
  startImpersonation,
  renewImpersonation,
  endImpersonation,
} from "@/lib/platform/console-store";
import { useCountdown, formatCountdown, timeAgo } from "@/hooks/use-countdown";
import { tenants as allTenants, users as allUsers } from "@/lib/platform/mock-data";
import {
  Eye, AlertTriangle, Lock, User, Building2,
  Timer, RefreshCw, LogOut,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Deny-list (CON-07): tenants that must never be impersonated, with the
 * reason surfaced next to the disabled option.
 */
const DENY_LIST: Record<string, string> = {
  "gamma-futures": "Under abuse investigation AB-131 — impersonation blocked",
};

const TENANT_BLOCKED_STATUS = {
  suspended: "Tenant is suspended — reactivate before impersonating",
  terminated: "Tenant is terminated — impersonation impossible",
} as const;

export function TenantViewAsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { setUser, setTenant, navigate, user: currentUser } = usePlatform();
  const store = useConsoleStore();
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [viewAsRole, setViewAsRole] = useState<"trader" | "prop-admin" | "super-admin">("prop-admin");
  const [otpOpen, setOtpOpen] = useState(false);

  const activeSession = store.impersonations.find((i) => !i.endedAt) ?? null;
  const remaining = useCountdown(activeSession?.expiresAt ?? null);

  const tenantOptions = allTenants.filter((t) => t.id !== "platform");
  const userOptions = allUsers.filter((u) => {
    if (!selectedTenantId) return false;
    if (viewAsRole === "super-admin") return u.application === "super-admin";
    return u.tenantId === selectedTenantId && u.application === viewAsRole;
  });

  const denyReason = (tenantId: string): string | null => {
    if (DENY_LIST[tenantId]) return DENY_LIST[tenantId];
    const t = allTenants.find((x) => x.id === tenantId);
    if (t && TENANT_BLOCKED_STATUS[t.status as keyof typeof TENANT_BLOCKED_STATUS]) {
      return TENANT_BLOCKED_STATUS[t.status as keyof typeof TENANT_BLOCKED_STATUS];
    }
    return null;
  };

  const restoreOperator = () => {
    const superUser = allUsers.find((u) => u.application === "super-admin");
    const platformTenant = allTenants.find((t) => t.id === "platform");
    if (superUser) setUser(superUser);
    if (platformTenant) setTenant(platformTenant);
  };

  const launch = () => {
    const targetUser = allUsers.find((u) => u.id === selectedUserId);
    const targetTenant = allTenants.find((t) => t.id === selectedTenantId);
    if (!targetUser || !targetTenant) return;
    startImpersonation(targetTenant.id);
    setUser(targetUser);
    setTenant(targetTenant);
    navigate("super-overview");
    toast({
      title: "View-As session started",
      description: `${targetUser.name} · ${targetTenant.name} — READ ONLY, auto-ends in 15 minutes. Audited.`,
    });
  };

  const renew = () => {
    if (!activeSession) return;
    renewImpersonation(activeSession.id);
    toast({
      title: "Session extended",
      description: `${activeSession.tenantName} — renewed for another 15 minutes (audited).`,
    });
  };

  const end = () => {
    if (!activeSession) return;
    endImpersonation(activeSession.id, "manual");
    restoreOperator();
    navigate("super-overview");
    toast({
      title: "View-As session ended",
      description: `Returned to platform operator view. ${activeSession.tenantName} session logged.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Tenant View-As"
        description="Read-only impersonation of a tenant or trader. Sessions last 15 minutes, are renewable, and every start/renew/end is audited. State-changing operations are blocked."
        icon={Eye}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("impersonation-audit")}>
            Impersonation audit
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading operators…"
        >
        {/* Active impersonation session (store-backed, CON-07) */}
        {activeSession ? (
          <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Viewing as {activeSession.tenantName} — session active
                </p>
                <p className="text-xs text-muted-foreground">
                  Started by {activeSession.startedBy.name} {timeAgo(activeSession.startedAt)} ·
                  READ ONLY — no state-changing actions ·{" "}
                  <strong className="text-rose-600">auto-ends at the deadline</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-semibold tabular-nums",
                    (remaining ?? 0) < 2 * 60 * 1000
                      ? "border-destructive/50 text-destructive"
                      : "border-amber-500/50 text-amber-700 dark:text-amber-400",
                  )}
                >
                  <Timer className="h-4 w-4" />
                  {formatCountdown(remaining)}
                </span>
                <Button size="sm" variant="outline" onClick={renew}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Renew 15 min
                </Button>
                <Button size="sm" variant="destructive" onClick={end}>
                  <LogOut className="mr-1 h-3.5 w-3.5" /> End session
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Fallback exit when identity was switched without a store session */}
        {!activeSession && currentUser.application !== "super-admin" && (
          <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-3 py-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  You are viewing as {currentUser.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Platform Operator session · <strong className="text-rose-600">READ ONLY</strong> — no state-changing actions available
                </p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => { restoreOperator(); navigate("super-overview"); }}>
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

            {/* Tenant selection (deny-list enforced) */}
            <div>
              <Label className="text-xs font-medium">Tenant</Label>
              <select
                value={selectedTenantId}
                onChange={(e) => { setSelectedTenantId(e.target.value); setSelectedUserId(""); }}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Select a tenant…</option>
                {tenantOptions.map((t) => {
                  const blocked = denyReason(t.id);
                  return (
                    <option key={t.id} value={blocked ? "" : t.id} disabled={Boolean(blocked)}>
                      {t.name}{blocked ? ` — blocked: ${blocked}` : ""}
                    </option>
                  );
                })}
              </select>
              {selectedTenantId && denyReason(selectedTenantId) ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {denyReason(selectedTenantId)}
                </p>
              ) : null}
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

            {/* Launch — 2FA step-up before the session is created */}
            <Button
              className="w-full"
              disabled={!selectedUserId || Boolean(denyReason(selectedTenantId)) || activeSession !== null}
              onClick={() => setOtpOpen(true)}
            >
              <Eye className="mr-1 h-4 w-4" /> Start View-As session (15 min, 2FA)
            </Button>
            {activeSession ? (
              <p className="text-center text-xs text-muted-foreground">
                A session is already active — end it before starting another.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">View-As vs Support Assist</p>
          <p className="mt-1">
            View-As grants read-only access for a maximum of 15 minutes per session (renewable,
            each renewal audited). It differs from Support Assist, which exposes only the minimum
            information required to resolve a support issue. The operator&apos;s real identity is
            always logged alongside the impersonated identity, and sessions auto-end at the
            deadline.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── 2FA step-up before the impersonation session starts ── */}
      <TwoFactorDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        title="Start View-As session"
        description="Confirm with 2FA. The 15-minute read-only session and this verification are audited."
        submitLabel="Verify & start session"
        onVerify={(code) => {
          if (code === "000000") return Promise.reject(new Error("Invalid code. Please try again."));
          launch();
          return undefined;
        }}
      />
    </Page>
  );
}
