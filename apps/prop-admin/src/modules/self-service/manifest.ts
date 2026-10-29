/**
 * Self-Service Module — manifest, navigation.
 *
 * Gap analysis §6.6 (role conflation): trader-facing "my …" views were
 * scattered inside operator module sections (Challenges → My Active,
 * Risk → My Breaches, Payouts → My Withdrawals, …), mixing two audiences
 * in one sidebar. This module collects them under a single top-level
 * "Self-Service" section — a preview of what the trader portal exposes.
 *
 * Only navigation moves: the views, routes, and their permission guards
 * stay declared in the origin modules (routes are looked up across all
 * registered modules), so deep links and guards are unchanged. Nav item
 * ids and permissions are kept identical to their origin declarations.
 */

import {
  UserRound,
  Flame,
  Trophy,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  Inbox,
} from "lucide-react";
import type { FrontendModule, NavigationItem } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "self-service",
    label: "Self-Service",
    icon: UserRound,
    order: 95,
    children: [
      // ───────── Challenges (origin: challenges module) ─────────
      { id: "challenges.active", label: "My Active", href: "challenges-active", icon: Flame, permission: ["challenge.read", "challenge.self"], module: "challenges" },
      { id: "challenges.passed", label: "My Passed", href: "challenges-passed", icon: Trophy, permission: ["challenge.read", "challenge.self"], module: "challenges" },
      { id: "challenges.failed", label: "My Failed", href: "challenges-failed", icon: AlertCircle, permission: ["challenge.read", "challenge.self"], module: "challenges" },

      // ───────── Risk (origin: risk module) ─────────
      { id: "risk.breaches", label: "My Breaches", href: "breaches", icon: ShieldAlert, permission: ["breach.read", "breach.self"], module: "risk" },

      // ───────── Payouts (origin: payouts module) ─────────
      { id: "payouts.history", label: "My Withdrawals", href: "payouts-history", icon: CheckCircle2, permission: ["payout.read", "payout.self"], module: "payouts" },

      // ───────── Analytics (origin: analytics module) ─────────
      { id: "analytics.trader-performance", label: "My Performance", href: "trader-performance", icon: TrendingUp, permission: "analytics.read", module: "analytics" },

      // ───────── Support (origin: support module) ─────────
      { id: "support.tickets", label: "My Tickets", href: "support-tickets", icon: Inbox, permission: ["support.read", "support.self"], module: "support" },
    ],
  },
];

export const selfServiceModule: FrontendModule = {
  manifest: {
    id: "self-service",
    name: "Self-Service",
    version: "1.0.0",
    description:
      "Trader-facing self-service views (challenges, breaches, withdrawals, performance, tickets) grouped in one sidebar section. Navigation only — routes stay with their origin modules.",
    category: "core",
    supportedApplications: ["prop-admin"],
    icon: UserRound,
    accentColor: "#4a7c59",
  },
  navigation,
};
