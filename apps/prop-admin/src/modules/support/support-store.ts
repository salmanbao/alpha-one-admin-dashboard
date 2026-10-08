"use client";

import { useEffect, useState } from "react";
import type { SupportTicket } from "@/lib/platform/mock-data";

/**
 * Session-scoped support ticket store.
 *
 * Resolve / Escalate / Reply actions from the ticket drawer mutate this
 * store; the tickets table, KPI strip and drawer all render from the
 * effective values so actions have observable effects instead of
 * toast-only feedback.
 */
const statusOverrides = new Map<string, "resolved" | "in-progress">();
const replyCounts = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Mark a ticket resolved for this session. */
export function resolveTicket(id: string) {
  statusOverrides.set(id, "resolved");
  emit();
}

/** Escalate a ticket (moves it to the in-progress Tier-2 state). */
export function escalateTicket(id: string) {
  statusOverrides.set(id, "in-progress");
  emit();
}

/** Record that an agent reply was posted to a ticket. */
export function appendTicketReply(id: string) {
  replyCounts.set(id, (replyCounts.get(id) ?? 0) + 1);
  emit();
}

/** Effective status of a ticket, honoring session actions. */
export function effectiveTicketStatus(
  t: Pick<SupportTicket, "id" | "status">,
): SupportTicket["status"] {
  const o = statusOverrides.get(t.id);
  return o ?? t.status;
}

/** Effective message count (seeded thread + in-session replies). */
export function effectiveTicketMessages(
  t: Pick<SupportTicket, "id" | "messages">,
): number {
  return t.messages + (replyCounts.get(t.id) ?? 0);
}

/** Subscribe the calling component to store mutations. */
export function useTicketVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
