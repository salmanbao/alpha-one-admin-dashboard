/**
 * R2-10/R2-11 — Sealed export bundle helpers (dummy, deterministic).
 *
 * Shared by the Global Consent Ledger (ESP-importable suppression export)
 * and the Cross-Tenant Archive (sealed e-discovery bundles). Duplicated
 * from the prop-admin app layout on purpose — apps do not share module
 * code, only packages/ui components (same split as export-utils.ts).
 */

/** FIPS 180-4 SHA-256 (sync, dependency-free) — seals bundles. */
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
const rotr = (x:number,n:number)=>(x>>>n)|(x<<(32-n));

export function sha256Hex(input:string):string{
  const bytes = new TextEncoder().encode(input);
  const len = bytes.length;
  const padded = ((len + 9 + 63) & ~63);
  const buf = new Uint8Array(padded);
  buf.set(bytes);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padded - 8, Math.floor(bits / 4294967296));
  dv.setUint32(padded - 4, bits >>> 0);

  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64);
  for(let off=0; off<padded; off+=64){
    for(let i=0;i<16;i++) w[i] = dv.getUint32(off + i*4);
    for(let i=16;i<64;i++){
      const a15 = w[i-15], a2 = w[i-2];
      const s0 = rotr(a15,7)^rotr(a15,18)^(a15>>>3);
      const s1 = rotr(a2,17)^rotr(a2,19)^(a2>>>10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
}

/** RFC 4180 cell escaping for suppression/manifest CSVs. */
export function csvCell(v:string|number):string{
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
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

/** Wrap at word boundaries so lines stay inside the A4 text column. */
function wrapLine(s:string, max = 95):string[]{
  if(s.length<=max) return [s];
  const out:string[] = [];
  let rest = s;
  while(rest.length>max){
    let cut = rest.lastIndexOf(" ",max);
    if(cut<max/2) cut = max;
    out.push(rest.slice(0,cut));
    rest = rest.slice(cut + (rest[cut]===" "?1:0));
  }
  if(rest) out.push(rest);
  return out;
}

/**
 * Minimal multi-page PDF writer (single Helvetica font). Content is forced
 * to printable ASCII so string indices are byte offsets for the xref table
 * — validated against poppler's pdfinfo/pdftotext in the R2-08 slice.
 */
export function buildPdf(title:string, lines:string[]):string{
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

/** Trigger a browser download for generated export content. */
export function downloadText(content:string, filename:string, mime:string):void{
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
