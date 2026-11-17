/** R2-09 — Deliverability Incident Center (tenant mirror of N14). */
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";

export interface DeliveryIncident { id:string; type:"blocklist"|"domain_reputation"|"provider_degradation"|"quota_throttle"; source:"platform"|"tenant"; status:"open"|"mitigating"|"resolved"; severity:"critical"|"high"|"medium"; affected:string[]; detectedAt:string; timeline:Array<{at:string;event:string}>; playbook:string[]; }
const now=()=>new Date().toISOString();

const SEED_INC: DeliveryIncident[] = [
  {id:"inc1",type:"blocklist",source:"platform",status:"open",severity:"critical",affected:["domain: mail.alpha.one","channel: email"],detectedAt:now(),timeline:[{at:now(),event:"Platform detected Spamhaus listing"},{at:now(),event:"Tenant notified"}],playbook:["Pause affected campaigns","Switch provider","Warm alternate domain"]},
  {id:"inc2",type:"provider_degradation",source:"tenant",status:"mitigating",severity:"high",affected:["provider: Twilio","channel: sms"],detectedAt:now(),timeline:[{at:now(),event:"Bounce rate spike detected (N4)"}],playbook:["Throttle sends","Switch provider"]},
];

/**
 * R7 I10 — incident status/playbook actions are operator state that used
 * to reset on reload. Rehydrate from `pfaas:demo:deliverability-incidents`
 * (migrate-on-read: fixtures are the fallback); every mutator
 * re-serializes via `persist()` (this store has no emit()).
 */
const SLOT = "deliverability-incidents";
const schema = z.array(z.any()) as unknown as z.ZodType<DeliveryIncident[]>;
let INC: DeliveryIncident[] = loadDemoState(SLOT, schema, SEED_INC);

function persist(): void { saveDemoState(SLOT, INC); }

export function listIncidents(){ return INC; }
export function resolveIncident(id:string){ INC=INC.map(i=>i.id===id?{...i,status:"resolved",timeline:[...i.timeline,{at:now(),event:"Tenant confirmed resolution (fed back to N14)"}]}:i); persist(); }
export function applyPlaybook(id:string, action:string){ INC=INC.map(i=>i.id===id?{...i,status:"mitigating",timeline:[...i.timeline,{at:now(),event:`Playbook action: ${action}`}]}:i); persist(); }
