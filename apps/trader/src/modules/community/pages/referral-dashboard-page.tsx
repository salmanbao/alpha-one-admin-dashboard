"use client";

/**
 * Referral Hub — rebuilt per M8 spec Section 12.1 (View ID /referrals)
 *
 * Layout regions (Table 140):
 * - Stats header: four stat tiles (Invited, Converted (KYC passed), Active
 *   (funded), Rewards earned) each with a delta chip vs the previous 30 days.
 * - Tier progress card: current tier (Bronze / Silver / Gold) with commission
 *   rate + perks, progress bar to next tier with the exact remaining
 *   conversions, and the tier ladder list with unlocked / locked states.
 * - Share kit card: referral link with copy button, QR code (PNG download),
 *   channel tabs (WhatsApp / X / Telegram / Email) each prefilling a compliant
 *   share draft, plus an email invite form with a consent note.
 * - Referred friends table: masked friend handle, joined date, status ladder
 *   step chips (Signed up → KYC passed → Funded), reward state (Pending /
 *   Credited / Forfeited with reason / pending-attention) and reward date.
 * - Reward history table: date, type (signup bonus / funded bonus / commission
 *   share), amount, status and related friend reference.
 *
 * Interactions (Table 141):
 * - Copy and QR download fire toasts; share tabs deep-link to the channel with
 *   prefilled text where the platform supports it.
 * - Self-referral / same-device attempts are blocked at link conversion with a
 *   policy message (device fingerprint note) and no reward state changes.
 * - Simulated conversion: a friend reaching funded status completes the step
 *   chips, credits the reward and appends a history row (Table 142).
 *
 * States (Table 141): welcome/empty variant with zeroed stats and a
 * how-it-works strip; tile + table skeletons while loading; reward crediting
 * failures render a Pending-attention chip with a support deep link.
 *
 * Data shown: referral counts by stage, tier progress, rewards, referred
 * friends with masked identities. All data is local dummy data.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton, cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  Copy,
  Download,
  Gift,
  Lock,
  Mail,
  MessageCircle,
  Send,
  Share2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Dummy data helpers                                                  */
/* ------------------------------------------------------------------ */

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const REFERRAL_CODE = "TOM-9F2K";
const REFERRAL_LINK = `https://terratrader.app/r/${REFERRAL_CODE}`;

/* ------------------------------------------------------------------ */
/* Data model                                                          */
/* ------------------------------------------------------------------ */

type RewardState = "Pending" | "Credited" | "Forfeited" | "Failed";

interface Friend {
  id: string;
  handle: string; // masked handle
  joined: string; // ISO
  /** Step ladder index: 0 = signed up, 1 = KYC passed, 2 = funded. */
  step: number;
  reward: {
    state: RewardState;
    amount: number;
    date?: string;
    reason?: string; // forfeit reason / failure detail
  };
}

interface RewardRow {
  id: string;
  date: string;
  type: "Signup bonus" | "Funded bonus" | "Commission share";
  amount: number;
  status: "Credited" | "Pending" | "Forfeited" | "Failed";
  friend: string;
}

interface Stats {
  invited: number;
  invitedDelta: number;
  converted: number;
  convertedDelta: number;
  active: number;
  activeDelta: number;
  earned: number;
  earnedDelta: number;
}

const initialStats: Stats = {
  invited: 14,
  invitedDelta: 4,
  converted: 9,
  convertedDelta: 2,
  active: 7,
  activeDelta: 3,
  earned: 1260,
  earnedDelta: 320,
};

