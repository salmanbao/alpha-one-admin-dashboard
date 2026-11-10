"use client";

/**
 * Trading Credentials — converted from stitch_screens/trading_credentials
 * Platform login credentials with reveal/copy actions (PRD §3.7.5),
 * platform download, and wired reset / web-terminal actions.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useLifecycleLog } from "@pfaas/lifecycle";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { AccountCredentials } from "@/components/terra/account-credentials";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";
import { markJourney } from "@/lib/onboarding/journey-store";

/**
 * R3-02 — deterministic demo login for a funded account issued by the
 * firm's console (prop-admin carries no MT5 login; the event id is the
 * only shared correlation key, so the login derives from it and stays
 * stable across renders/reloads).
 */
function demoLogin(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(100000 + (h % 899999));
}

export function TradingCredentialsPage() {
  // SF-02: reaching the credentials screen is delivery in the demo —
  // it ticks "Credentialed" on the journey checklist (a real backend
  // would flip this when the delivery email lands).
  useEffect(() => {
    markJourney("credentialed");
  }, []);

  // R3-02 — the credentials moment (cross-app demo transport): when
  // prop-admin funds a challenge the store publishes `provisioning.started`
  // on the shared lifecycle log; this page renders it as just-issued
  // credentials. Matched on actor prop-admin so the trader's own purchase
  // provisioning (actor trader) never triggers it.
  const log = useLifecycleLog();
  const issued = [...log]
    .reverse()
    .find((e) => e.actor === "prop-admin" && e.name === "provisioning.started");
  const issuedSize =
    typeof issued?.payload?.accountSize === "number" ? issued.payload.accountSize : null;
  const issuedTrader =
    typeof issued?.payload?.traderName === "string" && issued.payload.traderName
      ? issued.payload.traderName
      : null;
  const issuedSeed =
    (typeof issued?.payload?.challengeId === "string" && issued.payload.challengeId) ||
    issued?.id ||
    "";

  const handleResetPassword = (login: string) => {
    toast({
      title: "Password reset requested",
      description: `A fresh investor password for #${login} will be emailed within minutes — the old password stops working immediately. (Demo — no backend call.)`,
    });
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Credentials"
        description="Login details for your trading platforms"
        actions={<TerraBadge tone="tertiary">Keep these private</TerraBadge>}
      />

      {issued && issuedSeed ? (
        <TerraCard data-testid="issued-credentials">
          <TerraSectionTitle
            title="Funded account issued"
            description={`${issuedTrader ?? "Your firm"} • ${formatMoney(issuedSize ?? 0)} • provisioned ${new Date(issued.at).toLocaleDateString()}`}
            actions={
              <TerraBadge tone="primary" dot>
                Just issued
              </TerraBadge>
            }
          />
          <p className="mb-3 text-xs text-on-surface-variant">
            Your funded account is live. These credentials were issued when the firm
            approved your challenge — copy them into MT5 to start trading.
            <span className="ml-1 rounded-md bg-surface-container px-1.5 py-0.5 font-mono text-[10px] font-semibold text-on-surface-variant">
              (demo transport)
            </span>
          </p>
          <AccountCredentials
            account={{
              login: demoLogin(issuedSeed),
              platform: "MT5",
              server: "TerraMarkets-Funded01",
            }}
          />
        </TerraCard>
      ) : null}

      {terraAccounts.map((acc) => (
        <TerraCard key={acc.id}>
          <TerraSectionTitle
            title={`${acc.name}`}
            description={`Login #${acc.login} • ${acc.platform} • ${acc.server}`}
            actions={
              <TerraBadge tone={acc.status === "active" ? "primary" : "secondary"} dot={acc.status === "active"}>
                {acc.status}
              </TerraBadge>
            }
          />
          <AccountCredentials account={acc} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleResetPassword(acc.login)}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
            >
              Reset password
            </button>
            <Link
              href="/web-terminal"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Open in Web Terminal ↗
            </Link>
          </div>
        </TerraCard>
      ))}
    </div>
  );
}
