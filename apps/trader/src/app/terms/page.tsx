import { Suspense } from "react";
import { TermsPage } from "../../modules/support/pages/terms-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TermsPage />
    </Suspense>
  );
}
