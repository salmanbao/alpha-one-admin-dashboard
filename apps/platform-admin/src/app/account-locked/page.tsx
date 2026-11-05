import { AccountLockedPage } from "@/modules/auth/account-locked-page";

/**
 * Account locked / suspended route (audit D #4) — the restricted-operator
 * state for the platform console. Reachable directly, and rendered by
 * ConsoleLogin when the restricted demo account signs in.
 */
export default function Page() {
  return (
    <div className="py-6">
      <AccountLockedPage />
    </div>
  );
}
