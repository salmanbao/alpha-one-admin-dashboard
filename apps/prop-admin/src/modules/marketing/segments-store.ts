/**
 * M3 — Audience Platform store (spec §7).
 * Dummy data only — no network calls. Module memory so mutations
 * are visible across screens in one session.
 */

/* Condition vocabulary (7.1) */
export type SegmentOperator = "is"|"is_not"|"in"|"between"|"gt"|"lt"|"within_days";
export const OPERATOR_LABEL: Record<SegmentOperator, string> = {
  is:"is", is_not:"is not", in:"in", between:"between", gt:"greater than", lt:"less than", within_days:"within last N days",
};
export type ValueKind = "select"|"multi"|"number"|"range"|"date";
export interface AttributeDef { value:string; label:string; operators:SegmentOperator[]; valueKind:ValueKind; options?:string[] }
export const SEGMENT_ATTRIBUTES: AttributeDef[] = [
  { value:"kyc_status", label:"KYC status", operators:["is","is_not","in"], valueKind:"select", options:["Approved","Pending","Rejected","Expired"] },
  { value:"challenge_phase", label:"Challenge phase", operators:["is","is_not","in"], valueKind:"select", options:["Evaluation","Verification","Funded","Breached","None"] },
  { value:"account_type", label:"Account type", operators:["is","in"], valueKind:"select", options:["25k","50k","100k","200k","400k"] },
  { value:"trading_volume", label:"Trading volume (lots)", operators:["gt","lt","between"], valueKind:"number" },
  { value:"ltv_band", label:"LTV band", operators:["is","in","gt","lt"], valueKind:"select", options:["<$100","$100–500","$500–2k","$2k–10k",">$10k"] },
  { value:"last_login", label:"Last login", operators:["within_days","gt"], valueKind:"number" },
  { value:"country", label:"Country", operators:["is","is_not","in"], valueKind:"multi", options:["Germany","United Kingdom","United States","UAE","India","Brazil","Nigeria","Vietnam"] },
  { value:"device", label:"Device", operators:["is","in"], valueKind:"select", options:["Desktop","Mobile","Tablet"] },
  { value:"signup_source", label:"Signup source", operators:["is","in"], valueKind:"select", options:["Organic","Paid social","Affiliate","Referral","Partner"] },
  { value:"campaign_attribution", label:"Campaign attribution", operators:["is","in"], valueKind:"select", options:["Summer Scale","Q4 Kickoff","Referral Push","Win-back","None"] },
  { value:"risk_score", label:"Risk score", operators:["gt","lt","between"], valueKind:"number" },
  { value:"reward_status", label:"Referral reward status", operators:["is","in"], valueKind:"select", options:["Pending","Credited","Forfeited","None"] },
];
export function getAttribute(value:string){ return SEGMENT_ATTRIBUTES.find(a=>a.value===value); }

/* Condition tree */
export interface SegmentCondition { id:string; kind:"condition"; attribute:string; operator:SegmentOperator; value:string|number|string[]|null }
export interface SegmentGroup { id:string; kind:"group"; op:"AND"|"OR"; children:SegmentNode[] }
export type SegmentNode = SegmentGroup|SegmentCondition;
export function isGroup(n:SegmentNode): n is SegmentGroup { return n.kind==="group"; }
export const newConditionId=()=>`c-${Math.random().toString(36).slice(2,9)}`;
export const newGroupId=()=>`g-${Math.random().toString(36).slice(2,9)}`;
export function emptyCondition(): SegmentCondition { return { id:newConditionId(), kind:"condition", attribute:"", operator:"is", value:null }; }
export function emptyGroup(): SegmentGroup { return { id:newGroupId(), kind:"group", op:"AND", children:[emptyCondition()] }; }
export function treeStats(node:SegmentNode, depth=1): {conditions:number; depth:number} {
  if(!isGroup(node)) return { conditions:1, depth };
  if(node.children.length===0) return { conditions:0, depth };
  let conditions=0, maxDepth=depth;
  for(const c of node.children){ const s=treeStats(c,depth+1); conditions+=s.conditions; maxDepth=Math.max(maxDepth,s.depth); }
  return { conditions, depth:maxDepth };
}
export function hasIncompleteCondition(node:SegmentNode): boolean {
  if(!isGroup(node)) return !node.attribute || node.value===null || node.value==="";
  return node.children.some(hasIncompleteCondition);
}

