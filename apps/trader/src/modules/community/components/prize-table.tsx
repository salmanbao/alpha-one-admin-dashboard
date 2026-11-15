"use client";

/**
 * Prize table — rank-ordered prize tiers inside a competition card /
 * detail page.
 *
 * Leads with rank, then an icon for the prize *kind* (cash, wallet
 * credit, physical gadget, promo credit) so the tangible prize reads as
 * different from cash at a glance. First place gets a highlighted row.
 */

import { Award, DollarSign, Smartphone, Tag, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { TerraTable, formatMoney } from "@/components/terra/terra-ui";
import type { PrizeKind, PrizeTier } from "@/lib/fixtures/terra-fixtures";

const kindIcon: Record<PrizeKind, ReactNode> = {
  cash: <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />,
  "funded-account": <Wallet className="h-3.5 w-3.5" aria-hidden="true" />,
  physical: <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />,
  "promo-credit": <Tag className="h-3.5 w-3.5" aria-hidden="true" />,
};

const kindLabel: Record<PrizeKind, string> = {
  cash: "Cash",
  "funded-account": "Funded seat",
  physical: "Physical prize",
  "promo-credit": "Promo credit",
};

function rankLabel(t: PrizeTier): string {
  return t.rankFrom === t.rankTo
    ? `#${t.rankFrom}`
    : `#${t.rankFrom}–${t.rankTo}`;
}

export function PrizeTable({ prizes }: { prizes: PrizeTier[] }) {
  const ordered = [...prizes].sort((a, b) => a.rankFrom - b.rankFrom);
  return (
    <TerraTable
      head={["Place", "Prize", "Kind", "Value"]}
      rows={ordered.map((t) => {
        const first = t.rankFrom === 1 && t.rankTo === 1;
        return [
          <span
            key="rank"
            className={`inline-flex items-center gap-1.5 font-bold tabular-nums ${
              first ? "text-primary" : "text-on-surface"
            }`}
          >
            {first && <Award className="h-3.5 w-3.5" aria-hidden="true" />}
            {rankLabel(t)}
          </span>,
          <span key="prize" className="block">
            <span className="block font-semibold">{t.label}</span>
            {t.detail && (
              <span className="block text-xs text-on-surface-variant">
                {t.detail}
              </span>
            )}
          </span>,
          <span
            key="kind"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant"
          >
            {kindIcon[t.kind]}
            {kindLabel[t.kind]}
          </span>,
          <span key="value" className="font-semibold tabular-nums">
            {t.valueUsd ? formatMoney(t.valueUsd) : "—"}
          </span>,
        ];
      })}
    />
  );
}
