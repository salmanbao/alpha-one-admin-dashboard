import { Suspense } from "react";
import { DocumentsPage } from "../../modules/finance/pages/documents-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentsPage />
    </Suspense>
  );
}
