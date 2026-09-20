"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Boxes, Layers, Shield, Palette, Navigation as NavIcon, LayoutGrid } from "lucide-react";

export function HelpPage() {
  const { runtime } = usePlatform();
  const allModules = moduleRegistry.getAll();
  const enabled = moduleRegistry.getEnabledModules(runtime);

  const principles = [
    { icon: Layers, title: "Modular platform", desc: "One platform, three experiences (Super Admin, Prop Admin, Trader) sharing the same foundation." },
    { icon: Shield, title: "Permission-driven", desc: "Visibility is controlled by explicit permissions, not role names. Roles map to permissions." },
    { icon: Palette, title: "White-label", desc: "Tenant branding, terminology, and layouts are configuration-driven. No tenant-specific code branches." },
    { icon: NavIcon, title: "Dynamic navigation", desc: "Sidebar is generated from the module registry + tenant entitlements + user permissions + feature flags." },
    { icon: LayoutGrid, title: "Widget dashboards", desc: "Dashboards are composed of widgets registered by modules. Layouts resolve with priority: User > Role > Tenant > Platform." },
    { icon: Boxes, title: "Plug-and-play", desc: "Enable a module and navigation, routes, widgets, and settings pages appear. Disable it and they vanish." },
  ];

  return (
    <Page>
      <PageHeader title="Platform Architecture" description="How the PFaaS platform composes the frontend." icon={Boxes} />
      <PageContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {principles.map((p) => (
            <Card key={p.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-1.5"><p.icon className="h-4 w-4" /></div>
                  <span className="text-sm font-medium">{p.title}</span>
                </div>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{p.desc}</p></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Module registry ({allModules.length} registered · {enabled.length} enabled)</span></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allModules.map((m) => {
                const isEnabled = enabled.some((e) => e.manifest.id === m.manifest.id);
                return (
                  <Badge key={m.manifest.id} variant={isEnabled ? "default" : "outline"} className="gap-1">
                    {m.manifest.name}
                    {m.manifest.optional ? <span className="text-[9px] opacity-70">optional</span> : null}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
