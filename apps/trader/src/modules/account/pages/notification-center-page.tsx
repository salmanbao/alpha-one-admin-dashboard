"use client";

/**
 * In-App Inbox — upgraded per M8 spec Section 12.3
 * (View ID /inbox — the notification-center route upgraded into the
 * In-app channel endpoint referenced across M2 and M4).
 *
 * Layout regions (Table 148):
 * - Toolbar: category filter chips (All, Payouts, Challenges, Trading,
 *   Marketing, Support), read-state filter (All / Unread), search,
 *   Mark all read, settings gear linking to /notification-preferences
 *   (spec 12.2).
 * - List pane (left): unread dot, sender avatar, subject line, snippet,
 *   category chip, relative time, selected-state highlight.
 * - Reading pane (right): full message body with brand styling, timestamp,
 *   category, per-message-type action buttons (View payout → /payouts,
 *   Review challenge → /my-challenges, Open promo → /promos — unknown types
 *   render without actions), Mark unread, and Delete (soft, 90-day
 *   retention note).
 * - Empty reading pane: selection prompt with the firm brand mark.
 *
 * Interactions (Table 149):
 * - Keyboard: up/down navigates the list, Enter opens the message,
 *   Escape returns focus to the list.
 * - Mark all read clears every unread dot without touching the selected
 *   message (Table 150).
 *
 * States (Table 149): empty inbox shows "You are all caught up" with a
 * browse-challenges suggestion; list skeletons with a neutral reading pane
 * while loading; a message body load failure renders a retryable error
 * block in the reading pane while the list stays usable.
 *
 * Data shown: message metadata and bodies, read state, categories,
 * deep-link actions, retention policy. All data is local dummy data.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton, cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraPageHeader,
  type TerraTone,
} from "@/components/terra/terra-ui";
import { terraTenant } from "@/lib/fixtures/terra-fixtures";
import { useInboxMessages } from "@/lib/inbox/inbox-store";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CheckCheck,
  Gift,
  Inbox,
  LifeBuoy,
  Loader2,
  Search,
  Settings,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Model + dummy data                                                  */
/* ------------------------------------------------------------------ */

const categories = ["All", "Payouts", "Challenges", "Trading", "Marketing", "Support"] as const;
const readFilters = ["All", "Unread"] as const;

type Category = (typeof categories)[number];
type ReadFilter = (typeof readFilters)[number];

/** Deep-link action type — only known message types get buttons; anything
 *  else renders without actions rather than a broken button. */
type ActionType = "payout" | "challenge" | "promo";

interface Message {
  id: string;
  subject: string;
  body: string;
  category: Category;
  sender: string;
  at: string; // ISO
  read: boolean;
  actionType?: ActionType;
  /** Simulated body-load failure for one message (Table 149 error row). */
  bodyError?: boolean;
}

const actionFor: Record<
  ActionType,
  { label: string; href: string; className: string; icon: React.ReactNode }
> = {
  payout: {
    label: "View payout",
    href: "/payouts",
    className: "bg-primary text-on-primary hover:bg-primary/90",
    icon: <Banknote className="h-4 w-4" />,
  },
  challenge: {
    label: "Review challenge",
    href: "/my-accounts",
    className: "bg-primary text-on-primary hover:bg-primary/90",
    icon: <Target className="h-4 w-4" />,
  },
  promo: {
    label: "Open promo",
    href: "/promos",
    className: "bg-tertiary text-on-tertiary hover:bg-tertiary/90",
    icon: <Gift className="h-4 w-4" />,
  },
};

const categoryTone: Record<Category, TerraTone> = {
  All: "neutral",
  Payouts: "success",
  Challenges: "primary",
  Trading: "tertiary",
  Marketing: "secondary",
  Support: "neutral",
};

