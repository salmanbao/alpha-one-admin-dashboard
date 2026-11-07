"use client";

/**
 * N17 — One-click unsubscribe landing (tokenized, no-login).
 * Every campaign must link here. Applies global marketing opt-out and
 * writes a consent receipt. Token is accepted (demo validates presence).
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, MailX } from "lucide-react";
import { applyGlobalUnsubscribe } from "@/lib/marketing-preferences";

function UnsubscribeInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [done, setDone] = useState(false);
  const [receiptId, setReceiptId] = useState("");

  const valid = useMemo(() => token.length >= 6, [token]);

  useEffect(() => {
    // Auto-apply on valid token (one-click) — confirmation shown.
    if (valid && !done) {
      const r = applyGlobalUnsubscribe(token);
      setReceiptId(r.id);
      setDone(true);
    }
  }, [valid, done, token]);

  if (!valid) {
    return (
      <TerraCard className="p-6 text-center space-y-3">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="text-lg font-semibold">Invalid unsubscribe link</h2>
        <p className="text-sm text-muted-foreground">This link is missing or expired. You can manage preferences after signing in.</p>
        <Button asChild><Link href="/marketing-preferences">Manage preferences</Link></Button>
      </TerraCard>
    );
  }

  return (
    <TerraCard className="p-6 text-center space-y-3">
      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
      <h2 className="text-lg font-semibold">You’re unsubscribed</h2>
      <p className="text-sm text-muted-foreground">All marketing messages (promotions, education, product news) across email, SMS and WhatsApp have been turned off. Transactional and security alerts are not affected.</p>
      {receiptId && <p className="text-[11px] text-muted-foreground">Receipt: <code>{receiptId}</code> · recorded {new Date().toLocaleString()}</p>}
      <div className="flex justify-center gap-2 pt-1">
        <Button variant="outline" asChild><Link href="/marketing-preferences">Manage by topic/channel</Link></Button>
        <Button asChild><Link href="/">Return to app</Link></Button>
      </div>
    </TerraCard>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <TerraPageHeader title="Email preferences" description="One-click unsubscribe (no sign-in required)."  />
      <div className="mt-4">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Processing…</p>}>
          <UnsubscribeInner />
        </Suspense>
      </div>
    </div>
  );
}
