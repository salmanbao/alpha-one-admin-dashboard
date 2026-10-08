import { Suspense } from "react";
import { SupportPage } from "../../modules/support/pages/support-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}
