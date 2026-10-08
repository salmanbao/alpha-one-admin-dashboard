import { Suspense } from "react";
import { ApiTokensPage } from "../../modules/account/pages/api-tokens-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ApiTokensPage />
    </Suspense>
  );
}
