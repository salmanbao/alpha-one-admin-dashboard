"use client";

/**
 * PFaaS Platform — Global Search Dialog
 * 
 * Spec section 38 + docs/21 CON-29 (console shell). The console is a
 * different realm from the tenant admin: what an operator can open from
 * search is *console* views — tenants, platform config screens, audit
 * screens, cross-tenant queues. The previous revision was copied from
 * prop-admin and indexed tenant-realm destinations (29 of 29 hits dead).
 * 
 * Search groups now:
 *   - Tenants            → tenant-detail
 *   - Cross-tenant data  → tenant-detail / cross-tenant-queues /
 *                          platform-transactions / platform-analytics
 *                          (entities are observable, but the console has
 *                          no tenant-realm pages, so hits land on the
 *                          closest console workspace)
 *   - Fleet              → benchmarking, lifecycle, health, view-as,
 *                          offboarding, tenant-sessions — the six fleet
 *                          views linked from the Tenants screen,
 *                          registered all-or-none (never just one)
 *   - Settings           → global-defaults, reference-data, challenge-programs, feature-flags…
 *   - Audit              → platform-audit → audit-log → model-audit-log
 */ 
 
import { useMemo, useState } from "react";
import { Target as TargetIcon, ChevronRight } from "lucide-react";
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
import { resolveTermsInString } from "@/lib/platform/terminology";
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
  tenants as allTenants,
} from "@/lib/platform/mock-data";
import { viewRegistry } from "@/lib/platform/view-router";

interface SearchHit {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  navigateTo: string;
  navigateParams?: Record<string, string>;
}

/* Static settings entries — the console's configuration surfaces. When a
 * config screen is added or removed, update this list to match.
 */
const SETTINGS_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
}> = [
  { id: "general", label: "Global Defaults", description: "Platform-wide defaults: currency, locale, branding", icon: SettingsIcon, viewId: "global-defaults" },
  { id: "reference-data", label: "Reference Data", description: "Countries, currencies, and shared lookup data", icon: SettingsIcon, viewId: "reference-data" },
  { id: "challenge-programs", label: "Challenge Programs", description: "Challenge phase configurations and minimum trading days", icon: TargetIcon, viewId: "challenge-programs" },
  { id: "modules", label: "Module Catalog", description: "Platform service catalog and entitlements", icon: Plug, viewId: "module-catalog" },
  { id: "feature-flags", label: "Feature Flags", description: "Global kill switches and gradual rollouts", icon: Flag, viewId: "feature-flags" },
  { id: "provider-incident-runbook", label: "Provider Incident Runbook", description: "Rapid response workflow for provider outages affecting payouts", icon: AlertTriangle, viewId: "provider-incident-runbook" },
  { id: "dashboards", label: "Dashboard Manager", description: "Operator dashboard layouts and widgets", icon: SettingsIcon, viewId: "dashboard-manager" },
  { id: "operators", label: "Operator Directory", description: "Console operators and their role assignments", icon: UsersRound, viewId: "operator-directory" },
  { id: "roles", label: "Role Management", description: "platform:* role definitions and permissions", icon: KeyRound, viewId: "role-management" },
  { id: "sessions", label: "My Sessions", description: "Active console sessions and revocation", icon: Fingerprint, viewId: "my-sessions" },
  { id: "announcements", label: "Announcements", description: "Operator-facing platform announcements", icon: Bell, viewId: "announcements" },
  { id: "plans", label: "Plans & Subscriptions", description: "Pricing tiers, feature entitlements, limits, and trials", icon: CreditCard, viewId: "plans" },
];

/* Operation entries — Cmd+K reachable console workspace views.
 * In R26 P1-3, system-health was added as the first new entry;
 * this round adds the cross-tenant-queues entry.
 */
const OPERATION_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
}> = [
  { id: "operations", label: "Operations Home", description: "Platform operations console — service health, operational signals, and attention items", icon: Activity, viewId: "platform-operations" },
  { id: "emergency-controls", label: "Emergency Controls", description: "Tenant halt, maintenance mode, relay pause, kill switches", icon: ShieldAlert, viewId: "emergency-controls" },
  { id: "incidents", label: "Incidents", description: "Cross-tenant incident lifecycle and audit trail", icon: AlertTriangle, viewId: "incident-center" },
  { id: "jobs-dashboard", label: "Jobs Dashboard", description: "Background job runs, failures, retries, and lock state", icon: Zap, viewId: "jobs-dashboard" },
  { id: "approval-center", label: "Approval Center", description: "Two-operator pending approvals and blast-radius review", icon: ShieldCheck, viewId: "approval-center" },
  { id: "support-assist", label: "Support Assist", description: "Cross-tenant support ticket management", icon: LifeBuoy, viewId: "support-assist" },
  { id: "provider-registry", label: "Provider Registry", description: "Payment, KYC, and broker provider connections", icon: Plug, viewId: "provider-registry" },
  { id: "system-health", label: "System Health", description: "Per-service platform status: uptime, latency, heartbeat, incidents", icon: Server, viewId: "system-health" },
  { id: "queues", label: "Cross-Tenant Queues", description: "Per-tenant KYC, risk, payout and support backlog with aging", icon: Building2, viewId: "cross-tenant-queues" },
];

