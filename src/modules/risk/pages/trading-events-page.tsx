"use client";

/**
 * Trading Events Page — configure detection rules for news, copy trading,
 * inverse trading, and weekend trading events.
 *
 * Spec sections 12, 19, 20, 25, 27. Four tabs (one per event type). Each
 * tab shows a DataTable; row click reveals a config panel (name,
 * description, symbol, severity, action, active toggle, save).
 *
 * No blue/indigo accents — neutral, emerald, amber, rose tones only.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTradingEventRules,
  type TradingEventRule,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, breachSeverityTone } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Radio,
  Newspaper,
  Copy,
  Repeat,
  CalendarDays,
  Pencil,
  Save,
  X,
  ShieldAlert,
} from "lucide-react";

type RuleType = "news" | "copy" | "inverse" | "weekend";

interface TabDef {
  value: RuleType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  {
    value: "news",
    label: "News",
    icon: Newspaper,
    description: "Block or flag trades around high-impact economic releases.",
  },
  {
    value: "copy",
    label: "Copy Trading",
    icon: Copy,
    description: "Detect synchronized order patterns across multiple accounts.",
  },
  {
    value: "inverse",
    label: "Inverse Trading",
    icon: Repeat,
    description: "Detect hedging and inverse position patterns between accounts.",
  },
  {
    value: "weekend",
    label: "Weekend",
    icon: CalendarDays,
    description: "Block new positions on weekends for challenge accounts.",
  },
];

const SEVERITY_OPTIONS = ["warning", "critical"] as const;
const ACTION_OPTIONS = ["flag", "block", "notify"] as const;

/** Tone for an action badge. */
function actionTone(
  action: TradingEventRule["action"],
): "warning" | "danger" | "info" {
  switch (action) {
    case "flag":
      return "warning";
    case "block":
      return "danger";
    case "notify":
    default:
      return "info";
  }
}

