"use client";

/**
 * R13 P1-1 — Announcements store.
 *
 * The announcements screen previously mutated component `useState`, so a
 * published announcement evaporated on reload while the toast claimed it
 * "is now visible to …". This store gives publish/expire a persisted
 * write path plus an audit row, matching the proven pattern used by
 * feature-flags / incidents / deployments.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  scope: string;
  severity: "info" | "warning" | "critical";
  status: "draft" | "scheduled" | "visible" | "expired";
  start: string;
  end: string;
}

const STORAGE_KEY = "pfaas:platform-admin:announcements";

const SEED: Announcement[] = [
  { id: "AN-001", title: "Platform maintenance window", message: "Scheduled maintenance on Saturday 2:00-4:00 UTC. Trading continues. New purchases temporarily unavailable.", scope: "All tenants", severity: "warning", status: "scheduled", start: "in 2d", end: "in 2d 2h" },
  { id: "AN-002", title: "New AI Insights module available", message: "AI Insights is now available for all Scale and Enterprise plans. Enable it in Settings → Modules.", scope: "All tenants", severity: "info", status: "visible", start: "3d ago", end: "in 11d" },
  { id: "AN-003", title: "MT5 Bridge degraded", message: "MT5 Bridge latency is elevated. We are investigating. Trading is unaffected.", scope: "Alpha Capital, Beta Trading", severity: "critical", status: "visible", start: "12m ago", end: "—" },
  { id: "AN-004", title: "v1.8.0 released", message: "New dashboard widgets, improved payout workflow, and trader-personal dashboard. See changelog.", scope: "All tenants", severity: "info", status: "expired", start: "5d ago", end: "2d ago" },
];

function load(): Announcement[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Announcement[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: Announcement[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let announcements: Announcement[] = load();

export function listAnnouncements(): Announcement[] {
  return announcements;
}

/** Publish a new announcement (persists + audits). */
export function publishAnnouncement(
  input: { title: string; message: string; scope: string; severity?: Announcement["severity"] },
  actor = "operator",
): Announcement {
  const ann: Announcement = {
    id: `AN-${Date.now().toString(36).toUpperCase()}`,
    title: input.title,
    message: input.message,
    scope: input.scope,
    severity: input.severity ?? "info",
    status: "visible",
    start: "just now",
    end: "in 7d",
  };
  announcements = [ann, ...announcements];
  persist(announcements);
  recordAudit({
    actor,
    action: "announcement.publish",
    target: ann.id,
    detail: `Published "${ann.title}" to ${ann.scope}`,
    severity: ann.severity === "critical" ? "critical" : "info",
  });
  emit();
  return ann;
}

/** Expire a visible announcement (persists + audits). */
export function expireAnnouncement(id: string, actor = "operator"): Announcement | undefined {
  const target = announcements.find((a) => a.id === id);
  if (!target) return undefined;
  announcements = announcements.map((a) =>
    a.id === id ? { ...a, status: "expired" as const, end: "just now" } : a,
  );
  persist(announcements);
  recordAudit({
    actor,
    action: "announcement.expire",
    target: id,
    detail: `Expired "${target.title}" — no longer visible to ${target.scope}`,
    severity: "warning",
  });
  emit();
  return announcements.find((a) => a.id === id);
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to announcement mutations. */
export function useAnnouncementsVersion(): number {
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
