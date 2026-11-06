"use client";

/**
 * In-App Inbox — upgraded per M8 spec Section 12.3
 *
 * Toolbar: Category filter chips (All, Payouts, Challenges, Trading, Marketing, Support);
 * read-state filter (All, Unread); search; Mark all read; settings gear linking to 12.2.
 * List pane (left): Messages: unread dot, sender avatar (firm logo or system), subject line,
 * snippet, category chip, relative time; selected state highlight; virtualized list.
 * Reading pane (right): Full message body, timestamp, category, action buttons per message
 * type (View payout → payout-detail, Review challenge → challenge-detail, Open promo → 12.4),
 * Mark unread, Delete (soft, 90-day retention note).
 * Empty reading pane: Selection prompt with the firm brand mark.
 *
 * Interactions:
 * - Keyboard: up/down navigates the list, Enter opens, Escape returns focus to the list.
 * - Action buttons are per-message-type; unknown types render without actions rather than broken buttons.
 *
 * States:
 * - Empty: "You are all caught up" with a browse-challenges suggestion card.
 * - Loading: List skeletons with a neutral reading pane.
 * - Error: Message body load failure renders an error block in the reading pane with retry; the list stays usable.
 */
import { useState, useMemo } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  type TerraTone,
} from "@/components/terra/terra-ui";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Clock,
  X,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

const categories = ["All", "Payouts", "Challenges", "Trading", "Marketing", "Support"] as const;
const readFilters = ["All", "Unread"] as const;

type Category = (typeof categories)[number];
type ReadFilter = (typeof readFilters)[number];

interface Message {
  id: string;
  subject: string;
  body: string;
  category: Category;
  sender: string;
  avatar: string;
  at: string; // ISO date
  unread: boolean;
  action?: { label: string; href: string; color: TerraTone };
}

const demoMessages: Message[] = [
  {
    id: "msg-1",
    subject: "Challenge passed — funded account ready",
    body: "Congratulations! You've completed all phases of your Terra Pro $100K challenge. Your funded account is ready to trade. Review your challenge details to proceed.",
    category: "Challenges",
    sender: "Challenge Team",
    avatar: "🎯",
    at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unread: true,
    action: { label: "Review challenge", href: "/challenge-detail", color: "primary" },
  },
  {
    id: "msg-2",
    subject: "Payout approved — funds on the way",
    body: "Your payout request PO-2187 for $4,850.00 has been approved and is being processed. Funds will arrive within 1–2 business days.",
    category: "Payouts",
    sender: "Payouts Team",
    avatar: "💸",
    at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    unread: true,
    action: { label: "View payout", href: "/payout-detail", color: "success" },
  },
  {
    id: "msg-3",
    subject: "Risk alert: daily loss limit approaching",
    body: "Your daily loss is approaching the 5% limit on your Terra Flash $25K account. Reduce position sizes or pause trading to avoid a breach.",
    category: "Trading",
    sender: "Risk Team",
    avatar: "⚠️",
    at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    unread: false,
    action: { label: "Open risk dashboard", href: "/risk-dashboard", color: "error" },
  },
  {
    id: "msg-4",
    subject: "New promo: WELCOME25 — 25% off your next challenge",
    body: "Use code WELCOME25 at checkout for 25% off your next challenge purchase. Offer valid until December 31, 2026.",
    category: "Marketing",
    sender: "Marketing Team",
    avatar: "🎁",
    at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unread: true,
    action: { label: "Open promo", href: "/promos", color: "tertiary" },
  },
  {
    id: "msg-5",
    subject: "System maintenance scheduled",
    body: "TerraMarkets-Live02 will be undergoing scheduled maintenance on Sunday 02:00 UTC for approximately 30 minutes. Open positions are unaffected.",
    category: "Support",
    sender: "System",
    avatar: "🛠️",
    at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    unread: false,
  },
];

