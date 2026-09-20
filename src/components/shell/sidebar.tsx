"use client";

/**
 * PFaaS Platform — Dynamic Sidebar
 *
 * Spec sections 9, 17, 18, 48. Sidebar is generated dynamically from
 * the module registry navigation engine. Supports collapse, mobile sheet,
 * section grouping, active highlighting.
 */

import { useMemo, useState } from "react";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveNavigation, type ResolvedNavigation } from "@/lib/platform/navigation-engine";
import { makeTermResolver, type TermKey } from "@/lib/platform/terminology";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

type TermFn = (k: string) => string;

export function Sidebar() {
  const { runtime, router, navigate, sidebarCollapsed, setSidebarCollapsed, tenant, user } = usePlatform();
  const t = makeTermResolver(tenant);
  const items = useMemo(() => resolveNavigation(runtime), [runtime]);

  if (sidebarCollapsed) {
    return (
      <aside className="hidden h-full w-14 shrink-0 flex-col items-center gap-2 border-r bg-sidebar py-3 md:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        {items.slice(0, 10).map((item) => {
          const Icon = item.icon;
          const active = router.view === item.effectiveHref;
          return (
            <Button
              key={item.id}
              variant={active ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => item.effectiveHref && navigate(item.effectiveHref)}
              title={item.label}
            >
              {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs">{item.label.slice(0, 1)}</span>}
            </Button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <SidebarHeader />
      <SidebarBrand tenantName={tenant.branding.name} tagline={tenant.branding.tagline} initials={tenant.branding.initials} primaryColor={tenant.branding.primaryColor} />
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <SidebarItem key={item.id} item={item} t={t} />
          ))}
        </ul>
      </nav>
      <SidebarFooter userName={user.name} userEmail={user.email} userInitials={user.initials} roleName={user.roles[0]} onCollapse={() => setSidebarCollapsed(true)} />
    </aside>
  );
}

function SidebarHeader() {
  const { user } = usePlatform();
  const appLabel =
    user.application === "super-admin" ? "Super Admin" :
    user.application === "trader" ? "Trader" : "Prop Firm Admin";
  return (
    <div className="flex h-12 items-center justify-between border-b px-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {appLabel}
      </span>
      <Badge variant="outline" className="text-[9px]">v1.0</Badge>
    </div>
  );
}

function SidebarBrand({
  tenantName,
  tagline,
  initials,
  primaryColor,
}: {
  tenantName: string;
  tagline?: string;
  initials: string;
  primaryColor: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-3 py-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-white"
        style={{ background: primaryColor }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">{tenantName}</p>
        {tagline ? (
          <p className="truncate text-[11px] text-muted-foreground">{tagline}</p>
        ) : null}
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  t,
}: {
  item: ResolvedNavigation[number];
  t: TermFn;
}) {
  const { router, navigate } = usePlatform();
  const [open, setOpen] = useState(true);
  const active = router.view === item.effectiveHref ||
    (item.children?.some((c) => router.view === c.href) ?? false);
  const Icon = item.icon;

  if (item.isSection) {
    return (
      <li>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              {Icon ? (
                <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
              ) : null}
              <span className="flex-1 text-left">{item.termKey ? t(item.termKey ?? "") : item.label}</span>
              {item.badge ? (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">{item.badge}</Badge>
              ) : null}
              <ChevronRight className={cn("h-3.5 w-3.5 opacity-50 transition-transform", open && "rotate-90", active && "opacity-100")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
              {item.children?.map((c) => {
                const CIcon = c.icon;
                const cActive = router.view === c.href;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => c.href && navigate(c.href)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        cActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      {CIcon ? <CIcon className="h-3.5 w-3.5" /> : <span className="h-1 w-1 rounded-full bg-current opacity-60" />}
                      <span className="flex-1 text-left">{c.label}</span>
                      {c.badge ? (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">{c.badge}</Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => item.effectiveHref && navigate(item.effectiveHref)}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        {active ? (
          <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-sidebar-primary-foreground" />
        ) : null}
        {Icon ? (
          <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
        )}
        <span className="flex-1 truncate text-left">{item.termKey ? t(item.termKey ?? "") : item.label}</span>
        {item.badge ? (
          <Badge variant={active ? "secondary" : "outline"} className="h-4 px-1 text-[9px]">{item.badge}</Badge>
        ) : null}
      </button>
    </li>
  );
}

function SidebarFooter({
  userName,
  userEmail,
  userInitials,
  roleName,
  onCollapse,
}: {
  userName: string;
  userEmail: string;
  userInitials: string;
  roleName?: string;
  onCollapse: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t px-2 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {userInitials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-sidebar-foreground">{userName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{roleName ? roleName.replace("-", " ") : userEmail}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse} aria-label="Collapse sidebar">
        <PanelLeftClose className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
