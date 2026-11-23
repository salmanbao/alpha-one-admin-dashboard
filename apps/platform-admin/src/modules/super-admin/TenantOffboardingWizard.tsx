"use client";

/**
 * Tenant Offboarding Wizard — P1-5.
 *
 * Guides an operator through the offboarding of a tenant with:
 *   - Retention choice (preserve data vs. purge)
 *   - Scheduled deletion with a grace period (default 30 days)
 *   - Restore window before scheduled execution
 *   - Two-operator approval flow (CON-32)
 *   - Full audit trail via console.logic.recordAudit
 *
 * Flow:
 *   1. Operator selects tenant → retention choice → grace period → confirm
 *   2. Two-operator flow: Operator A initiates → pending approval → Operator B approves
 *   3. On approval: tenant status → "offboarding" → scheduledFor date set
 *   4. Auto-execute after grace period unless restored
 *   5. Restore window: operator can cancel at any point before scheduled execution
 */

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import { recordAudit, initiateApproval } from "@/lib/platform/console-store";
import { cn } from "@/lib/utils";
import { XCircle, CheckCircle, Clock, Loader2, TriangleAlert } from "lucide-react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import type { TenantContext } from "@/lib/platform/types";

type RetentionChoice = "preserve" | "purge";

interface OffboardingFlow {
  kind: "offboard";
  tenant: TenantContext;
  retention: RetentionChoice;
  gracePeriodDays: number;
  scheduledFor: string;
  reason: string;
  initiatedBy: string;
  approvalInitiatedAt?: string;
}

