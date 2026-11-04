"use client";

/**
 * PFaaS Platform — Breadcrumbs + Mobile Sidebar Sheet
 *
 * Spec section 9. Breadcrumbs derived from current view via nav engine.
 * Mobile sheet navigation mirrors the desktop sidebar.
 */

import { useMemo, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import { resolveNavigation, findNavForView } from "@/lib/platform/navigation-engine";
import { moduleRegistry } from "@/lib/platform/module-registry";
import type { TenantContext } from "@/lib/platform/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Detail screens that aren't sidebar destinations (audit #1: breadcrumb
 * consistency). Maps view → the nav list it belongs under, plus the
 * screen's own label — entity name from route params where available —
 * so the trail reads e.g. "Platform › Tenants › Apex Capital" with every
 * segment except the last clickable.
 */
function resolveDetail(
  view: string,
  params: Record<string, string>,
  availableTenants: TenantContext[],
): { parent: string; label: string } | null {
  const moduleName = (id?: string) =>
    id
      ? moduleRegistry.getAll().find((m) => m.manifest.id === id)?.manifest.name
      : undefined;
  switch (view) {
    case "tenant-detail": {
      const tenant = availableTenants.find((t) => t.id === params.id);
      return { parent: "tenants", label: tenant?.name ?? "Tenant Detail" };
    }
    case "provisioning-saga": {
      const tenant = params.tenant
        ? availableTenants.find((t) => t.id === params.tenant)
        : undefined;
      return { parent: "tenants", label: tenant ? `Provisioning: ${tenant.name}` : "Provisioning" };
    }
    case "module-detail":
      return { parent: "module-catalog", label: moduleName(params.module) ?? "Module Detail" };
    case "module-settings":
      return {
        parent: "module-catalog",
        label: moduleName(params.module) ? `${moduleName(params.module)} Settings` : "Module Settings",
      };
    case "audit-log":
      return { parent: "platform-audit", label: "Audit Log" };
    case "model-audit-log":
      return { parent: "platform-audit", label: "Model Audit Log" };
    case "impersonation-audit":
      return { parent: "tenant-view-as", label: "Impersonation Audit" };
    case "operator-directory":
      return { parent: "platform-staff", label: "Operator Directory" };
    case "role-management":
      return { parent: "platform-roles", label: "Role Management" };
    case "platform-overview":
      return { parent: "super-overview", label: "Platform Overview" };
    case "ai-usage-quota":
      return { parent: "platform-analytics", label: "AI Usage Quota" };
    case "tenant-benchmarking":
      return { parent: "platform-analytics", label: "Tenant Benchmarking" };
    case "bridge-sync-log":
      return { parent: "platform-operations", label: "Bridge Sync Log" };
    case "challenge-programs":
      return { parent: "global-defaults", label: "Challenge Programs" };
    default:
      return null;
  }
}

export function Breadcrumbs() {
  const { router, navigate, runtime, tenant, availableTenants } = usePlatform();
  const items = useMemo(() => resolveNavigation(runtime), [runtime]);

  const trail = useMemo(() => {
    const found = findNavForView(items, router.view);
    const out: { label: string; href?: string }[] = [];
    // find parent (top-level item containing this view)
    const parent = items.find((i) =>
      i.effectiveHref === router.view || i.children?.some((c) => c.href === router.view),
    );
    if (parent) {
      out.push({ label: resolveTermsInString(parent.label, tenant), href: parent.effectiveHref });
      if (parent.children?.some((c) => c.href === router.view) && found) {
        out.push({ label: resolveTermsInString(found.label, tenant) });
      }
    } else if (found) {
      out.push({ label: resolveTermsInString(found.label, tenant) });
    } else {
      // Detail screens (audit: inconsistent breadcrumbs) — these views are
      // not sidebar destinations, so resolve their parent list view to show
      // a full clickable path instead of a lone generated label.
      const detail = resolveDetail(router.view, router.params, availableTenants);
      if (detail) {
        const parentNav = findNavForView(items, detail.parent);
        // Mirror the nav-view trail above: section crumb (if the parent
        // lives inside a sidebar section) › parent list › current screen.
        const section = items.find((i) => i.children?.some((c) => c.href === detail.parent));
        if (section) {
          out.push({
            label: resolveTermsInString(section.label, tenant),
            href: section.effectiveHref,
          });
        }
        out.push({
          label: parentNav
            ? resolveTermsInString(parentNav.label, tenant)
            : detail.parent.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          href: detail.parent,
        });
        out.push({ label: detail.label });
      } else {
        // unknown view — use the view name
        out.push({ label: resolveTermsInString(router.view.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), tenant) });
      }
    }
    return out;
  }, [items, router.view, router.params, tenant, availableTenants]);

  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => navigate("super-overview")} className="cursor-pointer">
            <Home className="h-3.5 w-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {trail.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              {t.href && i < trail.length - 1 ? (
                <BreadcrumbLink className="cursor-pointer" onClick={() => navigate(t.href!)}>
                  {t.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{t.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function MobileNav() {
  const { runtime, navigate, tenant, user } = usePlatform();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => resolveNavigation(runtime), [runtime]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: tenant.branding.primaryColor }}
            >
              {tenant.branding.initials}
            </span>
            <div>
              <p className="text-sm font-semibold">{tenant.branding.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.application}</p>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex h-[calc(100vh-100px)] flex-col overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                {item.isSection ? (
                  <div className="mt-2">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {resolveTermsInString(item.label, tenant)}
                    </p>
                    <ul className="ml-2 space-y-0.5">
                      {item.children?.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => {
                              if (c.href) navigate(c.href);
                              setOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            {resolveTermsInString(c.label, tenant)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (item.effectiveHref) navigate(item.effectiveHref);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    {resolveTermsInString(item.label, tenant)}
                    {item.badge ? (
                      <Badge variant="secondary" className="ml-auto text-[9px]">{item.badge}</Badge>
                    ) : null}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
