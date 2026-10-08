"use client";

import { useState } from "react";
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

interface Announcement {
  id: string;
  title: string;
  message: string;
  scope: string;
  severity: "info" | "warning" | "critical";
  status: "draft" | "scheduled" | "visible" | "expired";
  start: string;
  end: string;
}

const initial: Announcement[] = [
  { id: "AN-001", title: "Platform maintenance window", message: "Scheduled maintenance on Saturday 2:00-4:00 UTC. Trading continues. New purchases temporarily unavailable.", scope: "All tenants", severity: "warning", status: "scheduled", start: "in 2d", end: "in 2d 2h" },
  { id: "AN-002", title: "New AI Insights module available", message: "AI Insights is now available for all Scale and Enterprise plans. Enable it in Settings → Modules.", scope: "All tenants", severity: "info", status: "visible", start: "3d ago", end: "in 11d" },
  { id: "AN-003", title: "MT5 Bridge degraded", message: "MT5 Bridge latency is elevated. We are investigating. Trading is unaffected.", scope: "Alpha Capital, Beta Trading", severity: "critical", status: "visible", start: "12m ago", end: "—" },
  { id: "AN-004", title: "v1.8.0 released", message: "New dashboard widgets, improved payout workflow, and trader-personal dashboard. See changelog.", scope: "All tenants", severity: "info", status: "expired", start: "5d ago", end: "2d ago" },
];

const sevTone = (s: Announcement["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : "info";

const statusTone = (s: Announcement["status"]) =>
  s === "visible" ? "success" : s === "scheduled" ? "info" : s === "expired" ? "muted" : "warning";

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("all");

  const create = () => {
    if (!title.trim() || !message.trim()) return;
    const ann: Announcement = {
      id: `AN-${Date.now().toString(36).toUpperCase()}`,
      title, message,
      scope: scope === "all" ? "All tenants" : "Selected tenants",
      severity: "info",
      status: "visible",
      start: "just now",
      end: "in 7d",
    };
    setAnnouncements((prev) => [ann, ...prev]);
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
                      setAnnouncements((prev) => prev.map((x) => x.id === a.id ? { ...x, status: "expired" } : x));
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
      </PageContent>
    </Page>
  );
}
