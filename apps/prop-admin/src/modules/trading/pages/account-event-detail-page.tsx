"use client";

/**
 * Account Event Detail Page — single immutable audit-trail event view.
 *
 * Reached from the Account Events list (row click → overlay sheet, or the
 * explicit new-tab affordance) and works full-page too: the event is
 * resolved from `router.params.id` (the event id). Events are
 * deterministically generated per account (see generateEvents in the
 * parent list module), so the detail page finds the owning account by
 * scanning the tenant's accounts — no extra id plumbing required, and the
 * host's "New tab" button (which only forwards `id`) deep-links correctly.
 *
 * Immutable by design: no edit affordances here. The only actions are
 * navigation (back to the events list, open the owning account) — the
 * audit trail is append-only per the parent page's contract.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import { getTenantAccounts } from "@/lib/platform/mock-data";
import { Page, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
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
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  History,
  User,
  Clock,
  Copy,
  Lock,
} from "lucide-react";
import {
  EVENT_META,
  generateEvents,
  type AccountEvent,
} from "@/modules/trading/pages/account-events-page";

export function AccountEventDetailPage() {
  const { runtime, router, navigate, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const eventId = router.params.id ?? "";

  // Deterministic generation makes events resolvable by id alone: scan
  // the tenant's accounts until the owning account yields this event.
  const match = useMemo(() => {
    if (!eventId) return null;
    for (const account of getTenantAccounts(tid)) {
      const events = generateEvents(account.id, account.login, runtime.tenant?.currency ?? "USD");
      const event = events.find((e) => e.id === eventId);
      if (event) return { account, event };
    }
    return null;
  }, [tid, eventId, runtime.tenant?.currency]);

  const onCopyId = () => {
    if (!match) return;
    void navigator.clipboard?.writeText(match.event.id);
    toast({ title: "Event ID copied", description: match.event.id });
  };

  if (!match) {
    return (
      <Page>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("account-events")}
          className="w-fit"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Events
        </Button>
        <p className="text-muted-foreground">Event not found.</p>
      </Page>
    );
  }

  const { account, event } = match;
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;

  return (
    <Page>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate("account-events")}
              className="cursor-pointer"
            >
              Account Events
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{event.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <Badge variant="outline" className="font-mono text-[10px]">
            {event.id}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onCopyId} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy ID
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("account-events", { id: account.id, accountId: account.id })}
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Events
          </Button>
        </div>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              {resolveTermsInString(event.description, tenant)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" /> Occurred
            </p>
            <p className="mt-1 text-xs tabular-nums text-foreground">
              {new Date(event.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <User className="h-3 w-3" /> Actor
            </p>
            <p className="mt-1 text-xs text-foreground">{event.actor}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <History className="h-3 w-3" /> Account
            </p>
            <button
              type="button"
              onClick={() => navigate("account-workspace", { id: account.id })}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Login {account.login}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            This audit trail is immutable. Edits are recorded as new events
            with the previous state preserved.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}
