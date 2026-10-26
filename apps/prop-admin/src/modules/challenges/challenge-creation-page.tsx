"use client";

/** 
 * PFaaS Prop Admin — Challenge Creation Workflow
 * Multi-step challenge creation with phase configuration UI.
 * Uses stitch component library consistent with other modules.
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  StitchPageHeader,
  StitchCard,
  StitchCardHeader,
  StitchPill,
  StitchProgress,
  StitchKpi,
  StitchButton,
  StitchSheet,
  StitchConfirm,
  StitchInfoHint,
  StitchSegmented,
  StitchSelect,
} from "@/components/stitch/stitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink">{label}</Label>
      {children}
    </div>
  );
}

function MsIconSafe({ name = "more_vert" }: { name?: string }) {
  return <span aria-hidden className="ms-icon text-[18px] leading-none">{name}</span>;
}

const CHALLENGE_TYPES = ["evaluation", "scaling"] as const;
type ChallengeType = (typeof CHALLENGE_TYPES)[const];

const PHASES = ["phase-1", "phase-2", "phase-3"] as const;
type Phase = (typeof PHASES)[number];

const OBJECTIVES = [
  { id: "daily-loss", label: "Daily Loss Limit", metric: "USD", default: 1000 },
  { id: "max-drawdown", label: "Max Drawdown Limit", metric: "USD", default: 5000 },
  { id: "profit-target", label: "Profit Target", metric: "USD", default: 10000 },
] as const;
type ObjectiveId = (typeof OBJECTIVES)[number]["id"];

export function ChallengeCreationPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const router = useRouter();

  const [step, setStep] = React.useState(1);
  const [challenge, setChallenge] = React.useState<{
    type: ChallengeType;
    name: string;
    description: string;
    phase: Phase;
    objectives: Record<ObjectiveId, number>;
    currency: string;
    traderCount: number;
  }>({
    type: "evaluation",
    name: "",
    description: "",
    phase: "phase-1",
    objectives: {
      "daily-loss": 1000,
      "max-drawdown": 5000,
      "profit-target": 10000,
    },
    currency: "USD",
    traderCount: 1,
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateStep = (s: number): boolean => {
    let valid = true;
    const errors: Record<string, string> = {};

    if (s >= 1) {
      if (!challenge.name?.trim()) errors.name = term("this field is required");
      if (!challenge.description?.trim()) errors.description = term("this field is required");
    }

    if (s >= 2) {
      if (challenge.phase === "phase-1" && challenge.objectives["daily-loss"] <= 0)
        errors["daily-loss"] = term("must be greater than 0");
      if (challenge.phase === "phase-1" && challenge.objectives["max-drawdown"] <= 0)
        errors["max-drawdown"] = term("must be greater than 0");
      if (challenge.objectives["profit-target"] <= 0)
        errors["profit-target"] = term("must be greater than 0");
    }

    setFormErrors(errors);
    valid = Object.keys(errors).length === 0;
    return valid;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const submitChallenge = async () => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Challenge created successfully",
        description: `Challenge "${challenge.name}" is now active.`,
      });
      router.refresh();
      navigate("/traders"); // Redirect to traders or dashboard
    } catch (err) {
      toast({ title: "Failed to create challenge", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-tp transition-colors hover:bg-sfc"
        onClick={() => navigate("/traders")}
      >
        <MsIconSafe name="arrow_back" /> Back to {plural(term("trader")).toLowerCase()}
      </button>

      <StitchPageHeader
        icon="trending_up"
        title={term("create challenge")}
        subtitle={`Configure a new evaluation challenge for your traders`}
        actions={}
      />

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-sfc-low p-1 text-xs font-medium text-ink-variant">
        <div className={cn("bg-tp text-on-primary", step >= 1 ? "") : ""}>{term("basic info")}</div>
        <div className={cn("bg-sfc", step >= 2 ? "") : ""}>{term("phase config")}</div>
        <div className={cn("bg-sfc", step >= 3 ? "") : ""}>{term("summary")}</div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 ? (
        <StitchCard>
          <StitchCardHeader
            icon="create"
            title={term("challenge details")}
            description={term("enter the basic information for your new challenge")}
          />
          <div className="space-y-4">
            <Field label={term("challenge name")}>
              <Input
                className="stitch-input"
                defaultValue={challenge.name}
                onChange={(e) =>
                  setChallenge((c) => ({ ...c, name: e.target.value }))
                }
                placeholder={term("e.g. Evaluation Challenge 30")}
              />
            </Field>
            <Field label={term("description")}>
              <Input
                className="stitch-input"
                defaultValue={challenge.description}
                onChange={(e) =>
                  setChallenge((c) => ({ ...c, description: e.target.value }))
                }
                placeholder={term("e.g. 80/20 profit split, 10% evaluation fee")}
              />
            </Field>
            <Field label={term("trader limit")}>
              <Select
                className="stitch-input"
                onValueChange={(v) =>
                  setChallenge((c) => ({ ...c, traderCount: Number(v) }))
                }
              >
                <SelectItem value={1}>{term("unlimited")}</SelectItem>
                <SelectItem value={5}>{term("max 5 traders")}</SelectItem>
                <SelectItem value={10}>{term("max 10 traders")}</SelectItem>
                <SelectItem value={20}>{term("max 20 traders")}</SelectItem>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <StitchButton variant="surface" onClick={prevStep} disabled={step <= 1}>
              ← {term("previous")}
            </StitchButton>
            <StitchButton variant="primary" onClick={nextStep}>
              {term("next: phase configuration")}
            </StitchButton>
          </div>
        </StitchCard>
      ) : null}

      {/* Step 2: Phase Configuration */}
      {step === 2 ? (
        <StitchCard>
          <StitchCardHeader
            icon="layer_group"
            title={term("phase configuration")}
            description={term("set the evaluation objectives and phase milestones")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Phase selector */}
            <StitchCard>
              <StitchCardHeader icon="tag" title={term("challenge phase")} />
              <div className="grid grid-cols-2 gap-2">
                {PHASES.map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "rounded-lg border p-3 cursor-pointer select-none",
                      challenge.phase === p
                        ? "bg-tp text-on-primary border-tp"
                        : "text-ink-variant hover:bg-sfc",
                    )}
                    onClick={() => setChallenge((c) => ({ ...c, phase: p }))}
                  >
                    <span className="font-bold text-ink">{p}</span>
                    <p className="text-[10px] text-ink-variant">{term(`phase ${PHASES.indexOf(p) + 1} desc`)}</p>
                  </label>
                ))}
              </div>
            </StitchCard>

            {/* Objective meters for selected phase */}
            {challenge.phase === "phase-1" && (
              <StitchCard>
                <StitchCardHeader icon="health_and_safety" title={term("phase-1 objectives")} />
                <div className="space-y-3">
                  <ObjectiveMeter
                    id="daily-loss"
                    label={OBJECTIVES[0].label}
                    metric={OBJECTIVES[0].metric}
                    value={challenge.objectives["daily-loss"]}
                    min={100}
                    max={5000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "daily-loss": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="max-drawdown"
                    label={OBJECTIVES[1].label}
                    metric={OBJECTIVES[1].metric}
                    value={challenge.objectives["max-drawdown"]}
                    min={500}
                    max={20000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "max-drawdown": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="profit-target"
                    label={OBJECTIVES[2].label}
                    metric={OBJECTIVES[2].metric}
                    value={challenge.objectives["profit-target"]}
                    min={1000}
                    max={100000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "profit-target": v } }))
                    }
                  />
                </div>
              </StitchCard>
            )}

            {challenge.phase === "phase-2" && (
              <StitchCard>
                <StitchCardHeader icon="health_and_safety" title={term("phase-2 objectives")} />
                <div className="space-y-3">
                  <ObjectiveMeter
                    id="daily-loss-2"
                    label={term("daily loss (phase 2)")}
                    metric="USD"
                    value={challenge.objectives["daily-loss"] || 2000}
                    min={500}
                    max={10000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "daily-loss": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="max-drawdown-2"
                    label={term("max drawdown (phase 2)")}
                    metric="USD"
                    value={challenge.objectives["max-drawdown"] || 8000}
                    min={1000}
                    max={50000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "max-drawdown": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="profit-target-2"
                    label={term("profit target (phase 2)")}
                    metric="USD"
                    value={challenge.objectives["profit-target"] || 20000}
                    min={5000}
                    max={200000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "profit-target": v } }))
                    }
                  />
                </div>
              </StitchCard>
            )}

            {challenge.phase === "phase-3" && (
              <StitchCard>
                <StitchCardHeader icon="trending_up" title={term("phase-3 objectives")} />
                <div className="space-y-3">
                  <ObjectiveMeter
                    id="daily-loss-3"
                    label={term("daily loss (phase 3)")}
                    metric="USD"
                    value={challenge.objectives["daily-loss"] || 3000}
                    min={1000}
                    max={20000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "daily-loss": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="max-drawdown-3"
                    label={term("max drawdown (phase 3)")}
                    metric="USD"
                    value={challenge.objectives["max-drawdown"] || 15000}
                    min={2000}
                    max={50000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "max-drawdown": v } }))
                    }
                  />
                  <ObjectiveMeter
                    id="profit-target-3"
                    label={term("profit target (phase 3)")}
                    metric="USD"
                    value={challenge.objectives["profit-target"] || 30000}
                    min={5000}
                    max={100000}
                    onChange={(v) =>
                      setChallenge((c) => ({ ...c, objectives: { ...c.objectives, "profit-target": v } }))
                    }
                  />
                </div>
              </StitchCard>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <StitchButton variant="surface" onClick={prevStep} disabled={step >= 2}>
              ← {term("previous")}
            </StitchButton>
            <StitchButton variant="primary" onClick={nextStep} disabled={isSubmitting}>
              {step >= 2 ? term("next: summary") : term("continue")}
            </StitchButton>
          </div>
        </StitchCard>
      ) : null}

      {/* Step 3: Summary */}
      {step === 3 ? (
        <StitchCard>
          <StitchCardHeader
            icon="check-circle"
            title={term("challenge summary")}
            description={term("review your challenge configuration before creation")}
          />
          <div className="grid gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">{term("challenge type")}</p>
              <p className="mt-1 text-ink">{challenge.type === "evaluation" ? term("evaluation challenge") : term("scaling challenge")}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">{term("challenge name")}</p>
              <p className="mt-1 text-ink">{challenge.name || "—"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">{term("phase")}</p>
              <p className="mt-1 text-ink">{challenge.phase || "—"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">{term("objectives")}</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  <span className="font-medium text-ink">{OBJECTIVES[0].label}:</span>
                  <span className="ml-2">{money(challenge.objectives["daily-loss"], challenge.currency)}</span>
                </li>
                <li>
                  <span className="font-medium text-ink">{OBJECTIVES[1].label}:</span>
                  <span className="ml-2">{money(challenge.objectives["max-drawdown"], challenge.currency)}</span>
                </li>
                <li>
                  <span className="font-medium text-ink">{OBJECTIVES[2].label}:</span>
                  <span className="ml-2">{money(challenge.objectives["profit-target"], challenge.currency)}</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">{term("trader limit")}</p>
              <p className="mt-1 text-ink">{challenge.traderCount} {term("traders")}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <StitchButton variant="surface" onClick={prevStep}>
              ← {term("previous")}
            </StitchButton>
            <StitchButton
              variant="primary"
              onClick={submitChallenge}
              disabled={isSubmitting}
            >
              {isSubmitting ? term("creating…") : term("create challenge")}
            </StitchButton>
          </div>
        </StitchCard>
      ) : null}
    </div>
  );
}

function ObjectiveMeter({
  id,
  label,
  metric,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  metric: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [showInput, setShowInput] = React.useState(false);
  const formattedValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-ink">{label}</span>
        <button
          onClick={() => setShowInput(true)}
          className="text-[10px] text-ink-variant hover:underline"
        >
          {term("edit")}
        </button>
      </div>

      {showInput ? (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="stitch-input w-24 rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp"
          />
          <span className="text-[10px] text-ink-variant">{metric}</span>
          <StitchButton variant="surface" onClick={() => setShowInput(false)}>{term("apply")}</StitchButton>
        </div>
      ) : (
        <StitchProgress
          value={Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}
          tone={value >= max * 0.8 ? "negative" : value >= max * 0.5 ? "warning" : "positive"}
        />
        <span className="ml-2 text-[10px] text-ink-variant">{metric}</span>
        <span className="ml-2 text-[10px] font-medium text-ink">{formattedValue}</span>
      )}
    </div>
  );
}

/* Money helper */
function money(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}