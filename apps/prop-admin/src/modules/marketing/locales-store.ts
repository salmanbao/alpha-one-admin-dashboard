"use client";
/**
 * R3-03 — Campaign Localization Manager store (dummy, store-backed).
 *
 * Translation workflow for translatable assets (templates, landing pages,
 * onsite units, flow messages): locale matrix with per-cell status/translator/
 * update, a variant editor with variable-slot protection ({{n}} placeholders
 * locked), character-count guidance per channel, RTL correctness checks for
 * ar/he, fallback chains, and XLIFF/CSV export-import round-trip for agency
 * translators.
 *
 * AC-1  translated variant previews with RTL correct + variables intact
 *       (validateVariant() enforces both before a cell can be approved).
 * AC-2  campaign send picks locale by recipient preference with the defined
 *       fallback chain (resolveLocaleForRecipient()).
 * AC-3  missing-translation sends fall back and are reported in the campaign
 *       report locale breakdown (localeBreakdown() counts fallbacks).
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { listLandingPages } from "./landing-pages-store";
import { listOnsite } from "./onsite-store";
import { listStudioTemplates } from "./campaign-studio-store";

export type LocaleCode = "en" | "ar" | "he" | "de" | "es" | "fr";
export type TranslationStatus = "missing" | "machine-draft" | "human-reviewed" | "approved";
export type AssetKind = "template" | "landing-page" | "onsite-unit" | "flow-message";

export interface Locale {
  code: LocaleCode;
  label: string;
  native: string;
  rtl: boolean;
  /** Fallback chain: where to render from when a translation is missing (AC-2). */
  fallback: LocaleCode;
}

export interface LocaleAsset {
  id: string;
  kind: AssetKind;
  name: string;
  channel: "email" | "sms" | "whatsapp" | "push" | "web";
  /** Source (en) text — the variant editor's left pane; contains {{n}} slots. */
  source: string;
}

export interface Translation {
  assetId: string;
  locale: LocaleCode;
  status: TranslationStatus;
  text: string;
  translator?: string;
  updatedAt: string;
  /** Set when a human reviewer signed the cell off (approves require review). */
  reviewedBy?: string;
}

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let LOCALES: Locale[] = [
  { code: "en", label: "English", native: "English", rtl: false, fallback: "en" },
  { code: "ar", label: "Arabic", native: "العربية", rtl: true, fallback: "en" },
  { code: "he", label: "Hebrew", native: "עברית", rtl: true, fallback: "en" },
  { code: "de", label: "German", native: "Deutsch", rtl: false, fallback: "en" },
  { code: "es", label: "Spanish", native: "Español", rtl: false, fallback: "en" },
  { code: "fr", label: "French", native: "Français", rtl: false, fallback: "en" },
];

export function listLocales(): Locale[] {
  return LOCALES;
}

export function getLocale(code: string): Locale | undefined {
  return LOCALES.find((l) => l.code === code);
}

/* ------------------------------------------------------------------ */
/* Asset registry — snapshotted from the live marketing stores         */
/* ------------------------------------------------------------------ */

/**
 * Translatable rows: templates (subject+body), landing pages (SEO copy),
 * onsite units (headline blocks) and flow messages (studio templates with
 * placeholders). Built from the real stores so the matrix tracks what the
 * composer/editor actually renders.
 */
function buildAssets(): LocaleAsset[] {
  const assets: LocaleAsset[] = [];

  for (const t of listStudioTemplates()) {
    const slots = t.placeholders.length ? t.placeholders : ["{{firm_name}}"];
    if (t.kind === "campaign") {
      assets.push({
        id: `t:${t.id}`,
        kind: "template",
        name: t.name,
        channel: t.channel === "in-app" ? "web" : t.channel,
        source: `${t.subject ?? t.name} — ${t.outcome} (${slots.join(" ")})`,
      });
    } else {
      assets.push({
        id: `t:${t.id}`,
        kind: "flow-message",
        name: `${t.name} · step 1`,
        channel: t.channel === "in-app" ? "web" : t.channel,
        source: `Hi {{first_name}}, ${t.outcome} ${slots.join(" ")}`,
      });
    }
  }

  for (const p of listLandingPages()) {
    assets.push({
      id: `lp:${p.id}`,
      kind: "landing-page",
      name: `${p.name} — SEO title`,
      channel: "web",
      source: `${p.seo.title} — ${p.seo.description}`,
    });
  }

  for (const o of listOnsite()) {
    const hero = o.blocks.find((b) => b.type === "hero");
    assets.push({
      id: `os:${o.id}`,
      kind: "onsite-unit",
      name: `${o.name} — ${hero?.label ?? "content"}`,
      channel: "web",
      source: `${o.name}: complete your {{step_name}} to unlock {{reward}}. ${o.template}`,
    });
  }

  return assets;
}

