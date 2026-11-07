"use client";

/**
 * Shared Template Library Admin (M7 §11.2) — operator-side curation of the
 * global template set (the M4.5 library's source of truth).
 *
 * Publish, version and deprecate shared templates, manage their variable
 * dictionaries (validated against tenant terminology keys such as
 * {{firm_name}} and {{currency}}), promote tenant-authored templates into
 * the shared set with author credit, and see which tenants adopt what.
 */

import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutTemplate,
  Plus,
  FileUp,
  FileText,
  Pencil,
  UploadCloud,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ScrollText,
  Globe,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + seed data                                                   */
/* ------------------------------------------------------------------ */

type TemplateStatus = "Published" | "Draft" | "Deprecated";
type Category = "Lifecycle" | "Campaign" | "Transactional" | "Digest";

interface TemplateVariable {
  variable: string;
  description: string;
  example: string;
}

interface Adoption {
  tenant: string;
  since: string;
}

interface SharedTemplate {
  id: string;
  name: string;
  category: Category;
  locales: string[];
  status: TemplateStatus;
  adopters: Adoption[];
  updated: string;
  version: number;
  /** locale → template body */
  content: Record<string, string>;
  variables: TemplateVariable[];
  changelog: { version: number; note: string; at: string }[];
  /** Recommended successor shown in the deprecation migration hint. */
  successor?: string;
  importedFrom?: { tenant: string; author: string };
}

const localeFlags: Record<string, string> = {
  en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", pt: "🇧🇷", ja: "🇯🇵",
};

const categories: Category[] = ["Lifecycle", "Campaign", "Transactional", "Digest"];

