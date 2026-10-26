"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonationSession, endImpersonation, renewImpersonation } = usePlatform();
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!isImpersonating || !impersonationSession) return;
    const tick = () => setRemaining(Math.max(0, Math.round((impersonationSession.expires - Date.now()) / 1000)));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [isImpersonating, impersonationSession]);

  if (!isImpersonating || !impersonationSession) return null;

  return (
    <div className="w-full border-b bg-amber-50/90 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 px-4 py-2 flex items-center gap-3 text-xs md:text-sm">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="font-medium">View-As session active — read-only.</span>
      <span className="text-xs opacity-80">Tenant: {impersonationSession.tenantId} · {remaining > 0 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s left` : "expiring"}</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={renewImpersonation}>Renew</Button>
        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={endImpersonation}>End session</Button>
      </div>
    </div>
  );
}
