/**
 * Shared wizard vocabulary — reporting timezones + shell locales
 * (go-live report, P2-a; create-tenant report, P2-9).
 *
 * Both onboarding wizards used to keep their own timezone list (5
 * entries here, 18 in Create Tenant) and their own locale list, so the
 * same operator picking "Asia/Dubai" on one wizard could not pick it on
 * the other — and a locale added to one never reached the other. This
 * module is the single source: both wizards import from here, matching
 * how `lib/platform/currency.ts` already owns the currency list and
 * `lib/platform/regions.ts` owns the residency pins.
 */

/** Reporting timezones offered at create / go-live. */
export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** Tenant shell locales — `TenantContext.locale`. */
export const LOCALES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "de-DE", label: "German" },
  { id: "fr-FR", label: "French" },
  { id: "es-ES", label: "Spanish" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "ar-AE", label: "Arabic" },
  { id: "tr-TR", label: "Turkish" },
  { id: "ja-JP", label: "Japanese" },
];
