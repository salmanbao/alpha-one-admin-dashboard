"use client";

/**
 * Console Login + mandatory 2FA (docs/21 CON-01).
 *
 * The console realm has no exception path: every platform role signs in
 * with credentials *and* a second factor. Two steps:
 *
 *   1. Credentials (prefilled demo operator) →
 *   2. 6-digit OTP challenge (authenticator app) → session established
 *
 * Demo semantics match TwoFactorDialog: any 6 digits pass, `000000`
 * fails with an inline error. The session flag (`pfaas:session`) is what
 * `Providers` gates on; Sign out clears it.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@pfaas/ui/input-otp";
import { DEMO_FAILING_CODE } from "@/components/platform/two-factor-dialog";
import { Loader2, ShieldCheck, KeyRound, ArrowLeft, Building2 } from "lucide-react";

const DEMO_EMAIL = "alex@pfaas.io";
const DEMO_PASSWORD = "demo-password";

export function ConsoleLogin({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [credError, setCredError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const inFlight = useRef(false);

  useEffect(() => {
    if (step !== "otp" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  const submitCredentials = () => {
    if (submitting) return;
    if (!email.trim() || !password.trim()) {
      setCredError("Enter both your email and password.");
      return;
    }
    setCredError(null);
    setSubmitting(true);
    // Mock round-trip, then the mandatory 2FA step.
    setTimeout(() => {
      setSubmitting(false);
      setStep("otp");
      setResendIn(30);
    }, 500);
  };

  const verifyOtp = async () => {
    if (code.length !== 6 || verifying || inFlight.current) return;
    inFlight.current = true;
    setVerifying(true);
    setOtpError(null);
    await new Promise((r) => setTimeout(r, 450));
    if (code === DEMO_FAILING_CODE) {
      setOtpError("Invalid code. Please try again.");
      setCode("");
      setVerifying(false);
      inFlight.current = false;
      return;
    }
    onLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">PFaaS Platform Console</h1>
            <p className="text-xs text-muted-foreground">
              Platform operations · super-admin realm
            </p>
          </div>
        </div>

        {step === "credentials" ? (
          <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Sign in</h2>
              <p className="text-xs text-muted-foreground">
                Use your operator credentials. Two-factor verification follows on the next step.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-xs">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-xs">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === "Enter") submitCredentials(); }}
              />
            </div>

            <div className="h-4 text-xs font-medium text-destructive" role="alert">
              {credError}
            </div>

            <Button className="w-full" onClick={submitCredentials} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Checking credentials…" : "Continue"}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Demo: credentials are prefilled — just press Continue.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4" /> Two-factor authentication
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app. 2FA is mandatory for all
                platform roles — there is no exception path.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => { setCode(v); setOtpError(null); }}
                onComplete={verifyOtp}
                autoFocus
                disabled={verifying}
                containerClassName="gap-2"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-10 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className="h-5 text-center text-xs font-medium text-destructive" role="alert">
                {otpError}
              </div>

              <Button className="w-full" disabled={code.length !== 6 || verifying} onClick={verifyOtp}>
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {verifying ? "Verifying…" : "Verify & enter console"}
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                onClick={() => { setStep("credentials"); setCode(""); setOtpError(null); }}
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <button
                type="button"
                className={ resendIn > 0 ? "cursor-not-allowed no-underline opacity-60" : "underline-offset-2 hover:underline"}
                disabled={resendIn > 0}
                onClick={() => setResendIn(30)}
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </div>

            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
              <KeyRound className="h-3 w-3" /> Demo: any 6 digits pass · 000000 fails
            </p>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Sessions time out after 15 minutes of inactivity (CON-30).
        </p>
      </div>
    </div>
  );
}
