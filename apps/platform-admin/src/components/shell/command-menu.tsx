"use client";

/**
 * PFaaS Platform — Command Menu (⌘K)
 *
 * Spec section 39. Module-driven global command palette.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { usePlatform, useUserSwitcher } from "@/lib/platform/platform-context";
import { resolveNavigation } from "@/lib/platform/navigation-engine";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { users as allUsers } from "@/lib/platform/mock-data";
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  Users,
  Building2,
  Package,
  Keyboard,
  History,
  Boxes,
} from "lucide-react";
import type { CommandAction } from "@/lib/platform/types";

export function CommandMenu() {
  const {
    commandOpen,
    setCommandOpen,
    runtime,
    navigate,
    setThemeMode,
    themeMode,
    user,
    availableTenants,
    setTenant,
  } = usePlatform();
  const { switchUser } = useUserSwitcher();
  const users = allUsers;

  // Build navigation-based actions
  const navItems = resolveNavigation(runtime);
  const enabledModules = moduleRegistry.getEnabledModules(runtime);

  const actions: CommandAction[] = (() => {
    const out: CommandAction[] = [];
    // navigate actions
    for (const item of navItems) {
      if (item.effectiveHref) {
        out.push({
          id: `nav-${item.id}`,
          label: item.label,
          group: "Navigation",
          icon: item.icon ?? LayoutDashboard,
          run: () => navigate(item.effectiveHref!),
        });
      }
      for (const c of item.children ?? []) {
        if (c.href) {
          out.push({
            id: `nav-${c.id}`,
            label: `${item.label} › ${c.label}`,
            group: "Navigation",
            icon: c.icon ?? item.icon,
            run: () => navigate(c.href!),
          });
        }
      }
    }
    // Audit sub-pages — explicit flat-labeled shortcuts so operators can
    // jump straight into the audit chain (platform-wide → event log →
    // model/change history) without walking the sidebar. The old targets
    // (`audit`, `audit-user-events`, `audit-user-events-enhanced`,
    // `audit-change-history`) were prop-admin view-ids that don't exist in
    // this console. `g a` is bound to `platform-analytics` by the
    // keyboard-shortcuts-help listener, so we leave the shortcut empty here
    // per the "only if not taken" rule.
    out.push(
      {
        id: "nav-platform-audit",
        label: "Platform Audit",
        group: "Navigation",
        icon: History,
        run: () => navigate("platform-audit"),
      },
      {
        id: "nav-audit-log",
        label: "Audit Log",
        group: "Navigation",
        icon: History,
        run: () => navigate("audit-log"),
      },
      {
        id: "nav-model-audit-log",
        label: "Model Audit Log (change history)",
        group: "Navigation",
        icon: History,
        run: () => navigate("model-audit-log"),
      },
    );
    // quick actions
    out.push(
      {
        id: "qa-dashboard",
        label: "Go to dashboard",
        group: "Quick actions",
        icon: LayoutDashboard,
        shortcut: "G D",
        run: () => navigate("super-overview"),
      },
      {
        id: "qa-settings",
        label: "Open settings",
        group: "Quick actions",
        icon: SettingsIcon,
        shortcut: "G S",
        run: () => navigate("global-defaults"),
      },
      {
        id: "qa-notifications",
        label: "View notifications",
        group: "Quick actions",
        icon: Bell,
        run: () => navigate("notifications"),
      },
      {
        id: "qa-audit",
        label: "View audit log",
        group: "Quick actions",
        run: () => navigate("platform-audit"),
      },
      {
        id: "qa-theme-toggle",
        label: `Toggle ${themeMode === "dark" ? "light" : "dark"} mode`,
        group: "Theme",
        icon: themeMode === "dark" ? Sun : Moon,
        run: () => setThemeMode(themeMode === "dark" ? "light" : "dark"),
      },
    );
    // tenant switching
    for (const t of availableTenants) {
      out.push({
        id: `tenant-${t.id}`,
        label: `Switch tenant → ${t.id === "platform" ? "Platform (Super Admin)" : t.name}`,
        group: "Tenants",
        icon: Building2,
        run: () => {
          setTenant(t);
          const match = t.id === "platform"
            ? users.find((u) => u.application === "super-admin")
            : users.find((u) => u.tenantId === t.id && u.application === user.application);
          if (match) switchUser(match);
          // Reset to overview — the current view may not exist in the target tenant
          navigate("super-overview");
        },
      });
    }
    // user switching (switchUser also syncs the tenant to match the user).
    // Console realm only — super-admin operators (docs/21 CON-01); other
    // applications' users have no sidebar entries here and rendered empty.
    for (const u of users.filter((u) => u.application === "super-admin")) {
      out.push({
        id: `user-${u.id}`,
        label: `Switch user → ${u.name} (${u.roles[0]})`,
        group: "Users",
        icon: Users,
        run: () => switchUser(u),
      });
    }
    // module management
    if (user.application === "super-admin") {
      out.push({
        id: "qa-modules",
        label: "Manage modules",
        group: "Quick actions",
        icon: Package,
        run: () => navigate("module-catalog"),
      });
    }
    // keyboard shortcuts help
    out.push({
      id: "qa-shortcuts",
      label: "Keyboard shortcuts",
      group: "Quick actions",
      icon: Keyboard,
      shortcut: "?",
      run: () => {
        const open = (window as unknown as { __openShortcutsHelp?: () => void }).__openShortcutsHelp;
        if (open) open();
      },
    });
    return out;
  })();

  const groups = (() => {
    const map = new Map<string, CommandAction[]>();
    for (const a of actions) {
      const g = a.group ?? "Actions";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return Array.from(map.entries());
  })();

  // Esc closes, handled by CommandDialog. Also support g+d style shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // simple "g" then next key — only when not typing
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "g") {
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === "d") navigate("super-overview");
          if (ev.key === "s") navigate("global-defaults");
          window.removeEventListener("keydown", onKey);
        };
        window.addEventListener("keydown", onKey, { once: true });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search actions, pages, tenants…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map(([group, acts]) => (
          <CommandGroup key={group} heading={group}>
            {acts.map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.keywords?.join(" ") ?? ""} ${group}`}
                  onSelect={() => {
                    a.run();
                    setCommandOpen(false);
                  }}
                >
                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                  <span className="flex-1">{a.label}</span>
                  {a.shortcut ? (
                    <kbd className="ml-2 rounded border bg-muted px-1.5 text-[10px]">{a.shortcut}</kbd>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem
            onSelect={() => {
              navigate("platform-architecture");
              setCommandOpen(false);
            }}
          >
            <Boxes className="mr-2 h-4 w-4" />
            Architecture overview
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
