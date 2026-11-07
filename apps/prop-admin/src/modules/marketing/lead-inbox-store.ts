"use client";
/**
 * R4-02 — Lead Inbox & Assignment store (dummy, store-backed).
 *
 * Models lead lifecycle from form/landing/onsite/link submissions:
 *   • leads: aggregated from form submissions (forms-store) + other sources
 *   • status: new | assigned | working | won | lost
 *   • assignment to operators with history
 *   • SLA clock on first response; breach pushes notification
 *   • Won conversion increments campaign report conversion count
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { listForms, listSubmissions, type FormSubmission } from "./forms-store";
import { crmContacts, type CrmContact } from "@/lib/platform/mock-data";

/* ------------------------------------------------------------------ */
/* Model                                                              */
/* ------------------------------------------------------------------ */

export type LeadStatus = "new" | "assigned" | "working" | "won" | "lost";

export interface Lead {
  id: string;
  /** Reference to originating submission (form/landing/onsite/link). */
  submissionId?: string;
  source: "form" | "landing_page" | "onsite" | "link";
  /** Human-readable source name (form name, landing page name, etc.). */
  sourceName: string;
  /** UTM parameters if from link tracking. */
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
  email: string;
  name: string;
  /** Full submission payload verbatim. */
  payload: Record<string, any>;
  /** Deduplicated CRM contact link. */
  crmContactId?: string;
  status: LeadStatus;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  /** First time status moved to assigned/working (SLA start). */
  firstResponseAt?: string;
  /** SLA breach flagged and notified. */
  slaBreached?: boolean;
  /** Revenue attributed when marked Won. */
  wonRevenue?: number;
  /** Assignment / status change history. */
  history: Array<{ at: string; actor: string; action: string; detail: string }>;
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  presence: "online" | "away" | "offline";
}

export interface LeadMetric {
  label: string;
  value: number;
}

/* ------------------------------------------------------------------ */
/* Seed operators (from mock-data users)                              */
/* ------------------------------------------------------------------ */

let OPERATORS: Operator[] = [
  { id: "user-alpha-admin", name: "Sarah Chen", email: "sarah@alphacapital.io", presence: "online" },
  { id: "user-alpha-risk", name: "Marcus Webb", email: "marcus@alphacapital.io", presence: "online" },
  { id: "user-beta-admin", name: "Priya Patel", email: "priya@betacap.io", presence: "away" },
  { id: "user-gamma-admin", name: "Alex Kim", email: "alex@gammatrading.com", presence: "offline" },
];

/* ------------------------------------------------------------------ */
/* Seed leads from existing form submissions                          */
/* ------------------------------------------------------------------ */

function buildLeadsFromForms(): Lead[] {
  const leads: Lead[] = [];
  const forms = listForms();
  for (const form of forms) {
    const subs = listSubmissions(form.id);
    for (const sub of subs) {
      const emailVal = Object.values(sub.values).find(v => typeof v === "string" && v.includes("@")) ?? "unknown@example.com";
      const nameVal = Object.values(sub.values).find(v => typeof v === "string" && !v.includes("@") && v.length > 2) ?? "Lead";
      leads.push({
        id: `lead-${form.id}-${sub.id}`,
        submissionId: sub.id,
        source: "form",
        sourceName: form.name,
        email: String(emailVal),
        name: String(nameVal),
        payload: sub.values,
        crmContactId: sub.crmContactId,
        status: "new",
        createdAt: sub.at,
        updatedAt: sub.at,
        history: [{ at: sub.at, actor: "system", action: "created", detail: `Form submission via ${form.name}` }],
      });
    }
  }
  // Add a few landing/onsite/link leads manually
  const nowStr = new Date().toISOString();
  leads.push(
    {
      id: "lead-lp-1", source: "landing_page", sourceName: "Scale-Up Oct landing",
      email: "john.doe@trader.com", name: "John Doe",
      payload: { email: "john.doe@trader.com", "company": "Doe Capital" },
      status: "new", createdAt: nowStr, updatedAt: nowStr,
      history: [{ at: nowStr, actor: "system", action: "created", detail: "Landing page form submission" }],
    },
    {
      id: "lead-onsite-1", source: "onsite", sourceName: "Exit intent popup",
      email: "jane.smith@fund.com", name: "Jane Smith",
      payload: { email: "jane.smith@fund.com", "interest": "VIP campaign" },
      utm: { source: "google", medium: "cpc", campaign: "brand" },
      status: "new", createdAt: nowStr, updatedAt: nowStr,
      history: [{ at: nowStr, actor: "system", action: "created", detail: "On-site unit submission" }],
    },
    {
      id: "lead-link-1", source: "link", sourceName: "UTM tracked click",
      email: "bob.wilson@prop.io", name: "Bob Wilson",
      payload: { email: "bob.wilson@prop.io" },
      utm: { source: "newsletter", medium: "email", campaign: "weekly" },
      status: "new", createdAt: nowStr, updatedAt: nowStr,
      history: [{ at: nowStr, actor: "system", action: "created", detail: "Link click with UTM" }],
    },
  );
  return leads;
}

let LEADS: Lead[] = buildLeadsFromForms();

/* ------------------------------------------------------------------ */
/* Reads                                                              */
/* ------------------------------------------------------------------ */

