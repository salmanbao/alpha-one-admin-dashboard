"use client";

/** 
 * PFaaS Platform — AI Insights Dashboard Page
 * Displays AI-generated insights, anomalies, and recommendations
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { AiInsight } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTranslation } from "next-intl";
import { Button } from "@/components/ui/button";
import { Shield, Brain, AlertCircle, TrendingUp, Target, Clock } from "lucide-react";
import { breachSeverityTone } from "@/components/platform/status";

export function AiInsightsPage() {
  const { runtime, tenant, user } = usePlatform();
  const { t } = useTranslation();

  // Fetch AI insights for this tenant using seeded mock data
  const { data: tenantsAi = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["ai-insights", tenant.id],
        queryFn: async () => {
          const allInsights = [];
          return allInsights.filter((i: any) => i.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded AI insights data directly
  const aiInsights = useMemo(() => {
    // Seed AI insights based on tenant
    const seeds: AiInsight[] = [];
    const tenantInsights = []; // Would pull from mock-data
    return tenantInsights.filter((i: any) => i.tenantId === tenant.id || i.tenantId === "platform");
  }, [tenant.id]);

  // Fallback seeded data if none fetched
  const fallbackInsights = useMemo(() => {
    const all: AiInsight[] = [
      {
        id: "ai-1",
        tenantId: "tenant-beta",
        module: "ai",
        title: "Payout spike detected",
        summary: "Payout requests up 38% week-over-week, concentrated in funded traders.",
        detail: "Model confidence 87%. Recommend reviewing payout reserves.",
        severity: "warning",
        confidence: 0.87,
        generatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      {
        id: "ai-2",
        tenantId: "tenant-beta",
        module: "ai",
        title: "Affiliate conversion opportunity",
        summary: "Affiliates in 'gold' tier convert 2.4x better. Consider tier upgrade for 3 partners.",
        detail: "Expected revenue uplift: $18.4k over 30 days.",
        severity: "opportunity",
        confidence: 0.78,
        generatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      },
      {
        id: "ai-3",
        tenantId: "tenant-gamma",
        module: "ai",
        title: "KYC backlog growing",
        summary: "14 KYC reviews pending >48h. Risk of churn for 4 high-value leads.",
        detail: "Auto-approve low-risk profiles to reduce backlog.",
        severity: "critical",
        confidence: 0.92,
        generatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      },
      {
        id: "ai-4",
        tenantId: "tenant-alpha",
        module: "ai",
        title: "Trading anomaly detected",
        summary: "Unusual win rate spike on EURUSD positions. Possible signal or data issue.",
        detail: "Model confidence 72%. Recommend reviewing recent trade entries.",
        severity: "info",
        confidence: 0.72,
        generatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: "ai-5",
        tenantId: "tenant-alpha",
        module: "ai",
        title: "Risk concentration alert",
        summary: "30% of funded traders exposed to GBPUSD. Monitor for correlated drawdown.",
        detail: "Suggest diversification across currency pairs.",
        severity: "warning",
        confidence: 0.81,
        generatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
    ];
    return all.filter((i: any) => i.tenantId === tenant.id || i.tenantId === "platform");
  }, [tenant.id]);

  const displayedInsights = useMemo(() => aiInsights.length > 0 ? aiInsights : fallbackInsights, [aiInsights, tenant.id]);

  // Severity tone
  const getSeverityTone = (severity: string): "success" | "warning" | "info" | "danger" | "muted" => {
    const tones: Record<string, "success" | "warning" | "info" | "danger" | "muted"> = {
      critical: "danger",
      warning: "warning",
      success: "success",
      info: "info",
      opportunity: "info",
      muted: "muted",
    };
    return tones[severity] || "muted";
  };

  return (
    <Card className="p-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">
          {t("ai.title", defaultValue: "AI Insights")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "ai.subtitle",
            defaultValue: "AI-generated anomalies, opportunities, and recommendations",
            _: 0
          )}
        </p>
      </CardHeader>

      <CardContent>
        {/* Summary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Critical Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("ai.critical", defaultValue: "Critical")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground danger">
                {displayedInsights.filter((i: any) => i.severity === "critical").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("ai.criticalCount", defaultValue: "critical alerts")}
              </p>
            </CardContent>
          </Card>

          {/* Warning Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("ai.warning", defaultValue: "Warning")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground warning">
                {displayedInsights.filter((i: any) => i.severity === "warning").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("ai.warningCount", defaultValue: "warning alerts")}
              </p>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("ai.info", defaultValue: "Info")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground info">
                {displayedInsights.filter((i: any) => i.severity === "info").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("ai.infoCount", defaultValue: "info items")}
              </p>
            </CardContent>
          </Card>

          {/* Opportunity Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("ai.opportunity", defaultValue: "Opportunity")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground success">
                {displayedInsights.filter((i: any) => i.severity === "opportunity").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("ai.opportunityCount", defaultValue: "opportunities identified")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Insights List */}
        <div className="space-y-4">
          {displayedInsights.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>{t("common.noRecords", defaultValue: "No AI insights found")}</p>
              </CardContent>
            </Card>
          ) : (
            displayedInsights.map((insight) => (
              <Card key={insight.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <StatusBadge
                        tone={getSeverityTone(insight.severity) as any}
                        className="h-3 w-3 flex-shrink-0 mt-0.5"
                      />
                      <div>
                        <h3 className="text-sm font-medium text-foreground">
                          {insight.title}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          {insight.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(insight.generatedAt).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "numeric" }
                        )} ago
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone="info"
                      className="h-2 w-2 text-[10px] opacity-80"
                    />
                    <span className="text-[10px] font-medium">
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                {/* Detailed note */}
                {insight.detail && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      {t("ai.detail", defaultValue: "Detail")}: 
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {insight.detail}
                    </p>
                  </div>
                )}

                {/* Action */}
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Navigate to detailed view
                      // navigate(`ai-detail`, { insightId: insight.id });
                      // toast({ title: "AI Insight Details", description: `View ${insight.title}` });
                    }}
                  >
                    {t("common.view", defaultValue: "View Details")}
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