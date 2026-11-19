"use client";

/**
 * Deployments — research item #23.
 *
 * Shows current version, environment, deployment timestamp, git commit,
 * image digest, services, deployment status, previous deployments, and
 * rollback availability.
 *
 * P0-4: rollback is a real two-operator action — the staged payload lands
 * in the deployments store, current version changes, and the audit row,
 * state and toast agree across reload.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { GitBranch, CheckCircle2, Clock, ArrowDownCircle, Container, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useDeploymentsState, readDeployments, type Deployment } from "@/lib/platform/deployments-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function DeploymentsPage() {
  const { user } = usePlatform();
  const { data: loadedData, loading, error, retry } = useAsyncMock(
    () => mockAsync(() => readDeployments(), { delayMs: 450 }),
    [],
  );
  const deployments = loadedData ?? [];
  const current = deployments.find((d) => d.isCurrent);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);

  const handleRollback = (d: Deployment) => {
    setRollbackTarget(d);
    setRollbackOpen(true);
  };

  const approvalPayload = rollbackTarget
    ? {
        targetVersion: rollbackTarget.version,
        reason: "Manual rollback initiated from the Deployments console",
      }
    : undefined;

  return (
    <Page>
      <PageHeader
        title="Deployments"
        description="Platform version visibility — current deployment, history, and rollback availability."
        icon={GitBranch}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading deployments…"
        >
        {current && (
          <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Current deployment: {current.version}</p>
                <p className="text-xs text-muted-foreground">Deployed {current.timestamp} · {current.services} services</p>
              </div>
              <Badge variant="outline" className="ml-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                In production
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Git commit</p><p className="flex items-center gap-1 font-mono"><GitCommit className="h-3 w-3" />{current.commit}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Image digest</p><p className="flex items-center gap-1 font-mono"><Container className="h-3 w-3" />{current.digest}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Services</p><p className="font-medium tabular-nums">{current.services}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Environment</p><p className="font-medium">Production</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Deployment history</span></CardHeader>
          <CardContent className="space-y-2">
            {deployments.map((d) => (
              <div key={d.version} className={cn(
                "flex items-center gap-3 rounded-md border p-3",
                d.isCurrent && "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10",
              )}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{d.version}</span>
                    {d.isCurrent && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">CURRENT</Badge>}
                    {d.status === "rollback" && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400">ROLLBACK</Badge>}
                    {d.status === "failed" && <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-700 dark:text-rose-400">FAILED</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.timestamp} · commit <span className="font-mono">{d.commit}</span> · {d.services} services
                  </p>
                </div>
                {!d.isCurrent && d.status !== "failed" && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handleRollback(d)}>
                    <ArrowDownCircle className="mr-1 h-3 w-3" /> Rollback
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Service-level breakdown (current)</span></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              { name: "Account Sync (MT5)", version: "v1.8.0", health: "healthy" as const },
              { name: "Payout Reconciliation", version: "v1.8.0", health: "healthy" as const },
              { name: "Notification Batch", version: "v1.8.0", health: "healthy" as const },
              { name: "Document Generation", version: "v1.8.0", health: "healthy" as const },
              { name: "Provider Health Check", version: "v1.8.0", health: "running" as const },
              { name: "Audit Archive", version: "v1.8.0", health: "paused" as const },
              { name: "Risk Engine", version: "v1.8.0", health: "healthy" as const },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-md border p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{svc.name}</span>
                <Badge variant="outline" className="text-[9px]">{svc.version}</Badge>
                <span className="ml-auto text-[10px] font-medium text-muted-foreground uppercase">{svc.health}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Deployment controls</p>
          <p className="mt-1">Deploy, rollback, and restart service actions require elevated permissions and two-operator approval for production deployments. Contact your platform operations lead.</p>
        </div>
        </PageAsyncBoundary>
      </PageContent>

      <SensitiveActionDialog
        open={rollbackOpen}
        onOpenChange={(o) => {
          if (!o) {
            setRollbackOpen(false);
            setRollbackTarget(null);
          }
        }}
        actionKey="platform.rollback"
        title={`Rollback to ${rollbackTarget?.version ?? "previous version"}`}
        consequence="Production traffic will be redirected to the previous version. Active connections may be interrupted."
        blastRadius={["All production services", "Active user sessions", "In-flight transactions"]}
        confirmPhrase="Rollback"
        requireReason
        twoOperator
        approvalPayload={approvalPayload}
        onExecute={async () => {
          // No-op: the bridge applies the approved payload.
          setRollbackOpen(false);
          setRollbackTarget(null);
        }}
      />
    </Page>
  );
}