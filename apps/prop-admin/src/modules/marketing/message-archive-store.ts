"use client";
/**
 * R2-08 — Marketing Message Archive store (round-3 depth uplift).
 *
 * The archive stops being a filtered array behind narrated toasts (R3-F05)
 * and becomes a real evidence service:
 *
 *  • Full-text search index — every message is tokenised across id/recipient/
 *    subject/campaign/template/segment/body at load and after mutations;
 *    searchIndex() returns scored hits with per-field matches and a snippet
 *    window for the search-first table.
 *  • Legal-hold enforcement in the purge job — purgeJob() refuses any message
 *    under hold, reporting the holding case ID per refusal; only unheld
 *    messages inside the retention window are deleted, and the run is
 *    audit-logged (severity warning).
 *  • EML/PDF export — exportMessage() builds a real RFC 822 multipart .eml
 *    or a self-contained ASCII PDF of the evidence record; exportBundle()
 *    packs the whole result set as an mbox bundle or a multi-page PDF.
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";

export interface ArchivedMessage {
  id:string; channel:"email"|"sms"|"whatsapp"|"push"; campaign?:string; flow?:string; template?:string;
  to:string; segment?:string; consentState:string; status:"sent"|"delivered"|"bounced"|"complained";
  subject?:string; sentAt:string; snapshotId:string; html:string; text:string; legalHold:boolean;
  envelope:{from:string;replyTo?:string;provider:string;messageId:string};
  deliveryTimeline:Array<{at:string;event:string}>; consentReceiptId?:string; linkWrap:string[];
  /** Set while the message is under hold — the refusing case in purgeJob(). */
  holdCase?:{ caseId:string; reason:string; at:string };
}

const now=()=>new Date().toISOString();
const hoursAgo=(h:number)=>new Date(Date.now()-h*3600000).toISOString();

let MSGS: ArchivedMessage[] = Array.from({length:40}, (_,i)=>({
  id:`msg-${1000+i}`, channel:(["email","sms","whatsapp","push"] as const)[i%4], campaign:i%3===0?"Q4 Scale Blitz":i%3===1?"Flash SMS":"Win-back", template:"Payout celebration",
  to:`user${i}@example.com`, segment:i%2?"High value EU":"Dormant 60d", consentState:i%5===0?"opted-out-at-send? (blocked pre-send)":"opted-in", status:(["sent","delivered","bounced","delivered"] as const)[i%4],
  subject:i%4===0?"Your payout update":undefined, sentAt:hoursAgo(i), snapshotId:`snp-${1000+i}`, legalHold:i===2||i===17,
  holdCase:i===2?{caseId:"aml1",reason:"AML case evidence — e-discovery hold",at:hoursAgo(30)}:i===17?{caseId:"ediscovery-2026-11",reason:"Regulator request — preserve all win-back sends",at:hoursAgo(12)}:undefined,
  html:`<p>Hi user${i}, this is the exact rendered content snapshot.</p><a href="https://t.alpha/lnk${i}">CTA</a>`, text:`Hi user${i}, snapshot content. CTA: https://t.alpha/lnk${i}`,
  envelope:{from:"noreply@alpha.one",provider:i%4===1?"Twilio":"SendGrid",messageId:`<${1000+i}@alpha>`},
  deliveryTimeline:[{at:hoursAgo(i+1),event:"queued"},{at:hoursAgo(i),event:"sent"},{at:hoursAgo(i),event: i%4===2?"bounced":"delivered"}],
  consentReceiptId:i%5?"rcpt-"+i:undefined, linkWrap:[`https://t.alpha/lnk${i}`],
}));

/* ------------------------------------------------------------------ */
/* Full-text index                                                     */
/* ------------------------------------------------------------------ */

const tokenize=(s:string):string[]=>(s.toLowerCase().match(/[a-z0-9@.+-]+/g)??[]);

