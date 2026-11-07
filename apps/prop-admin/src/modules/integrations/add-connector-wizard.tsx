"use client";

/**
 * M1 — Add Connector Wizard (spec 5.3).
 *
 * A three-step sheet that installs any registry connector:
 *   1. Catalog — searchable card grid grouped by category,
 *   2. Connect — dynamic form from the config schema + help panel,
 *   3. Verify & activate — test result, event logging, audience target.
 *
 * OAuth kinds route through a simulated provider consent step before
 * the test run. A failed test renders a danger card naming the invalid
 * field and keeps the wizard on step 2 with values retained.
 *
 * Dummy data only — no network calls. Finish lands the connector in
 * Connected state, records it as the session's last-created connector
 * (the activity log preselects it) and toasts Connection established.
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/platform/guards";
import {
  AUTH_KIND_LABEL,
  type ConnectorDefinition,
} from "./types";
import { getConnectorDefinition, groupDefinitionsByCategory } from "./registry";
import { addConnector, testConnectorValues, type TestResult } from "./connector-store";
import { ConfigFieldControl, validateConfig, type FieldErrors } from "./config-fields";
import { Check, ExternalLink, Loader2, Search, Workflow, X } from "lucide-react";

type Step = 1 | 2 | 3;

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | ({ status: "ok" } & TestResult)
  | ({ status: "fail" } & TestResult);

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Catalog" },
  { n: 2, label: "Connect" },
  { n: 3, label: "Verify & activate" },
];

const AUDIENCE_OPTIONS = [
  { value: "all-contacts", label: "All contacts" },
  { value: "subscribers", label: "Subscribers" },
  { value: "customers", label: "Customers" },
  { value: "trial-users", label: "Trial users" },
] as const;

/* ------------------------------------------------------------------ */
/* Stepper header                                                      */
/* ------------------------------------------------------------------ */

