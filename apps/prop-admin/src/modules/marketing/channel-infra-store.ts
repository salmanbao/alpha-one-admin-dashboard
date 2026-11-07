/**
 * N1-N3 — Channel Infrastructure store (Wave 1, P0).
 * Dummy data only — providers/senders/templates/domains with health/status.
 */

export type Channel = "email" | "sms" | "whatsapp" | "push" | "in-app";

export interface ProviderConfig {
  id: string;
  name: string;
  channel: Channel;
  kind: "email" | "sms" | "whatsapp" | "push" | "custom";
  status: "connected" | "disconnected" | "error" | "testing";
  health: "ok" | "degraded" | "down";
  apiVersion?: string;
  lastCheck: string;
  credsRef?: string; // vault reference (N12 style)
  senderPool: string[];
  defaultSender?: string;
  costPerUnit?: number;
  dailyCap?: number;
  usedToday?: number;
}

export interface SenderIdentity {
  id: string;
  channel: Channel;
  providerId: string;
  identity: string; // email/number/handle
  type: "email" | "phone" | "app";
  status: "verified" | "pending" | "suspended";
  verifiedAt?: string;
  isDefault: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  providerId: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  status: "approved" | "pending" | "rejected" | "draft";
  components: Array<{ type: string; text?: string; example?: string }>;
  variables: string[];
  submittedAt?: string;
  reviewedAt?: string;
  reason?: string;
  lastSync: string;
}

export interface SendingDomain {
  id: string;
  domain: string;
  type: "sending" | "bounce";
  status: "verified" | "pending" | "failed";
  spf: { status: "ok" | "missing" | "mismatch"; record?: string; verifiedAt?: string };
  dkim: { status: "ok" | "missing" | "mismatch"; selector?: string; record?: string; verifiedAt?: string };
  dmarc: { status: "ok" | "missing" | "mismatch"; record?: string; policy?: string; verifiedAt?: string };
  createdAt: string;
  lastCheck: string;
  blockScheduling: boolean;
}

const now = () => new Date().toISOString();
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

let PROVIDERS: ProviderConfig[] = [
  { id: "prov-sendgrid", name: "SendGrid", channel: "email", kind: "email", status: "connected", health: "ok", apiVersion: "v3", lastCheck: ago(0.2), credsRef: "vault/email/sendgrid", senderPool: ["no-reply@alphaone.io", "support@alphaone.io", "marketing@alphaone.io"], defaultSender: "marketing@alphaone.io", costPerUnit: 0.0001, dailyCap: 50000, usedToday: 12430 },
  { id: "prov-twilio", name: "Twilio", channel: "sms", kind: "sms", status: "connected", health: "ok", apiVersion: "2010-04-01", lastCheck: ago(0.3), credsRef: "vault/sms/twilio", senderPool: ["+15551234567"], defaultSender: "+15551234567", costPerUnit: 0.0075, dailyCap: 10000, usedToday: 842 },
  { id: "prov-meta-wa", name: "Meta WhatsApp Cloud", channel: "whatsapp", kind: "whatsapp", status: "connected", health: "ok", apiVersion: "v21.0", lastCheck: ago(0.1), credsRef: "vault/wa/meta", senderPool: ["15559876543"], defaultSender: "15559876543", costPerUnit: 0.005, dailyCap: 20000, usedToday: 1456 },
  { id: "prov-fcm", name: "Firebase Cloud Messaging", channel: "push", kind: "push", status: "connected", health: "ok", apiVersion: "v1", lastCheck: ago(0.4), credsRef: "vault/push/fcm", senderPool: ["alphaone-app"], defaultSender: "alphaone-app", costPerUnit: 0, dailyCap: 100000, usedToday: 23450 },
  { id: "prov-postmark", name: "Postmark", channel: "email", kind: "email", status: "disconnected", health: "down", lastCheck: ago(48), senderPool: [], costPerUnit: 0.0001, dailyCap: 10000, usedToday: 0 },
];

let SENDERS: SenderIdentity[] = [
  { id: "snd-1", channel: "email", providerId: "prov-sendgrid", identity: "marketing@alphaone.io", type: "email", status: "verified", verifiedAt: ago(720), isDefault: true },
  { id: "snd-2", channel: "email", providerId: "prov-sendgrid", identity: "no-reply@alphaone.io", type: "email", status: "verified", verifiedAt: ago(720), isDefault: false },
  { id: "snd-3", channel: "email", providerId: "prov-sendgrid", identity: "support@alphaone.io", type: "email", status: "verified", verifiedAt: ago(600), isDefault: false },
  { id: "snd-4", channel: "sms", providerId: "prov-twilio", identity: "+15551234567", type: "phone", status: "verified", verifiedAt: ago(500), isDefault: true },
  { id: "snd-5", channel: "whatsapp", providerId: "prov-meta-wa", identity: "15559876543", type: "phone", status: "verified", verifiedAt: ago(400), isDefault: true },
];

