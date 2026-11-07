"use client";

/**
 * M4.2 — Automation Flow Builder (spec §8.2).
 *
 * Node-based lifecycle canvas replacing the old platform-admin toast
 * stub: palette (triggers / conditions / actions / flow control),
 * pannable-zoomable grid with ports, right inspector, validation
 * drawer that blocks publish, and a test-run stepper that highlights
 * the traversed path.
 *
 * Deep links: `?view=automation-flows&flow=<id>` opens a flow;
 * without a param a flow picker + Trigger chooser flow is shown.
 *
 * Dummy data only — graphs live in the campaign-studio store.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Download,
  FileText,
  GitBranch,
  Layers,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Rocket,
  Save,
  Search,
  Send,
  Shield,
  Square,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  Wallet,
  Webhook,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { listSegments } from "../segments-store";
import { relativeTime } from "@/modules/integrations/format";
import {
  NODE_GROUPS,
  createFlow,
  deleteFlow,
  duplicateFlow,
  getFlow,
  isTrigger,
  listFlows,
  listStudioTemplates,
  newNode,
  nodeMeta,
  publishFlow,
  saveFlow,
  setFlowStatus,
  validateFlow,
  type Flow,
  type FlowNodeType,
  type FlowNode,
  type ValidationIssue,
} from "../campaign-studio-store";

/* ------------------------------------------------------------------ */
/* Icons per node type                                                 */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "trigger.form_submitted": FileText,
  "trigger.challenge_passed": Trophy,
  "trigger.payout_requested": Wallet,
  "trigger.payout_approved": BadgeCheck,
  "trigger.kyc_expiring": Shield,
  "trigger.dormant_30": Clock,
  "trigger.manual": UserPlus,
  "cond.attribute": GitBranch,
  "cond.segment": Layers,
  "cond.consent": Shield,
  "action.send_email": Send,
  "action.send_sms": Send,
  "action.send_push": Bell,
  "action.wait_duration": Clock,
  "action.wait_window": CalendarClock,
  "action.update_tag": Tag,
  "action.update_crm": GitBranch,
  "action.webhook": Webhook,
  "control.end": Square,
  "control.goto": ChevronRight,
};

const NODE_W = 184;
const NODE_H = 62;

