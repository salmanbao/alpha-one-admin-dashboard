"use client";

/**
 * Email Template Edit / Create page (UX Constitution §12, §25-27).
 *
 * Enhanced email template editor with two tabs:
 *   1. Content — Template Name (dropdown of standard triggers), Subject,
 *      Enabled toggle, and a basic WYSIWYG Rich Text Editor (contentEditable
 *      + document.execCommand) with toolbar (Bold / Italic / Underline /
 *      Bullet list / Numbered list / Link / Source toggle) and a Variables
 *      dropdown that inserts {{user_name}}, {{challenge_name}}, etc. at
 *      the caret. Source view is a Textarea that shows/edits the raw HTML.
 *   2. Recipients — CC, BCC, Reply-To.
 *
 * Action buttons: Save / Save and add another / Save and continue editing /
 * Delete (AlertDialog). Send Test fires a toast.
 *
 * Pre-fills from an existing template when router.params.id resolves to one;
 * otherwise renders an empty "new template" form. All form state lives in
 * local useState — no mutations to mock data.
 *
 * The WYSIWYG editor uses document.execCommand (legacy but supported in all
 * current browsers) per task spec — no third-party editor library.
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getEmailTemplates, type EmailTemplate } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import {
  Mail,
  Save,
  Plus,
  Trash2,
  ChevronLeft,
  Send,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Code2,
  Variable,
  Eye,
  AtSign,
  Reply,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static option pools                                                  */
/* ------------------------------------------------------------------ */

/** Standard template trigger events surfaced in the Name dropdown. */
const TEMPLATE_NAMES = [
  "Challenge Purchased",
  "Challenge Passed",
  "Payout Approved",
  "Breach Notification",
  "KYC Approved",
  "KYC Rejected",
  "Account Created",
  "Password Reset",
  "Login Notification",
  "Payout Requested",
  "Payout Completed",
  "Challenge Failed",
  "Competition Won",
] as const;

