"use client";

/**
 * Competitions — research item #41.
 *
 * Competition list + detail with rules, participants, leaderboard,
 * prize configuration, winners, and status.
 *
 * Audit finding #8 (MEDIUM): this view was display-only — the Create
 * button was a toast stub and there was no way to configure, schedule,
 * enroll, or pay out. It now backs a full management surface:
 * create/edit with templates, per-status lifecycle actions (close
 * registration, start, pause, end early, announce, distribute prizes),
 * and enrollment approval — all gated by challenge.create /
 * challenge.update.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { Trophy, Users, DollarSign, Calendar, Plus, Medal, Award, Crown, Pencil, Pause, Play, Flag, Megaphone, Wallet, UserPlus, Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import {
  CompetitionEditorDialog,
  CompetitionEnrollmentDialog,
  type Competition,
} from "./competition-management-dialog";

const seedCompetitions: Competition[] = [
  {
    id: "COMP-001",
    name: "Alpha Trading Challenge Q3",
    status: "active",
    templateId: "profit-sprint",
    participants: 142,
    prizePool: 25000,
    payoutPlaces: 10,
    split: { first: 50, second: 30, third: 20 },
    startDate: "2026-10-26",
    endDate: "2026-11-09",
    rules: [
      "Trade any challenge account",
      "Highest profit % wins",
      "Minimum 10 trades required",
      "No copy trading between participants",
      "Max drawdown rules apply",
    ],
    registrationOpen: false,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-1", trader: "Liam Smith", status: "approved" },
      { id: "e-2", trader: "Emma Wilson", status: "approved" },
      { id: "e-3", trader: "Noah Davis", status: "approved" },
      { id: "e-4", trader: "Olivia Brown", status: "pending" },
    ],
    leaderboard: [
      { rank: 1, trader: "Liam Smith", score: 18.5, prizeAmount: 12500 },
      { rank: 2, trader: "Emma Wilson", score: 16.2, prizeAmount: 7500 },
      { rank: 3, trader: "Noah Davis", score: 14.8, prizeAmount: 5000 },
      { rank: 4, trader: "Olivia Brown", score: 12.1, prizeAmount: 0 },
      { rank: 5, trader: "James Taylor", score: 11.3, prizeAmount: 0 },
    ],
    winners: [],
  },
  {
    id: "COMP-002",
    name: "Summer Sizzle Trading Cup",
    status: "completed",
    templateId: "consistency-cup",
    participants: 89,
    prizePool: 10000,
    payoutPlaces: 5,
    split: { first: 50, second: 30, third: 20 },
    startDate: "2026-10-01",
    endDate: "2026-10-15",
    rules: [
      "Open to all funded traders",
      "Highest cumulative profit",
      "Minimum 20 trades",
    ],
    registrationOpen: false,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-5", trader: "Sophia Miller", status: "approved" },
      { id: "e-6", trader: "Mason Anderson", status: "approved" },
      { id: "e-7", trader: "Ava Thomas", status: "approved" },
    ],
    leaderboard: [],
    winners: [
      { place: "1st", trader: "Sophia Miller", prizeAmount: 5000 },
      { place: "2nd", trader: "Mason Anderson", prizeAmount: 3000 },
      { place: "3rd", trader: "Ava Thomas", prizeAmount: 2000 },
    ],
  },
  {
    id: "COMP-003",
    name: "Q4 Funded Trader Showdown",
    status: "upcoming",
    templateId: "consistency-cup",
    participants: 0,
    prizePool: 50000,
    payoutPlaces: 20,
    split: { first: 45, second: 30, third: 25 },
    startDate: "2026-11-12",
    endDate: "2026-12-12",
    rules: [
      "Open to all active traders",
      "Highest risk-adjusted return (Sharpe)",
      "Minimum 30 trades",
      "Max 2 accounts per trader",
    ],
    registrationOpen: true,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-8", trader: "James Taylor", status: "pending" },
      { id: "e-9", trader: "Mia Rodriguez", status: "pending" },
    ],
    leaderboard: [],
    winners: [],
  },
];

const statusTone = (s: Competition["status"]) =>
  s === "active" ? "success" : s === "upcoming" ? "info" : "muted";

const medalIcon = (rank: number) =>
  rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : Trophy;

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** ISO dates → compact window label, e.g. "Oct 26 → Nov 9". */
function formatWindow(c: Competition): string {
  const s = new Date(`${c.startDate}T00:00:00Z`);
  const e = new Date(`${c.endDate}T00:00:00Z`);
  return `${dayFmt.format(s)} → ${dayFmt.format(e)}`;
}

