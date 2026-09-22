"use client";

/**
 * PFaaS Platform — Onboarding Wizard
 *
 * Guided setup for new tenants. Shows a multi-step wizard with:
 * 1. Welcome (tenant basics)
 * 2. Module selection (enable core modules)
 * 3. Branding (pick primary color)
 * 4. Team setup (invite users)
 * 5. Review & finish
 *
 * Shows on first visit (localStorage flag) or when triggered from
 * Settings. Skipped tenants won't see it again.
 */

import { useState, useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Package,
  Palette,
  Users,
  Sparkles,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ONBOARDED_KEY = "pfaas:onboarded";

interface WizardState {
  step: number;
  selectedModules: Set<string>;
  primaryColor: string;
  invitedEmails: string[];
  emailInput: string;
}

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Rocket },
  { id: "modules", label: "Modules", icon: Package },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "team", label: "Team", icon: Users },
  { id: "review", label: "Finish", icon: CheckCircle2 },
];

const COLOR_PRESETS = [
  { name: "Forest", value: "#4a7c59", accent: "#705c30" },
  { name: "Sage", value: "#5a7c4a", accent: "#8a6d30" },
  { name: "Deep Green", value: "#4a6c59", accent: "#705c30" },
  { name: "Golden Brown", value: "#705c30", accent: "#4a7c59" },
  { name: "Warm Taupe", value: "#8a7560", accent: "#4a7c59" },
  { name: "Slate Green", value: "#5a7060", accent: "#705c30" },
];

