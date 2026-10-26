"use client";

/** 
 * PFaaS Platform — KYC Reviews Page
 * Displays KYC records with review status and approval workflow
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { KycRecord } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTranslation } from "next-intl";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, Clock, ExclamationTriangle, FileText} from "lucide-react";

export function KycPage() {
  const { runtime, tenant, user } = usePlatform();
  const { t } = useTranslation();

  // Fetch KYC records for this tenant using seeded mock data
  const { data: tenantsKyc = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["kyc", tenant.id],
        queryFn: async () => {
          const allKyc = [];
          return allKyc.filter((k: any) => k.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded KYC data directly
  const kycRecords = useMemo(() => {
    // Seed KYC based on tenant
    const seeds: KycRecord[] = [];
    const tenantKyc = []; // Would pull from mock-data
    return tenantKyc.filter((k: any) => k.tenantId === tenant.id || k.tenantId === "platform");
  }, [tenant.id]);

  // Fallback seeded data if none fetched
  const fallbackKyc = useMemo(() => {
    const all: KycRecord[] = [
      {
        id: "kyc-tenant-alpha-1",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-1",
        traderName: "Sarah Chen",
        status: "approved",
        documentType: "passport",
        country: "US",
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
      },
      {
        id: "kyc-tenant-alpha-2",
        tenantId: "tenant-alpha",
        traderId: "trader-tenant-alpha-2",
        traderName: "Marcus Webb",
        status: "review",
        documentType: "driving-license",
        country: "GB",
        submittedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: undefined,
        riskLevel: "medium",
      },
      {
        id: "kyc-tenant-beta-1",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-1",
        traderName: "Tom Allen",
        status: "pending",
        documentType: "passport",
        country: "AE",
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: undefined,
        riskLevel: "low",
      },
      {
        id: "kyc-tenant-beta-2",
        tenantId: "tenant-beta",
        traderId: "trader-tenant-beta-3",
        traderName: "Elena Rossi",
        status: "pending",
        documentType: "national-id",
        country: "GB",
        submittedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: undefined,
        riskLevel: "high",
      },
      {
        id: "kyc-tenant-gamma-1",
        tenantId: "tenant-gamma",
        traderId: "trader-tenant-gamma-1",
        traderName: "Olivia Khan",
        status: "rejected",
        documentType: "passport",
        country: "US",
        submittedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "medium",
      },
      {
        id: "kyc-tenant-gamma-2",
        tenantId: "tenant-gamma",
        traderId: "trader-tenant-gamma-2",
        traderName: "Marcus Webb",
        status: "expired",
        documentType: "driving-license",
        country: "CA",
        submittedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: undefined,
        riskLevel: "high",
      },
    ];
    return all.filter((k: any) => k.tenantId === tenant.id || k.tenantId === "platform");
  }, [tenant.id]);

  const displayedKyc = useMemo(() => kycRecords.length > 0 ? kycRecords : fallbackKyc, [kycRecords, tenant.id]);

  // Status tone based on KYC status
  const getStatusTone = (status: string): "success" | "info" | "warning" | "danger" | "muted" => {
    switch (status) {
      case "approved": return "success";
      case "review": return "warning";
      case "pending": return "warning";
      case "rejected": return "danger";
      case "expired": return "danger";
      default: return "muted";
    }
  };

  // Risk level color
  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      low: "low",
      medium: "warning",
      high: "danger",
    };
    return colors[level] || "muted";
  };

  return (
    <Card className="p-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">
          {t("kyc.title", defaultValue: "KYC Reviews")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "kyc.subtitle",
            defaultValue: "Review and verify trader KYC documentation",
            _: 0
          )}
        </p>
      </CardHeader>

      <CardContent>
        {/* Summary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Approved Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("kyc.approved", defaultValue: "Approved")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground success">
                {displayedKyc.filter((k: any) => k.status === "approved").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("kyc.approvedCount", defaultValue: "verified traders")}
              </p>
            </CardContent>
          </Card>

          {/* Under Review Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("kyc.review", defaultValue: "Under Review")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground warning">
                {displayedKyc.filter((k: any) => k.status === "review" || k.status === "pending").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("kyc.reviewCount", defaultValue: "pending reviews")}
              </p>
            </CardContent>
          </Card>

          {/* Rejected Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("kyc.rejected", defaultValue: "Rejected")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground danger">
                {displayedKyc.filter((k: any) => k.status === "rejected").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("kyc.rejectedCount", defaultValue: "rejected applications")}
              </p>
            </CardContent>
          </Card>

          {/* Expired Card */}
          <Card className="p-4 h-full">
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">
                {t("kyc.expired", defaultValue: "Expired")}
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground danger">
                {displayedKyc.filter((k: any) => k.status === "expired").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("kyc.expiredCount", defaultValue: "expired records")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* KYC Records List */}
        <div className="space-y-3">
          {displayedKyc.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>{t("common.noRecords", defaultValue: "No KYC records found")}</p>
              </CardContent>
            </Card>
          ) : (
            displayedKyc.map((kyc) => (
              <Card key={kyc.id} className="p-3 border-b last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="h-3 w-3 rounded-full bg-success" />
                      <span className="font-medium text-foreground truncate">
                        {kyc.traderName}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t("kyc.traderId", defaultValue: "Trader ID")}: {kyc.traderId}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={getStatusTone(kyc.status) as any}
                      className="h-3 w-3"
                    />
                    <span className="text-[10px] font-medium">
                      {kyc.status}
                    </span>
                  </div>
                </div>

                {/* Document Info */}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <div>
                    <FileText className="h-3.5 w-3.5" /> {t("kyc.documentType", defaultValue: "Document")}: {kyc.documentType}
                  </div>
                  <div>
                    <Clock className="h-3.5 w-3.5" /> {t("kyc.submitted", defaultValue: "Submitted")}: {
                      /* Format date relative */ new Date(kyc.submittedAt).toLocaleDateString()
                    }
                  </div>
                </div>

                {/* Risk Level */}
                <div className="mt-2">
                  <p className="text-[10px] font-medium text-{getRiskColor(kyc.riskLevel)} mb-1">
                    {t("kyc.riskLevel", defaultValue: "Risk Level")}: {kyc.riskLevel}
                  </p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`bg-${getRiskColor(kyc.riskLevel)} rounded-full h-1.5 w-full`}
                      style={{ width: kyc.riskLevel === "low" ? "30%" : kyc.riskLevel === "medium" ? "60%" : "100%" }}
                    ></div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3 pt-3 border-t">
                  {kyc.status !== "approved" && kyc.status !== "rejected" && kyc.status !== "expired" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Approve KYC
                        // toast({ title: "KYC Approved", description: `${kyc.traderName}'s KYC has been approved` });
                      }}
                    >
                      {t("common.approve", defaultValue: "Approve")}
                    </Button>
                  )}
                  {kyc.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Request more documents
                        // toast({ title: "Documents Requested", description: `Additional documents requested for ${kyc.traderName}` });
                      }}
                    >
                      {t("common.request", defaultValue: "Request Docs")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // View details
                      // navigate(`kyc-detail`, { kycId: kyc.id });
                      // toast({ title: "KYC Details", description: `View ${kyc.traderName}'s KYC details` });
                    }}
                  >
                    {t("common.view", defaultValue: "View")}
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