const initialFriends: Friend[] = [
  {
    id: "rf-1",
    handle: "j****@gmail.com",
    joined: daysAgo(4),
    step: 2,
    reward: { state: "Credited", amount: 100, date: daysAgo(2) },
  },
  {
    id: "rf-2",
    handle: "m****@outlook.com",
    joined: daysAgo(11),
    step: 1,
    reward: { state: "Pending", amount: 50 },
  },
  {
    id: "rf-3",
    handle: "k****@proton.me",
    joined: daysAgo(19),
    step: 2,
    reward: { state: "Credited", amount: 100, date: daysAgo(15) },
  },
  {
    id: "rf-4",
    handle: "a****@yahoo.com",
    joined: daysAgo(28),
    step: 0,
    reward: { state: "Pending", amount: 25 },
  },
  {
    id: "rf-5",
    handle: "d****@icloud.com",
    joined: daysAgo(35),
    step: 2,
    reward: {
      state: "Forfeited",
      amount: 100,
      reason: "Funding deposit reversed within 7 days of crediting",
    },
  },
  {
    id: "rf-6",
    handle: "r****@gmail.com",
    joined: daysAgo(2),
    step: 0,
    reward: {
      state: "Failed",
      amount: 25,
      reason: "Reward crediting failed at the payout ledger",
    },
  },
];

const initialHistory: RewardRow[] = [
  {
    id: "rh-1",
    date: daysAgo(2),
    type: "Funded bonus",
    amount: 100,
    status: "Credited",
    friend: "j****@gmail.com",
  },
  {
    id: "rh-2",
    date: daysAgo(4),
    type: "Signup bonus",
    amount: 25,
    status: "Credited",
    friend: "j****@gmail.com",
  },
  {
    id: "rh-3",
    date: daysAgo(1),
    type: "Signup bonus",
    amount: 25,
    status: "Failed",
    friend: "r****@gmail.com",
  },
  {
    id: "rh-4",
    date: daysAgo(15),
    type: "Funded bonus",
    amount: 100,
    status: "Credited",
    friend: "k****@proton.me",
  },
  {
    id: "rh-5",
    date: daysAgo(15),
    type: "Commission share",
    amount: 18.4,
    status: "Pending",
    friend: "k****@proton.me",
  },
  {
    id: "rh-6",
    date: daysAgo(30),
    type: "Funded bonus",
    amount: 100,
    status: "Forfeited",
    friend: "d****@icloud.com",
  },
];

/* Tier ladder — commission rate + perks, thresholds on converted friends. */
const tiers = [
  {
    name: "Bronze",
    min: 0,
    rate: "8%",
    perks: ["Signup + funded bonuses", "Standard commission share"],
  },
  {
    name: "Silver",
    min: 6,
    rate: "10%",
    perks: ["Everything in Bronze", "Priority payout review", "2× campaign bonuses"],
  },
  {
    name: "Gold",
    min: 15,
    rate: "12%",
    perks: ["Everything in Silver", "Dedicated partner manager", "Exclusive promo codes"],
  },
];

/* ------------------------------------------------------------------ */
/* Share kit — compliant template + per-channel deep links             */
/* ------------------------------------------------------------------ */

const SHARE_TEMPLATE =
  "I've been trading on TerraTrader — real risk rules, funded accounts. Join with my link and we both earn when you get funded:";

type ShareChannel = "whatsapp" | "x" | "telegram" | "email";

const shareChannels: {
  id: ShareChannel;
  label: string;
  icon: typeof MessageCircle;
  draftUrl: string;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    draftUrl: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEMPLATE} ${REFERRAL_LINK}`)}`,
  },
  {
    id: "x",
    label: "X",
    icon: Share2,
    draftUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEMPLATE)}&url=${encodeURIComponent(REFERRAL_LINK)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: Send,
    draftUrl: `https://t.me/share/url?url=${encodeURIComponent(REFERRAL_LINK)}&text=${encodeURIComponent(SHARE_TEMPLATE)}`,
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    draftUrl: `mailto:?subject=${encodeURIComponent("Your invite to TerraTrader")}&body=${encodeURIComponent(`${SHARE_TEMPLATE}\n\n${REFERRAL_LINK}`)}`,
  },
];

/* ------------------------------------------------------------------ */
/* Deterministic QR placeholder (no external images / network)         */
/* ------------------------------------------------------------------ */

