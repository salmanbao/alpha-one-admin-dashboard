import { Suspense } from "react";
import { CertificatesPage } from "../../modules/finance/pages/certificates-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CertificatesPage />
    </Suspense>
  );
}
