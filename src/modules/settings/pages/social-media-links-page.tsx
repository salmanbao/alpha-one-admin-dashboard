"use client";

/**
 * Social Media Links Page — manage trader social media profiles.
 *
 * Spec sections 12, 25, 27 (Settings module). Lists every social media
 * handle linked to a trader account, supports an inline "Add Link"
 * form, search, filter by platform, KPI roll-ups, and CSV export.
 *
 * Layout:
 *  - PageHeader with title + description + "Add Link" + "Export CSV"
 *  - KPI row: Total Links, Unique Platforms, Accounts with Links,
 *    Most Popular Platform
 *  - Filter bar: search input + platform dropdown + clear button
 *  - DataTable: Platform (badge with icon), Handle, Custom URL,
 *    Account (email link), Created, Actions (Edit / Delete)
 *  - Inline form (revealed when "Add Link" clicked): Platform dropdown,
 *    Handle input, Custom URL input, Account dropdown, Save / Cancel
 *  - Empty state when no links exist
 *
 * Pre-seeded with a small deterministic set of links across Twitter/X,
 * Instagram, Telegram, Discord, YouTube, TikTok, LinkedIn, Facebook.
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders, type Trader } from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Share2,
  Plus,
  Pencil,
  Save,
  X,
  Trash2,
  Download,
  Filter,
  ExternalLink,
  Mail,
  Users,
  Layers,
  Sparkles,
  Twitter,
  Instagram,
  Send,
  MessageCircle,
  Youtube,
  Music2,
  Linkedin,
  Facebook,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & static option pools                                         */
/* ------------------------------------------------------------------ */

type Platform =
  | "Twitter/X"
  | "Instagram"
  | "Telegram"
  | "Discord"
  | "YouTube"
  | "TikTok"
  | "LinkedIn"
  | "Facebook";

const PLATFORMS: Platform[] = [
  "Twitter/X",
  "Instagram",
  "Telegram",
  "Discord",
  "YouTube",
  "TikTok",
  "LinkedIn",
  "Facebook",
];

const PLATFORM_ICONS: Record<Platform, React.ComponentType<{ className?: string }>> = {
  "Twitter/X": Twitter,
  Instagram: Instagram,
  Telegram: Send,
  Discord: MessageCircle,
  YouTube: Youtube,
  TikTok: Music2,
  LinkedIn: Linkedin,
  Facebook: Facebook,
};

const PLATFORM_TONES: Record<
  Platform,
  "info" | "success" | "warning" | "danger" | "muted"
> = {
  "Twitter/X": "info",
  Instagram: "warning",
  Telegram: "info",
  Discord: "muted",
  YouTube: "danger",
  TikTok: "muted",
  LinkedIn: "info",
  Facebook: "info",
};

