/** R2-07 — AML & Transaction Monitoring Console store (dummy). */
import { recordAudit } from "@/lib/audit";

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
}

const now = () => new Date().toISOString();
let ALERTS: AmlCase[] = [
  { id:"aml1", traderId:"t-1042", traderName:"Marta Kowalski", email:"marta@example.com", typology:"Structuring / rapid deposits", amount:9800, currency:"USD", risk:"high", status:"open", openedAt:now(), slaDue:now(), payoutHold:true,
    kyc:{status:"verified",docs:["Passport","Proof of address"],address:"Warsaw, PL",pep:false}, screening:[{provider:"ComplyAdvantage",result:"potential",detail:"Name similarity (low confidence)",at:now()}],
    movements:[{at:now(),type:"deposit",amount:3200,method:"card",note:"3 deposits < 1h"},{at:now(),type:"deposit",amount:3300,method:"card",note:""},{at:now(),type:"deposit",amount:3300,method:"card",note:""},{at:now(),type:"payout-request",amount:7200,method:"bank",note:"Requested after deposits"}],
    explainability:{score:78,drivers:["Velocity: 3 deposits in 52m","Amount clustering near threshold","Payout requested within 24h","Potential name match (unconfirmed)"]},
    timeline:[{at:now(),actor:"system",action:"Alert opened from transaction monitoring rule TM-STRUCT-02"}] },
  { id:"aml2", traderId:"t-2201", traderName:"Ahmed Al-Farsi", email:"ahmed@example.com", typology:"Sanctions/PEP screening hit", amount:15000, currency:"USD", risk:"critical", status:"escalated", openedAt:now(), slaDue:now(), payoutHold:true, assignee:"Compliance",
    kyc:{status:"verified",docs:["Passport"],address:"Dubai, AE",pep:true,sanctionsHit:"Potential PEP association"}, screening:[{provider:"World-Check",result:"hit",detail:"PEP: senior political exposure (relative)",at:now()}],
    movements:[{at:now(),type:"payout-request",amount:15000,method:"crypto",note:"USDT payout"}],
    explainability:{score:92,drivers:["PEP screening hit (confirmed relative)","High payout amount","Crypto withdrawal method"]},
    timeline:[{at:now(),actor:"system",action:"Escalated: sanctions/PEP hit"},{at:now(),actor:"system",action:"Payout auto-held pending AML disposition"}] },
  { id:"aml3", traderId:"t-3310", traderName:"Lena Meyer", email:"lena@example.com", typology:"Unusual profit velocity", amount:4200, currency:"EUR", risk:"medium", status:"investigating", openedAt:now(), slaDue:now(), payoutHold:false, assignee:"Analyst",
    kyc:{status:"verified",docs:["ID card","Selfie"],address:"Berlin, DE",pep:false}, screening:[{provider:"ComplyAdvantage",result:"clear",detail:"No matches",at:now()}],
    movements:[{at:now(),type:"profit",amount:4200,method:"trading",note:"98% win rate over 2 days"}],
    explainability:{score:41,drivers:["Abnormal win-rate pattern","Short account age"]},
    timeline:[{at:now(),actor:"Analyst",action:"Investigation started; reviewing trading events correlation"}] },
];

export function listAmlAlerts(){ return ALERTS; }
export function getAmlCase(id:string){ return ALERTS.find(a=>a.id===id); }
export function getAmlHoldForTrader(traderId:string){ return ALERTS.some(a=>a.traderId===traderId && a.payoutHold && (a.status==="open"||a.status==="investigating"||a.status==="escalated")); }
export function updateAmlCase(id:string, patch: Partial<AmlCase>, audit?: {action:string; summary:string}){ ALERTS = ALERTS.map(a=>a.id===id?{...a,...patch}:a); const c=getAmlCase(id); if(c && audit){ c.timeline=[{at:now(),actor:"operator",action:audit.summary},...c.timeline]; recordAudit({action:audit.action,entity:"aml-case",entityId:id,summary:audit.summary,module:"risk",severity:patch.status==="blocked"||patch.status==="sar_filed"? "warning":undefined}); } }
export function dispositionAml(id:string, decision: NonNullable<AmlCase["disposition"]>["decision"], rationale:string){
  const c=getAmlCase(id); if(!c) return;
  const status: AmlStatus = decision==="release"?"cleared":decision==="block"?"blocked":decision==="sar_str"?"sar_filed":"escalated";
  updateAmlCase(id,{status,payoutHold: decision!=="release", disposition:{decision,rationale,by:"operator",at:now()}},{action:`aml.${decision}`,summary:`AML disposition ${decision} for ${c.traderName} (${c.id}): ${rationale.slice(0,80)}`});
}
