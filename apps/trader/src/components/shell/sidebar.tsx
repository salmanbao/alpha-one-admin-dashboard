"use client";

/**
 * Terra Trader — Sidebar (Terra theme: Rooted Warmth, matching prop-admin)
 *
 * Hand-authored sidebar styled to mirror the prop-admin shell:
 * • side rail uses warm cream (var(--sidebar)) — never sterile
 * • active items use soft green (var(--sidebar-primary))
 * • warm sidebar border (var(--sidebar-border))
 * • scrollbar-thin for the nav rail
 * • cards/lift not used on nav (sister convention only)
 * • collapses to icon-only w/ warm border on desktop
 *
 * No navigation-engine dependency — hand-authored to match the trader
 * app's existing hand-authored navigation (which the prop-admin shell
 * also supports via the same shell layer).
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CandlestickChart,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Flag,
  FolderOpen,
  GitCompare,
  HelpCircle,
  History,
  LayoutGrid,
  LifeBuoy,
  Medal,
  MessageCircle,
  Monitor,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Repeat,
  ScrollText,
  Settings,
  Settings2,
  Share2,
  ShieldAlert,
  ShoppingBag,
  Store,
  Target,
  Trophy,
  Users,
  UserCheck,
  Wallet,
  Wrench,
  KeyRound,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { terraTenant, terraUser } from "@/lib/fixtures/terra-fixtures";

/* ------------------------------------------------------------------ */
/* Navigation model                                                    */
/* ------------------------------------------------------------------ */

interface NavChild {
  href: string;
  label: string;
  icon: LucideIcon;
  activePrefixes?: string[];
}

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavChild[];
  defaultOpen?: boolean;
}

interface DirectItem {
  href: string;
  label: string;
  icon: LucideIcon;
  activePrefixes?: string[];
}

const directItems: DirectItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/my-accounts", label: "My Accounts", icon: Wallet, activePrefixes: ["/account-detail"] },
  { href: "/marketplace", label: "Marketplace", icon: Store, activePrefixes: ["/challenge-detail", "/checkout", "/purchase-completed"] },
  { href: "/objectives", label: "Objectives", icon: Target, activePrefixes: ["/rules"] },
];

const sections: NavSection[] = [
  { id: "trading", label: "Trading", icon: CandlestickChart, defaultOpen: true, children: [
    { href: "/trading-positions", label: "Open Positions", icon: Package, activePrefixes: ["/order-detail"] },
    { href: "/trade-history", label: "Trade History", icon: History, activePrefixes: ["/trade-detail"] },
    { href: "/order-ticket", label: "Order Ticket", icon: ArrowLeftRight },
    { href: "/trade-replay", label: "Trade Replay", icon: Repeat },
    { href: "/market-watch", label: "Market Watch", icon: Eye },
    { href: "/web-terminal", label: "Web Terminal", icon: Monitor },
    { href: "/performance-analytics", label: "Performance", icon: BarChart3 },
    { href: "/risk-dashboard", label: "Risk Dashboard", icon: ShieldAlert },
  ]},
  { id: "tools", label: "Tools", icon: Wrench, children: [
    { href: "/trading-journal", label: "Trading Journal", icon: BookOpen },
    { href: "/trading-plan-builder", label: "Plan Builder", icon: ClipboardList },
    { href: "/trading-calendar", label: "Trading Calendar", icon: CalendarDays },
    { href: "/economic-calendar", label: "Economic Calendar", icon: CalendarClock },
  ]},
  { id: "challenges", label: "Challenges", icon: ShoppingBag, children: [
    { href: "/my-challenges", label: "My Challenges", icon: Flag },
    { href: "/challenge-comparison", label: "Compare Programs", icon: GitCompare },
    { href: "/purchase-history", label: "Purchase History", icon: Receipt, activePrefixes: ["/invoice-detail"] },
  ]},
  { id: "payouts", label: "Payouts", icon: Banknote, defaultOpen: true, children: [
    { href: "/payout-history", label: "Payout History", icon: History, activePrefixes: ["/payout-detail"] },
    { href: "/payout-request", label: "Request Payout", icon: ArrowDownToLine },
    { href: "/payout-eligibility", label: "Eligibility", icon: BadgeCheck },
    { href: "/withdrawal-methods", label: "Withdrawal Methods", icon: CreditCard },
  ]},
  { id: "finance", label: "Finance", icon: FileText, children: [
    { href: "/account-statement", label: "Account Statement", icon: FileSpreadsheet },
    { href: "/documents", label: "Documents", icon: FolderOpen, activePrefixes: ["/document-viewer"] },
    { href: "/tax-documents", label: "Tax Documents", icon: FileText, activePrefixes: ["/tax-statement-detail"] },
  ]},
  { id: "lifecycle", label: "Account Lifecycle", icon: RefreshCw, children: [
    { href: "/state-adaptive", label: "Lifecycle Simulator", icon: Activity },
    { href: "/kyc-onboarding", label: "KYC Onboarding", icon: UserCheck },
    { href: "/kyc-verification-status", label: "KYC Status", icon: Clock },
    { href: "/account-verification-1", label: "Account Verification", icon: FileCheck },
    { href: "/account-provisioning", label: "Provisioning", icon: Settings2 },
    { href: "/evaluation-passed", label: "Evaluation Passed", icon: Trophy },
    { href: "/account-breach", label: "Failed Evaluation", icon: AlertTriangle },
  ]},
  { id: "community", label: "Community", icon: Users, children: [
    { href: "/leaderboard", label: "Leaderboard", icon: Medal },
    { href: "/competitions", label: "Competitions", icon: Trophy },
    { href: "/referrals", label: "Referrals", icon: Share2 },
  ]},
  { id: "support", label: "Support", icon: LifeBuoy, children: [
    { href: "/support", label: "Support Tickets", icon: MessageCircle, activePrefixes: ["/ticket-detail"] },
    { href: "/help-center", label: "Help Center", icon: HelpCircle },
    { href: "/risk-consultation", label: "Risk Consultation", icon: CalendarCheck },
    { href: "/terms", label: "Terms & Policies", icon: ScrollText },
  ]},
  { id: "account", label: "Account", icon: Settings, children: [
    { href: "/account-settings", label: "Account Settings", icon: Settings, activePrefixes: ["/profile-security", "/2fa-setup", "/sessions", "/api-tokens"] },
    { href: "/trading-credentials", label: "Trading Credentials", icon: KeyRound },
    { href: "/notification-center", label: "Notifications", icon: Bell, activePrefixes: ["/notification-preferences"] },
  ]},
];

