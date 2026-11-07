"use client";
/**
 * R3-02 — Sanctions & PEP Screening Manager.
 *
 * Sources table (providers, lists subscribed, versions, syncs, match delta),
 * list detail (version history, exact/fuzzy thresholds, rescan schedule, job
 * log with before/after counts) and the match-review queue whose
 * dispositions write back into R2-07 case screening rows with list-version
 * provenance (AC-1..AC-3).
 */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { ScanSearch, RefreshCw, History, Gauge, ArrowRight } from "lucide-react";
import {
  listScreeningSources,
  getScreeningSource,
  listScreeningMatches,
  screeningMetrics,
  surfacedMatches,
  bumpListVersion,
  setMatchThreshold,
  setRescanSchedule,
  runRescan,
  dispositionMatch,
  useScreeningVersion,
  type ScreeningSource,
  type ScreeningMatch,
  type RescanSchedule,
  type MatchDisposition,
} from "../screening-store";

const SCHEDULE_LABEL: Record<RescanSchedule, string> = {
  "on-sync": "On sync",
  "on-case-open": "On case open",
  "nightly-batch": "Nightly batch",
};

const DISP_TONE: Record<MatchDisposition, "default" | "success" | "danger" | "warning"> = {
  pending: "warning",
  "true-match": "danger",
  "false-positive": "success",
};

