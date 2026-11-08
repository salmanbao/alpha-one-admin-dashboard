/**
 * R3-04 — Trader Communication History store (dummy, store-backed).
 *
 * Trader-side mirror of the prop-admin message archive (R2-08): every
 * message dispatched to this trader with its campaign/flow attribution and
 * an R2-F04 content-snapshot record of WHY it was sent — the segment rule
 * and consent state resolved at send time (AC-2), plus the tokenized
 * unsubscribe link the message actually carried.
 *
 * AC-1  every dispatched message appears with correct campaign attribution
 * AC-2  "Why did I get this" resolves the segment rule at send time
 * AC-3  opt-out from any entry writes the N17 preference matrix + receipt
 */

import {
  loadPrefs, savePrefs, addReceipt,
  type MarketingChannel, type MarketingTopic, type PrefMatrix, type Receipt,
} from "./marketing-preferences";

export type CommChannel = "email" | "sms" | "whatsapp" | "push";
export type CommStatus = "delivered" | "opened" | "sent" | "bounced";

export interface CommWhy {
  /** Segment the trader belonged to when the send resolved (R2-F04). */
  segment: string;
  /** Human-readable rule expression captured with the snapshot. */
  segmentRule: string;
  /** Consent state at send — not today's state (AC-2). */
  consentAtSend: string;
  /** Content snapshot reference (R2-F04 / N6 approval trail). */
  snapshotId: string;
  capturedAt: string;
  /** What dispatched it: campaign launch or a flow step. */
  trigger: string;
}

