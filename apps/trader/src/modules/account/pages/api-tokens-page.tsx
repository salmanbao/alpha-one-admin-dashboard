"use client";

/**
 * API Tokens — converted from stitch_screens/api_tokens
 * Personal access tokens with scopes and create dialog.
 */

import { useState } from "react";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { apiTokens } from "@/lib/fixtures/terra-fixtures";

export function ApiTokensPage() {
  const [tokens, setTokens] = useState(apiTokens);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revokedId, setRevokedId] = useState<string | null>(null);
  // Two-step confirm for revoke (audit #3 fix #8) — matches the
  // withdrawal-methods page pattern so destructive actions are consistent.
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const generated = `tr_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    setNewToken(generated);
    setCreating(false);
    setNewName("");
  };

  const handleRevoke = (id: string) => {
    setTokens((ts) => ts.filter((t) => t.id !== id));
    setRevokedId(id);
    setPendingRevokeId(null);
    setTimeout(() => setRevokedId(null), 3000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="API Tokens"
        description="Programmatic access to your TerraTrader data"
        actions={
          <button
            type="button"
            onClick={() => { setCreating(true); setNewToken(null); }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + Create token
          </button>
        }
      />

      {newToken && (
        <TerraCard className="border-primary">
          <p className="text-sm font-bold text-on-surface">✓ Token created — copy it now, it won&apos;t be shown again:</p>
          <p className="mt-2 rounded-lg bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface">{newToken}</p>
        </TerraCard>
      )}

      {revokedId && (
        <div className="rounded-xl bg-error-container/50 px-4 py-3 text-sm font-semibold text-on-error-container">
          ✓ Token revoked successfully
        </div>
      )}

      {creating && (
        <TerraCard className="border-primary">
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Token name
              </span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Trading bot, Analytics integration"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Generate Token
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        </TerraCard>
      )}

      <TerraCard>
        <TerraSectionTitle title="Active tokens" />
        <div className="space-y-3">
          {tokens.length === 0 && (
            <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
              No active tokens — create one to get started.
            </p>
          )}
          {tokens.map((t) => (
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
              {pendingRevokeId === t.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRevoke(t.id)}
                    className="rounded-xl bg-error px-3 py-1.5 text-xs font-semibold text-on-error hover:bg-error/90"
                  >
                    Confirm revoke?
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRevokeId(null)}
                    className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingRevokeId(t.id)}
                  className="rounded-xl bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container hover:bg-error-container/80"
                >
                  Revoke
                </button>
              )}
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
