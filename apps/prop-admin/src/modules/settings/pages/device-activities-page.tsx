"use client";

/**
 * Device Activities Page — login device history and fingerprint tracking.
 *
 * Spec sections 12, 25, 27 (Settings module). Lists every unique device
 * fingerprint that has logged into a trader account. Used by ops / risk
 * teams to detect shared access, multi-account logins, and fraud.
 *
 * Layout:
 *  - PageHeader: "Device Activities" + description
 *  - Collapsible "Device Activity Guide" info banner (collapsed by
 *    default — explains the value of the view)
 *  - KPI row: Total Devices, Unique IPs, Mobile Devices, Desktop
 *    Devices, Most Active Country
 *  - Filter bar: search + filter by source / device type / platform +
 *    date range + clear button
 *  - DataTable: Source, Device ID, IP Address, Device Type, Platform,
 *    Country, First Seen, Last Seen, Login Count, Actions
 *  - "Export CSV" button
 *  - Empty state
 *
 * Pre-seeded with deterministic device fingerprints based on the
 * tenant's traders (so each tenant sees a different set).
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders } from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Fingerprint,
  Trash2,
  Download,
  Filter,
  X,
  Info,
  ChevronDown,
  Activity,
  Wifi,
  MapPin,
  Clock,
  Hash,
  Eye,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & static option pools                                         */
/* ------------------------------------------------------------------ */

type Source = "Web" | "Mobile" | "API";
type DeviceType = "Desktop" | "Mobile" | "Tablet";
type PlatformOS = "Windows" | "macOS" | "iOS" | "Android";

const SOURCES: Source[] = ["Web", "Mobile", "API"];
const DEVICE_TYPES: DeviceType[] = ["Desktop", "Mobile", "Tablet"];
const PLATFORMS: PlatformOS[] = ["Windows", "macOS", "iOS", "Android"];

