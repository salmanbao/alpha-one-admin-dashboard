"use client";

/**
 * Content Management page (M16 Website / CMS Builder).
 *
 * Tenant website content: marketing/landing/legal pages, blog posts,
 * and per-page SEO metadata. Complements Banners, Social Media Links,
 * and Terms & Policies which already live elsewhere in Settings.
 *
 * Layout:
 *  - PageHeader with "New Page" + "New Post" actions
 *  - KPI row: Published Pages, Blog Posts, Avg SEO Score, Drafts
 *  - Site card: custom domain + SSL, sitemap submit, search indexing
 *  - Website Pages DataTable (title, path, type, status, SEO score,
 *    updated) with Edit SEO / Publish toggle / Delete actions
 *  - Blog Posts DataTable (title, author, status, date, views) with
 *    Publish toggle / Delete
 *  - SEO editor Dialog with live score (title/description length +
 *    focus keyword checks) per M16 "SEO Management"
 *  - Create dialogs for pages and posts (mock data only)
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Files,
  FileText,
  Plus,
  PenLine,
  Globe,
  Lock,
  Search,
  Send,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type PageStatus = "published" | "draft" | "archived";
type PageType = "landing" | "pricing" | "legal" | "utility";
type PostStatus = "published" | "draft" | "scheduled";

interface SitePage {
  id: string;
  title: string;
  path: string;
  type: PageType;
  status: PageStatus;
  updatedAt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

interface BlogPost {
  id: string;
  title: string;
  author: string;
  status: PostStatus;
  publishedAt: string | null;
  views: number;
}

const DEMO_PAGES: SitePage[] = [
  {
    id: "pg-101",
    title: "Home",
    path: "/",
    type: "landing",
    status: "published",
    updatedAt: "2026-10-06T14:12:00Z",
    metaTitle: "Alpha Capital — Prove Your Edge, Get Funded",
    metaDescription: "Trade our capital. Pass the evaluation, get funded up to $200k and keep up to 90% of profits.",
    focusKeyword: "funded trading",
  },
  {
    id: "pg-102",
    title: "Pricing & Challenges",
    path: "/pricing",
    type: "pricing",
    status: "published",
    updatedAt: "2026-10-05T09:40:00Z",
    metaTitle: "Challenge Pricing — Alpha Capital",
    metaDescription: "Compare 1-step and 2-step evaluation pricing. Refundable fee on first payout.",
    focusKeyword: "challenge pricing",
  },
  {
    id: "pg-103",
    title: "Two-Step Evaluation Landing",
    path: "/two-step",
    type: "landing",
    status: "draft",
    updatedAt: "2026-10-07T18:25:00Z",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "two-step challenge",
  },
  {
    id: "pg-104",
    title: "Terms of Service",
    path: "/legal/terms",
    type: "legal",
    status: "published",
    updatedAt: "2026-09-12T11:02:00Z",
    metaTitle: "Terms of Service — Alpha Capital",
    metaDescription: "Terms governing use of the Alpha Capital evaluation and funded account services.",
    focusKeyword: "terms of service",
  },
  {
    id: "pg-105",
    title: "Privacy Policy",
    path: "/legal/privacy",
    type: "legal",
    status: "published",
    updatedAt: "2026-09-12T11:05:00Z",
    metaTitle: "Privacy Policy — Alpha Capital",
    metaDescription: "How Alpha Capital collects, uses, and protects trader data (GDPR aligned).",
    focusKeyword: "privacy policy",
  },
  {
    id: "pg-106",
    title: "Affiliate Program",
    path: "/affiliates",
    type: "landing",
    status: "published",
    updatedAt: "2026-09-28T16:31:00Z",
    metaTitle: "Affiliate Program — Earn 15% Commission",
    metaDescription: "Promote Alpha Capital and earn recurring commission on every referred trader.",
    focusKeyword: "affiliate program",
  },
  {
    id: "pg-107",
    title: "Contact",
    path: "/contact",
    type: "utility",
    status: "published",
    updatedAt: "2026-08-30T10:14:00Z",
    metaTitle: "Contact Support — Alpha Capital",
    metaDescription: "Reach the Alpha Capital support team. Average first response under 2 hours.",
    focusKeyword: "contact support",
  },
  {
    id: "pg-108",
    title: "Old Summer Promo",
    path: "/summer-2025",
    type: "landing",
    status: "archived",
    updatedAt: "2026-07-01T08:00:00Z",
    metaTitle: "Summer Promotion 2025",
    metaDescription: "Archived seasonal promotion page.",
    focusKeyword: "promotion",
  },
];

const DEMO_POSTS: BlogPost[] = [
  { id: "bp-51", title: "How to Pass a Two-Step Evaluation Without Overtrading", author: "Maya Okafor", status: "published", publishedAt: "2026-10-04T08:00:00Z", views: 4820 },
  { id: "bp-50", title: "Understanding Trailing Drawdown in Funded Accounts", author: "Maya Okafor", status: "published", publishedAt: "2026-09-27T08:00:00Z", views: 3611 },
  { id: "bp-49", title: "Risk Rituals: The 3-Trade Daily Cap", author: "Daniel Reyes", status: "published", publishedAt: "2026-09-20T08:00:00Z", views: 2987 },
  { id: "bp-48", title: "Payout Cycles Explained: Twice-Daily Disbursement", author: "Finance Desk", status: "draft", publishedAt: null, views: 0 },
  { id: "bp-47", title: "News Trading Policy Update — NFP & CPI", author: "Risk Team", status: "scheduled", publishedAt: "2026-10-10T12:00:00Z", views: 0 },
  { id: "bp-46", title: "Copy Trading Rings: What Our Toxicity Detects", author: "Risk Team", status: "draft", publishedAt: null, views: 0 },
];

const PAGE_STATUS_TONES: Record<PageStatus, "success" | "warning" | "muted"> = {
  published: "success",
  draft: "warning",
  archived: "muted",
};

const POST_STATUS_TONES: Record<PostStatus, "success" | "warning" | "info"> = {
  published: "success",
  draft: "warning",
  scheduled: "info",
};

const TYPE_LABELS: Record<PageType, string> = {
  landing: "Landing",
  pricing: "Pricing",
  legal: "Legal",
  utility: "Utility",
};

/** Live SEO score (0-100): title, description, keyword, length rules. */
function seoScore(p: Pick<SitePage, "metaTitle" | "metaDescription" | "focusKeyword">): number {
  let score = 0;
  if (p.metaTitle.trim().length >= 10) score += 30;
  else if (p.metaTitle.trim().length > 0) score += 10;
  if (p.metaDescription.trim().length >= 70 && p.metaDescription.trim().length <= 160) score += 30;
  else if (p.metaDescription.trim().length >= 40) score += 15;
  if (p.focusKeyword.trim().length >= 3) {
    score += 20;
    const kw = p.focusKeyword.trim().toLowerCase();
    if (p.metaTitle.toLowerCase().includes(kw)) score += 10;
    if (p.metaDescription.toLowerCase().includes(kw)) score += 10;
  }
  return score;
}

