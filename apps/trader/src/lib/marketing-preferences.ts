/**
 * N17 — Marketing Preference Center data (mirrors M3 consent semantics).
 * Writes are local (dummy); in production this writes to the consent store
 * the campaign composer reads. Used by /marketing-preferences and /unsubscribe.
 */

export type MarketingTopic = "promotions" | "education" | "product_news";
export type MarketingChannel = "email" | "sms" | "whatsapp";

export const TOPIC_LABEL: Record<MarketingTopic, string> = {
  promotions: "Promotions & offers",
  education: "Education & tips",
  product_news: "Product news & updates",
};
export const CHANNEL_LABEL: Record<MarketingChannel, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };

export type PrefMatrix = Record<MarketingTopic, Record<MarketingChannel, boolean>>;
export interface Receipt { id: string; ts: string; action: string; detail: string }

const KEY = "pfaas:trader:marketingPrefs";
const RKEY = "pfaas:trader:marketingReceipts";

export function defaultPrefs(): PrefMatrix {
  return {
    promotions: { email: true, sms: false, whatsapp: false },
    education: { email: true, sms: false, whatsapp: false },
    product_news: { email: true, sms: false, whatsapp: false },
  };
}

export function loadPrefs(): PrefMatrix {
  if (typeof window === "undefined") return defaultPrefs();
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : defaultPrefs(); } catch { return defaultPrefs(); }
}
export function savePrefs(p: PrefMatrix) {
  if (typeof window !== "undefined") try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
export function loadReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(RKEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function addReceipt(action: string, detail: string): Receipt {
  const rec: Receipt = { id: `rcpt-${Date.now()}`, ts: new Date().toISOString(), action, detail };
  if (typeof window !== "undefined") try {
    const all = [rec, ...loadReceipts()].slice(0, 20);
    localStorage.setItem(RKEY, JSON.stringify(all));
  } catch {}
  return rec;
}

/** Apply one-click unsubscribe (tokenized): opt out of all marketing on all channels. */
export function applyGlobalUnsubscribe(token: string): Receipt {
  const allOff: PrefMatrix = {
    promotions: { email: false, sms: false, whatsapp: false },
    education: { email: false, sms: false, whatsapp: false },
    product_news: { email: false, sms: false, whatsapp: false },
  };
  savePrefs(allOff);
  return addReceipt("unsubscribe_all", `One-click unsubscribe via token ${token.slice(0, 8)}… — all marketing channels/topics opted out.`);
}
