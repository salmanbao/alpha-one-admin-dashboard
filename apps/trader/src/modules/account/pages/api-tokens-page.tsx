"use client";

/**
 * API Tokens — converted from stitch_screens/api_tokens
 * Personal access tokens with scopes and create dialog.
 */

import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { apiTokens } from "@/lib/fixtures/terra-fixtures";

export function ApiTokensPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="API Tokens"
        description="Programmatic access to your TerraTrader data"
        actions={
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + Create token
          </button>
        }
      />

      <TerraCard>
        <TerraSectionTitle title="Active tokens" />
        <div className="space-y-3">
          {apiTokens.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-on-surface">{t.name}</p>
                  <TerraBadge tone="success">Active</TerraBadge>
                </div>
                <p className="font-mono text-xs text-on-surface-variant">{t.prefix}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {t.scopes.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Created {t.createdAt.slice(0, 10)} • Last used {t.lastUsedAt.slice(0, 10)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container hover:bg-error-container/80"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </TerraCard>

      <TerraCard className="bg-surface-container-low/60">
        <p className="text-sm text-on-surface-variant">
          Tokens inherit only the scopes you select and can be revoked at any time. Never commit a
          live token to source control.
        </p>
      </TerraCard>
    </div>
  );
}
