"use client";

/**
 * PFaaS Platform — Financial Display Formatting
 *
 * Audit fix #9: money, percent and trading-day values were formatted
 * with ad-hoc `toFixed` / `toLocaleString` / `$${(v/1000)}k` code in
 * each app, so the same number rendered differently between screens
 * (and rounding drifted). These helpers are the canonical form used by
 * every app's performance/analytics surfaces.
 *
 * Pure functions, no React — safe to import anywhere.
 */

/** Canonical money display — 2 decimals, locale-stable. */
export function formatCurrencyValue(
  amount: number,
  currency = "USD",
  opts?: { decimals?: number },
): string {
  const decimals = opts?.decimals ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Signed money for P&L rows — "+" / "−" (U+2212, not a hyphen). */
export function formatSignedCurrencyValue(amount: number, currency = "USD"): string {
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}${formatCurrencyValue(Math.abs(amount), currency)}`;
}

/** Compact money for chart axes — $12k / $3.4M / $850. */
export function formatCompactCurrencyValue(amount: number, currency = "USD"): string {
  const abs = Math.abs(amount);
  const symbol =
    currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : "$";
  if (abs >= 1_000_000) return `${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(abs / 1_000).toFixed(0)}k`;
  return `${symbol}${abs.toFixed(0)}`;
}

/** Percent display — `value` is already in percent units (12.5 → "12.5%"). */
export function formatPercentValue(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Profit factor with the zero-guard the screens kept re-implementing:
 * grossLoss === 0 renders an em dash, never Infinity.
 */
export function formatProfitFactor(grossWin: number, grossLoss: number): string {
  if (grossLoss <= 0) return "—";
  return (grossWin / grossLoss).toFixed(2);
}

/**
 * Trading-day label in the program's session timezone.
 *
 * Prop-firm days roll over at the session close (default 5pm America/
 * New_York), so a trade opened at 21:00 UTC belongs to the *previous*
 * New York calendar day. Pass the session close hour to bucket an
 * instant correctly before labelling.
 */
export function tradingDayKey(
  iso: string | number | Date,
  sessionCloseHourUtc = 22, // 5pm America/New_York in winter (EST)
): string {
  const d = new Date(iso);
  // Shift back to the prior session day before taking the date part.
  const shifted = new Date(d.getTime() - sessionCloseHourUtc * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

/** Human label for a trading-day key — "Mon, Oct 27" in the session TZ. */
export function formatTradingDay(
  iso: string | number | Date,
  timeZone = "America/New_York",
): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
}
