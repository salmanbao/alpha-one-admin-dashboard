"use client";

/**
 * M1 — Connector Configuration Drawer (spec 5.2).
 *
 * A right-side Sheet for inspecting and editing one connector without
 * leaving the hub. Generated from the connector config schema, so every
 * connector gets the same anatomy with provider-specific fields.
 *
 * Regions: drawer header → connection summary → credentials (dynamic
 * form + API-key-format collapsible) → options (active / event logging
 * / audience target / sync frequency) → footer (Test Connection,
 * Disconnect, Save).
 *
 * Dummy data only. Save validates client-side, persists to the local
 * store (which writes an audit entry with field names only) and toasts;
 * Test Connection runs against the current, possibly unsaved values.
 */

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/platform/status";
import {
  AUTH_KIND_LABEL,
  CONNECTOR_STATUS_LABEL,
  connectorStatusTone,
} from "./types";
import { getConnectorDefinition } from "./registry";
import {
  disconnectConnector,
  getConnector,
  saveConnectorConfig,
  testConnectorValues,
  useConnectorVersion,
  type TestResult,
} from "./connector-store";
import { ConfigFieldControl, validateConfig, type FieldErrors } from "./config-fields";
import { absoluteTime, relativeTime } from "./format";
import { ChevronDown, Copy, Loader2, Zap } from "lucide-react";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | ({ status: "ok" } & TestResult)
  | ({ status: "fail" } & TestResult);

