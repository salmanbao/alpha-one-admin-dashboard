import { Suspense } from "react";
import { DocumentViewerPage } from "../../modules/finance/pages/document-viewer-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentViewerPage />
    </Suspense>
  );
}
