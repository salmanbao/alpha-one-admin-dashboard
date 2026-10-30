import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { WebTerminalPage } from "../../modules/trading/pages/web-terminal-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebTerminalPage />
    </Suspense>
  );
}
