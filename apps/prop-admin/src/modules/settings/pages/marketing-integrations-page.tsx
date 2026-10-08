"use client";

/**
 * Marketing Integrations page (UX Constitution §12, §25-27).
 *
 * Third-party marketing platform connections:
 *  - KPI row: Total Integrations, Connected, Active, Event Logging Enabled
 *  - DataTable: Platform badge, Status (Connected/Disconnected), Active
 *    Switch, Event Logging Switch, Last Sync, Actions (Configure / Disconnect)
 *  - Inline edit panel (revealed when a row is selected):
 *    Platform dropdown, Is Active, Enable Event Logging, collapsible
 *    "API Secret Key Format per Platform" help with JSON examples,
 *    masked API Secret Key input with Show/Hide toggle, Test Connection
 *    button, Save Integration button, Disconnect (AlertDialog)
 *  - Empty state when no integrations configured
 *
 * Pre-seeded with a small deterministic set of integrations across
 * Klaviyo, GA4, Meta, Discord, Slack, Mailchimp, HubSpot.
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Plug,
  Plus,
  Settings2,
  Unplug,
  Save,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Activity,
  Check,
  Zap,
  Send,
  Webhook,
  BarChart3,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static option pools                                                  */
/* ------------------------------------------------------------------ */

const PLATFORMS = [
  "Klaviyo",
  "Google Analytics 4",
  "Meta Pixel",
  "Discord Webhook",
  "Slack Webhook",
  "Mailchimp",
  "HubSpot",
] as const;

type Platform = (typeof PLATFORMS)[number];

const PLATFORM_ICONS: Record<Platform, React.ComponentType<{ className?: string }>> = {
  Klaviyo: Send,
  "Google Analytics 4": BarChart3,
  "Meta Pixel": Activity,
  "Discord Webhook": Webhook,
  "Slack Webhook": Webhook,
  Mailchimp: Send,
  HubSpot: Plug,
};

/** Per-platform JSON shape for the API secret key (shown in help collapsible). */
const PLATFORM_SECRET_EXAMPLE: Record<Platform, string> = {
  Klaviyo: `{"private_key": "..."}`,
  "Google Analytics 4": `{"measurement_id": "G-XXXX", "api_secret": "..."}`,
  "Meta Pixel": `{"pixel_id": "...", "access_token": "..."}`,
  "Discord Webhook": `{"webhook_url": "..."}`,
  "Slack Webhook": `{"webhook_url": "...", "channel": "#alerts"}`,
  Mailchimp: `{"api_key": "...", "server": "us1"}`,
  HubSpot: `{"access_token": "...", "portal_id": "..."}`,
};

/** Deterministic seed integrations (no Math.random). */
const SEED_INTEGRATIONS: Integration[] = [
  {
    id: "mi-1",
    platform: "Klaviyo",
    connected: true,
    active: true,
    eventLogging: true,
    secretKey: "EXAMPLE_KEY_NOT_REAL",
    lastSync: "2026-09-12T08:15:00.000Z",
  },
  {
    id: "mi-2",
    platform: "Google Analytics 4",
    connected: true,
    active: true,
    eventLogging: true,
    secretKey: "G-X1Y2Z3,secret_abcdef",
    lastSync: "2026-09-12T08:00:00.000Z",
  },
  {
    id: "mi-3",
    platform: "Meta Pixel",
    connected: false,
    active: false,
    eventLogging: false,
    secretKey: "",
    lastSync: "—",
  },
  {
    id: "mi-4",
    platform: "Discord Webhook",
    connected: true,
    active: false,
    eventLogging: true,
    secretKey: "https://discord.com/api/webhooks/123/abc",
    lastSync: "2026-09-10T20:30:00.000Z",
  },
  {
    id: "mi-5",
    platform: "Slack Webhook",
    connected: false,
    active: false,
    eventLogging: false,
    secretKey: "",
    lastSync: "—",
  },
];

