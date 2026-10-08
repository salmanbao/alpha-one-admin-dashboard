import { Suspense } from "react";
import { ObjectivesPage } from "../../modules/accounts/pages/objectives-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ObjectivesPage />
    </Suspense>
  );
}
