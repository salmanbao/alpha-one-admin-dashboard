/** R2-08 — Marketing Message Archive store. */
export interface ArchivedMessage {
  id:string; channel:"email"|"sms"|"whatsapp"|"push"; campaign?:string; flow?:string; template?:string;
  to:string; segment?:string; consentState:string; status:"sent"|"delivered"|"bounced"|"complained";
  subject?:string; sentAt:string; snapshotId:string; html:string; text:string; legalHold:boolean;
  envelope:{from:string;replyTo?:string;provider:string;messageId:string};
  deliveryTimeline:Array<{at:string;event:string}>; consentReceiptId?:string; linkWrap:string[];
}
const now=()=>new Date().toISOString();
let MSGS: ArchivedMessage[] = Array.from({length:40}, (_,i)=>({
  id:`msg-${1000+i}`, channel:(["email","sms","whatsapp","push"] as const)[i%4], campaign:i%3===0?"Q4 Scale Blitz":i%3===1?"Flash SMS":"Win-back", template:"Payout celebration",
  to:`user${i}@example.com`, segment:i%2?"High value EU":"Dormant 60d", consentState:i%5===0?"opted-out-at-send? (blocked pre-send)":"opted-in", status:(["sent","delivered","bounced","delivered"] as const)[i%4],
  subject:i%4===0?"Your payout update":undefined, sentAt:new Date(Date.now()-i*3600000).toISOString(), snapshotId:`snp-${1000+i}`, legalHold:i===2,
  html:`<p>Hi user${i}, this is the exact rendered content snapshot.</p><a href=\"https://t.alpha/lnk${i}\">CTA</a>`, text:`Hi user${i}, snapshot content. CTA: https://t.alpha/lnk${i}`,
  envelope:{from:"noreply@alpha.one",provider:i%4===1?"Twilio":"SendGrid",messageId:`<${1000+i}@alpha>`},
  deliveryTimeline:[{at:now(),event:"queued"},{at:now(),event:"sent"},{at:now(),event: i%4===2?"bounced":"delivered"}],
  consentReceiptId:i%5?"rcpt-"+i:undefined, linkWrap:[`https://t.alpha/lnk${i}`],
}));
export function searchArchive(q:{text?:string;channel?:string;campaign?:string;legalHold?:boolean}){ let r=MSGS; const t=(q.text||"").toLowerCase(); if(t) r=r.filter(m=>`${m.to} ${m.campaign||""} ${m.subject||""} ${m.template||""}`.toLowerCase().includes(t)); if(q.channel) r=r.filter(m=>m.channel===q.channel); if(q.campaign) r=r.filter(m=>m.campaign===q.campaign); if(q.legalHold!=null) r=r.filter(m=>m.legalHold===q.legalHold); return r; }
export function getArchivedMessage(id:string){ return MSGS.find(m=>m.id===id); }
export function setLegalHold(id:string, hold:boolean){ MSGS=MSGS.map(m=>m.id===id?{...m,legalHold:hold}:m); }
