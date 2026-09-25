"use client";

/**
 * Order Detail Page — purchase / order detail view.
 *
 * Reached from the Orders list (admin) or directly via `router.params.id`.
 * Breadcrumb: "Orders > [Order ID]".
 *
 * Layout (UX §12, §25-27 — progressive disclosure + predictable detail):
 *  - Header section: User (email link), Order ID (mono), Addons (JSON
 *    code block)
 *  - Main form (read-only with Edit toggle): Date created (read-only),
 *    Order type (dropdown), Notes (textarea)
 *  - Financials grid (2-column key-value): Challenge, Competition,
 *    Account balance, Amount paid, Quantity, Payment method, Coupon
 *    code, Bundle ID, Customer IP address
 *  - 3 collapsible sections (all start collapsed):
 *    1. Attribution / UTM Tracking (key-value list)
 *    2. Accounts (DataTable: Account Login, Phase, Broker, Initial
 *       Balance, Status)
 *    3. Subscription (DataTable: Billing Date, Amount, Status, Next
 *       Billing)
 *  - Footer actions: Save (primary), Save and add another (outline),
 *    Delete (destructive AlertDialog), Back (ghost)
 *
 * Mock data is generated deterministically from the order id (hashSeed)
 * — same approach used on closed-position-detail-page.
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders } from "@/lib/platform/mock-data";
import { Page, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { LabelWithHelp } from "@/components/platform/contextual-help";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  ShoppingCart,
  ChevronRight,
  Trash2,
  Save,
  Plus,
  Pencil,
  Check,
  ArrowLeft,
  ArrowUpRight,
  Mail,
  Braces,
  Calendar,
  CreditCard,
  Globe,
  Link2,
  Repeat,
  ShieldAlert,
  User,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type OrderType =
  | "Challenge Purchase"
  | "Activation Fee"
  | "Add-on"
  | "Subscription"
  | "Refund";

type PaymentMethod = "Crypto" | "Card" | "Bank Transfer" | "PayPal";

type SubscriptionStatus = "Active" | "Cancelled" | "Expired";

interface LinkedAccount {
  id: string;
  login: string;
  phase: string;
  broker: string;
  initialBalance: number;
  status: "active" | "breached" | "passed" | "pending";
}

interface SubscriptionRow {
  id: string;
  billingDate: string;
  amount: number;
  status: SubscriptionStatus;
  nextBilling: string | null;
}

interface OrderDetail {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  addons: Record<string, unknown>;
  dateCreated: string;
  orderType: OrderType;
  notes: string;
  challenge: string;
  competition: string | null;
  accountBalance: number;
  amountPaid: number;
  quantity: number;
  paymentMethod: PaymentMethod;
  couponCode: string;
  bundleId: string | null;
  customerIp: string;
  // Attribution
  utm: {
    source: string;
    campaign: string;
    medium: string;
    term: string;
    content: string;
    referrer: string;
    landing: string;
  };
  // Linked accounts
  accounts: LinkedAccount[];
  // Subscription rows (for Subscription / Add-on types)
  subscriptions: SubscriptionRow[];
}

const ORDER_TYPES: OrderType[] = [
  "Challenge Purchase",
  "Activation Fee",
  "Add-on",
  "Subscription",
  "Refund",
];

const PAYMENT_METHODS: PaymentMethod[] = [
  "Crypto",
  "Card",
  "Bank Transfer",
  "PayPal",
];

const CHALLENGES = [
  "Alpha 100K Two-Phase",
  "Beta 50K One-Phase",
  "Gamma 200K Three-Phase",
  "Delta 25K Instant Funded",
  "Epsilon 100K Evaluation",
];

const COMPETITIONS = [
  "Q4 Traders Cup",
  "Summer Sprint",
  "Founders Trophy",
];

const REFERRERS = [
  "https://t.co/abc123",
  "https://www.google.com/",
  "https://www.facebook.com/",
  "https://affiliate.alpha.capital",
  "https://t.me/alphacapital",
];

const LANDING_PAGES = [
  "https://alpha.capital/pricing",
  "https://alpha.capital/challenges/two-phase",
  "https://alpha.capital/competitions",
  "https://alpha.capital/checkout",
];

/** Deterministic pseudo-random generator from a numeric seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

/** Hash a string id to a stable integer seed. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

const BROKERS = ["MT5", "MT4", "DXTrade"];
const ACCOUNT_STATUSES: LinkedAccount["status"][] = [
  "active",
  "passed",
  "pending",
  "breached",
];

function generateOrderDetail(id: string, tenantId: string): OrderDetail {
  const seed = hashSeed(id);
  const traders = getTenantTraders(tenantId);
  const trader = traders[seed % Math.max(traders.length, 1)] ?? traders[0];

  const r1 = seededRandom(seed + 0.1);
  const r2 = seededRandom(seed + 0.5);
  const r3 = seededRandom(seed + 1.7);
  const r4 = seededRandom(seed + 3.3);

  const orderType = ORDER_TYPES[seed % ORDER_TYPES.length];
  const challenge = CHALLENGES[seed % CHALLENGES.length];
  const competition = r4 > 0.7 ? COMPETITIONS[seed % COMPETITIONS.length] : null;
  const accountBalance = [10000, 25000, 50000, 100000, 200000][
    seed % 5
  ];
  const amountPaid =
    orderType === "Refund"
      ? -Math.round(accountBalance * 0.15 * 100) / 100
      : Math.round(accountBalance * (0.05 + r1 * 0.03) * 100) / 100;
  const quantity = 1 + (seed % 3);
  const paymentMethod = PAYMENT_METHODS[seed % PAYMENT_METHODS.length];
  const couponCode = r2 > 0.5 ? `SAVE${10 + (seed % 30)}` : "";
  const bundleId = r3 > 0.6 ? `bundle-${(seed % 100) + 1}` : null;
  const customerIp = `${10 + (seed % 200)}.${seed % 255}.${(seed * 7) % 255}.${(seed * 13) % 255}`;

  // Addons — deterministic small object
  const addons: Record<string, unknown> = {};
  if (r4 > 0.4) addons["priority_withdrawal"] = true;
  if (r4 > 0.6) addons["extended_kyc"] = false;
  if (r4 > 0.8) addons["addon_quantity"] = 1 + (seed % 3);
  if (Object.keys(addons).length === 0) addons["none"] = true;

  // Date created — deterministic window from the past 60 days
  const now = Date.now();
  const createdMsAgo = Math.floor((1 + r2 * 60 * 24 * 60)) * 60 * 1000;
  const dateCreated = new Date(now - createdMsAgo).toISOString();

  // Attribution — deterministic UTM values
  const utm = {
    source: ["twitter", "google", "affiliate", "telegram", "direct"][seed % 5],
    campaign:
      challenge.toLowerCase().replace(/\s+/g, "_") + `_${(seed % 12) + 1}`,
    medium: ["cpc", "social", "email", "referral"][seed % 4],
    term: ["forex", "funded", "evaluation", ""][seed % 4],
    content: `ad_${(seed % 6) + 1}`,
    referrer: REFERRERS[seed % REFERRERS.length],
    landing: LANDING_PAGES[seed % LANDING_PAGES.length],
  };

  // Linked accounts — 1..3 deterministic accounts
  const accountCount = 1 + (seed % 3);
  const accounts: LinkedAccount[] = Array.from(
    { length: accountCount },
    (_, i) => {
      const s = seed + i * 17;
      return {
        id: `acct-${s}`,
        login: `${100000 + (s % 90000)}`,
        phase: ["phase-1", "phase-2", "funded"][i % 3],
        broker: BROKERS[i % BROKERS.length],
        initialBalance: accountBalance,
        status: ACCOUNT_STATUSES[s % ACCOUNT_STATUSES.length],
      };
    },
  );

  // Subscription rows — only meaningful for Subscription type but always
  // generated so the accordion is never empty.
  const subCount = orderType === "Subscription" ? 1 + (seed % 3) : 1;
  const subscriptions: SubscriptionRow[] = Array.from(
    { length: subCount },
    (_, i) => {
      const s = seed + i * 23;
      const billingOffset = (s % 90) * 24 * 60 * 60 * 1000;
      const status: SubscriptionStatus =
        i === 0
          ? "Active"
          : (["Active", "Cancelled", "Expired"][s % 3] as SubscriptionStatus);
      const next =
        status === "Active"
          ? new Date(now + (30 - (s % 30)) * 24 * 60 * 60 * 1000).toISOString()
          : null;
      return {
        id: `sub-${s}`,
        billingDate: new Date(now - billingOffset).toISOString(),
        amount: Math.round(accountBalance * 0.05 * 100) / 100,
        status,
        nextBilling: next,
      };
    },
  );

  return {
    id,
    userId: trader?.id ?? "usr-unknown",
    userEmail: trader?.email ?? "trader@example.com",
    userFullName: trader?.name ?? "Unknown trader",
    addons,
    dateCreated,
    orderType,
    notes:
      orderType === "Refund"
        ? "Refund issued for duplicate challenge purchase (CS ticket #4231)."
        : `Customer purchased ${quantity} × ${challenge}.`,
    challenge,
    competition,
    accountBalance,
    amountPaid,
    quantity,
    paymentMethod,
    couponCode,
    bundleId,
    customerIp,
    utm,
    accounts,
    subscriptions,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function OrderDetailPage() {
  const { runtime, navigate, router } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const id = router.params.id ?? "ord-unknown";
  const seed = useMemo(() => generateOrderDetail(id, tid), [id, tid]);

  // Working copy — local state so edits don't mutate mock data.
  const [working, setWorking] = useState<OrderDetail>(seed);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Render-time resync — when the URL `id` changes (in-app navigation
  // between two orders), the useState initial value is stale. Without
  // this guard, the page briefly renders the previous order's data until
  // a field is edited. Mirrors profile-page.tsx pattern.
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setWorking(seed);
  }

  const update = (patch: Partial<OrderDetail>) =>
    setWorking((w) => ({ ...w, ...patch }));

  const onToggleEdit = () => {
    if (editing) {
      setWorking(seed); // discard local edits
    }
    setEditing((e) => !e);
  };

  const onSave = () => {
    setEditing(false);
    toast({
      title: "Order saved",
      description: `Changes to ${working.id} were saved.`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Order saved",
      description: "Redirecting to a fresh order form (demo).",
    });
    // The "new order" view isn't implemented yet — close to nothing is
    // the closest parent (the orders list lives in the dashboard-tabs).
    navigate("dashboard-orders");
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Order deleted",
      description: `${working.id} was permanently deleted.`,
    });
    navigate("dashboard-orders");
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
                onClick={() => navigate("dashboard-orders")}
              >
                Orders
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

      {/* Header section */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted p-2">
            <ShoppingCart className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Order{" "}
              <span className="ml-1 font-mono text-base text-muted-foreground">
                {working.id}
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <a
                href={`mailto:${working.userEmail}`}
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <Mail className="h-3 w-3" />
                {working.userEmail}
              </a>
              <span aria-hidden>·</span>
              <span>
                {new Date(working.dateCreated).toLocaleString()}
              </span>
              <span aria-hidden>·</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                // Inline "View Trader" cross-link placed next to the email +
                // date in the order header (UX §22 — contextual action where
                // the decision happens, not buried at the bottom). The
                // variant="link" + size="sm" base is overridden with compact
                // `h-auto px-2 py-1 text-[11px]` so the badge-style chip
                // stays visually inline with the surrounding `text-xs`
                // metadata without inflating the line height. `hover:no-underline`
                // suppresses the link variant's underline-on-hover so the
                // emerald chip's bg-color hover state is the only signal.
                onClick={() =>
                  navigate("trader-detail", { id: working.userId })
                }
                className="inline-flex h-auto items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:no-underline hover:text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
                aria-label={`View trader ${working.userFullName}`}
                title={`View trader ${working.userFullName}`}
              >
                <User className="h-3 w-3" />
                View Trader
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {working.orderType}
          </Badge>
          {working.bundleId ? (
            <Badge variant="secondary" className="text-[10px]">
              Bundle: {working.bundleId}
            </Badge>
          ) : null}
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
        {/* Addons — JSON code block */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Braces className="h-3.5 w-3.5 text-muted-foreground" />
            Addons
          </p>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs text-foreground">
{JSON.stringify(working.addons, null, 2)}
          </pre>
        </div>

        {/* Key remount on id change so local working state resets */}
        <OrderForm
          key={seed.id}
          working={working}
          editing={editing}
          currency={currency}
          onFieldChange={update}
        />

        {/* Collapsible sections */}
        <Accordion
          type="multiple"
          className="w-full"
          defaultValue={[]}
        >
          {/* 1. Attribution / UTM Tracking */}
          <AccordionItem
            value="attribution"
            className="rounded-md border bg-card px-4"
          >
            <AccordionTrigger className="text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                Attribution / UTM Tracking
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <UtmField label="Source" value={working.utm.source} />
                <UtmField label="Campaign" value={working.utm.campaign} />
                <UtmField label="Medium" value={working.utm.medium} />
                <UtmField label="Term" value={working.utm.term || "—"} />
                <UtmField label="Content" value={working.utm.content} />
                <UtmField
                  label="Referrer URL"
                  value={working.utm.referrer}
                  mono
                  link={working.utm.referrer}
                />
                <UtmField
                  label="Landing page"
                  value={working.utm.landing}
                  mono
                  link={working.utm.landing}
                />
              </dl>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Accounts */}
          <AccordionItem
            value="accounts"
            className="rounded-md border bg-card px-4"
          >
            <AccordionTrigger className="text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Accounts
                <Badge variant="secondary" className="ml-1 text-[9px]">
                  {working.accounts.length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <AccountsTable
                accounts={working.accounts}
                currency={currency}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 3. Subscription */}
          <AccordionItem
            value="subscription"
            className="rounded-md border bg-card px-4"
          >
            <AccordionTrigger className="text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                Subscription
                <Badge variant="secondary" className="ml-1 text-[9px]">
                  {working.subscriptions.length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <SubscriptionTable
                rows={working.subscriptions}
                currency={currency}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {/* Footer actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Delete order?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This order record will be permanently deleted. Financial
                  audit trails and linked account references will lose
                  their purchase attribution. This action cannot be undone.
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("dashboard-orders")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
              <Plus className="h-3.5 w-3.5" /> Save and add another
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

function OrderForm({
  working,
  editing,
  currency,
  onFieldChange,
}: {
  working: OrderDetail;
  editing: boolean;
  currency: string;
  onFieldChange: (patch: Partial<OrderDetail>) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Main form — date created (read-only), order type, notes */}
      <FormSection
        title="Order"
        icon={Calendar}
        description="Top-level details about this purchase."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <LabelWithHelp
              help="When the order was created. Read-only — set at checkout."
              className="text-sm font-medium"
            >
              Date created
            </LabelWithHelp>
            <Input
              value={new Date(working.dateCreated).toISOString().slice(0, 16)}
              readOnly
              disabled
              className="font-mono text-xs"
              aria-label="Date created"
            />
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              help="Challenge Purchase = first-time evaluation buy. Activation Fee = re-activation of a breached account. Add-on = supplementary purchase (extra withdrawal, KYC upgrade). Subscription = recurring billing. Refund = reimbursement of a previous order."
              className="text-sm font-medium"
            >
              Order type
            </LabelWithHelp>
            <Select
              value={working.orderType}
              onValueChange={(v) =>
                onFieldChange({ orderType: v as OrderType })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select order type…" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              help="Internal notes for finance / ops staff. Visible only inside the admin panel, not to the trader."
              className="text-sm font-medium"
            >
              Notes
            </LabelWithHelp>
            <Textarea
              rows={4}
              value={working.notes}
              onChange={(e) => onFieldChange({ notes: e.target.value })}
              disabled={!editing}
              placeholder="Add notes about this order…"
            />
          </div>
        </div>
      </FormSection>

      {/* Financials grid — 2-column key-value */}
      <FormSection
        title="Financials"
        icon={CreditCard}
        description="Challenge, payment, and attribution identifiers."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField
            label="Challenge"
            value={working.challenge}
          />
          <ReadOnlyField
            label="Competition"
            value={working.competition ?? "None"}
          />
          <ReadOnlyField
            label="Account balance"
            value={formatCurrency(working.accountBalance, currency)}
            help="Target account size for this challenge purchase."
          />
          <ReadOnlyField
            label="Amount paid"
            value={`${working.amountPaid >= 0 ? "" : "−"}${formatCurrency(
              Math.abs(working.amountPaid),
              currency,
            )}`}
            help="Net amount charged (negative for refunds)."
          />
          <ReadOnlyField
            label="Quantity"
            value={String(working.quantity)}
          />
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Payment method the trader used at checkout."
              className="text-sm font-medium"
            >
              Payment method
            </LabelWithHelp>
            <Select
              value={working.paymentMethod}
              onValueChange={(v) =>
                onFieldChange({ paymentMethod: v as PaymentMethod })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select payment method…" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Coupon code applied at checkout. Empty if none was used."
              className="text-sm font-medium"
            >
              Coupon code
            </LabelWithHelp>
            <Input
              value={working.couponCode}
              onChange={(e) =>
                onFieldChange({ couponCode: e.target.value })
              }
              disabled={!editing}
              placeholder="—"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Bundle ID if this order was part of a multi-account bundle."
              className="text-sm font-medium"
            >
              Bundle ID
            </LabelWithHelp>
            <Input
              value={working.bundleId ?? ""}
              onChange={(e) =>
                onFieldChange({
                  bundleId: e.target.value || null,
                })
              }
              disabled={!editing}
              placeholder="None"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              help="IP address recorded at checkout. Used in fraud detection and device fingerprinting."
              className="text-sm font-medium"
            >
              Customer IP address
            </LabelWithHelp>
            <Input
              value={working.customerIp}
              onChange={(e) =>
                onFieldChange({ customerIp: e.target.value })
              }
              disabled={!editing}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-tables                                                          */
/* ------------------------------------------------------------------ */

function AccountsTable({
  accounts,
  currency,
}: {
  accounts: LinkedAccount[];
  currency: string;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No linked accounts"
        description="This order did not create or modify any trading accounts."
      />
    );
  }
  const columns: Column<LinkedAccount>[] = [
    {
      key: "login",
      header: "Account Login",
      cell: (a) => <span className="font-mono text-xs">{a.login}</span>,
      sortValue: (a) => a.login,
    },
    {
      key: "phase",
      header: "Phase",
      cell: (a) => <Badge variant="outline" className="text-[10px]">{a.phase}</Badge>,
      sortValue: (a) => a.phase,
    },
    {
      key: "broker",
      header: "Broker",
      cell: (a) => <Badge variant="secondary" className="text-[10px]">{a.broker}</Badge>,
      sortValue: (a) => a.broker,
    },
    {
      key: "initialBalance",
      header: "Initial Balance",
      cell: (a) => formatCurrency(a.initialBalance, currency),
      sortValue: (a) => a.initialBalance,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <StatusBadge
          tone={
            a.status === "active"
              ? "success"
              : a.status === "breached"
              ? "danger"
              : a.status === "passed"
              ? "info"
              : "warning"
          }
        >
          {a.status}
        </StatusBadge>
      ),
      sortValue: (a) => a.status,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={accounts}
      rowKey={(a) => a.id}
      pageSize={5}
    />
  );
}

function SubscriptionTable({
  rows,
  currency,
}: {
  rows: SubscriptionRow[];
  currency: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="No subscription rows"
        description="This order is not part of a subscription."
      />
    );
  }
  const columns: Column<SubscriptionRow>[] = [
    {
      key: "billingDate",
      header: "Billing Date",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.billingDate).toLocaleDateString()}
        </span>
      ),
      sortValue: (r) => r.billingDate,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => formatCurrency(r.amount, currency),
      sortValue: (r) => r.amount,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge
          tone={
            r.status === "Active"
              ? "success"
              : r.status === "Cancelled"
              ? "danger"
              : "muted"
          }
        >
          {r.status}
        </StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "nextBilling",
      header: "Next Billing",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.nextBilling ? new Date(r.nextBilling).toLocaleDateString() : "—"}
        </span>
      ),
      sortValue: (r) => r.nextBilling ?? "",
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.id}
      pageSize={5}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
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
  mono,
}: {
  label: string;
  value: string;
  help?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <LabelWithHelp
        help={help ?? "Read-only."}
        className="text-sm font-medium"
      >
        {label}
      </LabelWithHelp>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function UtmField({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400",
              mono && "font-mono text-xs",
            )}
            title={link}
          >
            <Globe className="h-3 w-3" />
            <span className="truncate">{value}</span>
          </a>
        ) : (
          <span className={cn("text-foreground", mono && "font-mono text-xs")}>
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}
