"use client";

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Clock, CheckCircle2, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listAnnouncements,
  publishAnnouncement,
  expireAnnouncement,
  useAnnouncementsVersion,
  type Announcement,
} from "@/lib/platform/announcements-store";

const sevTone = (s: Announcement["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : "info";

const statusTone = (s: Announcement["status"]) =>
  s === "visible" ? "success" : s === "scheduled" ? "info" : s === "expired" ? "muted" : "warning";

export function AnnouncementsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  useAnnouncementsVersion();
  const announcements = listAnnouncements();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("all");

  const create = () => {
    if (!title.trim() || !message.trim()) return;
    const ann = publishAnnouncement({
      title,
      message,
      scope: scope === "all" ? "All tenants" : "Selected tenants",
    });
    setTitle(""); setMessage(""); setScope("all"); setShowForm(false);
    toast({ title: "Announcement published", description: `"${ann.title}" is now visible to ${ann.scope}.` });
  };

  const visible = announcements.filter((a) => a.status === "visible").length;
  const scheduled = announcements.filter((a) => a.status === "scheduled").length;

  return (
    <Page>
      <PageHeader
        title="Announcements"
        description="Platform-wide or tenant-specific communication. Lifecycle: Draft → Scheduled → Visible → Expired."
        icon={Bell}
        actions={<Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="mr-1 h-4 w-4" /> Create</Button>}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading announcements…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Visible" value={visible} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Scheduled" value={scheduled} icon={Clock} />
          <MetricCard label="Drafts" value={announcements.filter((a) => a.status === "draft").length} icon={Bell} />
          <MetricCard label="Expired" value={announcements.filter((a) => a.status === "expired").length} icon={Clock} />
        </div>

        {showForm && (
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">New announcement</span></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title…" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement message…" rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Scope</Label>
                <select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="all">All tenants</option>
                  <option value="selected">Selected tenants</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={create} disabled={!title.trim() || !message.trim()}>Publish</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{a.title}</h3>
                      <StatusBadge tone={sevTone(a.severity)}>{a.severity}</StatusBadge>
                      <StatusBadge tone={statusTone(a.status)}>{a.status}</StatusBadge>
                      <Badge variant="outline" className="text-[10px]">{a.id}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{a.scope}</span>
                      <span>Start: {a.start}</span>
                      <span>End: {a.end}</span>
                    </div>
                  </div>
                  {a.status === "visible" && (
                    <Button size="sm" variant="ghost" className="text-xs text-rose-600" onClick={() => {
                      expireAnnouncement(a.id);
                      toast({ title: "Announcement expired", description: `"${a.title}" is no longer visible.` });
                    }}>
                      Expire now
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
