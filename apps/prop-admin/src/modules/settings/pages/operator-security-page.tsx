"use client";

/**
 * R10-F1 — Operator Security Policy Pack (operator-facing).
 *
 * Operator view over `operator-security-store`:
 *   • Password policy (complexity, expiry, lockout).
 *   • Session policy (duration, idle timeout).
 *   • 2FA policy (enforcement for admin roles).
 *   • IP allowlist/blocklist.
 *   • SSO configuration.
 *   • Offboarding policy (approval, token revocation).
 *   • Security event log (last 500).
 *
 * Registered in the settings manifest + view-router; reachable via direct link.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  getSecurityStats,
  getSecurityEvents,
  getSecurityState,
  logSecurityEvent,
  useSecurityVersion,
} from "@/lib/operator-security-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function OperatorSecurityPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useSecurityVersion(); // re-render on any mutation

  const state = getSecurityState();
  const stats = getSecurityStats();

  return (
    <Page>
      <PageHeader
        title="Operator Security Policy Pack"
        description="Password, session, 2FA, IP, SSO, and offboarding policies. Security event log (last 500) and enforcement helpers (`validatePassword`, `isIPAllowed`, `checkSessionTimeout`). All mutations persist and are audited."
          <MetricCard label="Max Session Hours" value={state.sessionPolicy.maxSessionDurationHours} />
          <MetricCard label="2FA Enforced" value={state.twoFactorPolicy.enabled} />
          <MetricCard label="Critical Events" value={stats.criticalEvents} />
          <MetricCard label="Total Events" value={stats.totalEvents} />
        </div>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Security Policy Details</h2>
          <DataTable
            columns={[
              { key: "type", header: "Policy", cell: (t) => <span>{t}</span> },
              { key: "value", header: "Value", cell: (t) => <span>{t.value}</span> },
            ]}
            data={[
              { type: "Password", value: `min ${state.passwordPolicy.minLength} chars, ${state.passwordPolicy.requireUppercase ? "upper" : "no upper"}` },
              { type: "Session", value: `max ${state.sessionPolicy.maxSessionDurationHours} hrs, idle ${state.sessionPolicy.idleTimeoutMinutes} min` },
              { type: "2FA", value: `${state.twoFactorPolicy.enabled ? 'enabled' : 'disabled'} for ${state.twoFactorPolicy.enforceForRoles.join(', ')}` },
              { type: "IP", value: `${state.ipPolicy.enabled ? 'blocked' : 'allowed'} IPs` },
              { type: "Offboarding", value: `${state.offboardingPolicy.autoRevokeTokens ? 'auto revoke' : 'manual'}` },
            ]}
            rowKey={(t) => t.type}
            pageSize={4}
          />
        </section>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Security Event Log</h2>
          <DataTable
            columns={[
              { key: "type", header: "Type", cell: (e) => <span>{e.type}</span> },
              { key: "user", header: "User", cell: (e) => <span>{e.userName}</span> },
              { key: "ip", header: "IP", cell: (e) => <span>{e.ipAddress ?? "—"}</span> },
              { key: "severity", header: "Severity", cell: (e) => <span>{e.severity}</span> },
            ]}
            data={getSecurityEvents()}
            rowKey={(e) => e.id}
            pageSize={10}
          />
        </section>
      </PageContent>
    </Page>
  );
}