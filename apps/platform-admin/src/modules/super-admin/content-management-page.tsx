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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  listContent,
  publishContent,
  createContent,
  runSeoAudit,
  requestLegalReview,
  useContentVersion,
} from "@/lib/platform/content-store";
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
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the persisted
  // content store is authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 450 }), []);
  useContentVersion();
  const content = listContent();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewItem = content.find((c) => c.id === previewId) ?? null;

  const handlePublish = (id: string) => {
    const item = publishContent(id);
    if (item) toast({ title: "Published", description: `${item.title} is now live — CDN purge queued.` });
  };

  const handleSeoAudit = () => {
    const count = runSeoAudit();
    toast({ title: "SEO audit queued", description: `Full-site audit queued across ${count} item(s). Results in Analytics.` });
  };

  const handleNewContent = () => {
    const item = createContent({ title: "Untitled draft", type: "page" });
    toast({ title: "Content created", description: `"${item.title}" created at ${item.slug} as a draft.` });
  };

  const handleLegalReview = () => {
    const routed = requestLegalReview();
    if (routed.length === 0) {
      toast({ title: "No documents to route", description: "All legal documents are already in review." });
      return;
    }
    toast({ title: "Legal review requested", description: `${routed.length} document(s) routed for counsel review.` });
  };

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
            <Button variant="outline" size="sm" onClick={handleSeoAudit}>
              <Search className="mr-1 h-4 w-4" /> SEO Audit
            </Button>
            <Button size="sm" onClick={handleNewContent}>
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
          hasData={hydrated !== undefined}
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
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setPreviewId(item.id)}>
                              <Eye className="h-3 w-3" /> Preview
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setPreviewId(item.id)}>
                              Edit
                            </Button>
                            {item.status !== "published" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handlePublish(item.id)}>
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
              <Button size="sm" variant="outline" className="w-full" onClick={handleLegalReview}>
                <RefreshCw className="mr-1 h-3 w-3" /> Request Legal Review
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview / edit detail dialog */}
        <Dialog open={previewId !== null} onOpenChange={(open) => { if (!open) setPreviewId(null); }}>
          <DialogContent>
            {previewItem && (
              <>
                <DialogHeader>
                  <DialogTitle>{previewItem.title}</DialogTitle>
                  <DialogDescription>
                    {previewItem.type} · <code className="font-mono">{previewItem.slug}</code> · {previewItem.status}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta title</p>
                    <p className="mt-0.5">{previewItem.metaTitle}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <p className="text-muted-foreground">SEO score</p>
                      <p className="mt-0.5 font-semibold">{previewItem.seoScore}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <p className="text-muted-foreground">Views</p>
                      <p className="mt-0.5 font-semibold">{previewItem.views.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <p className="text-muted-foreground">Updated</p>
                      <p className="mt-0.5 font-semibold">{new Date(previewItem.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Author: {previewItem.author} — editing opens the CMS editor with SEO fields included.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>Close</Button>
                  {previewItem.status !== "published" && (
                    <Button size="sm" onClick={() => { handlePublish(previewItem.id); setPreviewId(null); }}>Publish</Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