/** Prize line for list + detail headers. */
function prizeLine(c: Competition): string {
  return `${formatCurrencyValue(c.prizePool, "USD")} prize pool · Top ${c.payoutPlaces} win cash`;
}

/** Podium payout for a place, from the configured split. */
function podiumAmount(c: Competition, place: 1 | 2 | 3): number {
  const pct = place === 1 ? c.split.first : place === 2 ? c.split.second : c.split.third;
  return Math.round((c.prizePool * pct) / 100);
}

export function CompetitionsPage() {
  const { user } = usePlatform();
  // In-page guards — creating/running competitions is a management
  // decision (challenge.create / challenge.update), not implied by the
  // challenge.read route permission that shows this list.
  const canCreate = hasPermission(user, "challenge.create");
  const canManage = hasPermission(user, "challenge.update");

  const [list, setList] = useState<Competition[]>(seedCompetitions);
  const [selectedId, setSelectedId] = useState<string>(seedCompetitions[0].id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | undefined>(undefined);
  const [enrollmentFor, setEnrollmentFor] = useState<Competition | null>(null);

  const selected = list.find((c) => c.id === selectedId) ?? null;

  const update = (id: string, fn: (c: Competition) => Competition) =>
    setList((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const nextId = () => {
    const max = list.reduce((m, c) => {
      const n = Number(c.id.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `COMP-${String(max + 1).padStart(3, "0")}`;
  };

  const openCreate = () => {
    setEditing(undefined);
    setEditorOpen(true);
  };

  const openEdit = (c: Competition) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const saveCompetition = (comp: Competition) => {
    const exists = list.some((c) => c.id === comp.id);
    setList((prev) => (exists ? prev.map((c) => (c.id === comp.id ? comp : c)) : [...prev, comp]));
    setSelectedId(comp.id);
    toast({
      title: exists ? "Competition updated" : "Competition created",
      description: `${comp.name} — ${prizeLine(comp)}`,
    });
  };

  /* ---------------- Lifecycle actions (challenge.update) ---------------- */

  const closeRegistration = (c: Competition) => {
    update(c.id, (x) => ({ ...x, registrationOpen: false }));
    toast({ title: "Registration closed", description: `${c.name} — no new entrants can join.` });
  };

  const reopenRegistration = (c: Competition) => {
    update(c.id, (x) => ({ ...x, registrationOpen: true }));
    toast({ title: "Registration reopened", description: `${c.name} — entrants can join again.` });
  };

  const startCompetition = (c: Competition) => {
    update(c.id, (x) => ({ ...x, status: "active", registrationOpen: false }));
    toast({ title: "Competition started", description: `${c.name} is live — the leaderboard is now tracking.` });
  };

  const togglePause = (c: Competition) => {
    const pausing = !c.paused;
    update(c.id, (x) => ({ ...x, paused: pausing }));
    toast({
      title: pausing ? "Competition paused" : "Competition resumed",
      description: pausing
        ? `${c.name} — scoring is frozen until you resume.`
        : `${c.name} — scoring is live again.`,
    });
  };

  const endEarly = (c: Competition) => {
    // Finalize from current standings: podium gets the configured split.
    const winners = c.leaderboard.slice(0, 3).map((e, i) => ({
      place: i === 0 ? "1st" : i === 1 ? "2nd" : "3rd",
      trader: e.trader,
      prizeAmount: podiumAmount(c, (i + 1) as 1 | 2 | 3),
    }));
    update(c.id, (x) => ({ ...x, status: "completed", paused: false, winners }));
    toast({
      title: "Competition ended early",
      description: winners.length
        ? `${c.name} — winners finalized from current standings.`
        : `${c.name} ended with no qualified standings.`,
    });
  };

  const announceWinners = (c: Competition) => {
    update(c.id, (x) => ({ ...x, winnersAnnounced: true }));
    toast({
      title: "Winners announced",
      description: c.winners.map((w) => `${w.place} ${w.trader}`).join(" · ") || "No winners to announce.",
    });
  };

  const distributePrizes = (c: Competition) => {
    const total = c.winners.reduce((s, w) => s + w.prizeAmount, 0);
    update(c.id, (x) => ({ ...x, prizesDistributed: true }));
    toast({
      title: "Prizes distributed",
      description: `${formatCurrencyValue(total, "USD")} paid out to ${c.winners.length} winner${c.winners.length === 1 ? "" : "s"} of ${c.name}.`,
    });
  };

  /* ---------------- Enrollment ---------------- */

  const decideEnrollment = (compId: string, entrantId: string, decision: "approved" | "rejected") => {
    update(compId, (x) => ({
      ...x,
      entrants: x.entrants.map((e) => (e.id === entrantId ? { ...e, status: decision } : e)),
      participants: decision === "approved" ? x.participants + 1 : x.participants,
    }));
    toast({
      title: decision === "approved" ? "Entrant approved" : "Entrant rejected",
      description: `Enrollment decision recorded for ${list.find((c) => c.id === compId)?.name ?? "competition"}.`,
    });
  };

  const enrollTrader = (compId: string, trader: string) => {
    update(compId, (x) => ({
      ...x,
      participants: x.participants + 1,
      entrants: [...x.entrants, { id: `e-${Date.now()}`, trader, status: "approved" as const }],
    }));
    toast({ title: "Trader enrolled", description: `${trader} is now on the roster.` });
  };

  const manageHint = (perm: boolean) =>
    perm ? undefined : "Requires challenge.update";

  return (
    <Page>
      <PageHeader title="Competitions" description="Create, run, and pay out trading competitions." icon={Trophy}
        actions={
          <Button
            size="sm"
            onClick={openCreate}
            disabled={!canCreate}
            title={canCreate ? undefined : "Requires challenge.create"}
          >
            <Plus className="mr-1 h-4 w-4" /> Create
          </Button>
        } />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total" value={list.length} icon={Trophy} />
          <MetricCard label="Active" value={list.filter((c) => c.status === "active").length} icon={Calendar} tone="positive" />
          <MetricCard label="Upcoming" value={list.filter((c) => c.status === "upcoming").length} icon={Calendar} />
          <MetricCard label="Total Prize Pool" value={formatCurrencyValue(list.reduce((s, c) => s + c.prizePool, 0), "USD")} icon={DollarSign} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Competition list */}
          <div className="space-y-2">
            {list.map((c) => (
              <Card key={c.id} className={`cursor-pointer transition hover:shadow-md ${selected?.id === c.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedId(c.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>
                    <Badge variant="outline" className="text-[10px]">{c.id}</Badge>
                    {c.paused && <Badge variant="outline" className="text-[10px] text-amber-600">paused</Badge>}
                    {!c.registrationOpen && c.status === "upcoming" && <Badge variant="outline" className="text-[10px]">closed</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium">{c.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.participants}</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrencyValue(c.prizePool, "USD")}</span>
                    <span>{formatWindow(c)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Competition detail */}
          {selected && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{selected.name}</h3>
                    <StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge>
                    {selected.paused && <Badge variant="outline" className="text-[10px] text-amber-600">paused</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{prizeLine(selected)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setEnrollmentFor(selected)}
                >
                  <UserPlus className="mr-1 h-3 w-3" /> Manage entrants
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Management actions (challenge.update) */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 p-2">
                  {selected.status === "upcoming" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => openEdit(selected)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => (selected.registrationOpen ? closeRegistration(selected) : reopenRegistration(selected))}>
                        {selected.registrationOpen ? <><Lock className="mr-1 h-3 w-3" /> Close registration</> : <><Unlock className="mr-1 h-3 w-3" /> Reopen</>}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => startCompetition(selected)}>
                        <Play className="mr-1 h-3 w-3" /> Start now
                      </Button>
                    </>
                  )}
                  {selected.status === "active" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => togglePause(selected)}>
                        {selected.paused ? <><Play className="mr-1 h-3 w-3" /> Resume</> : <><Pause className="mr-1 h-3 w-3" /> Pause</>}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => endEarly(selected)}>
                        <Flag className="mr-1 h-3 w-3" /> End early
                      </Button>
                    </>
                  )}
                  {selected.status === "completed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        disabled={!canManage || selected.winners.length === 0 || selected.winnersAnnounced}
                        title={manageHint(canManage) ?? (selected.winnersAnnounced ? "Already announced" : undefined)}
                        onClick={() => announceWinners(selected)}
                      >
                        <Megaphone className="mr-1 h-3 w-3" /> {selected.winnersAnnounced ? "Announced" : "Announce winners"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        disabled={!canManage || selected.winners.length === 0 || selected.prizesDistributed}
                        title={manageHint(canManage) ?? (selected.prizesDistributed ? "Already paid" : undefined)}
                        onClick={() => distributePrizes(selected)}
                      >
                        <Wallet className="mr-1 h-3 w-3" /> {selected.prizesDistributed ? "Prizes paid" : "Distribute prizes"}
                      </Button>
                    </>
                  )}
                  {selected.status !== "completed" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={!canManage} title={manageHint(canManage)} onClick={() => openEdit(selected)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>

                {/* Rules */}
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Rules</p>
                  <ul className="space-y-0.5">
                    {selected.rules.length === 0 ? (
                      <li className="text-[11px] text-muted-foreground">No rules configured yet — edit to add some.</li>
                    ) : (
                      selected.rules.map((r, i) => <li key={i} className="text-[11px] text-muted-foreground">· {r}</li>)
                    )}
                  </ul>
                </div>

                {/* Leaderboard (active competitions) */}
                {selected.status === "active" && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Trophy className="h-3 w-3" />Leaderboard</p>
                    {selected.leaderboard.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">No standings yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {selected.leaderboard.map((entry) => {
                          const Icon = medalIcon(entry.rank);
                          return (
                            <div key={entry.rank} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                              <Icon className={`h-4 w-4 ${entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-amber-700" : "text-muted-foreground"}`} />
                              <span className="font-medium">#{entry.rank}</span>
                              <span className="flex-1">{entry.trader}</span>
                              <span className="font-medium tabular-nums">{entry.score}%</span>
                              <Badge variant="outline" className="text-[10px]">
                                {entry.prizeAmount > 0 ? formatCurrencyValue(entry.prizeAmount, "USD") : "—"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Winners (completed competitions) */}
                {selected.status === "completed" && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Crown className="h-3 w-3" />Winners</p>
                    {selected.winners.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">No qualified standings at close.</p>
                    ) : (
                      <div className="space-y-1">
                        {selected.winners.map((w) => {
                          const Icon = w.place === "1st" ? Crown : w.place === "2nd" ? Medal : Award;
                          return (
                            <div key={w.place} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                              <Icon className={`h-4 w-4 ${w.place === "1st" ? "text-amber-500" : w.place === "2nd" ? "text-slate-400" : "text-amber-700"}`} />
                              <span className="font-medium">{w.place}</span>
                              <span className="flex-1">{w.trader}</span>
                              <Badge variant="outline" className="text-[10px]">{formatCurrencyValue(w.prizeAmount, "USD")}</Badge>
                              {w.place === "1st" && selected.prizesDistributed && (
                                <Badge variant="outline" className="text-[10px] text-emerald-600">paid</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 border-t pt-2">
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Participants</p><p className="text-sm font-bold tabular-nums">{selected.participants}</p></div>
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prize pool</p><p className="text-sm font-bold tabular-nums">{formatCurrencyValue(selected.prizePool, "USD")}</p></div>
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration</p><p className="text-sm font-bold">{formatWindow(selected)}</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>

      {/* Create / edit — mounted only while open so every session starts fresh */}
      {editorOpen && (
        <CompetitionEditorDialog
          key={editing?.id ?? "new-competition"}
          open
          onOpenChange={setEditorOpen}
          initial={editing}
          nextId={nextId()}
          onSave={saveCompetition}
        />
      )}

      {/* Enrollment management */}
      {enrollmentFor && (
        <CompetitionEnrollmentDialog
          key={enrollmentFor.id}
          open
          onOpenChange={(open) => { if (!open) setEnrollmentFor(null); }}
          competition={list.find((c) => c.id === enrollmentFor.id) ?? enrollmentFor}
          onDecide={(entrantId, decision) => decideEnrollment(enrollmentFor.id, entrantId, decision)}
          onEnroll={(trader) => enrollTrader(enrollmentFor.id, trader)}
        />
      )}
    </Page>
  );
}