const SYNC_OPTIONS = [
  { value: "15m", label: "Every 15 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
] as const;

/** Dummy audience targets — replaced by M3 segment options later. */
const AUDIENCE_OPTIONS = [
  { value: "all-contacts", label: "All contacts" },
  { value: "subscribers", label: "Subscribers" },
  { value: "customers", label: "Customers" },
  { value: "trial-users", label: "Trial users" },
] as const;

/** Endpoint host from a base URL (custom REST connectors). */
function endpointHost(url?: string): string {
  if (!url) return "—";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ConnectorDrawer({
  recordId,
  onClose,
}: {
  recordId: string | null;
  onClose: () => void;
}) {
  useConnectorVersion();
  const record = recordId ? getConnector(recordId) : undefined;
  const def = record ? getConnectorDefinition(record.definitionId) : undefined;

  /* Form state — reset whenever a different connector is opened. */
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(false);
  const [logging, setLogging] = useState(true);
  const [syncFreq, setSyncFreq] = useState<"15m" | "hourly" | "daily">("hourly");
  const [audience, setAudience] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!recordId) return;
    const rec = getConnector(recordId);
    if (!rec) return;
    setValues({ ...rec.config });
    setActive(rec.active);
    setLogging(rec.eventLogging);
    setSyncFreq(rec.syncFrequency ?? "hourly");
    setAudience(rec.audienceTarget ?? "");
    setSaving(false);
    setTest({ status: "idle" });
    setConfirmText("");
    setReady(false);
    // Brief skeleton for header, summary and form (spec 5.2 states).
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, [recordId]);

  /* Live validation — errors render inline and disable Save. */
  const errors: FieldErrors = validateConfig(def, values);

  const setField = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const onCopyWebhook = async () => {
    const url = values.webhook_url ?? record?.config.webhook_url ?? "";
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access was denied by the browser.",
        variant: "destructive",
      });
    }
  };

  const onTest = async () => {
    if (!def) return;
    setTest({ status: "running" });
    const res = await testConnectorValues(def.id, values);
    setTest({ status: res.ok ? "ok" : "fail", ...res });
  };

  const onSave = () => {
    if (!recordId || !def || !record) return;
    const errs = validateConfig(def, values);
    if (Object.keys(errs).length > 0) {
      // Scroll to the first invalid field (spec 5.2 error state).
      const first = def.fields.find((f) => errs[f.key]);
      if (first) {
        document
          .getElementById(`cfg-${first.key}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast({
        title: "Fix the highlighted fields",
        description: "The configuration was not saved.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const invalidKeys = saveConnectorConfig(recordId, {
      config: values,
      active,
      eventLogging: logging,
      syncFrequency: syncFreq,
      audienceTarget: def.category === "Email" && audience ? audience : undefined,
    });
    setSaving(false);
    if (invalidKeys.length > 0) {
      toast({
        title: "Save failed",
        description:
          invalidKeys[0] === "__missing"
            ? "This connector no longer exists."
            : `Invalid JSON in: ${invalidKeys.join(", ")}. Nothing was written.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Integration saved",
      description: `${def.name} updated — the audit trail records the changed field names only.`,
    });
  };

  const onDisconnect = () => {
    if (!recordId || !def) return;
    disconnectConnector(recordId);
    setDisconnectOpen(false);
    setConfirmText("");
    onClose();
    toast({
      title: "Connector disconnected",
      description: `${def.name} credentials were purged and event sync stopped.`,
    });
  };

  const open = recordId !== null && record !== undefined;
  const name = def?.name ?? record?.definitionId ?? "";
  const isEsp = def?.category === "Email";
  const webhookUrl = values.webhook_url ?? record?.config.webhook_url;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="gap-0 p-0 sm:max-w-lg">
        {!ready || !record || !def ? (
          <>
            <SheetTitle className="sr-only">Configure connector</SheetTitle>
            <div className="flex flex-col gap-4 p-4" aria-hidden="true">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-9 w-full" />
            </div>
          </>
        ) : (
          <>
            {/* ───────── Drawer header ───────── */}
            <SheetHeader className="border-b px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  <def.icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base">{name}</SheetTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{def.category}</Badge>
                    <StatusBadge tone={connectorStatusTone(record.status)}>
                      {CONNECTOR_STATUS_LABEL[record.status]}
                    </StatusBadge>
                    <span className="text-[11px] text-muted-foreground">
                      {record.connectedAt
                        ? `Connected ${relativeTime(record.connectedAt)}`
                        : "Not connected yet"}
                    </span>
                  </div>
                </div>
              </div>
              <SheetDescription className="text-xs text-muted-foreground">
                {def.description}
              </SheetDescription>
            </SheetHeader>

            {/* ───────── Scrollable body ───────── */}
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {/* Connection summary — two-column facts */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border bg-muted/30 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Auth kind</p>
                  <p className="font-medium text-foreground">
                    {AUTH_KIND_LABEL[def.authKind]}
                  </p>
                </div>
                {def.authKind === "oauth2" ? (
                  <div>
                    <p className="text-muted-foreground">Scopes</p>
                    <p className="truncate font-medium text-foreground" title={def.scopes?.join(" ")}>
                      {def.scopes?.length ? `${def.scopes.length} requested` : "—"}
                    </p>
                  </div>
                ) : def.authKind === "custom_rest" ? (
                  <div>
                    <p className="text-muted-foreground">Endpoint host</p>
                    <p className="truncate font-medium text-foreground">
                      {endpointHost(values.base_url ?? record.config.base_url)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground">Credentials</p>
                    <p className="font-medium text-foreground">
                      {Object.keys(record.config).length} field
                      {Object.keys(record.config).length === 1 ? "" : "s"} stored
                    </p>
                  </div>
                )}
                {def.authKind === "webhook" ? (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Webhook URL</p>
                    <div className="flex items-center gap-1.5">
                      <code className="truncate rounded bg-background px-1 py-0.5 text-[11px]">
                        {webhookUrl || "—"}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => void onCopyWebhook()}
                        disabled={!webhookUrl}
                        aria-label="Copy webhook URL"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground">Last sync</p>
                  <p className="font-medium text-foreground" title={absoluteTime(record.lastSync)}>
                    {relativeTime(record.lastSync)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next sync</p>
                  <p className="font-medium text-foreground" title={absoluteTime(record.nextSync)}>
                    {record.nextSync && record.active
                      ? relativeTime(record.nextSync).replace("ago", "from now").replace("just now", "due")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Credentials — one control per schema entry */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Credentials
                </h3>
                {def.fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This connector stores no local credentials.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {def.fields.map((f) => (
                      <ConfigFieldControl
                        key={f.key}
                        field={f}
                        idPrefix="cfg"
                        value={values[f.key] ?? ""}
                        error={errors[f.key]}
                        onChange={(v) => setField(f.key, v)}
                      />
                    ))}
                  </div>
                )}

                {def.secretExample ? (
                  <Collapsible className="rounded-lg border">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
                      >
                        API key format for this platform
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="overflow-x-auto border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                        {def.secretExample}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </section>

              {/* Options */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Options
                </h3>
                <div className="space-y-2.5 rounded-lg border p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-foreground">Is Active</span>
                      <span className="text-[11px] text-muted-foreground">
                        Dispatch events through this connector.
                      </span>
                    </span>
                    <Switch
                      checked={active}
                      onCheckedChange={setActive}
                      disabled={record.status === "disconnected"}
                      aria-label="Is active"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        Enable Event Logging
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Keep a queryable trail of every delivery and sync.
                      </span>
                    </span>
                    <Switch
                      checked={logging}
                      onCheckedChange={setLogging}
                      aria-label="Enable event logging"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {isEsp ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="cfg-audience" className="text-xs font-medium">
                        Default audience sync target
                      </Label>
                      <Select value={audience} onValueChange={setAudience}>
                        <SelectTrigger id="cfg-audience" className="w-full">
                          <SelectValue placeholder="No default target" />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIENCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="cfg-sync" className="text-xs font-medium">
                      Sync frequency
                    </Label>
                    <Select
                      value={syncFreq}
                      onValueChange={(v) => setSyncFreq(v as typeof syncFreq)}
                    >
                      <SelectTrigger id="cfg-sync" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYNC_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            </div>

            {/* ───────── Footer ───────── */}
            <SheetFooter className="gap-2 border-t">
              {/* Test result — rendered inline before any save */}
              {test.status === "running" ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing connection with the
                  current values…
                </p>
              ) : test.status === "ok" ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    Connection test passed · {test.latencyMs} ms
                  </p>
                  {test.accountLabel ? (
                    <p className="text-muted-foreground">Account: {test.accountLabel}</p>
                  ) : null}
                </div>
              ) : test.status === "fail" ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs"
                >
                  <p className="font-medium text-rose-700 dark:text-rose-400">
                    Connection test failed
                  </p>
                  <p className="text-muted-foreground">{test.message}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onTest()}
                  disabled={test.status === "running"}
                >
                  {test.status === "running" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="mr-1 h-3.5 w-3.5" />
                  )}
                  Test Connection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => {
                    setConfirmText("");
                    setDisconnectOpen(true);
                  }}
                >
                  Disconnect
                </Button>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={onSave}
                  disabled={saving || Object.keys(errors).length > 0}
                >
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>

      {/* Disconnect — typed confirmation (spec 5.1/5.2) */}
      <AlertDialog
        open={disconnectOpen}
        onOpenChange={(o) => {
          if (!o) setDisconnectOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This purges the stored credentials and stops all event sync. Type{" "}
              <span className="font-medium text-foreground">{name}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={name}
            aria-label={`Type ${name} to confirm`}
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== name}
              className="bg-rose-600 hover:bg-rose-700 disabled:bg-muted disabled:text-muted-foreground"
              onClick={onDisconnect}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
