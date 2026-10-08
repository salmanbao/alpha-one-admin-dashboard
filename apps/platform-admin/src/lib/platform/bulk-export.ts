"use client";

/**
 * PFaaS Platform — Bulk Export Utility
 *
 * Exports all module data as a collection of JSON files bundled
 * into a single ZIP archive. Uses JSZip under the hood (dynamically
 * imported to keep the initial bundle small).
 *
 * Spec section 38 (export), §26 (data tables).
 */

import { toast } from "@/hooks/use-toast";
import type { ModuleRuntimeContext } from "@/lib/platform/types";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantChallenges,
  getTenantBreaches,
  getTenantPayouts,
  getTenantAffiliates,
  affiliateCampaigns,
  getTenantTransactions,
  getTenantCampaigns,
  getTenantContacts,
  getTenantKyc,
  getTenantTickets,
  getTenantAiInsights,
  getTenantAudit,
  revenueSeries,
  traderGrowthSeries,
  payoutSeries,
  riskDistribution,
  breachTrend,
} from "@/lib/platform/mock-data";
import { exportToCsv } from "./export-utils";

export interface ExportDataset {
  filename: string;
  label: string;
  data: unknown[];
}

/**
 * Collect all module data for the current tenant.
 */
export function collectAllData(ctx: ModuleRuntimeContext): ExportDataset[] {
  const tid = ctx.tenant?.id ?? "platform";
  const enabled = ctx.enabledModules;
  const datasets: ExportDataset[] = [];

  if (enabled.includes("trading")) {
    datasets.push({
      filename: "traders.json",
      label: "Traders",
      data: getTenantTraders(tid),
    });
    datasets.push({
      filename: "accounts.json",
      label: "Trading Accounts",
      data: getTenantAccounts(tid),
    });
    datasets.push({
      filename: "positions.json",
      label: "Open Positions",
      data: getTenantPositions(tid),
    });
  }

  if (enabled.includes("challenges")) {
    datasets.push({
      filename: "challenges.json",
      label: "Challenges",
      data: getTenantChallenges(tid),
    });
  }

  if (enabled.includes("risk")) {
    datasets.push({
      filename: "breaches.json",
      label: "Breaches",
      data: getTenantBreaches(tid),
    });
  }

  if (enabled.includes("payouts")) {
    datasets.push({
      filename: "payouts.json",
      label: "Payouts",
      data: getTenantPayouts(tid),
    });
  }

  if (enabled.includes("analytics")) {
    datasets.push({
      filename: "analytics-revenue.json",
      label: "Revenue Series",
      data: revenueSeries(tid),
    });
    datasets.push({
      filename: "analytics-trader-growth.json",
      label: "Trader Growth",
      data: traderGrowthSeries(tid),
    });
  }

  if (enabled.includes("affiliates")) {
    datasets.push({
      filename: "affiliates.json",
      label: "Affiliates",
      data: getTenantAffiliates(tid),
    });
    datasets.push({
      filename: "affiliate-campaigns.json",
      label: "Affiliate Campaigns",
      data: affiliateCampaigns.filter((c) => c.tenantId === tid),
    });
  }

  if (enabled.includes("accounting")) {
    datasets.push({
      filename: "transactions.json",
      label: "Transactions",
      data: getTenantTransactions(tid),
    });
  }

  if (enabled.includes("marketing")) {
    datasets.push({
      filename: "marketing-campaigns.json",
      label: "Marketing Campaigns",
      data: getTenantCampaigns(tid),
    });
  }

  if (enabled.includes("crm")) {
    datasets.push({
      filename: "crm-contacts.json",
      label: "CRM Contacts",
      data: getTenantContacts(tid),
    });
  }

  if (enabled.includes("kyc")) {
    datasets.push({
      filename: "kyc-records.json",
      label: "KYC Records",
      data: getTenantKyc(tid),
    });
  }

  if (enabled.includes("support")) {
    datasets.push({
      filename: "support-tickets.json",
      label: "Support Tickets",
      data: getTenantTickets(tid),
    });
  }

  if (enabled.includes("ai")) {
    datasets.push({
      filename: "ai-insights.json",
      label: "AI Insights",
      data: getTenantAiInsights(tid),
    });
  }

  // Always include audit log
  datasets.push({
    filename: "audit-log.json",
    label: "Audit Log",
    data: getTenantAudit(tid),
  });

  // Tenant config summary
  datasets.push({
    filename: "tenant-config.json",
    label: "Tenant Configuration",
    data: [{
      id: ctx.tenant?.id,
      name: ctx.tenant?.name,
      plan: ctx.tenant?.plan,
      currency: ctx.tenant?.currency,
      timezone: ctx.tenant?.timezone,
      enabledModules: ctx.enabledModules,
      enabledFeatures: ctx.enabledFeatures,
      branding: ctx.tenant?.branding,
    }],
  });

  return datasets;
}

/**
 * Export all datasets as a ZIP archive. Dynamically imports JSZip
 * to keep the initial bundle small.
 */
export async function exportAllAsZip(ctx: ModuleRuntimeContext): Promise<void> {
  const datasets = collectAllData(ctx);

  if (datasets.length === 0) {
    toast({
      title: "Nothing to export",
      description: "No module data available for the current tenant.",
      variant: "destructive",
    });
    return;
  }

  const totalRecords = datasets.reduce((s, d) => s + d.data.length, 0);

  try {
    // Dynamic import of JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add a README
    zip.file("README.txt",
`PFaaS Platform — Bulk Data Export
==================================

Tenant: ${ctx.tenant?.name ?? "Unknown"}
Exported: ${new Date().toISOString()}
Total datasets: ${datasets.length}
Total records: ${totalRecords}

Datasets:
${datasets.map((d) => `  - ${d.filename} (${d.data.length} records) — ${d.label}`).join("\n")}

This archive contains all module data for the current tenant.
Each file is in JSON format unless otherwise noted.
`);

    // Add each dataset
    for (const ds of datasets) {
      zip.file(ds.filename, JSON.stringify(ds.data, null, 2));
    }

    // Generate the ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pfaas-export-${ctx.tenant?.slug ?? "tenant"}-${new Date().toISOString().slice(0, 10)}.zip`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    toast({
      title: "Export complete",
      description: `${datasets.length} datasets (${totalRecords} records) exported as ZIP.`,
    });
  } catch {
    // Fallback: if JSZip isn't available, export as individual CSV files
    toast({
      title: "ZIP unavailable — exporting CSVs",
      description: "Exporting individual CSV files instead of ZIP.",
    });
    for (const ds of datasets.slice(0, 5)) {
      // Fallback: download first 5 datasets as CSV
      if (ds.data.length > 0 && typeof ds.data[0] === "object") {
        const keys = Object.keys(ds.data[0] as Record<string, unknown>);
        exportToCsv(
          ds.data as never[],
          keys.map((k) => ({ key: k, header: k, value: (r: Record<string, unknown>) => String(r[k] ?? "") })),
          ds.filename.replace(".json", ".csv"),
        );
      }
    }
  }
}
