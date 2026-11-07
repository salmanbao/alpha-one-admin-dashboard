"use client";
/**
 * R2-07 — AML & Transaction Monitoring Console store (dummy).
 *
 * R3-F02: hold cases are seeded onto real funded traders (preferring ones with
 * a pending payout) so `getAmlHoldCaseForTrader()` — which the payouts module
 * consults before approve/process/pay — actually fires in the demo.
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { traders, payouts, type Trader, type Payout } from "@/lib/platform/mock-data";

export type AmlStatus = "open" | "investigating" | "escalated" | "sar_filed" | "cleared" | "blocked";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AmlAlert {
  id: string; traderId: string; traderName: string; email: string;
  typology: string; amount: number; currency: string; risk: RiskLevel;
  status: AmlStatus; openedAt: string; assignee?: string; slaDue: string; payoutHold: boolean;
}

export interface AmlCase extends AmlAlert {
  kyc: { status: string; docs: string[]; address: string; pep: boolean; sanctionsHit?: string };
  screening: Array<{ provider: string; result: "clear" | "hit" | "potential"; detail: string; at: string }>;
  movements: Array<{ at: string; type: string; amount: number; method: string; note: string }>;
  explainability: { score: number; drivers: string[] };
  disposition?: { decision: "release" | "hold" | "block" | "escalate" | "sar_str"; rationale: string; by: string; at: string };
  timeline: Array<{ at: string; actor: string; action: string }>;
  /** R3-01 — set when a filing snapshot locks this case's narrative. */
  filingId?: string;
}

const now = () => new Date().toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

interface SeedSlot { trader: Trader; payout?: Payout }

/**
 * Real funded traders, preferring ones that have a *pending* payout — a hold
 * case sitting on such a trader visibly blocks the Approve button on every
 * payout surface (table row, review panel, queue widget, batch toolbar).
 */
function seedSlots(count: number): SeedSlot[] {
  const funded = traders.filter((t) => t.challengePhase === "funded");
  const pending = new Map<string, Payout>();
  for (const p of payouts) if (p.status === "pending" && !pending.has(p.traderId)) pending.set(p.traderId, p);
  const picked: SeedSlot[] = [];
  const used = new Set<string>();
  for (const pass of [1, 0]) {
    for (const t of funded) {
      if (picked.length >= count) break;
      if (used.has(t.id)) continue;
      const p = pending.get(t.id);
      if (pass === 1 && !p) continue;
      used.add(t.id);
      picked.push(p ? { trader: t, payout: p } : { trader: t });
    }
  }
  return picked;
}

function slot(i: number): SeedSlot {
  const s = seedSlots(4)[i];
  return s ?? { trader: traders[i % traders.length] };
}

function baseCase(id: string, s: SeedSlot, p: {
  typology: string; amount: number; risk: RiskLevel; status: AmlStatus; payoutHold: boolean;
  kyc: AmlCase["kyc"]; screening: AmlCase["screening"]; movements: AmlCase["movements"];
  explainability: AmlCase["explainability"]; slaDue: string; assignee?: string;
  disposition?: AmlCase["disposition"];
  timeline?: AmlCase["timeline"];
}): AmlCase {
  const t = s.trader;
  return {
    id, traderId: t.id, traderName: t.name, email: t.email,
    typology: p.typology, amount: p.amount, currency: s.payout?.currency ?? "USD",
    risk: p.risk, status: p.status, openedAt: now(), slaDue: p.slaDue,
    payoutHold: p.payoutHold, assignee: p.assignee,
    kyc: p.kyc, screening: p.screening, movements: p.movements,
    explainability: p.explainability, disposition: p.disposition,
    timeline: p.timeline ?? [{ at: now(), actor: "system", action: `Alert opened from transaction monitoring rule for ${p.typology}` }],
  };
}

const s1 = slot(0), s2 = slot(1), s3 = slot(2), s4 = slot(3);

