"use client";

/**
 * Certificate Detail Page — single issued certificate view + edit form.
 *
 * Reached from the Issued Certificates list (3-dot menu → View Certificate)
 * or directly via router.params.id. Breadcrumb: Certificates > [Certificate ID].
 *
 * Layout follows the AGENTS.md progressive disclosure principle: the form is
 * read-only by default with an "Edit" toggle that unlocks the editable
 * fields (Certificate Type, Template, Linked Withdrawal, Status). Account,
 * Trader Name, Challenge Name, Created Date, and Certificate URL remain
 * read-only — they reflect data set when the certificate was issued.
 *
 * Destructive "Delete Certificate" action requires an AlertDialog
 * confirmation per AGENTS.md. Save variants (Save / Save & add another /
 * Save & continue editing) match the established pattern on
 * certificate-management-page and other settings detail editors.
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  traders as allTraders,
  getCertificateTemplates,
  type CertificateTemplate,
  type Trader,
} from "@/lib/platform/mock-data";
import {
  CERT_TYPES,
  getIssuedCertificate,
  getIssuedCertificates,
  type CertStatus,
  type CertType,
  type IssuedCertificate,
} from "@/modules/settings/pages/certificates-issued-page";
import { Page, PageContent } from "@/components/platform/page";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Award,
  Pencil,
  Save,
  Plus,
  Check,
  Trash2,
  ExternalLink,
  Copy,
  ChevronRight,
  ScrollText,
  User,
  Trophy,
  CreditCard,
  Calendar,
  ShieldAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

/** Account (trader) options for the Account dropdown. */
function getAccountOptions(tid: string): Trader[] {
  const tenantTraders = getTenantTraders(tid);
  const pool = tenantTraders.length > 0 ? tenantTraders : allTraders;
  // De-duplicate by email and cap at 20 for the dropdown.
  const seen = new Set<string>();
  const out: Trader[] = [];
  for (const t of pool) {
    if (seen.has(t.email)) continue;
    seen.add(t.email);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

/** Mock linked withdrawals list. */
function getWithdrawalOptions(cert: IssuedCertificate) {
  const base = [
    { id: `wd-${1000 + (cert.id.length % 200)}`, amount: cert.withdrawalAmount },
    { id: `wd-${2000 + (cert.id.length % 200)}`, amount: cert.withdrawalAmount + 1250 },
    { id: `wd-${3000 + (cert.id.length % 200)}`, amount: cert.withdrawalAmount + 2750 },
  ];
  // Ensure the certificate's own withdrawal id is always selectable.
  if (cert.withdrawalId && !base.some((w) => w.id === cert.withdrawalId)) {
    base.unshift({ id: cert.withdrawalId, amount: cert.withdrawalAmount });
  }
  return base;
}

/** Tone for the Certificate Type badge (read-only display). */
function certTypeTone(
  certType: CertType,
): "info" | "warning" | "success" | "muted" {
  switch (certType) {
    case "Challenge Passed":
      return "success";
    case "Funded Trader":
      return "info";
    case "Competition Winner":
      return "warning";
    default:
      return "muted";
  }
}

/** Icon for a Certificate Type. */
function certTypeIcon(certType: CertType) {
  switch (certType) {
    case "Funded Trader":
      return Award;
    case "Competition Winner":
      return Trophy;
    case "Challenge Passed":
    default:
      return Check;
  }
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export function CertificateDetailPage() {
  const { runtime, navigate, router } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const id = router.params.id ?? "";
  const seedCert = useMemo(() => getIssuedCertificate(id, tid), [id, tid]);

  // Working copy — local state so edits don't mutate mock data.
  const [working, setWorking] = useState<IssuedCertificate>(seedCert);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Recompute working when the seed changes (e.g. navigating to another id).
  // useEffect-less sync via key prop on the inner form below avoids stale
  // state when the user navigates between certificates.
  const accounts = useMemo(() => getAccountOptions(tid), [tid]);
  const templates = useMemo(() => getCertificateTemplates(), []);
  const withdrawals = useMemo(() => getWithdrawalOptions(seedCert), [seedCert]);

  const update = (patch: Partial<IssuedCertificate>) =>
    setWorking((w) => ({ ...w, ...patch }));

  const onToggleEdit = () => {
    if (editing) {
      // Discard changes on cancel-style toggle off.
      setWorking(seedCert);
    }
    setEditing((e) => !e);
  };

  const onSave = () => {
    setEditing(false);
    toast({
      title: "Certificate updated",
      description: `Changes to ${working.id} were saved.`,
    });
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `Certificate ${working.id} updated. Continuing edits.`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Certificate saved",
      description: "Redirecting to a fresh certificate form (demo).",
    });
    // The "new certificate form" view isn't implemented yet — the Issued
    // Certificates list page is the closest parent. We navigate there so the
    // operator can use the "Issue Certificate" button to start a new record.
    navigate("certificates-issued");
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Certificate deleted",
      description: `${working.id} was permanently deleted.`,
      // tone: "destructive" — the platform toast API doesn't expose a tone
      // prop in this version; the description carries the gravity.
    });
    navigate("certificates-issued");
  };

  const onCopyUrl = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(working.certUrl);
        toast({
          title: "URL copied",
          description: "Certificate URL copied to clipboard.",
        });
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      toast({
        title: "Couldn't copy automatically",
        description: "Copy the URL manually from the field below.",
      });
    }
  };

  const onAccountChange = (email: string) => {
    const t = accounts.find((a) => a.email === email);
    if (!t) return;
    update({
      accountEmail: t.email,
      traderName: t.name,
      traderId: t.id,
    });
  };

  const onWithdrawalChange = (wdId: string) => {
    const wd = withdrawals.find((w) => w.id === wdId);
    if (!wd) return;
    update({ withdrawalId: wd.id, withdrawalAmount: wd.amount });
  };

  return (
    <Page>
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button
                type="button"
                onClick={() => navigate("certificates-issued")}
              >
                Certificates
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {working.id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted p-2">
            <Award className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {working.traderName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {working.id}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {working.challengeName} · {working.certType}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExplainableStateBadge
            status={working.status}
            entityType="certificate"
            detail={`Certificate URL: ${working.certUrl}`}
          />
          <Badge variant="outline" className="capitalize">
            {working.certType}
          </Badge>
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={onToggleEdit}
            aria-pressed={editing}
          >
            {editing ? (
              <>
                <Check className="h-3.5 w-3.5" /> Done
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </>
            )}
          </Button>
        </div>
      </div>

      <PageContent>
        {/* Key remount on id change so local working state resets */}
        <CertificateForm
          key={seedCert.id}
          working={working}
          editing={editing}
          accounts={accounts}
          templates={templates}
          withdrawals={withdrawals}
          currency={currency}
          onAccountChange={onAccountChange}
          onWithdrawalChange={onWithdrawalChange}
          onFieldChange={update}
          onCopyUrl={onCopyUrl}
        />

        <Separator />

        {/* Bottom action bar — one primary action + destructive w/ confirm */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Certificate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Delete certificate?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The certificate will be permanently deleted. The trader
                  will lose access to their certificate URL.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800",
                  )}
                  onClick={onDelete}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
              <Plus className="h-3.5 w-3.5" /> Save and add another
            </Button>
            <Button size="sm" variant="outline" onClick={onSaveAndContinue}>
              <Save className="h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Form sub-component                                                  */
/* ------------------------------------------------------------------ */

function CertificateForm({
  working,
  editing,
  accounts,
  templates,
  withdrawals,
  currency,
  onAccountChange,
  onWithdrawalChange,
  onFieldChange,
  onCopyUrl,
}: {
  working: IssuedCertificate;
  editing: boolean;
  accounts: Trader[];
  templates: CertificateTemplate[];
  withdrawals: { id: string; amount: number }[];
  currency: string;
  onAccountChange: (email: string) => void;
  onWithdrawalChange: (wdId: string) => void;
  onFieldChange: (patch: Partial<IssuedCertificate>) => void;
  onCopyUrl: () => void;
}) {
  const selectedTemplate = templates.find((t) => t.id === working.templateId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Account section */}
      <FormSection
        title="Account"
        icon={User}
        description="Identifies the trader who earned this certificate."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <LabelWithHelp
              help="The trader account that earned this certificate. Changing this re-links the certificate to a different trader."
              className="text-sm font-medium"
            >
              Account
            </LabelWithHelp>
            <Select
              value={working.accountEmail}
              onValueChange={onAccountChange}
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select trader account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.email}>
                    {a.email} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ReadOnlyField
            label="Trader Name"
            value={working.traderName}
            help="Auto-filled from the selected account."
          />
          <ReadOnlyField
            label="Challenge Name"
            value={working.challengeName}
            help="The challenge that triggered this certificate (set when issued)."
          />
        </div>
      </FormSection>

      {/* Certificate section */}
      <FormSection
        title="Certificate"
        icon={ScrollText}
        description="The certificate type and the template used to render it."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Challenge Passed = trader met profit target without breaching risk rules. Funded Trader = trader reached funded status. Competition Winner = trader won a leaderboard competition."
              className="text-sm font-medium"
            >
              Certificate Type
            </LabelWithHelp>
            <Select
              value={working.certType}
              onValueChange={(v) =>
                onFieldChange({ certType: v as CertType })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select certificate type…" />
              </SelectTrigger>
              <SelectContent>
                {CERT_TYPES.map((t) => {
                  const Icon = certTypeIcon(t);
                  return (
                    <SelectItem key={t} value={t}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {t}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="pt-1">
              <StatusBadge tone={certTypeTone(working.certType)}>
                {working.certType}
              </StatusBadge>
            </div>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              help="Templates control the visual layout of the rendered certificate (standard, premium, trophy). Managed under Certificate Management."
              className="text-sm font-medium"
            >
              Template
            </LabelWithHelp>
            <Select
              value={working.templateId}
              onValueChange={(v) => onFieldChange({ templateId: v })}
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {t.layout}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate ? (
              <p className="text-xs text-muted-foreground" title={selectedTemplate.description}>
                {selectedTemplate.description}
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      {/* Withdrawal section */}
      <FormSection
        title="Withdrawal"
        icon={CreditCard}
        description="Optional withdrawal linked to this certificate."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <LabelWithHelp
              help="If this certificate was issued as a result of a funded-trader milestone withdrawal, link it here. Otherwise leave empty."
              className="text-sm font-medium"
            >
              Linked Withdrawal
            </LabelWithHelp>
            <Select
              value={working.withdrawalId ?? ""}
              onValueChange={onWithdrawalChange}
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="No linked withdrawal" />
              </SelectTrigger>
              <SelectContent>
                {withdrawals.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.id} — {formatCurrency(w.amount, currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ReadOnlyField
            label="Amount"
            value={formatCurrency(working.withdrawalAmount, currency)}
            help="Auto-filled from the selected withdrawal."
          />
        </div>
      </FormSection>

      {/* Metadata + Status section */}
      <FormSection
        title="Metadata & Status"
        icon={Calendar}
        description="Audit fields and the certificate's lifecycle status."
      >
        <div className="space-y-3">
          <ReadOnlyField
            label="Created Date"
            value={new Date(working.createdAt).toLocaleDateString()}
            help="Set when the certificate was first issued. Read-only."
          />

          <div className="space-y-1.5">
            <LabelWithHelp
              help="The publicly verifiable certificate URL. Anyone with the link can verify the certificate while its status is Valid."
              className="text-sm font-medium"
            >
              Certificate URL
            </LabelWithHelp>
            <div className="flex items-center gap-1.5">
              <Input
                value={working.certUrl}
                readOnly
                className="flex-1 font-mono text-xs"
                aria-label="Certificate URL"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-2"
                onClick={onCopyUrl}
                aria-label="Copy certificate URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <a
                href={working.certUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-background px-2 text-xs text-emerald-700 hover:bg-muted dark:text-emerald-400"
                aria-label="Open certificate URL in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <LabelWithHelp
              help="Valid = active & verifiable. Expired = past its validity period. Revoked = manually invalidated by an admin; the URL stops working."
              className="text-sm font-medium"
            >
              Status
            </LabelWithHelp>
            <Select
              value={working.status}
              onValueChange={(v) =>
                onFieldChange({ status: v as CertStatus })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <div className="pt-1">
              <ExplainableStateBadge
                status={working.status}
                entityType="certificate"
                detail={`Certificate URL: ${working.certUrl}`}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function FormSection({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-start gap-2">
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <Separator />
      {children}
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <LabelWithHelp
        help={help ?? "Read-only."}
        className="text-sm font-medium"
      >
        {label}
      </LabelWithHelp>
      <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}
