"use client";

/**
 * PFaaS Platform — Demo / data-provenance markers
 *
 * Gap-analysis Phase 0 + P0 4.3: "Mark each surface as mock… Do not let
 * demo data look like current production facts" and "Visible freshness
 * and source-of-truth indicators on balances, positions, prices."
 *
 * The prop-admin / platform-admin / trader apps are frontend prototypes
 * backed by deterministic mock fixtures (no broker, payment, or KYC
 * backend is wired). These components make that provenance explicit so an
 * operator never mistakes simulated figures for live production facts.
 *
 * Two primitives:
 *  • DemoDataBanner — persistent, slim environment banner for the app
 *    shell. States once, globally, that the environment is a demo.
 *  • DemoDataStamp  — inline freshness / source-of-truth marker that data
 *    surfaces drop next to balances, tables, and prices.
 *
 * Both reuse the shared Badge/Button vocabulary (UX Constitution §38, §76).
 */

import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/* ──────────────────────────────────────────────────────────────── */
/* Banner — global environment provenance                           */
/* ──────────────────────────────────────────────────────────────── */

/**
 * Persistent one-line banner stating the environment is a demo and its
 * data is simulated. Sits above page content (mirrors the impersonation
 * banner pattern in the app shell). Not dismissible — provenance should
 * not be hideable, per the gap-analysis requirement that demo data must
 * never read as production fact.
 */
export function DemoDataBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-teal-500/10 px-4 py-1.5 text-xs text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 md:px-6",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Demo environment
      </span>
      <span className="font-normal opacity-80">
        · Traders, balances, positions, payouts and risk figures are
        simulated fixtures. No live broker, payment or KYC system is connected.
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Stamp — inline freshness / source-of-truth marker                */
/* ──────────────────────────────────────────────────────────────── */

/**
 * Inline provenance marker for a data surface. Use next to balances,
 * prices, positions, payouts — anywhere simulated figures could be
 * mistaken for live data.
 *
 * @param asOf  Optional ISO timestamp for a "last refreshed" freshness
 *              readout. When omitted the stamp simply marks the surface
 *              as demo data without implying a refresh time.
 * @param label Override the primary label (e.g. "Simulated", "Demo data").
 */
export function DemoDataStamp({
  asOf,
  label = "Demo data",
  className,
}: {
  asOf?: string;
  label?: string;
  className?: string;
}) {
  const freshness = asOf ? formatFreshness(asOf) : undefined;
  return (
    <Badge
      variant="outline"
      role="status"
      title={
        freshness
          ? `Simulated data — last refreshed ${freshness}`
          : "Simulated demo data, not a live production figure"
      }
      className={cn(
        "gap-1 border-teal-500/30 bg-teal-500/10 px-1.5 py-0 text-[10px] font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
      {label}
      {freshness ? <span className="opacity-70">· {freshness}</span> : null}
    </Badge>
  );
}

/** Compact relative freshness readout ("2m ago", "just now"). */
function formatFreshness(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
