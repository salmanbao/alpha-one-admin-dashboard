"use client";

/**
 * Competitions — research item #41.
 *
 * Competition list + detail with rules, participants, leaderboard,
 * prize configuration, winners, and status.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Trophy, Users, DollarSign, Calendar, Plus, Medal, Award, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";

interface Competition {
  id: string;
  name: string;
  status: "upcoming" | "active" | "completed";
  participants: number;
  prizePool: number;
  prize: string;
  start: string;
  end: string;
  rules: string[];
  leaderboard: { rank: number; trader: string; score: number; prize: string }[];
  winners: { place: string; trader: string; prize: string }[];
}

const competitions: Competition[] = [
  {
    id: "COMP-001",
    name: "Alpha Trading Challenge Q3",
    status: "active",
    participants: 142,
    prizePool: 25000,
    prize: "$25,000 prize pool · Top 10 win cash",
    start: "5d ago",
    end: "in 9d",
    rules: [
      "Trade any challenge account",
      "Highest profit % wins",
      "Minimum 10 trades required",
      "No copy trading between participants",
      "Max drawdown rules apply",
    ],
    leaderboard: [
      { rank: 1, trader: "Liam Smith", score: 18.5, prize: "$10,000" },
      { rank: 2, trader: "Emma Wilson", score: 16.2, prize: "$5,000" },
      { rank: 3, trader: "Noah Davis", score: 14.8, prize: "$3,000" },
      { rank: 4, trader: "Olivia Brown", score: 12.1, prize: "$1,500" },
      { rank: 5, trader: "James Taylor", score: 11.3, prize: "$1,000" },
    ],
    winners: [],
  },
  {
    id: "COMP-002",
    name: "Summer Sizzle Trading Cup",
    status: "completed",
    participants: 89,
    prizePool: 10000,
    prize: "$10,000 prize pool · Top 5 win cash",
    start: "30d ago",
    end: "16d ago",
    rules: [
      "Open to all funded traders",
      "Highest cumulative profit",
      "Minimum 20 trades",
    ],
    leaderboard: [],
    winners: [
      { place: "1st", trader: "Sophia Miller", prize: "$5,000" },
      { place: "2nd", trader: "Mason Anderson", prize: "$2,500" },
      { place: "3rd", trader: "Ava Thomas", prize: "$1,000" },
    ],
  },
  {
    id: "COMP-003",
    name: "Q4 Funded Trader Showdown",
    status: "upcoming",
    participants: 0,
    prizePool: 50000,
    prize: "$50,000 prize pool · Top 20 win cash + funded accounts",
    start: "in 12d",
    end: "in 42d",
    rules: [
      "Open to all active traders",
      "Highest risk-adjusted return (Sharpe)",
      "Minimum 30 trades",
      "Max 2 accounts per trader",
    ],
    leaderboard: [],
    winners: [],
  },
];

const statusTone = (s: Competition["status"]) =>
  s === "active" ? "success" : s === "upcoming" ? "info" : "muted";

const medalIcon = (rank: number) =>
  rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : Trophy;

export function CompetitionsPage() {
  const { } = usePlatform();
  const [selected, setSelected] = useState<Competition | null>(competitions[0]);

  return (
    <Page>
      <PageHeader title="Competitions" description="Trading competitions, leaderboards, and prize distribution." icon={Trophy}
        actions={<Button size="sm" onClick={() => toast({ title: "Create competition", description: "Competition wizard would open here (demo)." })}><Plus className="mr-1 h-4 w-4" /> Create</Button>} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total" value={competitions.length} icon={Trophy} />
          <MetricCard label="Active" value={competitions.filter((c) => c.status === "active").length} icon={Calendar} tone="positive" />
          <MetricCard label="Upcoming" value={competitions.filter((c) => c.status === "upcoming").length} icon={Calendar} />
          <MetricCard label="Total Prize Pool" value={`$${competitions.reduce((s, c) => s + c.prizePool, 0).toLocaleString()}`} icon={DollarSign} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Competition list */}
          <div className="space-y-2">
            {competitions.map((c) => (
              <Card key={c.id} className={`cursor-pointer transition hover:shadow-md ${selected?.id === c.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelected(c)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>
                    <Badge variant="outline" className="text-[10px]">{c.id}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">{c.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.participants}</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${c.prizePool.toLocaleString()}</span>
                    <span>{c.start} → {c.end}</span>
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
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.prize}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Rules */}
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Rules</p>
                  <ul className="space-y-0.5">
                    {selected.rules.map((r, i) => <li key={i} className="text-[11px] text-muted-foreground">· {r}</li>)}
                  </ul>
                </div>

                {/* Leaderboard (active competitions) */}
                {selected.status === "active" && selected.leaderboard.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Trophy className="h-3 w-3" />Leaderboard</p>
                    <div className="space-y-1">
                      {selected.leaderboard.map((entry) => {
                        const Icon = medalIcon(entry.rank);
                        return (
                          <div key={entry.rank} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                            <Icon className={`h-4 w-4 ${entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-amber-700" : "text-muted-foreground"}`} />
                            <span className="font-medium">#{entry.rank}</span>
                            <span className="flex-1">{entry.trader}</span>
                            <span className="font-medium tabular-nums">{entry.score}%</span>
                            <Badge variant="outline" className="text-[10px]">{entry.prize}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Winners (completed competitions) */}
                {selected.status === "completed" && selected.winners.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Crown className="h-3 w-3" />Winners</p>
                    <div className="space-y-1">
                      {selected.winners.map((w) => {
                        const Icon = w.place === "1st" ? Crown : w.place === "2nd" ? Medal : Award;
                        return (
                          <div key={w.place} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                            <Icon className={`h-4 w-4 ${w.place === "1st" ? "text-amber-500" : w.place === "2nd" ? "text-slate-400" : "text-amber-700"}`} />
                            <span className="font-medium">{w.place}</span>
                            <span className="flex-1">{w.trader}</span>
                            <Badge variant="outline" className="text-[10px]">{w.prize}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 border-t pt-2">
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Participants</p><p className="text-sm font-bold tabular-nums">{selected.participants}</p></div>
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prize pool</p><p className="text-sm font-bold tabular-nums">${selected.prizePool.toLocaleString()}</p></div>
                  <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration</p><p className="text-sm font-bold">{selected.start} → {selected.end}</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
