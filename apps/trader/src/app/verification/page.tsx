import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { VerificationPage } from "../../modules/onboarding/pages/verification-page";

// SF-01 — the single verification route. Every KYC entry point
// (purchase-completed, getting-started tour, dashboard KYC card,
// lifecycle simulator) converges here; /kyc-onboarding,
// /account-verification-1/2 and /kyc-verification-status redirect in.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VerificationPage />
    </Suspense>
  );
}
