"use client";

/**
 * Account Switcher — the trader's "which account am I on?" control.
 *
 * Prop-firm traders hold multiple accounts (challenge phases + funded).
 * This dropdown is the single UI for switching the active trading account;
 * it appears in the app-shell header (global) and on the dashboard's
 * controls bar (`variant="panel"` — replaces the previously decorative,
 * non-functional selector).
 *
 * Behavior:
 * • Button shows the active account (#login, name, phase, status dot).
 * • Menu lists every account with balance/equity + status; the active one
 *   is checkmarked and `aria-current`.
 * • Picking an account persists it via useActiveAccount (localStorage) and
 *   toasts so the change is acknowledged — every account-scoped screen
 *   re-renders against the new context.
 * • Footer link to My Accounts for full management.
 *
 * a11y: aria-expanded / aria-haspopup="listbox" on the trigger,
 * role="option" + aria-selected on rows, Escape closes, click-outside closes.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Layers, Wallet } from "lucide-react";
import { cn } from "@pfaas/ui";
import { toast } from "@/hooks/use-toast";
import { useActiveAccount } from "@/lib/platform/account-context";
import { formatMoney } from "@/components/terra/terra-ui";

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  standby: "bg-amber-500",
  breached: "bg-red-500",
  provisioning: "bg-sky-500",
  passed: "bg-primary",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  standby: "Standby",
  breached: "Breached",
  provisioning: "Provisioning",
  passed: "Passed",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        STATUS_DOT[status] ?? "bg-outline",
      )}
      aria-hidden
    />
  );
}

export function AccountSwitcher({
  variant = "header",
}: {
  /**
   * "header" — compact trigger for the app-shell top bar.
   * "panel"  — larger "Trading Account" trigger for the dashboard bar.
   */
  variant?: "header" | "panel";
}) {
  const { accounts, activeAccount, setActiveAccountId } = useActiveAccount();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string, label: string) => {
    if (id !== activeAccount.id) {
      setActiveAccountId(id);
      toast({
        title: "Account switched",
        description: `Now viewing ${label}. Dashboard, positions, risk and payouts follow this account.`,
      });
    }
    setOpen(false);
  };

  const trigger =
    variant === "panel" ? (
      /* Dashboard controls bar — same anatomy as the original (dead) selector. */
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active trading account #${activeAccount.login}. Switch account`}
        className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-2.5 text-left shadow-sm transition-all hover:bg-surface-container"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant">
          <Wallet className="h-4 w-4" />
        </span>
        <span className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Trading Account
          </span>
          <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <span className="font-mono">#{activeAccount.login}</span>
            <span className="hidden text-xs font-normal text-on-surface-variant sm:inline">
              • {activeAccount.name}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 text-on-surface-variant transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
    ) : (
      /* App-shell header — compact trigger. */
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active trading account #${activeAccount.login}. Switch account`}
        className={cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          "bg-sidebar-accent/40 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Layers className="h-4 w-4 text-sidebar-primary" aria-hidden />
        <span className="flex flex-col items-start leading-none">
          <span className="font-mono text-xs font-semibold">
            #{activeAccount.login}
          </span>
          <span className="hidden text-[10px] text-sidebar-foreground/70 sm:block">
            {activeAccount.name}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
    );

  return (
    <div className="relative" ref={rootRef}>
      {trigger}
      {open && (
        <div
          role="listbox"
          aria-label="Trading accounts"
          className="absolute left-0 top-full z-50 mt-2 w-[19rem] rounded-lg border border-sidebar-border bg-popover p-1 shadow-terra sm:right-0 sm:left-auto"
        >
          <div className="border-b border-sidebar-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Switch trading account
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccount.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() =>
                    pick(acc.id, `#${acc.login} ${acc.name}`)
                  }
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
                    "hover:bg-sidebar-accent/60",
                    isActive && "bg-sidebar-accent/50",
                  )}
                >
                  <span className="mt-1.5">
                    <StatusDot status={acc.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-sidebar-foreground">
                        {acc.name}
                      </span>
                      {isActive && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-sidebar-primary"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-sidebar-foreground/70">
                      <span className="font-mono">#{acc.login}</span>
                      <span>•</span>
                      <span>{acc.phase}</span>
                      <span>•</span>
                      <span>{acc.platform}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-sidebar-foreground">
                        {formatMoney(acc.equity)}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1",
                          acc.status === "active"
                            ? "text-emerald-600"
                            : acc.status === "breached"
                              ? "text-red-600"
                              : "text-sidebar-foreground/60",
                        )}
                      >
                        · {STATUS_LABEL[acc.status] ?? acc.status}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-sidebar-border pt-1">
            <Link
              href="/my-accounts"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/60"
            >
              Manage all accounts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