/* Deterministic estimation */
export interface Estimate { size:number; consentCoverage:number; computed:boolean }
function hashString(s:string){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return Math.abs(h); }
const BASE_AUDIENCE=4820;
export function estimateSegment(root:SegmentGroup): Estimate {
  if(treeStats(root).conditions===0) return { size:0, consentCoverage:0, computed:true };
  const json=JSON.stringify(root);
  function walk(node:SegmentNode): number {
    if(!isGroup(node)){ if(!node.attribute) return 1; return 0.18 + (hashString(`${node.attribute}:${JSON.stringify(node.value)}`)%640)/1000; }
    if(node.children.length===0) return 1;
    const fs=node.children.map(walk);
    const combined = node.op==="AND" ? fs.reduce((a,b)=>a*b,1) : 1-fs.reduce((a,b)=>a*(1-b),1);
    return Math.min(1,Math.max(0.01,combined));
  }
  return { size: Math.max(3, Math.round(BASE_AUDIENCE*walk(root))), consentCoverage: Math.min(99, 58 + (hashString(json)%41)), computed:true };
}

/* Members preview */
export interface SegmentMember { id:string; handle:string; country:string; accountType:string; kyc:string; phase:string; ltv:number; lastLoginDays:number }
const MEMBERS: SegmentMember[] = [
  {id:"m1",handle:"an***@mail.com",country:"Germany",accountType:"100k",kyc:"Approved",phase:"Funded",ltv:4200,lastLoginDays:0},
  {id:"m2",handle:"+49 •••• 4821",country:"Germany",accountType:"50k",kyc:"Approved",phase:"Verification",ltv:980,lastLoginDays:1},
  {id:"m3",handle:"rk***@proton.me",country:"United Kingdom",accountType:"200k",kyc:"Approved",phase:"Funded",ltv:12400,lastLoginDays:0},
  {id:"m4",handle:"+971 •••• 1177",country:"UAE",accountType:"400k",kyc:"Approved",phase:"Funded",ltv:28600,lastLoginDays:2},
  {id:"m5",handle:"ps***@gmail.com",country:"India",accountType:"25k",kyc:"Pending",phase:"Evaluation",ltv:149,lastLoginDays:3},
  {id:"m6",handle:"dv***@outlook.com",country:"Brazil",accountType:"50k",kyc:"Approved",phase:"Breached",ltv:620,lastLoginDays:47},
  {id:"m7",handle:"+234 •••• 9032",country:"Nigeria",accountType:"25k",kyc:"Approved",phase:"Evaluation",ltv:320,lastLoginDays:12},
  {id:"m8",handle:"tn***@yahoo.com",country:"Vietnam",accountType:"100k",kyc:"Expired",phase:"None",ltv:45,lastLoginDays:96},
  {id:"m9",handle:"ml***@gmail.com",country:"United States",accountType:"200k",kyc:"Approved",phase:"Funded",ltv:9100,lastLoginDays:0},
  {id:"m10",handle:"+1 •••• 5510",country:"United States",accountType:"50k",kyc:"Approved",phase:"Verification",ltv:1750,lastLoginDays:4},
  {id:"m11",handle:"sb***@mail.com",country:"India",accountType:"100k",kyc:"Rejected",phase:"None",ltv:0,lastLoginDays:61},
  {id:"m12",handle:"jf***@gmail.com",country:"United Kingdom",accountType:"25k",kyc:"Approved",phase:"Evaluation",ltv:260,lastLoginDays:8},
];
export function sampleMembers(_root:SegmentGroup, limit=10){ return MEMBERS.slice(0,limit); }