function Stepper({
  step,
  onStepClick,
}: {
  step: Step;
  onStepClick: (s: Step) => void;
}) {
  return (
    <ol className="mt-2 flex items-center gap-1" aria-label="Wizard steps">
      {STEPS.map((s, i) => {
        const state = s.n < step ? "done" : s.n === step ? "current" : "upcoming";
        const Circle = state === "done" ? "button" : "span";
        return (
          <li key={s.n} className="flex items-center gap-1">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={`h-px w-6 ${state === "upcoming" ? "bg-border" : "bg-primary"}`}
              />
            ) : null}
            <span className="flex items-center gap-1.5">
              {state === "done" ? (
                <button
                  type="button"
                  onClick={() => onStepClick(s.n)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-label={`Back to step ${s.n}: ${s.label}`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Circle
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    state === "current"
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.n}
                </Circle>
              )}
              <span
                className={`text-xs ${
                  state === "current"
                    ? "font-semibold text-foreground"
                    : state === "done"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

export function AddConnectorWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [query, setQuery] = useState("");
  const [defId, setDefId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [consentOpen, setConsentOpen] = useState(false);
  const [eventLogging, setEventLogging] = useState(true);
  const [audience, setAudience] = useState("");
  const [finishing, setFinishing] = useState(false);

  /* Reset every time the wizard opens. */
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setQuery("");
    setDefId(null);
    setValues({});
    setTest({ status: "idle" });
    setConsentOpen(false);
    setEventLogging(true);
    setAudience("");
    setFinishing(false);
  }, [open]);

  const def = defId ? getConnectorDefinition(defId) : undefined;
  const errors: FieldErrors = validateConfig(def, values);

  const setField = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  /* ── Step 1: catalog ── */
  const q = query.trim().toLowerCase();
  const groups = groupDefinitionsByCategory()
    .map((g) => ({
      ...g,
      definitions: g.definitions.filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.definitions.length > 0);

  const pickDefinition = (d: ConnectorDefinition) => {
    if (d.id !== defId) setValues({});
    setDefId(d.id);
    setTest({ status: "idle" });
    setStep(2);
  };

  /* ── Step 2 → 3: consent (OAuth) then test ── */
  const runTestAndAdvance = async () => {
    if (!def) return;
    setTest({ status: "running" });
    const res = await testConnectorValues(def.id, values);
    if (res.ok) {
      setTest({ status: "ok", ...res });
      setStep(3);
    } else {
      // Failed test: danger card + stay on step 2 with values retained.
      setTest({ status: "fail", ...res });
    }
  };

  const onContinue = () => {
    if (!def || Object.keys(errors).length > 0) return;
    if (def.authKind === "oauth2") {
      setConsentOpen(true);
      return;
    }
    void runTestAndAdvance();
  };

  /* ── Step 3: finish ── */
  const onFinish = () => {
    if (!def) return;
    setFinishing(true);
    // Simulated record creation — Finish disables while it runs.
    setTimeout(() => {
      addConnector(def.id, values, {
        eventLogging,
        audienceTarget: def.category === "Email" && audience ? audience : undefined,
      });
      setFinishing(false);
      onOpenChange(false);
      toast({
        title: "Connection established",
        description: `${def.name} is connected and will start syncing on the next cycle.`,
      });
    }, 400);
  };

  /* ---------------------------------------------------------------- */

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">Add Connector</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Pick a platform from the registry, authenticate it, verify the connection.
          </SheetDescription>
          <Stepper
            step={step}
            onStepClick={(s) => {
              // Completed steps navigate back without losing state.
              if (s < step) setStep(s);
            }}
          />
        </SheetHeader>

        {/* ───────── Step 1 — Catalog ───────── */}
        {step === 1 ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the catalog…"
                className="pl-8"
                aria-label="Search connector catalog"
              />
            </div>

            {groups.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No connectors match your search"
                description={`Nothing in the registry matches “${query}”.`}
                action={
                  <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <section key={g.category}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.category}
                    </h3>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {g.definitions.map((d) => {
                        const selected = d.id === defId;
                        return (
                          <div
                            key={d.id}
                            className={`rounded-lg border p-3 transition-colors ${
                              selected
                                ? "border-primary bg-primary/5"
                                : "bg-card hover:border-primary/40"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => pickDefinition(d)}
                              className="flex w-full flex-col gap-1.5 text-left"
                            >
                              <span className="flex items-start gap-2">
                                <span className="rounded-md bg-muted p-1.5">
                                  <d.icon className="h-3.5 w-3.5 text-foreground" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-foreground">
                                    {d.name}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                    {d.description}
                                  </span>
                                </span>
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px]">
                                  {AUTH_KIND_LABEL[d.authKind]}
                                </Badge>
                                <Badge
                                  variant={d.origin === "built-in" ? "outline" : "default"}
                                  className="text-[10px]"
                                >
                                  {d.origin === "built-in" ? "Built-in" : "Community"}
                                </Badge>
                              </span>
                            </button>
                            {d.customBuilder ? (
                              <button
                                type="button"
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (d.origin === "community") {
                                    // Deep-link to the Custom Connector Builder with the definition pre-selected.
                                    window.location.href = `?view=connector-custom-new&def=${d.id}`;
                                  } else {
                                    pickDefinition(d);
                                  }
                                }}
                              >
                                <Workflow className="h-3 w-3" />
                                {d.origin === "community"
                                  ? "Open in Custom Builder"
                                  : "Configure manually"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : step === 2 ? (
          /* ───────── Step 2 — Connect ───────── */
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_230px]">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-md bg-muted p-1.5">
                    {def ? <def.icon className="h-4 w-4 text-foreground" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{def?.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {def ? `${def.category} · ${AUTH_KIND_LABEL[def.authKind]}` : ""}
                    </p>
                  </div>
                </div>

                {/* Failed test — danger card naming the invalid field */}
                {test.status === "fail" ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs"
                  >
                    <p className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                      <X className="h-3.5 w-3.5" /> Connection test failed
                    </p>
                    <p className="mt-1 text-muted-foreground">{test.message}</p>
                    <p className="mt-1 text-muted-foreground">
                      Fix the highlighted field and continue to re-test — your values are kept.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3.5">
                  {(def?.fields ?? []).map((f) => (
                    <ConfigFieldControl
                      key={f.key}
                      field={f}
                      idPrefix="wiz"
                      value={values[f.key] ?? ""}
                      error={errors[f.key]}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Help panel */}
              <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-3 text-xs">
                {def?.authKind === "oauth2" && def.scopes?.length ? (
                  <div>
                    <p className="mb-1 font-medium text-foreground">Required scopes</p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {def.scopes.map((s) => (
                        <li key={s} className="truncate font-mono text-[11px]" title={s}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {def?.secretExample ? (
                  <div>
                    <p className="mb-1 font-medium text-foreground">API key format</p>
                    <pre className="overflow-x-auto rounded bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
                      {def.secretExample}
                    </pre>
                  </div>
                ) : null}
                {def?.docsUrl ? (
                  <a
                    href={def.docsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Provider documentation <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                <p className="text-muted-foreground">
                  Secrets are stored masked and never rendered in list views.
                </p>
              </aside>
            </div>
          </div>
        ) : (
          /* ───────── Step 3 — Verify & activate ───────── */
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Test result card */}
            {test.status === "ok" ? (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  Connection verified
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Latency</p>
                    <p className="font-medium text-foreground">{test.latencyMs} ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account / workspace</p>
                    <p className="truncate font-medium text-foreground">
                      {test.accountLabel ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : test.status === "running" ? (
              <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Testing connection…
              </div>
            ) : (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No test has run yet.
              </div>
            )}

            <div className="space-y-2.5 rounded-lg border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-foreground">Event logging</span>
                  <span className="text-[11px] text-muted-foreground">
                    Keep a queryable trail of every delivery and sync (on by default).
                  </span>
                </span>
                <Switch
                  checked={eventLogging}
                  onCheckedChange={setEventLogging}
                  aria-label="Event logging"
                />
              </label>

              {def?.category === "Email" ? (
                <div className="space-y-1.5 border-t pt-3">
                  <Label htmlFor="wiz-audience" className="text-xs font-medium">
                    Initial audience sync target
                  </Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger id="wiz-audience" className="w-full">
                      <SelectValue placeholder="No default target (optional)" />
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
            </div>
          </div>
        )}

        {/* ───────── Footer ───────── */}
        <SheetFooter className="gap-2 border-t">
          <div className="flex w-full items-center gap-2">
            {step > 1 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={finishing}
              >
                Back
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {step === 1 ? (
                <Button size="sm" disabled={!defId} onClick={() => setStep(2)}>
                  Continue
                </Button>
              ) : step === 2 ? (
                <Button
                  size="sm"
                  onClick={onContinue}
                  disabled={Object.keys(errors).length > 0 || test.status === "running"}
                >
                  {test.status === "running" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {def?.authKind === "oauth2" ? "Authorize & test" : "Test & continue"}
                </Button>
              ) : (
                <Button size="sm" onClick={onFinish} disabled={finishing}>
                  {finishing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Finish
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>

      {/* Simulated OAuth consent screen (spec 5.3 interactions) */}
      <AlertDialog open={consentOpen} onOpenChange={setConsentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue to {def?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be redirected to {def?.name} to approve the requested scopes.
              Tokens are stored server-side and never in the browser.
              {def?.scopes?.length ? (
                <span className="mt-2 block font-mono text-[11px] text-foreground">
                  {def.scopes.join(" · ")}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConsentOpen(false);
                void runTestAndAdvance();
              }}
            >
              Approve & continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