const seedTemplates: SharedTemplate[] = [
  {
    id: "tpl-welcome",
    name: "Lifecycle Welcome Series",
    category: "Lifecycle",
    locales: ["en", "de", "fr"],
    status: "Published",
    adopters: [
      { tenant: "Alpha Capital", since: "2026-06-12" },
      { tenant: "Beta Trading", since: "2026-06-20" },
      { tenant: "Gamma Futures", since: "2026-07-02" },
      { tenant: "Epsilon Markets", since: "2026-08-18" },
      { tenant: "Delta Prop", since: "2026-09-05" },
      { tenant: "Zeta Trading", since: "2026-10-30" },
    ],
    updated: "2026-11-02",
    version: 3,
    content: {
      en: "Welcome to {{firm_name}}, {{trader_name}}. Your account is ready — balances are shown in {{currency}}. Start here: {{challenge_link}}",
      de: "Willkommen bei {{firm_name}}, {{trader_name}}. Dein Konto ist bereit — Kontostände in {{currency}}. Los geht es hier: {{challenge_link}}",
      fr: "Bienvenue chez {{firm_name}}, {{trader_name}}. Votre compte est prêt — soldes en {{currency}}. Commencez ici : {{challenge_link}}",
    },
    variables: [
      { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: "Alpha Capital" },
      { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
      { variable: "{{trader_name}}", description: "Recipient's display name", example: "Jordan Reyes" },
      { variable: "{{challenge_link}}", description: "Deep link to the trader's next challenge", example: "https://alpha.one/c/step-1" },
    ],
    changelog: [
      { version: 3, note: "Added {{challenge_link}} CTA; clarified currency wording.", at: "2026-11-02" },
      { version: 2, note: "German + French locales.", at: "2026-07-19" },
      { version: 1, note: "Initial shared version.", at: "2026-06-12" },
    ],
  },
  {
    id: "tpl-payout",
    name: "Transactional: Payout Receipt",
    category: "Transactional",
    locales: ["en", "es", "pt"],
    status: "Published",
    adopters: [
      { tenant: "Alpha Capital", since: "2026-05-30" },
      { tenant: "Beta Trading", since: "2026-06-01" },
      { tenant: "Gamma Futures", since: "2026-06-14" },
      { tenant: "Delta Prop", since: "2026-07-22" },
      { tenant: "Epsilon Markets", since: "2026-08-19" },
      { tenant: "Zeta Trading", since: "2026-11-05" },
    ],
    updated: "2026-10-21",
    version: 5,
    content: {
      en: "Hi {{trader_name}}, your payout of {{payout_amount}} {{currency}} from {{firm_name}} was processed on {{payout_date}}.",
      es: "Hola {{trader_name}}, tu pago de {{payout_amount}} {{currency}} de {{firm_name}} se procesó el {{payout_date}}.",
      pt: "Olá {{trader_name}}, seu saque de {{payout_amount}} {{currency}} da {{firm_name}} foi processado em {{payout_date}}.",
    },
    variables: [
      { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: "Alpha Capital" },
      { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
      { variable: "{{trader_name}}", description: "Recipient's display name", example: "Jordan Reyes" },
      { variable: "{{payout_amount}}", description: "Formatted payout amount", example: "1,250.00" },
      { variable: "{{payout_date}}", description: "Localized processing date", example: "7 Nov 2026" },
    ],
    changelog: [
      { version: 5, note: "Portuguese locale; amount now formatted with locale separators.", at: "2026-10-21" },
      { version: 4, note: "Added processing date.", at: "2026-08-04" },
    ],
  },
  {
    id: "tpl-bf",
    name: "Campaign: Black Friday Teaser",
    category: "Campaign",
    locales: ["en", "es"],
    status: "Draft",
    adopters: [],
    updated: "2026-11-06",
    version: 1,
    content: {
      en: "{{firm_name}} Black Friday: {{promo_code}} unlocks 40% off any challenge — priced in {{currency}}. Ends 30 Nov.",
      es: "Black Friday en {{firm_name}}: {{promo_code}} aplica 40% de descuento en cualquier reto — precios en {{currency}}. Termina el 30 nov.",
    },
    variables: [
      { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: "Alpha Capital" },
      { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
      { variable: "{{promo_code}}", description: "Per-tenant discount code", example: "BF40" },
    ],
    changelog: [],
  },
  {
    id: "tpl-legacy",
    name: "Legacy Monthly Newsletter",
    category: "Digest",
    locales: ["en"],
    status: "Deprecated",
    adopters: [
      { tenant: "Delta Prop", since: "2026-03-08" },
      { tenant: "Gamma Futures", since: "2026-04-17" },
    ],
    updated: "2026-09-14",
    version: 7,
    content: {
      en: "Your {{firm_name}} monthly digest — balances in {{currency}}.",
    },
    variables: [
      { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: "Alpha Capital" },
      { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
    ],
    changelog: [{ version: 7, note: "Deprecated in favour of the weekly digest template.", at: "2026-09-14" }],
    successor: "Lifecycle Welcome Series",
  },
];

interface EligibleTenantTemplate {
  id: string;
  name: string;
  tenant: string;
  author: string;
  category: Category;
  locales: string[];
  snippet: string;
}

const eligibleTenantTemplates: EligibleTenantTemplate[] = [
  { id: "imp-1", name: "Prop Onboarding Drip", tenant: "Alpha Capital", author: "R. Okafor", category: "Lifecycle", locales: ["en", "de"], snippet: "Day 1–5 onboarding for new funded traders, {{firm_name}} branded." },
  { id: "imp-2", name: "KYC Reminder (3-step)", tenant: "Beta Trading", author: "S. Marchetti", category: "Lifecycle", locales: ["en"], snippet: "Document reminder ladder with compliance copy and {{currency}} payout hints." },
  { id: "imp-3", name: "Win-back Flash Sale", tenant: "Gamma Futures", author: "J. Park", category: "Campaign", locales: ["en", "es"], snippet: "48h re-engagement offer for lapsed traders with {{promo_code}}." },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const statusTone: Record<TemplateStatus, "success" | "warning" | "muted"> = {
  Published: "success",
  Draft: "warning",
  Deprecated: "muted",
};

/** Every `{{token}}` referenced by the template body across all locales. */
function usedVariables(content: Record<string, string>): string[] {
  const found = new Set<string>();
  Object.values(content).forEach((body) => {
    const matches = body.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [];
    matches.forEach((m) => found.add(m.replace(/\s+/g, "")));
  });
  return [...found];
}

/** Variables referenced by the body that are missing from the dictionary. */
function offendingVariables(t: SharedTemplate): string[] {
  const known = new Set(t.variables.map((v) => v.variable));
  return usedVariables(t.content).filter((v) => !known.has(v));
}

function PreviewBody({ body, variables }: { body: string; variables: TemplateVariable[] }) {
  const known = new Map(variables.map((v) => [v.variable, v.example]));
  const parts = body.split(/(\{\{\s*[\w.]+\s*\}\})/g);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((part, i) => {
        const normalized = part.replace(/\s+/g, "");
        if (/^\{\{[\w.]+\}\}$/.test(normalized)) {
          const example = known.get(normalized);
          return example !== undefined ? (
            <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">{example}</span>
          ) : (
            <span key={i} className="rounded bg-rose-100 px-1 font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">{normalized}</span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function Thumbnail({ name, status }: { name: string; status: TemplateStatus }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
        status === "Published" && "bg-emerald-50 dark:bg-emerald-950/30",
        status === "Draft" && "bg-muted",
        status === "Deprecated" && "bg-muted/50 opacity-70",
      )}
      aria-hidden="true"
    >
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="sr-only">Thumbnail placeholder for {name}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor drawer                                                       */
/* ------------------------------------------------------------------ */

function EditorDrawer({
  template,
  onClose,
  onPublish,
  onSaved,
}: {
  template: SharedTemplate;
  onClose: () => void;
  onPublish: () => void;
  onSaved: (content: Record<string, string>) => void;
}) {
  const [locale, setLocale] = useState(template.locales[0]);
  const [draft, setDraft] = useState<Record<string, string>>(template.content);
  const unknown = useMemo(() => {
    const known = new Set(template.variables.map((v) => v.variable));
    return usedVariables(draft).filter((v) => !known.has(v));
  }, [draft, template.variables]);

  const setLocaleBody = (loc: string, body: string) => setDraft((prev) => ({ ...prev, [loc]: body }));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle className="flex items-center gap-2">
            {template.name}
            <StatusBadge tone={statusTone[template.status]}>{template.status}</StatusBadge>
            <Badge variant="outline" className="text-[10px]">v{template.version}</Badge>
          </SheetTitle>
          <SheetDescription>
            Content editor per locale, variable dictionary and sample-data preview. Terminology keys
            {" "}{"{{firm_name}}"} and {"{{currency}}"} must stay in the dictionary.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4 pt-0">
          {/* Locale tabs */}
          <Tabs value={locale} onValueChange={setLocale}>
            <TabsList>
              {template.locales.map((loc) => (
                <TabsTrigger key={loc} value={loc}>
                  {localeFlags[loc] ?? "🌐"} {loc.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            {template.locales.map((loc) => (
              <TabsContent key={loc} value={loc} className="mt-3">
                <Label className="text-xs" htmlFor={`body-${loc}`}>Body ({loc})</Label>
                <Textarea
                  id={`body-${loc}`}
                  value={draft[loc] ?? ""}
                  onChange={(e) => setLocaleBody(loc, e.target.value)}
                  rows={5}
                  className="mt-1 text-sm"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{(draft[loc] ?? "").length} characters</p>
              </TabsContent>
            ))}
          </Tabs>

          {/* Variable dictionary */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ScrollText className="h-3.5 w-3.5" /> Variable dictionary
              </h3>
              <Badge variant="outline" className="text-[10px]">{template.variables.length} keys</Badge>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Variable</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {template.variables.map((v) => (
                    <tr key={v.variable}>
                      <td className="px-3 py-2"><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{v.variable}</code></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{v.description}</td>
                      <td className="px-3 py-2 text-xs">{v.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unknown.length > 0 ? (
              <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-50/40 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
                <span className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Not in dictionary (publish will be blocked):</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {unknown.map((u) => <code key={u} className="rounded bg-background px-1.5 py-0.5">{u}</code>)}
                </span>
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> All referenced variables validate against the dictionary.
              </p>
            )}
          </section>

          {/* Preview with sample tenant data */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Eye className="h-3.5 w-3.5" /> Preview · sample tenant data
            </h3>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Alpha Capital · {locale.toUpperCase()} · {localeFlags[locale]}
              </p>
              <PreviewBody body={draft[locale] ?? ""} variables={template.variables} />
            </div>
          </section>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { onSaved(draft); }}>
              Save draft
            </Button>
            {template.status !== "Deprecated" ? (
              <Button size="sm" onClick={() => { onSaved(draft); onPublish(); }}>
                <UploadCloud className="mr-1 h-4 w-4" /> Publish…
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Publish dialog — changelog + impact preview + inline validation     */
/* ------------------------------------------------------------------ */

function PublishDialog({
  template,
  onClose,
  onConfirm,
}: {
  template: SharedTemplate;
  onClose: () => void;
  onConfirm: (changelogNote: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const offending = offendingVariables(template);
  const noteOk = note.trim().length >= 10;
  const varsOk = offending.length === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4" /> Publish {template.name} — v{template.version + 1}
          </DialogTitle>
          <DialogDescription>
            Publishing creates a new version and queues update banners on every adopter tenant's
            library view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs" htmlFor="changelog-note">Changelog note (required)</Label>
            <Textarea
              id="changelog-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Clarify currency wording; add {{challenge_link}} CTA."
              className="mt-1 text-sm"
            />
            {showErrors && !noteOk ? (
              <p className="mt-1 text-xs text-destructive">A changelog note is required (at least 10 characters).</p>
            ) : null}
          </div>

          {!varsOk ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-50/40 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
              <span className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> Publish blocked — offending variables are missing from the dictionary:
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {offending.map((v) => <li key={v}><code>{v}</code></li>)}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold">Tenant impact preview</p>
            {template.adopters.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No tenants adopted this template yet — publishing updates the shared set only.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {template.adopters.length} adopter tenant(s) will see an update banner when they open the library:
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.adopters.map((a) => (
                    <Badge key={a.tenant} variant="outline" className="text-[9px]">{a.tenant}</Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setShowErrors(true);
              if (noteOk && varsOk) onConfirm(note.trim());
            }}
          >
            <UploadCloud className="mr-1 h-4 w-4" /> Publish v{template.version + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TemplateLibraryAdminPage() {
  const { data: loaded, loading, error, retry } = useAsyncMock(
    () => mockAsync(() => seedTemplates, { delayMs: 400 }),
    [],
  );

  const [templates, setTemplates] = useState<SharedTemplate[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [deprecateId, setDeprecateId] = useState<string | null>(null);
  const [adoptionId, setAdoptionId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importedIds, setImportedIds] = useState<string[]>([]);

  useEffect(() => {
    if (loaded) setTemplates(loaded);
  }, [loaded]);

  const rows = useMemo(
    () => (statusFilter === "all" ? templates : templates.filter((t) => t.status === statusFilter)),
    [templates, statusFilter],
  );

  const byId = (id: string | null) => templates.find((t) => t.id === id) ?? null;

  const patch = (id: string, changes: Partial<SharedTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const editing = byId(editingId);
  const publishing = byId(publishId);
  const deprecating = byId(deprecateId);
  const adopting = byId(adoptionId);

  const openEditor = (t: SharedTemplate) => setEditingId(t.id);

  const saveDraft = (content: Record<string, string>) => {
    if (!editing) return;
    patch(editing.id, { content, updated: new Date().toISOString().slice(0, 10) });
    toast({ title: "Draft saved", description: `${editing.name} — content stored as a draft revision.` });
  };

  const confirmPublish = (note: string) => {
    if (!publishing) return;
    const newVersion = publishing.version + 1;
    const today = new Date().toISOString().slice(0, 10);
    patch(publishing.id, {
      status: "Published",
      version: newVersion,
      updated: today,
      changelog: [{ version: newVersion, note, at: today }, ...publishing.changelog],
    });
    setPublishId(null);
    toast({
      title: `Published v${newVersion}`,
      description: `${publishing.name} — update banners queued for ${publishing.adopters.length} adopter tenant(s); adoption counts refresh as tenants pull the new version.`,
    });
  };

  const confirmDeprecate = () => {
    if (!deprecating) return;
    patch(deprecating.id, { status: "Deprecated", updated: new Date().toISOString().slice(0, 10) });
    const successor = deprecating.successor ?? "the Lifecycle Welcome Series";
    setDeprecateId(null);
    toast({
      title: "Template deprecated",
      description: `${deprecating.name}: new instantiation is blocked everywhere; running flows keep using it. Migrate tenants to ${successor}.`,
    });
  };

  const importTemplate = (el: EligibleTenantTemplate) => {
    const id = `tpl-${el.id}`;
    setTemplates((prev) => [
      {
        id,
        name: el.name,
        category: el.category,
        locales: el.locales,
        status: "Draft",
        adopters: [],
        updated: new Date().toISOString().slice(0, 10),
        version: 1,
        content: Object.fromEntries(el.locales.map((l) => [l, el.snippet])),
        variables: [
          { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: el.tenant },
          { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
        ],
        changelog: [],
        importedFrom: { tenant: el.tenant, author: el.author },
      },
      ...prev,
    ]);
    setImportedIds((prev) => [...prev, el.id]);
    toast({
      title: "Imported from tenant",
      description: `${el.name} promoted to the shared set as a Draft — original author credit: ${el.author} (${el.tenant}).`,
    });
  };

  const createTemplate = (name: string, category: Category) => {
    const id = `tpl-new-${Date.now()}`;
    setTemplates((prev) => [
      {
        id,
        name,
        category,
        locales: ["en"],
        status: "Draft",
        adopters: [],
        updated: new Date().toISOString().slice(0, 10),
        version: 0,
        content: { en: "Write the first shared body for {{firm_name}} — prices in {{currency}}." },
        variables: [
          { variable: "{{firm_name}}", description: "Tenant trading firm name (terminology key)", example: "Alpha Capital" },
          { variable: "{{currency}}", description: "Display currency ISO code (terminology key)", example: "USD" },
        ],
        changelog: [],
      },
      ...prev,
    ]);
    setNewOpen(false);
    setEditingId(id);
    toast({ title: "Draft created", description: `${name} added to the shared library as a draft.` });
  };

  const columns: Column<SharedTemplate>[] = [
    {
      key: "name",
      header: "Template",
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <Thumbnail name={t.name} status={t.status} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{t.name}</span>
              <Badge variant="outline" className="text-[9px]">v{t.version}</Badge>
            </div>
            {t.importedFrom ? (
              <p className="text-[10px] text-muted-foreground">
                Imported from {t.importedFrom.tenant} · credit {t.importedFrom.author}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">{t.changelog[0]?.note ?? "No changelog yet"}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (t) => t.category,
      cell: (t) => <Badge variant="outline" className="text-[10px]">{t.category}</Badge>,
    },
    {
      key: "locales",
      header: "Locales",
      sortValue: (t) => t.locales.length,
      cell: (t) => (
        <span className="flex items-center gap-1 text-xs" title={t.locales.join(", ")}>
          <span aria-hidden="true">{t.locales.map((l) => localeFlags[l] ?? "🌐").join(" ")}</span>
          <span className="text-muted-foreground">{t.locales.length}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => t.status,
      cell: (t) => <StatusBadge tone={statusTone[t.status]}>{t.status}</StatusBadge>,
    },
    {
      key: "adopters",
      header: "Tenants adopted",
      sortValue: (t) => t.adopters.length,
      cell: (t) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold" aria-label={`${t.adopters.length} tenants adopted — show list`}>
              {t.adopters.length}
              <Globe className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Adopting tenants ({t.adopters.length})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {t.adopters.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No tenant has adopted this template yet.</p>
            ) : (
              t.adopters.map((a) => (
                <DropdownMenuItem key={a.tenant} onSelect={(e) => e.preventDefault()}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="flex-1">{a.tenant}</span>
                  <span className="text-[10px] text-muted-foreground">{a.since}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortValue: (t) => t.updated,
      cell: (t) => <span className="text-xs text-muted-foreground">{t.updated}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" aria-label={`Edit ${t.name}`} onClick={() => openEditor(t)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
          {t.status !== "Deprecated" ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" aria-label={`Publish ${t.name}`} onClick={() => setPublishId(t.id)}>
              <UploadCloud className="h-3 w-3" /> Publish
            </Button>
          ) : null}
          {t.status !== "Deprecated" ? (
            <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" aria-label={`Deprecate ${t.name}`} onClick={() => setDeprecateId(t.id)}>
              <Ban className="h-3 w-3" /> Deprecate
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" aria-label={`View adoption for ${t.name}`} onClick={() => setAdoptionId(t.id)}>
            <Eye className="h-3 w-3" /> Adoption
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Shared Templates"
        description="Curate the global template set: version, publish, deprecate and track tenant adoption across the platform."
        icon={LayoutTemplate}
        actions={
          <>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Template
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="mr-1 h-4 w-4" /> Import from tenant
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loaded !== undefined}
          loadingLabel="Loading shared templates…"
        >
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {(["Published", "Draft", "Deprecated"] as TemplateStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter((cur) => (cur === s ? "all" : s))}
                className={cn(
                  "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === s && "ring-2 ring-primary/60",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s}</span>
                <span className="mt-1 block text-2xl font-bold tabular-nums">{templates.filter((t) => t.status === s).length}</span>
              </button>
            ))}
          </div>

          {templates.length === 0 ? (
            <EmptyState
              icon={LayoutTemplate}
              title="No shared templates"
              description="The shared library is the source of truth every tenant builds campaigns from. Seed it with the M4.5 preset set (welcome series, payout receipt, campaign starter) to get going."
              action={
                <Button size="sm" onClick={() => { setTemplates(seedTemplates); toast({ title: "Preset library seeded", description: `${seedTemplates.length} M4.5 preset templates installed as shared templates.` }); }}>
                  <Sparkles className="mr-1 h-4 w-4" /> Seed preset library
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">Templates</h2>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={rows}
                  rowKey={(t) => t.id}
                  loading={loading}
                  searchableText={(t) => `${t.name} ${t.category} ${t.status} ${t.locales.join(" ")}`}
                  searchPlaceholder="Search templates…"
                  pageSize={8}
                  emptyTitle="No shared templates"
                  emptyDescription="No template matches this filter. Clear the filter or seed the library."
                />
              </CardContent>
            </Card>
          )}
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Editor drawer ─────────────────────────────────────── */}
      {editing ? (
        <EditorDrawer
          key={`editor-${editing.id}-${editing.version}`}
          template={editing}
          onClose={() => setEditingId(null)}
          onPublish={() => setPublishId(editing.id)}
          onSaved={saveDraft}
        />
      ) : null}

      {/* ── Publish dialog ────────────────────────────────────── */}
      {publishing ? (
        <PublishDialog
          key={`publish-${publishing.id}-${publishing.version}`}
          template={publishing}
          onClose={() => setPublishId(null)}
          onConfirm={confirmPublish}
        />
      ) : null}

      {/* ── Deprecate flow ────────────────────────────────────── */}
      {deprecating ? (
        <AlertDialog open onOpenChange={(o) => !o && setDeprecateId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" /> Deprecate {deprecating.name}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    New instantiation is blocked everywhere — tenants selecting this template are
                    stopped with the successor suggestion. Running flows keep using their existing
                    copy untouched.
                  </p>
                  <p className="rounded-md border border-amber-500/30 bg-amber-50/40 px-3 py-2 text-xs text-foreground dark:bg-amber-950/20">
                    Migration hint: recommend <span className="font-semibold">{deprecating.successor ?? "Lifecycle Welcome Series"}</span> to
                    the {deprecating.adopters.length} adopting tenant(s).
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeprecateId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeprecate}>
                <Ban className="mr-1 h-4 w-4" /> Deprecate template
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* ── View adoption ─────────────────────────────────────── */}
      {adopting ? (
        <Dialog open onOpenChange={(o) => !o && setAdoptionId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adoption — {adopting.name}</DialogTitle>
              <DialogDescription>
                {adopting.adopters.length} tenant(s) instantiate this template in their live flows.
              </DialogDescription>
            </DialogHeader>
            {adopting.adopters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenants have adopted this template yet.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {adopting.adopters.map((a) => (
                  <div key={a.tenant} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-medium">{a.tenant}</span>
                    <span className="text-xs text-muted-foreground">since {a.since}</span>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setAdoptionId(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* ── Import from tenant ────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileUp className="h-4 w-4" /> Import from tenant</DialogTitle>
            <DialogDescription>
              Promote an eligible tenant template into the shared set. Original-author credit is
              retained on the shared record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {eligibleTenantTemplates.map((el) => {
              const done = importedIds.includes(el.id);
              return (
                <div key={el.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{el.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {el.tenant} · author {el.author} · {el.category} · {el.locales.join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{el.snippet}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={done} onClick={() => importTemplate(el)}>
                      {done ? "Imported" : "Import"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setImportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New template ──────────────────────────────────────── */}
      <NewTemplateDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createTemplate} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* New template dialog                                                 */
/* ------------------------------------------------------------------ */

function NewTemplateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, category: Category) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Lifecycle");
  const [showError, setShowError] = useState(false);
  const ok = name.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setName(""); setShowError(false); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> New shared template</DialogTitle>
          <DialogDescription>Creates a draft in the shared library and opens the editor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs" htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Challenge Result Notice" className="mt-1" />
            {showError && !ok ? <p className="mt-1 text-xs text-destructive">Give the template a name (at least 3 characters).</p> : null}
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setShowError(true); if (ok) onCreate(name.trim(), category); }}>Create draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
