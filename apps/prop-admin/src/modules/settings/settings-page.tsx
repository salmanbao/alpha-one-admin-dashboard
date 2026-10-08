"use client";

/**
 * Settings Page — modular settings with a landing grid + tabbed editor.
 *
 * Spec section 43. The landing grid is the "front door" to Settings —
 * a searchable, categorized grid of all 20 settings sections (Branding,
 * Security, Communications, Certificates, System). Below the grid is a
 * collapsible "Quick edit" panel containing the 7-tab editor (General,
 * Branding, Terminology, Modules, Roles, Integrations, Notifications).
 *
 * Tabs are still preserved so the existing demo flows (Modules toggle,
 * Branding presets, Terminology editor) keep working — they are now
 * behind the "Quick edit" disclosure instead of being the primary view.
 *
 * Sidebar children that point to one of the Quick-edit tabs use a
 * deep-linking href like `settings?tab=modules` — parsed by the sidebar
 * into `navigate("settings", { tab: "modules" })`. Clicking "Modules" in
 * the sidebar opens the Quick-edit panel with the Modules tab preselected.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { roles as allRoles } from "@/lib/platform/mock-data";
import {
  Settings as SettingsIcon,
  Palette,
  Users,
  Package,
  Bell,
  Type,
  Check,
  RefreshCw,
  Plug,
  Zap,
  CreditCard,
  ShieldCheck,
  Brain,
  Mail,
  Database,
  CandlestickChart,
  Target,
  Wallet,
  FileCheck,
  Archive,
  Globe,
  Image,
  UsersRound,
  KeyRound,
  Wrench,
  Share2,
  Fingerprint,
  Award,
  ChevronRight,
  Search,
  Pencil,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { TenantBranding } from "@/lib/platform/types";

interface SettingsCardSpec {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewId: string;
  category: "Branding" | "Security" | "Communications" | "Certificates" | "System";
}

const SETTINGS_CARDS: SettingsCardSpec[] = [
  // Branding
  { id: "branding", title: "Branding Presets", description: "Color presets, primary/accent colors, border radius, live preview.", icon: Palette, viewId: "settings", category: "Branding" },
  { id: "terminology", title: "Terminology", description: "White-label business terms (challenge, trader, payout, account).", icon: Type, viewId: "settings", category: "Branding" },
  { id: "banners", title: "Banner Management", description: "Site-wide promotional banners with scheduling and targeting.", icon: Image, viewId: "banner-management", category: "Branding" },
  { id: "mkt-integrations", title: "Marketing Integrations", description: "External marketing platforms, analytics providers, ad networks.", icon: Plug, viewId: "marketing-integrations", category: "Branding" },
  { id: "social-media", title: "Social Media Links", description: "Configure footer social links and sharing channels.", icon: Share2, viewId: "social-media-links", category: "Branding" },

  // Security
  { id: "users", title: "User Management", description: "Tenant users, group membership, role assignments, status.", icon: UsersRound, viewId: "user-management", category: "Security" },
  { id: "tokens", title: "API Tokens", description: "Long-lived API tokens with scoped permissions and rotation.", icon: KeyRound, viewId: "token-management", category: "Security" },
  { id: "device-activities", title: "Device Activities", description: "Login device fingerprinting, IP history, session audit.", icon: Fingerprint, viewId: "device-activities", category: "Security" },
  { id: "kyc-providers", title: "KYC Providers", description: "Identity verification providers — Sumsub, Onfido, Persona.", icon: ShieldCheck, viewId: "kyc-providers", category: "Security" },

  // Communications
  { id: "email-templates", title: "Email Templates", description: "Transactional and marketing email templates with variables.", icon: Mail, viewId: "email-templates", category: "Communications" },
  { id: "notifications-mgmt", title: "Notifications Management", description: "Configure notification types, channels, and triggers.", icon: Bell, viewId: "notifications-management", category: "Communications" },

  // Certificates
  { id: "certificates", title: "Certificate Management", description: "Manage issued certificate templates and the issuer identity.", icon: Award, viewId: "certificate-management", category: "Certificates" },
  { id: "cert-designer", title: "Certificate Designer", description: "Visual designer for certificate layouts, fonts, and colors.", icon: Palette, viewId: "certificate-template-designer", category: "Certificates" },
  { id: "font-upload", title: "Font Upload", description: "Upload custom fonts for certificate rendering.", icon: Type, viewId: "certificate-font-upload", category: "Certificates" },
  { id: "cert-issued", title: "Issued Certificates", description: "Search and revoke issued certificates per trader.", icon: Award, viewId: "certificates-issued", category: "Certificates" },

  // System
  { id: "general", title: "General", description: "Tenant name, tagline, currency, timezone, plan summary.", icon: SettingsIcon, viewId: "settings", category: "System" },
  { id: "modules", title: "Modules", description: "Toggle tenant entitlements — sidebar and dashboard recompose live.", icon: Package, viewId: "settings", category: "System" },
  { id: "roles", title: "Roles & Permissions", description: "Permission-driven role definitions for RBAC visibility.", icon: Users, viewId: "settings", category: "System" },
  { id: "notifications", title: "Notifications Matrix", description: "Per-module, per-channel notification preferences and quiet hours.", icon: Bell, viewId: "settings", category: "System" },
  { id: "utilities", title: "Utilities", description: "Bulk data export, cache management, and system diagnostics.", icon: Wrench, viewId: "utilities", category: "System" },
];

const CATEGORY_ORDER: SettingsCardSpec["category"][] = [
  "Branding",
  "Security",
  "Communications",
  "Certificates",
  "System",
];

export function SettingsPage() {
  const { router, navigate, tenant, runtime } = usePlatform();
  const [query, setQuery] = useState("");
  const [showQuickEdit, setShowQuickEdit] = useState<boolean>(
    Boolean(router.params.tab),
  );

  // Quick edit's active tab — initialized from the URL `?tab=` param so
  // deep-links like `navigate("settings", { tab: "modules" })` land on
  // the right tab when the page first mounts. Subsequent tab clicks
  // are pure local state — we don't push back to the URL (avoids the
  // setState-in-effect anti-pattern).
  const [activeTab, setActiveTab] = useState<string>(
    (router.params.tab as string) || "general",
  );

  const openQuickEdit = (tab: string) => {
    setActiveTab(tab);
    setShowQuickEdit(true);
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return SETTINGS_CARDS;
    const q = query.toLowerCase();
    return SETTINGS_CARDS.filter(
      (c) =>
        `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<SettingsCardSpec["category"], SettingsCardSpec[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const c of filtered) map.get(c.category)!.push(c);
    return map;
  }, [filtered]);

  const totalSections = SETTINGS_CARDS.length;
  const activeModules = tenant.enabledModules.length;
  const recentlyModified = new Date(tenant.createdAt).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Configure branding, security, communications, and system."
        icon={SettingsIcon}
        actions={
          <Button
            variant={showQuickEdit ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowQuickEdit((s) => !s)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {showQuickEdit ? "Hide quick edit" : "Quick edit"}
          </Button>
        }
      />

      <PageContent>
        {/* KPI row — §9 KPI rules (value + meaning, not bare metrics) */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            label="Settings Sections"
            value={totalSections}
            deltaLabel="across 5 categories"
            icon={SettingsIcon}
          />
          <MetricCard
            label="Tenant Age"
            value={recentlyModified}
            deltaLabel="since tenant created"
            icon={RefreshCw}
          />
          <MetricCard
            label="Active Modules"
            value={activeModules}
            deltaLabel={`${runtime.enabledFeatures.length} feature flags`}
            icon={Package}
            tone="positive"
          />
          <MetricCard
            label="Firm Status"
            value={tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
            deltaLabel={`${tenant.plan} plan`}
            icon={ShieldCheck}
            tone={
              tenant.status === "active"
                ? "positive"
                : tenant.status === "trial"
                  ? "warning"
                  : "default"
            }
          />
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings sections by title or description…"
            className="pl-9"
            aria-label="Search settings sections"
          />
        </div>

        {/* Landing grid — grouped by category */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No settings match"
            description={`No settings sections match "${query}". Try a different term.`}
            icon={Search}
            hint="Settings are grouped under Branding, Security, Communications, Certificates, and System."
          />
        ) : (
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={cat} aria-label={`${cat} settings`}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      {cat}
                    </h2>
                    <Badge variant="outline" className="text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((card) => {
                      const Icon = card.icon;
                      const isQuickEdit = card.viewId === "settings";
                      return (
                        <button
                          key={card.id}
                          onClick={() =>
                            isQuickEdit
                              ? openQuickEdit(card.id)
                              : navigate(card.viewId)
                          }
                          className="group flex h-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                          aria-label={`Open ${card.title}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="rounded-md border bg-muted p-1.5">
                              <Icon className="h-4 w-4 text-foreground" />
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {card.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {resolveTermsInString(card.description, tenant)}
                            </p>
                          </div>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                            Open →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Quick edit (collapsible 7-tab editor) */}
        {showQuickEdit ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Quick edit</span>
                  <p className="text-xs text-muted-foreground">
                    Inline editors for the 7 most-changed settings groups.
                    Each card above links to its full-page editor.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickEdit(false)}
                  aria-label="Hide quick edit"
                >
                  Hide
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="flex flex-wrap justify-start">
                  <TabsTrigger value="general" className="gap-1">
                    <SettingsIcon className="h-3 w-3" /> General
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="gap-1">
                    <Palette className="h-3 w-3" /> Branding
                  </TabsTrigger>
                  <TabsTrigger value="terminology" className="gap-1">
                    <Type className="h-3 w-3" /> Terminology
                  </TabsTrigger>
                  <TabsTrigger value="modules" className="gap-1">
                    <Package className="h-3 w-3" /> Modules
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="gap-1">
                    <Users className="h-3 w-3" /> Roles
                  </TabsTrigger>
                  <TabsTrigger value="integrations" className="gap-1">
                    <Plug className="h-3 w-3" /> Integrations
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="gap-1">
                    <Bell className="h-3 w-3" /> Notifications
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                  <GeneralTab />
                </TabsContent>
                <TabsContent value="branding">
                  <BrandingTab />
                </TabsContent>
                <TabsContent value="terminology">
                  <TerminologyTab />
                </TabsContent>
                <TabsContent value="modules">
                  <ModulesTab />
                </TabsContent>
                <TabsContent value="roles">
                  <RolesTab />
                </TabsContent>
                <TabsContent value="integrations">
                  <IntegrationsTab />
                </TabsContent>
                <TabsContent value="notifications">
                  <NotificationsTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}
      </PageContent>
    </Page>
  );
}

