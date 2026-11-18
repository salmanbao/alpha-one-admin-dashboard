"use client";

/**
 * Rule versions panel — R9 W1 Part A1 (UC-O2 operator publish).
 *
 * Sits on the risk-rule-engine page (the rule list's own view) and makes
 * the rule set a versioned document:
 *
 *   • unpublished-changes affordance — the live rule list is a DRAFT;
 *     diffing it against the latest published version shows exactly what
 *     a publish would ship (from → to rows), so operators never publish
 *     blind;
 *   • publish flow — scope (phase-config ids or `*`) + change notes in a
 *     confirm dialog that lists the diff; `publishRuleVersion` persists
 *     (`pfaas:demo:rules-versions`, R10), audits, and emits
 *     `rules.version-published` (consumers: the pinned evaluator, the
 *     grandfathered list below, the trader's /rules store + inbox);
 *   • grandfathered accounts — accounts pinned to an older version than
 *     the latest in their scope keep evaluating against their own
 *     version; they are listed per version instead of silently moving.
 *
 * (Demo) — all figures are simulated firm data.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "@/lib/platform/platform-context";
import {
  diffVersions,
  grandfatheredAccounts,
  publishRuleVersion,
  useRuleVersions,
} from "@/lib/rules-versions-store";
import type { RiskRule } from "@/lib/risk-rules-store";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

function DiffRows({ changes }: { changes: { field: string; from: string; to: string }[] }) {
  if (!changes.length) return <p className="text-xs text-muted-foreground">No field-level changes.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-3 font-medium">What changed</th>
          <th className="py-1 pr-3 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={`${c.field}-${i}`} className="border-t border-border/60">
            <td className="py-1 pr-3">{c.field}</td>
            <td className="py-1 pr-3 text-muted-foreground line-through">{c.from}</td>
            <td className="py-1 font-medium">{c.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RuleVersionsPanel({ rules }: { rules: RiskRule[] }) {
  // Prop-admin is a ?view= shell — cross-view links use navigate(), not
  // <Link href> (physical paths 404).
  const { navigate } = useRouter();
  const versions = useRuleVersions(); // newest first
  const latest = versions[0] ?? null;
  const pending = latest ? diffVersions(latest, rules) : [];
  const grandfathered = grandfatheredAccounts();

  const [publishing, setPublishing] = useState(false);
  const [scope, setScope] = useState("*");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  function openPublish(): void {
    setScope("*");
    setNotes("");
    setPublishing(true);
  }

  function confirmPublish(): void {
    const scopeIds = scope.split(",").map((s) => s.trim()).filter(Boolean);
    const v = publishRuleVersion({
      notes,
      programScope: scopeIds.length ? scopeIds : ["*"],
      rules,
    });
    toast({
      title: `Rules v${v.version} published`,
      description: `${v.changes.length} change(s) → ${v.programScope.join(", ")}. Existing accounts stay grandfathered (Demo).`,
    });
    setPublishing(false);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Rule versions</h2>
          {pending.length > 0 ? (
            <Badge variant="destructive">
              {pending.length} unpublished change{pending.length === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="outline">Draft matches published</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("appeals-queue")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Appeals queue →
          </button>
          <Button size="sm" onClick={openPublish} disabled={pending.length === 0}>
            Publish new version
          </Button>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        The live rule list above is a draft — publishing freezes it as a numbered version and
        records the diff. Accounts already running an older version keep it (grandfathered). (Demo)
      </p>

      {pending.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
            Unpublished changes vs {latest ? `v${latest.version}` : "published"}
          </div>
          <DiffRows changes={pending} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {versions.map((v) => {
          const isOpen = expanded === v.id;
          const pinsOnThis = grandfathered.filter((p) => p.ruleVersionId === v.id);
          const isLatest = latest?.id === v.id;
          return (
            <div key={v.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Rules v{v.version}</span>
                  {isLatest ? <Badge variant="secondary">Latest</Badge> : <Badge variant="outline">Superseded</Badge>}
                  <span className="text-muted-foreground">
                    {v.programScope.join(", ")} · effective {fmtDate(v.effectiveAt)} · by {v.publishedBy}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isLatest && pinsOnThis.length > 0 && (
                    <Badge variant="outline">{pinsOnThis.length} account(s) grandfathered</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : v.id)}>
                    {isOpen ? "Hide" : `${v.changes.length} change(s)`}
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{v.notes}</div>

              {isOpen && (
                <div className="mt-2 space-y-3">
                  <DiffRows changes={v.changes} />
                  {pinsOnThis.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Grandfathered accounts (running v{v.version})
                      </div>
                      <ul className="space-y-0.5 text-xs">
                        {pinsOnThis.map((p) => (
                          <li key={p.accountId}>
                            {p.login ?? p.accountId}
                            {p.program ? ` · ${p.program}` : ""} — pinned {fmtDate(p.pinnedAt)}
                            {p.repinnedBy ? ` (re-pinned by ${p.repinnedBy})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Publish confirm — scope + notes + the exact diff being shipped. */}
      <Dialog open={publishing} onOpenChange={(o) => { if (!o) setPublishing(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Rules v{latest ? latest.version + 1 : 1}</DialogTitle>
            <DialogDescription>
              Freezes the current draft as a new version. Existing accounts keep their pinned
              version (grandfathered) until re-pinned — publishing is never retroactive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {pending.length} change(s) being published
              </div>
              <DiffRows changes={pending} />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rv-scope">
                Program scope
              </label>
              <Input
                id="rv-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="* or comma-separated phase-config ids"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                <code>*</code> = every program, or list specific phase-config ids.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rv-notes">
                Change notes (shown to traders in the diff notice)
              </label>
              <Textarea
                id="rv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Daily-loss warning tightened to 75% after Q3 review."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishing(false)}>Cancel</Button>
            <Button onClick={confirmPublish}>Publish version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
