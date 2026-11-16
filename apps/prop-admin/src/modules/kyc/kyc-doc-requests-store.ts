"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { emitLifecycle } from "@pfaas/lifecycle";

/**
 * KYC document-request decision store (R7 I9).
 *
 * The document-requests queue previously fired a toast for every action
 * (remind / approve / reject), so nothing survived a reload — an R10
 * violation on an audited compliance workflow. Every action now writes
 * through here: the override is persisted (`pfaas:demo:kyc-doc-requests`),
 * recorded in the session audit trail and published as a typed lifecycle
 * event (`kyc.document-requested` / `kyc.document-decided`).
 *
 * New requests created by the operator are persisted in full (trader, doc
 * type, reason, deadline) so they survive reload alongside seed rows.
 */

const docOverrideSchema = z.record(
  z.string(),
  z.object({
    status: z.enum(["pending", "submitted", "approved", "rejected", "expired"]),
    remindedAt: z.string().optional(),
    decidedAt: z.string().optional(),
    reason: z.string().optional(),
  }),
);

const createdRequestSchema = z.array(
  z.object({
    id: z.string(),
    traderId: z.string(),
    traderName: z.string(),
    documentType: z.string(),
    reason: z.string(),
    requestedAt: z.string(),
    deadline: z.string(),
    status: z.enum(["pending", "submitted", "approved", "rejected", "expired"]),
  }),
);

const docStateSchema = z.object({
  overrides: docOverrideSchema,
  created: createdRequestSchema,
});

const SLOT = "kyc-doc-requests";
const listeners = new Set<() => void>();
let version = 0;

type State = { overrides: Record<string, Record<string, unknown>>; created: DocRequestRow[] };
type DocRequestRow = {
  id: string;
  traderId: string;
  traderName: string;
  documentType: string;
  reason: string;
  requestedAt: string;
  deadline: string;
  status: "pending" | "submitted" | "approved" | "rejected" | "expired";
};

function load(): State {
  try {
    const parsed = docStateSchema.safeParse(loadDemoState(SLOT, docStateSchema, { overrides: {}, created: [] }));
    if (parsed.success) return parsed.data as State;
  } catch {
    /* fall through */
  }
  return { overrides: {}, created: [] };
}

const state: State = load();

function emit() {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

/** Merge persisted overrides + created rows into the seed list. */
export function mergeDocRequests(seed: DocRequestRow[]): DocRequestRow[] {
  const overridden = seed.map((r) => {
    const o = state.overrides[r.id];
    return o ? { ...r, status: o.status as DocRequestRow["status"] } : r;
  });
  return [...overridden, ...state.created];
}

/** Persist a newly created document request. */
export function createDocRequest(req: Omit<DocRequestRow, "id" | "requestedAt" | "status">) {
  const id = `DR-${Math.floor(1000 + Math.random() * 9000)}`;
  const row: DocRequestRow = {
    ...req,
    id,
    requestedAt: "just now",
    status: "pending",
  };
  state.created.push(row);
  recordAudit({
    action: "Requested KYC document",
    entity: "kyc",
    entityId: id,
    summary: `${req.traderName} — ${req.documentType} requested (${req.reason})`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "kyc", id },
    name: "kyc.document-requested",
    actor: "prop-admin",
    key: id,
    payload: { trader: req.traderName, documentType: req.documentType, reason: req.reason },
  });
  emit();
  return id;
}

/** Remind the trader about a pending document request. */
export function remindDocRequest(req: DocRequestRow) {
  const prev = state.overrides[req.id] ?? {};
  state.overrides[req.id] = { ...prev, status: "pending", remindedAt: new Date().toISOString() };
  recordAudit({
    action: "Reminded KYC document request",
    entity: "kyc",
    entityId: req.id,
    summary: `${req.traderName} — ${req.documentType} reminder sent`,
    severity: "info",
  });
  emit();
}

/** Approve a submitted document request. */
export function approveDocRequest(req: DocRequestRow) {
  const prev = state.overrides[req.id] ?? {};
  state.overrides[req.id] = { ...prev, status: "approved", decidedAt: new Date().toISOString() };
  recordAudit({
    action: "Approved KYC document",
    entity: "kyc",
    entityId: req.id,
    summary: `${req.traderName} — ${req.documentType} approved`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "kyc", id: req.id },
    name: "kyc.document-decided",
    actor: "prop-admin",
    key: `${req.id}:approved`,
    payload: { trader: req.traderName, documentType: req.documentType, decision: "approved" },
  });
  emit();
}

/** Reject a submitted document request. */
export function rejectDocRequest(req: DocRequestRow) {
  const prev = state.overrides[req.id] ?? {};
  state.overrides[req.id] = { ...prev, status: "rejected", decidedAt: new Date().toISOString() };
  recordAudit({
    action: "Rejected KYC document",
    entity: "kyc",
    entityId: req.id,
    summary: `${req.traderName} — ${req.documentType} rejected`,
    severity: "warning",
  });
  emitLifecycle({
    entity: { kind: "kyc", id: req.id },
    name: "kyc.document-decided",
    actor: "prop-admin",
    key: `${req.id}:rejected`,
    payload: { trader: req.traderName, documentType: req.documentType, decision: "rejected" },
  });
  emit();
}

export function useDocRequestVersion(): number {
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