/** R2-03 — On-Site Studio (popups/banners/slabs) store. */
export type OnsiteType = "popup"|"banner"|"slab"|"inline";
export type OnsiteStatus = "draft"|"active"|"paused"|"archived";
export interface OnsiteCampaign {
  id:string; name:string; type:OnsiteType; template:string; status:OnsiteStatus;
  trigger:{kind:"page_view"|"scroll"|"exit_intent"|"time_on_page"|"click"; value?:string};
  audience:{segment?:string; country?:string; device?:string; loggedIn?:boolean};
  frequency:{mode:"once"|"session"|"every_n_days"|"suppress_after_conversion"; n?:number};
  impressions:number; clicks:number; dismissals:number; conversions:number; updatedAt:string;
  blocks:Array<{id:string;type:string;label:string}>;
}
const now=()=>new Date().toISOString();
let ITEMS: OnsiteCampaign[] = [
  {id:"os1",name:"KYC Nudge Popup",type:"popup",template:"KYC nudge",status:"active",trigger:{kind:"exit_intent"},audience:{segment:"KYC-verified, not deposited",loggedIn:true},frequency:{mode:"every_n_days",n:3},impressions:8420,clicks:611,dismissals:420,conversions:188,updatedAt:now(),blocks:[{id:"b1",type:"hero",label:"Headline"},{id:"b2",type:"form",label:"Form embed (R2-02)"}]},
  {id:"os2",name:"Deposit Boost Slab",type:"slab",template:"deposit boost",status:"draft",trigger:{kind:"page_view",value:"/dashboard"},audience:{segment:"Funded active"},frequency:{mode:"suppress_after_conversion"},impressions:0,clicks:0,dismissals:0,conversions:0,updatedAt:now(),blocks:[{id:"b1",type:"countdown",label:"Countdown"}]},
];
export function listOnsite(){ return ITEMS; }
export function getOnsite(id:string){ return ITEMS.find(i=>i.id===id); }
export function saveOnsite(p:Partial<OnsiteCampaign>&{id:string}){ ITEMS=ITEMS.map(x=>x.id===p.id?{...x,...p,updatedAt:now()}:x); }
export function createOnsite(name:string,type:OnsiteType,template:string){ const rec:OnsiteCampaign={id:`os-${Date.now()}`,name,type,template,status:"draft",trigger:{kind:"page_view"},audience:{},frequency:{mode:"session"},impressions:0,clicks:0,dismissals:0,conversions:0,updatedAt:now(),blocks:[{id:"b1",type:"hero",label:"Headline"}]}; ITEMS=[rec,...ITEMS]; return rec; }
export function duplicateOnsite(id:string){ const s=getOnsite(id); if(!s) return; ITEMS=[{...s,id:`os-${Date.now()}`,name:`${s.name} (copy)`,status:"draft",updatedAt:now()},...ITEMS]; }
