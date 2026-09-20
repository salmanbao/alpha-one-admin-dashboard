"use client";

/**
 * PFaaS Platform — Global Search Dialog
 *
 * Spec section 38. Cross-entity search across traders, accounts,
 * challenges, payouts, affiliates, transactions, tickets, KYC records.
 * Modules register searchable entities; this dialog queries them.
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
        placeholder="Search traders, accounts, payouts, tickets…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim() ? `No results for "${query}"` : "Start typing to search across all entities…"}
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