function scoreTone(score: number): "success" | "warning" | "danger" {
  return score >= 80 ? "success" : score >= 50 ? "warning" : "danger";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ContentManagementPage() {
  const [pages, setPages] = useState<SitePage[]>(DEMO_PAGES);
  const [posts, setPosts] = useState<BlogPost[]>(DEMO_POSTS);

  // Site settings (M16: custom domain + SSL, sitemap, indexing)
  const [customDomain, setCustomDomain] = useState("alphacapital.io");
  const [sslAutoRenew, setSslAutoRenew] = useState(true);
  const [searchIndexing, setSearchIndexing] = useState(true);

  // Create page dialog
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newType, setNewType] = useState<PageType>("landing");

  // Create post dialog
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostAuthor, setNewPostAuthor] = useState("Maya Okafor");

  // SEO editor
  const [seoTargetId, setSeoTargetId] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");

  // Delete confirm (page or post)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "page" | "post"; id: string; label: string } | null>(null);

  const stats = useMemo(() => {
    const publishedPages = pages.filter((p) => p.status === "published").length;
    const drafts = pages.filter((p) => p.status === "draft").length + posts.filter((p) => p.status === "draft").length;
    const live = pages.filter((p) => p.status !== "archived");
    const avgScore = live.length ? Math.round(live.reduce((sum, p) => sum + seoScore(p), 0) / live.length) : 0;
    return { publishedPages, blogPosts: posts.length, drafts, avgScore };
  }, [pages, posts]);

  const seoTarget = pages.find((p) => p.id === seoTargetId) ?? null;
  const liveSeoScore = seoTarget ? seoScore({ metaTitle: seoTitle, metaDescription: seoDesc, focusKeyword: seoKeyword }) : 0;

  /* ---------------- actions ---------------- */

  const createPage = () => {
    if (!newTitle.trim() || !newPath.trim()) {
      toast({ title: "Title and path required", description: "Give the page a title and a URL path.", variant: "destructive" });
      return;
    }
    const path = newPath.startsWith("/") ? newPath : `/${newPath}`;
    setPages((prev) => [
      {
        id: `pg-${109 + prev.length}`,
        title: newTitle.trim(),
        path,
        type: newType,
        status: "draft",
        updatedAt: new Date().toISOString(),
        metaTitle: "",
        metaDescription: "",
        focusKeyword: "",
      },
      ...prev,
    ]);
    toast({ title: "Page created", description: `${path} saved as a draft. Add SEO metadata before publishing.` });
    setPageDialogOpen(false);
    setNewTitle("");
    setNewPath("");
    setNewType("landing");
  };

  const createPost = () => {
    if (!newPostTitle.trim()) {
      toast({ title: "Title required", description: "Give the post a title.", variant: "destructive" });
      return;
    }
    setPosts((prev) => [
      { id: `bp-${52 + prev.length}`, title: newPostTitle.trim(), author: newPostAuthor, status: "draft", publishedAt: null, views: 0 },
      ...prev,
    ]);
    toast({ title: "Post created", description: "Draft saved to the blog queue." });
    setPostDialogOpen(false);
    setNewPostTitle("");
  };

  const togglePublish = (p: SitePage) => {
    const next: PageStatus = p.status === "published" ? "draft" : "published";
    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next, updatedAt: new Date().toISOString() } : x)));
    toast(
      next === "published"
        ? { title: "Page published", description: `${p.path} is live${seoScore(p) >= 80 ? "" : " — SEO score is low, consider improving metadata"}.` }
        : { title: "Page unpublished", description: `${p.path} moved back to draft.` },
    );
  };

  const togglePost = (p: BlogPost) => {
    const next: PostStatus = p.status === "published" ? "draft" : "published";
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, status: next, publishedAt: next === "published" ? new Date().toISOString() : x.publishedAt } : x,
      ),
    );
    toast({ title: next === "published" ? "Post published" : "Post unpublished", description: p.title });
  };

  const openSeoEditor = (p: SitePage) => {
    setSeoTargetId(p.id);
    setSeoTitle(p.metaTitle);
    setSeoDesc(p.metaDescription);
    setSeoKeyword(p.focusKeyword);
  };

  const saveSeo = () => {
    if (!seoTarget) return;
    setPages((prev) =>
      prev.map((x) =>
        x.id === seoTarget.id
          ? { ...x, metaTitle: seoTitle, metaDescription: seoDesc, focusKeyword: seoKeyword, updatedAt: new Date().toISOString() }
          : x,
      ),
    );
    toast({ title: "SEO metadata saved", description: `${seoTarget.path} — score ${liveSeoScore}/100.` });
    setSeoTargetId(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "page") {
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    toast({ title: deleteTarget.kind === "page" ? "Page deleted" : "Post deleted", description: deleteTarget.label });
    setDeleteTarget(null);
  };

  const submitSitemap = () => {
    toast({ title: "Sitemap submitted", description: `https://${customDomain}/sitemap.xml pinged to search engines.` });
  };

  /* ---------------- columns ---------------- */

  const pageColumns: Column<SitePage>[] = [
    {
      key: "title",
      header: "Page",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.title}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{row.path}</p>
        </div>
      ),
      sortValue: (row) => row.title,
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[row.type]}</Badge>,
      sortValue: (row) => row.type,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={PAGE_STATUS_TONES[row.status]}>{row.status}</StatusBadge>,
      sortValue: (row) => row.status,
    },
    {
      key: "seo",
      header: "SEO",
      cell: (row) => {
        const s = seoScore(row);
        return (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className={s >= 80 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-rose-600"}>{s}</span>
            <span className="text-[10px] font-normal text-muted-foreground">/100</span>
          </span>
        );
      },
      numeric: true,
      sortValue: (row) => seoScore(row),
    },
    {
      key: "updated",
      header: "Updated",
      cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString()}</span>,
      sortValue: (row) => row.updatedAt,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => openSeoEditor(row)}>
            <Search className="mr-1 h-3 w-3" /> SEO
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => togglePublish(row)}>
            {row.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
            aria-label={`Delete ${row.title}`}
            onClick={() => setDeleteTarget({ kind: "page", id: row.id, label: `${row.title} (${row.path})` })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  const postColumns: Column<BlogPost>[] = [
    {
      key: "title",
      header: "Post",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.title}</p>
          <p className="text-[11px] text-muted-foreground">{row.author}</p>
        </div>
      ),
      sortValue: (row) => row.title,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={POST_STATUS_TONES[row.status]}>{row.status}</StatusBadge>,
      sortValue: (row) => row.status,
    },
    {
      key: "date",
      header: "Published",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : "—"}</span>
      ),
      sortValue: (row) => row.publishedAt ?? "",
    },
    {
      key: "views",
      header: "Views",
      cell: (row) => <span className="text-sm">{row.views.toLocaleString()}</span>,
      numeric: true,
      sortValue: (row) => row.views,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => togglePost(row)}>
            {row.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
            aria-label={`Delete ${row.title}`}
            onClick={() => setDeleteTarget({ kind: "post", id: row.id, label: row.title })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Content Management"
        description="Manage website pages, blog posts, and SEO metadata for the tenant site (M16 CMS)."
        icon={Files}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPostDialogOpen(true)}>
              <PenLine className="mr-1 h-4 w-4" /> New Post
            </Button>
            <Button size="sm" onClick={() => setPageDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Page
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Published Pages" value={stats.publishedPages} icon={FileText} tone="positive" />
          <MetricCard label="Blog Posts" value={stats.blogPosts} icon={PenLine} />
          <MetricCard label="Avg SEO Score" value={`${stats.avgScore}/100`} icon={Search} tone={stats.avgScore >= 80 ? "positive" : "warning"} />
          <MetricCard label="Drafts" value={stats.drafts} icon={Pencil} tone={stats.drafts > 0 ? "warning" : "positive"} />
        </div>

        {/* Site settings (M16: custom domain + SSL, sitemap, indexing) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Globe className="h-4 w-4" /> Site & Domain
              </h2>
              <Button size="sm" variant="outline" onClick={submitSitemap}>
                <Send className="mr-1 h-3 w-3" /> Submit Sitemap
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="cm-domain">Custom Domain</Label>
              <Input id="cm-domain" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-medium">SSL Certificate</p>
                  <p className="text-[10px] text-muted-foreground">Valid · auto-renew {sslAutoRenew ? "on" : "off"}</p>
                </div>
              </div>
              <Switch checked={sslAutoRenew} onCheckedChange={setSslAutoRenew} aria-label="SSL auto renew" />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
              <div>
                <p className="text-xs font-medium">Search Indexing</p>
                <p className="text-[10px] text-muted-foreground">{searchIndexing ? "index, follow" : "noindex"}</p>
              </div>
              <Switch checked={searchIndexing} onCheckedChange={setSearchIndexing} aria-label="Search indexing" />
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium">Sitemap</p>
              <p className="text-[10px] text-muted-foreground font-mono">/sitemap.xml · {pages.filter((p) => p.status === "published").length} URLs</p>
            </div>
          </CardContent>
        </Card>

        {/* Website pages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Website Pages</h2>
              <Button size="sm" onClick={() => setPageDialogOpen(true)}>
                <Plus className="mr-1 h-3 w-3" /> New Page
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={pageColumns}
              data={pages}
              rowKey={(row) => row.id}
              searchableText={(row) => `${row.title} ${row.path} ${row.type} ${row.status} ${row.focusKeyword}`}
              searchPlaceholder="Search pages…"
              pageSize={6}
              emptyTitle="No pages yet"
              emptyDescription="Create the first page for this tenant's website."
            />
          </CardContent>
        </Card>

        {/* Blog posts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Blog / Content</h2>
              <Button size="sm" variant="outline" onClick={() => setPostDialogOpen(true)}>
                <Plus className="mr-1 h-3 w-3" /> New Post
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={postColumns}
              data={posts}
              rowKey={(row) => row.id}
              searchableText={(row) => `${row.title} ${row.author} ${row.status}`}
              searchPlaceholder="Search posts…"
              pageSize={6}
              emptyTitle="No posts"
              emptyDescription="Write the first blog post to start content marketing."
            />
            <Separator />
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Drafts are private. Scheduled posts publish automatically at their timestamp; all publish events are written to the
              audit log.
            </div>
          </CardContent>
        </Card>
      </PageContent>

      {/* Create page dialog */}
      <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
            <DialogDescription>Creates a draft page. Add SEO metadata before publishing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cm-title">Title</Label>
              <Input id="cm-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Trading Competitions" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-path">Path</Label>
              <Input id="cm-path" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/competitions" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TYPE_LABELS) as PageType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={newType === t}
                    onClick={() => setNewType(t)}
                    className={
                      newType === t
                        ? "rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                        : "rounded-md border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageDialogOpen(false)}>Cancel</Button>
            <Button onClick={createPage}><FileText className="mr-1 h-4 w-4" /> Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create post dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Blog Post</DialogTitle>
            <DialogDescription>Saves a draft into the blog queue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cm-post-title">Title</Label>
              <Input id="cm-post-title" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="e.g. 5 Habits of Funded Traders" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-post-author">Author</Label>
              <Input id="cm-post-author" value={newPostAuthor} onChange={(e) => setNewPostAuthor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
            <Button onClick={createPost}><PenLine className="mr-1 h-4 w-4" /> Save Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEO editor */}
      <Dialog open={seoTarget !== null} onOpenChange={(open) => !open && setSeoTargetId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SEO — {seoTarget?.title ?? ""}</DialogTitle>
            <DialogDescription>
              Meta title, description, and focus keyword for <code className="font-mono text-xs">{seoTarget?.path}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Live SEO Score</p>
              </div>
              <span className="flex items-center gap-2">
                <span className={`text-lg font-bold ${liveSeoScore >= 80 ? "text-emerald-600" : liveSeoScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                  {liveSeoScore}
                </span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-seo-title">Meta Title ({seoTitle.length}/60)</Label>
              <Input id="cm-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder="Shown as the search result headline" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-seo-desc">Meta Description ({seoDesc.length}/160)</Label>
              <Textarea id="cm-seo-desc" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={180} rows={3} placeholder="1-2 sentence summary for search engines." className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-seo-kw">Focus Keyword</Label>
              <Input id="cm-seo-kw" value={seoKeyword} onChange={(e) => setSeoKeyword(e.target.value)} placeholder="e.g. funded trading" className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">Scoring: title ≥10 chars (30), description 70-160 chars (30), keyword present in title + description (40).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeoTargetId(null)}>Cancel</Button>
            <Button onClick={saveSeo}><CheckCircle2 className="mr-1 h-4 w-4" /> Save Metadata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.kind === "post" ? "post" : "page"}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{deleteTarget?.label}</span> will be permanently removed. Published URLs return 404
              immediately; existing inbound links are not redirected automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
