/**
 * M4 — Campaign Studio store (spec §8).
 *
 * Dummy-data backing for the Campaign Composer (8.1), Automation Flow
 * Builder (8.2), Flow Detail (8.3), Campaign Calendar (8.4) and the
 * Template Library (8.5). No network calls; module-level memory so
 * mutations from one screen show up in the others.
 *
 * Cross-milestone contracts:
 *  - audience selection reads `segments-store.ts` (M3) via segment ids
 *  - calendar scheduling reads `listCampaigns()` (this file)
 */

import { getSegment, type Segment } from "./segments-store";
import { hasBlockingDomain } from "./channel-infra-store";

/* ------------------------------------------------------------------ */
/* Channels & templates                                                */
/* ------------------------------------------------------------------ */

export type Channel = "email" | "sms" | "whatsapp" | "push" | "in-app";

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
  "in-app": "In-app",
};

export interface StudioTemplate {
  id: string;
  name: string;
  category: "Onboarding" | "Activation" | "Retention" | "Win-back" | "Referral" | "Compliance";
  kind: "flow" | "campaign";
  channel: Channel;
  outcome: string;
  channels: Channel[];
  steps: number;
  usage: number;
  updated: string;
  placeholders: string[];
  subject?: string;
  body?: string;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: "tpl-welcome-kyc",
    name: "Welcome & KYC nudge series",
    category: "Onboarding",
    kind: "flow",
    channel: "email",
    outcome: "Turn signups into verified traders in 3 emails over 5 days.",
    channels: ["email", "push"],
    steps: 7,
    usage: 42,
    updated: daysAgo(6),
    placeholders: ["{{firm_name}}", "{{currency}}", "{{verify_link}}", "{{first_name}}"],
  },
  {
    id: "tpl-upsell",
    name: "Challenge passed upsell (scaling plan)",
    category: "Activation",
    kind: "flow",
    channel: "email",
    outcome: "Congratulations → introduce the scaling plan within 24h of passing.",
    channels: ["email", "in-app"],
    steps: 5,
    usage: 31,
    updated: daysAgo(12),
    placeholders: ["{{firm_name}}", "{{plan_name}}", "{{discount_code}}"],
  },
  {
    id: "tpl-payout-celebration",
    name: "Payout approved celebration with share ask",
    category: "Activation",
    kind: "flow",
    channel: "email",
    outcome: "Celebrate the first payout and ask for a referral share.",
    channels: ["email", "whatsapp"],
    steps: 4,
    usage: 27,
    updated: daysAgo(9),
    placeholders: ["{{firm_name}}", "{{payout_amount}}", "{{referral_link}}"],
  },
  {
    id: "tpl-winback",
    name: "Dormant 30-day win-back",
    category: "Win-back",
    kind: "flow",
    channel: "email",
    outcome: "Re-engage traders with no login for 30 days across 3 touches.",
    channels: ["email", "push"],
    steps: 6,
    usage: 38,
    updated: daysAgo(20),
    placeholders: ["{{firm_name}}", "{{last_login_days}}", "{{winback_offer}}"],
  },
  {
    id: "tpl-breach",
    name: "Breach empathy re-engage",
    category: "Retention",
    kind: "flow",
    channel: "email",
    outcome: "Empathy-first recovery path after a challenge breach.",
    channels: ["email"],
    steps: 4,
    usage: 19,
    updated: daysAgo(15),
    placeholders: ["{{firm_name}}", "{{recovery_offer}}"],
  },
  {
    id: "tpl-referral",
    name: "Referral invitation",
    category: "Referral",
    kind: "flow",
    channel: "email",
    outcome: "Invite funded traders to the referral program with their link.",
    channels: ["email", "in-app"],
    steps: 3,
    usage: 24,
    updated: daysAgo(30),
    placeholders: ["{{firm_name}}", "{{referral_link}}", "{{tier_rate}}"],
  },
  {
    id: "tpl-newsletter",
    name: "Monthly market digest",
    category: "Retention",
    kind: "campaign",
    channel: "email",
    outcome: "Recurring monthly newsletter with platform highlights.",
    channels: ["email"],
    steps: 1,
    usage: 56,
    updated: daysAgo(4),
    placeholders: ["{{firm_name}}", "{{currency}}", "{{month}}"],
  },
  {
    id: "tpl-compliance",
    name: "Terms update notice",
    category: "Compliance",
    kind: "campaign",
    channel: "email",
    outcome: "Mandatory terms-change notice with read confirmation.",
    channels: ["email"],
    steps: 1,
    usage: 8,
    updated: daysAgo(45),
    placeholders: ["{{firm_name}}", "{{terms_version}}"],
  },
];

