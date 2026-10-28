"use client";

/**
 * Terra Trader — Command Palette (⌘K / Ctrl+K)
 *
 * Global fuzzy-search palette over the trader's navigation, quick
 * actions, trading accounts and theme. The ⌘K keypress itself is
 * handled by the platform context (PlatformProvider) which owns the
 * `commandOpen` state — this component just renders the dialog and
 * the action list.
 *
 * Groups:
 *   • Navigation  — every sidebar entry (direct + section children),
 *     labeled "Section › Page" so fuzzy match works from either side
 *   • Quick actions — order ticket, payout, statement, theme toggle
 *   • Accounts    — switch the active trading account (same source of
 *     truth as the header switcher) with toast confirmation
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePlatform } from "@pfaas/platform-core";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { directItems, sections } from "./sidebar";
import { useActiveAccount } from "@/lib/platform/account-context";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  FileSpreadsheet,
  Moon,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";

interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  /** Extra words that should match in fuzzy search. */
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ onToggleTheme, dark }: { onToggleTheme: () => void; dark: boolean }) {
  const router = useRouter();
  const { commandOpen, setCommandOpen } = usePlatform();
  const { accounts, activeAccountId, setActiveAccountId } = useActiveAccount();

  const actions = useMemo<PaletteAction[]>(() => {
    const go = (href: string) => () => {
      setCommandOpen(false);
      router.push(href);
    };

    const out: PaletteAction[] = [];

    // Navigation — direct items first, then section children.
    for (const item of directItems) {
      out.push({
        id: `nav-${item.href}`,
        label: item.label,
        group: "Navigation",
        icon: item.icon,
        keywords: item.href,
        run: go(item.href),
      });
    }
    for (const section of sections) {
      for (const child of section.children) {
        out.push({
          id: `nav-${child.href}`,
          label: `${section.label} › ${child.label}`,
          group: "Navigation",
          icon: child.icon,
          keywords: `${child.href} ${section.label}`,
          run: go(child.href),
        });
      }
    }

    // Quick actions — the moves traders make most.
    out.push(
      {
        id: "qa-order",
        label: "Place a new order",
        group: "Quick actions",
        icon: ArrowLeftRight,
        keywords: "trade ticket buy sell",
        run: go("/order-ticket"),
      },
      {
        id: "qa-payout",
        label: "Request a payout",
        group: "Quick actions",
        icon: ArrowDownToLine,
        keywords: "withdraw money",
        run: go("/payout-request"),
      },
      {
        id: "qa-statement",
        label: "View account statement",
        group: "Quick actions",
        icon: FileSpreadsheet,
        keywords: "balance pdf",
        run: go("/account-statement"),
      },
      {
        id: "qa-theme",
        label: `Switch to ${dark ? "light" : "dark"} mode`,
        group: "Quick actions",
        icon: dark ? Sun : Moon,
        run: () => {
          setCommandOpen(false);
          onToggleTheme();
        },
      },
    );

    // Accounts — same source of truth as the header switcher.
    for (const acc of accounts) {
      out.push({
        id: `acc-${acc.id}`,
        label: `Switch account → #${acc.login} · ${acc.name}`,
        group: "Accounts",
        icon: Wallet,
        keywords: `${acc.login} ${acc.program} ${acc.phase}`,
        run: () => {
          setCommandOpen(false);
          setActiveAccountId(acc.id);
          toast({
            title: "Active account switched",
            description: `#${acc.login} · ${acc.name} (${acc.phase})`,
          });
        },
      });
    }

    return out;
  }, [accounts, dark, onToggleTheme, router, setActiveAccountId, setCommandOpen]);

  // Group in display order (Map preserves insertion order).
  const groups = useMemo(() => {
    const map = new Map<string, PaletteAction[]>();
    for (const a of actions) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return Array.from(map.entries());
  }, [actions]);

  // Mark the active account's row for a subtle highlight via keywords.
  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      title="Command palette"
      description="Search pages, actions and trading accounts"
    >
      <CommandInput placeholder="Search pages, actions, accounts… (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map(([group, list]) => (
          <CommandGroup key={group} heading={group}>
            {list.map((a) => {
              const Icon = a.icon;
              const isActiveAccount = a.id === `acc-${activeAccountId}`;
              return (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.keywords ?? ""} ${group}`}
                  onSelect={a.run}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{a.label}</span>
                  {isActiveAccount && (
                    <kbd className="rounded border bg-muted px-1.5 text-[10px] font-bold">
                      active
                    </kbd>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem value="tips navigate escape close" disabled>
            <span className="text-muted-foreground text-xs">
              ↑↓ to navigate · Enter to run · Esc to close
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
