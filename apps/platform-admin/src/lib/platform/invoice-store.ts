"use client";

/**
 * Invoice entity store — P1-1.
 *
 * One ledger, one invoice generator, one audit stream, honest "(Demo)" labels.
 * Invoices are tenant-scoped and persist under pfaas:platform-admin:invoices.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { tenants as allTenants, getTenantTraders } from "@/lib/platform/mock-data";

const STORAGE_KEY = "pfaas:platform-admin:invoices";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "past due" | "disputed" | "cancelled";
  currency: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  discount?: number;
  notes?: string;
}

/** One row of the platform-level invoice ledger. */
export interface PlatformInvoice {
  id: string;
  tenant: string;
  amount: number;
  status: "paid" | "pending" | "past due" | "disputed";
  due: string;
  method: string;
}

/** Seed fixtures — one tenant gets 2–3 deterministic invoices per cycle. */
const SEED_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    tenantId: "Alpha Capital",
    tenantName: "Alpha Capital",
    invoiceNumber: "INV-2026-11-001",
    issueDate: "2026-11-01",
    dueDate: "2026-11-15",
    status: "sent",
    currency: "USD",
    lines: [
      { id: "l-1", description: "Starter subscription", quantity: 1, unitPrice: 890, amount: 890 },
      { id: "l-2", description: "API overage (2,400 calls)", quantity: 2400, unitPrice: 0.05, amount: 120 },
    ],
    subtotal: 1010,
    tax: Math.round(1010 * 0.18),
    total: Math.round(1010 * 1.18),
  },
  {
    id: "inv-2",
    tenantId: "Beta Trading",
    tenantName: "Beta Trading",
    invoiceNumber: "INV-2026-11-002",
    issueDate: "2026-11-01",
    dueDate: "2026-11-10",
    status: "past due",
    currency: "USD",
    lines: [
      { id: "l-3", description: "Growth subscription", quantity: 1, unitPrice: 1900, amount: 1900 },
      { id: "l-4", description: "Storage overage (50 GB)", quantity: 50, unitPrice: 0.5, amount: 25 },
    ],
    subtotal: 1925,
    tax: Math.round(1925 * 0.18),
    total: Math.round(1925 * 1.18),
  },
  {
    id: "inv-3",
    tenantId: "Gamma Futures",
    tenantName: "Gamma Futures",
    invoiceNumber: "INV-2026-11-003",
    issueDate: "2026-11-01",
    dueDate: "2026-11-20",
    status: "draft",
    currency: "USD",
    lines: [
      { id: "l-5", description: "Scale subscription", quantity: 1, unitPrice: 4900, amount: 4900 },
    ],
    subtotal: 4900,
    tax: Math.round(4900 * 0.18),
    total: Math.round(4900 * 1.18),
  },
];

function readSeedList(list: unknown): Invoice[] {
  if (!Array.isArray(list)) return SEED_INVOICES;
  return list.filter(
    (i): i is Invoice =>
      !!i &&
      typeof i === "object" &&
      typeof (i as Invoice).id === "string" &&
      typeof (i as Invoice).invoiceNumber === "string",
  );
}

function readRaw(): Invoice[] {
  if (typeof window === "undefined") return SEED_INVOICES;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY ?? "null") ?? "[]",
    );
    const persisted = readSeedList(stored);
    // Merge seed with persisted: persisted wins when its id matches seed
    const byId = new Map<string, Invoice>();
    for (const s of SEED_INVOICES) byId.set(s.id, { ...s });
    for (const p of persisted) byId.set(p.id, { ...byId.get(p.id) ?? {}, ...p });
    return [...byId.values()];
  } catch {
    return SEED_INVOICES;
  }
}

function writeRaw(next: Invoice[]): void {
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
  return JSON.stringify(SEED_INVOICES);
}

export function readInvoices(): Invoice[] {
  return readRaw();
}

export function getInvoice(id: string): Invoice | undefined {
  return readRaw().find((i) => i.id === id);
}

export function useInvoices(): Invoice[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as Invoice[];
}

