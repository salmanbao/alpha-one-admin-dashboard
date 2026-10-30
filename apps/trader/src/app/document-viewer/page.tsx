import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { DocumentViewerPage } from "../../modules/finance/pages/document-viewer-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DocumentViewerPage />
    </Suspense>
  );
}