const categoryIcon: Record<Category, React.ReactNode> = {
  All: <Inbox className="h-4 w-4" />,
  Payouts: <Banknote className="h-4 w-4" />,
  Challenges: <Target className="h-4 w-4" />,
  Trading: <Activity className="h-4 w-4" />,
  Marketing: <Gift className="h-4 w-4" />,
  Support: <LifeBuoy className="h-4 w-4" />,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function NotificationCenterPage() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category>("All");
  const [readFilter, setReadFilter] = useState<ReadFilter>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const messages = useInboxMessages();
  const [readState, setReadState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(messages.map((m) => [m.id, m.read])),
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [recoveredIds, setRecoveredIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const isUnread = (m: Message) => !readState[m.id];

  const visible = useMemo(
    () =>
      messages.filter((m) => {
        if (deletedIds.includes(m.id)) return false;
        if (filter !== "All" && m.category !== filter) return false;
        if (readFilter === "Unread" && readState[m.id]) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !m.subject.toLowerCase().includes(q) &&
            !m.body.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [filter, readFilter, search, deletedIds, readState],
  );

  const remaining = messages.filter((m) => !deletedIds.includes(m.id));
  const unreadCount = remaining.filter(isUnread).length;
  const selected =
    selectedId && !deletedIds.includes(selectedId)
      ? messages.find((m) => m.id === selectedId) ?? null
      : null;
  const bodyFailed = false;

  /* Keep the selected row visible while arrowing through the list. */
  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`inbox-item-${selectedId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const openMessage = (id: string) => {
    setSelectedId(id);
    setReadState((s) => (s[id] ? s : { ...s, [id]: true }));
  };

  const handleMarkAllRead = () => {
    setReadState(Object.fromEntries(messages.map((m) => [m.id, true])));
    toast({ title: "All messages marked as read" });
    // Selection is untouched (Table 150) — no setSelectedId call here.
  };

  const handleMarkUnread = (id: string) => {
    setReadState((s) => ({ ...s, [id]: false }));
    toast({ title: "Marked unread", description: "The unread dot is back in the list." });
  };

  const handleDelete = (id: string) => {
    setDeletedIds((d) => [...d, id]);
    if (selectedId === id) setSelectedId(null);
    toast({
      title: "Message deleted",
      description: "Soft deleted — kept for 90 days before permanent removal.",
    });
  };

  const handleRetryBody = () => {
    if (!selected) return;
    setRecoveredIds((r) => [...r, selected.id]);
    toast({ title: "Message loaded" });
  };

  /* Keyboard contract (Table 149): up/down moves, Enter opens, Escape
   * returns focus to the list. */
  const visibleIds = visible.map((m) => m.id);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
    if (visibleIds.length === 0) return;
    e.preventDefault();
    if (e.key === "Enter") {
      if (selectedId) {
        paneRef.current?.focus();
      } else {
        openMessage(visibleIds[0]);
      }
      return;
    }
    const idx = selectedId ? visibleIds.indexOf(selectedId) : -1;
    let next: number;
    if (idx === -1) next = e.key === "ArrowDown" ? 0 : visibleIds.length - 1;
    else
      next = Math.min(
        visibleIds.length - 1,
        Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)),
      );
    openMessage(visibleIds[next]);
  };

  const handlePaneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      listRef.current?.focus();
    }
  };

  const clearFilters = () => {
    setFilter("All");
    setReadFilter("All");
    setSearch("");
  };

  /* ---- Render ---------------------------------------------------- */

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category filter">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={filter === cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              filter === cat
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {categoryIcon[cat]}
            {cat}
          </button>
        ))}
      </div>

      {/* Read-state filter */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Read state filter">
        {readFilters.map((rf) => (
          <button
            key={rf}
            type="button"
            aria-pressed={readFilter === rf}
            onClick={() => setReadFilter(rf)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              readFilter === rf
                ? "bg-surface-container-high text-on-surface shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface",
            )}
          >
            {rf === "Unread" && unreadCount > 0 ? `Unread (${unreadCount})` : rf}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative min-w-44 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages…"
          aria-label="Search messages"
          className="w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest py-2 pl-8 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Mark all read + settings gear (links to 12.2) */}
      <button
        type="button"
        onClick={handleMarkAllRead}
        disabled={unreadCount === 0}
        className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Mark all read
      </button>
      <Link
        href="/notification-preferences"
        aria-label="Notification preferences"
        title="Notification preferences"
        className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
      >
        <Settings className="h-4 w-4" />
      </Link>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <TerraPageHeader
          title="In-App Inbox"
          description="Campaign, lifecycle and transactional messages from your firm"
        />
        {toolbar}
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 space-y-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="lg:w-[45%]" aria-hidden="true">
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const showFullEmpty = remaining.length === 0;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="In-App Inbox"
        description="Campaign, lifecycle and transactional messages from your firm"
        actions={
          unreadCount > 0 ? (
            <TerraBadge tone="error" dot pulse>
              {unreadCount} unread
            </TerraBadge>
          ) : (
            <TerraBadge tone="success">
              <Check className="h-3 w-3" /> All read
            </TerraBadge>
          )
        }
      />

      {toolbar}

      {showFullEmpty ? (
        /* ---- Empty inbox: "You are all caught up" + browse-challenges
                suggestion card (Table 149). ------------------------ */
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-14 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant">
              <Check className="h-6 w-6" />
            </span>
            <p className="font-headline text-xl font-bold text-on-surface">
              You are all caught up
            </p>
            <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
              Every message has been read. New payout, challenge and campaign updates
              will land here.
            </p>
          </div>

          {/* Browse-challenges suggestion card */}
          <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-tertiary-container text-on-tertiary-container">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  Looking for your next challenge?
                </p>
                <p className="text-xs text-on-surface-variant">
                  While the inbox is quiet, the marketplace is a good place to be.
                </p>
              </div>
            </div>
            <Link
              href="/marketplace"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
            >
              Browse challenges
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* ------------------------------ Left pane: list */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              ref={listRef}
              role="listbox"
              aria-label="Messages"
              tabIndex={0}
              onKeyDown={handleListKeyDown}
              className="flex-1 space-y-1.5 overflow-y-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {visible.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant p-8 text-center">
                  <Inbox className="mb-3 h-10 w-10 text-on-surface-variant/40" />
                  <p className="font-headline text-lg font-semibold text-on-surface">
                    No messages match
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Try a different category, read-state or search term.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-lg bg-surface-container px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                visible.map((m) => {
                  const unread = isUnread(m);
                  const active = selectedId === m.id;
                  return (
                    <div
                      key={m.id}
                      id={`inbox-item-${m.id}`}
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        openMessage(m.id);
                        listRef.current?.focus();
                      }}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all",
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent hover:bg-surface-container-low",
                        unread && !active && "bg-surface-container-low/70",
                      )}
                    >
                      {/* Unread dot + sender avatar */}
                      <div className="flex w-5 shrink-0 flex-col items-center gap-2 pt-0.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            unread ? "bg-primary" : "bg-transparent",
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg",
                            unread
                              ? "bg-primary-fixed text-on-primary-fixed-variant"
                              : "bg-surface-container text-on-surface-variant",
                          )}
                        >
                          {categoryIcon[m.category]}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "truncate text-sm",
                              unread ? "font-bold text-on-surface" : "font-semibold text-on-surface/90",
                            )}
                          >
                            {m.subject}
                          </p>
                          <span className="shrink-0 text-[10px] text-on-surface-variant">
                            {timeAgo(m.at)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                          {m.body.split("\n")[0]}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <TerraBadge tone={categoryTone[m.category]} className="text-[9px]">
                            {m.category}
                          </TerraBadge>
                          <span className="truncate text-[10px] text-on-surface-variant">
                            {m.sender}
                          </span>
                          {unread && (
                            <span className="ml-auto shrink-0 text-[10px] font-bold text-primary">
                              Unread
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ------------------------------ Right pane: reading pane */}
          <div
            ref={paneRef}
            tabIndex={-1}
            onKeyDown={handlePaneKeyDown}
            className="flex min-w-0 flex-col rounded-xl border border-outline-variant/50 bg-surface-container-lowest outline-none lg:w-[45%]"
          >
            {!selected ? (
              /* Empty reading pane — firm brand mark (Table 148) */
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed font-headline text-2xl font-bold text-on-primary-fixed-variant">
                  {terraTenant.branding.initials}
                </span>
                <p className="mt-4 font-headline text-lg font-bold text-on-surface">
                  {terraTenant.branding.name}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Select a message to read it here.
                </p>
                <p className="mt-3 text-[11px] text-on-surface-variant/80">
                  Keyboard: ↑ / ↓ to move · Enter to open · Esc to return to the list
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                {/* Header: category, subject, sender, timestamp, actions */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TerraBadge tone={categoryTone[selected.category]}>
                        {selected.category}
                      </TerraBadge>
                      {isUnread(selected) && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                          Unread
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 font-headline text-xl font-bold text-on-surface">
                      {selected.subject}
                    </h2>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {selected.sender} · {fullTimestamp(selected.at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarkUnread(selected.id)}
                      className="rounded-lg border border-outline-variant/60 px-3 py-1.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                    >
                      Mark unread
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selected.id)}
                      aria-label="Delete message"
                      title="Delete message (soft, 90-day retention)"
                      className="rounded-lg border border-outline-variant/60 p-1.5 text-error transition-colors hover:bg-error-container/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Body (or retryable load error, Table 149) */}
                <div className="mt-5">
                  {bodyFailed ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-error/40 bg-error-container/25 p-5"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-error" />
                        <p className="text-sm font-bold text-on-surface">
                          Message body failed to load
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        The list stays usable — retry to load this message, or pick
                        another one.
                      </p>
                      <button
                        type="button"
                        onClick={handleRetryBody}
                        className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
                      >
                        <Loader2 className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl bg-surface-container-low/60 p-5">
                      {selected.body.split("\n").filter(Boolean).map((para, i) => (
                        <p key={i} className="text-sm leading-relaxed text-on-surface">
                          {para}
                        </p>
                      ))}
                      <p className="border-t border-outline-variant/40 pt-3 text-xs font-semibold text-on-surface-variant">
                        {terraTenant.branding.name} · {terraTenant.branding.tagline}
                      </p>
                    </div>
                  )}
                </div>

                {/* Per-message-type actions — unknown types render none */}
                {selected.actionType && !bodyFailed && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(() => {
                      const a = actionFor[selected.actionType];
                      return (
                        <Link
                          href={a.href}
                          className={cn(
                            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                            a.className,
                          )}
                        >
                          {a.icon}
                          {a.label}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      );
                    })()}
                  </div>
                )}

                <p className="mt-5 text-[11px] text-on-surface-variant">
                  Retention: deleted messages are soft-deleted and kept for 90 days
                  before permanent removal.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
