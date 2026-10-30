import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { SessionsPage } from "../../modules/account/pages/sessions-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SessionsPage />
    </Suspense>
  );
}