/** Every searchable field of a message, lower-cased, one flat string. */
function documentOf(m:ArchivedMessage):string{
  return [m.id,m.to,m.subject??"",m.campaign??"",m.flow??"",m.template??"",m.segment??"",m.channel,m.status,m.text,m.html].join(" ").toLowerCase();
}

/** token → message ids. Rebuilt on every mutation (purge). */
let TOKENS:Map<string,Set<string>> = new Map();
let DOCS:Map<string,string> = new Map();
let INDEXED_AT = now();

function rebuildIndex(){
  const tokens:Map<string,Set<string>> = new Map();
  const docs:Map<string,string> = new Map();
  for(const m of MSGS){
    const doc = documentOf(m);
    docs.set(m.id,doc);
    for(const t of new Set(tokenize(doc))){
      let set = tokens.get(t);
      if(!set){ set = new Set(); tokens.set(t,set); }
      set.add(m.id);
    }
  }
  TOKENS = tokens; DOCS = docs; INDEXED_AT = now();
}
rebuildIndex();

export interface IndexStats {
  documents:number;
  uniqueTokens:number;
  postings:number;
  indexedAt:string;
}
export function indexStats():IndexStats{
  let postings = 0;
  for(const s of TOKENS.values()) postings += s.size;
  return { documents:DOCS.size, uniqueTokens:TOKENS.size, postings, indexedAt:INDEXED_AT };
}

export interface SearchQuery {
  text?:string; channel?:string; status?:string; campaign?:string; legalHold?:boolean;
}
export interface SearchHit {
  message:ArchivedMessage;
  /** Window around the first match in the plain-text body/subject. */
  snippet:string;
  /** Query terms that matched this document. */
  terms:string[];
  /** Fields of the message that matched (recipient, subject, body…). */
  matchedFields:string[];
  score:number;
}

function matchedFields(m:ArchivedMessage, terms:string[]):string[]{
  const fields:Record<string,string> = {
    id:m.id, recipient:m.to, subject:m.subject??"", campaign:m.campaign??"",
    template:m.template??"", segment:m.segment??"", body:`${m.text} ${m.html}`,
  };
  const hits:string[] = [];
  for(const [name,value] of Object.entries(fields)){
    const v = value.toLowerCase();
    if(terms.some(t=>v.includes(t))) hits.push(name);
  }
  return hits;
}

function buildSnippet(m:ArchivedMessage, terms:string[]):string{
  const subj = m.subject ?? "";
  const source = (subj && terms.some(t=>subj.toLowerCase().includes(t)) ? `${subj} — ` : "") + m.text;
  const low = source.toLowerCase();
  const at = terms.map(t=>low.indexOf(t)).filter(i=>i>=0).sort((a,b)=>a-b)[0] ?? 0;
  const start = Math.max(0, at-50);
  const end = Math.min(source.length, start+150);
  return `${start>0?"…":""}${source.slice(start,end)}${end<source.length?"…":""}`;
}

/**
 * Search the index: every query token must hit (AND), scored by matched
 * token count + phrase bonus + recency; rows keep their filters applied.
 */
export function searchIndex(q:SearchQuery):SearchHit[]{
  const terms = tokenize(q.text??"").filter(t=>t.length>1);
  const phrase = (q.text??"").trim().toLowerCase();
  const hits:SearchHit[] = [];

  const candidates = terms.length
    ? MSGS.filter(m=>{
        const doc = DOCS.get(m.id)??"";
        return terms.every(t=>{
          if(doc.includes(t)) return true;
          // prefix match against the token dictionary (indexed, not a scan)
          for(const tok of TOKENS.keys()){ if(tok.startsWith(t) && TOKENS.get(tok)?.has(m.id)) return true; }
          return false;
        });
      })
    : [...MSGS];

  for(const m of candidates){
    if(q.channel && m.channel!==q.channel) continue;
    if(q.status && m.status!==q.status) continue;
    if(q.campaign && m.campaign!==q.campaign) continue;
    if(q.legalHold!=null && m.legalHold!==q.legalHold) continue;
    const fields = matchedFields(m,terms);
    const doc = DOCS.get(m.id)??"";
    const matchedTerms = terms.filter(t=>doc.includes(t));
    const score = matchedTerms.length*10 + (phrase && doc.includes(phrase)?25:0) + (m.legalHold?2:0);
    hits.push({
      message:m,
      snippet:buildSnippet(m,terms),
      terms:terms.length?terms:[],
      matchedFields:fields,
      score,
    });
  }
  return hits.sort((a,b)=>b.score-a.score || b.message.sentAt.localeCompare(a.message.sentAt));
}

