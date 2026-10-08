"use client";

/**
 * Support — converted from stitch_screens/support
 * Ticket list with status badges and new-ticket CTA.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { supportTickets } from "@/lib/fixtures/terra-fixtures";

const statusTone = {
  open: "primary",
  answered: "tertiary",
  closed: "neutral",
} as const;

const priorityTone = {
  high: "error",
  normal: "secondary",
  low: "neutral",
} as const;

export function SupportPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Support"
        description="We typically respond within 4 hours"
        actions={
          <>
            <Link
              href="/help-center"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Help Center
            </Link>
            <Link
              href="/ticket-detail"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + New ticket
            </Link>
          </>
        }
      />

      <div className="space-y-3">
        {supportTickets.map((t) => (
          <Link key={t.id} href={`/ticket-detail?id=${t.id}`}>
            <TerraCard className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-on-surface-variant">
                    #{t.id.replace("tk-", "")}
                  </span>
                  <p className="text-sm font-bold text-on-surface">{t.subject}</p>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {t.category} • Updated{" "}
                  {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TerraBadge tone={priorityTone[t.priority]}>{t.priority}</TerraBadge>
                <TerraBadge tone={statusTone[t.status]} dot={t.status === "open"}>
                  {t.status}
                </TerraBadge>
              </div>
            </TerraCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