let ASSETS: LocaleAsset[] = buildAssets();

/** Re-snapshot assets (called when the matrix is opened with a store bump). */
export function refreshAssets(): LocaleAsset[] {
  ASSETS = buildAssets();
  return ASSETS;
}

export function listAssets(): LocaleAsset[] {
  return ASSETS;
}

export function getAsset(id: string): LocaleAsset | undefined {
  return ASSETS.find((a) => a.id === id);
}

/* ------------------------------------------------------------------ */
/* Translations                                                        */
/* ------------------------------------------------------------------ */

function tr(assetId: string, locale: LocaleCode, patch: Partial<Translation>): Translation {
  return { assetId, locale, status: "missing", text: "", updatedAt: now(), ...patch };
}

let TRANSLATIONS: Translation[] = [
  // Arabic — machine drafts (the RTL locales that the variant editor previews)
  tr("t:tpl-welcome-kyc", "ar", { status: "machine-draft", text: "مرحبًا {{first_name}} — أكمل {{step_name}} لفتح {{reward}} من {{firm_name}}", translator: "DeepL (MT)", updatedAt: daysAgo(4) }),
  tr("lp:lp1", "ar", { status: "machine-draft", text: "تحدّي 100 ألف مع {{firm_name}} — تداول وتوسّع", translator: "DeepL (MT)", updatedAt: daysAgo(3) }),
  tr("os:os1", "ar", { status: "human-reviewed", text: "أكمل {{step_name}} لفتح {{reward}}", translator: "Noura A.", reviewedBy: "Noura A.", updatedAt: daysAgo(2) }),
  tr("t:tpl-upsell", "ar", { status: "missing", text: "", updatedAt: daysAgo(9) }),
  // Hebrew
  tr("lp:lp1", "he", { status: "machine-draft", text: "אתגר 100K עם {{firm_name}} — סחר והתרחב", translator: "Google Translate (MT)", updatedAt: daysAgo(5) }),
  // German — reviewed/approved cells (the healthy end of the workflow)
  tr("t:tpl-welcome-kyc", "de", { status: "approved", text: "Hallo {{first_name}} — schließe {{step_name}} ab, um {{reward}} freizuschalten ({{firm_name}})", translator: "Lena K.", reviewedBy: "Sarah Chen", updatedAt: daysAgo(7) }),
  tr("lp:lp1", "de", { status: "approved", text: "100K Challenge von {{firm_name}} — handeln und skalieren", translator: "Lena K.", reviewedBy: "Sarah Chen", updatedAt: daysAgo(6) }),
  tr("os:os1", "de", { status: "human-reviewed", text: "Schließe {{step_name}} ab, um {{reward}} zu freizuschalten", translator: "Lena K.", reviewedBy: "Lena K.", updatedAt: daysAgo(4) }),
  tr("t:tpl-upsell", "de", { status: "machine-draft", text: "Glückwunsch — jetzt den Skalierungsplan entdecken ({{plan_name}})", translator: "DeepL (MT)", updatedAt: daysAgo(2) }),
  // Spanish / French — a few machine drafts
  tr("lp:lp1", "es", { status: "machine-draft", text: "Reto de 100K con {{firm_name}} — opera y escala", translator: "DeepL (MT)", updatedAt: daysAgo(8) }),
  tr("t:tpl-welcome-kyc", "fr", { status: "machine-draft", text: "Bonjour {{first_name}} — complétez {{step_name}} pour débloquer {{reward}}", translator: "DeepL (MT)", updatedAt: daysAgo(5) }),
];

export function getTranslation(assetId: string, locale: LocaleCode): Translation | undefined {
  return TRANSLATIONS.find((t) => t.assetId === assetId && t.locale === locale);
}

export function cellStatus(assetId: string, locale: LocaleCode): TranslationStatus {
  if (locale === "en") return "approved"; // source locale
  return getTranslation(assetId, locale)?.status ?? "missing";
}

