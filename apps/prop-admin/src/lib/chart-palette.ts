/**
 * TERRA chart palette — audit finding #3 (LOW).
 *
 * Every analytics surface used to declare its own `const TERRA = {...}`
 * with the same key names but *different* hex values (rose was `#e11d48`
 * on one screen and `#dc2626` on another; emerald `#10b981` vs
 * `#059669`), so the same metric could change colour between screens
 * and chart call sites fell back to raw hex literals.
 *
 * This module is the single source of truth for chart series colours in
 * the prop-admin app. Import `TERRA` from here instead of redeclaring
 * the palette; keep the *semantic* meaning of each key stable:
 *
 *   • emerald / forest / green — positive, revenue, profitable series
 *   • amber / warning          — secondary, attention, payout series
 *   • rose / danger            — negative, breach, loss series
 *   • teal / sky               — neutral primary series
 *   • slate / muted            — de-emphasised / comparison series
 *
 * Deterministic constants only — colours must not vary per render.
 */
export const TERRA = {
  forest: "#4a7c59",
  sage: "#5a7c4a",
  cream: "#f5efe6",
  emerald: "#059669",
  green: "#16a34a",
  amber: "#f59e0b",
  warning: "#d97706",
  rose: "#e11d48",
  danger: "#e11d48",
  red: "#dc2626",
  teal: "#0d9488",
  sky: "#0d9488",
  slate: "#64748b",
  muted: "#78716c",
  /** Depth variants for multi-slice distribution donuts. */
  crimson: "#9f1239",
  pink: "#fb7185",
} as const;
