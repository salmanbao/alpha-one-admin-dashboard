"use client";

/**
 * Trading Credentials — converted from stitch_screens/trading_credentials
 * Platform login credentials with reveal/copy actions.
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
      <div>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="font-mono text-sm font-bold text-on-surface">
          {shown ? value : "••••••••••"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
        >
          {shown ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
          className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

export function TradingCredentialsPage() {
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
          <div className="space-y-2">
            <CredentialRow label="Login" value={acc.login} />
            <CredentialRow label="Password (investor)" value={`Tt-${acc.login}-9fX2`} />
            <CredentialRow label="Server" value={acc.server} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
            >
              Reset password
            </button>
            <button
              type="button"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Open in Web Terminal
            </button>
          </div>
        </TerraCard>
      ))}
    </div>
  );
}
