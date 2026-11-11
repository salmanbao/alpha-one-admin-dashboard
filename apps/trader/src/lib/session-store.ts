/**
 * session-store.ts — Demo session + identity spine for the trader app.
 *
 * R4-01 — login validates against this store and writes the active session.
 * Signup stores the registered account here so login can authenticate.
 * "Continue as demo" yields the Tom Allen persona, honestly labeled.
 *
 * Storage keys follow the pfaas:<app>:<name> convention.
 */

import type { AuthUser } from "@pfaas/platform-core";

export interface TraderAccount {
  id: string;
  email: string;
  displayName: string;
  password: string; // demo plaintext, no hashing
  createdAt: string;
}

export interface ActiveSession {
  accountId: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  loginAt: string;
}

const ACCOUNTS_KEY = "pfaas:trader:sessionAccounts";
const SESSION_KEY = "pfaas:trader:session";

/** Demo fallback — the Tom Allen persona (honestly labeled as demo). */
export const DEMO_ACCOUNT: TraderAccount = {
  id: "demo-trader",
  email: "tom.allen@terra.trader",
  displayName: "Tom Allen",
  password: "demo123",
  createdAt: new Date().toISOString(),
};

export function readSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}

export function writeSession(session: ActiveSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* best effort */
  }
}

export function removeSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* best effort */
  }
}

export function continueAsDemo(): ActiveSession {
  const session: ActiveSession = {
    accountId: DEMO_ACCOUNT.id,
    email: DEMO_ACCOUNT.email,
    displayName: DEMO_ACCOUNT.displayName,
    isDemo: true,
    loginAt: new Date().toISOString(),
  };
  writeSession(session);
  return session;
}

export function registerAccount(
  account: Omit<TraderAccount, "id" | "createdAt">
): TraderAccount {
  const newAccount: TraderAccount = {
    ...account,
    id: `acc-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };

  const accounts = readAccounts();
  accounts.push(newAccount);
  writeAccounts(accounts);
  return newAccount;
}

export function readAccounts(): TraderAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TraderAccount[];
  } catch {
    return [];
  }
}

export function writeAccounts(accounts: TraderAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* best effort */
  }
}

export function findAccountByEmail(email: string): TraderAccount | null {
  return readAccounts().find((a) => a.email === email) ?? null;
}

export function verifyPassword(
  plainPassword: string,
  storedPassword: string
): boolean {
  // Demo: simple equality check
  return plainPassword === storedPassword;
}

/** Get the current user identity for the shell (session > demo > null). */
export function getCurrentIdentity(): AuthUser | null {
  const session = readSession();
  if (!session) return null;
  return {
    id: session.accountId,
    tenantId: "tenant-terra",
    email: session.email,
    name: session.displayName,
    initials: session.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    application: "trader",
    roles: ["trader"],
    permissions: ["trader.self"],
    traderId: `trader-${session.accountId}`,
    lastActiveAt: session.loginAt,
  };
}

/** Get the default KYC identity, preferring session data over demo fallback. */
export function getDefaultKycIdentity(): {
  fullName: string;
  dob: string;
  country: string;
  phone: string;
  address: string;
  postalCode: string;
} {
  const session = readSession();
  if (session && !session.isDemo) {
    return {
      fullName: session.displayName,
      dob: "",
      country: "",
      phone: "",
      address: "",
      postalCode: "",
    };
  }
  // Demo fallback
  return {
    fullName: "Tom Allen",
    dob: "1990-04-12",
    country: "United States",
    phone: "+1 (415) 555-0142",
    address: "123 Market St, San Francisco",
    postalCode: "94103",
  };
}