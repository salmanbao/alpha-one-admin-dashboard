"use client";

/**
 * PFaaS Platform — Multi-Currency Conversion
 *
 * Spec section 51 (server state), §10 (tenant currency). Provides
 * client-side currency conversion with static exchange rates for
 * the demo. In production this would fetch live rates from an API.
 */

export interface ExchangeRate {
  code: string;
  symbol: string;
  name: string;
  /** Rate relative to USD (1 USD = rate * this currency) */
  rate: number;
}

/**
 * Snapshot date of the static demo rate table below. Rates are a fixed
 * fixture, so the table MUST carry an as-of date: converted amounts are
 * only meaningful relative to that date, and a production deployment
 * would fetch live rates with the provider's own timestamp.
 *
 * Deliberately backdated (>FX_RATES_MAX_AGE_DAYS before "today") so the
 * demo renders the stale-rates warning — the affordance exists to be
 * seen, not to sit dead behind a threshold no fixture crosses.
 */
export const FX_RATES_AS_OF = "2026-09-01";

/** How stale the rate table is allowed to be before the UI should flag it. */
export const FX_RATES_MAX_AGE_DAYS = 30;

export const CURRENCIES: ExchangeRate[] = [
  { code: "USD", symbol: "$", name: "US Dollar", rate: 1 },
  { code: "EUR", symbol: "€", name: "Euro", rate: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", rate: 0.79 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rate: 3.67 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", rate: 151.4 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", rate: 1.52 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", rate: 1.36 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", rate: 0.88 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", rate: 1.35 },
  { code: "BTC", symbol: "₿", name: "Bitcoin", rate: 0.0000149 },
];

const RATE_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

/**
 * Convert an amount from one currency to another via USD as the base.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
): number {
  const fromRate = RATE_MAP.get(from)?.rate ?? 1;
  const toRate = RATE_MAP.get(to)?.rate ?? 1;
  // amount in USD = amount / fromRate, then to target = * toRate
  const usd = amount / fromRate;
  return usd * toRate;
}

/**
 * Format a converted amount with the target currency symbol.
 */
export function formatConverted(
  amount: number,
  from: string,
  to: string,
): string {
  const converted = convertCurrency(amount, from, to);
  const target = RATE_MAP.get(to);
  const symbol = target?.symbol ?? "";
  const decimals = to === "JPY" || to === "BTC" ? (converted < 1 ? 6 : 0) : 2;
  return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Get the exchange rate display string (e.g. "1 USD = 0.79 GBP").
 * Includes the as-of date — a converted amount without a rate date is
 * not auditable (gap analysis §: FX provenance).
 */
export function getRateLabel(from: string, to: string): string {
  const rate = convertCurrency(1, from, to);
  const toCurrency = RATE_MAP.get(to);
  const symbol = toCurrency?.symbol ?? "";
  return `1 ${from} = ${symbol}${rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to} · as of ${FX_RATES_AS_OF}`;
}

/** Age of the static rate table in whole days (0 for same-day). */
export function fxRatesAgeDays(now: Date = new Date()): number {
  const asOf = new Date(`${FX_RATES_AS_OF}T00:00:00Z`).getTime();
  if (!Number.isFinite(asOf)) return 0;
  return Math.max(0, Math.floor((now.getTime() - asOf) / 86_400_000));
}

/**
 * True when the rate table is older than FX_RATES_MAX_AGE_DAYS — the
 * analytics conversion banner surfaces this so operators don't treat
 * stale conversions as live market values.
 */
export function fxRatesStale(now: Date = new Date()): boolean {
  return fxRatesAgeDays(now) > FX_RATES_MAX_AGE_DAYS;
}
