"use client";

/**
 * M1 — Integrations Hub (spec 5.1).
 *
 * The single inventory of every configured third-party connection.
 * Answers three questions at a glance: what is connected, is it
 * healthy, and what needs attention. Default landing view for the
 * Marketing > Integrations navigation group.
 *
 * Regions: PageHeader (New Connection / Import Config / Docs) →
 * KPI row (4 MetricCards with 24h deltas) → toolbar (debounced search,
 * category multiselect, status segmented control, Table/Cards toggle,
 * Export CSV) → saved-views bar → DataTable (or cards) with optimistic
 * switches, health dot, row actions → disconnect AlertDialog with typed
 * confirmation.
 *
 * Dummy data only — no network calls. Every mutation updates the local
 * connector store, writes an audit entry and confirms via toast.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState, PageAsyncBoundary } from "@/components/platform/guards";
import { ErrorAlert } from "@/components/platform/error-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { exportToCsv } from "@/lib/platform/export-utils";
import { useSavedViews } from "@/lib/platform/saved-views";
import {
  CONNECTOR_CATEGORIES,
  AUTH_KIND_LABEL,
  CONNECTOR_STATUS_LABEL,
  connectorStatusTone,
  type ConnectorCategory,
  type ConnectorRecord,
  type HubPreset,
  type HubStatusFilter,
} from "../types";
import { CONNECTOR_DEFINITIONS, getConnectorDefinition } from "../registry";
import {
  addConnector,
  disconnectConnector,
  getConnectors,
  getHubKpis,
  matchesHubFilters,
  testConnector,
  toggleConnectorActive,
  toggleConnectorEventLogging,
  useConnectorVersion,
} from "../connector-store";
import { ConnectorDrawer } from "../connector-drawer";
import { AddConnectorWizard } from "../add-connector-wizard";
import { absoluteTime, relativeTime } from "../format";
import {
  Activity,
  BookOpen,
  Check,
  Download,
  LayoutGrid,
  MoreHorizontal,
  Plug,
  Plus,
  Save,
  Search,
  Table2,
  Upload,
  X,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Per-user filter/view persistence (spec 5.1: persists to the         */
/* saved-views store per user)                                         */
/* ------------------------------------------------------------------ */

interface HubState {
  search: string;
  categories: ConnectorCategory[];
  status: HubStatusFilter;
  viewMode: "table" | "cards";
  preset: HubPreset;
}

const DEFAULT_HUB_STATE: HubState = {
  search: "",
  categories: [],
  status: "all",
  viewMode: "table",
  preset: "all",
};

function hubStorageKey(userId: string): string {
  return `pfaas:connectorHub:${userId}`;
}

function loadHubState(userId: string): HubState {
  if (typeof window === "undefined") return DEFAULT_HUB_STATE;
  try {
    const raw = window.localStorage.getItem(hubStorageKey(userId));
    if (!raw) return DEFAULT_HUB_STATE;
    const parsed = JSON.parse(raw) as Partial<HubState>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((c): c is ConnectorCategory =>
            (CONNECTOR_CATEGORIES as readonly string[]).includes(c),
          )
        : [],
      status:
        parsed.status === "all" ||
        parsed.status === "connected" ||
        parsed.status === "degraded" ||
        parsed.status === "error" ||
        parsed.status === "disconnected"
          ? parsed.status
          : "all",
      viewMode: parsed.viewMode === "cards" ? "cards" : "table",
      preset:
        parsed.preset === "attention" ||
        parsed.preset === "connected" ||
        parsed.preset === "custom"
          ? parsed.preset
          : "all",
    };
  } catch {
    return DEFAULT_HUB_STATE;
  }
}

function saveHubState(userId: string, state: HubState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(hubStorageKey(userId), JSON.stringify(state));
  } catch {
    /* quota / private mode — filter persistence is best-effort */
  }
}

/** Serialize filters into the saved-views record shape. */
function serializeFilters(s: HubState): Record<string, string> {
  return {
    search: s.search,
    categories: s.categories.join(","),
    status: s.status,
    viewMode: s.viewMode,
    preset: s.preset,
  };
}

