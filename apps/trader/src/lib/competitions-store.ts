import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";

export interface CompetitionsState {
  joined: string[];
}

const STORAGE_KEY = "pfaas:trader:competitions";
const SERVER_SNAPSHOT: CompetitionsState = { joined: [] };

let state: CompetitionsState = (() => {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SERVER_SNAPSHOT;
    const parsed = JSON.parse(raw) as CompetitionsState;
    return { joined: Array.isArray(parsed?.joined) ? parsed.joined : [] };
  } catch {
    return SERVER_SNAPSHOT;
  }
})();

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  return JSON.stringify(state);
}

function getServerSnapshot(): string {
  return JSON.stringify(SERVER_SNAPSHOT);
}

export function useCompetitions(): CompetitionsState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as CompetitionsState;
}

export function joinCompetition(competitionId: string): void {
  const next: CompetitionsState = {
    joined: state.joined.includes(competitionId)
      ? state.joined
      : [...state.joined, competitionId],
  };
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  emit();
  emitLifecycle({
    entity: { kind: "competition", id: competitionId },
    name: "competition.joined",
    actor: "trader",
    payload: { competitionId },
  });
}

export function leaveCompetition(competitionId: string): void {
  const next: CompetitionsState = {
    joined: state.joined.filter((id) => id !== competitionId),
  };
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  emit();
  emitLifecycle({
    entity: { kind: "competition", id: competitionId },
    name: "competition.left",
    actor: "trader",
    payload: { competitionId },
  });
}
