"use client";

/**
 * Getting Started Tour — audit #3 fix #6 (trader first-use experience).
 *
 * New traders land on an empty dashboard with no orientation. This card
 * gives them a guided first-use checklist: verify identity → pick a
 * challenge → learn the rules → request a payout. Progress is stored in
 * localStorage (frontend-first, no backend), and the whole card can be
 * dismissed and re-opened from the sidebar-less header area via the
 * "Reopen guide" pill.
 *
 * Uses useSyncExternalStore (React's recommended pattern for external
 * stores like localStorage) so SSR/client hydration is safe and no
 * setState-in-effect is needed.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import { TerraBadge, TerraCard } from "@/components/terra/terra-ui";
import { Check, ChevronRight, Compass, X } from "lucide-react";

const STORAGE_KEY = "terra.getting-started.v1";

interface TourState {
  dismissed: boolean;
  done: Record<string, boolean>;
}

const STEPS = [
  {
    id: "kyc",
    title: "Verify your identity (KYC)",
    body: "Upload an ID document once payouts open. Takes a few minutes; most reviews finish within 24h.",
    href: "/kyc-onboarding",
    cta: "Start verification",
  },
  {
    id: "challenge",
    title: "Pick your first challenge",
    body: "Compare 1-step, 2-step, and instant-funding programs — profit targets, drawdown rules, and pricing side by side.",
    href: "/marketplace",
    cta: "Browse challenges",
  },
  {
    id: "rules",
    title: "Learn the evaluation rules",
    body: "Daily loss limit, max drawdown, minimum trading days, and the consistency rule — know them before your first trade.",
    href: "/rules",
    cta: "Read the rules",
  },
  {
    id: "payout",
    title: "Set up a payout method",
    body: "Add bank or crypto details ahead of time so your first profit split arrives without delays.",
    href: "/withdrawal-methods",
    cta: "Add payout method",
  },
] as const;

const defaultState: TourState = { dismissed: false, done: {} };

/* ------------------------------------------------------------------ */
/* External store: localStorage with same-tab change notifications     */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: the storage event fires in OTHER tabs when this
  // tab writes; same-tab writes go through notify() below.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getRawSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function parseState(raw: string): TourState {
  if (!raw) return defaultState;
  try {
    return { ...defaultState, ...(JSON.parse(raw) as Partial<TourState>) };
  } catch {
    return defaultState;
  }
}

function saveState(s: TourState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — tour just won't persist */
  }
  notify();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function GettingStartedTour() {
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
  const state = parseState(raw);

  // Avoid SSR/client markup mismatch — render nothing until hydrated
  // (server snapshot is "", which parses to defaultState with dismissed=false).
  if (raw === "" && typeof window === "undefined") return null;

  if (state.dismissed) {
    return (
      <button
        type="button"
        onClick={() => saveState({ ...state, dismissed: false })}
        className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Compass className="h-3.5 w-3.5" aria-hidden />
        Reopen getting-started guide
      </button>
    );
  }

  const doneCount = STEPS.filter((s) => state.done[s.id]).length;
  const allDone = doneCount === STEPS.length;

  const toggle = (id: string) => {
    saveState({ ...state, done: { ...state.done, [id]: !state.done[id] } });
  };

  const dismiss = () => {
    saveState({ ...state, dismissed: true });
  };

  return (
    <TerraCard className="relative overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss getting-started guide"
        className="absolute right-3 top-3 rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-headline font-semibold text-on-surface">
          {allDone ? "You're all set 🎉" : "Getting started"}
        </h3>
        <TerraBadge tone={allDone ? "success" : "primary"}>
          {doneCount}/{STEPS.length}
        </TerraBadge>
      </div>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {allDone
          ? "Everything on the checklist is done. Head to the dashboard to track your evaluation."
          : "Four steps to your first funded payout. Check items off as you go — progress is saved on this device."}
      </p>
      <ol className="mt-3 space-y-1.5">
        {STEPS.map((s, i) => {
          const done = Boolean(state.done[s.id]);
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                done ? "border-success/30 bg-success/5" : "border-surface-container-high bg-surface-container-lowest",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={done}
                aria-label={done ? `Mark "${s.title}" as not done` : `Mark "${s.title}" as done`}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-success bg-success text-white" : "border-outline/40 hover:border-primary",
                )}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", done ? "text-on-surface-variant line-through" : "text-on-surface")}>
                  {i + 1}. {s.title}
                </p>
                {!done ? <p className="mt-0.5 text-xs text-on-surface-variant">{s.body}</p> : null}
              </div>
              {!done ? (
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
    </TerraCard>
  );
}
