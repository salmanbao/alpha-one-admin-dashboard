"use client";
/**
 * N11 — Marketing Audit Log (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 flat list:
 *   - **advanced filters** — actor, action verb, entity, date range, free text,
 *   - **actor detail drawer** — who did what, action mix, recent decisions,
 *   - **diff view** for content changes (template/subject/body versions),
 *   - **CSV export** of the filtered set,
 * on top of the live session audit trail (recordAudit → lib/audit) merged
 * with the seeded marketing history.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAudit } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { useAuditVersion } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { ScrollText, Download, UserRound, FileDiff } from "lucide-react";
import type { AuditEntry } from "@/lib/platform/types";

/* ------------------------------------------------------------------ */
/* Row model + seed (marketing-scoped history with content versions)   */
/* ------------------------------------------------------------------ */

interface AuditRow {
  id: string;
  ts: string;
  actor: string;
  verb: string;
  target: string;
  before: string;
  after: string;
  severity: AuditEntry["severity"];
  entity: string;
  ip?: string;
  device?: string;
  /** line-level content versions for the diff view */
  contentBefore?: string[];
  contentAfter?: string[];
}

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

/** Seed: marketing decisions incl. content changes worth diffing. */
const SEED: AuditRow[] = [
  {
    id: "a1",
    ts: ago(30),
    actor: "S. Malik",
    verb: "campaign.approved",
    target: "Q4 Scale Blitz",
    before: "in_review",
    after: "approved",
    severity: "info",
    entity: "campaign",
    ip: "10.4.2.18",
    device: "Chrome · macOS",
  },
  {
    id: "a2",
    ts: ago(90),
    actor: "System",
    verb: "flow.published",
    target: "Welcome & KYC nudge v3",
    before: "draft",
    after: "live",
    severity: "info",
    entity: "flow",
    device: "automation",
  },
  {
    id: "a3",
    ts: ago(4 * 60),
    actor: "A. Khan",
    verb: "template.edited",
    target: "Payout celebration",
    before: "v2",
    after: "v3",
    severity: "info",
    entity: "template",
    ip: "10.4.9.77",
    device: "Firefox · Windows",
    contentBefore: [
      "Subject: Your payout is on the way",
      "",
      "Hi {{first_name}},",
      "",
      "Your payout of {{payout_amount}} is processing.",
      "Expect it within 3 business days.",
      "",
      "— The {{firm_name}} team",
    ],
    contentAfter: [
      "Subject: Your payout is on the way 🎉",
      "",
      "Hi {{first_name}},",
      "",
      "Congrats — {{payout_amount}} is on the way!",
      "Track it live in your dashboard, or speed up your next",
      "one with the payout fast-track reward.",
      "",
      "— The {{firm_name}} team",
    ],
  },
  {
    id: "a4",
    ts: ago(6 * 60),
    actor: "S. Malik",
    verb: "connector.credential_rotated",
    target: "SendGrid (vault ref)",
    before: "rotated 90d ago",
    after: "rotation initiated",
    severity: "warning",
    entity: "credential",
    ip: "10.4.2.18",
    device: "Chrome · macOS",
  },
  {
    id: "a5",
    ts: ago(8 * 60),
    actor: "You",
    verb: "consent.override",
    target: "le***@scam.net",
    before: "suppressed",
    after: "DSR erasure verified",
    severity: "critical",
    entity: "consent",
  },
  {
    id: "a6",
    ts: ago(26 * 60),
    actor: "A. Khan",
    verb: "subject_line_changed",
    target: "Win-back wave 2",
    before: "We saved your seat",
    after: "We saved your seat — 20% inside",
    severity: "info",
    entity: "campaign",
    ip: "10.4.9.77",
    device: "Firefox · Windows",
    contentBefore: ["Subject: We saved your seat", "Preview: It's been a while…", "CTA: Come back stronger"],
    contentAfter: ["Subject: We saved your seat — 20% inside", "Preview: Your offer is waiting", "CTA: Claim 20% now"],
  },
  {
    id: "a7",
    ts: ago(3 * 24 * 60),
    actor: "R. Idris",
    verb: "cap.override_rejected",
    target: "VIP push burst",
    before: "override requested",
    after: "rejected (risk review)",
    severity: "warning",
    entity: "marketing",
    ip: "10.4.55.3",
    device: "Safari · iPad",
  },
];

/* ------------------------------------------------------------------ */
/* Diff helper (line-level, naive but deterministic)                   */
/* ------------------------------------------------------------------ */

type DiffKind = "same" | "added" | "removed";
interface DiffLine {
  kind: DiffKind;
  text: string;
}

