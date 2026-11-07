"use client";

/**
 * M1 — Custom Connector Builder (spec 5.5).
 *
 * A guided form that turns any REST API with webhooks into a managed
 * connector, explicitly targeting self-hosted open-source platforms
 * (Listmonk, Mautic, phpList, n8n). This is the screen that makes the
 * platform open rather than locked to seven vendors.
 *
 * Regions: PageHeader (Back + Save) → Step rail (Basics → Auth →
 * Events → Test) → Form panel (schema-driven) → Preview panel.
 *
 * Dummy data only — no network calls. The builder validates the form
 * client-side, writes a new connector record to the store, and toasts
 * success.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Copy,
  FlaskConical,
  Plus,
  Save,
  Trash2,
  Webhook,
  Workflow,
} from "lucide-react";
import { getConnectors, saveConnectorConfig } from "../connector-store";
import { getConnectorDefinition } from "../registry";

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ──────────────────────────────────────────────────────────────────── */

interface CustomEventMapping {
  id: string;
  platformEvent: string;
  connectorEvent: string;
  direction: "inbound" | "outbound";
}

interface BuilderState {
  name: string;
  baseUrl: string;
  authType: "api_key" | "basic" | "bearer" | "oauth2" | "custom_header";
  authValue: string;
  authHeaderName: string;
  webhookUrl: string;
  eventMappings: CustomEventMapping[];
  active: boolean;
  eventLogging: boolean;
}

const STEPS = ["Basics", "Authentication", "Events", "Test"] as const;
type Step = (typeof STEPS)[number];

const AUTH_TYPE_OPTIONS: Array<{ value: BuilderState["authType"]; label: string; help: string }> = [
  { value: "api_key", label: "API Key", help: "Sent as X-API-Key header." },
  { value: "basic", label: "Basic Auth", help: "username:password base64-encoded." },
  { value: "bearer", label: "Bearer Token", help: "Sent as Authorization: Bearer <token>." },
  { value: "oauth2", label: "OAuth 2.0", help: "Client credentials or authorization code flow." },
  { value: "custom_header", label: "Custom Header", help: "Any header name + value." },
];

const INITIAL_STATE: BuilderState = {
  name: "",
  baseUrl: "",
  authType: "api_key",
  authValue: "",
  authHeaderName: "X-API-Key",
  webhookUrl: "",
  eventMappings: [],
  active: true,
  eventLogging: true,
};

/* ──────────────────────────────────────────────────────────────────── */
/* Component                                                           */
/* ──────────────────────────────────────────────────────────────────── */

