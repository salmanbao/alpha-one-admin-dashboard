"use client";

/**
 * First-use / empty-state block (audit fix #11) — guides new users through
 * setup actions instead of leaving a bare list.
 */
import { Compass, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlatformEmptyState({
  title = "Nothing here yet",
  description = "Your dashboard is ready — a few quick steps get you started.",
  steps = [] as string[],
  actions = [] as { label: string; href: string }[],
}: {
  title?: string;
  description?: string;
  steps?: string[];
  actions?: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <div>
          <h3 className="font-headline text-xl font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {steps.length > 0 && (
          <ol className="space-y-3 text-left">
            {steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</span>
                <p className="text-sm font-medium text-foreground">{s}</p>
              </li>
            ))}
          </ol>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {actions.map((a) => (
              <Button key={a.href} asChild size="sm" className="gap-1">
                <a href={a.href}>{a.label} <ArrowRight className="h-3 w-3" /></a>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