interface SocialLink {
  id: string;
  platform: Platform;
  handle: string;
  customUrl: string;
  accountEmail: string;
  traderId: string;
  traderName: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Deterministic seed data                                            */
/* ------------------------------------------------------------------ */

/** Deterministic pseudo-random generator from a numeric seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

function seedLinks(tenantId: string): SocialLink[] {
  const traders = getTenantTraders(tenantId).slice(0, 30);
  const out: SocialLink[] = [];
  const now = Date.now();
  let i = 0;
  for (const t of traders) {
    // Each trader gets 1-2 deterministic links.
    const linkCount = 1 + (i % 2);
    for (let j = 0; j < linkCount; j++) {
      const s = i * 7 + j * 13 + 1;
      const platform = PLATFORMS[s % PLATFORMS.length];
      const handleNum = (s % 9000) + 1000;
      const handle = `@trader${handleNum}`;
      const url = buildUrl(platform, handle);
      const createdMsAgo = Math.floor((1 + seededRandom(s) * 365 * 24 * 60)) * 60 * 1000;
      out.push({
        id: `sml-${tenantId}-${i + 1}-${j + 1}`,
        platform,
        handle,
        customUrl: url,
        accountEmail: t.email,
        traderId: t.id,
        traderName: t.name,
        createdAt: new Date(now - createdMsAgo).toISOString(),
      });
      i++;
    }
  }
  return out;
}

function buildUrl(platform: Platform, handle: string): string {
  const clean = handle.replace(/^@/, "");
  switch (platform) {
    case "Twitter/X":
      return `https://twitter.com/${clean}`;
    case "Instagram":
      return `https://instagram.com/${clean}`;
    case "Telegram":
      return `https://t.me/${clean}`;
    case "Discord":
      return `https://discord.gg/${clean}`;
    case "YouTube":
      return `https://youtube.com/@${clean}`;
    case "TikTok":
      return `https://tiktok.com/@${clean}`;
    case "LinkedIn":
      return `https://linkedin.com/in/${clean}`;
    case "Facebook":
      return `https://facebook.com/${clean}`;
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SocialMediaLinksPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const [links, setLinks] = useState<SocialLink[]>(() => seedLinks(tid));
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  // Inline add form state
  const [formPlatform, setFormPlatform] = useState<Platform>("Twitter/X");
  const [formHandle, setFormHandle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTraderId, setFormTraderId] = useState<string>("");

  const accounts = useMemo(() => getTenantTraders(tid), [tid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => {
      if (platformFilter !== "all" && l.platform !== platformFilter) return false;
      if (
        q &&
        !`${l.handle} ${l.customUrl} ${l.accountEmail} ${l.traderName}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [links, search, platformFilter]);

  // KPI roll-ups — derived from the full unfiltered set so they reflect
  // the tenant's actual presence, not just the current view.
  const totalLinks = links.length;
  const uniquePlatforms = new Set(links.map((l) => l.platform)).size;
  const accountsWithLinks = new Set(links.map((l) => l.traderId)).size;
  const platformCounts = PLATFORMS.map((p) => ({
    platform: p,
    count: links.filter((l) => l.platform === p).length,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const mostPopular =
    platformCounts.length > 0 ? platformCounts[0] : null;

  const activeFilters =
    (search ? 1 : 0) + (platformFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setPlatformFilter("all");
  };

  const handleAddLink = () => {
    setShowForm(true);
    // Pre-fill defaults
    setFormPlatform("Twitter/X");
    setFormHandle("");
    setFormUrl("");
    setFormTraderId(accounts[0]?.id ?? "");
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setFormHandle("");
    setFormUrl("");
    setFormTraderId("");
  };

  const handleSaveForm = () => {
    if (!formHandle.trim()) {
      toast({
        title: "Handle is required",
        description: "Enter a social handle (e.g. @trader123) before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!formUrl.trim()) {
      toast({
        title: "URL is required",
        description: "Enter the full profile URL before saving.",
        variant: "destructive",
      });
      return;
    }
    const trader = accounts.find((a) => a.id === formTraderId);
    if (!trader) {
      toast({
        title: "Select an account",
        description: "Pick a trader account to link this handle to.",
        variant: "destructive",
      });
      return;
    }
    const newLink: SocialLink = {
      id: `sml-${tid}-new-${Date.now()}`,
      platform: formPlatform,
      handle: formHandle.trim(),
      customUrl: formUrl.trim(),
      accountEmail: trader.email,
      traderId: trader.id,
      traderName: trader.name,
      createdAt: new Date().toISOString(),
    };
    setLinks((prev) => [newLink, ...prev]);
    toast({
      title: "Link added",
      description: `${formPlatform} handle ${formHandle} linked to ${trader.email}.`,
    });
    handleCancelForm();
  };

  const handleDelete = (link: SocialLink) => {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    toast({
      title: "Link deleted",
      description: `${link.platform} handle ${link.handle} was removed.`,
    });
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "platform", header: "Platform", value: (l) => l.platform },
        { key: "handle", header: "Handle", value: (l) => l.handle },
        { key: "url", header: "Custom URL", value: (l) => l.customUrl },
        { key: "email", header: "Account", value: (l) => l.accountEmail },
        { key: "trader", header: "Trader Name", value: (l) => l.traderName },
        { key: "created", header: "Created", value: (l) => l.createdAt },
      ],
      `social-media-links-${tid}.csv`,
    );
  };

  const columns: Column<SocialLink>[] = [
    {
      key: "platform",
      header: "Platform",
      cell: (l) => {
        const Icon = PLATFORM_ICONS[l.platform];
        return (
          <StatusBadge tone={PLATFORM_TONES[l.platform]}>
            <span className="inline-flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {l.platform}
            </span>
          </StatusBadge>
        );
      },
      sortValue: (l) => l.platform,
    },
    {
      key: "handle",
      header: "Handle",
      cell: (l) => (
        <span className="font-mono text-xs font-medium">{l.handle}</span>
      ),
      sortValue: (l) => l.handle,
    },
    {
      key: "customUrl",
      header: "Custom URL",
      cell: (l) => (
        <a
          href={l.customUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-xs items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
          title={l.customUrl}
        >
          <ExternalLink className="h-3 w-3" />
          <span className="truncate text-xs">{l.customUrl}</span>
        </a>
      ),
      sortValue: (l) => l.customUrl,
    },
    {
      key: "account",
      header: "Account",
      cell: (l) => (
        <a
          href={`mailto:${l.accountEmail}`}
          className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <Mail className="h-3 w-3" />
          {l.accountEmail}
        </a>
      ),
      sortValue: (l) => l.accountEmail,
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (l) => (
        <span className="text-[11px] text-muted-foreground">
          {new Date(l.createdAt).toLocaleDateString()}
        </span>
      ),
      sortValue: (l) => l.createdAt,
    },
    {
      key: "actions",
      header: "",
      cell: (l) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              toast({
                title: "Edit link",
                description: `Editing ${l.platform} ${l.handle} (demo).`,
              });
            }}
            aria-label={`Edit ${l.platform} link`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Delete ${l.platform} link`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete social link?</AlertDialogTitle>
                <AlertDialogDescription>
                  The {l.platform} handle {l.handle} will be removed from
                  trader {l.traderName}. The trader can re-link the profile at
                  any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800",
                  )}
                  onClick={() => handleDelete(l)}
                >
                  Delete link
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
      width: "100px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Social Media Links"
        description="Manage social media profiles linked to trader accounts"
        icon={Share2}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" onClick={handleAddLink}>
              <Plus className="h-4 w-4" /> Add Link
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Links" value={totalLinks} icon={Share2} />
        <MetricCard label="Unique Platforms" value={uniquePlatforms} icon={Layers} />
        <MetricCard label="Accounts with Links" value={accountsWithLinks} icon={Users} />
        <MetricCard
          label="Most Popular Platform"
          value={mostPopular ? `${mostPopular.platform} (${mostPopular.count})` : "—"}
          icon={Sparkles}
          tone="positive"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {activeFilters}
            </Badge>
          ) : null}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search handle, URL, account…"
          className="h-8 w-64 text-xs"
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by platform"
        >
          <option value="all">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {activeFilters > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {links.length} links
        </span>
      </div>

      <PageContent>
        {/* Inline add form */}
        {showForm ? (
          <AddLinkForm
            platform={formPlatform}
            handle={formHandle}
            url={formUrl}
            traderId={formTraderId}
            accounts={accounts}
            onPlatformChange={(p) => {
              setFormPlatform(p);
              // When platform changes, rebuild the URL from the new
              // platform + existing handle (so it stays consistent).
              if (formHandle) {
                setFormUrl(buildUrl(p, formHandle));
              }
            }}
            onHandleChange={(v) => {
              setFormHandle(v);
              // Auto-build URL from platform + new handle.
              setFormUrl(buildUrl(formPlatform, v));
            }}
            onUrlChange={setFormUrl}
            onTraderChange={setFormTraderId}
            onSave={handleSaveForm}
            onCancel={handleCancelForm}
          />
        ) : null}

        <div className="rounded-lg border bg-card">
          {links.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No social media links yet"
              description="No social media links yet. Add links to track trader social presence."
              action={
                <Button size="sm" onClick={handleAddLink}>
                  <Plus className="h-4 w-4" /> Add Link
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(l) => l.id}
              pageSize={10}
              emptyTitle="No social media links match your filters"
              emptyDescription="Try a different search or platform filter."
            />
          )}
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Inline add form                                                    */
/* ------------------------------------------------------------------ */

