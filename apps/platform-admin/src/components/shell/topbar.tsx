"use client";

/**
 * PFaaS Platform — Topbar
 *
 * Spec section 9. Tenant switcher, role/user switcher, theme switcher,
 * global search trigger, notifications, user menu, command menu trigger.
 */

import {
  Bell,
  Check,
  ChevronDown,
  Command as CommandIcon,
  Moon,
  Search,
  Sun,
  Users as UsersIcon,
} from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUserSwitcher } from "@/lib/platform/platform-context";
import { users } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { ActivityTicker } from "@/components/shell/activity-ticker";
import { WhatsNewButton } from "@/components/shell/whats-new";
import { HelpDropdown } from "@/components/shell/help-dropdown";
import { toast } from "@/hooks/use-toast";

export function Topbar() {
  const {
    tenant,
    setTenant,
    availableTenants,
    runtime,
    themeMode,
    setThemeMode,
    notifications,
    markAllRead,
    markRead,
    setCommandOpen,
    setSearchOpen,
    navigate,
    user,
  } = usePlatform();
  const { switchUser } = useUserSwitcher();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Search — opens global search dialog. Mobile nav lives in the content
          area (MobileNav sheet); a second menu button here was a dead control. */}
      <button
        onClick={() => setSearchOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:max-w-sm"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">
          {/* Round 7: trader-specific search trigger copy — admin's
              "Search traders, accounts, settings" leaks trader terminology
              that's wrong context for Tom. */}
          {resolveTermsInString(
            "Search tenants, platform settings…",
            tenant,
          )}
        </span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          /
        </kbd>
      </button>

      {/* Activity ticker — auto-rotating live events */}
      <ActivityTicker />

      <div className="ml-auto flex items-center gap-1">
        {/* Tenant switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: tenant.branding.primaryColor }}
              />
              <span className="hidden max-w-[140px] truncate sm:inline">
                {tenant.id === "platform" ? "Platform" : tenant.name}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Switch tenant
            </DropdownMenuLabel>
            {availableTenants.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => {
                  setTenant(t);
                  // also switch user to a matching one if possible
                  // For platform pseudo-tenant, find super-admin users
                  const match = t.id === "platform"
                    ? users.find((u) => u.application === "super-admin")
                    : users.find((u) => u.tenantId === t.id && u.application === user.application);
                  if (match) switchUser(match);
                  // Leave tenant-scoped views behind: the current view may not
                  // exist (or mean something else) in the target tenant's context.
                  navigate("overview");
                }}
                className="gap-2"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.branding.primaryColor }} />
                <span className="flex-1 truncate">{t.id === "platform" ? "Platform (Super Admin)" : t.name}</span>
                {t.id === tenant.id ? <Check className="h-3 w-3" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] text-muted-foreground">
              {tenant.plan.toUpperCase()} plan · {tenant.currency} · {tenant.timezone}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Role/user switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2" aria-label="Switch user">
              <UsersIcon className="h-4 w-4" />
              <span className="hidden text-xs lg:inline">{user.roles[0]?.replace("-", " ")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Switch user (demo)
            </DropdownMenuLabel>
            {users.map((u) => (
              <DropdownMenuItem
                key={u.id}
                onClick={() => switchUser(u)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="flex w-full items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">{u.initials}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium">{u.name}</span>
                  {u.id === user.id ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="pl-8 text-[10px] text-muted-foreground">
                  {u.roles[0]?.replace("-", " ")} · {u.application}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* What's new */}
        <WhatsNewButton />

        {/* Help dropdown — architecture overview, keyboard shortcuts, etc. */}
        <HelpDropdown />

        {/* Theme switcher */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
        >
          {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 10).map((n) => {
                  // Only follow the deep-link if the destination view's owning
                  // module is enabled for this tenant — otherwise navigating
                  // would dead-end in a "module not enabled" ForbiddenState.
                  const viewModule = moduleRegistry
                    .getAll()
                    .flatMap((m) => (m.routes ?? []).map((r) => ({ viewId: r.viewId, moduleId: m.manifest.id })))
                    .find((r) => r.viewId === n.actionHref)?.moduleId;
                  const moduleEnabled =
                    !viewModule ||
                    moduleRegistry.getEnabledModules(runtime).some((m) => m.manifest.id === viewModule);
                  const dest = moduleEnabled ? n.actionHref : undefined;
                  return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (dest) navigate(dest);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b px-3 py-2 text-left transition-colors hover:bg-muted/60",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            n.severity === "critical" ? "var(--destructive)" :
                            n.severity === "warning" ? "#ea580c" :
                            n.severity === "success" ? "#16a34a" : "var(--brand-primary)",
                        }}
                      />
                      <span className="flex-1 text-xs font-medium text-foreground">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </button>
                  );
                })
              )}
            </div>
            <button
              onClick={() => navigate("notifications")}
              className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
            >
              <Bell className="h-3 w-3" /> View all in Notification Center
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Command menu */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Command menu"
          onClick={() => setCommandOpen(true)}
        >
          <CommandIcon className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="User menu">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-muted text-[10px] font-semibold">{user.initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <StatusBadge tone="info" className="text-[10px]">{user.application}</StatusBadge>
                {user.roles.map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px]">{r.replace("-", " ")}</Badge>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("profile")}>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "general" })}>Settings</DropdownMenuItem>
            {/* Round 7 fix: filter Audit log menu item by audit-module-enabled
                so tenants without the audit module don't dead-end into a
                ForbiddenState (mirrors Round 3's command-menu fix). */}
            {moduleRegistry.getEnabledModules(runtime).some((m) => m.manifest.id === "audit") && (
              <DropdownMenuItem onClick={() => navigate("audit")}>Audit log</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600"
              onClick={() =>
                toast({
                  title: "Signed out",
                  description: "Session terminated (demo)",
                })
              }
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
