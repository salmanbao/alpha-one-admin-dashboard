"use client";

/**
 * Competition management — audit finding #8 (MEDIUM).
 *
 * The competitions view was display-only: no way to create, configure,
 * schedule, or enroll. These dialogs back the management surface on
 * `competitions-page.tsx`:
 *
 * - CompetitionEditorDialog — create / edit a competition: name,
 *   tagline, window (ISO dates), prize pool, participant cap, podium
 *   split, prize tiers (incl. physical), and a one-rule-per-line rules
 *   editor. Templates (Profit Sprint / Consistency Cup / Low-Risk
 *   League) prefill dates, pool, split, and rules.
 * - CompetitionEnrollmentDialog — approve / reject pending entrants and
 *   enroll traders directly (upcoming competitions only).
 *
 * Edits a draft; the page saves it through `lib/competitions-operator-
 * store.ts` (R7 I3), which persists it and emits the lifecycle events the
 * trader catalog/inbox consume. The `Competition` model lives in that
 * store — this dialog only edits a draft of it.
 */

import { useMemo, useState } from "react";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, UserPlus, ShieldAlert, ShieldCheck, Plus } from "lucide-react";
import {
  derivePrizeTiers,
  type Competition,
  type OperatorPrizeTier,
} from "@/lib/competitions-operator-store";

/* ------------------------------------------------------------------ */
/* Prize tier rows (string state — inputs)                             */
/* ------------------------------------------------------------------ */

interface TierRow {
  rankFrom: string;
  rankTo: string;
  kind: OperatorPrizeTier["kind"];
  label: string;
  valueUsd: string;
}

function rowsFromTiers(tiers: OperatorPrizeTier[]): TierRow[] {
  return tiers.map((t) => ({
    rankFrom: String(t.rankFrom),
    rankTo: String(t.rankTo),
    kind: t.kind,
    label: t.label,
    valueUsd: t.valueUsd != null ? String(t.valueUsd) : "",
  }));
}

function tiersFromRows(rows: TierRow[]): OperatorPrizeTier[] {
  return rows.map((r) => {
    const tier: OperatorPrizeTier = {
      rankFrom: Number(r.rankFrom),
      rankTo: Number(r.rankTo),
      kind: r.kind,
      label: r.label.trim(),
    };
    const v = Number(r.valueUsd);
    if (r.valueUsd.trim() && Number.isFinite(v)) tier.valueUsd = v;
    return tier;
  });
}

/** "" = valid; otherwise the first bad row's message. */
function tierRowsError(rows: TierRow[]): string | undefined {
  for (const r of rows) {
    const from = Number(r.rankFrom);
    const to = Number(r.rankTo);
    if (!r.label.trim()) return "Every prize tier needs a label.";
    if (!Number.isInteger(from) || from < 1) return "Tier ranks must be whole numbers starting at 1.";
    if (!Number.isInteger(to) || to < from) return "A tier's last rank must be at or after its first rank.";
    if (r.valueUsd.trim() && !Number.isFinite(Number(r.valueUsd))) return "Prize values must be numbers (or empty).";
  }
  return undefined;
}

export interface CompetitionTemplate {
  id: string;
  label: string;
  description: string;
  days: number;
  prizePool: number;
  payoutPlaces: number;
  split: { first: number; second: number; third: number };
  rules: string[];
}

