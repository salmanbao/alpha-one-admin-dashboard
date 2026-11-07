/**
 * M6 — Integration Marketplace store (spec §10.1, §10.2).
 * Catalog of installable apps with scope manifests, install consent,
 * and installed-app lifecycle (enable/disable/update/uninstall).
 * Dummy data only.
 */

export type AppCategory = "Marketing"|"KYC & Compliance"|"Payments & Payouts"|"Trading Platforms"|"AI & Data"|"Webhooks & Custom";
export const CATEGORIES: AppCategory[] = ["Marketing","KYC & Compliance","Payments & Payouts","Trading Platforms","AI & Data","Webhooks & Custom"];

export interface ScopeDef { id: string; label: string; required: boolean }
export interface MarketplaceApp {
  id: string; name: string; publisher: string; description: string; category: AppCategory;
  verified: boolean; rating: number; installs: number; version: string;
  scopes: ScopeDef[];
}
export interface InstalledApp {
  id: string; appId: string; name: string; version: string; status: "enabled"|"disabled"|"update";
  scopesGranted: string[]; lastActivity: string; installedBy: string; installedAt: string;
  disabledAt?: string; purgeAt?: string; availableVersion?: string; newScopes?: string[];
  audit: Array<{ ts: string; action: string; actor: string }>;
}

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const CATALOG: MarketplaceApp[] = [
  { id:"app-klaviyo", name:"Klaviyo", publisher:"Klaviyo Inc.", description:"Sync contacts, events and campaign engagement.", category:"Marketing", verified:true, rating:4.8, installs:1240, version:"2.4.1", scopes:[
    {id:"marketing.segments.read",label:"Read audience segments and membership counts",required:true},
    {id:"marketing.campaigns.write",label:"Send campaigns and write delivery events",required:true},
    {id:"contacts.read",label:"Read contact profiles (masked PII)",required:false},
  ]},
  { id:"app-mailchimp", name:"Mailchimp", publisher:"Intuit Mailchimp", description:"Push audiences and campaign events to Mailchimp.", category:"Marketing", verified:true, rating:4.5, installs:980, version:"3.1.0", scopes:[
    {id:"marketing.segments.read",label:"Read audience segments and membership counts",required:true},
    {id:"marketing.campaigns.write",label:"Send campaigns and write delivery events",required:true},
  ]},
  { id:"app-meta-capi", name:"Meta Conversions API", publisher:"Meta Platforms", description:"Server-side conversion events for Meta ads.", category:"Marketing", verified:true, rating:4.6, installs:860, version:"1.9.0", scopes:[
    {id:"events.write",label:"Send conversion events (purchase, signup, KYC)",required:true},
    {id:"trader.read",label:"Read trader identifiers for matching (hashed)",required:true},
  ]},
  { id:"app-persona", name:"Persona", publisher:"Persona Identities", description:"Identity verification and KYC checks.", category:"KYC & Compliance", verified:true, rating:4.7, installs:730, version:"4.0.2", scopes:[
    {id:"kyc.write",label:"Create and update KYC verification sessions",required:true},
    {id:"trader.read",label:"Read trader profile data for verification",required:true},
  ]},
  { id:"app-sumsub", name:"Sumsub", publisher:"Sumsub", description:"Global KYC/AML verification workflows.", category:"KYC & Compliance", verified:true, rating:4.4, installs:510, version:"3.6.0", scopes:[
    {id:"kyc.write",label:"Create and update KYC verification sessions",required:true},
    {id:"trader.read",label:"Read trader profile data for verification",required:true},
  ]},
  { id:"app-stripe", name:"Stripe", publisher:"Stripe Inc.", description:"Payments, payouts and billing.", category:"Payments & Payouts", verified:true, rating:4.9, installs:1520, version:"5.2.0", scopes:[
    {id:"payments.write",label:"Create charges and process refunds",required:true},
    {id:"payouts.read",label:"Read payout status and history",required:true},
    {id:"billing.read",label:"Read invoices and subscription state",required:false},
  ]},
  { id:"app-wise", name:"Wise", publisher:"Wise", description:"Cross-border payouts at mid-market rates.", category:"Payments & Payouts", verified:true, rating:4.6, installs:640, version:"2.1.0", scopes:[
    {id:"payouts.write",label:"Initiate and track payout transfers",required:true},
    {id:"payouts.read",label:"Read payout status and history",required:true},
  ]},
  { id:"app-mt5", name:"MetaTrader 5 Bridge", publisher:"AlphaOne Labs", description:"Sync trading accounts and executions from MT5.", category:"Trading Platforms", verified:true, rating:4.3, installs:410, version:"1.4.5", scopes:[
    {id:"trading.read",label:"Read trades, positions and account metrics",required:true},
    {id:"accounts.write",label:"Provision and update trading accounts",required:false},
  ]},
  { id:"app-ga4", name:"Google Analytics 4", publisher:"Google", description:"Import sessions and conversion reporting.", category:"AI & Data", verified:true, rating:4.5, installs:1100, version:"2.0.0", scopes:[
    {id:"analytics.read",label:"Read traffic and conversion reports",required:true},
  ]},
  { id:"app-custom-hook", name:"Custom Webhook Relay", publisher:"AlphaOne Labs", description:"Forward platform events to any HTTPS endpoint.", category:"Webhooks & Custom", verified:true, rating:4.2, installs:380, version:"1.0.0", scopes:[
    {id:"events.read",label:"Subscribe to platform event streams",required:true},
  ]},
];

