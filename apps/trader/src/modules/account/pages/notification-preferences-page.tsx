"use client";

/**
 * Notification Channel Preferences — rebuilt per M8 spec Section 12.2
 *
 * Header: Title Notification Preferences; Save (primary, batch); Reset to defaults (within policy bounds).
 * Endpoint status strip: Email verified chip, Phone verified chip (with Verify/Change actions), Push enabled chip (browser permission state with Enable action).
 * Preference grid: Rows: Account security, Payouts, Challenges, Trading alerts, Marketing & promos, Community. Columns: Email, SMS, WhatsApp, Push, In-app. Cells: toggle switches; admin-locked cells show a lock icon with tooltip Your firm requires this channel for this category.
 * Marketing consent note: Under the Marketing row: consent statement with link to the firm's terms (terms route) and last-updated date.
 * Quiet hours card: Time-range picker with timezone (account timezone default); note that transactional in-app alerts are never suppressed.
 *
 * Interactions:
 * - Unverified endpoint disables its channel column with a Verify CTA inline rather than silent failure.
 * - Save persists per channel, writes a preference-change audit entry on the admin side, and toasts confirmation.
 *
 * States:
 * - Empty: Not applicable (grid seeded from policy defaults).
 * - Loading: Grid skeleton.
 * - Error: Verification failures show inline errors per endpoint with retry; save conflicts refresh policy locks and retain user toggles.
 *
 * Data shown: Effective preference matrix (user choice intersected with admin policy), endpoint verification states, quiet hours.
 */
import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { useToast } from "@/hooks/use-toast";
import { Lock, Clock, Phone, Mail, Bell, Zap, Shield } from "lucide-react";

type Channel = "Email" | "SMS" | "WhatsApp" | "Push" | "In-app";
type Category = "security" | "payouts" | "challenges" | "trading" | "marketing" | "community";

const channels: Channel[] = ["Email", "SMS", "WhatsApp", "Push", "In-app"];

const categories = [
  { id: "security", label: "Account security", note: "New logins, password changes, 2FA" },
  { id: "payouts", label: "Payouts", note: "Requests, processing, paid" },
  { id: "challenges", label: "Challenges", note: "Challenge invites, progress, completions" },
  { id: "trading", label: "Trading alerts", note: "Price alerts, execution fills, breaches" },
  { id: "marketing", label: "Marketing & promos", note: "New features, competitions, campaigns" },
  { id: "community", label: "Community", note: "Referrals, leaderboard, chat" },
];

// Admin policy locks: which cells are locked (read-only) for each category
const lockedCells: Record<string, Set<string>> = {
  payouts: new Set(["In-app"]),
};

// Endpoint verification state
interface EndpointStatus {
  channel: Channel;
  verified: boolean;
  label: string;
  icon: React.ReactNode;
}

