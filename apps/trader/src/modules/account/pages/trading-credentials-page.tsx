"use client";

/**
 * Trading Credentials — converted from stitch_screens/trading_credentials
 * Platform login credentials with reveal/copy actions (PRD §3.7.5),
 * platform download, and wired reset / web-terminal actions.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { AccountCredentials } from "@/components/terra/account-credentials";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";

export function TradingCredentialsPage() {
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
              className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Open in Web Terminal
            </Link>
          </div>
        </TerraCard>
      ))}
    </div>
  );
}
