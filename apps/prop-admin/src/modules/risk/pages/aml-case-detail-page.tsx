"use client";
/**
 * R2-07 — AML case detail (round-3 depth uplift, Table 13):
 *  • transaction hop visualization rendered from the frozen case movements
 *  • document panel wired to the KYC artifacts (metadata + integrity)
 *  • four-eyes freeze flow — freeze behind compliance.aml.manage, release
 *    behind compliance.aml.approve, actor + rationale audit-logged
 *  • screening rescan action re-stamping rows with list-version provenance
 * Plus R3-F02 hold state (blocked payouts) and R3-01 filing linkage.
 */
import { Fragment, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldAlert, FileWarning, ArrowRight, Paperclip, ScanSearch, Lock, ChevronDown, ChevronRight, Snowflake } from "lucide-react";
import { getAmlCase, listAmlAlerts, dispositionAml, setPayoutHold, useAmlVersion, type AmlCase } from "../aml-store";
import { rescanCase } from "../screening-store";
import { payoutsHeldByCase } from "@/modules/payouts/payout-store";

/* ------------------------------------------------------------------ */
/* Transaction hop visualization                                       */
/* ------------------------------------------------------------------ */

function hopTone(type: string): string {
  if (type === "payout-request") return "border-rose-500/40 bg-rose-500/10";
  if (type === "deposit") return "border-teal-500/40 bg-teal-500/10";
  if (type === "profit") return "border-emerald-500/40 bg-emerald-500/10";
  return "border-border bg-muted/40";
}

