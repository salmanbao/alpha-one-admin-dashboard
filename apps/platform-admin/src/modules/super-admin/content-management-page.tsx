"use client";

/**
 * Content Management Page — CMS for pages, blogs, FAQs, legal docs (M13 Content Management).
 *
 * Stitch screen: (new)
 * Tier 2 — Content list with SEO metadata, publish workflow, legal document registry.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  Globe,
  FileCheck,
  BookOpen,
  Newspaper,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const demoContent = [
  { id: "cnt-001", title: "Pricing Page", type: "page", slug: "/pricing", status: "published", author: "Marketing Team", seoScore: 92, metaTitle: "Prop Firm as a Service — Pricing", updatedAt: "2026-10-05T10:00:00Z", views: 24500 },
  { id: "cnt-002", title: "How Challenge Payouts Work", type: "blog", slug: "/blog/how-payouts-work", status: "published", author: "Content Team", seoScore: 88, metaTitle: "How Prop Firm Payouts Work (2026 Guide)", updatedAt: "2026-10-02T14:30:00Z", views: 18200 },
  { id: "cnt-003", title: "FAQ — Account Scaling", type: "faq", slug: "/faq/scaling", status: "published", author: "Support Team", seoScore: 74, metaTitle: "Scaling Rules FAQ", updatedAt: "2026-09-28T09:15:00Z", views: 9800 },
  { id: "cnt-004", title: "Terms of Service", type: "legal", slug: "/legal/terms", status: "published", author: "Legal Team", seoScore: 60, metaTitle: "Terms of Service", updatedAt: "2026-08-15T11:00:00Z", views: 5400 },
  { id: "cnt-005", title: "Privacy Policy (GDPR)", type: "legal", slug: "/legal/privacy", status: "published", author: "Legal Team", seoScore: 65, metaTitle: "Privacy Policy — GDPR Compliance", updatedAt: "2026-09-10T16:45:00Z", views: 6100 },
  { id: "cnt-006", title: "Affiliate Program Landing", type: "landing", slug: "/affiliates", status: "draft", author: "Growth Team", seoScore: 45, metaTitle: "Earn with the PFAAS Affiliate Program", updatedAt: "2026-10-07T18:00:00Z", views: 0 },
  { id: "cnt-007", title: "Blog — Risk Management Basics", type: "blog", slug: "/blog/risk-basics", status: "draft", author: "Content Team", seoScore: 52, metaTitle: "Risk Management Basics for Traders", updatedAt: "2026-10-06T12:20:00Z", views: 0 },
  { id: "cnt-008", title: "Cookie Policy", type: "legal", slug: "/legal/cookies", status: "review", author: "Legal Team", seoScore: 58, metaTitle: "Cookie Policy", updatedAt: "2026-10-08T08:30:00Z", views: 2300 },
];

const typeMeta: Record<string, { icon: typeof FileText; color: string }> = {
  page: { icon: FileText, color: "#4a7c59" },
  blog: { icon: Newspaper, color: "#705c30" },
  faq: { icon: HelpCircle, color: "#6b6358" },
  legal: { icon: FileCheck, color: "#b83230" },
  landing: { icon: Globe, color: "#74796e" },
};

const statusTones: Record<string, "success" | "warning" | "info"> = {
  published: "success",
  draft: "warning",
  review: "info",
};

function SeoBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#4a7c59" : score >= 60 ? "#705c30" : "#b83230";
  return (
    <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>
      SEO {score}
    </Badge>
  );
}

export function ContentManagementPage() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoContent, { delayMs: 450 }), []);
  const content = loadedData ?? [];
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return content.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.slug.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [content, search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: content.length,
    published: content.filter((c) => c.status === "published").length,
    drafts: content.filter((c) => c.status === "draft").length,
    avgSeo: Math.round(content.reduce((s, c) => s + c.seoScore, 0) / content.length),
    totalViews: content.reduce((s, c) => s + c.views, 0),
  }), [content]);

  return (
    <Page>
      <PageHeader
        title="Content Management"
        description="Pages, blogs, FAQs, landing pages, and legal documents."
        icon={FileText}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "SEO audit", description: "Full-site SEO audit queued. Results in Analytics." })}>
              <Search className="mr-1 h-4 w-4" /> SEO Audit
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New content", description: "Content form: type, title, slug, body, SEO metadata." })}>
              <Plus className="mr-1 h-4 w-4" /> New Content
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading content…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Content Items" value={stats.total} icon={FileText} />
          <MetricCard label="Published" value={stats.published} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Drafts" value={stats.drafts} icon={AlertTriangle} tone="warning" />
          <MetricCard label="Avg SEO Score" value={stats.avgSeo} icon={Globe} tone={stats.avgSeo >= 70 ? "positive" : "warning"} />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search content by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={typeFilter === "all" ? "default" : "outline"} onClick={() => setTypeFilter("all")}>All Types</Button>
            {Object.keys(typeMeta).map((t) => (
              <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => setTypeFilter(t)} className="text-[10px] capitalize">
                {t}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>Any Status</Button>
            <Button size="sm" variant={statusFilter === "published" ? "default" : "outline"} onClick={() => setStatusFilter("published")} className="text-[10px]">Published</Button>
            <Button size="sm" variant={statusFilter === "draft" ? "default" : "outline"} onClick={() => setStatusFilter("draft")} className="text-[10px]">Draft</Button>
            <Button size="sm" variant={statusFilter === "review" ? "default" : "outline"} onClick={() => setStatusFilter("review")} className="text-[10px]">Review</Button>
          </div>
        </div>

        {/* Content table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slug</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Views</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => {
                    const meta = typeMeta[item.type];
                    const Icon = meta?.icon ?? FileText;
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 shrink-0 rounded flex items-center justify-center" style={{ background: `${meta?.color ?? "#6b6358"}20`, color: meta?.color ?? "#6b6358" }}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">{item.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: meta?.color, color: meta?.color }}>
                            {item.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{item.slug}</code>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.author}</td>
                        <td className="px-4 py-3"><SeoBadge score={item.seoScore} /></td>
                        <td className="px-4 py-3 text-sm">{item.views.toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge tone={statusTones[item.status]}>{item.status}</StatusBadge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Preview", description: `Previewing ${item.title} at ${item.slug}.` })}>
                              <Eye className="h-3 w-3" /> Preview
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Editor opened", description: `Editing ${item.title}. SEO fields included.` })}>
                              Edit
                            </Button>
                            {item.status !== "published" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Published", description: `${item.title} is now live. CDN purge queued.` })}>
                                <Send className="h-3 w-3" /> Publish
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 font-medium">No content found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SEO + legal summary */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">SEO Health</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Score 80+ (Excellent)", count: content.filter((c) => c.seoScore >= 80).length, color: "#4a7c59" },
                { label: "Score 60–79 (Needs work)", count: content.filter((c) => c.seoScore >= 60 && c.seoScore < 80).length, color: "#705c30" },
                { label: "Score <60 (Critical)", count: content.filter((c) => c.seoScore < 60).length, color: "#b83230" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-sm" style={{ color: row.color }}>{row.label}</span>
                  <span className="text-sm font-bold">{row.count}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Total page views (all content): {stats.totalViews.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Legal Documents</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {content.filter((c) => c.type === "legal").map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4" style={{ color: "#b83230" }} />
                    <span className="text-sm font-medium">{doc.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    <StatusBadge tone={statusTones[doc.status]}>{doc.status}</StatusBadge>
                  </div>
                </div>
              ))}
              <Separator className="my-2" />
              <Button size="sm" variant="outline" className="w-full" onClick={() => toast({ title: "Legal review", description: "Legal documents routed for counsel review. Audited." })}>
                <RefreshCw className="mr-1 h-3 w-3" /> Request Legal Review
              </Button>
            </CardContent>
          </Card>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
