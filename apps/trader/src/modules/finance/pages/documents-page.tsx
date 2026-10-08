"use client";

/**
 * Documents — converted from stitch_screens/documents
 * Document center listing statements, tax docs, invoices and KYC reports.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { terraDocuments } from "@/lib/fixtures/terra-fixtures";

const typeTone = {
  statement: "primary",
  tax: "tertiary",
  invoice: "secondary",
  kyc: "neutral",
} as const;

const typeHref: Record<string, string> = {
  statement: "/account-statement",
  tax: "/tax-documents",
  invoice: "/invoice-detail?id=48210",
  kyc: "/kyc-verification-status",
};

export function DocumentsPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Documents"
        description="Statements, invoices, tax reports and verification documents"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {terraDocuments.map((d) => (
          <TerraCard key={d.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-lg">
                📄
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">{d.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {d.format} • {d.size} • {d.date.slice(0, 10)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TerraBadge tone={typeTone[d.type]}>{d.type}</TerraBadge>
              <Link
                href={typeHref[d.type] ?? "/documents"}
                className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
              >
                View
              </Link>
            </div>
          </TerraCard>
        ))}
      </div>

      <TerraCard className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-fixed text-lg">
            🔒
          </span>
          <div>
            <p className="text-sm font-bold text-on-surface">Encrypted documents</p>
            <p className="text-xs text-on-surface-variant">
              Sensitive documents require a one-time access code.
            </p>
          </div>
        </div>
        <Link
          href="/document-viewer"
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
        >
          Open Secure Viewer
        </Link>
      </TerraCard>
    </div>
  );
}
