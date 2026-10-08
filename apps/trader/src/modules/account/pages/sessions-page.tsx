"use client";

/**
 * Sessions & Login History — converted from stitch_screens/sessions_login_history
 * Active devices + recent login log with revoke actions.
 */

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
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Sessions & Login History"
        description="Devices signed in to your account"
        actions={
          <button
            type="button"
            className="rounded-xl bg-error-container px-4 py-2 text-sm font-bold text-on-error-container hover:bg-error-container/80"
          >
            Revoke other sessions
          </button>
        }
      />

      <TerraCard>
        <TerraSectionTitle title="Active sessions" />
        <div className="space-y-3">
          {loginSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-outline-variant/60 px-4 py-3"
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
              ) : (
                <button
                  type="button"
                  className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
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
