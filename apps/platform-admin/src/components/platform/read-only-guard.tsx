"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { ShieldAlert, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode } from "react";
import React from "react";

export function ReadOnlyGuard({ children }: { children: ReactNode }) {
  const { isImpersonating } = usePlatform();

  if (!isImpersonating) return <>{children}</>;

  // Wrap children with tooltips explaining they are blocked.
  return (
    <TooltipProvider>
      <div className="relative">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          // Add tooltip to any button or interactive element inside
          return React.cloneElement(child, {
            disabled: true,
            "data-readonly": true,
          } as any);
        })}
        <div className="absolute bottom-full left-0 mb-1 z-10">
          <Badge variant="outline" className="text-[9px] bg-amber-50/90 text-amber-900 border-amber-500/30">
            <Info className="h-2.5 w-2.5 mr-1" /> Blocked in View-As
          </Badge>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Usage: wrap any mutating button/dialog trigger with <ReadOnlyGuard>
export function ReadOnlyButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isImpersonating } = usePlatform();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            {...props}
            disabled={isImpersonating}
            className={isImpersonating ? "opacity-50 cursor-not-allowed" : ""}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <div className="flex items-center gap-1 text-xs">
            <ShieldAlert className="h-3 w-3" />
            Blocked during View-As session
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}