/** Create a new invoice for a tenant. */
export function createInvoice(
  tenantId: string,
  overides?: Partial<Invoice>,
): { title: string; description: string; invoice: Invoice } {
  const invoices = readRaw();
  // Find the tenant
  const tenant = allTenants.find((t) => t.id === tenantId);
  if (!tenant) {
    return {
      title: "(Demo)",
      description: `Tenant ${tenantId} not found.`,
      invoice: {} as Invoice,
    };
  }

  // Generate invoice number based on current date cycle
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Count existing invoices for this tenant in this month
  const existingCount = invoices.filter(
    (i) => i.tenantId === tenantId && i.invoiceNumber.includes(`INV-${year}-${month}`),
  ).length;

  const invoiceNumber = `INV-${year}-${month}-${String(
    existingCount + 1,
  ).padStart(3, "0")}`;

  // Determine plan price and calculate line items
  const planPrice =
    tenant.plan === "enterprise"
      ? 12000
      : tenant.plan === "scale"
        ? 4900
        : tenant.plan === "growth"
          ? 1900
          : 890;

  const newInvoice: Invoice = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tenantId,
    tenantName: tenant.name,
    invoiceNumber,
    issueDate: now.toISOString().split("T")[0],
    dueDate: new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString().split("T")[0],
    status: "draft",
    currency: "USD",
    lines: [
      {
        id: `l-${Date.now()}`,
        description: `${tenant.plan} subscription`,
        quantity: 1,
        unitPrice: planPrice,
        amount: planPrice,
      },
    ],
    subtotal: planPrice,
    tax: Math.round(planPrice * 0.18),
    total: Math.round(planPrice * 1.18),
    notes: undefined,
    ...overides,
  };

  const next = [...invoices, newInvoice];
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "billing.invoice_created",
    target: tenantId,
    severity: "info",
    detail: `Invoice ${invoiceNumber} created for ${tenant.name}: $${planPrice}.`,
  });

  return {
    title: "Invoice created",
    description: `Invoice ${invoiceNumber} created for ${tenant.name}: $${planPrice}.`,
    invoice: newInvoice,
  };
}

/** Update an existing invoice status. */
export function updateInvoiceStatus(
  id: string,
  status: Invoice["status"],
): { title: string; description: string } {
  const invoices = readRaw();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Invoice not found." };
  }
  const next = [...invoices];
  next[idx] = { ...next[idx], status };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "billing.invoice_status_updated",
    target: next[idx].tenantId,
    severity: "info",
    detail: `Invoice ${next[idx].invoiceNumber} status updated to ${status}.`,
  });
  return {
    title: "Status updated",
    description: `Invoice ${next[idx].invoiceNumber} status set to ${status}.`,
  };
}

/** Record a payment against an invoice. */
export function recordPayment(
  id: string,
  amount: number,
): { title: string; description: string } {
  const invoices = readRaw();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Invoice not found." };
  }
  const next = [...invoices];
  next[idx] = { ...next[idx], status: "paid" };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "billing.invoice_paid",
    target: next[idx].tenantId,
    severity: "info",
    detail: `Payment of $${amount} recorded for invoice ${next[idx].invoiceNumber}.`,
  });
  return {
    title: "Payment recorded",
    description: `Payment of $${amount} recorded for invoice ${next[idx].invoiceNumber}.`,
  };
}

/** Cancel an invoice. */
export function cancelInvoice(
  id: string,
): { title: string; description: string } {
  const invoices = readRaw();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Invoice not found." };
  }
  const next = [...invoices];
  next[idx] = { ...next[idx], status: "cancelled" };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "billing.invoice_cancelled",
    target: next[idx].tenantId,
    severity: "warning",
    detail: `Invoice ${next[idx].invoiceNumber} cancelled.`,
  });
  return {
    title: "Invoice cancelled",
    description: `Invoice ${next[idx].invoiceNumber} cancelled.`,
  };
}

/** Add a line item to an invoice. */
export function addInvoiceLine(
  id: string,
  line: Omit<InvoiceLine, "id">,
): { title: string; description: string; invoice: Invoice } {
  const invoices = readRaw();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx < 0) {
    return {
      title: "(Demo)",
      description: "Invoice not found.",
      invoice: {} as Invoice,
    };
  }
  const next = [...invoices];
  const newLine: InvoiceLine = {
    id: `l-${Date.now()}`,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
  };
  next[idx] = {
    ...next[idx],
    lines: [...next[idx].lines, newLine],
    subtotal: next[idx].subtotal + newLine.amount,
    tax: Math.round((next[idx].subtotal + newLine.amount) * 0.18),
    total: Math.round((next[idx].subtotal + newLine.amount) * 1.18),
  };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "billing.invoice_line_added",
    target: next[idx].tenantId,
    severity: "info",
    detail: `Line added to invoice ${next[idx].invoiceNumber}: ${newLine.description} $${newLine.amount}.`,
  });
  return {
    title: "Line added",
    description: `Line added to invoice ${next[idx].invoiceNumber}: ${newLine.description} $${newLine.amount}.`,
    invoice: next[idx],
  };
}