/* ------------------------------------------------------------------ */
/* Variable-slot protection + validation (AC-1)                        */
/* ------------------------------------------------------------------ */

/** Extract the {{n}} variable slots from a string, in order. */
export function extractSlots(text: string): string[] {
  return text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [];
}

export interface VariantValidation {
  ok: boolean;
  /** Slots present in source but missing/renamed in the translation. */
  missingSlots: string[];
  /** Slots in the translation that don't exist in the source. */
  extraSlots: string[];
  /** True when an RTL locale's text contains no RTL script characters. */
  rtlBroken: boolean;
  channelWarning?: string;
  problems: string[];
}

const RTL_RE = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿ]/;
const LTR_RE = /[A-Za-z]/;

/** Per-channel character-count guidance (variant editor hints). */
const CHANNEL_LIMITS: Record<LocaleAsset["channel"], { max: number; note: string }> = {
  sms: { max: 160, note: "SMS hard limit 160 chars (GSM-7); longer = multipart" },
  whatsapp: { max: 1024, note: "WhatsApp body guidance ≤ 1024 chars" },
  push: { max: 90, note: "Push title truncates ≈ 90 chars" },
  email: { max: 60, note: "Subject line guidance ≤ 60 chars for inbox truncation" },
  web: { max: 0, note: "Web copy: no hard limit — keep parity with source length" },
};

export function charGuidance(asset: LocaleAsset, text: string): string {
  const limit = CHANNEL_LIMITS[asset.channel];
  if (!limit.max) return `${text.length} chars · ${limit.note}`;
  const over = text.length > limit.max;
  return `${text.length}/${limit.max} chars · ${limit.note}${over ? " — OVER" : ""}`;
}

/**
 * Validate a translated variant against its source (AC-1): variable slots
 * must match exactly ({{n}} protection), an RTL locale must actually contain
 * RTL script, and channel length guidance is surfaced.
 */
export function validateVariant(asset: LocaleAsset, locale: Locale, translated: string): VariantValidation {
  const sourceSlots = extractSlots(asset.source);
  const targetSlots = extractSlots(translated);
  const missingSlots = sourceSlots.filter((s) => !targetSlots.includes(s));
  const extraSlots = targetSlots.filter((s) => !sourceSlots.includes(s));
  const rtlBroken = locale.rtl && !RTL_RE.test(translated) && translated.trim().length > 0;
  const limit = CHANNEL_LIMITS[asset.channel];
  const problems: string[] = [];

  if (missingSlots.length) problems.push(`Variable slot(s) missing or altered: ${missingSlots.join(", ")} (locked)`);
  if (extraSlots.length) problems.push(`Unknown slot(s): ${extraSlots.join(", ")} — not in source`);
  if (rtlBroken) problems.push(`${locale.code} is RTL but the text has no RTL script — preview will render wrong`);
  if (!translated.trim()) problems.push("Translation is empty");
  if (limit.max && translated.length > limit.max) problems.push(`Over channel limit (${limit.max})`);

  return { ok: problems.length === 0, missingSlots, extraSlots, rtlBroken, channelWarning: problems.length ? undefined : limit.note, problems };
}

/* ------------------------------------------------------------------ */
/* Workflow mutations                                                  */
/* ------------------------------------------------------------------ */

export type VariantSaveResult = { ok: boolean; problems: string[] };

/**
 * Save a variant draft. Variable-slot protection: slots that were dropped or
 * renamed in the translation are reported and the save is refused (the
 * source's {{n}} set is the contract — AC-1).
 */
