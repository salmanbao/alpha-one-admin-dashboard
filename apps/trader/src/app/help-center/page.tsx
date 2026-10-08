import { Suspense } from "react";
import { HelpCenterPage } from "../../modules/support/pages/help-center-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HelpCenterPage />
    </Suspense>
  );
}
