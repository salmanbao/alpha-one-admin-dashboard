import { Suspense } from "react";
import { RulesPage } from "../../modules/accounts/pages/rules-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RulesPage />
    </Suspense>
  );
}