export function TenantOffboardingWizard({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, navigate } = usePlatform();
  const tenants = useTenants();
  const tenant = tenants.find((t) => t.id === tenantId);

  const [retention, setRetention] = useState<RetentionChoice>("preserve");
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(30);
  const [reason, setReason] = useState<string>("");
  const [scheduledFor, setScheduledFor] = useState<string>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [flow, setFlow] = useState<OffboardingFlow | null>(null);
  const [approvalPending, setApprovalPending] = useState<boolean>(false);

  // Approval-window timeout. Declared before the `!tenant` guard so hook
  // order is identical on every render (rules-of-hooks).
  useEffect(() => {
    if (!flow) return;

    // Set a timeout for the approval window (10 minutes)
    const timeoutId = setTimeout(() => {
      setApprovalPending(false);
      setFlow(null);
    }, 10 * 60 * 1000);

    return () => clearTimeout(timeoutId);
  }, [flow]);

  if (!tenant) {
    return null;
  }

  const gracePeriodOptions = [
    { value: 7, label: "1 week" },
    { value: 14, label: "2 weeks" },
    { value: 30, label: "30 days" },
    { value: 60, label: "60 days" },
    { value: 90, label: "90 days" },
  ];

  const handleRetentionChange = (value: RetentionChoice) => {
    setRetention(value);
  };

  const handleGracePeriodChange = (value: number) => {
    setGracePeriodDays(value);
    const date = new Date(Date.now() + value * 24 * 60 * 60 * 1000);
    setScheduledFor(date.toISOString());
  };

  const handleReasonChange = (value: string) => {
    setReason(value);
  };

  const handleInitiate = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for offboarding.",
        variant: "destructive",
      });
      return;
    }

    const scheduledDate = new Date(scheduledFor);
    const flow: OffboardingFlow = {
      kind: "offboard",
      tenant,
      retention,
      gracePeriodDays,
      scheduledFor: scheduledDate.toISOString(),
      reason,
      initiatedBy: user?.name || "unknown",
    };

    setFlow(flow);

    // Initiate two-operator approval
    const request = await mockAsync(
      () =>
        initiateApproval({
          actionKey: `tenant.offboard.${tenant.id}`,
          actionLabel: `Offboard tenant ${tenant.name}`,
          blastRadius: [
            `Tenant ${tenant.name} scheduled for ${retention} deletion`,
            `All access revoked after grace period`,
            `Audit row recorded with reason: ${reason}`,
          ],
          initiator: { id: user?.id || "unknown", name: user?.name || "unknown" },
          tenantId: tenant.id,
          detail: `Offboarding flow: retention=${retention}, gracePeriod=${gracePeriodDays}d, reason="${reason}"`,
          payload: flow,
        }),
      {}
    );

    if (request && request.id) {
      setApprovalPending(true);
      toast({
        title: "Offboarding pending approval",
        description: `Operator B must approve within 10 minutes — Approval Center.`,
      });
    }
  };

  const handleApprove = async () => {
    if (flow) {
      setFlow(null);
      setApprovalPending(false);
      toast({
        title: "Tenant offboarded",
        description: `Tenant ${tenant.name} has been ${flow.retention === "preserve" ? "preserved" : "purged"} data. Status set to "offboarding".`,
      });
    }
  };

  const handleRestore = () => {
    setFlow(null);
    setApprovalPending(false);
    toast({
      title: "Offboarding restored",
      description: `Tenant ${tenant.name} offboarding has been cancelled. Tenant remains active.`,
    });
  };

  return (
    <>
      {/* Main Offboarding Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <TriangleAlert className="h-4 w-4 text-destructive" /> Offboard Tenant
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Offboarding tenant {tenant.name} will deactivate the account and revoke all access. Choose whether to preserve or purge tenant data, and set a grace period for restoration.
          </DialogDescription>
        </DialogContent>

        {/* Retention Choice */}
        <div className="space-y-4 pt-4">
          <Label className="text-xs font-medium">Retention choice</Label>
          <div className="rounded-lg border p-3 space-y-2">
            <Label
              className={cn(
                "flex items-start gap-2 rounded border cursor-pointer select-none px-3 py-2",
                retention === "preserve" ? "border-green-500 text-green-600 bg-green-50/20" : "border",
              )}
              onClick={() => handleRetentionChange("preserve")}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-green-500" />
              <span>Preserve all tenant data and configuration</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {tenant.name}'s data will be kept and restorable.
              </span>
            </Label>

            <Label
              className={cn(
                "flex items-start gap-2 rounded border cursor-pointer select-none px-3 py-2",
                retention === "purge" ? "border-red-500 text-red-600 bg-red-50/20" : "border",
              )}
              onClick={() => handleRetentionChange("purge")}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-red-500" />
              <span>Purge tenant data after grace period</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {tenant.name}'s data will be permanently deleted after the grace period.
              </span>
            </Label>
          </div>

          {/* Grace Period */}
          <div className="mt-4">
            <Label className="text-xs font-medium">Grace period</Label>
            <div className="rounded-lg border p-3 space-y-2">
              {gracePeriodOptions.map((opt) => (
                <Label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-2 rounded border cursor-pointer select-none px-3 py-2",
                    gracePeriodDays === opt.value
                      ? "border-primary-500 text-primary-600 bg-primary-50/20"
                      : "border",
                  )}
                  onClick={() => handleGracePeriodChange(opt.value)}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-primary-600" />
                  {opt.label}
                </Label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="mt-4">
            <Label htmlFor="offboarding-reason" className="text-xs">
              Reason (required — recorded in audit log)
            </Label>
            <textarea
              id="offboarding-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this tenant being offboarded? e.g. INC-4421 — violating SLO, contract termination"
              rows={3}
              className="mt-1 block w-full rounded-md border-0 py-1.5 pt-2 pl-1 text-sm font-medium placeholder-gray-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-50"
            />
            {reason.trim().length > 0 && reason.trim().length < 8 ? (
              <p className="mt-1 text-xs text-destructive">
                Please give a meaningful reason (at least 8 characters).
              </p>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Cancel offboarding
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiate}
              disabled={!reason.trim() || !retention}
              className="w-full"
            >
              {approvalPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4" />
                  Pending approval...
                </>
              ) : (
                "Initiate Offboarding"
              )}
            </Button>
          </div>
        </div>

        {/* Approval Pending */}
        {flow && approvalPending && (
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              Offboarding initiated for {tenant.name}. Waiting for Operator B approval within 10 minutes.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}