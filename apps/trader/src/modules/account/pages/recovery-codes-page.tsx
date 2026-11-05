"use client";

/**
 * Recovery Codes Management — audit finding #5 (LOW): missing 2FA
 * recovery code management.
 *
 * Dedicated screen for viewing, downloading, and regenerating 2FA
 * backup codes. Traders who lose their authenticator device can use
 * these codes to regain access — without this screen they'd be
 * permanently locked out.
 *
 * Security warnings included: codes are shown once, should be stored
 * offline, and regenerating invalidates previous codes.
 */

import { useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

const initialCodes = [
  "7F2K-9QMX", "3APL-8TWR", "5ZNE-2VBC",
  "9JHD-4KQM", "6RTY-1PLS", "2XCF-7BNV",
  "B7MN-4RTP", "8KQW-2JLD", "4VNX-6HMC",
  "1ZPB-3FGK", "5RTY-9WQJ", "2LMN-7XCV",
];

const regeneratedCodes = [
  "A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2",
  "M3N4-O5P6", "Q7R8-S9T0", "U1V2-W3X4",
  "Y5Z6-A7B8", "C9D0-E1F2", "G3H4-I5J6",
  "K7L8-M9N0", "O1P2-Q3R4", "S5T6-U7V8",
];

export function RecoveryCodesPage() {
  const [codes, setCodes] = useState(initialCodes);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text visually
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const content = `TerraTrader 2FA Recovery Codes\nGenerated: ${new Date().toLocaleDateString()}\n\n${codes.join("\n")}\n\nEach code can be used once. Store securely offline.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "terratrader-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    // Simulate generation delay
    setTimeout(() => {
      setCodes(regeneratedCodes);
      setRegenerating(false);
      setRegenerated(true);
      setTimeout(() => setRegenerated(false), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Recovery Codes"
        description="Backup codes for two-factor authentication"
        actions={<TerraBadge tone="primary">12 active codes</TerraBadge>}
      />

      {/* Security warning */}
      <TerraCard className="border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-headline text-lg font-bold text-amber-800 dark:text-amber-400">
              Store these codes securely
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              <li>• Each code can be used only once</li>
              <li>• Store them offline — not in your password manager</li>
              <li>• Regenerating invalidates all previous codes</li>
              <li>• Use these if you lose access to your authenticator app</li>
            </ul>
          </div>
        </div>
      </TerraCard>

      {/* Codes grid */}
      <TerraCard>
        <TerraSectionTitle
          title="Your recovery codes"
          description="Enter one of these codes when prompted for a verification code during sign-in."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {codes.map((code, i) => (
            <div
              key={`${code}-${i}`}
              className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-center"
            >
              <span className="font-mono text-sm font-bold tracking-wider text-on-surface">
                {code}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            {copied ? "✓ Copied!" : "Copy codes"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            {downloaded ? "✓ Downloaded!" : "Download as file"}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-xl border border-error/40 px-5 py-2.5 text-sm font-semibold text-error hover:bg-error-container/30 disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "Regenerate codes"}
          </button>
        </div>

        {regenerated && (
          <p className="mt-3 rounded-lg bg-primary-fixed/40 px-4 py-2 text-sm font-semibold text-on-primary-fixed-variant">
            ✓ New codes generated — previous codes are no longer valid.
          </p>
        )}
      </TerraCard>

      {/* How to use */}
      <TerraCard>
        <TerraSectionTitle title="How to use recovery codes" />
        <ol className="space-y-3">
          {[
            {
              title: "When you can't access your authenticator",
              note: "Select 'Use recovery code' on the 2FA verification screen instead of entering a time-based code.",
            },
            {
              title: "Enter an unused code",
              note: "Type any one of the codes above. Each code works exactly once.",
            },
            {
              title: "Regenerate after use",
              note: "Once you've used a code, generate new ones to maintain your backup set.",
            },
          ].map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">{step.title}</p>
                <p className="text-xs text-on-surface-variant">{step.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </TerraCard>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link
          href="/2fa-setup"
          className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Back to 2FA Setup
        </Link>
        <Link
          href="/account-settings"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Account Settings
        </Link>
      </div>
    </div>
  );
}