export function CustomConnectorBuilderPage() {
  const [step, setStep] = useState<Step>("Basics");
  const [form, setForm] = useState<BuilderState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<"idle" | "running" | "ok" | "fail">("idle");

  const stepIndex = STEPS.indexOf(step);

  /* ── Validation ── */

  function validateBasics(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Connector name is required.";
    if (!form.baseUrl.trim()) e.baseUrl = "Base URL is required.";
    else if (!/^https?:\/\//.test(form.baseUrl)) e.baseUrl = "Must start with http:// or https://.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateAuth(): boolean {
    const e: Record<string, string> = {};
    if (form.authType === "custom_header" && !form.authHeaderName.trim())
      e.authHeaderName = "Header name is required.";
    if (form.authType !== "oauth2" && !form.authValue.trim())
      e.authValue = "Credential value is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateEvents(): boolean {
    const e: Record<string, string> = {};
    if (form.eventMappings.length === 0)
      e.eventMappings = "Add at least one event mapping.";
    for (const m of form.eventMappings) {
      if (!m.platformEvent.trim()) e[`map-${m.id}-platform`] = "Platform event is required.";
      if (!m.connectorEvent.trim()) e[`map-${m.id}-connector`] = "Connector event is required.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Navigation ── */

  function goNext() {
    if (step === "Basics" && !validateBasics()) return;
    if (step === "Authentication" && !validateAuth()) return;
    if (step === "Events" && !validateEvents()) return;
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  }

  /* ── Test connection (dummy) ── */

  function runTest() {
    setTesting("running");
    setTimeout(() => {
      const ok = form.baseUrl.includes("example") || form.baseUrl.includes("localhost") || form.authValue.length > 3;
      setTesting(ok ? "ok" : "fail");
      if (ok) {
        toast({ title: "Connection OK", description: `${form.name} responded in 240 ms.` });
      } else {
        toast({ title: "Connection failed", description: "Check your credentials and base URL." });
      }
    }, 800);
  }

  /* ── Save ── */

  function handleSave() {
    if (!validateBasics()) { setStep("Basics"); return; }
    if (!validateAuth()) { setStep("Authentication"); return; }
    if (!validateEvents()) { setStep("Events"); return; }

    const config: Record<string, string> = {
      base_url: form.baseUrl,
      auth_type: form.authType,
    };
    if (form.authType === "custom_header") config.auth_header = form.authHeaderName;
    if (form.authValue) config.auth_value = form.authValue;
    if (form.webhookUrl) config.webhook_url = form.webhookUrl;
    config.event_mappings = JSON.stringify(form.eventMappings);

    // Write to the connector store
    const newId = `con-custom-${Date.now()}`;
    saveConnectorConfig(newId, config);

    toast({
      title: "Custom connector created",
      description: `${form.name} is now available in your integrations hub.`,
    });

    // Reset
    setForm(INITIAL_STATE);
    setStep("Basics");
  }

  /* ── Event mapping helpers ── */

  function addMapping() {
    setForm((f) => ({
      ...f,
      eventMappings: [
        ...f.eventMappings,
        {
          id: `map-${Date.now()}`,
          platformEvent: "",
          connectorEvent: "",
          direction: "inbound",
        },
      ],
    }));
  }

  function updateMapping(id: string, patch: Partial<CustomEventMapping>) {
    setForm((f) => ({
      ...f,
      eventMappings: f.eventMappings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function removeMapping(id: string) {
    setForm((f) => ({
      ...f,
      eventMappings: f.eventMappings.filter((m) => m.id !== id),
    }));
  }

  /* ── Render ── */

  return (
    <Page>
      <PageHeader
        title="Custom Connector Builder"
        description="Turn any REST API with webhooks into a managed connector. Designed for self-hosted platforms like Listmonk, Mautic, phpList and n8n."
        icon={Workflow}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="mr-1 h-4 w-4" /> Save Connector
            </Button>
          </div>
        }
      />

      <PageContent>
        {/* Step rail */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <button
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : i < stepIndex
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
                onClick={() => {
                  // Allow going back to any completed step
                  if (i <= stepIndex) setStep(s);
                }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-xs">
                  {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 mx-1 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main form panel */}
          <div>
            {step === "Basics" && (
              <BasicsStep form={form} setForm={setForm} errors={errors} />
            )}
            {step === "Authentication" && (
              <AuthStep form={form} setForm={setForm} errors={errors} />
            )}
            {step === "Events" && (
              <EventsStep
                form={form}
                addMapping={addMapping}
                updateMapping={updateMapping}
                removeMapping={removeMapping}
                errors={errors}
              />
            )}
            {step === "Test" && (
              <TestStep form={form} testing={testing} runTest={runTest} />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {step === "Test" ? (
                <Button onClick={handleSave}>
                  <Save className="mr-1 h-4 w-4" /> Save Connector
                </Button>
              ) : (
                <Button onClick={goNext}>
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Preview panel */}
          <div className="space-y-4">
            <PreviewPanel form={form} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step components                                                     */
/* ──────────────────────────────────────────────────────────────────── */

function BasicsStep({
  form,
  setForm,
  errors,
}: {
  form: BuilderState;
  setForm: (f: BuilderState) => void;
  errors: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connector Basics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="cb-name">Connector name *</Label>
          <Input
            id="cb-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="My Listmonk Instance"
            className="mt-1"
          />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="cb-url">Base URL *</Label>
          <Input
            id="cb-url"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://lists.example.com"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The root URL of your API. All requests will be prefixed with this.
          </p>
          {errors.baseUrl && <p className="text-sm text-destructive mt-1">{errors.baseUrl}</p>}
        </div>
        <div>
          <Label htmlFor="cb-webhook">Webhook URL (optional)</Label>
          <Input
            id="cb-webhook"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
            placeholder="https://your-app.com/webhooks/listmonk"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Where the platform should send inbound events. Copy this URL into your platform's webhook settings.
          </p>
        </div>
        <Separator />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="cb-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
            <Label htmlFor="cb-active">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cb-logging"
              checked={form.eventLogging}
              onCheckedChange={(v) => setForm({ ...form, eventLogging: v })}
            />
            <Label htmlFor="cb-logging">Event logging</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthStep({
  form,
  setForm,
  errors,
}: {
  form: BuilderState;
  setForm: (f: BuilderState) => void;
  errors: Record<string, string>;
}) {
  const selected = AUTH_TYPE_OPTIONS.find((o) => o.value === form.authType);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Auth type *</Label>
          <Select
            value={form.authType}
            onValueChange={(v) => setForm({ ...form, authType: v as BuilderState["authType"] })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTH_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <p className="text-xs text-muted-foreground mt-1">{selected.help}</p>
          )}
        </div>

        {form.authType === "custom_header" && (
          <div>
            <Label htmlFor="cb-header">Header name *</Label>
            <Input
              id="cb-header"
              value={form.authHeaderName}
              onChange={(e) => setForm({ ...form, authHeaderName: e.target.value })}
              placeholder="X-Custom-Auth"
              className="mt-1"
            />
            {errors.authHeaderName && (
              <p className="text-sm text-destructive mt-1">{errors.authHeaderName}</p>
            )}
          </div>
        )}

        {form.authType !== "oauth2" && (
          <div>
            <Label htmlFor="cb-cred">
              {form.authType === "basic" ? "Credentials (username:password)" : "Credential value"} *
            </Label>
            <Input
              id="cb-cred"
              type="password"
              value={form.authValue}
              onChange={(e) => setForm({ ...form, authValue: e.target.value })}
              placeholder={form.authType === "basic" ? "admin:secret" : "your-api-key-here"}
              className="mt-1"
            />
            {errors.authValue && (
              <p className="text-sm text-destructive mt-1">{errors.authValue}</p>
            )}
          </div>
        )}

        {form.authType === "oauth2" && (
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            OAuth 2.0 flow will be configured after saving. The platform will redirect to your
            provider's consent screen on first connection.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventsStep({
  form,
  addMapping,
  updateMapping,
  removeMapping,
  errors,
}: {
  form: BuilderState;
  addMapping: () => void;
  updateMapping: (id: string, patch: Partial<CustomEventMapping>) => void;
  removeMapping: (id: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Event Mapping</CardTitle>
        <Button variant="outline" size="sm" onClick={addMapping}>
          <Plus className="mr-1 h-4 w-4" /> Add Event
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Map platform events to connector events. Inbound events are received via webhook;
          outbound events are sent via API call.
        </p>

        {form.eventMappings.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No event mappings yet"
            description="Add at least one event mapping to define how this connector handles data."
            action={
              <Button size="sm" onClick={addMapping}>
                <Plus className="mr-1 h-4 w-4" /> Add Event
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {form.eventMappings.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-end gap-3 rounded-md border p-3"
              >
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs">Platform event *</Label>
                  <Input
                    value={m.platformEvent}
                    onChange={(e) => updateMapping(m.id, { platformEvent: e.target.value })}
                    placeholder="subscriber.created"
                    className="mt-1 h-9"
                  />
                  {errors[`map-${m.id}-platform`] && (
                    <p className="text-xs text-destructive mt-1">
                      {errors[`map-${m.id}-platform`]}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs">Connector event *</Label>
                  <Input
                    value={m.connectorEvent}
                    onChange={(e) => updateMapping(m.id, { connectorEvent: e.target.value })}
                    placeholder="contact.sync"
                    className="mt-1 h-9"
                  />
                  {errors[`map-${m.id}-connector`] && (
                    <p className="text-xs text-destructive mt-1">
                      {errors[`map-${m.id}-connector`]}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <Label className="text-xs">Direction</Label>
                  <Select
                    value={m.direction}
                    onValueChange={(v) =>
                      updateMapping(m.id, { direction: v as "inbound" | "outbound" })
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMapping(m.id)}
                  className="h-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {errors.eventMappings && (
          <p className="text-sm text-destructive">{errors.eventMappings}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TestStep({
  form,
  testing,
  runTest,
}: {
  form: BuilderState;
  testing: "idle" | "running" | "ok" | "fail";
  runTest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test Connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send a test request to <code className="text-xs bg-muted px-1 rounded">{form.baseUrl || "(no URL set)"}</code>{" "}
          to verify your credentials.
        </p>

        <div className="flex items-center gap-3">
          <Button onClick={runTest} disabled={testing === "running" || !form.baseUrl}>
            <FlaskConical className="mr-1 h-4 w-4" />
            {testing === "running" ? "Testing…" : "Run Test"}
          </Button>
          {testing === "ok" && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
              <Check className="mr-1 h-3 w-3" /> Connection OK — 240 ms
            </Badge>
          )}
          {testing === "fail" && (
            <Badge variant="outline" className="text-destructive border-destructive/20">
              Connection failed — check credentials
            </Badge>
          )}
        </div>

        {testing === "ok" && (
          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Response</p>
            <pre className="text-xs overflow-x-auto">
{`{
  "status": "ok",
  "version": "2.0",
  "account": "default"
}`}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Preview panel                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function PreviewPanel({ form }: { form: BuilderState }) {
  const configJson = useMemo(() => {
    const cfg: Record<string, unknown> = {
      base_url: form.baseUrl || "(not set)",
      auth_type: form.authType,
    };
    if (form.authType === "custom_header") cfg.auth_header = form.authHeaderName;
    if (form.webhookUrl) cfg.webhook_url = form.webhookUrl;
    if (form.eventMappings.length > 0) {
      cfg.event_mappings = form.eventMappings.map((m) => ({
        platform: m.platformEvent,
        connector: m.connectorEvent,
        direction: m.direction,
      }));
    }
    return JSON.stringify(cfg, null, 2);
  }, [form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connector Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</p>
          <p className="text-sm font-medium mt-0.5">{form.name || "(unnamed)"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Base URL</p>
          <p className="text-sm font-medium mt-0.5 break-all">{form.baseUrl || "(not set)"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auth</p>
          <p className="text-sm font-medium mt-0.5">
            {AUTH_TYPE_OPTIONS.find((o) => o.value === form.authType)?.label ?? form.authType}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Events</p>
          <p className="text-sm font-medium mt-0.5">
            {form.eventMappings.length} mapping{form.eventMappings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Configuration JSON
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => {
                navigator.clipboard.writeText(configJson);
                toast({ title: "Copied", description: "Configuration JSON copied." });
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <pre className="text-[11px] bg-muted p-3 rounded overflow-x-auto max-h-48">
            {configJson}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