function GeneralTab() {
  const { tenant, setTenant, runtime } = usePlatform();
  const [name, setName] = useState(tenant.branding.name);
  const [tagline, setTagline] = useState(tenant.branding.tagline ?? "");
  const [currency, setCurrency] = useState(tenant.currency);
  const [timezone, setTimezone] = useState(tenant.timezone);

  const save = () => {
    setTenant({
      ...tenant,
      name,
      branding: { ...tenant.branding, name, tagline },
      currency,
      timezone,
    });
    toast({ title: "Settings saved", description: "General settings updated." });
  };

  return (
    <Card>
      <CardHeader><span className="text-sm font-medium">General</span></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tenant name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="AED">AED</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}><Check className="mr-1 h-4 w-4" /> Save changes</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { exportAllAsZip } = await import("@/lib/platform/bulk-export");
              exportAllAsZip(runtime);
            }}
            className="gap-1.5"
          >
            <Archive className="mr-1 h-4 w-4" /> Export all data (ZIP)
          </Button>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium">{tenant.plan}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{tenant.status}</p></div>
          <div><p className="text-xs text-muted-foreground">Modules</p><p className="font-medium">{tenant.enabledModules.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Features</p><p className="font-medium">{tenant.enabledFeatures.length}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandingTab() {
  const { tenant, setTenant } = usePlatform();
  const [branding, setBranding] = useState<TenantBranding>(tenant.branding);
  const presets = [
    { name: "Forest", primary: "#4a7c59", accent: "#705c30", surface: "#f5efe6" },
    { name: "Sage", primary: "#5a7c4a", accent: "#8a6d30", surface: "#f5efe6" },
    { name: "Deep Green", primary: "#4a6c59", accent: "#705c30", surface: "#f5efe6" },
    { name: "Golden Brown", primary: "#705c30", accent: "#4a7c59", surface: "#f5efe6" },
    { name: "Warm Taupe", primary: "#8a7560", accent: "#4a7c59", surface: "#f5efe6" },
    { name: "Slate Green", primary: "#5a7060", accent: "#705c30", surface: "#f5efe6" },
  ];

  const save = () => {
    setTenant({ ...tenant, branding });
    toast({ title: "Branding applied", description: "Theme updated instantly — no rebuild required." });
  };

  return (
    <Card>
      <CardHeader><span className="text-sm font-medium">Branding & White-label</span></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs">Color presets</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => setBranding({ ...branding, primaryColor: p.primary, accentColor: p.accent, surfaceColor: p.surface })}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                style={{ borderColor: branding.primaryColor === p.primary ? p.primary : undefined }}
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: p.primary }} />
                <span className="h-3 w-3 rounded-sm" style={{ background: p.accent }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="primary">Primary color</Label>
            <div className="flex gap-2">
              <input type="color" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="h-9 w-12 rounded-md border" />
              <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accent">Accent color</Label>
            <div className="flex gap-2">
              <input type="color" value={branding.accentColor} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} className="h-9 w-12 rounded-md border" />
              <Input value={branding.accentColor} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="radius">Border radius</Label>
            <select id="radius" value={branding.radius} onChange={(e) => setBranding({ ...branding, radius: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="0.25rem">Sharp (0.25rem)</option>
              <option value="0.5rem">Subtle (0.5rem)</option>
              <option value="0.625rem">Default (0.625rem)</option>
              <option value="0.75rem">Rounded (0.75rem)</option>
              <option value="1rem">Pill (1rem)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initials">Initials</Label>
            <Input id="initials" value={branding.initials} maxLength={3} onChange={(e) => setBranding({ ...branding, initials: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="rounded-lg border p-4" style={{ background: branding.surfaceColor }}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white" style={{ background: branding.primaryColor }}>{branding.initials}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>{branding.name}</p>
              <p className="text-xs text-muted-foreground">{branding.tagline}</p>
            </div>
            <Button size="sm" className="ml-auto text-white" style={{ background: branding.primaryColor }}>Brand button</Button>
          </div>
        </div>
        <Button size="sm" onClick={save}><Check className="mr-1 h-4 w-4" /> Apply branding</Button>
      </CardContent>
    </Card>
  );
}

function TerminologyTab() {
  const { tenant, setTenant } = usePlatform();
  const [terms, setTerms] = useState<Record<string, string>>(tenant.terminology);
  const keys = ["challenge", "payout", "account", "evaluation", "participant", "withdrawal", "disbursement"];

  const save = () => {
    setTenant({ ...tenant, terminology: terms });
    toast({ title: "Terminology saved", description: "Custom terms applied across the platform." });
  };

  return (
    <Card>
      <CardHeader><span className="text-sm font-medium">Terminology</span></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Customize business terminology for this tenant. Only terms that need white-label customization are configurable.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {keys.map((k) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs capitalize">{k}</Label>
              <Input value={terms[k] ?? ""} placeholder={`Default: ${k.charAt(0).toUpperCase() + k.slice(1)}`} onChange={(e) => setTerms({ ...terms, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <Button size="sm" onClick={save}><Check className="mr-1 h-4 w-4" /> Save terminology</Button>
      </CardContent>
    </Card>
  );
}

function ModulesTab() {
  const { tenant, setTenant, runtime, user } = usePlatform();
  const allModules = moduleRegistry.getAll().filter((m) => {
    // Only show modules that support the current application
    if (!m.manifest.supportedApplications || m.manifest.supportedApplications.length === 0) return true;
    return m.manifest.supportedApplications.includes(user.application);
  });
  const isPlatform = tenant.id === "platform";

  const toggle = (moduleId: string) => {
    const enabled = new Set(tenant.enabledModules);
    if (enabled.has(moduleId)) enabled.delete(moduleId);
    else enabled.add(moduleId);
    setTenant({ ...tenant, enabledModules: Array.from(enabled) });
    const mod = allModules.find((m) => m.manifest.id === moduleId);
    toast({
      title: enabled.has(moduleId) ? "Module enabled" : "Module disabled",
      description: `${mod?.manifest.name} is now ${enabled.has(moduleId) ? "visible" : "hidden"} in navigation.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Module Catalog</span>
          <Badge variant="secondary">{tenant.enabledModules.length} enabled</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Toggle modules to see the sidebar and dashboard re-compose live. This demonstrates the plug-and-play architecture (spec section 67).</p>
        <Separator />
        {allModules.map((m) => {
          const enabled = isPlatform || tenant.enabledModules.includes(m.manifest.id);
          const Icon = m.manifest.icon;
          return (
            <div key={m.manifest.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="rounded-md p-2" style={{ background: `${m.manifest.accentColor}1a` }}>
                {Icon ? <Icon className="h-4 w-4" style={{ color: m.manifest.accentColor }} /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{m.manifest.name}</p>
                  {m.manifest.optional ? <Badge variant="outline" className="text-[9px]">optional</Badge> : null}
                  <Badge variant="outline" className="text-[9px]">{m.manifest.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{m.manifest.description}</p>
                {m.manifest.dependencies?.length ? (
                  <p className="text-[10px] text-muted-foreground/70">Depends on: {m.manifest.dependencies.join(", ")}</p>
                ) : null}
              </div>
              <Switch checked={enabled} onCheckedChange={() => toggle(m.manifest.id)} disabled={isPlatform} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RolesTab() {
  const roles = allRoles;
  return (
    <Card>
      <CardHeader><span className="text-sm font-medium">Roles & Permissions</span></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Roles map to explicit permissions. Visibility is controlled by permissions, not role names (spec section 12).</p>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                <span className="text-sm font-medium">{r.name}</span>
                <Badge variant="outline" className="text-[10px]">{r.application}</Badge>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{r.description}</p>
              <div className="flex flex-wrap gap-1">
                {r.permissions.slice(0, 15).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
                {r.permissions.length > 15 ? <Badge variant="outline" className="text-[10px]">+{r.permissions.length - 15} more</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const NOTIF_PREFS_KEY = "pfaas:notificationPrefs";

function NotificationsTab() {
  const { tenant } = usePlatform();
  // Per-module notification preferences with per-channel toggles
  const modules = [
    { id: "trading", name: resolveTermsInString("Trading", tenant), icon: CandlestickChart, events: [resolveTermsInString("New trader", tenant), "Account breach", "Large P&L"] },
    { id: "challenges", name: resolveTermsInString("Challenges", tenant), icon: Target, events: ["Phase passed", resolveTermsInString("Challenge failed", tenant), "Profit target hit"] },
    { id: "risk", name: "Risk", icon: ShieldCheck, events: ["Drawdown breach", "Daily limit hit", "Risk score change"] },
    { id: "payouts", name: resolveTermsInString("Payouts", tenant), icon: Wallet, events: [resolveTermsInString("Payout requested", tenant), resolveTermsInString("Payout approved", tenant), resolveTermsInString("Payout rejected", tenant)] },
    { id: "kyc", name: "KYC", icon: FileCheck, events: ["KYC submitted", "KYC approved", "High-risk flag"] },
    { id: "ai", name: "AI / LLM", icon: Brain, events: ["New insight", "Critical alert", "Opportunity flagged"] },
  ];
  const channels = [
    { id: "email", label: "Email" },
    { id: "inapp", label: "In-app" },
    { id: "slack", label: "Slack" },
  ];

  // Controlled channel prefs — persisted per browser so toggles survive
  // re-renders and reloads (the copy promises "saved to your profile").
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(NOTIF_PREFS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  // Quiet-hours settings also persist to localStorage (Round 4 fix:
  // previously controlled-but-not-persisted, so reloads reset the
  // toggle and the time selections despite the page copy saying
  // "Changes apply instantly and are saved to your profile").
  const [quietHours, setQuietHours] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) return (JSON.parse(stored) as { quietHours?: boolean }).quietHours ?? true;
    } catch { /* ignore */ }
    return true;
  });
  const [quietStart, setQuietStart] = useState<string>(() => {
    if (typeof window === "undefined") return "22:00";
    try {
      const stored = window.localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) return (JSON.parse(stored) as { quietStart?: string }).quietStart ?? "22:00";
    } catch { /* ignore */ }
    return "22:00";
  });
  const [quietEnd, setQuietEnd] = useState<string>(() => {
    if (typeof window === "undefined") return "07:00";
    try {
      const stored = window.localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) return (JSON.parse(stored) as { quietEnd?: string }).quietEnd ?? "07:00";
    } catch { /* ignore */ }
    return "07:00";
  });

  // Persist quiet-hours changes alongside the channel prefs.
  const persistQuietHours = (patch: Partial<{ quietHours: boolean; quietStart: string; quietEnd: string }>) => {
    try {
      const stored = window.localStorage.getItem(NOTIF_PREFS_KEY);
      const base = stored ? JSON.parse(stored) as Record<string, unknown> : {};
      window.localStorage.setItem(
        NOTIF_PREFS_KEY,
        JSON.stringify({ ...base, ...patch }),
      );
    } catch { /* ignore */ }
  };

  const prefFor = (modId: string, chId: string) =>
    prefs[`${modId}:${chId}`] ?? chId !== "slack";
  const setPref = (modId: string, chId: string, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [`${modId}:${chId}`]: value };
      try {
        window.localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-medium">Notification Preferences</span></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Configure which notification channels each module uses. Toggle per-module, per-channel.
            Changes apply instantly and are saved to your profile.
          </p>
        </CardContent>
      </Card>

      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <Card key={mod.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2.5">
                <div className="rounded-md bg-muted p-1.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium">{mod.name}</span>
                  <p className="text-[11px] text-muted-foreground">{mod.events.join(" · ")}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {channels.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="text-xs font-medium text-foreground">{ch.label}</span>
                    <Switch
                      checked={prefFor(mod.id, ch.id)}
                      onCheckedChange={(v) => setPref(mod.id, ch.id, v)}
                      aria-label={`${mod.name} ${ch.label} notifications`}
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiet Hours</span>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Suppress non-critical notifications during these hours.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Switch
              checked={quietHours}
              onCheckedChange={(v) => { setQuietHours(v); persistQuietHours({ quietHours: v }); }}
              id="quiet-hours"
              aria-label="Enable quiet hours"
            />
            <label htmlFor="quiet-hours" className="text-xs font-medium">Enable quiet hours</label>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Quiet hours start"
              value={quietStart}
              onChange={(e) => { setQuietStart(e.target.value); persistQuietHours({ quietStart: e.target.value }); }}
            >
              <option>22:00</option>
              <option>23:00</option>
              <option>00:00</option>
            </select>
            <span className="text-xs text-muted-foreground">to</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Quiet hours end"
              value={quietEnd}
              onChange={(e) => { setQuietEnd(e.target.value); persistQuietHours({ quietEnd: e.target.value }); }}
            >
              <option>07:00</option>
              <option>08:00</option>
              <option>09:00</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Integrations Tab (spec §44). Pluggable integrations panel with
 * provider status, configuration, health, sync status, last sync.
 * Grouped by category: Trading Platform, Payments, KYC, Accounting, CRM,
 * Notifications, Marketing. Never exposes secret credentials after save.
 */
function IntegrationsTab() {
  const integrationCategories = [
    {
      name: "Trading Platform",
      integrations: [
        { id: "mt5", name: "MetaTrader 5", status: "connected", icon: Zap, lastSync: "2m ago", health: "healthy", description: "Live trading bridge for MT5 accounts" },
        { id: "mt4", name: "MetaTrader 4", status: "available", icon: Zap, lastSync: null, health: null, description: "Legacy MT4 bridge (deprecated)" },
        { id: "dxtrade", name: "DXTrade", status: "connected", icon: Globe, lastSync: "5m ago", health: "healthy", description: "DXTrade platform integration" },
      ],
    },
    {
      name: "Payments",
      integrations: [
        { id: "stripe", name: "Stripe", status: "connected", icon: CreditCard, lastSync: "1h ago", health: "healthy", description: "Card payments & payouts" },
        { id: "wise", name: "Wise (TransferWise)", status: "connected", icon: CreditCard, lastSync: "3h ago", health: "degraded", description: "Bank transfer payouts" },
        { id: "crypto", name: "Crypto Payments", status: "available", icon: CreditCard, lastSync: null, health: null, description: "USDT/BTC/ETH payout support" },
        { id: "paypal", name: "PayPal", status: "disconnected", icon: CreditCard, lastSync: null, health: null, description: "PayPal payout integration" },
      ],
    },
    {
      name: "KYC / AML",
      integrations: [
        { id: "sumsub", name: "Sumsub", status: "connected", icon: ShieldCheck, lastSync: "12m ago", health: "healthy", description: "Automated KYC verification" },
        { id: "onfido", name: "Onfido", status: "available", icon: ShieldCheck, lastSync: null, health: null, description: "Identity verification provider" },
      ],
    },
    {
      name: "Notifications",
      integrations: [
        { id: "sendgrid", name: "SendGrid", status: "connected", icon: Mail, lastSync: "8m ago", health: "healthy", description: "Email notification delivery" },
        { id: "slack", name: "Slack", status: "connected", icon: Mail, lastSync: "15m ago", health: "healthy", description: "Critical alerts to Slack channels" },
        { id: "twilio", name: "Twilio SMS", status: "available", icon: Mail, lastSync: null, health: null, description: "SMS alerts for high-priority events" },
      ],
    },
    {
      name: "AI & Analytics",
      integrations: [
        { id: "openai", name: "OpenAI", status: "connected", icon: Brain, lastSync: "5m ago", health: "healthy", description: "AI insights & chat assistant" },
        { id: "segment", name: "Segment", status: "available", icon: Database, lastSync: null, health: null, description: "Customer data platform" },
      ],
    },
  ];

  const statusTone = (s: string) =>
    s === "connected" ? "success" : s === "available" ? "info" : "muted";
  const healthTone = (h: string | null) =>
    h === "healthy" ? "success" : h === "degraded" ? "warning" : h === "down" ? "danger" : "muted";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Integrations</span>
              <p className="text-xs text-muted-foreground">External service providers and their status. Secret credentials are never shown after initial save.</p>
            </div>
            <Badge variant="secondary">
              {integrationCategories.reduce((s, c) => s + c.integrations.filter((i) => i.status === "connected").length, 0)} connected
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {integrationCategories.map((cat) => (
        <Card key={cat.name}>
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat.name}</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {cat.integrations.map((int) => {
              const Icon = int.icon;
              return (
                <div key={int.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className={`rounded-md p-2 ${int.status === "connected" ? "bg-emerald-100 dark:bg-emerald-950" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${int.status === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{int.name}</span>
                      <Badge variant="outline" className={`text-[9px] ${int.status === "connected" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : ""}`}>
                        {int.status}
                      </Badge>
                      {int.health ? (
                        <Badge variant="outline" className={`text-[9px] ${int.health === "healthy" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : int.health === "degraded" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-rose-500/40 text-rose-700 dark:text-rose-400"}`}>
                          {int.health}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{int.description}</p>
                    {int.lastSync ? (
                      <p className="text-[10px] text-muted-foreground/70">Last sync: {int.lastSync}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={int.status === "connected" ? "outline" : "default"}
                    onClick={() => toast({
                      title: int.status === "connected" ? "Configure integration" : "Connect integration",
                      description: `${int.name} configuration dialog (demo).`,
                    })}
                  >
                    {int.status === "connected" ? "Configure" : int.status === "available" ? "Connect" : "Reconnect"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security Note</span>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Per spec §44, the frontend never exposes secret credentials after initial save.
            Configuration forms accept credentials once, store them server-side encrypted,
            and subsequent views show only masked indicators (e.g. <code className="rounded bg-muted px-1">sk_••••••••••••4231</code>).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
