"use client";

/**
 * Competition notifications → inbox projection (R6).
 *
 * Two sources, one write path (`pushInboxMessage`, deduped by id):
 *
 *   lifecycle   competition.joined / competition.prize-claimed events
 *               emitted by competitions-store — projected to messages
 *               with deterministic ids (`inbox:<event-id>:…`).
 *   scheduled   deterministic milestone notices derived from the fixture
 *               calendar on every mount: a competition starting within
 *               24h, an active competition on its final day, and an
 *               ended competition whose results settled within the last
 *               7 days (claim-window reminder).
 *
 * Reads the competitions store; the store never imports this module, so
 * there is no store ↔ notices cycle. Ids are deterministic, so a notice
 * pushed on mount stays idempotent across reloads — and a message the
 * user deleted never resurrects (pushInboxMessage guards that).
 */

import { useEffect } from "react";
import { useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import {
  claimWindowEndsAt,
  competitions,
  prizeTierFor,
} from "@/lib/fixtures/terra-fixtures";
import { claimFor, useCompetitions } from "@/lib/competitions-store";
import { pushInboxMessage, type InboxMessage } from "./inbox-store";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

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
    default:
      return null;
  }
}

/** Deterministic milestone notices from the fixture calendar. */
function scheduledNotices(): InboxMessage[] {
  const now = Date.now();
  const out: InboxMessage[] = [];

  for (const c of competitions) {
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
