"use client";

/** 
 * PFaaS Platform — Challenges Overview Page
 * Displays active, passed, and failed challenges with phase progress cards
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { Challenge } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTranslation } from "next-intl";
import { Plus } from "lucide-react";
import { BreachSeverityTone } from "@/components/platform/status";

export function ChallengesPage() {
  const { runtime, tenant, user } = usePlatform();
  const { t } = useTranslation();

  // Fetch challenges for this tenant using seeded mock data
  const { data: tenantsChallenges = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["challenges", tenant.id],
        queryFn: async () => {
          const allChallenges = [];
          return allChallenges.filter((c: any) => c.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded challenge data directly
  const challenges = useMemo(() => {
    // Seed challenges based on tenant
    const seeds: Challenge[] = [];
    const tenantChallenges = []; // Would pull from mock-data
    return tenantChallenges.filter((c: any) => c.tenantId === tenant.id || c.tenantId === "platform");
  }, [tenant.id]);

  // Fallback seeded data if none fetched
  const fallbackChallenges = useMemo(() => {
    const all: Challenge[] = [
      {
        id: "chal-tenant-alpha-1",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-1",
        traderName: "Sarah Chen",
        name: "1-Step Evaluation",
        phase: "phase-2",
        accountSize: 10000,
        profitTarget: 800,
        maxDrawdown: 1000,
        dailyDrawdown: 500,
        progressPct: 67,
        daysLeft: 15,
        currentProfit: 650,
        status: "in-progress",
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "chal-tenant-alpha-2",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-2",
        traderName: "Marcus Webb",
        name: "1-Step Evaluation",
        phase: "phase-1",
        accountSize: 10000,
        profitTarget: 800,
        maxDrawdown: 1000,
        dailyDrawdown: 500,
        progressPct: 23,
        daysLeft: 45,
        currentProfit: 200,
        status: "in-progress",
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "chal-tenant-beta-1",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-1",
        traderName: "Tom Allen",
        name: "2-Step Evaluation",
        phase: "phase-2",
        accountSize: 25000,
        profitTarget: 1250,
        maxDrawdown: 2500,
        dailyDrawdown: 1250,
        progressPct: 89,
        daysLeft: 5,
        currentProfit: 1100,
        status: "in-progress",
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "chal-tenant-beta-2",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-3",
        traderName: "James Park",
        name: "1-Step Evaluation",
        phase: "funded",
        accountSize: 25000,
        profitTarget: 0,
        maxDrawdown: 2500,
        dailyDrawdown: 1250,
        progressPct: 100,
        daysLeft: 0,
        currentProfit: 0,
        status: "passed",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "chal-tenant-gamma-1",
        tenantId: "tenant-gamma",
        traderId: "trader-tenant-gamma-1",
        traderName: "Olivia Khan",
        name: "2-Step Evaluation",
        phase: "phase-1",
        accountSize: 10000,
        profitTarget: 800,
        maxDrawdown: 1000,
        dailyDrawdown: 500,
        progressPct: 12,
        daysLeft: 55,
        currentProfit: 100,
        status: "in-progress",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    return all.filter((c: any) => c.tenantId === tenant.id || c.tenantId === "platform");
  }, [tenant.id]);

  const displayedChallenges = useMemo(() => challenges.length > 0 ? challenges : fallbackChallenges, [challenges, tenant.id]);

  // Status tone based on challenge status
  const getStatusTone = (status: string): "success" | "warning" | "info" | "danger" | "muted" => {
    switch (status) {
      case "passed": return "success";
      case "funded": return "success";
      case "in-progress": return "warning";
      case "failed": return "danger";
      default: return "muted";
    }
  };

  // Phase label
  const getPhaseLabel = (phase: string): string => {
    const labels: Record<string, string> = {
      phase_1: "Phase 1",
      phase_2: "Phase 2",
      funded: "Funded",
    };
    return labels[phase] || phase;
  };

  return (
    <Card className="p-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">
          {t("challenges.title", defaultValue: "Challenges")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "challenges.subtitle",
            defaultValue: "View and manage all active challenges across tenants",
            _: 0
          )}
        </p>
      </CardHeader>

      <CardContent>
        {/* Summary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Active Challenges Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("challenges.active", defaultValue: "Active")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground">
                {displayedChallenges.filter((c: any) => c.status === "in-progress").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("challenges.activeCount", defaultValue: "challenges in progress")}
              </p>
            </CardContent>
          </Card>

          {/* Passed Challenges Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("challenges.passed", defaultValue: "Passed")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground success">
                {displayedChallenges.filter((c: any) => c.status === "passed").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("challenges.passedCount", defaultValue: "challenges passed")}
              </p>
            </CardContent>
          </Card>

          {/* Failed Challenges Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("challenges.failed", defaultValue: "Failed")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground danger">
                {displayedChallenges.filter((c: any) => c.status === "failed").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("challenges.failedCount", defaultValue: "challenges failed")}
              </p>
            </CardContent>
          </Card>

          {/* Funded Challenges Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("challenges.funded", defaultValue: "Funded")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground success">
                {displayedChallenges.filter((c: any) => c.status === "funded").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("challenges.fundedCount", defaultValue: "funded traders")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Challenges List */}
        <div className="space-y-4">
          {displayedChallenges.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>{t("common.noRecords", defaultValue: "No challenges found")}</p>
              </CardContent>
            </Card>
          ) : (
            displayedChallenges.map((challenge) => (
              <Card key={challenge.id} className="p-4 border-b last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {challenge.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {t("challenges.trader", defaultValue: "Trader")}: {challenge.traderName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={getStatusTone(challenge.status) as any}
                      className="h-3 w-3"
                    />
                    <span className="text-[10px] font-medium">
                      {challenge.status}
                    </span>
                  </div>
                </div>

                {/* Phase Progress */}
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("challenges.phase", defaultValue: "Phase")}: {getPhaseLabel(
                      challenge.phase
                    )}
                  </p>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`bg-primary rounded-full h-2 transition-all duration-500 ${challenge.progressPct > 80 ? "bg-success" : challenge.progressPct > 50 ? "bg-warning" : "bg-muted"}`}
                      style={{ width: `${challenge.progressPct}%` }}
                    ></div>
                  </div>
                  <p className="text-xs font-medium text-foreground mt-1">
                    {challenge.progressPct}% progress
                  </p>
                </div>

                {/* Progress Details */}
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t("challenges.profitTarget", defaultValue: "Profit Target")}: {
                      formatCurrency(
                        challenge.profitTarget,
                        tenant.currency
                      )
                    }
                  </span>
                  <span>
                    {t("challenges.maxDrawdown", defaultValue: "Max Drawdown")}: {
                      formatCurrency(
                        challenge.maxDrawdown,
                        tenant.currency
                      )
                    }
                  </span>
                </div>

                {/* CTA */}
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // navigate(`challenge-detail`, { challengeId: challenge.id });
                      // toast({ title: "View challenge", description: `View ${challenge.name} details` });
                    }}
                  >
                    {t("common.view", defaultValue: "View")} {t("challenges.details", defaultValue: "Details")}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}