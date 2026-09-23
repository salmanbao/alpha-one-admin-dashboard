"use client";

/**
 * PFaaS Platform — Global Search Dialog
 *
 * Spec section 38. Cross-entity search across traders, accounts,
 * challenges, payouts, affiliates, transactions, tickets, KYC records.
 * Modules register searchable entities; this dialog queries them.
 *
 * Additionally indexes Settings sections, Audit pages, and AI insights
 * (impl-shell-settings) so the global search is the universal entry
 * point for both data and configuration.
 */

import { useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantChallenges,
  getTenantPayouts,
  getTenantAffiliates,
  getTenantTransactions,
  getTenantTickets,
  getTenantKyc,
  getTenantAiInsights,
} from "@/lib/platform/mock-data";
import {
  Users,
  CreditCard,
  Target,
  Wallet,
  Megaphone,
  Receipt,
  LifeBuoy,
  ShieldCheck,
  ChevronRight,
  Settings as SettingsIcon,
  Palette,
  Type,
  Image,
  Plug,
  Share2,
  UsersRound,
  KeyRound,
  Fingerprint,
  Mail,
  Bell,
  Award,
  Wrench,
  History,
  Sparkles,
  GitBranch,
  Brain,
} from "lucide-react";

interface SearchHit {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  navigateTo: string;
  navigateParams?: Record<string, string>;
}

/**
 * Static settings entries — mirrors the 19 cards on the Settings
 * Overview landing grid (`settings-page.tsx`). When a settings page
 * is added or removed, update this list to match.
 */
const SETTINGS_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
  tab?: string;
}> = [
  // Branding
  { id: "branding", label: "Branding Presets", description: "Color presets, primary/accent colors, radius", icon: Palette, viewId: "settings", tab: "branding" },
  { id: "terminology", label: "Terminology", description: "White-label business terms", icon: Type, viewId: "settings", tab: "terminology" },
  { id: "banners", label: "Banner Management", description: "Site-wide promotional banners", icon: Image, viewId: "banner-management" },
  { id: "mkt-integrations", label: "Marketing Integrations", description: "Marketing platforms and ad networks", icon: Plug, viewId: "marketing-integrations" },
  { id: "social-media", label: "Social Media Links", description: "Footer social links and channels", icon: Share2, viewId: "social-media-links" },
  // Security
  { id: "users", label: "User Management", description: "Tenant users and role assignments", icon: UsersRound, viewId: "user-management" },
  { id: "tokens", label: "API Tokens", description: "Long-lived API tokens with rotation", icon: KeyRound, viewId: "token-management" },
  { id: "device-activities", label: "Device Activities", description: "Login device fingerprinting", icon: Fingerprint, viewId: "device-activities" },
  // Communications
  { id: "email-templates", label: "Email Templates", description: "Transactional and marketing templates", icon: Mail, viewId: "email-templates" },
  { id: "notifications-mgmt", label: "Notifications Management", description: "Notification types, channels, triggers", icon: Bell, viewId: "notifications-management" },
  // Certificates
  { id: "certificates", label: "Certificate Management", description: "Issued certificate templates", icon: Award, viewId: "certificate-management" },
  { id: "cert-designer", label: "Certificate Designer", description: "Visual designer for certificate layouts", icon: Palette, viewId: "certificate-template-designer" },
  { id: "font-upload", label: "Font Upload", description: "Upload custom fonts for certificates", icon: Type, viewId: "certificate-font-upload" },
  { id: "cert-issued", label: "Issued Certificates", description: "Search and revoke issued certificates", icon: Award, viewId: "certificates-issued" },
  // System
  { id: "general", label: "General Settings", description: "Tenant name, currency, timezone", icon: SettingsIcon, viewId: "settings", tab: "general" },
  { id: "modules", label: "Modules", description: "Toggle tenant entitlements", icon: SettingsIcon, viewId: "settings", tab: "modules" },
  { id: "roles", label: "Roles & Permissions", description: "RBAC role definitions", icon: Users, viewId: "settings", tab: "roles" },
  { id: "notifications", label: "Notifications Matrix", description: "Per-module notification preferences", icon: Bell, viewId: "settings", tab: "notifications" },
  { id: "utilities", label: "Utilities", description: "Bulk export, cache, diagnostics", icon: Wrench, viewId: "utilities" },
];

