"use client";

/**
 * 2FA Setup Wizard — converted from stitch_screens/2fa_setup_wizard
 * Step wizard: scan QR → enter code → backup codes.
 */

import { useState } from "react";
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

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
        actions={<TerraBadge tone="primary">Step {step} of {steps.length}</TerraBadge>}
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const n = i + 1;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
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

      <div className="mx-auto max-w-xl">
        {step === 1 && (
          <TerraCard className="flex flex-col gap-4 text-center">
            <span className="text-4xl">🔐</span>
            <h2 className="font-headline text-lg font-bold text-on-surface">
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
            <h2 className="font-headline text-lg font-bold text-on-surface">Scan this QR code</h2>
            <div className="grid h-44 w-44 grid-cols-8 gap-0.5 rounded-xl border border-outline-variant/60 bg-white p-2">
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
            <h2 className="font-headline text-lg font-bold text-on-surface">
              Enter the 6-digit code
            </h2>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              className="mx-auto w-52 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] tabular-nums outline-none focus:border-primary"
            />
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
            <h2 className="font-headline text-lg font-bold text-on-surface">
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