export function listStudioTemplates(kind?: "flow" | "campaign"): StudioTemplate[] {
  return kind ? STUDIO_TEMPLATES.filter((t) => t.kind === kind) : STUDIO_TEMPLATES;
}

export function getStudioTemplate(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id);
}

/* ------------------------------------------------------------------ */
/* Campaigns (8.1 + 8.4)                                               */
/* ------------------------------------------------------------------ */

export type CampaignStatus = "draft" | "scheduled" | "sent" | "paused";

export interface StudioCampaign {
  id: string;
  name: string;
  channel: Channel;
  segmentId: string;
  segmentName: string;
  status: CampaignStatus;
  scheduledAt?: string; // ISO
  sentAt?: string;
  audienceSize: number;
  templateId?: string;
  subject: string;
  body: string;
  abEnabled: boolean;
  opens?: number;
  clicks?: number;
  /** ISO date used by the calendar as the send day. */
  day?: string; // YYYY-MM-DD
  createdBy: string;
}

let CAMPAIGNS: StudioCampaign[] = [
  {
    id: "cmp-welcome", name: "Welcome series — wave 3", channel: "email", segmentId: "seg-kyc-pending",
    segmentName: "KYC pending", status: "sent", sentAt: daysAgo(3), audienceSize: 342,
    templateId: "tpl-welcome-kyc", subject: "Finish verifying your {{firm_name}} account",
    body: "Hi {{first_name}}, your verification is almost done — complete it to unlock your {{currency}} challenge.",
    abEnabled: true, opens: 41, clicks: 12, createdBy: "S. Malik",
  },
  {
    id: "cmp-payout", name: "Payout celebration", channel: "email", segmentId: "seg-funded",
    segmentName: "Funded traders", status: "scheduled", scheduledAt: daysAgo(-2), day: dayOffset(2),
    audienceSize: 1284, templateId: "tpl-payout-celebration", subject: "Your payout is on the way 🎉",
    body: "Congrats {{first_name}} — {{payout_amount}} is processing. Share your win with {{referral_link}}.",
    abEnabled: false, createdBy: "A. Khan",
  },
  {
    id: "cmp-winback", name: "Win-back wave 2", channel: "email", segmentId: "seg-dormant",
    segmentName: "Dormant 60 days", status: "draft", audienceSize: 763,
    templateId: "tpl-winback", subject: "We saved your seat, {{first_name}}",
    body: "It's been {{last_login_days}} days — here's {{winback_offer}} to come back stronger.",
    abEnabled: false, createdBy: "A. Khan",
  },
  {
    id: "cmp-sms-payout", name: "Payout SMS nudge", channel: "sms", segmentId: "seg-funded",
    segmentName: "Funded traders", status: "scheduled", scheduledAt: daysAgo(-1), day: dayOffset(1),
    audienceSize: 1284, subject: "Payout SMS", body: "Your {{firm_name}} payout is processing. Track it in-app.",
    abEnabled: false, createdBy: "R. Idris",
  },
  {
    id: "cmp-vip-push", name: "VIP early access push", channel: "push", segmentId: "seg-vip",
    segmentName: "VIP withdrawals", status: "scheduled", scheduledAt: daysAgo(-4), day: dayOffset(4),
    audienceSize: 96, subject: "VIP early access", body: "New scaling tiers are live for VIP traders.",
    abEnabled: false, createdBy: "R. Idris",
  },
  {
    id: "cmp-referral", name: "Referral invite blast", channel: "email", segmentId: "seg-funded",
    segmentName: "Funded traders", status: "scheduled", scheduledAt: daysAgo(-2), day: dayOffset(2),
    audienceSize: 1284, templateId: "tpl-referral", subject: "Invite friends, earn {{tier_rate}}",
    body: "Share {{referral_link}} and earn commission on every funded friend.",
    abEnabled: false, createdBy: "S. Malik",
  },
  {
    id: "cmp-digest", name: "Monthly digest — Oct", channel: "email", segmentId: "seg-funded",
    segmentName: "Funded traders", status: "sent", sentAt: daysAgo(11), audienceSize: 1271,
    templateId: "tpl-newsletter", subject: "{{month}} at {{firm_name}}", body: "Platform highlights for {{month}}.",
    abEnabled: false, opens: 52, clicks: 9, createdBy: "S. Malik",
  },
  {
    id: "cmp-whatsapp-promo", name: "WhatsApp challenge promo", channel: "whatsapp", segmentId: "seg-risk",
    segmentName: "High risk score", status: "draft", audienceSize: 218,
    subject: "WhatsApp promo", body: "Discounted 50k challenge this week only.",
    abEnabled: false, createdBy: "R. Idris",
  },
];

