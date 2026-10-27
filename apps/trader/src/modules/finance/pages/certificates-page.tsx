"use client";

/**
 * Certificates — M12 "Certificates (downloadable funded cert)" +
 * M19 "Funded Trader Certificate (PDF)".
 * Verifiable credentials for funded/phase milestones with mock download.
 */

import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  type TerraTone,
} from "@/components/terra/terra-ui";
import { terraCertificates, type TerraCertificate } from "@/lib/fixtures/terra-fixtures";

const kindLabel: Record<TerraCertificate["kind"], string> = {
  funded: "Funded",
  phase: "Phase",
  completion: "Milestone",
};

const statusTone: Record<TerraCertificate["status"], TerraTone> = {
  issued: "primary",
  pending: "tertiary",
  locked: "neutral",
};

function handleDownload(cert: TerraCertificate) {
  // Frontend-only demo: no backend/PDF service — surface the mock action.
  alert(
    `Downloading "${cert.title}" (PDF)\n\n` +
      `Program: ${cert.program}\n` +
      `Credential ID: ${cert.credentialId}\n` +
      `Issued: ${new Date(cert.issuedAt).toLocaleDateString("en-US")}\n\n` +
      `Branded with the TerraTrader logo and a verifiable digital signature.`,
  );
}

function CertificatePreview({ cert }: { cert: TerraCertificate }) {
  const locked = cert.status !== "issued";
  return (
    <div
      className={
        locked
          ? "relative rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low/60 p-5"
          : "relative overflow-hidden rounded-xl border-2 border-primary-fixed bg-surface-container-lowest p-5 shadow-sm"
      }
    >
      {/* Corner seal */}
      <span
        aria-hidden="true"
        className={
          locked
            ? "absolute right-3 top-3 text-xl opacity-40"
            : "absolute right-3 top-3 text-2xl"
        }
      >
        {cert.kind === "funded" ? "🏆" : cert.status === "locked" ? "🔒" : "🎖️"}
      </span>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        TerraTrader • Certificate of Achievement
      </p>
      <h3
        className={
          locked
            ? "mt-2 font-headline text-lg font-bold text-on-surface-variant"
            : "mt-2 font-headline text-lg font-bold text-on-surface"
        }
      >
        {cert.title}
      </h3>
      <p className="mt-1 text-sm font-semibold text-on-surface">{cert.program}</p>
      {cert.accountSize && (
        <p className="text-xs text-on-surface-variant">
          Account size {cert.accountSize}
        </p>
      )}

      <div className="mt-4 space-y-1 border-t border-outline-variant/50 pt-3 text-[11px] text-on-surface-variant">
        <div className="flex justify-between gap-3">
          <span>{cert.status === "issued" ? "Credential ID" : "Requirement"}</span>
          <strong className="font-mono text-on-surface">{cert.credentialId}</strong>
        </div>
        <div className="flex justify-between gap-3">
          <span>Issued</span>
          <strong className="text-on-surface">
            {cert.status === "issued"
              ? new Date(cert.issuedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function CertificatesPage() {
  const issued = terraCertificates.filter((c) => c.status === "issued");

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Certificates"
        description="Downloadable, verifiable credentials for your funded and evaluation milestones"
        actions={
          <TerraBadge tone="primary">
            {issued.length} of {terraCertificates.length} issued
          </TerraBadge>
        }
      />

      <TerraCard>
        <TerraSectionTitle
          title="Your credentials"
          description="Funded trader certificates are issued automatically the moment an account is funded."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {terraCertificates.map((cert) => (
            <div key={cert.id} className="flex flex-col gap-3">
              <CertificatePreview cert={cert} />
              <div className="flex items-center justify-between gap-2">
                <TerraBadge tone={statusTone[cert.status]}>
                  {kindLabel[cert.kind]} • {cert.status}
                </TerraBadge>
                {cert.status === "issued" ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(cert)}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
                  >
                    Download PDF
                  </button>
                ) : cert.status === "pending" ? (
                  <span className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                    Awaiting completion
                  </span>
                ) : (
                  <span
                    className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant"
                    title={cert.credentialId}
                  >
                    Locked
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle
          title="Verification"
          description="Share a credential ID so employers or prop firms can verify your certificate."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 rounded-xl bg-surface-container-low px-4 py-3 font-mono text-sm font-bold text-on-surface">
            verify.terra.trader/c/{issued[0]?.credentialId ?? "—"}
          </div>
          <button
            type="button"
            onClick={() => alert("Verification link copied to clipboard!")}
            className="rounded-xl bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
          >
            Copy link
          </button>
        </div>
        <div className="mt-4">
          <TerraEmpty
            title="Need a re-issued copy?"
            description="Lost a certificate? Contact support and we'll re-issue it with a fresh digital signature within 24 hours."
          />
        </div>
      </TerraCard>
    </div>
  );
}
