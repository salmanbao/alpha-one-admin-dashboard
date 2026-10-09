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
import { makeTermResolver, resolveTermsInString, type TermKey } from "@/lib/platform/terminology";
import type { TenantContext } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

type TermFn = (k: TermKey) => string;

/**
 * Parse a navigation href that may include a query string (e.g.
 * `"settings?tab=branding"`) into the view id + params object expected by
 * `navigate(view, params)`. Lets sidebar items deep-link to a specific
 * tab/section without requiring a separate `params` field on
 * NavigationItem. Hrefs without `?` are passed through unchanged.
 */
function parseHref(href: string): { view: string; params?: Record<string, string> } {
  const qIdx = href.indexOf("?");
  if (qIdx === -1) return { view: href };
  const view = href.slice(0, qIdx);
  const params: Record<string, string> = {};
  const search = new URLSearchParams(href.slice(qIdx + 1));
  search.forEach((v, k) => { params[k] = v; });
  return { view, params: Object.keys(params).length ? params : undefined };
}

export function Sidebar() {
  const { runtime, router, navigate, sidebarCollapsed, setSidebarCollapsed, tenant, user } = usePlatform();
  const t = makeTermResolver(tenant);
  const items = useMemo(() => resolveNavigation(runtime), [runtime]);

  // Wrapper that accepts hrefs with optional `?key=value` query strings
  // (e.g. "settings?tab=branding") and forwards the parsed params to
  // navigate(view, params).
  const go = (href: string | undefined) => {
    if (!href) return;
    const { view, params } = parseHref(href);
    navigate(view, params);
  };

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r bg-sidebar py-3 lg:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        {items.slice(0, 10).map((item, idx) => {
          const Icon = item.icon;
          const active = router.view === item.effectiveHref;
          return (
            <Button
              key={`${item.id}-${idx}`}
              variant={active ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => go(item.effectiveHref)}
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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <SidebarHeader />
      <SidebarBrand tenantName={tenant.branding.name} tagline={tenant.branding.tagline} initials={tenant.branding.initials} primaryColor={tenant.branding.primaryColor} />
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {items.map((item, idx) => (
            <SidebarItem key={`${item.id}-${idx}`} item={item} t={t} tenant={tenant} />
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
    "Super Admin";
  return (
    <div className="flex h-12 items-center justify-between border-b px-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {appLabel}
      </span>
      <Badge variant="outline" className="text-[9px]">v1.8.0</Badge>
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
  tenant,
}: {
  item: ResolvedNavigation;
  t: TermFn;
  tenant: Pick<TenantContext, "terminology"> | undefined;
}) {
  const { router, navigate } = usePlatform();
  // Local href handler — resolves optional "?key=value" query strings
  // (e.g. "settings?tab=branding") into navigate(view, params). Defined
  // here because `go` in the parent Sidebar scope is not visible below.
  const go = (href: string | undefined) => {
    if (!href) return;
    const { view, params } = parseHref(href);
    navigate(view, params);
  };
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
              <span className="flex-1 text-left">{item.termKey ? t(item.termKey) : item.label}</span>
              {item.badge ? (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">{item.badge}</Badge>
              ) : null}
              <ChevronRight className={cn("h-3.5 w-3.5 opacity-50 transition-transform", open && "rotate-90", active && "opacity-100")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
              {(item.children ?? []).map((c, idx) => {
                const CIcon = c.icon;
                const cActive = router.view === c.href;
                const prev = idx > 0 ? item.children?.[idx - 1] : undefined;
                const showGroupHeader =
                  idx > 0 &&
                  typeof c.group === "string" &&
                  c.group.length > 0 &&
                  c.group !== prev?.group;
                return (
                  <li key={`${c.id}-${idx}`}>
                    {showGroupHeader ? (
                      <div
                        role="separator"
                        aria-label={c.group}
                        className="mt-2 mb-1 select-none px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
                      >
                        {c.group}
                      </div>
                    ) : null}
                    <button
                      onClick={() => go(c.href)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        cActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      {CIcon ? <CIcon className="h-3.5 w-3.5" /> : <span className="h-1 w-1 rounded-full bg-current opacity-60" />}
                      <span className="flex-1 text-left">{resolveTermsInString(c.label, tenant)}</span>
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
        onClick={() => go(item.effectiveHref)}
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
        <span className="flex-1 truncate text-left">{item.termKey ? t(item.termKey) : item.label}</span>
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
