"use client";

/**
 * Certificate Font Upload page (UX Constitution §12, §25-27).
 *
 * Font management for certificate rendering:
 *  - KPI row: Total Fonts, Active Fonts
 *  - DataTable: Name, Font File (truncated path), Font Path (reference),
 *    Last Modified, Actions (Download / Delete)
 *  - Upload New Font form: Name, Font File (.ttf/.otf/.woff/.woff2),
 *    Font Path (for referencing system fonts), and live preview rendered
 *    via an injected @font-face style using the uploaded file's data URL
 *  - Empty state when no fonts uploaded
 *
 * Pre-seeded with the mock fonts from the certificate-management page so
 * the table is never empty on first visit; user-uploaded entries are
 * kept in local state only (no mutation to mock data).
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Type,
  Plus,
  Save,
  Trash2,
  Download,
  Upload,
  FileText,
  ChevronLeft,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Font model                                                          */
/* ------------------------------------------------------------------ */

interface CertFont {
  id: string;
  name: string;
  /** Path on disk or URL the certificate renderer loads the font from. */
  fontPath: string;
  /** Object URL or data URL for browser preview (only set for user uploads). */
  dataUrl?: string;
  lastModified: string;
  active: boolean;
}

/** Deterministic seed of pre-installed system fonts (no Math.random). */
const SEED_FONTS: CertFont[] = [
  {
    id: "font-seed-1",
    name: "Montserrat-Bold",
    fontPath: "/fonts/montserrat-bold.ttf",
    lastModified: "2026-01-15T10:30:00.000Z",
    active: true,
  },
  {
    id: "font-seed-2",
    name: "Roboto-Regular",
    fontPath: "/fonts/roboto-regular.ttf",
    lastModified: "2026-01-15T10:32:00.000Z",
    active: true,
  },
  {
    id: "font-seed-3",
    name: "PlayfairDisplay-Bold",
    fontPath: "/fonts/playfair-display-bold.ttf",
    lastModified: "2026-02-02T08:00:00.000Z",
    active: false,
  },
];