/* Fleet views — the cross-tenant workspace family linked from
 * the Tenants screen's \"Fleet views\" row (registered all-or-none, P2-6).
 */
const FLEET_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
}> = [
  { id: "benchmarking", label: "Tenant Benchmarking", description: "Cohort metrics vs industry benchmarks and plan-tier targets", icon: BarChart3, viewId: "tenant-benchmarking" },
  { id: "lifecycle", label: "Tenant Lifecycle", description: "Provisioning stage pipeline across the fleet", icon: GitBranch, viewId: "tenant-lifecycle" },
  { id: "health", label: "Tenant Health", description: "Health scores and risk signals for every tenant", icon: HeartPulse, viewId: "tenant-health" },
  { id: "view-as", label: "Tenant View-As", description: "Impersonate a tenant user to reproduce what they see", icon: Eye, viewId: "tenant-view-as" },
  { id: "offboarding", label: "Tenant Offboarding", description: "Offboarding runs and data-retention steps", icon: Package, viewId: "tenant-offboarding" },
  { id: "tenant-sessions", label: "Tenant Sessions", description: "Per-tenant user sessions with activity indicators", icon: Fingerprint, viewId: "tenant-sessions" },
];

/* Audit entries */
const AUDIT_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
}> = [
  { id: "platform-audit", label: "Platform Audit", description: "Cross-tenant audit trail of console actions", icon: History, viewId: "platform-audit" },
  { id: "audit-log", label: "Audit Log", description: "Event stream with actor, IP, and resource filters", icon: History, viewId: "audit-log" },
  { id: "model-audit-log", label: "Model Audit Log", description: "Per-field change history with rollback context", icon: GitBranch, viewId: "model-audit-log" },
];

