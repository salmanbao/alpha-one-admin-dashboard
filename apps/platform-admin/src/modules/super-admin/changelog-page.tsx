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
import { BookOpen, Search, Plus, Clock, GitBranch, Users, MessageSquare, CheckCircle2, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Release {
  id: string;
  version: string;
  title: string;
  date: string;
  type: "major" | "minor" | "patch" | "hotfix";
  changes: string[];
  notes: string;
  views: number;
  subscribers: number;
  status: "published" | "draft" | "scheduled";
}

const initialReleases: Release[] = [
  { id: "RL-001", version: "v1.8.0", title: "Dashboard Widgets & Payout Workflow", date: "2d ago", type: "minor", changes: ["New dashboard widgets: KPI metric cards, table feed streams, per-widget configuration", "Improved payout workflow with bulk approval queue and two-person policy", "Trader-personal dashboard with saved views and multi-dashboard switcher", "Platform audit log with cryptographic proof export (WORM dossier)"], notes: "This release adds the dashboard manager, enhanced payouts, and a personal dashboard for traders.", views: 340, subscribers: 48, status: "published" },
  { id: "RL-002", version: "v1.7.9", title: "KYC Provider Marketplace", date: "1w ago", type: "minor", changes: ["KYC provider marketplace with side-by-side spec matrix comparison", "Provider connection test diagnostics with ping state", "Active provider switching with confirmation alert dialog"], notes: "Providers can now be compared, tested, and switched from a unified marketplace.", views: 210, subscribers: 32, status: "published" },
  { id: "RL-003", version: "v1.7.8", title: "AI Insights & Cost Tracking", date: "2w ago", type: "minor", changes: ["AI Insights with per-insight detail, snooze, and SHAP attribution", "AI cost tracking with model unit economics and spend cap alerts", "Fine-tuning job configuration with cancel confirmation"], notes: "AI capabilities expanded with cost visibility and model diagnostics.", views: 180, subscribers: 28, status: "published" },
  { id: "RL-004", version: "v1.7.7", title: "Emergency Controls & Kill Switches", date: "1mo ago", type: "patch", changes: ["Fleet-wide disable kill-switch modal for super admin", "Tenant parameter overrides sheet for module configuration", "Emergency suspend kill-switch confirmation for tenant lifecycle"], notes: "Emergency controls hardened with super-admin fleet actions.", views: 95, subscribers: 18, status: "published" },
  { id: "RL-005", version: "v1.7.6", title: "Service Catalog & Module Orchestration", date: "1mo ago", type: "patch", changes: ["Bulk module orchestration modal for service catalog", "Module manifest changelog sheet", "Architectural decision record (ADR) deep-dive modal"], notes: "Service catalog gained bulk operations and detailed module history.", views: 72, subscribers: 12, status: "published" },
];

const types: { value: Release["type"]; label: string; color: string }[] = [
  { value: "major", label: "Major", color: "rose" },
  { value: "minor", label: "Minor", color: "amber" },
  { value: "patch", label: "Patch", color: "sky" },
  { value: "hotfix", label: "Hotfix", color: "rose" },
];

export function ChangelogPage() {
  const [releases, setReleases] = useState(initialReleases);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Release["type"] | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [changes, setChanges] = useState("");

  const create = () => {
    if (!version.trim() || !title.trim()) return;
    const rel: Release = {
      id: `RL-${Date.now().toString(36).toUpperCase()}`,
      version, title,
      date: "just now",
      type: "patch",
      changes: changes.split("\n").filter(Boolean),
      notes: notes || "No release notes yet.",
      views: 0, subscribers: 0,
      status: "draft",
    };
    setReleases((prev) => [rel, ...prev]);
    setVersion(""); setTitle(""); setNotes(""); setChanges(""); setShowForm(false);
    toast({ title: "Release draft created", description: `"${version}" saved as draft.` });
  };

  const filtered = releases.filter((r) => {
    const matchSearch = !search || r.version.toLowerCase().includes(search.toLowerCase()) || r.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const published = releases.filter((r) => r.status === "published").length;
  const totalViews = releases.reduce((s, r) => s + r.views, 0);

  return (
    <Page>
      <PageHeader
        title="What's New"
        description="Release history, changelog, and release notes for the PFaaS platform."
        icon={BookOpen}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-1 h-4 w-4" /> {showForm ? "Cancel" : "New Release"}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Published Releases" value={published} icon={GitBranch} tone="positive" />
          <MetricCard label="Total Views" value={totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews} icon={Eye} />
          <MetricCard label="Subscribers" value={releases.reduce((s, r) => s + r.subscribers, 0)} icon={Users} />
          <MetricCard label="Latest" value="v1.8.0" icon={Clock} tone="positive" />
        </div>

        {showForm && (
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">New release</span></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Version</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.9.0" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Release title…" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Release notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Summary of changes…" rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Detailed changes (one per line)</Label>
                <Textarea value={changes} onChange={(e) => setChanges(e.target.value)} placeholder="- Changed item one\n- Changed item two" rows={4} className="mt-1 font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={create} disabled={!version.trim() || !title.trim()}>Create draft</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <GitBranch className="h-4 w-4" /> PFaaS Platform · Changelog Engine: Synchronized
          </div>
          <p className="mt-1">{releases.length} releases published · v1.8.0 is the current release</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search releases, versions…" className="flex-1" />
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "all" : v as Release["type"])}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No releases found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term or filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const typeInfo = types.find((t) => t.value === r.type)!;
                return (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${typeInfo.color === "rose" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" : typeInfo.color === "amber" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "border-sky-500/30 text-sky-700 dark:text-sky-400"}`}>
                              {r.type}
                            </Badge>
                            <span className="font-mono text-sm font-semibold">{r.version}</span>
                            <Badge variant="outline" className="text-[10px]">{r.id}</Badge>
                            {r.status === "draft" && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400">Draft</Badge>}
                          </div>
                          <h3 className="mt-1 text-base font-semibold">{r.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{r.date} · {r.notes}</p>
                          {r.changes.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {r.changes.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <span className="mt-0.5 text-primary">→</span> {c}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{r.views} views</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.subscribers} subscribers</span>
                          </div>
                        </div>
                        {r.status === "published" && (
                          <Button size="sm" variant="ghost" className="text-xs text-rose-600" onClick={() => {
                            setReleases((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "draft" as const } : x));
                            toast({ title: "Release reverted to draft", description: `"${r.version}" is now a draft.` });
                          }}>Revert</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
