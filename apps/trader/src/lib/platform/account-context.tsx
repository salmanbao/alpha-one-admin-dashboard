"use client";

/**
 * Trader App — Active Trading Account Context
 *
 * A prop-firm trader holds multiple trading accounts (challenge phases,
 * funded accounts). Most trader screens (dashboard, objectives, risk,
 * statement, terminal credentials, payouts) are scoped to ONE account —
 * so the app needs a single source of truth for "which account am I
 * looking at right now".
 *
 * This context provides:
 *   • accounts            — all of the trader's accounts (terra fixtures)
 *   • activeAccountId     — persisted to localStorage (survives reloads)
 *   • activeAccount       — the resolved TerraAccount (never null)
 *   • setActiveAccountId  — switch + persist (validated against `accounts`)
 *
 * Consumers: <AccountSwitcher /> (header + dashboard selector), and every
 * account-scoped page. Pages that support deep links (?id=acc-…) should
 * call `useSyncActiveAccount(id)` so URL links and the global switcher
 * stay in agreement.
 *
 * SSR: defaults to `primaryAccount` (acc-100030); the stored preference
 * is applied after mount to avoid hydration mismatch.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  primaryAccount,
  terraAccounts,
  type TerraAccount,
} from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "terra.active-account";

interface AccountContextValue {
  accounts: TerraAccount[];
  activeAccountId: string;
  activeAccount: TerraAccount;
  setActiveAccountId: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function isValidId(id: string | null | undefined): id is string {
  return Boolean(id) && terraAccounts.some((a) => a.id === id);
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [activeAccountId, setActiveId] = useState<string>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isValidId(stored) ? stored : primaryAccount.id;
    } catch {
      return primaryAccount.id;
    }
  });

  const setActiveAccountId = useCallback((id: string) => {
    if (!isValidId(id)) return;
    setActiveId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AccountContextValue>(() => {
    const activeAccount =
      terraAccounts.find((a) => a.id === activeAccountId) ?? primaryAccount;
    return {
      accounts: terraAccounts,
      activeAccountId: activeAccount.id,
      activeAccount,
      setActiveAccountId,
    };
  }, [activeAccountId, setActiveAccountId]);

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

/**
 * Access the active trading account. Must be used under <AccountProvider>.
 * Throws when missing — that is a wiring bug, not a runtime condition.
 */
export function useActiveAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error(
      "useActiveAccount must be used within <AccountProvider> (see components/platform/providers.tsx)",
    );
  }
  return ctx;
}

/**
 * Deep-link sync helper for account-scoped pages reached via `?id=…`
 * (e.g. My Accounts → "View Account").
 *
 * • No param        → the globally active account is used.
 * • Valid param     → the global account is switched to match the URL,
 *                     so the header switcher and the page agree.
 * • Unknown param   → falls back to the active account.
 *
 * Returns the account to render. The switch happens in an effect
 * (never during render).
 */
export function useSyncActiveAccount(paramId: string | null): TerraAccount {
  const { activeAccount, activeAccountId, setActiveAccountId } =
    useActiveAccount();

  const paramIsValid = isValidId(paramId);
  const desiredId = paramIsValid ? paramId! : activeAccountId;

  useEffect(() => {
    if (paramIsValid && paramId !== activeAccountId) {
      setActiveAccountId(paramId!);
    }
  }, [paramIsValid, paramId, activeAccountId, setActiveAccountId]);

  if (!paramIsValid) return activeAccount;
  return terraAccounts.find((a) => a.id === desiredId) ?? activeAccount;
}