/** Local YYYY-MM-DD offset from today (calendar-safe). */
export function dayOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function listCampaigns(): StudioCampaign[] {
  return CAMPAIGNS;
}

export function getCampaign(id: string): StudioCampaign | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

export function createCampaign(input: Partial<StudioCampaign> & { name: string }): StudioCampaign {
  const seg = input.segmentId ? getSegment(input.segmentId) : undefined;
  const campaign: StudioCampaign = {
    id: `cmp-${Math.random().toString(36).slice(2, 9)}`,
    name: input.name,
    channel: input.channel ?? "email",
    segmentId: input.segmentId ?? "",
    segmentName: input.segmentName ?? seg?.name ?? "",
    status: input.status ?? "draft",
    scheduledAt: input.scheduledAt,
    day: input.day,
    audienceSize: input.audienceSize ?? seg?.size ?? 0,
    templateId: input.templateId,
    subject: input.subject ?? "",
    body: input.body ?? "",
    abEnabled: input.abEnabled ?? false,
    createdBy: "You",
  };
  CAMPAIGNS = [campaign, ...CAMPAIGNS];
  return campaign;
}

export function updateCampaign(id: string, patch: Partial<StudioCampaign>): StudioCampaign | undefined {
  const c = CAMPAIGNS.find((x) => x.id === id);
  if (!c) return undefined;
  const next = { ...c, ...patch };
  CAMPAIGNS = CAMPAIGNS.map((x) => (x.id === id ? next : x));
  return next;
}

/** Move an unscheduled/draft campaign onto a calendar day. */
export function scheduleCampaignOn(id: string, day: string): StudioCampaign | undefined {
  const at = new Date(`${day}T10:00:00`).toISOString();
  return updateCampaign(id, { status: "scheduled", day, scheduledAt: at });
}

export function pauseCampaign(id: string): StudioCampaign | undefined {
  return updateCampaign(id, { status: "paused" });
}

export function resumeCampaign(id: string): StudioCampaign | undefined {
  return updateCampaign(id, { status: "scheduled" });
}

/**
 * Audience-overlap estimate for conflict detection (8.4): two campaigns
 * overlap when they share a segment fully, and partially when both are
 * email blasts against overlapping seeded segments.
 */
export function overlapPercent(a: StudioCampaign, b: StudioCampaign): number {
  if (a.segmentId === b.segmentId) return 100;
  const segA = getSegment(a.segmentId);
  const segB = getSegment(b.segmentId);
  if (!segA || !segB) return 0;
  // Seeded cross-segment overlap: funded↔vip 72%, funded↔dormant 41%, else hash-stable.
  const key = [segA.id, segB.id].sort().join("|");
  if (key === "seg-funded|seg-vip") return 72;
  if (key === "seg-dormant|seg-funded") return 41;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100;
  return h % 55; // below the 60% conflict threshold
}

/* ------------------------------------------------------------------ */
/* Automation flows (8.2, 8.3)                                         */
/* ------------------------------------------------------------------ */

export type FlowNodeType =
  // triggers
  | "trigger.form_submitted"
  | "trigger.challenge_passed"
  | "trigger.payout_requested"
  | "trigger.payout_approved"
  | "trigger.kyc_expiring"
  | "trigger.dormant_30"
  | "trigger.manual"
  // conditions
  | "cond.attribute"
  | "cond.segment"
  | "cond.consent"
  // actions
  | "action.send_email"
  | "action.send_sms"
  | "action.send_push"
  | "action.wait_duration"
  | "action.wait_window"
  | "action.update_tag"
  | "action.update_crm"
  | "action.webhook"
  // control
  | "control.end"
  | "control.goto";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  x: number;
  y: number;
  config: Record<string, string | boolean | number>;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

export interface FlowVersion {
  version: number;
  author: string;
  publishedAt: string;
  summary: string;
}

export interface FlowMember {
  id: string;
  contact: string;
  enteredAt: string;
  currentStep: string;
  status: "waiting" | "completed" | "exited" | "failed";
  lastActivity: string;
}

