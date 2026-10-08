"use client";

/**
 * Encrypted Document Viewer — converted from stitch_screens/document_viewer_encrypted
 * Unlock screen with access code, then document preview.
 */

import { useState } from "react";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";

export function DocumentViewerPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Secure Document Viewer"
        description="Encrypted documents — access requires a one-time code"
        actions={<TerraBadge tone="primary">AES-256 encrypted</TerraBadge>}
      />

      {!unlocked ? (
        <TerraCard className="mx-auto max-w-md flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-fixed text-3xl">
            🔒
          </span>
          <div>
            <p className="font-headline text-lg font-bold text-on-surface">
              Enter your access code
            </p>
            <p className="text-xs text-on-surface-variant">
              Sent to your registered email when the document was created.
            </p>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            className="w-48 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-center text-sm tracking-[0.3em] tabular-nums outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={code.length < 4}
            onClick={() => setUnlocked(true)}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            Unlock document
          </button>
          <button type="button" className="text-xs font-semibold text-primary hover:underline">
            Resend code to my email
          </button>
        </TerraCard>
      ) : (
        <TerraCard>
          <TerraSectionTitle
            title="Tax Statement 2025 — Q3"
            description="Unlocked • This session only"
            actions={
              <TerraBadge tone="success" dot>
                Verified
              </TerraBadge>
            }
          />
          <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 text-sm text-on-surface-variant">
            Document preview — 268 KB PDF
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnlocked(false)}
              className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Lock
            </button>
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
            >
              Download
            </button>
          </div>
        </TerraCard>
      )}
    </div>
  );
}
