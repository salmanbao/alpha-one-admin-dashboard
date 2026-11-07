"use client";
/**
 * R2-03 — On-Site Studio store (round-3 depth uplift).
 *
 * The trigger/targeting/frequency panels become real rule objects with an
 * evaluation API (R3-F05: the old panels were form state with narrated
 * toasts — nothing evaluated them), and conversions are recorded as
 * attribution records that feed the unit's counters and the
 * suppress_after_conversion frequency rule.
 *
 * Service contract:
 *  • listOnsite/getOnsite/saveOnsite/createOnsite/duplicateOnsite — editor
 *  • evaluateOnsite(unit, ctx) — the client-side rule engine: status →
 *    trigger → targeting → frequency, returning show/skip with per-rule
 *    reasons (the preview, the embed shim and this store all agree)
 *  • recordConversion / listConversions — attribution records (unit, page,
 *    session, value) that bump counters and can suppress future impressions
 *  • recordImpression / recordDismissal — frequency state per session
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";

export type OnsiteType = "popup" | "banner" | "slab" | "inline";
export type OnsiteStatus = "draft" | "active" | "paused" | "archived";
export interface OnsiteCampaign {
  id: string; name: string; type: OnsiteType; template: string; status: OnsiteStatus;
  trigger: { kind: "page_view" | "scroll" | "exit_intent" | "time_on_page" | "click"; value?: string };
  audience: { segment?: string; country?: string; device?: string; loggedIn?: boolean };
  frequency: { mode: "once" | "session" | "every_n_days" | "suppress_after_conversion"; n?: number };
  impressions: number; clicks: number; dismissals: number; conversions: number; updatedAt: string;
  blocks: Array<{ id: string; type: string; label: string }>;
}

/** Attribution record — which session/page/asset produced the conversion. */
export interface ConversionRecord {
  id: string;
  unitId: string;
  session: string;
  page: string;
  value: number;
  currency: string;
  at: string;
}

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let ITEMS: OnsiteCampaign[] = [
  { id: "os1", name: "KYC Nudge Popup", type: "popup", template: "KYC nudge", status: "active", trigger: { kind: "exit_intent" }, audience: { segment: "KYC-verified, not deposited", loggedIn: true }, frequency: { mode: "every_n_days", n: 3 }, impressions: 8420, clicks: 611, dismissals: 420, conversions: 188, updatedAt: now(), blocks: [{ id: "b1", type: "hero", label: "Headline" }, { id: "b2", type: "form", label: "Form embed (R2-02)" }] },
  { id: "os2", name: "Deposit Boost Slab", type: "slab", template: "deposit boost", status: "draft", trigger: { kind: "page_view", value: "/dashboard" }, audience: { segment: "Funded active" }, frequency: { mode: "suppress_after_conversion" }, impressions: 0, clicks: 0, dismissals: 0, conversions: 0, updatedAt: now(), blocks: [{ id: "b1", type: "countdown", label: "Countdown" }] },
];

export function listOnsite(): OnsiteCampaign[] { return ITEMS; }
export function getOnsite(id: string): OnsiteCampaign | undefined { return ITEMS.find(i => i.id === id); }
export function saveOnsite(p: Partial<OnsiteCampaign> & { id: string }) { ITEMS = ITEMS.map(x => x.id === p.id ? { ...x, ...p, updatedAt: now() } : x); emit(); }
export function createOnsite(name: string, type: OnsiteType, template: string): OnsiteCampaign {
  const rec: OnsiteCampaign = { id: `os-${Date.now()}`, name, type, template, status: "draft", trigger: { kind: "page_view" }, audience: {}, frequency: { mode: "session" }, impressions: 0, clicks: 0, dismissals: 0, conversions: 0, updatedAt: now(), blocks: [{ id: "b1", type: "hero", label: "Headline" }] };
  ITEMS = [rec, ...ITEMS]; emit(); return rec;
}
export function duplicateOnsite(id: string) {
  const s = getOnsite(id); if (!s) return;
  ITEMS = [{ ...s, id: `os-${Date.now()}`, name: `${s.name} (copy)`, status: "draft", updatedAt: now() }, ...ITEMS]; emit();
}

/* ------------------------------------------------------------------ */
/* Rule engine — trigger / targeting / frequency evaluation (R2-03)    */
/* ------------------------------------------------------------------ */

