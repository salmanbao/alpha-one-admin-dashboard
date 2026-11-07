/** R2-04 — Brand & Creative Asset Library store. */
export type AssetType = "logo"|"image"|"video"|"copy_block"|"countdown_preset";
export interface Asset { id:string; name:string; type:AssetType; tags:string[]; usedBy:string[]; expiresAt?:string; url?:string; meta?:Record<string,string> }
export interface BrandKit { primary:string; secondary:string; fontHeading:string; fontBody:string; logos:{light?:string;dark?:string;favicon?:string} }
const now=()=>new Date().toISOString();
let ASSETS: Asset[] = [
  {id:"a1",name:"AlphaOne Logo Dark",type:"logo",tags:["brand","logo"],usedBy:["Landing: 100K Promo","Template: Payout celebration"],url:"/brand/logo-dark.svg",meta:{variant:"dark"}},
  {id:"a2",name:"Hero Challenge Banner",type:"image",tags:["hero","promo"],usedBy:["Landing: 100K Promo"],url:"https://cdn.alpha.one/img/hero-100k.jpg"},
  {id:"a3",name:"Compliance Disclaimer",type:"copy_block",tags:["legal","footer"],usedBy:["Template: Win-back","Form: Challenge Interest"],meta:{text:"Trading involves risk. Past performance is not indicative of future results."}},
  {id:"a4",name:"Q4 Countdown",type:"countdown_preset",tags:["promo"],usedBy:["On-site: Deposit Boost Slab"],expiresAt:new Date(Date.now()+30*86400000).toISOString()},
];
let BRAND: BrandKit = {primary:"#0B1F3A",secondary:"#22C55E",fontHeading:"Inter",fontBody:"Inter",logos:{light:"a1-light",dark:"a1",favicon:"a1-fav"}};
export function listAssets(){ return ASSETS; }
export function getAsset(id:string){ return ASSETS.find(a=>a.id===id); }
export function saveAsset(a:Partial<Asset>&{id:string}){ ASSETS=ASSETS.map(x=>x.id===a.id?{...x,...a}:x); }
export function createAsset(input: Omit<Asset,"id"|"usedBy">){ const rec:Asset={id:`a-${Date.now()}`,usedBy:[],...input}; ASSETS=[rec,...ASSETS]; return rec; }
export function deleteAsset(id:string){ const a=getAsset(id); if(a && a.usedBy.length>0) return {ok:false, reason:`Asset in use by ${a.usedBy.length} item(s)`, usedBy:a.usedBy}; ASSETS=ASSETS.filter(x=>x.id!==id); return {ok:true}; }
export function replaceAsset(id:string, replacementId:string){ const a=getAsset(id); if(!a) return; ASSETS=ASSETS.map(x=>x.id===replacementId?{...x,usedBy:Array.from(new Set([...x.usedBy,...a.usedBy]))}:x.id===id?{...x,usedBy:[]}:x); }
export function getBrandKit(){ return BRAND; }
export function saveBrandKit(b:Partial<BrandKit>){ BRAND={...BRAND,...b}; }