/* Starter templates */
export interface SegmentTemplate { key:string; name:string; description:string; conditions:SegmentGroup }
const cond=(attribute:string,operator:SegmentOperator,value:string|number|string[]):SegmentCondition=>({id:newConditionId(),kind:"condition",attribute,operator,value});
const group=(op:"AND"|"OR",children:SegmentNode[]):SegmentGroup=>({id:newGroupId(),kind:"group",op,children});
export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  { key:"funded", name:"Funded traders", description:"Currently on a funded account — prime upsell audience.", conditions: group("AND",[cond("challenge_phase","is","Funded"),cond("kyc_status","is","Approved")]) },
  { key:"dormant", name:"Dormant 60 days", description:"No login in the last 60 days — win-back candidate.", conditions: group("AND",[cond("last_login","gt",60)]) },
  { key:"high-risk", name:"High risk score", description:"Risk score above 70 — suppress aggressive promos.", conditions: group("AND",[cond("risk_score","gt",70)]) },
  { key:"kyc-pending", name:"KYC pending", description:"Awaiting verification — nudge to complete KYC.", conditions: group("AND",[cond("kyc_status","is","Pending")]) },
  { key:"vip-withdrawals", name:"VIP withdrawals", description:"High LTV funded traders with payout activity.", conditions: group("AND",[cond("ltv_band","in",["$2k–10k",">$10k"]),cond("challenge_phase","is","Funded")]) },
];

/* Saved segments */
export interface SegmentUsage { kind:"campaign"|"flow"; id:string; name:string; status:"active"|"draft"|"paused" }
export interface Segment { id:string; name:string; description:string; owner:string; size:number; computedAt:string; status:"active"|"stale"; consentCoverage:number; usedBy:SegmentUsage[]; conditions:SegmentGroup }
const hoursAgo=(h:number)=>new Date(Date.now()-h*3_600_000).toISOString();
let SEGMENTS: Segment[] = [
  { id:"seg-funded", name:"Funded traders", description:"Active funded-account holders across all sizes.", owner:"S. Malik", size:1284, computedAt:hoursAgo(2), status:"active", consentCoverage:92, usedBy:[{kind:"campaign",id:"cmp-payout",name:"Payout celebration",status:"active"},{kind:"flow",id:"flow-upsell",name:"Scaling plan upsell",status:"active"}], conditions:SEGMENT_TEMPLATES[0].conditions },
  { id:"seg-dormant", name:"Dormant 60 days", description:"Traders with no login in the last 60 days.", owner:"A. Khan", size:763, computedAt:hoursAgo(27), status:"stale", consentCoverage:71, usedBy:[{kind:"campaign",id:"cmp-winback",name:"Win-back wave 2",status:"draft"}], conditions:SEGMENT_TEMPLATES[1].conditions },
  { id:"seg-kyc-pending", name:"KYC pending", description:"Signed up but not yet verified.", owner:"S. Malik", size:342, computedAt:hoursAgo(1), status:"active", consentCoverage:97, usedBy:[{kind:"flow",id:"flow-kyc",name:"Welcome & KYC nudge",status:"active"}], conditions:SEGMENT_TEMPLATES[3].conditions },
  { id:"seg-vip", name:"VIP withdrawals", description:"High-LTV funded traders with payout activity.", owner:"R. Idris", size:96, computedAt:hoursAgo(5), status:"active", consentCoverage:88, usedBy:[], conditions:SEGMENT_TEMPLATES[4].conditions },
  { id:"seg-risk", name:"High risk score", description:"Risk score above 70 — promo suppression guard.", owner:"Risk Bot", size:218, computedAt:hoursAgo(70), status:"stale", consentCoverage:64, usedBy:[{kind:"flow",id:"flow-risk",name:"Risk-aware nurture",status:"paused"}], conditions:SEGMENT_TEMPLATES[2].conditions },
];
export function listSegments(){ return SEGMENTS; }
export function getSegment(id:string){ return SEGMENTS.find(s=>s.id===id); }
export function isDuplicateSegmentName(name:string, excludeId?:string){ const n=name.trim().toLowerCase(); return SEGMENTS.some(s=>s.id!==excludeId && s.name.trim().toLowerCase()===n); }
export type SaveSegmentResult = {ok:true; segment:Segment}|{ok:false; error:string};
export function saveSegment(input:{id?:string;name:string;description:string;conditions:SegmentGroup}): SaveSegmentResult {
  const name=input.name.trim(); if(!name) return {ok:false,error:"Segment name is required."};
  if(isDuplicateSegmentName(name,input.id)) return {ok:false,error:"A segment with this name already exists."};
  const est=estimateSegment(input.conditions); const existing=input.id?SEGMENTS.find(s=>s.id===input.id):undefined;
  const segment: Segment = { id:existing?.id??`seg-${Math.random().toString(36).slice(2,9)}`, name, description:input.description.trim(), owner:existing?.owner??"You", size:est.size, computedAt:new Date().toISOString(), status:"active", consentCoverage:est.consentCoverage, usedBy:existing?.usedBy??[], conditions:input.conditions };
  if(existing) SEGMENTS=SEGMENTS.map(s=>s.id===existing.id?segment:s); else SEGMENTS=[segment,...SEGMENTS];
  return {ok:true,segment};
}
export function deleteSegment(id:string){ const seg=SEGMENTS.find(s=>s.id===id); if(!seg) return {ok:false as const, blockedBy:[] as SegmentUsage[]}; const blockers=seg.usedBy.filter(u=>u.status==="active"); if(blockers.length>0) return {ok:false as const, blockedBy:blockers}; SEGMENTS=SEGMENTS.filter(s=>s.id!==id); return {ok:true as const, blockedBy:[] as SegmentUsage[]}; }
export function recomputeSegment(id:string){ const seg=SEGMENTS.find(s=>s.id===id); if(!seg) return undefined; const est=estimateSegment(seg.conditions); const u:Segment={...seg,size:est.size,consentCoverage:est.consentCoverage,computedAt:new Date().toISOString(),status:"active"}; SEGMENTS=SEGMENTS.map(s=>s.id===id?u:s); return u; }
export function duplicateSegment(id:string){ const seg=SEGMENTS.find(s=>s.id===id); if(!seg) return undefined; let name=`${seg.name} (copy)`; let i=2; while(isDuplicateSegmentName(name)) name=`${seg.name} (copy ${i++})`; const copy:Segment={...seg,id:`seg-${Math.random().toString(36).slice(2,9)}`,name,owner:"You",usedBy:[],computedAt:new Date().toISOString()}; SEGMENTS=[copy,...SEGMENTS]; return copy; }

