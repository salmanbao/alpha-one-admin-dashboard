"use client";

/**
 * Emergency Controls — the "nuclear controls" screen.
 *
 * Research item #14. Provides:
 *   - Tenant Halt (stops new purchases, payout requests, account transitions)
 *   - Maintenance Mode (trading continues, new purchases unavailable)
 *   - Relay Pause (stops event relay processing, not trading)
 *   - Feature/Kill Switches (evaluation pause, auto-approval force-off)
 *   - Platform Halt (last-resort)
 *
 * Every action needs: 2FA, reason, blast-radius explanation, what stops,
 * what continues, runbook, confirmation, audit record.
 *
 * The spec explicitly requires explaining what keeps working and what stops.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import {
  ShieldAlert,
  ShieldCheck,
  Pause,
  Play,
  Power,
  Zap,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface EmergencyControl {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  severity: "high" | "critical" | "extreme";
  whatStops: string[];
  whatContinues: string[];
  runbook: string;
  isPlatformHalt?: boolean;
}

const controls: EmergencyControl[] = [
  {
    id: "tenant-halt",
    name: "Tenant Halt",
    description: "Stop new purchases, payout requests, and account transitions for a specific tenant.",
    icon: Pause,
    severity: "high",
    whatStops: ["New challenge purchases", "Payout requests", "Account phase transitions"],
    whatContinues: ["Open positions remain open", "Risk rules still enforced", "Dashboard access for existing admins"],
    runbook: "RB-001: Tenant Halt Procedure",
  },
  {
    id: "maintenance-mode",
    name: "Maintenance Mode",
    description: "Platform maintenance banner. Trading continues; new purchases temporarily unavailable.",
    icon: Clock,
    severity: "high",
    whatStops: ["New challenge purchases", "New tenant signups"],
    whatContinues: ["All trading activity", "Payout processing", "Risk evaluation", "Admin access"],
    runbook: "RB-002: Maintenance Mode",
  },
  {
    id: "relay-pause",
    name: "Relay Pause",
    description: "Stop event relay processing. Trading and rule enforcement continue.",
    icon: Zap,
    severity: "critical",
    whatStops: ["Event relay processing", "Cross-service event delivery", "Audit event streaming"],
    whatContinues: ["All trading activity", "Risk rule enforcement", "Position management", "Order execution"],
    runbook: "RB-003: Relay Pause Procedure",
  },
  {
    id: "evaluation-pause",
    name: "Evaluation Pause",
    description: "Pause all challenge evaluations globally. Traders can't progress or fail.",
    icon: ToggleLeft,
    severity: "high",
    whatStops: ["Challenge phase transitions", "Evaluation pass/fail decisions", "Profit target checks"],
    whatContinues: ["Trading activity", "Payout requests", "Account management", "Admin access"],
    runbook: "RB-004: Evaluation Pause",
  },
  {
    id: "auto-approval-off",
    name: "Auto-Approval Force-Off",
    description: "Disable all automatic payout approvals. Every payout requires manual review.",
    icon: ToggleRight,
    severity: "high",
    whatStops: ["Automatic payout approvals", "Batch payout processing"],
    whatContinues: ["Manual payout review", "Trading activity", "All other operations"],
    runbook: "RB-005: Auto-Approval Override",
  },
  {
    id: "platform-halt",
    name: "Platform Halt",
    description: "Last-resort control. Stops ALL platform operations. Requires two-operator approval.",
    icon: Power,
    severity: "extreme",
    whatStops: ["ALL trading activity", "ALL payout processing", "ALL evaluations", "ALL event processing", "ALL API access"],
    whatContinues: ["Admin dashboard access (read-only)", "Audit logging", "Monitoring"],
    runbook: "RB-006: Platform Halt (Emergency)",
    isPlatformHalt: true,
  },
];

const severityTone = (s: EmergencyControl["severity"]) =>
  s === "extreme" ? "danger" : s === "critical" ? "warning" : "info";

const severityBadge = (s: EmergencyControl["severity"]) => {
  if (s === "extreme") return "border-rose-500/40 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400";
  if (s === "critical") return "border-amber-500/40 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "border-slate-500/40 bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400";
};

export function EmergencyControlsPage() {
  const { navigate } = usePlatform();
  const [reason, setReason] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [activeControls, setActiveControls] = useState<Set<string>>(new Set());

  const toggleControl = (id: string) => {
    setActiveControls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const triggerControl = (control: EmergencyControl) => {
    toggleControl(control.id);
    toast({
      title: `${control.name} ${activeControls.has(control.id) ? "released" : "activated"}`,
      description: `Reason: ${reason || "(no reason provided)"} · Audit ID: EC-${Date.now().toString(36).toUpperCase()}`,
      variant: activeControls.has(control.id) ? "default" : "destructive",
    });
    setReason("");
    setSelectedTenant("");
  };

  return (
    <Page>
      <PageHeader
        title="Emergency Controls"
        description="Platform-wide emergency and kill-switch controls. Every action is audited and requires 2FA."
        icon={ShieldAlert}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("platform-audit")}>
            <Clock className="mr-1 h-4 w-4" /> Control History
          </Button>
        }
      />
      <PageContent>
        {/* Active controls banner */}
        {activeControls.size > 0 && (
          <Card className="border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20">
            <CardContent className="flex items-center gap-3 py-3">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                  {activeControls.size} emergency control{activeControls.size === 1 ? "" : "s"} active
                </p>
                <p className="text-xs text-muted-foreground">
                  {Array.from(activeControls).map((id) => controls.find((c) => c.id === id)?.name).join(", ")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("approval-center")}>
                View approval queue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Control cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {controls.map((control) => {
            const Icon = control.icon;
            const isActive = activeControls.has(control.id);
            return (
              <Card
                key={control.id}
                className={cn(
                  control.isPlatformHalt && "border-rose-500/40 lg:col-span-2",
                  isActive && "border-rose-500/60 ring-1 ring-rose-500/20",
                )}
              >
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className={cn(
                    "rounded-lg p-2",
                    control.isPlatformHalt ? "bg-rose-100 dark:bg-rose-950" : "bg-muted",
                  )}>
                    <Icon className={cn("h-5 w-5", control.isPlatformHalt ? "text-rose-600" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{control.name}</h3>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", severityBadge(control.severity))}>
                        {control.severity}
                      </Badge>
                      {isActive && (
                        <Badge variant="outline" className="border-rose-500/40 bg-rose-100 text-rose-700 text-[10px] dark:bg-rose-950 dark:text-rose-400">
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* What stops / what continues */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-rose-500/20 bg-rose-50/30 p-2 dark:bg-rose-950/10">
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                        <XCircle className="h-3 w-3" /> What stops
                      </p>
                      <ul className="space-y-0.5">
                        {control.whatStops.map((s) => (
                          <li key={s} className="text-[11px] text-muted-foreground">· {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/30 p-2 dark:bg-emerald-950/10">
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> What continues
                      </p>
                      <ul className="space-y-0.5">
                        {control.whatContinues.map((s) => (
                          <li key={s} className="text-[11px] text-muted-foreground">· {s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Runbook reference */}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Runbook: <span className="font-mono font-medium text-foreground">{control.runbook}</span>
                  </div>

                  {/* Action trigger */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant={isActive ? "outline" : "destructive"}
                        className="w-full"
                        disabled={control.isPlatformHalt && !isActive}
                      >
                        {isActive ? (
                          <><Play className="mr-1 h-3.5 w-3.5" /> Release control</>
                        ) : (
                          <><Pause className="mr-1 h-3.5 w-3.5" /> {control.isPlatformHalt ? "Request platform halt" : "Activate"}</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {isActive ? `Release ${control.name}?` : `Activate ${control.name}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3">
                            <p>{control.description}</p>
                            <div className="rounded-md border p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">What stops:</p>
                              <p className="text-xs">{control.whatStops.join(", ")}.</p>
                            </div>
                            <div className="rounded-md border p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">What continues:</p>
                              <p className="text-xs">{control.whatContinues.join(", ")}.</p>
                            </div>
                            {control.isPlatformHalt && (
                              <div className="rounded-md border border-rose-500/40 bg-rose-50 p-2 dark:bg-rose-950/20">
                                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                                  ⚠ This is a last-resort control. Two-operator approval required.
                                </p>
                              </div>
                            )}
                            <div>
                              <Label htmlFor={`reason-${control.id}`} className="text-xs">Reason (required, will be audited)</Label>
                              <Textarea
                                id={`reason-${control.id}`}
                                placeholder="Describe the reason for this action…"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="mt-1 text-xs"
                                rows={2}
                              />
                            </div>
                            {!control.isPlatformHalt && !isActive && (
                              <div>
                                <Label htmlFor={`tenant-${control.id}`} className="text-xs">Target tenant (optional)</Label>
                                <select
                                  id={`tenant-${control.id}`}
                                  value={selectedTenant}
                                  onChange={(e) => setSelectedTenant(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                                >
                                  <option value="">All tenants (platform-wide)</option>
                                  {allTenants.filter((t) => t.id !== "platform").map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">
                              2FA verification will be required. This action will be logged in the platform audit trail.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(!isActive && "bg-rose-600 text-white hover:bg-rose-700")}
                          onClick={() => triggerControl(control)}
                          disabled={!reason.trim() && !isActive}
                        >
                          {isActive ? "Release" : "Activate"} (requires 2FA)
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </Page>
  );
}
