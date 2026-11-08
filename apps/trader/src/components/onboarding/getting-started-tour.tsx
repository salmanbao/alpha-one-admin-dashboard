"use client";

/**
 * Getting Started Tour — audit #3 fix #6, reworked by SF-02.
 *
 * Was a manually-toggled four-item checklist (KYC → challenge → rules →
 * payout) that nothing ever completed for you. It is now the
 * dismissible dashboard card around the state-driven JourneyChecklist:
 * Purchased → Verified → Provisioned → Credentialed → First trade —
 * every tick read from @/lib/onboarding/journey-store (real store
 * state, not taps).
 *
 * This card owns only the chrome: dismiss / "Reopen guide" pill and the
 * progress header. The list itself is shared with purchase-completed
 * via <JourneyChecklist /> so the two surfaces can never disagree.
 *
 * Dismissal persists in localStorage under the original key
 * (terra.getting-started.v1) so an existing dismissal is honoured.
 *
 * Hydration: `hydrated` flips true only after mount (server + the
 * hydration pass both render null), so SSR markup and the first client
 * render are identical — the previous `typeof window` guard produced
 * different output during hydration. Both stores are called
 * unconditionally before any early return (hooks rules).
 */

import { useSyncExternalStore } from "react";
import { TerraBadge, TerraCard } from "@/components/terra/terra-ui";
import { Compass, X } from "lucide-react";
import { useJourneyDone } from "@/lib/onboarding/journey-store";
import { JourneyChecklist, journeySteps } from "./journey-checklist";

const STORAGE_KEY = "terra.getting-started.v1";

interface TourState {
  dismissed: boolean;
}

const defaultState: TourState = { dismissed: false };

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

/* Hydration flag — server and hydration pass render null together. */
function subscribeNothing() {
  return () => {};
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function GettingStartedTour() {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
  const done = useJourneyDone();

  if (!hydrated) return null;

  const state = parseState(raw);

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

  const doneCount = journeySteps.filter((s) => done[s.id]).length;
  const allDone = doneCount === journeySteps.length;

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
          {doneCount}/{journeySteps.length}
        </TerraBadge>
      </div>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {allDone
          ? "Every step from purchase to first trade is done. Head to the dashboard to track your evaluation."
          : "Five steps from purchase to your first trade. Progress is read from your account state and saved on this device."}
      </p>
      <JourneyChecklist className="mt-3" />
    </TerraCard>
  );
}