/** Prefill templates for common competition types (finding #8). */
export const COMPETITION_TEMPLATES: CompetitionTemplate[] = [
  {
    id: "blank",
    label: "Blank — start from scratch",
    description: "No rules or amounts prefilled.",
    days: 30,
    prizePool: 0,
    payoutPlaces: 3,
    split: { first: 50, second: 30, third: 20 },
    rules: [],
  },
  {
    id: "profit-sprint",
    label: "Profit Sprint (21 days)",
    description: "Short sprint — highest net profit % wins.",
    days: 21,
    prizePool: 10_000,
    payoutPlaces: 10,
    split: { first: 50, second: 30, third: 20 },
    rules: [
      "Highest net profit % wins",
      "Minimum 10 trades to qualify",
      "Any session, any challenge account",
      "No copy trading between participants",
    ],
  },
  {
    id: "consistency-cup",
    label: "Consistency Cup (30 days)",
    description: "Risk-adjusted returns (Sharpe) with a consistency gate.",
    days: 30,
    prizePool: 25_000,
    payoutPlaces: 10,
    split: { first: 45, second: 30, third: 25 },
    rules: [
      "Highest risk-adjusted return (Sharpe) wins",
      "Minimum 20 trades to qualify",
      "Consistency score ≥ 70",
      "Max daily loss 4%",
    ],
  },
  {
    id: "low-risk-league",
    label: "Low-Risk League (30 days)",
    description: "Capital-preservation league — smallest drawdowns win.",
    days: 30,
    prizePool: 5_000,
    payoutPlaces: 5,
    split: { first: 50, second: 30, third: 20 },
    rules: [
      "Lowest max drawdown among profitable traders wins",
      "Minimum 15 trades to qualify",
      "Max daily loss 3%",
      "Profit factor ≥ 1.5",
    ],
  },
];

/** Mock trader pool for enrollment (frontend-only demo data). */
const TRADER_POOL = [
  "Liam Smith", "Emma Wilson", "Noah Davis", "Olivia Brown", "James Taylor",
  "Ava Martin", "Ethan Clark", "Mia Rodriguez", "Lucas Moore", "Sofia Lee",
];

/**
 * Deterministic enrollment eligibility per pool trader (mock data) —
 * KYC standing + account rules. Pending requests show WHY an entrant
 * is (not) eligible, so approving is a decision instead of a guess
 * (audit: enrollment management with trader eligibility criteria).
 */
const ELIGIBILITY: Record<string, { eligible: boolean; note: string }> = {
  "Liam Smith": { eligible: true, note: "KYC verified • funded account" },
  "Emma Wilson": { eligible: true, note: "KYC verified • funded account" },
  "Noah Davis": { eligible: false, note: "KYC document expired — renew to enroll" },
  "Olivia Brown": { eligible: true, note: "KYC verified • Phase 2 challenge" },
  "James Taylor": { eligible: false, note: "Open rule breach on funded account" },
  "Ava Martin": { eligible: true, note: "KYC verified • funded account" },
  "Ethan Clark": { eligible: false, note: "Email unverified — send verification link" },
  "Mia Rodriguez": { eligible: true, note: "KYC verified • Phase 1 challenge" },
  "Lucas Moore": { eligible: false, note: "Account age under 30 days" },
  "Sofia Lee": { eligible: true, note: "KYC verified • funded account" },
};

const isoDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Prefill for a brand-new competition from a template. */
export function competitionDraftFromTemplate(tpl: CompetitionTemplate): Omit<Competition, "id"> {
  return {
    name: tpl.id === "blank" ? "" : tpl.label,
    tagline: tpl.id === "blank" ? "" : tpl.description,
    status: "upcoming",
    templateId: tpl.id,
    participants: 0,
    prizePool: tpl.prizePool,
    payoutPlaces: tpl.payoutPlaces,
    split: { ...tpl.split },
    // Tiers derive from the pool/split until an operator edits them.
    prizeTiers: undefined,
    startDate: isoDate(7),
    endDate: isoDate(7 + tpl.days),
    rules: [...tpl.rules],
    registrationOpen: true,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: TRADER_POOL.slice(0, 4).map((trader, i) => ({
      id: `entrant-${i}`,
      trader,
      status: "pending" as const,
    })),
    leaderboard: [],
    winners: [],
  };
}

