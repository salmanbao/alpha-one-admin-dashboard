"use client";

/**
 * M4.3 — Flow Detail & Version History (spec §8.3).
 *
 * Operations console for a single automation flow: step funnel with
 * drop-offs, enrolled-member management (pause/resume/remove, bulk),
 * immutable version history with restore-to-draft, and behavioral
 * settings (goal, quiet hours, re-entry, consent policy).
 *
 * Deep link: `?view=automation-flow-detail&flow=<id>`.
 * Dummy data only.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  Activity,
  Copy,
  History,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import {
  deleteFlow,
  duplicateFlow,
  flowFunnel,
  getFlow,
  listFlows,
  removeFlowMember,
  restoreFlowVersion,
  setFlowMemberStatus,
  setFlowStatus,
  updateFlowSettings,
  type Flow,
  type FlowMember,
} from "../campaign-studio-store";

const MEMBER_STATUS_TONE: Record<FlowMember["status"], "info" | "success" | "muted" | "danger"> = {
  waiting: "info",
  completed: "success",
  exited: "muted",
  failed: "danger",
};

export function AutomationFlowDetailPage() {
  const { router, navigate } = usePlatform();
  const paramFlow = router.params.flow ?? "";

  const [flowOrNull, setTick] = useState<Flow | null>(() => getFlow(paramFlow) ?? null);
  const [range, setRange] = useState("30d");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settings, setSettings] = useState(() => flowOrNull?.settings ?? null);

  if (!flowOrNull) {
    return (
      <Page>
        <PageHeader title="Flow Detail" description="Pick a flow to inspect." icon={Activity} />
        <PageContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listFlows().map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate("automation-flow-detail", { flow: f.id })}
                className="rounded-lg border bg-card p-4 text-left hover:shadow-sm"
              >
                <span className="text-sm font-semibold">{f.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {f.status} · {f.enrolled.toLocaleString()} enrolled
                </span>
              </button>
            ))}
          </div>
        </PageContent>
      </Page>
    );
  }
  const flow: Flow = flowOrNull;

  const refresh = () => setTick(getFlow(flow.id) ?? null);
  const funnel = useMemo(() => flowFunnel(flow), [flow]);
  const rangeMultiplier = range === "7d" ? 0.3 : range === "90d" ? 1.8 : 1;
  const active = flow.status === "active";

  function toggleStatus(next: boolean) {
    setFlowStatus(flow.id, next ? "active" : "paused");
    recordAudit({
      action: next ? "flow.resume" : "flow.pause",
      entity: "automation-flow",
      entityId: flow.id,
      summary: `Flow “${flow.name}” ${next ? "activated" : "paused"}.`,
      module: "marketing",
    });
    toast({ title: next ? "Flow activated" : "Flow paused", description: flow.name });
    refresh();
  }

  const memberColumns: Column<FlowMember>[] = [
    {
      key: "contact",
      header: "Contact",
      cell: (m) => <span className="text-xs font-medium">{m.contact}</span>,
      sortValue: (m) => m.contact,
    },
    {
      key: "entered",
      header: "Entered at",
      cell: (m) => <span className="text-xs text-muted-foreground">{relativeTime(m.enteredAt)}</span>,
      sortValue: (m) => m.enteredAt,
    },
    {
      key: "step",
      header: "Current step",
      cell: (m) => <span className="text-xs">{m.currentStep}</span>,
      sortValue: (m) => m.currentStep,
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => <StatusBadge tone={MEMBER_STATUS_TONE[m.status]}>{m.status}</StatusBadge>,
      sortValue: (m) => m.status,
    },
    {
      key: "last",
      header: "Last activity",
      cell: (m) => <span className="text-xs text-muted-foreground">{relativeTime(m.lastActivity)}</span>,
      sortValue: (m) => m.lastActivity,
    },
    {
      key: "actions",
      header: "",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          {m.status === "waiting" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => {
                setFlowMemberStatus(flow.id, m.id, "exited");
                toast({ title: "Member paused", description: `${m.contact} — timers frozen.` });
                refresh();
              }}
            >
              <Pause className="mr-1 h-3 w-3" /> Pause
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => {
                setFlowMemberStatus(flow.id, m.id, "waiting");
                toast({ title: "Member resumed", description: `${m.contact} — continues from “${m.currentStep}”.` });
                refresh();
              }}
            >
              <Play className="mr-1 h-3 w-3" /> Resume
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-destructive"
            onClick={() => {
              removeFlowMember(flow.id, m.id);
              toast({ title: "Member removed", description: `${m.contact} exited the flow.` });
              refresh();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  const allSelected = selected.length > 0 && selected.length === flow.members.length;

  return (
    <Page>
      <PageHeader
        title={flow.name}
        description={`${flow.nodes.length} nodes · version v${flow.version} · updated ${relativeTime(flow.updatedAt)}`}
        icon={Activity}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <span className="text-xs font-medium">{active ? "Active" : "Paused"}</span>
              <Switch checked={active} onCheckedChange={toggleStatus} aria-label="Flow status" />
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("automation-flows", { flow: flow.id })}>
              <Pencil className="mr-1 h-4 w-4" /> Edit flow
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const copy = duplicateFlow(flow.id);
                    if (copy) {
                      toast({ title: "Flow duplicated", description: copy.name });
                      navigate("automation-flow-detail", { flow: copy.id });
                    }
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Restore notice */}
      {router.params.restored && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Restored from v{router.params.restored} — a new draft version was created. Live traffic continues on v
          {flow.version} until the draft is published.
        </div>
      )}

      {/* Headline stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Enrolled</p>
            <p className="text-2xl font-semibold">{Math.round(flow.enrolled * rangeMultiplier).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold">{Math.round(flow.completed * rangeMultiplier).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goal conversion</p>
            <p className="text-2xl font-semibold text-emerald-600">{flow.goalConversion}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Overview: step funnel ── */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Step funnel</CardTitle>
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Date range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnel.length === 0 ? (
                <EmptyState title="No funnel yet" description="Add nodes to the flow and publish it." />
              ) : (
                funnel.map((step, i) => {
                  const count = Math.round(step.count * rangeMultiplier);
                  const width = funnel[0].count ? Math.max(4, (step.count / funnel[0].count) * 100) : 100;
                  return (
                    <div key={step.nodeId}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {i + 1}. {step.label}
                        </span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} contacts
                          {i > 0 && (
                            <span className={step.dropoff > 40 ? "text-rose-600" : "text-muted-foreground"}>
                              {" "}· {step.dropoff}% drop-off
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${i === 0 ? "bg-primary" : "bg-primary/60"}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      {i > 0 && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {Math.round((step.count / Math.max(1, funnel[i - 1].count)) * 100)}% of previous step
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Enrolled members</CardTitle>
                <div className="flex items-center gap-2">
                  {selected.length > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">{selected.length} selected</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          selected.forEach((id) => setFlowMemberStatus(flow.id, id, "exited"));
                          toast({ title: "Members paused", description: `${selected.length} members frozen.` });
                          setSelected([]);
                          refresh();
                        }}
                      >
                        <Pause className="mr-1 h-3 w-3" /> Bulk pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          selected.forEach((id) => setFlowMemberStatus(flow.id, id, "waiting"));
                          toast({ title: "Members resumed", description: `${selected.length} members resumed.` });
                          setSelected([]);
                          refresh();
                        }}
                      >
                        <Play className="mr-1 h-3 w-3" /> Bulk resume
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {flow.members.length === 0 ? (
                <EmptyState
                  title="No members yet"
                  description="Enrollments appear here once the flow triggers. Try a test run in the builder first."
                  action={
                    <Button size="sm" onClick={() => navigate("automation-flows", { flow: flow.id })}>
                      Open builder
                    </Button>
                  }
                />
              ) : (
                <div className="-m-1">
                  <label className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v ? flow.members.map((m) => m.id) : [])}
                      aria-label="Select all members"
                    />
                    Select all
                  </label>
                  <DataTable
                    columns={memberColumns}
                    data={flow.members}
                    rowKey={(m) => m.id}
                    searchableText={(m) => `${m.contact} ${m.currentStep} ${m.status}`}
                    pageSize={8}
                    emptyTitle="No members"
                    emptyDescription="Enrollments will appear once the flow runs."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Versions ── */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Version history</CardTitle>
              <p className="text-xs text-muted-foreground">
                Published versions are immutable. Restore always creates a new draft — live traffic keeps running on
                v{flow.version}.
              </p>
            </CardHeader>
            <CardContent>
              {flow.versions.length === 0 ? (
                <EmptyState
                  title="No published versions"
                  description="Publish the flow from the builder to snapshot version 1."
                  icon={History}
                />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: "version",
                      header: "Version",
                      cell: (v: { version: number; author: string; publishedAt: string; summary: string }) => (
                        <span className="flex items-center gap-2 text-xs font-medium">
                          v{v.version}
                          {v.version === flow.version && <Badge className="text-[9px]">Live</Badge>}
                        </span>
                      ),
                      sortValue: (v: { version: number }) => v.version,
                    },
                    { key: "author", header: "Author", cell: (v: { author: string }) => <span className="text-xs">{v.author}</span> },
                    {
                      key: "published",
                      header: "Published",
                      cell: (v: { publishedAt: string }) => <span className="text-xs text-muted-foreground">{relativeTime(v.publishedAt)}</span>,
                      sortValue: (v: { publishedAt: string }) => v.publishedAt,
                    },
                    { key: "summary", header: "Change summary", cell: (v: { summary: string }) => <span className="text-xs">{v.summary}</span> },
                    {
                      key: "actions",
                      header: "",
                      cell: (v: { version: number }) => (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              toast({
                                title: `Viewing v${v.version} (read-only)`,
                                description: "The canvas opens in the builder as an immutable snapshot.",
                              })
                            }
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={v.version === flow.version}
                            onClick={() => {
                              restoreFlowVersion(flow.id, v.version);
                              recordAudit({
                                action: "flow.restore",
                                entity: "automation-flow",
                                entityId: flow.id,
                                summary: `Restored v${v.version} as a new draft (live remains v${flow.version}).`,
                                severity: "warning",
                                module: "marketing",
                              });
                              toast({
                                title: `v${v.version} restored as draft`,
                                description: "Opening the builder — live traffic continues on the current version.",
                              });
                              navigate("automation-flows", { flow: flow.id, restored: String(v.version) });
                            }}
                          >
                            Restore
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  data={flow.versions}
                  rowKey={(v) => String(v.version)}
                  pageSize={8}
                  emptyTitle="No versions"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings ── */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Behavior settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Goal metric</Label>
                  <Select
                    value={settings?.goalMetric ?? flow.settings.goalMetric}
                    onValueChange={(v) => {
                      setSettings({ ...(settings ?? flow.settings), goalMetric: v });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["conversion", "kyc_approved", "trial_started", "payout_received", "login_returned"].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The conversion event that defines flow completion.
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Quiet hours window</Label>
                  <Select
                    value={settings?.quietHours ?? flow.settings.quietHours}
                    onValueChange={(v) => setSettings({ ...(settings ?? flow.settings), quietHours: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["22:00–07:00", "21:00–08:00", "23:00–06:00", "None"].map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Send nodes hold delivery inside this window (M2.4 policy).
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs">Re-entry policy</Label>
                <RadioGroup
                  value={settings?.reentry ?? flow.settings.reentry}
                  onValueChange={(v) =>
                    setSettings({ ...(settings ?? flow.settings), reentry: v as "once" | "always" | "after_days" })
                  }
                  className="mt-2 space-y-1.5"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="once" /> Once — a contact can never re-enter
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="always" /> Every time — the trigger re-enrolls them
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="after_days" /> After N days since last completion
                  </label>
                </RadioGroup>
              </div>

              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Consent policy:</strong> marketing nodes check channel consent at
                send time — contacts without granted consent are skipped and recorded as suppressed, even mid-flow.
              </div>

              <Button
                onClick={() => {
                  updateFlowSettings(flow.id, settings ?? flow.settings);
                  recordAudit({
                    action: "flow.settings.update",
                    entity: "automation-flow",
                    entityId: flow.id,
                    summary: `Updated settings for “${flow.name}”.`,
                    module: "marketing",
                  });
                  toast({ title: "Settings saved", description: "Applied from the next enrollment onward." });
                  refresh();
                }}
              >
                Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete flow */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow “{flow.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The graph, members and version history are removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteFlow(flow.id);
                recordAudit({
                  action: "flow.delete",
                  entity: "automation-flow",
                  entityId: flow.id,
                  summary: `Deleted flow “${flow.name}”.`,
                  severity: "warning",
                  module: "marketing",
                });
                toast({ title: "Flow deleted", description: flow.name });
                navigate("automation-flows");
              }}
            >
              Delete flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
