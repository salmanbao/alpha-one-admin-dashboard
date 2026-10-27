"use client";

/**
 * Notification Templates Page — Template management (M14 / M13 Notification Center).
 *
 * Stitch screen: (new)
 * Tier 1 — Multi-channel template list, editor with variable chips, test-send.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  FileCode,
  Search,
  Plus,
  Save,
  Send,
  Globe,
  Mail,
  Smartphone,
  Bell,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Eye,
} from "lucide-react";

const demoTemplates = [
  { id: "tpl-001", name: "Welcome Email", channel: "email", language: "en", status: "active", subject: "Welcome to {{tenant_name}}, {{user_name}}!", body: "Hi {{user_name}},\n\nYour account on {{tenant_name}} is ready. Your login: {{login_url}}\n\n- The {{tenant_name}} Team", variables: ["tenant_name", "user_name", "login_url"], updatedAt: "2026-10-05T10:00:00Z", sentCount: 12480 },
  { id: "tpl-002", name: "Welcome Email (ES)", channel: "email", language: "es", status: "active", subject: "Bienvenido a {{tenant_name}}, {{user_name}}", body: "Hola {{user_name}},\n\nTu cuenta en {{tenant_name}} está lista. Tu acceso: {{login_url}}", variables: ["tenant_name", "user_name", "login_url"], updatedAt: "2026-10-05T10:05:00Z", sentCount: 3420 },
  { id: "tpl-003", name: "Password Reset", channel: "email", language: "en", status: "active", subject: "Reset your password", body: "Hi {{user_name}},\n\nReset link (valid 30 min): {{reset_url}}\n\nIf you didn't request this, ignore this email.", variables: ["user_name", "reset_url"], updatedAt: "2026-09-28T14:00:00Z", sentCount: 8750 },
  { id: "tpl-004", name: "Payout Processed", channel: "push", language: "en", status: "active", subject: "", body: "Payout of {{amount}} {{currency}} processed to {{method}}.", variables: ["amount", "currency", "method"], updatedAt: "2026-10-02T09:30:00Z", sentCount: 2140 },
  { id: "tpl-005", name: "Risk Breach Alert", channel: "sms", language: "en", status: "active", subject: "", body: "{{tenant_name}}: risk breach on {{account_id}}. Level {{risk_level}}. Action required.", variables: ["tenant_name", "account_id", "risk_level"], updatedAt: "2026-09-20T16:45:00Z", sentCount: 890 },
  { id: "tpl-006", name: "KYC Approved", channel: "in-app", language: "en", status: "active", subject: "", body: "Your verification ({{kyc_level}}) is approved. You can now trade.", variables: ["kyc_level"], updatedAt: "2026-10-01T11:00:00Z", sentCount: 5610 },
  { id: "tpl-007", name: "Billing Failed (Dunning)", channel: "email", language: "en", status: "draft", subject: "Payment failed — action needed", body: "Hi {{user_name}},\n\nYour payment of {{amount}} failed ({{error_reason}}). Retry: {{retry_url}}", variables: ["user_name", "amount", "error_reason", "retry_url"], updatedAt: "2026-10-07T18:20:00Z", sentCount: 0 },
  { id: "tpl-008", name: "Discord Ops Alert", channel: "discord", language: "en", status: "disabled", subject: "", body: "[{{severity}}] {{service}}: {{message}}", variables: ["severity", "service", "message"], updatedAt: "2026-08-15T08:00:00Z", sentCount: 430 },
];

const channelMeta: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  email: { icon: Mail, color: "#4a7c59", label: "Email" },
  push: { icon: Bell, color: "#705c30", label: "Push" },
  sms: { icon: Smartphone, color: "#b83230", label: "SMS" },
  "in-app": { icon: Bell, color: "#6b6358", label: "In-App" },
  discord: { icon: MessageSquare, color: "#74796e", label: "Discord" },
  telegram: { icon: MessageSquare, color: "#74796e", label: "Telegram" },
};

const statusTones: Record<string, "success" | "warning" | "info"> = {
  active: "success",
  draft: "warning",
  disabled: "info",
};

const availableVariables = [
  "tenant_name", "user_name", "login_url", "reset_url", "amount", "currency",
  "method", "account_id", "risk_level", "kyc_level", "error_reason", "retry_url",
  "severity", "service", "message",
];

export function NotificationTemplatesPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoTemplates, { delayMs: 450 }), []);
  const templates = loadedData ?? [];
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const filtered = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        search === "" ||
        tpl.name.toLowerCase().includes(search.toLowerCase()) ||
        tpl.subject.toLowerCase().includes(search.toLowerCase());
      const matchesChannel = channelFilter === "all" || tpl.channel === channelFilter;
      return matchesSearch && matchesChannel;
    });
  }, [templates, search, channelFilter]);

  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter((t) => t.status === "active").length,
    languages: new Set(templates.map((t) => t.language)).size,
    totalSent: templates.reduce((s, t) => s + t.sentCount, 0),
  }), [templates]);

  const selected = templates.find((t) => t.id === selectedId);

  const openEditor = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    setSelectedId(id);
    setEditBody(tpl?.body ?? "");
  };

  const insertVariable = (variable: string) => {
    setEditBody((prev) => `${prev}{{${variable}}}`);
  };

  return (
    <Page>
      <PageHeader
        title="Notification Templates"
        description="Multi-channel message templates with variable injection."
        icon={FileCode}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("notifications")}>
              <Bell className="mr-1 h-4 w-4" /> Notification Center
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New template", description: "Template form: channel, language, subject, body." })}>
              <Plus className="mr-1 h-4 w-4" /> New Template
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
          loadingLabel="Loading templates…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Templates" value={stats.total} icon={FileCode} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Languages" value={stats.languages} icon={Globe} />
          <MetricCard label="Messages Sent" value={stats.totalSent.toLocaleString()} icon={Send} />
        </div>

        {/* Search + channel filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={channelFilter === "all" ? "default" : "outline"} onClick={() => setChannelFilter("all")}>All</Button>
            {Object.entries(channelMeta).map(([ch, meta]) => (
              <Button key={ch} size="sm" variant={channelFilter === ch ? "default" : "outline"} onClick={() => setChannelFilter(ch)} className="text-[10px]">
                {meta.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Template list */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Templates</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[560px] overflow-y-auto">
                {filtered.map((tpl) => {
                  const ch = channelMeta[tpl.channel];
                  const Icon = ch?.icon ?? FileCode;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => openEditor(tpl.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${selectedId === tpl.id ? "bg-muted/50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center" style={{ background: `${ch?.color ?? "#6b6358"}20`, color: ch?.color ?? "#6b6358" }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{tpl.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {tpl.subject || tpl.body.slice(0, 60) + "…"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge tone={statusTones[tpl.status]}>{tpl.status}</StatusBadge>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-[9px] uppercase">{tpl.channel}</Badge>
                            <Badge variant="outline" className="text-[9px] uppercase">{tpl.language}</Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileCode className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 font-medium">No templates found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editor */}
          {selected ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="secondary" className="text-[9px] uppercase">{selected.channel}</Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">{selected.language}</Badge>
                      <StatusBadge tone={statusTones[selected.status]}>{selected.status}</StatusBadge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.subject && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
                    <Input value={selected.subject} readOnly className="h-9" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Body</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={7}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Insert Variable</label>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.variables.map((v) => (
                      <button key={v} onClick={() => insertVariable(v)} className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono hover:bg-muted/70">
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Available: {availableVariables.filter((v) => !selected.variables.includes(v)).slice(0, 6).join(", ")}…</p>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Sent {selected.sentCount.toLocaleString()} times · Updated {new Date(selected.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toast({ title: "Test sent", description: `Test ${selected.channel} message dispatched to you.` })}>
                      <Send className="mr-1 h-3 w-3" /> Test Send
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toast({ title: "Template duplicated", description: `${selected.name} copied as draft.` })}>
                      <Copy className="mr-1 h-3 w-3" /> Duplicate
                    </Button>
                    <Button size="sm" onClick={() => toast({ title: "Template saved", description: `${selected.name} updated. Audited.` })}>
                      <Save className="mr-1 h-3 w-3" /> Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Eye className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Select a template</p>
                <p className="text-sm text-muted-foreground">Choose a template from the list to edit its body, variables, and settings.</p>
              </CardContent>
            </Card>
          )}
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
