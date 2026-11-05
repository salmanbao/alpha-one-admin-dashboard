"use client";

/**
 * Email verification workflow (audit D #5).
 *
 * The authentication & session flow had 2FA enrollment but no email
 * verification: no prompt for new addresses, no resend, and no recovery
 * path when the mailbox is unreachable. This screen covers the full
 * workflow:
 *
 *   1. Prompt — why the address must be verified
 *   2. Resend — 30s cooldown, exactly like the 2FA code resend
 *   3. Delivery failure — first send fails deterministically (attempt
 *      counter, no Math.random) so the error path is always exercisable
 *   4. Alternatives — owner-updated address + support contact with
 *      pre-filled context when the mailbox can't be reached
 *   5. Verified state — flips the profile indicator (localStorage flag
 *      shared via @/lib/email-verification)
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Mail,
  MailCheck,
  MailWarning,
  Send,
  LifeBuoy,
  UserCog,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  isEmailVerified,
  setEmailVerified,
} from "@/lib/email-verification";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/platform/status";

type Status = "idle" | "sending" | "failed" | "sent" | "verified";

const SUPPORT_HREF = `mailto:support@pfaas.io?${new URLSearchParams({
  subject: "Email verification help — mailbox unreachable",
  body: [
    "I can't complete email verification because I can't access my mailbox.",
    "",
    "Operator email: (see profile)",
    "Requested alternative: address change or out-of-band verification",
    "",
    "Describe your situation:",
  ].join("\n"),
})}`;

export function VerifyEmailPage() {
  const { user } = usePlatform();
  const email = user.email;

  const [status, setStatus] = useState<Status>("idle");
  const [attempts, setAttempts] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  // Already verified (flag persisted by a previous visit) → straight to
  // the verified state on mount.
  useEffect(() => {
    if (isEmailVerified()) setStatus("verified");
  }, []);

  // Resend cooldown — one tick per second, same pattern as ConsoleLogin.
  useEffect(() => {
    if (status !== "sent" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, resendIn]);

  const send = () => {
    if (status === "sending") return;
    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);
    setStatus("sending");
    setTimeout(() => {
      if (nextAttempt === 1) {
        // Deterministic delivery failure on the very first send so the
        // error state is reachable without Math.random(). Retry always
        // succeeds — mirrors real transient provider rejections.
        setStatus("failed");
      } else {
        setStatus("sent");
        setResendIn(30);
      }
    }, 900);
  };

  const confirmVerified = () => {
    setEmailVerified(true);
    setStatus("verified");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Verify your email
            </h1>
            <p className="text-xs text-muted-foreground">
              One-time check · required for security and payout notices
            </p>
          </div>
        </div>

        {/* Status header */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">{email}</span>
          {status === "verified" ? (
            <StatusBadge tone="success">Verified</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Unverified</StatusBadge>
          )}
        </div>

        {/* Workflow card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
              {status === "verified" ? (
                <>
                  <MailCheck className="h-4 w-4 text-emerald-600" /> Email verified
                </>
              ) : status === "failed" ? (
                <>
                  <MailWarning className="h-4 w-4 text-destructive" /> Delivery failed
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Confirmation email
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === "idle" && (
              <>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll send a confirmation link to <strong>{email}</strong>.
                  Verify it to secure password resets, platform alerts and payout
                  notifications — unverified operators miss critical account mail.
                </p>
                <Button className="w-full" onClick={send}>
                  <Send className="mr-1.5 h-4 w-4" /> Send verification email
                </Button>
              </>
            )}

            {status === "sending" && (
              <Button className="w-full" disabled>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
              </Button>
            )}

            {status === "failed" && (
              <>
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  The message to <strong>{email}</strong> was rejected by the mail
                  provider (mailbox full or unreachable). Nothing was sent — check
                  the address in Profile, or try again below.
                </div>
                <Button className="w-full" onClick={send}>
                  Try sending again
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Still failing? Use the alternatives below — verification shouldn&apos;t
                  lock you out.
                </p>
              </>
            )}

            {status === "sent" && (
              <>
                <div
                  role="status"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                >
                  Verification email sent to <strong>{email}</strong>. Open the link
                  inside to finish.
                </div>
                <Button className="w-full" onClick={confirmVerified}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> I&apos;ve opened the link
                </Button>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Demo: the confirmation link opens instantly.</span>
                  <button
                    type="button"
                    className={
                      resendIn > 0
                        ? "cursor-not-allowed opacity-60"
                        : "font-medium text-primary hover:underline"
                    }
                    disabled={resendIn > 0}
                    onClick={send}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
                  </button>
                </div>
              </>
            )}

            {status === "verified" && (
              <>
                <p className="text-sm text-muted-foreground">
                  <strong>{email}</strong> is confirmed. Your profile now shows a
                  verified status and security notices will reach this mailbox.
                </p>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link href="/">Back to dashboard</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEmailVerified(false);
                      setStatus("idle");
                      setAttempts(0);
                    }}
                  >
                    Reset (demo)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Alternatives when the mailbox is unreachable */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
              <LifeBuoy className="h-4 w-4" /> Can&apos;t access this mailbox?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-start gap-2.5 text-sm">
              <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Ask your firm owner to update the address.
                </span>{" "}
                Owners can change operator emails from User Management — the new
                address starts a fresh verification.
              </p>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Contact support.</span>{" "}
                We verify identity out-of-band and enable your account manually —
                typically within one business day.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href={SUPPORT_HREF}>Email support about verification</a>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              2FA is unaffected — your authenticator keeps working even if the
              mailbox is unreachable.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