export function ScreeningManagerPage() {
  const { navigate, user } = usePlatform();
  // Read via route permission; every mutation requires the new
  // compliance.screening.manage (Table 15).
  const canManage = hasPermission(user, "compliance.screening.manage");
  const manageTitle = canManage ? undefined : "Requires compliance.screening.manage";
  useScreeningVersion();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<string>("pending");

  const sources = listScreeningSources();
  const matches = listScreeningMatches();
  const metrics = screeningMetrics();
  const rows = queueFilter === "all" ? matches : matches.filter((m) => m.disposition === queueFilter);
  const selected = selectedId ? getScreeningSource(selectedId) : undefined;

  const sourceCols: Column<ScreeningSource>[] = [
    {
      key: "provider",
      header: "Provider",
      cell: (s) => (
        <div className="min-w-0">
          <span className="text-sm font-medium">{s.provider}</span>
          <span className="block text-[10px] text-muted-foreground">{s.id}</span>
        </div>
      ),
    },
    {
      key: "lists",
      header: "Lists subscribed",
      cell: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.lists.map((l) => (
            <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "version",
      header: "Current version",
      cell: (s) => (
        <div>
          <span className="font-mono text-xs font-medium">{s.currentVersion}</span>
          <Badge
            variant="outline"
            className={cnDelta(s.matchDelta)}
          >
            {s.matchDelta >= 0 ? `+${s.matchDelta}` : s.matchDelta} matches
          </Badge>
        </div>
      ),
    },
    {
      key: "sync",
      header: "Last / next sync",
      cell: (s) => (
        <span className="text-xs">
          {new Date(s.lastSync).toLocaleDateString()}
          <span className="block text-[10px] text-muted-foreground">next: {s.nextSync}</span>
        </span>
      ),
    },
    {
      key: "threshold",
      header: "Thresholds",
      cell: (s) => (
        <span className="text-xs font-mono">
          {s.thresholdFuzzy} fuzzy · {s.thresholdExact} exact
        </span>
      ),
    },
    {
      key: "rescan",
      header: "Rescan",
      cell: (s) => <StatusBadge tone="info">{SCHEDULE_LABEL[s.rescan]}</StatusBadge>,
    },
    {
      key: "surfaced",
      header: "Surfaced",
      cell: (s) => (
        <span className="text-xs font-medium">{surfacedMatches(s)} match(es)</span>
      ),
    },
  ];

  const queueCols: Column<ScreeningMatch>[] = [
    {
      key: "subject",
      header: "Subject / case",
      cell: (m) => (
        <div className="min-w-0">
          <span className="text-sm font-medium">{m.subject}</span>
          <button
            type="button"
            className="block text-[10px] text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate("aml-case", { id: m.caseId });
            }}
          >
            {m.caseId}
          </button>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider / list",
      cell: (m) => (
        <span className="text-xs">
          {m.provider}
          <span className="block text-[10px] text-muted-foreground">{m.listKind}</span>
        </span>
      ),
    },
    {
      key: "provenance",
      header: "List version",
      cell: (m) => <Badge variant="outline" className="font-mono text-[10px]">{m.listVersion}</Badge>,
    },
    {
      key: "score",
      header: "Score",
      cell: (m) => {
        const src = sources.find((s) => s.provider.replace(" (self-hosted)", "") === m.provider);
        const fuzzy = src?.thresholdFuzzy;
        const above = fuzzy === undefined || m.score >= fuzzy;
        return (
          <span className={`text-xs font-mono ${above ? "font-medium" : "text-muted-foreground"}`}>
            {m.score}
            {fuzzy !== undefined && <span className="block text-[10px] font-normal">{above ? `≥ ${fuzzy} fuzzy` : `< ${fuzzy} — below threshold`}</span>}
          </span>
        );
      },
    },
    {
      key: "result",
      header: "Result",
      cell: (m) => (
        <StatusBadge tone={m.result === "hit" ? "danger" : "warning"}>{m.result}</StatusBadge>
      ),
    },
    {
      key: "disposition",
      header: "Disposition",
      cell: (m) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge tone={DISP_TONE[m.disposition]}>{m.disposition}</StatusBadge>
          {m.disposition !== "true-match" && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={!canManage}
              title={manageTitle}
              onClick={(e) => {
                e.stopPropagation();
                if (dispositionMatch(m.id, "true-match", user?.name ?? "operator")) {
                  toast({ title: "True match recorded", description: `${m.caseId} screening result updated to hit (${m.provider}).`, variant: "destructive" });
                }
              }}
            >
              True match
            </Button>
          )}
          {m.disposition !== "false-positive" && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={!canManage}
              title={manageTitle}
              onClick={(e) => {
                e.stopPropagation();
                if (dispositionMatch(m.id, "false-positive", user?.name ?? "operator")) {
                  toast({ title: "False positive recorded", description: `${m.caseId} screening result updated to clear (${m.provider}).` });
                }
              }}
            >
              False positive
            </Button>
          )}
        </div>
      ),
    },
    {
      key: "decided",
      header: "Decided",
      cell: (m) => (
        <span className="text-[10px] text-muted-foreground">
          {m.dispositionBy ? `${m.dispositionBy} · ${new Date(m.dispositionAt!).toLocaleDateString()}` : "—"}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Sanctions & PEP Screening"
        description="List sources, versions, match thresholds, rescan jobs and the match-review queue feeding AML case screening rows."
        icon={ScanSearch}
      />
      <PageContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="List sources" value={metrics.sources} icon={ScanSearch} />
            <MetricCard label="Pending matches" value={metrics.pending} icon={History} tone={metrics.pending > 0 ? "warning" : "positive"} />
            <MetricCard label="True matches" value={metrics.trueMatches} icon={Gauge} tone={metrics.trueMatches > 0 ? "negative" : "default"} />
            <MetricCard label="Rescan jobs logged" value={metrics.jobs} icon={RefreshCw} />
          </div>

          <div>
            <h2 className="mb-1.5 text-sm font-semibold">List sources</h2>
            <DataTable
              columns={sourceCols}
              data={sources}
              rowKey={(s) => s.id}
              onRowClick={(s) => setSelectedId(s.id)}
              searchableText={(s) => `${s.provider} ${s.lists.join(" ")} ${s.currentVersion}`}
              searchPlaceholder="Search sources…"
              emptyTitle="No screening sources"
              emptyDescription="Add a provider subscription to start screening."
            />
          </div>

          <div>
            <h2 className="mb-1.5 text-sm font-semibold">Match review queue</h2>
            <DataTable
              columns={queueCols}
              data={rows}
              rowKey={(m) => m.id}
              onRowClick={(m) => navigate("aml-case", { id: m.caseId })}
              searchableText={(m) => `${m.subject} ${m.caseId} ${m.provider} ${m.listKind} ${m.disposition}`}
              searchPlaceholder="Search matches…"
              toolbar={
                <Select value={queueFilter} onValueChange={setQueueFilter}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dispositions</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="true-match">True match</SelectItem>
                    <SelectItem value="false-positive">False positive</SelectItem>
                  </SelectContent>
                </Select>
              }
              emptyTitle="Queue clear"
              emptyDescription="No matches with this disposition."
            />
          </div>
        </div>
      </PageContent>

      {/* List detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && (
            <ListDetailSheet
              source={selected}
              canManage={canManage}
              manageTitle={manageTitle}
              actor={user?.name ?? "operator"}
            />
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* List detail — versions, thresholds, schedule, job log               */
/* ------------------------------------------------------------------ */

function ListDetailSheet({
  source,
  canManage,
  manageTitle,
  actor,
}: {
  source: ScreeningSource;
  canManage: boolean;
  manageTitle: string | undefined;
  actor: string;
}) {
  const [fuzzy, setFuzzy] = useState(String(source.thresholdFuzzy));
  const [exact, setExact] = useState(String(source.thresholdExact));
  const [schedule, setSchedule] = useState<RescanSchedule>(source.rescan);

  // Re-sync the local form when a different source is opened.
  const [openId, setOpenId] = useState(source.id);
  if (openId !== source.id) {
    setOpenId(source.id);
    setFuzzy(String(source.thresholdFuzzy));
    setExact(String(source.thresholdExact));
    setSchedule(source.rescan);
  }

  const bump = () => {
    const r = bumpListVersion(source.id, actor);
    if (r.ok) {
      toast({
        title: "List version bumped",
        description: `${source.provider} → ${r.version}. Open-case screening rows re-stamped with the new version (AC-1).`,
      });
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {source.provider}
          <Badge variant="outline" className="font-mono text-[10px]">{source.currentVersion}</Badge>
        </SheetTitle>
        <SheetDescription>
          {source.lists.join(" · ")} · last sync {new Date(source.lastSync).toLocaleString()} · next {source.nextSync}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!canManage} title={manageTitle} onClick={bump}>
            <RefreshCw className="h-3.5 w-3.5" /> Sync now (bump version)
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canManage}
            title={manageTitle}
            onClick={() => {
              if (runRescan(source.id, actor)) {
                toast({ title: "Rescan complete", description: `${source.provider} rescanned across open cases — job logged.` });
              }
            }}
          >
            Run manual rescan
          </Button>
        </div>

        {/* Thresholds (AC-2) */}
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-2 flex items-center gap-1 font-semibold uppercase text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> Match thresholds
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Fuzzy score (0–100)</Label>
              <Input value={fuzzy} onChange={(e) => setFuzzy(e.target.value)} inputMode="numeric" className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Exact score (0–100)</Label>
              <Input value={exact} onChange={(e) => setExact(e.target.value)} inputMode="numeric" className="h-8 font-mono text-xs" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || !Number.isFinite(Number(fuzzy)) || !Number.isFinite(Number(exact))}
              title={manageTitle}
              onClick={() => {
                if (setMatchThreshold(source.id, Number(fuzzy), Number(exact), actor)) {
                  toast({
                    title: "Threshold saved — rescan logged",
                    description: `${source.provider} fuzzy → ${Math.round(Number(fuzzy))}. Rescan job recorded with counts before/after (AC-2).`,
                  });
                }
              }}
            >
              Save threshold (runs rescan)
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Currently surfacing {surfacedMatches(source)} match(es) at ≥ {source.thresholdFuzzy}.
            </span>
          </div>
        </div>

        {/* Rescan schedule */}
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-2 font-semibold uppercase text-muted-foreground">Rescan schedule</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={schedule} onValueChange={(v) => setSchedule(v as RescanSchedule)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCHEDULE_LABEL) as RescanSchedule[]).map((k) => (
                  <SelectItem key={k} value={k}>{SCHEDULE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || schedule === source.rescan}
              title={manageTitle}
              onClick={() => {
                if (setRescanSchedule(source.id, schedule, actor)) {
                  toast({ title: "Rescan schedule updated", description: `${source.provider} → ${SCHEDULE_LABEL[schedule]}.` });
                }
              }}
            >
              Save schedule
            </Button>
          </div>
        </div>

        {/* Version history */}
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-2 flex items-center gap-1 font-semibold uppercase text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Version history
          </p>
          <div className="space-y-1.5">
            {source.versions.map((v, i) => (
              <div key={v.version} className="flex items-start justify-between gap-2 border-b pb-1.5">
                <div>
                  <span className="font-mono font-medium">{v.version}</span>
                  {i === 0 && <Badge className="ml-1.5 text-[9px]">current</Badge>}
                  <p className="text-muted-foreground">{v.diff}</p>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  <div>{new Date(v.at).toLocaleDateString()}</div>
                  <div>{v.matches} matches in list</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rescan job log */}
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-2 font-semibold uppercase text-muted-foreground">Rescan job log</p>
          {source.jobs.length === 0 && <p className="text-muted-foreground">No jobs yet.</p>}
          <div className="space-y-1.5">
            {source.jobs.map((j, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5">
                <div>
                  <Badge variant={j.trigger === "threshold-change" ? "destructive" : "outline"} className="mr-1 text-[9px]">{j.trigger}</Badge>
                  <span className="font-mono">{j.listVersion}</span>
                  <span className="ml-1 text-muted-foreground">· {j.casesScanned} case(s) scanned</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono">
                    matches {j.matchesBefore} <ArrowRight className="inline h-3 w-3" /> {j.matchesAfter}
                  </span>
                  <span className="ml-2">{new Date(j.at).toLocaleString()} · {j.by}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function cnDelta(delta: number): string {
  return delta >= 0
    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
    : "border-amber-500/40 text-amber-700 dark:text-amber-400";
}
