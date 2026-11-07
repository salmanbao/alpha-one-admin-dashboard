"use client";
/**
 * R3-06 — Brand Governance store (dummy, store-backed).
 *
 * Binds a brand kit (tokens, domains, sender identities, template/landing
 * consumers) into one governed brand profile per firm, with versioned
 * changes and a drift report.
 *
 *  • AC-1 — token changes are applied in-place; the drift report re-runs
 *    so non-compliant assets (still on an older version or violating a
 *    governance rule) are flagged; previews use the live (edited) profile.
 *  • AC-2 — every profile change bumps the version, records a version
 *    entry (changedBy/changedAt/change summary) and is N11-audit-logged.
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export interface BrandTokens {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoLight: string;   // asset id
  logoDark: string;    // asset id
  fontScale: number;   // 0.85 … 1.15
}

export interface GovernanceRules {
  /** Mandatory footer text rendered into every email. */
  footerText: string;
  /** Whether the unsubscribe line must carry brand styling. */
  unsubscribeBranded: boolean;
  /** Whether every email/landing asset must ship a dark-mode logo. */
  darkLogoRequired: boolean;
  /** Whether the email template must include the firm's legal name. */
  legalNameRequired: boolean;
}

export interface BrandDomain {
  id: string;
  kind: "email" | "site";
  domain: string;
  status: "verified" | "pending" | "failed";
  spf: boolean; dkim: boolean; dmarc: boolean;
}

export interface SenderIdentity {
  id: string;
  name: string;
  email: string;
  domain: string;
  defaultFor: string[];
}

export interface BrandConsumer {
  id: string;
  kind: "email_template" | "landing_page" | "form";
  name: string;
  /** Profile version this asset was last synced against. */
  appliedVersion: number;
  /** Whether this asset ships a dark-mode logo (governance check). */
  hasDarkLogo: boolean;
  /** Whether the mandatory footer is present in this asset. */
  hasFooter: boolean;
  /** Whether the legal name is present in this asset. */
  hasLegalName: boolean;
}

export interface BrandVersion {
  version: number;
  changedBy: string;
  changedAt: string;
  summary: string;
  tokens: BrandTokens;
  rules: GovernanceRules;
}

export interface BrandProfile {
  id: string;
  name: string;
  version: number;
  tokens: BrandTokens;
  rules: GovernanceRules;
  domains: BrandDomain[];
  senders: SenderIdentity[];
  consumers: BrandConsumer[];
  versions: BrandVersion[];
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

const seedTokens: BrandTokens = {
  primaryColor: "#b45309",
  secondaryColor: "#1f2937",
  accentColor: "#0ea5e9",
  fontFamily: "Inter, system-ui, sans-serif",
  logoLight: "asset-logo-light",
  logoDark: "asset-logo-dark",
  fontScale: 1.0,
};

const seedRules: GovernanceRules = {
  footerText: "© 2026 AlphaOne Prop Trading. All rights reserved. Unsubscribe: {{unsubscribe_url}}",
  unsubscribeBranded: true,
  darkLogoRequired: true,
  legalNameRequired: true,
};

let PROFILE: BrandProfile = {
  id: "brand-alphaone",
  name: "AlphaOne",
  version: 4,
  tokens: { ...seedTokens },
  rules: { ...seedRules },
  domains: [
    { id: "d1", kind: "email", domain: "mail.alphaone.io", status: "verified", spf: true, dkim: true, dmarc: true },
    { id: "d2", kind: "email", domain: "news.alphaone.io", status: "verified", spf: true, dkim: true, dmarc: false },
    { id: "d3", kind: "site", domain: "alphaone.io", status: "verified", spf: false, dkim: false, dmarc: false },
    { id: "d4", kind: "site", domain: "promo.alphaone.io", status: "pending", spf: false, dkim: false, dmarc: false },
  ],
  senders: [
    { id: "s1", name: "AlphaOne", email: "hello@mail.alphaone.io", domain: "mail.alphaone.io", defaultFor: ["campaigns", "transactional"] },
    { id: "s2", name: "AlphaOne Support", email: "support@mail.alphaone.io", domain: "mail.alphaone.io", defaultFor: ["support"] },
    { id: "s3", name: "AlphaOne Education", email: "learn@news.alphaone.io", domain: "news.alphaone.io", defaultFor: ["education"] },
  ],
  consumers: [
    { id: "c1", kind: "email_template", name: "Welcome & KYC nudge", appliedVersion: 4, hasDarkLogo: true, hasFooter: true, hasLegalName: true },
    { id: "c2", kind: "email_template", name: "Q4 Scale Blitz", appliedVersion: 3, hasDarkLogo: false, hasFooter: true, hasLegalName: true },
    { id: "c3", kind: "landing_page", name: "Scale-Up Oct landing", appliedVersion: 4, hasDarkLogo: true, hasFooter: true, hasLegalName: false },
    { id: "c4", kind: "form", name: "Lead capture — funded", appliedVersion: 2, hasDarkLogo: false, hasFooter: false, hasLegalName: true },
    { id: "c5", kind: "email_template", name: "Win-back", appliedVersion: 4, hasDarkLogo: true, hasFooter: true, hasLegalName: true },
  ],
  versions: [
    { version: 4, changedBy: "Sarah Chen", changedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), summary: "Accent color refresh + dark-logo rule", tokens: { ...seedTokens }, rules: { ...seedRules } },
    { version: 3, changedBy: "Maya Okafor", changedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(), summary: "Font family → Inter", tokens: { ...seedTokens, fontFamily: "Georgia, serif" }, rules: { ...seedRules } },
    { version: 2, changedBy: "Sarah Chen", changedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(), summary: "Initial brand kit", tokens: { ...seedTokens, primaryColor: "#7c3aed" }, rules: { ...seedRules, darkLogoRequired: false } },
  ],
};

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function getProfile(): BrandProfile { return PROFILE; }

