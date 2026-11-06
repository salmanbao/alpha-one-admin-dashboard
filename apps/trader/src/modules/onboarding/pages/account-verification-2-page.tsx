"use client";

/**
 * Account Verification (Step 2) — converted from stitch_screens/account_verification_2
 * Second step: document upload + review, completes into provisioning.
 */

import Link from "next/link";
import { useState } from "react";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  preview?: string;
}

export function AccountVerification2Page() {
  const [uploads, setUploads] = useState<Record<string, UploadedFile | null>>({
    "Government-issued photo ID": null,
    "Proof of address": null,
  });

  const handleFileSelect = (docType: string, file: File) => {
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setUploads((prev) => ({
      ...prev,
      [docType]: {
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
      },
    }));
    toast({
      title: "File selected",
      description: `${file.name} ready for upload (demo — no network call)`,
    });
  };

  const handleRemove = (docType: string) => {
    setUploads((prev) => ({ ...prev, [docType]: null }));
    toast({
      title: "File removed",
      description: `${docType} upload cleared`,
    });
  };

  const allUploaded = Object.values(uploads).every((f) => f !== null);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Verification"
        description="Step 2 of 2 — upload documents and review"
        actions={<TerraBadge tone="tertiary">Step 2 of 2</TerraBadge>}
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <TerraCard>
          <TerraSectionTitle title="Upload documents" />
          <div className="space-y-3">
            {Object.entries(uploads).map(([doc, file]) => (
              <div
                key={doc}
                className="flex items-center justify-between rounded-xl border border-dashed border-outline-variant px-4 py-5"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-on-surface truncate">{doc}</span>
                  {file && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {file.name}
                    </span>
                  )}
                </div>
                {file ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
                      onClick={() => handleRemove(doc)}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <label className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(doc, e.target.files[0])}
                    />
                    Upload
                  </label>
                )}
              </div>
            ))}
          </div>
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Review" />
          <div className="space-y-2 text-sm">
            {[
              ["Details confirmed", "✓"],
              ["Documents attached", allUploaded ? "✓" : "✗"],
              ["Agreement accepted", "✓"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                <span className="text-on-surface-variant">{k}</span>
                <span className={`font-bold ${v === "✓" ? "text-primary" : "text-error"}`}>{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between">
            <Link
              href="/account-verification-1"
              className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Back
            </Link>
            <button
              type="button"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              disabled={!allUploaded}
              onClick={() => {
                toast({
                  title: "Submitted for verification",
                  description: "Your documents are under review (demo — no network call)",
                });
              }}
            >
              Submit for verification
            </button>
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