export function AutomationFlowBuilderPage() {
  const { router, navigate } = usePlatform();
  const paramFlow = router.params.flow;

  const [flowOrNull, setFlow] = useState<Flow | null>(() => (paramFlow ? (getFlow(paramFlow) ?? null) : null));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FlowNode | null>(null);
  const [confirmDeleteFlow, setConfirmDeleteFlow] = useState(false);
  const [undoBuffer, setUndoBuffer] = useState<{ label: string; restore: () => void } | null>(null);
  const [newFlowOpen, setNewFlowOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [status, setStatus] = useState<Flow["status"]>("draft");

  /* Test run */
  const [testOpen, setTestOpen] = useState(false);
  const [testContact, setTestContact] = useState("an***@mail.com");
  const [runStep, setRunStep] = useState(-1);
  const [runLog, setRunLog] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flowOrNull) setStatus(flowOrNull.status);
  }, [flowOrNull?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Flow picker ── */
  if (!flowOrNull) {
    return (
      <Page>
        <PageHeader
          title="Automation Flows"
          description="Lifecycle automation: triggers → conditions → actions. Build once, run forever."
          icon={Activity}
          actions={
            <Button size="sm" onClick={() => setNewFlowOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New flow
            </Button>
          }
        />
        <PageContent>
          {listFlows().length === 0 ? (
            <EmptyState
              title="No flows yet"
              description="Create your first automation or start from a template."
              action={<Button size="sm" onClick={() => setNewFlowOpen(true)}>New flow</Button>}
              hint="Templates: Marketing → Template Library"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listFlows().map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFlow(f)}
                  className="rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate">{f.name}</span>
                    <Badge variant={f.status === "active" ? "default" : f.status === "paused" ? "secondary" : "outline"}>
                      {f.status === "active" ? "Active" : f.status === "paused" ? "Paused" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.nodes.length} nodes · v{f.version} · {f.enrolled.toLocaleString()} enrolled
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Updated {relativeTime(f.updatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </PageContent>
        <NewFlowDialog
          open={newFlowOpen}
          onOpenChange={setNewFlowOpen}
          name={newFlowName}
          onNameChange={setNewFlowName}
          onCreate={(name, trigger) => {
            const f = createFlow(name, trigger);
            setNewFlowName("");
            setNewFlowOpen(false);
            setFlow(f);
            navigate("automation-flows", { flow: f.id });
          }}
        />
      </Page>
    );
  }

  /* ── Derived ── */
  const flow: Flow = flowOrNull; // narrowed for the builder body + its closures
  const selected = flow.nodes.find((n) => n.id === selectedId) ?? null;
  const triggerChooser = flow.nodes.length === 0;

  const patch = (p: Partial<Flow>) => {
    setFlow((f) => (f ? { ...f, ...p } : f));
    setDirty(true);
  };

  const patchNode = (id: string, p: Partial<FlowNode>) => {
    setFlow((f) => (f ? { ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) } : f));
    setDirty(true);
  };

  const patchNodeConfig = (id: string, key: string, value: string | boolean | number) => {
    setFlow((f) =>
      f ? { ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, [key]: value } } : n)) } : f,
    );
    setDirty(true);
  };

  function addNode(type: FlowNodeType, x?: number, y?: number) {
    const offset = flow.nodes.length * 24;
    const node = newNode(type, x ?? 80 + (offset % 600), y ?? 80 + (offset % 300));
    patch({ nodes: [...flow.nodes, node] });
    setSelectedId(node.id);
    toast({ title: "Node added", description: `“${node.title}” placed on the canvas.` });
  }

  function connectPorts(from: string, to: string) {
    if (from === to) return;
    if (flow.edges.some((e) => e.from === from && e.to === to)) {
      toast({ title: "Already connected", description: "These nodes already share an edge." });
      return;
    }
    patch({ edges: [...flow.edges, { id: `e-${Date.now()}`, from, to }] });
    setPendingFrom(null);
    toast({ title: "Connected", description: "Edge created." });
  }

  function deleteNode(node: FlowNode) {
    const removedEdges = flow.edges.filter((e) => e.from === node.id || e.to === node.id);
    patch({
      nodes: flow.nodes.filter((n) => n.id !== node.id),
      edges: flow.edges.filter((e) => e.from !== node.id && e.to !== node.id),
    });
    setSelectedId(null);
    setConfirmDelete(null);
    setUndoBuffer({
      label: `Deleted “${node.title}”`,
      restore: () => {
        patch({ nodes: [...flow.nodes, node], edges: [...flow.edges, ...removedEdges] });
        setUndoBuffer(null);
      },
    });
    setTimeout(() => setUndoBuffer(null), 6000);
  }

  function duplicateNode(node: FlowNode) {
    const copy: FlowNode = { ...node, id: `n-${Math.random().toString(36).slice(2, 9)}`, x: node.x + 32, y: node.y + 32, config: { ...node.config } };
    patch({ nodes: [...flow.nodes, copy] });
    setSelectedId(copy.id);
    toast({ title: "Node duplicated" });
  }

  function handleSave() {
    saveFlow(flow.id, { name: flow.name, nodes: flow.nodes, edges: flow.edges, status });
    setDirty(false);
    setIssues(validateFlow(flow));
    toast({ title: "Flow saved", description: `${flow.name} — draft graph persisted.` });
  }

  function handleValidate() {
    const found = validateFlow(flow);
    setIssues(found);
    setDrawerOpen(true);
    if (found.length === 0) toast({ title: "Validation passed", description: "No errors or warnings." });
  }

  function handlePublish() {
    saveFlow(flow.id, { name: flow.name, nodes: flow.nodes, edges: flow.edges, status });
    const result = publishFlow(flow.id);
    setIssues(result.issues);
    if (!result.ok) {
      setDrawerOpen(true);
      toast({ title: "Publish blocked", description: `${result.issues.filter((i) => i.severity === "error").length} error(s) must be fixed first.` });
      return;
    }
    if (result.flow) setFlow(result.flow);
    setStatus("active");
    setDirty(false);
    toast({ title: "Published", description: `${flow.name} is now live as an immutable version.` });
  }

  function jumpToIssue(issue: ValidationIssue) {
    if (!issue.nodeId) return;
    setSelectedId(issue.nodeId);
    const node = flow.nodes.find((n) => n.id === issue.nodeId);
    if (node && canvasRef.current) {
      canvasRef.current.scrollTo({ left: Math.max(0, node.x - 120), top: Math.max(0, node.y - 120), behavior: "smooth" });
    }
  }

  /* ── Test run ── */
  const testPath = useMemo(() => {
    if (flow.nodes.length === 0) return [];
    const trigger = flow.nodes.find((n) => isTrigger(n.type)) ?? flow.nodes[0];
    const order: FlowNode[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined = trigger.id;
    while (cursor && !seen.has(cursor) && order.length < 12) {
      seen.add(cursor);
      const node = flow.nodes.find((n) => n.id === cursor);
      if (!node) break;
      order.push(node);
      cursor = flow.edges.find((e) => e.from === cursor)?.to;
    }
    return order;
  }, [flow]);

  function startRun() {
    setTestOpen(true);
    setRunStep(-1);
    setRunLog([`Test run started for ${testContact}`]);
  }

  function stepRun() {
    const next = runStep + 1;
    if (next >= testPath.length) {
      setRunLog((l) => [...l, "Run complete — path exhausted."]);
      return;
    }
    const node = testPath[next];
    setRunStep(next);
    setRunLog((l) => [
      ...l,
      `${next + 1}. ${node.title} [${node.type}] → ok${
        node.type.startsWith("action.send") ? " (simulated dispatch)" : ""
      }`,
    ]);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ name: flow.name, nodes: flow.nodes, edges: flow.edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${flow.name}.json downloaded.` });
  }

  const nodeFill = (n: FlowNode) => {
    if (selectedId === n.id) return "border-primary ring-1 ring-primary";
    if (runStep >= 0 && testPath.findIndex((t) => t.id === n.id) === runStep)
      return "border-emerald-500 ring-2 ring-emerald-400/60";
    if (runStep >= 0 && testPath.some((t) => t.id === n.id) && testPath.findIndex((t) => t.id === n.id) < runStep)
      return "border-emerald-400/60 bg-emerald-50/50 dark:bg-emerald-950/20";
    return "bg-card hover:border-primary/40";
  };

  return (
    <Page>
      <PageHeader
        title={flow.name}
        description={`${flow.nodes.length} nodes · ${flow.edges.length} edges · v${flow.version}${dirty ? " · unsaved changes" : ""}`}
        icon={Activity}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v as Flow["status"]); setDirty(true); }}>
              <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Flow status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`v${flow.version}`}
              onValueChange={(v) =>
                toast({ title: `${v} is immutable`, description: "Restore older versions from Flow Detail → Versions." })
              }
            >
              <SelectTrigger className="h-8 w-[80px] text-xs" aria-label="Version">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(flow.versions.length ? flow.versions : [{ version: 0, author: "—", publishedAt: "", summary: "Draft" }]).map(
                  (v) => (
                    <SelectItem key={v.version} value={`v${v.version}`}>
                      v{v.version}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleValidate}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Validate
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={!dirty}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <Rocket className="mr-1 h-4 w-4" /> Publish
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
                      setFlow(copy);
                      navigate("automation-flows", { flow: copy.id });
                      toast({ title: "Flow duplicated", description: copy.name });
                    }
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJson}>
                  <Download className="mr-2 h-4 w-4" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteFlow(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => { setFlow(null); navigate("automation-flows"); }}>
              All flows
            </Button>
          </div>
        }
      />

      <PageContent>
        {/* Restore notice (from Flow Detail → Restore) */}
        {router.params.restored && (
          <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Restored from v{router.params.restored} — you are editing a new draft. Live traffic continues on v
            {flow.version} until you publish.
          </div>
        )}

        {/* Undo strip */}
        {undoBuffer && (
          <div className="flex items-center justify-between rounded-lg border bg-muted px-3 py-2 text-xs">
            <span>{undoBuffer.label}</span>
            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={undoBuffer.restore}>
              Undo
            </Button>
          </div>
        )}

        {/* Trigger chooser for empty flows */}
        {triggerChooser && <TriggerChooser onPick={(t) => addNode(t, 80, 80)} />}

        <div className="grid gap-4 xl:grid-cols-[210px_1fr_300px]">
          {/* ── Palette ── */}
          <Card className="xl:sticky xl:top-4 xl:self-start">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Node palette</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {NODE_GROUPS.map((g) => (
                <div key={g.group}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.group}
                  </p>
                  <div className="space-y-1">
                    {g.nodes.map((n) => {
                      const Icon = TYPE_ICON[n.type] ?? Circle;
                      return (
                        <button
                          key={n.type}
                          type="button"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/node-type", n.type)}
                          onClick={() => addNode(n.type)}
                          title={n.hint}
                          className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">{n.title}</span>
                          <Plus className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Canvas ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {pendingFrom ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Click an input port to connect from “{flow.nodes.find((n) => n.id === pendingFrom)?.title}”
                    <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => setPendingFrom(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  "Drag nodes from the palette · click a right port then a left port to connect"
                )}
              </span>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="w-9 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>

            <div
              ref={canvasRef}
              className="relative h-[480px] overflow-auto rounded-lg border bg-muted/30"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                  setPendingFrom(null);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const type = e.dataTransfer.getData("text/node-type") as FlowNodeType;
                if (!type) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left + e.currentTarget.scrollLeft) / zoom;
                const y = (e.clientY - rect.top + e.currentTarget.scrollTop) / zoom;
                addNode(type, Math.round(x - NODE_W / 2), Math.round(y - NODE_H / 2));
              }}
            >
              <div
                className="relative"
                style={{
                  width: 2200,
                  height: 1100,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  backgroundImage:
                    "linear-gradient(to right, rgba(120,120,120,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.12) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                {/* Edges */}
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {flow.edges.map((e) => {
                    const from = flow.nodes.find((n) => n.id === e.from);
                    const to = flow.nodes.find((n) => n.id === e.to);
                    if (!from || !to) return null;
                    const x1 = from.x + NODE_W;
                    const y1 = from.y + NODE_H / 2;
                    const x2 = to.x;
                    const y2 = to.y + NODE_H / 2;
                    const mid = (x1 + x2) / 2;
                    return (
                      <g key={e.id}>
                        <path
                          d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                          stroke="hsl(var(--primary))"
                          strokeWidth={1.5}
                          fill="none"
                          markerEnd="url(#arrow)"
                        />
                        <circle cx={mid} cy={(y1 + y2) / 2} r={7} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={1} className="pointer-events-auto cursor-pointer"
                          onClick={() => {
                            patch({ edges: flow.edges.filter((x) => x.id !== e.id) });
                            toast({ title: "Edge removed" });
                          }}
                        >
                          <title>Remove connection</title>
                        </circle>
                      </g>
                    );
                  })}
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
                    </marker>
                  </defs>
                </svg>

                {/* Nodes */}
                {flow.nodes.map((n) => {
                  const meta = nodeMeta(n.type);
                  const Icon = TYPE_ICON[n.type] ?? Circle;
                  const unconfigured =
                    (n.type.startsWith("action.send") && !n.config.template) || (n.type === "cond.segment" && !n.config.segmentId);
                  return (
                    <div
                      key={n.id}
                      className={`absolute rounded-lg border-2 bg-card p-2 shadow-sm transition-colors ${nodeFill(n)}`}
                      style={{ left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(n.id);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-xs font-medium">{n.title}</span>
                        <span
                          className={`ml-auto h-2 w-2 shrink-0 rounded-full ${
                            unconfigured ? "bg-destructive" : n.type.startsWith("trigger") ? "bg-emerald-500" : "bg-primary/60"
                          }`}
                          title={unconfigured ? "Not configured" : "Configured"}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{meta.hint}</p>

                      {/* Selected affordances */}
                      {selectedId === n.id && (
                        <div className="absolute -top-7 right-0 flex gap-1">
                          <button
                            type="button"
                            className="rounded border bg-background p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Duplicate node"
                            onClick={(e) => { e.stopPropagation(); duplicateNode(n); }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded border bg-background p-1 text-muted-foreground hover:text-destructive"
                            aria-label="Delete node"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(n); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Ports */}
                      <button
                        type="button"
                        aria-label="Output port"
                        className={`absolute -right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 bg-background transition-transform hover:scale-125 ${
                          pendingFrom === n.id ? "border-primary bg-primary/30" : "border-primary/60"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingFrom) connectPorts(pendingFrom, n.id);
                          else setPendingFrom(n.id);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Input port"
                        className={`absolute -left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 bg-background transition-transform hover:scale-125 ${
                          pendingFrom && pendingFrom !== n.id ? "border-emerald-500" : "border-primary/60"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingFrom) connectPorts(pendingFrom, n.id);
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Minimap */}
              <div className="pointer-events-none absolute bottom-3 right-3 h-24 w-40 rounded-md border bg-background/90 p-1">
                {flow.nodes.map((n) => (
                  <span
                    key={n.id}
                    className={`absolute h-1.5 w-3 rounded-sm ${n.id === selectedId ? "bg-primary" : "bg-muted-foreground/50"}`}
                    style={{ left: `${(n.x / 2200) * 100}%`, top: `${(n.y / 1100) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Test run controls */}
            <div className="flex flex-wrap items-center gap-2">
              {!testOpen ? (
                <Button variant="outline" size="sm" onClick={startRun} disabled={flow.nodes.length === 0}>
                  <Play className="mr-1 h-4 w-4" /> Test run
                </Button>
              ) : (
                <>
                  <Select value={testContact} onValueChange={setTestContact}>
                    <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Sample contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["an***@mail.com", "rk***@proton.me", "+49 •••• 4821", "ps***@gmail.com"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={stepRun} disabled={runStep >= testPath.length - 1 && runStep >= 0}>
                    Step {Math.max(runStep + 1, 0)}/{testPath.length || 1}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setTestOpen(false); setRunStep(-1); setRunLog([]); }}>
                    Exit test run
                  </Button>
                </>
              )}
              {runLog.length > 0 && (
                <div className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground max-h-16 overflow-auto">
                  {runLog.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Inspector ── */}
          <Card className="xl:sticky xl:top-4 xl:self-start">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Inspector</CardTitle>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-xs text-muted-foreground">
                  Select a node on the canvas to configure it. Send nodes need a template; segment splits need an
                  audience — unconfigured nodes block publish.
                </p>
              ) : (
                <NodeInspector
                  node={selected}
                  onTitle={(t) => patchNode(selected.id, { title: t })}
                  onConfig={(k, v) => patchNodeConfig(selected.id, k, v)}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Validation drawer ── */}
        {drawerOpen && (
          <Card className="border-t-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Validation{" "}
                  <span className="ml-1 text-muted-foreground">
                    ({issues.filter((i) => i.severity === "error").length} errors,{" "}
                    {issues.filter((i) => i.severity === "warning").length} warnings)
                  </span>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {issues.length === 0 ? (
                <p className="text-xs text-emerald-600">No issues — ready to publish.</p>
              ) : (
                issues.map((issue, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => jumpToIssue(issue)}
                    className={`flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                      issue.severity === "error" ? "border-destructive/40" : "border-amber-400/50"
                    }`}
                  >
                    {issue.severity === "error" ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <AlertTriangleIcon />
                    )}
                    <span className="flex-1">{issue.message}</span>
                    {issue.nodeId && <Badge variant="outline" className="text-[10px]">Jump to node</Badge>}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>

      {/* Delete node confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete node “{confirmDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The node and its connections are removed. You can undo from the strip above for a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteNode(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete flow confirm */}
      <AlertDialog open={confirmDeleteFlow} onOpenChange={setConfirmDeleteFlow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow “{flow.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft graph and version history. Active enrollments exit the flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteFlow(flow.id);
                setFlow(null);
                navigate("automation-flows");
                toast({ title: "Flow deleted", description: flow.name });
              }}
            >
              Delete flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New flow dialog */}
      <NewFlowDialog
        open={newFlowOpen}
        onOpenChange={setNewFlowOpen}
        name={newFlowName}
        onNameChange={setNewFlowName}
        onCreate={(name, trigger) => {
          const f = createFlow(name, trigger);
          setNewFlowName("");
          setNewFlowOpen(false);
          setFlow(f);
          navigate("automation-flows", { flow: f.id });
        }}
      />
    </Page>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Sub-components                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function TriggerChooser({ onPick }: { onPick: (t: FlowNodeType) => void }) {
  const triggers = NODE_GROUPS.find((g) => g.group === "Triggers")!.nodes;
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Choose the entry event</CardTitle>
        <p className="text-xs text-muted-foreground">
          Every flow starts with one trigger — the platform event that enrolls contacts.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {triggers.map((t) => {
          const Icon = TYPE_ICON[t.type] ?? Circle;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onPick(t.type)}
              className="flex items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">{t.title}</span>
                <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NewFlowDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  onCreate: (name: string, trigger: FlowNodeType) => void;
}) {
  const [trigger, setTrigger] = useState<FlowNodeType>("trigger.challenge_passed");
  const triggers = NODE_GROUPS.find((g) => g.group === "Triggers")!.nodes;
  if (!open) return null;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>New automation flow</AlertDialogTitle>
          <AlertDialogDescription>Name it and pick the entry trigger — you can change everything later.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="flow-name" className="text-xs">Flow name</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Payout celebration loop"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Entry trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as FlowNodeType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggers.map((t) => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!name.trim()} onClick={() => onCreate(name.trim(), trigger)}>
            Create flow
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NodeInspector({
  node,
  onTitle,
  onConfig,
}: {
  node: FlowNode;
  onTitle: (t: string) => void;
  onConfig: (key: string, value: string | boolean | number) => void;
}) {
  const isSend = node.type.startsWith("action.send");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(() => {
          const Icon = TYPE_ICON[node.type] ?? Circle;
          return <Icon className="h-4 w-4 text-primary" />;
        })()}
        <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
      </div>

      <div>
        <Label htmlFor="node-title" className="text-xs">Node label</Label>
        <Input id="node-title" value={node.title} onChange={(e) => onTitle(e.target.value)} className="mt-1 h-8" />
      </div>

      {isSend && (
        <>
          <div>
            <Label className="text-xs">Template</Label>
            <Select value={(node.config.template as string) || ""} onValueChange={(v) => onConfig("template", v)}>
              <SelectTrigger className="mt-1 h-8">
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                {listStudioTemplates().map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!node.config.template && (
              <p className="mt-1 text-[11px] text-destructive">Required — publish is blocked until set.</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="override-policy" className="text-xs">Override quiet-hours policy</Label>
              <p className="text-[10px] text-muted-foreground">Off = M2.4 policy always wins.</p>
            </div>
            <Switch
              id="override-policy"
              checked={node.config.overridePolicy === true}
              onCheckedChange={(v) => onConfig("overridePolicy", v)}
            />
          </div>
        </>
      )}

      {node.type === "cond.segment" && (
        <div>
          <Label className="text-xs">Segment</Label>
          <Select value={(node.config.segmentId as string) || ""} onValueChange={(v) => onConfig("segmentId", v)}>
            <SelectTrigger className="mt-1 h-8">
              <SelectValue placeholder="Select a segment…" />
            </SelectTrigger>
            <SelectContent>
              {listSegments().map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.size.toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!node.config.segmentId && (
            <p className="mt-1 text-[11px] text-destructive">Required — publish is blocked until set.</p>
          )}
        </div>
      )}

      {node.type === "cond.consent" && (
        <div>
          <Label className="text-xs">Consent channel</Label>
          <Select value={(node.config.channel as string) || "email"} onValueChange={(v) => onConfig("channel", v)}>
            <SelectTrigger className="mt-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["email", "sms", "whatsapp", "push", "in-app"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[10px] text-muted-foreground">Granted → yes branch, Withdrawn → no branch.</p>
        </div>
      )}

      {node.type === "cond.attribute" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Attribute</Label>
            <Select value={(node.config.attribute as string) || ""} onValueChange={(v) => onConfig("attribute", v)}>
              <SelectTrigger className="mt-1 h-8">
                <SelectValue placeholder="Choose attribute…" />
              </SelectTrigger>
              <SelectContent>
                {["kyc_status", "challenge_phase", "account_type", "country", "ltv_band", "risk_score"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Value</Label>
            <Input value={(node.config.value as string) || ""} onChange={(e) => onConfig("value", e.target.value)} className="mt-1 h-8" placeholder="e.g. Approved" />
          </div>
        </div>
      )}

      {node.type === "action.wait_duration" && (
        <div>
          <Label htmlFor="wait-days" className="text-xs">Wait (days)</Label>
          <Input
            id="wait-days"
            type="number"
            min={1}
            value={(node.config.amount as number) || 1}
            onChange={(e) => onConfig("amount", Number(e.target.value))}
            className="mt-1 h-8"
          />
        </div>
      )}

      {node.type === "action.wait_window" && (
        <div>
          <Label htmlFor="wait-window" className="text-xs">Resume window</Label>
          <Input
            id="wait-window"
            value={(node.config.window as string) || ""}
            onChange={(e) => onConfig("window", e.target.value)}
            className="mt-1 h-8"
            placeholder="09:00–17:00"
          />
        </div>
      )}

      {node.type === "action.update_tag" && (
        <div>
          <Label htmlFor="tag" className="text-xs">Tag</Label>
          <Input id="tag" value={(node.config.tag as string) || ""} onChange={(e) => onConfig("tag", e.target.value)} className="mt-1 h-8" placeholder="upsell-sent" />
        </div>
      )}

      {node.type === "action.update_crm" && (
        <div>
          <Label className="text-xs">CRM stage</Label>
          <Select value={(node.config.stage as string) || ""} onValueChange={(v) => onConfig("stage", v)}>
            <SelectTrigger className="mt-1 h-8">
              <SelectValue placeholder="Choose stage…" />
            </SelectTrigger>
            <SelectContent>
              {["Lead", "Trialing", "Funded", "At risk", "Churned"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {node.type === "action.webhook" && (
        <div>
          <Label htmlFor="hook-url" className="text-xs">Endpoint URL</Label>
          <Input id="hook-url" value={(node.config.url as string) || ""} onChange={(e) => onConfig("url", e.target.value)} className="mt-1 h-8" placeholder="https://hooks.example.com/…" />
        </div>
      )}

      {node.type.startsWith("trigger.") && (
        <p className="text-[11px] text-muted-foreground">
          Enrolls contacts when this platform event fires. No configuration needed — event payloads flow into
          downstream nodes.
        </p>
      )}

      {node.type === "control.end" && (
        <p className="text-[11px] text-muted-foreground">Terminates this branch. Every branch should end here.</p>
      )}
    </div>
  );
}