/* ------------------------------------------------------------------ */
/* Editor dialog — create / edit                                       */
/* ------------------------------------------------------------------ */

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode; absent = create mode. */
  initial?: Competition;
  nextId: string;
  onSave: (comp: Competition) => void;
}

export function CompetitionEditorDialog({ open, onOpenChange, initial, nextId, onSave }: EditorProps) {
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "blank");
  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? isoDate(7));
  const [endDate, setEndDate] = useState(initial?.endDate ?? isoDate(37));
  const [pool, setPool] = useState(initial ? String(initial.prizePool) : "");
  const [places, setPlaces] = useState(initial ? String(initial.payoutPlaces) : "10");
  const [cap, setCap] = useState(initial?.participantCap != null ? String(initial.participantCap) : "");
  const [first, setFirst] = useState(initial?.split.first ?? 50);
  const [second, setSecond] = useState(initial?.split.second ?? 30);
  const [third, setThird] = useState(initial?.split.third ?? 20);
  const [rulesText, setRulesText] = useState((initial?.rules ?? []).join("\n"));
  // Prize tiers: rows are strings (inputs). `tiersDirty` false = derive
  // live from the pool/split/places below; true = operator-authored rows.
  const [tiers, setTiers] = useState<TierRow[]>(() => rowsFromTiers(initial?.prizeTiers ?? []));
  const [tiersDirty, setTiersDirty] = useState(Boolean(initial?.prizeTiers?.length));

  const splitSum = first + second + third;
  const poolNum = Number(pool);
  const placesNum = Number(places);
  // Live-derived rows when the operator hasn't authored their own tiers.
  const liveTiers: OperatorPrizeTier[] = derivePrizeTiers({
    prizePool: Number.isFinite(poolNum) && poolNum >= 0 ? poolNum : 0,
    split: { first, second, third },
    payoutPlaces: Number.isInteger(placesNum) && placesNum >= 3 ? placesNum : 10,
  });
  const displayTiers: TierRow[] = tiersDirty ? tiers : rowsFromTiers(liveTiers);
  const errors = {
    name: name.trim() ? undefined : "Name is required.",
    pool: !pool.trim()
      ? "Prize pool is required."
      : Number.isFinite(poolNum) && poolNum >= 0
        ? undefined
        : "Enter a valid amount.",
    places:
      Number.isInteger(placesNum) && placesNum >= 3 && placesNum <= 100
        ? undefined
        : "Must be between 3 and 100.",
    cap:
      !cap.trim() || (Number.isInteger(Number(cap)) && Number(cap) >= 1)
        ? undefined
        : "Enter a whole number ≥ 1, or leave it empty (uncapped).",
    split: splitSum === 100 ? undefined : `Split must total 100% (currently ${splitSum}%).`,
    dates: startDate < endDate ? undefined : "End date must be after the start date.",
    tiers: tierRowsError(displayTiers),
  };
  const valid = !Object.values(errors).some(Boolean);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = COMPETITION_TEMPLATES.find((t) => t.id === id);
    if (!tpl || initial) return; // edit mode keeps existing values
    if (tpl.id !== "blank") {
      setName(tpl.label);
      setTagline(tpl.description);
      setPool(String(tpl.prizePool));
      setPlaces(String(tpl.payoutPlaces));
      setFirst(tpl.split.first);
      setSecond(tpl.split.second);
      setThird(tpl.split.third);
      setRulesText(tpl.rules.join("\n"));
      setEndDate(isoDate(7 + tpl.days));
      // New template → tiers follow its pool/split again.
      setTiersDirty(false);
    }
  };

  /* Prize tier row edits — materialize the derived rows on first touch. */
  const editTier = (index: number, patch: Partial<TierRow>) => {
    const base = tiersDirty ? tiers : displayTiers;
    setTiers(base.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setTiersDirty(true);
  };

  const addTier = () => {
    const base = tiersDirty ? tiers : displayTiers;
    const lastTo = base.length ? Number(base[base.length - 1].rankTo) || 0 : 0;
    setTiers([
      ...base,
      { rankFrom: String(lastTo + 1), rankTo: String(lastTo + 1), kind: "cash", label: "", valueUsd: "" },
    ]);
    setTiersDirty(true);
  };

  const removeTier = (index: number) => {
    const base = tiersDirty ? tiers : displayTiers;
    setTiers(base.filter((_, i) => i !== index));
    setTiersDirty(true);
  };

  const resetTiers = () => setTiersDirty(false);

  const save = () => {
    if (!valid) return;
    onSave({
      id: initial?.id ?? nextId,
      name: name.trim(),
      tagline: tagline.trim(),
      status: initial?.status ?? "upcoming",
      templateId,
      participants: initial?.participants ?? 0,
      participantCap: cap.trim() ? Number(cap) : undefined,
      prizePool: poolNum,
      payoutPlaces: placesNum,
      split: { first, second, third },
      prizeTiers: tiersDirty ? tiersFromRows(displayTiers) : undefined,
      startDate,
      endDate,
      rules: rulesText.split("\n").map((r) => r.trim()).filter(Boolean),
      registrationOpen: initial?.registrationOpen ?? true,
      paused: initial?.paused ?? false,
      winnersAnnounced: initial?.winnersAnnounced ?? false,
      prizesDistributed: initial?.prizesDistributed ?? false,
      entrants: initial?.entrants ?? [],
      leaderboard: initial?.leaderboard ?? [],
      winners: initial?.winners ?? [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "Create competition"}</DialogTitle>
          <DialogDescription>
            Configure the schedule, prize pool, payout split, and rules. Templates prefill common setups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template */}
          {!initial && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {COMPETITION_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {COMPETITION_TEMPLATES.find((t) => t.id === templateId) && (
                <p className="text-[11px] text-muted-foreground">
                  {COMPETITION_TEMPLATES.find((t) => t.id === templateId)!.description}
                </p>
              )}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold" htmlFor="comp-name">Competition name</Label>
            <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Profit Sprint — November" />
            {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
          </div>

          {/* Tagline (trader catalog card copy) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold" htmlFor="comp-tagline">Tagline</Label>
            <Input
              id="comp-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Highest net gain wins — steady hands beat lucky shots."
            />
            <p className="text-[10px] text-muted-foreground">Shown on the trader's competition card (Demo).</p>
          </div>

          {/* Window */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="comp-start">Start date</Label>
              <Input id="comp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="comp-end">End date</Label>
              <Input id="comp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {errors.dates && <p className="text-[11px] text-destructive">{errors.dates}</p>}

          {/* Prizes */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="comp-pool">Prize pool (USD)</Label>
              <Input id="comp-pool" type="number" min={0} value={pool} onChange={(e) => setPool(e.target.value)} placeholder="10000" />
              {errors.pool && <p className="text-[11px] text-destructive">{errors.pool}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="comp-places">Paid places</Label>
              <Input id="comp-places" type="number" min={3} max={100} value={places} onChange={(e) => setPlaces(e.target.value)} />
              {errors.places && <p className="text-[11px] text-destructive">{errors.places}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="comp-cap">Participant cap</Label>
              <Input id="comp-cap" type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Uncapped" />
              {errors.cap && <p className="text-[11px] text-destructive">{errors.cap}</p>}
            </div>
          </div>

          {/* Payout split */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Podium payout split (%)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Input type="number" min={0} max={100} value={first} aria-label="1st place percent" onChange={(e) => setFirst(Number(e.target.value))} />
                <p className="mt-1 text-[10px] text-muted-foreground">1st · {pool.trim() && Number.isFinite(poolNum) ? formatCurrencyValue((poolNum * first) / 100, "USD") : "—"}</p>
              </div>
              <div>
                <Input type="number" min={0} max={100} value={second} aria-label="2nd place percent" onChange={(e) => setSecond(Number(e.target.value))} />
                <p className="mt-1 text-[10px] text-muted-foreground">2nd · {pool.trim() && Number.isFinite(poolNum) ? formatCurrencyValue((poolNum * second) / 100, "USD") : "—"}</p>
              </div>
              <div>
                <Input type="number" min={0} max={100} value={third} aria-label="3rd place percent" onChange={(e) => setThird(Number(e.target.value))} />
                <p className="mt-1 text-[10px] text-muted-foreground">3rd · {pool.trim() && Number.isFinite(poolNum) ? formatCurrencyValue((poolNum * third) / 100, "USD") : "—"}</p>
              </div>
            </div>
            {errors.split && <p className="text-[11px] text-destructive">{errors.split}</p>}
          </div>

          {/* Prize tiers — what the trader's prize table shows */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold">Prize tiers</Label>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={resetTiers} title="Regenerate the tiers from the pool and podium split">
                  Reset from split
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={addTier}>
                  <Plus className="mr-1 h-3 w-3" /> Add tier
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-[54px_54px_112px_1fr_84px_28px] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground" aria-hidden="true">
              <span>From</span>
              <span>To</span>
              <span>Kind</span>
              <span>Label</span>
              <span>USD</span>
              <span />
            </div>
            <div className="space-y-1.5">
              {displayTiers.map((row, i) => (
                <div key={i} className="grid grid-cols-[54px_54px_112px_1fr_84px_28px] items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Tier ${i + 1} first rank`}
                    value={row.rankFrom}
                    onChange={(e) => editTier(i, { rankFrom: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Tier ${i + 1} last rank`}
                    value={row.rankTo}
                    onChange={(e) => editTier(i, { rankTo: e.target.value })}
                  />
                  <Select
                    value={row.kind}
                    onValueChange={(v) => editTier(i, { kind: v as OperatorPrizeTier["kind"] })}
                  >
                    <SelectTrigger className="h-8" aria-label={`Tier ${i + 1} kind`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="funded-account">Funded acct</SelectItem>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="promo-credit">Promo credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`Tier ${i + 1} label`}
                    value={row.label}
                    onChange={(e) => editTier(i, { label: e.target.value })}
                    placeholder="e.g. iPhone 17 Pro"
                  />
                  <Input
                    type="number"
                    min={0}
                    aria-label={`Tier ${i + 1} value (USD)`}
                    value={row.valueUsd}
                    onChange={(e) => editTier(i, { valueUsd: e.target.value })}
                    placeholder="—"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-7 px-0"
                    aria-label={`Remove tier ${i + 1}`}
                    onClick={() => removeTier(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.tiers && <p className="text-[11px] text-destructive">{errors.tiers}</p>}
            <p className="text-[10px] text-muted-foreground">
              Tiers follow the podium split until you edit a row — a physical prize on rank 1 leads the trader's banner (Demo).
            </p>
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold" htmlFor="comp-rules">Rules (one per line)</Label>
            <Textarea id="comp-rules" rows={5} value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder={"Highest profit % wins\nMinimum 10 trades"} />
            <p className="text-[10px] text-muted-foreground">
              {rulesText.split("\n").map((r) => r.trim()).filter(Boolean).length} rule(s)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={save}>
            {initial ? "Save changes" : "Create competition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Enrollment dialog                                                   */
/* ------------------------------------------------------------------ */

interface EnrollmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: Competition;
  onDecide: (entrantId: string, decision: "approved" | "rejected") => void;
  onEnroll: (trader: string) => void;
}

export function CompetitionEnrollmentDialog({ open, onOpenChange, competition, onDecide, onEnroll }: EnrollmentProps) {
  const pending = competition.entrants.filter((e) => e.status === "pending");
  const approved = competition.entrants.filter((e) => e.status === "approved");
  const rejected = competition.entrants.filter((e) => e.status === "rejected");
  const [pick, setPick] = useState("");
  // Eligibility lens for the pending queue (audit: filter by trader
  // eligibility criteria) — deterministic from the ELIGIBILITY map.
  const [eligFilter, setEligFilter] = useState<"all" | "eligible" | "needs-review">("all");
  const pendingVisible = pending.filter((e) => {
    const eligible = ELIGIBILITY[e.trader]?.eligible ?? true;
    if (eligFilter === "eligible") return eligible;
    if (eligFilter === "needs-review") return !eligible;
    return true;
  });

  const candidates = useMemo(
    () => TRADER_POOL.filter((t) => !competition.entrants.some((e) => e.trader === t)),
    [competition.entrants],
  );

  const enrollable = competition.status === "upcoming" && competition.registrationOpen && !competition.paused;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enrollment — {competition.name}</DialogTitle>
          <DialogDescription>
            {enrollable
              ? "Approve pending requests or enroll traders directly. Registration is open."
              : competition.status === "upcoming"
                ? "Registration is closed — enrollment is read-only."
                : "The competition has started — the roster is locked."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direct enrollment */}
          {enrollable && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Enroll a trader</Label>
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={candidates.length ? "Select a trader" : "All traders enrolled"} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!pick}
                onClick={() => {
                  if (!pick) return;
                  onEnroll(pick);
                  setPick("");
                }}
              >
                <UserPlus className="mr-1 h-4 w-4" /> Enroll
              </Button>
            </div>
          )}

          {/* Pending approvals */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pending requests ({pending.length})
              </p>
              {pending.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground" htmlFor="elig-filter">
                    Eligibility
                  </label>
                  <select
                    id="elig-filter"
                    value={eligFilter}
                    onChange={(e) => setEligFilter(e.target.value as typeof eligFilter)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="all">All ({pending.length})</option>
                    <option value="eligible">
                      Eligible ({pending.filter((e) => ELIGIBILITY[e.trader]?.eligible ?? true).length})
                    </option>
                    <option value="needs-review">
                      Needs review ({pending.filter((e) => !(ELIGIBILITY[e.trader]?.eligible ?? true)).length})
                    </option>
                  </select>
                </div>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">No pending requests.</p>
            ) : pendingVisible.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
                No {eligFilter === "eligible" ? "eligible" : "ineligible"} pending requests — switch the eligibility filter to see all.
              </p>
            ) : (
              <div className="space-y-1">
                {pendingVisible.map((e) => {
                  const elig = ELIGIBILITY[e.trader] ?? { eligible: true, note: "No eligibility record on file" };
                  return (
                    <div
                      key={e.id}
                      className={`rounded-md border p-2 text-xs ${elig.eligible ? "" : "border-amber-500/40 bg-amber-500/5"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-medium">{e.trader}</span>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-semibold ${elig.eligible ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                          title={elig.note}
                        >
                          {elig.eligible ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          {elig.eligible ? "Eligible" : "Needs review"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          title={elig.eligible ? undefined : `⚠ ${elig.note}`}
                          onClick={() => onDecide(e.id, "approved")}
                        >
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600" onClick={() => onDecide(e.id, "rejected")}>
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                      <p className="mt-0.5 pl-0.5 text-[10px] text-muted-foreground">{elig.note}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Approved roster */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Approved ({approved.length})</p>
            <div className="flex flex-wrap gap-1">
              {approved.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No approved entrants yet.</p>
              ) : (
                approved.map((e) => <Badge key={e.id} variant="outline" className="text-[10px]">{e.trader}</Badge>)
              )}
            </div>
          </div>

          {/* Rejected */}
          {rejected.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Rejected ({rejected.length})</p>
              <div className="flex flex-wrap gap-1">
                {rejected.map((e) => (
                  <Badge key={e.id} variant="outline" className="text-[10px] text-muted-foreground line-through">{e.trader}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