export interface DriftItem {
  consumer: BrandConsumer;
  reasons: string[];
}

/** AC-1: re-runs against the (possibly edited) profile to flag drift. */
export function driftReport(profile: BrandProfile = PROFILE): DriftItem[] {
  const out: DriftItem[] = [];
  for (const c of profile.consumers) {
    const reasons: string[] = [];
    if (c.appliedVersion < profile.version) reasons.push(`stale tokens — on profile v${c.appliedVersion}, current is v${profile.version}`);
    if (profile.rules.darkLogoRequired && !c.hasDarkLogo) reasons.push("missing dark-mode logo (governance rule)");
    if (profile.rules.footerText && !c.hasFooter) reasons.push("mandatory footer text missing");
    if (profile.rules.legalNameRequired && !c.hasLegalName) reasons.push("legal name missing");
    if (reasons.length) out.push({ consumer: c, reasons });
  }
  return out;
}

export function compliantCount(profile: BrandProfile = PROFILE): number {
  return profile.consumers.length - driftReport(profile).length;
}

/* ------------------------------------------------------------------ */
/* Mutations — versioned + audit-logged (AC-2)                         */
/* ------------------------------------------------------------------ */

export interface ProfileUpdate {
  tokens?: Partial<BrandTokens>;
  rules?: Partial<GovernanceRules>;
}

export function updateProfile(update: ProfileUpdate, actor: string, summary: string): BrandProfile {
  const next: BrandProfile = {
    ...PROFILE,
    version: PROFILE.version + 1,
    tokens: { ...PROFILE.tokens, ...(update.tokens ?? {}) },
    rules: { ...PROFILE.rules, ...(update.rules ?? {}) },
  };
  const versionEntry: BrandVersion = {
    version: next.version,
    changedBy: actor,
    changedAt: new Date().toISOString(),
    summary: summary.trim() || "Brand profile update",
    tokens: { ...next.tokens },
    rules: { ...next.rules },
  };
  next.versions = [versionEntry, ...PROFILE.versions];

  PROFILE = next;
  emit();

  recordAudit({
    action: "brand.profile.update",
    entity: "brand_profile",
    entityId: `${PROFILE.id}@v${PROFILE.version}`,
    summary: `Brand profile ${PROFILE.name} advanced to v${PROFILE.version} by ${actor}: ${versionEntry.summary} (drift: ${driftReport(next).length} asset(s))`,
    module: "settings",
    severity: driftReport(next).length > 0 ? "warning" : "info",
  });
  return PROFILE;
}

export function setConsumerCompliance(consumerId: string, patch: Partial<Pick<BrandConsumer, "hasDarkLogo" | "hasFooter" | "hasLegalName" | "appliedVersion">>): void {
  PROFILE = {
    ...PROFILE,
    consumers: PROFILE.consumers.map(c => (c.id === consumerId ? { ...c, ...patch } : c)),
  };
  emit();
}

export function addDomain(d: Omit<BrandDomain, "id">): BrandDomain {
  const rec: BrandDomain = { ...d, id: `dom-${Date.now().toString(36)}` };
  PROFILE = { ...PROFILE, domains: [...PROFILE.domains, rec] };
  emit();
  recordAudit({ action: "brand.domain.add", entity: "brand_domain", entityId: rec.id, summary: `Added ${rec.kind} domain ${rec.domain} (${rec.status})`, module: "settings" });
  return rec;
}

export function addSender(s: Omit<SenderIdentity, "id">): SenderIdentity {
  const rec: SenderIdentity = { ...s, id: `snd-${Date.now().toString(36)}` };
  PROFILE = { ...PROFILE, senders: [...PROFILE.senders, rec] };
  emit();
  recordAudit({ action: "brand.sender.add", entity: "brand_sender", entityId: rec.id, summary: `Added sender identity ${rec.name} <${rec.email}>`, module: "settings" });
  return rec;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() { version += 1; listeners.forEach(l => l()); }

export function useBrandVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