/* ------------------------------------------------------------------ */
/* Active matching                                                     */
/* ------------------------------------------------------------------ */

function matches(pathname: string, href: string, prefixes?: string[]): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  return (prefixes ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const nav = (
    <>
      {/* App label header */}
      <div
        className={cn(
          "flex h-12 items-center justify-between border-b border-sidebar-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            Trader Dashboard
          </span>
        )}
        {!collapsed && <span className="text-[9px] font-bold text-sidebar-foreground/70">v1.0</span>}
      </div>

      {/* Brand block */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border px-3 py-3",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          {terraTenant.branding.initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-headline text-sm font-semibold text-sidebar-foreground">
              {terraTenant.branding.name}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">
              {terraTenant.branding.tagline}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {directItems.map((item) => {
            const Icon = item.icon;
            const active = matches(pathname, item.href, item.activePrefixes);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                    )}
                  />
                  {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                </Link>
              </li>
            );
          })}

          {sections.map((section) => (
            <SectionItem
              key={section.id}
              section={section}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onClose}
              onExpand={() => setCollapsed(false)}
            />
          ))}
        </ul>
      </nav>

      {/* Footer: user + collapse */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            {terraUser.initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{terraUser.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/70">Pro Trader</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay (kept as a navigation aid — matches trader UX, not prop-admin) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200",
          "lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-14",
        )}
        aria-label="Primary navigation"
      >
        {nav}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsible section                                                 */
/* ------------------------------------------------------------------ */

function SectionItem({
  section,
  pathname,
  collapsed,
  onNavigate,
  onExpand,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onExpand?: () => void;
}) {
  const active = section.children.some((c) => matches(pathname, c.href, c.activePrefixes));
  const [open, setOpen] = useState(Boolean(section.defaultOpen));

  // Force-open when the active route lives inside this section.
  const show = open || active;

  if (collapsed) {
    const Icon = section.icon;
    return (
      <li>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onExpand?.();
          }}
          title={section.label}
          className={cn(
            "group flex w-full items-center justify-center rounded-md py-2 transition-colors",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </li>
    );
  }

  const SectionIcon = section.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={show}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
        )}
      >
        <SectionIcon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-sidebar-primary-foreground opacity-100" : "opacity-70 group-hover:opacity-100",
          )}
        />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronRight
          className={cn("h-3.5 w-3.5 opacity-50 transition-transform", show && "rotate-90", active && "opacity-100")}
        />
      </button>
      {show && (
        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
          {section.children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = matches(pathname, child.href, child.activePrefixes);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    childActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <ChildIcon className={cn("h-3.5 w-3.5 shrink-0", childActive ? "text-sidebar-primary-foreground" : "opacity-60")} />
                  <span className="flex-1 truncate text-left">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
