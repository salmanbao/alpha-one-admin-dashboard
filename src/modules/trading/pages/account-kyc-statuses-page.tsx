"use client";

/**
 * Account KYC Statuses Page — per-provider KYC verification state for the
 * trader associated with a given trading account.
 *
 * Multi-provider KYC is the norm in prop firms: a trader may be verified
 * through one or more providers (MANUAL, VERIFF, SUMSUB, ONFIDO) and each
 * provider returns its own status. This page surfaces that matrix so
 * compliance and ops teams can see at a glance which providers are
 * cleared, which are still pending, and which need re-initiation.
 *
 * KYC statuses use `ExplainableStateBadge` (§17-19) so the meaning of each
 * state is one hover away.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts, getTenantKyc, type KycRecord } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard, EntityHeader } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  FileCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Mock per-provider KYC data                                         */
/* ------------------------------------------------------------------ */

type KycProviderName = "MANUAL" | "VERIFF" | "SUMSUB" | "ONFIDO";
type KycProviderStatusName = "approved" | "pending" | "review" | "rejected" | "expired";

interface KycProviderStatus {
  provider: KycProviderName;
  status: KycProviderStatusName;
  lastCheckedAt: string;
  documentsCount: number;
}

const ALL_PROVIDERS: KycProviderName[] = ["MANUAL", "VERIFF", "SUMSUB", "ONFIDO"];

/**
 * Deterministically derive per-provider KYC statuses for a trader from
 * the trader's existing KYC record (or fallback to a default). The seed
 * is the KycRecord id, so the demo is stable across reloads.
 */
function deriveProviderKyc(kyc: KycRecord | undefined): KycProviderStatus[] {
  if (!kyc) {
    // No KYC record → all providers pending
    const lastChecked = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return ALL_PROVIDERS.map((p) => ({
      provider: p,
      status: "pending" as const,
      lastCheckedAt: lastChecked,
      documentsCount: 0,
    }));
  }
  // Seed from the numeric part of the kyc id (kyc-tenant-alpha-3 → 3)
  const seedMatch = kyc.id.match(/(\d+)$/);
  const seed = seedMatch ? parseInt(seedMatch[1], 10) : 1;
  return ALL_PROVIDERS.map((p, i) => {
    // Deterministic pseudo-random distribution across statuses
    const v = (seed + i * 7) % 5;
    const status: KycProviderStatusName =
      v === 0 ? "approved" : v === 1 ? "pending" : v === 2 ? "review" : v === 3 ? "approved" : "rejected";
    const lastCheckedHoursAgo = (seed + i * 11) % 96;
    const documentsCount = (seed + i) % 4;
    return {
      provider: p,
      status,
      lastCheckedAt: new Date(Date.now() - lastCheckedHoursAgo * 60 * 60 * 1000).toISOString(),
      documentsCount,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountKycStatusesPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const traderKyc = useMemo(() => {
    if (!account) return undefined;
    return getTenantKyc(tid).find((k) => k.traderId === account.traderId);
  }, [tid, account]);

  const providers = useMemo(
    () => deriveProviderKyc(traderKyc),
    [traderKyc],
  );

  if (!account) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-accounts")} className="w-fit">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </Page>
    );
  }

  // KPI roll-up
  const total = providers.length;
  const verified = providers.filter((p) => p.status === "approved").length;
  const pending = providers.filter(
    (p) => p.status === "pending" || p.status === "review",
  ).length;
  const rejected = providers.filter(
    (p) => p.status === "rejected" || p.status === "expired",
  ).length;

  const reinitiate = (provider: KycProviderName) => {
    toast({
      title: "KYC re-initiated",
      description: `A new verification session was started for ${provider}.`,
    });
  };

  const verify = (provider: KycProviderName) => {
    toast({
      title: "Provider marked as verified",
      description: `${provider} status set to approved.`,
    });
  };

  const reject = (provider: KycProviderName) => {
    toast({
      title: "Provider rejected",
      description: `${provider} status set to rejected.`,
      variant: "destructive",
    });
  };

  const addProvider = () => {
    toast({
      title: "Add KYC provider",
      description: "Open the provider marketplace to configure a new KYC source.",
    });
  };

  const columns: Column<KycProviderStatus>[] = [
    {
      key: "provider",
      header: "Provider",
      cell: (row) => (
        <span className="font-mono text-xs font-medium uppercase tracking-wide">
          {row.provider}
        </span>
      ),
      sortValue: (row) => row.provider,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <ExplainableStateBadge status={row.status} entityType="kyc" />,
      sortValue: (row) => row.status,
    },
    {
      key: "documentsCount",
      header: "Documents",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {row.documentsCount}
        </Badge>
      ),
      sortValue: (row) => row.documentsCount,
      numeric: true,
    },
    {
      key: "lastCheckedAt",
      header: "Last Checked",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.lastCheckedAt).toLocaleString()}
        </span>
      ),
      sortValue: (row) => row.lastCheckedAt,
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => reinitiate(row.provider)}
          >
            <RefreshCw className="h-3 w-3" /> Re-initiate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]">
                More <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => reinitiate(row.provider)}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-initiate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => verify(row.provider)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Verify
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => reject(row.provider)}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("trader-detail", { id: account.traderId })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to trader
      </Button>

      <PageHeader
        title="Account KYC Statuses"
        description={`Per-provider KYC verification state for ${account.traderName}.`}
        icon={FileCheck}
        actions={
          <Button size="sm" onClick={addProvider} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add KYC Provider
          </Button>
        }
      />

      <EntityHeader
        title={account.traderName}
        subtitle={`Login ${account.login} · ${account.platform}`}
        badges={
          <>
            <Badge variant="outline" className="text-[10px]">{account.phase}</Badge>
            {traderKyc ? (
              <ExplainableStateBadge status={traderKyc.status} entityType="kyc" />
            ) : (
              <Badge variant="outline" className="text-[10px]">No KYC</Badge>
            )}
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total Providers"
          value={total}
          icon={Users}
        />
        <MetricCard
          label="Verified"
          value={verified}
          tone="positive"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Pending"
          value={pending}
          tone="warning"
          icon={Clock}
        />
        <MetricCard
          label="Rejected"
          value={rejected}
          tone={rejected > 0 ? "negative" : "default"}
          icon={XCircle}
        />
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            KYC Providers
          </p>
          <DataTable
            columns={columns}
            data={providers}
            rowKey={(row) => row.provider}
            pageSize={10}
            searchableText={(row) => `${row.provider} ${row.status}`}
            searchPlaceholder="Search providers…"
          />
        </div>

        {/* Inline help footer */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span>{" "}
          Re-initiating a KYC provider starts a fresh verification session and
          invalidates the previous session URL. The trader will receive a new
          email inviting them to complete verification.
        </div>
      </PageContent>
    </Page>
  );
}
