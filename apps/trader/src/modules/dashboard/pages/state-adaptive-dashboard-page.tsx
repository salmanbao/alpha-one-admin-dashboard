"use client";

/**
 * State-Adaptive Dashboard — converted from stitch_screens/state_adaptive_dashboard
 * Lifecycle simulator: switch account states (purchased → … → breached) and
 * see the dashboard banner, CTA and stats adapt.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  formatMoney,
} from "@/components/terra/terra-ui";

type StateKey =
  | "purchased"
  | "kyc"
  | "provisioning"
  | "active_eval"
  | "near_target"
  | "passed"
  | "funded_live"
  | "payout_eligible"
  | "payout_processing"
  | "breached";

interface StateConfig {
  label: string;
  icon: string;
  title: string;
  message: string;
  tone: "primary" | "tertiary" | "error" | "secondary";
  cta: { label: string; href: string };
  progress: number;
  progressLabel: string;
}

const stateConfigs: Record<StateKey, StateConfig> = {
  purchased: {
    label: "Purchased (No KYC)",
    icon: "🛒",
    title: "Challenge purchased!",
    message: "Complete KYC to unlock account provisioning.",
    tone: "primary",
    cta: { label: "Start KYC", href: "/kyc-onboarding" },
    progress: 10,
    progressLabel: "Purchased",
  },
  kyc: {
    label: "KYC Required",
    icon: "🪪",
    title: "Verification needed",
    message: "Upload your ID and proof of address to continue.",
    tone: "tertiary",
    cta: { label: "Continue KYC", href: "/kyc-onboarding" },
    progress: 25,
    progressLabel: "KYC in progress",
  },
  provisioning: {
    label: "Provisioning",
    icon: "⚙️",
    title: "Account being provisioned",
    message: "Your credentials will arrive within the hour.",
    tone: "secondary",
    cta: { label: "View progress", href: "/account-provisioning" },
    progress: 45,
    progressLabel: "Provisioning",
  },
  active_eval: {
    label: "Active Evaluation",
    icon: "📈",
    title: "Evaluation active",
    message: "Trade within the rules and hit your profit target.",
    tone: "primary",
    cta: { label: "Open trading", href: "/trading-positions" },
    progress: 30,
    progressLabel: "30% to target",
  },
  near_target: {
    label: "Near Target (82%)",
    icon: "🎯",
    title: "82% toward your profit target",
    message: "$2,460 of $3,000 reached — stay disciplined.",
    tone: "primary",
    cta: { label: "Continue Trading", href: "/trading-positions" },
    progress: 82,
    progressLabel: "82% to target",
  },
  passed: {
    label: "Passed Phase",
    icon: "🏆",
    title: "Phase complete!",
    message: "Phase 2 unlocks after credentials are issued.",
    tone: "primary",
    cta: { label: "See next steps", href: "/evaluation-passed" },
    progress: 100,
    progressLabel: "Phase complete",
  },
  funded_live: {
    label: "Funded Live",
    icon: "💰",
    title: "You're funded",
    message: "Live capital with an 85/15 profit split.",
    tone: "primary",
    cta: { label: "Open trading", href: "/trading-positions" },
    progress: 100,
    progressLabel: "Funded",
  },
  payout_eligible: {
    label: "Payout Eligible",
    icon: "💸",
    title: "Payout window open",
    message: "Request your profit split — available now.",
    tone: "primary",
    cta: { label: "Request payout", href: "/payout-request" },
    progress: 100,
    progressLabel: "Payout eligible",
  },
  payout_processing: {
    label: "Payout Processing",
    icon: "⏳",
    title: "Payout in progress",
    message: "Your payout is being processed and will arrive soon.",
    tone: "tertiary",
    cta: { label: "Track payout", href: "/payout-history" },
    progress: 100,
    progressLabel: "Payout processing",
  },
  breached: {
    label: "Breached",
    icon: "⚠️",
    title: "Account breached",
    message: "A risk rule was exceeded — the account is closed.",
    tone: "error",
    cta: { label: "See options", href: "/account-breach" },
    progress: 0,
    progressLabel: "Breached",
  },
};

const stateKeys = Object.keys(stateConfigs) as StateKey[];

export function StateAdaptiveDashboardPage() {
  const [state, setState] = useState<StateKey>("near_target");
  const cfg = stateConfigs[state];

  return (
    <div className="space-y-6">
      {/* State simulator bar */}
      <section className="-mx-4 bg-surface-container-high/80 px-4 py-3.5 shadow-sm sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              ⟳
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                State-Adaptive Lifecycle Simulator
              </span>
              <span className="text-[11px] text-secondary">
                Switch account states in real-time
              </span>
            </div>
          </div>
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {stateKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setState(k)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-all",
                  state === k
                    ? k === "breached"
                      ? "bg-error font-bold text-on-error"
                      : "bg-primary font-bold text-on-primary shadow-sm"
                    : "bg-surface font-medium text-on-surface-variant hover:bg-surface-variant",
                )}
              >
                {stateConfigs[k].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic banner */}
      <TerraCard
        className={cn(
          "relative overflow-hidden",
          cfg.tone === "error" && "bg-error-container/50",
          cfg.tone === "tertiary" && "bg-tertiary-fixed/40",
          cfg.tone === "secondary" && "bg-secondary-fixed/60",
          cfg.tone === "primary" && "bg-gradient-to-r from-primary-fixed-dim/30 via-tertiary-fixed/30 to-secondary-container",
        )}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
                cfg.tone === "error" ? "bg-error text-on-error" : "bg-primary text-on-primary",
              )}
            >
              {cfg.icon}
            </span>
            <div>
              <p className="font-headline text-lg font-bold text-on-surface">{cfg.title}</p>
              <p className="text-sm text-on-surface-variant">{cfg.message}</p>
            </div>
          </div>
          <Link
            href={cfg.cta.href}
            className={cn(
              "group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-95",
              cfg.tone === "error"
                ? "bg-error text-on-error hover:bg-error/90"
                : "bg-primary text-on-primary hover:bg-primary/90",
            )}
          >
            {cfg.cta.label} →
          </Link>
        </div>
      </TerraCard>

      {/* Adapted progress + stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title={cfg.progressLabel} />
          <TerraProgress value={cfg.progress} height="h-3" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TerraStat label="Balance" value={formatMoney(101860)} tone="positive" />
            <TerraStat label="Equity" value={formatMoney(102140.5)} tone="positive" />
            <TerraStat label="Daily Loss Left" value={formatMoney(1200)} />
            <TerraStat label="Max DD Left" value={formatMoney(7850)} />
          </div>
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Lifecycle" />
          <div className="space-y-1.5 text-xs">
            {[
              "Purchased",
              "KYC Required",
              "Provisioning",
              "Active",
              "Near Target",
              "Passed",
              "Funded",
              "Payout Eligible",
            ].map((l) => {
              const active = cfg.label.toLowerCase().includes(l.toLowerCase().split(" ")[0]);
              return (
                <div
                  key={l}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-1.5",
                    active ? "bg-primary-fixed font-bold text-on-primary-fixed-variant" : "text-on-surface-variant",
                  )}
                >
                  <span>{l}</span>
                  {active && <TerraBadge tone="primary">Current</TerraBadge>}
                </div>
              );
            })}
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
