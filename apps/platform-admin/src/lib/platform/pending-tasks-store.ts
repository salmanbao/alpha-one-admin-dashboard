"use client";

/**
 * R13 P1-1 — Pending Tasks store.
 *
 * The operations inbox was inert: "Mark all as reviewed" fired a toast and
 * marked nothing, while the page rendered a literal "No pending tasks"
 * beneath a list of five tasks. Tasks now persist, "Take action" navigates
 * to the surface that resolves them, and review/dismiss write an audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type TaskCategory = "billing" | "approval" | "security" | "compliance" | "operations";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in-progress" | "blocked" | "reviewed";

export interface PendingTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  /** View id the "Take action" button navigates to. */
  route: string;
}

const STORAGE_KEY = "pfaas:platform-admin:pending-tasks";

const SEED: PendingTask[] = [
  { id: "task-1", title: "Review pending invoices", description: "3 invoices require approval before the billing cycle closes.", category: "billing", priority: "high", dueDate: "2025-12-15", status: "pending", route: "platform-billing" },
  { id: "task-2", title: "User access review", description: "2 users have pending access requests that need approval.", category: "security", priority: "urgent", dueDate: "2025-12-10", status: "pending", route: "security-overview" },
  { id: "task-3", title: "Module catalog sync", description: "Module catalog needs synchronization with the central registry.", category: "compliance", priority: "medium", dueDate: "2025-12-20", status: "pending", route: "module-catalog" },
  { id: "task-4", title: "Feature flags audit", description: "Review recently created feature flags for compliance.", category: "compliance", priority: "low", dueDate: "2025-12-25", status: "in-progress", route: "feature-flags" },
  { id: "task-5", title: "Backup verification", description: "Verify recent backups are complete and restorable.", category: "operations", priority: "high", dueDate: "2025-12-12", status: "pending", route: "backups-dr" },
];

function load(): PendingTask[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingTask[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: PendingTask[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let tasks: PendingTask[] = load();

/** Open (unreviewed) tasks only — what the inbox headline counts. */
export function listOpenTasks(): PendingTask[] {
  return tasks.filter((t) => t.status !== "reviewed");
}

/** Full history including reviewed tasks (for an audit-friendly view). */
export function listAllTasks(): PendingTask[] {
  return tasks;
}

/** Mark a task in-progress when the operator takes action on it. */
export function startTask(id: string, actor = "operator"): PendingTask | undefined {
  const target = tasks.find((t) => t.id === id);
  if (!target || target.status === "reviewed") return undefined;
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: "in-progress" as const } : t));
  persist(tasks);
  recordAudit({
    actor,
    action: "task.start",
    target: id,
    detail: `Opened "${target.title}" (${target.category}) — routed to ${target.route}`,
    severity: "info",
  });
  emit();
  return tasks.find((t) => t.id === id);
}

/** Mark a single task reviewed (persists + audits). */
export function reviewTask(id: string, actor = "operator"): PendingTask | undefined {
  const target = tasks.find((t) => t.id === id);
  if (!target) return undefined;
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: "reviewed" as const } : t));
  persist(tasks);
  recordAudit({
    actor,
    action: "task.review",
    target: id,
    detail: `Reviewed "${target.title}"`,
    severity: "info",
  });
  emit();
  return tasks.find((t) => t.id === id);
}

/** Mark every open task reviewed — returns how many were cleared. */
export function reviewAllTasks(actor = "operator"): number {
  const open = tasks.filter((t) => t.status !== "reviewed");
  if (open.length === 0) return 0;
  tasks = tasks.map((t) => (t.status === "reviewed" ? t : { ...t, status: "reviewed" as const }));
  persist(tasks);
  recordAudit({
    actor,
    action: "task.review_all",
    target: "pending-tasks",
    detail: `Cleared ${open.length} pending task(s) from the operations inbox`,
    severity: "info",
  });
  emit();
  return open.length;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to task mutations. */
export function usePendingTasksVersion(): number {
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