export function GlobalSearchDialog() {
  const { searchOpen, setSearchOpen, runtime, navigate, tenant } = usePlatform();
  const [query, setQuery] = useState("");
  const tid = runtime.tenant?.id ?? "platform";

  const hits = useMemo<SearchHit[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const out: SearchHit[] = [];

    // Tenants — the console's primary entity
    for (const t of allTenants) {
      if (`${t.name} ${t.plan} ${t.status}`.toLowerCase().includes(q)) {
        out.push({
          id: `tenant-${t.id}`,
          label: t.name,
          description: `${t.plan} plan · ${t.status} · ${t.currency}`,
          icon: Building2,
          group: "Tenants",
          ...tenantTarget(t.id),
        });
      }
    }

    // Traders (cross-tenant observability) → the trader's owning tenant
    for (const t of getTenantTraders(tid)) {
      if (`${t.name} ${t.email} ${t.country}`.toLowerCase().includes(q)) {
        out.push({
          id: `trader-${t.id}`,
          label: t.name,
          description: `${t.email} · ${t.country} · ${t.status}`,
          icon: Users,
          group: "Traders",
          ...tenantTarget(t.tenantId),
        });
      }
    }

    // Accounts → cross-tenant operations queues
    for (const a of getTenantAccounts(tid).slice(0, 30)) {
      if (`${a.login} ${a.traderName} ${a.platform}`.toLowerCase().includes(q)) {
        out.push({
          id: `acct-${a.id}`,
          label: `Account ${a.login}`,
          description: `${a.traderName} · ${a.platform} · ${a.phase}`,
          icon: CreditCard,
          group: "Accounts",
          navigateTo: "cross-tenant-queues",
        });
      }
    }

    // Challenges → cross-tenant operations queues
    for (const c of getTenantChallenges(tid)) {
      if (`${c.traderName} ${c.name} ${c.phase}`.toLowerCase().includes(q)) {
        out.push({
          id: `chal-${c.id}`,
          label: c.name,
          description: `${c.traderName} · ${c.phase} · ${c.progressPct}%`,
          icon: TargetIcon,
          group: "Challenges",
          navigateTo: "cross-tenant-queues",
        });
      }
    }

    // Payouts → platform financials
    for (const p of getTenantPayouts(tid)) {
      if (`${p.reference} ${p.traderName} ${p.method} ${p.status}`.toLowerCase().includes(q)) {
        out.push({
          id: `pay-${p.id}`,
          label: p.reference,
          description: `${p.traderName} · ${p.amount} ${p.currency} · ${p.status}`,
          icon: Wallet,
          group: "Payouts",
          navigateTo: "platform-transactions",
        });
      }
    }

    // Affiliates → owning tenant
    for (const a of getTenantAffiliates(tid)) {
      if (`${a.name} ${a.code} ${a.tier}`.toLowerCase().includes(q)) {
        out.push({
          id: `aff-${a.id}`,
          label: a.name,
          description: `${a.code} · ${a.tier} tier · ${a.referrals} referrals`,
          icon: Megaphone,
          group: "Affiliates",
          ...tenantTarget(tid),
        });
      }
    }

    // Transactions → platform transactions ledger
    for (const t of getTenantTransactions(tid).slice(0, 30)) {
      if (`${t.reference} ${t.description} ${t.type} ${t.category}`.toLowerCase().includes(q)) {
        out.push({
          id: `txn-${t.id}`,
          label: t.reference,
          description: `${t.description} · ${t.amount} ${t.currency}`,
          icon: Receipt,
          group: "Transactions",
          navigateTo: "platform-transactions",
        });
      }
    }

    // Support tickets → support-assist
    for (const t of getTenantTickets(tid)) {
      if (`${t.subject} ${t.traderName} ${t.category}`.toLowerCase().includes(q)) {
        out.push({
          id: `tkt-${t.id}`,
          label: t.subject,
          description: `${t.traderName} · ${t.priority} · ${t.status}`,
          icon: LifeBuoy,
          group: "Support Tickets",
          navigateTo: "support-assist",
        });
      }
    }

    // KYC records → cross-tenant operations queues (compliance queue)
    for (const k of getTenantKyc(tid).slice(0, 20)) {
      if (`${k.traderName} ${k.documentType} ${k.country} ${k.status}`.toLowerCase().includes(q)) {
        out.push({
          id: `kyc-${k.id}`,
          label: k.traderName,
          description: `${k.documentType} · ${k.country} · ${k.status}`,
          icon: ShieldCheck,
          group: "KYC Records",
          navigateTo: "cross-tenant-queues",
        });
      }
    }

    // Settings — index all console config screens
    for (const s of SETTINGS_ENTRIES) {
      if (`${s.label} ${s.description} settings`.toLowerCase().includes(q)) {
        out.push({
          id: `setting-${s.id}`,
          label: s.label,
          description: `${s.description} · Settings`,
          icon: s.icon,
          group: "Settings",
          navigateTo: s.viewId,
        });
      }
    }

    // Fleet views — the cross-tenant workspace family linked from
    // the Tenants screen's \"Fleet views\" row (registered all-or-none, P2-6).
    for (const f of FLEET_ENTRIES) {
      if (`${f.label} ${f.description} fleet`.toLowerCase().includes(q)) {
        out.push({
          id: `fleet-${f.id}`,
          label: f.label,
          description: `${f.description} · Fleet`,
          icon: f.icon,
          group: "Fleet",
          navigateTo: f.viewId,
        });
      }
    }

    // Audit — index the audit chain
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
          navigateTo: "platform-analytics",
        });
      }
    }

    // Safety net: only surface hits whose destination is a registered
    // console view (the old module-enabled filter checked *tenant*
    // modules, which never match platform-realm routes).
    const registered = out.filter((h) => Boolean(viewRegistry[h.navigateTo]));

    // Sort by relevance (label match first, then description match)
    return registered.sort((a, b) => {
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
    <CommandDialog open={searchOpen} onOpenChange={(o) => {
      setSearchOpen(o);
      if (!o) setQuery("");
    }}>
      <CommandInput
        placeholder={resolveTermsInString("Search tenants, settings, audit…", tenant)}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim() ? `No results for "${query}"` : "Start typing to search tenants, config screens, and audit…"}
        </CommandEmpty>
        {grouped.map(([group, items]) => (
          <CommandGroup key={group} heading={`${resolveTermsInString(group, tenant)} (${items.length})`}>
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
                {hits.length} result{hits.length !== 1 ? "s" : ""} across {grouped.length} categories
              </span>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}