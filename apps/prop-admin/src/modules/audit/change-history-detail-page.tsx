"use client";

/**
 * Change History Detail — full context for a single configuration change
 * (spec section 40 — Change History stream).
 *
 * Extracted from the Change History list's inline detail Sheet into the
 * detail-overlay pattern: a row click opens this screen as a sheet
 * (?panel=audit-change-detail&id=ch-…) and the same component renders
 * full-page from ?view=audit-change-detail&id=ch-… (new tab).
 *
 * Shows the before/after diff, actor, reason and entity reference, plus
 * the rollback confirmation (queued, audit-logged).
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getChangeHistoryEntry } from "@/modules/audit/change-history-page";
import { Page, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowRight, ChevronRight, History, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ChangeHistoryDetailPage() {
  const { router, navigate, runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const entry = getChangeHistoryEntry(router.params.id ?? "", tid);
  const close = () => navigate("audit-change-history");

  if (!entry) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Change not found</p>
            <p className="text-sm text-muted-foreground">
              This change record doesn&apos;t exist or belongs to another tenant.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back to Change History
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      {/* Breadcrumb — Change History > [change id] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Change History
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{entry.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <History className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Change Detail
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Full context for this configuration change.
                </p>
                <div className="mt-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{entry.id}</Badge>
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={close} aria-label="Close detail">
              Close
            </Button>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Timestamp</p>
                <p className="font-mono text-xs">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actor</p>
                <p className="font-medium">{entry.actor}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="text-xs">{entry.reason}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entity</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
                <span className="font-mono text-xs">{entry.entityId}</span>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Field</p>
              <p className="font-medium">{entry.field}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Diff</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 rounded-md bg-rose-50 dark:bg-rose-950/30 p-2">
                  <p className="text-[9px] uppercase tracking-wide text-rose-700 dark:text-rose-400">Old</p>
                  <p className="text-sm text-rose-600 line-through dark:text-rose-400">{entry.oldValue}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2">
                  <p className="text-[9px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">New</p>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{entry.newValue}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    Roll back to old value
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Roll back this change?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This change will be rolled back to the previous
                      state. Any dependent configurations may be
                      affected. This action is logged in the audit trail.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        toast({
                          title: "Rollback queued",
                          description: `Reverting ${entry.field} to ${entry.oldValue}.`,
                        });
                        close();
                      }}
                    >
                      Roll back
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
