"use client";
/**
 * R3-05 — Ad Budget Approvals store (dummy, store-backed).
 *
 * Ad spend gets the same four-eyes pattern as payouts: budget-change
 * requests (ad account, campaign, current → requested cap, requester,
 * reason, effective date) sit in an approval queue with an SLA clock.
 *
 *  • AC-1 — a raise above AUTO_APPROVE_DAILY_RAISE / AUTO_APPROVE_MONTHLY_
 *    RAISE can only be applied by approveRequest() (gated in the UI with
 *    marketing.budget.approve); a raise under the threshold is applied
 *    immediately as auto_approved and logged to the N11 audit log.
 *  • AC-2 — listBudgets() only ever exposes approved caps; pending
 *    changes are requests, never applied, and are surfaced as flags via
 *    pendingRequestFor() so the ad-spend page can flag them.
 *  • Four-eyes — the requester can never approve their own request.
 *  • Rejections carry reviewer comments and are reported back to the
 *    page, which notifies the requester in-app (pushNotification).
 *
 * Every state transition writes to the N11 marketing audit log
 * (recordAudit → lib/audit), which the Marketing Audit Log screen reads.
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

/** An approved budget cap — the only thing the ad-spend page may show (AC-2). */
export interface BudgetCap {
  id: string;
  /** M5 ad account id (act_9182, 882-110-4421, adv_7710). */
  adAccountId: string;
  provider: string;
  campaign: string;
  dailyCap: number;
  monthlyCap: number;
  currency: string;
  approvedAt: string;
  approvedBy: string;
  /** Bumped on every approved/auto-approved change (versioned caps). */
  version: number;
}

export type RequestState = "pending" | "approved" | "auto_approved" | "rejected";

export interface BudgetRequest {
  id: string;
  capId: string;
  adAccountId: string;
  provider: string;
  campaign: string;
  currentDaily: number;
  currentMonthly: number;
  requestedDaily: number;
  requestedMonthly: number;
  requester: string;
  reason: string;
  effectiveDate: string;
  state: RequestState;
  submittedAt: string;
  /** SLA clock: 48h from submission. */
  slaDue: string;
  decidedAt?: string;
  decidedBy?: string;
  comments: Array<{ at: string; by: string; text: string }>;
  /** How the workflow resolved it (threshold rule / reviewer decision). */
  resolution?: string;
}

/** AC-1: raises at or under these thresholds auto-approve and log. */
export const AUTO_APPROVE_DAILY_RAISE = 500;
export const AUTO_APPROVE_MONTHLY_RAISE = 5000;
/** SLA clock for a pending approval (hours from submission). */
export const APPROVAL_SLA_HOURS = 48;

const now = () => new Date().toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/* ------------------------------------------------------------------ */
/* Seed — approved caps + the request history                          */
/* ------------------------------------------------------------------ */

let CAPS: BudgetCap[] = [
  { id: "cap-1", adAccountId: "act_9182", provider: "Meta Ads", campaign: "Scale-Up Oct", dailyCap: 400, monthlyCap: 8000, currency: "USD", approvedAt: hoursAgo(24 * 18), approvedBy: "Sarah Chen", version: 2 },
  { id: "cap-2", adAccountId: "882-110-4421", provider: "Google Ads", campaign: "Search — Funding", dailyCap: 600, monthlyCap: 12000, currency: "USD", approvedAt: hoursAgo(24 * 25), approvedBy: "Sarah Chen", version: 1 },
  { id: "cap-3", adAccountId: "adv_7710", provider: "TikTok Ads", campaign: "TikTok Challenge Push", dailyCap: 150, monthlyCap: 4000, currency: "USD", approvedAt: hoursAgo(24 * 9), approvedBy: "Priya Raman", version: 1 },
];

