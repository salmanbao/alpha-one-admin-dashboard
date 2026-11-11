"use client";

/**
 * Sessions & Login History — R5 Wave 0.5 (no more fixtures).
 *
 * Every row is real data from the session store:
 *   - current device  ← readSession() + its recorded sign-in entry
 *   - other sessions  ← successful sign-ins recorded by recordLogin()
 *                       (login / signup / continue-as-demo)
 *   - login history   ← all recorded attempts, successes and blocks
 *
 * Revoking removes the entry via removeLoginHistory() — persisted, so
 * the row stays gone after a reload. No fabricated IPs or locations:
 * "place" is the browser timezone the demo actually has.
 */

import { useSyncExternalStore, useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import {
  describeDevice,
  removeLoginHistory,
  useLoginHistory,
  useSession,
  type LoginHistoryEntry,
} from "@/lib/session-store";

/** SSR gate (house pattern — getting-started-tour): the store slots are
 *  empty during the server render; swap to real data only after
 *  hydration instead of flashing empty-state copy. */
function subscribeNothing() {
  return () => {};
}

function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionsPage() {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const session = useSession();
  const history = useLoginHistory();
  const [notice, setNotice] = useState<string | null>(null);
  // Two-step confirm (audit #3 fix #8) — destructive session revokes
  // require a second click, matching the withdrawal-methods pattern.
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  const currentEntry =
    session && history.find((e) => e.at === session.loginAt && e.ok);
  const otherSessions = history.filter(
    (e) => e.ok && (!session || e.at !== session.loginAt),
  );

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }

  const handleRevoke = (id: string, device: string) => {
    // Persisted removal — the store's emitHistory re-renders this page.
    const ok = removeLoginHistory(id);
    setPendingRevokeId(null);
    flash(
      ok
        ? `Revoked "${device}" — that sign-in was removed from your session history.`
        : `Couldn't revoke "${device}" — browser storage is unavailable.`,
    );
  };

  const handleRevokeOthers = () => {
    const targets = otherSessions;
    const removed = targets.filter((e) => removeLoginHistory(e.id)).length;
    setConfirmingBulk(false);
    flash(
      removed === targets.length
        ? `Revoked ${removed} other session${removed === 1 ? "" : "s"} — only this device remains signed in.`
        : `Revoked ${removed} of ${targets.length} — browser storage was unavailable for the rest.`,
    );
  };

  if (!hydrated) {
    return (
      <div className="space-y-6" aria-busy="true">
        <TerraPageHeader
          title="Sessions & Login History"
          description="Devices signed in to your account"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Sessions & Login History"
        description="Devices signed in to your account"
        actions={
          confirmingBulk ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRevokeOthers}
                className="rounded-xl bg-error px-4 py-2 text-sm font-bold text-on-error hover:bg-error/90"
              >
                Confirm revoke {otherSessions.length}?
              </button>
              <button
                type="button"
                onClick={() => setConfirmingBulk(false)}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingBulk(true)}
              disabled={otherSessions.length === 0}
              className="rounded-xl bg-error-container px-4 py-2 text-sm font-bold text-on-error-container hover:bg-error-container/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {otherSessions.length > 0
                ? `Revoke other sessions (${otherSessions.length})`
                : "No other sessions"}
            </button>
          )
        }
      />

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          {notice}
        </div>
      )}

      <TerraCard>
        <TerraSectionTitle title="Active sessions" />
        <div className="space-y-3">
          {/* Current device — from the active session, not a fixture */}
          {session && (
            <div className="flex items-center justify-between rounded-xl border border-outline-variant/60 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {currentEntry?.device ?? describeDevice()}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {session.email} • {currentEntry?.place ?? "this device"} •{" "}
                  {formatAt(session.loginAt)}
                  {session.isDemo && " • demo persona"}
                </p>
              </div>
              <TerraBadge tone="primary" dot pulse>
                This device
              </TerraBadge>
            </div>
          )}

          {otherSessions.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
              No other signed-in devices recorded — only this browser's
              session exists in the local demo.
            </p>
          ) : (
            otherSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-outline-variant/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.device}</p>
                  <p className="text-xs text-on-surface-variant">
                    {s.place} • {formatAt(s.at)}
                  </p>
                </div>
                {pendingRevokeId === s.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.id, s.device)}
                      className="rounded-xl bg-error px-3 py-1.5 text-xs font-semibold text-on-error hover:bg-error/90"
                    >
                      Confirm?
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRevokeId(null)}
                      className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingRevokeId(s.id)}
                    className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Recent login history" />
        {history.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
            No sign-in attempts recorded on this device yet.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-on-surface">{h.device}</p>
                  <p className="text-xs text-on-surface-variant">
                    {formatAt(h.at)} • {h.place}
                    {!h.ok && " • sign-in attempt"}
                  </p>
                </div>
                <TerraBadge tone={h.ok ? "success" : "error"}>
                  {h.ok ? "Success" : "Blocked"}
                </TerraBadge>
              </div>
            ))}
          </div>
        )}
      </TerraCard>
    </div>
  );
}