export function OnboardingWizard() {
  const { runtime, tenant, setTenant, availableTenants } = usePlatform();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<WizardState>({
    step: 0,
    selectedModules: new Set(["trading", "challenges", "risk", "payouts"]),
    primaryColor: tenant.branding.primaryColor,
    invitedEmails: [],
    emailInput: "",
  });

  // Check if onboarding should show (first visit for this tenant)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onboarded = window.localStorage.getItem(`${ONBOARDED_KEY}:${tenant.id}`);
    if (!onboarded) {
      // Show onboarding after a short delay so the dashboard loads first
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [tenant.id]);

  const skipOnboarding = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${ONBOARDED_KEY}:${tenant.id}`, "skipped");
    }
    setOpen(false);
  };

  const completeOnboarding = () => {
    // Apply module selection to tenant
    const updated = {
      ...tenant,
      enabledModules: Array.from(state.selectedModules),
      branding: {
        ...tenant.branding,
        primaryColor: state.primaryColor,
        accentColor: COLOR_PRESETS.find((c) => c.value === state.primaryColor)?.accent ?? tenant.branding.accentColor,
      },
    };
    setTenant(updated);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${ONBOARDED_KEY}:${tenant.id}`, "completed");
    }
    setOpen(false);
    toast({
      title: "Setup complete!",
      description: `Welcome to ${tenant.branding.name}. Your dashboard is ready.`,
    });
  };

  const nextStep = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, STEPS.length - 1) }));
  const prevStep = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) }));

  const toggleModule = (id: string) => {
    setState((s) => {
      const next = new Set(s.selectedModules);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, selectedModules: next };
    });
  };

  const addEmail = () => {
    const email = state.emailInput.trim();
    if (!email || !email.includes("@")) return;
    setState((s) => ({ ...s, invitedEmails: [...s.invitedEmails, email], emailInput: "" }));
  };

  const removeEmail = (email: string) => {
    setState((s) => ({ ...s, invitedEmails: s.invitedEmails.filter((e) => e !== email) }));
  };

  const allModules = moduleRegistry.getAll().filter(
    (m) => m.manifest.supportedApplications?.includes(tenant.application) && m.manifest.id !== "settings" && m.manifest.id !== "super-admin"
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skipOnboarding(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Header with steps */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base">Tenant Setup Wizard</DialogTitle>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={skipOnboarding} aria-label="Skip onboarding">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Let's get {tenant.branding.name} configured in a few quick steps.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = i < state.step;
            const active = i === state.step;
            return (
              <div key={step.id} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-center">
                  {i > 0 ? <div className={cn("h-0.5 flex-1", i <= state.step ? "bg-primary" : "bg-muted")} /> : null}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  {i < STEPS.length - 1 ? <div className={cn("h-0.5 flex-1", i < state.step ? "bg-primary" : "bg-muted")} /> : null}
                </div>
                <span className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[280px] py-2">
          {state.step === 0 ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg" style={{ background: tenant.branding.primaryColor }}>
                  {tenant.branding.initials}
                </div>
                <h3 className="text-lg font-semibold">Welcome to {tenant.branding.name}!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your prop firm dashboard is almost ready. This wizard will guide you through
                  selecting modules, branding, and inviting your team.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="font-medium">{tenant.branding.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium capitalize">{tenant.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Currency</p>
                  <p className="font-medium">{tenant.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timezone</p>
                  <p className="font-medium">{tenant.timezone}</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Takes ~2 minutes · You can change everything later in Settings
              </p>
            </div>
          ) : null}

          {state.step === 1 ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Select your modules</h3>
                <p className="text-xs text-muted-foreground">Choose which modules to enable. You can change this anytime in Settings.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allModules.map((m) => {
                  const Icon = m.manifest.icon;
                  const enabled = state.selectedModules.has(m.manifest.id);
                  return (
                    <button
                      key={m.manifest.id}
                      onClick={() => toggleModule(m.manifest.id)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                        enabled ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="rounded-md p-1.5" style={{ background: `${m.manifest.accentColor}1a`, color: m.manifest.accentColor }}>
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{m.manifest.name}</span>
                          {m.manifest.optional ? <Badge variant="outline" className="text-[8px]">optional</Badge> : <Badge variant="secondary" className="text-[8px]">core</Badge>}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{m.manifest.description}</p>
                      </div>
                      <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", enabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                        {enabled ? <Check className="h-2.5 w-2.5" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{state.selectedModules.size} modules selected</p>
            </div>
          ) : null}

          {state.step === 2 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Choose your brand colors</h3>
                <p className="text-xs text-muted-foreground">This customizes the primary color across your dashboard.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setState((s) => ({ ...s, primaryColor: c.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all hover:shadow-sm",
                      state.primaryColor === c.value ? "border-foreground ring-2 ring-foreground/20" : "border-border"
                    )}
                  >
                    <span className="h-8 w-8 rounded-full" style={{ background: c.value }} />
                    <span className="text-[10px] font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
              {/* Live preview */}
              <div className="rounded-lg border p-4" style={{ background: tenant.branding.surfaceColor }}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white" style={{ background: state.primaryColor }}>
                    {tenant.branding.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: state.primaryColor }}>{tenant.branding.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.branding.tagline}</p>
                  </div>
                  <Button size="sm" className="ml-auto text-white" style={{ background: state.primaryColor }}>Brand button</Button>
                </div>
              </div>
            </div>
          ) : null}

          {state.step === 3 ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Invite your team</h3>
                <p className="text-xs text-muted-foreground">Add team members who will have access to this dashboard.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={state.emailInput}
                  onChange={(e) => setState((s) => ({ ...s, emailInput: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder="colleague@company.com"
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button size="sm" onClick={addEmail} disabled={!state.emailInput.includes("@")}>Invite</Button>
              </div>
              {state.invitedEmails.length > 0 ? (
                <div className="space-y-1.5">
                  {state.invitedEmails.map((email) => (
                    <div key={email} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {email[0]?.toUpperCase()}
                      </div>
                      <span className="flex-1 truncate text-xs">{email}</span>
                      <Badge variant="outline" className="text-[9px]">Invited</Badge>
                      <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${email}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">You can skip this step and invite users later.</p>
              )}
            </div>
          ) : null}

          {state.step === 4 ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold">Ready to go!</h3>
                <p className="mt-1 text-sm text-muted-foreground">Here's a summary of your setup:</p>
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modules enabled</span>
                  <span className="font-medium">{state.selectedModules.size} modules</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primary color</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: state.primaryColor }} />
                    {COLOR_PRESETS.find((c) => c.value === state.primaryColor)?.name ?? "Custom"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team invites</span>
                  <span className="font-medium">{state.invitedEmails.length} user{state.invitedEmails.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                You can change all of these anytime in Settings.
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" size="sm" onClick={skipOnboarding}>
            Skip setup
          </Button>
          <div className="flex gap-2">
            {state.step > 0 ? (
              <Button variant="outline" size="sm" onClick={prevStep} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : null}
            {state.step < STEPS.length - 1 ? (
              <Button size="sm" onClick={nextStep} className="gap-1">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={completeOnboarding} className="gap-1.5">
                <Check className="h-4 w-4" /> Complete setup
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