let REQUESTS: BudgetRequest[] = [
  {
    // Above threshold → pending with SLA clock.
    id: "br-1001", capId: "cap-3", adAccountId: "adv_7710", provider: "TikTok Ads", campaign: "TikTok Challenge Push",
    currentDaily: 150, currentMonthly: 4000, requestedDaily: 800, requestedMonthly: 16000,
    requester: "Maya Okafor",
    reason: "CPA down to $14.80 after the creative refresh — scale before the Q4 window closes.",
    effectiveDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    state: "pending", submittedAt: hoursAgo(20), slaDue: hoursFromNow(APPROVAL_SLA_HOURS - 20),
    comments: [{ at: hoursAgo(19), by: "Maya Okafor", text: "Pacing data attached — 3-day trailing CPA and impression headroom both green." }],
  },
  {
    // Overdue SLA → the queue must show a red clock.
    id: "br-1002", capId: "cap-2", adAccountId: "882-110-4421", provider: "Google Ads", campaign: "Search — Funding",
    currentDaily: 600, currentMonthly: 12000, requestedDaily: 1250, requestedMonthly: 26000,
    requester: "Dan Whitfield",
    reason: "Brand terms converting at 9% — need headroom before the competitor blackout week.",
    effectiveDate: new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10),
    state: "pending", submittedAt: hoursAgo(60), slaDue: hoursAgo(12),
    comments: [],
  },
  {
    // Below threshold → auto-approved and logged (AC-1).
    id: "br-1003", capId: "cap-1", adAccountId: "act_9182", provider: "Meta Ads", campaign: "Scale-Up Oct",
    currentDaily: 400, currentMonthly: 8000, requestedDaily: 550, requestedMonthly: 10000,
    requester: "Maya Okafor",
    reason: "Small pacing top-up inside the approved envelope.",
    effectiveDate: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    state: "auto_approved", submittedAt: hoursAgo(50), slaDue: hoursFromNow(APPROVAL_SLA_HOURS - 50),
    decidedAt: hoursAgo(50), decidedBy: "system (threshold rule)",
    comments: [],
    resolution: "Raise $150/day ≤ $500 and $2,000/month ≤ $5,000 — auto-approved under the threshold rule and applied.",
  },
  {
    // Rejected with reviewer comments.
    id: "br-1004", capId: "cap-2", adAccountId: "882-110-4421", provider: "Google Ads", campaign: "Search — Funding",
    currentDaily: 600, currentMonthly: 12000, requestedDaily: 1400, requestedMonthly: 30000,
    requester: "Dan Whitfield",
    reason: "Aggressive scale for the black-friday surge.",
    effectiveDate: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
    state: "rejected", submittedAt: hoursAgo(24 * 7), slaDue: hoursFromNow(APPROVAL_SLA_HOURS - 24 * 7),
    decidedAt: hoursAgo(24 * 6), decidedBy: "Sarah Chen",
    comments: [
      { at: hoursAgo(24 * 7), by: "Dan Whitfield", text: "Submit with the surge forecast attached." },
      { at: hoursAgo(24 * 6), by: "Sarah Chen", text: "Q4 budget freeze — re-submit after January with the actuals from the surge." },
    ],
    resolution: "Rejected by reviewer: budget freeze outside the approved envelope.",
  },
];

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** AC-2: only approved caps exist here — pending changes never appear. */
export function listBudgets(): BudgetCap[] {
  return [...CAPS];
}
export function getBudget(id: string): BudgetCap | undefined {
  return CAPS.find(c => c.id === id);
}