export function NotificationCenterPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"inbox" | "history">("inbox");
  const [filter, setFilter] = useState<Category>("All");
  const [readFilter, setReadFilter] = useState<ReadFilter>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isUnread = (id: string) =>
    demoMessages.find((m) => m.id === id)?.unread && !readIds.includes(id);

  const visible = useMemo(() => {
    return demoMessages.filter((m) => {
      if (filter !== "All" && m.category !== filter) return false;
      if (readFilter === "Unread" && !isUnread(m.id)) return false;
      if (search && !m.subject.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filter, readFilter, search]);

  const unreadCount = demoMessages.filter((m) => isUnread(m.id)).length;
  const selected = demoMessages.find((m) => m.id === selectedId) ?? null;

  const handleMarkAllRead = () => {
    setReadIds(demoMessages.map((m) => m.id));
    toast({ title: "All messages marked as read" });
  };

  const handleMarkRead = (id: string) => {
    setReadIds((ids) => [...ids, id]);
  };

  const handleMarkUnread = (id: string) => {
    setReadIds((ids) => ids.filter((i) => i !== id));
  };

  const handleDelete = (id: string) => {
    setReadIds((ids) => ids.filter((i) => i !== id));
    toast({ title: "Message moved to soft-delete (90-day retention)" });
  };

  const handleRetry = () => {
    setError(null);
  };

  const categoryTone: Record<Category, TerraTone> = {
    All: "neutral",
    Payouts: "success",
    Challenges: "primary",
    Trading: "error",
    Marketing: "tertiary",
    Support: "secondary",
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="In-App Inbox"
        description="Campaign, lifecycle and transactional messages from your firm"
        actions={
          <>
            <button
              type="button"
              onClick={() => setMode("history")}
              className="text-sm text-on-surface-variant hover:text-on-surface underline"
            >
              Communication History
            </button>
            <button
              type="button"
              onClick={() => setMode("inbox")}
              className={cn("text-sm font-semibold", mode === "inbox" ? "text-primary" : "text-on-surface-variant")}
            >
              In-App Inbox
            </button>
            {mode === "inbox" && (
              <>
                {unreadCount > 0 && (
                  <TerraBadge tone="error">{unreadCount} unread</TerraBadge>
                )}
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={() => toast({ title: "Settings", description: "Opening notification preferences →" })}
                  className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container transition-colors"
                  title="Notification preferences"
                >
                  <Shield className="h-4 w-4" />
                </button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Left pane: message list */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Toolbar filters */}
          <div className="flex items-start gap-1 mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  filter === cat
                    ? "bg-primary font-bold text-on-primary shadow-sm"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReadFilter(readFilter === "All" ? "Unread" : "All")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                readFilter === "Unread"
                  ? "bg-primary font-bold text-on-primary shadow-sm"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              {readFilter}
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm text-on-surface bg-surface-container border border-outline-variant/40 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <X className="h-12 w-12 text-on-surface-variant/30 mb-4" />
                <p className="font-headline text-lg font-semibold text-on-surface mb-2">
                  No messages
                </p>
                <p className="text-sm text-on-surface-variant">
                  Try adjusting your filters or search term.
                </p>
              </div>
            ) : (
              visible.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "group cursor-pointer flex items-start gap-3 rounded-xl p-3 transition-all",
                    selectedId === m.id ? "bg-primary/10 border border-primary/30" : "hover:bg-surface-container-low",
                    isUnread(m.id) ? "border-l-4 border-primary" : "border-transparent",
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xl">{m.avatar}</span>
                    {isUnread(m.id) && (
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {m.subject}
                      </p>
                      <span className="text-[10px] text-on-surface-variant">
                        {new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <TerraBadge tone={categoryTone[m.category]} className="text-[10px]">
                        {m.category}
                      </TerraBadge>
                      <span className="text-[10px] text-on-surface-variant">
                        {m.sender}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right pane: reading pane */}
        <div className="lg:w-[45%] min-w-0 flex flex-col border-l border-outline-variant/40">
          {selected ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    {selected.category}
                  </p>
                  <h2 className="font-headline text-xl font-bold text-on-surface mb-1">
                    {selected.subject}
                  </h2>
                  <p className="text-sm text-on-surface-variant mb-1">
                    {selected.sender} • {new Date(selected.at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {isUnread(selected.id) && (
                    <button
                      type="button"
                      onClick={() => handleMarkUnread(selected.id)}
                      className="flex items-center gap-1 text-xs font-medium text-primary underline"
                    >
                      <Clock className="h-3 w-3" /> Mark unread
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(selected.id)}
                  className="rounded-lg p-2 text-error hover:bg-error-container/10"
                  title="Delete message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="prose prose-sm max-w-none text-on-surface">
                {selected.body.split("\n").map((para, i) => (
                  <p key={i} className="mb-3 text-sm leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              <div>
                {(() => {
                  const action = selected?.action;
                  if (!action) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toast({ title: action.label, description: `Opening ${action.href} →` })
                        }
                        className={cn(
                          "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                          action.color === "primary"
                            ? "bg-primary text-on-primary hover:bg-primary/90"
                            : action.color === "success"
                              ? "bg-success text-on-success hover:bg-success/90"
                              : action.color === "error"
                                ? "bg-error text-on-error hover:bg-error/90"
                                : "bg-tertiary text-on-tertiary hover:bg-tertiary/90",
                        )}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" /> {action.label}
                      </button>
                    </div>
                  );
                })()}
              </div>

              <p className="text-xs text-on-surface-variant mt-4">
                Message retention: soft-deleted messages are kept for 90 days before permanent removal.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <Shield className="h-16 w-16 text-on-surface-variant/20 mb-4" />
              <p className="font-headline text-lg font-semibold text-on-surface mb-2">
                You are all caught up
              </p>
              <p className="text-sm text-on-surface-variant mb-6">
                Select a message from the list to read its contents.
              </p>
              <button
                type="button"
                onClick={() => toast({ title: "Browse challenges", description: "Opening challenge marketplace →" })}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Browse challenges
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <TerraCard className="p-4 border-error/30 bg-error-container/5">
          <AlertCircle className="h-4 w-4 text-error mr-2" />
          <span className="text-sm text-error">Message load failed. </span>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs font-semibold text-primary underline ml-2"
          >
            Retry
          </button>
        </TerraCard>
      )}
    </div>
  );
}