export function saveVariant(
  assetId: string,
  locale: LocaleCode,
  text: string,
  actor: string,
  mode: "machine-draft" | "human-reviewed",
): VariantSaveResult {
  const asset = getAsset(assetId);
  const loc = getLocale(locale);
  if (!asset || !loc || locale === "en") return { ok: false, problems: ["Cannot edit the source locale"] };
  const v = validateVariant(asset, loc, text);
  // Slot problems block the save; RTL/length problems are advisory warnings
  // the editor shows — reviewers can still keep a draft with a warning.
  const blockers = v.problems.filter((p) => p.startsWith("Variable slot") || p.startsWith("Unknown slot"));
  if (blockers.length) return { ok: false, problems: blockers };

  const existing = getTranslation(assetId, locale);
  const next: Translation = {
    assetId,
    locale,
    status: mode,
    text,
    translator: actor,
    updatedAt: now(),
    reviewedBy: mode === "human-reviewed" ? actor : existing?.reviewedBy,
  };
  TRANSLATIONS = existing
    ? TRANSLATIONS.map((t) => (t === existing ? next : t))
    : [...TRANSLATIONS, next];
  recordAudit({
    action: "Locale variant saved",
    entity: "locale-variant",
    entityId: `${assetId}:${locale}`,
    summary: `${asset.name} [${locale}] saved as ${mode} by ${actor}${v.problems.length ? ` (warnings: ${v.problems[0]})` : ""}`,
    module: "marketing",
    severity: "info",
  });
  emit();
  return { ok: true, problems: v.problems };
}

/** Four-eyes-ish sign-off: approve requires the cell to validate clean. */
export function approveVariant(assetId: string, locale: LocaleCode, actor: string): VariantSaveResult {
  const asset = getAsset(assetId);
  const loc = getLocale(locale);
  const t = getTranslation(assetId, locale);
  if (!asset || !loc || !t) return { ok: false, problems: ["No translation to approve"] };
  const v = validateVariant(asset, loc, t.text);
  if (!v.ok) return { ok: false, problems: v.problems };
  TRANSLATIONS = TRANSLATIONS.map((x) =>
    x === t ? { ...x, status: "approved", reviewedBy: actor, updatedAt: now() } : x,
  );
  recordAudit({
    action: "Locale variant approved",
    entity: "locale-variant",
    entityId: `${assetId}:${locale}`,
    summary: `${asset.name} [${locale}] approved by ${actor}`,
    module: "marketing",
    severity: "info",
  });
  emit();
  return { ok: true, problems: [] };
}

/** Fallback chain editor (AC-2): ar → en, de → en, es → fr, … */
export function setFallback(locale: LocaleCode, fallback: LocaleCode, actor: string): boolean {
  if (locale === fallback) return false;
  const l = getLocale(locale);
  if (!l || !getLocale(fallback)) return false;
  LOCALES = LOCALES.map((x) => (x.code === locale ? { ...x, fallback } : x));
  recordAudit({
    action: "Locale fallback chain changed",
    entity: "locale",
    entityId: locale,
    summary: `${locale} fallback chain → ${fallback} (by ${actor})`,
    module: "marketing",
    severity: "info",
  });
  emit();
  return true;
}

/* ------------------------------------------------------------------ */
/* AC-2 / AC-3 — recipient locale resolution & report breakdown        */
/* ------------------------------------------------------------------ */

export interface LocaleResolution {
  /** Locale actually rendered (recipient preference, else fallback chain). */
  rendered: LocaleCode;
  /** True when the preferred locale was missing and the chain kicked in. */
  fellBack: boolean;
  preferred: LocaleCode;
}

/**
 * AC-2 — pick the locale for a send: recipient preference first, then walk
 * the fallback chain to the first locale where the asset is approved or has
 * any usable text; source (en) always resolves.
 */
export function resolveLocaleForRecipient(assetId: string, preferred: string): LocaleResolution {
  const chainWalk = (code: string, depth = 0): LocaleCode | undefined => {
    if (depth > LOCALES.length) return undefined;
    const loc = getLocale(code);
    if (!loc) return undefined;
    if (code === "en") return "en";
    const t = getTranslation(assetId, loc.code);
    if (t && t.text.trim()) return loc.code;
    return chainWalk(loc.fallback, depth + 1);
  };
  const direct = chainWalk(preferred);
  if (direct) return { rendered: direct, fellBack: direct !== preferred, preferred: preferred as LocaleCode };
  return { rendered: "en", fellBack: true, preferred: preferred as LocaleCode };
}

export interface LocaleBreakdownRow {
  locale: LocaleCode;
  sent: number;
  direct: number;
  fallback: number;
  missing: number;
}

/**
 * AC-3 — campaign report locale breakdown: sends resolved per locale with
 * how many fell back because the translation was missing at send time.
 * Dummy send history (wave-zero gateway stays a backend track).
 */
