"use client";

/**
 * Web Terminal Launch — converted from stitch_screens/web_terminal_launch
 * Launch page for the browser trading terminal with credentials shortcuts.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { primaryAccount } from "@/lib/fixtures/terra-fixtures";

const platforms = [
  { name: "MT5 Web Terminal", note: "Full desktop parity in your browser", status: "ready" as const },
  { name: "cTrader Web", note: "For cTrader accounts (#92841)", status: "ready" as const },
  { name: "DXtrade", note: "Web platform for Flash accounts", status: "coming" as const },
];

export function WebTerminalPage() {
  const acc = primaryAccount;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Web Terminal"
        description="Trade directly from your browser — no downloads required"
        actions={
          <TerraBadge tone="primary" dot pulse>
            {acc.server} online
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Choose a platform" />
            <div className="space-y-3">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl border border-outline-variant/60 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{p.name}</p>
                    <p className="text-xs text-on-surface-variant">{p.note}</p>
                  </div>
                  {p.status === "ready" ? (
                    <button
                      type="button"
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
                    >
                      Launch →
                    </button>
                  ) : (
                    <TerraBadge tone="neutral">Coming soon</TerraBadge>
                  )}
                </div>
              ))}
            </div>
          </TerraCard>

          <TerraCard className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-on-surface">Prefer a native install?</p>
              <p className="text-xs text-on-surface-variant">
                Download MT5 for desktop and use the same credentials.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Download
            </button>
          </TerraCard>
        </div>

        <TerraCard className="flex flex-col gap-3">
          <TerraSectionTitle title="Quick login" />
          <div className="space-y-2 rounded-xl bg-surface-container-low p-4 text-xs">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Login</span>
              <strong className="font-mono text-on-surface">#{acc.login}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Server</span>
              <strong className="font-mono text-on-surface">{acc.server}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Platform</span>
              <strong className="text-on-surface">{acc.platform}</strong>
            </div>
          </div>
          <Link
            href="/trading-credentials"
            className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            View full credentials
          </Link>
        </TerraCard>
      </div>
    </div>
  );
}