let INSTALLED: InstalledApp[] = [
  { id:"inst-1", appId:"app-stripe", name:"Stripe", version:"5.1.0", status:"update", scopesGranted:["payments.write","payouts.read","billing.read"], lastActivity:daysAgo(0), installedBy:"S. Malik", installedAt:daysAgo(120), availableVersion:"5.2.0", newScopes:["billing.read"], audit:[{ts:daysAgo(120),action:"Installed v5.1.0 (consented)",actor:"S. Malik"}] },
  { id:"inst-2", appId:"app-persona", name:"Persona", version:"4.0.2", status:"enabled", scopesGranted:["kyc.write","trader.read"], lastActivity:daysAgo(1), installedBy:"A. Khan", installedAt:daysAgo(60), audit:[{ts:daysAgo(60),action:"Installed v4.0.2 (consented)",actor:"A. Khan"}] },
  { id:"inst-3", appId:"app-klaviyo", name:"Klaviyo", version:"2.4.1", status:"disabled", scopesGranted:["marketing.segments.read","marketing.campaigns.write"], lastActivity:daysAgo(12), installedBy:"S. Malik", installedAt:daysAgo(90), disabledAt:daysAgo(2), purgeAt:new Date(Date.now()+28*86400000).toISOString(), audit:[{ts:daysAgo(2),action:"Disabled (data retained 30 days)",actor:"S. Malik"},{ts:daysAgo(90),action:"Installed v2.4.1 (consented)",actor:"S. Malik"}] },
];

export function listCatalog() { return CATALOG; }
export function getApp(id: string) { return CATALOG.find((a) => a.id === id); }
export function listInstalled() { return INSTALLED; }
export function getInstalled(id: string) { return INSTALLED.find((a) => a.id === id); }

export function installApp(appId: string, actor: string): InstalledApp | undefined {
  const app = getApp(appId); if (!app) return undefined;
  const existing = INSTALLED.find((i) => i.appId === appId);
  const rec: InstalledApp = {
    id: existing?.id ?? `inst-${Math.random().toString(36).slice(2,8)}`,
    appId, name: app.name, version: app.version, status: "enabled",
    scopesGranted: app.scopes.filter((s) => s.required).map((s) => s.id),
    lastActivity: now(), installedBy: actor, installedAt: existing?.installedAt ?? now(),
    audit: [{ ts: now(), action: `Installed v${app.version} — scopes consented`, actor }, ...(existing?.audit ?? [])],
  };
  INSTALLED = existing ? INSTALLED.map((i) => i.id === existing.id ? rec : i) : [rec, ...INSTALLED];
  return rec;
}

export function uninstallApp(id: string, actor: string) {
  const inst = INSTALLED.find((i) => i.id === id);
  INSTALLED = INSTALLED.filter((i) => i.id !== id);
  return inst ? { ok: true, name: inst.name } : { ok: false, name: "" };
}

export function disableApp(id: string, actor: string) {
  INSTALLED = INSTALLED.map((i) => i.id === id ? { ...i, status: "disabled", disabledAt: now(), purgeAt: new Date(Date.now()+30*86400000).toISOString(), audit:[{ts:now(),action:"Disabled (data retained 30 days, scopes revoked)",actor}, ...i.audit] } : i);
}
export function enableApp(id: string, actor: string) {
  INSTALLED = INSTALLED.map((i) => i.id === id ? { ...i, status: i.availableVersion ? "update" : "enabled", disabledAt: undefined, purgeAt: undefined, audit:[{ts:now(),action:"Re-enabled (restored before purge)",actor}, ...i.audit] } : i);
}

export function updateApp(id: string, actor: string, acknowledgedScopes: string[]) {
  const inst = INSTALLED.find((i) => i.id === id); if (!inst || !inst.availableVersion) return undefined;
  const next: InstalledApp = { ...inst, version: inst.availableVersion, status: "enabled", availableVersion: undefined, scopesGranted: Array.from(new Set([...inst.scopesGranted, ...acknowledgedScopes])), newScopes: undefined, audit:[{ts:now(),action:`Updated to v${inst.availableVersion} (re-consented new scopes)`,actor}, ...inst.audit] };
  INSTALLED = INSTALLED.map((i) => i.id === id ? next : i);
  return next;
}
