"use client";

/**
 * Announcements — PRD §4.5 (announcements table), §4.6.2 (sidebar
 * destination, settings:write), §4.17 (POST/PATCH/DELETE /announcements).
 *
 * Full announcement workflow: compose (title, content, type), target an
 * audience (all / active / funded / specific challenge), schedule the
 * publish window and expiration, pin important messages, edit and delete.
 * Data lives in the session announcement-store so list, KPIs and status
 * badges stay in sync.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantChallenges } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  announcementStatus,
  deleteAnnouncement,
  getAnnouncements,
  saveAnnouncement,
  toggleAnnouncementPin,
  useAnnouncementVersion,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementStatus,
  type AnnouncementType,
} from "@/modules/settings/announcement-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  CalendarClock,
  Download,
  FileText,
  Mail,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";

const typeLabel: Record<AnnouncementType, string> = {
  info: "Info",
  warning: "Warning",
  success: "Success",
  maintenance: "Maintenance",
};

const typeTone: Record<AnnouncementType, "info" | "warning" | "success" | "muted"> = {
  info: "info",
  warning: "warning",
  success: "success",
  maintenance: "muted",
};

const audienceLabel: Record<AnnouncementAudience, string> = {
  all: "All traders",
  active: "Active traders",
  funded: "Funded traders",
  challenge: "Specific challenge",
};

const statusTone: Record<AnnouncementStatus, "success" | "info" | "muted" | "danger"> = {
  published: "success",
  scheduled: "info",
  draft: "muted",
  expired: "danger",
};

/* ------------------------------------------------------------------ */
/* datetime-local <-> ISO helpers                                      */
/* ------------------------------------------------------------------ */

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Composer dialog                                                     */
/* ------------------------------------------------------------------ */

interface AnnForm {
  id?: string;
  title: string;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  targetChallenge: string;
  publishedAt: string; // datetime-local value ("" = draft)
  expiresAt: string; // datetime-local value ("" = never)
  pinned: boolean;
}

const emptyForm: AnnForm = {
  title: "",
  content: "",
  type: "info",
  audience: "all",
  targetChallenge: "",
  publishedAt: toLocalInput(new Date().toISOString()),
  expiresAt: "",
  pinned: false,
};