export function listRequests(): BudgetRequest[] {
  return [...REQUESTS].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
export function getRequest(id: string): BudgetRequest | undefined {
  return REQUESTS.find(r => r.id === id);
}

/** AC-2 flag: the pending change against an approved cap (if any). */
export function pendingRequestFor(capId: string): BudgetRequest | undefined {
  return REQUESTS.find(r => r.capId === capId && r.state === "pending");
}

export function slaState(r: BudgetRequest): "met" | "due" | "overdue" | "closed" {
  if (r.state !== "pending") return "closed";
  return new Date(r.slaDue).getTime() < Date.now() ? "overdue" : "due";
}

/** Hours remaining (negative = overdue) for the SLA clock column. */
export function slaHours(r: BudgetRequest): number {
  return Math.round((new Date(r.slaDue).getTime() - Date.now()) / 3_600_000);
}

export function isAutoApprovable(requestedDaily: number, currentDaily: number, requestedMonthly: number, currentMonthly: number): boolean {
  return (
    requestedDaily - currentDaily <= AUTO_APPROVE_DAILY_RAISE &&
    requestedMonthly - currentMonthly <= AUTO_APPROVE_MONTHLY_RAISE
  );
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export interface RequestInput {
  capId: string;
  requestedDaily: number;
  requestedMonthly: number;
  reason: string;
  effectiveDate: string;
}

export interface SubmitResult {
  ok: boolean;
  request: BudgetRequest;
  autoApproved: boolean;
  error?: string;
}

let seq = 1005;

/**
 * Submit a budget-change request. Below the threshold it auto-applies
 * (AC-1) and logs; above it, it waits in the queue under the SLA clock.
 * The caller enforces marketing.ads.manage for creating requests.
 */
export function requestBudgetChange(input: RequestInput, actor: string): SubmitResult {
  const cap = getBudget(input.capId);
  if (!cap) return { ok: false, request: {} as BudgetRequest, autoApproved: false, error: "Budget not found." };
  if (input.requestedDaily <= 0 || input.requestedMonthly <= 0) {
    return { ok: false, request: {} as BudgetRequest, autoApproved: false, error: "Caps must be positive." };
  }
  const raises = input.requestedDaily >= cap.dailyCap && input.requestedMonthly >= cap.monthlyCap;
  if (!raises) {
    return { ok: false, request: {} as BudgetRequest, autoApproved: false, error: "Use a reduction request path for cuts — this queue handles raises." };
  }
  const auto = isAutoApprovable(input.requestedDaily, cap.dailyCap, input.requestedMonthly, cap.monthlyCap);

  const request: BudgetRequest = {
    id: `br-${seq++}`,
    capId: cap.id,
    adAccountId: cap.adAccountId,
    provider: cap.provider,
    campaign: cap.campaign,
    currentDaily: cap.dailyCap,
    currentMonthly: cap.monthlyCap,
    requestedDaily: input.requestedDaily,
    requestedMonthly: input.requestedMonthly,
    requester: actor,
    reason: input.reason,
    effectiveDate: input.effectiveDate,
    state: auto ? "auto_approved" : "pending",
    submittedAt: now(),
    slaDue: hoursFromNow(APPROVAL_SLA_HOURS),
    comments: [],
    decidedAt: auto ? now() : undefined,
    decidedBy: auto ? "system (threshold rule)" : undefined,
    resolution: auto
      ? `Raise $${input.requestedDaily - cap.dailyCap}/day ≤ $${AUTO_APPROVE_DAILY_RAISE} and $${input.requestedMonthly - cap.monthlyCap}/month ≤ $${AUTO_APPROVE_MONTHLY_RAISE} — auto-approved under the threshold rule and applied.`
      : undefined,
  };

  if (auto) applyCap(cap.id, input.requestedDaily, input.requestedMonthly, actor);
  REQUESTS = [request, ...REQUESTS];
  emit();

  recordAudit({
    action: auto ? "ads.budget.auto_approve" : "ads.budget.request",
    entity: "ad_budget",
    entityId: request.id,
    summary: auto
      ? `Budget raise for ${cap.campaign} (${cap.adAccountId}) auto-approved under threshold: $${cap.dailyCap}→$${input.requestedDaily}/day, $${cap.monthlyCap}→$${input.requestedMonthly}/month, requested by ${actor}`
      : `Budget raise submitted for approval: ${cap.campaign} (${cap.adAccountId}) $${cap.dailyCap}→$${input.requestedDaily}/day, $${cap.monthlyCap}→$${input.requestedMonthly}/month by ${actor} — above threshold, requires marketing.budget.approve`,
    module: "marketing",
    severity: auto ? "info" : "warning",
  });

  return { ok: true, request, autoApproved: auto };
}

function applyCap(capId: string, daily: number, monthly: number, by: string): BudgetCap | undefined {
  let next: BudgetCap | undefined;
  CAPS = CAPS.map(c => {
    if (c.id !== capId) return c;
    next = { ...c, dailyCap: daily, monthlyCap: monthly, approvedAt: now(), approvedBy: by, version: c.version + 1 };
    return next;
  });
  return next;
}

export interface DecisionResult {
  ok: boolean;
  error?: string;
  request?: BudgetRequest;
}

/**
 * Approve a pending raise (marketing.budget.approve in the UI).
 * Four-eyes: the requester can never approve their own request.
 */
export function approveRequest(id: string, actor: string, comment: string): DecisionResult {
  const r = getRequest(id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.state !== "pending") return { ok: false, error: `Request is already ${r.state.replace("_", " ")}.` };
  if (r.requester === actor) {
    return { ok: false, error: "Four-eyes violation: you raised this request — a second approver with marketing.budget.approve must decide it." };
  }

  applyCap(r.capId, r.requestedDaily, r.requestedMonthly, actor);
  const decided: BudgetRequest = {
    ...r,
    state: "approved",
    decidedAt: now(),
    decidedBy: actor,
    comments: comment.trim() ? [...r.comments, { at: now(), by: actor, text: comment.trim() }] : r.comments,
    resolution: `Approved by ${actor}: $${r.currentDaily}→$${r.requestedDaily}/day, $${r.currentMonthly}→$${r.requestedMonthly}/month effective ${r.effectiveDate}.`,
  };
  REQUESTS = REQUESTS.map(x => (x.id === id ? decided : x));
  emit();

  recordAudit({
    action: "ads.budget.approve",
    entity: "ad_budget",
    entityId: r.id,
    summary: `Approved budget raise for ${r.campaign} (${r.adAccountId}): $${r.currentDaily}→$${r.requestedDaily}/day, $${r.currentMonthly}→$${r.requestedMonthly}/month by ${actor}${comment.trim() ? ` — ${comment.trim()}` : ""}`,
    module: "marketing",
  });
  return { ok: true, request: decided };
}

/** Reject a pending raise with comments; the page notifies the requester in-app. */
export function rejectRequest(id: string, actor: string, comment: string): DecisionResult {
  const r = getRequest(id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.state !== "pending") return { ok: false, error: `Request is already ${r.state.replace("_", " ")}.` };
  if (r.requester === actor) {
    return { ok: false, error: "Four-eyes violation: you raised this request — a second approver must decide it." };
  }

  const decided: BudgetRequest = {
    ...r,
    state: "rejected",
    decidedAt: now(),
    decidedBy: actor,
    comments: comment.trim() ? [...r.comments, { at: now(), by: actor, text: comment.trim() }] : r.comments,
    resolution: `Rejected by ${actor}${comment.trim() ? `: ${comment.trim()}` : ""}.`,
  };
  REQUESTS = REQUESTS.map(x => (x.id === id ? decided : x));
  emit();

  recordAudit({
    action: "ads.budget.reject",
    entity: "ad_budget",
    entityId: r.id,
    summary: `Rejected budget raise for ${r.campaign} (${r.adAccountId}) by ${actor}: ${comment.trim() || "(no comment)"}`,
    module: "marketing",
    severity: "warning",
  });
  return { ok: true, request: decided };
}

/** Comment on a request without deciding it (queue collaboration). */
export function commentRequest(id: string, actor: string, text: string): DecisionResult {
  const r = getRequest(id);
  if (!r || !text.trim()) return { ok: false, error: "Request or comment missing." };
  const next: BudgetRequest = { ...r, comments: [...r.comments, { at: now(), by: actor, text: text.trim() }] };
  REQUESTS = REQUESTS.map(x => (x.id === id ? next : x));
  emit();
  return { ok: true, request: next };
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach(l => l());
}

/** Subscribe the calling component to budget-store mutations. */
export function useBudgetVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
