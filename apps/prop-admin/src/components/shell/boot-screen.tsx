"use client";

/**
 * PFaaS Platform — Boot Screen
 *
 * Spec section 60. Shown while the application initializes:
 * Auth → Tenant → Configuration → Entitlements → Permissions → Theme
 * → Modules → Navigation → Routes → Render.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const STEPS = [
  "Loading authentication",
  "Resolving user",
  "Resolving tenant",
  "Loading tenant configuration",
  "Loading entitlements",
  "Loading permissions",
  "Initializing theme",
  "Initializing module registry",
  "Resolving enabled modules",
  "Building navigation",
  "Initializing routes",
  "Rendering dashboard",
];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(onDone, 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 90 + Math.random() * 60);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">PFaaS Platform</h1>
            <p className="text-xs text-muted-foreground">Multi-tenant white-label infrastructure</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1 text-xs transition-opacity ${done ? "opacity-60" : current ? "opacity-100" : "opacity-30"}`}
              >
                {done ? (
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
                ) : current ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
                )}
                <span className={done ? "text-muted-foreground line-through" : current ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${Math.min((step / STEPS.length) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
