import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CertificatesPage } from "../../modules/finance/pages/certificates-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CertificatesPage />
    </Suspense>
  );
}