function AddLinkForm({
  platform,
  handle,
  url,
  traderId,
  accounts,
  onPlatformChange,
  onHandleChange,
  onUrlChange,
  onTraderChange,
  onSave,
  onCancel,
}: {
  platform: Platform;
  handle: string;
  url: string;
  traderId: string;
  accounts: Trader[];
  onPlatformChange: (p: Platform) => void;
  onHandleChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onTraderChange: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const Icon = PLATFORM_ICONS[platform];
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Plus className="h-4 w-4 text-muted-foreground" />
          Add Social Media Link
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onCancel}
          aria-label="Cancel add link"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator className="mb-3" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="sml-platform">Platform</Label>
          <Select
            value={platform}
            onValueChange={(v) => onPlatformChange(v as Platform)}
          >
            <SelectTrigger id="sml-platform" className="w-full">
              <SelectValue placeholder="Select platform…" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => {
                const PIcon = PLATFORM_ICONS[p];
                return (
                  <SelectItem key={p} value={p}>
                    <span className="inline-flex items-center gap-1.5">
                      <PIcon className="h-3 w-3" />
                      {p}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sml-handle">Handle</Label>
          <Input
            id="sml-handle"
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            placeholder="@trader123"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sml-url">Custom URL</Label>
          <Input
            id="sml-url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://twitter.com/trader123"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sml-account">Account</Label>
          <Select
            value={traderId}
            onValueChange={(v) => onTraderChange(v)}
          >
            <SelectTrigger id="sml-account" className="w-full">
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.email} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview chip */}
      <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>Preview:</span>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Icon className="h-3 w-3" />
          {platform}
        </Badge>
        <span className="font-mono">{handle || "@handle"}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{url}</span>
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" /> Save Link
        </Button>
      </div>
    </div>
  );
}
