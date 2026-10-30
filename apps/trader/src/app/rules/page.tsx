import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { RulesPage } from "../../modules/accounts/pages/rules-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RulesPage />
    </Suspense>
  );
}
