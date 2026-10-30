"use client";

/**
 * PFaaS Platform — Payout Reject Dialog
 *
 * The single standardized rejection flow for every payout surface
 * (audit fix #3, HIGH): table rows, dashboard queue widget, batch
 * toolbar and the contextual action panel previously rejected with
 * three different levels of rigor — some with a free-text box, some
 * with no reason at all.
 *
 * Every reject now goes through this dialog:
 *   1. structured reason — a preset category (dropdown) so rejections
 *      are reportable, plus a required free-text detail so the trader
 *      and the audit trail get a specific explanation;
 *   2. optional internal comment for the review record;
 *   3. notify-trader checkbox (on by default) — controls whether the
 *      reason reaches the trader's inbox.
 *
 * Usage (controlled):
 *   const [reject, setReject] = useState<{...} | null>(null);
 *   <PayoutRejectDialog
 *     target={reject}
 *     onOpenChange={(o) => !o && setReject(null)}
 *     onConfirm={({ reason, comment, notifyTrader }) => { ... }}
 *   />
 */

import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

/** What is being rejected — one payout, or a batch of them. */
export type PayoutRejectTarget = {
  /** Payout reference (single) or first reference (batch). */
  reference: string;
  traderName: string;
  amount: number;
  currency: string;
  /** Number of payouts in the reject batch (1 = single row). */
  count?: number;
};

/** Preset rejection categories — reportable + consistent across surfaces. */
export const payoutRejectReasons = [
  "Account breached a trading rule during the payout window",
  "Daily loss limit exceeded before the payout date",
  "Maximum drawdown breached during the payout period",
  "Minimum trading days not met",
  "Consistency rule not satisfied",
  "KYC / identity verification incomplete",
  "Withdrawal method not verified or mismatched",
  "Duplicate or fraudulent payout request",
  "Other (describe below)",
] as const;

export type PayoutRejectResult = {
  /** Full reason string: category + detail (+ internal comment). */
  reason: string;
  category: string;
  detail: string;
  comment: string;
  notifyTrader: boolean;
};

/**
 * Build the audit-trail reason string from the dialog's inputs.
 * Kept here so every surface records the reason in the same shape.
 */
export function formatPayoutRejectReason(r: PayoutRejectResult): string {
  const parts = [r.category, r.detail.trim()].filter(Boolean);
  return parts.join(" — ");
}

export function PayoutRejectDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  target: PayoutRejectTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: PayoutRejectResult) => void;
}) {
  const [category, setCategory] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [comment, setComment] = useState("");
  const [notifyTrader, setNotifyTrader] = useState(true);

  const open = target !== null;
  const count = target?.count ?? 1;

  // Reset the form whenever a new target opens (or it reopens).
  useEffect(() => {
    if (open) {
      setCategory("");
      setDetail("");
      setComment("");
      setNotifyTrader(true);
    }
  }, [open, target?.reference]);

  // The detail is always required: the category alone is too vague for
  // the audit trail or the trader. "Other" simply has no preset hint.
  const detailRequired = category === "Other (describe below)";
  const canConfirm = category !== "" && detail.trim().length > 0;

  const confirm = () => {
    if (!canConfirm || !target) return;
    const result: PayoutRejectResult = {
      category,
      detail: detail.trim(),
      comment: comment.trim(),
      notifyTrader,
      reason: "",
    };
    result.reason = formatPayoutRejectReason(result);
    onConfirm(result);
  };

  const title =
    count > 1
      ? `Reject ${count} payouts?`
      : `Reject ${target?.traderName}'s payout?`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-rose-600" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {count > 1
              ? `You are about to reject ${count} payout requests totalling ${target ? target.amount.toLocaleString("en-US", { style: "currency", currency: target.currency || "USD" }) : ""}.`
              : `You are about to reject the payout of ${target ? target.amount.toLocaleString("en-US", { style: "currency", currency: target.currency || "USD" }) : ""} for ${target?.traderName ?? "this trader"}.`}
          </DialogDescription>
          <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
            <span className="font-medium">Consequence:</span> Rejecting a payout notifies the
            trader (if checked below), records the reason in the audit trail, and the trader
            must re-request. This action cannot be undone from this screen.
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Structured reason — reportable across surfaces */}
          <div className="space-y-1.5">
            <Label htmlFor="payout-reject-category" className="text-xs text-muted-foreground">
              Reason for rejection (required)
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                id="payout-reject-category"
                aria-label="Reason for rejection"
                className="w-full"
              >
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {payoutRejectReasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Required detail — the specific explanation */}
          <div className="space-y-1.5">
            <Label htmlFor="payout-reject-detail" className="text-xs text-muted-foreground">
              Detail (required{detailRequired ? "" : " — e.g. the rule breach, dates, numbers"})
            </Label>
            <Textarea
              id="payout-reject-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. Daily loss limit of $3,000 exceeded by $214 on Oct 26 — account #097724."
              className="min-h-[72px]"
              aria-required="true"
            />
          </div>

          {/* 3. Optional internal comment for the review record */}
          <div className="space-y-1.5">
            <Label htmlFor="payout-reject-comment" className="text-xs text-muted-foreground">
              Internal comment (optional — not shown to the trader)
            </Label>
            <Textarea
              id="payout-reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notes for the review record / next reviewer…"
              className="min-h-[56px]"
            />
          </div>

          {/* 4. Notify-trader toggle */}
          <label
            htmlFor="payout-reject-notify"
            className="flex items-start gap-2.5 rounded-md border bg-muted/40 p-3 text-sm"
          >
            <Checkbox
              id="payout-reject-notify"
              checked={notifyTrader}
              onCheckedChange={(v) => setNotifyTrader(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Notify the trader</span>
              <span className="block text-xs text-muted-foreground">
                Sends the reason and detail to the trader&apos;s inbox. Uncheck to reject
                silently (recorded in the audit trail either way).
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={confirm}
            aria-label={count > 1 ? `Reject ${count} payouts` : "Reject payout"}
          >
            <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {count > 1 ? `Reject ${count} payouts` : "Reject payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
