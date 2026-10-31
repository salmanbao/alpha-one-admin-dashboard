"use client";

import { useState, useMemo } from "react";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  { id: "AN-001", title: "Platform maintenance window", message: "Scheduled maintenance on Saturday 2:00-4:00 UTC. Trading continues. New purchases temporarily unavailable.", scope: "All traders", severity: "warning", status: "scheduled", start: "in 2d", end: "in 2d 2h" },
  { id: "AN-002", title: "New AI Insights module available", message: "AI Insights is now available for all Scale and Enterprise plans. Enable it in Settings → Modules.", scope: "All traders", severity: "info", status: "visible", start: "3d ago", end: "in 11d" },
  { id: "AN-003", title: "MT5 Bridge degraded", message: "MT5 Bridge latency is elevated. We are investigating. Trading is unaffected.", scope: "All traders", severity: "critical", status: "visible", start: "12m ago", end: "—" },
  { id: "AN-004", title: "v1.8.0 released", message: "New dashboard widgets, improved payout workflow, and trader-personal dashboard. See changelog.", scope: "All traders", severity: "info", status: "expired", start: "5d ago", end: "2d ago" },
];

const statusTone = (s: Announcement["status"]) =>
  s === "visible" ? "default" : s === "scheduled" ? "outline" : s === "expired" ? "secondary" : "outline";

const sevTone = (s: Announcement["severity"]) =>
  s === "critical" ? "destructive" : s === "warning" ? "outline" : "outline";

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      const matchesSearch =
        search === "" ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.message.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [announcements, search, statusFilter]);

  return (
    <Page>
      <PageHeader
        title="Announcements"
        description="Platform updates, rule changes, and important notifications"
        icon={Bell}
      />
      <PageContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "visible", "scheduled", "expired", "draft"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{a.title}</h3>
                      <Badge variant={statusTone(a.status)} className="text-xs">{a.status}</Badge>
                      <Badge variant={sevTone(a.severity)} className="text-xs">{a.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {a.scope}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.start} – {a.end}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No announcements found
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}