function truncatePath(p: string, max = 40): string {
  if (!p) return "—";
  return p.length > max ? `${p.slice(0, max - 1)}…` : p;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/* ------------------------------------------------------------------ */
/* @font-face preview renderer                                        */
/* ------------------------------------------------------------------ */

function FontPreview({
  font,
  text,
}: {
  font: { name: string; dataUrl?: string; fontPath: string };
  text: string;
}) {
  const styleId = useMemo(
    () => `font-preview-${font.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    [font.name],
  );

  // Inject a @font-face rule scoped to this font when a dataUrl is present.
  useEffect(() => {
    if (!font.dataUrl) return;
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `@font-face { font-family: "${font.name}"; src: url("${font.dataUrl}") format("truetype"); }`;
    document.head.appendChild(style);
    return () => {
      const node = document.getElementById(styleId);
      if (node) node.remove();
    };
  }, [font.dataUrl, font.name, styleId]);

  // For seed fonts we have no dataUrl, so just render the preview in a
  // monospace fallback and visually hint that the real file lives at
  // fontPath. The certificate renderer will load it from that path at
  // render time.
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/20 p-4 text-center"
      style={{ fontFamily: font.dataUrl ? `"${font.name}", monospace` : "monospace" }}
    >
      <span className="text-2xl">{text || "The quick brown fox"}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {font.dataUrl ? "Preview via uploaded file" : "Preview unavailable — file at font path"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function CertificateFontUploadPage() {
  const { navigate } = usePlatform();
  const [fonts, setFonts] = useState<CertFont[]>(SEED_FONTS);
  const [name, setName] = useState("");
  const [fontPath, setFontPath] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<CertFont | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalFonts = fonts.length;
  const activeFonts = fonts.filter((f) => f.active).length;

  const resetForm = () => {
    setName("");
    setFontPath("");
    setFile(null);
    setDataUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      setDataUrl("");
      return;
    }
    setFile(f);
    // Build a data URL so the @font-face preview can render the uploaded
    // font without needing a backend upload endpoint.
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setDataUrl(result);
        // Auto-fill name/path when empty to save the user a step.
        if (!name) {
          const stem = f.name.replace(/\.[^.]+$/, "");
          setName(stem);
        }
        if (!fontPath) {
          setFontPath(`/fonts/${f.name}`);
        }
      }
    };
    reader.onerror = () => {
      toast({
        title: "Preview failed",
        description: "Could not read the selected file for preview.",
      });
    };
    reader.readAsDataURL(f);
  };

  const onSave = () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a font name before saving.",
      });
      return;
    }
    const newFont: CertFont = {
      id: `font-${Date.now()}`,
      name: name.trim(),
      fontPath: fontPath.trim() || `/fonts/${name.trim().toLowerCase()}.ttf`,
      dataUrl: dataUrl || undefined,
      lastModified: new Date().toISOString(),
      active: true,
    };
    setFonts((prev) => [newFont, ...prev]);
    toast({
      title: "Font saved",
      description: `${newFont.name} added and is now available in certificate templates.`,
    });
    resetForm();
  };

  const onDownload = (f: CertFont) => {
    toast({
      title: "Download started",
      description: `Downloading ${f.name} from ${truncatePath(f.fontPath, 28)}.`,
    });
  };

  const onToggleActive = (f: CertFont) => {
    setFonts((prev) =>
      prev.map((x) =>
        x.id === f.id ? { ...x, active: !x.active } : x,
      ),
    );
    toast({
      title: f.active ? "Font deactivated" : "Font activated",
      description: `${f.name} is now ${f.active ? "inactive" : "active"}.`,
    });
  };

  const onDelete = (f: CertFont) => {
    setFonts((prev) => prev.filter((x) => x.id !== f.id));
    setDeleteTarget(null);
    toast({
      title: "Font deleted",
      description: `${f.name} was removed.`,
    });
  };

  const columns: Column<CertFont>[] = [
    {
      key: "name",
      header: "Name",
      cell: (f) => (
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/40"
            style={{ fontFamily: f.dataUrl ? `"${f.name}", monospace` : "monospace" }}
          >
            <span className="text-sm">Aa</span>
          </div>
          <span className="font-mono text-sm font-medium text-foreground">
            {f.name}
          </span>
        </div>
      ),
      sortValue: (f) => f.name,
    },
    {
      key: "fontFile",
      header: "Font File",
      cell: (f) => (
        <span
          className="text-xs text-muted-foreground"
          title={f.dataUrl ? "(uploaded file)" : f.fontPath}
        >
          {f.dataUrl ? "(uploaded file)" : truncatePath(f.fontPath.split("/").pop() ?? f.fontPath)}
        </span>
      ),
      sortValue: (f) => f.fontPath,
    },
    {
      key: "fontPath",
      header: "Font Path",
      cell: (f) => (
        <code className="text-[11px] text-muted-foreground" title={f.fontPath}>
          {truncatePath(f.fontPath, 36)}
        </code>
      ),
      sortValue: (f) => f.fontPath,
    },
    {
      key: "lastModified",
      header: "Last Modified",
      cell: (f) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(f.lastModified)}
        </span>
      ),
      sortValue: (f) => f.lastModified,
    },
    {
      key: "active",
      header: "Active",
      cell: (f) => (
        <button
          type="button"
          className="inline-flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive(f);
          }}
          aria-label={`Toggle active for ${f.name}`}
        >
          {f.active ? (
            <Badge variant="outline" className="gap-1 text-emerald-700">
              <Check className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inactive
            </Badge>
          )}
        </button>
      ),
      width: "100px",
    },
    {
      key: "actions",
      header: "",
      cell: (f) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(f);
            }}
            aria-label={`Download ${f.name}`}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(f);
            }}
            aria-label={`Delete ${f.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: "100px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Certificate Fonts"
        description="Upload and manage .ttf / .otf / .woff / .woff2 fonts used to render trader certificates."
        icon={Type}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("certificate-management")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Certificates
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Fonts"
            value={totalFonts}
            icon={Type}
            tone="default"
          />
          <MetricCard
            label="Active Fonts"
            value={activeFonts}
            icon={Check}
            tone="positive"
            deltaLabel="available for certificates"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Upload form */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-start gap-2">
              <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                <Upload className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Upload New Font
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add a font file to the certificate renderer. Browser preview is
                  best-effort using @font-face with the file as a data URL.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="font-name">Name</Label>
                <Input
                  id="font-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Montserrat-Bold"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This is the family name referenced in certificate field
                  configs.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="font-file">Font File</Label>
                <Input
                  ref={fileInputRef}
                  id="font-file"
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={onFileChange}
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: .ttf, .otf, .woff, .woff2.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="font-path">Font Path</Label>
                <Input
                  id="font-path"
                  value={fontPath}
                  onChange={(e) => setFontPath(e.target.value)}
                  placeholder="/fonts/montserrat-bold.ttf"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Server-side path the certificate renderer will load the font
                  from. Auto-filled from the uploaded file name; override for
                  referencing system-installed fonts.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Preview</Label>
                <FontPreview
                  font={{ name: name || "preview", dataUrl, fontPath }}
                  text="The quick brown fox 0123456789"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" onClick={resetForm}>
                  Reset
                </Button>
                <Button size="sm" onClick={onSave}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save Font
                </Button>
              </div>
            </div>
          </section>

          {/* Fonts table */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                Fonts{" "}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fonts.length})
                </span>
              </p>
            </div>
            {fonts.length === 0 ? (
              <EmptyState
                icon={Type}
                title="No fonts uploaded"
                description="Upload .ttf or .otf files to use in certificate templates."
                hint="Use the form on the left to add your first font."
              />
            ) : (
              <DataTable
                columns={columns}
                data={fonts}
                rowKey={(f) => f.id}
                searchableText={(f) => `${f.name} ${f.fontPath}`}
                searchPlaceholder="Search fonts…"
                emptyTitle="No fonts"
                emptyDescription="Upload a font file to start using it in certificates."
                pageSize={8}
              />
            )}
          </div>
        </div>
      </PageContent>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this font?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-mono font-medium text-foreground">
                {deleteTarget?.name ?? ""}
              </span>{" "}
              from the font registry. Certificates referencing this font will
              fall back to the default renderer font. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleteTarget && onDelete(deleteTarget)}
            >
              Delete font
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