/** Visitor/session context the engine evaluates a unit against. */
export interface OnsiteContext {
  /** URL path the visitor is on. */
  page: string;
  device: "desktop" | "mobile";
  country?: string;
  loggedIn: boolean;
  /** Segment labels the visitor belongs to (M3 segment engine output). */
  segments: string[];
  /** Session-scoped impression/dismiss state for this unit. */
  impressionsInSession: number;
  dismissed: boolean;
  /** Days since this visitor's last impression (frequency.every_n_days). */
  daysSinceLastImpression?: number;
  /** Whether this visitor already converted (frequency.suppress_after_conversion). */
  converted: boolean;
  /** Whether the trigger event actually happened this pageview. */
  triggerEvent: { kind: OnsiteCampaign["trigger"]["kind"]; scrollPct?: number; timeOnPageSec?: number };
}

export interface EvaluationResult {
  show: boolean;
  /** Per-stage trace: each rule that passed/failed with the reason. */
  reasons: Array<{ stage: "status" | "trigger" | "targeting" | "frequency"; ok: boolean; detail: string }>;
}

function triggerMatches(c: OnsiteCampaign, ctx: OnsiteContext): { ok: boolean; detail: string } {
  const t = c.trigger;
  if (t.kind !== ctx.triggerEvent.kind) return { ok: false, detail: `waiting for ${t.kind} event (got ${ctx.triggerEvent.kind})` };
  switch (t.kind) {
    case "page_view": {
      const want = t.value?.trim();
      if (!want || want === "*") return { ok: true, detail: "any page" };
      return { ok: ctx.page === want, detail: `path ${ctx.page} vs ${want}` };
    }
    case "scroll": {
      const pct = Number((t.value ?? "50").replace("%", "")) || 50;
      const at = ctx.triggerEvent.scrollPct ?? 0;
      return { ok: at >= pct, detail: `scroll ${at}% ≥ ${pct}%` };
    }
    case "time_on_page": {
      const sec = Number(t.value ?? "30") || 30;
      const at = ctx.triggerEvent.timeOnPageSec ?? 0;
      return { ok: at >= sec, detail: `${at}s on page ≥ ${sec}s` };
    }
    case "exit_intent":
    case "click":
      return { ok: true, detail: `${t.kind} fired` };
  }
}

function targetingMatches(c: OnsiteCampaign, ctx: OnsiteContext): { ok: boolean; detail: string } {
  const a = c.audience;
  if (a.device && a.device !== ctx.device) return { ok: false, detail: `device ${ctx.device} ≠ ${a.device}` };
  if (a.country && a.country !== ctx.country) return { ok: false, detail: `country ${ctx.country ?? "—"} ≠ ${a.country}` };
  if (a.loggedIn && !ctx.loggedIn) return { ok: false, detail: "requires logged-in visitor" };
  if (a.segment && !ctx.segments.includes(a.segment)) return { ok: false, detail: `segment "${a.segment}" not in visitor segments` };
  return { ok: true, detail: a.segment ? `segment "${a.segment}" matched` : "all visitors" };
}

function frequencyAllows(c: OnsiteCampaign, ctx: OnsiteContext): { ok: boolean; detail: string } {
  const f = c.frequency;
  switch (f.mode) {
    case "once":
      return { ok: ctx.impressionsInSession === 0, detail: ctx.impressionsInSession === 0 ? "first impression" : `already shown ${ctx.impressionsInSession}×` };
    case "session":
      return { ok: ctx.impressionsInSession === 0, detail: ctx.impressionsInSession === 0 ? "not yet this session" : "shown this session" };
    case "every_n_days": {
      const n = f.n ?? 3;
      const d = ctx.daysSinceLastImpression;
      if (d === undefined) return { ok: true, detail: "no prior impression" };
      return { ok: d >= n, detail: `${d}d since last ≥ ${n}d` };
    }
    case "suppress_after_conversion":
      return { ok: !ctx.converted, detail: ctx.converted ? "visitor already converted — suppressed" : "no conversion yet" };
  }
}

/**
 * Evaluate one unit against a visitor context: status → trigger →
 * targeting → frequency, short-circuiting with a reason per stage.
 */
