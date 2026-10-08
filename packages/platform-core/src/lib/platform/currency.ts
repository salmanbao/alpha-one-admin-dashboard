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
 */
export function getRateLabel(from: string, to: string): string {
  const rate = convertCurrency(1, from, to);
  const toCurrency = RATE_MAP.get(to);
  const symbol = toCurrency?.symbol ?? "";
  return `1 ${from} = ${symbol}${rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to}`;
}