export function TradingEventsPage() {
  const { runtime } = usePlatform();
  void runtime;
  const [tab, setTab] = useState<RuleType>("news");
  const [selected, setSelected] = useState<
    { type: RuleType; id: string } | null
  >(null);
  const [working, setWorking] = useState<Record<string, TradingEventRule>>({});

  const allRules = getTradingEventRules();
  const rules = getTradingEventRules(tab);
  const activeRule = selected
    ? working[selected.id] ??
      allRules.find((r) => r.id === selected.id) ??
      null
    : null;

  const onRowClick = (r: TradingEventRule) => {
    setSelected({ type: r.type, id: r.id });
    setWorking((w) => ({
      ...w,
      [r.id]: w[r.id] ?? { ...r },
    }));
  };

  const updateField = (id: string, patch: Partial<TradingEventRule>) => {
    setWorking((w) => ({
      ...w,
      [id]: {
        ...(w[id] ?? allRules.find((r) => r.id === id)!),
        ...patch,
      },
    }));
  };

  const onActiveToggle = (r: TradingEventRule, checked: boolean) => {
    updateField(r.id, { active: checked });
    toast({
      title: checked ? "Rule enabled" : "Rule disabled",
      description: `“${r.name}” is now ${checked ? "active" : "inactive"}.`,
    });
  };

  const onSave = (r: TradingEventRule) => {
    toast({
      title: "Rule updated",
      description: `“${r.name}” configuration saved successfully.`,
    });
  };

  const columns: Column<TradingEventRule>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <span className="font-medium text-foreground">{r.name}</span>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "description",
      header: "Description",
      cell: (r) => (
        <span className="text-xs text-muted-foreground" title={r.description}>
          {r.description.length > 64
            ? `${r.description.slice(0, 64)}…`
            : r.description}
        </span>
      ),
      sortValue: (r) => r.description,
    },
    {
      key: "symbol",
      header: "Symbol",
      cell: (r) => (
        <span className="font-mono text-xs">{r.symbol}</span>
      ),
      sortValue: (r) => r.symbol,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (r) => (
        <StatusBadge tone={breachSeverityTone(r.severity)}>
          {r.severity}
        </StatusBadge>
      ),
      sortValue: (r) => r.severity,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => (
        <StatusBadge tone={actionTone(r.action)}>{r.action}</StatusBadge>
      ),
      sortValue: (r) => r.action,
    },
    {
      key: "active",
      header: "Active",
      cell: (r) => (
        <Switch
          checked={r.active}
          onCheckedChange={(checked) => onActiveToggle(r, checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Toggle active state for ${r.name}`}
        />
      ),
      width: "80px",
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(r);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
        </div>
      ),
      width: "80px",
    },
  ];

  const visibleActiveRule = activeRule && activeRule.type === tab ? activeRule : null;
  const currentTab = TABS.find((t) => t.value === tab)!;

  return (
    <Page>
      <PageHeader
        title="Trading Event Rules"
        description="Configure detection for news, copy, inverse, and weekend trading events."
        icon={Radio}
      />
      <PageContent>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as RuleType)}
          className="w-full"
        >
          <TabsList className="flex flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <RuleTabContent
                description={t.description}
                rules={getTradingEventRules(t.value)}
                columns={columns}
                onRowClick={onRowClick}
                activeRule={t.value === tab ? visibleActiveRule : null}
                onChange={updateField}
                onSave={onSave}
                onClose={() => setSelected(null)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </PageContent>
    </Page>
  );
}

function RuleTabContent({
  description,
  rules,
  columns,
  onRowClick,
  activeRule,
  onChange,
  onSave,
  onClose,
}: {
  description: string;
  rules: TradingEventRule[];
  columns: Column<TradingEventRule>[];
  onRowClick: (r: TradingEventRule) => void;
  activeRule: TradingEventRule | null;
  onChange: (id: string, patch: Partial<TradingEventRule>) => void;
  onSave: (r: TradingEventRule) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
        {description}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Master: table */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              Detection Rules{" "}
              <span className="ml-1 text-xs text-muted-foreground">
                ({rules.length})
              </span>
            </p>
          </div>
          <DataTable
            columns={columns}
            data={rules}
            rowKey={(r) => r.id}
            onRowClick={onRowClick}
            searchableText={(r) => `${r.name} ${r.description} ${r.symbol}`}
            searchPlaceholder="Search rules…"
            emptyTitle="No rules in this category"
            emptyDescription="Add a rule to start detecting this event type."
            pageSize={8}
          />
        </div>

        {/* Detail: editor */}
        <div className="rounded-lg border bg-card p-4">
          {activeRule ? (
            <RuleEditor
              rule={activeRule}
              onChange={(patch) => onChange(activeRule.id, patch)}
              onSave={() => onSave(activeRule)}
              onClose={onClose}
            />
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="No rule selected"
              description="Select a rule from the list to configure its symbol, severity, action, and active state."
              hint="Severity warning = flag; critical = block or escalate."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  onChange,
  onSave,
  onClose,
}: {
  rule: TradingEventRule;
  onChange: (patch: Partial<TradingEventRule>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{rule.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Type: <span className="font-mono">{rule.type}</span> · ID:{" "}
            <span className="font-mono">{rule.id}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={breachSeverityTone(rule.severity)}>
          {rule.severity}
        </StatusBadge>
        <StatusBadge tone={actionTone(rule.action)}>{rule.action}</StatusBadge>
        <StatusBadge tone={rule.active ? "success" : "muted"}>
          {rule.active ? "active" : "inactive"}
        </StatusBadge>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="rule-name">Name</Label>
        <Input
          id="rule-name"
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule-desc">Description</Label>
        <Textarea
          id="rule-desc"
          rows={3}
          value={rule.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule-symbol">Symbol</Label>
        <Input
          id="rule-symbol"
          value={rule.symbol}
          onChange={(e) => onChange({ symbol: e.target.value })}
          placeholder="e.g. All, EURUSD, XAUUSD"
          className="font-mono"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select
            value={rule.severity}
            onValueChange={(v) =>
              onChange({ severity: v as TradingEventRule["severity"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select severity…" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select
            value={rule.action}
            onValueChange={(v) =>
              onChange({ action: v as TradingEventRule["action"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select action…" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="rule-active"
            className="cursor-pointer text-sm font-medium"
          >
            Active
          </Label>
          <span className="text-xs text-muted-foreground">
            Apply this rule to incoming trades.
          </span>
        </div>
        <Switch
          id="rule-active"
          checked={rule.active}
          onCheckedChange={(checked) => onChange({ active: checked })}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          Save Rule
        </Button>
      </div>
    </div>
  );
}
