import { Suspense } from "react";
import { OpenPositionsPage } from "../../modules/trading/pages/open-positions-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OpenPositionsPage />
    </Suspense>
  );
}
