"use client";

/**
 * Competition notifications → inbox projection (R6, extended R7 I3).
 *
 * Two sources, one write path (`pushInboxMessage`, deduped by id):
 *
 *   lifecycle   competition.joined / competition.prize-claimed events
 *               emitted by competitions-store — projected to messages
 *               with deterministic ids (`inbox:<event-id>:…`).
 *               Plus operator events from prop-admin's competitions
 *               store (R7 I3): competition.created → "Registration
 *               open: …", competition.updated with change
 *               "registration-opened" → the same, competition.finished
 *               → "Results declared: …" (podium summary).
 *   scheduled   deterministic milestone notices derived from the
 *               competitions catalog (fixtures + operator rows) on every
 *               mount: a competition starting within 24h, an active
 *               competition on its final day, and an ended competition
 *               whose results settled within the last 7 days
 *               (claim-window reminder).
 *
 * Reads the competitions store; the store never imports this module, so
 * there is no store ↔ notices cycle. Ids are deterministic, so a notice
 * pushed on mount stays idempotent across reloads — and a message the
 * user deleted never resurrects (pushInboxMessage guards that).
 */

import { useEffect } from "react";
import { useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import { claimWindowEndsAt, prizeTierFor } from "@/lib/fixtures/terra-fixtures";
import { catalogCompetitions } from "@/lib/competitions-catalog";
import { claimFor, useCompetitions } from "@/lib/competitions-store";
import { pushInboxMessage, type InboxMessage } from "./inbox-store";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Defensive read of a field on the event's projected competition. */
function projectedField(e: LifecycleEvent, field: string): unknown {
  const c = e.payload?.competition;
  return c && typeof c === "object" ? (c as Record<string, unknown>)[field] : undefined;
}

function mapEvent(e: LifecycleEvent): InboxMessage | null {
  const id = String(e.payload?.competitionId ?? e.entity.id);
  const name = String(e.payload?.name ?? "competition");
  switch (e.name) {
    case "competition.joined":
      return {
        id: `inbox:${e.id}:joined`,
        subject: `You joined ${name}`,
        body: `You're entered in ${name}. Standings refresh live in the competition hub — final results settle after the last candle (Demo standings).`,
        category: "Competitions",
        sender: "Competitions Team",
        at: e.at,
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${id}`,
      };
    case "competition.prize-claimed": {
      const prize = String(e.payload?.prize ?? "your prize");
      const placement = e.payload?.placement;
      return {
        id: `inbox:${e.id}:prize-claimed`,
        subject: `Prize claimed — ${prize}`,
        body: `Your ${prize} for finishing #${
          typeof placement === "number" ? placement : ""
        } in ${name} has been claimed (Demo). Shipping details received — you'll get a notification when it leaves the warehouse.`,
        category: "Competitions",
        sender: "Competitions Team",
        at: e.at,
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${id}`,
      };
    }
    case "competition.created": {
      // An operator create only announces entry when registration is open.
      if (e.payload?.registrationOpen === false) return null;
      return {
        id: `inbox:${e.id}:created`,
        subject: `Registration open: ${name}`,
        body: registrationBody(name, e, "Registration for"),
        category: "Competitions",
        sender: "Competitions Team",
        at: e.at,
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${id}`,
      };
    }
    case "competition.updated": {
      if (e.payload?.change !== "registration-opened") return null;
      return {
        id: `inbox:${e.id}:reg-open`,
        subject: `Registration open: ${name}`,
        body: registrationBody(name, e, "Registration reopened for"),
        category: "Competitions",
        sender: "Competitions Team",
        at: e.at,
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${id}`,
      };
    }
    case "competition.finished": {
      const podium = Array.isArray(e.payload?.podium) ? (e.payload.podium as unknown[]) : [];
      const summary = podium
        .flatMap((p) => {
          if (!p || typeof p !== "object") return [];
          const o = p as Record<string, unknown>;
          return typeof o.rank === "number" && typeof o.trader === "string"
            ? [`#${o.rank} ${o.trader}`]
            : [];
        })
        .slice(0, 3)
        .join(" · ");
      return {
        id: `inbox:${e.id}:finished`,
        subject: `Results declared: ${name}`,
        body: summary
          ? `Final standings for ${name}: ${summary} (Demo). Cash prizes settle within 5 business days — the claim window runs 14 days from settlement.`
          : `Results for ${name} are declared — no qualified standings this time (Demo).`,
        category: "Competitions",
        sender: "Competitions Team",
        at: e.at,
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${id}`,
      };
    }
    default:
      return null;
  }
}

/** Shared copy for create/reopen registration notices (cap + headline). */
function registrationBody(name: string, e: LifecycleEvent, lead: string): string {
  const cap = projectedField(e, "participantCap");
  const headline = projectedField(e, "prizeHeadline");
  const capText = typeof cap === "number" ? ` — capped at ${cap} participants` : "";
  const headlineText = typeof headline === "string" && headline ? ` (${headline})` : "";
  return `${lead} ${name}${capText}${headlineText}. Entry is free for eligible funded traders (Demo).`;
}

/** Deterministic milestone notices from the competitions catalog. */
function scheduledNotices(): InboxMessage[] {
  const now = Date.now();
  const out: InboxMessage[] = [];

  for (const c of catalogCompetitions()) {
    const startsIn = new Date(c.startsAt).getTime() - now;
    const endsIn = new Date(c.endsAt).getTime() - now;
    const sinceEnd = now - new Date(c.endsAt).getTime();

    if (c.status === "upcoming" && startsIn > 0 && startsIn <= DAY) {
      out.push({
        id: `inbox:cmp:${c.id}:starts-24h`,
        subject: `${c.name} starts within 24 hours`,
        body: `Registration for ${c.name} closes when the competition starts (${c.prizeHeadline}). Make sure your entry is confirmed before the opening candle (Demo).`,
        category: "Competitions",
        sender: "Competitions Team",
        at: new Date(now - 2 * HOUR).toISOString(),
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${c.id}`,
      });
    }

    if (c.status === "active" && endsIn > 0 && endsIn <= DAY) {
      out.push({
        id: `inbox:cmp:${c.id}:final-day`,
        subject: `${c.name} — final day`,
        body: `${c.name} ends today. Your standing and gap to the next rank are shown in the competition hub (Demo standings). Closed trades only — positions opened in the final hour may count at 50%.`,
        category: "Competitions",
        sender: "Competitions Team",
        at: new Date(now - HOUR).toISOString(),
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${c.id}`,
      });
    }

    if (
      c.status === "ended" &&
      sinceEnd >= 0 &&
      sinceEnd <= 7 * DAY &&
      c.placement &&
      prizeTierFor(c, c.placement)
    ) {
      out.push({
        id: `inbox:cmp:${c.id}:results-7d`,
        subject: `${c.name} results — claim your prize`,
        body: `You finished #${c.placement} in ${c.name} and won ${
          prizeTierFor(c, c.placement)!.label
        } (Demo standings). The claim window closes ${new Date(
          claimWindowEndsAt(c),
        ).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — submit your shipping address before then.`,
        category: "Competitions",
        sender: "Competitions Team",
        at: new Date(now - 3 * HOUR).toISOString(),
        read: false,
        actionType: "competition",
        actionHref: `/competitions/${c.id}`,
      });
    }
  }

  return out;
}

/**
 * Mount once in the app shell (beside `useInboxLifecycleBridge`).
 * Projects competition lifecycle events + scheduled milestones into the
 * inbox.
 */
export function useCompetitionNotices(): void {
  const events = useLifecycleLog();
  const { claims } = useCompetitions();

  useEffect(() => {
    for (const e of events) {
      if (e.entity.kind !== "competition") continue;
      const msg = mapEvent(e);
      if (msg) pushInboxMessage(msg);
    }
    for (const msg of scheduledNotices()) pushInboxMessage(msg);
    // `claims` only matters so a freshly-claimed prize stops re-reading
    // as claimable; the claim event itself already produced its message.
  }, [events, claims]);
}
