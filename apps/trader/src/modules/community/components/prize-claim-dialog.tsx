"use client";

/**
 * Prize claim dialog — the shipping form for a physical (or any) prize
 * the demo trader placed inside.
 *
 * States are honest: the 14-day claim window counts down live, an
 * expired window or an already-claimed prize renders as fact (no hidden
 * retry button), and a `shipped` status never appears in the UI (there
 * is no shipping backend — R6 rule).
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Gift, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TerraBadge } from "@/components/terra/terra-ui";
import {
  claimWindowEndsAt,
  prizeTierFor,
  type Competition,
} from "@/lib/fixtures/terra-fixtures";
import {
  claimFor,
  claimPrize,
  type PrizeClaimShipping,
} from "@/lib/competitions-store";

const emptyShipping: PrizeClaimShipping = {
  name: "",
  phone: "",
  address1: "",
  city: "",
  country: "",
};

function fieldError(v: string): string | undefined {
  return v.trim().length >= 2 ? undefined : "Required";
}

export function PrizeClaimDialog({
  competition,
  open,
  onOpenChange,
}: {
  competition: Competition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const claim = claimFor(competition.id);
  const tier = competition.placement
    ? prizeTierFor(competition, competition.placement)
    : undefined;
  const windowEndsAt = claimWindowEndsAt(competition);
  const expired = Date.now() > new Date(windowEndsAt).getTime();

  const [shipping, setShipping] = useState<PrizeClaimShipping>(emptyShipping);
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Claim-window countdown (static under prefers-reduced-motion).
  useEffect(() => {
    if (!open || claim?.status === "claimed") return;
    const tick = () => setRemaining(new Date(windowEndsAt).getTime() - Date.now());
    tick();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [open, claim?.status, windowEndsAt]);

  const errors = {
    name: fieldError(shipping.name),
    phone: fieldError(shipping.phone),
    address1: fieldError(shipping.address1),
    city: fieldError(shipping.city),
    country: fieldError(shipping.country),
  };
  const valid = Object.values(errors).every((e) => e === undefined);

  const set = (k: keyof PrizeClaimShipping) => (v: string) =>
    setShipping((s) => ({ ...s, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const result = claimPrize(competition.id, shipping);
    if (result.ok) {
      setReason(null);
      onOpenChange(false);
    } else {
      setReason(result.reason);
    }
  }

  const claimed = claim?.status === "claimed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
            {claimed ? "Prize claimed" : "Claim your prize"}
          </DialogTitle>
          <DialogDescription>
            {tier
              ? `${tier.label} for finishing #${competition.placement} in ${competition.name}.`
              : `Prize for ${competition.name}.`}
          </DialogDescription>
        </DialogHeader>

        {claimed ? (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Shipping details received
            </div>
            <p className="text-sm text-on-surface-variant">
              Your {tier?.label ?? "prize"} ships within 30 days to{" "}
              <strong className="text-on-surface">{claim.shipping?.address1}</strong>,{" "}
              {claim.shipping?.city}, {claim.shipping?.country}. We&apos;ll notify you
              here when it leaves the warehouse.
            </p>
            <TerraBadge tone="success">Claimed</TerraBadge>
          </div>
        ) : expired ? (
          <div className="space-y-2 rounded-xl bg-error-container/60 p-4 text-sm">
            <p className="font-bold text-on-error-container">
              The claim window has closed
            </p>
            <p className="text-on-error-container/90">
              Prizes must be claimed within 14 days of settlement. This window ended{" "}
              {new Date(windowEndsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                Claim window
              </span>
              <span
                role="timer"
                aria-label="Time left to claim this prize"
                className="text-xs font-bold tabular-nums text-on-surface"
              >
                {remaining !== null && remaining > 0
                  ? `${Math.floor(remaining / 86_400_000)}d ${Math.floor(
                      (remaining % 86_400_000) / 3_600_000,
                    )}h ${Math.floor((remaining % 3_600_000) / 60_000)}m`
                  : `Ends ${new Date(windowEndsAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}`}
              </span>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Shipping address
            </p>

            {(
              [
                ["name", "Full name", "Ada Lovelace"],
                ["phone", "Phone", "+1 555 0100"],
                ["address1", "Address", "1 Market Street"],
                ["city", "City", "San Francisco"],
                ["country", "Country", "United States"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block space-y-1">
                <span className="text-xs font-semibold text-on-surface-variant">
                  {label}
                </span>
                <input
                  type="text"
                  value={shipping[key]}
                  onChange={(e) => set(key)(e.target.value)}
                  placeholder={placeholder}
                  aria-invalid={submitted && errors[key] !== undefined}
                  aria-describedby={submitted && errors[key] ? `${key}-err` : undefined}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />
                {submitted && errors[key] && (
                  <span id={`${key}-err`} className="block text-xs font-semibold text-error">
                    {errors[key]}
                  </span>
                )}
              </label>
            ))}

            {reason && (
              <p className="rounded-lg bg-error-container/60 px-3 py-2 text-xs font-semibold text-on-error-container">
                {reason}
              </p>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Claim {tier?.label ?? "prize"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
