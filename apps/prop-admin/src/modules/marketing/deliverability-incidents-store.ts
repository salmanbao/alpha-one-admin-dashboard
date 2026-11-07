/** R2-09 — Deliverability Incident Center (tenant mirror of N14). */
export interface DeliveryIncident { id:string; type:"blocklist"|"domain_reputation"|"provider_degradation"|"quota_throttle"; source:"platform"|"tenant"; status:"open"|"mitigating"|"resolved"; severity:"critical"|"high"|"medium"; affected:string[]; detectedAt:string; timeline:Array<{at:string;event:string}>; playbook:string[]; }
const now=()=>new Date().toISOString();
let INC: DeliveryIncident[] = [
  {id:"inc1",type:"blocklist",source:"platform",status:"open",severity:"critical",affected:["domain: mail.alpha.one","channel: email"],detectedAt:now(),timeline:[{at:now(),event:"Platform detected Spamhaus listing"},{at:now(),event:"Tenant notified"}],playbook:["Pause affected campaigns","Switch provider","Warm alternate domain"]},
  {id:"inc2",type:"provider_degradation",source:"tenant",status:"mitigating",severity:"high",affected:["provider: Twilio","channel: sms"],detectedAt:now(),timeline:[{at:now(),event:"Bounce rate spike detected (N4)"}],playbook:["Throttle sends","Switch provider"]},
];
export function listIncidents(){ return INC; }
export function resolveIncident(id:string){ INC=INC.map(i=>i.id===id?{...i,status:"resolved",timeline:[...i.timeline,{at:now(),event:"Tenant confirmed resolution (fed back to N14)"}]}:i); }
export function applyPlaybook(id:string, action:string){ INC=INC.map(i=>i.id===id?{...i,status:"mitigating",timeline:[...i.timeline,{at:now(),event:`Playbook action: ${action}`}]}:i); }
