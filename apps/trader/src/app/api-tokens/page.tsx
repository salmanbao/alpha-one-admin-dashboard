import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ApiTokensPage } from "../../modules/account/pages/api-tokens-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApiTokensPage />
    </Suspense>
  );
}