const COUNTRIES: Array<[string, string]> = [
  // [code, name]
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["IN", "India"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
];

const PLATFORM_OS_BY_DEVICE: Record<DeviceType, PlatformOS[]> = {
  Desktop: ["Windows", "macOS"],
  Mobile: ["iOS", "Android"],
  Tablet: ["iOS", "Android"],
};

const SOURCE_TONES: Record<Source, "info" | "success" | "muted"> = {
  Web: "info",
  Mobile: "success",
  API: "muted",
};

const DEVICE_TONES: Record<DeviceType, "info" | "success" | "warning"> = {
  Desktop: "info",
  Mobile: "success",
  Tablet: "warning",
};

const PLATFORM_TONES: Record<PlatformOS, "info" | "success" | "warning" | "muted"> = {
  Windows: "info",
  macOS: "success",
  iOS: "warning",
  Android: "muted",
};

interface DeviceActivity {
  id: string;
  source: Source;
  deviceId: string;
  ipAddress: string;
  deviceType: DeviceType;
  platform: PlatformOS;
  country: string;
  firstSeen: string;
  lastSeen: string;
  loginCount: number;
}

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/* ------------------------------------------------------------------ */
/* Deterministic seed data                                            */
/* ------------------------------------------------------------------ */

/** Deterministic pseudo-random generator from a numeric seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

/** Hash a string to a stable integer seed. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Build a deterministic device fingerprint hash (40-char hex-like). */
function buildDeviceHash(seed: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  let s = seed;
  for (let i = 0; i < 40; i++) {
    s = (s * 31 + i + 7) | 0;
    out += chars[Math.abs(s) % 16];
  }
  return out;
}

function seedActivities(tenantId: string): DeviceActivity[] {
  const traders = getTenantTraders(tenantId);
  if (traders.length === 0) return [];

  const now = Date.now();
  // Generate ~1.5× traders worth of activities so the table feels full.
  const count = Math.max(8, Math.round(traders.length * 1.5));
  const out: DeviceActivity[] = [];
  for (let i = 0; i < count; i++) {
    const s = hashSeed(`${tenantId}-device-${i}`);
    const source = SOURCES[s % SOURCES.length];
    const deviceType: DeviceType =
      DEVICE_TYPES[s % DEVICE_TYPES.length];
    const platform =
      PLATFORM_OS_BY_DEVICE[deviceType][s % PLATFORM_OS_BY_DEVICE[deviceType].length];
    const country = COUNTRIES[s % COUNTRIES.length][0];
    const deviceHash = buildDeviceHash(s);
    const ip = `${10 + (s % 200)}.${(s * 7) % 255}.${(s * 13) % 255}.${(s * 17) % 255}`;

    // First seen: deterministic window in the past 180 days
    const firstMsAgo = Math.floor((1 + seededRandom(s) * 180 * 24 * 60)) * 60 * 1000;
    // Last seen: between first seen and now
    const lastMsAgo = Math.floor(seededRandom(s + 1) * firstMsAgo);
    const firstSeen = new Date(now - firstMsAgo).toISOString();
    const lastSeen = new Date(now - lastMsAgo).toISOString();

    const loginCount = 1 + (s % 240);

    out.push({
      id: `dev-${tenantId}-${i + 1}`,
      source,
      deviceId: deviceHash,
      ipAddress: ip,
      deviceType,
      platform,
      country,
      firstSeen,
      lastSeen,
      loginCount,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncate(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function countryName(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DeviceActivitiesPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const [activities, setActivities] = useState<DeviceActivity[]>(() =>
    seedActivities(tid),
  );
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [guideOpen, setGuideOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return activities.filter((a) => {
      if (cutoff > 0 && new Date(a.lastSeen).getTime() < cutoff) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      if (deviceFilter !== "all" && a.deviceType !== deviceFilter) return false;
      if (platformFilter !== "all" && a.platform !== platformFilter) return false;
      if (
        q &&
        !`${a.deviceId} ${a.ipAddress} ${a.country} ${countryName(a.country)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [activities, search, sourceFilter, deviceFilter, platformFilter, dateRange]);

  // KPI roll-ups — derived from the full unfiltered set so they reflect
  // the tenant's actual device footprint.
  const totalDevices = activities.length;
  const uniqueIps = new Set(activities.map((a) => a.ipAddress)).size;
  const mobileDevices = activities.filter((a) => a.deviceType === "Mobile").length;
  const desktopDevices = activities.filter((a) => a.deviceType === "Desktop").length;
  const countryCounts = COUNTRIES.map(([code]) => ({
    code,
    count: activities.filter((a) => a.country === code).length,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const mostActiveCountry =
    countryCounts.length > 0 ? countryCounts[0] : null;

  const activeFilters =
    (search ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (deviceFilter !== "all" ? 1 : 0) +
    (platformFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("all");
    setDeviceFilter("all");
    setPlatformFilter("all");
    setDateRange("all");
  };

  const handleDelete = (row: DeviceActivity) => {
    setActivities((prev) => prev.filter((a) => a.id !== row.id));
    toast({
      title: "Device removed",
      description: `Fingerprint ${truncate(row.deviceId, 12)} was removed from the device history.`,
    });
  };

  const handleRowClick = (row: DeviceActivity) => {
    toast({
      title: "Viewing device detail",
      description: `Opening detail for ${truncate(row.deviceId, 12)} (${row.ipAddress}).`,
    });
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "source", header: "Source", value: (a) => a.source },
        { key: "deviceId", header: "Device ID", value: (a) => a.deviceId },
        { key: "ipAddress", header: "IP Address", value: (a) => a.ipAddress },
        { key: "deviceType", header: "Device Type", value: (a) => a.deviceType },
        { key: "platform", header: "Platform", value: (a) => a.platform },
        { key: "country", header: "Country", value: (a) => a.country },
        { key: "firstSeen", header: "First Seen", value: (a) => a.firstSeen },
        { key: "lastSeen", header: "Last Seen", value: (a) => a.lastSeen },
        { key: "loginCount", header: "Login Count", value: (a) => a.loginCount },
      ],
      `device-activities-${tid}.csv`,
    );
  };

  const columns: Column<DeviceActivity>[] = [
    {
      key: "source",
      header: "Source",
      cell: (a) => (
        <StatusBadge tone={SOURCE_TONES[a.source]}>{a.source}</StatusBadge>
      ),
      sortValue: (a) => a.source,
    },
    {
      key: "deviceId",
      header: "Device ID",
      cell: (a) => (
        <span
          className="font-mono text-xs text-muted-foreground"
          title={a.deviceId}
        >
          {truncate(a.deviceId, 16)}
        </span>
      ),
      sortValue: (a) => a.deviceId,
    },
    {
      key: "ipAddress",
      header: "IP Address",
      cell: (a) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <Wifi className="h-3 w-3 text-muted-foreground" />
          {a.ipAddress}
        </span>
      ),
      sortValue: (a) => a.ipAddress,
    },
    {
      key: "deviceType",
      header: "Device Type",
      cell: (a) => {
        const Icon =
          a.deviceType === "Desktop"
            ? Monitor
            : a.deviceType === "Mobile"
            ? Smartphone
            : Tablet;
        return (
          <StatusBadge tone={DEVICE_TONES[a.deviceType]}>
            <span className="inline-flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {a.deviceType}
            </span>
          </StatusBadge>
        );
      },
      sortValue: (a) => a.deviceType,
    },
    {
      key: "platform",
      header: "Platform",
      cell: (a) => (
        <StatusBadge tone={PLATFORM_TONES[a.platform]}>{a.platform}</StatusBadge>
      ),
      sortValue: (a) => a.platform,
    },
    {
      key: "country",
      header: "Country",
      cell: (a) => (
        <Badge variant="outline" className="gap-1 text-[10px]">
          <MapPin className="h-3 w-3" />
          {a.country}
        </Badge>
      ),
      sortValue: (a) => a.country,
    },
    {
      key: "firstSeen",
      header: "First Seen",
      cell: (a) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(a.firstSeen).toLocaleString()}
        </span>
      ),
      sortValue: (a) => a.firstSeen,
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      cell: (a) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(a.lastSeen).toLocaleString()}
        </span>
      ),
      sortValue: (a) => a.lastSeen,
    },
    {
      key: "loginCount",
      header: "Login Count",
      cell: (a) => (
        <span className="tabular-nums text-xs font-medium">{a.loginCount}</span>
      ),
      sortValue: (a) => a.loginCount,
      numeric: true,
    },
    {
      key: "actions",
      header: "",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(a);
            }}
            aria-label={`View device ${truncate(a.deviceId, 12)}`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="sr-only">View</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Delete device ${truncate(a.deviceId, 12)}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove device record?</AlertDialogTitle>
                <AlertDialogDescription>
                  The fingerprint {truncate(a.deviceId, 12)} ({a.ipAddress})
                  will be removed from the device history. The next time this
                  device logs in, a new fingerprint entry will be created.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800",
                  )}
                  onClick={() => handleDelete(a)}
                >
                  Remove device
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
      width: "100px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Device Activities"
        description="Login device history and fingerprint tracking"
        icon={Fingerprint}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* Device Activity Guide — collapsible info banner */}
      <Collapsible
        open={guideOpen}
        onOpenChange={setGuideOpen}
        className="rounded-lg border bg-muted/20"
      >
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
          aria-expanded={guideOpen}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            Device Activity Guide
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              guideOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-3 text-sm text-muted-foreground">
            <p>
              This view tracks unique device fingerprints used to access
              trader accounts. Multiple logins from the same device may
              indicate shared access.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              <li className="inline-flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                <strong>Device ID</strong> is a hash derived from the
                browser/user-agent + IP fingerprint.
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                <strong>Login Count</strong> reflects the number of successful
                logins from this fingerprint.
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                <strong>Country</strong> is resolved via GeoIP from the
                customer IP address.
              </li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total Devices" value={totalDevices} icon={Fingerprint} />
        <MetricCard label="Unique IPs" value={uniqueIps} icon={Wifi} />
        <MetricCard label="Mobile Devices" value={mobileDevices} icon={Smartphone} tone="positive" />
        <MetricCard label="Desktop Devices" value={desktopDevices} icon={Monitor} tone="default" />
        <MetricCard
          label="Most Active Country"
          value={
            mostActiveCountry
              ? `${mostActiveCountry.code} (${mostActiveCountry.count})`
              : "—"
          }
          icon={MapPin}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {activeFilters}
            </Badge>
          ) : null}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search device ID, IP, country…"
          className="h-8 w-64 text-xs"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by device type"
        >
          <option value="all">All device types</option>
          {DEVICE_TYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by platform"
        >
          <option value="all">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        {activeFilters > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {activities.length} devices
        </span>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card">
          {activities.length === 0 ? (
            <EmptyState
              icon={Fingerprint}
              title="No device activities recorded"
              description="No device activities recorded. Device fingerprints will appear here when traders log in."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(a) => a.id}
              onRowClick={handleRowClick}
              pageSize={10}
              emptyTitle="No device activities match your filters"
              emptyDescription="Try widening the date range or clearing some filters."
            />
          )}
        </div>
      </PageContent>
    </Page>
  );
}