export function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [state, setState] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        c.id,
        Object.fromEntries(channels.map((ch) => [ch, c.id !== "marketing"])),
      ])
    )
  );

  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Endpoint status
  const endpoints: EndpointStatus[] = [
    { channel: "Email", verified: true, label: "Email verified", icon: <Mail className="h-4 w-4" /> },
    { channel: "SMS", verified: true, label: "Phone verified", icon: <Phone className="h-4 w-4" /> },
    { channel: "WhatsApp", verified: false, label: "WhatsApp not verified", icon: <Bell className="h-4 w-4" /> },
    { channel: "Push", verified: true, label: "Push enabled", icon: <Zap className="h-4 w-4" /> },
    { channel: "In-app", verified: true, label: "In-app enabled", icon: <Shield className="h-4 w-4" /> },
  ];

  function toggle(cat: string, ch: string) {
    const isLocked = lockedCells[cat]?.has(ch);
    if (isLocked) return;
    setState((s) => ({
      ...s,
      [cat]: { ...s[cat], [ch]: !s[cat][ch] },
    }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    // Frontend-only demo: no PUT /notifications/preferences call.
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
    toast({
      title: "Preferences saved",
      description: "Your notification preferences have been saved.",
    });
  }

  function handleReset() {
    setState(
      Object.fromEntries(
        categories.map((c) => [
          c.id,
          Object.fromEntries(channels.map((ch) => [ch, c.id !== "marketing"])),
        ])
      )
    );
    setDirty(false);
    setSaved(false);
    toast({
      title: "Reset to defaults",
      description: "Preferences reset to policy defaults.",
    });
  }

  function isLocked(cat: string, ch: string) {
    return lockedCells[cat]?.has(ch);
  }

  function isDisabled(col: Channel) {
    const endpoint = endpoints.find((e) => e.channel === col);
    return endpoint && !endpoint.verified;
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Notification Preferences"
        description="Choose what to receive and where"
        actions={
          <>
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty}
              className="text-sm font-semibold text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </>
        }
      />

      {/* Endpoint status strip */}
      <TerraCard className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {endpoints.map((ep) => (
            <div
              key={ep.channel}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/40"
            >
              {ep.icon}
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-on-surface">{ep.label}</p>
                {ep.verified ? (
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-tighter">
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-error uppercase tracking-tighter underline"
                    onClick={() => toast({ title: "Verify", description: `Verify ${ep.channel} endpoint` })}
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerraCard>

      {/* Preference grid */}
      <TerraCard className="p-4">
        <TerraSectionTitle title="Categories & channels" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
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
                    <td
                      key={ch}
                      className="py-3.5 text-center"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={state[c.id][ch]}
                        aria-label={`${c.label} — ${ch}`}
                        aria-disabled={isLocked(c.id, ch) || isDisabled(ch)}
                        disabled={isLocked(c.id, ch) || isDisabled(ch)}
                        onClick={() => toggle(c.id, ch)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          state[c.id][ch] ? "bg-primary" : "bg-surface-container-high"
                        } ${isLocked(c.id, ch) ? "cursor-not-allowed opacity-50" : ""} ${
                          isDisabled(ch) ? "cursor-not-allowed opacity-30" : ""
                        }`}
                      >
                        {isLocked(c.id, ch) && (
                          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-on-surface-variant pointer-events-none" />
                        )}
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            state[c.id][ch] ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                      {isLocked(c.id, ch) && (
                        <span className="text-[10px] text-error underline" title="Your firm requires this channel for this category">
                          locked
                        </span>
                      )}
                      {isDisabled(ch) && !isLocked(c.id, ch) && (
                        <button
                          type="button"
                          className="text-[10px] text-error underline"
                          onClick={() => toast({ title: "Verify", description: `Verify ${ch} endpoint to enable` })}
                        >
                          Verify {ch}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TerraCard>

      {/* Marketing consent note */}
      <TerraCard className="p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface mb-2">
              By enabling Marketing &amp; promos, you consent to receive communications about new features,
              competitions, and campaigns from your firm.
            </p>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>Terms:</span>
              <button type="button" className="text-primary underline hover:text-primary/80">
                Firm terms →
              </button>
              <span className="text-gray-400">·</span>
              <span>Last updated: Oct 15, 2026</span>
            </div>
          </div>
        </div>
      </TerraCard>

      {/* Quiet hours card */}
      <TerraCard className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-on-surface">Quiet hours</p>
            <p className="text-xs text-on-surface-variant">
              Suppress non-transactional notifications outside your preferred window.
              Transactional in-app alerts are never suppressed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-on-surface">
              <Clock className="h-4 w-4" />
              <span>22:00 – 08:00</span>
              <span className="text-xs text-on-surface-variant ml-2">(America/New_York)</span>
            </div>
            <button
              type="button"
              className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container"
            >
              Edit
            </button>
          </div>
        </div>
      </TerraCard>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs font-bold text-primary" role="status">
            ✓ Preferences saved
          </span>
        )}
      </div>
    </div>
  );
}