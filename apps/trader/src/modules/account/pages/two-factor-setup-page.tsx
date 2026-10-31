"use client";

/**
 * 2FA Setup Wizard — converted from stitch_screens/2fa_setup_wizard
 * Step wizard: scan QR → enter code → backup codes.
 *
 * Keyboard support (audit finding #3): each step change focuses the new
 * step heading and announces the step via an sr-only aria-live region;
 * the stepper marks aria-current="step"; the disabled Verify button is
 * explained; the OTP input has a programmatic label; the decorative QR
 * grid is hidden from assistive tech (the secret string below it is the
 * accessible alternative).
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

const steps = ["Install app", "Scan QR code", "Verify code", "Backup codes"];

const backupCodes = [
  "7F2K-9QMX", "3APL-8TWR", "5ZNE-2VBC",
  "9JHD-4KQM", "6RTY-1PLS", "2XCF-7BNV",
];

export function TwoFactorSetupPage() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  // Focus management: focus the new step's heading after every step
  // change (skip the initial render).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
        actions={<TerraBadge tone="primary">Step {step} of {steps.length}</TerraBadge>}
      />

      {/* Stepper — active step exposed to assistive tech */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const n = i + 1;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                aria-current={n === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap",
                  n < step
                    ? "bg-primary-fixed text-on-primary-fixed-variant"
                    : n === step
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant",
                )}
              >
                <span>{n < step ? "✓" : n}</span>
                <span>{s}</span>
              </div>
              {i < steps.length - 1 && <span className="text-outline-variant">—</span>}
            </div>
          );
        })}
      </div>

      {/* Screen-reader step announcements (finding #3) */}
      <p role="status" aria-live="polite" className="sr-only">
        Step {step} of {steps.length}: {steps[step - 1]}
        {step === 3 && code.length < 6
          ? ` — enter the ${6 - code.length} remaining digit${6 - code.length === 1 ? "" : "s"} of the 6-digit code.`
          : ""}
      </p>

      <div className="mx-auto max-w-xl">
        {step === 1 && (
          <TerraCard className="flex flex-col gap-4 text-center">
            <span className="text-4xl" aria-hidden>🔐</span>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-headline text-lg font-bold text-on-surface outline-none"
            >
              Install an authenticator app
            </h2>
            <p className="text-sm text-on-surface-variant">
              Google Authenticator, Authy or 1Password — any TOTP app works.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              I have an app — next
            </button>
          </TerraCard>
        )}

        {step === 2 && (
          <TerraCard className="flex flex-col items-center gap-4 text-center">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-headline text-lg font-bold text-on-surface outline-none"
            >
              Scan this QR code
            </h2>
            {/* Decorative QR stand-in — the secret below is the
                accessible alternative (finding #3) */}
            <div
              aria-hidden
              className="grid h-44 w-44 grid-cols-8 gap-0.5 rounded-xl border border-outline-variant/60 bg-white p-2"
            >
              {Array.from({ length: 64 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    (i * 7 + Math.floor(i / 8) * 13) % 3 === 0 ? "bg-on-surface" : "bg-transparent"
                  }
                />
              ))}
            </div>
            <p className="font-mono text-xs text-on-surface-variant">
              OTPAUTH://TOTP/terra:tom.allen?secret=JBSWY3DP…
            </p>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Scanned — next
            </button>
          </TerraCard>
        )}

        {step === 3 && (
          <TerraCard className="flex flex-col gap-4 text-center">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-headline text-lg font-bold text-on-surface outline-none"
            >
              Enter the 6-digit code
            </h2>
            <label className="mx-auto flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Authentication code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby="otp-hint"
                className="w-52 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] tabular-nums outline-none focus:border-primary"
              />
            </label>
            {/* Never leave a disabled button unexplained (finding #3) */}
            <p id="otp-hint" role="status" className="text-xs text-on-surface-variant">
              {code.length < 6
                ? `Enter all 6 digits to enable 2FA (${code.length} of 6 entered).`
                : "Code complete — select Verify & enable."}
            </p>
            <button
              type="button"
              disabled={code.length < 6}
              onClick={() => setStep(4)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              Verify & enable
            </button>
          </TerraCard>
        )}

        {step === 4 && (
          <TerraCard className="flex flex-col gap-4 text-center">
            <TerraBadge tone="success" className="self-center">2FA enabled</TerraBadge>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-headline text-lg font-bold text-on-surface outline-none"
            >
              Save your backup codes
            </h2>
            <p className="text-sm text-on-surface-variant">
              Each code can be used once if you lose your device.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <span
                  key={c}
                  className="rounded-lg bg-surface-container-low px-3 py-2 font-mono text-sm font-bold"
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Copy codes
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </TerraCard>
        )}
      </div>
    </div>
  );
}
