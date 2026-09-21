"use client";

/**
 * PFaaS Platform — Attention Center (UX Constitution §11)
 *
 * Centralized attention model that categorizes platform events into:
 * - Action Required: someone must perform a task
 * - Warnings: something deserves inspection
 * - Information: no action needed
 *
 * Each item provides direct navigation to the relevant workspace.
 * This is the "Operating Center" the dashboard should be (§4).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldAlert,
  Wallet,
  Users,
  FileCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  getTenantPayouts,
  getTenantBreaches,
  getTenantKyc,
  getTenantTickets,
  getTenantAiInsights,
  getTenantTraders,
  getTenantAccounts,
} from "@/lib/platform/mock-data";

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  count?: number;
  icon: ComponentType<{ className?: string }>;
  navigateTo: string;
  navigateLabel: string;
}

interface AttentionGroup {
  id: string;
  label: string;
  tone: "action" | "warning" | "info";
  items: AttentionItem[];
}

export function AttentionCenter() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const groups = buildAttentionGroups(tid, runtime.enabledModules);

  if (groups.every((g) => g.items.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        if (group.items.length === 0) return null;
        const toneStyles = toneConfig[group.tone];
        return (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader
              className={cn("flex flex-row items-center gap-2 py-2.5", toneStyles.headerBg)}
            >
              <toneStyles.icon className={cn("h-4 w-4", toneStyles.iconColor)} />
              <span className="text-sm font-semibold text-foreground">{group.label}</span>
              <Badge variant="secondary" className={cn("ml-auto", toneStyles.badge)}>
                {group.items.reduce((s, i) => s + (i.count ?? 1), 0)}
              </Badge>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.navigateTo)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className={cn("rounded-md p-1.5", toneStyles.itemIconBg)}>
                      <Icon className={cn("h-3.5 w-3.5", toneStyles.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        {item.count !== undefined && item.count > 1 ? (
                          <Badge variant="outline" className="text-[9px]">{item.count}</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="hidden text-xs font-medium text-primary sm:inline">{item.navigateLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const toneConfig = {
  action: {
    headerBg: "bg-rose-50 dark:bg-rose-950/30",
    icon: AlertCircle,
    iconColor: "text-rose-600 dark:text-rose-400",
    itemIconBg: "bg-rose-100 dark:bg-rose-950",
    badge: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  },
  warning: {
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400",
    itemIconBg: "bg-amber-100 dark:bg-amber-950",
    badge: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  },
  info: {
    headerBg: "bg-sky-50 dark:bg-sky-950/30",
    icon: Info,
    iconColor: "text-sky-600 dark:text-sky-400",
    itemIconBg: "bg-sky-100 dark:bg-sky-950",
    badge: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  },
};

function buildAttentionGroups(tid: string, enabledModules: string[]): AttentionGroup[] {
  const has = (id: string) => enabledModules.includes(id);

  const actionItems: AttentionItem[] = [];
  const warningItems: AttentionItem[] = [];
  const infoItems: AttentionItem[] = [];

  // Action Required: pending payouts
  if (has("payouts")) {
    const pending = getTenantPayouts(tid).filter((p) => p.status === "pending");
    if (pending.length > 0) {
      const totalAmount = pending.reduce((s, p) => s + p.amount, 0);
      actionItems.push({
        id: "pending-payouts",
        title: "Payout approvals waiting",
        detail: `${pending.length} requests totaling ${totalAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        count: pending.length,
        icon: Wallet,
        navigateTo: "payouts-pending",
        navigateLabel: "Review queue",
      });
    }
  }

  // Action Required: KYC reviews
  if (has("kyc")) {
    const reviewKyc = getTenantKyc(tid).filter((k) => k.status === "review" || k.status === "pending");
    if (reviewKyc.length > 0) {
      actionItems.push({
        id: "kyc-reviews",
        title: "KYC reviews needed",
        detail: `${reviewKyc.length} submissions awaiting verification`,
        count: reviewKyc.length,
        icon: FileCheck,
        navigateTo: "kyc-reviews",
        navigateLabel: "Review KYC",
      });
    }
  }

  // Action Required: urgent support tickets
  if (has("support")) {
    const urgent = getTenantTickets(tid).filter((t) => t.priority === "urgent" && t.status === "open");
    if (urgent.length > 0) {
      actionItems.push({
        id: "urgent-tickets",
        title: "Urgent support tickets",
        detail: `${urgent.length} urgent tickets need immediate response`,
        count: urgent.length,
        icon: Users,
        navigateTo: "support-tickets",
        navigateLabel: "View tickets",
      });
    }
  }

  // Warnings: open breaches
  if (has("risk")) {
    const openBreaches = getTenantBreaches(tid).filter((b) => b.status === "open");
    if (openBreaches.length > 0) {
      const critical = openBreaches.filter((b) => b.severity === "critical").length;
      warningItems.push({
        id: "open-breaches",
        title: "Open breaches",
        detail: `${openBreaches.length} accounts breached (${critical} critical)`,
        count: openBreaches.length,
        icon: ShieldAlert,
        navigateTo: "breaches",
        navigateLabel: "Investigate",
      });
    }
  }

  // Warnings: accounts near breach (traders with status breached or suspended)
  if (has("trading")) {
    const atRisk = getTenantTraders(tid).filter((t) => t.status === "breached" || t.status === "suspended");
    if (atRisk.length > 0) {
      warningItems.push({
        id: "accounts-at-risk",
        title: "Accounts at risk",
        detail: `${atRisk.length} accounts need attention`,
        count: atRisk.length,
        icon: AlertTriangle,
        navigateTo: "trading-traders",
        navigateLabel: "View traders",
      });
    }
  }

  // Warnings: high-risk KYC
  if (has("kyc")) {
    const highRisk = getTenantKyc(tid).filter((k) => k.riskLevel === "high");
    if (highRisk.length > 0) {
      warningItems.push({
        id: "high-risk-kyc",
        title: "High-risk KYC profiles",
        detail: `${highRisk.length} profiles flagged as high risk`,
        count: highRisk.length,
        icon: AlertTriangle,
        navigateTo: "kyc-risk",
        navigateLabel: "Review risk",
      });
    }
  }

  // Information: AI insights
  if (has("ai")) {
    const insights = getTenantAiInsights(tid);
    if (insights.length > 0) {
      const opportunities = insights.filter((i) => i.severity === "opportunity");
      if (opportunities.length > 0) {
        infoItems.push({
          id: "ai-opportunities",
          title: "AI opportunities detected",
          detail: opportunities[0].title,
          count: opportunities.length,
          icon: Info,
          navigateTo: "ai-insights",
          navigateLabel: "View insights",
        });
      }
    }
  }

  // Information: funded traders milestone
  if (has("challenges")) {
    const funded = getTenantTraders(tid).filter((t) => t.challengePhase === "funded").length;
    if (funded > 0 && funded % 5 === 0) {
      infoItems.push({
        id: "funded-milestone",
        title: `${funded} funded traders`,
        detail: "Milestone reached — more traders than ever are in funded status",
        icon: Info,
        navigateTo: "challenges-passed",
        navigateLabel: "View",
      });
    }
  }

  return [
    { id: "action", label: "Action Required", tone: "action" as const, items: actionItems },
    { id: "warning", label: "Warnings", tone: "warning" as const, items: warningItems },
    { id: "info", label: "Information", tone: "info" as const, items: infoItems },
  ];
}
