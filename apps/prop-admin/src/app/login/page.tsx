"use client";

/**
 * Login hand-off route — the target of SessionExpiryBanner's "Sign out".
 *
 * Sign-out carries where the user was as `?next=…` so expiry never costs
 * them their place (audit B #4). This route validates that target (same-app
 * absolute paths only, never a protocol-relative/absolute URL and never the
 * login route itself) and hands the browser over to it.
 *
 * The redirect is a full navigation rather than a client-side replace: the
 * auth + boot gate reads the URL once when it mounts, so the destination
 * has to be in the address bar *before* the app hydrates or the preserved
 * view would resolve to the default overview instead.
 */

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw === "/login" || raw.startsWith("/login?")) return null;
  return raw;
}

function LoginRedirect() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    window.location.replace(next ?? "/");
  }, [next]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <p className="text-sm text-muted-foreground" role="status">
        {next ? "Returning you to where you left off…" : "Signing you out…"}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    }>
      <LoginRedirect />
    </Suspense>
  );
}