export interface CommMessage {
  id: string;
  channel: CommChannel;
  /** Campaign or flow attribution (AC-1). */
  campaign?: string;
  flow?: string;
  step?: string;
  subject: string;
  preview: string;
  body: string;
  sentAt: string;
  status: CommStatus;
  /** N17 topic this message belongs to (null for transactional). */
  topic: MarketingTopic;
  /** Transactional/security traffic — not governed by marketing prefs. */
  transactional?: boolean;
  why: CommWhy;
  /** Tokenized unsubscribe link as delivered (/unsubscribe?token=…). */
  unsubToken: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

function msg(m: Partial<CommMessage> & Pick<CommMessage, "id" | "channel" | "subject" | "sentAt" | "status" | "topic">): CommMessage {
  return {
    preview: "",
    body: "",
    transactional: false,
    unsubToken: `unsub_${m.id}_${Math.random().toString(36).slice(2, 8)}`,
    why: {
      segment: "all-marketing-consented",
      segmentRule: "consent.marketing = true",
      consentAtSend: "granted (privacy-2026.09)",
      snapshotId: `snp-${m.id}`,
      capturedAt: m.sentAt,
      trigger: "campaign",
    },
    ...m,
  } as CommMessage;
}

let COMMS: CommMessage[] = [
  msg({
    id: "cm-1", channel: "email", campaign: "Q4 Scale Blitz", subject: "Scale to 200K — your path this quarter",
    preview: "You are two steps from the next account tier…", sentAt: hoursAgo(6), status: "delivered", topic: "promotions",
    body: "Hi trader — your consistency score puts you in the top 12% this quarter. Here is the path to the 200K tier, plus the challenge fee waiver ending Sunday.",
    why: {
      segment: "Funded active", segmentRule: "account.funded = true AND trades_30d >= 10 AND country in EU",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-q4scale-v3", capturedAt: hoursAgo(7),
      trigger: "Campaign launch (approved 2026-11-01, approval appr-q4scale-v3)",
    },
  }),
  msg({
    id: "cm-2", channel: "email", flow: "Welcome & KYC nudge", step: "Step 2 of 3", subject: "Verify your identity in 4 minutes",
    preview: "Finish KYC to unlock payouts…", sentAt: hoursAgo(29), status: "opened", topic: "product_news",
    body: "Finish KYC to unlock payouts. Upload a passport or ID and proof of address — most traders are approved the same day.",
    why: {
      segment: "KYC-verified, not deposited", segmentRule: "kyc.status != 'verified' AND deposit_count = 0",
      consentAtSend: "granted (onboarding consent, privacy-2026.06)", snapshotId: "snp-kycstep2", capturedAt: hoursAgo(30),
      trigger: "Flow step — day 2 delay after signup",
    },
  }),
  msg({
    id: "cm-3", channel: "sms", campaign: "Flash SMS", subject: "48h: challenge fee −30%",
    preview: "Code EDGE30 expires Sunday", sentAt: hoursAgo(52), status: "delivered", topic: "promotions",
    body: "AlphaOne: 30% off challenge fees with code EDGE30 — expires Sunday. Opt out: reply STOP.",
    why: {
      segment: "Dormant 60d", segmentRule: "last_trade_at < now-60d AND consent.sms = true",
      consentAtSend: "granted via SMS opt-in 2026-07-11 (rcpt-sms-88)", snapshotId: "snp-flashsms-v1",
      capturedAt: hoursAgo(53), trigger: "Campaign launch (approved 2026-11-02)",
    },
  }),
  msg({
    id: "cm-4", channel: "email", campaign: "Weekly edge digest", subject: "Your weekly edge: liquidity shifts + 1 replay",
    preview: "What moved, what mattered, one replay to study", sentAt: hoursAgo(76), status: "opened", topic: "education",
    body: "What moved this week, what mattered for funded traders, and one trade replay worth studying — plus the risk template update.",
    why: {
      segment: "Education subscribers", segmentRule: "topic.education.email = true AND last_open_90d > 0",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-edgedigest-w45", capturedAt: hoursAgo(77),
      trigger: "Weekly schedule (Mon 07:00 UTC)",
    },
  }),
  msg({
    id: "cm-5", channel: "push", flow: "Payout celebration", step: "Step 1", subject: "Payout approved 🎉",
    preview: "Your payout is on the way", sentAt: hoursAgo(98), status: "delivered", topic: "product_news", transactional: true,
    body: "Your payout of 1,240 USD was approved and sent to your withdrawal method. Track it in Payout History.",
    why: {
      segment: "single-recipient (transactional)", segmentRule: "event: payout.approved",
      consentAtSend: "n/a — transactional, exempt from marketing consent", snapshotId: "snp-payoutceleb",
      capturedAt: hoursAgo(98), trigger: "Flow step — payout.approved event",
    },
  }),
  msg({
    id: "cm-6", channel: "whatsapp", campaign: "Win-back", subject: "We saved your workspace",
    preview: "Your accounts are still here", sentAt: hoursAgo(124), status: "bounced", topic: "promotions",
    body: "Your trading workspace is still here — pick up where you left off. Recharge a challenge with 20% off this week.",
    why: {
      segment: "Lapsed 90d", segmentRule: "last_login_at < now-90d AND consent.whatsapp = true",
      consentAtSend: "granted then withdrawn 2026-11-03 (rcpt-wa-12) — send raced the withdrawal window",
      snapshotId: "snp-winback-v2", capturedAt: hoursAgo(125), trigger: "Campaign launch (approved 2026-10-30)",
    },
  }),
  msg({
    id: "cm-7", channel: "email", campaign: "Q4 Scale Blitz", subject: "Reminder: fee waiver ends Sunday",
    preview: "Last call on the challenge waiver", sentAt: hoursAgo(150), status: "delivered", topic: "promotions",
    body: "Final reminder — the Q4 challenge fee waiver ends Sunday at 23:59 UTC.",
    why: {
      segment: "Funded active", segmentRule: "account.funded = true AND trades_30d >= 10 AND country in EU",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-q4scale-reminder", capturedAt: hoursAgo(151),
      trigger: "Campaign reminder (approved 2026-11-01)",
    },
  }),
  msg({
    id: "cm-8", channel: "email", campaign: "Product news", subject: "Trade Replay 2.0 is live",
    preview: "Frame-by-frame replay with order book", sentAt: hoursAgo(172), status: "opened", topic: "product_news",
    body: "Trade Replay 2.0 ships frame-by-frame playback with order-book depth and your journal notes inline.",
    why: {
      segment: "Active this week", segmentRule: "sessions_7d >= 1 AND topic.product_news.push = true",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-replay2", capturedAt: hoursAgo(173),
      trigger: "Campaign launch (approved 2026-11-04)",
    },
  }),
  msg({
    id: "cm-9", channel: "email", flow: "Risk consult nurture", step: "Step 1 of 4", subject: "Your drawdown pattern, explained",
    preview: "Three trades cost you 60% of the drawdown", sentAt: hoursAgo(200), status: "delivered", topic: "education",
    body: "Three trades accounted for 60% of your drawdown this month. Here is the pattern and the rule that breaks it.",
    why: {
      segment: "Drawdown > 4% in 30d", segmentRule: "max_drawdown_30d_pct > 4 AND consent.email = true",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-risknurture-1", capturedAt: hoursAgo(201),
      trigger: "Flow step — day 1 after risk event",
    },
  }),
  msg({
    id: "cm-10", channel: "sms", campaign: "Flash SMS", subject: "Payout sent — no action needed",
    preview: "1,240 USD on the way", sentAt: hoursAgo(226), status: "delivered", topic: "product_news", transactional: true,
    body: "AlphaOne: payout 1,240 USD sent to your withdrawal method. Track it in the app.",
    why: {
      segment: "single-recipient (transactional)", segmentRule: "event: payout.paid",
      consentAtSend: "n/a — transactional, exempt from marketing consent", snapshotId: "snp-payoutsms",
      capturedAt: hoursAgo(226), trigger: "Flow step — payout.paid event",
    },
  }),
  msg({
    id: "cm-11", channel: "email", campaign: "Win-back", subject: "Your workspace misses you",
    preview: "20% off a fresh challenge", sentAt: hoursAgo(260), status: "delivered", topic: "promotions",
    body: "Come back to a live workspace — 20% off a fresh challenge this week only.",
    why: {
      segment: "Lapsed 90d", segmentRule: "last_login_at < now-90d AND consent.email = true",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-winback-v2", capturedAt: hoursAgo(261),
      trigger: "Campaign launch (approved 2026-10-30)",
    },
  }),
  msg({
    id: "cm-12", channel: "email", campaign: "Weekly edge digest", subject: "Weekly edge: news volatility playbook",
    preview: "Trading CPI week without blowing risk", sentAt: hoursAgo(296), status: "opened", topic: "education",
    body: "Trading CPI week without blowing your risk rule — a playbook with three setups and one anti-pattern.",
    why: {
      segment: "Education subscribers", segmentRule: "topic.education.email = true AND last_open_90d > 0",
      consentAtSend: "granted (privacy-2026.09)", snapshotId: "snp-edgedigest-w44", capturedAt: hoursAgo(297),
      trigger: "Weekly schedule (Mon 07:00 UTC)",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function listComms(): CommMessage[] {
  return [...COMMS].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
export function getComm(id: string): CommMessage | undefined {
  return COMMS.find(c => c.id === id);
}

export interface CommsStats {
  total: number; opened: number; delivered: number; bounced: number;
  transactional: number; byChannel: Record<CommChannel, number>;
}

export function commsStats(): CommsStats {
  const byChannel: Record<CommChannel, number> = { email: 0, sms: 0, whatsapp: 0, push: 0 };
  for (const c of COMMS) byChannel[c.channel] += 1;
  return {
    total: COMMS.length,
    opened: COMMS.filter(c => c.status === "opened").length,
    delivered: COMMS.filter(c => c.status === "delivered").length,
    bounced: COMMS.filter(c => c.status === "bounced").length,
    transactional: COMMS.filter(c => c.transactional).length,
    byChannel,
  };
}

/**
 * Opening a message's evidence view marks it opened (store-backed, so the
 * timeline and the stats agree).
 */
export function markOpened(id: string): CommMessage | undefined {
  const m = getComm(id);
  if (!m || m.status !== "delivered") return m;
  const next: CommMessage = { ...m, status: "opened" };
  COMMS = COMMS.map(c => (c.id === id ? next : c));
  return next;
}

/* ------------------------------------------------------------------ */
/* AC-3 — opt-out from a message entry updates N17 state               */
/* ------------------------------------------------------------------ */

export type OptOutResult =
  | { ok: true; receipt: Receipt; topic: MarketingTopic; channel: CommChannel; detail: string }
  | { ok: false; reason: string };

/**
 * Opt the trader out of this message's topic + channel, writing the N17
 * preference matrix and a consent receipt (the same store the Preference
 * Center and /unsubscribe write to — one source of truth).
 */
export function optOutFromMessage(id: string): OptOutResult {
  const m = getComm(id);
  if (!m) return { ok: false, reason: "Message not found." };
  if (m.transactional) {
    return { ok: false, reason: "Transactional/security messages are not governed by marketing preferences." };
  }
  if (m.channel === "push") {
    return { ok: false, reason: "Push notifications are governed in Push & Channels, not the preference center topic matrix." };
  }
  const prefs: PrefMatrix = loadPrefs();
  const channel = m.channel as MarketingChannel;
  const already = !prefs[m.topic][channel];
  prefs[m.topic] = { ...prefs[m.topic], [channel]: false };
  savePrefs(prefs);
  const detail = `Opted out of ${m.topic} on ${m.channel} from message ${m.id} (“${m.subject}”, campaign ${m.campaign ?? m.flow ?? "—"}).`;
  const receipt = addReceipt(already ? "optout_already_off" : "optout_from_message", detail);
  return { ok: true, receipt, topic: m.topic, channel: m.channel, detail };
}

/** Current N17 state for a message's topic/channel (for the "now vs then" row). */
export function prefsNow(): PrefMatrix {
  return loadPrefs();
}