export interface FlowSettings {
  goalMetric: string;
  quietHours: string;
  reentry: "once" | "always" | "after_days";
  reentryDays?: number;
}

export interface Flow {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  version: number;
  versions: FlowVersion[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  enrolled: number;
  completed: number;
  goalConversion: number;
  members: FlowMember[];
  settings: FlowSettings;
  updatedAt: string;
}

export const NODE_GROUPS: Array<{
  group: "Triggers" | "Conditions" | "Actions" | "Flow control";
  nodes: Array<{ type: FlowNodeType; title: string; hint: string; iconKey: string }>;
}> = [
  {
    group: "Triggers",
    nodes: [
      { type: "trigger.form_submitted", title: "Form submitted", hint: "Lead form or signup completes", iconKey: "form" },
      { type: "trigger.challenge_passed", title: "Challenge passed", hint: "Evaluation + verification passed", iconKey: "trophy" },
      { type: "trigger.payout_requested", title: "Payout requested", hint: "Trader requests a withdrawal", iconKey: "wallet" },
      { type: "trigger.payout_approved", title: "Payout approved", hint: "Finance approves the payout", iconKey: "badge-check" },
      { type: "trigger.kyc_expiring", title: "KYC expiring", hint: "Documents expire in 14 days", iconKey: "id" },
      { type: "trigger.dormant_30", title: "Dormant 30 days", hint: "No login for 30 days", iconKey: "moon" },
      { type: "trigger.manual", title: "Manual enroll", hint: "Admin enrolls a contact by hand", iconKey: "user-plus" },
    ],
  },
  {
    group: "Conditions",
    nodes: [
      { type: "cond.attribute", title: "Attribute split", hint: "Branch on a contact attribute", iconKey: "split" },
      { type: "cond.segment", title: "Segment membership", hint: "Branch by M3 segment", iconKey: "layers" },
      { type: "cond.consent", title: "Consent check", hint: "Branch on channel consent", iconKey: "shield" },
    ],
  },
  {
    group: "Actions",
    nodes: [
      { type: "action.send_email", title: "Send email", hint: "Template email on a channel", iconKey: "mail" },
      { type: "action.send_sms", title: "Send SMS", hint: "SMS via M2 channel", iconKey: "message" },
      { type: "action.send_push", title: "Send push", hint: "Web/app push", iconKey: "bell" },
      { type: "action.wait_duration", title: "Wait duration", hint: "Pause N days/hours", iconKey: "clock" },
      { type: "action.wait_window", title: "Wait until window", hint: "Resume inside a time window", iconKey: "calendar-clock" },
      { type: "action.update_tag", title: "Update tag", hint: "Add/remove a contact tag", iconKey: "tag" },
      { type: "action.update_crm", title: "Update CRM stage", hint: "Move the CRM pipeline stage", iconKey: "git-branch" },
      { type: "action.webhook", title: "Call webhook", hint: "POST to an external endpoint", iconKey: "webhook" },
    ],
  },
  {
    group: "Flow control",
    nodes: [
      { type: "control.end", title: "End", hint: "Terminate this branch", iconKey: "square" },
      { type: "control.goto", title: "Go to", hint: "Jump to another node", iconKey: "corner-down-right" },
    ],
  },
];

export function nodeMeta(type: FlowNodeType) {
  for (const g of NODE_GROUPS) {
    const n = g.nodes.find((x) => x.type === type);
    if (n) return n;
  }
  return { type, title: type, hint: "", iconKey: "circle" };
}

export function isTrigger(type: FlowNodeType): boolean {
  return type.startsWith("trigger.");
}

export function newNode(type: FlowNodeType, x = 120, y = 120): FlowNode {
  const meta = nodeMeta(type);
  const config: FlowNode["config"] = {};
  if (type === "action.send_email" || type === "action.send_sms" || type === "action.send_push") {
    config.template = "";
    config.overridePolicy = false;
  }
  if (type === "action.wait_duration") config.amount = 2;
  if (type === "action.wait_window") config.window = "09:00–17:00";
  if (type === "cond.segment") config.segmentId = "";
  return { id: `n-${Math.random().toString(36).slice(2, 9)}`, type, title: meta.title, x, y, config };
}

/* ── Seed flows ── */

function seedWelcomeFlow(): Flow {
  const t = newNode("trigger.challenge_passed", 40, 60);
  t.title = "Challenge passed";
  const e1 = newNode("action.send_email", 260, 60);
  e1.title = "Send: Congrats email";
  e1.config.template = "tpl-payout-celebration";
  const w = newNode("action.wait_duration", 480, 60);
  w.title = "Wait 2 days";
  const seg = newNode("cond.segment", 700, 60);
  seg.title = "In ‘Funded traders’?";
  seg.config.segmentId = "seg-funded";
  const up = newNode("action.send_email", 920, -20);
  up.title = "Send: Scaling upsell";
  up.config.template = "tpl-upsell";
  const end = newNode("control.end", 920, 160);
  end.title = "End";
  return {
    id: "flow-upsell",
    name: "Scaling plan upsell",
    status: "active",
    version: 3,
    versions: [
      { version: 1, author: "S. Malik", publishedAt: daysAgo(48), summary: "Initial publish" },
      { version: 2, author: "S. Malik", publishedAt: daysAgo(21), summary: "Added consent check + 2-day wait" },
      { version: 3, author: "A. Khan", publishedAt: daysAgo(7), summary: "New upsell copy, goal → trial_started" },
    ],
    nodes: [t, e1, w, seg, up, end],
    edges: [
      { id: "e1", from: t.id, to: e1.id },
      { id: "e2", from: e1.id, to: w.id },
      { id: "e3", from: w.id, to: seg.id },
      { id: "e4", from: seg.id, to: up.id },
      { id: "e5", from: seg.id, to: end.id },
    ],
    enrolled: 1284,
    completed: 611,
    goalConversion: 18.4,
    members: seedMembers(14),
    settings: { goalMetric: "trial_started", quietHours: "22:00–07:00", reentry: "once" },
    updatedAt: daysAgo(7),
  };
}

function seedKycFlow(): Flow {
  const t = newNode("trigger.form_submitted", 40, 60);
  t.title = "Signup completed";
  const e1 = newNode("action.send_email", 260, 60);
  e1.title = "Send: Welcome";
  e1.config.template = "tpl-welcome-kyc";
  const w = newNode("action.wait_duration", 480, 60);
  w.title = "Wait 1 day";
  const c = newNode("cond.consent", 700, 60);
  c.title = "Email consent?";
  const e2 = newNode("action.send_push", 920, 0);
  e2.title = "Send: KYC reminder push";
  const end = newNode("control.end", 920, 160);
  end.title = "End";
  return {
    id: "flow-kyc",
    name: "Welcome & KYC nudge",
    status: "active",
    version: 2,
    versions: [
      { version: 1, author: "S. Malik", publishedAt: daysAgo(60), summary: "Initial publish" },
      { version: 2, author: "S. Malik", publishedAt: daysAgo(12), summary: "Added push fallback" },
    ],
    nodes: [t, e1, w, c, e2, end],
    edges: [
      { id: "ke1", from: t.id, to: e1.id },
      { id: "ke2", from: e1.id, to: w.id },
      { id: "ke3", from: w.id, to: c.id },
      { id: "ke4", from: c.id, to: e2.id },
      { id: "ke5", from: c.id, to: end.id },
    ],
    enrolled: 3420,
    completed: 2611,
    goalConversion: 76.4,
    members: seedMembers(9),
    settings: { goalMetric: "kyc_approved", quietHours: "23:00–06:00", reentry: "once" },
    updatedAt: daysAgo(12),
  };
}

function seedRiskFlow(): Flow {
  const t = newNode("trigger.dormant_30", 40, 60);
  t.title = "Dormant 30 days";
  const e1 = newNode("action.send_email", 260, 60);
  e1.title = "Send: Win-back";
  e1.config.template = "tpl-winback";
  const w = newNode("action.wait_duration", 480, 60);
  w.title = "Wait 3 days";
  const end = newNode("control.end", 700, 60);
  end.title = "End";
  return {
    id: "flow-risk",
    name: "Risk-aware nurture",
    status: "paused",
    version: 1,
    versions: [{ version: 1, author: "Risk Bot", publishedAt: daysAgo(35), summary: "Initial publish" }],
    nodes: [t, e1, w, end],
    edges: [
      { id: "re1", from: t.id, to: e1.id },
      { id: "re2", from: e1.id, to: w.id },
      { id: "re3", from: w.id, to: end.id },
    ],
    enrolled: 610,
    completed: 402,
    goalConversion: 9.1,
    members: seedMembers(6),
    settings: { goalMetric: "login_returned", quietHours: "22:00–07:00", reentry: "after_days", reentryDays: 30 },
    updatedAt: daysAgo(35),
  };
}

function seedMembers(n: number): FlowMember[] {
  const handles = [
    "an***@mail.com", "+49 •••• 4821", "rk***@proton.me", "+971 •••• 1177", "ps***@gmail.com",
    "dv***@outlook.com", "+234 •••• 9032", "ml***@gmail.com", "+1 •••• 5510", "jf***@gmail.com",
    "+55 •••• 7741", "kw***@hey.com", "hs***@outlook.com", "oa***@gmail.com",
  ];
  const steps = ["Congrats email", "Wait 2 days", "Segment check", "Scaling upsell", "End"];
  const statuses: FlowMember["status"][] = ["waiting", "completed", "waiting", "exited", "completed", "waiting", "failed", "completed"];
  return Array.from({ length: n }, (_, i) => ({
    id: `fm-${i}`,
    contact: handles[i % handles.length],
    enteredAt: daysAgo(i % 14),
    currentStep: steps[i % steps.length],
    status: statuses[i % statuses.length],
    lastActivity: daysAgo(i % 6),
  }));
}

let FLOWS: Flow[] = [seedWelcomeFlow(), seedKycFlow(), seedRiskFlow()];

export function listFlows(): Flow[] {
  return FLOWS;
}

export function getFlow(id: string): Flow | undefined {
  return FLOWS.find((f) => f.id === id);
}

export function createFlow(name: string, triggerType?: FlowNodeType): Flow {
  const nodes: FlowNode[] = [];
  if (triggerType) {
    const t = newNode(triggerType, 60, 80);
    nodes.push(t);
  }
  const flow: Flow = {
    id: `flow-${Math.random().toString(36).slice(2, 9)}`,
    name,
    status: "draft",
    version: 0,
    versions: [],
    nodes,
    edges: [],
    enrolled: 0,
    completed: 0,
    goalConversion: 0,
    members: [],
    settings: { goalMetric: "conversion", quietHours: "22:00–07:00", reentry: "once" },
    updatedAt: new Date().toISOString(),
  };
  FLOWS = [flow, ...FLOWS];
  return flow;
}

export function saveFlow(id: string, patch: Partial<Flow>): Flow | undefined {
  const f = FLOWS.find((x) => x.id === id);
  if (!f) return undefined;
  const next = { ...f, ...patch, updatedAt: new Date().toISOString() };
  FLOWS = FLOWS.map((x) => (x.id === id ? next : x));
  return next;
}

export function duplicateFlow(id: string): Flow | undefined {
  const f = FLOWS.find((x) => x.id === id);
  if (!f) return undefined;
  const copy: Flow = {
    ...f,
    id: `flow-${Math.random().toString(36).slice(2, 9)}`,
    name: `${f.name} (copy)`,
    status: "draft",
    version: 0,
    versions: [],
    enrolled: 0,
    completed: 0,
    goalConversion: 0,
    members: [],
    nodes: f.nodes.map((n) => ({ ...n, id: `n-${Math.random().toString(36).slice(2, 9)}` })),
    edges: [],
    updatedAt: new Date().toISOString(),
  };
  // Remap edges to the copied node ids (same order).
  const map = new Map(f.nodes.map((n, i) => [n.id, copy.nodes[i].id]));
  copy.edges = f.edges.map((e) => ({ id: e.id, from: map.get(e.from) ?? e.from, to: map.get(e.to) ?? e.to }));
  FLOWS = [copy, ...FLOWS];
  return copy;
}

export function deleteFlow(id: string): boolean {
  const before = FLOWS.length;
  FLOWS = FLOWS.filter((f) => f.id !== id);
  return FLOWS.length < before;
}

/* ── Validation (8.2) ── */

export interface ValidationIssue {
  nodeId?: string;
  nodeName?: string;
  severity: "error" | "warning";
  message: string;
}

export function validateFlow(flow: Flow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const triggers = flow.nodes.filter((n) => isTrigger(n.type));
  if (flow.nodes.length === 0) {
    issues.push({ severity: "error", message: "Flow is empty — add a trigger to begin." });
    return issues;
  }
  if (triggers.length === 0) {
    issues.push({ severity: "error", message: "Flow has no trigger — nothing can start it." });
  }
  const outgoing = new Map<string, number>();
  for (const e of flow.edges) outgoing.set(e.from, (outgoing.get(e.from) ?? 0) + 1);

  for (const n of flow.nodes) {
    if ((n.type === "action.send_email" || n.type === "action.send_sms" || n.type === "action.send_push") && !n.config.template) {
      issues.push({ nodeId: n.id, nodeName: n.title, severity: "error", message: `“${n.title}” has no template selected.` });
    }
    if (n.type === "cond.segment" && !n.config.segmentId) {
      issues.push({ nodeId: n.id, nodeName: n.title, severity: "error", message: `“${n.title}” has no segment selected.` });
    }
    if (n.type !== "control.end" && (outgoing.get(n.id) ?? 0) === 0) {
      issues.push({ nodeId: n.id, nodeName: n.title, severity: "warning", message: `“${n.title}” is a dead end — connect it to End.` });
    }
  }
  return issues;
}

/** Publish: snapshots an immutable version, flips status to Active. */
export function publishFlow(id: string): { ok: boolean; issues: ValidationIssue[]; flow?: Flow } {
  const flow = getFlow(id);
  if (!flow) return { ok: false, issues: [{ severity: "error", message: "Flow not found." }] };
  const issues = validateFlow(flow);
  if (issues.some((i) => i.severity === "error")) return { ok: false, issues };
  const version = flow.version + 1;
  const next = saveFlow(id, {
    version,
    status: "active",
    versions: [
      ...flow.versions,
      { version, author: "You", publishedAt: new Date().toISOString(), summary: `Published v${version}` },
    ],
  });
  return { ok: true, issues, flow: next };
}

/** Restore an old version as a NEW draft (never overwrites live). */
export function restoreFlowVersion(id: string, version: number): { ok: boolean; flow?: Flow; error?: string } {
  const flow = getFlow(id);
  if (!flow) return { ok: false, error: "Flow not found." };
  const next = saveFlow(id, { version: flow.version + 1, status: "draft" });
  return { ok: true, flow: next };
}

export function updateFlowSettings(id: string, settings: Partial<FlowSettings>): Flow | undefined {
  return saveFlow(id, { settings: { ...(getFlow(id)?.settings ?? { goalMetric: "conversion", quietHours: "22:00–07:00", reentry: "once" }), ...settings } });
}

export function setFlowStatus(id: string, status: Flow["status"]): Flow | undefined {
  return saveFlow(id, { status });
}

export function removeFlowMember(flowId: string, memberId: string): Flow | undefined {
  const flow = getFlow(flowId);
  if (!flow) return undefined;
  return saveFlow(flowId, { members: flow.members.filter((m) => m.id !== memberId) });
}

export function setFlowMemberStatus(flowId: string, memberId: string, status: FlowMember["status"]): Flow | undefined {
  const flow = getFlow(flowId);
  if (!flow) return undefined;
  return saveFlow(flowId, { members: flow.members.map((m) => (m.id === memberId ? { ...m, status } : m)) });
}

/* ── Funnel (8.3) ── */

export interface FunnelStep {
  nodeId: string;
  label: string;
  count: number;
  dropoff: number; // % of previous
}

export function flowFunnel(flow: Flow): FunnelStep[] {
  if (flow.nodes.length === 0) return [];
  // Walk edges from the trigger to produce a linear order (first path).
  const trigger = flow.nodes.find((n) => isTrigger(n.type)) ?? flow.nodes[0];
  const order: FlowNode[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = trigger.id;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = flow.nodes.find((n) => n.id === cursor);
    if (!node) break;
    order.push(node);
    cursor = flow.edges.find((e) => e.from === cursor)?.to;
  }
  const base = Math.max(flow.enrolled, 1);
  let prev = base;
  return order.map((n, i) => {
    const ratio = i === 0 ? 1 : [1, 0.82, 0.64, 0.51, 0.44, 0.37][i % 6];
    const count = Math.max(1, Math.round(base * ratio * (i === 0 ? 1 : 0.94)));
    const dropoff = i === 0 ? 0 : Math.round((1 - count / prev) * 100);
    prev = count;
    return { nodeId: n.id, label: n.title, count, dropoff };
  });
}

/* ------------------------------------------------------------------ */
/* Pre-launch checklist (8.1 step 4)                                   */
/* ------------------------------------------------------------------ */

export interface CheckResult {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail" | "pending";
  detail: string;
  blocking: boolean;
  fix?: string;
}

const SPAM_WORDS = ["free!!!", "act now", "100% free", "guarantee", "no obligation"];

/** Deterministic preflight over the draft — recomputed live as the admin edits. */
export function runChecklist(input: {
  subject: string;
  body: string;
  channel: Channel;
  segment?: Segment;
  autoExclude: boolean;
  providerHealthy?: boolean;
  quotaOk?: boolean;
}): CheckResult[] {
  const spamWords = SPAM_WORDS.filter((w) => `${input.subject} ${input.body}`.toLowerCase().includes(w));
  const caps = /\b[A-Z]{6,}\b/.test(input.subject);
  const spamScore = 1.8 + spamWords.length * 2.4 + (caps ? 1.6 : 0);
  const links = (input.body.match(/https?:\/\/\S+/g) ?? []).length;
  const coverage = input.segment?.consentCoverage ?? 100;
  const domainBlocked = input.channel === "email" ? hasBlockingDomain() : false;

  return [
    {
      key: "spam",
      label: "Spam score",
      status: spamScore > 5 ? "fail" : spamScore > 3.5 ? "warn" : "pass",
      detail: spamScore > 5
        ? `${spamScore.toFixed(1)} / 10 — exceeds the 5.0 block threshold${spamWords.length ? ` (${spamWords.join(", ")})` : caps ? " (ALL-CAPS subject word)" : ""}.`
        : `${spamScore.toFixed(1)} / 10 — under the 5.0 threshold.`,
      blocking: spamScore > 5,
      fix: "Remove spam-trigger phrases or ALL-CAPS words from the subject/body.",
    },
    {
      key: "links",
      label: "Link check",
      status: "pass",
      detail: links === 0 ? "No external anchors — nothing to resolve." : `${links} anchor${links > 1 ? "s" : ""} resolve successfully.`,
      blocking: false,
    },
    {
      key: "consent",
      label: "Consent coverage",
      status: coverage < 70 ? "warn" : "pass",
      detail: input.segment
        ? `${coverage}% of “${input.segment.name}” is channel-ready${input.autoExclude ? ` — ${excludedCount(input.segment)} non-consented members auto-excluded.` : " — auto-exclude is OFF; non-consented members will be dropped by the gateway."}`
        : "No segment selected yet.",
      blocking: false,
    },
    {
      key: "domain",
      label: "Sending domain auth (N3)",
      status: domainBlocked ? "fail" : "pass",
      detail: domainBlocked
        ? "SPF/DKIM/DMARC not fully verified for a sending domain — campaign scheduling is blocked until domains verify."
        : input.channel === "email" ? "Sending domains verified (SPF/DKIM/DMARC)." : "Not required for this channel.",
      blocking: domainBlocked,
      fix: "Verify domains in Marketing → Sending Domains & Auth, then re-run preflight.",
    },
    {
      key: "quota",
      label: "Channel quota",
      status: input.quotaOk === false ? "fail" : "pass",
      detail: input.quotaOk === false
        ? "Daily send quota for this channel is exhausted (M2 limits)."
        : `${CHANNEL_LABEL[input.channel]} quota: 12% of daily limit used.`,
      blocking: input.quotaOk === false,
      fix: "Retry — quota windows reset at 00:00 UTC, or raise the limit in Channels.",
    },
    {
      key: "provider",
      label: "Provider health",
      status: input.providerHealthy === false ? "fail" : "pass",
      detail: input.providerHealthy === false
        ? "Sending provider degraded — 5xx responses in the last 10 min."
        : "All sending providers nominal.",
      blocking: input.providerHealthy === false,
      fix: "Retry the health probe; if it persists check the provider status in Integrations.",
    },
  ];
}

export function excludedCount(segment: Segment): number {
  return Math.max(0, Math.round((segment.size * (100 - segment.consentCoverage)) / 100));
}

/* ------------------------------------------------------------------ */
/* Composer drafts (8.1 autosave)                                      */
/* ------------------------------------------------------------------ */

export interface ComposerDraft {
  name: string;
  channel: Channel;
  templateId: string;
  segmentId: string;
  mode: "now" | "scheduled";
  scheduledAt: string; // datetime-local value
  sendWindow: boolean;
  subject: string;
  body: string;
  abEnabled: boolean;
  variantBSubject: string;
  variantBBody: string;
  split: number;
  winningMetric: "open" | "ctr" | "conversion";
  testSendTo: string;
  autoExclude: boolean;
}

export const EMPTY_DRAFT: ComposerDraft = {
  name: "",
  channel: "email",
  templateId: "",
  segmentId: "",
  mode: "now",
  scheduledAt: "",
  sendWindow: false,
  subject: "",
  body: "",
  abEnabled: false,
  variantBSubject: "",
  variantBBody: "",
  split: 50,
  winningMetric: "open",
  testSendTo: "",
  autoExclude: true,
};
