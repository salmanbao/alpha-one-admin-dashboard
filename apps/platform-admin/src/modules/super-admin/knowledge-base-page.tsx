"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, Plus, Clock, Users, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Article {
  id: string;
  title: string;
  category: string;
  status: "published" | "draft" | "archived";
  reads: number;
  helpful: number;
  author: string;
  updated: string;
}

const initialArticles: Article[] = [
  { id: "KB-001", title: "Getting Started with PFaaS Platform", category: "Getting Started", status: "published", reads: 1840, helpful: 96, author: "Platform Team", updated: "2d ago" },
  { id: "KB-002", title: "Tenant Provisioning Guide", category: "Getting Started", status: "published", reads: 920, helpful: 88, author: "Platform Team", updated: "1w ago" },
  { id: "KB-003", title: "MT5 Bridge Integration", category: "Technical & Bridge", status: "published", reads: 640, helpful: 74, author: "Engineering", updated: "3d ago" },
  { id: "KB-004", title: "Payout Rail Configuration", category: "Payouts & Crypto", status: "published", reads: 410, helpful: 68, author: "Finance Ops", updated: "5d ago" },
  { id: "KB-005", title: "Risk Rule Enforcement", category: "Trading Rules", status: "published", reads: 380, helpful: 91, author: "Risk Team", updated: "1d ago" },
  { id: "KB-006", title: "Billing & Invoice Management", category: "Billing & Invoices", status: "draft", reads: 0, helpful: 0, author: "Platform Team", updated: "today" },
  { id: "KB-007", title: "Account Security Best Practices", category: "Account & Security", status: "published", reads: 220, helpful: 82, author: "Security", updated: "2w ago" },
  { id: "KB-008", title: "Platform API Reference", category: "Technical & Bridge", status: "archived", reads: 150, helpful: 55, author: "Engineering", updated: "1mo ago" },
];

const categories = ["All Categories", "Getting Started", "Trading Rules", "Payouts & Crypto", "Account & Security", "Technical & Bridge", "Billing & Invoices"];

export function KnowledgeBasePage() {
  const [articles, setArticles] = useState(initialArticles);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Getting Started");

  const create = () => {
    if (!title.trim() || !message.trim()) return;
    const art: Article = {
      id: `KB-${Date.now().toString(36).toUpperCase()}`,
      title, category: selectedCategory,
      status: "draft", reads: 0, helpful: 0,
      author: "Platform Admin", updated: "just now",
    };
    setArticles((prev) => [art, ...prev]);
    setTitle(""); setMessage(""); setShowForm(false);
    toast({ title: "Article created", description: `"${art.title}" saved as draft.` });
  };

  const filtered = articles.filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All Categories" || a.category === category;
    return matchSearch && matchCat;
  });

  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;
  const totalReads = articles.reduce((s, a) => s + a.reads, 0);

  return (
    <Page>
      <PageHeader
        title="Knowledge Base"
        description="Institutional documentation, operational runbooks, and platform guides — searchable and customer-ready."
        icon={BookOpen}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-1 h-4 w-4" /> {showForm ? "Cancel" : "New Article"}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Published Articles" value={published} icon={BookOpen} tone="positive" />
          <MetricCard label="Drafts" value={drafts} icon={Clock} />
          <MetricCard label="Total Reads" value={totalReads > 999 ? `${(totalReads / 1000).toFixed(1)}k` : String(totalReads)} icon={Users} />
          <MetricCard label="Avg Helpful" value={articles.length ? `${Math.round(articles.reduce((s, a) => s + a.helpful, 0) / articles.filter((a) => a.reads > 0).length)}%` : "0%"} icon={CheckCircle2} tone="positive" />
        </div>

        {showForm && (
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">New article</span></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title…" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {categories.filter((c) => c !== "All Categories").map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Content (markdown)</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your article content…" rows={6} className="mt-1 font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={create} disabled={!title.trim() || !message.trim()}>Create draft</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Search className="h-4 w-4" /> Knowledge Base Engine: Synchronized
          </div>
          <p className="mt-1">{articles.length} articles published · Index: Instant · Powered by platform documentation service</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles, keywords, error codes…" className="flex-1" />
            <Select value={category} onValueChange={(v) => setCategory(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No articles found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term or category.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{a.title}</h3>
                          <Badge variant="outline" className="text-[10px]">{a.id}</Badge>
                          <Badge variant={a.status === "published" ? "secondary" : a.status === "draft" ? "outline" : "destructive"} className="text-[9px]">{a.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{a.category} · {a.author} · Updated {a.updated}</p>
                        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{a.reads} reads</span>
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{a.helpful}% helpful</span>
                        </div>
                      </div>
                      {a.status === "published" && (
                        <Button size="sm" variant="ghost" className="text-xs text-rose-600" onClick={() => {
                          setArticles((prev) => prev.map((x) => x.id === a.id ? { ...x, status: "archived" as const } : x));
                          toast({ title: "Article archived", description: `"${a.title}" moved to archive.` });
                        }}>Archive</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