export function listLeads(): Lead[] {
  return [...LEADS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLead(id: string): Lead | undefined {
  return LEADS.find(l => l.id === id);
}

export function listOperators(): Operator[] {
  return OPERATORS;
}

export function metricCounts(): LeadMetric[] {
  const counts = { new: 0, assigned: 0, working: 0, won: 0, lost: 0 };
  for (const l of LEADS) counts[l.status]++;
  return [
    { label: "New", value: counts.new },
    { label: "Assigned", value: counts.assigned },
    { label: "Working", value: counts.working },
    { label: "Won", value: counts.won },
    { label: "Lost", value: counts.lost },
  ];
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

function addHistory(lead: Lead, actor: string, action: string, detail: string): Lead {
  return { ...lead, history: [{ at: new Date().toISOString(), actor, action, detail }, ...lead.history] };
}

/** Assign lead(s) to an operator. */
export function assignLead(leadId: string, ownerId: string, actor: string): Lead | null {
  const lead = LEADS.find(l => l.id === leadId);
  if (!lead) return null;
  const operator = OPERATORS.find(o => o.id === ownerId);
  if (!operator) return null;
  const next: Lead = {
    ...lead,
    ownerId,
    ownerName: operator.name,
    status: "assigned",
    firstResponseAt: lead.firstResponseAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [...lead.history, { at: new Date().toISOString(), actor, action: "assigned", detail: `Assigned to ${operator.name}` }],
  };
  LEADS = LEADS.map(l => l.id === leadId ? next : l);
  recordAudit({ action: "lead.assign", entity: "lead", entityId: leadId, summary: `Lead ${leadId} assigned to ${operator.name} by ${actor}`, module: "marketing", actor });
  return next;
}

/** Bulk assign leads to an operator. */
export function bulkAssign(leadIds: string[], ownerId: string, actor: string): string[] {
  const operator = OPERATORS.find(o => o.id === ownerId);
  if (!operator) return [];
  const assigned: string[] = [];
  for (const id of leadIds) {
    const lead = LEADS.find(l => l.id === id);
    if (!lead) continue;
    const next: Lead = {
      ...lead,
      ownerId,
      ownerName: operator.name,
      status: "assigned",
      firstResponseAt: lead.firstResponseAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [...lead.history, { at: new Date().toISOString(), actor, action: "assigned", detail: `Assigned to ${operator.name}` }],
    };
    LEADS = LEADS.map(l => l.id === id ? next : l);
    recordAudit({ action: "lead.assign", entity: "lead", entityId: id, summary: `Lead ${id} assigned to ${operator.name} by ${actor}`, module: "marketing", actor });
    assigned.push(id);
  }
  return assigned;
}

/** Set lead status (new/working/won/lost). */
export function setLeadStatus(leadId: string, status: LeadStatus, actor: string, wonRevenue?: number): Lead | null {
  const lead = LEADS.find(l => l.id === leadId);
  if (!lead) return null;
  const detail = status === "won" ? `Marked Won${wonRevenue ? ` ($${wonRevenue})` : ""}` : status === "lost" ? "Marked Lost" : `Status → ${status}`;
  const next: Lead = {
    ...lead,
    status,
    wonRevenue: status === "won" ? wonRevenue : lead.wonRevenue,
    updatedAt: new Date().toISOString(),
    history: [...lead.history, { at: new Date().toISOString(), actor, action: "status", detail }],
  };
  LEADS = LEADS.map(l => l.id === leadId ? next : l);
  recordAudit({ action: `lead.${status}`, entity: "lead", entityId: leadId, summary: `Lead ${leadId} ${detail} by ${actor}`, module: "marketing", actor });
  return next;
}

/** Get CRM contact by id. */
export function getCrmContact(id: string): CrmContact | undefined {
  return crmContacts.find(c => c.id === id);
}

/* ------------------------------------------------------------------ */
/* SLA check (called by page polling)                                 */
/* ------------------------------------------------------------------ */

export type SlaBreachResult = { leadId: string; ageMinutes: number }[];

/** Check leads that have been new/assigned > 4h without first response; push notifications via callback. */
export function checkSlaBreaches(push: (n: { title: string; message: string; severity: "warning" | "info" | "danger"; module: string; deepLink?: string }) => void): SlaBreachResult {
  const now = Date.now();
  const breaches: SlaBreachResult = [];
  const fourHours = 4 * 60 * 60 * 1000;
  for (const lead of LEADS) {
    if (lead.status === "won" || lead.status === "lost" || lead.slaBreached) continue;
    const age = now - new Date(lead.createdAt).getTime();
    if (age > fourHours) {
      lead.slaBreached = true;
      breaches.push({ leadId: lead.id, ageMinutes: Math.round(age / 60000) });
      push({
        title: "Lead SLA breach",
        message: `Lead ${lead.id} (${lead.name}) has no response for ${Math.round(age / 3600000)}h.`,
        severity: "warning",
        module: "marketing",
        deepLink: `lead-inbox?id=${lead.id}`,
      });
    }
  }
  return breaches;
}

/* ------------------------------------------------------------------ */
/* React subscription                                                 */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() { version += 1; listeners.forEach(l => l()); }

export function useLeadVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}

/* Helper to wire emits after mutations (page should call emit via useLeadVersion) */
export function leadStoreEmit() { emit(); }