let TEMPLATES: WhatsAppTemplate[] = [
  { id: "wt-1", name: "order_update", providerId: "prov-meta-wa", category: "UTILITY", language: "en_US", status: "approved", components: [{ type: "BODY", text: "Your order {{1}} has been {{2}}.", example: "ORD-123, shipped" }], variables: ["order_id", "status"], submittedAt: ago(72), reviewedAt: ago(48), lastSync: ago(1) },
  { id: "wt-2", name: "promo_flash", providerId: "prov-meta-wa", category: "MARKETING", language: "en_US", status: "pending", components: [{ type: "BODY", text: "Flash sale! Use {{1}} for {{2}}% off." }], variables: ["code", "percent"], submittedAt: ago(6), lastSync: ago(0.5) },
  { id: "wt-3", name: "otp_verification", providerId: "prov-meta-wa", category: "AUTHENTICATION", language: "en_US", status: "rejected", components: [{ type: "BODY", text: "Your OTP is {{1}}" }], variables: ["code"], submittedAt: ago(120), reviewedAt: ago(96), reason: "Template violates authentication category guidelines.", lastSync: ago(2) },
];

let DOMAINS: SendingDomain[] = [
  { id: "dom-1", domain: "alphaone.io", type: "sending", status: "verified", spf: { status: "ok", record: "v=spf1 include:sendgrid.net ~all", verifiedAt: ago(720) }, dkim: { status: "ok", selector: "s1", record: "s1._domainkey.alphaone.io IN TXT ...", verifiedAt: ago(720) }, dmarc: { status: "ok", record: "_dmarc.alphaone.io IN TXT v=DMARC1; p=reject; rua=mailto:dmarc@alphaone.io", policy: "reject", verifiedAt: ago(720) }, createdAt: ago(800), lastCheck: ago(1), blockScheduling: false },
  { id: "dom-2", domain: "mail.alphaone.io", type: "bounce", status: "pending", spf: { status: "ok", record: "v=spf1 include:sendgrid.net ~all", verifiedAt: ago(100) }, dkim: { status: "missing" }, dmarc: { status: "missing" }, createdAt: ago(5), lastCheck: ago(0.5), blockScheduling: true },
];

export function listProviders() { return PROVIDERS; }
export function getProvider(id: string) { return PROVIDERS.find(p => p.id === id); }
export function testProvider(id: string) {
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) return { ok: false, msg: "Not found" };
  PROVIDERS = PROVIDERS.map(x => x.id === id ? { ...x, lastCheck: now(), status: x.status === "disconnected" ? "connected" : x.status, health: "ok" } : x);
  return { ok: true, msg: "Health check passed (200 OK)." };
}
export function toggleProvider(id: string, connected: boolean) {
  PROVIDERS = PROVIDERS.map(x => x.id === id ? { ...x, status: connected ? "connected" : "disconnected", health: connected ? "ok" : "down" } : x);
}

export function listSenders() { return SENDERS; }
export function listWhatsAppTemplates() { return TEMPLATES; }
export function submitWhatsAppTemplate(t: Omit<WhatsAppTemplate, "id" | "submittedAt" | "lastSync" | "status">) {
  const rec: WhatsAppTemplate = { ...t, id: `wt-${Date.now()}`, status: "pending", submittedAt: now(), lastSync: now() };
  TEMPLATES = [rec, ...TEMPLATES];
  return rec;
}
export function syncWhatsAppTemplates() {
  TEMPLATES = TEMPLATES.map(t => ({ ...t, lastSync: now() }));
}

export function listSendingDomains() { return DOMAINS; }
export function addSendingDomain(domain: string, type: "sending" | "bounce") {
  const rec: SendingDomain = {
    id: `dom-${Date.now()}`, domain, type, status: "pending",
    spf: { status: "missing" }, dkim: { status: "missing" }, dmarc: { status: "missing" },
    createdAt: now(), lastCheck: now(), blockScheduling: true,
  };
  DOMAINS = [rec, ...DOMAINS];
  return rec;
}
export function verifyDomain(id: string) {
  DOMAINS = DOMAINS.map(d => {
    if (d.id !== id) return d;
    // Simulate verification progressing
    const spf = d.spf.status === "missing" ? { status: "ok" as const, record: `v=spf1 include:sendgrid.net ~all`, verifiedAt: now() } : d.spf;
    const dkim = d.dkim.status === "missing" ? { status: "ok" as const, selector: "s1", record: `s1._domainkey.${d.domain} IN TXT ...`, verifiedAt: now() } : d.dkim;
    const dmarc = d.dmarc.status === "missing" ? { status: "ok" as const, record: `_dmarc.${d.domain} IN TXT v=DMARC1; p=none; rua=mailto:dmarc@${d.domain}`, policy: "none", verifiedAt: now() } : d.dmarc;
    const allOk = spf.status === "ok" && dkim.status === "ok" && dmarc.status === "ok";
    return { ...d, spf, dkim, dmarc, status: allOk ? "verified" as const : "pending", lastCheck: now(), blockScheduling: !allOk };
  });
  return DOMAINS.find(d => d.id === id);
}
export function hasBlockingDomain() {
  return DOMAINS.some(d => d.status !== "verified");
}
