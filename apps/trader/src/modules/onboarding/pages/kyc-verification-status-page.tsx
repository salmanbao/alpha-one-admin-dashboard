"use client";

/**
 * KYC Verification Status — converted from stitch_screens/kyc_verification_status
 * Status timeline with review stages and checklist.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

const stages = [
  { label: "Documents received", done: true, note: "Submitted 2 days ago" },
  { label: "Automated checks", done: true, note: "ID authenticity & liveness passed" },
  { label: "Compliance review", done: false, note: "In progress — usually under 24h" },
  { label: "Approved", done: false, note: "Unlocks payouts" },
];

const checklist = [
  { item: "Government ID", ok: true },
  { item: "Proof of address", ok: true },
  { item: "Selfie / liveness", ok: true },
  { item: "Source of funds (payouts > $10k)", ok: false, optional: true },
];

export function KycVerificationStatusPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification Status"
        description="Your identity verification is under review"
        actions={<TerraBadge tone="tertiary" dot pulse>Reviewing</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title="Review progress" />
          <ol className="space-y-5">
            {stages.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {s.done ? "✓" : "•"}
                </span>
                <div>
                  <p className={`text-sm font-bold ${s.done ? "text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </TerraCard>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Checklist" />
            <div className="space-y-2">
              {checklist.map((c) => (
                <div key={c.item} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2.5 text-sm">
                  <span className="text-on-surface">{c.item}</span>
                  <TerraBadge tone={c.ok ? "success" : c.optional ? "neutral" : "error"}>
                    {c.ok ? "Received" : c.optional ? "Optional" : "Pending"}
                  </TerraBadge>
                </div>
              ))}
            </div>
          </TerraCard>
          <TerraCard className="flex flex-col gap-2">
            <Link
              href="/support"
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Contact support
            </Link>
            <Link
              href="/documents"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              View submitted documents
            </Link>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