function TransactionHops({ c }: { c: AmlCase }) {
  let running = 0;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {c.movements.map((m, i) => {
        running += m.amount;
        return (
          <Fragment key={i}>
            {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />}
            <div className={cn("min-w-[132px] shrink-0 rounded-md border p-2 text-xs", hopTone(m.type))}>
              <p className="font-medium capitalize">{m.type.replace("-", " ")}</p>
              <p className="font-mono text-sm font-semibold">
                {c.currency} {m.amount.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {m.method}
                {m.note ? ` · ${m.note}` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Σ {c.currency} {running.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{new Date(m.at).toLocaleString()}</p>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KYC document panel                                                  */
/* ------------------------------------------------------------------ */

const DOC_META: Record<string, { kind: string; issuer: string }> = {
  Passport: { kind: "Identity", issuer: "Government issuing authority" },
  "ID card": { kind: "Identity", issuer: "Government issuing authority" },
  "Proof of address": { kind: "Address", issuer: "Utility / bank statement" },
  Selfie: { kind: "Biometric", issuer: "Liveness capture (vendor)" },
};

function docFingerprint(doc: string): string {
  const h = [...doc].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return h.toString(16).padStart(8, "0");
}

function KycDocuments({ c }: { c: AmlCase }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <p className="mb-1 flex items-center gap-1 font-semibold uppercase text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" /> KYC documents ({c.kyc.docs.length})
      </p>
      {c.kyc.docs.map((doc) => {
        const meta = DOC_META[doc] ?? { kind: "Supporting", issuer: "Uploaded by subject" };
        const isOpen = open === doc;
        return (
          <div key={doc} className="rounded border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs"
              onClick={() => setOpen(isOpen ? null : doc)}
            >
              <span className="flex items-center gap-1.5 font-medium">
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {doc}
              </span>
              <StatusBadge tone={c.kyc.status === "verified" ? "success" : "warning"}>
                {c.kyc.status}
              </StatusBadge>
            </button>
            {isOpen && (
              <div className="border-t px-2 py-1.5 text-[10px] text-muted-foreground">
                <p>
                  <strong className="text-foreground">{meta.kind}</strong> · {meta.issuer}
                </p>
                <p>SHA-256 (dummy): {docFingerprint(doc)}…{docFingerprint(doc + c.id)}</p>
                <p>
                  Address on file: {c.kyc.address} · captured with case {c.id}
                </p>
                <p className="mt-1">
                  Viewed in read-only evidence mode — artifacts are frozen with the case timeline.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Case detail                                                         */
/* ------------------------------------------------------------------ */

export function AmlCaseDetailPage() {
  const { router, navigate, user } = usePlatform();
  // Four-eyes split (R2-07): manage = investigate/freeze, approve = release.
  const canManage = hasPermission(user, "compliance.aml.manage");
  const canApprove = hasPermission(user, "compliance.aml.approve");
  const canScreen = hasPermission(user, "compliance.screening.manage");
  useAmlVersion(); // hold/disposition changes from any surface re-render us

  const id = router.params.id || listAmlAlerts()[0]?.id;
  const c = id ? getAmlCase(id) : undefined;
  const [, tick] = useState(0);
  const [rationale, setRationale] = useState("");
  const [holdRationale, setHoldRationale] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  if (!c) {
    return (
      <Page>
        <PageContent>
          <p className="text-sm text-muted-foreground">
            No case.{" "}
            <button className="underline" onClick={() => navigate("aml-alerts")}>
              Back
            </button>
          </p>
        </PageContent>
      </Page>
    );
  }

  const held = payoutsHeldByCase(c.id);
  const live = c.status === "open" || c.status === "investigating" || c.status === "escalated";

  function act(dec: string) {
    setPending(dec);
  }

  function confirm() {
    if (!pending) return;
    dispositionAml(
      c!.id,
      pending as "release" | "hold" | "block" | "escalate" | "sar_str",
      rationale || `Operator ${pending}`,
      user?.name ?? "operator",
    );
    toast({
      title: "Disposition recorded",
      description: `${pending} by ${user?.name ?? "operator"} — audit logged; payout hold state updated via the R3-F02 hook.`,
    });
    setPending(null);
    setRationale("");
    tick((n) => n + 1);
  }

  const doHold = (hold: boolean) => {
    if (setPayoutHold(c!.id, hold, holdRationale.trim(), user?.name ?? "operator")) {
      toast({
        title: hold ? "Payout freeze applied" : "Payout freeze released",
        description: `${c!.traderName} — by ${user?.name ?? "operator"} (four-eyes, audit logged).`,
      });
      setHoldRationale("");
      tick((n) => n + 1);
    }
  };

  const doRescan = () => {
    const r = rescanCase(c!.id, user?.name ?? "operator");
    if (!r.ok) {
      toast({ title: "Screening already current", description: `Rows match list versions ${r.versions.join(", ") || "(no sources)"}.` });
      return;
    }
    toast({ title: "Case rescanned", description: `${r.updated} row(s) re-stamped against ${r.versions.join(", ")}.` });
    tick((n) => n + 1);
  };

  const dispositionButtons: Array<[string, string, string | undefined]> = [
    ["release", "Release payout", canApprove ? undefined : "Requires compliance.aml.approve"],
    ["hold", "Hold", canManage ? undefined : "Requires compliance.aml.manage"],
    ["block", "Block", canManage ? undefined : "Requires compliance.aml.manage"],
    ["escalate", "Escalate", canManage ? undefined : "Requires compliance.aml.manage"],
    ["sar_str", "SAR/STR path", canManage ? undefined : "Requires compliance.aml.manage"],
  ];

  return (
    <Page>
      <PageHeader
        title={`AML Case ${c.id}`}
        description={`${c.traderName} · ${c.typology} · ${c.currency} ${c.amount.toLocaleString()}`}
        icon={ShieldAlert}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("aml-alerts")}>
              Back to queue
            </Button>
            {c.filingId ? (
              <Button variant="outline" size="sm" onClick={() => navigate("str-filings")}>
                <Lock className="mr-1 h-4 w-4" /> Narrative locked · {c.filingId}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("str-filings", { caseId: c.id })}>
                <FileWarning className="mr-1 h-4 w-4" /> Draft STR/SAR filing
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage}
              title={canManage ? undefined : "Requires compliance.aml.manage"}
              onClick={() => {
                dispositionAml(c.id, "escalate", `Escalated by ${user?.name ?? "operator"}`, user?.name ?? "operator");
                toast({ title: "Escalated", description: `${c.id} moved to escalated — audit logged.` });
                tick((n) => n + 1);
              }}
            >
              Escalate
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="space-y-3">
          {/* Status strip */}
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusBadge tone={c.risk === "critical" ? "danger" : c.risk === "high" ? "warning" : "info"}>{c.risk} risk</StatusBadge>
            <StatusBadge tone={c.status === "cleared" ? "success" : c.status === "blocked" ? "danger" : "warning"}>
              {c.status.replace("_", " ")}
            </StatusBadge>
            {c.payoutHold && <StatusBadge tone="danger">payout held (hook → payouts module)</StatusBadge>}
            {c.kyc.pep && <StatusBadge tone="warning">PEP</StatusBadge>}
            {c.kyc.sanctionsHit && <StatusBadge tone="danger">{c.kyc.sanctionsHit}</StatusBadge>}
            {c.filingId && <StatusBadge tone="info">filing {c.filingId}</StatusBadge>}
          </div>

          {/* Four-eyes freeze flow + R3-F02 blocked payouts */}
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              c.payoutHold ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-border bg-muted/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Snowflake className="h-4 w-4 shrink-0" />
              <span className="font-medium">
                {c.payoutHold ? "Payout freeze active (four-eyes release required)." : "No payout freeze on this case."}
              </span>
              <span>
                {c.payoutHold
                  ? held.length > 0
                    ? `Blocked: ${held.map((p) => p.reference).join(", ")} (${held.length} pending).`
                    : "No pending payouts right now."
                  : live
                    ? "Freezing blocks approve/process/pay on this trader's payouts."
                    : ""}
              </span>
              {c.payoutHold && <span className="text-muted-foreground">Release requires compliance.aml.approve.</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={holdRationale}
                onChange={(e) => setHoldRationale(e.target.value)}
                placeholder="Rationale (required, audit-logged)"
                className="h-7 max-w-sm text-xs"
              />
              {c.payoutHold ? (
                <Button
                  size="sm"
                  disabled={!canApprove || !holdRationale.trim()}
                  title={canApprove ? undefined : "Requires compliance.aml.approve"}
                  onClick={() => doHold(false)}
                >
                  Release freeze
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!canManage || !live || !holdRationale.trim()}
                  title={!canManage ? "Requires compliance.aml.manage" : !live ? "Case is closed" : undefined}
                  onClick={() => doHold(true)}
                >
                  Freeze payouts
                </Button>
              )}
              <span className="text-[10px] text-muted-foreground">
                {c.payoutHold ? "Approver" : "Investigator"}: {user?.name ?? "operator"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Transaction hop visualization (R2-07 uplift) */}
            <Card>
              <CardContent className="space-y-2 p-3 text-sm">
                <p className="font-semibold uppercase text-muted-foreground">Transaction hops (frozen movements)</p>
                <TransactionHops c={c} />
              </CardContent>
            </Card>

            {/* KYC + document panel (R2-07 uplift) */}
            <Card>
              <CardContent className="space-y-2 p-3 text-sm">
                <p className="font-semibold uppercase text-muted-foreground">KYC &amp; documents</p>
                <p className="text-xs">
                  KYC: <strong>{c.kyc.status}</strong> · {c.kyc.address}
                  {c.kyc.pep && <span className="ml-1 text-amber-700 dark:text-amber-400">· PEP</span>}
                </p>
                <KycDocuments c={c} />
              </CardContent>
            </Card>

            {/* Screening with list-version provenance + rescan action */}
            <Card>
              <CardContent className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold uppercase text-muted-foreground">Screening (list-version provenance)</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!canScreen}
                    title={canScreen ? "Re-stamp rows against current list versions" : "Requires compliance.screening.manage"}
                    onClick={doRescan}
                  >
                    <ScanSearch className="mr-1 h-3.5 w-3.5" /> Rescan case
                  </Button>
                </div>
                {c.screening.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs">
                    <span>
                      {s.provider}: <strong className={s.result === "hit" ? "text-destructive" : s.result === "potential" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>{s.result}</strong>{" "}
                      — {s.detail}
                    </span>
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="font-mono text-[10px]">{s.listVersion ?? "unversioned"}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleDateString()}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Explainability */}
            <Card>
              <CardContent className="space-y-1 p-3 text-sm">
                <p className="font-semibold uppercase text-muted-foreground">Explainability (model/rule drivers)</p>
                <p>
                  Score: <strong>{c.explainability.score}</strong>/100
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  {c.explainability.drivers.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Four-eyes disposition */}
            <Card className="lg:col-span-2">
              <CardContent className="space-y-2 p-3 text-sm">
                <p className="font-semibold uppercase text-muted-foreground">
                  Disposition (freeze: compliance.aml.manage · release: compliance.aml.approve)
                </p>
                <Textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={2}
                  placeholder="Rationale (required for audit)"
                  className="text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  {dispositionButtons.map(([d, label, denyTitle]) => {
                    const allowed = d === "release" ? canApprove : canManage;
                    return (
                      <Button
                        key={d}
                        size="sm"
                        variant={d === "release" ? "default" : "outline"}
                        className="h-7 text-xs"
                        title={denyTitle}
                        onClick={() => act(d)}
                        disabled={(!rationale.trim() && d !== "escalate") || !allowed}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                {c.disposition && (
                  <p className="text-xs text-muted-foreground">
                    Last: <strong>{c.disposition.decision}</strong> by {c.disposition.by} — {c.disposition.rationale}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <CardContent className="p-3 text-sm">
              <p className="mb-1 font-semibold uppercase text-muted-foreground">Timeline (audit)</p>
              <div className="space-y-1 text-xs">
                {c.timeline.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-40 shrink-0 text-muted-foreground">{new Date(t.at).toLocaleString()}</span>
                    <span>
                      <strong>{t.actor}</strong>: {t.action}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {pending}</AlertDialogTitle>
            <AlertDialogDescription>
              This disposition is audit-logged with you ({user?.name ?? "operator"}) as actor and updates payout
              hold state via the R3-F02 hook. Ensure the rationale is accurate — four-eyes: releases need
              compliance.aml.approve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
