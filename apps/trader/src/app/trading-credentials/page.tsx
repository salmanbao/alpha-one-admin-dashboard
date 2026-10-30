import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingCredentialsPage } from "../../modules/account/pages/trading-credentials-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingCredentialsPage />
    </Suspense>
  );
}