export function evaluateOnsite(c: OnsiteCampaign, ctx: OnsiteContext): EvaluationResult {
  const reasons: EvaluationResult["reasons"] = [];
  const statusOk = c.status === "active";
  reasons.push({ stage: "status", ok: statusOk, detail: statusOk ? "active" : `status is ${c.status}` });
  if (!statusOk) return { show: false, reasons };

  const trig = triggerMatches(c, ctx);
  reasons.push({ stage: "trigger", ok: trig.ok, detail: trig.detail });
  if (!trig.ok) return { show: false, reasons };

  const tgt = targetingMatches(c, ctx);
  reasons.push({ stage: "targeting", ok: tgt.ok, detail: tgt.detail });
  if (!tgt.ok) return { show: false, reasons };

  const freq = frequencyAllows(c, ctx);
  reasons.push({ stage: "frequency", ok: freq.ok, detail: freq.detail });
  return { show: freq.ok, reasons };
}

/* ------------------------------------------------------------------ */
/* Conversion attribution + impression state (R2-03 uplift)            */
/* ------------------------------------------------------------------ */

let CONVERSIONS: ConversionRecord[] = [
  { id: "cnv-1", unitId: "os1", session: "sess-8f21", page: "/register", value: 0, currency: "USD", at: daysAgo(2) },
  { id: "cnv-2", unitId: "os1", session: "sess-11ac", page: "/kyc", value: 0, currency: "USD", at: daysAgo(1) },
];

/** Per-unit impression/dismiss state per session (drives the engine). */
const sessionState = new Map<string, { impressions: number; dismissed: boolean; lastAt?: string; converted: boolean }>();
const stateKey = (unitId: string, session: string) => `${unitId}:${session}`;

export function listConversions(unitId?: string): ConversionRecord[] {
  return unitId ? CONVERSIONS.filter(c => c.unitId === unitId) : CONVERSIONS;
}

/**
 * Record a conversion attributed to a unit + session. Bumps the unit's
 * counter and flips the session to converted (suppress_after_conversion).
 */
export function recordConversion(input: { unitId: string; session: string; page: string; value?: number; currency?: string }): ConversionRecord | null {
  const unit = getOnsite(input.unitId);
  if (!unit) return null;
  const rec: ConversionRecord = {
    id: `cnv-${Date.now()}`,
    unitId: input.unitId,
    session: input.session,
    page: input.page,
    value: input.value ?? 0,
    currency: input.currency ?? "USD",
    at: now(),
  };
  CONVERSIONS = [rec, ...CONVERSIONS];
  ITEMS = ITEMS.map(x => x.id === input.unitId ? { ...x, conversions: x.conversions + 1, updatedAt: now() } : x);
  const k = stateKey(input.unitId, input.session);
  const st = sessionState.get(k) ?? { impressions: 0, dismissed: false };
  sessionState.set(k, { ...st, converted: true });
  recordAudit({
    action: "onsite.conversion",
    entity: "onsite",
    entityId: input.unitId,
    summary: `Conversion attributed to ${unit.name} (session ${input.session}, page ${input.page}${input.value ? `, value ${input.value} ${input.currency ?? "USD"}` : ""})`,
    module: "marketing",
  });
  emit();
  return rec;
}

/** Record an impression against the session's frequency state. */
export function recordImpression(unitId: string, session: string): void {
  const k = stateKey(unitId, session);
  const st = sessionState.get(k) ?? { impressions: 0, dismissed: false, converted: false };
  sessionState.set(k, { ...st, impressions: st.impressions + 1, lastAt: now() });
  ITEMS = ITEMS.map(x => x.id === unitId ? { ...x, impressions: x.impressions + 1 } : x);
  emit();
}

/** Record a dismissal (counts toward the unit's dismissals metric). */
export function recordDismissal(unitId: string, session: string): void {
  const k = stateKey(unitId, session);
  const st = sessionState.get(k) ?? { impressions: 0, dismissed: false, converted: false };
  sessionState.set(k, { ...st, dismissed: true });
  ITEMS = ITEMS.map(x => x.id === unitId ? { ...x, dismissals: x.dismissals + 1 } : x);
  emit();
}

/** Build an engine context from the current session state for a unit. */
export function sessionContext(unitId: string, session: string, base: Omit<OnsiteContext, "impressionsInSession" | "dismissed" | "converted">): OnsiteContext {
  const st = sessionState.get(stateKey(unitId, session));
  return {
    ...base,
    impressionsInSession: st?.impressions ?? 0,
    dismissed: st?.dismissed ?? false,
    converted: st?.converted ?? false,
    daysSinceLastImpression: st?.lastAt ? Math.floor((Date.now() - new Date(st.lastAt).getTime()) / 86_400_000) : undefined,
  };
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach(l => l());
}

/** Subscribe the calling component to onsite-store mutations. */
export function useOnsiteVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
