"use client";

/**
 * Forgot Password — finding #4: the authentication flow had login + 2FA
 * but no password recovery. Self-service reset that integrates with the
 * email verification workflow (/verify-email): when this browser hasn't
 * verified the address yet, the screen says so up front and offers the
 * verification path instead of failing silently later.
 *
 * Flow: email → sent (30-minute link, resend cooldown) → set new
 * password (shared FormField + useFormValidation — blur/change/submit
 * contract) → done. Deterministic demo: no backend, no Math.random().
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  MailCheck,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Info,
} from "lucide-react";
import {
  FormField,
  useFormValidation,
} from "@pfaas/ui/platform-form-field";
import { isEmailVerified } from "@/lib/email-verification";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/platform/status";

type Status = "idle" | "sending" | "sent" | "reset" | "done";

/* Two validator sets — validateAll() validates every key in its set, so
   the email step and the password step each get their own hook. */
const emailValidators = {
  email: (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
      return "Enter a valid email address.";
    return "";
  },
};

const passwordValidators = {
  newPassword: (v: string) => {
    if (!v) return "New password is required.";
    if (v.length < 8) return "Use at least 8 characters.";
    return "";
  },
  confirmPassword: (v: string) => {
    if (!v) return "Confirm your new password.";
    return "";
  },
};

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Password-match error lives outside the hook (the shared validator
  // only sees its own field's value).
  const [matchError, setMatchError] = useState<string | undefined>();
  // Verification status of this browser's address — read after hydration
  // (localStorage isn't available during SSR), same as the profile badge.
  const [verified, setVerified] = useState(true);

  const emailForm = useFormValidation(emailValidators);
  const passwordForm = useFormValidation(passwordValidators);

  useEffect(() => {
    setVerified(isEmailVerified());
  }, []);

  // Resend cooldown — one tick per second (same as the 2FA resend).
  useEffect(() => {
    if (status !== "sent" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, resendIn]);

  const sendLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.validateAll({ email })) return;
    setStatus("sending");
    setTimeout(() => {
      setStatus("sent");
      setResendIn(30);
    }, 700);
  };

  const updatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsOk = passwordForm.validateAll({ newPassword, confirmPassword });
    const matches = newPassword === confirmPassword;
    setMatchError(
      matches ? undefined : "Passwords don't match — retype them to continue.",
    );
    if (!fieldsOk || !matches) return;
    setStatus("done");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {status === "done" ? "Password updated" : "Reset your password"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Self-service recovery · no support ticket needed
            </p>
          </div>
        </div>

        {/* Email verification integration — surface the unverified state
            before anything is sent, with a direct path forward. */}
        {status === "idle" && !verified && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This address hasn&apos;t been verified on this device yet — the reset
              email will include a verification step.{" "}
              <Link
                href="/verify-email"
                className="font-medium underline underline-offset-2"
              >
                Verify it now →
              </Link>
            </p>
          </div>
        )}

        {/* ── Idle / sending: request the link ── */}
        {(status === "idle" || status === "sending") && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <MailCheck className="h-4 w-4" /> Email me a reset link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={sendLink} className="space-y-3">
                <FormField
                  id="reset-email"
                  label="Registered email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  placeholder="you@firm.com"
                  value={email}
                  {...emailForm.field("email", email, setEmail)}
                />
                <Button className="w-full" disabled={status === "sending"}>
                  {status === "sending" ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  The link expires in 30 minutes for security.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Link sent ── */}
        {status === "sent" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <MailCheck className="h-4 w-4 text-emerald-600" /> Check your inbox
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Reset instructions sent to{" "}
                <strong className="text-foreground">{email}</strong>. Open the link
                inside to choose a new password.
              </p>
              {!verified && (
                <p className="rounded-lg border bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  Unverified address — the link will ask you to confirm the mailbox
                  first.{" "}
                  <Link
                    href="/verify-email"
                    className="font-medium text-primary hover:underline"
                  >
                    Verify now →
                  </Link>
                </p>
              )}
              <Button className="w-full" onClick={() => setStatus("reset")}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> I&apos;ve opened the link
              </Button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    setStatus("idle");
                    setNewPassword("");
                    setConfirmPassword("");
                    setMatchError(undefined);
                  }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  className={
                    resendIn > 0
                      ? "cursor-not-allowed opacity-60"
                      : "font-medium text-primary hover:underline"
                  }
                  disabled={resendIn > 0}
                  onClick={() => setResendIn(30)}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend link"}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Choose a new password ── */}
        {status === "reset" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <KeyRound className="h-4 w-4" /> Choose a new password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={updatePassword} className="space-y-3">
                <FormField
                  id="new-password"
                  label="New password"
                  type="password"
                  required
                  autoComplete="new-password"
                  autoFocus
                  helpText="At least 8 characters — longer is stronger."
                  value={newPassword}
                  {...passwordForm.field("newPassword", newPassword, (next) => {
                    setNewPassword(next);
                    setMatchError(undefined);
                  })}
                />
                <FormField
                  id="confirm-password"
                  label="Confirm password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  {...passwordForm.field("confirmPassword", confirmPassword, (next) => {
                    setConfirmPassword(next);
                    setMatchError(undefined);
                  })}
                  error={
                    passwordForm.errors.confirmPassword ?? matchError
                  }
                />
                <Button className="w-full">Update password</Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  All other sessions are signed out after the change.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Done ── */}
        {status === "done" && (
          <Card className="border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <CardContent className="space-y-3 pt-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your password was updated for{" "}
                <strong className="text-foreground">{email}</strong>. Sign in with the
                new password to continue.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Continue to sign-in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Status + back links */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to sign-in
          </Link>
          <StatusBadge tone={verified ? "success" : "warning"}>
            {verified ? "Email verified" : "Email unverified"}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}
