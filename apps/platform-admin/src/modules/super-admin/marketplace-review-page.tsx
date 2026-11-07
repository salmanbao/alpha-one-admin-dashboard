"use client";
/**
 * N15 — Marketplace App Review Pipeline (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 skeleton: submission **detail drawer** with
 *   - manifest diff (incoming vs published: added / removed / changed keys),
 *   - sandbox test checklist (pass/fail/pending + re-run),
 *   - security questionnaire (answered, reviewer verdict),
 *   - staged rollout percentage with ramp schedule + revoke flow,
 * alongside the existing queue, versioning/rollback and publish/suspend.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Plug, FileDiff, FlaskConical, ShieldQuestion, Gauge, RotateCcw, Ban } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + seed                                                        */
/* ------------------------------------------------------------------ */

type State = "submitted" | "in_review" | "needs_info" | "published" | "suspended" | "revoked";

/** Mirrors the platform StatusBadge tone union (not exported by status.tsx). */
type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

type DiffKind = "added" | "removed" | "changed" | "same";
interface DiffLine {
  key: string;
  kind: DiffKind;
  prev?: string;
  next?: string;
}
type TestStatus = "pass" | "fail" | "pending";
interface SandboxTest {
  id: string;
  name: string;
  status: TestStatus;
  ms: number;
}
type Verdict = "pass" | "fail" | "pending";
interface SecurityQ {
  id: string;
  q: string;
  a: string;
  verdict: Verdict;
}
interface HistoryEntry {
  at: string;
  actor: string;
  note: string;
}
interface Sub {
  id: string;
  app: string;
  publisher: string;
  version: string;
  publishedVersion: string;
  state: State;
  perms: string[];
  notes: string;
  manifest: DiffLine[];
  sandbox: SandboxTest[];
  security: SecurityQ[];
  rollout: number;
  ramp: string[];
  history: HistoryEntry[];
}

const now = () => new Date().toISOString();
const stamp = () => new Date().toLocaleString();

