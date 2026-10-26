"use client";

/**
 * My Sessions (docs/21 CON-30).
 *
 * Console sessions are concurrent across devices; each is individually
 * revocable (2FA step-up required — CON-01 applies to every protected
 * console action). The current session cannot be revoked from here —
 * sign out instead. Idle timeout is 15 minutes (SESSION_IDLE_MIN); the
 * store seeds one stale session so the anomaly path is visible.
 *
 * Phase C: fully wired to `console-store` — revoke removes the session,
 * writes a `console.session_revoked` audit record, and updates every
 * metric live.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import {
  useConsoleStore,
  revokeSession,
  SESSION_IDLE_MIN,
  type ConsoleSession,
} from "@/lib/platform/console-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { timeAgo } from "@/hooks/use-countdown";
import {
  Monitor, Smartphone, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Lock, KeyRound, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/** A session idle longer than 24h is flagged for review. */
const ANOMALY_IDLE_MS = 24 * 60 * 60 * 1000;

const deviceIcon = (session: ConsoleSession) =>
  /iphone|ipad|android|ios/i.test(session.device + session.browser)
    ? Smartphone
    : Monitor;

export function MySessionsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { user } = usePlatform();
  const { sessions, audit } = useConsoleStore();
  const [otpTarget, setOtpTarget] = useState<ConsoleSession | null>(null);
  const [bulkRevoke, setBulkRevoke] = useState(false);

  const now = Date.now();
  const otherSessions = sessions.filter((s) => !s.current);
  const anomalies = sessions.filter((s) => now - s.lastSeenAt > ANOMALY_IDLE_MS);
  const revokedCount = audit.filter((a) => a.action === "console.session_revoked").length;

  const doRevoke = (session: ConsoleSession) => {
    revokeSession(session.id, { id: user.id, name: user.name });
    toast({
      title: "Session revoked",
      description: `${session.device} (${session.location}) signed out. Recorded in the audit trail.`,
      variant: "destructive",
    });
  };

  return (
    <Page>
      <PageHeader
        title="My Sessions"
        description={`Active sessions across your devices. Sessions time out after ${SESSION_IDLE_MIN} minutes of inactivity; revoke suspicious or stale ones (2FA required).`}
        icon={ShieldCheck}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading sessions…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active Sessions" value={sessions.length} icon={Activity} />
          <MetricCard label="Anomalies" value={anomalies.length} icon={AlertTriangle} tone={anomalies.length > 0 ? "warning" : "positive"} />
          <MetricCard label="Revocations (audited)" value={revokedCount} icon={XCircle} />
          <MetricCard label="Idle Timeout" value={`${SESSION_IDLE_MIN} min`} icon={Clock} tone="warning" />
        </div>

        {anomalies.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {anomalies.length} session{anomalies.length === 1 ? "" : "s"} idle for more than 24 hours — review the location and IP below.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Active sessions</span>
            <Button
              size="sm"
              variant="outline"
              disabled={otherSessions.length === 0}
              onClick={() => setBulkRevoke(true)}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Revoke all other
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((s) => {
              const Icon = deviceIcon(s);
              const anomalous = now - s.lastSeenAt > ANOMALY_IDLE_MS;
              return (
                <div key={s.id} className={cn(
                  "flex items-center gap-3 rounded-md border p-3",
                  s.current && "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10",
                  anomalous && "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10",
                )}>
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{s.device} · {s.browser}</p>
                      {s.current && <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-400">CURRENT</Badge>}
                      {anomalous && <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-400">STALE</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.location} · {s.ip} · active {timeAgo(s.lastSeenAt, now)} · signed in {timeAgo(s.createdAt, now)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-600"
                      onClick={() => setOtpTarget(s)}
                    >
                      Revoke
                    </Button>
                  )}
                  {s.current && <span className="text-xs text-muted-foreground">Cannot revoke current session</span>}
                </div>
              );
            })}
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No other sessions. <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
                You are signed in only on this device.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Session security (CON-30)</p>
          <p className="mt-1">
            Sessions time out after <strong>{SESSION_IDLE_MIN} minutes of inactivity</strong> and
            expire absolutely after 24 hours. The operator cannot revoke their own current session
            through this action — use Sign out instead. Every revocation requires 2FA and is
            written to the platform audit trail (actor, device, IP, timestamp).{" "}
            {revokedCount > 0 ? `${revokedCount} revocation(s) recorded this session.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Signed in as {user.name} ({user.email}) · 2FA enabled
          <Lock className="ml-3 h-3.5 w-3.5" /> Last password change 12d ago
        </div>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Revocation requires a 2FA step-up (CON-01) ── */}
      <TwoFactorDialog
        open={otpTarget !== null || bulkRevoke}
        onOpenChange={(o) => {
          if (!o) {
            setOtpTarget(null);
            setBulkRevoke(false);
          }
        }}
        title="Revoke session(s)"
        description={
          otpTarget
            ? `Revoke ${otpTarget.device} (${otpTarget.location})? The device must sign in again.`
            : `Revoke all ${otherSessions.length} other session(s)? Those devices must sign in again.`
        }
        submitLabel="Verify & revoke"
        onVerify={(code) => {
          if (code === "000000") return Promise.reject(new Error("Invalid code. Please try again."));
          if (otpTarget) {
            doRevoke(otpTarget);
          } else {
            for (const s of otherSessions) {
              revokeSession(s.id, { id: user.id, name: user.name });
            }
            toast({
              title: "Sessions revoked",
              description: `${otherSessions.length} other session(s) signed out. Recorded in the audit trail.`,
              variant: "destructive",
            });
          }
          setOtpTarget(null);
          setBulkRevoke(false);
          return undefined;
        }}
      />
    </Page>
  );
}
