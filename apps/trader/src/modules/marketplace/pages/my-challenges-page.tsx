"use client";

/**
 * My Challenges — converted from stitch_screens/my_challenges
 * Overview of active and completed challenges with progress.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraStat,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";

const completed = [
  { id: "ch-starter-25k-old", name: "Terra Starter $25K", result: "Passed", date: "2026-05-18" },
  { id: "ch-pro-50k-old", name: "Terra Pro $50K", result: "Breached", date: "2026-04-22" },
];

export function MyChallengesPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="My Challenges"
        description={`${terraAccounts.length} active • ${completed.length} completed`}
        actions={
          <Link
            href="/marketplace"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Challenge
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {terraAccounts.map((acc) => (
          <TerraCard key={acc.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-on-surface-variant">
                #{acc.login}
              </span>
              <TerraBadge tone={acc.status === "active" ? "primary" : "secondary"} dot={acc.status === "active"}>
                {acc.phase}
              </TerraBadge>
            </div>
            <div>
              <h2 className="font-headline font-bold text-on-surface">{acc.name}</h2>
              <p className="text-xs text-on-surface-variant">
                Balance {formatMoney(acc.balance)} • P&L +
                {formatMoney(acc.pnl)}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-on-surface">Profit target</span>
                <span className="text-on-surface-variant">{acc.targetProgress}%</span>
              </div>
              <TerraProgress value={acc.targetProgress} />
            </div>
            <Link
              href="/account-detail"
              className="mt-auto rounded-xl bg-surface-container-low py-2 text-center text-xs font-bold text-on-surface hover:bg-surface-container"
            >
              View challenge →
            </Link>
          </TerraCard>
        ))}
      </div>

      <TerraCard>
        <h2 className="pb-3 font-headline text-lg font-bold text-on-surface">Completed</h2>
        <div className="space-y-2">
          {completed.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3"
            >
              <div>
                <p className="text-sm font-bold text-on-surface">{c.name}</p>
                <p className="text-xs text-on-surface-variant">{c.date}</p>
              </div>
              <TerraBadge tone={c.result === "Passed" ? "success" : "error"}>{c.result}</TerraBadge>
            </div>
          ))}
        </div>
      </TerraCard>
    </div>
  );
}
