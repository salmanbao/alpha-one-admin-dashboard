"use client";

import { useEffect, useState } from "react";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoAnnouncementsSchema } from "@/lib/platform/validation";

/**
 * Session-scoped announcement store (PRD §4.5 announcements table,
 * §4.17 Announcements CRUD endpoints).
 *
 * An announcement is an in-app message shown to traders: type, audience
 * targeting, optional publish/expiration windows and a pinned flag.
 * CRUD from the admin Announcements page mutates this store so the list,
 * status badges and KPI cards stay in sync across dialog round-trips.
 */

export type AnnouncementType = "info" | "warning" | "success" | "maintenance";
export type AnnouncementAudience = "all" | "active" | "funded" | "challenge";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "expired";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  /** Only set when audience === "challenge" (PRD target_challenge_id) */
  targetChallenge?: string;
  /** ISO datetime; empty/undefined = draft (never scheduled) */
  publishedAt?: string;
  /** ISO datetime; undefined = never expires */
  expiresAt?: string;
  pinned: boolean;
  /** Mock reach counter */
  impressions: number;
  createdAt: string;
}

const seed: Announcement[] = [
  {
    id: "ann-301",
    title: "Scheduled maintenance — FIX bridge failover",
    content:
      "Trading on MatchTrader will pause for 15 minutes on Saturday 23:00 UTC while we fail over the FIX bridge. Open positions are unaffected.",
    type: "maintenance",
    audience: "all",
    publishedAt: "2026-10-26T09:00:00.000Z",
    expiresAt: "2026-10-28T23:59:00.000Z",
    pinned: true,
    impressions: 4820,
    createdAt: "2026-10-25T15:10:00.000Z",
  },
  {
    id: "ann-302",
    title: "New payout method: USDT (TRC-20)",
    content:
      "Funded traders can now request payouts via USDT on the Tron network with a $0 fee and same-day processing.",
    type: "success",
    audience: "funded",
    publishedAt: "2026-10-24T12:00:00.000Z",
    pinned: false,
    impressions: 612,
    createdAt: "2026-10-24T10:02:00.000Z",
  },
  {
    id: "ann-303",
    title: "Drawdown rule clarification for Phase 2",
    content:
      "Reminder: trailing max drawdown is calculated from the highest equity point, not the starting balance. Review the rules before your next trade.",
    type: "warning",
    audience: "challenge",
    targetChallenge: "2-Step Evaluation $50K",
    publishedAt: "2026-10-27T07:30:00.000Z",
    pinned: false,
    impressions: 1340,
    createdAt: "2026-10-26T18:45:00.000Z",
  },
  {
    id: "ann-304",
    title: "Black Friday challenge pricing — 30% off",
    content:
      "All challenge account sizes will be 30% off from November 24–30. Watch this space for the coupon code.",
    type: "info",
    audience: "all",
    publishedAt: "2026-11-23T00:00:00.000Z",
    pinned: false,
    impressions: 0,
    createdAt: "2026-10-26T08:00:00.000Z",
  },
  {
    id: "ann-305",
    title: "Newsletter: October performance report",
    content: "Draft: monthly stats, top traders and upcoming feature releases.",
    type: "info",
    audience: "active",
    pinned: false,
    impressions: 0,
    createdAt: "2026-10-27T05:20:00.000Z",
  },
  {
    id: "ann-306",
    title: "EA trading now allowed on 1-Step Fast Track",
    content:
      "Following trader feedback, Expert Advisors are permitted on the 1-Step Fast Track challenge with no lot restrictions.",
    type: "info",
    audience: "challenge",
    targetChallenge: "1-Step Fast Track $25K",
    publishedAt: "2026-10-20T09:00:00.000Z",
    expiresAt: "2026-10-26T09:00:00.000Z",
    pinned: false,
    impressions: 2110,
    createdAt: "2026-10-19T16:30:00.000Z",
  },
];

const announcements = new Map<string, Announcement>(seed.map((a) => [a.id, a]));
// Rehydrate the effective list from a previous visit (demo persistence).
// Full replace (not merge): a deleted announcement must stay deleted.
// `seed` is the fallback, so a missing/corrupt key reseeds the map.
{
  const persisted = loadDemoState("announcements", demoAnnouncementsSchema, seed);
  announcements.clear();
  for (const a of persisted) announcements.set(a.id, a);
}
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  saveDemoState("announcements", Array.from(announcements.values()));
  listeners.forEach((l) => l());
}

/** Derived lifecycle status (PRD: draft → scheduled → published → expired). */
export function announcementStatus(a: Announcement, now = Date.now()): AnnouncementStatus {
  if (!a.publishedAt) return "draft";
  if (new Date(a.publishedAt).getTime() > now) return "scheduled";
  if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return "expired";
  return "published";
}

/** All announcements, pinned first then newest first. */
export function getAnnouncements(): Announcement[] {
  return Array.from(announcements.values()).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

export function getAnnouncement(id: string): Announcement | undefined {
  return announcements.get(id);
}

/** Fields required to create an update payload; counters/timestamps are preserved on edit. */
export type AnnouncementInput = Omit<Announcement, "impressions" | "createdAt"> & {
  impressions?: number;
  createdAt?: string;
};

/** Create (no id / unknown id) or update an announcement (PRD POST + PATCH). */
export function saveAnnouncement(input: AnnouncementInput): Announcement {
  const existing = input.id ? announcements.get(input.id) : undefined;
  const record: Announcement = existing
    ? {
        ...existing,
        ...input,
        id: existing.id,
        impressions: existing.impressions,
        createdAt: existing.createdAt,
      }
    : {
        ...input,
        id: input.id || `ann-${Date.now()}`,
        impressions: input.impressions ?? 0,
        createdAt: input.createdAt ?? new Date().toISOString(),
      };
  announcements.set(record.id, record);
  emit();
  return record;
}

/** Delete an announcement (PRD DELETE /announcements/:id). */
export function deleteAnnouncement(id: string): void {
  if (announcements.delete(id)) emit();
}

/** Pin / unpin toggle (PRD is_pinned). */
export function toggleAnnouncementPin(id: string): void {
  const a = announcements.get(id);
  if (!a) return;
  announcements.set(id, { ...a, pinned: !a.pinned });
  emit();
}

/** Subscribe the calling component to store mutations. */
export function useAnnouncementVersion(): number {
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
