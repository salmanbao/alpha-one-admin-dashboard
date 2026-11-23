"use client";

/**
 * Dunning & subscription state store — P1-2.
 * One audit stream, one state model, honest "(Demo)" labels.
 * Persists under `pfaas:platform-admin:dunning`.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { readTenants } from "@/lib/platform/tenant-store";

const STORAGE_KEY = "pfaas:platform-admin:dunning";

export type DunningStatus =
  | "normal"
  | "pastDue"
  | "overdue"
  | "suspended"
  | "cancelled";

export interface DunningRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  status: DunningStatus;
  daysOverdue: number;
  lastReminderAt: string;
  nextAction: "none" | "remind" | "suspend" | "finalNotice";
  suspensionDueAt?: string;
}

/**
 * Legacy rows stored the tenant NAME in `tenantId`; normalize to the
 * real tenant id on read so `useDunningForTenant(tenant.id)` and the
 * invoices↔dunning join on the billing page actually match (P0-3).
 */
function normalizeTenantKey(r: DunningRecord): DunningRecord {
  if (!r || typeof r.tenantId !== "string") return r;
  const roster = readTenants();
  if (roster.some((t) => t.id === r.tenantId)) return r;
  const byName = roster.find((t) => t.name === r.tenantId);
  return byName ? { ...r, tenantId: byName.id } : r;
}

const SEED_RECORDS: DunningRecord[] = [
  {
    id: "dun-1",
    tenantId: "tenant-beta",
    tenantName: "Beta Trading",
    invoiceId: "inv-2",
    invoiceNumber: "INV-2026-11-002",
    amount: 1925,
    status: "pastDue",
    daysOverdue: 7,
    lastReminderAt: "2026-11-10",
    nextAction: "remind",
  },
  {
    id: "dun-2",
    tenantId: "tenant-gamma",
    tenantName: "Gamma Futures",
    invoiceId: "inv-3",
    invoiceNumber: "INV-2026-11-003",
    amount: 4900,
    status: "overdue",
    daysOverdue: 14,
    lastReminderAt: "2026-11-05",
    nextAction: "suspend",
    suspensionDueAt: "2026-11-20",
  },
];

function readRaw(): DunningRecord[] {
  if (typeof window === "undefined") return SEED_RECORDS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY ?? "null") ?? "[]");
    return stored
      .filter(
        (r): r is DunningRecord => 
          !!r && 
          typeof r === "object" && 
          typeof r.id === "string" && 
          typeof r.tenantId === "string"
      )
      .map(normalizeTenantKey);
  } catch {
    return SEED_RECORDS;
  }
}

function writeRaw(next: DunningRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
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
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(SEED_RECORDS);
}

export function readDunningRecords(): DunningRecord[] {
  return readRaw();
}

export function getDunningRecord(id: string): DunningRecord | undefined {
  return readRaw().find((r) => r.id === id);
}

export function useDunningRecords(): DunningRecord[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as DunningRecord[];
}

export function useDunningForTenant(tenantId: string): DunningRecord | undefined {
  return useDunningRecords().find((r) => r.tenantId === tenantId);
}

export function escalateDunning(id: string): { title: string; description: string } {
  const records = readRaw();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Dunning record not found." };
  }
  const record = records[idx];
  let nextStatus: DunningStatus;
  let nextAction: "none" | "remind" | "suspend" | "finalNotice";
  let suspensionDueAt: string | undefined;

  switch (record.status) {
    case "normal":
      nextStatus = "pastDue";
      nextAction = "remind";
      break;
    case "pastDue":
      nextStatus = "overdue";
      nextAction = "suspend";
      break;
    case "overdue":
      nextStatus = "suspended";
      nextAction = "finalNotice";
      suspensionDueAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      break;
    case "suspended":
      nextStatus = "cancelled";
      nextAction = "none";
      break;
    case "cancelled":
      nextStatus = "cancelled";
      nextAction = "none";
      break;
  }

  const next = records.map((r, i) => {
    if (i === idx) {
      return {
        ...r,
        status: nextStatus,
        daysOverdue: nextStatus === "suspended" ? 30 : r.daysOverdue,
        lastReminderAt: new Date().toISOString(),
        nextAction,
        suspensionDueAt,
      };
    }
    return r;
  });

  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: `dunning.${record.status}_escalated_to_${nextStatus}`,
    target: record.tenantId,
    severity: "warning",
    detail: `Dunning escalated from ${record.status} to ${nextStatus} for invoice ${record.invoiceNumber}.`,
  });

  return {
    title: `Dunning escalated to ${nextStatus}`,
    description: `Dunning for ${record.tenantName} escalated from ${record.status} to ${nextStatus}: ${record.amount}.`,
  };
}

export function sendReminder(id: string): { title: string; description: string } {
  const records = readRaw();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Dunning record not found." };
  }
  const record = records[idx];
  const next = [...records];
  next[idx] = {
    ...record,
    lastReminderAt: new Date().toISOString(),
    nextAction: record.status === "overdue" ? "suspend" : "remind",
  };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "dunning.reminder_sent",
    target: record.tenantId,
    severity: "info",
    detail: `Reminder sent for invoice ${record.invoiceNumber} (${record.daysOverdue}d overdue).`,
  });
  return {
    title: "Reminder sent",
    description: `Reminder sent for invoice ${record.invoiceNumber} (${record.daysOverdue}d overdue).`,
  };
}

export function suspendTenant(id: string, reason: string): { title: string; description: string } {
  const records = readRaw();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Dunning record not found." };
  }
  const record = records[idx];
  const next = [...records];
  next[idx] = {
    ...record,
    status: "suspended",
    daysOverdue: 30,
    lastReminderAt: new Date().toISOString(),
    nextAction: "finalNotice",
    suspensionDueAt: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "dunning.tenant_suspended",
    target: record.tenantId,
    severity: "critical",
    detail: `Tenant ${record.tenantName} suspended for non-payment: invoice ${record.invoiceNumber} ${record.amount}. Reason: ${reason}.`,
  });
  return {
    title: "Tenant suspended",
    description: `Tenant ${record.tenantName} suspended for non-payment: invoice ${record.invoiceNumber} ${record.amount}. Reason: ${reason}.`,
  };
}

export function reinstateTenant(id: string): { title: string; description: string } {
  const records = readRaw();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Dunning record not found." };
  }
  const record = records[idx];
  const next = [...records];
  next[idx] = {
    ...record,
    status: "normal",
    daysOverdue: 0,
    lastReminderAt: "",
    nextAction: "none",
    suspensionDueAt: undefined,
  };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "dunning.tenant_reinstated",
    target: record.tenantId,
    severity: "info",
    detail: `Tenant ${record.tenantName} reinstated after suspension.`,
  });
  return {
    title: "Tenant reinstated",
    description: `Tenant ${record.tenantName} reinstated after suspension.`,
  };
}