export function localeBreakdown(): LocaleBreakdownRow[] {
  const SENT: Array<[LocaleCode, number, number]> = [
    // [locale, sent, fellBack]
    ["en", 5210, 0],
    ["ar", 1480, 610],
    ["de", 1120, 45],
    ["es", 640, 210],
    ["fr", 505, 95],
    ["he", 310, 190],
  ];
  return SENT.map(([locale, sent, fallback]) => ({
    locale,
    sent,
    direct: sent - fallback,
    fallback,
    missing: fallback,
  }));
}

/* ------------------------------------------------------------------ */
/* XLIFF / CSV export-import round-trip (agency translators)           */
/* ------------------------------------------------------------------ */

/** Export selected assets × locales as XLIFF 1.2 (agency hand-off format). */
export function exportXliff(assetIds: string[], locales: LocaleCode[]): string {
  const units = ASSETS.filter((a) => assetIds.includes(a.id)).map((a) => {
    const targets = locales
      .filter((l) => l !== "en")
      .map((l) => {
        const t = getTranslation(a.id, l);
        return `      <trans-unit id="${a.id}" resname="${esc(a.name)}" xml:lang="${l}" state="${t?.status ?? "missing"}">\n        <source>${esc(a.source)}</source>\n        <target>${esc(t?.text ?? "")}</target>\n      </trans-unit>`;
      })
      .join("\n");
    return targets;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2" srcLang="en" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file product="AlphaOne" datatype="plaintext">\n${units}\n  </file>\n</xliff>\n`;
}

export interface XliffImportResult {
  ok: boolean;
  imported: number;
  /** Per-unit errors: unknown asset/locale, slot violations. */
  errors: string[];
}

/**
 * Re-import validation: parse simple `<trans-unit …><source/><target/>`
 * blocks back into the store as machine-drafts. Slot violations are refused
 * per unit (variable-slot protection survives the round-trip).
 */
export function importXliff(xml: string, actor: string): XliffImportResult {
  const errors: string[] = [];
  let imported = 0;
  const unitRe = /<trans-unit[^>]*id="([^"]+)"[^>]*xml:lang="([^"]+)"[^>]*>[\s\S]*?<source>([\s\S]*?)<\/source>[\s\S]*?<target>([\s\S]*?)<\/target>[\s\S]*?<\/trans-unit>/g;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(xml))) {
    const [, id, lang, source, target] = m;
    const asset = getAsset(id);
    const locale = getLocale(lang);
    if (!asset) { errors.push(`${id}: unknown asset`); continue; }
    if (!locale || locale.code === "en") { errors.push(`${id}: invalid locale "${lang}"`); continue; }
    if (!target.trim()) continue; // empty target = not translated yet
    const srcSlots = extractSlots(unescapeXml(source));
    const tgtSlots = extractSlots(unescapeXml(target));
    const missing = srcSlots.filter((s) => !tgtSlots.includes(s));
    if (missing.length) { errors.push(`${id} [${lang}]: slot violation — ${missing.join(", ")}`); continue; }
    const res = saveVariant(id, locale.code, unescapeXml(target), `${actor} (XLIFF import)`, "machine-draft");
    if (res.ok) imported += 1; else errors.push(`${id} [${lang}]: ${res.problems.join("; ")}`);
  }
  if (unitRe.lastIndex === 0 && !/<trans-unit/.test(xml)) errors.push("No <trans-unit> elements found — not an XLIFF file");
  if (imported) recordAudit({
    action: "XLIFF import",
    entity: "locale-variant",
    entityId: "xliff-import",
    summary: `${imported} variant(s) imported as machine-draft by ${actor}${errors.length ? `; ${errors.length} error(s)` : ""}`,
    module: "marketing",
    severity: errors.length ? "warning" : "info",
  });
  return { ok: imported > 0, imported, errors };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/* ------------------------------------------------------------------ */
/* Coverage + subscription                                             */
/* ------------------------------------------------------------------ */

export function localeCoverage(locale: LocaleCode): { approved: number; total: number; pct: number; missing: number } {
  const others = ASSETS.filter((a) => a.id); // all assets
  const total = others.length;
  const approved = others.filter((a) => cellStatus(a.id, locale) === "approved").length;
  const missing = others.filter((a) => cellStatus(a.id, locale) === "missing").length;
  return { approved, total, pct: total ? Math.round((approved / total) * 100) : 0, missing };
}

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to locale-store mutations. */
export function useLocalesVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
