"use client";

/**
 * Certificate Template Designer page (UX Constitution §12, §25-27).
 *
 * Visual designer for a single certificate template:
 *  - Template Image upload (file input + preview thumbnail)
 *  - Live Preview pane showing the uploaded image as background with
 *    sample field text (Trader Name, Challenge Name, Date) overlaid at
 *    the configured X/Y positions and styled with the chosen font/size/color
 *  - Output Format dropdown (PNG / PDF / SVG)
 *  - "Open Visual Designer" button (toast preview)
 *  - Editable fields table — each row configures a certificate field:
 *    Field Name, Value Template, Text Case, Shorten Over (char limit),
 *    Date Format, Font, Font Size, Font Color, X, Y + Delete action
 *  - "Add Field" button (appends a new row)
 *  - "Save Template" (primary) and "Reset to Default" (outline) actions
 *
 * Pre-fills from an existing certificate template when router.params.id
 * resolves to one; otherwise renders an empty "new template" form. All
 * state is local useState — no mutations to mock data.
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getCertificateTemplates,
  type CertificateTemplate,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Award,
  Save,
  Plus,
  Trash2,
  ChevronLeft,
  Image as ImageIcon,
  Layers,
  Palette,
  RotateCcw,
  PenTool,
  Type,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static option pools                                                  */
/* ------------------------------------------------------------------ */

const OUTPUT_FORMATS = ["PNG", "PDF", "SVG"] as const;

const TEXT_CASES = ["uppercase", "lowercase", "title", "none"] as const;

const DATE_FORMATS = [
  "none",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "Month DD, YYYY",
] as const;

const FONT_FAMILIES = [
  "Montserrat-Bold",
  "Arial",
  "Times New Roman",
  "Roboto",
  "Georgia",
] as const;

const FONT_STACKS: Record<string, string> = {
  "Montserrat-Bold": "'Montserrat', 'Segoe UI', Arial, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  Roboto: "'Roboto', Arial, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
};

/* ------------------------------------------------------------------ */
/* Field model                                                          */
/* ------------------------------------------------------------------ */

interface CertField {
  id: string;
  name: string;
  valueTemplate: string;
  textCase: (typeof TEXT_CASES)[number];
  shortenOver: string;
  dateFormat: (typeof DATE_FORMATS)[number];
  font: (typeof FONT_FAMILIES)[number];
  fontSize: string;
  fontColor: string;
  x: string;
  y: string;
}

function defaultField(id: string, overrides: Partial<CertField> = {}): CertField {
  return {
    id,
    name: overrides.name ?? "Trader Name",
    valueTemplate: overrides.valueTemplate ?? "{{user_name}}",
    textCase: overrides.textCase ?? "none",
    shortenOver: overrides.shortenOver ?? "",
    dateFormat: overrides.dateFormat ?? "none",
    font: overrides.font ?? "Montserrat-Bold",
    fontSize: overrides.fontSize ?? "28",
    fontColor: overrides.fontColor ?? "#4a7c59",
    x: overrides.x ?? "120",
    y: overrides.y ?? "200",
  };
}

const DEFAULT_FIELDS: CertField[] = [
  defaultField("cf-1", { name: "Trader Name", valueTemplate: "{{user_name}}", y: "180" }),
  defaultField("cf-2", { name: "Challenge", valueTemplate: "{{challenge_name}}", y: "240" }),
  defaultField("cf-3", { name: "Date", valueTemplate: "{{issued_date}}", dateFormat: "Month DD, YYYY", y: "320" }),
  defaultField("cf-4", { name: "Account Size", valueTemplate: "{{account_size}}", y: "360" }),
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function applyCase(text: string, c: CertField["textCase"]): string {
  switch (c) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "title":
      return text
        .split(" ")
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
    default:
      return text;
  }
}

function truncate(text: string, max: string): string {
  const n = Number(max);
  if (!Number.isFinite(n) || n <= 0 || text.length <= n) return text;
  return `${text.slice(0, n)}…`;
}

function formatSampleDate(format: CertField["dateFormat"]): string {
  if (format === "none") return "{{issued_date}}";
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  switch (format) {
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "Month DD, YYYY":
      return `${monthName} ${dd}, ${yyyy}`;
    default:
      return "{{issued_date}}";
  }
}

/** Sample values for each known template placeholder. */
const SAMPLE_VALUES: Record<string, string> = {
  user_name: "Sarah Chen",
  challenge_name: "2-Step Evaluation",
  issued_date: new Date().toLocaleDateString(),
  account_size: "$50,000",
};

function resolveTemplate(tpl: string, field: CertField): string {
  let out = tpl.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => SAMPLE_VALUES[key] ?? `{{${key}}}`,
  );
  if (field.dateFormat !== "none" && tpl.includes("{{issued_date}}")) {
    out = formatSampleDate(field.dateFormat);
  }
  out = applyCase(out, field.textCase);
  out = truncate(out, field.shortenOver);
  return out;
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
/* Live preview pane                                                   */
/* ------------------------------------------------------------------ */