/** Variables insertable at the caret. */
const TEMPLATE_VARIABLES = [
  "user_name",
  "user_email",
  "challenge_name",
  "phase",
  "amount",
  "currency",
  "method",
  "account_login",
  "account_size",
  "rule",
  "next_steps",
  "platform_name",
  "support_email",
  "dashboard_url",
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function triggerTone(
  trigger: string,
): "warning" | "success" | "info" | "muted" {
  if (trigger.startsWith("breach")) return "warning";
  if (trigger.startsWith("payout")) return "success";
  if (trigger.startsWith("kyc")) return "info";
  if (trigger.startsWith("challenge")) return "muted";
  return "muted";
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* WYSIWYG Rich Text Editor                                            */
/* ------------------------------------------------------------------ */

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showSource, setShowSource] = useState(false);

  const exec = (command: string, val?: string) => {
    // execCommand is deprecated but supported in all current browsers and is
    // explicitly required by the task spec (no external editor library).
    if (typeof document !== "undefined" && document.execCommand) {
      editorRef.current?.focus();
      document.execCommand(command, false, val);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  const onInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`;
    // Try insertText first; fall back to insertHTML for older browsers.
    if (typeof document !== "undefined" && document.execCommand) {
      editorRef.current?.focus();
      const inserted = document.execCommand("insertText", false, token);
      if (!inserted) {
        document.execCommand("insertHTML", false, token);
      }
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  const toolbarButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1.5">
        <button
          type="button"
          className={toolbarButtonClass}
          title="Bold"
          aria-label="Bold"
          onClick={() => exec("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Italic"
          aria-label="Italic"
          onClick={() => exec("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Underline"
          aria-label="Underline"
          onClick={() => exec("underline")}
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <button
          type="button"
          className={toolbarButtonClass}
          title="Bullet list"
          aria-label="Insert bullet list"
          onClick={() => exec("insertUnorderedList")}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Numbered list"
          aria-label="Insert numbered list"
          onClick={() => exec("insertOrderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <button
          type="button"
          className={toolbarButtonClass}
          title="Insert link"
          aria-label="Insert link"
          onClick={() => {
            const url =
              typeof window !== "undefined"
                ? window.prompt("Link URL", "https://")
                : null;
            if (url) exec("createLink", url);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Select value="" onValueChange={(v) => v && insertVariable(v)}>
          <SelectTrigger
            className="h-8 w-fit gap-1 border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted"
            aria-label="Insert variable"
          >
            <Variable className="h-3.5 w-3.5" />
            <SelectValue placeholder="Insert variable" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_VARIABLES.map((v) => (
              <SelectItem key={v} value={v} className="font-mono text-xs">
                {`{{${v}}}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <button
            type="button"
            className={cn(
              toolbarButtonClass,
              "w-auto gap-1 px-2 text-xs",
              showSource && "bg-muted text-foreground",
            )}
            title="Toggle HTML source view"
            aria-label="Toggle source code view"
            onClick={() => setShowSource((s) => !s)}
          >
            <Code2 className="h-3.5 w-3.5" />
            {showSource ? "Rich text" : "Source"}
          </button>
        </div>
      </div>

      {/* Editor surface */}
      {showSource ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="min-h-[300px] resize-y bg-[#faf6f0] font-mono text-xs"
          placeholder="<p>Email body HTML…</p>"
        />
      ) : (
        <div
          key={`rte-${showSource ? "src" : "rt"}`}
          ref={editorRef}
          role="textbox"
          aria-label="Email body editor"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onBlur={onInput}
          data-placeholder={placeholder}
          dangerouslySetInnerHTML={{ __html: value || "" }}
          className={cn(
            "min-h-[300px] resize-y overflow-auto rounded-md border bg-[#faf6f0] p-3 text-sm",
            "prose prose-sm max-w-none focus:outline-none focus:ring-1 focus:ring-emerald-500/30",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_a]:text-emerald-700 [&_a]:underline",
            "before:text-muted-foreground/60 before:content-[attr(data-placeholder)] empty:before:content-[attr(data-placeholder)]",
          )}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Tip: use{" "}
        <code className="rounded bg-muted px-1 font-mono text-[10px]">
          {"{{variable}}"}
        </code>{" "}
        placeholders — replaced at send time. Variables dropdown inserts at the
        caret.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function EmailTemplateEditPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const existing = useMemo(
    () => (id ? getEmailTemplates().find((t) => t.id === id) : undefined),
    [id],
  );
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [enabled, setEnabled] = useState(true);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [tab, setTab] = useState<"content" | "recipients">("content");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const trigger = existing?.trigger ?? "challenge.purchased";

  const resetForm = () => {
    setName("");
    setSubject("");
    setBody("");
    setEnabled(true);
    setCc("");
    setBcc("");
    setReplyTo("");
  };

  const onSave = () => {
    toast({
      title: "Template saved",
      description: `${name || "Untitled template"} was saved successfully.`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Template saved",
      description: `${name || "Untitled template"} saved. Form cleared for the next template.`,
    });
    resetForm();
    setTab("content");
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `${name || "Untitled template"} updated. Continuing edits.`,
    });
  };

  const onSendTest = () => {
    toast({
      title: "Test email sent",
      description: `A test of “${name || "Untitled template"}” was dispatched to admin@example.com.`,
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Template deleted",
      description: `${name || "Untitled template"} was permanently deleted.`,
    });
    navigate("email-templates");
  };

  const preview: EmailTemplate = {
    id: existing?.id ?? "preview",
    name: name || "Untitled template",
    subject: subject || "(no subject)",
    body,
    trigger,
    variables: existing?.variables ?? [],
    lastModified: existing?.lastModified ?? new Date().toISOString(),
  };

  return (
    <Page>
      <PageHeader
        title={isNew ? "New Email Template" : "Edit Email Template"}
        description={
          isNew
            ? "Compose a transactional email with rich text body and variables."
            : `Editing “${existing?.name ?? ""}”.`
        }
        icon={Mail}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onSendTest}>
              <Send className="mr-1 h-3.5 w-3.5" /> Send Test
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("email-templates")}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Templates
            </Button>
          </div>
        }
      />

      <PageContent>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "content" | "recipients")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="content" className="gap-1">
              <Mail className="h-3.5 w-3.5" /> Content
            </TabsTrigger>
            <TabsTrigger value="recipients" className="gap-1">
              <AtSign className="h-3.5 w-3.5" /> Recipients
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col gap-4">
                <SectionCard
                  title="Template Settings"
                  description="Identifier, subject line, and active state."
                  icon={Mail}
                >
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <LabelWithHelp help="Select the trigger event this template responds to. Each event corresponds to a standard email type.">
                        Template Name
                      </LabelWithHelp>
                      <Select value={name} onValueChange={setName}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a template type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_NAMES.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-subject">Subject</Label>
                      <Input
                        id="tpl-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Email subject line — supports {{variables}}"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                      <div className="flex flex-col">
                        <Label
                          htmlFor="tpl-enabled"
                          className="cursor-pointer text-sm font-medium"
                        >
                          Enabled
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Disabled templates are not sent when their trigger
                          fires.
                        </span>
                      </div>
                      <Switch
                        id="tpl-enabled"
                        checked={enabled}
                        onCheckedChange={setEnabled}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Body — Rich Text"
                  description="WYSIWYG editor with formatting, lists, links, variables, and HTML source view."
                  icon={Code2}
                >
                  <RichTextEditor
                    value={body}
                    onChange={setBody}
                    placeholder="Hi {{user_name}}, your {{challenge_name}} challenge has been activated…"
                  />
                </SectionCard>
              </div>

              {/* Preview / variables column */}
              <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                <SectionCard
                  title="Preview"
                  description="How this email will render for traders."
                  icon={Eye}
                >
                  <div className="flex flex-col gap-3">
                    <div className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 border-b pb-2 text-xs text-muted-foreground">
                        <StatusBadge tone={triggerTone(trigger)}>
                          {trigger}
                        </StatusBadge>
                        <StatusBadge tone={enabled ? "success" : "muted"}>
                          {enabled ? "enabled" : "disabled"}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {preview.subject}
                      </p>
                      <div
                        className="mt-2 prose prose-sm max-w-none text-muted-foreground [&_a]:text-emerald-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                         
                        dangerouslySetInnerHTML={{ __html: body || "<p>(empty body)</p>" }}
                      />
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Variables:
                      </span>
                      {TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
                        <Badge
                          key={v}
                          variant="outline"
                          className="bg-muted/40 font-mono text-[10px]"
                        >
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recipients">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <SectionCard
                title="Recipient Overrides"
                description="Optional CC / BCC / Reply-To addresses applied on top of the trader recipient."
                icon={AtSign}
              >
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-cc">CC</Label>
                    <Textarea
                      id="tpl-cc"
                      rows={3}
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="finance@example.com, ops@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated email addresses.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-bcc">BCC</Label>
                    <Textarea
                      id="tpl-bcc"
                      rows={3}
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="archive@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated email addresses.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-replyto">Reply-To</Label>
                    <Input
                      id="tpl-replyto"
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="support@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email address for replies.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Routing Summary"
                description="How this template will be dispatched."
                icon={Reply}
              >
                <ul className="flex flex-col gap-2 text-xs">
                  <li className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-mono text-foreground">
                      {"{{user_email}}"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">CC</span>
                    <span className="font-mono text-foreground">
                      {cc.trim() || "—"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">BCC</span>
                    <span className="font-mono text-foreground">
                      {bcc.trim() || "—"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Reply-To</span>
                    <span className="font-mono text-foreground">
                      {replyTo.trim() || "(default sender)"}
                    </span>
                  </li>
                </ul>
              </SectionCard>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action bar — one primary action (§13) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">
            {isNew
              ? "Creating a new email template."
              : `Editing template · last modified ${
                  existing?.lastModified
                    ? new Date(existing.lastModified).toLocaleDateString()
                    : "—"
                }.`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isNew ? (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this email template?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove{" "}
                      <span className="font-medium text-foreground">
                        {name || "this template"}
                      </span>{" "}
                      and stop all emails for the{" "}
                      <span className="font-mono">{trigger}</span> trigger. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-rose-600 hover:bg-rose-700"
                      onClick={onDelete}
                    >
                      Delete template
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
            </Button>
            <Button size="sm" variant="outline" onClick={onSaveAndContinue}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
