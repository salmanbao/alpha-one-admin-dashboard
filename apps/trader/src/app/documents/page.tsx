import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { DocumentsPage } from "../../modules/finance/pages/documents-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DocumentsPage />
    </Suspense>
  );
}
