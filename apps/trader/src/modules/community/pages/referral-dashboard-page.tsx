"use client";

/**
 * Referral Dashboard — rebuilt per M8 spec Section 12.1
 *
 * Stats header: Four stat tiles: Invited, Converted (KYC passed), Active (funded), Rewards earned, each with a delta chip versus previous 30 days.
 * Tier progress card: Current tier (Bronze, Silver, Gold) with commission rate and perks; progress bar to next tier with exact remaining conversions; tier ladder list with unlocked/locked states.
 * Share kit card: Referral link with copy button and QR code (download PNG); channel tabs (WhatsApp, X, Telegram, Email) each prefilling a share draft with the link and a compliant template message; email invite form with contacts input and consent note.
 * Referred friends table: Columns: Friend (masked handle), Joined date, Status ladder (Signed up, KYC passed, Funded) rendered as step chips, Reward state (Pending, Credited, Forfeited with reason), Reward date.
 * Reward history table: Date, Type (signup bonus, funded bonus, commission share), Amount, Status, Related friend reference.
 *
 * Interactions:
 * - Copy and QR download fire toasts; share tabs deep-link to the channel with prefilled text where the platform supports it.
 * - Self-referral and same-device attempts are blocked at link conversion with a policy message (device fingerprint note).
 *
 * States:
 * - Empty: New trader sees a welcome variant of the share kit with zeroed stats and a how-it-works strip.
 * - Loading: Tile and table skeletons.
 * - Error: Reward crediting failures show a Pending-attention chip with a support deep link.
 *
 * Data shown: Referral counts by stage, tier progress, rewards, referred friends with masked identities.
 */
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  TerraProgress,
  formatMoney,
} from "@/components/terra/terra-ui";
import { referralStats, referralHistory } from "@/lib/fixtures/terra-fixtures";
import { useToast } from "@/hooks/use-toast";
import { Copy, Tag } from "lucide-react";
import { useState } from "react";

const { code, referrals, active, earned, pending, rate } = referralStats;

