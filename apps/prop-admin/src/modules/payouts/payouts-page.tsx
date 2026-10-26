"use client";

/** 
 * PFaaS Platform — Pending Payouts Management Page
 * Displays pending payout requests with approval/rejection workflow
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { Payout } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTranslation } from "next-intl";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, DollarSign, Clock as ClockIcon, XCircle, Shield} from "lucide-react";

export function PayoutsPage() {
  const { runtime, tenant, user } = usePlatform();
  const { t } = useTranslation();

  // Fetch payouts for this tenant using seeded mock data
  const { data: tenantsPayouts = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["payouts", tenant.id],
        queryFn: async () => {
          const allPayouts = [];
          return allPayouts.filter((p: any) => p.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded payout data directly
  const payouts = useMemo(() => {
    // Seed payouts based on tenant
    const seeds: Payout[] = [];
    const tenantPayouts = []; // Would pull from mock-data
    return tenantPayouts.filter((p: any) => p.tenantId === tenant.id || p.tenantId === "platform");
  }, [tenant.id]);

  // Fallback seeded data if none fetched
  const fallbackPayouts = useMemo(() => {
    const all: Payout[] = [
      {
        id: "pay-tenant-alpha-1",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-1",
        traderName: "Sarah Chen",
        amount: 2500,
        currency: "USD",
        method: "bank-transfer",
        status: "pending",
        profitSplit: 80,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10001",
      },
      {
        id: "pay-tenant-alpha-2",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-2",
        traderName: "Marcus Webb",
        amount: 1200,
        currency: "USD",
        method: "crypto",
        status: "approved",
        profitSplit: 70,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10002",
      },
      {
        id: "pay-tenant-beta-1",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-1",
        traderName: "Tom Allen",
        amount: 3500,
        currency: "GBP",
        method: "bank-transfer",
        status: "pending",
        profitSplit: 80,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10003",
      },
      {
        id: "pay-tenant-beta-2",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-3",
        traderName: "Elena Rossi",
        amount: 1800,
        currency: "GBP",
        method: "paypal",
        status: "processing",
        profitSplit: 75,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10004",
      },
      {
        id: "pay-tenant-gamma-1",
        tenantId: "tenant-gamma",
        traderId: "trader-tenant-gamma-1",
        traderName: "Olivia Khan",
        amount: 2800,
        currency: "USD",
        method: "skrill",
        status: "pending",
        profitSplit: 85,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10005",
      },
      {
        id: "pay-tenant-gamma-2",
        tenantId: "tenant-gamma",
        traderId: "trader-tenant-gamma-2",
        traderName: "Marcus Webb",
        amount: 950,
        currency: "USD",
        method: "bank-transfer",
        status: "rejected",
        profitSplit: 60,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        reference: "WD-10006",
      },
    ];
    return all.filter((p: any) => p.tenantId === tenant.id || p.tenantId === "platform");
  }, [tenant.id]);

  const displayedPayouts = useMemo(() => payouts.length > 0 ? payouts : fallbackPayouts, [payouts, tenant.id]);

  // Status tone based on payout status
  const getStatusTone = (status: string): "success" | "warning" | "info" | "danger" | "muted" => {
    switch (status) {
      case "paid": return "success";
      case "approved": return "info";
      case "processing": return "info";
      case "pending": return "warning";
      case "rejected": return "danger";
      default: return "muted";
    }
  };

  // Payment method icon
  const getMethodIcon = (method: string) => {
    const icons: Record<string, React.ComponentType> = {
      "bank-transfer": Banknote,
      "crypto": Bitcoin,
      "paypal": Eu,
      "skrill": Mail,
    };
    return icons[method] || Banknote;
  };

  return (
    <Card className="p-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">
          {t("payouts.title", defaultValue: "Payouts")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "payouts.subtitle",
            defaultValue: "Manage trader withdrawal requests",
            _: 0
          )}
        </p>
      </CardHeader>

      <CardContent>
        {/* Summary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Pending Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("payouts.pending", defaultValue: "Pending")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground warning">
                {displayedPayouts.filter((p: any) => p.status === "pending").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("payouts.pendingCount", defaultValue: "withdrawal requests")}
              </p>
            </CardContent>
          </Card>

          {/* Approved Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("payouts.approved", defaultValue: "Approved")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground info">
                {displayedPayouts.filter((p: any) => p.status === "approved").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("payouts.approvedCount", defaultValue: "approved requests")}
              </p>
            </CardContent>
          </Card>

          {/* Processing Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("payouts.processing", defaultValue: "Processing")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground info">
                {displayedPayouts.filter((p: any) => p.status === "processing").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("payouts.processingCount", defaultValue: "processing requests")}
              </p>
            </CardContent>
          </Card>

          {/* Rejected Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("payouts.rejected", defaultValue: "Rejected")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground danger">
                {displayedPayouts.filter((p: any) => p.status === "rejected").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("payouts.rejectedCount", defaultValue: "rejected requests")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payouts List */}
        <div className="space-y-3">
          {displayedPayouts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>{t("common.noRecords", defaultValue: "No payouts found")}</p>
              </CardContent>
            </Card>
          ) : (
            displayedPayouts.map((payout) => (
              <Card key={payout.id} className="p-3 border-b last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="h-3 w-3 rounded-full bg-primary-600" />
                      <span className="font-medium text-foreground truncate">
                        {payout.traderName}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t("payouts.account", defaultValue: "Account")}: {payout.traderId}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={getStatusTone(payout.status) as any}
                      className="h-3 w-3"
                    />
                    <span className="text-[10px] font-medium">
                      {payout.status}
                    </span>
                  </div>
                </div>

                {/* Amount and Method */}
                <div className="mt-2 flex items-baseline gap-3">
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      {formatCurrency(payout.amount, payout.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <getMethodIcon{payout.method as any} className="h-3.5 w-3.5" />
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {payout.method}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t("payouts.reference", defaultValue: "Reference")}: {payout.reference}
                  </span>
                  <span>
                    {t("payouts.created", defaultValue: "Created")}: {
                      /* Format date relative */ new Date(payout.createdAt).toLocaleDateString()
                    }
                  </span>
                </div>

                {/* Action buttons */}
                <div className="mt-3 pt-3 border-t">
                  {payout.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Approve payout
                          // toast({ title: "Payout Approved", description: `${payout.traderName}'s ${formatCurrency(payout.amount, payout.currency)} payout has been approved` });
                        }}
                      >
                        {t("common.approve", defaultValue: "Approve")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Reject payout
                          // toast({ title: "Payout Rejected", description: ` ${payout.traderName}'s payout has been rejected` });
                        }}
                      >
                        {t("common.reject", defaultValue: "Reject")}
                      </Button>
                    </div>
                  )}
                  {payout.status !== "paid" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // View details
                        // navigate(`payout-detail`, { payoutId: payout.id });
                        // toast({ title: "Payout Details", description: `View ${payout.traderName}'s payout details` });
                      }}
                    >
                      {t("common.view", defaultValue: "View")}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}