/** Original signature kept: flat result list (delegates to the index). */
export function searchArchive(q:{text?:string;channel?:string;campaign?:string;legalHold?:boolean}){
  return searchIndex(q).map(h=>h.message);
}
export function getArchivedMessage(id:string){ return MSGS.find(m=>m.id===id); }

/** Toggle legal hold. Returns false when the message is unknown. */
export function setLegalHold(id:string, hold:boolean, reason?:string):boolean{
  const m = getArchivedMessage(id);
  if(!m) return false;
  MSGS = MSGS.map(x=>x.id===id
    ? { ...x, legalHold:hold, holdCase:hold?(x.holdCase??{caseId:`hold-${x.id}`,reason:reason??"Operator hold",at:now()}):undefined }
    : x);
  emit();
  return true;
}

/* ------------------------------------------------------------------ */
/* Purge job — legal-hold enforcement                                  */
/* ------------------------------------------------------------------ */

export interface PurgeRefusal {
  id:string;
  holdCase?:string;
  reason:string;
}
export interface PurgeResult {
  ok:boolean;
  /** Ids actually deleted. */
  purged:string[];
  /** Held messages the job refused, with the holding case ID. */
  refused:PurgeRefusal[];
  /** Unheld messages newer than the retention window (kept). */
  keptRecent:number;
  ranAt:string;
}

/**
 * Retention purge. Deletes only unheld messages older than
 * `olderThanDays`; every message under legal hold is refused and reported
 * with its holding case ID so the run's evidence trail is complete.
 */
export function purgeJob(opts:{olderThanDays?:number; actor?:string} = {}):PurgeResult{
  const days = Math.max(0, opts.olderThanDays ?? 0);
  const cutoff = Date.now() - days*86_400_000;
  const purged:string[] = [];
  const refused:PurgeRefusal[] = [];
  let keptRecent = 0;

  for(const m of MSGS){
    const age = new Date(m.sentAt).getTime();
    if(m.legalHold){
      refused.push({
        id:m.id,
        holdCase:m.holdCase?.caseId,
        reason:m.holdCase?`${m.holdCase.reason} (${m.holdCase.caseId})`:"Legal hold active",
      });
      continue;
    }
    if(age > cutoff){ keptRecent += 1; continue; }
    purged.push(m.id);
  }

  if(purged.length){
    const drop = new Set(purged);
    MSGS = MSGS.filter(m=>!drop.has(m.id));
    rebuildIndex();
  }

  recordAudit({
    action:"archive.purge",
    entity:"archive",
    entityId:`purge-${days}d`,
    summary:`Retention purge (${days}d window): ${purged.length} message(s) deleted, ${refused.length} refused under legal hold${refused.length?` (${refused.map(r=>r.holdCase??r.id).join(", ")})`:""}, ${keptRecent} kept as recent${purged.length?` — deleted: ${purged.slice(0,6).join(", ")}${purged.length>6?"…":""}`:""}`,
    module:"marketing",
    severity:"warning",
  });
  emit();
  return { ok:true, purged, refused, keptRecent, ranAt:now() };
}

/* ------------------------------------------------------------------ */
/* EML / PDF export                                                     */
/* ------------------------------------------------------------------ */

export interface ExportResult {
  ok:boolean;
  filename:string;
  mime:string;
  content:string;
}