function diffLines(before: string[], after: string[]): DiffLine[] {
  const out: DiffLine[] = [];
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i++) {
    const b = before[i];
    const a = after[i];
    if (b !== undefined && a !== undefined && b === a) out.push({ kind: "same", text: a });
    else {
      if (b !== undefined) out.push({ kind: "removed", text: b });
      if (a !== undefined) out.push({ kind: "added", text: a });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketingAuditLogPage() {
  const { runtime } = usePlatform();
  const auditVersion = useAuditVersion();

  const [actor, setActor] = useState("all");
  const [verb, setVerb] = useState("all");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [actorDetail, setActorDetail] = useState<string | null>(null);
  const [diffRow, setDiffRow] = useState<AuditRow | null>(null);

  /** Live session entries (this browser) merged with the seeded history. */
  const rows: AuditRow[] = useMemo(() => {
    void auditVersion; // recompute when recordAudit fires
    const tid = runtime.tenant?.id ?? "platform";
    const live: AuditRow[] = getTenantAudit(tid)
      .filter((e) => (e.module ?? e.entity) === "marketing" || e.entity === "marketing" || e.entity === "campaign" || e.entity === "template" || e.entity === "consent" || e.entity === "credential" || e.entity === "flow")
      .map((e) => ({
        id: e.id,
        ts: e.timestamp,
        actor: e.actor,
        verb: e.action.toLowerCase().replace(/\s+/g, "."),
        target: e.entityId ?? e.entity,
        before: "—",
        after: e.summary,
        severity: e.severity,
        entity: e.entity,
      }));
    const all = [...live, ...SEED];
    const seen = new Set<string>();
    return all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }, [auditVersion, runtime.tenant?.id]);

  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actor))).sort(), [rows]);
  const verbs = useMemo(() => Array.from(new Set(rows.map((r) => r.verb))).sort(), [rows]);
  const entities = useMemo(() => Array.from(new Set(rows.map((r) => r.entity))).sort(), [rows]);

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(to).getTime() : Infinity;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (actor !== "all" && r.actor !== actor) return false;
      if (verb !== "all" && r.verb !== verb) return false;
      if (entity !== "all" && r.entity !== entity) return false;
      const t = new Date(r.ts).getTime();
      if (t < fromMs || t > toMs) return false;
      if (needle && !`${r.actor} ${r.verb} ${r.target} ${r.before} ${r.after}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, actor, verb, entity, from, to, q]);

  const actorStats = useMemo(() => {
    if (!actorDetail) return null;
    const mine = rows.filter((r) => r.actor === actorDetail);
    const byVerb = new Map<string, number>();
    for (const r of mine) byVerb.set(r.verb, (byVerb.get(r.verb) ?? 0) + 1);
    return {
      total: mine.length,
      warnings: mine.filter((r) => r.severity === "warning").length,
      critical: mine.filter((r) => r.severity === "critical").length,
      mix: Array.from(byVerb.entries()).sort((a, b) => b[1] - a[1]),
      recent: mine.slice(0, 6),
      first: mine[mine.length - 1],
    };
  }, [rows, actorDetail]);

  function exportCsv() {
    exportToCsv<AuditRow>(
      filtered,
      [
        { key: "ts", header: "timestamp", value: (r) => r.ts },
        { key: "actor", header: "actor", value: (r) => r.actor },
        { key: "verb", header: "action", value: (r) => r.verb },
        { key: "entity", header: "entity", value: (r) => r.entity },
        { key: "target", header: "target", value: (r) => r.target },
        { key: "before", header: "before", value: (r) => r.before },
        { key: "after", header: "after", value: (r) => r.after },
        { key: "severity", header: "severity", value: (r) => r.severity },
      ],
      `marketing-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast({ title: "CSV exported", description: `${filtered.length} filtered marketing audit row(s) downloaded.` });
  }

  function clearFilters() {
    setActor("all");
    setVerb("all");
    setEntity("all");
    setFrom("");
    setTo("");
    setQ("");
  }

  const cols: Column<AuditRow>[] = [
    { key: "ts", header: "When", sortValue: (r) => r.ts, cell: (r) => <span className="text-xs">{new Date(r.ts).toLocaleString()}</span> },
    {
      key: "actor",
      header: "Actor",
      cell: (r) => (
        <button type="button" className="flex items-center gap-1 text-left font-medium text-primary hover:underline" onClick={() => setActorDetail(r.actor)}>
          <UserRound className="h-3 w-3" />
          {r.actor}
        </button>
      ),
    },
    { key: "verb", header: "Action", cell: (r) => <code className="text-[10px]">{r.verb}</code> },
    { key: "target", header: "Target", cell: (r) => r.target },
    { key: "ba", header: "Before → After", cell: (r) => <span className="text-xs text-muted-foreground">{r.before} → <span className="text-foreground">{r.after}</span></span> },
    {
      key: "sev",
      header: "Severity",
      cell: (r) => <StatusBadge tone={r.severity === "critical" ? "danger" : r.severity === "warning" ? "warning" : "info"}>{r.severity}</StatusBadge>,
    },
    {
      key: "d",
      header: "",
      cell: (r) =>
        r.contentBefore && r.contentAfter ? (
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setDiffRow(r)}>
            <FileDiff className="mr-1 h-3 w-3" />
            Diff
          </Button>
        ) : null,
    },
  ];

  const diff = diffRow?.contentBefore && diffRow?.contentAfter ? diffLines(diffRow.contentBefore, diffRow.contentAfter) : [];

  return (
    <Page>
      <PageHeader
        title="Marketing Audit Log"
        description="Marketing-scoped decisions: approvals, template/subject edits (with diff), cap overrides, credential rotations, consent overrides."
        icon={ScrollText}
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export CSV</Button>}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Rows (filtered)" value={String(filtered.length)} deltaLabel={`${rows.length} total`} />
          <MetricCard label="Actors" value={String(new Set(filtered.map((r) => r.actor)).size)} />
          <MetricCard label="Warnings" value={String(filtered.filter((r) => r.severity === "warning").length)} tone="warning" />
          <MetricCard label="Critical" value={String(filtered.filter((r) => r.severity === "critical").length)} tone={filtered.some((r) => r.severity === "critical") ? "negative" : "positive"} />
        </div>

        {/* ── Advanced filters ────────────────────────────────────── */}
        <div className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, target, before/after…" className="h-8" />
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Actor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={verb} onValueChange={setVerb}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {verbs.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs">From<Input type="datetime-local" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs">To<Input type="datetime-local" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <div className="flex items-end lg:col-span-2">
            <Button size="sm" variant="ghost" className="h-8" onClick={clearFilters}>Clear filters</Button>
          </div>
        </div>

        <div className="mt-3">
          <DataTable columns={cols} data={filtered} rowKey={(r) => r.id} pageSize={12} />
        </div>

        {/* ── Actor detail drawer ─────────────────────────────────── */}
        <Sheet open={!!actorDetail} onOpenChange={(o) => !o && setActorDetail(null)}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Actor — {actorDetail}</SheetTitle>
              <SheetDescription>Marketing-scoped actions recorded for this actor.</SheetDescription>
            </SheetHeader>
            {actorStats && (
              <div className="mt-3 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Actions</p><p className="text-lg font-semibold">{actorStats.total}</p></div>
                  <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Warnings</p><p className="text-lg font-semibold text-amber-600">{actorStats.warnings}</p></div>
                  <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Critical</p><p className="text-lg font-semibold text-rose-600">{actorStats.critical}</p></div>
                </div>
                <div className="rounded border p-2">
                  <p className="mb-1 font-semibold">Action mix</p>
                  {actorStats.mix.map(([v, n]) => (
                    <div key={v} className="flex justify-between"><code className="text-[10px]">{v}</code><span className="tabular-nums">{n}</span></div>
                  ))}
                  {actorStats.first && <p className="mt-1 text-[10px] text-muted-foreground">First seen: {new Date(actorStats.first.ts).toLocaleString()}</p>}
                </div>
                <div className="rounded border p-2">
                  <p className="mb-1 font-semibold">Recent decisions</p>
                  <ul className="space-y-1">
                    {actorStats.recent.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span className="truncate">{r.after}</span>
                        <span className="shrink-0 text-muted-foreground">{new Date(r.ts).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[10px] text-muted-foreground">Actor identity resolves from the platform user directory (platform-admin impersonation sessions included).</p>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* ── Content diff ────────────────────────────────────────── */}
        <Sheet open={!!diffRow} onOpenChange={(o) => !o && setDiffRow(null)}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Content diff — {diffRow?.target}</SheetTitle>
              <SheetDescription>
                {diffRow ? `${diffRow.before} → ${diffRow.after} · ${diffRow.actor} · ${new Date(diffRow.ts).toLocaleString()}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-3 overflow-x-auto rounded border font-mono text-[11px]">
              <table className="w-full">
                <tbody>
                  {diff.map((l, i) => (
                    <tr
                      key={i}
                      className={
                        l.kind === "added"
                          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : l.kind === "removed"
                            ? "bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
                            : ""
                      }
                    >
                      <td className="w-6 select-none border-r px-1 text-center text-muted-foreground">{l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}</td>
                      <td className="px-2">{l.text || " "}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Line-level diff of the stored content snapshots (R2-F04). Green lines were added, red lines removed — unchanged context kept for readability.
            </p>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}
