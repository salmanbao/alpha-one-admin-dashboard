"use client";

/**
 * Affiliate Link Detail — per-link analytics + edit form.
 *
 * Extracted from the Link Tracking list's inline LinkAnalyticsSheet
 * (view mode) into the detail-overlay pattern: a row click (or the View
 * action) opens this screen as a sheet (?panel=affiliate-link-detail&id=LNK-…)
 * and the same component renders full-page from ?view=affiliate-link-detail
 * (new tab / overlay header's "New tab" button).
 *
 * Shows the tracking URL (copy + open), link KPIs, the deterministic
 * 30d click series, and the recent-clicks table, plus Suspend/Delete
 * contextual §22 actions with §24 destructive friction on Delete.
 *
 * Create mode stays in the parent's LinkAnalyticsSheet drawer; this
 * screen is always bound to an existing link resolved via
 * router.params.id.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getAffiliateLink,
  convRate,
  clickSeriesForLink,
  recentClicksForLink,
  RecentClicksTable,
  type AffiliateLink,
  type LinkSource,
} from "@/modules/affiliates/pages/affiliate-link-tracking-page";
import { Page, PageContent } from "@/components/platform/page";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Ban,
  ChevronRight,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  MousePointerClick,
  Pencil,
  Save,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

function linkStatusTone(s: AffiliateLink["status"]): "success" | "muted" | "danger" {
  switch (s) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    case "inactive":
    default:
      return "muted";
  }
}

function copyToClipboard(text: string, label = "Link") {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied`, description: text }),
      () => toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" }),
    );
  } else {
    toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" });
  }
}

export function AffiliateLinkDetailPage() {
  const { router, navigate, runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  const link = getAffiliateLink(router.params.id ?? "");
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Editable form state — lazy initializers seed from the link on mount
  // (no setState-in-effect). Mock data: saves are demo toasts.
  const [affiliate, setAffiliate] = useState(() => link?.affiliateId ?? "AFF-001");
  const [source, setSource] = useState<LinkSource>(() => link?.source ?? "Direct");
  const [campaign, setCampaign] = useState(() => link?.utmCampaign ?? "");

  const close = () => navigate("affiliate-link-tracking");

  if (!link) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Link not found</p>
            <p className="text-sm text-muted-foreground">
              This tracking link doesn&apos;t exist or was deleted. Past
              analytics for it are retained for attribution reporting.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back to Link Tracking
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  const pct = convRate(link.clicks, link.conversions);
  const series = clickSeriesForLink(link);
  const recentClicks = recentClicksForLink(link);

  const handleSave = () => {
    toast({
      title: "Link saved",
      description: `${link.refCode} — ${source} · ${affiliate}.`,
    });
    setEditing(false);
  };

  const handleSuspend = () => {
    toast({
      title: "Link suspended (demo)",
      description: `${link.refCode} no longer redirects.`,
      variant: "destructive",
    });
  };

  const handleDelete = () => {
    toast({
      title: "Link deleted",
      description: `${link.refCode} no longer redirects. Past analytics retained.`,
      variant: "destructive",
    });
    setDeleteOpen(false);
  };

  return (
    <Page>
      {/* Breadcrumb — Link Tracking > [ref code] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Link Tracking
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{link.refCode}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          {/* Header — ref code + status + edit toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <LinkIcon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <span className="font-mono">{link.refCode}</span>
                  <StatusBadge tone={linkStatusTone(link.status)} className="capitalize">
                    {link.status}
                  </StatusBadge>
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {link.affiliate} · {link.source} · created {link.createdAt}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {editing ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel editing">
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel edit
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label="Edit this link">
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={close} aria-label="Close detail">
                Close
              </Button>
            </div>
          </div>

          {/* Link URL (read-only + Copy + open) */}
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="lnk-url" className="text-xs">
              <LabelWithHelp help="The full tracking URL the affiliate shares. The ?ref= parameter is what ties clicks to this affiliate.">
                Link URL
              </LabelWithHelp>
            </Label>
            <div className="flex gap-2">
              <Input
                id="lnk-url"
                value={link.url}
                readOnly
                className="font-mono text-xs"
                aria-label="Link URL (read-only)"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(link.url, "Link URL")}
                aria-label="Copy link URL"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-xs text-muted-foreground hover:bg-muted"
                aria-label="Open tracking link in a new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <MousePointerClick className="h-3 w-3" /> Clicks
              </p>
              <p className="mt-1 font-medium tabular-nums text-foreground">{link.clicks.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{link.uniqueClicks.toLocaleString()} unique</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Target className="h-3 w-3" /> Conversions
              </p>
              <p className="mt-1 font-medium tabular-nums text-foreground">{link.conversions}</p>
              <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% conv. rate</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Revenue
              </p>
              <p className="mt-1 font-medium tabular-nums text-emerald-600">{formatCurrency(link.revenue, currency)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="h-3 w-3" /> Affiliate
              </p>
              <p className="mt-1 font-medium text-foreground">{link.affiliate}</p>
              <p className="font-mono text-xs text-muted-foreground">{link.affiliateId}</p>
            </div>
          </div>

          {!editing ? (
            /* ---------------- Analytics view ---------------- */
            <div className="mt-4 space-y-4">
              {/* Click analytics mini-chart (30d) */}
              {series.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
                      Click Analytics (30d)
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Peak: {Math.max(...series.map((s) => Number(s.value)))} clicks
                    </span>
                  </div>
                  <AreaSeries
                    data={series}
                    xKey="date"
                    yKey="value"
                    color="#059669"
                    height={160}
                    formatValue={(v) => formatCompact(v)}
                  />
                </div>
              )}

              {/* Recent Clicks */}
              {recentClicks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                      Recent Clicks (last 10)
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {recentClicks.filter((c) => c.converted).length} converted
                    </span>
                  </div>
                  <RecentClicksTable rows={recentClicks} />
                </div>
              )}

              {/* Footer actions — §22 contextual actions where the decision happens */}
              <div className="flex flex-row flex-wrap gap-2 border-t pt-4">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                {link.status === "active" && (
                  <Button size="sm" variant="outline" onClick={handleSuspend}>
                    <Ban className="mr-1 h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete this link"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ) : (
            /* ---------------- Edit form ---------------- */
            <div className="mt-4 space-y-4">
              <Separator />

              {/* Affiliate + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Affiliate</Label>
                  <Select value={affiliate} onValueChange={setAffiliate}>
                    <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Affiliate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AFF-001">Alex Trader</SelectItem>
                      <SelectItem value="AFF-002">Sarah Marketing</SelectItem>
                      <SelectItem value="AFF-003">Maria Lopez</SelectItem>
                      <SelectItem value="AFF-004">David Chen</SelectItem>
                      <SelectItem value="AFF-005">Emma Wilson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    <LabelWithHelp help="The marketing channel that drove the click. Used for source-level reporting and the Clicks by Source donut.">
                      Source
                    </LabelWithHelp>
                  </Label>
                  <Select value={source} onValueChange={(v) => setSource(v as LinkSource)}>
                    <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Traffic source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Social">Social</SelectItem>
                      <SelectItem value="Paid Ad">Paid Ad</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Banner">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* UTM Campaign */}
              <div className="space-y-1.5">
                <Label htmlFor="lnk-campaign" className="text-xs">
                  <LabelWithHelp help="UTM campaign parameter — surfaces in GA4 / Mixpanel alongside the ref code. Lowercase, underscore-separated.">
                    UTM Campaign
                  </LabelWithHelp>
                </Label>
                <Input
                  id="lnk-campaign"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  placeholder="q1_direct_push"
                  className="font-mono text-xs"
                  aria-label="UTM campaign"
                />
              </div>

              {/* Edit footer */}
              <div className="flex flex-row flex-wrap gap-2 border-t pt-4">
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContent>

      {/* Delete Link AlertDialog — destructive friction §24 */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete link {link.refCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              The tracking link will stop redirecting immediately. Past
              {` ${link.clicks.toLocaleString()} clicks and ${link.conversions} conversions`} data is{" "}
              <strong>retained</strong> for attribution reporting — only the
              link itself is removed. Existing marketing creative that points
              at this URL will return a 404. This action is logged in the
              audit trail and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep link</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDelete}
            >
              Delete link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
