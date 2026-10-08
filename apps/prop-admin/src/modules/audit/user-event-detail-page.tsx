"use client";

/**
 * Audit — User Event Detail Page
 *
 * Single-event detail view reached from the User Events stream. Shows a
 * labeled detail card with the event's core fields and a "Related Events"
 * section listing 5 most recent events from the same user.
 *
 * Breadcrumb: User Events > [Event ID]. Close button routes back.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getUserEvents, getTenantUserEvents, type UserEvent } from "@/lib/platform/mock-data";
import { Page, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ScrollText,
  ArrowLeft,
  X,
  Activity,
  User,
  Calendar,
  Hash,
  AlertTriangle,
  ShieldCheck,
  Download,
} from "lucide-react";

type EventTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

/** Map an eventType to a status tone for the badge. */
function eventTone(eventType: UserEvent["eventType"]): EventTone {
  switch (eventType) {
    case "ACCOUNT_CREATED":
    case "KYC_COMPLETED":
    case "CHALLENGE_PASSED":
    case "PAYOUT_COMPLETED":
      return "success";
    case "KYC_REJECTED":
    case "BREACH_DETECTED":
    case "CHALLENGE_FAILED":
      return "danger";
    case "ORDER_CREATED":
    case "PAYOUT_REQUESTED":
    case "CHALLENGE_STARTED":
    case "LOGIN":
      return "info";
    case "PASSWORD_CHANGED":
      return "warning";
    default:
      return "muted";
  }
}

const EVENT_LABELS: Record<UserEvent["eventType"], string> = {
  ACCOUNT_CREATED: "Account Created",
  KYC_COMPLETED: "KYC Completed",
  KYC_REJECTED: "KYC Rejected",
  ORDER_CREATED: "Order Created",
  PAYOUT_REQUESTED: "Payout Requested",
  PAYOUT_COMPLETED: "Payout Completed",
  CHALLENGE_STARTED: "Challenge Started",
  CHALLENGE_PASSED: "Challenge Passed",
  CHALLENGE_FAILED: "Challenge Failed",
  BREACH_DETECTED: "Breach Detected",
  LOGIN: "Login",
  PASSWORD_CHANGED: "Password Changed",
};

interface DetailField {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export function UserEventDetailPage() {
  const { router, navigate, runtime } = usePlatform();
  const eventId = router.params.id;
  const tid = runtime.tenant?.id ?? "platform";

  const allEvents = useMemo(
    () => (tid === "platform" ? getUserEvents(200) : getTenantUserEvents(tid, 200)),
    [tid],
  );
  const event = useMemo(
    () => allEvents.find((e) => e.id === eventId) ?? null,
    [allEvents, eventId],
  );

  // 5 most recent related events for the same user (excluding this one).
  const related = useMemo<UserEvent[]>(() => {
    if (!event) return [];
    return allEvents
      .filter((e) => e.userEmail === event.userEmail && e.id !== event.id)
      .slice(0, 5);
  }, [allEvents, event]);

  const close = () => {
    navigate("audit-user-events");
  };

  const exportEvent = () => {
    if (!event) return;
    const blob = new Blob([JSON.stringify(event, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user-event-${event.id}.json`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({
      title: "Event exported",
      description: `Event ${event.id} exported as JSON.`,
    });
  };

  if (!event) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Event not found</p>
            <p className="text-sm text-muted-foreground">
              The event you're looking for no longer exists or has been archived.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to User Events
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  const tone = eventTone(event.eventType);
  const fields: DetailField[] = [
    {
      icon: Hash,
      label: "Event ID",
      value: <span className="font-mono text-xs">{event.id}</span>,
    },
    {
      icon: User,
      label: "User Email",
      value: <span className="font-medium text-foreground">{event.userEmail}</span>,
    },
    {
      icon: Hash,
      label: "Account ID",
      value: <span className="font-mono text-xs">{event.accountId}</span>,
    },
    {
      icon: Activity,
      label: "Event Type",
      value: (
        <StatusBadge tone={tone}>
          {EVENT_LABELS[event.eventType]}
        </StatusBadge>
      ),
    },
    {
      icon: Calendar,
      label: "Timestamp",
      value: (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(event.timestamp).toLocaleString()}
        </span>
      ),
    },
  ];

  const relatedColumns: Column<UserEvent>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (e) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(e.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (e) => e.timestamp,
      width: "180px",
    },
    {
      key: "eventType",
      header: "Event Type",
      cell: (e) => (
        <StatusBadge tone={eventTone(e.eventType)}>
          {EVENT_LABELS[e.eventType]}
        </StatusBadge>
      ),
      sortValue: (e) => e.eventType,
    },
    {
      key: "accountId",
      header: "Account",
      cell: (e) => <span className="font-mono text-xs">{e.accountId}</span>,
      sortValue: (e) => e.accountId,
    },
    {
      key: "description",
      header: "Description",
      cell: (e) => <span className="text-sm text-muted-foreground">{e.description}</span>,
    },
  ];

  return (
    <Page>
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="cursor-pointer"
              onClick={() => navigate("audit-user-events")}
            >
              User Events
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{event.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        {/* Detail card */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <ScrollText className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {EVENT_LABELS[event.eventType]}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {event.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge tone={tone}>
                    {event.eventType}
                  </StatusBadge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {event.id}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportEvent}>
                <Download className="mr-1 h-4 w-4" /> Export
              </Button>
              <Button size="sm" variant="ghost" onClick={close} aria-label="Close detail">
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Labeled fields grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-2 rounded-md border bg-muted/20 p-3"
              >
                <div className="rounded-md bg-background p-1.5">
                  <f.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </p>
                  <div className="mt-1">{f.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related events */}
        <div className="rounded-lg border bg-card p-2">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>
              Related events for <span className="font-medium text-foreground">{event.userEmail}</span>
              {" "} — {related.length} of {allEvents.filter((e) => e.userEmail === event.userEmail).length - 1}
            </span>
          </div>
          {related.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
              <ShieldCheck className="h-6 w-6" />
              <p className="text-sm">No other events for this user.</p>
            </div>
          ) : (
            <DataTable
              columns={relatedColumns}
              data={related}
              rowKey={(e) => e.id}
              onRowClick={(e) => navigate("audit-user-event-detail", { id: e.id })}
              pageSize={5}
            />
          )}
        </div>

        <p className={cn("text-xs text-muted-foreground")}>
          Clicking a related event row navigates to that event's detail view.
        </p>
      </PageContent>
    </Page>
  );
}
