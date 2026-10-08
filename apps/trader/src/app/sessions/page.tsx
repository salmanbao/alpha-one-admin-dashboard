import { Suspense } from "react";
import { SessionsPage } from "../../modules/account/pages/sessions-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SessionsPage />
    </Suspense>
  );
}
