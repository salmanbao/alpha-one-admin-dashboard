import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import {
  claimWindowEndsAt,
  competitions,
  prizeTierFor,
} from "@/lib/fixtures/terra-fixtures";

/**
 * Competitions store v2 — enrollment + prize claims (R6 competitions hub).
 *
 * One object, one write path (house rule R10): join, leave and claim all
 * persist to `pfaas:trader:competitions` and emit a lifecycle event, so a
 * refresh never loses an entry and prop-admin/inbox consumers can read the
 * same transitions from the shared log.
 *
 * The v1 shape `{ joined: string[] }` is migrated on read.
 */

export interface CompetitionEntry {
  competitionId: string;
  joinedAt: string;
}

export interface PrizeClaimShipping {
  name: string;
  phone: string;
  address1: string;
  city: string;
  country: string;
}

export interface PrizeClaim {
  competitionId: string;
  status: "unclaimed" | "claimed" | "shipped";
  claimedAt?: string;
  shipping?: PrizeClaimShipping;
}

export interface CompetitionsState {
  entries: CompetitionEntry[];
  claims: PrizeClaim[];
}

const STORAGE_KEY = "pfaas:trader:competitions";
const SERVER_SNAPSHOT: CompetitionsState = { entries: [], claims: [] };

/** v1 `{ joined: string[] }` → v2 `{ entries, claims }` (one-time on read). */
function migrate(parsed: unknown): CompetitionsState {
  if (!parsed || typeof parsed !== "object") return SERVER_SNAPSHOT;
  const raw = parsed as Partial<CompetitionsState> & { joined?: unknown };
  const entries: CompetitionEntry[] = Array.isArray(raw.entries)
    ? raw.entries.filter(
        (e): e is CompetitionEntry =>
          !!e && typeof e.competitionId === "string" && typeof e.joinedAt === "string",
      )
    : Array.isArray(raw.joined)
      ? raw.joined
          .filter((id): id is string => typeof id === "string")
          .map((competitionId) => ({
            competitionId,
            joinedAt: new Date().toISOString(),
          }))
      : [];
  const claims: PrizeClaim[] = Array.isArray(raw.claims)
    ? raw.claims.filter(
        (c): c is PrizeClaim =>
          !!c &&
          typeof c.competitionId === "string" &&
          (c.status === "unclaimed" || c.status === "claimed" || c.status === "shipped"),
      )
    : [];
  return { entries, claims };
}

let state: CompetitionsState = (() => {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SERVER_SNAPSHOT;
    return migrate(JSON.parse(raw));
  } catch {
    return SERVER_SNAPSHOT;
  }
})();

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
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

/** Whole state (entries + claims) — subscribe with this in components. */
export function useCompetitions(): CompetitionsState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as CompetitionsState;
}

/** Non-reactive read — call `useCompetitions()` in the component first. */
export function isJoined(competitionId: string): boolean {
  return state.entries.some((e) => e.competitionId === competitionId);
}

/** Non-reactive read — call `useCompetitions()` in the component first. */
export function claimFor(competitionId: string): PrizeClaim | undefined {
  return state.claims.find((c) => c.competitionId === competitionId);
}

export type JoinResult = { ok: true } | { ok: false; reason: string };

/**
 * Join a competition. Refuses honestly (never a silent success) when the
 * competition is unknown, ended, past its registration deadline, or full.
 */
export function joinCompetition(competitionId: string): JoinResult {
  const c = competitions.find((x) => x.id === competitionId);
  if (!c) return { ok: false, reason: "That competition no longer exists." };
  if (isJoined(competitionId)) return { ok: true };

  const now = Date.now();
  if (c.status === "ended" || now > new Date(c.endsAt).getTime()) {
    return { ok: false, reason: "This competition has already ended." };
  }
  if (
    c.registrationClosesAt &&
    now > new Date(c.registrationClosesAt).getTime()
  ) {
    return { ok: false, reason: "Registration has closed for this competition." };
  }
  if (c.participantCap && c.participants >= c.participantCap) {
    return {
      ok: false,
      reason: `Full — this competition is capped at ${c.participantCap.toLocaleString()} participants.`,
    };
  }

  state = {
    ...state,
    entries: [...state.entries, { competitionId, joinedAt: new Date().toISOString() }],
  };
  persist();
  emit();
  emitLifecycle({
    entity: { kind: "competition", id: competitionId },
    name: "competition.joined",
    actor: "trader",
    payload: { competitionId, name: c.name },
  });
  return { ok: true };
}

/** Leave a competition (no-op when not joined). */
export function leaveCompetition(competitionId: string): void {
  if (!isJoined(competitionId)) return;
  state = {
    ...state,
    entries: state.entries.filter((e) => e.competitionId !== competitionId),
  };
  persist();
  emit();
  emitLifecycle({
    entity: { kind: "competition", id: competitionId },
    name: "competition.left",
    actor: "trader",
    payload: { competitionId },
  });
}

export type ClaimResult = { ok: true; claim: PrizeClaim } | { ok: false; reason: string };

/**
 * Claim the prize for an ended competition the demo trader placed inside
 * a prize tier. The 14-day claim window (fixture contract) is enforced
 * honestly — an expired window returns a reason, never a hidden button.
 */
export function claimPrize(
  competitionId: string,
  shipping: PrizeClaimShipping,
): ClaimResult {
  const c = competitions.find((x) => x.id === competitionId);
  if (!c) return { ok: false, reason: "That competition no longer exists." };
  if (c.status !== "ended") {
    return { ok: false, reason: "Prizes can only be claimed after a competition ends." };
  }
  const existing = claimFor(competitionId);
  if (existing?.status === "claimed") {
    return { ok: false, reason: "This prize has already been claimed." };
  }
  if (existing?.status === "shipped") {
    return { ok: false, reason: "This prize has already shipped." };
  }
  if (Date.now() > new Date(claimWindowEndsAt(c)).getTime()) {
    return { ok: false, reason: "The claim window for this prize has closed." };
  }
  const placement = c.placement;
  if (!placement) {
    return { ok: false, reason: "You did not finish inside a prize tier." };
  }
  const tier = prizeTierFor(c, placement);
  if (!tier) {
    return { ok: false, reason: "You did not finish inside a prize tier." };
  }

  const claim: PrizeClaim = {
    competitionId,
    status: "claimed",
    claimedAt: new Date().toISOString(),
    shipping,
  };
  state = {
    ...state,
    claims: [
      ...state.claims.filter((x) => x.competitionId !== competitionId),
      claim,
    ],
  };
  persist();
  emit();
  emitLifecycle({
    entity: { kind: "competition", id: competitionId },
    name: "competition.prize-claimed",
    actor: "trader",
    payload: {
      competitionId,
      name: c.name,
      placement,
      prize: tier.label,
      kind: tier.kind,
    },
  });
  return { ok: true, claim };
}