let ALERTS: AmlCase[] = [
  baseCase("aml1", s1, {
    typology: "Structuring / rapid deposits", amount: 9800, risk: "high", status: "open", payoutHold: true, slaDue: inDays(2),
    kyc: { status: "verified", docs: ["Passport", "Proof of address"], address: s1.trader.country, pep: false },
    screening: [{ provider: "ComplyAdvantage", result: "potential", detail: "Name similarity (low confidence)", at: now() }],
    movements: [
      { at: now(), type: "deposit", amount: 3200, method: "card", note: "3 deposits < 1h" },
      { at: now(), type: "deposit", amount: 3300, method: "card", note: "" },
      { at: now(), type: "deposit", amount: 3300, method: "card", note: "" },
      { at: now(), type: "payout-request", amount: 7200, method: "bank", note: "Requested after deposits" },
    ],
    explainability: { score: 78, drivers: ["Velocity: 3 deposits in 52m", "Amount clustering near threshold", "Payout requested within 24h", "Potential name match (unconfirmed)"] },
    timeline: [{ at: now(), actor: "system", action: "Alert opened from transaction monitoring rule TM-STRUCT-02" },
      { at: now(), actor: "system", action: "Payout auto-held pending AML disposition (R3-F02 hook)" }],
  }),
  baseCase("aml2", s2, {
    typology: "Sanctions/PEP screening hit", amount: 15000, risk: "critical", status: "escalated", payoutHold: true, slaDue: inDays(1), assignee: "Compliance",
    kyc: { status: "verified", docs: ["Passport"], address: s2.trader.country, pep: true, sanctionsHit: "Potential PEP association" },
    screening: [{ provider: "World-Check", result: "hit", detail: "PEP: senior political exposure (relative)", at: now() }],
    movements: [{ at: now(), type: "payout-request", amount: 15000, method: "crypto", note: "USDT payout" }],
    explainability: { score: 92, drivers: ["PEP screening hit (confirmed relative)", "High payout amount", "Crypto withdrawal method"] },
    timeline: [{ at: now(), actor: "system", action: "Escalated: sanctions/PEP hit" },
      { at: now(), actor: "system", action: "Payout auto-held pending AML disposition (R3-F02 hook)" }],
  }),
  baseCase("aml3", s3, {
    typology: "Unusual profit velocity", amount: 4200, risk: "medium", status: "investigating", payoutHold: false, slaDue: inDays(5), assignee: "Analyst",
    kyc: { status: "verified", docs: ["ID card", "Selfie"], address: s3.trader.country, pep: false },
    screening: [{ provider: "ComplyAdvantage", result: "clear", detail: "No matches", at: now() }],
    movements: [{ at: now(), type: "profit", amount: 4200, method: "trading", note: "98% win rate over 2 days" }],
    explainability: { score: 41, drivers: ["Abnormal win-rate pattern", "Short account age"] },
    timeline: [{ at: now(), actor: "Analyst", action: "Investigation started; reviewing trading events correlation" }],
  }),
  baseCase("aml4", s4, {
    typology: "Rapid deposit withdrawal", amount: 6400, risk: "low", status: "cleared", payoutHold: false, slaDue: inDays(-3),
    kyc: { status: "verified", docs: ["Passport"], address: s4.trader.country, pep: false },
    screening: [{ provider: "OpenSanctions", result: "clear", detail: "No matches across sanctions/PEP/RCA", at: now() }],
    movements: [{ at: now(), type: "deposit", amount: 6400, method: "bank", note: "Withdrawn after KYC re-verify" }],
    explainability: { score: 18, drivers: ["Single deposit, KYC fully verified"] },
    disposition: { decision: "release", rationale: "Source of funds confirmed; screening clear on current list version.", by: "analyst", at: now() },
    timeline: [{ at: now(), actor: "analyst", action: "Case cleared — payout hold released (four-eyes: compliance.aml.approve)" }],
  }),
];

/* R3-F02 — store subscription: payout surfaces re-render when a hold is
 * created or released (mirrors the payout-store version pattern). */
const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function listAmlAlerts(){ return ALERTS; }
export function getAmlCase(id:string){ return ALERTS.find(a=>a.id===id); }

/** R3-F02 — the active hold case for a trader (the payout hook reads this). */
export function getAmlHoldCaseForTrader(traderId: string): AmlCase | undefined {
  return ALERTS.find(a => a.traderId === traderId && a.payoutHold &&
    (a.status === "open" || a.status === "investigating" || a.status === "escalated"));
}
export function getAmlHoldForTrader(traderId:string){ return !!getAmlHoldCaseForTrader(traderId); }

export function updateAmlCase(id:string, patch: Partial<AmlCase>, audit?: {action:string; summary:string}){
  ALERTS = ALERTS.map(a=>a.id===id?{...a,...patch}:a);
  const c=getAmlCase(id);
  if(c && audit){ c.timeline=[{at:now(),actor:"operator",action:audit.summary},...c.timeline];
    recordAudit({action:audit.action,entity:"aml-case",entityId:id,summary:audit.summary,module:"risk",severity:patch.status==="blocked"||patch.status==="sar_filed"? "warning":undefined});
  }
  if (patch.payoutHold !== undefined || patch.status !== undefined || patch.filingId !== undefined) emit();
}

export function dispositionAml(id:string, decision: NonNullable<AmlCase["disposition"]>["decision"], rationale:string){
  const c=getAmlCase(id); if(!c) return;
  const status: AmlStatus = decision==="release"?"cleared":decision==="block"?"blocked":decision==="sar_str"?"sar_filed":"escalated";
  updateAmlCase(id,{status,payoutHold: decision!=="release", disposition:{decision,rationale,by:"operator",at:now()}},{action:`aml.${decision}`,summary:`AML disposition ${decision} for ${c.traderName} (${c.id}): ${rationale.slice(0,80)}`});
}

/** Subscribe the calling component to AML hold changes (R3-F02). */
export function useAmlVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