function deserializeFilters(f: Record<string, string>): HubState {
  return {
    search: f.search ?? "",
    categories: (f.categories ?? "")
      .split(",")
      .filter((c): c is ConnectorCategory =>
        (CONNECTOR_CATEGORIES as readonly string[]).includes(c),
      ),
    status:
      f.status === "connected" ||
      f.status === "degraded" ||
      f.status === "error" ||
      f.status === "disconnected"
        ? f.status
        : "all",
    viewMode: f.viewMode === "cards" ? "cards" : "table",
    preset:
      f.preset === "attention" || f.preset === "connected" || f.preset === "custom"
        ? f.preset
        : "all",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const HEALTH_DOT: Record<ConnectorRecord["health"], { className: string; label: string }> = {
  ok: { className: "bg-emerald-500", label: "Healthy" },
  warn: { className: "bg-amber-500", label: "Degraded" },
  fail: { className: "bg-rose-500", label: "Failing" },
  idle: { className: "bg-slate-400", label: "Idle" },
};

/** Health dot with pulsing test state + last-failure tooltip. */
function HealthDot({
  record,
  testing,
}: {
  record: ConnectorRecord;
  testing: boolean;
}) {
  const dot = HEALTH_DOT[record.health];
  const tip = testing
    ? "Testing connection…"
    : record.lastError
      ? `${record.lastError}${record.lastErrorAt ? ` (${absoluteTime(record.lastErrorAt)})` : ""}`
      : `${dot.label} — last check ${relativeTime(record.lastSync)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${dot.className} ${
            testing ? "animate-pulse ring-2 ring-primary/40" : ""
          }`}
          role="img"
          aria-label={`${dot.label} — ${tip}`}
        />
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Connector icon + name + category badge (table + cards). */
function ConnectorCell({ record }: { record: ConnectorRecord }) {
  const def = getConnectorDefinition(record.definitionId);
  const Icon = def?.icon ?? Plug;
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-md bg-muted/60 p-1.5">
        <Icon className="h-3.5 w-3.5 text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {def?.name ?? record.definitionId}
        </p>
        <p className="text-[11px] text-muted-foreground">{def?.category ?? "Custom"}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function IntegrationsHubPage() {
  const { user, router, navigate } = usePlatform();
  const userId = user?.id ?? "anon";

  /* Initial async load — exercises loading / error + retry states. */
  const {
    data: loadedAt,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => Date.now(), { delayMs: 450 }), []);

  /* Live store */
  const recordsVersion = useConnectorVersion();
  const records = getConnectors();
  const kpis = useMemo(() => getHubKpis(records), [records, recordsVersion]);

  /* Configuration drawer (5.2) + Add Connector wizard (5.3). The
     `connector-new` deep link opens the wizard over the hub; closing it
     returns to the hub view. */
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(() => router.view === "connector-new");
  const setWizard = (open: boolean) => {
    setWizardOpen(open);
    if (!open && router.view === "connector-new") navigate("marketing-integrations");
  };

  /* Filters + view mode (restored per user) */
  const [initial] = useState<HubState>(() => loadHubState(userId));
  const [searchInput, setSearchInput] = useState(initial.search);
  const [query, setQuery] = useState(initial.search);
  const [categories, setCategories] = useState<ConnectorCategory[]>(initial.categories);
  const [status, setStatus] = useState<HubStatusFilter>(initial.status);
  const [viewMode, setViewMode] = useState<"table" | "cards">(initial.viewMode);
  const [preset, setPreset] = useState<HubPreset>(initial.preset);

  /* Debounced search (300 ms, matches name and category) */
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* Persist filter + view mode per user */
  useEffect(() => {
    saveHubState(userId, { search: searchInput, categories, status, viewMode, preset });
  }, [userId, searchInput, categories, status, viewMode, preset]);

  /* Row interaction state */
  const [testingId, setTestingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectorRecord | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  /* Saved views (existing saved-views utility) */
  const { views, saveView, deleteView } = useSavedViews("connector-hub", userId);

  const filtered = useMemo(
    () =>
      records.filter((r) =>
        matchesHubFilters(r, { preset, status, categories, query }),
      ),
    // records identity changes on every store mutation
    [records, preset, status, categories, query],
  );

  /* ---------------------------------------------------------------- */
  /* Actions (optimistic + audit + toast)                              */
  /* ---------------------------------------------------------------- */

  const onToggleActive = (r: ConnectorRecord) => {
    const next = toggleConnectorActive(r.id);
    const name = getConnectorDefinition(r.definitionId)?.name ?? r.definitionId;
    toast({
      title: next ? "Connector activated" : "Connector paused",
      description: `${name} is now ${next ? "dispatching events" : "paused"}.`,
    });
  };

  const onToggleLogging = (r: ConnectorRecord) => {
    const next = toggleConnectorEventLogging(r.id);
    const name = getConnectorDefinition(r.definitionId)?.name ?? r.definitionId;
    toast({
      title: next ? "Event logging enabled" : "Event logging disabled",
      description: `${name} will ${next ? "record" : "stop recording"} connector events.`,
    });
  };

  const onTest = async (r: ConnectorRecord) => {
    const name = getConnectorDefinition(r.definitionId)?.name ?? r.definitionId;
    setTestingId(r.id);
    const result = await testConnector(r.id);
    setTestingId(null);
    if (result.ok) {
      toast({
        title: "Connection test passed",
        description: `${name} responded in ${result.latencyMs} ms${
          result.accountLabel ? ` — ${result.accountLabel}` : ""
        }.`,
      });
    } else {
      toast({
        title: "Connection test failed",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const onDisconnect = () => {
    if (!disconnectTarget) return;
    const name =
      getConnectorDefinition(disconnectTarget.definitionId)?.name ??
      disconnectTarget.definitionId;
    disconnectConnector(disconnectTarget.id);
    setDisconnectTarget(null);
    setConfirmText("");
    toast({
      title: "Connector disconnected",
      description: `${name} credentials were purged and event sync stopped. Reconnect any time.`,
    });
  };

  const onExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "name", header: "Connector", value: (r) => getConnectorDefinition(r.definitionId)?.name ?? r.definitionId },
        { key: "category", header: "Category", value: (r) => getConnectorDefinition(r.definitionId)?.category ?? "Custom" },
        { key: "auth", header: "Auth", value: (r) => AUTH_KIND_LABEL[getConnectorDefinition(r.definitionId)?.authKind ?? "api_key"] },
        { key: "status", header: "Status", value: (r) => CONNECTOR_STATUS_LABEL[r.status] },
        { key: "active", header: "Active", value: (r) => (r.active ? "yes" : "no") },
        { key: "logging", header: "Event Logging", value: (r) => (r.eventLogging ? "yes" : "no") },
        { key: "lastSync", header: "Last Sync", value: (r) => (r.lastSync ? absoluteTime(r.lastSync) : "Never") },
        { key: "events", header: "Events 24h", value: (r) => r.events24h },
        { key: "health", header: "Health", value: (r) => HEALTH_DOT[r.health].label },
      ],
      "marketing-integrations.csv",
    );
    toast({
      title: "Export ready",
      description: `${filtered.length} connector${filtered.length === 1 ? "" : "s"} exported to CSV.`,
    });
  };

  /* JSON config import — validates against the registry, installs rows. */
  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const entries: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { connectors?: unknown[] })?.connectors)
          ? (parsed as { connectors: unknown[] }).connectors
          : [];
      if (entries.length === 0) {
        toast({
          title: "Nothing to import",
          description: "Expected an array of { definitionId, config } entries.",
          variant: "destructive",
        });
        return;
      }
      let imported = 0;
      const skipped: string[] = [];
      for (const entry of entries) {
        const e = entry as {
          definitionId?: string;
          name?: string;
          config?: Record<string, string>;
        };
        const def =
          (e.definitionId ? getConnectorDefinition(e.definitionId) : undefined) ??
          CONNECTOR_DEFINITIONS.find((d) => d.name.toLowerCase() === (e.name ?? "").toLowerCase());
        if (!def) {
          skipped.push(`${e.definitionId ?? e.name ?? "unknown"} (not in registry)`);
          continue;
        }
        const missing = def.fields
          .filter((f) => f.required && !(e.config ?? {})[f.key])
          .map((f) => f.key);
        if (missing.length > 0) {
          skipped.push(`${def.name} (missing: ${missing.join(", ")})`);
          continue;
        }
        addConnector(def.id, e.config ?? {});
        imported += 1;
      }
      if (imported > 0) {
        toast({
          title: `Imported ${imported} connector${imported === 1 ? "" : "s"}`,
          description:
            skipped.length > 0
              ? `Skipped ${skipped.length}: ${skipped.join("; ")}`
              : "All entries passed registry validation.",
        });
      } else {
        toast({
          title: "Import failed",
          description: skipped.join("; ") || "No valid entries found.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Import failed",
        description: "That file is not valid JSON.",
        variant: "destructive",
      });
    }
  };

  /* Preset + saved views */
  const applyPreset = (p: "all" | "attention" | "connected") => {
    setPreset(p);
    setStatus("all");
    setCategories([]);
    setSearchInput("");
    setQuery("");
  };

  const applyCustomFilters = (patch: Partial<HubState>) => {
    setPreset("custom");
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.categories !== undefined) setCategories(patch.categories);
    if (patch.search !== undefined) {
      setSearchInput(patch.search);
      setQuery(patch.search);
    }
    if (patch.viewMode !== undefined) setViewMode(patch.viewMode);
  };

  const onSaveView = () => {
    const name = viewName.trim();
    if (!name) return;
    saveView(
      name,
      serializeFilters({ search: searchInput, categories, status, viewMode, preset }),
    );
    setViewName("");
    setViewsOpen(false);
    toast({ title: "View saved", description: `“${name}” is now in your saved views.` });
  };

  /* ---------------------------------------------------------------- */
  /* Columns                                                           */
  /* ---------------------------------------------------------------- */

  const columns: Column<ConnectorRecord>[] = [
    {
      key: "connector",
      header: "Connector",
      cell: (r) => <ConnectorCell record={r} />,
      sortValue: (r) => getConnectorDefinition(r.definitionId)?.name ?? r.definitionId,
    },
    {
      key: "auth",
      header: "Auth",
      cell: (r) => {
        const def = getConnectorDefinition(r.definitionId);
        return (
          <StatusBadge tone="info">
            {AUTH_KIND_LABEL[def?.authKind ?? "api_key"]}
          </StatusBadge>
        );
      },
      sortValue: (r) => getConnectorDefinition(r.definitionId)?.authKind ?? "",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={connectorStatusTone(r.status)}>
          {CONNECTOR_STATUS_LABEL[r.status]}
        </StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "active",
      header: "Active",
      width: "88px",
      cell: (r) => (
        <Switch
          checked={r.active}
          disabled={r.status === "disconnected"}
          onCheckedChange={() => onToggleActive(r)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Toggle active for ${getConnectorDefinition(r.definitionId)?.name ?? r.definitionId}`}
        />
      ),
      sortValue: (r) => (r.active ? 1 : 0),
    },
    {
      key: "eventLogging",
      header: "Event Logging",
      width: "120px",
      cell: (r) => (
        <Switch
          checked={r.eventLogging}
          onCheckedChange={() => onToggleLogging(r)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Toggle event logging for ${getConnectorDefinition(r.definitionId)?.name ?? r.definitionId}`}
        />
      ),
      sortValue: (r) => (r.eventLogging ? 1 : 0),
    },
    {
      key: "lastSync",
      header: "Last Sync",
      cell: (r) => (
        <span
          className="text-xs text-muted-foreground"
          title={absoluteTime(r.lastSync)}
        >
          {relativeTime(r.lastSync)}
        </span>
      ),
      sortValue: (r) => r.lastSync ?? "",
    },
    {
      key: "health",
      header: "Health",
      width: "84px",
      cell: (r) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <HealthDot record={r} testing={testingId === r.id} />
        </span>
      ),
      sortValue: (r) => r.health,
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      cell: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActions
            record={r}
            testing={testingId === r.id}
            onConfigure={() => setDrawerId(r.id)}
            onTest={() => void onTest(r)}
            onToggleLogging={() => onToggleLogging(r)}
            onDisconnect={() => {
              setDisconnectTarget(r);
              setConfirmText("");
            }}
          />
        </div>
      ),
    },
  ];

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const targetName = disconnectTarget
    ? getConnectorDefinition(disconnectTarget.definitionId)?.name ??
      disconnectTarget.definitionId
    : "";

  const headerActions = (
    <>
      <Button size="sm" onClick={() => setWizardOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> New Connection
      </Button>
      <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
        <Upload className="mr-1 h-4 w-4" /> Import Config
      </Button>
      <Popover open={docsOpen} onOpenChange={setDocsOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            <BookOpen className="mr-1 h-4 w-4" /> Docs
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 text-sm">
          <p className="font-medium text-foreground">Connector registry</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every connection is a registry record: category, auth kind
            (API key, OAuth 2.0, webhook, custom REST) and a config schema
            that drives its forms. Secrets are stored masked and never
            rendered in list views.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Health reflects the last sync and provider responses.</li>
            <li>Event logging keeps a queryable trail per connector.</li>
            <li>Self-hosted tools use the Custom Connector Builder.</li>
          </ul>
        </PopoverContent>
      </Popover>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import connector configuration JSON"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <Page>
      <PageHeader
        title="Marketing Integrations"
        description="Every third-party connection in one inventory — what is connected, is it healthy, and what needs attention."
        icon={Plug}
        actions={headerActions}
      />

      <PageAsyncBoundary
        loading={loading}
        error={error}
        hasData={loadedAt !== undefined}
        onRetry={retry}
        loadingLabel="Loading connectors…"
      >
        <PageContent>
          {/* KPI row — 4 MetricCards with 24h deltas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Connectors"
              value={kpis.total}
              delta={kpis.totalDelta}
              deltaLabel="vs prev 24h"
              icon={Plug}
            />
            <MetricCard
              label="Connected"
              value={`${kpis.connected} of ${kpis.total}`}
              delta={kpis.connectedDelta}
              deltaLabel="vs prev 24h"
              icon={Check}
              tone="positive"
            />
            <MetricCard
              label="Active"
              value={kpis.active}
              delta={kpis.activeDelta}
              deltaLabel="switch on"
              icon={Zap}
            />
            <MetricCard
              label="Events Logged 24h"
              value={kpis.events24h.toLocaleString("en-US")}
              delta={kpis.eventsDelta}
              deltaLabel="vs prev 24h"
              icon={Activity}
              tone={kpis.needsAttention > 0 ? "warning" : "default"}
            />
          </div>

          {/* Error banner — stale rows remain visible below */}
          {error && loadedAt !== undefined ? (
            <ErrorAlert
              title="Couldn't refresh connectors"
              description={`${error.message} Showing the last loaded inventory.`}
              onRetry={retry}
            >
              <Badge variant="outline" className="ml-1">
                Data as of {new Date(loadedAt).toLocaleTimeString()}
              </Badge>
            </ErrorAlert>
          ) : null}

          {/* Empty state — no connectors configured at all */}
          {records.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="No integrations configured yet"
              description="Connect an email, ads, analytics or community platform to start syncing events."
              action={
                <Button size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add your first connection
                </Button>
              }
            />
          ) : (
            <TooltipProvider>
              {/* Saved views bar */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-3 py-2">
                <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Views
                </span>
                {(
                  [
                    ["all", "All"],
                    ["attention", "Needs Attention"],
                    ["connected", "Connected"],
                  ] as const
                ).map(([p, label]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      preset === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    {p === "attention" && kpis.needsAttention > 0 ? (
                      <span className="ml-1 opacity-80">({kpis.needsAttention})</span>
                    ) : null}
                  </button>
                ))}
                {preset === "custom" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Custom filters
                    <button
                      type="button"
                      aria-label="Clear custom filters"
                      onClick={() => applyPreset("all")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {views.length > 0 ? <Separator orientation="vertical" className="mx-1 h-4" /> : null}
                {views.map((v) => (
                  <span
                    key={v.id}
                    className="group inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs text-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const s = deserializeFilters(v.filters);
                        setSearchInput(s.search);
                        setQuery(s.search);
                        setCategories(s.categories);
                        setStatus(s.status);
                        setViewMode(s.viewMode);
                        setPreset(s.preset);
                      }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete view ${v.name}`}
                      onClick={() => deleteView(v.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="ml-auto">
                  <Popover open={viewsOpen} onOpenChange={setViewsOpen}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                        <Save className="mr-1 h-3 w-3" /> Save view
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64">
                      <p className="mb-2 text-sm font-medium">Save current view</p>
                      <div className="flex gap-2">
                        <Input
                          value={viewName}
                          onChange={(e) => setViewName(e.target.value)}
                          placeholder="View name"
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onSaveView();
                          }}
                        />
                        <Button size="sm" className="h-8" onClick={onSaveView} disabled={!viewName.trim()}>
                          Save
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search connectors…"
                      className="pl-8"
                      aria-label="Search connectors"
                    />
                  </div>

                  {/* Category multiselect */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-9">
                        Category
                        {categories.length > 0 ? (
                          <Badge variant="secondary" className="ml-1.5 px-1.5">
                            {categories.length}
                          </Badge>
                        ) : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56">
                      <div className="space-y-2">
                        {CONNECTOR_CATEGORIES.map((c) => (
                          <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={categories.includes(c)}
                              onCheckedChange={(checked) =>
                                applyCustomFilters({
                                  categories: checked
                                    ? [...categories, c]
                                    : categories.filter((x) => x !== c),
                                })
                              }
                            />
                            {c}
                          </label>
                        ))}
                        <div className="flex justify-between border-t pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => applyCustomFilters({ categories: [] })}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              applyCustomFilters({
                                categories: [...CONNECTOR_CATEGORIES],
                              })
                            }
                          >
                            Select all
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Status segmented control */}
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={status}
                    onValueChange={(v) => {
                      if (v) applyCustomFilters({ status: v as HubStatusFilter });
                    }}
                    aria-label="Filter by status"
                  >
                    <ToggleGroupItem value="all">All</ToggleGroupItem>
                    <ToggleGroupItem value="connected">Connected</ToggleGroupItem>
                    <ToggleGroupItem value="degraded">Degraded</ToggleGroupItem>
                    <ToggleGroupItem value="error">Error</ToggleGroupItem>
                    <ToggleGroupItem value="disconnected">Disconnected</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Layout toggle */}
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={viewMode}
                    onValueChange={(v) => {
                      if (v === "table" || v === "cards") applyCustomFilters({ viewMode: v });
                    }}
                    aria-label="Layout"
                  >
                    <ToggleGroupItem value="table">
                      <Table2 className="mr-1 h-3.5 w-3.5" /> Table
                    </ToggleGroupItem>
                    <ToggleGroupItem value="cards">
                      <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Cards
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Button size="sm" variant="outline" onClick={onExport}>
                    <Download className="mr-1 h-4 w-4" /> Export CSV
                  </Button>
                </div>
              </div>

              {/* Table / Cards */}
              {viewMode === "table" ? (
                <DataTable
                  columns={columns}
                  data={filtered}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => setDrawerId(r.id)}
                  pageSize={8}
                  emptyTitle="No connectors match these filters"
                  emptyDescription="Adjust the search, category or status filter."
                />
              ) : (
                <ConnectorCards
                  records={filtered}
                  testingId={testingId}
                  onToggleActive={onToggleActive}
                  onToggleLogging={onToggleLogging}
                  onTest={(r) => void onTest(r)}
                  onConfigure={(r) => setDrawerId(r.id)}
                  onDisconnect={(r) => {
                    setDisconnectTarget(r);
                    setConfirmText("");
                  }}
                />
              )}
            </TooltipProvider>
          )}
        </PageContent>
      </PageAsyncBoundary>

      {/* Disconnect — typed confirmation (spec 5.1) */}
      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDisconnectTarget(null);
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {targetName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This purges the stored credentials and stops all event sync.
              The row stays so you can reconnect later. Type{" "}
              <span className="font-medium text-foreground">{targetName}</span>{" "}
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={targetName}
            aria-label={`Type ${targetName} to confirm`}
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== targetName}
              className="bg-rose-600 hover:bg-rose-700 disabled:bg-muted disabled:text-muted-foreground"
              onClick={onDisconnect}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Configuration drawer (5.2) + Add Connector wizard (5.3) */}
      <ConnectorDrawer recordId={drawerId} onClose={() => setDrawerId(null)} />
      <AddConnectorWizard open={wizardOpen} onOpenChange={setWizard} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Row actions dropdown                                                */
/* ------------------------------------------------------------------ */

function RowActions({
  record,
  testing,
  onConfigure,
  onTest,
  onToggleLogging,
  onDisconnect,
}: {
  record: ConnectorRecord;
  testing: boolean;
  onConfigure: () => void;
  onTest: () => void;
  onToggleLogging: () => void;
  onDisconnect: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          aria-label={`Actions for ${getConnectorDefinition(record.definitionId)?.name ?? record.definitionId}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onConfigure}>Configure</DropdownMenuItem>
        <DropdownMenuItem onClick={onTest} disabled={testing}>
          <Zap className="mr-2 h-3.5 w-3.5" /> Test Connection
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleLogging}>
          {record.eventLogging ? "Pause Event Logging" : "Resume Event Logging"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDisconnect}
          className="text-rose-600 focus:text-rose-600"
        >
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Cards layout                                                        */
/* ------------------------------------------------------------------ */

function ConnectorCards({
  records,
  testingId,
  onToggleActive,
  onToggleLogging,
  onTest,
  onConfigure,
  onDisconnect,
}: {
  records: ConnectorRecord[];
  testingId: string | null;
  onToggleActive: (r: ConnectorRecord) => void;
  onToggleLogging: (r: ConnectorRecord) => void;
  onTest: (r: ConnectorRecord) => void;
  onConfigure: (r: ConnectorRecord) => void;
  onDisconnect: (r: ConnectorRecord) => void;
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="No connectors match these filters"
        description="Adjust the search, category or status filter."
        action={null}
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((r) => {
        const def = getConnectorDefinition(r.definitionId);
        const Icon = def?.icon ?? Plug;
        return (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="rounded-md bg-muted/60 p-2">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {def?.name ?? r.definitionId}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {def?.category ?? "Custom"} ·{" "}
                    {AUTH_KIND_LABEL[def?.authKind ?? "api_key"]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HealthDot record={r} testing={testingId === r.id} />
                <StatusBadge tone={connectorStatusTone(r.status)}>
                  {CONNECTOR_STATUS_LABEL[r.status]}
                </StatusBadge>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
              <span title={absoluteTime(r.lastSync)}>
                Synced {relativeTime(r.lastSync)}
              </span>
              <span className="tabular-nums">
                {r.events24h.toLocaleString("en-US")} events / 24h
              </span>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                Active
                <Switch
                  checked={r.active}
                  disabled={r.status === "disconnected"}
                  onCheckedChange={() => onToggleActive(r)}
                  aria-label={`Toggle active for ${def?.name ?? r.definitionId}`}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                Event logging
                <Switch
                  checked={r.eventLogging}
                  onCheckedChange={() => onToggleLogging(r)}
                  aria-label={`Toggle event logging for ${def?.name ?? r.definitionId}`}
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onTest(r)}>
                <Zap className="mr-1 h-3 w-3" /> Test
              </Button>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onConfigure(r)}>
                  Configure
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                  onClick={() => onDisconnect(r)}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