function qrModules(code: string, n = 25): boolean[][] {
  let h = 2166136261;
  for (const ch of code) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const rand = (i: number) => {
    let x = (h ^ Math.imul(i + 1, 2654435761)) >>> 0;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
  const m: boolean[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => false),
  );
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) m[r][c] = rand(r * n + c) > 0.55;
  }
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r < 8; r++) {
      for (let c = -1; c < 8; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          m[rr][cc] = false; // quiet ring
        } else {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          m[rr][cc] = edge || core;
        }
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  return m;
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function DeltaChip({ value, positive }: { value: number; positive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
        positive
          ? "bg-primary-fixed text-on-primary-fixed-variant"
          : "bg-error-container text-on-error-container",
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {positive ? "+" : "−"}
      {Math.abs(value)} vs prev 30d
    </span>
  );
}

function StatTile({
  label,
  value,
  delta,
  positive,
  icon,
  empty,
}: {
  label: string;
  value: string;
  delta: number;
  positive: boolean;
  icon: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="text-on-surface-variant/60">{icon}</span>
      </div>
      <p className="mt-2 font-headline text-2xl font-bold tabular-nums text-on-surface">
        {value}
      </p>
      <div className="mt-1.5">
        {empty ? (
          <span className="text-[11px] font-medium text-on-surface-variant">
            No activity yet
          </span>
        ) : (
          <DeltaChip value={delta} positive={positive} />
        )}
      </div>
    </div>
  );
}

/** Step chips: Signed up → KYC passed → Funded (filled = reached). */
function StepLadder({ step }: { step: number }) {
  const steps = ["Signed up", "KYC passed", "Funded"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const done = i <= step;
        return (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 && (
              <ArrowRight
                className={cn(
                  "h-3 w-3",
                  i <= step ? "text-primary" : "text-on-surface-variant/40",
                )}
              />
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                done
                  ? "border-primary/40 bg-primary-fixed text-on-primary-fixed-variant"
                  : "border-outline-variant/60 bg-surface-container text-on-surface-variant/70",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
              {s}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function RewardStateCell({ reward }: { reward: Friend["reward"] }) {
  switch (reward.state) {
    case "Credited":
      return (
        <div className="space-y-0.5">
          <TerraBadge tone="success">Credited</TerraBadge>
          <p className="text-xs font-bold tabular-nums text-primary">
            +{formatMoney(reward.amount)}
          </p>
        </div>
      );
    case "Pending":
      return (
        <div className="space-y-0.5">
          <TerraBadge tone="tertiary" dot>
            Pending
          </TerraBadge>
          <p className="text-xs text-on-surface-variant">
            {formatMoney(reward.amount)} on funding
          </p>
        </div>
      );
    case "Forfeited":
      return (
        <div className="space-y-1">
          <TerraBadge tone="error">Forfeited</TerraBadge>
          <p className="max-w-52 text-[11px] leading-snug text-on-surface-variant">
            {reward.reason}
          </p>
        </div>
      );
    case "Failed":
    default:
      return (
        <div className="space-y-1">
          <TerraBadge tone="error" dot pulse>
            Pending attention
          </TerraBadge>
          <Link
            href="/support"
            className="block text-[11px] font-semibold text-primary underline hover:text-primary/80"
          >
            Crediting failed — contact support
          </Link>
        </div>
      );
  }
}

function StatusBadge({ status }: { status: RewardRow["status"] }) {
  if (status === "Credited") return <TerraBadge tone="success">Credited</TerraBadge>;
  if (status === "Pending") return <TerraBadge tone="tertiary">Pending</TerraBadge>;
  if (status === "Forfeited") return <TerraBadge tone="error">Forfeited</TerraBadge>;
  return (
    <TerraBadge tone="error" dot pulse>
      Pending attention
    </TerraBadge>
  );
}

/* Loading skeleton for the tile + table regions (Table 141). */
function ReferralSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-52 rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ReferralDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [zeroState, setZeroState] = useState(false);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [history, setHistory] = useState<RewardRow[]>(initialHistory);
  const [copied, setCopied] = useState(false);
  const [shareChannel, setShareChannel] = useState<ShareChannel>("whatsapp");
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  // Deferred gate: first paint matches SSR, then the dummy data lands
  // (same pattern as the checkout recovery route).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const empty = zeroState || (friends.length === 0 && history.length === 0);
  const displayStats = zeroState
    ? {
        invited: 0,
        invitedDelta: 0,
        converted: 0,
        convertedDelta: 0,
        active: 0,
        activeDelta: 0,
        earned: 0,
        earnedDelta: 0,
      }
    : stats;

  /* Tier maths — current tier + exact remaining conversions (Table 140). */
  const converted = displayStats.converted;
  const currentTier =
    [...tiers].reverse().find((t) => converted >= t.min) ?? tiers[0];
  const nextTier = tiers.find((t) => t.min > converted) ?? null;
  const progressPct = nextTier
    ? Math.min(100, Math.round((converted / nextTier.min) * 100))
    : 100;
  const remaining = nextTier ? nextTier.min - converted : 0;

  const qr = qrModules(REFERRAL_CODE);

  /* ---- Interactions --------------------------------------------- */

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK);
    } catch {
      /* clipboard unavailable — still confirm the action for the demo */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Referral link copied",
      description: `${REFERRAL_LINK} — share it anywhere.`,
    });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
    } catch {
      /* noop */
    }
    toast({
      title: "Referral code copied",
      description: `${REFERRAL_CODE} copied to clipboard.`,
    });
  };

  const handleQrDownload = () => {
    const n = qr.length;
    const scale = 12;
    const quiet = 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = (n + quiet * 2) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#12140f";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr[r][c]) continue;
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "terratrader-referral-qr.png";
    a.click();
    toast({
      title: "QR code downloaded",
      description: "terratrader-referral-qr.png saved — print it or share it.",
    });
  };

  const handleShareDraft = () => {
    const channel = shareChannels.find((c) => c.id === shareChannel)!;
    window.open(channel.draftUrl, "_blank", "noopener,noreferrer");
    toast({
      title: `Opening ${channel.label}`,
      description: "Your share draft is prefilled with your referral link.",
    });
  };

  const handleCopyDraft = async () => {
    const draft = `${SHARE_TEMPLATE} ${REFERRAL_LINK}`;
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      /* noop */
    }
    toast({
      title: "Draft copied",
      description: "Compliant share message copied to clipboard.",
    });
  };

  const handleSendInvites = () => {
    const parts = inviteEmails
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setInviteError("Add at least one email address.");
      return;
    }
    const invalid = parts.find((p) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
    if (invalid) {
      setInviteError(`"${invalid}" is not a valid email address.`);
      return;
    }
    setInviteError(null);
    setInviteEmails("");
    toast({
      title: `${parts.length} invite${parts.length > 1 ? "s" : ""} sent`,
      description: "Each contact gets your referral link with a consent notice.",
    });
  };

  /** Table 142: friend reaches funded → chips complete, reward credits,
   *  history row appears. */
  const handleSimulateConversion = () => {
    const target = friends.find((f) => f.step < 2);
    if (!target) {
      toast({
        title: "No pending conversions",
        description: "Every referred friend is already funded.",
      });
      return;
    }
    const amount = 100;
    const nowIso = new Date().toISOString();
    setFriends((fs) =>
      fs.map((f) =>
        f.id === target.id
          ? {
              ...f,
              step: 2,
              reward: { state: "Credited", amount, date: nowIso },
            }
          : f,
      ),
    );
    setHistory((h) => [
      {
        id: `rh-${nowIso}`,
        date: nowIso,
        type: "Funded bonus",
        amount,
        status: "Credited",
        friend: target.handle,
      },
      ...h,
    ]);
    setStats((s) => ({
      ...s,
      active: s.active + 1,
      activeDelta: s.activeDelta + 1,
      earned: s.earned + amount,
      earnedDelta: s.earnedDelta + amount,
    }));
    toast({
      title: "Friend reached funded status",
      description: `${target.handle} is funded — ${formatMoney(amount)} credited to your rewards.`,
    });
  };

  /** Table 142: same-device link conversion is blocked with a policy
   *  message and no reward state changes. */
  const handleDeviceConversion = () => {
    setDeviceBlocked(true);
    toast({
      title: "Conversion blocked",
      description: "Self-referral and same-device attempts are rejected.",
      variant: "destructive",
    });
  };

  const activeChannel = shareChannels.find((c) => c.id === shareChannel)!;

  /* ---- Render ---------------------------------------------------- */

  if (loading) return <ReferralSkeleton />;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Referral Hub"
        description="Invite traders, climb the tiers and earn from every challenge they buy"
        actions={
          <button
            type="button"
            onClick={() => setZeroState((z) => !z)}
            className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            {zeroState ? "Exit zero-state preview" : "Preview welcome (zero) state"}
          </button>
        }
      />

      {/* ---------------------------------------------- Stats header */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Invited"
          value={String(displayStats.invited)}
          delta={displayStats.invitedDelta}
          positive={displayStats.invitedDelta >= 0}
          empty={empty}
          icon={<UserPlus className="h-4 w-4" />}
        />
        <StatTile
          label="Converted (KYC passed)"
          value={String(displayStats.converted)}
          delta={displayStats.convertedDelta}
          positive={displayStats.convertedDelta >= 0}
          empty={empty}
          icon={<Users className="h-4 w-4" />}
        />
        <StatTile
          label="Active (funded)"
          value={String(displayStats.active)}
          delta={displayStats.activeDelta}
          positive={displayStats.activeDelta >= 0}
          empty={empty}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatTile
          label="Rewards earned"
          value={formatMoney(displayStats.earned)}
          delta={displayStats.earnedDelta}
          positive={displayStats.earnedDelta >= 0}
          empty={empty}
          icon={<Gift className="h-4 w-4" />}
        />
      </div>

      {/* ----------------------------------------- Tier progress card */}
      <TerraCard>
        <TerraSectionTitle
          title="Tier progress"
          description="Commission rates unlock as your funded conversions grow."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current tier + progress bar */}
          <div className="rounded-xl bg-surface-container-low p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-on-primary-fixed-variant">
                  {nextTier ? <Lock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Current tier
                  </p>
                  <p className="font-headline text-xl font-bold text-on-surface">
                    {currentTier.name}
                  </p>
                </div>
              </div>
              <TerraBadge tone="primary">{currentTier.rate} commission</TerraBadge>
            </div>

            <ul className="mt-3 space-y-1">
              {currentTier.perks.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2 text-xs text-on-surface-variant"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-on-surface">
                  {converted} / {nextTier ? nextTier.min : currentTier.min} conversions
                </span>
                <span className="text-on-surface-variant">
                  {nextTier ? `${nextTier.name} at ${nextTier.min}` : "Top tier reached"}
                </span>
              </div>
              <TerraProgress value={progressPct} />
              <p className="mt-2 text-sm text-on-surface-variant">
                {nextTier ? (
                  <>
                    <span className="font-bold text-on-surface">{remaining}</span>{" "}
                    more conversion{remaining === 1 ? "" : "s"} to unlock{" "}
                    <span className="font-bold text-primary">{nextTier.name}</span> at{" "}
                    {nextTier.rate} commission.
                  </>
                ) : (
                  <>You're at the top tier — {currentTier.rate} on every conversion.</>
                )}
              </p>
            </div>
          </div>

          {/* Tier ladder — unlocked / locked states */}
          <div className="rounded-xl border border-outline-variant/40 p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Tier ladder
            </p>
            <ol className="mt-3 space-y-3">
              {tiers.map((t) => {
                const unlocked = converted >= t.min;
                const isCurrent = t.name === currentTier.name;
                return (
                  <li
                    key={t.name}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3",
                      isCurrent
                        ? "border-primary/40 bg-primary/5"
                        : "border-outline-variant/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        unlocked
                          ? "bg-primary-fixed text-on-primary-fixed-variant"
                          : "bg-surface-container text-on-surface-variant",
                      )}
                    >
                      {unlocked ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface">
                        {t.name}{" "}
                        <span className="font-medium text-on-surface-variant">
                          · {t.rate}
                        </span>
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {t.min === 0 ? "Starter tier" : `${t.min}+ funded conversions`} —{" "}
                        {t.perks[0]}
                      </p>
                    </div>
                    {isCurrent ? (
                      <TerraBadge tone="primary">Current</TerraBadge>
                    ) : unlocked ? (
                      <TerraBadge tone="success">Unlocked</TerraBadge>
                    ) : (
                      <TerraBadge tone="neutral">Locked</TerraBadge>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </TerraCard>

      {/* ---------------------------------------------- Share kit card */}
      <TerraCard>
        <TerraSectionTitle
          title={empty ? "Start your growth loop" : "Share kit"}
          description={
            empty
              ? "Invite your first trader — it takes one link."
              : "Your link, your code and pre-compliant drafts for every channel."
          }
        />

        {/* Welcome / how-it-works strip (zero-state, Table 141) */}
        {empty && (
          <div className="mb-5 grid gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:grid-cols-3">
            {[
              {
                step: "1. Share your link",
                detail: "Send it on WhatsApp, X, Telegram or email — or hand out your code.",
              },
              {
                step: "2. Friend signs up & passes KYC",
                detail: "Their progress shows up as step chips in your friends table.",
              },
              {
                step: "3. You both earn",
                detail: "Signup bonus on KYC, funded bonus + ongoing commission share.",
              },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                  {s.step.split(".")[0]}
                </span>
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.step}</p>
                  <p className="text-xs text-on-surface-variant">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Link + code + QR */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Referral link
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2.5 font-mono text-xs text-on-surface">
                  {REFERRAL_LINK}
                </code>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-xs font-semibold text-primary underline hover:text-primary/80"
                >
                  Copy code {REFERRAL_CODE}
                </button>
                <span className="text-on-surface-variant/40">·</span>
                <button
                  type="button"
                  onClick={handleDeviceConversion}
                  className="text-xs font-semibold text-on-surface-variant underline hover:text-on-surface"
                >
                  Open link on this device
                </button>
              </div>
            </div>

            {/* QR placeholder (inline SVG) + PNG download */}
            <div className="flex items-start gap-4 rounded-xl bg-surface-container-low p-4">
              <div className="shrink-0 rounded-lg border border-outline-variant/60 bg-white p-2">
                <svg
                  viewBox={`0 0 ${qr.length} ${qr.length}`}
                  className="h-24 w-24"
                  role="img"
                  aria-label={`QR code for referral link ${REFERRAL_LINK}`}
                  shapeRendering="crispEdges"
                >
                  <rect width={qr.length} height={qr.length} fill="#ffffff" />
                  {qr.map((row, r) =>
                    row.map((on, c) =>
                      on ? (
                        <rect
                          key={`${r}-${c}`}
                          x={c}
                          y={r}
                          width={1}
                          height={1}
                          fill="#12140f"
                        />
                      ) : null,
                    ),
                  )}
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">QR code</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Scan to open your referral link — download it as a PNG for print or
                  socials.
                </p>
                <button
                  type="button"
                  onClick={handleQrDownload}
                  className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-surface-container px-3.5 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </button>
              </div>
            </div>
          </div>

          {/* Channel tabs + prefilled draft + email invite */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Share via
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {shareChannels.map((c) => {
                  const Icon = c.icon;
                  const active = shareChannel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setShareChannel(c.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all",
                        active
                          ? "bg-primary text-on-primary shadow-sm"
                          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Prefilled compliant draft */}
              <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {activeChannel.label} draft
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-on-surface">
                  {SHARE_TEMPLATE}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-primary">
                  {REFERRAL_LINK}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleShareDraft}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Open {activeChannel.label}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3.5 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy draft
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  Template pre-approved for marketing compliance — no income claims.
                </p>
              </div>
            </div>

            {/* Email invite form + consent note */}
            <div>
              <label
                htmlFor="invite-emails"
                className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
              >
                Invite by email
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="invite-emails"
                  type="text"
                  value={inviteEmails}
                  onChange={(e) => {
                    setInviteEmails(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="alex@example.com, sam@example.com"
                  aria-invalid={inviteError ? true : undefined}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40",
                    inviteError ? "border-error" : "border-outline-variant/60",
                  )}
                />
                <button
                  type="button"
                  onClick={handleSendInvites}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Send invites
                </button>
              </div>
              {inviteError && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-error">
                  {inviteError}
                </p>
              )}
              <p className="mt-1.5 text-[11px] leading-snug text-on-surface-variant">
                We only use these addresses to send your personal invite. Contacts get one
                reminder, never marketing email, and can opt out any time — see our{" "}
                <Link href="/terms" className="font-semibold text-primary underline">
                  terms
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </TerraCard>

      {/* --------------------------------- Self-referral policy notice */}
      {deviceBlocked && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-error/40 bg-error-container/30 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-on-surface">
              Conversion blocked — this device already has an account
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
              Self-referral and same-device attempts are rejected at link conversion using
              device fingerprint and network matching. No reward state changed.{" "}
              <Link href="/support" className="font-semibold text-primary underline">
                Questions? Contact support
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeviceBlocked(false)}
            aria-label="Dismiss policy notice"
            className="shrink-0 rounded p-1 text-on-surface-variant hover:text-on-surface"
          >
            ×
          </button>
        </div>
      )}

      {/* --------------------------------------- Referred friends table */}
      <TerraCard>
        <TerraSectionTitle
          title="Referred friends"
          description="Masked identities, conversion progress and reward outcomes."
          actions={
            !empty && (
              <button
                type="button"
                onClick={handleSimulateConversion}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Users className="h-3.5 w-3.5" />
                Simulate friend reaching funded
              </button>
            )
          }
        />
        {empty ? (
          <TerraEmpty
            icon={<Users className="h-10 w-10" />}
            title="No referred friends yet"
            description="Share your link above — friends appear here the moment they sign up."
          />
        ) : (
          <TerraTable
            head={[
              "Friend",
              "Joined",
              "Status ladder",
              "Reward state",
              "Reward date",
            ]}
            rows={friends.map((f) => [
              <span key="f" className="font-mono text-xs font-semibold">
                {f.handle}
              </span>,
              <span key="j" className="text-sm text-on-surface-variant">
                {fmtDate(f.joined)}
              </span>,
              <span key="s">
                <StepLadder step={f.step} />
              </span>,
              <span key="r">
                <RewardStateCell reward={f.reward} />
              </span>,
              <span key="d" className="text-sm text-on-surface-variant">
                {f.reward.date ? fmtDate(f.reward.date) : "—"}
              </span>,
            ])}
          />
        )}
      </TerraCard>

      {/* ------------------------------------------- Reward history */}
      <TerraCard>
        <TerraSectionTitle
          title="Reward history"
          description="Every bonus and commission share credited to you."
        />
        {empty || history.length === 0 ? (
          <TerraEmpty
            icon={<Gift className="h-10 w-10" />}
            title="No rewards yet"
            description="Rewards land here as soon as your first referral converts."
          />
        ) : (
          <TerraTable
            head={["Date", "Type", "Amount", "Status", "Related friend"]}
            rows={history.map((r) => [
              <span key="d" className="text-sm text-on-surface-variant">
                {fmtDate(r.date)}
              </span>,
              <span key="t" className="text-sm">
                {r.type}
              </span>,
              <span key="a" className="font-bold tabular-nums text-on-surface">
                {formatMoney(r.amount)}
              </span>,
              <span key="s">
                <StatusBadge status={r.status} />
              </span>,
              <span key="f" className="font-mono text-xs text-on-surface-variant">
                {r.friend}
              </span>,
            ])}
          />
        )}
      </TerraCard>
    </div>
  );
}