/* ------------------------------------------------------------------ */
/* Integration model                                                  */
/* ------------------------------------------------------------------ */

interface Integration {
  id: string;
  platform: Platform;
  connected: boolean;
  active: boolean;
  eventLogging: boolean;
  secretKey: string;
  /** ISO timestamp or "—" if never synced. */
  lastSync: string;
}

function platformTone(p: Platform): "info" | "warning" | "success" | "muted" {
  switch (p) {
    case "Klaviyo":
    case "Mailchimp":
      return "success";
    case "Google Analytics 4":
      return "info";
    case "Meta Pixel":
      return "info";
    case "Discord Webhook":
    case "Slack Webhook":
      return "warning";
    case "HubSpot":
      return "muted";
    default:
      return "muted";
  }
}

function formatDate(iso: string): string {
  if (iso === "—") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function MarketingIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(
    SEED_INTEGRATIONS,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);

  const total = integrations.length;
  const connected = integrations.filter((i) => i.connected).length;
  const active = integrations.filter((i) => i.active).length;
  const eventLogging = integrations.filter((i) => i.eventLogging).length;

  const selected = useMemo(
    () => integrations.find((i) => i.id === selectedId) ?? null,
    [integrations, selectedId],
  );

  const updateSelected = (patch: Partial<Integration>) => {
    if (!selected) return;
    setIntegrations((prev) =>
      prev.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)),
    );
  };

  const onToggleActive = (i: Integration) => {
    setIntegrations((prev) =>
      prev.map((x) =>
        x.id === i.id ? { ...x, active: !x.active } : x,
      ),
    );
    toast({
      title: i.active ? "Integration paused" : "Integration activated",
      description: `${i.platform} is now ${i.active ? "inactive" : "active"}.`,
    });
  };

  const onToggleLogging = (i: Integration) => {
    setIntegrations((prev) =>
      prev.map((x) =>
        x.id === i.id ? { ...x, eventLogging: !x.eventLogging } : x,
      ),
    );
    toast({
      title: i.eventLogging ? "Event logging disabled" : "Event logging enabled",
      description: `${i.platform} will ${i.eventLogging ? "stop" : "start"} recording events.`,
    });
  };

  const onTestConnection = () => {
    if (!selected) return;
    toast({
      title: "Connection test successful",
      description: `${selected.platform} responded OK.`,
    });
  };

  const onSave = () => {
    if (!selected) return;
    toast({
      title: "Integration saved",
      description: `${selected.platform} configuration updated.`,
    });
  };

  const onDisconnect = (i: Integration) => {
    setIntegrations((prev) =>
      prev.map((x) =>
        x.id === i.id
          ? { ...x, connected: false, active: false }
          : x,
      ),
    );
    setDeleteTarget(null);
    setSelectedId(null);
    toast({
      title: "Integration disconnected",
      description: `${i.platform} is no longer connected. Re-add the API key to reconnect.`,
    });
  };

  const onAddNew = () => {
    // Create a draft integration pre-set to a reasonable platform.
    const id = `mi-new-${Date.now()}`;
    const newIntegration: Integration = {
      id,
      platform: "Klaviyo",
      connected: false,
      active: false,
      eventLogging: false,
      secretKey: "",
      lastSync: "—",
    };
    setIntegrations((prev) => [newIntegration, ...prev]);
    setSelectedId(id);
    setShowSecret(false);
    toast({
      title: "New integration draft",
      description: "Fill in the platform and API key, then Save.",
    });
  };

  const columns: Column<Integration>[] = [
    {
      key: "platform",
      header: "Platform",
      cell: (i) => {
        const Icon = PLATFORM_ICONS[i.platform];
        return (
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted/60 p-1.5">
              <Icon className="h-3.5 w-3.5 text-foreground" />
            </div>
            <StatusBadge tone={platformTone(i.platform)}>{i.platform}</StatusBadge>
          </div>
        );
      },
      sortValue: (i) => i.platform,
    },
    {
      key: "status",
      header: "Status",
      cell: (i) => (
        <StatusBadge tone={i.connected ? "success" : "muted"}>
          {i.connected ? "Connected" : "Disconnected"}
        </StatusBadge>
      ),
      sortValue: (i) => (i.connected ? 1 : 0),
    },
    {
      key: "active",
      header: "Active",
      cell: (i) => (
        <Switch
          checked={i.active}
          onCheckedChange={() => onToggleActive(i)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Toggle active for ${i.platform}`}
        />
      ),
      width: "80px",
    },
    {
      key: "eventLogging",
      header: "Event Logging",
      cell: (i) => (
        <Switch
          checked={i.eventLogging}
          onCheckedChange={() => onToggleLogging(i)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Toggle event logging for ${i.platform}`}
        />
      ),
      width: "120px",
    },
    {
      key: "lastSync",
      header: "Last Sync",
      cell: (i) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(i.lastSync)}
        </span>
      ),
      sortValue: (i) => i.lastSync,
    },
    {
      key: "actions",
      header: "",
      cell: (i) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(i.id);
              setShowSecret(false);
            }}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(i);
            }}
            aria-label={`Disconnect ${i.platform}`}
          >
            <Unplug className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: "180px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Marketing Integrations"
        description="Connect third-party marketing platforms to sync trader events and attribution data."
        icon={Plug}
        actions={
          <Button size="sm" onClick={onAddNew}>
            <Plus className="mr-1 h-4 w-4" /> Add Integration
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Integrations"
            value={total}
            icon={Plug}
            tone="default"
          />
          <MetricCard
            label="Connected"
            value={connected}
            icon={Check}
            tone="positive"
            deltaLabel={`${total - connected} pending`}
          />
          <MetricCard
            label="Active"
            value={active}
            icon={Zap}
            tone="default"
            deltaLabel="dispatching events"
          />
          <MetricCard
            label="Event Logging"
            value={eventLogging}
            icon={Activity}
            tone="warning"
            deltaLabel="capturing trails"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Integrations table */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                Integrations{" "}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({integrations.length})
                </span>
              </p>
            </div>
            {integrations.length === 0 ? (
              <EmptyState
                icon={Plug}
                title="No marketing integrations configured"
                description="Add one to start tracking events."
                hint="Click Add Integration to draft a new connection."
              />
            ) : (
              <DataTable
                columns={columns}
                data={integrations}
                rowKey={(i) => i.id}
                onRowClick={(i) => {
                  setSelectedId(i.id);
                  setShowSecret(false);
                }}
                searchableText={(i) => i.platform}
                searchPlaceholder="Search platforms…"
                emptyTitle="No integrations"
                emptyDescription="Add an integration to start syncing events."
                pageSize={8}
              />
            )}
          </div>

          {/* Edit panel */}
          <div className="rounded-lg border bg-card p-4">
            {selected ? (
              <IntegrationEditPanel
                key={selected.id}
                integration={selected}
                showSecret={showSecret}
                onShowSecretChange={setShowSecret}
                helpOpen={helpOpen}
                onHelpOpenChange={setHelpOpen}
                onChange={updateSelected}
                onTestConnection={onTestConnection}
                onSave={onSave}
                onDisconnect={() => setDeleteTarget(selected)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <EmptyState
                icon={Plug}
                title="No integration selected"
                description="Select an integration from the list to configure its platform, API key, and event settings."
                hint="Tip: the API secret key format differs per platform — check the inline help when editing."
              />
            )}
          </div>
        </div>
      </PageContent>

      {/* Disconnect confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this integration?</AlertDialogTitle>
          <AlertDialogDescription>
              This will disconnect{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.platform ?? ""}
              </span>{" "}
              and stop all event sync. Stored API keys are removed. The
              integration row remains and can be reconnected later. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleteTarget && onDisconnect(deleteTarget)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Inline edit panel                                                   */
/* ------------------------------------------------------------------ */

function IntegrationEditPanel({
  integration,
  showSecret,
  onShowSecretChange,
  helpOpen,
  onHelpOpenChange,
  onChange,
  onTestConnection,
  onSave,
  onDisconnect,
  onClose,
}: {
  integration: Integration;
  showSecret: boolean;
  onShowSecretChange: (v: boolean) => void;
  helpOpen: boolean;
  onHelpOpenChange: (v: boolean) => void;
  onChange: (patch: Partial<Integration>) => void;
  onTestConnection: () => void;
  onSave: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const Icon = PLATFORM_ICONS[integration.platform];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="rounded-md bg-muted/60 p-1.5">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {integration.platform}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: <span className="font-mono">{integration.id}</span>
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close edit panel"
        >
          ×
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={integration.connected ? "success" : "muted"}>
          {integration.connected ? "Connected" : "Disconnected"}
        </StatusBadge>
        <StatusBadge tone={integration.active ? "success" : "muted"}>
          {integration.active ? "Active" : "Inactive"}
        </StatusBadge>
        {integration.eventLogging ? (
          <Badge variant="outline" className="gap-1 text-emerald-700">
            <Activity className="h-3 w-3" /> Logging
          </Badge>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-1.5">
        <LabelWithHelp help="Select the marketing platform. The API secret key format changes per platform.">
          Platform
        </LabelWithHelp>
        <Select
          value={integration.platform}
          onValueChange={(v) => onChange({ platform: v as Platform })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex flex-col">
          <Label
            htmlFor="int-active"
            className="cursor-pointer text-sm font-medium"
          >
            Is Active
          </Label>
          <span className="text-xs text-muted-foreground">
            Dispatch events to this platform when triggers fire.
          </span>
        </div>
        <Switch
          id="int-active"
          checked={integration.active}
          onCheckedChange={(v) => onChange({ active: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex flex-col">
          <LabelWithHelp help="When enabled, the platform keeps a record of every event (purchase, payout, breach, etc.) for audit and replay.">
            Enable Event Logging
          </LabelWithHelp>
        </div>
        <Switch
          checked={integration.eventLogging}
          onCheckedChange={(v) => onChange({ eventLogging: v })}
        />
      </div>

      {/* Collapsible help — per-platform API key format */}
      <Collapsible open={helpOpen} onOpenChange={onHelpOpenChange}>
        <div className="rounded-md border bg-muted/20">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
            >
              <span className="font-medium text-foreground">
                API Secret Key Format per Platform
              </span>
              {helpOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-2 border-t px-3 py-3 text-xs">
              {PLATFORMS.map((p) => (
                <div
                  key={p}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-muted-foreground">{p}</span>
                  <code className="rounded bg-background px-2 py-0.5 font-mono text-[10px] text-foreground">
                    {PLATFORM_SECRET_EXAMPLE[p]}
                  </code>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="space-y-1.5">
        <LabelWithHelp help="Paste the API secret key in the format shown above. Stored masked; click the eye to reveal.">
          API Secret Key
        </LabelWithHelp>
        <div className="flex items-center gap-2">
          <Input
            type={showSecret ? "text" : "password"}
            value={integration.secretKey}
            onChange={(e) => onChange({ secretKey: e.target.value })}
            placeholder="Paste your API key…"
            className="font-mono"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => onShowSecretChange(!showSecret)}
            aria-label={showSecret ? "Hide secret" : "Show secret"}
          >
            {showSecret ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Unplug className="mr-1 h-3.5 w-3.5" /> Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Disconnect {integration.platform}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will stop all event sync to {integration.platform}. The
                stored API key will be removed. You can reconnect later by
                pasting a new key.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 hover:bg-rose-700"
                onClick={onDisconnect}
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button size="sm" variant="outline" onClick={onTestConnection}>
          <Zap className="mr-1 h-3.5 w-3.5" /> Test Connection
        </Button>
        <Button size="sm" onClick={onSave}>
          <Save className="mr-1 h-3.5 w-3.5" /> Save Integration
        </Button>
      </div>
    </div>
  );
}
