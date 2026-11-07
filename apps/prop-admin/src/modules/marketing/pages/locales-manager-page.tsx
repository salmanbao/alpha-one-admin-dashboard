"use client";
/**
 * R3-03 — Campaign Localization Manager.
 *
 * Locale matrix (rows = translatable assets, columns = locales with status/
 * translator/updated cells), the variant editor (side-by-side source and
 * translation with {{n}} variable-slot protection, per-channel char-count
 * guidance, RTL preview toggle, fallback chain editor) and the export/import
 * panel (XLIFF round-trip with re-import validation).
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Languages, FileDown, FileUp, CheckCircle2, AlertTriangle, Languages as LanguagesIcon } from "lucide-react";
import {
  listLocales,
  getLocale,
  listAssets,
  getAsset,
  getTranslation,
  cellStatus,
  saveVariant,
  approveVariant,
  setFallback,
  validateVariant,
  charGuidance,
  resolveLocaleForRecipient,
  localeBreakdown,
  localeCoverage,
  exportXliff,
  importXliff,
  refreshAssets,
  useLocalesVersion,
  type LocaleAsset,
  type LocaleCode,
  type TranslationStatus,
} from "../locales-store";

const STATUS_TONE: Record<TranslationStatus, "default" | "success" | "warning" | "info" | "muted"> = {
  missing: "muted",
  "machine-draft": "warning",
  "human-reviewed": "info",
  approved: "success",
};

const KIND_LABEL: Record<LocaleAsset["kind"], string> = {
  template: "Template",
  "landing-page": "Landing page",
  "onsite-unit": "Onsite unit",
  "flow-message": "Flow message",
};

export function LocalesManagerPage() {
  const { user } = usePlatform();
  // Read via marketing.read (route permission); mutations need the new
  // marketing.locales.manage (Table 15).
  const canManage = hasPermission(user, "marketing.locales.manage");
  const manageTitle = canManage ? undefined : "Requires marketing.locales.manage";
  useLocalesVersion();

  const [editorAsset, setEditorAsset] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");

  const locales = listLocales();
  const nonSource = locales.filter((l) => l.code !== "en");
  const assets = useMemo(() => {
    refreshAssets(); // re-snapshot from live stores (templates/pages/onsite)
    return listAssets();
  }, []);
  const rows = kindFilter === "all" ? assets : assets.filter((a) => a.kind === kindFilter);

  const cov = localeCoverage("de"); // representative for the strip below
  const totalCells = assets.length * nonSource.length;
  const approvedCells = assets.reduce(
    (n, a) => n + nonSource.filter((l) => cellStatus(a.id, l.code) === "approved").length,
    0,
  );
  const missingCells = assets.reduce(
    (n, a) => n + nonSource.filter((l) => cellStatus(a.id, l.code) === "missing").length,
    0,
  );
  const draftCells = totalCells - approvedCells - missingCells;
  void cov;

  const columns: Column<LocaleAsset>[] = [
    {
      key: "asset",
      header: "Asset",
      cell: (a) => (
        <div className="min-w-0">
          <span className="truncate text-sm font-medium">{a.name}</span>
          <span className="block text-[10px] text-muted-foreground">
            {a.id} · {a.channel}
          </span>
        </div>
      ),
    },
    { key: "kind", header: "Kind", cell: (a) => <Badge variant="outline" className="text-[10px]">{KIND_LABEL[a.kind]}</Badge> },
    {
      key: "source",
      header: "Source (en)",
      cell: (a) => <span className="line-clamp-2 max-w-md text-[11px] text-muted-foreground">{a.source}</span>,
    },
    ...nonSource.map<Column<LocaleAsset>>((l) => ({
      key: l.code,
      header: `${l.native}${l.rtl ? " ↕" : ""}`,
      cell: (a) => {
        const status = cellStatus(a.id, l.code);
        const t = getTranslation(a.id, l.code);
        return (
          <button
            type="button"
            className="flex flex-col items-start gap-0.5 text-left"
            onClick={(e) => {
              e.stopPropagation();
              setEditorAsset(a.id);
            }}
            title={t?.translator ? `${t.translator} · ${new Date(t.updatedAt).toLocaleDateString()}` : status}
          >
            <StatusBadge tone={STATUS_TONE[status]}>{status === "missing" ? "—" : status}</StatusBadge>
            {t?.translator && (
              <span className="max-w-[110px] truncate text-[9px] text-muted-foreground">
                {t.translator} · {new Date(t.updatedAt).toLocaleDateString()}
              </span>
            )}
          </button>
        );
      },
    })),
  ];

  const selectedAsset = editorAsset ? getAsset(editorAsset) : undefined;

  return (
    <Page>
      <PageHeader
        title="Campaign Localization"
        description="Locale matrix, variant editor with variable-slot protection and RTL preview, fallback chains, XLIFF/CSV round-trip."
        icon={Languages}
        actions={
          <Button
            size="sm"
            disabled={!canManage}
            title={manageTitle}
            onClick={() => {
              const ids = assets.slice(0, 3).map((a) => a.id);
              const xml = exportXliff(ids, ["de", "ar", "es"]);
              downloadText(xml, "alphaone-translations.xliff", "application/xliff+xml");
              toast({ title: "XLIFF exported", description: `${ids.length} asset(s) × 3 locales handed to the agency.` });
            }}
          >
            <FileDown className="h-4 w-4" /> Export XLIFF
          </Button>
        }
      />
      <PageContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Locales" value={locales.length} icon={LanguagesIcon} />
            <MetricCard label="Approved cells" value={`${approvedCells}/${totalCells}`} icon={CheckCircle2} tone={approvedCells === totalCells ? "positive" : "info"} />
            <MetricCard label="In workflow" value={draftCells} icon={Languages} tone={draftCells > 0 ? "warning" : "positive"} />
            <MetricCard label="Missing" value={missingCells} icon={AlertTriangle} tone={missingCells > 0 ? "negative" : "positive"} />
          </div>

          {/* Per-locale coverage strip */}
          <div className="flex flex-wrap gap-2">
            {locales.map((l) => {
              const c = localeCoverage(l.code);
              return (
                <Badge key={l.code} variant="outline" className="text-[11px]">
                  {l.native} {l.rtl && "↕"} · {l.code === "en" ? "source" : `${c.pct}% approved · ${c.missing} missing`}
                </Badge>
              );
            })}
          </div>

          <DataTable
            columns={columns}
            data={rows}
            rowKey={(a) => a.id}
            onRowClick={(a) => setEditorAsset(a.id)}
            searchableText={(a) => `${a.name} ${a.kind} ${a.source}`}
            searchPlaceholder="Search translatable assets…"
            pageSize={12}
            toolbar={
              <div className="flex items-center gap-2">
                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All kinds</SelectItem>
                    {(Object.keys(KIND_LABEL) as LocaleAsset["kind"][]).map((k) => (
                      <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {rows.length} asset(s) × {nonSource.length} locales
                </span>
              </div>
            }
            emptyTitle="No translatable assets"
            emptyDescription="Templates, landing pages and onsite units appear here once they exist."
          />

          {/* Export / import panel */}
          <ImportPanel canManage={canManage} manageTitle={manageTitle} />

          {/* Campaign report locale breakdown (AC-3) */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-semibold">Campaign report — locale breakdown (AC-3)</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
              {localeBreakdown().map((r) => (
                <div key={r.locale} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{getLocale(r.locale)?.native ?? r.locale}</p>
                  <p className="font-mono">{r.sent.toLocaleString()} sent</p>
                  <p className="text-muted-foreground">{r.direct.toLocaleString()} direct</p>
                  <p className={r.fallback ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                    {r.fallback.toLocaleString()} fell back
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Fallback sends resolve through the fallback chain (e.g. ar → en) when a cell is missing at send
              time — counted here instead of dropping the recipient.
            </p>
          </div>
        </div>
      </PageContent>

      {/* Variant editor */}
      <Sheet open={!!selectedAsset} onOpenChange={(o) => !o && setEditorAsset(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          {selectedAsset && editorAsset && (
            <VariantEditor
              asset={editorAsset}
              canManage={canManage}
              manageTitle={manageTitle}
              actor={user?.name ?? "operator"}
            />
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Variant editor — side-by-side, slots locked, RTL preview            */
/* ------------------------------------------------------------------ */

function VariantEditor({
  asset,
  canManage,
  manageTitle,
  actor,
}: {
  asset: string;
  canManage: boolean;
  manageTitle: string | undefined;
  actor: string;
}) {
  const a = getAsset(asset)!;
  const locales = listLocales().filter((l) => l.code !== "en");
  const [locale, setLocale] = useState<LocaleCode>("ar");
  const loc = getLocale(locale)!;
  const existing = getTranslation(asset, locale);
  const [text, setText] = useState(existing?.text ?? "");
  const [rtlPreview, setRtlPreview] = useState(loc.rtl);
  const [tick, setTick] = useState(0);
  const [fallbackTarget, setFallbackTarget] = useState<LocaleCode>(loc.fallback);

  // Re-sync the editor when a different locale/asset is picked.
  const [openKey, setOpenKey] = useState(`${asset}:${locale}`);
  const key = `${asset}:${locale}`;
  if (openKey !== key) {
    setOpenKey(key);
    setText(getTranslation(asset, locale)?.text ?? "");
    setRtlPreview(getLocale(locale)?.rtl ?? false);
    setFallbackTarget(getLocale(locale)?.fallback ?? "en");
  }

  const v = validateVariant(a, loc, text);
  const sourceSlots = a.source.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [];
  const resolution = resolveLocaleForRecipient(asset, locale);

  const save = (mode: "machine-draft" | "human-reviewed") => {
    const r = saveVariant(asset, locale, text, actor, mode);
    if (!r.ok) {
      toast({ title: "Save blocked — variable slots", description: r.problems.join(" · "), variant: "destructive" });
      return;
    }
    toast({
      title: "Variant saved",
      description: `${a.name} [${locale}] → ${mode}${r.problems.length ? ` · ${r.problems[0]}` : ""}`,
    });
    setTick((n) => n + 1);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          <Languages className="h-4 w-4" /> Variant editor
        </SheetTitle>
        <SheetDescription>
          {a.name} · {KIND_LABEL[a.kind]} · side-by-side with {"{{n}}"} slots locked
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        {/* Locale picker + RTL preview toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={locale} onValueChange={(val) => setLocale(val as LocaleCode)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.native} ({l.code}){l.rtl ? " ↕" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant={rtlPreview ? "default" : "outline"} className="h-8 text-xs" onClick={() => setRtlPreview((r) => !r)}>
            RTL preview {rtlPreview ? "on" : "off"}
          </Button>
          <StatusBadge tone={STATUS_TONE[existing?.status ?? "missing"]}>
            {existing?.status ?? "missing"}
          </StatusBadge>
        </div>

        {/* Side-by-side panes */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
              Source (en) — slots locked
            </p>
            <p className="min-h-[72px] text-xs">{a.source}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {sourceSlots.map((s) => (
                <Badge key={s} variant="outline" className="font-mono text-[9px]">{s}</Badge>
              ))}
            </div>
          </div>
          <div className={cn("rounded-md border p-2", rtlPreview && loc.rtl && "bg-muted/30")}>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
              {loc.native} ({locale}) {loc.rtl && "· RTL"}
            </p>
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir={rtlPreview && loc.rtl ? "rtl" : "ltr"}
              className={cn("text-xs", rtlPreview && loc.rtl && "font-medium")}
              placeholder={`Translate from source — keep ${sourceSlots.join(" ") || "slots"} intact…`}
            />
            <p className={cn("mt-1 text-[10px]", v.ok ? "text-muted-foreground" : "text-destructive")}>
              {charGuidance(a, text)}
            </p>
          </div>
        </div>

        {/* Validation results */}
        {v.problems.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
            <p className="mb-0.5 font-medium">Validation (AC-1):</p>
            <ul className="list-disc pl-4">
              {v.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!canManage || !text.trim()} title={manageTitle} onClick={() => save("machine-draft")}>
            Save as machine-draft
          </Button>
          <Button size="sm" variant="outline" disabled={!canManage || !text.trim()} title={manageTitle} onClick={() => save("human-reviewed")}>
            Save as human-reviewed
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={!canManage || !existing || (existing.status !== "human-reviewed" && existing.status !== "approved")}
            title={!canManage ? manageTitle : !existing ? "Nothing saved yet" : "Requires a human-reviewed cell"}
            onClick={() => {
              const r = approveVariant(asset, locale, actor);
              if (!r.ok) {
                toast({ title: "Approval blocked", description: r.problems.join(" · "), variant: "destructive" });
                return;
              }
              toast({ title: "Variant approved", description: `${a.name} [${locale}] signed off by ${actor}.` });
              setTick((n) => n + 1);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <span className="text-[10px] text-muted-foreground">by {actor}</span>
        </div>

        {/* Fallback chain editor (AC-2) */}
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-2 font-semibold uppercase text-muted-foreground">Fallback chain ({locale} → …)</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{locale}</span>
            <span>→</span>
            <Select value={fallbackTarget} onValueChange={(val) => setFallbackTarget(val as LocaleCode)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {listLocales().filter((l) => l.code !== locale).map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.native} ({l.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!canManage || fallbackTarget === loc.fallback}
              title={manageTitle}
              onClick={() => {
                if (setFallback(locale, fallbackTarget, actor)) {
                  toast({ title: "Fallback chain updated", description: `${locale} → ${fallbackTarget} (audit-logged).` });
                  setTick((n) => n + 1);
                }
              }}
            >
              Save chain
            </Button>
            <span className="text-muted-foreground">
              Recipient in {locale} with a missing cell renders {fallbackTarget}; never drops the send (AC-2).
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">
            Send-time resolution for this cell: renders <strong>{resolution.rendered}</strong>
            {resolution.fellBack ? ` (falls back from ${resolution.preferred})` : " (preferred locale available)"}.
          </p>
        </div>
      </div>
      <span className="hidden">{tick}</span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Export / import panel                                               */
/* ------------------------------------------------------------------ */

function ImportPanel({ canManage, manageTitle }: { canManage: boolean; manageTitle?: string }) {
  const { user } = usePlatform();
  const [xml, setXml] = useState("");
  const locales = listLocales().filter((l) => l.code !== "en").map((l) => l.code);

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <FileUp className="h-4 w-4" /> Agency round-trip — XLIFF export / import
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const sample = exportXliff(listAssets().slice(0, 2).map((a) => a.id), locales.slice(0, 3));
            setXml(sample);
            toast({ title: "Template generated", description: "Edit targets below (or paste the agency file) and re-import." });
          }}
        >
          Generate XLIFF template
        </Button>
        <Button
          size="sm"
          disabled={!canManage || !xml.trim()}
          title={manageTitle}
          onClick={() => {
            const r = importXliff(xml, user?.name ?? "operator");
            toast({
              title: r.ok ? `Imported ${r.imported} variant(s)` : "Import failed",
              description: r.errors.length ? r.errors.slice(0, 3).join(" · ") : "All units validated (slots intact) and saved as machine-draft.",
              variant: r.ok ? "default" : "destructive",
            });
          }}
        >
          <FileUp className="h-3.5 w-3.5" /> Import with validation
        </Button>
      </div>
      <Textarea
        rows={5}
        value={xml}
        onChange={(e) => setXml(e.target.value)}
        placeholder="Paste XLIFF here — re-import validates assets, locales and {{n}} slots per unit."
        className="mt-2 font-mono text-[11px]"
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        Unknown assets/locales and slot violations are rejected per unit; the rest land as machine-draft for review.
      </p>
    </div>
  );
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
