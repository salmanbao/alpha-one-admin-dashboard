/** R2-01 — Landing Page & Funnel Builder store. */
export type PageStatus = "draft" | "published" | "archived";
export interface LandingPage {
  id: string; name: string; slug: string; template: string; status: PageStatus;
  funnelStep?: string; version: number; publishedVersion?: number;
  visits: number; conversions: number; updatedAt: string; scheduledFor?: string;
  seo: { title: string; description: string; ogImage?: string; canonical?: string };
  blocks: Array<{ id: string; type: string; label: string; visibility?: string }>;
}
const now = () => new Date().toISOString();
let PAGES: LandingPage[] = [
  { id:"lp1", name:"100K Challenge Promo", slug:"100k-promo", template:"challenge promo", status:"published", funnelStep:"Landing", version:3, publishedVersion:3, visits:12480, conversions:842, updatedAt:now(), seo:{title:"100K Challenge | AlphaOne", description:"Scale your trading with our 100K challenge."}, blocks:[{id:"b1",type:"hero",label:"Hero"},{id:"b2",type:"pricing",label:"Pricing table"},{id:"b3",type:"form",label:"Form embed (R2-02)",visibility:"segment:KYC-verified"},{id:"b4",type:"faq",label:"FAQ"}]},
  { id:"lp2", name:"Webinar Signup - EU", slug:"webinar-eu", template:"webinar signup", status:"draft", funnelStep:"Landing", version:1, visits:0, conversions:0, updatedAt:now(), seo:{title:"EU Webinar", description:"Join our live session."}, blocks:[{id:"b1",type:"hero",label:"Hero"},{id:"b2",type:"countdown",label:"Countdown"}]},
];
export function listLandingPages(){ return PAGES; }
export function getLandingPage(id:string){ return PAGES.find(p=>p.id===id); }
export function saveLandingPage(p: Partial<LandingPage> & {id:string}){ PAGES = PAGES.map(x=>x.id===p.id?{...x,...p,version:(x.version||1)+1,updatedAt:now()}:x); }
export function publishLandingPage(id:string, schedule?:string){ PAGES = PAGES.map(x=>x.id===id?{...x,status:"published",publishedVersion:x.version,scheduledFor:schedule,updatedAt:now()}:x); }
export function unpublishLandingPage(id:string){ PAGES = PAGES.map(x=>x.id===id?{...x,status:"draft",updatedAt:now()}:x); }
export function createLandingPage(template:string,name:string){ const rec:LandingPage={id:`lp-${Date.now()}`,name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),template,status:"draft",version:1,visits:0,conversions:0,updatedAt:now(),seo:{title:name,description:""},blocks:[{id:"b1",type:"hero",label:"Hero"}]}; PAGES=[rec,...PAGES]; return rec; }
