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
 *
 * R7 I3: every action writes through `lib/competitions-operator-store`
 * (persisted under `pfaas:demo:competitions-ops` + `recordAudit` +
 * lifecycle emission), so nothing here is toast-only anymore — the
 * trader catalog/inbox consume the events, and trader-app joins come
 * back through `cross-app-intake` into the participant list below.
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
import { useCrossAppCompetitionJoins } from "@/lib/platform/cross-app-intake";
import {
  announceCompetitionWinners,
  closeCompetitionRegistration,
  decideCompetitionEnrollment,
  distributeCompetitionPrizes,
  endCompetitionEarly,
  enrollCompetitionTrader,
  reopenCompetitionRegistration,
  saveOperatorCompetition,
  startCompetition as startCompetitionOp,
  toggleCompetitionPause,
  useOperatorCompetitions,
  type Competition,
} from "@/lib/competitions-operator-store";
import {
  CompetitionEditorDialog,
  CompetitionEnrollmentDialog,
} from "./competition-management-dialog";

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

export function CompetitionsPage() {
  const { user, tenant } = usePlatform();
  // In-page guards — creating/running competitions is a management
  // decision (challenge.create / challenge.update), not implied by the
  // challenge.read route permission that shows this list.
  const canCreate = hasPermission(user, "challenge.create");
  const canManage = hasPermission(user, "challenge.update");
  const tid = tenant?.id ?? "platform";

  // R7 I3 — the operator store is the single write path (persisted +
  // audited + lifecycle events); joins come back from the trader app
  // through the cross-app intake (derived from the shared event log).
  const list = useOperatorCompetitions();
  const joins = useCrossAppCompetitionJoins(tid);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | undefined>(undefined);
  const [enrollmentFor, setEnrollmentFor] = useState<Competition | null>(null);
  // Enrollment management — filter the list by lifecycle status so
  // reviewers can triage one bucket at a time (audit: enrollment
  // management view with status filtering).
  const [statusFilter, setStatusFilter] = useState<Competition["status"] | "all">("all");

  const selected =
    (selectedId ? list.find((c) => c.id === selectedId) : undefined) ?? list[0] ?? null;
  const visibleList =
    statusFilter === "all" ? list : list.filter((c) => c.status === statusFilter);
  // Participant list — trader-app joins for the selected competition
  // (computed in render; the hook subscription is the `joins` read).
  const joinsForSelected = selected
    ? joins.filter((j) => j.competitionId === selected.id)
    : [];

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
    saveOperatorCompetition(comp);
    setSelectedId(comp.id);
    toast({
      title: exists ? "Competition updated (Demo)" : "Competition created (Demo)",
      description: `${comp.name} — ${prizeLine(comp)}. Saved to the demo store; the trader catalog updates from the shared event log.`,
    });
  };

  /* ---------------- Lifecycle actions (challenge.update) ---------------- */

  const closeRegistration = (c: Competition) => {
    closeCompetitionRegistration(c.id);
    toast({ title: "Registration closed (Demo)", description: `${c.name} — no new entrants can join.` });
  };

  const reopenRegistration = (c: Competition) => {
    reopenCompetitionRegistration(c.id);
    toast({ title: "Registration reopened (Demo)", description: `${c.name} — entrants can join again.` });
  };

  const startCompetition = (c: Competition) => {
    startCompetitionOp(c.id);
    toast({ title: "Competition started (Demo)", description: `${c.name} is live — the leaderboard is now tracking.` });
  };

  const togglePause = (c: Competition) => {
    const pausing = !c.paused;
    toggleCompetitionPause(c.id);
    toast({
      title: pausing ? "Competition paused (Demo)" : "Competition resumed (Demo)",
      description: pausing
        ? `${c.name} — scoring is frozen until you resume.`
        : `${c.name} — scoring is live again.`,
    });
  };

  const endEarly = (c: Competition) => {
    // Store finalizes from current standings (podium at the split) and
    // publishes `competition.finished` to the trader winners gallery.
    endCompetitionEarly(c.id);
    toast({
      title: "Competition ended early (Demo)",
      description: c.leaderboard.length
        ? `${c.name} — winners finalized from current standings.`
        : `${c.name} ended with no qualified standings.`,
    });
  };

  const announceWinners = (c: Competition) => {
    announceCompetitionWinners(c.id);
    toast({
      title: "Winners announced (Demo)",
      description: c.winners.map((w) => `${w.place} ${w.trader}`).join(" · ") || "No winners to announce.",
    });
  };

  const distributePrizes = (c: Competition) => {
    const total = c.winners.reduce((s, w) => s + w.prizeAmount, 0);
    distributeCompetitionPrizes(c.id);
    toast({
      title: "Prizes distributed (Demo)",
      description: `${formatCurrencyValue(total, "USD")} paid out to ${c.winners.length} winner${c.winners.length === 1 ? "" : "s"} of ${c.name}.`,
    });
  };

  /* ---------------- Enrollment ---------------- */

  const decideEnrollment = (compId: string, entrantId: string, decision: "approved" | "rejected") => {
    decideCompetitionEnrollment(compId, entrantId, decision);
    toast({
      title: decision === "approved" ? "Entrant approved (Demo)" : "Entrant rejected (Demo)",
      description: `Enrollment decision recorded for ${list.find((c) => c.id === compId)?.name ?? "competition"}.`,
    });
  };

  const enrollTrader = (compId: string, trader: string) => {
    enrollCompetitionTrader(compId, trader);
    toast({ title: "Trader enrolled (Demo)", description: `${trader} is now on the roster.` });
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
            {/* Status filter chips — triage one bucket at a time */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter competitions by status">
              {(["all", "active", "upcoming", "completed"] as const).map((s) => {
                const count = s === "all" ? list.length : list.filter((c) => c.status === s).length;
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </div>
            {visibleList.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No {statusFilter} competitions — try another status filter.
              </p>
            ) : (
            visibleList.map((c) => (
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
            ))
            )}
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

                {/* Participant list — trader-app joins via cross-app intake (R7 I3) */}
                <div className="border-t pt-2">
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <UserPlus className="h-3 w-3" /> Joined via trader app (demo transport)
                  </p>
                  {joinsForSelected.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
                      No trader-app joins yet for this competition.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {joinsForSelected.map((j) => (
                        <div key={j.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                          <UserPlus className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{j.traderName}</span>
                          <span className="flex-1 text-[10px] text-muted-foreground">
                            joined {new Date(j.joinedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{j.source}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
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
