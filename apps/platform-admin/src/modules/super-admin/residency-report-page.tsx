"use client";

/**
 * Data Residency — R9 W6 UC-P6.
 *
 * Read-only report of where each tenant's data lives, derived from the
 * tenant's `region` pin plus the platform's data-class map:
 *
 *   • `payments` / `kyc` follow the tenant's pinned region (or the
 *     honest default region when the tenant is unpinned);
 *   • `trading` mirrors to the execution region for fill latency, so it
 *     deliberately does NOT follow the pin.
 *
 * The page never mutates anything — it reads `useTenants()` (the same
 * store every other platform surface reads) and `dataLocationFor()`, so
 * a tenant pinned or created at runtime shows up here immediately and
 * an unpinned tenant is labeled "Unpinned" rather than defaulted
 * silently.
 *
 * Honest-demo labeling: the mapping policy card and the footer both
 * carry (Demo) labels — this demo does not move real data.
 */

import { useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import {
  useTenants,
  DATA_CLASSES,
  DATA_CLASS_MAP,
  dataLocationFor,
  type DataClass,
} from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import { Globe, MapPin, Layers, ShieldCheck, AlertTriangle } from "lucide-react";

interface ResidencyRow {
  tenantId: string;
  name: string;
  plan: string;
  /** Explicit pin — undefined means the tenant is honestly "Unpinned". */
  region?: string;
  locations: Record<DataClass, { location: string; pinned: boolean }>;
  /** True only when every pin-following class sits in an explicit pin. */
  pinned: boolean;
}

export function ResidencyReportPage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 350 }), []);

  const tenants = useTenants();

  /* Rows are derived live from the tenant store — never hand-entered. */
  const rows = useMemo<ResidencyRow[]>(
    () =>
      tenants
        // The platform pseudo-tenant is a billing entity, not a firm.
        .filter((t) => t.id !== "platform")
        .map((t: TenantContext) => {
          const locations = {} as ResidencyRow["locations"];
          for (const cls of DATA_CLASSES) locations[cls] = dataLocationFor(t, cls);
          return {
            tenantId: t.id,
            name: t.name,
            plan: t.plan,
            ...(t.region ? { region: t.region } : {}),
            locations,
            pinned: Boolean(t.region),
          };
        }),
    [tenants],
  );

  const stats = useMemo(() => {
    const pinned = rows.filter((r) => r.pinned);
    const regions = new Set(pinned.map((r) => r.region));
    return {
      total: rows.length,
      pinned: pinned.length,
      unpinned: rows.length - pinned.length,
      regions: regions.size,
      regionList: [...regions].sort(),
      classes: DATA_CLASSES.length,
    };
  }, [rows]);

  const columns: Column<ResidencyRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div>
          <p className="text-sm font-medium">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{r.tenantId}</p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "pin",
      header: "Region pin",
      cell: (r) =>
        r.region ? (
          <span className="flex items-center gap-1 text-xs font-medium">
            <MapPin className="h-3 w-3 text-emerald-600" aria-hidden />
            {r.region}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unpinned</span>
        ),
      sortValue: (r) => r.region ?? "",
    },
    ...DATA_CLASSES.map(
      (cls): Column<ResidencyRow> => ({
        key: cls,
        header: DATA_CLASS_MAP[cls].label,
        cell: (r) => {
          const loc = r.locations[cls];
          const policy = DATA_CLASS_MAP[cls];
          const note = (policy as any).followsPin
            ? loc.pinned
              ? "pinned"
              : "default region"
            : "execution mirror";
          return (
            <div>
              <p className="text-xs font-medium">{loc.location}</p>
              <p className="text-[10px] text-muted-foreground">{note}</p>
            </div>
          );
        },
        sortValue: (r) => r.locations[cls].location,
      }),
    ),
    {
      key: "status",
      header: "Pin status",
      cell: (r) => (
        <StatusBadge tone={r.pinned ? "success" : "warning"}>
          {r.pinned ? "pinned" : "unpinned"}
        </StatusBadge>
      ),
      sortValue: (r) => (r.pinned ? 0 : 1),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Data Residency"
        description="Where each tenant's payments, KYC and trading data lives — derived from the tenant's region pin and the platform data-class map (Demo)."
        icon={Globe}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading residency report…"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Tenants pinned"
              value={`${stats.pinned} / ${stats.total}`}
              icon={ShieldCheck}
              tone={stats.unpinned === 0 ? "positive" : "warning"}
            />
            <MetricCard
              label="Unpinned tenants"
              value={String(stats.unpinned)}
              icon={AlertTriangle}
              tone={stats.unpinned === 0 ? "positive" : "warning"}
            />
            <MetricCard
              label="Regions in use"
              value={String(stats.regions)}
              icon={Globe}
            />
            <MetricCard
              label="Data classes tracked"
              value={String(stats.classes)}
              icon={Layers}
            />
          </div>

          <DataTable<ResidencyRow>
            columns={columns}
            data={rows}
            rowKey={(r) => r.tenantId}
            searchableText={(r) => `${r.name} ${r.tenantId} ${r.region ?? "unpinned"}`}
            searchPlaceholder="Search tenants or regions…"
            pageSize={10}
            emptyTitle="No tenants"
            emptyDescription="No tenants on the roster yet."
          />

          {/* Data-class map — the published policy the columns above apply. */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold">
                Data-class map (Demo policy)
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {DATA_CLASSES.map((cls) => {
                const policy = DATA_CLASS_MAP[cls];
                return (
                  <p key={cls}>
                    <span className="font-medium text-foreground">
                      {policy.label}:
                    </span>{" "}
                    {(policy as any).note}{" "}
                    {(policy as any).followsPin ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        follows pin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        does not follow pin
                      </Badge>
                    )}
                  </p>
                );
              })}
              <p>
                <span className="font-medium text-foreground">Unpinned tenants:</span>{" "}
                pin-following classes fall back to the platform default region
                and the tenant is labeled “Unpinned” — the default is shown
                explicitly, never implied.
              </p>
              {stats.regionList.length > 0 ? (
                <p>
                  <span className="font-medium text-foreground">
                    Regions in use:
                  </span>{" "}
                  {stats.regionList.join(", ")}.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              simulated mapping (Demo) — no data is moved; rows derive live
              from each tenant&apos;s stored region pin.
            </span>
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