const AUDIT_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
}> = [
  { id: "audit-log", label: "Audit Log", description: "Cross-module audit trail of admin actions", icon: History, viewId: "audit" },
  { id: "audit-user-events", label: "User Events", description: "Per-user event stream with filters", icon: Users, viewId: "audit-user-events" },
  { id: "audit-enhanced-events", label: "Enhanced Events", description: "Event stream with metric snapshots", icon: Sparkles, viewId: "audit-user-events-enhanced" },
  { id: "audit-change-history", label: "Change History", description: "Per-field change log with rollback", icon: GitBranch, viewId: "audit-change-history" },
];

export function GlobalSearchDialog() {
  const { searchOpen, setSearchOpen, runtime, navigate, setTenant } = usePlatform();
  const [query, setQuery] = useState("");
  const tid = runtime.tenant?.id ?? "platform";

  const hits = useMemo<SearchHit[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const out: SearchHit[] = [];

    // Traders
    for (const t of getTenantTraders(tid)) {
      if (`${t.name} ${t.email} ${t.country}`.toLowerCase().includes(q)) {
        out.push({
          id: `trader-${t.id}`,
          label: t.name,
          description: `${t.email} · ${t.country} · ${t.status}`,
          icon: Users,
          group: "Traders",
          navigateTo: "trader-detail",
          navigateParams: { id: t.id },
        });
      }
    }

    // Accounts
    for (const a of getTenantAccounts(tid).slice(0, 30)) {
      if (`${a.login} ${a.traderName} ${a.platform}`.toLowerCase().includes(q)) {
        out.push({
          id: `acct-${a.id}`,
          label: `Account ${a.login}`,
          description: `${a.traderName} · ${a.platform} · ${a.phase}`,
          icon: CreditCard,
          group: "Accounts",
          navigateTo: "trading-accounts",
        });
      }
    }

    // Challenges
    for (const c of getTenantChallenges(tid)) {
      if (`${c.traderName} ${c.name} ${c.phase}`.toLowerCase().includes(q)) {
        out.push({
          id: `chal-${c.id}`,
          label: c.name,
          description: `${c.traderName} · ${c.phase} · ${c.progressPct}%`,
          icon: Target,
          group: "Challenges",
          navigateTo: "challenges",
        });
      }
    }

    // Payouts
    for (const p of getTenantPayouts(tid)) {
      if (`${p.reference} ${p.traderName} ${p.method} ${p.status}`.toLowerCase().includes(q)) {
        out.push({
          id: `pay-${p.id}`,
          label: p.reference,
          description: `${p.traderName} · ${p.amount} ${p.currency} · ${p.status}`,
          icon: Wallet,
          group: "Payouts",
          navigateTo: "payouts",
        });
      }
    }

    // Affiliates
    for (const a of getTenantAffiliates(tid)) {
      if (`${a.name} ${a.code} ${a.tier}`.toLowerCase().includes(q)) {
        out.push({
          id: `aff-${a.id}`,
          label: a.name,
          description: `${a.code} · ${a.tier} tier · ${a.referrals} referrals`,
          icon: Megaphone,
          group: "Affiliates",
          navigateTo: "affiliates-list",
        });
      }
    }

    // Transactions
    for (const t of getTenantTransactions(tid).slice(0, 30)) {
      if (`${t.reference} ${t.description} ${t.type} ${t.category}`.toLowerCase().includes(q)) {
        out.push({
          id: `txn-${t.id}`,
          label: t.reference,
          description: `${t.description} · ${t.amount} ${t.currency}`,
          icon: Receipt,
          group: "Transactions",
          navigateTo: "accounting-transactions",
        });
      }
    }

    // Support tickets
    for (const t of getTenantTickets(tid)) {
      if (`${t.subject} ${t.traderName} ${t.category}`.toLowerCase().includes(q)) {
        out.push({
          id: `tkt-${t.id}`,
          label: t.subject,
          description: `${t.traderName} · ${t.priority} · ${t.status}`,
          icon: LifeBuoy,
          group: "Support Tickets",
          navigateTo: "support-tickets",
        });
      }
    }

    // KYC records
    for (const k of getTenantKyc(tid).slice(0, 20)) {
      if (`${k.traderName} ${k.documentType} ${k.country} ${k.status}`.toLowerCase().includes(q)) {
        out.push({
          id: `kyc-${k.id}`,
          label: k.traderName,
          description: `${k.documentType} · ${k.country} · ${k.status}`,
          icon: ShieldCheck,
          group: "KYC Records",
          navigateTo: "kyc-reviews",
        });
      }
    }

    // Settings — index all 19 settings sections
    for (const s of SETTINGS_ENTRIES) {
      if (`${s.label} ${s.description} settings`.toLowerCase().includes(q)) {
        out.push({
          id: `setting-${s.id}`,
          label: s.label,
          description: `${s.description} · Settings`,
          icon: s.icon,
          group: "Settings",
          navigateTo: s.viewId,
          navigateParams: s.tab ? { tab: s.tab } : undefined,
        });
      }
    }

    // Audit — index the 4 audit pages
    for (const a of AUDIT_ENTRIES) {
      if (`${a.label} ${a.description} audit`.toLowerCase().includes(q)) {
        out.push({
          id: `audit-${a.id}`,
          label: a.label,
          description: `${a.description} · Audit`,
          icon: a.icon,
          group: "Audit",
          navigateTo: a.viewId,
        });
      }
    }

    // AI insights — index up to 3 tenant insights
    const insights = getTenantAiInsights(tid).slice(0, 3);
    for (const ins of insights) {
      if (`${ins.title} ${ins.summary} ai insight`.toLowerCase().includes(q)) {
        out.push({
          id: `ai-${ins.id}`,
          label: ins.title,
          description: `${ins.summary} · AI Insight`,
          icon: Brain,
          group: "AI Insights",
          navigateTo: "ai-insights",
        });
      }
    }

    // Sort by relevance (label match first, then description match)
    return out.sort((a, b) => {
      const aLabel = a.label.toLowerCase().includes(q) ? 0 : 1;
      const bLabel = b.label.toLowerCase().includes(q) ? 0 : 1;
      if (aLabel !== bLabel) return aLabel - bLabel;
      return a.label.localeCompare(b.label);
    }).slice(0, 30);
  }, [query, tid]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      if (!map.has(h.group)) map.set(h.group, []);
      map.get(h.group)!.push(h);
    }
    return Array.from(map.entries());
  }, [hits]);

  const handleSelect = (hit: SearchHit) => {
    setSearchOpen(false);
    setQuery("");
    navigate(hit.navigateTo, hit.navigateParams);
  };

  return (
    <CommandDialog open={searchOpen} onOpenChange={(o) => { setSearchOpen(o); if (!o) setQuery(""); }}>
      <CommandInput
        placeholder="Search traders, accounts, payouts, settings, audit…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim() ? `No results for "${query}"` : "Start typing to search across all entities, settings, and audit…"}
        </CommandEmpty>
        {grouped.map(([group, items]) => (
          <CommandGroup key={group} heading={`${group} (${items.length})`}>
            {items.map((hit) => {
              const Icon = hit.icon;
              return (
                <CommandItem
                  key={hit.id}
                  value={`${hit.label} ${hit.description} ${hit.group}`}
                  onSelect={() => handleSelect(hit)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{hit.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{hit.description}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        {grouped.length > 0 ? <CommandSeparator /> : null}
        {query.trim() && hits.length > 0 ? (
          <CommandGroup heading="Summary">
            <CommandItem disabled>
              <span className="text-xs text-muted-foreground">
                {hits.length} result{hits.length !== 1 ? "s" : ""} across {grouped.length} categor{grouped.length !== 1 ? "ies" : "y"}
              </span>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
