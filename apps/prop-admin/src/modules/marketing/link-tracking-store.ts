/** R2-06 — Link Tracking & UTM Manager store. */
export interface TrackedLink {
  id:string; destination:string; slug:string; campaign?:string; source:string; medium:string; content?:string;
  clicks:number; conversions:number; referrers:Array<{name:string;pct:number}>; devices:Record<string,number>; geo:Record<string,number>;
  expiresAt?:string; password?:boolean; deleted?:boolean; trend:number[];
}
/** Canonical tag taxonomy (AC-2 blocks free-text mediums outside allowed set). */
export const ALLOWED_MEDIUMS = ["email","sms","push","social","cpc","affiliate","onsite","qr"] as const;
export const ALLOWED_SOURCES = ["newsletter","promo","challenge","webinar","referral"] as const;
let LINKS: TrackedLink[] = [
  {id:"ln1",destination:"https://alpha.one/challenge/100k",slug:"/go/100k",campaign:"Q4 Scale Blitz",source:"promo",medium:"email",content:"hero-cta",clicks:1240,conversions:84,referrers:[{name:"gmail",pct:41},{name:"outlook",pct:22},{name:"direct",pct:37}],devices:{desktop:610,mobile:580,tablet:50},geo:{US:520,DE:310,UK:190},trend:[12,18,21,19,25,28,31]},
  {id:"ln2",destination:"https://alpha.one/webinar",slug:"/go/webinar",source:"webinar",medium:"social",content:"linkedin-post",clicks:412,conversions:31,referrers:[{name:"linkedin",pct:64},{name:"direct",pct:36}],devices:{mobile:290,desktop:110,tablet:12},geo:{US:180,IN:120,UK:60},trend:[4,7,9,11,10,12,14]},
  {id:"ln3",destination:"https://alpha.one/promo/summer",slug:"/go/summer",source:"promo",medium:"cpc",clicks:980,conversions:52,referrers:[{name:"google",pct:82}],devices:{mobile:610,desktop:350,tablet:20},geo:{US:400,CA:120},expiresAt:new Date(Date.now()+12*86400000).toISOString(),trend:[30,28,22,18,14,10,6]},
];
export function listLinks(){ return LINKS.filter(l=>!l.deleted); }
export function getLink(id:string){ return LINKS.find(l=>l.id===id); }
export function mediumValid(m:string){ return (ALLOWED_MEDIUMS as readonly string[]).includes(m); }
export function sourceValid(s:string){ return (ALLOWED_SOURCES as readonly string[]).includes(s); }
export function createLink(input: Omit<TrackedLink,"id"|"clicks"|"conversions"|"referrers"|"devices"|"geo"|"trend"|"slug"> & {slug?:string}){
  if(!mediumValid(input.medium)) return {ok:false as const, reason:`Medium "${input.medium}" outside canonical taxonomy. Allowed: ${ALLOWED_MEDIUMS.join(", ")}`};
  if(!sourceValid(input.source)) return {ok:false as const, reason:`Source "${input.source}" outside taxonomy. Allowed: ${ALLOWED_SOURCES.join(", ")}`};
  const rec:TrackedLink={id:`ln-${Date.now()}`,slug:`/go/${(input.medium.slice(0,2)+Date.now().toString().slice(-5))}`,clicks:0,conversions:0,referrers:[],devices:{},geo:{},trend:[],...input};
  LINKS=[rec,...LINKS]; return {ok:true as const, link:rec};
}
export function softDeleteLink(id:string){ LINKS=LINKS.map(l=>l.id===id?{...l,deleted:true}:l); }
export function recordClick(id:string){ LINKS=LINKS.map(l=>l.id===id?{...l,clicks:l.clicks+1,trend:[...l.trend.slice(-6),l.clicks+1]}:l); }
