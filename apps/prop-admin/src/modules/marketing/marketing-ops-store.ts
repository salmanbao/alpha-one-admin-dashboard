/**
 * Marketing ops/compliance store (N4-N8, N10, N11, N12 + R2-A depth: F02/F04/F06).
 * Dummy data only; store API shaped for future gateway/ops service wiring.
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
export interface ContentSnapshot { id:string; at:string; by:string; subject?:string; preheader?:string; body:string; segment:string; channel:string; }
export interface ApprovalItem {
  id:string; campaignId:string; name:string; channel:string; audience:string; spendEst:number; requestedBy:string; requestedAt:string; state:ApprovalState; reviewer?:string; assignee?:string; delegateTo?:string; slaDue?:string; comments:string[]; policyHit:boolean;
  snapshotAtSubmit?: ContentSnapshot; snapshotAtApprove?: ContentSnapshot; // R2-F04
}
const now=()=>new Date().toISOString();
let APPROVALS: ApprovalItem[] = [
  { id:"ap1", campaignId:"cmp-large", name:"Q4 Scale Blitz", channel:"email", audience:"High value EU (12,400)", spendEst:2480, requestedBy:"S. Malik", requestedAt:new Date(Date.now()-6*3600000).toISOString(), state:"in_review", assignee:"Compliance Team", slaDue:new Date(Date.now()+2*3600000).toISOString(), comments:["System: policy-routed (spend > $2k)."], policyHit:true,
    snapshotAtSubmit:{id:"snp-ap1-1",at:new Date(Date.now()-6*3600000).toISOString(),by:"S. Malik",subject:"Scale into Q4 with 20% off",preheader:"Limited seats",body:"Hi {{first_name}}, unlock 20% on your next challenge. CTA: /checkout?promo=Q4",segment:"High value EU (12,400)",channel:"email"} },
  { id:"ap2", campaignId:"cmp-test", name:"Flash SMS", channel:"sms", audience:"Dormant 60d (763)", spendEst:572, requestedBy:"A. Khan", requestedAt:new Date(Date.now()-2*3600000).toISOString(), state:"draft", assignee:"A. Khan", comments:[], policyHit:false },
];
export function listApprovals(){ return APPROVALS; }
export function submitForReview(id:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"in_review",snapshotAtSubmit:a.snapshotAtSubmit||{id:`snp-${id}-${Date.now()}`,at:now(),by:a.requestedBy,subject:a.name,body:`Draft content snapshot for ${a.name} (${a.channel})`,segment:a.audience,channel:a.channel}}:a); }
export function approveItem(id:string, reviewer:string, note:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"approved",reviewer,snapshotAtApprove:a.snapshotAtSubmit?{...a.snapshotAtSubmit,id:`snp-${id}-appr`,at:now(),by:reviewer}:undefined,comments:[...a.comments,`APPROVED by ${reviewer}: ${note}`]}:a); }
export function rejectItem(id:string, reviewer:string, note:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,state:"rejected",reviewer,comments:[...a.comments,`REJECTED by ${reviewer}: ${note}`]}:a); }
export function commentApproval(id:string, who:string, note:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,comments:[...a.comments,`${who}: ${note}`]}:a); }
export function delegateApproval(id:string, to:string){ APPROVALS = APPROVALS.map(a=>a.id===id?{...a,delegateTo:to,assignee:to,comments:[...a.comments,`Delegated to ${to}`]}:a); }

export interface ABVariant { id:string;name:string;subject?:string;body?:string;split:number;impressions:number;clicks:number;conversions:number }
export interface ABTest {
  id:string; campaignId:string; name:string; variants:ABVariant[]; criterion:"open_rate"|"click_rate"|"conversion"; status:"running"|"completed"|"draft"; autoPromote:boolean; winner?:string; startedAt?:string; sampleTarget?:number; snapshotId?:string;
}
let AB: ABTest[] = [
  { id:"ab1", campaignId:"cmp-payout", name:"Subject line test", variants:[
    {id:"v1",name:"A: Payout celebration 🎉",subject:"Payout celebration 🎉",body:"Congrats {{name}}!",split:50,impressions:6420,clicks:892,conversions:214},
    {id:"v2",name:"B: Your payout is ready",subject:"Your payout is ready",body:"Your payout is approved.",split:50,impressions:6380,clicks:1042,conversions:286},
  ], criterion:"conversion", status:"running", autoPromote:true, sampleTarget:15000, snapshotId:"snp-ab1" },
];
export function listAB(){ return AB; }
export function promoteWinner(id:string, winner:string){ AB = AB.map(a=>a.id===id?{...a,winner,status:"completed"}:a); }
export function updateABTest(id:string, patch: Partial<ABTest>){ AB = AB.map(a=>a.id===id?{...a,...patch}:a); }
export function addABVariant(id:string, v: ABVariant){ AB = AB.map(a=>a.id===id && a.variants.length<4?{...a,variants:[...a.variants,v]}:a); }
export function removeABVariant(testId:string, variantId:string){ AB = AB.map(a=>a.id===testId && a.variants.length>2?{...a,variants:a.variants.filter(v=>v.id!==variantId)}:a); }

export interface DSR { id:string; contact:string; type:"export"|"erasure"|"objection"; status:"new"|"verifying"|"in_progress"|"done"|"rejected"; slaDue:string; filed:string; assignee?:string; actions:string[] }
let DSR_LIST: DSR[] = [
  { id:"dsr1", contact:"le***@scam.net", type:"erasure", status:"verifying", slaDue:new Date(Date.now()+18*3600000).toISOString(), filed:new Date(Date.now()-6*3600000).toISOString(), actions:["Identity verification requested"] },
  { id:"dsr2", contact:"us***@example.com", type:"export", status:"new", slaDue:new Date(Date.now()+36*3600000).toISOString(), filed:new Date(Date.now()-2*3600000).toISOString(), actions:[] },
];
export function listDSR(){ return DSR_LIST; }
export function advanceDSR(id:string, action:string){ DSR_LIST = DSR_LIST.map(d=>d.id===id?{...d,status:d.status==="new"?"verifying":d.status==="verifying"?"in_progress":d.status,actions:[...d.actions,action]}:d); }

export interface VaultEntry { id:string; name:string; provider:string; kind:"api_key"|"oauth"|"cert"|"webhook_secret"; status:"active"|"rotating"|"revoked"|"scheduled"; masked:string; rotatedAt:string; nextRotation?:string; schedule:string; accessLog:Array<{ts:string;actor:string;action:string}>; boundTo:string[]; usageMap:Array<{system:string;ref:string}>; breakGlass:boolean }
let VAULT: VaultEntry[] = [
  { id:"v1", name:"SendGrid API Key", provider:"SendGrid", kind:"api_key", status:"active", masked:"SG.••••••••w9Q2", rotatedAt:new Date(Date.now()-45*86400000).toISOString(), nextRotation:new Date(Date.now()+45*86400000).toISOString(), schedule:"90 days", accessLog:[{ts:new Date(Date.now()-2*3600000).toISOString(),actor:"System",action:"Used by mailer"}], boundTo:["connector:sendgrid"], usageMap:[{system:"Email provider (M1)",ref:"vault/email/sendgrid"},{system:"Campaign composer",ref:"secretRef"}], breakGlass:false },
  { id:"v2", name:"Meta WhatsApp Token", provider:"Meta", kind:"oauth", status:"scheduled", masked:"EAAB••••••••K3m", rotatedAt:new Date(Date.now()-10*86400000).toISOString(), nextRotation:new Date(Date.now()+50*86400000).toISOString(), schedule:"60 days", accessLog:[], boundTo:["connector:whatsapp"], usageMap:[{system:"WhatsApp templates (N2)",ref:"vault/wa/meta"}], breakGlass:false },
];
export function listVault(){ return VAULT; }
export function rotateVault(id:string){ VAULT = VAULT.map(v=>v.id===id?{...v,status:"rotating",rotatedAt:new Date().toISOString(),accessLog:[{ts:new Date().toISOString(),actor:"operator",action:"Rotation initiated"},...v.accessLog]}:v); }
export function createVaultEntry(e: Omit<VaultEntry,"id"|"accessLog"|"masked"|"status"> & {secretValue?:string}){ const rec:VaultEntry={id:`v-${Date.now()}`,status:"active",masked:(e.name.slice(0,2).toUpperCase()||"VK")+".••••••••"+Math.random().toString(36).slice(2,6),accessLog:[{ts:now(),actor:"operator",action:"Credential created (value stored as vault ref; raw not retained in UI)"}], ...e, schedule:e.schedule||"90 days", boundTo:e.boundTo||[], usageMap:e.usageMap||[], breakGlass:false}; VAULT=[rec,...VAULT]; return rec; }
export function updateVaultEntry(id:string, patch: Partial<VaultEntry>){ VAULT = VAULT.map(v=>v.id===id?{...v,...patch}:v); }
export function deleteVaultEntry(id:string){ VAULT = VAULT.filter(v=>v.id!==id); }
export function revealVault(id:string, reason:string){ VAULT = VAULT.map(v=>v.id===id?{...v,accessLog:[{ts:now(),actor:"operator",action:`BREAK-GLASS reveal: ${reason}`},...v.accessLog]}:v); return "••• revealed in secure channel (dummy) •••"; }