const SEED: Sub[] = [
  {
    id: "s1",
    app: "SignalPush",
    publisher: "Acme Labs",
    version: "1.3.0",
    publishedVersion: "1.2.0",
    state: "in_review",
    perms: ["events.read", "contacts.read", "segments:read"],
    notes: "",
    manifest: [
      { key: "id", kind: "same", prev: "com.acme.signalpush", next: "com.acme.signalpush" },
      { key: "version", kind: "changed", prev: "1.2.0", next: "1.3.0" },
      { key: "scopes[].segments:read", kind: "added", next: "read-only segment lookup" },
      { key: "scopes[].contacts.write", kind: "added", next: "write back push token state" },
      { key: "scopes[].events.relay", kind: "removed", prev: "server event forwarding" },
      { key: "webhooks[]", kind: "changed", prev: "1 endpoint (delivered)", next: "2 endpoints (delivered, bounced)" },
      { key: "data.retention_days", kind: "changed", prev: "30", next: "90" },
      { key: "permissions[].notifications", kind: "same", prev: "granted", next: "granted" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 820 },
      { id: "t2", name: "OAuth scope handshake", status: "pass", ms: 410 },
      { id: "t3", name: "GET /v2/segments (scopes:read)", status: "pass", ms: 190 },
      { id: "t4", name: "POST /v2/contacts/{id}/push-token", status: "fail", ms: 1240 },
      { id: "t5", name: "Webhook signature verification", status: "pending", ms: 0 },
      { id: "t6", name: "Rate-limit 429 handling", status: "pass", ms: 60 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "EU (Frankfurt) region, AES-256 at rest via managed KMS.", verdict: "pass" },
      { id: "q2", q: "Describe retention & deletion of webhook payloads.", a: "Payloads purged after 30 days; deletion API exposed to tenant admins.", verdict: "pass" },
      { id: "q3", q: "Is customer data used for model training or resale?", a: "No. Data is processed only to deliver the app's functionality.", verdict: "pass" },
      { id: "q4", q: "Incident notification SLA (sub-processor breach)?", a: "— not answered —", verdict: "pending" },
      { id: "q5", q: "Independent security assessment in last 12 months?", a: "SOC 2 Type II dated 2026-03 (uploaded).", verdict: "pass" },
    ],
    rollout: 25,
    ramp: ["Day 0 — 10% (internal tenants)", "Day 3 — 25%", "Day 7 — 50%", "Day 14 — 100%"],
    history: [
      { at: stamp(), actor: "marketplace-bot", note: "Submission received for v1.3.0." },
      { at: stamp(), actor: "reviewer.kim", note: "Review started; sandbox suite queued." },
    ],
  },
  {
    id: "s2",
    app: "LedgerSync",
    publisher: "FinCo",
    version: "2.1.0",
    publishedVersion: "2.0.1",
    state: "submitted",
    perms: ["payouts.read"],
    notes: "",
    manifest: [
      { key: "id", kind: "same", prev: "fi.finco.ledgersync", next: "fi.finco.ledgersync" },
      { key: "version", kind: "changed", prev: "2.0.1", next: "2.1.0" },
      { key: "scopes[].payouts.read", kind: "same", prev: "read payouts", next: "read payouts" },
      { key: "scopes[].payouts.write", kind: "added", next: "propose payout batches (needs approval)" },
      { key: "ui.embedded_views[]", kind: "added", next: "payout-reconciliation" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 640 },
      { id: "t2", name: "OAuth scope handshake", status: "pending", ms: 0 },
      { id: "t3", name: "GET /v2/payouts (scopes:read)", status: "pending", ms: 0 },
      { id: "t4", name: "Approval-gated write path", status: "pending", ms: 0 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "US (Iowa), SOC 2 Type II.", verdict: "pass" },
      { id: "q2", q: "Sub-processor list published & versioned?", a: "Yes — /subprocessors, 30-day change notice.", verdict: "pass" },
      { id: "q3", q: "Write-path approval enforcement?", a: "— not answered —", verdict: "pending" },
    ],
    rollout: 0,
    ramp: ["Not scheduled — publish gates the ramp"],
    history: [{ at: stamp(), actor: "marketplace-bot", note: "Submission received for v2.1.0." }],
  },
  {
    id: "s3",
    app: "OldWebhook",
    publisher: "Legacy Inc",
    version: "0.9.0",
    publishedVersion: "0.9.0",
    state: "needs_info",
    perms: ["events.read"],
    notes: "Clarify data retention.",
    manifest: [
      { key: "id", kind: "same", prev: "io.legacy.oldwebhook", next: "io.legacy.oldwebhook" },
      { key: "version", kind: "changed", prev: "0.8.4", next: "0.9.0" },
      { key: "data.retention_days", kind: "changed", prev: "365", next: "unlimited" },
      { key: "webhooks[].verify", kind: "removed", prev: "HMAC sha256" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 910 },
      { id: "t2", name: "Webhook signature verification", status: "fail", ms: 2100 },
    ],
    security: [
      { id: "q1", q: "Retention & deletion of webhook payloads?", a: "\"Unlimited until tenant deletes app\" — flagged by reviewer.", verdict: "fail" },
      { id: "q2", q: "Sub-processor list published & versioned?", a: "No published list.", verdict: "fail" },
    ],
    rollout: 0,
    ramp: ["Blocked — security questionnaire failed"],
    history: [
      { at: stamp(), actor: "marketplace-bot", note: "Submission received for v0.9.0." },
      { at: stamp(), actor: "reviewer.kim", note: "Requested info: retention + sub-processors." },
    ],
  },
  {
    id: "s4",
    app: "ChatRelay",
    publisher: "Slipstream",
    version: "3.4.2",
    publishedVersion: "3.4.2",
    state: "published",
    perms: ["events.read", "contacts.read"],
    notes: "Healthy; 12% rollout last ramp completed.",
    manifest: [
      { key: "id", kind: "same", prev: "co.slipstream.chatrelay", next: "co.slipstream.chatrelay" },
      { key: "version", kind: "same", prev: "3.4.2", next: "3.4.2" },
      { key: "scopes[].events.read", kind: "same", prev: "read events", next: "read events" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 700 },
      { id: "t2", name: "Webhook signature verification", status: "pass", ms: 320 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "EU region, encrypted.", verdict: "pass" },
      { id: "q2", q: "Incident notification SLA?", a: "24h to tenant admin + platform.", verdict: "pass" },
    ],
    rollout: 100,
    ramp: ["Completed — full availability since 2026-10-02"],
    history: [{ at: stamp(), actor: "reviewer.kim", note: "Published v3.4.2 at 100%." }],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const stateTone = (s: State): Tone =>
  s === "published" ? "success" : s === "suspended" || s === "revoked" ? "danger" : s === "needs_info" ? "warning" : "info";

const testTone = (t: TestStatus): Tone => (t === "pass" ? "success" : t === "fail" ? "danger" : "muted");
const verdictTone = (v: Verdict): Tone => (v === "pass" ? "success" : v === "fail" ? "danger" : "warning");
const diffTone = (k: DiffKind): Tone =>
  k === "added" ? "success" : k === "removed" ? "danger" : k === "changed" ? "warning" : "muted";

/** Publish gate: every sandbox test green + no failed security answer + no new scope on a "fail". */
function gate(s: Sub): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const failedTests = s.sandbox.filter((t) => t.status !== "pass");
  if (failedTests.length) reasons.push(`${failedTests.length} sandbox test(s) not passing`);
  const failedQ = s.security.filter((q) => q.verdict === "fail");
  if (failedQ.length) reasons.push(`${failedQ.length} security answer(s) failed review`);
  const pendingQ = s.security.filter((q) => q.verdict === "pending");
  if (pendingQ.length) reasons.push(`${pendingQ.length} security question(s) unanswered`);
  const breaking = s.manifest.filter((d) => d.kind === "removed" && d.key.startsWith("webhooks"));
  if (breaking.length) reasons.push(`breaking manifest removal: ${breaking.map((b) => b.key).join(", ")}`);
  return { ok: reasons.length === 0, reasons };
}

const ROLLOUT_STEPS = [5, 10, 25, 50, 100];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketplaceReviewPage() {
  const [rows, setRows] = useState<Sub[]>(SEED);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("manifest");
  const [act, setAct] = useState<{ r: Sub; next: State } | null>(null);
  const [msg, setMsg] = useState("");
  const [rollout, setRollout] = useState("25");
  const [revoke, setRevoke] = useState<Sub | null>(null);
  const [retest, setRetest] = useState<string | null>(null);

  const detail = useMemo(() => rows.find((r) => r.id === detailId) ?? null, [rows, detailId]);
  const selected = act?.r ? rows.find((r) => r.id === act.r.id) ?? act.r : null;
  const gateResult = selected ? gate(selected) : { ok: false, reasons: [] };

  const patch = (id: string, fn: (s: Sub) => Sub) => setRows((rs) => rs.map((s) => (s.id === id ? fn(s) : s)));

  const cols: Column<Sub>[] = [
    {
      key: "app",
      header: "App",
      cell: (r) => (
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={() => {
            setDetailId(r.id);
            setTab("manifest");
          }}
        >
          {r.app}
          <span className="block text-[10px] font-normal text-muted-foreground">
            {r.publisher} · {r.version}
            {r.publishedVersion ? ` · published ${r.publishedVersion}` : " · unpublished"}
          </span>
        </button>
      ),
    },
    {
      key: "perms",
      header: "Scopes requested",
      cell: (r) => <span className="font-mono text-[10px]">{r.perms.join(", ")}</span>,
    },
    {
      key: "st",
      header: "State",
      cell: (r) => <StatusBadge tone={stateTone(r.state)}>{r.state.replace("_", " ")}</StatusBadge>,
    },
    {
      key: "gate",
      header: "Review gate",
      cell: (r) => {
        const g = gate(r);
        return g.ok ? (
          <StatusBadge tone="success">clear</StatusBadge>
        ) : (
          <span className="text-[10px] text-muted-foreground">{g.reasons[0]}{g.reasons.length > 1 ? ` +${g.reasons.length - 1}` : ""}</span>
        );
      },
    },
    {
      key: "roll",
      header: "Rollout",
      numeric: true,
      cell: (r) => <span className={r.rollout >= 100 ? "text-emerald-600" : ""}>{r.rollout}%</span>,
    },
    {
      key: "a",
      header: "",
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setDetailId(r.id); setTab("manifest"); }}>
            Detail
          </Button>
          {r.state !== "published" && r.state !== "revoked" && (
            <Button size="sm" className="h-6 text-[10px]" onClick={() => { setAct({ r, next: "published" }); setMsg(""); setRollout(String(r.rollout || 25)); }}>
              Publish
            </Button>
          )}
          {r.state === "submitted" && (
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setAct({ r, next: "needs_info" }); setMsg(""); }}>
              Needs info
            </Button>
          )}
          {r.state === "published" && (
            <>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setAct({ r, next: "suspended" }); setMsg(""); }}>
                Suspend
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={() => setRevoke(r)}>
                <Ban className="mr-1 h-3 w-3" />Revoke
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={() => {
              patch(r.id, (s) => ({ ...s, version: s.publishedVersion || s.version, history: [...s.history, { at: stamp(), actor: "You", note: `Rolled back to previous version (${s.publishedVersion}).` }] }));
              recordAudit({ actor: "You", action: "marketplace.rollback", target: r.id, detail: `${r.app} rolled back to ${r.publishedVersion}`, severity: "warning" });
              toast({ title: "Rolled back", description: `${r.app} → ${r.publishedVersion}` });
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Rollback
          </Button>
        </div>
      ),
    },
  ];

  const counts = (s: State) => rows.filter((r) => r.state === s).length;

  return (
    <Page>
      <PageHeader
        title="Marketplace App Review Pipeline"
        description="Submission detail with manifest diff, sandbox test checklist, security questionnaire, staged rollout percentage and revoke flow."
        icon={Plug}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          {(["submitted", "in_review", "needs_info", "published"] as State[]).map((s) => (
            <MetricCard key={s} label={s.replace("_", " ")} value={String(counts(s))} />
          ))}
        </div>

        <DataTable columns={cols} data={rows} rowKey={(r) => r.id} pageSize={8} searchableText={(r) => `${r.app} ${r.publisher} ${r.state}`} />

        {/* ── Submission detail ─────────────────────────────────────── */}
        <Sheet open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
          <SheetContent className="overflow-y-auto sm:max-w-2xl">
            {detail && (
              <>
                <SheetHeader>
                  <SheetTitle>
                    {detail.app} <span className="text-muted-foreground">v{detail.version}</span>
                  </SheetTitle>
                  <SheetDescription>
                    {detail.publisher} · {detail.state.replace("_", " ")} ·{" "}
                    {detail.publishedVersion ? `published ${detail.publishedVersion}` : "no published version"}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone={stateTone(detail.state)}>{detail.state.replace("_", " ")}</StatusBadge>
                  {gate(detail).ok ? <StatusBadge tone="success">gate clear</StatusBadge> : <StatusBadge tone="warning">gate blocked</StatusBadge>}
                  <StatusBadge tone="info">rollout {detail.rollout}%</StatusBadge>
                </div>

                <Tabs value={tab} onValueChange={setTab} className="mt-3">
                  <TabsList>
                    <TabsTrigger value="manifest">
                      <FileDiff className="mr-1 h-3 w-3" />Manifest diff
                    </TabsTrigger>
                    <TabsTrigger value="sandbox">
                      <FlaskConical className="mr-1 h-3 w-3" />Sandbox
                    </TabsTrigger>
                    <TabsTrigger value="security">
                      <ShieldQuestion className="mr-1 h-3 w-3" />Security
                    </TabsTrigger>
                    <TabsTrigger value="rollout">
                      <Gauge className="mr-1 h-3 w-3" />Rollout
                    </TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>

                  {/* Manifest diff */}
                  <TabsContent value="manifest" className="mt-3 space-y-3">
                    <Card>
                      <CardContent className="space-y-1 p-3 text-xs">
                        <p className="mb-2 font-semibold">Incoming manifest vs published {detail.publishedVersion || "—"} (AC: diff surfaced before publish)</p>
                        {detail.manifest.map((d) => (
                          <div key={d.key} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded border px-2 py-1.5">
                            <div>
                              <code className="text-[11px]">{d.key}</code>
                              <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                {d.prev !== undefined && <span>− {d.prev}</span>}
                                {d.next !== undefined && <span>+ {d.next}</span>}
                              </div>
                            </div>
                            <StatusBadge tone={diffTone(d.kind)}>{d.kind}</StatusBadge>
                          </div>
                        ))}
                        <p className="pt-1 text-[10px] text-muted-foreground">
                          Scope changes on publish are versioned & audit-logged (ties to R2-12 AC-3).
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-xs">
                        <p className="mb-2 font-semibold">Scopes requested</p>
                        <div className="flex flex-wrap gap-1">
                          {detail.perms.map((p) => (
                            <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p}</code>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sandbox checklist */}
                  <TabsContent value="sandbox" className="mt-3 space-y-3">
                    <Card>
                      <CardContent className="space-y-2 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">Sandbox test checklist</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => {
                              setRetest(detail.id);
                              window.setTimeout(() => {
                                patch(detail.id, (s) => ({
                                  ...s,
                                  sandbox: s.sandbox.map((t) => ({ ...t, status: "pass", ms: t.ms || 300 })),
                                  history: [...s.history, { at: stamp(), actor: "sandbox-runner", note: "Sandbox suite re-run: all checks passing." }],
                                }));
                                setRetest(null);
                                toast({ title: "Sandbox re-run complete", description: "All checks now pass." });
                              }, 700);
                            }}
                            disabled={retest === detail.id}
                          >
                            <FlaskConical className="mr-1 h-3 w-3" />
                            {retest === detail.id ? "Running…" : "Re-run all"}
                          </Button>
                        </div>
                        {detail.sandbox.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                            <span>{t.name}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{t.ms ? `${t.ms}ms` : "—"}</span>
                              <StatusBadge tone={testTone(t.status)}>{t.status}</StatusBadge>
                            </span>
                          </div>
                        ))}
                        <p className="text-[10px] text-muted-foreground">
                          Suite runs against the sandbox tenant used by the R2-12 API playground.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Security questionnaire */}
                  <TabsContent value="security" className="mt-3 space-y-3">
                    <Card>
                      <CardContent className="space-y-2 p-3 text-xs">
                        <p className="font-semibold">Security questionnaire</p>
                        {detail.security.map((q) => (
                          <div key={q.id} className="rounded border p-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{q.q}</p>
                              <StatusBadge tone={verdictTone(q.verdict)}>{q.verdict}</StatusBadge>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{q.a}</p>
                            <div className="mt-1.5 flex gap-1">
                              {(["pass", "fail", "pending"] as Verdict[]).map((v) => (
                                <Button
                                  key={v}
                                  size="sm"
                                  variant={q.verdict === v ? "default" : "outline"}
                                  className="h-6 text-[10px]"
                                  onClick={() => {
                                    patch(detail.id, (s) => ({
                                      ...s,
                                      security: s.security.map((x) => (x.id === q.id ? { ...x, verdict: v } : x)),
                                      history: [...s.history, { at: stamp(), actor: "You", note: `Security answer "${q.q}" → ${v}.` }],
                                    }));
                                    recordAudit({ actor: "You", action: "marketplace.security_verdict", target: detail.id, detail: `${detail.app}: ${q.q} → ${v}`, severity: v === "fail" ? "critical" : "info" });
                                  }}
                                >
                                  {v}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Staged rollout + revoke */}
                  <TabsContent value="rollout" className="mt-3 space-y-3">
                    <Card>
                      <CardContent className="space-y-3 p-3 text-xs">
                        <p className="font-semibold">Staged rollout percentage</p>
                        <div className="flex items-center gap-3">
                          <Progress value={detail.rollout} className="flex-1" />
                          <span className="w-10 text-right font-semibold tabular-nums">{detail.rollout}%</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ROLLOUT_STEPS.map((pct) => (
                            <Button
                              key={pct}
                              size="sm"
                              variant={detail.rollout === pct ? "default" : "outline"}
                              className="h-7 text-[10px]"
                              disabled={detail.state !== "published"}
                              onClick={() => {
                                patch(detail.id, (s) => ({ ...s, rollout: pct, history: [...s.history, { at: stamp(), actor: "You", note: `Rollout moved to ${pct}%.` }] }));
                                recordAudit({ actor: "You", action: "marketplace.rollout", target: detail.id, detail: `${detail.app} rollout → ${pct}%`, severity: "info" });
                                toast({ title: `Rollout ${pct}%`, description: `${detail.app} ramp updated (audited).` });
                              }}
                            >
                              {pct}%
                            </Button>
                          ))}
                          {detail.state !== "published" && <span className="self-center text-[10px] text-muted-foreground">Publish before ramping.</span>}
                        </div>
                        <div>
                          <p className="mb-1 font-semibold">Ramp schedule</p>
                          <ol className="ml-4 list-decimal space-y-0.5 text-[11px] text-muted-foreground">
                            {detail.ramp.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ol>
                        </div>
                        <div className="flex gap-2 border-t pt-2">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive" disabled={detail.state !== "published"} onClick={() => setRevoke(detail)}>
                            <Ban className="mr-1 h-3 w-3" />Revoke app
                          </Button>
                          <span className="self-center text-[10px] text-muted-foreground">Revocation uninstalls for all tenants, cuts scopes and is audit-logged.</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Activity */}
                  <TabsContent value="activity" className="mt-3">
                    <Card>
                      <CardContent className="space-y-1.5 p-3 text-xs">
                        {detail.history.map((h, i) => (
                          <div key={i} className="rounded border px-2 py-1.5">
                            <p className="text-[10px] text-muted-foreground">
                              {h.at} · {h.actor}
                            </p>
                            <p>{h.note}</p>
                          </div>
                        ))}
                        <Textarea
                          className="mt-2 text-xs"
                          placeholder="Reviewer note / publisher communication"
                          defaultValue={detail.notes}
                          onBlur={(e) => patch(detail.id, (s) => ({ ...s, notes: e.target.value }))}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* ── State transition (publish / needs-info / suspend) ─────── */}
        <Dialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {act?.next} — {act?.r.app}
              </DialogTitle>
              <DialogDescription>
                {act?.next === "published"
                  ? `Publish gate: ${gateResult.ok ? "clear" : `blocked — ${gateResult.reasons.join("; ")}`}. Publish applies a staged rollout (${rollout}%) and versions any scope change.`
                  : "Review checklist: permissions requested, data handling, webhook endpoints verified. Add note (audited)."}
              </DialogDescription>
            </DialogHeader>
            {act?.next === "published" && (
              <div className="flex items-center gap-3 text-xs">
                <label htmlFor="rollout-select" className="font-medium">Staged rollout</label>
                <Select value={rollout} onValueChange={setRollout}>
                  <SelectTrigger id="rollout-select" className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLLOUT_STEPS.map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reviewer note / publisher communication" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAct(null)}>
                Cancel
              </Button>
              <Button
                disabled={!!(act?.next === "published" && selected && !gateResult.ok)}
                onClick={() => {
                  if (!act || !selected) return;
                  const pct = act.next === "published" ? Number(rollout) : selected.rollout;
                  patch(selected.id, (s) => ({
                    ...s,
                    state: act.next,
                    notes: msg,
                    rollout: pct,
                    publishedVersion: act.next === "published" ? s.version : s.publishedVersion,
                    ramp:
                      act.next === "published"
                        ? [`Day 0 — 10% (internal tenants)`, `Day 3 — ${pct}%`, `Day 7 — ${Math.min(100, pct * 2)}%`, `Day 14 — 100%`]
                        : s.ramp,
                    history: [...s.history, { at: stamp(), actor: "You", note: `${selected.app} → ${act.next}${msg ? `. ${msg}` : ""}` }],
                  }));
                  recordAudit({
                    actor: "You",
                    action: "marketplace.review",
                    target: selected.id,
                    detail: `${selected.app} ${selected.version} → ${act.next}${act.next === "published" ? ` at ${pct}% rollout` : ""}. ${msg}`,
                    severity: act.next === "suspended" ? "critical" : act.next === "published" ? "info" : "warning",
                  });
                  toast({ title: "Updated", description: `${selected.app} is now ${act.next}${act.next === `published` ? ` (${pct}% rollout)` : ""}.` });
                  setAct(null);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Revoke flow ───────────────────────────────────────────── */}
        <AlertDialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke {revoke?.app}?</AlertDialogTitle>
              <AlertDialogDescription>
                This uninstalls the app for every tenant, cuts scopes {revoke ? `(${revoke.perms.join(", ")})` : ""}, disables webhooks and
                requires a full re-review to restore. Recorded in the platform audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!revoke) return;
                  patch(revoke.id, (s) => ({
                    ...s,
                    state: "revoked",
                    rollout: 0,
                    history: [...s.history, { at: stamp(), actor: "You", note: "App revoked — uninstalled for all tenants, scopes cut." }],
                  }));
                  recordAudit({ actor: "You", action: "marketplace.revoke", target: revoke.id, detail: `Revoked ${revoke.app} v${revoke.version} for all tenants`, severity: "critical" });
                  toast({ title: "App revoked", description: `${revoke.app} uninstalled everywhere; audit-logged.`, variant: "destructive" });
                  setRevoke(null);
                }}
              >
                Revoke app
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContent>
    </Page>
  );
}
