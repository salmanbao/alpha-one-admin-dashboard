"use client";

/**
 * Account IP Addresses Page — IP address log with create/edit inline form.
 *
 * Each row is one IP-record-per-account-per-event. By default the list
 * shows the most recent IP per account (collapsible guide explains this).
 * Risk operators use this view to spot VPN/proxy hosting patterns, shared
 * IPs across accounts (linkage risk), and to record manual IP allowlists.
 *
 * Layout: collapsible guide banner → KPI row → filter bar (search, country,
 * proxy status) → DataTable (Account, Status, Phase, Challenge, IP, City,
 * Country, Is Proxy / Hosting / Mobile badges, Created) → inline add form
 * (Account dropdown, IP, City, Country, Lat/Lng, Is Proxy/Hosting/Mobile
 * tri-state dropdowns, Save / Cancel).
 *
 * Mock data: deterministic IPv4 generation per account index, plus city /
 * country derived from the trader's country code. No Math.random.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import {
  getTenantAccounts,
  getTenantTraders,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  Server,
  Smartphone,
  MapPin,
  Plus,
  Download,
  Filter,
  X,
  Search,
  Save,
  Info,
  ChevronDown,
  Network,
  ShieldAlert,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type TriState = "unknown" | "yes" | "no";

interface IpRecord {
  id: string;
  tenantId: string;
  accountId: string;
  accountLogin: string;
  traderId: string;
  traderName: string;
  status: TradingAccount["status"];
  phase: TradingAccount["phase"];
  challenge: string;
  ipAddress: string;
  city: string;
  country: string;
  isProxy: TriState;
  isHosting: TriState;
  isMobile: TriState;
  createdAt: string;
  latitude: number;
  longitude: number;
}

/** City/country lookup for trader country codes (deterministic). */
const COUNTRY_INFO: Record<string, { city: string; country: string }> = {
  US: { city: "New York", country: "United States" },
  GB: { city: "London", country: "United Kingdom" },
  AE: { city: "Dubai", country: "United Arab Emirates" },
  SG: { city: "Singapore", country: "Singapore" },
  DE: { city: "Frankfurt", country: "Germany" },
  FR: { city: "Paris", country: "France" },
  BR: { city: "São Paulo", country: "Brazil" },
  IN: { city: "Mumbai", country: "India" },
  ZA: { city: "Johannesburg", country: "South Africa" },
  CA: { city: "Toronto", country: "Canada" },
  AU: { city: "Sydney", country: "Australia" },
  JP: { city: "Tokyo", country: "Japan" },
  PK: { city: "Karachi", country: "Pakistan" },
  NG: { city: "Lagos", country: "Nigeria" },
};

const CHALLENGE_NAMES = [
  "2 step Gen Z",
  "1 step Turbo",
  "Instant Standard",
  "3 step Pro",
  "Instant Funded",
  "Free Trial",
  "Competition",
];

function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Build a deterministic IP record list from tenant accounts. */
function buildIpRecords(tenantId: string): IpRecord[] {
  const accounts = getTenantAccounts(tenantId);
  const traders = getTenantTraders(tenantId);
  const traderById = new Map(traders.map((t) => [t.id, t]));
  const now = Date.now();

  return accounts.map((acct, idx) => {
    const trader = traderById.get(acct.traderId);
    const countryCode = trader?.country ?? "US";
    const countryInfo = COUNTRY_INFO[countryCode] ?? COUNTRY_INFO.US;
    // Deterministic IPv4: 192.168.(idx % 200).(idx % 255)
    const octet3 = (idx * 7 + 11) % 200;
    const octet4 = (idx * 13 + 23) % 255;
    const ip = idx % 5 === 0
      ? `203.0.${113 + (idx % 50)}.${(idx * 17 + 5) % 255}` // a hosting-looking IP for variety
      : `192.168.${octet3}.${octet4}`;

    // Tri-state for proxy / hosting / mobile — deterministic
    const seed = hashStr(`${acct.id}-${ip}`);
    const isProxy: TriState = seed % 7 === 0 ? "yes" : seed % 11 === 0 ? "unknown" : "no";
    const isHosting: TriState = idx % 5 === 0 ? "yes" : idx % 9 === 0 ? "unknown" : "no";
    const isMobile: TriState = idx % 6 === 4 ? "yes" : idx % 13 === 0 ? "unknown" : "no";

    const challenge = CHALLENGE_NAMES[idx % CHALLENGE_NAMES.length];
    const createdAtMs = now - ((idx % 30) + 1) * 24 * 60 * 60 * 1000 - (idx % 7) * 60 * 60 * 1000;
    const latitude = 30 + (seed % 30);
    const longitude = -120 + (seed % 240);

    return {
      id: `ip-${acct.id}-1`,
      tenantId,
      accountId: acct.id,
      accountLogin: acct.login,
      traderId: acct.traderId,
      traderName: acct.traderName,
      status: acct.status,
      phase: acct.phase,
      challenge,
      ipAddress: ip,
      city: countryInfo.city,
      country: countryInfo.country,
      isProxy,
      isHosting,
      isMobile,
      createdAt: new Date(createdAtMs).toISOString(),
      latitude,
      longitude,
    };
  });
}

