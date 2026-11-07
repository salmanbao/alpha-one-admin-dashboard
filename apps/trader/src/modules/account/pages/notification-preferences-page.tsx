"use client";

/**
 * Notification Channel Preferences — rebuilt per M8 spec Section 12.2
 * (View ID /notification-preferences, trader-facing half of the M2.4
 * admin policy matrix).
 *
 * Layout regions (Table 144):
 * - Header: title "Notification Preferences", Save (primary, batch) and
 *   Reset to defaults (within policy bounds).
 * - Endpoint status strip: Email verified chip, Phone verified chip with
 *   Verify/Change actions, Push enabled chip reflecting browser permission
 *   state with an Enable action.
 * - Preference grid: rows Account security, Payouts, Challenges, Trading
 *   alerts, Marketing & promos, Community × columns Email, SMS, WhatsApp,
 *   Push, In-app. Cells are toggle switches; admin-locked cells render a
 *   lock icon with the tooltip "Your firm requires this channel for this
 *   category".
 * - Marketing consent note directly under the Marketing row: consent
 *   statement with a link to the firm's terms and a last-updated date.
 * - Quiet hours card: time-range inputs + timezone (account default) and
 *   the note that transactional in-app alerts are never suppressed.
 *
 * Interactions (Table 145):
 * - An unverified endpoint disables its channel column with a Verify CTA
 *   inline (column header + endpoint strip) instead of failing silently.
 * - Save persists per channel (batch), records a preference-change audit
 *   entry and toasts confirmation; Reset restores policy defaults.
 *
 * States (Table 145): grid seeded from policy defaults (no empty state);
 * grid skeleton while loading; verification failures show inline errors per
 * endpoint with retry; save conflicts refresh policy locks and retain the
 * user's toggles.
 *
 * Data shown: effective preference matrix (user choice ∩ admin policy),
 * endpoint verification states, quiet hours. All data is local dummy data.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton, cn } from "@pfaas/ui";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  Bell,
  Clock,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Grid model                                                          */
/* ------------------------------------------------------------------ */

type Channel = "Email" | "SMS" | "WhatsApp" | "Push" | "In-app";
type CategoryId =
  | "security"
  | "payouts"
  | "challenges"
  | "trading"
  | "marketing"
  | "community";

const channels: Channel[] = ["Email", "SMS", "WhatsApp", "Push", "In-app"];

const categories: { id: CategoryId; label: string; note: string }[] = [
  { id: "security", label: "Account security", note: "New logins, password changes, 2FA codes" },
  { id: "payouts", label: "Payouts", note: "Requests, processing, paid" },
  { id: "challenges", label: "Challenges", note: "Invites, progress, completions" },
  { id: "trading", label: "Trading alerts", note: "Price alerts, fills, limit breaches" },
  { id: "marketing", label: "Marketing & promos", note: "Features, competitions, campaigns" },
  { id: "community", label: "Community", note: "Referrals, leaderboards, chat" },
];

/** Admin policy locks (M2.4 matrix) — locked ON, read-only, explained
 *  by the tooltip instead of hidden. */
const policyLocks: Record<CategoryId, Channel[]> = {
  security: ["Email"],
  payouts: ["In-app"],
  challenges: [],
  trading: [],
  marketing: [],
  community: [],
};

const isLocked = (cat: CategoryId, ch: Channel) =>
  policyLocks[cat].includes(ch);

/** Policy defaults — all transactional channels on, marketing opt-in off,
 *  locks always on (Reset stays "within policy bounds"). */
function defaultMatrix(): Matrix {
  return Object.fromEntries(
    categories.map((c) => [
      c.id,
      Object.fromEntries(
        channels.map((ch) => [ch, isLocked(c.id, ch) || c.id !== "marketing"]),
      ) as Record<Channel, boolean>,
    ]),
  ) as Matrix;
}

type Matrix = Record<CategoryId, Record<Channel, boolean>>;

/* ------------------------------------------------------------------ */
/* Loading skeleton (Table 145 — grid skeleton)                        */
/* ------------------------------------------------------------------ */

function PreferencesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-24 rounded-xl" />
      <div className="space-y-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function NotificationPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Matrix>(defaultMatrix);
  const [dirty, setDirty] = useState(false);

  // Endpoint verification state — phone starts unverified so the
  // disabled-column + inline Verify CTA contract (Table 146) is visible.
  const [emailVerified, setEmailVerified] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [verifying, setVerifying] = useState<"phone" | "push" | null>(null);
  const [endpointError, setEndpointError] = useState<{
    id: "phone" | "push";
    message: string;
  } | null>(null);
  /** 0 = no attempt yet — the first phone verification fails (error state,
   *  Table 145) and the retry succeeds. */
  const phoneAttempts = useRef(0);

  // Quiet hours — account timezone default (Table 144).
  const [quiet, setQuiet] = useState({
    start: "22:00",
    end: "08:00",
    tz: "America/New_York",
  });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  /* ---- Derived column availability ----------------------------- */
  const columnDisabled = (ch: Channel): boolean => {
    if (ch === "SMS" || ch === "WhatsApp") return !phoneVerified;
    if (ch === "Push") return !pushGranted;
    return false;
  };

  const disabledReason = (ch: Channel): string => {
    if (ch === "SMS" || ch === "WhatsApp")
      return "Verify your phone number to enable this channel.";
    if (ch === "Push") return "Enable browser push notifications to use this channel.";
    return "";
  };

  /* ---- Interactions --------------------------------------------- */

  function toggle(cat: CategoryId, ch: Channel) {
    if (isLocked(cat, ch) || columnDisabled(ch)) return;
    setMatrix((m) => ({ ...m, [cat]: { ...m[cat], [ch]: !m[cat][ch] } }));
    setDirty(true);
  }

  /** Verification failure first, success on retry (Table 145 error row). */
  function verifyPhone() {
    if (verifying) return;
    setEndpointError(null);
    setVerifying("phone");
    const attempt = (phoneAttempts.current += 1);
    setTimeout(() => {
      setVerifying(null);
      if (attempt === 1) {
        setEndpointError({
          id: "phone",
          message:
            "We couldn't send the verification code — check the number and retry.",
        });
        toast({
          title: "Verification failed",
          description: "The SMS code could not be sent. Try again.",
          variant: "destructive",
        });
        return;
      }
      setPhoneVerified(true);
      toast({
        title: "Phone verified",
        description: "SMS and WhatsApp notifications are now available.",
      });
    }, 900);
  }

  function enablePush() {
    if (verifying) return;
    setEndpointError(null);
    setVerifying("push");
    setTimeout(() => {
      setVerifying(null);
      setPushGranted(true);
      toast({
        title: "Push enabled",
        description: "Browser permission granted for this device.",
      });
    }, 700);
  }

  function handleSave() {
    // Batch persist per channel; the admin side writes a
    // preference-change audit entry. On a policy conflict the locks are
    // re-derived below while the trader's own toggles are retained.
    setMatrix((m) => ({ ...m })); // refresh effective matrix against policy
    setDirty(false);
    toast({
      title: "Preferences saved",
      description:
        "Your channel choices were saved and a preference-change audit entry was recorded.",
    });
  }

  function handleReset() {
    setMatrix(defaultMatrix());
    setDirty(false);
    toast({
      title: "Reset to defaults",
      description: "Preferences restored to your firm's policy defaults.",
    });
  }

  if (loading) return <PreferencesSkeleton />;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Notification Preferences"
        description="Choose what you receive, on which channel — inside your firm's guardrails"
        actions={
          <>
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty}
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </>
        }
      />

      {/* ---------------------------- Endpoint status strip */}
      <TerraCard className="p-4">
        <div className="flex flex-wrap items-stretch gap-3">
          {/* Email */}
          <EndpointChip
            icon={<Mail className="h-4 w-4" />}
            label={emailVerified ? "Email verified" : "Email not verified"}
            ok={emailVerified}
            action={
              <button
                type="button"
                onClick={() =>
                  toast({
                    title: "Change email",
                    description: "A confirmation link was sent to your address.",
                  })
                }
                className="text-[11px] font-bold text-primary underline hover:text-primary/80"
              >
                Change
              </button>
            }
          />

          {/* Phone */}
          <EndpointChip
            icon={<Phone className="h-4 w-4" />}
            label={
              phoneVerified
                ? "Phone verified"
                : verifying === "phone"
                  ? "Sending code…"
                  : "Phone not verified"
            }
            ok={phoneVerified}
            action={
              phoneVerified ? (
                <button
                  type="button"
                  onClick={() =>
                    toast({
                      title: "Change phone",
                      description: "Update your number to re-verify the SMS channel.",
                    })
                  }
                  className="text-[11px] font-bold text-primary underline hover:text-primary/80"
                >
                  Change
                </button>
              ) : (
                <button
                  type="button"
                  onClick={verifyPhone}
                  disabled={verifying === "phone"}
                  className="text-[11px] font-bold text-error underline disabled:opacity-60"
                >
                  {verifying === "phone" ? "Verifying…" : "Verify"}
                </button>
              )
            }
          />

          {/* Push (browser permission state) */}
          <EndpointChip
            icon={<Bell className="h-4 w-4" />}
            label={
              pushGranted
                ? "Push enabled"
                : verifying === "push"
                  ? "Requesting permission…"
                  : "Push not enabled"
            }
            ok={pushGranted}
            action={
              pushGranted ? (
                <span className="text-[11px] font-bold text-on-surface-variant">
                  Browser
                </span>
              ) : (
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={verifying === "push"}
                  className="text-[11px] font-bold text-error underline disabled:opacity-60"
                >
                  {verifying === "push" ? "Enabling…" : "Enable"}
                </button>
              )
            }
          />

          {/* In-app is always available — the inbox never needs an endpoint */}
          <EndpointChip
            icon={<ShieldCheck className="h-4 w-4" />}
            label="In-app always on"
            ok
            action={
              <Link
                href="/notification-center"
                className="text-[11px] font-bold text-primary underline hover:text-primary/80"
              >
                Inbox
              </Link>
            }
          />
        </div>

        {/* Inline verification error with retry (Table 145 error row) */}
        {endpointError && (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-error/40 bg-error-container/30 px-3 py-2"
          >
            <span className="text-xs font-semibold text-error">
              {endpointError.message}
            </span>
            <button
              type="button"
              onClick={() =>
                endpointError.id === "phone" ? verifyPhone() : enablePush()
              }
              className="text-xs font-bold text-primary underline"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setEndpointError(null)}
              className="ml-auto text-xs text-on-surface-variant underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </TerraCard>

      {/* ---------------------------- Preference grid */}
      <TerraCard>
        <TerraSectionTitle
          title="Categories & channels"
          description="Locked cells are set by your firm; greyed columns need a verified endpoint."
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant/60">
                <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Category
                </th>
                {channels.map((ch) => {
                  const disabled = columnDisabled(ch);
                  return (
                    <th key={ch} className="pb-3 text-center">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {ch}
                      </span>
                      {disabled && (
                        <button
                          type="button"
                          onClick={() =>
                            ch === "Push"
                              ? enablePush()
                              : verifyPhone()
                          }
                          className="mt-0.5 text-[10px] font-bold text-error underline"
                        >
                          {ch === "Push" ? "Enable" : "Verify"}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-outline-variant/40 last:border-0"
                >
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-on-surface">{c.label}</p>
                    <p className="text-xs text-on-surface-variant">{c.note}</p>
                  </td>
                  {channels.map((ch) => {
                    const locked = isLocked(c.id, ch);
                    const disabledCol = columnDisabled(ch);
                    const checked = matrix[c.id][ch];
                    return (
                      <td key={ch} className="py-3.5 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={checked}
                              onCheckedChange={() => toggle(c.id, ch)}
                              disabled={locked || disabledCol}
                              aria-label={`${c.label} — ${ch}`}
                            />
                            {locked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    tabIndex={0}
                                    aria-label="Your firm requires this channel for this category"
                                    className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
                                  >
                                    <Lock className="h-3 w-3" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Your firm requires this channel for this category
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {locked && (
                            <span className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                              Required
                            </span>
                          )}
                          {!locked && disabledCol && (
                            <span className="text-[9px] font-semibold text-error">
                              {ch === "Push" ? "Enable push" : "Verify phone"}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Marketing consent note — directly under the Marketing row */}
              <tr>
                <td colSpan={channels.length + 1} className="pt-3">
                  <div className="flex items-start gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs leading-relaxed text-on-surface">
                        By keeping <span className="font-bold">Marketing &amp; promos</span>{" "}
                        on, you consent to receive campaign messages about new features,
                        competitions and offers from your firm. Withdraw consent any time
                        by toggling this row off. See the{" "}
                        <Link
                          href="/terms"
                          className="font-bold text-primary underline hover:text-primary/80"
                        >
                          firm's terms
                        </Link>
                        .
                      </p>
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        Consent recorded: October 15, 2026 · Last updated{" "}
                        <span className="font-semibold">Oct 15, 2026</span>
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Column-disabled explanation (Verify CTA inline, Table 145) */}
        {(!phoneVerified || !pushGranted) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
            {!phoneVerified && (
              <span>
                <span className="font-bold text-on-surface">SMS and WhatsApp</span> are
                disabled until your phone is verified —{" "}
                <button
                  type="button"
                  onClick={verifyPhone}
                  className="font-bold text-primary underline"
                >
                  Verify now
                </button>
                .
              </span>
            )}
            {!pushGranted && (
              <span>
                <span className="font-bold text-on-surface">Push</span> is disabled until
                browser permission is granted —{" "}
                <button
                  type="button"
                  onClick={enablePush}
                  className="font-bold text-primary underline"
                >
                  Enable push
                </button>
                .
              </span>
            )}
          </div>
        )}
      </TerraCard>

      {/* ---------------------------- Quiet hours card */}
      <TerraCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="font-semibold text-on-surface">Quiet hours</p>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-on-surface-variant">
              Non-transactional notifications are held outside your window.{" "}
              <span className="font-bold text-on-surface">
                Transactional in-app alerts (payouts, security, challenge results) are
                never suppressed.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="quiet-start"
                className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
              >
                From
              </label>
              <Input
                id="quiet-start"
                type="time"
                value={quiet.start}
                onChange={(e) => {
                  setQuiet((q) => ({ ...q, start: e.target.value }));
                  setDirty(true);
                }}
                className="mt-1 w-28"
              />
            </div>
            <div>
              <label
                htmlFor="quiet-end"
                className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
              >
                To
              </label>
              <Input
                id="quiet-end"
                type="time"
                value={quiet.end}
                onChange={(e) => {
                  setQuiet((q) => ({ ...q, end: e.target.value }));
                  setDirty(true);
                }}
                className="mt-1 w-28"
              />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Timezone
              </span>
              <Select
                value={quiet.tz}
                onValueChange={(v) => {
                  setQuiet((q) => ({ ...q, tz: v }));
                  setDirty(true);
                }}
              >
                <SelectTrigger className="mt-1 w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">America/New_York (account)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-on-surface-variant">
          Quiet window: {quiet.start} – {quiet.end} · {quiet.tz}
        </p>
      </TerraCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Endpoint chip                                                       */
/* ------------------------------------------------------------------ */

function EndpointChip({
  icon,
  label,
  ok,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-52 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5",
        ok
          ? "border-outline-variant/40 bg-surface-container-low"
          : "border-error/40 bg-error-container/20",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          ok
            ? "bg-primary-fixed text-on-primary-fixed-variant"
            : "bg-error-container text-on-error-container",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-on-surface">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wide",
              ok ? "text-primary" : "text-error",
            )}
          >
            {ok ? "Ready" : "Action needed"}
          </span>
          {action}
        </div>
      </div>
    </div>
  );
}
