import { Suspense } from "react";
import { TradingCredentialsPage } from "../../modules/account/pages/trading-credentials-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradingCredentialsPage />
    </Suspense>
  );
}