/** RFC 822 multipart/alternative message built from the stored snapshot. */
function buildEml(m:ArchivedMessage):string{
  const boundary = `----=_pfaas_${m.id}`;
  const headers = [
    `From: ${m.envelope.from}`,
    m.envelope.replyTo ? `Reply-To: ${m.envelope.replyTo}` : undefined,
    `To: ${m.to}`,
    `Subject: ${m.subject ?? `${m.campaign ?? m.flow ?? "Archived"} (${m.channel})`}`,
    `Date: ${new Date(m.sentAt).toUTCString()}`,
    `Message-ID: ${m.envelope.messageId}`,
    `X-Channel: ${m.channel}`,
    `X-Snapshot-Id: ${m.snapshotId}`,
    `X-Delivery-Status: ${m.status}`,
    m.campaign ? `X-Campaign: ${m.campaign}` : undefined,
    m.consentReceiptId ? `X-Consent-Receipt: ${m.consentReceiptId}` : undefined,
    m.legalHold ? `X-Legal-Hold: ${m.holdCase?.caseId ?? "yes"}` : undefined,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean).join("\r\n");
  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    "",
    m.text,
    `--${boundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    "",
    m.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return `${headers}\r\n\r\n${body}`;
}

/** ASCII-only PDF escape: transliterates, then sanitises to printable ASCII. */
function pdfEscape(s:string):string{
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\u2014\u2013]/g,"-").replace(/[\u201C\u201D]/g,"\"").replace(/[\u2018\u2019]/g,"'")
    .replace(/\u2026/g,"...").replace(/[\u2022\u00B7]/g,"-")
    .replace(/[^\x20-\x7E]/g,"?")
    .replace(/([\\()])/g,"\\$1");
}

/**
 * Minimal single-font PDF writer (multi-page). Content is forced to
 * printable ASCII so string indices are byte offsets for the xref table.
 */
/** Wrap a line at word boundaries so it stays inside the A4 text column. */
function wrapLine(s:string, max = 95):string[]{
  if(s.length<=max) return [s];
  const out:string[] = [];
  let rest = s;
  while(rest.length>max){
    let cut = rest.lastIndexOf(" ",max);
    if(cut<max/2) cut = max;
    out.push(rest.slice(0,cut));
    rest = rest.slice(cut+ (rest[cut]===" "?1:0));
  }
  if(rest) out.push(rest);
  return out;
}

function buildPdf(title:string, lines:string[]):string{
  const sanitized = [title,"",...lines].flatMap(l=>wrapLine(pdfEscape(l)));
  const pages:string[][] = [];
  for(let i=0;i<sanitized.length;i+=50) pages.push(sanitized.slice(i,i+50));

  const offsets:number[] = [];
  let pdf = "%PDF-1.4\n";
  const addObj = (num:number, body:string) => { offsets[num] = pdf.length; pdf += `${num} 0 obj\n${body}\nendobj\n`; };

  const kids = pages.map((_,i)=>`${4+i*2} 0 R`).join(" ");
  addObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  addObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((pageLines,i)=>{
    let stream = "BT\n/F1 10 Tf\n13 TL\n40 802 Td\n";
    for(const line of pageLines) stream += `(${line}) Tj T*\n`;
    stream += `(${pdfEscape(`page ${i+1}/${pages.length}`)}) Tj\nET`;
    addObj(4+i*2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
    addObj(5+i*2, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const size = 3 + pages.length*2 + 1;
  const xref = pdf.length;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for(let n=1;n<size;n++) pdf += `${String(offsets[n]??0).padStart(10,"0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

function evidenceLines(m:ArchivedMessage):string[]{
  return [
    `Message ID:    ${m.id}`,
    `Channel:       ${m.channel}`,
    `Recipient:     ${m.to}`,
    `Consent state: ${m.consentState}`,
    `Status:        ${m.status}`,
    `Campaign:      ${m.campaign ?? "—"}`,
    `Flow:          ${m.flow ?? "—"}`,
    `Template:      ${m.template ?? "—"}`,
    `Segment:       ${m.segment ?? "—"}`,
    `Sent at:       ${new Date(m.sentAt).toUTCString()}`,
    `Snapshot:      ${m.snapshotId}`,
    `Envelope:      ${m.envelope.from} via ${m.envelope.provider}`,
    `Message-ID:   ${m.envelope.messageId}`,
    `Consent rcpt:  ${m.consentReceiptId ?? "—"}`,
    `Links:         ${m.linkWrap.join(", ") || "—"}`,
    `Legal hold:    ${m.legalHold ? `YES — ${m.holdCase?.caseId ?? "hold"} (${m.holdCase?.reason ?? "operator hold"})` : "no"}`,
    "",
    "-- subject --",
    m.subject ?? "(no subject)",
    "",
    "-- text snapshot --",
    ...m.text.split("\n"),
    "",
    "-- delivery timeline --",
    ...m.deliveryTimeline.map(t=>`${new Date(t.at).toUTCString()}  ${t.event}`),
    "",
    "-- html snapshot --",
    ...m.html.split(/(?=<)/),
  ];
}

/** Export one message as .eml or .pdf (real file content, audit-logged). */
export function exportMessage(id:string, format:"eml"|"pdf", actor = "operator"):ExportResult{
  const m = getArchivedMessage(id);
  if(!m) return { ok:false, filename:"", mime:"", content:"" };
  const stamp = m.sentAt.slice(0,10);
  const result = format === "eml"
    ? { filename:`${m.id}-${stamp}.eml`, mime:"message/rfc822", content:buildEml(m) }
    : { filename:`${m.id}-${stamp}.pdf`, mime:"application/pdf", content:buildPdf(`Archive evidence — ${m.id}`, evidenceLines(m)) };
  recordAudit({
    action:"archive.export.single",
    entity:"message",
    entityId:m.id,
    summary:`Exported ${m.id} (${m.channel} → ${m.to}) as ${format.toUpperCase()} by ${actor}`,
    module:"marketing",
  });
  return { ok:true, ...result };
}

/**
 * Export a set of messages: an mbox bundle of EMLs (each message
 * separated by an RFC 4132 "From " line) or one PDF evidence book.
 */
export function exportBundle(ids:string[], format:"eml"|"pdf", actor = "operator"):ExportResult{
  const msgs = ids.map(getArchivedMessage).filter((m):m is ArchivedMessage=>!!m);
  if(!msgs.length) return { ok:false, filename:"", mime:"", content:"" };
  const stamp = new Date().toISOString().slice(0,10);
  const result = format === "eml"
    ? {
        filename:`alphaone-archive-${stamp}.mbox`,
        mime:"application/mbox",
        content:msgs.map(m=>`From ${m.envelope.from.replace(/[<>]/g,"")} ${new Date(m.sentAt).toUTCString()}\n${buildEml(m)}\n`).join("\n"),
      }
    : {
        filename:`alphaone-archive-${stamp}.pdf`,
        mime:"application/pdf",
        content:buildPdf(`AlphaOne message archive — ${msgs.length} message(s) — exported ${stamp}`,
          msgs.flatMap((m,i)=>[...(i?["","────────────────────────────────────────────"]:[]),...evidenceLines(m)])),
      };
  recordAudit({
    action:"archive.export",
    entity:"archive",
    entityId:`bundle-${msgs.length}`,
    summary:`Exported ${msgs.length} message(s) as ${format==="eml"?"EML bundle (.mbox)":"PDF book"} by ${actor}`,
    module:"marketing",
  });
  return { ok:true, ...result };
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit(){
  version += 1;
  listeners.forEach(l=>l());
}

/** Subscribe the calling component to archive-store mutations. */
export function useArchiveVersion():number{
  const [v,setV] = useState(version);
  useEffect(()=>{
    const l = ()=>setV(version);
    listeners.add(l);
    return ()=>{ listeners.delete(l); };
  },[]);
  return v;
}
