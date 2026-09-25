"use client";

/**
 * Email Templates Page — manage transactional email templates.
 *
 * Spec sections 12, 25, 27. Master/detail layout: a DataTable of templates
 * sits on the left, and clicking a row reveals an editable detail panel on
 * the right (progressive disclosure — advanced editing only when needed).
 *
 * No blue/indigo accents — uses neutral, emerald, amber, rose tones.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getEmailTemplates,
  type EmailTemplate,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Save,
  Send,
  Variable,
  Clock,
  X,
  FileText,
} from "lucide-react";

/** Tone for a given trigger event. */
function triggerTone(trigger: string): "info" | "warning" | "success" | "muted" {
  if (trigger.startsWith("breach")) return "warning";
  if (trigger.startsWith("payout")) return "success";
  if (trigger.startsWith("kyc")) return "info";
  if (trigger.startsWith("challenge")) return "muted";
  return "muted";
}

/** Truncate long text for table cells. */
function truncate(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function EmailTemplatesPage() {
  usePlatform();
  const templates = getEmailTemplates();
  const [selected, setSelected] = useState<EmailTemplate | null>(null);

  // Local working copy of editable templates so unsaved edits don't leak
  // into the table view.
  const [working, setWorking] = useState<Record<string, EmailTemplate>>({});

  const activeTemplate = selected ? working[selected.id] ?? selected : null;

  const onRowClick = (t: EmailTemplate) => {
    setSelected(t);
    setWorking((w) => ({
      ...w,
      [t.id]: w[t.id] ?? { ...t },
    }));
  };

  const updateField = (id: string, patch: Partial<EmailTemplate>) => {
    setWorking((w) => ({
      ...w,
      [id]: { ...(w[id] ?? templates.find((t) => t.id === id)!), ...patch },
    }));
  };

  const onSave = (t: EmailTemplate) => {
    toast({
      title: "Template saved",
      description: `“${t.name}” updated successfully.`,
    });
  };

  const onSendTest = (t: EmailTemplate) => {
    toast({
      title: "Test email sent",
      description: `A test of “${t.name}” was dispatched to your inbox.`,
    });
  };

  const onDelete = (t: EmailTemplate) => {
    // Demo-only — template row stays in the table because there's no
    // persistence layer. Honest copy makes the demo state explicit.
    toast({
      title: "Template deleted (demo)",
      description: `"${t.name}" would be removed in production.`,
      variant: "destructive",
    });
    setSelected(null);
  };

  const columns: Column<EmailTemplate>[] = [
    {
      key: "name",
      header: "Name",
      cell: (t) => (
        <span className="font-medium text-foreground">{t.name}</span>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "subject",
      header: "Subject",
      cell: (t) => (
        <span className="text-muted-foreground" title={t.subject}>
          {truncate(t.subject, 56)}
        </span>
      ),
      sortValue: (t) => t.subject,
    },
    {
      key: "trigger",
      header: "Trigger",
      cell: (t) => (
        <StatusBadge tone={triggerTone(t.trigger)}>{t.trigger}</StatusBadge>
      ),
      sortValue: (t) => t.trigger,
    },
    {
      key: "variables",
      header: "Variables",
      cell: (t) => (
        <Badge variant="outline" className="gap-1 font-mono text-[10px]">
          <Variable className="h-3 w-3" />
          {t.variables.length}
        </Badge>
      ),
      sortValue: (t) => t.variables.length,
      numeric: true,
    },
    {
      key: "lastModified",
      header: "Last Modified",
      cell: (t) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(t.lastModified).toLocaleDateString()}
        </span>
      ),
      sortValue: (t) => t.lastModified,
    },
    {
      key: "actions",
      header: "",
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-rose-600 hover:text-rose-700"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(t);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
      width: "120px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Email Templates"
        description="Transactional email templates triggered by platform events."
        icon={Mail}
        actions={
          <Button
            size="sm"
            onClick={() =>
              toast({
                title: "Add template",
                description: "Template editor would open here (demo).",
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Master: table */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                Templates{" "}
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
              searchableText={(t) => `${t.name} ${t.subject} ${t.trigger}`}
              searchPlaceholder="Search templates…"
              emptyTitle="No email templates"
              emptyDescription="Add a template to start sending transactional emails."
              pageSize={8}
            />
          </div>

          {/* Detail: editor */}
          <div className="rounded-lg border bg-card p-4">
            {activeTemplate ? (
              <TemplateDetailPanel
                template={activeTemplate}
                onChange={(patch) => updateField(activeTemplate.id, patch)}
                onSave={() => onSave(activeTemplate)}
                onSendTest={() => onSendTest(activeTemplate)}
                onClose={() => setSelected(null)}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No template selected"
                description="Select a template from the list to edit its subject, body, and variables."
                hint="Tip: variables like {{user_name}} are replaced at send time."
              />
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

function TemplateDetailPanel({
  template,
  onChange,
  onSave,
  onSendTest,
  onClose,
}: {
  template: EmailTemplate;
  onChange: (patch: Partial<EmailTemplate>) => void;
  onSave: () => void;
  onSendTest: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{template.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ID: <span className="font-mono">{template.id}</span>
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
        <StatusBadge tone={triggerTone(template.trigger)}>
          {template.trigger}
        </StatusBadge>
        <Badge variant="outline" className="gap-1 font-mono text-[10px]">
          <Variable className="h-3 w-3" />
          {template.variables.length} variables
        </Badge>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="tpl-subject">Subject</Label>
        <Input
          id="tpl-subject"
          value={template.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Email subject line…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tpl-body">Body</Label>
        <Textarea
          id="tpl-body"
          value={template.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={8}
          placeholder="Email body — use {{variables}} for personalization…"
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Variables</Label>
        <div className="flex flex-wrap gap-1.5">
          {template.variables.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No variables defined.
            </span>
          ) : (
            template.variables.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="bg-muted/40 font-mono text-[10px]"
              >
                {`{{${v}}}`}
              </Badge>
            ))
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onSendTest}>
          <Send className="h-3.5 w-3.5" />
          Send Test
        </Button>
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          Save Template
        </Button>
      </div>
    </div>
  );
}