/* Consent & suppression */
export type ConsentChannel = "email"|"sms"|"whatsapp"|"push"|"in-app";
export const CONSENT_CHANNEL_LABEL: Record<ConsentChannel,string> = { email:"Email", sms:"SMS", whatsapp:"WhatsApp", push:"Push", "in-app":"In-app" };
export type MarketingChannel = ConsentChannel;
export interface ConsentRecord { id:string; contact:string; channel:ConsentChannel; status:"granted"|"withdrawn"; source:"form"|"import"|"api"|"admin"; origin:string; timestamp:string; evidence:string }
export type SuppressionReason = "hard_bounce"|"complaint"|"manual"|"legal";
export const SUPPRESSION_REASON_LABEL: Record<SuppressionReason,string> = { hard_bounce:"Hard bounce", complaint:"Complaint", manual:"Manual", legal:"Legal" };
export interface SuppressionEntry { id:string; contact:string; reason:SuppressionReason; addedBy:string; date:string; source:string; note?:string }
const iso=(d:number)=>new Date(Date.now()-d*86_400_000).toISOString();
let CONSENT: ConsentRecord[] = [
  {id:"cr-1",contact:"an***@mail.com",channel:"email",status:"granted",source:"form",origin:"Website signup footer",timestamp:iso(14),evidence:"ev_9f21a"},
  {id:"cr-2",contact:"an***@mail.com",channel:"push",status:"granted",source:"api",origin:"Browser prompt grant",timestamp:iso(14),evidence:"ev_9f21b"},
  {id:"cr-3",contact:"rk***@proton.me",channel:"email",status:"withdrawn",source:"form",origin:"Unsubscribe link footer",timestamp:iso(3),evidence:"ev_71cc0"},
  {id:"cr-4",contact:"+49 •••• 4821",channel:"sms",status:"granted",source:"import",origin:"CSV import 2026-09-12",timestamp:iso(52),evidence:"ev_30ab7"},
  {id:"cr-5",contact:"ps***@gmail.com",channel:"email",status:"granted",source:"form",origin:"Challenge registration",timestamp:iso(6),evidence:"ev_55d1e"},
  {id:"cr-6",contact:"+971 •••• 1177",channel:"whatsapp",status:"granted",source:"api",origin:"WhatsApp opt-in widget",timestamp:iso(21),evidence:"ev_11fa2"},
  {id:"cr-7",contact:"dv***@outlook.com",channel:"email",status:"withdrawn",source:"admin",origin:"Support ticket #4821",timestamp:iso(9),evidence:"ev_77b31"},
  {id:"cr-8",contact:"ml***@gmail.com",channel:"email",status:"granted",source:"form",origin:"Newsletter box",timestamp:iso(40),evidence:"ev_2c8d4"},
  {id:"cr-9",contact:"+1 •••• 5510",channel:"sms",status:"withdrawn",source:"api",origin:"STOP keyword reply",timestamp:iso(2),evidence:"ev_4ad95"},
  {id:"cr-10",contact:"jf***@gmail.com",channel:"in-app",status:"granted",source:"api",origin:"Product onboarding",timestamp:iso(30),evidence:"ev_6f0aa"},
];
let SUPPRESSION: SuppressionEntry[] = [
  {id:"sup-1",contact:"bo***@mailinator.com",reason:"hard_bounce",addedBy:"System",date:iso(4),source:"Send bounces feed"},
  {id:"sup-2",contact:"cl***@gmail.com",reason:"complaint",addedBy:"System",date:iso(16),source:"Provider complaint feed"},
  {id:"sup-3",contact:"le***@scam.net",reason:"legal",addedBy:"R. Idris",date:iso(25),source:"GDPR erasure request",note:"Article 17 request — must never be re-mailable."},
  {id:"sup-4",contact:"+62 •••• 8841",reason:"manual",addedBy:"S. Malik",date:iso(7),source:"Support escalation",note:"Abusive replies to campaigns."},
];
export function listConsent(){ return CONSENT; }
export function listSuppression(){ return SUPPRESSION; }
export function addConsent(r:Omit<ConsentRecord,"id"|"timestamp">){ const rec:ConsentRecord={...r,id:`cr-${Math.random().toString(36).slice(2,9)}`,timestamp:new Date().toISOString()}; CONSENT=[rec,...CONSENT]; return rec; }
export function addSuppression(e:Omit<SuppressionEntry,"id"|"date">){ const rec:SuppressionEntry={...e,id:`sup-${Math.random().toString(36).slice(2,9)}`,date:new Date().toISOString()}; SUPPRESSION=[rec,...SUPPRESSION]; return rec; }
export function removeSuppression(id:string){ const b=SUPPRESSION.length; SUPPRESSION=SUPPRESSION.filter(s=>s.id!==id); return SUPPRESSION.length<b; }
export function consentStats(){ const granted=CONSENT.filter(c=>c.status==="granted").length; const coverage=CONSENT.length?Math.round((granted/CONSENT.length)*100):0; const now=Date.now(); const w=now-30*86_400_000; return { coverage, withdrawals30d: CONSENT.filter(c=>c.status==="withdrawn"&&new Date(c.timestamp).getTime()>w).length, suppressions30d: SUPPRESSION.filter(s=>new Date(s.date).getTime()>w).length, pendingScans:2 }; }

