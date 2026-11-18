"use client";

/**
 * Payout SLA chip — R9 W2 UC-T4.
 *
 * Live countdown per in-flight payout ("Promised within 48h — 6h 12m
 * left") and the honest late state ("Overdue — breached 3h ago") once
 * the promise passes. Paid rows show the post-mortem ("Paid within
 * promise" / "Paid 1d late"); rejected and cancelled rows never moved
 * money, so they render nothing.
 *
 * Pattern mirrors `competition-countdown`: 1s interval tick that is
 * skipped entirely under `prefers-reduced-motion: reduce` (static
 * "Promised by …" string instead — a11y requirement). The `Date.now()`
 * calls are guarded behind the client-mounted `now` state so there is
 * no SSR / client hydration mismatch.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TerraBadge } from "@/components/terra/terra-ui";
import type { TerraTone } from "@/components/terra/terra-ui";

export type PayoutSlaChipProps = {
  requestedAt: string;
  promisedBy: string;
  status: "submitted" | "processing" | "paid" | "rejected" | "cancelled";
  paidAt?: string | null;
  className?: string;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "6h 12m" / "2d 6h" — coarse on purpose (seconds add anxiety, not info). */
function untilLabel(msLeft: number): string {
  const totalMin = Math.max(0, Math.floor(msLeft / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Promise window label — "48h" for the standard horizon, "4d" when longer. */
function windowLabel(requestedAt: string, promisedBy: string): string {
  const ms = new Date(promisedBy).getTime() - new Date(requestedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "on schedule";
  const h = Math.round(ms / 3_600_000);
  return h >= 48 && h % 24 === 0 ? `${h / 24}d` : `${h}h`;
}

function staticWhenLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function PayoutSlaChip({
  requestedAt,
  promisedBy,
  status,
  paidAt,
  className,
}: PayoutSlaChipProps) {
  const [now, setNow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  // Reduced-motion: no ticking at all (static string, no 1s re-render).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const terminal = status === "paid" || status === "rejected" || status === "cancelled";
  useEffect(() => {
    if (reduced || terminal) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [reduced, terminal]);

  if (status === "rejected" || status === "cancelled") return null;

  const promisedMs = new Date(promisedBy).getTime();
  const requestedMs = new Date(requestedAt).getTime();
  if (!Number.isFinite(promisedMs)) return null;

  // Paid — the post-mortem (honest either way).
  if (status === "paid") {
    const paidMs = paidAt ? new Date(paidAt).getTime() : NaN;
    const late = Number.isFinite(paidMs) && paidMs > promisedMs;
    const lateBy = late ? untilLabel(paidMs - promisedMs) : null;
    return (
      <TerraBadge
        tone={late ? "secondary" : "success"}
        className={cn("ml-2 align-middle", className)}
      >
        {late ? `Paid ${lateBy} late` : "Paid within promise"}
      </TerraBadge>
    );
  }

  // RENDER PATH 1 — before first tick (now is null on initial SSR mount).
  // No Date.now() is called here; the static label avoids hydration mismatch.
  if (now === null) {
    const win = windowLabel(requestedAt, promisedBy);
    return (
      <TerraBadge tone="tertiary" className={cn("ml-2 align-middle", className)}>
        {reduced
          ? `Promised by ${staticWhenLabel(promisedBy)}`
          : `Promised within ${win}`}
      </TerraBadge>
    );
  }

  // RENDER PATH 2 — client-mounted, now has a live timestamp.
  const reference = now!;
  const breached = reference > promisedMs;
  const left = promisedMs - reference;
  const win = windowLabel(requestedAt, promisedBy);

  if (breached) {
    const ago = untilLabel(reference - promisedMs);
    return (
      <TerraBadge tone="error" className={cn("ml-2 align-middle", className)}>
        {reduced
          ? `Overdue since ${staticWhenLabel(promisedBy)}`
          : `Overdue — breached ${ago} ago`}
      </TerraBadge>
    );
  }

  return (
    <TerraBadge tone="tertiary" className={cn("ml-2 align-middle", className)}>
      {reduced
        ? `Promised by ${staticWhenLabel(promisedBy)}`
        : `Promised within ${win} — ${untilLabel(left)} left`}
      <span className="sr-only">
        {" "}
        ({pad(Math.floor(left / 3_600_000))}h {pad(Math.floor((left % 3_600_000) / 60_000))}m remaining)
      </span>
    </TerraBadge>
  );
}