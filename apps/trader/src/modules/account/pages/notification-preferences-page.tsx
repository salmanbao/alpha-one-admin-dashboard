"use client";

/**
 * Notification Preferences — converted from stitch_screens/notification_preferences
 * Channel toggles per notification category.
 */

import { useState } from "react";
import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

const categories = [
  { id: "milestones", label: "Milestones & targets", note: "Profit target progress, phase completion" },
  { id: "payouts", label: "Payouts", note: "Requests, processing, paid" },
  { id: "risk", label: "Risk alerts", note: "Daily loss warnings, breaches" },
  { id: "security", label: "Security", note: "New logins, password changes, 2FA" },
  { id: "system", label: "System & maintenance", note: "Platform updates, downtime" },
  { id: "marketing", label: "Product news", note: "New features, competitions" },
];

const channels = ["Email", "Push", "In-app"] as const;

export function NotificationPreferencesPage() {
  const [state, setState] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        c.id,
        { Email: true, Push: c.id !== "marketing", "In-app": true },
      ]),
    ),
  );

  function toggle(cat: string, ch: string) {
    setState((s) => ({
      ...s,
      [cat]: { ...s[cat], [ch]: !s[cat][ch] },
    }));
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Notification Preferences"
        description="Choose what to receive and where"
      />

      <TerraCard>
        <TerraSectionTitle title="Categories & channels" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant/60">
                <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Category
                </th>
                {channels.map((ch) => (
                  <th
                    key={ch}
                    className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {ch}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-outline-variant/40 last:border-0">
                  <td className="py-3.5">
                    <p className="font-semibold text-on-surface">{c.label}</p>
                    <p className="text-xs text-on-surface-variant">{c.note}</p>
                  </td>
                  {channels.map((ch) => (
                    <td key={ch} className="py-3.5 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={state[c.id][ch]}
                        aria-label={`${c.label} — ${ch}`}
                        onClick={() => toggle(c.id, ch)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          state[c.id][ch] ? "bg-primary" : "bg-surface-container-high"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            state[c.id][ch] ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TerraCard>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Save preferences
        </button>
      </div>
    </div>
  );
}