function CertificatePreview({
  imageUrl,
  fields,
  name,
}: {
  imageUrl: string;
  fields: CertField[];
  name: string;
}) {
  return (
    <div
      className="relative aspect-[1.414/1] w-full overflow-hidden rounded-md border bg-[#faf6f0] shadow-sm"
      aria-label="Certificate preview"
    >
      {imageUrl ? (
         
        <img
          src={imageUrl}
          alt="Certificate background"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#faf6f0] to-[#f0e8d8] text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-xs">No template image — upload one to preview</p>
          <p className="text-[10px] uppercase tracking-wide">
            {name || "Untitled template"}
          </p>
        </div>
      )}
      {/* Field overlays */}
      {fields.map((f) => {
        const x = Number(f.x) || 0;
        const y = Number(f.y) || 0;
        const size = Number(f.fontSize) || 16;
        // Use percentage-based positioning relative to the container width
        // (assume a 850×600 canvas internally for layout math).
        const leftPct = (x / 850) * 100;
        const topPct = (y / 600) * 100;
        return (
          <div
            key={f.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              fontFamily: FONT_STACKS[f.font] ?? f.font,
              fontSize: `${Math.max(6, size * 0.6)}px`,
              color: f.fontColor,
              textShadow: imageUrl
                ? "0 1px 2px rgba(255,255,255,0.6)"
                : "none",
            }}
            title={`${f.name}: ${f.valueTemplate}`}
          >
            {resolveTemplate(f.valueTemplate, f)}
          </div>
        );
      })}
      {/* Watermark */}
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-foreground/40">
        Live preview · not to scale
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field editor row                                                    */
/* ------------------------------------------------------------------ */

function FieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: CertField;
  onChange: (patch: Partial<CertField>) => void;
  onDelete: () => void;
}) {
  const cellClass = "px-1 py-1 align-top";
  const inputClass = "h-8 text-xs";
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className={cellClass}>
        <Input
          aria-label="Field name"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
          placeholder="Field name"
        />
      </td>
      <td className={cellClass}>
        <Input
          aria-label="Value template"
          value={field.valueTemplate}
          onChange={(e) => onChange({ valueTemplate: e.target.value })}
          className={cn(inputClass, "font-mono")}
          placeholder="{{user_name}}"
        />
      </td>
      <td className={cellClass}>
        <Select
          value={field.textCase}
          onValueChange={(v) =>
            onChange({ textCase: v as CertField["textCase"] })
          }
        >
          <SelectTrigger className={cn(inputClass, "h-8 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_CASES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c === "none" ? "None" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={cellClass}>
        <Input
          aria-label="Shorten over (chars)"
          type="number"
          min={0}
          value={field.shortenOver}
          onChange={(e) => onChange({ shortenOver: e.target.value })}
          className={inputClass}
          placeholder="—"
        />
      </td>
      <td className={cellClass}>
        <Select
          value={field.dateFormat}
          onValueChange={(v) =>
            onChange({ dateFormat: v as CertField["dateFormat"] })
          }
        >
          <SelectTrigger className={cn(inputClass, "h-8 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((d) => (
              <SelectItem key={d} value={d}>
                {d === "none" ? "None" : d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={cellClass}>
        <Select
          value={field.font}
          onValueChange={(v) => onChange({ font: v as CertField["font"] })}
        >
          <SelectTrigger className={cn(inputClass, "h-8 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={cellClass}>
        <Input
          aria-label="Font size px"
          type="number"
          min={1}
          value={field.fontSize}
          onChange={(e) => onChange({ fontSize: e.target.value })}
          className={inputClass}
        />
      </td>
      <td className={cellClass}>
        <div className="flex items-center gap-1">
          <input
            type="color"
            aria-label="Font color"
            value={field.fontColor}
            onChange={(e) => onChange({ fontColor: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border bg-background p-0.5"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {field.fontColor}
          </span>
        </div>
      </td>
      <td className={cellClass}>
        <Input
          aria-label="X position px"
          type="number"
          min={0}
          value={field.x}
          onChange={(e) => onChange({ x: e.target.value })}
          className={inputClass}
        />
      </td>
      <td className={cellClass}>
        <Input
          aria-label="Y position px"
          type="number"
          min={0}
          value={field.y}
          onChange={(e) => onChange({ y: e.target.value })}
          className={inputClass}
        />
      </td>
      <td className="px-1 py-1 align-top">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
          onClick={onDelete}
          aria-label={`Delete ${field.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function CertificateTemplateDesignerPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const existing = useMemo(
    () => (id ? getCertificateTemplates().find((t) => t.id === id) : undefined),
    [id],
  );
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState<
    (typeof OUTPUT_FORMATS)[number]
  >("PNG");
  const [active, setActive] = useState(existing?.active ?? true);
  const [fields, setFields] = useState<CertField[]>(DEFAULT_FIELDS);
  const [nextId, setNextId] = useState(DEFAULT_FIELDS.length + 1);

  const updateField = (fid: string, patch: Partial<CertField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fid ? { ...f, ...patch } : f)),
    );
  };

  const deleteField = (fid: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
    toast({
      title: "Field removed",
      description: "Certificate field deleted from this template.",
    });
  };

  const addField = () => {
    const fid = `cf-${nextId}`;
    setFields((prev) => [
      ...prev,
      defaultField(fid, { name: "New Field", valueTemplate: "{{user_name}}", y: "400" }),
    ]);
    setNextId((n) => n + 1);
    toast({
      title: "Field added",
      description: "A new certificate field was added to the template.",
    });
  };

  const onSave = () => {
    toast({
      title: "Certificate template saved",
      description: `${name || "Untitled template"} was saved with ${fields.length} fields. (demo)`,
    });
  };

  const onReset = () => {
    setFields(DEFAULT_FIELDS);
    setImageUrl("");
    setOutputFormat("PNG");
    toast({
      title: "Reset to default",
      description: "Template fields restored to the default layout.",
    });
  };

  const onOpenDesigner = () => {
    toast({
      title: "Opening visual designer",
      description:
        "Visual designer would open in a new tab — full drag-and-drop layout editor. (demo)",
    });
  };

  const trigger = existing?.triggerEvent ?? "challenge.passed";

  return (
    <Page>
      <PageHeader
        title={isNew ? "New Certificate Template" : "Edit Certificate Template"}
        description={
          isNew
            ? "Design a certificate with a background image and overlaid fields."
            : `Editing “${existing?.name ?? ""}”.`
        }
        icon={Award}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("certificate-management")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Templates
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Form / fields column */}
          <div className="flex flex-col gap-4">
            {/* Template Image + Output Format */}
            <SectionCard
              title="Template Image"
              description="Background image for the certificate. Recommended: 850×600px PNG/JPG."
              icon={ImageIcon}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed bg-muted/30">
                  {imageUrl ? (
                     
                    <img
                      src={imageUrl}
                      alt="Template thumbnail"
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-[10px] uppercase">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageUrl(URL.createObjectURL(file));
                        toast({
                          title: "Image uploaded",
                          description: `${file.name} ready to preview.`,
                        });
                      } else {
                        setImageUrl("");
                      }
                    }}
                    className="max-w-xs text-xs"
                  />
                  {imageUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-fit px-2 text-xs"
                      onClick={() => setImageUrl("")}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Remove image
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-name">Template Name</Label>
                  <Input
                    id="cert-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Challenge Passed Certificate"
                  />
                </div>
                <div className="space-y-1.5">
                  <LabelWithHelp help="File format produced when this certificate is downloaded or emailed to a trader.">
                    Output Format
                  </LabelWithHelp>
                  <Select
                    value={outputFormat}
                    onValueChange={(v) =>
                      setOutputFormat(v as (typeof OUTPUT_FORMATS)[number])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTPUT_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex flex-col">
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
                  checked={active}
                  onCheckedChange={setActive}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={onOpenDesigner}>
                  <PenTool className="mr-1 h-3.5 w-3.5" /> Open Visual Designer
                </Button>
                <StatusBadge tone={active ? "success" : "muted"}>
                  {active ? "active" : "inactive"}
                </StatusBadge>
                <Badge variant="outline" className="gap-1">
                  <Layers className="h-3 w-3" /> {outputFormat}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Trigger: <span className="font-mono">{trigger}</span>
                </span>
              </div>
            </SectionCard>

            {/* Fields table */}
            <SectionCard
              title="Certificate Fields"
              description="Each row is a text element overlaid on the template image. Adjust position, font, and formatting."
              icon={Type}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-1 py-2 font-medium">Field Name</th>
                      <th className="px-1 py-2 font-medium">Value</th>
                      <th className="px-1 py-2 font-medium">Case</th>
                      <th className="px-1 py-2 font-medium">Shorten</th>
                      <th className="px-1 py-2 font-medium">Date Format</th>
                      <th className="px-1 py-2 font-medium">Font</th>
                      <th className="px-1 py-2 font-medium">Size</th>
                      <th className="px-1 py-2 font-medium">Color</th>
                      <th className="px-1 py-2 font-medium">X</th>
                      <th className="px-1 py-2 font-medium">Y</th>
                      <th className="px-1 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <FieldRow
                        key={f.id}
                        field={f}
                        onChange={(patch) => updateField(f.id, patch)}
                        onDelete={() => deleteField(f.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {fields.length} field{fields.length === 1 ? "" : "s"} configured
                </span>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Field
                </Button>
              </div>
            </SectionCard>

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-3">
              <Button size="sm" variant="outline" onClick={onReset}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to Default
              </Button>
              <Button size="sm" onClick={onSave}>
                <Save className="mr-1 h-3.5 w-3.5" /> Save Template
              </Button>
            </div>
          </div>

          {/* Live preview column */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <SectionCard
              title="Live Preview"
              description="Real-time rendering with sample values. Updates as you edit fields."
              icon={Palette}
            >
              <CertificatePreview
                imageUrl={imageUrl}
                fields={fields}
                name={name}
              />
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <span className="block text-[10px] uppercase">Sample Trader</span>
                  <span className="font-mono text-foreground">Sarah Chen</span>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <span className="block text-[10px] uppercase">Sample Challenge</span>
                  <span className="font-mono text-foreground">
                    2-Step Evaluation
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
