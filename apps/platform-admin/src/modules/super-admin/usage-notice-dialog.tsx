"use client";

/**
 * Tenant usage notice (audit finding #4 — HIGH).
 *
 * The recommendation asks for "tools for admins to notify tenants of
 * upcoming overages or suggest plan upgrades". Overage monitoring could
 * arm internal alerts and schedule plan changes, but nothing ever
 * reached the TENANT with the specifics. This dialog is the
 * out-of-the-tenant notice: the caller pre-fills it with the binding
 * metric, utilization, forecast, and recommended next step (upgrade to
 * the smallest clearing tier, or the cap that will be enforced). The
 * admin can edit subject/message before sending.
 *
 * Mounted fresh per notice (parent renders it only while open), so
 * useState(prefill) is the reset mechanism — no effects.
 *
 * Frontend-only demo: "send" writes an audit row and confirms with a
 * toast; nothing leaves the browser (delivery is a backend concern).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";

export interface UsageNoticePrefill {
  tenantName: string;
  /** Where the notice goes — demo recipient derived by the caller. */
  recipient: string;
  subject: string;
  message: string;
}

export function UsageNoticeDialog({
  prefill,
  onClose,
}: {
  prefill: UsageNoticePrefill;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(prefill.subject);
  const [message, setMessage] = useState(prefill.message);

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

  const send = () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Nothing to send",
        description: "A notice needs both a subject and a message.",
        variant: "destructive",
      });
      return;
    }
    recordAudit({
      actor: "operator",
      action: "usage.tenant_notice",
      target: prefill.tenantName,
      detail: `Overage/upgrade notice queued for ${prefill.tenantName} (${prefill.recipient}): "${subject.trim()}"`,
      severity: "warning",
    });
    toast({
      title: `Notice queued for ${prefill.tenantName}`,
      description: `"${subject.trim()}" → ${prefill.recipient} — audit row written; delivery happens at the next notification sweep.`,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notify {prefill.tenantName}</DialogTitle>
          <DialogDescription>
            Usage/overage notice pre-filled from metering — review before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            To: <span className="font-medium text-foreground">{prefill.recipient}</span>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className={inputClass}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send}>Send notice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
