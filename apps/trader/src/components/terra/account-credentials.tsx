"use client";

/**
 * Account Credentials — PRD §3.7.5 reusable component.
 * Show/hide password, copy login / password / server / server address,
 * and download the trading platform. Frontend-only demo: clipboard uses
 * the real API, downloads are mocked with toasts.
 *
 * Audit fix #11 (MEDIUM): a "Copy all" action copies every credential
 * in one clipboard payload (the common "set up my terminal" flow), and
 * each control carries a descriptive aria-label so screen readers
 * announce which field is being copied/revealed — not just "Copy".
 */

import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { TerraBadge } from "./terra-ui";
import { toast } from "@/hooks/use-toast";

export interface CredentialAccount {
  login: string;
  platform: string;
  server: string;
}

function serverAddress(server: string) {
  return `${server.toLowerCase().replace(/[^a-z0-9]+/g, "")}.terra.trader:443`;
}

function investorPassword(login: string) {
  return `Tt-${login}-9fX2`;
}

function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-2.5">
      <div className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="break-all font-mono text-sm font-bold text-on-surface">
          {shown ? value : "••••••••••"}
        </span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {secret && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={`${shown ? "Hide" : "Show"} ${label}`}
            className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            {shown ? "Hide" : "Show"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label} to clipboard`}
          className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function AccountCredentials({ account }: { account: CredentialAccount }) {
  const handleDownloadPlatform = () => {
    toast({
      title: `${account.platform} download started`,
      description: `Installing for ${account.server} — login #${account.login} will work once the platform is installed. (Demo — no backend call.)`,
    });
  };

  const password = investorPassword(account.login);
  const address = serverAddress(account.server);

  const handleCopyAll = () => {
    const payload = [
      `Login: ${account.login}`,
      `Password (investor): ${password}`,
      `Server: ${account.server}`,
      `Server address: ${address}`,
    ].join("\n");
    navigator.clipboard?.writeText(payload);
    toast({
      title: "All credentials copied",
      description: `Login #${account.login}, investor password, server and address are on your clipboard.`,
    });
  };

  return (
    <>
      <div className="space-y-2">
        <CredentialRow label="Login" value={account.login} />
        <CredentialRow label="Password (investor)" value={password} secret />
        <CredentialRow label="Server" value={account.server} />
        <CredentialRow label="Server address" value={address} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadPlatform}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download {account.platform}
        </button>
        <button
          type="button"
          onClick={handleCopyAll}
          aria-label="Copy all credentials (login, password, server, address)"
          className="inline-flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copy all
        </button>
        <TerraBadge tone="tertiary">Keep these private</TerraBadge>
      </div>
      <p className="mt-3 text-[11px] text-on-surface-variant">
        Password is masked by default — press Show to reveal. Copy writes one
        field to your clipboard; Copy all grabs every credential for terminal
        setup. (Demo — download is mocked.)
      </p>
    </>
  );
}
