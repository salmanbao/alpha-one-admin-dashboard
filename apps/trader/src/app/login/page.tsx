import { Suspense } from "react";
import { LoginPage } from "../../modules/onboarding/pages/login-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