function AnnouncementComposer({
  open,
  onOpenChange,
  form,
  onFormChange,
  challenges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AnnForm;
  onFormChange: (next: AnnForm) => void;
  challenges: string[];
}) {
  const editing = Boolean(form.id);
  const valid =
    form.title.trim().length > 0 &&
    form.content.trim().length > 0 &&
    (form.audience !== "challenge" || form.targetChallenge.length > 0);

  const handleSave = () => {
    if (!valid) return;
    saveAnnouncement({
      id: form.id ?? "",
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      audience: form.audience,
      targetChallenge: form.audience === "challenge" ? form.targetChallenge : undefined,
      publishedAt: fromLocalInput(form.publishedAt),
      expiresAt: fromLocalInput(form.expiresAt),
      pinned: form.pinned,
      impressions: 0,
      createdAt: new Date().toISOString(),
    });
    toast({
      title: editing ? "Announcement updated" : "Announcement created",
      description: `"${form.title.trim()}" ${
        form.publishedAt ? "is scheduled for delivery." : "saved as a draft."
      }`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            Announcements are shown in-app to the targeted traders. Drafts stay hidden until
            their publish time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title" className="text-xs">
              Title *
            </Label>
            <Input
              id="ann-title"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="e.g. Scheduled maintenance — FIX bridge failover"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ann-content" className="text-xs">
              Content *
            </Label>
            <Textarea
              id="ann-content"
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              placeholder="What should traders know?"
              className="min-h-[96px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => onFormChange({ ...form, type: v as AnnouncementType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["info", "warning", "success", "maintenance"] as AnnouncementType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabel[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
              <Select
                value={form.audience}
                onValueChange={(v) =>
                  onFormChange({ ...form, audience: v as AnnouncementAudience })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["all", "active", "funded", "challenge"] as AnnouncementAudience[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {audienceLabel[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.audience === "challenge" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Target challenge *</Label>
              <Select
                value={form.targetChallenge}
                onValueChange={(v) => onFormChange({ ...form, targetChallenge: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a challenge…" />
                </SelectTrigger>
                <SelectContent>
                  {challenges.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ann-publish" className="text-xs">
                Publish at (blank = draft)
              </Label>
              <Input
                id="ann-publish"
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => onFormChange({ ...form, publishedAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-expires" className="text-xs">
                Expires at (blank = never)
              </Label>
              <Input
                id="ann-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => onFormChange({ ...form, expiresAt: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="ann-pin" className="text-xs font-medium">
                Pin to top
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Pinned announcements stay above everything else.
              </p>
            </div>
            <Switch
              id="ann-pin"
              checked={form.pinned}
              onCheckedChange={(checked) => onFormChange({ ...form, pinned: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={handleSave}>
            {editing ? "Save changes" : "Create announcement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AnnouncementsPage() {
  const { runtime } = usePlatform();
  useAnnouncementVersion(); // list + KPIs react to CRUD
  const tid = runtime.tenant?.id ?? "platform";

  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState<AnnForm>(emptyForm);
  // PRD §4.17 POST /bulk/email — operator-composed broadcast to traders.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAudience, setBulkAudience] = useState("all");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  const challenges = Array.from(
    new Set(getTenantChallenges(tid).map((c) => c.name)),
  ).sort();

  const announcements = getAnnouncements();
  const counts = {
    published: announcements.filter((a) => announcementStatus(a) === "published").length,
    scheduled: announcements.filter((a) => announcementStatus(a) === "scheduled").length,
    drafts: announcements.filter((a) => announcementStatus(a) === "draft").length,
    pinned: announcements.filter((a) => a.pinned).length,
  };

  const openCreate = () => {
    setForm({ ...emptyForm, publishedAt: toLocalInput(new Date().toISOString()) });
    setComposerOpen(true);
  };

  // PRD §4.17 POST /bulk/email — queued broadcast with async status polling.
  const sendBulkEmail = () => {
    if (!bulkSubject.trim() || !bulkBody.trim() || bulkSending) return;
    setBulkSending(true);
    const audienceLabel =
      bulkAudience === "all"
        ? "all traders"
        : bulkAudience === "active"
          ? "active traders"
          : "funded traders";
    // Mock async: the bulk operation resolves after a short queue delay.
    window.setTimeout(() => {
      setBulkSending(false);
      setBulkOpen(false);
      toast({
        title: "Bulk email queued",
        description: `"${bulkSubject.trim()}" dispatched to ${audienceLabel} (POST /bulk/email — track via GET /bulk/:id/status).`,
      });
      setBulkSubject("");
      setBulkBody("");
    }, 700);
  };

  const openEdit = (a: Announcement) => {
    setForm({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      audience: a.audience,
      targetChallenge: a.targetChallenge ?? "",
      publishedAt: toLocalInput(a.publishedAt),
      expiresAt: toLocalInput(a.expiresAt),
      pinned: a.pinned,
    });
    setComposerOpen(true);
  };

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Title",
      cell: (a) => (
        <div className="flex items-start gap-1.5">
          {a.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-label="Pinned" /> : null}
          <div className="min-w-0">
            <p className="truncate font-medium">{a.title}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{a.content}</p>
          </div>
        </div>
      ),
      sortValue: (a) => a.title,
    },
    {
      key: "type",
      header: "Type",
      cell: (a) => <StatusBadge tone={typeTone[a.type]}>{typeLabel[a.type]}</StatusBadge>,
      sortValue: (a) => a.type,
    },
    {
      key: "audience",
      header: "Audience",
      cell: (a) => (
        <div className="min-w-0">
          <p className="text-sm">{audienceLabel[a.audience]}</p>
          {a.audience === "challenge" && a.targetChallenge ? (
            <p className="truncate text-xs text-muted-foreground">{a.targetChallenge}</p>
          ) : null}
        </div>
      ),
      sortValue: (a) => a.audience,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => {
        const s = announcementStatus(a);
        return <StatusBadge tone={statusTone[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</StatusBadge>;
      },
      sortValue: (a) => announcementStatus(a),
    },
    {
      key: "publishedAt",
      header: "Publishes",
      cell: (a) => (
        <span className="text-xs text-muted-foreground">
          {a.publishedAt
            ? new Date(a.publishedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      ),
      sortValue: (a) => a.publishedAt ?? "",
    },
    {
      key: "expiresAt",
      header: "Expires",
      cell: (a) => (
        <span className="text-xs text-muted-foreground">
          {a.expiresAt
            ? new Date(a.expiresAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Never"}
        </span>
      ),
      sortValue: (a) => a.expiresAt ?? "9999",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={a.pinned ? `Unpin "${a.title}"` : `Pin "${a.title}"`}
            title={a.pinned ? "Unpin" : "Pin"}
            onClick={() => {
              toggleAnnouncementPin(a.id);
              toast({
                title: a.pinned ? "Announcement unpinned" : "Announcement pinned",
                description: a.title,
              });
            }}
          >
            {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Edit "${a.title}"`}
            title="Edit"
            onClick={() => openEdit(a)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:text-rose-700"
                aria-label={`Delete "${a.title}"`}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{a.title}” will be permanently removed{a.pinned ? " (it is currently pinned)" : ""}
                  . This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 text-white hover:bg-rose-700"
                  onClick={() => {
                    deleteAnnouncement(a.id);
                    toast({
                      title: "Announcement deleted",
                      description: a.title,
                      variant: "destructive",
                    });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  const handleExport = () => {
    exportToCsv(
      announcements,
      [
        { key: "title", header: "Title", value: (a) => a.title },
        { key: "type", header: "Type", value: (a) => a.type },
        { key: "audience", header: "Audience", value: (a) => a.audience },
        { key: "targetChallenge", header: "Target Challenge", value: (a) => a.targetChallenge ?? "" },
        { key: "status", header: "Status", value: (a) => announcementStatus(a) },
        { key: "publishedAt", header: "Publish At", value: (a) => a.publishedAt ?? "" },
        { key: "expiresAt", header: "Expires At", value: (a) => a.expiresAt ?? "" },
        { key: "pinned", header: "Pinned", value: (a) => (a.pinned ? "yes" : "no") },
        { key: "impressions", header: "Impressions", value: (a) => a.impressions },
      ],
      `announcements-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Announcements"
        description="In-app messages for traders — compose, target, schedule and pin."
        icon={Megaphone}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
            {/* PRD §4.17 POST /bulk/email — operator email broadcast */}
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Bulk Email
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Announcement
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Published" value={counts.published} icon={Megaphone} tone="positive" />
          <MetricCard label="Scheduled" value={counts.scheduled} icon={CalendarClock} tone="info" />
          <MetricCard label="Drafts" value={counts.drafts} icon={FileText} />
          <MetricCard label="Pinned" value={counts.pinned} icon={Pin} tone="warning" />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">All announcements</p>
          <DataTable
            columns={columns}
            data={announcements}
            rowKey={(a) => a.id}
            searchableText={(a) =>
              `${a.title} ${a.content} ${a.type} ${a.audience} ${a.targetChallenge ?? ""}`
            }
            searchPlaceholder="Search announcements…"
            emptyTitle="No announcements yet"
            emptyDescription="Create your first announcement to reach your traders in-app."
          />
        </div>

        <AnnouncementComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          form={form}
          onFormChange={setForm}
          challenges={challenges}
        />

        {/* PRD §4.17 POST /bulk/email — bulk email broadcast dialog */}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Bulk email broadcast</DialogTitle>
              <DialogDescription>
                Sends an email to the selected trader segment. Queued as a bulk operation —
                progress is tracked via GET /bulk/:id/status.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-audience" className="text-xs">
                  Audience
                </Label>
                <Select value={bulkAudience} onValueChange={setBulkAudience}>
                  <SelectTrigger id="bulk-audience" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All traders</SelectItem>
                    <SelectItem value="active">Active traders</SelectItem>
                    <SelectItem value="funded">Funded traders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-subject" className="text-xs">
                  Subject *
                </Label>
                <Input
                  id="bulk-subject"
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  placeholder="e.g. Platform maintenance this weekend"
                  maxLength={150}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-body" className="text-xs">
                  Message *
                </Label>
                <Textarea
                  id="bulk-body"
                  value={bulkBody}
                  onChange={(e) => setBulkBody(e.target.value)}
                  placeholder="Write the email body sent to each trader…"
                  rows={5}
                  maxLength={5000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSending}>
                Cancel
              </Button>
              <Button
                onClick={sendBulkEmail}
                disabled={bulkSending || !bulkSubject.trim() || !bulkBody.trim()}
              >
                <Mail className="mr-1 h-3.5 w-3.5" />
                {bulkSending ? "Queuing…" : "Send Broadcast"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </Page>
  );
}
