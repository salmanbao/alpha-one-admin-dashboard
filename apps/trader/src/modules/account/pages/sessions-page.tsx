"use client";

/**
 * Sessions & Login History — converted from stitch_screens/sessions_login_history
 * Active devices + recent login log with revoke actions (PRD §3.11
 * DELETE /profile/sessions/:id — local-state demo).
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { loginSessions } from "@/lib/fixtures/terra-fixtures";

const loginHistory = [
  { at: "2026-10-08 09:12", ip: "73.12.44.102", device: "Chrome 141 • macOS", location: "San Francisco, US", ok: true },
  { at: "2026-10-07 22:41", ip: "73.12.44.102", device: "Safari • iPhone 16", location: "San Francisco, US", ok: true },
  { at: "2026-10-05 14:03", ip: "52.4.19.88", device: "MT5 Desktop • Windows", location: "Ashburn, US", ok: true },
  { at: "2026-10-02 03:18", ip: "192.204.31.7", device: "Unknown • Linux", location: "Unknown", ok: false },
];

export function SessionsPage() {
  const [revoked, setRevoked] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const otherSessions = loginSessions.filter((s) => !s.current);
  const othersRemaining = otherSessions.filter((s) => !revoked.includes(s.id));

  const handleRevoke = (id: string, device: string) => {
    setRevoked((r) => [...r, id]);
    setNotice(`Revoked "${device}" — that device must sign in again. (Demo)`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRevokeOthers = () => {
    setRevoked(otherSessions.map((s) => s.id));
    setNotice(
      `Revoked ${otherSessions.length} other sessions — only this device stays signed in. (Demo)`,
    );
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Sessions & Login History"
        description="Devices signed in to your account"
        actions={
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={othersRemaining.length === 0}
            className="rounded-xl bg-error-container px-4 py-2 text-sm font-bold text-on-error-container hover:bg-error-container/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {othersRemaining.length > 0
              ? `Revoke other sessions (${othersRemaining.length})`
              : "No other sessions"}
          </button>
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
          {loginSessions.map((s) => {
            const isRevoked = revoked.includes(s.id);
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isRevoked
                    ? "border-outline-variant/40 bg-surface-container-low/60 opacity-60"
                    : "border-outline-variant/60"
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.device}</p>
                  <p className="text-xs text-on-surface-variant">
                    {s.location} • {s.ip} •{" "}
                    {new Date(s.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {s.current ? (
                  <TerraBadge tone="primary" dot pulse>
                    This device
                  </TerraBadge>
                ) : isRevoked ? (
                  <TerraBadge tone="neutral">Revoked</TerraBadge>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.id, s.device)}
                    className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Recent login history" />
        <div className="space-y-2">
          {loginHistory.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-semibold text-on-surface">{h.device}</p>
                <p className="text-xs text-on-surface-variant">
                  {h.at} • {h.location} • {h.ip}
                </p>
              </div>
              <TerraBadge tone={h.ok ? "success" : "error"}>
                {h.ok ? "Success" : "Blocked"}
              </TerraBadge>
            </div>
          ))}
        </div>
      </TerraCard>
    </div>
  );
}
