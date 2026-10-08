"use client";

/**
 * Certificate Management Page — manage certificate templates + fonts.
 *
 * Spec sections 12, 25, 27. Two tabs:
 *   1. Templates — DataTable + master/detail editor (name, description,
 *      trigger event, layout, active toggle, preview placeholder, save).
 *   2. Fonts — simple list of certificate fonts with add / select / delete.
 *
 * No blue/indigo accents — neutral, emerald, amber, rose tones only.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getCertificateTemplates,
  type CertificateTemplate,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Award,
  Plus,
  Pencil,
  Save,
  X,
  Type,
  Check,
  Trash2,
  Image as ImageIcon,
  ScrollText,
} from "lucide-react";

/** Tone for a given certificate trigger event. */
function triggerTone(
  trigger: string,
): "info" | "warning" | "success" | "muted" {
  if (trigger.includes("passed")) return "success";
  if (trigger.includes("funded")) return "info";
  if (trigger.includes("won")) return "warning";
  return "muted";
}

/** Tone for a layout badge. */
function layoutTone(layout: string): "info" | "warning" | "success" | "muted" {
  switch (layout) {
    case "standard":
      return "muted";
    case "premium":
      return "info";
    case "trophy":
      return "warning";
    default:
      return "muted";
  }
}

/** Hardcoded font list (mock). */
const CERT_FONTS = [
  { id: "f-1", name: "Arial", category: "Sans-serif" },
  { id: "f-2", name: "Times New Roman", category: "Serif" },
  { id: "f-3", name: "Montserrat", category: "Sans-serif" },
  { id: "f-4", name: "Roboto", category: "Sans-serif" },
] as const;

const TRIGGER_OPTIONS = [
  "challenge.passed",
  "challenge.funded",
  "competition.won",
] as const;

const LAYOUT_OPTIONS = ["standard", "premium", "trophy"] as const;

