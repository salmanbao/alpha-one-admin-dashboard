"use client";

/**
 * Journey checklist — SF-02.
 *
 * The state-driven tracker behind both "what happens next" surfaces:
 * the dashboard's Getting Started card and purchase-completed's list
 * (which used to ship hardcoded `done` flags). Every tick is read from
 * @/lib/onboarding/journey-store — nothing is completed by hand — and
 * every outstanding step deep-links to the screen that advances it,
 * closing the self-navigation gaps between verification, provisioning
 * and credentials the Round-5 audit found.
 *
 * Rendered as a bare <ol>; the wrappers supply the card chrome
 * (heading, progress badge, dismiss).
 */

import Link from "next/link";
import { cn } from "@pfaas/ui";
import { Check, ChevronRight } from "lucide-react";
import { useJourneyDone, type JourneyStepId } from "@/lib/onboarding/journey-store";
import { useLifecycleLog } from "@pfaas/lifecycle";

export interface JourneyStep {
  id: JourneyStepId;
  title: string;
  /** Shown while the step is outstanding. */
  body: string;
  /** Shown once the store says the step is done. */
  doneNote: string;
  href: string;
  cta: string;
}

export const journeySteps: JourneyStep[] = [
  {
    id: "purchased",
    title: "Challenge purchased",
    body: "Pick a program and check out — provisioning starts as soon as payment lands.",
    doneNote: "Order confirmed",
    href: "/marketplace",
    cta: "Browse challenges",
  },
  {
    id: "verified",
    title: "Identity verified",
    body: "Upload your ID and proof of address once — takes ~10 minutes, most reviews finish within 24 hours.",
    doneNote: "Submitted — review usually under 24h",
    href: "/verification",
    cta: "Start verification",
  },
  {
    id: "provisioned",
    title: "Account provisioned",
    body: "Your trading account and server space are created — typically within 1 business hour of verification.",
    doneNote: "Trading account created",
    href: "/account-provisioning",
    cta: "View provisioning",
  },
  {
    id: "credentialed",
    title: "Credentials delivered",
    body: "Login, investor password and server details arrive by email and live on the credentials screen.",
    doneNote: "Login details ready",
    href: "/trading-credentials",
    cta: "View credentials",
  },
  {
    id: "firstTrade",
    title: "First trade placed",
    body: "Open the order ticket and place your first order to get the evaluation clock running.",
    doneNote: "First order is in",
    href: "/order-ticket",
    cta: "Open order ticket",
  },
];

export function JourneyChecklist({ className }: { className?: string }) {
  // R2-W3-01 — one KYC/provisioning/payout event updates this checklist
  // together with the dashboard card and provisioning page.
  useLifecycleLog();
  const done = useJourneyDone();
  const doneCount = journeySteps.filter((s) => done[s.id]).length;

  return (
    <ol
      className={cn("space-y-1.5", className)}
      aria-label={`Journey progress — ${doneCount} of ${journeySteps.length} steps complete`}
    >
      {journeySteps.map((s, i) => {
        const isDone = done[s.id];
        return (
          <li
            key={s.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              isDone
                ? "border-success/30 bg-success/5"
                : "border-surface-container-high bg-surface-container-lowest",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                isDone
                  ? "border-success bg-success text-white"
                  : "border-outline/40 text-[10px] font-bold text-on-surface-variant",
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isDone ? "text-on-surface-variant" : "text-on-surface",
                )}
              >
                {isDone ? <span className="sr-only">Done: </span> : null}
                {s.title}
              </p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {isDone ? s.doneNote : s.body}
              </p>
            </div>
            {!isDone ? (
              <Link
                href={s.href}
                className="mt-0.5 flex shrink-0 items-center gap-0.5 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                {s.cta}
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
