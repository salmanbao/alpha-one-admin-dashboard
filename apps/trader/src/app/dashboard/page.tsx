import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { DashboardPage } from "../../modules/dashboard/pages/dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPage />
    </Suspense>
  );
}