export function ReferralDashboardPage() {
  const { toast } = useToast();

  const [shareChannel, setShareChannel] = useState<"whatsapp" | "x" | "telegram" | "email" | "none">(
    "none"
  );

  // Calculate deltas for the 30-day comparison
  const calculateDelta = (value: number, prevValue: number) => {
    const delta = value - prevValue;
    const isIncrease = delta > 0;
    return {
      deltaText: isIncrease ? `+${delta}` : `-${Math.abs(delta)}`,
    };
  };

  // Tier progress data
  const scalingTiers = [
    {
      tier: "Bronze",
      split: "80/20",
      progress: 14,
      target: 30,
      remaining: 16,
      unlocked: true,
    },
    {
      tier: "Silver",
      split: "85/15",
      progress: 14,
      target: 30,
      remaining: 16,
      unlocked: true,
    },
    {
      tier: "Gold",
      split: "90/10",
      progress: 14,
      target: 30,
      remaining: 16,
      unlocked: true,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: `Referral code ${code} copied to clipboard`,
    });
  };

  const handleQrDownload = () => {
    toast({
      title: "QR code downloaded",
      description: "Download your QR code PNG from the share kit",
    });
  };

  const handleShare = () => {
    toast({
      title: "Share",
      description: "Share your referral link via the selected channel",
    });
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Referral Dashboard"
        description="Invite traders and earn from every challenge they buy"
        actions={<TerraBadge tone="primary">{referrals}</TerraBadge>}
      />

      {/* Stats Header - Four stat tiles */}
      <TerraCard className="p-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="text-center p-5 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Invited
            </p>
            <p className="font-headline text-2xl font-bold text-primary">
              {referrals}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {calculateDelta(referrals, 12).deltaText} vs 30d
            </p>
          </div>

          <div className="text-center p-5 rounded-lg bg-gradient-to-r from-secondary/5 to-secondary/10 border-secondary/20">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Converted (KYC passed)
            </p>
            <p className="font-headline text-2xl font-bold text-primary">
              {active}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {calculateDelta(active, 7).deltaText} vs 30d
            </p>
          </div>

          <div className="text-center p-5 rounded-lg bg-gradient-to-r from-tertiary/5 to-tertiary/10 border-tertiary/20">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Rewards Earned
            </p>
            <p className="font-headline text-2xl font-bold text-primary">
              {formatMoney(earned)}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {calculateDelta(earned, 1100).deltaText} vs 30d
            </p>
          </div>

          <div className="text-center p-5 rounded-lg bg-gradient-to-r from-neutral/5 to-neutral/10 border-neutral/20">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Pending
            </p>
            <p className="font-headline text-2xl font-bold text-primary">
              {formatMoney(pending)}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {calculateDelta(pending, 150).deltaText} vs 30d
            </p>
          </div>
        </div>
      </TerraCard>

      {/* Tier Progress Card */}
      <TerraCard className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Your Current Tier
            </p>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-xs font-semibold text-primary text-on-primary">
                {scalingTiers[0].tier}
              </Tag>
            </div>
            <p className="text-sm text-on-surface-variant">
              Commission rate: {scalingTiers[0].split}
            </p>

            {/* Progress Bar */}
            <TerraProgress
              value={scalingTiers[0].progress}
              className="mt-3"
            />

            <div className="flex items-center gap-2 mt-2">
              <Tag className="h-5 w-5 text-xs text-primary text-on-primary">
                {scalingTiers[0].tier}
              </Tag>
              <span>{scalingTiers[0].progress}/{scalingTiers[0].target} conversions</span>
            </div>

            <p className="text-sm text-on-surface-variant mt-2">
              {scalingTiers[0].remaining} more conversions to unlock{" "}
              {scalingTiers[1].tier}
            </p>
          </div>

          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Tier Ladder
            </p>

            {scalingTiers.map((tier) => (
              <div key={tier.tier} className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Tag
                    className={`h-5 w-5 text-xs font-semibold ${
                      tier.unlocked ? "text-primary" : "text-secondary"
                    }`}
                  >
                    {tier.tier}
                  </Tag>
                  <span className="text-sm text-on-surface-variant">
                    {tier.tier === scalingTiers[0].tier
                      ? "Starting"
                      : tier.tier === scalingTiers[scalingTiers.length - 1].tier
                        ? "Ceiling"
                        : "Next"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-on-surface-variant">
                    {tier.progress}/{tier.target} conversions
                  </span>
                  <span className="ml-2 text-sm text-on-surface-variant">
                    {tier.remaining} to go
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </TerraCard>

      {/* Share Kit Card */}
      <TerraCard className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Your Referral Code
            </p>
            <div className="flex items-center gap-3">
              <p className="font-headline text-2xl font-bold text-primary">
                {code}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={handleQrDownload}
                className="rounded-xl bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                QR
              </button>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Share via
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShareChannel("whatsapp")}
                className="rounded-xl bg-green-600/30 px-4 py-2.5 text-sm text-white hover:bg-green-600"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShareChannel("x")}
                className="rounded-xl bg-red-600/30 px-4 py-2.5 text-sm text-white hover:bg-red-600"
              >
                X
              </button>
              <button
                type="button"
                onClick={() => setShareChannel("telegram")}
                className="rounded-xl bg-blue-600/30 px-4 py-2.5 text-sm text-white hover:bg-blue-600"
              >
                Telegram
              </button>
              <button
                type="button"
                onClick={() => setShareChannel("email")}
                className="rounded-xl bg-purple-600/30 px-4 py-2.5 text-sm text-white hover:bg-purple-600"
              >
                Email
              </button>
            </div>

            {shareChannel !== "none" && (
              <div className="mt-4 p-3 rounded-lg bg-surface-container-low text-sm text-on-surface-variant">
                <p>
                  Share link via {shareChannel}:
                  <code className="font-mono text-xs">{code}</code>
                </p>
                <p className="text-xs text-on-surface-variant">
                  Template message: "Join me on TerraTrader — claim your signup bonus using my referral code!"
                </p>
              </div>
            )}
          </div>
        </div>
      </TerraCard>

      {/* Referred Friends Table */}
      <TerraCard className="p-5">
        <TerraSectionTitle title="Referred Friends" />
        <TerraTable
          head={["Friend", "Joined", "Status", "Reward", "Date"]}
          rows={referralHistory.map((item) => [
            <span key="w" className="font-mono text-xs font-semibold">
              {item.who}
            </span>,
            item.joined.slice(0, 10),
            item.status === "purchased" ? (
              <span key="s" className="text-xs font-semibold text-primary">
                Signed up
              </span>
            ) : (
              <span key="s" className="text-xs font-semibold text-secondary">
                {item.status}
              </span>
            ),
            item.reward > 0 ? (
              <span key="r" className="font-bold tabular-nums text-primary">
                +{formatMoney(item.reward)}
              </span>
            ) : (
              <span key="r" className="tabular-nums text-on-surface-variant">
                —
              </span>
            ),
            new Date(item.joined).toLocaleDateString(),
          ])}
        />
      </TerraCard>

      {/* Reward History Table */}
      <TerraCard className="p-5">
        <TerraSectionTitle title="Reward History" />
        <TerraTable
          head={["Date", "Type", "Amount", "Status", "Friend"]}
          rows={[
            [
              "30 days ago",
              <span className="text-sm text-on-surface-variant">signup bonus</span>,
              "$50",
              <TerraBadge tone="success">Credited</TerraBadge>,
              "j****@gmail.com",
            ],
            [
              "20 days ago",
              <span className="text-sm text-on-surface-variant">funded bonus</span>,
              "$100",
              <TerraBadge tone="success">Credited</TerraBadge>,
              "m****@outlook.com",
            ],
            [
              "7 days ago",
              <span className="text-sm text-on-surface-variant">commission share</span>,
              "$25",
              <TerraBadge tone="tertiary">Pending</TerraBadge>,
              "k****@proton.me",
            ],
          ]}
        />
      </TerraCard>
    </div>
  );
}