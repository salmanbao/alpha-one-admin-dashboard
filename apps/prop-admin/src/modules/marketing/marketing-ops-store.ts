/**
 * Wave 2 — Marketing ops/compliance store (N4-N8, N10, N11, N12 shared pieces).
 * Dummy data only.
 */

export interface BounceEvent {
  id: string; ts: string; email: string; campaignId?: string; reason: "hard" | "soft" | "block" | "complaint"; severity: "high"|"med"|"low"; provider: string; suppressed: boolean; resolved: boolean;
}
let BOUNCES: BounceEvent[] = [
  { id:"b1", ts:new Date(Date.now()-2*3600000).toISOString(), email:"bo***@mailinator.com", campaignId:"cmp-payout", reason:"hard", severity:"high", provider:"SendGrid", suppressed:true, resolved:false },
  { id:"b2", ts:new Date(Date.now()-5*3600000).toISOString(), email:"cl***@gmail.com", campaignId:"cmp-winback", reason:"complaint", severity:"high", provider:"SendGrid", suppressed:true, resolved:false },
  { id:"b3", ts:new Date(Date.now()-12*3600000).toISOString(), email:"te***@yahoo.com", campaignId:"cmp-payout", reason:"soft", severity:"med", provider:"SendGrid", suppressed:false, resolved:false },
  { id:"b4", ts:new Date(Date.now()-26*3600000).toISOString(), email:"ab***@outlook.com", reason:"block", severity:"high", provider:"Twilio", suppressed:true, resolved:false },
];
export function listBounces(){ return BOUNCES; }
export function suppressBounce(id:string, reason:string){ BOUNCES = BOUNCES.map(b=>b.id===id?{...b,suppressed:true,resolved:true}:b); return true; }
export function unsuppressBounce(id:string, reason:string){ BOUNCES = BOUNCES.map(b=>b.id===id?{...b,suppressed:false}:b); return true; }

export type ApprovalState = "draft"|"in_review"|"approved"|"rejected"|"scheduled";
export interface ApprovalItem {
  id:string; campaignId:string; name:string; channel:string; audience:string; spendEst:number; requestedBy:string; requestedAt:string; state:ApprovalState; reviewer?:string; comments:string[]; policyHit:boolean;
}
let APPROVALS: ApprovalItem[] = [
  { id:"ap1", campaignId:"cmp-large", name:"Q4 Scale Blitz", channel:"email", audience:"High value EU (12,400)", spendEst:2480, requestedBy:"S. Malik", requestedAt:new Date(Date.now()-6*3600000).toISOString(), state:"in_review", comments:[], policyHit:true },
  { id:"ap2", campaignId:"cmp-test", name:"Flash SMS", channel:"sms", audience:"Dormant 60d (763)", spendEst:572, requestedBy:"A. Khan", requestedAt:new Date(Date.now()-2*3600000).toISOString(), state:"draft", comments:[], policyHit:false },
];
export function listApprovals(){ return APPROVALS; }
export function submitForReview(id:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"in_review"}:a); }
export function approveItem(id:string, reviewer:string, note:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"approved",reviewer,comments:[...a.comments,`APPROVED by ${reviewer}: ${note}`]}:a); }
export function rejectItem(id:string, reviewer:string, note:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"rejected",reviewer,comments:[...a.comments,`REJECTED by ${reviewer}: ${note}`]}:a); }

export interface ABTest {
  id:string; campaignId:string; name:string; variants:Array<{id:string;name:string;subject?:string;split:number;impressions:number;clicks:number;conversions:number}>; criterion:"open_rate"|"click_rate"|"conversion"; status:"running"|"completed"|"draft"; autoPromote:boolean; winner?:string;
}
let AB: ABTest[] = [
  { id:"ab1", campaignId:"cmp-payout", name:"Subject line test", variants:[
    {id:"v1",name:"A: Payout celebration 🎉",subject:"Payout celebration 🎉",split:50,impressions:6420,clicks:892,conversions:214},
    {id:"v2",name:"B: Your payout is ready",subject:"Your payout is ready",split:50,impressions:6380,clicks:1042,conversions:286},
  ], criterion:"conversion", status:"running", autoPromote:true },
];
export function listAB(){ return AB; }
export function promoteWinner(id:string, winner:string){ AB = AB.map(a=>a.id===id?{...a,winner,status:"completed"}:a); }

export interface DSR { id:string; contact:string; type:"export"|"erasure"|"objection"; status:"new"|"verifying"|"in_progress"|"done"|"rejected"; slaDue:string; filed:string; assignee?:string; actions:string[] }
let DSR_LIST: DSR[] = [
  { id:"dsr1", contact:"le***@scam.net", type:"erasure", status:"verifying", slaDue:new Date(Date.now()+18*3600000).toISOString(), filed:new Date(Date.now()-6*3600000).toISOString(), actions:["Identity verification requested"] },
  { id:"dsr2", contact:"us***@example.com", type:"export", status:"new", slaDue:new Date(Date.now()+36*3600000).toISOString(), filed:new Date(Date.now()-2*3600000).toISOString(), actions:[] },
];
export function listDSR(){ return DSR_LIST; }
export function advanceDSR(id:string, action:string){ DSR_LIST = DSR_LIST.map(d=>d.id===id?{...d,status:d.status==="new"?"verifying":d.status==="verifying"?"in_progress":d.status,actions:[...d.actions,action]}:d); }

export interface VaultEntry { id:string; name:string; provider:string; kind:"api_key"|"oauth"|"cert"|"webhook_secret"; status:"active"|"rotating"|"revoked"; rotatedAt:string; schedule:string; accessLog:Array<{ts:string;actor:string;action:string}>; boundTo:string[] }
let VAULT: VaultEntry[] = [
  { id:"v1", name:"SendGrid API Key", provider:"SendGrid", kind:"api_key", status:"active", rotatedAt:new Date(Date.now()-45*86400000).toISOString(), schedule:"90 days", accessLog:[{ts:new Date(Date.now()-2*3600000).toISOString(),actor:"System",action:"Used by mailer"}], boundTo:["connector:sendgrid"] },
  { id:"v2", name:"Meta WhatsApp Token", provider:"Meta", kind:"oauth", status:"rotating", rotatedAt:new Date(Date.now()-10*86400000).toISOString(), schedule:"60 days", accessLog:[], boundTo:["connector:whatsapp"] },
];
export function listVault(){ return VAULT; }
export function rotateVault(id:string){ VAULT = VAULT.map(v=>v.id===id?{...v,status:"rotating",rotatedAt:new Date().toISOString(),accessLog:[{ts:new Date().toISOString(),actor:"You",action:"Rotation initiated"},...v.accessLog]}:v); }