export function CertificateManagementPage() {
  const { runtime } = usePlatform();
  void runtime; // hook usage kept for runtime parity with other settings pages
  const templates = getCertificateTemplates();
  const [selected, setSelected] = useState<CertificateTemplate | null>(null);
  const [working, setWorking] = useState<
    Record<string, CertificateTemplate>
  >({});
  const [selectedFontId, setSelectedFontId] = useState<string>("f-3");

  const activeTemplate = selected ? working[selected.id] ?? selected : null;

  const onRowClick = (t: CertificateTemplate) => {
    setSelected(t);
    setWorking((w) => ({
      ...w,
      [t.id]: w[t.id] ?? { ...t },
    }));
  };

  const updateField = (
    id: string,
    patch: Partial<CertificateTemplate>,
  ) => {
    setWorking((w) => ({
      ...w,
      [id]: { ...(w[id] ?? templates.find((t) => t.id === id)!), ...patch },
    }));
  };

  const onSave = (t: CertificateTemplate) => {
    toast({
      title: "Certificate template saved",
      description: `“${t.name}” updated successfully. (demo)`,
    });
  };

  const columns: Column<CertificateTemplate>[] = [
    {
      key: "name",
      header: "Name",
      cell: (t) => (
        <span className="font-medium text-foreground">{t.name}</span>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "description",
      header: "Description",
      cell: (t) => (
        <span className="text-xs text-muted-foreground" title={t.description}>
          {t.description.length > 60
            ? `${t.description.slice(0, 60)}…`
            : t.description}
        </span>
      ),
      sortValue: (t) => t.description,
    },
    {
      key: "triggerEvent",
      header: "Trigger Event",
      cell: (t) => (
        <StatusBadge tone={triggerTone(t.triggerEvent)}>
          {t.triggerEvent}
        </StatusBadge>
      ),
      sortValue: (t) => t.triggerEvent,
    },
    {
      key: "layout",
      header: "Layout",
      cell: (t) => (
        <Badge variant="outline" className="capitalize">
          {t.layout}
        </Badge>
      ),
      sortValue: (t) => t.layout,
    },
    {
      key: "active",
      header: "Active",
      cell: (t) => {
        // Bind the table Switch to working state (Round 4 fix: previously
        // read `t.active` from the immutable templates array, so the
        // toggle visually bounced back to the seed value on next render).
        const effectiveActive = working[t.id]?.active ?? t.active;
        return (
          <Switch
            checked={effectiveActive}
            onCheckedChange={(checked) => {
              updateField(t.id, { active: checked });
              toast({
                title: checked ? "Template enabled" : "Template disabled",
                description: `“${t.name}” is now ${checked ? "active" : "inactive"} (demo) — save to commit.`,
              });
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Toggle active state for ${t.name}`}
          />
        );
      },
      width: "80px",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(t);
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

  return (
    <Page>
      <PageHeader
        title="Certificate Management"
        description="Configure certificate templates awarded for challenge milestones and competition wins."
        icon={Award}
      />
      <PageContent>
        <Tabs defaultValue="templates" className="w-full">
          <TabsList>
            <TabsTrigger value="templates" className="gap-1">
              <ScrollText className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="fonts" className="gap-1">
              <Type className="h-3.5 w-3.5" />
              Fonts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              {/* Master: table */}
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Certificate Templates{" "}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({templates.length})
                    </span>
                  </p>
                </div>
                <DataTable
                  columns={columns}
                  data={templates}
                  rowKey={(t) => t.id}
                  onRowClick={onRowClick}
                  searchableText={(t) =>
                    `${t.name} ${t.description} ${t.triggerEvent}`
                  }
                  searchPlaceholder="Search templates…"
                  emptyTitle="No certificate templates"
                  emptyDescription="Add a template to start issuing certificates to traders."
                  pageSize={8}
                />
              </div>

              {/* Detail: editor */}
              <div className="rounded-lg border bg-card p-4">
                {activeTemplate ? (
                  <TemplateEditor
                    template={activeTemplate}
                    onChange={(patch) =>
                      updateField(activeTemplate.id, patch)
                    }
                    onSave={() => onSave(activeTemplate)}
                    onClose={() => setSelected(null)}
                  />
                ) : (
                  <EmptyState
                    icon={Award}
                    title="No template selected"
                    description="Pick a certificate template to edit its layout, trigger event, and active state."
                    hint="Layouts: standard · premium · trophy."
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fonts">
            <FontsPanel
              selectedFontId={selectedFontId}
              onSelectFont={setSelectedFontId}
            />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}

function TemplateEditor({
  template,
  onChange,
  onSave,
  onClose,
}: {
  template: CertificateTemplate;
  onChange: (patch: Partial<CertificateTemplate>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {template.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last modified{" "}
            {new Date(template.lastModified).toLocaleDateString()}
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
        <StatusBadge tone={triggerTone(template.triggerEvent)}>
          {template.triggerEvent}
        </StatusBadge>
        <Badge variant="outline" className="capitalize">
          {template.layout}
        </Badge>
        <StatusBadge tone={template.active ? "success" : "muted"}>
          {template.active ? "active" : "inactive"}
        </StatusBadge>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="cert-name">Name</Label>
        <Input
          id="cert-name"
          value={template.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cert-desc">Description</Label>
        <Textarea
          id="cert-desc"
          rows={3}
          value={template.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Trigger Event</Label>
          <Select
            value={template.triggerEvent}
            onValueChange={(v) => onChange({ triggerEvent: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select trigger event…" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Layout</Label>
          <Select
            value={template.layout}
            onValueChange={(v) => onChange({ layout: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select layout…" />
            </SelectTrigger>
            <SelectContent>
              {LAYOUT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt} className="capitalize">
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
            htmlFor="cert-active"
            className="cursor-pointer text-sm font-medium"
          >
            Active
          </Label>
          <span className="text-xs text-muted-foreground">
            Award this certificate when the trigger fires.
          </span>
        </div>
        <Switch
          id="cert-active"
          checked={template.active}
          onCheckedChange={(checked) => onChange({ active: checked })}
        />
      </div>

      {/* Preview placeholder — explains the visual goal without requiring a render pipeline */}
      <div className="space-y-1.5">
        <Label>Preview</Label>
        <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/20 p-4 text-center">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p className="text-xs">Certificate preview placeholder</p>
            <p className="text-[10px] text-muted-foreground/70">
              Layout:{" "}
              <span className="font-mono">{template.layout}</span> · Trigger:{" "}
              <span className="font-mono">{template.triggerEvent}</span>
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          Save Template
        </Button>
      </div>
    </div>
  );
}

function FontsPanel({
  selectedFontId,
  onSelectFont,
}: {
  selectedFontId: string;
  onSelectFont: (id: string) => void;
}) {
  const onAdd = () =>
    toast({
      title: "Add font",
      description: "Font uploader would open here (demo).",
    });
  const onDelete = (name: string) =>
    toast({
      title: "Font removed",
      description: `“${name}” was deleted (demo).`,
    });
  const onSelect = (name: string) =>
    toast({
      title: "Font selected",
      description: `“${name}” is now the default certificate font.`,
    });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Certificate Fonts</p>
          <p className="text-xs text-muted-foreground">
            Fonts available when rendering certificates.
          </p>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Font
        </Button>
      </div>

      <ul className="divide-y">
        {CERT_FONTS.map((font) => {
          const isSelected = font.id === selectedFontId;
          return (
            <li
              key={font.id}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40"
                  style={{ fontFamily: font.name }}
                >
                  <span className="text-sm">Aa</span>
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ fontFamily: font.name }}
                  >
                    {font.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {font.category}
                    {isSelected ? " · default" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isSelected ? (
                  <Badge variant="outline" className="gap-1 text-emerald-700">
                    <Check className="h-3 w-3" />
                    Selected
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => {
                      onSelectFont(font.id);
                      onSelect(font.name);
                    }}
                  >
                    Select
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                  onClick={() => onDelete(font.name)}
                  aria-label={`Delete ${font.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