function triStateBadge(v: TriState): { label: string; tone: "success" | "warning" | "muted" } {
  if (v === "yes") return { label: "Yes", tone: "warning" };
  if (v === "no") return { label: "No", tone: "success" };
  return { label: "Unknown", tone: "muted" };
}

const PROXY_STATUS_OPTIONS = [
  { value: "all", label: "All proxy states" },
  { value: "yes", label: "Proxy: Yes" },
  { value: "no", label: "Proxy: No" },
  { value: "unknown", label: "Proxy: Unknown" },
];

const TRI_STATE_OPTIONS: TriState[] = ["unknown", "yes", "no"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountIpAddressesPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";

  const allRecords = useMemo(() => buildIpRecords(tid), [tid]);
  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);

  // Filters
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [proxyFilter, setProxyFilter] = useState<string>("all");
  const [guideOpen, setGuideOpen] = useState(true);

  // Add-IP form state
  const [showForm, setShowForm] = useState(false);
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formIp, setFormIp] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formIsProxy, setFormIsProxy] = useState<TriState>("unknown");
  const [formIsHosting, setFormIsHosting] = useState<TriState>("unknown");
  const [formIsMobile, setFormIsMobile] = useState<TriState>("unknown");

  const countriesAvailable = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.country))).sort(),
    [allRecords],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecords.filter((r) => {
      if (countryFilter !== "all" && r.country !== countryFilter) return false;
      if (proxyFilter !== "all" && r.isProxy !== proxyFilter) return false;
      if (
        q &&
        !`${r.accountLogin} ${r.traderName} ${r.ipAddress} ${r.city} ${r.country}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [allRecords, search, countryFilter, proxyFilter]);

  // KPI roll-ups from unfiltered set
  const totalIps = allRecords.length;
  const uniqueAccounts = new Set(allRecords.map((r) => r.accountId)).size;
  const proxyIps = allRecords.filter((r) => r.isProxy === "yes").length;
  const hostingIps = allRecords.filter((r) => r.isHosting === "yes").length;
  const mobileIps = allRecords.filter((r) => r.isMobile === "yes").length;

  const activeFilters =
    (search ? 1 : 0) +
    (countryFilter !== "all" ? 1 : 0) +
    (proxyFilter !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setCountryFilter("all");
    setProxyFilter("all");
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "login", header: "Account Login", value: (r) => r.accountLogin },
        { key: "trader", header: term("trader"), value: (r) => r.traderName },
        { key: "status", header: "Account Status", value: (r) => r.status },
        { key: "phase", header: "Phase", value: (r) => r.phase },
        { key: "challenge", header: term("challenge"), value: (r) => r.challenge },
        { key: "ip", header: "IP Address", value: (r) => r.ipAddress },
        { key: "city", header: "City", value: (r) => r.city },
        { key: "country", header: "Country", value: (r) => r.country },
        { key: "isProxy", header: "Is Proxy", value: (r) => r.isProxy },
        { key: "isHosting", header: "Is Hosting", value: (r) => r.isHosting },
        { key: "isMobile", header: "Is Mobile", value: (r) => r.isMobile },
        { key: "latitude", header: "Latitude", value: (r) => r.latitude },
        { key: "longitude", header: "Longitude", value: (r) => r.longitude },
        { key: "createdAt", header: "Created", value: (r) => r.createdAt },
      ],
      `account-ip-addresses-${tid}.csv`,
    );
  };

  const resetForm = () => {
    setFormAccountId("");
    setFormIp("");
    setFormCity("");
    setFormCountry("");
    setFormLat("");
    setFormLng("");
    setFormIsProxy("unknown");
    setFormIsHosting("unknown");
    setFormIsMobile("unknown");
  };

  const onSave = () => {
    if (!formAccountId || !formIp) {
      toast({
        title: "Account and IP required",
        description: "Pick an account and enter the IP address before saving.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "IP address saved",
      description: "The IP record has been added to the account's history.",
    });
    setShowForm(false);
    resetForm();
  };

  const columns: Column<IpRecord>[] = [
    {
      key: "login",
      header: "Account",
      cell: (r) => (
        <button
          type="button"
          onClick={() => navigate("trader-detail", { id: r.traderId })}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {r.accountLogin}
        </button>
      ),
      sortValue: (r) => r.accountLogin,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge
          tone={
            r.status === "active"
              ? "success"
              : r.status === "breached"
                ? "danger"
                : r.status === "passed"
                  ? "info"
                  : "warning"
          }
        >
          {r.status}
        </StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "phase",
      header: "Phase",
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.phase}
        </Badge>
      ),
      sortValue: (r) => r.phase,
    },
    {
      key: "challenge",
      header: term("challenge"),
      cell: (r) => <span className="text-xs">{r.challenge}</span>,
      sortValue: (r) => r.challenge,
    },
    {
      key: "ip",
      header: "IP Address",
      cell: (r) => <span className="font-mono text-xs">{r.ipAddress}</span>,
      sortValue: (r) => r.ipAddress,
    },
    {
      key: "city",
      header: "City",
      cell: (r) => <span className="text-xs">{r.city}</span>,
      sortValue: (r) => r.city,
    },
    {
      key: "country",
      header: "Country",
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.country}
        </Badge>
      ),
      sortValue: (r) => r.country,
    },
    {
      key: "isProxy",
      header: "Is Proxy",
      cell: (r) => {
        const { label, tone } = triStateBadge(r.isProxy);
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
      sortValue: (r) => r.isProxy,
    },
    {
      key: "isHosting",
      header: "Is Hosting",
      cell: (r) => {
        const { label, tone } = triStateBadge(r.isHosting);
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
      sortValue: (r) => r.isHosting,
    },
    {
      key: "isMobile",
      header: "Is Mobile",
      cell: (r) => {
        const { label, tone } = triStateBadge(r.isMobile);
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
      sortValue: (r) => r.isMobile,
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (r) => (
        <span className="text-[11px] text-muted-foreground">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
      sortValue: (r) => r.createdAt,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Account IP Addresses"
        description="Most recent IP addresses per account with proxy / hosting / mobile signals."
        icon={Network}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowForm((v) => !v);
                if (!showForm) resetForm();
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add IP Address
            </Button>
          </div>
        }
      />

      {/* Collapsible guide banner */}
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
            >
              <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span className="font-medium text-emerald-800 dark:text-emerald-300">
                IP Address Filter Guide
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 text-emerald-700 transition-transform dark:text-emerald-400",
                  guideOpen ? "rotate-180" : "",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-emerald-500/20 px-3 py-3 text-xs text-emerald-900 dark:text-emerald-200">
              <p>
                By default, this view shows the most recent IP address for each account. Use
                the search box to filter by account login, IP address, city, or country. The
                <span className="font-medium"> Proxy</span>,
                <span className="font-medium"> Hosting</span>, and
                <span className="font-medium"> Mobile</span> columns indicate whether the IP
                was detected as a known proxy, hosting provider (e.g. AWS / DigitalOcean), or
                a mobile carrier IP. Cross-account IP overlap is a strong indicator of
                account linkage and may warrant a manual review.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Proxy = VPN / anonymizer
                </span>
                <span className="flex items-center gap-1">
                  <Server className="h-3 w-3" /> Hosting = cloud / datacenter
                </span>
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> Mobile = cellular carrier
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total IPs" value={totalIps} icon={Network} />
        <MetricCard label="Unique Accounts" value={uniqueAccounts} icon={Users} />
        <MetricCard
          label="Proxy IPs"
          value={proxyIps}
          tone={proxyIps > 0 ? "warning" : "default"}
          icon={ShieldAlert}
        />
        <MetricCard
          label="Hosting IPs"
          value={hostingIps}
          tone={hostingIps > 0 ? "warning" : "default"}
          icon={Server}
        />
        <MetricCard
          label="Mobile IPs"
          value={mobileIps}
          tone={mobileIps > 0 ? "default" : "default"}
          icon={Smartphone}
        />
      </div>

      {/* Inline add form */}
      {showForm ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Add IP Address
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Separator className="mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 lg:col-span-1">
              <Label htmlFor="ip-account">Account</Label>
              <Select value={formAccountId} onValueChange={setFormAccountId}>
                <SelectTrigger id="ip-account" className="w-full">
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.login} — {a.traderName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-address">IP Address</Label>
              <Input
                id="ip-address"
                value={formIp}
                onChange={(e) => setFormIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-city">City</Label>
              <Input
                id="ip-city"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="e.g. London"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-country">Country</Label>
              <Input
                id="ip-country"
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                placeholder="e.g. United Kingdom"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-lat">Latitude</Label>
              <Input
                id="ip-lat"
                type="number"
                step="0.000001"
                value={formLat}
                onChange={(e) => setFormLat(e.target.value)}
                placeholder="e.g. 51.5074"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-lng">Longitude</Label>
              <Input
                id="ip-lng"
                type="number"
                step="0.000001"
                value={formLng}
                onChange={(e) => setFormLng(e.target.value)}
                placeholder="e.g. -0.1278"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-proxy">Is Proxy</Label>
              <Select
                value={formIsProxy}
                onValueChange={(v) => setFormIsProxy(v as TriState)}
              >
                <SelectTrigger id="ip-proxy" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {TRI_STATE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "yes" ? "Yes" : o === "no" ? "No" : "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-hosting">Is Hosting</Label>
              <Select
                value={formIsHosting}
                onValueChange={(v) => setFormIsHosting(v as TriState)}
              >
                <SelectTrigger id="ip-hosting" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {TRI_STATE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "yes" ? "Yes" : o === "no" ? "No" : "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-mobile">Is Mobile</Label>
              <Select
                value={formIsMobile}
                onValueChange={(v) => setFormIsMobile(v as TriState)}
              >
                <SelectTrigger id="ip-mobile" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {TRI_STATE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "yes" ? "Yes" : o === "no" ? "No" : "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                resetForm();
                toast({ title: "Cancelled", description: "Add-IP form closed." });
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : null}

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
        <div className="relative w-full md:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, IP, city, country…"
            className="h-8 pl-8 text-xs"
            aria-label="Search IPs"
          />
        </div>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by country"
        >
          <option value="all">All countries</option>
          {countriesAvailable.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={proxyFilter}
          onChange={(e) => setProxyFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by proxy state"
        >
          {PROXY_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {allRecords.length} IPs
        </span>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) =>
              toast({
                title: "Viewing IP record detail",
                description: `${r.accountLogin} · ${r.ipAddress} · ${r.city}, ${r.country}`,
              })
            }
            searchableText={(r) =>
              `${r.accountLogin} ${r.traderName} ${r.ipAddress} ${r.city} ${r.country}`
            }
            searchPlaceholder="Search IPs…"
            pageSize={10}
            emptyTitle="No IP records found"
            emptyDescription="Add an IP address record or adjust your filters."
          />
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> Lat/Lng coordinates are used to plot account
          logins on the geo-risk map (Terra palette only — no blue/indigo).
        </p>
      </PageContent>
    </Page>
  );
}