/* Contact sync (7.4) */
export type SyncDirection = "push"|"pull"|"two-way";
export type SyncStatus = "ok"|"error"|"paused"|"syncing";
export interface SyncDestination { id:string; name:string; kind:"esp"|"crm"; iconKey:string; direction:SyncDirection; lastSync:string; synced:number; failed:number; mappedFields:number; status:SyncStatus; progress?:number; error?:string }
export interface SyncMappingRow { id:string; platformField:string; localField:string; type:"string"|"email"|"number"|"date"|"bool"; pii:boolean }
export interface SyncErrorRow { id:string; contact:string; destinationId:string; reason:string; firstSeen:string; attempts:number }
let DESTINATIONS: SyncDestination[] = [
  {id:"ds-klaviyo",name:"Klaviyo",kind:"esp",iconKey:"klaviyo",direction:"two-way",lastSync:hoursAgo(1),synced:4120,failed:3,mappedFields:9,status:"ok"},
  {id:"ds-listmonk",name:"Listmonk (self-hosted)",kind:"esp",iconKey:"listmonk",direction:"push",lastSync:hoursAgo(4),synced:1860,failed:0,mappedFields:7,status:"ok"},
  {id:"ds-mailchimp",name:"Mailchimp",kind:"esp",iconKey:"mailchimp",direction:"two-way",lastSync:hoursAgo(26),synced:2310,failed:12,mappedFields:8,status:"error",error:"429 rate limited — retry window opens in 18 min."},
  {id:"ds-hubspot",name:"HubSpot CRM",kind:"crm",iconKey:"hubspot",direction:"pull",lastSync:hoursAgo(2),synced:940,failed:1,mappedFields:11,status:"ok"},
  {id:"ds-crm-internal",name:"Internal CRM",kind:"crm",iconKey:"crm",direction:"two-way",lastSync:hoursAgo(0.5),synced:5233,failed:0,mappedFields:12,status:"ok"},
];
const MAPPINGS: Record<string,SyncMappingRow[]> = {
  "ds-klaviyo":[
    {id:"map-1",platformField:"email",localField:"contact.email",type:"email",pii:true},
    {id:"map-2",platformField:"first_name",localField:"profile.firstName",type:"string",pii:true},
    {id:"map-3",platformField:"phone",localField:"contact.phone",type:"string",pii:true},
    {id:"map-4",platformField:"account_size",localField:"account.size",type:"number",pii:false},
    {id:"map-5",platformField:"is_funded",localField:"account.funded",type:"bool",pii:false},
  ],
  "ds-crm-internal":[
    {id:"map-7",platformField:"email",localField:"contact.email",type:"email",pii:true},
    {id:"map-8",platformField:"stage",localField:"crm.stage",type:"string",pii:false},
  ],
};
let ERRORS: SyncErrorRow[] = [
  {id:"err-1",contact:"bo***@mailinator.com",destinationId:"ds-klaviyo",reason:"Invalid email — 550 mailbox unavailable",firstSeen:hoursAgo(5),attempts:3},
  {id:"err-2",contact:"ps***@gmail.com",destinationId:"ds-mailchimp",reason:"Rate limited (429)",firstSeen:hoursAgo(25),attempts:5},
  {id:"err-3",contact:"+62 •••• 8841",destinationId:"ds-mailchimp",reason:"Missing required field: country",firstSeen:hoursAgo(24),attempts:2},
];
export function listSyncDestinations(){ return DESTINATIONS; }
export function listSyncMappings(id:string){ return MAPPINGS[id] ?? []; }
export function saveSyncMappings(id:string, rows:SyncMappingRow[]){ MAPPINGS[id]=rows; }
export function listSyncErrors(){ return ERRORS; }
export function startSync(id:string){ const d=DESTINATIONS.find(x=>x.id===id); if(!d) return undefined; const u:SyncDestination={...d,status:"syncing",progress:8,error:undefined}; DESTINATIONS=DESTINATIONS.map(x=>x.id===id?u:x); return u; }
export function completeSync(id:string){ const d=DESTINATIONS.find(x=>x.id===id); if(!d) return undefined; const u:SyncDestination={...d,status:"ok",progress:100,lastSync:new Date().toISOString(),synced:d.synced+140,failed:0}; DESTINATIONS=DESTINATIONS.map(x=>x.id===id?u:x); return u; }
export function toggleDestinationPause(id:string){ const d=DESTINATIONS.find(x=>x.id===id); if(!d) return undefined; const u:SyncDestination={...d,status:d.status==="paused"?"ok":"paused"}; DESTINATIONS=DESTINATIONS.map(x=>x.id===id?u:x); return u; }
export function retrySyncError(id:string){ const row=ERRORS.find(e=>e.id===id); if(!row) return false; ERRORS=ERRORS.filter(e=>e.id!==id); DESTINATIONS=DESTINATIONS.map(d=>d.id===row.destinationId?{...d,synced:d.synced+1,failed:Math.max(0,d.failed-1)}:d); return true; }
export function skipSyncError(id:string){ const b=ERRORS.length; ERRORS=ERRORS.filter(e=>e.id!==id); return ERRORS.length<b; }

/* Composer helper */
export function excludedByConsent(segment:Segment){ return Math.max(0, Math.round((segment.size*(100-segment.consentCoverage))/100)); }
