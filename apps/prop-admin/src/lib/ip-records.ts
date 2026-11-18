"use client";

/**
 * Shared IP address records — extracted from account-ip-addresses-page
 * (R9 W4) so the collusion workbench can derive IP-overlap signals from
 * the same deterministic data the IP log shows.
 *
 * The IP generation is unchanged (deterministic per-account IPv4 with
 * proxy/hosting/mobile tri-state). One fixture addition: accounts
 * `acct-tenant-alpha-1` and `acct-tenant-alpha-2` share the same IP
 * `203.0.113.42` — a demo collusion pair with IP + method-reuse +
 * mirrored-fill signals, so the correlation workbench can show a real
 * multi-signal escalation path.
 */

import {
  getTenantAccounts,
  getTenantTraders,
  type TradingAccount,
} from "@/lib/platform/mock-data";

export type TriState = "unknown" | "yes" | "no";

export interface IpRecord {
  id: string;
  tenantId: string;
  accountId: string;
  accountLogin: string;
  traderId: string;
  traderName: string;
  status: TradingAccount["status"];
  phase: TradingAccount["phase"];
  challenge: string;
  ipAddress: string;
  city: string;
  country: string;
  isProxy: TriState;
  isHosting: TriState;
  isMobile: TriState;
  createdAt: string;
  latitude: number;
  longitude: number;
}

/** City/country lookup for trader country codes (deterministic). */
const COUNTRY_INFO: Record<string, { city: string; country: string }> = {
  US: { city: "New York", country: "United States" },
  GB: { city: "London", country: "United Kingdom" },
  AE: { city: "Dubai", country: "United Arab Emirates" },
  SG: { city: "Singapore", country: "Singapore" },
  DE: { city: "Frankfurt", country: "Germany" },
  FR: { city: "Paris", country: "France" },
  BR: { city: "São Paulo", country: "Brazil" },
  IN: { city: "Mumbai", country: "India" },
  ZA: { city: "Johannesburg", country: "South Africa" },
  CA: { city: "Toronto", country: "Canada" },
  AU: { city: "Sydney", country: "Australia" },
  JP: { city: "Tokyo", country: "Japan" },
  PK: { city: "Karachi", country: "Pakistan" },
  NG: { city: "Lagos", country: "Nigeria" },
};

const CHALLENGE_NAMES = [
  "2 step Gen Z",
  "1 step Turbo",
  "Instant Standard",
  "3 step Pro",
  "Instant Funded",
  "Free Trial",
  "Competition",
];

function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Fixture: accounts that share the same IP for demo purposes.
 * `acct-tenant-alpha-1` and `acct-tenant-alpha-2` both show
 * `203.0.113.42` — the IP-overlap signal for the collusion workbench.
 */
const FIXTURE_SHARED_IPS: Record<string, string> = {
  "acct-tenant-alpha-1": "203.0.113.42",
  "acct-tenant-alpha-2": "203.0.113.42",
};

/** Build a deterministic IP record list from tenant accounts. */
export function buildIpRecords(tenantId: string): IpRecord[] {
  const accounts = getTenantAccounts(tenantId);
  const traders = getTenantTraders(tenantId);
  const traderById = new Map(traders.map((t) => [t.id, t]));
  const now = Date.now();

  return accounts.map((acct, idx) => {
    const trader = traderById.get(acct.traderId);
    const countryCode = trader?.country ?? "US";
    const countryInfo = COUNTRY_INFO[countryCode] ?? COUNTRY_INFO.US;
    // Fixture override: shared IP for collusion demo pair
    const fixtureIp = FIXTURE_SHARED_IPS[acct.id];
    // Deterministic IPv4: 192.168.(idx % 200).(idx % 255)
    const octet3 = (idx * 7 + 11) % 200;
    const octet4 = (idx * 13 + 23) % 255;
    const ip = fixtureIp
      ? fixtureIp
      : idx % 5 === 0
      ? `203.0.${113 + (idx % 50)}.${(idx * 17 + 5) % 255}` // a hosting-looking IP for variety
      : `192.168.${octet3}.${octet4}`;

    // Tri-state for proxy / hosting / mobile — deterministic
    const seed = hashStr(`${acct.id}-${ip}`);
    const isProxy: TriState = seed % 7 === 0 ? "yes" : seed % 11 === 0 ? "unknown" : "no";
    const isHosting: TriState = idx % 5 === 0 ? "yes" : idx % 9 === 0 ? "unknown" : "no";
    const isMobile: TriState = idx % 6 === 4 ? "yes" : idx % 13 === 0 ? "unknown" : "no";

    const challenge = CHALLENGE_NAMES[idx % CHALLENGE_NAMES.length];
    const createdAtMs = now - ((idx % 30) + 1) * 24 * 60 * 60 * 1000 - (idx % 7) * 60 * 60 * 1000;
    const latitude = 30 + (seed % 30);
    const longitude = -120 + (seed % 240);

    return {
      id: `ip-${acct.id}-1`,
      tenantId,
      accountId: acct.id,
      accountLogin: acct.login,
      traderId: acct.traderId,
      traderName: acct.traderName,
      status: acct.status,
      phase: acct.phase,
      challenge,
      ipAddress: ip,
      city: countryInfo.city,
      country: countryInfo.country,
      isProxy,
      isHosting,
      isMobile,
      createdAt: new Date(createdAtMs).toISOString(),
      latitude,
      longitude,
    };
  });
}