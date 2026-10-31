"use client";

/**
 * Competition management — audit finding #8 (MEDIUM).
 *
 * The competitions view was display-only: no way to create, configure,
 * schedule, or enroll. These dialogs back the management surface on
 * `competitions-page.tsx`:
 *
 * - CompetitionEditorDialog — create / edit a competition: name, window
 *   (ISO dates), prize pool, three-place payout split, and a one-rule-
 *   per-line rules editor. Templates (Profit Sprint / Consistency Cup /
 *   Low-Risk League) prefill dates, pool, split, and rules.
 * - CompetitionEnrollmentDialog — approve / reject pending entrants and
 *   enroll traders directly (upcoming competitions only).
 *
 * Frontend-only: mutations are applied to local page state via callbacks
 * and confirmed with toasts. Backend enforcement would be independent.
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
import { toast } from "@/hooks/use-toast";
import { Check, X, UserPlus } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Shared model                                                        */
/* ------------------------------------------------------------------ */

export interface CompetitionEntrant {
  id: string;
  trader: string;
  status: "pending" | "approved" | "rejected";
}

export interface Competition {
  id: string;
  name: string;
  status: "upcoming" | "active" | "completed";
  templateId: string;
  participants: number;
  prizePool: number;
  payoutPlaces: number;
  /** Payout split across the podium, in percent (must sum to 100). */
  split: { first: number; second: number; third: number };
  /** ISO dates (yyyy-mm-dd) — editable in the editor dialog. */
  startDate: string;
  endDate: string;
  /** One rule per line. */
  rules: string[];
  registrationOpen: boolean;
  paused: boolean;
  winnersAnnounced: boolean;
  prizesDistributed: boolean;
  entrants: CompetitionEntrant[];
  leaderboard: { rank: number; trader: string; score: number; prizeAmount: number }[];
  winners: { place: string; trader: string; prizeAmount: number }[];
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

const isoDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Prefill for a brand-new competition from a template. */
export function competitionDraftFromTemplate(tpl: CompetitionTemplate): Omit<Competition, "id"> {
  return {
    name: tpl.id === "blank" ? "" : tpl.label,
    status: "upcoming",
    templateId: tpl.id,
    participants: 0,
    prizePool: tpl.prizePool,
    payoutPlaces: tpl.payoutPlaces,
    split: { ...tpl.split },
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
  const [startDate, setStartDate] = useState(initial?.startDate ?? isoDate(7));
  const [endDate, setEndDate] = useState(initial?.endDate ?? isoDate(37));
  const [pool, setPool] = useState(initial ? String(initial.prizePool) : "");
  const [places, setPlaces] = useState(initial ? String(initial.payoutPlaces) : "10");
  const [first, setFirst] = useState(initial?.split.first ?? 50);
  const [second, setSecond] = useState(initial?.split.second ?? 30);
  const [third, setThird] = useState(initial?.split.third ?? 20);
  const [rulesText, setRulesText] = useState((initial?.rules ?? []).join("\n"));

  const splitSum = first + second + third;
  const poolNum = Number(pool);
  const placesNum = Number(places);
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
    split: splitSum === 100 ? undefined : `Split must total 100% (currently ${splitSum}%).`,
    dates: startDate < endDate ? undefined : "End date must be after the start date.",
  };
  const valid = !Object.values(errors).some(Boolean);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = COMPETITION_TEMPLATES.find((t) => t.id === id);
    if (!tpl || initial) return; // edit mode keeps existing values
    if (tpl.id !== "blank") {
      setName(tpl.label);
      setPool(String(tpl.prizePool));
      setPlaces(String(tpl.payoutPlaces));
      setFirst(tpl.split.first);
      setSecond(tpl.split.second);
      setThird(tpl.split.third);
      setRulesText(tpl.rules.join("\n"));
      setEndDate(isoDate(7 + tpl.days));
    }
  };

  const save = () => {
    if (!valid) return;
    onSave({
      id: initial?.id ?? nextId,
      name: name.trim(),
      status: initial?.status ?? "upcoming",
      templateId,
      participants: initial?.participants ?? 0,
      prizePool: poolNum,
      payoutPlaces: placesNum,
      split: { first, second, third },
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
          <div className="grid grid-cols-2 gap-3">
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
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Pending requests ({pending.length})</p>
            {pending.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">No pending requests.</p>
            ) : (
              <div className="space-y-1">
                {pending.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                    <span className="flex-1 font-medium">{e.trader}</span>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onDecide(e.id, "approved")}>
                      <Check className="mr-1 h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600" onClick={() => onDecide(e.id, "rejected")}>
                      <X className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </div>
                ))}
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
